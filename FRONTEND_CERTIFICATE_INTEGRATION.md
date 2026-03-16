# Frontend Certificate Generation Integration Guide

## Overview
This guide explains how to integrate the improved certificate generation components into your frontend application. The new components provide detailed error handling, module status display, and actionable next steps for students.

## New Components Created

### 1. **CertificateRequirementsDetail** (`CertificateRequirementsDetail.tsx`)
Displays detailed certificate requirements and failure reasons.

**Props:**
```typescript
{
  requirements: {
    passing_score: number;
    overall_score: number;
    completed_modules: number;
    total_modules: number;
    failed_modules: number;
    module_details: ModuleDetail[];
  };
  failureReasons: {
    incomplete_modules?: {...};
    failed_modules?: {...};
    insufficient_score?: {...};
  };
  nextSteps?: string[];
  isEligible: boolean;
  onRetry?: () => void;
  isLoading?: boolean;
}
```

**Usage:**
```typescript
import { CertificateRequirementsDetail } from '@/components/certificate/CertificateRequirementsDetail';

<CertificateRequirementsDetail
  requirements={response.requirements}
  failureReasons={response.failure_reasons}
  nextSteps={response.next_steps}
  isEligible={response.eligible}
  onRetry={checkAgain}
  isLoading={loading}
/>
```

### 2. **CertificateGenerationModal** (`CertificateGenerationModal.tsx`)
Complete modal for certificate generation with built-in state management.

**Props:**
```typescript
{
  courseId: number;
  courseName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (certificate: any) => void;
  onError?: (error: string) => void;
}
```

**Usage:**
```typescript
import { CertificateGenerationModal } from '@/components/certificate/CertificateGenerationModal';

const [showCertModal, setShowCertModal] = useState(false);

<CertificateGenerationModal
  courseId={courseId}
  courseName={courseName}
  isOpen={showCertModal}
  onClose={() => setShowCertModal(false)}
  onSuccess={(cert) => handleCertificateGenerated(cert)}
  onError={(err) => handleError(err)}
/>
```

### 3. **CertificateGenerationService** (`certificate-generation.service.ts`)
Service for handling certificate API calls with detailed error parsing.

**Key Methods:**

#### `checkEligibility(courseId)`
```typescript
const response = await CertificateGenerationService.checkEligibility(courseId);
// Returns: CertificateCheckResponse with eligible, message, requirements, failure_reasons
```

#### `generateCertificate(courseId)`
```typescript
const response = await CertificateGenerationService.generateCertificate(courseId);
// Returns: CertificateCheckResponse with certificate data or detailed errors
```

#### `getFailureMessage(failures)`
```typescript
const message = CertificateGenerationService.getFailureMessage(failures);
// Returns: Human-readable failure message
```

#### `estimateProgress(requirements)`
```typescript
const progress = CertificateGenerationService.estimateProgress(requirements);
// Returns: { percentage, status, estimatedDaysRemaining? }
```

## Integration Steps

### Step 1: Update StudentsVi Component
Add button to trigger certificate generation:

```typescript
import { CertificateGenerationModal } from '@/components/certificate/CertificateGenerationModal';

export function CourseCompletionView() {
  const [showCertModal, setShowCertModal] = useState(false);

  return (
    <>
      <Button 
        onClick={() => setShowCertModal(true)}
        className="bg-yellow-500"
      >
        🎓 Get Certificate
      </Button>

      <CertificateGenerationModal
        courseId={courseId}
        courseName={courseName}
        isOpen={showCertModal}
        onClose={() => setShowCertModal(false)}
        onSuccess={(cert) => {
          toast.success('Certificate generated!');
          // Refresh certificates list
        }}
        onError={(err) => {
          toast.error(err);
        }}
      />
    </>
  );
}
```

### Step 2: Update Course Completion Card
Enhance the lesson completion view:

```typescript
import { CertificateGenerationService } from '@/services/certificate-generation.service';

export function LessonCompletionCard() {
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    async function loadProgress() {
      const req = await CertificateGenerationService.checkEligibility(courseId);
      const prog = CertificateGenerationService.estimateProgress(req.requirements);
      setProgress(prog);
    }
    loadProgress();
  }, []);

  return (
    <Card>
      <CardContent>
        <div className="space-y-2">
          <h3>Certificate Progress</h3>
          <div className="text-xl font-bold">{progress?.percentage}%</div>
          <p className="text-sm text-gray-600">{progress?.status}</p>
          <ProgressBar value={progress?.percentage} max={100} />
        </div>
      </CardContent>
    </Card>
  );
}
```

### Step 3: Add to StudentApiService
Ensure these methods exist in StudentApiService:

```typescript
// In src/services/studentApi.ts

export class StudentApiService {
  static async checkCertificateEligibility(courseId: number) {
    return apiClient.get(`/student/certificates/eligibility/${courseId}`);
  }

  static async generateCertificate(courseId: number) {
    return apiClient.post(`/student/certificates/generate`, { course_id: courseId });
  }
}
```

## Response Handling Examples

### Example 1: Student Eligible for Certificate
```typescript
{
  success: true,
  eligible: true,
  message: "Ready to generate certificate",
  requirements: {
    overall_score: 92.5,
    completed_modules: 3,
    total_modules: 3,
    // ...
  }
}
```

### Example 2: One Module Failing
```typescript
{
  success: false,
  eligible: false,
  error_code: "REQUIREMENTS_NOT_MET",
  message: "Course completion requirements not met",
  requirements: {
    overall_score: 88.5,
    completed_modules: 2,
    total_modules: 3,
    module_details: [
      { module_name: "Python", score: 88.5, status: "completed", passing: true },
      { module_name: "Web Dev", score: 72.3, status: "failed", passing: false },
      { module_name: "Database", score: 0, status: "not_started", passing: false }
    ]
  },
  failure_reasons: {
    incomplete_modules: {
      remaining: 1,
      modules_list: [
        { module_name: "Database", status: "not_started", score: 0 }
      ]
    },
    failed_modules: {
      count: 1,
      failed_modules_list: [
        { name: "Web Dev", score: 72.3, gap: 7.7 }
      ]
    }
  },
  next_steps: [
    "Complete Database module",
    "Retake Web Dev quiz - need 7.7% more",
    "Work on improving overall score"
  ]
}
```

## Display Examples

### Simple Integration
```typescript
function CourseCard({ course }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{course.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ... course content ... */}
        
        <Button 
          onClick={() => openCertificateModal(course.id)}
          className="w-full bg-yellow-500"
        >
          🎓 Get Your Certificate
        </Button>
      </CardContent>
    </Card>
  );
}
```

### Advanced: Pre-Check Eligibility
```typescript
function CourseCard({ course }) {
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkProgress = async () => {
      setLoading(true);
      const resp = await CertificateGenerationService.checkEligibility(course.id);
      if (resp.requirements) {
        const prog = CertificateGenerationService.estimateProgress(resp.requirements);
        setProgress(prog);
      }
      setLoading(false);
    };
    checkProgress();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{course.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && <Skeleton className="h-4 w-full" />}
        
        {progress && (
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm font-medium">Certificate Progress</span>
              <span className="font-bold text-blue-600">{progress.percentage}%</span>
            </div>
            <ProgressBar value={progress.percentage} max={100} />
            <p className="text-xs text-gray-600">{progress.status}</p>
          </div>
        )}

        <Button 
          onClick={() => openCertificateModal(course.id)}
          className="w-full bg-yellow-500"
          disabled={progress?.percentage === 100}
        >
          {progress?.percentage === 100 ? '🎓 Get Certificate' : '📚 Work on Progress'}
        </Button>
      </CardContent>
    </Card>
  );
}
```

## Error Handling Best Practices

### 1. Show Specific Errors to Users
```typescript
const handleGenerationError = (response: CertificateCheckResponse) => {
  if (response.failure_reasons?.incomplete_modules) {
    showNotification({
      type: 'info',
      title: 'Modules Remaining',
      description: `Complete ${response.failure_reasons.incomplete_modules.remaining} more module(s)`
    });
  } else if (response.failure_reasons?.failed_modules) {
    showNotification({
      type: 'warning',
      title: 'Failing Modules',
      description: `Retake quizzes in ${response.failure_reasons.failed_modules.count} module(s)`
    });
  }
};
```

### 2. Retry Logic
```typescript
const handleRetry = async () => {
  const response = await CertificateGenerationService.checkEligibility(courseId);
  
  if (response.success && response.eligible) {
    toast.success('Progress updated! You\'re now eligible!');
    // Generate certificate automatically
    await generateCertificate();
  } else {
    showUpdatedRequirements(response);
  }
};
```

## Testing Scenarios

### Scenario 1: Module Not Completed
- Complete 2/3 modules
- Expected: Modal shows "1 module remaining" with specific module name
- Next Step: "Complete Web Development module"

### Scenario 2: Module Score Below 80%
- All modules completed but one has 72.3% score
- Expected: Modal shows 7.7% gap needed
- Next Step: "Retake Web Development quiz - need 7.7% more"

### Scenario 3: All Requirements Met
- All modules completed with 80%+ scores
- Expected: Modal shows checkmark and "Generate Certificate" button
- Action: Click to generate

### Scenario 4: Multiple Issues
- 2 modules incomplete, 1 module failing
- Expected: Modal shows all issues with priorities
- Next Steps: Listed in order

## Styling Notes

- Green (#10b981) for passed/eligible
- Red (#ef4444) for failed/ineligible
- Yellow (#eab308) for in-progress
- Blue (#3b82f6) for information

## Files Modified/Created

| File | Type | Purpose |
|------|------|---------|
| `CertificateRequirementsDetail.tsx` | Component | Display requirements breakdown |
| `CertificateGenerationModal.tsx` | Component | Main generation modal |
| `certificate-generation.service.ts` | Service | API handling and data parsing |
| `studentApi.ts` | Service | API endpoints (update if needed) |

## Next Steps

1. ✅ Components created
2. ⏳ Integrate into course pages
3. ⏳ Add to student dashboard
4. ⏳ Test with backend API
5. ⏳ Deploy to production

## Troubleshooting

### Modal not showing requirements
- Check that `StudentApiService.checkCertificateEligibility()` exists
- Verify API returns correct format with `requirements` field

### Scores showing as 0
- Ensure backend is calculating scores correctly
- Check `module_details` array in response

### Next steps not displaying
- Verify `next_steps` is returned from backend
- Or `autoNextSteps` generation will fill it

## Support

For questions about frontend integration:
1. Check component prop types
2. Review example usage above
3. Ensure backend returns expected response format
4. Check browser console for errors
