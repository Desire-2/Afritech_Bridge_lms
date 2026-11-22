"use client";

/**
 * GradingSubNavigation
 *
 * The in-page counterpart of the single "Grading" sidebar entry. All three
 * screens keep their existing routes and behaviour; this tab bar simply makes
 * them reachable from one place without adding three top-level nav items.
 */

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  GRADING_TABS,
  gradingTabForPath,
  type GradingTabKey,
} from '@/lib/grading-navigation';
import { cn } from '@/lib/utils';

interface Props {
  /** Override the derived active tab (useful on nested routes). */
  activeTab?: GradingTabKey | null;
  /** Hide the descriptive subtitle on dense pages. */
  compact?: boolean;
  className?: string;
}

export default function GradingSubNavigation({ activeTab, compact = false, className }: Props) {
  const pathname = usePathname();
  const current = activeTab === undefined ? gradingTabForPath(pathname) : activeTab;

  return (
    <nav
      aria-label="Grading workspace sections"
      className={cn(
        'flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-800',
        className
      )}
    >
      {GRADING_TABS.map((tab) => {
        const active = current === tab.key;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            title={tab.description}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white'
            )}
          >
            <span>{tab.label}</span>
            {!compact && (
              <span
                className={cn(
                  'hidden text-xs font-normal lg:inline',
                  active
                    ? 'text-sky-500 dark:text-sky-400'
                    : 'text-slate-400 dark:text-slate-500'
                )}
              >
                {tab.description}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
