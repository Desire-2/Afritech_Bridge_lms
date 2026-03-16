# CORS and Analytics Timeout Fix Guide

## Issue
You were getting:
- **CORS Error**: `Access to XMLHttpRequest blocked by CORS policy`
- **502 Bad Gateway**: Analytics endpoint timing out

## Root Causes
1. **CORS**: Frontend domain `https://study.afritechbridge.online` not in `ALLOWED_ORIGINS` env var
2. **502 Timeout**: Analytics queries too complex, causing database timeout on large datasets

## Solution

### Step 1: Fix CORS on Render (Production)

**Go to your Render dashboard and set this environment variable:**

```
ALLOWED_ORIGINS=https://study.afritechbridge.online,https://afritech-bridge-lms-pc6f.onrender.com
```

Then restart the backend service.

### Step 2: Analytics Query Optimization (Already Applied)

The backend code has been updated to:
- ✅ Limit course queries to 100 (prevent N+1 queries)
- ✅ Limit student processing to 500 max (prevent memory overflow)
- ✅ Sample students (top 50) for performance rankings (reduce computation)
- ✅ Add early exits for large datasets
- ✅ Better error handling with graceful degradation
- ✅ Add `data_limited` flag to response when datasets are large

**New Response Structure:**
```json
{
  "overview": {
    "total_students": 1500,
    "active_students": 250,
    "total_courses": 5,
    "activity_rate": 16.67,
    "data_limited": true  // ← New flag: true if data was sampled
  },
  "course_analytics": [...],
  "students_performance": [...],
  "struggling_students": [...],
  "top_performers": [...]
}
```

## Deployment Steps

1. **Deploy Backend Changes**
   ```bash
   git push origin main
   ```
   This pushes the optimized analytics service

2. **Update Render Environment Variables**
   - Go to Render Dashboard
   - Select your backend service
   - Go to Environment tab
   - Add/Update `ALLOWED_ORIGINS`:
     ```
     ALLOWED_ORIGINS=https://study.afritechbridge.online,https://afritech-bridge-lms-pc6f.onrender.com
     ```
   - Click "Save Changes"
   - Service will auto-restart

3. **Verify the Fix**
   - Open browser DevTools (F12)
   - Go to Network tab
   - Try clicking "Load Student Analytics"
   - Check that:
     - Request returns 200 OK (not 502)
     - No CORS errors in console
     - Response has data (not error)

## Testing Locally

To test CORS locally first:

```bash
# In backend/.env
FLASK_ENV=development
DEV_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Or if frontend is on different port
DEV_ALLOWED_ORIGINS=http://your-local-frontend:port
```

Then restart: `./run.sh`

## If You Still Get 502 Error

The response now includes `data_limited: true` flag when datasets are sampled. If you still get timeouts:

1. **Check Render logs**: Go to Render Dashboard → Logs → look for errors
2. **Check database**: Ensure database is not connection-pool exhausted
3. **Increase response timeout** (if needed): Contact Render support

The backend now returns partial data for large datasets instead of timing out.

## CORS Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `No 'Access-Control-Allow-Origin' header` | Domain not in ALLOWED_ORIGINS | Add domain to env var |
| `502 Bad Gateway` | Backend timeout | Already optimized, may need DB optimization |
| `CORS policy: wildcard not allowed with credentials` | Wrong CORS config | Use specific domains, not `*` |

## Summary of Changes

- ✅ Analytics service queries optimized
- ✅ Better error recovery
- ✅ Large dataset handling  
- ⏳ Pending: Update ALLOWED_ORIGINS on Render
- ⏳ Pending: Restart backend service on Render
