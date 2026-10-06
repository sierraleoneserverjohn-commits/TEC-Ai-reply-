"""
================================================================================
Johnny TEC AI Reply - Brain Module (AI Instructions & Reply Generation)
================================================================================
THE GENERAL BRAIN LIVES ONLY IN THIS BACKEND CODE FILE.
There is NO system prompt editor in the frontend app.
Per-contact secret instructions are managed individually via contact.custom_instruction
and take HIGHEST PRIORITY during reply generation.
"""

import json
import time
import asyncio
import logging
import re
from typing import Dict, Any, List, Tuple
from google import genai
from config import GEMINI_API_KEY, GEMINI_MODEL
from db import get_setting

logger = logging.getLogger("johnny_reply.brain")

# ==============================================================================
# GENERAL_BRAIN_PROMPT (Core Persona & Universal Rules)
# ==============================================================================
GENERAL_BRAIN_PROMPT = """
You are the personal WhatsApp AI assistant replying on behalf of Johnny (the user).
Your goal is to write natural, concise, authentic WhatsApp replies that sound exactly like Johnny.

CORE UNIVERSAL RULES:
1. Short & Natural: WhatsApp messages are brief (1-3 sentences max). Never write long corporate paragraphs.
2. Multilingual & Dialect Adaptive: Always reply in the same language, dialect, or code-switching style as the sender. If the sender switches languages mid-sentence (e.g. Spanglish, Hinglish, Franglais), match their natural cadence.
3. Slang, Typos & Voice Note Transcripts: Understand modern informal messaging, acronyms, slang, typos, and raw voice-note transcriptions without correcting the sender or commenting on their grammar.
4. Emojis: Use emojis naturally and sparingly, matching the contact's tone (never over-emoji like a marketer).
5. Private & Factual: Never invent facts about Johnny, his schedule, or commitments. Never disclose private data (passwords, banking, addresses).
6. AI Disclosure: If asked directly if this is an AI, be honest and polite (e.g.: "Hey! This is Johnny's AI assistant helping him catch up on messages while he's busy. I'll pass this note to him!").
7. CRITICAL SAFETY GUARDRAILS:
   - If the message is about MONEY requests, bank transfers, crypto, wire fraud, medical emergencies, suicide/crisis, or legal disputes: DO NOT SEND A REGULAR REPLY.
   - Output strictly: [NEEDS_ATTENTION]
   - If you are genuinely uncertain how Johnny would decide, output: [NEEDS_ATTENTION]
"""

PERSONALITY_PRESETS = {
    "friendly_helpful": "Personality Style: Warm, welcoming, cheerful, friendly, and very helpful.",
    "professional": "Personality Style: Crisp, polite, business-oriented, composed, and well-structured.",
    "casual": "Personality Style: Relaxed, conversational, informal, easygoing, friendly banter.",
    "short_direct": "Personality Style: Extremely concise, to the point, minimal words, zero unnecessary filler."
}

def get_personality_instruction() -> str:
    """Fetch active global personality preset from settings."""
    preset_key = get_setting("default_personality", "friendly_helpful")
    return PERSONALITY_PRESETS.get(preset_key, PERSONALITY_PRESETS["friendly_helpful"])

def build_prompt(contact: Dict[str, Any], recent_messages: List[Dict[str, Any]]) -> str:
    """
    Combines in strict order:
    1. General brain prompt
    2. Global personality preset
    3. The AI-learned profile
    4. The contact's custom_instruction (HIGHEST PRIORITY)
    5. The last 20 messages
    6. The new message
    """
    name = contact.get("display_name") or contact.get("wa_id", "Unknown")
    phone = contact.get("wa_id", "Unknown")
    relationship = contact.get("relationship") or "Contact"
    lang_pref = contact.get("language") or "Sender's language"

    base = GENERAL_BRAIN_PROMPT.strip()
    personality = get_personality_instruction()

    learned_profile = contact.get("learned_profile") or {}
    learned_str = json.dumps(learned_profile, indent=2) if learned_profile else "No learned memory yet."

    custom_inst = (contact.get("custom_instruction") or "").strip()
    custom_section = f"""
*** HIGHEST PRIORITY PER-CONTACT INSTRUCTION ***
Follow this instruction above all else for {name}:
"{custom_inst}"
************************************************
""" if custom_inst else "No custom secret instruction set for this contact."

    history_lines = []
    for msg in recent_messages:
        sender = msg.get("sender", "contact")
        body = msg.get("body", "")
        if sender == "contact":
            speaker = f"Sender ({name})"
        elif sender == "ai":
            speaker = "Johnny [AI]"
        elif sender == "me":
            speaker = "Johnny [Manual]"
        else:
            speaker = "Unknown"
        history_lines.append(f"{speaker}: {body}")

    conversation_history = "\n".join(history_lines) if history_lines else "(No previous messages)"

    full_prompt = f"""
{base}

--- GLOBAL STYLE PRESET ---
{personality}

--- CONTACT PROFILE ---
Name: {name} (WhatsApp ID: +{phone})
Relationship: {relationship}
Language Preference: {lang_pref}

--- AI LEARNED CONTACT MEMORY ---
{learned_str}

{custom_section}

--- CONVERSATION HISTORY (UP TO LAST 20 MESSAGES) ---
{conversation_history}

--- YOUR TASK ---
Write Johnny's next reply to the last message received from {name}.
- Follow the HIGHEST PRIORITY custom instruction if present. It strictly overrides general style.
- Output ONLY the exact reply text to send via WhatsApp.
- Do NOT include quotes, Markdown headers, reasoning preamble, or surrounding quotes.
- If emergency, money transfer, legal threat, or severe ambiguity, output strictly: [NEEDS_ATTENTION]
"""
    return full_prompt.strip()

def _clean_draft_text(raw_text: str) -> str:
    """Strips quotes, markdown code fences, and extra whitespace from AI output."""
    cleaned = raw_text.strip()
    # Strip markdown code blocks if the model generated them
    if cleaned.startswith("```") and cleaned.endswith("```"):
        cleaned = re.sub(r"^```[a-zA-Z]*\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned)
        cleaned = cleaned.strip()

    # Strip surrounding quotes if wrapped
    if (cleaned.startswith('"') and cleaned.endswith('"')) or (cleaned.startswith("'") and cleaned.endswith("'")):
        if len(cleaned) >= 2:
            cleaned = cleaned[1:-1].strip()

    return cleaned

def _sync_call_gemini(prompt: str) -> Tuple[str, int]:
    client = genai.Client(api_key=GEMINI_API_KEY)
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
    )
    reply = (response.text or "").strip()
    tokens = 0
    if hasattr(response, "usage_metadata") and response.usage_metadata:
        tokens = (response.usage_metadata.prompt_token_count or 0) + (response.usage_metadata.candidates_token_count or 0)
    else:
        tokens = len(prompt.split()) + len(reply.split())
    return reply, tokens

async def generate_reply(contact: Dict[str, Any], recent_messages: List[Dict[str, Any]]) -> Tuple[str, bool, int, int]:
    """
    Calls Gemini API asynchronously via threadpool.
    Handles safety blocks, rate limits (429), model name errors, and timeouts.
    Returns: (reply_text, needs_attention, tokens_used, latency_ms)
    """
    if not GEMINI_API_KEY:
        logger.error("GEMINI_API_KEY is not configured!")
        return ("", True, 0, 0)

    prompt = build_prompt(contact, recent_messages)
    start_time = time.time()

    try:
        raw_reply, tokens_used = await asyncio.to_thread(_sync_call_gemini, prompt)
        latency_ms = int((time.time() - start_time) * 1000)

        if not raw_reply or "[NEEDS_ATTENTION]" in raw_reply:
            logger.info(f"AI flagged message for contact +{contact.get('wa_id')} as needs_attention.")
            return ("", True, tokens_used, latency_ms)

        clean_reply = _clean_draft_text(raw_reply)
        return (clean_reply, False, tokens_used, latency_ms)

    except Exception as e:
        latency_ms = int((time.time() - start_time) * 1000)
        err_str = str(e)
        if "429" in err_str or "quota" in err_str.lower() or "resource_exhausted" in err_str.lower():
            logger.error(f"Gemini API Quota/Rate Limit (429): {err_str}")
        elif "not_found" in err_str.lower() or "model" in err_str.lower():
            logger.error(f"Gemini Invalid Model Name error for '{GEMINI_MODEL}': {err_str}")
        else:
            logger.error(f"Gemini generation error: {err_str}")

        return ("", True, 0, latency_ms)
