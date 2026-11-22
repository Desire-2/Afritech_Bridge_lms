"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Lightbulb,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { UnauthorizedAccess } from '@/components/guards/UnauthorizedAccess';
import AageService, {
  GradingOutcome,
  RecommendedResource,
  StudentPublishedResult,
  SubmissionType,
  classifyStudentAageError,
  deriveGradingOutcome,
} from '@/services/aage.service';

type ViewState = 'loading' | 'published' | 'pending' | 'not_found' | 'error';

interface SafeCriterion {
  name: string;
  awarded: number;
  maximum: number;
  feedback?: string | null;
}

/**
 * Whitelist the fields that are safe to show a student. Even if the API
 * accidentally returns instructor internals (rationale, evidence, evaluator
 * config, confidence, other students' data), none of it can reach this view.
 */
function projectForStudent(raw: StudentPublishedResult) {
  const criteria: SafeCriterion[] = Array.isArray(raw.criteria)
    ? raw.criteria
        .filter((item) => item && typeof item.name === 'string')
        .map((item) => ({
          name: item.name,
          awarded: Number(item.awarded) || 0,
          maximum: Number(item.maximum) || 0,
          feedback: typeof item.feedback === 'string' ? item.feedback : null,
        }))
    : [];

  const resources: RecommendedResource[] = Array.isArray(raw.recommended_resources)
    ? raw.recommended_resources
        .filter((item) => item && typeof item.title === 'string')
        .map((item) => ({
          title: item.title,
          url: typeof item.url === 'string' ? item.url : undefined,
          type: typeof item.type === 'string' ? item.type : undefined,
          description: typeof item.description === 'string' ? item.description : undefined,
        }))
    : [];

  const strings = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];

  return {
    assessmentTitle:
      typeof raw.assessment_title === 'string' ? raw.assessment_title : 'Your submission',
    courseTitle: typeof raw.course_title === 'string' ? raw.course_title : null,
    publishedAt: typeof raw.published_at === 'string' ? raw.published_at : null,
    finalScore: typeof raw.final_score === 'number' ? raw.final_score : null,
    gradeLetter: typeof raw.grade_letter === 'string' ? raw.grade_letter : null,
    pointsAwarded: typeof raw.points_awarded === 'number' ? raw.points_awarded : undefined,
    totalPossible: typeof raw.total_possible === 'number' ? raw.total_possible : null,
    feedback: typeof raw.feedback === 'string' ? raw.feedback : null,
    strengths: strings(raw.strengths),
    improvements: strings(raw.improvements),
    resources,
    criteria,
  };
}

export default function StudentResultPage() {
  const params = useParams();
  const { user, isLoading: authLoading } = useAuth();
  const submissionIdRaw = params?.submissionId;
  const submissionId = Number(Array.isArray(submissionIdRaw) ? submissionIdRaw[0] : submissionIdRaw);

  const [view, setView] = useState<ViewState>('loading');
  const [result, setResult] = useState<ReturnType<typeof projectForStudent> | null>(null);
  const [outcome, setOutcome] = useState<GradingOutcome | null>(null);
  const [submissionType, setSubmissionType] = useState<SubmissionType | undefined>(undefined);

  const load = useCallback(async () => {
    if (!Number.isFinite(submissionId)) {
      setView('not_found');
      return;
    }
    setView('loading');
    setResult(null);
    setOutcome(null);
    try {
      // Only the student-safe endpoint is used. Instructor endpoints that
      // return AI internals or other students' data are never called here.
      const rawType = new URLSearchParams(window.location.search).get('type');
      const safeType: SubmissionType | undefined =
        rawType === 'assignment' || rawType === 'project' ? rawType : undefined;
      setSubmissionType(safeType);
      const raw = await AageService.getStudentPublishedResult(submissionId, safeType);
      const isPublished =
        raw && (raw.is_official === true || raw.status === 'published') && raw.final_score !== undefined;
      if (!isPublished) {
        setView('pending');
        return;
      }
      // Student endpoint does not expose a passing threshold, so pass/fail is
      // only shown when the real payload contains one. Progression is derived
      // from the published status rather than guessed from the score.
      setOutcome(deriveGradingOutcome(raw));
      setResult(projectForStudent(raw));
      setView('published');
    } catch (err: unknown) {
      // Classify by structured code/status only. Raw backend messages can
      // contain internals and must never be shown to a student.
      const kind = classifyStudentAageError(err);
      if (kind === 'not_found' || kind === 'forbidden') {
        setView('not_found');
      } else {
        // A missing student endpoint or a still-processing result both render
        // as a friendly "under review" state rather than a raw error.
        setView('pending');
      }
    }
  }, [submissionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const scoreLabel = useMemo(() => {
    if (!result) return null;
    if (result.finalScore !== null) return `${result.finalScore.toFixed(1)}%`;
    if (result.totalPossible && result.pointsAwarded !== undefined) {
      return `${result.pointsAwarded} / ${result.totalPossible}`;
    }
    return null;
  }, [result]);

  if (authLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (user && user.role !== 'student') {
    return <UnauthorizedAccess requiredRole="student" pageName="student result page" />;
  }

  const historyHref = `/student/results/${submissionId}/history${
    submissionType ? `?type=${encodeURIComponent(submissionType)}` : ''
  }`;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/student/assignments"
          className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-blue-600 dark:text-slate-300"
        >
          <ArrowLeft className="h-4 w-4" /> Back to my work
        </Link>
        <Link
          href={historyHref}
          className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          View grading history
        </Link>
      </div>

      {view === 'loading' && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-20 dark:border-slate-700 dark:bg-slate-800">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">Loading your result…</p>
        </div>
      )}

      {view === 'pending' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-900/40 dark:bg-amber-900/20">
          <ClipboardCheck className="mx-auto h-12 w-12 text-amber-600 dark:text-amber-400" />
          <h1 className="mt-4 text-xl font-semibold text-amber-900 dark:text-amber-200">
            Your result is under review
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-amber-800 dark:text-amber-300">
            Your instructor is finishing the review. Once the grade is published it will appear here.
            There is nothing you need to do right now.
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-5 inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-slate-800 dark:text-amber-300"
          >
            <RefreshCw className="h-4 w-4" /> Check again
          </button>
        </div>
      )}

      {view === 'not_found' && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800">
          <BookOpen className="mx-auto h-12 w-12 text-slate-400" />
          <h1 className="mt-4 text-xl font-semibold text-slate-800 dark:text-slate-100">
            No published result yet
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-300">
            We could not find a published result for this submission. If you believe this is a
            mistake, please contact your instructor.
          </p>
        </div>
      )}

      {view === 'error' && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900/40 dark:bg-red-900/20">
          <RefreshCw className="mx-auto h-12 w-12 text-red-500" />
          <h1 className="mt-4 text-xl font-semibold text-red-800 dark:text-red-200">
            Something went wrong
          </h1>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-5 inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-slate-800 dark:text-red-300"
          >
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
        </div>
      )}

      {view === 'published' && result && (
        <>
          {/* Score summary */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Published result
                </p>
                <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                  {result.assessmentTitle}
                </h1>
                {result.courseTitle && (
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{result.courseTitle}</p>
                )}
                {result.publishedAt && (
                  <p className="mt-1 text-xs text-slate-400">
                    Published {new Date(result.publishedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-4 rounded-lg bg-green-50 px-6 py-4 dark:bg-green-900/20">
                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                <div>
                  <p className="text-3xl font-bold text-green-700 dark:text-green-300">
                    {scoreLabel || '—'}
                  </p>
                  {result.gradeLetter && (
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                      Grade {result.gradeLetter}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-medium">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Reviewed and published
              </span>
              {outcome && (
                <>
                  <span className="rounded-full bg-indigo-50 px-3 py-1 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                    AAGE status: {outcome.status.replace(/_/g, ' ')}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    Progression: {outcome.progression.replace(/_/g, ' ')}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 ${
                      outcome.passed === null
                        ? 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                        : outcome.passed
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                    }`}
                  >
                    {outcome.passed === null
                      ? 'Pass/fail not supplied by this result'
                      : outcome.passed
                        ? 'Pass'
                        : 'Below passing threshold'}
                  </span>
                </>
              )}
            </div>
          </section>

          {/* Feedback */}
          {result.feedback && (
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800 dark:text-slate-100">
                <Sparkles className="h-5 w-5 text-purple-500" /> Instructor feedback
              </h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                {result.feedback}
              </p>
            </section>
          )}

          {/* Criterion breakdown — marks and human feedback only */}
          {result.criteria.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                Mark breakdown
              </h2>
              <div className="mt-4 space-y-3">
                {result.criteria.map((criterion, index) => (
                  <div key={`${criterion.name}-${index}`} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                        {criterion.name}
                      </span>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {criterion.awarded} / {criterion.maximum}
                      </span>
                    </div>
                    {criterion.maximum > 0 && (
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{
                            width: `${Math.max(0, Math.min(100, (criterion.awarded / criterion.maximum) * 100))}%`,
                          }}
                        />
                      </div>
                    )}
                    {criterion.feedback && (
                      <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{criterion.feedback}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Strengths / improvements / resources */}
          <div className="grid gap-6 md:grid-cols-2">
            {result.strengths.length > 0 && (
              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <h2 className="flex items-center gap-2 text-base font-semibold text-green-700 dark:text-green-300">
                  <TrendingUp className="h-5 w-5" /> What you did well
                </h2>
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-700 dark:text-slate-200">
                  {result.strengths.map((item, index) => <li key={index}>{item}</li>)}
                </ul>
              </section>
            )}
            {result.improvements.length > 0 && (
              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <h2 className="flex items-center gap-2 text-base font-semibold text-amber-700 dark:text-amber-300">
                  <Lightbulb className="h-5 w-5" /> Areas to improve
                </h2>
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-700 dark:text-slate-200">
                  {result.improvements.map((item, index) => <li key={index}>{item}</li>)}
                </ul>
              </section>
            )}
          </div>

          {result.resources.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-100">
                <BookOpen className="h-5 w-5 text-blue-500" /> Recommended resources
              </h2>
              <ul className="mt-3 space-y-2">
                {result.resources.map((resource, index) => (
                  <li key={index} className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-700/40">
                    {resource.url ? (
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {resource.title}
                      </a>
                    ) : (
                      <span className="font-medium text-slate-800 dark:text-slate-100">{resource.title}</span>
                    )}
                    {resource.description && (
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{resource.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="text-center text-xs text-slate-400">
            This result has been reviewed and approved by your instructor. If you have questions,
            please reach out to them directly.
          </p>
        </>
      )}
    </div>
  );
}
