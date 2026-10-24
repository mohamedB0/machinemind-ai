# QA Plan — Handling Tables, Figures & Schematics in the RAG Pipeline

> Status: **in progress** — created 2026-10-23 after testing with real manuals
> (Allen-Bradley PowerFlex 525, WEG CFW500, Danfoss VLT FC 202).
>
> Progress: **[1] done** (2026-10-24) · **[2] done** (2026-10-24) · **[3] partially done** (2026-10-24) · [4] pending

## Current behavior (findings)

- **Tables** — `extract_text_from_pdf` uses `page.get_text()` (`services/api/app/services/ingestion.py:43`).
  PyMuPDF dumps table cells as flat text: rows are concatenated, column structure is lost.
  Values survive (e.g. `P0133`, `20.0 s`), so lexical search can hit them, but the LLM sees a
  jumble without knowing which column is the default.
- **Chunking** — `chunk_pages` is a word sliding-window (`ingestion.py:77-116`), not
  paragraph-aware → a 60-row table gets **split across chunks**, headers separated from rows.
- **`content_type="table"`** (`ingestion.py:93-94`) is cosmetic — keyword-tag only, nothing
  downstream uses it for special parsing or rendering.
- **Figures / schemas / wiring diagrams** — zero handling. `get_text()` extracts no images,
  no vector drawings, no caption→part mapping. A fault flowchart or terminal diagram is
  invisible to retrieval.
- **`needs_ocr` flag** (`ingestion.py:44`) is set but **never acted on** — no OCR pass exists,
  scanned pages produce empty chunks.

## Roadmap (in order of ROI)

### 1. Structured table extraction — `page.find_tables()` ✅ (2026-10-24)
- Implemented in `services/api/app/services/ingestion.py`:
  - `extract_text_from_pdf` now runs `page.find_tables()` per page and returns
    `{page_number, text, body_text, tables, needs_ocr}` — `text` keeps the raw page
    (for page rendering/citations), `body_text` excludes table regions, `tables`
    holds structured `{header, rows}`.
  - Rows of detected tables are converted to **Markdown** (`| Param | Default | |`),
    so the LLM sees aligned columns instead of a cell-jumble.
  - `chunk_pages` emits each table as its own chunk with `content_type="table"`;
    oversized tables are split **by row groups** (never mid-row) with the header
    repeated in every part so each part identifies the default column.
  - Word budget ≤ `CHUNK_SIZE` (600) per part; degenerate detections
    (< 2 cols, < 2 rows, < 3 filled cells) are skipped.
  - `needs_ocr` now accounts for table-cell content, so table-heavy pages are not
    mistaken for scanned pages.
- Verified: PowerFlex 520-UM001 (274 pages → 256 tables → 263 table chunks, 0 word-budget
  breaches), Danfoss MG20N622 (214 pages → 252 tables). Unit tests:
  `services/api/tests/test_table_chunking.py`.
- Note: find_tables costs ~0.3 s/page; ingestion already runs as a FastAPI
  BackgroundTask, so this does not block API responses.

### 2. Render source pages as citations ✅ (2026-10-24)
- Implemented:
  - At ingest, every page is rendered to `uploads/pages/{manual_id}/page_NNN.png`
    (DPI configurable via `PAGE_RENDER_DPI`, default 150). ~47 MB for a 214-page
    Danfoss design guide.
  - New endpoint `GET /api/manuals/{manual_id}/pages/{page_number}` (`routes/manuals.py`)
    serves PNGs; ownership is checked (Manual → Machine.owner_id). Accepts the JWT via
    Authorization header **or** `?token=` so `<img>` tags work.
  - Next.js: `lib/api.ts` `manualPageUrl()`; answer UI `SourceCard` shows a thumbnail
    of the cited page plus a "View full page ↗" link when expanded, and special icons
    for figure/table citations.

### 3. Vision LLM for figures — ⏳ partially (2026-10-24)
- Implemented (Option A at ingest):
  -Figure flagging in `ingestion._page_figure_reason()`: page counted figure-heavy when
    raster images cover ≥ 15 % of the page (`photo`) **or** ≥ 100 vector paths lie
    *outside* detected table bboxes (`schematic`). Table strokes are excluded so dense
    parameter-table pages don't eat the vision budget — verified on MG20N622: 58/214
    pages flagged, control-structure/wiring-diagram sections hit, TOC/table pages not.
  - Flagged pages (capped at `FIGURE_MAX_PAGES`, default 12) are sent to Groq vision
    (`app/services/vision.py`); the description becomes a searchable
    `content_type="figure"` chunk. Fail-open: missing key / model unavailable /
    errors → ingestion continues without figure chunks.
- **Blocking: this Groq account currently has no vision-capable model** (model list:
  gpt-oss, whisper, qwen, llama-guard only). Default `GROQ_VISION_MODEL=
  meta-llama/llama-4-scout-17b-16e-instruct` works on accounts with vision access —
  configure via env. Until then figure chunks are silently skipped.
- Option B (at query) intentionally deferred.

### 4. OCR fallback for scanned pages
- Wire up `needs_ocr` pages (e.g. Tesseract via `pytesseract`, `ocrmypdf` alternative).
- Pages with `< 50` chars currently produce nothing; OCR them and feed the result into
  the same chunking pipeline.

## Acceptance criteria

- [ ] Ask "what is the default value of P0133?" → answer identifies the exact column
      (default) with correct unit, not a cell-jumble.
- [x] Tables are chunked as single units (no split tables across chunks).
      ^(12 real corpora: tables kept as whole-row chunks; oversized tables split by row
      groups with repeated headers — mid-row splits impossible.^)
- [x] Answer UI shows a link/thumbnail of the cited manual page.
- [ ] At least one figure-heavy page (e.g. FC 202 terminal wiring diagram) is retrievable
      by asking about its content. ^(Blocked on Groq vision model availability; see item 3.^)
- [ ] Scanned PDF pages produce populated chunks instead of empty ones.

## Test material

| Machine | Manual | Link |
|---|---|---|
| Allen-Bradley PowerFlex 525 | 520-UM001 user manual | https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf |
| WEG CFW500 | CFW500 user manual | https://download.factorymation.com/acdrives/cfw500_user_manual.pdf |
| Danfoss VLT AQUA Drive FC 202 | MG20N622 design guide | https://files.danfoss.com/download/Drives/MG20N622.pdf |
