import React from 'react';
import { Course, ApplicationWindowData } from '@/types/api';
import { 
  getCohortPaymentTier, 
  getCohortAmountDue, 
  getCohortScholarshipCover, 
  getCohortCurrency 
} from '@/types/course-tiers';

interface PaymentInfoBlockProps {
  course: Course;
  window?: ApplicationWindowData | null;
  className?: string;
}

export const PaymentInfoBlock: React.FC<PaymentInfoBlockProps> = ({ course, window: win, className = '' }) => {
  const tier = getCohortPaymentTier(win, course);
  const currency = getCohortCurrency(win, course);

  if (tier === 'free') {
    return (
      <div className={`flex items-center gap-2 px-2.5 py-1.5 bg-emerald-50/80 border border-emerald-200/60 rounded-lg text-xs dark:bg-emerald-900/15 dark:border-emerald-800/40 ${className}`}>
        <span className="text-emerald-700 dark:text-emerald-300 font-semibold">Free</span>
        <span className="text-emerald-600/70 dark:text-emerald-400/70">· No payment</span>
      </div>
    );
  }

  if (tier === 'scholarship') {
    return (
      <div className={`px-2.5 py-1.5 bg-amber-50/80 border border-amber-200/60 rounded-lg dark:bg-amber-900/15 dark:border-amber-800/40 ${className}`}>
        <div className="flex items-center gap-1.5">
          <span className="text-amber-700 dark:text-amber-300 font-semibold text-xs">Fully Covered</span>
          <span className="text-amber-600/70 dark:text-amber-400/70 text-[10px]">· Competitive</span>
        </div>
      </div>
    );
  }

  if (tier === 'partial_scholarship') {
    const amountDue = getCohortAmountDue(win, course);
    const scholarshipCover = getCohortScholarshipCover(win, course);
    return (
      <div className={`px-2.5 py-1.5 bg-violet-50/80 border border-violet-200/60 rounded-lg dark:bg-violet-900/15 dark:border-violet-800/40 ${className}`}>
        <div className="flex items-center justify-between text-xs">
          <div>
            <span className="text-violet-600 dark:text-violet-400 font-semibold">You pay </span>
            <span className="text-violet-700 dark:text-violet-300 font-bold">
              {amountDue > 0 ? `${currency} ${amountDue.toLocaleString()}` : 'TBD'}
            </span>
          </div>
          {scholarshipCover != null && scholarshipCover > 0 && (
            <div>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Covers </span>
              <span className="text-emerald-700 dark:text-emerald-300 font-bold">
                {currency} {scholarshipCover.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // full_tuition
  const fullPrice = win?.payment_summary?.amount_due_now ?? win?.effective_price ?? course?.payment_summary?.amount_due_now ?? course?.price;
  return (
    <div className={`flex items-center justify-between px-2.5 py-1.5 bg-sky-50/80 border border-sky-200/60 rounded-lg dark:bg-sky-900/15 dark:border-sky-800/40 ${className}`}>
      <div className="flex items-center gap-1.5 text-xs">
        <span className="text-sky-600 dark:text-sky-400 font-semibold">Tuition</span>
        <span className="text-sky-700 dark:text-sky-300 font-bold">
          {fullPrice != null && fullPrice > 0
            ? `${currency} ${fullPrice.toLocaleString()}`
            : 'Price on request'}
        </span>
      </div>
      <span className="text-[10px] text-zinc-500 dark:text-zinc-400">One-time</span>
    </div>
  );
};
