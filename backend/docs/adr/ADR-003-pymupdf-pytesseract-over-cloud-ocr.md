# ADR-003: PyMuPDF + pytesseract Over Cloud OCR for Bill Text Extraction

**Status:** Accepted  
**Date:** 2026-06-06  
**Deciders:** Software Architect  
**Technical Story:** T019 — Phase 2 Foundation (FR-1)

---

## Context

The bill upload pipeline (FR-1) requires extracting plain text from uploaded files before passing it to the LLM parser. Uploaded files may be:

- **PDF** — either text-native (selectable text embedded) or scanned (image-only pages).
- **Image** — JPEG or PNG scans of physical bills.

Three extraction strategies were evaluated:

1. **Cloud OCR** — send the file bytes to a third-party OCR API (Google Vision, AWS Textract, Azure Form Recognizer) and receive structured or plain text.
2. **Local OCR** — extract text in-process using PyMuPDF (for PDFs) and pytesseract/Tesseract (for images).
3. **LLM vision** — pass the image/PDF page directly to a multimodal LLM (e.g. GPT-4o with vision) and skip the OCR step entirely.

---

## Decision

**Use PyMuPDF (`fitz`) for PDF text extraction and pytesseract (wrapping Tesseract OCR) for image-only inputs.**

The pipeline:
1. `BillService.upload_and_parse()` receives an `UploadFile` and `resource_type`.
2. MIME type is checked: `application/pdf` → PyMuPDF path; `image/jpeg` or `image/png` → pytesseract path.
3. PyMuPDF: open the PDF, concatenate `page.get_text()` for all pages. If the extracted text is empty (scanned PDF), fall back to pytesseract on the rendered page image.
4. pytesseract: convert image to PIL `Image`, call `pytesseract.image_to_string()` with `lang='eng'`.
5. The resulting plain text string is passed to `LLMParserService`.

System dependencies added to `backend/Dockerfile`:
```
tesseract-ocr  tesseract-ocr-eng
```
Python dependencies: `pymupdf`, `pytesseract`, `Pillow`.

---

## Rationale

| Criterion | Cloud OCR | PyMuPDF + pytesseract (chosen) | LLM Vision |
|---|---|---|---|
| Additional API cost | Per-page billing (Google: ~$1.50/1000 pages) | None beyond infrastructure | Per-token; vision tokens are expensive |
| Latency | 1–3 s round-trip per page | < 500 ms in-process | 3–10 s LLM round-trip |
| Privacy | File bytes leave the system | All data stays in the container | File bytes sent to OpenAI |
| Accuracy (typed PDF) | High | Highest (native text extraction) | High |
| Accuracy (scanned image) | High | Good (Tesseract 4+ LSTM) | High |
| Infrastructure | External API dependency, API key, quota limits | Docker system package | OpenAI API (already a dependency) |
| Offline / airgapped | No | Yes | No |
| Maintenance | API version changes, SDK updates | Stable C library | Prompt/model changes |

The system already depends on the OpenAI API for LLM parsing — adding a second cloud OCR dependency would increase the external attack surface and introduce a second billing relationship. PyMuPDF handles the common case (text-native PDFs) with zero latency and maximum fidelity. pytesseract handles scanned inputs adequately for utility bills, which are typically printed in a clean, machine-readable font.

The LLM vision approach would simplify the pipeline (one step instead of two) but doubles the OpenAI cost for scanned bills and removes the raw text audit trail stored in `Bill.raw_text`.

---

## Consequences

**Positive:**
- No per-document OCR cost beyond compute time.
- Extracted `raw_text` is stored in the `Bill` record, providing a human-readable audit trail and enabling future re-parsing without re-uploading.
- All bill data stays within the Docker Compose network until the text string is sent to OpenAI — reduces the data surface area.
- Tesseract runs without GPU; works on standard cloud VMs.

**Negative / Trade-offs:**
- Tesseract's accuracy degrades on low-resolution scans (< 150 DPI), heavily stylised fonts, or rotated pages. For v1 (typed utility bills), this is acceptable.
- `backend/Dockerfile` requires `tesseract-ocr` system package, adding ~30 MB to the image.
- Scanned PDFs require an extra render step (PyMuPDF `page.get_pixmap()` → PIL Image → pytesseract). This adds ~200–500 ms per page.
- Language support is limited to English by default. Non-English bills require adding the appropriate `tesseract-ocr-<lang>` package and passing `lang=` to pytesseract. Deferred to future i18n work.

**Empty-text fallback rule (important invariant):**
If PyMuPDF extracts fewer than 20 characters from a PDF page, treat the page as a scanned image and run pytesseract on the rasterised page. This threshold avoids passing empty strings to the LLM parser.

**Out of scope for v1:**
- Multi-language OCR.
- Pre-processing (deskew, denoise, contrast enhancement).
- Structured field extraction at the OCR stage (all field extraction is delegated to the LLM).

---

## Alternatives Rejected

- **Google Cloud Vision / AWS Textract**: Adds a second cloud billing dependency, per-page cost, and sends bill images to a third-party service. Rejected on cost and privacy grounds.
- **Azure Form Recognizer**: Purpose-built for invoices and receipts. High accuracy but expensive (~$1.50/page for the prebuilt invoice model), and introduces Azure as a required vendor. Deferred for future consideration if Tesseract accuracy proves insufficient at scale.
- **LLM vision (GPT-4o with image input)**: Accurate but expensive for production use and removes the `raw_text` audit trail. May be evaluated for v2 if scanned bill accuracy is a user complaint.
- **pdfplumber / pdfminer.six**: Alternative PDF text extractors. PyMuPDF is chosen for its speed, active maintenance, and built-in support for rendering pages to images (useful for the scanned-PDF fallback path).
