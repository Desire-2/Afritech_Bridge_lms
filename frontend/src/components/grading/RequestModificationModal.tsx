// Request Modification Modal Component for Instructor Grading Interface

"use client";

import React, { useState } from 'react';
import { 
  X, 
  AlertTriangle,
  Send,
  Clock
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface RequestModificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  submission: {
    id: number;
    student_name: string;
    student_id: number;
    assignment_title: string;
    assignment_id: number;
    submission_type: 'assignment' | 'project';
  };
  onSuccess: () => void;
}

export const RequestModificationModal: React.FC<RequestModificationModalProps> = ({
  isOpen,
  onClose,
  submission,
  onSuccess
}) => {
  const { token } = useAuth();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const commonReasons = [
    'Submission does not meet the requirements',
    'More detail needed in the analysis section',
    'Missing references or citations',
    'Incorrect formatting or structure',
    'Needs clearer explanations',
    'Examples or evidence required',
    'Technical issues with submission',
    'Plagiarism concerns - requires original work'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide a reason for the modification request');
      return;
    }

    if (!token) {
      setError('Authentication required. Please log in again.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const endpoint = submission.submission_type === 'assignment' 
        ? `${process.env.NEXT_PUBLIC_API_URL}/modification/assignments/${submission.assignment_id}/request-modification`
        : `${process.env.NEXT_PUBLIC_API_URL}/modification/projects/${submission.assignment_id}/request-modification`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          student_id: submission.student_id,
          reason: reason.trim()
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }

      const result = await response.json();
      console.log('Modification request successful:', result);
      
      onSuccess();
      onClose();
      setReason('');
    } catch (error: any) {
      console.error('Error requesting modification:', error);
      setError(error.message || 'Failed to request modification');
    } finally {
      setLoading(false);
    }
  };

  const selectReason = (selectedReason: string) => {
    setReason(selectedReason);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-800 rounded-t-xl sm:rounded-xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-1.5 sm:p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg flex-shrink-0">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white">
                Request Modification
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 truncate">
                {submission.student_name} - {submission.assignment_title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6">
          {/* Warning Notice */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
            <div className="flex items-start">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600 dark:text-yellow-400 mr-2 sm:mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                  Important Notice
                </h4>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Requesting a modification will allow the student to resubmit their work. 
                  The current submission will be marked as requiring changes, and the student 
                  will receive an email notification with your feedback.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Select Reasons */}
          <div className="mb-4 sm:mb-6">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 sm:mb-3">
              Common Reasons (Click to select)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {commonReasons.map((commonReason, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => selectReason(commonReason)}
                  className={`text-left p-3 rounded-lg border transition-colors text-sm ${
                    reason === commonReason
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {commonReason}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Reason */}
          <div className="mb-4 sm:mb-6">
            <label htmlFor="reason" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Reason for Modification Request *
            </label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Please provide specific feedback about what needs to be modified..."
              required
            />
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
              Be specific about what changes are needed. This message will be sent to the student.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 sm:py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm sm:text-base text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !reason.trim()}
              className="w-full sm:w-auto flex items-center justify-center px-4 py-2.5 sm:py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm sm:text-base"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white mr-2"></div>
                  Sending Request...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Request Modification
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};