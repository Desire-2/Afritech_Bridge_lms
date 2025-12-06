"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useParams } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { StudentApiService } from '@/services/studentApi';
import { AssessmentApiService } from '@/services/api';
import ContentAssignmentService, { type ContentQuiz, type ContentAssignment } from '@/services/contentAssignmentApi';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Loader2, AlertCircle, BookOpen, Award, X, Lock, Target, CheckCircle, ArrowRight } from 'lucide-react';
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
  
  // Core state
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
  
  // Video tracking state
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoCompleted, setVideoCompleted] = useState(false);
  
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
  
  // Client-side mounting state to prevent hydration issues
  const [mounted, setMounted] = useState(false);
  
  // Refs for tracking
  const contentRef = useRef<HTMLDivElement | null>(null);
  const autoAdvanceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const checkAndUnlockNextModuleRef = useRef<(() => Promise<void>) | null>(null);
  
  // Progressive Learning Hooks
  const progressiveLearning = useProgressiveLearning(courseId);
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
    isLessonCompleted,
    updateReadingProgress,
    handleAutoLessonCompletion,
    checkAutoCompletion
  } = useProgressTracking({
    currentLesson,
    currentModuleId,
    showCelebration,
    contentRef,
    interactionHistory,
    hasQuiz: !!lessonQuiz,
    hasAssignment: lessonAssignments.length > 0
  });

  // Calculate comprehensive lesson score (Reading 25% + Engagement 25% + Quiz 25% + Assignment 25%)
  useEffect(() => {
    const calculatedScore = (
      (readingProgress * 0.25) +
      (engagementScore * 0.25) +
      (currentLessonQuizScore * 0.25) +
      (currentLessonAssignmentScore * 0.25)
    );
    setLessonScore(calculatedScore);
    console.log('📊 Lesson Score calculated:', {
      reading: readingProgress,
      engagement: engagementScore,
      quiz: currentLessonQuizScore,
      assignment: currentLessonAssignmentScore,
      total: calculatedScore
    });
  }, [readingProgress, engagementScore, currentLessonQuizScore, currentLessonAssignmentScore]);

  // Fetch existing quiz and assignment scores when lesson changes
  useEffect(() => {
    const fetchLessonScores = async () => {
      if (!currentLesson?.id) return;
      
      try {
        // Fetch quiz score if quiz exists
        if (lessonQuiz?.id) {
          try {
            const quizAttempts = await StudentApiService.getQuizAttempts(lessonQuiz.id);
            if (quizAttempts && quizAttempts.length > 0) {
              // Get best score from all attempts
              const bestScore = Math.max(...quizAttempts.map((a: any) => a.score || a.score_percentage || 0));
              setCurrentLessonQuizScore(bestScore);
              console.log(`📊 Loaded quiz score for lesson ${currentLesson.id}: ${bestScore}%`);
            } else {
              setCurrentLessonQuizScore(0);
            }
          } catch (error: any) {
            if (error?.response?.status !== 404) {
              console.error('Error fetching quiz attempts:', error);
            }
            setCurrentLessonQuizScore(0);
          }
        } else {
          setCurrentLessonQuizScore(0);
        }

        // Fetch assignment score if assignments exist
        // Note: Assignment scores are loaded from the submission_status field in the assignment object
        if (lessonAssignments && lessonAssignments.length > 0) {
          try {
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
            console.log(`📊 Loaded assignment score for lesson ${currentLesson.id}: ${avgAssignmentScore}%`);
          } catch (error) {
            console.error('Error fetching assignment scores:', error);
            setCurrentLessonAssignmentScore(0);
          }
        } else {
          setCurrentLessonAssignmentScore(0);
        }
      } catch (error) {
        console.error('Error fetching lesson scores:', error);
      }
    };

    fetchLessonScores();
  }, [currentLesson?.id, lessonQuiz?.id, lessonAssignments]);

  // Auto-complete lessons without quiz/assignment when criteria are met
  useEffect(() => {
    if (!currentLesson || !currentModuleId) return;

    // Check if lesson should auto-complete
    const shouldAutoComplete = checkAutoCompletion();

    if (shouldAutoComplete) {
      console.log('🎯 Auto-completing lesson (no quiz/assignment required)...');
      
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
        },
        (error) => {
          console.error('❌ Auto-completion failed:', error);
        }
      );
    }
  }, [readingProgress, engagementScore, currentLesson, currentModuleId, checkAutoCompletion, handleAutoLessonCompletion, lessonScore, moduleScoring]);

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

  // Calculate lesson score based on reading (40%), engagement (30%), quiz (30%)
  useEffect(() => {
    if (currentLesson?.id) {
      const quizScore = lessonQuiz?.id && quizCompletionStatus[lessonQuiz.id]?.completed 
        ? quizCompletionStatus[lessonQuiz.id].score 
        : 0;
      
      const calculatedScore = (
        (readingProgress * 0.4) +
        (engagementScore * 0.3) +
        (quizScore * 0.3)
      );
      
      setLessonScore(Math.round(calculatedScore));
    }
  }, [currentLesson?.id, readingProgress, engagementScore, lessonQuiz?.id, quizCompletionStatus]);

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
            return moduleProgress.cumulative_score || 0;
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

  // Video tracking handlers
  const handleVideoProgress = useCallback((progress: number) => {
    setVideoProgress(progress);
    setInteractionHistory(prev => [...prev, {
      type: 'video_progress',
      lessonId: currentLesson?.id,
      data: { progress },
      timestamp: new Date().toISOString()
    }]);
  }, [currentLesson?.id]);

  const handleVideoComplete = useCallback(async () => {
    setVideoCompleted(true);
    setInteractionHistory(prev => [...prev, {
      type: 'video_completed',
      lessonId: currentLesson?.id,
      timestamp: new Date().toISOString()
    }]);
    
    // Mark lesson as completed when video is watched
    if (currentLesson?.id && currentModuleId) {
      try {
        // Use existing API to mark lesson complete
        await StudentApiService.completeLesson(currentLesson.id, {
          method: 'video_watched',
          module_id: currentModuleId,
          auto_completed: false
        });
        setShowCelebration(true);
      } catch (error) {
        console.error('Error marking lesson complete:', error);
      }
    }
  }, [currentLesson?.id, currentModuleId]);

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
              // Mark as completed if reading progress is 100% or explicitly marked as completed/auto_completed
              completionStatuses[lesson.id] = response.progress?.completed || response.auto_completed || response.reading_progress >= 100 || false;
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
          console.log('✅ Loaded lesson completion statuses:', merged);
          return merged;
        });
      } catch (error) {
        console.error('Failed to load lesson completion statuses:', error);
      }
    };
    
    loadLessonCompletionStatuses();
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

  // Authentication check
  useEffect(() => {
    if (authLoading) {
      // Still loading auth, don't redirect yet
      return;
    }
    
    if (!isAuthenticated) {
      // Only redirect after auth loading is complete and user is not authenticated
      window.location.href = '/auth/signin';
      return;
    }
  }, [isAuthenticated, authLoading]);

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

  // Handle lesson selection
  const handleLessonSelect = (lessonId: number, moduleId: number) => {
    const courseModules = courseData?.course?.modules || courseData?.modules || [];
    if (courseModules) {
      const allLessons = courseModules.flatMap((module: any) => module.lessons || []);
      const lesson = allLessons.find((l: any) => l.id === lessonId);
      if (lesson) {
        console.log('📍 Navigating to lesson:', lesson.title, '(ID:', lessonId, ')');
        
        setCurrentLesson(lesson);
        setCurrentModuleId(moduleId);
        setLessonNotes('');
        setCurrentViewMode('content'); // Reset to content tab when navigating to a new lesson
        
        // Reset video tracking for new lesson
        setVideoProgress(0);
        setVideoCompleted(false);
        
        // Content will be loaded by the useEffect that watches currentLesson.id
        
        // Save to localStorage for persistence within session
        saveLastLesson(courseId, lessonId, moduleId);
        
        setInteractionHistory(prev => [...prev, {
          type: 'lesson_select',
          lessonId,
          moduleId,
          timestamp: new Date().toISOString()
        }]);
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
        
        // Load lesson content (which includes the quiz)
        loadLessonContent(lessonId).then(() => {
          // Switch to quiz view after content is loaded
          setCurrentViewMode('quiz');
          console.log('✅ Switched to quiz view');
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
    console.log('🔒 Locked module clicked:', info);
    setLockedModuleInfo(info);
    setShowLockedModuleModal(true);
  }, []);

  // Auto-unlock next module when current module is completed with passing score
  const checkAndUnlockNextModule = useCallback(async () => {
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
      
      // Show what's missing to reach the passing score
      const missingItems: string[] = [];
      const breakdown = moduleScoring?.breakdown || {
        courseContribution: 0,
        quizzes: 0,
        assignments: 0,
        finalAssessment: 0
      };
      
      // Check each component and suggest improvements
      // Course contribution is 10% of total
      if (breakdown.courseContribution < 80) {
        missingItems.push(`📖 Reading & Engagement: ${breakdown.courseContribution.toFixed(0)}% (aim for 80%+)`);
      }
      
      // Quiz score is 30% of total
      if (breakdown.quizzes < 80) {
        missingItems.push(`📝 Quiz Score: ${breakdown.quizzes.toFixed(0)}% (aim for 80%+)`);
      }
      
      // Assignment score is 40% of total
      if (breakdown.assignments < 80) {
        missingItems.push(`📋 Assignment Score: ${breakdown.assignments.toFixed(0)}% (aim for 80%+)`);
      }
      
      // Final assessment is 20% of total
      if (breakdown.finalAssessment < 80) {
        missingItems.push(`🎯 Final Assessment: ${breakdown.finalAssessment.toFixed(0)}% (aim for 80%+)`);
      }
      
      // Show the modal with missing requirements
      if (nextModule) {
        setModuleProgressInfo({
          moduleName: currentModule?.title || 'Current Module',
          nextModuleName: nextModule?.title || 'Next Module',
          currentScore,
          requiredScore: passingThreshold,
          missingItems,
          breakdown
        });
        setShowModuleProgressModal(true);
      }
      
      return;
    }
    
    if (!nextModule) {
      console.log('🎉 Last module completed! Course finished!');
      // Check for course completion
      checkCourseCompletion();
      return;
    }
    
    // Try to unlock next module via API
    try {
      console.log(`🔓 Attempting to unlock next module: ${nextModule.title || nextModule.id}`);
      
      // Call module completion API to trigger backend unlock
      const result = await AssessmentApiService.submitModuleCompletion(currentModuleId);
      
      console.log('🔓 Module completion result:', result);
      
      if (result.passed && result.can_proceed) {
        // Refresh progress data to get updated module statuses
        await progressiveLearning.refreshProgress();
        
        // Show unlock animation
        handleModuleUnlock(nextModule.title || 'Next Module');
        
        console.log(`✅ Successfully unlocked module: ${nextModule.title}`);
      }
    } catch (error: any) {
      // Module might already be unlocked or not ready
      console.warn('Module unlock attempt:', error?.response?.data?.message || error?.message);
      
      // Still try to refresh progress in case module was already unlocked
      await progressiveLearning.refreshProgress();
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
    if (progressiveLearning && progressiveLearning.canAccessModule(moduleId)) {
      const status = progressiveLearning.getModuleStatus(moduleId);
      return (status?.status as ModuleStatus) || 'locked';
    }
    return 'locked';
  };

  // Navigation helpers
  const courseModules = courseData?.course?.modules || courseData?.modules || [];
  const allLessons = NavUtils.getAllLessons(courseModules);
  const currentLessonIndex = NavUtils.getCurrentLessonIndex(currentLesson, courseModules);
  
  const navigateToLesson = (direction: 'prev' | 'next') => {
    NavUtils.navigateToLesson(
      direction,
      currentLesson,
      courseModules,
      currentModuleId,
      getModuleStatus,
      handleLessonSelect,
      lessonCompletionStatus
    );
  };

  const hasNextLesson = NavUtils.hasNextLesson(
    currentLessonIndex,
    allLessons,
    currentModuleId,
    getModuleStatus,
    lessonCompletionStatus
  );

  const hasPrevLesson = NavUtils.hasPrevLesson(
    currentLessonIndex,
    allLessons,
    getModuleStatus,
    lessonCompletionStatus
  );

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

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-gray-800/50 border-red-900/50">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2 text-red-300">Unable to Load Course</h3>
            <p className="text-red-200 mb-4">{error}</p>
            <div className="flex gap-2 justify-center">
              <Button asChild variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                <Link href={`/student/courses/${courseId}`}>Back to Course</Link>
              </Button>
              <Button onClick={() => window.location.reload()} className="bg-blue-600 hover:bg-blue-700">Try Again</Button>
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

      <div className="flex">
        <LearningSidebar
          sidebarOpen={sidebarOpen}
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setShowModuleProgressModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md mx-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-500/20 rounded-lg">
                    <AlertCircle className="h-6 w-6 text-yellow-500" />
                  </div>
                  <h3 className="text-lg font-bold text-white">Almost There!</h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowModuleProgressModal(false)}
                  className="text-gray-400 hover:text-white hover:bg-gray-800"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Module Info */}
              <div className="mb-4">
                <p className="text-gray-300 text-sm mb-2">
                  You've completed all lessons in <span className="text-white font-medium">{moduleProgressInfo.moduleName}</span>!
                </p>
                <p className="text-gray-400 text-sm">
                  To unlock <span className="text-blue-400 font-medium">{moduleProgressInfo.nextModuleName}</span>, you need to reach the passing score.
                </p>
              </div>

              {/* Score Progress */}
              <div className="bg-gray-800/50 rounded-xl p-4 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-400 text-sm">Current Module Score</span>
                  <span className={`font-bold ${moduleProgressInfo.currentScore >= moduleProgressInfo.requiredScore ? 'text-green-400' : 'text-yellow-400'}`}>
                    {moduleProgressInfo.currentScore.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3 mb-2">
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
                <div className="flex justify-between text-xs text-gray-500">
                  <span>0%</span>
                  <span className="text-green-400">Required: {moduleProgressInfo.requiredScore}%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Score Breakdown */}
              <div className="mb-4">
                <h4 className="text-white font-medium text-sm mb-3">📊 Score Breakdown</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">📖 Reading & Engagement (10%)</span>
                    <span className={`font-medium ${moduleProgressInfo.breakdown.courseContribution >= 80 ? 'text-green-400' : 'text-yellow-400'}`}>
                      {moduleProgressInfo.breakdown.courseContribution.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">📝 Quiz Score (30%)</span>
                    <span className={`font-medium ${moduleProgressInfo.breakdown.quizzes >= 80 ? 'text-green-400' : 'text-yellow-400'}`}>
                      {moduleProgressInfo.breakdown.quizzes.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">📋 Assignments (40%)</span>
                    <span className={`font-medium ${moduleProgressInfo.breakdown.assignments >= 80 ? 'text-green-400' : 'text-yellow-400'}`}>
                      {moduleProgressInfo.breakdown.assignments.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">🎯 Final Assessment (20%)</span>
                    <span className={`font-medium ${moduleProgressInfo.breakdown.finalAssessment >= 80 ? 'text-green-400' : 'text-yellow-400'}`}>
                      {moduleProgressInfo.breakdown.finalAssessment.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Missing Items */}
              {moduleProgressInfo.missingItems.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-white font-medium text-sm mb-2">🎯 Areas to Improve</h4>
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                    <ul className="space-y-1">
                      {moduleProgressInfo.missingItems.map((item, index) => (
                        <li key={index} className="text-yellow-300 text-sm">{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Tips */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-4">
                <h4 className="text-blue-400 font-medium text-sm mb-1">💡 Tips to Improve</h4>
                <ul className="text-blue-300 text-xs space-y-1">
                  <li>• Retake quizzes to improve your score</li>
                  <li>• Complete all assignments with best effort</li>
                  <li>• Read through lesson content thoroughly</li>
                  <li>• Take the final assessment when ready</li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800"
                  onClick={() => setShowModuleProgressModal(false)}
                >
                  Close
                </Button>
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Locked Module Requirements Modal */}
      <Dialog open={showLockedModuleModal} onOpenChange={setShowLockedModuleModal}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Lock className="h-5 w-5 text-orange-400" />
              Module Locked
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Complete the previous module to unlock this one
            </DialogDescription>
          </DialogHeader>
          
          {lockedModuleInfo && (
            <div className="space-y-4 py-2">
              {/* Target Module */}
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-blue-400" />
                  <span className="text-sm text-gray-400">Module you want to unlock:</span>
                </div>
                <p className="text-white font-medium">
                  Module {lockedModuleInfo.moduleIndex + 1}: {lockedModuleInfo.moduleTitle}
                </p>
              </div>

              {/* Previous Module Requirements */}
              <div className="bg-orange-900/20 rounded-xl p-4 border border-orange-700/50">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="h-4 w-4 text-orange-400" />
                  <span className="text-sm text-orange-300 font-medium">Requirements to unlock:</span>
                </div>
                
                <p className="text-gray-300 text-sm mb-3">
                  Complete <span className="text-white font-medium">Module {lockedModuleInfo.moduleIndex}: {lockedModuleInfo.previousModuleTitle}</span> with a passing score.
                </p>

                {/* Previous Module Progress */}
                <div className="space-y-3">
                  {/* Lessons Progress */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-gray-400 text-xs">Lessons Completed</span>
                      <span className={`text-xs font-medium ${
                        lockedModuleInfo.previousModuleLessonsCompleted === lockedModuleInfo.previousModuleTotalLessons 
                          ? 'text-green-400' 
                          : 'text-yellow-400'
                      }`}>
                        {lockedModuleInfo.previousModuleLessonsCompleted}/{lockedModuleInfo.previousModuleTotalLessons}
                      </span>
                    </div>
                    <Progress 
                      value={(lockedModuleInfo.previousModuleLessonsCompleted / lockedModuleInfo.previousModuleTotalLessons) * 100} 
                      className="h-2 bg-gray-700"
                    />
                  </div>

                  {/* Score Progress */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-gray-400 text-xs">Module Score</span>
                      <span className={`text-xs font-medium ${
                        lockedModuleInfo.previousModuleScore >= lockedModuleInfo.requiredScore 
                          ? 'text-green-400' 
                          : 'text-yellow-400'
                      }`}>
                        {lockedModuleInfo.previousModuleScore.toFixed(1)}% / {lockedModuleInfo.requiredScore}% required
                      </span>
                    </div>
                    <div className="relative">
                      <Progress 
                        value={Math.min(100, lockedModuleInfo.previousModuleScore)} 
                        className="h-2 bg-gray-700"
                      />
                      {/* Threshold marker */}
                      <div 
                        className="absolute top-0 w-0.5 h-2 bg-green-400"
                        style={{ left: `${lockedModuleInfo.requiredScore}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* What's Missing */}
                <div className="mt-4 pt-3 border-t border-orange-700/30">
                  <h4 className="text-orange-300 text-xs font-medium mb-2">What you need to do:</h4>
                  <ul className="space-y-1">
                    {lockedModuleInfo.previousModuleLessonsCompleted < lockedModuleInfo.previousModuleTotalLessons && (
                      <li className="flex items-center gap-2 text-xs text-gray-300">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                        Complete {lockedModuleInfo.previousModuleTotalLessons - lockedModuleInfo.previousModuleLessonsCompleted} more lesson(s)
                      </li>
                    )}
                    {lockedModuleInfo.previousModuleScore < lockedModuleInfo.requiredScore && (
                      <li className="flex items-center gap-2 text-xs text-gray-300">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                        Improve score by {(lockedModuleInfo.requiredScore - lockedModuleInfo.previousModuleScore).toFixed(1)}%
                      </li>
                    )}
                    {lockedModuleInfo.previousModuleLessonsCompleted === lockedModuleInfo.previousModuleTotalLessons && 
                     lockedModuleInfo.previousModuleScore >= lockedModuleInfo.requiredScore && (
                      <li className="flex items-center gap-2 text-xs text-green-300">
                        <CheckCircle className="h-3 w-3" />
                        All requirements met! Module should unlock soon.
                      </li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Tips */}
              <div className="bg-blue-900/20 rounded-lg p-3 border border-blue-700/30">
                <h4 className="text-blue-400 font-medium text-xs mb-2">💡 Tips to improve your score</h4>
                <ul className="text-blue-300 text-xs space-y-1">
                  <li>• Complete all quizzes with passing scores</li>
                  <li>• Submit assignments on time</li>
                  <li>• Read through all lesson content carefully</li>
                </ul>
              </div>

              {/* Action Button */}
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
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
                <ArrowRight className="h-4 w-4 mr-2" />
                Go to Module {lockedModuleInfo.moduleIndex}: {lockedModuleInfo.previousModuleTitle}
              </Button>
            </div>
          )}
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
    </div>
  );
};

export default LearningPage;
