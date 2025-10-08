# Student Courses Page - Debug Guide

## Issue
The courses page is displaying "0 courses" despite having 5 courses in the database.

## Debugging Steps

### 1. Check Browser Console
Open browser DevTools (F12) and check:
- **Console Tab**: Look for JavaScript errors
- **Network Tab**: Check the API call to `/api/v1/student/courses/browse`
  - Status code (should be 200)
  - Response payload
  - Request headers (Authorization token)

### 2. Check Backend Logs
```bash
cd /home/desire/My_Project/AB/afritec_bridge_lms/backend
tail -f backend.log
```

### 3. Test API Directly

#### Get a valid JWT token first:
```bash
# Login to get token
curl -X POST http://localhost:5001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "your_student_username",
    "password": "your_password"
  }' | jq -r '.access_token' > /tmp/student_token.txt
```

#### Test browse courses endpoint:
```bash
curl -X GET http://localhost:5001/api/v1/student/courses/browse \
  -H "Authorization: Bearer $(cat /tmp/student_token.txt)" \
  -H "Content-Type: application/json" | jq
```

### 4. Check Database

```bash
cd /home/desire/My_Project/AB/afritec_bridge_lms/backend
./venv-new/bin/python << 'EOF'
import sys
sys.path.insert(0, '.')
from main import app, db
from src.models.course import Course

with app.app_context():
    courses = Course.query.all()
    published = Course.query.filter_by(is_published=True).all()
    
    print(f"Total courses: {len(courses)}")
    print(f"Published courses: {len(published)}")
    print("\nCourse details:")
    for c in courses[:5]:
        print(f"  ID: {c.id}, Title: {c.title}, Published: {c.is_published}")
EOF
```

### 5. Common Issues

#### A. Courses not published
The `/courses/browse` endpoint filters by `is_published=True`. Check if courses are published.

**Fix:**
```python
# Publish all courses
cd backend
./venv-new/bin/python << 'EOF'
import sys
sys.path.insert(0, '.')
from main import app, db
from src.models.course import Course

with app.app_context():
    courses = Course.query.filter_by(is_published=False).all()
    for course in courses:
        course.is_published = True
    db.session.commit()
    print(f"Published {len(courses)} courses")
EOF
```

#### B. Authentication issue
Check if user is logged in and token is valid.

**Frontend check:**
```typescript
// In browser console
localStorage.getItem('token')
```

#### C. CORS issue
Check if CORS headers are present in response.

**Backend check:**
```python
# In backend/main.py or app.py
# Ensure CORS is configured for student routes
```

#### D. Frontend service error
Check if the service is correctly parsing the response.

**Expected response format:**
```json
[
  {
    "id": 1,
    "title": "Course Title",
    "description": "...",
    "instructor": "John Doe",
    "isEnrolled": false,
    // ... more fields
  }
]
```

### 6. Add Temporary Debugging

#### Frontend (page.tsx):
```typescript
const fetchCourses = async () => {
  setIsLoading(true);
  setError(null);
  try {
    console.log('Fetching courses with filters:', {
      category: selectedCategory,
      level: selectedLevel,
      price: selectedPrice,
      search: searchQuery
    });
    
    const coursesData = await StudentService.browseCourses({
      category: selectedCategory,
      level: selectedLevel,
      price: selectedPrice,
      search: searchQuery
    });
    
    console.log('Received courses:', coursesData);
    console.log('Number of courses:', coursesData.length);
    
    setCourses(coursesData);
    setFilteredCourses(coursesData);
  } catch (err: any) {
    console.error('Error fetching courses:', err);
    console.error('Error details:', err.response?.data);
    setError(err.message || 'Failed to load courses. Please try again.');
  } finally {
    setIsLoading(false);
  }
};
```

#### Backend (student_routes.py):
```python
@student_bp.route("/courses/browse", methods=["GET"])
@student_required  
def browse_courses():
    """Get all available courses with enrollment status and pricing info"""
    current_user_id = int(get_jwt_identity())
    
    print(f"[DEBUG] Browse courses called by user: {current_user_id}")
    
    try:
        # ... existing code ...
        
        courses = query.all()
        print(f"[DEBUG] Found {len(courses)} courses")
        
        # ... rest of code ...
        
        print(f"[DEBUG] Returning {len(courses_data)} courses after filtering")
        return jsonify(courses_data), 200
```

### 7. Quick Test Script

Create `test_courses_api.py`:
```python
#!/usr/bin/env python3
import requests
import json

BASE_URL = "http://localhost:5001/api/v1"

# 1. Login
login_response = requests.post(
    f"{BASE_URL}/auth/login",
    json={"username": "student", "password": "password"}
)

if login_response.status_code == 200:
    token = login_response.json()['access_token']
    print(f"✓ Login successful")
    
    # 2. Get courses
    courses_response = requests.get(
        f"{BASE_URL}/student/courses/browse",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if courses_response.status_code == 200:
        courses = courses_response.json()
        print(f"✓ API returned {len(courses)} courses")
        
        if len(courses) > 0:
            print(f"\nFirst course:")
            print(json.dumps(courses[0], indent=2))
        else:
            print("\n✗ No courses returned!")
    else:
        print(f"✗ API error: {courses_response.status_code}")
        print(courses_response.text)
else:
    print(f"✗ Login failed: {login_response.status_code}")
    print(login_response.text)
```

Run:
```bash
cd backend
./venv-new/bin/python test_courses_api.py
```

### 8. Check Frontend Service Import

Ensure StudentService is properly imported and configured:
```typescript
// Check apiClient base URL
console.log('API Client base URL:', apiClient.defaults.baseURL);
```

### 9. Network Tab Analysis

In browser DevTools Network tab, look for:
- Request URL: `http://localhost:3000/api/v1/student/courses/browse`
- Method: GET
- Status: 200 (or error code)
- Response: Array of courses

### 10. Verify Backend is Running

```bash
ps aux | grep python | grep main.py
curl http://localhost:5001/health
```

## Solution Checklist

- [ ] Backend is running on port 5001
- [ ] Frontend is running on port 3000
- [ ] User is logged in (check localStorage token)
- [ ] Courses exist in database
- [ ] Courses are published (is_published=True)
- [ ] No CORS errors in console
- [ ] API returns 200 status
- [ ] API returns non-empty array
- [ ] Frontend service receives data
- [ ] No TypeScript errors
- [ ] State is updated correctly

## Next Steps

Once debugging info is gathered, check:
1. Is data reaching the frontend?
2. Is filtering removing all courses?
3. Is there a render issue?
