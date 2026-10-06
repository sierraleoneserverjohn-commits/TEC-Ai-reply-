"""
Database access module using Supabase Python SDK.
Synchronous supabase-py operations are wrapped with asyncio.to_thread
so the FastAPI event loop is never blocked.
"""

import asyncio
import logging
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY, normalize_phone_number

logger = logging.getLogger("johnny_reply.db")

_supabase_client: Optional[Client] = None

def get_supabase() -> Client:
    """Singleton getter for Supabase client."""
    global _supabase_client
    if _supabase_client is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            logger.warning("SUPABASE_URL or SUPABASE_SERVICE_KEY is missing!")
            raise RuntimeError("Supabase credentials not configured in environment.")
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _supabase_client

def check_db_health() -> bool:
    """Quick database ping for /health endpoint. Fast, zero AI calls."""
    try:
        client = get_supabase()
        res = client.table("settings").select("key").limit(1).execute()
        return res is not None
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return False

# ==============================================================================
# Settings Operations (Sync + Async Threadpool Wrappers)
# ==============================================================================

def _sync_get_setting(key: str, default: Any = None) -> Any:
    try:
        client = get_supabase()
        res = client.table("settings").select("value").eq("key", key).limit(1).execute()
        if res.data and len(res.data) > 0:
            return res.data[0].get("value")
        return default
    except Exception as e:
        logger.error(f"Error fetching setting {key}: {e}")
        return default

async def async_get_setting(key: str, default: Any = None) -> Any:
    return await asyncio.to_thread(_sync_get_setting, key, default)

def _sync_set_setting(key: str, value: Any) -> bool:
    try:
        client = get_supabase()
        client.table("settings").upsert({
            "key": key,
            "value": value,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }).execute()
        return True
    except Exception as e:
        logger.error(f"Error saving setting {key}: {e}")
        return False

async def async_set_setting(key: str, value: Any) -> bool:
    return await asyncio.to_thread(_sync_set_setting, key, value)

# Backward compatible sync aliases used by brain.py / config initialization
get_setting = _sync_get_setting
set_setting = _sync_set_setting

# ==============================================================================
# Contacts Operations
# ==============================================================================

def _sync_upsert_contact_from_inbound(
    wa_id: str,
    profile_name: Optional[str] = None,
    phone_number_id: Optional[str] = None
) -> Dict[str, Any]:
    clean_wa_id = normalize_phone_number(wa_id)
    client = get_supabase()
    res = client.table("contacts").select("*").eq("wa_id", clean_wa_id).limit(1).execute()
    now_iso = datetime.now(timezone.utc).isoformat()

    if res.data and len(res.data) > 0:
        contact = res.data[0]
        new_count = contact.get("inbound_since_profile_update", 0) + 1
        update_data = {
            "last_inbound_at": now_iso,
            "inbound_since_profile_update": new_count
        }
        if phone_number_id and not contact.get("phone_number_id"):
            update_data["phone_number_id"] = phone_number_id
        if not contact.get("display_name") and profile_name:
            update_data["display_name"] = profile_name

        up_res = client.table("contacts").update(update_data).eq("id", contact["id"]).execute()
        return up_res.data[0] if up_res.data else contact
    else:
        new_contact_data = {
            "wa_id": clean_wa_id,
            "phone_number_id": phone_number_id,
            "display_name": profile_name or f"+{clean_wa_id}",
            "mode": "ask",
            "archived": False,
            "human_takeover": False,
            "inbound_since_profile_update": 1,
            "last_inbound_at": now_iso,
            "learned_profile": {}
        }
        ins_res = client.table("contacts").insert(new_contact_data).execute()
        return ins_res.data[0]

async def async_upsert_contact_from_inbound(
    wa_id: str,
    profile_name: Optional[str] = None,
    phone_number_id: Optional[str] = None
) -> Dict[str, Any]:
    return await asyncio.to_thread(_sync_upsert_contact_from_inbound, wa_id, profile_name, phone_number_id)

upsert_contact_from_inbound = _sync_upsert_contact_from_inbound

def _sync_get_contact(contact_id: str) -> Optional[Dict[str, Any]]:
    try:
        client = get_supabase()
        res = client.table("contacts").select("*").eq("id", contact_id).limit(1).execute()
        if res.data and len(res.data) > 0:
            return res.data[0]
        return None
    except Exception as e:
        logger.error(f"Error fetching contact {contact_id}: {e}")
        return None

async def async_get_contact(contact_id: str) -> Optional[Dict[str, Any]]:
    return await asyncio.to_thread(_sync_get_contact, contact_id)

get_contact = _sync_get_contact

def _sync_update_contact(contact_id: str, fields: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    try:
        client = get_supabase()
        res = client.table("contacts").update(fields).eq("id", contact_id).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        logger.error(f"Error updating contact {contact_id}: {e}")
        return None

async def async_update_contact(contact_id: str, fields: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    return await asyncio.to_thread(_sync_update_contact, contact_id, fields)

update_contact = _sync_update_contact

# ==============================================================================
# Messages Operations
# ==============================================================================

def _sync_message_exists(wa_message_id: str) -> bool:
    if not wa_message_id:
        return False
    try:
        client = get_supabase()
        res = client.table("messages").select("id").eq("wa_message_id", wa_message_id).limit(1).execute()
        return bool(res.data and len(res.data) > 0)
    except Exception as e:
        logger.error(f"Error checking message existence {wa_message_id}: {e}")
        return False

async def async_message_exists(wa_message_id: str) -> bool:
    return await asyncio.to_thread(_sync_message_exists, wa_message_id)

message_exists = _sync_message_exists

def _sync_create_message(
    contact_id: str,
    direction: str,
    sender: str,
    body: str,
    status: str,
    wa_message_id: Optional[str] = None,
    phone_number_id: Optional[str] = None,
    ai_draft: Optional[str] = None,
    error: Optional[str] = None,
    tokens_used: int = 0,
    latency_ms: int = 0
) -> Optional[Dict[str, Any]]:
    try:
        client = get_supabase()
        payload = {
            "contact_id": contact_id,
            "direction": direction,
            "sender": sender,
            "body": body,
            "status": status,
            "wa_message_id": wa_message_id,
            "phone_number_id": phone_number_id,
            "ai_draft": ai_draft,
            "error": error,
            "tokens_used": tokens_used,
            "latency_ms": latency_ms
        }
        res = client.table("messages").insert(payload).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        logger.error(f"Error inserting message: {e}")
        return None

async def async_create_message(
    contact_id: str,
    direction: str,
    sender: str,
    body: str,
    status: str,
    wa_message_id: Optional[str] = None,
    phone_number_id: Optional[str] = None,
    ai_draft: Optional[str] = None,
    error: Optional[str] = None,
    tokens_used: int = 0,
    latency_ms: int = 0
) -> Optional[Dict[str, Any]]:
    return await asyncio.to_thread(
        _sync_create_message,
        contact_id, direction, sender, body, status,
        wa_message_id, phone_number_id, ai_draft, error, tokens_used, latency_ms
    )

create_message = _sync_create_message

def _sync_update_message(message_id: str, fields: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    try:
        client = get_supabase()
        res = client.table("messages").update(fields).eq("id", message_id).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        logger.error(f"Error updating message {message_id}: {e}")
        return None

async def async_update_message(message_id: str, fields: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    return await asyncio.to_thread(_sync_update_message, message_id, fields)

update_message = _sync_update_message

def _sync_get_recent_messages(contact_id: str, limit: int = 20) -> List[Dict[str, Any]]:
    try:
        client = get_supabase()
        res = client.table("messages") \
            .select("*") \
            .eq("contact_id", contact_id) \
            .order("created_at", desc=True) \
            .limit(limit) \
            .execute()
        messages = res.data or []
        messages.reverse()
        return messages
    except Exception as e:
        logger.error(f"Error fetching recent messages for contact {contact_id}: {e}")
        return []

async def async_get_recent_messages(contact_id: str, limit: int = 20) -> List[Dict[str, Any]]:
    return await asyncio.to_thread(_sync_get_recent_messages, contact_id, limit)

get_recent_messages = _sync_get_recent_messages
