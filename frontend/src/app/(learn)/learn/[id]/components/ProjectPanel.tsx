import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Loader2, FolderOpen, CheckCircle, Clock, AlertCircle,
  Target, ListChecks, Calendar, Award, Link2, FileText, X, Check, Users, Paperclip,
  ArrowLeft, Upload, Send, Edit, MessageSquare, PartyPopper, AlertTriangle
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

/**
 * Two views: "details" is the reading room (brief + rules + team), "workspace"
 * is the workbench where the student hands work in. `editing` switches the
 * workspace between the form and the hand-in receipt.
 */
type PanelMode = 'details' | 'workspace';

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
  accent: string;
  stepDone: string;
  stepRing: string;
}> = {
  not_submitted: {
    label: 'Not submitted',
    pill: 'border-white/10 bg-white/[0.04] text-gray-300',
    dot: 'bg-gray-400',
    accent: 'text-gray-300',
    stepDone: 'bg-gray-600 text-white',
    stepRing: 'ring-gray-500/40',
  },
  submitted: {
    label: 'Submitted',
    pill: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
    dot: 'bg-blue-400',
    tile: 'border-blue-500/25 bg-blue-500/10 text-blue-300',
    accent: 'text-blue-300',
    stepDone: 'bg-blue-500/90 text-white',
    stepRing: 'ring-blue-500/40',
  },
  graded: {
    label: 'Graded',
    pill: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    dot: 'bg-emerald-400',
    tile: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
    accent: 'text-emerald-300',
    stepDone: 'bg-emerald-500/90 text-white',
    stepRing: 'ring-emerald-500/40',
  },
  needs_revision: {
    label: 'Needs revision',
    pill: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    dot: 'bg-amber-400',
    tile: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
    accent: 'text-amber-300',
    stepDone: 'bg-amber-500/90 text-white',
    stepRing: 'ring-amber-500/40',
  },
  overdue: {
    label: 'Overdue',
    pill: 'border-red-500/30 bg-red-500/10 text-red-300',
    dot: 'bg-red-400',
    tile: 'border-red-500/25 bg-red-500/10 text-red-300',
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

/** One live readiness row for the workspace checklist: filled circle vs empty. */
const CheckRow: React.FC<{ done: boolean; label: string; hint: string }> = ({ done, label, hint }) => (
  <li className="flex items-start gap-2.5">
    <span
      className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border ${
        done
          ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
          : 'border-gray-300 bg-gray-100 text-transparent dark:border-white/15 dark:bg-white/[0.03]'
      }`}
    >
      <Check className="h-2.5 w-2.5" />
    </span>
    <span className="min-w-0">
      <span className={`block text-sm ${done ? 'text-gray-900 dark:text-gray-200' : 'text-gray-500 dark:text-gray-400'}`}>
        {label}
      </span>
      <span className={`block break-words text-xs ${done ? 'text-gray-500 dark:text-gray-500' : 'text-gray-400 dark:text-gray-600'}`}>
        {hint}
      </span>
    </span>
  </li>
);

export const ProjectPanel: React.FC<ProjectPanelProps> = ({
  projectId,
  onSubmit,
  onSubmitComplete,
}) => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectWithStatus | null>(null);
  const [submission, setSubmission] = useState<SubmissionRow>(null);
  const [mode, setMode] = useState<PanelMode>('details');
  const [editing, setEditing] = useState(false);

  const [textContent, setTextContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const formErrorRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
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
      // Details-first: always land on the reading view, never auto-open the form.
      setMode('details');
      setEditing(false);
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
  const daysUntilDue = dueDate ? Math.ceil((dueDate.getTime() - Date.now()) / 86_400_000) : null;
  const isDueSoon = daysUntilDue !== null && daysUntilDue <= 3 && daysUntilDue >= 0;
  const isPendingReview = isSubmitted && !isGraded && !needsRevision;
  const gradePercent =
    numericGrade !== null && project && project.points_possible > 0
      ? (numericGrade / project.points_possible) * 100
      : null;

  /** Enter the workspace: `startEditing` opens the form, otherwise the receipt. */
  const openWorkspace = (startEditing: boolean) => {
    setFormError(null);
    setMode('workspace');
    setEditing(startEditing);
    // Bring the workbench into view after the click, but never on load
    requestAnimationFrame(() => workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const backToDetails = () => {
    setFormError(null);
    setMode('details');
    setEditing(false);
  };

  /** The orange revision panel — shown in the details card and on the receipt. */
  const revisionPanel = (
    <div className="overflow-hidden rounded-xl border-2 border-orange-400 bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 shadow-lg dark:from-orange-950/40 dark:via-amber-950/30 dark:to-yellow-950/20">
      <div className="flex flex-wrap items-center gap-3 bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3">
        <div className="rounded-lg bg-white/20 p-1.5">
          <AlertCircle className="h-5 w-5 text-white" />
        </div>
        <h4 className="text-base font-bold text-white sm:text-lg">Revision requested</h4>
        {!(mode === 'workspace' && editing) && canResubmit && (
          <Button
            size="sm"
            onClick={() => openWorkspace(true)}
            className="ml-auto gap-1.5 bg-white/20 text-white hover:bg-white/30"
          >
            <Edit className="h-4 w-4" />
            Revise work
          </Button>
        )}
      </div>
      <div className="space-y-4 p-5 sm:p-6">
        <p className="text-sm font-medium text-orange-800 sm:text-base dark:text-orange-200">
          Your instructor has requested changes to your project. Review the feedback below and hand in a revised version.
        </p>
        <div className="rounded-lg border border-orange-200 bg-white p-4 shadow-sm sm:p-5 dark:border-orange-800/50 dark:bg-gray-800/70">
          <MarkdownRenderer
            content={
              submission?.modification_reason ||
              project?.modification_request_reason ||
              status?.feedback ||
              'Your instructor asked for changes. Update your work and resubmit.'
            }
            variant="compact"
            className="prose-sm leading-relaxed"
          />
        </div>
      </div>
    </div>
  );

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
      await loadProject();
      // loadProject resets to details — stay in the workspace on the receipt
      setMode('workspace');
      setEditing(false);
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
      {/* ── Details view: one green hero card, mirroring the assignment panel ── */}
      {mode === 'details' && (
        <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 shadow-xl dark:from-green-950 dark:via-emerald-950 dark:to-teal-950">
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-green-600 text-white shadow-md hover:bg-green-700">
                <FolderOpen className="mr-1 h-3 w-3" />
                Project
              </Badge>
              {isGraded && (
                <Badge variant="outline" className="border-green-300 bg-white/50 backdrop-blur-sm">
                  <Award className="mr-1 h-3 w-3 text-green-600" />
                  Graded
                </Badge>
              )}
              {isSubmitted && !isGraded && !needsRevision && (
                <Badge variant="outline" className="border-yellow-300 bg-white/50 backdrop-blur-sm">
                  <Clock className="mr-1 h-3 w-3 text-yellow-600" />
                  Pending Review
                </Badge>
              )}
              {needsRevision && (
                <Badge variant="outline" className="border-orange-400 bg-orange-100 text-orange-800">
                  <AlertCircle className="mr-1 h-3 w-3" />
                  Needs Revision
                </Badge>
              )}
              {isOverdue && !isSubmitted && (
                <Badge variant="outline" className="border-red-400 bg-red-100 text-red-800">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  Overdue
                </Badge>
              )}
              {status?.is_late && (
                <Badge variant="outline" className="border-red-400 bg-red-100 text-red-800">
                  Late{status.days_late ? ` · ${status.days_late}d` : ''}
                </Badge>
              )}
            </div>
            <h3 className="text-2xl font-bold text-gray-900 sm:text-3xl dark:text-white">
              {project.title}
            </h3>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-600 dark:text-gray-400">
              {dueDate && due && (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {isOverdue && !isSubmitted ? (
                    <span className="font-medium text-red-600 dark:text-red-400">Overdue · {due.relative}</span>
                  ) : (
                    <>
                      Due <span className="font-medium text-gray-900 dark:text-gray-200">{due.absolute}</span>
                      <span>· {due.relative}</span>
                    </>
                  )}
                </span>
              )}
              {project.points_possible > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <Award className="h-3.5 w-3.5" />
                  <span className="font-medium text-gray-900 dark:text-gray-200">{project.points_possible}</span> pts
                </span>
              )}
              {project.collaboration_allowed && (
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Teams of up to {project.max_team_size}
                </span>
              )}
            </div>
            {project.description && (
              <div className="max-w-[68ch] text-sm leading-relaxed text-gray-700 sm:text-base dark:text-gray-300">
                <MarkdownRenderer
                  content={project.description}
                  variant="compact"
                  className="prose-sm leading-relaxed"
                />
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Workflow strip: where this project stands */}
            <nav
              aria-label="Project progress"
              className="rounded-xl border border-green-100 bg-white/70 px-4 py-3 shadow-sm dark:border-white/10 dark:bg-black/20"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                {WORKFLOW_STEPS.map((label, index) => {
                  const done = index < currentStep;
                  const current = index === currentStep;
                  return (
                    <React.Fragment key={label}>
                      {index > 0 && <span aria-hidden className="h-px flex-1 bg-gray-300 dark:bg-white/10" />}
                      <span className="flex items-center gap-2" aria-current={current ? 'step' : undefined}>
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                            done
                              ? stateStyles.stepDone
                              : current
                                ? `bg-white dark:bg-white/[0.06] ring-2 ${stateStyles.stepRing} ${stateStyles.accent}`
                                : 'bg-gray-200 text-gray-500 dark:bg-white/[0.04] dark:text-gray-500'
                          }`}
                        >
                          {done ? <Check className="h-3 w-3" /> : index + 1}
                        </span>
                        <span
                          className={`text-xs font-medium ${
                            done || current
                              ? 'text-gray-900 dark:text-gray-200'
                              : 'text-gray-500'
                          }`}
                        >
                          {label}
                        </span>
                      </span>
                    </React.Fragment>
                  );
                })}
              </div>
            </nav>

            {/* Stat tiles */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-green-100 bg-white p-4 text-center shadow-md transition-all hover:shadow-lg dark:border-green-900 dark:bg-gray-800 sm:p-5">
                <div className="mb-2 flex justify-center">
                  <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900">
                    <Award className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-green-600 sm:text-3xl dark:text-green-400">
                  {project.points_possible}
                </div>
                <div className="text-xs font-medium text-gray-600 sm:text-sm dark:text-gray-400">Points</div>
              </div>

              {dueDate && (
                <div
                  className={`rounded-xl bg-white p-4 text-center shadow-md transition-all hover:lg:shadow-lg dark:bg-gray-800 sm:p-5 ${
                    isOverdue
                      ? 'border-2 border-red-400 dark:border-red-600'
                      : isDueSoon
                        ? 'border-2 border-yellow-400 dark:border-yellow-600'
                        : 'border border-blue-100 dark:border-blue-900'
                  }`}
                >
                  <div className="mb-2 flex justify-center">
                    <div
                      className={`rounded-lg p-2 ${
                        isOverdue
                          ? 'bg-red-100 dark:bg-red-900'
                          : isDueSoon
                            ? 'bg-yellow-100 dark:bg-yellow-900'
                            : 'bg-blue-100 dark:bg-blue-900'
                      }`}
                    >
                      <Clock
                        className={`h-5 w-5 ${
                          isOverdue
                            ? 'text-red-600 dark:text-red-400'
                            : isDueSoon
                              ? 'text-yellow-600 dark:text-yellow-400'
                              : 'text-blue-600 dark:text-blue-400'
                        }`}
                      />
                    </div>
                  </div>
                  <div
                    className={`text-2xl font-bold sm:text-3xl ${
                      isOverdue
                        ? 'text-red-600 dark:text-red-400'
                        : isDueSoon
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : 'text-blue-600 dark:text-blue-400'
                    }`}
                  >
                    {isOverdue ? 'Overdue' : daysUntilDue === 0 ? 'Today' : daysUntilDue}
                  </div>
                  <div className="text-xs font-medium text-gray-600 sm:text-sm dark:text-gray-400">
                    {isOverdue ? 'Past Due' : daysUntilDue === 0 ? 'Due today' : 'Days Left'}
                  </div>
                </div>
              )}

              <div className="col-span-2 rounded-xl border border-purple-100 bg-white p-4 text-center shadow-md transition-all hover:shadow-lg dark:border-purple-900 dark:bg-gray-800 sm:p-5 lg:col-span-1">
                <div className="mb-2 flex justify-center">
                  <div className="rounded-lg bg-purple-100 p-2 dark:bg-purple-900">
                    <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
                <div className="text-xl font-bold capitalize text-purple-600 sm:text-2xl dark:text-purple-400">
                  {requirements.label}
                </div>
                <div className="text-xs font-medium text-gray-600 sm:text-sm dark:text-gray-400">Submission Type</div>
              </div>
            </div>

            {/* Objectives */}
            {project.objectives && (
              <div className="rounded-xl border-l-4 border-teal-500 bg-gradient-to-r from-teal-50 to-cyan-50 p-6 shadow-lg dark:from-teal-950/30 dark:to-cyan-950/30 sm:p-7">
                <h4 className="mb-5 flex items-center text-lg font-bold text-gray-900 sm:text-xl dark:text-white">
                  <div className="mr-3 rounded-lg bg-teal-100 p-2 shadow-sm dark:bg-teal-900">
                    <Target className="h-6 w-6 text-teal-600 dark:text-teal-400" />
                  </div>
                  Project Objectives
                </h4>
                <div className="max-w-[70ch] rounded-lg border border-teal-100 bg-white p-4 shadow-sm dark:border-teal-900 dark:bg-gray-800">
                  <MarkdownRenderer
                    content={project.objectives}
                    variant="compact"
                    className="prose-sm leading-relaxed"
                  />
                </div>
              </div>
            )}

            {/* Tasks */}
            {project.tasks && project.tasks.length > 0 && (
              <div className="rounded-xl border-l-4 border-purple-500 bg-gradient-to-r from-purple-50 to-fuchsia-50 p-6 shadow-lg dark:from-purple-950/30 dark:to-fuchsia-950/30 sm:p-7">
                <h4 className="mb-5 flex items-center text-lg font-bold text-gray-900 sm:text-xl dark:text-white">
                  <div className="mr-3 rounded-lg bg-purple-100 p-2 shadow-sm dark:bg-purple-900">
                    <ListChecks className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  Project Tasks
                </h4>
                <div className="rounded-lg border border-purple-100 bg-white p-4 shadow-sm dark:border-purple-900 dark:bg-gray-800">
                  <ol className="grid gap-x-8 gap-y-3.5 sm:grid-cols-2">
                    {project.tasks.map((task, index) => (
                      <li key={index} className="flex min-w-0 gap-3">
                        <span className="mt-0.5 w-5 flex-shrink-0 font-mono text-xs tabular-nums text-gray-500">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-sm text-gray-800 dark:text-gray-200">
                            {task.text}
                            {task.is_optional && (
                              <Badge variant="outline" className="ml-2 border-gray-300 bg-gray-100 text-gray-500 dark:border-white/15 dark:bg-white/[0.06] dark:text-gray-400">
                                optional
                              </Badge>
                            )}
                          </p>
                          {task.description && (
                            <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
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
              </div>
            )}

            {/* Submission requirements */}
            <div className="rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 p-6 shadow-lg dark:from-blue-950/30 dark:to-indigo-950/30 sm:p-7">
              <h4 className="mb-5 flex items-center text-lg font-bold text-gray-900 sm:text-xl dark:text-white">
                <div className="mr-3 rounded-lg bg-blue-100 p-2 shadow-sm dark:bg-blue-900">
                  <AlertCircle className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                Submission Requirements
              </h4>
              <div className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm dark:border-blue-900 dark:bg-gray-800">
                <ul className="space-y-3 text-sm text-gray-700 sm:text-base dark:text-gray-300">
                  {needsText && (
                    <li className="flex items-start gap-2">
                      <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                      <span>Provide a written response in the workspace editor</span>
                    </li>
                  )}
                  {needsFile && (
                    <>
                      <li className="flex items-start gap-2">
                        <Upload className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-500" />
                        <span>
                          Upload {submissionFormat === 'presentation' ? 'presentation' : 'files'}:{' '}
                          <strong>{allowedFileTypes.length > 0 ? allowedFileTypes.join(', ') : 'any type'}</strong>
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-500" />
                        <span>
                          Maximum file size: <strong>{maxFileSizeMB}MB</strong> per file
                        </span>
                      </li>
                    </>
                  )}
                  {dueDate && due && (
                    <li className="flex items-start gap-2">
                      <Clock
                        className={`mt-0.5 h-5 w-5 flex-shrink-0 ${
                          isOverdue ? 'text-red-500' : isDueSoon ? 'text-yellow-500' : 'text-purple-500'
                        }`}
                      />
                      <div>
                        <span
                          className={
                            isOverdue
                              ? 'font-bold text-red-700 dark:text-red-400'
                              : isDueSoon
                                ? 'font-semibold text-yellow-700 dark:text-yellow-400'
                                : ''
                          }
                        >
                          Due date:{' '}
                          {dueDate.toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {isOverdue && !isSubmitted && (
                          <span className="mt-1 flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
                            <AlertTriangle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                            This project is past due — late hand-ins are still recorded
                          </span>
                        )}
                        {isDueSoon && (
                          <span className="mt-1 flex items-center gap-1.5 text-sm text-yellow-600 dark:text-yellow-400">
                            <Clock className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                            Due soon — hand in before the deadline
                          </span>
                        )}
                      </div>
                    </li>
                  )}
                  {project.points_possible > 0 && (
                    <li className="flex items-start gap-2">
                      <Award className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                      <span>
                        Worth <strong>{project.points_possible} points</strong>
                      </span>
                    </li>
                  )}
                  {project.collaboration_allowed && (
                    <li className="flex items-start gap-2">
                      <Users className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-500" />
                      <span>
                        Team of up to <strong>{project.max_team_size} students</strong>
                      </span>
                    </li>
                  )}
                </ul>
              </div>
            </div>

            {/* Status & result */}
            {isSubmitted && (
              <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-gray-100 p-6 shadow-lg dark:border-slate-700 dark:from-slate-900/50 dark:to-gray-800/50 sm:p-7">
                <h4 className="mb-5 flex items-center text-lg font-bold text-gray-900 sm:text-xl dark:text-white">
                  <div className="mr-3 rounded-lg bg-slate-100 p-2 shadow-sm dark:bg-slate-800">
                    <FileText className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                  </div>
                  Project Status &amp; Result
                </h4>

                <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                    <div className="mb-2 flex items-center justify-between">
                      <h5 className="text-sm font-semibold text-gray-900 dark:text-white">Submission Status</h5>
                      <div
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ${
                          isGraded
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : needsRevision
                              ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                        }`}
                      >
                        {isGraded ? (
                          <>
                            <CheckCircle className="h-3 w-3" aria-hidden="true" />
                            Graded
                          </>
                        ) : needsRevision ? (
                          <>
                            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                            Needs Revision
                          </>
                        ) : (
                          <>
                            <Clock className="h-3 w-3" aria-hidden="true" />
                            Under Review
                          </>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {submission?.submitted_at ? (
                        <>Handed in on {new Date(submission.submitted_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}</>
                      ) : (
                        '—'
                      )}
                      {status?.is_late && (
                        <span className="ml-2 font-medium text-red-600 dark:text-red-400">
                          Late{status.days_late ? ` · ${status.days_late}d` : ''}
                        </span>
                      )}
                    </p>
                  </div>

                  {isGraded && numericGrade !== null && (
                    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                      <div className="mb-2 flex items-center justify-between">
                        <h5 className="text-sm font-semibold text-gray-900 dark:text-white">Grade</h5>
                        <div className="flex items-center gap-2">
                          <Award className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <span className="text-lg font-bold text-green-600 dark:text-green-400">
                            {numericGrade}/{project.points_possible}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {gradePercent !== null ? `${gradePercent.toFixed(1)}%` : '—'}
                        {status?.graded_at && <> · Graded {new Date(status.graded_at).toLocaleDateString()}</>}
                      </p>
                    </div>
                  )}
                </div>

                {!needsRevision && (submission?.feedback || status?.feedback) && (
                  <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                    <h5 className="mb-3 flex items-center text-sm font-semibold text-gray-900 dark:text-white">
                      <span className="mr-2 rounded bg-blue-100 p-1 dark:bg-blue-900/50">
                        <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </span>
                      Instructor Feedback
                    </h5>
                    <div className="rounded-lg border-l-4 border-blue-500 bg-blue-50 p-4 dark:bg-blue-950/30">
                      <div className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                        <MarkdownRenderer
                          content={submission?.feedback || status?.feedback || ''}
                          variant="compact"
                          className="prose-sm leading-relaxed"
                        />
                      </div>
                      {status?.grader_name && (
                        <p className="mt-3 flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400">
                          <Award className="h-3 w-3" />
                          Graded by {status.grader_name}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Revision request */}
            {needsRevision && revisionPanel}

            {/* Action buttons */}
            <div className="flex w-full flex-col gap-3 border-t border-green-900/10 pt-4 sm:flex-row sm:gap-4 dark:border-white/10">
              {isGraded && !needsRevision ? (
                <>
                  <Button
                    onClick={() => openWorkspace(false)}
                    className="min-h-[3rem] w-full flex-1 transform justify-center border border-green-500/20 bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:from-green-700 hover:to-emerald-700 hover:shadow-xl sm:min-h-[4rem] sm:w-auto sm:px-6 sm:py-4 sm:text-lg md:py-6 md:text-xl"
                  >
                    <span className="mr-2 rounded-full bg-white/20 p-1 sm:mr-3">
                      <Award className="h-4 w-4 sm:h-5 sm:w-5" />
                    </span>
                    <span className="truncate">View Grade &amp; Feedback</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => window.open('/student/assessments', '_blank')}
                    className="min-h-[3rem] w-full border-2 px-3 py-3 hover:bg-gray-50 sm:min-h-[4rem] sm:w-auto sm:px-4 sm:py-4 md:px-6 md:py-6 dark:hover:bg-gray-800"
                  >
                    <FileText className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="hidden sm:inline">All Grades</span>
                    <span className="sm:hidden">Grades</span>
                  </Button>
                </>
              ) : isSubmitted ? (
                <>
                  <Button
                    onClick={() => openWorkspace(false)}
                    className="min-h-[3rem] w-full flex-1 transform justify-center border border-blue-500/20 bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:from-blue-700 hover:via-blue-800 hover:to-indigo-700 hover:shadow-xl sm:min-h-[4rem] sm:w-auto sm:px-6 sm:py-4 sm:text-lg md:py-6 md:text-xl"
                  >
                    <span className="flex w-full items-center justify-center">
                      <span className="mr-2 rounded-full bg-white/20 p-1 sm:mr-3">
                        <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                      </span>
                      <span className="truncate">View Submission</span>
                      {isPendingReview && (
                        <span className="ml-2 animate-pulse rounded-full bg-yellow-400/90 px-2 py-1 text-xs font-bold text-yellow-900">
                          <span className="hidden sm:inline">Under Review</span>
                          <span className="sm:hidden">Review</span>
                        </span>
                      )}
                    </span>
                  </Button>
                  {needsRevision && (
                    <Button
                      onClick={() => openWorkspace(true)}
                      disabled={!canResubmit}
                      className="min-h-[3rem] w-full flex-1 transform justify-center border border-orange-400/30 bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 px-4 py-3 text-sm font-bold text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:from-orange-600 hover:via-red-600 hover:to-pink-600 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-75 sm:min-h-[4rem] sm:w-auto sm:px-6 sm:py-4 sm:text-lg md:py-6 md:text-xl"
                    >
                      <span className="flex w-full items-center justify-center">
                        <span className="mr-2 rounded-full bg-white/20 p-1 sm:mr-3">
                          <Edit className="h-4 w-4 sm:h-5 sm:w-5" />
                        </span>
                        <span className="truncate">Resubmit Project</span>
                        <span className="ml-2 rounded-full bg-white/20 px-2 py-1 text-xs font-bold">Required</span>
                      </span>
                    </Button>
                  )}
                </>
              ) : (
                <Button
                  onClick={() => openWorkspace(true)}
                  className="min-h-[3rem] w-full flex-1 transform justify-center border border-green-500/20 bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 px-4 py-3 text-sm font-bold text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:from-green-700 hover:via-emerald-700 hover:to-teal-700 hover:shadow-xl sm:min-h-[4rem] sm:w-auto sm:px-6 sm:py-4 sm:text-lg md:py-6 md:text-xl"
                >
                  <span className="flex w-full items-center justify-center">
                    <span className="mr-2 rounded-full bg-white/20 p-1 sm:mr-3">
                      <Edit className="h-4 w-4 sm:h-5 sm:w-5" />
                    </span>
                    <span className="truncate hidden sm:inline">Start Project</span>
                    <span className="truncate sm:hidden">Start</span>
                    <span
                      className={`ml-2 rounded-full px-2 py-1 text-xs font-bold ${
                        isOverdue ? 'bg-red-500 text-white' : 'bg-white/20 text-white'
                      }`}
                    >
                      {isOverdue ? 'Overdue' : 'New'}
                    </span>
                  </span>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Workspace view: the hand-in workbench ── */}
      {mode === 'workspace' && (
        <div ref={workspaceRef} className="scroll-mt-4">
          <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 via-white to-emerald-50 shadow-xl dark:from-green-950 dark:via-gray-900 dark:to-emerald-950">
            <CardHeader className="border-b dark:border-gray-700">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge className="bg-green-600 text-white shadow-md hover:bg-green-700">
                      <FolderOpen className="mr-1 h-3 w-3" />
                      Workspace
                    </Badge>
                    {dueDate && due && (
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                          isOverdue && !isSubmitted && !isGraded
                            ? 'border-red-400 bg-red-100 text-red-800'
                            : 'border-gray-300 bg-white/70 text-gray-700 dark:border-white/15 dark:bg-white/[0.06] dark:text-gray-300'
                        }`}
                      >
                        <Calendar className="h-3 w-3" />
                        {isOverdue && !isSubmitted && !isGraded
                          ? `Overdue · ${due.relative}`
                          : `Due ${due.absolute} · ${due.relative}`}
                      </span>
                    )}
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${stateStyles.pill}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${stateStyles.dot}`} />
                      {stateStyles.label}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 sm:text-2xl dark:text-white">
                    {project.title}
                  </h3>
                  <p className="mt-1 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    {(editing || !isSubmitted) ? <Edit className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                    {(editing || !isSubmitted)
                      ? isSubmitted
                        ? 'Update and resubmit your project'
                        : 'Complete and submit your project'
                      : 'Your handed-in project'}
                  </p>
                </div>
                {(editing || !isSubmitted) && (
                  <Button
                    variant="ghost"
                    onClick={backToDetails}
                    disabled={submitting}
                    aria-label="Close submission form"
                    title="Close submission form"
                    className="h-11 w-11 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-6 p-6 sm:p-8">
              {(editing || !isSubmitted) && canResubmit ? (
                <>
                  {/* Notices */}
                  {dueDate && (isDueSoon || isOverdue) && !isSubmitted && (
                    <Alert
                      className={`shadow-md ${
                        isOverdue
                          ? 'border-2 border-red-400 bg-red-50 dark:bg-red-950/30'
                          : 'border-2 border-yellow-400 bg-yellow-50 dark:bg-yellow-950/30'
                      }`}
                    >
                      <AlertCircle
                        className={`h-6 w-6 flex-shrink-0 ${
                          isOverdue ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'
                        }`}
                      />
                      <AlertTitle
                        className={
                          isOverdue
                            ? 'text-red-800 dark:text-red-300'
                            : 'text-yellow-800 dark:text-yellow-300'
                        }
                      >
                        {isOverdue ? 'This project is overdue!' : 'Project due soon'}
                      </AlertTitle>
                      <AlertDescription
                        className={
                          isOverdue ? 'text-red-700 dark:text-red-200' : 'text-yellow-700 dark:text-yellow-200'
                        }
                      >
                        Due: {dueDate.toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </AlertDescription>
                    </Alert>
                  )}

                  {isSubmitted && needsRevision && (
                    <div className="overflow-hidden rounded-xl border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 shadow-md dark:from-orange-950/30 dark:to-amber-950/20">
                      <div className="flex items-center gap-2 bg-gradient-to-r from-orange-400 to-amber-400 px-4 py-2.5">
                        <Edit className="h-4 w-4 text-white" />
                        <h4 className="text-base font-bold text-white">Resubmitting Project</h4>
                      </div>
                      <div className="space-y-3 p-4 sm:p-5">
                        <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                          Review the feedback below and hand in your revised work.
                        </p>
                        {(submission?.modification_reason || project.modification_request_reason) && (
                          <div className="rounded-lg border border-orange-200 bg-white p-4 shadow-sm dark:border-orange-800/50 dark:bg-gray-800/70">
                            <MarkdownRenderer
                              content={submission?.modification_reason || project.modification_request_reason || ''}
                              variant="compact"
                              className="prose-sm leading-relaxed"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {formError && (
                    <Alert
                      ref={formErrorRef}
                      tabIndex={-1}
                      role="alert"
                      id={formErrorId}
                      className="border-2 border-red-400 bg-red-50 shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:bg-red-950/30"
                    >
                      <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                      <AlertTitle className="font-bold text-red-800 dark:text-red-300">
                        {isSubmitted ? 'Resubmission Error' : 'Submission Error'}
                      </AlertTitle>
                      <AlertDescription className="text-red-700 dark:text-red-200">{formError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-start">
                    {/* Left: the fields */}
                    <div className="min-w-0 space-y-6">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">Your work</p>
                        <h4 className="mt-1 text-base font-semibold text-gray-900 dark:text-white">
                          {isSubmitted ? 'Revise and resubmit' : 'Hand in your project'}
                        </h4>
                      </div>

                      {needsText && (
                        <div className="rounded-xl border-2 border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6">
                          <label
                            htmlFor={textAreaId}
                            className="mb-3 block text-base font-bold text-gray-900 flex items-center dark:text-white"
                          >
                            <span className="mr-2 rounded-lg bg-green-100 p-1.5 dark:bg-green-900">
                              <FileText className="h-4 w-4 text-green-600 dark:text-green-400" />
                            </span>
                            Written response <span className="ml-1 text-red-500">*</span>
                          </label>
                          <textarea
                            id={textAreaId}
                            value={textContent}
                            onChange={(e) => {
                              setTextContent(e.target.value);
                              setFormError(null);
                            }}
                            rows={10}
                            aria-invalid={formError ? true : undefined}
                            aria-describedby={formError ? formErrorId : undefined}
                            placeholder="Describe your project, link to your repository, or paste your write-up…"
                            className="w-full resize-none rounded-lg border-2 border-gray-300 px-4 py-3 text-base text-gray-900 transition-all focus:border-green-500 focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-green-400"
                          />
                          <div className="mt-3 flex justify-between text-sm">
                            <span className="font-medium text-gray-600 dark:text-gray-400">
                              {textContent.length} characters
                            </span>
                            <span className="font-medium text-gray-600 dark:text-gray-400">
                              {textContent.split(/\s+/).filter((w) => w.length > 0).length} words
                            </span>
                          </div>
                        </div>
                      )}

                      {needsFile && (
                        <div className="rounded-xl border-2 border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6">
                          <label
                            htmlFor={fileInputId}
                            className="mb-3 block text-base font-bold text-gray-900 flex items-center dark:text-white"
                          >
                            <span className="mr-2 rounded-lg bg-blue-100 p-1.5 dark:bg-blue-900">
                              <Upload className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            </span>
                            {submissionFormat === 'presentation' ? 'Presentation file' : 'File'}{' '}
                            {!needsText && <span className="ml-1 text-red-500">*</span>}
                          </label>

                          {file ? (
                            <div className="flex items-center justify-between gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2.5 dark:border-green-800 dark:bg-green-950/30">
                              <span className="flex min-w-0 items-center gap-2 text-sm text-gray-900 dark:text-gray-200">
                                <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-600 dark:text-green-400" />
                                <span className="truncate">{file.name}</span>
                                <span className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
                                  {FileUploadService.formatFileSize(file.size)}
                                </span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setFile(null)}
                                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30"
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
                            <div
                              onDragOver={(e) => {
                                e.preventDefault();
                                if (!submitting) setDragging(true);
                              }}
                              onDragLeave={() => setDragging(false)}
                              onDrop={handleFileDrop}
                              className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-500 ${
                                dragging
                                  ? 'border-green-400 bg-green-50 dark:bg-green-950/20'
                                  : 'border-gray-300 hover:border-green-400 hover:bg-green-50 dark:border-gray-600 dark:hover:bg-green-950/20'
                              }`}
                            >
                              <input
                                type="file"
                                id={fileInputId}
                                className="sr-only"
                                accept={fileAccept}
                                onChange={handleFileChange}
                                disabled={submitting}
                              />
                              <label htmlFor={fileInputId} className="cursor-pointer">
                                <div className="mx-auto mb-4 w-fit rounded-full bg-green-100 p-4 dark:bg-green-900">
                                  <Upload className="h-10 w-10 text-green-600 dark:text-green-400" />
                                </div>
                                <p className="text-base font-bold text-gray-900 dark:text-white">
                                  Click to upload or drag and drop
                                </p>
                                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                  Accepted:{' '}
                                  <span className="font-semibold">
                                    {allowedFileTypes.length > 0 ? allowedFileTypes.join(', ') : 'any type'}
                                  </span>
                                </p>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
                                  Maximum size: <span className="font-semibold">{maxFileSizeMB}MB</span> per file
                                </p>
                              </label>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Submit row */}
                      <div className="flex flex-col items-center justify-between gap-3 border-t-2 pt-4 dark:border-gray-700 sm:flex-row">
                        <Button
                          variant="outline"
                          onClick={backToDetails}
                          disabled={submitting}
                          className="w-full border-2 px-8 py-6 hover:bg-gray-50 sm:w-auto dark:hover:bg-gray-800"
                        >
                          <X className="mr-2 h-5 w-5" />
                          Cancel
                        </Button>
                        <Button
                          onClick={() => void handleSubmit()}
                          disabled={
                            submitting ||
                            (needsText && !textContent.trim()) ||
                            (needsFile && !file)
                          }
                          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 px-8 py-6 text-lg font-bold text-white shadow-lg transition-all hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 hover:from-green-700 hover:to-emerald-700 sm:w-auto"
                        >
                          {submitting ? (
                            <>
                              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                              {isSubmitted ? 'Resubmitting…' : 'Submitting…'}
                            </>
                          ) : (
                            <>
                              <Send className="mr-2 h-5 w-5" />
                              {isSubmitted ? 'Resubmit Project' : 'Hand in Project'}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Right: the rulebook */}
                    <aside className="space-y-4 self-start lg:sticky lg:top-4">
                      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                          Before you hand in
                        </p>
                        <ul className="mt-3 space-y-3">
                          {needsText && (
                            <CheckRow
                              done={!!textContent.trim()}
                              label="Written response"
                              hint={textContent.trim() ? 'Added' : 'Still empty'}
                            />
                          )}
                          {needsFile && (
                            <CheckRow
                              done={!!file}
                              label="File attached"
                              hint={
                                file
                                  ? file.name
                                  : `Max ${maxFileSizeMB} MB${allowedFileTypes.length > 0 ? ` · ${allowedFileTypes.join(', ')}` : ''}`
                              }
                            />
                          )}
                          {dueDate && due && (
                            <CheckRow
                              done={!isOverdue || isSubmitted || isGraded}
                              label="Deadline"
                              hint={`${due.absolute} · ${isOverdue && !isSubmitted && !isGraded ? 'passed' : due.relative}`}
                            />
                          )}
                        </ul>
                      </section>

                      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                          Hand-in rules
                        </p>
                        <dl className="mt-3 space-y-2.5 text-xs">
                          <div className="flex items-start justify-between gap-3">
                            <dt className="text-gray-500">Format</dt>
                            <dd className="text-right font-medium text-gray-900 dark:text-gray-100">
                              {requirements.label}
                            </dd>
                          </div>
                          {needsFile && (
                            <div className="flex items-start justify-between gap-3">
                              <dt className="text-gray-500">Files</dt>
                              <dd className="text-right font-medium text-gray-900 dark:text-gray-100">
                                {allowedFileTypes.length > 0 ? allowedFileTypes.join(', ') : 'Any type'}
                                <span className="block font-normal text-gray-500">up to {maxFileSizeMB} MB</span>
                              </dd>
                            </div>
                          )}
                          {project.points_possible > 0 && (
                            <div className="flex items-start justify-between gap-3">
                              <dt className="text-gray-500">Points</dt>
                              <dd className="text-right font-medium text-gray-900 dark:text-gray-100">
                                {project.points_possible}
                              </dd>
                            </div>
                          )}
                          {dueDate && due && (
                            <div className="flex items-start justify-between gap-3">
                              <dt className="text-gray-500">Due</dt>
                              <dd className="text-right font-medium text-gray-900 dark:text-gray-100">
                                {due.absolute}
                                <span className="block font-normal text-gray-500">{due.relative}</span>
                              </dd>
                            </div>
                          )}
                          {project.collaboration_allowed && (
                            <div className="flex items-start justify-between gap-3">
                              <dt className="text-gray-500">Team</dt>
                              <dd className="text-right font-medium text-gray-900 dark:text-gray-100">
                                Up to {project.max_team_size} students
                              </dd>
                            </div>
                          )}
                        </dl>
                      </section>
                    </aside>
                  </div>
                </>
              ) : (
                /* Receipt: celebration state + what was handed in + the result */
                submission && (
                  <div>
                    <div className="mb-6 text-center">
                      <div className="relative mb-4 inline-block">
                        <div className="flex h-20 w-20 animate-pulse items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg">
                          <CheckCircle className="h-10 w-10 text-white" />
                        </div>
                        {isGraded && (
                          <div className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-yellow-400 shadow-md">
                            <Award className="h-5 w-5 text-yellow-900" />
                          </div>
                        )}
                      </div>
                      <h3 className="mb-2 flex items-center justify-center gap-2.5 text-2xl font-bold text-gray-900 sm:text-3xl dark:text-white">
                        {isGraded ? (
                          <>
                            <PartyPopper className="h-7 w-7 text-green-600 dark:text-green-400" aria-hidden="true" />
                            Project Graded!
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-7 w-7 text-green-600 dark:text-green-400" aria-hidden="true" />
                            Project Submitted!
                          </>
                        )}
                      </h3>
                      <p className="mx-auto max-w-2xl text-sm text-gray-700 sm:text-base dark:text-gray-300">
                        {isGraded
                          ? 'Your instructor has reviewed and graded your project. View your results below.'
                          : 'Your project has been successfully submitted and is now being reviewed by your instructor. You will be notified when grading is complete.'}
                      </p>
                    </div>

                    {/* Submitted-at / status */}
                    <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-md dark:border-gray-700 dark:bg-gray-800">
                      <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 sm:text-base">
                        <div>
                          <p className="mb-1 font-medium text-gray-600 dark:text-gray-400">Handed in at</p>
                          <p className="font-bold text-gray-900 dark:text-white">
                            {submission.submitted_at
                              ? new Date(submission.submitted_at).toLocaleString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : new Date().toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="mb-1 font-medium text-gray-600 dark:text-gray-400">Status</p>
                          <Badge
                            className={`text-base font-semibold ${
                              isGraded
                                ? 'border-green-300 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                : needsRevision
                                  ? 'border-orange-300 bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
                                  : 'border-yellow-300 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                            }`}
                          >
                            {isGraded ? (
                              <>
                                <CheckCircle className="mr-1.5 h-4 w-4" aria-hidden="true" />
                                Graded
                              </>
                            ) : needsRevision ? (
                              <>
                                <AlertTriangle className="mr-1.5 h-4 w-4" aria-hidden="true" />
                                Needs Revision
                              </>
                            ) : (
                              <>
                                <Clock className="mr-1.5 h-4 w-4" aria-hidden="true" />
                                Under Review
                              </>
                            )}
                          </Badge>
                          {status?.is_late && (
                            <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                              Late{status.days_late ? ` · ${status.days_late}d` : ''}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* The work that was handed in */}
                    {(attachments.length > 0 || submission.text_content) && (
                      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-md dark:border-gray-700 dark:bg-gray-800">
                        <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                          <Paperclip className="h-4 w-4 text-green-600 dark:text-green-400" />
                          Your submission
                        </p>
                        {attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {attachments.map((attachment, index) => (
                              <a
                                key={`${attachment.url}-${index}`}
                                href={attachment.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex max-w-full items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 transition-colors hover:border-blue-400 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-900/40"
                              >
                                <Link2 className="h-4 w-4 flex-shrink-0" />
                                <span className="truncate">
                                  {attachment.name || submission.file_name || 'Attached file'}
                                </span>
                              </a>
                            ))}
                          </div>
                        )}
                        {submission.text_content && (
                          <div className="mt-3 max-w-[70ch] rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-300">
                            <MarkdownRenderer
                              content={submission.text_content}
                              variant="compact"
                              className="prose-sm leading-relaxed"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Grade */}
                    {isGraded && numericGrade !== null && (
                      <div className="mb-6 rounded-xl border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-6 shadow-lg dark:border-green-700 dark:from-green-950/30 dark:to-emerald-950/30 sm:p-8">
                        <div className="mb-4 text-center">
                          <div className="mb-3 flex justify-center">
                            <div className="rounded-full bg-green-100 p-3 dark:bg-green-900">
                              <Award className="h-8 w-8 text-green-600 dark:text-green-400" />
                            </div>
                          </div>
                          <p className="mb-2 text-xl font-bold text-gray-900 sm:text-2xl dark:text-white">
                            {numericGrade} / {project.points_possible} Points
                          </p>
                          {gradePercent !== null && (
                            <p className="text-lg font-semibold text-green-600 sm:text-xl dark:text-green-400">
                              {gradePercent.toFixed(1)}%
                            </p>
                          )}
                        </div>

                        {gradePercent !== null && (
                          <div className="mb-2 mt-4">
                            <div className="mb-1.5 flex justify-between text-xs font-medium text-gray-500 dark:text-gray-400">
                              <span>0%</span>
                              <span>100%</span>
                            </div>
                            <div
                              className="relative h-3 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
                              role="progressbar"
                              aria-valuenow={Math.min(100, Math.max(0, Math.round(gradePercent)))}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuetext={`${gradePercent.toFixed(1)}%`}
                              aria-label="Project score"
                            >
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-700 ease-out"
                                style={{ width: `${Math.min(Math.max(gradePercent, 0), 100)}%` }}
                              />
                            </div>
                            <p className="mt-1.5 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                              Score out of {project.points_possible} points
                            </p>
                          </div>
                        )}

                        {status?.graded_at && (
                          <div className="mt-4 rounded-lg bg-white/50 px-4 py-2 text-center text-sm text-gray-600 dark:bg-gray-800/50 dark:text-gray-400">
                            Graded on {new Date(status.graded_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                            {status?.grader_name ? ` by ${status.grader_name}` : ''}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Feedback */}
                    {!needsRevision && (submission.feedback || status?.feedback) && (
                      <div className="mb-6 rounded-xl border-l-4 border-blue-500 bg-blue-50 p-5 shadow-md dark:bg-blue-950/30 sm:p-6">
                        <h4 className="mb-4 flex items-center text-base font-bold text-gray-900 sm:text-lg dark:text-white">
                          <span className="mr-3 rounded-lg bg-blue-100 p-1.5 dark:bg-blue-900">
                            <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          </span>
                          Instructor Feedback
                        </h4>
                        <div className="rounded-lg border border-blue-100 bg-white/70 p-4 sm:p-5 dark:border-blue-900/50 dark:bg-gray-800/50">
                          <div className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                            <MarkdownRenderer
                              content={submission.feedback || status?.feedback || ''}
                              variant="compact"
                              className="prose-sm leading-relaxed"
                            />
                          </div>
                          {status?.grader_name && (
                            <p className="mt-3 flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400">
                              <Award className="h-3 w-3" />
                              Graded by {status.grader_name}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Revision request */}
                    {needsRevision && revisionPanel}

                    {/* Actions */}
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Button
                        variant="outline"
                        onClick={backToDetails}
                        className="flex-1 border-2 py-6 text-base hover:bg-gray-50 sm:flex-none dark:hover:bg-gray-800"
                      >
                        <ArrowLeft className="mr-2 h-5 w-5" />
                        Back to details
                      </Button>
                      {isGraded && (
                        <Button
                          variant="outline"
                          onClick={() => window.open('/student/assessments', '_blank')}
                          className="flex-1 border-2 py-6 text-base hover:bg-gray-50 sm:flex-none dark:hover:bg-gray-800"
                        >
                          <Award className="mr-2 h-5 w-5" />
                          All Grades
                        </Button>
                      )}
                      {canResubmit && (
                        <Button
                          onClick={() => openWorkspace(true)}
                          className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 py-6 text-base font-bold text-white shadow-lg hover:shadow-xl sm:flex-none hover:from-green-700 hover:to-emerald-700"
                        >
                          <Edit className="mr-2 h-5 w-5" />
                          {needsRevision ? 'Start revision' : 'Resubmit Project'}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Team roster + team chat room */}
      {project.collaboration_allowed && <TeamSection projectId={projectId} />}
    </div>
  );
};

export default ProjectPanel;
