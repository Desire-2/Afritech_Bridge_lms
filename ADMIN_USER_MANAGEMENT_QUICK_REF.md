# Admin User Management - Quick Reference

## 🚀 Quick Start

### Access
1. Login as admin at `/auth/login`
2. Navigate to `/admin/users` or click "User Management" in sidebar

### Key Features
- ✅ Create, Edit, Delete users
- ✅ Search & Filter (username, email, role, status)
- ✅ Bulk operations (activate, deactivate, change role, delete)
- ✅ User statistics & analytics
- ✅ Activity tracking
- ✅ Responsive design

---

## 📡 API Endpoints (Quick Reference)

| Action | Endpoint | Method |
|--------|----------|--------|
| List users | `/api/v1/admin/users` | GET |
| Create user | `/api/v1/admin/users` | POST |
| Get user | `/api/v1/admin/users/<id>` | GET |
| Update user | `/api/v1/admin/users/<id>` | PUT |
| Delete user | `/api/v1/admin/users/<id>` | DELETE |
| User stats | `/api/v1/admin/users/stats` | GET |
| Bulk action | `/api/v1/admin/users/bulk-action` | POST |
| User activity | `/api/v1/admin/users/<id>/activity` | GET |
| Get roles | `/api/v1/admin/roles` | GET |

---

## 🎯 Common Tasks

### Create a User
1. Click "Create User" button
2. Fill required fields: username, email, password, role
3. Click "Create User"

### Edit a User
1. Click ✏️ icon on user row
2. Modify fields (leave password blank to keep current)
3. Click "Update User"

### Search Users
1. Type in search box (searches username, email, names)
2. Results update automatically

### Filter Users
1. Select role: Student, Instructor, or Admin
2. Select status: Active or Inactive
3. Click "Clear Filters" to reset

### Bulk Operations
1. Check boxes next to users (or "Select All")
2. Choose action: Activate, Deactivate, Change Role, or Delete
3. Confirm action

### View User Details
1. Click 👁️ icon on user row
2. Switch between tabs: Details, Activity, Statistics
3. Click "Edit" to modify or "Close" to exit

---

## 🔑 Required Fields

### Creating User
- Username (unique)
- Email (unique, valid format)
- Password (min 6 characters)
- Role (student, instructor, admin)

### Optional Fields
- First Name
- Last Name
- Phone Number
- Bio
- Active Status (default: true)

---

## 🎨 UI Elements

### Status Badges
- 🟢 **Green**: Active users
- 🔴 **Red**: Inactive users

### Role Badges
- 🟣 **Purple**: Admin
- 🔵 **Blue**: Instructor
- 🟢 **Green**: Student

### Action Buttons
- 👁️ **View**: See user details
- ✏️ **Edit**: Modify user
- 🗑️ **Delete**: Remove user

---

## 📊 Statistics Dashboard

### Main Cards
- **Total Users**: All registered users
- **Active Users**: Currently active accounts
- **New (7 days)**: Users registered in last week
- **New (30 days)**: Users registered in last month
- **Inactive Users**: Deactivated accounts

### Role Distribution
- Shows count and percentage per role
- Updates in real-time

---

## ⚙️ Filters & Sorting

### Search Fields
- Username
- Email
- First Name
- Last Name

### Filter Options
- **Role**: All, Student, Instructor, Admin
- **Status**: All, Active, Inactive

### Sort Options
- **Sort By**: Created Date, Username, Email, Role
- **Sort Order**: Ascending, Descending

---

## 🔄 Bulk Actions

### Activate
- Enables selected user accounts
- No confirmation required

### Deactivate
- Disables selected user accounts
- Users cannot login when inactive

### Change Role
1. Click "Change Role"
2. Select new role from dropdown
3. Click "Apply"

### Delete
- Permanently removes users
- **Warning**: Requires confirmation
- Cannot be undone

---

## 🐛 Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| Can't see users | Check you're logged in as admin |
| Create fails | Verify username/email are unique |
| Search not working | Try clearing filters first |
| Bulk action fails | Ensure users are selected |
| Stats not loading | Refresh page or check connection |

---

## 💡 Tips & Tricks

1. **Use bulk operations** to save time with multiple users
2. **Filter before bulk actions** to target specific users
3. **Check user activity** before deleting to see engagement
4. **Use search** for quick user lookup
5. **Sort by created date** to find newest users
6. **View statistics** to understand user distribution

---

## ⚠️ Important Notes

- ⚠️ **Self-deletion blocked**: Admins cannot delete their own account
- ⚠️ **Bulk delete**: Use with caution - permanent action
- ⚠️ **Password changes**: Leave blank in edit mode to keep current password
- ⚠️ **Role changes**: Affect user permissions immediately
- ⚠️ **Inactive users**: Cannot login but data is preserved

---

## 🔐 Security

- All actions require admin authentication
- JWT token validated on every request
- Duplicate email/username prevented
- Input validation on frontend and backend
- Passwords hashed (never stored plain text)

---

## 📱 Mobile Support

- ✅ Fully responsive design
- ✅ Touch-friendly buttons
- ✅ Horizontal scroll for tables
- ✅ Optimized modals for small screens
- ✅ Collapsible filters

---

## 🎓 Best Practices

1. ✅ Always search before creating to avoid duplicates
2. ✅ Use meaningful usernames for easy identification
3. ✅ Verify role before assigning admin privileges
4. ✅ Check user activity before deletion
5. ✅ Use filters to manage large user lists
6. ✅ Regular review of inactive users
7. ✅ Bulk operations for efficiency

---

## 📞 Support

For issues or questions:
1. Check full documentation: `ADMIN_USER_MANAGEMENT_COMPLETE.md`
2. Review backend logs in `backend/` directory
3. Check browser console for frontend errors
4. Verify database connection and migrations

---

**Quick Links:**
- Main Dashboard: `/admin`
- User Management: `/admin/users`
- System Settings: `/admin/settings`
- Analytics: `/admin/analytics`

---

**Last Updated**: January 1, 2026
