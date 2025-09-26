#!/usr/bin/env bash
# Build script for Render deployment

# Exit on error
set -o errexit

# Determine available Python command
if command -v python3 &>/dev/null; then
  PYTHON_CMD="python3"
elif command -v python &>/dev/null; then
  PYTHON_CMD="python"
else
  echo "ERROR: No Python executable found!"
  exit 1
fi

# Print Python version for debugging
echo "Python version:"
$PYTHON_CMD --version

# Determine available pip command
if command -v pip3 &>/dev/null; then
  PIP_CMD="pip3"
elif command -v pip &>/dev/null; then
  PIP_CMD="pip"
else
  echo "ERROR: No pip executable found!"
  exit 1
fi

# Check if we're in a production environment (like Render)
if [ -n "$RENDER" ]; then
  # On Render, we can use pip directly as they manage the Python environment
  echo "Running in Render environment, using system Python..."
  # Install Python dependencies
  $PIP_CMD install --no-build-isolation -r requirements.txt
else
  # For local development, create and use a virtual environment
  echo "Setting up virtual environment..."
  
  # Make sure python3-venv is installed
  echo "Checking for python3-venv..."
  if ! dpkg -l | grep -q python3-venv; then
    echo "python3-venv not found, attempting to install..."
    sudo apt-get update && sudo apt-get install -y python3-venv
  fi
  
  # Create virtual environment if it doesn't exist
  if [ ! -d "venv" ]; then
    echo "Creating new virtual environment..."
    python3 -m venv venv
  else
    echo "Virtual environment already exists."
  fi
  
  # Activate virtual environment
  echo "Activating virtual environment..."
  source venv/bin/activate
  
  # Determine Python and pip executables in venv
  if [ -f "venv/bin/python3" ]; then
    VENV_PYTHON="python3"
  elif [ -f "venv/bin/python" ]; then
    VENV_PYTHON="python"
  else
    echo "ERROR: No Python executable found in virtual environment!"
    exit 1
  fi
  
  if [ -f "venv/bin/pip3" ]; then
    VENV_PIP="pip3"
  elif [ -f "venv/bin/pip" ]; then
    VENV_PIP="pip"
  else
    echo "ERROR: No pip executable found in virtual environment!"
    exit 1
  fi
  
  # Upgrade pip within the virtual environment
  echo "Upgrading pip..."
  $VENV_PIP install --upgrade pip
  
  # Install dependencies in the virtual environment
  echo "Installing dependencies..."
  $VENV_PIP install -r requirements.txt
  
  echo "Virtual environment setup complete."
fi

# Create static directory if it doesn't exist
echo "Creating static directory..."
mkdir -p static

# Set up the database (if needed)
# This will be handled by the app itself via db.create_all()

echo "Build completed successfully!"