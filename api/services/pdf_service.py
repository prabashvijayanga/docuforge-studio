import fitz  # PyMuPDF
from PIL import Image
from pdf2docx import Converter
from pptx import Presentation
from pptx.util import Inches
from pptx.enum.shapes import MSO_SHAPE_TYPE
from pptx.enum.text import PP_ALIGN
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
import base64
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
            try:
                notes_slide = slide.notes_slide
                notes_slide.notes_text_frame.text = page_text
            except Exception:
                pass

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
# DIRECTION 2: HIGH-FIDELITY ORIGINAL LAYOUT REVERSE CONVERTERS (ANY -> PDF)
# ==============================================================================

def render_html_story_to_pdf(
    html_content: str,
    archive: fitz.Archive = None,
    page_w: float = 595.0,
    page_h: float = 842.0
) -> io.BytesIO:
    css = """
    body { font-family: sans-serif; font-size: 11pt; line-height: 1.5; color: #18181B; }
    h1 { font-size: 18pt; font-weight: bold; color: #09090B; margin-bottom: 8pt; }
    h2 { font-size: 14pt; font-weight: bold; color: #18181B; margin-top: 10pt; margin-bottom: 6pt; }
    h3 { font-size: 12pt; font-weight: bold; color: #27272A; margin-top: 8pt; margin-bottom: 4pt; }
    p { margin-top: 0; margin-bottom: 7pt; }
    table { width: 100%; border-collapse: collapse; margin-top: 8pt; margin-bottom: 12pt; font-size: 9.5pt; }
    th { background-color: #18181B; color: #FFFFFF; font-weight: bold; padding: 5pt; border: 1px solid #27272A; text-align: left; }
    td { padding: 5pt; border: 1px solid #D4D4D8; color: #27272A; }
    img { max-width: 480pt; height: auto; margin-top: 6pt; margin-bottom: 6pt; }
    """
    try:
        story = fitz.Story(html=html_content, user_css=css, archive=archive) if archive else fitz.Story(html=html_content, user_css=css)
        writer_buf = io.BytesIO()
        writer = fitz.DocumentWriter(writer_buf)
        mediabox = fitz.Rect(0, 0, page_w, page_h)
        where = mediabox + (38, 38, -38, -38)

        more = 1
        page_guard = 0
        while more and page_guard < 500:
            page_guard += 1
            device = writer.begin_page(mediabox)
            more, _ = story.place(where)
            story.draw(device)
            writer.end_page()
        writer.close()
        writer_buf.seek(0)
        return writer_buf
    except Exception:
        plain = re.sub(r"<[^>]+>", "", html_content)
        return txt_to_pdf_stream(plain.encode("utf-8", errors="ignore"))


def extract_legacy_binary_office_text(raw_bytes: bytes, title_label: str = "Legacy Office Document") -> io.BytesIO:
    utf16_matches = re.findall(b"(?:[\x20-\x7E\r\n\t]\x00){5,}", raw_bytes)
    extracted_blocks = []
    for m in utf16_matches:
        try:
            s = m.decode("utf-16le", errors="ignore").strip()
            if len(s) >= 4 and not any(
                kw in s for kw in ("Root Entry", "PowerPoint Document", "WordDocument", "SummaryInformation", "Calibri", "Arial")
            ):
                extracted_blocks.append(s)
        except Exception:
            continue

    if len(extracted_blocks) < 5:
        ascii_matches = re.findall(b"[\x20-\x7E\r\n]{8,}", raw_bytes)
        for m in ascii_matches:
            s = m.decode("latin-1", errors="ignore").strip()
            if len(s) >= 8 and not any(
                kw in s for kw in ("Root Entry", "Microsoft", "xml", "theme", "Content_Types")
            ):
                extracted_blocks.append(s)

    html_parts = [f"<html><body><h1>{html.escape(title_label)}</h1>"]
    if extracted_blocks:
        for block in extracted_blocks[:800]:
            for line in block.splitlines():
                clean_line = line.strip()
                if len(clean_line) > 1:
                    html_parts.append(f"<p>{html.escape(clean_line)}</p>")
    else:
        html_parts.append("<p>No readable text stream found in binary file.</p>")

    html_parts.append("</body></html>")
    return render_html_story_to_pdf("\n".join(html_parts))


# 1. WORD (.DOCX) TO PDF — Preserves Original Inline Images, Colors, Bold/Italics & Tables!
def docx_to_pdf_stream(docx_bytes: bytes) -> io.BytesIO:
    if not docx_bytes.startswith(b"PK"):
        return extract_legacy_binary_office_text(docx_bytes, "Word Document (.DOC)")

    try:
        document = docx.Document(io.BytesIO(docx_bytes))
    except Exception:
        return extract_legacy_binary_office_text(docx_bytes, "Word Document")

    archive = fitz.Archive()
    img_counter = 0
    html_parts = ["<html><body>"]

    # Map relationship IDs to image blobs inside the DOCX package
    rel_images = {}
    try:
        for rel_id, rel in document.part.rels.items():
            if "image" in rel.reltype:
                pil_img = Image.open(io.BytesIO(rel.target_part.blob))
                if pil_img.mode not in ("RGB", "RGBA"):
                    pil_img = pil_img.convert("RGB")
                buf = io.BytesIO()
                pil_img.save(buf, format="PNG")
                img_name = f"img_{rel_id}.png"
                archive.add(buf.getvalue(), img_name)
                rel_images[rel_id] = img_name
    except Exception:
        pass

    for para in document.paragraphs:
        # Check for inline images inside this paragraph's XML
        para_xml = para._p.xml
        embedded_rids = re.findall(r'r:embed="([^"]+)"', para_xml)
        for rid in embedded_rids:
            if rid in rel_images:
                html_parts.append(f'<div><img src="{rel_images[rid]}" /></div>')

        # Build styled HTML runs (preserving bold, italic, underline, font color)
        run_html_list = []
        for run in para.runs:
            t = html.escape(run.text)
            if not t:
                continue
            if run.bold:
                t = f"<b>{t}</b>"
            if run.italic:
                t = f"<i>{t}</i>"
            if run.underline:
                t = f"<u>{t}</u>"
            try:
                if run.font and run.font.color and run.font.color.rgb:
                    hex_col = str(run.font.color.rgb)
                    t = f'<span style="color:#{hex_col};">{t}</span>'
            except Exception:
                pass
            run_html_list.append(t)

        para_inner = "".join(run_html_list).strip()
        if not para_inner:
            continue

        style_name = (para.style.name or "").lower() if para.style else ""
        if "heading 1" in style_name or "title" in style_name:
            html_parts.append(f"<h1>{para_inner}</h1>")
        elif "heading 2" in style_name:
            html_parts.append(f"<h2>{para_inner}</h2>")
        elif "heading" in style_name:
            html_parts.append(f"<h3>{para_inner}</h3>")
        elif "list" in style_name:
            html_parts.append(f"<p>• {para_inner}</p>")
        else:
            html_parts.append(f"<p>{para_inner}</p>")

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
    return render_html_story_to_pdf("\n".join(html_parts), archive=archive)


# Helper: Extract RGB tuple (0..1) safely from a PPTX ColorFormat
def _get_pptx_rgb(color_fmt, default_rgb=None):
    try:
        if color_fmt and color_fmt.rgb:
            rgb_val = color_fmt.rgb
            return (rgb_val[0] / 255.0, rgb_val[1] / 255.0, rgb_val[2] / 255.0)
    except Exception:
        pass
    return default_rgb


# Recursive Exact-Position PPTX Shape Renderer (Preserves exact coordinates, images, background boxes, tables & fonts!)
def _render_pptx_shape_exact(page: fitz.Page, shape, scale_x: float, scale_y: float, slide_w: float, slide_h: float, offset_x: float = 0.0, offset_y: float = 0.0):
    try:
        # Handle Grouped Shapes recursively
        if shape.shape_type == MSO_SHAPE_TYPE.GROUP:
            for sub in shape.shapes:
                _render_pptx_shape_exact(page, sub, scale_x, scale_y, slide_w, slide_h, offset_x, offset_y)
            return
    except Exception:
        pass

    # Compute exact PDF bounding box from original PowerPoint EMU coordinates
    x0 = max(0.0, float(getattr(shape, "left", 0) or 0) * scale_x + offset_x)
    y0 = max(0.0, float(getattr(shape, "top", 0) or 0) * scale_y + offset_y)
    w = max(12.0, float(getattr(shape, "width", 0) or 0) * scale_x)
    h = max(12.0, float(getattr(shape, "height", 0) or 0) * scale_y)

    x1 = min(slide_w, x0 + w)
    y1 = min(slide_h, y0 + h)
    if x1 <= x0 + 2 or y1 <= y0 + 2:
        return
    rect = fitz.Rect(x0, y0, x1, y1)

    # 1. Draw Shape Fill Color if solid fill exists
    bg_rgb = None
    try:
        if hasattr(shape, "fill") and shape.fill.type == 1:  # MSO_FILL.SOLID
            bg_rgb = _get_pptx_rgb(shape.fill.fore_color)
            if bg_rgb:
                page.draw_rect(rect, color=bg_rgb, fill=bg_rgb)
    except Exception:
        pass

    # 2. Draw Exact Picture / Diagram at its original slide coordinates
    try:
        if shape.shape_type == MSO_SHAPE_TYPE.PICTURE or hasattr(shape, "image"):
            blob = shape.image.blob
            pil_img = Image.open(io.BytesIO(blob))
            if pil_img.mode not in ("RGB", "RGBA"):
                pil_img = pil_img.convert("RGB")
            img_buf = io.BytesIO()
            pil_img.save(img_buf, format="PNG")
            page.insert_image(rect, stream=img_buf.getvalue(), keep_proportion=False)
            return
    except Exception:
        pass

    # 3. Draw Table at its exact slide position
    try:
        if getattr(shape, "has_table", False):
            html_tbl = ["<html><body style='margin:0;padding:0;'><table style='width:100%;border-collapse:collapse;font-family:sans-serif;font-size:10pt;'>"]
            for r_i, r in enumerate(shape.table.rows):
                html_tbl.append("<tr>")
                for c in r.cells:
                    cell_text = html.escape(c.text.strip())
                    bg = "#18181B" if r_i == 0 else "#FFFFFF"
                    fg = "#FFFFFF" if r_i == 0 else "#18181B"
                    fw = "bold" if r_i == 0 else "normal"
                    html_tbl.append(
                        f"<td style='background:{bg};color:{fg};font-weight:{fw};padding:4pt;border:1px solid #D4D4D8;'>{cell_text}</td>"
                    )
                html_tbl.append("</tr>")
            html_tbl.append("</table></body></html>")

            story = fitz.Story(html="".join(html_tbl))
            writer_buf = io.BytesIO()
            writer = fitz.DocumentWriter(writer_buf)
            mediabox = fitz.Rect(0, 0, slide_w, slide_h)
            device = writer.begin_page(mediabox)
            story.place(rect)
            story.draw(device)
            writer.end_page()
            writer.close()
            writer_buf.seek(0)

            tmp_pdf = fitz.open(stream=writer_buf.read(), filetype="pdf")
            page.show_pdf_page(mediabox, tmp_pdf, 0)
            tmp_pdf.close()
            return
    except Exception:
        pass

    # 4. Draw Text Frame at its exact slide position with original font sizes, colors & alignments
    try:
        if getattr(shape, "has_text_frame", False):
            tf = shape.text_frame
            if not tf.text.strip():
                return

            # Default text color: white if shape has a dark solid background, otherwise dark
            default_hex = "#18181B"
            if bg_rgb and (bg_rgb[0] + bg_rgb[1] + bg_rgb[2]) / 3.0 < 0.45:
                default_hex = "#FFFFFF"

            is_title_box = y0 < (slide_h * 0.18)
            p_html_list = []

            for p in tf.paragraphs:
                if not p.text.strip():
                    continue

                align_css = "left"
                if p.alignment == PP_ALIGN.CENTER:
                    align_css = "center"
                elif p.alignment == PP_ALIGN.RIGHT:
                    align_css = "right"

                runs_html = []
                max_pt = 22.0 if is_title_box else 13.5

                for run in p.runs:
                    rt = html.escape(run.text)
                    if not rt:
                        continue
                    try:
                        if run.font and run.font.size:
                            max_pt = max(8.0, min(44.0, float(run.font.size.pt) * 0.85))
                    except Exception:
                        pass

                    col_hex = default_hex
                    try:
                        if run.font and run.font.color and run.font.color.rgb:
                            col_hex = f"#{run.font.color.rgb}"
                    except Exception:
                        pass

                    if getattr(run.font, "bold", False) or is_title_box:
                        rt = f"<b>{rt}</b>"
                    if getattr(run.font, "italic", False):
                        rt = f"<i>{rt}</i>"

                    runs_html.append(f'<span style="color:{col_hex};font-size:{max_pt:.1f}pt;">{rt}</span>')

                if not runs_html:
                    clean_p = html.escape(p.text.strip())
                    weight = "bold" if is_title_box else "normal"
                    runs_html.append(
                        f'<span style="color:{default_hex};font-size:{max_pt:.1f}pt;font-weight:{weight};">{clean_p}</span>'
                    )

                bullet_prefix = "• " if getattr(p, "level", 0) > 0 else ""
                p_html_list.append(
                    f'<p style="text-align:{align_css};margin-top:0;margin-bottom:4pt;line-height:1.25;">{bullet_prefix}{"".join(runs_html)}</p>'
                )

            if p_html_list:
                box_html = f"<html><body style='margin:0;padding:0;font-family:sans-serif;'>{''.join(p_html_list)}</body></html>"
                story = fitz.Story(html=box_html)
                writer_buf = io.BytesIO()
                writer = fitz.DocumentWriter(writer_buf)
                mediabox = fitz.Rect(0, 0, slide_w, slide_h)
                device = writer.begin_page(mediabox)
                # Allow slight bottom expansion so tight textboxes never clip
                place_rect = fitz.Rect(rect.x0, rect.y0, rect.x1, min(slide_h - 8, rect.y1 + 36))
                story.place(place_rect)
                story.draw(device)
                writer.end_page()
                writer.close()
                writer_buf.seek(0)

                tmp_pdf = fitz.open(stream=writer_buf.read(), filetype="pdf")
                page.show_pdf_page(mediabox, tmp_pdf, 0)
                tmp_pdf.close()
    except Exception:
        pass


# 2. POWERPOINT (.PPTX & .PPT) TO PDF — 1:1 Coordinate & Visual Fidelity Engine
def pptx_to_pdf_stream(pptx_bytes: bytes) -> io.BytesIO:
    if not pptx_bytes.startswith(b"PK"):
        return extract_legacy_binary_office_text(pptx_bytes, "Presentation Slides (.PPT)")

    try:
        prs = Presentation(io.BytesIO(pptx_bytes))
    except Exception:
        return extract_legacy_binary_office_text(pptx_bytes, "Presentation Slides")

    pdf_doc = fitz.open()

    emu_w = float(prs.slide_width or 9144000)
    emu_h = float(prs.slide_height or 6858000)
    # 1 inch = 914400 EMUs = 72 PDF points -> 12700 EMUs per PDF point
    slide_w = emu_w / 12700.0
    slide_h = emu_h / 12700.0
    scale_x = slide_w / emu_w
    scale_y = slide_h / emu_h

    for slide in prs.slides:
        page = pdf_doc.new_page(width=slide_w, height=slide_h)

        # Render solid slide background color if specified
        bg_drawn = False
        try:
            if slide.background and slide.background.fill and slide.background.fill.type == 1:
                bg_col = _get_pptx_rgb(slide.background.fill.fore_color)
                if bg_col:
                    page.draw_rect(fitz.Rect(0, 0, slide_w, slide_h), color=bg_col, fill=bg_col)
                    bg_drawn = True
        except Exception:
            pass

        if not bg_drawn:
            page.draw_rect(fitz.Rect(0, 0, slide_w, slide_h), color=(1, 1, 1), fill=(1, 1, 1))

        # Render every shape in exact Z-order at its original X, Y coordinates!
        for shape in slide.shapes:
            _render_pptx_shape_exact(page, shape, scale_x, scale_y, slide_w, slide_h)

    if len(pdf_doc) == 0:
        pdf_doc.new_page(width=slide_w, height=slide_h)

    output = io.BytesIO()
    pdf_doc.save(output, garbage=2, deflate=True)
    pdf_doc.close()
    output.seek(0)
    return output


# 3. EXCEL (.XLSX & .XLS) TO PDF
def xlsx_to_pdf_stream(xlsx_bytes: bytes) -> io.BytesIO:
    if not xlsx_bytes.startswith(b"PK"):
        return extract_legacy_binary_office_text(xlsx_bytes, "Spreadsheet (.XLS)")

    try:
        wb = openpyxl.load_workbook(io.BytesIO(xlsx_bytes), data_only=True)
    except Exception:
        return extract_legacy_binary_office_text(xlsx_bytes, "Spreadsheet")

    html_parts = ["<html><body>"]
    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        html_parts.append(f"<h2>Sheet: {html.escape(sheet_name)}</h2>")
        html_parts.append("<table>")

        rows = list(ws.iter_rows(values_only=True))
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
    html_lines = ["<html><body>"]
    for line in text.splitlines():
        if line.strip():
            html_lines.append(f"<p>{html.escape(line)}</p>")
    html_lines.append("</body></html>")
    return render_html_story_to_pdf("\n".join(html_lines))