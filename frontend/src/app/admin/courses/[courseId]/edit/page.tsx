"use client";

import React from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import CourseForm from "@/components/admin/CourseManagement/CourseForm";

export default function EditCoursePage() {
  const router = useRouter();
  const params = useParams();
  const courseId = Number(params.courseId);

  if (!courseId || isNaN(courseId)) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <h2 className="text-xl font-bold text-white mb-2">Invalid Course ID</h2>
          <p className="text-slate-400 mb-4">The course ID in the URL is not valid.</p>
          <Link
            href="/admin/courses"
            className="text-accent hover:text-accent/80 font-medium"
          >
            ← Back to Courses
          </Link>
        </div>
      </div>
    );
  }

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
              <span className="text-slate-300">Edit Course #{courseId}</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Edit Course</h1>
          </div>
          <Link
            href="/admin/courses"
            className="px-4 py-2 text-sm font-medium text-slate-300 bg-brand-light border border-brand-lighter rounded-lg hover:bg-brand-lighter transition-colors"
          >
            ← Back to List
          </Link>
        </div>
      </div>

      {/* Form */}
      <CourseForm
        courseId={courseId}
        onSuccess={() => router.push("/admin/courses")}
        onCancel={() => router.push("/admin/courses")}
      />
    </>
  );
}
