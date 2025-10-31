# Login Form - Error & Message Examples

## Visual Examples of Enhanced Error & Message Display

### 1. Account Not Found Error
```
┌──────────────────────────────────────────────────────┐
│ ⚠️  Error Display                                     │
├──────────────────────────────────────────────────────┤
│  ⚠  No account found with this email or username.   │
│     Please check your credentials or create a new    │
│     account.                                          │
│                                                       │
│  ┌────────────────────────────────────────────────┐ │
│  │ 🔍 Account not found with these credentials.   │ │
│  │                                                 │ │
│  │ Need an account? Create one here                │ │
│  └────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### 2. Incorrect Password Error
```
┌──────────────────────────────────────────────────────┐
│ ⚠️  Error Display                                     │
├──────────────────────────────────────────────────────┤
│  ⚠  Incorrect password. Please try again or reset   │
│     your password.                                    │
│                                                       │
│  ┌────────────────────────────────────────────────┐ │
│  │ 🔒 The password you entered is incorrect.      │ │
│  │                                                 │ │
│  │ Reset your password or try again                │ │
│  └────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### 3. Invalid Email Format Error
```
┌──────────────────────────────────────────────────────┐
│ ⚠️  Error Display                                     │
├──────────────────────────────────────────────────────┤
│  ⚠  Please enter a valid email address.             │
│                                                       │
│  ┌────────────────────────────────────────────────┐ │
│  │ 💡 Please enter a valid email address          │ │
│  │    (e.g., user@example.com) or use your        │ │
│  │    username instead                             │ │
│  └────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### 4. Connection Error
```
┌──────────────────────────────────────────────────────┐
│ ⚠️  Error Display                                     │
├──────────────────────────────────────────────────────┤
│  ⚠  Unable to connect to the server. Please check   │
│     your internet connection.                         │
│                                                       │
│  ┌────────────────────────────────────────────────┐ │
│  │ 🌐 Please check your internet connection and   │ │
│  │    try again                                    │ │
│  └────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### 5. Server Error
```
┌──────────────────────────────────────────────────────┐
│ ⚠️  Error Display                                     │
├──────────────────────────────────────────────────────┤
│  ⚠  Server error. Please try again later or contact │
│     support if the problem persists.                  │
│                                                       │
│  ┌────────────────────────────────────────────────┐ │
│  │ ⚙️  We're experiencing technical difficulties.  │ │
│  │    Please try again in a few moments.           │ │
│  └────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### 6. Field Validation Errors
```
┌──────────────────────────────────────────────────────┐
│ Email or Username                                     │
│ [Input field with red border]                        │
│ ┌────────────────────────────────────────────────┐  │
│ │ ⚠  Email or username is required                │  │
│ └────────────────────────────────────────────────┘  │
│                                                       │
│ Password                                              │
│ [Input field with red border]                        │
│ ┌────────────────────────────────────────────────┐  │
│ │ ⚠  Password must be at least 3 characters long │  │
│ └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

## Success Messages

### 7. Registration Success
```
┌──────────────────────────────────────────────────────┐
│ ✅ Success Message                                    │
├──────────────────────────────────────────────────────┤
│  ✓  🎉 Account created successfully!                 │
│                                                       │
│     Welcome to Afritec Bridge! Please log in with    │
│     your credentials to get started.                  │
└──────────────────────────────────────────────────────┘
```

### 8. Password Reset Success
```
┌──────────────────────────────────────────────────────┐
│ ✅ Success Message                                    │
├──────────────────────────────────────────────────────┤
│  ✓  ✅ Password reset successful!                    │
│                                                       │
│     You can now log in with your new password.       │
└──────────────────────────────────────────────────────┘
```

### 9. Info Message
```
┌──────────────────────────────────────────────────────┐
│ ℹ️  Info Message                                      │
├──────────────────────────────────────────────────────┤
│  ℹ  Your message content here                        │
└──────────────────────────────────────────────────────┘
```

## Loading State

### 10. Form Submission Loading
```
┌──────────────────────────────────────────────────────┐
│ [Email Input Field]                                   │
│ [Password Input Field]                                │
│                                                       │
│ ┌────────────────────────────────────────────────┐  │
│ │ [Spinner] Signing In...                         │  │
│ └────────────────────────────────────────────────┘  │
│                                                       │
│ Verifying your credentials...                        │
└──────────────────────────────────────────────────────┘
```

## Color Scheme

### Error States
- **Background**: `bg-red-500/10` (10% opacity red)
- **Border**: `border-red-500/20` (20% opacity red)
- **Text**: `text-red-300` (light red)
- **Icon**: `text-red-400` (medium red)
- **Nested Background**: `bg-red-500/5` (5% opacity red for help text)

### Success States
- **Background**: `bg-emerald-500/20` (20% opacity green)
- **Border**: `border-emerald-500/30` (30% opacity green)
- **Text**: `text-emerald-100` (very light green)
- **Icon**: `text-emerald-300` (light green)

### Info States
- **Background**: `bg-sky-500/20` (20% opacity blue)
- **Border**: `border-sky-500/30` (30% opacity blue)
- **Text**: `text-sky-100` (very light blue)
- **Icon**: `text-sky-300` (light blue)

### Input Field Errors
- **Border**: `border-red-500/50` (50% opacity red)
- **Focus Ring**: `focus:ring-red-500` (solid red)
- **Focus Border**: `focus:border-red-500` (solid red)

## Interactive Behavior

### 1. Error Auto-Clear
- ✅ Errors clear when user starts typing in fields
- ✅ Field validation errors show in real-time
- ✅ Authentication errors persist until form submission

### 2. Field Validation
- ✅ Triggers on blur (when user leaves field)
- ✅ Shows immediately after first touch
- ✅ Updates in real-time after first validation

### 3. Link Interactions
- ✅ "Create account" link appears for "account not found"
- ✅ "Reset password" link appears for "incorrect password"
- ✅ Links have hover states with underline
- ✅ Links use proper color contrast

## Accessibility Features

1. **Icons**: All icons include semantic meaning
2. **Color + Text**: Never rely on color alone
3. **Clear Language**: Simple, jargon-free messages
4. **Actions**: Clear call-to-action for each error
5. **Focus States**: Proper focus indicators on all interactive elements
6. **ARIA Labels**: Proper labeling for screen readers

## Responsive Design

All error and message components are:
- ✅ Mobile-friendly (proper padding and sizing)
- ✅ Touch-friendly (adequate touch targets)
- ✅ Readable on small screens
- ✅ Properly wrapped text
- ✅ Consistent spacing

## Example User Flows

### Flow 1: New User
1. User enters non-existent email
2. Sees "Account not found" error with context
3. Clicks "Create account" link
4. Redirected to registration page

### Flow 2: Forgot Password
1. User enters correct email but wrong password
2. Sees "Incorrect password" error with context
3. Clicks "Reset password" link
4. Redirected to password reset page

### Flow 3: Successful Registration
1. User completes registration
2. Redirected to login page
3. Sees green success message: "Account created successfully!"
4. Enters credentials and logs in

### Flow 4: Network Issue
1. User loses internet connection
2. Attempts to log in
3. Sees "Unable to connect" error with network icon
4. Checks connection and retries

## Testing Checklist

- [ ] Empty form submission shows validation errors
- [ ] Invalid email format shows format error
- [ ] Non-existent account shows "not found" with register link
- [ ] Wrong password shows password error with reset link
- [ ] Network disconnection shows connection error
- [ ] Server error (500) shows server error message
- [ ] Loading state appears during submission
- [ ] Success message appears after registration
- [ ] Success message appears after password reset
- [ ] Errors clear when user starts typing
- [ ] All links work correctly
- [ ] Responsive on mobile devices
- [ ] Accessible with keyboard navigation
- [ ] Screen reader friendly
