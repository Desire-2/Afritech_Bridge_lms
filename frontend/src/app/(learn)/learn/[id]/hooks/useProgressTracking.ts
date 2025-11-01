import { useState, useEffect, useRef, useCallback } from 'react';
import { StudentApiService } from '@/services/studentApi';
import { ProgressData, InteractionEvent } from '../types';

interface UseProgressTrackingProps {
  currentLesson: any;
  currentModuleId: number | null;
  showCelebration: boolean;
  contentRef?: any;
  interactionHistory: InteractionEvent[];
}

export const useProgressTracking = ({
  currentLesson,
  currentModuleId,
  showCelebration,
  contentRef,
  interactionHistory
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

  // Update reading progress based on scroll and time
  const updateReadingProgress = useCallback(() => {
    if (showCelebration) return;
    
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
  }, [interactionHistory.length, showCelebration, contentRef]);

  // Auto-save progress
  const autoSaveProgress = useCallback(async () => {
    if (!currentLesson || isLessonCompleted) return;
    
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
    if (!currentLesson || isLessonCompleted || completionInProgress) return;
    
    try {
      setCompletionInProgress(true);
      setIsLessonCompleted(true);
      
      const timeSpentSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
      
      console.log('Attempting to complete lesson:', {
        lessonId: currentLesson.id,
        progressData: {
          time_spent: timeSpentSeconds,
          reading_progress: readingProgress,
          engagement_score: engagementScore,
          scroll_progress: scrollProgress,
          completion_method: 'automatic'
        }
      });
      
      await StudentApiService.completeLesson(currentLesson.id, {
        time_spent: timeSpentSeconds,
        reading_progress: readingProgress,
        engagement_score: engagementScore,
        scroll_progress: scrollProgress,
        completion_method: 'automatic'
      });
      
      onComplete({
        type: 'lesson_completed',
        lessonId: currentLesson.id,
        moduleId: currentModuleId,
        timestamp: new Date().toISOString(),
        timeSpent: timeSpentSeconds,
        engagementScore: engagementScore
      });
      
    } catch (error: any) {
      console.error('Failed to complete lesson:', error);
      
      if (error?.response?.status === 400 && error?.response?.data?.message?.includes('already completed')) {
        console.log('Lesson was already completed, proceeding with celebration');
      } else {
        setIsLessonCompleted(false);
        setCompletionInProgress(false);
        if (onError) onError(error);
      }
    } finally {
      setTimeout(() => {
        setCompletionInProgress(false);
      }, 1000);
    }
  }, [currentLesson, currentModuleId, readingProgress, engagementScore, scrollProgress, isLessonCompleted, completionInProgress]);

  // Reset progress when lesson changes
  useEffect(() => {
    if (currentLesson) {
      startTimeRef.current = Date.now();
      setReadingProgress(0);
      setScrollProgress(0);
      setEngagementScore(0);
      setTimeSpent(0);
      setIsLessonCompleted(false);
      readingTimeRef.current = 0;
    }
  }, [currentLesson?.id]);

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
    updateReadingProgress,
    autoSaveProgress,
    handleAutoLessonCompletion,
    setIsLessonCompleted,
    setCompletionInProgress
  };
};
