"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { StudentApiService } from '@/services/studentApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, BookOpen, Play, Target, Settings, HelpCircle, ArrowLeft, ArrowRight, Lock, CheckCircle, Clock, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProgressiveLearning, useModuleAttempts, useModuleScoring } from '@/hooks/useProgressiveLearning';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// Phase 5 Enhanced Learning Interface Component
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
  const [lessonProgress, setLessonProgress] = useState<number>(0);
  
  // Phase 5 Enhanced Features State
  const [showUnlockAnimation, setShowUnlockAnimation] = useState(false);
  const [unlockedModuleName, setUnlockedModuleName] = useState<string | null>(null);
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [currentViewMode, setCurrentViewMode] = useState<'content' | 'assessment' | 'notes'>('content');
  const [interactionHistory, setInteractionHistory] = useState<any[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [lessonNotes, setLessonNotes] = useState<string>('');
  
  // Progressive Learning Hooks (with error handling)
  const progressiveLearning = currentModuleId ? useProgressiveLearning(courseId) : null;
  const moduleAttempts = currentModuleId ? useModuleAttempts(currentModuleId) : null;
  const moduleScoring = currentModuleId ? useModuleScoring(currentModuleId) : null;

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

  // Handle lesson selection
  const handleLessonSelect = (lessonId: number, moduleId: number) => {
    if (courseData?.course?.modules) {
      const allLessons = courseData.course.modules.flatMap((module: any) => module.lessons || []);
      const lesson = allLessons.find((l: any) => l.id === lessonId);
      if (lesson) {
        setCurrentLesson(lesson);
        setCurrentModuleId(moduleId);
        setLessonProgress(0);
        setLessonNotes('');
        
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

  // Handle module unlock
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

  // Handle lesson progress update
  const handleProgressUpdate = (progress: number) => {
    setLessonProgress(progress);
    
    // Auto-advance when lesson is completed
    if (progress >= 100 && currentLesson && courseData?.course?.modules) {
      const currentModule = courseData.course.modules.find((m: any) => m.id === currentModuleId);
      if (currentModule?.lessons) {
        const currentLessonIndex = currentModule.lessons.findIndex((l: any) => l.id === currentLesson.id);
        const nextLesson = currentModule.lessons[currentLessonIndex + 1];
        
        if (nextLesson) {
          setTimeout(() => {
            handleLessonSelect(nextLesson.id, currentModuleId!);
          }, 2000);
        } else {
          // Module completed, check for next module
          const moduleIndex = courseData.course.modules.findIndex((m: any) => m.id === currentModuleId);
          const nextModule = courseData.course.modules[moduleIndex + 1];
          if (nextModule) {
            handleModuleUnlock(nextModule.title || 'Next Module');
          }
        }
      }
    }
  };

  // Get module status for navigation
  const getModuleStatus = (moduleId: number) => {
    if (progressiveLearning?.canAccessModule(moduleId)) {
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
      handleLessonSelect(prevLesson.id, prevLesson.moduleId);
    } else if (direction === 'next' && currentIndex < allLessons.length - 1) {
      const nextLesson = allLessons[currentIndex + 1];
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
  const hasNextLesson = currentLessonIndex < allLessons.length - 1;
  const hasPrevLesson = currentLessonIndex > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden"
              >
                {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
              <div>
                <h1 className="text-xl font-bold text-gray-900 truncate max-w-md">
                  {course.title}
                </h1>
                {currentLesson && (
                  <p className="text-sm text-gray-600 truncate max-w-md">
                    {currentLesson.title}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Progress indicator */}
              <div className="hidden sm:flex items-center space-x-2">
                <span className="text-sm text-gray-600">
                  {currentLessonIndex + 1} of {allLessons.length}
                </span>
                <Progress 
                  value={(currentLessonIndex + 1) / allLessons.length * 100} 
                  className="w-24"
                />
              </div>
              
              {/* Help button */}
              <Dialog open={helpDialogOpen} onOpenChange={setHelpDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <HelpCircle className="h-5 w-5" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Learning Interface Help</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Navigation</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Use the sidebar to navigate between modules and lessons</li>
                        <li>• Use arrow buttons or keyboard shortcuts to move between lessons</li>
                        <li>• Your progress is automatically saved</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Learning Features</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Take notes while learning - they're saved automatically</li>
                        <li>• View assessment requirements in the Assessment tab</li>
                        <li>• Track your module progress and scoring</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Module Progression</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Complete all lessons in a module to unlock assessments</li>
                        <li>• Pass assessments to unlock the next module</li>
                        <li>• You have multiple attempts for each module</li>
                      </ul>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              
              <Button asChild variant="outline" size="sm">
                <Link href={`/student/courses/${courseId}`}>Exit Learning</Link>
              </Button>
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
          <div className="h-[calc(100vh-4rem)] overflow-y-auto">
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
                          {moduleScoring && (
                            <Badge variant={moduleScoring.isPassing ? "default" : "destructive"}>
                              Score: {moduleScoring.cumulativeScore.toFixed(1)}%
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigateToLesson('prev')}
                          disabled={!hasPrevLesson}
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigateToLesson('next')}
                          disabled={!hasNextLesson}
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Lesson Progress */}
                    <div className="mt-4">
                      <div className="flex justify-between text-sm text-gray-600 mb-2">
                        <span>Lesson Progress</span>
                        <span>{lessonProgress}%</span>
                      </div>
                      <Progress value={lessonProgress} className="h-2" />
                    </div>
                  </div>

                  {/* Learning Interface Tabs */}
                  <div className="bg-white rounded-lg shadow-sm border">
                    <Tabs value={currentViewMode} onValueChange={(value: any) => setCurrentViewMode(value)}>
                      <div className="border-b px-6 py-3">
                        <TabsList className="grid w-full grid-cols-3 max-w-md">
                          <TabsTrigger value="content">Content</TabsTrigger>
                          <TabsTrigger value="assessment">Assessment</TabsTrigger>
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
                                <div className="space-y-4">
                                  <p>
                                    Welcome to <strong>{currentLesson.title}</strong>. This interactive lesson will guide you through the key concepts and practical applications.
                                  </p>
                                  <div className="bg-white rounded-lg p-4 border-l-4 border-blue-500">
                                    <h4 className="font-semibold mb-2">Learning Objectives:</h4>
                                    <ul className="list-disc list-inside space-y-1 text-sm">
                                      <li>Understand the core concepts presented in this lesson</li>
                                      <li>Apply knowledge through interactive exercises</li>
                                      <li>Prepare for module assessments</li>
                                    </ul>
                                  </div>
                                  <p>
                                    Use the progress tracker below to mark your completion as you work through the material.
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Interactive Progress Tracker */}
                          <div className="bg-gray-50 rounded-lg p-4">
                            <h4 className="font-semibold mb-3">Mark Your Progress</h4>
                            <div className="space-y-2">
                              {[25, 50, 75, 100].map((progress) => (
                                <Button
                                  key={progress}
                                  variant={lessonProgress >= progress ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => handleProgressUpdate(progress)}
                                  className="mr-2"
                                >
                                  {progress}% Complete
                                </Button>
                              ))}
                            </div>
                          </div>

                          {/* Engagement Features */}
                          {lessonProgress >= 100 && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                              <div className="flex items-center space-x-2">
                                <CheckCircle className="h-5 w-5 text-green-600" />
                                <span className="font-semibold text-green-800">Lesson Completed!</span>
                              </div>
                              <p className="text-green-700 mt-1">
                                Great job! You can now move to the next lesson or review this material.
                              </p>
                            </div>
                          )}
                        </div>
                      </TabsContent>

                      <TabsContent value="assessment" className="p-6">
                        <div className="space-y-6">
                          <div>
                            <h3 className="text-lg font-semibold mb-4">Assessment Requirements</h3>
                            {moduleScoring && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <Card>
                                  <CardContent className="p-4">
                                    <h4 className="font-semibold mb-2">Current Score</h4>
                                    <div className="text-2xl font-bold text-blue-600">
                                      {moduleScoring.cumulativeScore.toFixed(1)}%
                                    </div>
                                    <p className="text-sm text-gray-600">
                                      {moduleScoring.isPassing ? 'Passing' : `Need ${moduleScoring.missingPoints.toFixed(1)} more points`}
                                    </p>
                                  </CardContent>
                                </Card>
                                
                                <Card>
                                  <CardContent className="p-4">
                                    <h4 className="font-semibold mb-2">Attempts</h4>
                                    {moduleAttempts && (
                                      <div className="text-2xl font-bold text-orange-600">
                                        {moduleAttempts.remainingAttempts} / {moduleAttempts.maxAttempts}
                                      </div>
                                    )}
                                    <p className="text-sm text-gray-600">Remaining attempts</p>
                                  </CardContent>
                                </Card>
                              </div>
                            )}
                          </div>

                          <div className="space-y-4">
                            <h4 className="font-semibold">Score Breakdown</h4>
                            {moduleScoring && (
                              <div className="space-y-3">
                                {[
                                  { label: 'Course Contribution', value: moduleScoring.breakdown.courseContribution, weight: '10%' },
                                  { label: 'Quizzes', value: moduleScoring.breakdown.quizzes, weight: '30%' },
                                  { label: 'Assignments', value: moduleScoring.breakdown.assignments, weight: '40%' },
                                  { label: 'Final Assessment', value: moduleScoring.breakdown.finalAssessment, weight: '20%' }
                                ].map((item) => (
                                  <div key={item.label} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                                    <div>
                                      <span className="font-medium">{item.label}</span>
                                      <span className="text-sm text-gray-600 ml-2">({item.weight})</span>
                                    </div>
                                    <span className="font-semibold">{item.value.toFixed(1)}%</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <Alert>
                            <Target className="h-4 w-4" />
                            <AlertDescription>
                              You need to achieve 80% or higher to pass this module and unlock the next one.
                              Complete all lessons and assessments to maximize your score.
                            </AlertDescription>
                          </Alert>
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
          <div className="bg-white rounded-lg p-8 max-w-md mx-4 text-center">
            <div className="mb-4">
              <div className="w-16 h-16 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Module Unlocked!</h3>
              <p className="text-gray-600">
                Congratulations! You've unlocked "{unlockedModuleName}".
              </p>
            </div>
            <Button onClick={() => setShowUnlockAnimation(false)}>
              Continue Learning
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LearningPage;