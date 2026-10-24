"""
Vision Service — describes figure-heavy manual pages via a Groq vision model
so they become searchable content_type="figure" chunks (QA plan, item 3 / Option A).
"""
import base64
import logging
from pathlib import Path

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()
_model_unavailable = False

FIGURE_PROMPT = """This is a page from a technical machine manual (drive/inverter or similar).
Describe the visual content so it can be indexed by a text search engine:
1. State what kind of visual it is: terminal/wiring diagram, flowchart, wiring schematic, parts diagram, control panel photo, chart.
2. Transcribe legible labels exactly: terminal numbers, parameter codes, signal names, fault codes, axis labels, table titles.
3. Describe connections and flows: which terminal connects to what, decision branches in flowcharts.
4. One sentence on what a technician should use this page for (e.g. wiring the braking resistor, troubleshooting FAN fault, setting the digital inputs).
If text is illegible, say so instead of guessing. Plain text only, max 150 words."""


async def describe_figure(png_path: str | Path) -> str | None:
    """Return a searchable text description of the figure page, or None if unavailable."""
    global _model_unavailable
    if _model_unavailable:
        return None
    if not settings.GROQ_API_KEY:
        logger.warning("GROQ_API_KEY not set — skipping figure description for %s", png_path)
        return None

    from groq import AsyncGroq, NotFoundError

    client = AsyncGroq(api_key=settings.GROQ_API_KEY)
    b64 = base64.b64encode(Path(png_path).read_bytes()).decode("ascii")
    data_url = f"data:image/png;base64,{b64}"

    try:
        resp = await client.chat.completions.create(
            model=settings.GROQ_VISION_MODEL,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": data_url}},
                    {"type": "text", "text": FIGURE_PROMPT},
                ],
            }],
            temperature=0.2,
            max_tokens=400,
        )
        description = (resp.choices[0].message.content or "").strip()
        return description or None
    except NotFoundError:
        _model_unavailable = True
        logger.error(
            "Vision model '%s' not available on this Groq account — "
            "figure descriptions disabled for this process (set GROQ_VISION_MODEL).",
            settings.GROQ_VISION_MODEL,
        )
        return None
    except Exception:
        logger.exception("Figure description failed for %s", png_path)
        return None
