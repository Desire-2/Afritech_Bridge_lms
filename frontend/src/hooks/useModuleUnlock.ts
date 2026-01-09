import { useState, useEffect, useCallback } from 'react';
import { EnhancedModuleUnlockService, ModuleUnlockEligibility, ModuleUnlockResult, CourseUnlockProgress } from '@/services/enhancedModuleUnlockService';

export interface UseModuleUnlockProps {
  courseId: number;
  currentModuleId?: number;
  onUnlockSuccess?: (result: ModuleUnlockResult) => void;
  onUnlockError?: (error: string) => void;
  autoRefreshInterval?: number; // in milliseconds
}

export interface ModuleUnlockState {
  // Eligibility data
  eligibility: ModuleUnlockEligibility | null;
  
  // Progress data
  courseProgress: CourseUnlockProgress | null;
  
  // Loading states
  isCheckingEligibility: boolean;
  isLoadingProgress: boolean;
  isUnlocking: boolean;
  
  // Error states
  eligibilityError: string | null;
  progressError: string | null;
  unlockError: string | null;
  
  // Derived states
  canUnlockCurrent: boolean;
  canPreviewNext: boolean;
  nextUnlockableModule: any | null;
  overallProgress: number;
  
  // Actions
  checkEligibility: (moduleId: number) => Promise<void>;
  attemptUnlock: (moduleId: number) => Promise<ModuleUnlockResult | null>;
  refreshProgress: () => Promise<void>;
  clearErrors: () => void;
  
  // Notifications
  preUnlockWarning: boolean;
  shouldShowCelebration: boolean;
  celebrationData: any;
}

export const useModuleUnlock = ({
  courseId,
  currentModuleId,
  onUnlockSuccess,
  onUnlockError,
  autoRefreshInterval = 30000 // 30 seconds
}: UseModuleUnlockProps): ModuleUnlockState => {
  
  // State management
  const [eligibility, setEligibility] = useState<ModuleUnlockEligibility | null>(null);
  const [courseProgress, setCourseProgress] = useState<CourseUnlockProgress | null>(null);
  
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const [isLoadingProgress, setIsLoadingProgress] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  
  const [preUnlockWarning, setPreUnlockWarning] = useState(false);
  const [shouldShowCelebration, setShouldShowCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState<any>(null);

  // Check eligibility for a specific module
  const checkEligibility = useCallback(async (moduleId: number) => {
    if (!moduleId) return;
    
    setIsCheckingEligibility(true);
    setEligibilityError(null);
    
    try {
      const result = await EnhancedModuleUnlockService.checkModuleUnlockEligibility(moduleId);
      setEligibility(result);
      
      // Check for pre-unlock warning (85%+ progress)
      if (result.total_score >= 85 && result.total_score < result.required_score) {
        setPreUnlockWarning(true);
      } else {
        setPreUnlockWarning(false);
      }
      
    } catch (error: any) {
      setEligibilityError(error.message);
      setEligibility(null);
    } finally {
      setIsCheckingEligibility(false);
    }
  }, []);

  // Attempt to unlock a module
  const attemptUnlock = useCallback(async (moduleId: number): Promise<ModuleUnlockResult | null> => {
    if (!moduleId) return null;
    
    setIsUnlocking(true);
    setUnlockError(null);
    
    try {
      const result = await EnhancedModuleUnlockService.attemptModuleUnlock(moduleId);
      
      if (result.success) {
        // Handle success
        onUnlockSuccess?.(result);
        
        // Set up celebration data
        const celebration = EnhancedModuleUnlockService.getCelebrationData(result);
        setCelebrationData(celebration);
        setShouldShowCelebration(celebration.shouldCelebrate);
        
        // Refresh progress after successful unlock
        await refreshProgress();
        
        // Clear pre-unlock warning
        setPreUnlockWarning(false);
        
        return result;
      } else {
        setUnlockError(result.error || 'Unlock failed');
        onUnlockError?.(result.error || 'Unlock failed');
        return null;
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Network error during unlock';
      setUnlockError(errorMsg);
      onUnlockError?.(errorMsg);
      return null;
    } finally {
      setIsUnlocking(false);
    }
  }, [onUnlockSuccess, onUnlockError]);

  // Refresh course progress
  const refreshProgress = useCallback(async () => {
    if (!courseId) return;
    
    setIsLoadingProgress(true);
    setProgressError(null);
    
    try {
      const result = await EnhancedModuleUnlockService.getCourseUnlockProgress(courseId);
      setCourseProgress(result);
    } catch (error: any) {
      setProgressError(error.message);
      setCourseProgress(null);
    } finally {
      setIsLoadingProgress(false);
    }
  }, [courseId]);

  // Clear all errors
  const clearErrors = useCallback(() => {
    setEligibilityError(null);
    setProgressError(null);
    setUnlockError(null);
  }, []);

  // Clear celebration
  const clearCelebration = useCallback(() => {
    setShouldShowCelebration(false);
    setCelebrationData(null);
  }, []);

  // Auto-refresh effect
  useEffect(() => {
    if (!courseId || !autoRefreshInterval) return;
    
    const interval = setInterval(() => {
      refreshProgress();
      if (currentModuleId) {
        checkEligibility(currentModuleId);
      }
    }, autoRefreshInterval);
    
    return () => clearInterval(interval);
  }, [courseId, currentModuleId, autoRefreshInterval, refreshProgress, checkEligibility]);

  // Initial load effect
  useEffect(() => {
    if (courseId) {
      refreshProgress();
    }
  }, [courseId, refreshProgress]);

  // Check eligibility when current module changes
  useEffect(() => {
    if (currentModuleId) {
      checkEligibility(currentModuleId);
    }
  }, [currentModuleId, checkEligibility]);

  // Derived states
  const canUnlockCurrent = eligibility?.eligible ?? false;
  const canPreviewNext = eligibility?.can_preview ?? false;
  const nextUnlockableModule = courseProgress?.next_unlockable_module ?? null;
  const overallProgress = courseProgress?.overall_progress ?? 0;

  return {
    // Data
    eligibility,
    courseProgress,
    
    // Loading states
    isCheckingEligibility,
    isLoadingProgress,
    isUnlocking,
    
    // Error states
    eligibilityError,
    progressError,
    unlockError,
    
    // Derived states
    canUnlockCurrent,
    canPreviewNext,
    nextUnlockableModule,
    overallProgress,
    
    // Actions
    checkEligibility,
    attemptUnlock,
    refreshProgress,
    clearErrors,
    
    // Notifications
    preUnlockWarning,
    shouldShowCelebration,
    celebrationData
  };
};

export default useModuleUnlock;