"""
PDF Ingestion Service — extracts text, chunks it, generates embeddings, indexes in pgvector
"""
import hashlib
import logging
import re
import uuid
from pathlib import Path
from typing import Optional

import fitz  # PyMuPDF
from sentence_transformers import SentenceTransformer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.core.config import get_settings
from app.models.machine import Manual, DocumentPage, IngestionStatus
from app.models.rag import DocumentChunk

logger = logging.getLogger(__name__)

settings = get_settings()


# ── Load embedding model once (cached at module level) ──────────────────────
_embedding_model: Optional[SentenceTransformer] = None


def get_embedding_model() -> SentenceTransformer:
    global _embedding_model
    if _embedding_model is None:
        _embedding_model = SentenceTransformer(settings.EMBEDDING_MODEL)
    return _embedding_model


# ── Utilities ────────────────────────────────────────────────────────────────

def compute_file_hash(file_bytes: bytes) -> str:
    return hashlib.sha256(file_bytes).hexdigest()


def _cell_to_md(value) -> str:
    """Normalize a table cell for Markdown output."""
    if value is None:
        return ""
    text = str(value).replace("|", "\\|").replace("\n", " ").strip()
    return text


def _rows_to_markdown(header: list, rows: list) -> str:
    """Build a Markdown table so the LLM sees aligned rows/columns."""
    lines = ["| " + " | ".join(_cell_to_md(c) for c in header) + " |"]
    lines.append("| " + " | ".join("---" for _ in header) + " |")
    for row in rows:
        lines.append("| " + " | ".join(_cell_to_md(c) for c in row) + " |")
    return "\n".join(lines)


def _remove_table_regions(page: "fitz.Page", table_rects) -> str:
    """Rebuild page text excluding words inside table bboxes."""
    words = page.get_text("words")  # x0, y0, x1, y1, word, block, line, wordno
    line_map: dict[tuple, list] = {}
    for w in words:
        x0, y0, x1, y1, word, block, line, _ = w
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        if any(r != fitz.Rect() and fitz.Rect(r).contains(fitz.Point(cx, cy)) for r in table_rects):
            continue
        line_map.setdefault((block, line), []).append((x0, y0, word))
    lines = [
        " ".join(word for _, _, word in sorted(bucket, key=lambda t: t[0]))
        for _, bucket in sorted(line_map.items(), key=lambda kv: min(y for _, y, _ in kv[1]))
    ]
    return "\n".join(lines)


def _page_figure_reason(page: "fitz.Page", table_rects: list) -> str | None:
    """
    Return a reason string when the page looks figure-heavy, else None.
    Drawings inside table bboxes don't count — dense tables are handled by
    find_tables(), and their thousands of border strokes must not flag the
    page as a schematic.
    """
    import logging
    logger = logging.getLogger(__name__)

    page_area = page.rect.get_area() or 1.0
    try:
        raster_area = 0.0
        for img in page.get_images(full=False):
            for rect in page.get_image_rects(img[0]):
                raster_area += rect.get_area()
        if raster_area / page_area >= settings.FIGURE_IMAGE_AREA_RATIO:
            return "photo"
    except Exception:
        logger.debug("get_images failed on a page", exc_info=True)

    rects = [fitz.Rect(r) for r in table_rects if r != fitz.Rect()]
    try:
        free_drawings = 0
        for d in page.get_drawings():
            r = d.get("rect")
            if r is None:
                continue
            cx, cy = (r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2
            if any(rr.contains(fitz.Point(cx, cy)) for rr in rects):
                continue
            free_drawings += 1
        if free_drawings >= settings.FIGURE_DRAWING_PATHS:
            return "schematic"
    except Exception:
        logger.debug("get_drawings failed on a page", exc_info=True)

    return None


def _render_page_png(page: "fitz.Page", dest: Path) -> bool:
    try:
        pix = page.get_pixmap(dpi=settings.PAGE_RENDER_DPI)
        pix.save(str(dest))
        return True
    except Exception:
        import logging
        logging.getLogger(__name__).exception("Failed to render page image %s", dest)
        return False


def extract_text_from_pdf(file_path: str, page_imgs_dir: Optional[Path] = None) -> list[dict]:
    """
    Returns list of {page_number, text, body_text, tables, needs_ocr, has_figure} where:
    - text:       full page text as-is (kept for page rendering / citations)
    - body_text:  page text excluding table regions (used for chunking)
    - tables:     list of {header, rows} from page.find_tables()
    - has_figure: page contains figure-heavy content (photo/schematic)
    When page_imgs_dir is given, every page is also rendered as PNG for
    citations (QA item 2) and figure pages are flagged for the vision pass.
    """
    pages = []
    doc = fitz.open(file_path)
    for i, page in enumerate(doc):
        text = page.get_text().strip()

        table_structs: list[dict] = []
        table_rects: list = []
        try:
            tabs = page.find_tables()
            for t in tabs.tables:
                extracted = t.extract()
                if not extracted:
                    continue
                # Skip degenerate detections: headers-as-rows or 1-column noise
                col_count = max(len(r) for r in extracted)
                non_empty = sum(1 for r in extracted for c in r if c and str(c).strip())
                if col_count < 2 or len(extracted) < 2 or non_empty < 3:
                    continue
                table_structs.append({
                    "page_number": i + 1,
                    "header": extracted[0],
                    "rows": extracted[1:],
                })
                table_rects.append(t.bbox)
        except Exception:
            table_rects = []

        body_text = _remove_table_regions(page, table_rects) if table_rects else text
        # OCR heuristic: almost nothing left after excluding table regions → likely scanned
        effective_len = len(body_text) if table_structs else len(text)
        table_len = sum(
            len(str(c or ""))
            for t in table_structs
            for row in [t["header"], *t["rows"]]
            for c in row
        )
        needs_ocr = (effective_len + table_len) < 50

        has_figure = False
        figure_reason = None
        if page_imgs_dir is not None:
            figure_reason = _page_figure_reason(page, table_rects)
            has_figure = figure_reason is not None
            _render_page_png(page, page_imgs_dir / f"page_{i + 1:03d}.png")

        pages.append({
            "page_number": i + 1,
            "text": text,
            "body_text": body_text,
            "tables": table_structs,
            "needs_ocr": needs_ocr,
            "has_figure": has_figure,
            "figure_reason": figure_reason,
        })
    doc.close()
    return pages


def chunk_pages(pages: list[dict], manual_id: str, machine_id: str,
                chunk_size: int = 600, overlap: int = 100) -> list[dict]:
    """
    Hierarchical chunking: tries to preserve section boundaries.
    Falls back to sliding-window if no structure detected.
    """
    chunks = []
    chunk_index = 0

    # Concatenate all text with page markers (table regions already excluded)
    full_text_parts = []
    for p in pages:
        if p.get("body_text"):
            full_text_parts.append((p["page_number"], p["body_text"]))

    # Split into sections by heading patterns
    section_pattern = re.compile(
        r"^(\d+[\.\d]*\s+.{3,80}|[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜ]{3,}.*)"
    , re.MULTILINE)

    # Build sliding window over full text (per page granularity for citation)
    words_buffer: list[tuple[int, str]] = []  # (page_number, word)
    for page_num, text in full_text_parts:
        for word in text.split():
            words_buffer.append((page_num, word))

    i = 0
    while i < len(words_buffer):
        window = words_buffer[i: i + chunk_size]
        if not window:
            break

        chunk_words = [w for _, w in window]
        pages_in_chunk = list({p for p, _ in window})
        text = " ".join(chunk_words)

        # Detect content type heuristic
        content_type = "general"
        lower = text.lower()
        if any(w in lower for w in ["warning", "caution", "danger", "attention", "avertissement"]):
            content_type = "warning"
        elif any(w in lower for w in ["step", "étape", "procedure", "procédure", "1.", "2.", "3."]):
            content_type = "procedure"
        elif any(w in lower for w in ["table", "tableau", "°c", "bar", "kw", "hz", "rpm", "mm"]):
            content_type = "table"

        # Try to detect section title from first line
        section_title = None
        first_line = text.split("\n")[0].strip()
        if section_pattern.match(first_line) and len(first_line) < 120:
            section_title = first_line

        chunks.append({
            "id": str(uuid.uuid4()),
            "manual_id": manual_id,
            "machine_id": machine_id,
            "chunk_index": chunk_index,
            "text": text,
            "page_start": min(pages_in_chunk) if pages_in_chunk else None,
            "page_end": max(pages_in_chunk) if pages_in_chunk else None,
            "section_title": section_title,
            "content_type": content_type,
        })
        chunk_index += 1
        i += chunk_size - overlap

    # ── Emit each table as its own chunk (rows stay intact) ─────────────────
    for p in pages:
        for table in p.get("tables", []):
            header, rows = table["header"], table["rows"]
            if not rows:
                continue

            def table_text(part_rows: list, part_label: str = "") -> str:
                md = _rows_to_markdown(header, part_rows)
                prefix = f"Manual table{part_label} on page {p['page_number']}:\n"
                return prefix + md

            if len(table_text(rows).split()) <= chunk_size:
                parts = [rows]
            else:
                # Oversized table: split by row groups, repeating the header so
                # every part still shows which column holds the default value
                parts, current = [], []
                for row in rows:
                    # margin covers the "(part j/N)" label added to emitted text
                    if current and len(table_text(current + [row]).split()) > chunk_size - 8:
                        parts.append(current)
                        current = [row]
                    else:
                        current.append(row)
                if current:
                    parts.append(current)

            for j, part in enumerate(parts):
                label = f" (part {j + 1}/{len(parts)})" if len(parts) > 1 else ""
                text = table_text(part, label)
                chunks.append({
                    "id": str(uuid.uuid4()),
                    "manual_id": manual_id,
                    "machine_id": machine_id,
                    "chunk_index": chunk_index,
                    "text": text,
                    "page_start": p["page_number"],
                    "page_end": p["page_number"],
                    "section_title": None,
                    "content_type": "table",
                })
                chunk_index += 1

    return chunks


def generate_embeddings(texts: list[str]) -> list[list[float]]:
    model = get_embedding_model()
    # multilingual-e5 needs "query: " / "passage: " prefix
    prefixed = [f"passage: {t}" for t in texts]
    embeddings = model.encode(prefixed, batch_size=16, show_progress_bar=False)
    return embeddings.tolist()


async def _build_figure_chunks(
    pages_data: list[dict],
    manual: "Manual",
    manual_id: str,
    page_imgs_dir: Path,
) -> list[dict]:
    """
    Figure pages (photo/schematic flags) become searchable content_type="figure"
    chunks:
      1. Cloud vision LLM (groq → gemini → openrouter, auto-fallback) when any
         provider is configured — semantic description of the diagram.
      2. Local Tesseract OCR otherwise — exact transcription of visible labels.
    Failures degrade gracefully (no figure chunks), never break ingestion.
    """
    from app.services.figures import describe_page

    flagged = [p for p in pages_data if p.get("has_figure")][: settings.FIGURE_MAX_PAGES]
    chunks: list[dict] = []
    for p in flagged:
        png = page_imgs_dir / f"page_{p['page_number']:03d}.png"
        if not png.exists():
            continue
        result = await describe_page(str(png))
        if not result:
            continue
        reason = p.get("figure_reason")
        kind = f", {reason}" if reason else ""
        chunks.append({
            "id": str(uuid.uuid4()),
            "manual_id": manual_id,
            "machine_id": str(manual.machine_id),
            "text": (
                f"Figure page {p['page_number']}{kind} of this manual "
                f"[{result['source']}]:\n{result['text']}"
            ),
            "page_number": p["page_number"],
            "content_type": "figure",
        })
    if chunks:
        sources = sorted({c["text"].split("[", 1)[1].split("]")[0] for c in chunks})
        logger.info("Figure chunks: %s (%d pages)", ", ".join(sources), len(chunks))
    return chunks


def _build_ocr_chunks(
    file_path: str,
    pages_data: list[dict],
    manual: "Manual",
    manual_id: str,
) -> list[dict]:
    """
    Pages flagged needs_ocr (scanned PDFs, near-empty text) are transcribed by
    local Tesseract OCR and indexed like normal slices, so a scanned build hand
    manual still becomes searchable. Content is chunked with the same
    sliding-window rule as body text. Capped at OCR_MAX_PAGES per manual.
    """
    flagged = [
        p for p in pages_data
        if p.get("needs_ocr") and len(p.get("text") or "") < 50
    ][: settings.OCR_MAX_PAGES]
    if not flagged:
        return []

    from app.services.ocr import ocr_pdf_page

    chunks: list[dict] = []
    chunk_index = 0
    for p in flagged:
        text = ocr_pdf_page(file_path, p["page_number"])
        if not text:
            continue
        words = text.split()
        i = 0
        part = 0
        total_parts = max(1, -(-len(words) // (settings.CHUNK_SIZE - settings.CHUNK_OVERLAP)))
        while i < len(words):
            window = words[i: i + settings.CHUNK_SIZE]
            slice_text = " ".join(window)
            label = f" (part {part + 1}/{total_parts})" if total_parts > 1 else ""
            chunks.append({
                "id": str(uuid.uuid4()),
                "manual_id": manual_id,
                "machine_id": str(manual.machine_id),
                "chunk_index": 0,
                "text": (
                    f"Scanned page {p['page_number']} of this manual (OCR):{label}\n{slice_text}"
                ),
                "page_start": p["page_number"],
                "page_end": p["page_number"],
                "section_title": None,
                "content_type": "ocr",
            })
            part += 1
            chunk_index += 1
            i += settings.CHUNK_SIZE - settings.CHUNK_OVERLAP
    if flagged and not chunks:
        logger.warning("OCR produced nothing for %d flagged pages", len(flagged))
    return chunks


# ── Main ingestion pipeline ──────────────────────────────────────────────────

async def run_ingestion(manual_id: str, file_path: str, db: AsyncSession):
    """Full pipeline: extract → chunk → embed → index."""
    try:
        # Mark as processing
        await db.execute(
            update(Manual)
            .where(Manual.id == manual_id)
            .values(status=IngestionStatus.processing)
        )
        await db.commit()

        # Fetch manual record
        result = await db.execute(select(Manual).where(Manual.id == manual_id))
        manual = result.scalar_one()

        # 1. Extract text per page + render PNGs + flag figure pages
        page_imgs_dir = Path(settings.UPLOAD_DIR) / "pages" / manual_id
        page_imgs_dir.mkdir(parents=True, exist_ok=True)
        pages_data = extract_text_from_pdf(file_path, page_imgs_dir=page_imgs_dir)

        # 2. Save pages
        page_objects = [
            DocumentPage(
                manual_id=uuid.UUID(manual_id),
                page_number=p["page_number"],
                text_content=p["text"],
                needs_ocr=p["needs_ocr"],
                has_figure=p["has_figure"],
            )
            for p in pages_data
        ]
        db.add_all(page_objects)
        await db.flush()

        # 3. Chunk
        raw_chunks = chunk_pages(
            pages_data,
            manual_id=manual_id,
            machine_id=str(manual.machine_id),
            chunk_size=settings.CHUNK_SIZE,
            overlap=settings.CHUNK_OVERLAP,
        )

        if not raw_chunks:
            raise ValueError("No text could be extracted from this PDF.")

        # 3b. Figure pages → searchable figure chunks (vision LLM, OCR fallback — fail-open)
        try:
            figure_chunks = await _build_figure_chunks(
                pages_data, manual, manual_id, page_imgs_dir,
            )
        except Exception:
            logger.exception("Figure chunking failed — continuing without it")
            figure_chunks = []

        # 3c. Scanned pages (needs_ocr) → transcription OCR locale (fail-open)
        try:
            ocr_chunks = _build_ocr_chunks(file_path, pages_data, manual, manual_id)
        except Exception:
            logger.exception("OCR chunking failed — continuing without it")
            ocr_chunks = []

        for extra in (*figure_chunks, *ocr_chunks):
            raw_chunks.append({
                "id": extra["id"],
                "manual_id": extra["manual_id"],
                "machine_id": extra["machine_id"],
                "chunk_index": 0,  # renumbered below
                "text": extra["text"],
                "page_start": extra.get("page_number") or extra.get("page_start"),
                "page_end": extra.get("page_number") or extra.get("page_end"),
                "section_title": None,
                "content_type": extra["content_type"],
            })
        # Sequential chunk_index over everything (body, tables, figures, OCR)
        for position, chunk in enumerate(raw_chunks):
            chunk["chunk_index"] = position

        # 4. Generate embeddings in batches
        texts = [c["text"] for c in raw_chunks]
        embeddings = generate_embeddings(texts)

        # 5. Save chunks with embeddings
        chunk_objects = [
            DocumentChunk(
                id=uuid.UUID(c["id"]),
                manual_id=uuid.UUID(c["manual_id"]),
                machine_id=uuid.UUID(c["machine_id"]),
                chunk_index=c["chunk_index"],
                text=c["text"],
                page_start=c["page_start"],
                page_end=c["page_end"],
                section_title=c["section_title"],
                content_type=c["content_type"],
                manual_version=manual.version,
                language=manual.language,
                embedding=embeddings[i],
            )
            for i, c in enumerate(raw_chunks)
        ]
        db.add_all(chunk_objects)

        # 6. Update manual: mark completed + page count
        await db.execute(
            update(Manual)
            .where(Manual.id == manual_id)
            .values(
                status=IngestionStatus.completed,
                page_count=len(pages_data),
            )
        )
        await db.commit()

    except Exception as exc:
        await db.rollback()
        await db.execute(
            update(Manual)
            .where(Manual.id == manual_id)
            .values(status=IngestionStatus.error, error_message=str(exc)[:1000])
        )
        await db.commit()
        raise
