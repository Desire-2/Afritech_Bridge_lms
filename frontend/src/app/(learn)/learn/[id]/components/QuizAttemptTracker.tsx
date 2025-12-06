import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
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
  ArrowLeft
} from 'lucide-react';
import type { ContentQuiz, QuizQuestion } from '@/services/contentAssignmentApi';
import ContentAssignmentService from '@/services/contentAssignmentApi';
import { toast } from 'sonner';

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

  // Timer effect
  useEffect(() => {
    if (quizState.status === 'in-progress') {
      const interval = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [quizState.status]);

  const startQuiz = () => {
    setQuizState({
      ...quizState,
      status: 'in-progress',
      currentQuestionIndex: 0,
      answers: {}
    });
    setTimeElapsed(0);
    onStartQuiz();
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

  const submitQuiz = async () => {
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
          </Alert>
        )}
        
        <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">{quiz.title}</h3>
                <p className="text-gray-600 mt-2">{quiz.description}</p>
              </div>
              <Badge className="bg-blue-600 text-white">
                <FileText className="h-4 w-4 mr-1" />
                Quiz
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{questions.length}</div>
                <div className="text-sm text-gray-600">Questions</div>
              </div>
              
              {quiz.time_limit ? (
                <div className="bg-white rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-orange-600">{quiz.time_limit}</div>
                  <div className="text-sm text-gray-600">Minutes</div>
                </div>
              ) : (
                <div className="bg-white rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">∞</div>
                  <div className="text-sm text-gray-600">No Time Limit</div>
                </div>
              )}
              
              <div className="bg-white rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">{quiz.passing_score || 70}%</div>
                <div className="text-sm text-gray-600">Passing Score</div>
              </div>
              
              {quiz.max_attempts && quiz.max_attempts !== -1 ? (
                <div className="bg-white rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-indigo-600">{quiz.max_attempts}</div>
                  <div className="text-sm text-gray-600">Max Attempts</div>
                </div>
              ) : (
                <div className="bg-white rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">∞</div>
                  <div className="text-sm text-gray-600">Unlimited Attempts</div>
                </div>
              )}
            </div>
            
            <div className="bg-white rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                <AlertCircle className="h-4 w-4 mr-2 text-blue-600" />
                Instructions:
              </h4>
              <ul className="list-disc list-inside space-y-2 text-gray-700 text-sm">
                <li>Read each question carefully before answering</li>
                {quiz.time_limit && (
                  <li>You have {quiz.time_limit} minutes to complete the quiz</li>
                )}
                {!quiz.time_limit && (
                  <li>No time limit - take your time to answer thoughtfully</li>
                )}
                {quiz.max_attempts && quiz.max_attempts !== -1 ? (
                  <li>You can attempt this quiz up to {quiz.max_attempts} times</li>
                ) : (
                  <li>Unlimited attempts available</li>
                )}
                <li>You need {quiz.passing_score || 70}% to pass this quiz</li>
                <li>You can navigate between questions before submitting</li>
                {quiz.shuffle_questions && (
                  <li className="text-blue-600">Questions are presented in random order</li>
                )}
                {quiz.shuffle_answers && (
                  <li className="text-blue-600">Answer choices are randomized</li>
                )}
              </ul>
            </div>
            
            <Button 
              onClick={startQuiz}
              disabled={!canAttempt}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="h-5 w-5 mr-2" />
              {canAttempt ? 'Start Quiz' : 'Maximum Attempts Reached'}
            </Button>
            
            {maxAttempts !== -1 && (
              <div className="mt-4 text-center text-sm text-gray-600">
                Attempts: {attemptsUsed} / {maxAttempts}
                {quiz.best_score && ` • Best Score: ${quiz.best_score}%`}
              </div>
            )}
          </CardContent>
        </Card>
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

        {/* Quiz Header */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Badge variant="outline" className="bg-blue-50">
                  Question {quizState.currentQuestionIndex + 1} of {questions.length}
                </Badge>
                <Badge variant={answeredCount === questions.length ? 'default' : 'secondary'}>
                  {answeredCount}/{questions.length} Answered
                </Badge>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 text-gray-600">
                  <Timer className="h-4 w-4" />
                  <span className="font-mono">{formatTime(timeElapsed)}</span>
                </div>
                {quiz.time_limit && (
                  <Badge variant="destructive">
                    <Clock className="h-3 w-3 mr-1" />
                    {quiz.time_limit - Math.floor(timeElapsed / 60)} min left
                  </Badge>
                )}
              </div>
            </div>
            
            <Progress value={progressPercentage} className="mt-4" />
          </CardContent>
        </Card>

        {/* Question Card */}
        <Card className="border-2 border-blue-200">
          <CardContent className="p-6">
            <div className="mb-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs">
                      Question {quizState.currentQuestionIndex + 1}
                    </Badge>
                    {currentQuestion.points && (
                      <Badge variant="outline" className="text-xs">
                        {currentQuestion.points} {currentQuestion.points === 1 ? 'point' : 'points'}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {currentQuestion.question_type?.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">
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
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    quizState.answers[currentQuestion.id] === answer.id.toString()
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`min-w-8 h-8 rounded-full border-2 flex items-center justify-center font-semibold ${
                      quizState.answers[currentQuestion.id] === answer.id.toString()
                        ? 'border-blue-500 bg-blue-500 text-white'
                        : 'border-gray-300 text-gray-600'
                    }`}>
                      {quizState.answers[currentQuestion.id] === answer.id.toString() ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        String.fromCharCode(65 + index)
                      )}
                    </div>
                    <span className="text-gray-900 flex-1 pt-1">{answer.text}</span>
                  </div>
                </button>
              ))}

              {/* True/False Question */}
              {currentQuestion.question_type === 'true_false' && (
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    type="button"
                    variant={quizState.answers[currentQuestion.id] === 'true' ? 'default' : 'outline'}
                    className={`h-20 text-lg ${
                      quizState.answers[currentQuestion.id] === 'true'
                        ? 'bg-green-600 hover:bg-green-700'
                        : 'hover:border-green-400'
                    }`}
                    onClick={() => handleAnswerSelect(currentQuestion.id, 'true')}
                  >
                    <CheckCircle className="h-6 w-6 mr-2" />
                    True
                  </Button>
                  <Button
                    type="button"
                    variant={quizState.answers[currentQuestion.id] === 'false' ? 'default' : 'outline'}
                    className={`h-20 text-lg ${
                      quizState.answers[currentQuestion.id] === 'false'
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'hover:border-red-400'
                    }`}
                    onClick={() => handleAnswerSelect(currentQuestion.id, 'false')}
                  >
                    <XCircle className="h-6 w-6 mr-2" />
                    False
                  </Button>
                </div>
              )}

              {/* Short Answer Question */}
              {currentQuestion.question_type === 'short_answer' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Your Answer:
                  </label>
                  <Input
                    type="text"
                    placeholder="Type your answer here..."
                    value={quizState.answers[currentQuestion.id] || ''}
                    onChange={(e) => handleAnswerSelect(currentQuestion.id, e.target.value)}
                    className="w-full text-base"
                  />
                  <p className="text-xs text-gray-500">
                    Enter a concise answer to the question above.
                  </p>
                </div>
              )}

              {/* Essay Question */}
              {currentQuestion.question_type === 'essay' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Your Answer:
                  </label>
                  <Textarea
                    placeholder="Write your detailed answer here..."
                    value={quizState.answers[currentQuestion.id] || ''}
                    onChange={(e) => handleAnswerSelect(currentQuestion.id, e.target.value)}
                    className="w-full min-h-[200px] text-base"
                    rows={8}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Provide a comprehensive, well-structured response.</span>
                    <span>{(quizState.answers[currentQuestion.id] || '').length} characters</span>
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
            <div className="flex justify-between items-center mt-6 pt-6 border-t">
              <Button
                onClick={() => navigateQuestion('prev')}
                disabled={quizState.currentQuestionIndex === 0}
                variant="outline"
              >
                Previous
              </Button>
              
              <div className="text-sm text-gray-600">
                {quizState.currentQuestionIndex + 1} of {questions.length}
              </div>
              
              {quizState.currentQuestionIndex === questions.length - 1 ? (
                <Button
                  onClick={submitQuiz}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
                  disabled={!allQuestionsAnswered || submitting}
                  title={!allQuestionsAnswered ? `Answer all ${questions.length} questions to submit` : 'Submit your quiz'}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      Submit Quiz {!allQuestionsAnswered && `(${answeredCount}/${questions.length})`}
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={() => navigateQuestion('next')}
                  disabled={quizState.currentQuestionIndex === questions.length - 1}
                >
                  Next
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Question Navigator */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              {questions.map((q, index) => (
                <button
                  key={q.id}
                  onClick={() => setQuizState({ ...quizState, currentQuestionIndex: index })}
                  className={`w-10 h-10 rounded-lg font-semibold transition-all ${
                    index === quizState.currentQuestionIndex
                      ? 'bg-blue-600 text-white'
                      : quizState.answers[q.id]
                      ? 'bg-green-100 text-green-700 border-2 border-green-300'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {index + 1}
                </button>
              ))}
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
        <Card className={`border-2 ${passed ? 'border-green-200 bg-gradient-to-r from-green-50 to-emerald-50' : 'border-yellow-200 bg-gradient-to-r from-yellow-50 to-orange-50'}`}>
          <CardContent className="p-8 text-center">
            <div className="mb-6">
              <div className={`h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4 ${passed ? 'bg-green-500' : 'bg-yellow-500'}`}>
                {passed ? (
                  <Trophy className="h-8 w-8 text-white" />
                ) : (
                  <AlertCircle className="h-8 w-8 text-white" />
                )}
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {passed ? 'Quiz Passed! 🎉' : 'Quiz Completed'}
              </h3>
              <p className="text-gray-600 mb-4">
                {quizState.feedback || 'Your answers have been submitted successfully.'}
              </p>
              {quizState.score !== undefined && (
                <div className="text-5xl font-bold mb-2" style={{ color: passed ? '#10b981' : '#f59e0b' }}>
                  {Math.round(quizState.score)}%
                </div>
              )}
              {quiz.passing_score && (
                <p className="text-sm text-gray-500 mb-4">
                  Passing Score: {quiz.passing_score}%
                </p>
              )}
            </div>
            
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">{questions.length}</div>
                <div className="text-sm text-gray-600">Questions</div>
              </div>
              <div className="bg-white rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">{answeredCount}</div>
                <div className="text-sm text-gray-600">Answered</div>
              </div>
              <div className="bg-white rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-600">{formatTime(timeElapsed)}</div>
                <div className="text-sm text-gray-600">Time Taken</div>
              </div>
            </div>
            
            {submissionResult && (
              <div className="bg-white rounded-lg p-4 mb-6">
                <div className="grid grid-cols-2 gap-4 text-left">
                  <div>
                    <p className="text-sm text-gray-600">Attempt Number</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {submissionResult.attempt_number} / {submissionResult.total_attempts === submissionResult.attempt_number && submissionResult.remaining_attempts === -1 ? '∞' : submissionResult.total_attempts}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Remaining Attempts</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {submissionResult.remaining_attempts === -1 ? 'Unlimited' : submissionResult.remaining_attempts}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => {
                  setQuizState({
                    ...quizState,
                    status: 'viewing-feedback'
                  });
                }}
              >
                <FileText className="h-4 w-4 mr-2" />
                View Quiz Feedback
              </Button>
              
              {hasRemainingAttempts && (
                <Button 
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
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
                      description: `You have ${submissionResult?.remaining_attempts === -1 ? 'unlimited' : submissionResult?.remaining_attempts} attempts remaining.`,
                      duration: 3000
                    });
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retake Quiz
                </Button>
              )}
            </div>
            
            {!hasRemainingAttempts && submissionResult && (
              <Alert className="mt-4 border-orange-200 bg-orange-50">
                <AlertCircle className="h-4 w-4 text-orange-600" />
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
