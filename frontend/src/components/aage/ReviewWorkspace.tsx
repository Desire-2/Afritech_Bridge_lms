'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  File,
  Folder,
  History,
  Loader2,
  MessageSquare,
  Save,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { Course } from '@/types/api';
import GradingService from '@/services/grading.service';
import AageService, {
  CriterionScore,
  Evidence,
  GradingHistoryEntry,
  GradingResult,
  Review,
  SubmissionArtifact,
  projectEvidenceForDisplay,
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
  formatPercent,
  inputClass,
} from './shared';

interface FileNode {
  name: string;
  path: string;
  children: FileNode[];
  artifact?: SubmissionArtifact;
}

function buildFileTree(artifacts: SubmissionArtifact[]): FileNode[] {
  const roots: FileNode[] = [];
  artifacts.forEach((artifact) => {
    const segments = (artifact.relative_path || artifact.file_name || 'file').split('/').filter(Boolean);
    let level = roots;
    let currentPath = '';
    segments.forEach((segment, index) => {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      let node = level.find((candidate) => candidate.name === segment);
      if (!node) {
        node = { name: segment, path: currentPath, children: [] };
        level.push(node);
      }
      if (index === segments.length - 1) node.artifact = artifact;
      level = node.children;
    });
  });
  return roots;
}

function FileTree({ nodes }: { nodes: FileNode[] }) {
  if (nodes.length === 0) return null;
  return (
    <ul className="space-y-1 text-xs">
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0;
        return (
          <li key={node.path}>
            <div className="flex items-center gap-1.5 py-0.5 text-slate-700 dark:text-slate-200">
              {hasChildren ? (
                <Folder className="h-3.5 w-3.5 shrink-0 text-blue-500" />
              ) : (
                <File className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              )}
              <span className="truncate" title={node.path}>{node.name}</span>
              {node.artifact?.category && (
                <span className="ml-auto shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-700">
                  {node.artifact.category}
                </span>
              )}
            </div>
            {hasChildren && (
              <div className="ml-3 border-l border-slate-200 pl-2 dark:border-slate-700">
                <FileTree nodes={node.children} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

interface CriterionEdit {
  marks: number;
  reason: string;
}

export default function ReviewWorkspace({
  courses,
  initialReviewId,
}: {
  courses: Course[];
  initialReviewId?: number | null;
}) {
  const [courseId, setCourseId] = useState<number | null>(null);
  const [pending, setPending] = useState<Review[]>([]);
  const [reviewId, setReviewId] = useState<number | null>(initialReviewId ?? null);
  const [review, setReview] = useState<Review | null>(null);
  const [result, setResult] = useState<GradingResult | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [history, setHistory] = useState<GradingHistoryEntry[]>([]);
  const [edits, setEdits] = useState<Record<string, CriterionEdit>>({});
  const [correctionExplanation, setCorrectionExplanation] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPending = useCallback(async () => {
    setLoadingList(true);
    try {
      const response = await AageService.getPendingReviews({ course_id: courseId ?? undefined, per_page: 100 });
      setPending(response.reviews);
      if (!reviewId && response.reviews.length > 0) setReviewId(response.reviews[0].id);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Unable to load pending reviews.');
      setPending([]);
    } finally {
      setLoadingList(false);
    }
  }, [courseId, reviewId]);

  useEffect(() => {
    void loadPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  useEffect(() => {
    if (initialReviewId) setReviewId(initialReviewId);
  }, [initialReviewId]);

  const loadDetail = useCallback(async () => {
    if (!reviewId) {
      setReview(null);
      setResult(null);
      return;
    }
    setLoadingDetail(true);
    setError(null);
    try {
      const reviewData = await AageService.getReview(reviewId);
      setReview(reviewData);
      const resultData = await AageService.getResult(reviewData.result_id);
      setResult(resultData);
      setEvidence(await AageService.getEvidence(reviewData.result_id).catch(() => []));

      const editsInitial: Record<string, CriterionEdit> = {};
      (resultData.criteria || []).forEach((criterion) => {
        editsInitial[criterion.criterion_key] = {
          marks: criterion.awarded,
          reason: '',
        };
      });
      setEdits(editsInitial);
      setCorrectionExplanation('');
      setRejectReason('');

      try {
        setHistory(
          await GradingService.getGradingHistory(
            resultData.submission_type,
            resultData.submission_id
          )
        );
      } catch {
        setHistory([]);
      }
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Unable to load the review.');
      setReview(null);
      setResult(null);
    } finally {
      setLoadingDetail(false);
    }
  }, [reviewId]);

  useEffect(() => {
    void loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewId]);

  const artifacts = useMemo(() => result?.artifacts || [], [result]);
  const fileTree = useMemo(() => buildFileTree(artifacts), [artifacts]);

  const evidenceByCriterion = useMemo(() => {
    const map: Record<string, Evidence[]> = {};
    evidence.forEach((item) => {
      if (!item.criterion_key) return;
      map[item.criterion_key] = [...(map[item.criterion_key] || []), item];
    });
    return map;
  }, [evidence]);

  const updateEdit = (key: string, patch: Partial<CriterionEdit>) => {
    setEdits((current) => ({
      ...current,
      [key]: { ...(current[key] || { marks: 0, reason: '' }), ...patch },
    }));
  };

  const runReviewAction = async (
    action: 'mark' | 'correction' | 'approve' | 'reject',
    criterion?: CriterionScore
  ) => {
    if (!review) return;
    setBusy(true);
    setError(null);
    try {
      if (action === 'mark' && criterion) {
        const edit = edits[criterion.criterion_key];
        if (!edit || !edit.reason.trim()) {
          toast.error('Provide a reason before saving a mark correction.');
          return;
        }
        await AageService.updateCriterionMark(review.id, criterion.criterion_key, {
          marks: edit.marks,
          reason: edit.reason,
        });
        toast.success('Mark correction saved.');
      } else if (action === 'correction') {
        if (!correctionExplanation.trim()) {
          toast.error('Explain the correction before submitting it.');
          return;
        }
        await AageService.submitCorrection(review.id, correctionExplanation.trim());
        toast.success('Correction submitted for learning.');
      } else if (action === 'approve') {
        await AageService.approveReview(review.id);
        toast.success('Review approved.');
      } else if (action === 'reject') {
        if (!rejectReason.trim()) {
          toast.error('A rejection reason is required.');
          return;
        }
        await AageService.rejectReview(review.id, rejectReason.trim());
        toast.success('Review rejected.');
      }
      await Promise.all([loadDetail(), loadPending()]);
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message || 'Unable to complete the review action.';
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <AagePanel
        title="Review Workspace"
        description="Inspect an AI evaluation, correct criterion marks with a reason, then approve or reject it."
        icon={<ShieldCheck className="h-4 w-4 text-green-600" />}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Course filter">
            <select
              className={inputClass}
              value={courseId ?? ''}
              onChange={(event) => {
                setCourseId(event.target.value ? Number(event.target.value) : null);
                setReviewId(null);
              }}
            >
              <option value="">All courses</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>{course.title}</option>
              ))}
            </select>
          </Field>
          <Field label="Pending review">
            <select
              className={inputClass}
              value={reviewId ?? ''}
              onChange={(event) => setReviewId(event.target.value ? Number(event.target.value) : null)}
            >
              <option value="">Select a review…</option>
              {pending.map((item) => (
                <option key={item.id} value={item.id}>
                  Review #{item.id} · Result #{item.result_id}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {loadingList && <p className="mt-3 text-xs text-slate-500">Loading pending reviews…</p>}
        {!loadingList && pending.length === 0 && (
          <div className="mt-4">
            <EmptyState title="No pending reviews" description="Reviews requiring instructor decisions appear here." />
          </div>
        )}
        {error && (
          <div className="mt-4"><ErrorState message={error} onRetry={() => void (reviewId ? loadDetail() : loadPending())} /></div>
        )}
      </AagePanel>

      {loadingDetail && (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
      )}

      {review && result && !loadingDetail && (
        <>
          <div className="grid gap-6 lg:grid-cols-3">
            <AagePanel title="Submission" description="Files submitted by this student only.">
              <div className="space-y-2 text-sm">
                <p className="text-slate-700 dark:text-slate-200">
                  <span className="text-slate-400">Submission:</span> #{result.submission_id} ({result.submission_type})
                </p>
                <p className="text-slate-700 dark:text-slate-200">
                  <span className="text-slate-400">Assessment:</span> #{result.assessment_id}
                </p>
                <p className="text-slate-700 dark:text-slate-200">
                  <span className="text-slate-400">Review opened:</span> {formatDate(review.opened_at)}
                </p>
              </div>
              <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Artifact tree
                </p>
                {artifacts.length === 0 ? (
                  <EmptyState title="No file artifacts" />
                ) : (
                  <FileTree nodes={fileTree} />
                )}
              </div>
            </AagePanel>

            <AagePanel
              title="AI evaluation summary"
              description="Instructor-facing values only."
              className="lg:col-span-2"
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-700/40">
                  <p className="text-xs text-slate-500">AI score</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {formatPercent(review.ai_score ?? result.final_score)}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-700/40">
                  <p className="text-xs text-slate-500">Confidence</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {formatPercent(result.confidence, 0)}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-700/40">
                  <p className="text-xs text-slate-500">Status</p>
                  <div className="mt-1"><StatusBadge status={review.status} /></div>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Evaluator(s)</p>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                    {(result.evaluator_versions || []).join(', ') || 'Not recorded'}
                  </p>
                </div>
                {result.review_reason && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Review reason
                    </p>
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                      {result.review_reason}
                    </p>
                  </div>
                )}
              </div>
              {result.feedback && (
                <div className="mt-4 rounded-lg border border-slate-200 p-4 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Feedback</p>
                  {result.feedback}
                </div>
              )}
            </AagePanel>
          </div>

          <AagePanel
            title="Criterion scores"
            description="Enter a corrected mark and a mandatory reason. Evidence is scoped to this student's submission."
            icon={<MessageSquare className="h-4 w-4 text-blue-600" />}
          >
            {(result.criteria || []).length === 0 ? (
              <EmptyState title="No criterion scores" />
            ) : (
              <div className="space-y-4">
                {result.criteria!.map((criterion) => {
                  const edit = edits[criterion.criterion_key] || {
                    marks: criterion.awarded,
                    reason: '',
                  };
                  const criterionEvidence = evidenceByCriterion[criterion.criterion_key] || criterion.evidence || [];
                  return (
                    <div key={criterion.criterion_key} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {criterion.name}
                          </h4>
                          <p className="text-xs text-slate-500">
                            Awarded {criterion.awarded}/{criterion.maximum} · weight {criterion.weight ?? '—'}%
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <StatusBadge status={criterion.evidence_category || 'unverified'} />
                          <StatusBadge status={criterion.verification_status || 'unverified'} />
                        </div>
                      </div>

                      {criterion.rationale && (
                        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                          {criterion.rationale}
                        </p>
                      )}

                      {criterionEvidence.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Evidence
                          </p>
                          {criterionEvidence.map((item) => {
                            const shown = projectEvidenceForDisplay(item);
                            return (
                              <div key={item.id} className="rounded-md bg-slate-50 p-3 text-xs dark:bg-slate-700/40">
                                <div className="flex flex-wrap items-center gap-2">
                                  <StatusBadge status={shown.status} />
                                  <span className="text-slate-500 dark:text-slate-400">
                                    Requirement: {shown.requirementId ?? 'not linked'}
                                  </span>
                                  {shown.confidence !== null && (
                                    <span className="text-slate-400">
                                      · confidence {Math.round(shown.confidence * 100)}%
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1.5 text-slate-700 dark:text-slate-200">{shown.summary}</p>
                                {shown.details.length > 0 && (
                                  <ul className="mt-1.5 space-y-0.5 text-slate-500 dark:text-slate-400">
                                    {shown.details.map((detail, index) => (
                                      <li key={index}>• {detail}</li>
                                    ))}
                                  </ul>
                                )}
                                {shown.missing.length > 0 && (
                                  <p className="mt-1.5 text-amber-700 dark:text-amber-300">
                                    <span className="font-semibold">Missing:</span> {shown.missing.join('; ')}
                                  </p>
                                )}
                                {shown.fix && (
                                  <p className="mt-1 text-blue-700 dark:text-blue-300">
                                    <span className="font-semibold">Fix:</span> {shown.fix}
                                  </p>
                                )}
                                {(shown.reference || shown.locator || shown.source) && (
                                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-slate-500 dark:text-slate-400">
                                    {shown.reference && <span>File: {shown.reference}</span>}
                                    {shown.locator && <span>Locator: {shown.locator}</span>}
                                    {shown.source && <span>Source: {shown.source}</span>}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="mt-4 grid gap-3 md:grid-cols-[140px_1fr_auto]">
                        <Field label="Corrected mark">
                          <input
                            type="number"
                            min={0}
                            max={criterion.maximum || undefined}
                            step={0.5}
                            className={inputClass}
                            value={edit.marks}
                            onChange={(event) =>
                              updateEdit(criterion.criterion_key, { marks: Number(event.target.value) })
                            }
                          />
                        </Field>
                        <Field label="Reason for correction">
                          <input
                            className={inputClass}
                            placeholder="Explain why the mark changed…"
                            value={edit.reason}
                            onChange={(event) =>
                              updateEdit(criterion.criterion_key, { reason: event.target.value })
                            }
                          />
                        </Field>
                        <div className="flex items-end">
                          <SecondaryButton
                            className="text-xs"
                            disabled={busy}
                            onClick={() => void runReviewAction('mark', criterion)}
                          >
                            <Save className="h-3.5 w-3.5" /> Save mark
                          </SecondaryButton>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </AagePanel>

          <div className="grid gap-6 lg:grid-cols-2">
            <AagePanel
              title="Submit correction"
              description="Approved corrections may become learning examples after your explicit approval."
            >
              <Field label="Correction explanation">
                <textarea
                  className={`${inputClass} min-h-24`}
                  value={correctionExplanation}
                  onChange={(event) => setCorrectionExplanation(event.target.value)}
                  placeholder="Describe what the AI missed and why your marks are more accurate…"
                />
              </Field>
              <div className="mt-3">
                <SecondaryButton
                  disabled={busy || !correctionExplanation.trim()}
                  onClick={() => void runReviewAction('correction')}
                >
                  <Save className="h-4 w-4" /> Submit correction
                </SecondaryButton>
              </div>
            </AagePanel>

            <AagePanel title="Decision" description="Approve publishes the reviewed grade; rejection returns it for rework.">
              <Field label="Rejection reason (required to reject)">
                <textarea
                  className={`${inputClass} min-h-20`}
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                  placeholder="Explain why this evaluation cannot be accepted…"
                />
              </Field>
              <div className="mt-3 flex flex-wrap gap-3">
                <PrimaryButton
                  className="bg-green-600 hover:bg-green-700"
                  disabled={busy}
                  onClick={() => void runReviewAction('approve')}
                >
                  <CheckCircle2 className="h-4 w-4" /> Approve
                </PrimaryButton>
                <SecondaryButton
                  className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300"
                  disabled={busy || !rejectReason.trim()}
                  onClick={() => void runReviewAction('reject')}
                >
                  <XCircle className="h-4 w-4" /> Reject
                </SecondaryButton>
              </div>
            </AagePanel>
          </div>

          <AagePanel
            title="Grading history"
            description="Prior grading events for this submission."
            icon={<History className="h-4 w-4 text-slate-500" />}
          >
            {history.length === 0 ? (
              <EmptyState title="No prior grading history" />
            ) : (
              <ul className="space-y-2">
                {history.map((entry, index) => (
                  <li key={entry.id ?? index} className="rounded-md border border-slate-200 p-3 text-sm dark:border-slate-700">
                    <div className="flex justify-between gap-3">
                      <span className="font-medium text-slate-800 dark:text-slate-100">
                        {entry.action || 'Grading event'}
                      </span>
                      <span className="text-xs text-slate-400">{formatDate(entry.created_at)}</span>
                    </div>
                    {entry.note && <p className="mt-1 text-xs text-slate-500">{entry.note}</p>}
                  </li>
                ))}
              </ul>
            )}
          </AagePanel>
        </>
      )}
    </div>
  );
}
