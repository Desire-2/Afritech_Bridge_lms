import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  Edit
} from 'lucide-react';
import type { ContentAssignment } from '@/services/contentAssignmentApi';

interface AssignmentPanelProps {
  assignment: ContentAssignment;
  onSubmit: (submission: AssignmentSubmission) => void;
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
  onSubmit 
}) => {
  const [submissionMode, setSubmissionMode] = useState<'view' | 'submit'>('view');
  const [textResponse, setTextResponse] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

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
    if (isTextResponse && !textResponse.trim()) {
      alert('Please provide a text response');
      return;
    }
    
    if (isFileUpload && selectedFiles.length === 0 && !isTextResponse) {
      alert('Please select at least one file');
      return;
    }
    
    setSubmitting(true);
    
    try {
      await onSubmit({
        text: textResponse || undefined,
        files: selectedFiles.length > 0 ? selectedFiles : undefined
      });
      
      // Reset form
      setTextResponse('');
      setSelectedFiles([]);
      setSubmissionMode('view');
    } catch (error) {
      console.error('Submission error:', error);
      alert('Failed to submit assignment. Please try again.');
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

            {/* Action Button */}
            <div className="flex space-x-3">
              <Button 
                onClick={() => setSubmissionMode('submit')}
                className="flex-1 bg-green-600 hover:bg-green-700 py-6 text-lg"
              >
                <Edit className="h-5 w-5 mr-2" />
                Start Assignment
              </Button>
              
              {/* Download template or resources if available */}
              <Button variant="outline" className="px-6">
                <Download className="h-4 w-4 mr-2" />
                Resources
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Submit Mode
  return (
    <div className="space-y-6">
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
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
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
