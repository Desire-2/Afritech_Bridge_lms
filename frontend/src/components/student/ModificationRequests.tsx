// Student Modification Requests and Resubmission Interface

"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  AlertTriangle,
  Clock,
  FileText,
  RotateCcw,
  CheckCircle,
  XCircle,
  Eye,
  Send,
  Upload,
  X,
  Paperclip,
  Loader2,
  File,
  Image,
  Video,
  Music,
  Archive
} from 'lucide-react';
import FileUploadService, { UploadedFile, FileUploadProgress, StagedFile } from '@/services/file-upload.service';
import { toast } from 'sonner';

interface ModificationRequest {
  id: number;
  title: string;
  description: string;
  course_title: string;
  lesson_title: string;
  modification_reason: string;
  requested_at: string;
  resubmissions_remaining: number;
  type: 'assignment' | 'project';
  // Assignment-specific fields for file handling
  assignment_type?: string; // 'file_upload', 'text_response', 'both'
  max_file_size_mb?: number;
  allowed_file_types?: string;
  due_date?: string;
}

interface ResubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: ModificationRequest;
  onSuccess: () => void;
}

const ResubmissionModal: React.FC<ResubmissionModalProps> = ({
  isOpen,
  onClose,
  request,
  onSuccess
}) => {
  const { token } = useAuth();
  const [submissionText, setSubmissionText] = useState('');
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: FileUploadProgress }>({});
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [resubmissionNotes, setResubmissionNotes] = useState('');

  // Assignment type handling
  const isFileUpload = request.assignment_type === 'file_upload' || request.assignment_type === 'both';
  const isTextResponse = request.assignment_type === 'text_response' || request.assignment_type === 'both';
  
  // File handling
  const allowedFileTypes = request.allowed_file_types 
    ? request.allowed_file_types.split(',').map(t => t.trim()) 
    : ['*'];
  
  const maxFileSizeMB = request.max_file_size_mb || 10;
  const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;

  // Cleanup staged files on unmount
  React.useEffect(() => {
    return () => {
      if (typeof FileUploadService.cleanupStagedFiles === 'function') {
        FileUploadService.cleanupStagedFiles(stagedFiles);
      } else {
        stagedFiles.forEach(stagedFile => {
          if (stagedFile.preview && stagedFile.preview.startsWith('blob:')) {
            URL.revokeObjectURL(stagedFile.preview);
          }
        });
      }
    };
  }, []);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    if (files.length === 0) return;
    
    setError(null);
    setValidationErrors([]);
    
    try {
      if (typeof FileUploadService.stageFiles !== 'function') {
        throw new Error('File staging not available. Please refresh the page.');
      }
      
      const allowedMimeTypes = allowedFileTypes.includes('*') 
        ? undefined 
        : allowedFileTypes.map(ext => FileUploadService.getContentType('file' + ext));
      
      const newStagedFiles = FileUploadService.stageFiles(files, {
        allowedTypes: allowedMimeTypes,
        maxFileSize: maxFileSizeBytes,
        maxFiles: 10
      });
      
      setStagedFiles(prev => [...prev, ...newStagedFiles]);
      
      const invalidFiles = newStagedFiles.filter(sf => !sf.validationResult?.isValid);
      if (invalidFiles.length > 0) {
        const errors = invalidFiles.map(sf => 
          `${sf.file.name}: ${sf.validationResult?.reason || 'Validation failed'}`
        );
        setValidationErrors(errors);
        toast.error(`${invalidFiles.length} file(s) failed validation`);
      }
      
      const validFiles = newStagedFiles.filter(sf => sf.validationResult?.isValid);
      if (validFiles.length > 0) {
        toast.success(`${validFiles.length} file(s) staged for upload`);
      }
      
    } catch (error: any) {
      console.error('File staging error:', error);
      setError(error.message || 'Failed to stage files');
      toast.error('File staging failed');
    }
    
    // Reset file input
    event.target.value = '';
  };

  const handleRemoveFile = (index: number) => {
    const fileToRemove = stagedFiles[index];
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

  const formatFileSize = (bytes: number) => {
    return FileUploadService.formatFileSize(bytes);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (isTextResponse && !submissionText.trim()) {
      setError('Please provide a text response');
      toast.error('Text response is required');
      return;
    }
    
    const validStagedFiles = typeof FileUploadService.getValidStagedFiles === 'function'
      ? FileUploadService.getValidStagedFiles(stagedFiles)
      : stagedFiles.filter(sf => sf.validationResult?.isValid);
    
    if (isFileUpload && validStagedFiles.length === 0 && !isTextResponse) {
      setError('Please select at least one valid file');
      toast.error('File upload is required');
      return;
    }
    
    if (loading) {
      toast.error('Submission already in progress');
      return;
    }
    
    setLoading(true);
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
          assignmentId: request.id,
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
          throw new Error(`Failed to upload ${uploadResult.totalFailed} file(s):\\n${errorMessages.join('\\n')}`);
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
      
      // Use the enhanced resubmission endpoint
      const endpoint = `${API_BASE_URL}/uploads/assignments/${request.id}/resubmit-with-files`;
      
      // Call backend API with file metadata
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content: submissionText || undefined,
          files: filesMetadata,
          resubmission_notes: resubmissionNotes.trim() || undefined
        })
      });
      
      const result = await response.json();
      
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
        throw new Error(result.error || 'Resubmission failed');
      }
      
      // Clean up staged files after successful submission
      if (typeof FileUploadService.cleanupStagedFiles === 'function') {
        FileUploadService.cleanupStagedFiles(stagedFiles);
      }
      setStagedFiles([]);
      
      toast.success('Assignment Resubmitted!', {
        description: result.message || 'Your assignment has been resubmitted successfully'
      });
      
      onSuccess();
      onClose();
      
    } catch (error: any) {
      console.error('Resubmission error:', error);
      const errorMessage = error.message || 'Failed to resubmit assignment';
      setError(errorMessage);
      toast.error('Resubmission Failed', {
        description: errorMessage
      });
    } finally {
      setLoading(false);
      setUploadProgress({});
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              Resubmit Assignment
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {request.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* Instructor Feedback */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 mb-6">
            <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2 flex items-center">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Instructor Feedback
            </h4>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              {request.modification_reason}
            </p>
          </div>

          {/* Assignment Type Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-6">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                  Assignment Details
                </h4>
                <div className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
                  <p><strong>Type:</strong> {request.assignment_type || 'Not specified'}</p>
                  {request.max_file_size_mb && (
                    <p><strong>Max file size:</strong> {request.max_file_size_mb}MB</p>
                  )}
                  {request.allowed_file_types && request.allowed_file_types !== '*' && (
                    <p><strong>Allowed file types:</strong> {request.allowed_file_types}</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>Resubmissions remaining:</strong> {request.resubmissions_remaining}
                </p>
              </div>
            </div>
          </div>

          {/* Text Response Section */}
          {isTextResponse && (
            <div className="mb-6">
              <label htmlFor="submission_text" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Updated Submission {isTextResponse && !isFileUpload && <span className="text-red-500">*</span>}
              </label>
              <textarea
                id="submission_text"
                value={submissionText}
                onChange={(e) => setSubmissionText(e.target.value)}
                rows={8}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Please provide your updated submission addressing the instructor's feedback..."
                required={isTextResponse && !isFileUpload}
              />
            </div>
          )}

          {/* File Upload Section */}
          {isFileUpload && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                File Upload {isFileUpload && !isTextResponse && <span className="text-red-500">*</span>}
              </label>
              
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-6 text-center hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
                <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                  Choose files to upload
                </p>
                <input
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                  accept={allowedFileTypes.includes('*') ? undefined : allowedFileTypes.map(ext => ext.startsWith('.') ? ext : '.' + ext).join(',')}
                />
                <label 
                  htmlFor="file-upload"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
                >
                  <Paperclip className="h-4 w-4 mr-2" />
                  Select Files
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Max size: {maxFileSizeMB}MB per file
                  {!allowedFileTypes.includes('*') && (
                    <span className="block">Allowed types: {allowedFileTypes.join(', ')}</span>
                  )}
                </p>
              </div>

              {/* Staged Files Display */}
              {stagedFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Files to Upload ({stagedFiles.length})
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {stagedFiles.map((stagedFile, index) => {
                      const { file, validationResult, preview } = stagedFile;
                      const isValid = validationResult?.isValid;
                      const progressInfo = uploadProgress[stagedFile.id];
                      
                      return (
                        <div
                          key={stagedFile.id}
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            isValid 
                              ? 'border-green-200 bg-green-50 dark:border-green-700 dark:bg-green-900/20'
                              : 'border-red-200 bg-red-50 dark:border-red-700 dark:bg-red-900/20'
                          }`}
                        >
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <div className="flex-shrink-0">
                              {getFileIcon(file.name)}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium truncate ${
                                isValid 
                                  ? 'text-green-700 dark:text-green-300' 
                                  : 'text-red-700 dark:text-red-300'
                              }`}>
                                {file.name}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {formatFileSize(file.size)}
                              </p>
                              {!isValid && validationResult?.reason && (
                                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                  {validationResult.reason}
                                </p>
                              )}
                            </div>

                            {/* Upload Progress */}
                            {progressInfo && (
                              <div className="flex-shrink-0 w-24">
                                <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                                  {progressInfo.percentage}%
                                </div>
                                <Progress value={progressInfo.percentage} className="h-1" />
                              </div>
                            )}
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(index)}
                            className="ml-3 p-1 text-slate-400 hover:text-red-500 transition-colors"
                            disabled={loading}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Validation Errors */}
              {validationErrors.length > 0 && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                  <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                    File Validation Errors:
                  </h4>
                  <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                    {validationErrors.map((error, index) => (
                      <li key={index} className="flex items-start">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mt-2 mr-2 flex-shrink-0"></span>
                        {error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Resubmission Notes */}
          <div className="mb-6">
            <label htmlFor="resubmission_notes" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Notes to Instructor (Optional)
            </label>
            <textarea
              id="resubmission_notes"
              value={resubmissionNotes}
              onChange={(e) => setResubmissionNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Any additional notes or explanations for your instructor..."
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (isTextResponse && !submissionText.trim() && stagedFiles.filter(sf => sf.validationResult?.isValid).length === 0) || (isFileUpload && !isTextResponse && stagedFiles.filter(sf => sf.validationResult?.isValid).length === 0)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4 mr-2" />
                  Resubmitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Resubmit Assignment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const StudentModificationRequests: React.FC = () => {
  const { token } = useAuth();
  const [modificationRequests, setModificationRequests] = useState<ModificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ModificationRequest | null>(null);
  const [showResubmissionModal, setShowResubmissionModal] = useState(false);

  useEffect(() => {
    fetchModificationRequests();
  }, []);

  const fetchModificationRequests = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/modification/student/modification-requests`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch modification requests');
      }

      const data = await response.json();
      setModificationRequests(data.data.modification_requests);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResubmissionSuccess = () => {
    fetchModificationRequests();
    setShowResubmissionModal(false);
    setSelectedRequest(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-blue-600"></div>
              <span className="text-slate-600 dark:text-slate-400">Loading modification requests...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Modification Requests
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Assignments and projects that require modifications based on instructor feedback
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {modificationRequests.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              No Modification Requests
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              You don't have any assignments requiring modifications at the moment.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {modificationRequests.map((request) => (
              <div
                key={`${request.type}-${request.id}`}
                className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                        <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                          {request.title}
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {request.course_title} • {request.lesson_title}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        request.type === 'assignment' 
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
                          : 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300'
                      }`}>
                        {request.type}
                      </span>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4 mb-4">
                      <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-2">
                        Instructor Feedback:
                      </h4>
                      <p className="text-sm text-slate-700 dark:text-slate-300">
                        {request.modification_reason}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          {formatDate(request.requested_at)}
                        </div>
                        <div className="flex items-center">
                          <RotateCcw className="h-4 w-4 mr-1" />
                          {request.resubmissions_remaining} resubmissions left
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => {
                        setSelectedRequest(request);
                        setShowResubmissionModal(true);
                      }}
                      disabled={request.resubmissions_remaining <= 0}
                      className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Resubmit
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Enhanced Resubmission Modal */}
        {selectedRequest && (
          <ResubmissionModal
            isOpen={showResubmissionModal}
            onClose={() => {
              setShowResubmissionModal(false);
              setSelectedRequest(null);
            }}
            request={selectedRequest}
            onSuccess={handleResubmissionSuccess}
          />
        )}
      </div>
    </div>
  );
};