import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle, Clock, Lock, ChevronDown, BookOpen, ClipboardList, FileText, FolderOpen } from 'lucide-react';
import { ModuleData, ModuleStatus } from '../types';

interface LessonAssessment {
  id: number;
  title: string;
  type: 'quiz' | 'assignment' | 'project';
  status?: 'pending' | 'in_progress' | 'completed';
  dueDate?: string;
}

interface LearningSidebarProps {
  sidebarOpen: boolean;
  modules: ModuleData[];
  currentLessonId?: number;
  currentModuleId: number | null;
  getModuleStatus: (moduleId: number) => ModuleStatus;
  onLessonSelect: (lessonId: number, moduleId: number) => void;
  lessonAssessments?: { [lessonId: number]: LessonAssessment[] };
  completedLessons?: number[];
  lessonCompletionStatus?: { [lessonId: number]: boolean };
}

export const LearningSidebar: React.FC<LearningSidebarProps> = ({
  sidebarOpen,
  modules,
  currentLessonId,
  currentModuleId,
  getModuleStatus,
  onLessonSelect,
  lessonAssessments = {},
  completedLessons = [],
  lessonCompletionStatus = {}
}) => {
  const allLessons = modules?.reduce((total, module) => total + (module.lessons?.length || 0), 0) || 0;

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

  return (
    <div className={`${sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 overflow-hidden bg-gray-900/50 border-r border-gray-800 shadow-sm`}>
      <div className="h-[calc(100vh-4rem)] overflow-y-auto">
        <div className="p-4 border-b border-gray-800">
          <h3 className="font-semibold text-white">Course Navigation</h3>
          <p className="text-sm text-gray-400 mt-1">
            {modules?.length || 0} modules • {allLessons} lessons
          </p>
        </div>
        
        <ScrollArea className="px-4 py-2">
          {modules?.map((module: ModuleData, moduleIndex: number) => {
            const moduleStatus = getModuleStatus(module.id);
            const isCurrentModule = module.id === currentModuleId;
            
            return (
              <Collapsible key={module.id} defaultOpen={isCurrentModule}>
                <div className="mb-2">
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between text-left p-3 h-auto hover:bg-gray-800/50 text-gray-200"
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className="flex-shrink-0">
                          {moduleStatus === 'completed' ? (
                            <CheckCircle className="h-5 w-5 text-green-400" />
                          ) : moduleStatus === 'in_progress' || moduleStatus === 'unlocked' ? (
                            <Clock className="h-5 w-5 text-blue-400" />
                          ) : (
                            <Lock className="h-5 w-5 text-gray-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <p className="font-medium text-sm truncate text-white">
                              Module {moduleIndex + 1}: {module.title}
                            </p>
                            {moduleStatus === 'completed' && (
                              <Badge variant="secondary" className="bg-green-900/50 text-green-300 text-xs px-1.5 py-0">
                                ✓
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">
                            {module.lessons?.length || 0} lessons
                            {moduleStatus === 'completed' && ' • Completed'}
                            {moduleStatus === 'locked' && ' • Locked'}
                          </p>
                        </div>
                      </div>
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    </Button>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent className="ml-4 mt-1 space-y-2">
                    {module.lessons?.map((lesson: any, lessonIndex: number) => {
                      const isCurrentLesson = lesson.id === currentLessonId;
                      const canAccessLesson = moduleStatus === 'completed' || 
                                               moduleStatus === 'in_progress' || 
                                               moduleStatus === 'unlocked';
                      const assessments = lessonAssessments[lesson.id] || [];
                      const isLessonCompleted = lessonCompletionStatus[lesson.id] || completedLessons.includes(lesson.id);
                      const statusText = getLessonStatusText(isLessonCompleted, canAccessLesson);
                      const statusColor = getLessonStatusColor(isLessonCompleted, canAccessLesson);
                      
                      return (
                        <div key={lesson.id} className="space-y-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant={isCurrentLesson ? "secondary" : "ghost"}
                                  className={`w-full justify-start text-left p-2 h-auto text-sm ${
                                    isCurrentLesson ? 'bg-blue-900/50 text-white hover:bg-blue-900/60' : 'text-gray-300 hover:bg-gray-800/50'
                                  } ${
                                    isLessonCompleted ? 'ring-1 ring-green-500/50 bg-green-900/20' : ''
                                  } ${
                                    !canAccessLesson ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                                  }`}
                                  onClick={() => canAccessLesson && onLessonSelect(lesson.id, module.id)}
                                  disabled={!canAccessLesson}
                                >
                                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                                    <span className="text-xs text-gray-500 flex-shrink-0">
                                      {lessonIndex + 1}.
                                    </span>
                                    <span className="truncate flex-1">{lesson.title}</span>
                                    
                                    {/* Status indicators */}
                                    {isLessonCompleted ? (
                                      <div className="flex items-center space-x-1 flex-shrink-0">
                                        <CheckCircle className="h-4 w-4 text-green-400" />
                                        <Badge className="bg-green-900/50 text-green-300 text-xs px-1.5 py-0">
                                          Done
                                        </Badge>
                                      </div>
                                    ) : !canAccessLesson ? (
                                      <Lock className="h-3 w-3 text-gray-500 flex-shrink-0" />
                                    ) : (
                                      <Clock className="h-3 w-3 text-blue-400 flex-shrink-0" />
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
                            <div className="ml-8 space-y-1">
                              {assessments.map((assessment: LessonAssessment) => (
                                <TooltipProvider key={`${assessment.type}-${assessment.id}`}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div
                                        className={`flex items-center space-x-2 px-3 py-1.5 rounded border text-xs ${getAssessmentColor(assessment.type)} ${
                                          !canAccessLesson ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                                        }`}
                                      >
                                        <div className="flex-shrink-0">
                                          {getAssessmentIcon(assessment.type, 'h-3.5 w-3.5')}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="truncate font-medium">
                                            {assessment.type.charAt(0).toUpperCase() + assessment.type.slice(1)}
                                          </p>
                                          <p className="text-xs opacity-75 truncate">{assessment.title}</p>
                                        </div>
                                        {assessment.status === 'completed' && (
                                          <CheckCircle className="h-3 w-3 flex-shrink-0 text-green-400" />
                                        )}
                                        {assessment.status === 'in_progress' && (
                                          <Clock className="h-3 w-3 flex-shrink-0 text-yellow-400" />
                                        )}
                                        {!assessment.status && (
                                          <span className="text-xs opacity-60">pending</span>
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
                                          <p className="text-xs">
                                            Status: <span className="font-medium">
                                              {assessment.status ? assessment.status.replace('_', ' ').toUpperCase() : 'PENDING'}
                                            </span>
                                          </p>
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
                              ))}
                            </div>
                          )}
                        </div>
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
  );
};
