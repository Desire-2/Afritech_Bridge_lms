#!/bin/sh
set -e
cd "$(dirname "$0")"

if [ -d venv ]; then
    . venv/bin/activate
fi

export FLASK_APP=app.py
export FLASK_CONFIG=development

# migrate to head (idempotent — creates every table on a fresh DB and applies
# the data migrations `db.create_all()` used to skip). Same command as the
# Dockerfile / Procfile so local, container and hosted starts stay in sync.
flask db upgrade

echo "Starting AfriTech Operations backend on :5000"
python app.py