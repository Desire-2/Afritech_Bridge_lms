import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CheckCircle, Clock, Lock, ChevronDown } from 'lucide-react';
import { ModuleData, ModuleStatus } from '../types';

interface LearningSidebarProps {
  sidebarOpen: boolean;
  modules: ModuleData[];
  currentLessonId?: number;
  currentModuleId: number | null;
  getModuleStatus: (moduleId: number) => ModuleStatus;
  onLessonSelect: (lessonId: number, moduleId: number) => void;
}

export const LearningSidebar: React.FC<LearningSidebarProps> = ({
  sidebarOpen,
  modules,
  currentLessonId,
  currentModuleId,
  getModuleStatus,
  onLessonSelect
}) => {
  const allLessons = modules?.reduce((total, module) => total + (module.lessons?.length || 0), 0) || 0;

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
                  
                  <CollapsibleContent className="ml-8 mt-1 space-y-1">
                    {module.lessons?.map((lesson: any, lessonIndex: number) => {
                      const isCurrentLesson = lesson.id === currentLessonId;
                      const canAccessLesson = moduleStatus === 'completed' || 
                                               moduleStatus === 'in_progress' || 
                                               moduleStatus === 'unlocked';
                      
                      return (
                        <Button
                          key={lesson.id}
                          variant={isCurrentLesson ? "secondary" : "ghost"}
                          className={`w-full justify-start text-left p-2 h-auto text-sm ${
                            isCurrentLesson ? 'bg-blue-900/50 text-white hover:bg-blue-900/60' : 'text-gray-300 hover:bg-gray-800/50'
                          } ${
                            !canAccessLesson ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                          onClick={() => canAccessLesson && onLessonSelect(lesson.id, module.id)}
                          disabled={!canAccessLesson}
                        >
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-500 w-6">
                              {lessonIndex + 1}.
                            </span>
                            <span className="truncate">{lesson.title}</span>
                            {!canAccessLesson && (
                              <Lock className="h-3 w-3 text-gray-500 ml-auto" />
                            )}
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
  );
};
