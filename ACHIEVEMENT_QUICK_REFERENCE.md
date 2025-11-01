# 🏆 Achievement System - Quick Reference

## Quick Start

### 1. Run Database Migration
```bash
cd /home/desire/My_Project/AB/afritec_bridge_lms/backend
flask db migrate -m "Add achievement system models"
flask db upgrade
```

### 2. Initialize Achievement Data
```bash
cd /home/desire/My_Project/AB/afritec_bridge_lms
python init_achievements.py
```

### 3. Register Routes
```python
# In backend/src/routes/__init__.py or backend/app.py
from src.routes.achievement_routes import achievement_bp

app.register_blueprint(achievement_bp)
```

---

## Essential API Endpoints

### Get User's Achievements
```typescript
GET /api/v1/achievements/summary
```

### Award Achievement (Backend)
```python
from src.services.achievement_service import AchievementService

new_achievements = AchievementService.check_and_award_achievements(
    user_id=1,
    event_type='lesson_complete',
    event_data={'lesson_id': 5, 'time_spent': 120}
)
```

### Update Streak (Backend)
```python
current_streak, new_milestones = AchievementService.update_learning_streak(user_id=1)
```

---

## Frontend Component Usage

### Achievement Badge
```tsx
import { AchievementBadge } from '@/components/student/AchievementComponents';

<AchievementBadge 
  achievement={achievement} 
  earned={true} 
  size="lg" 
/>
```

### Streak Display
```tsx
import { StreakDisplay } from '@/components/student/AchievementComponents';

<StreakDisplay 
  streak={streakData} 
  size="md" 
/>
```

### Points Display
```tsx
import { PointsLevelDisplay } from '@/components/student/AchievementComponents';

<PointsLevelDisplay 
  points={pointsData} 
  compact={false} 
/>
```

### Celebration Modal
```tsx
import { AchievementUnlockedModal } from '@/components/student/AchievementComponents';

<AchievementUnlockedModal 
  achievement={newAchievement}
  isOpen={showModal}
  onClose={() => setShowModal(false)}
/>
```

---

## Achievement Criteria Types

| Criteria Type | Description | Value |
|--------------|-------------|-------|
| `lessons_completed` | Total lessons completed | Number of lessons |
| `streak_days` | Current learning streak | Number of days |
| `perfect_score` | Quiz score | 100 |
| `fast_completion` | Lesson time | Seconds |
| `module_perfect_score` | Module completion score | 100 |
| `early_bird` | Learn 5 AM - 8 AM | 1 |
| `night_owl` | Learn 10 PM - 2 AM | 1 |
| `high_engagement` | Engagement score | Percentage |
| `weekly_active_days` | Active days per week | Number of days |

---

## Achievement Categories

- **milestone** - First steps, lesson counts
- **consistency** - Streaks, daily learning
- **speed** - Fast completions
- **mastery** - Perfect scores, high performance
- **social** - Community interactions
- **special** - Hidden, time-based achievements

---

## Rarity & Tier System

### Rarity (Visual)
- **common** - Gray
- **uncommon** - Green
- **rare** - Blue
- **epic** - Purple
- **legendary** - Gold/Orange gradient

### Tier (Progress)
- **bronze** - Entry level
- **silver** - Intermediate
- **gold** - Advanced
- **platinum** - Expert
- **diamond** - Master

---

## Integration Checklist

- [ ] Database migration completed
- [ ] Achievement data initialized
- [ ] Routes registered in app
- [ ] Lesson completion triggers achievements
- [ ] Streak updates on lesson complete
- [ ] Achievement modal shows on unlock
- [ ] Dashboard widgets display points/streak
- [ ] Achievements page accessible

---

## File Locations

**Backend:**
- Models: `/backend/src/models/achievement_models.py`
- Service: `/backend/src/services/achievement_service.py`
- Routes: `/backend/src/routes/achievement_routes.py`

**Frontend:**
- API Client: `/frontend/src/services/achievementApi.ts`
- Components: `/frontend/src/components/student/AchievementComponents.tsx`
- Leaderboards: `/frontend/src/components/student/LeaderboardComponents.tsx`
- Page: `/frontend/src/app/student/achievements/page.tsx`

**Docs:**
- Full Guide: `/ACHIEVEMENT_SYSTEM_GUIDE.md`
- Initialization: `/init_achievements.py`

---

## Common Tasks

### Add New Achievement
```python
achievement = Achievement(
    name='your_achievement',
    title='Your Title',
    description='What to do',
    icon='trophy',
    color='gold',
    category='milestone',
    tier='gold',
    points=100,
    xp_bonus=50,
    criteria_type='lessons_completed',
    criteria_value=25,
    rarity='rare'
)
db.session.add(achievement)
db.session.commit()
```

### Trigger Achievement Check
```python
# After lesson completion
AchievementService.check_and_award_achievements(
    user_id=current_user.id,
    event_type='lesson_complete',
    event_data={
        'lesson_id': lesson_id,
        'time_spent': time_spent,
        'engagement_score': engagement_score
    }
)
```

### Display Earned Achievements
```typescript
const { data: achievements } = await achievementApi.getEarnedAchievements();

achievements.map(ua => (
  <AchievementCard 
    key={ua.id}
    userAchievement={ua}
    onShowcase={handleShowcase}
  />
))
```

---

## Troubleshooting

**Achievements not unlocking?**
- Check criteria type matches event
- Verify event_data contains required fields
- Check database constraints

**Streak not updating?**
- Ensure `update_learning_streak()` called after lesson
- Check timezone settings
- Verify `last_activity_date` being set

**Frontend not loading?**
- Check API endpoint URLs
- Verify JWT token in requests
- Check browser console for errors

---

## Performance Tips

1. **Cache leaderboards** (5-minute cache)
2. **Batch achievement checks** (check multiple at once)
3. **Index user_id columns** for fast queries
4. **Lazy load achievement images**

---

**For full documentation, see:** `ACHIEVEMENT_SYSTEM_GUIDE.md`
