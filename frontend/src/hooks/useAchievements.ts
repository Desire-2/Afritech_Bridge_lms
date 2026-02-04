// Enhanced Achievement Hook - React hook for managing achievement state
// Provides comprehensive achievement management with loading states and error handling

import { useState, useEffect, useCallback } from 'react';
import { AchievementApiService } from '@/services/enhancedAchievementApi';
import type { 
  Achievement, 
  UserAchievement, 
  AchievementSummary, 
  LearningStreak, 
  StudentPoints,
  Quest,
  PaginatedResponse,
  ApiError 
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
};\n\nexport const useAchievements = () => {\n  const [state, setState] = useState<AchievementState>(initialState);\n\n  // Helper function to update loading state\n  const setLoading = (key: keyof AchievementState['loading'], loading: boolean) => {\n    setState(prev => ({\n      ...prev,\n      loading: { ...prev.loading, [key]: loading }\n    }));\n  };\n\n  // Helper function to set error\n  const setError = (key: keyof AchievementState['errors'], error: ApiError | null) => {\n    setState(prev => ({\n      ...prev,\n      errors: { ...prev.errors, [key]: error }\n    }));\n  };\n\n  // Helper function to update last updated timestamp\n  const setLastUpdated = (key: keyof AchievementState['lastUpdated']) => {\n    setState(prev => ({\n      ...prev,\n      lastUpdated: { ...prev.lastUpdated, [key]: Date.now() }\n    }));\n  };\n\n  /**\n   * Load all achievements with pagination\n   */\n  const loadAchievements = useCallback(async (options?: {\n    page?: number;\n    per_page?: number;\n    category?: string;\n    forceRefresh?: boolean;\n  }) => {\n    const { forceRefresh = false, ...apiOptions } = options || {};\n    \n    // Check if we need to refresh\n    const lastUpdate = state.lastUpdated.achievements;\n    const cacheAge = lastUpdate ? Date.now() - lastUpdate : Infinity;\n    const shouldRefresh = forceRefresh || cacheAge > 5 * 60 * 1000; // 5 minutes\n    \n    if (!shouldRefresh && state.achievements.length > 0) {\n      return;\n    }\n\n    setLoading('achievements', true);\n    setError('achievements', null);\n\n    try {\n      const response = await AchievementApiService.getAchievements(apiOptions);\n      \n      setState(prev => ({\n        ...prev,\n        achievements: response.data || [],\n        achievementsPagination: response.pagination\n      }));\n      \n      setLastUpdated('achievements');\n    } catch (error) {\n      setError('achievements', error as ApiError);\n    } finally {\n      setLoading('achievements', false);\n    }\n  }, [state.lastUpdated.achievements, state.achievements.length]);\n\n  /**\n   * Load earned achievements with pagination\n   */\n  const loadEarnedAchievements = useCallback(async (options?: {\n    page?: number;\n    per_page?: number;\n    forceRefresh?: boolean;\n  }) => {\n    const { forceRefresh = false, ...apiOptions } = options || {};\n    \n    const lastUpdate = state.lastUpdated.earnedAchievements;\n    const cacheAge = lastUpdate ? Date.now() - lastUpdate : Infinity;\n    const shouldRefresh = forceRefresh || cacheAge > 2 * 60 * 1000; // 2 minutes\n    \n    if (!shouldRefresh && state.earnedAchievements.length > 0) {\n      return;\n    }\n\n    setLoading('earnedAchievements', true);\n    setError('earnedAchievements', null);\n\n    try {\n      const response = await AchievementApiService.getEarnedAchievements(apiOptions);\n      \n      setState(prev => ({\n        ...prev,\n        earnedAchievements: response.data || [],\n        earnedPagination: response.pagination\n      }));\n      \n      setLastUpdated('earnedAchievements');\n    } catch (error) {\n      setError('earnedAchievements', error as ApiError);\n    } finally {\n      setLoading('earnedAchievements', false);\n    }\n  }, [state.lastUpdated.earnedAchievements, state.earnedAchievements.length]);\n\n  /**\n   * Load achievement summary\n   */\n  const loadSummary = useCallback(async (forceRefresh: boolean = false) => {\n    const lastUpdate = state.lastUpdated.summary;\n    const cacheAge = lastUpdate ? Date.now() - lastUpdate : Infinity;\n    const shouldRefresh = forceRefresh || cacheAge > 1 * 60 * 1000; // 1 minute\n    \n    if (!shouldRefresh && state.summary) {\n      return;\n    }\n\n    setLoading('summary', true);\n    setError('summary', null);\n\n    try {\n      const response = await AchievementApiService.getAchievementSummary();\n      \n      setState(prev => ({\n        ...prev,\n        summary: response.data\n      }));\n      \n      setLastUpdated('summary');\n    } catch (error) {\n      setError('summary', error as ApiError);\n    } finally {\n      setLoading('summary', false);\n    }\n  }, [state.lastUpdated.summary, state.summary]);\n\n  /**\n   * Load learning streak\n   */\n  const loadStreak = useCallback(async (forceRefresh: boolean = false) => {\n    const lastUpdate = state.lastUpdated.streak;\n    const cacheAge = lastUpdate ? Date.now() - lastUpdate : Infinity;\n    const shouldRefresh = forceRefresh || cacheAge > 30 * 1000; // 30 seconds\n    \n    if (!shouldRefresh && state.streak) {\n      return;\n    }\n\n    setLoading('streak', true);\n    setError('streak', null);\n\n    try {\n      const response = await AchievementApiService.getStreak();\n      \n      setState(prev => ({\n        ...prev,\n        streak: response.streak\n      }));\n      \n      setLastUpdated('streak');\n    } catch (error) {\n      setError('streak', error as ApiError);\n    } finally {\n      setLoading('streak', false);\n    }\n  }, [state.lastUpdated.streak, state.streak]);\n\n  /**\n   * Load student points\n   */\n  const loadPoints = useCallback(async (forceRefresh: boolean = false) => {\n    const lastUpdate = state.lastUpdated.points;\n    const cacheAge = lastUpdate ? Date.now() - lastUpdate : Infinity;\n    const shouldRefresh = forceRefresh || cacheAge > 30 * 1000; // 30 seconds\n    \n    if (!shouldRefresh && state.points) {\n      return;\n    }\n\n    setLoading('points', true);\n    setError('points', null);\n\n    try {\n      const response = await AchievementApiService.getPoints();\n      \n      setState(prev => ({\n        ...prev,\n        points: response.points\n      }));\n      \n      setLastUpdated('points');\n    } catch (error) {\n      setError('points', error as ApiError);\n    } finally {\n      setLoading('points', false);\n    }\n  }, [state.lastUpdated.points, state.points]);\n\n  /**\n   * Load available quests\n   */\n  const loadQuests = useCallback(async (forceRefresh: boolean = false) => {\n    const lastUpdate = state.lastUpdated.quests;\n    const cacheAge = lastUpdate ? Date.now() - lastUpdate : Infinity;\n    const shouldRefresh = forceRefresh || cacheAge > 2 * 60 * 1000; // 2 minutes\n    \n    if (!shouldRefresh && state.quests.length > 0) {\n      return;\n    }\n\n    setLoading('quests', true);\n    setError('quests', null);\n\n    try {\n      const response = await AchievementApiService.getQuests();\n      \n      setState(prev => ({\n        ...prev,\n        quests: response.quests\n      }));\n      \n      setLastUpdated('quests');\n    } catch (error) {\n      setError('quests', error as ApiError);\n    } finally {\n      setLoading('quests', false);\n    }\n  }, [state.lastUpdated.quests, state.quests.length]);\n\n  /**\n   * Update streak and refresh related data\n   */\n  const updateStreak = useCallback(async () => {\n    setLoading('actions', true);\n    setError('actions', null);\n\n    try {\n      const response = await AchievementApiService.updateStreak();\n      \n      // Refresh streak and other related data\n      await Promise.all([\n        loadStreak(true),\n        loadPoints(true),\n        loadSummary(true)\n      ]);\n      \n      return response;\n    } catch (error) {\n      setError('actions', error as ApiError);\n      throw error;\n    } finally {\n      setLoading('actions', false);\n    }\n  }, [loadStreak, loadPoints, loadSummary]);\n\n  /**\n   * Showcase an achievement\n   */\n  const showcaseAchievement = useCallback(async (achievementId: number, showcase: boolean = true) => {\n    setLoading('actions', true);\n    setError('actions', null);\n\n    try {\n      const response = await AchievementApiService.showcaseAchievement(achievementId, showcase);\n      \n      // Update the local state\n      setState(prev => ({\n        ...prev,\n        earnedAchievements: prev.earnedAchievements.map(ua => \n          ua.achievement.id === achievementId \n            ? { ...ua, is_showcased: showcase }\n            : ua\n        )\n      }));\n      \n      // Refresh summary to update showcased achievements\n      await loadSummary(true);\n      \n      return response;\n    } catch (error) {\n      setError('actions', error as ApiError);\n      throw error;\n    } finally {\n      setLoading('actions', false);\n    }\n  }, [loadSummary]);\n\n  /**\n   * Start a quest\n   */\n  const startQuest = useCallback(async (questId: number) => {\n    setLoading('actions', true);\n    setError('actions', null);\n\n    try {\n      const response = await AchievementApiService.startQuest(questId);\n      \n      // Refresh quests to update user progress\n      await loadQuests(true);\n      \n      return response;\n    } catch (error) {\n      setError('actions', error as ApiError);\n      throw error;\n    } finally {\n      setLoading('actions', false);\n    }\n  }, [loadQuests]);\n\n  /**\n   * Clear specific error\n   */\n  const clearError = useCallback((key: keyof AchievementState['errors']) => {\n    setError(key, null);\n  }, []);\n\n  /**\n   * Clear all errors\n   */\n  const clearAllErrors = useCallback(() => {\n    setState(prev => ({\n      ...prev,\n      errors: {\n        achievements: null,\n        earnedAchievements: null,\n        summary: null,\n        streak: null,\n        points: null,\n        quests: null,\n        actions: null,\n      }\n    }));\n  }, []);\n\n  /**\n   * Refresh all data\n   */\n  const refreshAll = useCallback(async () => {\n    await Promise.all([\n      loadAchievements({ forceRefresh: true }),\n      loadEarnedAchievements({ forceRefresh: true }),\n      loadSummary(true),\n      loadStreak(true),\n      loadPoints(true),\n      loadQuests(true)\n    ]);\n  }, [loadAchievements, loadEarnedAchievements, loadSummary, loadStreak, loadPoints, loadQuests]);\n\n  // Initialize data on mount\n  useEffect(() => {\n    loadSummary();\n    loadStreak();\n    loadPoints();\n  }, []);\n\n  // Computed values\n  const isLoading = Object.values(state.loading).some(loading => loading);\n  const hasErrors = Object.values(state.errors).some(error => error !== null);\n  \n  return {\n    // Data\n    ...state,\n    \n    // Computed\n    isLoading,\n    hasErrors,\n    \n    // Actions\n    loadAchievements,\n    loadEarnedAchievements,\n    loadSummary,\n    loadStreak,\n    loadPoints,\n    loadQuests,\n    updateStreak,\n    showcaseAchievement,\n    startQuest,\n    \n    // Error management\n    clearError,\n    clearAllErrors,\n    \n    // Utilities\n    refreshAll,\n  };\n};\n\nexport default useAchievements;