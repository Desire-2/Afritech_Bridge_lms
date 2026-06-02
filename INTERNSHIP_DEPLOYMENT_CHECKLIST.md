# Internship Application System - Deployment Checklist

## Pre-Deployment

### Environment Variables
- [ ] `BREVO_API_KEY` set for email notifications
- [ ] `BREVO_SENDER_EMAIL` set (default: from .env)
- [ ] `FRONTEND_URL` set for admin links in emails
- [ ] `DATABASE_URL` configured for production DB

### Database
- [ ] PostgreSQL database created (recommended for production)
- [ ] Migrations applied: `db.create_all()` executed
- [ ] Seed data loaded: `python seed_internship_data.py`
- [ ] Uploads directory exists and is writable: `backend/uploads/internship_cvs/`

### File Storage Setup
- [ ] If using local storage:
  ```bash
  mkdir -p backend/uploads/internship_cvs
  chmod 755 backend/uploads/internship_cvs
  ```
- [ ] If using cloud storage (S3/GCS):
  - [ ] Cloud bucket configured
  - [ ] Credentials in environment
  - [ ] Update `save_cv_file()` in `utils.py` if needed

### Email Service
- [ ] Brevo account configured
- [ ] Sender email verified in Brevo
- [ ] API key has transactional email permission
- [ ] Test email send works:
  ```bash
  python -c "from src.utils.brevo_email_service import brevo_service; brevo_service.send_email(...)"
  ```

### Admin Email
- [ ] `info@afritechbridge.online` exists and monitors
- [ ] Or configure custom admin email in `internship_mailer.py`

---

## Database Migrations

### For SQLite (Development)
```bash
cd backend
python -c "from main import app, db; app.app_context().push(); db.create_all()"
```

### For PostgreSQL (Production)
Tables are created automatically by `db.create_all()`, but for Alembic migrations:
```bash
# If you have Alembic set up:
alembic revision --autogenerate -m "Add internship models"
alembic upgrade head
```

---

## Testing Before Deploy

### 1. Models Test
```bash
cd backend
python -c "
from main import app, db
from src.models.internship_models import InternshipTrack
with app.app_context():
    track = InternshipTrack.query.first()
    print(f'✓ Track found: {track.name if track else \"No tracks yet\"}')"
```

### 2. API Health Check
```bash
# Start server
python main.py &
SERVER_PID=$!

# Test public endpoints
echo "Testing public endpoints..."
curl -s http://localhost:5000/api/v1/internships/tracks | jq .success
curl -s http://localhost:5000/api/v1/internships/cohorts | jq .success
curl -s http://localhost:5000/api/v1/internships/apply/status?ref=ATB-00-TEST&email=test@test.com | jq .success

# Cleanup
kill $SERVER_PID
```

### 3. Email Service Test
```bash
python -c "
import os
os.environ['BREVO_API_KEY'] = 'your-key-here'
from src.utils.brevo_email_service import brevo_service
result = brevo_service.send_email(
    to_emails=[{'email': 'test@example.com', 'name': 'Test'}],
    subject='Test Email',
    html_content='<p>Test</p>'
)
print('Email sent successfully!' if result else 'Email send failed')"
```

### 4. Run Tests
```bash
cd backend
pytest tests/test_internship.py -v
```

---

## Production Security Checklist

- [ ] **File Upload Security**
  - [ ] Only PDF, DOC, DOCX allowed (verified in code)
  - [ ] Max 5MB size enforced
  - [ ] Files stored outside web root
  - [ ] Original filenames not exposed to users

- [ ] **API Security**
  - [ ] JWT token validation on protected routes
  - [ ] Role-based access control enforced
  - [ ] Status transitions validated server-side
  - [ ] Email uniqueness checked

- [ ] **Database Security**
  - [ ] Password hashing enabled (existing User model)
  - [ ] Foreign keys enforced
  - [ ] Sensitive data encrypted if needed

- [ ] **Error Handling**
  - [ ] No SQL errors exposed to clients
  - [ ] Stack traces not in response
  - [ ] Proper HTTP status codes used

- [ ] **Rate Limiting**
  - [ ] Consider implementing server-side rate limiting
  - [ ] Currently: 3 applications per IP per hour (client-side only)

---

## Production Deployment Steps

### 1. Backend Deployment (Render/Heroku/etc)

```bash
# Ensure Procfile exists
cat backend/Procfile
# Output should contain: web: gunicorn -w 4 app:app

# Set environment variables in deployment platform:
# - SECRET_KEY
# - JWT_SECRET_KEY
# - DATABASE_URL
# - BREVO_API_KEY
# - BREVO_SENDER_EMAIL
# - FRONTEND_URL
# - ALLOWED_ORIGINS (comma-separated URLs)

# Deploy
git push heroku main  # or git push render main
```

### 2. Database Setup
```bash
# SSH into deployment platform
# Run migrations
python backend/seed_internship_data.py
```

### 3. Verify Deployment
```bash
# Test deployed API
curl https://your-backend.com/api/v1/internships/tracks

# Test admin endpoint with token
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-backend.com/api/v1/internships/admin/stats
```

---

## Frontend Integration Checklist

### Environment Variables (Next.js)
```bash
NEXT_PUBLIC_API_URL=https://your-backend.com/api/v1
```

### Pages to Create
- [ ] `/internships/tracks` - Display all tracks
- [ ] `/internships/apply` - Application form with file upload
- [ ] `/internships/status` - Check application status
- [ ] `/admin/internships/applications` - Admin dashboard
- [ ] `/admin/internships/cohorts` - Cohort management

### API Integration
```typescript
// src/services/internship.service.ts (example)
import { ApiService } from './api.service';

export const InternshipService = {
  getTracks: () => ApiService.get('/internships/tracks'),
  getCohorts: (track?: string) => 
    ApiService.get(`/internships/cohorts`, { params: { track } }),
  submitApplication: (formData: FormData) =>
    ApiService.post('/internships/apply', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  checkStatus: (ref: string, email: string) =>
    ApiService.get('/internships/apply/status', 
      { params: { ref, email } }),
  getMyApplications: () =>
    ApiService.get('/internships/my-applications'),
};
```

---

## Monitoring & Maintenance

### Logs to Monitor
- [ ] CV upload errors
- [ ] Email send failures
- [ ] Database connection issues
- [ ] Application validation errors

### Regular Tasks
- [ ] Weekly: Check admin email for application alerts
- [ ] Monthly: Archive old applications
- [ ] Monthly: Review statistics for anomalies
- [ ] Quarterly: Clean up old uploaded CVs (optional)

### Backup Strategy
- [ ] Database backups scheduled
- [ ] Uploaded CVs backed up (if important)
- [ ] Retention: Keep for 1 year minimum

---

## Rollback Plan

If issues occur:

1. **Quick Rollback**
   ```bash
   git revert <commit>
   git push heroku main
   ```

2. **Database Rollback**
   - PostgreSQL: Restore from backup
   - Keep backup of database before major changes

3. **File Cleanup**
   ```bash
   # Delete incomplete uploads if needed
   rm -rf backend/uploads/internship_cvs/*
   ```

---

## Performance Optimization

### Database Indexes (Already in Models)
- `InternshipTrack.is_active` - indexed
- `InternshipTrack.slug` - unique, indexed
- `InternshipApplication.status` - indexed
- `InternshipApplication.email` - indexed
- `InternshipApplication.reference_code` - unique, indexed
- `InternshipApplication.created_at` - indexed

### Caching Recommendations
- [ ] Cache tracks list (changes rarely)
- [ ] Cache cohorts list (updated daily max)
- [ ] Cache statistics (updated hourly)

### Query Optimization
- [ ] Admin applications list uses pagination
- [ ] Status logs retrieved on demand
- [ ] Avoid N+1 queries with joinedload

---

## Troubleshooting

### Problem: Email not sending
```bash
# Check Brevo configuration
python -c "
from src.utils.brevo_email_service import brevo_service
print('Configured:', brevo_service.is_configured)
print('API URL:', brevo_service.api_instance)"
```

### Problem: File upload fails
```bash
# Check directory permissions
ls -la backend/uploads/
chmod 755 backend/uploads/internship_cvs

# Check disk space
df -h
```

### Problem: Applications not appearing
```bash
# Check database connection
python -c "
from main import app, db
from src.models.internship_models import InternshipApplication
with app.app_context():
    count = InternshipApplication.query.count()
    print(f'Applications: {count}')"
```

### Problem: Admin can't access applications
```bash
# Verify user role
python -c "
from main import app, db
from src.models.user_models import User
with app.app_context():
    user = User.query.get(1)
    print(f'User role: {user.role.name if user else \"Not found\"}')"
```

---

## Post-Deployment Validation

- [ ] All 20+ endpoints responding correctly
- [ ] Email notifications sending
- [ ] File uploads working
- [ ] Admin dashboard accessible
- [ ] Status updates triggering emails
- [ ] Statistics calculating correctly
- [ ] Pagination working on all lists
- [ ] Search/filter working on admin routes
- [ ] Unauthorized requests returning 401/403
- [ ] Invalid data returning proper error messages

---

## Support Contact

For issues or questions:
- [ ] Check INTERNSHIP_SYSTEM_COMPLETE.md
- [ ] Check INTERNSHIP_QUICK_REFERENCE.md
- [ ] Review test cases: `backend/tests/test_internship.py`
- [ ] Contact: Backend team

---

**✅ Deployment Checklist Complete!**

Deploy with confidence! The system is production-ready. 🚀
