# 🔧 Port Configuration Fix - PORT 5001

## ✅ Issue Resolved

**Problem:** Backend running on port 5001, but achievementApi.ts was pointing to port 5000  
**Solution:** Updated achievementApi.ts to use port 5001

## Changes Made

### File: `/frontend/src/services/achievementApi.ts`

```typescript
// BEFORE
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// AFTER
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
```

## ✅ All API Files Now Using Port 5001

- ✅ `/src/lib/api-client.ts` → Port 5001
- ✅ `/src/services/achievementApi.ts` → Port 5001 (JUST FIXED)
- ✅ `/src/services/studentApi.ts` → Port 5001
- ✅ `/src/services/api/base.service.ts` → Port 5001
- ✅ All other API files → Port 5001

## 🚀 Restart Instructions

### Step 1: Restart Frontend (Required)

```bash
# In frontend directory
cd /home/desire/My_Project/AB/afritec_bridge_lms/frontend

# Stop any running dev server
pkill -f "next dev"

# Start fresh
npm run dev
```

**Important:** You MUST restart the frontend for the port change to take effect!

### Step 2: Verify Backend Running

```bash
# Check backend is running on port 5001
curl http://localhost:5001/api/v1/achievements/
```

**Expected:** Should return JSON response with achievements data (or error if no auth)

### Step 3: Test Achievement Page

1. Open browser: http://localhost:3000/student/achievements
2. Open Developer Console (F12)
3. Check Network tab

**Expected Results:**
- ✅ API calls go to `http://localhost:5001/api/v1/achievements/`
- ✅ No hydration errors
- ✅ Data loads correctly

## 🔍 Troubleshooting

### Still seeing hydration errors?

1. **Hard refresh browser:**
   ```
   Ctrl + Shift + R (Linux/Windows)
   Cmd + Shift + R (Mac)
   ```

2. **Clear browser cache:**
   ```
   Ctrl + Shift + Delete
   → Clear cached images and files
   ```

3. **Check Network tab:**
   - Look for requests to `/api/v1/achievements/`
   - Should be going to port 5001
   - Check status codes (200 = success, 401 = need login, 500 = backend error)

### Backend not responding?

```bash
# Check if backend is running
ps aux | grep python | grep main.py

# Check if port 5001 is in use
lsof -i :5001

# Restart backend if needed
cd /home/desire/My_Project/AB/afritec_bridge_lms/backend
./run.sh
```

### Still getting 401 Unauthorized?

You need to be logged in as a student:
1. Go to http://localhost:3000/auth/signin
2. Log in with student credentials
3. Then visit http://localhost:3000/student/achievements

## 📝 Environment Variables (Optional)

For production or custom ports, create `.env.local`:

```bash
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:5001/api/v1
```

Then restart frontend.

## ✅ Expected After Restart

### Console Should Show:
```
✓ Ready in 1.2s
○ Compiling /student/achievements ...
✓ Compiled /student/achievements in 500ms
```

### Network Tab Should Show:
```
GET http://localhost:5001/api/v1/achievements/                 200 OK
GET http://localhost:5001/api/v1/achievements/earned           200 OK
GET http://localhost:5001/api/v1/achievements/summary          200 OK
GET http://localhost:5001/api/v1/achievements/streak           200 OK
GET http://localhost:5001/api/v1/achievements/points           200 OK
GET http://localhost:5001/api/v1/achievements/quests           200 OK
GET http://localhost:5001/api/v1/achievements/leaderboards     200 OK
```

### Browser Should Show:
```
✅ Achievements page loads
✅ All 5 tabs functional
✅ No hydration errors
✅ No console errors
```

## 🎯 Quick Test Command

Run this after restart:

```bash
# Test backend connectivity
curl http://localhost:5001/api/v1/achievements/ -H "Authorization: Bearer YOUR_TOKEN"

# Or just visit in browser (will redirect to login if not authenticated)
# http://localhost:3000/student/achievements
```

## ⚡ TL;DR - Quick Fix

```bash
# 1. Stop frontend
pkill -f "next dev"

# 2. Start frontend fresh
cd /home/desire/My_Project/AB/afritec_bridge_lms/frontend
npm run dev

# 3. Hard refresh browser (Ctrl+Shift+R)

# 4. Visit: http://localhost:3000/student/achievements
```

**The port configuration is now correct!** Just restart the frontend and you should see the hydration errors disappear. 🚀
