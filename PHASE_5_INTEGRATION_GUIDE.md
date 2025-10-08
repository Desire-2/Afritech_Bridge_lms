# Phase 5 Integration Guide

## 🎯 Quick Start: Adding Phase 5 Features to Your Existing Learning Page

This guide shows you how to integrate the Phase 5 enhancements into your existing learning page.

---

## ✅ Step 1: Import New Components

Add these imports to your learning page:

```typescript
// New components
import ModuleUnlockAnimation from '@/components/student/ModuleUnlockAnimation';
import ContextualHelpDialog from '@/components/student/ContextualHelpDialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// New hooks
import { 
  useProgressiveLearning, 
  useModuleAttempts, 
  useModuleScoring 
} from '@/hooks/useProgressiveLearning';

// New icons
import { HelpCircle, AlertCircle } from 'lucide-react';
```

---

## ✅ Step 2: Add State Management

Add these state variables to your main component:

```typescript
const LearningDashboard = () => {
  // Existing state...
  
  // New state for unlock animation
  const [unlockAnimation, setUnlockAnimation] = useState({
    show: false,
    moduleName: '',
    celebrationType: 'unlock' as 'unlock' | 'complete' | 'achievement'
  });
  
  // New state for help dialog
  const [helpDialog, setHelpDialog] = useState({
    show: false,
    context: null as any,
    strugglingAreas: [] as string[]
  });
  
  // New state for final attempt warning
  const [finalAttemptWarning, setFinalAttemptWarning] = useState({
    show: false,
    moduleId: null as number | null
  });
  
  // Rest of your component...
};
```

---

## ✅ Step 3: Enhance Your Module Card Component

### Option A: Replace Existing ModuleCard

Replace your current `ModuleCard` component with the enhanced version from `/frontend/src/app/student/learning/enhanced-learning-page.tsx`.

### Option B: Enhance Existing Component Gradually

Add these enhancements to your existing `ModuleCard`:

#### 3.1 Add Progressive Learning Hooks

```typescript
const ModuleCard = ({ moduleData, isLocked, onRetake, onContinue }) => {
  const { module, progress } = moduleData;
  
  // Add these hooks
  const moduleScoring = useModuleScoring(module.id, progress);
  const moduleAttempts = useModuleAttempts(module.id, progress.attempts_count);
  
  // Existing code...
};
```

#### 3.2 Add Help Button to Card Header

```typescript
<CardTitle className="text-lg mb-2 flex items-center space-x-2">
  {getStatusIcon(progress.status)}
  <span>{module.title}</span>
  
  {/* Add this help button */}
  {!isLocked && (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => setHelpDialog({
            show: true,
            context: {
              moduleId: module.id,
              moduleName: module.title,
              difficulty: module.difficulty || 'intermediate'
            },
            strugglingAreas: suspensionRisk.reasons || []
          })}
        >
          <HelpCircle className="h-4 w-4 text-blue-600" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Get help with this module</p>
      </TooltipContent>
    </Tooltip>
  )}
</CardTitle>
```

#### 3.3 Enhance Attempt Counter

Replace your existing attempt counter with:

```typescript
const getAttemptColor = () => {
  const remaining = progress.max_attempts - progress.attempts_count;
  if (remaining === 3) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 border-green-300';
  if (remaining === 2) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 border-yellow-300';
  if (remaining === 1) return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 border-red-300 animate-pulse';
  return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300 border-gray-300';
};

// In your render:
<Tooltip>
  <TooltipTrigger asChild>
    <div className={`px-3 py-1 rounded-full border-2 font-semibold ${getAttemptColor()}`}>
      {progress.attempts_count}/{progress.max_attempts}
    </div>
  </TooltipTrigger>
  <TooltipContent>
    <div className="text-sm space-y-1">
      <p className="font-semibold">Attempts Used: {progress.attempts_count}</p>
      <p>Remaining: {progress.max_attempts - progress.attempts_count}</p>
      {progress.max_attempts - progress.attempts_count === 1 && (
        <p className="text-red-600 font-bold">⚠️ Final attempt!</p>
      )}
    </div>
  </TooltipContent>
</Tooltip>
```

#### 3.4 Add Final Attempt Warning

Update your retake handler:

```typescript
const handleRetakeClick = () => {
  const remaining = progress.max_attempts - progress.attempts_count;
  
  if (remaining === 1) {
    setFinalAttemptWarning({
      show: true,
      moduleId: module.id
    });
  } else {
    onRetake(module.id);
  }
};

// Update your retake button:
<Button 
  variant="destructive" 
  className="flex-1"
  onClick={handleRetakeClick}  // Changed from onRetake
>
  <RotateCcw className="h-4 w-4 mr-2" />
  Retake ({progress.max_attempts - progress.attempts_count} left)
</Button>
```

---

## ✅ Step 4: Add Unlock Animation Trigger

Add this handler to show unlock animation when a module is completed:

```typescript
const handleModuleComplete = (moduleId: number, nextModuleName: string) => {
  // Show unlock animation
  setUnlockAnimation({
    show: true,
    moduleName: nextModuleName,
    celebrationType: 'unlock'
  });
  
  // Refresh module data
  if (selectedCourse) {
    handleViewModules(selectedCourse);
  }
};

// Call this after successful module completion
// For example, in your continueModule handler:
const handleContinueModule = async (moduleId: number) => {
  const result = await StudentApiService.continueModule(moduleId);
  
  if (result.moduleCompleted && result.nextModule) {
    handleModuleComplete(moduleId, result.nextModule.title);
  }
};
```

---

## ✅ Step 5: Add Dialog Components to Your Render

Add these dialog components at the end of your main component's return statement:

```typescript
return (
  <div className="min-h-screen ...">
    {/* Your existing content */}
    
    {/* Add these at the end, before closing div */}
    
    {/* Unlock Animation Overlay */}
    <ModuleUnlockAnimation
      isVisible={unlockAnimation.show}
      moduleName={unlockAnimation.moduleName}
      celebrationType={unlockAnimation.celebrationType}
      onComplete={() => setUnlockAnimation({ ...unlockAnimation, show: false })}
    />
    
    {/* Contextual Help Dialog */}
    {helpDialog.context && (
      <ContextualHelpDialog
        isOpen={helpDialog.show}
        onClose={() => setHelpDialog({ ...helpDialog, show: false })}
        context={helpDialog.context}
        strugglingAreas={helpDialog.strugglingAreas}
      />
    )}
    
    {/* Final Attempt Warning Dialog */}
    <Dialog 
      open={finalAttemptWarning.show} 
      onOpenChange={(open) => setFinalAttemptWarning({ ...finalAttemptWarning, show: open })}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-red-600">
            <AlertTriangle className="h-6 w-6" />
            <span>Final Attempt Warning</span>
          </DialogTitle>
          <DialogDescription className="space-y-3 pt-4">
            <p className="font-semibold text-foreground">
              ⚠️ This is your last attempt for this module!
            </p>
            <p>
              If you fail this attempt, you will be suspended from the entire course and will need to:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Submit an appeal within 30 days</li>
              <li>Wait for administrative review</li>
              <li>Potentially re-enroll and start from the beginning</li>
            </ul>
            <p className="font-semibold text-foreground">
              Are you sure you're ready to retake this module?
            </p>
          </DialogDescription>
        </DialogHeader>
        <div className="flex space-x-2 justify-end">
          <Button 
            variant="outline" 
            onClick={() => setFinalAttemptWarning({ show: false, moduleId: null })}
          >
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={() => {
              if (finalAttemptWarning.moduleId) {
                handleRetakeModule(finalAttemptWarning.moduleId);
              }
              setFinalAttemptWarning({ show: false, moduleId: null });
            }}
          >
            I Understand, Proceed
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>
);
```

---

## ✅ Step 6: Install Required Dependencies

Make sure you have these dependencies installed:

```bash
cd frontend

# Core dependencies (likely already installed)
npm install framer-motion lucide-react

# Canvas confetti for animations
npm install canvas-confetti
npm install --save-dev @types/canvas-confetti

# Radix UI primitives (if not already installed)
npm install @radix-ui/react-dialog @radix-ui/react-tooltip
```

---

## 🎨 Step 7: Add Custom Animations (Optional)

Add these animations to your `tailwind.config.js`:

```javascript
module.exports = {
  theme: {
    extend: {
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
      }
    }
  }
}
```

---

## 🧪 Step 8: Test Your Integration

### Test Checklist:

**Unlock Animation**:
- [ ] Complete a module with ≥80% score
- [ ] Verify unlock animation displays
- [ ] Check confetti particles render
- [ ] Confirm auto-dismiss after 4 seconds
- [ ] Test click-to-dismiss

**Contextual Help**:
- [ ] Click help button on module card
- [ ] Navigate through all 4 tabs
- [ ] Submit a help request
- [ ] Verify success message
- [ ] Test close button and ESC key

**Attempt Counter**:
- [ ] Verify color coding (green/yellow/red)
- [ ] Test tooltip on hover
- [ ] Confirm pulse animation on final attempt

**Final Attempt Warning**:
- [ ] Trigger retake with 1 attempt remaining
- [ ] Verify warning dialog appears
- [ ] Test both Cancel and Proceed buttons
- [ ] Confirm course suspension explanation is clear

**Real-Time Scores**:
- [ ] Complete assessment components
- [ ] Verify score breakdown updates
- [ ] Check cumulative score calculation
- [ ] Confirm 80% threshold indicator

---

## 🐛 Troubleshooting

### Issue: Unlock Animation Doesn't Show

**Solution**: Ensure you're calling `setUnlockAnimation` after successful module completion:

```typescript
// Check if module score is >= 80%
if (result.progress.cumulative_score >= 80 && result.nextModule) {
  setUnlockAnimation({
    show: true,
    moduleName: result.nextModule.title,
    celebrationType: 'unlock'
  });
}
```

### Issue: Help Dialog Context is Null

**Solution**: Always check context before opening dialog:

```typescript
const openHelp = () => {
  setHelpDialog({
    show: true,
    context: {
      moduleId: module.id,
      moduleName: module.title,
      difficulty: module.difficulty || 'intermediate'
    },
    strugglingAreas: suspensionRisk.isAtRisk ? suspensionRisk.reasons : []
  });
};
```

### Issue: Attempt Counter Colors Not Showing

**Solution**: Verify Tailwind is processing the dynamic classes. Add them to safelist:

```javascript
// tailwind.config.js
module.exports = {
  safelist: [
    'bg-green-100',
    'bg-yellow-100',
    'bg-red-100',
    'text-green-800',
    'text-yellow-800',
    'text-red-800',
    'border-green-300',
    'border-yellow-300',
    'border-red-300'
  ]
}
```

### Issue: TypeScript Errors with Hooks

**Solution**: Ensure hooks are imported correctly and check your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

---

## 📊 Performance Optimization Tips

1. **Lazy Load Dialogs**: Only render dialogs when needed
```typescript
{helpDialog.show && <ContextualHelpDialog {...props} />}
```

2. **Memoize Expensive Calculations**:
```typescript
const attemptColor = useMemo(() => getAttemptColor(), [progress.attempts_count]);
```

3. **Debounce Real-Time Updates**:
```typescript
const debouncedScoreUpdate = useMemo(
  () => debounce(updateScore, 300),
  []
);
```

---

## 🎓 Advanced Customization

### Custom Celebration Types

Add new celebration types in `ModuleUnlockAnimation.tsx`:

```typescript
type CelebrationType = 'unlock' | 'complete' | 'achievement' | 'milestone' | 'perfect-score';

const getCelebrationConfig = (type: CelebrationType) => {
  switch (type) {
    case 'perfect-score':
      return {
        icon: Trophy,
        color: 'text-yellow-500',
        bgGradient: 'from-yellow-500 to-orange-500',
        message: 'Perfect Score! 🎯',
        confettiCount: 400,
      };
    // ... other cases
  }
};
```

### Add Custom Help Tabs

Extend `ContextualHelpDialog.tsx`:

```typescript
<TabsList className="grid w-full grid-cols-5">
  {/* Existing tabs */}
  <TabsTrigger value="mentor-connect">
    <Users className="h-4 w-4 mr-2" />
    Mentors
  </TabsTrigger>
</TabsList>

<TabsContent value="mentor-connect">
  {/* Your custom mentor connection UI */}
</TabsContent>
```

---

## ✅ Integration Checklist

- [ ] Installed all dependencies
- [ ] Imported new components and hooks
- [ ] Added state management
- [ ] Enhanced ModuleCard component
- [ ] Added unlock animation trigger
- [ ] Integrated dialog components
- [ ] Configured Tailwind safelist
- [ ] Tested all features
- [ ] Verified accessibility
- [ ] Checked dark mode
- [ ] Optimized performance
- [ ] Added error handling

---

## 📚 Next Steps

Once Phase 5 is integrated:

1. **Test with Real Data**: Use actual backend API calls
2. **Gather User Feedback**: Collect feedback on new features
3. **Monitor Performance**: Check animation frame rates
4. **Plan Phase 6**: AI Learning Companion integration

---

## 🆘 Need Help?

**Documentation**:
- Full details: `/PHASE_5_COMPLETION.md`
- Hooks guide: `/frontend/src/hooks/useProgressiveLearning.ts`
- Service layer: `/ENHANCED_FEATURES_IMPLEMENTATION_GUIDE.md`

**Example Files**:
- Enhanced page: `/frontend/src/app/student/learning/enhanced-learning-page.tsx`
- Components: `/frontend/src/components/student/`

---

*Happy coding! 🚀*
