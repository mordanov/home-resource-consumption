FROM python:3.12-slim

# System dependencies for WeasyPrint, OCR, and PDF processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    libmagic1 \
    libpango-1.0-0 \
    libcairo2 \
    libgdk-pixbuf-xlib-2.0-0 \
    libffi-dev \
    libssl-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first (cache layer)
COPY pyproject.toml ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir .

# Copy application code
COPY alembic.ini ./
COPY alembic/ ./alembic/
COPY app/ ./app/
COPY scripts/ ./scripts/

# Create uploads directory
RUN mkdir -p /app/uploads

EXPOSE 8000

# Run migrations then start the server
CMD ["sh", "-c", "alembic upgrade head && PYTHONPATH=/app python scripts/create_user.py && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
