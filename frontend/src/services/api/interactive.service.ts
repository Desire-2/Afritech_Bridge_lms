/**
 * Interactive Learning API Service
 * Handles AI recommendations, simulations, and interactive features
 */

import BaseApiService, { ApiResponse } from './base.service';
import { LearningRecommendation } from './types';

class InteractiveLearningApiService extends BaseApiService {
  // ==================== AI RECOMMENDATIONS ====================

  /**
   * Get AI-powered personalized recommendations
   */
  async getAiRecommendations(context?: {
    current_course?: number;
    current_module?: number;
    performance_level?: number;
  }): Promise<{
    recommendations: LearningRecommendation[];
    reasoning: string;
    confidence: number;
  }> {
    return this.post('/ai/recommendations', context);
  }

  /**
   * Get content recommendations based on struggle patterns
   */
  async getStruggleBasedRecommendations(): Promise<{
    struggling_areas: Array<{
      topic: string;
      difficulty_score: number;
      recommended_resources: Array<{
        type: 'video' | 'article' | 'practice' | 'tutoring';
        title: string;
        url: string;
        estimated_time: string;
      }>;
    }>;
  }> {
    return this.get('/ai/struggle-recommendations');
  }

  /**
   * Ask AI learning assistant a question
   */
  async askAiAssistant(data: {
    question: string;
    context?: {
      course_id?: number;
      module_id?: number;
      lesson_id?: number;
    };
    conversation_history?: Array<{
      role: 'user' | 'assistant';
      content: string;
    }>;
  }): Promise<{
    answer: string;
    sources: string[];
    follow_up_questions: string[];
    confidence: number;
  }> {
    return this.post('/ai/assistant/ask', data);
  }

  /**
   * Get real-time help based on current activity
   */
  async requestContextualHelp(data: {
    activity_type: 'quiz' | 'assignment' | 'lesson' | 'coding';
    activity_id: number;
    specific_question?: string;
    stuck_time: number; // seconds stuck on this
  }): Promise<{
    help_type: 'hint' | 'explanation' | 'example' | 'video';
    content: string;
    additional_resources: string[];
  }> {
    return this.post('/ai/contextual-help', data);
  }

  // ==================== STUDY GROUP MATCHING ====================

  /**
   * Find study group matches
   */
  async findStudyGroups(courseId: number): Promise<Array<{
    group_id: number;
    name: string;
    members_count: number;
    learning_style: string;
    schedule: string;
    match_score: number;
  }>> {
    return this.get(`/social/study-groups/find`, {
      params: { course_id: courseId }
    });
  }

  /**
   * Create study group
   */
  async createStudyGroup(data: {
    name: string;
    course_id: number;
    description: string;
    max_members: number;
    learning_style: string;
    schedule: string;
  }): Promise<ApiResponse<{
    group_id: number;
  }>> {
    return this.post('/social/study-groups', data);
  }

  /**
   * Join study group
   */
  async joinStudyGroup(groupId: number): Promise<ApiResponse> {
    return this.post(`/social/study-groups/${groupId}/join`);
  }

  // ==================== INTERACTIVE SIMULATIONS ====================

  /**
   * Get simulation details
   */
  async getSimulation(simulationId: number): Promise<{
    id: number;
    title: string;
    description: string;
    type: 'business' | 'science' | 'engineering' | 'data';
    initial_state: any;
    scenarios: any[];
    learning_objectives: string[];
  }> {
    return this.get(`/simulations/${simulationId}`);
  }

  /**
   * Submit simulation action
   */
  async submitSimulationAction(simulationId: number, action: any): Promise<{
    new_state: any;
    feedback: string;
    score_impact: number;
    continue: boolean;
  }> {
    return this.post(`/simulations/${simulationId}/action`, action);
  }

  /**
   * Complete simulation
   */
  async completeSimulation(simulationId: number, finalState: any): Promise<{
    score: number;
    feedback: string;
    performance_breakdown: any;
    certificate_earned: boolean;
  }> {
    return this.post(`/simulations/${simulationId}/complete`, {
      final_state: finalState
    });
  }

  // ==================== VIRTUAL LABS ====================

  /**
   * Get virtual lab environment
   */
  async getVirtualLab(labId: number): Promise<{
    id: number;
    title: string;
    equipment: any[];
    procedures: string[];
    safety_notes: string[];
    expected_outcomes: string[];
  }> {
    return this.get(`/virtual-labs/${labId}`);
  }

  /**
   * Record lab activity
   */
  async recordLabActivity(labId: number, activity: {
    action: string;
    equipment_used: string[];
    observations: string;
    data_collected: any;
  }): Promise<{
    validation: boolean;
    feedback: string;
    next_step?: string;
  }> {
    return this.post(`/virtual-labs/${labId}/activity`, activity);
  }

  /**
   * Submit lab report
   */
  async submitLabReport(labId: number, report: {
    observations: string;
    data: any;
    analysis: string;
    conclusions: string;
  }): Promise<{
    score: number;
    feedback: string;
    areas_of_excellence: string[];
    areas_for_improvement: string[];
  }> {
    return this.post(`/virtual-labs/${labId}/submit-report`, report);
  }

  // ==================== COLLABORATIVE WHITEBOARD ====================

  /**
   * Create collaborative session
   */
  async createCollaborativeSession(data: {
    title: string;
    course_id: number;
    max_participants: number;
    duration: number;
  }): Promise<{
    session_id: string;
    join_url: string;
    access_code: string;
  }> {
    return this.post('/collaborative/sessions', data);
  }

  /**
   * Join collaborative session
   */
  async joinCollaborativeSession(sessionId: string, accessCode?: string): Promise<{
    websocket_url: string;
    session_data: any;
    participants: any[];
  }> {
    return this.post(`/collaborative/sessions/${sessionId}/join`, {
      access_code: accessCode
    });
  }

  // ==================== GAMIFICATION ====================

  /**
   * Get gamification stats
   */
  async getGamificationStats(): Promise<{
    level: number;
    xp: number;
    xp_to_next_level: number;
    streak: number;
    badges: any[];
    leaderboard_position: number;
    achievements: any[];
  }> {
    return this.get('/gamification/stats');
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(scope: 'global' | 'course' | 'class', scopeId?: number): Promise<Array<{
    rank: number;
    student_name: string;
    points: number;
    badges: number;
    courses_completed: number;
  }>> {
    return this.get('/gamification/leaderboard', {
      params: { scope, scope_id: scopeId }
    });
  }

  // ==================== LEARNING PATH OPTIMIZATION ====================

  /**
   * Get optimized learning path
   */
  async getOptimizedLearningPath(goalId: number): Promise<{
    path: Array<{
      step: number;
      course_id: number;
      course_title: string;
      estimated_duration: string;
      prerequisites_met: boolean;
      reasoning: string;
    }>;
    total_duration: string;
    skill_outcomes: string[];
  }> {
    return this.get(`/ai/learning-path/${goalId}`);
  }

  /**
   * Get next best action recommendation
   */
  async getNextBestAction(): Promise<{
    action_type: 'continue_course' | 'review_material' | 'take_practice_quiz' | 'rest';
    course_id?: number;
    module_id?: number;
    reason: string;
    priority: 'high' | 'medium' | 'low';
  }> {
    return this.get('/ai/next-best-action');
  }

  // ==================== PORTFOLIO BUILDER ====================

  /**
   * Get student portfolio
   */
  async getPortfolio(): Promise<{
    projects: Array<{
      id: number;
      title: string;
      description: string;
      course: string;
      completion_date: string;
      grade: number;
      skills: string[];
      artifacts: string[];
    }>;
    skills_demonstrated: string[];
    certificates: any[];
    total_hours: number;
  }> {
    return this.get('/student/portfolio');
  }

  /**
   * Add project to portfolio
   */
  async addToPortfolio(projectId: number, data: {
    title: string;
    description: string;
    visibility: 'public' | 'private' | 'recruiters';
    showcase_artifacts: string[];
  }): Promise<ApiResponse> {
    return this.post('/student/portfolio/projects', {
      project_id: projectId,
      ...data
    });
  }

  /**
   * Export portfolio
   */
  async exportPortfolio(format: 'pdf' | 'linkedin' | 'json'): Promise<Blob | any> {
    const response = await this.api.get('/student/portfolio/export', {
      params: { format },
      responseType: format === 'json' ? 'json' : 'blob'
    });
    return response.data;
  }
}

export default new InteractiveLearningApiService();
