"use client";

import React from 'react';

// Placeholder data - replace with API calls and charting libraries (e.g., Recharts, Chart.js)
const platformAnalytics = {
  userRegistrationTrend: [ // Example: users registered per month
    { month: 'Jan', count: 150 },
    { month: 'Feb', count: 220 },
    { month: 'Mar', count: 300 },
    { month: 'Apr', count: 280 },
  ],
  courseEnrollmentStats: [
    { course: 'Python Intro', enrollments: 120 },
    { course: 'Web Dev Basics', enrollments: 180 },
    { course: 'Data Structures', enrollments: 90 },
  ],
  popularCourses: [
    { name: 'Web Development Fundamentals', views: 5000, completions: 200 },
    { name: 'Introduction to Python Programming', views: 4500, completions: 180 },
  ],
  siteActivity: {
    loginsToday: 350,
    activeUsersLastHour: 75,
  }
};

const AnalyticsOverviewPage = () => {
  return (
    <div className="container mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Analytics Overview</h1>

      {/* User Registration Trend Section */}
      <div className="mb-10 bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4 text-gray-700">User Registration Trend</h2>
        {/* Placeholder for chart - integrate a charting library here */}
        <div className="bg-gray-200 h-64 flex items-center justify-center rounded">
          <p className="text-gray-500">User Registration Chart Placeholder</p>
        </div>
        <ul className="mt-4">
          {platformAnalytics.userRegistrationTrend.map(data => (
            <li key={data.month} className="text-sm text-gray-600">{data.month}: {data.count} new users</li>
          ))}
        </ul>
      </div>

      {/* Course Enrollment Stats Section */}
      <div className="mb-10 bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4 text-gray-700">Course Enrollment Statistics</h2>
        {/* Placeholder for chart */}
        <div className="bg-gray-200 h-64 flex items-center justify-center rounded">
          <p className="text-gray-500">Course Enrollment Chart Placeholder</p>
        </div>
        <ul className="mt-4">
          {platformAnalytics.courseEnrollmentStats.map(data => (
            <li key={data.course} className="text-sm text-gray-600">{data.course}: {data.enrollments} enrollments</li>
          ))}
        </ul>
      </div>

      {/* Popular Courses Section */}
      <div className="mb-10 bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4 text-gray-700">Popular Courses</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Views</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {platformAnalytics.popularCourses.map(course => (
                <tr key={course.name}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{course.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{course.views}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{course.completions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Site Activity */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4 text-gray-700">Site Activity</h2>
        <p className="text-gray-600">Logins Today: {platformAnalytics.siteActivity.loginsToday}</p>
        <p className="text-gray-600">Active Users (Last Hour): {platformAnalytics.siteActivity.activeUsersLastHour}</p>
      </div>

      {/* Note: Actual implementation would involve fetching data from /api/admin/analytics/* endpoints 
           and using a library like Recharts or Chart.js for visualizations. */}
    </div>
  );
};

export default AnalyticsOverviewPage;

