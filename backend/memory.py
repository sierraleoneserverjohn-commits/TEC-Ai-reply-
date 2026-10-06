"""
Memory and Contact Learning Module.
Analyzes conversations every 5 incoming messages to extract and update
behavioral profiles (writing style, topics, language, relationship nuances).
Robustly extracts clean JSON even if the model outputs markdown code blocks or commentary.
"""

import json
import re
import asyncio
import logging
from typing import Dict, Any, Optional
from google import genai
from config import GEMINI_API_KEY, GEMINI_MODEL
from db import async_get_recent_messages, get_supabase
from logger import record_log

logger = logging.getLogger("johnny_reply.memory")

LEARNING_PROMPT_TEMPLATE = """
You are an expert behavioral analyst helping Johnny understand his WhatsApp contacts.
Analyze the following conversation history and existing profile for this contact.
Generate an updated profile strictly as a valid JSON object.

Existing Learned Profile:
{existing_profile_json}

Recent Conversation History:
{conversation_history}

Output ONLY a JSON object with this exact schema (no markdown, no backticks, no explanatory text):
{{
  "relationship_guess": "e.g. Mother, Brother, Work Client, Close Friend, College Buddy",
  "confidence": "high" | "medium" | "low",
  "writing_style": "How this person writes (e.g. short texts, lots of emojis, formal, casual, voice notes)",
  "detected_language": "Primary language and dialect used",
  "usual_topics": ["topic 1", "topic 2", "topic 3"],
  "reply_preference": "How Johnny should reply to make them comfortable (e.g. warm, respectful, concise, banter)",
  "summary": "1-2 sentence overview of this person and relationship"
}}
"""

def clean_json_response(raw_text: str) -> str:
    """Extracts valid JSON substring from model output, stripping markdown code fences."""
    cleaned = raw_text.strip()
    
    # Check for markdown code fences
    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned)
    if fence_match:
        cleaned = fence_match.group(1).strip()

    # Extract outermost JSON object if surrounded by preamble or postscript
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        cleaned = cleaned[start:end+1]

    return cleaned.strip()

def _sync_generate_memory(prompt: str) -> str:
    client = genai.Client(api_key=GEMINI_API_KEY)
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
    )
    return (response.text or "").strip()

async def analyze_and_update_memory(contact: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Checks if contact has received >= 5 inbound messages since last update.
    If so, calls Gemini to refine the learned profile and resets counter.
    """
    counter = contact.get("inbound_since_profile_update", 0)
    contact_id = contact.get("id")
    if not contact_id:
        return None

    if counter < 5:
        return None

    logger.info(f"Triggering memory learning for contact +{contact.get('wa_id')} (inbound count: {counter})")
    
    recent_msgs = await async_get_recent_messages(contact_id, limit=25)
    if not recent_msgs:
        return None

    existing_profile = contact.get("learned_profile") or {}
    
    history_lines = []
    name = contact.get("display_name") or "Sender"
    for m in recent_msgs:
        sender_lbl = name if m.get("sender") == "contact" else "Johnny"
        history_lines.append(f"{sender_lbl}: {m.get('body', '')}")
    history_text = "\n".join(history_lines)

    prompt = LEARNING_PROMPT_TEMPLATE.format(
        existing_profile_json=json.dumps(existing_profile, indent=2),
        conversation_history=history_text
    )

    for attempt in range(2):
        try:
            curr_prompt = prompt if attempt == 0 else f"{prompt}\n\nCRITICAL: Return PURE JSON only."
            raw = await asyncio.to_thread(_sync_generate_memory, curr_prompt)
            parsed = json.loads(clean_json_response(raw))
            
            supabase = get_supabase()
            def _save():
                supabase.table("contacts").update({
                    "learned_profile": parsed,
                    "inbound_since_profile_update": 0
                }).eq("id", contact_id).execute()
            await asyncio.to_thread(_save)

            record_log(
                category="ai",
                level="info",
                message=f"Synthesized learned memory for contact +{contact.get('wa_id')}",
                meta={"contact_id": contact_id, "summary": parsed.get("summary")}
            )
            return parsed
        except Exception as e:
            logger.warning(f"Memory analysis attempt {attempt + 1} failed for contact {contact_id}: {e}")

    record_log(
        category="ai",
        level="warning",
        message=f"Memory learning failed after retries for contact {contact_id}"
    )
    return None
