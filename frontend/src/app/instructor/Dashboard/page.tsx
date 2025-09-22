"use client";

import React, { useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthContext } from '@/contexts/AuthContext';

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
  ],
  pendingGradingItems: 17, // Sum of pendingSubmissions from courses
  unreadMessages: 3,
  recentAnnouncements: [
    { id: 'ann001', title: 'Midterm Exam Schedule Updated', courseTitle: 'Python Intro', date: '2024-05-12' },
    { id: 'ann002', title: 'Project Submission Deadline Extended', courseTitle: 'Web Dev Fundamentals', date: '2024-05-10' },
  ],
};

const InstructorDashboardPage = () => {
  const [dashboardData, setDashboardData] = useState<InstructorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const authContext = useContext(AuthContext);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Replace with actual API call: GET /api/instructor/dashboard
        // const response = await fetch('/api/instructor/dashboard', {
        //   headers: { 'Authorization': `Bearer ${authContext?.token}` },
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

    if (authContext?.token) { // Fetch data only if token is available
      fetchDashboardData();
    }
  }, [authContext?.token]);

  if (loading) return <div className="text-center py-10">Loading dashboard...</div>;
  if (error) return <div className="text-center py-10 text-red-500">Error: {error}</div>;
  if (!dashboardData) return <div className="text-center py-10">No dashboard data available.</div>;

  return (
    <div className="container mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Instructor Dashboard Overview</h1>

      {/* Key Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-gray-700 mb-1">Courses Taught</h3>
          <p className="text-4xl font-bold text-blue-600">{dashboardData.taughtCourses.length}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-gray-700 mb-1">Pending Grading</h3>
          <p className="text-4xl font-bold text-orange-500">{dashboardData.pendingGradingItems}</p>
          <Link href="/instructor/grading" legacyBehavior><a className="text-sm text-blue-500 hover:underline">View items</a></Link>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-gray-700 mb-1">Unread Messages</h3>
          <p className="text-4xl font-bold text-green-600">{dashboardData.unreadMessages}</p>
          {/* <Link href="/instructor/messages" legacyBehavior><a className="text-sm text-blue-500 hover:underline">View messages</a></Link> */}
        </div>
      </div>

      {/* My Courses Summary Section */}
      <div className="mb-10">
        <h2 className="text-2xl font-semibold mb-4 text-gray-800">My Courses</h2>
        {dashboardData.taughtCourses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {dashboardData.taughtCourses.map(course => (
              <div key={course.id} className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-semibold text-gray-700 mb-2">{course.title}</h3>
                <p className="text-sm text-gray-600 mb-1">Students: {course.studentCount}</p>
                <p className="text-sm text-gray-600 mb-3">Pending Submissions: {course.pendingSubmissions}</p>
                <Link href={`/instructor/courses/${course.id}`} legacyBehavior>
                  <a className="text-blue-500 hover:text-blue-700 font-semibold">Manage Course &rarr;</a>
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600">You are not currently assigned to any courses.</p>
        )}
        <div className="mt-4">
            <Link href="/instructor/courses" legacyBehavior>
                <a className="text-indigo-600 hover:text-indigo-800 font-semibold">View all courses &rarr;</a>
            </Link>
        </div>
      </div>

      {/* Recent Announcements Section */}
      <div>
        <h2 className="text-2xl font-semibold mb-4 text-gray-800">Recent Announcements</h2>
        {dashboardData.recentAnnouncements.length > 0 ? (
          <div className="bg-white p-4 rounded-lg shadow-md">
            <ul className="divide-y divide-gray-200">
              {dashboardData.recentAnnouncements.map(announcement => (
                <li key={announcement.id} className="py-3">
                  <p className="text-md font-semibold text-gray-700">{announcement.title}</p>
                  <p className="text-sm text-gray-500">For: {announcement.courseTitle} - Posted: {new Date(announcement.date).toLocaleDateString()}</p>
                  {/* <Link href={`/instructor/announcements/${announcement.id}`} legacyBehavior><a className="text-xs text-blue-500 hover:underline">View details</a></Link> */}
                </li>
              ))}
            </ul>
             <div className="mt-4">
                <Link href="/instructor/announcements" legacyBehavior>
                    <a className="text-indigo-600 hover:text-indigo-800 font-semibold">View all announcements &rarr;</a>
                </Link>
            </div>
          </div>
        ) : (
          <p className="text-gray-600">No recent announcements.</p>
        )}
      </div>
    </div>
  );
};

export default InstructorDashboardPage;

