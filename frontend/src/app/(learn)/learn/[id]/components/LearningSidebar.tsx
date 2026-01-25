import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Clock, Lock, ChevronDown, BookOpen, ClipboardList, FileText, FolderOpen, TrendingUp, BarChart3, AlertCircle, Target, Award } from 'lucide-react';
import { ModuleData, ModuleStatus } from '../types';
import { ProgressApiService } from '@/services/api';
import type { ModuleProgress as ModuleProgressType } from '@/services/api/types';
import ModuleScoreBreakdown from '@/components/student/ModuleScoreBreakdown';

interface LessonAssessment {
  id: number;
  title: string;
  type: 'quiz' | 'assignment' | 'project';
  status?: 'pending' | 'in_progress' | 'completed';
  dueDate?: string;
}

interface ModuleProgressData {
  completedLessons: number;
  totalLessons: number;
  cumulativeScore: number;
  status: string;
  progressPercentage: number;
}

export interface LockedModuleInfo {
  moduleId: number;
  moduleTitle: string;
  moduleIndex: number;
  previousModuleTitle: string;
  previousModuleId: number;
  previousModuleScore: number;
  previousModuleLessonsCompleted: number;
  previousModuleTotalLessons: number;
  requiredScore: number;
}

interface LearningSidebarProps {
  sidebarOpen: boolean;
  modules: ModuleData[];
  currentLessonId?: number;
  currentModuleId: number | null;
  getModuleStatus: (moduleId: number) => ModuleStatus;
  onLessonSelect: (lessonId: number, moduleId: number) => void;
  onQuizSelect?: (lessonId: number, moduleId: number, quizId: number) => void;
  lessonAssessments?: { [lessonId: number]: LessonAssessment[] };
  completedLessons?: number[];
  lessonCompletionStatus?: { [lessonId: number]: boolean };
  quizCompletionStatus?: { [quizId: number]: { completed: boolean; score: number; passed: boolean } };
  onLockedModuleClick?: (info: LockedModuleInfo) => void;
  setSidebarOpen?: (open: boolean) => void; // Add this prop for mobile close functionality
  viewAsStudent?: boolean; // For instructor preview mode
  // Module release info
  totalModuleCount?: number;
  releasedModuleCount?: number;
}

export const LearningSidebar: React.FC<LearningSidebarProps> = ({
  sidebarOpen,
  modules,
  currentLessonId,
  currentModuleId,
  getModuleStatus,
  onLessonSelect,
  onQuizSelect,
  lessonAssessments = {},
  completedLessons = [],
  lessonCompletionStatus = {},
  quizCompletionStatus = {},
  onLockedModuleClick,
  setSidebarOpen,
  viewAsStudent = false,
  totalModuleCount,
  releasedModuleCount
}) => {
  const allLessons = modules?.reduce((total, module) => total + (module.lessons?.length || 0), 0) || 0;
  
  // State to hold real progress data from database
  const [moduleProgressData, setModuleProgressData] = useState<{ [moduleId: number]: ModuleProgressData }>({});
  const [loadingProgress, setLoadingProgress] = useState(true);
  
  // State to track which modules are expanded
  const [openModules, setOpenModules] = useState<Set<number>>(new Set());
  
  // Initialize open modules - expand current module OR first accessible module
  useEffect(() => {
    if (!modules || modules.length === 0) return;
    
    setOpenModules(prev => {
      const newSet = new Set(prev);
      
      // If we have a current module, expand it
      if (currentModuleId) {
        newSet.add(currentModuleId);
      }
      
      // If we have a current lesson, find and expand its module
      if (currentLessonId) {
        const moduleWithLesson = modules.find(m => 
          m.lessons?.some(l => l.id === currentLessonId)
        );
        if (moduleWithLesson) {
          newSet.add(moduleWithLesson.id);
        }
      }
      
      // If no modules are open yet, expand the first accessible (non-locked) module
      if (newSet.size === 0) {
        const firstAccessibleModule = modules.find(m => {
          const status = getModuleStatus(m.id);
          return status !== 'locked';
        });
        if (firstAccessibleModule) {
          newSet.add(firstAccessibleModule.id);
        } else if (modules[0]) {
          // Fallback: expand the first module even if locked (for visibility)
          // Users will see it's locked but at least they can see something
          newSet.add(modules[0].id);
        }
      }
      
      return newSet;
    });
  }, [currentModuleId, currentLessonId, modules, getModuleStatus]);

  // Fetch real module progress data from database
  useEffect(() => {
    const fetchModuleProgress = async () => {
      if (!modules || modules.length === 0) return;
      
      setLoadingProgress(true);
      const progressMap: { [moduleId: number]: ModuleProgressData } = {};
      
      try {
        await Promise.all(
          modules.map(async (module) => {
            try {
              const response = await ProgressApiService.getModuleProgress(module.id);
              
              // Calculate completed lessons from lessonCompletionStatus
              const moduleLessons = module.lessons || [];
              const completedCount = moduleLessons.filter(
                (lesson: any) => lessonCompletionStatus[lesson.id] === true
              ).length;
              
              const totalLessons = moduleLessons.length;
              const progressPercentage = totalLessons > 0 
                ? Math.round((completedCount / totalLessons) * 100) 
                : 0;
              
              // Access progress data correctly from the API response
              // The API returns ModuleData which has a 'progress' property
              const progressData = (response as any)?.progress || (response as any)?.data?.progress;
              
              progressMap[module.id] = {
                completedLessons: completedCount,
                totalLessons: totalLessons,
                cumulativeScore: (progressData?.weighted_score ?? progressData?.cumulative_score ?? progressData?.module_score ?? 0),
                status: progressData?.status || 'locked',
                progressPercentage: progressPercentage
              };
            } catch (error) {
              console.error(`Failed to fetch progress for module ${module.id}:`, error);
              // Fallback to local calculation
              const moduleLessons = module.lessons || [];
              const completedCount = moduleLessons.filter(
                (lesson: any) => lessonCompletionStatus[lesson.id] === true
              ).length;
              
              progressMap[module.id] = {
                completedLessons: completedCount,
                totalLessons: moduleLessons.length,
                cumulativeScore: 0,
                status: 'locked',
                progressPercentage: moduleLessons.length > 0 
                  ? Math.round((completedCount / moduleLessons.length) * 100) 
                  : 0
              };
            }
          })
        );
        
        setModuleProgressData(progressMap);
        console.log('📊 Loaded module progress data:', progressMap);
      } catch (error) {
        console.error('Error fetching module progress:', error);
      } finally {
        setLoadingProgress(false);
      }
    };
    
    fetchModuleProgress();
  }, [modules, lessonCompletionStatus]);

  // Helper function to get icon for assessment type
  const getAssessmentIcon = (type: string, size: string = 'h-3 w-3') => {
    switch (type) {
      case 'quiz':
        return <ClipboardList className={`${size} text-blue-400`} />;
      case 'assignment':
        return <FileText className={`${size} text-purple-400`} />;
      case 'project':
        return <FolderOpen className={`${size} text-orange-400`} />;
      default:
        return <BookOpen className={`${size} text-gray-400`} />;
    }
  };

  // Helper function to get color for assessment type
  const getAssessmentColor = (type: string) => {
    switch (type) {
      case 'quiz':
        return 'bg-blue-900/30 text-blue-300 border-blue-700/50';
      case 'assignment':
        return 'bg-purple-900/30 text-purple-300 border-purple-700/50';
      case 'project':
        return 'bg-orange-900/30 text-orange-300 border-orange-700/50';
      default:
        return 'bg-gray-800/30 text-gray-300 border-gray-700/50';
    }
  };

  // Helper function to get lesson status text
  const getLessonStatusText = (isCompleted: boolean, canAccess: boolean) => {
    if (isCompleted) return 'Completed';
    if (!canAccess) return 'Locked';
    return 'In Progress';
  };

  // Helper function to get lesson status color
  const getLessonStatusColor = (isCompleted: boolean, canAccess: boolean) => {
    if (isCompleted) return 'text-green-400';
    if (!canAccess) return 'text-gray-500';
    return 'text-blue-400';
  };

  // Debug: Log module and lesson data to help diagnose display issues
  useEffect(() => {
    console.log('📚 LearningSidebar data:', {
      modulesCount: modules?.length || 0,
      modules: modules?.map(m => ({
        id: m.id,
        title: m.title,
        lessonsCount: m.lessons?.length || 0,
        lessonIds: m.lessons?.map(l => l.id) || []
      })),
      currentModuleId,
      currentLessonId,
      openModulesArray: Array.from(openModules),
      loadingProgress
    });
  }, [modules, currentModuleId, currentLessonId, openModules, loadingProgress]);

  // Enhanced lesson selection handler for mobile responsiveness
  const handleLessonSelection = useCallback((lessonId: number, moduleId: number) => {
    onLessonSelect(lessonId, moduleId);
    
    // Auto-close sidebar on mobile after lesson selection
    if (setSidebarOpen && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [onLessonSelect, setSidebarOpen]);

  // Enhanced quiz selection handler for mobile responsiveness
  const handleQuizSelection = useCallback((lessonId: number, moduleId: number, quizId: number) => {
    if (onQuizSelect) {
      onQuizSelect(lessonId, moduleId, quizId);
      
      // Auto-close sidebar on mobile after quiz selection
      if (setSidebarOpen && window.innerWidth < 1024) {
        setSidebarOpen(false);
      }
    }
  }, [onQuizSelect, setSidebarOpen]);

  return (
    <>
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen?.(false)} 
        />
      )}
      
      <div className={`
        ${sidebarOpen ? 'w-80 md:w-80' : 'w-0'} 
        transition-all duration-300 overflow-hidden 
        bg-gray-900/95 lg:bg-gray-900/50 
        border-r border-gray-800 shadow-sm
        fixed lg:relative 
        top-0 lg:top-auto
        left-0 
        h-screen lg:h-auto
        z-50 lg:z-auto
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="h-[calc(100vh-4rem)] lg:h-[calc(100vh-4rem)] overflow-y-auto">
        <div className="p-3 sm:p-4 border-b border-gray-800">
          <h3 className="text-base sm:text-lg font-semibold text-white">Course Navigation</h3>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            {modules?.length || 0} modules • {allLessons} lessons
          </p>
          {/* Module release progress indicator */}
          {totalModuleCount && releasedModuleCount !== undefined && totalModuleCount > releasedModuleCount && (
            <div className="mt-2 text-xs text-amber-400 bg-amber-900/20 px-2 py-1 rounded border border-amber-700/30 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{releasedModuleCount} of {totalModuleCount} modules available</span>
            </div>
          )}
          {currentLessonId && (
            <div className="mt-2 text-xs text-blue-400 bg-blue-900/20 px-2 py-1 rounded border border-blue-700/30">
              📍 Currently viewing lesson
            </div>
          )}
        </div>
        
        <ScrollArea className="px-3 sm:px-4 py-2">
          {modules?.map((module: ModuleData, moduleIndex: number) => {
            const moduleStatus = getModuleStatus(module.id);
            const isCurrentModule = module.id === currentModuleId;
            const moduleProgress = moduleProgressData[module.id];
            const hasProgressData = moduleProgress !== undefined;
            
            // Debug logging for module status
            console.log(`📊 Module ${module.id} (${module.title}): status from getModuleStatus = "${moduleStatus}", internal progress status = "${moduleProgress?.status}"`);
            
            // FIXED: First module (index 0) should ALWAYS be accessible
            // Also treat current module as accessible regardless of status
            // This prevents all modules from appearing locked while data loads
            // In instructor preview mode, no modules should be locked
            const isLocked = viewAsStudent 
              ? false 
              : (moduleIndex === 0 
                ? false 
                : (moduleStatus === 'locked' && !isCurrentModule));
            
            // Get previous module info for locked module display
            const previousModule = moduleIndex > 0 ? modules[moduleIndex - 1] : null;
            const previousModuleProgress = previousModule ? moduleProgressData[previousModule.id] : null;
            
            // Handler for locked module click
            const handleLockedModuleClick = (e: React.MouseEvent) => {
              if (isLocked && onLockedModuleClick && previousModule) {
                e.preventDefault();
                e.stopPropagation();
                onLockedModuleClick({
                  moduleId: module.id,
                  moduleTitle: module.title,
                  moduleIndex: moduleIndex,
                  previousModuleTitle: previousModule.title,
                  previousModuleId: previousModule.id,
                  previousModuleScore: previousModuleProgress?.cumulativeScore || 0,
                  previousModuleLessonsCompleted: previousModuleProgress?.completedLessons || 0,
                  previousModuleTotalLessons: previousModuleProgress?.totalLessons || previousModule.lessons?.length || 0,
                  requiredScore: 80
                });
              }
            };
            
            // Handle module header click
            const handleModuleClick = (e: React.MouseEvent) => {
              if (isLocked) {
                e.preventDefault();
                e.stopPropagation();
                handleLockedModuleClick(e);
              }
              // For unlocked modules, let the CollapsibleTrigger handle the toggle
            };
            
            const isOpen = openModules.has(module.id);
            
            return (
              <Collapsible 
                key={module.id} 
                open={isOpen && !isLocked}
                onOpenChange={(open) => {
                  if (!isLocked) {
                    if (open) {
                      setOpenModules(prev => new Set([...prev, module.id]));
                    } else {
                      setOpenModules(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(module.id);
                        return newSet;
                      });
                    }
                  }
                }}
              >
                <div className="mb-2">
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      onClick={isLocked ? handleModuleClick : undefined}
                      className={`w-full justify-between text-left p-2 sm:p-3 h-auto hover:bg-gray-800/50 text-gray-200 ${
                        isLocked ? 'cursor-pointer opacity-70 hover:opacity-100' : ''
                      }`}
                    >
                      <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                        <div className="flex-shrink-0">
                          {moduleStatus === 'completed' ? (
                            <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-400" />
                          ) : moduleStatus === 'in_progress' || moduleStatus === 'unlocked' ? (
                            <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />
                          ) : (
                            <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-1 sm:space-x-2 flex-wrap">
                            <p className="font-medium text-xs sm:text-sm truncate text-white">
                              Module {moduleIndex + 1}: {module.title}
                            </p>
                            {moduleStatus === 'completed' && (
                              <Badge variant="secondary" className="bg-green-900/50 text-green-300 text-xs px-1.5 py-0">
                                ✓
                              </Badge>
                            )}
                            {isLocked && (
                              <Badge variant="outline" className="bg-orange-900/30 text-orange-300 text-xs px-1.5 py-0 border-orange-700/50">
                                <Lock className="h-3 w-3 mr-0.5" />
                                Click to see requirements
                              </Badge>
                            )}
                            {hasProgressData && moduleProgress.cumulativeScore > 0 && !isLocked && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Badge 
                                    variant="outline" 
                                    className="bg-blue-900/30 text-blue-300 text-xs px-1.5 py-0 border-blue-700/50 cursor-pointer hover:bg-blue-800/40 transition-colors"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <BarChart3 className="h-3 w-3 mr-0.5" />
                                    {Math.round(moduleProgress.cumulativeScore)}%
                                  </Badge>
                                </DialogTrigger>
                                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                                  <DialogHeader>
                                    <DialogTitle>Module {moduleIndex + 1}: {module.title} - Score Breakdown</DialogTitle>
                                  </DialogHeader>
                                  <ModuleScoreBreakdown moduleId={module.id} />
                                </DialogContent>
                              </Dialog>
                            )}
                          </div>
                          <div className="space-y-1 mt-1">
                            <p className="text-[10px] sm:text-xs text-gray-400">
                              {hasProgressData 
                                ? `${moduleProgress.completedLessons}/${moduleProgress.totalLessons} lessons completed`
                                : `${module.lessons?.length || 0} lessons`
                              }
                              {moduleStatus === 'completed' && ' • Completed'}
                              {moduleStatus === 'locked' && ' • Locked'}
                            </p>
                            {hasProgressData && moduleProgress.progressPercentage > 0 && (
                              <div className="space-y-0.5">
                                <Progress 
                                  value={moduleProgress.progressPercentage} 
                                  className="h-1 sm:h-1.5 bg-gray-700"
                                />
                                <p className="text-[9px] sm:text-xs text-gray-500">
                                  {moduleProgress.progressPercentage}% complete
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronDown className={`h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-500 transition-transform duration-200 ${
                        isOpen && !isLocked ? 'rotate-180' : ''
                      } ${isLocked ? 'opacity-50' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent className="ml-2 sm:ml-3 md:ml-4 mt-1 space-y-2">
                    {module.lessons && module.lessons.length > 0 ? (
                      module.lessons.map((lesson: any, lessonIndex: number) => {
                      const isCurrentLesson = lesson.id === currentLessonId;
                      const isLessonCompleted = lessonCompletionStatus[lesson.id] || completedLessons.includes(lesson.id);
                      
                      // ENHANCED ACCESS LOGIC:
                      // 1. Completed lessons are ALWAYS accessible (for review)
                      // 2. Lessons in accessible modules (unlocked, in_progress, completed)
                      // 3. First lesson is always accessible if module is unlocked
                      // 4. FIXED: First module (index 0) lessons are always accessible
                      // 5. In instructor preview mode, ALL lessons are accessible
                      const isFirstModule = moduleIndex === 0;
                      const isModuleAccessible = isFirstModule || 
                                                  moduleStatus === 'completed' || 
                                                  moduleStatus === 'in_progress' || 
                                                  moduleStatus === 'unlocked';
                      const isFirstLesson = lessonIndex === 0;
                      const canAccessLesson = viewAsStudent || // All lessons accessible in instructor preview mode
                                               isLessonCompleted || // Completed lessons always accessible
                                               isModuleAccessible || // Module is unlocked
                                               (isFirstLesson && !isLocked); // First lesson if not locked
                      
                      const assessments = lessonAssessments[lesson.id] || [];
                      const statusText = getLessonStatusText(isLessonCompleted, canAccessLesson);
                      const statusColor = getLessonStatusColor(isLessonCompleted, canAccessLesson);
                      
                      return (
                        <div key={lesson.id} className="space-y-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant={isCurrentLesson ? "secondary" : "ghost"}
                                  className={`w-full justify-start text-left p-1.5 sm:p-2 h-auto text-xs sm:text-sm transition-all duration-200 ${
                                    isCurrentLesson ? 'bg-blue-900/50 text-white hover:bg-blue-900/60 shadow-md' : 'text-gray-300 hover:bg-gray-800/50'
                                  } ${
                                    isLessonCompleted ? 'ring-1 ring-green-500/50 bg-green-900/20 hover:bg-green-900/30' : ''
                                  } ${
                                    !canAccessLesson ? 'opacity-40 cursor-not-allowed hover:bg-transparent' : 'cursor-pointer hover:ring-1 hover:ring-blue-500/30 hover:translate-x-0.5'
                                  }`}
                                  onClick={() => canAccessLesson && handleLessonSelection(lesson.id, module.id)}
                                  disabled={!canAccessLesson}
                                >
                                  <div className="flex items-center space-x-1 sm:space-x-2 flex-1 min-w-0">
                                    <span className="text-[10px] sm:text-xs text-gray-500 flex-shrink-0">
                                      {lessonIndex + 1}.
                                    </span>
                                    <span className="truncate flex-1 text-xs sm:text-sm">{lesson.title}</span>
                                    
                                    {/* Status indicators */}
                                    {isCurrentLesson && !isLessonCompleted && (
                                      <Badge className="bg-blue-900/80 text-blue-200 text-[10px] sm:text-xs px-1 sm:px-1.5 py-0 flex-shrink-0 mr-1">
                                        Current
                                      </Badge>
                                    )}
                                    {isLessonCompleted ? (
                                      <div className="flex items-center space-x-0.5 sm:space-x-1 flex-shrink-0">
                                        <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-400" />
                                        <Badge className="bg-green-900/50 text-green-300 text-[10px] sm:text-xs px-1 sm:px-1.5 py-0">
                                          Done
                                        </Badge>
                                      </div>
                                    ) : !canAccessLesson ? (
                                      <Lock className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-gray-500 flex-shrink-0" />
                                    ) : (
                                      <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-blue-400 flex-shrink-0" />
                                    )}
                                  </div>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-xs">
                                <div className="space-y-2">
                                  <div>
                                    <p className="font-semibold text-sm text-white">Lesson {lessonIndex + 1}</p>
                                    <p className="text-xs text-gray-200 mt-1 break-words">{lesson.title}</p>
                                  </div>
                                  <div className="pt-2 border-t border-gray-600">
                                    <div className="flex items-center space-x-2">
                                      <div className={`h-2 w-2 rounded-full ${statusColor}`} />
                                      <span className={`text-xs font-medium ${statusColor}`}>{statusText}</span>
                                    </div>
                                    {isLessonCompleted && (
                                      <p className="text-xs text-green-400 mt-1">
                                        ✓ Click to review this lesson
                                      </p>
                                    )}
                                    {!canAccessLesson && !isLessonCompleted && (
                                      <p className="text-xs text-orange-400 mt-1">
                                        🔒 Complete previous lessons or unlock the module first
                                      </p>
                                    )}
                                    {canAccessLesson && !isLessonCompleted && (
                                      <p className="text-xs text-blue-400 mt-1">
                                        📖 Ready to learn
                                      </p>
                                    )}
                                    {lesson.duration_minutes && (
                                      <p className="text-xs text-gray-300 mt-2">
                                        ⏱️ {lesson.duration_minutes} minutes
                                      </p>
                                    )}
                                    {lesson.description && (
                                      <p className="text-xs text-gray-300 mt-2 italic break-words">
                                        {lesson.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          {/* Display assessments for this lesson */}
                          {assessments.length > 0 && (
                            <div className="ml-4 sm:ml-6 md:ml-8 space-y-1">
                              {assessments.map((assessment: LessonAssessment) => {
                                const isQuizCompleted = assessment.type === 'quiz' && quizCompletionStatus[assessment.id]?.completed;
                                const quizScore = quizCompletionStatus[assessment.id]?.score;
                                const quizPassed = quizCompletionStatus[assessment.id]?.passed;
                                // Quiz is accessible if lesson is completed OR in instructor preview mode
                                const canAccessQuiz = viewAsStudent || (isLessonCompleted && assessment.type === 'quiz');
                                
                                const handleAssessmentClick = () => {
                                  if (assessment.type === 'quiz' && canAccessQuiz) {
                                    // Use responsive handler that auto-closes sidebar on mobile
                                    handleQuizSelection(lesson.id, module.id, assessment.id);
                                  } else if (assessment.type === 'assignment' && canAccessLesson) {
                                    // Use responsive handler for lesson selection
                                    handleLessonSelection(lesson.id, module.id);
                                  }
                                };
                                
                                return (
                                <TooltipProvider key={`${assessment.type}-${assessment.id}`}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div
                                        onClick={handleAssessmentClick}
                                        className={`flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded border text-[10px] sm:text-xs transition-all duration-200 ${getAssessmentColor(assessment.type)} ${
                                          assessment.type === 'quiz' && !canAccessQuiz ? 'opacity-50 cursor-not-allowed' : 
                                          assessment.type === 'quiz' && canAccessQuiz ? 'cursor-pointer hover:scale-105 hover:shadow-md' :
                                          !canAccessLesson ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'
                                        } ${isQuizCompleted && quizPassed ? 'ring-1 ring-green-500/50' : ''}`}
                                      >
                                        <div className="flex-shrink-0">
                                          {getAssessmentIcon(assessment.type, 'h-3 w-3 sm:h-3.5 sm:w-3.5')}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="truncate font-medium text-[10px] sm:text-xs">
                                            {assessment.type.charAt(0).toUpperCase() + assessment.type.slice(1)}
                                          </p>
                                          <p className="text-[9px] sm:text-xs opacity-75 truncate">{assessment.title}</p>
                                          {isQuizCompleted && quizScore !== undefined && (
                                            <p className={`text-[9px] sm:text-xs font-semibold ${quizPassed ? 'text-green-400' : 'text-yellow-400'}`}>
                                              Score: {Math.round(quizScore)}%
                                            </p>
                                          )}
                                        </div>
                                        {isQuizCompleted ? (
                                          <CheckCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0 text-green-400" />
                                        ) : assessment.status === 'completed' ? (
                                          <CheckCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0 text-green-400" />
                                        ) : assessment.status === 'in_progress' ? (
                                          <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0 text-yellow-400" />
                                        ) : null}
                                        {!assessment.status && !isQuizCompleted && (
                                          <span className="text-[9px] sm:text-xs opacity-60">pending</span>
                                        )}
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="max-w-xs">
                                      <div className="space-y-2">
                                        <div>
                                          <p className="font-semibold text-sm text-white">
                                            {assessment.type.charAt(0).toUpperCase() + assessment.type.slice(1)}
                                          </p>
                                          <p className="text-xs text-gray-200 mt-1 break-words">{assessment.title}</p>
                                        </div>
                                        <div className="pt-2 border-t border-gray-600">
                                          {isQuizCompleted && (
                                            <div className="mb-2">
                                              <p className="text-xs font-semibold text-green-400">✓ Completed</p>
                                              <p className="text-xs text-gray-200 mt-1">
                                                Score: <span className={`font-semibold ${quizPassed ? 'text-green-400' : 'text-yellow-400'}`}>
                                                  {Math.round(quizScore || 0)}%
                                                </span>
                                              </p>
                                            </div>
                                          )}
                                          <p className="text-xs">
                                            Status: <span className="font-medium">
                                              {isQuizCompleted ? 'COMPLETED' : assessment.status ? assessment.status.replace('_', ' ').toUpperCase() : 'PENDING'}
                                            </span>
                                          </p>
                                          {assessment.type === 'quiz' && canAccessQuiz && (
                                            <p className="text-xs text-blue-400 mt-2">
                                              👆 Click to {isQuizCompleted ? 'review' : 'take'} quiz
                                            </p>
                                          )}
                                          {assessment.type === 'quiz' && !canAccessQuiz && (
                                            <p className="text-xs text-orange-400 mt-2">
                                              🔒 Complete the lesson first
                                            </p>
                                          )}
                                          {assessment.dueDate && (
                                            <p className="text-xs text-gray-300 mt-1">
                                              📅 Due: {new Date(assessment.dueDate).toLocaleDateString()}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )})}
                            </div>
                          )}
                        </div>
                      );
                    })
                    ) : (
                      <div className="text-sm text-gray-500 py-2 px-3">
                        No lessons available in this module
                      </div>
                    )}
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </ScrollArea>
      </div>
    </div>
    </>
  );
};
