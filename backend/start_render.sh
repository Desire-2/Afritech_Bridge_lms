#!/bin/bash
# Debug and start script for Render deployment

echo "=== Environment Debug ==="
echo "PORT: $PORT"
echo "FLASK_ENV: $FLASK_ENV"
echo "DATABASE_URL: ${DATABASE_URL:0:20}..." # Only show first 20 chars for security

echo "=== Current Directory ==="
pwd
ls -la

echo "=== Starting Application ==="
# Use the PORT environment variable that Render provides
exec gunicorn --config gunicorn_config.py wsgi:application