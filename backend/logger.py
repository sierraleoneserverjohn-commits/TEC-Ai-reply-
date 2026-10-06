"""
Application Logger Module.
Persists structured event logs to the Supabase `logs` table
using non-blocking async execution and console logs.
"""

import asyncio
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from db import get_supabase

logger = logging.getLogger("johnny_reply.system")

def _sync_insert_log(payload: dict):
    try:
        supabase = get_supabase()
        supabase.table("logs").insert(payload).execute()
    except Exception as e:
        logger.warning(f"Could not write log entry to Supabase: {e}")

def record_log(
    category: str,
    level: str,
    message: str,
    meta: Optional[Dict[str, Any]] = None
) -> None:
    """
    Write a structured log row to Supabase and output to console.
    category: 'whatsapp' | 'ai' | 'system'
    level: 'info' | 'warning' | 'error'
    """
    if meta is None:
        meta = {}

    log_fn = {
        "info": logger.info,
        "warning": logger.warning,
        "error": logger.error
    }.get(level.lower(), logger.info)

    log_fn(f"[{category.upper()}] {message} | meta={meta}")

    payload = {
        "category": category,
        "level": level,
        "message": message,
        "meta": meta,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    try:
        loop = asyncio.get_running_loop()
        loop.create_task(asyncio.to_thread(_sync_insert_log, payload))
    except RuntimeError:
        # If outside active event loop (e.g. startup/shutdown), call sync
        _sync_insert_log(payload)
