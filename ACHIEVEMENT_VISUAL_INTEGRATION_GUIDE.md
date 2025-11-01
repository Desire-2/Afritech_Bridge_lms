# 🎯 Achievement System - Visual Integration Guide

## System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        STUDENT LEARNS                            │
│                    (Completes Lesson/Quiz)                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   LESSON COMPLETION ENDPOINT                     │
│  POST /api/v1/lessons/{id}/complete                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 1. Save lesson progress                                   │  │
│  │ 2. AchievementService.check_and_award_achievements()      │  │
│  │ 3. AchievementService.update_learning_streak()            │  │
│  │ 4. AchievementService.check_milestones()                  │  │
│  │ 5. Return new achievements + streak + milestones          │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ACHIEVEMENT SERVICE                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ check_and_award_achievements(user_id, event, data)       │  │
│  │                                                           │  │
│  │ FOR EACH active achievement:                             │  │
│  │   ✓ Check criteria (lessons_completed, streak_days, etc) │  │
│  │   ✓ If met: Create UserAchievement                       │  │
│  │   ✓ Award points and XP                                  │  │
│  │   ✓ Update StudentPoints                                 │  │
│  │   ✓ Check for level up                                   │  │
│  │                                                           │  │
│  │ RETURN: List of newly earned achievements                │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                         DATABASE                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Achievement  │  │UserAchievement│  │LearningStreak│          │
│  │   (defs)     │◄─┤   (earned)    │  │   (daily)    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │StudentPoints │  │  Milestone   │  │ Leaderboard  │          │
│  │  (XP/Level)  │  │   (goals)    │  │  (rankings)  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND RESPONSE                             │
│  {                                                               │
│    success: true,                                                │
│    new_achievements: [                                           │
│      {                                                           │
│        id: 1,                                                    │
│        achievement: {                                            │
│          title: "First Steps",                                   │
│          points: 25,                                             │
│          tier: "bronze"                                          │
│        }                                                         │
│      }                                                           │
│    ],                                                            │
│    current_streak: 5,                                            │
│    new_milestones: [...]                                         │
│  }                                                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CELEBRATION UI                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              🎉 Achievement Unlocked! 🎉                  │  │
│  │                                                           │  │
│  │                    ┌─────────┐                           │  │
│  │                    │  🏆     │                           │  │
│  │                    │ BADGE   │                           │  │
│  │                    └─────────┘                           │  │
│  │                                                           │  │
│  │                  First Steps                             │  │
│  │            Complete your first lesson                    │  │
│  │                                                           │  │
│  │                +25 Points  +10 XP                        │  │
│  │                                                           │  │
│  │              [View All Achievements]                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Achievement Criteria Flow

```
Event: lesson_complete
Data: {lesson_id, time_spent, engagement_score, ...}
                             │
                             ▼
             ┌───────────────┴───────────────┐
             │                               │
             ▼                               ▼
    Check LESSON COUNT              Check TIME SPENT
         criteria                        criteria
             │                               │
    ┌────────┴────────┐              ┌──────┴──────┐
    │ lessons_completed│              │fast_completion│
    │    >= target     │              │  < 300 sec    │
    └────────┬────────┘              └──────┬──────┘
             │                               │
             ▼                               ▼
         Award:                          Award:
    "Dedicated Learner"                "Speed Demon"
    +100 pts, +50 XP                   +40 pts, +20 XP
             │                               │
             └───────────────┬───────────────┘
                             ▼
                    Update StudentPoints
                    Check for Level Up
                             │
                             ▼
                    Return new achievements
```

---

## Database Relationships

```
┌──────────┐       ┌─────────────────┐       ┌──────────────┐
│   User   │◄─────┤UserAchievement  │──────►│ Achievement  │
│          │       │  (Many-to-Many) │       │  (Definitions)│
└─────┬────┘       └─────────────────┘       └──────────────┘
      │                                              │
      │ 1:1                                    Properties:
      │                                        - name, title
      ▼                                        - criteria_type
┌─────────────┐                               - criteria_value
│StudentPoints│                               - points, xp_bonus
│  - total    │                               - tier, rarity
│  - level    │                               - is_hidden
│  - xp       │                               - is_repeatable
└─────────────┘
      │
      │ 1:1
      ▼
┌──────────────┐
│LearningStreak│
│ - current    │
│ - longest    │
│ - freeze_left│
└──────────────┘
```

---

## Component Hierarchy

```
AchievementsPage
│
├── TabNavigation
│   ├── Overview Tab
│   │   ├── PointsLevelDisplay
│   │   ├── StreakDisplay
│   │   ├── AchievementSummary (Progress Cards)
│   │   ├── Showcased Achievements Grid
│   │   │   └── AchievementCard (multiple)
│   │   └── Recent Achievements List
│   │       └── AchievementBadge (multiple)
│   │
│   ├── Achievements Tab
│   │   ├── SearchBar
│   │   ├── FilterButtons (Category, Tier, Rarity)
│   │   ├── ViewToggle (Grid/List)
│   │   ├── Earned Section
│   │   │   └── AchievementCard (multiple)
│   │   └── Locked Section
│   │       └── AchievementCard (locked state)
│   │
│   ├── Leaderboards Tab
│   │   ├── LeaderboardSelector
│   │   ├── UserRankCard
│   │   └── LeaderboardDisplay
│   │       └── LeaderboardRow (multiple)
│   │
│   ├── Quests Tab
│   │   ├── Active Quests
│   │   │   └── QuestCard (with progress)
│   │   ├── Available Quests
│   │   │   └── QuestCard (start button)
│   │   └── Completed Quests
│   │       └── QuestCard (completed state)
│   │
│   └── Stats Tab
│       ├── Achievement Stats Card
│       ├── Learning Stats Card
│       └── Points Breakdown Card
│
└── AchievementUnlockedModal (Popup)
    ├── Confetti Animation
    ├── AchievementBadge (large)
    └── Reward Details
```

---

## API Data Flow

```
Frontend Component
      │
      │ async call
      ▼
achievementApi.getEarnedAchievements()
      │
      │ HTTP GET with JWT
      ▼
Backend: GET /api/v1/achievements/earned
      │
      │ @student_required decorator
      ▼
Extract user_id from JWT token
      │
      │ Query database
      ▼
UserAchievement.query.filter_by(user_id=...)
      │
      │ Join with Achievement table
      ▼
Load achievement details + user progress
      │
      │ Serialize to JSON
      ▼
Return: [
  {
    id: 1,
    achievement: {...},
    progress: 100,
    earned_at: "2024-01-15",
    times_earned: 1,
    is_showcased: true
  },
  ...
]
      │
      │ Parse response
      ▼
Frontend updates state
      │
      │ Re-render
      ▼
Display achievements in UI
```

---

## Points Calculation Flow

```
Student Action
      │
      ▼
┌──────────────────────────────────────┐
│  POINTS SOURCES                      │
├──────────────────────────────────────┤
│                                      │
│  Lesson Complete      → +10 pts     │
│  Quiz Complete (80%+) → +15 pts     │
│  Quiz Perfect (100%)  → +25 pts     │
│  Assignment Complete  → +20 pts     │
│  Daily Streak         → +5 pts/day  │
│  Achievement Unlock   → varies      │
│  Milestone Reached    → varies      │
│  Quest Complete       → varies      │
│  Social Interaction   → +2 pts      │
│                                      │
└──────────┬───────────────────────────┘
           │
           ▼
    Update StudentPoints
           │
           ├─► total_points += points
           ├─► total_xp += xp
           ├─► lesson_points += ...
           ├─► quiz_points += ...
           └─► Check level up
                     │
                     ▼
           Level = floor(XP / 100)
                     │
                     ▼
           If new level > current:
             - Update level
             - Award bonus points
             - Check level milestones
```

---

## Streak Update Logic

```
Student completes lesson
      │
      ▼
update_learning_streak(user_id)
      │
      ├─► Get current streak record
      │
      ├─► Check last_activity_date
      │   │
      │   ├─► Same day?
      │   │   └─► No change, return current
      │   │
      │   ├─► Yesterday?
      │   │   └─► current_streak += 1
      │   │       milestone_check()
      │   │
      │   └─► More than 1 day ago?
      │       │
      │       ├─► Has freeze_days_left?
      │       │   ├─► YES: Use freeze, keep streak
      │       │   │   freeze_days_left -= 1
      │       │   │
      │       │   └─► NO: Reset streak to 1
      │       │       current_streak = 1
      │       │
      │       └─► Update last_activity_date
      │
      └─► Check for milestone achievements
          │
          ├─► 7 days?  → Award "Week Warrior"
          ├─► 30 days? → Award "Marathon Runner"
          └─► 100 days? → Award "Century Club"
```

---

## Frontend State Management

```
AchievementsPage Component State:

useState hooks:
├── achievements (Achievement[])
├── earnedAchievements (UserAchievement[])
├── streak (LearningStreak)
├── points (StudentPoints)
├── leaderboards (Leaderboard[])
├── quests (QuestChallenge[])
├── stats (AchievementStats)
│
├── activeTab ("overview" | "achievements" | ...)
├── searchQuery (string)
├── categoryFilter (string | "all")
├── tierFilter (string | "all")
├── rarityFilter (string | "all")
├── viewMode ("grid" | "list")
├── selectedLeaderboard (string)
│
└── loading (boolean)

useEffect triggers:
├── On mount: Load all data
├── On filter change: Filter achievements
└── On action: Reload specific data

User interactions:
├── Search → Filter achievements
├── Click filter → Update filter state
├── Toggle view → Update viewMode
├── Showcase → API call → Reload earned
├── Start quest → API call → Reload quests
└── Change tab → Update activeTab
```

---

## Achievement Unlock Animation Sequence

```
1. Backend returns new_achievements
        ↓
2. Frontend receives response
        ↓
3. Loop through new achievements:
        ↓
4. Set unlockedAchievement = achievement
        ↓
5. Set showAchievementModal = true
        ↓
6. AchievementUnlockedModal renders:
        ↓
   ┌────────────────────────────────┐
   │ Scale animation (0.5 → 1.0)    │
   │ Spring physics                  │
   │ Opacity fade-in                 │
   └────────────────────────────────┘
        ↓
7. Confetti particles spawn
   - 50 particles
   - Random colors based on rarity
   - Physics-based movement
        ↓
8. Badge appears with shine effect
   - Rotating gradient
   - Scale pulse (1.0 → 1.1 → 1.0)
        ↓
9. Text fades in staggered
   - Title (delay: 0.1s)
   - Description (delay: 0.2s)
   - Rewards (delay: 0.3s)
        ↓
10. User clicks "Close" or auto-close (3s)
        ↓
11. Modal exit animation
    - Scale (1.0 → 0.8)
    - Opacity fade-out
        ↓
12. If more achievements, repeat from step 4
        ↓
13. All done, return to normal flow
```

---

## File Import Dependencies

```
Frontend:

page.tsx
  ├─ imports: AchievementComponents.tsx
  │            ├─ AchievementBadge
  │            ├─ AchievementCard
  │            ├─ StreakDisplay
  │            ├─ PointsLevelDisplay
  │            └─ AchievementUnlockedModal
  │
  ├─ imports: LeaderboardComponents.tsx
  │            ├─ LeaderboardDisplay
  │            ├─ LeaderboardWidget
  │            └─ UserRankCard
  │
  └─ imports: achievementApi.ts
               └─ All API methods

achievementApi.ts
  └─ Defines types:
       - Achievement
       - UserAchievement
       - LearningStreak
       - StudentPoints
       - Leaderboard
       - Quest

Backend:

achievement_routes.py
  ├─ imports: achievement_service.py
  │            └─ AchievementService (all methods)
  │
  └─ imports: achievement_models.py
               ├─ Achievement
               ├─ UserAchievement
               ├─ LearningStreak
               ├─ StudentPoints
               ├─ Milestone
               ├─ UserMilestone
               ├─ Leaderboard
               ├─ QuestChallenge
               └─ UserQuestProgress

achievement_service.py
  ├─ imports: achievement_models.py (all models)
  ├─ imports: student_models.py (LessonCompletion, etc.)
  └─ imports: course_models.py (Course, Module, Lesson)
```

---

## Quick Integration Checklist

```
☐ Database Migration
  ├─ cd backend
  ├─ flask db migrate -m "Add achievements"
  └─ flask db upgrade

☐ Initialize Data
  ├─ cd /home/desire/My_Project/AB/afritec_bridge_lms
  └─ python init_achievements.py

☐ Register Routes
  └─ Add to app.py:
      from src.routes.achievement_routes import achievement_bp
      app.register_blueprint(achievement_bp)

☐ Update Lesson Completion
  └─ In progress_routes.py, add after lesson save:
      new_achievements = AchievementService.check_and_award_achievements(...)
      current_streak = AchievementService.update_learning_streak(...)
      return jsonify({..., new_achievements, current_streak})

☐ Frontend Navigation
  └─ Add link in student layout:
      <Link href="/student/achievements">Achievements</Link>

☐ Test
  ├─ Complete first lesson → "First Steps" unlocks
  ├─ Learn 2 days in a row → Streak = 2
  ├─ Visit /student/achievements → See dashboard
  └─ Complete quiz with 100% → "Perfect Score" unlocks
```

---

This visual guide should make integration crystal clear! 🎯
