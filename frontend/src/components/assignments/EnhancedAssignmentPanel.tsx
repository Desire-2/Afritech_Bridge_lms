import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  FileText, 
  Upload, 
  Clock, 
  Award, 
  AlertCircle, 
  X, 
  Download,
  Eye,
  CheckCircle2,
  MessageSquare,
  Calendar,
  Loader2,
  File,
  Image,
  Archive,
  Video,
  Music,
  Send,
  Paperclip,
  Edit,
  ArrowLeft,
  BookOpen,
  Trash2,
  RefreshCw
} from 'lucide-react';

import FileUploadService, { UploadedFile, FileUploadProgress, StagedFile } from '@/services/file-upload.service';
import { toast } from 'sonner';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';

export interface ContentAssignment {
  id: number;
  title: string;
  description: string;
  instructions?: string;
  assignment_type: 'file_upload' | 'text_response' | 'both';
  max_file_size_mb?: number;
  allowed_file_types?: string;
  due_date?: string;
  points_possible?: number;
  is_published: boolean;
  modification_requested?: boolean;
  modification_request_reason?: string;
  modification_request_at?: string;
  can_resubmit?: boolean;
  submission_status?: {
    submitted: boolean;
    status?: string;
    grade?: number;
    feedback?: string;
    submitted_at?: string;
    graded_at?: string;
  };
}

interface AssignmentPanelProps {
  assignment: ContentAssignment;
  onSubmit: (submission: AssignmentSubmission) => void;
  onSubmitComplete?: () => void;
}

interface AssignmentSubmission {
  text?: string;
  files?: (File | UploadedFile)[];
}

interface FileWithProgress extends UploadedFile {
  originalName?: string;
  progress?: number;
  uploading?: boolean;
  error?: string;
  fileKey?: string;
}

export const EnhancedAssignmentPanel: React.FC<AssignmentPanelProps> = ({ 
  assignment,
  onSubmit,
  onSubmitComplete
}) => {
  const [submissionMode, setSubmissionMode] = useState<'view' | 'submit' | 'submitted' | 'resubmit'>('view');
  const [textResponse, setTextResponse] = useState('');
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<FileWithProgress[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: FileUploadProgress }>({});
  const [error, setError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<any>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [resubmittedForCurrentRequest, setResubmittedForCurrentRequest] = useState(false);
  
  // Cleanup staged files on unmount
  React.useEffect(() => {
    return () => {
      FileUploadService.cleanupStagedFiles(stagedFiles);
    };
  }, []);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isFileUpload = assignment.assignment_type === 'file_upload' || assignment.assignment_type === 'both';
  const isTextResponse = assignment.assignment_type === 'text_response' || assignment.assignment_type === 'both';
  const isResubmitMode = submissionMode === 'resubmit';

  const isSubmitted = Boolean(assignment.submission_status?.submitted);
  const isGraded = assignment.submission_status?.status === 'graded';
  const hasModificationRequest = Boolean(
    assignment.modification_requested || 
    assignment.modification_request_reason ||
    (assignment.submission_status?.status === 'needs_revision')
  );
  const canResubmit = hasModificationRequest && isSubmitted && !resubmittedForCurrentRequest;

  const allowedFileTypes = assignment.allowed_file_types 
    ? assignment.allowed_file_types.split(',').map(t => t.trim()) 
    : ['*'];
  
  const maxFileSizeMB = assignment.max_file_size_mb || 50;
  const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    if (files.length === 0) return;
    
    setUploading(true);
    setError(null);
    
    try {
      const allowedMimeTypes = allowedFileTypes.includes('*') 
        ? undefined 
        : allowedFileTypes.map(ext => FileUploadService.getContentType('file' + ext));
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileKey = `${file.name}-${file.size}-${Date.now()}-${i}`;
        
        // Add file to state with uploading status
        const tempFile: FileWithProgress = {
          url: '',
          size: file.size,
          uploadedAt: new Date().toISOString(),
          pathname: '',
          contentType: file.type,
          contentDisposition: `attachment; filename="${file.name}"`,
          originalName: file.name,
          uploading: true,
          progress: 0,
          fileKey // Add unique identifier
        };
        
        setUploadedFiles(prev => [...prev, tempFile]);
        
        try {
          const uploadedFile = await FileUploadService.uploadFile(file, {
            folder: 'assignments',
            assignmentId: assignment.id,
            allowedTypes: allowedMimeTypes,
            maxSize: maxFileSizeBytes,
            onProgress: (progress) => {
              setUploadProgress(prev => ({ ...prev, [fileKey]: progress }));
              setUploadedFiles(prev => prev.map((f) => 
                f.fileKey === fileKey ? { ...f, progress: progress.percentage } : f
              ));
            }
          });
          
          // Update the file with upload results
          setUploadedFiles(prev => prev.map((f) => 
            f.fileKey === fileKey
              ? { 
                  ...uploadedFile, 
                  originalName: file.name,
                  uploading: false,
                  progress: 100,
                  fileKey
                } as FileWithProgress
              : f
          ));
          
          toast.success(`File "${file.name}" uploaded successfully`);
        } catch (error: any) {
          console.error(`Failed to upload ${file.name}:`, error);
          
          // Update file with error status
          setUploadedFiles(prev => prev.map((f) => 
            f.fileKey === fileKey
              ? { ...f, uploading: false, error: error.message }
              : f
          ));
          
          toast.error(`Failed to upload "${file.name}": ${error.message}`);
        } finally {
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
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const removeFile = async (index: number) => {
    const fileToRemove = uploadedFiles[index];
    if (!fileToRemove) return;
    
    if (fileToRemove.uploading) {
      toast.error('Cannot remove file while uploading');
      return;
    }
    
    try {
      if (fileToRemove.url) {
        await FileUploadService.deleteFile(fileToRemove.url);
      }
      setUploadedFiles(prev => prev.filter((_, i) => i !== index));
      toast.success('File removed successfully');
    } catch (error: any) {
      console.error('Failed to remove file:', error);
      toast.error('Failed to remove file');
    }
  };
  
  const retryUpload = async (index: number) => {
    const file = uploadedFiles[index];
    if (!file || !file.error) return;
    
    // Remove the failed file and trigger re-upload
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    
    // Trigger file selection (user would need to select the file again)
    fileInputRef.current?.click();
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
    if (isTextResponse && !textResponse.trim()) {
      setError('Please provide a text response');
      toast.error('Text response is required');
      return;
    }
    
    const validFiles = uploadedFiles.filter(f => !f.uploading && !f.error);
    if (isFileUpload && validFiles.length === 0 && !isTextResponse) {
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
      const filesMetadata = validFiles.map(file => ({
        url: file.url,
        filename: file.originalName || file.pathname.split('/').pop(),
        size: file.size,
        contentType: file.contentType,
        uploadedAt: file.uploadedAt
      }));
      
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';
      const endpoint = isResubmitMode 
        ? `${API_BASE_URL}/uploads/assignments/${assignment.id}/resubmit-with-files`
        : `${API_BASE_URL}/uploads/assignments/${assignment.id}/submit-with-files`;

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
      
      const result: any = await response.json();
      
      if (!response.ok) {
        if (isResubmitMode && (result.error || '').toLowerCase().includes('already submitted')) {
          setResubmittedForCurrentRequest(true);
          setError('You have already submitted a response for this modification request. Wait for instructor review.');
          return;
        }
        throw new Error(result.error || 'Submission failed');
      }
      
      setSubmissionResult(result);
      if (isResubmitMode) {
        setResubmittedForCurrentRequest(true);
      }
      setSubmissionMode('submitted');
      
      onSubmit({
        text: textResponse || undefined,
        files: validFiles as any
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
    return FileUploadService.formatBytes(bytes);
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
                  {hasModificationRequest && (
                    <Badge variant="outline" className="bg-orange-50 backdrop-blur-sm border-orange-400 text-orange-700">
                      <AlertCircle className="h-3 w-3 mr-1 text-orange-600" />
                      Needs Revision
                    </Badge>
                  )}
                  {assignment.submission_status?.submitted && !assignment.submission_status?.status && !hasModificationRequest && (
                    <Badge variant="outline" className="bg-white/50 backdrop-blur-sm border-yellow-300">
                      <Clock className="h-3 w-3 mr-1 text-yellow-600" />
                      Pending Review
                    </Badge>
                  )}
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3">{assignment.title}</h3>
                {assignment.description && (
                  <div className="text-gray-700 dark:text-gray-300 text-sm sm:text-base">
                    <MarkdownRenderer content={assignment.description} />
                  </div>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {/* Assignment Details */}
            <div className="space-y-4">
              {assignment.instructions && (
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                  <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center">
                    <BookOpen className="h-5 w-5 mr-2" />
                    Instructions
                  </h4>
                  <div className="text-blue-800 dark:text-blue-200 text-sm">
                    <MarkdownRenderer content={assignment.instructions} />
                  </div>
                </div>
              )}

              {/* Assignment Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-900 dark:text-white">Assignment Details</h4>
                  <ul className="space-y-2 text-sm">
                    {assignment.points_possible && (
                      <li className="flex items-start gap-2">
                        <Award className="h-5 w-5 text-purple-500 flex-shrink-0 mt-0.5" />
                        <span>Points possible: <strong>{assignment.points_possible}</strong></span>
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
                          <span>Due: <strong>{new Date(assignment.due_date).toLocaleDateString()}</strong></span>
                          {isOverdue && (
                            <Badge variant="destructive" className="ml-2">Overdue</Badge>
                          )}
                          {isDueSoon && (
                            <Badge variant="outline" className="ml-2 border-yellow-500 text-yellow-700">Due Soon</Badge>
                          )}
                        </div>
                      </li>
                    )}
                  </ul>
                </div>

                {/* Submission Status */}
                {assignment.submission_status?.submitted && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-gray-900 dark:text-white">Your Submission</h4>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        <span className="font-medium text-green-600 dark:text-green-400">Submitted</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        Submitted on {new Date(assignment.submission_status.submitted_at!).toLocaleDateString()}
                      </p>
                      {assignment.submission_status.status === 'graded' && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Award className="h-4 w-4 text-yellow-500" />
                            <span className="text-sm font-medium">
                              Grade: {assignment.submission_status.grade}/{assignment.points_possible}
                            </span>
                          </div>
                          {assignment.submission_status.feedback && (
                            <div className="bg-white dark:bg-gray-900 p-3 rounded border">
                              <h5 className="font-medium mb-1 text-xs uppercase tracking-wide text-gray-500">
                                Instructor Feedback
                              </h5>
                              <p className="text-sm">{assignment.submission_status.feedback}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Modification Requested Banner */}
              {hasModificationRequest && isSubmitted && (
                <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 rounded-2xl p-1 shadow-lg">
                  <div className="bg-gray-900 rounded-xl p-4 sm:p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-orange-400" />
                        <h4 className="text-lg font-bold text-orange-300">Modification Requested</h4>
                      </div>
                      {assignment.modification_request_at && (
                        <span className="text-xs text-orange-400 hidden sm:block">
                          {new Date(assignment.modification_request_at).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-300 text-sm mb-3">
                      Your instructor has requested modifications to your assignment. Please review the feedback below and resubmit.
                    </p>
                    {assignment.modification_request_reason && (
                      <div className="bg-gray-800/70 rounded-lg p-4 border border-orange-800/50">
                        <MarkdownRenderer content={assignment.modification_request_reason} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                {!isSubmitted ? (
                  <Button 
                    onClick={() => setSubmissionMode('submit')}
                    className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
                    disabled={isOverdue}
                  >
                    <Send className="h-5 w-5 mr-2" />
                    {isOverdue ? 'Assignment Overdue' : 'Start Assignment'}
                  </Button>
                ) : (
                  <>
                    <div className="text-center">
                      <p className="text-green-600 dark:text-green-400 font-medium mb-2">
                        ✓ Assignment Submitted
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {hasModificationRequest
                          ? 'Revision requested — please resubmit'
                          : assignment.submission_status?.status === 'graded' 
                            ? 'Your assignment has been graded' 
                            : 'Your assignment is being reviewed'}
                      </p>
                    </div>
                    {canResubmit && (
                      <Button
                        onClick={() => setSubmissionMode('resubmit')}
                        className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 hover:from-orange-600 hover:via-red-600 hover:to-pink-600 text-white px-8 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
                      >
                        <Edit className="h-5 w-5 mr-2" />
                        Resubmit Assignment
                        <Badge className="ml-2 bg-white/20 text-white text-xs">Required</Badge>
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Submit / Resubmit Mode
  if (submissionMode === 'submit' || submissionMode === 'resubmit') {
    return (
      <div className="space-y-6">
        <Card className={`border-2 shadow-xl ${isResubmitMode ? 'border-orange-200' : 'border-blue-200'}`}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                  <Edit className="h-5 w-5 mr-2" />
                  {isResubmitMode ? 'Resubmit Assignment' : 'Submit Assignment'}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">{assignment.title}</p>
              </div>
              <Button
                variant="outline"
                onClick={() => setSubmissionMode('view')}
                className="shrink-0"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{isResubmitMode ? 'Resubmission Error' : 'Error'}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Modification Request Notice for Resubmit Mode */}
            {isResubmitMode && hasModificationRequest && (
              <Alert className="border-orange-300 bg-orange-50 dark:bg-orange-950/20">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <AlertTitle className="text-orange-800 dark:text-orange-300">Resubmitting Assignment</AlertTitle>
                <AlertDescription className="text-orange-700 dark:text-orange-400">
                  {assignment.modification_request_reason || 'Your instructor has requested modifications. Please update and resubmit your work.'}
                </AlertDescription>
              </Alert>
            )}

            {/* Text Response */}
            {isTextResponse && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-5 sm:p-6 border-2 border-gray-200 dark:border-gray-700 shadow-sm">
                <label className="block text-base font-bold text-gray-900 dark:text-white mb-3 flex items-center">
                  <div className="p-1.5 bg-blue-100 dark:bg-blue-900 rounded-lg mr-2">
                    <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  Text Response {!isFileUpload && <span className="text-red-500 ml-1">*</span>}
                </label>
                <textarea
                  value={textResponse}
                  onChange={(e) => setTextResponse(e.target.value)}
                  placeholder="Enter your response here..."
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none transition-all"
                  rows={8}
                  required={!isFileUpload}
                />
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Supports Markdown formatting
                  </span>
                  <span className="text-gray-600 dark:text-gray-400 font-medium">
                    {textResponse.split(/\\s+/).filter(w => w.length > 0).length} words
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
                
                {/* File Upload Area */}
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-green-400 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-950/20 transition-all cursor-pointer">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={allowedFileTypes.join(',')}
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                    disabled={uploading}
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer"
                  >
                    <div className="p-4 bg-green-100 dark:bg-green-900 rounded-full w-fit mx-auto mb-4">
                      <Upload className="h-10 w-10 text-green-600 dark:text-green-400" />
                    </div>
                    <p className="text-gray-900 dark:text-white font-bold text-base mb-1">
                      {uploading ? 'Uploading...' : 'Click to upload or drag and drop'}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                      {allowedFileTypes.includes('*') 
                        ? 'Any file type allowed' 
                        : `Allowed: ${allowedFileTypes.join(', ')}`}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Maximum {maxFileSizeMB}MB per file
                    </p>
                  </label>
                </div>

                {/* Uploaded Files List */}
                {uploadedFiles.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                      <Paperclip className="h-4 w-4 mr-2" />
                      Uploaded Files ({uploadedFiles.length})
                    </h4>
                    <div className="space-y-3">
                      {uploadedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border">
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <div className="flex-shrink-0 text-blue-600 dark:text-blue-400">
                              {file.uploading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                              ) : file.error ? (
                                <AlertCircle className="h-5 w-5 text-red-500" />
                              ) : (
                                getFileIcon(file.originalName || file.pathname)
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {file.originalName || file.pathname.split('/').pop()}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {formatFileSize(file.size)}
                                </p>
                                {file.uploading && file.progress !== undefined && (
                                  <div className="flex-1 max-w-24">
                                    <Progress value={file.progress} className="h-1" />
                                  </div>
                                )}
                                {file.error && (
                                  <p className="text-xs text-red-500">Upload failed</p>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {file.url && FileUploadService.canPreviewFile(file.originalName || file.pathname) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(file.url, '_blank')}
                                className="h-8 w-8 p-0"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                            {file.url && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const link = document.createElement('a');
                                  link.href = FileUploadService.getDownloadUrl(file.url, file.originalName || file.pathname.split('/').pop() || 'file');
                                  link.download = file.originalName || file.pathname.split('/').pop() || 'file';
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                }}
                                className="h-8 w-8 p-0"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                            {file.error && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => retryUpload(index)}
                                className="h-8 px-2 text-xs"
                              >
                                Retry
                              </Button>
                            )}
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => removeFile(index)}
                              className="h-8 w-8 p-0"
                              disabled={file.uploading}
                            >
                              {file.uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="outline"
                onClick={() => setSubmissionMode('view')}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || uploading}
                className={isResubmitMode
                  ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-6'
                  : 'bg-green-600 hover:bg-green-700 text-white px-6'
                }
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isResubmitMode ? 'Resubmitting...' : 'Submitting...'}
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
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

  // Submitted Mode
  return (
    <div className="space-y-6">
      <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 shadow-xl">
        <CardContent className="pt-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-2xl font-bold text-green-900 dark:text-green-100 mb-2">
              Assignment Submitted Successfully!
            </h3>
            <p className="text-green-700 dark:text-green-300 mb-6">
              {submissionResult?.message || 'Your assignment has been submitted and is now under review.'}
            </p>
            
            {submissionResult?.submission && (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-6 text-left">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Submission Details</h4>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <p>Submitted: {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
                  <p>Files: {submissionResult.submission.files_count || 0}</p>
                  <p>Text Response: {submissionResult.submission.has_text ? 'Yes' : 'No'}</p>
                </div>
              </div>
            )}
            
            <Button
              onClick={() => setSubmissionMode('view')}
              variant="outline"
              className="border-green-300 text-green-700 hover:bg-green-50 dark:border-green-600 dark:text-green-300 dark:hover:bg-green-900/20"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Assignment
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EnhancedAssignmentPanel;