"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams } from 'next/navigation';
import EnhancedGradingService, {
  EnhancedAssignmentSubmission,
  SubmissionFilters,
  GradingAnalytics,
  SmartGradingSuggestion
} from '@/services/enhanced-grading.service';
import { Course } from '@/types/api';
import { 
  ClockIcon, 
  ChartBarIcon, 
  AcademicCapIcon,
  EyeIcon,
  PencilIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  FunnelIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  CalendarIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';

interface GradingStats {
  totalPending: number;
  totalOverdue: number;
  averageGradingTime: number;
  completionRate: number;
}

const EnhancedGradingDashboard = () => {
  const { token } = useAuth();
  const searchParams = useSearchParams();
  
  // State management
  const [courses, setCourses] = useState<Course[]>([]);
  const [submissions, setSubmissions] = useState<EnhancedAssignmentSubmission[]>([]);
  const [analytics, setAnalytics] = useState<GradingAnalytics | null>(null);
  const [suggestions, setSuggestions] = useState<SmartGradingSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedSubmissions, setSelectedSubmissions] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [filters, setFilters] = useState<SubmissionFilters>({
    status: 'pending',
    sort_by: 'priority',
    sort_order: 'desc',
    page: 1,
    per_page: 20
  });

  // Advanced filter state
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [dateRange, setDateRange] = useState<{start: string; end: string}>({
    start: '',
    end: ''
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Real-time updates
  useEffect(() => {
    if (!token) return;

    const unsubscribe = EnhancedGradingService.subscribeToGradingUpdates((update) => {
      if (update.type === 'new_submission' || update.type === 'submission_graded') {
        fetchGradingData();
      }
    });

    return unsubscribe;
  }, [token]);

  // Fetch data effect
  useEffect(() => {
    if (token) {
      fetchGradingData();
    }
  }, [token, filters, currentPage]);

  const fetchGradingData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const searchFilters = {
        ...filters,
        page: currentPage,
        search_query: searchQuery || undefined,
        priority: priorityFilter !== 'all' ? priorityFilter : undefined,
        date_range: dateRange.start && dateRange.end ? dateRange : undefined
      };

      const data = await EnhancedGradingService.getEnhancedAssignmentSubmissions(searchFilters);
      
      setSubmissions(data.submissions);
      setAnalytics(data.analytics);
      setSuggestions(data.suggestions);
      setTotalPages(data.pagination.pages);
      
    } catch (err: any) {
      setError(err.message || 'Failed to load grading data');
      console.error('Error fetching grading data:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, currentPage, searchQuery, priorityFilter, dateRange]);

  // Computed values
  const gradingStats = useMemo<GradingStats>(() => {
    if (!analytics) {
      return {
        totalPending: 0,
        totalOverdue: 0,
        averageGradingTime: 0,
        completionRate: 0
      };
    }

    const overdue = submissions.filter(s => 
      s.priority_level === 'high' && s.due_date && new Date(s.due_date) < new Date()
    ).length;

    return {
      totalPending: analytics.summary.total_pending,
      totalOverdue: overdue,
      averageGradingTime: analytics.summary.average_grading_time || 0,
      completionRate: analytics.summary.completion_rate
    };
  }, [analytics, submissions]);

  const filteredSubmissions = useMemo(() => {
    return submissions.filter(submission => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          submission.student_name.toLowerCase().includes(query) ||
          submission.assignment_title.toLowerCase().includes(query) ||
          submission.course_title.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [submissions, searchQuery]);

  // Event handlers
  const handleFilterChange = (key: keyof SubmissionFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const handleSort = (sortBy: string) => {
    const newOrder = filters.sort_by === sortBy && filters.sort_order === 'asc' ? 'desc' : 'asc';
    setFilters(prev => ({ 
      ...prev, 
      sort_by: sortBy as any, 
      sort_order: newOrder 
    }));
  };

  const handleBulkSelection = (submissionId: number, selected: boolean) => {
    const newSelected = new Set(selectedSubmissions);
    if (selected) {
      newSelected.add(submissionId);
    } else {
      newSelected.delete(submissionId);
    }
    setSelectedSubmissions(newSelected);
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      const allIds = new Set(filteredSubmissions.map(s => s.id));
      setSelectedSubmissions(allIds);
    } else {
      setSelectedSubmissions(new Set());
    }
  };

  const handleBulkGrade = async () => {
    if (selectedSubmissions.size === 0) return;
    
    // Implementation would open bulk grading modal
    console.log('Bulk grade submissions:', Array.from(selectedSubmissions));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-green-600 bg-green-50 border-green-200';
    }
  };

  const formatTimeEstimate = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  if (loading && submissions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-slate-600 dark:text-slate-300">Loading grading dashboard...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header with Stats */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold">Enhanced Grading Dashboard</h1>
            <p className="text-blue-100 mt-1">AI-powered grading with advanced analytics</p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setBulkMode(!bulkMode)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                bulkMode 
                  ? 'bg-white text-blue-600' 
                  : 'bg-blue-700 text-white hover:bg-blue-800'
              }`}
            >
              {bulkMode ? 'Exit Bulk Mode' : 'Bulk Actions'}
            </button>
            {bulkMode && selectedSubmissions.size > 0 && (
              <button
                onClick={handleBulkGrade}
                className="px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
              >
                Grade Selected ({selectedSubmissions.size})
              </button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white bg-opacity-20 rounded-lg p-4">
            <div className="flex items-center">
              <ClockIcon className="h-6 w-6 text-blue-200 mr-2" />
              <div>
                <p className="text-sm text-blue-100">Pending</p>
                <p className="text-2xl font-bold">{gradingStats.totalPending}</p>
              </div>
            </div>
          </div>
          <div className="bg-white bg-opacity-20 rounded-lg p-4">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-200 mr-2" />
              <div>
                <p className="text-sm text-blue-100">Overdue</p>
                <p className="text-2xl font-bold">{gradingStats.totalOverdue}</p>
              </div>
            </div>
          </div>
          <div className="bg-white bg-opacity-20 rounded-lg p-4">
            <div className="flex items-center">
              <ChartBarIcon className="h-6 w-6 text-green-200 mr-2" />
              <div>
                <p className="text-sm text-blue-100">Completion</p>
                <p className="text-2xl font-bold">{gradingStats.completionRate.toFixed(1)}%</p>
              </div>
            </div>
          </div>
          <div className="bg-white bg-opacity-20 rounded-lg p-4">
            <div className="flex items-center">
              <AcademicCapIcon className="h-6 w-6 text-purple-200 mr-2" />
              <div>
                <p className="text-sm text-blue-100">Avg Time</p>
                <p className="text-2xl font-bold">{formatTimeEstimate(gradingStats.averageGradingTime)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Suggestions Panel */}
      {suggestions.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-6">
          <div className="flex items-center mb-4">
            <SparklesIcon className="h-6 w-6 text-purple-600 mr-2" />
            <h2 className="text-lg font-semibold text-purple-900">AI Grading Suggestions</h2>
          </div>
          <div className="space-y-3">
            {suggestions.map((suggestion) => (
              <div key={suggestion.submission_id} className="bg-white rounded-lg p-4 border border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">
                      Suggested Grade: <span className="text-purple-600">{suggestion.suggested_grade}%</span>
                    </p>
                    <p className="text-sm text-slate-600 mt-1">{suggestion.reasoning}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      suggestion.confidence_score > 0.8 
                        ? 'bg-green-100 text-green-800'
                        : suggestion.confidence_score > 0.6
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {(suggestion.confidence_score * 100).toFixed(0)}% confidence
                    </span>
                    <Link
                      href={`/instructor/grading/assignment/${suggestion.submission_id}`}
                      className="px-3 py-1 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      Review
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search submissions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 w-64"
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Status Filter */}
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="pending">Pending</option>
              <option value="graded">Graded</option>
              <option value="overdue">Overdue</option>
              <option value="all">All</option>
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>

          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="flex items-center px-4 py-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <FunnelIcon className="h-4 w-4 mr-2" />
            Advanced Filters
          </button>
        </div>

        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Date Range Start
                </label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Date Range End
                </label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setDateRange({ start: '', end: '' });
                    setSearchQuery('');
                    setPriorityFilter('all');
                  }}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-600 rounded-lg transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Submissions Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Submissions ({filteredSubmissions.length})
            </h2>
            {bulkMode && (
              <div className="flex items-center space-x-3">
                <label className="flex items-center text-sm text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={selectedSubmissions.size === filteredSubmissions.length && filteredSubmissions.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="mr-2 rounded border-slate-300 focus:ring-blue-500"
                  />
                  Select All
                </label>
              </div>
            )}
          </div>
        </div>

        {error ? (
          <div className="p-8 text-center">
            <div className="text-red-600 mb-2">Error loading submissions</div>
            <p className="text-slate-600 dark:text-slate-400">{error}</p>
            <button 
              onClick={fetchGradingData}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="p-8 text-center">
            <ClockIcon className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-400">No submissions found</p>
            <p className="text-sm text-slate-500 dark:text-slate-500 mt-2">
              Try adjusting your filters or check back later
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  {bulkMode && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider w-12">
                      Select
                    </th>
                  )}
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-slate-300"
                    onClick={() => handleSort('student_name')}
                  >
                    <div className="flex items-center">
                      Student
                      {filters.sort_by === 'student_name' && (
                        filters.sort_order === 'asc' ? 
                        <ArrowUpIcon className="h-4 w-4 ml-1" /> : 
                        <ArrowDownIcon className="h-4 w-4 ml-1" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-slate-300"
                    onClick={() => handleSort('assignment_title')}
                  >
                    Assignment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Course
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-slate-300"
                    onClick={() => handleSort('submitted_at')}
                  >
                    <div className="flex items-center">
                      Submitted
                      {filters.sort_by === 'submitted_at' && (
                        filters.sort_order === 'asc' ? 
                        <ArrowUpIcon className="h-4 w-4 ml-1" /> : 
                        <ArrowDownIcon className="h-4 w-4 ml-1" />
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Est. Time
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-slate-300"
                    onClick={() => handleSort('grade')}
                  >
                    Grade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                {filteredSubmissions.map((submission) => (
                  <tr 
                    key={submission.id} 
                    className={`hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${
                      selectedSubmissions.has(submission.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    {bulkMode && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedSubmissions.has(submission.id)}
                          onChange={(e) => handleBulkSelection(submission.id, e.target.checked)}
                          className="rounded border-slate-300 focus:ring-blue-500"
                        />
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="ml-4">
                          <div className="text-sm font-medium text-slate-900 dark:text-white">
                            {submission.student_name}
                          </div>
                          <div className="text-sm text-slate-500 dark:text-slate-400">
                            {submission.student_email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-900 dark:text-white font-medium">
                        {submission.assignment_title}
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {submission.assignment_points} points
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                      {submission.course_title}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                      <div>{new Date(submission.submitted_at).toLocaleDateString()}</div>
                      <div className="text-xs">
                        {new Date(submission.submitted_at).toLocaleTimeString()}
                      </div>
                      {submission.days_late > 0 && (
                        <div className="text-xs text-red-600 font-medium">
                          {submission.days_late.toFixed(1)} days late
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(submission.priority_level)}`}>
                        {submission.priority_level}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                      {formatTimeEstimate(submission.estimated_grading_time)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {submission.grade !== undefined ? (
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-slate-900 dark:text-white">
                            {submission.grade}/{submission.assignment_points}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {submission.percentage?.toFixed(1)}%
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <Link
                          href={`/instructor/grading/assignment/${submission.id}`}
                          className="inline-flex items-center px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <PencilIcon className="h-3 w-3 mr-1" />
                          Grade
                        </Link>
                        {submission.grade !== undefined && (
                          <Link
                            href={`/instructor/grading/assignment/${submission.id}`}
                            className="inline-flex items-center px-3 py-1 bg-slate-600 text-white text-xs rounded-lg hover:bg-slate-700 transition-colors"
                          >
                            <EyeIcon className="h-3 w-3 mr-1" />
                            View
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Analytics Panel */}
      {analytics && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Grading Analytics</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Grade Distribution */}
            <div>
              <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Grade Distribution</h4>
              <div className="space-y-2">
                {analytics.distribution.grade_ranges.map((range) => (
                  <div key={range.range} className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">{range.range}</span>
                    <div className="flex items-center">
                      <div className="w-16 bg-slate-200 dark:bg-slate-600 rounded-full h-2 mr-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${range.percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-slate-600 dark:text-slate-400 w-8">
                        {range.count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Insights */}
            <div>
              <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Insights & Suggestions</h4>
              <div className="space-y-2">
                {analytics.insights.suggested_actions.map((action, index) => (
                  <div key={index} className="flex items-start">
                    <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{action}</p>
                  </div>
                ))}
                {analytics.insights.suggested_actions.length === 0 && (
                  <p className="text-sm text-slate-500 dark:text-slate-500 italic">
                    No specific suggestions at this time. Keep up the great work!
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedGradingDashboard;