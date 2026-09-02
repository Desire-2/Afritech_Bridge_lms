import React from 'react';
import { Check, CreditCard, GraduationCap } from 'lucide-react';
import { Course, ApplicationWindowData } from '@/types/api';
import {
  getCohortAmountDue,
  getCohortCurrency,
  getCohortPaymentTier,
  getCohortScholarshipCover,
} from '@/types/course-tiers';

interface PaymentInfoBlockProps {
  course: Course;
  window?: ApplicationWindowData | null;
  className?: string;
}

const formatAmount = (currency: string, amount?: number | null): string => {
  if (amount == null || amount <= 0) return 'Price on request';
  return `${currency} ${amount.toLocaleString()}`;
};

export const PaymentInfoBlock: React.FC<PaymentInfoBlockProps> = ({ course, window: win, className = '' }) => {
  const tier = getCohortPaymentTier(win, course);
  const currency = getCohortCurrency(win, course);
  const paymentSummary = win?.payment_summary ?? course.payment_summary;
  const originalPrice = paymentSummary?.original_price ?? win?.price ?? course.price;
  const enrollmentType = win?.effective_enrollment_type ?? win?.enrollment_type ?? course.enrollment_type;
  const isScholarshipBacked = enrollmentType === 'scholarship' || tier === 'scholarship';

  if (tier === 'free') {
    return (
      <div className={`rounded-xl border border-emerald-300/20 bg-emerald-300/[0.07] p-3.5 ${className}`}>
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-200">
            <Check className="h-4 w-4" aria-hidden="true" />
            Free access
          </span>
          <span className="text-sm font-semibold text-emerald-100">No payment</span>
        </div>
      </div>
    );
  }

  if (tier === 'scholarship') {
    return (
      <div className={`rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] p-3.5 ${className}`}>
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-200">
            <GraduationCap className="h-4 w-4" aria-hidden="true" />
            Scholarship supported
          </span>
          <span className="text-sm font-semibold text-white">Fully covered</span>
        </div>
        {originalPrice != null && originalPrice > 0 && (
          <p className="mt-2 text-xs text-slate-400">Course value {formatAmount(currency, originalPrice)}</p>
        )}
      </div>
    );
  }

  if (tier === 'partial_scholarship') {
    const amountDue = getCohortAmountDue(win, course);
    const scholarshipCover = isScholarshipBacked ? getCohortScholarshipCover(win, course) : null;

    return (
      <div className={`rounded-xl border border-violet-300/20 bg-violet-300/[0.07] p-3.5 ${className}`}>
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-violet-200">
            {isScholarshipBacked ? <GraduationCap className="h-4 w-4" aria-hidden="true" /> : <CreditCard className="h-4 w-4" aria-hidden="true" />}
            {isScholarshipBacked ? 'Scholarship supported' : 'Flexible payment'}
          </span>
          {scholarshipCover != null && scholarshipCover > 0 && (
            <span className="text-[11px] font-semibold text-emerald-300">Save {formatAmount(currency, scholarshipCover)}</span>
          )}
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Pay now</p>
            <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-white">{formatAmount(currency, amountDue)}</p>
          </div>
          {originalPrice != null && originalPrice > amountDue && (
            <p className="text-right text-xs text-slate-500">Original value<br /><span className="text-slate-400">{formatAmount(currency, originalPrice)}</span></p>
          )}
        </div>
      </div>
    );
  }

  const amountDue = getCohortAmountDue(win, course);
  return (
    <div className={`rounded-xl border border-blue-300/20 bg-blue-300/[0.07] p-3.5 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-blue-200">
          <CreditCard className="h-4 w-4" aria-hidden="true" />
          Tuition
        </span>
        <span className="text-[11px] text-slate-500">One-time</span>
      </div>
      <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-white">{formatAmount(currency, amountDue)}</p>
    </div>
  );
};
