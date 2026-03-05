'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { StudentSubmissionService, SubmissionDetail } from '@/services/student-submission.service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const [fileUrl, setFileUrl] = useState('');
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
    if (!textContent.trim() && !fileUrl.trim()) {
      setSubmitError('Please provide either text content or a file URL.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);
    try {
      await StudentSubmissionService.submitProject(projectId, {
        text_content: textContent.trim() || undefined,
        file_url: fileUrl.trim() || undefined,
      });
      setSubmitSuccess(true);
      fetchProject();
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to submit project');
    } finally {
      setSubmitting(false);
    }
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
  const needsRevision = project.modification_requested && project.can_resubmit;
  const isGraded = status?.status === 'graded';
  const isSubmitted = status?.submitted;
  const canSubmit = !isSubmitted || needsRevision;

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
            {project.modification_request_reason ||
              'Your instructor has requested modifications to your submission. Please review the feedback and resubmit.'}
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
          <div
            className="prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: project.description }}
          />
          {project.objectives && (
            <>
              <h4 className="text-sm font-semibold mt-4">Learning Objectives</h4>
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: project.objectives }}
              />
            </>
          )}
        </CardContent>
      </Card>

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
                <p className="text-sm">{status.feedback}</p>
                {status.grader_name && (
                  <p className="text-xs text-muted-foreground mt-2">— {status.grader_name}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Previous Submission */}
      {submission && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Your Submission
            </CardTitle>
            <CardDescription>
              Submitted on{' '}
              {new Date(submission.submitted_at).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
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
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {submission.text_content}
                </div>
              </div>
            )}
            {(submission.file_url || submission.file_path) && (
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-4 py-3">
                <Upload className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{submission.file_name || 'Uploaded file'}</span>
                {submission.file_url && (
                  <a
                    href={submission.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline ml-auto"
                  >
                    View File
                  </a>
                )}
              </div>
            )}
            {submission.feedback && !isGraded && (
              <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg px-4 py-3">
                <p className="text-xs font-semibold text-orange-800 dark:text-orange-300 mb-1">
                  Feedback
                </p>
                <p className="text-sm text-orange-700 dark:text-orange-400">{submission.feedback}</p>
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
              {project.submission_format === 'file_upload'
                ? 'Upload your project file.'
                : project.submission_format === 'text_response'
                ? 'Provide your project response below.'
                : 'Provide your project response and/or upload a file.'}
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

            {(project.submission_format === 'text_response' ||
              project.submission_format === 'both') && (
              <div className="space-y-2">
                <Label htmlFor="text-content">Response</Label>
                <Textarea
                  id="text-content"
                  placeholder="Write your project response here..."
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  rows={8}
                />
              </div>
            )}

            {(project.submission_format === 'file_upload' ||
              project.submission_format === 'both' ||
              project.submission_format === 'presentation') && (
              <div className="space-y-2">
                <Label htmlFor="file-url">File URL</Label>
                <Input
                  id="file-url"
                  type="url"
                  placeholder="Paste a link to your project file (Google Drive, GitHub, etc.)"
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Max file size: {project.max_file_size_mb || 50}MB
                  {project.allowed_file_types && ` • Allowed: ${project.allowed_file_types}`}
                </p>
              </div>
            )}

            <Button
              onClick={handleSubmit}
              disabled={submitting || (!textContent.trim() && !fileUrl.trim())}
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
