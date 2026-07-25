import { Course, ApplicationWindowData } from '@/types/api';

// ── Cohort-aware tier helpers ─────────────────────────────────────────────────

export type PaymentTier = 'free' | 'scholarship' | 'partial_scholarship' | 'full_tuition';

export function getCohortPaymentTier(window?: ApplicationWindowData | null, course?: Course): PaymentTier {
  // Use cohort effective values when available
  const enrollType = window?.effective_enrollment_type ?? window?.enrollment_type ?? course?.enrollment_type;
  if (enrollType === 'free') return 'free';
  if (enrollType === 'scholarship') {
    // Check if it's partial scholarship
    const scholarshipType = window?.scholarship_type;
    if (scholarshipType === 'partial') return 'partial_scholarship';
    return 'scholarship';
  }
  if (enrollType === 'paid') {
    const paymentMode = window?.payment_mode ?? course?.payment_mode;
    if (paymentMode === 'partial') return 'partial_scholarship';
    return 'full_tuition';
  }
  return 'full_tuition';
}

export function getCohortAmountDue(window?: ApplicationWindowData | null, course?: Course): number {
  const ps = window?.payment_summary;
  if (ps?.amount_due_now != null) return ps.amount_due_now;
  const cps = course?.payment_summary;
  if (cps?.amount_due_now != null) return cps.amount_due_now;
  const partialAmt = window?.partial_payment_amount ?? course?.partial_payment_amount;
  if (partialAmt != null) return partialAmt;
  const pct = window?.partial_payment_percentage ?? course?.partial_payment_percentage;
  const price = window?.effective_price ?? window?.price ?? course?.price;
  if (pct != null && price) return Math.round(price * pct / 100 * 100) / 100;
  return price ?? 0;
}

export function getCohortScholarshipCover(window?: ApplicationWindowData | null, course?: Course): number | null {
  // Use original (pre-scholarship) price so scholarship cover = originalPrice - amountDue
  const originalPrice = window?.payment_summary?.original_price ?? course?.price;
  const due = getCohortAmountDue(window, course);
  if (originalPrice && due > 0 && originalPrice > due) return Math.round((originalPrice - due) * 100) / 100;
  return null;
}

export function getCohortCurrency(window?: ApplicationWindowData | null, course?: Course): string {
  return window?.effective_currency ?? window?.currency ?? course?.currency ?? 'USD';
}

// ── Apply button label ────────────────────────────────────────────────────────

export function getApplyLabel(course: Course, win?: ApplicationWindowData | null): string {
  const tier = getCohortPaymentTier(win, course);
  const currency = getCohortCurrency(win, course);
  if (tier === 'free') return 'Enroll Free';
  if (tier === 'scholarship') return 'Apply for Scholarship';
  if (tier === 'partial_scholarship') {
    const due = getCohortAmountDue(win, course);
    return due > 0 ? `Apply & Pay ${currency} ${due.toLocaleString()}` : 'Apply & Pay';
  }
  const full = win?.payment_summary?.amount_due_now ?? win?.effective_price ?? course?.payment_summary?.amount_due_now ?? course?.price;
  return full != null && full > 0 ? `Apply & Pay ${currency} ${full.toLocaleString()}` : 'Apply Now';
}
