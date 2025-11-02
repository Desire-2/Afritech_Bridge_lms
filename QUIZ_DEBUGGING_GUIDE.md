# Quiz Creation/Update Debugging Guide

## Issue: Quiz creation and updates not working, no console output

### ✅ What We've Fixed:

1. **Added Enhanced Error Logging**
   - Console logs now show request data, responses, and detailed errors
   - Both component and service layers now log everything
   
2. **Added User-Friendly Alerts**
   - Success messages when quiz is created/updated
   - Error messages with specific details
   
3. **Added Validation**
   - Title validation before submission
   - Required field checks

4. **Verified Backend**
   - ✅ Endpoint is registered and accessible
   - ✅ Requires authentication (401 response expected without token)
   - ✅ Backend syntax is correct

### 🔍 How to Debug:

#### Step 1: Open Browser Developer Tools
Press `F12` or `Right Click > Inspect` and go to the **Console** tab

#### Step 2: Try to Create a Quiz
1. Navigate to your course management page
2. Go to the Assessments tab
3. Click "Create Quiz"
4. Fill in the form (at minimum, add a title)
5. Click "Create Quiz" button

#### Step 3: Check Console Output

You should now see detailed logs like this:

```
Creating quiz with data: {
  "title": "My Quiz",
  "description": "Test",
  "course_id": 1,
  ...
}

[CourseCreationService] Creating quiz at: /instructor/assessments/quizzes
[CourseCreationService] Quiz data: {...}
[CourseCreationService] Quiz created response: {...}
```

### 📊 What to Look For:

#### ✅ Success Pattern:
```
Creating quiz with data: {...}
[CourseCreationService] Creating quiz at: /instructor/assessments/quizzes
[CourseCreationService] Quiz created response: { quiz: {...}, message: "..." }
Quiz created successfully: {...}
Alert: "Quiz created successfully!"
```

#### ❌ Error Patterns:

**Pattern 1: Network Error**
```
[CourseCreationService] Error creating quiz: Network Error
Error details: { message: "Network Error", ... }
Alert: "Failed to create quiz: Network Error"
```
**Solution:** Check if backend is running on http://localhost:5001

---

**Pattern 2: 401 Unauthorized**
```
Error details: { status: 401, message: "Unauthorized" }
Alert: "Failed to create quiz: Unauthorized"
```
**Solution:** You're not logged in or token expired. Log in again.

---

**Pattern 3: 403 Forbidden**
```
Error details: { status: 403, message: "Instructor access required" }
Alert: "Failed to create quiz: Instructor access required"
```
**Solution:** You're logged in but not as an instructor. Use an instructor account.

---

**Pattern 4: 404 Not Found**
```
Error details: { status: 404, message: "Course not found" }
Alert: "Failed to create quiz: Course not found"
```
**Solution:** The course_id doesn't exist or doesn't belong to you.

---

**Pattern 5: 400 Bad Request**
```
Error details: { status: 400, message: "Course ID is required" }
Alert: "Failed to create quiz: Course ID is required"
```
**Solution:** Required field missing. Check the request data in console.

---

**Pattern 6: 500 Server Error**
```
Error details: { status: 500, message: "Failed to create quiz", error: "..." }
Alert: "Failed to create quiz: Failed to create quiz"
```
**Solution:** Backend error. Check backend logs.

### 🔧 Manual API Test

If frontend still doesn't work, test the backend directly:

#### 1. Get Your Auth Token
Open browser console and run:
```javascript
localStorage.getItem('token')
```
Copy the token.

#### 2. Test with curl
```bash
curl -X POST http://localhost:5001/api/v1/instructor/assessments/quizzes \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Quiz",
    "description": "Test",
    "course_id": 1,
    "is_published": false,
    "questions": [
      {
        "question_text": "What is Python?",
        "question_type": "multiple_choice",
        "answers": [
          {"answer_text": "A language", "is_correct": true},
          {"answer_text": "A snake", "is_correct": false}
        ]
      }
    ]
  }'
```

Expected response (success):
```json
{
  "message": "Quiz created successfully",
  "quiz": {
    "id": 1,
    "title": "Test Quiz",
    ...
  }
}
```

### 📝 Backend Logs

Check backend terminal for requests:

```bash
# In backend directory
tail -f backend.log

# Or watch the terminal where you ran ./run.sh
```

You should see:
```
INFO - POST /api/v1/instructor/assessments/quizzes
INFO - Quiz created: {...}
```

### 🐛 Common Issues & Solutions:

| Issue | Symptom | Solution |
|-------|---------|----------|
| Backend not running | "Network Error" | Run `./run.sh` in backend directory |
| Not logged in | 401 error | Log in as instructor |
| Wrong user role | 403 error | Use instructor account |
| Invalid course ID | 404 error | Use a course you own |
| CORS error | "CORS policy" error | Check backend CORS settings |
| Port mismatch | "Network Error" | Verify backend is on port 5001 |

### 🎯 Quick Checklist:

Before reporting an issue, verify:

- [ ] Backend is running (`./run.sh` in backend directory)
- [ ] Can see "Running on http://127.0.0.1:5001" message
- [ ] Logged in as instructor (check localStorage.getItem('token'))
- [ ] Browser console is open (F12)
- [ ] Network tab shows the POST request
- [ ] Request payload includes course_id and title
- [ ] Response status code is visible (not just "Failed")

### 📸 What to Share When Asking for Help:

1. **Console output** (screenshot or copy/paste all logs)
2. **Network tab** (screenshot of the failed request)
3. **Request payload** (from Network tab > Payload)
4. **Response** (from Network tab > Response)
5. **Backend logs** (last 20 lines)
6. **Your user role** (admin/instructor/student)

### 🔄 After Frontend Rebuild:

If you've updated the frontend code, make sure to:

```bash
# Stop frontend if running
# Then restart it
cd frontend
npm run dev
```

The changes are now live. Try creating a quiz again and watch the console!

### ✨ Expected Behavior (After Fixes):

1. **Before submission**: Form should validate title
2. **During submission**: Console shows "Creating quiz with data..."
3. **Network request**: Shows in Network tab
4. **On success**: Alert "Quiz created successfully!"
5. **On error**: Alert with specific error message
6. **Console**: Shows detailed error info

---

## 🎉 Summary

We've added comprehensive logging at every step. You should now see:
- ✅ What data is being sent
- ✅ Where it's being sent
- ✅ What response comes back
- ✅ Specific error messages
- ✅ Success confirmations

**No more silent failures!** Every action now produces visible feedback.
