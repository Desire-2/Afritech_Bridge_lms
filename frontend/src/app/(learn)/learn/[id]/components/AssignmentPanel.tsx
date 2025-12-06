import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  Loader2
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
  const [submissionMode, setSubmissionMode] = useState<'view' | 'submit' | 'submitted'>('view');
  const [textResponse, setTextResponse] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<any>(null);

  const isFileUpload = assignment.assignment_type === 'file_upload' || assignment.assignment_type === 'both';
  const isTextResponse = assignment.assignment_type === 'text_response' || assignment.assignment_type === 'both';

  const allowedFileTypes = assignment.allowed_file_types 
    ? assignment.allowed_file_types.split(',').map(t => t.trim()) 
    : ['*'];
  
  const maxFileSizeMB = assignment.max_file_size_mb || 10;
  const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    // Validate file types
    const invalidFiles = files.filter(file => {
      if (allowedFileTypes.includes('*')) return false;
      const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
      return !allowedFileTypes.some(type => type.toLowerCase() === fileExt);
    });
    
    if (invalidFiles.length > 0) {
      alert(`Invalid file types: ${invalidFiles.map(f => f.name).join(', ')}\nAllowed types: ${allowedFileTypes.join(', ')}`);
      return;
    }
    
    // Validate file sizes
    const oversizedFiles = files.filter(file => file.size > maxFileSizeBytes);
    if (oversizedFiles.length > 0) {
      alert(`Files too large: ${oversizedFiles.map(f => f.name).join(', ')}\nMax size: ${maxFileSizeMB}MB`);
      return;
    }
    
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    // Validation
    if (isTextResponse && !textResponse.trim()) {
      setError('Please provide a text response');
      toast.error('Text response is required');
      return;
    }
    
    if (isFileUpload && selectedFiles.length === 0 && !isTextResponse) {
      setError('Please select at least one file');
      toast.error('File upload is required');
      return;
    }
    
    setSubmitting(true);
    setError(null);
    
    try {
      // Call backend API
      const result = await ContentAssignmentService.submitAssignment(assignment.id, {
        content: textResponse || undefined,
        // Note: File upload would need to be handled separately via a file upload endpoint
        // For now, we'll just send the text content
        external_url: selectedFiles.length > 0 ? `Files: ${selectedFiles.map(f => f.name).join(', ')}` : undefined
      });
      
      setSubmissionResult(result);
      setSubmissionMode('submitted');
      
      // Call parent callbacks
      onSubmit({
        text: textResponse || undefined,
        files: selectedFiles.length > 0 ? selectedFiles : undefined
      });
      
      if (onSubmitComplete) {
        onSubmitComplete();
      }

      toast.success('Assignment Submitted!', {
        description: result.message || 'Your assignment has been submitted successfully'
      });
      
    } catch (error: any) {
      console.error('Submission error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to submit assignment';
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
        <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{assignment.title}</h3>
                <p className="text-gray-600">{assignment.description}</p>
              </div>
              <Badge className="bg-green-600 text-white">
                <FileText className="h-4 w-4 mr-1" />
                Assignment
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent>
            {/* Assignment Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{assignment.points_possible}</div>
                <div className="text-sm text-gray-600">Points</div>
              </div>
              
              {assignment.due_date && (
                <div className={`bg-white rounded-lg p-4 text-center ${
                  isOverdue ? 'border-2 border-red-400' : isDueSoon ? 'border-2 border-yellow-400' : ''
                }`}>
                  <div className={`text-2xl font-bold ${
                    isOverdue ? 'text-red-600' : isDueSoon ? 'text-yellow-600' : 'text-blue-600'
                  }`}>
                    {isOverdue ? 'Overdue' : Math.abs(daysUntilDue!)} days
                  </div>
                  <div className="text-sm text-gray-600">
                    {isOverdue ? 'Past Due' : 'Until Due'}
                  </div>
                </div>
              )}
              
              <div className="bg-white rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-purple-600 capitalize">
                  {assignment.assignment_type.replace('_', ' ')}
                </div>
                <div className="text-sm text-gray-600">Type</div>
              </div>
            </div>

            {/* Instructions */}
            {assignment.instructions && (
              <div className="bg-white rounded-lg p-4 mb-6 border-l-4 border-green-500">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <FileText className="h-4 w-4 mr-2 text-green-600" />
                  Instructions:
                </h4>
                <div className="text-gray-700 text-sm whitespace-pre-wrap">
                  {assignment.instructions}
                </div>
              </div>
            )}

            {/* Submission Requirements */}
            <div className="bg-white rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                <AlertCircle className="h-4 w-4 mr-2 text-blue-600" />
                Submission Requirements:
              </h4>
              <ul className="list-disc list-inside space-y-2 text-gray-700 text-sm">
                {isTextResponse && (
                  <li>Provide a written response in the text editor</li>
                )}
                {isFileUpload && (
                  <>
                    <li>Upload files: {allowedFileTypes.join(', ')}</li>
                    <li>Maximum file size: {maxFileSizeMB}MB per file</li>
                  </>
                )}
                {assignment.due_date && (
                  <li>
                    Due date: {new Date(assignment.due_date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </li>
                )}
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              {assignment.submission_status?.status === 'graded' ? (
                <>
                  <Button 
                    onClick={() => setSubmissionMode('submitted')}
                    variant="default"
                    className="flex-1 py-6 text-lg bg-green-600 hover:bg-green-700"
                  >
                    <Award className="h-5 w-5 mr-2" />
                    View Grade & Feedback
                  </Button>
                  <Button 
                    variant="outline" 
                    className="sm:w-auto px-6 py-6"
                    onClick={() => window.open('/student/assessments', '_blank')}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    All Grades
                  </Button>
                </>
              ) : assignment.submission_status?.submitted ? (
                <>
                  <Button 
                    onClick={() => setSubmissionMode('submitted')}
                    variant="outline"
                    className="flex-1 py-6 text-lg"
                  >
                    <CheckCircle className="h-5 w-5 mr-2" />
                    View Submission
                  </Button>
                  <Button 
                    variant="outline" 
                    className="sm:w-auto px-6 py-6"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Resources
                  </Button>
                </>
              ) : isOverdue ? (
                <>
                  <Button 
                    variant="outline"
                    className="flex-1 py-6 text-lg"
                    disabled
                  >
                    <AlertCircle className="h-5 w-5 mr-2" />
                    Assignment Expired
                  </Button>
                  <Button 
                    variant="outline" 
                    className="sm:w-auto px-6 py-6"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Resources
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    onClick={() => setSubmissionMode('submit')}
                    className="flex-1 bg-green-600 hover:bg-green-700 py-6 text-lg"
                  >
                    <Edit className="h-5 w-5 mr-2" />
                    Start Assignment
                  </Button>
                  <Button 
                    variant="outline" 
                    className="sm:w-auto px-6 py-6"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Resources
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
        <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <div className="h-16 w-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {isGraded ? 'Assignment Graded!' : 'Assignment Submitted!'}
              </h3>
              <p className="text-gray-600">
                {isGraded 
                  ? 'Your instructor has reviewed and graded your assignment.'
                  : 'Your assignment has been successfully submitted and is now being reviewed by your instructor.'}
              </p>
            </div>
            
            <div className="bg-white rounded-lg p-4 mb-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Submitted At</p>
                  <p className="font-semibold text-gray-900">
                    {assignment.submission_status?.submitted_at 
                      ? new Date(assignment.submission_status.submitted_at).toLocaleString()
                      : new Date().toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Status</p>
                  <Badge className={isGraded 
                    ? "bg-green-100 text-green-800 border-green-300" 
                    : "bg-yellow-100 text-yellow-800 border-yellow-300"}>
                    {isGraded ? 'Graded' : 'Under Review'}
                  </Badge>
                </div>
              </div>
            </div>
            
            {/* Grade Display */}
            {isGraded && grade !== undefined && (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-6 mb-6 border-2 border-green-200">
                <div className="text-center mb-4">
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <Award className="h-8 w-8 text-green-600" />
                    <span className="text-5xl font-bold text-green-600">
                      {getLetterGrade(percentage)}
                    </span>
                  </div>
                  <p className="text-lg font-semibold text-gray-900">
                    {grade} / {assignment.points_possible} ({percentage.toFixed(1)}%)
                  </p>
                </div>
                
                {assignment.submission_status?.graded_at && (
                  <div className="text-center text-sm text-gray-600">
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
              <div className="bg-blue-50 rounded-lg p-6 mb-6 border-l-4 border-blue-500">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-blue-600" />
                  Instructor Feedback:
                </h4>
                <div className="text-gray-700 whitespace-pre-wrap">
                  {feedback}
                </div>
              </div>
            )}
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setSubmissionMode('view')}
                className="flex-1"
              >
                Back to Assignment Details
              </Button>
              
              {isGraded && (
                <Button
                  variant="default"
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={() => {
                    // Option to download grade report or navigate to full assessment page
                    window.open(`/student/assessments`, '_blank');
                  }}
                >
                  <Award className="h-4 w-4 mr-2" />
                  View All Grades
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Submit Mode
  return (
    <div className="space-y-6">
      {/* Error Alert */}
      {error && (
        <Alert className="border-red-700 bg-red-900/30">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <AlertTitle className="text-red-300">Submission Error</AlertTitle>
          <AlertDescription className="text-red-200">{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900">{assignment.title}</h3>
              <p className="text-sm text-gray-600 mt-1">Complete and submit your assignment</p>
            </div>
            <Button
              variant="ghost"
              onClick={() => setSubmissionMode('view')}
              disabled={submitting}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Due Date Warning */}
          {assignment.due_date && (isDueSoon || isOverdue) && (
            <div className={`rounded-lg p-4 flex items-center space-x-3 ${
              isOverdue ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'
            }`}>
              <AlertCircle className={`h-5 w-5 ${isOverdue ? 'text-red-600' : 'text-yellow-600'}`} />
              <div>
                <p className={`font-semibold ${isOverdue ? 'text-red-800' : 'text-yellow-800'}`}>
                  {isOverdue ? 'This assignment is overdue' : 'Assignment due soon'}
                </p>
                <p className={`text-sm ${isOverdue ? 'text-red-600' : 'text-yellow-600'}`}>
                  Due: {new Date(assignment.due_date).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {/* Text Response */}
          {isTextResponse && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Response *
              </label>
              <textarea
                value={textResponse}
                onChange={(e) => setTextResponse(e.target.value)}
                rows={12}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                placeholder="Write your response here..."
              />
              <div className="flex justify-between mt-2 text-sm text-gray-500">
                <span>{textResponse.length} characters</span>
                <span>{textResponse.split(/\s+/).filter(w => w.length > 0).length} words</span>
              </div>
            </div>
          )}

          {/* File Upload */}
          {isFileUpload && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Files {!isTextResponse && '*'}
              </label>
              
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-green-400 transition-colors">
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
                  <Upload className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {allowedFileTypes.join(', ')} up to {maxFileSizeMB}MB each
                  </p>
                </label>
              </div>

              {/* Selected Files */}
              {selectedFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-gray-50 rounded-lg p-3 border"
                    >
                      <div className="flex items-center space-x-3">
                        <Paperclip className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{file.name}</p>
                          <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                      >
                        <X className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-between items-center pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setSubmissionMode('view')}
              disabled={submitting}
            >
              Cancel
            </Button>
            
            <Button
              onClick={handleSubmit}
              disabled={submitting || (isTextResponse && !textResponse.trim()) || (isFileUpload && !isTextResponse && selectedFiles.length === 0)}
              className="bg-green-600 hover:bg-green-700 px-8"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Assignment
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
