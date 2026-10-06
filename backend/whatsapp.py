"""
WhatsApp Cloud API client module.
Handles sending messages, shared httpx.AsyncClient with connection pooling,
error code classification, exponential backoff retries on transient network errors,
Meta 24-hour window enforcement, and multiple business phone numbers.
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Tuple, Optional
import httpx
from config import (
    WA_TOKEN,
    WA_PHONE_NUMBER_ID,
    WA_API_VERSION,
    DRY_RUN,
    normalize_phone_number
)
from db import get_supabase
from logger import record_log

logger = logging.getLogger("johnny_reply.whatsapp")

# Shared singleton AsyncClient for persistent HTTP connection pooling
_http_client: Optional[httpx.AsyncClient] = None

def get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(timeout=15.0)
    return _http_client

async def close_http_client() -> None:
    global _http_client
    if _http_client and not _http_client.is_closed:
        await _http_client.aclose()
        _http_client = None

class WhatsAppError(Exception):
    def __init__(self, message: str, code: Optional[str] = None):
        super().__init__(message)
        self.code = code

META_ERROR_DESCRIPTIONS = {
    "131031": "Account Locked: Business account has been locked or payment method failed.",
    "131047": "Outside 24h Window: More than 24 hours elapsed since customer's last message.",
    "131056": "Rate Limit Exceeded: Hit Meta Cloud API messaging tier limit.",
    "130429": "Rate Limit Hit: Too many requests sent in short interval.",
    "190": "Access Token Expired: System User token is invalid or expired."
}

async def is_within_24h_window(contact_wa_id: str) -> Tuple[bool, Optional[str]]:
    """
    Meta Cloud API policy: Freeform messages can only be sent within 24 hours
    of the customer's last inbound message.
    """
    try:
        clean_id = normalize_phone_number(contact_wa_id)
        client = get_supabase()
        
        def _query():
            return client.table("contacts").select("last_inbound_at").eq("wa_id", clean_id).limit(1).execute()
        
        res = await asyncio.to_thread(_query)

        if not res.data or len(res.data) == 0:
            return False, "contact_not_found"
        
        last_inbound_str = res.data[0].get("last_inbound_at")
        if not last_inbound_str:
            return False, "outside_24h_window"

        last_inbound = datetime.fromisoformat(last_inbound_str.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        
        if now - last_inbound > timedelta(hours=24):
            return False, "outside_24h_window"
            
        return True, None
    except Exception as e:
        logger.error(f"Error checking 24h window for {contact_wa_id}: {e}")
        # Default to allowing in case of transient DB check error
        return True, None

async def send_text(wa_id: str, text: str, phone_number_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Send a plain text message to a WhatsApp user via Cloud API.
    Payload: {"messaging_product":"whatsapp","to":"<wa_id>","type":"text","text":{"body":"..."}}
    Includes automatic retry with exponential backoff on network failures.
    """
    clean_wa_id = normalize_phone_number(wa_id)
    sender_phone_id = phone_number_id or WA_PHONE_NUMBER_ID

    # 1. Enforce 24-hour customer care window
    allowed, reason = await is_within_24h_window(clean_wa_id)
    if not allowed:
        record_log(
            category="whatsapp",
            level="warning",
            message=f"Blocked outgoing message to +{clean_wa_id}: outside 24h window ({reason})",
            meta={"wa_id": clean_wa_id, "reason": reason, "error_code": "131047"}
        )
        raise WhatsAppError(f"Cannot send message outside 24h window ({reason})", code="131047")

    # 2. DRY_RUN mode handling
    if DRY_RUN:
        mock_msg_id = f"mock_wamid_{int(datetime.now(timezone.utc).timestamp())}_{clean_wa_id[-4:]}"
        logger.info(f"[DRY_RUN] Sent WhatsApp text to +{clean_wa_id} from phone_id {sender_phone_id}: {text}")
        record_log(
            category="whatsapp",
            level="info",
            message=f"[DRY_RUN] Sent text to +{clean_wa_id}",
            meta={"wa_id": clean_wa_id, "dry_run": True, "wamid": mock_msg_id, "phone_number_id": sender_phone_id}
        )
        return {
            "success": True,
            "dry_run": True,
            "wa_message_id": mock_msg_id,
            "recipient": clean_wa_id,
            "phone_number_id": sender_phone_id,
            "body": text
        }

    if not WA_TOKEN or not sender_phone_id:
        err = "Missing WA_TOKEN or WA_PHONE_NUMBER_ID in environment"
        record_log(category="whatsapp", level="error", message=err)
        raise WhatsAppError(err, code="config_missing")

    url = f"https://graph.facebook.com/{WA_API_VERSION}/{sender_phone_id}/messages"
    headers = {
        "Authorization": f"Bearer {WA_TOKEN}",
        "Content-Type": "application/json"
    }

    # Meta required payload format exactly as specified
    payload = {
        "messaging_product": "whatsapp",
        "to": clean_wa_id,
        "type": "text",
        "text": {
            "body": text
        }
    }

    client = get_http_client()
    max_retries = 3
    last_exception = None

    for attempt in range(1, max_retries + 1):
        try:
            response = await client.post(url, headers=headers, json=payload)
            data = response.json()
            
            if response.status_code >= 400:
                err_info = data.get("error", {})
                err_code = str(err_info.get("code", response.status_code))
                raw_err_msg = err_info.get("message", response.text)
                
                # Map known Meta Cloud API error codes
                human_desc = META_ERROR_DESCRIPTIONS.get(err_code, raw_err_msg)
                
                record_log(
                    category="whatsapp",
                    level="error",
                    message=f"Meta API send failure ({err_code}): {human_desc}",
                    meta={"wa_id": clean_wa_id, "code": err_code, "detail": raw_err_msg, "phone_number_id": sender_phone_id}
                )
                raise WhatsAppError(f"{human_desc} ({err_code})", code=err_code)

            wa_msg_id = data.get("messages", [{}])[0].get("id")
            record_log(
                category="whatsapp",
                level="info",
                message=f"Message delivered to Meta Cloud API for +{clean_wa_id}",
                meta={"wa_id": clean_wa_id, "wamid": wa_msg_id, "phone_number_id": sender_phone_id}
            )
            return {
                "success": True,
                "dry_run": False,
                "wa_message_id": wa_msg_id,
                "phone_number_id": sender_phone_id,
                "raw": data
            }

        except httpx.RequestError as e:
            last_exception = e
            logger.warning(f"Network error calling WhatsApp API (attempt {attempt}/{max_retries}): {e}")
            if attempt < max_retries:
                backoff_sec = 2 ** (attempt - 1) # 1s, 2s
                await asyncio.sleep(backoff_sec)
            else:
                record_log(
                    category="whatsapp",
                    level="error",
                    message=f"Network error after {max_retries} attempts calling WhatsApp API: {e}",
                    meta={"wa_id": clean_wa_id, "attempts": max_retries}
                )
                raise WhatsAppError(f"Network connection failed after retries: {str(e)}", code="network_error")

    raise WhatsAppError(f"WhatsApp sending failed: {str(last_exception)}", code="network_error")

async def get_connection_info() -> Dict[str, Any]:
    """
    Queries Meta Cloud API to check phone number status, display number,
    and verified name for the Connection screen.
    """
    if DRY_RUN:
        return {
            "connected": True,
            "dry_run": True,
            "phone_number_id": WA_PHONE_NUMBER_ID or "123456789012345",
            "display_phone_number": "+1 (555) 019-2831",
            "verified_name": "Johnny TEC Business (Dry Run)",
            "quality_rating": "GREEN",
            "code_verification_status": "VERIFIED"
        }

    if not WA_TOKEN or not WA_PHONE_NUMBER_ID:
        return {
            "connected": False,
            "dry_run": False,
            "error": "WA_TOKEN or WA_PHONE_NUMBER_ID is not configured"
        }

    url = f"https://graph.facebook.com/{WA_API_VERSION}/{WA_PHONE_NUMBER_ID}"
    headers = {"Authorization": f"Bearer {WA_TOKEN}"}
    client = get_http_client()

    try:
        res = await client.get(url, headers=headers)
        if res.status_code == 200:
            data = res.json()
            return {
                "connected": True,
                "dry_run": False,
                "phone_number_id": WA_PHONE_NUMBER_ID,
                "display_phone_number": data.get("display_phone_number", WA_PHONE_NUMBER_ID),
                "verified_name": data.get("verified_name", "Verified Business"),
                "quality_rating": data.get("quality_rating", "GREEN"),
                "code_verification_status": data.get("code_verification_status", "VERIFIED")
            }
        else:
            return {
                "connected": False,
                "dry_run": False,
                "error": f"Meta API status {res.status_code}: {res.text}"
            }
    except Exception as e:
        return {
            "connected": False,
            "dry_run": False,
            "error": f"Connection check failed: {str(e)}"
        }
