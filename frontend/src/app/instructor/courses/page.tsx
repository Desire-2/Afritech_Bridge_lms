"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import InstructorService from '@/services/instructor.service';
import { Course } from '@/types/api';

const InstructorCoursesPage = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const { token } = useAuth();

  // Handle client-side hydration
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const fetchCourses = async () => {
      if (!token) return;
      
      setLoading(true);
      setError(null);
      try {
        const coursesData = await InstructorService.getMyCourses();
        // Ensure courses is always an array
        setCourses(Array.isArray(coursesData) ? coursesData : []);
      } catch (err: any) {
        console.error('Courses fetch error:', err);
        setError(err.message || 'Failed to load courses');
        setCourses([]); // Set empty array on error
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, [token]);

  const handleDeleteCourse = async (courseId: number) => {
    if (!window.confirm('Are you sure you want to delete this course? This action cannot be undone.')) {
      return;
    }
    
    try {
      // Import CourseService dynamically to avoid circular imports
      const { CourseService } = await import('@/services/course.service');
      await CourseService.deleteCourse(courseId);
      setCourses(Array.isArray(courses) ? courses.filter(course => course.id !== courseId) : []);
    } catch (err: any) {
      console.error('Delete course error:', err);
      alert('Failed to delete course: ' + (err.message || 'Unknown error'));
    }
  };

  const handleTogglePublish = async (courseId: number, isPublished: boolean) => {
    try {
      const { CourseService } = await import('@/services/course.service');
      if (isPublished) {
        await CourseService.unpublishCourse(courseId);
      } else {
        await CourseService.publishCourse(courseId);
      }
      
      setCourses(Array.isArray(courses) ? courses.map(course => 
        course.id === courseId 
          ? { ...course, is_published: !isPublished }
          : course
      ) : []);
    } catch (err: any) {
      console.error('Toggle publish error:', err);
      alert('Failed to update course: ' + (err.message || 'Unknown error'));
    }
  };

  // Prevent hydration mismatch
  if (!isClient || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-sky-500"></div>
        <span className="ml-3 text-slate-600 dark:text-slate-300">Loading courses...</span>
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">My Courses</h1>
        <Link 
          href="/instructor/courses/create" 
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Create New Course
        </Link>
      </div>
      
      {!Array.isArray(courses) || courses.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-8 text-center">
          <div className="max-w-md mx-auto">
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No courses yet</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              You haven&apos;t created any courses yet. Get started by creating your first course.
            </p>
            <Link 
              href="/instructor/courses/create" 
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Create Your First Course
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <div key={course.id} className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white line-clamp-2">
                    {course.title}
                  </h3>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      course.is_published 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                    }`}>
                      {course.is_published ? 'Published' : 'Draft'}
                    </span>
                  </div>
                </div>
                
                <p className="text-slate-600 dark:text-slate-400 text-sm mb-4 line-clamp-3">
                  {course.description}
                </p>
                
                <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400 mb-4">
                  <span>Created: {new Date(course.created_at).toLocaleDateString()}</span>
                  <span>Updated: {new Date(course.updated_at).toLocaleDateString()}</span>
                </div>
                
                <div className="flex flex-col space-y-2">
                  <div className="flex space-x-2">
                    <Link
                      href={`/instructor/courses/${course.id}/preview`}
                      className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:from-blue-600 hover:to-indigo-700 transition-all shadow-sm hover:shadow-md text-center flex items-center justify-center gap-2"
                      title="Preview Course"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Preview
                    </Link>
                    <Link
                      href={`/instructor/courses/${course.id}`}
                      className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-md text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-center"
                    >
                      Manage
                    </Link>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleTogglePublish(course.id, course.is_published)}
                      className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        course.is_published
                          ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/30'
                          : 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/30'
                      }`}
                    >
                      {course.is_published ? 'Unpublish' : 'Publish'}
                    </button>
                    <button
                      onClick={() => handleDeleteCourse(course.id)}
                      className="px-3 py-2 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md text-sm font-medium hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InstructorCoursesPage;
