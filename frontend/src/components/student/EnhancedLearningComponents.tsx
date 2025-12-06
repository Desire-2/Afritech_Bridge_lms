"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  Flame,
  Trophy,
  Star,
  Zap,
  Target,
  TrendingUp,
  Brain,
  Calendar,
  BookMarked,
  ArrowRight,
  Lock,
  Clock,
  BarChart3,
  Award
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface QuizRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  quizInfo: {
    quiz_id: number;
    quiz_title: string;
    passing_score: number;
    current_score?: number;
    message: string;
  };
  onGoToQuiz: () => void;
}

/**
 * Quiz Pre-Requisite Modal
 * Shows when student tries to complete a lesson with a required quiz
 */
export const QuizRequiredModal: React.FC<QuizRequiredModalProps> = ({
  isOpen,
  onClose,
  quizInfo,
  onGoToQuiz,
}) => {
  const hasAttempted = quizInfo.current_score !== undefined;
  const hasPassed = hasAttempted && (quizInfo.current_score ?? 0) >= quizInfo.passing_score;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-500" />
            Quiz Required to Complete Lesson
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Quiz Info */}
          <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
            <CardContent className="pt-6">
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">{quizInfo.quiz_title}</h3>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Passing Score:</span>
                  <span className="font-semibold text-amber-600">{quizInfo.passing_score}%</span>
                </div>

                {hasAttempted && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Your Score:</span>
                    <span className={`font-semibold ${hasPassed ? 'text-green-600' : 'text-red-600'}`}>
                      {quizInfo.current_score}%
                    </span>
                  </div>
                )}

                {!hasAttempted && (
                  <div className="flex items-center gap-2 p-3 bg-blue-50 rounded text-sm text-blue-700">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    You haven't taken this quiz yet
                  </div>
                )}

                {hasPassed && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded text-sm text-green-700">
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                    Great! You passed the quiz. You can now complete the lesson.
                  </div>
                )}

                {hasAttempted && !hasPassed && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 rounded text-sm text-red-700">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    You need to score at least {quizInfo.passing_score}% to complete this lesson
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Back
            </Button>
            <Button onClick={onGoToQuiz} className="flex-1 gap-2">
              Go to Quiz
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Learning Celebration Component
 * Shows animated celebration when student completes a lesson/quiz or reaches milestone
 */
export const LearningCelebration: React.FC<{
  isVisible: boolean;
  celebration: {
    title: string;
    message: string;
    emoji: string;
    animation_type: string;
  };
}> = ({ isVisible, celebration }) => {
  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 50 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 50 }}
        className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
      >
        {/* Confetti effect background */}
        {celebration.animation_type === 'confetti' && (
          <div className="absolute inset-0">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 1, y: 0, rotate: 0 }}
                animate={{ opacity: 0, y: 400, rotate: 720 }}
                transition={{ duration: 3, delay: i * 0.05 }}
                className="absolute"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: 0,
                  width: '10px',
                  height: '10px',
                  backgroundColor: ['#fbbf24', '#f97316', '#ec4899', '#8b5cf6'][i % 4],
                  borderRadius: '50%'
                }}
              />
            ))}
          </div>
        )}

        <motion.div
          className="bg-white rounded-2xl shadow-2xl p-8 text-center max-w-sm"
          animate={{ rotate: [0, -2, 2, 0] }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-6xl mb-4">{celebration.emoji}</div>
          <h2 className="text-2xl font-bold mb-2">{celebration.title}</h2>
          <p className="text-muted-foreground">{celebration.message}</p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

/**
 * Learning Streak Widget
 * Shows current learning streak and motivates continued learning
 */
export const LearningStreakWidget: React.FC<{
  streak: {
    current_streak: number;
    longest_streak: number;
    days_active: number;
    total_completed: number;
    completed_today: number;
  };
}> = ({ streak }) => {
  const isOnFire = streak.current_streak >= 3;

  return (
    <Card className={`${isOnFire ? 'border-red-500 bg-gradient-to-br from-red-50 to-orange-50' : ''}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            {isOnFire ? (
              <>
                <Flame className="h-5 w-5 text-red-500 animate-bounce" />
                <span>On Fire! 🔥</span>
              </>
            ) : (
              <>
                <Flame className="h-5 w-5 text-muted-foreground" />
                <span>Learning Streak</span>
              </>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-3xl font-bold text-red-500">{streak.current_streak}</div>
            <div className="text-sm text-muted-foreground">Current Streak</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-orange-500">{streak.longest_streak}</div>
            <div className="text-sm text-muted-foreground">Longest Streak</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Days Active</span>
            <span className="font-semibold">{streak.days_active}</span>
          </div>
          <Progress value={(streak.days_active / 365) * 100} />
        </div>

        {!streak.completed_today && (
          <Alert className="bg-amber-50 border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-sm text-amber-700">
              Complete a lesson today to keep your streak alive! 💪
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * Next Lessons Advanced Card
 * Shows next lesson with quiz requirements and adaptive recommendations
 */
export const NextLessonsAdvanced: React.FC<{
  lessons: Array<{
    id: number;
    title: string;
    duration: number;
    module_title: string;
    quiz?: {
      id: number;
      title: string;
      passing_score: number;
      status: string;
      best_score?: number;
    };
    quiz_required: boolean;
    can_start: boolean;
  }>;
  onSelectLesson: (lessonId: number) => void;
}> = ({ lessons, onSelectLesson }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Up Next
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {lessons.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p>Great job! You've completed all lessons in this course!</p>
          </div>
        ) : (
          lessons.map((lesson, index) => (
            <motion.div
              key={lesson.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`p-4 border rounded-lg ${
                !lesson.can_start ? 'opacity-50 bg-muted/30' : 'hover:bg-accent/50'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-semibold flex items-center gap-2">
                    {index === 0 && <Target className="h-4 w-4 text-blue-500" />}
                    {lesson.title}
                  </h4>
                  <p className="text-sm text-muted-foreground">{lesson.module_title}</p>
                </div>
                <Badge variant="outline" className="flex-shrink-0">
                  <Clock className="h-3 w-3 mr-1" />
                  {lesson.duration}m
                </Badge>
              </div>

              {/* Quiz Info */}
              {lesson.quiz && (
                <div className="mt-3 p-3 bg-blue-50 rounded text-sm space-y-2">
                  <div className="flex items-center gap-2 text-blue-700">
                    <AlertCircle className="h-4 w-4" />
                    <span className="font-medium">Quiz: {lesson.quiz.title}</span>
                  </div>

                  <div className="flex justify-between text-xs">
                    <span>Passing Score: {lesson.quiz.passing_score}%</span>
                    <span>
                      Status:{' '}
                      {lesson.quiz.status === 'passed' && <span className="text-green-600">✓ Passed</span>}
                      {lesson.quiz.status === 'failed' && (
                        <span className="text-orange-600">Need to retake - {lesson.quiz.best_score}%</span>
                      )}
                      {lesson.quiz.status === 'not_started' && (
                        <span className="text-gray-600">Not attempted</span>
                      )}
                    </span>
                  </div>

                  {lesson.quiz.best_score !== undefined && (
                    <Progress value={lesson.quiz.best_score} className="h-1" />
                  )}
                </div>
              )}

              <Button
                size="sm"
                className="mt-3 w-full"
                onClick={() => onSelectLesson(lesson.id)}
                disabled={!lesson.can_start}
              >
                {lesson.can_start ? (
                  <>
                    Start Lesson <ArrowRight className="h-3 w-3 ml-1" />
                  </>
                ) : (
                  <>
                    <Lock className="h-3 w-3 mr-1" />
                    Locked
                  </>
                )}
              </Button>
            </motion.div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

/**
 * Learning Analytics Dashboard
 * Shows comprehensive learning metrics and progress
 */
export const LearningAnalyticsDashboard: React.FC<{
  analytics: {
    completion_percentage: number;
    lessons_completed: number;
    total_lessons: number;
    time_invested_minutes: number;
    average_quiz_score: number;
    quizzes_passed: number;
    total_quizzes_attempted: number;
    estimated_completion_date?: string;
  };
}> = ({ analytics }) => {
  const estimatedDate = analytics.estimated_completion_date
    ? new Date(analytics.estimated_completion_date).toLocaleDateString()
    : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Overall Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5" />
            Course Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Overall</span>
              <span className="font-semibold">{Math.round(analytics.completion_percentage)}%</span>
            </div>
            <Progress value={analytics.completion_percentage} />
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <div className="text-2xl font-bold text-blue-500">{analytics.lessons_completed}</div>
              <div className="text-muted-foreground">Lessons Done</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-500">{analytics.total_lessons}</div>
              <div className="text-muted-foreground">Total Lessons</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quiz Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trophy className="h-5 w-5" />
            Quiz Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Average Score</span>
              <span className="font-semibold">{analytics.average_quiz_score.toFixed(1)}%</span>
            </div>
            <Progress value={analytics.average_quiz_score} />
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <div className="text-2xl font-bold text-green-500">{analytics.quizzes_passed}</div>
              <div className="text-muted-foreground">Passed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-500">{analytics.total_quizzes_attempted}</div>
              <div className="text-muted-foreground">Attempted</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Time Invested */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5" />
            Time Invested
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-indigo-500">
            {Math.floor(analytics.time_invested_minutes / 60)}h {analytics.time_invested_minutes % 60}m
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {analytics.time_invested_minutes} total minutes of learning
          </p>
        </CardContent>
      </Card>

      {/* Estimated Completion */}
      {estimatedDate && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5" />
              Estimated Completion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-500">{estimatedDate}</div>
            <p className="text-sm text-muted-foreground mt-2">
              Keep your pace to finish on time!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

/**
 * Adaptive Learning Recommendations
 * Shows personalized suggestions based on performance
 */
export const AdaptiveLearningRecommendations: React.FC<{
  recommendations: {
    review_needed: Array<{
      lesson_id: number;
      lesson_title: string;
      reason: string;
      recommended_resources: string[];
    }>;
    strong_areas: Array<{
      area: string;
      reason: string;
      suggested_action: string;
    }>;
    suggested_pace: string;
    focus_areas: Array<{
      area: string;
      reason: string;
      suggested_action: string;
    }>;
  };
}> = ({ recommendations }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          AI Recommendations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pacing */}
        <div>
          <h4 className="font-semibold text-sm mb-2">Suggested Pace</h4>
          <Badge className={recommendations.suggested_pace === 'fast' ? 'bg-green-500' : ''}>
            {recommendations.suggested_pace === 'fast' ? '⚡ Fast Track' : '🐢 Steady Pace'}
          </Badge>
        </div>

        {/* Focus Areas */}
        {recommendations.focus_areas.length > 0 && (
          <div>
            <h4 className="font-semibold text-sm mb-2">Focus Areas</h4>
            {recommendations.focus_areas.map((area, i) => (
              <Alert key={i} className="mb-2">
                <Zap className="h-4 w-4" />
                <AlertTitle className="text-sm">{area.area}</AlertTitle>
                <AlertDescription className="text-xs">{area.suggested_action}</AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Review Needed */}
        {recommendations.review_needed.length > 0 && (
          <div>
            <h4 className="font-semibold text-sm mb-2">Review Recommended</h4>
            {recommendations.review_needed.map((item, i) => (
              <div key={i} className="text-sm p-2 bg-amber-50 rounded mb-2">
                <div className="font-medium text-amber-900">{item.lesson_title}</div>
                <div className="text-xs text-amber-700">{item.reason}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default {
  QuizRequiredModal,
  LearningCelebration,
  LearningStreakWidget,
  NextLessonsAdvanced,
  LearningAnalyticsDashboard,
  AdaptiveLearningRecommendations,
};
