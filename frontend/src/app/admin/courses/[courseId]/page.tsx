"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { AdminService } from "@/services/admin.service";
import CourseCreationService from "@/services/course-creation.service";
import { Course, EnhancedModule, Assignment, Project, Quiz } from "@/types/api";

// Import instructor course management components
import CourseOverview from "@/components/instructor/course-creation/CourseOverview";
import ModuleManagement from "@/components/instructor/course-creation/ModuleManagement";
import AssessmentManagement from "@/components/instructor/course-creation/AssessmentManagement";
import CourseSettings from "@/components/instructor/course-creation/CourseSettings";

type TabType = "overview" | "modules" | "assessments" | "settings";

export default function AdminCourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuth();
  const courseId = Number(params.courseId);

  const [course, setCourse] = useState<Course | null>(null);
  const [assessments, setAssessments] = useState<{
    quizzes: Quiz[];
    assignments: Assignment[];
    projects: Project[];
  } | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCourseData = useCallback(async () => {
    if (!token || !courseId) return;

    try {
      setLoading(true);
      setError(null);

      // Use CourseCreationService which already has full module/assessment support
      // Admin can access these endpoints now because we updated course_ownership_required
      const [courseData, assessmentData] = await Promise.all([
        CourseCreationService.getCourseDetails(courseId),
        CourseCreationService.getAssessmentsOverview(courseId),
      ]);

      setCourse(courseData);
      setAssessments(assessmentData);
    } catch (err: any) {
      console.error("Error fetching course data:", err);
      setError(
        err.message || "Failed to load course data. Make sure you have admin access."
      );
    } finally {
      setLoading(false);
    }
  }, [courseId, token]);

  useEffect(() => {
    fetchCourseData();
  }, [fetchCourseData]);

  const handleCourseUpdate = (updatedCourse: Course) => {
    setCourse(updatedCourse);
  };

  const handleAssessmentUpdate = async () => {
    try {
      const updatedAssessments =
        await CourseCreationService.getAssessmentsOverview(courseId);
      setAssessments(updatedAssessments);
    } catch (error) {
      console.error("Failed to refresh assessments:", error);
    }
  };

  if (!courseId || isNaN(courseId)) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <h2 className="text-xl font-bold text-white mb-2">
            Invalid Course ID
          </h2>
          <p className="text-slate-400 mb-4">
            The course ID in the URL is not valid.
          </p>
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent" />
          <span className="text-sm text-slate-400">
            Loading course details...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-brand border border-brand-light rounded-xl p-6">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
          <p className="text-red-400 text-sm">{error}</p>
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              onClick={fetchCourseData}
              className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 text-sm font-medium transition-colors"
            >
              Try Again
            </button>
            <Link
              href="/admin/courses"
              className="px-4 py-2 bg-brand-light text-slate-300 rounded-lg hover:bg-brand-lighter text-sm font-medium transition-colors"
            >
              ← Back to Courses
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="bg-brand border border-brand-light rounded-xl p-12 text-center">
        <p className="text-slate-400">Course not found</p>
        <Link
          href="/admin/courses"
          className="mt-4 inline-block text-accent hover:text-accent/80 font-medium"
        >
          ← Back to Courses
        </Link>
      </div>
    );
  }

  const tabs: {
    id: TabType;
    label: string;
    shortLabel: string;
    icon: string;
  }[] = [
    { id: "overview", label: "Overview", shortLabel: "Overview", icon: "📊" },
    {
      id: "modules",
      label: "Modules & Lessons",
      shortLabel: "Modules",
      icon: "📚",
    },
    { id: "assessments", label: "Assessments", shortLabel: "Assess.", icon: "📝" },
    { id: "settings", label: "Settings", shortLabel: "Settings", icon: "⚙️" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-brand border-b border-brand-light -mx-6 -mt-6 mb-0 px-6 py-5 md:-mx-10 md:-mt-10 md:mb-0 md:px-10">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-400 mb-1">
              <Link
                href="/admin/courses"
                className="hover:text-accent transition-colors"
              >
                Courses
              </Link>
              <span>/</span>
              <span className="text-slate-300">{course.title}</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">
                {course.title}
              </h1>
              <span
                className={`inline-flex shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  course.is_published
                    ? "bg-green-100 text-green-800"
                    : "bg-yellow-100 text-yellow-800"
                }`}
              >
                {course.is_published ? "Published" : "Draft"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/courses/${course.id}/edit`}
              className="px-4 py-2 text-sm font-medium text-slate-300 bg-brand-light border border-brand-lighter rounded-lg hover:bg-brand-lighter transition-colors"
            >
              Edit Details
            </Link>
            <Link
              href="/admin/courses"
              className="px-4 py-2 text-sm font-medium text-slate-300 bg-brand-light border border-brand-lighter rounded-lg hover:bg-brand-lighter transition-colors"
            >
              ← Back
            </Link>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-brand rounded-xl border border-brand-light overflow-hidden">
        <nav className="flex overflow-x-auto scrollbar-hide border-b border-brand-light">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 py-3 px-5 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-accent text-accent bg-accent/10"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-brand-light"
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
            </button>
          ))}
        </nav>

        <div className="p-6">
          {activeTab === "overview" && (
            <CourseOverview
              course={course}
              assessments={assessments}
              onCourseUpdate={handleCourseUpdate}
            />
          )}

          {activeTab === "modules" && (
            <ModuleManagement
              course={course}
              onCourseUpdate={handleCourseUpdate}
            />
          )}

          {activeTab === "assessments" && assessments && (
            <AssessmentManagement
              course={course}
              assessments={assessments}
              onAssessmentUpdate={handleAssessmentUpdate}
            />
          )}

          {activeTab === "settings" && (
            <CourseSettings
              course={course}
              onCourseUpdate={handleCourseUpdate}
            />
          )}
        </div>
      </div>
    </div>
  );
}
