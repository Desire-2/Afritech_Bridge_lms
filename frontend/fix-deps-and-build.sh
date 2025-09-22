#!/bin/bash

# This script fixes dependency issues by forcefully updating the cmdk package
echo "Starting dependency fix script..."

# Install dependencies with legacy peer deps
npm install --legacy-peer-deps

# Forcefully remove and reinstall cmdk with the latest version
echo "Removing cmdk package..."
npm remove cmdk --legacy-peer-deps

echo "Forcefully installing cmdk@1.1.1..."
npm install cmdk@1.1.1 --force --legacy-peer-deps

# Run the build
echo "Starting build process..."
next build

echo "Build complete!"