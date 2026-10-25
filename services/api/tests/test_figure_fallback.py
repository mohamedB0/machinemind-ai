"""
Unit tests for the figure-page fallback chain (vision providers → local OCR).

Can run via pytest (pytest tests/) or directly: python tests/test_figure_fallback.py
"""
import asyncio
import sys
import tempfile
import uuid
from pathlib import Path

import fitz

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import groq as groq_sdk  # noqa: E402

from app.services import figures, ocr, vision, ingestion  # noqa: E402


def _png(tmp: Path, text: str = "Manual brake resistor wiring X45") -> Path:
    path = tmp / f"page_{abs(hash(text)) % 999:03d}.png"
    doc = fitz.open()
    page = doc.new_page(width=612, height=792)
    page.insert_text(fitz.Point(72, 72), text, fontsize=12)
    page.get_pixmap(dpi=150).save(str(path))
    doc.close()
    return path


def _fake_manual():
    class M:
        machine_id = uuid.UUID("0" * 32)
        version = "1.0"
        language = "en"
    return M()


# ── 1. vision result wins over OCR ────────────────────────────────────────────
def test_describe_page_prefers_vision():
    png = _png(Path(tempfile.mkdtemp()))
    saved = (vision.describe_figure, vision.providers, figures.ocr)

    async def fake_vision(path):
        return "Vision description of terminal diagram.", "gemini"

    vision.describe_figure = staticmethod(fake_vision)

    class FakeOcr:
        tesseract_available = staticmethod(lambda: True)
    figures.ocr = FakeOcr

    try:
        result = asyncio.run(figures.describe_page(png))
        assert result == {
            "text": "Vision description of terminal diagram.",
            "source": "vision:gemini",
        }
    finally:
        vision.describe_figure, vision.providers, figures.ocr = saved


# ── 2. vision empty → OCR fallback ────────────────────────────────────────────
def test_describe_page_falls_back_to_ocr():
    png = _png(Path(tempfile.mkdtemp()))
    saved = (vision.describe_figure, figures.ocr)

    async def fail_vision(path):
        return None
    vision.describe_figure = staticmethod(fail_vision)

    class FakeOcr:
        tesseract_available = staticmethod(lambda: True)
        ocr_png = staticmethod(lambda p: "  X45   BRAKE   RESISTOR  ")
    figures.ocr = FakeOcr

    try:
        result = asyncio.run(figures.describe_page(png))
        assert result["source"] == "ocr"
        assert "X45" in result["text"]
    finally:
        vision.describe_figure, figures.ocr = saved


# ── 3. everything fails → None (ingestion continues without figure chunks) ───
def test_describe_page_returns_none_when_everything_fails():
    png = _png(Path(tempfile.mkdtemp()))
    saved = (vision.providers, vision.describe_figure, figures.ocr)

    async def fail_vision(path):
        return None
    vision.describe_figure = staticmethod(fail_vision)

    class FakeOcr:
        tesseract_available = staticmethod(lambda: False)
    figures.ocr = FakeOcr

    try:
        result = asyncio.run(figures.describe_page(png))
        assert result is None
    finally:
        vision.providers, vision.describe_figure, figures.ocr = saved


# ── 4. a permanent vision error (404) parks the provider for the process ─────
def test_groq_parked_after_model_not_found():
    png = _png(Path(tempfile.mkdtemp()))
    saved_disabled = set(vision._disabled_providers)
    saved_async_groq = groq_sdk.AsyncGroq

    from groq import NotFoundError

    import httpx

    class FakeCompletions:
        @staticmethod
        def create(**kwargs):
            request = httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions")
            response = httpx.Response(404, request=request)
            raise NotFoundError("model not available on this account", response=response, body=None)

    class FakeChat:
        completions = FakeCompletions()

    class FakeGroqClient:
        def __init__(self, *args, **kwargs):
            self.chat = FakeChat()

    groq_sdk.AsyncGroq = FakeGroqClient

    # only groq configured for this test (no live call to the other providers)
    saved_providers = vision.providers
    vision.providers = staticmethod(lambda: ["groq"])
    # only groq configured (settings pick up the project .env key)
    try:
        result = asyncio.run(vision.describe_figure(png))
        assert result is None
        assert "groq" in vision._disabled_providers, "groq must be parked after 404"
    finally:
        groq_sdk.AsyncGroq = saved_async_groq
        vision.providers = saved_providers  # restore real providers() before asserting on it

    try:
        assert "groq" not in vision.providers(), "parked provider excluded from providers()"
    finally:
        vision._disabled_providers.clear()
        vision._disabled_providers.update(saved_disabled)


# ── 5. OCR chunks from needs_ocr pages: windowing + provenance ────────────────
def test_ocr_chunks_created_and_windowed():
    saved = ocr.ocr_pdf_page
    long_text = "brake param x45 resistor " * 400  # 2400 words → several chunks

    def fake_ocr(file_path, page_number):
        if page_number == 2:
            return long_text
        if page_number == 4:
            return "short label text"
        return None

    ocr.ocr_pdf_page = fake_ocr

    pages = [
        {"page_number": 1, "text": "full body text page", "needs_ocr": False},
        {"page_number": 2, "text": "", "needs_ocr": True},
        {"page_number": 3, "text": "another body text page", "needs_ocr": False},
        {"page_number": 4, "text": "short", "needs_ocr": True},
    ]

    try:
        chunks = ingestion._build_ocr_chunks("void.pdf", pages, _fake_manual(), "0" * 32)

        assert chunks, "OCR chunks must be produced for flagged pages"
        assert all(c["content_type"] == "ocr" for c in chunks)
        assert all(c["page_start"] == c["page_end"] for c in chunks)
        assert all(
            c["page_start"] in (2, 4) for c in chunks
        ), "pages not flagged needs_ocr stay untouched"

        page2 = [c for c in chunks if c["page_start"] == 2]
        page4 = [c for c in chunks if c["page_start"] == 4]
        assert len(page2) > 1, "long OCR text must be split into several chunks"
        assert len(page4) == 1

        window = ingestion.settings.CHUNK_SIZE - ingestion.settings.CHUNK_OVERLAP
        first_slice = page2[0]["text"].split("\n", 1)[1].split()
        assert len(first_slice) == ingestion.settings.CHUNK_SIZE  # full window in chunk 1
        assert len(page2) > 1 and len(page2) * window > len(long_text.split()) - window

        for c in chunks:
            assert c["text"].startswith("Scanned page"), "OCR chunks carry provenance"
            assert "OCR)" in c["text"].splitlines()[0]
    finally:
        ocr.ocr_pdf_page = saved


# ── 6. real Tesseract round-trip (skipped when the binary is absent) ──────────
def test_real_tesseract_smoke():
    if not ocr.tesseract_available():
        print("SKIP: tesseract not available")
        return
    png = _png(Path(tempfile.mkdtemp()), "Resistance Braking Manual Warning Section")
    text = ocr.ocr_png(png)
    assert text is not None
    joined = "".join(text.lower().split())
    assert any(w in joined for w in ("manual", "braking", "section"))


if __name__ == "__main__":
    test_describe_page_prefers_vision()
    print("OK: test_describe_page_prefers_vision")
    test_describe_page_falls_back_to_ocr()
    print("OK: test_describe_page_falls_back_to_ocr")
    test_describe_page_returns_none_when_everything_fails()
    print("OK: test_describe_page_returns_none_when_everything_fails")
    test_groq_parked_after_model_not_found()
    print("OK: test_groq_parked_after_model_not_found")
    test_ocr_chunks_created_and_windowed()
    print("OK: test_ocr_chunks_created_and_windowed")
    test_real_tesseract_smoke()
    print("OK: test_real_tesseract_smoke")
