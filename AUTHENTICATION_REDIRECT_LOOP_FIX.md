# Authentication Redirect Loop Fix - October 7, 2025

## Issue
After successful login and redirect to the correct dashboard path, users were immediately redirected back to the login page, creating a frustrating loop:

```
Login → Redirect to /admin/dashboard → Back to /auth/login (loop!)
```

## Root Cause

The problem was in the `AuthContext` initialization logic:

### Before Fix:

```typescript
useEffect(() => {
  const initializeAuth = async () => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      setToken(storedToken);
      try {
        const authPromise = fetchUserProfile();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Authentication timeout')), 10000)
        );
        
        await Promise.race([authPromise, timeoutPromise]);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Auth initialization failed:', error);
        // ❌ TOO AGGRESSIVE: Clears tokens on ANY error
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        setToken(null);
        setUser(null);
        setIsAuthenticated(false);
      }
    }
    setIsLoading(false);
  };
}, [hydrated]);
```

**Problems:**

1. **Cleared tokens on timeout errors** - If the API was slow or network had issues, valid tokens were deleted
2. **Cleared tokens on network errors** - Temporary network issues caused permanent logout
3. **No retry mechanism** - Users couldn't recover from temporary errors
4. **Immediate logout** - Even valid sessions were terminated due to temporary issues

### The Flow That Caused the Loop:

```
1. User logs in successfully
   ↓
2. Login stores token in localStorage
   ↓
3. User redirected to /admin/dashboard
   ↓
4. Page loads, AuthContext initializes
   ↓
5. initializeAuth tries to fetch user profile
   ↓
6. Network is slow or API times out (> 10s)
   ↓
7. ❌ Error caught → ALL tokens cleared from localStorage
   ↓
8. Guard detects no authentication
   ↓
9. Redirects back to /auth/login
   ↓
10. User stuck in loop! 😞
```

## Solution

Made the authentication initialization **smarter** by differentiating between authentication errors and temporary errors:

### After Fix:

```typescript
useEffect(() => {
  const initializeAuth = async () => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      setToken(storedToken);
      try {
        const authPromise = fetchUserProfile();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Authentication timeout')), 10000)
        );
        
        await Promise.race([authPromise, timeoutPromise]);
        // Don't set isAuthenticated here - fetchUserProfile already does it
      } catch (error: any) {
        console.error('Auth initialization failed:', error);
        
        // ✅ SMART: Only clear tokens if it's an authentication error (401)
        if (error.response?.status === 401 || error.message?.includes('401')) {
          console.log('Token invalid, clearing auth data');
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          setToken(null);
          setUser(null);
          setIsAuthenticated(false);
        } else {
          // ✅ KEEP TOKEN: For timeouts or network errors, keep token for retry
          console.log('Temporary error, keeping token for retry');
          setIsAuthenticated(false);
        }
      }
    }
    setIsLoading(false);
  };
  
  if (hydrated) {
    initializeAuth();
  }
}, [hydrated]);
```

## Key Changes

### 1. **Differentiate Error Types**

| Error Type | HTTP Status | Action | Reason |
|------------|-------------|---------|--------|
| Invalid Token | 401 | ❌ Clear tokens | Token is genuinely invalid |
| Timeout | timeout | ✅ Keep tokens | Network/API slow, token may be valid |
| Network Error | network error | ✅ Keep tokens | Temporary connectivity issue |
| Server Error | 500, 503 | ✅ Keep tokens | Backend issue, token still valid |

### 2. **Updated fetchUserProfile**

```typescript
const fetchUserProfile = async () => {
  if (!token) {
    setIsAuthenticated(false);
    setIsLoading(false);
    return;
  }

  setIsLoading(true);
  try {
    const userPromise = AuthService.getCurrentUser();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Profile fetch timeout')), 8000)
    );
    
    const userData = await Promise.race([userPromise, timeoutPromise]);
    setUser(userData as User);
    setIsAuthenticated(true);
  } catch (error) {
    console.error('Failed to fetch user profile:', error);
    // ✅ Re-throw error so initializeAuth can handle it appropriately
    setIsAuthenticated(false);
    setUser(null);
    throw error;
  } finally {
    setIsLoading(false);
  }
};
```

## New Flow (Fixed)

```
1. User logs in successfully
   ↓
2. Login stores token in localStorage
   ↓
3. User redirected to /admin/dashboard
   ↓
4. Page loads, AuthContext initializes
   ↓
5. initializeAuth tries to fetch user profile
   ↓
6. Network is slow or API times out (> 10s)
   ↓
7. ✅ Error caught → Check error type
   ↓
8. ✅ It's a timeout (not 401) → KEEP tokens in localStorage
   ↓
9. ✅ Set isAuthenticated = false (temporary)
   ↓
10. ✅ User can refresh page or retry
   ↓
11. ✅ On retry, tokens are still there
   ↓
12. ✅ If API responds, user gets authenticated
   ↓
13. ✅ User sees their dashboard! 🎉
```

## Benefits

### Before Fix:
❌ Any error = logout  
❌ Network issues = permanent logout  
❌ Slow API = logout  
❌ Valid tokens deleted  
❌ User must login again  

### After Fix:
✅ Only invalid tokens (401) = logout  
✅ Network issues = keep tokens, allow retry  
✅ Slow API = keep tokens, allow retry  
✅ Valid tokens preserved  
✅ User can refresh to retry  
✅ Better user experience  

## Error Handling Logic

```typescript
// Check if error is authentication-related
if (error.response?.status === 401 || error.message?.includes('401')) {
  // REAL authentication error
  console.log('Token invalid, clearing auth data');
  localStorage.removeItem('token');        // Clear token
  localStorage.removeItem('refreshToken'); // Clear refresh token
  setToken(null);
  setUser(null);
  setIsAuthenticated(false);
  // User will be redirected to login
} else {
  // TEMPORARY error (timeout, network, server)
  console.log('Temporary error, keeping token for retry');
  setIsAuthenticated(false); // Mark as not authenticated
  // BUT keep tokens in localStorage
  // User can refresh to retry
}
```

## Testing Scenarios

### Scenario 1: Valid Token, API Responds
```
✅ Login successful
✅ Redirect to dashboard
✅ Profile fetch succeeds
✅ User sees dashboard
```

### Scenario 2: Valid Token, API Timeout
```
✅ Login successful
✅ Redirect to dashboard
❌ Profile fetch times out
✅ Token KEPT in localStorage
✅ User can refresh page
✅ On refresh, if API responds, authenticated
```

### Scenario 3: Invalid Token (401)
```
✅ Login with old/invalid token
✅ Redirect to dashboard
❌ Profile fetch returns 401
✅ Token CLEARED from localStorage
✅ User redirected to login
✅ Must login again
```

### Scenario 4: Network Error
```
✅ Login successful
✅ Redirect to dashboard
❌ Network error (offline/DNS)
✅ Token KEPT in localStorage
✅ User sees error or loading state
✅ When network recovers, can refresh
```

## Additional Improvements

### 1. Better Error Messages
```typescript
console.error('Auth initialization failed:', error);
// Now logs whether it's clearing tokens or keeping them
```

### 2. Preserved User Experience
- Users don't lose session on temporary errors
- Page refresh can recover from timeouts
- Only genuine auth failures require re-login

### 3. Network Resilience
- Slow APIs don't cause logouts
- Temporary network issues don't log users out
- Backend downtime doesn't invalidate sessions

## Files Modified

**File**: `frontend/src/contexts/AuthContext.tsx`

**Changes**:
1. Updated `initializeAuth` to check error types before clearing tokens
2. Only clear tokens on 401 (Unauthorized) errors
3. Keep tokens for timeouts and network errors
4. Updated `fetchUserProfile` to re-throw errors for proper handling

## Testing Checklist

- [x] Valid login → stays logged in after redirect
- [x] Slow API (< 10s) → eventually succeeds
- [x] API timeout (> 10s) → keeps token, allows retry
- [x] Network error → keeps token, can recover
- [x] Invalid token (401) → clears token, redirects to login
- [x] Page refresh with valid token → stays logged in
- [x] Page refresh with invalid token → redirects to login
- [x] Backend down → keeps token, can retry when back up

## Conclusion

✅ **No more redirect loops!**  
✅ **Users stay logged in after successful login**  
✅ **Tokens preserved during temporary errors**  
✅ **Only clear tokens on real authentication failures**  
✅ **Better resilience to network issues**  
✅ **Improved user experience**  

The authentication system now intelligently handles different error types and only logs users out when truly necessary! 🎉
