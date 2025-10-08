/**
 * Progress API Service
 * Handles all student progress tracking and analytics
 */

import BaseApiService, { ApiResponse } from './base.service';
import {
  ProgressOverview,
  LearningAnalytics,
  CourseProgress,
  ModuleProgress,
  ModuleData,
} from './types';

class ProgressApiService extends BaseApiService {
  /**
   * Get comprehensive progress overview for student dashboard
   */
  async getProgressOverview(): Promise<ProgressOverview> {
    return this.get<ProgressOverview>('/student/progress');
  }

  /**
   * Get detailed progress for a specific course
   */
  async getCourseProgress(courseId: number): Promise<CourseProgress> {
    return this.get<CourseProgress>(`/student/progress/course/${courseId}`);
  }

  /**
   * Get progress for a specific module
   */
  async getModuleProgress(moduleId: number): Promise<ModuleData> {
    return this.get<ModuleData>(`/student/progress/module/${moduleId}`);
  }

  /**
   * Record lesson completion
   */
  async completeLesson(lessonId: number, data: {
    time_spent: number;
    score?: number;
    notes?: string;
  }): Promise<ApiResponse> {
    return this.post(`/student/progress/lesson/${lessonId}/complete`, data);
  }

  /**
   * Get learning analytics with trends
   */
  async getLearningAnalytics(timeframe?: '7d' | '30d' | '90d' | 'all'): Promise<LearningAnalytics> {
    return this.get<LearningAnalytics>('/student/analytics', {
      params: { timeframe: timeframe || '30d' }
    });
  }

  /**
   * Get skill breakdown and proficiency mapping
   */
  async getSkillBreakdown(): Promise<{
    skills: Array<{
      name: string;
      proficiency: number;
      courses_completed: number;
      hours_spent: number;
      trend: 'improving' | 'stable' | 'declining';
    }>;
    radar_chart_data: {
      labels: string[];
      values: number[];
    };
  }> {
    return this.get('/student/analytics/skills');
  }

  /**
   * Get learning velocity (progress over time)
   */
  async getLearningVelocity(courseId?: number): Promise<{
    daily_progress: Array<{
      date: string;
      lessons_completed: number;
      time_spent: number;
      score_average: number;
    }>;
    weekly_summary: {
      current_week: number;
      previous_week: number;
      trend: 'up' | 'down' | 'stable';
    };
  }> {
    const url = courseId 
      ? `/student/analytics/velocity?course_id=${courseId}`
      : '/student/analytics/velocity';
    return this.get(url);
  }

  /**
   * Get time-based analytics
   */
  async getTimeAnalytics(): Promise<{
    total_learning_hours: number;
    daily_average: number;
    weekly_average: number;
    monthly_average: number;
    most_active_day: string;
    most_active_hour: number;
    time_by_course: Array<{
      course_id: number;
      course_title: string;
      hours_spent: number;
    }>;
  }> {
    return this.get('/student/analytics/time');
  }

  /**
   * Get weak areas for targeted improvement
   */
  async getWeakAreas(): Promise<{
    weak_topics: Array<{
      topic: string;
      course_id: number;
      course_title: string;
      average_score: number;
      attempts: number;
      recommendation: string;
    }>;
    suggested_practice: Array<{
      lesson_id: number;
      lesson_title: string;
      reason: string;
    }>;
  }> {
    return this.get('/student/analytics/weak-areas');
  }

  /**
   * Get strong areas (student's best subjects)
   */
  async getStrongAreas(): Promise<{
    strong_topics: Array<{
      topic: string;
      average_score: number;
      mastery_level: number;
    }>;
  }> {
    return this.get('/student/analytics/strong-areas');
  }

  /**
   * Get performance trends
   */
  async getPerformanceTrends(courseId?: number): Promise<{
    overall_trend: 'improving' | 'stable' | 'declining';
    score_history: Array<{
      date: string;
      score: number;
      assessment_type: string;
    }>;
    predictions: {
      next_module_estimated_score: number;
      completion_likelihood: number;
    };
  }> {
    const url = courseId
      ? `/student/analytics/trends?course_id=${courseId}`
      : '/student/analytics/trends';
    return this.get(url);
  }

  /**
   * Export progress report (PDF/CSV)
   */
  async exportProgressReport(format: 'pdf' | 'csv' = 'pdf'): Promise<Blob> {
    const response = await this.api.get(`/student/progress/export`, {
      params: { format },
      responseType: 'blob'
    });
    return response.data;
  }
}

export default new ProgressApiService();
