# 🚀 Phase 5 Quick Reference Card

## Component Quick Access

### ModuleUnlockAnimation
```tsx
import ModuleUnlockAnimation from '@/components/student/ModuleUnlockAnimation';

<ModuleUnlockAnimation
  isVisible={true}
  moduleName="Python Basics"
  celebrationType="unlock" // 'unlock' | 'complete' | 'achievement'
  onComplete={() => console.log('Animation done!')}
/>
```

### ContextualHelpDialog
```tsx
import ContextualHelpDialog from '@/components/student/ContextualHelpDialog';

<ContextualHelpDialog
  isOpen={true}
  onClose={() => {}}
  context={{
    moduleId: 1,
    moduleName: "Intro to Programming",
    lessonId: 5,
    lessonName: "Functions",
    difficulty: "intermediate"
  }}
  strugglingAreas={["Loops", "Arrays"]}
/>
```

### Progressive Learning Hooks
```tsx
import { 
  useProgressiveLearning, 
  useModuleAttempts, 
  useModuleScoring 
} from '@/hooks/useProgressiveLearning';

// In your component
const { modules, unlockNextModule } = useProgressiveLearning(courseId);
const { attemptsRemaining, canRetake } = useModuleAttempts(moduleId, attempts);
const { cumulativeScore, breakdown } = useModuleScoring(moduleId, progress);
```

---

## Color Codes

### Attempt Counter
| Attempts Left | Color | Class | Effect |
|---------------|-------|-------|--------|
| 3 | 🟢 Green | `bg-green-100` | None |
| 2 | 🟡 Yellow | `bg-yellow-100` | None |
| 1 | 🔴 Red | `bg-red-100` | Pulse |
| 0 | ⚫ Gray | `bg-gray-100` | None |

### Risk Levels
| Level | Color | Badge |
|-------|-------|-------|
| Low | 🟢 Green | `badge-success` |
| Medium | 🟡 Yellow | `badge-warning` |
| High | 🔴 Red | `badge-destructive` |

---

## Key Thresholds

### Scoring
- **Pass Threshold**: 80%
- **Course Contribution**: 10%
- **Quizzes**: 30%
- **Assignments**: 40%
- **Final Assessment**: 20%

### Attempts
- **Max Attempts**: 3 per module
- **Warning Trigger**: Final attempt (1 left)
- **Suspension**: 0 attempts remaining
- **Appeal Window**: 30 days

---

## Event Handlers

### Unlock Animation
```tsx
const handleModuleComplete = (moduleId, nextModuleName) => {
  setUnlockAnimation({
    show: true,
    moduleName: nextModuleName,
    celebrationType: 'unlock'
  });
};
```

### Contextual Help
```tsx
const openHelp = () => {
  setHelpDialog({
    show: true,
    context: { moduleId, moduleName, difficulty },
    strugglingAreas: riskReasons
  });
};
```

### Final Attempt Warning
```tsx
const handleRetake = (moduleId) => {
  if (attemptsRemaining === 1) {
    setWarning({ show: true, moduleId });
  } else {
    doRetake(moduleId);
  }
};
```

---

## File Locations

```
/frontend/src/
├── components/student/
│   ├── ModuleUnlockAnimation.tsx (200 lines)
│   └── ContextualHelpDialog.tsx (400 lines)
├── hooks/
│   └── useProgressiveLearning.ts (400 lines)
├── app/student/learning/
│   ├── page.tsx (original, 1,011 lines)
│   └── enhanced-learning-page.tsx (new, 450 lines)
└── services/api/
    ├── course.service.ts
    ├── progress.service.ts
    └── assessment.service.ts

/docs/
├── PHASE_5_COMPLETION.md (500 lines)
├── PHASE_5_INTEGRATION_GUIDE.md (400 lines)
└── PHASE_5_SUMMARY.md (300 lines)
```

---

## Dependencies

```json
{
  "dependencies": {
    "framer-motion": "^10.x",
    "canvas-confetti": "^1.x",
    "lucide-react": "^0.x",
    "@radix-ui/react-dialog": "^1.x",
    "@radix-ui/react-tooltip": "^1.x"
  }
}
```

---

## Common Patterns

### Toast Notification (Alternative to Animation)
```tsx
import { useToast } from '@/components/ui/use-toast';

const { toast } = useToast();

toast({
  title: "Module Unlocked!",
  description: `${moduleName} is now available.`,
  duration: 3000,
});
```

### Loading State
```tsx
const [loading, setLoading] = useState(false);

<Button disabled={loading}>
  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  {loading ? 'Processing...' : 'Submit'}
</Button>
```

### Error Handling
```tsx
try {
  await unlockNextModule(moduleId);
} catch (error) {
  toast({
    title: "Error",
    description: error.message,
    variant: "destructive",
  });
}
```

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Tab` | Navigate elements |
| `Enter` | Activate button |
| `Escape` | Close dialog |
| `Space` | Toggle button |
| `?` | Show help (custom) |

---

## Accessibility Checklist

- [ ] All images have `alt` text
- [ ] Interactive elements are focusable
- [ ] Focus indicators visible
- [ ] ARIA labels on icons
- [ ] Color is not sole indicator
- [ ] Text contrast ≥4.5:1
- [ ] Keyboard navigation works
- [ ] Screen reader tested

---

## Performance Tips

1. **Lazy Load Dialogs**: Only render when open
2. **Memoize Calculations**: Use `useMemo` for expensive operations
3. **Debounce Updates**: Prevent excessive re-renders
4. **Virtual Scrolling**: For long lists
5. **Code Splitting**: Dynamic imports for heavy components

---

## Testing Commands

```bash
# Run all tests
npm test

# Run specific test
npm test ModuleUnlockAnimation

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch

# E2E tests
npm run test:e2e
```

---

## Debugging

### Enable Debug Mode
```tsx
const DEBUG = process.env.NODE_ENV === 'development';

if (DEBUG) console.log('Animation triggered:', { moduleId, name });
```

### React DevTools
- Install React DevTools extension
- Inspect component props/state
- Check component tree
- Profile performance

### Network Tab
- Monitor API calls
- Check response times
- Verify payloads
- Debug CORS issues

---

## Common Issues & Fixes

### Animation Not Showing
```tsx
// ✅ Correct
setUnlockAnimation({ show: true, moduleName: 'Test' });

// ❌ Wrong
setUnlockAnimation({ show: true }); // Missing moduleName
```

### Help Dialog Context Null
```tsx
// ✅ Correct
{helpDialog.context && <ContextualHelpDialog {...props} />}

// ❌ Wrong
<ContextualHelpDialog context={null} /> // Will error
```

### Attempt Counter Not Updating
```tsx
// ✅ Correct
const remaining = progress.max_attempts - progress.attempts_count;

// ❌ Wrong
const remaining = 3 - progress.attempts; // Hardcoded max
```

---

## Integration Checklist

- [ ] Installed dependencies
- [ ] Imported components
- [ ] Added state management
- [ ] Created event handlers
- [ ] Added dialog components to render
- [ ] Tested unlock animation
- [ ] Tested help dialog
- [ ] Tested attempt warning
- [ ] Verified accessibility
- [ ] Checked dark mode
- [ ] Optimized performance

---

## Phase Statistics

| Metric | Value |
|--------|-------|
| Components | 3 |
| Lines of Code | 1,050 |
| Documentation | 1,400 lines |
| Hooks Used | 3 |
| Dialogs | 2 |
| Animations | 15+ |
| Test Coverage | TBD |
| Bundle Size | +22KB |

---

## Next Steps

1. **Test Integration**: Follow `/PHASE_5_INTEGRATION_GUIDE.md`
2. **Gather Feedback**: Use analytics to track usage
3. **Optimize**: Profile and improve performance
4. **Plan Phase 6**: AI Learning Companion

---

## Support

- **Docs**: `/PHASE_5_COMPLETION.md`
- **Integration**: `/PHASE_5_INTEGRATION_GUIDE.md`
- **Examples**: `/frontend/src/app/student/learning/enhanced-learning-page.tsx`

---

*Quick Reference v1.0 - Phase 5 Complete! 🎉*
