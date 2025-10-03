# Deployment Guide for Afritec Bridge LMS Frontend

## Overview
This guide covers deployment for the Next.js frontend application with multiple deployment options.

## 1. Prerequisites
- Ensure you have a Vercel account: https://vercel.com/signup
- Install Vercel CLI (optional): `npm i -g vercel`
- Node.js 18+ installed
- Backend API running and accessible

## 2. Project Structure
- The frontend is a Next.js app with Cloudflare Pages support
- Key files:
  - `vercel.json`: Vercel build and output configuration
  - `.env.production`: Production environment variables template
  - `wrangler.toml`: Cloudflare Pages configuration
  - `next.config.ts`: Next.js configuration

## 3. Environment Variables Setup

### Required Variables
Set these in your deployment platform:
- `NEXT_PUBLIC_API_URL`: Your backend API URL (e.g., https://api.yourdomain.com/api/v1)
- `NODE_ENV=production`

### Optional Variables
- `NEXT_PUBLIC_APP_NAME`: Application name
- `NEXT_PUBLIC_SUPPORT_EMAIL`: Support contact email

### Configuration Steps

#### For Vercel:
1. Go to your project dashboard
2. Navigate to Settings > Environment Variables
3. Add the required variables

#### For Cloudflare Pages:
1. Go to your Pages project
2. Navigate to Settings > Environment variables
3. Add the required variables

#### For Other Platforms:
Copy `.env.example` to `.env.production` and configure the values.

## 4. Deployment Options

### Option A: Vercel (Recommended for Next.js)

#### Automatic Deployment:
1. Connect your GitHub repository to Vercel
2. Set environment variables in dashboard
3. Push to main branch for automatic deployment

#### Manual Deployment:
```bash
npm install -g vercel
vercel --prod
```

### Option B: Cloudflare Pages

```bash
# Build for Cloudflare
npm run build:worker

# Deploy using Wrangler
npx wrangler pages deploy
```

### Option C: Traditional VPS/Server

```bash
# Install dependencies
npm ci --only=production

# Build application
npm run build

# Start with PM2 (recommended)
npm install -g pm2
pm2 start npm --name "afritec-frontend" -- start

# Or start directly
npm start
```

### Option D: Docker

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

Deploy:
```bash
docker build -t afritec-frontend .
docker run -p 3000:3000 --env-file .env.production afritec-frontend
```

## 5. Post-Deployment Configuration

### Backend CORS Setup
Ensure your backend allows requests from your frontend domain:

```python
# Flask CORS configuration
CORS_ORIGINS = [
    "https://your-frontend-domain.com",
    "https://www.your-frontend-domain.com"
]
```

### API Integration Test
After deployment, visit `https://your-domain.com/api-test` to verify:
- Backend connectivity
- API endpoints functionality
- Authentication flow

## 6. Performance Optimization

### Caching Strategy
- Static assets cached automatically by Next.js
- API responses cached using React hooks
- Configure CDN for optimal performance

### Monitoring
- Set up error tracking (Sentry, Bugsnag)
- Configure analytics (Google Analytics)
- Monitor API response times

## 7. Security Considerations

### Environment Security
- Never commit production environment files
- Use platform-specific secret management
- Regularly rotate API keys and secrets

### Content Security Policy
Configure in `next.config.ts` for enhanced security.

## 8. Troubleshooting

### Common Issues

1. **API Connection Errors**
   - Verify `NEXT_PUBLIC_API_URL` is accessible
   - Check CORS configuration
   - Ensure backend is running

2. **Build Failures**
   - Check Node.js version compatibility
   - Clear cache: `rm -rf .next node_modules && npm install`
   - Verify all dependencies are available

3. **Authentication Issues**
   - Check token storage and retrieval
   - Verify API endpoints are accessible
   - Check network requests in browser DevTools

### Debugging Steps
1. Check browser console for errors
2. Verify API responses in Network tab
3. Test API endpoints directly
4. Check deployment logs

## 9. Maintenance

### Regular Updates
- Keep dependencies updated
- Monitor security vulnerabilities
- Regular backup of configurations

### Scaling
- Monitor application performance
- Configure auto-scaling if needed
- Optimize bundle size and loading times
- Vercel will use `npm run build` for building the project.
- Output directory is `.next` (configured in `vercel.json`).

## 5. Deployment Steps
1. Push your code to GitHub, GitLab, or Bitbucket.
2. Import the repository in Vercel: https://vercel.com/import
3. Vercel will auto-detect Next.js and use your configuration.
4. Set environment variables in the Vercel dashboard.
5. Deploy!

## 6. Custom Domains & SSL
- Add your custom domain in Vercel dashboard for HTTPS.

## 7. Troubleshooting
- Check Vercel build logs for errors.
- Ensure all dependencies are listed in `package.json`.
- For advanced config, see [Vercel Docs](https://vercel.com/docs).

---

For questions, see the README or contact your team lead.
