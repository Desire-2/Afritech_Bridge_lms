import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Loader2, FolderOpen, UploadCloud, CheckCircle, Clock, AlertCircle,
  Target, ListChecks, Calendar, Award, Link2, FileText, X
} from 'lucide-react';
import { toast } from 'sonner';
import StudentSubmissionService, {
  ProjectWithStatus,
  SubmissionDetail,
} from '@/services/student-submission.service';
import { FileUploadService } from '@/services/file-upload.service';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';
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

  const formErrorRef = useRef<HTMLDivElement>(null);
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

  const statusBadge = (() => {
    if (isGraded) return { label: 'Graded', className: 'bg-emerald-950/50 text-emerald-300 border-emerald-500/30' };
    if (needsRevision) return { label: 'Needs Revision', className: 'bg-amber-950/50 text-amber-300 border-amber-500/30' };
    if (isSubmitted) return { label: 'Submitted', className: 'bg-blue-950/50 text-blue-300 border-blue-500/30' };
    if (isOverdue) return { label: 'Overdue', className: 'bg-red-950/50 text-red-300 border-red-500/30' };
    return { label: 'Not Submitted', className: 'bg-white/[0.04] text-gray-400 border-white/10' };
  })();

  const rejectFile = (message: string) => {
    setFile(null);
    setFormError(message);
    toast.error(message);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    if (selected) {
      if (selected.size > maxFileSizeBytes) {
        rejectFile(`${selected.name} is ${FileUploadService.formatFileSize(selected.size)} — the maximum allowed file size is ${FileUploadService.formatFileSize(maxFileSizeBytes)}.`);
      } else {
        if (!isFileTypeAllowed(selected.name, allowedFileTypes)) {
          rejectFile(`${selected.name} is not an accepted file type. Allowed: ${allowedFileTypes.join(', ')}.`);
        } else {
          setFile(selected);
          setFormError(null);
        }
      }
    }
    event.target.value = '';
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
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400 mb-3" />
        <p className="text-sm">Loading project…</p>
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
      {/* Project overview */}
      <div className="rounded-2xl border border-white/[0.07] bg-gray-900 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="rounded-lg border border-blue-500/25 bg-blue-500/10 p-2 flex-shrink-0">
              <FolderOpen className="h-5 w-5 text-blue-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-white break-words">{project.title}</h3>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <Badge variant="outline" className={`text-xs ${statusBadge.className}`}>
                  {statusBadge.label}
                </Badge>
                {project.points_possible > 0 && (
                  <Badge variant="outline" className="text-xs bg-white/[0.04] text-gray-400 border-white/10">
                    <Award className="h-3 w-3 mr-1" />
                    {project.points_possible} pts
                  </Badge>
                )}
                {dueDate && (
                  <Badge variant="outline" className={`text-xs ${isOverdue && !isSubmitted ? 'bg-red-950/50 text-red-300 border-red-500/30' : 'bg-white/[0.04] text-gray-400 border-white/10'}`}>
                    <Calendar className="h-3 w-3 mr-1" />
                    Due {dueDate.toLocaleDateString()}
                  </Badge>
                )}
                {project.collaboration_allowed && (
                  <Badge variant="outline" className="text-xs bg-white/[0.04] text-gray-400 border-white/10">
                    Team up to {project.max_team_size}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {canResubmit && (
            <Button
              size="sm"
              onClick={() => {
                setFormError(null);
                setMode(mode === 'submit' ? 'view' : 'submit');
              }}
              className={`flex-shrink-0 ${
                mode === 'submit'
                  ? 'shadow-none border border-white/10 bg-transparent text-gray-300 hover:bg-white/[0.06] hover:text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-500'
              }`}
            >
              {mode === 'submit' ? 'Cancel' : isSubmitted ? 'Resubmit' : 'Start Project'}
            </Button>
          )}
        </div>

        {project.description && (
          <div className="text-sm text-gray-300 leading-relaxed">
            <MarkdownRenderer
              content={project.description}
              variant="compact"
              className="prose-sm leading-relaxed"
            />
          </div>
        )}

        {project.objectives && (
          <div className="rounded-xl border border-blue-500/15 bg-blue-500/[0.06] p-3 sm:p-4">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
              <Target className="h-4 w-4 text-blue-300" />
              Objectives
            </h4>
            <div className="text-sm text-gray-300">
              <MarkdownRenderer
                content={project.objectives}
                variant="compact"
                className="prose-sm leading-relaxed"
              />
            </div>
          </div>
        )}

        {project.tasks && project.tasks.length > 0 && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 sm:p-4">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
              <ListChecks className="h-4 w-4 text-blue-300" />
              Tasks
            </h4>
            <ul className="space-y-2">
              {project.tasks.map((task, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-gray-300">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-400/75 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="break-words">{task.text}</span>
                    {task.is_optional && (
                      <Badge variant="outline" className="ml-2 text-xs bg-white/[0.04] text-gray-400 border-white/10">
                        optional
                      </Badge>
                    )}
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
            </ul>
          </div>
        )}

        {project.submission_format && (
          <div className="space-y-1">
            <p className="text-xs text-gray-400 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Submission: <span className="text-gray-300">{requirements.label}</span>
            </p>
            {needsFile && (
              <p className="text-xs text-gray-500 pl-5">
                Up to {maxFileSizeMB} MB
                {allowedFileTypes.length > 0 && <> · {allowedFileTypes.join(', ')}</>}
              </p>
            )}
          </div>
        )}

        {needsRevision && (
          <Alert className="bg-amber-950/30 border-amber-500/25">
            <AlertCircle className="h-4 w-4 text-amber-400" />
            <AlertTitle className="text-amber-300">Revision requested</AlertTitle>
            <div className="text-sm text-gray-300">
              <MarkdownRenderer
                content={submission?.modification_reason || status?.feedback || 'Your instructor asked for changes. Update your work and resubmit.'}
                variant="compact"
                className="prose-sm leading-relaxed"
              />
            </div>
          </Alert>
        )}
      </div>

      {/* Submission status / result */}
      {isSubmitted && submission && (
        <div className="rounded-2xl border border-white/[0.07] bg-gray-900 p-4 sm:p-5 space-y-3">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
            <CheckCircle className="h-4 w-4 text-emerald-400" />
            Your submission
          </h4>
          <div className="grid gap-2 text-sm text-gray-300 sm:grid-cols-2">
            <p className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" />
              {submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : '—'}
            </p>
            {attachments.map((attachment, index) => (
              <a
                key={`${attachment.url}-${index}`}
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-blue-400 hover:text-blue-300 hover:underline truncate"
              >
                <Link2 className="h-4 w-4 flex-shrink-0" />
                {attachment.name || submission.file_name || 'Attached file'}
              </a>
            ))}
          </div>
          {submission.text_content && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-sm text-gray-300">
              <MarkdownRenderer
                content={submission.text_content}
                variant="compact"
                className="prose-sm leading-relaxed"
              />
            </div>
          )}
          {isGraded && (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/30 p-3 space-y-1.5">
              {numericGrade !== null ? (
                <p className="text-sm text-emerald-300 font-semibold">
                  Grade: {numericGrade}
                  {project.points_possible > 0 ? ` / ${project.points_possible}` : ''}
                </p>
              ) : (
                <p className="text-sm text-emerald-300 font-semibold">{statusBadge.label}</p>
              )}
              {(submission.feedback || status?.feedback) && (
                <div className="text-sm text-gray-300">
                  <MarkdownRenderer
                    content={submission.feedback || status?.feedback || ''}
                    variant="compact"
                    className="prose-sm leading-relaxed"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Submission form */}
      {mode === 'submit' && canResubmit && (
        <div className="rounded-2xl border border-white/[0.07] bg-gray-900 p-4 sm:p-5 space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-white">
              {isSubmitted ? 'Resubmit your work' : 'Start your project'}
            </h4>
            <p className="mt-1 text-xs text-gray-400">
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
                rows={6}
                aria-invalid={formError ? true : undefined}
                aria-describedby={formError ? formErrorId : undefined}
                placeholder="Describe your project, link to your repository, or paste your write-up…"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-gray-200 placeholder-gray-400 focus:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y"
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
                  <span className="text-sm text-gray-300 truncate flex items-center gap-2">
                    <UploadCloud className="h-4 w-4 text-blue-300 flex-shrink-0" />
                    {file.name}
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
                  className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-3 py-3 text-sm text-gray-400 hover:border-blue-500/60 hover:text-gray-200 transition-colors focus-within:border-blue-500/60 focus-within:text-gray-200 focus-within:ring-2 focus-within:ring-blue-500/40"
                >
                  <UploadCloud className="h-4 w-4" />
                  Choose a file
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
              <p className="text-xs text-gray-500">
                Max {maxFileSizeMB} MB
                {allowedFileTypes.length > 0 && <> · {allowedFileTypes.join(', ')}</>}
              </p>
            </div>
          )}

          <Button
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="bg-blue-600 text-white hover:bg-blue-500"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Submitting…
              </>
            ) : (
              isSubmitted ? 'Resubmit Project' : 'Submit Project'
            )}
          </Button>
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
    </div>
  );
};

export default ProjectPanel;
