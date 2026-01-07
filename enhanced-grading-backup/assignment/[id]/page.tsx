"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';
import EnhancedGradingService, { 
  EnhancedAssignmentSubmission,
  FeedbackTemplate,
  SmartGradingSuggestion,
  EnhancedGradeRequest,
  GradingRubric
} from '@/services/enhanced-grading.service';
import { 
  SparklesIcon, 
  ClockIcon, 
  DocumentTextIcon,
  ChartBarIcon,
  LightBulbIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowLeftIcon,
  EyeIcon,
  PlayIcon,
  PauseIcon,
  MicrophoneIcon
} from '@heroicons/react/24/outline';

const EnhancedAssignmentGradingDetail = () => {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuth();
  const submissionId = parseInt(params.id as string);

  // State management
  const [submission, setSubmission] = useState<EnhancedAssignmentSubmission | null>(null);
  const [insights, setInsights] = useState<SmartGradingSuggestion | null>(null);
  const [templates, setTemplates] = useState<FeedbackTemplate[]>([]);
  const [rubrics, setRubrics] = useState<GradingRubric[]>([]);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [grade, setGrade] = useState<string>('');
  const [feedback, setFeedback] = useState<string>('');
  const [privateNotes, setPrivateNotes] = useState<string>('');
  const [rubricScores, setRubricScores] = useState<{ [criteriaId: string]: number }>({});
  const [useRubricGrading, setUseRubricGrading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);

  // AI Features state
  const [aiSuggestionsEnabled, setAiSuggestionsEnabled] = useState(true);
  const [autoGenerateFeedback, setAutoGenerateFeedback] = useState(false);
  const [feedbackTone, setFeedbackTone] = useState<'encouraging' | 'constructive' | 'detailed' | 'brief'>('constructive');
  
  // UI state
  const [showTemplates, setShowTemplates] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [gradingStartTime, setGradingStartTime] = useState<Date | null>(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Refs
  const feedbackRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (token && submissionId) {
      fetchSubmissionData();
      startGradingTimer();
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [token, submissionId]);

  const fetchSubmissionData = async () => {
    setLoading(true);
    try {
      // Fetch submission with AI insights
      const submissionData = await EnhancedGradingService.getSubmissionWithInsights(submissionId);
      setSubmission(submissionData.submission);
      setInsights(submissionData.insights);
      
      // Pre-fill form if already graded
      if (submissionData.submission.grade !== undefined) {
        setGrade(submissionData.submission.grade.toString());
        setFeedback(submissionData.submission.feedback || '');
        if (submissionData.submission.rubric_scores) {
          setRubricScores(submissionData.submission.rubric_scores);
          setUseRubricGrading(true);
        }
      } else if (aiSuggestionsEnabled && submissionData.insights) {
        // Pre-fill with AI suggestion
        setGrade(submissionData.insights.suggested_grade.toString());
      }

      // Fetch templates and rubrics
      await fetchTemplates();
      if (submissionData.submission.assignment_id) {
        await fetchRubrics(submissionData.submission.assignment_id);
      }

    } catch (err: any) {
      setError(err.message || 'Failed to load submission');
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const data = await EnhancedGradingService.getFeedbackTemplates({
        grade_range: grade ? { 
          min: Math.max(0, parseFloat(grade) - 10), 
          max: Math.min(100, parseFloat(grade) + 10) 
        } : undefined
      });
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const fetchRubrics = async (assignmentId: number) => {
    try {
      const data = await EnhancedGradingService.getAssignmentRubrics(assignmentId);
      setRubrics(data);
      if (data.length > 0) {
        setUseRubricGrading(true);
        // Initialize rubric scores if not already set
        if (Object.keys(rubricScores).length === 0) {
          const initialScores: { [key: string]: number } = {};
          data[0].criteria.forEach(criterion => {
            initialScores[criterion.id] = 0;
          });
          setRubricScores(initialScores);
        }
      }
    } catch (err) {
      console.error('Failed to load rubrics:', err);
    }
  };

  const startGradingTimer = () => {
    setGradingStartTime(new Date());
    setIsTimerRunning(true);
  };

  const stopGradingTimer = () => {
    setIsTimerRunning(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  const getGradingTime = (): string => {
    if (!gradingStartTime) return '0:00';
    const now = new Date();
    const diff = Math.floor((now.getTime() - gradingStartTime.getTime()) / 1000);
    const minutes = Math.floor(diff / 60);
    const seconds = diff % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSubmitGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!submission) return;

    const gradeValue = parseFloat(grade);
    if (isNaN(gradeValue) || gradeValue < 0 || gradeValue > submission.assignment_points) {
      setError(`Grade must be between 0 and ${submission.assignment_points}`);
      return;
    }

    setGrading(true);
    setError(null);
    stopGradingTimer();

    try {
      const gradeData: EnhancedGradeRequest = {
        grade: gradeValue,
        feedback,
        private_notes: privateNotes,
        notify_student: true
      };

      if (useRubricGrading && Object.keys(rubricScores).length > 0) {
        // Grade with rubric
        await EnhancedGradingService.gradeWithRubric(
          submissionId,
          rubricScores,
          feedback,
          privateNotes
        );
      } else {
        // Regular grading
        if (submission.grade !== undefined) {
          await EnhancedGradingService.updateAssignmentGrade(submissionId, gradeData);
        } else {
          await EnhancedGradingService.gradeAssignment(submissionId, gradeData);
        }
      }
      
      router.push('/instructor/grading/enhanced?status=graded');
    } catch (err: any) {
      setError(err.message || 'Failed to submit grade');
    } finally {
      setGrading(false);
    }
  };

  const handleGenerateAIFeedback = async () => {
    if (!submission) return;

    setAutoGenerateFeedback(true);
    try {
      const feedbackData = await EnhancedGradingService.generateAIFeedback(submissionId, {
        tone: feedbackTone,
        include_suggestions: true,
        personalization_level: 'high'
      });
      
      setFeedback(feedbackData.feedback);
      if (feedbackRef.current) {
        feedbackRef.current.focus();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate AI feedback');
    } finally {
      setAutoGenerateFeedback(false);
    }
  };

  const applyTemplate = (template: FeedbackTemplate) => {
    setFeedback(template.content);
    setSelectedTemplate(template.id);
    setShowTemplates(false);
    if (feedbackRef.current) {
      feedbackRef.current.focus();
    }
  };

  const calculateRubricTotal = (): number => {
    return Object.values(rubricScores).reduce((sum, score) => sum + score, 0);
  };

  const handleRubricScoreChange = (criteriaId: string, score: number) => {
    const newScores = { ...rubricScores, [criteriaId]: score };
    setRubricScores(newScores);
    
    // Update total grade if using rubric
    if (useRubricGrading) {
      const total = Object.values(newScores).reduce((sum, s) => sum + s, 0);
      setGrade(total.toString());
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-slate-600 dark:text-slate-300">Loading submission...</span>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-600 dark:text-slate-400">Submission not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <button
              onClick={() => router.back()}
              className="text-white hover:text-blue-200 mr-4 p-2 rounded-lg hover:bg-white hover:bg-opacity-20 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold">Enhanced Grading Interface</h1>
              <p className="text-blue-100 mt-1">AI-powered grading with comprehensive insights</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {/* Grading Timer */}
            <div className="flex items-center bg-white bg-opacity-20 rounded-lg px-4 py-2">
              <ClockIcon className="h-5 w-5 mr-2" />
              <span className="font-mono text-lg">{getGradingTime()}</span>
              <button
                onClick={() => setIsTimerRunning(!isTimerRunning)}
                className="ml-2 p-1 rounded hover:bg-white hover:bg-opacity-20"
              >
                {isTimerRunning ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex space-x-2">
              <button
                onClick={() => setShowInsights(!showInsights)}
                className="px-3 py-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-colors"
              >
                <LightBulbIcon className="h-4 w-4 mr-1 inline" />
                Insights
              </button>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="px-3 py-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-colors"
              >
                <EyeIcon className="h-4 w-4 mr-1 inline" />
                Preview
              </button>
            </div>
          </div>
        </div>

        {/* Submission Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white bg-opacity-20 rounded-lg p-3">
            <p className="text-sm text-blue-100">Complexity Score</p>
            <p className="text-xl font-bold">{submission.complexity_score}/10</p>
          </div>
          <div className="bg-white bg-opacity-20 rounded-lg p-3">
            <p className="text-sm text-blue-100">Word Count</p>
            <p className="text-xl font-bold">{submission.word_count}</p>
          </div>
          <div className="bg-white bg-opacity-20 rounded-lg p-3">
            <p className="text-sm text-blue-100">Reading Time</p>
            <p className="text-xl font-bold">{submission.reading_time}m</p>
          </div>
          <div className="bg-white bg-opacity-20 rounded-lg p-3">
            <p className="text-sm text-blue-100">Est. Grading</p>
            <p className="text-xl font-bold">{submission.estimated_grading_time}m</p>
          </div>
        </div>
      </div>

      {/* AI Insights Panel */}
      {showInsights && insights && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <SparklesIcon className="h-6 w-6 text-purple-600 mr-2" />
              <h2 className="text-lg font-semibold text-purple-900">AI Grading Insights</h2>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm ${
              insights.confidence_score > 0.8 
                ? 'bg-green-100 text-green-800'
                : insights.confidence_score > 0.6
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-red-100 text-red-800'
            }`}>
              {(insights.confidence_score * 100).toFixed(0)}% confidence
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-purple-900 mb-2">Suggested Grade</h3>
              <div className="bg-white rounded-lg p-4 border border-purple-200">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-purple-600">
                    {insights.suggested_grade}%
                  </span>
                  <button
                    onClick={() => setGrade(insights.suggested_grade.toString())}
                    className="px-3 py-1 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Apply
                  </button>
                </div>
                <p className="text-sm text-slate-600 mt-2">{insights.reasoning}</p>
              </div>
            </div>

            <div>
              <h3 className="font-medium text-purple-900 mb-2">Key Factors</h3>
              <div className="space-y-2">
                {insights.factors.map((factor, index) => (
                  <div key={index} className="flex items-center justify-between bg-white rounded-lg p-3 border border-purple-200">
                    <span className="text-sm font-medium">{factor.factor}</span>
                    <div className="flex items-center">
                      <span className="text-xs text-slate-500 mr-2">Weight: {factor.weight}</span>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        factor.impact === 'positive' ? 'bg-green-100 text-green-800' :
                        factor.impact === 'negative' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {factor.impact}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {insights.strengths && insights.strengths.length > 0 && (
            <div className="mt-4">
              <h3 className="font-medium text-purple-900 mb-2">Identified Strengths</h3>
              <div className="bg-white rounded-lg p-4 border border-purple-200">
                <ul className="list-disc list-inside space-y-1 text-sm text-slate-700">
                  {insights.strengths.map((strength, index) => (
                    <li key={index}>{strength}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {insights.improvement_areas && insights.improvement_areas.length > 0 && (
            <div className="mt-4">
              <h3 className="font-medium text-purple-900 mb-2">Areas for Improvement</h3>
              <div className="bg-white rounded-lg p-4 border border-purple-200">
                <ul className="list-disc list-inside space-y-1 text-sm text-slate-700">
                  {insights.improvement_areas.map((area, index) => (
                    <li key={index}>{area}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Submission Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Assignment Info */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              {submission.assignment_title}
            </h2>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Course:</span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {submission.course_title}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Student:</span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {submission.student_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Points Possible:</span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {submission.assignment_points}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Priority:</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                  submission.priority_level === 'high' ? 'text-red-600 bg-red-50 border-red-200' :
                  submission.priority_level === 'medium' ? 'text-yellow-600 bg-yellow-50 border-yellow-200' :
                  'text-green-600 bg-green-50 border-green-200'
                }`}>
                  {submission.priority_level}
                </span>
              </div>
            </div>
          </div>

          {/* Submission Content */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Submission Content
            </h3>
            
            {submission.submission_text && (
              <div className="prose dark:prose-invert max-w-none mb-4">
                <MarkdownRenderer content={submission.submission_text} />
              </div>
            )}

            {submission.file_path && (
              <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      Attached File: {submission.file_name}
                    </p>
                    {submission.file_size && (
                      <p className="text-sm text-slate-500 dark:text-slate-500">
                        Size: {(submission.file_size / 1024).toFixed(1)} KB
                      </p>
                    )}
                  </div>
                  <a
                    href={submission.file_path}
                    download
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <DocumentTextIcon className="w-4 h-4 mr-2" />
                    Download
                  </a>
                </div>
              </div>
            )}

            {submission.external_url && (
              <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  External URL
                </label>
                <a
                  href={submission.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 underline"
                >
                  {submission.external_url}
                </a>
              </div>
            )}
          </div>

          {/* Current Grade */}
          {submission.grade !== undefined && (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Current Grade
              </h3>
              <div className="text-center">
                <p className="text-4xl font-bold text-slate-900 dark:text-white mb-2">
                  {submission.grade}/{submission.assignment_points}
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  {submission.percentage?.toFixed(1)}%
                  {submission.letter_grade && ` (${submission.letter_grade})`}
                </p>
                {submission.graded_at && (
                  <p className="text-sm text-slate-500 dark:text-slate-500 mt-2">
                    Graded on {new Date(submission.graded_at).toLocaleString()}
                  </p>
                )}
              </div>
              {submission.feedback && (
                <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                    {submission.feedback}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column - Grading Form */}
        <div className="space-y-6">
          {/* Grading Options */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Grading Options
            </h3>
            
            <div className="space-y-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={aiSuggestionsEnabled}
                  onChange={(e) => setAiSuggestionsEnabled(e.target.checked)}
                  className="rounded border-slate-300 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-slate-700 dark:text-slate-300">
                  Enable AI suggestions
                </span>
              </label>
              
              {rubrics.length > 0 && (
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={useRubricGrading}
                    onChange={(e) => setUseRubricGrading(e.target.checked)}
                    className="rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-slate-700 dark:text-slate-300">
                    Use rubric grading
                  </span>
                </label>
              )}
            </div>
          </div>

          {/* Grading Form */}
          <form onSubmit={handleSubmitGrade} className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              {submission.grade !== undefined ? 'Update Grade' : 'Submit Grade'}
            </h3>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            {/* Rubric Grading */}
            {useRubricGrading && rubrics.length > 0 && (
              <div className="mb-6">
                <h4 className="font-medium text-slate-900 dark:text-white mb-3">
                  Rubric Assessment
                </h4>
                <div className="space-y-4">
                  {rubrics[0].criteria.map((criterion) => (
                    <div key={criterion.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <h5 className="font-medium text-slate-900 dark:text-white">
                          {criterion.name}
                        </h5>
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {criterion.points} pts
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                        {criterion.description}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {criterion.levels.map((level) => (
                          <label key={level.id} className="flex items-center p-2 border rounded hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
                            <input
                              type="radio"
                              name={`rubric-${criterion.id}`}
                              value={level.points}
                              checked={rubricScores[criterion.id] === level.points}
                              onChange={(e) => handleRubricScoreChange(criterion.id, parseFloat(e.target.value))}
                              className="mr-2"
                            />
                            <div>
                              <div className="text-sm font-medium">{level.name}</div>
                              <div className="text-xs text-slate-500">{level.points} pts</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <div className="flex justify-between">
                    <span className="font-medium">Total Score:</span>
                    <span className="font-bold">{calculateRubricTotal()}/{rubrics[0].total_points}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Manual Grade Input */}
            {!useRubricGrading && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Grade (out of {submission.assignment_points})
                </label>
                <input
                  type="number"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  min="0"
                  max={submission.assignment_points}
                  step="0.5"
                  required
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter grade"
                />
                {grade && (
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Percentage: {((parseFloat(grade) / submission.assignment_points) * 100).toFixed(1)}%
                  </p>
                )}
              </div>
            )}

            {/* Feedback Section */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Feedback
                </label>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowTemplates(!showTemplates)}
                    className="text-sm text-blue-600 hover:text-blue-700 px-2 py-1 rounded transition-colors"
                  >
                    Templates
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateAIFeedback}
                    disabled={autoGenerateFeedback}
                    className="text-sm text-purple-600 hover:text-purple-700 px-2 py-1 rounded transition-colors disabled:opacity-50"
                  >
                    <SparklesIcon className="h-3 w-3 mr-1 inline" />
                    {autoGenerateFeedback ? 'Generating...' : 'AI Generate'}
                  </button>
                </div>
              </div>

              {/* Feedback Tone Selector */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Feedback Tone
                </label>
                <select
                  value={feedbackTone}
                  onChange={(e) => setFeedbackTone(e.target.value as any)}
                  className="w-full px-3 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="encouraging">Encouraging</option>
                  <option value="constructive">Constructive</option>
                  <option value="detailed">Detailed</option>
                  <option value="brief">Brief</option>
                </select>
              </div>

              {/* Templates Dropdown */}
              {showTemplates && (
                <div className="mb-3 border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-slate-50 dark:bg-slate-900">
                  <div className="grid gap-2">
                    {templates.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => applyTemplate(template)}
                        className="text-left p-2 text-sm border border-slate-300 dark:border-slate-600 rounded hover:bg-white dark:hover:bg-slate-800 transition-colors"
                      >
                        <div className="font-medium text-slate-900 dark:text-white">
                          {template.name}
                        </div>
                        <div className="text-slate-600 dark:text-slate-400 text-xs mt-1">
                          {template.content.substring(0, 100)}...
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <textarea
                ref={feedbackRef}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={6}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="Provide feedback to the student..."
              />
            </div>

            {/* Private Notes */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Private Notes (Instructor Only)
              </label>
              <textarea
                value={privateNotes}
                onChange={(e) => setPrivateNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="Internal notes for your reference..."
              />
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={grading || !grade}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {grading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                    Submitting...
                  </div>
                ) : (
                  submission.grade !== undefined ? 'Update Grade' : 'Submit Grade'
                )}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EnhancedAssignmentGradingDetail;