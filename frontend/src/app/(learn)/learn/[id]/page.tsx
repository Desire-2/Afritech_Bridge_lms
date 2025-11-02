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
  
  // Video tracking state
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoCompleted, setVideoCompleted] = useState(false);
  
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
    handleAutoLessonCompletion
  } = useProgressTracking({
    currentLesson,
    currentModuleId,
    showCelebration,
    contentRef,
    interactionHistory
  });

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
    try {
      const [quizResponse, assignmentsResponse] = await Promise.all([
        ContentAssignmentService.getLessonQuiz(lessonId).catch(() => ({ lesson: null, quiz: null })),
        ContentAssignmentService.getLessonAssignments(lessonId).catch(() => ({ lesson: null, assignments: [] }))
      ]);
      
      setLessonQuiz(quizResponse.quiz);
      setLessonAssignments(assignmentsResponse.assignments || []);
      
      // Build assessments data for sidebar
      const assessments: any[] = [];
      
      if (quizResponse.quiz) {
        assessments.push({
          id: quizResponse.quiz.id,
          title: quizResponse.quiz.title || 'Quiz',
          type: 'quiz',
          status: quizResponse.quiz.completed ? 'completed' : 'pending',
          dueDate: quizResponse.quiz.due_date
        });
      }
      
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
        
        if (response.current_lesson) {
          setCurrentLesson(response.current_lesson);
          const moduleWithLesson = response.course?.modules?.find((module: any) => 
            module.lessons?.some((lesson: any) => lesson.id === response.current_lesson.id)
          );
          if (moduleWithLesson) {
            setCurrentModuleId(moduleWithLesson.id);
          }
        } else if (response.course?.modules?.[0]?.lessons?.[0]) {
          setCurrentLesson(response.course.modules[0].lessons[0]);
          setCurrentModuleId(response.course.modules[0].id);
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

  // Handle lesson selection
  const handleLessonSelect = (lessonId: number, moduleId: number) => {
    const courseModules = courseData?.course?.modules || courseData?.modules || [];
    if (courseModules) {
      const allLessons = courseModules.flatMap((module: any) => module.lessons || []);
      const lesson = allLessons.find((l: any) => l.id === lessonId);
      if (lesson) {
        setCurrentLesson(lesson);
        setCurrentModuleId(moduleId);
        setLessonNotes('');
        
        // Reset video tracking for new lesson
        setVideoProgress(0);
        setVideoCompleted(false);
        
        loadLessonContent(lessonId);
        
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
  }, [currentLesson?.id]);

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
      handleLessonSelect
    );
  };

  const hasNextLesson = NavUtils.hasNextLesson(
    currentLessonIndex,
    allLessons,
    currentModuleId,
    getModuleStatus
  );

  const hasPrevLesson = NavUtils.hasPrevLesson(
    currentLessonIndex,
    allLessons,
    getModuleStatus
  );

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
        />

        {currentLesson ? (
          <LessonContent
            currentLesson={currentLesson}
            lessonQuiz={lessonQuiz}
            lessonAssignments={lessonAssignments}
            contentLoading={contentLoading}
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
            currentModuleId={currentModuleId}
            currentLessonIndex={currentLessonIndex}
            totalLessons={allLessons.length}
            hasNextLesson={hasNextLesson}
            hasPrevLesson={hasPrevLesson}
            onNavigate={navigateToLesson}
            onTrackInteraction={trackInteraction}
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
