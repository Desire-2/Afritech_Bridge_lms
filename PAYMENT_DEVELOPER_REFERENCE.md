# Payment System - Developer Quick Reference

## Quick Integration Guide

### 1. Import the Components
```typescript
import PaymentModal from '@/components/payments/PaymentModal';
import PaymentBlockingCard from '@/components/payments/PaymentBlockingCard';
```

### 2. Set Up State
```typescript
const [paymentModalOpen, setPaymentModalOpen] = useState(false);
const [selectedCourseForPayment, setSelectedCourseForPayment] = useState<Course | null>(null);
```

### 3. Create Handler Function
```typescript
const handlePayNow = (course: Course) => {
  setSelectedCourseForPayment(course);
  setPaymentModalOpen(true);
};
```

### 4. Use in JSX
```typescript
// Show Pay Now button for unpaid courses
{course.access_allowed === false && course.payment_required && (
  <Button onClick={() => handlePayNow(course)}>
    <Zap className="w-4 h-4 mr-2" />
    Pay Now
  </Button>
)}

// Render the modal
{selectedCourseForPayment && (
  <PaymentModal
    open={paymentModalOpen}
    onOpenChange={setPaymentModalOpen}
    courseId={selectedCourseForPayment.id}
    courseName={selectedCourseForPayment.title}
    amount={selectedCourseForPayment.cohort_effective_price || 0}
    currency={selectedCourseForPayment.cohort_currency || 'USD'}
    enrollmentId={selectedCourseForPayment.enrollment_id || 0}
    isPartialScholarship={
      selectedCourseForPayment.cohort_enrollment_type === 'scholarship'
    }
    scholarshipPercentage={selectedCourseForPayment.cohort_scholarship_percentage || 0}
    paymentMethods={selectedCourseForPayment.cohort_payment_methods || []}
    onPaymentSuccess={() => {
      // Refresh data after successful payment
      refreshCourses();
    }}
  />
)}
```

---

## Component Props Reference

### PaymentModal
```typescript
interface PaymentModalProps {
  // Required
  open: boolean;                          // Modal visibility
  onOpenChange: (open: boolean) => void;  // Toggle handler
  courseId: number;                       // For tracking
  courseName: string;                     // Display name
  amount: number;                         // Student's payment amount
  currency: string;                       // e.g., "USD", "RWF"
  enrollmentId: number;                   // For API call
  
  // Optional
  cohortId?: number;                      // Cohort reference
  isPartialScholarship?: boolean;         // Scholarship type
  scholarshipPercentage?: number;         // e.g., 50 for 50%
  paymentMethods?: string[];              // Available methods
  onPaymentSuccess?: () => void;          // Success callback
}
```

### PaymentBlockingCard
```typescript
interface PaymentBlockingCardProps {
  // Required
  courseName: string;                     // Display name
  amount: number;                         // Amount due
  currency: string;                       // Currency code
  
  // Optional
  scholarshipPercentage?: number;         // Scholarship %
  isPartialScholarship?: boolean;         // Is scholarship partial
  paymentStatus?: 'pending' | 'processing' | 'verification_pending' | 'failed';
  onPayNow?: () => void;                  // Pay button handler
  onContactSupport?: () => void;          // Support button handler
  loading?: boolean;                      // Loading state
}
```

---

## Available Payment Methods

```typescript
// String identifiers for paymentMethods array
'kpay'              // K-Pay (Violet) - MTN, Airtel, Card, SPENN
'stripe'            // Stripe (Indigo) - Visa, MC, Amex
'paypal'            // PayPal (Blue)
'flutterwave'       // Flutterwave (Orange) - Card, Mobile Money, Bank, USSD
'mobile_money'      // Mobile Money (Yellow) - MTN, Airtel MoMo
'bank_transfer'     // Bank Transfer (Emerald)
'momo_pay_code'     // MoMo Pay Code (Yellow) - USSD

// Example:
paymentMethods={['kpay', 'stripe', 'paypal', 'flutterwave']}
```

---

## Common Implementation Patterns

### Pattern 1: Basic Payment Flow
```typescript
// Simple course card with payment
function CourseCard({ course }) {
  const [paymentOpen, setPaymentOpen] = useState(false);
  
  if (course.access_allowed === false && course.payment_required) {
    return (
      <>
        <Button onClick={() => setPaymentOpen(true)}>
          Pay Now
        </Button>
        <PaymentModal
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          courseId={course.id}
          courseName={course.title}
          amount={course.amount}
          currency="USD"
          enrollmentId={course.enrollment_id}
          paymentMethods={['kpay', 'stripe']}
        />
      </>
    );
  }
  
  return <div>Course content</div>;
}
```

### Pattern 2: Payment with Scholarship
```typescript
// Course with partial scholarship
const isPartial = course.cohort_enrollment_type === 'scholarship' 
  && course.cohort_scholarship_type === 'partial';

<PaymentModal
  {...props}
  isPartialScholarship={isPartial}
  scholarshipPercentage={course.cohort_scholarship_percentage}
  amount={course.cohort_effective_price}  // Student's share
/>
```

### Pattern 3: Blocking Card Display
```typescript
// Show payment status card in dashboard
{course.payment_required && !course.payment_verified && (
  <PaymentBlockingCard
    courseName={course.title}
    amount={course.cohort_effective_price}
    currency={course.cohort_currency}
    paymentStatus="pending"
    onPayNow={() => handlePayNow(course)}
    isPartialScholarship={course.cohort_enrollment_type === 'scholarship'}
    scholarshipPercentage={course.cohort_scholarship_percentage}
  />
)}
```

---

## Data Requirements from Backend

The following fields are needed from course/enrollment data:

```typescript
course: {
  id: number;
  title: string;
  enrollment_id: number;
  cohort_id?: number;
  access_allowed: boolean;
  payment_required: boolean;
  payment_verified: boolean;
  payment_status: 'pending' | 'completed' | 'failed';
  cohort_currency: string;              // e.g., "USD", "RWF"
  cohort_effective_price: number;       // Student's payment amount
  cohort_enrollment_type: string;       // 'free', 'paid', 'scholarship'
  cohort_scholarship_type?: string;     // 'full', 'partial'
  cohort_scholarship_percentage?: number;
  cohort_payment_methods?: string[];    // Available payment methods
  cohort_installment_enabled?: boolean;
  cohort_installment_count?: number;
  cohort_amount_due?: number;
}
```

---

## API Integration

### Initiate Payment Endpoint
```typescript
// POST /enrollments/{enrollmentId}/initiate-payment
{
  payment_method: 'kpay' | 'stripe' | 'paypal' | etc,
  amount: number,
  currency: string,
  payer_name?: string,
  phone_number?: string,
  email: string,
}

// Response (redirect for most methods):
{
  reference: string,
  checkout_url?: string,
  approval_url?: string,
}
```

### Verify Payment Endpoint
```typescript
// POST /enrollments/{enrollmentId}/verify-payment
{
  reference: string,
  payment_method: string,
}

// Response:
{
  verified: boolean,
  status: 'approved' | 'failed' | 'pending_verification',
}
```

---

## Error Handling

### Common Errors
```typescript
// API error handling in PaymentModal
try {
  const response = await fetch(url, options);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Payment failed');
  }
} catch (err) {
  setPaymentStatus('failed');
  setError(err.message);
}
```

### User-Facing Messages
```typescript
// Payment method validation
if (!selectedMethod) {
  setError('Please select a payment method');
  return;
}

// Phone number validation
if (selectedMethod === 'mobile_money' && !formData.phone_number) {
  setError('Phone number required for mobile money');
  return;
}
```

---

## Styling & Customization

### Color Scheme
```css
/* Payment methods colors */
kpay: violet-600
stripe: indigo-600
paypal: blue-600
flutterwave: orange-600
mobile_money: yellow-600
bank_transfer: emerald-600
momo_pay_code: yellow-600
```

### Tailwind Classes
- Base: `rounded-lg border border-gray-200 p-4`
- Button: `py-2.5 px-4 rounded-lg font-medium`
- Badge: `inline-flex items-center px-2 py-0.5 rounded-full text-xs`

---

## Testing Checklist

- [ ] Modal opens on button click
- [ ] All payment methods display
- [ ] Amount calculation correct
- [ ] Phone validation works
- [ ] API calls send correct data
- [ ] Loading states display
- [ ] Error messages appear
- [ ] Success state shows
- [ ] Modal closes properly
- [ ] Mobile responsive
- [ ] Keyboard accessible
- [ ] Screen reader friendly

---

## Useful Utilities

```typescript
// Format currency
const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

// Calculate scholarship breakdown
const calculateScholarship = (
  studentPays: number,
  scholarshipPct: number
) => {
  const total = studentPays / (1 - scholarshipPct / 100);
  const scholarship = total - studentPays;
  return { total, scholarship };
};

// Validate phone number
const isValidPhoneNumber = (phone: string): boolean => {
  return /^\+?[1-9]\d{1,14}$/.test(phone);
};
```

---

## Documentation Links

- **Full Implementation Guide**: `PAYMENT_UI_IMPROVEMENTS.md`
- **Summary & Before/After**: `PAYMENT_IMPROVEMENTS_SUMMARY.md`
- **Component Files**: `/frontend/src/components/payments/`

---

**Last Updated**: May 31, 2026
**Version**: 1.0
