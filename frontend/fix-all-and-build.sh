#!/bin/bash

echo "===== COMPREHENSIVE BUILD SCRIPT ====="
echo "Current directory: $(pwd)"
echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"

# Force install all dependencies
echo "Installing all dependencies with force and legacy-peer-deps..."
npm install --legacy-peer-deps --force

# Make sure tailwindcss is installed
echo "Ensuring tailwindcss is installed..."
npm install --save-dev tailwindcss postcss autoprefixer --legacy-peer-deps --force

# Make sure cmdk is at the right version
echo "Ensuring cmdk is at version 1.1.1..."
npm install cmdk@1.1.1 --legacy-peer-deps --force

# Create proper .npmrc file
echo "Creating .npmrc file..."
cat > .npmrc << EOF
legacy-peer-deps=true
strict-peer-dependencies=false
auto-install-peers=true
force=true
EOF

# Run the build
echo "Starting Next.js build process..."
next build

echo "Build process completed!"