import os
import logging
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from typing import List
from PIL import Image
from api.services.pdf_service import (
    process_organize_pdf,
    convert_images_to_pdf,
    merge_multiple_pdfs,
    compress_pdf_stream,
    pdf_to_images_zip,
    pdf_to_word_docx,
    pdf_to_pptx_stream,
    pdf_to_excel_xlsx,
    pdf_to_markdown_md,
    pdf_to_html_stream,
    pdf_to_txt_stream,
    docx_to_pdf_stream,
    pptx_to_pdf_stream,
    xlsx_to_pdf_stream,
    md_to_pdf_stream,
    html_to_pdf_stream,
    txt_to_pdf_stream,
)

Image.MAX_IMAGE_PIXELS = 100_000_000
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB max
MAX_FILES_COUNT = 30
ALLOWED_IMAGE_MIMES = {"image/jpeg", "image/png", "image/webp"}

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("docuforge-security")

is_prod = os.getenv("NODE_ENV") == "production"
app = FastAPI(
    docs_url=None if is_prod else "/api/py/docs",
    openapi_url=None if is_prod else "/api/py/openapi.json",
)

allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
if os.getenv("NEXT_PUBLIC_SITE_URL"):
    allowed_origins.append(os.getenv("NEXT_PUBLIC_SITE_URL", ""))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


async def read_and_validate_pdf(upload: UploadFile) -> bytes:
    data = await upload.read(MAX_FILE_SIZE_BYTES + 1)
    if len(data) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds the 50MB security limit.")
    if not data.startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="Invalid PDF file signature.")
    return data


async def read_and_validate_image(upload: UploadFile) -> bytes:
    if upload.content_type not in ALLOWED_IMAGE_MIMES:
        raise HTTPException(status_code=400, detail="Only JPG, PNG, and WebP images are allowed.")
    data = await upload.read(MAX_FILE_SIZE_BYTES + 1)
    if len(data) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="Image exceeds the 50MB security limit.")
    return data


@app.get("/api/py/health")
def health_check():
    return {"status": "online", "engine": "PyMuPDF Bi-Directional Multi-Converter Engine"}


@app.post("/api/py/organize")
async def organize_endpoint(
    file: UploadFile = File(...),
    operations: str = Form(""),
    watermark: str = Form(""),
    compress_level: str = Form("none"),
):
    try:
        pdf_bytes = await read_and_validate_pdf(file)
        safe_watermark = watermark[:60] if watermark else ""
        out = process_organize_pdf(pdf_bytes, operations, safe_watermark, compress_level)
        return StreamingResponse(
            out,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=organized.pdf"},
        )
    except HTTPException:
        raise
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Organize error: {e}")
        raise HTTPException(status_code=500, detail="Failed to process PDF document.")


@app.post("/api/py/images-to-pdf")
async def images_to_pdf_endpoint(
    files: List[UploadFile] = File(...),
    page_size: str = Form("A4"),
    margin: int = Form(24),
):
    if len(files) > MAX_FILES_COUNT:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_FILES_COUNT} images allowed.")
    try:
        safe_margin = max(0, min(margin, 100))
        safe_page_size = "FIT" if page_size == "FIT" else "A4"
        items = [(f.filename or "img", await read_and_validate_image(f)) for f in files]
        out = convert_images_to_pdf(items, page_size=safe_page_size, margin=safe_margin)
        return StreamingResponse(
            out,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=images_combined.pdf"},
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Images-to-PDF error: {e}")
        raise HTTPException(status_code=500, detail="Failed to compile images into PDF.")


@app.post("/api/py/merge")
async def merge_endpoint(files: List[UploadFile] = File(...)):
    if len(files) > MAX_FILES_COUNT:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_FILES_COUNT} PDFs allowed.")
    try:
        raw_list = [await read_and_validate_pdf(f) for f in files]
        out = merge_multiple_pdfs(raw_list)
        return StreamingResponse(
            out,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=merged_document.pdf"},
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Merge error: {e}")
        raise HTTPException(status_code=500, detail="Failed to merge PDF files.")


@app.post("/api/py/compress")
async def compress_endpoint(
    file: UploadFile = File(...),
    level: str = Form("recommended"),
):
    try:
        pdf_bytes = await read_and_validate_pdf(file)
        safe_level = level if level in ("light", "recommended", "extreme") else "recommended"
        out = compress_pdf_stream(pdf_bytes, level=safe_level)
        return StreamingResponse(
            out,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=compressed.pdf"},
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Compress error: {e}")
        raise HTTPException(status_code=500, detail="Failed to compress PDF file.")


@app.post("/api/py/pdf-to-images")
async def pdf_to_images_endpoint(
    file: UploadFile = File(...),
    dpi: int = Form(150),
):
    try:
        pdf_bytes = await read_and_validate_pdf(file)
        safe_dpi = max(72, min(dpi, 300))
        out = pdf_to_images_zip(pdf_bytes, dpi=safe_dpi)
        return StreamingResponse(
            out,
            media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=extracted_pages.zip"},
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"PDF-to-Images error: {e}")
        raise HTTPException(status_code=500, detail="Failed to render PDF pages to images.")


@app.post("/api/py/pdf-to-word")
async def pdf_to_word_endpoint(file: UploadFile = File(...)):
    try:
        pdf_bytes = await read_and_validate_pdf(file)
        out = pdf_to_word_docx(pdf_bytes)
        return StreamingResponse(
            out,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": "attachment; filename=converted_document.docx"},
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"PDF-to-Word error: {e}")
        raise HTTPException(status_code=500, detail="Failed to convert PDF to Word document.")


@app.post("/api/py/pdf-to-pptx")
async def pdf_to_pptx_endpoint(file: UploadFile = File(...)):
    try:
        pdf_bytes = await read_and_validate_pdf(file)
        out = pdf_to_pptx_stream(pdf_bytes, dpi=150)
        return StreamingResponse(
            out,
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            headers={"Content-Disposition": "attachment; filename=presentation.pptx"},
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"PDF-to-PPTX error: {e}")
        raise HTTPException(status_code=500, detail="Failed to convert PDF to PowerPoint.")


@app.post("/api/py/pdf-to-excel")
async def pdf_to_excel_endpoint(file: UploadFile = File(...)):
    try:
        pdf_bytes = await read_and_validate_pdf(file)
        out = pdf_to_excel_xlsx(pdf_bytes)
        return StreamingResponse(
            out,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=extracted_tables.xlsx"},
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"PDF-to-Excel error: {e}")
        raise HTTPException(status_code=500, detail="Failed to convert PDF to Excel spreadsheet.")


@app.post("/api/py/pdf-to-md")
async def pdf_to_md_endpoint(file: UploadFile = File(...)):
    try:
        pdf_bytes = await read_and_validate_pdf(file)
        out = pdf_to_markdown_md(pdf_bytes)
        return StreamingResponse(
            out,
            media_type="text/markdown; charset=utf-8",
            headers={"Content-Disposition": "attachment; filename=document.md"},
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"PDF-to-Markdown error: {e}")
        raise HTTPException(status_code=500, detail="Failed to convert PDF to Markdown.")


@app.post("/api/py/pdf-to-html")
async def pdf_to_html_endpoint(file: UploadFile = File(...)):
    try:
        pdf_bytes = await read_and_validate_pdf(file)
        out = pdf_to_html_stream(pdf_bytes)
        return StreamingResponse(
            out,
            media_type="text/html; charset=utf-8",
            headers={"Content-Disposition": "attachment; filename=document.html"},
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"PDF-to-HTML error: {e}")
        raise HTTPException(status_code=500, detail="Failed to convert PDF to HTML.")


@app.post("/api/py/pdf-to-txt")
async def pdf_to_txt_endpoint(file: UploadFile = File(...)):
    try:
        pdf_bytes = await read_and_validate_pdf(file)
        out = pdf_to_txt_stream(pdf_bytes)
        return StreamingResponse(
            out,
            media_type="text/plain; charset=utf-8",
            headers={"Content-Disposition": "attachment; filename=document.txt"},
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"PDF-to-TXT error: {e}")
        raise HTTPException(status_code=500, detail="Failed to extract plain text from PDF.")


# UNIVERSAL REVERSE CONVERTER: DOCX / PPTX / XLSX / MD / HTML / TXT -> PDF
# UNIVERSAL REVERSE CONVERTER: DOCX/DOC, PPTX/PPT, XLSX/XLS, MD, HTML, TXT -> PDF
@app.post("/api/py/office-to-pdf")
async def office_to_pdf_endpoint(file: UploadFile = File(...)):
    data = await file.read(MAX_FILE_SIZE_BYTES + 1)
    if len(data) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds the 50MB security limit.")

    fname = (file.filename or "document").lower().strip()
    try:
        if fname.endswith((".docx", ".doc")):
            out = docx_to_pdf_stream(data)
        elif fname.endswith((".pptx", ".ppt")):
            out = pptx_to_pdf_stream(data)
        elif fname.endswith((".xlsx", ".xls")):
            out = xlsx_to_pdf_stream(data)
        elif fname.endswith((".md", ".markdown")):
            out = md_to_pdf_stream(data)
        elif fname.endswith((".html", ".htm")):
            out = html_to_pdf_stream(data)
        elif fname.endswith((".txt", ".csv")):
            out = txt_to_pdf_stream(data)
        else:
            raise HTTPException(
                status_code=400,
                detail="Unsupported file type. Upload .pptx, .ppt, .docx, .doc, .xlsx, .xls, .md, .html, or .txt",
            )

        return StreamingResponse(
            out,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=converted_to_pdf.pdf"},
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Office-to-PDF error ({fname}): {e}")
        raise HTTPException(status_code=500, detail=f"Failed to convert {fname} to PDF: {str(e)}")