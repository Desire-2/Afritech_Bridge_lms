/**
 * AAGE (Adaptive AI Assessment & Grading Engine) service.
 *
 * Thin, typed axios layer over the backend `/api/v1/aage` contract. Auth is
 * handled by the shared api-client (JWT in localStorage), exactly like
 * grading.service.ts. Responses are unwrapped defensively because the legacy
 * API mixes bare payloads with `{ success, data }` envelopes.
 *
 * SECURITY NOTE: this service only exposes what the instructor/student UI
 * needs. Internal evaluator prompts, raw benchmark datasets and other
 * students' artifacts are deliberately not modelled or requested here.
 */

import apiClient from '@/lib/api-client';
import { ApiErrorHandler } from '@/lib/error-handler';

export const AAGE_BASE_PATH = '/aage';

export type AssessmentKind = 'assignment' | 'project';
export type SubmissionType = 'assignment' | 'project';

// ─────────────────────────────────────────────────────────────────────────────
// Envelope / URL helpers (kept pure so they can be unit-tested with node:test)
// ─────────────────────────────────────────────────────────────────────────────

/** Keys that, on their own, identify an envelope rather than a domain payload. */
const ENVELOPE_KEYS = new Set(['data', 'success', 'message', 'error', 'meta']);

/** Shape of the structured error object returned by the AAGE backend. */
export interface AageErrorInfo {
  code?: string;
  message?: string;
  details?: unknown;
}

/**
 * Error thrown for a rejected AAGE response. Keeping `code` and `details` on
 * the error object (rather than stringifying them) lets the UI show precise,
 * actionable messages instead of `[object Object]`.
 */
export class AageError extends Error {
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, info: AageErrorInfo = {}) {
    super(message);
    this.name = 'AageError';
    this.code = info.code;
    this.details = info.details;
    // Required so `instanceof AageError` works with downleveled targets.
    Object.setPrototypeOf(this, AageError.prototype);
  }
}

/** Does this object look like a transport envelope rather than domain data? */
function isEnvelopeLike(record: Record<string, unknown>): boolean {
  const keys = Object.keys(record);
  if (keys.length === 0) return false;
  if (!keys.every((key) => ENVELOPE_KEYS.has(key))) return false;
  return 'data' in record || 'success' in record || 'error' in record;
}

/** Convert an error envelope into a typed error without losing structured fields. */
function toAageError(record: Record<string, unknown>): AageError {
  const rawError = record.error;
  let code: string | undefined;
  let message: string | undefined;
  let details: unknown;

  if (rawError && typeof rawError === 'object' && !Array.isArray(rawError)) {
    const info = rawError as Record<string, unknown>;
    if (typeof info.code === 'string') code = info.code;
    if (typeof info.message === 'string') message = info.message;
    details = info.details;
  } else if (typeof rawError === 'string') {
    message = rawError;
  }

  const fallback = typeof record.message === 'string' ? record.message : undefined;
  return new AageError(message || fallback || 'The request was rejected by the server', {
    code,
    details,
  });
}

/** Keep structured AAGE errors intact; use the shared handler for transport errors. */
function handleRequestError(error: unknown): never {
  if (error instanceof AageError) throw error;
  throw ApiErrorHandler.handleError(error);
}

/**
 * Structured-code check for the typed "nothing here yet" case. Consumers must
 * use this (or `error.code`) instead of matching prose: the backend message can
 * change without notice, and a student-facing error must never be guessed from
 * a raw string.
 */
export function isAageNotFound(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const record = error as { code?: unknown; status?: unknown; response?: { status?: unknown } };
  if (record.code === 'not_found') return true;
  if (record.status === 404) return true;
  return record.response?.status === 404;
}

/** Why a student-safe view could not load. Never derived from backend prose. */
export type StudentAageErrorKind = 'not_found' | 'forbidden' | 'unavailable';

/**
 * Map an AAGE failure to a small, safe vocabulary for student screens. Only
 * structured fields are inspected so backend stack traces, SQL and evaluator
 * internals can never be surfaced to a student.
 */
export function classifyStudentAageError(error: unknown): StudentAageErrorKind {
  if (!error || typeof error !== 'object') return 'unavailable';
  const record = error as {
    code?: unknown;
    status?: unknown;
    response?: { status?: unknown };
  };
  const code = typeof record.code === 'string' ? record.code.toLowerCase() : '';
  const status = record.status ?? record.response?.status;
  if (isAageNotFound(error)) return 'not_found';
  if (code === 'forbidden' || code === 'unauthorized' || status === 401 || status === 403) {
    return 'forbidden';
  }
  return 'unavailable';
}

/** Backend ratios (0-1) are converted once, here, before any UI formatting. */
export function ratioToPercent(value: number | null | undefined, digits = 2): number | undefined {
  const numeric = finiteNumber(value);
  if (numeric === undefined) return undefined;
  return roundTo(numeric * 100, digits);
}

const RATE_METRIC_KEYS = [
  'criterion_agreement',
  'agreement',
  'reliability',
  'false_pass_rate',
  'false_fail_rate',
  'override_rate',
] as const;

const RATE_METRIC_KEY_SET: ReadonlySet<string> = new Set(RATE_METRIC_KEYS);

/**
 * Convert backend 0-1 ratios to 0-100 percentages. Calibration nests rates in
 * `baseline`, `candidate`, `by_evaluator` and `by_evaluator_candidate`, so the
 * conversion must recurse rather than only inspect the top level.
 */
function normalizeRateMetrics(raw: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (RATE_METRIC_KEY_SET.has(key)) {
      const numeric = finiteNumber(value);
      normalized[key] = numeric === undefined ? null : ratioToPercent(numeric);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      normalized[key] = normalizeRateMetrics(value as Record<string, unknown>);
    } else {
      normalized[key] = value;
    }
  }
  return normalized;
}

/** Evaluator catalogue rows carry backend 0-1 quality ratios; UI gets 0-100. */
export function normalizeEvaluatorMetrics<T extends object>(raw: T): T {
  return normalizeRateMetrics(raw as Record<string, unknown>) as T;
}

/** Calibration detail carries the same ratios inside its aggregate metrics. */
export function normalizeCalibrationRun<T extends object>(raw: T): T {
  const record = raw as Record<string, unknown>;
  const metrics = record.metrics;
  if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) return raw;
  return {
    ...record,
    metrics: normalizeRateMetrics(metrics as Record<string, unknown>),
  } as T;
}

/**
 * Normalise the rubric-read response. The backend currently returns
 * `{ rubric: {...} | null, has_rubric }`; older/other paths may return the
 * rubric directly. A missing rubric is reported as a typed `not_found` so the
 * UI can show the normal "generate a rubric" state.
 */
export function unwrapRubricPayload<T>(payload: unknown): T {
  const data = unwrapEnvelope<unknown>(payload);
  if (data && typeof data === 'object' && !Array.isArray(data) &&
      'rubric' in (data as Record<string, unknown>)) {
    const rubric = (data as Record<string, unknown>).rubric;
    if (!rubric) {
      throw new AageError('No rubric has been generated for this assessment.', {
        code: 'not_found',
      });
    }
    return normalizeRubricPayload<T>(rubric);
  }
  return normalizeRubricPayload<T>(data);
}

/**
 * Unwrap `{ success, data }` / `{ data, meta }` / `{ data }` envelopes while
 * leaving bare domain payloads untouched — even if a domain object happens to
 * contain a `data` field of its own. Rejections throw a typed `AageError`.
 */
export function unwrapEnvelope<T>(payload: unknown): T {
  if (payload === null || payload === undefined) {
    throw new Error('Empty API response');
  }

  if (typeof payload === 'object' && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;

    if (record.success === false) throw toAageError(record);

    const hasData = 'data' in record && record.data !== undefined && record.data !== null;
    if (hasData && isEnvelopeLike(record)) return record.data as T;

    // A bare `{ error: {...} }` response is also a failure, not domain data.
    if ('error' in record && isEnvelopeLike(record)) throw toAageError(record);
  }

  return payload as T;
}

/**
 * Normalise the review packet. The backend returns
 * `{ review, result, evidence, ... }`; the UI works with a flat `Review` plus
 * optional `result`/`evidence`, so merge the nested review and keep the packet
 * fields available for callers that need them.
 */
export function unwrapReviewPayload<T extends Record<string, unknown>>(payload: unknown): T {
  const data = unwrapEnvelope<unknown>(payload);
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const packet = data as Record<string, unknown>;
    const nested = packet.review;
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return {
        ...(nested as Record<string, unknown>),
        result: packet.result,
        evidence: packet.evidence,
        learning_example: packet.learning_example,
        published: packet.published,
      } as T;
    }
  }
  return data as T;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * Normalise criterion vocabulary across the API. The ORM emits
 * `criterion_key`/`max_points`, while generation and scoring use
 * `key`/`max_marks`. Both must be present before a rubric is edited and saved.
 */
export function normalizeRubricPayload<T>(payload: unknown): T {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload as T;
  }
  const record = payload as Record<string, unknown>;
  if (!Array.isArray(record.criteria)) return payload as T;

  const criteria = record.criteria.map((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
    const criterion = raw as Record<string, unknown>;
    const key =
      (typeof criterion.key === 'string' && criterion.key) ||
      (typeof criterion.criterion_key === 'string' && criterion.criterion_key) ||
      undefined;
    const marks =
      finiteNumber(criterion.max_marks) ??
      finiteNumber(criterion.max_points) ??
      finiteNumber(criterion.maximum) ??
      finiteNumber(criterion.max_score);
    return {
      ...criterion,
      ...(key ? { key, criterion_key: key } : {}),
      ...(marks !== undefined ? { max_marks: marks, max_points: marks } : {}),
    };
  });
  const firstLevels = criteria.find(
    (criterion) => criterion && typeof criterion === 'object' &&
      Array.isArray((criterion as Record<string, unknown>).levels)
  ) as Record<string, unknown> | undefined;
  const performanceLevels = Array.isArray(record.performance_levels)
    ? record.performance_levels
    : firstLevels?.levels;
  return {
    ...record,
    criteria,
    ...(performanceLevels ? { performance_levels: performanceLevels } : {}),
  } as T;
}

/**
 * The learning endpoint returns an aggregate summary, not a list:
 * `{ examples, correction_impact, evaluators, calibration }`. Turn that into
 * the insight cards the UI renders, while still accepting an explicit
 * `insights` array from older/other deployments.
 */
export function unwrapLearningInsights(payload: unknown): LearningInsight[] {
  const data = unwrapEnvelope<unknown>(payload);
  if (Array.isArray(data)) return data as LearningInsight[];
  if (!data || typeof data !== 'object') return [];

  const record = data as Record<string, unknown>;
  if (Array.isArray(record.insights)) return record.insights as LearningInsight[];

  const insights: LearningInsight[] = [];
  const examples = (record.examples ?? {}) as Record<string, unknown>;
  const impact = (record.correction_impact ?? {}) as Record<string, unknown>;
  const evaluators = (record.evaluators ?? {}) as Record<string, unknown>;
  const calibration = (record.calibration ?? {}) as Record<string, unknown>;

  const total = finiteNumber(examples.total);
  if (total !== undefined) {
    const byStatus = (examples.by_status ?? {}) as Record<string, unknown>;
    insights.push({
      category: 'learning_examples',
      title: 'Reviewed corrections',
      description:
        `${total} learning example(s): ` +
        `${finiteNumber(byStatus.approved) ?? 0} approved, ` +
        `${finiteNumber(byStatus.candidate) ?? 0} awaiting approval, ` +
        `${finiteNumber(byStatus.rejected) ?? 0} rejected.`,
      count: total,
    });
  }

  const approvedCount = finiteNumber(impact.approved_count) ?? 0;
  const meanDelta = finiteNumber(impact.mean_score_delta);
  if (meanDelta !== undefined) {
    insights.push({
      category: 'correction_impact',
      title: 'AI vs instructor marks',
      description:
        `Approved corrections move marks by ${meanDelta.toFixed(2)} on average ` +
        `across ${approvedCount} example(s).`,
      ai_vs_instructor: { average_delta: meanDelta, sample_count: approvedCount },
    });
  }

  const versions = finiteNumber(evaluators.versions);
  if (versions !== undefined) {
    const active = (evaluators.active_versions ?? {}) as Record<string, unknown>;
    insights.push({
      category: 'evaluator_versions',
      title: 'Evaluator versions',
      description:
        `${versions} version row(s); ${Object.keys(active).length} active. ` +
        `${finiteNumber(evaluators.candidates) ?? 0} candidate(s) awaiting calibration.`,
      count: versions,
    });
  }

  const runs = finiteNumber(calibration.runs);
  if (runs !== undefined) {
    // `recent` comes straight from the backend insights summary
    // (`/learning/insights` -> calibration.recent, max 20 rows). It is the only
    // supported run-list contract; there is no separate calibration list API.
    const recentRuns = Array.isArray(calibration.recent)
      ? calibration.recent
          .filter((item): item is Record<string, unknown> =>
            item !== null && typeof item === 'object' && !Array.isArray(item))
          .map((item) => ({
            id: finiteNumber(item.id),
            name: typeof item.name === 'string' ? item.name : undefined,
            status: typeof item.status === 'string' ? item.status : undefined,
            decision: typeof item.decision === 'string' ? item.decision : undefined,
          }))
          .filter((item): item is CalibrationRunSummary => item.id !== undefined)
      : [];
    insights.push({
      category: 'calibration',
      title: 'Calibration activity',
      description:
        `${runs} calibration run(s) over ${finiteNumber(calibration.cases) ?? 0} case(s).` +
        (recentRuns.length ? ` ${recentRuns.length} most recent run(s) listed below.` : ''),
      count: runs,
      calibration_runs: recentRuns,
    });
  }

  return insights;
}

/** Run-list adapter over the only supported calibration list contract. */
export function unwrapCalibrationRuns(payload: unknown): CalibrationRunSummary[] {
  const calibration = unwrapLearningInsights(payload).find(
    (insight) => insight.category === 'calibration'
  );
  return calibration?.calibration_runs ?? [];
}

/** Pagination metadata returned by the modern list endpoints in `meta`. */
export interface AageMeta {
  page?: number;
  per_page?: number;
  total?: number;
  pages?: number;
  [key: string]: unknown;
}

export interface PaginatedEnvelope<T> {
  items: T[];
  meta: AageMeta;
}

function findCollection(value: unknown, collectionKeys: string[]): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of [...collectionKeys, 'items', 'results', 'data']) {
      if (Array.isArray(record[key])) return record[key] as unknown[];
    }
  }
  return [];
}

/**
 * Unwrap a paginated list. The current backend returns
 * `{ data: [...], meta: { page, per_page, total, pages } }`; legacy responses
 * put `total`/`page` alongside the collection, which is also tolerated.
 */
export function unwrapPaginated<T>(
  payload: unknown,
  collectionKeys: string[] = []
): PaginatedEnvelope<T> {
  if (payload === null || payload === undefined) throw new Error('Empty API response');

  let body: unknown = payload;
  let meta: AageMeta = {};

  if (typeof payload === 'object' && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    if (record.success === false) throw toAageError(record);
    if ('error' in record && !('data' in record) && isEnvelopeLike(record)) {
      throw toAageError(record);
    }
    if ('data' in record && isEnvelopeLike(record)) {
      body = record.data;
      if (record.meta && typeof record.meta === 'object' && !Array.isArray(record.meta)) {
        meta = record.meta as AageMeta;
      }
    }
  }

  // Legacy shape: pagination fields live next to the collection.
  const legacyMeta: AageMeta = {};
  const top = payload as Record<string, unknown>;
  (['page', 'per_page', 'total', 'pages'] as const).forEach((key) => {
    if (typeof top[key] === 'number') legacyMeta[key] = top[key] as number;
  });

  return {
    items: findCollection(body, collectionKeys) as T[],
    meta: { ...legacyMeta, ...meta },
  };
}

/** Join path segments under the AAGE base path. Dynamic segments are encoded. */
export function buildUrl(...segments: Array<string | number | null | undefined>): string {
  const parts = segments
    .filter((segment): segment is string | number =>
      segment !== null && segment !== undefined && String(segment).length > 0
    )
    .map((segment) => encodeURIComponent(String(segment)));
  return `${AAGE_BASE_PATH}/${parts.join('/')}`;
}

/** Build an assessment-scoped URL, e.g. `/aage/assessments/assignment/12/rubric`. */
export function buildAssessmentUrl(
  kind: AssessmentKind,
  id: number | string,
  ...suffix: Array<string | number | null | undefined>
): string {
  return buildUrl('assessments', kind, id, ...suffix);
}

/** Serialise query parameters, skipping empty values. */
export function buildQuery(
  params: Record<string, string | number | boolean | null | undefined>
): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.append(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

/** URL for the grading-job list endpoint. */
export function buildGradingJobsUrl(filters: GradingQueueFilters = {}): string {
  return `${AAGE_BASE_PATH}/grading/jobs${buildQuery({ ...filters })}`;
}

/** URL for the grading-result list endpoint. */
export function buildGradingResultsUrl(filters: GradingQueueFilters = {}): string {
  return `${AAGE_BASE_PATH}/grading/results${buildQuery({ ...filters })}`;
}

/** URL for the student-safe published-result endpoint. */
export function buildStudentResultUrl(
  submissionId: number | string,
  submissionType?: SubmissionType
): string {
  return `${AAGE_BASE_PATH}/student/results/${encodeURIComponent(String(submissionId))}${buildQuery({
    submission_type: submissionType,
  })}`;
}

/** URL for the student-safe grading-status endpoint. */
export function buildStudentGradingStatusUrl(
  submissionId: number | string,
  submissionType?: SubmissionType
): string {
  return `${AAGE_BASE_PATH}/student/grading-status/${encodeURIComponent(String(submissionId))}${buildQuery({
    submission_type: submissionType,
  })}`;
}

/** URL for the engine-aware grading-detail status endpoint. */
export function buildUnifiedGradingStatusUrl(
  submissionType: SubmissionType,
  submissionId: number | string
): string {
  return `${AAGE_BASE_PATH}/grading/unified/status/${encodeURIComponent(submissionType)}/${encodeURIComponent(String(submissionId))}`;
}

/** URL for the engine-aware grading-detail start endpoint. */
export function buildUnifiedGradingStartUrl(): string {
  return `${AAGE_BASE_PATH}/grading/unified/start`;
}

/**
 * Spreadsheet is an AAGE specialist, not a second engine. The backend keeps
 * `selected_engine: "aage"` for compatibility and uses `specialist` to hint
 * which evaluator family will run; never branch on a legacy `excel` engine
 * value to decide which UI path owns grading.
 */
export function isSpreadsheetSpecialist(
  status: { specialist?: string | null; selected_engine?: string | null } | null | undefined,
): boolean {
  return status?.specialist === 'spreadsheet';
}

/** Unwrap a list that may be bare, enveloped, or keyed by a collection name. */
export function unwrapList<T>(payload: unknown, key: string): T[] {
  return unwrapPaginated<T>(payload, [key]).items;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rubric types
// ─────────────────────────────────────────────────────────────────────────────

export interface EvidenceRequirement {
  category?: string;
  description?: string;
  required?: boolean;
  [key: string]: unknown;
}

export interface PerformanceLevel {
  label: string;
  min_score?: number;
  max_score?: number;
  description?: string;
  [key: string]: unknown;
}

export interface EvaluatorRecommendation {
  name: string;
  reason?: string;
  confidence?: number;
  [key: string]: unknown;
}

export interface RubricCriterion {
  id?: number;
  rubric_id?: number;
  criterion_key?: string;
  /** Generation/scoring alias for `criterion_key`; both are sent to the API. */
  key?: string;
  name: string;
  description?: string;
  /** Percentage weight. All criteria in a rubric must total 100. */
  weight: number;
  /** Criterion's own mark scale; backend also accepts max_points/maximum. */
  max_marks?: number;
  maximum?: number;
  max_score?: number;
  is_required?: boolean;
  evidence_requirements?: Array<EvidenceRequirement | string>;
  evidence_category?: string;
  evaluator_hint?: string;
  evaluator_instructions?: string;
  order_index?: number;
  [key: string]: unknown;
}

export interface Rubric {
  id: number;
  title?: string;
  name?: string;
  status?: string;
  version?: number;
  discipline?: string;
  assessment_kind?: AssessmentKind;
  assessment_id?: number;
  course_id?: number;
  source?: string;
  generated_by_ai?: boolean;
  summary?: string;
  learning_objectives?: string[];
  deliverables?: string[];
  technologies?: string[];
  evaluation_methods?: string[];
  evaluator_recommendations?: Array<EvaluatorRecommendation | string>;
  unverifiable_requirements?: string[];
  performance_levels?: PerformanceLevel[];
  criteria_weights_total?: number;
  criteria?: RubricCriterion[];
  approved_by?: number | null;
  approved_at?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface RubricVersion {
  id: number;
  rubric_id: number;
  version: number;
  checksum?: string;
  total_points?: number | null;
  weight_total?: number | null;
  change_note?: string | null;
  created_by?: number | null;
  created_at?: string | null;
  payload?: Partial<Rubric> | null;
}

export interface RubricUpdate {
  title?: string;
  summary?: string;
  discipline?: string;
  criteria?: RubricCriterion[];
  performance_levels?: PerformanceLevel[];
  evaluator_recommendations?: Array<EvaluatorRecommendation | string>;
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Grading types
// ─────────────────────────────────────────────────────────────────────────────

export type JobStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'timed_out';

export interface GradingJob {
  id: number;
  correlation_id?: string;
  job_type?: string;
  submission_type: SubmissionType;
  submission_id: number;
  assessment_id?: number;
  assessment_kind?: AssessmentKind;
  course_id?: number | null;
  student_id?: number | null;
  status: JobStatus | string;
  priority?: number;
  attempts?: number;
  max_attempts?: number;
  rubric_id?: number | null;
  rubric_version_id?: number | null;
  evaluators?: string[];
  error?: string | null;
  result_id?: number | null;
  progress?: Record<string, unknown>;
  queued_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  created_at?: string | null;
}

export interface StartGradingRequest {
  submission_type: SubmissionType;
  submission_id: number;
  evaluators?: string[];
}

/**
 * Minimal shape of a legacy Excel result needed by the shared grading detail
 * page. The full type remains in excel-grading.service.ts; this view is
 * deliberately structural so the two services do not import each other.
 */
export interface ExcelGradingResultSummary {
  id: number;
  total_score?: number | null;
  max_score?: number | null;
  grade_letter?: string | null;
  overall_feedback?: string | null;
  status?: string;
  instructor_reviewed?: boolean;
  manual_review_required?: boolean;
  [key: string]: unknown;
}

export type UnifiedGradingEngine = 'excel' | 'aage';

export interface UnifiedGradingStatus {
  submission_type: SubmissionType;
  submission_id: number;
  /** Compatibility field: the backend always returns `aage`. */
  selected_engine: UnifiedGradingEngine;
  /** AAGE evaluator hint (for example `spreadsheet`); never an engine. */
  specialist?: string | null;
  excel_result?: ExcelGradingResultSummary | null;
  aage_job?: GradingJob | null;
  aage_result?: GradingResult | null;
  /** Latest official/published result, kept visible during a re-grade draft. */
  official_aage_result?: GradingResult | null;
  review_id?: number | null;
}

export interface StartUnifiedGradingRequest extends StartGradingRequest {
  force?: boolean;
}

/** Outcome of the shared Excel publication path (no new scoring is done here). */
export interface ExcelGradePublication {
  status: string;
  reason?: string | null;
  approved?: boolean;
  applied?: boolean;
  modification_requested?: boolean;
  learning_progress_updated?: boolean;
  notified?: boolean;
}

export interface StartUnifiedGradingResponse {
  engine: UnifiedGradingEngine;
  /** AAGE evaluator hint (for example `spreadsheet`); never an engine. */
  specialist?: string | null;
  status: string;
  /** Excel result payload, or the deduplicated AAGE result for unchanged files. */
  result?: ExcelGradingResultSummary | GradingResult | null;
  job?: GradingJob | null;
  /** Present for Excel-owned submissions after the shared finalisation path. */
  publication?: ExcelGradePublication | null;
  message?: string | null;
  reason?: string | null;
  fallback_from?: UnifiedGradingEngine | null;
  fallback_reason?: string | null;
}

export interface SubmissionArtifact {
  id: number;
  job_id?: number;
  file_name: string;
  relative_path: string;
  storage?: string | null;
  media_type?: string | null;
  size_bytes?: number | null;
  checksum_sha256?: string | null;
  category?: string | null;
  language?: string | null;
  is_entry_point?: boolean;
  is_required_deliverable?: boolean;
  truncated?: boolean;
  status?: string;
  error?: string | null;
  created_at?: string | null;
}

export interface Evidence {
  id: number;
  criterion_score_id?: number | null;
  criterion_key?: string | null;
  /** VERIFIED | CODE_SUPPORTED | CONTENT_SUPPORTED | UNVERIFIED */
  category: string;
  source?: string;
  reference?: string | null;
  locator?: string | null;
  /** Instructor-safe summary of the supporting evidence (never a raw prompt). */
  summary: string;
  detail?: Record<string, unknown>;
  confidence?: number | null;
}

export interface CriterionScore {
  id: number;
  result_id?: number;
  criterion_id?: number | null;
  criterion_key: string;
  name: string;
  awarded: number;
  maximum: number;
  weight?: number;
  weighted_score?: number;
  /** Instructor-facing rationale only. Never rendered to students. */
  rationale?: string | null;
  evidence_category?: string;
  verification_status?: string;
  evaluator_name?: string | null;
  evaluator_version?: string | null;
  feedback?: string | null;
  limitations?: string | null;
  is_required?: boolean;
  order_index?: number;
  evidence?: Evidence[];
}

export interface RecommendedResource {
  title: string;
  url?: string;
  type?: string;
  description?: string;
}

export type ResultStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'published'
  | 'failed'
  | string;

export interface GradingResult {
  id: number;
  run_id?: number | null;
  job_id?: number | null;
  correlation_id?: string | null;
  submission_type: SubmissionType;
  submission_id: number;
  assessment_kind?: AssessmentKind;
  assessment_id?: number;
  course_id?: number | null;
  student_id?: number | null;
  rubric_id?: number | null;
  rubric_version_id?: number | null;
  rubric_snapshot?: Record<string, unknown> | null;
  total_awarded: number;
  total_possible: number;
  /** 0-100 percentage, computed deterministically by the backend. */
  final_score: number;
  grade_letter?: string | null;
  points_awarded?: number | null;
  confidence: number;
  confidence_factors?: Record<string, unknown>;
  requires_review?: boolean;
  review_reason?: string | null;
  status: ResultStatus;
  feedback?: string | null;
  strengths?: string[];
  improvements?: string[];
  recommended_resources?: RecommendedResource[];
  ai_provider?: string | null;
  evaluator_versions?: string[];
  limitations?: string[];
  is_official?: boolean;
  published_at?: string | null;
  published_by?: number | null;
  created_at?: string;
  updated_at?: string;
  criteria?: CriterionScore[];
  evidence?: Evidence[];
  artifacts?: SubmissionArtifact[];
  grading_history?: GradingHistoryEntry[];
}

export interface GradingHistoryEntry {
  id?: number;
  action?: string;
  actor?: string;
  score?: number;
  note?: string;
  created_at?: string;
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Review types
// ─────────────────────────────────────────────────────────────────────────────

export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'resolved' | string;

export interface Review {
  id: number;
  result_id: number;
  status: ReviewStatus;
  assigned_to?: number | null;
  ai_score?: number | null;
  final_score?: number | null;
  decision_note?: string | null;
  correction_reason?: string | null;
  opened_at?: string | null;
  resolved_at?: string | null;
  result?: GradingResult | null;
  evidence?: Evidence[];
  learning_example?: Record<string, unknown> | null;
  published?: boolean;
}

export interface PendingReviewsParams {
  course_id?: number;
  page?: number;
  per_page?: number;
}

export interface PendingReviewsResponse {
  reviews: Review[];
  total?: number;
  page?: number;
  per_page?: number;
  pages?: number;
}

export interface CriterionCorrection {
  marks: number;
  reason: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Learning / calibration / analytics types
// ─────────────────────────────────────────────────────────────────────────────

/** Compact run row from `/learning/insights` -> `calibration.recent`. */
export interface CalibrationRunSummary {
  id: number;
  name?: string;
  status?: string;
  decision?: string;
}

export interface LearningInsight {
  id?: number;
  title?: string;
  category?: string;
  severity?: string;
  message?: string;
  description?: string;
  count?: number;
  affected_criteria?: string[];
  common_errors?: string[];
  /** Only present on the calibration insight; max 20 rows from the backend. */
  calibration_runs?: CalibrationRunSummary[];
  ai_vs_instructor?: {
    average_delta?: number;
    average_ai_score?: number;
    average_instructor_score?: number;
    sample_count?: number;
  };
  evaluator_performance?: EvaluatorPerformance[];
  [key: string]: unknown;
}

export interface EvaluatorPerformance {
  name: string;
  version?: string;
  active?: boolean;
  average_delta?: number;
  override_rate?: number;
  agreement_rate?: number;
  sample_count?: number;
  [key: string]: unknown;
}

export interface LearningExample {
  id: number;
  result_id?: number | null;
  submission_type?: SubmissionType | null;
  submission_id?: number | null;
  assessment_id?: number | null;
  course_id?: number | null;
  rubric_version_id?: number | null;
  evaluator_name?: string | null;
  evaluator_version?: string | null;
  ai_provider?: string | null;
  original_scores?: Record<string, unknown>;
  instructor_scores?: Record<string, unknown>;
  score_delta?: number | null;
  explanation?: string | null;
  tags?: string[];
  status?: string;
  dataset_version?: string | null;
  approved_by?: number | null;
  approved_at?: string | null;
  created_at?: string | null;
}

export interface EvaluatorConfig {
  name: string;
  active: boolean;
  description?: string | null;
  version?: string | null;
  status?: string | null;
  /** Aggregate quality metrics only — raw prompts/config are never exposed. */
  benchmark_mae?: number | null;
  criterion_agreement?: number | null;
  false_pass_rate?: number | null;
  false_fail_rate?: number | null;
  override_rate?: number | null;
  sample_count?: number | null;
  [key: string]: unknown;
}

export interface EvaluatorVersionSummary {
  id: number;
  name: string;
  version: string;
  status: string;
  description?: string | null;
  changelog?: string | null;
  benchmark_mae?: number | null;
  criterion_agreement?: number | null;
  false_pass_rate?: number | null;
  false_fail_rate?: number | null;
  override_rate?: number | null;
  sample_count?: number | null;
  created_at?: string | null;
  activated_at?: string | null;
}

export interface StartCalibrationRequest {
  evaluator_name: string;
  candidate_version_id: number;
}

export interface CalibrationRun {
  id: number;
  name?: string;
  status?: string;
  dataset_version?: string | null;
  baseline_evaluator_version_id?: number | null;
  candidate_evaluator_version_id?: number | null;
  case_count?: number;
  /** Aggregate comparison metrics only (MAE, agreement, false pass/fail). */
  metrics?: Record<string, unknown>;
  decision?: string | null;
  decision_note?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  approved_at?: string | null;
  created_at?: string | null;
}

/**
 * Runtime policy contract from `GET/PUT /aage/admin/policies`. Both thresholds
 * are confidence percentages on a 0-100 scale — not 0-1 ratios, and not marks.
 */
export interface GradingPolicies {
  auto_publish_min: number;
  provisional_min: number;
  auto_publish_enabled: boolean;
  require_all_gates: boolean;
  /** Excel-style approval gate (default on). */
  auto_approve_enabled: boolean;
  auto_approve_min: number;
  [key: string]: unknown;
}

/** Defaults documented by the backend (`src/services/aage/constants.py`). */
export const DEFAULT_GRADING_POLICIES: GradingPolicies = {
  auto_publish_min: 90,
  provisional_min: 75,
  auto_publish_enabled: false,
  require_all_gates: true,
  auto_approve_enabled: true,
  auto_approve_min: 70,
};

export function isPolicyPercent(value: unknown): value is number {
  return finiteNumber(value) !== undefined && Number(value) >= 0 && Number(value) <= 100;
}

/** Validate a policy edit before PUT; the backend rejects values outside this contract. */
export function validatePolicyUpdate(policies: GradingPolicies): string | null {
  if (!isPolicyPercent(policies.auto_publish_min)) {
    return 'Auto-publish minimum must be a percentage between 0 and 100.';
  }
  if (!isPolicyPercent(policies.provisional_min)) {
    return 'Provisional minimum must be a percentage between 0 and 100.';
  }
  if (policies.auto_publish_min < policies.provisional_min) {
    return 'Auto-publish minimum cannot be lower than the provisional minimum.';
  }
  if (!isPolicyPercent(policies.auto_approve_min)) {
    return 'Auto-approve minimum must be a percentage between 0 and 100.';
  }
  return null;
}

/**
 * Normalise a policy response to the backend contract. Unknown/legacy keys are
 * ignored; an absent field falls back to the documented default rather than
 * silently reading a 0-1 `confidence_threshold` as a percentage.
 */
export function normalizeGradingPolicies(payload: unknown): GradingPolicies {
  const data = unwrapEnvelope<unknown>(payload);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ...DEFAULT_GRADING_POLICIES };
  }
  const record = data as Record<string, unknown>;
  return {
    auto_publish_min: isPolicyPercent(record.auto_publish_min)
      ? Number(record.auto_publish_min)
      : DEFAULT_GRADING_POLICIES.auto_publish_min,
    provisional_min: isPolicyPercent(record.provisional_min)
      ? Number(record.provisional_min)
      : DEFAULT_GRADING_POLICIES.provisional_min,
    auto_publish_enabled:
      typeof record.auto_publish_enabled === 'boolean'
        ? record.auto_publish_enabled
        : DEFAULT_GRADING_POLICIES.auto_publish_enabled,
    require_all_gates:
      typeof record.require_all_gates === 'boolean'
        ? record.require_all_gates
        : DEFAULT_GRADING_POLICIES.require_all_gates,
    auto_approve_enabled:
      typeof record.auto_approve_enabled === 'boolean'
        ? record.auto_approve_enabled
        : DEFAULT_GRADING_POLICIES.auto_approve_enabled,
    auto_approve_min: isPolicyPercent(record.auto_approve_min)
      ? Number(record.auto_approve_min)
      : DEFAULT_GRADING_POLICIES.auto_approve_min,
  };
}

export interface EvaluatorMetric {
  name: string;
  version?: string;
  status?: string;
  /** Benchmark cases, not the number of graded student submissions. */
  sample_count?: number;
  /** Mean absolute criterion error, already a 0-100 percentage from the backend. */
  mae?: number;
  /** 0-100 percentages converted from backend 0-1 ratios. */
  criterion_agreement?: number;
  override_rate?: number;
  false_pass_rate?: number;
  false_fail_rate?: number;
  [key: string]: unknown;
}

export interface AageAnalytics {
  total_submissions?: number;
  auto_graded?: number;
  pending_reviews?: number;
  failed?: number;
  avg_processing_time_ms?: number;
  /** 0-100 percentage. Backend ratio is converted by `unwrapAnalyticsPayload`. */
  correction_rate?: number;
  correction_counts?: { corrected?: number; resolved?: number };
  evaluator_performance?: EvaluatorMetric[];
  /** Backend returns buckets `{ min, max, count }`, not a name -> value map. */
  score_distribution?: Array<{ min: number; max: number; count: number }>;
  confidence_distribution?: Array<{ min: number; max: number; count: number }>;
  review_status_counts?: Record<string, number>;
  [key: string]: unknown;
}

/**
 * Map the backend analytics contract onto the flat shape rendered by the
 * dashboard. Unknown/non-finite values stay undefined rather than becoming
 * misleading zeroes.
 */
export function unwrapAnalyticsPayload(payload: unknown): AageAnalytics {
  const data = unwrapEnvelope<unknown>(payload);
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const record = data as Record<string, unknown>;

  const timing = (record.average_processing_time ?? {}) as Record<string, unknown>;
  const correction = (record.instructor_correction_rate ?? {}) as Record<string, unknown>;

  const evaluatorPerformance: EvaluatorMetric[] = [];
  const perEvaluator = record.per_evaluator_performance;
  if (perEvaluator && typeof perEvaluator === 'object' && !Array.isArray(perEvaluator)) {
    for (const [name, entry] of Object.entries(perEvaluator as Record<string, unknown>)) {
      const versions = (entry as { versions?: unknown })?.versions;
      if (!Array.isArray(versions)) continue;
      for (const item of versions) {
        if (!item || typeof item !== 'object') continue;
        const version = item as Record<string, unknown>;
        evaluatorPerformance.push({
          name,
          version: typeof version.version === 'string' ? version.version : undefined,
          status: typeof version.status === 'string' ? version.status : undefined,
          sample_count: finiteNumber(version.sample_count),
          mae: finiteNumber(version.mae),
          criterion_agreement: ratioToPercent(
            finiteNumber(version.criterion_agreement)
          ),
          override_rate: ratioToPercent(finiteNumber(version.override_rate)),
          false_pass_rate: ratioToPercent(finiteNumber(version.false_pass_rate)),
          false_fail_rate: ratioToPercent(finiteNumber(version.false_fail_rate)),
        });
      }
    }
  }

  // The backend reports `instructor_correction_rate.rate` as corrected /
  // resolved (0-1). Convert to the same 0-100 unit used by every other card in
  // the dashboard, and keep the denominator so an empty system never reads as
  // "0% corrections".
  const correctionRate = ratioToPercent(correction.rate);

  return {
    ...record,
    total_submissions: finiteNumber(record.total_submissions),
    auto_graded: finiteNumber(record.auto_graded_count) ?? finiteNumber(record.auto_graded),
    pending_reviews: finiteNumber(record.pending_reviews),
    failed: finiteNumber(record.failed_jobs) ?? finiteNumber(record.failed),
    avg_processing_time_ms:
      finiteNumber(timing.ms) ?? finiteNumber(record.avg_processing_time_ms),
    correction_rate: correctionRate,
    correction_counts: {
      corrected: finiteNumber(correction.corrected),
      resolved: finiteNumber(correction.resolved_reviews),
    },
    evaluator_performance: evaluatorPerformance.length
      ? evaluatorPerformance
      : (Array.isArray(record.evaluator_performance) ? record.evaluator_performance : []),
  };
}

/** Minimal student-safe grading state for one submission. */
export interface StudentGradingStatus {
  submission_id: number;
  submission_type?: SubmissionType | null;
  has_job: boolean;
  engine?: "aage" | "excel" | "unknown" | null;
  status?: string | null;
  queued_at?: string | null;
  finished_at?: string | null;
}

/** Student-safe, already-reviewed result. Never contains evidence or internals. */
export interface StudentPublishedResult {
  submission_id: number;
  submission_type?: SubmissionType;
  assessment_title?: string;
  course_title?: string;
  status?: string;
  is_official?: boolean;
  published_at?: string | null;
  final_score?: number;
  grade_letter?: string | null;
  points_awarded?: number | null;
  total_possible?: number;
  feedback?: string | null;
  /** Separate revision request reason from the LMS submission. */
  modification_request_reason?: string | null;
  strengths?: string[];
  improvements?: string[];
  recommended_resources?: RecommendedResource[];
  criteria?: Array<{
    criterion_key: string;
    name: string;
    awarded: number;
    maximum: number;
    feedback?: string | null;
  }>;
}

/**
 * Student-visible grading history row. Deliberately excludes feedback,
 * rationale, evidence, confidence, limitations and evaluator internals: the
 * list endpoint returns an instructor-shaped projection and the student page
 * must re-project it before rendering.
 */
export interface StudentHistoryEntry {
  id: number;
  submission_id: number;
  submission_type?: SubmissionType;
  status: ResultStatus;
  is_official: boolean;
  published_at?: string | null;
  created_at?: string | null;
  final_score?: number | null;
  grade_letter?: string | null;
  [key: string]: unknown;
}

export function projectStudentHistoryEntry(raw: unknown): StudentHistoryEntry | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const id = finiteNumber(record.id);
  const submissionId = finiteNumber(record.submission_id);
  if (id === undefined || submissionId === undefined) return null;

  const isOfficial = record.is_official === true || record.status === 'published';
  const submissionType =
    record.submission_type === 'assignment' || record.submission_type === 'project'
      ? record.submission_type
      : undefined;

  return {
    id,
    submission_id: submissionId,
    ...(submissionType ? { submission_type: submissionType } : {}),
    status: typeof record.status === 'string' ? record.status : 'draft',
    is_official: isOfficial,
    published_at: typeof record.published_at === 'string' ? record.published_at : null,
    created_at: typeof record.created_at === 'string' ? record.created_at : null,
    // Unofficial drafts are not grades yet; never show their provisional score.
    final_score: isOfficial ? finiteNumber(record.final_score) ?? null : null,
    grade_letter: isOfficial && typeof record.grade_letter === 'string'
      ? record.grade_letter
      : null,
  };
}

/**
 * Adapt the existing `/aage/grading/results` payload to a student's own
 * submission. The backend already scopes rows to the caller; the explicit
 * submission and user checks here are a second line of defence.
 */
export function projectStudentHistory(
  payload: unknown,
  scope: { submissionId?: number; userId?: number | null } = {}
): StudentHistoryEntry[] {
  let items: unknown[];
  try {
    items = unwrapPaginated<unknown>(payload, ['results']).items;
  } catch {
    return [];
  }
  const submissionId = finiteNumber(scope.submissionId);
  const userId = finiteNumber(scope.userId ?? undefined);

  return items
    .filter((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
      const record = item as Record<string, unknown>;
      if (submissionId !== undefined && finiteNumber(record.submission_id) !== submissionId) {
        return false;
      }
      // `student_id` may be absent on legacy rows; if present it must match.
      const rowStudentId = finiteNumber(record.student_id);
      if (userId !== undefined && rowStudentId !== undefined && rowStudentId !== userId) {
        return false;
      }
      return true;
    })
    .map((item) => projectStudentHistoryEntry(item))
    .filter((item): item is StudentHistoryEntry => item !== null)
    .sort((a, b) => b.id - a.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Display adapters for the existing grading result / evidence contracts
// ─────────────────────────────────────────────────────────────────────────────

export type GradingOutcomeStatus = 'published' | 'pending_review' | 'draft' | 'unknown';
export type GradingProgression = 'published' | 'awaiting_review' | 'draft' | 'unknown';

/**
 * The published AAGE result is the only safe source for grade-form prefill and
 * pass/fail display. A newer row may be an unreviewed re-grade draft.
 */
export function publishedAageResult<T>(
  status: {
    official_aage_result?: T | null;
    aage_result?: T | null;
  } | null | undefined,
): T | null {
  return status?.official_aage_result ?? status?.aage_result ?? null;
}

export interface GradingOutcome {
  status: GradingOutcomeStatus;
  /** `null` means the API did not provide enough data — never guess a policy. */
  passed: boolean | null;
  progression: GradingProgression;
  isOfficial: boolean;
}

/**
 * Derive a display-ready outcome from fields that are already present on the
 * AAGE result contracts. Pass/fail is only decided when a real passing score
 * is supplied; otherwise it stays undecided instead of being fabricated.
 */
export function deriveGradingOutcome(
  result: {
    status?: string | null;
    is_official?: boolean | null;
    requires_review?: boolean | null;
    final_score?: number | null;
  } | null | undefined,
  passingScore?: number | null,
): GradingOutcome {
  const isOfficial = result?.is_official === true || result?.status === 'published';
  const statusText = typeof result?.status === 'string' ? result.status.toLowerCase() : '';
  const requiresReview =
    result?.requires_review === true || /review|reject/.test(statusText);
  const status: GradingOutcomeStatus = isOfficial
    ? 'published'
    : requiresReview
      ? 'pending_review'
      : statusText
        ? 'draft'
        : 'unknown';
  const progression: GradingProgression =
    status === 'published'
      ? 'published'
      : status === 'pending_review'
        ? 'awaiting_review'
        : status === 'draft'
          ? 'draft'
          : 'unknown';

  const score = finiteNumber(result?.final_score ?? undefined);
  const threshold = finiteNumber(passingScore ?? undefined);
  const passed =
    score !== undefined && threshold !== undefined && threshold >= 0 && threshold <= 100
      ? score >= threshold
      : null;

  return { status, passed, progression, isOfficial };
}

export interface EvidenceDisplay {
  requirementId: string | null;
  status: string;
  summary: string;
  details: string[];
  missing: string[];
  fix: string | null;
  reference: string | null;
  locator: string | null;
  source: string | null;
  confidence: number | null;
}

function displayString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function displayStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => displayString(entry))
      .filter((entry): entry is string => entry !== null);
  }
  const single = displayString(value);
  return single ? [single] : [];
}

/**
 * Project one AAGE evidence row into the fields the review UI shows:
 * requirement id, status, details, fix/missing, file reference and locator.
 * Unknown or absent payload fields degrade to empty values, never to "undefined".
 */
export function projectEvidenceForDisplay(
  item: Evidence | null | undefined,
): EvidenceDisplay {
  if (!item) {
    return {
      requirementId: null,
      status: 'UNVERIFIED',
      summary: 'No evidence provided',
      details: [],
      missing: [],
      fix: null,
      reference: null,
      locator: null,
      source: null,
      confidence: null,
    };
  }

  const detail =
    item.detail && typeof item.detail === 'object' && !Array.isArray(item.detail)
      ? (item.detail as Record<string, unknown>)
      : {};
  const handled = new Set(['fix', 'missing', 'summary', 'locator', 'reference', 'criterion_key']);
  const details = Object.keys(detail)
    .filter((key) => !handled.has(key))
    .map((key) => {
      const value = displayString(detail[key]);
      return value ? `${key.replace(/_/g, ' ')}: ${value}` : null;
    })
    .filter((value): value is string => value !== null);

  return {
    requirementId:
      displayString(item.criterion_key) ??
      (item.criterion_score_id !== undefined && item.criterion_score_id !== null
        ? `score #${item.criterion_score_id}`
        : null),
    status: displayString(item.category) ?? 'UNVERIFIED',
    summary: displayString(item.summary) ?? 'No summary provided',
    details,
    missing: displayStringList(detail.missing),
    fix: displayString(detail.fix),
    reference: displayString(item.reference),
    locator: displayString(item.locator),
    source: displayString(item.source),
    confidence: finiteNumber(item.confidence ?? undefined) ?? null,
  };
}

export interface GradingQueueFilters {
  course_id?: number;
  assessment_id?: number;
  submission_type?: SubmissionType;
  evaluator?: string;
  status?: string;
  confidence?: string;
  requires_review?: boolean;
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Weight validation (pure helper used by the Rubric Builder and its tests)
// ─────────────────────────────────────────────────────────────────────────────

export interface WeightValidationResult {
  valid: boolean;
  total: number;
  expected: number;
  difference: number;
  message: string;
  invalidCriteria: string[];
}

export function sumWeights(criteria: Array<{ weight?: number | null }>): number {
  return criteria.reduce((sum, criterion) => {
    const weight = Number(criterion.weight);
    return sum + (Number.isFinite(weight) ? weight : 0);
  }, 0);
}

export function roundTo(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Criteria weights must be non-negative, <= 100 and total exactly 100. */
export function validateWeights(
  criteria: Array<{ weight?: number | null; criterion_key?: string; name?: string }>,
  tolerance = 0.01
): WeightValidationResult {
  const total = roundTo(sumWeights(criteria));
  const difference = roundTo(100 - total);
  const invalidCriteria = criteria
    .filter((criterion) => {
      const weight = Number(criterion.weight);
      return !Number.isFinite(weight) || weight < 0 || weight > 100;
    })
    .map((criterion) => criterion.criterion_key || criterion.name || 'unnamed criterion');

  let message: string;
  let valid: boolean;

  if (criteria.length === 0) {
    valid = false;
    message = 'Add at least one criterion before saving the rubric.';
  } else if (invalidCriteria.length > 0) {
    valid = false;
    message = `Invalid weight for: ${invalidCriteria.join(', ')}. Weights must be between 0 and 100.`;
  } else if (Math.abs(difference) > tolerance) {
    valid = false;
    message = `Criteria weights total ${total}%. They must total 100% (${difference > 0 ? `add ${difference}%` : `remove ${Math.abs(difference)}%`}).`;
  } else {
    valid = true;
    message = 'Weights total 100%.';
  }

  return { valid, total, expected: 100, difference, message, invalidCriteria };
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

export class AageService {
  private static readonly BASE_PATH = AAGE_BASE_PATH;

  // ── Assessment analysis & rubric builder ──────────────────────────────────

  static async analyzeAssessment(kind: AssessmentKind, id: number): Promise<unknown> {
    try {
      const response = await apiClient.post(buildAssessmentUrl(kind, id, 'analyze'));
      return unwrapEnvelope<unknown>(response.data);
    } catch (error) {
      handleRequestError(error);
    }
  }

  static async generateRubric(kind: AssessmentKind, id: number): Promise<Rubric> {
    try {
      const response = await apiClient.post(buildAssessmentUrl(kind, id, 'rubric', 'generate'));
      return unwrapEnvelope<Rubric>(response.data);
    } catch (error) {
      handleRequestError(error);
    }
  }

  static async getRubric(kind: AssessmentKind, id: number): Promise<Rubric> {
    try {
      const response = await apiClient.get(buildAssessmentUrl(kind, id, 'rubric'));
      return unwrapRubricPayload<Rubric>(response.data);
    } catch (error) {
      handleRequestError(error);
    }
  }

  static async updateRubric(rubricId: number, rubric: RubricUpdate): Promise<Rubric> {
    try {
      const response = await apiClient.put(buildUrl('rubrics', rubricId), rubric);
      return unwrapEnvelope<Rubric>(response.data);
    } catch (error) {
      handleRequestError(error);
    }
  }

  static async approveRubric(rubricId: number): Promise<Rubric> {
    try {
      const response = await apiClient.post(buildUrl('rubrics', rubricId, 'approve'));
      return unwrapEnvelope<Rubric>(response.data);
    } catch (error) {
      handleRequestError(error);
    }
  }

  static async getRubricVersions(kind: AssessmentKind, id: number): Promise<RubricVersion[]> {
    try {
      const response = await apiClient.get(buildAssessmentUrl(kind, id, 'rubric', 'versions'));
      return unwrapList<RubricVersion>(response.data, 'versions');
    } catch (error) {
      handleRequestError(error);
    }
  }

  // ── Grading jobs & results ────────────────────────────────────────────────

  static async startGrading(request: StartGradingRequest): Promise<GradingJob> {
    try {
      const response = await apiClient.post(buildUrl('grading', 'start'), request);
      return unwrapEnvelope<GradingJob>(response.data);
    } catch (error) {
      handleRequestError(error);
    }
  }

  /** Engine-aware status used by the shared grading detail page. */
  static async getUnifiedGradingStatus(
    submissionType: SubmissionType,
    submissionId: number
  ): Promise<UnifiedGradingStatus> {
    try {
      const response = await apiClient.get(
        buildUnifiedGradingStatusUrl(submissionType, submissionId)
      );
      return unwrapEnvelope<UnifiedGradingStatus>(response.data);
    } catch (error) {
      handleRequestError(error);
    }
  }

  /** Start Excel or AAGE grading using the backend's ownership rule. */
  static async startUnifiedGrading(
    request: StartUnifiedGradingRequest
  ): Promise<StartUnifiedGradingResponse> {
    try {
      const response = await apiClient.post(
        buildUnifiedGradingStartUrl(),
        request
      );
      return unwrapEnvelope<StartUnifiedGradingResponse>(response.data);
    } catch (error) {
      handleRequestError(error);
    }
  }

  static async getJob(jobId: number): Promise<GradingJob> {
    try {
      const response = await apiClient.get(buildUrl('grading', 'jobs', jobId));
      return unwrapEnvelope<GradingJob>(response.data);
    } catch (error) {
      handleRequestError(error);
    }
  }

  static async retryJob(jobId: number): Promise<GradingJob> {
    try {
      const response = await apiClient.post(buildUrl('grading', 'jobs', jobId, 'retry'));
      return unwrapEnvelope<GradingJob>(response.data);
    } catch (error) {
      handleRequestError(error);
    }
  }

  static async cancelJob(jobId: number): Promise<GradingJob> {
    try {
      const response = await apiClient.post(buildUrl('grading', 'jobs', jobId, 'cancel'));
      return unwrapEnvelope<GradingJob>(response.data);
    } catch (error) {
      handleRequestError(error);
    }
  }

  static async getResult(resultId: number): Promise<GradingResult> {
    try {
      const response = await apiClient.get(buildUrl('grading', 'results', resultId));
      return unwrapEnvelope<GradingResult>(response.data);
    } catch (error) {
      handleRequestError(error);
    }
  }

  static async getEvidence(resultId: number): Promise<Evidence[]> {
    try {
      const response = await apiClient.get(buildUrl('grading', 'results', resultId, 'evidence'));
      return unwrapList<Evidence>(response.data, 'evidence');
    } catch (error) {
      handleRequestError(error);
    }
  }

  static async publishResult(resultId: number): Promise<GradingResult> {
    try {
      const response = await apiClient.post(buildUrl('grading', 'results', resultId, 'publish'));
      return unwrapEnvelope<GradingResult>(response.data);
    } catch (error) {
      handleRequestError(error);
    }
  }

  /**
   * Convenience list endpoints used by the dashboard when the deployment
   * exposes them. The UI falls back to pending reviews / legacy submission
   * lists when a deployment only implements the single-resource contract.
   */
  static async getGradingJobsPage(
    filters: GradingQueueFilters = {}
  ): Promise<PaginatedEnvelope<GradingJob>> {
    try {
      const response = await apiClient.get(buildGradingJobsUrl(filters));
      return unwrapPaginated<GradingJob>(response.data, ['jobs']);
    } catch (error) {
      handleRequestError(error);
    }
  }

  static async listJobs(filters: GradingQueueFilters = {}): Promise<GradingJob[]> {
    return (await this.getGradingJobsPage(filters)).items;
  }

  static async getGradingResultsPage(
    filters: GradingQueueFilters = {}
  ): Promise<PaginatedEnvelope<GradingResult>> {
    try {
      const response = await apiClient.get(buildGradingResultsUrl(filters));
      return unwrapPaginated<GradingResult>(response.data, ['results']);
    } catch (error) {
      handleRequestError(error);
    }
  }

  static async listResults(filters: GradingQueueFilters = {}): Promise<GradingResult[]> {
    return (await this.getGradingResultsPage(filters)).items;
  }

  // ── Instructor review workspace ──────────────────────────────────────────

  static async getPendingReviews(
    params: PendingReviewsParams = {}
  ): Promise<PendingReviewsResponse> {
    try {
      const response = await apiClient.get(
        `${this.BASE_PATH}/reviews/pending${buildQuery({ ...params })}`
      );
      // Modern responses put the collection in `data` and pagination in
      // `meta`; older deployments put both on the top-level object.
      const { items: reviews, meta } = unwrapPaginated<Review>(response.data, ['reviews']);
      return {
        reviews,
        total: meta.total ?? reviews.length,
        page: meta.page ?? params.page,
        per_page: meta.per_page ?? params.per_page,
        pages: meta.pages,
      };
    } catch (error) {
      handleRequestError(error);
    }
  }

  static async getReview(reviewId: number): Promise<Review> {
    try {
      const response = await apiClient.get(buildUrl('reviews', reviewId));
      return unwrapReviewPayload<Review>(response.data);
    } catch (error) {
      handleRequestError(error);
    }
  }

  static async updateCriterionMark(
    reviewId: number,
    criterionKey: string,
    correction: CriterionCorrection
  ): Promise<Review> {
    try {
      const response = await apiClient.put(
        buildUrl('reviews', reviewId, 'criteria', criterionKey),
        correction
      );
      return unwrapReviewPayload<Review>(response.data);
    } catch (error) {
      handleRequestError(error);
    }
  }

  static async submitCorrection(reviewId: number, explanation: string): Promise<Review> {
    try {
      const response = await apiClient.post(
        buildUrl('reviews', reviewId, 'correction'),
        { explanation }
      );
      return unwrapReviewPayload<Review>(response.data);
    } catch (error) {
      handleRequestError(error);
    }
  }

  static async approveReview(reviewId: number): Promise<Review> {
    try {
      const response = await apiClient.post(buildUrl('reviews', reviewId, 'approve'));
      return unwrapReviewPayload<Review>(response.data);
    } catch (error) {
      handleRequestError(error);
    }
  }

  static async rejectReview(reviewId: number, reason: string): Promise<Review> {
    try {
      const response = await apiClient.post(buildUrl('reviews', reviewId, 'reject'), { reason });
      return unwrapReviewPayload<Review>(response.data);
    } catch (error) {
      handleRequestError(error);
    }
  }

  // ── Learning & calibration ────────────────────────────────────────────────

  static async getLearningInsights(): Promise<LearningInsight[]> {
    try {
      const response = await apiClient.get(buildUrl('learning', 'insights'));
      return unwrapLearningInsights(response.data);
    } catch (error) {
      handleRequestError(error);
    }
  }

  static async getLearningExamples(status?: string): Promise<LearningExample[]> {
    try {
      const response = await apiClient.get(
        `${this.BASE_PATH}/learning/examples${buildQuery({ status })}`
      );
      return unwrapList<LearningExample>(response.data, 'examples');
    } catch (error) {
      handleRequestError(error);
    }
  }

  static async approveLearningExample(exampleId: number): Promise<LearningExample> {
    try {
      const response = await apiClient.post(
        buildUrl('learning', 'examples', exampleId, 'approve')
      );
      return unwrapEnvelope<LearningExample>(response.data);
    } catch (error) {
      handleRequestError(error);
    }
  }

  static async startCalibration(request: StartCalibrationRequest): Promise<CalibrationRun> {
    try {
      const response = await apiClient.post(buildUrl('learning', 'calibration', 'start'), request);
      return normalizeCalibrationRun(unwrapEnvelope<CalibrationRun>(response.data));
    } catch (error) {
      handleRequestError(error);
    }
  }

  static async getCalibration(runId: number): Promise<CalibrationRun> {
    try {
      const response = await apiClient.get(buildUrl('learning', 'calibration', runId));
      return normalizeCalibrationRun(unwrapEnvelope<CalibrationRun>(response.data));
    } catch (error) {
      handleRequestError(error);
    }
  }

  static async approveEvaluatorVersion(versionId: number): Promise<EvaluatorVersionSummary> {
    try {
      const response = await apiClient.post(
        buildUrl('learning', 'evaluator-versions', versionId, 'approve')
      );
      return normalizeEvaluatorMetrics(
        unwrapEnvelope<EvaluatorVersionSummary>(response.data)
      );
    } catch (error) {
      handleRequestError(error);
    }
  }

  static async rollbackEvaluatorVersion(versionId: number): Promise<EvaluatorVersionSummary> {
    try {
      const response = await apiClient.post(
        buildUrl('learning', 'evaluator-versions', versionId, 'rollback')
      );
      return normalizeEvaluatorMetrics(
        unwrapEnvelope<EvaluatorVersionSummary>(response.data)
      );
    } catch (error) {
      handleRequestError(error);
    }
  }

  // ── Admin evaluators / policies ───────────────────────────────────────────

  static async getEvaluators(): Promise<EvaluatorConfig[]> {
    try {
      const response = await apiClient.get(buildUrl('admin', 'evaluators'));
      return unwrapList<EvaluatorConfig>(response.data, 'evaluators').map(
        normalizeEvaluatorMetrics
      );
    } catch (error) {
      handleRequestError(error);
    }
  }

  static async setEvaluatorActive(name: string, active: boolean): Promise<EvaluatorConfig> {
    try {
      const response = await apiClient.patch(
        buildUrl('admin', 'evaluators', name),
        { active }
      );
      return normalizeEvaluatorMetrics(unwrapEnvelope<EvaluatorConfig>(response.data));
    } catch (error) {
      handleRequestError(error);
    }
  }

  static async getPolicies(): Promise<GradingPolicies> {
    try {
      const response = await apiClient.get(buildUrl('admin', 'policies'));
      return normalizeGradingPolicies(response.data);
    } catch (error) {
      handleRequestError(error);
    }
  }

  static async updatePolicies(policies: GradingPolicies): Promise<GradingPolicies> {
    try {
      const response = await apiClient.put(buildUrl('admin', 'policies'), policies);
      return normalizeGradingPolicies(response.data);
    } catch (error) {
      handleRequestError(error);
    }
  }

  static async getAnalytics(courseId?: number): Promise<AageAnalytics> {
    try {
      // Instructors use the course-scoped endpoint; administrators may omit
      // course_id for a platform-wide view. The admin-only path remains for
      // operational tooling.
      const response = await apiClient.get(
        `${this.BASE_PATH}/analytics${buildQuery({ course_id: courseId })}`
      );
      return unwrapAnalyticsPayload(response.data);
    } catch (error) {
      handleRequestError(error);
    }
  }

  /**
   * Student-safe published result. The backend endpoint is expected to return
   * an already-filtered projection; the student page additionally whitelists
   * fields so internal prompts/evidence can never be rendered.
   */
  static async getStudentPublishedResult(
    submissionId: number,
    submissionType?: SubmissionType
  ): Promise<StudentPublishedResult> {
    try {
      const response = await apiClient.get(buildStudentResultUrl(submissionId, submissionType));
      return unwrapEnvelope<StudentPublishedResult>(response.data);
    } catch (error) {
      handleRequestError(error);
    }
  }

  /**
   * Whether AAGE has a job for this submission. Status only — never evidence,
   * evaluator configuration or another student's data.
   */
  static async getStudentGradingStatus(
    submissionId: number,
    submissionType?: SubmissionType
  ): Promise<StudentGradingStatus> {
    try {
      const response = await apiClient.get(
        buildStudentGradingStatusUrl(submissionId, submissionType));
      return unwrapEnvelope<StudentGradingStatus>(response.data);
    } catch (error) {
      handleRequestError(error);
    }
  }

  /**
   * Grading history for one of the caller's submissions. There is no
   * submission_id filter on `/grading/results`, so the existing paginated list
   * is filtered by the adapter. The backend scopes results to the caller's own
   * student_id; the adapter re-checks both ids.
   */
  static async getStudentHistory(
    submissionId: number,
    userId?: number | null,
    submissionType?: SubmissionType
  ): Promise<StudentHistoryEntry[]> {
    try {
      const page = await this.getGradingResultsPage({
        submission_type: submissionType,
        per_page: 100,
      });
      return projectStudentHistory(page, { submissionId, userId });
    } catch (error) {
      handleRequestError(error);
    }
  }
}

export default AageService;
