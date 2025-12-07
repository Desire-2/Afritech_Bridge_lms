"use client";

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import InstructorAssessmentService from '@/services/instructor-assessment.service';
import InstructorService from '@/services/instructor.service';
import { QuizService } from '@/services/course.service';
import { Quiz, Course, Question } from '@/types/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

// =====================================
// VIEW QUIZ MODAL COMPONENT
// =====================================
interface ViewQuizModalProps {
  quiz: Quiz | null;
  isOpen: boolean;
  onClose: () => void;
  courses: Course[];
}

const ViewQuizModal: React.FC<ViewQuizModalProps> = ({ quiz, isOpen, onClose, courses }) => {
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [quizDetails, setQuizDetails] = useState<Quiz | null>(null);

  useEffect(() => {
    const fetchQuizDetails = async () => {
      if (!quiz?.id || !isOpen) return;
      
      setLoadingQuestions(true);
      try {
        const details = await QuizService.getQuiz(quiz.id);
        setQuizDetails(details);
      } catch (error) {
        console.error('Failed to fetch quiz details:', error);
        setQuizDetails(quiz); // Fallback to existing quiz data
      } finally {
        setLoadingQuestions(false);
      }
    };

    fetchQuizDetails();
  }, [quiz?.id, isOpen]);

  if (!quiz) return null;

  const courseName = quiz.course_title || courses.find(c => c.id === quiz.course_id)?.title || 'Unknown Course';
  const questions = quizDetails?.questions || quiz.questions || [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-3">
            {quiz.title}
            <Badge variant={quiz.is_published ? "default" : "secondary"}>
              {quiz.is_published ? 'Published' : 'Draft'}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Quiz details and questions overview
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Quiz Information */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Course</p>
              <p className="font-medium text-slate-900 dark:text-white">{courseName}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Time Limit</p>
              <p className="font-medium text-slate-900 dark:text-white">
                {quiz.time_limit ? `${quiz.time_limit} minutes` : 'No limit'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Max Attempts</p>
              <p className="font-medium text-slate-900 dark:text-white">
                {quiz.max_attempts === -1 ? 'Unlimited' : quiz.max_attempts || 'Not set'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Passing Score</p>
              <p className="font-medium text-slate-900 dark:text-white">
                {quiz.passing_score ? `${quiz.passing_score}%` : 'Not set'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Total Points</p>
              <p className="font-medium text-slate-900 dark:text-white">
                {quiz.points_possible || questions.reduce((acc, q) => acc + (q.points || 0), 0)} points
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Due Date</p>
              <p className="font-medium text-slate-900 dark:text-white">
                {quiz.due_date ? new Date(quiz.due_date).toLocaleDateString() : 'No due date'}
              </p>
            </div>
            {quiz.description && (
              <div className="col-span-2">
                <p className="text-sm text-slate-500 dark:text-slate-400">Description</p>
                <p className="font-medium text-slate-900 dark:text-white">{quiz.description}</p>
              </div>
            )}
          </div>

          {/* Quiz Settings */}
          <div className="flex flex-wrap gap-2">
            {quiz.shuffle_questions && (
              <Badge variant="outline">Shuffle Questions</Badge>
            )}
            {quiz.shuffle_answers && (
              <Badge variant="outline">Shuffle Answers</Badge>
            )}
            {quiz.show_correct_answers && (
              <Badge variant="outline">Show Correct Answers</Badge>
            )}
          </div>

          {/* Questions Preview */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Questions ({questions.length})
            </h3>
            
            {loadingQuestions ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-sky-500"></div>
                <span className="ml-3 text-slate-600 dark:text-slate-300">Loading questions...</span>
              </div>
            ) : questions.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <p className="text-slate-500 dark:text-slate-400">No questions added yet.</p>
                <Link
                  href={`/instructor/quizzes/${quiz.id}/edit`}
                  className="text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block"
                >
                  Add questions now →
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {questions.map((question, index) => (
                  <QuestionPreviewCard key={question.id} question={question} index={index} />
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Link
            href={`/instructor/quizzes/${quiz.id}/edit`}
            className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Edit Quiz
          </Link>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            Close
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// =====================================
// QUESTION PREVIEW CARD COMPONENT
// =====================================
interface QuestionPreviewCardProps {
  question: Question;
  index: number;
}

const QuestionPreviewCard: React.FC<QuestionPreviewCardProps> = ({ question, index }) => {
  const [expanded, setExpanded] = useState(false);
  
  const questionTypeLabels: Record<string, string> = {
    multiple_choice: 'Multiple Choice',
    true_false: 'True/False',
    short_answer: 'Short Answer',
    essay: 'Essay',
  };

  const questionTypeColors: Record<string, string> = {
    multiple_choice: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
    true_false: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
    short_answer: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
    essay: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  };

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-700 rounded-full text-sm font-medium text-slate-600 dark:text-slate-300">
            {index + 1}
          </span>
          <div>
            <p className="font-medium text-slate-900 dark:text-white line-clamp-1">
              {question.question_text || question.text}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full ${questionTypeColors[question.question_type] || 'bg-slate-100 text-slate-600'}`}>
                {questionTypeLabels[question.question_type] || question.question_type}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {question.points} {question.points === 1 ? 'point' : 'points'}
              </span>
            </div>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      
      {expanded && question.answers && question.answers.length > 0 && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Answer Options:</p>
          <div className="space-y-2">
            {question.answers.map((answer, ansIndex) => (
              <div
                key={answer.id || ansIndex}
                className={`flex items-center gap-2 p-2 rounded-md text-sm ${
                  answer.is_correct 
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {answer.is_correct && (
                  <svg className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
                <span className={answer.is_correct ? 'text-green-800 dark:text-green-300' : 'text-slate-700 dark:text-slate-300'}>
                  {answer.answer_text || answer.text}
                </span>
              </div>
            ))}
          </div>
          {question.explanation && (
            <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                <span className="font-medium">Explanation:</span> {question.explanation}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// =====================================
// DELETE CONFIRMATION MODAL COMPONENT
// =====================================
interface DeleteConfirmModalProps {
  quiz: Quiz | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({ 
  quiz, 
  isOpen, 
  onClose, 
  onConfirm, 
  isDeleting 
}) => {
  if (!quiz) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-red-600 dark:text-red-400">Delete Quiz</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this quiz? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <p className="font-medium text-red-800 dark:text-red-300">{quiz.title}</p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
              {quiz.questions?.length || 0} questions will be permanently deleted.
            </p>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="inline-flex items-center justify-center px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Deleting...
              </>
            ) : (
              'Delete Quiz'
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// =====================================
// QUIZ STATS CARD COMPONENT
// =====================================
interface QuizStatsProps {
  quizzes: Quiz[];
  courses: Course[];
}

const QuizStats: React.FC<QuizStatsProps> = ({ quizzes }) => {
  const totalQuizzes = quizzes.length;
  const publishedQuizzes = quizzes.filter(q => q.is_published).length;
  const draftQuizzes = totalQuizzes - publishedQuizzes;
  const totalQuestions = quizzes.reduce((acc, q) => acc + (q.questions?.length || 0), 0);

  const stats = [
    { label: 'Total Quizzes', value: totalQuizzes, color: 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' },
    { label: 'Published', value: publishedQuizzes, color: 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400' },
    { label: 'Drafts', value: draftQuizzes, color: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400' },
    { label: 'Total Questions', value: totalQuestions, color: 'bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {stats.map((stat) => (
        <div key={stat.label} className={`rounded-lg p-4 ${stat.color}`}>
          <p className="text-2xl font-bold">{stat.value}</p>
          <p className="text-sm opacity-80">{stat.label}</p>
        </div>
      ))}
    </div>
  );
};

// =====================================
// QUIZ CARD COMPONENT
// =====================================
interface QuizCardProps {
  quiz: Quiz;
  courses: Course[];
  onView: (quiz: Quiz) => void;
  onDelete: (quiz: Quiz) => void;
}

const QuizCard: React.FC<QuizCardProps> = ({ quiz, courses, onView, onDelete }) => {
  const courseName = quiz.course_title || courses.find(c => c.id === quiz.course_id)?.title || 'Unknown';
  
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white line-clamp-2">
            {quiz.title}
          </h3>
          <Badge variant={quiz.is_published ? "default" : "secondary"} className="ml-2 flex-shrink-0">
            {quiz.is_published ? 'Published' : 'Draft'}
          </Badge>
        </div>
        
        <div className="space-y-2 mb-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            <span className="font-medium">Course:</span> {courseName}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            <span className="font-medium">Questions:</span> {quiz.questions?.length || 0}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            <span className="font-medium">Time Limit:</span> {quiz.time_limit ? `${quiz.time_limit} min` : 'No limit'}
          </p>
          {quiz.max_attempts && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              <span className="font-medium">Attempts:</span> {quiz.max_attempts === -1 ? 'Unlimited' : quiz.max_attempts}
            </p>
          )}
          {quiz.passing_score && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              <span className="font-medium">Passing:</span> {quiz.passing_score}%
            </p>
          )}
        </div>
        
        <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 mb-4">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Created: {new Date(quiz.created_at).toLocaleDateString()}
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={() => onView(quiz)}
            className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-md text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-center"
          >
            View
          </button>
          <Link
            href={`/instructor/quizzes/${quiz.id}/edit`}
            className="flex-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-200 dark:hover:bg-blue-900/30 transition-colors text-center"
          >
            Edit
          </Link>
          <button
            onClick={() => onDelete(quiz)}
            className="px-3 py-2 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md text-sm font-medium hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors"
            title="Delete Quiz"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

// =====================================
// EMPTY STATE COMPONENT
// =====================================
interface EmptyStateProps {
  hasQuizzes: boolean;
  hasFilter: boolean;
}

const EmptyState: React.FC<EmptyStateProps> = ({ hasQuizzes, hasFilter }) => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-8 text-center">
      <div className="max-w-md mx-auto">
        <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
          {!hasQuizzes ? 'No quizzes yet' : 'No quizzes match your filter'}
        </h3>
        <p className="text-slate-600 dark:text-slate-400 mb-4">
          {!hasQuizzes 
            ? "You haven't created any quizzes yet. Get started by creating your first quiz."
            : "Try selecting a different course filter or reset the filter to see all quizzes."
          }
        </p>
        {!hasQuizzes && (
          <Link 
            href="/instructor/quizzes/create" 
            className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Your First Quiz
          </Link>
        )}
      </div>
    </div>
  );
};

// =====================================
// MAIN QUIZZES PAGE COMPONENT
// =====================================
const QuizzesPage = () => {
  const { token } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  
  // Modal states
  const [viewQuiz, setViewQuiz] = useState<Quiz | null>(null);
  const [deleteQuiz, setDeleteQuiz] = useState<Quiz | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const fetchData = useCallback(async () => {
    if (!token) return;
    
    setLoading(true);
    setError(null);
    try {
      const [coursesData, quizzesData] = await Promise.all([
        InstructorService.getMyCourses(),
        InstructorAssessmentService.getAllQuizzes()
      ]);
      
      setCourses(Array.isArray(coursesData) ? coursesData : []);
      setQuizzes(Array.isArray(quizzesData) ? quizzesData : []);
    } catch (err: any) {
      console.error('Quizzes fetch error:', err);
      setError(err.message || 'Failed to load quizzes');
      setCourses([]);
      setQuizzes([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter quizzes by course and search query
  const filteredQuizzes = Array.isArray(quizzes) ? quizzes.filter(quiz => {
    const matchesCourse = selectedCourse === 'all' || quiz.course_id === parseInt(selectedCourse, 10);
    const matchesSearch = !searchQuery || 
      quiz.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (quiz.description && quiz.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCourse && matchesSearch;
  }) : [];

  const handleViewQuiz = (quiz: Quiz) => {
    setViewQuiz(quiz);
  };

  const handleDeleteClick = (quiz: Quiz) => {
    setDeleteQuiz(quiz);
  };

  const handleConfirmDelete = async () => {
    if (!deleteQuiz) return;
    
    setIsDeleting(true);
    try {
      await InstructorAssessmentService.deleteQuiz(deleteQuiz.id);
      setQuizzes(prev => prev.filter(q => q.id !== deleteQuiz.id));
      setDeleteQuiz(null);
    } catch (err: any) {
      console.error('Delete quiz error:', err);
      alert('Failed to delete quiz: ' + (err.message || 'Unknown error'));
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isClient || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-sky-500"></div>
        <span className="ml-3 text-slate-600 dark:text-slate-300">Loading quizzes...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-6 rounded-lg text-center my-10">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button 
          onClick={fetchData} 
          className="mt-4 px-4 py-2 bg-red-100 dark:bg-red-800/30 text-red-700 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-800/50"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">My Quizzes</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">Manage and create quizzes for your courses</p>
        </div>
        <Link
          href="/instructor/quizzes/create"
          className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create New Quiz
        </Link>
      </div>

      {/* Stats */}
      {quizzes.length > 0 && <QuizStats quizzes={quizzes} courses={courses} />}

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="search" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Search Quizzes
            </label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                id="search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title or description..."
                className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
              />
            </div>
          </div>
          <div className="md:w-64">
            <label htmlFor="course" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Filter by Course
            </label>
            <select
              id="course"
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
            >
              <option value="all">All Courses</option>
              {Array.isArray(courses) && courses.map(course => (
                <option key={course.id} value={course.id.toString()}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Active filters indicator */}
        {(selectedCourse !== 'all' || searchQuery) && (
          <div className="mt-4 flex items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">Active filters:</span>
            {selectedCourse !== 'all' && (
              <Badge variant="secondary" className="cursor-pointer" onClick={() => setSelectedCourse('all')}>
                Course: {courses.find(c => c.id.toString() === selectedCourse)?.title}
                <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Badge>
            )}
            {searchQuery && (
              <Badge variant="secondary" className="cursor-pointer" onClick={() => setSearchQuery('')}>
                Search: &quot;{searchQuery}&quot;
                <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Badge>
            )}
            <button
              onClick={() => { setSelectedCourse('all'); setSearchQuery(''); }}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Quizzes List */}
      {filteredQuizzes.length === 0 ? (
        <EmptyState hasQuizzes={quizzes.length > 0} hasFilter={selectedCourse !== 'all' || !!searchQuery} />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredQuizzes.map((quiz) => (
            <QuizCard
              key={quiz.id}
              quiz={quiz}
              courses={courses}
              onView={handleViewQuiz}
              onDelete={handleDeleteClick}
            />
          ))}
        </div>
      )}

      {/* View Quiz Modal */}
      <ViewQuizModal
        quiz={viewQuiz}
        isOpen={!!viewQuiz}
        onClose={() => setViewQuiz(null)}
        courses={courses}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        quiz={deleteQuiz}
        isOpen={!!deleteQuiz}
        onClose={() => setDeleteQuiz(null)}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
};

export default QuizzesPage;