# 🚀 Quick Start - Achievement System

## Prerequisites
✅ Backend database tables created
✅ Achievement data initialized (16 achievements, 8 milestones, 6 leaderboards, 3 quests)
✅ Frontend hydration errors fixed

## Start the System

### 1. Start Backend (Terminal 1)
```bash
cd /home/desire/My_Project/AB/afritec_bridge_lms/backend
source venv/bin/activate
python main.py
```

**Expected Output:**
```
* Running on http://127.0.0.1:5000
* Restarting with stat
* Debugger is active!
```

### 2. Start Frontend (Terminal 2)
```bash
cd /home/desire/My_Project/AB/afritec_bridge_lms/frontend
npm run dev
```

**Expected Output:**
```
▲ Next.js 14.x.x
- Local:        http://localhost:3000
- ready in X.Xs
```

### 3. Test Achievement System

**Open Browser:**
```
http://localhost:3000/student/achievements
```

**You should see:**
- ✅ Loading indicator (briefly)
- ✅ 5 tabs: Overview | Achievements | Leaderboards | Quests | Stats
- ✅ 16 achievements displayed
- ✅ Points and level system
- ✅ Streak tracking
- ✅ 6 leaderboards
- ✅ 3 quests available

## Test API Endpoints

### Test with curl:
```bash
# Get all achievements
curl http://localhost:5000/api/v1/achievements/

# Get leaderboards
curl http://localhost:5000/api/v1/achievements/leaderboards

# Get quests
curl http://localhost:5000/api/v1/achievements/quests
```

## Troubleshooting

### Issue: "Backend Not Running" message
**Solution:** Start the backend server (see step 1 above)

### Issue: Frontend shows errors
**Solution:** 
1. Clear browser cache: Ctrl+Shift+R
2. Restart frontend: `Ctrl+C` then `npm run dev`

### Issue: 404 on achievement endpoints
**Solution:** Check that achievement routes are registered in `backend/main.py`

### Issue: Empty achievements list
**Solution:** Run initialization again:
```bash
cd /home/desire/My_Project/AB/afritec_bridge_lms
source backend/venv/bin/activate
python init_achievements.py
```

## What to Test

### ✅ Overview Tab
- [ ] Points and level display shows correctly
- [ ] Streak counter displays (will be 0 initially)
- [ ] Achievement summary shows progress bars
- [ ] No showcased achievements yet (need to earn some first)

### ✅ Achievements Tab
- [ ] Grid view shows 16 achievement badges
- [ ] All achievements show as "locked" (not earned yet)
- [ ] Search bar filters achievements
- [ ] Category filter works (speed, consistency, mastery, etc.)
- [ ] Switch to list view works

### ✅ Leaderboards Tab
- [ ] 6 leaderboard buttons visible
- [ ] Clicking each shows different leaderboard
- [ ] User rank card shows (may be empty initially)

### ✅ Quests Tab
- [ ] 3 quests displayed
- [ ] "Start Quest" buttons work
- [ ] Quest details show difficulty, rewards

### ✅ Stats Tab
- [ ] Achievement statistics display
- [ ] Points breakdown visible
- [ ] Learning stats shown

## Next: Earn Your First Achievement!

To actually earn achievements, you need to:
1. Complete a lesson → "First Steps" achievement unlocks
2. Complete lessons 2 days in a row → Streak starts
3. Score 100% on a quiz → "Perfect Score" unlocks

But first, you need to integrate the achievement triggers into your lesson completion flow. See `SETUP_COMPLETE.md` for integration steps.

---

**Status**: ✅ System ready to test
**Time to start**: ~2 minutes
**Ready to earn achievements**: After integration
