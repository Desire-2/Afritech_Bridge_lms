"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useParams } from 'next/navigation';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { StudentApiService } from '@/services/studentApi';
import { AssessmentApiService, ProgressApiService } from '@/services/api';
import { EnhancedModuleUnlockService } from '@/services/enhancedModuleUnlockService';
import ContentAssignmentService, { type ContentQuiz, type ContentAssignment } from '@/services/contentAssignmentApi';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Loader2, AlertCircle, BookOpen, Award, X, Lock, Target, CheckCircle, ArrowRight, Unlock, Wifi, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useProgressiveLearning, useModuleAttempts, useModuleScoring } from '@/hooks/useProgressiveLearning';
import { motion, AnimatePresence } from 'framer-motion';

// Import custom components and utilities
import { LearningHeader } from './components/LearningHeader';
import { LearningSidebar } from './components/LearningSidebar';
import { LessonContent } from './components/LessonContent';
import { CelebrationModal } from './components/CelebrationModal';
import { UnlockAnimation } from './components/UnlockAnimation';
import { LessonScoreDisplay } from './components/LessonScoreDisplay';
import { ModuleUnlockErrorDialog } from '@/components/ui/ModuleUnlockErrorDialog';
import { useProgressTracking } from './hooks/useProgressTracking';
import * as NavUtils from './utils/navigationUtils';
import type { 
  CourseCompletion, 
  InteractionEvent, 
  ViewMode, 
  CourseData,
  ModuleStatus
} from './types';

// Helper functions for localStorage
const STORAGE_KEY_PREFIX = 'learn_progress_';

const saveLastLesson = (courseId: number, lessonId: number, moduleId: number) => {
  try {
    const key = `${STORAGE_KEY_PREFIX}${courseId}`;
    localStorage.setItem(key, JSON.stringify({
      lessonId,
      moduleId,
      timestamp: new Date().toISOString()
    }));
  } catch (error) {
    console.error('Failed to save lesson progress to localStorage:', error);
  }
};

const loadLastLesson = (courseId: number): { lessonId: number; moduleId: number } | null => {
  try {
    const key = `${STORAGE_KEY_PREFIX}${courseId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Check if stored data is less than 7 days old
      const timestamp = new Date(parsed.timestamp);
      const now = new Date();
      const daysDiff = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff < 7) {
        return { lessonId: parsed.lessonId, moduleId: parsed.moduleId };
      }
    }
  } catch (error) {
    console.error('Failed to load lesson progress from localStorage:', error);
  }
  return null;
};

// Enhanced Learning Interface Component with Automatic Progress Tracking
const LearningPage = () => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const params = useParams();
  const courseId = parseInt(params.id as string);
  
  // Check if this is instructor view_as_student mode (client-side only)
  const [viewAsStudent, setViewAsStudent] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      setViewAsStudent(urlParams.get('view_as_student') === 'true');
    }
  }, []);
  
  // Core state - ALL HOOKS MUST BE DECLARED FIRST
  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentLesson, setCurrentLesson] = useState<any>(null);
  const [currentModuleId, setCurrentModuleId] = useState<number | null>(null);
  
  // Enhanced content state
  const [lessonQuiz, setLessonQuiz] = useState<ContentQuiz | null>(null);
  const [lessonAssignments, setLessonAssignments] = useState<ContentAssignment[]>([]);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentLoadedForLesson, setContentLoadedForLesson] = useState<number | null>(null);
  
  // Course Completion Tracking
  const [courseCompletion, setCourseCompletion] = useState<CourseCompletion>({
    totalLessons: 0,
    completedLessons: 0,
    totalQuizzes: 0,
    completedQuizzes: 0,
    totalAssignments: 0,
    completedAssignments: 0,
    overallScore: 0,
    passingThreshold: 80
  });
  const [newBadgesEarned, setNewBadgesEarned] = useState<string[]>([]);
  const [showCertificateNotification, setShowCertificateNotification] = useState(false);
  
  // UI Enhancement State
  const [showUnlockAnimation, setShowUnlockAnimation] = useState(false);
  const [unlockedModuleName, setUnlockedModuleName] = useState<string | null>(null);
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [currentViewMode, setCurrentViewMode] = useState<ViewMode>('content');
  const [interactionHistory, setInteractionHistory] = useState<InteractionEvent[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [lessonNotes, setLessonNotes] = useState<string>('');
  
  // Auto-close sidebar on small screens when interface loads
  useEffect(() => {
    const checkScreenSize = () => {
      // Close sidebar on screens smaller than lg breakpoint (1024px)
      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
      }
    };

    // Check on mount
    checkScreenSize();

    // Add listener for screen resize
    window.addEventListener('resize', checkScreenSize);

    // Cleanup
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []); // Only run on mount
  
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [lessonAssessments, setLessonAssessments] = useState<{ [lessonId: number]: any[] }>({});
  const [lessonCompletionStatus, setLessonCompletionStatus] = useState<{ [lessonId: number]: boolean }>({});
  const [quizLoadError, setQuizLoadError] = useState<string | null>(null);
  const [quizCompletionStatus, setQuizCompletionStatus] = useState<{ [quizId: number]: { completed: boolean; score: number; passed: boolean } }>({});
  const [currentLessonQuizScore, setCurrentLessonQuizScore] = useState(0);
  const [currentLessonAssignmentScore, setCurrentLessonAssignmentScore] = useState(0);
  const [lessonScore, setLessonScore] = useState(0);
  
  // Track completion attempts to prevent multiple simultaneous calls
  const completionAttemptRef = useRef<number | null>(null);
  
  // Video tracking state
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoCompleted, setVideoCompleted] = useState(false);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  
  // Mixed content video progress tracking (map of videoIndex -> progress)
  const [mixedContentVideoProgress, setMixedContentVideoProgress] = useState<Record<number, number>>({});
  const [mixedContentVideosCompleted, setMixedContentVideosCompleted] = useState<Set<number>>(new Set());

  // Reset video progress when lesson changes
  useEffect(() => {
    console.log('🔄 Lesson changed, resetting video progress states');
    setVideoProgress(0);
    setVideoCompleted(false);
    setVideoCurrentTime(0);
    setVideoDuration(0);
    setMixedContentVideoProgress({});
    setMixedContentVideosCompleted(new Set());
  }, [currentLesson?.id]);
  
  // Module progress requirements modal state
  const [showModuleProgressModal, setShowModuleProgressModal] = useState(false);
  const [moduleProgressInfo, setModuleProgressInfo] = useState<{
    moduleName: string;
    nextModuleName: string;
    currentScore: number;
    requiredScore: number;
    missingItems: string[];
    breakdown: {
      courseContribution: number;
      quizzes: number;
      assignments: number;
      finalAssessment: number;
    };
    weights?: {
      courseContribution: number;
      quizzes: number;
      assignments: number;
      finalAssessment: number;
    };
    assessmentInfo?: {
      hasQuizzes: boolean;
      hasAssignments: boolean;
      hasFinalAssessment: boolean;
      isReadingOnly: boolean;
    };
  } | null>(null);
  
  // Locked module requirements modal state
  const [showLockedModuleModal, setShowLockedModuleModal] = useState(false);
  const [lockedModuleInfo, setLockedModuleInfo] = useState<{
    moduleId: number;
    moduleTitle: string;
    moduleIndex: number;
    previousModuleTitle: string;
    previousModuleId: number;
    previousModuleScore: number;
    previousModuleLessonsCompleted: number;
    previousModuleTotalLessons: number;
    requiredScore: number;
  } | null>(null);
  const [lockedModuleEligibility, setLockedModuleEligibility] = useState<any | null>(null);
  const [lockedModuleEligibilityLoading, setLockedModuleEligibilityLoading] = useState(false);
  const [modalUnlocking, setModalUnlocking] = useState(false);
  
  // Module unlock error dialog state
  const [showUnlockErrorDialog, setShowUnlockErrorDialog] = useState(false);
  const [unlockErrorInfo, setUnlockErrorInfo] = useState<any>(null);
  const [unlockTargetModuleId, setUnlockTargetModuleId] = useState<number | null>(null);
  
  // Refs for tracking
  const contentRef = useRef<HTMLDivElement | null>(null);
  const autoAdvanceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const checkAndUnlockNextModuleRef = useRef<(() => Promise<void>) | null>(null);
  const unlockingRef = useRef<boolean>(false);

  // Authentication check effect - must be called after all hooks
  useEffect(() => {
    if (!mounted || authLoading) {
      return;
    }
    
    if (!isAuthenticated) {
      // Only redirect after component is mounted and auth loading is complete
      window.location.href = '/auth/login';
      return;
    }
  }, [mounted, isAuthenticated, authLoading]);
  
  // Progressive Learning Hooks
  const progressiveLearning = useProgressiveLearning(courseId, viewAsStudent);
  const moduleAttempts = useModuleAttempts(currentModuleId || 0);
  const moduleScoring = useModuleScoring(currentModuleId || 0);

  // Check if all lessons in current module are completed
  const checkModuleCompletion = useCallback(() => {
    if (!courseData?.course?.modules || !currentModuleId) return false;
    
    const currentModule = courseData.course.modules.find((m: any) => m.id === currentModuleId);
    if (!currentModule?.lessons) return false;
    
    const moduleLessons = currentModule.lessons || [];
    const completedCount = moduleLessons.filter((lesson: any) => 
      lessonCompletionStatus[lesson.id] === true
    ).length;
    
    const allLessonsCompleted = completedCount === moduleLessons.length && moduleLessons.length > 0;
    
    console.log(`📊 Module ${currentModuleId} completion check:`, {
      totalLessons: moduleLessons.length,
      completedLessons: completedCount,
      allCompleted: allLessonsCompleted
    });
    
    return allLessonsCompleted;
  }, [courseData?.course?.modules, currentModuleId, lessonCompletionStatus]);

  // Progress tracking hook (must be called before using readingProgress/engagementScore)
  const {
    readingProgress,
    timeSpent,
    scrollProgress,
    engagementScore,
    lessonScore: hookLessonScore,
    isLessonCompleted,
    nextLessonInfo,
    completionThreshold,
    updateReadingProgress,
    handleAutoLessonCompletion,
    checkAutoCompletion,
    autoSaveProgress,
    forceSaveProgress,
    setNextLessonInfo
  } = useProgressTracking({
    currentLesson,
    currentModuleId,
    showCelebration,
    contentRef,
    interactionHistory,
    hasQuiz: !!lessonQuiz,
    hasAssignment: lessonAssignments.length > 0,
    videoProgress,  // Pass video progress to tracking hook
    videoCurrentTime,  // Pass current playback time
    videoDuration,  // Pass total video duration
    videoCompleted  // Pass completion status
  });

  // Handle auto-completion event (lesson reached 80% score)
  const handleAutoCompletionEvent = useCallback((data: any) => {
    console.log('🎉 Auto-completion event received:', data);
    setShowCelebration(true);
    
    // Update lesson completion status
    if (currentLesson?.id) {
      setLessonCompletionStatus(prev => ({
        ...prev,
        [currentLesson.id]: true
      }));
    }
    
    // Show toast notification
    if (data.message) {
      console.log(data.message);
    }
    
    // If next lesson is available, offer to navigate
    if (data.nextLesson) {
      console.log('🔓 Next lesson available:', data.nextLesson);
    }
  }, [currentLesson?.id]);

  // Auto-save with completion callback
  useEffect(() => {
    if (currentLesson && !isLessonCompleted) {
      const timer = setInterval(() => {
        autoSaveProgress(handleAutoCompletionEvent);
      }, 15000); // Check every 15 seconds
      return () => clearInterval(timer);
    }
  }, [currentLesson, isLessonCompleted, autoSaveProgress, handleAutoCompletionEvent]);

  // Auto-complete lesson when score threshold is met
  useEffect(() => {
    // Wait for auth to be ready
    if (!isAuthenticated || authLoading || !user) {
      console.log('⏳ Waiting for auth to be ready before attempting auto-completion');
      return;
    }
    
    if (!currentLesson || isLessonCompleted || !checkAutoCompletion) return;
    
    // Prevent multiple simultaneous completion attempts for the same lesson
    if (completionAttemptRef.current === currentLesson.id) {
      console.log('⏭️ Completion already in progress for lesson', currentLesson.id);
      return;
    }
    
    // Check if auto-completion criteria are met
    const shouldAutoComplete = checkAutoCompletion();
    
    if (shouldAutoComplete) {
      console.log('🎯 Auto-completion criteria met, triggering completion...');
      
      // Mark this lesson as having a completion attempt
      completionAttemptRef.current = currentLesson.id;
      
      // Set a timer to attempt completion (give a moment for final progress to save)
      const completionTimer = setTimeout(() => {
        handleAutoLessonCompletion(
          (data) => {
            console.log('✅ Lesson auto-completed:', data);
            // Update lesson completion status
            setLessonCompletionStatus(prev => ({
              ...prev,
              [currentLesson.id]: true
            }));
            // Show celebration
            setShowCelebration(true);
            // Clear the completion attempt ref
            completionAttemptRef.current = null;
          },
          (error) => {
            console.log('❌ Auto-completion failed:', error);
            // Clear the completion attempt ref on error
            completionAttemptRef.current = null;
          }
        );
      }, 500);
      
      return () => {
        clearTimeout(completionTimer);
        // Don't clear completionAttemptRef here as it might be mid-request
      };
    }
  }, [currentLesson, isLessonCompleted, lessonScore, readingProgress, engagementScore, checkAutoCompletion, handleAutoLessonCompletion, isAuthenticated, authLoading, user]);

  // Calculate comprehensive lesson score with dynamic weights based on available assessments
  useEffect(() => {
    const hasQuiz = !!lessonQuiz;
    const hasAssignment = lessonAssignments && lessonAssignments.length > 0;
    
    let calculatedScore: number;
    let weights: { reading: number; engagement: number; quiz: number; assignment: number };
    
    if (hasQuiz && hasAssignment) {
      // Full assessment: 25% each
      weights = { reading: 0.25, engagement: 0.25, quiz: 0.25, assignment: 0.25 };
    } else if (hasQuiz) {
      // Quiz only: Reading 35%, Engagement 35%, Quiz 30%
      weights = { reading: 0.35, engagement: 0.35, quiz: 0.30, assignment: 0 };
    } else if (hasAssignment) {
      // Assignment only: Reading 35%, Engagement 35%, Assignment 30%
      weights = { reading: 0.35, engagement: 0.35, quiz: 0, assignment: 0.30 };
    } else {
      // No assessments: Reading 50%, Engagement 50%
      weights = { reading: 0.50, engagement: 0.50, quiz: 0, assignment: 0 };
    }
    
    calculatedScore = (
      (readingProgress * weights.reading) +
      (engagementScore * weights.engagement) +
      (currentLessonQuizScore * weights.quiz) +
      (currentLessonAssignmentScore * weights.assignment)
    );
    
    // Round to whole number for consistent display
    setLessonScore(Math.round(calculatedScore));
    console.log('📊 Lesson Score calculated (dynamic weights):', {
      reading: readingProgress,
      engagement: engagementScore,
      quiz: currentLessonQuizScore,
      assignment: currentLessonAssignmentScore,
      weights,
      hasQuiz,
      hasAssignment,
      total: Math.round(calculatedScore)
    });
  }, [readingProgress, engagementScore, currentLessonQuizScore, currentLessonAssignmentScore, lessonQuiz, lessonAssignments]);

  // Update quiz and assignment scores when lesson data changes
  // The quiz score is already loaded with the lessonQuiz object from get_lesson_quiz endpoint
  useEffect(() => {
    if (!currentLesson?.id) return;
    
    // Use quiz score directly from lessonQuiz (already enriched by get_lesson_quiz endpoint)
    if (lessonQuiz) {
      // The backend get_lesson_quiz endpoint returns best_score/current_score from QuizAttempt
      const quizBestScore = lessonQuiz.best_score ?? lessonQuiz.current_score ?? 0;
      setCurrentLessonQuizScore(quizBestScore);
      console.log(`📊 Using quiz score from lesson data: ${quizBestScore}%`, {
        lessonId: currentLesson.id,
        quizId: lessonQuiz.id,
        best_score: lessonQuiz.best_score,
        current_score: lessonQuiz.current_score
      });
    } else {
      setCurrentLessonQuizScore(0);
    }

    // Use assignment scores from lessonAssignments (submission_status already included)
    if (lessonAssignments && lessonAssignments.length > 0) {
      const scores = lessonAssignments.map((assignment: any) => {
        // Check if assignment has submission status with score
        if (assignment.submission_status?.score !== undefined && assignment.submission_status?.score !== null) {
          const score = assignment.submission_status.score;
          const total = assignment.points_possible || 100;
          return (score / total) * 100;
        }
        return 0;
      });
      
      const avgAssignmentScore = scores.length > 0 
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length 
        : 0;
      setCurrentLessonAssignmentScore(avgAssignmentScore);
      console.log(`📊 Using assignment score from lesson data: ${avgAssignmentScore}%`);
    } else {
      setCurrentLessonAssignmentScore(0);
    }
  }, [currentLesson?.id, lessonQuiz, lessonAssignments]);

  // Auto-complete lessons without quiz/assignment when criteria are met
  useEffect(() => {
    // Ensure auth is ready before attempting API calls
    if (!isAuthenticated || authLoading || !user) {
      console.log('⏳ Waiting for auth to be ready before attempting lesson auto-completion');
      return;
    }
    
    if (!currentLesson || !currentModuleId) return;

    // Prevent multiple simultaneous completion attempts for the same lesson
    if (completionAttemptRef.current === currentLesson.id) {
      console.log('⏭️ Completion already in progress for lesson', currentLesson.id);
      return;
    }

    // Check if lesson should auto-complete
    const shouldAutoComplete = checkAutoCompletion();

    if (shouldAutoComplete) {
      console.log('🎯 Auto-completing lesson (no quiz/assignment required)...');
      
      // Mark this lesson as having a completion attempt
      completionAttemptRef.current = currentLesson.id;
      
      // Trigger completion
      handleAutoLessonCompletion(
        (data) => {
          console.log('✅ Lesson auto-completed:', data);
          
          // CRITICAL: Update lesson completion status immediately for sidebar display
          setLessonCompletionStatus(prev => ({
            ...prev,
            [currentLesson.id]: true
          }));
          console.log(`🎯 Updated sidebar status for lesson ${currentLesson.id} - should now show as completed`);

          // Update quiz completion status for sidebar (for lessons without actual quiz)
          setQuizCompletionStatus(prev => ({
            ...prev,
            [currentLesson.id]: {
              score: lessonScore,
              completed: true,
              passed: lessonScore >= 70
            }
          }));

          // Recalculate module score
          if (moduleScoring) {
            moduleScoring.recalculate();
          }

          // Show celebration
          setShowCelebration(true);
          
          // Clear the completion attempt ref
          completionAttemptRef.current = null;
        },
        (error) => {
          console.error('❌ Auto-completion failed:', error);
          // Clear the completion attempt ref on error
          completionAttemptRef.current = null;
        }
      );
    }
  }, [readingProgress, engagementScore, currentLesson, currentModuleId, checkAutoCompletion, handleAutoLessonCompletion, lessonScore, moduleScoring, isAuthenticated, authLoading, user]);

  // Sync lesson completion status with lessonCompletionStatus state
  // This effect ensures that when isLessonCompleted changes (from useProgressTracking),
  // we update the sidebar's completion map immediately for instant UI feedback
  useEffect(() => {
    if (currentLesson?.id && isLessonCompleted) {
      setLessonCompletionStatus(prev => {
        // Only update if not already marked as completed to avoid unnecessary re-renders
        if (prev[currentLesson.id] !== true) {
          console.log(`✅ Marking lesson ${currentLesson.id} as completed in sidebar state`);
          return {
            ...prev,
            [currentLesson.id]: true
          };
        }
        return prev;
      });
    }
  }, [currentLesson?.id, isLessonCompleted]);

  // Auto-trigger module unlock when all conditions are met
  // This watches for changes in module score and lesson completion status
  useEffect(() => {
    // Skip if no module scoring data or checkAndUnlockNextModuleRef is not set
    if (!moduleScoring?.cumulativeScore || !checkAndUnlockNextModuleRef.current) return;
    if (!courseData?.course?.modules || !currentModuleId) return;
    
    const passingThreshold = 80;
    const currentScore = moduleScoring.cumulativeScore;
    
    // Check if passing
    if (currentScore >= passingThreshold) {
      // Check if all lessons are completed
      const currentModule = courseData.course.modules.find((m: any) => m.id === currentModuleId);
      if (!currentModule?.lessons) return;
      
      const moduleLessons = currentModule.lessons || [];
      const completedCount = moduleLessons.filter((lesson: any) => 
        lessonCompletionStatus[lesson.id] === true
      ).length;
      
      const allLessonsCompleted = completedCount === moduleLessons.length && moduleLessons.length > 0;
      
      if (allLessonsCompleted) {
        console.log(`🎯 Auto-triggering module unlock: Score ${currentScore.toFixed(1)}% >= ${passingThreshold}%, All ${completedCount}/${moduleLessons.length} lessons completed`);
        
        // Trigger module unlock check with debounce to prevent multiple calls
        const timeoutId = setTimeout(() => {
          if (checkAndUnlockNextModuleRef.current) {
            checkAndUnlockNextModuleRef.current();
          }
        }, 500);
        
        return () => clearTimeout(timeoutId);
      }
    }
  }, [moduleScoring?.cumulativeScore, lessonCompletionStatus, courseData?.course?.modules, currentModuleId]);

  // NOTE: Lesson score calculation is now done in the useEffect above (lines 265-305)
  // with dynamic weights based on available assessments. The old fixed-weight 
  // calculation (40% reading, 30% engagement, 30% quiz) has been removed to avoid
  // conflicting values.

  // Handler for quiz completion
  const handleQuizComplete = useCallback((score: number, passed: boolean) => {
    console.log(`✅ Quiz completed: ${score}% (${passed ? 'passed' : 'failed'})`);
    setCurrentLessonQuizScore(score);
    
    // Track interaction
    trackInteraction('quiz_completed', { 
      quizId: lessonQuiz?.id, 
      score, 
      passed,
      lessonId: currentLesson?.id
    });
    
    // Recalculate module score
    if (moduleScoring) {
      moduleScoring.recalculate();
    }
  }, [lessonQuiz?.id, currentLesson?.id, moduleScoring]);

  // Handler for assignment submission
  const handleAssignmentSubmit = useCallback((assignmentId: number, score: number) => {
    console.log(`✅ Assignment ${assignmentId} submitted with score: ${score}%`);
    
    // Update assignment score directly with the provided score
    setCurrentLessonAssignmentScore(score);
    
    // Recalculate module score and check for module unlock
    if (moduleScoring) {
      moduleScoring.recalculate();
      
      // Check if module can be unlocked after assignment submission
      setTimeout(() => {
        if (checkAndUnlockNextModuleRef.current) {
          checkAndUnlockNextModuleRef.current();
        }
      }, 1500);
    }
  }, [moduleScoring]);

  const handleManualCompletion = useCallback(async () => {
    if (!currentLesson || !currentModuleId) {
      console.error('❌ Cannot complete lesson: missing lesson or module data');
      return;
    }

    try {
      console.log('🎯 Manually marking lesson as complete...');
      
      // First, force save current progress
      await forceSaveProgress();
      
      // Then mark lesson as complete via API
      const timeSpentSeconds = Math.floor(timeSpent);
      const result = await StudentApiService.completeLesson(currentLesson.id, {
        time_spent: timeSpentSeconds,
        reading_progress: readingProgress,
        engagement_score: engagementScore,
        scroll_progress: scrollProgress,
        completion_method: 'manual'
      });
      
      console.log('✅ Lesson marked as complete:', result);
      
      // Update local state
      setLessonCompletionStatus(prev => ({
        ...prev,
        [currentLesson.id]: true
      }));
      
      // Update quiz completion status for sidebar
      setQuizCompletionStatus(prev => ({
        ...prev,
        [currentLesson.id]: {
          score: lessonScore,
          completed: true,
          passed: lessonScore >= 70
        }
      }));
      
      // Recalculate module score
      if (moduleScoring) {
        await moduleScoring.recalculate();
      }
      
      // Show celebration
      setShowCelebration(true);
      
      // Check if module can be unlocked
      setTimeout(() => {
        if (checkAndUnlockNextModuleRef.current) {
          checkAndUnlockNextModuleRef.current();
        }
      }, 1000);
    } catch (error) {
      console.error('❌ Error manually completing lesson:', error);
    }
  }, [currentLesson, currentModuleId, timeSpent, readingProgress, engagementScore, scrollProgress, lessonScore, moduleScoring, forceSaveProgress]);

  // Video progress handlers (for main video lessons only)
  const handleVideoProgress = useCallback((progress: number, currentTime?: number, duration?: number) => {
    console.log('🎬 handleVideoProgress called:', { 
      progress, 
      currentTime, 
      duration, 
      lessonContentType: currentLesson?.content_type,
      lessonId: currentLesson?.id 
    });
    
    // Only update for main video lessons, not mixed content
    if (currentLesson?.content_type === 'video') {
      console.log(`📹 Main video progress updated: ${progress.toFixed(1)}%`, { currentTime, duration });
      setVideoProgress(progress);
      if (currentTime !== undefined) setVideoCurrentTime(currentTime);
      if (duration !== undefined) setVideoDuration(duration);
    } else {
      console.warn('⚠️ Ignoring video progress - not a main video lesson', {
        contentType: currentLesson?.content_type,
        expected: 'video'
      });
    }
  }, [currentLesson?.content_type, currentLesson?.id]);

  const handleVideoComplete = useCallback(() => {
    // Only update for main video lessons, not mixed content
    if (currentLesson?.content_type === 'video') {
      console.log('✅ Main video completed (90% threshold reached)');
      setVideoCompleted(true);
    } else {
      console.warn('⚠️ Ignoring video completion - not a main video lesson');
    }
  }, [currentLesson?.content_type]);

  // Mixed content video progress handlers
  const handleMixedContentVideoProgress = useCallback((videoIndex: number, progress: number) => {
    console.log(`📹 Mixed content video ${videoIndex} progress: ${progress.toFixed(1)}%`);
    setMixedContentVideoProgress(prev => ({
      ...prev,
      [videoIndex]: progress
    }));
    
    // Track interaction for engagement
    trackInteraction('mixed_video_progress', {
      videoIndex,
      progress: Math.round(progress),
      timestamp: Date.now()
    });
  }, []);

  const handleMixedContentVideoComplete = useCallback((videoIndex: number) => {
    console.log(`✅ Mixed content video ${videoIndex} completed`);
    setMixedContentVideosCompleted(prev => new Set([...prev, videoIndex]));
    
    // Track interaction for engagement
    trackInteraction('mixed_video_completed', {
      videoIndex,
      timestamp: Date.now()
    });
  }, []);

  // Helper function to check if lesson can be manually completed
  const canManuallyComplete = useCallback(() => {
    // Already completed
    if (isLessonCompleted) return false;
    
    // Check if lesson score meets threshold (80%)
    if (lessonScore < 80) return false;
    
    // Check quiz requirement if quiz exists
    if (lessonQuiz) {
      const quizScore = lessonQuiz.best_score ?? lessonQuiz.current_score ?? 0;
      const passingScore = lessonQuiz.passing_score || 70;
      if (quizScore < passingScore) return false;
    }
    
    // Check assignment requirements if assignments exist
    if (lessonAssignments && lessonAssignments.length > 0) {
      const allAssignmentsGraded = lessonAssignments.every((assignment: any) => {
        return assignment.submission_status?.score !== undefined && 
               assignment.submission_status?.score !== null;
      });
      if (!allAssignmentsGraded) return false;
    }
    
    return true;
  }, [isLessonCompleted, lessonScore, lessonQuiz, lessonAssignments]);

  // Helper function to close celebration and check for module unlock
  const closeCelebration = useCallback(() => {
    setShowCelebration(false);
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
    
    // Check if module can be unlocked after celebration closes
    // Small delay to ensure lesson completion status is updated
    setTimeout(() => {
      if (checkAndUnlockNextModuleRef.current) {
        checkAndUnlockNextModuleRef.current();
      }
    }, 500);
  }, []);

  // Load lesson content including quizzes and assignments
  const loadLessonContent = useCallback(async (lessonId: number) => {
    if (!lessonId) return;
    
    setContentLoading(true);
    setQuizLoadError(null);
    
    try {
      console.log(`🔄 Loading content for lesson ${lessonId}...`);
      
      const [quizResponse, assignmentsResponse] = await Promise.all([
        ContentAssignmentService.getLessonQuiz(lessonId).catch((err) => {
          console.error('❌ Failed to load lesson quiz:', err);
          const errorMsg = err.response?.data?.message || err.message || 'Failed to load quiz';
          setQuizLoadError(errorMsg);
          return { lesson: null, quiz: null, quizzes: [] };
        }),
        ContentAssignmentService.getLessonAssignments(lessonId).catch((err) => {
          console.error('❌ Failed to load lesson assignments:', err);
          return { lesson: null, assignments: [] };
        })
      ]);
      
      console.log('✅ Loaded lesson content:', { 
        quizAvailable: !!quizResponse.quiz, 
        quizCount: quizResponse.quizzes?.length || 0,
        assignmentCount: assignmentsResponse.assignments?.length || 0,
        quizDetails: quizResponse.quiz ? {
          id: quizResponse.quiz.id,
          title: quizResponse.quiz.title,
          questionsCount: quizResponse.quiz.questions?.length || 0
        } : null
      });
      
      // Set the primary quiz (first one) for backward compatibility
      setLessonQuiz(quizResponse.quiz);
      setLessonAssignments(assignmentsResponse.assignments || []);
      
      // Build assessments data for sidebar
      const assessments: any[] = [];
      
      // Handle multiple quizzes from the 'quizzes' array
      const quizzesToDisplay = quizResponse.quizzes && quizResponse.quizzes.length > 0 
        ? quizResponse.quizzes 
        : (quizResponse.quiz ? [quizResponse.quiz] : []);
      
      quizzesToDisplay.forEach((quiz: any) => {
        assessments.push({
          id: quiz.id,
          title: quiz.title || 'Quiz',
          type: 'quiz',
          status: quiz.completed ? 'completed' : 'pending',
          dueDate: quiz.due_date
        });
      });
      
      if (assignmentsResponse.assignments && assignmentsResponse.assignments.length > 0) {
        assignmentsResponse.assignments.forEach((assignment: any) => {
          assessments.push({
            id: assignment.id,
            title: assignment.title || 'Assignment',
            type: 'assignment',
            status: assignment.status || 'pending',
            dueDate: assignment.due_date
          });
        });
      }
      
      // Update assessments map
      setLessonAssessments(prev => ({
        ...prev,
        [lessonId]: assessments
      }));
      
      // Mark content as loaded for this lesson
      setContentLoadedForLesson(lessonId);
    } catch (error) {
      console.error('Error loading lesson content:', error);
      // Still mark as loaded to prevent infinite retries
      setContentLoadedForLesson(lessonId);
    } finally {
      setContentLoading(false);
    }
  }, []);

  // Reload lesson content (useful after quiz submission)
  const reloadLessonContent = useCallback(() => {
    if (currentLesson?.id) {
      console.log('🔄 Reloading lesson content...');
      loadLessonContent(currentLesson.id);
    }
  }, [currentLesson?.id, loadLessonContent]);

  // Check for badge eligibility
  const checkBadgeEligibility = useCallback(async () => {
    if (!courseData?.course) return;

    try {
      const progressData = await StudentApiService.getCourseProgress(courseId);
      const completedLessons = progressData.lessons_completed || 0;
      
      if (completedLessons > 0 && completedLessons % 3 === 0) {
        const newBadges = await StudentApiService.checkEarnedBadges(courseId);
        if (newBadges.length > 0) {
          setNewBadgesEarned(prev => [...prev, ...newBadges.map((b: any) => b.name)]);
        }
      }
    } catch (error) {
      console.error('Error checking badge eligibility:', error);
    }
  }, [courseData, courseId]);

  // Fetch lesson completion status for all lessons
  const fetchLessonCompletionStatus = useCallback(async () => {
    if (!courseData?.modules && !courseData?.course?.modules) return;

    try {
      const completionMap: { [lessonId: number]: boolean } = {};
      
      // ENHANCED: Use the lessons_completed data from progress_data.modules if available
      // This data is already returned from the backend with completion status
      if (courseData.modules && Array.isArray(courseData.modules)) {
        console.log('📊 Using completion data from backend progress_data.modules');
        
        courseData.modules.forEach((moduleData: any) => {
          const lessonsCompleted = moduleData.lessons_completed || [];
          
          lessonsCompleted.forEach((lesson: any) => {
            // Backend sets completed: true/false
            if (lesson.completed) {
              completionMap[lesson.id] = true;
              console.log(`✅ Lesson ${lesson.id} marked as completed from backend data`);
            } else {
              completionMap[lesson.id] = false;
            }
          });
        });
        
        setLessonCompletionStatus(completionMap);
        console.log('📊 Loaded completion status from backend:', completionMap);
        return; // Exit early - we have the data!
      }
      
      // FALLBACK: If progress data not available, fetch individually
      // This is less efficient but works as a backup
      const modules = courseData?.course?.modules || [];
      if (modules.length === 0) return;
      
      console.log('⚠️ Falling back to individual lesson progress fetching');
      
      // Initialize all lessons as not completed
      modules.forEach((module: any) => {
        module.lessons?.forEach((lesson: any) => {
          completionMap[lesson.id] = false;
        });
      });

      // Try to fetch lesson progress for each lesson
      const progressPromises = modules.flatMap((module: any) =>
        (module.lessons || []).map(async (lesson: any) => {
          try {
            const progress = await StudentApiService.getLessonProgress(lesson.id);
            // Check if lesson is completed (reading progress >= 100 or auto_completed or explicitly completed)
            if (progress.reading_progress >= 100 || progress.auto_completed || progress.completed) {
              completionMap[lesson.id] = true;
              console.log(`✅ Lesson ${lesson.id} (${lesson.title}) marked as completed from DB`);
            }
          } catch (error: any) {
            // If API fails with 404, lesson has no progress yet (not completed)
            // Any other error should be logged but not break the flow
            if (error?.response?.status !== 404) {
              console.warn(`Failed to fetch progress for lesson ${lesson.id}:`, error?.message);
            }
            completionMap[lesson.id] = false;
          }
        })
      );

      await Promise.all(progressPromises);
      console.log('📊 Fetched lesson completion status:', completionMap);
      setLessonCompletionStatus(completionMap);
    } catch (error) {
      console.error('Error fetching lesson completion status:', error);
    }
  }, [courseData?.modules, courseData?.course?.modules]);

  // Check course completion
  const checkCourseCompletion = useCallback(async () => {
    if (!courseData?.course) return;
    try {
      const progressData = await StudentApiService.getCourseProgress(courseId);
      const modules = courseData.course.modules || [];

      const moduleScores = await Promise.all(
        modules.map(async (module: any) => {
          try {
            const moduleProgress = await StudentApiService.getModuleProgress(module.id);
            return (moduleProgress.weighted_score ?? moduleProgress.cumulative_score ?? 0);
          } catch {
            return 0;
          }
        })
      );

      const overallScore = moduleScores.length > 0
        ? moduleScores.reduce((sum: number, score: number) => sum + score, 0) / moduleScores.length
        : 0;
      
      const completion = {
        totalLessons: modules.reduce((sum: number, m: any) => sum + (m.lessons?.length || 0), 0),
        completedLessons: progressData.lessons_completed || 0,
        totalQuizzes: progressData.total_quizzes || 0,
        completedQuizzes: progressData.completed_quizzes || 0,
        totalAssignments: progressData.total_assignments || 0,
        completedAssignments: progressData.completed_assignments || 0,
        overallScore,
        passingThreshold: 80
      };

      setCourseCompletion(completion);

      if (completion.completedLessons >= completion.totalLessons && 
          completion.completedQuizzes >= completion.totalQuizzes && 
          completion.completedAssignments >= completion.totalAssignments && 
          overallScore >= completion.passingThreshold) {
        try {
          const certificateResponse = await StudentApiService.generateCertificate(courseId);
          if (certificateResponse.success) {
            setShowCertificateNotification(true);
            setTimeout(() => setShowCertificateNotification(false), 5000);
          }
        } catch (error) {
          console.error('Error generating certificate:', error);
        }
      }
    } catch (error) {
      console.error('Error checking course completion:', error);
    }
  }, [courseData, courseId]);

  // Check if current lesson requires video completion
  const requiresVideoCompletion = currentLesson?.content_type === 'video';
  const canNavigateNext = !requiresVideoCompletion || videoCompleted || isLessonCompleted;

  // Auto-advance to next lesson
  const autoAdvanceToNextLesson = useCallback(() => {
    if (!courseData?.course?.modules || !currentLesson) return;
    
    const currentModule = courseData.course.modules.find((m: any) => m.id === currentModuleId);
    if (!currentModule?.lessons) return;
    
    const currentLessonIndex = currentModule.lessons.findIndex((l: any) => l.id === currentLesson.id);
    const nextLesson = currentModule.lessons[currentLessonIndex + 1];
    
    if (nextLesson) {
      handleLessonSelect(nextLesson.id, currentModuleId!);
      // Scroll handled in handleLessonSelect
    } else {
      const moduleIndex = courseData.course.modules.findIndex((m: any) => m.id === currentModuleId);
      const nextModule = courseData.course.modules[moduleIndex + 1];
      if (nextModule && nextModule.lessons?.[0]) {
        handleModuleUnlock(nextModule.title || 'Next Module');
        setTimeout(() => {
          const nextLessonId = nextModule.lessons?.[0]?.id;
          if (nextLessonId) {
            handleLessonSelect(nextLessonId, nextModule.id);
          }
        }, 2000);
      }
    }
  }, [courseData, currentLesson, currentModuleId]);

  // Enhanced scroll tracking
  useEffect(() => {
    const handleScroll = () => {
      if (showCelebration) return;
      updateReadingProgress();
    };
    
    const element = contentRef.current;
    
    if (element) {
      element.addEventListener('scroll', handleScroll, { passive: true });
      
      setTimeout(() => {
        if (!showCelebration) {
          updateReadingProgress();
        }
      }, 1000);
      
      return () => element.removeEventListener('scroll', handleScroll);
    }
  }, [updateReadingProgress, showCelebration]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showCelebration) {
      const scrollY = window.scrollY;
      
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      
      return () => {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [showCelebration]);

  // Set mounted state on client side
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load lesson completion statuses for all lessons in the course
  // This runs once on mount to initialize the sidebar completion status map
  useEffect(() => {
    const loadLessonCompletionStatuses = async () => {
      if (!courseData?.course?.modules) return;
      
      try {
        const allLessons = courseData.course.modules.flatMap((module: any) => module.lessons || []);
        const completionStatuses: { [lessonId: number]: boolean } = {};
        
        // Fetch completion status for each lesson from backend
        await Promise.all(
          allLessons.map(async (lesson: any) => {
            try {
              const response = await StudentApiService.getLessonProgress(lesson.id);
              // Mark as completed if explicitly marked as completed in DB
              // The API returns { lesson_id, progress: { completed, reading_progress, ... } }
              const isCompleted = response.progress?.completed === true;
              completionStatuses[lesson.id] = isCompleted;
              
              if (isCompleted) {
                console.log(`✅ Lesson ${lesson.id} is completed in DB`);
              }
            } catch (error) {
              console.error(`Failed to load completion status for lesson ${lesson.id}:`, error);
              completionStatuses[lesson.id] = false;
            }
          })
        );
        
        setLessonCompletionStatus(prev => {
          // Merge with existing state to preserve any recently completed lessons
          // This prevents race conditions where a lesson is completed but API hasn't updated yet
          const merged = { ...completionStatuses };
          Object.keys(prev).forEach(lessonIdStr => {
            const lessonId = Number(lessonIdStr);
            if (prev[lessonId] === true && !merged[lessonId]) {
              // Preserve local completion status if backend hasn't caught up yet
              merged[lessonId] = true;
              console.log(`⚠️ Preserving local completion for lesson ${lessonId} (backend not synced yet)`);
            }
          });
          console.log('✅ Loaded lesson completion statuses from DB:', merged);
          return merged;
        });
      } catch (error) {
        console.error('Failed to load lesson completion statuses:', error);
      }
    };
    
    loadLessonCompletionStatuses();
  }, [courseData?.course?.modules]);

  // Handler to mark a lesson as completed (called when auto-completion happens)
  const markLessonAsCompleted = useCallback((lessonId: number) => {
    setLessonCompletionStatus(prev => {
      if (prev[lessonId] === true) {
        return prev; // Already completed, no update needed
      }
      
      console.log(`✅ Marking lesson ${lessonId} as completed in UI`);
      return {
        ...prev,
        [lessonId]: true
      };
    });
  }, []);

  // Refresh completion status for current lesson when it changes
  useEffect(() => {
    const refreshCurrentLessonCompletion = async () => {
      if (!currentLesson?.id) return;
      
      try {
        const response = await StudentApiService.getLessonProgress(currentLesson.id);
        const isCompleted = response.progress?.completed === true;
        
        // Update completion status if it's different from current state
        if (isCompleted !== lessonCompletionStatus[currentLesson.id]) {
          console.log(`🔄 Updating completion status for lesson ${currentLesson.id}: ${isCompleted}`);
          markLessonAsCompleted(currentLesson.id);
        }
      } catch (error) {
        console.error(`Failed to refresh completion status for lesson ${currentLesson.id}:`, error);
      }
    };
    
    refreshCurrentLessonCompletion();
  }, [currentLesson?.id, markLessonAsCompleted, lessonCompletionStatus]);

  // Load quiz attempt scores from database for sidebar display
  // This ensures lesson assessment scores are real data from the DB, not just defaults
  useEffect(() => {
    const loadQuizAttempts = async () => {
      if (!courseData?.course?.modules) return;
      
      try {
        const allLessons = courseData.course.modules.flatMap((module: any) => module.lessons || []);
        const quizStatusMap: { [quizId: number]: { completed: boolean; score: number; passed: boolean } } = {};
        
        // Fetch quiz data for lessons with quizzes
        await Promise.all(
          allLessons.map(async (lesson: any) => {
            try {
              // Get lesson quiz (if exists)
              const quizData = await ContentAssignmentService.getLessonQuiz(lesson.id).catch(() => ({ quiz: null }));
              
              if (quizData.quiz) {
                const quiz = quizData.quiz;
                // Get attempts for this quiz to get the best score
                try {
                  const attempts = await AssessmentApiService.getQuizAttempts(quiz.id).catch(() => ({ attempts: [] }));
                  
                  if (attempts.attempts && attempts.attempts.length > 0) {
                    // Sort by score descending to get best score
                    const bestAttempt = attempts.attempts.sort((a: any, b: any) => (b.score || 0) - (a.score || 0))[0];
                    const passingScore = quiz.passing_score || 70;
                    
                    quizStatusMap[quiz.id] = {
                      completed: true,
                      score: bestAttempt.score || 0,
                      passed: (bestAttempt.score || 0) >= passingScore
                    };
                    
                    console.log(`📊 Loaded quiz ${quiz.id} from DB:`, {
                      bestScore: bestAttempt.score,
                      isPassed: (bestAttempt.score || 0) >= passingScore,
                      attemptCount: attempts.attempts.length
                    });
                  }
                } catch (error) {
                  console.warn(`Failed to fetch attempts for quiz ${quiz.id}:`, error);
                  // Set empty score if no attempts found
                  quizStatusMap[quiz.id] = {
                    completed: false,
                    score: 0,
                    passed: false
                  };
                }
              }
            } catch (error) {
              console.warn(`Failed to load quiz for lesson ${lesson.id}:`, error);
            }
          })
        );
        
        // Update state with all quiz scores from DB
        if (Object.keys(quizStatusMap).length > 0) {
          setQuizCompletionStatus(prev => ({
            ...prev,
            ...quizStatusMap
          }));
          console.log('✅ Loaded quiz attempt scores from database:', quizStatusMap);
        }
      } catch (error) {
        console.error('Failed to load quiz attempts:', error);
      }
    };
    
    loadQuizAttempts();
  }, [courseData?.course?.modules]);

  // Load content when lesson changes
  useEffect(() => {
    if (currentLesson?.id) {
      loadLessonContent(currentLesson.id);
    }
  }, [currentLesson?.id, loadLessonContent]);

  // Clear auto-advance timeout when changing lessons
  useEffect(() => {
    if (currentLesson) {
      setShowCelebration(false);
      
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
        autoAdvanceTimeoutRef.current = null;
      }
    }
  }, [currentLesson?.id]);

  // Load course data
  useEffect(() => {
    if (authLoading || !isAuthenticated || !courseId) return;

    const fetchCourseData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await StudentApiService.getCourseDetails(courseId);
        
        // ENHANCED: Extract both course data and progress data from response
        // Backend returns: { success, course, progress: { modules }, current_lesson, enrollment }
        const enhancedResponse = {
          ...response,
          modules: response.progress?.modules || [] // Include progress modules with completion data
        };
        
        setCourseData(enhancedResponse);
        console.log('📦 Course data loaded with progress:', {
          courseTitle: response.course?.title,
          moduleCount: response.progress?.modules?.length || 0,
          hasProgressData: !!response.progress
        });
        
        // Priority order for setting current lesson:
        // 1. Find first uncompleted lesson from backend data (most accurate)
        // 2. Use current_lesson_id from API if available
        // 3. Check localStorage for last accessed lesson
        // 4. Default to first lesson
        
        let lessonToSet = null;
        let moduleIdToSet = null;
        
        // 1. Try to find the first uncompleted lesson from backend progress modules data
        if (response.progress?.modules && response.progress.modules.length > 0) {
          console.log('🔍 Searching for first uncompleted lesson in progress data...');
          
          for (const moduleData of response.progress.modules) {
            const lessonsCompleted = moduleData.lessons_completed || [];
            const moduleInfo = moduleData.module; // Get module info from moduleData
            
            if (lessonsCompleted.length > 0) {
              const uncompletedLesson = lessonsCompleted.find((lesson: any) => !lesson.completed);
              
              if (uncompletedLesson) {
                // Find full lesson object from course.modules
                const fullModule = response.course?.modules?.find((m: any) => m.id === moduleInfo.id);
                if (fullModule) {
                  const fullLesson = fullModule.lessons?.find((l: any) => l.id === uncompletedLesson.id);
                  if (fullLesson) {
                    lessonToSet = fullLesson;
                    moduleIdToSet = moduleInfo.id;
                    console.log('✅ Found first uncompleted lesson:', fullLesson.title, 'in module:', fullModule.title);
                    break;
                  }
                }
              }
            }
          }
        }
        
        // 2. Fallback to API's current_lesson_id
        if (!lessonToSet && response.current_lesson_id && response.course?.modules) {
          console.log('🔍 Using current_lesson_id from API:', response.current_lesson_id);
          
          for (const module of response.course.modules) {
            const lesson = module.lessons?.find((l: any) => l.id === response.current_lesson_id);
            if (lesson) {
              lessonToSet = lesson;
              moduleIdToSet = module.id;
              console.log('✅ Found lesson from current_lesson_id:', lesson.title);
              break;
            }
          }
        }
        
        // 3. Try to restore from localStorage
        if (!lessonToSet) {
          const savedProgress = loadLastLesson(courseId);
          if (savedProgress && response.course?.modules) {
            console.log('🔍 Checking localStorage for saved lesson:', savedProgress.lessonId);
            
            // Verify the saved lesson still exists and is not completed
            const moduleWithLesson = response.course.modules.find((module: any) => 
              module.id === savedProgress.moduleId && 
              module.lessons?.some((lesson: any) => lesson.id === savedProgress.lessonId)
            );
            
            if (moduleWithLesson) {
              const lesson = moduleWithLesson.lessons.find((l: any) => l.id === savedProgress.lessonId);
              if (lesson) {
                lessonToSet = lesson;
                moduleIdToSet = savedProgress.moduleId;
                console.log('✅ Restored lesson from localStorage:', lesson.title);
              }
            }
          }
        }
        
        // 4. Final fallback to first lesson
        if (!lessonToSet && response.course?.modules?.[0]?.lessons?.[0]) {
          lessonToSet = response.course.modules[0].lessons[0];
          moduleIdToSet = response.course.modules[0].id;
          console.log('✅ Using first lesson as fallback:', lessonToSet.title);
        }
        
        if (lessonToSet && moduleIdToSet) {
          setCurrentLesson(lessonToSet);
          setCurrentModuleId(moduleIdToSet);
          // Save this as the current position
          saveLastLesson(courseId, lessonToSet.id, moduleIdToSet);
        }

      } catch (err: any) {
        console.error('Failed to fetch course data:', err);
        setError(err.response?.data?.error || err.message || 'Failed to load course');
      } finally {
        setLoading(false);
      }
    };

    fetchCourseData();
  }, [courseId, isAuthenticated, authLoading]);

  // Fetch lesson completion status when course data is loaded
  useEffect(() => {
    if (courseData?.course?.modules) {
      fetchLessonCompletionStatus();
    }
  }, [courseData?.course?.modules, fetchLessonCompletionStatus]);

  // Load lesson content (quiz and assignments) when current lesson changes
  useEffect(() => {
    if (currentLesson?.id && contentLoadedForLesson !== currentLesson.id) {
      loadLessonContent(currentLesson.id);
    }
  }, [currentLesson?.id, contentLoadedForLesson, loadLessonContent]);

  // Reload content when switching to quiz or assignment tab (if not already loaded)
  useEffect(() => {
    if (currentLesson?.id && contentLoadedForLesson !== currentLesson.id) {
      // Only reload if content hasn't been loaded for this lesson yet
      if (currentViewMode === 'quiz' || currentViewMode === 'assignments') {
        console.log(`🔄 Tab switched to ${currentViewMode}, loading content for lesson ${currentLesson.id}...`);
        loadLessonContent(currentLesson.id);
      }
    }
  }, [currentViewMode, currentLesson?.id, contentLoadedForLesson, loadLessonContent]);

  // Enhanced lesson selection with loading states, error handling, and accessibility
  const handleLessonSelect = async (lessonId: number, moduleId: number) => {
    // Prevent navigation if lesson is already current or content is loading
    if (currentLesson?.id === lessonId || contentLoading) {
      console.warn('⚠️ Navigation blocked: Already on this lesson or content is loading');
      return;
    }

    const courseModules = courseData?.course?.modules || courseData?.modules || [];
    if (courseModules) {
      const allLessons = courseModules.flatMap((module: any) => module.lessons || []);
      const lesson = allLessons.find((l: any) => l.id === lessonId);
      
      if (!lesson) {
        console.error('❌ Target lesson not found:', lessonId);
        setError('Lesson not found. Please refresh and try again.');
        return;
      }

      // Check if lesson is accessible
      const targetModule = courseModules.find((m: any) => m.id === moduleId);
      if (!targetModule) {
        console.error('❌ Target module not found:', moduleId);
        return;
      }

      try {
        console.log('📍 Navigating to lesson:', lesson.title, '(ID:', lessonId, ')');
        
        // Show loading state
        setContentLoading(true);
        setError(null); // Clear any previous errors
        
        // Save current progress before switching
        if (currentLesson && forceSaveProgress) {
          try {
            await forceSaveProgress();
          } catch (saveError) {
            console.warn('⚠️ Failed to save current progress, continuing with navigation:', saveError);
          }
        }
        
        // Update lesson and module state
        setCurrentLesson(lesson);
        setCurrentModuleId(moduleId);
        setLessonNotes('');
        setCurrentViewMode('content'); // Reset to content tab when navigating to a new lesson
        
        // Prefetch lesson progress immediately for faster load
        try {
          const progress = await StudentApiService.getLessonProgress(lessonId);
          console.log('📊 Prefetched lesson progress:', {
            lessonId,
            readingProgress: progress.reading_progress,
            engagementScore: progress.engagement_score,
            completed: progress.completed
          });
        } catch (error) {
          console.warn('⚠️ Failed to prefetch lesson progress (will load in useProgressTracking):', error);
        }
        
        // Reset video tracking for new lesson
        setVideoProgress(0);
        setVideoCompleted(false);
        setVideoCurrentTime(0);
        setVideoDuration(0);
        setMixedContentVideoProgress({});
        setMixedContentVideosCompleted(new Set());
        
        // Auto-close sidebar on small screens for better UX
        if (window.innerWidth < 1024) { // lg breakpoint
          setSidebarOpen(false);
          console.log('📱 Auto-closing sidebar on small screen');
        }
        
        // Smooth scroll to top for better user experience
        setTimeout(() => {
          if (contentRef.current) {
            contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
          }
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 100);
        
        // Save to localStorage for session persistence
        saveLastLesson(courseId, lessonId, moduleId);
        
        // Track navigation analytics
        setInteractionHistory(prev => [...prev, {
          type: 'lesson_select',
          lessonId,
          moduleId,
          timestamp: new Date().toISOString(),
          metadata: {
            fromLesson: currentLesson?.id,
            fromModule: currentModuleId,
            navigationMethod: 'direct_select'
          }
        }]);

        console.log('✅ Lesson navigation completed successfully');
        
      } catch (error) {
        console.error('❌ Failed to navigate to lesson:', error);
        setError('Failed to load lesson. Please try again.');
        setContentLoading(false);
      }
    }
  };

  // Handle quiz selection from sidebar
  const handleQuizSelect = (lessonId: number, moduleId: number, quizId: number) => {
    console.log('📝 Navigating to quiz:', quizId, 'for lesson:', lessonId);
    
    // First navigate to the lesson
    const courseModules = courseData?.course?.modules || courseData?.modules || [];
    if (courseModules) {
      const allLessons = courseModules.flatMap((module: any) => module.lessons || []);
      const lesson = allLessons.find((l: any) => l.id === lessonId);
      if (lesson) {
        setCurrentLesson(lesson);
        setCurrentModuleId(moduleId);
        
        // Auto-close sidebar on small screens (mobile/tablet)
        if (window.innerWidth < 1024) { // lg breakpoint
          setSidebarOpen(false);
          console.log('📱 Auto-closing sidebar on small screen (quiz)');
        }
        
        // Load lesson content (which includes the quiz)
        loadLessonContent(lessonId).then(() => {
          // Switch to quiz view after content is loaded
          setCurrentViewMode('quiz');
          console.log('✅ Switched to quiz view');
          
          // Scroll to top after content loads
          setTimeout(() => {
            if (contentRef.current) {
              contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }, 100);
        });
        
        setInteractionHistory(prev => [...prev, {
          type: 'quiz_select',
          lessonId,
          moduleId,
          quizId,
          timestamp: new Date().toISOString()
        }]);
      }
    }
  };

  // Handle module unlock
  const handleModuleUnlock = (moduleName: string) => {
    setUnlockedModuleName(moduleName);
    setShowUnlockAnimation(true);
    
    setInteractionHistory(prev => [...prev, {
      type: 'module_unlock',
      moduleName,
      timestamp: new Date().toISOString()
    }]);
  };

  // Handle locked module click - show what's needed to unlock
  const handleLockedModuleClick = useCallback((info: {
    moduleId: number;
    moduleTitle: string;
    moduleIndex: number;
    previousModuleTitle: string;
    previousModuleId: number;
    previousModuleScore: number;
    previousModuleLessonsCompleted: number;
    previousModuleTotalLessons: number;
    requiredScore: number;
  }) => {
    // Don't show locked module modal in instructor preview mode
    if (viewAsStudent) {
      console.log('🔒 Locked module clicked in instructor preview mode - ignoring');
      return;
    }
    
    console.log('🔒 Locked module clicked:', info);
    setLockedModuleInfo(info);
    setShowLockedModuleModal(true);
  }, [viewAsStudent]);

  // When locked module modal opens, fetch enhanced eligibility for that target module
  useEffect(() => {
    const loadEligibility = async () => {
      if (!showLockedModuleModal || !lockedModuleInfo) return;
      try {
        setLockedModuleEligibilityLoading(true);
        const elig = await EnhancedModuleUnlockService.checkModuleUnlockEligibility(lockedModuleInfo.moduleId);
        console.log('✅ Eligibility loaded for module', lockedModuleInfo.moduleId, ':', elig);
        setLockedModuleEligibility(elig);
      } catch (e) {
        console.error('❌ Eligibility check failed:', e);
        setLockedModuleEligibility(null);
      } finally {
        setLockedModuleEligibilityLoading(false);
      }
    };
    loadEligibility();
  }, [showLockedModuleModal, lockedModuleInfo]);

  // Auto-unlock next module when current module is completed with passing score
  const checkAndUnlockNextModule = useCallback(async () => {
    if (unlockingRef.current) return;
    if (!courseData?.course?.modules || !currentModuleId) return;
    
    // Check if all lessons are completed
    const allLessonsCompleted = checkModuleCompletion();
    if (!allLessonsCompleted) {
      console.log('⏭️ Not all lessons completed, skipping module unlock check');
      return;
    }
    
    // Get current module score (recalculate first)
    if (moduleScoring?.recalculate) {
      await moduleScoring.recalculate();
    }
    
    const passingThreshold = 80;
    const currentScore = moduleScoring?.cumulativeScore || 0;
    const isPassing = currentScore >= passingThreshold;
    
    // Find current module and next module
    const modules = courseData.course.modules;
    const currentModuleIndex = modules.findIndex((m: any) => m.id === currentModuleId);
    const currentModule = modules[currentModuleIndex];
    const nextModule = modules[currentModuleIndex + 1];
    
    console.log(`📊 Module ${currentModuleId} score check:`, {
      cumulativeScore: currentScore,
      passingThreshold,
      isPassing
    });
    
    if (!isPassing) {
      console.log(`⚠️ Module score ${currentScore.toFixed(1)}% is below passing threshold ${passingThreshold}%`);
      
      // Try enhanced eligibility for richer guidance
      let eligibility: any = null;
      try {
        eligibility = await EnhancedModuleUnlockService.checkModuleUnlockEligibility(currentModuleId);
      } catch (e) {
        // Non-fatal: continue with local breakdown/weights
      }

      // Fetch detailed score breakdown with dynamic weights from API
      let weights = { courseContribution: 10, quizzes: 30, assignments: 40, finalAssessment: 20 };
      let assessmentInfo = { hasQuizzes: true, hasAssignments: true, hasFinalAssessment: true, isReadingOnly: false };
      
      try {
        const scoreBreakdown = await ProgressApiService.getModuleScoreBreakdown(currentModuleId);
        if (scoreBreakdown?.breakdown) {
          weights = {
            courseContribution: scoreBreakdown.breakdown.course_contribution?.weight || 10,
            quizzes: scoreBreakdown.breakdown.quizzes?.weight || 30,
            assignments: scoreBreakdown.breakdown.assignments?.weight || 40,
            finalAssessment: scoreBreakdown.breakdown.final_assessment?.weight || 20
          };
        }
        if (scoreBreakdown?.assessment_info) {
          assessmentInfo = {
            hasQuizzes: scoreBreakdown.assessment_info.has_quizzes,
            hasAssignments: scoreBreakdown.assessment_info.has_assignments,
            hasFinalAssessment: scoreBreakdown.assessment_info.has_final_assessment,
            isReadingOnly: scoreBreakdown.assessment_info.is_reading_only
          };
        }
      } catch (err) {
        console.warn('Could not fetch dynamic weights, using defaults');
      }
      
      // Show what's missing to reach the passing score
      const missingItems: string[] = [];
      const breakdown = moduleScoring?.breakdown || {
        courseContribution: 0,
        quizzes: 0,
        assignments: 0,
        finalAssessment: 0
      };
      
      // Prefer backend recommendations if available
      if (eligibility?.recommendations?.length) {
        missingItems.push(...eligibility.recommendations);
      } else {
        // Check each component and suggest improvements (only for available components)
        if (weights.courseContribution > 0 && breakdown.courseContribution < 80) {
          missingItems.push(`📖 Reading & Engagement: ${breakdown.courseContribution.toFixed(0)}% (aim for 80%+)`);
        }
        if (weights.quizzes > 0 && breakdown.quizzes < 80) {
          missingItems.push(`📝 Quiz Score: ${breakdown.quizzes.toFixed(0)}% (aim for 80%+)`);
        }
        if (weights.assignments > 0 && breakdown.assignments < 80) {
          missingItems.push(`📋 Assignment Score: ${breakdown.assignments.toFixed(0)}% (aim for 80%+)`);
        }
        if (weights.finalAssessment > 0 && breakdown.finalAssessment < 80) {
          missingItems.push(`🎯 Final Assessment: ${breakdown.finalAssessment.toFixed(0)}% (aim for 80%+)`);
        }
      }
      
      // Show the modal with missing requirements
      if (nextModule) {
        setModuleProgressInfo({
          moduleName: currentModule?.title || 'Current Module',
          nextModuleName: nextModule?.title || 'Next Module',
          currentScore,
          requiredScore: passingThreshold,
          missingItems,
          breakdown,
          weights,
          assessmentInfo
        });
        setShowModuleProgressModal(true);
      }
      
      return;
    }
    
    // Check if there's a next module to unlock
    if (!nextModule) {
      console.log('📚 Last module in course - checking for course completion');
      await checkCourseCompletion();
      return;
    }
    
    // Prefer enhanced unlock flow
    unlockingRef.current = true;
    try {
      // Pass the next module ID (the one to unlock), not the current module ID
      const unlock = await EnhancedModuleUnlockService.attemptModuleUnlock(nextModule.id);
      // Refresh progress after attempt
      await progressiveLearning.refreshProgress();

      if (unlock?.success) {
        if (unlock?.course_completed) {
          console.log('🎉 Course completion detected via enhanced unlock!');
          await checkCourseCompletion();
          return;
        }
        if (unlock?.next_module?.title || nextModule?.title) {
          handleModuleUnlock((unlock?.next_module?.title) || (nextModule?.title || 'Next Module'));
          console.log(`✅ Successfully unlocked module: ${(unlock?.next_module?.title) || nextModule?.title}`);
        }
        return;
      }

      // If enhanced unlock failed, surface eligibility guidance
      try {
        const eligibility = await EnhancedModuleUnlockService.checkModuleUnlockEligibility(nextModule.id);
        const fallbackMissing = Array.isArray(eligibility?.recommendations) ? eligibility.recommendations : [];
        const breakdown = moduleScoring?.breakdown || { courseContribution: 0, quizzes: 0, assignments: 0, finalAssessment: 0 };
        setModuleProgressInfo({
          moduleName: currentModule?.title || 'Current Module',
          nextModuleName: nextModule?.title || 'Next Module',
          currentScore,
          requiredScore: passingThreshold,
          missingItems: fallbackMissing,
          breakdown,
          weights: { courseContribution: 10, quizzes: 30, assignments: 40, finalAssessment: 20 },
          assessmentInfo: undefined
        });
        setShowModuleProgressModal(true);
      } catch (_) {
        // As last resort, fall back to legacy completion to remain compatible
        try {
          const legacy = await AssessmentApiService.submitModuleCompletion(currentModuleId);
          await progressiveLearning.refreshProgress();
          if (!nextModule) {
            await checkCourseCompletion();
          } else if (legacy?.passed && legacy?.can_proceed && nextModule?.title) {
            handleModuleUnlock(nextModule.title);
          }
        } catch (legacyErr) {
          console.warn('Legacy completion also failed:', legacyErr);
        }
      }
    } finally {
      unlockingRef.current = false;
    }
  }, [courseData?.course?.modules, currentModuleId, checkModuleCompletion, moduleScoring, progressiveLearning, checkCourseCompletion, handleModuleUnlock]);

  // Update ref when checkAndUnlockNextModule changes
  useEffect(() => {
    checkAndUnlockNextModuleRef.current = checkAndUnlockNextModule;
  }, [checkAndUnlockNextModule]);

  // Handle bookmark
  const handleBookmark = () => {
    setIsBookmarked(!isBookmarked);
    setInteractionHistory(prev => [...prev, {
      type: 'bookmark_toggle',
      lessonId: currentLesson?.id,
      bookmarked: !isBookmarked,
      timestamp: new Date().toISOString()
    }]);
  };

  // Handle share
  const handleShare = () => {
    setInteractionHistory(prev => [...prev, {
      type: 'share_lesson',
      lessonId: currentLesson?.id,
      timestamp: new Date().toISOString()
    }]);
    
    if (navigator.share && currentLesson) {
      navigator.share({
        title: currentLesson.title,
        text: `Check out this lesson: ${currentLesson.title}`,
        url: window.location.href
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  // Track interactions
  const trackInteraction = useCallback((type: string, data?: any) => {
    setInteractionHistory(prev => [...prev, {
      type,
      lessonId: currentLesson?.id,
      timestamp: new Date().toISOString(),
      ...data
    }]);
    
    // Handle quiz completion
    if (type === 'quiz_completed' && data?.quizId) {
      console.log(`📝 Quiz completed: quizId=${data.quizId}, score=${data.score}, passed=${data.passed}`);
      
      // ===== FIX: Update current lesson quiz score immediately =====
      if (typeof data.score === 'number') {
        setCurrentLessonQuizScore(data.score);
        console.log(`📊 Updated currentLessonQuizScore to: ${data.score}%`);
      }
      // ===== END FIX =====
      
      setQuizCompletionStatus(prev => ({
        ...prev,
        [data.quizId]: {
          completed: true,
          score: data.score || 0,
          passed: data.passed || false
        }
      }));
      
      // IMPORTANT: Mark the current lesson as completed in sidebar regardless of pass/fail
      // The backend will handle the actual completion logic, but we update UI immediately for better UX
      if (currentLesson?.id) {
        setLessonCompletionStatus(prev => {
          if (prev[currentLesson.id] !== true) {
            console.log(`✅ Marking lesson ${currentLesson.id} as completed in sidebar (quiz ${data.passed ? 'passed' : 'attempted'})`);
            return {
              ...prev,
              [currentLesson.id]: true
            };
          }
          return prev;
        });
        
        // Show celebration if passed
        if (data.passed) {
          setShowCelebration(true);
        }
      }
      
      // Refresh module scoring to show updated score
      if (moduleScoring?.recalculate) {
        setTimeout(() => {
          moduleScoring.recalculate();
          
          // Check if module can be unlocked after quiz completion
          // Wait for score recalculation to complete
          setTimeout(() => {
            if (checkAndUnlockNextModuleRef.current) {
              checkAndUnlockNextModuleRef.current();
            }
          }, 1000);
        }, 500);
      }
      
      // Update course completion stats
      checkCourseCompletion();
    }
  }, [currentLesson?.id, moduleScoring, checkCourseCompletion]);

  // Get module status
  const getModuleStatus = (moduleId: number): ModuleStatus => {
    const canAccess = progressiveLearning?.canAccessModule(moduleId);
    const progressStatus = progressiveLearning?.getModuleStatus(moduleId);
    
    console.log(`🔍 getModuleStatus(${moduleId}): canAccess=${canAccess}, progressStatus?.status="${progressStatus?.status}"`);
    
    if (progressiveLearning && canAccess) {
      return (progressStatus?.status as ModuleStatus) || 'locked';
    }
    return 'locked';
  };

  // Navigation helpers
  const courseModules = courseData?.course?.modules || courseData?.modules || [];
  const allLessons = NavUtils.getAllLessons(courseModules);
  const currentLessonIndex = NavUtils.getCurrentLessonIndex(currentLesson, courseModules);

  const hasPrevLesson = NavUtils.hasPrevLesson(
    currentLessonIndex,
    allLessons,
    getModuleStatus,
    lessonCompletionStatus
  );

  // Check if current lesson is the last lesson in the current module
  const isLastLessonInModule = useMemo(() => {
    if (!courseData?.course?.modules || !currentModuleId || !currentLesson) return false;
    
    const currentModule = courseData.course.modules.find((m: any) => m.id === currentModuleId);
    if (!currentModule?.lessons || currentModule.lessons.length === 0) return false;
    
    const moduleLessons = currentModule.lessons;
    const lessonIndex = moduleLessons.findIndex((l: any) => l.id === currentLesson.id);
    
    const isLast = lessonIndex === moduleLessons.length - 1;
    
    // Debug logging
    if (isLast) {
      console.log('📍 Last lesson detected:', {
        currentLessonId: currentLesson.id,
        currentLessonTitle: currentLesson.title,
        moduleId: currentModuleId,
        lessonIndex,
        totalLessons: moduleLessons.length
      });
    }
    
    return isLast;
  }, [courseData?.course?.modules, currentModuleId, currentLesson]);

  // Get next module info
  const nextModuleInfo = useMemo(() => {
    if (!courseData?.course?.modules || !currentModuleId) return null;
    
    const modules = courseData.course.modules;
    const currentModuleIndex = modules.findIndex((m: any) => m.id === currentModuleId);
    
    if (currentModuleIndex < 0 || currentModuleIndex >= modules.length - 1) return null;
    
    const nextModule = modules[currentModuleIndex + 1];
    
    // Debug logging
    if (nextModule) {
      console.log('📍 Next module info:', {
        currentModuleIndex,
        totalModules: modules.length,
        nextModuleId: nextModule.id,
        nextModuleTitle: nextModule.title
      });
    }
    
    return nextModule ? { id: nextModule.id, title: nextModule.title } : null;
  }, [courseData?.course?.modules, currentModuleId]);

  // Check if current module is the last module in the course
  const isLastModule = useMemo(() => {
    if (!courseData?.course?.modules || !currentModuleId) return false;
    
    const modules = courseData.course.modules;
    const currentModuleIndex = modules.findIndex((m: any) => m.id === currentModuleId);
    
    const isLast = currentModuleIndex === modules.length - 1;
    
    // Debug logging
    if (isLast) {
      console.log('📍 Last module detected:', {
        currentModuleId,
        currentModuleIndex,
        totalModules: modules.length
      });
    }
    
    return isLast;
  }, [courseData?.course?.modules, currentModuleId]);

  // Check if user can unlock next module (last lesson completed + score >= 80%)
  const canUnlockNextModule = useMemo(() => {
    if (!isLastLessonInModule || !nextModuleInfo) return false;
    const score = moduleScoring?.cumulativeScore ?? 0;
    return isLessonCompleted && score >= 80;
  }, [isLastLessonInModule, nextModuleInfo, moduleScoring?.cumulativeScore, isLessonCompleted]);

  // Calculate hasNextLesson after canUnlockNextModule is defined
  const hasNextLesson = NavUtils.hasNextLesson(
    currentLessonIndex,
    allLessons,
    currentModuleId,
    getModuleStatus,
    lessonCompletionStatus,
    isLessonCompleted,
    canUnlockNextModule
  );

  // Navigation function - defined after canUnlockNextModule
  // This wrapper handles unlock logic before navigation
  const navigateToLesson = async (direction: 'prev' | 'next') => {
    // If navigating next and we can unlock the next module, trigger unlock first
    if (direction === 'next' && canUnlockNextModule && isLastLessonInModule && nextModuleInfo) {
      console.log('🔓 Auto-triggering module unlock before navigation');
      try {
        // Call the unlock API
        const result = await AssessmentApiService.submitModuleCompletion(currentModuleId!);
        if (result.passed && result.can_proceed) {
          console.log('✅ Module unlocked successfully');
          // Refresh progress to update module statuses
          await progressiveLearning.refreshProgress();
        }
      } catch (error) {
        console.warn('Module unlock failed, attempting navigation anyway:', error);
      }
    }
    
    NavUtils.navigateToLesson(
      direction,
      currentLesson,
      courseModules,
      currentModuleId,
      getModuleStatus,
      handleLessonSelect,
      lessonCompletionStatus,
      isLessonCompleted,
      canUnlockNextModule
    );
    
    // Scroll after navigation (handleLessonSelect already handles this)
  };

  // State for unlock button loading
  const [isUnlockingModule, setIsUnlockingModule] = useState(false);

  // Handle unlock next module button click
  const handleUnlockNextModuleClick = useCallback(async () => {
    if (!currentModuleId || !nextModuleInfo) return;
    
    setIsUnlockingModule(true);
    try {
      console.log(`🔓 Manual unlock triggered for next module: ${nextModuleInfo.title}`);
      
      // IMPORTANT: Force save the current lesson progress first
      // This ensures the last lesson's score is saved to the database
      console.log('💾 Saving current lesson progress before module unlock...');
      try {
        await forceSaveProgress();
        console.log('✅ Lesson progress saved successfully');
      } catch (saveError) {
        console.warn('⚠️ Could not save lesson progress:', saveError);
        // Continue with unlock anyway - the progress might already be saved
      }
      
      // Recalculate module score to ensure it reflects latest progress
      if (moduleScoring?.recalculate) {
        await moduleScoring.recalculate();
      }
      
      // Call the existing checkAndUnlockNextModule function
      if (checkAndUnlockNextModuleRef.current) {
        await checkAndUnlockNextModuleRef.current();
      }
      
      // Refresh progress to get updated module statuses
      await progressiveLearning.refreshProgress();
      
    } catch (error) {
      console.error('Failed to unlock next module:', error);
    } finally {
      setIsUnlockingModule(false);
    }
  }, [currentModuleId, nextModuleInfo, progressiveLearning, forceSaveProgress, moduleScoring]);

  // Prevent hydration issues by not rendering until mounted on client
  if (!mounted) {
    return null;
  }

  // Authentication loading state - show while auth is being initialized
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <Card className="w-96 bg-gray-800/50 border-gray-700">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-green-400" />
            <h3 className="text-lg font-semibold mb-2 text-white">Verifying Your Access</h3>
            <p className="text-gray-300">Checking your authentication status...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not authenticated - show redirecting state (useEffect will handle redirect)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <Card className="w-96 bg-gray-800/50 border-gray-700">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-orange-400" />
            <h3 className="text-lg font-semibold mb-2 text-white">Access Required</h3>
            <p className="text-gray-300">Redirecting to login...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <Card className="w-96 bg-gray-800/50 border-gray-700">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-400" />
            <h3 className="text-lg font-semibold mb-2 text-white">Loading Learning Interface</h3>
            <p className="text-gray-300">Preparing your enhanced learning experience...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Enhanced error state with specific messages and retry functionality
  if (error) {
    // Determine error type and customize message
    const isNotPublished = error.toLowerCase().includes('not available') || error.toLowerCase().includes('not published');
    const isNotEnrolled = error.toLowerCase().includes('not enrolled');
    const isNotFound = error.toLowerCase().includes('not found');
    const isNetworkError = error.toLowerCase().includes('network') || error.toLowerCase().includes('fetch') || error.toLowerCase().includes('timeout');
    
    let errorIcon = <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />;
    let errorTitle = "Unable to Load Course";
    let errorMessage = error;
    let errorDescription = "";
    let borderColor = "border-red-900/50";
    let titleColor = "text-red-300";
    let messageColor = "text-red-200";
    let showRetry = false;
    
    if (isNetworkError) {
      errorIcon = <Wifi className="h-12 w-12 text-orange-400 mx-auto mb-4" />;
      errorTitle = "Connection Issue";
      errorMessage = "Unable to connect to the learning platform.";
      errorDescription = "Please check your internet connection and try again. If the problem persists, contact support.";
      borderColor = "border-orange-900/50";
      titleColor = "text-orange-300";
      messageColor = "text-orange-200";
      showRetry = true;
    } else if (isNotPublished) {
      errorIcon = <Lock className="h-12 w-12 text-yellow-400 mx-auto mb-4" />;
      errorTitle = "Course Not Yet Available";
      errorMessage = "This course has not been published yet.";
      errorDescription = "The instructor is still preparing this course content. Please check back later or contact your instructor for more information.";
      borderColor = "border-yellow-900/50";
      titleColor = "text-yellow-300";
      messageColor = "text-yellow-200";
    } else if (isNotEnrolled) {
      errorIcon = <Lock className="h-12 w-12 text-orange-400 mx-auto mb-4" />;
      errorTitle = "Enrollment Required";
      errorMessage = "You are not enrolled in this course.";
      errorDescription = "To access this course content, you need to enroll first. Visit the course page to enroll.";
      borderColor = "border-orange-900/50";
      titleColor = "text-orange-300";
      messageColor = "text-orange-200";
    } else if (isNotFound) {
      errorIcon = <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />;
      errorTitle = "Course Not Found";
      errorMessage = "The requested course could not be found.";
      errorDescription = "This course may have been removed or the link is incorrect. Please check the URL or return to your dashboard.";
      borderColor = "border-gray-700";
      titleColor = "text-gray-300";
      messageColor = "text-gray-400";
    } else {
      showRetry = true; // Show retry for generic errors
    }
    
    const handleRetry = () => {
      setError(null);
      setLoading(true);
      window.location.reload();
    };

    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-4">
        <Card className={`w-full max-w-md bg-gray-800/50 ${borderColor}`}>
          <CardContent className="p-8 text-center">
            {errorIcon}
            <h3 className={`text-xl font-semibold mb-2 ${titleColor}`}>{errorTitle}</h3>
            <p className={`${messageColor} mb-2 font-medium`}>{errorMessage}</p>
            {errorDescription && (
              <p className="text-gray-400 text-sm mb-6">{errorDescription}</p>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {isNotEnrolled ? (
                <>
                  <Button asChild className="bg-green-600 hover:bg-green-700">
                    <Link href={`/courses/${courseId}`}>Enroll Now</Link>
                  </Button>
                  <Button asChild variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                    <Link href="/student/dashboard">Back to Dashboard</Link>
                  </Button>
                </>
              ) : isNotPublished ? (
                <>
                  <Button asChild variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                    <Link href="/student/dashboard">Back to Dashboard</Link>
                  </Button>
                </>
              ) : (
                <>
                  {showRetry && (
                    <Button onClick={handleRetry} className="bg-blue-600 hover:bg-blue-700">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Try Again
                    </Button>
                  )}
                  <Button asChild variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                    <Link href={`/courses/${courseId}`}>View Course</Link>
                  </Button>
                  <Button asChild variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                    <Link href="/student/dashboard">Dashboard</Link>
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Course not found
  if (!courseData || (!courseData.course && !courseData.id && !courseData.title)) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-gray-800/50 border-gray-700">
          <CardContent className="p-8 text-center">
            <BookOpen className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2 text-white">Course Not Found</h3>
            <p className="text-gray-300 mb-4">The requested course could not be found.</p>
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href="/student/dashboard">Return to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const course = courseData.course || courseData;

  return (
    <div className="min-h-screen bg-[#0a0e1a]">
      {/* Instructor Preview Mode Indicator */}
      {viewAsStudent && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500/90 backdrop-blur-sm text-black px-4 py-2 text-center text-sm font-medium">
          📚 Instructor Preview Mode - All modules are unlocked for preview
        </div>
      )}
      <LearningHeader
        courseTitle={course.title || ''}
        currentLessonTitle={currentLesson?.title}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        timeSpent={timeSpent}
        engagementScore={engagementScore}
        currentLessonIndex={currentLessonIndex}
        totalLessons={allLessons.length}
        isBookmarked={isBookmarked}
        focusMode={focusMode}
        courseId={courseId}
        onBookmark={handleBookmark}
        onShare={handleShare}
        onToggleFocus={() => setFocusMode(!focusMode)}
        helpDialogOpen={helpDialogOpen}
        setHelpDialogOpen={setHelpDialogOpen}
      />

      <div className={`flex ${viewAsStudent ? 'pt-10' : ''}`}>
        <LearningSidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          modules={courseModules}
          currentLessonId={currentLesson?.id}
          currentModuleId={currentModuleId}
          getModuleStatus={getModuleStatus}
          onLessonSelect={handleLessonSelect}
          onQuizSelect={handleQuizSelect}
          lessonAssessments={lessonAssessments}
          lessonCompletionStatus={lessonCompletionStatus}
          quizCompletionStatus={quizCompletionStatus}
          onLockedModuleClick={handleLockedModuleClick}
          viewAsStudent={viewAsStudent}
          totalModuleCount={courseData?.course?.total_module_count}
          releasedModuleCount={courseData?.course?.released_module_count}
        />

        {currentLesson ? (
          <LessonContent
            currentLesson={currentLesson}
            lessonQuiz={lessonQuiz}
            lessonAssignments={lessonAssignments}
            contentLoading={contentLoading}
            quizLoadError={quizLoadError}
            readingProgress={readingProgress}
            engagementScore={engagementScore}
            timeSpent={timeSpent}
            scrollProgress={scrollProgress}
            isLessonCompleted={isLessonCompleted}
            currentViewMode={currentViewMode}
            setCurrentViewMode={setCurrentViewMode}
            lessonNotes={lessonNotes}
            setLessonNotes={setLessonNotes}
            contentRef={contentRef}
            onVideoProgress={handleVideoProgress}
            onVideoComplete={handleVideoComplete}
            onMixedContentVideoProgress={handleMixedContentVideoProgress}
            onMixedContentVideoComplete={handleMixedContentVideoComplete}
            videoProgress={videoProgress}
            videoCurrentTime={videoCurrentTime}
            videoDuration={videoDuration}
            moduleScoring={moduleScoring}
            lessonScore={lessonScore}
            currentLessonQuizScore={currentLessonQuizScore}
            currentLessonAssignmentScore={currentLessonAssignmentScore}
            currentModuleId={currentModuleId}
            currentLessonIndex={currentLessonIndex}
            totalLessons={allLessons.length}
            hasNextLesson={hasNextLesson}
            hasPrevLesson={hasPrevLesson}
            onNavigate={navigateToLesson}
            onTrackInteraction={trackInteraction}
            onReloadContent={reloadLessonContent}
            onQuizComplete={handleQuizComplete}
            onAssignmentSubmit={handleAssignmentSubmit}
            getModuleStatus={getModuleStatus}
            allLessons={allLessons}
            isLastLessonInModule={isLastLessonInModule}
            isLastModule={isLastModule}
            nextModuleInfo={nextModuleInfo}
            onUnlockNextModule={handleUnlockNextModuleClick}
            isUnlockingModule={isUnlockingModule}
            courseId={courseId}
            onManualComplete={handleManualCompletion}
            canManuallyComplete={canManuallyComplete()}
          />
        ) : (
          <div className="flex-1 min-w-0">
            <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
              <div className="bg-gray-800/50 rounded-lg shadow-sm border border-gray-700 p-8 text-center max-w-md">
                <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2 text-white">No Lesson Selected</h3>
                <p className="text-gray-300">Select a lesson from the sidebar to begin learning.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <UnlockAnimation
        showUnlockAnimation={showUnlockAnimation}
        unlockedModuleName={unlockedModuleName}
        onClose={() => setShowUnlockAnimation(false)}
      />

      <CelebrationModal
        showCelebration={showCelebration}
        timeSpent={timeSpent}
        engagementScore={engagementScore}
        readingProgress={readingProgress}
        newBadgesEarned={newBadgesEarned}
        onClose={closeCelebration}
      />

      {/* Module Progress Requirements Modal */}
      <AnimatePresence>
        {showModuleProgressModal && moduleProgressInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
            onClick={() => setShowModuleProgressModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 40 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 40 }}
              className="bg-gray-900 border border-gray-700/80 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl max-h-[90vh] sm:max-h-[88vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag handle (mobile only) */}
              <div className="flex-shrink-0 flex justify-center pt-3 pb-1 sm:hidden">
                <div className="w-10 h-1 rounded-full bg-gray-600" />
              </div>

              {/* Scrollable body */}
              <div className="overflow-y-auto flex-1 px-4 sm:px-6 pb-4 sm:pb-6 pt-2 sm:pt-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div className="flex-shrink-0 p-2 bg-yellow-500/20 rounded-lg">
                      <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-500" />
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-white truncate">Almost There!</h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowModuleProgressModal(false)}
                    className="flex-shrink-0 ml-2 text-gray-400 hover:text-white hover:bg-gray-800 h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Module Info */}
                <div className="mb-4">
                  <p className="text-gray-300 text-sm leading-relaxed mb-1.5">
                    You've completed all lessons in{' '}
                    <span className="text-white font-semibold break-words">{moduleProgressInfo.moduleName}</span>!
                  </p>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    To unlock{' '}
                    <span className="text-blue-400 font-medium break-words">{moduleProgressInfo.nextModuleName}</span>
                    , you need to reach the passing score.
                  </p>
                </div>

                {/* Score Progress */}
                <div className="bg-gray-800/50 rounded-xl p-3 sm:p-4 mb-4 border border-gray-700/50">
                  <div className="flex justify-between items-center mb-2 gap-2">
                    <span className="text-gray-400 text-xs sm:text-sm">Current Module Score</span>
                    <span className={`font-bold text-sm sm:text-base tabular-nums flex-shrink-0 ${moduleProgressInfo.currentScore >= moduleProgressInfo.requiredScore ? 'text-green-400' : 'text-yellow-400'}`}>
                      {moduleProgressInfo.currentScore.toFixed(1)}%
                    </span>
                  </div>
                  {/* Progress bar with required marker */}
                  <div className="relative w-full mb-3">
                    <div className="w-full bg-gray-700 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all duration-500 ${
                          moduleProgressInfo.currentScore >= moduleProgressInfo.requiredScore
                            ? 'bg-green-500'
                            : moduleProgressInfo.currentScore >= 60
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(100, moduleProgressInfo.currentScore)}%` }}
                      />
                    </div>
                    {/* Required score tick */}
                    <div
                      className="absolute top-0 h-3 w-0.5 bg-green-400 rounded-full"
                      style={{ left: `${moduleProgressInfo.requiredScore}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>0%</span>
                    <span className="text-green-400 font-medium">Required: {moduleProgressInfo.requiredScore}%</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* Score Breakdown - Dynamic weights */}
                <div className="mb-4">
                  <h4 className="text-white font-semibold text-sm mb-2.5 flex items-center gap-2 flex-wrap">
                    <span>📊 Score Breakdown</span>
                    {moduleProgressInfo.assessmentInfo?.isReadingOnly && (
                      <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">Reading Only</span>
                    )}
                  </h4>
                  <div className="space-y-2.5 rounded-xl bg-gray-800/40 border border-gray-700/40 px-3 py-2.5">
                    {/* Reading & Engagement - Always shown */}
                    {(moduleProgressInfo.weights?.courseContribution || 0) > 0 && (
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-gray-400 flex items-center gap-1.5 min-w-0">
                          <span className="flex-shrink-0 text-base leading-none">🖥️</span>
                          <span className="truncate">Reading & Engagement</span>
                          <span className="flex-shrink-0 text-gray-500 text-xs">({moduleProgressInfo.weights?.courseContribution || 10}%)</span>
                        </span>
                        <span className={`font-semibold flex-shrink-0 tabular-nums ${moduleProgressInfo.breakdown.courseContribution >= 80 ? 'text-green-400' : 'text-yellow-400'}`}>
                          {moduleProgressInfo.breakdown.courseContribution.toFixed(0)}%
                        </span>
                      </div>
                    )}

                    {/* Quiz Score - Only shown if available */}
                    {(moduleProgressInfo.weights?.quizzes || 0) > 0 && (
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-gray-400 flex items-center gap-1.5 min-w-0">
                          <span className="flex-shrink-0 text-base leading-none">📝</span>
                          <span className="truncate">Quiz Score</span>
                          <span className="flex-shrink-0 text-gray-500 text-xs">({moduleProgressInfo.weights?.quizzes || 30}%)</span>
                        </span>
                        <span className={`font-semibold flex-shrink-0 tabular-nums ${moduleProgressInfo.breakdown.quizzes >= 80 ? 'text-green-400' : 'text-yellow-400'}`}>
                          {moduleProgressInfo.breakdown.quizzes.toFixed(0)}%
                        </span>
                      </div>
                    )}

                    {/* Assignments - Only shown if available */}
                    {(moduleProgressInfo.weights?.assignments || 0) > 0 && (
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-gray-400 flex items-center gap-1.5 min-w-0">
                          <span className="flex-shrink-0 text-base leading-none">📋</span>
                          <span className="truncate">Assignments</span>
                          <span className="flex-shrink-0 text-gray-500 text-xs">({moduleProgressInfo.weights?.assignments || 40}%)</span>
                        </span>
                        <span className={`font-semibold flex-shrink-0 tabular-nums ${moduleProgressInfo.breakdown.assignments >= 80 ? 'text-green-400' : 'text-yellow-400'}`}>
                          {moduleProgressInfo.breakdown.assignments.toFixed(0)}%
                        </span>
                      </div>
                    )}

                    {/* Final Assessment - Only shown if available */}
                    {(moduleProgressInfo.weights?.finalAssessment || 0) > 0 && (
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-gray-400 flex items-center gap-1.5 min-w-0">
                          <span className="flex-shrink-0 text-base leading-none">🎯</span>
                          <span className="truncate">Final Assessment</span>
                          <span className="flex-shrink-0 text-gray-500 text-xs">({moduleProgressInfo.weights?.finalAssessment || 20}%)</span>
                        </span>
                        <span className={`font-semibold flex-shrink-0 tabular-nums ${moduleProgressInfo.breakdown.finalAssessment >= 80 ? 'text-green-400' : 'text-yellow-400'}`}>
                          {moduleProgressInfo.breakdown.finalAssessment.toFixed(0)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Missing Items */}
                {moduleProgressInfo.missingItems.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-white font-semibold text-sm mb-2">🎯 Areas to Improve</h4>
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3">
                      <ul className="space-y-1.5">
                        {moduleProgressInfo.missingItems.map((item, index) => (
                          <li key={index} className="text-yellow-300 text-xs sm:text-sm leading-snug">{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Tips */}
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 mb-4">
                  <h4 className="text-blue-400 font-semibold text-sm mb-2">💡 Tips to Improve</h4>
                  <ul className="text-blue-300 text-xs sm:text-sm space-y-1.5">
                    <li>• Retake quizzes to improve your score</li>
                    <li>• Complete all assignments with best effort</li>
                    <li>• Read through lesson content thoroughly</li>
                    <li>• Take the final assessment when ready</li>
                  </ul>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800 h-10 sm:h-11 text-sm"
                    onClick={() => setShowModuleProgressModal(false)}
                  >
                    Close
                  </Button>
                  <Button
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white h-10 sm:h-11 text-sm"
                    onClick={() => {
                      setShowModuleProgressModal(false);
                      // Scroll to top to review content
                      if (contentRef.current) {
                        contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                      }
                    }}
                  >
                    Review Content
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Enhanced Locked Module Requirements Modal */}
      <Dialog open={showLockedModuleModal} onOpenChange={setShowLockedModuleModal}>
        <DialogContent className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border-gray-700 text-white max-w-lg sm:max-w-2xl lg:max-w-4xl xl:max-w-5xl w-full max-h-[90vh] overflow-hidden">
          <DialogHeader className="pb-2 border-b border-gray-700/50">
            <DialogTitle className="flex items-center gap-3 text-xl sm:text-2xl lg:text-3xl">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <Lock className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-orange-400" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
                  Module Locked
                </span>
                <span className="text-sm sm:text-base lg:text-lg font-normal text-gray-300">
                  Complete requirements to unlock
                </span>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div className="overflow-y-auto max-h-[calc(90vh-8rem)] pr-2 custom-scrollbar">
            {lockedModuleInfo && (
              <div className="space-y-4 sm:space-y-6 py-4">
                {/* Target Module - Enhanced */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-gradient-to-r from-blue-900/30 to-indigo-900/30 rounded-xl p-4 sm:p-6 border border-blue-700/50 backdrop-blur-sm"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg shrink-0">
                      <Target className="h-5 w-5 sm:h-6 sm:w-6 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm sm:text-base text-blue-300 font-medium block mb-1">
                        🎯 Module you want to unlock
                      </span>
                      <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-white break-words">
                        Module {lockedModuleInfo.moduleIndex + 1}: {lockedModuleInfo.moduleTitle}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <div className="bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/30">
                          <span className="text-xs sm:text-sm text-blue-300 font-medium">🔒 Currently Locked</span>
                        </div>
                        <div className="bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/30">
                          <span className="text-xs sm:text-sm text-yellow-300 font-medium">⏳ Pending Requirements</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Previous Module Requirements - Enhanced */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-gradient-to-r from-orange-900/30 to-red-900/30 rounded-xl p-4 sm:p-6 border border-orange-700/50 backdrop-blur-sm"
                >
                  <div className="flex items-start gap-3 mb-4">
                    <div className="p-2 bg-orange-500/20 rounded-lg shrink-0">
                      <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm sm:text-base text-orange-300 font-bold block mb-1">
                        📋 Requirements to unlock
                      </span>
                      <p className="text-sm sm:text-base text-gray-300 mb-4">
                        Complete <span className="text-white font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                          Module {lockedModuleInfo.moduleIndex}: {lockedModuleInfo.previousModuleTitle}
                        </span> with a passing score.
                      </p>
                    </div>
                  </div>

                  {/* Enhanced Progress Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    {/* Lessons Progress - Enhanced */}
                    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-blue-400" />
                          <span className="text-sm sm:text-base text-gray-300 font-medium">Lessons</span>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs sm:text-sm font-bold ${
                          lockedModuleInfo.previousModuleLessonsCompleted === lockedModuleInfo.previousModuleTotalLessons 
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                            : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                        }`}>
                          {lockedModuleInfo.previousModuleLessonsCompleted}/{lockedModuleInfo.previousModuleTotalLessons}
                        </div>
                      </div>
                      <Progress 
                        value={(lockedModuleInfo.previousModuleLessonsCompleted / lockedModuleInfo.previousModuleTotalLessons) * 100} 
                        className="h-3 bg-gray-700 mb-2"
                      />
                      <div className="text-xs text-gray-400">
                        {Math.round((lockedModuleInfo.previousModuleLessonsCompleted / lockedModuleInfo.previousModuleTotalLessons) * 100)}% Complete
                      </div>
                    </div>

                    {/* Score Progress - Enhanced */}
                    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                          <Award className="h-4 w-4 text-purple-400" />
                          <span className="text-sm sm:text-base text-gray-300 font-medium">Score</span>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs sm:text-sm font-bold ${
                          lockedModuleInfo.previousModuleScore >= lockedModuleInfo.requiredScore 
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                          {lockedModuleInfo.previousModuleScore.toFixed(1)}%
                        </div>
                      </div>
                      <div className="relative mb-2">
                        <Progress 
                          value={Math.min(100, lockedModuleInfo.previousModuleScore)} 
                          className="h-3 bg-gray-700"
                        />
                        {/* Enhanced threshold marker */}
                        <div 
                          className="absolute top-0 w-1 h-3 bg-green-400 rounded-r-sm shadow-sm"
                          style={{ left: `${lockedModuleInfo.requiredScore}%` }}
                        />
                        <div 
                          className="absolute -top-6 transform -translate-x-1/2 text-xs text-green-400 font-medium"
                          style={{ left: `${lockedModuleInfo.requiredScore}%` }}
                        >
                          {lockedModuleInfo.requiredScore}%
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">
                        Required: {lockedModuleInfo.requiredScore}% minimum
                      </div>
                    </div>
                  </div>

                  {/* Detailed Action Items - Enhanced */}
                  <div className="mt-6 pt-4 border-t border-orange-700/30">
                    <h4 className="text-orange-300 text-sm sm:text-base font-bold mb-4 flex items-center gap-2">
                      <span className="text-lg">⚡</span> Action Items
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {lockedModuleInfo.previousModuleLessonsCompleted < lockedModuleInfo.previousModuleTotalLessons && (
                        <div className="flex items-start gap-3 bg-red-900/20 p-3 rounded-lg border border-red-700/30">
                          <div className="w-2 h-2 rounded-full bg-red-400 mt-2 shrink-0" />
                          <div>
                            <p className="text-sm sm:text-base text-red-300 font-medium">
                              Complete {lockedModuleInfo.previousModuleTotalLessons - lockedModuleInfo.previousModuleLessonsCompleted} more lesson(s)
                            </p>
                            <p className="text-xs text-red-400/70">
                              All lessons must be completed to proceed
                            </p>
                          </div>
                        </div>
                      )}
                      {lockedModuleInfo.previousModuleScore < lockedModuleInfo.requiredScore && (
                        <div className="flex items-start gap-3 bg-orange-900/20 p-3 rounded-lg border border-orange-700/30">
                          <div className="w-2 h-2 rounded-full bg-orange-400 mt-2 shrink-0" />
                          <div>
                            <p className="text-sm sm:text-base text-orange-300 font-medium">
                              Improve score by {(lockedModuleInfo.requiredScore - lockedModuleInfo.previousModuleScore).toFixed(1)}%
                            </p>
                            <p className="text-xs text-orange-400/70">
                              Retake quizzes or improve assignments
                            </p>
                          </div>
                        </div>
                      )}
                      {lockedModuleInfo.previousModuleLessonsCompleted === lockedModuleInfo.previousModuleTotalLessons && 
                       lockedModuleInfo.previousModuleScore >= lockedModuleInfo.requiredScore && (
                        <div className="flex items-start gap-3 bg-green-900/20 p-3 rounded-lg border border-green-700/30 sm:col-span-2">
                          <CheckCircle className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm sm:text-base text-green-300 font-bold">
                              🎉 All requirements met!
                            </p>
                            <p className="text-xs text-green-400/70">
                              Module should unlock automatically. Try refreshing or click unlock below.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>

                {/* Enhanced Eligibility Insights */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="bg-gradient-to-r from-slate-900/40 to-slate-800/30 rounded-lg p-4 sm:p-6 border border-slate-700/40 backdrop-blur-sm"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-slate-200 font-bold text-sm sm:text-base">Eligibility Overview</h4>
                    {lockedModuleEligibilityLoading && (
                      <span className="text-xs text-slate-400">Loading…</span>
                    )}
                  </div>
                  {lockedModuleEligibility && (
                    <div className="space-y-3">
                      {/* Previous Module Info */}
                      {lockedModuleEligibility.previous_module && (
                        <div className="text-xs text-slate-400 mb-2">
                          Checking: <span className="text-slate-200 font-semibold">{lockedModuleEligibility.previous_module.title}</span>
                        </div>
                      )}
                      
                      <div className="flex flex-wrap gap-2">
                        <span className={`px-2 py-1 text-xs rounded border ${lockedModuleEligibility.eligible ? 'bg-green-500/10 text-green-300 border-green-600/30' : 'bg-yellow-500/10 text-yellow-300 border-yellow-600/30'}`}>
                          {lockedModuleEligibility.eligible ? 'Eligible' : 'Not Eligible'}
                        </span>
                        <span className="px-2 py-1 text-xs rounded border bg-slate-700/40 text-slate-300 border-slate-600/40">
                          Score: {Math.round(lockedModuleEligibility.total_score || 0)}% / {Math.round(lockedModuleEligibility.required_score || 80)}%
                        </span>
                        {lockedModuleEligibility.can_preview && (
                          <span className="px-2 py-1 text-xs rounded border bg-blue-500/10 text-blue-300 border-blue-600/30">Preview Allowed</span>
                        )}
                      </div>
                      
                      {/* Detailed Lesson Status */}
                      {lockedModuleEligibility.lesson_requirements && (
                        <div className="text-xs text-slate-300">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <div className={`w-2 h-2 rounded-full ${lockedModuleEligibility.lesson_requirements.all_lessons_passed ? 'bg-green-400' : 'bg-yellow-400'}`} />
                              <span>
                                Lessons: {lockedModuleEligibility.lesson_requirements.passed_count || 0} / {lockedModuleEligibility.lesson_requirements.total_count || 0} passed
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {Array.isArray(lockedModuleEligibility.recommendations) && lockedModuleEligibility.recommendations.length > 0 && (
                        <div>
                          <p className="text-xs text-slate-300 mb-2">Recommendations:</p>
                          <ul className="list-disc list-inside text-xs text-slate-300 space-y-1">
                            {lockedModuleEligibility.recommendations.map((rec: string, idx: number) => (
                              <li key={idx}>{rec}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>

                {/* Enhanced Tips Section */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-gradient-to-r from-blue-900/30 to-cyan-900/30 rounded-lg p-4 sm:p-6 border border-blue-700/30 backdrop-blur-sm"
                >
                  <h4 className="text-blue-400 font-bold text-sm sm:text-base mb-3 flex items-center gap-2">
                    <span className="text-lg">💡</span> Pro Tips to Boost Your Score
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-400 mt-2 shrink-0" />
                      <div>
                        <p className="text-sm sm:text-base text-blue-300 font-medium">Master the Quizzes</p>
                        <p className="text-xs text-blue-400/70">Aim for 80%+ on all quiz attempts</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-400 mt-2 shrink-0" />
                      <div>
                        <p className="text-sm sm:text-base text-blue-300 font-medium">Excel in Assignments</p>
                        <p className="text-xs text-blue-400/70">Submit high-quality work on time</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-400 mt-2 shrink-0" />
                      <div>
                        <p className="text-sm sm:text-base text-blue-300 font-medium">Deep Learning</p>
                        <p className="text-xs text-blue-400/70">Read all content thoroughly for better understanding</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-400 mt-2 shrink-0" />
                      <div>
                        <p className="text-sm sm:text-base text-blue-300 font-medium">Stay Engaged</p>
                        <p className="text-xs text-blue-400/70">Participate actively in all lesson activities</p>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Enhanced Action Buttons */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="space-y-3"
                >
                  {/* Unlock Button - Show only when all requirements are met */}
                  {lockedModuleInfo.previousModuleLessonsCompleted === lockedModuleInfo.previousModuleTotalLessons && 
                   lockedModuleInfo.previousModuleScore >= lockedModuleInfo.requiredScore && (
                    <Button
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 sm:py-4 text-sm sm:text-base transition-all duration-200 shadow-lg hover:shadow-xl"
                      disabled={modalUnlocking}
                      onClick={async () => {
                        try {
                          if (modalUnlocking) return;
                          setModalUnlocking(true);
                          // Call enhanced API to unlock the target module
                          console.log(`🔓 Manually unlocking module ${lockedModuleInfo.moduleId} via enhanced API`);
                          const result = await EnhancedModuleUnlockService.attemptModuleUnlock(lockedModuleInfo.moduleId);
                          console.log('🔓 Unlock result (enhanced):', result);
                          
                          // Refresh progress data
                          await progressiveLearning.refreshProgress();
                          
                          // Close modal
                          setShowLockedModuleModal(false);
                          
                          // Show success toast or navigate to the unlocked module
                          if (result?.success) {
                            // Navigate to the newly unlocked module's first lesson
                            const unlockedModule = courseModules.find((m: any) => m.id === lockedModuleInfo.moduleId);
                            const unlockedModuleLessons = unlockedModule?.lessons || [];
                            if (unlockedModuleLessons.length > 0) {
                              handleLessonSelect(unlockedModuleLessons[0].id, lockedModuleInfo.moduleId);
                              handleModuleUnlock(lockedModuleInfo.moduleTitle);
                            }
                          } else {
                            // Extract and show detailed error in modal dialog
                            const errorInfo = EnhancedModuleUnlockService.extractUnlockError(result);
                            setUnlockErrorInfo(errorInfo);
                            setUnlockTargetModuleId(lockedModuleInfo.moduleId);
                            setShowUnlockErrorDialog(true);
                            // Keep modal open so user can see the error dialog
                          }
                        } catch (error: any) {
                          console.error('Failed to unlock module:', error);
                          // Still try to refresh and check if it was already unlocked
                          await progressiveLearning.refreshProgress();
                        } finally {
                          setModalUnlocking(false);
                        }
                      }}
                    >
                      <div className="flex items-center justify-center gap-2 sm:gap-3">
                        <Unlock className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span>🚀 Unlock Module {lockedModuleInfo.moduleIndex + 1}</span>
                      </div>
                    </Button>
                  )}

                  {/* Go to Previous Module Button - Enhanced */}
                  <Button
                    className={`w-full font-medium py-3 sm:py-4 text-sm sm:text-base transition-all duration-200 ${
                      lockedModuleInfo.previousModuleLessonsCompleted === lockedModuleInfo.previousModuleTotalLessons && 
                      lockedModuleInfo.previousModuleScore >= lockedModuleInfo.requiredScore
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-300 border border-gray-600'
                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl'
                    }`}
                    onClick={() => {
                      setShowLockedModuleModal(false);
                      // Navigate to the previous module's first incomplete lesson
                      if (lockedModuleInfo.previousModuleId) {
                        const previousModule = courseModules.find((m: any) => m.id === lockedModuleInfo.previousModuleId);
                        const previousModuleLessons = previousModule?.lessons || [];
                        if (previousModuleLessons.length > 0) {
                          // Find first incomplete lesson or first lesson
                          const firstIncompleteLesson = previousModuleLessons.find(
                            (l: any) => !lessonCompletionStatus[l.id]
                          ) || previousModuleLessons[0];
                          handleLessonSelect(firstIncompleteLesson.id, lockedModuleInfo.previousModuleId);
                        }
                      }
                    }}
                  >
                    <div className="flex items-center justify-center gap-2 sm:gap-3">
                      <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
                      <span>📚 Go to Module {lockedModuleInfo.moduleIndex}: {lockedModuleInfo.previousModuleTitle}</span>
                    </div>
                  </Button>
                </motion.div>
              </div>
            )}
          </div>

          {/* Custom scrollbar styles */}
          <style jsx>{`
            .custom-scrollbar::-webkit-scrollbar {
              width: 6px;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
              background: rgba(75, 85, 99, 0.3);
              border-radius: 3px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
              background: rgba(156, 163, 175, 0.5);
              border-radius: 3px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
              background: rgba(156, 163, 175, 0.7);
            }
          `}</style>
        </DialogContent>
      </Dialog>

      <AnimatePresence>
        {showCertificateNotification && (
          <motion.div
            initial={{ opacity: 0, y: -100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -100 }}
            className="fixed top-4 right-4 z-50"
          >
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl p-6 shadow-2xl max-w-sm">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/20 rounded-full">
                  <Award className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-bold text-lg">🎓 Course Completed!</h4>
                  <p className="text-green-100 text-sm">Your certificate is ready</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCertificateNotification(false)}
                  className="text-white hover:bg-white/20"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-4">
                <Link href="/student/certificates">
                  <Button variant="secondary" size="sm" className="w-full">
                    View Certificate
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Module Unlock Error Dialog */}
      {unlockErrorInfo && unlockTargetModuleId && (
        <ModuleUnlockErrorDialog
          open={showUnlockErrorDialog}
          onOpenChange={(open) => {
            setShowUnlockErrorDialog(open);
            if (!open) {
              setUnlockErrorInfo(null);
              setUnlockTargetModuleId(null);
            }
          }}
          targetModuleId={unlockTargetModuleId}
          errorInfo={unlockErrorInfo}
        />
      )}
    </div>
  );
};

export default LearningPage;
