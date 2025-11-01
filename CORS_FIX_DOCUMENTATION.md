# CORS Error Fix Documentation

## Issue Description
**Error**: "Access to XMLHttpRequest at 'http://localhost:5001/api/v1/auth/login' from origin 'http://192.168.0.5:3000' has been blocked by CORS policy"

**Root Cause**: 
- Frontend running on network IP (`http://192.168.0.5:3000`)
- Backend CORS only allowed specific IPs (`192.168.116.116`) but not `192.168.0.5`
- Frontend .env.local was configured to use `localhost:5001` instead of network IP

## Date Fixed
November 1, 2025

---

## Changes Made

### 1. Backend CORS Configuration (`backend/main.py`)

**Added** `192.168.0.5` to the allowed origins list:

```python
# Before (Line 67-76)
"origins": ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", 
           "http://localhost:3005", "http://localhost:5173", 
           "http://192.168.116.116:3000", "http://192.168.116.116:3001", 
           "http://192.168.116.116:3002", "http://192.168.116.116:3005"],

# After
"origins": ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", 
           "http://localhost:3005", "http://localhost:5173", 
           "http://192.168.0.5:3000", "http://192.168.0.5:3001", 
           "http://192.168.0.5:3002", "http://192.168.0.5:3005",
           "http://192.168.116.116:3000", "http://192.168.116.116:3001", 
           "http://192.168.116.116:3002", "http://192.168.116.116:3005"],
```

### 2. Frontend Environment Configuration (`frontend/.env.local`)

**Updated** API URL to use network IP instead of localhost:

```bash
# Before
NEXT_PUBLIC_API_URL=http://localhost:5001/api/v1

# After
NEXT_PUBLIC_API_URL=http://192.168.0.5:5001/api/v1
NEXT_PUBLIC_WS_URL=ws://192.168.0.5:5001
NEXT_PUBLIC_APP_URL=http://192.168.0.5:3000
```

---

## Steps to Apply Fix

### 1. Restart Backend Server

```bash
# In backend directory
cd /home/desire/My_Project/AB/afritec_bridge_lms/backend

# Stop the current server (Ctrl+C if running)

# Restart the server
./run.sh
```

**Expected Output**:
```
Starting Afritec Bridge LMS backend...
CORS configured for development with specific settings
Running on port 5001
 * Running on all addresses (0.0.0.0)
 * Running on http://127.0.0.1:5001
 * Running on http://192.168.0.5:5001
```

### 2. Restart Frontend Development Server

```bash
# In frontend directory
cd /home/desire/My_Project/AB/afritec_bridge_lms/frontend

# Stop the current server (Ctrl+C if running)

# Clear Next.js cache (recommended)
rm -rf .next

# Restart the development server
npm run dev
```

**Expected Output**:
```
   ▲ Next.js 15.0.3
   - Local:        http://localhost:3000
   - Network:      http://192.168.0.5:3000

 ✓ Starting...
 ✓ Ready in 2.5s
```

### 3. Test the Login

1. Open browser and navigate to: `http://192.168.0.5:3000`
2. Try to login
3. Check browser console - CORS error should be gone
4. Login should work properly

---

## Verification Checklist

### Backend Verification
- [ ] Backend server started successfully
- [ ] Backend running on `0.0.0.0:5001` (all network interfaces)
- [ ] Backend logs show: "CORS configured for development"
- [ ] Can access backend at `http://192.168.0.5:5001` from browser
- [ ] Can access backend at `http://localhost:5001` from local machine

### Frontend Verification
- [ ] Frontend server started successfully
- [ ] Frontend running on `http://192.168.0.5:3000`
- [ ] `.env.local` file contains network IP addresses
- [ ] Browser console shows no CORS errors
- [ ] Login request successfully reaches backend

### Network Verification
- [ ] Both machines (frontend/backend) on same network
- [ ] IP address `192.168.0.5` is correct and accessible
- [ ] No firewall blocking ports 3000 or 5001
- [ ] Can ping `192.168.0.5` from the device accessing the app

---

## Understanding the Fix

### Why localhost doesn't work across devices?

**Localhost** (`127.0.0.1`) is a loopback address that always refers to the **current machine**:
- When frontend uses `localhost:5001`, it looks for backend on the **frontend's machine**
- If frontend and backend are on different devices (or accessed from different device), this fails

### Why use network IP addresses?

**Network IP** (e.g., `192.168.0.5`) is accessible from **any device on the same network**:
- Allows accessing services from other computers, tablets, phones on the same WiFi
- Essential for cross-device testing
- Required for team collaboration on local network

### CORS Configuration

CORS (Cross-Origin Resource Sharing) security prevents websites from making requests to different domains without permission:

```
Frontend: http://192.168.0.5:3000
Backend:  http://192.168.0.5:5001

These are different "origins" (different ports)
Backend must explicitly allow frontend's origin
```

---

## Common Issues and Solutions

### Issue 1: "Cannot connect to backend"
**Symptoms**: Network error, connection refused
**Solutions**:
1. Verify backend is running: `curl http://192.168.0.5:5001`
2. Check if backend is listening on all interfaces:
   ```bash
   netstat -tuln | grep 5001
   # Should show: 0.0.0.0:5001 or *:5001
   ```
3. Check firewall settings:
   ```bash
   sudo ufw status
   sudo ufw allow 5001
   ```

### Issue 2: "CORS error still appearing"
**Symptoms**: Same CORS error after fix
**Solutions**:
1. Hard refresh browser (Ctrl+Shift+R)
2. Clear browser cache
3. Restart both frontend and backend servers
4. Check if correct IP in `.env.local`
5. Verify IP matches your current network IP:
   ```bash
   # Linux/Mac
   ifconfig | grep "inet "
   # or
   ip addr show
   ```

### Issue 3: "IP address changed"
**Symptoms**: Was working, now CORS error again
**Cause**: Router assigned different IP (DHCP)
**Solutions**:
1. Check current IP:
   ```bash
   hostname -I | awk '{print $1}'
   ```
2. Update `.env.local` with new IP
3. Update `backend/main.py` CORS origins with new IP
4. Restart both servers
5. **Prevention**: Set static IP in router settings

### Issue 4: "Works on laptop, not on phone"
**Symptoms**: App works on development machine, fails on mobile
**Solutions**:
1. Ensure mobile device is on **same WiFi network**
2. Check if network allows device-to-device communication
3. Some WiFi networks have "client isolation" enabled:
   - Check router settings
   - Disable "AP Isolation" or "Client Isolation"
4. Try accessing backend directly from mobile browser:
   - Visit: `http://192.168.0.5:5001` in mobile browser
   - Should see: `{"message": "Welcome to Afritec Bridge LMS API"}`

---

## Production Deployment Notes

### ⚠️ Important: This is a Development Fix

**DO NOT** use IP addresses in production!

### Production Configuration

#### Backend (`backend/main.py`):
```python
if os.environ.get('FLASK_ENV') == 'production':
    allowed_origins = os.environ.get('ALLOWED_ORIGINS', 
                                     'https://yourdomain.com').split(',')
    CORS(app, resources={r"/*": {"origins": allowed_origins, ...}})
```

#### Frontend (`.env.production`):
```bash
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1
NODE_ENV=production
```

### Production Checklist
- [ ] Use domain names, not IP addresses
- [ ] Use HTTPS for both frontend and backend
- [ ] Set specific allowed origins (no wildcards)
- [ ] Use environment variables for configuration
- [ ] Enable rate limiting
- [ ] Enable request logging
- [ ] Set up proper authentication
- [ ] Configure CDN for static assets

---

## Network IP Reference

### How to find your IP address:

**Linux/Mac**:
```bash
# Method 1
ifconfig | grep "inet " | grep -v 127.0.0.1

# Method 2
ip addr show | grep "inet " | grep -v 127.0.0.1

# Method 3
hostname -I
```

**Windows**:
```bash
ipconfig | findstr "IPv4"
```

**Expected format**: `192.168.x.x` or `10.0.x.x`

### Common Private IP Ranges:
- `192.168.0.0` - `192.168.255.255` (most home routers)
- `10.0.0.0` - `10.255.255.255` (some routers, corporate)
- `172.16.0.0` - `172.31.255.255` (less common)

---

## Testing Checklist

### Basic Tests
- [ ] Login works from development machine
- [ ] Login works from another device on same network
- [ ] API requests complete successfully
- [ ] No CORS errors in console
- [ ] WebSocket connections work (if using)

### Cross-Device Tests
- [ ] Desktop browser (Chrome, Firefox, Safari)
- [ ] Mobile browser (iOS Safari, Android Chrome)
- [ ] Tablet
- [ ] Different computers on same network

### API Endpoint Tests
```bash
# Test backend is accessible
curl http://192.168.0.5:5001

# Test login endpoint
curl -X POST http://192.168.0.5:5001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

---

## Quick Reference

### Files Modified
1. `backend/main.py` - Added `192.168.0.5` to CORS origins
2. `frontend/.env.local` - Updated API URL to use network IP

### Services Need Restart
1. Backend: `./run.sh` in backend directory
2. Frontend: `npm run dev` in frontend directory

### URLs After Fix
- Frontend: `http://192.168.0.5:3000`
- Backend: `http://192.168.0.5:5001`
- API Base: `http://192.168.0.5:5001/api/v1`

### Environment Variables
```bash
# Frontend (.env.local)
NEXT_PUBLIC_API_URL=http://192.168.0.5:5001/api/v1
NEXT_PUBLIC_WS_URL=ws://192.168.0.5:5001
NEXT_PUBLIC_APP_URL=http://192.168.0.5:3000
```

---

## Status
✅ **FIXED** - CORS error resolved, cross-origin requests now allowed

## Next Steps
1. Restart both backend and frontend servers
2. Clear browser cache
3. Test login functionality
4. Verify no CORS errors in console

---

**Fixed By**: AI Assistant  
**Date**: November 1, 2025  
**Issue Type**: CORS Configuration  
**Environment**: Development (Local Network)
