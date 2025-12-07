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
      
      const response = await CourseApiService.getCourseModules(courseId);
      
      // Handle nested data structure from backend
      // Backend returns: { success: true, data: { modules: [...], course: {...} } }
      const data = (response as any).data || response;
      const modules = data.modules || [];
      
      console.log('📦 loadCourseProgression: Loaded modules:', modules.map((m: any) => ({
        id: m.module?.id,
        title: m.module?.title,
        status: m.progress?.status
      })));
      
      // Find current active module
      const currentModule = modules.find(
        (m: ModuleData) => m.progress.status === 'in_progress' || m.progress.status === 'unlocked'
      ) || modules[0];

      setState({
        currentModule,
        allModules: modules,
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
    courseContribution: number; // Dynamic weight based on available assessments
    quizzes: number; // Dynamic weight based on available assessments
    assignments: number; // Dynamic weight based on available assessments
    finalAssessment: number; // Dynamic weight based on available assessments
  };
  weights: {
    courseContribution: number;
    quizzes: number;
    assignments: number;
    finalAssessment: number;
  };
  missingPoints: number;
  assessmentInfo?: {
    hasQuizzes: boolean;
    hasAssignments: boolean;
    hasFinalAssessment: boolean;
    isReadingOnly: boolean;
  };
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
    weights: {
      courseContribution: 10,
      quizzes: 30,
      assignments: 40,
      finalAssessment: 20,
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
        // First, trigger a recalculation to ensure fresh scores
        try {
          await ProgressApiService.recalculateModuleScore(moduleId);
          console.log('🔄 Module score recalculated');
        } catch (recalcError) {
          console.warn('Could not recalculate score:', recalcError);
          // Continue anyway to fetch whatever data is available
        }

        // Fetch detailed score breakdown with dynamic weights from backend
        let scoreBreakdown = null;
        try {
          scoreBreakdown = await ProgressApiService.getModuleScoreBreakdown(moduleId);
          console.log('📊 Module score breakdown fetched:', scoreBreakdown);
        } catch (breakdownError) {
          console.warn('Could not fetch score breakdown:', breakdownError);
        }

        // If we got the detailed breakdown, use it directly (has dynamic weights)
        if (scoreBreakdown && scoreBreakdown.breakdown) {
          const weights = {
            courseContribution: scoreBreakdown.breakdown.course_contribution?.weight || 10,
            quizzes: scoreBreakdown.breakdown.quizzes?.weight || 30,
            assignments: scoreBreakdown.breakdown.assignments?.weight || 40,
            finalAssessment: scoreBreakdown.breakdown.final_assessment?.weight || 20,
          };

          setScoringState({
            cumulativeScore: scoreBreakdown.cumulative_score || 0,
            passingThreshold: scoreBreakdown.passing_threshold || 80,
            isPassing: scoreBreakdown.is_passing || false,
            breakdown: {
              courseContribution: scoreBreakdown.breakdown.course_contribution?.score || 0,
              quizzes: scoreBreakdown.breakdown.quizzes?.score || 0,
              assignments: scoreBreakdown.breakdown.assignments?.score || 0,
              finalAssessment: scoreBreakdown.breakdown.final_assessment?.score || 0,
            },
            weights,
            missingPoints: scoreBreakdown.points_needed || Math.max(0, 80 - (scoreBreakdown.cumulative_score || 0)),
            assessmentInfo: scoreBreakdown.assessment_info,
          });
          return;
        }

        // Fallback: fetch from module progress API
        const moduleData = await ProgressApiService.getModuleProgress(moduleId);
        // Handle both response formats: data.data.progress and data.progress
        const progress = moduleData?.data?.progress || moduleData?.progress;

        console.log('📊 Module scoring data fetched for module', moduleId, ':', progress);
        console.log('📊 Full response:', JSON.stringify(moduleData, null, 2));

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
            weights: {
              courseContribution: 10,
              quizzes: 30,
              assignments: 40,
              finalAssessment: 20,
            },
            missingPoints: 80,
          });
          return;
        }

        // Use backend-calculated weighted_score if available (already uses dynamic weights)
        // Otherwise fall back to static weights calculation
        const cumulative = progress.weighted_score ?? progress.cumulative_score ?? (
          ((progress.course_contribution_score || 0) * 0.10) +
          ((progress.quiz_score || 0) * 0.30) +
          ((progress.assignment_score || 0) * 0.40) +
          ((progress.final_assessment_score || 0) * 0.20)
        );

        console.log('✅ Using cumulative score:', cumulative, 'from components:', {
          courseContribution: progress.course_contribution_score,
          lessonsAverage: progress.lessons_average_score,
          quizzes: progress.quiz_score,
          assignments: progress.assignment_score,
          finalAssessment: progress.final_assessment_score,
          weightedScoreFromBackend: progress.weighted_score,
          cumulativeFromBackend: progress.cumulative_score
        });

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
          weights: {
            courseContribution: 10,
            quizzes: 30,
            assignments: 40,
            finalAssessment: 20,
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
      // Trigger backend recalculation
      try {
        await ProgressApiService.recalculateModuleScore(moduleId);
        console.log('🔄 Backend module score recalculated');
      } catch (recalcError) {
        console.warn('Could not trigger backend recalculation:', recalcError);
      }

      // Fetch detailed score breakdown with dynamic weights
      let scoreBreakdown = null;
      try {
        scoreBreakdown = await ProgressApiService.getModuleScoreBreakdown(moduleId);
        console.log('🔄 Fetched fresh score breakdown:', scoreBreakdown);
      } catch (breakdownError) {
        console.warn('Could not fetch score breakdown:', breakdownError);
      }

      // If we got the detailed breakdown, use it directly (has dynamic weights)
      if (scoreBreakdown && scoreBreakdown.breakdown) {
        const weights = {
          courseContribution: scoreBreakdown.breakdown.course_contribution?.weight || 10,
          quizzes: scoreBreakdown.breakdown.quizzes?.weight || 30,
          assignments: scoreBreakdown.breakdown.assignments?.weight || 40,
          finalAssessment: scoreBreakdown.breakdown.final_assessment?.weight || 20,
        };

        setScoringState({
          cumulativeScore: scoreBreakdown.cumulative_score || 0,
          passingThreshold: scoreBreakdown.passing_threshold || 80,
          isPassing: scoreBreakdown.is_passing || false,
          breakdown: {
            courseContribution: scoreBreakdown.breakdown.course_contribution?.score || 0,
            quizzes: scoreBreakdown.breakdown.quizzes?.score || 0,
            assignments: scoreBreakdown.breakdown.assignments?.score || 0,
            finalAssessment: scoreBreakdown.breakdown.final_assessment?.score || 0,
          },
          weights,
          missingPoints: scoreBreakdown.points_needed || Math.max(0, 80 - (scoreBreakdown.cumulative_score || 0)),
          assessmentInfo: scoreBreakdown.assessment_info,
        });
        return;
      }

      // Fallback to module progress API
      const moduleData = await ProgressApiService.getModuleProgress(moduleId);
      // Handle both response formats: data.data.progress and data.progress
      const progress = moduleData?.data?.progress || moduleData?.progress;

      console.log('🔄 Recalculating module scoring for module', moduleId, ':', progress);

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
          weights: {
            courseContribution: 10,
            quizzes: 30,
            assignments: 40,
            finalAssessment: 20,
          },
          missingPoints: 80,
        });
        return;
      }

      // Use backend-calculated weighted_score if available (already uses dynamic weights)
      const cumulative = progress.weighted_score ?? progress.cumulative_score ?? (
        ((progress.course_contribution_score || 0) * 0.10) +
        ((progress.quiz_score || 0) * 0.30) +
        ((progress.assignment_score || 0) * 0.40) +
        ((progress.final_assessment_score || 0) * 0.20)
      );

      console.log('✅ Recalculated cumulative score:', cumulative);

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
        weights: {
          courseContribution: 10,
          quizzes: 30,
          assignments: 40,
          finalAssessment: 20,
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
