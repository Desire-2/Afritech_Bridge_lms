'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  FileText,
  History,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Course } from '@/types/api';
import CourseCreationService from '@/services/course-creation.service';
import AageService, {
  AageError,
  AssessmentKind,
  EvaluatorConfig,
  EvaluatorRecommendation,
  PerformanceLevel,
  Rubric,
  RubricCriterion,
  RubricUpdate,
  RubricVersion,
  isAageNotFound,
  validateWeights,
} from '@/services/aage.service';
import {
  AagePanel,
  EmptyState,
  ErrorState,
  Field,
  PrimaryButton,
  SecondaryButton,
  StatusBadge,
  formatDate,
  inputClass,
} from './shared';

interface AssessmentOption {
  id: number;
  title: string;
}

interface Overview {
  assignments: AssessmentOption[];
  projects: AssessmentOption[];
}

function evaluatorName(value: EvaluatorRecommendation | string): string {
  return typeof value === 'string' ? value : value.name;
}

/** Canonical bands live on each criterion; both API aliases stay in sync. */
function criterionLevels(criterion: RubricCriterion | undefined): PerformanceLevel[] {
  if (!criterion) return [];
  return criterion.levels || criterion.performance_levels || [];
}

export default function RubricBuilder({ courses }: { courses: Course[] }) {
  const [courseId, setCourseId] = useState<number | null>(null);
  const [overview, setOverview] = useState<Overview>({ assignments: [], projects: [] });
  const [kind, setKind] = useState<AssessmentKind>('assignment');
  const [assessmentId, setAssessmentId] = useState<number | null>(null);
  const [rubric, setRubric] = useState<Rubric | null>(null);
  const [versions, setVersions] = useState<RubricVersion[]>([]);
  const [evaluators, setEvaluators] = useState<EvaluatorConfig[]>([]);
  const [selectedEvaluators, setSelectedEvaluators] = useState<string[]>([]);
  const [levelCriterionIndex, setLevelCriterionIndex] = useState(0);
  const [forkSourceId, setForkSourceId] = useState<number | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assessments = kind === 'assignment' ? overview.assignments : overview.projects;
  const selectedLevelIndex = Math.min(
    levelCriterionIndex,
    Math.max(0, (rubric?.criteria?.length || 1) - 1)
  );

  const weightCheck = useMemo(
    () => validateWeights(rubric?.criteria || []),
    [rubric?.criteria]
  );

  useEffect(() => {
    // Instructors must never hit the admin-only evaluator catalogue.
    AageService.getInstructorEvaluators()
      .then(setEvaluators)
      .catch(() => setEvaluators([]));
  }, []);

  useEffect(() => {
    if (!courseId) {
      setOverview({ assignments: [], projects: [] });
      return;
    }
    let active = true;
    setOverviewLoading(true);
    CourseCreationService.getAssessmentsOverview(courseId)
      .then((data) => {
        if (!active) return;
        setOverview({
          assignments: (data?.assignments || []).map((item) => ({
            id: item.id,
            title: (item as unknown as { title?: string }).title || `Assignment ${item.id}`,
          })),
          projects: (data?.projects || []).map((item) => ({
            id: item.id,
            title: (item as unknown as { title?: string }).title || `Project ${item.id}`,
          })),
        });
      })
      .catch(() => {
        if (active) setOverview({ assignments: [], projects: [] });
      })
      .finally(() => {
        if (active) setOverviewLoading(false);
      });
    return () => {
      active = false;
    };
  }, [courseId]);

  useEffect(() => {
    setAssessmentId(null);
    setRubric(null);
    setVersions([]);
    setLevelCriterionIndex(0);
    setForkSourceId(null);
    setError(null);
  }, [kind, courseId]);

  const loadRubric = async (selectedId: number) => {
    setLoading(true);
    setError(null);
    try {
      const [rubricData, versionData] = await Promise.all([
        AageService.getRubric(kind, selectedId),
        AageService.getRubricVersions(kind, selectedId).catch(() => []),
      ]);
      setRubric(rubricData);
      setVersions(versionData);
      setLevelCriterionIndex(0);
      setForkSourceId(rubricData.parent_rubric_id ?? null);
      setSelectedEvaluators(
        (rubricData.evaluator_recommendations || []).map(evaluatorName).filter(Boolean)
      );
    } catch (err: unknown) {
      // No rubric yet is a normal state, not a failure state.
      setRubric(null);
      setVersions([]);
      // Typed not_found is the normal "no rubric yet" state. Decide by code,
      // never by matching backend prose.
      if (!isAageNotFound(err)) {
        setError((err as { message?: string })?.message || 'Unable to load the rubric.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!assessmentId) return;
    void loadRubric(assessmentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId, kind]);

  const updateCriterion = (index: number, patch: Partial<RubricCriterion>) => {
    setRubric((current) => {
      if (!current) return current;
      const criteria = [...(current.criteria || [])];
      criteria[index] = { ...criteria[index], ...patch };
      return { ...current, criteria };
    });
  };

  const removeCriterion = (index: number) => {
    setRubric((current) => {
      if (!current) return current;
      return { ...current, criteria: (current.criteria || []).filter((_, i) => i !== index) };
    });
  };

  const addCriterion = () => {
    setRubric((current) => {
      if (!current) return current;
      const key = `criterion_${Date.now()}`;
      const criteria = [
        ...(current.criteria || []),
        {
          criterion_key: key,
          key,
          name: 'New criterion',
          weight: 0,
          max_marks: 10,
          max_points: 10,
          is_required: true,
        } as RubricCriterion,
      ];
      return { ...current, criteria };
    });
  };

  const updateCriterionLevel = (
    criterionIndex: number,
    levelIndex: number,
    patch: Partial<PerformanceLevel>
  ) => {
    setRubric((current) => {
      if (!current) return current;
      const criteria = [...(current.criteria || [])];
      const criterion = criteria[criterionIndex];
      if (!criterion) return current;
      const levels = [...criterionLevels(criterion)];
      if (!levels[levelIndex]) return current;
      levels[levelIndex] = { ...levels[levelIndex], ...patch };
      criteria[criterionIndex] = { ...criterion, levels, performance_levels: levels };
      return { ...current, criteria };
    });
  };

  const addCriterionLevel = (criterionIndex: number) => {
    setRubric((current) => {
      if (!current) return current;
      const criteria = [...(current.criteria || [])];
      const criterion = criteria[criterionIndex];
      if (!criterion) return current;
      const levels = [
        ...criterionLevels(criterion),
        { label: 'New level', min_score: 0, max_score: 100 },
      ];
      criteria[criterionIndex] = { ...criterion, levels, performance_levels: levels };
      return { ...current, criteria };
    });
  };

  const handleGenerate = async () => {
    if (!assessmentId) return;
    setGenerating(true);
    setError(null);
    try {
      const generated = await AageService.generateRubric(kind, assessmentId);
      setRubric(generated);
      setLevelCriterionIndex(0);
      setForkSourceId(generated.parent_rubric_id ?? null);
      setSelectedEvaluators(
        (generated.evaluator_recommendations || []).map(evaluatorName).filter(Boolean)
      );
      setVersions(
        await AageService.getRubricVersions(kind, assessmentId).catch(() => [])
      );
      toast.success('AI rubric generated. Review and approve it before use.');
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Unable to generate the rubric.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!rubric) return;
    if (!weightCheck.valid) {
      setError(weightCheck.message);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Bands are written to each criterion under both aliases. No rubric-level
      // performance_levels are sent: that would recreate the ambiguous source
      // of truth the backend normalises away.
      const criteria = (rubric.criteria || []).map((criterion) => {
        const levels = criterionLevels(criterion);
        return { ...criterion, levels, performance_levels: levels };
      });
      const payload: RubricUpdate = {
        title: rubric.title ?? rubric.name,
        summary: rubric.summary,
        criteria,
        evaluator_recommendations: selectedEvaluators,
      };
      const originalId = rubric.id;
      let saved: Rubric;
      try {
        saved = await AageService.updateRubric(originalId, payload);
      } catch (err: unknown) {
        const code = err instanceof AageError
          ? err.code
          : (err as { code?: string })?.code;
        if (code !== 'rubric_graded_locked') throw err;

        const details = err instanceof AageError ? err.details : (err as { details?: unknown }).details;
        const gradedCount = Array.isArray(details)
          ? (details[0] as { graded_results?: number } | undefined)?.graded_results
          : undefined;
        const explanation = gradedCount
          ? `This rubric has ${gradedCount} graded submission(s) or is approved. Saving will fork a new draft; the original rubric and its graded results stay unchanged.`
          : 'This rubric is approved or already used by graded submissions. Saving will fork a new draft; the original rubric and its graded results stay unchanged.';
        if (!window.confirm(`${explanation}\n\nContinue and create a fork?`)) {
          setError('Save cancelled; nothing was changed.');
          return;
        }
        saved = await AageService.updateRubric(originalId, {
          ...payload,
          acknowledge_graded: true,
        });
        setForkSourceId(originalId);
      }
      setRubric(saved);
      if (saved.id !== originalId) setForkSourceId(originalId);
      setLevelCriterionIndex(0);
      setVersions(await AageService.getRubricVersions(kind, assessmentId!).catch(() => []));
      toast.success(
        saved.id !== originalId
          ? `New draft #${saved.id} created; rubric #${originalId} was left unchanged.`
          : 'Rubric saved.'
      );
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Unable to save the rubric.');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!rubric || rubric.status === 'approved') return;
    if (!weightCheck.valid) {
      setError(weightCheck.message);
      return;
    }
    setApproving(true);
    setError(null);
    try {
      const approved = await AageService.approveRubric(rubric.id);
      setRubric(approved);
      setVersions(await AageService.getRubricVersions(kind, assessmentId!).catch(() => []));
      toast.success('Rubric approved and version snapshotted.');
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Unable to approve the rubric.');
    } finally {
      setApproving(false);
    }
  };

  const toggleEvaluator = (name: string) => {
    setSelectedEvaluators((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name]
    );
  };

  return (
    <div className="space-y-6">
      <AagePanel
        title="Rubric Builder"
        description="Generate a rubric from the assessment brief, then edit criteria and weights before approval."
        icon={<FileText className="h-4 w-4 text-blue-600" />}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Course">
            <select
              value={courseId ?? ''}
              onChange={(event) => setCourseId(event.target.value ? Number(event.target.value) : null)}
              className={inputClass}
            >
              <option value="">Select a course…</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Assessment type">
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as AssessmentKind)}
              className={inputClass}
            >
              <option value="assignment">Assignment</option>
              <option value="project">Project</option>
            </select>
          </Field>
          <Field label="Assessment">
            <select
              value={assessmentId ?? ''}
              disabled={!courseId || overviewLoading}
              onChange={(event) => setAssessmentId(event.target.value ? Number(event.target.value) : null)}
              className={inputClass}
            >
              <option value="">
                {overviewLoading ? 'Loading assessments…' : 'Select an assessment…'}
              </option>
              {assessments.map((assessment) => (
                <option key={assessment.id} value={assessment.id}>
                  {assessment.title}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {error && (
          <div className="mt-4">
            <ErrorState message={error} onRetry={() => assessmentId && void loadRubric(assessmentId)} />
          </div>
        )}

        {!courseId && (
          <EmptyState title="Choose a course" description="Select a course to generate or edit a rubric." />
        )}

        {courseId && !assessmentId && (
          <EmptyState
            title="Choose an assessment"
            description={assessments.length === 0 ? 'No assignments/projects were found for this course.' : undefined}
          />
        )}

        {assessmentId && loading && <Loader2 className="mx-auto my-8 h-6 w-6 animate-spin text-blue-600" />}

        {assessmentId && !loading && !rubric && (
          <div className="mt-6 rounded-lg border border-dashed border-slate-300 p-8 text-center dark:border-slate-600">
            <Sparkles className="mx-auto h-8 w-8 text-purple-500" />
            <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
              No rubric for this assessment yet
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Generate a draft from the assessment brief, then review every criterion.
            </p>
            <div className="mt-4">
              <PrimaryButton onClick={handleGenerate} disabled={generating}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generating ? 'Generating…' : 'Generate AI rubric'}
              </PrimaryButton>
            </div>
          </div>
        )}
      </AagePanel>

      {rubric && (
        <>
          <AagePanel
            title="Criteria & weights"
            description="Weights must total exactly 100%. The rubric cannot be saved or approved until they do."
            action={
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={rubric.status || 'draft'} />
                {forkSourceId !== null && (
                  <span className="text-[11px] text-amber-700 dark:text-amber-300">
                    Draft forked from rubric #{forkSourceId} · original kept unchanged
                  </span>
                )}
                <SecondaryButton onClick={() => setShowPreview((value) => !value)}>
                  <Eye className="h-4 w-4" /> {showPreview ? 'Hide preview' : 'Preview'}
                </SecondaryButton>
              </div>
            }
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-700/40">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-600 dark:text-slate-300">Σ weights</span>
                <span
                  className={`text-lg font-bold ${weightCheck.valid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                >
                  {weightCheck.total}%
                </span>
                {weightCheck.valid ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                )}
              </div>
              <p className={`text-xs ${weightCheck.valid ? 'text-green-600' : 'text-red-600'}`}>
                {weightCheck.message}
              </p>
            </div>

            {showPreview ? (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {rubric.title || rubric.name || 'Rubric preview'}
                </h4>
                {rubric.summary && (
                  <p className="text-sm text-slate-600 dark:text-slate-300">{rubric.summary}</p>
                )}
                <ul className="divide-y divide-slate-100 rounded-lg border dark:divide-slate-700 dark:border-slate-700">
                  {(rubric.criteria || []).map((criterion, index) => (
                    <li key={criterion.criterion_key || index} className="flex justify-between p-3 text-sm">
                      <span className="text-slate-800 dark:text-slate-100">{criterion.name}</span>
                      <span className="font-medium text-slate-600 dark:text-slate-300">
                        {criterion.weight}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="space-y-4">
                {(rubric.criteria || []).map((criterion, index) => (
                  <div
                    key={criterion.criterion_key || index}
                    className="rounded-lg border border-slate-200 p-4 dark:border-slate-700"
                  >
                    <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto]">
                      <Field label="Criterion">
                        <input
                          className={inputClass}
                          value={criterion.name}
                          onChange={(event) => updateCriterion(index, { name: event.target.value })}
                        />
                      </Field>
                      <Field label="Max marks">
                        <input
                          type="number"
                          min={0.5}
                          step={0.5}
                          className={inputClass}
                          value={criterion.max_marks ?? criterion.max_points ?? 10}
                          onChange={(event) => {
                            const maxMarks = Number(event.target.value);
                            updateCriterion(index, {
                              max_marks: maxMarks,
                              max_points: maxMarks,
                            });
                          }}
                        />
                      </Field>
                      <Field label="Weight (%)">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          className={inputClass}
                          value={criterion.weight ?? 0}
                          onChange={(event) =>
                            updateCriterion(index, { weight: Number(event.target.value) })
                          }
                        />
                      </Field>
                      <Field label="Requirement">
                        <select
                          className={inputClass}
                          value={criterion.is_required === false ? 'optional' : 'required'}
                          onChange={(event) =>
                            updateCriterion(index, { is_required: event.target.value === 'required' })
                          }
                        >
                          <option value="required">Required</option>
                          <option value="optional">Optional</option>
                        </select>
                      </Field>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => removeCriterion(index)}
                          className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                          aria-label={`Remove ${criterion.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <Field label="Evidence requirements (comma separated)">
                        <input
                          className={inputClass}
                          placeholder="e.g. CODE_SUPPORTED, CONTENT_SUPPORTED"
                          value={(criterion.evidence_requirements || [])
                            .map((requirement) =>
                              typeof requirement === 'string' ? requirement : requirement.category || ''
                            )
                            .filter(Boolean)
                            .join(', ')}
                          onChange={(event) =>
                            updateCriterion(index, {
                              evidence_requirements: event.target.value
                                .split(',')
                                .map((value) => value.trim())
                                .filter(Boolean),
                            })
                          }
                        />
                      </Field>
                      <Field label="Evaluator hint">
                        <input
                          className={inputClass}
                          value={criterion.evaluator_hint || ''}
                          onChange={(event) =>
                            updateCriterion(index, { evaluator_hint: event.target.value })
                          }
                          placeholder="e.g. frontend"
                        />
                      </Field>
                    </div>
                  </div>
                ))}
                <SecondaryButton onClick={addCriterion}>
                  <Plus className="h-4 w-4" /> Add criterion
                </SecondaryButton>
              </div>
            )}
          </AagePanel>

          <AagePanel
            title="Performance levels"
            description="Bands belong to one criterion at a time. Both API aliases are saved from this editor."
          >
            {(rubric.criteria || []).length === 0 ? (
              <EmptyState
                title="No criteria to edit"
                description="Add a criterion before defining its performance bands."
              />
            ) : (
              <>
                <Field label="Criterion">
                  <select
                    className={inputClass}
                    value={selectedLevelIndex}
                    onChange={(event) => setLevelCriterionIndex(Number(event.target.value))}
                  >
                    {(rubric.criteria || []).map((criterion, index) => (
                      <option key={criterion.criterion_key || index} value={index}>
                        {criterion.name || `Criterion ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </Field>
                {criterionLevels(rubric.criteria![selectedLevelIndex]).length === 0 ? (
                  <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                    No bands for this criterion yet.
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {criterionLevels(rubric.criteria![selectedLevelIndex]).map((level, index) => (
                      <div key={index} className="grid gap-3 md:grid-cols-4">
                        <Field label="Label">
                          <input
                            className={inputClass}
                            value={level.label}
                            onChange={(event) =>
                              updateCriterionLevel(selectedLevelIndex, index, { label: event.target.value })
                            }
                          />
                        </Field>
                        <Field label="Min score (%)">
                          <input
                            type="number"
                            className={inputClass}
                            value={level.min_score ?? 0}
                            onChange={(event) =>
                              updateCriterionLevel(selectedLevelIndex, index, {
                                min_score: Number(event.target.value),
                              })
                            }
                          />
                        </Field>
                        <Field label="Max score (%)">
                          <input
                            type="number"
                            className={inputClass}
                            value={level.max_score ?? 100}
                            onChange={(event) =>
                              updateCriterionLevel(selectedLevelIndex, index, {
                                max_score: Number(event.target.value),
                              })
                            }
                          />
                        </Field>
                        <Field label="Description">
                          <input
                            className={inputClass}
                            value={level.description || ''}
                            onChange={(event) =>
                              updateCriterionLevel(selectedLevelIndex, index, {
                                description: event.target.value,
                              })
                            }
                          />
                        </Field>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3">
                  <SecondaryButton onClick={() => addCriterionLevel(selectedLevelIndex)}>
                    <Plus className="h-4 w-4" /> Add level to this criterion
                  </SecondaryButton>
                </div>
              </>
            )}
          </AagePanel>

          <AagePanel
            title="Evaluator selection"
            description="Choose which evaluators may contribute to grading. Only names and aggregate status are shown."
          >
            {evaluators.length === 0 ? (
              <EmptyState title="No evaluators available" />
            ) : (
              <div className="flex flex-wrap gap-3">
                {evaluators.map((evaluator) => (
                  <label
                    key={evaluator.name}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                      selectedEvaluators.includes(evaluator.name)
                        ? 'border-blue-400 bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
                        : 'border-slate-200 text-slate-700 dark:border-slate-600 dark:text-slate-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedEvaluators.includes(evaluator.name)}
                      onChange={() => toggleEvaluator(evaluator.name)}
                    />
                    {evaluator.name}
                    {!evaluator.active && <span className="text-[11px] text-amber-600">(inactive)</span>}
                  </label>
                ))}
              </div>
            )}
          </AagePanel>

          <div className="flex flex-wrap gap-3">
            <PrimaryButton onClick={handleSave} disabled={saving || !weightCheck.valid}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save rubric
            </PrimaryButton>
            <PrimaryButton
              onClick={handleApprove}
              disabled={approving || !weightCheck.valid || rubric.status === 'approved'}
              className="bg-green-600 hover:bg-green-700"
            >
              {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Approve rubric
            </PrimaryButton>
            <SecondaryButton onClick={handleGenerate} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Regenerate draft
            </SecondaryButton>
          </div>

          <AagePanel
            title="Version history"
            description="Each approval snapshots an immutable rubric version."
            icon={<History className="h-4 w-4 text-slate-500" />}
          >
            {versions.length === 0 ? (
              <EmptyState title="No versions yet" description="Approve the rubric to create the first snapshot." />
            ) : (
              <div className="space-y-2">
                {versions.map((version) => (
                  <div
                    key={version.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm dark:border-slate-700"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        v{version.version}
                      </span>
                      <StatusBadge status={version.change_note || 'snapshot'} />
                    </div>
                    <div className="text-xs text-slate-500">
                      Weights {version.weight_total ?? '—'}% · {formatDate(version.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AagePanel>
        </>
      )}
    </div>
  );
}
