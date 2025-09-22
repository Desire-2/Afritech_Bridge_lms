#!/usr/bin/env bash
# Setup script for local development

# Exit on error
set -o errexit

# Change to the backend directory
cd "$(dirname "$0")"

echo "Setting up local development environment for Afritec Bridge LMS..."

# Make sure python3-venv is installed
echo "Checking for python3-venv..."
if ! dpkg -l | grep -q python3-venv; then
    echo "python3-venv not found, attempting to install..."
    sudo apt-get update && sudo apt-get install -y python3-venv
fi

# Check if python3-full is installed
if ! dpkg -l | grep -q python3-full; then
    echo "python3-full not found, attempting to install..."
    sudo apt-get update && sudo apt-get install -y python3-full
fi

# Remove existing virtual environment if there are issues
if [ -d "venv" ]; then
    echo "Removing existing virtual environment..."
    rm -rf venv
fi

# Create fresh virtual environment
echo "Creating new virtual environment..."
python3 -m venv venv

# Use the exact paths to binaries in the virtual environment
# instead of relying on PATH after activation
if [ -f "venv/bin/python3" ]; then
    PYTHON_CMD="./venv/bin/python3"
    echo "Using Python 3 from virtual environment"
elif [ -f "venv/bin/python" ]; then
    PYTHON_CMD="./venv/bin/python"
    echo "Using Python from virtual environment"
else
    echo "ERROR: No Python executable found in virtual environment."
    echo "This is unexpected - please check your Python installation."
    exit 1
fi

# Print Python version
echo "Python version:"
$PYTHON_CMD --version

# Use the exact path to pip in the virtual environment
if [ -f "venv/bin/pip3" ]; then
    PIP_CMD="./venv/bin/pip3"
elif [ -f "venv/bin/pip" ]; then
    PIP_CMD="./venv/bin/pip"
else
    echo "ERROR: No pip executable found in virtual environment."
    echo "This is unexpected - please check your Python installation."
    exit 1
fi

# Upgrade pip
echo "Upgrading pip..."
$PIP_CMD install --upgrade pip

# Install dependencies
echo "Installing dependencies..."
$PIP_CMD install -r requirements.txt

# Set up .env file if it doesn't exist
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    echo "Creating .env file from example..."
    cp .env.example .env
    echo "NOTE: You should edit the .env file with your actual configuration values!"
fi

# Create static directory if it doesn't exist
echo "Creating static directory..."
mkdir -p static

echo "Setup completed successfully!"
echo ""
echo "To activate the virtual environment in the future, run:"
echo "  source venv/bin/activate"
echo ""
echo "To run the application, use the run.sh script:"
echo "  ./run.sh"
echo ""
echo "Or manually with:"
echo "  source venv/bin/activate"
echo "  $PYTHON_CMD main.py"
echo ""