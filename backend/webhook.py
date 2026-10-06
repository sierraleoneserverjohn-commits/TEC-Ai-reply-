"""
Meta WhatsApp Webhook Endpoint.
Handles verification challenge handshake (GET) and incoming webhook events (POST).
Reads metadata.phone_number_id, deduplicates on wa_message_id, saves messages
as pending immediately before AI dispatch, and delegates reply generation to background workers.
Always returns 200 quickly to prevent Meta webhook delivery retries or disconnections.
"""

import hmac
import hashlib
import logging
from typing import Optional
from fastapi import APIRouter, Request, Response, BackgroundTasks, Header, HTTPException, status
from config import WA_VERIFY_TOKEN, WA_APP_SECRET
from db import (
    async_upsert_contact_from_inbound,
    async_message_exists,
    async_create_message,
    get_supabase
)
from recovery import process_incoming_message
from logger import record_log

logger = logging.getLogger("johnny_reply.webhook")

router = APIRouter(prefix="/webhook", tags=["Webhook"])

def verify_meta_signature(raw_body: bytes, signature_header: Optional[str]) -> bool:
    """Validates the X-Hub-Signature-256 header sent by Meta using WA_APP_SECRET."""
    if not WA_APP_SECRET:
        logger.warning("WA_APP_SECRET not configured. Skipping signature verification.")
        return True

    if not signature_header or not signature_header.startswith("sha256="):
        logger.warning("Missing or malformed X-Hub-Signature-256 header.")
        return False

    expected_signature = signature_header[7:]
    generated_signature = hmac.new(
        key=WA_APP_SECRET.encode("utf-8"),
        msg=raw_body,
        digestmod=hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(generated_signature, expected_signature)

@router.get("")
async def verify_webhook(request: Request):
    """
    Meta Webhook Verification (Challenge Handshake).
    Returns challenge as plain text and handles integer/string values cleanly.
    """
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")

    if mode == "subscribe" and token == WA_VERIFY_TOKEN:
        logger.info("Webhook verification challenge accepted.")
        record_log(
            category="whatsapp",
            level="info",
            message="Meta Webhook subscription verified successfully"
        )
        return Response(content=str(challenge or ""), media_type="text/plain", status_code=200)

    logger.warning("Webhook verification challenge failed. Token mismatch.")
    record_log(
        category="whatsapp",
        level="warning",
        message="Meta Webhook verification challenge rejected: Token mismatch"
    )
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Verification token mismatch")

@router.post("")
async def receive_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_hub_signature_256: Optional[str] = Header(None)
):
    """
    Handles incoming WhatsApp events.
    1. Verifies payload signature against raw request body
    2. Deduplicates incoming messages on wa_message_id
    3. Captures phone_number_id from metadata
    4. Saves messages to DB with status='pending' before AI call
    5. Returns 200 OK immediately
    6. Schedules AI reply handling in background
    """
    raw_body = await request.body()

    if WA_APP_SECRET and not verify_meta_signature(raw_body, x_hub_signature_256):
        logger.warning("Invalid X-Hub-Signature-256. Rejecting webhook.")
        record_log(category="whatsapp", level="error", message="Rejected webhook: Invalid HMAC signature")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid signature")

    try:
        payload = await request.json()
    except Exception as e:
        logger.error(f"Error parsing JSON payload: {e}")
        return {"status": "ignored"}

    try:
        entries = payload.get("entry", [])
        for entry in entries:
            for change in entry.get("changes", []):
                val = change.get("value", {})

                # Extract recipient business phone_number_id from payload metadata
                metadata = val.get("metadata", {})
                phone_number_id = metadata.get("phone_number_id")

                # -------------------------------------------------------------
                # 1. Delivery & Read Status Updates (e.g. failed deliveries)
                # -------------------------------------------------------------
                statuses = val.get("statuses", [])
                for st in statuses:
                    status_name = st.get("status")
                    wamid = st.get("id")
                    if status_name == "failed":
                        errors = st.get("errors", [])
                        err_code = errors[0].get("code") if errors else "unknown_meta_error"
                        err_title = errors[0].get("title") if errors else "Message failed to deliver"
                        logger.error(f"[STATUS] Delivery failure for wamid {wamid}: code {err_code} - {err_title}")
                        record_log(
                            category="whatsapp",
                            level="error",
                            message=f"WhatsApp delivery failure ({err_code}): {err_title}",
                            meta={"wamid": wamid, "errors": errors, "phone_number_id": phone_number_id}
                        )
                        try:
                            import asyncio
                            supabase = get_supabase()
                            def _up():
                                supabase.table("messages").update({
                                    "status": "failed",
                                    "error": f"Delivery failure ({err_code}): {err_title}"
                                }).eq("wa_message_id", wamid).execute()
                            await asyncio.to_thread(_up)
                        except Exception as err:
                            logger.warning(f"Failed to update failed status in DB: {err}")

                # -------------------------------------------------------------
                # 2. Inbound Messages
                # -------------------------------------------------------------
                messages = val.get("messages", [])
                contacts_info = val.get("contacts", [])

                for msg in messages:
                    wa_msg_id = msg.get("id")
                    wa_id = msg.get("from")
                    msg_type = msg.get("type", "unknown")

                    if not wa_msg_id or not wa_id:
                        continue

                    profile_name = None
                    if contacts_info:
                        profile_name = contacts_info[0].get("profile", {}).get("name")

                    # Deduplication check
                    already_exists = await async_message_exists(wa_msg_id)
                    if already_exists:
                        logger.info(f"Duplicate incoming message {wa_msg_id} from +{wa_id}. Skipping.")
                        continue

                    contact = await async_upsert_contact_from_inbound(
                        wa_id=wa_id,
                        profile_name=profile_name,
                        phone_number_id=phone_number_id
                    )
                    contact_id = contact["id"]

                    if msg_type == "text":
                        body_text = msg.get("text", {}).get("body", "")
                        initial_status = "pending"
                        error_detail = None
                    elif msg_type in ("audio", "voice"):
                        body_text = msg.get("audio", {}).get("caption") or "[VOICE NOTE]"
                        initial_status = "needs_attention"
                        error_detail = "Received voice note. Human review recommended."
                    elif msg_type == "image":
                        body_text = msg.get("image", {}).get("caption") or "[IMAGE]"
                        initial_status = "needs_attention"
                        error_detail = "Received image attachment."
                    else:
                        body_text = f"[{msg_type.upper()}]"
                        initial_status = "needs_attention"
                        error_detail = f"Received non-text message type: {msg_type}"

                    created_record = await async_create_message(
                        contact_id=contact_id,
                        direction="in",
                        sender="contact",
                        body=body_text,
                        status=initial_status,
                        wa_message_id=wa_msg_id,
                        phone_number_id=phone_number_id,
                        error=error_detail
                    )

                    record_log(
                        category="whatsapp",
                        level="info",
                        message=f"Received inbound {msg_type} from +{wa_id}",
                        meta={"wamid": wa_msg_id, "wa_id": wa_id, "phone_number_id": phone_number_id}
                    )

                    if initial_status == "pending" and created_record:
                        background_tasks.add_task(process_incoming_message, created_record["id"])

    except Exception as e:
        logger.error(f"Error handling webhook payload: {e}", exc_info=True)
        record_log(
            category="whatsapp",
            level="error",
            message=f"Unhandled error processing webhook payload: {str(e)}"
        )

    return {"status": "ok"}
