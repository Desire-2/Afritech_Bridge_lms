/**
 * Pure AAGE display adapters. Kept separate from React components so the unit
 * scale rules can be tested with node:test without pulling in JSX or UI libs.
 *
 * The AAGE backend uses two different percentage conventions:
 *  - scores, confidence and policy thresholds are already 0-100;
 *  - a few aggregate ratios (correction/override/agreement) arrive as 0-1 and
 *    are converted to 0-100 in `aage.service.ts` before reaching these helpers.
 */

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  return `${Number(value).toFixed(digits)}%`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat('en-US').format(Number(value));
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(Number(ms))) return '—';
  const seconds = Number(ms) / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.round(seconds % 60)}s`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Only keep string values from an untrusted array (defensive rendering). */
export function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

const CALIBRATION_RATE_KEYS = new Set([
  'criterion_agreement',
  'false_pass_rate',
  'false_fail_rate',
  'override_rate',
]);

const CALIBRATION_COUNT_KEYS = new Set([
  'case_count',
  'minimum_cases',
  'available_cases',
  'candidate_scored_cases',
]);

const CALIBRATION_PERCENT_KEYS = new Set(['mae', 'benchmark_mae']);

/**
 * Calibration detail mixes counts, quality percentages and MAE scores. The
 * service converts backend 0-1 ratios before this point; the key only selects
 * presentation, so a 92% agreement is never multiplied again.
 */
export function formatCalibrationMetric(key: string, value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  if (CALIBRATION_COUNT_KEYS.has(key)) return formatNumber(value);
  if (CALIBRATION_RATE_KEYS.has(key)) {
    return formatPercent(value, 1);
  }
  if (CALIBRATION_PERCENT_KEYS.has(key)) {
    return `${value.toFixed(1)}%`;
  }
  return value.toFixed(3);
}
