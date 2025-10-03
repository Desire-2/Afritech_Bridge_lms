#!/bin/bash
# Render deployment script for Afritec Bridge LMS backend

# Set environment variables if not already set
export FLASK_APP=app.py
export FLASK_ENV=production

# Run the application using gunicorn
exec gunicorn --config gunicorn_config.py app:app