'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { StudentSubmissionService, SubmissionDetail } from '@/services/student-submission.service';
import { FileUploadService } from '@/services/file-upload.service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';
import {
  getSubmissionRequirements,
  getFileRules,
  isSubmissionHandedIn,
  isFileTypeAllowed,
  parseAttachments,
} from '@/lib/project-submission';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Edit3,
  RefreshCw,
  CheckCircle2,
  Clock,
  FileText,
  Calendar,
  Award,
  Upload,
  Send,
  BookOpen,
  Users,
  Target,
  X,
} from 'lucide-react';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = Number(params.id);

  const [data, setData] = useState<SubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [textContent, setTextContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const fetchProject = useCallback(async () => {
    if (!projectId || isNaN(projectId)) {
      setError('Invalid project ID');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await StudentSubmissionService.getProjectDetails(projectId);
      setData(res);
    } catch (err: any) {
      console.error('Error fetching project:', err);
      setError(err?.message || 'Failed to load project details');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const handleSubmit = async () => {
    const project = data?.project;
    const requirements = getSubmissionRequirements(project?.submission_format);
    const rules = getFileRules(project);
    const hasText = !!textContent.trim();

    if (requirements.needsText && !requirements.needsFile && !hasText) {
      setSubmitError('Please add your written response before submitting.');
      return;
    }
    if (requirements.needsFile && !requirements.needsText && !file) {
      setSubmitError(
        `Please attach your ${requirements.format === 'presentation' ? 'presentation' : 'file'} before submitting.`,
      );
      return;
    }
    if (requirements.needsText && requirements.needsFile && (!hasText || !file)) {
      setSubmitError('Please add a written response and attach a file before submitting.');
      return;
    }
    if (!requirements.needsText && !requirements.needsFile && !hasText && !file) {
      setSubmitError('Please add your work before submitting.');
      return;
    }
    if (file) {
      if (file.size > rules.maxFileSizeBytes) {
        setSubmitError(
          `${file.name} is ${FileUploadService.formatFileSize(file.size)} — the maximum allowed file size is ${FileUploadService.formatFileSize(rules.maxFileSizeBytes)}.`,
        );
        return;
      }
      if (!isFileTypeAllowed(file.name, rules.allowedFileTypes)) {
        setSubmitError(
          `${file.name} is not an accepted file type. Allowed: ${rules.allowedFileTypes.join(', ')}.`,
        );
        return;
      }
    }

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);
    try {
      let fileUrl: string | undefined;
      if (file) {
        const uploaded = await FileUploadService.uploadFile(file, {
          maxSize: rules.maxFileSizeBytes,
        });
        fileUrl = uploaded?.url;
      }
      await StudentSubmissionService.submitProject(projectId, {
        text_content: hasText ? textContent.trim() : undefined,
        file_url: fileUrl,
      });
      setSubmitSuccess(true);
      setTextContent('');
      setFile(null);
      fetchProject();
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to submit project');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    if (selected) {
      const rules = getFileRules(data?.project);
      if (selected.size > rules.maxFileSizeBytes) {
        setFile(null);
        setSubmitError(
          `${selected.name} is ${FileUploadService.formatFileSize(selected.size)} — the maximum allowed file size is ${FileUploadService.formatFileSize(rules.maxFileSizeBytes)}.`,
        );
      } else if (!isFileTypeAllowed(selected.name, rules.allowedFileTypes)) {
        setFile(null);
        setSubmitError(
          `${selected.name} is not an accepted file type. Allowed: ${rules.allowedFileTypes.join(', ')}.`,
        );
      } else {
        setFile(selected);
        setSubmitError(null);
      }
    }
    event.target.value = '';
  };

  // ── Loading ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-purple-600 mx-auto" />
          <p className="text-gray-600 dark:text-gray-400">Loading project...</p>
        </div>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────
  if (error || !data?.project) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <Button variant="ghost" onClick={() => router.push('/student/assessments?tab=projects')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Assessments
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error || 'Project not found'}</AlertDescription>
        </Alert>
        <Button onClick={fetchProject} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const project = data.project;
  const submission = data.submission;
  const status = project.submission_status;
  const requirements = getSubmissionRequirements(project.submission_format);
  const rules = getFileRules(project);
  const needsRevision =
    status?.status === 'needs_revision' ||
    (!!project.modification_requested && !!project.can_resubmit);
  const isGraded = status?.status === 'graded';
  // An instructor-scaffolded team row has no content and no grade; it must
  // not read as submitted or the form below never appears.
  const isSubmitted = isSubmissionHandedIn(submission);
  const canSubmit = !isSubmitted || needsRevision;
  const attachments = parseAttachments(
    submission?.file_path || submission?.file_url,
    submission?.file_name,
  );
  const hasResponse = !!textContent.trim();
  const missingRequiredWork =
    (requirements.needsText && !requirements.needsFile && !hasResponse) ||
    (requirements.needsFile && !requirements.needsText && !file) ||
    (requirements.needsText && requirements.needsFile && (!hasResponse || !file)) ||
    (!requirements.needsText && !requirements.needsFile && !hasResponse && !file);

  const pct =
    status?.grade != null && project.points_possible
      ? (status.grade / project.points_possible) * 100
      : null;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
      {/* Back Navigation */}
      <Button
        variant="ghost"
        onClick={() => router.push('/student/assessments?tab=projects')}
        className="mb-2"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Assessments
      </Button>

      {/* Needs Revision Banner */}
      {needsRevision && (
        <Alert className="border-orange-300 bg-orange-50 dark:bg-orange-950/20">
          <Edit3 className="h-4 w-4 text-orange-600" />
          <AlertTitle className="text-orange-800 dark:text-orange-300">
            Revision Requested
          </AlertTitle>
          <AlertDescription className="text-orange-700 dark:text-orange-400">
            <MarkdownRenderer
              variant="compact"
              className="prose-sm leading-relaxed"
              content={
                project.modification_request_reason ||
                'Your instructor has requested modifications to your submission. Please review the feedback and resubmit.'
              }
            />
          </AlertDescription>
        </Alert>
      )}

      {/* Project Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <CardTitle className="text-xl flex items-center gap-2">
                <Award className="w-5 h-5 text-purple-600 flex-shrink-0" />
                {project.title}
              </CardTitle>
              <CardDescription className="mt-2 space-y-1">
                <span className="flex items-center gap-1.5 text-sm">
                  <BookOpen className="w-4 h-4" />
                  {project.course_title}
                </span>
                {project.module_titles && project.module_titles.length > 0 && (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Target className="w-4 h-4" />
                    Modules: {project.module_titles.join(', ')}
                  </span>
                )}
                <span className="flex items-center gap-1.5 text-sm">
                  <Calendar className="w-4 h-4" />
                  Due{' '}
                  {new Date(project.due_date).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                {project.collaboration_allowed && (
                  <span className="flex items-center gap-1.5 text-sm">
                    <Users className="w-4 h-4" />
                    Team project (max {project.max_team_size} members)
                  </span>
                )}
                {project.collaboration_allowed && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/student/projects/${project.id}/team`);
                    }}
                    className="mt-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    <Users className="w-3 h-3" />
                    View My Team
                  </button>
                )}
              </CardDescription>
            </div>
            <div className="flex flex-col items-end gap-2">
              <StatusBadge status={status?.status} />
              <Badge variant="outline">{project.points_possible} pts</Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Description & Objectives */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Description</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-[72ch] text-sm">
            <MarkdownRenderer
              content={project.description || ''}
              variant="compact"
              className="prose-sm leading-relaxed"
            />
          </div>
          {project.objectives && (
            <>
              <h4 className="text-sm font-semibold mt-4">Learning Objectives</h4>
              <div className="max-w-[72ch] text-sm">
                <MarkdownRenderer
                  content={project.objectives}
                  variant="compact"
                  className="prose-sm leading-relaxed"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Project Tasks / Checklist */}
      {project.tasks && project.tasks.length > 0 && (
        <Card className="border-emerald-200 dark:border-emerald-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Project Tasks / Checklist
            </CardTitle>
            <CardDescription>
              Complete each task below to finish this project
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {project.tasks.map((task: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="w-5 h-5 rounded-full border-2 border-emerald-400 dark:border-emerald-600 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 dark:bg-emerald-600" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {task.text}
                      {task.is_optional && (
                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 uppercase">
                          Optional
                        </span>
                      )}
                    </p>
                    {task.description && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        <MarkdownRenderer
                          content={task.description}
                          variant="compact"
                          className="prose-sm leading-relaxed"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grade Card (if graded) */}
      {isGraded && pct !== null && (
        <Card className="border-green-200 dark:border-green-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-green-700 dark:text-green-300">
              <CheckCircle2 className="w-5 h-5" />
              Grade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between bg-green-50 dark:bg-green-950/30 rounded-lg px-4 py-3">
              <span className="text-sm text-muted-foreground">Score</span>
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold">
                  {status.grade}/{project.points_possible} ({pct.toFixed(1)}%)
                </span>
                <span
                  className={`text-2xl font-bold ${
                    pct >= 90
                      ? 'text-green-600'
                      : pct >= 80
                      ? 'text-emerald-600'
                      : pct >= 70
                      ? 'text-blue-600'
                      : pct >= 60
                      ? 'text-yellow-600'
                      : 'text-red-600'
                  }`}
                >
                  {StudentSubmissionService.getLetterGrade(pct)}
                </span>
              </div>
            </div>
            {status?.feedback && (
              <div className="mt-3 bg-muted/50 rounded-lg px-4 py-3">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Instructor Feedback</p>
                <div className="text-sm">
                  <MarkdownRenderer
                    content={status.feedback}
                    variant="compact"
                    className="prose-sm leading-relaxed"
                  />
                </div>
                {status.grader_name && (
                  <p className="text-xs text-muted-foreground mt-2">— {status.grader_name}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Previous Submission */}
      {isSubmitted && submission && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Your Submission
            </CardTitle>
            <CardDescription>
              {submission.submitted_at ? (
                <>
                  Submitted on{' '}
                  {new Date(submission.submitted_at).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </>
              ) : (
                'Handed in'
              )}
              {submission.is_late && (
                <Badge variant="destructive" className="ml-2 text-[10px]">
                  Late
                </Badge>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {submission.text_content && (
              <div className="bg-muted/50 rounded-lg px-4 py-3">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Response</p>
                <div className="text-sm">
                  <MarkdownRenderer
                    content={submission.text_content}
                    variant="compact"
                    className="prose-sm leading-relaxed"
                  />
                </div>
              </div>
            )}
            {attachments.map((attachment, index) => (
              <div
                key={`${attachment.url}-${index}`}
                className="flex items-center gap-2 bg-muted/50 rounded-lg px-4 py-3"
              >
                <Upload className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">
                  {attachment.name || submission.file_name || 'Uploaded file'}
                </span>
                <a
                  href={attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline ml-auto"
                >
                  View File
                </a>
              </div>
            ))}
            {submission.feedback && !isGraded && (
              <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg px-4 py-3">
                <p className="text-xs font-semibold text-orange-800 dark:text-orange-300 mb-1">
                  Feedback
                </p>
                <div className="text-sm text-orange-700 dark:text-orange-400">
                  <MarkdownRenderer
                    content={submission.feedback}
                    variant="compact"
                    className="prose-sm leading-relaxed"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Submit / Resubmit Form */}
      {canSubmit && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {needsRevision ? 'Resubmit Project' : 'Submit Project'}
            </CardTitle>
            <CardDescription>
              {requirements.needsText && requirements.needsFile
                ? 'Provide your project response and upload a file.'
                : requirements.needsFile
                  ? `Upload your project ${requirements.format === 'presentation' ? 'presentation' : 'file'}.`
                  : 'Provide your project response below.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {submitSuccess && (
              <Alert className="border-green-300 bg-green-50 dark:bg-green-950/20">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700 dark:text-green-400">
                  Project submitted successfully!
                </AlertDescription>
              </Alert>
            )}
            {submitError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            {requirements.needsText && (
              <div className="space-y-2">
                <Label htmlFor="text-content">Response</Label>
                <Textarea
                  id="text-content"
                  placeholder="Write your project response here..."
                  value={textContent}
                  onChange={(e) => {
                    setTextContent(e.target.value);
                    setSubmitError(null);
                  }}
                  rows={8}
                />
              </div>
            )}

            {requirements.needsFile && (
              <div className="space-y-2">
                <Label htmlFor="project-file">
                  {requirements.format === 'presentation' ? 'Presentation file' : 'File'}
                </Label>
                {file ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                    <span className="text-sm truncate flex items-center gap-2">
                      <Upload className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      {file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <input
                      type="file"
                      id="project-file"
                      className="sr-only"
                      accept={rules.accept}
                      onChange={handleFileChange}
                      disabled={submitting}
                    />
                  </div>
                ) : (
                  <label
                    htmlFor="project-file"
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground hover:border-primary/60 hover:text-foreground transition-colors focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/30"
                  >
                    <Upload className="w-4 h-4" />
                    Choose a file
                    <input
                      type="file"
                      id="project-file"
                      className="sr-only"
                      accept={rules.accept}
                      onChange={handleFileChange}
                      disabled={submitting}
                    />
                  </label>
                )}
                <p className="text-xs text-muted-foreground">
                  Max file size: {rules.maxFileSizeMB}MB
                  {rules.allowedFileTypes.length > 0 && ` • Allowed: ${rules.allowedFileTypes.join(', ')}`}
                </p>
              </div>
            )}

            <Button
              onClick={handleSubmit}
              disabled={submitting || missingRequiredWork}
              className="w-full sm:w-auto"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  {needsRevision ? 'Resubmit' : 'Submit Project'}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Waiting for grade notice */}
      {isSubmitted && !isGraded && !needsRevision && (
        <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <Clock className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800 dark:text-blue-300">Pending Review</AlertTitle>
          <AlertDescription className="text-blue-700 dark:text-blue-400">
            Your project has been submitted and is awaiting review from your instructor.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// ── Status badge helper ─────────────────────────────────────────

function StatusBadge({ status }: { status?: string }) {
  switch (status) {
    case 'graded':
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Graded
        </Badge>
      );
    case 'needs_revision':
      return (
        <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
          <Edit3 className="w-3 h-3 mr-1" />
          Needs Revision
        </Badge>
      );
    case 'submitted':
      return (
        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          <Clock className="w-3 h-3 mr-1" />
          Submitted
        </Badge>
      );
    case 'late':
      return (
        <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
          <AlertCircle className="w-3 h-3 mr-1" />
          Overdue
        </Badge>
      );
    default:
      return (
        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
          <FileText className="w-3 h-3 mr-1" />
          Not Submitted
        </Badge>
      );
  }
}
