import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  ArrowLeft, ArrowRight, Trophy, Brain, CheckCircle, Target, Zap,
  FileText, Clipboard, Play, Clock, Award, ExternalLink, Download,
  PenTool, Loader2
} from 'lucide-react';
import { ViewMode } from '../types';
import type { ContentQuiz, ContentAssignment } from '@/services/contentAssignmentApi';
import { ContentRichPreview } from './ContentRichPreview';
import { QuizAttemptTracker } from './QuizAttemptTracker';
import { AssignmentPanel } from './AssignmentPanel';

interface LessonContentProps {
  currentLesson: any;
  lessonQuiz: ContentQuiz | null;
  lessonAssignments: ContentAssignment[];
  contentLoading: boolean;
  readingProgress: number;
  engagementScore: number;
  timeSpent: number;
  scrollProgress: number;
  isLessonCompleted: boolean;
  currentViewMode: ViewMode;
  setCurrentViewMode: (mode: ViewMode) => void;
  lessonNotes: string;
  setLessonNotes: (notes: string) => void;
  contentRef?: any;
  onVideoComplete?: () => void;
  onVideoProgress?: (progress: number) => void;
  moduleScoring: any;
  currentModuleId: number | null;
  currentLessonIndex: number;
  totalLessons: number;
  hasNextLesson: boolean;
  hasPrevLesson: boolean;
  onNavigate: (direction: 'prev' | 'next') => void;
  onTrackInteraction: (type: string, data?: any) => void;
  getModuleStatus: (moduleId: number) => string;
  allLessons: any[];
}

export const LessonContent: React.FC<LessonContentProps> = ({
  currentLesson,
  lessonQuiz,
  lessonAssignments,
  contentLoading,
  readingProgress,
  engagementScore,
  timeSpent,
  scrollProgress,
  isLessonCompleted,
  currentViewMode,
  setCurrentViewMode,
  lessonNotes,
  setLessonNotes,
  contentRef,
  moduleScoring,
  currentModuleId,
  currentLessonIndex,
  totalLessons,
  hasNextLesson,
  hasPrevLesson,
  onNavigate,
  onTrackInteraction,
  getModuleStatus,
  allLessons
}) => {
  return (
    <div 
      ref={contentRef}
      className="h-[calc(100vh-4rem)] overflow-y-auto"
      onClick={() => onTrackInteraction('content_click')}
    >
      <div className="max-w-4xl mx-auto p-6">
        <div className="space-y-6">
          {/* Lesson Header */}
          <div className="bg-gray-800/50 rounded-lg shadow-sm border border-gray-700 p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-2">
                  {currentLesson.title}
                </h2>
                {currentLesson.description && (
                  <p className="text-gray-300 mb-4">{currentLesson.description}</p>
                )}
                <div className="flex items-center space-x-4">
                  <Badge variant="secondary">
                    Lesson {currentLessonIndex + 1} of {totalLessons}
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
                        onClick={() => onNavigate('prev')}
                        disabled={!hasPrevLesson}
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {(() => {
                        if (currentLessonIndex <= 0) {
                          return 'No previous lesson available';
                        }
                        const prevLesson = allLessons[currentLessonIndex - 1];
                        if (prevLesson) {
                          const prevModuleStatus = getModuleStatus(prevLesson.moduleId);
                          if (prevModuleStatus === 'locked') {
                            return 'Previous lesson is locked';
                          }
                        }
                        return 'Go to previous lesson';
                      })()}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onNavigate('next')}
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
                          const nextModuleStatus = getModuleStatus(nextLesson.moduleId);
                          if (nextModuleStatus === 'locked') {
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
              <div className="flex justify-between text-sm text-gray-300 mb-2">
                <span>Reading Progress</span>
                <span>{Math.round(readingProgress)}%</span>
              </div>
              <Progress value={readingProgress} className="h-2" />
            </div>
          </div>

          {/* Learning Interface Tabs */}
          <div className="bg-gray-800/50 rounded-lg shadow-sm border border-gray-700">
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
                {/* Enhanced Content Viewer with Rich Media Support */}
                <ContentRichPreview
                  lesson={{
                    title: currentLesson.title,
                    content_type: currentLesson.content_type || 'text',
                    content_data: currentLesson.content_data || currentLesson.content || '',
                    description: currentLesson.description,
                    learning_objectives: currentLesson.learning_objectives,
                    duration_minutes: currentLesson.duration_minutes
                  }}
                />

                {/* Progress Status */}
                {isLessonCompleted ? (
                    <div className="bg-green-900/30 border border-green-700 rounded-xl p-6">
                      <div className="flex items-center space-x-3">
                        <div className="h-12 w-12 bg-green-600 rounded-full flex items-center justify-center">
                          <Trophy className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-green-200 text-lg">Lesson Completed!</h4>
                          <p className="text-green-300">
                            Excellent work! You completed this lesson with {Math.round(engagementScore)}% engagement.
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                        <div className="bg-gray-800/50 rounded-lg p-3">
                          <div className="text-lg font-bold text-white">{Math.floor(timeSpent / 60)}m {timeSpent % 60}s</div>
                          <div className="text-xs text-gray-400">Time Spent</div>
                        </div>
                        <div className="bg-gray-800/50 rounded-lg p-3">
                          <div className="text-lg font-bold text-white">{Math.round(engagementScore)}%</div>
                          <div className="text-xs text-gray-400">Engagement</div>
                        </div>
                        <div className="bg-gray-800/50 rounded-lg p-3">
                          <div className="text-lg font-bold text-white">{Math.round(readingProgress)}%</div>
                          <div className="text-xs text-gray-400">Completion</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-blue-900/30 border border-blue-700 rounded-xl p-6">
                      <div className="flex items-center space-x-3">
                        <Brain className="h-8 w-8 text-blue-400" />
                        <div>
                          <h4 className="font-semibold text-blue-200">Keep Learning!</h4>
                          <p className="text-blue-300 text-sm">
                            Continue reading to automatically track your progress. 
                            Lesson will complete when you reach 80% reading progress.
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-4">
                        <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                          <div className="text-lg font-bold text-blue-400">{Math.round(readingProgress)}%</div>
                          <div className="text-xs text-gray-400">Reading</div>
                        </div>
                        <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                          <div className="text-lg font-bold text-green-400">{Math.round(engagementScore)}%</div>
                          <div className="text-xs text-gray-400">Engagement</div>
                        </div>
                        <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                          <div className="text-lg font-bold text-purple-400">{Math.floor(timeSpent / 60)}m</div>
                          <div className="text-xs text-gray-400">Time</div>
                        </div>
                      </div>
                    </div>
                  )}
              </TabsContent>

              <TabsContent value="quiz" className="p-6">
                {contentLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                    <span className="ml-2 text-gray-300">Loading quiz...</span>
                  </div>
                ) : lessonQuiz ? (
                  <QuizAttemptTracker
                    quiz={lessonQuiz}
                    onStartQuiz={() => onTrackInteraction('quiz_started', { quizId: lessonQuiz.id })}
                    onSubmitQuiz={(answers) => {
                      onTrackInteraction('quiz_submitted', { quizId: lessonQuiz.id, answers });
                      // TODO: Call API to submit quiz answers
                    }}
                  />
                ) : (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">No Quiz Available</h3>
                    <p className="text-gray-300">
                      This lesson doesn't have an associated quiz.
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="assignments" className="p-6">
                {contentLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                    <span className="ml-2 text-gray-300">Loading assignments...</span>
                  </div>
                ) : lessonAssignments.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-xl font-bold text-white">Lesson Assignments</h3>
                        <p className="text-gray-300 mt-1">Complete these assignments to apply what you've learned</p>
                      </div>
                      <Badge variant="outline" className="bg-green-900/30 text-green-300 border-green-700">
                        <Clipboard className="h-3 w-3 mr-1" />
                        {lessonAssignments.length} Assignment{lessonAssignments.length > 1 ? 's' : ''}
                      </Badge>
                    </div>
                    
                    {lessonAssignments.map((assignment) => (
                      <AssignmentPanel
                        key={assignment.id}
                        assignment={assignment}
                        onSubmit={(submission) => {
                          onTrackInteraction('assignment_submitted', { 
                            assignmentId: assignment.id,
                            hasText: !!submission.text,
                            fileCount: submission.files?.length || 0
                          });
                          // TODO: Call API to submit assignment
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Clipboard className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">No Assignments</h3>
                    <p className="text-gray-300">
                      This lesson doesn't have any assignments.
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="notes" className="p-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white">Lesson Notes</h3>
                  <p className="text-gray-300">
                    Take notes while learning. Your notes are automatically saved.
                  </p>
                  <div className="space-y-4">
                    <textarea
                      value={lessonNotes}
                      onChange={(e) => setLessonNotes(e.target.value)}
                      placeholder="Write your notes here..."
                      className="w-full h-64 p-4 bg-gray-800/50 border border-gray-700 text-white rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500"
                    />
                    <div className="text-sm text-gray-400">
                      Notes are saved automatically as you type.
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Navigation Footer */}
          <div className="bg-gray-800/50 rounded-lg shadow-sm border border-gray-700 p-4">
            <div className="flex justify-between items-center">
              <Button
                variant="outline"
                onClick={() => onNavigate('prev')}
                disabled={!hasPrevLesson}
                className="flex items-center space-x-2 border-gray-700 text-gray-300 hover:bg-gray-700"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Previous Lesson</span>
              </Button>
              
              <div className="text-sm text-gray-300">
                Lesson {currentLessonIndex + 1} of {totalLessons}
              </div>
              
              <Button
                onClick={() => onNavigate('next')}
                disabled={!hasNextLesson}
                className="flex items-center space-x-2"
              >
                <span>Next Lesson</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
