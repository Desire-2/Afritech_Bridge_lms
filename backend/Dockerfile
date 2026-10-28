# syntax=docker/dockerfile:1
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
# pip's HTTP cache lives in a BuildKit cache mount: it is not baked into the
# image, but survives failed/retried builds, which matters on slow networks —
# completed wheel downloads are not lost when a later download drops.
RUN --mount=type=cache,target=/root/.cache/pip pip install -r requirements.txt

COPY . .

# main.py serves from a static/ folder; keep it present in the image.
RUN mkdir -p static

EXPOSE 10000

# Migrate to head before serving when a database is configured (mirrors
# build.sh so schema is never stale), then hand off to gunicorn.
#
# Memory: payment-proof OCR used to OOM-kill sync workers on Render
# ("Worker was sent SIGKILL") — 3 sync workers each holding a full-res phone
# photo plus a tesseract process exceeds a small instance.  Defaults are
# sized for a lean container: one process with threaded request handling
# (OCR itself is a serialized subprocess per process, see _OCR_LOCK in
# payment_slip_verifier.py), recycled after max-requests to shed leaks.
# Raise GUNICORN_WORKERS on larger instances.
CMD ["sh", "-c", "if [ -n \"$DATABASE_URL\" ]; then FLASK_APP=main.py python -m flask db upgrade heads; fi; exec gunicorn -w ${GUNICORN_WORKERS:-1} --worker-class gthread --threads ${GUNICORN_THREADS:-4} --max-requests ${GUNICORN_MAX_REQUESTS:-400} --max-requests-jitter 50 --worker-tmp-dir /dev/shm -b 0.0.0.0:${PORT:-10000} --timeout 120 main:app"]
