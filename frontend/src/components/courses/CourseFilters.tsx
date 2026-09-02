'use client';

import React from 'react';
import {
  BookOpen,
  CreditCard,
  GraduationCap,
  Search,
  X,
} from 'lucide-react';
import { PaymentTier } from '@/types/course-tiers';

type TierFilter = 'all' | PaymentTier;
type StatusFilter = 'all' | 'open' | 'upcoming' | 'closed';

interface CourseFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  tierFilter: TierFilter;
  onTierFilterChange: (tier: TierFilter) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (status: StatusFilter) => void;
  stats: {
    total?: number;
    open: number;
    upcoming: number;
    closed?: number;
    scholarship: number;
  };
}

const STATUS_OPTIONS: { value: StatusFilter; label: string; count: number; dot?: string }[] = [
  { value: 'all', label: 'All courses', count: 0 },
  { value: 'open', label: 'Open', count: 0, dot: 'bg-emerald-300' },
  { value: 'upcoming', label: 'Upcoming', count: 0, dot: 'bg-blue-300' },
];

const TIER_OPTIONS: { value: TierFilter; label: string; icon: React.ElementType; count?: number }[] = [
  { value: 'free', label: 'Free', icon: BookOpen },
  { value: 'scholarship', label: 'Scholarship', icon: GraduationCap, count: 0 },
  { value: 'full_tuition', label: 'Paid', icon: CreditCard },
];

export const CourseFilters: React.FC<CourseFiltersProps> = ({
  searchQuery,
  onSearchChange,
  tierFilter,
  onTierFilterChange,
  statusFilter,
  onStatusFilterChange,
  stats,
}) => {
  const hasActiveFilters = statusFilter !== 'all' || tierFilter !== 'all';
  const hasAnyFilter = hasActiveFilters || searchQuery.trim() !== '';

  const clearAllFilters = () => {
    onStatusFilterChange('all');
    onTierFilterChange('all');
    onSearchChange('');
  };

  const statusOptions = STATUS_OPTIONS.map((option) => ({
    ...option,
    count:
      option.value === 'all'
        ? stats.total ?? stats.open + stats.upcoming
        : option.value === 'open'
          ? stats.open
          : stats.upcoming,
  }));

  const tierOptions = TIER_OPTIONS.map((option) => ({
    ...option,
    count: option.value === 'scholarship' ? stats.scholarship : option.count,
  }));

  return (
    <div className="sticky top-[72px] z-30 rounded-2xl border border-white/[0.09] bg-[#0d131e]/95 p-3 shadow-2xl shadow-black/10 backdrop-blur-xl sm:p-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <label htmlFor="course-search" className="sr-only">Search courses, skills or topics</label>
          <div className="group relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-cyan-300" aria-hidden="true" />
            <input
              id="course-search"
              type="search"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search courses, skills or topics..."
              className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.045] pl-10 pr-10 text-sm text-white outline-none transition-all placeholder:text-slate-500 focus:border-cyan-300/50 focus:bg-white/[0.07] focus:ring-4 focus:ring-cyan-300/10"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-300/60"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
          <span className="hidden shrink-0 items-center gap-1.5 text-xs text-slate-500 sm:inline-flex">
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
            Browse by goal
          </span>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/[0.07] pt-4 md:flex-row md:items-center md:gap-6">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto scrollbar-hide">
            <span className="mr-1 shrink-0 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Availability</span>
            {statusOptions.map(({ value, label, count, dot }) => {
              const isActive = statusFilter === value;
              return (
                <button
                  type="button"
                  key={value}
                  onClick={() => onStatusFilterChange(value)}
                  aria-pressed={isActive}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-cyan-300/60 ${
                    isActive
                      ? 'border-cyan-300/35 bg-cyan-300/10 text-cyan-100 shadow-[0_0_18px_rgba(103,232,249,0.08)]'
                      : 'border-transparent text-slate-400 hover:border-white/10 hover:bg-white/[0.05] hover:text-white'
                  }`}
                >
                  {dot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
                  {label}
                  <span className={isActive ? 'text-cyan-300/80' : 'text-slate-600'}>{count}</span>
                </button>
              );
            })}
          </div>

          <div className="hidden h-6 w-px bg-white/[0.08] md:block" />

          <div className="flex min-w-0 items-center gap-2 overflow-x-auto scrollbar-hide">
            <span className="mr-1 shrink-0 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Pricing</span>
            {tierOptions.map(({ value, label, icon: Icon, count }) => {
              const isActive = tierFilter === value;
              return (
                <button
                  type="button"
                  key={value}
                  onClick={() => onTierFilterChange(value)}
                  aria-pressed={isActive}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-cyan-300/60 ${
                    isActive
                      ? 'border-cyan-300/35 bg-cyan-300/10 text-cyan-100 shadow-[0_0_18px_rgba(103,232,249,0.08)]'
                      : 'border-transparent text-slate-400 hover:border-white/10 hover:bg-white/[0.05] hover:text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {label}
                  {count != null && <span className={isActive ? 'text-cyan-300/80' : 'text-slate-600'}>{count}</span>}
                </button>
              );
            })}
          </div>

          {hasAnyFilter && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg px-2.5 py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-white/[0.05] hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-300/60 md:self-auto"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
