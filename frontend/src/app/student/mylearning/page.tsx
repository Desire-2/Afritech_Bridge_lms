"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { StudentService, EnrolledCourse } from '@/services/student.service';
import { BookOpen, Clock, BarChart3, PlayCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const MyLearningPage = () => {
  const [courses, setCourses] = useState<EnrolledCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'in-progress' | 'completed'>('all');
  const [isClient, setIsClient] = useState(false);
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // Handle client-side hydration
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const fetchMyLearning = async () => {
      // Only fetch data if user is authenticated and auth loading is complete
      if (!authLoading && isAuthenticated) {
        try {
          setLoading(true);
          const data = await StudentService.getMyLearning();
          // Ensure data is always an array
          setCourses(Array.isArray(data) ? data : []);
          setError(null); // Clear any previous errors
        } catch (err: any) {
          console.error('Error fetching my learning data:', err);
          setError(err.message || 'Failed to load your learning data');
          setCourses([]); // Set empty array on error
        } finally {
          setLoading(false);
        }
      }
    };

    fetchMyLearning();
  }, [isAuthenticated, authLoading]);

  // Ensure courses is always an array before filtering
  const filteredCourses = Array.isArray(courses) ? courses.filter(course => {
    if (filter === 'all') return true;
    if (filter === 'completed') return course.progress >= 100;
    if (filter === 'in-progress') return course.progress > 0 && course.progress < 100;
    return true;
  }) : [];

  // Prevent hydration mismatch by showing loading state until client-side
  if (!isClient || loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((_, i) => (
              <div key={i} className="h-80 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-600 text-lg">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">My Learning</h1>
        <p className="text-gray-600">Track your progress and continue learning</p>
      </div>

      {/* Filter Tabs */}
      <div className="mb-8">
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
          {[
            { key: 'all', label: 'All Courses', count: Array.isArray(courses) ? courses.length : 0 },
            { key: 'in-progress', label: 'In Progress', count: Array.isArray(courses) ? courses.filter(c => c.progress > 0 && c.progress < 100).length : 0 },
            { key: 'completed', label: 'Completed', count: Array.isArray(courses) ? courses.filter(c => c.progress >= 100).length : 0 }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as any)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                filter === tab.key
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BookOpen className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Courses</p>
              <p className="text-2xl font-bold text-gray-800">{Array.isArray(courses) ? courses.length : 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">In Progress</p>
              <p className="text-2xl font-bold text-gray-800">
                {Array.isArray(courses) ? courses.filter(c => c.progress > 0 && c.progress < 100).length : 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-gray-800">
                {Array.isArray(courses) ? courses.filter(c => c.progress >= 100).length : 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <BarChart3 className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg Progress</p>
              <p className="text-2xl font-bold text-gray-800">
                {Array.isArray(courses) && courses.length > 0 ? Math.round(courses.reduce((sum, c) => sum + c.progress, 0) / courses.length) : 0}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Courses Grid */}
      {filteredCourses.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No courses found</h3>
          <p className="text-gray-600 mb-6">
            {filter === 'all' 
              ? "You haven't enrolled in any courses yet." 
              : `No ${filter.replace('-', ' ')} courses found.`}
          </p>
          <Link
            href="/courses"
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Browse Courses
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => (
            <div key={course.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 line-clamp-2">
                    {course.title}
                  </h3>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    course.progress >= 100 
                      ? 'bg-green-100 text-green-700'
                      : course.progress > 0 
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700'
                  }`}>
                    {course.progress >= 100 ? 'Completed' : 'In Progress'}
                  </div>
                </div>

                <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                  {course.description}
                </p>

                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Progress</span>
                    <span className="font-medium">{Math.round(course.progress)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-indigo-500 to-blue-500 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${course.progress}%` }}
                    ></div>
                  </div>
                </div>

                <div className="text-sm text-gray-600 mb-4">
                  <p>Instructor: {course.instructor_name}</p>
                  {course.current_lesson && (
                    <p>Next: {course.current_lesson}</p>
                  )}
                  <p>Enrolled: {new Date(course.enrollment_date).toLocaleDateString()}</p>
                </div>

                <div className="flex gap-2">
                  <Link
                    href={`/learn/${course.id}`}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <PlayCircle className="w-4 h-4" />
                    {course.progress > 0 ? 'Continue' : 'Start'}
                  </Link>
                  <Link
                    href={`/student/myprogress/${course.id}`}
                    className="flex items-center justify-center px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    <BarChart3 className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyLearningPage;