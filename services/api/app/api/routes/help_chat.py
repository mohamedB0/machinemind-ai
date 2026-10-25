"""
Guide chatbot — explains what MachineMind AI does and how to use it.

This is a lightweight, PUBLIC (no auth) product assistant: it answers
questions about the app itself (workflow, features, how answers are
verified). It does NOT touch the database and does not answer machine
questions (that is the authenticated RAG chat).

Rate limited per IP to keep the Groq budget sane.
"""
import time
from collections import defaultdict, deque

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.config import get_settings

settings = get_settings()

router = APIRouter(prefix="/api/help", tags=["help"])


HELP_SYSTEM_PROMPT = """You are the MachineMind Guide, a friendly onboarding assistant.

You ONLY explain what the MachineMind AI application is and how to use it.
You do NOT answer technical questions about the user's machines — for those,
 tell the user to upload their manual and use the chat on a machine page.

WHAT MACHINEMIND AI DOES:
- A technician uploads the PDF manual of an industrial machine (drive,
  inverter, etc.) after creating an account and a "machine" entry.
- The app then answers questions about THAT machine in natural language,
  and every answer cites the exact manual page (and section table) it came
  from, as [Page N — Section]. Answers also carry a confidence level
  (high / partial / none).
- The PDF is processed in the background: text per page, tables converted
  to Markdown, scanned pages handled with OCR, figure-heavy pages (wiring
  diagrams, schematics, photos) described by a vision AI model.
- A "sources" panel under each answer shows the cited pages — clickable,
  rendered as the original PDF page image.

HOW TO USE IT (workflow):
1. Register / login (top right).
2. Dashboard → "New machine" → fill name, manufacturer, model.
3. On the machine page → upload the PDF manual.
4. Wait for the manual status chip to turn "completed" (in background).
5. Click "New conversation" (or open the chat on the machine) and ask
   questions in plain language, e.g. "How do I reset the P037 fault?".
6. Each answer shows its sources (manual pages) and confidence.

KEY FACTS:
- Works in French and English. The AI only answers from the manual —
  it is designed to say "this info is not in the manual" rather than invent.
- Manual upload: PDF only, max 50 MB, ~500 pages. Dedup via file hash.
- The technical-question chat on machine pages requires login; this
  Guide chatbot works without an account.

STYLE: concise (under 120 words), warm, practical, plain language.
If the question is off-topic (not about MachineMind itself), briefly say
you only explain the app and redirect to the machine chat. You may answer
in the user's language (French or English)."""


_MAX_PER_MINUTE = 15
_hits: dict[str, deque] = defaultdict(lambda: deque(maxlen=_MAX_PER_MINUTE))
_window_seconds = 60.0


class HelpMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str = Field(..., min_length=1, max_length=4000)


class HelpChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000)
    history: list[HelpMessage] = Field(default_factory=list, max_length=20)


class HelpChatResponse(BaseModel):
    answer: str


def _rate_limited(ip: str) -> None:
    now = time.monotonic()
    hits = _hits[ip]
    while hits and now - hits[0] > _window_seconds:
        hits.popleft()
    hits.append(now)
    if len(hits) >= _MAX_PER_MINUTE:
        raise HTTPException(429, "Too many questions — try again in a minute.")


@router.post("/chat", response_model=HelpChatResponse)
async def help_chat(data: HelpChatRequest, request: Request):
    ip = request.client.host if request.client else "anonymous"
    _rate_limited(ip)

    from groq import Groq

    messages: list[dict] = [{"role": "system", "content": HELP_SYSTEM_PROMPT}]
    # history limited to last 10 turns to keep the context compact
    for msg in data.history[-10:]:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": data.question})

    try:
        client = Groq(api_key=settings.GROQ_API_KEY, timeout=30)
        response = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=messages,
            temperature=0.3,
            max_tokens=1200,
        )
        answer = (response.choices[0].message.content or "").strip()
    except Exception:
        raise HTTPException(502, "Guide is unavailable right now — try again shortly.")

    if not answer:
        raise HTTPException(502, "Guide returned an empty answer — try again.")
    return HelpChatResponse(answer=answer)
