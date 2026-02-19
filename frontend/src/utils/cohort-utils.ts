/**
 * Shared cohort/application-window utilities.
 * Used across course detail, apply page, instructor & admin managers.
 */

import type { ApplicationWindowData, CohortStatus, CohortOption } from '@/types/api';

// ---------------------------------------------------------------------------
// Status computation
// ---------------------------------------------------------------------------

/**
 * Compute the live status of an application window based on current time.
 * Mirrors the backend `ApplicationWindow.compute_status()`.
 */
export function computeWindowStatus(window?: ApplicationWindowData | null): CohortStatus {
  if (!window) return 'closed';
  if (window.status_override) return window.status_override as CohortStatus;

  const now = new Date();

  const opens = window.opens_at ? new Date(window.opens_at) : null;
  const closes = window.closes_at ? new Date(window.closes_at) : null;
  const cohortEnd = window.cohort_end ? new Date(window.cohort_end) : null;

  if (opens && !Number.isNaN(opens.getTime()) && now < opens) return 'upcoming';
  if (closes && !Number.isNaN(closes.getTime()) && now > closes) return 'closed';
  if (cohortEnd && !Number.isNaN(cohortEnd.getTime()) && now > cohortEnd) return 'closed';
  return 'open';
}

// ---------------------------------------------------------------------------
// Normalisation - turn potentially missing data into a clean array
// ---------------------------------------------------------------------------

interface CourseWithWindows {
  application_windows?: ApplicationWindowData[];
  application_window?: ApplicationWindowData;
  application_start_date?: string | null;
  application_end_date?: string | null;
  cohort_start_date?: string | null;
  cohort_end_date?: string | null;
  cohort_label?: string | null;
}

/**
 * Build a normalised, sorted array of ApplicationWindowData from a course object.
 * Handles:
 *   1. Backend `application_windows[]` array (preferred)
 *   2. Legacy single `application_window` object
 *   3. Flat date columns on the course itself
 */
export function normalizeApplicationWindows(course: CourseWithWindows): ApplicationWindowData[] {
  const raw = Array.isArray(course.application_windows) ? course.application_windows : [];

  let source: ApplicationWindowData[];

  if (raw.length > 0) {
    source = raw;
  } else if (course.application_window) {
    source = [course.application_window];
  } else if (
    course.application_start_date ||
    course.application_end_date ||
    course.cohort_start_date ||
    course.cohort_end_date ||
    course.cohort_label
  ) {
    source = [
      {
        status: 'open',
        opens_at: course.application_start_date ?? null,
        closes_at: course.application_end_date ?? null,
        cohort_start: course.cohort_start_date ?? null,
        cohort_end: course.cohort_end_date ?? null,
        cohort_label: course.cohort_label ?? null,
      },
    ];
  } else {
    return [];
  }

  // Normalize, ensure status re-computed client-side
  const normalized: ApplicationWindowData[] = source.map((win, idx) => ({
    ...win,
    id: win.id ?? idx,
    status: computeWindowStatus(win),
    cohort_label: win.cohort_label ?? course.cohort_label ?? `Cohort ${idx + 1}`,
    opens_at: win.opens_at ?? course.application_start_date ?? null,
    closes_at: win.closes_at ?? course.application_end_date ?? null,
    cohort_start: win.cohort_start ?? course.cohort_start_date ?? null,
    cohort_end: win.cohort_end ?? course.cohort_end_date ?? null,
  }));

  // Sort by opens_at ascending
  normalized.sort((a, b) => {
    const ta = a.opens_at ? new Date(a.opens_at).getTime() : Infinity;
    const tb = b.opens_at ? new Date(b.opens_at).getTime() : Infinity;
    return ta - tb;
  });

  return normalized;
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/** Return the primary window: first open, then first upcoming, then first. */
export function getPrimaryWindow(windows: ApplicationWindowData[]): ApplicationWindowData | undefined {
  if (!windows.length) return undefined;
  return (
    windows.find((w) => w.status === 'open') ||
    windows.find((w) => w.status === 'upcoming') ||
    windows[0]
  );
}

/** Return the current cohort (actively open or in session). */
export function getCurrentCohort(windows: ApplicationWindowData[]): ApplicationWindowData | undefined {
  const now = new Date();

  const isBetween = (start?: string | null, end?: string | null) => {
    if (!start) return false;
    const s = new Date(start);
    if (Number.isNaN(s.getTime())) return false;
    const e = end ? new Date(end) : null;
    return s <= now && (!e || Number.isNaN(e.getTime()) || now <= e);
  };

  return windows.find(
    (w) =>
      w.status === 'open' ||
      isBetween(w.opens_at, w.closes_at) ||
      isBetween(w.cohort_start, w.cohort_end)
  );
}

/** Return the next upcoming cohort. */
export function getNextCohort(
  windows: ApplicationWindowData[],
  currentCohort?: ApplicationWindowData
): ApplicationWindowData | undefined {
  const now = new Date();

  const getEarliestDate = (w: ApplicationWindowData) => {
    const dates = [w.opens_at, w.cohort_start]
      .filter(Boolean)
      .map((d) => new Date(d!))
      .filter((d) => !Number.isNaN(d.getTime()));
    return dates.length ? Math.min(...dates.map((d) => d.getTime())) : Infinity;
  };

  const upcoming = windows
    .filter((w) => w !== currentCohort)
    .filter((w) => {
      const opens = w.opens_at ? new Date(w.opens_at) : null;
      const start = w.cohort_start ? new Date(w.cohort_start) : null;
      return (
        w.status === 'upcoming' ||
        (opens && !Number.isNaN(opens.getTime()) && opens > now) ||
        (start && !Number.isNaN(start.getTime()) && start > now)
      );
    })
    .sort((a, b) => getEarliestDate(a) - getEarliestDate(b));

  return upcoming[0];
}

// ---------------------------------------------------------------------------
// Build CohortOption[] from course detail — used by instructor & admin managers
// ---------------------------------------------------------------------------

export function buildCohortOptionsFromCourse(
  courseId: number,
  courseTitle: string,
  course: CourseWithWindows & { application_window?: ApplicationWindowData }
): CohortOption[] {
  const windows = normalizeApplicationWindows(course);

  if (windows.length === 0) {
    return [
      {
        id: `${courseId}-cohort`,
        label: course.cohort_label || `${courseTitle} cohort`,
        courseId,
        status: (course.application_window?.status || 'open') as CohortStatus,
        opensAt: course.application_window?.opens_at || course.application_start_date || null,
        closesAt: course.application_window?.closes_at || course.application_end_date || null,
        cohortStart: course.cohort_start_date || null,
        cohortEnd: course.cohort_end_date || null,
      },
    ];
  }

  return windows.map((w, idx) => ({
    id: (w.id ?? `${courseId}-window-${idx}`).toString(),
    label: w.cohort_label || `${courseTitle} cohort ${idx + 1}`,
    courseId,
    status: w.status,
    opensAt: w.opens_at || null,
    closesAt: w.closes_at || null,
    cohortStart: w.cohort_start || null,
    cohortEnd: w.cohort_end || null,
  }));
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString();
}

export function formatDateTime(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
}

export function getStatusBadgeStyles(status?: string): string {
  switch (status) {
    case 'open':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'upcoming':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'closed':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}
