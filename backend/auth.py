"""
Authentication and Authorization Module.
Validates incoming Supabase Auth JWT Bearer tokens and ensures
only the configured OWNER_EMAIL is permitted to access the control panel API.
"""

import asyncio
import logging
from typing import Optional
from fastapi import Header, HTTPException, status
from config import OWNER_EMAIL
from db import get_supabase

logger = logging.getLogger("johnny_reply.auth")

async def require_owner_auth(authorization: Optional[str] = Header(None)) -> dict:
    """
    FastAPI security dependency.
    Extracts Bearer token, validates against Supabase Auth API, and enforces OWNER_EMAIL.
    Returns 401 for missing/invalid token, 403 for incorrect user.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header. Expected 'Bearer <token>'"
        )

    token = authorization.split("Bearer ", 1)[1].strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Empty bearer token"
        )

    try:
        supabase = get_supabase()
        # Run synchronous auth check in threadpool
        user_response = await asyncio.to_thread(supabase.auth.get_user, token)
        user = user_response.user if user_response else None

        if not user or not user.email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired session token"
            )

        user_email = user.email.strip().lower()
        if OWNER_EMAIL and user_email != OWNER_EMAIL:
            logger.warning(f"Unauthorized access attempt by email: {user_email} (Expected: {OWNER_EMAIL})")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: This control panel is restricted to the account owner."
            )

        return {
            "id": user.id,
            "email": user.email
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Supabase auth validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}"
        )
