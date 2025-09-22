# Vercel Production Deployment Guide

## 1. Prerequisites
- Ensure you have a Vercel account: https://vercel.com/signup
- Install Vercel CLI (optional): `npm i -g vercel`

## 2. Project Structure
- The frontend is a Next.js app, ready for Vercel deployment.
- Key files:
  - `vercel.json`: Vercel build and output configuration
  - `.env.production`: Production environment variables
  - `vercel-build.sh`: Custom build script for dependency management

## 3. Environment Variables
- Set production API URLs in `.env.production`.
- In Vercel dashboard, add these as Environment Variables for your project:
  - `NEXT_PUBLIC_API_URL=https://your-production-api-url/api/v1`
  - `API_URL=https://your-production-api-url/api/v1`

## 4. Build & Output
- Vercel will use `vercel-build.sh` for building the project.
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
