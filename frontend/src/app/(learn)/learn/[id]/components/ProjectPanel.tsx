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

interface ProjectPanelProps {
  projectId: number;
  onSubmit?: (payload: { textContent?: string; fileUrl?: string }) => void;
  onSubmitComplete?: (projectId: number) => void;
}

type PanelMode = 'view' | 'submit';

const MAX_PROJECT_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

export const ProjectPanel: React.FC<ProjectPanelProps> = ({
  projectId,
  onSubmit,
  onSubmitComplete,
}) => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectWithStatus | null>(null);
  const [submission, setSubmission] = useState<SubmissionDetail['submission'] | null>(null);
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
      setProject(detail.project);
      setSubmission(detail.submission ?? null);
      // Default to the submit form when nothing has been submitted yet
      setMode(detail.submission?.submitted_at || detail.project.submission_status?.submitted ? 'view' : 'submit');
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
  const isSubmitted = !!submission?.submitted_at || !!status?.submitted;
  const isGraded = status?.status === 'graded';
  const needsRevision = status?.status === 'needs_revision';
  const canResubmit = !!project?.can_resubmit || needsRevision || !isSubmitted;
  const dueDate = project?.due_date ? new Date(project.due_date) : null;
  const isOverdue = dueDate ? dueDate.getTime() < Date.now() : false;
  // Only trust an explicitly numeric grade — never fabricate a 0
  const rawGrade = submission?.grade ?? status?.grade;
  const numericGrade = typeof rawGrade === 'number' && Number.isFinite(rawGrade) ? rawGrade : null;

  const statusBadge = (() => {
    if (isGraded) return { label: 'Graded', className: 'bg-emerald-950/50 text-emerald-300 border-emerald-500/30' };
    if (needsRevision) return { label: 'Needs Revision', className: 'bg-amber-950/50 text-amber-300 border-amber-500/30' };
    if (isSubmitted) return { label: 'Submitted', className: 'bg-blue-950/50 text-blue-300 border-blue-500/30' };
    if (isOverdue) return { label: 'Overdue', className: 'bg-red-950/50 text-red-300 border-red-500/30' };
    return { label: 'Not Submitted', className: 'bg-white/[0.04] text-gray-400 border-white/10' };
  })();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    if (selected && selected.size > MAX_PROJECT_FILE_SIZE_BYTES) {
      const message = `${selected.name} is ${FileUploadService.formatFileSize(selected.size)} — the maximum allowed file size is ${FileUploadService.formatFileSize(MAX_PROJECT_FILE_SIZE_BYTES)}.`;
      setFile(null);
      setFormError(message);
      toast.error(message);
    } else {
      setFile(selected);
      setFormError(null);
    }
    event.target.value = '';
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (!textContent.trim() && !file) {
      const message = 'Add a written response or attach a file before submitting.';
      setFormError(message);
      toast.error(message);
      return;
    }
    if (file && file.size > MAX_PROJECT_FILE_SIZE_BYTES) {
      const message = `${file.name} is ${FileUploadService.formatFileSize(file.size)} — the maximum allowed file size is ${FileUploadService.formatFileSize(MAX_PROJECT_FILE_SIZE_BYTES)}.`;
      setFormError(message);
      toast.error(message);
      return;
    }
    setFormError(null);
    try {
      setSubmitting(true);
      let fileUrl: string | undefined;
      if (file) {
        const uploaded = await FileUploadService.uploadFile(file, {
          maxSize: MAX_PROJECT_FILE_SIZE_BYTES,
        });
        fileUrl = uploaded?.url;
      }
      await StudentSubmissionService.submitProject(projectId, {
        text_content: textContent.trim() || undefined,
        file_url: fileUrl,
      });
      toast.success('Project submitted successfully.');
      onSubmit?.({ textContent: textContent.trim() || undefined, fileUrl });
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
          <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{project.description}</p>
        )}

        {project.objectives && (
          <div className="rounded-xl border border-blue-500/15 bg-blue-500/[0.06] p-3 sm:p-4">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
              <Target className="h-4 w-4 text-blue-300" />
              Objectives
            </h4>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{project.objectives}</p>
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
                  <div className="min-w-0">
                    <span className="break-words">{task.text}</span>
                    {task.is_optional && (
                      <Badge variant="outline" className="ml-2 text-xs bg-white/[0.04] text-gray-400 border-white/10">
                        optional
                      </Badge>
                    )}
                    {task.description && (
                      <p className="text-xs text-gray-400 mt-0.5 whitespace-pre-wrap">{task.description}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {project.submission_format && (
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Accepted format: <span className="text-gray-300">{project.submission_format}</span>
          </p>
        )}

        {needsRevision && (
          <Alert className="bg-amber-950/30 border-amber-500/25">
            <AlertCircle className="h-4 w-4 text-amber-400" />
            <AlertTitle className="text-amber-300">Revision requested</AlertTitle>
            <AlertDescription className="text-gray-300">
              {submission?.modification_reason || status?.feedback || 'Your instructor asked for changes. Update your work and resubmit.'}
            </AlertDescription>
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
            {submission.file_url && (
              <a
                href={submission.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-blue-400 hover:text-blue-300 hover:underline truncate"
              >
                <Link2 className="h-4 w-4 flex-shrink-0" />
                {submission.file_name || 'Attached file'}
              </a>
            )}
          </div>
          {submission.text_content && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="text-sm text-gray-300 whitespace-pre-wrap break-words">{submission.text_content}</p>
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
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{submission.feedback || status?.feedback}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Submission form */}
      {mode === 'submit' && canResubmit && (
        <div className="rounded-2xl border border-white/[0.07] bg-gray-900 p-4 sm:p-5 space-y-4">
          <h4 className="text-sm font-semibold text-white">Submit your work</h4>
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
          <div className="space-y-1.5">
            <label htmlFor={fileInputId} className="text-xs font-medium text-gray-300">
              Attach a file (optional)
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
                  onChange={handleFileChange}
                  disabled={submitting}
                />
              </label>
            )}
          </div>
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
              'Submit Project'
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
