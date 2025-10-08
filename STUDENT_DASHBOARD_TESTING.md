# Student Dashboard - Testing Guide

## 🚀 Quick Start

### Prerequisites
- Backend running on http://localhost:5001
- Frontend running on http://localhost:3000
- Valid student account with JWT token

---

## Testing Steps

### 1. **Authentication Required**
Make sure you're logged in as a student:
```
Email: student@example.com
Password: (your password)
```

### 2. **Navigate to Dashboard**
```
http://localhost:3000/student/dashboard
```

### 3. **Verify Backend Connection**

Check browser console for:
```javascript
// Should see successful API call
GET http://localhost:5001/api/v1/student/dashboard
Status: 200 OK
```

If you see errors:
- ✅ Check backend is running: `./venv-new/bin/python main.py`
- ✅ Verify JWT token is valid
- ✅ Check CORS settings
- ✅ Confirm student role

---

## What You Should See

### On First Load
1. ⏳ **Loading skeleton** (animated pulse for ~1s)
2. ✨ **Animated entrance** of all sections
3. 📊 **Four stat cards** at the top
4. 📚 **Continue Learning section** (or empty state)
5. 📝 **Recent Activity** (or empty state)
6. ⚡ **Quick Actions panel** (right column)
7. 🏆 **Recent Achievements** (or empty state)
8. 💡 **Daily Learning Tip** card

### Expected Animations
- Staggered fade-in from top to bottom
- Smooth transitions (0.5s duration)
- 60fps animations

### Stat Cards Should Show
- **Total Courses**: Your enrollment count
- **Hours Spent**: Total learning time
- **Completed Courses**: Finished courses
- **Achievements**: Badge count

---

## Testing Scenarios

### Scenario 1: New Student (No Data)
**Expected:**
- All stats show `0`
- Empty states for:
  - Continue Learning: "No courses in progress yet"
  - Recent Activity: "No recent activity yet"
  - Achievements: "Start earning achievements!"
- Quick Actions panel visible
- Learning tip visible

**Actions to Test:**
- Click "Browse Courses" → Should navigate to `/student/courses`
- Check empty state messages are encouraging

### Scenario 2: Active Student (Has Data)
**Expected:**
- Stats show real numbers
- Up to 3 courses in "Continue Learning"
- Recent activity shows latest completions
- Up to 5 achievements displayed

**Actions to Test:**
- Click course card → Navigate to learning page
- Check progress bars match percentages
- Hover effects on cards work
- View All links navigate correctly

### Scenario 3: API Error
**Test:**
1. Stop backend server
2. Refresh dashboard

**Expected:**
- Error card with message
- "Try Again" button visible
- Click button attempts reload

### Scenario 4: Refresh Functionality
**Test:**
1. Click "Refresh" button in header

**Expected:**
- Button shows "Refreshing..." with spinner
- Data reloads from API
- Smooth transition

---

## Browser Developer Tools Checks

### Network Tab
```
✅ GET /api/v1/student/dashboard
   Status: 200
   Time: < 500ms
   Response: JSON with all data

✅ Authentication header present
   Authorization: Bearer <token>
```

### Console Tab
Should NOT see:
- ❌ CORS errors
- ❌ Authentication errors
- ❌ React hydration errors
- ❌ 404 errors

May see (acceptable):
- ℹ️ Framer Motion info messages
- ℹ️ Development mode warnings

### React DevTools
Check component tree:
```
DashboardPage
  └── ClientOnly
      └── StudentDashboardOverviewPage
          ├── motion.div (header)
          ├── motion.div (stats cards)
          ├── Grid Layout
          │   ├── Left Column
          │   │   ├── Card (Continue Learning)
          │   │   └── Card (Recent Activity)
          │   └── Right Column
          │       ├── Card (Quick Actions)
          │       ├── Card (Achievements)
          │       └── Card (Learning Tip)
          └── ...
```

---

## Responsive Testing

### Desktop (> 1024px)
- ✅ 4 stat cards in row
- ✅ 3-column layout (2/3 + 1/3)
- ✅ All content visible
- ✅ Hover effects work

### Tablet (768px - 1024px)
- ✅ 2-2 stat card grid
- ✅ 2-column layout for courses
- ✅ Stacked right sidebar

### Mobile (< 768px)
- ✅ Single column stats
- ✅ Single column layout
- ✅ Touch-friendly buttons (44px min)
- ✅ Scrolls smoothly

**Test Instructions:**
1. Open DevTools (F12)
2. Click device toolbar icon
3. Select responsive view
4. Test at: 375px, 768px, 1024px, 1920px

---

## Dark Mode Testing

### Enable Dark Mode
**Option 1: System Settings**
- Change OS to dark theme
- Dashboard should auto-switch

**Option 2: Browser DevTools**
1. F12 → Console
2. Run: `document.documentElement.classList.add('dark')`

### Check:
- ✅ Background gradient (gray-900 to gray-800)
- ✅ Card backgrounds (dark)
- ✅ Text contrast (white/gray-400)
- ✅ All icons visible
- ✅ Borders visible
- ✅ Hover states work

---

## Performance Testing

### Lighthouse Audit
1. Open DevTools (F12)
2. Lighthouse tab
3. Select "Navigation"
4. Run audit

**Target Scores:**
- Performance: > 90
- Accessibility: > 95
- Best Practices: > 95
- SEO: > 90

### Key Metrics
- First Contentful Paint: < 1s
- Largest Contentful Paint: < 1.5s
- Time to Interactive: < 2s
- Cumulative Layout Shift: < 0.1

---

## Accessibility Testing

### Keyboard Navigation
1. Tab through all elements
2. Check focus indicators visible
3. Press Enter on buttons/links
4. Test Escape to close (future modals)

**Tab Order Should Be:**
1. Refresh button
2. Stat cards (4)
3. Course cards
4. View All links
5. Quick action buttons
6. Achievement cards

### Screen Reader (Optional)
**Windows:** NVDA (free)
**Mac:** VoiceOver (Cmd+F5)

**Check:**
- All content announced
- Buttons have labels
- Links are descriptive
- Images have alt text

---

## Common Issues & Solutions

### Issue: "Cannot find module 'framer-motion'"
**Solution:**
```bash
cd frontend
npm install framer-motion
```

### Issue: API returns 401 Unauthorized
**Solution:**
- Check JWT token is present
- Verify token not expired
- Re-login if necessary

### Issue: CORS Error
**Solution:**
```python
# In backend main.py or app.py
CORS(app, resources={r"/*": {
    "origins": "http://localhost:3000"
}})
```

### Issue: Dark mode not working
**Solution:**
- Check Tailwind dark mode config
- Verify `darkMode: 'class'` in tailwind.config.js

### Issue: Animations not smooth
**Solution:**
- Check CPU usage (< 80%)
- Disable browser extensions
- Test in incognito mode

### Issue: Empty states always showing
**Solution:**
- Check API response structure
- Verify data mapping in component
- Console.log dashboardData

---

## API Response Example

Expected `/api/v1/student/dashboard` response:

```json
{
  "enrolled_courses": [
    {
      "id": 1,
      "title": "Python Programming",
      "description": "Learn Python",
      "instructor_name": "Dr. Smith",
      "progress": 65.5,
      "enrollment_date": "2024-09-01T00:00:00",
      "current_lesson": "Decorators and Generators",
      "estimated_duration": "8 weeks"
    }
  ],
  "stats": {
    "total_courses": 8,
    "completed_courses": 2,
    "hours_spent": 42,
    "achievements": 15
  },
  "achievements": [
    {
      "id": 1,
      "badge": {
        "name": "Learning Pioneer",
        "description": "Started your learning journey"
      },
      "earned_at": "2024-09-01T00:00:00"
    }
  ],
  "recent_activity": [
    {
      "type": "lesson_completion",
      "lesson_title": "Functions and Methods",
      "course_title": "Python Programming",
      "completed_at": "2024-10-05T14:30:00"
    }
  ]
}
```

---

## Manual Test Checklist

### Functionality
- [ ] Dashboard loads successfully
- [ ] API data displays correctly
- [ ] All stats show real numbers
- [ ] Course cards navigate correctly
- [ ] Recent activity displays
- [ ] Achievements visible
- [ ] Quick actions work
- [ ] Refresh button functions
- [ ] Error handling works
- [ ] Empty states display

### UI/Visual
- [ ] Animations play smoothly
- [ ] Hover effects work
- [ ] Loading skeleton appears
- [ ] Colors match design
- [ ] Typography is clear
- [ ] Icons display
- [ ] Spacing is consistent
- [ ] Gradients render

### Responsive
- [ ] Mobile layout works (< 768px)
- [ ] Tablet layout works (768-1024px)
- [ ] Desktop layout works (> 1024px)
- [ ] No horizontal scroll
- [ ] Touch targets adequate

### Performance
- [ ] Page loads quickly (< 2s)
- [ ] Animations smooth (60fps)
- [ ] No memory leaks
- [ ] API calls efficient

### Accessibility
- [ ] Keyboard navigation works
- [ ] Focus indicators visible
- [ ] Color contrast adequate
- [ ] Screen reader compatible

---

## Next Steps After Testing

1. ✅ **Verify all tests pass**
2. ✅ **Document any issues found**
3. ✅ **Test with real user data**
4. ✅ **Get stakeholder feedback**
5. ✅ **Deploy to staging**
6. ✅ **Monitor production metrics**

---

## Support

### Documentation
- Enhancement details: `/STUDENT_DASHBOARD_ENHANCEMENT.md`
- Before/After: `/STUDENT_DASHBOARD_BEFORE_AFTER.md`
- API routes: `backend/src/routes/student_routes.py`

### Debugging
- Check console logs
- Verify API responses
- Test in incognito
- Clear cache if needed

---

*Happy Testing! 🧪*
