#!/usr/bin/env bash

# Apply the versioned Alembic migrations to the configured database.
# Production credentials must be supplied through the environment.
set -o errexit
set -o nounset
set -o pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ -z "${DATABASE_URL:-}" ]; then
    echo "ERROR: DATABASE_URL is not set."
    exit 1
fi

if [ -x "venv/bin/python" ]; then
    PYTHON_CMD="venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
    PYTHON_CMD="python3"
else
    echo "ERROR: Python is not installed."
    exit 1
fi

export FLASK_APP=main.py
export FLASK_ENV="${FLASK_ENV:-production}"

echo "Applying Alembic migrations..."
exec "$PYTHON_CMD" -m flask db upgrade heads
