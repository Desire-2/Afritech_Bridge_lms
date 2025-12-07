import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  Play,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Trophy,
  RefreshCw,
  FileText,
  Timer,
  Loader2,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Grid
} from 'lucide-react';
import type { ContentQuiz, QuizQuestion } from '@/services/contentAssignmentApi';
import ContentAssignmentService from '@/services/contentAssignmentApi';
import { toast } from 'sonner';
import { useSidebar } from '@/contexts/SidebarContext';

interface ExtendedQuiz extends ContentQuiz {
  time_limit?: number;
  max_attempts?: number;
  passing_score?: number;
  shuffle_questions?: boolean;
  shuffle_answers?: boolean;
  show_correct_answers?: boolean;
  attempts_used?: number;
  best_score?: number;
}

interface QuizAttemptTrackerProps {
  quiz: ExtendedQuiz;
  onStartQuiz: () => void;
  onSubmitQuiz: (answers: Record<number, string>) => void;
  onQuizComplete?: (score: number, passed: boolean) => void;
}

interface QuizState {
  status: 'not-started' | 'in-progress' | 'completed' | 'reviewing' | 'viewing-feedback';
  currentQuestionIndex: number;
  answers: Record<number, string>;
  timeRemaining?: number;
  attemptNumber: number;
  score?: number;
  feedback?: string;
}

interface SubmissionResult {
  score: number;
  passed: boolean;
  attempt_number: number;
  total_attempts: number;
  remaining_attempts: number;
}

export const QuizAttemptTracker: React.FC<QuizAttemptTrackerProps> = ({
  quiz,
  onStartQuiz,
  onSubmitQuiz,
  onQuizComplete
}) => {
  // Optional sidebar context - may not be available in all routes
  let closeSidebar: (() => void) | undefined;
  try {
    const sidebar = useSidebar();
    closeSidebar = sidebar.closeSidebar;
  } catch (error) {
    // SidebarProvider not available in this route
    closeSidebar = undefined;
  }
  
  const [quizState, setQuizState] = useState<QuizState>({
    status: 'not-started',
    currentQuestionIndex: 0,
    answers: {},
    attemptNumber: 1
  });

  const [timeElapsed, setTimeElapsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null);
  const [shuffledQuestions, setShuffledQuestions] = useState<any[]>([]);
  const [shuffledAnswersMap, setShuffledAnswersMap] = useState<Record<number, any[]>>({});
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [securityViolation, setSecurityViolation] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isQuizActive, setIsQuizActive] = useState(false);
  
  // Shuffle utility function
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Initialize shuffled questions and answers when quiz loads
  useEffect(() => {
    if (quiz.questions && quiz.questions.length > 0) {
      // Sort questions by order field first
      const sortedQuestions = [...quiz.questions].sort((a, b) => (a.order || 0) - (b.order || 0));
      
      // Shuffle questions if enabled
      const questionsToUse = quiz.shuffle_questions ? shuffleArray(sortedQuestions) : sortedQuestions;
      setShuffledQuestions(questionsToUse);
      
      // Shuffle answers for each question if enabled
      if (quiz.shuffle_answers) {
        const answersMap: Record<number, any[]> = {};
        questionsToUse.forEach(question => {
          if (question.answers && question.answers.length > 0) {
            answersMap[question.id] = shuffleArray(question.answers);
          }
        });
        setShuffledAnswersMap(answersMap);
      } else {
        // Use original answer order
        const answersMap: Record<number, any[]> = {};
        questionsToUse.forEach(question => {
          if (question.answers) {
            answersMap[question.id] = question.answers;
          }
        });
        setShuffledAnswersMap(answersMap);
      }
    }
  }, [quiz.questions, quiz.shuffle_questions, quiz.shuffle_answers]);

  // Timer effect with countdown and auto-submit
  useEffect(() => {
    if (quizState.status === 'in-progress') {
      const interval = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
        
        // Update countdown timer
        if (quiz.time_limit) {
          const remaining = (quiz.time_limit * 60) - timeElapsed - 1;
          setTimeRemaining(remaining);
          
          // Auto-submit when time expires
          if (remaining <= 0) {
            clearInterval(interval);
            toast.error('Time Expired!', {
              description: 'Your quiz has been automatically submitted.',
              duration: 5000
            });
            // Auto-submit without validation - submit current answers
            handleTimeExpiredSubmit();
          }
          
          // Warning at 1 minute remaining
          if (remaining === 60) {
            toast.warning('1 Minute Remaining!', {
              description: 'Please complete your quiz soon.',
              duration: 5000
            });
          }
        }
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [quizState.status, timeElapsed]);

  // Security monitoring: tab switching, screenshots, content selection
  useEffect(() => {
    if (quizState.status === 'in-progress' && !submitting) {
      // Detect tab/window switching
      const handleVisibilityChange = () => {
        if (document.hidden) {
          setTabSwitchCount(prev => {
            const newCount = prev + 1;
            
            toast.error(`Tab Switch Detected (${newCount}/3)`, {
              description: 'Switching tabs during the quiz is not allowed. 3 violations will result in automatic submission with 0 score.',
              duration: 5000
            });
            
            if (newCount >= 3 && !securityViolation) {
              setSecurityViolation(true);
              toast.error('Maximum Violations Reached', {
                description: 'Quiz will be submitted with 0 score due to multiple security violations.',
                duration: 5000
              });
              
              setTimeout(() => {
                submitQuizWithViolation();
              }, 2000);
            }
            
            return newCount;
          });
        }
      };

      // Detect window blur (switching windows)
      const handleWindowBlur = () => {
        if (!document.hidden) {
          setTabSwitchCount(prev => {
            const newCount = prev + 1;
            
            toast.error(`Window Change Detected (${newCount}/3)`, {
              description: 'Changing windows during the quiz is not allowed.',
              duration: 5000
            });
            
            if (newCount >= 3 && !securityViolation) {
              setSecurityViolation(true);
              
              setTimeout(() => {
                submitQuizWithViolation();
              }, 2000);
            }
            
            return newCount;
          });
        }
      };

      // Prevent screenshots
      const handleKeyDown = (e: KeyboardEvent) => {
        // Prevent PrintScreen, Ctrl+P, Cmd+Shift+3/4/5 (Mac screenshots)
        if (
          e.key === 'PrintScreen' ||
          (e.ctrlKey && e.key === 'p') ||
          (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key))
        ) {
          e.preventDefault();
          toast.warning('Screenshots Disabled', {
            description: 'Taking screenshots during the quiz is not allowed.',
            duration: 3000
          });
        }
      };

      // Prevent right-click context menu
      const handleContextMenu = (e: MouseEvent) => {
        e.preventDefault();
        toast.warning('Right-click Disabled', {
          description: 'Right-click is disabled during the quiz.',
          duration: 2000
        });
      };

      // Disable text selection
      const disableSelection = () => {
        document.body.style.userSelect = 'none';
        document.body.style.webkitUserSelect = 'none';
      };

      const enableSelection = () => {
        document.body.style.userSelect = '';
        document.body.style.webkitUserSelect = '';
      };

      // Monitor fullscreen exit as a violation
      const handleFullscreenChange = () => {
        if (!document.fullscreenElement && isQuizActive && !securityViolation) {
          setTabSwitchCount(prev => {
            const newCount = prev + 1;
            
            toast.error(`Fullscreen Exit Detected (${newCount}/3)`, {
              description: 'Exiting fullscreen during the quiz is not allowed.',
              duration: 5000
            });
            
            if (newCount >= 3 && !securityViolation) {
              setSecurityViolation(true);
              toast.error('Maximum Violations Reached', {
                description: 'Quiz will be submitted with 0 score due to multiple security violations.',
                duration: 5000
              });
              
              setTimeout(() => {
                submitQuizWithViolation();
              }, 2000);
            } else {
              // Try to re-enter fullscreen
              enterFullscreen();
            }
            
            return newCount;
          });
        }
      };

      // Add event listeners
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('blur', handleWindowBlur);
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('contextmenu', handleContextMenu);
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      disableSelection();

      // Cleanup
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('blur', handleWindowBlur);
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('contextmenu', handleContextMenu);
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        enableSelection();
      };
    }
  }, [quizState.status, isQuizActive, securityViolation]);

  const startQuiz = () => {
    setQuizState({
      ...quizState,
      status: 'in-progress',
      currentQuestionIndex: 0,
      answers: {}
    });
    setTimeElapsed(0);
    setTabSwitchCount(0);
    setSecurityViolation(false);
    setIsQuizActive(true);
    
    // Initialize countdown timer
    if (quiz.time_limit) {
      setTimeRemaining(quiz.time_limit * 60);
    }
    
    // Close sidebar for distraction-free quiz taking (if available)
    if (closeSidebar) {
      closeSidebar();
    }
    
    // Enter fullscreen mode
    enterFullscreen();
    
    // Show security warning
    toast.info('Quiz Started - Fullscreen Mode', {
      description: 'Tab switching, screenshots, and window changes are monitored. Exiting fullscreen will count as a violation. Violations will result in automatic submission with 0 score.',
      duration: 10000
    });
    
    onStartQuiz();
  };

  const enterFullscreen = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(err => {
        console.error('Error attempting to enable fullscreen:', err);
        toast.warning('Fullscreen Not Available', {
          description: 'Please manually enter fullscreen mode (F11) for better focus.',
          duration: 5000
        });
      });
    }
  };

  const exitFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(err => {
        console.error('Error attempting to exit fullscreen:', err);
      });
    }
  };

  const handleAnswerSelect = (questionId: number, answer: string) => {
    setQuizState({
      ...quizState,
      answers: {
        ...quizState.answers,
        [questionId]: answer
      }
    });
  };

  const navigateQuestion = (direction: 'next' | 'prev') => {
    const questions = quiz.questions || [];
    if (direction === 'next' && quizState.currentQuestionIndex < questions.length - 1) {
      setQuizState({
        ...quizState,
        currentQuestionIndex: quizState.currentQuestionIndex + 1
      });
    } else if (direction === 'prev' && quizState.currentQuestionIndex > 0) {
      setQuizState({
        ...quizState,
        currentQuestionIndex: quizState.currentQuestionIndex - 1
      });
    }
  };

  // Submit quiz with 0 score due to security violation
  const submitQuizWithViolation = async () => {
    if (submitting || quizState.status !== 'in-progress') return;
    
    setSubmitting(true);
    setError(null);
    setIsQuizActive(false);
    exitFullscreen();

    try {
      // Submit with empty answers to get 0 score
      const emptyAnswers = questions.reduce((acc, q) => {
        acc[q.id] = '';
        return acc;
      }, {} as Record<number, string>);
      
      const result = await ContentAssignmentService.submitQuiz(quiz.id, emptyAnswers);
      
      setQuizState({
        ...quizState,
        status: 'completed',
        score: 0,
        feedback: 'Quiz submitted due to security violation. Score: 0%'
      });
      setSubmissionResult(result);
      onQuizComplete(result);
      
      toast.error('Quiz Submitted - Security Violation', {
        description: 'Your quiz has been submitted with a score of 0% due to security policy violation.',
        duration: 10000
      });
    } catch (err: any) {
      console.error('Error submitting quiz with violation:', err);
      setError(err.response?.data?.message || 'Failed to submit quiz');
      toast.error('Submission Error', {
        description: err.response?.data?.message || 'Failed to submit quiz',
        duration: 5000
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleTimeExpiredSubmit = async () => {
    // Guard against duplicate submissions
    if (submitting || quizState.status !== 'in-progress') return;
    
    setSubmitting(true);
    setError(null);
    setIsQuizActive(false);
    exitFullscreen();

    try {
      console.log('Time expired - auto-submitting quiz with current answers');
      const result = await ContentAssignmentService.submitQuiz(quiz.id, quizState.answers);
      
      const scoreRounded = Math.round(result.score);
      
      const submissionData: SubmissionResult = {
        score: scoreRounded,
        passed: result.passed,
        attempt_number: result.attempt_number || 1,
        total_attempts: result.total_attempts || result.attempt_number || 1,
        remaining_attempts: result.remaining_attempts ?? -1
      };
      setSubmissionResult(submissionData);
      
      setQuizState(prev => ({
        ...prev,
        status: 'completed',
        score: scoreRounded,
        feedback: result.feedback || `Quiz submitted. Score: ${scoreRounded}%`
      }));

      toast.success('Quiz Submitted', {
        description: `Time expired. Your quiz has been submitted. Score: ${scoreRounded}%`,
        duration: 5000
      });

      onQuizComplete?.(scoreRounded);
    } catch (err: any) {
      console.error('Time expired submission error:', err);
      setError(err.response?.data?.message || 'Failed to submit quiz');
      toast.error('Submission Error', {
        description: err.response?.data?.message || 'Failed to submit quiz',
        duration: 5000
      });
    } finally {
      setSubmitting(false);
    }
  };

  const submitQuiz = async () => {
    // Guard against duplicate submissions
    if (submitting || quizState.status !== 'in-progress') return;
    
    // Validate all questions are answered
    if (!allQuestionsAnswered) {
      const unanswered = questions.length - answeredCount;
      setError(`Please answer all questions. ${unanswered} question${unanswered > 1 ? 's' : ''} remaining.`);
      toast.warning('Incomplete Quiz', {
        description: `Please answer all ${questions.length} questions before submitting`,
        duration: 4000
      });
      return;
    }

    if (!window.confirm('Are you sure you want to submit your quiz? You cannot change your answers after submission.')) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setIsQuizActive(false);
    exitFullscreen();

    try {
      console.log('Submitting quiz:', { quizId: quiz.id, answersCount: answeredCount, answers: quizState.answers });
      const result = await ContentAssignmentService.submitQuiz(quiz.id, quizState.answers);
      
      console.log('Quiz submission result:', result);
      
      const scoreRounded = Math.round(result.score);
      
      // Store submission result
      const submissionData: SubmissionResult = {
        score: scoreRounded,
        passed: result.passed,
        attempt_number: result.attempt_number || 1,
        total_attempts: result.total_attempts || result.attempt_number || 1,
        remaining_attempts: result.remaining_attempts ?? -1
      };
      setSubmissionResult(submissionData);
      
      setQuizState({
        ...quizState,
        status: 'completed',
        score: result.score,
        feedback: result.passed 
          ? `Congratulations! You passed with a score of ${scoreRounded}%` 
          : `You scored ${scoreRounded}%. Passing score is ${quiz.passing_score || 70}%`
      });

      // Call parent callbacks
      onSubmitQuiz(quizState.answers);
      if (onQuizComplete) {
        onQuizComplete(result.score, result.passed);
      }

      // Show success toast
      if (result.passed) {
        toast.success('Quiz Passed! 🎉', {
          description: `Score: ${scoreRounded}% - Attempt ${result.attempt_number}/${maxAttempts === -1 ? '∞' : maxAttempts}`,
          duration: 6000
        });
      } else {
        toast.error('Quiz Not Passed', {
          description: `Score: ${scoreRounded}% (Need ${quiz.passing_score || 70}%) - ${result.remaining_attempts >= 0 ? `${result.remaining_attempts} attempts left` : 'Try again'}`,
          duration: 6000
        });
      }

    } catch (error: any) {
      console.error('Quiz submission error:', error);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to submit quiz';
      setError(errorMessage);
      toast.error('Quiz Submission Failed', {
        description: errorMessage,
        duration: 5000
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Use shuffled questions (already sorted/shuffled based on settings)
  const questions = shuffledQuestions.length > 0 ? shuffledQuestions : [];
  
  const currentQuestion = questions[quizState.currentQuestionIndex];
  const currentAnswers = currentQuestion ? shuffledAnswersMap[currentQuestion.id] || [] : [];
  
  // Count answered questions (including text-based answers)
  const answeredCount = Object.keys(quizState.answers).filter(key => {
    const answer = quizState.answers[key];
    return answer && (typeof answer === 'string' ? answer.trim().length > 0 : true);
  }).length;
  
  const progressPercentage = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;
  const allQuestionsAnswered = answeredCount === questions.length;

  // Check if max attempts reached
  const attemptsUsed = quiz.attempts_used || 0;
  const maxAttempts = quiz.max_attempts || -1;
  const canAttempt = maxAttempts === -1 || attemptsUsed < maxAttempts;

  // Handle empty quiz
  if (!questions || questions.length === 0) {
    return (
      <Alert className="border-yellow-700 bg-yellow-900/30">
        <AlertCircle className="h-4 w-4 text-yellow-400" />
        <AlertTitle className="text-yellow-300">Quiz Not Available</AlertTitle>
        <AlertDescription className="text-yellow-200">
          This quiz has no questions yet. Please check back later or contact your instructor.
        </AlertDescription>
      </Alert>
    );
  }

  // Not Started State
  if (quizState.status === 'not-started') {
    return (
      <div className="space-y-6">
        {!canAttempt && (
          <Alert className="border-red-700 bg-red-900/30">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <AlertTitle className="text-red-300">Maximum Attempts Reached</AlertTitle>
            <AlertDescription className="text-red-200">
              You have used all {maxAttempts} attempts for this quiz. 
              {quiz.best_score && ` Your best score: ${quiz.best_score}%`}
            </AlertDescription>
            {quiz.best_score !== undefined && (
              <div className="mt-4">
                <Button
                  onClick={() => setShowScoreModal(true)}
                  variant="outline"
                  className="bg-white/10 hover:bg-white/20 text-white border-white/30"
                >
                  <Trophy className="h-4 w-4 mr-2" />
                  View Score Details
                </Button>
              </div>
            )}
          </Alert>
        )}
        
        <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950 dark:via-indigo-950 dark:to-purple-950 shadow-xl">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-blue-600 hover:bg-blue-700 text-white shadow-md">
                    <FileText className="h-3 w-3 mr-1" />
                    Quiz
                  </Badge>
                  {quiz.best_score && (
                    <Badge variant="outline" className="bg-white/50 backdrop-blur-sm">
                      Best: {quiz.best_score}%
                    </Badge>
                  )}
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">{quiz.title}</h3>
                <p className="text-gray-700 dark:text-gray-300 text-sm sm:text-base">{quiz.description}</p>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-5 text-center border border-blue-100 dark:border-blue-900 shadow-md hover:shadow-lg transition-all">
                <div className="flex justify-center mb-2">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                    <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">{questions.length}</div>
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">Questions</div>
              </div>
              
              {quiz.time_limit ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-5 text-center border border-orange-100 dark:border-orange-900 shadow-md hover:shadow-lg transition-all">
                  <div className="flex justify-center mb-2">
                    <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                      <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-orange-600 dark:text-orange-400">{quiz.time_limit}</div>
                  <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">Minutes</div>
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-5 text-center border border-green-100 dark:border-green-900 shadow-md hover:shadow-lg transition-all">
                  <div className="flex justify-center mb-2">
                    <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400">∞</div>
                  <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">No Time Limit</div>
                </div>
              )}
              
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-5 text-center border border-purple-100 dark:border-purple-900 shadow-md hover:shadow-lg transition-all">
                <div className="flex justify-center mb-2">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                    <Trophy className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-purple-600 dark:text-purple-400">{quiz.passing_score || 70}%</div>
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">Passing Score</div>
              </div>
              
              {quiz.max_attempts && quiz.max_attempts !== -1 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-5 text-center border border-indigo-100 dark:border-indigo-900 shadow-md hover:shadow-lg transition-all">
                  <div className="flex justify-center mb-2">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
                      <RefreshCw className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-indigo-600 dark:text-indigo-400">{quiz.max_attempts}</div>
                  <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">Max Attempts</div>
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-5 text-center border border-green-100 dark:border-green-900 shadow-md hover:shadow-lg transition-all">
                  <div className="flex justify-center mb-2">
                    <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                      <RefreshCw className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400">∞</div>
                  <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">Unlimited</div>
                </div>
              )}
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 sm:p-6 mb-6 border border-gray-200 dark:border-gray-700 shadow-md">
              <h4 className="font-bold text-gray-900 dark:text-white text-base sm:text-lg mb-4 flex items-center">
                <div className="p-1.5 bg-blue-100 dark:bg-blue-900 rounded-lg mr-3">
                  <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                Quiz Instructions
              </h4>
              <ul className="space-y-3 text-gray-700 dark:text-gray-300 text-sm sm:text-base">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>Read each question carefully before answering</span>
                </li>
                {quiz.time_limit && (
                  <li className="flex items-start gap-2">
                    <Clock className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                    <span>You have <strong>{quiz.time_limit} minutes</strong> to complete the quiz</span>
                  </li>
                )}
                {!quiz.time_limit && (
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>No time limit - take your time to answer thoughtfully</span>
                  </li>
                )}
                {quiz.max_attempts && quiz.max_attempts !== -1 ? (
                  <li className="flex items-start gap-2">
                    <RefreshCw className="h-5 w-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                    <span>You can attempt this quiz up to <strong>{quiz.max_attempts} times</strong></span>
                  </li>
                ) : (
                  <li className="flex items-start gap-2">
                    <RefreshCw className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Unlimited attempts available</span>
                  </li>
                )}
                <li className="flex items-start gap-2">
                  <Trophy className="h-5 w-5 text-purple-500 flex-shrink-0 mt-0.5" />
                  <span>You need <strong>{quiz.passing_score || 70}%</strong> to pass this quiz</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <span>You can navigate between questions before submitting</span>
                </li>
                {quiz.shuffle_questions && (
                  <li className="flex items-start gap-2">
                    <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <span className="text-blue-700 dark:text-blue-300 font-medium">Questions are presented in random order</span>
                  </li>
                )}
                {quiz.shuffle_answers && (
                  <li className="flex items-start gap-2">
                    <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <span className="text-blue-700 dark:text-blue-300 font-medium">Answer choices are randomized</span>
                  </li>
                )}
              </ul>
            </div>

            {/* Security Warning */}
            <Alert className="bg-orange-50 dark:bg-orange-950/30 border-orange-300 dark:border-orange-700">
              <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              <AlertTitle className="text-orange-900 dark:text-orange-300 font-bold">
                🔒 Security Policy
              </AlertTitle>
              <AlertDescription className="text-orange-800 dark:text-orange-300">
                <p className="mb-2 font-semibold">This quiz is monitored for academic integrity:</p>
                <ul className="list-disc ml-5 space-y-1 text-sm">
                  <li><strong>No tab switching</strong> - Stay on this page</li>
                  <li><strong>No window changes</strong> - Keep this window active</li>
                  <li><strong>Screenshots disabled</strong> - Cannot capture quiz content</li>
                  <li><strong>Content selection disabled</strong> - Cannot copy text</li>
                  <li className="text-red-700 dark:text-red-400 font-bold">⚠️ Any violation = Automatic 0 score and submission</li>
                </ul>
              </AlertDescription>
            </Alert>
            
            <Button 
              onClick={startQuiz}
              disabled={!canAttempt}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-6 sm:py-7 text-lg sm:text-xl font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg"
            >
              {canAttempt ? (
                <>
                  {attemptsUsed > 0 ? (
                    <>
                      <RefreshCw className="h-6 w-6 mr-2" />
                      Retake Quiz
                    </>
                  ) : (
                    <>
                      <Play className="h-6 w-6 mr-2" />
                      Start Quiz
                    </>
                  )}
                </>
              ) : (
                <>
                  <XCircle className="h-6 w-6 mr-2" />
                  Maximum Attempts Reached
                </>
              )}
            </Button>
            
            {maxAttempts !== -1 && (
              <div className="mt-4 text-center text-sm text-gray-600">
                Attempts: {attemptsUsed} / {maxAttempts}
                {quiz.best_score && ` • Best Score: ${quiz.best_score}%`}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Score Details Modal */}
        <Dialog open={showScoreModal} onOpenChange={setShowScoreModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-purple-600" />
                Quiz Score Details
              </DialogTitle>
              <DialogDescription>
                Your performance on this quiz
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {/* Score Display */}
              <div className="text-center">
                <div className={`inline-flex h-24 w-24 items-center justify-center rounded-full mb-4 ${
                  quiz.best_score && quiz.best_score >= (quiz.passing_score || 70)
                    ? 'bg-green-100 dark:bg-green-900'
                    : 'bg-yellow-100 dark:bg-yellow-900'
                }`}>
                  {quiz.best_score && quiz.best_score >= (quiz.passing_score || 70) ? (
                    <Trophy className="h-12 w-12 text-green-600 dark:text-green-400" />
                  ) : (
                    <AlertCircle className="h-12 w-12 text-yellow-600 dark:text-yellow-400" />
                  )}
                </div>
                <div className={`text-5xl font-bold mb-2 ${
                  quiz.best_score && quiz.best_score >= (quiz.passing_score || 70)
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-yellow-600 dark:text-yellow-400'
                }`}>
                  {quiz.best_score !== undefined ? Math.round(quiz.best_score) : 0}%
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {quiz.best_score && quiz.best_score >= (quiz.passing_score || 70)
                    ? 'Passed! Great job!'
                    : `Need ${quiz.passing_score || 70}% to pass`
                  }
                </p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{maxAttempts}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Total Attempts</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{quiz.passing_score || 70}%</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Passing Score</div>
                </div>
              </div>

              {/* Status Message */}
              {quiz.best_score !== undefined && quiz.best_score < (quiz.passing_score || 70) && (
                <>
                  <Alert className="border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-800 dark:text-yellow-300">
                      You scored below the passing threshold of {quiz.passing_score || 70}%.
                      {canAttempt && ' You still have attempts remaining to retake this quiz!'}
                      {!canAttempt && ' Unfortunately, you\'ve used all available attempts.'}
                    </AlertDescription>
                  </Alert>

                  {/* Warning about being dropped if no attempts remain */}
                  {!canAttempt && (
                    <Alert className="border-red-400 bg-red-50 dark:bg-red-950/30">
                      <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                      <AlertTitle className="text-red-900 dark:text-red-300 font-bold">
                        ⚠️ Important Notice
                      </AlertTitle>
                      <AlertDescription className="text-red-800 dark:text-red-300 space-y-2">
                        <p className="font-semibold">
                          You have reached the maximum number of attempts without passing this quiz.
                        </p>
                        <p>
                          Please review the lesson content carefully and ensure you fully understand the material before moving forward. Failing to pass required assessments may result in being dropped from this course.
                        </p>
                        <p className="text-sm italic">
                          💡 Tip: Re-read the lesson materials, take notes, and discuss any unclear topics with your instructor.
                        </p>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Advice when attempts remain */}
                  {canAttempt && (
                    <Alert className="border-blue-300 bg-blue-50 dark:bg-blue-950/30">
                      <CheckCircle className="h-4 w-4 text-blue-600" />
                      <AlertTitle className="text-blue-900 dark:text-blue-300 font-semibold">
                        📚 Study Recommendation
                      </AlertTitle>
                      <AlertDescription className="text-blue-800 dark:text-blue-300">
                        <p>Before retaking this quiz, we recommend:</p>
                        <ul className="list-disc ml-5 mt-2 space-y-1">
                          <li>Review the lesson content thoroughly</li>
                          <li>Take notes on key concepts</li>
                          <li>Practice any examples provided</li>
                          <li>Reach out to your instructor if you have questions</li>
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}

              {quiz.best_score !== undefined && quiz.best_score >= (quiz.passing_score || 70) && (
                <Alert className="border-green-300 bg-green-50 dark:bg-green-950/30">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800 dark:text-green-300">
                    Congratulations! You passed this quiz with a great score!
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              {/* Show Retake button if score is below passing and has remaining attempts */}
              {quiz.best_score !== undefined && quiz.best_score < (quiz.passing_score || 70) && canAttempt && (
                <Button
                  onClick={() => {
                    setShowScoreModal(false);
                    // Reset quiz state for retake
                    setQuizState({
                      status: 'not-started',
                      currentQuestionIndex: 0,
                      answers: {},
                      attemptNumber: attemptsUsed + 1
                    });
                    setSubmissionResult(null);
                    setTimeElapsed(0);
                    setError(null);
                    toast.warning('Retake Quiz', {
                      description: `You scored below passing. You have ${maxAttempts === -1 ? 'unlimited' : maxAttempts - attemptsUsed} attempts remaining.`,
                      duration: 3000
                    });
                  }}
                  className="flex-1 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retake Quiz
                </Button>
              )}
              
              <Button
                onClick={() => setShowScoreModal(false)}
                variant="outline"
                className={`${quiz.best_score !== undefined && quiz.best_score < (quiz.passing_score || 70) && canAttempt ? 'flex-1' : 'w-full'}`}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // In Progress State
  if (quizState.status === 'in-progress' && currentQuestion) {
    return (
      <div className="space-y-6">
        {/* Error Alert */}
        {error && (
          <Alert className="border-red-700 bg-red-900/30">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <AlertTitle className="text-red-300">Error</AlertTitle>
            <AlertDescription className="text-red-200">{error}</AlertDescription>
          </Alert>
        )}

        {/* Security Warning Banner */}
        <Alert className="border-orange-400 bg-orange-50 dark:bg-orange-950/30">
          <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          <AlertTitle className="text-orange-900 dark:text-orange-300 font-bold">
            🔒 Security Monitoring Active
          </AlertTitle>
          <AlertDescription className="text-orange-800 dark:text-orange-300 text-sm">
            <ul className="list-disc ml-5 space-y-1">
              <li>Tab switching and window changes are being monitored</li>
              <li>Screenshots and content copying are disabled</li>
              <li>Any violation will result in automatic submission with 0 score</li>
              <li>Stay focused on this page until quiz completion</li>
            </ul>
          </AlertDescription>
        </Alert>

        {/* Quiz Header */}
        <Card className="border-2 border-blue-100 dark:border-blue-900 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 shadow-md">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <Badge variant="outline" className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-sm">
                  Question {quizState.currentQuestionIndex + 1} of {questions.length}
                </Badge>
                <Badge variant={answeredCount === questions.length ? 'default' : 'secondary'} className="shadow-sm bg-blue-600 text-white">
                  {answeredCount}/{questions.length} Answered
                </Badge>
              </div>
              
              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="flex items-center space-x-2 text-gray-700 dark:text-gray-300">
                  <Timer className="h-4 w-4" />
                  <span className="font-mono font-semibold">{formatTime(timeElapsed)}</span>
                </div>
                {quiz.time_limit && timeRemaining !== null && (
                  <Badge 
                    variant="destructive" 
                    className={`shadow-sm text-base font-bold ${
                      timeRemaining <= 60 ? 'animate-pulse bg-red-600' : ''
                    }`}
                  >
                    <Clock className="h-4 w-4 mr-1" />
                    {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
                  </Badge>
                )}
              </div>
            </div>
            
            <Progress value={progressPercentage} className="mt-4 h-2" />
          </CardContent>
        </Card>

        {/* Question Card */}
        <Card className="border-2 border-blue-200 dark:border-blue-800 shadow-lg bg-gradient-to-br from-white to-blue-50/30 dark:from-gray-900 dark:to-blue-950/30" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
          <CardContent className="p-4 sm:p-6 md:p-8">
            <div className="mb-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <Badge variant="secondary" className="text-xs shadow-sm">
                      Question {quizState.currentQuestionIndex + 1}
                    </Badge>
                    {currentQuestion.points && (
                      <Badge variant="outline" className="text-xs bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800 shadow-sm">
                        <Trophy className="h-3 w-3 mr-1" />
                        {currentQuestion.points} {currentQuestion.points === 1 ? 'point' : 'points'}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 shadow-sm">
                      {currentQuestion.question_type?.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white leading-relaxed">
                    {currentQuestion.text}
                  </h3>
                </div>
              </div>
            </div>

            {/* Answer Options - Dynamic based on question type */}
            <div className="space-y-3">
              {/* Multiple Choice / Single Choice */}
              {(currentQuestion.question_type === 'multiple_choice' || currentQuestion.question_type === 'single_choice') && currentAnswers.map((answer, index) => (
                <button
                  key={answer.id}
                  onClick={() => handleAnswerSelect(currentQuestion.id, answer.id.toString())}
                  className={`w-full text-left p-4 sm:p-5 rounded-xl border-2 transition-all duration-200 ${
                    quizState.answers[currentQuestion.id] === answer.id.toString()
                      ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30 shadow-md scale-[1.02]'
                      : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 hover:shadow-md hover:scale-[1.01]'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`min-w-[32px] h-8 rounded-full border-2 flex items-center justify-center font-bold text-sm transition-all duration-200 ${
                      quizState.answers[currentQuestion.id] === answer.id.toString()
                        ? 'border-blue-500 dark:border-blue-400 bg-blue-500 dark:bg-blue-600 text-white shadow-md'
                        : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800'
                    }`}>
                      {quizState.answers[currentQuestion.id] === answer.id.toString() ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        String.fromCharCode(65 + index)
                      )}
                    </div>
                    <span className="text-gray-900 dark:text-gray-100 flex-1 pt-0.5 text-sm sm:text-base">{answer.text}</span>
                  </div>
                </button>
              ))}

              {/* True/False Question */}
              {currentQuestion.question_type === 'true_false' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <Button
                    type="button"
                    variant={quizState.answers[currentQuestion.id] === 'true' ? 'default' : 'outline'}
                    className={`h-24 sm:h-28 text-base sm:text-lg font-bold transition-all duration-200 ${
                      quizState.answers[currentQuestion.id] === 'true'
                        ? 'bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-lg scale-[1.02]'
                        : 'hover:border-green-400 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-950/20 hover:scale-[1.01]'
                    }`}
                    onClick={() => handleAnswerSelect(currentQuestion.id, 'true')}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle className="h-8 w-8" />
                      <span>True</span>
                    </div>
                  </Button>
                  <Button
                    type="button"
                    variant={quizState.answers[currentQuestion.id] === 'false' ? 'default' : 'outline'}
                    className={`h-24 sm:h-28 text-base sm:text-lg font-bold transition-all duration-200 ${
                      quizState.answers[currentQuestion.id] === 'false'
                        ? 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-lg scale-[1.02]'
                        : 'hover:border-red-400 dark:hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 hover:scale-[1.01]'
                    }`}
                    onClick={() => handleAnswerSelect(currentQuestion.id, 'false')}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <XCircle className="h-8 w-8" />
                      <span>False</span>
                    </div>
                  </Button>
                </div>
              )}

              {/* Short Answer Question */}
              {currentQuestion.question_type === 'short_answer' && (
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Your Answer:
                  </label>
                  <Input
                    type="text"
                    placeholder="Type your answer here..."
                    value={quizState.answers[currentQuestion.id] || ''}
                    onChange={(e) => handleAnswerSelect(currentQuestion.id, e.target.value)}
                    className="w-full text-base h-12 border-2 focus:border-blue-400 dark:focus:border-blue-500 transition-all"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Enter a concise answer to the question above.
                  </p>
                </div>
              )}

              {/* Essay Question */}
              {currentQuestion.question_type === 'essay' && (
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Your Answer:
                  </label>
                  <Textarea
                    placeholder="Write your detailed answer here..."
                    value={quizState.answers[currentQuestion.id] || ''}
                    onChange={(e) => handleAnswerSelect(currentQuestion.id, e.target.value)}
                    className="w-full min-h-[200px] text-base border-2 focus:border-blue-400 dark:focus:border-blue-500 transition-all"
                    rows={8}
                  />
                  <div className="flex flex-col sm:flex-row justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Provide a comprehensive, well-structured response.
                    </span>
                    <span className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{(quizState.answers[currentQuestion.id] || '').length} characters</span>
                  </div>
                </div>
              )}

              {/* Unsupported question type fallback */}
              {!['multiple_choice', 'single_choice', 'true_false', 'short_answer', 'essay'].includes(currentQuestion.question_type) && (
                <Alert className="border-yellow-500 bg-yellow-50">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800">
                    This question type ({currentQuestion.question_type}) is not yet supported.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Navigation */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6 pt-6 border-t-2 border-gray-100 dark:border-gray-700">
              <Button
                onClick={() => navigateQuestion('prev')}
                disabled={quizState.currentQuestionIndex === 0}
                variant="outline"
                className="w-full sm:w-auto h-11 font-semibold border-2 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
              
              <div className="text-sm font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-full">
                {quizState.currentQuestionIndex + 1} of {questions.length}
              </div>
              
              {quizState.currentQuestionIndex === questions.length - 1 ? (
                <Button
                  onClick={submitQuiz}
                  className="w-full sm:w-auto h-11 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  disabled={!allQuestionsAnswered || submitting}
                  title={!allQuestionsAnswered ? `Answer all ${questions.length} questions to submit` : 'Submit your quiz'}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5 mr-2" />
                      Submit Quiz {!allQuestionsAnswered && `(${answeredCount}/${questions.length})`}
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={() => navigateQuestion('next')}
                  disabled={quizState.currentQuestionIndex === questions.length - 1}
                  className="w-full sm:w-auto h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md hover:shadow-lg"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Question Navigator */}
        <Card className="border-2 border-gray-200 dark:border-gray-700 shadow-md">
          <CardContent className="p-4 sm:p-5">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Grid className="h-4 w-4" />
              Question Navigator
            </h4>
            <div className="flex flex-wrap gap-2">
              {questions.map((q, index) => (
                <button
                  key={q.id}
                  onClick={() => setQuizState({ ...quizState, currentQuestionIndex: index })}
                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg font-bold text-sm sm:text-base transition-all duration-200 ${
                    index === quizState.currentQuestionIndex
                      ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-lg scale-110 ring-2 ring-blue-300 dark:ring-blue-700'
                      : quizState.answers[q.id]
                      ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 border-2 border-green-400 dark:border-green-600 hover:shadow-md hover:scale-105'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:shadow-md hover:scale-105 border-2 border-gray-300 dark:border-gray-600'
                  }`}
                  title={`Question ${index + 1}${quizState.answers[q.id] ? ' (Answered)' : ' (Not answered)'}`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-600 rounded-lg"></div>
                <span>Current</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-green-100 dark:bg-green-900 border-2 border-green-400 dark:border-green-600 rounded-lg"></div>
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-gray-100 dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg"></div>
                <span>Not Answered</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Completed State
  if (quizState.status === 'completed') {
    const passed = quizState.score && quizState.score >= (quiz.passing_score || 80);
    const hasRemainingAttempts = submissionResult && (submissionResult.remaining_attempts === -1 || submissionResult.remaining_attempts > 0);
    
    return (
      <div className="space-y-6">
        <Card className={`border-2 shadow-2xl ${passed ? 'border-green-300 dark:border-green-700 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-green-950 dark:via-emerald-950 dark:to-teal-950' : 'border-yellow-300 dark:border-yellow-700 bg-gradient-to-br from-yellow-50 via-orange-50 to-amber-50 dark:from-yellow-950 dark:via-orange-950 dark:to-amber-950'}`}>
          <CardContent className="p-6 sm:p-10 text-center">
            <div className="mb-8">
              <div className={`h-20 w-20 sm:h-24 sm:w-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl animate-bounce ${passed ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-yellow-500 to-orange-600'}`}>
                {passed ? (
                  <Trophy className="h-10 w-10 sm:h-12 sm:w-12 text-white" />
                ) : (
                  <AlertCircle className="h-10 w-10 sm:h-12 sm:w-12 text-white" />
                )}
              </div>
              <h3 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white mb-3">
                {passed ? 'Congratulations! 🎉' : 'Quiz Completed'}
              </h3>
              <p className="text-gray-700 dark:text-gray-300 text-base sm:text-lg mb-6 max-w-2xl mx-auto">
                {quizState.feedback || (passed ? 'You have successfully passed this quiz!' : 'Your answers have been submitted successfully.')}
              </p>
              {quizState.score !== undefined && (
                <div className={`text-6xl sm:text-7xl font-black mb-3 animate-pulse ${passed ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                  {Math.round(quizState.score)}%
                </div>
              )}
              {quiz.passing_score && (
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4 flex items-center justify-center gap-2">
                  <Trophy className="h-4 w-4" />
                  Passing Score: {quiz.passing_score}%
                </p>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-5 sm:p-6 shadow-lg border border-blue-100 dark:border-blue-900">
                <div className="flex justify-center mb-2">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                    <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{questions.length}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">Questions</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-5 sm:p-6 shadow-lg border border-green-100 dark:border-green-900">
                <div className="flex justify-center mb-2">
                  <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">{answeredCount}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">Answered</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-5 sm:p-6 shadow-lg border border-purple-100 dark:border-purple-900">
                <div className="flex justify-center mb-2">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                    <Timer className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 font-mono">{formatTime(timeElapsed)}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">Time Taken</div>
              </div>
            </div>
            
            {submissionResult && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-5 sm:p-6 mb-8 shadow-lg border border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
                      <RefreshCw className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Attempt Number</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">
                        {submissionResult.attempt_number} / {submissionResult.total_attempts === submissionResult.attempt_number && submissionResult.remaining_attempts === -1 ? '∞' : submissionResult.total_attempts}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-lg">
                      <Clock className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Remaining Attempts</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">
                        {submissionResult.remaining_attempts === -1 ? 'Unlimited' : submissionResult.remaining_attempts}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                variant="outline" 
                className="flex-1 h-12 sm:h-14 text-base font-semibold border-2 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-md hover:shadow-lg"
                onClick={() => {
                  setQuizState({
                    ...quizState,
                    status: 'viewing-feedback'
                  });
                }}
              >
                <FileText className="h-5 w-5 mr-2" />
                View Quiz Feedback
              </Button>
              
              {/* Show retake button if score is below passing and has remaining attempts */}
              {!passed && hasRemainingAttempts && (
                <Button 
                  className="flex-1 h-12 sm:h-14 text-base font-bold bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white shadow-md hover:shadow-lg transition-all"
                  onClick={() => {
                    // Reset quiz state for retake
                    setQuizState({
                      status: 'not-started',
                      currentQuestionIndex: 0,
                      answers: {},
                      attemptNumber: (submissionResult?.attempt_number || 0) + 1
                    });
                    setSubmissionResult(null);
                    setTimeElapsed(0);
                    setError(null);
                    toast.warning('Retake Quiz', {
                      description: `You scored below passing. You have ${submissionResult?.remaining_attempts === -1 ? 'unlimited' : submissionResult?.remaining_attempts} attempts remaining.`,
                      duration: 3000
                    });
                  }}
                >
                  <RefreshCw className="h-5 w-5 mr-2" />
                  Retake Quiz (Below Passing)
                </Button>
              )}

              {/* Show retake button if passed and has remaining attempts */}
              {passed && hasRemainingAttempts && (
                <Button 
                  className="flex-1 h-12 sm:h-14 text-base font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all"
                  onClick={() => {
                    // Reset quiz state for retake
                    setQuizState({
                      status: 'not-started',
                      currentQuestionIndex: 0,
                      answers: {},
                      attemptNumber: (submissionResult?.attempt_number || 0) + 1
                    });
                    setSubmissionResult(null);
                    setTimeElapsed(0);
                    setError(null);
                    toast.info('Ready to Retake', {
                      description: `Improve your score! You have ${submissionResult?.remaining_attempts === -1 ? 'unlimited' : submissionResult?.remaining_attempts} attempts remaining.`,
                      duration: 3000
                    });
                  }}
                >
                  <RefreshCw className="h-5 w-5 mr-2" />
                  Retake Quiz
                </Button>
              )}
            </div>
            
            {!hasRemainingAttempts && submissionResult && (
              <Alert className="mt-6 border-2 border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30 shadow-md">
                <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                <AlertDescription className="text-orange-800">
                  You have used all available attempts for this quiz.
                  {quiz.best_score && ` Your best score: ${quiz.best_score}%`}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Viewing Feedback State
  if (quizState.status === 'viewing-feedback') {
    const passed = quizState.score && quizState.score >= (quiz.passing_score || 70);
    const totalPoints = questions.reduce((sum, q) => sum + (q.points || 10), 0);
    
    return (
      <div className="space-y-6">
        {/* Header with Back Button */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => setQuizState({ ...quizState, status: 'completed' })}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Results
              </Button>
              <div className="flex items-center space-x-3">
                <Badge variant={passed ? 'default' : 'secondary'} className={passed ? 'bg-green-600' : 'bg-yellow-600'}>
                  Score: {Math.round(quizState.score || 0)}%
                </Badge>
                <Badge variant="outline">
                  {answeredCount}/{questions.length} Questions
                </Badge>
                <Badge variant="outline">
                  Total: {totalPoints} points
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Overall Feedback */}
        <Card className={`border-2 ${passed ? 'border-green-200 bg-green-50/50' : 'border-yellow-200 bg-yellow-50/50'}`}>
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className={`h-12 w-12 rounded-full flex items-center justify-center ${passed ? 'bg-green-500' : 'bg-yellow-500'}`}>
                {passed ? (
                  <Trophy className="h-6 w-6 text-white" />
                ) : (
                  <AlertCircle className="h-6 w-6 text-white" />
                )}
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {passed ? 'Congratulations! You Passed!' : 'Review Your Answers'}
                </h3>
                <p className="text-gray-700">
                  {quizState.feedback || (passed 
                    ? 'Great work! You have successfully completed this quiz.' 
                    : 'Review the feedback below to improve your understanding.'
                  )}
                </p>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Question-by-Question Feedback */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Question Feedback</h3>
          {questions.map((question, index) => {
            const userAnswer = quizState.answers[question.id];
            const isTextBased = ['short_answer', 'essay'].includes(question.question_type);
            const isTrueFalse = question.question_type === 'true_false';
            
            // For multiple choice questions
            const correctAnswers = question.answers?.filter((a: any) => a.is_correct);
            const userAnswerObj = question.answers?.find((a: any) => String(a.id) === String(userAnswer));
            
            // Determine if answer is correct
            let isCorrect = false;
            if (isTextBased) {
              // Text-based answers are considered submitted (manual grading needed)
              isCorrect = userAnswer && String(userAnswer).trim().length > 0;
            } else if (isTrueFalse) {
              isCorrect = correctAnswers?.some(ans => 
                String(userAnswer).toLowerCase() === ans.text.toLowerCase() ||
                (String(userAnswer).toLowerCase() === 'true' && ans.text.toLowerCase() in ['true', 't', 'yes', '1']) ||
                (String(userAnswer).toLowerCase() === 'false' && ans.text.toLowerCase() in ['false', 'f', 'no', '0'])
              ) || false;
            } else {
              isCorrect = userAnswerObj?.is_correct || false;
            }
            
            const hasCorrectInfo = question.answers?.some((a: any) => a.is_correct !== undefined);

            return (
              <Card key={question.id} className={`border-2 ${isCorrect ? 'border-green-200 bg-green-50/30' : isTextBased ? 'border-blue-200 bg-blue-50/30' : hasCorrectInfo ? 'border-red-200 bg-red-50/30' : 'border-gray-200 bg-gray-50/30'}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge variant="outline">Question {index + 1}</Badge>
                        <Badge variant="outline" className="text-xs">
                          {question.question_type?.replace('_', ' ').toUpperCase()}
                        </Badge>
                        {isTextBased ? (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                            <FileText className="h-3 w-3 mr-1" />
                            Requires Manual Grading
                          </Badge>
                        ) : hasCorrectInfo ? (
                          <Badge variant={isCorrect ? 'default' : 'destructive'} className={isCorrect ? 'bg-green-600' : 'bg-red-600'}>
                            {isCorrect ? (
                              <>
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Correct
                              </>
                            ) : (
                              <>
                                <XCircle className="h-3 w-3 mr-1" />
                                Incorrect
                              </>
                            )}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <FileText className="h-3 w-3 mr-1" />
                            Submitted
                          </Badge>
                        )}
                        <Badge variant="secondary">
                          {question.points} {question.points === 1 ? 'point' : 'points'}
                        </Badge>
                      </div>
                      <p className="text-gray-900 font-medium mb-4">{question.text}</p>
                      
                      {/* User's Answer - Different display for text-based */}
                      <div className="mb-3">
                        <p className="text-sm font-semibold text-gray-700 mb-1">Your Answer:</p>
                        {isTextBased ? (
                          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                            <p className="text-blue-900 whitespace-pre-wrap">
                              {userAnswer || <span className="italic text-gray-500">No answer provided</span>}
                            </p>
                          </div>
                        ) : isTrueFalse ? (
                          <div className={`p-3 rounded-lg ${isCorrect ? 'bg-green-100 border border-green-300' : 'bg-red-100 border border-red-300'}`}>
                            <p className={isCorrect ? 'text-green-900 font-semibold' : 'text-red-900 font-semibold'}>
                              {String(userAnswer).toUpperCase() || <span className="italic text-gray-500">No answer provided</span>}
                            </p>
                          </div>
                        ) : (
                          <div className={`p-3 rounded-lg ${isCorrect ? 'bg-green-100 border border-green-300' : 'bg-red-100 border border-red-300'}`}>
                            {userAnswerObj ? (
                              <p className={isCorrect ? 'text-green-900' : 'text-red-900'}>
                                {userAnswerObj.text}
                              </p>
                            ) : (
                              <p className="text-gray-500 italic">No answer provided</p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Correct Answer (if wrong and available) */}
                      {!isCorrect && hasCorrectInfo && correctAnswers && correctAnswers.length > 0 && (
                        <div className="mb-3">
                          <p className="text-sm font-semibold text-gray-700 mb-1">Correct Answer:</p>
                          <div className="p-3 rounded-lg bg-blue-100 border border-blue-300">
                            {correctAnswers.map((ans: any, idx: number) => (
                              <p key={ans.id} className="text-blue-900">
                                {correctAnswers.length > 1 && `${idx + 1}. `}{ans.text}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Note when correct answers are not shown */}
                      {!hasCorrectInfo && (
                        <Alert className="border-blue-200 bg-blue-50">
                          <AlertCircle className="h-4 w-4 text-blue-600" />
                          <AlertDescription className="text-blue-800 text-sm">
                            Correct answers are not available for review at this time. Contact your instructor for feedback.
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Explanation */}
                      {question.explanation && (
                        <div className="mt-3 p-3 bg-gray-100 rounded-lg border border-gray-300">
                          <p className="text-sm font-semibold text-gray-700 mb-1">Explanation:</p>
                          <p className="text-gray-800 text-sm">{question.explanation}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Back to Results Button */}
        <Card>
          <CardContent className="p-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setQuizState({ ...quizState, status: 'completed' })}
            >
              Back to Results Summary
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
};
