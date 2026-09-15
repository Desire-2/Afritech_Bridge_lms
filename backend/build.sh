#!/usr/bin/env bash
# Build script for Render deployment

# Exit on error
set -o errexit

# Render runs this script from the configured working directory. Resolve the
# backend directory explicitly so the migration command and requirements file
# always refer to this service's files.
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

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
if [ -n "$RENDER" ] || [ "$FLASK_ENV" = "production" ]; then
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

# Production startup already requires a database URL. Fail during the build
# so a deployment cannot pass while silently skipping its schema migration.
if { [ -n "$RENDER" ] || [ "$FLASK_ENV" = "production" ]; } && [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL must be set for a production deployment."
  exit 1
fi

# Apply the versioned database migrations before the application starts.
# The old sync_production_schema.py script only added columns and was removed;
# it also allowed deployments to continue after a schema failure. That left
# newly deployed models (including student_lesson_bookmarks) unavailable in
# production while the app was already serving traffic.
if [ -n "$DATABASE_URL" ] && { [ -n "$RENDER" ] || [ "$FLASK_ENV" = "production" ]; }; then
  echo "=================================================="
  echo "Running Alembic database migrations..."
  echo "=================================================="

  # A failed migration must fail the build. Starting the web service against
  # a stale schema produces runtime 500s and is unsafe for production.
  # Upgrade every migration head. The repository can contain parallel feature
  # branches (for example the workflow tables and the lesson-bookmark chain)
  # until a merge revision is committed.
  FLASK_APP=main.py $PYTHON_CMD -m flask db upgrade heads
  echo "✅ Alembic migrations completed successfully!"
  
  # Run forum course_id nullable migration (only if the script exists -
  # this file is not part of the repo, so don't reference it unconditionally)
  echo "=================================================="
  echo "Running forum course_id nullable migration..."
  echo "=================================================="
  if [ -f "migrate_forum_course_id_nullable.py" ]; then
    if $PYTHON_CMD migrate_forum_course_id_nullable.py; then
      echo "✅ Forum migration completed successfully!"
    else
      echo "⚠️  Warning: Forum migration had issues, but continuing deployment..."
    fi
  else
    echo "ℹ️  migrate_forum_course_id_nullable.py not found - skipping (schema is managed by Alembic migrations)"
  fi
else
  echo "Skipping schema sync (not in production environment or DATABASE_URL not set)"
fi

echo "Build completed successfully!"
