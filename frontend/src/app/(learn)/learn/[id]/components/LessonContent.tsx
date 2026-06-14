import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';import { motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Trophy, Brain, CheckCircle, Target, Zap,
  FileText, Clipboard, Play, Clock, Award, ExternalLink, Download,
  PenTool, Loader2, AlertCircle, Lock, Unlock, Sparkles, GraduationCap,
  Star, Flame, BookOpen, Maximize2, Minimize2
} from 'lucide-react';
import Link from 'next/link';
import { StudentApiService } from '@/services/studentApi';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ViewMode } from '../types';
import type { ContentQuiz, ContentAssignment } from '@/services/contentAssignmentApi';
import { ContentRichPreview } from './ContentRichPreview';
import { QuizAttemptTracker } from './QuizAttemptTracker';
import { AssignmentPanel } from './AssignmentPanel';
import { LessonScoreDisplay, getLevel } from './LessonScoreDisplay';
import { CollapsibleCard } from './CollapsibleCard';

// Helper function to format time in MM:SS format
const formatTime = (seconds: number): string => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

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
  notesSaveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  contentRef?: any;
  onVideoComplete?: () => void;
  onVideoProgress?: (progress: number, currentTime?: number, duration?: number) => void;
  onMixedContentVideoProgress?: (videoIndex: number, progress: number) => void;
  onMixedContentVideoComplete?: (videoIndex: number) => void;
  // Video progress tracking
  videoProgress?: number;
  videoCurrentTime?: number;
  videoDuration?: number;
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
  // Section-based progress tracking
  onSectionProgress?: (viewedSections: number, totalSections: number) => void;
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
  notesSaveStatus = 'idle',
  contentRef,
  onVideoComplete,
  onVideoProgress,
  onMixedContentVideoProgress,
  onMixedContentVideoComplete,
  videoProgress = 0,
  videoCurrentTime = 0,
  videoDuration = 0,
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
  canManuallyComplete = false,
  // Section-based progress tracking
  onSectionProgress
}) => {
  const [isGeneratingCertificate, setIsGeneratingCertificate] = useState(false);
  // Collapsible card states - all start collapsed except main content
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({
    content: true,    // main lesson content - expanded by default
    header: false,    // lesson header (title, stats, progress) - collapsed by default
    progress: false,  // progress/completed card - collapsed, auto-expands on completion
    requirements: false, // completion requirements
    nav: true,        // navigation footer - expanded by default
  });

  // Fullscreen state for content card
  const [contentFullscreen, setContentFullscreen] = useState(false);

  // Auto-expand progress card on lesson completion
  useEffect(() => {
    if (isLessonCompleted) {
      setExpandedCards(prev => ({ ...prev, progress: true }));
    }
  }, [isLessonCompleted]);
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
  
  // Gamified level based on lesson score
  const lessonLevel = getLevel(Math.round(lessonScore));

  // Which tabs are available for this lesson
  const hasQuiz = !!lessonQuiz;
  const hasAssignments = lessonAssignments && lessonAssignments.length > 0;

  // Reading completion detection for quiz/assignment prompt
  const readingComplete = readingProgress >= 80;
  const quizNotAttempted = hasQuiz && (!lessonQuiz?.best_score || lessonQuiz.best_score === 0);
  const assignmentsNotSubmitted = hasAssignments && lessonAssignments.some(
    (a: any) => !a.submission_status?.score
  );
  const showQuizAssignPrompt = readingComplete && !isLessonCompleted && (quizNotAttempted || assignmentsNotSubmitted);

  // Check if this is the last lesson of the last module (course completion)
  const isCourseComplete = isLastLessonInModule && isLastModule;
  
  // Exit fullscreen on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && contentFullscreen) {
        setContentFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [contentFullscreen]);

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
  
  // ── Dedicated Assignment View ──────────────────────────────────────────
  // When the assignments tab is active, render a clean, focused view with
  // only the assignment panel(s) and a back button — no lesson header,
  // progress bars, score display, or footer navigation.
  if (currentViewMode === 'assignments') {
    return (
      <div
        ref={contentRef}
        className="flex-1 w-full h-[calc(100vh-4rem)] overflow-y-auto"
        onClick={() => onTrackInteraction('content_click')}
      >
        <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 xl:px-12 py-4 sm:py-6 max-w-[1600px] mx-auto">
          <div className="space-y-6">
            {/* Back to lesson content */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentViewMode('content')}
                className="flex items-center gap-2 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back to Lesson</span>
                <span className="sm:hidden">Back</span>
              </Button>

              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Clipboard className="h-4 w-4 text-green-400" />
                <span className="hidden sm:inline font-medium">{currentLesson.title}</span>
              </div>
            </div>

            {/* Assignment content */}
            {contentLoading && lessonAssignments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-10 w-10 animate-spin text-green-400 mb-3" />
                <span className="text-gray-300 text-sm">Loading assignments...</span>
              </div>
            ) : lessonAssignments && lessonAssignments.length > 0 ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl sm:text-2xl font-bold text-white">Lesson Assignments</h3>
                    <p className="text-gray-400 mt-1 text-sm sm:text-base">
                      Complete these assignments to apply what you&apos;ve learned
                    </p>
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
              <div className="text-center py-16">
                <Clipboard className="h-14 w-14 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No Assignments</h3>
                <p className="text-gray-400 mb-6">This lesson doesn&apos;t have any assignments yet.</p>
                <Button
                  variant="outline"
                  onClick={() => setCurrentViewMode('content')}
                  className="border-gray-700 text-gray-300 hover:bg-gray-700"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Return to Lesson Content
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
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

          {/* Gamified Lesson Header */}
          <CollapsibleCard
            title="Lesson Overview"
            icon={<BookOpen className="h-4 w-4 text-blue-400" />}
            expanded={expandedCards.header}
            onToggle={(open) => setExpandedCards(prev => ({ ...prev, header: open }))}
            badge={<span className="text-[10px] text-gray-400 font-mono">{Math.round(readingProgress)}%</span>}
          >
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className={`relative overflow-hidden rounded-2xl border border-gray-800/80 bg-gradient-to-br ${lessonLevel.twGradient} bg-gray-900/70 backdrop-blur-sm p-4 sm:p-5`}
          >
            {/* Subtle ambient glow */}
            <div className="pointer-events-none absolute -inset-1 opacity-20 blur-2xl">
              <div
                className="h-full w-full rounded-full"
                style={{ backgroundColor: `${lessonLevel.cssColor}1a` }}
              />
            </div>

            <div className="relative z-10 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                  <h2 className="text-xl sm:text-2xl font-bold text-white break-words">
                    {currentLesson.title}
                  </h2>
                  {isLessonCompleted && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, delay: 0.2 }}
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-400 ring-1 ring-emerald-500/30"
                    >
                      <Sparkles className="h-3 w-3" />
                      COMPLETE
                    </motion.span>
                  )}
                </div>
                {currentLesson.description && (
                  <p className="text-gray-300/80 mb-4 text-sm sm:text-base">{currentLesson.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Lesson X of Y pill */}
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-800/70 px-2.5 py-1 text-[11px] font-semibold text-gray-300 ring-1 ring-gray-700">
                    <BookOpen className="h-3 w-3 text-blue-400" />
                    Lesson {currentLessonIndex + 1} of {totalLessons}
                  </span>

                  {/* Score pill — uses level color */}
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1"
                    style={{
                      backgroundColor: `${lessonLevel.cssColor}1a`,
                      color: lessonLevel.cssColor,
                      borderColor: `${lessonLevel.cssColor}40`,
                    }}
                  >
                    <Star className="h-3 w-3" />
                    Score: {lessonScore}%
                  </span>

                  {/* Module score pill */}
                  {moduleScoring && currentModuleId && currentModuleId > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-800/70 px-2.5 py-1 text-[11px] font-semibold text-gray-300 ring-1 ring-gray-700">
                      <Flame className="h-3 w-3 text-orange-400" />
                      Module: {moduleScoring.cumulativeScore.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>

              {/* Navigation buttons — styled to match */}
              <div className="flex items-center gap-2 shrink-0 self-start">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onNavigate('prev')}
                        disabled={!hasPrevLesson}
                        className="flex items-center justify-center h-8 w-8 rounded-lg border border-gray-700 bg-gray-800/50 text-gray-400 hover:bg-gray-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 transition-all"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </button>
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
                      <button
                        onClick={() => onNavigate('next')}
                        disabled={!hasNextLesson || !isLessonCompleted}
                        className="flex items-center justify-center h-8 w-8 rounded-lg border border-gray-700 bg-gray-800/50 text-gray-400 hover:bg-gray-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 transition-all"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </button>
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

            {/* XP-style Reading Progress */}
            <div className="relative z-10 mt-4">
              <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                <div className="flex items-center gap-1">
                  <BookOpen className="h-3 w-3" style={{ color: lessonLevel.cssColor }} />
                  <span>Reading Progress</span>
                </div>
                <span className="font-mono tabular-nums" style={{ color: lessonLevel.cssColor }}>
                  {Math.round(readingProgress)}%
                </span>
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-gray-800/70">
                <motion.div
                  className={`h-full rounded-full bg-gradient-to-r ${lessonLevel.twGradient} shadow-sm`}
                  initial={{ width: '0%' }}
                  animate={{ width: `${Math.min(readingProgress, 100)}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
                <div className="absolute inset-0 animate-pulse rounded-full bg-white/[0.03]" />
              </div>
            </div>

            {/* Divider */}
            <div className="relative z-10 mt-4 border-t border-gray-800/60" />

            {/* Score Display (inline — no outer wrapper) */}
            <div className="relative z-10 mt-3">
              <LessonScoreDisplay
                readingProgress={readingProgress}
                engagementScore={engagementScore}
                quizScore={currentLessonQuizScore}
                assignmentScore={currentLessonAssignmentScore}
                lessonScore={lessonScore}
                hasQuiz={!!lessonQuiz}
                hasAssignment={lessonAssignments && lessonAssignments.length > 0}
                variant="inline"
              />
            </div>
          </motion.div>
          </CollapsibleCard>

          {/* Gamified Learning Interface Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut', delay: 0.15 }}
            className="rounded-2xl border border-gray-800/80 bg-gray-900/70 backdrop-blur-sm overflow-hidden"
          >
            <Tabs value={currentViewMode} onValueChange={(value: any) => setCurrentViewMode(value)}>
              <div className="px-3 sm:px-4 pt-3 pb-0 overflow-x-auto">
                <TabsList className="flex w-full gap-1.5 bg-transparent p-0">
                  {/* Content — always visible */}
                  <TabsTrigger
                    value="content"
                    className={`flex items-center gap-1.5 px-3.5 py-2 text-[11px] font-semibold rounded-lg transition-all duration-200
                      data-[state=active]:shadow-sm
                      text-gray-400 hover:text-gray-200 hover:bg-gray-800/40
                      ${currentViewMode === 'content' ? 'bg-gray-800/80 text-white' : 'bg-transparent'}`}
                    style={currentViewMode === 'content' ? {
                      backgroundColor: `${lessonLevel.cssColor}18`,
                      color: lessonLevel.cssColor,
                    } : undefined}
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    <span>Content</span>
                  </TabsTrigger>

                  {/* Quiz — only if this lesson has a quiz */}
                  {hasQuiz && (
                    <TabsTrigger
                      value="quiz"
                      className={`flex items-center gap-1.5 px-3.5 py-2 text-[11px] font-semibold rounded-lg transition-all duration-200
                        data-[state=active]:shadow-sm
                        text-gray-400 hover:text-gray-200 hover:bg-gray-800/40
                        ${currentViewMode === 'quiz' ? 'bg-gray-800/80 text-white' : 'bg-transparent'}`}
                      style={currentViewMode === 'quiz' ? {
                        backgroundColor: `${lessonLevel.cssColor}18`,
                        color: lessonLevel.cssColor,
                      } : undefined}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>Quiz</span>
                    </TabsTrigger>
                  )}

                  {/* Assignments — only if this lesson has assignments */}
                  {hasAssignments && (
                    <TabsTrigger
                      value="assignments"
                      className={`flex items-center gap-1.5 px-3.5 py-2 text-[11px] font-semibold rounded-lg transition-all duration-200
                        data-[state=active]:shadow-sm
                        text-gray-400 hover:text-gray-200 hover:bg-gray-800/40
                        ${currentViewMode === 'assignments' ? 'bg-gray-800/80 text-white' : 'bg-transparent'}`}
                      style={currentViewMode === 'assignments' ? {
                        backgroundColor: `${lessonLevel.cssColor}18`,
                        color: lessonLevel.cssColor,
                      } : undefined}
                    >
                      <Clipboard className="h-3.5 w-3.5" />
                      <span>Assignments</span>
                    </TabsTrigger>
                  )}

                  {/* Notes — always visible */}
                  <TabsTrigger
                    value="notes"
                    className={`flex items-center gap-1.5 px-3.5 py-2 text-[11px] font-semibold rounded-lg transition-all duration-200
                      data-[state=active]:shadow-sm
                      text-gray-400 hover:text-gray-200 hover:bg-gray-800/40
                      ${currentViewMode === 'notes' ? 'bg-gray-800/80 text-white' : 'bg-transparent'}`}
                    style={currentViewMode === 'notes' ? {
                      backgroundColor: `${lessonLevel.cssColor}18`,
                      color: lessonLevel.cssColor,
                    } : undefined}
                  >
                    <PenTool className="h-3.5 w-3.5" />
                    <span>Notes</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="content" className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
                {/* Enhanced Content Viewer with Rich Media Support */}
                <CollapsibleCard
                  title="Lesson Content"
                  icon={<BookOpen className="h-4 w-4" />}
                  expanded={expandedCards.content}
                  onToggle={(open) => setExpandedCards(prev => ({ ...prev, content: open }))}
                  actions={
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setContentFullscreen(true);
                      }}
                      className="flex items-center justify-center h-7 w-7 rounded-lg border border-gray-700 bg-gray-800/50 text-gray-400 hover:bg-gray-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 transition-all"
                      title="Fullscreen"
                      aria-label="View content in fullscreen"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </button>
                  }
                >
                {!contentFullscreen && (
                <ContentRichPreview
                  key={currentLesson.id ?? currentLessonIndex}
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
                  onSectionProgress={onSectionProgress}
                  hasQuiz={hasQuiz}
                  hasAssignments={hasAssignments}
                  isLessonCompleted={isLessonCompleted}
                  onSwitchToQuiz={() => setCurrentViewMode('quiz')}
                  onSwitchToAssignment={() => setCurrentViewMode('assignments')}
                  onGoToNextLesson={() => onNavigate('next')}
                />
                )}
                </CollapsibleCard>

                {/* Video Progress Card - Only show for video content */}
                {currentLesson.content_type === 'video' && videoDuration > 0 && (
                  <CollapsibleCard
                    title="Video Progress"
                    icon={<Play className="h-4 w-4 text-blue-400" />}
                    defaultExpanded={false}
                    badge={<span className="text-[10px] text-gray-400 font-mono">{Math.round(videoProgress)}%</span>}
                  >
                  <Card className="bg-gray-800/50 border-gray-700">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <Play className="h-5 w-5 text-blue-400" />
                          <span className="font-medium text-white">Video Progress</span>
                        </div>
                        <span className="text-sm text-gray-400">
                          {Math.round(videoProgress)}% watched
                        </span>
                      </div>
                      
                      {/* Progress Bar */}
                      <Progress value={videoProgress} className="h-2 mb-2" />
                      
                      {/* Time Display */}
                      <div className="flex items-center justify-between text-sm text-gray-400">
                        <span>{formatTime(videoCurrentTime)}</span>
                        <span>{formatTime(videoDuration)}</span>
                      </div>
                    </CardContent>
                  </Card>
                  </CollapsibleCard>
                )}

                {/* Progress Status */}
                <CollapsibleCard
                  title={isLessonCompleted ? "Lesson Complete! 🎉" : "Progress & Stats"}
                  icon={isLessonCompleted ? <Trophy className="h-4 w-4 text-emerald-400" /> : <Target className="h-4 w-4 text-blue-400" />}
                  expanded={expandedCards.progress}
                  onToggle={(open) => setExpandedCards(prev => ({ ...prev, progress: open }))}
                  badge={
                    isLessonCompleted
                      ? <span className="text-[10px] font-bold text-emerald-400">{Math.round(lessonScore)}%</span>
                      : <span className="text-[10px] text-blue-400 font-mono">{Math.round(lessonScore)}%</span>
                  }
                >
                {isLessonCompleted ? (
                    <motion.div
                      initial={{ opacity: 0, y: 16, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className="relative overflow-hidden rounded-2xl border border-emerald-800/60 bg-gradient-to-br from-emerald-900/40 via-emerald-800/20 to-teal-900/30 bg-gray-900/70 backdrop-blur-sm p-4 sm:p-5"
                    >
                      {/* Ambient glow */}
                      <div className="pointer-events-none absolute -inset-1 opacity-20 blur-3xl">
                        <div className="h-full w-full rounded-full bg-emerald-500/20" />
                      </div>

                      <div className="relative z-10">
                        {/* Header with Trophy */}
                        <div className="flex items-center gap-3 mb-4">
                          <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                            className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-600/30"
                          >
                            <Trophy className="h-6 w-6 text-white" />
                          </motion.div>
                          <div>
                            <h4 className="font-semibold text-emerald-300 text-lg">Lesson Completed!</h4>
                            <p className="text-emerald-200/70 text-sm">
                              Excellent work! You scored {lessonScore}% on this lesson.
                            </p>
                          </div>
                        </div>

                        {/* XP-style stat cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                          <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15 }}
                            className="rounded-xl border border-emerald-700/40 bg-emerald-900/20 p-3 text-center"
                          >
                            <div className="text-lg font-bold text-emerald-300">
                              {Math.floor(timeSpent / 60)}m {timeSpent % 60}s
                            </div>
                            <div className="flex items-center justify-center gap-1 text-[10px] text-emerald-400/70 mt-0.5">
                              <Clock className="h-3 w-3" />
                              Time Spent
                            </div>
                          </motion.div>
                          <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="rounded-xl border border-emerald-700/40 bg-emerald-900/20 p-3 text-center"
                          >
                            <div className="text-lg font-bold text-emerald-300">
                              {Math.round(engagementScore)}%
                            </div>
                            <div className="flex items-center justify-center gap-1 text-[10px] text-emerald-400/70 mt-0.5">
                              <Zap className="h-3 w-3" />
                              Engagement
                            </div>
                          </motion.div>
                          <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.25 }}
                            className="rounded-xl border border-emerald-700/40 bg-emerald-900/20 p-3 text-center"
                          >
                            <div className="text-lg font-bold text-emerald-300">
                              {Math.round(readingProgress)}%
                            </div>
                            <div className="flex items-center justify-center gap-1 text-[10px] text-emerald-400/70 mt-0.5">
                              <BookOpen className="h-3 w-3" />
                              Reading
                            </div>
                          </motion.div>
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
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, ease: 'easeOut', delay: 0.2 }}
                      className={`relative overflow-hidden rounded-2xl border border-gray-800/80 bg-gradient-to-br ${lessonLevel.twGradient} bg-gray-900/70 backdrop-blur-sm p-4 sm:p-5`}
                    >
                      {/* Ambient glow */}
                      <div className="pointer-events-none absolute -inset-1 opacity-15 blur-2xl">
                        <div
                          className="h-full w-full rounded-full"
                          style={{ backgroundColor: `${lessonLevel.cssColor}1a` }}
                        />
                      </div>

                      <div className="relative z-10">
                        {/* ── Gamified Header with Level Badge ── */}
                        <div className="flex items-start gap-4 mb-5">
                          {/* Level badge ring */}
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                            className="relative shrink-0"
                          >
                            <div
                              className="h-14 w-14 rounded-2xl flex items-center justify-center shadow-lg"
                              style={{
                                background: `linear-gradient(135deg, ${lessonLevel.cssColor}30, ${lessonLevel.cssColor}10)`,
                                borderColor: `${lessonLevel.cssColor}40`,
                                borderWidth: '1px',
                              }}
                            >
                              <motion.div
                                animate={{ rotate: [0, -5, 5, -5, 0] }}
                                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                              >
                                <Brain className="h-7 w-7" style={{ color: lessonLevel.cssColor }} />
                              </motion.div>
                              {/* Level initial badge */}
                              <div
                                className="absolute -top-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-bold shadow"
                                style={{ backgroundColor: lessonLevel.cssColor, color: '#fff' }}
                              >
                                {lessonLevel.label[0]}
                              </div>
                            </div>
                          </motion.div>

                          {/* Title and level info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <h4 className="text-base font-bold" style={{ color: lessonLevel.cssColor }}>
                                Keep Learning!
                              </h4>
                              <motion.span
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3 }}
                                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                                style={{
                                  backgroundColor: `${lessonLevel.cssColor}18`,
                                  color: lessonLevel.cssColor,
                                  border: `1px solid ${lessonLevel.cssColor}30`,
                                }}
                              >
                                <lessonLevel.icon className="h-3 w-3" />
                                {lessonLevel.label}
                              </motion.span>
                            </div>
                            <p className="text-gray-400 text-xs mt-1 leading-relaxed">
                              Continue reading and engaging with content to complete this lesson.
                            </p>
                          </div>
                        </div>

                        {/* ── RPG-style Stat Cards with Animated Counters ── */}
                        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
                          {/* Reading */}
                          <motion.div
                            whileHover={{ scale: 1.05, y: -3 }}
                            className="group relative overflow-hidden rounded-xl border border-gray-700/50 bg-gray-900/50 p-3 text-center transition-all duration-200"
                            style={{
                              boxShadow: readingProgress >= 80 ? `0 0 12px ${lessonLevel.cssColor}20` : 'none',
                            }}
                          >
                            {/* Hover radial glow */}
                            <div
                              className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                              style={{
                                background: `radial-gradient(ellipse at center, ${lessonLevel.cssColor}15 0%, transparent 70%)`,
                              }}
                            />
                            <div className="relative z-10">
                              <motion.div
                                className="text-xl font-black tabular-nums"
                                style={{ color: lessonLevel.cssColor }}
                                initial={{ opacity: 0, y: 8, scale: 0.8 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ delay: 0.3, type: 'spring', stiffness: 150, damping: 12 }}
                                key={Math.round(readingProgress)}
                              >
                                {Math.round(readingProgress)}%
                              </motion.div>
                              <div className="flex items-center justify-center gap-1 text-[10px] mt-0.5">
                                <BookOpen className="h-3 w-3" style={{ color: lessonLevel.cssColor }} />
                                <span className="font-medium text-gray-400">Reading</span>
                              </div>
                              {/* Mini progress bar */}
                              <div className="mt-1.5 h-1 rounded-full bg-gray-800/80 overflow-hidden">
                                <motion.div
                                  className="h-full rounded-full"
                                  style={{ backgroundColor: lessonLevel.cssColor }}
                                  initial={{ width: '0%' }}
                                  animate={{ width: `${Math.min(readingProgress, 100)}%` }}
                                  transition={{ duration: 1, ease: 'easeOut', delay: 0.5 }}
                                />
                              </div>
                            </div>
                          </motion.div>

                          {/* Engagement */}
                          <motion.div
                            whileHover={{ scale: 1.05, y: -3 }}
                            className="group relative overflow-hidden rounded-xl border border-gray-700/50 bg-gray-900/50 p-3 text-center transition-all duration-200"
                          >
                            <div
                              className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"
                              style={{
                                background: `radial-gradient(ellipse at center, rgba(52,211,153,0.15) 0%, transparent 70%)`,
                              }}
                            />
                            <div className="relative z-10">
                              <motion.div
                                className="text-xl font-black tabular-nums"
                                style={{ color: '#34d399' }}
                                initial={{ opacity: 0, y: 8, scale: 0.8 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ delay: 0.35, type: 'spring', stiffness: 150, damping: 12 }}
                                key={Math.round(engagementScore)}
                              >
                                {Math.round(engagementScore)}%
                              </motion.div>
                              <div className="flex items-center justify-center gap-1 text-[10px] mt-0.5">
                                <Zap className="h-3 w-3 text-green-400" />
                                <span className="font-medium text-gray-400">Engagement</span>
                              </div>
                              <div className="mt-1.5 h-1 rounded-full bg-gray-800/80 overflow-hidden">
                                <motion.div
                                  className="h-full rounded-full bg-green-400"
                                  initial={{ width: '0%' }}
                                  animate={{ width: `${Math.min(engagementScore, 100)}%` }}
                                  transition={{ duration: 1, ease: 'easeOut', delay: 0.55 }}
                                />
                              </div>
                            </div>
                          </motion.div>

                          {/* Time */}
                          <motion.div
                            whileHover={{ scale: 1.05, y: -3 }}
                            className="group relative overflow-hidden rounded-xl border border-gray-700/50 bg-gray-900/50 p-3 text-center transition-all duration-200"
                          >
                            <div
                              className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"
                              style={{
                                background: `radial-gradient(ellipse at center, rgba(251,146,60,0.15) 0%, transparent 70%)`,
                              }}
                            />
                            <div className="relative z-10">
                              <motion.div
                                className="text-xl font-black tabular-nums"
                                style={{ color: '#fb923c' }}
                                initial={{ opacity: 0, y: 8, scale: 0.8 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ delay: 0.4, type: 'spring', stiffness: 150, damping: 12 }}
                                key={Math.floor(timeSpent / 60)}
                              >
                                {Math.floor(timeSpent / 60)}m
                              </motion.div>
                              <div className="flex items-center justify-center gap-1 text-[10px] mt-0.5">
                                <Clock className="h-3 w-3 text-orange-400" />
                                <span className="font-medium text-gray-400">Time</span>
                              </div>
                              <div className="mt-1.5 h-1 rounded-full bg-gray-800/80 overflow-hidden">
                                <motion.div
                                  className="h-full rounded-full bg-orange-400"
                                  initial={{ width: '0%' }}
                                  animate={{ width: `${Math.min((timeSpent / 300) * 100, 100)}%` }}
                                  transition={{ duration: 1, ease: 'easeOut', delay: 0.6 }}
                                />
                              </div>
                            </div>
                          </motion.div>
                        </div>

                        {/* ── RPG-style XP Progress Bar with Thresholds ── */}
                        <div className="relative rounded-xl border border-gray-700/50 bg-gray-900/50 p-3.5">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                              <Target className="h-3.5 w-3.5" style={{ color: lessonLevel.cssColor }} />
                              <span className="text-xs font-medium text-gray-400">Lesson Score</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <motion.span
                                className="text-sm font-bold tabular-nums"
                                style={{ color: lessonLevel.cssColor }}
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
                                key={Math.round(lessonScore)}
                              >
                                {Math.round(lessonScore)}%
                              </motion.span>
                              {lessonScore < 80 && (
                                <span className="text-[10px] text-gray-500 font-mono">
                                  ({80 - Math.round(lessonScore)}% left)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Progress bar track with checkpoints */}
                          <div className="relative h-3 overflow-hidden rounded-full bg-gray-800/70">
                            <motion.div
                              className="h-full rounded-full shadow-sm relative"
                              style={{
                                background: `linear-gradient(90deg, ${lessonLevel.cssColor}60, ${lessonLevel.cssColor})`,
                              }}
                              initial={{ width: '0%' }}
                              animate={{ width: `${Math.min(lessonScore, 100)}%` }}
                              transition={{ duration: 1.2, ease: 'easeOut', delay: 0.5 }}
                            >
                              {/* Shimmer sweep */}
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent animate-pulse rounded-full" />
                            </motion.div>

                            {/* Checkpoint markers */}
                            <div className="absolute top-0.5 bottom-0.5 w-0.5 bg-white/15 rounded-full" style={{ left: '40%' }} />
                            <div className="absolute top-0.5 bottom-0.5 w-0.5 bg-white/20 rounded-full" style={{ left: '60%' }} />
                            <div className="absolute top-0.5 bottom-0.5 w-1 bg-emerald-400/40 rounded-full shadow-sm shadow-emerald-500/30" style={{ left: '79.5%' }} />
                          </div>

                          {/* Checkpoint labels */}
                          <div className="flex justify-between mt-1 text-[9px] text-gray-600 font-mono px-0.5">
                            <span>0%</span>
                            <span>40%</span>
                            <span>60%</span>
                            <span className="font-semibold text-emerald-600/70">80% ✓</span>
                            <span>100%</span>
                          </div>

                          {/* Next level hint */}
                          {lessonScore < 80 && (
                            <motion.div
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.7 }}
                              className="mt-2 flex items-center gap-1.5 text-[10px] text-gray-500"
                            >
                              <Star className="h-3 w-3 text-yellow-500/70" />
                              <span>
                                Next:{' '}
                                {(80 - Math.round(lessonScore)) <= 20
                                  ? 'Almost there! Just ' + (80 - Math.round(lessonScore)) + '% more to complete!'
                                  : 'Reach 80% score to complete this lesson'}
                              </span>
                            </motion.div>
                          )}
                        </div>
                      </div>

                  {/* 🎯 Animated Quiz/Assignment Prompt when reading is complete */}
                  {showQuizAssignPrompt && (
                    <motion.div
                      initial={{ opacity: 0, y: 12, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 18 }}
                      className="mt-5 pt-4 border-t border-blue-700/40"
                    >
                      <motion.div
                        animate={{ boxShadow: ['0 0 0 0 rgba(59,130,246,0)', '0 0 20px 4px rgba(59,130,246,0.15)', '0 0 0 0 rgba(59,130,246,0)'] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        className="rounded-xl bg-gradient-to-br from-blue-600/20 to-indigo-600/10 border border-blue-500/30 p-4"
                      >
                        <div className="flex items-start gap-3">
                          <motion.div
                            animate={{ rotate: [0, -10, 10, -10, 0] }}
                            transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
                            className="mt-0.5 shrink-0"
                          >
                            {quizNotAttempted && assignmentsNotSubmitted ? (
                              <Zap className="h-5 w-5 text-yellow-400" />
                            ) : quizNotAttempted ? (
                              <FileText className="h-5 w-5 text-blue-400" />
                            ) : (
                              <Clipboard className="h-5 w-5 text-purple-400" />
                            )}
                          </motion.div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-blue-200">
                              🎯 Reading Complete! Ready for the next step?
                            </p>
                            <p className="text-xs text-blue-300/70 mt-0.5">
                              {quizNotAttempted && assignmentsNotSubmitted
                                ? 'Complete the quiz and assignments to finish this lesson.'
                                : quizNotAttempted
                                ? 'Test your knowledge with the lesson quiz.'
                                : 'Submit your assignments to complete the lesson.'}
                            </p>
                            <div className="flex flex-wrap gap-2 mt-3">
                              {quizNotAttempted && (
                                <motion.button
                                  whileHover={{ scale: 1.03 }}
                                  whileTap={{ scale: 0.97 }}
                                  onClick={() => setCurrentViewMode('quiz')}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-blue-600/30 hover:shadow-blue-500/40 transition-all"
                                >
                                  <FileText className="h-3.5 w-3.5" />
                                  Take Quiz
                                  <ArrowRight className="h-3 w-3" />
                                </motion.button>
                              )}
                              {assignmentsNotSubmitted && (
                                <motion.button
                                  whileHover={{ scale: 1.03 }}
                                  whileTap={{ scale: 0.97 }}
                                  onClick={() => setCurrentViewMode('assignments')}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-purple-500 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-purple-600/30 hover:shadow-purple-500/40 transition-all"
                                >
                                  <Clipboard className="h-3.5 w-3.5" />
                                  View Assignments
                                  <ArrowRight className="h-3 w-3" />
                                </motion.button>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                  
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
                    </motion.div>
                  )}
                </CollapsibleCard>
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
                      className={`w-full h-64 p-4 bg-gray-800/50 border text-white rounded-lg resize-none focus:ring-2 focus:border-transparent placeholder-gray-500 ${
                        notesSaveStatus === 'error'
                          ? 'border-red-700 focus:ring-red-500'
                          : notesSaveStatus === 'saved'
                          ? 'border-green-700 focus:ring-green-500'
                          : 'border-gray-700 focus:ring-blue-500'
                      }`}
                    />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">
                        Notes are saved automatically as you type.
                      </span>
                      <span className="flex items-center gap-1.5">
                        {notesSaveStatus === 'saving' && (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
                            <span className="text-blue-400">Saving...</span>
                          </>
                        )}
                        {notesSaveStatus === 'saved' && (
                          <>
                            <CheckCircle className="h-3 w-3 text-green-400" />
                            <span className="text-green-400">Saved</span>
                          </>
                        )}
                        {notesSaveStatus === 'error' && (
                          <>
                            <AlertCircle className="h-3 w-3 text-red-400" />
                            <span className="text-red-400">Save failed</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </motion.div>

          {/* Completion Requirements Alert */}
          <CollapsibleCard
            title="Requirements to Continue"
            icon={<Target className="h-4 w-4 text-yellow-400" />}
            expanded={expandedCards.requirements}
            onToggle={(open) => setExpandedCards(prev => ({ ...prev, requirements: open }))}
            badge={
              !isLessonCompleted && hasNextLesson
                ? <span className="text-[10px] text-yellow-400 font-mono">{Math.round(readingProgress)}% read</span>
                : undefined
            }
          >
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
          </CollapsibleCard>

          {/* Navigation Footer */}
          <CollapsibleCard
            title="Navigate Between Lessons"
            icon={<ArrowRight className="h-4 w-4 text-blue-400" />}
            expanded={expandedCards.nav}
            onToggle={(open) => setExpandedCards(prev => ({ ...prev, nav: open }))}
            badge={<span className="text-[10px] text-gray-400 font-mono">{currentLessonIndex + 1}/{totalLessons}</span>}
          >
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
          </CollapsibleCard>
        </div>
      </div>

      {/* ── Fullscreen Content Overlay ── */}
      {contentFullscreen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 bg-[#0a0e1a]"
        >
          {/* Fullscreen header bar */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-gray-800 bg-gray-900/90 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/30 flex items-center justify-center">
                <BookOpen className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white leading-tight">
                  {currentLesson?.title}
                </p>
                <p className="text-[10px] text-gray-500 leading-tight">
                  Fullscreen Content
                </p>
              </div>
            </div>

            <button
              onClick={() => setContentFullscreen(false)}
              className="flex items-center justify-center h-8 w-8 rounded-lg border border-gray-700 bg-gray-800/50 text-gray-400 hover:bg-gray-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 transition-all"
              title="Exit fullscreen"
              aria-label="Exit fullscreen mode"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
          </div>

          {/* Fullscreen scrollable content area */}
          <div className="overflow-y-auto h-[calc(100vh-57px)]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-6 sm:py-8">
              <ContentRichPreview
                key={`fullscreen-${currentLesson.id ?? currentLessonIndex}`}
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
                  onSectionProgress={onSectionProgress}
                  hasQuiz={hasQuiz}
                  hasAssignments={hasAssignments}
                  isLessonCompleted={isLessonCompleted}
                  onSwitchToQuiz={() => setCurrentViewMode('quiz')}
                  onSwitchToAssignment={() => setCurrentViewMode('assignments')}
                  onGoToNextLesson={() => onNavigate('next')}
              />
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
