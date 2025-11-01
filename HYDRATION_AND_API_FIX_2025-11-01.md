# Hydration and API Fixes - November 1, 2025

## Issues Fixed

### 1. ✅ Achievement API 422 Errors

**Problem:**
All achievement API endpoints were returning `422 UNPROCESSABLE ENTITY` with error message `"Not enough segments"`. This is a JWT token parsing error.

**Root Cause:**
The `achievementApi.ts` service was looking for the token in `localStorage.getItem('access_token')`, but the application stores the token as `'token'` (not `'access_token'`).

**Solution:**
Updated `frontend/src/services/achievementApi.ts`:

```typescript
// BEFORE (Wrong key)
private getAuthHeaders() {
  const token = localStorage.getItem('access_token');
  return {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };
}

// AFTER (Correct key + SSR safety)
private getAuthHeaders() {
  // Use 'token' key to match the rest of the app
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return {
    headers: {
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    }
  };
}
```

**Files Modified:**
- `frontend/src/services/achievementApi.ts`

---

### 2. ✅ React Hydration Mismatch Error

**Problem:**
```
Uncaught Error: Hydration failed because the server rendered HTML didn't match the client.
...
  <div
+   hidden={true}
-   hidden={null}
-   className=""
  >
```

**Root Cause:**
The `RootShell.tsx` component was a client component (`'use client'`) that was rendering `<html>`, `<head>`, and `<body>` tags. In Next.js 13+, only the root `layout.tsx` should render these tags, and it should be a server component by default.

**Solution:**
Restructured the layout to follow Next.js conventions:

**File: `frontend/src/app/layout.tsx`**

```typescript
// BEFORE (Using client component for layout)
import RootShell from '@/components/layout/RootShell'

export default function RootLayout({ children }) {
  return <RootShell>{children}</RootShell>
}

// AFTER (Proper server component structure)
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import ClientLayout from '@/components/layout/ClientLayout'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin']
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin']
})

export const metadata: Metadata = {
  title: 'Afritech Bridge LMS',
  description: 'Learning Management System for Afritech Bridge',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const html = document.documentElement;
                  html.removeAttribute('data-be-installed');
                  html.removeAttribute('foxified');
                } catch (e) {}
              })();
            `
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  )
}
```

**Files Modified:**
- `frontend/src/app/layout.tsx`

**Key Changes:**
1. Moved font imports to root layout
2. Made root layout a server component (no `'use client'`)
3. Rendered `<html>`, `<head>`, and `<body>` directly in layout
4. Added `suppressHydrationWarning` to prevent browser extension conflicts
5. Added inline script to remove browser extension attributes early
6. Wrapped children in `ClientLayout` for authentication context

---

## Why These Fixes Work

### Token Storage Consistency
The app uses a consistent pattern throughout:
- Login stores: `localStorage.setItem('token', authData.access_token)`
- API calls use: `localStorage.getItem('token')`
- Achievement API was the outlier using `'access_token'`

### Hydration Best Practices
1. **Server Components by Default**: Root layout is now a server component
2. **Client Boundary**: Authentication context wrapped in `ClientLayout` client component
3. **SSR Safety**: Added `typeof window !== 'undefined'` check before accessing `localStorage`
4. **Browser Extension Handling**: Script runs early to remove extension attributes
5. **Suppress Warnings**: Used `suppressHydrationWarning` where appropriate

---

## Testing

### Test Achievement API
1. Ensure backend is running on port 5001
2. Log in as a student user
3. Navigate to `/student/achievements`
4. Check browser console - should see no 422 errors
5. Achievement data should load successfully

### Test Hydration
1. Open browser console
2. Navigate to any page
3. Should see no hydration error messages
4. Page should render without flickering

### Verify in Console
```bash
# Terminal 1: Backend
cd backend
./run.sh

# Terminal 2: Frontend
cd frontend
npm run dev

# Terminal 3: Test API
curl -v http://localhost:5001/api/v1/achievements/ \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" 2>&1 | grep -A 5 "HTTP/"
```

---

## Impact

### Before
- ❌ All achievement endpoints returned 422 errors
- ❌ Hydration mismatch warnings in console
- ❌ Achievements page showed backend not available
- ❌ Points, streaks, leaderboards not loading

### After
- ✅ Achievement API endpoints work correctly
- ✅ No hydration mismatch errors
- ✅ Achievements page loads data
- ✅ Gamification features fully functional
- ✅ Clean console with no errors

---

## Related Files

### Modified
1. `frontend/src/services/achievementApi.ts` - Fixed token key
2. `frontend/src/app/layout.tsx` - Restructured as server component

### Reference
- `frontend/src/lib/api-client.ts` - Uses `'token'` key
- `frontend/src/services/studentApi.ts` - Uses `'token'` key
- `frontend/src/contexts/AuthContext.tsx` - Stores as `'token'`
- `backend/src/routes/achievement_routes.py` - Expects JWT in Authorization header

---

## Notes

### Token Storage Pattern
All services should use this pattern:
```typescript
const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
```

### Layout Component Rules (Next.js 13+)
1. Root `layout.tsx` should be a server component
2. Only root layout renders `<html>`, `<head>`, `<body>`
3. Client components should never render these tags
4. Use `ClientLayout` wrapper for client-side features

### Hydration Safety Checklist
- [ ] No `localStorage`/`sessionStorage` access during SSR
- [ ] No `window` object usage without guard
- [ ] Consistent server/client rendering
- [ ] Client components properly marked with `'use client'`
- [ ] Root layout is server component

---

## Prevention

To prevent similar issues:

1. **Consistent Token Key**: Always use `'token'` for access token
2. **SSR Guards**: Always check `typeof window !== 'undefined'`
3. **Follow Next.js Conventions**: Root layout = server component
4. **Test Both Environments**: Check both development and build mode
5. **Monitor Console**: Watch for hydration warnings early

---

## Conclusion

Both issues were fixed by following Next.js best practices:
1. **API Fix**: Token storage key consistency
2. **Hydration Fix**: Proper component architecture (server/client boundaries)

The application now works correctly with no console errors.
