/**
 * Progressive Learning Hooks
 * Custom React hooks for managing strict module progression
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { CourseApiService, ProgressApiService, AssessmentApiService } from '@/services/api';
import { ModuleData, ModuleProgress, CourseProgress } from '@/services/api/types';

// ==================== Module Progression Hook ====================

export interface ProgressionState {
  currentModule: ModuleData | null;
  allModules: ModuleData[];
  courseProgress: CourseProgress | null;
  loading: boolean;
  error: string | null;
}

export interface ProgressionActions {
  canAccessModule: (moduleId: number) => boolean;
  getModuleStatus: (moduleId: number) => ModuleProgress | null;
  unlockNextModule: () => Promise<boolean>;
  refreshProgress: () => Promise<void>;
}

export const useProgressiveLearning = (courseId: number): ProgressionState & ProgressionActions => {
  const [state, setState] = useState<ProgressionState>({
    currentModule: null,
    allModules: [],
    courseProgress: null,
    loading: true,
    error: null,
  });

  // Fetch course modules and progression
  const loadCourseProgression = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const data = await CourseApiService.getCourseModules(courseId);
      
      // Find current active module
      const currentModule = data.modules.find(
        m => m.progress.status === 'in_progress' || m.progress.status === 'unlocked'
      ) || data.modules[0];

      setState({
        currentModule,
        allModules: data.modules,
        courseProgress: data.course_progress,
        loading: false,
        error: null,
      });
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to load course progression',
      }));
    }
  }, [courseId]);

  useEffect(() => {
    loadCourseProgression();
  }, [loadCourseProgression]);

  // Check if module can be accessed
  const canAccessModule = useCallback((moduleId: number): boolean => {
    const module = state.allModules.find(m => m.module.id === moduleId);
    if (!module) return false;

    return module.progress.status !== 'locked';
  }, [state.allModules]);

  // Get module status
  const getModuleStatus = useCallback((moduleId: number): ModuleProgress | null => {
    const module = state.allModules.find(m => m.module.id === moduleId);
    return module?.progress || null;
  }, [state.allModules]);

  // Unlock next module after passing current one
  const unlockNextModule = useCallback(async (): Promise<boolean> => {
    if (!state.currentModule) return false;

    try {
      const result = await AssessmentApiService.submitModuleCompletion(
        state.currentModule.module.id
      );

      if (result.passed && result.can_proceed) {
        await loadCourseProgression();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to unlock next module:', error);
      return false;
    }
  }, [state.currentModule, loadCourseProgression]);

  // Refresh progression data
  const refreshProgress = useCallback(async () => {
    await loadCourseProgression();
  }, [loadCourseProgression]);

  return {
    ...state,
    canAccessModule,
    getModuleStatus,
    unlockNextModule,
    refreshProgress,
  };
};

// ==================== Module Attempts Hook ====================

export interface AttemptState {
  attemptsUsed: number;
  maxAttempts: number;
  remainingAttempts: number;
  canRetake: boolean;
  isLastAttempt: boolean;
}

export const useModuleAttempts = (moduleId: number) => {
  const [attemptState, setAttemptState] = useState<AttemptState>({
    attemptsUsed: 0,
    maxAttempts: 3,
    remainingAttempts: 3,
    canRetake: true,
    isLastAttempt: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Skip loading if moduleId is invalid
    if (!moduleId || moduleId <= 0) {
      setLoading(false);
      return;
    }

    const loadAttempts = async () => {
      try {
        const eligibility = await AssessmentApiService.checkRetakeEligibility(moduleId);
        
        setAttemptState({
          attemptsUsed: eligibility.attempts_used,
          maxAttempts: eligibility.max_attempts,
          remainingAttempts: eligibility.max_attempts - eligibility.attempts_used,
          canRetake: eligibility.can_retake,
          isLastAttempt: eligibility.max_attempts - eligibility.attempts_used === 1,
        });
      } catch (error) {
        console.error('Failed to load attempt data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAttempts();
  }, [moduleId]);

  const recordAttempt = useCallback(async (): Promise<boolean> => {
    if (!moduleId || moduleId <= 0) {
      console.error('Invalid module ID for recording attempt');
      return false;
    }

    if (attemptState.remainingAttempts === 0) {
      throw new Error('Maximum attempts reached. Course access will be revoked.');
    }

    try {
      await AssessmentApiService.retakeModule(moduleId);
      
      setAttemptState(prev => ({
        ...prev,
        attemptsUsed: prev.attemptsUsed + 1,
        remainingAttempts: prev.remainingAttempts - 1,
        canRetake: prev.remainingAttempts - 1 > 0,
        isLastAttempt: prev.remainingAttempts - 1 === 1,
      }));

      return true;
    } catch (error) {
      console.error('Failed to record attempt:', error);
      return false;
    }
  }, [moduleId, attemptState.remainingAttempts]);

  return {
    ...attemptState,
    loading,
    recordAttempt,
  };
};

// ==================== Module Scoring Hook ====================

export interface ScoringState {
  cumulativeScore: number;
  passingThreshold: number;
  isPassing: boolean;
  breakdown: {
    courseContribution: number; // 10%
    quizzes: number; // 30%
    assignments: number; // 40%
    finalAssessment: number; // 20%
  };
  missingPoints: number;
}

export const useModuleScoring = (moduleId: number) => {
  const [scoringState, setScoringState] = useState<ScoringState>({
    cumulativeScore: 0,
    passingThreshold: 80,
    isPassing: false,
    breakdown: {
      courseContribution: 0,
      quizzes: 0,
      assignments: 0,
      finalAssessment: 0,
    },
    missingPoints: 80,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Skip loading if moduleId is invalid
    if (!moduleId || moduleId <= 0) {
      setLoading(false);
      return;
    }

    const loadScoring = async () => {
      try {
        const moduleData = await ProgressApiService.getModuleProgress(moduleId);
        const progress = moduleData?.progress;

        // Check if progress data exists
        if (!progress) {
          console.warn('No progress data available for module:', moduleId);
          setScoringState({
            cumulativeScore: 0,
            passingThreshold: 80,
            isPassing: false,
            breakdown: {
              courseContribution: 0,
              quizzes: 0,
              assignments: 0,
              finalAssessment: 0,
            },
            missingPoints: 80,
          });
          return;
        }

        // Calculate weighted cumulative score
        const cumulative = 
          ((progress.course_contribution_score || 0) * 0.10) +
          ((progress.quiz_score || 0) * 0.30) +
          ((progress.assignment_score || 0) * 0.40) +
          ((progress.final_assessment_score || 0) * 0.20);

        setScoringState({
          cumulativeScore: cumulative,
          passingThreshold: 80,
          isPassing: cumulative >= 80,
          breakdown: {
            courseContribution: progress.course_contribution_score || 0,
            quizzes: progress.quiz_score || 0,
            assignments: progress.assignment_score || 0,
            finalAssessment: progress.final_assessment_score || 0,
          },
          missingPoints: Math.max(0, 80 - cumulative),
        });
      } catch (error) {
        console.error('Failed to load scoring data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadScoring();
  }, [moduleId]);

  const recalculate = useCallback(async () => {
    if (!moduleId || moduleId <= 0) {
      console.error('Invalid module ID for recalculating scoring');
      return;
    }

    setLoading(true);
    try {
      const moduleData = await ProgressApiService.getModuleProgress(moduleId);
      const progress = moduleData?.progress;

      // Check if progress data exists
      if (!progress) {
        console.warn('No progress data available for module:', moduleId);
        setScoringState({
          cumulativeScore: 0,
          passingThreshold: 80,
          isPassing: false,
          breakdown: {
            courseContribution: 0,
            quizzes: 0,
            assignments: 0,
            finalAssessment: 0,
          },
          missingPoints: 80,
        });
        return;
      }

      const cumulative = 
        ((progress.course_contribution_score || 0) * 0.10) +
        ((progress.quiz_score || 0) * 0.30) +
        ((progress.assignment_score || 0) * 0.40) +
        ((progress.final_assessment_score || 0) * 0.20);

      setScoringState({
        cumulativeScore: cumulative,
        passingThreshold: 80,
        isPassing: cumulative >= 80,
        breakdown: {
          courseContribution: progress.course_contribution_score || 0,
          quizzes: progress.quiz_score || 0,
          assignments: progress.assignment_score || 0,
          finalAssessment: progress.final_assessment_score || 0,
        },
        missingPoints: Math.max(0, 80 - cumulative),
      });
    } catch (error) {
      console.error('Failed to recalculate scoring:', error);
    } finally {
      setLoading(false);
    }
  }, [moduleId]);

  return {
    ...scoringState,
    loading,
    recalculate,
  };
};

// ==================== Real-time Progress Hook ====================

export const useRealTimeProgress = (courseId: number) => {
  const [updates, setUpdates] = useState<any[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // WebSocket connection for real-time updates
    const ws = new WebSocket(
      `${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5001'}/ws/progress/${courseId}`
    );

    ws.onopen = () => {
      setConnected(true);
      console.log('WebSocket connected for progress updates');
    };

    ws.onmessage = (event) => {
      const update = JSON.parse(event.data);
      setUpdates(prev => [...prev, update]);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnected(false);
    };

    ws.onclose = () => {
      setConnected(false);
      console.log('WebSocket disconnected');
    };

    return () => {
      ws.close();
    };
  }, [courseId]);

  return {
    updates,
    connected,
  };
};

// ==================== Learning Analytics Hook ====================

export const useLearningAnalytics = (timeframe: '7d' | '30d' | '90d' | 'all' = '30d') => {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        const data = await ProgressApiService.getLearningAnalytics(timeframe);
        setAnalytics(data);
      } catch (error) {
        console.error('Failed to load analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, [timeframe]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await ProgressApiService.getLearningAnalytics(timeframe);
    setAnalytics(data);
    setLoading(false);
  }, [timeframe]);

  return {
    analytics,
    loading,
    refresh,
  };
};
