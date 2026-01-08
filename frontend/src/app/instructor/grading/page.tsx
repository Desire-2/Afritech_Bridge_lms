"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams, useRouter } from 'next/navigation';
import GradingService, {
  AssignmentSubmission,
  ProjectSubmission,
  GradingSummary,
  SubmissionFilters
} from '@/services/grading.service';
import { Course } from '@/types/api';
import { Clock, CheckCircle, AlertCircle, User, BookOpen, Calendar, Award, Search, Filter, RefreshCw } from 'lucide-react';

type GradingItem = {
  id: number;
  type: 'assignment' | 'project';
  title: string;
  course_title: string;
  course_id: number;
  student_name: string;
  student_id: number;
  submitted_at: string;
  due_date?: string;
  days_late: number;
  points_possible: number;
  grade?: number;
  graded_at?: string;
};

const ImprovedGradingPage = () => {
  const { token, user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // State
  const [courses, setCourses] = useState<Course[]>([]);
  const [gradingItems, setGradingItems] = useState<GradingItem[]>([]);
  const [summary, setSummary] = useState<GradingSummary | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'pending' | 'graded' | 'all'>('pending');
  const [selectedType, setSelectedType] = useState<'all' | 'assignment' | 'project'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [analytics, setAnalytics] = useState<any>(null);

  useEffect(() => {
    if (token) {
      fetchCourses();
      fetchGradingData();
      fetchSummary();
    }
  }, [token, selectedCourse, selectedStatus, selectedType, currentPage]);

  useEffect(() => {
    // Handle URL query params
    const status = searchParams.get('status');
    if (status && ['pending', 'graded', 'all'].includes(status)) {
      setSelectedStatus(status as any);
    }
    const type = searchParams.get('type');
    if (type && ['all', 'assignment', 'project'].includes(type)) {
      setSelectedType(type as any);
    }
    const course = searchParams.get('course_id');
    if (course) {
      setSelectedCourse(course);
    }
  }, [searchParams]);

  const fetchGradingData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const filters: SubmissionFilters = {
        status: selectedStatus,
        page: currentPage,
        per_page: 20,
        search_query: searchQuery || undefined,
        sort_by: 'priority',
        sort_order: 'desc'
      };

      if (selectedCourse !== 'all') {
        filters.course_id = parseInt(selectedCourse);
      }

      const items: GradingItem[] = [];

      // Fetch assignments
      if (selectedType === 'all' || selectedType === 'assignment') {
        try {
          const assignmentData = await GradingService.getAssignmentSubmissions(filters);
          
          // Store analytics from the first response
          if (assignmentData.analytics) {
            setAnalytics(assignmentData.analytics);
          }
          
          items.push(...assignmentData.submissions.map(sub => ({
            id: sub.id,
            type: 'assignment' as const,
            title: sub.assignment_title,
            course_title: sub.course_title,
            course_id: sub.course_id,
            student_name: sub.student_name,
            student_id: sub.student_id,
            submitted_at: sub.submitted_at,
            due_date: sub.due_date,
            days_late: sub.days_late,
            points_possible: sub.assignment_points,
            grade: sub.grade,
            graded_at: sub.graded_at
          })));
          
          if (selectedType === 'assignment') {
            setTotalPages(assignmentData.pagination.pages);
          }
        } catch (err) {
          console.error('Failed to fetch assignment submissions:', err);
          if (selectedType === 'assignment') {
            setError('Failed to load assignment submissions');
          }
        }
      }

      // Fetch projects
      if (selectedType === 'all' || selectedType === 'project') {
        try {
          const projectData = await GradingService.getProjectSubmissions(filters);
          items.push(...projectData.submissions.map(sub => ({
            id: sub.id,
            type: 'project' as const,
            title: sub.project_title,
            course_title: sub.course_title,
            course_id: sub.course_id,
            student_name: sub.student_name,
            student_id: sub.student_id,
            submitted_at: sub.submitted_at,
            due_date: sub.due_date,
            days_late: sub.days_late,
            points_possible: sub.project_points,
            grade: sub.grade,
            graded_at: sub.graded_at
          })));
          
          if (selectedType === 'project') {
            setTotalPages(projectData.pagination.pages);
          }
        } catch (err) {
          console.error('Failed to fetch project submissions:', err);
          if (selectedType === 'project') {
            setError('Failed to load project submissions');
          }
        }
      }

      // Sort by submission date (newest first) and ungraded first
      items.sort((a, b) => {
        if (!a.grade && b.grade) return -1;
        if (a.grade && !b.grade) return 1;
        return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
      });

      setGradingItems(items);
    } catch (err: any) {
      setError(err.message || 'Failed to load grading data');
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const courseId = selectedCourse !== 'all' ? parseInt(selectedCourse) : undefined;
      const summaryData = await GradingService.getGradingSummary(courseId);
      setSummary(summaryData);
    } catch (err: any) {
      console.error('Failed to fetch grading summary:', err);
    }
  };

  const fetchCourses = async () => {
    try {
      const response = await fetch('/api/v1/instructor/courses', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const coursesData = await response.json();
        setCourses(coursesData);
      }
    } catch (err) {
      console.error('Failed to fetch courses:', err);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchGradingData(),
      fetchSummary()
    ]);
    setRefreshing(false);
  };

  const updateURL = () => {
    const params = new URLSearchParams();
    if (selectedStatus !== 'pending') params.set('status', selectedStatus);
    if (selectedType !== 'all') params.set('type', selectedType);
    if (selectedCourse !== 'all') params.set('course_id', selectedCourse);
    
    const newURL = `/instructor/grading${params.toString() ? '?' + params.toString() : ''}`;
    router.push(newURL, { scroll: false });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getGradeColor = (grade: number, maxPoints: number) => {
    const percentage = GradingService.calculatePercentage(grade, maxPoints);
    if (percentage >= 90) return 'text-green-600 dark:text-green-400';
    if (percentage >= 80) return 'text-blue-600 dark:text-blue-400';
    if (percentage >= 70) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };



  const getStatusIcon = (item: GradingItem) => {
    if (item.grade !== undefined) {
      return <CheckCircle className="w-4 h-4 text-green-600" />;
    }
    if (item.days_late > 0) {
      return <AlertCircle className="w-4 h-4 text-red-600" />;
    }
    return <Clock className="w-4 h-4 text-orange-600" />;
  };

  const getStatusText = (item: GradingItem) => {
    if (item.grade !== undefined) {
      return `Graded on ${formatDate(item.graded_at!)}`;
    }
    if (item.days_late > 0) {
      return `${item.days_late} day${item.days_late > 1 ? 's' : ''} overdue`;
    }
    return 'Awaiting grade';
  };

  if (loading && gradingItems.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-slate-600 dark:text-slate-300">Loading grading center...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Grading Center</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Review and grade student submissions
            {user?.role?.name === 'instructor' && (
              <span className="ml-2 px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400 rounded-full text-xs font-medium">
                Instructor
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
          >
            {refreshing ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-slate-500"></div>
                <span>Refreshing...</span>
              </div>
            ) : (
              'Refresh'
            )}
          </button>
          <Link
            href="/instructor/grading/analytics"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Award className="w-4 h-4 inline mr-2" />
            View Analytics
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Pending Assignments</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {summary.assignments.pending}
                </p>
              </div>
              <div className="h-12 w-12 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Pending Projects</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {summary.projects.pending}
                </p>
              </div>
              <div className="h-12 w-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Graded This Week</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {summary.assignments.recent_graded + summary.projects.recent_graded}
                </p>
              </div>
              <div className="h-12 w-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Total Graded</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {summary.total_graded}
                </p>
              </div>
              <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Analytics */}
      {analytics && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Grading Insights</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Quick Stats */}
            <div>
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Current Status</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Overdue Items</span>
                  <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                    {analytics.summary.overdue_count}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Due Soon</span>
                  <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                    {analytics.summary.due_soon_count}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Completion Rate</span>
                  <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                    {analytics.summary.completion_rate}%
                  </span>
                </div>
              </div>
            </div>

            {/* Suggestions */}
            <div>
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Suggestions</h3>
              <div className="space-y-2">
                {analytics.insights.suggested_actions.length > 0 ? (
                  analytics.insights.suggested_actions.slice(0, 3).map((action: string, index: number) => (
                    <div key={index} className="flex items-start">
                      <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{action}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-500 italic">
                    All caught up! No urgent actions needed.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Filters</h2>
        
        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search submissions, students, assignments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  setCurrentPage(1);
                  fetchGradingData();
                }
              }}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Course Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Course
            </label>
            <select
              value={selectedCourse}
              onChange={(e) => { 
                setSelectedCourse(e.target.value); 
                setCurrentPage(1);
                updateURL();
              }}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Courses</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => { 
                setSelectedStatus(e.target.value as any); 
                setCurrentPage(1);
                updateURL();
              }}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="pending">Pending</option>
              <option value="graded">Graded</option>
              <option value="all">All</option>
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Type
            </label>
            <select
              value={selectedType}
              onChange={(e) => { 
                setSelectedType(e.target.value as any); 
                setCurrentPage(1);
                updateURL();
              }}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="assignment">Assignments</option>
              <option value="project">Projects</option>
            </select>
          </div>
        </div>
      </div>

      {/* Submissions List */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Submissions ({gradingItems.length})
          </h2>
        </div>

        {gradingItems.length === 0 ? (
          <div className="p-6 text-center">
            <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-slate-600 dark:text-slate-400 mt-4 mb-2">
              No submissions found
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-500">
              Try adjusting your filters or check back later
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {gradingItems.map((item) => (
                <div key={`${item.type}-${item.id}`} className="p-6 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          item.type === 'assignment'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                            : 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
                        }`}>
                          {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                        </span>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(item)}
                          <span className="text-xs text-slate-600 dark:text-slate-400">
                            {getStatusText(item)}
                          </span>
                        </div>
                        {item.days_late > 0 && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                            {item.days_late} day{item.days_late > 1 ? 's' : ''} late
                          </span>
                        )}
                      </div>

                      <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                        {item.title}
                      </h3>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                        <span className="flex items-center">
                          <User className="w-4 h-4 mr-1" />
                          {item.student_name}
                        </span>
                        <span className="flex items-center">
                          <BookOpen className="w-4 h-4 mr-1" />
                          {item.course_title}
                        </span>
                        <span className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          Submitted {formatDate(item.submitted_at)}
                        </span>
                        {item.grade !== undefined ? (
                          <span className={`flex items-center font-medium ${getGradeColor(item.grade, item.points_possible)}`}>
                            <Award className="w-4 h-4 mr-1" />
                            {GradingService.formatGrade(item.grade, item.points_possible)}
                          </span>
                        ) : (
                          <span className="flex items-center text-orange-600 dark:text-orange-400 font-medium">
                            <Clock className="w-4 h-4 mr-1" />
                            Pending Grade
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex space-x-2 ml-4">
                      <Link
                        href={`/instructor/grading/${item.type}/${item.id}`}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        {item.grade !== undefined ? 'Review' : 'Grade'}
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-slate-600 dark:text-slate-400">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ImprovedGradingPage;
