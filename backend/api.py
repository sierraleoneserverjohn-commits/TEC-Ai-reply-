"""
Control Panel REST API for Johnny TEC AI Reply.
Protected by Supabase Auth (auth.py) validating the OWNER_EMAIL.
Powers the mobile PWA control panel.
All database calls are executed safely via asyncio.to_thread.
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, status, Depends, Query

from auth import require_owner_auth
from db import (
    get_supabase,
    async_get_setting,
    async_set_setting,
    async_get_contact,
    async_update_contact,
    async_create_message,
    async_update_message,
    async_get_recent_messages
)
from config import normalize_phone_number
import whatsapp
import brain
from logger import record_log

logger = logging.getLogger("johnny_reply.api")

router = APIRouter(prefix="/api", tags=["Control Panel API"])

# ==============================================================================
# Request Models
# ==============================================================================

class NewContactRequest(BaseModel):
    wa_id: str
    display_name: Optional[str] = None
    first_message: Optional[str] = None
    relationship: Optional[str] = None
    custom_instruction: Optional[str] = None
    mode: Optional[str] = Field("ask", pattern="^(auto|ask|off)$")

class ContactUpdate(BaseModel):
    display_name: Optional[str] = None
    relationship: Optional[str] = None
    custom_instruction: Optional[str] = None
    language: Optional[str] = None
    mode: Optional[str] = Field(None, pattern="^(auto|ask|off)$")
    archived: Optional[bool] = None

class SendMessageRequest(BaseModel):
    text: str

class ApproveDraftRequest(BaseModel):
    text: Optional[str] = None

class SettingsUpdateRequest(BaseModel):
    bot_enabled: Optional[bool] = None
    response_delay_seconds: Optional[int] = Field(None, ge=0, le=60)
    default_personality: Optional[str] = Field(None, pattern="^(friendly_helpful|professional|casual|short_direct)$")
    default_language: Optional[str] = None

# ==============================================================================
# Stats Endpoint
# ==============================================================================

@router.get("/stats", dependencies=[Depends(require_owner_auth)])
async def get_dashboard_stats():
    """
    Computes dashboard metrics in threadpool:
    - total messages today & % change vs yesterday
    - AI replies today & % change vs yesterday
    - active chats (inbound/outbound activity within last 24h)
    - average response latency (ms/seconds)
    """
    def _calc_stats():
        supabase = get_supabase()
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        yesterday_start = today_start - timedelta(days=1)
        last_24h_start = now - timedelta(hours=24)

        # Inbound messages today & yesterday
        in_today_res = supabase.table("messages").select("id", count="exact").eq("direction", "in").gte("created_at", today_start.isoformat()).execute()
        in_today = in_today_res.count or 0

        in_yesterday_res = supabase.table("messages").select("id", count="exact").eq("direction", "in").gte("created_at", yesterday_start.isoformat()).lt("created_at", today_start.isoformat()).execute()
        in_yesterday = in_yesterday_res.count or 0

        in_change = int(((in_today - in_yesterday) / max(in_yesterday, 1)) * 100) if in_yesterday > 0 else (100 if in_today > 0 else 0)

        # AI replies today & yesterday
        ai_today_res = supabase.table("messages").select("id", count="exact").eq("direction", "out").eq("sender", "ai").gte("created_at", today_start.isoformat()).execute()
        ai_today = ai_today_res.count or 0

        ai_yesterday_res = supabase.table("messages").select("id", count="exact").eq("direction", "out").eq("sender", "ai").gte("created_at", yesterday_start.isoformat()).lt("created_at", today_start.isoformat()).execute()
        ai_yesterday = ai_yesterday_res.count or 0

        ai_change = int(((ai_today - ai_yesterday) / max(ai_yesterday, 1)) * 100) if ai_yesterday > 0 else (100 if ai_today > 0 else 0)

        # Active chats in last 24h
        active_res = supabase.table("contacts").select("id", count="exact").gte("last_inbound_at", last_24h_start.isoformat()).execute()
        active_chats = active_res.count or 0

        # Average response latency for AI replies today
        lat_res = supabase.table("messages").select("latency_ms").eq("sender", "ai").gte("created_at", today_start.isoformat()).gt("latency_ms", 0).execute()
        lat_list = [row["latency_ms"] for row in (lat_res.data or []) if row.get("latency_ms")]
        avg_latency_ms = int(sum(lat_list) / len(lat_list)) if lat_list else 1250
        avg_response_time = f"{round(avg_latency_ms / 1000, 1)}s"

        return {
            "total_messages_today": in_today,
            "total_messages_change": in_change,
            "ai_replies_today": ai_today,
            "ai_replies_change": ai_change,
            "active_chats_24h": active_chats,
            "average_response_time": avg_response_time,
            "average_latency_ms": avg_latency_ms
        }

    return await asyncio.to_thread(_calc_stats)

# ==============================================================================
# Contacts Endpoints
# ==============================================================================

@router.get("/contacts", dependencies=[Depends(require_owner_auth)])
async def list_contacts(filter: str = Query("all", pattern="^(all|active|archived)$")):
    """List contacts with previews and badge counts. Supports all, active, archived filters."""
    def _query_contacts():
        supabase = get_supabase()
        query = supabase.table("contacts").select("*")

        if filter == "archived":
            query = query.eq("archived", True)
        elif filter == "active":
            query = query.eq("archived", False)

        res = query.order("last_inbound_at", desc=True, nullsfirst=False).execute()
        contacts = res.data or []

        enriched = []
        for c in contacts:
            cid = c["id"]
            last_msg_res = supabase.table("messages").select("body, direction, sender, status, created_at, ai_draft").eq("contact_id", cid).order("created_at", desc=True).limit(1).execute()
            last_msg = last_msg_res.data[0] if (last_msg_res.data and len(last_msg_res.data) > 0) else None

            drafts_res = supabase.table("messages").select("id", count="exact").eq("contact_id", cid).eq("status", "drafted").execute()
            drafts_count = drafts_res.count or 0

            attn_res = supabase.table("messages").select("id", count="exact").eq("contact_id", cid).eq("status", "needs_attention").execute()
            attn_count = attn_res.count or 0

            item = dict(c)
            item["last_message"] = last_msg
            item["drafts_waiting"] = drafts_count
            item["needs_attention_count"] = attn_count
            enriched.append(item)

        return enriched

    return await asyncio.to_thread(_query_contacts)

@router.post("/contacts", dependencies=[Depends(require_owner_auth)])
async def create_new_contact(payload: NewContactRequest):
    """
    Creates a new contact from the floating WhatsApp button modal.
    Optionally sends an immediate outgoing message if first_message is provided.
    """
    clean_wa_id = normalize_phone_number(payload.wa_id)
    if not clean_wa_id:
        raise HTTPException(status_code=400, detail="A valid phone number with country code is required.")

    def _sync_create():
        supabase = get_supabase()
        # Check if contact already exists
        existing = supabase.table("contacts").select("*").eq("wa_id", clean_wa_id).limit(1).execute()
        now_iso = datetime.now(timezone.utc).isoformat()
        if existing.data and len(existing.data) > 0:
            contact = existing.data[0]
            # Update display name or relationship if provided
            up_data = {}
            if payload.display_name and not contact.get("display_name"):
                up_data["display_name"] = payload.display_name
            if payload.relationship:
                up_data["relationship"] = payload.relationship
            if payload.custom_instruction:
                up_data["custom_instruction"] = payload.custom_instruction
            if up_data:
                supabase.table("contacts").update(up_data).eq("id", contact["id"]).execute()
            return contact, False
        else:
            new_contact = {
                "wa_id": clean_wa_id,
                "display_name": payload.display_name or f"+{clean_wa_id}",
                "relationship": payload.relationship,
                "custom_instruction": payload.custom_instruction,
                "mode": payload.mode or "ask",
                "archived": False,
                "human_takeover": False,
                "learned_profile": {},
                "inbound_since_profile_update": 0,
                "created_at": now_iso
            }
            res = supabase.table("contacts").insert(new_contact).execute()
            return res.data[0], True

    contact, created = await asyncio.to_thread(_sync_create)

    # If first_message is provided, send it
    if payload.first_message and payload.first_message.strip():
        text = payload.first_message.strip()
        try:
            send_res = await whatsapp.send_text(clean_wa_id, text)
            await async_create_message(
                contact_id=contact["id"],
                direction="out",
                sender="me",
                body=text,
                status="replied",
                wa_message_id=send_res.get("wa_message_id")
            )
        except Exception as e:
            await async_create_message(
                contact_id=contact["id"],
                direction="out",
                sender="me",
                body=text,
                status="failed",
                error=str(e)
            )

    record_log(
        category="system",
        level="info",
        message=f"{'Created' if created else 'Retrieved'} contact +{clean_wa_id} via quick action",
        meta={"contact_id": contact["id"], "wa_id": clean_wa_id}
    )

    return contact

@router.get("/contacts/{contact_id}", dependencies=[Depends(require_owner_auth)])
async def get_single_contact(contact_id: str):
    """Fetch single contact with learned_profile."""
    contact = await async_get_contact(contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact

@router.patch("/contacts/{contact_id}", dependencies=[Depends(require_owner_auth)])
async def patch_contact(contact_id: str, payload: ContactUpdate):
    """Update contact settings, custom_instruction, mode, or archive flag."""
    contact = await async_get_contact(contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    update_fields = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update_fields:
        return contact

    updated = await async_update_contact(contact_id, update_fields)
    record_log(
        category="system",
        level="info",
        message=f"Updated contact {contact.get('wa_id')}",
        meta={"contact_id": contact_id, "fields": list(update_fields.keys())}
    )
    return updated

@router.get("/contacts/{contact_id}/messages", dependencies=[Depends(require_owner_auth)])
async def get_contact_messages(contact_id: str):
    """Retrieve full chronological conversation."""
    def _fetch():
        supabase = get_supabase()
        res = supabase.table("messages").select("*").eq("contact_id", contact_id).order("created_at", desc=False).execute()
        return res.data or []
    return await asyncio.to_thread(_fetch)

@router.post("/contacts/{contact_id}/send", dependencies=[Depends(require_owner_auth)])
async def send_manual_message(contact_id: str, payload: SendMessageRequest):
    """Send manual WhatsApp reply composed directly by user."""
    contact = await async_get_contact(contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Message text cannot be empty")

    wa_id = contact["wa_id"]

    try:
        send_res = await whatsapp.send_text(wa_id, text)
        msg = await async_create_message(
            contact_id=contact_id,
            direction="out",
            sender="me",
            body=text,
            status="replied",
            wa_message_id=send_res.get("wa_message_id")
        )
        return {"success": True, "message": msg}
    except whatsapp.WhatsAppError as e:
        status_name = "failed_outside_window" if e.code == "131047" else "failed"
        await async_create_message(
            contact_id=contact_id,
            direction="out",
            sender="me",
            body=text,
            status=status_name,
            error=str(e)
        )
        raise HTTPException(status_code=400, detail=f"WhatsApp sending failed: {str(e)}")

@router.post("/contacts/{contact_id}/takeover", dependencies=[Depends(require_owner_auth)])
async def takeover_chat(contact_id: str):
    """Activates human takeover: pauses AI auto-reply for this contact."""
    updated = await async_update_contact(contact_id, {"human_takeover": True})
    if not updated:
        raise HTTPException(status_code=404, detail="Contact not found")
    record_log(
        category="system",
        level="info",
        message=f"Human takeover activated for {updated.get('wa_id')}",
        meta={"contact_id": contact_id}
    )
    return {"success": True, "human_takeover": True}

@router.post("/contacts/{contact_id}/handback", dependencies=[Depends(require_owner_auth)])
async def handback_chat(contact_id: str):
    """Deactivates human takeover: hands chat back to AI."""
    updated = await async_update_contact(contact_id, {"human_takeover": False})
    if not updated:
        raise HTTPException(status_code=404, detail="Contact not found")
    record_log(
        category="system",
        level="info",
        message=f"Human takeover ended; handed back to AI for {updated.get('wa_id')}",
        meta={"contact_id": contact_id}
    )
    return {"success": True, "human_takeover": False}

# ==============================================================================
# Message Actions (Draft Approvals, Reject, Regenerate)
# ==============================================================================

@router.post("/messages/{message_id}/approve", dependencies=[Depends(require_owner_auth)])
async def approve_draft(message_id: str, payload: ApproveDraftRequest):
    """Approve an AI draft and send it to WhatsApp with optional edited text."""
    def _fetch_msg():
        supabase = get_supabase()
        res = supabase.table("messages").select("*").eq("id", message_id).limit(1).execute()
        return res.data[0] if (res.data and len(res.data) > 0) else None

    msg = await asyncio.to_thread(_fetch_msg)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    final_text = (payload.text or msg.get("ai_draft") or "").strip()
    if not final_text:
        raise HTTPException(status_code=400, detail="Cannot send empty message text")

    contact = await async_get_contact(msg["contact_id"])
    if not contact:
        raise HTTPException(status_code=404, detail="Associated contact not found")

    wa_id = contact["wa_id"]

    try:
        send_res = await whatsapp.send_text(wa_id, final_text)
        now_iso = datetime.now(timezone.utc).isoformat()

        out_msg = await async_create_message(
            contact_id=contact["id"],
            direction="out",
            sender="ai",
            body=final_text,
            status="replied",
            wa_message_id=send_res.get("wa_message_id")
        )

        await async_update_message(message_id, {
            "status": "replied",
            "replied_at": now_iso,
            "ai_draft": final_text
        })

        record_log(
            category="ai",
            level="info",
            message=f"Draft approved and sent to +{wa_id}",
            meta={"message_id": message_id}
        )

        return {"success": True, "outgoing_message": out_msg}
    except whatsapp.WhatsAppError as e:
        status_name = "failed_outside_window" if e.code == "131047" else "failed"
        await async_update_message(message_id, {"status": status_name, "error": f"Approval failed: {str(e)}"})
        raise HTTPException(status_code=400, detail=f"WhatsApp send failed: {str(e)}")

@router.post("/messages/{message_id}/reject", dependencies=[Depends(require_owner_auth)])
async def reject_draft(message_id: str):
    """Reject an AI draft without sending any message."""
    res = await async_update_message(message_id, {"status": "ignored"})
    if not res:
        raise HTTPException(status_code=404, detail="Message not found")
    record_log(category="ai", level="info", message=f"Draft rejected for message {message_id}")
    return {"success": True, "message_id": message_id, "status": "ignored"}

@router.post("/messages/{message_id}/regenerate", dependencies=[Depends(require_owner_auth)])
async def regenerate_draft(message_id: str):
    """Re-run the Gemini Brain to create a fresh draft for this message."""
    def _fetch_msg():
        supabase = get_supabase()
        res = supabase.table("messages").select("*").eq("id", message_id).limit(1).execute()
        return res.data[0] if (res.data and len(res.data) > 0) else None

    msg = await asyncio.to_thread(_fetch_msg)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    contact = await async_get_contact(msg["contact_id"])
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    recent = await async_get_recent_messages(contact["id"], limit=20)
    # Corrected: await async brain.generate_reply
    new_draft, needs_attention, tokens, latency = await brain.generate_reply(contact, recent)

    if needs_attention or not new_draft:
        await async_update_message(message_id, {"status": "needs_attention"})
        return {"success": False, "needs_attention": True}

    await async_update_message(message_id, {
        "status": "drafted",
        "ai_draft": new_draft,
        "tokens_used": tokens,
        "latency_ms": latency
    })
    return {"success": True, "draft": new_draft}

# ==============================================================================
# Settings Endpoints
# ==============================================================================

@router.get("/settings", dependencies=[Depends(require_owner_auth)])
async def get_bot_settings():
    """Retrieve global AI settings."""
    bot_enabled = await async_get_setting("bot_enabled", True)
    response_delay = await async_get_setting("response_delay_seconds", 2)
    personality = await async_get_setting("default_personality", "friendly_helpful")
    language = await async_get_setting("default_language", "en")

    return {
        "bot_enabled": bot_enabled,
        "response_delay_seconds": response_delay,
        "default_personality": personality,
        "default_language": language
    }

@router.put("/settings", dependencies=[Depends(require_owner_auth)])
async def update_bot_settings(payload: SettingsUpdateRequest):
    """Update global AI settings."""
    if payload.bot_enabled is not None:
        await async_set_setting("bot_enabled", payload.bot_enabled)
    if payload.response_delay_seconds is not None:
        await async_set_setting("response_delay_seconds", payload.response_delay_seconds)
    if payload.default_personality is not None:
        await async_set_setting("default_personality", payload.default_personality)
    if payload.default_language is not None:
        await async_set_setting("default_language", payload.default_language.strip())

    return await get_bot_settings()

# ==============================================================================
# WhatsApp Connection Endpoints
# ==============================================================================

@router.get("/connection", dependencies=[Depends(require_owner_auth)])
async def get_connection_status():
    """Reads WhatsApp status, phone number, and last webhook timestamp."""
    info = await whatsapp.get_connection_info()

    def _get_last_event():
        supabase = get_supabase()
        last_log_res = supabase.table("logs").select("created_at").eq("category", "whatsapp").order("created_at", desc=True).limit(1).execute()
        return last_log_res.data[0]["created_at"] if (last_log_res.data and len(last_log_res.data) > 0) else None

    last_webhook_at = await asyncio.to_thread(_get_last_event)

    return {
        **info,
        "last_webhook_at": last_webhook_at
    }

@router.post("/connection/test", dependencies=[Depends(require_owner_auth)])
async def test_connection():
    """Runs live test against Meta Graph API."""
    info = await whatsapp.get_connection_info()
    return info

# ==============================================================================
# Logs & Error Endpoints
# ==============================================================================

@router.get("/logs", dependencies=[Depends(require_owner_auth)])
async def get_conversation_logs(type: str = Query("all", pattern="^(all|user|ai|manual|drafts|failed|errors)$"), limit: int = 50):
    """Retrieve message and conversation activity logs with filter."""
    def _fetch_logs():
        supabase = get_supabase()
        query = supabase.table("messages").select("*, contacts(display_name, wa_id)")

        if type == "user":
            query = query.eq("sender", "contact")
        elif type == "ai":
            query = query.eq("sender", "ai")
        elif type == "manual":
            query = query.eq("sender", "me")
        elif type == "drafts":
            query = query.eq("status", "drafted")
        elif type in ("errors", "failed"):
            query = query.in_("status", ["failed", "needs_attention", "failed_outside_window"])

        res = query.order("created_at", desc=True).limit(limit).execute()
        return res.data or []

    return await asyncio.to_thread(_fetch_logs)

@router.get("/errors", dependencies=[Depends(require_owner_auth)])
async def get_error_logs(category: str = Query("all", pattern="^(all|whatsapp|ai|system)$"), limit: int = 50):
    """Retrieve system error logs from logs table."""
    def _fetch_errors():
        supabase = get_supabase()
        query = supabase.table("logs").select("*").in_("level", ["error", "warning"])

        if category != "all":
            query = query.eq("category", category)

        res = query.order("created_at", desc=True).limit(limit).execute()
        return res.data or []

    return await asyncio.to_thread(_fetch_errors)

@router.delete("/errors", dependencies=[Depends(require_owner_auth)])
async def clear_error_logs():
    """Clears system error logs from the logs table."""
    def _delete_errors():
        supabase = get_supabase()
        res = supabase.table("logs").delete().in_("level", ["error", "warning"]).execute()
        return res.data or []

    deleted = await asyncio.to_thread(_delete_errors)
    record_log(
        category="system",
        level="info",
        message="Error logs cleared by owner"
    )
    return {"success": True, "cleared_count": len(deleted)}
