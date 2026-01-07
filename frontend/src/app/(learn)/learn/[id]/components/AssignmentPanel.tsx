import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';
import { 
  Upload,
  FileText,
  Clock,
  Award,
  CheckCircle,
  AlertCircle,
  Download,
  X,
  Send,
  Paperclip,
  Edit,
  Loader2,
  ArrowLeft,
  BookOpen,
  MessageSquare,
  RefreshCw
} from 'lucide-react';
import type { ContentAssignment } from '@/services/contentAssignmentApi';
import ContentAssignmentService from '@/services/contentAssignmentApi';
import { toast } from 'sonner';

interface AssignmentPanelProps {
  assignment: ContentAssignment;
  onSubmit: (submission: AssignmentSubmission) => void;
  onSubmitComplete?: () => void;
}

interface AssignmentSubmission {
  text?: string;
  files?: File[];
}

interface RubricCriteria {
  name: string;
  description: string;
  max_points: number;
}

export const AssignmentPanel: React.FC<AssignmentPanelProps> = ({ 
  assignment,
  onSubmit,
  onSubmitComplete
}) => {
  const [submissionMode, setSubmissionMode] = useState<'view' | 'submit' | 'submitted' | 'resubmit'>('view');
  const [textResponse, setTextResponse] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: FileUploadProgress }>({});
  const [error, setError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [assignmentData, setAssignmentData] = useState<ContentAssignment>(assignment);

  // Sync assignment data when props change
  React.useEffect(() => {
    setAssignmentData(assignment);
  }, [assignment]);

  const isFileUpload = assignmentData.assignment_type === 'file_upload' || assignmentData.assignment_type === 'both';
  const isTextResponse = assignmentData.assignment_type === 'text_response' || assignmentData.assignment_type === 'both';
  const isResubmitMode = submissionMode === 'resubmit';

  // Enhanced status checking using latest assignment data
  const isSubmitted = Boolean(assignmentData.submission_status?.submitted);
  const isGraded = assignmentData.submission_status?.status === 'graded';
  const isPendingReview = isSubmitted && !isGraded;
  
  // More flexible modification request detection
  const hasModificationRequest = Boolean(
    assignmentData.modification_requested || 
    assignmentData.modification_request_reason ||
    (assignmentData.submission_status?.status === 'needs_revision')
  );
  
  // Only allow resubmit when instructor specifically requests modifications
  const canResubmit = hasModificationRequest && isSubmitted && !isGraded;

  const allowedFileTypes = assignmentData.allowed_file_types 
    ? assignmentData.allowed_file_types.split(',').map(t => t.trim()) 
    : ['*'];
  
  const maxFileSizeMB = assignmentData.max_file_size_mb || 10;
  const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;

  // Function to refresh assignment data
  const refreshAssignmentData = async () => {
    setRefreshing(true);
    try {
      const updatedData = await ContentAssignmentService.refreshAssignmentData(assignmentData.id);
      setAssignmentData(updatedData);
      toast.success('Assignment data refreshed');
    } catch (error) {
      console.error('Failed to refresh assignment data:', error);
      toast.error('Failed to refresh assignment data');
    } finally {
      setRefreshing(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    if (files.length === 0) return;
    
    setUploading(true);
    setError(null);
    
    try {
      // Convert file types for validation
      const allowedMimeTypes = allowedFileTypes.includes('*') 
        ? undefined 
        : allowedFileTypes.map(ext => FileUploadService.getContentType('file' + ext));
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileKey = `${file.name}-${file.size}`;
        
        try {
          const uploadedFile = await FileUploadService.uploadFile(file, {
            folder: 'assignments',
            assignmentId: assignment.id,
            allowedTypes: allowedMimeTypes,
            maxSize: maxFileSizeBytes,
            onProgress: (progress) => {
              setUploadProgress(prev => ({ ...prev, [fileKey]: progress }));
            }
          });
          
          setUploadedFiles(prev => [...prev, {
            ...uploadedFile,
            originalName: file.name,
            size: file.size
          } as UploadedFile & { originalName: string }]);
          
          toast.success(`File "${file.name}" uploaded successfully`);
        } catch (error: any) {
          console.error(`Failed to upload ${file.name}:`, error);
          toast.error(`Failed to upload "${file.name}": ${error.message}`);
        } finally {
          // Clear progress for this file
          setUploadProgress(prev => {
            const newProgress = { ...prev };
            delete newProgress[fileKey];
            return newProgress;
          });
        }
      }
    } catch (error: any) {
      console.error('File upload error:', error);
      setError(`Upload failed: ${error.message}`);
      toast.error('File upload failed');
    } finally {
      setUploading(false);
      // Clear the input
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const removeFile = async (index: number) => {
    const fileToRemove = uploadedFiles[index];
    if (!fileToRemove) return;
    
    try {
      await FileUploadService.deleteFile(fileToRemove.url);
      setUploadedFiles(prev => prev.filter((_, i) => i !== index));
      toast.success('File removed successfully');
    } catch (error: any) {
      console.error('Failed to remove file:', error);
      toast.error('Failed to remove file');
    }
  };
  
  const getFileIcon = (filename: string) => {
    const ext = FileUploadService.getFileExtension(filename).toLowerCase();
    
    if (FileUploadService.isImageFile(filename)) {
      return <Image className="h-4 w-4" />;
    } else if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) {
      return <Video className="h-4 w-4" />;
    } else if (['mp3', 'wav', 'ogg'].includes(ext)) {
      return <Music className="h-4 w-4" />;
    } else if (['zip', 'tar', 'gz', 'rar'].includes(ext)) {
      return <Archive className="h-4 w-4" />;
    } else {
      return <File className="h-4 w-4" />;
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (isTextResponse && !textResponse.trim()) {
      setError('Please provide a text response');
      toast.error('Text response is required');
      return;
    }
    
    if (isFileUpload && uploadedFiles.length === 0 && !isTextResponse) {
      setError('Please upload at least one file');
      toast.error('File upload is required');
      return;
    }
    
    if (uploading) {
      toast.error('Please wait for file uploads to complete');
      return;
    }
    
    setSubmitting(true);
    setError(null);
    
    try {
      // Prepare file metadata for submission
      const filesMetadata = uploadedFiles.map(file => ({
        url: file.url,
        filename: (file as any).originalName || file.pathname.split('/').pop(),
        size: file.size,
        contentType: file.contentType,
        uploadedAt: file.uploadedAt
      }));
      
      // Choose endpoint based on submission mode
      const endpoint = isResubmitMode 
        ? `/api/v1/uploads/assignments/${assignmentData.id}/resubmit-with-files`
        : `/api/v1/uploads/assignments/${assignmentData.id}/submit-with-files`;
      
      // Call backend API with file metadata
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          content: textResponse || undefined,
          files: filesMetadata,
          external_url: undefined
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Submission failed');
      }
      
      setSubmissionResult(result);
      setSubmissionMode('submitted');
      
      // Call parent callbacks
      onSubmit({
        text: textResponse || undefined,
        files: uploadedFiles.length > 0 ? uploadedFiles as any : undefined
      });
      
      if (onSubmitComplete) {
        onSubmitComplete();
      }

      toast.success(isResubmitMode ? 'Assignment Resubmitted!' : 'Assignment Submitted!', {
        description: result.message || (isResubmitMode ? 'Your assignment has been resubmitted successfully' : 'Your assignment has been submitted successfully')
      });
      
    } catch (error: any) {
      console.error('Submission error:', error);
      const errorMessage = error.message || 'Failed to submit assignment';
      setError(errorMessage);
      toast.error('Submission Failed', {
        description: errorMessage
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getDaysUntilDue = () => {
    if (!assignment.due_date) return null;
    const dueDate = new Date(assignment.due_date);
    const now = new Date();
    const diffTime = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysUntilDue = getDaysUntilDue();
  const isOverdue = daysUntilDue !== null && daysUntilDue < 0;
  const isDueSoon = daysUntilDue !== null && daysUntilDue <= 3 && daysUntilDue >= 0;

  // View Mode
  if (submissionMode === 'view') {
    return (
      <div className="space-y-6">
        <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-green-950 dark:via-emerald-950 dark:to-teal-950 shadow-xl">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-green-600 hover:bg-green-700 text-white shadow-md">
                    <FileText className="h-3 w-3 mr-1" />
                    Assignment
                  </Badge>
                  {assignment.submission_status?.status === 'graded' && (
                    <Badge variant="outline" className="bg-white/50 backdrop-blur-sm border-green-300">
                      <Award className="h-3 w-3 mr-1 text-green-600" />
                      Graded
                    </Badge>
                  )}
                  {assignment.submission_status?.submitted && !assignment.submission_status?.status && (
                    <Badge variant="outline" className="bg-white/50 backdrop-blur-sm border-yellow-300">
                      <Clock className="h-3 w-3 mr-1 text-yellow-600" />
                      Pending Review
                    </Badge>
                  )}
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3">{assignment.title}</h3>
                {assignment.description && (
                  <div className="text-gray-700 dark:text-gray-300 text-sm sm:text-base">
                    <MarkdownRenderer 
                      content={assignment.description} 
                      variant="compact" 
                      className="prose-sm leading-relaxed" 
                    />
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            {/* Assignment Details Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-5 text-center border border-green-100 dark:border-green-900 shadow-md hover:shadow-lg transition-all">
                <div className="flex justify-center mb-2">
                  <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                    <Award className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400">{assignment.points_possible}</div>
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">Points</div>
              </div>
              
              {assignment.due_date && (
                <div className={`bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-5 text-center shadow-md hover:shadow-lg transition-all ${
                  isOverdue 
                    ? 'border-2 border-red-400 dark:border-red-600' 
                    : isDueSoon 
                    ? 'border-2 border-yellow-400 dark:border-yellow-600' 
                    : 'border border-blue-100 dark:border-blue-900'
                }`}>
                  <div className="flex justify-center mb-2">
                    <div className={`p-2 rounded-lg ${
                      isOverdue 
                        ? 'bg-red-100 dark:bg-red-900' 
                        : isDueSoon 
                        ? 'bg-yellow-100 dark:bg-yellow-900' 
                        : 'bg-blue-100 dark:bg-blue-900'
                    }`}>
                      <Clock className={`h-5 w-5 ${
                        isOverdue 
                          ? 'text-red-600 dark:text-red-400' 
                          : isDueSoon 
                          ? 'text-yellow-600 dark:text-yellow-400' 
                          : 'text-blue-600 dark:text-blue-400'
                      }`} />
                    </div>
                  </div>
                  <div className={`text-2xl sm:text-3xl font-bold ${
                    isOverdue 
                      ? 'text-red-600 dark:text-red-400' 
                      : isDueSoon 
                      ? 'text-yellow-600 dark:text-yellow-400' 
                      : 'text-blue-600 dark:text-blue-400'
                  }`}>
                    {isOverdue ? 'Overdue' : Math.abs(daysUntilDue!)}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">
                    {isOverdue ? 'Past Due' : 'Days Left'}
                  </div>
                </div>
              )}
              
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-5 text-center border border-purple-100 dark:border-purple-900 shadow-md hover:shadow-lg transition-all col-span-2 lg:col-span-1">
                <div className="flex justify-center mb-2">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                    <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-purple-600 dark:text-purple-400 capitalize">
                  {assignment.assignment_type.replace('_', ' ')}
                </div>
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">Submission Type</div>
              </div>
            </div>

            {/* Instructions */}
            {assignment.instructions && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-xl p-6 sm:p-7 mb-6 border-l-4 border-green-500 shadow-lg hover:shadow-xl transition-all duration-300">
                <h4 className="font-bold text-gray-900 dark:text-white text-lg sm:text-xl mb-5 flex items-center">
                  <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg mr-3 shadow-sm">
                    <BookOpen className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  Assignment Instructions
                </h4>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-green-100 dark:border-green-900">
                  <MarkdownRenderer 
                    content={assignment.instructions} 
                    variant="card" 
                    className="prose-green" 
                  />
                </div>
              </div>
            )}

            {/* Submission Requirements */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-xl p-6 sm:p-7 mb-6 shadow-lg hover:shadow-xl transition-all duration-300">
              <h4 className="font-bold text-gray-900 dark:text-white text-lg sm:text-xl mb-5 flex items-center">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg mr-3 shadow-sm">
                  <AlertCircle className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                Submission Requirements
              </h4>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-blue-100 dark:border-blue-900">
                <ul className="space-y-3 text-gray-700 dark:text-gray-300 text-sm sm:text-base">
                {isTextResponse && (
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Provide a written response in the text editor</span>
                  </li>
                )}
                {isFileUpload && (
                  <>
                    <li className="flex items-start gap-2">
                      <Upload className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                      <span>Upload files: <strong>{allowedFileTypes.join(', ')}</strong></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                      <span>Maximum file size: <strong>{maxFileSizeMB}MB</strong> per file</span>
                    </li>
                  </>
                )}
                {assignment.due_date && (
                  <li className="flex items-start gap-2">
                    <Clock className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
                      isOverdue ? 'text-red-500' : isDueSoon ? 'text-yellow-500' : 'text-purple-500'
                    }`} />
                    <div>
                      <span className={isOverdue ? 'text-red-700 dark:text-red-400 font-bold' : isDueSoon ? 'text-yellow-700 dark:text-yellow-400 font-semibold' : ''}>
                        Due date: {new Date(assignment.due_date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      {isOverdue && <span className="block text-red-600 dark:text-red-400 text-sm mt-1">⚠️ This assignment is past due</span>}
                      {isDueSoon && <span className="block text-yellow-600 dark:text-yellow-400 text-sm mt-1">⏰ Due soon - submit before deadline</span>}
                    </div>
                  </li>
                )}
              </ul>
              </div>
            </div>

            {/* Assignment Status & Feedback Section */}
            {isSubmitted && (
              <div className="bg-gradient-to-r from-slate-50 to-gray-100 dark:from-slate-900/50 dark:to-gray-800/50 rounded-xl p-6 sm:p-7 mb-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-200 dark:border-slate-700">
                <h4 className="font-bold text-gray-900 dark:text-white text-lg sm:text-xl mb-5 flex items-center">
                  <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg mr-3 shadow-sm">
                    <FileText className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                  </div>
                  Assignment Status & Feedback
                </h4>

                {/* Status Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {/* Submission Status */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-slate-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-semibold text-gray-900 dark:text-white text-sm">Submission Status</h5>
                      <div className={`px-2 py-1 rounded-full text-xs font-bold ${
                        isGraded 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : hasModificationRequest
                            ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 animate-pulse'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                      }`}>
                        {isGraded 
                          ? '✓ Graded' 
                          : hasModificationRequest 
                            ? '⚠️ Needs Revision' 
                            : '⏳ Under Review'}
                      </div>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      {assignment.submission_status?.submitted_at && (
                        <>Submitted on {new Date(assignment.submission_status.submitted_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}</>
                      )}
                    </p>
                  </div>

                  {/* Grade Status */}
                  {isGraded && assignment.submission_status?.grade !== undefined && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-slate-200 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-semibold text-gray-900 dark:text-white text-sm">Grade</h5>
                        <div className="flex items-center gap-2">
                          <Award className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <span className="font-bold text-lg text-green-600 dark:text-green-400">
                            {assignment.submission_status.grade}/{assignment.points_possible}
                          </span>
                        </div>
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">
                        {((assignment.submission_status.grade / assignment.points_possible) * 100).toFixed(1)}% 
                        {assignment.submission_status?.graded_at && (
                          <> • Graded {new Date(assignment.submission_status.graded_at).toLocaleDateString()}</>
                        )}
                      </p>
                    </div>
                  )}
                </div>

                {/* Instructor Feedback */}
                {(assignment.submission_status?.feedback || assignment.modification_request_reason) && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm border border-slate-200 dark:border-gray-700 mb-4">
                    <h5 className="font-semibold text-gray-900 dark:text-white text-sm mb-3 flex items-center">
                      <div className="p-1 bg-blue-100 dark:bg-blue-900/50 rounded mr-2">
                        <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      Instructor Feedback
                    </h5>
                    
                    {/* Regular Feedback */}
                    {assignment.submission_status?.feedback && (
                      <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 border-l-4 border-blue-500 mb-3">
                        <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">
                          {assignment.submission_status.feedback}
                        </p>
                        {assignment.submission_status?.grader_name && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 font-medium">
                            — {assignment.submission_status.grader_name}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Modification Request Feedback */}
                    {assignment.modification_request_reason && (
                      <div className="bg-orange-50 dark:bg-orange-950/30 rounded-lg p-4 border-l-4 border-orange-500">
                        <div className="flex items-start gap-2 mb-2">
                          <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                          <h6 className="font-semibold text-orange-800 dark:text-orange-300 text-sm">Modification Request</h6>
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">
                          {assignment.modification_request_reason}
                        </p>
                        {assignment.modification_request_at && (
                          <p className="text-xs text-orange-600 dark:text-orange-400 mt-2 font-medium">
                            Requested on {new Date(assignment.modification_request_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Modification Request Alert */}
            {hasModificationRequest && (
              <Alert className="border-2 border-orange-400 bg-orange-50 dark:bg-orange-950/30 shadow-md">
                <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                <AlertTitle className="text-orange-800 dark:text-orange-300 font-bold">
                  Modification Requested
                </AlertTitle>
                <AlertDescription className="text-orange-700 dark:text-orange-200">
                  Your instructor has requested modifications to your assignment submission.
                  {assignment.modification_request_reason && (
                    <div className="mt-2 p-3 bg-white/50 dark:bg-gray-800/50 rounded border-l-4 border-orange-400">
                      <strong>Reason:</strong> {assignment.modification_request_reason}
                    </div>
                  )}
                  {assignment.modification_request_at && (
                    <p className="text-sm mt-2 text-orange-600 dark:text-orange-400">
                      Requested on {new Date(assignment.modification_request_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full">
              {assignment.submission_status?.status === 'graded' ? (
                <>
                  <Button 
                    onClick={() => setSubmissionMode('submitted')}
                    className="flex-1 w-full sm:w-auto bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-3 sm:py-4 md:py-6 lg:py-7 px-4 sm:px-6 text-sm sm:text-lg md:text-xl font-bold shadow-lg hover:shadow-xl transition-all min-h-[3rem] sm:min-h-[4rem]"
                  >
                    <Award className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 mr-2" />
                    <span className="truncate">View Grade & Feedback</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full sm:w-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-6 border-2 hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[3rem] sm:min-h-[4rem]"
                    onClick={() => window.open('/student/assessments', '_blank')}
                  >
                    <FileText className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    <span className="hidden sm:inline">All Grades</span>
                    <span className="sm:hidden">Grades</span>
                  </Button>
                </>
              ) : isSubmitted ? (
                <>
                  <Button 
                    onClick={() => setSubmissionMode('submitted')}
                    className="flex-1 w-full sm:w-auto bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-600 hover:from-blue-700 hover:via-blue-800 hover:to-indigo-700 text-white py-3 sm:py-4 md:py-6 lg:py-7 px-4 sm:px-6 text-sm sm:text-lg md:text-xl font-bold shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300 border border-blue-500/20 min-h-[3rem] sm:min-h-[4rem]"
                  >
                    <div className="flex items-center justify-center w-full">
                      <div className="p-1 bg-white/20 rounded-full mr-2 sm:mr-3">
                        <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                      </div>
                      <span className="truncate">View Submission</span>
                      {isPendingReview && (
                        <div className="ml-2 px-2 py-1 bg-yellow-400/90 text-yellow-900 text-xs rounded-full font-bold animate-pulse">
                          <span className="hidden sm:inline">Under Review</span>
                          <span className="sm:hidden">Review</span>
                        </div>
                      )}
                    </div>
                  </Button>
                  
                  {canResubmit && (
                    <Button 
                      onClick={() => setSubmissionMode('resubmit')}
                      className="flex-1 w-full sm:w-auto bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 hover:from-orange-600 hover:via-red-600 hover:to-pink-600 text-white py-3 sm:py-4 md:py-6 lg:py-7 px-4 sm:px-6 text-sm sm:text-lg md:text-xl font-bold shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300 border border-orange-400/30 animate-pulse min-h-[3rem] sm:min-h-[4rem]"
                    >
                      <div className="flex items-center justify-center w-full">
                        <div className="p-1 bg-white/20 rounded-full mr-2 sm:mr-3">
                          <Edit className="h-4 w-4 sm:h-5 sm:w-5" />
                        </div>
                        <span className="truncate hidden sm:inline">Resubmit Assignment</span>
                        <span className="truncate sm:hidden">Resubmit</span>
                        <div className="ml-2 px-2 py-1 bg-white/20 text-white text-xs rounded-full font-bold">
                          Required
                        </div>
                      </div>
                    </Button>
                  )}
                  
                  <Button 
                    variant="outline" 
                    className="group w-full sm:w-auto bg-gradient-to-r from-slate-50 to-gray-100 hover:from-slate-100 hover:to-gray-200 dark:from-gray-800 dark:to-gray-700 dark:hover:from-gray-700 dark:hover:to-gray-600 border-2 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-6 text-sm sm:text-base font-semibold shadow-md hover:shadow-lg transform hover:scale-[1.02] transition-all duration-300 min-h-[3rem] sm:min-h-[4rem]"
                  >
                    <div className="flex items-center justify-center text-gray-700 dark:text-gray-300">
                      <div className="p-1.5 bg-blue-100 dark:bg-blue-900/50 rounded-lg mr-2 sm:mr-3 group-hover:bg-blue-200 dark:group-hover:bg-blue-800/50 transition-colors">
                        <Download className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="hidden sm:inline">Course Resources</span>
                      <span className="sm:hidden">Resources</span>
                    </div>
                  </Button>
                </>
              ) : isOverdue ? (
                <>
                  <Button 
                    variant="outline"
                    className="flex-1 w-full sm:w-auto bg-red-50 dark:bg-red-950/30 border-2 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 py-3 sm:py-4 md:py-6 lg:py-7 px-4 sm:px-6 text-sm sm:text-lg md:text-xl font-bold cursor-not-allowed opacity-75 min-h-[3rem] sm:min-h-[4rem]"
                    disabled
                  >
                    <div className="flex items-center justify-center w-full">
                      <div className="p-1 bg-red-100 dark:bg-red-900/50 rounded-full mr-2 sm:mr-3">
                        <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 dark:text-red-400" />
                      </div>
                      <span className="truncate hidden sm:inline">Assignment Expired</span>
                      <span className="truncate sm:hidden">Expired</span>
                      <div className="ml-2 px-2 py-1 bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-300 text-xs rounded-full font-bold">
                        Overdue
                      </div>
                    </div>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="group w-full sm:w-auto bg-gradient-to-r from-slate-50 to-gray-100 hover:from-slate-100 hover:to-gray-200 dark:from-gray-800 dark:to-gray-700 dark:hover:from-gray-700 dark:hover:to-gray-600 border-2 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-6 text-sm sm:text-base font-semibold shadow-md hover:shadow-lg transform hover:scale-[1.02] transition-all duration-300 min-h-[3rem] sm:min-h-[4rem]"
                  >
                    <div className="flex items-center justify-center text-gray-700 dark:text-gray-300">
                      <div className="p-1.5 bg-blue-100 dark:bg-blue-900/50 rounded-lg mr-2 sm:mr-3 group-hover:bg-blue-200 dark:group-hover:bg-blue-800/50 transition-colors">
                        <Download className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="hidden sm:inline">Course Resources</span>
                      <span className="sm:hidden">Resources</span>
                    </div>
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    onClick={() => setSubmissionMode('submit')}
                    className="flex-1 w-full sm:w-auto bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 hover:from-green-700 hover:via-emerald-700 hover:to-teal-700 text-white py-3 sm:py-4 md:py-6 lg:py-7 px-4 sm:px-6 text-sm sm:text-lg md:text-xl font-bold shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300 border border-green-500/20 min-h-[3rem] sm:min-h-[4rem]"
                  >
                    <div className="flex items-center justify-center w-full">
                      <div className="p-1 bg-white/20 rounded-full mr-2 sm:mr-3">
                        <Edit className="h-4 w-4 sm:h-5 sm:w-5" />
                      </div>
                      <span className="truncate hidden sm:inline">Start Assignment</span>
                      <span className="truncate sm:hidden">Start</span>
                      <div className="ml-2 px-2 py-1 bg-white/20 text-white text-xs rounded-full font-bold">
                        New
                      </div>
                    </div>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="group w-full sm:w-auto bg-gradient-to-r from-slate-50 to-gray-100 hover:from-slate-100 hover:to-gray-200 dark:from-gray-800 dark:to-gray-700 dark:hover:from-gray-700 dark:hover:to-gray-600 border-2 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-6 text-sm sm:text-base font-semibold shadow-md hover:shadow-lg transform hover:scale-[1.02] transition-all duration-300 min-h-[3rem] sm:min-h-[4rem]"
                  >
                    <div className="flex items-center justify-center text-gray-700 dark:text-gray-300">
                      <div className="p-1.5 bg-blue-100 dark:bg-blue-900/50 rounded-lg mr-2 sm:mr-3 group-hover:bg-blue-200 dark:group-hover:bg-blue-800/50 transition-colors">
                        <Download className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="hidden sm:inline">Course Resources</span>
                      <span className="sm:hidden">Resources</span>
                    </div>
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Submitted State
  if (submissionMode === 'submitted') {
    const isGraded = assignment.submission_status?.status === 'graded';
    const grade = assignment.submission_status?.grade;
    const feedback = assignment.submission_status?.feedback;
    const percentage = grade ? (grade / assignment.points_possible) * 100 : 0;
    
    // Calculate letter grade
    const getLetterGrade = (percent: number) => {
      if (percent >= 90) return 'A';
      if (percent >= 80) return 'B';
      if (percent >= 70) return 'C';
      if (percent >= 60) return 'D';
      return 'F';
    };
    
    return (
      <div className="space-y-6">
        <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-green-950 dark:via-emerald-950 dark:to-teal-950 shadow-xl">
          <CardContent className="p-6 sm:p-8">
            <div className="text-center mb-6">
              <div className="relative inline-block mb-4">
                <div className="h-20 w-20 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                  <CheckCircle className="h-10 w-10 text-white" />
                </div>
                {isGraded && (
                  <div className="absolute -top-2 -right-2 h-8 w-8 bg-yellow-400 rounded-full flex items-center justify-center shadow-md">
                    <Award className="h-5 w-5 text-yellow-900" />
                  </div>
                )}
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {isGraded ? '🎉 Assignment Graded!' : '✅ Assignment Submitted!'}
              </h3>
              <p className="text-gray-700 dark:text-gray-300 text-sm sm:text-base max-w-2xl mx-auto">
                {isGraded 
                  ? 'Your instructor has reviewed and graded your assignment. View your results below.'
                  : 'Your assignment has been successfully submitted and is now being reviewed by your instructor. You will be notified when grading is complete.'}
              </p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 sm:p-6 mb-6 shadow-md border border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm sm:text-base">
                <div>
                  <p className="text-gray-600 dark:text-gray-400 font-medium mb-1">Submitted At</p>
                  <p className="font-bold text-gray-900 dark:text-white">
                    {assignment.submission_status?.submitted_at 
                      ? new Date(assignment.submission_status.submitted_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : new Date().toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400 font-medium mb-1">Status</p>
                  <Badge className={`text-base font-semibold ${isGraded 
                    ? "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300" 
                    : "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300"}`}>
                    {isGraded ? '✓ Graded' : '⏳ Under Review'}
                  </Badge>
                </div>
              </div>
            </div>
            
            {/* Grade Display */}
            {isGraded && grade !== undefined && (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-xl p-6 sm:p-8 mb-6 border-2 border-green-200 dark:border-green-700 shadow-lg">
                <div className="text-center mb-4">
                  <div className="flex items-center justify-center gap-4 mb-3">
                    <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
                      <Award className="h-8 w-8 text-green-600 dark:text-green-400" />
                    </div>
                    <span className="text-6xl sm:text-7xl font-bold bg-gradient-to-br from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400 bg-clip-text text-transparent">
                      {getLetterGrade(percentage)}
                    </span>
                  </div>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    {grade} / {assignment.points_possible} Points
                  </p>
                  <p className="text-lg sm:text-xl font-semibold text-green-600 dark:text-green-400">
                    {percentage.toFixed(1)}%
                  </p>
                </div>
                
                {assignment.submission_status?.graded_at && (
                  <div className="text-center text-sm text-gray-600 dark:text-gray-400 bg-white/50 dark:bg-gray-800/50 rounded-lg py-2 px-4">
                    Graded on {new Date(assignment.submission_status.graded_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                    {assignment.submission_status?.grader_name && 
                      ` by ${assignment.submission_status.grader_name}`}
                  </div>
                )}
              </div>
            )}
            
            {/* Feedback Display */}
            {isGraded && feedback && (
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-5 sm:p-6 mb-6 border-l-4 border-blue-500 shadow-md">
                <h4 className="font-bold text-gray-900 dark:text-white text-base sm:text-lg mb-4 flex items-center">
                  <div className="p-1.5 bg-blue-100 dark:bg-blue-900 rounded-lg mr-3">
                    <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  Instructor Feedback
                </h4>
                <div className="text-gray-700 dark:text-gray-300 text-sm sm:text-base whitespace-pre-wrap leading-relaxed bg-white/50 dark:bg-gray-800/50 rounded-lg p-4">
                  {feedback}
                </div>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={() => setSubmissionMode('view')}
                className="flex-1 sm:flex-none border-2 py-6 text-base hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back to Details
              </Button>
              
              {isGraded && (
                <Button
                  className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-6 text-base font-bold shadow-lg hover:shadow-xl transition-all"
                  onClick={() => {
                    window.open(`/student/assessments`, '_blank');
                  }}
                >
                  <Award className="h-5 w-5 mr-2" />
                  View All Grades
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Submit/Resubmit Mode
  if (submissionMode === 'submit' || submissionMode === 'resubmit') {
    return (
      <div className="space-y-6">
        {/* Error Alert */}
        {error && (
          <Alert className="border-2 border-red-400 bg-red-50 dark:bg-red-950/30 shadow-md animate-in slide-in-from-top">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <AlertTitle className="text-red-800 dark:text-red-300 font-bold">
              {isResubmitMode ? 'Resubmission Error' : 'Submission Error'}
            </AlertTitle>
            <AlertDescription className="text-red-700 dark:text-red-200">{error}</AlertDescription>
          </Alert>
        )}

        {/* Modification Request Notice for Resubmit Mode */}
        {isResubmitMode && hasModificationRequest && (
          <Alert className="border-2 border-orange-400 bg-orange-50 dark:bg-orange-950/30 shadow-md">
            <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            <AlertTitle className="text-orange-800 dark:text-orange-300 font-bold">
              Resubmitting Assignment
            </AlertTitle>
            <AlertDescription className="text-orange-700 dark:text-orange-200">
              You are resubmitting this assignment based on your instructor's feedback.
              {assignment.modification_request_reason && (
                <div className="mt-2 p-3 bg-white/50 dark:bg-gray-800/50 rounded border-l-4 border-orange-400">
                  <strong>Instructor's Request:</strong> {assignment.modification_request_reason}
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 via-white to-emerald-50 dark:from-green-950 dark:via-gray-900 dark:to-emerald-950 shadow-xl">
          <CardHeader className="border-b dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{assignment.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 flex items-center gap-2">
                  <Edit className="h-4 w-4" />
                  {isResubmitMode ? 'Update and resubmit your assignment' : 'Complete and submit your assignment'}
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={() => setSubmissionMode('view')}
                disabled={submitting}
                className="hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </CardHeader>
        
        <CardContent className="space-y-6 p-6 sm:p-8">
          {/* Due Date Warning */}
          {assignment.due_date && (isDueSoon || isOverdue) && (
            <Alert className={`shadow-md animate-in slide-in-from-top ${
              isOverdue 
                ? 'bg-red-50 dark:bg-red-950/30 border-2 border-red-400' 
                : 'bg-yellow-50 dark:bg-yellow-950/30 border-2 border-yellow-400'
            }`}>
              <div className="flex items-start space-x-3">
                <AlertCircle className={`h-6 w-6 flex-shrink-0 mt-0.5 ${
                  isOverdue ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'
                }`} />
                <div className="flex-1">
                  <p className={`font-bold text-base ${
                    isOverdue ? 'text-red-800 dark:text-red-300' : 'text-yellow-800 dark:text-yellow-300'
                  }`}>
                    {isOverdue ? '⚠️ This assignment is overdue!' : '⏰ Assignment due soon'}
                  </p>
                  <p className={`text-sm mt-1 ${
                    isOverdue ? 'text-red-700 dark:text-red-200' : 'text-yellow-700 dark:text-yellow-200'
                  }`}>
                    Due: {new Date(assignment.due_date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            </Alert>
          )}

          {/* Text Response */}
          {isTextResponse && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 sm:p-6 border-2 border-gray-200 dark:border-gray-700 shadow-sm">
              <label className="block text-base font-bold text-gray-900 dark:text-white mb-3 flex items-center">
                <div className="p-1.5 bg-green-100 dark:bg-green-900 rounded-lg mr-2">
                  <FileText className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                Your Response <span className="text-red-500 ml-1">*</span>
              </label>
              <textarea
                value={textResponse}
                onChange={(e) => setTextResponse(e.target.value)}
                rows={12}
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white resize-none transition-all text-base"
                placeholder="Write your response here... Be clear, concise, and thorough in your answer."
              />
              <div className="flex justify-between mt-3 text-sm">
                <span className="text-gray-600 dark:text-gray-400 font-medium">
                  {textResponse.length} characters
                </span>
                <span className="text-gray-600 dark:text-gray-400 font-medium">
                  {textResponse.split(/\s+/).filter(w => w.length > 0).length} words
                </span>
              </div>
            </div>
          )}

          {/* File Upload */}
          {isFileUpload && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 sm:p-6 border-2 border-gray-200 dark:border-gray-700 shadow-sm">
              <label className="block text-base font-bold text-gray-900 dark:text-white mb-3 flex items-center">
                <div className="p-1.5 bg-blue-100 dark:bg-blue-900 rounded-lg mr-2">
                  <Upload className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                Upload Files {!isTextResponse && <span className="text-red-500 ml-1">*</span>}
              </label>
              
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-green-400 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-950/20 transition-all cursor-pointer">
                <input
                  type="file"
                  multiple
                  accept={allowedFileTypes.join(',')}
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer"
                >
                  <div className="p-4 bg-green-100 dark:bg-green-900 rounded-full w-fit mx-auto mb-4">
                    <Upload className="h-10 w-10 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="text-gray-900 dark:text-white font-bold text-base mb-1">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    Accepted: <span className="font-semibold">{allowedFileTypes.join(', ')}</span>
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                    Maximum size: <span className="font-semibold">{maxFileSizeMB}MB</span> per file
                  </p>
                </label>
              </div>

              {/* Selected Files */}
              {selectedFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Selected Files ({selectedFiles.length})
                  </p>
                  {selectedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-green-50 dark:bg-green-950/20 rounded-lg p-3 border border-green-200 dark:border-green-800 hover:shadow-md transition-all"
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg flex-shrink-0">
                          <Paperclip className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{file.name}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        className="ml-2 hover:bg-red-100 dark:hover:bg-red-900/30 flex-shrink-0"
                      >
                        <X className="h-4 w-4 text-red-600 dark:text-red-400" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t-2 dark:border-gray-700">
            <Button
              variant="outline"
              onClick={() => setSubmissionMode('view')}
              disabled={submitting}
              className="w-full sm:w-auto border-2 py-6 px-8 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <X className="h-5 w-5 mr-2" />
              Cancel
            </Button>
            
            <Button
              onClick={handleSubmit}
              disabled={submitting || (isTextResponse && !textResponse.trim()) || (isFileUpload && !isTextResponse && selectedFiles.length === 0)}
              className="w-full sm:w-auto bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed py-6 px-8 text-lg font-bold shadow-lg hover:shadow-xl transition-all"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  {isResubmitMode ? 'Resubmitting...' : 'Submitting...'}
                </>
              ) : (
                <>
                  <Send className="h-5 w-5 mr-2" />
                  {isResubmitMode ? 'Resubmit Assignment' : 'Submit Assignment'}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
  }

  // This should not be reached
  return null;
};
