import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Loader2, FolderOpen, UploadCloud, CheckCircle, Clock, AlertCircle,
  Target, ListChecks, Calendar, Award, Link2, FileText, X, Check, Users
} from 'lucide-react';
import { toast } from 'sonner';
import StudentSubmissionService, {
  ProjectWithStatus,
  SubmissionDetail,
} from '@/services/student-submission.service';
import { FileUploadService } from '@/services/file-upload.service';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';
import { TeamSection } from './TeamSection';
import {
  getSubmissionRequirements,
  getFileRules,
  isSubmissionHandedIn,
  isFileTypeAllowed,
  parseAttachments,
} from '@/lib/project-submission';

interface ProjectPanelProps {
  projectId: number;
  onSubmit?: (payload: { textContent?: string; fileUrl?: string }) => void;
  onSubmitComplete?: (projectId: number) => void;
}

type PanelMode = 'view' | 'submit';

type SubmissionRow = SubmissionDetail['submission'] | null;

type PanelState = 'not_submitted' | 'submitted' | 'graded' | 'needs_revision' | 'overdue';

/**
 * One state drives the whole panel: the accent rail, the status pill, the
 * icon tile and the workflow strip all read from here, so the project's
 * situation is legible at a glance instead of hiding in a small badge.
 */
const STATE_STYLES: Record<PanelState, {
  label: string;
  pill: string;
  dot: string;
  tile: string;
  rail: string;
  accent: string;
  stepDone: string;
  stepRing: string;
}> = {
  not_submitted: {
    label: 'Not submitted',
    pill: 'border-white/10 bg-white/[0.04] text-gray-300',
    dot: 'bg-gray-400',
    tile: 'border-white/10 bg-white/[0.04] text-gray-300',
    rail: 'bg-gray-500',
    accent: 'text-gray-300',
    stepDone: 'bg-gray-600 text-white',
    stepRing: 'ring-gray-500/40',
  },
  submitted: {
    label: 'Submitted',
    pill: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
    dot: 'bg-blue-400',
    tile: 'border-blue-500/25 bg-blue-500/10 text-blue-300',
    rail: 'bg-blue-500',
    accent: 'text-blue-300',
    stepDone: 'bg-blue-500/90 text-white',
    stepRing: 'ring-blue-500/40',
  },
  graded: {
    label: 'Graded',
    pill: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    dot: 'bg-emerald-400',
    tile: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
    rail: 'bg-emerald-500',
    accent: 'text-emerald-300',
    stepDone: 'bg-emerald-500/90 text-white',
    stepRing: 'ring-emerald-500/40',
  },
  needs_revision: {
    label: 'Needs revision',
    pill: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    dot: 'bg-amber-400',
    tile: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
    rail: 'bg-amber-500',
    accent: 'text-amber-300',
    stepDone: 'bg-amber-500/90 text-white',
    stepRing: 'ring-amber-500/40',
  },
  overdue: {
    label: 'Overdue',
    pill: 'border-red-500/30 bg-red-500/10 text-red-300',
    dot: 'bg-red-400',
    tile: 'border-red-500/25 bg-red-500/10 text-red-300',
    rail: 'bg-red-500',
    accent: 'text-red-300',
    stepDone: 'bg-red-500/90 text-white',
    stepRing: 'ring-red-500/40',
  },
};

const WORKFLOW_STEPS = ['Brief', 'Hand in', 'Reviewed'] as const;

/** "Oct 24" + a human relative tail ("in 5 days" / "3 days ago"). */
const dueMeta = (due: Date) => {
  const DAY = 86_400_000;
  const ms = due.getTime() - Date.now();
  const absolute = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const days = ms >= 0 ? Math.ceil(ms / DAY) : -Math.ceil(-ms / DAY);
  let relative: string;
  if (days > 1) relative = `in ${days} days`;
  else if (days === 1) relative = 'tomorrow';
  else if (days === 0) relative = 'today';
  else if (days === -1) relative = '1 day ago';
  else relative = `${-days} days ago`;
  return { absolute, relative };
};

export const ProjectPanel: React.FC<ProjectPanelProps> = ({
  projectId,
  onSubmit,
  onSubmitComplete,
}) => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectWithStatus | null>(null);
  const [submission, setSubmission] = useState<SubmissionRow>(null);
  const [mode, setMode] = useState<PanelMode>('view');

  const [textContent, setTextContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const formErrorRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const textAreaId = `project-text-${projectId}`;
  const fileInputId = `project-file-${projectId}`;
  const formErrorId = `project-error-${projectId}`;

  const loadProject = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const detail: SubmissionDetail = await StudentSubmissionService.getProjectDetails(projectId);
      if (!detail?.project) {
        throw new Error('Project not found');
      }
      const row = detail.submission ?? null;
      setProject(detail.project);
      setSubmission(row);
      // Open the form straight away while there is nothing handed in yet.
      setMode(isSubmissionHandedIn(row) ? 'view' : 'submit');
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  // Move focus to the inline error after a failed validation/submission
  useEffect(() => {
    if (formError) {
      formErrorRef.current?.focus();
    }
  }, [formError]);

  const status = project?.submission_status;
  const isSubmitted = isSubmissionHandedIn(submission);
  const isGraded = status?.status === 'graded';
  const needsRevision = status?.status === 'needs_revision';
  const canResubmit = !!project?.can_resubmit || needsRevision || !isSubmitted;
  const dueDate = project?.due_date ? new Date(project.due_date) : null;
  const isOverdue = dueDate ? dueDate.getTime() < Date.now() : false;
  // Only trust an explicitly numeric grade — never fabricate a 0
  const rawGrade = submission?.grade ?? status?.grade;
  const numericGrade = typeof rawGrade === 'number' && Number.isFinite(rawGrade) ? rawGrade : null;

  // What this project actually accepts, driven by `submission_format`
  const requirements = getSubmissionRequirements(project?.submission_format);
  const submissionFormat = requirements.format;
  const { needsText, needsFile } = requirements;
  const rules = getFileRules(project);
  const {
    allowedFileTypes,
    maxFileSizeMB,
    maxFileSizeBytes,
    accept: fileAccept,
  } = rules;
  const attachments = parseAttachments(submission?.file_path || submission?.file_url, submission?.file_name);

  const panelState: PanelState = (() => {
    if (isGraded) return 'graded';
    if (needsRevision) return 'needs_revision';
    if (isSubmitted) return 'submitted';
    if (isOverdue) return 'overdue';
    return 'not_submitted';
  })();
  const stateStyles = STATE_STYLES[panelState];
  const currentStep = isGraded ? 2 : isSubmitted ? 1 : 0;
  const due = dueDate ? dueMeta(dueDate) : null;

  const openForm = () => {
    setFormError(null);
    setMode('submit');
    // Bring the work area into view after the click, but never on load
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const rejectFile = (message: string) => {
    setFile(null);
    setFormError(message);
    toast.error(message);
  };

  const acceptFile = (selected: File | null) => {
    if (!selected) return;
    if (selected.size > maxFileSizeBytes) {
      rejectFile(`${selected.name} is ${FileUploadService.formatFileSize(selected.size)} — the maximum allowed file size is ${FileUploadService.formatFileSize(maxFileSizeBytes)}.`);
      return;
    }
    if (!isFileTypeAllowed(selected.name, allowedFileTypes)) {
      rejectFile(`${selected.name} is not an accepted file type. Allowed: ${allowedFileTypes.join(', ')}.`);
      return;
    }
    setFile(selected);
    setFormError(null);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    acceptFile(event.target.files?.[0] ?? null);
    event.target.value = '';
  };

  const handleFileDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (submitting) return;
    acceptFile(event.dataTransfer.files?.[0] ?? null);
  };

  const handleSubmit = async () => {
    if (submitting) return;

    const hasText = !!textContent.trim();
    if (needsText && !needsFile && !hasText) {
      const message = 'Add your written response before submitting.';
      setFormError(message);
      toast.error(message);
      return;
    }
    if (needsFile && !needsText && !file) {
      const message = `Attach your ${submissionFormat === 'presentation' ? 'presentation' : 'file'} before submitting.`;
      setFormError(message);
      toast.error(message);
      return;
    }
    if (needsText && needsFile && (!hasText || !file)) {
      const message = 'Add a written response and attach a file before submitting.';
      setFormError(message);
      toast.error(message);
      return;
    }
    if (!needsText && !needsFile && !hasText && !file) {
      const message = 'Add your work before submitting.';
      setFormError(message);
      toast.error(message);
      return;
    }
    if (file) {
      if (file.size > maxFileSizeBytes) {
        const message = `${file.name} is ${FileUploadService.formatFileSize(file.size)} — the maximum allowed file size is ${FileUploadService.formatFileSize(maxFileSizeBytes)}.`;
        setFormError(message);
        toast.error(message);
        return;
      }
      if (!isFileTypeAllowed(file.name, allowedFileTypes)) {
        const message = `${file.name} is not an accepted file type. Allowed: ${allowedFileTypes.join(', ')}.`;
        setFormError(message);
        toast.error(message);
        return;
      }
    }

    setFormError(null);
    try {
      setSubmitting(true);
      let fileUrl: string | undefined;
      if (file) {
        const uploaded = await FileUploadService.uploadFile(file, {
          maxSize: maxFileSizeBytes,
        });
        fileUrl = uploaded?.url;
      }
      await StudentSubmissionService.submitProject(projectId, {
        text_content: hasText ? textContent.trim() : undefined,
        file_url: fileUrl,
      });
      toast.success('Project submitted successfully.');
      onSubmit?.({ textContent: hasText ? textContent.trim() : undefined, fileUrl });
      setTextContent('');
      setFile(null);
      setMode('view');
      await loadProject();
      onSubmitComplete?.(projectId);
    } catch (err: any) {
      const message = err?.message || 'Failed to submit project.';
      setFormError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="animate-pulse rounded-2xl border border-white/[0.07] bg-gray-900 p-4 sm:p-5">
          <div className="flex items-start gap-3.5">
            <div className="h-11 w-11 flex-shrink-0 rounded-xl bg-white/[0.06]" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-24 rounded bg-white/[0.06]" />
              <div className="h-5 w-2/3 rounded bg-white/[0.08]" />
              <div className="h-3 w-1/2 rounded bg-white/[0.05]" />
            </div>
          </div>
        </div>
        <div className="animate-pulse rounded-2xl border border-white/[0.07] bg-gray-900 p-4 sm:p-5 space-y-3">
          <div className="h-3 w-24 rounded bg-white/[0.06]" />
          <div className="space-y-2">
            <div className="h-3 rounded bg-white/[0.05]" />
            <div className="h-3 w-5/6 rounded bg-white/[0.05]" />
            <div className="h-3 w-4/6 rounded bg-white/[0.05]" />
          </div>
        </div>
        <p className="sr-only">Loading project…</p>
      </div>
    );
  }

  if (loadError || !project) {
    return (
      <Alert variant="destructive" className="bg-red-900/20 border-red-800/50">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Could not load project</AlertTitle>
        <AlertDescription className="flex items-center gap-3">
          <span>{loadError || 'Project not found.'}</span>
          <Button size="sm" variant="outline" onClick={() => void loadProject()}>
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Header: the project's identity and current situation ── */}
      <header className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gray-900">
        <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${stateStyles.rail}`} />
        <div className="flex flex-col gap-4 py-4 pl-6 pr-4 sm:py-5 sm:pl-7 sm:pr-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border ${stateStyles.tile}`}>
              <FolderOpen className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${stateStyles.pill}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${stateStyles.dot}`} />
                  {stateStyles.label}
                </span>
                {status?.is_late && (
                  <span className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-300">
                    Late{status.days_late ? ` · ${status.days_late}d` : ''}
                  </span>
                )}
              </div>
              <h3 className="mt-1.5 break-words text-xl font-semibold leading-snug text-white">
                {project.title}
              </h3>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-400">
                {dueDate && due && (
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {isOverdue && !isSubmitted ? (
                      <span className="font-medium text-red-300">Overdue · {due.relative}</span>
                    ) : (
                      <>
                        Due <span className="font-medium text-gray-200">{due.absolute}</span>
                        <span className="text-gray-500">· {due.relative}</span>
                      </>
                    )}
                  </span>
                )}
                {project.points_possible > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <Award className="h-3.5 w-3.5" />
                    <span className="font-medium text-gray-200">{project.points_possible}</span> pts
                  </span>
                )}
                {project.collaboration_allowed && (
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    Teams of up to {project.max_team_size}
                  </span>
                )}
              </div>
            </div>
          </div>
          {canResubmit && (
            <Button
              size="sm"
              onClick={() => {
                if (mode === 'submit') {
                  setFormError(null);
                  setMode('view');
                } else {
                  openForm();
                }
              }}
              className={`flex-shrink-0 self-start ${
                mode === 'submit'
                  ? 'border border-white/10 bg-transparent text-gray-300 hover:bg-white/[0.06] hover:text-white shadow-none'
                  : 'bg-blue-600 text-white hover:bg-blue-500'
              }`}
            >
              {mode === 'submit' ? 'Cancel' : isSubmitted ? 'Resubmit' : 'Start Project'}
            </Button>
          )}
        </div>
      </header>

      {/* ── Workflow strip: where this project stands ── */}
      <nav className="rounded-2xl border border-white/[0.07] bg-gray-900 px-4 py-3 sm:px-6" aria-label="Project progress">
        <div className="flex items-center gap-2 sm:gap-3">
          {WORKFLOW_STEPS.map((label, index) => {
            const done = index < currentStep;
            const current = index === currentStep;
            return (
              <React.Fragment key={label}>
                {index > 0 && <span aria-hidden className="h-px flex-1 bg-white/[0.08]" />}
                <span
                  className="flex items-center gap-2"
                  aria-current={current ? 'step' : undefined}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                      done
                        ? stateStyles.stepDone
                        : current
                          ? `bg-white/[0.06] ring-2 ${stateStyles.stepRing} ${stateStyles.accent}`
                          : 'bg-white/[0.04] text-gray-500'
                    }`}
                  >
                    {done ? <Check className="h-3 w-3" /> : index + 1}
                  </span>
                  <span className={`text-xs font-medium ${done || current ? 'text-gray-200' : 'text-gray-500'}`}>
                    {label}
                  </span>
                </span>
              </React.Fragment>
            );
          })}
        </div>
      </nav>

      {/* ── Revision request: impossible to miss, one click from the form ── */}
      {needsRevision && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-300">Revision requested</p>
                <div className="mt-1 max-w-[68ch] text-sm text-gray-300">
                  <MarkdownRenderer
                    content={submission?.modification_reason || status?.feedback || 'Your instructor asked for changes. Update your work and resubmit.'}
                    variant="compact"
                    className="prose-sm leading-relaxed"
                  />
                </div>
              </div>
            </div>
            {mode !== 'submit' && canResubmit && (
              <Button
                size="sm"
                variant="outline"
                onClick={openForm}
                className="flex-shrink-0 border-amber-500/40 text-amber-200 hover:bg-amber-500/10 hover:text-amber-100"
              >
                Revise work
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── Workspace: brief + hand-in on the left, spec rail on the right ── */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-4">
          {/* Work form comes first while it is open — the task at hand */}
          {mode === 'submit' && canResubmit && (
            <div ref={formRef} className="rounded-2xl border border-white/[0.07] bg-gray-900 p-4 sm:p-6 space-y-4 scroll-mt-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                  Your work
                </p>
                <h4 className="mt-1 text-base font-semibold text-white">
                  {isSubmitted ? 'Revise and resubmit' : 'Hand in your project'}
                </h4>
                <p className="mt-1 text-sm text-gray-400">
                  {needsText && needsFile
                    ? 'This project needs a written response and a file.'
                    : needsFile
                      ? `This project needs a ${submissionFormat === 'presentation' ? 'presentation' : 'file'} upload.`
                      : 'This project needs a written response.'}
                </p>
              </div>

              {needsText && (
                <div className="space-y-1.5">
                  <label htmlFor={textAreaId} className="text-xs font-medium text-gray-300">
                    Written response
                  </label>
                  <textarea
                    id={textAreaId}
                    value={textContent}
                    onChange={(e) => {
                      setTextContent(e.target.value);
                      setFormError(null);
                    }}
                    rows={7}
                    aria-invalid={formError ? true : undefined}
                    aria-describedby={formError ? formErrorId : undefined}
                    placeholder="Describe your project, link to your repository, or paste your write-up…"
                    className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-gray-200 placeholder-gray-400 focus:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>
              )}

              {needsFile && (
                <div className="space-y-1.5">
                  <label htmlFor={fileInputId} className="text-xs font-medium text-gray-300">
                    {submissionFormat === 'presentation' ? 'Presentation file' : 'File'}
                  </label>
                  {file ? (
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                      <span className="flex min-w-0 items-center gap-2 text-sm text-gray-300">
                        <UploadCloud className="h-4 w-4 flex-shrink-0 text-blue-300" />
                        <span className="truncate">{file.name}</span>
                        <span className="flex-shrink-0 text-xs text-gray-500">
                          {FileUploadService.formatFileSize(file.size)}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setFile(null)}
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-white/[0.06] hover:text-gray-100"
                        aria-label="Remove file"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <input
                        type="file"
                        id={fileInputId}
                        className="sr-only"
                        accept={fileAccept}
                        onChange={handleFileChange}
                        disabled={submitting}
                      />
                    </div>
                  ) : (
                    <label
                      htmlFor={fileInputId}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (!submitting) setDragging(true);
                      }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={handleFileDrop}
                      className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-dashed px-4 py-7 text-center transition-colors focus-within:ring-2 focus-within:ring-blue-500/40 ${
                        dragging
                          ? 'border-blue-500/70 bg-blue-500/[0.06] text-blue-200'
                          : 'border-white/15 bg-white/[0.02] text-gray-400 hover:border-blue-500/60 hover:text-gray-200'
                      }`}
                    >
                      <UploadCloud className="h-6 w-6" />
                      <span className="text-sm font-medium">
                        Choose a file or drop it here
                      </span>
                      <span className="text-xs text-gray-500">
                        Max {maxFileSizeMB} MB
                        {allowedFileTypes.length > 0 && <> · {allowedFileTypes.join(', ')}</>}
                      </span>
                      <input
                        type="file"
                        id={fileInputId}
                        className="sr-only"
                        accept={fileAccept}
                        onChange={handleFileChange}
                        disabled={submitting}
                      />
                    </label>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setFormError(null);
                    setMode('view');
                  }}
                  className="text-gray-400 hover:text-gray-200"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => void handleSubmit()}
                  disabled={submitting}
                  className="bg-blue-600 text-white hover:bg-blue-500"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    isSubmitted ? 'Resubmit Project' : 'Submit Project'
                  )}
                </Button>
              </div>
              {formError && (
                <Alert
                  ref={formErrorRef}
                  tabIndex={-1}
                  role="alert"
                  id={formErrorId}
                  className="border-red-800/60 bg-red-900/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/70"
                >
                  <AlertCircle className="h-4 w-4 text-red-400" />
                  <AlertTitle className="text-red-300">Submission problem</AlertTitle>
                  <AlertDescription className="text-red-200">{formError}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Brief: description, objectives, numbered task ladder */}
          <section className="rounded-2xl border border-white/[0.07] bg-gray-900 p-4 sm:p-6">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
              <FileText className="h-4 w-4 text-blue-300" />
              Project brief
            </h4>

            {project.description && (
              <div className="mt-3 max-w-[68ch] text-sm leading-relaxed text-gray-300">
                <MarkdownRenderer
                  content={project.description}
                  variant="compact"
                  className="prose-sm leading-relaxed"
                />
              </div>
            )}

            {project.objectives && (
              <div className="mt-5 max-w-[68ch] rounded-r-xl border-l-2 border-blue-500/40 bg-blue-500/[0.05] px-4 py-3">
                <h5 className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Target className="h-4 w-4 text-blue-300" />
                  Objectives
                </h5>
                <div className="mt-1.5 text-sm text-gray-300">
                  <MarkdownRenderer
                    content={project.objectives}
                    variant="compact"
                    className="prose-sm leading-relaxed"
                  />
                </div>
              </div>
            )}

            {project.tasks && project.tasks.length > 0 && (
              <div className="mt-5">
                <h5 className="flex items-center gap-2 text-sm font-semibold text-white">
                  <ListChecks className="h-4 w-4 text-blue-300" />
                  Tasks
                </h5>
                <ol className="mt-3 max-w-[68ch] space-y-3.5">
                  {project.tasks.map((task, index) => (
                    <li key={index} className="flex gap-3">
                      <span className="mt-0.5 w-5 flex-shrink-0 font-mono text-xs tabular-nums text-gray-500">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm text-gray-200">
                          {task.text}
                          {task.is_optional && (
                            <Badge variant="outline" className="ml-2 border-white/10 bg-white/[0.04] text-gray-400">
                              optional
                            </Badge>
                          )}
                        </p>
                        {task.description && (
                          <div className="mt-0.5 text-xs text-gray-400">
                            <MarkdownRenderer
                              content={task.description}
                              variant="compact"
                              className="prose-sm leading-relaxed"
                            />
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </section>

          {/* Hand-in receipt + result */}
          {isSubmitted && submission && (
            <section className="rounded-2xl border border-white/[0.07] bg-gray-900 p-4 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                  Handed in
                </p>
                {status?.is_late && (
                  <span className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-300">
                    Late{status.days_late ? ` · ${status.days_late}d` : ''}
                  </span>
                )}
              </div>

              <p className="flex items-center gap-2 text-sm text-gray-300">
                <Clock className="h-4 w-4 text-gray-500" />
                {submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : '—'}
              </p>

              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {attachments.map((attachment, index) => (
                    <a
                      key={`${attachment.url}-${index}`}
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-blue-300 transition-colors hover:border-blue-500/40 hover:bg-blue-500/[0.06] hover:text-blue-200"
                    >
                      <Link2 className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{attachment.name || submission.file_name || 'Attached file'}</span>
                    </a>
                  ))}
                </div>
              )}

              {submission.text_content && (
                <div className="max-w-[70ch] rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-sm text-gray-300">
                  <MarkdownRenderer
                    content={submission.text_content}
                    variant="compact"
                    className="prose-sm leading-relaxed"
                  />
                </div>
              )}

              {isGraded && (
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4 space-y-2.5">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-3xl font-bold tabular-nums text-emerald-300">
                      {numericGrade !== null ? numericGrade : 'Graded'}
                    </span>
                    {numericGrade !== null && project.points_possible > 0 && (
                      <span className="text-sm text-emerald-300/70">/ {project.points_possible} pts</span>
                    )}
                    <span className="ml-auto text-xs text-gray-400">
                      {status?.graded_at && new Date(status.graded_at).toLocaleDateString()}
                      {status?.grader_name ? ` · ${status.grader_name}` : ''}
                    </span>
                  </div>
                  {(submission.feedback || status?.feedback) && (
                    <div className="max-w-[68ch] border-t border-emerald-500/15 pt-2.5 text-sm text-gray-300">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-300/80">
                        Instructor feedback
                      </p>
                      <MarkdownRenderer
                        content={submission.feedback || status?.feedback || ''}
                        variant="compact"
                        className="prose-sm leading-relaxed"
                      />
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </div>

        {/* Spec rail: the hand-in rules, always in view on wide screens */}
        <aside className="space-y-4 self-start xl:sticky xl:top-4">
          <section className="rounded-2xl border border-white/[0.07] bg-gray-900 p-4 sm:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
              Hand-in details
            </p>
            <dl className="mt-3 divide-y divide-white/[0.06]">
              <div className="flex items-start justify-between gap-3 py-2">
                <dt className="text-xs text-gray-500">Format</dt>
                <dd className="text-right text-xs font-medium text-gray-200">{requirements.label}</dd>
              </div>
              {needsFile && (
                <div className="flex items-start justify-between gap-3 py-2">
                  <dt className="text-xs text-gray-500">Files</dt>
                  <dd className="text-right text-xs font-medium text-gray-200">
                    {allowedFileTypes.length > 0 ? allowedFileTypes.join(', ') : 'Any type'}
                    <span className="block font-normal text-gray-500">up to {maxFileSizeMB} MB</span>
                  </dd>
                </div>
              )}
              {project.points_possible > 0 && (
                <div className="flex items-start justify-between gap-3 py-2">
                  <dt className="text-xs text-gray-500">Points</dt>
                  <dd className="text-right text-xs font-medium text-gray-200">{project.points_possible}</dd>
                </div>
              )}
              {dueDate && due && (
                <div className="flex items-start justify-between gap-3 py-2">
                  <dt className="text-xs text-gray-500">Due</dt>
                  <dd className="text-right text-xs font-medium text-gray-200">
                    {due.absolute}
                    <span className="block font-normal text-gray-500">{due.relative}</span>
                  </dd>
                </div>
              )}
              {project.collaboration_allowed && (
                <div className="flex items-start justify-between gap-3 py-2">
                  <dt className="text-xs text-gray-500">Team</dt>
                  <dd className="text-right text-xs font-medium text-gray-200">
                    Up to {project.max_team_size} students
                  </dd>
                </div>
              )}
              <div className="flex items-start justify-between gap-3 py-2">
                <dt className="text-xs text-gray-500">Status</dt>
                <dd className={`text-right text-xs font-medium ${stateStyles.accent}`}>
                  {stateStyles.label}
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>

      {/* Team roster + team chat room */}
      {project.collaboration_allowed && <TeamSection projectId={projectId} />}
    </div>
  );
};

export default ProjectPanel;
