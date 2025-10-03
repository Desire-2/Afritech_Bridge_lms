# CORS Issue Fix Guide for Render Deployment

## Problem
```
Access to XMLHttpRequest at 'https://afritech-bridge-lms.onrender.com/api/v1/auth/login' 
from origin 'https://study.afritechbridge.online' has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## Root Cause
The backend on Render is missing the `ALLOWED_ORIGINS` environment variable, so it's not sending proper CORS headers.

## Solution Steps

### Step 1: Set Environment Variables on Render

1. **Go to your Render Dashboard**
   - Navigate to https://dashboard.render.com
   - Find your `afritech-bridge-lms` backend service

2. **Add/Update Environment Variables**
   Add these environment variables:

   ```
   FLASK_ENV=production
   ALLOWED_ORIGINS=https://study.afritechbridge.online
   ```

   **For multiple domains (if you have staging/development environments):**
   ```
   ALLOWED_ORIGINS=https://study.afritechbridge.online,https://app.afritechbridge.online,https://dev.afritechbridge.online
   ```

3. **Required Environment Variables Checklist**
   Ensure these are all set on Render:
   
   ✅ `FLASK_ENV=production`
   ✅ `SECRET_KEY=your_generated_secret_key`
   ✅ `JWT_SECRET_KEY=your_generated_jwt_secret_key`
   ✅ `DATABASE_URL=postgresql://...` (auto-provided by Render)
   ✅ `ALLOWED_ORIGINS=https://study.afritechbridge.online`

### Step 2: Deploy the Updated Code

The code has been updated to better handle CORS configuration. Push the changes:

```bash
git add .
git commit -m "Fix CORS configuration for production deployment"
git push origin main
```

### Step 3: Restart the Service

After setting environment variables:
1. In Render dashboard, go to your service
2. Click "Manual Deploy" → "Deploy latest commit"
3. Wait for deployment to complete

### Step 4: Test the Fix

Use the CORS test script:
```bash
python test_cors.py https://afritech-bridge-lms.onrender.com https://study.afritechbridge.online
```

Expected output after fix:
```
✅ Origin allowed: https://study.afritechbridge.online
✅ POST method allowed: GET,HEAD,OPTIONS,POST,PUT,DELETE
✅ Required headers allowed: Content-Type,Authorization,X-Requested-With
✅ Credentials allowed: true
```

## Quick Fix Commands for Render Environment Variables

### Using Render CLI (if installed):
```bash
render env set FLASK_ENV=production --service-id=your-service-id
render env set ALLOWED_ORIGINS=https://study.afritechbridge.online --service-id=your-service-id
```

### Using Web Interface:
1. Dashboard → Your Service → Environment
2. Add Variable: `FLASK_ENV` = `production`
3. Add Variable: `ALLOWED_ORIGINS` = `https://study.afritechbridge.online`
4. Click "Save Changes"

## Troubleshooting

### If CORS errors persist:

1. **Check browser network tab:**
   - Look for OPTIONS request before the actual request
   - Check response headers for `Access-Control-Allow-Origin`

2. **Verify environment variables:**
   ```bash
   # Check if variables are set (you can add a debug endpoint)
   curl https://afritech-bridge-lms.onrender.com/debug/env
   ```

3. **Check service logs:**
   - Go to Render dashboard → Your service → Logs
   - Look for CORS configuration messages:
     ```
     CORS configured for production with origins: ['https://study.afritechbridge.online']
     ```

4. **Test with curl:**
   ```bash
   curl -X OPTIONS \
     -H "Origin: https://study.afritechbridge.online" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type,Authorization" \
     -v https://afritech-bridge-lms.onrender.com/api/v1/auth/login
   ```

### Common Issues:

- **No CORS headers**: `ALLOWED_ORIGINS` not set or `FLASK_ENV` not set to `production`
- **Wrong origin**: Frontend domain not included in `ALLOWED_ORIGINS`
- **Multiple domains**: Use comma separation without spaces
- **HTTP vs HTTPS**: Ensure protocol matches exactly

## Security Notes

- Only include trusted domains in `ALLOWED_ORIGINS`
- Use HTTPS in production (HTTP only for local development)
- Don't use `*` for origins in production with `supports_credentials=True`

## After the Fix

Once CORS is working:
1. ✅ Frontend can make API requests
2. ✅ Authentication will work
3. ✅ All API endpoints will be accessible from the frontend
4. ✅ The application will be fully functional