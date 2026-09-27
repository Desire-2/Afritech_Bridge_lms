/**
 * Shared shapes for the inactivity / warning-email feature.
 *
 * When a warning batch or the at-risk preview finds nobody, the backend
 * returns a `diagnosis` explaining what it saw in scope so the UI can answer
 * "why 0 emails?" instead of showing an unexplained zero.
 */

export interface InactivityDiagnosis {
  /** Days without study activity that counts as inactive. */
  threshold_days?: number;
  /** Enrolment counts keyed by status, e.g. `{ active: 3, completed: 2 }`. */
  enrollments_by_status?: Record<string, number>;
  /** Enrolments whose status is `active`. */
  active_enrollments?: number;
  /** Distinct students behind the active enrolments. */
  unique_students?: number;
  /** Of those, how many still have a live (non-deactivated) account. */
  active_users?: number;
  /** Excluded because they studied within `threshold_days`. */
  excluded_recent_activity?: number;
  /** No timestamp at all to judge from. */
  no_activity_timestamp?: number;
  /** What the query would have flagged. */
  would_be_flagged?: number;
  /** Most recent activity seen in scope (ISO). */
  most_recent_reference?: string | null;
  /** Activity older than this counts as inactive (ISO). */
  cutoff?: string;
}

export type MaybeDiagnosis = InactivityDiagnosis | null | undefined;

/**
 * Human-readable one-liner for a diagnosis, or `undefined` when there is none.
 */
export function formatInactivityDiagnosis(diagnosis: MaybeDiagnosis): string | undefined {
  if (!diagnosis) return undefined;

  const bits: string[] = [];
  const statuses = Object.entries(diagnosis.enrollments_by_status ?? {});
  const totalEnrolments = statuses.reduce((sum, [, count]) => sum + count, 0);

  if (totalEnrolments === 0) {
    bits.push('no enrolments in this scope');
  } else {
    const breakdown = statuses.map(([status, count]) => `${count} ${status}`).join(', ');
    bits.push(
      `${diagnosis.active_enrollments ?? 0} active of ${totalEnrolments} enrolment(s) (${breakdown})`
    );
  }

  const deactivated = (diagnosis.unique_students ?? 0) - (diagnosis.active_users ?? 0);
  if (deactivated > 0) {
    bits.push(`${deactivated} deactivated account(s)`);
  }
  if (diagnosis.excluded_recent_activity) {
    bits.push(`${diagnosis.excluded_recent_activity} studied within ${diagnosis.threshold_days} day(s)`);
  }
  if (diagnosis.no_activity_timestamp) {
    bits.push(`${diagnosis.no_activity_timestamp} with no activity record`);
  }
  if (diagnosis.would_be_flagged) {
    bits.push(`${diagnosis.would_be_flagged} would qualify`);
  }

  return bits.join(' · ');
}
