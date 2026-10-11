// Enhanced Achievement Hook - React hook for managing achievement state
// Provides comprehensive achievement management with loading states and error handling

import { useState, useEffect, useCallback } from 'react';
import { AchievementApiService } from '@/services/enhancedAchievementApi';
import type { ApiError } from '@/services/ApiErrorHandler';
import type { 
  Achievement, 
  UserAchievement, 
  AchievementSummary, 
  LearningStreak, 
  StudentPoints,
  Quest,
  PaginatedResponse
} from '@/services/enhancedAchievementApi';

interface AchievementState {
  // Data
  achievements: Achievement[];
  earnedAchievements: UserAchievement[];
  summary: AchievementSummary | null;
  streak: LearningStreak | null;
  points: StudentPoints | null;
  quests: Quest[];
  
  // Pagination
  achievementsPagination: PaginatedResponse<Achievement>['pagination'] | null;
  earnedPagination: PaginatedResponse<UserAchievement>['pagination'] | null;
  
  // Loading states
  loading: {
    achievements: boolean;
    earnedAchievements: boolean;
    summary: boolean;
    streak: boolean;
    points: boolean;
    quests: boolean;
    actions: boolean;
  };
  
  // Error states
  errors: {
    achievements: ApiError | null;
    earnedAchievements: ApiError | null;
    summary: ApiError | null;
    streak: ApiError | null;
    points: ApiError | null;
    quests: ApiError | null;
    actions: ApiError | null;
  };
  
  // Last update timestamps
  lastUpdated: {
    achievements: number | null;
    earnedAchievements: number | null;
    summary: number | null;
    streak: number | null;
    points: number | null;
    quests: number | null;
  };
}

const initialState: AchievementState = {
  achievements: [],
  earnedAchievements: [],
  summary: null,
  streak: null,
  points: null,
  quests: [],
  achievementsPagination: null,
  earnedPagination: null,
  loading: {
    achievements: false,
    earnedAchievements: false,
    summary: false,
    streak: false,
    points: false,
    quests: false,
    actions: false,
  },
  errors: {
    achievements: null,
    earnedAchievements: null,
    summary: null,
    streak: null,
    points: null,
    quests: null,
    actions: null,
  },
  lastUpdated: {
    achievements: null,
    earnedAchievements: null,
    summary: null,
    streak: null,
    points: null,
    quests: null,
  },
};

export const useAchievements = () => {
  const [state, setState] = useState<AchievementState>(initialState);

  // Helper function to update loading state
  const setLoading = (key: keyof AchievementState['loading'], loading: boolean) => {
    setState(prev => ({
      ...prev,
      loading: { ...prev.loading, [key]: loading }
    }));
  };

  // Helper function to set error
  const setError = (key: keyof AchievementState['errors'], error: ApiError | null) => {
    setState(prev => ({
      ...prev,
      errors: { ...prev.errors, [key]: error }
    }));
  };

  // Helper function to update last updated timestamp
  const setLastUpdated = (key: keyof AchievementState['lastUpdated']) => {
    setState(prev => ({
      ...prev,
      lastUpdated: { ...prev.lastUpdated, [key]: Date.now() }
    }));
  };

  /**
   * Load all achievements with pagination
   */
  const loadAchievements = useCallback(async (options?: {
    page?: number;
    per_page?: number;
    category?: string;
    forceRefresh?: boolean;
  }) => {
    const { forceRefresh = false, ...apiOptions } = options || {};
    
    // Check if we need to refresh
    const lastUpdate = state.lastUpdated.achievements;
    const cacheAge = lastUpdate ? Date.now() - lastUpdate : Infinity;
    const shouldRefresh = forceRefresh || cacheAge > 5 * 60 * 1000; // 5 minutes
    
    if (!shouldRefresh && state.achievements.length > 0) {
      return;
    }

    setLoading('achievements', true);
    setError('achievements', null);

    try {
      const response = await AchievementApiService.getAchievements(apiOptions);
      
      setState(prev => ({
        ...prev,
        achievements: response.data || [],
        achievementsPagination: response.pagination
      }));
      
      setLastUpdated('achievements');
    } catch (error) {
      setError('achievements', error as ApiError);
    } finally {
      setLoading('achievements', false);
    }
  }, [state.lastUpdated.achievements, state.achievements.length]);

  /**
   * Load earned achievements with pagination
   */
  const loadEarnedAchievements = useCallback(async (options?: {
    page?: number;
    per_page?: number;
    forceRefresh?: boolean;
  }) => {
    const { forceRefresh = false, ...apiOptions } = options || {};
    
    const lastUpdate = state.lastUpdated.earnedAchievements;
    const cacheAge = lastUpdate ? Date.now() - lastUpdate : Infinity;
    const shouldRefresh = forceRefresh || cacheAge > 2 * 60 * 1000; // 2 minutes
    
    if (!shouldRefresh && state.earnedAchievements.length > 0) {
      return;
    }

    setLoading('earnedAchievements', true);
    setError('earnedAchievements', null);

    try {
      const response = await AchievementApiService.getEarnedAchievements(apiOptions);
      
      setState(prev => ({
        ...prev,
        earnedAchievements: response.data || [],
        earnedPagination: response.pagination
      }));
      
      setLastUpdated('earnedAchievements');
    } catch (error) {
      setError('earnedAchievements', error as ApiError);
    } finally {
      setLoading('earnedAchievements', false);
    }
  }, [state.lastUpdated.earnedAchievements, state.earnedAchievements.length]);

  /**
   * Load achievement summary
   */
  const loadSummary = useCallback(async (forceRefresh: boolean = false) => {
    const lastUpdate = state.lastUpdated.summary;
    const cacheAge = lastUpdate ? Date.now() - lastUpdate : Infinity;
    const shouldRefresh = forceRefresh || cacheAge > 1 * 60 * 1000; // 1 minute
    
    if (!shouldRefresh && state.summary) {
      return;
    }

    setLoading('summary', true);
    setError('summary', null);

    try {
      const response = await AchievementApiService.getAchievementSummary();
      
      setState(prev => ({
        ...prev,
        summary: response.data
      }));
      
      setLastUpdated('summary');
    } catch (error) {
      setError('summary', error as ApiError);
    } finally {
      setLoading('summary', false);
    }
  }, [state.lastUpdated.summary, state.summary]);

  /**
   * Load learning streak
   */
  const loadStreak = useCallback(async (forceRefresh: boolean = false) => {
    const lastUpdate = state.lastUpdated.streak;
    const cacheAge = lastUpdate ? Date.now() - lastUpdate : Infinity;
    const shouldRefresh = forceRefresh || cacheAge > 30 * 1000; // 30 seconds
    
    if (!shouldRefresh && state.streak) {
      return;
    }

    setLoading('streak', true);
    setError('streak', null);

    try {
      const response = await AchievementApiService.getStreak();
      
      setState(prev => ({
        ...prev,
        streak: response.streak
      }));
      
      setLastUpdated('streak');
    } catch (error) {
      setError('streak', error as ApiError);
    } finally {
      setLoading('streak', false);
    }
  }, [state.lastUpdated.streak, state.streak]);

  /**
   * Load student points
   */
  const loadPoints = useCallback(async (forceRefresh: boolean = false) => {
    const lastUpdate = state.lastUpdated.points;
    const cacheAge = lastUpdate ? Date.now() - lastUpdate : Infinity;
    const shouldRefresh = forceRefresh || cacheAge > 30 * 1000; // 30 seconds
    
    if (!shouldRefresh && state.points) {
      return;
    }

    setLoading('points', true);
    setError('points', null);

    try {
      const response = await AchievementApiService.getPoints();
      
      setState(prev => ({
        ...prev,
        points: response.points
      }));
      
      setLastUpdated('points');
    } catch (error) {
      setError('points', error as ApiError);
    } finally {
      setLoading('points', false);
    }
  }, [state.lastUpdated.points, state.points]);

  /**
   * Load available quests
   */
  const loadQuests = useCallback(async (forceRefresh: boolean = false) => {
    const lastUpdate = state.lastUpdated.quests;
    const cacheAge = lastUpdate ? Date.now() - lastUpdate : Infinity;
    const shouldRefresh = forceRefresh || cacheAge > 2 * 60 * 1000; // 2 minutes
    
    if (!shouldRefresh && state.quests.length > 0) {
      return;
    }

    setLoading('quests', true);
    setError('quests', null);

    try {
      const response = await AchievementApiService.getQuests();
      
      setState(prev => ({
        ...prev,
        quests: response.quests
      }));
      
      setLastUpdated('quests');
    } catch (error) {
      setError('quests', error as ApiError);
    } finally {
      setLoading('quests', false);
    }
  }, [state.lastUpdated.quests, state.quests.length]);

  /**
   * Update streak and refresh related data
   */
  const updateStreak = useCallback(async () => {
    setLoading('actions', true);
    setError('actions', null);

    try {
      const response = await AchievementApiService.updateStreak();
      
      // Refresh streak and other related data
      await Promise.all([
        loadStreak(true),
        loadPoints(true),
        loadSummary(true)
      ]);
      
      return response;
    } catch (error) {
      setError('actions', error as ApiError);
      throw error;
    } finally {
      setLoading('actions', false);
    }
  }, [loadStreak, loadPoints, loadSummary]);

  /**
   * Showcase an achievement
   */
  const showcaseAchievement = useCallback(async (achievementId: number, showcase: boolean = true) => {
    setLoading('actions', true);
    setError('actions', null);

    try {
      const response = await AchievementApiService.showcaseAchievement(achievementId, showcase);
      
      // Update the local state
      setState(prev => ({
        ...prev,
        earnedAchievements: prev.earnedAchievements.map(ua => 
          ua.achievement.id === achievementId 
            ? { ...ua, is_showcased: showcase }
            : ua
        )
      }));
      
      // Refresh summary to update showcased achievements
      await loadSummary(true);
      
      return response;
    } catch (error) {
      setError('actions', error as ApiError);
      throw error;
    } finally {
      setLoading('actions', false);
    }
  }, [loadSummary]);

  /**
   * Start a quest
   */
  const startQuest = useCallback(async (questId: number) => {
    setLoading('actions', true);
    setError('actions', null);

    try {
      const response = await AchievementApiService.startQuest(questId);
      
      // Refresh quests to update user progress
      await loadQuests(true);
      
      return response;
    } catch (error) {
      setError('actions', error as ApiError);
      throw error;
    } finally {
      setLoading('actions', false);
    }
  }, [loadQuests]);

  /**
   * Clear specific error
   */
  const clearError = useCallback((key: keyof AchievementState['errors']) => {
    setError(key, null);
  }, []);

  /**
   * Clear all errors
   */
  const clearAllErrors = useCallback(() => {
    setState(prev => ({
      ...prev,
      errors: {
        achievements: null,
        earnedAchievements: null,
        summary: null,
        streak: null,
        points: null,
        quests: null,
        actions: null,
      }
    }));
  }, []);

  /**
   * Refresh all data
   */
  const refreshAll = useCallback(async () => {
    await Promise.all([
      loadAchievements({ forceRefresh: true }),
      loadEarnedAchievements({ forceRefresh: true }),
      loadSummary(true),
      loadStreak(true),
      loadPoints(true),
      loadQuests(true)
    ]);
  }, [loadAchievements, loadEarnedAchievements, loadSummary, loadStreak, loadPoints, loadQuests]);

  // Initialize data on mount
  useEffect(() => {
    loadSummary();
    loadStreak();
    loadPoints();
  }, []);

  // Computed values
  const isLoading = Object.values(state.loading).some(loading => loading);
  const hasErrors = Object.values(state.errors).some(error => error !== null);
  
  return {
    // Data
    ...state,
    
    // Computed
    isLoading,
    hasErrors,
    
    // Actions
    loadAchievements,
    loadEarnedAchievements,
    loadSummary,
    loadStreak,
    loadPoints,
    loadQuests,
    updateStreak,
    showcaseAchievement,
    startQuest,
    
    // Error management
    clearError,
    clearAllErrors,
    
    // Utilities
    refreshAll,
  };
};

export default useAchievements;
