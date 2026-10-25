"""
Local OCR fallback — Tesseract (via pytesseract).

Runs entirely on the machine: no API key, always available (in Docker the
binary is installed in the image). Used for:
1. Pages flagged needs_ocr (scanned PDFs) → searchable text chunks.
2. Figure pages when no vision provider is available → labels transcribed.

Fail-open: if Tesseract is missing or a page fails, callers get None and the
ingestion pipeline continues without the OCR chunks.
"""
import logging
import shutil
from pathlib import Path
from typing import Optional

import fitz
from pytesseract import TesseractNotFoundError, image_to_string

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_tesseract_checked = False
_tesseract_available = False

# Common Windows install locations when Tesseract is not on PATH
_WINDOWS_CANDIDATES = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
]


def _resolve_tesseract() -> Optional[str]:
    """Return a working tesseract executable path, or None."""
    # Explicit override wins
    cmd = settings.TESSERACT_CMD
    if cmd:
        if Path(cmd).exists():
            return cmd
        logger.warning("TESSERACT_CMD=%s does not exist — trying auto-discovery", cmd)

    on_path = shutil.which("tesseract")
    if on_path:
        return on_path

    for candidate in _WINDOWS_CANDIDATES:
        if Path(candidate).exists():
            # Register it for pytesseract (it only searches PATH)
            import pytesseract
            pytesseract.pytesseract.tesseract_cmd = candidate
            return candidate
    return None


def tesseract_available() -> bool:
    """True when the tesseract binary was found (checked once, cached)."""
    global _tesseract_checked, _tesseract_available
    if not _tesseract_checked:
        _tesseract_checked = True
        _tesseract_available = _resolve_tesseract() is not None
        if _tesseract_available:
            logger.info("OCR enabled (tesseract found)")
        else:
            logger.warning(
                "Tesseract binary not found — OCR fallback disabled "
                "(install tesseract or set TESSERACT_CMD)"
            )
    return _tesseract_available


def _clean(text: str) -> Optional[str]:
    """Strip OCR noise; keep meaningful runs only."""
    lines = [ln.strip() for ln in text.splitlines()]
    lines = [ln for ln in lines if ln]
    cleaned = "\n".join(lines).strip()
    if len(cleaned) < 10:  # blank / near-blank render
        return None
    return cleaned


def ocr_page_image(page: "fitz.Page", dpi: Optional[int] = None) -> Optional[str]:
    """Render one already-open PDF page at OCR DPI and transcribe it."""
    if not tesseract_available():
        return None
    try:
        pix = page.get_pixmap(dpi=dpi or settings.OCR_DPI)
        if pix.n != 3 or pix.alpha:  # normalise to plain RGB PNG for tesseract
            pix = fitz.Pixmap(fitz.csRGB, pix)
        import io
        buf = io.BytesIO(pix.tobytes("png"))
        text = image_to_string(buf, lang=settings.OCR_LANG)
        return _clean(text)
    except TesseractNotFoundError:
        logger.warning("Tesseract disappeared mid-run — OCR skipped for this page")
        return None
    except Exception:
        logger.exception("OCR failed on page — skipped")
        return None


def ocr_png(png_path: str | Path) -> Optional[str]:
    """Transcribe an existing rendered page PNG."""
    if not tesseract_available():
        return None
    try:
        from PIL import Image
        img = Image.open(png_path)
        text = image_to_string(img, lang=settings.OCR_LANG)
        return _clean(text)
    except TesseractNotFoundError:
        logger.warning("Tesseract disappeared mid-run — OCR skipped for this page")
        return None
    except Exception:
        logger.exception("OCR failed on image %s — skipped", png_path)
        return None


def ocr_pdf_page(file_path: str, page_number: int) -> Optional[str]:
    """OCR the 1-based page_number of a PDF file. Returns cleaned text or None."""
    try:
        doc = fitz.open(file_path)
    except Exception:
        logger.exception("Cannot open %s for OCR", file_path)
        return None
    try:
        if page_number < 1 or page_number > len(doc):
            return None
        return ocr_page_image(doc[page_number - 1])
    finally:
        doc.close()
