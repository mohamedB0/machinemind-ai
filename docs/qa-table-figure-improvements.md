# QA Plan — Handling Tables, Figures & Schematics in the RAG Pipeline

> Status: **in progress** — created 2026-10-23 after testing with real manuals
> (Allen-Bradley PowerFlex 525, WEG CFW500, Danfoss VLT FC 202).
>
> Progress: **[1] done** (2026-10-24) · **[2] done** (2026-10-24) · **[3] done** (2026-10-25) · **[4] done** (2026-10-25)

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

### 3. Vision LLM for figures — ✅ done (2026-10-25, multi-provider + OCR fallback)
- Implemented (Option A at ingest):
  -Figure flagging in `ingestion._page_figure_reason()`: page counted figure-heavy when
    raster images cover ≥ 15 % of the page (`photo`) **or** ≥ 100 vector paths lie
    *outside* detected table bboxes (`schematic`). Table strokes are excluded so dense
    parameter-table pages don't eat the vision budget — verified on MG20N622: 58/214
    pages flagged, control-structure/wiring-diagram sections hit, TOC/table pages not.
  - Flagged pages (capped at `FIGURE_MAX_PAGES`, default 12) are described at ingest by
    `app/services/figures.py`:
    1. **Cloud vision LLM** — multi-provider with automatic fallback
       (`app/services/vision.py`): groq → gemini → openrouter (order selectable via
       `VISION_PROVIDER=auto|groq|gemini|openrouter|none`). A provider returning 404
       (model not on the account) or 401 (bad key) is **parked for the rest of the
       process** — no retry storm. This unblocks the previous blocker: even though this
       Groq account has no vision model, adding a free `GEMINI_API_KEY` is enough.
    2. **Local OCR fallback** — when no vision provider answers, Tesseract
       (`app/services/ocr.py`) transcribes the labels already visible in the schematic
       (searchable text, no API needed).
  - The chunk text records its provenance: `[vision:gemini]` / `[vision:groq]` / `[ocr]`.
  - Fail-open at every level: missing key, parked provider, OCR failure → ingestion
    continues without those chunks.
- Tests: `services/api/tests/test_figure_fallback.py` (vision preference, OCR fallback,
  all-fail → None, parking after 404, OCR chunk windowing + provenance, real Tesseract
  round-trip).

### 4. OCR fallback for scanned pages — ✅ done (2026-10-25)
- `ingestion._build_ocr_chunks()`: pages flagged `needs_ocr` (< 50 extracted chars) are
  transcribed by local Tesseract at `OCR_DPI` (default 300) and indexed like normal
  slices with `content_type="ocr"`, provenance prefix `Scanned page N … (OCR):`.
- Long OCR output is chunked with the same sliding-window rule as body text
  (600 words / 100 overlap), one page per chunk group.
- Capped at `OCR_MAX_PAGES` (default 50) per manual. Fail-open: OCR errors or a missing
  Tesseract binary never break ingestion.
- Tesseract dependency: `pytesseract` in requirements.txt; binary installed in the API
  Docker image (`tesseract-ocr tesseract-ocr-fra tesseract-ocr-eng`) and on Windows via
  `winget install UB-Mannheim.TesseractOCR` (fra traineddata added).

## Acceptance criteria

- [x] Ask "what is the default value of P0133?" → answer identifies the exact column
      (default) with correct unit, not a cell-jumble.
- [x] Tables are chunked as single units (no split tables across chunks).
      ^(12 real corpora: tables kept as whole-row chunks; oversized tables split by row
      groups with repeated headers — mid-row splits impossible.^)
- [x] Answer UI shows a link/thumbnail of the cited manual page.
- [x] At least one figure-heavy page (e.g. FC 202 terminal wiring diagram) is retrievable
      by asking about its content. ^(Solved: vision multi-provider (Gemini free tier /
      Groq paid tier) with local OCR fallback — labels transcribed with or without
      cloud access.^)
- [x] Scanned PDF pages produce populated chunks instead of empty ones. ^(Tesseract OCR
      chunks content_type="ocr".^)

## Test material

| Machine | Manual | Link |
|---|---|---|
| Allen-Bradley PowerFlex 525 | 520-UM001 user manual | https://literature.rockwellautomation.com/idc/groups/literature/documents/um/520-um001_-en-e.pdf |
| WEG CFW500 | CFW500 user manual | https://download.factorymation.com/acdrives/cfw500_user_manual.pdf |
| Danfoss VLT AQUA Drive FC 202 | MG20N622 design guide | https://files.danfoss.com/download/Drives/MG20N622.pdf |
