// Achievement API Service - Frontend API calls for gamification features
// Handles achievements, streaks, leaderboards, quests, and points

import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';

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
  is_hidden?: boolean;
}

export interface UserAchievement {
  id: number;
  user_id: number;
  achievement: Achievement;
  earned_at: string;
  progress: number;
  times_earned: number;
  context_data: any;
  is_showcased: boolean;
  showcase_order: number;
  shared_count: number;
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
  course_ranks: { [courseId: number]: number };
  points_this_week: number;
  points_this_month: number;
  point_multiplier: number;
  multiplier_expires_at?: string;
}

export interface Milestone {
  id: number;
  name: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  milestone_type: string;
  scope: string;
  criteria_type: string;
  criteria_value: number;
  course_id?: number;
  points_reward: number;
  badge_id?: number;
  celebration_message?: string;
  is_major: boolean;
  reached?: boolean;
}

export interface Leaderboard {
  id: number;
  name: string;
  title: string;
  description?: string;
  metric: string;
  time_period: string;
  scope: string;
  course_id?: number;
  icon: string;
  color: string;
  max_displayed: number;
  last_updated: string;
}

export interface LeaderboardRanking {
  rank: number;
  user_id: number;
  name: string;
  username: string;
  score: number;
  period_score?: number;
}

export interface Quest {
  id: number;
  name: string;
  title: string;
  description: string;
  challenge_type: string;
  difficulty: string;
  objectives: any[];
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
  progress_data: any;
  completion_percentage: number;
  status: string;
}

class AchievementApiService {
  private getAuthHeaders() {
    // Use 'token' key to match the rest of the app
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return {
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json'
      }
    };
  }

  // ==================== Achievement Methods ====================

  async getAllAchievements(): Promise<{ achievements: Achievement[]; by_category: any; total: number; success: boolean }> {
    const response = await axios.get(
      `${API_BASE_URL}/achievements/`,
      this.getAuthHeaders()
    );
    return response.data;
  }

  async getEarnedAchievements(): Promise<{ achievements: UserAchievement[]; total: number; success: boolean }> {
    const response = await axios.get(
      `${API_BASE_URL}/achievements/earned`,
      this.getAuthHeaders()
    );
    return response.data;
  }

  async getAchievementsSummary(): Promise<{ success: boolean; data: any }> {
    const response = await axios.get(
      `${API_BASE_URL}/achievements/summary`,
      this.getAuthHeaders()
    );
    return response.data;
  }

  async toggleShowcase(achievementId: number, showcase: boolean): Promise<UserAchievement> {
    const response = await axios.post(
      `${API_BASE_URL}/achievements/${achievementId}/showcase`,
      { showcase },
      this.getAuthHeaders()
    );
    return response.data.achievement;
  }

  async shareAchievement(achievementId: number): Promise<{ share_text: string; shared_count: number }> {
    const response = await axios.post(
      `${API_BASE_URL}/achievements/${achievementId}/share`,
      {},
      this.getAuthHeaders()
    );
    return response.data;
  }

  // ==================== Streak Methods ====================

  async getStreak(): Promise<{ streak: LearningStreak; success: boolean }> {
    const response = await axios.get(
      `${API_BASE_URL}/achievements/streak`,
      this.getAuthHeaders()
    );
    return response.data;
  }

  async updateStreak(): Promise<{
    current_streak: number;
    new_milestones: number[];
    new_achievements: UserAchievement[];
  }> {
    const response = await axios.post(
      `${API_BASE_URL}/achievements/streak/update`,
      {},
      this.getAuthHeaders()
    );
    return response.data;
  }

  // ==================== Points Methods ====================

  async getPoints(): Promise<{ points: StudentPoints }> {
    const response = await axios.get(
      `${API_BASE_URL}/achievements/points`,
      this.getAuthHeaders()
    );
    return response.data;
  }

  async getPointsHistory(): Promise<{ breakdown: any; total: number }> {
    const response = await axios.get(
      `${API_BASE_URL}/achievements/points/history`,
      this.getAuthHeaders()
    );
    return response.data;
  }

  // ==================== Milestone Methods ====================

  async getMilestones(): Promise<{ milestones: Milestone[]; total_reached: number }> {
    const response = await axios.get(
      `${API_BASE_URL}/achievements/milestones`,
      this.getAuthHeaders()
    );
    return response.data;
  }

  async getReachedMilestones(): Promise<{ milestones: Milestone[]; total: number }> {
    const response = await axios.get(
      `${API_BASE_URL}/achievements/milestones/reached`,
      this.getAuthHeaders()
    );
    return response.data;
  }

  // ==================== Leaderboard Methods ====================

  async getLeaderboards(): Promise<Leaderboard[]> {
    const response = await axios.get(
      `${API_BASE_URL}/achievements/leaderboards`,
      this.getAuthHeaders()
    );
    return response.data.leaderboards;
  }

  async getLeaderboard(leaderboardName: string, limit: number = 100): Promise<{
    leaderboard: Leaderboard;
    rankings: LeaderboardRanking[];
    user_rank?: LeaderboardRanking;
    total_participants: number;
  }> {
    const response = await axios.get(
      `${API_BASE_URL}/achievements/leaderboards/${leaderboardName}?limit=${limit}`,
      this.getAuthHeaders()
    );
    return response.data;
  }

  async getUserLeaderboardPosition(leaderboardName: string): Promise<{
    rank?: LeaderboardRanking;
    nearby_rankings: LeaderboardRanking[];
    total_participants: number;
  }> {
    const response = await axios.get(
      `${API_BASE_URL}/achievements/leaderboards/${leaderboardName}/position`,
      this.getAuthHeaders()
    );
    return response.data;
  }

  // ==================== Quest Methods ====================

  async getQuests(): Promise<{
    active: Quest[];
    available: Quest[];
    completed: Quest[];
    total: number;
  }> {
    const response = await axios.get(
      `${API_BASE_URL}/achievements/quests`,
      this.getAuthHeaders()
    );
    return response.data;
  }

  async startQuest(questId: number): Promise<{ message: string }> {
    const response = await axios.post(
      `${API_BASE_URL}/achievements/quests/${questId}/start`,
      {},
      this.getAuthHeaders()
    );
    return response.data;
  }

  async getQuestProgress(questId: number): Promise<QuestProgress> {
    const response = await axios.get(
      `${API_BASE_URL}/achievements/quests/${questId}/progress`,
      this.getAuthHeaders()
    );
    return response.data.progress;
  }

  // ==================== Statistics Methods ====================

  async getAchievementStats(): Promise<any> {
    const response = await axios.get(
      `${API_BASE_URL}/achievements/stats`,
      this.getAuthHeaders()
    );
    return response.data.stats;
  }

  // ==================== Event Triggers ====================

  async triggerAchievementCheck(eventType: string, eventData: any): Promise<{
    new_achievements: UserAchievement[];
    new_milestones: Milestone[];
  }> {
    const response = await axios.post(
      `${API_BASE_URL}/achievements/trigger`,
      { event_type: eventType, event_data: eventData },
      this.getAuthHeaders()
    );
    return response.data;
  }
}

const AchievementApiServiceInstance = new AchievementApiService();

export { AchievementApiServiceInstance as AchievementApiService };
export { Achievement, UserAchievement, LearningStreak, StudentPoints, Milestone, Quest, QuestProgress, Leaderboard };
export default AchievementApiServiceInstance;
