"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import FileViewer from '@/components/FileViewer';
import DocumentAnalysis from '@/components/DocumentAnalysis';
import SubmissionReview from '@/components/SubmissionReview';
import GradingService, { SubmissionDetail, FeedbackTemplate } from '@/services/grading.service';
import { RequestModificationModal } from '@/components/grading/RequestModificationModal';
import { 
  FileText, 
  User, 
  Calendar, 
  Clock, 
  BookOpen, 
  Download, 
  ExternalLink, 
  Star, 
  MessageSquare, 
  History, 
  AlertTriangle,
  CheckCircle,
  Eye,
  Award,
  Target,
  Info,
  Users,
  Layers,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

const ProjectGradingDetail = () => {
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
  const [showModificationModal, setShowModificationModal] = useState(false);

  useEffect(() => {
    if (token && submissionId) {
      fetchSubmission();
      fetchTemplates();
    }
  }, [token, submissionId]);

  const fetchSubmission = async () => {
    setLoading(true);
    try {
      const data = await GradingService.getProjectSubmissionDetail(submissionId);
      setSubmission(data);
      
      // Pre-fill if already graded
      if (data.grade !== undefined && data.grade !== null) {
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
    if (isNaN(gradeValue) || gradeValue < 0 || gradeValue > submission.project_points) {
      setError(`Grade must be between 0 and ${submission.project_points}`);
      return;
    }

    setGrading(true);
    setError(null);

    try {
      if (submission.grade !== undefined) {
        await GradingService.updateProjectGrade(submissionId, {
          grade: gradeValue,
          feedback
        });
      } else {
        await GradingService.gradeProject(submissionId, {
          grade: gradeValue,
          feedback
        });
      }
      
      router.push('/instructor/grading?status=graded&type=project');
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
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      {/* Enhanced Header */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.back()}
              className="flex items-center px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Grading Center
            </button>
            <div className="border-l border-slate-200 dark:border-slate-700 pl-4">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center">
                <Layers className="w-7 h-7 mr-3 text-purple-600" />
                Project Grading
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-1">Review and grade student project submission</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {submission?.days_late === 0 ? (
              <div className="flex items-center bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400 px-3 py-2 rounded-lg">
                <CheckCircle className="w-4 h-4 mr-2" />
                <span className="font-medium">On Time</span>
              </div>
            ) : submission?.days_late && submission.days_late > 0 ? (
              <div className="flex items-center bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400 px-3 py-2 rounded-lg">
                <AlertTriangle className="w-4 h-4 mr-2" />
                <span className="font-medium">{submission.days_late} Day{submission.days_late > 1 ? 's' : ''} Late</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Project Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Project Overview Card */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 to-indigo-600 px-6 py-4">
              <div className="flex items-center space-x-2">
                <Layers className="w-6 h-6 text-white" />
                <h2 className="text-xl font-bold text-white">
                  {submission.project_title}
                </h2>
                {submission.project?.is_published && (
                  <CheckCircle className="w-5 h-5 text-green-200" />
                )}
              </div>
              <p className="text-purple-100 mt-1">{submission.course_title}</p>
            </div>
            
            <div className="p-6">
              {/* Project Description */}
              {submission.project?.description && (
                <div className="mb-6">
                  <div className="flex items-center mb-2">
                    <Info className="w-4 h-4 text-slate-500 mr-2" />
                    <h3 className="font-medium text-slate-900 dark:text-white">Description</h3>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                    <p className="text-slate-900 dark:text-white whitespace-pre-wrap text-sm">
                      {submission.project.description}
                    </p>
                  </div>
                </div>
              )}

              {/* Project Objectives */}
              {submission.project?.objectives && (
                <div className="mb-6">
                  <div className="flex items-center mb-2">
                    <Target className="w-4 h-4 text-purple-500 mr-2" />
                    <h3 className="font-medium text-slate-900 dark:text-white">Project Objectives</h3>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                    <p className="text-slate-900 dark:text-white whitespace-pre-wrap text-sm">
                      {submission.project.objectives}
                    </p>
                  </div>
                </div>
              )}

              {/* Project Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Award className="w-4 h-4 text-yellow-500 mr-2" />
                      <span className="text-slate-600 dark:text-slate-400">Points Possible</span>
                    </div>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {submission.project_points}
                    </span>
                  </div>
                  
                  {submission.due_date && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 text-red-500 mr-2" />
                        <span className="text-slate-600 dark:text-slate-400">Due Date</span>
                      </div>
                      <span className={`font-medium ${
                        submission.days_late > 0 
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-slate-900 dark:text-white'
                      }`}>
                        {new Date(submission.due_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <FileText className="w-4 h-4 text-green-500 mr-2" />
                      <span className="text-slate-600 dark:text-slate-400">Format</span>
                    </div>
                    <span className="font-medium text-slate-900 dark:text-white capitalize">
                      {submission.project?.submission_format?.replace('_', ' ') || 'Mixed'}
                    </span>
                  </div>
                  
                  {submission.project?.collaboration_allowed && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Users className="w-4 h-4 text-blue-500 mr-2" />
                        <span className="text-slate-600 dark:text-slate-400">Team Size</span>
                      </div>
                      <span className="font-medium text-slate-900 dark:text-white">
                        Up to {submission.project.max_team_size} members
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Covered Modules */}
              {submission.project?.modules && submission.project.modules.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center mb-3">
                    <BookOpen className="w-4 h-4 text-slate-500 mr-2" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Covered Modules:</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {submission.project.modules.map((module: any) => (
                      <div key={module.id} className="px-3 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400 rounded-full text-sm font-medium">
                        {module.title}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Student Submission */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Project Submission
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

              {/* Submission Status */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Submission Status
                </label>
                <div className="flex items-center space-x-2">
                  {submission.submission_status?.is_first ? (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                      <CheckCircle className="w-4 h-4 mr-1.5" />
                      First Submission
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400">
                      <RefreshCw className="w-4 h-4 mr-1.5" />
                      Resubmission #{submission.submission_status?.count || 1}
                    </span>
                  )}
                </div>
                {/* Resubmission Notes */}
                {submission.submission_status && !submission.submission_status.is_first && submission.submission_status.notes && (
                  <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-orange-800 dark:text-orange-300 mb-1">
                          Resubmission Note:
                        </p>
                        <p className="text-sm text-orange-700 dark:text-orange-400">
                          {submission.submission_status.notes}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {submission.team_members_info && submission.team_members_info.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Team Members
                  </label>
                  <div className="space-y-2">
                    {submission.team_members_info.map((member) => (
                      <div key={member.id} className="flex items-center space-x-3 p-2 bg-slate-50 dark:bg-slate-900 rounded">
                        <div className="h-8 w-8 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 dark:text-blue-400 text-sm font-medium">
                            {member.name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">{member.name}</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">{member.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Comprehensive Project Submission Review */}
              <SubmissionReview
                textContent={submission.text_content}
                files={submission.file_path ? [{
                  id: 'project-file',
                  filename: submission.file_name || 'project-files.zip',
                  file_path: submission.file_path
                }] : []}
                submissionType="project"
                expectedLength={submission.project?.expected_length}
                maxFiles={submission.project?.max_files}
                allowedFileTypes={submission.project?.allowed_file_types?.split(',')}
                className="mb-6"
              />
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
                  Grade (out of {submission.project_points})
                </label>
                <input
                  type="number"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  min="0"
                  max={submission.project_points}
                  step="0.5"
                  required
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter grade"
                />
                {grade && submission.project_points && (
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Percentage: {GradingService.calculatePercentage(parseFloat(grade), submission.project_points).toFixed(1)}%
                    {' '}({GradingService.getLetterGrade(GradingService.calculatePercentage(parseFloat(grade), submission.project_points))})
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
                  placeholder="Provide detailed feedback on the project..."
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
                
                {/* Request Modification Button */}
                <button
                  type="button"
                  onClick={() => setShowModificationModal(true)}
                  className="px-4 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium flex items-center"
                  title="Request student to modify and resubmit"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Request Modification
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

        {/* Right Column - Student Info */}
        <div className="space-y-6">
          {/* Student Info */}
          {submission.student_info && (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                {submission.team_members_info && submission.team_members_info.length > 0 ? 'Team Lead' : 'Student Information'}
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
          {submission.grade !== undefined && submission.grade !== null && submission.project_points && (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Current Grade
              </h3>
              <div className="text-center">
                <p className="text-4xl font-bold text-slate-900 dark:text-white mb-2">
                  {submission.grade}/{submission.project_points}
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  {GradingService.calculatePercentage(submission.grade, submission.project_points).toFixed(1)}%
                  {' '}({GradingService.getLetterGrade(GradingService.calculatePercentage(submission.grade, submission.project_points))})
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

          {/* Project Modules */}
          {submission.project && submission.project.modules && submission.project.modules.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Covered Modules
              </h3>
              <div className="space-y-2">
                {submission.project.modules.map((module: any) => (
                  <div key={module.id} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <p className="font-medium text-slate-900 dark:text-white">
                      {module.title}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Request Modification Modal */}
      {submission && (
        <RequestModificationModal
          isOpen={showModificationModal}
          onClose={() => setShowModificationModal(false)}
          submission={{
            id: submission.id,
            student_name: submission.student_info?.name || 'Unknown Student',
            student_id: submission.student_info?.id || 0,
            assignment_title: submission.project?.title || 'Unknown Project',
            assignment_id: submission.project?.id || 0,
            submission_type: 'project'
          }}
          onSuccess={() => {
            setShowModificationModal(false);
            // Optionally refresh the submission data
            fetchSubmission();
          }}
        />
      )}
    </div>
  );
};

export default ProjectGradingDetail;
