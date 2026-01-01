# Application System - Quick Reference

## 🎯 Core Concept
**Students can apply to multiple courses, but NOT the same course twice**

---

## 🔗 Quick Links

### Backend Endpoints
```
POST   /api/v1/applications              # Submit application
GET    /api/v1/applications/check-duplicate?course_id=5&email=user@example.com
GET    /api/v1/applications/user-stats/user@example.com
POST   /api/v1/applications/:id/approve  # Admin/Instructor only
POST   /api/v1/auth/change-password      # Change password (authenticated)
POST   /api/v1/auth/login                # Returns must_change_password flag
```

### Frontend Components
```
/components/auth/ChangePasswordModal.tsx   # Password change dialog
/components/applications/CourseApplicationForm.tsx  # Has duplicate check
/contexts/AuthContext.tsx  # Check for must_change_password
```

---

## 🚀 User Workflows

### New User Application → Approval Flow
```
1. User applies (not registered) → Application created
2. Admin approves → System checks if email exists
3. Email NOT found → Create user account
   ├─ Generate username: john_doe_123
   ├─ Generate password: xK9$mP2@vN4b
   ├─ Set must_change_password = true
   ├─ Create enrollment
   ├─ Initialize module progress
   └─ Send email with credentials
4. User logs in → Password change modal appears (required)
5. User changes password → Access granted
```

### Existing User Application → Approval Flow
```
1. User applies (already registered) → Application created
2. Admin approves → System checks if email exists
3. Email found → Skip user creation
   ├─ Create enrollment only
   ├─ Initialize module progress
   └─ Send welcome email (use existing credentials)
4. User logs in → Normal access (no password change)
```

### Duplicate Application Prevention
```
1. User enters email in application form
2. On blur → Check /api/v1/applications/check-duplicate
3. If exists → Show warning banner
4. If submit anyway → Backend returns 409 error
```

---

## 💻 Code Snippets

### Backend: Approve Application
```python
@application_bp.route("/<int:app_id>/approve", methods=["POST"])
@jwt_required()
def approve_application(app_id):
    application = CourseApplication.query.get_or_404(app_id)
    
    # Check if user exists
    existing_user = User.query.filter_by(email=application.email).first()
    
    if existing_user:
        # Existing user → Create enrollment only
        enrollment = Enrollment(...)
        # Send welcome email (no credentials)
    else:
        # New user → Create account + enrollment
        username = generate_username(...)
        temp_password = generate_temp_password()
        
        user = User(
            username=username,
            email=application.email,
            must_change_password=True  # ← Force password change
        )
        user.set_password(temp_password)
        
        enrollment = Enrollment(...)
        # Send email with credentials
```

### Frontend: Check Duplicate
```tsx
const handleEmailBlur = async () => {
  if (formData.email && selectedCourse) {
    const response = await applicationService.checkDuplicate(
      selectedCourse.id,
      formData.email
    );
    
    if (response.exists) {
      setDuplicateWarning({
        show: true,
        status: response.application.status
      });
    }
  }
};

<Input
  type="email"
  value={formData.email}
  onBlur={handleEmailBlur}
/>

{duplicateWarning.show && (
  <Alert variant="destructive">
    You have already applied to this course. Status: {duplicateWarning.status}
  </Alert>
)}
```

### Frontend: Password Change Modal
```tsx
import { ChangePasswordModal } from '@/components/auth/ChangePasswordModal';

function Dashboard() {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(user?.must_change_password);

  return (
    <>
      <ChangePasswordModal 
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        required={user?.must_change_password}  // ← Cannot dismiss if true
      />
      {/* Dashboard content */}
    </>
  );
}
```

### Frontend: Login with Password Change Check
```tsx
const login = async (identifier: string, password: string) => {
  const response = await authService.login(identifier, password);
  
  // Check if password change is required
  if (response.must_change_password) {
    setShowPasswordChangeModal(true);
  }
  
  setUser(response.user);
  setIsAuthenticated(true);
};
```

---

## 📧 Email Templates Summary

### New User Email
```
Subject: ✅ Application Approved - Welcome!

🔐 YOUR LOGIN CREDENTIALS:
Username: john_doe_123
Password: xK9$mP2@vN4b

⚠️ You MUST change your password on first login
```

### Existing User Email
```
Subject: ✅ Application Approved - Welcome!

🔐 ACCESS:
Login with your existing credentials
Course URL: /courses/5
```

---

## 🧪 Testing Checklist

### Test: New User Approval
- [ ] Application approved
- [ ] User created with generated username
- [ ] Email sent with temp password
- [ ] `must_change_password = true`
- [ ] Login shows password change modal
- [ ] Modal cannot be closed
- [ ] Password changed successfully
- [ ] Full access granted

### Test: Existing User Approval
- [ ] Application approved
- [ ] No new user created
- [ ] Email sent (no credentials)
- [ ] Enrollment created
- [ ] Login works normally
- [ ] No password change required

### Test: Duplicate Prevention
- [ ] User applies to Course A
- [ ] Same user tries Course A again
- [ ] Frontend shows warning on email blur
- [ ] Backend returns 409 on submit
- [ ] User can apply to Course B (different)

### Test: Multiple Applications
- [ ] User applies to Course A, B, C
- [ ] All 3 applications created
- [ ] `/user-stats/:email` returns all 3
- [ ] `course_ids_applied` array correct

---

## 🔒 Security Features

| Feature | Implementation |
|---------|----------------|
| Auto-generated password | 12 chars, letters + numbers + symbols |
| Forced password change | `must_change_password` flag |
| Unique username | `generate_username()` with collision check |
| Email verification | Email sent only after successful creation |
| Duplicate prevention | Database-level uniqueness check |

---

## 📊 Database Schema

```sql
-- New column
ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT 0 NOT NULL;

-- Check duplicate application
SELECT COUNT(*) FROM course_applications 
WHERE course_id = ? AND email = ?;

-- User lookup
SELECT * FROM users WHERE email = ?;
```

---

## 🐛 Troubleshooting

### Password change modal not showing
```tsx
// Check user object
console.log('User:', user);
console.log('Must change:', user?.must_change_password);

// Verify login response
console.log('Login response:', response);
console.log('Must change flag:', response.must_change_password);
```

### Duplicate check not working
```tsx
// Verify API call
const response = await applicationService.checkDuplicate(courseId, email);
console.log('Duplicate check:', response);

// Check backend logs
python main.py  # Look for "Check for existing application"
```

### Email not sending
```bash
# Verify environment variables
echo $MAIL_USERNAME
echo $MAIL_PASSWORD

# Check backend logs
# Look for "✓ Password reset email sent" or "Failed to send"
```

---

## 📈 Monitoring

### Application Statistics
```typescript
// Get user's application history
const stats = await applicationService.getUserStats(email);

console.log('Total applications:', stats.total_applications);
console.log('Approved:', stats.statistics.approved);
console.log('Courses applied:', stats.course_ids_applied);
```

### User Creation Tracking
```python
# Backend logs
print(f"✓ New user created: {username}")
print(f"✓ Enrollment created for course: {course.title}")
print(f"✓ Modules initialized: {len(modules)}")
```

---

## 🎉 Benefits Summary

- ✅ **No manual account creation** - Fully automated
- ✅ **Smart duplicate prevention** - Per course, not global
- ✅ **Enhanced security** - Forced password change
- ✅ **Better UX** - Contextual emails (new vs existing)
- ✅ **Admin efficiency** - One-click approval
- ✅ **Data integrity** - Unique constraints enforced

---

## 📚 Related Files

```
Backend:
├── src/models/user_models.py (must_change_password field)
├── src/routes/application_routes.py (approval logic)
├── src/routes/user_routes.py (password change endpoint)
├── src/utils/user_utils.py (generate_username, generate_temp_password)
└── migrate_add_password_change_column.py (migration)

Frontend:
├── components/auth/ChangePasswordModal.tsx (password change UI)
├── components/applications/CourseApplicationForm.tsx (duplicate check)
├── services/auth.service.ts (changePassword method)
├── services/applicationApi.ts (checkDuplicate, getUserStats)
└── contexts/AuthContext.tsx (password change trigger)
```

---

*Last Updated: January 1, 2026*
*Version: 2.0 - Quick Reference*
