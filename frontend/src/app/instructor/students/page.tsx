"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import InstructorService from '@/services/instructor.service';
import StudentActivityAnalysis from '@/components/instructor/StudentActivityAnalysis';
import StudentPerformanceAnalytics from '@/components/instructor/StudentPerformanceAnalytics';
import { User, Course } from '@/types/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Users, Activity, UserCheck, Search, BarChart3, TrendingUp } from 'lucide-react';

interface StudentWithCourse extends User {
  course_title?: string;
  enrollment_date?: string;
  progress?: number;
  last_accessed?: string;
  enrollment_id?: number;
  course_id?: number;
  average_score?: number;
  recent_activity?: number;
  status?: 'excellent' | 'good' | 'average' | 'struggling' | 'inactive';
  modules_completed?: number;
  total_modules?: number;
  // Cohort separation
  cohort_label?: string | null;
  cohort_start_date?: string | null;
  cohort_end_date?: string | null;
  application_window_id?: number | null;
}

interface CohortInfo {
  id: number | null;
  cohort_label: string | null;
  status: string;
  student_count: number;
}

const StudentsPage = () => {
  const { token } = useAuth();
  const [students, setStudents] = useState<StudentWithCourse[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [selectedCohort, setSelectedCohort] = useState<string>('all');
  const [cohorts, setCohorts] = useState<CohortInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isClient, setIsClient] = useState(false);
  const [unenrolling, setUnenrolling] = useState<number | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState('overview');
  const [showConfirmDialog, setShowConfirmDialog] = useState<{ show: boolean; student: StudentWithCourse | null }>({ show: false, student: null });

  // Handle client-side hydration
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!token) return;
      
      setLoading(true);
      setError(null);
      try {
        const [studentsData, coursesData] = await Promise.all([
          InstructorService.getMyStudents(),
          InstructorService.getMyCourses()
        ]);
        
        // Ensure data is always an array and enhance with performance indicators
        const enhancedStudentsData = Array.isArray(studentsData) ? studentsData.map(student => ({
          ...student,
          // Add some sample performance data (in real app, this would come from backend)
          average_score: Math.random() * 40 + 60, // Random score between 60-100
          recent_activity: Math.floor(Math.random() * 7), // Days since last activity
          status: (() => {
            const score = Math.random() * 40 + 60;
            const activity = Math.floor(Math.random() * 7);
            if (score >= 90 && activity <= 1) return 'excellent';
            if (score >= 80 && activity <= 2) return 'good';
            if (score >= 70) return 'average';
            if (activity > 5) return 'inactive';
            return 'struggling';
          })(),
          modules_completed: Math.floor(Math.random() * 8) + 1,
          total_modules: 10
        })) : [];
        
        setStudents(enhancedStudentsData);
        setCourses(Array.isArray(coursesData) ? coursesData : []);
      } catch (err: any) {
        console.error('Students fetch error:', err);
        setError(err.message || 'Failed to load students');
        setStudents([]); // Set empty arrays on error
        setCourses([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  const filteredStudents = Array.isArray(students) ? students.filter(student => {
    const matchesSearch = searchTerm === '' || 
      `${student.first_name} ${student.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCourse = selectedCourse === 'all' || student.course_title === selectedCourse;
    const matchesCohort = selectedCohort === 'all' || (student.cohort_label || '') === selectedCohort;
    
    return matchesSearch && matchesCourse && matchesCohort;
  }) : [];

  // Load cohorts when course selection changes
  useEffect(() => {
    const loadCohorts = async () => {
      if (selectedCourse === 'all') {
        // Collect unique cohort labels from all students
        const labels = new Set(students.map(s => s.cohort_label).filter(Boolean));
        setCohorts(Array.from(labels).map(label => ({
          id: null,
          cohort_label: label!,
          status: 'unknown',
          student_count: students.filter(s => s.cohort_label === label).length,
        })));
        return;
      }
      const matchingCourse = courses.find(c => c.title === selectedCourse);
      if (!matchingCourse) {
        setCohorts([]);
        return;
      }
      try {
        const cohortData = await InstructorService.getCourseCohorts(matchingCourse.id);
        setCohorts(Array.isArray(cohortData) ? cohortData : []);
      } catch {
        setCohorts([]);
      }
    };
    loadCohorts();
    setSelectedCohort('all');
  }, [selectedCourse, courses, students]);

  const handleUnenrollClick = (student: StudentWithCourse) => {
    setShowConfirmDialog({ show: true, student });
  };

  const handleUnenrollConfirm = async () => {
    const student = showConfirmDialog.student;
    if (!student || !student.enrollment_id) {
      setError('Cannot unenroll: Missing enrollment information');
      setShowConfirmDialog({ show: false, student: null });
      return;
    }

    setUnenrolling(student.enrollment_id);
    try {
      const result = await InstructorService.unenrollStudent(student.enrollment_id);
      
      // Remove student from local state
      setStudents(prevStudents => 
        prevStudents.filter(s => s.enrollment_id !== student.enrollment_id)
      );
      
      // Show success message (you can use a toast notification library here)
      console.log(result.message);
      
    } catch (err: any) {
      console.error('Unenroll error:', err);
      setError(err.message || 'Failed to unenroll student');
      setTimeout(() => setError(null), 5000);
    } finally {
      setUnenrolling(null);
      setShowConfirmDialog({ show: false, student: null });
    }
  };

  const handleUnenrollCancel = () => {
    setShowConfirmDialog({ show: false, student: null });
  };

  const handleActivityAnalysisAction = (action: string, data?: any) => {
    // Handle actions from activity analysis component
    if (action === 'terminate') {
      // Refresh the main students list
      const fetchData = async () => {
        try {
          const studentsData = await InstructorService.getMyStudents();
          setStudents(Array.isArray(studentsData) ? studentsData : []);
        } catch (err: any) {
          console.error('Students refetch error:', err);
        }
      };
      fetchData();
    }
  };

  // Prevent hydration mismatch
  if (!isClient || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-sky-500"></div>
        <span className="ml-3 text-slate-600 dark:text-slate-300">Loading students...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-6 rounded-lg text-center my-10">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-4 px-4 py-2 bg-red-100 dark:bg-red-800/30 text-red-700 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-800/50"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Student Management</h1>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Total: {Array.isArray(filteredStudents) ? filteredStudents.length : 0} students
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 lg:w-[500px]">
          <TabsTrigger value="overview" className="flex items-center space-x-2">
            <Users className="w-4 h-4" />
            <span>Overview</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center space-x-2">
            <BarChart3 className="w-4 h-4" />
            <span>Performance</span>
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center space-x-2">
            <Activity className="w-4 h-4" />
            <span>Activity</span>
          </TabsTrigger>
          <TabsTrigger value="management" className="flex items-center space-x-2">
            <UserCheck className="w-4 h-4" />
            <span>Management</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Student List - existing content */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label htmlFor="search" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  <Search className="w-4 h-4 inline mr-1" />
                  Search Students
                </label>
                <input
                  type="text"
                  id="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, username, or email..."
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="course-filter" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Filter by Course
                </label>
                <select
                  id="course-filter"
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                >
                  <option value="all">All Courses</option>
                  {Array.isArray(courses) && courses.map((course) => (
                    <option key={course.id} value={course.title}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="cohort-filter" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Filter by Cohort
                </label>
                <select
                  id="cohort-filter"
                  value={selectedCohort}
                  onChange={(e) => setSelectedCohort(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                >
                  <option value="all">All Cohorts</option>
                  {cohorts.map((cohort, idx) => (
                    <option key={cohort.id ?? `cohort-${idx}`} value={cohort.cohort_label || ''}>
                      {cohort.cohort_label || 'No cohort'} ({cohort.student_count} students)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Students List */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            {!Array.isArray(filteredStudents) || filteredStudents.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-slate-500 dark:text-slate-400">
                  {!Array.isArray(students) || students.length === 0 ? 'No students enrolled in your courses yet.' : 'No students match your search criteria.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                  <thead className="bg-slate-50 dark:bg-slate-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Student
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Course
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Cohort
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Enrolled
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Progress
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Performance
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Last Accessed
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                {Array.isArray(filteredStudents) && filteredStudents.map((student) => (
                  <tr key={`${student.id}-${student.enrollment_id || student.course_id}`} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center">
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                              {student.first_name?.[0] || student.username[0]}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-slate-900 dark:text-white">
                            {student.first_name && student.last_name 
                              ? `${student.first_name} ${student.last_name}`
                              : student.username
                            }
                          </div>
                          <div className="text-sm text-slate-500 dark:text-slate-400">
                            {student.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900 dark:text-white">
                        {student.course_title || 'Unknown Course'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {student.cohort_label ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                          {student.cohort_label}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {student.enrollment_date 
                          ? new Date(student.enrollment_date).toLocaleDateString()
                          : 'Unknown'
                        }
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-1 bg-slate-200 dark:bg-slate-600 rounded-full h-2 mr-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${student.progress || 0}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {student.progress || 0}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {student.average_score ? (
                          <>
                            <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs ${
                              student.average_score >= 90 ? 'bg-green-100 text-green-800' :
                              student.average_score >= 80 ? 'bg-blue-100 text-blue-800' :
                              student.average_score >= 70 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              <TrendingUp className="w-3 h-3" />
                              <span>{student.average_score?.toFixed(1)}%</span>
                            </div>
                          </>
                        ) : (
                          <span className="text-sm text-slate-400">No data</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {student.last_accessed 
                          ? new Date(student.last_accessed).toLocaleDateString()
                          : 'Never'
                        }
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 mr-3">
                        View Details
                      </button>
                      <button className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 mr-3">
                        Message
                      </button>
                      <button 
                        onClick={() => handleUnenrollClick(student)}
                        disabled={unenrolling === student.enrollment_id}
                        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {unenrolling === student.enrollment_id ? 'Unenrolling...' : 'Unenroll'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <StudentPerformanceAnalytics onActionRequired={handleActivityAnalysisAction} />
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <StudentActivityAnalysis />
        </TabsContent>

        <TabsContent value="management" className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Student Management Tools
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Advanced management features will be available here, including bulk operations, detailed analytics, and administrative actions.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 border border-slate-200 dark:border-slate-600 rounded-lg">
                <h4 className="font-medium text-slate-900 dark:text-white mb-2">Bulk Actions</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">Send messages, assign grades, or manage enrollments for multiple students.</p>
              </div>
              <div className="p-4 border border-slate-200 dark:border-slate-600 rounded-lg">
                <h4 className="font-medium text-slate-900 dark:text-white mb-2">Export Data</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">Export student data, grades, and progress reports.</p>
              </div>
              <div className="p-4 border border-slate-200 dark:border-slate-600 rounded-lg">
                <h4 className="font-medium text-slate-900 dark:text-white mb-2">Advanced Analytics</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">Detailed insights into student performance and engagement.</p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      {showConfirmDialog.show && showConfirmDialog.student && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Confirm Unenrollment
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Are you sure you want to unenroll <strong>{showConfirmDialog.student.first_name} {showConfirmDialog.student.last_name}</strong> from <strong>{showConfirmDialog.student.course_title}</strong>?
              <br /><br />
              <span className="text-red-600 dark:text-red-400">This action cannot be undone and will remove all their progress in this course.</span>
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleUnenrollCancel}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleUnenrollConfirm}
                disabled={unenrolling !== null}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {unenrolling !== null ? 'Unenrolling...' : 'Yes, Unenroll'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentsPage;