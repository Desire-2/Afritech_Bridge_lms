FROM python:3.10-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    FLASK_APP=app.py \
    FLASK_CONFIG=production \
    PORT=5000

WORKDIR /app

# system deps for reportlab/pandas export path (minimal)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

# Migrate to head before serving: a fresh Postgres volume has no tables, and
# gunicorn alone would 500 every request until someone ran `flask db upgrade`
# by hand. `flask db upgrade` is idempotent, so this is a no-op on restart.
CMD ["sh", "-c", "flask db upgrade && exec gunicorn --bind 0.0.0.0:${PORT:-5000} --workers 3 --timeout 120 wsgi:app"]
