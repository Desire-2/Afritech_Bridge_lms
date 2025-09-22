#!/bin/bash

echo "===== PRE-BUILD DEPENDENCY FIX SCRIPT ====="
echo "Current directory: $(pwd)"
echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"

# Create npmrc file directly
echo "Creating .npmrc file with legacy-peer-deps configuration..."
cat > .npmrc << EOF
legacy-peer-deps=true
strict-peer-dependencies=false
auto-install-peers=true
prefer-offline=true
force=true
EOF

# Update package.json to use cmdk 1.1.1 directly
echo "Updating package.json to use cmdk 1.1.1 directly..."
if [ -f package.json ]; then
  # Backup package.json
  cp package.json package.json.bak
  
  # Use node to update the package.json directly
  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    // Update cmdk version
    if (pkg.dependencies && pkg.dependencies.cmdk) {
      pkg.dependencies.cmdk = '^1.1.1';
      console.log('Updated cmdk dependency to ^1.1.1');
    }
    
    // Add overrides if they don't exist
    pkg.overrides = pkg.overrides || {};
    pkg.overrides.cmdk = '^1.1.1';
    
    // Add resolutions if they don't exist
    pkg.resolutions = pkg.resolutions || {};
    pkg.resolutions.cmdk = '^1.1.1';
    pkg.resolutions.react = '^19.0.0';
    pkg.resolutions['react-dom'] = '^19.0.0';
    
    // Update pnpm overrides
    if (pkg.pnpm && pkg.pnpm.overrides) {
      pkg.pnpm.overrides.cmdk = '^1.1.1';
    } else {
      pkg.pnpm = pkg.pnpm || {};
      pkg.pnpm.overrides = { cmdk: '^1.1.1', react: '^19.0.0', 'react-dom': '^19.0.0' };
    }
    
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
    console.log('Successfully updated package.json');
  "
else
  echo "Error: package.json not found!"
  exit 1
fi

echo "Pre-build script completed successfully!"