# Entry point for deployment platforms like Render
# This file imports the Flask app from main.py to make it available as 'app'

import os
import sys

# Add the current directory to Python path to ensure imports work
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app

# This allows deployment platforms to find the app instance
# when using commands like "gunicorn app:app"
if __name__ == "__main__":
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)