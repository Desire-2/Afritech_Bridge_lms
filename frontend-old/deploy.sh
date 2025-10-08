#!/bin/bash

# Deployment script for Afritec Bridge LMS Frontend

set -e

echo "🚀 Starting deployment process..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the frontend directory."
    exit 1
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command_exists node; then
    echo "❌ Error: Node.js is not installed"
    exit 1
fi

if ! command_exists npm; then
    echo "❌ Error: npm is not installed"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'.' -f1 | sed 's/v//')
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Error: Node.js version 18 or higher is required. Current version: $(node --version)"
    exit 1
fi

echo "✅ Prerequisites check passed"

# Get deployment type from user
echo ""
echo "🎯 Select deployment type:"
echo "1) Local build and test"
echo "2) Vercel deployment"
echo "3) Cloudflare Pages"
echo "4) Docker build"
echo "5) Production build only"

read -p "Enter your choice (1-5): " choice

case $choice in
    1)
        echo "🔨 Building for local testing..."
        npm install
        npm run build
        echo "✅ Build complete! Run 'npm start' to test locally."
        ;;
    2)
        echo "🌐 Deploying to Vercel..."
        if ! command_exists vercel; then
            echo "📦 Installing Vercel CLI..."
            npm install -g vercel
        fi
        vercel --prod
        echo "✅ Deployed to Vercel!"
        ;;
    3)
        echo "☁️ Building for Cloudflare Pages..."
        npm install
        npm run build:worker
        if command_exists wrangler; then
            read -p "Deploy to Cloudflare Pages now? (y/n): " deploy_now
            if [ "$deploy_now" = "y" ]; then
                wrangler pages deploy
                echo "✅ Deployed to Cloudflare Pages!"
            else
                echo "✅ Build complete! Run 'wrangler pages deploy' to deploy."
            fi
        else
            echo "✅ Build complete! Install wrangler CLI and run 'wrangler pages deploy' to deploy."
        fi
        ;;
    4)
        echo "🐳 Building Docker image..."
        if ! command_exists docker; then
            echo "❌ Error: Docker is not installed"
            exit 1
        fi
        
        # Create Dockerfile if it doesn't exist
        if [ ! -f "Dockerfile" ]; then
            echo "📄 Creating Dockerfile..."
            cat > Dockerfile << 'EOF'
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "start"]
EOF
        fi
        
        docker build -t afritec-frontend .
        echo "✅ Docker image built! Run 'docker run -p 3000:3000 afritec-frontend' to start."
        ;;
    5)
        echo "🔨 Building for production..."
        npm install
        npm run build
        echo "✅ Production build complete!"
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

# Check if environment file exists
echo ""
echo "🔍 Checking environment configuration..."

if [ ! -f ".env.local" ] && [ ! -f ".env.production" ]; then
    echo "⚠️  Warning: No environment file found."
    echo "   Copy .env.example to .env.local (development) or .env.production (production)"
    echo "   and configure your API URL and other settings."
fi

# API connectivity test
if [ -f ".env.local" ] || [ -f ".env.production" ]; then
    echo ""
    read -p "🧪 Test API connectivity? (y/n): " test_api
    if [ "$test_api" = "y" ]; then
        echo "Visit your deployed application and go to /api-test to verify API connectivity"
    fi
fi

echo ""
echo "🎉 Deployment process completed!"
echo ""
echo "📚 Useful commands:"
echo "   - Test locally: npm start"
echo "   - View logs: npm run logs"
echo "   - Build analysis: npm run build -- --analyze"
echo ""
echo "📖 For more details, see DEPLOYMENT.md"