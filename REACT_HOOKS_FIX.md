# React Hooks Order Fix - Learning Interface

## Problem
React detected a change in the order of Hooks called by the LearningPage component, causing the following error:

```
React has detected a change in the order of Hooks called by LearningPage. This will lead to bugs and errors if not fixed.
Error: Should have a queue. You are likely calling Hooks conditionally, which is not allowed.
```

## Root Cause
The issue was caused by conditional hook calls in the LearningPage component:

```typescript
// ❌ PROBLEMATIC CODE (before fix)
const progressiveLearning = currentModuleId ? useProgressiveLearning(courseId) : null;
const moduleAttempts = currentModuleId ? useModuleAttempts(currentModuleId) : null;
const moduleScoring = currentModuleId ? useModuleScoring(currentModuleId) : null;
```

This violated React's Rules of Hooks, which state that hooks must be called in the exact same order on every render.

## Solution
### 1. Fixed Conditional Hook Calls
Changed the hooks to always be called unconditionally:

```typescript
// ✅ FIXED CODE (after fix)
const progressiveLearning = useProgressiveLearning(courseId);
const moduleAttempts = useModuleAttempts(currentModuleId || 0);
const moduleScoring = useModuleScoring(currentModuleId || 0);
```

### 2. Updated Hooks to Handle Invalid IDs
Modified the hook implementations to gracefully handle invalid module IDs:

#### useModuleAttempts Hook:
```typescript
useEffect(() => {
  // Skip loading if moduleId is invalid
  if (!moduleId || moduleId <= 0) {
    setLoading(false);
    return;
  }
  // ... rest of the loading logic
}, [moduleId]);
```

#### useModuleScoring Hook:
```typescript
useEffect(() => {
  // Skip loading if moduleId is invalid
  if (!moduleId || moduleId <= 0) {
    setLoading(false);
    return;
  }
  // ... rest of the loading logic
}, [moduleId]);
```

### 3. Updated Component Logic
Added conditional checks in the component where the hook data is used:

```typescript
// Only display scoring info when we have valid data
{moduleScoring && currentModuleId && currentModuleId > 0 && (
  <Badge variant={moduleScoring.isPassing ? "default" : "destructive"}>
    Score: {moduleScoring.cumulativeScore.toFixed(1)}%
  </Badge>
)}
```

## Files Modified
1. `/frontend/src/app/student/learn/[id]/page.tsx`
   - Fixed conditional hook calls
   - Added validation checks for hook data usage

2. `/frontend/src/hooks/useProgressiveLearning.ts`
   - Updated `useModuleAttempts` to handle invalid module IDs
   - Updated `useModuleScoring` to handle invalid module IDs
   - Added error handling in `recordAttempt` and `recalculate` functions

## Key Principles Applied
1. **Always call hooks unconditionally** - Hooks must be called in the same order every render
2. **Handle invalid data gracefully** - Use conditional logic in the hook implementation, not when calling hooks
3. **Validate data before using** - Check for valid data when rendering, not when calling hooks

## Testing
- Application now loads without React hook order errors
- Learning interface functions correctly with proper data validation
- Invalid module IDs are handled gracefully without breaking the component

## Resources
- [React Rules of Hooks](https://react.dev/link/rules-of-hooks)
- [React Hook Error Documentation](https://react.dev/link/invalid-hook-call)