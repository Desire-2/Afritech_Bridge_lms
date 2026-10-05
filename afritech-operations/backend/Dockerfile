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
# gunicorn alone would 500 every request until someone migrated by hand.
# scripts/migrate.py is the guarded runner — it prints the redacted DATABASE_URL
# it is about to touch, refuses an unset/SQLite target, takes a Postgres
# advisory lock so the workers below cannot race the same DDL, and verifies the
# schema actually landed on head. `--yes` because a container has no terminal.
CMD ["sh", "-c", "python scripts/migrate.py --yes && exec gunicorn --bind 0.0.0.0:${PORT:-5000} --workers 3 --timeout 120 wsgi:app"]
