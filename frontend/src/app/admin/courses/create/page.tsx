'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import CourseForm from '@/components/admin/CourseManagement/CourseForm';

export default function CreateCoursePage() {
  const router = useRouter();

  return (
    <>
      {/* Header */}
      <div className="bg-brand border-b border-brand-light -mx-6 -mt-6 mb-6 px-6 py-4 md:-mx-10 md:-mt-10 md:mb-6 md:px-10">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-400 mb-1">
              <Link href="/admin/courses" className="hover:text-accent transition-colors">
                Courses
              </Link>
              <span>/</span>
              <span className="text-slate-300">Create New</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Create Course</h1>
            <p className="text-slate-300 text-sm mt-1">Add a new course to the platform</p>
          </div>
          <Link
            href="/admin/courses"
            className="px-4 py-2 text-sm font-medium text-slate-300 bg-brand-light border border-brand-lighter rounded-lg hover:bg-brand-lighter transition-colors"
          >
            ← Back to List
          </Link>
        </div>
      </div>

      {/* Content */}
      <CourseForm
        onSuccess={() => router.push('/admin/courses')}
        onCancel={() => router.push('/admin/courses')}
      />
    </>
  );
}
