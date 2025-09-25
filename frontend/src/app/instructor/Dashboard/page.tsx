"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

// Placeholder types - define based on your actual models
interface TaughtCourseSummary {
  id: string;
  title: string;
  studentCount: number;
  pendingSubmissions: number;
}

interface InstructorDashboardData {
  taughtCourses: TaughtCourseSummary[];
  pendingGradingItems: number;
  unreadMessages: number; // Example, if messaging is implemented
  recentAnnouncements: Array<{ id: string; title: string; courseTitle: string; date: string }>;
}

// Placeholder data - replace with API calls
const placeholderDashboardData: InstructorDashboardData = {
  taughtCourses: [
    { id: 'crs001', title: 'Introduction to Python Programming', studentCount: 150, pendingSubmissions: 5 },
    { id: 'crs002', title: 'Web Development Fundamentals', studentCount: 220, pendingSubmissions: 12 },
    { id: 'crs003', title: 'Data Structures & Algorithms', studentCount: 85, pendingSubmissions: 8 },
  ],
  pendingGradingItems: 25, // Sum of pendingSubmissions from courses
  unreadMessages: 5,
  recentAnnouncements: [
    { id: 'ann001', title: 'Midterm Exam Schedule Updated', courseTitle: 'Python Programming', date: '2025-09-22' },
    { id: 'ann002', title: 'Project Submission Deadline Extended', courseTitle: 'Web Development', date: '2025-09-20' },
    { id: 'ann003', title: 'New Learning Resources Available', courseTitle: 'Data Structures', date: '2025-09-18' },
  ],
};

const InstructorDashboardPage = () => {
  const [dashboardData, setDashboardData] = useState<InstructorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token, user } = useAuth();

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Replace with actual API call: GET /api/instructor/dashboard
        // const response = await fetch('/api/instructor/dashboard', {
        //   headers: { 'Authorization': `Bearer ${token}` },
        // });
        // if (!response.ok) throw new Error('Failed to fetch instructor dashboard data');
        // const data = await response.json();
        // setDashboardData(data);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
        setDashboardData(placeholderDashboardData);
      } catch (err: any) {
        setError(err.message || 'An error occurred while fetching dashboard data.');
      } finally {
        setLoading(false);
      }
    };

    if (token) { // Fetch data only if token is available
      fetchDashboardData();
    }
  }, [token]);

  if (loading) return (
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
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{dashboardData.taughtCourses.length}</p>
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
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Pending Grading</h3>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{dashboardData.pendingGradingItems}</p>
            </div>
            <div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
          <div className="mt-4">
            <Link href="/instructor/grading" className="text-sm text-sky-600 dark:text-sky-400 hover:underline">View grading queue →</Link>
          </div>
        </div>
        
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Unread Messages</h3>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{dashboardData.unreadMessages}</p>
            </div>
            <div className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 p-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
          </div>
          <div className="mt-4">
            <Link href="/instructor/messages" className="text-sm text-sky-600 dark:text-sky-400 hover:underline">View messages →</Link>
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
            
            {dashboardData.taughtCourses.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {dashboardData.taughtCourses.map(course => (
                  <div key={course.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium text-slate-900 dark:text-white mb-1">{course.title}</h3>
                        <div className="flex gap-4">
                          <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                            {course.studentCount} Students
                          </span>
                          <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            {course.pendingSubmissions} Pending
                          </span>
                        </div>
                      </div>
                      <Link href={`/instructor/courses/${course.id}`} className="text-xs bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                        Manage
                      </Link>
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
            
            {dashboardData.recentAnnouncements.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {dashboardData.recentAnnouncements.map(announcement => (
                  <div key={announcement.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <h3 className="font-medium text-slate-800 dark:text-slate-200 text-sm">{announcement.title}</h3>
                    <div className="flex gap-2 mt-1.5 items-center text-xs">
                      <span className="text-slate-500 dark:text-slate-400">{announcement.courseTitle}</span>
                      <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                      <span className="text-slate-500 dark:text-slate-400">{new Date(announcement.date).toLocaleDateString()}</span>
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

