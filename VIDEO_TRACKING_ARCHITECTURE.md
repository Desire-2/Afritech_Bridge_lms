# Video Tracking Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           STUDENT LEARNING PAGE                              │
│                     (page.tsx - Main Orchestrator)                          │
│                                                                              │
│  State Management:                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ • videoProgress: number (0-100)                                      │  │
│  │ • videoCompleted: boolean                                            │  │
│  │ • interactionHistory: InteractionEvent[]                             │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  Callbacks:                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ handleVideoProgress(progress: number)                                │  │
│  │   ├─ Update videoProgress state                                      │  │
│  │   └─ Log to interactionHistory                                       │  │
│  │                                                                       │  │
│  │ handleVideoComplete()                                                │  │
│  │   ├─ Set videoCompleted = true                                       │  │
│  │   ├─ Call StudentApiService.completeLesson()                         │  │
│  │   ├─ Show celebration modal                                          │  │
│  │   └─ Log completion event                                            │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  Navigation Gating:                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ const requiresVideoCompletion = lesson.content_type === 'video'      │  │
│  │ const canNavigateNext = !requiresVideoCompletion || videoCompleted   │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    │ Props: onVideoProgress, onVideoComplete
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            LESSON CONTENT                                    │
│                  (LessonContent.tsx - Pass-through)                         │
│                                                                              │
│  Role: Pass callbacks and refs to ContentRichPreview                        │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ <ContentRichPreview                                                  │  │
│  │   lesson={currentLesson}                                             │  │
│  │   onVideoProgress={onVideoProgress}                                  │  │
│  │   onVideoComplete={onVideoComplete}                                  │  │
│  │ />                                                                   │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    │ Props received
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CONTENT RICH PREVIEW                                    │
│              (ContentRichPreview.tsx - Video Handler)                       │
│                                                                              │
│  Detection Logic:                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ const isYouTube = url.includes('youtube.com') || 'youtu.be'          │  │
│  │ const isVimeo = url.includes('vimeo.com')                            │  │
│  │ const isDirect = !(isYouTube || isVimeo)                             │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌────────────────────┬──────────────────────┬──────────────────────────┐  │
│  │   YOUTUBE PATH     │    VIMEO PATH        │    DIRECT VIDEO PATH     │  │
│  └────────────────────┴──────────────────────┴──────────────────────────┘  │
│            │                      │                        │                 │
└────────────┼──────────────────────┼────────────────────────┼─────────────────┘
             ▼                      ▼                        ▼
    
    ┌────────────────┐      ┌─────────────────┐      ┌──────────────────┐
    │ YOUTUBE PLAYER │      │  VIMEO PLAYER   │      │  DIRECT VIDEO    │
    └────────────────┘      └─────────────────┘      └──────────────────┘
             │                      │                        │
             ▼                      ▼                        ▼
    
┌────────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
│  YouTube IFrame API    │ │   Vimeo Player SDK   │ │   HTML5 Video API   │
│                        │ │                      │ │                      │
│ 1. Load API Script     │ │ 1. Load SDK Script   │ │ 1. Create <video>   │
│    youtube.com/        │ │    player.vimeo.com/ │ │    element          │
│    iframe_api          │ │    api/player.js     │ │                      │
│                        │ │                      │ │ 2. Add event        │
│ 2. Initialize Player   │ │ 2. Initialize Player │ │    listeners:       │
│    new YT.Player()     │ │    new Vimeo.Player()│ │    - timeupdate     │
│                        │ │                      │ │    - loadedmetadata │
│ 3. Poll every 1s:      │ │ 3. Listen to events: │ │                      │
│    - getCurrentTime()  │ │    - timeupdate      │ │ 3. Track progress   │
│    - getDuration()     │ │    - play/pause      │ │    on timeupdate    │
│                        │ │                      │ │                      │
│ 4. Calculate:          │ │ 4. Get from data:    │ │ 4. Calculate:       │
│    progress =          │ │    progress =        │ │    progress =       │
│    (current/total)*100 │ │    (secs/dur)*100    │ │    (current/dur)*100│
│                        │ │                      │ │                      │
│ 5. If progress >= 90%  │ │ 5. If progress >=90% │ │ 5. If progress>=90% │
│    ├─ setVideoWatched  │ │    ├─ setVideoWatched│ │    ├─setVideoWatched│
│    └─ onVideoComplete()│ │    └─onVideoComplete()│ │    └─onVideoComplete│
└────────────────────────┘ └──────────────────────┘ └──────────────────────┘
             │                      │                        │
             └──────────────────────┴────────────────────────┘
                                    │
                                    │ All paths converge
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         VISUAL PROGRESS DISPLAY                              │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  Progress Card Component                                              │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │ 🎬 Video Progress          [State: In Progress / Completed]     │ │ │
│  │  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━░░░░░░░░░░░░░░░░                    │ │ │
│  │  │ 2:15                                                      5:00  │ │ │
│  │  │ 🔒 Watch at least 90% to unlock next lesson                    │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                       │ │
│  │  State-based Styling:                                                │ │
│  │  • Not Started: Blue background, 0% progress                        │ │
│  │  • In Progress: Blue background, increasing progress bar            │ │
│  │  • Completed: Green background, ✅ badge, 100% progress             │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ On completion (>=90%)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          BACKEND INTEGRATION                                 │
│                                                                              │
│  API Call:                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ POST /api/v1/student/lessons/{lessonId}/complete                     │ │
│  │                                                                       │ │
│  │ Request Body:                                                         │ │
│  │ {                                                                     │ │
│  │   "method": "video_watched",                                          │ │
│  │   "module_id": 123,                                                   │ │
│  │   "auto_completed": false                                             │ │
│  │ }                                                                     │ │
│  │                                                                       │ │
│  │ Response:                                                             │ │
│  │ {                                                                     │ │
│  │   "success": true,                                                    │ │
│  │   "lesson_id": 456,                                                   │ │
│  │   "completed_at": "2025-11-01T10:30:00Z"                             │ │
│  │ }                                                                     │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  Database Updates:                                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ • lesson_progress.completed = true                                    │ │
│  │ • lesson_progress.completed_at = NOW()                                │ │
│  │ • lesson_progress.completion_method = 'video_watched'                 │ │
│  │ • Update module progress calculations                                 │ │
│  │ • Check if next lesson should unlock                                  │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Success response
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            UI UPDATES                                        │
│                                                                              │
│  1. Celebration Modal                                                       │
│     ┌──────────────────────────────────────────────────────────────────┐   │
│     │  🎉 Lesson Completed!                                            │   │
│     │  Excellent work! You completed this lesson.                      │   │
│     │                                                                  │   │
│     │  📊 Time: 5m 30s    💪 Engagement: 95%    📚 Progress: 100%     │   │
│     │                                                                  │   │
│     │  [Continue to Next Lesson]                                       │   │
│     └──────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  2. Next Lesson Unlock                                                      │
│     ┌──────────────────────────────────────────────────────────────────┐   │
│     │  ✅ Lesson 1: Introduction                    [Completed]        │   │
│     │  🔓 Lesson 2: Advanced Topics                 [Available]        │   │
│     │  🔒 Lesson 3: Final Project                   [Locked]           │   │
│     └──────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  3. Progress Dashboard Update                                               │
│     ┌──────────────────────────────────────────────────────────────────┐   │
│     │  Course Progress: 33% → 45%                                      │   │
│     │  Lessons Completed: 5 → 6                                        │   │
│     │  Time Spent: +5m 30s                                             │   │
│     └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                          STATE FLOW DIAGRAM                                  │
│                                                                              │
│  Lesson Opened                                                              │
│       │                                                                      │
│       ▼                                                                      │
│  Detect Video Type                                                          │
│       │                                                                      │
│       ├──────────────┬──────────────┬──────────────┐                       │
│       │              │              │              │                        │
│       ▼              ▼              ▼              ▼                        │
│   YouTube        Vimeo         Direct        Mixed                         │
│       │              │              │              │                        │
│       └──────────────┴──────────────┴──────────────┘                       │
│                      │                                                      │
│                      ▼                                                      │
│              Initialize Player                                              │
│                      │                                                      │
│                      ▼                                                      │
│           Start Progress Tracking                                           │
│                      │                                                      │
│                      ▼                                                      │
│         Update Progress (every 1s)                                          │
│                      │                                                      │
│                      ▼                                                      │
│              Progress < 90%? ──Yes──┐                                      │
│                      │               │                                      │
│                     No               ▼                                      │
│                      │         Continue Watching                            │
│                      │               │                                      │
│                      │               └────────┐                            │
│                      ▼                        │                            │
│              Mark as Watched ◄────────────────┘                            │
│                      │                                                      │
│                      ▼                                                      │
│          Call onVideoComplete()                                             │
│                      │                                                      │
│                      ▼                                                      │
│            API: Complete Lesson                                             │
│                      │                                                      │
│                      ▼                                                      │
│           Show Celebration Modal                                            │
│                      │                                                      │
│                      ▼                                                      │
│            Unlock Next Lesson                                               │
│                      │                                                      │
│                      ▼                                                      │
│             Update UI State                                                 │
│                      │                                                      │
│                      ▼                                                      │
│                   Done ✅                                                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         ERROR HANDLING FLOW                                  │
│                                                                              │
│  ┌───────────────┐                                                          │
│  │ API Load Fail │──────► Show error message                                │
│  └───────────────┘        Fallback to basic player                          │
│                                                                              │
│  ┌───────────────┐                                                          │
│  │ Player Init   │──────► Retry initialization                              │
│  │ Fail          │        Log error to console                              │
│  └───────────────┘        Show user-friendly message                        │
│                                                                              │
│  ┌───────────────┐                                                          │
│  │ Progress API  │──────► Retry with exponential backoff                    │
│  │ Call Fail     │        Cache progress locally                            │
│  └───────────────┘        Sync when connection restored                     │
│                                                                              │
│  ┌───────────────┐                                                          │
│  │ Network Error │──────► Show offline indicator                            │
│  └───────────────┘        Allow local progress tracking                     │
│                           Sync on reconnect                                 │
└─────────────────────────────────────────────────────────────────────────────┘

Legend:
━━━  Data Flow
│    Vertical Flow
▼    Direction
┌─┐  Container/Component
```

## Key Components Interaction Summary

1. **page.tsx** → Orchestrates everything, manages state
2. **LessonContent.tsx** → Pass-through component
3. **ContentRichPreview.tsx** → Video detection and player initialization
4. **Player APIs** → External (YouTube/Vimeo) or Native (HTML5)
5. **Backend API** → Persists completion status
6. **UI Components** → Visual feedback to user

## Data Flow Summary

```
User Action → Player Events → Progress Calculation → State Update 
    → Callback Trigger → API Call → Database Update → UI Refresh
```

## Success Path

```
Video Opened → Player Initialized → Progress Tracked → 90% Reached 
    → Completion Triggered → API Called → Lesson Marked Complete 
    → Modal Shown → Next Lesson Unlocked → Success! 🎉
```
