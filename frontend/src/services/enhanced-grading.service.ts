/**
 * Enhanced Grading Service - Comprehensive grading functionality with advanced features
 * Includes bulk operations, analytics, performance optimization, and enhanced UX
 */

import apiClient from '@/lib/api-client';
import { ApiErrorHandler } from '@/lib/error-handler';

// Enhanced interfaces with new fields
export interface SubmissionFilters {
  course_id?: number;
  assignment_id?: number;
  project_id?: number;
  status?: 'pending' | 'graded' | 'all' | 'overdue';
  student_id?: number;
  date_range?: {
    start: string;
    end: string;
  };
  search_query?: string;
  sort_by?: 'submitted_at' | 'due_date' | 'student_name' | 'grade' | 'priority';
  sort_order?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
  tags?: string[];
  priority?: 'low' | 'medium' | 'high';
}

export interface EnhancedAssignmentSubmission {
  id: number;
  assignment_id: number;
  assignment_title: string;
  assignment_description?: string;
  assignment_points: number;
  assignment_rubric?: GradingRubric;
  course_id: number;
  course_title: string;
  student_id: number;
  student_name: string;
  student_email: string;
  student_avatar?: string;
  submitted_at: string;
  submission_text?: string;
  file_path?: string;
  file_name?: string;
  file_size?: number;
  file_metadata?: any;
  external_url?: string;
  due_date?: string;
  days_late: number;
  late_penalty?: number;
  grade?: number;
  original_grade?: number;
  percentage?: number;
  letter_grade?: string;
  feedback?: string;
  rubric_scores?: { [criteriaId: string]: number };
  graded_at?: string;
  graded_by?: number;
  previous_attempts?: number;
  attempt_number?: number;
  is_resubmission?: boolean;
  plagiarism_score?: number;
  word_count?: number;
  reading_time?: number;
  submission_quality_score?: number;
  tags?: string[];
  priority_level?: 'low' | 'medium' | 'high';
  estimated_grading_time?: number;
  complexity_score?: number;
}

export interface GradingRubric {
  id: number;
  name: string;
  description: string;
  criteria: RubricCriterion[];
  total_points: number;
  grading_scale: GradingScale;
}

export interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  points: number;
  levels: RubricLevel[];
  weight?: number;
}

export interface RubricLevel {
  id: string;
  name: string;
  description: string;
  points: number;
  feedback_template?: string;
}

export interface GradingScale {
  A: { min: number; max: number };
  B: { min: number; max: number };
  C: { min: number; max: number };
  D: { min: number; max: number };
  F: { min: number; max: number };
}

export interface EnhancedGradeRequest {
  grade: number;
  feedback?: string;
  rubric_scores?: { [criteriaId: string]: number };
  private_notes?: string;
  late_penalty?: number;
  bonus_points?: number;
  feedback_template_id?: number;
  tags?: string[];
  return_for_revision?: boolean;
  notify_student?: boolean;
  schedule_release?: string;
}

export interface BulkGradeRequest {
  submissions: Array<{
    id: number;
    grade: number;
    feedback?: string;
    rubric_scores?: { [criteriaId: string]: number };
    tags?: string[];
  }>;
  apply_curve?: {
    type: 'linear' | 'bell' | 'custom';
    target_average?: number;
    std_deviation?: number;
  };
  late_penalty_policy?: {
    per_day_penalty: number;
    max_penalty: number;
    grace_period_days: number;
  };
}

export interface GradingAnalytics {
  summary: {
    total_pending: number;
    total_graded: number;
    average_grade: number;
    median_grade: number;
    completion_rate: number;
    average_grading_time: number;
    total_grading_time: number;
  };
  distribution: {
    grade_ranges: Array<{
      range: string;
      count: number;
      percentage: number;
    }>;
    letter_grades: { [letter: string]: number };
  };
  trends: {
    daily_grading: Array<{
      date: string;
      count: number;
      average_grade: number;
    }>;
    student_performance: Array<{
      student_id: number;
      student_name: string;
      average_grade: number;
      submissions_count: number;
      improvement_trend: 'improving' | 'declining' | 'stable';
    }>;
  };
  insights: {
    suggested_actions: string[];
    outliers: Array<{
      type: 'high_performer' | 'struggling' | 'late_submitter';
      student_id: number;
      student_name: string;
      details: string;
    }>;
    grading_efficiency: {
      average_time_per_submission: number;
      fastest_graded: number;
      slowest_graded: number;
      efficiency_score: number;
    };
  };
}

export interface FeedbackTemplate {
  id: number;
  name: string;
  content: string;
  category: 'positive' | 'needs_improvement' | 'excellent' | 'revision_required' | 'custom';
  grade_range?: {
    min: number;
    max: number;
  };
  auto_apply_conditions?: {
    grade_threshold?: number;
    rubric_criteria?: string[];
    keywords?: string[];
  };
  usage_count?: number;
  last_used?: string;
}

export interface GradingWorkflow {
  id: number;
  name: string;
  steps: WorkflowStep[];
  auto_assign_conditions?: {
    course_ids?: number[];
    assignment_types?: string[];
    submission_criteria?: any;
  };
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'auto_grade' | 'plagiarism_check' | 'quality_check' | 'manual_review' | 'feedback_generation';
  order: number;
  configuration: any;
  required: boolean;
}

export interface SmartGradingSuggestion {
  submission_id: number;
  suggested_grade: number;
  confidence_score: number;
  reasoning: string;
  factors: Array<{
    factor: string;
    weight: number;
    value: any;
    impact: 'positive' | 'negative' | 'neutral';
  }>;
  similar_submissions: Array<{
    id: number;
    grade: number;
    similarity_score: number;
  }>;
  improvement_areas: string[];
  strengths: string[];
}

export class EnhancedGradingService {
  private static readonly BASE_PATH = '/grading';
  private static cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  // =====================
  // CACHING UTILITIES
  // =====================
  
  private static getCacheKey(method: string, params: any): string {
    return `${method}_${JSON.stringify(params)}`;
  }

  private static setCache(key: string, data: any, ttl: number = 300000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private static getCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }
    if (cached) {
      this.cache.delete(key);
    }
    return null;
  }

  private static clearCache(pattern?: string): void {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  // =====================
  // ENHANCED SUBMISSION RETRIEVAL
  // =====================

  /**
   * Get assignment submissions with advanced filtering and caching
   */
  static async getEnhancedAssignmentSubmissions(
    filters: SubmissionFilters = {}
  ): Promise<{
    submissions: EnhancedAssignmentSubmission[];
    pagination: any;
    analytics: GradingAnalytics;
    suggestions: SmartGradingSuggestion[];
  }> {
    const cacheKey = this.getCacheKey('assignments', filters);
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await apiClient.get(`${this.BASE_PATH}/assignments/submissions/enhanced`, {
        params: filters
      });

      const result = response.data;
      this.setCache(cacheKey, result, 30000); // 30 seconds cache
      return result;
    } catch (error) {
      throw ApiErrorHandler.handle(error);
    }
  }

  /**
   * Get submission details with AI-powered insights
   */
  static async getSubmissionWithInsights(
    submissionId: number
  ): Promise<{
    submission: EnhancedAssignmentSubmission;
    insights: SmartGradingSuggestion;
    similar_submissions: EnhancedAssignmentSubmission[];
    feedback_suggestions: string[];
  }> {
    try {
      const response = await apiClient.get(
        `${this.BASE_PATH}/assignments/submissions/${submissionId}/insights`
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handle(error);
    }
  }

  // =====================
  // BULK OPERATIONS
  // =====================

  /**
   * Bulk grade submissions with advanced options
   */
  static async bulkGradeSubmissions(
    bulkGradeData: BulkGradeRequest
  ): Promise<{
    success_count: number;
    error_count: number;
    errors: any[];
    graded_submissions: EnhancedAssignmentSubmission[];
  }> {
    try {
      const response = await apiClient.post(
        `${this.BASE_PATH}/assignments/submissions/bulk-grade-enhanced`,
        bulkGradeData
      );

      // Clear related cache
      this.clearCache('assignments');
      this.clearCache('analytics');

      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handle(error);
    }
  }

  /**
   * Apply grading curve to multiple submissions
   */
  static async applyGradingCurve(
    submissionIds: number[],
    curveConfig: {
      type: 'linear' | 'bell' | 'square_root';
      target_average: number;
      preserve_order: boolean;
      minimum_grade: number;
      maximum_grade: number;
    }
  ): Promise<{
    original_grades: { id: number; grade: number }[];
    adjusted_grades: { id: number; grade: number }[];
    curve_applied: any;
  }> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/curve/apply`, {
        submission_ids: submissionIds,
        curve_config: curveConfig
      });

      this.clearCache('assignments');
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handle(error);
    }
  }

  // =====================
  // RUBRIC-BASED GRADING
  // =====================

  /**
   * Grade submission using rubric
   */
  static async gradeWithRubric(
    submissionId: number,
    rubricScores: { [criteriaId: string]: number },
    feedback?: string,
    privateNotes?: string
  ): Promise<{
    submission: EnhancedAssignmentSubmission;
    total_score: number;
    rubric_breakdown: any;
  }> {
    try {
      const response = await apiClient.post(
        `${this.BASE_PATH}/assignments/submissions/${submissionId}/grade-rubric`,
        {
          rubric_scores: rubricScores,
          feedback,
          private_notes: privateNotes
        }
      );

      this.clearCache('assignments');
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handle(error);
    }
  }

  /**
   * Get available rubrics for an assignment
   */
  static async getAssignmentRubrics(assignmentId: number): Promise<GradingRubric[]> {
    const cacheKey = this.getCacheKey('rubrics', assignmentId);
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await apiClient.get(`${this.BASE_PATH}/assignments/${assignmentId}/rubrics`);
      const rubrics = response.data.rubrics;
      this.setCache(cacheKey, rubrics, 600000); // 10 minutes cache
      return rubrics;
    } catch (error) {
      throw ApiErrorHandler.handle(error);
    }
  }

  // =====================
  // ANALYTICS & INSIGHTS
  // =====================

  /**
   * Get comprehensive grading analytics
   */
  static async getGradingAnalytics(
    filters: {
      course_id?: number;
      assignment_id?: number;
      date_range?: { start: string; end: string };
      include_predictions?: boolean;
    }
  ): Promise<GradingAnalytics> {
    const cacheKey = this.getCacheKey('analytics', filters);
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await apiClient.get(`${this.BASE_PATH}/analytics/comprehensive`, {
        params: filters
      });

      const analytics = response.data;
      this.setCache(cacheKey, analytics, 120000); // 2 minutes cache
      return analytics;
    } catch (error) {
      throw ApiErrorHandler.handle(error);
    }
  }

  /**
   * Get AI-powered grading suggestions
   */
  static async getGradingSuggestions(
    submissionId: number,
    options: {
      include_similar: boolean;
      confidence_threshold: number;
      explanation_detail: 'brief' | 'detailed';
    }
  ): Promise<SmartGradingSuggestion> {
    try {
      const response = await apiClient.get(
        `${this.BASE_PATH}/assignments/submissions/${submissionId}/ai-suggestions`,
        { params: options }
      );
      return response.data.suggestion;
    } catch (error) {
      throw ApiErrorHandler.handle(error);
    }
  }

  // =====================
  // FEEDBACK TEMPLATES
  // =====================

  /**
   * Get personalized feedback templates
   */
  static async getFeedbackTemplates(
    context: {
      assignment_type?: string;
      grade_range?: { min: number; max: number };
      student_performance_history?: 'improving' | 'declining' | 'consistent';
    }
  ): Promise<FeedbackTemplate[]> {
    const cacheKey = this.getCacheKey('templates', context);
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await apiClient.get(`${this.BASE_PATH}/feedback/templates`, {
        params: context
      });

      const templates = response.data.templates;
      this.setCache(cacheKey, templates, 300000); // 5 minutes cache
      return templates;
    } catch (error) {
      throw ApiErrorHandler.handle(error);
    }
  }

  /**
   * Generate AI-powered feedback
   */
  static async generateAIFeedback(
    submissionId: number,
    options: {
      tone: 'encouraging' | 'constructive' | 'detailed' | 'brief';
      focus_areas?: string[];
      include_suggestions: boolean;
      personalization_level: 'low' | 'medium' | 'high';
    }
  ): Promise<{
    feedback: string;
    highlights: string[];
    improvement_areas: string[];
    next_steps: string[];
    confidence_score: number;
  }> {
    try {
      const response = await apiClient.post(
        `${this.BASE_PATH}/assignments/submissions/${submissionId}/ai-feedback`,
        options
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handle(error);
    }
  }

  // =====================
  // WORKFLOW AUTOMATION
  // =====================

  /**
   * Create automated grading workflow
   */
  static async createGradingWorkflow(workflow: Omit<GradingWorkflow, 'id'>): Promise<GradingWorkflow> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/workflows`, workflow);
      return response.data.workflow;
    } catch (error) {
      throw ApiErrorHandler.handle(error);
    }
  }

  /**
   * Execute grading workflow on submission
   */
  static async executeWorkflow(
    workflowId: number,
    submissionIds: number[]
  ): Promise<{
    workflow_results: Array<{
      submission_id: number;
      steps_completed: number;
      final_result: any;
      execution_time: number;
    }>;
  }> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/workflows/${workflowId}/execute`, {
        submission_ids: submissionIds
      });
      
      this.clearCache('assignments');
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handle(error);
    }
  }

  // =====================
  // UTILITY METHODS
  // =====================

  /**
   * Calculate grade statistics
   */
  static calculateGradeStats(submissions: EnhancedAssignmentSubmission[]): {
    mean: number;
    median: number;
    mode: number;
    standardDeviation: number;
    range: { min: number; max: number };
    percentiles: { [percentile: string]: number };
  } {
    const grades = submissions
      .filter(s => s.grade !== undefined)
      .map(s => s.grade!)
      .sort((a, b) => a - b);

    if (grades.length === 0) {
      return {
        mean: 0, median: 0, mode: 0, standardDeviation: 0,
        range: { min: 0, max: 0 },
        percentiles: {}
      };
    }

    const mean = grades.reduce((sum, grade) => sum + grade, 0) / grades.length;
    const median = grades.length % 2 === 0
      ? (grades[Math.floor(grades.length / 2) - 1] + grades[Math.floor(grades.length / 2)]) / 2
      : grades[Math.floor(grades.length / 2)];

    const variance = grades.reduce((sum, grade) => sum + Math.pow(grade - mean, 2), 0) / grades.length;
    const standardDeviation = Math.sqrt(variance);

    // Calculate mode
    const frequency = new Map<number, number>();
    grades.forEach(grade => {
      frequency.set(grade, (frequency.get(grade) || 0) + 1);
    });
    const mode = [...frequency.entries()].reduce((a, b) => a[1] > b[1] ? a : b)[0];

    // Calculate percentiles
    const percentiles: { [percentile: string]: number } = {};
    [10, 25, 50, 75, 90, 95, 99].forEach(p => {
      const index = Math.ceil((p / 100) * grades.length) - 1;
      percentiles[`p${p}`] = grades[Math.max(0, index)];
    });

    return {
      mean: Math.round(mean * 100) / 100,
      median,
      mode,
      standardDeviation: Math.round(standardDeviation * 100) / 100,
      range: { min: Math.min(...grades), max: Math.max(...grades) },
      percentiles
    };
  }

  /**
   * Get enhanced letter grade with detailed breakdown
   */
  static getEnhancedLetterGrade(percentage: number, scale?: GradingScale): {
    letter: string;
    gpa: number;
    description: string;
    color: string;
  } {
    const defaultScale = scale || {
      A: { min: 90, max: 100 },
      B: { min: 80, max: 89 },
      C: { min: 70, max: 79 },
      D: { min: 60, max: 69 },
      F: { min: 0, max: 59 }
    };

    for (const [letter, range] of Object.entries(defaultScale)) {
      if (percentage >= range.min && percentage <= range.max) {
        const gradeInfo = {
          A: { gpa: 4.0, description: 'Excellent', color: 'text-green-600' },
          B: { gpa: 3.0, description: 'Good', color: 'text-blue-600' },
          C: { gpa: 2.0, description: 'Satisfactory', color: 'text-yellow-600' },
          D: { gpa: 1.0, description: 'Needs Improvement', color: 'text-orange-600' },
          F: { gpa: 0.0, description: 'Failing', color: 'text-red-600' }
        };

        return {
          letter,
          ...gradeInfo[letter as keyof typeof gradeInfo]
        };
      }
    }

    return { letter: 'F', gpa: 0.0, description: 'Failing', color: 'text-red-600' };
  }

  /**
   * Estimate grading time based on submission complexity
   */
  static estimateGradingTime(submission: EnhancedAssignmentSubmission): {
    estimated_minutes: number;
    complexity_factors: Array<{ factor: string; impact: number; reason: string }>;
    confidence: number;
  } {
    const factors = [];
    let totalTime = 10; // Base time in minutes

    // Word count factor
    if (submission.word_count) {
      const wordTimeFactor = Math.max(1, submission.word_count / 500) * 2;
      factors.push({
        factor: 'Word Count',
        impact: wordTimeFactor,
        reason: `${submission.word_count} words require additional reading time`
      });
      totalTime += wordTimeFactor;
    }

    // File attachments factor
    if (submission.file_metadata) {
      const fileTime = Object.keys(submission.file_metadata).length * 3;
      factors.push({
        factor: 'File Attachments',
        impact: fileTime,
        reason: 'Multiple files require additional review time'
      });
      totalTime += fileTime;
    }

    // Late submission factor
    if (submission.days_late > 0) {
      const lateTime = Math.min(submission.days_late * 0.5, 3);
      factors.push({
        factor: 'Late Submission',
        impact: lateTime,
        reason: 'Late submissions may require policy considerations'
      });
      totalTime += lateTime;
    }

    // Previous attempts factor
    if (submission.previous_attempts && submission.previous_attempts > 1) {
      const attemptTime = Math.min(submission.previous_attempts * 2, 8);
      factors.push({
        factor: 'Multiple Attempts',
        impact: attemptTime,
        reason: 'Comparing with previous submissions takes additional time'
      });
      totalTime += attemptTime;
    }

    return {
      estimated_minutes: Math.round(totalTime),
      complexity_factors: factors,
      confidence: Math.max(0.6, 1 - (factors.length * 0.1))
    };
  }

  // =====================
  // REAL-TIME UPDATES
  // =====================

  /**
   * Subscribe to real-time grading updates
   */
  static subscribeToGradingUpdates(
    callback: (update: {
      type: 'submission_graded' | 'new_submission' | 'grade_updated';
      data: any;
    }) => void
  ): () => void {
    // Implementation would depend on WebSocket setup
    // This is a placeholder for the subscription mechanism
    
    const eventSource = new EventSource('/api/v1/grading/stream');
    
    eventSource.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data);
        callback(update);
        
        // Clear relevant cache when updates occur
        this.clearCache('assignments');
        this.clearCache('analytics');
      } catch (error) {
        console.error('Error processing grading update:', error);
      }
    };

    return () => {
      eventSource.close();
    };
  }
}

export default EnhancedGradingService;