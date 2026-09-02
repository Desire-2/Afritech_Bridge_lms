import React from 'react';
import { CreditCard, GraduationCap } from 'lucide-react';
import { PaymentTier } from '@/types/course-tiers';

interface TierBadgeProps {
  tier: PaymentTier;
  className?: string;
  isScholarship?: boolean;
}

export const TierBadge: React.FC<TierBadgeProps> = ({ tier, className = '', isScholarship = false }) => {
  const map: Record<PaymentTier, { label: string; cls: string; icon?: React.ElementType }> = {
    free: { label: 'Free', cls: 'border-emerald-200/25 bg-emerald-950/45 text-emerald-100' },
    scholarship: { label: 'Scholarship', cls: 'border-cyan-200/25 bg-cyan-950/45 text-cyan-100', icon: GraduationCap },
    partial_scholarship: { label: isScholarship ? 'Scholarship' : 'Flexible', cls: 'border-violet-200/25 bg-violet-950/45 text-violet-100', icon: isScholarship ? GraduationCap : CreditCard },
    full_tuition: { label: 'Paid', cls: 'border-blue-200/25 bg-blue-950/45 text-blue-100', icon: CreditCard },
  };

  const { label, cls, icon: Icon } = map[tier];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold backdrop-blur-md ${cls} ${className}`}>
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      {label}
    </span>
  );
};
