/**
 * Assessment API Service
 * Handles quizzes, assignments, and adaptive assessments
 */

import BaseApiService, { ApiResponse } from './base.service';
import {
  Quiz,
  QuizAttempt,
  QuizAnswer,
  Assignment,
  AssignmentSubmission,
  CodeExecutionResult,
} from './types';

class AssessmentApiService extends BaseApiService {
  // ==================== QUIZ METHODS ====================

  /**
   * Get quiz details
   */
  async getQuiz(quizId: number): Promise<Quiz> {
    return this.get<Quiz>(`/assessments/quizzes/${quizId}`);
  }

  /**
   * Start a quiz attempt
   */
  async startQuiz(quizId: number): Promise<{
    attempt_id: number;
    quiz: Quiz;
    start_time: string;
    time_limit: number;
  }> {
    return this.post(`/assessments/quizzes/${quizId}/start`);
  }

  /**
   * Submit quiz answers
   */
  async submitQuiz(attemptId: number, answers: QuizAnswer[]): Promise<{
    score: number;
    max_score: number;
    percentage: number;
    passed: boolean;
    feedback: {
      question_id: number;
      correct: boolean;
      explanation: string;
    }[];
  }> {
    return this.post(`/assessments/quiz-attempts/${attemptId}/submit`, {
      answers
    });
  }

  /**
   * Get quiz attempt history
   */
  async getQuizAttempts(quizId: number): Promise<QuizAttempt[]> {
    return this.get<QuizAttempt[]>(`/assessments/quizzes/${quizId}/attempts`);
  }

  /**
   * Get adaptive quiz (difficulty adjusts based on performance)
   */
  async getAdaptiveQuiz(moduleId: number, currentPerformance: number): Promise<Quiz> {
    return this.get<Quiz>('/assessments/adaptive-quiz', {
      params: {
        module_id: moduleId,
        performance: currentPerformance
      }
    });
  }

  // ==================== ASSIGNMENT METHODS ====================

  /**
   * Get assignment details
   */
  async getAssignment(assignmentId: number): Promise<Assignment> {
    return this.get<Assignment>(`/assessments/assignments/${assignmentId}`);
  }

  /**
   * Submit assignment
   */
  async submitAssignment(assignmentId: number, data: {
    content?: string;
    file?: File;
    url?: string;
  }): Promise<ApiResponse<{
    submission_id: number;
    status: string;
    submitted_at: string;
  }>> {
    const formData = new FormData();
    
    if (data.content) {
      formData.append('content', data.content);
    }
    if (data.file) {
      formData.append('file', data.file);
    }
    if (data.url) {
      formData.append('url', data.url);
    }

    return this.post(`/assessments/assignments/${assignmentId}/submit`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  /**
   * Get assignment submission status
   */
  async getSubmissionStatus(submissionId: number): Promise<AssignmentSubmission> {
    return this.get<AssignmentSubmission>(`/assessments/submissions/${submissionId}`);
  }

  /**
   * Get assignment submissions for student
   */
  async getMySubmissions(assignmentId: number): Promise<AssignmentSubmission[]> {
    return this.get<AssignmentSubmission[]>(`/assessments/assignments/${assignmentId}/my-submissions`);
  }

  /**
   * Request AI feedback on assignment
   */
  async requestAiFeedback(submissionId: number): Promise<{
    feedback: string;
    suggestions: string[];
    estimated_score: number;
    strengths: string[];
    areas_for_improvement: string[];
  }> {
    return this.post(`/assessments/submissions/${submissionId}/ai-feedback`);
  }

  // ==================== CODE CHALLENGES ====================

  /**
   * Execute code in sandbox
   */
  async executeCode(data: {
    language: string;
    code: string;
    test_cases?: any[];
    timeout?: number;
  }): Promise<CodeExecutionResult> {
    return this.post<CodeExecutionResult>('/code-sandbox/execute', data);
  }

  /**
   * Submit coding challenge solution
   */
  async submitCodingChallenge(challengeId: number, code: string): Promise<{
    success: boolean;
    test_results: {
      total_tests: number;
      passed_tests: number;
      failed_tests: number;
      details: any[];
    };
    score: number;
    feedback: string;
  }> {
    return this.post(`/assessments/coding-challenges/${challengeId}/submit`, {
      code
    });
  }

  /**
   * Get coding challenge details
   */
  async getCodingChallenge(challengeId: number): Promise<{
    id: number;
    title: string;
    description: string;
    difficulty: string;
    language: string;
    starter_code: string;
    test_cases: any[];
    hints: string[];
    time_limit: number;
  }> {
    return this.get(`/assessments/coding-challenges/${challengeId}`);
  }

  // ==================== MODULE COMPLETION ====================

  /**
   * Calculate and submit module completion score
   */
  async submitModuleCompletion(moduleId: number): Promise<{
    passed: boolean;
    cumulative_score: number;
    breakdown: {
      course_contribution: number;
      quizzes: number;
      assignments: number;
      final_assessment: number;
    };
    can_proceed: boolean;
    next_module?: {
      id: number;
      title: string;
    };
  }> {
    return this.post(`/assessments/module-completion/${moduleId}`);
  }

  /**
   * Get module readiness check (are all assessments completed?)
   */
  async checkModuleReadiness(moduleId: number): Promise<{
    ready: boolean;
    missing_items: string[];
    completion_percentage: number;
    estimated_score: number;
  }> {
    return this.get(`/assessments/module-readiness/${moduleId}`);
  }

  // ==================== PEER REVIEW ====================

  /**
   * Submit work for peer review
   */
  async submitForPeerReview(assignmentId: number, submissionId: number): Promise<ApiResponse> {
    return this.post(`/assessments/peer-review/submit`, {
      assignment_id: assignmentId,
      submission_id: submissionId
    });
  }

  /**
   * Get assignments to peer review
   */
  async getAssignmentsToReview(): Promise<Array<{
    id: number;
    assignment_title: string;
    submission_content: string;
    rubric: any;
    deadline: string;
  }>> {
    return this.get('/assessments/peer-review/to-review');
  }

  /**
   * Submit peer review
   */
  async submitPeerReview(reviewId: number, data: {
    scores: { criterion_id: number; score: number }[];
    feedback: string;
    strengths: string[];
    improvements: string[];
  }): Promise<ApiResponse> {
    return this.post(`/assessments/peer-review/${reviewId}/submit`, data);
  }

  // ==================== PRACTICE & RETAKES ====================

  /**
   * Get practice questions for a topic
   */
  async getPracticeQuestions(topicId: number, difficulty?: string): Promise<{
    questions: any[];
    topic: string;
  }> {
    return this.get('/assessments/practice', {
      params: { topic_id: topicId, difficulty }
    });
  }

  /**
   * Check retake eligibility
   */
  async checkRetakeEligibility(moduleId: number): Promise<{
    can_retake: boolean;
    attempts_used: number;
    max_attempts: number;
    reason?: string;
  }> {
    return this.get(`/assessments/retake-eligibility/${moduleId}`);
  }

  /**
   * Initiate module retake
   */
  async retakeModule(moduleId: number): Promise<ApiResponse<{
    attempt_number: number;
    reset_items: string[];
  }>> {
    return this.post(`/assessments/retake/${moduleId}`);
  }

  // ==================== ANALYTICS ====================

  /**
   * Get assessment analytics
   */
  async getAssessmentAnalytics(moduleId?: number): Promise<{
    quiz_performance: {
      average_score: number;
      attempts: number;
      time_spent: number;
    };
    assignment_performance: {
      average_score: number;
      on_time_submissions: number;
      late_submissions: number;
    };
    strengths: string[];
    weaknesses: string[];
    recommended_practice: string[];
  }> {
    const url = moduleId 
      ? `/assessments/analytics?module_id=${moduleId}`
      : '/assessments/analytics';
    return this.get(url);
  }
}

export default new AssessmentApiService();
