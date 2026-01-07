// Student Modification Requests and Resubmission Interface

"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  AlertTriangle,
  Clock,
  FileText,
  RotateCcw,
  CheckCircle,
  XCircle,
  Eye,
  Send
} from 'lucide-react';

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
  const [submissionText, setSubmissionText] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [resubmissionNotes, setResubmissionNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!submissionText.trim() && !fileUrl.trim()) {
      setError('Please provide either submission text or file URL');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const endpoint = `${process.env.NEXT_PUBLIC_API_URL}/modification/assignments/${request.id}/resubmit`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          submission_text: submissionText.trim(),
          file_url: fileUrl.trim(),
          resubmission_notes: resubmissionNotes.trim()
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to resubmit assignment');
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      setError(error.message || 'Failed to resubmit assignment');
    } finally {
      setLoading(false);
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

          {/* Submission Text */}
          <div className="mb-6">
            <label htmlFor="submission_text" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Updated Submission
            </label>
            <textarea
              id="submission_text"
              value={submissionText}
              onChange={(e) => setSubmissionText(e.target.value)}
              rows={8}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Please provide your updated submission addressing the instructor's feedback..."
            />
          </div>

          {/* File Upload */}
          <div className="mb-6">
            <label htmlFor="file_url" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              File URL (Optional)
            </label>
            <input
              type="url"
              id="file_url"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://example.com/your-file-link"
            />
          </div>

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

          {/* Resubmissions Remaining */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 mb-6">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Resubmissions remaining:</strong> {request.resubmissions_remaining}
            </p>
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
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (!submissionText.trim() && !fileUrl.trim())}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white mr-2"></div>
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

        {/* Resubmission Modal */}
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