'use client';

import React from 'react';
import CourseListTable from '@/components/admin/CourseManagement/CourseListTable';
import Link from 'next/link';

export default function CoursesPage() {
  return (
    <>
      {/* Header */}
      <div className="bg-brand border-b border-brand-light -mx-6 -mt-6 mb-6 px-6 py-5 md:-mx-10 md:-mt-10 md:mb-6 md:px-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Course Management</h1>
            <p className="text-slate-300 text-sm mt-1">
              Create, edit, publish, and manage all courses in the system
            </p>
          </div>
          <Link
            href="/admin/courses/create"
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-white font-semibold py-2.5 px-5 rounded-lg transition-colors text-sm shadow-sm"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Course
          </Link>
        </div>
      </div>

      {/* Content */}
      <CourseListTable />
    </>
  );
}
