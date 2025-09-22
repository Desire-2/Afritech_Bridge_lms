#!/usr/bin/env bash
# Script to verify and fix connection between frontend and backend

# Exit on error
set -o errexit

# Change to the backend directory
cd "$(dirname "$0")"

# Get the current port from .env
BACKEND_PORT=$(grep PORT .env | cut -d'=' -f2)
echo "Backend API is configured to run on port: $BACKEND_PORT"

echo "-------------------------------------------------------------"
echo "Backend API endpoints are available at:"
echo "http://localhost:$BACKEND_PORT/api/v1/*"
echo ""
echo "Make sure your frontend is configured to access this URL."
echo "If you're using a .env file in your frontend, check that"
echo "the API URL is correctly set to: http://localhost:$BACKEND_PORT"
echo "-------------------------------------------------------------"

# Check if the backend is running
if netstat -tuln | grep -q ":$BACKEND_PORT "; then
    echo "✅ Backend is running on port $BACKEND_PORT"
else
    echo "❌ Backend is not currently running on port $BACKEND_PORT"
    echo "Start it with: ./run.sh"
fi

echo ""
echo "To fix frontend connection issues:"
echo "1. Make sure your frontend .env has the correct API URL"
echo "2. If using axios, verify baseURL is set correctly"
echo "3. Check for any hardcoded API URLs in your frontend code"
echo "4. Restart your frontend application after making changes"
echo ""