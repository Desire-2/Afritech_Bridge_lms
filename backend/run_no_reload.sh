#!/usr/bin/env bash
# Run script for testing AI generation without auto-reload interference

# Exit on error
set -o errexit

# Change to the backend directory
cd "$(dirname "$0")"

echo "Starting backend WITHOUT auto-reload for AI generation testing..."

# Check if virtual environment exists
if [ -d "venv" ]; then
    VENV_DIR="venv"
elif [ -d "venv-new" ]; then
    VENV_DIR="venv-new"
else
    echo "Virtual environment not found. Please run setup.sh first."
    exit 1
fi

# Set Python command
if [ -f "$VENV_DIR/bin/python" ]; then
    PYTHON_CMD="./$VENV_DIR/bin/python"
elif [ -f "$VENV_DIR/bin/python3" ]; then
    PYTHON_CMD="./$VENV_DIR/bin/python3"
else
    echo "ERROR: No Python executable found in virtual environment."
    exit 1
fi

# Print Python version for debugging
echo "Using Python: $($PYTHON_CMD --version)"

# Set port
export PORT=${PORT:-5001}
echo "Running on port $PORT"

# DISABLE AUTO-RELOAD for testing AI generation
export DISABLE_RELOADER=true
echo "⚠️  Auto-reload DISABLED - you must manually restart if you change code"

# Run the application
$PYTHON_CMD main.py