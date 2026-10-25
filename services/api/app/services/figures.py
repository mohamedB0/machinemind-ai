"""
Figure page orchestrator — vision cloud (semantic description) with local OCR
fallback (exact labels). Guarantees figure pages yield *something* searchable
even without any cloud provider: as long as Tesseract is installed.
"""
import logging
from pathlib import Path
from typing import Optional, TypedDict

from app.services import ocr, vision

logger = logging.getLogger(__name__)


class PageDescription(TypedDict):
    text: str
    source: str  # "vision:groq" | "vision:gemini" | "vision:openrouter" | "ocr"


async def describe_page(png_path: str | Path) -> Optional[PageDescription]:
    """Return {text, source} for a rendered manual page, or None."""
    png = Path(png_path)
    if not png.exists():
        logger.debug("Page image %s missing — no description", png)
        return None

    # 1. Cloud vision: semantic description (kind of diagram, connections, purpose)
    vision_result = await vision.describe_figure(png)
    if vision_result:
        description, provider = vision_result
        return {"text": description, "source": f"vision:{provider}"}

    # 2. Local OCR: transcribes the labels already visible in the schematic
    if ocr.tesseract_available():
        text = ocr.ocr_png(png)
        if text:
            return {"text": text, "source": "ocr"}

    return None
