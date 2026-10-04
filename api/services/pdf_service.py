import fitz  # PyMuPDF
from PIL import Image
from pdf2docx import Converter
from pptx import Presentation
from pptx.util import Inches
from pptx.enum.shapes import MSO_SHAPE_TYPE
import openpyxl
from openpyxl.styles import Font, PatternFill
import docx
import io
import zipfile
import json
import tempfile
import os
import html
import re
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


# ==============================================================================
# DIRECTION 1: PDF TO OTHER FORMATS (7 CONVERTERS)
# ==============================================================================

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


def pdf_to_pptx_stream(pdf_bytes: bytes, dpi: int = 150) -> io.BytesIO:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    for page in doc:
        slide = prs.slides.add_slide(blank_layout)
        pix = page.get_pixmap(dpi=dpi)
        img_bytes = io.BytesIO(pix.tobytes("png"))

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

        page_text = page.get_text("text").strip()
        if page_text:
            notes_slide = slide.notes_slide
            notes_slide.notes_text_frame.text = page_text

    doc.close()
    output = io.BytesIO()
    prs.save(output)
    output.seek(0)
    return output


def pdf_to_excel_xlsx(pdf_bytes: bytes) -> io.BytesIO:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    wb = openpyxl.Workbook()
    wb.remove(wb.active)

    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="18181B", end_color="18181B", fill_type="solid")

    for idx, page in enumerate(doc):
        ws = wb.create_sheet(title=f"Page_{idx + 1}")
        row_cursor = 1

        tables_found = False
        try:
            tabs = page.find_tables()
            if tabs and tabs.tables:
                tables_found = True
                for table in tabs.tables:
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

        if not tables_found:
            ws.append([f"Page {idx + 1} Extracted Content"])
            ws.cell(row=1, column=1).font = header_font
            ws.cell(row=1, column=1).fill = header_fill
            lines = page.get_text("text").splitlines()
            for line in lines:
                if line.strip():
                    cols = [c.strip() for c in line.split("  ") if c.strip()]
                    ws.append(cols if len(cols) > 1 else [line.strip()])

    if len(wb.sheetnames) == 0:
        wb.create_sheet(title="Empty_PDF")

    doc.close()
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output


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


def pdf_to_txt_stream(pdf_bytes: bytes) -> io.BytesIO:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    txt_chunks = []
    for idx, page in enumerate(doc):
        txt_chunks.append(f"=== PAGE {idx + 1} ===\n{page.get_text('text').strip()}\n")
    doc.close()
    output = io.BytesIO("\n".join(txt_chunks).encode("utf-8"))
    output.seek(0)
    return output


# ==============================================================================
# DIRECTION 2: REVERSE CONVERTERS — ANY FILE TO PDF (DOCX, PPTX, XLSX, MD, HTML, TXT)
# ==============================================================================

def render_html_story_to_pdf(html_content: str, page_w: float = 595.0, page_h: float = 842.0) -> io.BytesIO:
    """Uses PyMuPDF's native C++ Story layout engine to paginate HTML/CSS into a crisp multi-page PDF."""
    css = """
    body { font-family: sans-serif; font-size: 11pt; line-height: 1.5; color: #18181B; }
    h1 { font-size: 20pt; font-weight: bold; color: #09090B; margin-bottom: 10pt; border-bottom: 1px solid #E4E4E7; padding-bottom: 4pt; }
    h2 { font-size: 15pt; font-weight: bold; color: #18181B; margin-top: 12pt; margin-bottom: 6pt; }
    h3 { font-size: 12.5pt; font-weight: bold; color: #27272A; margin-top: 10pt; margin-bottom: 4pt; }
    p { margin-bottom: 8pt; }
    table { width: 100%; border-collapse: collapse; margin-top: 8pt; margin-bottom: 12pt; font-size: 9.5pt; }
    th { background-color: #18181B; color: #FFFFFF; font-weight: bold; padding: 6pt; border: 1px solid #27272A; text-align: left; }
    td { padding: 5pt; border: 1px solid #D4D4D8; color: #27272A; }
    pre, code { font-family: monospace; background-color: #F4F4F5; padding: 4pt; font-size: 9.5pt; }
    """
    try:
        story = fitz.Story(html=html_content, user_css=css)
        writer_buf = io.BytesIO()
        writer = fitz.DocumentWriter(writer_buf)
        mediabox = fitz.Rect(0, 0, page_w, page_h)
        where = mediabox + (42, 42, -42, -42)

        more = 1
        while more:
            device = writer.begin_page(mediabox)
            more, _ = story.place(where)
            story.draw(device)
            writer.end_page()
        writer.close()
        writer_buf.seek(0)
        return writer_buf
    except Exception:
        # Fallback simple text pagination if Story fails
        plain = re.sub(r"<[^>]+>", "", html_content)
        return txt_to_pdf_stream(plain.encode("utf-8"))


# 1. WORD (.DOCX) TO PDF
def docx_to_pdf_stream(docx_bytes: bytes) -> io.BytesIO:
    document = docx.Document(io.BytesIO(docx_bytes))
    html_parts = ["<html><body>"]

    for para in document.paragraphs:
        text = html.escape(para.text.strip())
        if not text:
            continue
        style_name = (para.style.name or "").lower()
        if "heading 1" in style_name or "title" in style_name:
            html_parts.append(f"<h1>{text}</h1>")
        elif "heading 2" in style_name:
            html_parts.append(f"<h2>{text}</h2>")
        elif "heading" in style_name:
            html_parts.append(f"<h3>{text}</h3>")
        elif "list" in style_name:
            html_parts.append(f"<p>• {text}</p>")
        else:
            html_parts.append(f"<p>{text}</p>")

    for table in document.tables:
        html_parts.append("<table>")
        for r_idx, row in enumerate(table.rows):
            html_parts.append("<tr>")
            tag = "th" if r_idx == 0 else "td"
            for cell in row.cells:
                cell_txt = html.escape(cell.text.strip())
                html_parts.append(f"<{tag}>{cell_txt}</{tag}>")
            html_parts.append("</tr>")
        html_parts.append("</table>")

    html_parts.append("</body></html>")
    return render_html_story_to_pdf("\n".join(html_parts))


# 2. POWERPOINT (.PPTX) TO PDF (16:9 Widescreen Slide Renderer)
def pptx_to_pdf_stream(pptx_bytes: bytes) -> io.BytesIO:
    prs = Presentation(io.BytesIO(pptx_bytes))
    pdf_doc = fitz.open()

    # Widescreen 16:9 points (960 x 540 pt)
    slide_w, slide_h = 960.0, 540.0
    emu_w = float(prs.slide_width or 12192000)
    emu_h = float(prs.slide_height or 6858000)

    for s_idx, slide in enumerate(prs.slides):
        page = pdf_doc.new_page(width=slide_w, height=slide_h)

        # Slide subtle border & footer badge
        page.draw_rect(fitz.Rect(0, 0, slide_w, slide_h), color=(0.9, 0.9, 0.9), fill=(1, 1, 1))
        page.insert_text(
            fitz.Point(slide_w - 90, slide_h - 18),
            f"SLIDE {s_idx + 1}",
            fontsize=9,
            color=(0.6, 0.6, 0.6),
        )

        fallback_y = 54.0
        for shape in slide.shapes:
            # Convert EMU coordinates to PDF points
            x0 = max(28.0, (float(shape.left or 0) / emu_w) * slide_w)
            y0 = max(28.0, (float(shape.top or 0) / emu_h) * slide_h)
            w = max(80.0, (float(shape.width or 0) / emu_w) * slide_w)
            h = max(40.0, (float(shape.height or 0) / emu_h) * slide_h)
            target_rect = fitz.Rect(x0, y0, min(slide_w - 28, x0 + w), min(slide_h - 28, y0 + h))

            # Render embedded slide images
            if shape.shape_type == MSO_SHAPE_TYPE.PICTURE:
                try:
                    img_blob = shape.image.blob
                    page.insert_image(target_rect, stream=img_blob)
                except Exception:
                    pass

            # Render slide text frames
            if shape.has_text_frame:
                full_text = shape.text_frame.text.strip()
                if not full_text:
                    continue
                is_title = shape == slide.shapes.title or y0 < 110
                f_size = 24 if is_title else 14
                f_color = (0.06, 0.06, 0.08) if is_title else (0.2, 0.2, 0.24)

                placed = page.insert_textbox(
                    target_rect,
                    full_text,
                    fontsize=f_size,
                    color=f_color,
                )
                if placed < 0:
                    # Fallback if textbox overflowed
                    page.insert_textbox(
                        fitz.Rect(48, fallback_y, slide_w - 48, slide_h - 36),
                        full_text,
                        fontsize=12,
                        color=f_color,
                    )
                    fallback_y = min(slide_h - 80, fallback_y + 70)

    output = io.BytesIO()
    pdf_doc.save(output, garbage=2, deflate=True)
    pdf_doc.close()
    output.seek(0)
    return output


# 3. EXCEL (.XLSX) TO PDF (Landscape Data Grid Renderer)
def xlsx_to_pdf_stream(xlsx_bytes: bytes) -> io.BytesIO:
    wb = openpyxl.load_workbook(io.BytesIO(xlsx_bytes), data_only=True)
    html_parts = ["<html><body>"]

    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        html_parts.append(f"<h2>Sheet: {html.escape(sheet_name)}</h2>")
        html_parts.append("<table>")

        rows = list(ws.iter_rows(values_only=True))
        # Filter out completely empty rows
        non_empty_rows = [r for r in rows if any(cell is not None and str(cell).strip() != "" for cell in r)]

        for r_idx, row in enumerate(non_empty_rows[:250]):
            html_parts.append("<tr>")
            tag = "th" if r_idx == 0 else "td"
            for cell in row[:15]:
                val = "" if cell is None else html.escape(str(cell))
                html_parts.append(f"<{tag}>{val}</{tag}>")
            html_parts.append("</tr>")

        html_parts.append("</table>")

    html_parts.append("</body></html>")
    # Render in Landscape A4 (842 x 595 pt) for wide spreadsheet columns
    return render_html_story_to_pdf("\n".join(html_parts), page_w=842.0, page_h=595.0)


# 4. MARKDOWN (.MD) TO PDF
def md_to_pdf_stream(md_bytes: bytes) -> io.BytesIO:
    text = md_bytes.decode("utf-8", errors="replace")
    html_lines = ["<html><body>"]

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("# "):
            html_lines.append(f"<h1>{html.escape(line[2:])}</h1>")
        elif line.startswith("## "):
            html_lines.append(f"<h2>{html.escape(line[3:])}</h2>")
        elif line.startswith("### "):
            html_lines.append(f"<h3>{html.escape(line[4:])}</h3>")
        elif line.startswith(("- ", "* ")):
            html_lines.append(f"<p>• {html.escape(line[2:])}</p>")
        else:
            html_lines.append(f"<p>{html.escape(line)}</p>")

    html_lines.append("</body></html>")
    return render_html_story_to_pdf("\n".join(html_lines))


# 5. HTML (.HTML) TO PDF
def html_to_pdf_stream(html_bytes: bytes) -> io.BytesIO:
    raw_html = html_bytes.decode("utf-8", errors="replace")
    return render_html_story_to_pdf(raw_html)


# 6. PLAIN TEXT (.TXT) TO PDF
def txt_to_pdf_stream(txt_bytes: bytes) -> io.BytesIO:
    text = txt_bytes.decode("utf-8", errors="replace")
    pdf_doc = fitz.open()
    a4_w, a4_h = 595.0, 842.0
    margin = 48.0
    line_height = 16.0

    lines = []
    for paragraph in text.splitlines():
        if not paragraph.strip():
            lines.append("")
            continue
        # Wrap long lines to 82 chars
        while len(paragraph) > 82:
            lines.append(paragraph[:82])
            paragraph = paragraph[82:]
        lines.append(paragraph)

    page = pdf_doc.new_page(width=a4_w, height=a4_h)
    y = margin
    for line in lines:
        if y > a4_h - margin:
            page = pdf_doc.new_page(width=a4_w, height=a4_h)
            y = margin
        page.insert_text(fitz.Point(margin, y), line, fontsize=10.5, color=(0.1, 0.1, 0.12))
        y += line_height

    output = io.BytesIO()
    pdf_doc.save(output, garbage=2, deflate=True)
    pdf_doc.close()
    output.seek(0)
    return output