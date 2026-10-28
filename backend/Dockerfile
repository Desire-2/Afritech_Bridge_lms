FROM python:3.10-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=10000

WORKDIR /app

# System packages pip cannot provide. Payment-proof verification OCR needs the
# tesseract binary (images) and pdftoppm (scanned PDFs); Render's native
# runtime cannot apt-install anything, which is why this service deploys as
# Docker. DejaVu fonts keep text rendering in receipts/tests predictable.
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    poppler-utils \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# main.py serves from a static/ folder; keep it present in the image.
RUN mkdir -p static

EXPOSE 10000

# Migrate to head before serving when a database is configured (mirrors
# build.sh so schema is never stale), then hand off to gunicorn.
CMD ["sh", "-c", "if [ -n \"$DATABASE_URL\" ]; then FLASK_APP=main.py python -m flask db upgrade heads; fi; exec gunicorn -w ${GUNICORN_WORKERS:-3} -b 0.0.0.0:${PORT:-10000} --timeout 120 main:app"]
