/**
 * Shared navigation contract for the instructor grading workspace.
 *
 * Three historical screens (manual submissions, Excel AI grading and AAGE)
 * are exposed as a single top-level "Grading" navigation entry. These helpers
 * keep the sidebar active state and the in-page sub-navigation in sync without
 * coupling either to React or to the individual page implementations.
 */

export type GradingTabKey = 'submissions' | 'excel' | 'assessment';

export interface GradingTab {
  key: GradingTabKey;
  /** Full label used in the in-page tab bar and collapsed sidebar tooltip. */
  label: string;
  /** Narrow label for collapsed/narrow UI. */
  shortLabel: string;
  href: string;
  /** One-line explanation of what remains available under this tab. */
  description: string;
}

/** The one sidebar destination for all grading functionality. */
export const PRIMARY_GRADING_HREF = '/instructor/grading';

/**
 * Ordered so that the two specific prefixes are matched before the generic
 * `/instructor/grading` prefix (which also covers submission detail routes).
 */
export const GRADING_TABS: readonly GradingTab[] = [
  {
    key: 'submissions',
    label: 'Submissions',
    shortLabel: 'Submissions',
    href: '/instructor/grading',
    description: 'Course cohorts, filters, quick grade, full review and export',
  },
  {
    key: 'excel',
    label: 'AI Grading',
    shortLabel: 'AI Grading',
    href: '/instructor/ai-grading-dashboard',
    description: 'Excel AI results, rubric analysis and approval',
  },
  {
    key: 'assessment',
    label: 'Assessment Intelligence',
    shortLabel: 'AAGE',
    href: '/instructor/assessment-intelligence',
    description: 'AAGE queue, rubrics, reviews, reports and calibration',
  },
];

export const GRADING_ROUTE_PREFIXES: readonly string[] = GRADING_TABS.map((tab) => tab.href);

/** Does a pathname belong anywhere in the unified grading workspace? */
export function isGradingRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return GRADING_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/** Which in-page tab (if any) owns the supplied pathname? */
export function gradingTabForPath(pathname: string | null | undefined): GradingTabKey | null {
  if (!pathname) return null;
  const match = GRADING_TABS.find(
    (tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`)
  );
  return match?.key ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Grading list pagination
// ─────────────────────────────────────────────────────────────────────────────

/** Page size for the submissions list, which is fetched from the existing API. */
export const GRADING_PAGE_SIZE = 20;

export interface GradingPageSlice<T> {
  items: T[];
  page: number;
  totalPages: number;
  totalItems: number;
}

/**
 * Slice an already-fetched grading list for display. Pages are clamped so an
 * empty or shrunken result set can never leave the controls on a dead page.
 */
export function paginateItems<T>(
  items: readonly T[],
  page: number,
  pageSize: number = GRADING_PAGE_SIZE,
): GradingPageSlice<T> {
  const totalItems = items.length;
  const size = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : GRADING_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(totalItems / size));
  const requested = Number.isFinite(page) ? Math.floor(page) : 1;
  const current = Math.min(Math.max(requested, 1), totalPages);
  const start = (current - 1) * size;
  return {
    items: items.slice(start, start + size),
    page: current,
    totalPages,
    totalItems,
  };
}
