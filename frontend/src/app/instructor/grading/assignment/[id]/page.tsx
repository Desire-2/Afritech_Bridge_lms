"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';
import GradingService, { SubmissionDetail, FeedbackTemplate } from '@/services/grading.service';

const AssignmentGradingDetail = () => {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuth();
  const submissionId = parseInt(params.id as string);

  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [templates, setTemplates] = useState<FeedbackTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [grade, setGrade] = useState<string>('');
  const [feedback, setFeedback] = useState<string>('');
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    if (token && submissionId) {
      fetchSubmission();
      fetchTemplates();
    }
  }, [token, submissionId]);

  const fetchSubmission = async () => {
    setLoading(true);
    try {
      const data = await GradingService.getAssignmentSubmissionDetail(submissionId);
      setSubmission(data);
      
      // Pre-fill if already graded
      if (data.grade !== undefined) {
        setGrade(data.grade.toString());
        setFeedback(data.feedback || '');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load submission');
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const data = await GradingService.getFeedbackTemplates();
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const handleSubmitGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!submission) return;
    
    const gradeValue = parseFloat(grade);
    if (isNaN(gradeValue) || gradeValue < 0 || gradeValue > submission.assignment_points) {
      setError(`Grade must be between 0 and ${submission.assignment_points}`);
      return;
    }

    setGrading(true);
    setError(null);

    try {
      if (submission.grade !== undefined) {
        // Update existing grade
        await GradingService.updateAssignmentGrade(submissionId, {
          grade: gradeValue,
          feedback
        });
      } else {
        // Submit new grade
        await GradingService.gradeAssignment(submissionId, {
          grade: gradeValue,
          feedback
        });
      }
      
      // Redirect back to grading center
      router.push('/instructor/grading?status=graded');
    } catch (err: any) {
      setError(err.message || 'Failed to submit grade');
    } finally {
      setGrading(false);
    }
  };

  const applyTemplate = (template: FeedbackTemplate) => {
    setFeedback(template.content);
    setShowTemplates(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-slate-600 dark:text-slate-300">Loading submission...</span>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-600 dark:text-slate-400">Submission not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-700 mb-2 flex items-center"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Grading Center
          </button>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Grade Assignment</h1>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Submission Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Assignment Info */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              {submission.assignment_title}
            </h2>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Course:</span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {submission.course_title}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Points Possible:</span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {submission.assignment_points}
                </span>
              </div>
              {submission.due_date && (
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Due Date:</span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {new Date(submission.due_date).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Student Submission */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Student Submission
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Submitted At
                </label>
                <p className="text-slate-900 dark:text-white">
                  {new Date(submission.submitted_at).toLocaleString()}
                  {submission.days_late > 0 && (
                    <span className="ml-2 text-red-600 dark:text-red-400">
                      ({submission.days_late} day{submission.days_late > 1 ? 's' : ''} late)
                    </span>
                  )}
                </p>
              </div>

              {submission.content && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Text Response
                  </label>
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                    <MarkdownRenderer 
                      content={submission.content}
                      variant="card"
                      className="prose-slate"
                    />
                  </div>
                </div>
              )}

              {submission.file_url && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Uploaded File
                  </label>
                  <a
                    href={submission.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download Submission
                  </a>
                </div>
              )}

              {submission.external_url && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    External URL
                  </label>
                  <a
                    href={submission.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 underline"
                  >
                    {submission.external_url}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Grading Form */}
          <form onSubmit={handleSubmitGrade} className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              {submission.grade !== undefined ? 'Update Grade' : 'Submit Grade'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Grade (out of {submission.assignment_points})
                </label>
                <input
                  type="number"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  min="0"
                  max={submission.assignment_points}
                  step="0.5"
                  required
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter grade"
                />
                {grade && (
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Percentage: {GradingService.calculatePercentage(parseFloat(grade), submission.assignment_points).toFixed(1)}%
                    {' '}({GradingService.getLetterGrade(GradingService.calculatePercentage(parseFloat(grade), submission.assignment_points))})
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Feedback
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowTemplates(!showTemplates)}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Use Template
                  </button>
                </div>

                {showTemplates && (
                  <div className="mb-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg space-y-2">
                    {templates.map(template => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => applyTemplate(template)}
                        className="block w-full text-left px-3 py-2 text-sm hover:bg-white dark:hover:bg-slate-800 rounded transition-colors"
                      >
                        <div className="font-medium text-slate-900 dark:text-white">{template.name}</div>
                        <div className="text-slate-600 dark:text-slate-400 text-xs mt-1 line-clamp-1">
                          {template.content}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={6}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="Provide feedback to the student..."
                />
              </div>

              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={grading || !grade}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {grading ? 'Submitting...' : submission.grade !== undefined ? 'Update Grade' : 'Submit Grade'}
                </button>
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="px-6 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Right Column - Student Info & History */}
        <div className="space-y-6">
          {/* Student Info */}
          {submission.student_info && (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Student Information
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-slate-600 dark:text-slate-400">Name</label>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {submission.student_info.name}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-slate-600 dark:text-slate-400">Email</label>
                  <p className="text-slate-900 dark:text-white">
                    {submission.student_info.email}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-slate-600 dark:text-slate-400">Username</label>
                  <p className="text-slate-900 dark:text-white">
                    {submission.student_info.username}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Current Grade */}
          {submission.grade !== undefined && (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Current Grade
              </h3>
              <div className="text-center">
                <p className="text-4xl font-bold text-slate-900 dark:text-white mb-2">
                  {submission.grade}/{submission.assignment_points}
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  {GradingService.calculatePercentage(submission.grade, submission.assignment_points).toFixed(1)}%
                  {' '}({GradingService.getLetterGrade(GradingService.calculatePercentage(submission.grade, submission.assignment_points))})
                </p>
                {submission.graded_at && (
                  <p className="text-sm text-slate-500 dark:text-slate-500 mt-2">
                    Graded on {new Date(submission.graded_at).toLocaleString()}
                  </p>
                )}
              </div>
              {submission.feedback && (
                <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                    {submission.feedback}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Previous Attempts */}
          {submission.previous_attempts && submission.previous_attempts.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Previous Attempts
              </h3>
              <div className="space-y-3">
                {submission.previous_attempts.map((attempt, index) => (
                  <div key={attempt.id} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        Attempt {submission.previous_attempts!.length - index}
                      </span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        {attempt.grade !== undefined ? `${attempt.grade}/${submission.assignment_points}` : 'Pending'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                      {new Date(attempt.submitted_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssignmentGradingDetail;
