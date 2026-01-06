"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, 
  ChevronRight, 
  Menu, 
  X, 
  Maximize2, 
  Minimize2,
  Settings,
  Share2,
  Bookmark,
  MoreVertical,
  Play,
  Pause,
  SkipForward,
  CheckCircle,
  Clock,
  Users,
  Star,
  Award,
  Brain,
  MessageSquare,
  StickyNote,
  BarChart3,
  Target,
  Zap,
  Globe,
  Smartphone,
  Monitor,
  Tablet
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/contexts/AuthContext';
import { StudentApiService } from '@/services/studentApi';
import Link from 'next/link';

// Import our new components
import ProgressTracker from './ProgressTracker';
import InteractiveContentViewer from './InteractiveContentViewer';
import CourseNavigation from './CourseNavigation';
import EngagementFeatures from './EngagementFeatures';

interface EnhancedLearningInterfaceProps {
  courseId: number;
}

const EnhancedLearningInterface: React.FC<EnhancedLearningInterfaceProps> = ({ courseId }) => {
  // State management
  const [course, setCourse] = useState<any>(null);
  const [currentLesson, setCurrentLesson] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState('progress');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lessonProgress, setLessonProgress] = useState(0);
  const [studyTime, setStudyTime] = useState(0);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [deviceOrientation, setDeviceOrientation] = useState<'portrait' | 'landscape'>('portrait');

  const { user } = useAuth();
  const studyStartTime = useRef<number>(Date.now());

  // Mock data for enhanced features
  const mockProgressData = {
    courseProgress: 45,
    moduleProgress: 60,
    lessonProgress: lessonProgress,
    timeSpent: studyTime,
    streak: { current: 7, longest: 14, lastStudied: '2024-10-04' },
    stats: {
      totalTimeSpent: 1250,
      lessonsCompleted: 24,
      quizzesCompleted: 8,
      averageScore: 87,
      coursesEnrolled: 3,
      certificatesEarned: 1
    },
    achievements: [
      {
        id: '1',
        title: 'Quick Learner',
        description: 'Complete 5 lessons in one day',
        icon: <Zap className="h-4 w-4" />,
        type: 'gold' as const,
        unlocked: true,
        unlockedAt: '2024-10-04T10:00:00Z'
      },
      {
        id: '2',
        title: 'Consistent Student',
        description: 'Maintain a 7-day streak',
        icon: <Target className="h-4 w-4" />,
        type: 'silver' as const,
        unlocked: true
      },
      {
        id: '3',
        title: 'Master Quiz Taker',
        description: 'Score 90%+ on 5 quizzes',
        icon: <Award className="h-4 w-4" />,
        type: 'platinum' as const,
        unlocked: false,
        progress: 3,
        maxProgress: 5
      }
    ]
  };

  // Device and responsive detection
  useEffect(() => {
    const checkDevice = () => {
      const isMobileDevice = window.innerWidth < 768;
      setIsMobile(isMobileDevice);
      setSidebarCollapsed(isMobileDevice);
      setRightPanelCollapsed(isMobileDevice);
      
      // Check orientation
      const isPortrait = window.innerHeight > window.innerWidth;
      setDeviceOrientation(isPortrait ? 'portrait' : 'landscape');
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    window.addEventListener('orientationchange', () => {
      setTimeout(checkDevice, 100); // Delay to get accurate dimensions after orientation change
    });

    return () => {
      window.removeEventListener('resize', checkDevice);
      window.removeEventListener('orientationchange', checkDevice);
    };
  }, []);

  // Study time tracking
  useEffect(() => {
    const interval = setInterval(() => {
      setStudyTime(Math.floor((Date.now() - studyStartTime.current) / 1000 / 60));
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Load course data
  useEffect(() => {
    const fetchCourseData = async () => {
      try {
        console.log('Fetching course data for courseId:', courseId);
        const data = await StudentApiService.getCourseDetails(courseId);
        console.log('Course data received:', data);
        setCourse(data.course);
        // Safe access to modules and lessons with null checks
        const firstModule = data.course?.modules?.[0];
        const firstLesson = firstModule?.lessons?.[0];
        setCurrentLesson(data.current_lesson || firstLesson);
      } catch (error) {
        console.error('Failed to fetch course data:', error);
        console.error('Error details:', error.response?.data || error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCourseData();
  }, [courseId]);

  const handleLessonSelect = (lessonId: number, moduleId: number) => {
    const allLessons = course?.modules?.flatMap((module: any) => module.lessons) || [];
    const lesson = allLessons.find((l: any) => l.id === lessonId);
    if (lesson && !lesson.is_locked) {
      setCurrentLesson(lesson);
      setLessonProgress(0);
      if (isMobile) {
        setShowMobileMenu(false);
      }
    }
  };

  const handleProgressUpdate = (progress: number) => {
    setLessonProgress(progress);
  };

  const handleLessonComplete = async () => {
    if (currentLesson && lessonProgress >= 80 && course?.modules) {
      try {
        await StudentApiService.completeLesson(currentLesson.id, {
          time_spent: studyTime,
          progress: lessonProgress
        });
        
        // Move to next lesson
        const allLessons = course.modules?.flatMap((module: any) => module.lessons || []) || [];
        const currentIndex = allLessons.findIndex((l: any) => l.id === currentLesson.id);
        if (currentIndex < allLessons.length - 1) {
          setCurrentLesson(allLessons[currentIndex + 1]);
          setLessonProgress(0);
        }
      } catch (error) {
        console.error('Failed to complete lesson:', error);
      }
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const getDeviceIcon = () => {
    if (isMobile) {
      return deviceOrientation === 'portrait' ? <Smartphone className="h-4 w-4" /> : <Tablet className="h-4 w-4" />;
    }
    return <Monitor className="h-4 w-4" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading your learning experience...</p>
        </div>
      </div>
    );
  }

  if (!course || !currentLesson) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto">
            <CheckCircle className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">Course content not available</p>
          <Button asChild>
            <Link href="/student/learn">Back to My Learning</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen bg-background ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {showMobileMenu && isMobile && (
          <motion.div
            className="fixed inset-0 z-40 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowMobileMenu(false)}
          />
        )}
      </AnimatePresence>

      {/* Left Sidebar - Course Navigation */}
      <AnimatePresence>
        {(!isMobile || showMobileMenu) && (
          <motion.div
            className={`${
              isMobile 
                ? 'fixed left-0 top-0 bottom-0 z-50 bg-background border-r shadow-xl' 
                : 'relative'
            }`}
            initial={isMobile ? { x: -320 } : false}
            animate={isMobile ? { x: 0 } : false}
            exit={isMobile ? { x: -320 } : false}
          >
            {isMobile && (
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="font-semibold">Course Navigation</h2>
                <Button variant="ghost" size="sm" onClick={() => setShowMobileMenu(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            <CourseNavigation
              course={course}
              currentLessonId={currentLesson?.id}
              onLessonSelect={handleLessonSelect}
              isCollapsed={sidebarCollapsed && !isMobile}
              onCollapse={setSidebarCollapsed}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="bg-background border-b p-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {isMobile && (
                <Button variant="ghost" size="sm" onClick={() => setShowMobileMenu(true)}>
                  <Menu className="h-4 w-4" />
                </Button>
              )}
              
              <Link href="/student/learn">
                <Button variant="ghost" size="sm" className="hidden md:flex">
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back to My Learning
                </Button>
              </Link>
              
              <div className="min-w-0">
                <h1 className="text-lg md:text-xl font-bold truncate">{currentLesson?.title || 'Loading...'}</h1>
                <p className="text-sm text-muted-foreground truncate">
                  {course?.modules?.find((m: any) => 
                    m.lessons?.some((l: any) => l.id === currentLesson?.id)
                  )?.title || ''}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {!isMobile && (
                <>
                  <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                    {getDeviceIcon()}
                    <Clock className="h-4 w-4" />
                    <span>{studyTime}m</span>
                  </div>
                  
                  <Button variant="ghost" size="sm" onClick={() => setIsBookmarked(!isBookmarked)}>
                    <Bookmark className={`h-4 w-4 ${isBookmarked ? 'fill-current' : ''}`} />
                  </Button>
                  
                  <Button variant="ghost" size="sm">
                    <Share2 className="h-4 w-4" />
                  </Button>
                </>
              )}
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56">
                  <div className="space-y-2">
                    <Button variant="ghost" size="sm" className="w-full justify-start" onClick={toggleFullscreen}>
                      <Maximize2 className="h-4 w-4 mr-2" />
                      {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Mode'}
                    </Button>
                    <Button variant="ghost" size="sm" className="w-full justify-start">
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </Button>
                    <Button variant="ghost" size="sm" className="w-full justify-start">
                      <Globe className="h-4 w-4 mr-2" />
                      Change Language
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main Content */}
          <div className="flex-1 p-4 md:p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Content Viewer */}
              <InteractiveContentViewer
                content={{
                  type: currentLesson?.content_type || 'video',
                  url: currentLesson?.video_url || currentLesson?.content_data || '',
                  content: currentLesson?.content_data || '',
                  title: currentLesson?.title || '',
                  description: currentLesson?.description || '',
                  duration: currentLesson?.duration_minutes || 0,
                  transcript: currentLesson?.transcript || '',
                  attachments: currentLesson?.resources || []
                }}
                onProgress={handleProgressUpdate}
                onComplete={handleLessonComplete}
              />

              {/* Mobile Progress Card */}
              {isMobile && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Lesson Progress</span>
                      <span className="text-sm text-muted-foreground">{Math.round(lessonProgress)}%</span>
                    </div>
                    <Progress value={lessonProgress} className="h-2" />
                    
                    <div className="flex items-center justify-between mt-4">
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>{currentLesson?.duration_minutes || 0} min</span>
                      </div>
                      
                      <div className="flex space-x-2">
                        {lessonProgress >= 80 && !currentLesson?.is_completed && (
                          <Button size="sm" onClick={handleLessonComplete}>
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Complete
                          </Button>
                        )}
                        <Button size="sm" variant="outline">
                          <SkipForward className="h-4 w-4 mr-1" />
                          Next
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Mobile Engagement Features */}
              {isMobile && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Learning Tools</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <EngagementFeatures
                      lessonId={currentLesson.id}
                      courseId={courseId}
                      userId={user?.id || ''}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Desktop Navigation and Actions */}
              {!isMobile && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {currentLesson?.duration_minutes || 0} minutes
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-muted-foreground">Progress:</span>
                      <Progress value={lessonProgress} className="w-24 h-2" />
                      <span className="text-sm text-muted-foreground">
                        {Math.round(lessonProgress)}%
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {lessonProgress >= 80 && !currentLesson?.is_completed && (
                      <Button onClick={handleLessonComplete}>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Mark Complete
                      </Button>
                    )}
                    <Button variant="outline">
                      <SkipForward className="h-4 w-4 mr-2" />
                      Next Lesson
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Desktop Only */}
          {!isMobile && (
            <AnimatePresence>
              {!rightPanelCollapsed && (
                <motion.div
                  className="w-80 border-l bg-muted/20 flex flex-col"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 320, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                >
                  <div className="p-4 border-b">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Learning Dashboard</h3>
                      <Button variant="ghost" size="sm" onClick={() => setRightPanelCollapsed(true)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <Tabs value={activeRightTab} onValueChange={setActiveRightTab} className="flex-1 flex flex-col">
                    <TabsList className="grid w-full grid-cols-3 mx-4 mt-2">
                      <TabsTrigger value="progress" className="text-xs">
                        <BarChart3 className="h-3 w-3 mr-1" />
                        Progress
                      </TabsTrigger>
                      <TabsTrigger value="engagement" className="text-xs">
                        <MessageSquare className="h-3 w-3 mr-1" />
                        Tools
                      </TabsTrigger>
                      <TabsTrigger value="analytics" className="text-xs">
                        <Brain className="h-3 w-3 mr-1" />
                        Analytics
                      </TabsTrigger>
                    </TabsList>

                    <div className="flex-1 overflow-hidden">
                      <TabsContent value="progress" className="h-full m-0 p-4 overflow-y-auto">
                        <ProgressTracker {...mockProgressData} />
                      </TabsContent>

                      <TabsContent value="engagement" className="h-full m-0 p-4 overflow-y-auto">
                        <EngagementFeatures
                          lessonId={currentLesson?.id || ''}
                          courseId={courseId}
                          userId={user?.id || ''}
                        />
                      </TabsContent>

                      <TabsContent value="analytics" className="h-full m-0 p-4 overflow-y-auto">
                        <div className="space-y-4">
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-lg">Learning Analytics</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="text-center py-8">
                                <Brain className="h-12 w-12 text-blue-500 mx-auto mb-4" />
                                <p className="text-muted-foreground text-sm">
                                  Detailed learning analytics and insights coming soon!
                                </p>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </TabsContent>
                    </div>
                  </Tabs>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Right Panel Toggle - Desktop Only */}
          {!isMobile && rightPanelCollapsed && (
            <div className="w-12 border-l bg-muted/20 flex flex-col items-center py-4">
              <Button variant="ghost" size="sm" onClick={() => setRightPanelCollapsed(false)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="flex flex-col space-y-2 mt-4">
                <Button variant="ghost" size="sm" onClick={() => { setRightPanelCollapsed(false); setActiveRightTab('progress'); }}>
                  <BarChart3 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setRightPanelCollapsed(false); setActiveRightTab('engagement'); }}>
                  <MessageSquare className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setRightPanelCollapsed(false); setActiveRightTab('analytics'); }}>
                  <Brain className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnhancedLearningInterface;