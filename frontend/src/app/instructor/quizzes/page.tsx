"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { QuizService } from '@/services/course.service';
import InstructorService from '@/services/instructor.service';
import { Quiz, Course } from '@/types/api';

const QuizzesPage = () => {
  const { token } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!token) return;
      
      setLoading(true);
      setError(null);
      try {
        const coursesData = await InstructorService.getMyCourses();
        setCourses(Array.isArray(coursesData) ? coursesData : []);
        
        // Fetch quizzes for all courses
        const allQuizzes: Quiz[] = [];
        const validCoursesData = Array.isArray(coursesData) ? coursesData : [];
        for (const course of validCoursesData) {
          try {
            const courseQuizzes = await QuizService.getQuizzes(course.id);
            if (Array.isArray(courseQuizzes)) {
              allQuizzes.push(...courseQuizzes);
            }
          } catch (err) {
            console.warn(`Failed to fetch quizzes for course ${course.id}:`, err);
          }
        }
        
        setQuizzes(allQuizzes);
      } catch (err: any) {
        console.error('Quizzes fetch error:', err);
        setError(err.message || 'Failed to load quizzes');
        setCourses([]);
        setQuizzes([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  const filteredQuizzes = Array.isArray(quizzes) ? quizzes.filter(quiz => {
    if (selectedCourse === 'all') return true;
    return quiz.course_id === parseInt(selectedCourse);
  }) : [];

  const handleDeleteQuiz = async (quizId: number) => {
    if (!window.confirm('Are you sure you want to delete this quiz? This action cannot be undone.')) {
      return;
    }
    
    try {
      await QuizService.deleteQuiz(quizId);
      setQuizzes(Array.isArray(quizzes) ? quizzes.filter(quiz => quiz.id !== quizId) : []);
    } catch (err: any) {
      console.error('Delete quiz error:', err);
      alert('Failed to delete quiz: ' + (err.message || 'Unknown error'));
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
          onClick={() => window.location.reload()} 
          className="mt-4 px-4 py-2 bg-red-100 dark:bg-red-800/30 text-red-700 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-800/50"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">My Quizzes</h1>
        <Link
          href="/instructor/quizzes/create"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Create New Quiz
        </Link>
      </div>

      {/* Filter */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <div className="max-w-md">
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

      {/* Quizzes List */}
      {!Array.isArray(filteredQuizzes) || filteredQuizzes.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-8 text-center">
          <div className="max-w-md mx-auto">
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              {!Array.isArray(quizzes) || quizzes.length === 0 ? 'No quizzes yet' : 'No quizzes match your filter'}
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              {!Array.isArray(quizzes) || quizzes.length === 0 
                ? "You haven't created any quizzes yet. Get started by creating your first quiz."
                : "Try selecting a different course filter."
              }
            </p>
            {(!Array.isArray(quizzes) || quizzes.length === 0) && (
              <Link 
                href="/instructor/quizzes/create" 
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Create Your First Quiz
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.isArray(filteredQuizzes) && filteredQuizzes.map((quiz) => (
            <div key={quiz.id} className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white line-clamp-2">
                    {quiz.title}
                  </h3>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      quiz.is_published 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                    }`}>
                      {quiz.is_published ? 'Published' : 'Draft'}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-2 mb-4">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    <span className="font-medium">Course:</span> {Array.isArray(courses) ? courses.find(c => c.id === quiz.course_id)?.title || 'Unknown' : 'Unknown'}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    <span className="font-medium">Questions:</span> {quiz.questions?.length || 0}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    <span className="font-medium">Time Limit:</span> {quiz.time_limit ? `${quiz.time_limit} minutes` : 'No limit'}
                  </p>
                  {quiz.max_attempts && (
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      <span className="font-medium">Attempts:</span> {quiz.max_attempts === -1 ? 'Unlimited' : quiz.max_attempts}
                    </p>
                  )}
                </div>
                
                <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400 mb-4">
                  <span>Created: {new Date(quiz.created_at).toLocaleDateString()}</span>
                </div>
                
                <div className="flex space-x-2">
                  <Link
                    href={`/instructor/quizzes/${quiz.id}`}
                    className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-md text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-center"
                  >
                    View
                  </Link>
                  <Link
                    href={`/instructor/quizzes/${quiz.id}/edit`}
                    className="flex-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-200 dark:hover:bg-blue-900/30 transition-colors text-center"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDeleteQuiz(quiz.id)}
                    className="px-3 py-2 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md text-sm font-medium hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default QuizzesPage;