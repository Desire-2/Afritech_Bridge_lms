"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import InstructorAssignmentService from '@/services/api/instructor-assignment.service';
import InstructorApiService from '@/services/api/instructor.service';
import { Course, EnhancedModule, Assignment, Quiz, Project } from '@/types/api';

interface AssignmentWithStats extends Assignment {
  course_title?: string;
  total_submissions?: number;
  pending_grading?: number;
  graded?: number;
  average_score?: number;
}

interface AssessmentData {
  assignments: AssignmentWithStats[];
  quizzes: Quiz[];
  projects: Project[];
}

type AssessmentType = 'assignment' | 'quiz' | 'project';

interface AssessmentStats {
  totalAssignments: number;
  publishedAssignments: number;
  draftAssignments: number;
  overdueAssignments: number;
  totalSubmissions: number;
  pendingGrading: number;
}

const AssignmentsPage = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [assessments, setAssessments] = useState<AssessmentData>({
    assignments: [],
    quizzes: [],
    projects: []
  });
  const [filteredItems, setFilteredItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft'>('all');
  const [filterModuleId, setFilterModuleId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'created_at' | 'due_date' | 'title' | 'module' | 'points'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [activeTab, setActiveTab] = useState<AssessmentType>('assignment');
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const { token } = useAuth();

  useEffect(() => {
    fetchData();
  }, [token]);

  useEffect(() => {
    filterAndSortItems();
  }, [assessments, searchQuery, filterStatus, filterModuleId, sortBy, sortOrder, selectedCourse, activeTab]);

  const fetchData = async () => {
    if (!token) {
      console.log('[AssignmentsPage] No token available');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('[AssignmentsPage] Fetching instructor data...');
      
      // Fetch courses using InstructorApiService (already an instance)
      const coursesData = await InstructorApiService.getInstructorCourses();
      
      console.log('[AssignmentsPage] Courses data:', coursesData.length, 'courses');
      
      setCourses(coursesData);
      if (coursesData.length > 0 && !selectedCourse) {
        setSelectedCourse(coursesData[0]);
        console.log('[AssignmentsPage] Selected first course:', coursesData[0].title);
      }

      // Fetch all assignments with statistics (already an instance)
      const assignmentsData = await InstructorAssignmentService.getInstructorAssignments();
      
      console.log('[AssignmentsPage] Assignments data:', assignmentsData.length, 'assignments');
      
      // Fetch quizzes and projects if needed (for now just assignments)
      setAssessments({
        assignments: assignmentsData,
        quizzes: [], // TODO: Fetch quizzes
        projects: [], // TODO: Fetch projects
      });
      
    } catch (err: any) {
      console.error('[AssignmentsPage] Error fetching data:', err);
      console.error('[AssignmentsPage] Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        stack: err.stack
      });
      
      let errorMessage = 'Failed to load data';
      if (err.response?.status === 401) {
        errorMessage = 'Authentication failed. Please log in again.';
      } else if (err.response?.status === 403) {
        errorMessage = 'Instructor access required. Please check your permissions.';
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentItems = () => {
    if (activeTab === 'assignment') return assessments.assignments;
    if (activeTab === 'quiz') return assessments.quizzes;
    if (activeTab === 'project') return assessments.projects;
    return [];
  };

  const filterAndSortItems = () => {
    let filtered = getCurrentItems();

    // Filter by selected course
    if (selectedCourse) {
      filtered = filtered.filter(item => item.course_id === selectedCourse.id);
    }

    // Apply module filter  
    if (filterModuleId) {
      filtered = filtered.filter(item => {
        if (activeTab === 'project' && 'module_ids' in item) {
          return item.module_ids?.includes(filterModuleId);
        }
        return item.module_id === filterModuleId;
      });
    }

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(item =>
        filterStatus === 'published' ? item.is_published : !item.is_published
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'due_date':
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          comparison = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'points':
          comparison = (a.points_possible || 0) - (b.points_possible || 0);
          break;
        case 'module':
          comparison = (a.module_id || 0) - (b.module_id || 0);
          break;
        case 'created_at':
        default:
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    setFilteredItems(filtered);
  };

  const calculateStats = () => {
    const courseItems = selectedCourse 
      ? assessments.assignments.filter(a => a.course_id === selectedCourse.id)
      : assessments.assignments;
    
    const now = new Date();
    return {
      totalAssignments: courseItems.length,
      publishedAssignments: courseItems.filter(a => a.is_published).length,
      draftAssignments: courseItems.filter(a => !a.is_published).length,
      overdueAssignments: courseItems.filter(a => 
        a.due_date && new Date(a.due_date) < now && a.is_published
      ).length,
      totalSubmissions: courseItems.reduce((sum, a) => sum + (a.total_submissions || 0), 0),
      pendingGrading: courseItems.reduce((sum, a) => sum + (a.pending_grading || 0), 0),
    };
  };

  const stats = calculateStats();

  // Bulk operations
  const handleSelectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map(item => item.id)));
    }
  };

  const handleSelectItem = (itemId: number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleBulkPublish = async () => {
    if (selectedItems.size === 0) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // TODO: Implement bulk publish API call
      setSuccessMessage(`Successfully published ${selectedItems.size} ${activeTab}(s)`);
      setSelectedItems(new Set());
      await fetchData();
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to bulk publish');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUnpublish = async () => {
    if (selectedItems.size === 0) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // TODO: Implement bulk unpublish API call
      setSuccessMessage(`Successfully unpublished ${selectedItems.size} ${activeTab}(s)`);
      setSelectedItems(new Set());
      await fetchData();
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to bulk unpublish');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedItems.size} ${activeTab}(s)? This action cannot be undone.`)) {
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // TODO: Implement bulk delete API call
      setSuccessMessage(`Successfully deleted ${selectedItems.size} ${activeTab}(s)`);
      setSelectedItems(new Set());
      await fetchData();
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to bulk delete');
    } finally {
      setLoading(false);
    }
  };

  // Tab configuration
  const tabs = [
    {
      id: 'assignment' as AssessmentType,
      label: 'Assignments',
      icon: '📝',
      count: selectedCourse 
        ? assessments.assignments.filter(a => a.course_id === selectedCourse.id).length 
        : assessments.assignments.length
    },
    {
      id: 'quiz' as AssessmentType,
      label: 'Quizzes',
      icon: '📊',
      count: selectedCourse 
        ? assessments.quizzes.filter(q => q.course_id === selectedCourse.id).length 
        : assessments.quizzes.length
    },
    {
      id: 'project' as AssessmentType,
      label: 'Projects',
      icon: '🚀',
      count: selectedCourse 
        ? assessments.projects.filter(p => p.course_id === selectedCourse.id).length 
        : assessments.projects.length
    }
  ];

  const getAssignmentTypeIcon = (type: string) => {
    switch (type) {
      case 'file_upload':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        );
      case 'text_response':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-slate-600 dark:text-slate-300">Loading assessments...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xl">✅</span>
            <span className="font-medium">{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xl">⚠️</span>
            <span className="font-medium">{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">📚 Assessment Management</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Create, manage, and track all course assessments in one place
          </p>
        </div>
        {selectedCourse && (
          <div className="flex items-center gap-3">
            {/* AI Assistant Button */}
            <button
              onClick={() => alert('AI Assistant integration coming soon!')}
              className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
              title="Generate assessments with AI - Analyzes your lesson/module content to create aligned assessments automatically"
            >
              <span className="text-lg">🤖</span>
              <span className="font-medium">AI Assistant</span>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full capitalize">
                {activeTab}
              </span>
            </button>
            
            <Link
              href={`/instructor/courses/${selectedCourse.id}?tab=assessments`}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create {activeTab === 'assignment' ? 'Assignment' : activeTab === 'quiz' ? 'Quiz' : 'Project'}
            </Link>
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="border-b border-slate-200 dark:border-slate-700 px-6">
          <nav className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSelectedItems(new Set());
                  setSearchQuery('');
                }}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                <span>{tab.label}</span>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </nav>
        </div>
        
        {/* Bulk Actions Bar */}
        {selectedItems.size > 0 && (
          <div className="px-6 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
              {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkPublish}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-md transition-colors"
              >
                ✅ Publish
              </button>
              <button
                onClick={handleBulkUnpublish}
                className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded-md transition-colors"
              >
                📝 Unpublish
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-md transition-colors"
              >
                🗑️ Delete
              </button>
              <button
                onClick={() => setSelectedItems(new Set())}
                className="px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded-md transition-colors"
              >
                ✕ Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Statistics Cards */}
      {selectedCourse && assessments.assignments.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Assignments</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{stats.totalAssignments}</p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Published</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">{stats.publishedAssignments}</p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Drafts</p>
                <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mt-2">{stats.draftAssignments}</p>
              </div>
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                <svg className="w-8 h-8 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Submissions</p>
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 mt-2">{stats.totalSubmissions}</p>
              </div>
              <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                <svg className="w-8 h-8 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Pending Grading</p>
                <p className="text-3xl font-bold text-orange-600 dark:text-orange-400 mt-2">{stats.pendingGrading}</p>
              </div>
              <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                <svg className="w-8 h-8 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Course Selection */}
      {courses.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <span>📚</span>
            <span>Select Course</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {courses.map((course) => {
              const courseCount = assessments.assignments.filter(a => a.course_id === course.id).length +
                                 assessments.quizzes.filter(q => q.course_id === course.id).length +
                                 assessments.projects.filter(p => p.course_id === course.id).length;
              return (
                <button
                  key={course.id}
                  onClick={() => setSelectedCourse(course)}
                  className={`px-4 py-2.5 rounded-lg font-medium transition-all duration-200 ${
                    selectedCourse?.id === course.id
                      ? 'bg-blue-600 text-white shadow-md transform scale-105'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 hover:scale-105'
                  }`}
                >
                  {course.title}
                  <span className="ml-2 text-xs opacity-75">
                    ({courseCount})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Enhanced Filters and Search */}
      {selectedCourse && assessments.assignments.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border-2 border-slate-200 dark:border-slate-700 p-5">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search Bar */}
            <div className="flex-1">
              <div className="relative group">
                <input
                  type="text"
                  placeholder={`Search ${activeTab === 'assignment' ? 'assignments' : activeTab === 'quiz' ? 'quizzes' : 'projects'}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-white transition-all duration-200 group-hover:border-blue-400"
                />
                <span className="absolute left-4 top-3.5 text-slate-400 text-xl group-hover:scale-110 transition-transform">🔍</span>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Module Filter */}
            <div className="w-full lg:w-64">
              <select
                value={filterModuleId || ''}
                onChange={(e) => setFilterModuleId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-4 py-3 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-white transition-all duration-200"
              >
                <option value="">📚 All Modules</option>
                {selectedCourse.modules?.map(module => {
                  const moduleCount = filteredItems.filter(item => {
                    if (activeTab === 'project' && 'module_ids' in item) {
                      return item.module_ids?.includes(module.id);
                    }
                    return item.module_id === module.id;
                  }).length;
                  return (
                    <option key={module.id} value={module.id}>
                      {module.title} ({moduleCount})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Sort Controls */}
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-3 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white transition-all duration-200"
              >
                <option value="created_at">📅 Date</option>
                <option value="title">📝 Title</option>
                <option value="module">📚 Module</option>
                <option value="points">🎯 Points</option>
                <option value="due_date">⏰ Due Date</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="px-4 py-3 border-2 border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-700 transition-all duration-200 font-semibold"
                title={`Sort ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
              >
                {sortOrder === 'asc' ? '⬆️' : '⬇️'}
              </button>
            </div>
            
            {/* Status Filter Buttons */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-5 py-3 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center space-x-2 ${
                  filterStatus === 'all'
                    ? 'bg-blue-600 text-white shadow-lg transform scale-105'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 hover:scale-105'
                }`}
              >
                <span>📋</span>
                <span>All</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  filterStatus === 'all' 
                    ? 'bg-blue-700 text-white' 
                    : 'bg-slate-200 dark:bg-slate-600'
                }`}>
                  {getCurrentItems().length}
                </span>
              </button>
              
              <button
                onClick={() => setFilterStatus('published')}
                className={`px-5 py-3 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center space-x-2 ${
                  filterStatus === 'published'
                    ? 'bg-green-600 text-white shadow-lg transform scale-105'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 hover:scale-105'
                }`}
              >
                <span>✅</span>
                <span>Published</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  filterStatus === 'published' 
                    ? 'bg-green-700 text-white' 
                    : 'bg-slate-200 dark:bg-slate-600'
                }`}>
                  {getCurrentItems().filter(i => i.is_published).length}
                </span>
              </button>
              
              <button
                onClick={() => setFilterStatus('draft')}
                className={`px-5 py-3 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center space-x-2 ${
                  filterStatus === 'draft'
                    ? 'bg-yellow-600 text-white shadow-lg transform scale-105'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 hover:scale-105'
                }`}
              >
                <span>📝</span>
                <span>Drafts</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  filterStatus === 'draft' 
                    ? 'bg-yellow-700 text-white' 
                    : 'bg-slate-200 dark:bg-slate-600'
                }`}>
                  {getCurrentItems().filter(i => !i.is_published).length}
                </span>
              </button>
            </div>
          </div>
          
          {/* Active Filters Display */}
          {(searchQuery || filterStatus !== 'all' || filterModuleId || sortBy !== 'created_at') && (
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Active filters:</span>
                  {searchQuery && (
                    <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-xs font-medium flex items-center space-x-1">
                      <span>Search: "{searchQuery}"</span>
                      <button onClick={() => setSearchQuery('')} className="ml-1 hover:text-blue-600">✕</button>
                    </span>
                  )}
                  {filterStatus !== 'all' && (
                    <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-xs font-medium flex items-center space-x-1">
                      <span>Status: {filterStatus}</span>
                      <button onClick={() => setFilterStatus('all')} className="ml-1 hover:text-green-600">✕</button>
                    </span>
                  )}
                  {filterModuleId && (
                    <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-full text-xs font-medium flex items-center space-x-1">
                      <span>Module filtered</span>
                      <button onClick={() => setFilterModuleId(null)} className="ml-1 hover:text-purple-600">✕</button>
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setFilterStatus('all');
                    setFilterModuleId(null);
                    setSortBy('created_at');
                    setSortOrder('desc');
                  }}
                  className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                >
                  Clear all
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Assignments List */}
      {selectedCourse ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                {activeTab === 'assignment' ? '📝 Assignments' : activeTab === 'quiz' ? '📊 Quizzes' : '🚀 Projects'} for {selectedCourse.title}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'} found
              </p>
            </div>
            
            {/* Checkbox to select all */}
            {filteredItems.length > 0 && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
                  onChange={handleSelectAll}
                  className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-600 dark:text-slate-400">Select all</span>
              </label>
            )}
          </div>
          
          {filteredItems.length === 0 ? (
            <div className="p-12 text-center">
              {getCurrentItems().length === 0 ? (
                <>
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full mb-4">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                    No {activeTab}s yet
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-6">
                    Get started by creating your first {activeTab} for this course.
                  </p>
                  <Link
                    href={`/instructor/courses/${selectedCourse.id}?tab=assessments`}
                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create {activeTab === 'assignment' ? 'Assignment' : activeTab === 'quiz' ? 'Quiz' : 'Project'}
                  </Link>
                </>
              ) : (
                <>
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full mb-4">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                    No {activeTab}s match your filters
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-4">
                    Try adjusting your search or filters to find what you're looking for.
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setFilterStatus('all');
                      setFilterModuleId(null);
                    }}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Clear Filters
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {filteredItems.map((item) => {
                const isOverdue = item.due_date && new Date(item.due_date) < new Date();
                const daysUntilDue = item.due_date 
                  ? Math.ceil((new Date(item.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                  : null;
                const isAssignment = activeTab === 'assignment';

                return (
                  <div key={item.id} className="p-6 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <div className="flex items-start gap-4">
                      {/* Checkbox Selection */}
                      <div className="pt-2">
                        <input
                          type="checkbox"
                          checked={selectedItems.has(item.id)}
                          onChange={() => handleSelectItem(item.id)}
                          className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-400">
                            {isAssignment ? getAssignmentTypeIcon(item.assignment_type) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                {item.title}
                              </h3>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                item.is_published
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                              }`}>
                                {item.is_published ? 'Published' : 'Draft'}
                              </span>
                            </div>
                            <p className="text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">
                              {item.description}
                            </p>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                              {item.due_date && (
                                <div className="flex items-center gap-1">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <span className={isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
                                    Due: {new Date(item.due_date).toLocaleDateString()}
                                    {daysUntilDue !== null && !isOverdue && daysUntilDue <= 7 && (
                                      <span className="ml-1 text-orange-600 dark:text-orange-400">
                                        ({daysUntilDue} {daysUntilDue === 1 ? 'day' : 'days'} left)
                                      </span>
                                    )}
                                    {isOverdue && <span className="ml-1">(Overdue)</span>}
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                </svg>
                                <span>{item.points_possible} points</span>
                              </div>
                              {isAssignment && 'assignment_type' in item && (
                                <div className="flex items-center gap-1">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                  </svg>
                                  <span className="capitalize">{item.assignment_type.replace('_', ' ')}</span>
                                </div>
                              )}
                              {isAssignment && 'total_submissions' in item && item.total_submissions !== undefined && (
                                <div className="flex items-center gap-1">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  <span>{item.total_submissions} submission{item.total_submissions !== 1 ? 's' : ''}</span>
                                </div>
                              )}
                              {isAssignment && 'pending_grading' in item && item.pending_grading !== undefined && item.pending_grading > 0 && (
                                <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span className="font-medium">{item.pending_grading} pending</span>
                                </div>
                              )}
                              {isAssignment && 'average_score' in item && item.average_score !== undefined && 'graded' in item && item.graded && item.graded > 0 && (
                                <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                  </svg>
                                  <span>Avg: {item.average_score.toFixed(1)}%</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <Link
                          href={`/instructor/courses/${selectedCourse.id}?tab=assessments&${activeTab}=${item.id}`}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 font-medium text-sm transition-colors whitespace-nowrap"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </Link>
                        {isAssignment && (
                          <Link
                            href={`/instructor/grading?assignment=${item.id}`}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 font-medium text-sm transition-colors whitespace-nowrap"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            Grade
                            {'pending_grading' in item && item.pending_grading && item.pending_grading > 0 && (
                              <span className="ml-1 px-2 py-0.5 bg-orange-500 text-white text-xs rounded-full">
                                {item.pending_grading}
                              </span>
                            )}
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-12 text-center border border-slate-200 dark:border-slate-700">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full mb-4">
            <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
            No courses yet
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            You need to create a course before you can manage assignments.
          </p>
          <Link
            href="/instructor/courses/create"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Your First Course
          </Link>
        </div>
      )}
    </div>
  );
};

export default AssignmentsPage;