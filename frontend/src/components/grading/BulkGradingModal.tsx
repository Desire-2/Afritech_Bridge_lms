# Enhanced Grading Components - Bulk Grading Modal and Analytics Dashboard

"use client";

import React, { useState, useEffect } from 'react';
import { 
  XMarkIcon, 
  CheckCircleIcon, 
  ExclamationTriangleIcon,
  SparklesIcon,
  CalculatorIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import EnhancedGradingService, { 
  EnhancedAssignmentSubmission,
  BulkGradeRequest,
  FeedbackTemplate 
} from '@/services/enhanced-grading.service';

interface BulkGradingModalProps {
  isOpen: boolean;
  onClose: () => void;
  submissions: EnhancedAssignmentSubmission[];
  onSuccess: () => void;
}

export const BulkGradingModal: React.FC<BulkGradingModalProps> = ({
  isOpen,
  onClose,
  submissions,
  onSuccess
}) => {
  const [gradingData, setGradingData] = useState<{ [id: number]: { grade: string; feedback: string } }>({});
  const [templates, setTemplates] = useState<FeedbackTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [applyCurve, setApplyCurve] = useState(false);
  const [curveConfig, setCurveConfig] = useState({
    type: 'linear' as 'linear' | 'bell' | 'square_root',
    target_average: 80,
    preserve_order: true,
    minimum_grade: 0,
    maximum_grade: 100
  });
  const [latePenaltyPolicy, setLatePenaltyPolicy] = useState({
    enabled: false,
    per_day_penalty: 5,
    max_penalty: 20,
    grace_period_days: 1
  });
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
      initializeGradingData();
    }
  }, [isOpen, submissions]);

  const fetchTemplates = async () => {
    try {
      const data = await EnhancedGradingService.getFeedbackTemplates({});
      setTemplates(data);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    }
  };

  const initializeGradingData = () => {
    const initialData: { [id: number]: { grade: string; feedback: string } } = {};
    submissions.forEach(submission => {
      initialData[submission.id] = {
        grade: '',
        feedback: ''
      };
    });
    setGradingData(initialData);
  };

  const updateGrade = (submissionId: number, grade: string) => {
    setGradingData(prev => ({
      ...prev,
      [submissionId]: {
        ...prev[submissionId],
        grade
      }
    }));
  };

  const updateFeedback = (submissionId: number, feedback: string) => {
    setGradingData(prev => ({
      ...prev,
      [submissionId]: {
        ...prev[submissionId],
        feedback
      }
    }));
  };

  const applyTemplateToAll = () => {
    if (!selectedTemplate) return;
    
    const template = templates.find(t => t.id === selectedTemplate);
    if (!template) return;

    setGradingData(prev => {
      const updated = { ...prev };
      submissions.forEach(submission => {
        if (!updated[submission.id].feedback) {
          updated[submission.id].feedback = template.content;
        }
      });
      return updated;
    });
  };

  const applySuggestedGrades = async () => {
    setProcessing(true);
    try {
      for (const submission of submissions) {
        if (!gradingData[submission.id].grade) {
          // Use AI suggestion if available
          const suggestions = await EnhancedGradingService.getGradingSuggestions(submission.id, {
            include_similar: true,
            confidence_threshold: 0.6,
            explanation_detail: 'brief'
          });
          
          // Check if suggestions and suggested_grade are valid before using toString()
          if (suggestions && suggestions.suggested_grade !== null && suggestions.suggested_grade !== undefined) {
            updateGrade(submission.id, suggestions.suggested_grade.toString());
          }
        }
      }
    } catch (err) {
      setError('Failed to apply AI suggestions');
    } finally {
      setProcessing(false);
    }
  };

  const handleSubmit = async () => {
    setProcessing(true);
    setError(null);

    try {
      // Validate all submissions have grades
      const submissionsToGrade = [];
      for (const submission of submissions) {
        const data = gradingData[submission.id];
        if (!data.grade || isNaN(parseFloat(data.grade))) {
          setError(`Please enter a valid grade for ${submission.student_name}`);
          setProcessing(false);
          return;
        }

        submissionsToGrade.push({
          id: submission.id,
          grade: parseFloat(data.grade),
          feedback: data.feedback || ''
        });
      }

      const bulkRequest: BulkGradeRequest = {
        submissions: submissionsToGrade
      };

      if (applyCurve) {
        bulkRequest.apply_curve = curveConfig;
      }

      if (latePenaltyPolicy.enabled) {
        bulkRequest.late_penalty_policy = {
          per_day_penalty: latePenaltyPolicy.per_day_penalty,
          max_penalty: latePenaltyPolicy.max_penalty,
          grace_period_days: latePenaltyPolicy.grace_period_days
        };
      }

      await EnhancedGradingService.bulkGradeSubmissions(bulkRequest);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit grades');
    } finally {
      setProcessing(false);
    }
  };

  const calculateGradeStats = () => {
    const grades = Object.values(gradingData)
      .map(data => parseFloat(data.grade))
      .filter(grade => !isNaN(grade));
    
    if (grades.length === 0) return null;

    const average = grades.reduce((sum, grade) => sum + grade, 0) / grades.length;
    const sorted = [...grades].sort((a, b) => a - b);
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];

    return {
      average: average.toFixed(1),
      median: median.toFixed(1),
      min: Math.min(...grades).toFixed(1),
      max: Math.max(...grades).toFixed(1),
      count: grades.length
    };
  };

  const gradeStats = calculateGradeStats();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              Bulk Grade Submissions
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Grade {submissions.length} submissions efficiently
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Controls */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 space-y-4">
          {/* Template Application */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Apply Feedback Template to All
              </label>
              <div className="flex space-x-2">
                <select
                  value={selectedTemplate || ''}
                  onChange={(e) => setSelectedTemplate(e.target.value ? parseInt(e.target.value) : null)}
                  className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="">Select template</option>
                  {templates.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={applyTemplateToAll}
                  disabled={!selectedTemplate}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                AI Grading Assistance
              </label>
              <button
                onClick={applySuggestedGrades}
                disabled={processing}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center justify-center"
              >
                <SparklesIcon className="h-4 w-4 mr-2" />
                {processing ? 'Generating...' : 'Apply AI Suggestions'}
              </button>
            </div>
          </div>

          {/* Advanced Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Grading Curve */}
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={applyCurve}
                  onChange={(e) => setApplyCurve(e.target.checked)}
                  className="rounded border-slate-300 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Apply Grading Curve
                </span>
              </label>
              {applyCurve && (
                <div className="pl-6 space-y-2">
                  <div className="flex items-center space-x-2">
                    <label className="text-xs text-slate-600 dark:text-slate-400">Target Average:</label>
                    <input
                      type="number"
                      value={curveConfig.target_average}
                      onChange={(e) => setCurveConfig(prev => ({ ...prev, target_average: parseInt(e.target.value) }))}
                      className="w-16 px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Late Penalty */}
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={latePenaltyPolicy.enabled}
                  onChange={(e) => setLatePenaltyPolicy(prev => ({ ...prev, enabled: e.target.checked }))}
                  className="rounded border-slate-300 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Apply Late Penalty
                </span>
              </label>
              {latePenaltyPolicy.enabled && (
                <div className="pl-6 space-y-2">
                  <div className="flex items-center space-x-2">
                    <label className="text-xs text-slate-600 dark:text-slate-400">Per Day:</label>
                    <input
                      type="number"
                      value={latePenaltyPolicy.per_day_penalty}
                      onChange={(e) => setLatePenaltyPolicy(prev => ({ ...prev, per_day_penalty: parseInt(e.target.value) }))}
                      className="w-16 px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded"
                      min="0"
                      max="50"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Grade Statistics */}
          {gradeStats && (
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
              <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-2">Grade Statistics</h4>
              <div className="grid grid-cols-5 gap-4 text-sm">
                <div>
                  <span className="text-slate-600 dark:text-slate-400">Average:</span>
                  <p className="font-medium">{gradeStats.average}%</p>
                </div>
                <div>
                  <span className="text-slate-600 dark:text-slate-400">Median:</span>
                  <p className="font-medium">{gradeStats.median}%</p>
                </div>
                <div>
                  <span className="text-slate-600 dark:text-slate-400">Min:</span>
                  <p className="font-medium">{gradeStats.min}%</p>
                </div>
                <div>
                  <span className="text-slate-600 dark:text-slate-400">Max:</span>
                  <p className="font-medium">{gradeStats.max}%</p>
                </div>
                <div>
                  <span className="text-slate-600 dark:text-slate-400">Count:</span>
                  <p className="font-medium">{gradeStats.count}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mr-2" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Submissions List */}
        <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
          {submissions.map((submission) => (
            <div key={submission.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Student Info */}
                <div>
                  <h4 className="font-medium text-slate-900 dark:text-white">
                    {submission.student_name}
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {submission.assignment_title}
                  </p>
                  <div className="flex items-center space-x-4 mt-2 text-xs text-slate-500">
                    <span>{submission.word_count} words</span>
                    <span className={`px-2 py-1 rounded-full ${
                      submission.priority_level === 'high' ? 'bg-red-100 text-red-800' :
                      submission.priority_level === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {submission.priority_level}
                    </span>
                    {submission.days_late > 0 && (
                      <span className="text-red-600">
                        {submission.days_late.toFixed(1)} days late
                      </span>
                    )}
                  </div>
                </div>

                {/* Grade Input */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Grade (out of {submission.assignment_points})
                  </label>
                  <input
                    type="number"
                    value={gradingData[submission.id]?.grade || ''}
                    onChange={(e) => updateGrade(submission.id, e.target.value)}
                    min="0"
                    max={submission.assignment_points}
                    step="0.5"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="Grade"
                  />
                  {gradingData[submission.id]?.grade && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      {((parseFloat(gradingData[submission.id].grade) / submission.assignment_points) * 100).toFixed(1)}%
                    </p>
                  )}
                </div>

                {/* Feedback Input */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Feedback
                  </label>
                  <textarea
                    value={gradingData[submission.id]?.feedback || ''}
                    onChange={(e) => updateFeedback(submission.id, e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="Feedback for student..."
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-slate-200 dark:border-slate-700">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {submissions.length} submissions to grade
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={processing || submissions.length === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
            >
              {processing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white mr-2"></div>
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircleIcon className="h-4 w-4 mr-2" />
                  Submit Grades
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};