# Login Form - Quick Error Reference Guide

## Common Error Scenarios & Messages

### Authentication Errors (401)

#### 1. Account Not Found
**Trigger**: User enters email/username that doesn't exist in database

**API Response**:
```json
{
  "status": 401,
  "error_type": "authentication_error",
  "message": "No account found...",
  "details": {
    "user_not_found": true
  }
}
```

**User Sees**:
```
⚠️ No account found with this email or username. 
   Please check your credentials or create a new account.

┌─────────────────────────────────────────────┐
│ 🔍 Account not found with these credentials.│
│                                              │
│ Need an account? Create one here             │
└─────────────────────────────────────────────┘
```

**Action**: Link to `/auth/register`

---

#### 2. Incorrect Password
**Trigger**: User enters valid email/username but wrong password

**API Response**:
```json
{
  "status": 401,
  "error_type": "authentication_error",
  "message": "Incorrect password...",
  "details": {
    "invalid_password": true
  }
}
```

**User Sees**:
```
⚠️ Incorrect password. Please try again or reset your password.

┌─────────────────────────────────────────────┐
│ 🔒 The password you entered is incorrect.   │
│                                              │
│ Reset your password or try again             │
└─────────────────────────────────────────────┘
```

**Action**: Link to `/auth/forgot-password`

---

### Validation Errors (400/422)

#### 3. Empty Fields
**Trigger**: User submits form without filling required fields

**Client-Side Validation**:
```typescript
identifier: "Email or username is required"
password: "Password is required"
```

**User Sees**:
```
Email or Username
[Red bordered input field]
┌──────────────────────────────────────────┐
│ ⚠ Email or username is required          │
└──────────────────────────────────────────┘

Password
[Red bordered input field]
┌──────────────────────────────────────────┐
│ ⚠ Password is required                   │
└──────────────────────────────────────────┘
```

**Note**: Prevents form submission

---

#### 4. Invalid Email Format
**Trigger**: User enters malformed email address

**Client-Side Validation**:
```typescript
identifier: "Please enter a valid email address"
```

**User Sees**:
```
⚠️ Please enter a valid email address.

┌─────────────────────────────────────────────┐
│ 💡 Please enter a valid email address       │
│    (e.g., user@example.com) or use your     │
│    username instead                          │
└─────────────────────────────────────────────┘
```

---

#### 5. Password Too Short
**Trigger**: User enters password less than 3 characters

**Client-Side Validation**:
```typescript
password: "Password must be at least 3 characters long"
```

**User Sees**:
```
Password
[Red bordered input field]
┌──────────────────────────────────────────────┐
│ ⚠ Password must be at least 3 characters    │
│   long                                       │
└──────────────────────────────────────────────┘
```

---

### Network Errors

#### 6. No Internet Connection
**Trigger**: Network is unavailable, API request fails

**Error Object**:
```typescript
{
  status: undefined,
  response: undefined,
  message: "Network Error"
}
```

**User Sees**:
```
⚠️ Unable to connect to the server. 
   Please check your internet connection.

┌─────────────────────────────────────────────┐
│ 🌐 Please check your internet connection    │
│    and try again                             │
└─────────────────────────────────────────────┘
```

---

#### 7. Request Timeout
**Trigger**: Login request takes longer than 15 seconds

**User Sees**:
```
⚠️ Login request timed out. Please check your 
   connection and try again.
```

---

### Server Errors (500)

#### 8. Internal Server Error
**Trigger**: Backend encounters an error

**API Response**:
```json
{
  "status": 500,
  "error_type": "server_error",
  "message": "Internal server error..."
}
```

**User Sees**:
```
⚠️ Server error. Please try again later or contact 
   support if the problem persists.

┌─────────────────────────────────────────────┐
│ ⚙️ We're experiencing technical difficulties.│
│   Please try again in a few moments.         │
└─────────────────────────────────────────────┘
```

---

#### 9. Service Unavailable (503)
**Trigger**: Server is temporarily down or overloaded

**User Sees**:
```
⚠️ Service temporarily unavailable. Please try 
   again in a few moments.

┌─────────────────────────────────────────────┐
│ ⚙️ We're experiencing technical difficulties.│
│   Please try again in a few moments.         │
└─────────────────────────────────────────────┘
```

---

## Success Scenarios

### 10. Account Created
**Trigger**: User redirected from registration page

**URL**: `/auth/login?registered=true`

**User Sees**:
```
✅ 🎉 Account created successfully!

Welcome to Afritec Bridge! Please log in with your 
credentials to get started.
```

---

### 11. Password Reset Complete
**Trigger**: User redirected from password reset page

**URL**: `/auth/login?reset=success`

**User Sees**:
```
✅ ✅ Password reset successful!

You can now log in with your new password.
```

---

### 12. General Info Message
**Trigger**: Custom message passed via URL parameter

**URL**: `/auth/login?message=Your+session+expired`

**User Sees**:
```
ℹ️ Your session expired
```

---

## Loading States

### 13. Form Submission
**Trigger**: User clicks "Sign In" button

**User Sees**:
```
Button: [Spinner] Signing In...
Below: Verifying your credentials...
```

**Button State**: Disabled, cursor: not-allowed

---

## Error Priority & Display Rules

### Priority Order (Top to Bottom):
1. ✅ **Success Messages** (green banner)
2. ⚠️ **Authentication Errors** (red banner with context)
3. ⚠️ **Validation Errors** (inline under fields)
4. ℹ️ **Info Messages** (blue banner)

### Display Rules:
- ✅ Only one main error/success banner shows at a time
- ✅ Field validation errors always show inline
- ✅ Errors auto-clear when user starts typing
- ✅ Success messages persist until dismissed or page reload
- ✅ Loading states take precedence over buttons

---

## Code Examples

### Setting Error Message
```typescript
// In catch block
setError('Unable to connect to the server. Please check your internet connection.');
```

### Setting Success Message
```typescript
setSuccessMessage('🎉 Account created successfully!');
```

### Clearing Errors on Input
```typescript
useEffect(() => {
  if (identifier !== '' && error) {
    setError('');
  }
}, [identifier, error]);
```

### Using ApiErrorHandler
```typescript
try {
  await login(identifier, password);
} catch (err: any) {
  if (err.error_type === 'authentication_error') {
    const message = ApiErrorHandler.getLoginErrorMessage(err);
    setError(message);
  }
}
```

---

## Testing Commands

### Test Scenarios in Browser Console:

```javascript
// 1. Test with non-existent account
// Enter: fake@example.com / password123

// 2. Test with wrong password (create test account first)
// Enter: real@example.com / wrongpassword

// 3. Test with invalid email
// Enter: notanemail / password123

// 4. Test with empty fields
// Click Sign In without entering anything

// 5. Test network error
// Open DevTools > Network > Offline, then try to log in

// 6. Test server error
// Stop backend server, then try to log in

// 7. Test success messages
// Go to: /auth/login?registered=true
// Go to: /auth/login?reset=success
// Go to: /auth/login?message=Custom+message
```

---

## Customization Guide

### Adding New Error Type

1. **Add condition in catch block**:
```typescript
else if (err.error_type === 'new_error_type') {
  errorMessage = 'Your custom error message';
}
```

2. **Add contextual help in JSX**:
```tsx
{error.toLowerCase().includes('your error keyword') && (
  <div className="mt-2 p-2 bg-red-500/5 rounded border border-red-500/10">
    <p className="text-red-400/80 text-xs mb-1.5">
      🔔 Your help text here
    </p>
  </div>
)}
```

3. **Update ApiErrorHandler** (if needed):
```typescript
// In getLoginErrorMessage method
if (error.details.your_new_field) {
  return 'Your user-friendly message here';
}
```

---

## Icon Reference

| Icon | Unicode | Usage |
|------|---------|-------|
| ⚠️ | U+26A0 | General warnings/errors |
| 🔍 | U+1F50D | Account not found |
| 🔒 | U+1F512 | Password issues |
| 💡 | U+1F4A1 | Tips/suggestions |
| 🌐 | U+1F310 | Network/connection |
| ⚙️ | U+2699 | Server/technical issues |
| ✅ | U+2705 | Success/completion |
| 🎉 | U+1F389 | Celebration/welcome |
| ℹ️ | U+2139 | Information |

---

## Support & Debugging

### Check Error Object
```typescript
console.log('Error details:', {
  message: err.message,
  status: err.status,
  error_type: err.error_type,
  details: err.details
});
```

### Check State
```typescript
console.log('Form state:', {
  error,
  validationErrors,
  isSubmitting,
  identifier,
  password: '***'
});
```

### Network Inspector
1. Open DevTools > Network
2. Filter by: XHR
3. Look for: `/auth/login`
4. Check: Status Code, Response

---

## Quick Reference Card

```
┌────────────────────────────────────────────────┐
│ LOGIN ERROR QUICK REFERENCE                    │
├────────────────────────────────────────────────┤
│ Account not found    → Show "Create account"   │
│ Wrong password       → Show "Reset password"   │
│ Invalid email        → Show format help        │
│ Network error        → Show connection help    │
│ Server error         → Show retry message      │
│ Empty fields         → Show inline validation  │
│ Success redirect     → Show success banner     │
├────────────────────────────────────────────────┤
│ ALL ERRORS: Clear on typing                    │
│ ALL LINKS: Contextual & helpful                │
│ ALL MESSAGES: User-friendly language           │
└────────────────────────────────────────────────┘
```
