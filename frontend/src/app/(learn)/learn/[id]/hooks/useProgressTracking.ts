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
  videoProgress?: number; // Video watch progress (0-100%)
  videoCurrentTime?: number; // Current playback position in seconds
  videoDuration?: number; // Total video duration in seconds
  videoCompleted?: boolean; // Whether video reached 90% threshold
}

export const useProgressTracking = ({
  currentLesson,
  currentModuleId,
  showCelebration,
  contentRef,
  interactionHistory,
  hasQuiz = false,
  hasAssignment = false,
  videoProgress = 0,
  videoCurrentTime = 0,
  videoDuration = 0,
  videoCompleted = false
}: UseProgressTrackingProps) => {
  const [readingProgress, setReadingProgress] = useState<number>(0);
  const [timeSpent, setTimeSpent] = useState<number>(0);
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [engagementScore, setEngagementScore] = useState<number>(0);
  const [lessonScore, setLessonScore] = useState<number>(0);
  const [isLessonCompleted, setIsLessonCompleted] = useState<boolean>(false);
  const [completionInProgress, setCompletionInProgress] = useState<boolean>(false);
  const [nextLessonInfo, setNextLessonInfo] = useState<any>(null);

  const startTimeRef = useRef<number>(Date.now());
  const lastInteractionRef = useRef<number>(Date.now());
  const readingTimeRef = useRef<number>(0);
  const maxScrollProgressRef = useRef<number>(0); // Track maximum scroll progress reached
  const maxReadingProgressRef = useRef<number>(0); // Track maximum reading progress reached
  const [progressLoaded, setProgressLoaded] = useState<boolean>(false);
  
  // Completion threshold (80%)
  const COMPLETION_THRESHOLD = 80;

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
        setLessonScore(existingProgress.lesson_score || 0);
        setScrollProgress(existingProgress.scroll_progress || 0);
        setEngagementScore(existingProgress.engagement_score || 0);
        setIsLessonCompleted(existingProgress.completed || false);
        
        // Initialize max progress refs with loaded values
        maxScrollProgressRef.current = existingProgress.scroll_progress || 0;
        maxReadingProgressRef.current = existingProgress.reading_progress || 0;
        
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
    
    let currentScrollProgress = 0;
    
    if (contentRef.current) {
      const element = contentRef.current;
      const scrollTop = element.scrollTop;
      const scrollHeight = element.scrollHeight - element.clientHeight;
      
      if (scrollHeight > 0) {
        currentScrollProgress = (scrollTop / scrollHeight) * 100;
      } else {
        currentScrollProgress = Math.min(100, (timeSinceStart / 180) * 100);
      }
    }
    
    // Only update scroll progress if it's higher than the maximum reached
    // This prevents progress from going down when scrolling up
    const newMaxScrollProgress = Math.max(maxScrollProgressRef.current, currentScrollProgress);
    maxScrollProgressRef.current = newMaxScrollProgress;
    
    setScrollProgress(Math.min(100, Math.max(0, newMaxScrollProgress)));
    
    const timeProgress = Math.min(100, (timeSinceStart / 300) * 100);
    const combinedProgress = Math.max(newMaxScrollProgress, timeProgress);
    
    // Only update reading progress if it's higher than the maximum reached
    // This ensures reading progress never decreases
    const newMaxReadingProgress = Math.max(maxReadingProgressRef.current, combinedProgress);
    maxReadingProgressRef.current = newMaxReadingProgress;
    
    setReadingProgress(newMaxReadingProgress);
    
    console.log('Progress update:', 
      `Current Scroll: ${currentScrollProgress.toFixed(1)}%, Max Scroll: ${newMaxScrollProgress.toFixed(1)}%, Time: ${timeProgress.toFixed(1)}%, Reading: ${newMaxReadingProgress.toFixed(1)}%`);
    
    if (currentScrollProgress > 0 || timeSinceStart > 10) {
      lastInteractionRef.current = currentTime;
      readingTimeRef.current += 2;
    }
    
    const engagementFactors = {
      scrollProgress: newMaxScrollProgress / 100,
      timeSpent: Math.min(timeSinceStart / 600, 1),
      interactions: Math.min(interactionHistory.length / 10, 1),
      consistency: Math.min(readingTimeRef.current / 100, 1),
      videoWatchProgress: videoProgress / 100  // Add video progress to engagement
    };
    
    // Dynamic engagement scoring based on content type
    let newEngagementScore: number;
    
    if (videoProgress > 0) {
      // For video content: video progress is major factor (40%), scroll (20%), time (20%), interactions (10%), consistency (10%)
      newEngagementScore = (
        engagementFactors.videoWatchProgress * 0.4 +
        engagementFactors.scrollProgress * 0.2 +
        engagementFactors.timeSpent * 0.2 +
        engagementFactors.interactions * 0.1 +
        engagementFactors.consistency * 0.1
      ) * 100;
    } else {
      // For text/mixed content without video: original formula
      newEngagementScore = (
        engagementFactors.scrollProgress * 0.3 +
        engagementFactors.timeSpent * 0.3 +
        engagementFactors.interactions * 0.2 +
        engagementFactors.consistency * 0.2
      ) * 100;
    }
    
    setEngagementScore(newEngagementScore);
    
    // Calculate estimated lesson score (this will be confirmed by backend)
    // For lessons without quiz/assignment: 50% reading + 50% engagement
    // For lessons with quiz: 35% reading + 35% engagement + 30% quiz
    // For lessons with assignment: 35% reading + 35% engagement + 30% assignment
    // For both: 25% each
    let estimatedScore = 0;
    if (!hasQuiz && !hasAssignment) {
      estimatedScore = (maxReadingProgressRef.current * 0.5) + (newEngagementScore * 0.5);
    } else if (hasQuiz && !hasAssignment) {
      estimatedScore = (maxReadingProgressRef.current * 0.35) + (newEngagementScore * 0.35);
    } else if (!hasQuiz && hasAssignment) {
      estimatedScore = (maxReadingProgressRef.current * 0.35) + (newEngagementScore * 0.35);
    } else {
      estimatedScore = (maxReadingProgressRef.current * 0.25) + (newEngagementScore * 0.25);
    }
    setLessonScore(estimatedScore);
  }, [interactionHistory.length, showCelebration, contentRef, progressLoaded, isLessonCompleted, hasQuiz, hasAssignment, videoProgress, videoCurrentTime, videoDuration]);

  // Check if lesson should auto-complete based on 80% lesson score
  const checkAutoCompletion = useCallback(() => {
    // Don't auto-complete if:
    // - Already completed
    // - Completion already in progress
    // - Not loaded progress yet
    if (isLessonCompleted || completionInProgress || !progressLoaded) {
      return false;
    }

    // Calculate the actual lesson score based on available components
    let actualScore = 0;
    if (!hasQuiz && !hasAssignment) {
      // No assessments: Reading 50%, Engagement 50%
      actualScore = (readingProgress * 0.5) + (engagementScore * 0.5);
    } else if (hasQuiz && !hasAssignment) {
      // Quiz only: Reading 35%, Engagement 35%, Quiz 30% (quiz not counted yet)
      actualScore = (readingProgress * 0.35) + (engagementScore * 0.35);
    } else if (!hasQuiz && hasAssignment) {
      // Assignment only: Reading 35%, Engagement 35%, Assignment 30% (assignment not counted yet)
      actualScore = (readingProgress * 0.35) + (engagementScore * 0.35);
    } else {
      // Both: Reading 25%, Engagement 25%, Quiz 25%, Assignment 25%
      actualScore = (readingProgress * 0.25) + (engagementScore * 0.25);
    }

    // ONLY auto-complete if the calculated lesson score meets the 80% threshold
    // This prevents premature completion celebration
    const meetsScoreThreshold = actualScore >= COMPLETION_THRESHOLD;

    if (meetsScoreThreshold) {
      console.log('✅ Auto-completion criteria met:', {
        actualScore: actualScore.toFixed(1),
        readingProgress: readingProgress.toFixed(1),
        engagementScore: engagementScore.toFixed(1),
        threshold: COMPLETION_THRESHOLD,
        hasQuiz,
        hasAssignment
      });
      return true;
    }

    console.log('📊 Auto-completion check - not yet met:', {
      actualScore: actualScore.toFixed(1),
      threshold: COMPLETION_THRESHOLD,
      remaining: (COMPLETION_THRESHOLD - actualScore).toFixed(1)
    });
    return false;
  }, [isLessonCompleted, completionInProgress, progressLoaded, readingProgress, engagementScore, hasQuiz, hasAssignment]);

  // Auto-save progress and check for auto-completion
  // Only pushes to database when lesson score is above 80% threshold OR forceSave is true
  const autoSaveProgress = useCallback(async (
    onAutoComplete?: (data: any) => void,
    forceSave: boolean = false
  ) => {
    if (!currentLesson || !progressLoaded) return;
    
    // Skip if already completed (unless forcing save)
    if (isLessonCompleted && !forceSave) return;
    
    // Determine if we should save:
    // 1. forceSave is true (manual trigger like unlock button)
    // 2. lessonScore is above the completion threshold (80%)
    // 3. readingProgress is at 100% (user has read entire content)
    const shouldSave = forceSave || lessonScore >= COMPLETION_THRESHOLD || readingProgress >= 100;
    
    if (!shouldSave) {
      console.log(`📊 Progress not saved - score ${lessonScore.toFixed(1)}%, reading ${readingProgress.toFixed(1)}% (need ${COMPLETION_THRESHOLD}% score or 100% reading)`);
      return;
    }
    
    try {
      const saveReason = forceSave ? 'FORCED SAVE' : 
        (readingProgress >= 100 ? 'reading complete (100%)' : `score ${lessonScore.toFixed(1)}% meets threshold`);
      console.log(`📤 Saving progress to database - ${saveReason}`);
      
      const response = await StudentApiService.updateLessonProgress(currentLesson.id, {
        reading_progress: readingProgress,
        engagement_score: engagementScore,
        scroll_progress: scrollProgress,
        time_spent: Math.floor((Date.now() - startTimeRef.current) / 1000),
        video_progress: videoProgress,  // Include video progress percentage
        video_current_time: videoCurrentTime,  // Current playback position
        video_duration: videoDuration,  // Total video duration
        video_completed: videoCompleted,  // Whether 90% threshold reached
        auto_saved: !forceSave
      });
      
      console.log('Progress saved successfully', response);
      
      // Check if backend auto-completed the lesson
      if (response.auto_completed) {
        console.log('🎉 Lesson auto-completed by backend!', response.completion_message);
        setIsLessonCompleted(true);
        setLessonScore(response.progress?.lesson_score || lessonScore);
        
        // Store next lesson info if available
        if (response.next_lesson_unlocked && response.next_lesson) {
          setNextLessonInfo(response.next_lesson);
          console.log('🔓 Next lesson unlocked:', response.next_lesson);
        }
        
        // Trigger completion callback
        if (onAutoComplete) {
          onAutoComplete({
            type: 'auto_completed',
            lessonId: currentLesson.id,
            moduleId: currentModuleId,
            lessonScore: response.progress?.lesson_score,
            nextLesson: response.next_lesson,
            message: response.completion_message
          });
        }
      } else if (response.progress?.lesson_score) {
        // Update lesson score from backend
        setLessonScore(response.progress.lesson_score);
      }
      
      return response;
    } catch (error) {
      console.error('Save failed:', error);
      throw error;
    }
  }, [currentLesson, currentModuleId, readingProgress, engagementScore, scrollProgress, videoProgress, videoCurrentTime, videoDuration, videoCompleted, isLessonCompleted, lessonScore, progressLoaded]);

  // Force save progress regardless of score threshold
  // Used when user manually triggers actions like unlocking next module
  const forceSaveProgress = useCallback(async () => {
    console.log('💾 Force saving lesson progress...');
    return autoSaveProgress(undefined, true);
  }, [autoSaveProgress]);

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
        video_progress: videoProgress,  // Include video progress
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
      maxScrollProgressRef.current = 0; // Reset max scroll progress
      maxReadingProgressRef.current = 0; // Reset max reading progress
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

  // Auto-save timer with auto-completion check
  useEffect(() => {
    if (currentLesson && !isLessonCompleted) {
      const timer = setInterval(() => autoSaveProgress(), 30000);
      return () => clearInterval(timer);
    }
  }, [currentLesson, autoSaveProgress, isLessonCompleted]);

  return {
    readingProgress,
    timeSpent,
    scrollProgress,
    engagementScore,
    lessonScore,
    isLessonCompleted,
    completionInProgress,
    progressLoaded,
    nextLessonInfo,
    completionThreshold: COMPLETION_THRESHOLD,
    updateReadingProgress,
    autoSaveProgress,
    forceSaveProgress,
    handleAutoLessonCompletion,
    setIsLessonCompleted,
    setCompletionInProgress,
    loadExistingProgress,
    checkAutoCompletion,
    setNextLessonInfo
  };
};

