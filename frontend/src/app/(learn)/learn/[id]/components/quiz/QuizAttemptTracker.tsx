"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  XCircle, AlertCircle, Trophy,
  Loader2, ChevronLeft, ChevronRight
} from "lucide-react";
import ContentAssignmentService from "@/services/contentAssignmentApi";
import { toast } from "sonner";
import { useQuizSecurity } from "@/hooks/quiz/useQuizSecurity";
import { QuizPreScreen } from "./QuizPreScreen";
import { QuizTimer } from "./QuizTimer";
import { QuizResultModal } from "./QuizResultModal";
import { QuizNavigationGrid } from "./QuizNavigationGrid";
import type { ContentQuiz } from "@/services/contentAssignmentApi";

interface ExtendedQuiz extends ContentQuiz {
  time_limit?: number;
  max_attempts?: number;
  passing_score?: number;
  shuffle_questions?: boolean;
  shuffle_answers?: boolean;
  attempts_used?: number;
  best_score?: number;
  blocked_due_to_violation?: boolean;
}

interface QuizAttemptTrackerProps {
  quiz: ExtendedQuiz;
  onStartQuiz: () => void;
  onSubmitQuiz: (answers: Record<number, string>) => void;
  onQuizComplete?: (score: number, passed: boolean) => void;
}

interface SubmissionResult {
  score: number;
  passed: boolean;
  attempt_number: number;
  remaining_attempts: number;
}

type QuizStatus = "not-started" | "in-progress" | "completed";

export const QuizAttemptTracker: React.FC<QuizAttemptTrackerProps> = ({
  quiz, onStartQuiz, onSubmitQuiz, onQuizComplete,
}) => {
  const [status, setStatus] = useState<QuizStatus>("not-started");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const tabSwitchCountRef = useRef(0);
  const submittingRef = useRef(false);
  const statusRef = useRef<QuizStatus>(status);

  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { submittingRef.current = submitting; }, [submitting]);

  // Shuffle state
  const [shuffledQuestions, setShuffledQuestions] = useState<any[]>([]);
  const [shuffledAnswersMap, setShuffledAnswersMap] = useState<Record<number, any[]>>({});

  const questions = shuffledQuestions.length > 0 ? shuffledQuestions : (quiz.questions || []);
  const currentQuestion = questions[currentIndex];
  const currentAnswersList = currentQuestion ? shuffledAnswersMap[currentQuestion.id] || [] : [];
  const answeredCount = Object.keys(answers).filter(k => answers[k]?.trim().length > 0).length;
  const allAnswered = answeredCount === questions.length && questions.length > 0;
  const progressPct = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  // Security hook
  const {
    violationCount, maxReached, isContentHidden, enterFullscreen, exitFullscreen,
  } = useQuizSecurity({
    enabled: status === "in-progress",
    maxViolations: 3,
    onViolation: (count) => { tabSwitchCountRef.current = count; },
    onMaxViolationsReached: () => submitWithViolation(),
  });

  // Shuffle on mount
  useEffect(() => {
    if (!quiz.questions?.length) return;
    const sorted = [...quiz.questions].sort((a, b) => (a.order || 0) - (b.order || 0));
    const toUse = quiz.shuffle_questions ? shuffleArray(sorted) : sorted;
    setShuffledQuestions(toUse);

    const map: Record<number, any[]> = {};
    toUse.forEach(q => {
      map[q.id] = quiz.shuffle_answers && q.answers ? shuffleArray(q.answers) : (q.answers || []);
    });
    setShuffledAnswersMap(map);
  }, [quiz.questions, quiz.shuffle_questions, quiz.shuffle_answers]);

  // Timer with auto-submit on expiry (separate from setState callback)
  useEffect(() => {
    if (status !== "in-progress") return;

    const interval = setInterval(() => {
      setTimeElapsed(t => t + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  // Watch for time expiry — separate effect to avoid setState-in-setState
  useEffect(() => {
    if (status !== "in-progress" || !quiz.time_limit) return;
    if (timeElapsed >= quiz.time_limit * 60) {
      toast.error("Time Expired! Auto-submitting...");
      handleTimeExpiredSubmit();
    }
  }, [timeElapsed, status, quiz.time_limit]);

  const startQuiz = useCallback(() => {
    if (quiz.blocked_due_to_violation) {
      toast.error("Quiz blocked due to previous violation.");
      return;
    }
    setStatus("in-progress");
    setCurrentIndex(0);
    setAnswers({});
    setTimeElapsed(0);
    setError(null);
    enterFullscreen();
    toast.info("Quiz started — fullscreen mode active.");
    onStartQuiz();
  }, [quiz.blocked_due_to_violation, enterFullscreen, onStartQuiz]);

  const handleAnswerSelect = useCallback((questionId: number, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  }, []);

  const navigateQuestion = useCallback((idx: number) => {
    if (idx >= 0 && idx < questions.length) setCurrentIndex(idx);
  }, [questions.length]);

  const submitWithViolation = useCallback(async () => {
    if (submitting || status !== "in-progress") return;
    setSubmitting(true);
    exitFullscreen();
    try {
      await ContentAssignmentService.reportQuizViolation(quiz.id,
        "Security violation: tab switching / fullscreen exit", tabSwitchCountRef.current);
      const result = await ContentAssignmentService.submitQuiz(quiz.id, {}, {
        security_violation: true,
        violation_reason: `Security violation: ${tabSwitchCountRef.current} violations`,
      } as any);
      setSubmissionResult({ score: 0, passed: false, attempt_number: result.attempt_number || 1, remaining_attempts: 0 });
      setStatus("completed");
      setShowScoreModal(true);
      onQuizComplete?.(0, false);
      toast.error("Quiz submitted — 0% due to security violations.");
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to submit quiz");
    } finally {
      setSubmitting(false);
    }
  }, [submitting, status, quiz.id, exitFullscreen, onQuizComplete]);

  // Shared submission logic used by both manual and time-expired submit
  const doSubmit = useCallback(async (
    currentAnswers: Record<number, string>,
  ) => {
    if (submittingRef.current || statusRef.current !== "in-progress") return;
    setSubmitting(true);
    submittingRef.current = true;
    exitFullscreen();
    try {
      const result = await ContentAssignmentService.submitQuiz(quiz.id, currentAnswers);
      const score = Math.round(result.score);
      setSubmissionResult({
        score, passed: result.passed,
        attempt_number: result.attempt_number || 1,
        remaining_attempts: result.remaining_attempts ?? -1,
      });
      setStatus("completed");
      setShowScoreModal(true);
      onSubmitQuiz(currentAnswers);
      onQuizComplete?.(score, result.passed);

      if (result.passed) {
        toast.success(`Quiz passed! Score: ${score}%`);
      } else {
        toast.error(`Score: ${score}% (need ${quiz.passing_score || 70}%)`);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Submission failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  }, [quiz.id, quiz.passing_score, exitFullscreen, onSubmitQuiz, onQuizComplete]);

  // Time-expired submit — no allAnswered guard, no confirm dialog
  const handleTimeExpiredSubmit = useCallback(async () => {
    setError(null);
    await doSubmit(answers);
  }, [doSubmit, answers]);

  // Manual submit with validation guards
  const handleSubmit = useCallback(async () => {
    if (submittingRef.current || statusRef.current !== "in-progress") return;
    if (!allAnswered) {
      setError(`Please answer all questions (${questions.length - answeredCount} remaining).`);
      return;
    }
    if (!window.confirm("Submit quiz? You cannot change your answers after submission.")) return;
    setError(null);
    await doSubmit(answers);
  }, [allAnswered, questions.length, answeredCount, answers, doSubmit]);

  const attemptsUsed = quiz.attempts_used || 0;
  const maxAttempts = quiz.max_attempts || -1;
  const canAttempt = !quiz.blocked_due_to_violation && (maxAttempts === -1 || attemptsUsed < maxAttempts);

  // Not-started screen
  if (status === "not-started") {
    return (
      <QuizPreScreen
        quiz={quiz}
        onStart={startQuiz}
        canAttempt={canAttempt}
        attemptsUsed={attemptsUsed}
        maxAttempts={maxAttempts}
        isBlockedByViolation={!!quiz.blocked_due_to_violation}
      />
    );
  }

  // Completed screen + score modal
  return (
    <>
      {status === "in-progress" && (
        <div className="fixed inset-0 z-[9999] bg-gray-900 overflow-y-auto">
          {isContentHidden && (
            <div className="fixed inset-0 z-[99999] bg-gray-900/95 flex items-center justify-center backdrop-blur-xl">
              <div className="text-center p-8">
                <XCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Content Protected</h2>
                <p className="text-gray-400">Return to this window to continue your quiz.</p>
              </div>
            </div>
          )}

          <div className="min-h-screen p-4 max-w-5xl mx-auto space-y-4">
            {error && (
              <Alert className="border-red-700 bg-red-900/30">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <AlertTitle className="text-red-300">Error</AlertTitle>
                <AlertDescription className="text-red-200">{error}</AlertDescription>
              </Alert>
            )}

            {/* Security Banner */}
            <Alert className="border-orange-400 bg-orange-950/20">
              <AlertCircle className="h-4 w-4 text-orange-400" />
              <AlertTitle className="text-orange-300 font-bold text-sm">🔒 Security Monitoring Active</AlertTitle>
              <AlertDescription className="text-orange-200 text-xs">
                Violations: {violationCount}/3 — Tab switching &amp; screenshots blocked.
              </AlertDescription>
            </Alert>

            {/* Header */}
            <Card className="border-blue-200 dark:border-blue-800">
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      Q{currentIndex + 1}/{questions.length}
                    </Badge>
                    <Badge className="bg-blue-600 text-xs">
                      {answeredCount}/{questions.length}
                    </Badge>
                  </div>
                  <QuizTimer
                    timeElapsed={timeElapsed}
                    timeRemaining={quiz.time_limit ? quiz.time_limit * 60 - timeElapsed : null}
                    hasTimeLimit={!!quiz.time_limit}
                  />
                </div>
                <Progress value={progressPct} className="h-1.5" />
              </CardContent>
            </Card>

            {/* Question */}
            {currentQuestion && (
              <Card className="border-blue-200 dark:border-blue-800">
                <CardContent className="p-5 space-y-4">
                  <p className="text-lg font-semibold text-white">
                    {currentQuestion.question || currentQuestion.text}
                  </p>
                  <div className="space-y-2">
                    {currentAnswersList.map((answer: any, i: number) => (
                      <button
                        key={answer.id || i}
                        onClick={() => handleAnswerSelect(currentQuestion.id, answer.text || String(i))}
                        className={`w-full text-left p-3 rounded-lg border text-sm transition-all ${
                          answers[currentQuestion.id] === (answer.text || String(i))
                            ? "border-blue-500 bg-blue-900/30 text-white ring-1 ring-blue-500"
                            : "border-gray-700 bg-gray-800/50 text-gray-300 hover:bg-gray-700/50"
                        }`}
                      >
                        {answer.text || answer.answer || String(i)}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Navigation */}
            <QuizNavigationGrid
              totalQuestions={questions.length}
              currentIndex={currentIndex}
              answers={answers}
              questions={questions}
              onNavigate={navigateQuestion}
            />

            {/* Controls */}
            <div className="flex items-center justify-between gap-3">
              <Button variant="outline" size="sm" onClick={() => navigateQuestion(currentIndex - 1)}
                disabled={currentIndex === 0} className="border-gray-700 text-gray-300">
                <ChevronLeft className="h-4 w-4 mr-1" /> Prev
              </Button>
              {currentIndex < questions.length - 1 ? (
                <Button size="sm" onClick={() => navigateQuestion(currentIndex + 1)}
                  className="bg-blue-600 text-white">
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button size="sm" onClick={handleSubmit} disabled={submitting || !allAnswered}
                  className="bg-green-600 text-white">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Submit
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Score Modal */}
      <Dialog open={showScoreModal} onOpenChange={setShowScoreModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-purple-600" />
              Quiz Results
            </DialogTitle>
            <DialogDescription>Your performance on this quiz</DialogDescription>
          </DialogHeader>
          {submissionResult && (
            <QuizResultModal
              score={submissionResult.score}
              passed={submissionResult.passed}
              attemptNumber={submissionResult.attempt_number}
              totalAttempts={maxAttempts}
              remainingAttempts={submissionResult.remaining_attempts}
              passingScore={quiz.passing_score || 70}
              bestScore={quiz.best_score}
              canRetake={!submissionResult.passed && (maxAttempts === -1 || attemptsUsed < maxAttempts)}
              isBlockedByViolation={maxReached}
              onRetake={() => { setShowScoreModal(false); startQuiz(); }}
              onClose={() => setShowScoreModal(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

// ── Helpers ────────────────────────────────────────────────────────
function shuffleArray<T>(array: T[]): T[] {
  const s = [...array];
  for (let i = s.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [s[i], s[j]] = [s[j], s[i]];
  }
  return s;
}

export default QuizAttemptTracker;
