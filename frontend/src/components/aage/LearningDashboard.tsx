'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Activity,
  BookOpenCheck,
  CheckCircle2,
  Gauge,
  History,
  Loader2,
  Scale,
  Settings2,
  Sparkles,
} from 'lucide-react';
import AageService, {
  CalibrationRun,
  EvaluatorConfig,
  GradingPolicies,
  LearningExample,
  LearningInsight,
  isAageNotFound,
  validatePolicyUpdate,
} from '@/services/aage.service';
import {
  AagePanel,
  EmptyState,
  ErrorState,
  Field,
  SecondaryButton,
  StatusBadge,
  formatCalibrationMetric,
  formatDate,
  formatNumber,
  formatPercent,
  inputClass,
  stringList,
} from './shared';

export default function LearningDashboard({
  canAdminister = false,
  courseId,
}: {
  canAdminister?: boolean;
  /** When present, all learning/calibration reads and writes stay in this course. */
  courseId?: number | null;
}) {
  const [insights, setInsights] = useState<LearningInsight[]>([]);
  const [examples, setExamples] = useState<LearningExample[]>([]);
  const [evaluators, setEvaluators] = useState<EvaluatorConfig[]>([]);
  const [policies, setPolicies] = useState<GradingPolicies | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [calibrationDetail, setCalibrationDetail] = useState<CalibrationRun | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [evaluatorName, setEvaluatorName] = useState('');
  const [candidateVersionId, setCandidateVersionId] = useState('');
  const [versionActionId, setVersionActionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const calibrationInsight = useMemo(
    () => insights.find((insight) => insight.category === 'calibration'),
    [insights]
  );
  const calibrationRuns = calibrationInsight?.calibration_runs ?? [];
  const policyError = policies ? validatePolicyUpdate(policies) : null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const results = await Promise.allSettled([
      AageService.getLearningInsights(courseId ?? undefined),
      AageService.getLearningExamples('candidate', courseId ?? undefined),
      // The evaluator catalogue endpoint is admin-only; instructors get the
      // aggregate evaluator summary in the insights cards instead.
      canAdminister ? AageService.getEvaluators() : Promise.resolve([] as EvaluatorConfig[]),
      canAdminister ? AageService.getPolicies() : Promise.resolve(null),
    ]);

    if (results[0].status === 'fulfilled') setInsights(results[0].value);
    if (results[1].status === 'fulfilled') setExamples(results[1].value);
    if (results[2].status === 'fulfilled') {
      const evaluatorList = results[2].value;
      setEvaluators(evaluatorList);
      setEvaluatorName((current) => current || evaluatorList[0]?.name || '');
    }
    if (results[3].status === 'fulfilled') setPolicies(results[3].value);

    const failures = results.filter((result) => result.status === 'rejected').length;
    if (failures === results.length) {
      setError('Unable to load learning data. Check your connection and try again.');
    }
    setLoading(false);
  }, [canAdminister, courseId]);

  const loadRun = useCallback(async (runId: number) => {
    setSelectedRunId(runId);
    setDetailLoading(true);
    setDetailError(null);
    setCalibrationDetail(null);
    try {
      setCalibrationDetail(await AageService.getCalibration(runId, courseId ?? undefined));
    } catch (err: unknown) {
      setDetailError(
        isAageNotFound(err)
          ? 'That calibration run is no longer available.'
          : 'This calibration run could not be loaded right now.'
      );
    } finally {
      setDetailLoading(false);
    }
  }, [courseId]);

  const refresh = useCallback(async () => {
    await load();
    if (selectedRunId !== null) await loadRun(selectedRunId);
  }, [load, loadRun, selectedRunId]);

  const runAction = async (action: () => Promise<unknown>, successMessage: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      toast.success(successMessage);
      await refresh();
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message || 'Action failed.';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const savePolicies = async (next: GradingPolicies) => {
    const invalid = validatePolicyUpdate(next);
    if (invalid) {
      setError(invalid);
      toast.error(invalid);
      return;
    }
    setPolicies(next);
    await runAction(() => AageService.updatePolicies(next).then(setPolicies), 'Policy updated.');
  };

  React.useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && <ErrorState message={error} onRetry={() => void refresh()} />}

      <AagePanel
        title="Common errors & AI vs instructor scores"
        description="Aggregate signals only — no other students' work and no raw evaluator internals."
        icon={<Activity className="h-4 w-4 text-amber-600" />}
      >
        {insights.length === 0 ? (
          <EmptyState title="No insights yet" description="Insights appear after reviewed grading runs." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {insights.map((insight, index) => (
              <div key={insight.id ?? index} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {insight.title || insight.category || 'Insight'}
                  </h4>
                  {insight.severity && <StatusBadge status={insight.severity} />}
                </div>
                {(insight.description || insight.message) && (
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {insight.description || insight.message}
                  </p>
                )}
                {insight.ai_vs_instructor && (
                  <div className="mt-3 grid grid-cols-3 gap-2 rounded-md bg-slate-50 p-3 text-xs dark:bg-slate-700/40">
                    <div>
                      <p className="text-slate-400">AI avg</p>
                      <p className="font-semibold text-slate-800 dark:text-slate-100">
                        {formatPercent(insight.ai_vs_instructor.average_ai_score)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Instructor avg</p>
                      <p className="font-semibold text-slate-800 dark:text-slate-100">
                        {formatPercent(insight.ai_vs_instructor.average_instructor_score)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Δ</p>
                      <p className="font-semibold text-slate-800 dark:text-slate-100">
                        {insight.ai_vs_instructor.average_delta ?? '—'}
                      </p>
                    </div>
                  </div>
                )}
                {stringList(insight.common_errors).length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Common errors</p>
                    <ul className="mt-1 list-disc pl-5 text-xs text-slate-600 dark:text-slate-300">
                      {stringList(insight.common_errors).map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </AagePanel>

      <AagePanel
        title="Evaluator performance"
        description="Aggregate benchmark comparisons. Raw benchmark datasets and prompts are never displayed."
        icon={<Gauge className="h-4 w-4 text-blue-600" />}
      >
        {!canAdminister ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            The detailed evaluator table is administrator-only. Aggregate evaluator signals are
            shown in the insights cards above.
          </p>
        ) : evaluators.length === 0 ? (
          <EmptyState title="No evaluators registered" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700">
                  <th className="py-2 pr-4">Evaluator</th>
                  <th className="py-2 pr-4">Active</th>
                  <th className="py-2 pr-4 text-right">MAE</th>
                  <th className="py-2 pr-4 text-right">Criterion agreement</th>
                  <th className="py-2 pr-4 text-right">Override rate</th>
                  <th className="py-2 text-right">Samples</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {evaluators.map((evaluator) => (
                  <tr key={evaluator.name}>
                    <td className="py-2.5 pr-4 font-medium text-slate-800 dark:text-slate-100">
                      {evaluator.name}
                      {evaluator.version && (
                        <span className="ml-1 text-xs text-slate-400">v{evaluator.version}</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4">
                      <StatusBadge status={evaluator.active ? 'active' : 'inactive'} />
                    </td>
                    <td className="py-2.5 pr-4 text-right text-slate-600 dark:text-slate-300">
                      {formatCalibrationMetric('benchmark_mae', evaluator.benchmark_mae)}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-slate-600 dark:text-slate-300">
                      {formatCalibrationMetric('criterion_agreement', evaluator.criterion_agreement)}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-slate-600 dark:text-slate-300">
                      {formatCalibrationMetric('override_rate', evaluator.override_rate)}
                    </td>
                    <td className="py-2.5 text-right text-slate-600 dark:text-slate-300">
                      {formatNumber(evaluator.sample_count)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AagePanel>

      <AagePanel
        title="Learning examples awaiting approval"
        description="Only explicitly approved corrections are promoted into the calibration dataset."
        icon={<BookOpenCheck className="h-4 w-4 text-purple-600" />}
      >
        {examples.length === 0 ? (
          <EmptyState title="No proposals" description="New correction proposals will appear here." />
        ) : (
          <div className="space-y-3">
            {examples.map((example) => (
              <div key={example.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    Example #{example.id}
                    {example.evaluator_name && (
                      <span className="ml-2 text-xs text-slate-400">{example.evaluator_name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={example.status || 'candidate'} />
                    {canAdminister && (
                      <SecondaryButton
                        className="px-2 py-1 text-xs"
                        disabled={busy}
                        onClick={() =>
                          void runAction(
                            () => AageService.approveLearningExample(example.id),
                            'Learning example approved.'
                          )
                        }
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                      </SecondaryButton>
                    )}
                  </div>
                </div>
                {example.explanation && (
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{example.explanation}</p>
                )}
                <p className="mt-1 text-xs text-slate-400">
                  Score delta {example.score_delta ?? '—'} · {formatDate(example.created_at)}
                </p>
              </div>
            ))}
          </div>
        )}
        {!canAdminister && examples.length > 0 && (
          <p className="mt-3 text-xs text-slate-400">
            Approving learning examples requires administrator access.
          </p>
        )}
      </AagePanel>

      <AagePanel
        title="Calibration runs"
        description={courseId
          ? `Recent runs in course #${courseId}, from the learning insights summary.`
          : 'Global benchmarks: without a course scope, runs may cover platform-wide calibration cases.'}
        icon={<History className="h-4 w-4 text-indigo-600" />}
      >
        {calibrationRuns.length === 0 ? (
          <EmptyState
            title="No calibration runs yet"
            description="Runs appear here once calibration has been started and the insights summary includes them."
          />
        ) : (
          <div className="space-y-2">
            {calibrationRuns.map((run) => (
              <div
                key={run.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm dark:border-slate-700"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800 dark:text-slate-100">
                    {run.name || `Run #${run.id}`}
                  </span>
                  <StatusBadge status={run.status || 'pending'} />
                  {!courseId && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                      Global benchmark
                    </span>
                  )}
                  {run.decision && <span className="text-xs text-slate-400">{run.decision.replace(/_/g, ' ')}</span>}
                </div>
                <SecondaryButton
                  className="px-2 py-1 text-xs"
                  onClick={() => void loadRun(run.id)}
                  aria-label={`Open calibration run ${run.id}`}
                >
                  View detail
                </SecondaryButton>
              </div>
            ))}
          </div>
        )}

        {selectedRunId !== null && (
          <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-700/40">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                Calibration run #{selectedRunId}
              </span>
              {!courseId && (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                  Global benchmark
                </span>
              )}
              {calibrationDetail && <StatusBadge status={calibrationDetail.status || 'pending'} />}
            </div>
            {detailLoading && <p className="mt-2 text-xs text-slate-500">Loading run detail…</p>}
            {detailError && <p className="mt-2 text-xs text-red-600">{detailError}</p>}
            {calibrationDetail && (
              <>
                <p className="mt-2 text-xs text-slate-500">
                  {formatNumber(calibrationDetail.case_count)} cases ·
                  {' decision: '}{calibrationDetail.decision || 'not recorded'} ·
                  {' '}{formatDate(calibrationDetail.finished_at || calibrationDetail.created_at)}
                </p>
                {calibrationDetail.decision_note && (
                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                    {calibrationDetail.decision_note}
                  </p>
                )}
                {calibrationDetail.metrics && (
                  <div className="mt-3 space-y-3">
                    {Object.entries(calibrationDetail.metrics).map(([section, value]) => {
                      if (value && typeof value === 'object' && !Array.isArray(value)) {
                        return (
                          <div key={section}>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              {section.replace(/_/g, ' ')}
                            </p>
                            <div className="mt-1 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              {Object.entries(value as Record<string, unknown>)
                                .filter(([, metric]) => typeof metric !== 'string')
                                .map(([key, metric]) => (
                                  <div key={key} className="rounded bg-white p-2 dark:bg-slate-800">
                                    <span className="block text-xs text-slate-400">
                                      {key.replace(/_/g, ' ')}
                                    </span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                                      {formatCalibrationMetric(key, metric)}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        );
                      }
                      return (
                        <p key={section} className="text-xs text-slate-600 dark:text-slate-300">
                          {section.replace(/_/g, ' ')}: {formatCalibrationMetric(section, value)}
                        </p>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </AagePanel>

      <div className="grid gap-6 lg:grid-cols-2">
        <AagePanel
          title="Start calibration"
          description="Compare a candidate evaluator version against the active baseline."
          icon={<Scale className="h-4 w-4 text-green-600" />}
        >
          {canAdminister ? (
            <>
              <Field label="Evaluator">
                <select
                  className={inputClass}
                  value={evaluatorName}
                  onChange={(event) => setEvaluatorName(event.target.value)}
                >
                  <option value="">Select an evaluator…</option>
                  {evaluators.map((evaluator) => (
                    <option key={evaluator.name} value={evaluator.name}>{evaluator.name}</option>
                  ))}
                </select>
              </Field>
              <div className="mt-3">
                <Field label="Candidate version ID">
                  <input
                    className={inputClass}
                    type="number"
                    value={candidateVersionId}
                    onChange={(event) => setCandidateVersionId(event.target.value)}
                    placeholder="e.g. 12"
                  />
                </Field>
              </div>
              <div className="mt-3">
                <SecondaryButton
                  disabled={busy || !evaluatorName || !candidateVersionId}
                  onClick={() =>
                    void runAction(
                      () =>
                        AageService.startCalibration({
                          evaluator_name: evaluatorName,
                          candidate_version_id: Number(candidateVersionId),
                          ...(courseId ? { course_id: courseId } : {}),
                        }).then((run) => {
                          setCalibrationDetail(run);
                          setSelectedRunId(run.id);
                        }),
                      'Calibration started.'
                    )
                  }
                >
                  <Sparkles className="h-4 w-4" /> Start calibration
                </SecondaryButton>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Starting calibration requires administrator access. Instructors can review existing runs above.
            </p>
          )}
        </AagePanel>

        <AagePanel
          title="Evaluator version actions"
          description="Approve or roll back a version by ID. Only an ID is required — configuration is never shown."
          icon={<Settings2 className="h-4 w-4 text-slate-500" />}
        >
          {canAdminister ? (
            <>
              <Field label="Evaluator version ID">
                <input
                  className={inputClass}
                  type="number"
                  value={versionActionId}
                  onChange={(event) => setVersionActionId(event.target.value)}
                  placeholder="e.g. 12"
                />
              </Field>
              <div className="mt-3 flex flex-wrap gap-3">
                <SecondaryButton
                  disabled={busy || !versionActionId}
                  onClick={() =>
                    void runAction(
                      () => AageService.approveEvaluatorVersion(Number(versionActionId)),
                      'Evaluator version approved.'
                    )
                  }
                >
                  <CheckCircle2 className="h-4 w-4" /> Approve version
                </SecondaryButton>
                <SecondaryButton
                  className="border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300"
                  disabled={busy || !versionActionId}
                  onClick={() =>
                    void runAction(
                      () => AageService.rollbackEvaluatorVersion(Number(versionActionId)),
                      'Evaluator version rolled back.'
                    )
                  }
                >
                  Rollback
                </SecondaryButton>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Approving or rolling back evaluator versions requires administrator access.
            </p>
          )}

          {canAdminister && policies && (
            <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Grading policies (confidence percentages, 0–100)
              </p>
              <div className="space-y-3 text-sm">
                <label className="flex items-start gap-2 text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={Boolean(policies.auto_publish_enabled)}
                    disabled={busy}
                    onChange={(event) =>
                      void savePolicies({ ...policies, auto_publish_enabled: event.target.checked })
                    }
                  />
                  <span>
                    Auto-publish approved grades
                    <span className="block text-xs text-slate-400">
                      Permits publication without a manual review when every gate passes.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={Boolean(policies.require_all_gates)}
                    disabled={busy}
                    onChange={(event) =>
                      void savePolicies({ ...policies, require_all_gates: event.target.checked })
                    }
                  />
                  <span>
                    Require all gates
                    <span className="block text-xs text-slate-400">
                      When on, a result must pass every gate (rubric approval, review state and
                      the confidence minimum below) before it can be published. Off relaxes the
                      confidence gate; it does not bypass an explicitly required review.
                    </span>
                  </span>
                </label>
                <Field label="Auto-publish minimum (confidence %)">
                  <input
                    className={inputClass}
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={policies.auto_publish_min}
                    onChange={(event) =>
                      setPolicies({ ...policies, auto_publish_min: Number(event.target.value) })
                    }
                    onBlur={() => {
                      if (!policyError) void savePolicies(policies);
                    }}
                  />
                </Field>
                <Field label="Provisional minimum (confidence %)">
                  <input
                    className={inputClass}
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={policies.provisional_min}
                    onChange={(event) =>
                      setPolicies({ ...policies, provisional_min: Number(event.target.value) })
                    }
                    onBlur={() => {
                      if (!policyError) void savePolicies(policies);
                    }}
                  />
                </Field>
                <label className="flex items-start gap-2 text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={Boolean(policies.auto_approve_enabled)}
                    disabled={busy}
                    onChange={(event) =>
                      void savePolicies({ ...policies, auto_approve_enabled: event.target.checked })
                    }
                  />
                  <span>
                    Excel-style auto-approval
                    <span className="block text-xs text-slate-400">
                      Publishes evidenced grades automatically. Low confidence, provisional rubrics,
                      failed checks, conflicts and unverified evidence still go to review.
                    </span>
                  </span>
                </label>
                <Field label="Auto-approve minimum (confidence %)">
                  <input
                    className={inputClass}
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={policies.auto_approve_min}
                    onChange={(event) =>
                      setPolicies({ ...policies, auto_approve_min: Number(event.target.value) })
                    }
                    onBlur={() => {
                      if (!policyError) void savePolicies(policies);
                    }}
                  />
                </Field>
                {policyError && <p className="text-xs text-red-600">{policyError}</p>}
              </div>
            </div>
          )}
        </AagePanel>
      </div>
    </div>
  );
}
