# Frontend Certificate Error Handling Implementation

## Components Created

### 1. CertificateErrorDisplay Component
**File:** `src/components/certificate/CertificateErrorDisplay.tsx`

Enhanced component that displays detailed certificate requirements and failure reasons.

**Features:**
- Overall score progress with visual indicators
- Module completion tracking
- Failed modules with specific score gaps
- Module-by-module status breakdown
- Actionable next steps
- Color-coded status badges

**Usage:**
```typescript
import { CertificateErrorDisplay } from '@/components/certificate/CertificateErrorDisplay';

<CertificateErrorDisplay
  requirements={checkResponse.requirements}
  failureReasons={checkResponse.failure_reasons}
  nextSteps={checkResponse.next_steps}
  errorMessage={checkResponse.message}
  summary={checkResponse.summary}
/>
```

### 2. Updated CertificateGenerationModal
**File:** `src/components/certificate/CertificateGenerationModal.tsx`

Enhanced modal that displays detailed error information when certificate requirements are not met.

**States:**
- `checking` - Verifying eligibility
- `requirements` - Display requirements and failure reasons
- `generating` - Creating certificate
- `success` - Certificate ready
- `error` - Detailed error display

**New Features:**
- Uses `CertificateErrorDisplay` for detailed error messages
- Shows module-by-module breakdown
- Provides actionable next steps
- Allows retry to refresh status

### 3. CertificateGenerationService
**File:** `src/services/certificate-generation.service.ts`

Service that handles certificate generation with detailed error parsing.

**Key Methods:**
```typescript
// Check eligibility with detailed requirements
static async checkEligibility(courseId: number): Promise<CertificateCheckResponse>

// Generate certificate with comprehensive error handling
static async generateCertificate(courseId: number): Promise<CertificateCheckResponse>
```

**Response Format:**
```typescript
interface CertificateCheckResponse {
  success: boolean;
  eligible: boolean;
  error_code?: string;
  message: string;
  summary?: string;
  requirements?: CertificateRequirementStatus;
  failure_reasons?: CertificateFailureReason;
  next_steps?: string[];
  certificate?: any;
}
```

---

## Integration Points

### 1. In Course Lesson Page
```typescript
import { CertificateGenerationModal } from '@/components/certificate/CertificateGenerationModal';

export const LessonContent = ({ courseId, courseName }) => {
  const [showCertificateModal, setShowCertificateModal] = useState(false);

  return (
    <>
      <button onClick={() => setShowCertificateModal(true)}>
        Generate Certificate
      </button>

      <CertificateGenerationModal
        courseId={courseId}
        courseName={courseName}
        isOpen={showCertificateModal}
        onClose={() => setShowCertificateModal(false)}
        onSuccess={(cert) => {
          // Handle success - redirect to certificate view
          window.location.href = `/certificates/${cert.id}`;
        }}
        onError={(error) => {
          console.error('Certificate generation failed:', error);
        }}
      />
    </>
  );
};
```

### 2. In Course Completion Screen
```typescript
import { CertificateGenerationService } from '@/services/certificate-generation.service';
import { CertificateErrorDisplay } from '@/components/certificate/CertificateErrorDisplay';

export const CourseCompletionScreen = ({ courseId }) => {
  const [checkResponse, setCheckResponse] = useState(null);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);

  useEffect(() => {
    checkEligibility();
  }, [courseId]);

  const checkEligibility = async () => {
    setIsCheckingEligibility(true);
    try {
      const response = await CertificateGenerationService.checkEligibility(courseId);
      setCheckResponse(response);
    } finally {
      setIsCheckingEligibility(false);
    }
  };

  if (isCheckingEligibility) {
    return <LoadingSpinner />;
  }

  if (checkResponse?.eligible) {
    return (
      <div>
        <h2>Congratulations! Certificate Ready</h2>
        <GenerateCertificateButton courseId={courseId} />
      </div>
    );
  }

  return (
    <div>
      <h2>Requirements to Get Certificate</h2>
      <CertificateErrorDisplay
        requirements={checkResponse?.requirements}
        failureReasons={checkResponse?.failure_reasons}
        nextSteps={checkResponse?.next_steps}
        errorMessage={checkResponse?.message}
      />
    </div>
  );
};
```

### 3. In Student Dashboard
```typescript
import { CertificateGenerationService } from '@/services/certificate-generation.service';

export const EnrolledCourseCard = ({ enrollment }) => {
  const [certificateStatus, setCertificateStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkCertificateStatus();
  }, []);

  const checkCertificateStatus = async () => {
    try {
      const response = await CertificateGenerationService.checkEligibility(
        enrollment.course_id
      );
      setCertificateStatus(response);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) return <SkeletonCard />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{enrollment.course_name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ProgressBar value={enrollment.progress * 100} max={100} />
        
        {certificateStatus?.eligible ? (
          <Button className="w-full">Generate Certificate</Button>
        ) : (
          <div className="text-sm text-gray-600">
            <p className="font-semibold">
              {certificateStatus?.summary || 'Complete requirements for certificate'}
            </p>
            <ul className="mt-2 space-y-1">
              {certificateStatus?.next_steps?.slice(0, 2).map((step, idx) => (
                <li key={idx}>• {step}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
```

---

## Error Code Handling

**Examples of error codes and how to handle them:**

```typescript
const handleCertificateResponse = (response) => {
  switch (response.error_code) {
    case 'REQUIREMENTS_NOT_MET':
      // Show detailed requirement breakdown
      showRequirementsModal(response.failure_reasons);
      break;
    
    case 'ENROLLMENT_NOT_FOUND':
      // Redirect to enroll page
      navigateTo('/enrollments');
      break;
    
    case 'CERTIFICATE_EXISTS':
      // Show existing certificate
      showCertificate(response.certificate);
      break;
    
    case 'GENERATION_ERROR':
      // Show retry option
      showRetryDialog();
      break;
    
    default:
      showGenericError(response.message);
  }
};
```

---

## Styling & Theming

All components use shadcn/ui components:
- `Dialog` - Modal container
- `Button` - Action buttons
- `Card` - Container cards
- `Badge` - Status indicators
- `Alert` - Alert boxes
- `ProgressBar` - Visual progress

**Color Scheme:**
- Green: Passing/Completed
- Blue: In Progress
- Orange: Needs Attention
- Red: Failed/Error

---

## Data Flow

```
User initiates certificate generation
         ↓
CertificateGenerationService.generateCertificate()
         ↓
API Call: /api/v1/student/certificates/generate
         ↓
Backend validates requirements
         ↓
If eligible:
  ├→ Generate certificate
  └→ Return success with certificate data
         ↓
If ineligible:
  ├→ Analyze failures
  ├→ Build detailed response with:
  │  ├─ failure_reasons (specific issues)
  │  ├─ module_details (status of each module)
  │  ├─ next_steps (actionable items)
  │  └─ summary (concise message)
  └→ Return error with all details
         ↓
Frontend renders CertificateErrorDisplay
  ├─ Shows overall score progress
  ├─ Lists incomplete modules
  ├─ Shows failing modules with gaps
  ├─ Displays module breakdown
  └─ Provides actionable next steps
```

---

## Testing Scenarios

### Test 1: Eligible for Certificate
**Setup:** All modules complete, score ≥ 80%
**Expected:** Success modal with certificate details

### Test 2: Module Not Started
**Setup:** One module not started
**Expected:** Error display shows incomplete module

### Test 3: Module Below Passing
**Setup:** One module scored 72%
**Expected:** Error shows specific module and 8% gap needed

### Test 4: Multiple Issues
**Setup:** 2 modules incomplete, 1 failing
**Expected:** All issues displayed with priorities

---

## Component Props Reference

### CertificateErrorDisplay Props
```typescript
interface CertificateErrorDisplayProps {
  requirements?: {
    passing_score: number;
    overall_score: number;
    completed_modules: number;
    total_modules: number;
    failed_modules: number;
    module_details?: ModuleStatus[];
  };
  failureReasons?: {
    incomplete_modules?: {
      remaining: number;
      message?: string;
      modules_list?: Array<{ module_name: string; status: string; score: number }>;
    };
    failed_modules?: {
      count: number;
      message?: string;
      failed_modules_list?: Array<{ name: string; score: number; gap: number }>;
    };
    insufficient_score?: {
      current_score: number;
      required_score: number;
      gap: number;
      message?: string;
    };
  };
  nextSteps?: string[];
  errorMessage?: string;
  summary?: string;
}
```

### CertificateGenerationModal Props
```typescript
interface CertificateGenerationModalProps {
  courseId: number;
  courseName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (certificate: any) => void;
  onError?: (error: string) => void;
}
```

---

## Performance Considerations

1. **Caching:** Cache eligibility checks for 5 minutes
2. **Lazy Loading:** Load modal content on demand
3. **Debouncing:** Debounce retry button (500ms)
4. **Error Handling:** Graceful degradation for API failures

---

## Accessibility

- All interactive elements have proper labels
- Color indicators supported by text/icons
- Progress bars have percentage text
- Error messages use clear language
- Keyboard navigation supported
- Screen reader friendly

---

## Future Enhancements

1. **Progress Reminders:** Email when close to requirements
2. **Study Resources:** Link to failing topics' lessons
3. **Predicted Timeline:** Estimate when eligible
4. **Peer Comparison:** Show learner's standing
5. **Offline Support:** Show cached requirements

---

## Troubleshooting

**Issue:** Modal shows blank error
**Solution:** Check `failure_reasons` structure in response

**Issue:** Score shows as 0%
**Solution:** Verify module scores are calculated in backend

**Issue:** Module list not showing
**Solution:** Ensure `module_details` array is populated

**Issue:** Next steps don't appear
**Solution:** Check `next_steps` array in response

---

## Support

For issues with frontend certificate handling:
1. Check browser console for errors
2. Verify API response structure
3. Check CertificateErrorDisplay props
4. Review error code in response
5. Check backend logs if API fails
