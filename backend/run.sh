#!/usr/bin/env bash
# Run script for local development

# Exit on error
set -o errexit

# Change to the backend directory
cd "$(dirname "$0")"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Virtual environment not found. Please run setup.sh first."
    exit 1
fi

# No need to activate the virtual environment if we use absolute paths
# Check which Python executable is available in the virtual environment
if [ -f "venv/bin/python" ]; then
    PYTHON_CMD="./venv/bin/python"
elif [ -f "venv/bin/python3" ]; then
    PYTHON_CMD="./venv/bin/python3"
else
    echo "ERROR: No Python executable found in virtual environment."
    echo "Try running ./setup.sh again to recreate the virtual environment."
    exit 1
fi

# Print Python version for debugging
echo "Using Python: $($PYTHON_CMD --version)"

# Run the application
echo "Starting Afritec Bridge LMS backend..."

# Set default port and allow override through PORT environment variable
export PORT=${PORT:-5000}
# Try alternative ports if the main one is taken
if [ "$PORT" = "5000" ]; then
    for alt_port in 5001 5002 5003 8000 8080; do
        if ! netstat -tuln | grep -q ":$alt_port "; then
            export PORT=$alt_port
            echo "Port 5000 is in use, switching to port $PORT"
            break
        fi
    done
fi

echo "Running on port $PORT"
$PYTHON_CMD main.py