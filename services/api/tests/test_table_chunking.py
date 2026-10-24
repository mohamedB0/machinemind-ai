"""
Unit tests for structured table extraction + table chunking in ingestion.py.

Can run via pytest (pytest tests/) or directly: python tests/test_table_chunking.py
"""
import sys
import tempfile
from pathlib import Path

import fitz

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.ingestion import (
    extract_text_from_pdf,
    chunk_pages,
    _page_figure_reason,
)


def _make_table_pdf(path: Path, rows: int):
    """Build a PDF containing one bordered table followed by plain text."""
    doc = fitz.open()
    page = doc.new_page(width=612, height=max(792, rows * 22 + 100))

    header = ["Param", "Default", "Unit"]
    data = [[f"P{100 + i}", f"{i}.5", "s"] for i in range(rows - 1)]
    table = [header] + data

    x0, y0, cw, ch = 60, 60, 110, 22
    for r, row in enumerate(table):
        for c, _ in enumerate(row):
            page.draw_rect(fitz.Rect(x0 + c * cw, y0 + r * ch, x0 + (c + 1) * cw, y0 + (r + 1) * ch))
    for r, row in enumerate(table):
        for c, value in enumerate(row):
            page.insert_text(
                fitz.Point(x0 + c * cw + 4, y0 + r * ch + 15),
                str(value),
                fontsize=11,
            )

    page.insert_text(fitz.Point(60, y0 + len(table) * ch + 40), "Follow-up paragraph inside the user manual.")
    doc.save(str(path))
    doc.close()


def test_table_extracted_as_markdown_chunk():
    with tempfile.TemporaryDirectory() as tmp:
        pdf = Path(tmp) / "table.pdf"
        _make_table_pdf(pdf, rows=6)
        pages = extract_text_from_pdf(str(pdf))

        assert len(pages) == 1
        assert len(pages[0]["tables"]) == 1
        t = pages[0]["tables"][0]
        assert t["header"][0] == "Param"
        assert ("P100", "0.5", "s") in [tuple(r) for r in t["rows"]]

        # body text (used for chunking) excludes table cells but keeps page prose
        body = pages[0]["body_text"]
        assert "Follow-up paragraph" in body
        assert "P101" not in body

        chunks = chunk_pages(pages, manual_id="0" * 32, machine_id="0" * 32)
        table_chunks = [c for c in chunks if c["content_type"] == "table" and c["text"].startswith("Manual table")]

        assert len(table_chunks) == 1
        chunk = table_chunks[0]
        assert chunk["page_start"] == chunk["page_end"] == 1
        lines = chunk["text"].splitlines()
        assert lines[1].startswith("| Param | Default | Unit |")
        assert lines[2].startswith("| --- |")
        assert any("| P101 | 1.5 | s |" in line for line in lines)
        data_rows = [line for line in lines if line.startswith("| P1")]
        assert len(data_rows) == 5


def test_oversized_table_splits_by_row_groups_with_header():
    with tempfile.TemporaryDirectory() as tmp:
        pdf = Path(tmp) / "big_table.pdf"
        _make_table_pdf(pdf, rows=120)
        pages = extract_text_from_pdf(str(pdf))

        assert len(pages[0]["tables"]) == 1

        chunks = chunk_pages(pages, manual_id="0" * 32, machine_id="0" * 32)
        table_chunks = [c for c in chunks if c["content_type"] == "table" and c["text"].startswith("Manual table")]

        assert len(table_chunks) > 1
        seen = set()
        for chunk in table_chunks:
            # every part repeats the header row and stays within the word budget
            assert chunk["text"].splitlines()[1].startswith("| Param | Default | Unit |")
            assert "part" in chunk["text"].splitlines()[0]
            assert len(chunk["text"].split()) <= 601
            for line in chunk["text"].splitlines():
                if not (line.startswith("| P1") or line.startswith("| P2")):
                    continue
                param = line.split("|")[1].strip()
                assert param not in seen  # rows intact, never duplicated or re-split
                seen.add(param)
        assert len(seen) == 119


def _make_diagram_page(doc: fitz.Document, n_lines: int = 150):
    """Page with n_lines free-standing vector strokes (like a wiring diagram)."""
    page = doc.new_page(width=612, height=792)
    for k in range(n_lines):
        page.draw_line(fitz.Point(40 + k % 100, 300 + k * 2 % 400), fitz.Point(200 + k % 150, 320 + k * 2 % 400))
    return page


def test_figure_flagging_and_rendering():
    with tempfile.TemporaryDirectory() as tmp:
        doc = fitz.open()
        page = _make_diagram_page(doc)
        reason = _page_figure_reason(page, [])
        assert reason == "schematic"
        doc.close()

    # rendering writes one PNG per page and tags figure pages
    with tempfile.TemporaryDirectory() as tmp:
        pdf = Path(tmp) / "d.pdf"
        doc = fitz.open()
        _make_diagram_page(doc)
        # second page with a raster photo
        page2 = doc.new_page(width=612, height=792)
        pix = fitz.Pixmap(fitz.csRGB, fitz.IRect(0, 0, 30, 30))
        page2.insert_image(fitz.Rect(100, 100, 500, 600), pixmap=pix)
        # third page: plain text only
        page3 = doc.new_page(width=612, height=792)
        page3.insert_text(fitz.Point(72, 72), "Plain text page with no figures at all here.", fontsize=12)
        doc.save(str(pdf))
        doc.close()

        pages = extract_text_from_pdf(str(pdf), page_imgs_dir=Path(tmp))
        pngs = sorted(Path(tmp).glob("page_*.png"))
        assert len(pngs) == 3
        assert pages[0]["has_figure"] is True and pages[0]["figure_reason"] == "schematic"
        assert pages[1]["has_figure"] is True and pages[1]["figure_reason"] == "photo"
        assert pages[2]["has_figure"] is False and pages[2]["figure_reason"] is None


def test_table_lines_do_not_flag_schematic():
    with tempfile.TemporaryDirectory() as tmp:
        pdf = Path(tmp) / "t.pdf"
        _make_table_pdf(pdf, rows=6)
        doc = fitz.open(str(pdf))
        page = doc[0]
        tabs = page.find_tables()
        rects = [t.bbox for t in tabs.tables]
        reason = _page_figure_reason(page, rects)
        assert reason is None, f"ruled table page must not be flagged, got {reason}"
        doc.close()


if __name__ == "__main__":
    test_table_extracted_as_markdown_chunk()
    print("OK: test_table_extracted_as_markdown_chunk")
    test_oversized_table_splits_by_row_groups_with_header()
    print("OK: test_oversized_table_splits_by_row_groups_with_header")
    test_figure_flagging_and_rendering()
    print("OK: test_figure_flagging_and_rendering")
    test_table_lines_do_not_flag_schematic()
    print("OK: test_table_lines_do_not_flag_schematic")
