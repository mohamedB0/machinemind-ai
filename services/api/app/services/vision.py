"""
Vision Service — describes figure-heavy manual pages via a cloud vision LLM.

Multi-provider with automatic fallback:
  - groq       (uses GROQ_API_KEY + GROQ_VISION_MODEL)
  - gemini     (uses GEMINI_API_KEY + GEMINI_VISION_MODEL, Gemini has a free tier)
  - openrouter (uses OPENROUTER_API_KEY + OPENROUTER_VISION_MODEL)

Selection:
  - VISION_PROVIDER=auto (default): first provider with credentials available;
    a provider that errors or is unsupported for this account is parked for the
    rest of the process.
  - VISION_PROVIDER=groq|gemini|openrouter|none: forced.

All failure paths return None — baking OCR fallback is handled by figures.py.
"""
import base64
import logging
from pathlib import Path

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

FIGURE_PROMPT = """This is a page from a technical machine manual (drive/inverter or similar).
Describe the visual content so it can be indexed by a text search engine:
1. State what kind of visual it is: terminal/wiring diagram, flowchart, wiring schematic, parts diagram, control panel photo, chart.
2. Transcribe legible labels exactly: terminal numbers, parameter codes, signal names, fault codes, axis labels, table titles.
3. Describe connections and flows: which terminal connects to what, decision branches in flowcharts.
4. One sentence on what a technician should use this page for (e.g. wiring the braking resistor, troubleshooting FAN fault, setting the digital inputs).
If text is illegible, say so instead of guessing. Plain text only, max 150 words."""


def _available_providers() -> list[str]:
    """Providers with all credentials required, in auto-fallback priority order."""
    forced = settings.VISION_PROVIDER.strip().lower()
    if forced == "none":
        return []
    if forced in ("groq", "gemini", "openrouter"):
        return [forced]
    order, have = [], settings
    if have.GROQ_API_KEY:
        order.append("groq")
    if have.GEMINI_API_KEY:
        order.append("gemini")
    if have.OPENROUTER_API_KEY:
        order.append("openrouter")
    return order


# Providers parked for the whole process after a permanent error (model not on
# the account / 401). Cooldown prevents retrying a doomed provider every page.
_disabled_providers: set[str] = set()


def _park(provider: str, reason: str) -> None:
    if provider not in _disabled_providers:
        logger.warning("Vision provider '%s' disabled for this process: %s", provider, reason)
    _disabled_providers.add(provider)


def providers() -> list[str]:
    """Usable vision providers right now (credentials present and not parked)."""
    return [p for p in _available_providers() if p not in _disabled_providers]


async def _groq(png_path: Path, prompt: str) -> str | None:
    from groq import AsyncGroq, NotFoundError, AuthenticationError
    b64 = base64.b64encode(png_path.read_bytes()).decode("ascii")
    data_url = f"data:image/png;base64,{b64}"
    try:
        client = AsyncGroq(api_key=settings.GROQ_API_KEY, timeout=settings.VISION_TIMEOUT_SECONDS)
        resp = await client.chat.completions.create(
            model=settings.GROQ_VISION_MODEL,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": data_url}},
                    {"type": "text", "text": prompt},
                ],
            }],
            temperature=0.2,
            max_tokens=400,
        )
        return (resp.choices[0].message.content or "").strip() or None
    except NotFoundError:
        _park("groq", f"model '{settings.GROQ_VISION_MODEL}' not available on this account")
        return None
    except AuthenticationError:
        _park("groq", "API key rejected (401)")
        return None
    except Exception:
        logger.exception("Groq vision call failed for %s", png_path.name)
        return None


async def _gemini(png_path: Path, prompt: str) -> str | None:
    model = settings.GEMINI_VISION_MODEL
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent"
    )
    b64 = base64.b64encode(png_path.read_bytes()).decode("ascii")
    payload = {
        "contents": [{
            "parts": [
                {"inline_data": {"mime_type": "image/png", "data": b64}},
                {"text": prompt},
            ]
        }],
        # Thinking budgets eat the output budget on gemini-3.x — keep them off
        # and give the response room; fallback below drops thinkingConfig when a
        # model/endpoint rejects it (400).
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 1500,
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }
    try:
        async with httpx.AsyncClient(
            timeout=settings.VISION_TIMEOUT_SECONDS,
            params={"key": settings.GEMINI_API_KEY},
        ) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 400 and "thinking" in resp.text.lower():
                payload["generationConfig"].pop("thinkingConfig", None)
                resp = await client.post(url, json=payload)
    except Exception:
        logger.exception("Gemini request failed for %s", png_path.name)
        return None
    if resp.status_code in (401, 403):
        _park("gemini", f"HTTP {resp.status_code} — check GEMINI_API_KEY")
        return None
    if resp.status_code == 404:
        _park("gemini", f"model '{model}' not available for this key")
        return None
    if resp.status_code != 200:
        logger.error("Gemini vision failed (HTTP %s): %s", resp.status_code, resp.text[:300])
        return None
    try:
        candidates = resp.json().get("candidates", [])
        parts = candidates[0].get("content", {}).get("parts", [])
        text = "".join(p.get("text", "") for p in parts).strip()
        return text or None
    except Exception:
        logger.exception("Gemini response could not be parsed")
        return None


async def _openrouter(png_path: Path, prompt: str) -> str | None:
    model = settings.OPENROUTER_VISION_MODEL
    b64 = base64.b64encode(png_path.read_bytes()).decode("ascii")
    data_url = f"data:image/png;base64,{b64}"
    try:
        async with httpx.AsyncClient(timeout=settings.VISION_TIMEOUT_SECONDS) as client:
            resp = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": [{
                        "role": "user",
                        "content": [
                            {"type": "image_url", "image_url": {"url": data_url}},
                            {"type": "text", "text": prompt},
                        ],
                    }],
                    "temperature": 0.2,
                    "max_tokens": 400,
                },
            )
    except Exception:
        logger.exception("OpenRouter request failed for %s", png_path.name)
        return None
    if resp.status_code in (401, 403):
        _park("openrouter", f"HTTP {resp.status_code} — check OPENROUTER_API_KEY")
        return None
    if resp.status_code == 404:
        _park("openrouter", f"model '{model}' not found — check OPENROUTER_VISION_MODEL")
        return None
    if resp.status_code != 200:
        logger.error("OpenRouter vision failed (HTTP %s): %s", resp.status_code, resp.text[:300])
        return None
    try:
        content = resp.json()["choices"][0]["message"]["content"]
        return (content or "").strip() or None
    except Exception:
        logger.exception("OpenRouter response could not be parsed")
        return None


_HANDLERS = {"groq": _groq, "gemini": _gemini, "openrouter": _openrouter}


async def describe_figure(png_path: str | Path) -> tuple[str, str] | None:
    """
    Describe a figure page via the first working vision provider.
    Returns (description, provider_name) or None when no provider answers.
    """
    png = Path(png_path)
    if not providers():
        return None
    try:
        png.read_bytes()
    except Exception:
        logger.exception("Cannot read page image %s", png)
        return None
    for provider in providers():
        text = await _HANDLERS[provider](png, FIGURE_PROMPT)
        if text:
            return text, provider
    return None
