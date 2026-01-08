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
  Trash2
} from 'lucide-react';
import { ContentAssignmentService } from '@/services/contentAssignmentApi';
import FileUploadService, { UploadedFile, FileUploadProgress, StagedFile } from '@/services/file-upload.service';
import { toast } from 'sonner';
import { MarkdownRenderer } from '@/components/content/MarkdownRenderer';

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
  const [submissionMode, setSubmissionMode] = useState<'view' | 'submit' | 'submitted'>('view');
  const [textResponse, setTextResponse] = useState('');
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: FileUploadProgress }>({});
  const [error, setError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<any>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  // Cleanup staged files on unmount
  React.useEffect(() => {
    return () => {
      FileUploadService.cleanupStagedFiles(stagedFiles);
    };
  }, []);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isFileUpload = assignment.assignment_type === 'file_upload' || assignment.assignment_type === 'both';
  const isTextResponse = assignment.assignment_type === 'text_response' || assignment.assignment_type === 'both';

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
    } finally {\n      setUploading(false);\n      if (event.target) {\n        event.target.value = '';\n      }\n    }\n  };\n\n  const removeFile = async (index: number) => {\n    const fileToRemove = uploadedFiles[index];\n    if (!fileToRemove) return;\n    \n    if (fileToRemove.uploading) {\n      toast.error('Cannot remove file while uploading');\n      return;\n    }\n    \n    try {\n      if (fileToRemove.url) {\n        await FileUploadService.deleteFile(fileToRemove.url);\n      }\n      setUploadedFiles(prev => prev.filter((_, i) => i !== index));\n      toast.success('File removed successfully');\n    } catch (error: any) {\n      console.error('Failed to remove file:', error);\n      toast.error('Failed to remove file');\n    }\n  };\n  \n  const retryUpload = async (index: number) => {\n    const file = uploadedFiles[index];\n    if (!file || !file.error) return;\n    \n    // Remove the failed file and trigger re-upload\n    setUploadedFiles(prev => prev.filter((_, i) => i !== index));\n    \n    // Trigger file selection (user would need to select the file again)\n    fileInputRef.current?.click();\n  };\n  \n  const getFileIcon = (filename: string) => {\n    const ext = FileUploadService.getFileExtension(filename).toLowerCase();\n    \n    if (FileUploadService.isImageFile(filename)) {\n      return <Image className=\"h-4 w-4\" />;\n    } else if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) {\n      return <Video className=\"h-4 w-4\" />;\n    } else if (['mp3', 'wav', 'ogg'].includes(ext)) {\n      return <Music className=\"h-4 w-4\" />;\n    } else if (['zip', 'tar', 'gz', 'rar'].includes(ext)) {\n      return <Archive className=\"h-4 w-4\" />;\n    } else {\n      return <File className=\"h-4 w-4\" />;\n    }\n  };\n\n  const handleSubmit = async () => {\n    if (isTextResponse && !textResponse.trim()) {\n      setError('Please provide a text response');\n      toast.error('Text response is required');\n      return;\n    }\n    \n    const validFiles = uploadedFiles.filter(f => !f.uploading && !f.error);\n    if (isFileUpload && validFiles.length === 0 && !isTextResponse) {\n      setError('Please upload at least one file');\n      toast.error('File upload is required');\n      return;\n    }\n    \n    if (uploading) {\n      toast.error('Please wait for file uploads to complete');\n      return;\n    }\n    \n    setSubmitting(true);\n    setError(null);\n    \n    try {\n      const filesMetadata = validFiles.map(file => ({\n        url: file.url,\n        filename: file.originalName || file.pathname.split('/').pop(),\n        size: file.size,\n        contentType: file.contentType,\n        uploadedAt: file.uploadedAt\n      }));\n      \n      const response = await fetch(`/api/v1/uploads/assignments/${assignment.id}/submit-with-files`, {\n        method: 'POST',\n        headers: {\n          'Content-Type': 'application/json',\n          'Authorization': `Bearer ${localStorage.getItem('token')}`\n        },\n        body: JSON.stringify({\n          content: textResponse || undefined,\n          files: filesMetadata,\n          external_url: undefined\n        })\n      });\n      \n      const result = await response.json();\n      \n      if (!response.ok) {\n        throw new Error(result.error || 'Submission failed');\n      }\n      \n      setSubmissionResult(result);\n      setSubmissionMode('submitted');\n      \n      onSubmit({\n        text: textResponse || undefined,\n        files: validFiles as any\n      });\n      \n      if (onSubmitComplete) {\n        onSubmitComplete();\n      }\n\n      toast.success('Assignment Submitted!', {\n        description: result.message || 'Your assignment has been submitted successfully'\n      });\n      \n    } catch (error: any) {\n      console.error('Submission error:', error);\n      const errorMessage = error.message || 'Failed to submit assignment';\n      setError(errorMessage);\n      toast.error('Submission Failed', {\n        description: errorMessage\n      });\n    } finally {\n      setSubmitting(false);\n    }\n  };\n\n  const formatFileSize = (bytes: number) => {\n    return FileUploadService.formatBytes(bytes);\n  };\n\n  const getDaysUntilDue = () => {\n    if (!assignment.due_date) return null;\n    const dueDate = new Date(assignment.due_date);\n    const now = new Date();\n    const diffTime = dueDate.getTime() - now.getTime();\n    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));\n    return diffDays;\n  };\n\n  const daysUntilDue = getDaysUntilDue();\n  const isOverdue = daysUntilDue !== null && daysUntilDue < 0;\n  const isDueSoon = daysUntilDue !== null && daysUntilDue <= 3 && daysUntilDue >= 0;\n\n  // View Mode\n  if (submissionMode === 'view') {\n    return (\n      <div className=\"space-y-6\">\n        <Card className=\"border-2 border-green-200 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-green-950 dark:via-emerald-950 dark:to-teal-950 shadow-xl\">\n          <CardHeader className=\"pb-4\">\n            <div className=\"flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4\">\n              <div className=\"flex-1\">\n                <div className=\"flex items-center gap-2 mb-2\">\n                  <Badge className=\"bg-green-600 hover:bg-green-700 text-white shadow-md\">\n                    <FileText className=\"h-3 w-3 mr-1\" />\n                    Assignment\n                  </Badge>\n                  {assignment.submission_status?.status === 'graded' && (\n                    <Badge variant=\"outline\" className=\"bg-white/50 backdrop-blur-sm border-green-300\">\n                      <Award className=\"h-3 w-3 mr-1 text-green-600\" />\n                      Graded\n                    </Badge>\n                  )}\n                  {assignment.submission_status?.submitted && !assignment.submission_status?.status && (\n                    <Badge variant=\"outline\" className=\"bg-white/50 backdrop-blur-sm border-yellow-300\">\n                      <Clock className=\"h-3 w-3 mr-1 text-yellow-600\" />\n                      Pending Review\n                    </Badge>\n                  )}\n                </div>\n                <h3 className=\"text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3\">{assignment.title}</h3>\n                {assignment.description && (\n                  <div className=\"text-gray-700 dark:text-gray-300 text-sm sm:text-base\">\n                    <MarkdownRenderer content={assignment.description} />\n                  </div>\n                )}\n              </div>\n            </div>\n          </CardHeader>\n\n          <CardContent>\n            {/* Assignment Details */}\n            <div className=\"space-y-4\">\n              {assignment.instructions && (\n                <div className=\"bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4\">\n                  <h4 className=\"text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center\">\n                    <BookOpen className=\"h-5 w-5 mr-2\" />\n                    Instructions\n                  </h4>\n                  <div className=\"text-blue-800 dark:text-blue-200 text-sm\">\n                    <MarkdownRenderer content={assignment.instructions} />\n                  </div>\n                </div>\n              )}\n\n              {/* Assignment Info */}\n              <div className=\"grid grid-cols-1 md:grid-cols-2 gap-4\">\n                <div className=\"space-y-3\">\n                  <h4 className=\"font-semibold text-gray-900 dark:text-white\">Assignment Details</h4>\n                  <ul className=\"space-y-2 text-sm\">\n                    {assignment.points_possible && (\n                      <li className=\"flex items-start gap-2\">\n                        <Award className=\"h-5 w-5 text-purple-500 flex-shrink-0 mt-0.5\" />\n                        <span>Points possible: <strong>{assignment.points_possible}</strong></span>\n                      </li>\n                    )}\n                    {isFileUpload && (\n                      <>\n                        <li className=\"flex items-start gap-2\">\n                          <Upload className=\"h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5\" />\n                          <span>Upload files: <strong>{allowedFileTypes.join(', ')}</strong></span>\n                        </li>\n                        <li className=\"flex items-start gap-2\">\n                          <AlertCircle className=\"h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5\" />\n                          <span>Maximum file size: <strong>{maxFileSizeMB}MB</strong> per file</span>\n                        </li>\n                      </>\n                    )}\n                    {assignment.due_date && (\n                      <li className=\"flex items-start gap-2\">\n                        <Clock className={`h-5 w-5 flex-shrink-0 mt-0.5 ${\n                          isOverdue ? 'text-red-500' : isDueSoon ? 'text-yellow-500' : 'text-purple-500'\n                        }`} />\n                        <div>\n                          <span>Due: <strong>{new Date(assignment.due_date).toLocaleDateString()}</strong></span>\n                          {isOverdue && (\n                            <Badge variant=\"destructive\" className=\"ml-2\">Overdue</Badge>\n                          )}\n                          {isDueSoon && (\n                            <Badge variant=\"outline\" className=\"ml-2 border-yellow-500 text-yellow-700\">Due Soon</Badge>\n                          )}\n                        </div>\n                      </li>\n                    )}\n                  </ul>\n                </div>\n\n                {/* Submission Status */}\n                {assignment.submission_status?.submitted && (\n                  <div className=\"space-y-3\">\n                    <h4 className=\"font-semibold text-gray-900 dark:text-white\">Your Submission</h4>\n                    <div className=\"bg-gray-50 dark:bg-gray-800 rounded-lg p-4\">\n                      <div className=\"flex items-center gap-2 mb-2\">\n                        <CheckCircle2 className=\"h-5 w-5 text-green-500\" />\n                        <span className=\"font-medium text-green-600 dark:text-green-400\">Submitted</span>\n                      </div>\n                      <p className=\"text-sm text-gray-600 dark:text-gray-400 mb-2\">\n                        Submitted on {new Date(assignment.submission_status.submitted_at!).toLocaleDateString()}\n                      </p>\n                      {assignment.submission_status.status === 'graded' && (\n                        <div className=\"space-y-2\">\n                          <div className=\"flex items-center gap-2\">\n                            <Award className=\"h-4 w-4 text-yellow-500\" />\n                            <span className=\"text-sm font-medium\">\n                              Grade: {assignment.submission_status.grade}/{assignment.points_possible}\n                            </span>\n                          </div>\n                          {assignment.submission_status.feedback && (\n                            <div className=\"bg-white dark:bg-gray-900 p-3 rounded border\">\n                              <h5 className=\"font-medium mb-1 text-xs uppercase tracking-wide text-gray-500\">\n                                Instructor Feedback\n                              </h5>\n                              <p className=\"text-sm\">{assignment.submission_status.feedback}</p>\n                            </div>\n                          )}\n                        </div>\n                      )}\n                    </div>\n                  </div>\n                )}\n              </div>\n\n              {/* Action Button */}\n              <div className=\"flex justify-center pt-4\">\n                {!assignment.submission_status?.submitted ? (\n                  <Button \n                    onClick={() => setSubmissionMode('submit')}\n                    className=\"bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all transform hover:scale-105\"\n                    disabled={isOverdue}\n                  >\n                    <Send className=\"h-5 w-5 mr-2\" />\n                    {isOverdue ? 'Assignment Overdue' : 'Start Assignment'}\n                  </Button>\n                ) : (\n                  <div className=\"text-center\">\n                    <p className=\"text-green-600 dark:text-green-400 font-medium mb-2\">\n                      ✓ Assignment Submitted Successfully\n                    </p>\n                    <p className=\"text-sm text-gray-600 dark:text-gray-400\">\n                      {assignment.submission_status.status === 'graded' \n                        ? 'Your assignment has been graded' \n                        : 'Your assignment is being reviewed'}\n                    </p>\n                  </div>\n                )}\n              </div>\n            </div>\n          </CardContent>\n        </Card>\n      </div>\n    );\n  }\n\n  // Submit Mode\n  if (submissionMode === 'submit') {\n    return (\n      <div className=\"space-y-6\">\n        <Card className=\"border-2 border-blue-200 shadow-xl\">\n          <CardHeader>\n            <div className=\"flex items-center justify-between\">\n              <div>\n                <h3 className=\"text-xl font-bold text-gray-900 dark:text-white flex items-center\">\n                  <Edit className=\"h-5 w-5 mr-2\" />\n                  Submit Assignment\n                </h3>\n                <p className=\"text-gray-600 dark:text-gray-400 text-sm mt-1\">{assignment.title}</p>\n              </div>\n              <Button\n                variant=\"outline\"\n                onClick={() => setSubmissionMode('view')}\n                className=\"shrink-0\"\n              >\n                <ArrowLeft className=\"h-4 w-4 mr-2\" />\n                Back\n              </Button>\n            </div>\n          </CardHeader>\n\n          <CardContent className=\"space-y-6\">\n            {error && (\n              <Alert variant=\"destructive\">\n                <AlertCircle className=\"h-4 w-4\" />\n                <AlertTitle>Error</AlertTitle>\n                <AlertDescription>{error}</AlertDescription>\n              </Alert>\n            )}\n\n            {/* Text Response */}\n            {isTextResponse && (\n              <div className=\"bg-white dark:bg-gray-800 rounded-xl p-5 sm:p-6 border-2 border-gray-200 dark:border-gray-700 shadow-sm\">\n                <label className=\"block text-base font-bold text-gray-900 dark:text-white mb-3 flex items-center\">\n                  <div className=\"p-1.5 bg-blue-100 dark:bg-blue-900 rounded-lg mr-2\">\n                    <MessageSquare className=\"h-4 w-4 text-blue-600 dark:text-blue-400\" />\n                  </div>\n                  Text Response {!isFileUpload && <span className=\"text-red-500 ml-1\">*</span>}\n                </label>\n                <textarea\n                  value={textResponse}\n                  onChange={(e) => setTextResponse(e.target.value)}\n                  placeholder=\"Enter your response here...\"\n                  className=\"w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none transition-all\"\n                  rows={8}\n                  required={!isFileUpload}\n                />\n                <div className=\"flex justify-between items-center mt-2\">\n                  <span className=\"text-xs text-gray-500 dark:text-gray-400\">\n                    Supports Markdown formatting\n                  </span>\n                  <span className=\"text-gray-600 dark:text-gray-400 font-medium\">\n                    {textResponse.split(/\\s+/).filter(w => w.length > 0).length} words\n                  </span>\n                </div>\n              </div>\n            )}\n\n            {/* File Upload */}\n            {isFileUpload && (\n              <div className=\"bg-white dark:bg-gray-800 rounded-xl p-5 sm:p-6 border-2 border-gray-200 dark:border-gray-700 shadow-sm\">\n                <label className=\"block text-base font-bold text-gray-900 dark:text-white mb-3 flex items-center\">\n                  <div className=\"p-1.5 bg-blue-100 dark:bg-blue-900 rounded-lg mr-2\">\n                    <Upload className=\"h-4 w-4 text-blue-600 dark:text-blue-400\" />\n                  </div>\n                  Upload Files {!isTextResponse && <span className=\"text-red-500 ml-1\">*</span>}\n                </label>\n                \n                {/* File Upload Area */}\n                <div className=\"border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-green-400 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-950/20 transition-all cursor-pointer\">\n                  <input\n                    ref={fileInputRef}\n                    type=\"file\"\n                    multiple\n                    accept={allowedFileTypes.join(',')}\n                    onChange={handleFileSelect}\n                    className=\"hidden\"\n                    id=\"file-upload\"\n                    disabled={uploading}\n                  />\n                  <label\n                    htmlFor=\"file-upload\"\n                    className=\"cursor-pointer\"\n                  >\n                    <div className=\"p-4 bg-green-100 dark:bg-green-900 rounded-full w-fit mx-auto mb-4\">\n                      <Upload className=\"h-10 w-10 text-green-600 dark:text-green-400\" />\n                    </div>\n                    <p className=\"text-gray-900 dark:text-white font-bold text-base mb-1\">\n                      {uploading ? 'Uploading...' : 'Click to upload or drag and drop'}\n                    </p>\n                    <p className=\"text-sm text-gray-600 dark:text-gray-400 mt-2\">\n                      {allowedFileTypes.includes('*') \n                        ? 'Any file type allowed' \n                        : `Allowed: ${allowedFileTypes.join(', ')}`}\n                    </p>\n                    <p className=\"text-xs text-gray-500 dark:text-gray-500 mt-1\">\n                      Maximum {maxFileSizeMB}MB per file\n                    </p>\n                  </label>\n                </div>\n\n                {/* Uploaded Files List */}\n                {uploadedFiles.length > 0 && (\n                  <div className=\"mt-6\">\n                    <h4 className=\"font-medium text-gray-900 dark:text-white mb-3 flex items-center\">\n                      <Paperclip className=\"h-4 w-4 mr-2\" />\n                      Uploaded Files ({uploadedFiles.length})\n                    </h4>\n                    <div className=\"space-y-3\">\n                      {uploadedFiles.map((file, index) => (\n                        <div key={index} className=\"flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border\">\n                          <div className=\"flex items-center space-x-3 flex-1 min-w-0\">\n                            <div className=\"flex-shrink-0 text-blue-600 dark:text-blue-400\">\n                              {file.uploading ? (\n                                <Loader2 className=\"h-5 w-5 animate-spin\" />\n                              ) : file.error ? (\n                                <AlertCircle className=\"h-5 w-5 text-red-500\" />\n                              ) : (\n                                getFileIcon(file.originalName || file.pathname)\n                              )}\n                            </div>\n                            <div className=\"flex-1 min-w-0\">\n                              <p className=\"text-sm font-medium text-gray-900 dark:text-white truncate\">\n                                {file.originalName || file.pathname.split('/').pop()}\n                              </p>\n                              <div className=\"flex items-center gap-2 mt-1\">\n                                <p className=\"text-xs text-gray-500 dark:text-gray-400\">\n                                  {formatFileSize(file.size)}\n                                </p>\n                                {file.uploading && file.progress !== undefined && (\n                                  <div className=\"flex-1 max-w-24\">\n                                    <Progress value={file.progress} className=\"h-1\" />\n                                  </div>\n                                )}\n                                {file.error && (\n                                  <p className=\"text-xs text-red-500\">Upload failed</p>\n                                )}\n                              </div>\n                            </div>\n                          </div>\n                          <div className=\"flex items-center space-x-2\">\n                            {file.url && FileUploadService.canPreviewFile(file.originalName || file.pathname) && (\n                              <Button\n                                variant=\"outline\"\n                                size=\"sm\"\n                                onClick={() => window.open(file.url, '_blank')}\n                                className=\"h-8 w-8 p-0\"\n                              >\n                                <Eye className=\"h-4 w-4\" />\n                              </Button>\n                            )}\n                            {file.url && (\n                              <Button\n                                variant=\"outline\"\n                                size=\"sm\"\n                                onClick={() => {\n                                  const link = document.createElement('a');\n                                  link.href = FileUploadService.getDownloadUrl(file.url, file.originalName || file.pathname.split('/').pop() || 'file');\n                                  link.download = file.originalName || file.pathname.split('/').pop() || 'file';\n                                  document.body.appendChild(link);\n                                  link.click();\n                                  document.body.removeChild(link);\n                                }}\n                                className=\"h-8 w-8 p-0\"\n                              >\n                                <Download className=\"h-4 w-4\" />\n                              </Button>\n                            )}\n                            {file.error && (\n                              <Button\n                                variant=\"outline\"\n                                size=\"sm\"\n                                onClick={() => retryUpload(index)}\n                                className=\"h-8 px-2 text-xs\"\n                              >\n                                Retry\n                              </Button>\n                            )}\n                            <Button\n                              variant=\"destructive\"\n                              size=\"sm\"\n                              onClick={() => removeFile(index)}\n                              className=\"h-8 w-8 p-0\"\n                              disabled={file.uploading}\n                            >\n                              {file.uploading ? <Loader2 className=\"h-4 w-4 animate-spin\" /> : <Trash2 className=\"h-4 w-4\" />}\n                            </Button>\n                          </div>\n                        </div>\n                      ))}\n                    </div>\n                  </div>\n                )}\n              </div>\n            )}\n\n            {/* Submit Button */}\n            <div className=\"flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700\">\n              <Button\n                variant=\"outline\"\n                onClick={() => setSubmissionMode('view')}\n                disabled={submitting}\n              >\n                Cancel\n              </Button>\n              <Button\n                onClick={handleSubmit}\n                disabled={submitting || uploading}\n                className=\"bg-green-600 hover:bg-green-700 text-white px-6\"\n              >\n                {submitting ? (\n                  <>\n                    <Loader2 className=\"h-4 w-4 mr-2 animate-spin\" />\n                    Submitting...\n                  </>\n                ) : (\n                  <>\n                    <Send className=\"h-4 w-4 mr-2\" />\n                    Submit Assignment\n                  </>\n                )}\n              </Button>\n            </div>\n          </CardContent>\n        </Card>\n      </div>\n    );\n  }\n\n  // Submitted Mode\n  return (\n    <div className=\"space-y-6\">\n      <Card className=\"border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 shadow-xl\">\n        <CardContent className=\"pt-8\">\n          <div className=\"text-center\">\n            <div className=\"w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4\">\n              <CheckCircle2 className=\"h-10 w-10 text-green-600 dark:text-green-400\" />\n            </div>\n            <h3 className=\"text-2xl font-bold text-green-900 dark:text-green-100 mb-2\">\n              Assignment Submitted Successfully!\n            </h3>\n            <p className=\"text-green-700 dark:text-green-300 mb-6\">\n              {submissionResult?.message || 'Your assignment has been submitted and is now under review.'}\n            </p>\n            \n            {submissionResult?.submission && (\n              <div className=\"bg-white dark:bg-gray-800 rounded-lg p-4 mb-6 text-left\">\n                <h4 className=\"font-medium text-gray-900 dark:text-white mb-2\">Submission Details</h4>\n                <div className=\"text-sm text-gray-600 dark:text-gray-400 space-y-1\">\n                  <p>Submitted: {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>\n                  <p>Files: {submissionResult.submission.files_count || 0}</p>\n                  <p>Text Response: {submissionResult.submission.has_text ? 'Yes' : 'No'}</p>\n                </div>\n              </div>\n            )}\n            \n            <Button\n              onClick={() => setSubmissionMode('view')}\n              variant=\"outline\"\n              className=\"border-green-300 text-green-700 hover:bg-green-50 dark:border-green-600 dark:text-green-300 dark:hover:bg-green-900/20\"\n            >\n              <ArrowLeft className=\"h-4 w-4 mr-2\" />\n              Back to Assignment\n            </Button>\n          </div>\n        </CardContent>\n      </Card>\n    </div>\n  );\n};\n\nexport default EnhancedAssignmentPanel;