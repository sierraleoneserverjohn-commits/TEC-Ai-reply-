"""
================================================================================
JOHNNY TEC AI Reply - Main Application Server (FastAPI)
================================================================================
Provides:
- Webhook receiver for Meta WhatsApp Cloud API
- Authenticated Control Panel API for the WhatsApp-style PWA
- Background Recovery Worker for 100% reliable message delivery
- Lightweight /health endpoint for 5-minute Uptime Monitors
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware

from config import get_allowed_origins, validate_environment_on_startup
from db import check_db_health
from webhook import router as webhook_router
from api import router as api_router
from recovery import start_recovery_background_loop
from whatsapp import close_http_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("johnny_reply.main")

_recovery_task: asyncio.Task = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle: boots recovery worker on startup and cancels cleanly."""
    global _recovery_task
    logger.info("Starting JOHNNY TEC AI Reply backend...")
    
    # Audit env vars on startup (non-crashing)
    validate_environment_on_startup()

    # Start background recovery loop
    _recovery_task = asyncio.create_task(start_recovery_background_loop())
    
    yield
    
    # Shutdown sequence
    if _recovery_task:
        logger.info("Stopping recovery worker task...")
        _recovery_task.cancel()
        try:
            await _recovery_task
        except asyncio.CancelledError:
            pass

    # Clean up pooled HTTP client
    await close_http_client()
    logger.info("Backend shutdown complete.")

app = FastAPI(
    title="JOHNNY TEC AI Reply",
    description="WhatsApp AI Auto-Reply Bot powered by Google Gemini and Supabase",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
origins = get_allowed_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(webhook_router)
app.include_router(api_router)

@app.get("/health", tags=["Health"])
async def health_check(response: Response):
    """
    Ultra-lightweight health probe.
    Pinged every 5 minutes by UptimeRobot or Cron to keep Render server awake.
    Fast, zero AI calls. Validates database connectivity.
    """
    db_ok = check_db_health()
    if not db_ok:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {
            "status": "degraded",
            "database": "unreachable",
            "bot": "running"
        }
    return {
        "status": "ok",
        "database": "connected",
        "bot": "running"
    }

@app.get("/", tags=["Root"])
async def root():
    """Service status banner."""
    return {
        "service": "JOHNNY TEC AI Reply Backend",
        "status": "online",
        "docs": "/docs",
        "health": "/health"
    }
