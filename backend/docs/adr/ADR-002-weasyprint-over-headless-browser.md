# ADR-002: WeasyPrint Over Headless Browser for PDF Generation

**Status:** Accepted  
**Date:** 2026-06-06  
**Deciders:** Software Architect  
**Technical Story:** T019 — Phase 2 Foundation (FR-5)

---

## Context

The PDF export feature (FR-5) requires server-side generation of a structured report containing:
- A cover page with metadata
- Summary tables per resource type
- Consumption trend charts (SVG-embedded)
- ML prediction data with confidence intervals
- Page numbers and footer

Two main server-side PDF generation strategies are viable in a Python/Docker environment:

1. **Headless browser (Puppeteer/Playwright/Chrome)** — render an HTML page in a real browser engine, then print to PDF.
2. **Python-native HTML-to-PDF library** — render an HTML/CSS document entirely within the Python process. Candidates: WeasyPrint, ReportLab, fpdf2.

---

## Decision

**Use WeasyPrint to render a Jinja2 HTML template to PDF.**

The implementation approach:
- `ExportService` populates a `ReportSpec` dataclass (pure data, no HTTP concerns — SRP).
- A Jinja2 template (`app/templates/report.html`) renders the full document structure.
- `ChartRenderer` (separate class, injected into `ExportService`) generates chart SVGs via Matplotlib with the `Agg` backend and returns them as inline SVG strings.
- `ExportService.generate(spec) -> bytes` calls `weasyprint.HTML(string=rendered_html).write_pdf()`.
- The FastAPI endpoint streams the result with `StreamingResponse` and `Content-Type: application/pdf`.

System dependencies added to `backend/Dockerfile`:
```
libpango-1.0-0  libcairo2  libgdk-pixbuf2.0-0
```

---

## Rationale

| Criterion | Headless Browser | WeasyPrint (chosen) |
|---|---|---|
| Container footprint | +400–600 MB (Chromium binary) | +~30 MB system libs (Pango, Cairo) |
| Startup latency | 2–5 s cold start (browser process) | < 100 ms (in-process) |
| CSS/layout fidelity | Full CSS3 support (browser-grade) | CSS 2.1 + partial CSS3; sufficient for tabular reports |
| Process isolation | Browser in separate process; crashes don't kill API | In-process; a WeasyPrint crash raises a Python exception |
| Dependency management | `playwright install chromium` in CI; browser updates | pip install + apt packages; stable versions |
| Security surface | Headless browser can fetch external URLs if misconfigured | No network calls during render; purely in-memory |
| Maintenance | Browser API changes (Playwright/Puppeteer major versions) | Stable HTML/CSS rendering contract |
| Chart embedding | Charts must be served as URLs or data URIs | SVG strings embedded inline — no URL serving needed |

The report design is a structured document (tables + charts), not a pixel-perfect web page. WeasyPrint's CSS support is sufficient for this use case. The elimination of the Chromium binary keeps the Docker image lean and removes a significant attack surface.

The in-process nature of WeasyPrint also simplifies the streaming response: `write_pdf()` returns `bytes` directly, avoiding inter-process communication overhead.

---

## Consequences

**Positive:**
- Docker image stays under 500 MB (vs ~900 MB with Chromium).
- No separate browser process to manage, monitor, or restart.
- PDF generation is a pure in-process function call, easy to unit test with mock data.
- No external URLs needed — SVG charts are inlined, preventing SSRF via chart URLs.

**Negative / Trade-offs:**
- WeasyPrint does not support CSS Grid or Flexbox fully. Report layout must use `<table>` or float-based CSS. Acceptable for a structured data report.
- JavaScript is not executed during render. All dynamic content must be rendered server-side before passing to WeasyPrint. This is by design (server-side Jinja2 rendering).
- WeasyPrint can be slow for very large reports (many pages). The 24-month window limit (enforced by `DateRangeExceededError` returning `400`) caps the maximum report size and bounds rendering time.
- Font rendering depends on system fonts installed in the container. The Dockerfile must include a base font package (`fonts-liberation` or equivalent).

**Out of scope for v1:**
- Watermarking, digital signatures, or PDF/A compliance.
- Per-user custom branding/templates.

---

## Alternatives Rejected

- **Puppeteer/Playwright (headless Chromium)**: Adds ~500 MB to the Docker image, introduces a browser subprocess, and requires `playwright install` in CI. Deferred until full CSS3 layout fidelity is required.
- **ReportLab**: Low-level PDF primitives (coordinates, fonts, drawString). High implementation effort for tabular layouts; no HTML/CSS authoring model. Rejected in favour of the template-based approach.
- **fpdf2**: Similar to ReportLab — programmatic layout, no HTML rendering. Charts would require manual drawing. Rejected.
- **wkhtmltopdf**: Unmaintained as of 2023; relies on a patched Qt WebKit. Security posture is poor. Rejected.
