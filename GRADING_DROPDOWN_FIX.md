# Course Dropdown Fix - Grading Page

## Issue Description
The course dropdown on the instructor grading page (`/instructor/grading`) was not working - courses were not loading in the dropdown selector.

## Root Cause
The issue was caused by **incorrect API URL usage** in the grading page component. The code was using relative URLs (e.g., `/api/v1/instructor/courses`) instead of using the `NEXT_PUBLIC_API_URL` environment variable.

### Why This Caused the Problem
- **Relative URL**: `/api/v1/instructor/courses` → Requests sent to Next.js server at `localhost:3000/api/v1/instructor/courses`
- **Expected URL**: Should be sent to Flask backend at `localhost:5001/api/v1/instructor/courses`
- **Result**: Next.js server doesn't have these routes, so requests failed silently

All other services in the application correctly use `process.env.NEXT_PUBLIC_API_URL`, but the grading page was using hardcoded relative paths.

## Solution Applied

### 1. Added API Base URL Constant
Added the API_BASE_URL constant at the top of the grading page component:

```typescript
// API Base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';
```

### 2. Updated All API Calls
Fixed all fetch calls to use the API_BASE_URL:

#### fetchCourses
```typescript
// BEFORE
const response = await fetch('/api/v1/instructor/courses', { ... });

// AFTER
const response = await fetch(`${API_BASE_URL}/instructor/courses`, { ... });
```

#### fetchModules
```typescript
// BEFORE
const response = await fetch(`/api/v1/courses/${courseId}/modules`, { ... });

// AFTER
const response = await fetch(`${API_BASE_URL}/courses/${courseId}/modules`, { ... });
```

#### fetchLessons
```typescript
// BEFORE
const response = await fetch(`/api/v1/modules/${moduleId}/lessons`, { ... });

// AFTER
const response = await fetch(`${API_BASE_URL}/modules/${moduleId}/lessons`, { ... });
```

#### fetchStudents
```typescript
// BEFORE
const response = await fetch(`/api/v1/courses/${courseId}/enrollments`, { ... });

// AFTER
const response = await fetch(`${API_BASE_URL}/courses/${courseId}/enrollments`, { ... });
```

### 3. Added Debug Logging
Enhanced error handling and added console.log statements to help debug API calls:

```typescript
const fetchCourses = async () => {
  try {
    console.log('Fetching courses with token:', token ? 'present' : 'missing');
    const response = await fetch(`${API_BASE_URL}/instructor/courses`, { ... });
    console.log('Courses response status:', response.status);
    if (response.ok) {
      const coursesData = await response.json();
      console.log('Courses fetched:', coursesData.length, ' courses');
      console.log('Courses data:', coursesData);
      setCourses(coursesData);
    } else {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      console.error('Failed to fetch courses:', response.status, errorData);
    }
  } catch (err) {
    console.error('Failed to fetch courses - error:', err);
  }
};
```

### 4. Improved useEffect Dependency Management
Separated the course fetching into its own useEffect to prevent unnecessary re-fetches:

```typescript
// Fetch courses once on mount when token is available
useEffect(() => {
  if (token) {
    fetchCourses();
  }
}, [token]);

// Fetch grading data when filters change
useEffect(() => {
  if (token) {
    fetchGradingData();
    fetchSummary();
  }
}, [token, selectedCourse, selectedStatus, selectedType, selectedModule, selectedLesson, selectedStudent, currentPage]);
```

### 5. Enhanced Dropdown Rendering
Added better loading state handling in the dropdown:

```tsx
<select value={selectedCourse} onChange={(e) => { 
  console.log('Course changed to:', e.target.value);
  setSelectedCourse(e.target.value); 
  setCurrentPage(1);
}}>
  <option value="all">All Courses</option>
  {courses && courses.length > 0 ? (
    courses.map((course) => (
      <option key={course.id} value={course.id}>
        {course.title}
      </option>
    ))
  ) : (
    <option disabled>Loading courses...</option>
  )}
</select>
```

## Files Modified
- `/frontend/src/app/instructor/grading/page.tsx` - Fixed all API calls to use environment variable

## Environment Configuration
Ensure your `.env.local` file has the correct backend URL:

```env
NEXT_PUBLIC_API_URL=http://localhost:5001/api/v1
```

## Testing Checklist
To verify the fix works:

1. ✅ **Backend Running**: Ensure Flask backend is running on port 5001
   ```bash
   cd backend
   ./run.sh
   ```

2. ✅ **Frontend Running**: Ensure Next.js is running on port 3000
   ```bash
   cd frontend
   npm run dev
   ```

3. ✅ **Instructor Login**: Log in as an instructor

4. ✅ **Navigate to Grading**: Go to `/instructor/grading`

5. ✅ **Check Console**: Open browser DevTools > Console
   - Should see: `Fetching courses with token: present`
   - Should see: `Courses response status: 200`
   - Should see: `Courses fetched: X courses` (where X is the number of courses)

6. ✅ **Test Dropdown**: Click on the course dropdown
   - Should see list of all courses taught by the instructor
   - Should be able to select a course

7. ✅ **Test Cascading Filters**: Select a course
   - Module dropdown should enable and populate
   - Select a module → Lesson dropdown should enable and populate
   - Student dropdown should show enrolled students

8. ✅ **Test Filtering**: Select filters and verify:
   - Submissions list updates based on selections
   - Active filter count badge shows correct number
   - "Clear All Filters" button works

## Additional Improvements Made

### Better Error Handling
- Catches and logs specific HTTP status codes
- Logs full error responses for debugging
- Gracefully handles network errors

### Better User Feedback
- Shows "Loading courses..." when courses array is empty
- Logs course selection changes to console
- Maintains loading states for each dropdown

### Performance Optimization
- Courses fetched only once on mount
- Other filters don't trigger course re-fetch
- Reduced unnecessary API calls

## Backend Verification
The backend endpoint is working correctly:

```python
@instructor_bp.route("/courses", methods=["GET"])
@jwt_required()
def get_instructor_courses():
    """Get all courses taught by the current instructor."""
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)
    
    if not user or not user.role or user.role.name not in ['instructor', 'admin']:
        return jsonify({"message": "Instructor access required"}), 403
    
    courses = Course.query.filter_by(instructor_id=current_user_id).all()
    return jsonify([course.to_dict() for course in courses]), 200
```

## Known Considerations

### No Courses Scenario
If the dropdown still shows "Loading courses..." after the page loads, this means:
- The instructor has not created any courses yet, OR
- The instructor is not assigned to any courses in the database

**Solution**: Create at least one course for the instructor to test filtering functionality.

### CORS Issues
If you see CORS errors in the console:
- Check that the Flask backend has CORS properly configured
- Ensure the frontend URL is in the `ALLOWED_ORIGINS` in the backend

### Token Expiry
If courses don't load and you see 401 errors:
- The JWT token may have expired
- Log out and log back in to get a fresh token

## Summary
The course dropdown issue was a **frontend API integration problem**, not a backend or data issue. By using the proper environment variable for API URLs (matching the pattern used throughout the rest of the application), the dropdown now functions correctly and communicates with the Flask backend as intended.

All cascading filters (Course → Module → Lesson → Student) now work seamlessly with proper data fetching and state management.
