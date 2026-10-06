"""
Configuration module for Johnny TEC AI Reply.
Loads environment variables, validates required keys on boot, and provides utilities.
"""

import os
import re
import logging
from typing import List, Dict
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("johnny_reply.config")

# Google Gemini API
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip()

# Supabase (Postgres & Auth)
SUPABASE_URL: str = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "").strip()

# Owner Account Authorization (Supabase Auth email)
OWNER_EMAIL: str = os.getenv("OWNER_EMAIL", "").strip().lower()

# Meta WhatsApp Cloud API
WA_TOKEN: str = os.getenv("WA_TOKEN", "").strip()
WA_PHONE_NUMBER_ID: str = os.getenv("WA_PHONE_NUMBER_ID", "").strip()
WA_VERIFY_TOKEN: str = os.getenv("WA_VERIFY_TOKEN", "").strip()
WA_APP_SECRET: str = os.getenv("WA_APP_SECRET", "").strip()
WA_API_VERSION: str = os.getenv("WA_API_VERSION", "v21.0").strip()

# Security & CORS
ALLOWED_ORIGIN: str = os.getenv("ALLOWED_ORIGIN", "*").strip()

# Dry run mode: if True, simulate WhatsApp sending without invoking Meta API
_dry_run_raw: str = os.getenv("DRY_RUN", "true").strip().lower()
DRY_RUN: bool = _dry_run_raw in ("true", "1", "yes", "t")

def get_allowed_origins() -> List[str]:
    """Parse comma-separated origins or default to wildcard."""
    if not ALLOWED_ORIGIN or ALLOWED_ORIGIN == "*":
        return ["*"]
    # Ensure origin has no trailing slash or path as per CORS standard
    return [origin.strip().rstrip("/") for origin in ALLOWED_ORIGIN.split(",") if origin.strip()]

def normalize_phone_number(phone: str) -> str:
    """Normalize phone number to digits only (e.g. '+1 (555) 019-2831' -> '15550192831')."""
    if not phone:
        return ""
    return re.sub(r"\D", "", phone.strip())

def validate_environment_on_startup() -> Dict[str, bool]:
    """
    Checks that all required environment variables exist.
    Logs which are missing without leaking any secret values.
    Does not crash server so /health probe remains available.
    """
    checks = {
        "GEMINI_API_KEY": bool(GEMINI_API_KEY),
        "SUPABASE_URL": bool(SUPABASE_URL),
        "SUPABASE_SERVICE_KEY": bool(SUPABASE_SERVICE_KEY),
        "OWNER_EMAIL": bool(OWNER_EMAIL),
        "WA_TOKEN": bool(WA_TOKEN),
        "WA_PHONE_NUMBER_ID": bool(WA_PHONE_NUMBER_ID),
        "WA_VERIFY_TOKEN": bool(WA_VERIFY_TOKEN),
        "WA_APP_SECRET": bool(WA_APP_SECRET)
    }

    missing = [k for k, v in checks.items() if not v]
    if missing:
        logger.warning(f"Startup Config Warning: Missing required environment variables: {', '.join(missing)}")
        if DRY_RUN:
            logger.info("DRY_RUN is enabled. Simulation modes can function without Meta credentials.")
    else:
        logger.info("Startup Config: All primary environment variables configured.")

    return checks
