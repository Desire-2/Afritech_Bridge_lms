"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';
import FileViewer from '@/components/FileViewer';
import DocumentAnalysis from '@/components/DocumentAnalysis';
import SubmissionReview from '@/components/SubmissionReview';
import SubmissionFileManager from '@/components/SubmissionFileManager';
import GradingService, { SubmissionDetail, FeedbackTemplate } from '@/services/grading.service';
import { EnhancedFileService } from '@/services/enhanced-file.service';
import { parseFileInfo } from '@/utils/fileUtils';
import { RequestModificationModal } from '@/components/grading/RequestModificationModal';
import { CommentBankPanel } from '@/components/grading/CommentBankPanel';
import { RubricGradingPanel } from '@/components/grading/RubricGradingPanel';
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
  RefreshCw,
  AlertCircle,
  Save,
  Sparkles,
  Calculator,
  FileBarChart
} from 'lucide-react';

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
  const [showModificationModal, setShowModificationModal] = useState(false);
  
  // Enhanced grading features
  const [showCommentBank, setShowCommentBank] = useState(false);
  const [showRubricPanel, setShowRubricPanel] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [rubricScores, setRubricScores] = useState<Record<string, number>>({});

  useEffect(() => {
    if (token && submissionId) {
      fetchSubmission();
      fetchTemplates();
    }
  }, [token, submissionId]);

  // Helper function to safely get student name
  const getStudentName = () => {
    if (!submission?.student_info) return 'N/A';
    return submission.student_info.name || 
           `${submission.student_info.first_name || ''} ${submission.student_info.last_name || ''}`.trim() || 
           'N/A';
  };

  // Helper function to safely get student initials
  const getStudentInitials = () => {
    const name = getStudentName();
    if (name === 'N/A') return 'NA';
    return name.split(' ').map(n => n[0] || '').join('').substring(0, 2).toUpperCase();
  };

  const fetchSubmission = async () => {
    setLoading(true);
    try {
      const data = await GradingService.getAssignmentSubmissionDetail(submissionId);
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

  // Auto-save draft functionality
  const autoSaveDraft = useCallback(async () => {
    if (!grade && !feedback) return;
    
    setAutoSaving(true);
    try {
      const draftKey = `grading_draft_assignment_${submissionId}`;
      localStorage.setItem(draftKey, JSON.stringify({
        grade,
        feedback,
        rubricScores,
        timestamp: new Date().toISOString()
      }));
      setLastSaved(new Date());
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      setAutoSaving(false);
    }
  }, [grade, feedback, rubricScores, submissionId]);

  // Load draft on mount
  useEffect(() => {
    const draftKey = `grading_draft_assignment_${submissionId}`;
    const savedDraft = localStorage.getItem(draftKey);
    if (savedDraft && !grade && !feedback) {
      try {
        const draft = JSON.parse(savedDraft);
        setGrade(draft.grade || '');
        setFeedback(draft.feedback || '');
        setRubricScores(draft.rubricScores || {});
      } catch (error) {
        console.error('Failed to load draft:', error);
      }
    }
  }, [submissionId]);

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(autoSaveDraft, 30000);
    return () => clearInterval(interval);
  }, [autoSaveDraft]);

  const handleCommentSelect = (comment: string) => {
    setFeedback(prev => prev ? `${prev}\n\n${comment}` : comment);
  };

  const handleRubricApply = (totalScore: number, scores: Record<string, number>) => {
    setGrade(totalScore.toString());
    setRubricScores(scores);
  };

  const calculatePercentage = () => {
    if (!grade || !submission?.assignment_points) return 0;
    const gradeValue = parseFloat(grade);
    if (isNaN(gradeValue)) return 0;
    return (gradeValue / submission.assignment_points) * 100;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
          <div className="absolute inset-0 rounded-full h-16 w-16 border-t-4 border-blue-200 animate-ping"></div>
        </div>
        <div className="mt-6 text-center">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Loading Submission Details</h3>
          <p className="text-slate-600 dark:text-slate-300">Please wait while we fetch the assignment submission...</p>
        </div>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="text-center py-20">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Submission Not Found</h3>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            The requested submission could not be found or you don't have permission to view it.
          </p>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Go Back
          </button>
        </div>
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
                <Award className="w-7 h-7 mr-3 text-blue-600" />
                Assignment Grading
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-1">Review and grade student submission</p>
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
        {/* Left Column - Submission Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Assignment Overview Card */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-6 h-6 text-white" />
                <h2 className="text-xl font-bold text-white">
                  {submission.assignment_title}
                </h2>
                {submission.assignment?.is_published && (
                  <CheckCircle className="w-5 h-5 text-green-200" />
                )}
              </div>
              <p className="text-blue-100 mt-1">{submission.course_title}</p>
            </div>
            
            <div className="p-6">
              {/* Assignment Description */}
              {submission.assignment?.description && (
                <div className="mb-6">
                  <div className="flex items-center mb-2">
                    <Info className="w-4 h-4 text-slate-500 mr-2" />
                    <h3 className="font-medium text-slate-900 dark:text-white">Description</h3>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                    <MarkdownRenderer 
                      content={submission.assignment.description}
                      variant="card"
                      className="prose-slate text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Assignment Instructions */}
              {submission.assignment?.instructions && (
                <div className="mb-6">
                  <div className="flex items-center mb-2">
                    <Target className="w-4 h-4 text-blue-500 mr-2" />
                    <h3 className="font-medium text-slate-900 dark:text-white">Instructions</h3>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                    <MarkdownRenderer 
                      content={submission.assignment.instructions}
                      variant="card"
                      className="prose-blue text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Assignment Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Award className="w-4 h-4 text-yellow-500 mr-2" />
                      <span className="text-slate-600 dark:text-slate-400">Points Possible</span>
                    </div>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {submission.assignment_points}
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
                      <span className="text-slate-600 dark:text-slate-400">Type</span>
                    </div>
                    <span className="font-medium text-slate-900 dark:text-white capitalize">
                      {submission.assignment?.assignment_type?.replace('_', ' ') || 'Mixed'}
                    </span>
                  </div>
                  
                  {submission.assignment?.max_file_size_mb && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Download className="w-4 h-4 text-purple-500 mr-2" />
                        <span className="text-slate-600 dark:text-slate-400">Max File Size</span>
                      </div>
                      <span className="font-medium text-slate-900 dark:text-white">
                        {submission.assignment.max_file_size_mb}MB
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Allowed File Types */}
              {submission.assignment?.allowed_file_types && (
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center mb-2">
                    <FileText className="w-4 h-4 text-slate-500 mr-2" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Allowed File Types:</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {submission.assignment.allowed_file_types.split(',').map((type: string, index: number) => (
                      <span key={index} className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-md text-xs font-medium text-slate-700 dark:text-slate-300">
                        {type.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Student Submission */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileText className="w-6 h-6 text-white" />
                  <h3 className="text-xl font-bold text-white">Student Submission</h3>
                </div>
                <div className="flex items-center space-x-2">
                  {submission.days_late === 0 ? (
                    <div className="flex items-center bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      On Time
                    </div>
                  ) : (
                    <div className="flex items-center bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      {submission.days_late} Day{submission.days_late > 1 ? 's' : ''} Late
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6">
              {/* Submission Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="space-y-3">
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 text-slate-500 mr-3" />
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Submitted At</p>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {new Date(submission.submitted_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center">
                    <User className="w-4 h-4 text-slate-500 mr-3" />
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Student</p>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {submission.student_info?.name || 'Unknown Student'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Submission Status */}
                <div className="space-y-3">
                  <div className="flex items-center">
                    <RefreshCw className="w-4 h-4 text-slate-500 mr-3" />
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Submission Status</p>
                      <div className="flex items-center space-x-2">
                        {submission.submission_status?.is_first ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            First Submission
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400">
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Resubmission #{submission.submission_status?.count || 1}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Resubmission Notes */}
              {submission.submission_status && !submission.submission_status.is_first && submission.submission_status.notes && (
                <div className="mb-6 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
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

              {/* Enhanced File Review Section */}
              <SubmissionFileManager
                files={(submission.files && Array.isArray(submission.files) && submission.files.length > 0) 
                  ? submission.files.map((file, index) => {
                      const filename = file.filename || 'Unknown File';
                      return {
                        id: `file-${index}`,
                        filename: filename,
                        file_url: file.url,
                        file_size: file.size || 0,
                        uploaded_at: file.uploadedAt || submission.submitted_at,
                        fileInfo: parseFileInfo(filename, file.size)
                      };
                    })
                  : (submission.file_url ? [{
                      id: 'main-file',
                      filename: submission.original_filename || 'Submission File',
                      file_url: submission.file_url,
                      file_size: 0,
                      uploaded_at: submission.submitted_at,
                      fileInfo: parseFileInfo(submission.original_filename || 'Submission File')
                    }] : [])
                }
                submissionId={submissionId}
                studentName={getStudentName()}
                onDownloadSingle={async (fileId) => {
                  try {
                    console.log('Download requested for fileId:', fileId);
                    console.log('Submission files:', submission.files);
                    console.log('Submission file_url:', submission.file_url);
                    
                    // Handle parsed files array (new format)
                    let file = null;
                    if (submission.files && Array.isArray(submission.files)) {
                      const fileIndex = parseInt(fileId.replace('file-', ''));
                      if (!isNaN(fileIndex) && submission.files[fileIndex]) {
                        const sourceFile = submission.files[fileIndex];
                        file = {
                          id: fileId,
                          filename: sourceFile.filename || 'Unknown File',
                          file_url: sourceFile.url,
                          file_size: sourceFile.size || 0,
                          uploaded_at: sourceFile.uploadedAt || submission.submitted_at
                        };
                      }
                    }
                    
                    // Handle legacy single file case
                    if (!file && fileId === 'main-file' && submission.file_url) {
                      console.log('Using legacy file_url for main-file');
                      file = {
                        id: 'main-file',
                        filename: submission.original_filename || 'Submission File',
                        file_url: submission.file_url,
                        file_size: 0,
                        uploaded_at: submission.submitted_at
                      };
                    }
                    
                    console.log('Found file for download:', file);
                    
                    if (file && file.file_url) {
                      console.log('Attempting to download from URL:', file.file_url);
                      const { blob, filename } = await EnhancedFileService.downloadSingleFile(file.file_url, file.filename);
                      EnhancedFileService.triggerFileDownload(blob, filename);
                    } else {
                      console.error('File not found for download. FileId:', fileId, 'File obj:', file);
                      alert('File not found or URL missing');
                    }
                  } catch (error) {
                    console.error('Download failed:', error);
                    alert(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
                  }
                }}
                onDownloadAll={() => {
                  // Handle download all files
                  EnhancedFileService.downloadSubmissionFiles(parseInt(submissionId))
                    .then(({ blob, filename }) => {
                      EnhancedFileService.triggerFileDownload(blob, filename);
                    })
                    .catch(error => {
                      console.error('Download all failed:', error);
                      // Could show a toast notification here
                    });
                }}
                onAddFileComment={(fileId, comment) => {
                  // Handle file comment
                  EnhancedFileService.addFileComment({
                    file_id: fileId,
                    comment_text: comment,
                    submission_id: parseInt(submissionId),
                    is_private: false
                  }).then(() => {
                    // Could refresh comments or update state
                    console.log('Comment added successfully');
                  }).catch(error => {
                    console.error('Failed to add comment:', error);
                  });
                }}
                allowComments={true}
                allowDownload={true}
                className="mb-6"
              />
            </div>
          </div>

          {/* Grading Form */}
          <form onSubmit={handleSubmitGrade} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Award className="w-6 h-6 text-white" />
                  <h3 className="text-lg font-bold text-white">
                    {submission.grade !== undefined ? 'Update Grade' : 'Submit Grade'}
                  </h3>
                </div>
                {lastSaved && (
                  <div className="flex items-center text-white/80 text-sm">
                    <Save className="w-4 h-4 mr-1" />
                    <span>Saved {lastSaved.toLocaleTimeString()}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-6">
                {/* Quick Actions */}
                <div className="flex gap-2 pb-4 border-b border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setShowRubricPanel(!showRubricPanel)}
                    className="flex items-center px-3 py-2 bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/30 transition-colors text-sm font-medium"
                  >
                    <FileBarChart className="w-4 h-4 mr-2" />
                    {showRubricPanel ? 'Hide' : 'Use'} Rubric
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCommentBank(!showCommentBank)}
                    className="flex items-center px-3 py-2 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/30 transition-colors text-sm font-medium"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    {showCommentBank ? 'Hide' : 'Show'} Comment Bank
                  </button>
                  <button
                    type="button"
                    onClick={autoSaveDraft}
                    disabled={autoSaving}
                    className="flex items-center px-3 py-2 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/30 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {autoSaving ? 'Saving...' : 'Save Draft'}
                  </button>
                </div>

                {/* Rubric Panel */}
                {showRubricPanel && (
                  <div className="border border-purple-200 dark:border-purple-800 rounded-lg p-4 bg-purple-50 dark:bg-purple-900/10">
                    <RubricGradingPanel
                      assignmentId={submission.assignment?.id}
                      maxPoints={submission.assignment_points}
                      onApplyScores={handleRubricApply}
                      initialScores={rubricScores}
                    />
                  </div>
                )}

                {/* Grade Input */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Grade (out of {submission.assignment_points})
                    </label>
                    {grade && !isNaN(parseFloat(grade)) && (
                      <div className="flex items-center space-x-2 text-sm">
                        <Calculator className="w-4 h-4 text-blue-500" />
                        <span className="font-bold text-blue-600 dark:text-blue-400">
                          {calculatePercentage().toFixed(1)}%
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          GradingService.getLetterGrade(calculatePercentage()) === 'A'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : GradingService.getLetterGrade(calculatePercentage()) === 'B'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                            : GradingService.getLetterGrade(calculatePercentage()) === 'C'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                        }`}>
                          {GradingService.getLetterGrade(calculatePercentage())}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      min="0"
                      max={submission.assignment_points}
                      step="0.1"
                      className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500 text-lg font-semibold"
                      placeholder="Enter grade..."
                    />
                    <div className="absolute right-3 top-3 text-slate-500">
                      <span className="text-sm">/{submission.assignment_points}</span>
                    </div>
                  </div>
                </div>

                {/* Comment Bank Panel */}
                {showCommentBank && (
                  <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/10">
                    <CommentBankPanel
                      onSelectComment={handleCommentSelect}
                      currentFeedback={feedback}
                    />
                  </div>
                )}

                {/* Feedback Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Feedback
                    </label>
                    {templates.length > 0 && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowTemplates(!showTemplates)}
                          className="flex items-center px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/30 transition-colors"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Templates ({templates.length})
                        </button>
                        
                        {showTemplates && (
                          <div className="absolute right-0 top-8 w-64 bg-white dark:bg-slate-700 rounded-lg shadow-xl border border-slate-200 dark:border-slate-600 z-10 max-h-48 overflow-y-auto">
                            {templates.map((template) => (
                              <button
                                key={template.id}
                                type="button"
                                onClick={() => applyTemplate(template)}
                                className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-600 rounded transition-colors"
                              >
                                <div className="font-medium text-slate-900 dark:text-white">{template.name}</div>
                                <div className="text-slate-600 dark:text-slate-400 text-xs mt-1 line-clamp-2">
                                  {template.content}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    rows={6}
                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Provide detailed feedback on the assignment..."
                  />
                  <div className="mt-2 text-xs text-slate-500">
                    {feedback.length} characters
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <button
                    type="submit"
                    disabled={grading || !grade}
                    className="flex-1 flex items-center justify-center px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold"
                  >
                    {grading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        {submission.grade !== undefined ? 'Updating...' : 'Submitting...'}
                      </>
                    ) : (
                      <>
                        <Award className="w-4 h-4 mr-2" />
                        {submission.grade !== undefined ? 'Update Grade' : 'Submit Grade'}
                      </>
                    )}
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setShowModificationModal(true)}
                    className="px-4 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors font-medium"
                  >
                    Request Changes
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Right Column - Student Info & History */}
        <div className="space-y-6">
          {/* Student Info */}
          {submission.student_info && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="bg-gradient-to-r from-indigo-500 to-blue-600 px-6 py-4">
                <div className="flex items-center space-x-2">
                  <User className="w-6 h-6 text-white" />
                  <h3 className="text-lg font-bold text-white">
                    Student Information
                  </h3>
                </div>
              </div>
              
              <div className="p-6">
                <div className="space-y-4">
                  {/* Student Avatar and Name */}
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-lg">
                        {getStudentInitials()}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-lg">
                        {getStudentName()}
                      </h4>
                      <p className="text-slate-600 dark:text-slate-400">
                        @{submission.student_info?.username || 'N/A'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Contact Information */}
                  <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center mr-3">
                        <span className="text-green-600 dark:text-green-400 text-sm">@</span>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">Email</p>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {submission.student_info?.email || 'N/A'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center mr-3">
                        <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">Student ID</p>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          #{submission.student_info?.id || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Current Grade */}
          {submission.grade !== undefined && submission.grade !== null && submission.assignment_points && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="bg-gradient-to-r from-yellow-500 to-orange-500 px-6 py-4">
                <div className="flex items-center space-x-2">
                  <Star className="w-6 h-6 text-white" />
                  <h3 className="text-lg font-bold text-white">Current Grade</h3>
                </div>
              </div>
              
              <div className="p-6">
                <div className="text-center mb-4">
                  <div className="relative inline-flex items-center justify-center w-24 h-24 mb-3">
                    <div className={`absolute inset-0 rounded-full ${
                      GradingService.calculatePercentage(submission.grade, submission.assignment_points) >= 70
                        ? 'bg-gradient-to-br from-green-400 to-emerald-500'
                        : GradingService.calculatePercentage(submission.grade, submission.assignment_points) >= 60
                        ? 'bg-gradient-to-br from-yellow-400 to-orange-500'
                        : 'bg-gradient-to-br from-red-400 to-red-500'
                    }`}></div>
                    <div className="relative">
                      <p className="text-2xl font-bold text-white">
                        {submission.grade}/{submission.assignment_points}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {GradingService.calculatePercentage(submission.grade, submission.assignment_points).toFixed(1)}%
                    </p>
                    <p className={`text-lg font-semibold px-3 py-1 rounded-full ${
                      GradingService.getLetterGrade(GradingService.calculatePercentage(submission.grade, submission.assignment_points)) === 'A'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                        : GradingService.getLetterGrade(GradingService.calculatePercentage(submission.grade, submission.assignment_points)) === 'B'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                        : GradingService.getLetterGrade(GradingService.calculatePercentage(submission.grade, submission.assignment_points)) === 'C'
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                    }`}>
                      Grade: {GradingService.getLetterGrade(GradingService.calculatePercentage(submission.grade, submission.assignment_points))}
                    </p>
                  </div>
                </div>
                
                {submission.graded_at && (
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-center text-sm text-slate-600 dark:text-slate-400">
                      <Clock className="w-4 h-4 mr-2" />
                      Graded on {new Date(submission.graded_at).toLocaleString()}
                    </div>
                  </div>
                )}
                
                {submission.feedback && (
                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center mb-2">
                      <MessageSquare className="w-4 h-4 text-blue-500 mr-2" />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Previous Feedback</span>
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                        {submission.feedback}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Previous Attempts */}
          {submission.previous_attempts && submission.previous_attempts.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="bg-gradient-to-r from-gray-600 to-slate-700 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <History className="w-6 h-6 text-white" />
                    <h3 className="text-lg font-bold text-white">Previous Attempts</h3>
                  </div>
                  <span className="bg-white bg-opacity-20 text-white px-2 py-1 rounded-full text-xs font-medium">
                    {submission.previous_attempts.length} attempt{submission.previous_attempts.length > 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              
              <div className="p-6">
                <div className="space-y-3">
                  {submission.previous_attempts.map((attempt, index) => (
                    <div key={attempt.id} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center mr-3">
                            <span className="text-blue-600 dark:text-blue-400 text-sm font-bold">
                              #{submission.previous_attempts!.length - index}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900 dark:text-white">
                              Attempt {submission.previous_attempts!.length - index}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-500">
                              {new Date(attempt.submitted_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`font-bold ${
                            attempt.grade !== undefined 
                              ? 'text-slate-900 dark:text-white'
                              : 'text-slate-500 dark:text-slate-500'
                          }`}>
                            {attempt.grade !== undefined ? `${attempt.grade}/${submission.assignment_points}` : 'Pending'}
                          </span>
                          {attempt.grade !== undefined && (
                            <p className="text-xs text-slate-500">
                              {GradingService.calculatePercentage(attempt.grade, submission.assignment_points).toFixed(1)}%
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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
            assignment_title: submission.assignment_title,
            assignment_id: submission.assignment_id,
            submission_type: 'assignment'
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

export default AssignmentGradingDetail;
