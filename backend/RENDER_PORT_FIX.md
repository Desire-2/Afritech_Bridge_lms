# Render Port Configuration Fix

## Problem Analysis

From the logs, we can see:
1. ✅ Gunicorn starts successfully 
2. ✅ CORS is configured correctly
3. ✅ Database connection works
4. ❌ **Port mismatch**: App listens on 10000, but Render expects port from PORT env var

## Root Cause

The application is binding to a hardcoded port (10000) instead of using the `PORT` environment variable that Render provides.

## Quick Fix - Render Service Configuration

### Option 1: Set Start Command (Recommended)

In your Render service settings:

**Start Command:**
```bash
cd backend && gunicorn --bind 0.0.0.0:$PORT --config gunicorn_config.py wsgi:application
```

### Option 2: Update Environment Variables

Add this environment variable in Render:
- `PORT` = `10000` (to match what the app is currently using)

### Option 3: Fix in Code (This update)

The gunicorn_config.py has been updated to properly handle the PORT environment variable.

## Render Service Configuration

Make sure these settings are correct in your Render service:

**Environment:**
- `FLASK_ENV=production`
- `DATABASE_URL=postgresql://...` (from your database)
- `SECRET_KEY=your_secret_key`
- `JWT_SECRET_KEY=your_jwt_secret_key`
- `ALLOWED_ORIGINS=https://study.afritechbridge.online`

**Build Command:**
```bash
cd backend && ./build.sh
```

**Start Command:**
```bash
cd backend && gunicorn --config gunicorn_config.py wsgi:application
```

## Testing the Fix

After deployment, check the logs for:
```
✅ Render PORT detected: 10000
✅ Updated bind address: 0.0.0.0:10000
[INFO] Listening at: http://0.0.0.0:10000
```

The key is that the bind address should match the listening address.

## Alternative Quick Fix

If the above doesn't work immediately, you can also try:

**Start Command (Alternative):**
```bash
cd backend && python -m gunicorn --bind 0.0.0.0:$PORT wsgi:application
```

This bypasses the config file and directly uses the PORT environment variable.