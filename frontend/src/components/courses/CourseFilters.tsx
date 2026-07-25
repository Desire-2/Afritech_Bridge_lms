'use client';
import React, { useState, useRef, useEffect } from 'react';
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
    open: number;
    upcoming: number;
    scholarship: number;
  };
}

// ── Filter config ─────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: StatusFilter; label: string; icon: string }[] = [
  { value: 'all', label: 'All', icon: '' },
  { value: 'open', label: 'Open', icon: '🟢' },
  { value: 'upcoming', label: 'Upcoming', icon: '🔵' },
];

const TIER_OPTIONS: { value: TierFilter; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'free', label: '✨ Free' },
  { value: 'scholarship', label: '🎓 Scholarship' },
  { value: 'full_tuition', label: '💳 Paid' },
];

// ── Component ────────────────────────────────────────────────────────────────

export const CourseFilters: React.FC<CourseFiltersProps> = ({
  searchQuery,
  onSearchChange,
  tierFilter,
  onTierFilterChange,
  statusFilter,
  onStatusFilterChange,
  stats,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  const hasActiveFilters = statusFilter !== 'all' || tierFilter !== 'all';
  const hasAnyFilter = hasActiveFilters || searchQuery.trim() !== '';

  const activeCount =
    (statusFilter !== 'all' ? 1 : 0) + (tierFilter !== 'all' ? 1 : 0);

  const clearAllFilters = () => {
    onStatusFilterChange('all');
    onTierFilterChange('all');
    onSearchChange('');
  };

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  // ── Filter chips (shared between inline and drawer) ──────────

  const StatusChips = () => (
    <>
      {STATUS_OPTIONS.map(({ value, label, icon }) => {
        const count = value === 'open' ? stats.open : value === 'upcoming' ? stats.upcoming : stats.open + stats.upcoming;
        const isActive = statusFilter === value;
        return (
          <button
            key={value}
            onClick={() => onStatusFilterChange(value)}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition-all whitespace-nowrap ${
              isActive
                ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 ring-1 ring-sky-300 dark:ring-sky-700 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800'
            }`}
          >
            {icon && <span className="text-xs">{icon}</span>}
            {label}
            {value !== 'all' && (
              <span className={`ml-0.5 text-[10px] ${isActive ? 'text-sky-500 dark:text-sky-400' : 'text-zinc-400 dark:text-zinc-500'}`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </>
  );

  const TierChips = () => (
    <>
      {TIER_OPTIONS.map(({ value, label }) => {
        const isActive = tierFilter === value;
        return (
          <button
            key={value}
            onClick={() => onTierFilterChange(value)}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition-all whitespace-nowrap ${
              isActive
                ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 ring-1 ring-sky-300 dark:ring-sky-700 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800'
            }`}
          >
            {label}
          </button>
        );
      })}
    </>
  );

  return (
    <>
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3">
          {/* ── Search + mobile filter toggle row ────────────── */}
          <div className="flex items-center gap-2">
            {/* Search input */}
            <div className="relative flex-1 min-w-0">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-400 pointer-events-none"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search courses..."
                className="w-full pl-8 sm:pl-9 pr-7 py-1.5 sm:py-2 bg-zinc-100 dark:bg-zinc-800 border-0 rounded-lg text-xs sm:text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-sky-500/60 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 p-0.5 rounded transition-colors"
                  aria-label="Clear search"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Mobile filter drawer trigger */}
            <button
              onClick={() => setDrawerOpen(true)}
              className={`sm:hidden relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 ${
                hasActiveFilters
                  ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 ring-1 ring-sky-200 dark:ring-sky-800'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
              }`}
              aria-label="Open filters"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters
              {activeCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-bold rounded-full bg-sky-500 text-white px-1">
                  {activeCount}
                </span>
              )}
            </button>

            {/* Desktop clear button inline */}
            {hasAnyFilter && (
              <button
                onClick={clearAllFilters}
                className="hidden sm:inline-flex shrink-0 items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear
              </button>
            )}
          </div>

          {/* ── Desktop inline filter groups ──────────────────── */}
          <div className="hidden sm:flex flex-wrap items-start gap-x-8 gap-y-3 mt-3">
            {/* Group: Status */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                Status
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <StatusChips />
              </div>
            </div>

            {/* Group: Pricing */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                Pricing
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <TierChips />
              </div>
            </div>
          </div>

          {/* ── Mobile active filter chips (compact) ──────────── */}
          {hasActiveFilters && (
            <div className="sm:hidden mt-2 flex flex-wrap items-center gap-1.5">
              {statusFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                  {STATUS_OPTIONS.find(o => o.value === statusFilter)?.label || statusFilter}
                  <button onClick={() => onStatusFilterChange('all')} className="hover:text-sky-900 dark:hover:text-sky-100 ml-0.5 leading-none" aria-label="Remove status filter">
                    ×
                  </button>
                </span>
              )}
              {tierFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                  {TIER_OPTIONS.find(o => o.value === tierFilter)?.label.replace(/^[^\s]+\s/, '') || tierFilter}
                  <button onClick={() => onTierFilterChange('all')} className="hover:text-sky-900 dark:hover:text-sky-100 ml-0.5 leading-none" aria-label="Remove pricing filter">
                    ×
                  </button>
                </span>
              )}
              {searchQuery.trim() && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  "{searchQuery}"
                  <button onClick={() => onSearchChange('')} className="hover:text-zinc-900 dark:hover:text-zinc-200 ml-0.5 leading-none" aria-label="Clear search">
                    ×
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile filter bottom sheet ──────────────────────────── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />

          {/* Drawer */}
          <div
            ref={drawerRef}
            className="absolute bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 rounded-t-2xl shadow-2xl animate-slide-up max-h-[80vh] flex flex-col"
          >
            {/* Handle bar */}
            <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600 mx-auto" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Filters</h3>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:text-zinc-300 dark:hover:bg-zinc-800 transition-all"
                aria-label="Close filters"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto p-4 space-y-5 flex-1">
              {/* Status section */}
              <div>
                <span className="block text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2.5">
                  Status
                </span>
                <div className="flex flex-wrap gap-2">
                  <StatusChips />
                </div>
              </div>

              {/* Pricing section */}
              <div>
                <span className="block text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2.5">
                  Pricing
                </span>
                <div className="flex flex-wrap gap-2">
                  <TierChips />
                </div>
              </div>

              {/* Active filters summary */}
              {hasActiveFilters && (
                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      Active filters
                    </span>
                    <button
                      onClick={() => {
                        onStatusFilterChange('all');
                        onTierFilterChange('all');
                      }}
                      className="text-xs text-sky-600 dark:text-sky-400 font-medium hover:underline"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {statusFilter !== 'all' && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                        Status: {STATUS_OPTIONS.find(o => o.value === statusFilter)?.label || statusFilter}
                        <button onClick={() => onStatusFilterChange('all')} className="hover:text-sky-900 dark:hover:text-sky-100 ml-0.5">×</button>
                      </span>
                    )}
                    {tierFilter !== 'all' && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                        Price: {TIER_OPTIONS.find(o => o.value === tierFilter)?.label.replace(/^[^\s]+\s/, '') || tierFilter}
                        <button onClick={() => onTierFilterChange('all')} className="hover:text-sky-900 dark:hover:text-sky-100 ml-0.5">×</button>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom action bar */}
            <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-b-2xl">
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-lg transition-colors active:scale-[0.98]"
              >
                Show results
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-up animation keyframes */}
      <style jsx>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s cubic-bezier(0.32, 0.72, 0, 1);
        }
      `}</style>
    </>
  );
};
