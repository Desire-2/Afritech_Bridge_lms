import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  ArrowLeft, ArrowRight, Trophy, Brain, CheckCircle, Target, Zap,
  FileText, Clipboard, Play, Clock, Award, ExternalLink, Download,
  PenTool, Loader2, AlertCircle, Lock, Unlock, Sparkles, GraduationCap
} from 'lucide-react';
import Link from 'next/link';
import { StudentApiService } from '@/services/studentApi';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ViewMode } from '../types';
import type { ContentQuiz, ContentAssignment } from '@/services/contentAssignmentApi';
import { ContentRichPreview } from './ContentRichPreview';
import { QuizAttemptTracker } from './QuizAttemptTracker';
import { AssignmentPanel } from './AssignmentPanel';
import { LessonScoreDisplay } from './LessonScoreDisplay';

interface LessonContentProps {
  currentLesson: any;
  lessonQuiz: ContentQuiz | null;
  lessonAssignments: ContentAssignment[];
  contentLoading: boolean;
  quizLoadError?: string | null;
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
  onMixedContentVideoProgress?: (videoIndex: number, progress: number) => void;
  onMixedContentVideoComplete?: (videoIndex: number) => void;
  moduleScoring: any;
  lessonScore: number;
  currentLessonQuizScore?: number;
  currentLessonAssignmentScore?: number;
  currentModuleId: number | null;
  currentLessonIndex: number;
  totalLessons: number;
  hasNextLesson: boolean;
  hasPrevLesson: boolean;
  onNavigate: (direction: 'prev' | 'next') => void;
  onTrackInteraction: (type: string, data?: any) => void;
  onReloadContent?: () => void;
  onQuizComplete?: (score: number, passed: boolean) => void;
  onAssignmentSubmit?: (assignmentId: number, score: number) => void;
  getModuleStatus: (moduleId: number) => string;
  allLessons: any[];
  // New props for module unlock
  isLastLessonInModule?: boolean;
  isLastModule?: boolean;
  nextModuleInfo?: { id: number; title: string } | null;
  onUnlockNextModule?: () => Promise<void>;
  isUnlockingModule?: boolean;
  // Course ID for certificate generation
  courseId?: number;
  // Manual completion props
  onManualComplete?: () => Promise<void>;
  canManuallyComplete?: boolean;
}

export const LessonContent: React.FC<LessonContentProps> = ({
  currentLesson,
  lessonQuiz,
  lessonAssignments,
  contentLoading,
  quizLoadError,
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
  onVideoComplete,
  onVideoProgress,
  onMixedContentVideoProgress,
  onMixedContentVideoComplete,
  moduleScoring,
  lessonScore,
  currentLessonQuizScore = 0,
  currentLessonAssignmentScore = 0,
  currentModuleId,
  currentLessonIndex,
  totalLessons,
  hasNextLesson,
  hasPrevLesson,
  onNavigate,
  onTrackInteraction,
  onReloadContent,
  onQuizComplete,
  onAssignmentSubmit,
  getModuleStatus,
  allLessons,
  // New props for module unlock
  isLastLessonInModule = false,
  isLastModule = false,
  nextModuleInfo = null,
  onUnlockNextModule,
  isUnlockingModule = false,
  // Course ID for certificate generation
  courseId,
  // Manual completion props
  onManualComplete,
  canManuallyComplete = false
}) => {
  const [isGeneratingCertificate, setIsGeneratingCertificate] = useState(false);
  const [certificateGenerated, setCertificateGenerated] = useState(false);
  const [certificateError, setCertificateError] = useState<string | null>(null);

  const handleGenerateCertificate = async () => {
    if (!courseId) return;
    
    setIsGeneratingCertificate(true);
    setCertificateError(null);
    
    try {
      const response = await StudentApiService.generateCertificate(courseId);
      if (response.success) {
        setCertificateGenerated(true);
      } else {
        // Handle specific error messages
        const errorMsg = response.message || 'Failed to generate certificate';
        const requirements = response.requirements;
        if (requirements) {
          const details = [];
          if (requirements.overall_score) details.push(`Score: ${requirements.overall_score}`);
          if (!requirements.all_modules_passing) details.push('Not all modules have passing scores');
          setCertificateError(`${errorMsg}${details.length ? ' - ' + details.join(', ') : ''}`);
        } else {
          setCertificateError(errorMsg);
        }
      }
    } catch (error: any) {
      console.error('Error generating certificate:', error);
      // Try to extract error message from response
      const errorResponse = error.response?.data;
      if (errorResponse?.requirements) {
        const req = errorResponse.requirements;
        setCertificateError(`${errorResponse.message || 'Requirements not met'} - Score: ${req.overall_score}`);
      } else {
        setCertificateError(errorResponse?.message || error.message || 'Failed to generate certificate');
      }
    } finally {
      setIsGeneratingCertificate(false);
    }
  };
  // Check if module score is passing (>= 80%)
  // Handle cases where moduleScoring might be null/undefined or still loading
  const cumulativeScore = moduleScoring?.cumulativeScore ?? 0;
  const isModulePassing = cumulativeScore >= 80;
  const isModuleScoringLoaded = moduleScoring !== null && moduleScoring !== undefined && !moduleScoring.loading;
  const canUnlockNextModule = isLastLessonInModule && isLessonCompleted && isModulePassing && nextModuleInfo && isModuleScoringLoaded;
  
  // Check if this is the last lesson of the last module (course completion)
  const isCourseComplete = isLastLessonInModule && isLastModule;
  
  // Debug logging for module unlock card
  if (isLastLessonInModule) {
    console.log('🎯 Last lesson in module - Unlock card check:', {
      isLastLessonInModule,
      isLastModule,
      isCourseComplete,
      nextModuleInfo,
      isLessonCompleted,
      cumulativeScore,
      isModulePassing,
      isModuleScoringLoaded,
      canUnlockNextModule,
      moduleScoring
    });
  }
  
  return (
    <div 
      ref={contentRef}
      className="flex-1 w-full h-[calc(100vh-4rem)] overflow-y-auto"
      onClick={() => onTrackInteraction('content_click')}
    >
      <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 xl:px-12 py-4 sm:py-6 max-w-[1600px] mx-auto">
        <div className="space-y-6">
          {/* Completed Lesson Alert */}
          {isLessonCompleted && (
            <Alert className="bg-green-900/30 border-green-700">
              <CheckCircle className="h-4 w-4 text-green-400" />
              <AlertTitle className="text-green-300">Lesson Completed!</AlertTitle>
              <AlertDescription className="text-green-200">
                You have already completed this lesson. You can review the content anytime.
              </AlertDescription>
            </Alert>
          )}

          {/* Lesson Header */}
          <div className="bg-gray-800/50 rounded-lg shadow-sm border border-gray-700 p-3 sm:p-4 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                  <h2 className="text-xl sm:text-2xl font-bold text-white break-words">
                    {currentLesson.title}
                  </h2>
                  {isLessonCompleted && (
                    <Badge className="bg-green-600 hover:bg-green-700">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Completed
                    </Badge>
                  )}
                </div>
                {currentLesson.description && (
                  <p className="text-gray-300 mb-4">{currentLesson.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                  <Badge variant="secondary" className="text-xs sm:text-sm">
                    Lesson {currentLessonIndex + 1} of {totalLessons}
                  </Badge>
                  <Badge variant={lessonScore >= 80 ? "default" : lessonScore >= 60 ? "secondary" : "destructive"}>
                    Lesson Score: {lessonScore}%
                  </Badge>
                  {moduleScoring && currentModuleId && currentModuleId > 0 && (
                    <Badge variant="outline" className="text-gray-400">
                      Module: {moduleScoring.cumulativeScore.toFixed(1)}%
                    </Badge>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2 sm:space-x-2">
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
                        disabled={!hasNextLesson || !isLessonCompleted}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      {(() => {
                        if (!isLessonCompleted) {
                          const requirements = [];
                          if (readingProgress < 80) {
                            requirements.push(`Reading progress: ${Math.round(readingProgress)}% (need 80%)`);
                          }
                          return (
                            <div className="space-y-1">
                              <p className="font-semibold text-yellow-400">Complete this lesson first</p>
                              {requirements.map((req, i) => (
                                <p key={i} className="text-xs">• {req}</p>
                              ))}
                            </div>
                          );
                        }
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

          {/* Comprehensive Lesson Score Display */}
          <LessonScoreDisplay
            readingProgress={readingProgress}
            engagementScore={engagementScore}
            quizScore={currentLessonQuizScore}
            assignmentScore={currentLessonAssignmentScore}
            lessonScore={lessonScore}
            hasQuiz={!!lessonQuiz}
            hasAssignment={lessonAssignments && lessonAssignments.length > 0}
          />

          {/* Learning Interface Tabs */}
          <div className="bg-gray-800/50 rounded-lg shadow-sm border border-gray-700">
            <Tabs value={currentViewMode} onValueChange={(value: any) => setCurrentViewMode(value)}>
              <div className="border-b px-3 sm:px-6 py-2 sm:py-3 overflow-x-auto">
                <TabsList className="grid w-full grid-cols-4 min-w-[320px] sm:min-w-0 sm:max-w-2xl">
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

              <TabsContent value="content" className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
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
                  onVideoProgress={onVideoProgress}
                  onVideoComplete={onVideoComplete}
                  onMixedContentVideoProgress={onMixedContentVideoProgress}
                  onMixedContentVideoComplete={onMixedContentVideoComplete}
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
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-center">
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
                      
                      {/* Last Lesson in Module - Show Unlock Next Module Button */}
                      {isLastLessonInModule && nextModuleInfo && (
                        <div className="mt-6 pt-4 border-t border-green-700/50">
                          {!isModuleScoringLoaded ? (
                            // Module scoring is still loading
                            <div className="flex items-center justify-center space-x-2 text-gray-400 py-2">
                              <Loader2 className="h-5 w-5 animate-spin" />
                              <span className="text-sm">Calculating module score...</span>
                            </div>
                          ) : canUnlockNextModule ? (
                            <div className="space-y-4">
                              <div className="flex items-center justify-center space-x-2 text-green-300">
                                <Sparkles className="h-5 w-5" />
                                <span className="font-semibold">Module Complete! Score: {cumulativeScore.toFixed(1)}%</span>
                                <Sparkles className="h-5 w-5" />
                              </div>
                              <Button
                                onClick={onUnlockNextModule}
                                disabled={isUnlockingModule}
                                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 text-lg shadow-lg"
                                size="lg"
                              >
                                {isUnlockingModule ? (
                                  <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Unlocking Module...
                                  </>
                                ) : (
                                  <>
                                    <Unlock className="mr-2 h-5 w-5" />
                                    Unlock Next Module: {nextModuleInfo.title}
                                  </>
                                )}
                              </Button>
                            </div>
                          ) : isLessonCompleted && !isModulePassing ? (
                            <div className="space-y-3">
                              <div className="flex items-center justify-center space-x-2 text-yellow-400">
                                <AlertCircle className="h-5 w-5" />
                                <span className="font-medium">Module Score: {cumulativeScore.toFixed(1)}% (Need 80% to unlock next)</span>
                              </div>
                              <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-3">
                                <p className="text-yellow-300 text-sm text-center">
                                  Complete quizzes and assignments to improve your module score and unlock the next module.
                                </p>
                              </div>
                            </div>
                          ) : (
                            // Fallback: Show module status even if not passing
                            <div className="flex items-center justify-center space-x-2 text-blue-400 py-2">
                              <Target className="h-5 w-5" />
                              <span className="text-sm">Module Score: {cumulativeScore.toFixed(1)}%</span>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Last Lesson of Last Module (Course Complete) */}
                      {isLastLessonInModule && isLastModule && !nextModuleInfo && (
                        <div className="mt-6 pt-4 border-t border-green-700/50">
                          {!isModuleScoringLoaded ? (
                            <div className="flex items-center justify-center space-x-2 text-gray-400 py-2">
                              <Loader2 className="h-5 w-5 animate-spin" />
                              <span className="text-sm">Calculating final module score...</span>
                            </div>
                          ) : isModulePassing ? (
                            <div className="space-y-4">
                              <div className="flex items-center justify-center space-x-2 text-yellow-300">
                                <Trophy className="h-6 w-6 text-yellow-400" />
                                <span className="font-bold text-lg">🎉 Course Complete!</span>
                                <Trophy className="h-6 w-6 text-yellow-400" />
                              </div>
                              <div className="text-center space-y-2">
                                <p className="text-green-300">
                                  Final Module Score: <span className="font-bold">{cumulativeScore.toFixed(1)}%</span>
                                </p>
                                <p className="text-gray-400 text-sm">
                                  Congratulations! You have completed all modules in this course.
                                </p>
                              </div>
                              
                              {/* Certificate Generation Section */}
                              <div className="mt-4 pt-4 border-t border-green-700/50">
                                {certificateError && (
                                  <div className="mb-3 p-2 bg-red-900/30 border border-red-700/50 rounded-lg">
                                    <p className="text-red-300 text-sm text-center">{certificateError}</p>
                                  </div>
                                )}
                                
                                {certificateGenerated ? (
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-center space-x-2 text-green-300">
                                      <CheckCircle className="h-5 w-5" />
                                      <span className="text-sm">Certificate generated successfully!</span>
                                    </div>
                                    <Link href="/student/certificates">
                                      <Button 
                                        className="w-full bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white font-semibold"
                                      >
                                        <Award className="h-5 w-5 mr-2" />
                                        View Your Certificates
                                      </Button>
                                    </Link>
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    <Button 
                                      onClick={handleGenerateCertificate}
                                      disabled={isGeneratingCertificate || !courseId}
                                      className="w-full bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white font-semibold disabled:opacity-50"
                                    >
                                      {isGeneratingCertificate ? (
                                        <>
                                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                          Generating Certificate...
                                        </>
                                      ) : (
                                        <>
                                          <GraduationCap className="h-5 w-5 mr-2" />
                                          Get Your Certificate
                                        </>
                                      )}
                                    </Button>
                                    <p className="text-gray-500 text-xs text-center">
                                      Or view all certificates in your{' '}
                                      <Link href="/student/certificates" className="text-yellow-400 hover:underline">
                                        profile
                                      </Link>
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="flex items-center justify-center space-x-2 text-yellow-400">
                                <AlertCircle className="h-5 w-5" />
                                <span className="font-medium">Final Module Score: {cumulativeScore.toFixed(1)}% (Need 80% to complete)</span>
                              </div>
                              <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-3">
                                <p className="text-yellow-300 text-sm text-center">
                                  Complete all quizzes and assignments to achieve a passing score and complete the course.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
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
                      
                      {/* Manual Completion Button */}
                      {canManuallyComplete && onManualComplete && (
                        <div className="mt-6 pt-4 border-t border-blue-700/50">
                          <div className="space-y-3">
                            <div className="flex items-center justify-center space-x-2 text-green-300">
                              <CheckCircle className="h-5 w-5" />
                              <span className="font-medium text-sm">All requirements met!</span>
                            </div>
                            <Button
                              onClick={onManualComplete}
                              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 shadow-lg"
                              size="lg"
                            >
                              <CheckCircle className="mr-2 h-5 w-5" />
                              Mark as Complete
                            </Button>
                            <p className="text-xs text-center text-gray-400">
                              Score: {Math.round(lessonScore)}% • Reading: {Math.round(readingProgress)}% • Engagement: {Math.round(engagementScore)}%
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {/* Requirements not met message */}
                      {!canManuallyComplete && lessonScore >= 60 && (
                        <div className="mt-6 pt-4 border-t border-yellow-700/50">
                          <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-3">
                            <p className="text-yellow-300 text-sm text-center">
                              {lessonScore < 80 ? `Keep learning! Current score: ${Math.round(lessonScore)}% (need 80%)` : ''}
                              {lessonQuiz && (lessonQuiz.best_score ?? 0) < (lessonQuiz.passing_score || 70) ? ` • Complete the quiz with ${lessonQuiz.passing_score || 70}%+` : ''}
                              {lessonAssignments && lessonAssignments.length > 0 && lessonAssignments.some((a: any) => !a.submission_status?.score) ? ' • Submit and get graded on all assignments' : ''}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
              </TabsContent>

              <TabsContent value="quiz" className="p-3 sm:p-4 md:p-6">
                {contentLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                    <span className="ml-2 text-gray-300">Loading quiz...</span>
                  </div>
                ) : quizLoadError ? (
                  <Alert className="border-red-700 bg-red-900/30">
                    <AlertCircle className="h-4 w-4 text-red-400" />
                    <AlertTitle className="text-red-300">Failed to Load Quiz</AlertTitle>
                    <AlertDescription className="text-red-200">
                      <p className="mb-3">{quizLoadError}</p>
                      {onReloadContent && (
                        <Button 
                          onClick={onReloadContent}
                          variant="outline" 
                          size="sm"
                          className="border-red-600 text-red-300 hover:bg-red-900/50"
                        >
                          <Loader2 className="h-4 w-4 mr-2" />
                          Try Again
                        </Button>
                      )}
                    </AlertDescription>
                  </Alert>
                ) : lessonQuiz ? (
                  <div key={`quiz-${lessonQuiz.id}-${lessonQuiz.attempts_used || 0}`}>
                    <QuizAttemptTracker
                      quiz={lessonQuiz}
                      onStartQuiz={() => onTrackInteraction('quiz_started', { quizId: lessonQuiz.id })}
                      onSubmitQuiz={(answers) => {
                        onTrackInteraction('quiz_submitted', { quizId: lessonQuiz.id, answers });
                      }}
                      onQuizComplete={(score, passed) => {
                        onTrackInteraction('quiz_completed', { 
                          quizId: lessonQuiz.id, 
                          score, 
                          passed 
                        });
                        // Update quiz score in parent component
                        if (onQuizComplete) {
                          onQuizComplete(score, passed);
                        }
                        // Reload content to refresh attempt count
                        if (onReloadContent) {
                          setTimeout(() => onReloadContent(), 1000);
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">No Quiz Available</h3>
                    <p className="text-gray-300 mb-4">
                      This lesson doesn't have an associated quiz.
                    </p>
                    {onReloadContent && (
                      <Button 
                        onClick={onReloadContent}
                        variant="outline" 
                        size="sm"
                        className="border-gray-600 text-gray-300 hover:bg-gray-700"
                      >
                        <Loader2 className="h-4 w-4 mr-2" />
                        Refresh
                      </Button>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="assignments" className="p-3 sm:p-4 md:p-6">
                {contentLoading && lessonAssignments.length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                    <span className="ml-2 text-gray-300">Loading assignments...</span>
                  </div>
                ) : lessonAssignments && lessonAssignments.length > 0 ? (
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
                        }}
                        onSubmitComplete={() => {
                          onTrackInteraction('assignment_completed', {
                            assignmentId: assignment.id
                          });
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

              <TabsContent value="notes" className="p-3 sm:p-4 md:p-6">
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

          {/* Completion Requirements Alert */}
          {!isLessonCompleted && hasNextLesson && (
            <Alert className="border-yellow-700 bg-yellow-900/30">
              <AlertCircle className="h-4 w-4 text-yellow-400" />
              <AlertTitle className="text-yellow-300 font-semibold">Complete This Lesson to Continue</AlertTitle>
              <AlertDescription className="text-yellow-200/90 space-y-2 mt-2">
                <p>You need to complete the following before moving to the next lesson:</p>
                <ul className="list-none space-y-1 mt-2">
                  {readingProgress < 80 && (
                    <li className="flex items-start space-x-2">
                      <Lock className="h-4 w-4 mt-0.5 flex-shrink-0 text-yellow-400" />
                      <span>
                        <strong>Reading Progress:</strong> {Math.round(readingProgress)}% complete
                        <span className="text-yellow-300/70"> (minimum 80% required)</span>
                      </span>
                    </li>
                  )}
                  {lessonQuiz && (
                    <li className="flex items-start space-x-2">
                      <FileText className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-400" />
                      <span>
                        <strong>Quiz:</strong> Complete the lesson quiz
                        <button
                          onClick={() => setCurrentViewMode('quiz')}
                          className="ml-2 text-blue-300 underline hover:text-blue-200"
                        >
                          Take Quiz →
                        </button>
                      </span>
                    </li>
                  )}
                  {lessonAssignments.length > 0 && (
                    <li className="flex items-start space-x-2">
                      <Clipboard className="h-4 w-4 mt-0.5 flex-shrink-0 text-purple-400" />
                      <span>
                        <strong>Assignments:</strong> Submit {lessonAssignments.length} assignment{lessonAssignments.length > 1 ? 's' : ''}
                        <button
                          onClick={() => setCurrentViewMode('assignments')}
                          className="ml-2 text-purple-300 underline hover:text-purple-200"
                        >
                          View Assignments →
                        </button>
                      </span>
                    </li>
                  )}
                </ul>
                <p className="text-xs text-yellow-200/70 mt-3 italic">
                  💡 Tip: Continue reading and interacting with the lesson content. Progress is tracked automatically.
                </p>
              </AlertDescription>
            </Alert>
          )}

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
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Button
                        onClick={() => onNavigate('next')}
                        disabled={!hasNextLesson || !isLessonCompleted}
                        className="flex items-center space-x-2"
                      >
                        {!isLessonCompleted && hasNextLesson ? (
                          <Lock className="h-4 w-4" />
                        ) : null}
                        <span>Next Lesson</span>
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    {!isLessonCompleted && hasNextLesson
                      ? 'Complete this lesson first'
                      : !hasNextLesson
                      ? 'No more lessons available'
                      : 'Continue to next lesson'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
