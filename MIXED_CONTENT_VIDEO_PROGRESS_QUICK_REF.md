# Mixed Content Video Progress - Quick Reference

## What Was Fixed

**Problem**: Videos in mixed content lessons weren't tracking progress → no engagement score contribution

**Solution**: Implemented full video progress tracking for all video types in mixed content (YouTube, Vimeo, Direct)

## Quick Test

1. Navigate to a lesson with mixed content containing videos
2. Open browser console (F12)
3. Play a video
4. Look for: `"📊 Mixed [YouTube/Vimeo/direct] video 0 progress: X%"`
5. Check engagement badge in lesson header - should increase as video plays

## Expected Console Output

### YouTube Video
```
🎬 Initializing YouTube players for mixed content...
Found 1 YouTube videos in mixed content
Initializing YouTube player 0...
✅ YouTube player 0 initialized and ready
📺 YouTube player 0 is ready
📊 Mixed YouTube video 0 progress: 5.2%
📊 Mixed YouTube video 0 progress: 10.8%
📊 Mixed YouTube video 0 progress: 15.3%
...
✅ Mixed YouTube video 0 completed (90% threshold reached)
```

### Vimeo Video
```
🎬 Initializing Vimeo players for mixed content...
Found 1 Vimeo videos in mixed content
Initializing Vimeo player 0...
✅ Vimeo player 0 initialized
📺 Vimeo player 0 ready
📊 Mixed Vimeo video 0 progress: 3.1%
📊 Mixed Vimeo video 0 progress: 7.4%
...
✅ Mixed Vimeo video 0 completed (90% threshold reached)
```

### Direct Video
```
📊 Mixed direct video 0 progress: 2.5%
📊 Mixed direct video 0 progress: 5.1%
📊 Mixed direct video 0 progress: 8.3%
...
✅ Mixed direct video 0 completed (90% threshold reached)
```

## Key Features

### Progress Tracking
- **YouTube**: Updates every 2 seconds via polling
- **Vimeo**: Real-time updates via `timeupdate` event
- **Direct**: Real-time updates via `timeupdate` event

### Engagement Contribution
- Videos now contribute **40%** to engagement score
- Progress updates propagate to parent component
- Engagement badge reflects video watching progress

### Completion Detection
- 90% threshold triggers completion event
- Unlocks next lesson when completed
- Marks lesson as watched

## Technical Details

### Unique IDs
Each video gets a unique ID based on its index:
- YouTube: `mixed-youtube-0`, `mixed-youtube-1`, etc.
- Vimeo: `mixed-vimeo-0`, `mixed-vimeo-1`, etc.
- Direct: `mixed-direct-0`, `mixed-direct-1`, etc.

### Player Initialization
- YouTube: Uses YouTube IFrame API (`YT.Player`)
- Vimeo: Uses Vimeo Player API (`Vimeo.Player`)
- Direct: Uses HTML5 video element with event listeners

### Progress Callback
All video types call the same callback:
```typescript
if (onVideoProgress) {
  onVideoProgress(progress); // 0-100
}
```

## Troubleshooting

### No console logs
- **Check**: Is this a mixed content lesson? (`content_type === 'mixed'`)
- **Check**: Does the mixed content have videos?
- **Check**: Are video APIs loaded? (YouTube IFrame API, Vimeo Player API)

### "Could not find iframe with id..."
- **Issue**: Video iframe doesn't have correct ID
- **Check**: Is `mixedContentIndex` being passed correctly?
- **Check**: Is iframe rendered before player initialization?

### Progress not updating engagement
- **Issue**: `onVideoProgress` callback not being called
- **Check**: Is callback prop passed to component?
- **Check**: Console logs show progress updates?
- **Check**: Parent component receives updates?

### Multiple videos interfering
- **Issue**: Player refs conflicting
- **Check**: Each video has unique ID
- **Check**: No duplicate IDs in same lesson
- **Check**: Cleanup on unmount working correctly

## Quick Verification Steps

1. **Open lesson with mixed content video**
2. **Check console for initialization logs** → Should see "🎬 Initializing..."
3. **Play video** → Should see "📊 Mixed ... video progress: X%"
4. **Watch engagement badge** → Should increase from initial value
5. **Let video reach 90%** → Should see completion log

## Files Modified

- `ContentRichPreview.tsx` (9 changes)
  - Added `mixedVideoRefs` for tracking
  - Added YouTube player initialization
  - Added Vimeo player initialization
  - Added direct video tracking
  - Updated `renderVideoContent` signature
  - Added IDs to video iframes
  - Enhanced callback pattern

## Success Indicators

✅ Console shows initialization logs for each video type
✅ Progress updates appear every 2 seconds (YouTube) or continuously (Vimeo/Direct)
✅ Engagement badge value increases as video plays
✅ 90% completion triggers completion event
✅ No errors in console
✅ Multiple videos work independently

## Engagement Formula

```
Engagement = (Video × 0.40) + (Scroll × 0.20) + (Time × 0.20) + (Interactions × 0.10) + (Consistency × 0.10)
```

**Video contribution**: 0-40 points based on percentage watched

**Example**: 
- 0% watched = 0 points
- 50% watched = 20 points
- 90% watched = 36 points
- 100% watched = 40 points

## Common Questions

**Q: Why 2-second polling for YouTube instead of events?**
A: YouTube IFrame API doesn't provide continuous progress events. Polling ensures regular updates.

**Q: Why 90% completion threshold?**
A: Allows for skipping credits/outros while ensuring substantial content consumption.

**Q: Do videos in mixed content affect lesson completion?**
A: Yes! Video progress contributes 40% to engagement score, which affects overall lesson score.

**Q: Can I have multiple videos in same lesson?**
A: Absolutely! Each gets unique ID and independent tracking. Engagement reflects most recent video played.

**Q: What happens if YouTube/Vimeo API fails to load?**
A: Graceful degradation - videos still play, but progress tracking won't work. Console shows warning.

## For Developers

### Adding New Video Platform

1. Add platform detection in `renderVideoContent`
2. Create useEffect for player initialization (follow YouTube/Vimeo pattern)
3. Add unique ID to iframe/element (`mixed-[platform]-${index}`)
4. Track progress via platform API
5. Call `onVideoProgress(progress)` on updates
6. Add cleanup in useEffect return
7. Add console logging for debugging

### Debugging Tips

- Enable verbose logging: Check all console.log statements
- Use React DevTools: Inspect `mixedVideoRefs.current`
- Check Network tab: Verify video APIs loaded
- Monitor State: Watch `videoProgress` state changes
- Test Edge Cases: Multiple videos, rapid navigation, API failures
