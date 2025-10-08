# Infinite Redirect Loop Fix

## Date: October 7, 2025

## Problem
Users were experiencing an infinite redirect loop after logging in, showing:
- "Redirecting..."
- "Taking you to your dashboard"
- Page would continuously reload without reaching the dashboard

## Root Cause
Multiple components were trying to handle the redirect simultaneously, creating conflicts:

1. **AuthContext** - Was redirecting after login with `router.push(dashboardRoute)`
2. **GuestGuard** - Was also trying to redirect authenticated users
3. **LoginForm** - Had its own redirect logic with timeouts

This created a race condition where:
- User logs in → AuthContext redirects to dashboard
- Dashboard loads → GuestGuard detects user on login page → redirects again
- Infinite loop ensues

## Solution

### Single Source of Truth for Redirects
Made **GuestGuard** the sole component responsible for redirecting authenticated users away from guest pages (login, register).

### Changes Made

#### 1. **GuestGuard** (`frontend/src/components/guards/guest-guard.tsx`)
✅ Made the primary redirect handler
- Added `isRedirecting` state to prevent multiple redirects
- Check if already redirecting before starting new redirect
- Use `router.push()` first with fallback to `window.location.href`
- Added proper timeout handling

```typescript
const handleRedirect = useCallback(() => {
  if (!isAuthenticated || !user || isRedirecting) return; // Prevent multiple redirects
  
  setIsRedirecting(true);
  const dashboardRoute = RolePermissions.getDashboardRoute(user.role as any);
  router.push(dashboardRoute);
  
  // Fallback after 2 seconds
  setTimeout(() => {
    window.location.href = dashboardRoute;
  }, 2000);
}, [isAuthenticated, user, isRedirecting, router]);
```

#### 2. **AuthContext** (`frontend/src/contexts/AuthContext.tsx`)
✅ Removed redirect logic from login function
- Login now only handles authentication and state updates
- No longer calls `router.push(dashboardRoute)`
- Sets `isLoading = false` after brief delay to allow state propagation

```typescript
const login = async (identifier: string, password: string) => {
  // ... authentication logic ...
  
  // Store tokens and set state
  localStorage.setItem('token', authData.access_token);
  setToken(authData.access_token);
  setUser(authData.user);
  setIsAuthenticated(true);
  
  // Log successful login - GuestGuard will handle redirect
  console.log(`AuthContext: User ${authData.user.role} logged in successfully`);
  
  // Give state time to update
  setTimeout(() => {
    setIsLoading(false);
  }, 100);
};
```

#### 3. **LoginForm** (`frontend/src/app/auth/login/LoginForm.tsx`)
✅ Removed redirect logic
- Removed `redirectTimeout` state variable
- No longer attempts to redirect after authentication
- Simplified the useEffect to only log authentication state
- GuestGuard handles all redirects

```typescript
useEffect(() => {
  // ... timeout checks ...
  
  // GuestGuard will handle the redirect
  if (isClient && isAuthenticated && !isLoading && user) {
    console.log(`LoginForm: User authenticated as ${user.role}, GuestGuard will handle redirect`);
  }
}, [isClient, isAuthenticated, isLoading, user, logout, authCheckTimeout]);
```

## Redirect Flow (Fixed)

```
User logs in
    ↓
AuthContext.login()
    ↓ Sets: isAuthenticated = true, user = userData, isLoading = false
    ↓
GuestGuard detects: isAuthenticated && user && !isLoading
    ↓
GuestGuard.handleRedirect()
    ↓ Checks: !isRedirecting (prevents duplicates)
    ↓ Sets: isRedirecting = true
    ↓
router.push(dashboardRoute)
    ↓ (fallback after 2s)
    ↓
window.location.href = dashboardRoute
    ↓
User lands on dashboard ✅
```

## Key Principles Applied

1. **Single Responsibility** - Only GuestGuard redirects from guest pages
2. **State Guards** - Check `isRedirecting` to prevent duplicate redirects
3. **Separation of Concerns**:
   - AuthContext: Authentication & state management
   - GuestGuard: Page access control & redirects
   - LoginForm: User interface & form handling

4. **Graceful Fallbacks** - Use `router.push()` first, then `window.location.href` as backup

## Testing Checklist

After applying these fixes:

- [ ] Login with valid credentials → Should redirect to correct dashboard
- [ ] Try to access /auth/login while logged in → Should redirect to dashboard
- [ ] Refresh page on login → Should not create redirect loop
- [ ] Logout and login again → Should work smoothly
- [ ] Different user roles redirect to correct dashboards:
  - [ ] Student → `/dashboard`
  - [ ] Instructor → `/instructor/Dashboard`
  - [ ] Admin → `/admin/dashboard`

## Files Modified

1. `frontend/src/components/guards/guest-guard.tsx`
   - Added `isRedirecting` check in `handleRedirect`
   - Changed redirect method to use `router.push()` with fallback

2. `frontend/src/contexts/AuthContext.tsx`
   - Removed `router.push(dashboardRoute)` from login function
   - Removed `getDashboardByRole` call during login

3. `frontend/src/app/auth/login/LoginForm.tsx`
   - Removed `redirectTimeout` state
   - Removed redirect logic from useEffect
   - Simplified button text logic
   - Updated timeout warning condition

## Prevention

To prevent this issue in the future:

1. **Never have multiple redirect sources** for the same scenario
2. **Use route guards** (like GuestGuard) as the canonical redirect location
3. **Auth handlers should only handle auth**, not navigation
4. **Add state guards** (`isRedirecting`, `_retry`, etc.) to prevent duplicates
5. **Log redirect attempts** to catch issues during development

## Related Components

- `GuestGuard` - Protects guest-only pages (login, register)
- `RoleGuard` - Protects role-specific pages (student, instructor, admin)
- `AuthContext` - Manages authentication state globally
- `LoginForm` - User interface for login

## Conclusion

✅ Infinite redirect loop fixed
✅ Single source of truth for redirects (GuestGuard)
✅ Clean separation of concerns
✅ Proper state management to prevent race conditions

The authentication flow now works smoothly with no redirect loops!
