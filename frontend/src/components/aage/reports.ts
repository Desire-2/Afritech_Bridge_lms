/**
 * Pure projection for the instructor grading report table. Keeping this out of
 * the React component lets node:test verify that no feedback, evidence or
 * evaluator internals leak into the report rows.
 */
export interface ReportRow {
  id: number;
  submission_id: number;
  submission_type: string;
  status: string;
  is_official: boolean;
  final_score: number | null;
  created_at: string | null;
}

const SAFE_KEYS: ReadonlyArray<keyof ReportRow> = [
  'id',
  'submission_id',
  'submission_type',
  'status',
  'is_official',
  'final_score',
  'created_at',
];

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Accept unknown payloads because the list endpoint is not fully typed at runtime. */
export function projectReportRow(raw: unknown): ReportRow | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const id = finiteNumber(record.id);
  const submissionId = finiteNumber(record.submission_id);
  if (id === undefined || submissionId === undefined) return null;

  const status = typeof record.status === 'string' ? record.status : 'unknown';
  const isOfficial = record.is_official === true || status === 'published';

  const row: ReportRow = {
    id,
    submission_id: submissionId,
    submission_type:
      typeof record.submission_type === 'string' ? record.submission_type : 'unknown',
    status,
    is_official: isOfficial,
    final_score: isOfficial ? finiteNumber(record.final_score) ?? null : null,
    created_at: typeof record.created_at === 'string' ? record.created_at : null,
  };

  // Belt-and-braces: only the whitelisted keys are ever returned.
  return Object.fromEntries(
    SAFE_KEYS.map((key) => [key, row[key]])
  ) as ReportRow;
}
