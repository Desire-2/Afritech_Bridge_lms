"use client";

import React from 'react';
import Link from 'next/link';

const InstructorCoursesPage = () => {
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
    </div>
  );
};

export default InstructorCoursesPage;
