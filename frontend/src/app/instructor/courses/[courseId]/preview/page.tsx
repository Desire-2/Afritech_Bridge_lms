"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import CourseCreationService from '@/services/course-creation.service';
import { Course, Module, Lesson } from '@/types/api';
import { 
  Eye, 
  ArrowLeft, 
  BookOpen, 
  Clock, 
  Users, 
  Award, 
  CheckCircle2, 
  PlayCircle,
  FileText,
  BarChart3,
  GraduationCap,
  Target,
  Sparkles
} from 'lucide-react';

const CoursePreviewPage = () => {
  const params = useParams();
  const router = useRouter();
  const courseId = parseInt(params.courseId as string);
  const { token } = useAuth();
  
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (token && courseId) {
      fetchCourseData();
    }
  }, [token, courseId]);

  const fetchCourseData = async () => {
    try {
      setLoading(true);
      const courseData = await CourseCreationService.getCourseDetails(courseId);
      
      setCourse(courseData);
      // Extract modules from course data - they are nested in the course object
      const modulesData = courseData.modules || [];
      setModules(modulesData);
      
      // Auto-expand first module
      if (modulesData.length > 0) {
        setExpandedModules(new Set([modulesData[0].id]));
        setSelectedModule(modulesData[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load course data');
    } finally {
      setLoading(false);
    }
  };

  const toggleModule = (moduleId: number) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleId)) {
      newExpanded.delete(moduleId);
    } else {
      newExpanded.add(moduleId);
    }
    setExpandedModules(newExpanded);
  };

  const getTotalLessons = () => {
    return modules.reduce((total, module) => total + (module.lessons?.length || 0), 0);
  };

  const getEstimatedDuration = () => {
    if (course?.estimated_duration) return course.estimated_duration;
    const totalLessons = getTotalLessons();
    return `${Math.ceil(totalLessons * 0.5)} hours`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-6 rounded-lg">
          <p className="text-red-600 dark:text-red-400">{error || 'Course not found'}</p>
          <button 
            onClick={() => router.back()}
            className="mt-4 text-sm text-red-700 dark:text-red-300 hover:underline"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header with Hero Background */}
      <div className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-900 dark:via-indigo-900 dark:to-purple-900 text-white">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Back Button */}
          <button
            onClick={() => router.back()}
            className="mb-6 flex items-center gap-2 text-white/90 hover:text-white transition-colors group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">Back to Courses</span>
          </button>

          {/* Course Header */}
          <div className="flex items-start gap-6">
            <div className="flex-shrink-0">
              <div className="w-24 h-24 bg-white/10 backdrop-blur-lg rounded-2xl flex items-center justify-center border border-white/20">
                <Eye className="w-12 h-12 text-white" />
              </div>
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm ${
                  course.is_published 
                    ? 'bg-green-500/20 text-green-100 border border-green-400/30'
                    : 'bg-yellow-500/20 text-yellow-100 border border-yellow-400/30'
                }`}>
                  {course.is_published ? '✓ Published' : '⏳ Draft'}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/10 backdrop-blur-sm border border-white/20">
                  Course Preview
                </span>
              </div>
              
              <h1 className="text-4xl font-bold mb-3 text-white drop-shadow-lg">
                {course.title}
              </h1>
              
              <p className="text-lg text-white/90 mb-6 max-w-3xl">
                {course.description}
              </p>

              {/* Stats Row */}
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2 text-white/90">
                  <BookOpen className="w-5 h-5" />
                  <span className="font-medium">{modules.length} Modules</span>
                </div>
                <div className="flex items-center gap-2 text-white/90">
                  <PlayCircle className="w-5 h-5" />
                  <span className="font-medium">{getTotalLessons()} Lessons</span>
                </div>
                <div className="flex items-center gap-2 text-white/90">
                  <Clock className="w-5 h-5" />
                  <span className="font-medium">{getEstimatedDuration()}</span>
                </div>
                {course.level && (
                  <div className="flex items-center gap-2 text-white/90">
                    <Target className="w-5 h-5" />
                    <span className="font-medium capitalize">{course.level}</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex-shrink-0 flex flex-col gap-2">
              <Link
                href={`/instructor/courses/${courseId}`}
                className="px-6 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Edit Course
              </Link>
              <Link
                href={`/learn/${courseId}`}
                className="px-6 py-3 bg-white/10 backdrop-blur-sm text-white rounded-lg font-semibold hover:bg-white/20 transition-all border border-white/20 flex items-center justify-center gap-2 group"
                title={course.is_published ? "View course as your students see it" : "Preview course in student view (Draft mode)"}
              >
                <Eye className="w-4 h-4 group-hover:scale-110 transition-transform" />
                View as Student
                {!course.is_published && (
                  <span className="text-xs bg-yellow-500/80 text-yellow-900 px-2 py-0.5 rounded-full font-medium">
                    Preview
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar - Course Info Cards */}
          <div className="lg:col-span-1 space-y-6">
            {/* Quick Stats Card */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                Course Overview
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Modules</p>
                      <p className="text-xl font-bold text-slate-900 dark:text-white">{modules.length}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
                      <PlayCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Total Lessons</p>
                      <p className="text-xl font-bold text-slate-900 dark:text-white">{getTotalLessons()}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                      <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Est. Duration</p>
                      <p className="text-xl font-bold text-slate-900 dark:text-white">{getEstimatedDuration()}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Course Details Card */}
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 dark:from-blue-600 dark:to-indigo-700 rounded-xl shadow-lg p-6 text-white">
              <div className="flex items-center gap-2 mb-4">
                <GraduationCap className="w-6 h-6" />
                <h3 className="text-lg font-bold">Course Details</h3>
              </div>
              
              <div className="space-y-3">
                {course.category && (
                  <div className="flex items-center justify-between py-2 border-b border-white/20">
                    <span className="text-white/80">Category</span>
                    <span className="font-semibold">{course.category}</span>
                  </div>
                )}
                {course.level && (
                  <div className="flex items-center justify-between py-2 border-b border-white/20">
                    <span className="text-white/80">Level</span>
                    <span className="font-semibold capitalize">{course.level}</span>
                  </div>
                )}
                <div className="flex items-center justify-between py-2 border-b border-white/20">
                  <span className="text-white/80">Status</span>
                  <span className="font-semibold">{course.is_published ? 'Live' : 'Draft'}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-white/80">Created</span>
                  <span className="font-semibold">{new Date(course.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Achievement Preview Card */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Award className="w-6 h-6 text-yellow-500" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Student Rewards</h3>
              </div>
              
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Students completing this course will earn:
              </p>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Sparkles className="w-4 h-4 text-yellow-500" />
                  <span className="text-slate-700 dark:text-slate-300">Course completion certificate</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Sparkles className="w-4 h-4 text-yellow-500" />
                  <span className="text-slate-700 dark:text-slate-300">Achievement badges</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Sparkles className="w-4 h-4 text-yellow-500" />
                  <span className="text-slate-700 dark:text-slate-300">Learning streak rewards</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content - Course Curriculum */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
              <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                  <FileText className="w-7 h-7 text-blue-600" />
                  Course Curriculum
                </h2>
                <p className="text-slate-600 dark:text-slate-400 mt-2">
                  Click on modules to explore their lessons and content
                </p>
              </div>

              <div className="p-6">
                {modules.length === 0 ? (
                  <div className="text-center py-12">
                    <BookOpen className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-500 dark:text-slate-400 text-lg">
                      No modules added yet
                    </p>
                    <Link
                      href={`/instructor/courses/${courseId}`}
                      className="inline-block mt-4 text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Add modules to your course →
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {modules.map((module, index) => (
                      <div 
                        key={module.id}
                        className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                      >
                        {/* Module Header */}
                        <button
                          onClick={() => toggleModule(module.id)}
                          className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors text-left flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-md">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                {module.title}
                              </h3>
                              {module.description && (
                                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-1">
                                  {module.description}
                                </p>
                              )}
                              <div className="flex items-center gap-4 mt-2">
                                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                  <PlayCircle className="w-3.5 h-3.5" />
                                  {module.lessons?.length || 0} lessons
                                </span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  Order: {module.order_index}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <svg
                            className={`w-6 h-6 text-slate-400 transition-transform ${
                              expandedModules.has(module.id) ? 'rotate-180' : ''
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {/* Lessons List */}
                        {expandedModules.has(module.id) && (
                          <div className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                            {module.lessons && module.lessons.length > 0 ? (
                              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                                {module.lessons.map((lesson, lessonIndex) => (
                                  <div 
                                    key={lesson.id}
                                    className="px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors"
                                  >
                                    <div className="flex items-start gap-4">
                                      <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                                        <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                                          {lessonIndex + 1}
                                        </span>
                                      </div>
                                      
                                      <div className="flex-1 min-w-0">
                                        <h4 className="text-base font-medium text-slate-900 dark:text-white mb-1">
                                          {lesson.title}
                                        </h4>
                                        {lesson.description && (
                                          <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                                            {lesson.description}
                                          </p>
                                        )}
                                        <div className="flex items-center gap-3 mt-2">
                                          <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                            <FileText className="w-3 h-3" />
                                            {lesson.content_type || 'Content'}
                                          </span>
                                          {lesson.duration && (
                                            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                              <Clock className="w-3 h-3" />
                                              {lesson.duration}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      
                                      <CheckCircle2 className="w-5 h-5 text-slate-300 dark:text-slate-600 flex-shrink-0 mt-1" />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="px-6 py-8 text-center">
                                <PlayCircle className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                                <p className="text-slate-500 dark:text-slate-400 text-sm">
                                  No lessons in this module yet
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoursePreviewPage;
