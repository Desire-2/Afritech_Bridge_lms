#!/bin/bash
# Vercel Deployment Script for Afritech Bridge LMS
# This script optimizes the deployment to prevent chunk loading errors

set -e

echo "🚀 Starting Vercel deployment optimization..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf .next
rm -rf node_modules/.cache

# Clear npm cache
echo "📦 Clearing npm cache..."
npm cache clean --force

# Reinstall dependencies with clean slate
echo "🔧 Installing dependencies..."
rm -rf node_modules
npm install --no-audit --prefer-offline

# Build with optimizations
echo "🏗️ Building for production..."
NODE_ENV=production npm run build

echo "✅ Build completed successfully!"

# If running locally, start the production server for testing
if [ "$1" == "--local-test" ]; then
    echo "🧪 Starting local production server for testing..."
    npm start
fi

echo "✨ Ready for Vercel deployment!"
echo ""
echo "To deploy to Vercel, run one of:"
echo "  vercel --prod"
echo "  git push (if auto-deploy is configured)"