"use client";

import React from 'react';
import Link from 'next/link';

// Placeholder data - replace with API calls in integration step
const adminStats = {
  totalUsers: 1250,
  totalCourses: 75,
  activeOpportunities: 15,
  newRegistrationsLast7Days: 45,
};

const AdminDashboardPage = () => {
  return (
    <div className="container mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Admin Dashboard Overview</h1>

      {/* Stats Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-gray-700 mb-1">Total Users</h3>
          <p className="text-4xl font-bold text-blue-600">{adminStats.totalUsers}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-gray-700 mb-1">Total Courses</h3>
          <p className="text-4xl font-bold text-green-600">{adminStats.totalCourses}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-gray-700 mb-1">Active Opportunities</h3>
          <p className="text-4xl font-bold text-purple-600">{adminStats.activeOpportunities}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-gray-700 mb-1">New Users (Last 7 Days)</h3>
          <p className="text-4xl font-bold text-yellow-500">{adminStats.newRegistrationsLast7Days}</p>
        </div>
      </div>

      {/* Quick Links Section */}
      <div>
        <h2 className="text-2xl font-semibold mb-6 text-gray-800">Quick Links</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/admin/users" legacyBehavior>
            <a className="block bg-blue-500 hover:bg-blue-600 text-white font-semibold py-4 px-6 rounded-lg shadow-md text-center transition duration-150">
              Manage Users
            </a>
          </Link>
          <Link href="/admin/courses" legacyBehavior>
            <a className="block bg-green-500 hover:bg-green-600 text-white font-semibold py-4 px-6 rounded-lg shadow-md text-center transition duration-150">
              Manage Courses
            </a>
          </Link>
          <Link href="/admin/opportunities" legacyBehavior>
            <a className="block bg-purple-500 hover:bg-purple-600 text-white font-semibold py-4 px-6 rounded-lg shadow-md text-center transition duration-150">
              Manage Opportunities
            </a>
          </Link>
          {/* Add more quick links as needed */}
        </div>
      </div>

      {/* Placeholder for Recent Activity Feed - to be implemented if backend supports it */}
      {/* <div className="mt-10">
        <h2 className="text-2xl font-semibold mb-6 text-gray-800">Recent Activity</h2>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-gray-600">Recent activity feed will be displayed here...</p>
        </div>
      </div> */}
    </div>
  );
};

export default AdminDashboardPage;

