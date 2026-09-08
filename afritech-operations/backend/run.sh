#!/bin/sh
set -e
cd "$(dirname "$0")"

if [ -d venv ]; then
    . venv/bin/activate
fi

export FLASK_APP=app.py
export FLASK_CONFIG=development

# create tables if needed
flask --app app.py shell -c "from app import create_app; from app.extensions import db; app=create_app('development'); app.app_context().push(); db.create_all(); print('DB ready')"

echo "Starting AfriTech Operations backend on :5000"
python app.py