/**
 * Quick Grading Modal - Inline grading without page navigation
 */

import React, { useState, useEffect } from 'react';
import { X, Save, Send, Star, MessageSquare, Award, Zap, ChevronLeft, ChevronRight } from 'lucide-react';
import GradingService from '@/services/grading.service';
import { CommentBankPanel } from './CommentBankPanel';
import { RubricGradingPanel } from './RubricGradingPanel';

interface QuickGradingModalProps {
  submission: any;
  isOpen: boolean;
  onClose: () => void;
  onGraded: (submissionId: number) => void;
  onNext?: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

export const QuickGradingModal: React.FC<QuickGradingModalProps> = ({
  submission,
  isOpen,
  onClose,
  onGraded,
  onNext,
  onPrevious,
  hasNext,
  hasPrevious
}) => {
  const [grade, setGrade] = useState('');
  const [feedback, setFeedback] = useState('');
  const [rubricScores, setRubricScores] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showCommentBank, setShowCommentBank] = useState(false);
  const [showRubric, setShowRubric] = useState(false);
  const [maxResubmissions, setMaxResubmissions] = useState('');

  useEffect(() => {
    if (submission) {
      setGrade(submission.grade?.toString() || '');
      setFeedback(submission.feedback || '');
      setMaxResubmissions(submission.max_resubmissions?.toString() || '');
    }
  }, [submission]);

  // Auto-save draft every 30 seconds
  useEffect(() => {
    if (!autoSaveEnabled || !grade || !feedback) return;

    const timer = setTimeout(() => {
      saveDraft();
    }, 30000);

    return () => clearTimeout(timer);
  }, [grade, feedback, autoSaveEnabled]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Enter to submit
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
      // Ctrl/Cmd + S to save draft
      else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveDraft();
      }
      // Ctrl/Cmd + → for next
      else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight' && hasNext) {
        e.preventDefault();
        onNext?.();
      }
      // Ctrl/Cmd + ← for previous
      else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft' && hasPrevious) {
        e.preventDefault();
        onPrevious?.();
      }
      // Escape to close
      else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isOpen, grade, feedback, hasNext, hasPrevious]);

  const saveDraft = async () => {
    try {
      const draftKey = `draft_${submission.type}_${submission.id}`;
      localStorage.setItem(draftKey, JSON.stringify({
        grade,
        feedback,
        rubricScores,
        savedAt: new Date().toISOString()
      }));
      setLastSaved(new Date());
    } catch (error) {
      console.error('Failed to save draft:', error);
    }
  };

  const loadDraft = () => {
    try {
      const draftKey = `draft_${submission.type}_${submission.id}`;
      const draft = localStorage.getItem(draftKey);
      if (draft) {
        const parsed = JSON.parse(draft);
        setGrade(parsed.grade);
        setFeedback(parsed.feedback);
        setRubricScores(parsed.rubricScores || {});
        setLastSaved(new Date(parsed.savedAt));
      }
    } catch (error) {
      console.error('Failed to load draft:', error);
    }
  };

  const handleSubmit = async () => {
    if (!grade) {
      alert('Please enter a grade');
      return;
    }

    const gradeValue = parseFloat(grade);
    if (isNaN(gradeValue) || gradeValue < 0 || gradeValue > submission.points_possible) {
      alert(`Grade must be between 0 and ${submission.points_possible}`);
      return;
    }

    setSaving(true);
    try {
      await GradingService.quickGrade({
        type: submission.type,
        submission_id: submission.id,
        grade: gradeValue,
        feedback,
        rubric_scores: Object.keys(rubricScores).length > 0 ? rubricScores : undefined,
        max_resubmissions: maxResubmissions ? parseInt(maxResubmissions) : undefined
      });

      // Clear draft
      const draftKey = `draft_${submission.type}_${submission.id}`;
      localStorage.removeItem(draftKey);

      onGraded(submission.id);

      // Auto-advance to next if available
      if (hasNext) {
        setTimeout(() => onNext?.(), 500);
      } else {
        onClose();
      }
    } catch (error: any) {
      alert(error.message || 'Failed to submit grade');
    } finally {
      setSaving(false);
    }
  };

  const applyComment = (comment: string) => {
    setFeedback(prev => prev + (prev ? '\n\n' : '') + comment);
    setShowCommentBank(false);
  };

  const applyRubricScores = (scores: any, total: number) => {
    setRubricScores(scores);
    setGrade(total.toString());
    setShowRubric(false);
  };

  if (!isOpen || !submission) return null;

  const percentage = grade ? ((parseFloat(grade) / submission.points_possible) * 100).toFixed(1) : '0';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="min-h-screen px-4 flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Quick Grading</h3>
                <p className="text-sm text-blue-100">
                  {submission.title} - {submission.student_name}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {lastSaved && (
                <span className="text-xs text-blue-100">
                  Saved {lastSaved.toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          {/* Navigation */}
          <div className="bg-slate-100 dark:bg-slate-700 px-6 py-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-600">
            <button
              onClick={onPrevious}
              disabled={!hasPrevious}
              className="flex items-center space-x-2 px-3 py-2 bg-white dark:bg-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Previous</span>
            </button>

            <div className="text-sm text-slate-600 dark:text-slate-300">
              <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-600 rounded">Ctrl</kbd> + 
              <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-600 rounded ml-1">←/→</kbd> to navigate
            </div>

            <button
              onClick={onNext}
              disabled={!hasNext}
              className="flex items-center space-x-2 px-3 py-2 bg-white dark:bg-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <span className="text-sm font-medium">Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Submission Info */}
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-600 dark:text-slate-400">Course:</span>
                  <span className="ml-2 font-medium text-slate-900 dark:text-white">
                    {submission.course_title}
                  </span>
                </div>
                <div>
                  <span className="text-slate-600 dark:text-slate-400">Due:</span>
                  <span className="ml-2 font-medium text-slate-900 dark:text-white">
                    {new Date(submission.due_date).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-600 dark:text-slate-400">Submitted:</span>
                  <span className="ml-2 font-medium text-slate-900 dark:text-white">
                    {new Date(submission.submitted_at).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-600 dark:text-slate-400">Status:</span>
                  <span className={`ml-2 font-medium ${
                    submission.days_late > 0 
                      ? 'text-red-600 dark:text-red-400' 
                      : 'text-green-600 dark:text-green-400'
                  }`}>
                    {submission.days_late > 0 ? `${submission.days_late} days late` : 'On time'}
                  </span>
                </div>
              </div>
            </div>

            {/* Grade Input */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Grade <span className="text-red-500">*</span>
              </label>
              <div className="flex items-start space-x-4">
                <div className="flex-1">
                  <div className="relative">
                    <input
                      type="number"
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      min="0"
                      max={submission.points_possible}
                      step="0.5"
                      className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-lg font-semibold"
                      placeholder="0"
                    />
                    <div className="absolute right-3 top-3 text-sm text-slate-500 dark:text-slate-400">
                      / {submission.points_possible}
                    </div>
                  </div>
                </div>
                <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-4 min-w-[120px] text-center">
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {percentage}%
                  </div>
                  <div className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    Percentage
                  </div>
                </div>
              </div>

              {/* Quick Grade Buttons */}
              <div className="flex flex-wrap gap-2">
                {[100, 95, 90, 85, 80, 75, 70].map(percent => {
                  const value = (submission.points_possible * percent / 100).toFixed(1);
                  return (
                    <button
                      key={percent}
                      onClick={() => setGrade(value)}
                      className="px-3 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-md text-sm font-medium transition-colors"
                    >
                      {percent}%
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                onClick={() => setShowCommentBank(!showCommentBank)}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Comment Bank</span>
              </button>

              <button
                onClick={() => setShowRubric(!showRubric)}
                className="flex items-center space-x-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
              >
                <Star className="w-4 h-4" />
                <span>Use Rubric</span>
              </button>
            </div>

            {/* Comment Bank Panel */}
            {showCommentBank && (
              <CommentBankPanel
                onSelectComment={applyComment}
                onClose={() => setShowCommentBank(false)}
              />
            )}

            {/* Rubric Panel */}
            {showRubric && (
              <RubricGradingPanel
                submissionType={submission.type}
                maxPoints={submission.points_possible}
                onApply={applyRubricScores}
                onClose={() => setShowRubric(false)}
              />
            )}

            {/* Feedback */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Feedback
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={6}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="Provide detailed feedback to help the student improve..."
              />
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>{feedback.length} characters</span>
                <span>
                  <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-600 rounded">Ctrl+Enter</kbd> to submit
                </span>
              </div>
            </div>

            {/* Resubmission Limit */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Max Resubmissions <span className="text-xs font-normal text-slate-500">(optional)</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={maxResubmissions}
                  onChange={(e) => setMaxResubmissions(e.target.value)}
                  min="0"
                  max="20"
                  step="1"
                  className="w-32 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="3"
                />
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Increase to allow more resubmissions
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-slate-50 dark:bg-slate-900 px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={autoSaveEnabled}
                  onChange={(e) => setAutoSaveEnabled(e.target.checked)}
                  className="rounded"
                />
                <span>Auto-save</span>
              </label>
              <button
                onClick={saveDraft}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Save Draft
              </button>
              <button
                onClick={loadDraft}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Load Draft
              </button>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || !grade}
                className="flex items-center space-x-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Submit Grade</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
