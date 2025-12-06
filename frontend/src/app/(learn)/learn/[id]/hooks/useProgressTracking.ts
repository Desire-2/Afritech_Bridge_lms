import { useState, useEffect, useRef, useCallback } from 'react';
import { StudentApiService } from '@/services/studentApi';
import { ProgressData, InteractionEvent } from '../types';

interface UseProgressTrackingProps {
  currentLesson: any;
  currentModuleId: number | null;
  showCelebration: boolean;
  contentRef?: any;
  interactionHistory: InteractionEvent[];
  hasQuiz?: boolean;
  hasAssignment?: boolean;
}

export const useProgressTracking = ({
  currentLesson,
  currentModuleId,
  showCelebration,
  contentRef,
  interactionHistory,
  hasQuiz = false,
  hasAssignment = false
}: UseProgressTrackingProps) => {
  const [readingProgress, setReadingProgress] = useState<number>(0);
  const [timeSpent, setTimeSpent] = useState<number>(0);
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [engagementScore, setEngagementScore] = useState<number>(0);
  const [isLessonCompleted, setIsLessonCompleted] = useState<boolean>(false);
  const [completionInProgress, setCompletionInProgress] = useState<boolean>(false);

  const startTimeRef = useRef<number>(Date.now());
  const lastInteractionRef = useRef<number>(Date.now());
  const readingTimeRef = useRef<number>(0);
  const [progressLoaded, setProgressLoaded] = useState<boolean>(false);

  // Load existing progress from backend
  const loadExistingProgress = useCallback(async () => {
    if (!currentLesson) return;
    
    try {
      const response = await StudentApiService.getLessonProgress(currentLesson.id);
      const existingProgress = response.progress;
      
      if (existingProgress) {
        console.log('📊 Loaded existing progress:', existingProgress);
        
        // Set progress from backend
        setReadingProgress(existingProgress.reading_progress || 0);
        setScrollProgress(existingProgress.scroll_progress || 0);
        setEngagementScore(existingProgress.engagement_score || 0);
        setIsLessonCompleted(existingProgress.completed || false);
        
        // If lesson is completed, prevent further tracking
        if (existingProgress.completed) {
          console.log('✅ Lesson already completed, disabling progress tracking');
          setCompletionInProgress(false);
        }
        
        // If lesson has progress, adjust the start time to account for existing time
        if (existingProgress.time_spent > 0) {
          startTimeRef.current = Date.now() - (existingProgress.time_spent * 1000);
          setTimeSpent(existingProgress.time_spent);
        }
        
        setProgressLoaded(true);
      } else {
        // No existing progress, start fresh
        setProgressLoaded(true);
      }
    } catch (error) {
      console.error('Failed to load existing progress:', error);
      setProgressLoaded(true); // Continue even if load fails
    }
  }, [currentLesson]);

  // Update reading progress based on scroll and time
  const updateReadingProgress = useCallback(() => {
    if (showCelebration || !progressLoaded || isLessonCompleted) return;
    
    const currentTime = Date.now();
    const timeSinceStart = (currentTime - startTimeRef.current) / 1000;
    
    let scrollProgress = 0;
    
    if (contentRef.current) {
      const element = contentRef.current;
      const scrollTop = element.scrollTop;
      const scrollHeight = element.scrollHeight - element.clientHeight;
      
      if (scrollHeight > 0) {
        scrollProgress = (scrollTop / scrollHeight) * 100;
      } else {
        scrollProgress = Math.min(100, (timeSinceStart / 180) * 100);
      }
    }
    
    setScrollProgress(Math.min(100, Math.max(0, scrollProgress)));
    
    const timeProgress = Math.min(100, (timeSinceStart / 300) * 100);
    const combinedProgress = Math.max(scrollProgress, timeProgress);
    setReadingProgress(combinedProgress);
    
    console.log('Progress update:', 
      `Scroll: ${scrollProgress.toFixed(1)}%, Time: ${timeProgress.toFixed(1)}%, Combined: ${combinedProgress.toFixed(1)}%`);
    
    if (scrollProgress > 0 || timeSinceStart > 10) {
      lastInteractionRef.current = currentTime;
      readingTimeRef.current += 2;
    }
    
    const engagementFactors = {
      scrollProgress: scrollProgress / 100,
      timeSpent: Math.min(timeSinceStart / 600, 1),
      interactions: Math.min(interactionHistory.length / 10, 1),
      consistency: Math.min(readingTimeRef.current / 100, 1)
    };
    
    const newEngagementScore = (
      engagementFactors.scrollProgress * 0.3 +
      engagementFactors.timeSpent * 0.3 +
      engagementFactors.interactions * 0.2 +
      engagementFactors.consistency * 0.2
    ) * 100;
    
    setEngagementScore(newEngagementScore);
  }, [interactionHistory.length, showCelebration, contentRef, progressLoaded]);

  // Check if lesson should auto-complete (for lessons without quiz/assignment)
  const checkAutoCompletion = useCallback(() => {
    // Don't auto-complete if:
    // - Already completed
    // - Lesson has quiz or assignment (they need to be completed separately)
    // - Completion already in progress
    // - Not loaded progress yet
    if (isLessonCompleted || hasQuiz || hasAssignment || completionInProgress || !progressLoaded) {
      return false;
    }

    // Auto-complete criteria:
    // - Reading progress >= 80%
    // - Engagement score >= 60%
    const meetsReadingRequirement = readingProgress >= 80;
    const meetsEngagementRequirement = engagementScore >= 60;

    if (meetsReadingRequirement && meetsEngagementRequirement) {
      console.log('✅ Auto-completion criteria met:', {
        readingProgress: readingProgress.toFixed(1),
        engagementScore: engagementScore.toFixed(1),
        hasQuiz,
        hasAssignment
      });
      return true;
    }

    return false;
  }, [isLessonCompleted, hasQuiz, hasAssignment, completionInProgress, progressLoaded, readingProgress, engagementScore]);

  // Auto-save progress
  const autoSaveProgress = useCallback(async () => {
    if (!currentLesson || isLessonCompleted || !progressLoaded) return;
    
    try {
      await StudentApiService.updateLessonProgress(currentLesson.id, {
        reading_progress: readingProgress,
        engagement_score: engagementScore,
        scroll_progress: scrollProgress,
        time_spent: Math.floor((Date.now() - startTimeRef.current) / 1000),
        auto_saved: true
      });
      console.log('Progress auto-saved successfully');
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }, [currentLesson, readingProgress, engagementScore, scrollProgress, isLessonCompleted]);

  // Handle automatic lesson completion
  const handleAutoLessonCompletion = useCallback(async (
    onComplete: (data: any) => void,
    onError?: (error: any) => void
  ) => {
    if (!currentLesson || isLessonCompleted || completionInProgress) {
      console.log('⏭️ Skipping completion:', { isLessonCompleted, completionInProgress });
      return;
    }
    
    try {
      setCompletionInProgress(true);
      
      const timeSpentSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
      
      console.log('🎯 Attempting to complete lesson:', {
        lessonId: currentLesson.id,
        progressData: {
          time_spent: timeSpentSeconds,
          reading_progress: readingProgress,
          engagement_score: engagementScore,
          scroll_progress: scrollProgress,
          completion_method: 'automatic'
        }
      });
      
      const result = await StudentApiService.completeLesson(currentLesson.id, {
        time_spent: timeSpentSeconds,
        reading_progress: readingProgress,
        engagement_score: engagementScore,
        scroll_progress: scrollProgress,
        completion_method: 'automatic'
      });
      
      // Mark as completed only after successful backend save
      setIsLessonCompleted(true);
      
      console.log('✅ Lesson completion saved to database:', result);
      
      onComplete({
        type: 'lesson_completed',
        lessonId: currentLesson.id,
        moduleId: currentModuleId,
        timestamp: new Date().toISOString(),
        timeSpent: timeSpentSeconds,
        engagementScore: engagementScore,
        backendResult: result
      });
      
    } catch (error: any) {
      console.error('❌ Failed to complete lesson:', error);
      
      // Check if failure is due to quiz requirement
      if (error?.response?.status === 402 && error?.response?.data?.quiz_required) {
        console.log('📝 Quiz is required for this lesson:', error?.response?.data?.quiz_info);
        
        // Return quiz requirement info
        if (onError) {
          onError({
            type: 'quiz_required',
            ...error?.response?.data?.quiz_info
          });
        }
      } else if (error?.response?.status === 200 || (error?.response?.status === 400 && error?.response?.data?.message?.includes('already completed'))) {
        console.log('✅ Lesson was already completed in database');
        setIsLessonCompleted(true);
      } else {
        console.error('⚠️ Error completing lesson, will not mark as complete');
        if (onError) onError(error);
      }
    } finally {
      setTimeout(() => {
        setCompletionInProgress(false);
      }, 1000);
    }
  }, [currentLesson, currentModuleId, readingProgress, engagementScore, scrollProgress, isLessonCompleted, completionInProgress]);

  // Reset progress and load existing data when lesson changes
  useEffect(() => {
    if (currentLesson) {
      // Reset to defaults first
      startTimeRef.current = Date.now();
      setReadingProgress(0);
      setScrollProgress(0);
      setEngagementScore(0);
      setTimeSpent(0);
      setIsLessonCompleted(false);
      readingTimeRef.current = 0;
      setProgressLoaded(false);
      
      // Then load existing progress from backend
      loadExistingProgress();
    }
  }, [currentLesson?.id, loadExistingProgress]);

  // Time tracking
  useEffect(() => {
    const timer = setInterval(() => {
      if (showCelebration) return;
      
      setTimeSpent(Math.floor((Date.now() - startTimeRef.current) / 1000));
      updateReadingProgress();
    }, 2000);
    
    return () => clearInterval(timer);
  }, [updateReadingProgress, showCelebration]);

  // Auto-save timer
  useEffect(() => {
    if (currentLesson && !isLessonCompleted) {
      const timer = setInterval(autoSaveProgress, 30000);
      return () => clearInterval(timer);
    }
  }, [currentLesson, autoSaveProgress, isLessonCompleted]);

  return {
    readingProgress,
    timeSpent,
    scrollProgress,
    engagementScore,
    isLessonCompleted,
    completionInProgress,
    progressLoaded,
    updateReadingProgress,
    autoSaveProgress,
    handleAutoLessonCompletion,
    setIsLessonCompleted,
    setCompletionInProgress,
    loadExistingProgress,
    checkAutoCompletion
  };
};
