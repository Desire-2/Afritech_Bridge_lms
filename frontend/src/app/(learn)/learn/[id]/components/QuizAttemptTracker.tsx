import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Play,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Trophy,
  RefreshCw,
  FileText,
  Timer
} from 'lucide-react';
import type { ContentQuiz, QuizQuestion } from '@/services/contentAssignmentApi';

interface ExtendedQuiz extends ContentQuiz {
  time_limit?: number;
  max_attempts?: number;
  passing_score?: number;
  shuffle_questions?: boolean;
  shuffle_answers?: boolean;
  show_correct_answers?: boolean;
}

interface QuizAttemptTrackerProps {
  quiz: ExtendedQuiz;
  onStartQuiz: () => void;
  onSubmitQuiz: (answers: Record<number, string>) => void;
}

interface QuizState {
  status: 'not-started' | 'in-progress' | 'completed' | 'reviewing';
  currentQuestionIndex: number;
  answers: Record<number, string>;
  timeRemaining?: number;
  attemptNumber: number;
  score?: number;
  feedback?: string;
}

export const QuizAttemptTracker: React.FC<QuizAttemptTrackerProps> = ({
  quiz,
  onStartQuiz,
  onSubmitQuiz
}) => {
  const [quizState, setQuizState] = useState<QuizState>({
    status: 'not-started',
    currentQuestionIndex: 0,
    answers: {},
    attemptNumber: 1
  });

  const [timeElapsed, setTimeElapsed] = useState(0);
  
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

  const submitQuiz = () => {
    if (window.confirm('Are you sure you want to submit your quiz?')) {
      onSubmitQuiz(quizState.answers);
      setQuizState({
        ...quizState,
        status: 'completed'
      });
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const questions = quiz.questions || [];
  const currentQuestion = questions[quizState.currentQuestionIndex];
  const answeredCount = Object.keys(quizState.answers).length;
  const progressPercentage = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  // Not Started State
  if (quizState.status === 'not-started') {
    return (
      <div className="space-y-6">
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{questions.length}</div>
                <div className="text-sm text-gray-600">Questions</div>
              </div>
              
              {quiz.time_limit && (
                <div className="bg-white rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-orange-600">{quiz.time_limit}</div>
                  <div className="text-sm text-gray-600">Minutes</div>
                </div>
              )}
              
              {quiz.max_attempts && quiz.max_attempts !== -1 && (
                <div className="bg-white rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-purple-600">{quiz.max_attempts}</div>
                  <div className="text-sm text-gray-600">Max Attempts</div>
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
                {quiz.max_attempts && quiz.max_attempts !== -1 && (
                  <li>You can attempt this quiz up to {quiz.max_attempts} times</li>
                )}
                <li>Make sure to submit your quiz before time runs out</li>
                <li>You can navigate between questions before submitting</li>
              </ul>
            </div>
            
            <Button 
              onClick={startQuiz}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg"
            >
              <Play className="h-5 w-5 mr-2" />
              Start Quiz
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // In Progress State
  if (quizState.status === 'in-progress' && currentQuestion) {
    return (
      <div className="space-y-6">
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
                <h3 className="text-lg font-semibold text-gray-900 flex-1">
                  {currentQuestion.text}
                </h3>
                <Badge variant="outline">
                  {currentQuestion.question_type?.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
            </div>

            {/* Answer Options */}
            <div className="space-y-3">
              {currentQuestion.answers?.map((answer, index) => (
                <button
                  key={answer.id}
                  onClick={() => handleAnswerSelect(currentQuestion.id, answer.id.toString())}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    quizState.answers[currentQuestion.id] === answer.id.toString()
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      quizState.answers[currentQuestion.id] === answer.id.toString()
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300'
                    }`}>
                      {quizState.answers[currentQuestion.id] === answer.id.toString() && (
                        <CheckCircle className="h-4 w-4 text-white" />
                      )}
                    </div>
                    <span className="text-gray-900">{answer.text}</span>
                  </div>
                </button>
              ))}
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
                  className="bg-green-600 hover:bg-green-700"
                  disabled={answeredCount < questions.length}
                >
                  Submit Quiz
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
    return (
      <div className="space-y-6">
        <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
          <CardContent className="p-8 text-center">
            <div className="mb-6">
              <div className="h-16 w-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trophy className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Quiz Submitted!</h3>
              <p className="text-gray-600">
                Your answers have been submitted successfully. Your instructor will review and grade your quiz.
              </p>
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
            
            <Button variant="outline" className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              View Submission
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
};
