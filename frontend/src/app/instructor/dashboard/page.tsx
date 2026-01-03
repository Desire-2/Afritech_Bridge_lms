"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import InstructorService, { InstructorDashboardData } from '@/services/instructor.service';
import { CourseService } from '@/services/course.service';
import { Course } from '@/types/api';

const InstructorDashboardPage = () => {
  const [dashboardData, setDashboardData] = useState<InstructorDashboardData | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const { token, user } = useAuth();

  // Handle client-side hydration
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!token) return;
      
      setLoading(true);
      setError(null);
      try {
        // Fetch dashboard data and courses in parallel
        const [dashboardResponse, coursesResponse] = await Promise.all([
          InstructorService.getDashboardData(),
          InstructorService.getMyCourses()
        ]);
        
        setDashboardData(dashboardResponse);
        // Ensure courses is always an array
        setCourses(Array.isArray(coursesResponse) ? coursesResponse : []);
      } catch (err: any) {
        console.error('Dashboard fetch error:', err);
        setError(err.message || 'An error occurred while fetching dashboard data.');
        
        // Fallback: try to fetch just courses if dashboard fails
        try {
          const coursesResponse = await InstructorService.getMyCourses();
          const safeCourses = Array.isArray(coursesResponse) ? coursesResponse : [];
          setCourses(safeCourses);
          // Create minimal dashboard data
          setDashboardData({
            taughtCourses: safeCourses,
            totalStudents: 0,
            pendingGradingItems: 0,
            recentEnrollments: [],
            recentAnnouncements: []
          });
          setError(null);
        } catch (fallbackErr: any) {
          console.error('Courses fetch error:', fallbackErr);
          setError('Unable to load instructor data. Please try again.');
          setCourses([]); // Set empty array on error
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [token]);

  // Prevent hydration mismatch by showing loading state until client-side
  if (!isClient || loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-sky-500"></div>
      <span className="ml-3 text-slate-600 dark:text-slate-300">Loading dashboard...</span>
    </div>
  );
  
  if (error) return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-6 rounded-lg text-center my-10">
      <p className="text-red-600 dark:text-red-400">{error}</p>
      <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-red-100 dark:bg-red-800/30 text-red-700 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-800/50">
        Try Again
      </button>
    </div>
  );
  
  if (!dashboardData) return (
    <div className="bg-slate-100 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 p-6 rounded-lg text-center my-10">
      <p className="text-slate-600 dark:text-slate-400">No dashboard data available.</p>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Welcome back, {user?.first_name || 'Instructor'}
        </h1>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Today is {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Key Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Courses Taught</h3>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{Array.isArray(courses) ? courses.length : 0}</p>
            </div>
            <div className="rounded-full bg-sky-100 dark:bg-sky-900/30 p-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-sky-600 dark:text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
          </div>
          <div className="mt-4">
            <Link href="/instructor/courses" className="text-sm text-sky-600 dark:text-sky-400 hover:underline">View all courses →</Link>
          </div>
        </div>
        
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Students</h3>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{dashboardData?.totalStudents || 0}</p>
            </div>
            <div className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 p-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-4">
            <Link href="/instructor/students" className="text-sm text-sky-600 dark:text-sky-400 hover:underline">View all students →</Link>
          </div>
        </div>
        
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Pending Grading</h3>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{dashboardData?.pendingGradingItems || 0}</p>
            </div>
            <div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 0 012 2" />
              </svg>
            </div>
          </div>
          <div className="mt-4">
            <Link href="/instructor/grading" className="text-sm text-sky-600 dark:text-sky-400 hover:underline">View grading queue →</Link>
          </div>
        </div>
      </div>

      {/* My Courses Summary Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">My Courses</h2>
              <Link href="/instructor/courses" className="text-sm text-sky-600 dark:text-sky-400 hover:underline">
                View all
              </Link>
            </div>
            
            {Array.isArray(courses) && courses.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {courses.map(course => (
                  <div key={course.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium text-slate-900 dark:text-white mb-1">{course.title}</h3>
                        <div className="flex gap-4">
                          <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                            Published: {course.is_published ? 'Yes' : 'No'}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            Created: {new Date(course.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Link href={`/instructor/courses/${course.id}/preview`} className="text-xs bg-gradient-to-r from-blue-500 to-indigo-600 px-2.5 py-1 rounded text-white hover:from-blue-600 hover:to-indigo-700 transition-all shadow-sm hover:shadow-md flex items-center gap-1" title="Preview Course">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Preview
                        </Link>
                        <Link href={`/instructor/courses/${course.id}`} className="text-xs bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                          Manage
                        </Link>
                        <Link href={`/instructor/courses/${course.id}/analytics`} className="text-xs bg-blue-100 dark:bg-blue-900/30 px-2.5 py-1 rounded text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors">
                          Analytics
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="p-6 text-slate-500 dark:text-slate-400">You are not currently assigned to any courses.</p>
            )}
          </div>
          
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Active Students</h2>
              <Link href="/instructor/students" className="text-sm text-sky-600 dark:text-sky-400 hover:underline">
                View all
              </Link>
            </div>
            <div className="p-4">
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="w-10 h-10 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center text-sky-600 dark:text-sky-400 text-xs font-semibold">
                    {String.fromCharCode(65 + index)}
                  </div>
                ))}
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 text-xs font-semibold">
                  +120
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Recent Announcements Section */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden h-full">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Announcements</h2>
              <Link href="/instructor/announcements" className="text-sm text-sky-600 dark:text-sky-400 hover:underline">
                View all
              </Link>
            </div>
            
            {dashboardData?.recentAnnouncements && Array.isArray(dashboardData.recentAnnouncements) && dashboardData.recentAnnouncements.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {dashboardData.recentAnnouncements.map(announcement => (
                  <div key={announcement.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <h3 className="font-medium text-slate-800 dark:text-slate-200 text-sm">{announcement.title}</h3>
                    <div className="flex gap-2 mt-1.5 items-center text-xs">
                      <span className="text-slate-500 dark:text-slate-400">{announcement.course_title}</span>
                      <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                      <span className="text-slate-500 dark:text-slate-400">{new Date(announcement.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="p-6 text-slate-500 dark:text-slate-400">No recent announcements.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InstructorDashboardPage;

