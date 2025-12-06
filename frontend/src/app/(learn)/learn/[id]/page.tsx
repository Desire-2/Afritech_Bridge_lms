"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useParams } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { StudentApiService } from '@/services/studentApi';
import ContentAssignmentService, { type ContentQuiz, type ContentAssignment } from '@/services/contentAssignmentApi';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, BookOpen, Award, X } from 'lucide-react';
import Link from 'next/link';
import { useProgressiveLearning, useModuleAttempts, useModuleScoring } from '@/hooks/useProgressiveLearning';
import { motion, AnimatePresence } from 'framer-motion';

// Import custom components and utilities
import { LearningHeader } from './components/LearningHeader';
import { LearningSidebar } from './components/LearningSidebar';
import { LessonContent } from './components/LessonContent';
import { CelebrationModal } from './components/CelebrationModal';
import { UnlockAnimation } from './components/UnlockAnimation';
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
  const [lessonScore, setLessonScore] = useState(0);
  
  // Video tracking state
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoCompleted, setVideoCompleted] = useState(false);
  
  // Client-side mounting state to prevent hydration issues
  const [mounted, setMounted] = useState(false);
  
  // Refs for tracking
  const contentRef = useRef<HTMLDivElement | null>(null);
  const autoAdvanceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Progressive Learning Hooks
  const progressiveLearning = useProgressiveLearning(courseId);
  const moduleAttempts = useModuleAttempts(currentModuleId || 0);
  const moduleScoring = useModuleScoring(currentModuleId || 0);

  // Progress tracking hook
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

  // Helper function to close celebration
  const closeCelebration = useCallback(() => {
    setShowCelebration(false);
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
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
    } catch (error) {
      console.error('Error loading lesson content:', error);
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
    if (!courseData?.course?.modules) return;

    try {
      const completionMap: { [lessonId: number]: boolean } = {};
      
      // Create an array of all lessons with their lesson IDs
      courseData.course.modules.forEach((module: any) => {
        module.lessons?.forEach((lesson: any) => {
          completionMap[lesson.id] = false;
        });
      });

      // Try to fetch lesson progress for each lesson
      const progressPromises = courseData.course.modules.flatMap((module: any) =>
        (module.lessons || []).map(async (lesson: any) => {
          try {
            const progress = await StudentApiService.getLessonProgress(lesson.id);
            // Check if lesson is completed (reading progress >= 100 or auto_completed)
            if (progress.reading_progress >= 100 || progress.auto_completed) {
              completionMap[lesson.id] = true;
            }
          } catch (error) {
            // If API fails, assume not completed
            completionMap[lesson.id] = false;
          }
        })
      );

      await Promise.all(progressPromises);
      setLessonCompletionStatus(completionMap);
    } catch (error) {
      console.error('Error fetching lesson completion status:', error);
    }
  }, [courseData?.course?.modules]);

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
          Object.keys(prev).forEach(lessonId => {
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
        setCourseData(response);
        
        // Priority order for setting current lesson:
        // 1. Find first uncompleted lesson from backend data (most accurate)
        // 2. Use current_lesson_id from API if available
        // 3. Check localStorage for last accessed lesson
        // 4. Default to first lesson
        
        let lessonToSet = null;
        let moduleIdToSet = null;
        
        // 1. Try to find the first uncompleted lesson from backend modules data
        if (response.modules && response.modules.length > 0) {
          console.log('🔍 Searching for first uncompleted lesson...');
          
          for (const module of response.modules) {
            if (module.lessons && module.lessons.length > 0) {
              const uncompletedLesson = module.lessons.find((lesson: any) => !lesson.completed);
              
              if (uncompletedLesson) {
                // Find full lesson object from course.modules
                const fullModule = response.course?.modules?.find((m: any) => m.id === module.id);
                if (fullModule) {
                  const fullLesson = fullModule.lessons?.find((l: any) => l.id === uncompletedLesson.id);
                  if (fullLesson) {
                    lessonToSet = fullLesson;
                    moduleIdToSet = module.id;
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
    if (currentLesson?.id) {
      loadLessonContent(currentLesson.id);
    }
  }, [currentLesson?.id, loadLessonContent]);

  // Reload content when switching to quiz or assignment tab (if not already loaded)
  useEffect(() => {
    if (currentViewMode === 'quiz' || currentViewMode === 'assignments') {
      if (currentLesson?.id && (!lessonQuiz && currentViewMode === 'quiz')) {
        console.log(`🔄 Tab switched to ${currentViewMode}, reloading content...`);
        loadLessonContent(currentLesson.id);
      }
    }
  }, [currentViewMode, currentLesson?.id, lessonQuiz, loadLessonContent]);

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
        
        loadLessonContent(lessonId);
        
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
        }, 500);
      }
      
      // Update course completion stats
      checkCourseCompletion();
    }
  }, [currentLesson?.id, moduleScoring]);

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
          lessonAssessments={lessonAssessments}
          lessonCompletionStatus={lessonCompletionStatus}
          quizCompletionStatus={quizCompletionStatus}
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
            currentModuleId={currentModuleId}
            currentLessonIndex={currentLessonIndex}
            totalLessons={allLessons.length}
            hasNextLesson={hasNextLesson}
            hasPrevLesson={hasPrevLesson}
            onNavigate={navigateToLesson}
            onTrackInteraction={trackInteraction}
            onReloadContent={reloadLessonContent}
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
