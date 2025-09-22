#!/bin/bash

echo "====== VERCEL DEPLOYMENT BUILD SCRIPT ======"
echo "Current directory: $(pwd)"
echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"
echo "Date: $(date)"

# Create .npmrc file with needed configurations
echo "Creating .npmrc file..."
cat > .npmrc << EOF
legacy-peer-deps=true
strict-peer-dependencies=false
auto-install-peers=true
prefer-offline=true
force=true
EOF

# Update package.json to ensure consistent versioning
echo "Updating package.json to enforce cmdk version..."
if [ -f package.json ]; then
  # Backup package.json
  cp package.json package.json.bak
  
  # Use node to update package.json
  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    // Update cmdk version
    if (pkg.dependencies && pkg.dependencies.cmdk) {
      pkg.dependencies.cmdk = '^1.1.1';
      console.log('Updated cmdk dependency to ^1.1.1');
    }
    
    // Ensure all override mechanisms are in place
    pkg.overrides = pkg.overrides || {};
    pkg.overrides.cmdk = '^1.1.1';
    
    pkg.resolutions = pkg.resolutions || {};
    pkg.resolutions.cmdk = '^1.1.1';
    
    if (pkg.pnpm && pkg.pnpm.overrides) {
      pkg.pnpm.overrides.cmdk = '^1.1.1';
    } else {
      pkg.pnpm = pkg.pnpm || {};
      pkg.pnpm.overrides = pkg.pnpm.overrides || {};
      pkg.pnpm.overrides.cmdk = '^1.1.1';
    }
    
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
    console.log('Successfully updated package.json');
  "
else
  echo "Error: package.json not found!"
  exit 1
fi

# Clean installation
echo "Cleaning node_modules..."
rm -rf node_modules
rm -rf .next

# Install all dependencies with legacy peer deps
echo "Installing dependencies with legacy peer deps..."
npm install --legacy-peer-deps --prefer-offline

# Force install cmdk at the correct version
echo "Forcefully installing cmdk@1.1.1..."
npm install cmdk@1.1.1 --force --legacy-peer-deps

# Verify installation of critical dependencies
echo "Verifying tailwindcss installation..."
if ! npm list tailwindcss > /dev/null 2>&1; then
  echo "Installing missing tailwindcss..."
  npm install --save-dev tailwindcss postcss autoprefixer --legacy-peer-deps
fi

echo "Verifying cmdk version..."
CMDK_VERSION=$(npm list cmdk | grep cmdk | cut -d@ -f2)
echo "Installed cmdk version: $CMDK_VERSION"

# Run the Next.js build
echo "Starting Next.js build process..."
NEXT_TELEMETRY_DISABLED=1 next build

BUILD_STATUS=$?
if [ $BUILD_STATUS -eq 0 ]; then
  echo "✅ Build completed successfully!"
else
  echo "❌ Build failed with status $BUILD_STATUS"
  exit $BUILD_STATUS
fi