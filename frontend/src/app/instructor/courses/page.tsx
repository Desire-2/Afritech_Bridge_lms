"use client";

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import InstructorService from '@/services/instructor.service';
import { Course } from '@/types/api';

const InstructorCoursesPage = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [publishFilter, setPublishFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set());
  const { token } = useAuth();

  // Handle client-side hydration
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const fetchCourses = async () => {
      if (!token) return;

      setLoading(true);
      setError(null);
      try {
        const coursesData = await InstructorService.getMyCourses();
        setCourses(Array.isArray(coursesData) ? coursesData : []);
      } catch (err: any) {
        console.error('Courses fetch error:', err);
        setError(err.message || 'Failed to load courses');
        setCourses([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, [token]);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(null), 3000);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  // Stats
  const stats = useMemo(() => {
    const total = courses.length;
    const published = courses.filter(c => c.is_published).length;
    const drafts = total - published;
    return { total, published, drafts };
  }, [courses]);

  // Filtered courses
  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        course.title.toLowerCase().includes(q) ||
        (course.description || '').toLowerCase().includes(q);

      const matchesPublish =
        publishFilter === 'all' ||
        (publishFilter === 'published' && course.is_published) ||
        (publishFilter === 'draft' && !course.is_published);

      return matchesSearch && matchesPublish;
    });
  }, [courses, searchQuery, publishFilter]);

  const handleDeleteCourse = async (courseId: number) => {
    if (!window.confirm('Are you sure you want to delete this course? This will permanently remove all modules, lessons, and enrollments. This action cannot be undone.')) {
      return;
    }

    setDeletingId(courseId);
    try {
      const { CourseService } = await import('@/services/course.service');
      await CourseService.deleteCourse(courseId);
      setCourses(prev => prev.filter(course => course.id !== courseId));
      setSuccessMsg('Course deleted successfully');
    } catch (err: any) {
      console.error('Delete course error:', err);
      alert('Failed to delete course: ' + (err.message || 'Unknown error'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleTogglePublish = async (courseId: number, isPublished: boolean) => {
    setTogglingIds(prev => new Set(prev).add(courseId));
    try {
      const { CourseService } = await import('@/services/course.service');
      if (isPublished) {
        await CourseService.unpublishCourse(courseId);
      } else {
        await CourseService.publishCourse(courseId);
      }

      setCourses(prev => prev.map(course =>
        course.id === courseId
          ? { ...course, is_published: !isPublished }
          : course
      ));
      setSuccessMsg(`Course ${isPublished ? 'unpublished' : 'published'} successfully`);
    } catch (err: any) {
      console.error('Toggle publish error:', err);
      alert('Failed to update course: ' + (err.message || 'Unknown error'));
    } finally {
      setTogglingIds(prev => {
        const s = new Set(prev);
        s.delete(courseId);
        return s;
      });
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Prevent hydration mismatch
  if (!isClient) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-accent" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent" />
        <span className="ml-3 text-slate-400">Loading courses...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center my-10">
        <p className="text-red-400">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-sm font-medium"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            My Courses
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Create, edit, and manage your courses
          </p>
        </div>
        <Link
          href="/instructor/courses/create"
          className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-white font-semibold py-2.5 px-5 rounded-lg transition-colors text-sm shadow-sm shrink-0"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create New Course
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Courses</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Published</p>
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-300 mt-1">{stats.published}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
          <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Drafts</p>
          <p className="text-3xl font-bold text-amber-600 dark:text-amber-300 mt-1">{stats.drafts}</p>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-green-400 flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-green-400 hover:text-green-300 font-bold ml-4">
            ✕
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
              Search
            </label>
            <div className="relative">
              <svg
                className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title or description..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
              Status
            </label>
            <select
              value={publishFilter}
              onChange={(e) => setPublishFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent text-sm text-slate-900 dark:text-white"
            >
              <option value="all">All Courses</option>
              <option value="published">Published</option>
              <option value="draft">Drafts</option>
            </select>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Showing {filteredCourses.length} of {courses.length} course{courses.length !== 1 ? 's' : ''}
            {searchQuery && <span className="ml-1">matching "{searchQuery}"</span>}
          </p>
        </div>
      </div>

      {/* Course Grid */}
      {filteredCourses.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-12 text-center">
          <div className="max-w-md mx-auto">
            <svg
              className="h-12 w-12 text-slate-400 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              {courses.length === 0 ? 'No courses yet' : 'No courses match your filters'}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              {courses.length === 0
                ? "You haven't created any courses yet. Get started by creating your first course."
                : 'Try adjusting your search or filter criteria.'}
            </p>
            {courses.length === 0 ? (
              <Link
                href="/instructor/courses/create"
                className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-white px-5 py-2.5 rounded-lg font-medium transition-colors text-sm shadow-sm"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Your First Course
              </Link>
            ) : (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setPublishFilter('all');
                }}
                className="text-accent hover:text-accent/80 font-medium text-sm"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCourses.map((course) => (
            <div
              key={course.id}
              className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-md transition-shadow group"
            >
              {/* Top accent bar */}
              <div className={`h-1.5 ${course.is_published ? 'bg-emerald-500' : 'bg-amber-500'}`} />

              <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white line-clamp-2 leading-snug flex-1">
                    {course.title}
                  </h3>
                  <span
                    className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      course.is_published
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    }`}
                  >
                    {course.is_published ? 'Published' : 'Draft'}
                  </span>
                </div>

                {/* Description */}
                <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-4 leading-relaxed">
                  {course.description || 'No description'}
                </p>

                {/* Metadata */}
                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-500 mb-4 pb-3 border-b border-slate-100 dark:border-slate-700">
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Created {formatDate(course.created_at)}
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Updated {formatDate(course.updated_at)}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Link
                      href={`/instructor/courses/${course.id}`}
                      className="flex-1 bg-accent hover:bg-accent/90 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow-md text-center flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Manage
                    </Link>
                    <Link
                      href={`/instructor/courses/${course.id}/preview`}
                      className="px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center justify-center"
                      title="Preview as student"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </Link>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleTogglePublish(course.id, course.is_published)}
                      disabled={togglingIds.has(course.id)}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-wait ${
                        course.is_published
                          ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/30'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/30'
                      }`}
                    >
                      {togglingIds.has(course.id) ? (
                        <span className="flex items-center justify-center gap-1.5">
                          <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-current" />
                          Updating...
                        </span>
                      ) : (
                        course.is_published ? 'Unpublish' : 'Publish'
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteCourse(course.id)}
                      disabled={deletingId === course.id}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        deletingId === course.id
                          ? 'bg-red-100 text-red-400 dark:bg-red-900/20 cursor-wait'
                          : 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30'
                      }`}
                    >
                      {deletingId === course.id ? (
                        <span className="flex items-center justify-center gap-1.5">
                          <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-current" />
                          Deleting...
                        </span>
                      ) : (
                        'Delete'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InstructorCoursesPage;
