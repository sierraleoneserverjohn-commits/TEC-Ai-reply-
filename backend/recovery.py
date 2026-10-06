"""
Recovery and Background Message Processing Engine.
Ensures zero message loss even if the Render server was sleeping.
Uses in-memory concurrency locks so two loops never process the same message twice.
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, Set

from db import (
    get_supabase,
    async_get_setting,
    async_get_contact,
    async_get_recent_messages,
    async_create_message,
    async_update_message
)
import whatsapp
import brain
import memory
from logger import record_log

logger = logging.getLogger("johnny_reply.recovery")

# Concurrency lock to prevent duplicate replies to the same message
_processing_lock = asyncio.Lock()
_active_message_ids: Set[str] = set()

async def process_incoming_message(message_id: str) -> None:
    """
    Core reply pipeline for a single incoming message:
    1. Acquires lock for message_id
    2. Validates pending status
    3. Respects human_takeover, bot_enabled, and contact.mode
    4. Applies response_delay_seconds
    5. Dispatches reply from the matching phone_number_id
    """
    async with _processing_lock:
        if message_id in _active_message_ids:
            logger.info(f"Message {message_id} is already being processed. Skipping.")
            return
        _active_message_ids.add(message_id)

    try:
        await _execute_reply_flow(message_id)
    finally:
        async with _processing_lock:
            _active_message_ids.discard(message_id)

async def _execute_reply_flow(message_id: str) -> None:
    def _fetch_msg():
        supabase = get_supabase()
        return supabase.table("messages").select("*").eq("id", message_id).limit(1).execute()
    
    res = await asyncio.to_thread(_fetch_msg)

    if not res.data:
        logger.warning(f"Message {message_id} not found in database.")
        return

    msg = res.data[0]
    current_status = msg.get("status")

    if current_status in ("replied", "drafted", "ignored", "failed_outside_window"):
        logger.info(f"Message {message_id} already reached terminal status '{current_status}'. Skipping.")
        return

    attempts = msg.get("attempts", 0) + 1
    await async_update_message(message_id, {"attempts": attempts})

    contact_id = msg.get("contact_id")
    contact = await async_get_contact(contact_id)
    if not contact:
        logger.error(f"Contact {contact_id} not found for message {message_id}.")
        await async_update_message(message_id, {"status": "failed", "error": "Contact not found"})
        return

    wa_id = contact.get("wa_id")
    # Message-specific phone_number_id or contact fallback
    phone_number_id = msg.get("phone_number_id") or contact.get("phone_number_id")
    now_iso = datetime.now(timezone.utc).isoformat()

    try:
        # 1. Master bot switch
        bot_enabled = await async_get_setting("bot_enabled", True)
        if not bot_enabled:
            logger.info(f"Bot disabled globally. Marking message {message_id} as ignored.")
            await async_update_message(message_id, {"status": "ignored"})
            record_log(
                category="ai",
                level="info",
                message=f"Bot disabled globally: ignored message from +{wa_id}",
                meta={"message_id": message_id, "wa_id": wa_id}
            )
            return

        # 2. Human Takeover check
        if contact.get("human_takeover", False):
            logger.info(f"Human takeover active for +{wa_id}. Pausing AI auto-reply.")
            await async_update_message(message_id, {"status": "ignored", "error": "Human takeover active"})
            record_log(
                category="ai",
                level="info",
                message=f"Human takeover active: AI paused for +{wa_id}",
                meta={"contact_id": contact_id, "wa_id": wa_id}
            )
            return

        # 3. Contact Mode: 'auto' | 'ask' | 'off'
        contact_mode = contact.get("mode", "ask")
        if contact_mode == "off":
            logger.info(f"Contact +{wa_id} mode is 'off'. Ignoring message {message_id}.")
            await async_update_message(message_id, {"status": "ignored"})
            return

        # 4. Configurable Response Delay (simulate human pause)
        delay_sec = int(await async_get_setting("response_delay_seconds", 2))
        if delay_sec > 0:
            await asyncio.sleep(delay_sec)

        # 5. Fetch conversation history for prompt
        recent = await async_get_recent_messages(contact_id, limit=20)

        # 6. Generate reply via Gemini Brain
        reply_text, needs_attention, tokens_used, latency_ms = await brain.generate_reply(contact, recent)

        if needs_attention or not reply_text:
            logger.info(f"Message {message_id} flagged as needs_attention.")
            await async_update_message(message_id, {
                "status": "needs_attention",
                "error": "Safety boundary or human decision required",
                "tokens_used": tokens_used,
                "latency_ms": latency_ms
            })
            record_log(
                category="ai",
                level="warning",
                message=f"Message flagged as needs_attention from +{wa_id}",
                meta={"message_id": message_id, "wa_id": wa_id, "latency_ms": latency_ms}
            )
            return

        # 7. Action based on mode
        if contact_mode == "ask":
            logger.info(f"Drafting reply for message {message_id} from +{wa_id}")
            await async_update_message(message_id, {
                "status": "drafted",
                "ai_draft": reply_text,
                "tokens_used": tokens_used,
                "latency_ms": latency_ms
            })
            record_log(
                category="ai",
                level="info",
                message=f"AI draft prepared for +{wa_id}",
                meta={"message_id": message_id, "tokens_used": tokens_used, "latency_ms": latency_ms}
            )

        elif contact_mode == "auto":
            logger.info(f"Auto-replying to +{wa_id} from phone_id {phone_number_id}")
            try:
                # Send from the exact matching business number the message arrived on
                send_res = await whatsapp.send_text(wa_id, reply_text, phone_number_id=phone_number_id)

                await async_create_message(
                    contact_id=contact_id,
                    direction="out",
                    sender="ai",
                    body=reply_text,
                    status="replied",
                    wa_message_id=send_res.get("wa_message_id"),
                    phone_number_id=phone_number_id,
                    tokens_used=tokens_used,
                    latency_ms=latency_ms
                )

                await async_update_message(message_id, {
                    "status": "replied",
                    "replied_at": now_iso,
                    "ai_draft": reply_text,
                    "tokens_used": tokens_used,
                    "latency_ms": latency_ms
                })

                record_log(
                    category="ai",
                    level="info",
                    message=f"Auto-reply sent to +{wa_id}",
                    meta={"message_id": message_id, "tokens_used": tokens_used, "latency_ms": latency_ms}
                )

            except whatsapp.WhatsAppError as wa_err:
                if wa_err.code == "131047":
                    # Outside 24-hour window
                    logger.warning(f"Message {message_id} blocked: Outside 24h window for +{wa_id}")
                    await async_update_message(message_id, {
                        "status": "failed_outside_window",
                        "error": str(wa_err),
                        "ai_draft": reply_text
                    })
                    record_log(
                        category="whatsapp",
                        level="warning",
                        message=f"Auto-reply blocked: outside 24h customer window for +{wa_id}",
                        meta={"message_id": message_id, "error_code": "131047"}
                    )
                    return
                else:
                    raise

        # 8. Trigger self-learning check
        try:
            await memory.analyze_and_update_memory(contact)
        except Exception as mem_err:
            logger.warning(f"Memory update check failed: {mem_err}")

    except Exception as e:
        logger.error(f"Error processing message {message_id}: {e}", exc_info=True)
        err_msg = str(e)
        if attempts >= 3:
            await async_update_message(message_id, {
                "status": "failed",
                "error": f"Failed after 3 attempts: {err_msg}"
            })
            record_log(
                category="ai",
                level="error",
                message=f"Message {message_id} failed after 3 attempts: {err_msg}",
                meta={"message_id": message_id, "attempts": attempts}
            )
        else:
            await async_update_message(message_id, {
                "error": f"Attempt {attempts} failed: {err_msg}"
            })

async def run_recovery_check() -> None:
    """Finds unprocessed pending messages older than 30s and failed messages with attempts < 3."""
    try:
        supabase = get_supabase()
        cutoff = (datetime.now(timezone.utc) - timedelta(seconds=30)).isoformat()
        
        def _query_pending():
            return supabase.table("messages") \
                .select("id, created_at, attempts") \
                .eq("direction", "in") \
                .eq("status", "pending") \
                .lt("created_at", cutoff) \
                .limit(20) \
                .execute()

        pending_res = await asyncio.to_thread(_query_pending)
        for item in (pending_res.data or []):
            logger.info(f"[RECOVERY] Found stalled pending message {item['id']}. Recovering.")
            await process_incoming_message(item["id"])

        def _query_failed():
            return supabase.table("messages") \
                .select("id, attempts") \
                .eq("direction", "in") \
                .eq("status", "failed") \
                .lt("attempts", 3) \
                .limit(10) \
                .execute()

        retry_res = await asyncio.to_thread(_query_failed)
        for item in (retry_res.data or []):
            logger.info(f"[RECOVERY] Retrying failed message {item['id']} (attempt {item['attempts']}/3)")
            await process_incoming_message(item["id"])

    except Exception as e:
        logger.error(f"Error in recovery check cycle: {e}")

async def start_recovery_background_loop() -> None:
    """Perpetual background worker: runs recovery on startup, then every 2 minutes."""
    logger.info("Initializing recovery worker loop (every 2 minutes)...")
    try:
        await run_recovery_check()
    except Exception as e:
        logger.error(f"Initial recovery run encountered error: {e}")

    while True:
        try:
            await asyncio.sleep(120)
            await run_recovery_check()
        except asyncio.CancelledError:
            logger.info("Recovery background loop cancelled.")
            break
        except Exception as e:
            logger.error(f"Recovery background loop error: {e}")
            await asyncio.sleep(30)
