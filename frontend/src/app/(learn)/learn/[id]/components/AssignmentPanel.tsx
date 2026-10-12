import React, { useState, useEffect, useRef, useId } from 'react';
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
  AlertTriangle,
  PartyPopper,
  XCircle,
  X,
  Send,
  Paperclip,
  Edit,
  Loader2,
  ArrowLeft,
  BookOpen,
  MessageSquare,
  RefreshCw,
  Image,
  Video,
  Music,
  Archive,
  File
} from 'lucide-react';
import type { ContentAssignment } from '@/services/contentAssignmentApi';
import ContentAssignmentService from '@/services/contentAssignmentApi';
import StudentExcelGradingResult from '@/components/grading/StudentExcelGradingResult';
import FileUploadService, { UploadedFile, FileUploadProgress, StagedFile } from '@/services/file-upload.service';
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
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: FileUploadProgress }>({});
  const [error, setError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<any>(null);
  const [resubmittedForCurrentRequest, setResubmittedForCurrentRequest] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [textResponseError, setTextResponseError] = useState<string | null>(null);
  const [assignmentData, setAssignmentData] = useState<ContentAssignment>(assignment);
  const stagedFilesRef = useRef<StagedFile[]>([]);
  const assignmentIdRef = useRef(assignment.id);
  const assignmentDataRef = useRef<ContentAssignment>(assignment);
  const errorAlertRef = useRef<HTMLDivElement>(null);
  const responseFieldId = useId();
  const responseErrorId = useId();
  const fileUploadFieldId = useId();

  useEffect(() => {
    stagedFilesRef.current = stagedFiles;
  }, [stagedFiles]);

  useEffect(() => {
    assignmentDataRef.current = assignmentData;
  }, [assignmentData]);

  // Move focus to the error alert after a failed submission/validation
  useEffect(() => {
    if (error || validationErrors.length > 0) {
      errorAlertRef.current?.focus();
    }
  }, [error, validationErrors]);

  // Sync assignment data when props change
  React.useEffect(() => {
    setAssignmentData(assignment);
    if (assignmentIdRef.current !== assignment.id) {
      FileUploadService.cleanupStagedFiles?.(stagedFilesRef.current);
      stagedFilesRef.current = [];
      setStagedFiles([]);
      setTextResponse('');
      setSubmissionMode('view');
      setSubmissionResult(null);
      setError(null);
      setValidationErrors([]);
      setTextResponseError(null);
      setResubmittedForCurrentRequest(false);
      assignmentIdRef.current = assignment.id;
    }
  }, [assignment]);
  
  // Cleanup staged files on unmount
  React.useEffect(() => {
    return () => {
      // Safety check to ensure method exists
      if (typeof FileUploadService.cleanupStagedFiles === 'function') {
        FileUploadService.cleanupStagedFiles(stagedFilesRef.current);
      } else {
        console.warn('FileUploadService.cleanupStagedFiles is not available');
        // Manual cleanup as fallback
        stagedFilesRef.current.forEach(stagedFile => {
          if (stagedFile.preview && stagedFile.preview.startsWith('blob:')) {
            URL.revokeObjectURL(stagedFile.preview);
          }
        });
      }
    };
  }, []);

  // Single source of truth for rendering: prefer the freshest data (background
  // poll / manual refresh) over the original prop when timestamps say so.
  const displayAssignment: ContentAssignment = (() => {
    const polledTime = Date.parse(assignmentData.updated_at || '') || 0;
    const propTime = Date.parse(assignment.updated_at || '') || 0;
    return polledTime >= propTime ? assignmentData : assignment;
  })();

  const isFileUpload = displayAssignment.assignment_type === 'file_upload' || displayAssignment.assignment_type === 'both';
  const isTextResponse = displayAssignment.assignment_type === 'text_response' || displayAssignment.assignment_type === 'both';
  const isResubmitMode = submissionMode === 'resubmit';

  // Enhanced status checking using latest assignment data
  const isSubmitted = Boolean(displayAssignment.submission_status?.submitted);
  const isGraded = displayAssignment.submission_status?.status === 'graded';
  const isPendingReview = isSubmitted && !isGraded;
  
  // More flexible modification request detection
  const hasModificationRequest = Boolean(
    displayAssignment.modification_requested || 
    displayAssignment.modification_request_reason ||
    (displayAssignment.submission_status?.status === 'needs_revision')
  );
  
  // Only allow resubmit when instructor specifically requests modifications,
  // the backend still permits it, and the student has not already resubmitted
  // for the current modification request.
  const backendAllowsResubmit = displayAssignment.can_resubmit !== false;
  const canResubmit = hasModificationRequest && isSubmitted && !resubmittedForCurrentRequest && backendAllowsResubmit;

  const allowedFileTypes = displayAssignment.allowed_file_types 
    ? displayAssignment.allowed_file_types.split(',').map(t => t.trim()) 
    : ['*'];
  
  const maxFileSizeMB = displayAssignment.max_file_size_mb || 10;
  const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;

  // Compare a freshly fetched assignment against the last known data to detect
  // a new/changed instructor modification request (a new revision round).
  const detectModificationRequestChange = (updatedData: ContentAssignment) => {
    const prevData = assignmentDataRef.current;
    const newModReq = Boolean(updatedData.modification_requested);
    const newStatus = updatedData.submission_status?.status;
    const newModAt = updatedData.modification_request_at || '';
    const oldModReq = Boolean(prevData.modification_requested);
    const oldStatus = prevData.submission_status?.status;
    const oldModAt = prevData.modification_request_at || '';
    const meaningfulChange = newModReq !== oldModReq || newStatus !== oldStatus || newModAt !== oldModAt;
    const isNewModificationRequest =
      (newModReq && !oldModReq) ||
      (newStatus === 'needs_revision' && oldStatus !== 'needs_revision') ||
      (newModReq && Boolean(newModAt) && newModAt !== oldModAt);
    return { meaningfulChange, isNewModificationRequest };
  };

  // A new revision round re-opens resubmission for the current request
  const reopenResubmission = () => {
    setResubmittedForCurrentRequest(false);
    setTextResponseError(null);
    toast.info('Your instructor has requested modifications for this assignment.');
  };

  // Function to refresh assignment data
  const refreshAssignmentData = async () => {
    setRefreshing(true);
    try {
      const updatedData = await ContentAssignmentService.refreshAssignmentData(assignmentData.id);
      const { isNewModificationRequest } = detectModificationRequestChange(updatedData);
      setAssignmentData(updatedData);
      assignmentDataRef.current = updatedData;
      if (isNewModificationRequest) {
        reopenResubmission();
      }
      toast.success('Assignment data refreshed');
    } catch (error) {
      console.error('Failed to refresh assignment data:', error);
      toast.error('Failed to refresh assignment data');
    } finally {
      setRefreshing(false);
    }
  };

  // Silent refresh (no toast) for auto-polling
  const silentRefresh = async () => {
    try {
      const updatedData = await ContentAssignmentService.refreshAssignmentData(assignmentData.id);
      const { meaningfulChange, isNewModificationRequest } = detectModificationRequestChange(updatedData);
      // Only update if something meaningful changed
      if (meaningfulChange) {
        setAssignmentData(updatedData);
        assignmentDataRef.current = updatedData;
        if (isNewModificationRequest) {
          reopenResubmission();
        }
      }
    } catch {
      // Silent fail — don't bother the user on background poll errors
    }
  };

  // Auto-poll for modification requests when assignment is submitted but not graded
  useEffect(() => {
    if (!isSubmitted || isGraded || hasModificationRequest) return;
    // Poll every 30 seconds while the student has a pending submission
    const interval = setInterval(silentRefresh, 30_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSubmitted, isGraded, hasModificationRequest, assignmentData.id]);

  // Also refresh when the tab becomes visible again
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isSubmitted && !isGraded) {
        silentRefresh();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSubmitted, isGraded, assignmentData.id]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    if (files.length === 0) return;
    
    setError(null);
    setValidationErrors([]);
    
    try {
      // Safety check for staging methods
      if (typeof FileUploadService.stageFiles !== 'function') {
        throw new Error('File staging not available. Please refresh the page.');
      }
      
      // Convert file types for validation
      const allowedMimeTypes = allowedFileTypes.includes('*') 
        ? undefined 
        : allowedFileTypes.map(ext => FileUploadService.getContentType('file' + ext));
      
      const remainingSlots = Math.max(0, 10 - stagedFiles.length);
      if (remainingSlots === 0) {
        throw new Error('You can select a maximum of 10 files. Remove a file before adding another.');
      }

      const newStagedFiles = FileUploadService.stageFiles(files.slice(0, remainingSlots), {
        allowedTypes: allowedMimeTypes,
        maxSize: maxFileSizeBytes,
        maxFiles: 10 // Reasonable limit
      });
      
      setStagedFiles(prev => [...prev, ...newStagedFiles]);
      
      // Collect validation errors
      const invalidFiles = typeof FileUploadService.getInvalidStagedFiles === 'function' 
        ? FileUploadService.getInvalidStagedFiles(newStagedFiles)
        : [];
        
      if (invalidFiles.length > 0) {
        const errors = invalidFiles.map(({ stagedFile, errors }) => 
          `${stagedFile.file.name}: ${errors.join(', ')}`
        );
        setValidationErrors(errors);
        toast.error(`${invalidFiles.length} file(s) failed validation`);
      }
      
      const validFiles = typeof FileUploadService.getValidStagedFiles === 'function'
        ? FileUploadService.getValidStagedFiles(newStagedFiles)
        : newStagedFiles.filter(sf => sf.validationResult?.isValid);
        
      if (validFiles.length > 0) {
        toast.success(`${validFiles.length} file(s) ready for submission`);
      }
      
    } catch (error: any) {
      console.error('File staging error:', error);
      setError(`File selection failed: ${error.message}`);
      toast.error('File selection failed');
    } finally {
      // Clear the input
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const removeStagedFile = (index: number) => {
    const fileToRemove = stagedFiles[index];
    if (!fileToRemove) return;
    
    // Clean up preview URL if it exists
    if (fileToRemove.preview && fileToRemove.preview.startsWith('blob:')) {
      URL.revokeObjectURL(fileToRemove.preview);
    }
    
    setStagedFiles(prev => prev.filter((_, i) => i !== index));
    toast.success('File removed from staging area');
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
    // Double-submit protection: no-op while a submission is already in flight
    if (submitting) {
      toast.error('Submission already in progress');
      return;
    }
    
    // Validation
    if (isTextResponse && !textResponse.trim()) {
      setTextResponseError('Please provide a text response');
      setError('Please provide a text response');
      toast.error('Text response is required');
      return;
    }
    setTextResponseError(null);
    
    const validStagedFiles = typeof FileUploadService.getValidStagedFiles === 'function'
      ? FileUploadService.getValidStagedFiles(stagedFiles)
      : stagedFiles.filter(sf => sf.validationResult?.isValid);
    
    if (isFileUpload && validStagedFiles.length === 0 && !isTextResponse) {
      setError('Please select at least one valid file');
      toast.error('File upload is required');
      return;
    }
    
    setSubmitting(true);
    setError(null);
    setUploadProgress({});
    
    try {
      let uploadedFiles: UploadedFile[] = [];
      
      // Upload files if any are staged
      if (validStagedFiles.length > 0) {
        toast.info('Uploading files...', { duration: 2000 });
        
        if (typeof FileUploadService.uploadStagedFiles !== 'function') {
          throw new Error('File upload service not available. Please refresh the page.');
        }
        
        const uploadResult = await FileUploadService.uploadStagedFiles(validStagedFiles, {
          folder: 'assignments',
          assignmentId: assignment.id,
          onFileProgress: (fileId, progress) => {
            setUploadProgress(prev => ({ ...prev, [fileId]: progress }));
          },
          onOverallProgress: (completed, total, failed) => {
            if (completed + failed === total) {
              setUploadProgress({});
            }
          }
        });
        
        if (uploadResult.totalFailed > 0) {
          const errorMessages = uploadResult.failed.map(f => `${f.file.name}: ${f.error}`);
          throw new Error(`Failed to upload ${uploadResult.totalFailed} file(s):\n${errorMessages.join('\n')}`);
        }
        
        uploadedFiles = uploadResult.successful;
        toast.success(`Successfully uploaded ${uploadResult.totalUploaded} file(s)`);
      }
      
      // Prepare file metadata for submission
      const filesMetadata = uploadedFiles.map(file => ({
        url: file.url,
        filename: file.pathname.split('/').pop() || 'unknown',
        size: file.size,
        contentType: file.contentType,
        uploadedAt: file.uploadedAt
      }));
      
      // Get the correct API base URL
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';
      
      // Choose endpoint based on submission mode
      const endpoint = isResubmitMode 
        ? `${API_BASE_URL}/uploads/assignments/${assignmentData.id}/resubmit-with-files`
        : `${API_BASE_URL}/uploads/assignments/${assignmentData.id}/submit-with-files`;
      
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
      
      const result = (await response.json()) as {
        error?: string;
        message?: string;
        [key: string]: unknown;
      };
      
      if (!response.ok) {
        // Clean up uploaded files on submission failure
        if (uploadedFiles.length > 0) {
          try {
            await Promise.allSettled(
              uploadedFiles.map(file => FileUploadService.deleteFile(file.url))
            );
          } catch (cleanupError) {
            console.warn('Failed to cleanup uploaded files after submission failure:', cleanupError);
          }
        }
        // If backend blocks duplicate resubmission, set flag and show message
        if (isResubmitMode && (result.error || '').toLowerCase().includes('already submitted')) {
          setResubmittedForCurrentRequest(true);
          setError('You have already submitted a response for this modification request. Wait for instructor review.');
          toast.error('Duplicate Resubmission Blocked', {
            description: 'You have already submitted a response for this modification request. Wait for instructor review.'
          });
          return;
        }
        throw new Error(result.error || 'Submission failed');
      }
      
      setSubmissionResult(result);
      if (isResubmitMode) {
        setResubmittedForCurrentRequest(true);

        // Update local state to reflect cleared grade & modification flags
        setAssignmentData(prev => ({
          ...prev,
          modification_requested: false,
          modification_request_reason: undefined,
          modification_request_at: undefined,
          can_resubmit: false,
          submission_status: {
            ...prev.submission_status,
            submitted: true,
            status: 'submitted' as const,
            grade: undefined,
            score: undefined,
            feedback: undefined,
            graded_at: undefined,
            grader_name: undefined,
            submitted_at: new Date().toISOString(),
          },
        }));
      }
      setSubmissionMode('submitted');
      
      // Clean up staged files after successful submission
      if (typeof FileUploadService.cleanupStagedFiles === 'function') {
        FileUploadService.cleanupStagedFiles(stagedFiles);
      }
      setStagedFiles([]);
      
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
      setUploadProgress({});
    }
  };

  const formatFileSize = (bytes: number) => {
    return FileUploadService.formatFileSize(bytes);
  };

  const getDaysUntilDue = () => {
    if (!displayAssignment.due_date) return null;
    const dueDate = new Date(displayAssignment.due_date);
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
                  {displayAssignment.submission_status?.status === 'graded' && (
                    <Badge variant="outline" className="bg-white/50 backdrop-blur-sm border-green-300">
                      <Award className="h-3 w-3 mr-1 text-green-600" />
                      Graded
                    </Badge>
                  )}
                  {displayAssignment.submission_status?.submitted && !displayAssignment.submission_status?.status && (
                    <Badge variant="outline" className="bg-white/50 backdrop-blur-sm border-yellow-300">
                      <Clock className="h-3 w-3 mr-1 text-yellow-600" />
                      Pending Review
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={refreshAssignmentData}
                    disabled={refreshing}
                    aria-label="Refresh assignment status"
                    title="Refresh assignment status"
                    className="h-9 w-9 p-0 rounded-full hover:bg-green-100 dark:hover:bg-green-900/40"
                  >
                    <RefreshCw className={`h-4 w-4 text-gray-600 dark:text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3">{displayAssignment.title}</h3>
                {displayAssignment.description && (
                  <div className="text-gray-700 dark:text-gray-300 text-sm sm:text-base">
                    <MarkdownRenderer 
                      content={displayAssignment.description} 
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
                <div className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400">{displayAssignment.points_possible}</div>
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">Points</div>
              </div>
              
              {displayAssignment.due_date && (
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
                  {displayAssignment.assignment_type.replace('_', ' ')}
                </div>
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">Submission Type</div>
              </div>
            </div>

            {/* Instructions */}
            {displayAssignment.instructions && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-xl p-6 sm:p-7 mb-6 border-l-4 border-green-500 shadow-lg hover:shadow-xl transition-all duration-300">
                <h4 className="font-bold text-gray-900 dark:text-white text-lg sm:text-xl mb-5 flex items-center">
                  <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg mr-3 shadow-sm">
                    <BookOpen className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  Assignment Instructions
                </h4>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-green-100 dark:border-green-900">
                  <MarkdownRenderer 
                    content={displayAssignment.instructions} 
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
                {displayAssignment.due_date && (
                  <li className="flex items-start gap-2">
                    <Clock className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
                      isOverdue ? 'text-red-500' : isDueSoon ? 'text-yellow-500' : 'text-purple-500'
                    }`} />
                    <div>
                      <span className={isOverdue ? 'text-red-700 dark:text-red-400 font-bold' : isDueSoon ? 'text-yellow-700 dark:text-yellow-400 font-semibold' : ''}>
                        Due date: {new Date(displayAssignment.due_date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      {isOverdue && (
                        <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400 text-sm mt-1">
                          <AlertTriangle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                          This assignment is past due
                        </span>
                      )}
                      {isDueSoon && (
                        <span className="flex items-center gap-1.5 text-yellow-600 dark:text-yellow-400 text-sm mt-1">
                          <Clock className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                          Due soon - submit before deadline
                        </span>
                      )}
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
                      <div className={`px-2 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${
                        isGraded 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : hasModificationRequest
                            ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 animate-pulse'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                      }`}>
                        {isGraded ? (
                          <>
                            <CheckCircle className="h-3 w-3" aria-hidden="true" />
                            Graded
                          </>
                        ) : hasModificationRequest ? (
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
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      {displayAssignment.submission_status?.submitted_at && (
                        <>Submitted on {new Date(displayAssignment.submission_status.submitted_at).toLocaleDateString('en-US', {
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
                  {isGraded && displayAssignment.submission_status?.grade !== undefined && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-slate-200 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-semibold text-gray-900 dark:text-white text-sm">Grade</h5>
                        <div className="flex items-center gap-2">
                          <Award className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <span className="font-bold text-lg text-green-600 dark:text-green-400">
                            {displayAssignment.submission_status.grade}/{displayAssignment.points_possible}
                          </span>
                        </div>
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">
                        {displayAssignment.points_possible > 0
                          ? `${((displayAssignment.submission_status.grade / displayAssignment.points_possible) * 100).toFixed(1)}%`
                          : '—'}
                        {displayAssignment.submission_status?.graded_at && (
                          <> • Graded {new Date(displayAssignment.submission_status.graded_at).toLocaleDateString()}</>
                        )}
                      </p>
                    </div>
                  )}
                </div>

                {/* Instructor Feedback */}
                {displayAssignment.submission_status?.feedback && !hasModificationRequest && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm border border-slate-200 dark:border-gray-700 mb-4">
                    <h5 className="font-semibold text-gray-900 dark:text-white text-sm mb-3 flex items-center">
                      <div className="p-1 bg-blue-100 dark:bg-blue-900/50 rounded mr-2">
                        <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      Instructor Feedback
                    </h5>
                    
                    <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 border-l-4 border-blue-500">
                      <div className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                        <MarkdownRenderer 
                          content={displayAssignment.submission_status.feedback} 
                          variant="compact" 
                          className="prose-sm prose-blue" 
                        />
                      </div>
                      {displayAssignment.submission_status?.grader_name && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-3 font-medium flex items-center gap-1">
                          <Award className="h-3 w-3" />
                          Graded by {displayAssignment.submission_status.grader_name}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Modification Request Alert — rich markdown rendering */}
            {hasModificationRequest && (
              <div className="rounded-xl border-2 border-orange-400 bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-orange-950/40 dark:via-amber-950/30 dark:to-yellow-950/20 shadow-lg overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3 flex items-center gap-3">
                  <div className="p-1.5 bg-white/20 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-white" />
                  </div>
                  <h4 className="text-white font-bold text-base sm:text-lg">
                    Modification Requested
                  </h4>
                  {displayAssignment.modification_request_at && (
                    <span className="ml-auto text-xs text-white/80 font-medium hidden sm:block">
                      {new Date(displayAssignment.modification_request_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  )}
                </div>

                {/* Body */}
                <div className="p-5 sm:p-6 space-y-4">
                  <p className="text-orange-800 dark:text-orange-200 text-sm sm:text-base font-medium">
                    Your instructor has requested modifications to your assignment. Please review the feedback below and resubmit.
                  </p>

                  {displayAssignment.modification_request_reason && (
                    <div className="bg-white dark:bg-gray-800/70 rounded-lg p-4 sm:p-5 border border-orange-200 dark:border-orange-800/50 shadow-sm">
                      <div className="prose prose-sm dark:prose-invert max-w-none
                        prose-headings:text-orange-900 dark:prose-headings:text-orange-200
                        prose-strong:text-orange-900 dark:prose-strong:text-orange-200
                        prose-em:text-orange-700 dark:prose-em:text-orange-300
                        prose-li:text-gray-700 dark:prose-li:text-gray-300
                        prose-p:text-gray-700 dark:prose-p:text-gray-300
                        prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5
                        prose-h2:text-base prose-h2:font-bold prose-h2:mt-4 prose-h2:mb-2
                        prose-h3:text-sm prose-h3:font-semibold prose-h3:mt-3 prose-h3:mb-1">
                        <MarkdownRenderer 
                          content={displayAssignment.modification_request_reason} 
                          variant="compact" 
                          className="leading-relaxed" 
                        />
                      </div>
                    </div>
                  )}

                  {displayAssignment.modification_request_at && (
                    <p className="text-xs text-orange-500 dark:text-orange-400 font-medium flex items-center gap-1.5 sm:hidden">
                      <Clock className="h-3 w-3" />
                      Requested on {new Date(displayAssignment.modification_request_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full">
              {displayAssignment.submission_status?.status === 'graded' && !hasModificationRequest ? (
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
                  
                  {hasModificationRequest && isSubmitted && (
                    <Button
                      onClick={() => setSubmissionMode('resubmit')}
                      className="flex-1 w-full sm:w-auto bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 hover:from-orange-600 hover:via-red-600 hover:to-pink-600 text-white py-3 sm:py-4 md:py-6 lg:py-7 px-4 sm:px-6 text-sm sm:text-lg md:text-xl font-bold shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300 border border-orange-400/30 animate-pulse min-h-[3rem] sm:min-h-[4rem]"
                      disabled={!canResubmit}
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
                        {!canResubmit && (
                          <span className="ml-2 px-2 py-1 bg-orange-200 text-orange-800 text-xs rounded-full font-bold">
                            {resubmittedForCurrentRequest ? 'Already Resubmitted' : 'Resubmission Closed'}
                          </span>
                        )}
                      </div>
                    </Button>
                  )}
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
    const isGraded = displayAssignment.submission_status?.status === 'graded';
    const grade = displayAssignment.submission_status?.grade;
    const feedback = displayAssignment.submission_status?.feedback;
    const pointsPossible = displayAssignment.points_possible;
    // Guard against missing/zero points_possible so we never render NaN%
    const percentage = typeof grade === 'number' && pointsPossible > 0
      ? (grade / pointsPossible) * 100
      : null;
    
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
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center justify-center gap-2.5">
                {isGraded ? (
                  <PartyPopper className="h-7 w-7 text-green-600 dark:text-green-400" aria-hidden="true" />
                ) : (
                  <CheckCircle className="h-7 w-7 text-green-600 dark:text-green-400" aria-hidden="true" />
                )}
                {isGraded ? 'Assignment Graded!' : 'Assignment Submitted!'}
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
                    {displayAssignment.submission_status?.submitted_at 
                      ? new Date(displayAssignment.submission_status.submitted_at).toLocaleString('en-US', {
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
                    {isGraded ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-1.5" aria-hidden="true" />
                        Graded
                      </>
                    ) : (
                      <>
                        <Clock className="h-4 w-4 mr-1.5" aria-hidden="true" />
                        Under Review
                      </>
                    )}
                  </Badge>
                </div>
              </div>
            </div>
            
            {/* Grade Display */}
            {isGraded && grade !== undefined && (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-xl p-6 sm:p-8 mb-6 border-2 border-green-200 dark:border-green-700 shadow-lg">
                <div className="text-center mb-4">
                  <div className="flex items-center justify-center mb-3">
                    <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
                      <Award className="h-8 w-8 text-green-600 dark:text-green-400" />
                    </div>
                  </div>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    {grade} / {displayAssignment.points_possible} Points
                  </p>
                  <p className="text-lg sm:text-xl font-semibold text-green-600 dark:text-green-400">
                    {percentage !== null ? `${percentage.toFixed(1)}%` : '—'}
                  </p>
                </div>

                {/* Score Progress Bar */}
                <div className="mt-4 mb-2">
                  <div className="flex justify-between text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                    <span>0%</span>
                    {displayAssignment.passing_score && (
                      <span className="text-orange-600 dark:text-orange-400">
                        Pass: {displayAssignment.passing_score}%
                      </span>
                    )}
                    <span>100%</span>
                  </div>
                  <div
                    className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
                    role="progressbar"
                    aria-valuenow={percentage !== null ? Math.min(100, Math.max(0, Math.round(percentage))) : undefined}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuetext={percentage !== null ? `${percentage.toFixed(1)}%` : undefined}
                    aria-label="Assignment score"
                  >
                    <div
                      className={`h-full rounded-full transition-all duration-700 ease-out ${
                        !displayAssignment.passing_score
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-500'
                          : percentage !== null && percentage >= displayAssignment.passing_score
                            ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                            : 'bg-gradient-to-r from-red-500 to-orange-500'
                      }`}
                      style={{ width: `${percentage !== null ? Math.min(Math.max(percentage, 0), 100) : 0}%` }}
                    />
                    {displayAssignment.passing_score && (
                      <div 
                        className="absolute top-0 h-full w-0.5 bg-orange-500 dark:bg-orange-400"
                        style={{ left: `${displayAssignment.passing_score}%` }}
                      />
                    )}
                  </div>
                  {percentage === null ? (
                    <p className="text-xs font-medium mt-1.5 text-center text-gray-500 dark:text-gray-400">
                      Score percentage unavailable
                    </p>
                  ) : displayAssignment.passing_score ? (
                    <p className={`text-xs font-semibold mt-1.5 text-center ${
                      percentage >= displayAssignment.passing_score
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {percentage >= displayAssignment.passing_score ? (
                        <>
                          <CheckCircle className="h-3.5 w-3.5 inline-block align-[-2px] mr-1" aria-hidden="true" />
                          Passing score met
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3.5 w-3.5 inline-block align-[-2px] mr-1" aria-hidden="true" />
                          Below passing score ({displayAssignment.passing_score}%)
                        </>
                      )}
                    </p>
                  ) : (
                    <p className="text-xs font-medium mt-1.5 text-center text-gray-500 dark:text-gray-400">
                      Passing threshold not set
                    </p>
                  )}
                </div>
                
                {displayAssignment.submission_status?.graded_at && (
                  <div className="text-center text-sm text-gray-600 dark:text-gray-400 bg-white/50 dark:bg-gray-800/50 rounded-lg py-2 px-4 mt-4">
                    Graded on {new Date(displayAssignment.submission_status.graded_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                    {displayAssignment.submission_status?.grader_name && 
                      ` by ${displayAssignment.submission_status.grader_name}`}
                  </div>
                )}
              </div>
            )}
            
            {/* Feedback Display */}
            {isGraded && feedback && (
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-5 sm:p-6 mb-6 border-l-4 border-blue-500 shadow-md">
                <h4 className="font-bold text-gray-900 dark:text-white text-base sm:text-lg mb-4 flex items-center">
                  <div className="p-1.5 bg-blue-100 dark:bg-blue-900 rounded-lg mr-3">
                    <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  Instructor Feedback
                </h4>
                <div className="bg-white/70 dark:bg-gray-800/50 rounded-lg p-4 sm:p-5 border border-blue-100 dark:border-blue-900/50">
                  <div className="prose prose-sm dark:prose-invert max-w-none
                    prose-headings:text-gray-900 dark:prose-headings:text-white
                    prose-strong:text-gray-900 dark:prose-strong:text-white
                    prose-p:text-gray-700 dark:prose-p:text-gray-300
                    prose-li:text-gray-700 dark:prose-li:text-gray-300
                    prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5">
                    <MarkdownRenderer 
                      content={feedback} 
                      variant="compact" 
                      className="leading-relaxed" 
                    />
                  </div>
                </div>
              </div>
            )}

            {/* AI Excel Grading Result */}
            {(displayAssignment.submission_status?.id || submissionResult?.submission?.id) && (
              <StudentExcelGradingResult
                submissionId={displayAssignment.submission_status?.id || submissionResult?.submission?.id}
                submissionType="assignment"
              />
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
        {(error || validationErrors.length > 0) && (
          <Alert
            ref={errorAlertRef}
            tabIndex={-1}
            role="alert"
            className="border-2 border-red-400 bg-red-50 dark:bg-red-950/30 shadow-md animate-in slide-in-from-top focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <AlertTitle className="text-red-800 dark:text-red-300 font-bold">
              {isResubmitMode ? 'Resubmission Error' : 'Submission Error'}
            </AlertTitle>
            <AlertDescription className="text-red-700 dark:text-red-200">
              {error}
              {validationErrors.length > 0 && (
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  {validationErrors.map((validationError, index) => (
                    <li key={`${validationError}-${index}`}>{validationError}</li>
                  ))}
                </ul>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Modification Request Notice for Resubmit Mode */}
        {isResubmitMode && hasModificationRequest && (
          <div className="rounded-xl border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/20 shadow-md overflow-hidden">
            <div className="bg-gradient-to-r from-orange-400 to-amber-400 px-4 py-2.5 flex items-center gap-2">
              <Edit className="h-4 w-4 text-white" />
              <h4 className="text-white font-bold text-sm sm:text-base">
                Resubmitting Assignment
              </h4>
            </div>
            <div className="p-4 sm:p-5 space-y-3">
              <p className="text-orange-800 dark:text-orange-200 text-sm font-medium">
                Review the feedback below and upload your revised work.
              </p>
              {displayAssignment.modification_request_reason && (
                <div className="bg-white dark:bg-gray-800/70 rounded-lg p-4 border border-orange-200 dark:border-orange-800/50 shadow-sm">
                  <div className="prose prose-sm dark:prose-invert max-w-none
                    prose-headings:text-orange-900 dark:prose-headings:text-orange-200
                    prose-strong:text-orange-900 dark:prose-strong:text-orange-200
                    prose-li:text-gray-700 dark:prose-li:text-gray-300
                    prose-p:text-gray-700 dark:prose-p:text-gray-300
                    prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5">
                    <MarkdownRenderer 
                      content={displayAssignment.modification_request_reason} 
                      variant="compact" 
                      className="leading-relaxed" 
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 via-white to-emerald-50 dark:from-green-950 dark:via-gray-900 dark:to-emerald-950 shadow-xl">
          <CardHeader className="border-b dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{displayAssignment.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 flex items-center gap-2">
                  <Edit className="h-4 w-4" />
                  {isResubmitMode ? 'Update and resubmit your assignment' : 'Complete and submit your assignment'}
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={() => setSubmissionMode('view')}
                disabled={submitting}
                aria-label="Close submission form"
                title="Close submission form"
                className="h-11 w-11 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </CardHeader>
        
        <CardContent className="space-y-6 p-6 sm:p-8">
          {/* Due Date Warning */}
          {displayAssignment.due_date && (isDueSoon || isOverdue) && (
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
                  <p className={`font-bold text-base flex items-center gap-2 ${
                    isOverdue ? 'text-red-800 dark:text-red-300' : 'text-yellow-800 dark:text-yellow-300'
                  }`}>
                    {isOverdue ? (
                      <>
                        <AlertTriangle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                        This assignment is overdue!
                      </>
                    ) : (
                      <>
                        <Clock className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                        Assignment due soon
                      </>
                    )}
                  </p>
                  <p className={`text-sm mt-1 ${
                    isOverdue ? 'text-red-700 dark:text-red-200' : 'text-yellow-700 dark:text-yellow-200'
                  }`}>
                    Due: {new Date(displayAssignment.due_date).toLocaleDateString('en-US', {
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
              <label htmlFor={responseFieldId} className="block text-base font-bold text-gray-900 dark:text-white mb-3 flex items-center">
                <div className="p-1.5 bg-green-100 dark:bg-green-900 rounded-lg mr-2">
                  <FileText className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                Your Response <span className="text-red-500 ml-1">*</span>
              </label>
              <textarea
                id={responseFieldId}
                value={textResponse}
                onChange={(e) => {
                  setTextResponse(e.target.value);
                  setTextResponseError(null);
                }}
                rows={12}
                aria-invalid={textResponseError ? true : undefined}
                aria-describedby={textResponseError ? responseErrorId : undefined}
                className={`w-full px-4 py-3 border-2 ${
                  textResponseError
                    ? 'border-red-500 dark:border-red-600 focus:ring-red-500 focus:border-red-500'
                    : 'border-gray-300 dark:border-gray-600 focus:ring-green-500 focus:border-green-500'
                } rounded-lg focus:ring-2 dark:bg-gray-700 dark:text-white resize-none transition-all text-base`}
                placeholder="Write your response here... Be clear, concise, and thorough in your answer."
              />
              {textResponseError && (
                <p
                  id={responseErrorId}
                  className="mt-2 flex items-center gap-1.5 text-sm font-medium text-red-600 dark:text-red-400"
                >
                  <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  {textResponseError}
                </p>
              )}
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
              <label
                htmlFor={fileUploadFieldId}
                className="block text-base font-bold text-gray-900 dark:text-white mb-3 flex items-center"
              >
                <div className="p-1.5 bg-blue-100 dark:bg-blue-900 rounded-lg mr-2">
                  <Upload className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                Upload Files {!isTextResponse && <span className="text-red-500 ml-1">*</span>}
              </label>
              
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-green-400 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-950/20 transition-all cursor-pointer focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-500">
                <input
                  type="file"
                  multiple
                  accept={allowedFileTypes.join(',')}
                  onChange={handleFileSelect}
                  className="sr-only"
                  id={fileUploadFieldId}
                />
                <label
                  htmlFor={fileUploadFieldId}
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

              {/* Staged Files */}
              {stagedFiles.length > 0 && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Selected Files ({stagedFiles.length})
                    </p>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Total: {FileUploadService.formatFileSize(FileUploadService.getTotalStagedSize(stagedFiles))}
                    </div>
                  </div>
                  {stagedFiles.map((stagedFile, index) => (
                    <div
                      key={stagedFile.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        stagedFile.validationResult.isValid
                          ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                      } hover:shadow-md transition-all`}
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className={`p-2 rounded-lg flex-shrink-0 ${
                          stagedFile.validationResult.isValid
                            ? 'bg-green-100 dark:bg-green-900'
                            : 'bg-red-100 dark:bg-red-900'
                        }`}>
                          {stagedFile.preview ? (
                            <img src={stagedFile.preview} alt={stagedFile.file.name} className="h-4 w-4 object-cover rounded" />
                          ) : (
                            <Paperclip className={`h-4 w-4 ${
                              stagedFile.validationResult.isValid
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                            }`} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-medium truncate ${
                            stagedFile.validationResult.isValid
                              ? 'text-gray-900 dark:text-white'
                              : 'text-red-600 dark:text-red-400'
                          }`}>{stagedFile.file.name}</p>
                          <div className="flex items-center space-x-2">
                            <p className="text-xs text-gray-600 dark:text-gray-400">{formatFileSize(stagedFile.file.size)}</p>
                            {!stagedFile.validationResult.isValid && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200">
                                Invalid
                              </span>
                            )}
                          </div>
                          {!stagedFile.validationResult.isValid && (
                            <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                              {stagedFile.validationResult.errors.join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeStagedFile(index)}
                        className="ml-2 hover:bg-red-100 dark:hover:bg-red-900/30 flex-shrink-0"
                        title="Remove file"
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
              disabled={submitting || (isTextResponse && !textResponse.trim()) || (isFileUpload && !isTextResponse && FileUploadService.getValidStagedFiles(stagedFiles).length === 0)}
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
