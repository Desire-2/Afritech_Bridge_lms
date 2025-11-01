"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { StudentService, CourseProgress } from '@/services/student.service';
import { 
  BookOpen, Clock, CheckCircle2, Circle, Play, 
  ArrowLeft, BarChart3, Calendar, Trophy 
} from 'lucide-react';

const CourseProgressPage = () => {
  const params = useParams();
  const courseId = parseInt(params.courseId as string);
  
  const [progress, setProgress] = useState<CourseProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        setLoading(true);
        const data = await StudentService.getCourseProgress(courseId);
        setProgress(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load course progress');
      } finally {
        setLoading(false);
      }
    };

    if (courseId) {
      fetchProgress();
    }
  }, [courseId]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-8"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {[1, 2, 3].map((_, i) => (
                <div key={i} className="h-64 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
            <div className="h-96 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !progress) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-600 text-lg">{error || 'Course progress not found'}</p>
          <div className="mt-4 space-x-4">
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Try Again
            </button>
            <Link 
              href="/student/mylearning"
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Back to My Learning
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const totalLessons = progress.modules.reduce((sum, module) => sum + module.total_lessons, 0);
  const completedLessons = progress.modules.reduce((sum, module) => sum + module.completed_lessons, 0);

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <Link 
          href="/student/mylearning"
          className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to My Learning
        </Link>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">{progress.course.title}</h1>
        <p className="text-gray-600">{progress.course.description}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2">
          {/* Overall Progress Card */}
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">Overall Progress</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="text-center">
                <div className="relative w-20 h-20 mx-auto mb-3">
                  <svg className="w-20 h-20 transform -rotate-90">
                    <circle
                      cx="40"
                      cy="40"
                      r="32"
                      stroke="currentColor"
                      strokeWidth="6"
                      fill="transparent"
                      className="text-gray-200"
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r="32"
                      stroke="currentColor"
                      strokeWidth="6"
                      fill="transparent"
                      strokeDasharray={`${2 * Math.PI * 32}`}
                      strokeDashoffset={`${2 * Math.PI * 32 * (1 - progress.overall_progress / 100)}`}
                      className="text-indigo-600"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold text-gray-800">
                      {Math.round(progress.overall_progress)}%
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-600">Completion Rate</p>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center w-20 h-20 mx-auto mb-3 bg-blue-100 rounded-full">
                  <CheckCircle2 className="w-8 h-8 text-blue-600" />
                </div>
                <p className="text-lg font-bold text-gray-800">{completedLessons}/{totalLessons}</p>
                <p className="text-sm text-gray-600">Lessons Completed</p>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center w-20 h-20 mx-auto mb-3 bg-purple-100 rounded-full">
                  <Clock className="w-8 h-8 text-purple-600" />
                </div>
                <p className="text-lg font-bold text-gray-800">
                  {formatDuration(progress.total_time_spent)}
                </p>
                <p className="text-sm text-gray-600">Time Spent</p>
              </div>
            </div>

            {progress.last_accessed && (
              <div className="border-t pt-4">
                <p className="text-sm text-gray-600">
                  Last accessed: {new Date(progress.last_accessed).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>

          {/* Modules Progress */}
          <div className="space-y-6">
            {progress.modules.map((module, moduleIndex) => (
              <div key={module.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="p-6 border-b bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">
                        Module {module.order}: {module.title}
                      </h3>
                      {module.description && (
                        <p className="text-gray-600 mt-1">{module.description}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-800">
                        {module.completed_lessons}/{module.total_lessons} lessons
                      </div>
                      <div className="text-sm text-gray-600">
                        {Math.round(module.progress)}% complete
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-indigo-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${module.progress}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="space-y-3">
                    {module.lessons.map((lesson, lessonIndex) => (
                      <div 
                        key={lesson.id} 
                        className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${
                          lesson.completed 
                            ? 'bg-green-50 border-green-200' 
                            : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex-shrink-0">
                          {lesson.completed ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          ) : (
                            <Circle className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">
                              {lesson.order}.
                            </span>
                            <h4 className="font-medium text-gray-800 truncate">
                              {lesson.title}
                            </h4>
                            <span className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded-full">
                              {lesson.content_type}
                            </span>
                          </div>
                          
                          {lesson.completed && lesson.completion_date && (
                            <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                              <span>
                                Completed: {new Date(lesson.completion_date).toLocaleDateString()}
                              </span>
                              {lesson.time_spent && (
                                <span>
                                  Time: {formatDuration(lesson.time_spent)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex-shrink-0">
                          {!lesson.completed && (
                            <Link
                              href={`/learn/${courseId}`}
                              className="flex items-center gap-1 px-3 py-1 text-sm text-indigo-600 hover:text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-50"
                            >
                              <Play className="w-3 h-3" />
                              Start
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Stats</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Progress</span>
                <span className="font-medium">{Math.round(progress.overall_progress)}%</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Lessons</span>
                <span className="font-medium">{completedLessons}/{totalLessons}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Time Spent</span>
                <span className="font-medium">{formatDuration(progress.total_time_spent)}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Modules</span>
                <span className="font-medium">{progress.modules.length}</span>
              </div>
            </div>
          </div>

          {/* Next Steps */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Next Steps</h3>
            
            <div className="space-y-3">
              {progress.current_lesson_id ? (
                <Link
                  href={`/student/learn/${courseId}`}
                  className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100"
                >
                  <Play className="w-5 h-5 text-indigo-600" />
                  <span className="font-medium text-indigo-700">Continue Learning</span>
                </Link>
              ) : (
                <Link
                  href={`/student/learn/${courseId}`}
                  className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100"
                >
                  <Play className="w-5 h-5 text-indigo-600" />
                  <span className="font-medium text-indigo-700">Start Course</span>
                </Link>
              )}
              
              <Link
                href={`/student/learn/${courseId}`}
                className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100"
              >
                <BookOpen className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-700">Go to Course</span>
              </Link>
            </div>
          </div>

          {/* Achievement Progress */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Potential Achievements</h3>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <Trophy className="w-5 h-5 text-amber-600" />
                <div className="flex-1">
                  <p className="font-medium text-amber-700">Course Completion</p>
                  <p className="text-xs text-amber-600">Complete all lessons</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <Clock className="w-5 h-5 text-blue-600" />
                <div className="flex-1">
                  <p className="font-medium text-blue-700">Dedicated Learner</p>
                  <p className="text-xs text-blue-600">Study for 10 hours</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseProgressPage;