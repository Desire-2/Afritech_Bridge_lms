"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useParams } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { StudentApiService } from '@/services/studentApi';
import ContentAssignmentService, { type LessonContent, type ContentQuiz, type ContentAssignment } from '@/services/contentAssignmentApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, BookOpen, Play, Target, Settings, HelpCircle, ArrowLeft, ArrowRight, Lock, CheckCircle, Clock, Menu, X, Eye, Timer, Award, Brain, ChevronUp, ChevronDown, Heart, Star, Trophy, Zap, Bookmark, Share2, Download, Medal, FileText, PenTool, Clipboard, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProgressiveLearning, useModuleAttempts, useModuleScoring } from '@/hooks/useProgressiveLearning';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { motion, AnimatePresence } from 'framer-motion';

// Phase 5 Enhanced Learning Interface Component with Automatic Progress Tracking
const LearningPage = () => {
  const { user, isAuthenticated } = useAuth();
  const params = useParams();
  const courseId = parseInt(params.id as string);
  
  // Core state
  const [courseData, setCourseData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentLesson, setCurrentLesson] = useState<any>(null);
  const [currentModuleId, setCurrentModuleId] = useState<number | null>(null);
  
  // Enhanced content state
  const [lessonContent, setLessonContent] = useState<LessonContent | null>(null);
  const [lessonQuiz, setLessonQuiz] = useState<ContentQuiz | null>(null);
  const [lessonAssignments, setLessonAssignments] = useState<ContentAssignment[]>([]);
  const [contentLoading, setContentLoading] = useState(false);
  
  // Enhanced Progress Tracking State
  const [readingProgress, setReadingProgress] = useState<number>(0);
  const [timeSpent, setTimeSpent] = useState<number>(0);
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [engagementScore, setEngagementScore] = useState<number>(0);
  const [isLessonCompleted, setIsLessonCompleted] = useState<boolean>(false);
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);
  
  // Course Completion Tracking
  const [courseCompletion, setCourseCompletion] = useState({
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
  const [currentViewMode, setCurrentViewMode] = useState<'content' | 'assessment' | 'notes'>('content');
  const [interactionHistory, setInteractionHistory] = useState<any[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [lessonNotes, setLessonNotes] = useState<string>('');
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [completionInProgress, setCompletionInProgress] = useState(false);
  
  // Refs for tracking
  const contentRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(Date.now());
  const lastInteractionRef = useRef<number>(Date.now());
  const readingTimeRef = useRef<number>(0);
  const autoAdvanceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Progressive Learning Hooks (always called to maintain hook order)
  const progressiveLearning = useProgressiveLearning(courseId);
  const moduleAttempts = useModuleAttempts(currentModuleId || 0);
  const moduleScoring = useModuleScoring(currentModuleId || 0);

  // Helper function to close celebration
  const closeCelebration = useCallback(() => {
    setShowCelebration(false);
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
  }, []);

  // Automatic Progress Tracking Functions
  const updateReadingProgress = useCallback(() => {
    // Don't update progress when celebration modal is showing
    if (showCelebration) return;
    
    const currentTime = Date.now();
    const timeSinceStart = (currentTime - startTimeRef.current) / 1000; // seconds
    
    let scrollProgress = 0;
    
    if (contentRef.current) {
      const element = contentRef.current;
      const scrollTop = element.scrollTop;
      const scrollHeight = element.scrollHeight - element.clientHeight;
      
      if (scrollHeight > 0) {
        scrollProgress = (scrollTop / scrollHeight) * 100;
      } else {
        // If content is not scrollable, use time-based progress
        scrollProgress = Math.min(100, (timeSinceStart / 180) * 100); // 3 minutes = 100%
      }
    }
    
    // Update scroll progress
    setScrollProgress(Math.min(100, Math.max(0, scrollProgress)));
    
    // Calculate time-based progress (fallback for short content)
    const timeProgress = Math.min(100, (timeSinceStart / 300) * 100); // 5 minutes = 100%
    
    // Use the higher of scroll or time progress
    const combinedProgress = Math.max(scrollProgress, timeProgress);
    setReadingProgress(combinedProgress);
    
    console.log('Progress update:', 
      `Scroll: ${scrollProgress.toFixed(1)}%, Time: ${timeProgress.toFixed(1)}%, Combined: ${combinedProgress.toFixed(1)}%, TimeSince: ${timeSinceStart}s`); // Debug log
    
    // Track engagement
    if (scrollProgress > 0 || timeSinceStart > 10) { // Consider engaged after 10 seconds
      lastInteractionRef.current = currentTime;
      readingTimeRef.current += 2; // Increment by 2 since we update every 2 seconds
    }
    
    // Calculate engagement score
    const engagementFactors = {
      scrollProgress: scrollProgress / 100,
      timeSpent: Math.min(timeSinceStart / 600, 1), // 10 minutes max
      interactions: Math.min(interactionHistory.length / 10, 1),
      consistency: Math.min(readingTimeRef.current / 100, 1) // Reading consistency
    };
    
    const newEngagementScore = (
      engagementFactors.scrollProgress * 0.3 +
      engagementFactors.timeSpent * 0.3 +
      engagementFactors.interactions * 0.2 +
      engagementFactors.consistency * 0.2
    ) * 100;
    
    setEngagementScore(newEngagementScore);
    
    console.log('Engagement factors:', 
      `Scroll: ${engagementFactors.scrollProgress.toFixed(2)}, Time: ${engagementFactors.timeSpent.toFixed(2)}, Interactions: ${engagementFactors.interactions.toFixed(2)}, Consistency: ${engagementFactors.consistency.toFixed(2)}`,
      'Score:', newEngagementScore.toFixed(2)); // Debug log
    
    // Auto-complete when thresholds are met (only once per lesson)
    if (combinedProgress >= 80 && newEngagementScore >= 70 && !isLessonCompleted) {
      console.log('Auto-completing lesson'); // Debug log
      handleAutoLessonCompletion();
    }
  }, [interactionHistory.length, isLessonCompleted, showCelebration]);

  // Auto-save progress function
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
  const handleAutoLessonCompletion = useCallback(async () => {
    if (!currentLesson || isLessonCompleted || completionInProgress) return;
    
    try {
      setCompletionInProgress(true);
      setIsLessonCompleted(true);
      setShowCelebration(true);
      
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
      
      // Track completion interaction
      setInteractionHistory(prev => [...prev, {
        type: 'lesson_completed',
        lessonId: currentLesson.id,
        moduleId: currentModuleId,
        timestamp: new Date().toISOString(),
        timeSpent: timeSpentSeconds,
        engagementScore: engagementScore
      }]);
      
      // Check for new badges and course completion after lesson completion
      await checkBadgeEligibility();
      await checkCourseCompletion();
      
      // Auto-advance after celebration
      autoAdvanceTimeoutRef.current = setTimeout(() => {
        setShowCelebration(false);
        autoAdvanceToNextLesson();
      }, 3000);
      
    } catch (error: any) {
      console.error('Failed to complete lesson:', error);
      
      // Check if it's an already completed error (which is actually okay)
      if (error?.response?.status === 400 && error?.response?.data?.message?.includes('already completed')) {
        console.log('Lesson was already completed, proceeding with celebration');
        // Don't reset completion state, keep the celebration
      } else {
        // For other errors, reset completion state
        setIsLessonCompleted(false);
        setCompletionInProgress(false);
        setShowCelebration(false);
      }
    } finally {
      // Ensure completion flag is reset after a short delay to prevent immediate re-triggering
      setTimeout(() => {
        setCompletionInProgress(false);
      }, 1000);
    }
  }, [currentLesson, currentModuleId, readingProgress, engagementScore, scrollProgress, isLessonCompleted]);

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
      // Module completed, check for next module
      const moduleIndex = courseData.course.modules.findIndex((m: any) => m.id === currentModuleId);
      const nextModule = courseData.course.modules[moduleIndex + 1];
      if (nextModule && nextModule.lessons?.[0]) {
        handleModuleUnlock(nextModule.title || 'Next Module');
        setTimeout(() => {
          handleLessonSelect(nextModule.lessons[0].id, nextModule.id);
        }, 2000);
      }
    }
  }, [courseData, currentLesson, currentModuleId]);

  // Load lesson content including quizzes and assignments
  const loadLessonContent = useCallback(async (lessonId: number) => {
    if (!lessonId) return;
    
    setContentLoading(true);
    try {
      // Load lesson quiz and assignments in parallel
      const [quizResponse, assignmentsResponse] = await Promise.all([
        ContentAssignmentService.getLessonQuiz(lessonId).catch(() => ({ lesson: null, quiz: null })),
        ContentAssignmentService.getLessonAssignments(lessonId).catch(() => ({ lesson: null, assignments: [] }))
      ]);
      
      setLessonQuiz(quizResponse.quiz);
      setLessonAssignments(assignmentsResponse.assignments || []);
    } catch (error) {
      console.error('Error loading lesson content:', error);
    } finally {
      setContentLoading(false);
    }
  }, []);

  // Enhanced scroll tracking
  useEffect(() => {
    const handleScroll = () => {
      if (showCelebration) return; // Don't track scroll during celebration
      console.log('Scroll event triggered'); // Debug log
      updateReadingProgress();
    };
    
    const element = contentRef.current;
    
    if (element) {
      element.addEventListener('scroll', handleScroll, { passive: true });
      
      // Also trigger initial progress calculation (only if no celebration)
      setTimeout(() => {
        if (!showCelebration) {
          updateReadingProgress();
        }
      }, 1000);
      
      return () => element.removeEventListener('scroll', handleScroll);
    }
  }, [updateReadingProgress, showCelebration]);

  // Time tracking and periodic progress updates
  useEffect(() => {
    const timer = setInterval(() => {
      if (showCelebration) return; // Don't update progress during celebration
      
      setTimeSpent(Math.floor((Date.now() - startTimeRef.current) / 1000));
      
      // Trigger progress update even without scrolling
      updateReadingProgress();
    }, 2000); // Update every 2 seconds
    
    return () => clearInterval(timer);
  }, [updateReadingProgress, showCelebration]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showCelebration) {
      // Save current scroll position
      const scrollY = window.scrollY;
      
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      
      return () => {
        // Restore body scroll
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        
        // Restore scroll position
        window.scrollTo(0, scrollY);
      };
    }
  }, [showCelebration]);

  // Auto-save timer
  useEffect(() => {
    if (currentLesson && !isLessonCompleted) {
      const timer = setInterval(autoSaveProgress, 30000); // Auto-save every 30 seconds
      setAutoSaveTimer(timer);
      
      return () => {
        clearInterval(timer);
        setAutoSaveTimer(null);
      };
    }
  }, [currentLesson, autoSaveProgress, isLessonCompleted]);

  // Load content when lesson changes
  useEffect(() => {
    if (currentLesson?.id) {
      loadLessonContent(currentLesson.id);
    }
  }, [currentLesson?.id, loadLessonContent]);

  // Reset progress when lesson changes
  useEffect(() => {
    if (currentLesson) {
      startTimeRef.current = Date.now();
      setReadingProgress(0);
      setScrollProgress(0);
      setEngagementScore(0);
      setTimeSpent(0);
      setIsLessonCompleted(false);
      setShowCelebration(false); // Also hide celebration when changing lessons
      readingTimeRef.current = 0;
      
      // Clear any pending auto-advance timeout
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
        autoAdvanceTimeoutRef.current = null;
      }
    }
  }, [currentLesson?.id]);

  // Authentication check
  useEffect(() => {
    if (!isAuthenticated) {
      window.location.href = '/auth/signin';
      return;
    }
  }, [isAuthenticated]);

  // Load course data
  useEffect(() => {
    if (!isAuthenticated || !courseId) return;

    const fetchCourseData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('Fetching course data for ID:', courseId);
        const response = await StudentApiService.getCourseDetails(courseId);
        console.log('Course data response:', response);
        
        setCourseData(response);
        
        // Set current lesson and module
        if (response.current_lesson) {
          setCurrentLesson(response.current_lesson);
          // Find the module for this lesson
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
  }, [courseId, isAuthenticated]);

  // Load lesson content when lesson changes
  useEffect(() => {
    if (currentLesson?.id) {
      console.log('Current lesson changed, loading content for lesson ID:', currentLesson.id);
      loadLessonContent(currentLesson.id);
    }
  }, [currentLesson?.id, loadLessonContent]);

  // Handle lesson selection with enhanced tracking
  const handleLessonSelect = (lessonId: number, moduleId: number) => {
    if (courseData?.course?.modules) {
      const allLessons = courseData.course.modules.flatMap((module: any) => module.lessons || []);
      const lesson = allLessons.find((l: any) => l.id === lessonId);
      if (lesson) {
        setCurrentLesson(lesson);
        setCurrentModuleId(moduleId);
        setLessonNotes('');
        
        // Load lesson content (quiz and assignments)
        console.log('Lesson selected, loading content for lesson ID:', lessonId);
        loadLessonContent(lessonId);
        
        // Track interaction
        setInteractionHistory(prev => [...prev, {
          type: 'lesson_select',
          lessonId,
          moduleId,
          timestamp: new Date().toISOString()
        }]);
      }
    }
  };

  // Handle module unlock with enhanced animation
  const handleModuleUnlock = (moduleName: string) => {
    setUnlockedModuleName(moduleName);
    setShowUnlockAnimation(true);
    
    // Track unlock event
    setInteractionHistory(prev => [...prev, {
      type: 'module_unlock',
      moduleName,
      timestamp: new Date().toISOString()
    }]);
  };

  // Enhanced bookmark functionality
  const handleBookmark = () => {
    setIsBookmarked(!isBookmarked);
    setInteractionHistory(prev => [...prev, {
      type: 'bookmark_toggle',
      lessonId: currentLesson?.id,
      bookmarked: !isBookmarked,
      timestamp: new Date().toISOString()
    }]);
  };

  // Share lesson functionality
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
      // Could show a toast notification here
    }
  };

  // Check for badge eligibility after lesson completion
  const checkBadgeEligibility = useCallback(async () => {
    if (!courseData?.course) return;

    try {
      // Get current progress
      const progressData = await StudentApiService.getCourseProgress(courseId);
      const completedLessons = progressData.lessons_completed || 0;
      
      // Check for lesson completion badge (every 3 lessons)
      if (completedLessons > 0 && completedLessons % 3 === 0) {
        // Award badge for completing 3 lessons
        const newBadges = await StudentApiService.checkEarnedBadges(courseId);
        if (newBadges.length > 0) {
          setNewBadgesEarned(prev => [...prev, ...newBadges.map(b => b.name)]);
          
          // Show celebration for new badge
          setShowCelebration(true);
          setTimeout(() => setShowCelebration(false), 3000);
        }
      }
    } catch (error) {
      console.error('Error checking badge eligibility:', error);
    }
  }, [courseData, courseId]);

  // Check course completion and certificate eligibility
  const checkCourseCompletion = useCallback(async () => {
    if (!courseData?.course) return;

    try {
      // Get comprehensive course progress
      const progressData = await StudentApiService.getCourseProgress(courseId);
      const moduleScores = await Promise.all(
        courseData.course.modules.map(async (module: any) => {
          try {
            const moduleProgress = await StudentApiService.getModuleProgress(module.id);
            return moduleProgress.cumulative_score || 0;
          } catch {
            return 0;
          }
        })
      );

      // Calculate overall course score
      const overallScore = moduleScores.reduce((sum, score) => sum + score, 0) / moduleScores.length;
      
      const completion = {
        totalLessons: courseData.course.modules.reduce((sum: number, m: any) => sum + (m.lessons?.length || 0), 0),
        completedLessons: progressData.lessons_completed || 0,
        totalQuizzes: progressData.total_quizzes || 0,
        completedQuizzes: progressData.completed_quizzes || 0,
        totalAssignments: progressData.total_assignments || 0,
        completedAssignments: progressData.completed_assignments || 0,
        overallScore,
        passingThreshold: 80
      };

      setCourseCompletion(completion);

      // Check if course is completed and eligible for certificate
      const allLessonsCompleted = completion.completedLessons >= completion.totalLessons;
      const allQuizzesCompleted = completion.completedQuizzes >= completion.totalQuizzes;
      const allAssignmentsCompleted = completion.completedAssignments >= completion.totalAssignments;
      const passingScore = overallScore >= completion.passingThreshold;

      if (allLessonsCompleted && allQuizzesCompleted && allAssignmentsCompleted && passingScore) {
        // Trigger certificate generation
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

  // Track user interactions for engagement
  const trackInteraction = useCallback((type: string, data?: any) => {
    setInteractionHistory(prev => [...prev, {
      type,
      lessonId: currentLesson?.id,
      timestamp: new Date().toISOString(),
      ...data
    }]);
  }, [currentLesson?.id]);

  // Get module status for navigation
  const getModuleStatus = (moduleId: number) => {
    if (progressiveLearning && progressiveLearning.canAccessModule(moduleId)) {
      const status = progressiveLearning.getModuleStatus(moduleId);
      return status?.status || 'locked';
    }
    return 'locked';
  };

  // Navigation helpers
  const getCurrentLessonIndex = () => {
    if (!currentLesson || !courseData?.course?.modules) return -1;
    const allLessons = courseData.course.modules.flatMap((module: any) => module.lessons || []);
    return allLessons.findIndex((l: any) => l.id === currentLesson.id);
  };

  const getAllLessons = () => {
    if (!courseData?.course?.modules) return [];
    return courseData.course.modules.flatMap((module: any) => 
      (module.lessons || []).map((lesson: any) => ({ ...lesson, moduleId: module.id }))
    );
  };

  const navigateToLesson = (direction: 'prev' | 'next') => {
    const allLessons = getAllLessons();
    const currentIndex = getCurrentLessonIndex();
    
    if (direction === 'prev' && currentIndex > 0) {
      const prevLesson = allLessons[currentIndex - 1];
      // Previous lessons are always accessible if they exist
      handleLessonSelect(prevLesson.id, prevLesson.moduleId);
    } else if (direction === 'next' && currentIndex < allLessons.length - 1) {
      const nextLesson = allLessons[currentIndex + 1];
      
      // Check if next lesson is in a different module
      const currentModule = courseData?.course?.modules?.find((m: any) => m.id === currentModuleId);
      const nextLessonModule = courseData?.course?.modules?.find((m: any) => m.id === nextLesson.moduleId);
      
      if (nextLessonModule && nextLessonModule.id !== currentModuleId) {
        // Next lesson is in a different module - check if we can access it
        if (!progressiveLearning || !progressiveLearning.canAccessModule(nextLessonModule.id)) {
          // Module is locked - don't allow navigation
          console.log('Cannot access next module - it is locked');
          return;
        }
      }
      
      handleLessonSelect(nextLesson.id, nextLesson.moduleId);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <h3 className="text-lg font-semibold mb-2">Loading Learning Interface</h3>
            <p className="text-gray-600">Preparing your enhanced learning experience...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2 text-red-700">Unable to Load Course</h3>
            <p className="text-red-600 mb-4">{error}</p>
            <div className="flex gap-2 justify-center">
              <Button asChild variant="outline">
                <Link href={`/student/courses/${courseId}`}>Back to Course</Link>
              </Button>
              <Button onClick={() => window.location.reload()}>Try Again</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!courseData?.course) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <BookOpen className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Course Not Found</h3>
            <p className="text-gray-600 mb-4">The requested course could not be found or you don't have access to it.</p>
            <Button asChild>
              <Link href="/student/dashboard">Return to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const course = courseData.course;
  const allLessons = getAllLessons();
  const currentLessonIndex = getCurrentLessonIndex();
  
  // Enhanced navigation logic with module boundary checks
  const hasNextLesson = (() => {
    if (currentLessonIndex >= allLessons.length - 1) return false;
    
    const nextLesson = allLessons[currentLessonIndex + 1];
    if (!nextLesson) return false;
    
    // Check if next lesson is in a different module
    if (nextLesson.moduleId !== currentModuleId) {
      // Next lesson is in a different module - check if we can access it
      if (!progressiveLearning || !progressiveLearning.canAccessModule(nextLesson.moduleId)) {
        return false; // Module is locked
      }
    }
    
    return true;
  })();
  
  const hasPrevLesson = currentLessonIndex > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Enhanced Header */}
      <div className="bg-white border-b shadow-lg sticky top-0 z-40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden hover:bg-blue-50"
              >
                {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <BookOpen className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900 truncate max-w-md">
                    {course.title}
                  </h1>
                  {currentLesson && (
                    <p className="text-sm text-gray-600 truncate max-w-md flex items-center">
                      <Eye className="h-3 w-3 mr-1" />
                      {currentLesson.title}
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Enhanced Progress Indicators */}
              <div className="hidden sm:flex items-center space-x-4">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <div className="flex items-center space-x-2 px-3 py-1 bg-blue-50 rounded-full">
                        <Timer className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-700">
                          {Math.floor(timeSpent / 60)}:{(timeSpent % 60).toString().padStart(2, '0')}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Time spent on this lesson</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <div className="flex items-center space-x-2 px-3 py-1 bg-green-50 rounded-full">
                        <Brain className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-700">
                          {Math.round(engagementScore)}%
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Engagement score</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">
                    {getCurrentLessonIndex() + 1} / {getAllLessons().length}
                  </span>
                  <Progress 
                    value={(getCurrentLessonIndex() + 1) / getAllLessons().length * 100} 
                    className="w-24 h-2"
                  />
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={handleBookmark}
                        className={`hover:bg-yellow-50 ${isBookmarked ? 'text-yellow-600' : 'text-gray-500'}`}
                      >
                        <Bookmark className={`h-4 w-4 ${isBookmarked ? 'fill-current' : ''}`} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Bookmark this lesson</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={handleShare}
                        className="hover:bg-blue-50"
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Share this lesson</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setFocusMode(!focusMode)}
                        className="hover:bg-purple-50"
                      >
                        <Target className={`h-4 w-4 ${focusMode ? 'text-purple-600' : ''}`} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Toggle focus mode</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                {/* Help Dialog */}
                <Dialog open={helpDialogOpen} onOpenChange={setHelpDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="hover:bg-gray-50">
                      <HelpCircle className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle className="flex items-center space-x-2">
                        <Brain className="h-5 w-5 text-blue-600" />
                        <span>Enhanced Learning Interface Guide</span>
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6">
                      <div>
                        <h4 className="font-semibold mb-3 flex items-center">
                          <Zap className="h-4 w-4 mr-2 text-yellow-500" />
                          Automatic Progress Tracking
                        </h4>
                        <ul className="text-sm text-gray-600 space-y-2">
                          <li>• Your progress is tracked automatically as you read and interact</li>
                          <li>• Lessons complete automatically when you reach 80% reading progress</li>
                          <li>• Engagement score improves with active reading and interaction</li>
                          <li>• Time spent and scroll progress are saved continuously</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-3 flex items-center">
                          <Target className="h-4 w-4 mr-2 text-blue-500" />
                          Focus Features
                        </h4>
                        <ul className="text-sm text-gray-600 space-y-2">
                          <li>• Use Focus Mode to hide distractions</li>
                          <li>• Bookmark important lessons for quick access</li>
                          <li>• Take notes that sync with your progress</li>
                          <li>• Share interesting lessons with peers</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-3 flex items-center">
                          <Trophy className="h-4 w-4 mr-2 text-purple-500" />
                          Achievement System
                        </h4>
                        <ul className="text-sm text-gray-600 space-y-2">
                          <li>• Complete lessons to unlock next modules</li>
                          <li>• Maintain high engagement for bonus points</li>
                          <li>• Earn certificates upon course completion</li>
                          <li>• Track your learning velocity and skills</li>
                        </ul>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                
                <Button asChild variant="outline" size="sm" className="hover:bg-red-50">
                  <Link href={`/student/courses/${courseId}`}>Exit Learning</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className={`${sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 overflow-hidden bg-white border-r shadow-sm`}>
          <div className="h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-900">Course Navigation</h3>
              <p className="text-sm text-gray-600 mt-1">
                {course.modules?.length || 0} modules • {allLessons.length} lessons
              </p>
            </div>
            
            <ScrollArea className="px-4 py-2">
              {course.modules?.map((module: any, moduleIndex: number) => {
                const moduleStatus = getModuleStatus(module.id);
                const isCurrentModule = module.id === currentModuleId;
                
                return (
                  <Collapsible key={module.id} defaultOpen={isCurrentModule}>
                    <div className="mb-2">
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          className="w-full justify-between text-left p-3 h-auto"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0">
                              {moduleStatus === 'completed' ? (
                                <CheckCircle className="h-5 w-5 text-green-500" />
                              ) : moduleStatus === 'in_progress' || moduleStatus === 'unlocked' ? (
                                <Clock className="h-5 w-5 text-blue-500" />
                              ) : (
                                <Lock className="h-5 w-5 text-gray-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                Module {moduleIndex + 1}: {module.title}
                              </p>
                              <p className="text-xs text-gray-500">
                                {module.lessons?.length || 0} lessons
                              </p>
                            </div>
                          </div>
                        </Button>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent className="ml-8 mt-1 space-y-1">
                        {module.lessons?.map((lesson: any, lessonIndex: number) => {
                          const isCurrentLesson = lesson.id === currentLesson?.id;
                          
                          return (
                            <Button
                              key={lesson.id}
                              variant={isCurrentLesson ? "secondary" : "ghost"}
                              className="w-full justify-start text-left p-2 h-auto text-sm"
                              onClick={() => handleLessonSelect(lesson.id, module.id)}
                              disabled={moduleStatus === 'locked'}
                            >
                              <div className="flex items-center space-x-2">
                                <span className="text-xs text-gray-500 w-6">
                                  {lessonIndex + 1}.
                                </span>
                                <span className="truncate">{lesson.title}</span>
                              </div>
                            </Button>
                          );
                        })}
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </ScrollArea>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div 
            ref={contentRef}
            className="h-[calc(100vh-4rem)] overflow-y-auto"
            onClick={() => trackInteraction('content_click')}
            onMouseMove={(e) => {
              // Track mouse movement for engagement (throttled)
              if (Date.now() - lastInteractionRef.current > 5000) {
                trackInteraction('content_interaction');
              }
            }}
          >
            <div className="max-w-4xl mx-auto p-6">
              {currentLesson ? (
                <div className="space-y-6">
                  {/* Lesson Header */}
                  <div className="bg-white rounded-lg shadow-sm border p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                          {currentLesson.title}
                        </h2>
                        {currentLesson.description && (
                          <p className="text-gray-600 mb-4">{currentLesson.description}</p>
                        )}
                        <div className="flex items-center space-x-4">
                          <Badge variant="secondary">
                            Lesson {getCurrentLessonIndex() + 1} of {allLessons.length}
                          </Badge>
                          {moduleScoring && currentModuleId && currentModuleId > 0 && (
                            <Badge variant={moduleScoring.isPassing ? "default" : "destructive"}>
                              Score: {moduleScoring.cumulativeScore.toFixed(1)}%
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigateToLesson('prev')}
                                disabled={!hasPrevLesson}
                              >
                                <ArrowLeft className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {hasPrevLesson ? 'Go to previous lesson' : 'No previous lesson available'}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigateToLesson('next')}
                                disabled={!hasNextLesson}
                              >
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {(() => {
                                if (currentLessonIndex >= allLessons.length - 1) {
                                  return 'No more lessons in this course';
                                }
                                const nextLesson = allLessons[currentLessonIndex + 1];
                                if (nextLesson?.moduleId !== currentModuleId) {
                                  if (!progressiveLearning?.canAccessModule(nextLesson.moduleId)) {
                                    return 'Complete current module to unlock next lesson';
                                  }
                                }
                                return 'Go to next lesson';
                              })()}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                    
                    {/* Lesson Progress */}
                    <div className="mt-4">
                      <div className="flex justify-between text-sm text-gray-600 mb-2">
                        <span>Reading Progress</span>
                        <span>{Math.round(readingProgress)}%</span>
                      </div>
                      <Progress value={readingProgress} className="h-2" />
                    </div>
                  </div>

                  {/* Learning Interface Tabs */}
                  <div className="bg-white rounded-lg shadow-sm border">
                    <Tabs value={currentViewMode} onValueChange={(value: any) => setCurrentViewMode(value)}>
                      <div className="border-b px-6 py-3">
                        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
                          <TabsTrigger value="content">Content</TabsTrigger>
                          <TabsTrigger value="quiz" className="flex items-center space-x-2">
                            <FileText className="h-4 w-4" />
                            <span>Quiz</span>
                          </TabsTrigger>
                          <TabsTrigger value="assignments" className="flex items-center space-x-2">
                            <Clipboard className="h-4 w-4" />
                            <span>Assignments</span>
                          </TabsTrigger>
                          <TabsTrigger value="notes">Notes</TabsTrigger>
                        </TabsList>
                      </div>

                      <TabsContent value="content" className="p-6 space-y-6">
                        {/* Interactive Content Viewer */}
                        <div className="prose max-w-none">
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mb-6">
                            <h3 className="text-lg font-semibold mb-3 text-gray-900">
                              {currentLesson.title}
                            </h3>
                            <div className="text-gray-700 leading-relaxed">
                              {currentLesson.content ? (
                                <div dangerouslySetInnerHTML={{ __html: currentLesson.content }} />
                              ) : (
                                <div className="space-y-6">
                                  <p className="text-lg">
                                    Welcome to <strong>{currentLesson.title}</strong>. This interactive lesson will guide you through the key concepts and practical applications.
                                  </p>
                                  <div className="bg-white rounded-lg p-6 border-l-4 border-blue-500 shadow-sm">
                                    <h4 className="font-semibold mb-3 text-gray-900 flex items-center">
                                      <Target className="h-4 w-4 mr-2 text-blue-600" />
                                      Learning Objectives:
                                    </h4>
                                    <ul className="list-disc list-inside space-y-2 text-gray-700">
                                      <li>Understand the core concepts presented in this lesson</li>
                                      <li>Apply knowledge through interactive exercises</li>
                                      <li>Prepare for module assessments</li>
                                      <li>Develop practical skills for real-world application</li>
                                    </ul>
                                  </div>
                                  
                                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
                                    <h4 className="font-semibold mb-3 text-amber-800 flex items-center">
                                      <Zap className="h-4 w-4 mr-2" />
                                      Interactive Learning:
                                    </h4>
                                    <p className="text-amber-700">
                                      Your progress is automatically tracked as you read. The system monitors your reading pace, 
                                      scroll behavior, and engagement to provide personalized learning insights. Simply focus on 
                                      learning - we'll handle the progress tracking!
                                    </p>
                                  </div>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                      <h5 className="font-medium text-green-800 mb-2 flex items-center">
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        Key Benefits
                                      </h5>
                                      <ul className="text-sm text-green-700 space-y-1">
                                        <li>• Automatic progress tracking</li>
                                        <li>• Personalized learning pace</li>
                                        <li>• Intelligent content delivery</li>
                                      </ul>
                                    </div>
                                    
                                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                                      <h5 className="font-medium text-purple-800 mb-2 flex items-center">
                                        <Brain className="h-4 w-4 mr-2" />
                                        Smart Features
                                      </h5>
                                      <ul className="text-sm text-purple-700 space-y-1">
                                        <li>• Engagement scoring</li>
                                        <li>• Adaptive completion</li>
                                        <li>• Real-time analytics</li>
                                      </ul>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Automatic Progress Status */}
                          {isLessonCompleted ? (
                            <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                              <div className="flex items-center space-x-3">
                                <div className="h-12 w-12 bg-green-500 rounded-full flex items-center justify-center">
                                  <Trophy className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                  <h4 className="font-semibold text-green-800 text-lg">Lesson Completed!</h4>
                                  <p className="text-green-700">
                                    Excellent work! You completed this lesson with {Math.round(engagementScore)}% engagement.
                                  </p>
                                </div>
                              </div>
                              <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                                <div className="bg-white rounded-lg p-3">
                                  <div className="text-lg font-bold text-gray-900">{Math.floor(timeSpent / 60)}m {timeSpent % 60}s</div>
                                  <div className="text-xs text-gray-600">Time Spent</div>
                                </div>
                                <div className="bg-white rounded-lg p-3">
                                  <div className="text-lg font-bold text-gray-900">{Math.round(engagementScore)}%</div>
                                  <div className="text-xs text-gray-600">Engagement</div>
                                </div>
                                <div className="bg-white rounded-lg p-3">
                                  <div className="text-lg font-bold text-gray-900">{Math.round(readingProgress)}%</div>
                                  <div className="text-xs text-gray-600">Completion</div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                              <div className="flex items-center space-x-3">
                                <Brain className="h-8 w-8 text-blue-600" />
                                <div>
                                  <h4 className="font-semibold text-blue-800">Keep Learning!</h4>
                                  <p className="text-blue-700 text-sm">
                                    Continue reading to automatically track your progress. 
                                    Lesson will complete when you reach 80% reading progress with good engagement.
                                  </p>
                                </div>
                              </div>
                              <div className="mt-4 grid grid-cols-3 gap-4">
                                <div className="bg-white rounded-lg p-3 text-center">
                                  <div className="text-lg font-bold text-blue-600">{Math.round(readingProgress)}%</div>
                                  <div className="text-xs text-gray-600">Reading</div>
                                </div>
                                <div className="bg-white rounded-lg p-3 text-center">
                                  <div className="text-lg font-bold text-green-600">{Math.round(engagementScore)}%</div>
                                  <div className="text-xs text-gray-600">Engagement</div>
                                </div>
                                <div className="bg-white rounded-lg p-3 text-center">
                                  <div className="text-lg font-bold text-purple-600">{Math.floor(timeSpent / 60)}m</div>
                                  <div className="text-xs text-gray-600">Time</div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </TabsContent>

                      <TabsContent value="quiz" className="p-6">
                        <div className="space-y-6">
                          {contentLoading ? (
                            <div className="flex items-center justify-center py-12">
                              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                              <span className="ml-2 text-gray-600">Loading quiz...</span>
                            </div>
                          ) : lessonQuiz ? (
                            <div>
                              <div className="flex items-center justify-between mb-6">
                                <div>
                                  <h3 className="text-xl font-bold text-gray-900">{lessonQuiz.title}</h3>
                                  <p className="text-gray-600 mt-1">{lessonQuiz.description}</p>
                                </div>
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                  <FileText className="h-3 w-3 mr-1" />
                                  Quiz Available
                                </Badge>
                              </div>
                              
                              <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                                <CardContent className="p-6">
                                  <div className="flex items-center space-x-4">
                                    <div className="h-12 w-12 bg-blue-500 rounded-full flex items-center justify-center">
                                      <FileText className="h-6 w-6 text-white" />
                                    </div>
                                    <div className="flex-1">
                                      <h4 className="font-semibold text-gray-900">Ready to Test Your Knowledge?</h4>
                                      <p className="text-sm text-gray-600">
                                        Take the quiz to reinforce what you've learned in this lesson.
                                      </p>
                                    </div>
                                    <Button className="bg-blue-600 hover:bg-blue-700">
                                      <Play className="h-4 w-4 mr-2" />
                                      Start Quiz
                                    </Button>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          ) : (
                            <div className="text-center py-12">
                              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                              <h3 className="text-lg font-medium text-gray-900 mb-2">No Quiz Available</h3>
                              <p className="text-gray-600">
                                This lesson doesn't have an associated quiz. Continue with the lesson content.
                              </p>
                            </div>
                          )}
                        </div>
                      </TabsContent>

                      <TabsContent value="assignments" className="p-6">
                        <div className="space-y-6">
                          {contentLoading ? (
                            <div className="flex items-center justify-center py-12">
                              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                              <span className="ml-2 text-gray-600">Loading assignments...</span>
                            </div>
                          ) : lessonAssignments.length > 0 ? (
                            <div>
                              <div className="flex items-center justify-between mb-6">
                                <div>
                                  <h3 className="text-xl font-bold text-gray-900">Lesson Assignments</h3>
                                  <p className="text-gray-600 mt-1">Complete these assignments to apply what you've learned</p>
                                </div>
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                  <Clipboard className="h-3 w-3 mr-1" />
                                  {lessonAssignments.length} Assignment{lessonAssignments.length > 1 ? 's' : ''}
                                </Badge>
                              </div>
                              
                              <div className="space-y-4">
                                {lessonAssignments.map((assignment, index) => (
                                  <Card key={assignment.id} className="border hover:shadow-md transition-shadow">
                                    <CardContent className="p-6">
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <div className="flex items-center space-x-3 mb-3">
                                            <div className="h-10 w-10 bg-green-500 rounded-lg flex items-center justify-center">
                                              <PenTool className="h-5 w-5 text-white" />
                                            </div>
                                            <div>
                                              <h4 className="font-semibold text-gray-900">{assignment.title}</h4>
                                              <p className="text-sm text-gray-600">
                                                {assignment.assignment_type.replace('_', ' ').toUpperCase()}
                                              </p>
                                            </div>
                                          </div>
                                          
                                          <p className="text-gray-700 mb-4">{assignment.description}</p>
                                          
                                          <div className="flex items-center space-x-6 text-sm text-gray-600">
                                            {assignment.due_date && (
                                              <div className="flex items-center space-x-1">
                                                <Clock className="h-4 w-4" />
                                                <span>Due: {new Date(assignment.due_date).toLocaleDateString()}</span>
                                              </div>
                                            )}
                                            <div className="flex items-center space-x-1">
                                              <Award className="h-4 w-4" />
                                              <span>{assignment.points_possible} points</span>
                                            </div>
                                          </div>
                                        </div>
                                        
                                        <div className="flex flex-col space-y-2">
                                          <Button size="sm" className="bg-green-600 hover:bg-green-700">
                                            <ExternalLink className="h-4 w-4 mr-2" />
                                            View Assignment
                                          </Button>
                                          <Button size="sm" variant="outline">
                                            <Download className="h-4 w-4 mr-2" />
                                            Download
                                          </Button>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-12">
                              <Clipboard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                              <h3 className="text-lg font-medium text-gray-900 mb-2">No Assignments</h3>
                              <p className="text-gray-600">
                                This lesson doesn't have any assignments. Focus on understanding the content.
                              </p>
                            </div>
                          )}
                        </div>
                      </TabsContent>

                      <TabsContent value="notes" className="p-6">
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold">Lesson Notes</h3>
                          <p className="text-gray-600">
                            Take notes while learning. Your notes are automatically saved.
                          </p>
                          <div className="space-y-4">
                            <textarea
                              value={lessonNotes}
                              onChange={(e) => setLessonNotes(e.target.value)}
                              placeholder="Write your notes here..."
                              className="w-full h-64 p-4 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <div className="text-sm text-gray-500">
                              Notes are saved automatically as you type.
                            </div>
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>

                  {/* Navigation Footer */}
                  <div className="bg-white rounded-lg shadow-sm border p-4">
                    <div className="flex justify-between items-center">
                      <Button
                        variant="outline"
                        onClick={() => navigateToLesson('prev')}
                        disabled={!hasPrevLesson}
                        className="flex items-center space-x-2"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Previous Lesson</span>
                      </Button>
                      
                      <div className="text-sm text-gray-600">
                        Lesson {currentLessonIndex + 1} of {allLessons.length}
                      </div>
                      
                      <Button
                        onClick={() => navigateToLesson('next')}
                        disabled={!hasNextLesson}
                        className="flex items-center space-x-2"
                      >
                        <span>Next Lesson</span>
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
                  <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Lesson Selected</h3>
                  <p className="text-gray-600">Select a lesson from the sidebar to begin learning.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Module Unlock Animation */}
      {showUnlockAnimation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md mx-4 text-center shadow-2xl">
            <div className="mb-4">
              <div className="w-16 h-16 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <CheckCircle className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Module Unlocked!</h3>
              <p className="text-gray-600">
                Congratulations! You've unlocked "{unlockedModuleName}".
              </p>
            </div>
            <Button onClick={() => setShowUnlockAnimation(false)} className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700">
              Continue Learning
            </Button>
          </div>
        </div>
      )}

      {/* Enhanced Lesson Completion Celebration */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.5, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.5, y: 50 }}
              className="bg-white rounded-xl p-8 max-w-lg mx-4 text-center shadow-2xl relative"
            >
              {/* Close button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={closeCelebration}
                className="absolute top-4 right-4 h-8 w-8 p-0 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </Button>
              
              <div className="mb-6">
                <motion.div
                  animate={{ 
                    rotate: [0, 360],
                    scale: [1, 1.2, 1]
                  }}
                  transition={{ 
                    duration: 2,
                    repeat: Infinity,
                    repeatType: "reverse"
                  }}
                  className="w-20 h-20 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 rounded-full flex items-center justify-center mx-auto mb-4"
                >
                  <Trophy className="h-10 w-10 text-white" />
                </motion.div>
                
                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                  {newBadgesEarned.length > 0 ? '� New Badge Earned! 🏅' : '�🎉 Lesson Completed! 🎉'}
                </h3>
                
                {newBadgesEarned.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 mb-4"
                  >
                    <div className="flex items-center justify-center mb-2">
                      <Medal className="h-6 w-6 text-purple-600 mr-2" />
                      <span className="font-semibold text-purple-800">
                        {newBadgesEarned[newBadgesEarned.length - 1]}
                      </span>
                    </div>
                    <p className="text-sm text-purple-700">
                      Congratulations! You've completed 3 lessons and earned a new skill badge!
                    </p>
                  </motion.div>
                )}
                
                <p className="text-gray-600 mb-4">
                  Amazing work! You've successfully completed this lesson with excellent engagement.
                </p>
                
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="text-lg font-bold text-blue-600">{Math.floor(timeSpent / 60)}m {timeSpent % 60}s</div>
                    <div className="text-xs text-gray-600">Time Spent</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="text-lg font-bold text-green-600">{Math.round(engagementScore)}%</div>
                    <div className="text-xs text-gray-600">Engagement</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3">
                    <div className="text-lg font-bold text-purple-600">{Math.round(readingProgress)}%</div>
                    <div className="text-xs text-gray-600">Completion</div>
                  </div>
                </div>
                
                <div className="flex items-center justify-center space-x-2 text-yellow-500 mb-4">
                  <Star className="h-5 w-5 fill-current" />
                  <Star className="h-5 w-5 fill-current" />
                  <Star className="h-5 w-5 fill-current" />
                  <Star className="h-5 w-5 fill-current" />
                  <Star className="h-5 w-5 fill-current" />
                </div>
              </div>
              
              <Button
                onClick={closeCelebration}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              >
                Continue Learning
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Certificate Notification */}
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
                  <p className="text-green-100 text-sm">Your certificate is ready for download</p>
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