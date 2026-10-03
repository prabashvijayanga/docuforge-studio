import fitz  # PyMuPDF
from PIL import Image
from pdf2docx import Converter
import io
import zipfile
import json
import tempfile
import os
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

    # C-speed native page selection & reordering
    selected_indices = [int(op["originalIndex"]) for op in valid_ops]
    doc.select(selected_indices)

    clean_wm = watermark_text.strip()
    for idx, op in enumerate(valid_ops):
        page = doc[idx]
        add_rot = int(op.get("rotation", 0))
        if add_rot != 0:
            page.set_rotation((page.rotation + add_rot) % 360)

        # Fixed 45-degree diagonal watermark using PyMuPDF Morph Matrix (No rotate=45 error!)
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