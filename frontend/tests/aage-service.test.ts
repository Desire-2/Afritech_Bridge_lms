import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AAGE_BASE_PATH,
  AageError,
  buildAssessmentUrl,
  buildGradingJobsUrl,
  buildGradingResultsUrl,
  buildInstructorEvaluatorsUrl,
  buildLearningCalibrationUrl,
  buildLearningExamplesUrl,
  buildLearningInsightsUrl,
  buildQuery,
  buildStudentGradingStatusUrl,
  buildStudentResultUrl,
  buildUrl,
  clampPage,
  clampPerPage,
  classifyStudentAageError,
  confidenceBand,
  isAageNotFound,
  isOpenReviewStatus,
  normalizeCalibrationRun,
  normalizeEvaluatorMetrics,
  normalizeGradingPolicies,
  normalizeRubricPayload,
  projectStudentHistory,
  projectStudentHistoryEntry,
  ratioToPercent,
  sumWeights,
  unwrapAnalyticsPayload,
  unwrapCalibrationRuns,
  unwrapEnvelope,
  unwrapLearningInsights,
  unwrapList,
  unwrapPaginated,
  unwrapReviewPayload,
  unwrapRubricPayload,
  validatePolicyUpdate,
  validateWeights,
} from '../src/services/aage.service';

// ── URL construction ─────────────────────────────────────────────────────────

test('buildUrl joins segments under the AAGE base path', () => {
  assert.equal(AAGE_BASE_PATH, '/aage');
  assert.equal(buildUrl(), '/aage/');
  assert.equal(
    buildUrl('assessments', 'assignment', 12, 'rubric'),
    '/aage/assessments/assignment/12/rubric'
  );
});

test('buildUrl encodes dynamic segments and skips empty ones', () => {
  assert.equal(
    buildUrl('admin', 'evaluators', 'content evaluator/v2', null, undefined, ''),
    '/aage/admin/evaluators/content%20evaluator%2Fv2'
  );
});

test('buildAssessmentUrl produces assessment-scoped paths', () => {
  assert.equal(
    buildAssessmentUrl('project', 7, 'rubric', 'versions'),
    '/aage/assessments/project/7/rubric/versions'
  );
  assert.equal(
    buildAssessmentUrl('assignment', 3, 'analyze'),
    '/aage/assessments/assignment/3/analyze'
  );
});

test('instructor evaluator and learning URLs avoid the admin catalog', () => {
  assert.equal(buildInstructorEvaluatorsUrl(), '/aage/evaluators');
  assert.equal(buildLearningInsightsUrl(4), '/aage/learning/insights?course_id=4');
  assert.equal(buildLearningInsightsUrl(), '/aage/learning/insights');
  assert.equal(
    buildLearningExamplesUrl('candidate', 7),
    '/aage/learning/examples?status=candidate&course_id=7'
  );
  assert.equal(
    buildLearningCalibrationUrl(12, 3),
    '/aage/learning/calibration/12?course_id=3'
  );
});

test('page helpers keep UI requests inside the 100-row backend cap', () => {
  assert.equal(clampPerPage(200), 100);
  assert.equal(clampPerPage(undefined), 20);
  assert.equal(clampPage(3, 2), 2);
  assert.equal(clampPage(0, undefined), 1);
});

test('confidence bands treat missing data as unknown, not low', () => {
  assert.equal(confidenceBand(undefined), 'unknown');
  assert.equal(confidenceBand(null), 'unknown');
  assert.equal(confidenceBand(0), 'low');
  assert.equal(confidenceBand(65), 'medium');
  assert.equal(confidenceBand(85), 'high');
});

test('only pending and changes-requested reviews are editable', () => {
  assert.equal(isOpenReviewStatus('pending'), true);
  assert.equal(isOpenReviewStatus('changes_requested'), true);
  assert.equal(isOpenReviewStatus('approved'), false);
  assert.equal(isOpenReviewStatus('rejected'), false);
  assert.equal(isOpenReviewStatus(undefined), false);
});

test('buildQuery skips empty values and encodes keys/values', () => {
  assert.equal(buildQuery({}), '');
  assert.equal(
    buildQuery({ course_id: 5, status: '', page: 2, evaluator: 'code reviewer' }),
    '?course_id=5&page=2&evaluator=code+reviewer'
  );
});

// ── Envelope unwrapping ──────────────────────────────────────────────────────

test('unwrapReviewPayload flattens the backend review packet', () => {
  const packet = {
    success: true,
    data: {
      review: { id: 4, result_id: 42, status: 'pending', ai_score: 71 },
      result: { id: 42, final_score: 71, criteria: [] },
      evidence: [{ id: 1 }],
      published: false,
    },
  };
  const review = unwrapReviewPayload<Record<string, unknown>>(packet);
  assert.equal(review.id, 4);
  assert.equal(review.result_id, 42);
  assert.deepEqual(review.result, packet.data.result);
  assert.deepEqual(review.evidence, packet.data.evidence);
  assert.equal(review.published, false);
});

test('unwrapReviewPayload tolerates a flat review payload', () => {
  const review = { id: 4, result_id: 42, status: 'pending' };
  assert.deepEqual(unwrapReviewPayload(review), review);
});

test('unwrapAnalyticsPayload flattens backend analytics counters', () => {
  const analytics = unwrapAnalyticsPayload({
    success: true,
    data: {
      course_id: 3,
      total_submissions: 12,
      auto_graded_count: 9,
      pending_reviews: 2,
      failed_jobs: 1,
      average_processing_time: { ms: 450.5, sample_count: 9 },
      instructor_correction_rate: { rate: 0.25, corrected: 1, resolved_reviews: 4 },
      per_evaluator_performance: {
        backend: {
          active_version: '1.0.0',
          versions: [{
            id: 7,
            version: '1.0.0',
            sample_count: 9,
            status: 'active',
            mae: 3.5,
            criterion_agreement: 0.92,
            override_rate: 0.1,
            false_pass_rate: 0.02,
            false_fail_rate: 0.03,
          }],
        },
      },
    },
  });
  assert.equal(analytics.auto_graded, 9);
  assert.equal(analytics.failed, 1);
  assert.equal(analytics.avg_processing_time_ms, 450.5);
  // Backend ratio 0.25 -> dashboard percentage 25%, with counts preserved.
  assert.equal(analytics.correction_rate, 25);
  assert.deepEqual(analytics.correction_counts, { corrected: 1, resolved: 4 });
  assert.equal(analytics.evaluator_performance?.[0].name, 'backend');
  assert.equal(analytics.evaluator_performance?.[0].sample_count, 9);
  assert.equal(analytics.evaluator_performance?.[0].mae, 3.5);
  assert.equal(analytics.evaluator_performance?.[0].criterion_agreement, 92);
  assert.equal(analytics.evaluator_performance?.[0].override_rate, 10);
  assert.equal(analytics.evaluator_performance?.[0].false_pass_rate, 2);
  assert.equal(analytics.evaluator_performance?.[0].false_fail_rate, 3);
  assert.equal('graded_count' in (analytics.evaluator_performance?.[0] ?? {}), false);
});

test('unwrapAnalyticsPayload does not invent numbers for an empty system', () => {
  const analytics = unwrapAnalyticsPayload({ success: true, data: { course_id: 3 } });
  assert.equal(analytics.auto_graded, undefined);
  assert.equal(analytics.failed, undefined);
  assert.deepEqual(analytics.evaluator_performance, []);
});

test('unwrapLearningInsights turns the backend summary into cards', () => {
  const cards = unwrapLearningInsights({
    success: true,
    data: {
      examples: { total: 5, by_status: { candidate: 2, approved: 3, rejected: 0 } },
      correction_impact: { approved_count: 3, mean_score_delta: -2.5 },
      evaluators: { versions: 4, active_versions: { backend: '1.2.0' }, candidates: 1 },
      calibration: { runs: 2, cases: 18 },
    },
  });
  assert.equal(cards.length, 4);
  const byCategory = Object.fromEntries(cards.map((card) => [card.category, card]));
  assert.equal(byCategory.learning_examples.count, 5);
  assert.equal(byCategory.correction_impact.ai_vs_instructor?.average_delta, -2.5);
  assert.equal(byCategory.evaluator_versions.count, 4);
  assert.equal(byCategory.calibration.count, 2);
});

test('unwrapLearningInsights prefers an explicit insights array', () => {
  const insights = [{ id: 1, title: 'Existing insight' }];
  assert.deepEqual(unwrapLearningInsights({ success: true, data: { insights } }), insights);
});

test('unwrapLearningInsights ignores non-finite summary values', () => {
  const cards = unwrapLearningInsights({
    success: true,
    data: {
      examples: { total: Number.NaN },
      correction_impact: { approved_count: 1, mean_score_delta: Number.POSITIVE_INFINITY },
      evaluators: {},
      calibration: {},
    },
  });
  assert.deepEqual(cards, []);
});

test('unwrapRubricPayload extracts the rubric from the read envelope', () => {
  const rubric = { id: 9, title: 'API rubric', criteria: [] };
  assert.deepEqual(
    unwrapRubricPayload({ success: true, data: { rubric, has_rubric: true } }),
    rubric
  );
});

test('unwrapRubricPayload tolerates a direct rubric payload', () => {
  const rubric = { id: 9, title: 'API rubric', criteria: [] };
  assert.deepEqual(unwrapRubricPayload(rubric), rubric);
});

test('normalizeRubricPayload bridges ORM and generation criterion vocabularies', () => {
  const normalized = normalizeRubricPayload<{
    criteria: Array<Record<string, unknown>>;
  }>({
    id: 9,
    criteria: [{
      criterion_key: 'api_design',
      name: 'API design',
      weight: 40,
      max_points: 25,
    }],
  });
  assert.equal(normalized.criteria[0].key, 'api_design');
  assert.equal(normalized.criteria[0].criterion_key, 'api_design');
  assert.equal(normalized.criteria[0].max_marks, 25);
  assert.equal(normalized.criteria[0].max_points, 25);
});

test('normalizeRubricPayload keeps bands per criterion under both aliases', () => {
  const levels = [{ label: 'Excellent', min_score: 80, max_score: 100 }];
  const normalized = normalizeRubricPayload<{
    performance_levels?: unknown;
    criteria: Array<Record<string, unknown>>;
  }>({
    performance_levels: [{ label: 'legacy top level' }],
    criteria: [{ name: 'API design', weight: 100, performance_levels: levels }],
  });
  assert.equal(normalized.performance_levels, undefined);
  assert.deepEqual(normalized.criteria[0].levels, levels);
  assert.deepEqual(normalized.criteria[0].performance_levels, levels);
});

test('normalizeRubricPayload uses legacy top-level bands only as a criterion fallback', () => {
  const levels = [{ label: 'Pass', min_score: 50, max_score: 100 }];
  const normalized = normalizeRubricPayload<{
    performance_levels?: unknown;
    criteria: Array<Record<string, unknown>>;
  }>({
    performance_levels: levels,
    criteria: [{ name: 'Only criterion', weight: 100 }],
  });
  assert.equal(normalized.performance_levels, undefined);
  assert.deepEqual(normalized.criteria[0].levels, levels);
  assert.deepEqual(normalized.criteria[0].performance_levels, levels);
});

test('unwrapRubricPayload reports an absent rubric as typed not_found', () => {
  assert.throws(
    () => unwrapRubricPayload({ success: true, data: { rubric: null, has_rubric: false } }),
    (error: unknown) =>
      error instanceof AageError && error.code === 'not_found'
  );
});

test('unwrapEnvelope returns bare payloads unchanged', () => {
  const payload = { id: 1, final_score: 82.5 };
  assert.deepEqual(unwrapEnvelope(payload), payload);
  assert.deepEqual(unwrapEnvelope([1, 2, 3]), [1, 2, 3]);
});

test('unwrapEnvelope unwraps { success, data } and { data } envelopes', () => {
  const body = { id: 2, status: 'published' };
  assert.deepEqual(unwrapEnvelope({ success: true, data: body }), body);
  assert.deepEqual(unwrapEnvelope({ data: body }), body);
});

test('unwrapEnvelope does not mistake a domain data field for an envelope', () => {
  // A legitimate payload that contains `data` plus domain fields must pass through.
  const payload = { id: 9, data: [1, 2], title: 'Result' };
  assert.deepEqual(unwrapEnvelope(payload), payload);
});

test('unwrapEnvelope throws on an explicit failure envelope or empty payload', () => {
  assert.throws(
    () => unwrapEnvelope({ success: false, message: 'Not allowed' }),
    /Not allowed/
  );
  assert.throws(() => unwrapEnvelope(null), /Empty API response/);
});

test('unwrapList handles bare, enveloped and keyed collection payloads', () => {
  assert.deepEqual(unwrapList<{ id: number }>([{ id: 1 }], 'reviews'), [{ id: 1 }]);
  assert.deepEqual(
    unwrapList<{ id: number }>({ success: true, data: [{ id: 2 }] }, 'reviews'),
    [{ id: 2 }]
  );
  assert.deepEqual(
    unwrapList<{ id: number }>({ reviews: [{ id: 3 }], total: 1 }, 'reviews'),
    [{ id: 3 }]
  );
  assert.deepEqual(unwrapList({ unexpected: true }, 'reviews'), []);
});

// ── Weight validation ────────────────────────────────────────────────────────

test('sumWeights ignores non-numeric values', () => {
  assert.equal(sumWeights([{ weight: 40 }, { weight: 35.5 }, { weight: 24.5 }]), 100);
  assert.equal(sumWeights([{ weight: 10 }, { weight: null }, { weight: NaN }]), 10);
});

test('validateWeights accepts criteria totalling 100', () => {
  const result = validateWeights([
    { criterion_key: 'correctness', weight: 40 },
    { criterion_key: 'design', weight: 35 },
    { criterion_key: 'testing', weight: 25 },
  ]);
  assert.equal(result.valid, true);
  assert.equal(result.total, 100);
  assert.equal(result.difference, 0);
  assert.deepEqual(result.invalidCriteria, []);
});

test('validateWeights rejects totals other than 100 with a helpful message', () => {
  const result = validateWeights([
    { name: 'Correctness', weight: 50 },
    { name: 'Design', weight: 30 },
  ]);
  assert.equal(result.valid, false);
  assert.equal(result.total, 80);
  assert.equal(result.difference, 20);
  assert.match(result.message, /add 20%/);
});

test('validateWeights rejects out-of-range and empty criteria', () => {
  const negative = validateWeights([
    { criterion_key: 'a', weight: -5 },
    { criterion_key: 'b', weight: 105 },
  ]);
  assert.equal(negative.valid, false);
  assert.deepEqual(negative.invalidCriteria, ['a', 'b']);

  const empty = validateWeights([]);
  assert.equal(empty.valid, false);
  assert.match(empty.message, /at least one criterion/i);
});

test('validateWeights tolerates tiny floating-point drift', () => {
  const result = validateWeights([
    { weight: 33.33 },
    { weight: 33.33 },
    { weight: 33.34 },
  ]);
  assert.equal(result.valid, true);
});

// ── New endpoint URL construction ───────────────────────────────────────────

test('buildGradingJobsUrl builds the job-list URL with filters', () => {
  assert.equal(buildGradingJobsUrl(), '/aage/grading/jobs');
  assert.equal(
    buildGradingJobsUrl({ course_id: 4, status: 'failed', per_page: 50 }),
    '/aage/grading/jobs?course_id=4&status=failed&per_page=50'
  );
});

test('buildGradingResultsUrl builds the result-list URL with filters', () => {
  assert.equal(
    buildGradingResultsUrl({ submission_type: 'project', page: 2 }),
    '/aage/grading/results?submission_type=project&page=2'
  );
});

test('buildStudentResultUrl builds the student-safe published-result URL', () => {
  assert.equal(buildStudentResultUrl(42), '/aage/student/results/42');
  assert.equal(
    buildStudentResultUrl(42, 'assignment'),
    '/aage/student/results/42?submission_type=assignment'
  );
});

test('buildStudentGradingStatusUrl builds the student-safe status URL', () => {
  assert.equal(buildStudentGradingStatusUrl(42), '/aage/student/grading-status/42');
  assert.equal(
    buildStudentGradingStatusUrl(42, 'project'),
    '/aage/student/grading-status/42?submission_type=project'
  );
});

// ── Error fidelity ───────────────────────────────────────────────────────────

test('unwrapEnvelope preserves structured error code, message and details', () => {
  let thrown: unknown;
  try {
    unwrapEnvelope({
      success: false,
      error: {
        code: 'RUBRIC_WEIGHTS_INVALID',
        message: 'Criteria weights must total 100%.',
        details: { total: 87.5, expected: 100 },
      },
    });
  } catch (error) {
    thrown = error;
  }

  assert.ok(thrown instanceof AageError);
  assert.equal(thrown.name, 'AageError');
  assert.equal(thrown.message, 'Criteria weights must total 100%.');
  assert.equal(thrown.code, 'RUBRIC_WEIGHTS_INVALID');
  assert.deepEqual(thrown.details, { total: 87.5, expected: 100 });
  assert.ok(!thrown.message.includes('[object Object]'));
});

test('unwrapEnvelope handles string errors and top-level messages without stringifying objects', () => {
  let stringError: unknown;
  try {
    unwrapEnvelope({ success: false, error: 'Job already cancelled' });
  } catch (error) {
    stringError = error;
  }
  assert.ok(stringError instanceof AageError);
  assert.equal(stringError.message, 'Job already cancelled');

  let messageOnly: unknown;
  try {
    unwrapEnvelope({ success: false, message: 'Access denied' });
  } catch (error) {
    messageOnly = error;
  }
  assert.ok(messageOnly instanceof AageError);
  assert.equal(messageOnly.message, 'Access denied');
});

// ── Pagination ───────────────────────────────────────────────────────────────

test('unwrapPaginated reads collection from data and pagination from meta', () => {
  const result = unwrapPaginated<{ id: number }>(
    {
      data: [{ id: 1 }, { id: 2 }],
      meta: { page: 2, per_page: 2, total: 7, pages: 4 },
    },
    ['reviews']
  );
  assert.deepEqual(result.items, [{ id: 1 }, { id: 2 }]);
  assert.deepEqual(result.meta, { page: 2, per_page: 2, total: 7, pages: 4 });
});

test('unwrapPaginated tolerates legacy top-level pagination fields', () => {
  const result = unwrapPaginated<{ id: number }>(
    { reviews: [{ id: 9 }], total: 1, page: 1, per_page: 10 },
    ['reviews']
  );
  assert.deepEqual(result.items, [{ id: 9 }]);
  assert.equal(result.meta.total, 1);
  assert.equal(result.meta.page, 1);
  assert.equal(result.meta.per_page, 10);
});

test('unwrapPaginated handles enveloped collections nested under a key', () => {
  const result = unwrapPaginated<{ id: number }>(
    { success: true, data: { jobs: [{ id: 5 }] }, meta: { total: 1 } },
    ['jobs']
  );
  assert.deepEqual(result.items, [{ id: 5 }]);
  assert.equal(result.meta.total, 1);
});

test('unwrapPaginated throws a typed error for rejection envelopes', () => {
  assert.throws(
    () =>
      unwrapPaginated(
        { success: false, error: { code: 'FORBIDDEN', message: 'Not permitted' } },
        ['reviews']
      ),
    (error: unknown) => error instanceof AageError && error.code === 'FORBIDDEN'
  );
});

// ── Runtime policy contract ──────────────────────────────────────────────────

test('normalizeGradingPolicies maps the backend 0-100 policy contract', () => {
  const policies = normalizeGradingPolicies({
    success: true,
    data: {
      auto_publish_min: 92,
      provisional_min: 80,
      auto_publish_enabled: true,
      require_all_gates: false,
      auto_approve_enabled: true,
      auto_approve_min: 68,
    },
  });
  assert.deepEqual(policies, {
    auto_publish_min: 92,
    provisional_min: 80,
    auto_publish_enabled: true,
    require_all_gates: false,
    auto_approve_enabled: true,
    auto_approve_min: 68,
  });
  assert.equal(validatePolicyUpdate(policies), null);
});

test('normalizeGradingPolicies ignores legacy keys instead of misreading their scale', () => {
  assert.deepEqual(
    normalizeGradingPolicies({
      success: true,
      data: { confidence_threshold: 0.9, require_instructor_review: true },
    }),
    {
      auto_publish_min: 90,
      provisional_min: 75,
      auto_publish_enabled: false,
      require_all_gates: true,
      auto_approve_enabled: true,
      auto_approve_min: 70,
    }
  );
});

test('validatePolicyUpdate rejects out-of-range and inverted confidence thresholds', () => {
  assert.match(
    validatePolicyUpdate({
      auto_publish_min: 101,
      provisional_min: 75,
      auto_publish_enabled: false,
      require_all_gates: true,
      auto_approve_enabled: true,
      auto_approve_min: 70,
    }) || '',
    /between 0 and 100/
  );
  assert.match(
    validatePolicyUpdate({
      auto_publish_min: 70,
      provisional_min: 80,
      auto_publish_enabled: false,
      require_all_gates: true,
      auto_approve_enabled: true,
      auto_approve_min: 70,
    }) || '',
    /cannot be lower/
  );
  assert.match(
    validatePolicyUpdate({
      auto_publish_min: 90,
      provisional_min: 75,
      auto_publish_enabled: false,
      require_all_gates: true,
      auto_approve_enabled: true,
      auto_approve_min: 150,
    }) || '',
    /between 0 and 100/
  );
});

// ── Unit conversion ──────────────────────────────────────────────────────────

test('ratioToPercent converts backend ratios to dashboard percentages', () => {
  assert.equal(ratioToPercent(0.735), 73.5);
  assert.equal(ratioToPercent(0.92), 92);
  assert.equal(ratioToPercent(null), undefined);
  assert.equal(ratioToPercent(Number.NaN), undefined);
});

test('normalizeEvaluatorMetrics converts only backend rate fields', () => {
  const row = normalizeEvaluatorMetrics({
    name: 'rubric evaluator',
    criterion_agreement: 0.92,
    override_rate: 0.1,
    false_pass_rate: null,
    sample_count: 18,
    benchmark_mae: 3.4,
  });
  assert.equal(row.criterion_agreement, 92);
  assert.equal(row.override_rate, 10);
  assert.equal(row.false_pass_rate, null);
  assert.equal(row.sample_count, 18);
  assert.equal(row.benchmark_mae, 3.4);
});

test('normalizeCalibrationRun converts nested metric rates but preserves MAE', () => {
  const run = normalizeCalibrationRun({
    id: 11,
    status: 'completed',
    metrics: {
      criterion_agreement: 0.875,
      false_fail_rate: 0.04,
      mae: 6.25,
      case_count: 16,
    },
  });
  assert.equal(run.metrics.criterion_agreement, 87.5);
  assert.equal(run.metrics.false_fail_rate, 4);
  assert.equal(run.metrics.mae, 6.25);
  assert.equal(run.metrics.case_count, 16);
});

test('unwrapAnalyticsPayload preserves bucket arrays and empty-system counts', () => {
  const analytics = unwrapAnalyticsPayload({
    success: true,
    data: {
      instructor_correction_rate: { rate: 0, corrected: 0, resolved_reviews: 0 },
      score_distribution: [
        { min: 0, max: 49, count: 2 },
        { min: 50, max: 100, count: 8 },
      ],
    },
  });
  assert.equal(analytics.correction_rate, 0);
  assert.deepEqual(analytics.correction_counts, { corrected: 0, resolved: 0 });
  assert.deepEqual(analytics.score_distribution, [
    { min: 0, max: 49, count: 2 },
    { min: 50, max: 100, count: 8 },
  ]);
});

// ── Calibration run list (insights adapter) ─────────────────────────────────

test('unwrapCalibrationRuns reads recent runs from the learning insights summary', () => {
  const runs = unwrapCalibrationRuns({
    success: true,
    data: {
      calibration: {
        runs: 2,
        cases: 18,
        recent: [
          { id: 11, name: 'candidate-v2', status: 'completed', decision: 'promote' },
          { id: 'bad-id', status: 'completed' },
          null,
        ],
      },
    },
  });
  assert.deepEqual(runs, [{
    id: 11,
    name: 'candidate-v2',
    status: 'completed',
    decision: 'promote',
  }]);
});

// ── Typed not_found handling / student-safe errors ──────────────────────────

test('isAageNotFound uses structured code or status, never prose', () => {
  assert.equal(isAageNotFound(new AageError('nothing here', { code: 'not_found' })), true);
  assert.equal(isAageNotFound({ status: 404 }), true);
  assert.equal(isAageNotFound({ response: { status: 404 } }), true);
  assert.equal(isAageNotFound({ message: 'not found in SQL logs' }), false);
});

test('classifyStudentAageError hides backend messages behind a safe vocabulary', () => {
  const leaked = 'SQLSELECT * FROM evaluation_results WHERE secret = 42';
  assert.equal(classifyStudentAageError(new AageError(leaked, { code: 'not_found' })), 'not_found');
  assert.equal(classifyStudentAageError({ code: 'FORBIDDEN', message: leaked }), 'forbidden');
  assert.equal(classifyStudentAageError({ status: 401, message: leaked }), 'forbidden');
  assert.equal(classifyStudentAageError({ status: 500, message: leaked }), 'unavailable');
});

// ── Student grading history adapters ────────────────────────────────────────

test('projectStudentHistoryEntry whitelists student-safe fields', () => {
  const entry = projectStudentHistoryEntry({
    id: 7,
    submission_id: 42,
    student_id: 9,
    submission_type: 'assignment',
    status: 'published',
    is_official: true,
    final_score: 88.5,
    grade_letter: 'A',
    published_at: '2026-01-02T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    confidence: 91,
    feedback: 'instructor only',
    rationale: 'evaluator only',
    evidence: [{ id: 1 }],
  });
  assert.ok(entry);
  assert.equal(entry.final_score, 88.5);
  assert.equal(entry.grade_letter, 'A');
  assert.deepEqual(Object.keys(entry).sort(), [
    'created_at', 'final_score', 'grade_letter', 'id', 'is_official',
    'published_at', 'status', 'submission_id', 'submission_type',
  ]);
});

test('projectStudentHistoryEntry hides provisional scores on non-official rows', () => {
  const entry = projectStudentHistoryEntry({
    id: 8,
    submission_id: 42,
    status: 'draft',
    final_score: 12,
    grade_letter: 'F',
  });
  assert.ok(entry);
  assert.equal(entry.is_official, false);
  assert.equal(entry.final_score, null);
  assert.equal(entry.grade_letter, null);
});

test('projectStudentHistory scopes rows to the submission and student', () => {
  const history = projectStudentHistory(
    {
      success: true,
      data: [
        { id: 9, submission_id: 42, student_id: 9, status: 'published', is_official: true, final_score: 70 },
        { id: 8, submission_id: 99, student_id: 9, status: 'published', final_score: 90 },
        { id: 7, submission_id: 42, student_id: 77, status: 'published', final_score: 60 },
        { id: 10, submission_id: 42, student_id: 9, status: 'draft', final_score: 55 },
      ],
      meta: { total: 4 },
    },
    { submissionId: 42, userId: 9 }
  );
  assert.deepEqual(history.map((entry) => entry.id), [10, 9]);
  assert.equal(history[0].final_score, null);
  assert.equal(history[1].final_score, 70);
});
