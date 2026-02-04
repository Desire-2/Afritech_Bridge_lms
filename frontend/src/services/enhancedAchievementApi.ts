// Enhanced Achievement API Service with better error handling and type safety
// Replaces achievementApi.ts with improved functionality

import axios from 'axios';
import { ApiErrorHandler } from './ApiErrorHandler';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';

// Comprehensive type definitions
export interface Achievement {
  id: number;
  name: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  tier: string;
  points: number;
  xp_bonus: number;
  rarity: string;
  is_repeatable: boolean;
  is_seasonal: boolean;
  season_end?: string;
  current_earners: number;
  max_earners?: number;
  criteria_type?: string;
  criteria_value?: number;
  share_text?: string;
  is_hidden?: boolean;
}

export interface UserAchievement {
  id: number;
  user_id: number;
  achievement: Achievement;
  earned_at: string;
  progress: number;
  times_earned: number;
  context_data: Record<string, any>;
  is_showcased: boolean;
  showcase_order: number;
  shared_count: number;
  course?: {
    id: number;
    title: string;
    description: string;
  };
}

export interface LearningStreak {
  id: number;
  user_id: number;
  current_streak: number;
  last_activity_date?: string;
  longest_streak: number;
  longest_streak_start?: string;
  longest_streak_end?: string;
  total_active_days: number;
  total_lessons_completed: number;
  total_time_minutes: number;
  milestones_reached: number[];
  streak_freezes_available: number;
  last_freeze_used?: string;
}

export interface StudentPoints {
  id: number;
  user_id: number;
  total_points: number;
  lesson_points: number;
  quiz_points: number;
  assignment_points: number;
  streak_points: number;
  achievement_points: number;
  social_points: number;
  bonus_points: number;
  total_xp: number;
  current_level: number;
  xp_to_next_level: number;
  global_rank?: number;
  course_ranks: Record<number, number>;
  points_this_week: number;
  points_this_month: number;
  point_multiplier: number;
  multiplier_expires_at?: string;
}

export interface Quest {
  id: number;
  name: string;
  title: string;
  description: string;
  challenge_type: string;
  difficulty: string;
  objectives: Array<{
    key: string;
    title: string;
    description: string;
    target: number;
    current?: number;
  }>;
  start_date: string;
  end_date: string;
  completion_points: number;
  completion_xp: number;
  special_reward?: string;
  icon: string;
  color_theme: string;
  current_participants: number;
  completion_count: number;
  is_available: boolean;
  user_progress?: QuestProgress;
}

export interface QuestProgress {
  id: number;
  user_id: number;
  quest: Quest;
  started_at: string;
  completed_at?: string;
  progress_data: Record<string, any>;
  completion_percentage: number;
  status: 'in_progress' | 'completed' | 'expired' | 'abandoned';
}

export interface AchievementSummary {
  points: StudentPoints;
  streak: LearningStreak;
  achievements: {
    total_earned: number;
    total_available: number;
    completion_rate: number;
    by_category: Record<string, number>;
    by_tier: Record<string, number>;
    recent: UserAchievement[];
    showcased: UserAchievement[];
  };
  milestones: {
    total_reached: number;
    recent: any[];
  };
}

export interface PaginatedResponse<T> {
  success: boolean;
  data?: T[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
  total: number;
}

class EnhancedAchievementApiService {
  private apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
  });

  constructor() {
    // Add request interceptor for auth
    this.apiClient.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Add response interceptor for error handling
    this.apiClient.interceptors.response.use(
      (response) => response,
      (error) => Promise.reject(ApiErrorHandler.handleError(error))
    );
  }

  /**
   * Get all available achievements with pagination
   */
  async getAchievements(options?: {
    page?: number;
    per_page?: number;
    category?: string;
  }): Promise<PaginatedResponse<Achievement> & { by_category: Record<string, Achievement[]> }> {
    try {
      const params = new URLSearchParams();
      if (options?.page) params.append('page', options.page.toString());
      if (options?.per_page) params.append('per_page', options.per_page.toString());
      if (options?.category) params.append('category', options.category);

      const response = await this.apiClient.get(`/achievements?${params.toString()}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch achievements: ${error}`);
    }
  }

  /**
   * Get earned achievements with pagination
   */
  async getEarnedAchievements(options?: {
    page?: number;
    per_page?: number;
  }): Promise<PaginatedResponse<UserAchievement>> {
    try {
      const params = new URLSearchParams();
      if (options?.page) params.append('page', options.page.toString());
      if (options?.per_page) params.append('per_page', options.per_page.toString());

      const response = await this.apiClient.get(`/achievements/earned?${params.toString()}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch earned achievements: ${error}`);
    }
  }

  /**
   * Get comprehensive achievement summary
   */
  async getAchievementSummary(): Promise<{ success: boolean; data: AchievementSummary }> {
    try {
      const response = await this.apiClient.get('/achievements/summary');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch achievement summary: ${error}`);
    }
  }

  /**
   * Get learning streak
   */
  async getStreak(): Promise<{ success: boolean; streak: LearningStreak }> {
    try {
      const response = await this.apiClient.get('/achievements/streak');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch streak: ${error}`);
    }
  }

  /**
   * Update learning streak
   */
  async updateStreak(): Promise<{
    current_streak: number;
    new_milestones: number[];
    new_achievements: UserAchievement[];
  }> {
    try {
      const response = await this.apiClient.post('/achievements/streak/update');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to update streak: ${error}`);
    }
  }

  /**
   * Get student points
   */
  async getPoints(): Promise<{ success: boolean; points: StudentPoints }> {
    try {
      const response = await this.apiClient.get('/achievements/points');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch points: ${error}`);
    }
  }

  /**
   * Get points breakdown/history
   */
  async getPointsHistory(): Promise<{
    success: boolean;
    breakdown: Record<string, number>;
    total: number;
  }> {
    try {
      const response = await this.apiClient.get('/achievements/points/history');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch points history: ${error}`);
    }
  }

  /**
   * Showcase/unshowcase an achievement
   */
  async showcaseAchievement(achievementId: number, showcase: boolean = true): Promise<{
    success: boolean;
    message: string;
    achievement: UserAchievement;
  }> {
    try {
      const response = await this.apiClient.post(`/achievements/${achievementId}/showcase`, {
        showcase
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to update achievement showcase: ${error}`);
    }
  }

  /**
   * Share an achievement
   */
  async shareAchievement(achievementId: number): Promise<{
    success: boolean;
    message: string;
    share_count: number;
  }> {
    try {
      const response = await this.apiClient.post(`/achievements/${achievementId}/share`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to share achievement: ${error}`);
    }
  }

  /**
   * Get available quests
   */
  async getQuests(): Promise<{ success: boolean; quests: Quest[] }> {
    try {
      const response = await this.apiClient.get('/achievements/quests');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch quests: ${error}`);
    }
  }

  /**
   * Start a quest
   */
  async startQuest(questId: number): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const response = await this.apiClient.post(`/achievements/quests/${questId}/start`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to start quest: ${error}`);
    }
  }

  /**
   * Trigger achievement check manually (for testing)
   */
  async triggerAchievementCheck(eventType: string, eventData: Record<string, any> = {}): Promise<{
    success: boolean;
    new_achievements: UserAchievement[];
    new_milestones: any[];
    message: string;
  }> {
    try {
      const response = await this.apiClient.post('/achievements/trigger', {
        event_type: eventType,
        event_data: eventData
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to trigger achievement check: ${error}`);
    }
  }

  /**
   * Get achievement statistics
   */
  async getAchievementStats(): Promise<{
    success: boolean;
    stats: {
      points: StudentPoints;
      streak: LearningStreak;
      achievements_count: number;
      milestones_count: number;
      recent_achievements: UserAchievement[];
      recent_milestones: any[];
    };
  }> {
    try {
      const response = await this.apiClient.get('/achievements/stats');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch achievement stats: ${error}`);
    }
  }
}

// Create singleton instance
const achievementApiService = new EnhancedAchievementApiService();

export { achievementApiService as AchievementApiService };
export default achievementApiService;