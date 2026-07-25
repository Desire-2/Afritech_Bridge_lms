import React from 'react';
import { PaymentTier } from '@/types/course-tiers';

export const TierBadge: React.FC<{ tier: PaymentTier; className?: string }> = ({ tier, className = '' }) => {
  const map: Record<PaymentTier, { label: string; cls: string }> = {
    free:                { label: '✨ Free',               cls: 'bg-emerald-50/90 text-emerald-700 border-emerald-200/80 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700/60' },
    scholarship:         { label: '🎓 Scholarship',        cls: 'bg-amber-50/90 text-amber-700 border-amber-200/80 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700/60' },
    partial_scholarship: { label: '🎓 Partial',            cls: 'bg-violet-50/90 text-violet-700 border-violet-200/80 dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-700/60' },
    full_tuition:        { label: '💳 Paid',               cls: 'bg-sky-50/90 text-sky-700 border-sky-200/80 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-700/60' },
  };
  const { label, cls } = map[tier];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border backdrop-blur-sm shadow-sm ${cls} ${className}`}>
      {label}
    </span>
  );
};
