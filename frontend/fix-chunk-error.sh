#!/bin/bash
# Fix Chunk Loading Error Script
# Run this script when experiencing chunk loading errors on Vercel

echo "🔧 Fixing chunk loading error..."

# Step 1: Clear all caches and builds
echo "1️⃣ Clearing all caches..."
rm -rf .next
rm -rf .vercel
rm -rf node_modules/.cache
rm -rf ~/.npm/_cacache

# Step 2: Clear dependency cache
echo "2️⃣ Clearing dependency cache..."
npm cache clean --force
rm -rf node_modules
rm -rf package-lock.json

# Step 3: Fresh install with legacy peer deps
echo "3️⃣ Fresh dependency installation..."
npm install --no-audit --prefer-offline --legacy-peer-deps

# Step 4: Build with production optimizations
echo "4️⃣ Building for production..."
NODE_ENV=production npm run build

echo "✅ Chunk loading error fix complete!"
echo ""
echo "Next steps:"
echo "1. Commit these changes: git add . && git commit -m 'fix: resolve chunk loading errors'"
echo "2. Deploy to Vercel: vercel --prod"
echo "3. Clear browser cache and test the application"