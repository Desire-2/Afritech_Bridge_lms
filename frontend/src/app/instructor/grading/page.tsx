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
import { Clock, CheckCircle, AlertCircle, User, BookOpen, Calendar, Award, Search, Filter, RefreshCw, Repeat, AlertTriangle, FileEdit, Zap, Download, CheckSquare } from 'lucide-react';
import { QuickGradingModal } from '@/components/grading/QuickGradingModal';

// API Base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';

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
  is_resubmission?: boolean;
  resubmission_count?: number;
  submission_notes?: string;
  // Assignment-level modification request fields
  modification_requested?: boolean;
  modification_request_reason?: string;
  modification_requested_at?: string;
  modification_requested_by?: number;
  can_resubmit?: boolean;
};

const ImprovedGradingPage = () => {
  const { token, user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // State
  const [courses, setCourses] = useState<Course[]>([]);
  const [gradingItems, setGradingItems] = useState<GradingItem[]>([]);
  const [summary, setSummary] = useState<GradingSummary | null>(null);
  // Enhanced state for submission status filtering
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'pending' | 'graded' | 'all' | 'resubmitted' | 'modification_requested'>('pending');
  const [selectedType, setSelectedType] = useState<'all' | 'assignment' | 'project'>('all');
  
  // New filtering states
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [selectedLesson, setSelectedLesson] = useState<string>('all');
  const [selectedStudent, setSelectedStudent] = useState<string>('all');
  const [modules, setModules] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [analytics, setAnalytics] = useState<any>(null);

  // Status grouping for improved organization
  const [statusCounts, setStatusCounts] = useState({
    pending: 0,
    resubmitted: 0,
    modification_requested: 0,
    graded: 0,
    overdue: 0
  });

  // Quick grading modal state
  const [quickGradeSubmission, setQuickGradeSubmission] = useState<GradingItem | null>(null);
  const [showQuickGrade, setShowQuickGrade] = useState(false);

  // Batch operations state
  const [selectedSubmissions, setSelectedSubmissions] = useState<Set<number>>(new Set());
  const [showBatchActions, setShowBatchActions] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Fetch courses once on mount when token is available
  useEffect(() => {
    if (token) {
      fetchCourses();
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchGradingData();
      fetchSummary();
    }
  }, [token, selectedCourse, selectedStatus, selectedType, selectedModule, selectedLesson, selectedStudent, currentPage]);
  
  // Fetch modules when course changes
  useEffect(() => {
    if (selectedCourse !== 'all') {
      fetchModules(parseInt(selectedCourse));
      fetchStudents(parseInt(selectedCourse));
      setStudentSearchQuery(''); // Reset student search when course changes
    } else {
      setModules([]);
      setLessons([]);
      setStudents([]);
      setSelectedModule('all');
      setSelectedLesson('all');
      setSelectedStudent('all');
      setStudentSearchQuery('');
    }
  }, [selectedCourse]);
  
  // Fetch lessons when module changes
  useEffect(() => {
    if (selectedModule !== 'all') {
      fetchLessons(parseInt(selectedModule));
    } else {
      setLessons([]);
      setSelectedLesson('all');
    }
  }, [selectedModule]);

  useEffect(() => {
    // Handle URL query params on initial load
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const course = searchParams.get('course_id');
    
    // Only update state if the URL param differs from current state
    if (status && ['pending', 'graded', 'all', 'resubmitted', 'modification_requested'].includes(status) && status !== selectedStatus) {
      setSelectedStatus(status as any);
    }
    if (type && ['all', 'assignment', 'project'].includes(type) && type !== selectedType) {
      setSelectedType(type as any);
    }
    if (course && course !== selectedCourse) {
      setSelectedCourse(course);
    }
  }, []); // Run only on mount to avoid infinite loops

  const fetchGradingData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // First fetch all data to calculate status counts
      const allFilters: SubmissionFilters = {
        status: 'all', // Get all data for counting
        page: 1,
        per_page: 200, // Get more items for accurate counting
        search_query: searchQuery || undefined,
        sort_by: 'priority',
        sort_order: 'desc'
      };

      if (selectedCourse !== 'all') {
        allFilters.course_id = parseInt(selectedCourse);
      }
      
      if (selectedModule !== 'all') {
        allFilters.module_id = parseInt(selectedModule);
      }
      
      if (selectedLesson !== 'all') {
        allFilters.lesson_id = parseInt(selectedLesson);
      }
      
      if (selectedStudent !== 'all') {
        allFilters.student_id = parseInt(selectedStudent);
      }

      const allItems: GradingItem[] = [];

      // Fetch assignments for counting
      if (selectedType === 'all' || selectedType === 'assignment') {
        try {
          console.log('Fetching assignment submissions with filters:', allFilters);
          const assignmentData = await GradingService.getAssignmentSubmissions(allFilters);
          console.log('Assignment data received:', assignmentData);
          console.log('Raw assignment submissions:', assignmentData.submissions);
          
          // Store analytics from the first response
          if (assignmentData.analytics) {
            setAnalytics(assignmentData.analytics);
          }
          
          const mappedAssignments = assignmentData.submissions.map(sub => {
            const mapped = {
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
              graded_at: sub.graded_at,
              is_resubmission: sub.is_resubmission,
              resubmission_count: sub.resubmission_count,
              submission_notes: sub.submission_notes,
              modification_requested: sub.modification_requested,
              modification_request_reason: sub.modification_request_reason,
              modification_requested_at: sub.modification_requested_at,
              modification_requested_by: sub.modification_requested_by,
              can_resubmit: sub.can_resubmit
            };
            console.log(`Mapping assignment ${sub.id}: is_resubmission=${sub.is_resubmission} -> ${mapped.is_resubmission}`);
            return mapped;
          });
          
          allItems.push(...mappedAssignments);
        } catch (err) {
          console.error('Failed to fetch assignment submissions:', err);
          // Still continue to show what we can
        }
      }

      // Fetch projects for counting
      if (selectedType === 'all' || selectedType === 'project') {
        try {
          console.log('Fetching project submissions with filters:', allFilters);
          const projectData = await GradingService.getProjectSubmissions(allFilters);
          console.log('Project data received:', projectData);
          allItems.push(...projectData.submissions.map(sub => ({
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
            graded_at: sub.graded_at,
            is_resubmission: sub.is_resubmission,
            resubmission_count: sub.resubmission_count,
            submission_notes: sub.submission_notes,
            modification_requested: sub.modification_requested,
            modification_request_reason: sub.modification_request_reason,
            modification_requested_at: sub.modification_requested_at,
            modification_requested_by: sub.modification_requested_by,
            can_resubmit: sub.can_resubmit
          })));
        } catch (err) {
          console.error('Failed to fetch project submissions:', err);
        }
      }

      // Calculate status counts from all data
      const counts = {
        pending: 0,
        resubmitted: 0,
        modification_requested: 0,
        graded: 0,
        overdue: 0
      };

      console.log('All items fetched:', allItems.length);
      console.log('Starting status counting...');
      
      allItems.forEach((item, index) => {
        console.log(`Processing item ${index + 1}:`, {
          id: item.id,
          title: item.title,
          grade: item.grade,
          is_resubmission: item.is_resubmission,
          modification_requested: item.modification_requested,
          days_late: item.days_late,
          type: typeof item.is_resubmission,
          resubmission_check: item.is_resubmission === true
        });

        // Priority order: resubmissions > modification_requested > graded > pending
        if (item.is_resubmission === true) {
          counts.resubmitted++;
          console.log(`  -> RESUBMITTED (total: ${counts.resubmitted})`);
        } else if (item.modification_requested === true) {
          counts.modification_requested++;
          console.log(`  -> MODIFICATION REQUESTED (total: ${counts.modification_requested})`);
        } else if (item.grade !== undefined && item.grade !== null) {
          counts.graded++;
          console.log(`  -> GRADED (total: ${counts.graded})`);
        } else {
          counts.pending++;
          console.log(`  -> PENDING (total: ${counts.pending})`);
        }
        
        if (item.days_late > 0) {
          counts.overdue++;
        }
      });

      console.log('All items fetched:', allItems.length, allItems);
      setStatusCounts(counts);
      console.log('Status counts:', counts);

      // Now filter items based on selected status for display
      let displayItems = allItems;
      
      if (selectedStatus !== 'all') {
        displayItems = allItems.filter(item => {
          switch (selectedStatus) {
            case 'resubmitted':
              return item.is_resubmission === true;
            case 'modification_requested':
              return item.modification_requested === true && !item.is_resubmission;
            case 'graded':
              return (item.grade !== undefined && item.grade !== null) && !item.is_resubmission && !item.modification_requested;
            case 'pending':
              return !item.grade && !item.is_resubmission && !item.modification_requested;
            default:
              return true;
          }
        });
      }

      // Enhanced sorting by priority
      displayItems.sort((a, b) => {
        // First priority: Resubmissions that need grading
        const aIsResubmission = a.is_resubmission && !a.grade;
        const bIsResubmission = b.is_resubmission && !b.grade;
        if (aIsResubmission && !bIsResubmission) return -1;
        if (!aIsResubmission && bIsResubmission) return 1;
        
        // Second priority: Assignments/Projects with modification requests but no new submission
        const aModificationRequested = a.modification_requested && !a.grade;
        const bModificationRequested = b.modification_requested && !b.grade;
        if (aModificationRequested && !bModificationRequested) return -1;
        if (!aModificationRequested && bModificationRequested) return 1;
        
        // Third priority: Ungraded submissions
        if (!a.grade && b.grade) return -1;
        if (a.grade && !b.grade) return 1;
        
        // Finally: Sort by submission date (newest first)
        return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
      });

      setGradingItems(displayItems);
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
      console.log('Fetching courses with token:', token ? 'present' : 'missing');
      const response = await fetch(`${API_BASE_URL}/instructor/courses`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      console.log('Courses response status:', response.status);
      if (response.ok) {
        const coursesData = await response.json();
        console.log('Courses fetched:', coursesData.length, ' courses');
        console.log('Courses data:', coursesData);
        setCourses(coursesData);
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        console.error('Failed to fetch courses:', response.status, errorData);
      }
    } catch (err) {
      console.error('Failed to fetch courses - error:', err);
    }
  };
  
  const fetchModules = async (courseId: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/courses/${courseId}/modules`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const modulesData = await response.json();
        setModules(modulesData);
      }
    } catch (err) {
      console.error('Failed to fetch modules:', err);
      setModules([]);
    }
  };
  
  const fetchLessons = async (moduleId: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/modules/${moduleId}/lessons`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const lessonsData = await response.json();
        setLessons(lessonsData);
      }
    } catch (err) {
      console.error('Failed to fetch lessons:', err);
      setLessons([]);
    }
  };
  
  const fetchStudents = async (courseId: number) => {
    try {
      console.log('Fetching students for course:', courseId);
      const response = await fetch(`${API_BASE_URL}/instructor/courses/${courseId}/enrollments`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      console.log('Students response status:', response.status);
      if (response.ok) {
        const enrollmentsData = await response.json();
        console.log('Enrollments data:', enrollmentsData);
        console.log('Number of students:', enrollmentsData.length);
        // enrollmentsData is already an array of enrollment objects
        // Each enrollment has: id, student_id, student_username, etc.
        setStudents(enrollmentsData);
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        console.error('Failed to fetch students:', response.status, errorData);
        setStudents([]);
      }
    } catch (err) {
      console.error('Failed to fetch students - error:', err);
      setStudents([]);
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
    // Always set the status parameter to maintain consistency
    params.set('status', selectedStatus);
    if (selectedType !== 'all') params.set('type', selectedType);
    if (selectedCourse !== 'all') params.set('course_id', selectedCourse);
    if (selectedModule !== 'all') params.set('module_id', selectedModule);
    if (selectedLesson !== 'all') params.set('lesson_id', selectedLesson);
    if (selectedStudent !== 'all') params.set('student_id', selectedStudent);
    
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
    
    // Resubmission - highest priority
    if (item.is_resubmission) {
      return <Repeat className="w-4 h-4 text-blue-600" />;
    }
    
    // Modification requested but no new submission
    if (item.modification_requested) {
      return <FileEdit className="w-4 h-4 text-purple-600" />;
    }
    
    // Overdue
    if (item.days_late > 0) {
      return <AlertTriangle className="w-4 h-4 text-red-600" />;
    }
    
    // Regular pending
    return <Clock className="w-4 h-4 text-orange-600" />;
  };

  const getStatusText = (item: GradingItem) => {
    if (item.grade !== undefined) {
      return `Graded on ${formatDate(item.graded_at!)}`;
    }
    
    // Resubmission - highest priority
    if (item.is_resubmission) {
      const submissionText = item.resubmission_count > 1 
        ? `Resubmission #${item.resubmission_count + 1}` 
        : 'Resubmission';
      return `${submissionText} - Needs review`;
    }
    
    // Modification requested but no new submission
    if (item.modification_requested && !item.is_resubmission) {
      const requestedDate = item.modification_requested_at 
        ? formatDate(item.modification_requested_at)
        : 'recently';
      return `Modification requested ${requestedDate} - Awaiting student resubmission`;
    }
    
    // Overdue
    if (item.days_late > 0) {
      return `${item.days_late} day${item.days_late > 1 ? 's' : ''} overdue`;
    }
    
    // Regular pending
    return 'Awaiting grade';
  };

  const getSubmissionBadges = (item: GradingItem) => {
    const badges = [];
    
    // Resubmission badge
    if (item.is_resubmission) {
      badges.push(
        <span key="resubmission" className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 flex items-center">
          <Repeat className="w-3 h-3 mr-1" />
          Resubmission {item.resubmission_count ? `#${item.resubmission_count + 1}` : ''}
        </span>
      );
    }
    
    // Modification request badge
    if (item.submission_status?.modification_requested) {
      badges.push(
        <span key="mod-request" className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400 flex items-center">
          <FileEdit className="w-3 h-3 mr-1" />
          Modification Requested
        </span>
      );
    }
    
    // Late badge
    if (item.days_late > 0) {
      badges.push(
        <span key="late" className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
          {item.days_late} day{item.days_late > 1 ? 's' : ''} late
        </span>
      );
    }
    
    return badges;
  };

  const handleQuickGrade = (item: GradingItem) => {
    setQuickGradeSubmission(item);
    setShowQuickGrade(true);
  };

  const handleNextSubmission = () => {
    if (!quickGradeSubmission) return;
    const currentIndex = gradingItems.findIndex(item => 
      item.id === quickGradeSubmission.id && item.type === quickGradeSubmission.type
    );
    if (currentIndex < gradingItems.length - 1) {
      setQuickGradeSubmission(gradingItems[currentIndex + 1]);
    }
  };

  const handlePreviousSubmission = () => {
    if (!quickGradeSubmission) return;
    const currentIndex = gradingItems.findIndex(item => 
      item.id === quickGradeSubmission.id && item.type === quickGradeSubmission.type
    );
    if (currentIndex > 0) {
      setQuickGradeSubmission(gradingItems[currentIndex - 1]);
    }
  };

  const hasNextSubmission = () => {
    if (!quickGradeSubmission) return false;
    const currentIndex = gradingItems.findIndex(item => 
      item.id === quickGradeSubmission.id && item.type === quickGradeSubmission.type
    );
    return currentIndex < gradingItems.length - 1;
  };

  const hasPreviousSubmission = () => {
    if (!quickGradeSubmission) return false;
    const currentIndex = gradingItems.findIndex(item => 
      item.id === quickGradeSubmission.id && item.type === quickGradeSubmission.type
    );
    return currentIndex > 0;
  };

  const handleGradingComplete = (submissionId: number) => {
    // Refresh the grading data
    fetchGradingData();
    fetchSummary();
  };

  const toggleSelectSubmission = (itemId: number, itemType: string) => {
    const key = `${itemType}-${itemId}`;
    setSelectedSubmissions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleExportGrades = async () => {
    if (selectedSubmissions.size === 0 && !selectedCourse) {
      alert('Please select submissions or a course to export');
      return;
    }

    setExporting(true);
    try {
      const result = await GradingService.exportGrades({
        type: selectedType as any,
        submission_ids: selectedSubmissions.size > 0 ? Array.from(selectedSubmissions) : undefined,
        course_id: selectedCourse !== 'all' ? parseInt(selectedCourse) : undefined
      });

      // Convert to CSV and download
      const csvContent = convertToCSV(result.data);
      downloadCSV(csvContent, `grades_export_${new Date().toISOString().split('T')[0]}.csv`);

      alert(`Exported ${result.count} submissions successfully`);
    } catch (error: any) {
      alert(error.message || 'Failed to export grades');
    } finally {
      setExporting(false);
    }
  };

  const convertToCSV = (data: any[]) => {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          return typeof value === 'string' && value.includes(',') 
            ? `"${value}"` 
            : value;
        }).join(',')
      )
    ];
    
    return csvRows.join('\n');
  };

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const clearAllFilters = () => {
    setSelectedCourse('all');
    setSelectedModule('all');
    setSelectedLesson('all');
    setSelectedStudent('all');
    setSelectedStatus('pending');
    setSelectedType('all');
    setSearchQuery('');
    setStudentSearchQuery('');
    setCurrentPage(1);
  };
  
  const getActiveFilterCount = () => {
    let count = 0;
    if (selectedCourse !== 'all') count++;
    if (selectedModule !== 'all') count++;
    if (selectedLesson !== 'all') count++;
    if (selectedStudent !== 'all') count++;
    if (selectedStatus !== 'pending') count++; // pending is default
    if (selectedType !== 'all') count++;
    if (searchQuery) count++;
    return count;
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
            Review assignments, projects, resubmissions, and modification requests
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
              <div className="flex items-center space-x-2">
                <RefreshCw className="w-4 h-4" />
                <span>Refresh</span>
              </div>
            )}
          </button>
          {selectedSubmissions.size > 0 && (
            <button
              onClick={handleExportGrades}
              disabled={exporting}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4 inline mr-2" />
              {exporting ? 'Exporting...' : `Export ${selectedSubmissions.size} Selected`}
            </button>
          )}
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

      {/* Priority Alerts */}
      {(statusCounts.resubmitted > 0 || statusCounts.overdue > 0) && (
        <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/10 dark:to-red-900/10 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-orange-800 dark:text-orange-300">
                Action Required
              </h3>
              <div className="mt-1 text-sm text-orange-700 dark:text-orange-400">
                {statusCounts.resubmitted > 0 && (
                  <p>
                    <span className="font-medium">{statusCounts.resubmitted}</span> resubmission{statusCounts.resubmitted > 1 ? 's' : ''} need{statusCounts.resubmitted === 1 ? 's' : ''} immediate review.
                  </p>
                )}
                {statusCounts.overdue > 0 && (
                  <p>
                    <span className="font-medium">{statusCounts.overdue}</span> submission{statusCounts.overdue > 1 ? 's are' : ' is'} overdue.
                  </p>
                )}
              </div>
              <div className="mt-3 flex space-x-2">
                {statusCounts.resubmitted > 0 && (
                  <button
                    onClick={() => {
                      setSelectedStatus('resubmitted');
                      updateURL();
                    }}
                    className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors"
                  >
                    Review Resubmissions
                  </button>
                )}
                {statusCounts.modification_requested > 0 && (
                  <button
                    onClick={() => {
                      setSelectedStatus('modification_requested');
                      updateURL();
                    }}
                    className="text-xs bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700 transition-colors"
                  >
                    Check Modification Requests
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Resubmissions - Highest Priority */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Resubmissions</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                  {statusCounts.resubmitted}
                </p>
                <p className="text-xs text-slate-500 mt-1">Need immediate review</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                <Repeat className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          {/* Modification Requested */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Modifications Requested</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                  {statusCounts.modification_requested}
                </p>
                <p className="text-xs text-slate-500 mt-1">Awaiting student action</p>
              </div>
              <div className="h-12 w-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                <FileEdit className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>

          {/* Regular Pending */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 border-l-4 border-orange-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Pending Review</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                  {statusCounts.pending}
                </p>
                <p className="text-xs text-slate-500 mt-1">Initial submissions</p>
              </div>
              <div className="h-12 w-12 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </div>

          {/* Overdue Items */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Overdue</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                  {statusCounts.overdue}
                </p>
                <p className="text-xs text-slate-500 mt-1">Past due date</p>
              </div>
              <div className="h-12 w-12 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </div>

          {/* Graded */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Graded</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                  {statusCounts.graded}
                </p>
                <p className="text-xs text-slate-500 mt-1">Complete</p>
              </div>
              <div className="h-12 w-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
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
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Filters</h2>
            {getActiveFilterCount() > 0 && (
              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-xs font-medium rounded-full">
                {getActiveFilterCount()} active
              </span>
            )}
          </div>
          {getActiveFilterCount() > 0 && (
            <button
              onClick={clearAllFilters}
              className="px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              Clear All Filters
            </button>
          )}
        </div>
        
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
                console.log('Course changed to:', e.target.value);
                setSelectedCourse(e.target.value); 
                setCurrentPage(1);
              }}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Courses</option>
              {courses && courses.length > 0 ? (
                courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))
              ) : (
                <option disabled>Loading courses...</option>
              )}
            </select>
          </div>

          {/* Enhanced Status Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Submission Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => { 
                setSelectedStatus(e.target.value as any); 
                setCurrentPage(1);
              }}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="resubmitted">
                🔄 Resubmitted ({statusCounts.resubmitted})
              </option>
              <option value="modification_requested">
                ✏️ Modification Requested ({statusCounts.modification_requested})
              </option>
              <option value="pending">
                ⏳ Pending Review ({statusCounts.pending})
              </option>
              <option value="graded">
                ✅ Graded ({statusCounts.graded})
              </option>
              <option value="all">All Submissions</option>
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
              }}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="assignment">Assignments</option>
              <option value="project">Projects</option>
            </select>
          </div>
        </div>
        
        {/* Additional Filters Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {/* Module Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Module
            </label>
            <select
              value={selectedModule}
              onChange={(e) => { 
                setSelectedModule(e.target.value); 
                setCurrentPage(1);
              }}
              disabled={selectedCourse === 'all'}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="all">All Modules</option>
              {modules.map((module) => (
                <option key={module.id} value={module.id}>
                  {module.title}
                </option>
              ))}
            </select>
          </div>
          
          {/* Lesson Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Lesson
            </label>
            <select
              value={selectedLesson}
              onChange={(e) => { 
                setSelectedLesson(e.target.value); 
                setCurrentPage(1);
              }}
              disabled={selectedModule === 'all'}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="all">All Lessons</option>
              {lessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.title}
                </option>
              ))}
            </select>
          </div>
          
          {/* Student Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Student
            </label>
            <div className="space-y-2">
              {/* Student Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  disabled={selectedCourse === 'all'}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              
              {/* Student Dropdown */}
              <select
                value={selectedStudent}
                onChange={(e) => { 
                  console.log('Student changed to:', e.target.value);
                  setSelectedStudent(e.target.value); 
                  setCurrentPage(1);
                }}
                disabled={selectedCourse === 'all'}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="all">All Students {students.length > 0 ? `(${students.length})` : ''}</option>
                {students.length === 0 && selectedCourse !== 'all' ? (
                  <option disabled>No students enrolled</option>
                ) : (
                  students
                    .filter((enrollment) => {
                      if (!studentSearchQuery) return true;
                      const username = (enrollment.student_username || '').toLowerCase();
                      const fullName = (enrollment.student?.full_name || '').toLowerCase();
                      const searchLower = studentSearchQuery.toLowerCase();
                      return username.includes(searchLower) || fullName.includes(searchLower);
                    })
                    .map((enrollment) => {
                      const displayName = enrollment.student?.full_name || enrollment.student_username || `Student ${enrollment.student_id}`;
                      return (
                        <option key={enrollment.student_id} value={enrollment.student_id}>
                          {displayName}
                        </option>
                      );
                    })
                )}
              </select>
              
              {/* Show count of filtered results */}
              {studentSearchQuery && students.length > 0 && (() => {
                const filteredCount = students.filter((enrollment) => {
                  const username = (enrollment.student_username || '').toLowerCase();
                  const fullName = (enrollment.student?.full_name || '').toLowerCase();
                  const searchLower = studentSearchQuery.toLowerCase();
                  return username.includes(searchLower) || fullName.includes(searchLower);
                }).length;
                return (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {filteredCount} student(s) found
                  </p>
                );
              })()}
              
              {/* Debug info */}
              {selectedCourse !== 'all' && students.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  ⚠️ No students enrolled in this course
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Submissions List */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Submissions ({gradingItems.length})
          </h2>
          {selectedStatus !== 'all' && (
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Showing {selectedStatus.replace('_', ' ')} submissions
            </p>
          )}
        </div>

        {gradingItems.length === 0 ? (
          <div className="p-6 text-center">
            <div className="mx-auto h-12 w-12 text-slate-400 mb-4">
              {selectedStatus === 'resubmitted' && <Repeat className="w-full h-full" />}
              {selectedStatus === 'modification_requested' && <FileEdit className="w-full h-full" />}
              {selectedStatus === 'pending' && <Clock className="w-full h-full" />}
              {selectedStatus === 'graded' && <CheckCircle className="w-full h-full" />}
              {selectedStatus === 'all' && <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>}
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-2">
              {selectedStatus === 'resubmitted' && 'No resubmitted work to review'}
              {selectedStatus === 'modification_requested' && 'No modification requests pending'}
              {selectedStatus === 'pending' && 'No pending submissions'}
              {selectedStatus === 'graded' && 'No graded submissions'}
              {selectedStatus === 'all' && 'No submissions found'}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-500">
              {selectedStatus === 'resubmitted' && 'Students haven\'t resubmitted any work yet'}
              {selectedStatus === 'modification_requested' && 'No assignments are waiting for student modifications'}
              {selectedStatus === 'pending' && 'All caught up! No submissions need grading'}
              {selectedStatus === 'graded' && 'No submissions have been graded yet'}
              {selectedStatus === 'all' && 'Try adjusting your filters or check back later'}
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {gradingItems.map((item) => (
                <div key={`${item.type}-${item.id}`} className="p-6 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      {/* Checkbox for batch selection */}
                      <input
                        type="checkbox"
                        checked={selectedSubmissions.has(item.id)}
                        onChange={() => toggleSelectSubmission(item.id, item.type)}
                        className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      />
                      <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          item.type === 'assignment'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                            : 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
                        }`}>
                          {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                        </span>
                        
                        {/* Status badges */}
                        {getSubmissionBadges(item).map(badge => badge)}
                        
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(item)}
                          <span className="text-xs text-slate-600 dark:text-slate-400">
                            {getStatusText(item)}
                          </span>
                        </div>
                      </div>

                      <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                        {item.title}
                      </h3>
                      
                      {/* Show modification request reason if applicable */}
                      {item.modification_requested && item.modification_request_reason && (
                        <div className="mb-3 p-3 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-lg">
                          <h4 className="text-sm font-medium text-purple-800 dark:text-purple-300 mb-1">
                            Modification Request:
                          </h4>
                          <p className="text-sm text-purple-700 dark:text-purple-400">
                            {item.modification_request_reason}
                          </p>
                        </div>
                      )}
                      
                      {/* Show resubmission notes if applicable */}
                      {item.is_resubmission && item.submission_notes && (
                        <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
                          <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">
                            Student Notes:
                          </h4>
                          <p className="text-sm text-blue-700 dark:text-blue-400">
                            {item.submission_notes}
                          </p>
                        </div>
                      )}

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
                    </div>

                    <div className="flex space-x-2 ml-4">
                      {/* Quick Grade Button */}
                      <button
                        onClick={() => handleQuickGrade(item)}
                        className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all shadow-md text-sm font-medium"
                      >
                        <Zap className="w-4 h-4" />
                        <span>Quick Grade</span>
                      </button>
                      
                      {/* Detailed Review Link */}
                      <Link
                        href={`/instructor/grading/${item.type}/${item.id}`}
                        className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium border-2 ${
                          item.is_resubmission 
                            ? 'border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20' 
                            : item.grade !== undefined 
                            ? 'border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                            : 'border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                        }`}
                      >
                        {item.is_resubmission 
                          ? 'Full Review' 
                          : item.grade !== undefined 
                          ? 'View Details' 
                          : 'Detailed Grade'
                        }
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

      {/* Quick Grading Modal */}
      {showQuickGrade && quickGradeSubmission && (
        <QuickGradingModal
          submission={quickGradeSubmission}
          isOpen={showQuickGrade}
          onClose={() => setShowQuickGrade(false)}
          onGraded={handleGradingComplete}
          onNext={handleNextSubmission}
          onPrevious={handlePreviousSubmission}
          hasNext={hasNextSubmission()}
          hasPrevious={hasPreviousSubmission()}
        />
      )}
    </div>
  );
};

export default ImprovedGradingPage;
