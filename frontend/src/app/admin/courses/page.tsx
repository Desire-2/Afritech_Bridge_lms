'use client';

import React, { useState } from 'react';
import CourseListTable from '@/components/admin/CourseManagement/CourseListTable';
import { Course } from '@/types/api';
import Link from 'next/link';

export default function CoursesPage() {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  return (
    <>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 -mx-6 -mt-6 mb-6 px-6 py-4 md:-mx-10 md:-mt-10 md:mb-6 md:px-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Course Management</h1>
            <p className="text-gray-600 mt-1">Manage all courses in the system</p>
          </div>
          <Link
            href="/admin/courses/create"
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            + Create Course
          </Link>
        </div>
      </div>

      {/* Content */}
      <CourseListTable
        onSelectCourse={(course) => {
          setSelectedCourse(course);
        }}
      />
    </>
  );
}
