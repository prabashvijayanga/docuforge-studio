import fitz  # PyMuPDF
from PIL import Image
from pdf2docx import Converter
from pptx import Presentation
from pptx.util import Inches
import openpyxl
from openpyxl.styles import Font, PatternFill
import io
import zipfile
import json
import tempfile
import os
import html
from typing import List, Tuple


def process_organize_pdf(
    pdf_bytes: bytes,
    operations_json: str,
    watermark_text: str = "",
    compress_level: str = "none"
) -> io.BytesIO:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    total_pages = len(doc)

    operations = json.loads(operations_json) if operations_json else []
    if not operations:
        operations = [{"originalIndex": i, "rotation": 0} for i in range(total_pages)]

    valid_ops = [
        op for op in operations
        if 0 <= int(op.get("originalIndex", -1)) < total_pages
    ]

    if not valid_ops:
        raise ValueError("No valid pages selected for export.")

    selected_indices = [int(op["originalIndex"]) for op in valid_ops]
    doc.select(selected_indices)

    clean_wm = watermark_text.strip()
    for idx, op in enumerate(valid_ops):
        page = doc[idx]
        add_rot = int(op.get("rotation", 0))
        if add_rot != 0:
            page.set_rotation((page.rotation + add_rot) % 360)

        if clean_wm:
            rect = page.rect
            center_point = fitz.Point(rect.width * 0.25, rect.height * 0.55)
            page.insert_text(
                center_point,
                clean_wm,
                fontsize=44,
                color=(0.65, 0.65, 0.65),
                fill_opacity=0.35,
                morph=(center_point, fitz.Matrix(45)),
                overlay=True,
            )

    output = io.BytesIO()
    garbage_lvl = 3 if compress_level in ("recommended", "extreme") else 1
    doc.save(output, garbage=garbage_lvl, deflate=True)
    doc.close()
    output.seek(0)
    return output


def convert_images_to_pdf(
    image_tuples: List[Tuple[str, bytes]],
    page_size: str = "A4",
    margin: int = 24
) -> io.BytesIO:
    pdf_doc = fitz.open()
    a4_w, a4_h = 595.0, 842.0

    for _, img_bytes in image_tuples:
        img = Image.open(io.BytesIO(img_bytes))
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")

        img_w, img_h = img.size
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=92)
        buf.seek(0)

        if page_size == "FIT":
            page = pdf_doc.new_page(width=img_w, height=img_h)
            page.insert_image(fitz.Rect(0, 0, img_w, img_h), stream=buf.read())
        else:
            is_landscape = img_w > img_h
            pw, ph = (a4_h, a4_w) if is_landscape else (a4_w, a4_h)
            page = pdf_doc.new_page(width=pw, height=ph)

            avail_w = pw - (margin * 2)
            avail_h = ph - (margin * 2)
            scale = min(avail_w / img_w, avail_h / img_h)
            draw_w = img_w * scale
            draw_h = img_h * scale
            x0 = (pw - draw_w) / 2
            y0 = (ph - draw_h) / 2

            page.insert_image(fitz.Rect(x0, y0, x0 + draw_w, y0 + draw_h), stream=buf.read())

    output = io.BytesIO()
    pdf_doc.save(output, garbage=2, deflate=True)
    pdf_doc.close()
    output.seek(0)
    return output


def merge_multiple_pdfs(pdf_bytes_list: List[bytes]) -> io.BytesIO:
    merged = fitz.open()
    for b in pdf_bytes_list:
        doc = fitz.open(stream=b, filetype="pdf")
        merged.insert_pdf(doc)
        doc.close()

    output = io.BytesIO()
    merged.save(output, garbage=2, deflate=True)
    merged.close()
    output.seek(0)
    return output


def compress_pdf_stream(pdf_bytes: bytes, level: str = "recommended") -> io.BytesIO:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    quality_map = {"light": 85, "recommended": 65, "extreme": 40}
    jpg_quality = quality_map.get(level, 65)

    for page in doc:
        for img_info in page.get_images(full=True):
            xref = img_info[0]
            try:
                base_img = doc.extract_image(xref)
                if not base_img:
                    continue
                pil_img = Image.open(io.BytesIO(base_img["image"]))
                if pil_img.mode in ("RGBA", "P"):
                    pil_img = pil_img.convert("RGB")
                if max(pil_img.size) > 1600 and level == "extreme":
                    pil_img.thumbnail((1200, 1200))
                comp_buf = io.BytesIO()
                pil_img.save(comp_buf, format="JPEG", quality=jpg_quality, optimize=True)
                page.replace_image(xref, stream=comp_buf.getvalue())
            except Exception:
                continue

    output = io.BytesIO()
    doc.save(output, garbage=3, deflate=True)
    doc.close()
    output.seek(0)
    return output


def pdf_to_images_zip(pdf_bytes: bytes, dpi: int = 150) -> io.BytesIO:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for idx, page in enumerate(doc):
            pix = page.get_pixmap(dpi=dpi)
            zf.writestr(f"page_{idx + 1:03d}.png", pix.tobytes("png"))
    doc.close()
    zip_buffer.seek(0)
    return zip_buffer


def pdf_to_word_docx(pdf_bytes: bytes) -> io.BytesIO:
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_pdf:
        tmp_pdf.write(pdf_bytes)
        tmp_pdf_path = tmp_pdf.name

    tmp_docx_path = tmp_pdf_path.replace(".pdf", ".docx")
    try:
        cv = Converter(tmp_pdf_path)
        cv.convert(tmp_docx_path, start=0, end=None)
        cv.close()

        with open(tmp_docx_path, "rb") as f:
            docx_bytes = io.BytesIO(f.read())
        docx_bytes.seek(0)
        return docx_bytes
    finally:
        if os.path.exists(tmp_pdf_path):
            os.remove(tmp_pdf_path)
        if os.path.exists(tmp_docx_path):
            os.remove(tmp_docx_path)


# NEW CONVERTER 1: PDF to PowerPoint (.PPTX)
def pdf_to_pptx_stream(pdf_bytes: bytes, dpi: int = 150) -> io.BytesIO:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    prs = Presentation()
    # Set Widescreen 16:9 (13.333 x 7.5 inches)
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    for page in doc:
        slide = prs.slides.add_slide(blank_layout)
        pix = page.get_pixmap(dpi=dpi)
        img_bytes = io.BytesIO(pix.tobytes("png"))

        # Center page image inside slide while preserving aspect ratio
        page_ratio = pix.width / pix.height
        slide_w = prs.slide_width
        slide_h = prs.slide_height
        slide_ratio = slide_w / slide_h

        if page_ratio > slide_ratio:
            draw_w = slide_w
            draw_h = int(slide_w / page_ratio)
            left = 0
            top = int((slide_h - draw_h) / 2)
        else:
            draw_h = slide_h
            draw_w = int(slide_h * page_ratio)
            top = 0
            left = int((slide_w - draw_w) / 2)

        slide.shapes.add_picture(img_bytes, left, top, width=draw_w, height=draw_h)

        # Also attach extracted text into Speaker Notes for easy copy-pasting!
        page_text = page.get_text("text").strip()
        if page_text:
            notes_slide = slide.notes_slide
            notes_slide.notes_text_frame.text = page_text

    doc.close()
    output = io.BytesIO()
    prs.save(output)
    output.seek(0)
    return output


# NEW CONVERTER 2: PDF to Excel (.XLSX) — Extracts Tables & Structured Text
def pdf_to_excel_xlsx(pdf_bytes: bytes) -> io.BytesIO:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    wb = openpyxl.Workbook()
    # Remove default sheet
    wb.remove(wb.active)

    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="18181B", end_color="18181B", fill_type="solid")

    for idx, page in enumerate(doc):
        ws = wb.create_sheet(title=f"Page_{idx + 1}")
        row_cursor = 1

        # 1. Try native table detection first
        tables_found = False
        try:
            tabs = page.find_tables()
            if tabs and tabs.tables:
                tables_found = True
                for t_idx, table in enumerate(tabs.tables):
                    extracted = table.extract()
                    for r_i, row in enumerate(extracted):
                        cleaned_row = [cell if cell is not None else "" for cell in row]
                        ws.append(cleaned_row)
                        if r_i == 0:
                            for col_i in range(1, len(cleaned_row) + 1):
                                cell_obj = ws.cell(row=row_cursor, column=col_i)
                                cell_obj.font = header_font
                                cell_obj.fill = header_fill
                        row_cursor += 1
                    ws.append([])
                    row_cursor += 1
        except Exception:
            tables_found = False

        # 2. Fallback: Structured line/column extraction if no formal borders exist
        if not tables_found:
            ws.append([f"Page {idx + 1} Extracted Content"])
            ws.cell(row=1, column=1).font = header_font
            ws.cell(row=1, column=1).fill = header_fill
            lines = page.get_text("text").splitlines()
            for line in lines:
                if line.strip():
                    # Split by multiple spaces or tabs to mimic columns
                    cols = [c.strip() for c in line.split("  ") if c.strip()]
                    ws.append(cols if len(cols) > 1 else [line.strip()])

    if len(wb.sheetnames) == 0:
        wb.create_sheet(title="Empty_PDF")

    doc.close()
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output


# NEW CONVERTER 3: PDF to Markdown (.MD)
def pdf_to_markdown_md(pdf_bytes: bytes) -> io.BytesIO:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    md_parts = ["# Extracted Document\n"]

    for idx, page in enumerate(doc):
        md_parts.append(f"\n---\n## Page {idx + 1}\n")
        blocks = page.get_text("dict").get("blocks", [])
        for b in blocks:
            if b.get("type") != 0:
                continue
            for line in b.get("lines", []):
                spans = line.get("spans", [])
                if not spans:
                    continue
                line_text = "".join(s.get("text", "") for s in spans).strip()
                if not line_text:
                    continue
                max_size = max((s.get("size", 11) for s in spans), default=11)
                if max_size >= 16:
                    md_parts.append(f"### {line_text}\n")
                else:
                    md_parts.append(f"{line_text}\n")

    doc.close()
    output = io.BytesIO("\n".join(md_parts).encode("utf-8"))
    output.seek(0)
    return output


# NEW CONVERTER 4: PDF to Standalone Responsive HTML5 (.HTML)
def pdf_to_html_stream(pdf_bytes: bytes) -> io.BytesIO:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    html_pages = []

    for idx, page in enumerate(doc):
        raw_text = page.get_text("text").strip()
        paragraphs = [
            f"<p>{html.escape(p.strip())}</p>"
            for p in raw_text.split("\n\n")
            if p.strip()
        ]
        body_html = "\n".join(paragraphs) if paragraphs else "<p><em>(Visual / Image Page)</em></p>"
        html_pages.append(
            f'<section class="page"><div class="page-badge">PAGE {idx + 1}</div>{body_html}</section>'
        )

    doc.close()
    full_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>DocuForge HTML Export</title>
<style>
  body {{ font-family: system-ui, -apple-system, sans-serif; background: #F4F4F5; color: #18181B; margin: 0; padding: 32px 16px; line-height: 1.65; }}
  .container {{ max-width: 820px; margin: 0 auto; }}
  .page {{ background: #FFFFFF; border: 1px solid #E4E4E7; border-radius: 10px; padding: 36px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }}
  .page-badge {{ font-family: monospace; font-size: 11px; color: #71717A; border-bottom: 1px solid #F4F4F5; padding-bottom: 8px; margin-bottom: 16px; }}
  p {{ margin: 0 0 14px 0; white-space: pre-wrap; }}
</style>
</head>
<body>
  <div class="container">
    {"".join(html_pages)}
  </div>
</body>
</html>"""
    output = io.BytesIO(full_html.encode("utf-8"))
    output.seek(0)
    return output


# NEW CONVERTER 5: PDF to Plain Text (.TXT)
def pdf_to_txt_stream(pdf_bytes: bytes) -> io.BytesIO:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    txt_chunks = []
    for idx, page in enumerate(doc):
        txt_chunks.append(f"=== PAGE {idx + 1} ===\n{page.get_text('text').strip()}\n")
    doc.close()
    output = io.BytesIO("\n".join(txt_chunks).encode("utf-8"))
    output.seek(0)
    return output