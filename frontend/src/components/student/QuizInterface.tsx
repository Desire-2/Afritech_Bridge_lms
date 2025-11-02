"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Trophy, 
  Target,
  FileText,
  Upload,
  Download,
  Eye,
  RotateCcw,
  Send,
  Save,
  ArrowLeft,
  ArrowRight,
  Flag,
  HelpCircle,
  Calculator,
  Book,
  Lightbulb,
  Star,
  ChevronDown,
  ChevronUp,
  Play,
  Pause
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StudentApiService, Quiz, QuizQuestion, Assessment } from '@/services/studentApi';

interface QuizTimerProps {
  timeLimit: number; // in minutes
  onTimeUp: () => void;
  isActive: boolean;
}

const QuizTimer: React.FC<QuizTimerProps> = ({ timeLimit, onTimeUp, isActive }) => {
  const [timeLeft, setTimeLeft] = useState(timeLimit * 60); // convert to seconds
  const [isWarning, setIsWarning] = useState(false);

  useEffect(() => {
    if (!isActive) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          onTimeUp();
          return 0;
        }
        
        // Warning when 5 minutes left
        if (prev <= 300 && !isWarning) {
          setIsWarning(true);
        }
        
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, onTimeUp, isWarning]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = ((timeLimit * 60 - timeLeft) / (timeLimit * 60)) * 100;

  return (
    <Card className={`${isWarning ? 'border-red-500 border-2 shadow-lg shadow-red-200 dark:shadow-red-900/50' : 'border-blue-200 dark:border-blue-800'}`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className={`p-2 rounded-full ${isWarning ? 'bg-red-100 dark:bg-red-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
              <Clock className={`h-5 w-5 ${isWarning ? 'text-red-600 dark:text-red-400 animate-pulse' : 'text-blue-600 dark:text-blue-400'}`} />
            </div>
            <span className="text-sm font-semibold">Time Remaining</span>
          </div>
          <span className={`text-2xl font-bold ${isWarning ? 'text-red-600 dark:text-red-400 animate-pulse' : 'text-blue-600 dark:text-blue-400'}`}>
            {formatTime(timeLeft)}
          </span>
        </div>
        <Progress 
          value={progressPercentage} 
          className={`h-3 ${isWarning ? 'bg-red-100 dark:bg-red-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}
        />
        {isWarning && (
          <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-xs text-red-700 dark:text-red-300 font-medium flex items-center space-x-1">
              <span className="text-lg">⚠️</span>
              <span>Less than 5 minutes remaining!</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface QuestionNavigatorProps {
  questions: QuizQuestion[];
  currentQuestion: number;
  answers: Record<number, any>;
  flaggedQuestions: Set<number>;
  onQuestionSelect: (index: number) => void;
}

const QuestionNavigator: React.FC<QuestionNavigatorProps> = ({
  questions,
  currentQuestion,
  answers,
  flaggedQuestions,
  onQuestionSelect
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getQuestionStatus = (index: number) => {
    const questionId = questions[index].id;
    const isAnswered = answers[questionId] !== undefined;
    const isFlagged = flaggedQuestions.has(questionId);
    const isCurrent = index === currentQuestion;

    if (isCurrent) return 'current';
    if (isFlagged) return 'flagged';
    if (isAnswered) return 'answered';
    return 'unanswered';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'current': return 'bg-primary text-primary-foreground';
      case 'answered': return 'bg-green-500 text-white';
      case 'flagged': return 'bg-yellow-500 text-white';
      default: return 'bg-muted text-muted-foreground hover:bg-muted/80';
    }
  };

  const answered = questions.filter((_, index) => {
    const questionId = questions[index].id;
    return answers[questionId] !== undefined;
  }).length;

  return (
    <Card>
      <CardHeader 
        className="cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Question Navigator</CardTitle>
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
        <div className="text-xs text-muted-foreground">
          {answered} of {questions.length} answered
        </div>
      </CardHeader>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="pt-0">
              <div className="grid grid-cols-5 gap-2">
                {questions.map((_, index) => {
                  const status = getQuestionStatus(index);
                  return (
                    <button
                      key={index}
                      onClick={() => onQuestionSelect(index)}
                      className={`w-8 h-8 rounded text-xs font-medium transition-colors ${getStatusColor(status)}`}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>
              
              <div className="mt-4 space-y-2 text-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-primary rounded"></div>
                  <span>Current</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span>Answered</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                  <span>Flagged</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-muted rounded"></div>
                  <span>Unanswered</span>
                </div>
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};

interface QuestionDisplayProps {
  question: QuizQuestion;
  answer: any;
  onAnswerChange: (answer: any) => void;
  questionNumber: number;
  totalQuestions: number;
}

const QuestionDisplay: React.FC<QuestionDisplayProps> = ({
  question,
  answer,
  onAnswerChange,
  questionNumber,
  totalQuestions
}) => {
  const renderQuestionInput = () => {
    switch (question.question_type) {
      case 'multiple_choice':
        return (
          <RadioGroup value={answer || ''} onValueChange={onAnswerChange}>
            <div className="space-y-3">
              {question.options?.map((option, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value={option} id={`option-${index}`} />
                  <label 
                    htmlFor={`option-${index}`} 
                    className="flex-1 cursor-pointer"
                  >
                    {option}
                  </label>
                </div>
              ))}
            </div>
          </RadioGroup>
        );
      
      case 'multiple_choice':
        if (question.options && question.options.length > 4) {
          // Multiple select for questions with many options
          const selectedOptions = answer || [];
          return (
            <div className="space-y-3">
              {question.options?.map((option, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <Checkbox
                    checked={selectedOptions.includes(option)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        onAnswerChange([...selectedOptions, option]);
                      } else {
                        onAnswerChange(selectedOptions.filter((o: string) => o !== option));
                      }
                    }}
                    id={`option-${index}`}
                  />
                  <label 
                    htmlFor={`option-${index}`} 
                    className="flex-1 cursor-pointer"
                  >
                    {option}
                  </label>
                </div>
              ))}
            </div>
          );
        }
        // Fall through to regular multiple choice
        break;
      
      case 'true_false':
        return (
          <RadioGroup value={answer || ''} onValueChange={onAnswerChange}>
            <div className="space-y-3">
              <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="true" id="true" />
                <label htmlFor="true" className="flex-1 cursor-pointer">True</label>
              </div>
              <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="false" id="false" />
                <label htmlFor="false" className="flex-1 cursor-pointer">False</label>
              </div>
            </div>
          </RadioGroup>
        );
      
      case 'short_answer':
        return (
          <Textarea
            placeholder="Enter your answer here..."
            value={answer || ''}
            onChange={(e) => onAnswerChange(e.target.value)}
            className="min-h-[120px]"
          />
        );
      
      default:
        return <p className="text-muted-foreground">Unsupported question type</p>;
    }
  };

  return (
    <motion.div
      key={question.id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border-2 border-slate-200 dark:border-slate-700 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-800 dark:to-blue-900/20 border-b-2 border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="px-4 py-2 text-base font-bold bg-white dark:bg-slate-800 shadow-sm">
              <span className="mr-2">📝</span>
              Question {questionNumber} of {totalQuestions}
            </Badge>
            <Badge variant="secondary" className="px-4 py-2 text-base font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 shadow-sm">
              <span className="mr-2">🎯</span>
              {question.points} point{question.points !== 1 ? 's' : ''}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-8">
          <div>
            <h3 className="text-xl font-bold mb-6 text-slate-900 dark:text-white leading-relaxed">{question.question_text}</h3>
            {renderQuestionInput()}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

interface QuizInterfaceProps {
  quizId: number;
  onComplete: (results: any) => void;
}

const QuizInterface: React.FC<QuizInterfaceProps> = ({ quizId, onComplete }) => {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(new Set());
  const [timeLeft, setTimeLeft] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const startQuiz = async () => {
      try {
        const attemptData = await StudentApiService.startQuizAttempt(quizId);
        setAttemptId(attemptData.attempt_id);
        setQuiz(attemptData.quiz);
        setTimeLeft(attemptData.quiz.time_limit_minutes * 60);
      } catch (error) {
        console.error('Failed to start quiz:', error);
      } finally {
        setLoading(false);
      }
    };

    startQuiz();
  }, [quizId]);

  const handleAnswerChange = (questionId: number, answer: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const toggleFlag = (questionId: number) => {
    setFlaggedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  const handleSubmit = async () => {
    if (!quiz || !attemptId) return;

    setIsSubmitting(true);
    try {
      const results = await StudentApiService.submitQuiz(quizId, attemptId, answers);
      onComplete(results);
    } catch (error) {
      console.error('Failed to submit quiz:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTimeUp = () => {
    handleSubmit();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Failed to load quiz</p>
        </div>
      </div>
    );
  }

  const currentQuizQuestion = quiz.questions[currentQuestion];
  const progress = ((currentQuestion + 1) / quiz.questions.length) * 100;
  const answeredQuestions = Object.keys(answers).length;

  return (
    <motion.div 
      className="min-h-screen bg-muted/30 p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <Card className="border-2 border-blue-200 dark:border-blue-800 shadow-xl">
          <CardContent className="p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-2xl">❓</span>
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{quiz.title}</h1>
                    <p className="text-muted-foreground mt-1">{quiz.description}</p>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-4 border-2 border-green-200 dark:border-green-800 shadow-md">
                  <div className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                    {answeredQuestions}/{quiz.questions.length}
                  </div>
                  <div className="text-sm text-muted-foreground font-medium mt-1">Answered</div>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Progress</span>
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-bold">
                    {Math.round(progress)}%
                  </span>
                </div>
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Question {currentQuestion + 1} of {quiz.questions.length}
                </span>
              </div>
              <Progress value={progress} className="h-3 shadow-inner" />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Question Area */}
          <div className="lg:col-span-3 space-y-6">
            <QuestionDisplay
              question={currentQuizQuestion}
              answer={answers[currentQuizQuestion.id]}
              onAnswerChange={(answer) => handleAnswerChange(currentQuizQuestion.id, answer)}
              questionNumber={currentQuestion + 1}
              totalQuestions={quiz.questions.length}
            />

            {/* Navigation */}
            <Card className="border-2 border-slate-200 dark:border-slate-700 shadow-md">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
                    disabled={currentQuestion === 0}
                    className="px-6 py-3 font-semibold text-base shadow-sm hover:shadow-md transition-all disabled:opacity-50"
                  >
                    <ArrowLeft className="h-5 w-5 mr-2" />
                    Previous
                  </Button>

                  <div className="flex items-center space-x-3">
                    <Button
                      variant="ghost"
                      onClick={() => toggleFlag(currentQuizQuestion.id)}
                      className={`px-4 py-3 font-semibold text-base shadow-sm hover:shadow-md transition-all ${
                        flaggedQuestions.has(currentQuizQuestion.id) 
                          ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300' 
                          : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      <Flag className="h-5 w-5 mr-2" />
                      {flaggedQuestions.has(currentQuizQuestion.id) ? 'Unflag' : 'Flag'}
                    </Button>

                    <Button 
                      variant="ghost"
                      className="px-4 py-3 font-semibold text-base shadow-sm hover:shadow-md transition-all hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    >
                      <Save className="h-5 w-5 mr-2" />
                      Save
                    </Button>
                  </div>

                  {currentQuestion < quiz.questions.length - 1 ? (
                    <Button
                      onClick={() => setCurrentQuestion(currentQuestion + 1)}
                      className="px-6 py-3 font-semibold text-base shadow-md hover:shadow-lg transition-all bg-blue-600 hover:bg-blue-700"
                    >
                      Next
                      <ArrowRight className="h-5 w-5 ml-2" />
                    </Button>
                  ) : (
                    <Button 
                      onClick={() => setShowSubmitDialog(true)}
                      className="px-6 py-3 font-semibold text-base shadow-md hover:shadow-lg transition-all bg-green-600 hover:bg-green-700"
                    >
                      <Send className="h-5 w-5 mr-2" />
                      Submit Quiz
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Timer */}
            <QuizTimer
              timeLimit={quiz.time_limit_minutes}
              onTimeUp={handleTimeUp}
              isActive={true}
            />

            {/* Question Navigator */}
            <QuestionNavigator
              questions={quiz.questions}
              currentQuestion={currentQuestion}
              answers={answers}
              flaggedQuestions={flaggedQuestions}
              onQuestionSelect={setCurrentQuestion}
            />

            {/* Quiz Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Quiz Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span>Time Limit:</span>
                  <span>{quiz.time_limit_minutes} minutes</span>
                </div>
                <div className="flex justify-between">
                  <span>Questions:</span>
                  <span>{quiz.questions.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Passing Score:</span>
                  <span>{quiz.passing_score}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Max Attempts:</span>
                  <span>{quiz.max_attempts || 'Unlimited'}</span>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Calculator className="h-4 w-4 mr-2" />
                  Calculator
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Book className="h-4 w-4 mr-2" />
                  Reference
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Help
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Submit Confirmation Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Quiz</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>Are you sure you want to submit your quiz? You won't be able to change your answers after submission.</p>
            
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span>Total Questions:</span>
                <span>{quiz.questions.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Answered:</span>
                <span className={answeredQuestions === quiz.questions.length ? 'text-green-600' : 'text-yellow-600'}>
                  {answeredQuestions}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Unanswered:</span>
                <span className={quiz.questions.length - answeredQuestions === 0 ? 'text-green-600' : 'text-red-600'}>
                  {quiz.questions.length - answeredQuestions}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Flagged:</span>
                <span>{flaggedQuestions.size}</span>
              </div>
            </div>

            {answeredQuestions < quiz.questions.length && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You have {quiz.questions.length - answeredQuestions} unanswered questions. 
                  These will be marked as incorrect.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex space-x-2 justify-end">
              <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
                Review Answers
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit Quiz'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default QuizInterface;