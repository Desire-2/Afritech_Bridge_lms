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

# Ensure we have a proper tailwind config
echo "Ensuring tailwind config is present..."
cat > tailwind.config.js << EOF
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [require("tailwindcss-animate")],
}
EOF

# Ensure postcss config is present
echo "Ensuring postcss config is present..."
cat > postcss.config.js << EOF
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF

# Install all dependencies with legacy peer deps
echo "Installing dependencies with legacy peer deps..."
npm install --legacy-peer-deps --prefer-offline

# Force install Next.js and cmdk at the correct versions
echo "Forcefully installing next@15.1.4..."
npm install next@15.1.4 --force --legacy-peer-deps

echo "Forcefully installing cmdk@1.1.1..."
npm install cmdk@1.1.1 --force --legacy-peer-deps

# Install critical dependencies directly (don't rely on detection)
echo "Installing tailwindcss and related packages..."
npm install --save-dev tailwindcss@3.4.1 postcss@8 autoprefixer --legacy-peer-deps --force
npm install tailwindcss-animate --legacy-peer-deps --force

# Ensure the packages are installed at the project level (not hoisted)
mkdir -p ./node_modules/tailwindcss
cp -r $(npm root -g)/tailwindcss/* ./node_modules/tailwindcss/ || true
mkdir -p ./node_modules/autoprefixer
cp -r $(npm root -g)/autoprefixer/* ./node_modules/autoprefixer/ || true

echo "Verifying cmdk version..."
CMDK_VERSION=$(npm list cmdk | grep cmdk | cut -d@ -f2)
echo "Installed cmdk version: $CMDK_VERSION"

# Fix file naming issues
echo "Checking for component file case sensitivity issues..."
# Make sure directory structure exists
mkdir -p ./src/components/guards
mkdir -p ./src/components/admin

# Verify case sensitivity of important files
if [ -f "./src/components/guards/admin-guard.tsx" ]; then
  # Create a copy with explicit export to ensure it's properly picked up
  cp ./src/components/guards/admin-guard.tsx ./src/components/guards/AdminGuard.tsx
  echo "Created AdminGuard.tsx from admin-guard.tsx"
fi

if [ -f "./src/components/admin/AdminSidebar.tsx" ]; then
  # Create a backup copy to ensure it's available
  cp ./src/components/admin/AdminSidebar.tsx ./src/components/admin/AdminSidebar.bak.tsx
  echo "Backed up AdminSidebar.tsx"
fi

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