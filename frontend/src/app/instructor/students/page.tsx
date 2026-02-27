"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams, useRouter } from 'next/navigation';
import InstructorService from '@/services/instructor.service';
import StudentActivityAnalysis from '@/components/instructor/StudentActivityAnalysis';
import StudentPerformanceAnalytics from '@/components/instructor/StudentPerformanceAnalytics';
import { User, Course } from '@/types/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users, Activity, UserCheck, Search, BarChart3, TrendingUp,
  GraduationCap, ChevronRight, ArrowLeft, Calendar, User as UserIcon,
  BookOpen, CheckCircle, Clock, Mail, Hash
} from 'lucide-react';

// ═══════════════════════════════════════
// Types
// ═══════════════════════════════════════

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
  cohort_label?: string | null;
  cohort_start_date?: string | null;
  cohort_end_date?: string | null;
  application_window_id?: number | null;
}

interface CohortInfo {
  id: number | null;
  cohort_label: string | null;
  status: string;
  computed_status?: string;
  student_count: number;
  cohort_start?: string;
  cohort_end?: string;
  max_students?: number;
}

type WizardStep = 'courses' | 'cohorts' | 'students';

// ═══════════════════════════════════════
// Main Component
// ═══════════════════════════════════════

const StudentsPage = () => {
  const { token } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Wizard state
  const [step, setStep] = useState<WizardStep>('courses');
  const [courses, setCourses] = useState<Course[]>([]);
  const [cohorts, setCohorts] = useState<CohortInfo[]>([]);
  const [students, setStudents] = useState<StudentWithCourse[]>([]);

  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [selectedCourseData, setSelectedCourseData] = useState<Course | null>(null);
  const [selectedCohortId, setSelectedCohortId] = useState<number | null>(null);
  const [selectedCohortData, setSelectedCohortData] = useState<CohortInfo | null>(null);

  // Loading states
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [cohortsLoading, setCohortsLoading] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Student view state
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [unenrolling, setUnenrolling] = useState<number | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState<{ show: boolean; student: StudentWithCourse | null }>({ show: false, student: null });

  // ══════════════════════════════════════
  // DATA FETCHING
  // ══════════════════════════════════════

  // Step 1: Fetch courses on mount
  useEffect(() => {
    if (!token) return;
    const fetchCourses = async () => {
      setCoursesLoading(true);
      try {
        const data = await InstructorService.getMyCourses();
        setCourses(Array.isArray(data) ? data : []);
      } catch (err: any) {
        setError(err.message || 'Failed to load courses');
      } finally {
        setCoursesLoading(false);
      }
    };
    fetchCourses();

    // Restore step from URL params
    const courseParam = searchParams.get('course_id');
    const cohortParam = searchParams.get('cohort_id');
    if (courseParam) {
      const cId = parseInt(courseParam);
      setSelectedCourseId(cId);
      if (cohortParam) {
        setSelectedCohortId(parseInt(cohortParam));
        setStep('students');
      } else {
        setStep('cohorts');
      }
    }
  }, [token]);

  // Step 2: Fetch cohorts when course selected
  useEffect(() => {
    if (selectedCourseId && step === 'cohorts') {
      const course = courses.find(c => c.id === selectedCourseId);
      if (course) setSelectedCourseData(course);
      fetchCohorts(selectedCourseId);
    }
  }, [selectedCourseId, step, courses]);

  // Step 3: Fetch students when cohort selected
  useEffect(() => {
    if (selectedCourseId && selectedCohortId && step === 'students') {
      fetchStudents(selectedCourseId, selectedCohortId);
    }
  }, [selectedCourseId, selectedCohortId, step]);

  const fetchCohorts = async (courseId: number) => {
    setCohortsLoading(true);
    try {
      const data = await InstructorService.getCourseCohorts(courseId);
      setCohorts(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to fetch cohorts:', err);
      setCohorts([]);
    } finally {
      setCohortsLoading(false);
    }
  };

  const fetchStudents = async (courseId: number, cohortId: number) => {
    setStudentsLoading(true);
    try {
      const data = await InstructorService.getMyStudents(courseId, cohortId);
      setStudents(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to fetch students:', err);
      setStudents([]);
    } finally {
      setStudentsLoading(false);
    }
  };

  // ══════════════════════════════════════
  // STEP NAVIGATION
  // ══════════════════════════════════════

  const selectCourse = (course: Course) => {
    setSelectedCourseId(course.id);
    setSelectedCourseData(course);
    setSelectedCohortId(null);
    setSelectedCohortData(null);
    setCohorts([]);
    setStudents([]);
    setStep('cohorts');
    router.push(`/instructor/students?course_id=${course.id}`, { scroll: false });
  };

  const selectCohort = (cohort: CohortInfo) => {
    setSelectedCohortId(cohort.id);
    setSelectedCohortData(cohort);
    setStudents([]);
    setSearchTerm('');
    setActiveTab('overview');
    setStep('students');
    router.push(`/instructor/students?course_id=${selectedCourseId}&cohort_id=${cohort.id}`, { scroll: false });
  };

  const goBackToCourses = () => {
    setSelectedCourseId(null);
    setSelectedCourseData(null);
    setSelectedCohortId(null);
    setSelectedCohortData(null);
    setCohorts([]);
    setStudents([]);
    setStep('courses');
    router.push('/instructor/students', { scroll: false });
  };

  const goBackToCohorts = () => {
    setSelectedCohortId(null);
    setSelectedCohortData(null);
    setStudents([]);
    setStep('cohorts');
    router.push(`/instructor/students?course_id=${selectedCourseId}`, { scroll: false });
  };

  // ══════════════════════════════════════
  // STUDENT ACTIONS
  // ══════════════════════════════════════

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
      await InstructorService.unenrollStudent(student.enrollment_id);
      setStudents(prev => prev.filter(s => s.enrollment_id !== student.enrollment_id));
    } catch (err: any) {
      setError(err.message || 'Failed to unenroll student');
      setTimeout(() => setError(null), 5000);
    } finally {
      setUnenrolling(null);
      setShowConfirmDialog({ show: false, student: null });
    }
  };

  const handleActivityAnalysisAction = (action: string, data?: any) => {
    if (action === 'terminate' && selectedCourseId && selectedCohortId) {
      fetchStudents(selectedCourseId, selectedCohortId);
    }
  };

  // ══════════════════════════════════════
  // FILTERED DATA
  // ══════════════════════════════════════

  const filteredStudents = students.filter(student => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      `${student.first_name} ${student.last_name}`.toLowerCase().includes(term) ||
      student.username?.toLowerCase().includes(term) ||
      student.email?.toLowerCase().includes(term)
    );
  });

  // ══════════════════════════════════════
  // BREADCRUMB
  // ══════════════════════════════════════

  const renderBreadcrumb = () => (
    <nav className="flex items-center space-x-2 text-sm text-slate-500 dark:text-slate-400 mb-6">
      <button
        onClick={goBackToCourses}
        className={`hover:text-blue-600 dark:hover:text-blue-400 transition-colors ${step === 'courses' ? 'text-blue-600 dark:text-blue-400 font-semibold' : ''}`}
      >
        Student Management
      </button>
      {(step === 'cohorts' || step === 'students') && (
        <>
          <ChevronRight className="w-4 h-4 flex-shrink-0" />
          <button
            onClick={step === 'students' ? goBackToCohorts : undefined}
            className={`hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate max-w-[200px] ${step === 'cohorts' ? 'text-blue-600 dark:text-blue-400 font-semibold' : ''}`}
          >
            {selectedCourseData?.title || 'Course'}
          </button>
        </>
      )}
      {step === 'students' && (
        <>
          <ChevronRight className="w-4 h-4 flex-shrink-0" />
          <span className="text-blue-600 dark:text-blue-400 font-semibold truncate max-w-[200px]">
            {selectedCohortData?.cohort_label || 'Cohort'}
          </span>
        </>
      )}
    </nav>
  );

  // ══════════════════════════════════════
  // STEP 1 — COURSE SELECTION
  // ══════════════════════════════════════

  const renderCourseSelection = () => {
    if (coursesLoading) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500" />
          <span className="ml-3 text-slate-600 dark:text-slate-300">Loading courses...</span>
        </div>
      );
    }

    return (
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Student Management</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">Select a course to view enrolled students</p>
        </div>

        {courses.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-12 text-center">
            <BookOpen className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">No courses found</h3>
            <p className="text-slate-500 dark:text-slate-400">You don&apos;t have any courses assigned yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <button
                key={course.id}
                onClick={() => selectCourse(course)}
                className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 text-left hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                    <GraduationCap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {course.title}
                </h3>
                {course.description && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">{course.description}</p>
                )}
                <div className="flex items-center text-xs text-slate-400 dark:text-slate-500 space-x-3">
                  {course.is_published ? (
                    <span className="flex items-center text-green-600 dark:text-green-400"><CheckCircle className="w-3 h-3 mr-1" /> Published</span>
                  ) : (
                    <span className="flex items-center text-amber-600 dark:text-amber-400"><Clock className="w-3 h-3 mr-1" /> Draft</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ══════════════════════════════════════
  // STEP 2 — COHORT SELECTION
  // ══════════════════════════════════════

  const renderCohortSelection = () => {
    if (cohortsLoading) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500" />
          <span className="ml-3 text-slate-600 dark:text-slate-300">Loading cohorts...</span>
        </div>
      );
    }

    const statusColors: Record<string, string> = {
      open: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      closed: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
      upcoming: 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
      unknown: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
    };

    return (
      <div>
        <div className="mb-8">
          <button
            onClick={goBackToCourses}
            className="flex items-center text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Courses
          </button>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{selectedCourseData?.title || 'Course'}</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">Select a cohort to view its students</p>
        </div>

        {cohorts.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-12 text-center">
            <Users className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">No cohorts found</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4">This course doesn&apos;t have any cohorts configured yet.</p>
            <p className="text-sm text-slate-400 dark:text-slate-500">Set up application windows in course settings to create cohorts.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cohorts.map((cohort, idx) => {
              const label = cohort.cohort_label || 'Unlabelled Cohort';
              const studentCount = cohort.student_count || 0;
              const status = cohort.status || cohort.computed_status || 'unknown';

              return (
                <button
                  key={cohort.id || `cohort-${idx}`}
                  onClick={() => cohort.id !== null && selectCohort(cohort)}
                  disabled={cohort.id === null}
                  className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 text-left hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-600 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="h-12 w-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900/50 transition-colors">
                      <Users className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[status] || statusColors.unknown}`}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                  </div>

                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {label}
                  </h3>

                  <div className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
                    <div className="flex items-center">
                      <UserIcon className="w-4 h-4 mr-2" />
                      <span>{studentCount} student{studentCount !== 1 ? 's' : ''} enrolled</span>
                    </div>
                    {cohort.cohort_start && (
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-2" />
                        <span>
                          {new Date(cohort.cohort_start).toLocaleDateString()}
                          {cohort.cohort_end && ` – ${new Date(cohort.cohort_end).toLocaleDateString()}`}
                        </span>
                      </div>
                    )}
                    {cohort.max_students && (
                      <div className="flex items-center">
                        <BarChart3 className="w-4 h-4 mr-2" />
                        <span>{studentCount}/{cohort.max_students} capacity</span>
                      </div>
                    )}
                  </div>

                  {cohort.id !== null && (
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end">
                      <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium group-hover:underline flex items-center">
                        View Students <ChevronRight className="w-3 h-3 ml-1" />
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ══════════════════════════════════════
  // STEP 3 — STUDENTS DASHBOARD
  // ══════════════════════════════════════

  const renderStudentsDashboard = () => (
    <div>
      {/* Back nav + header */}
      <div className="mb-6">
        <button
          onClick={goBackToCohorts}
          className="flex items-center text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Cohorts
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              {selectedCohortData?.cohort_label || 'Cohort'}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              {selectedCourseData?.title || 'Course'} — {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 border-l-4 border-blue-500">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Students</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-0.5">{students.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 border-l-4 border-green-500">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Avg Progress</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-0.5">
            {students.length > 0 ? Math.round(students.reduce((sum, s) => sum + (s.progress || 0), 0) / students.length) : 0}%
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 border-l-4 border-purple-500">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Active Recently</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-0.5">
            {students.filter(s => {
              if (!s.last_accessed) return false;
              const diff = Date.now() - new Date(s.last_accessed).getTime();
              return diff < 7 * 24 * 60 * 60 * 1000;
            }).length}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 border-l-4 border-orange-500">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Completed</p>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-0.5">
            {students.filter(s => (s.progress || 0) >= 100).length}
          </p>
        </div>
      </div>

      {studentsLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500" />
          <span className="ml-3 text-slate-600 dark:text-slate-300">Loading students...</span>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 lg:w-[400px] mb-6">
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
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Search */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search students by name, username, or email..."
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white text-sm"
                />
              </div>
            </div>

            {/* Students Table */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              {filteredStudents.length === 0 ? (
                <div className="p-8 text-center">
                  <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-500 dark:text-slate-400">
                    {students.length === 0 ? 'No students enrolled in this cohort yet.' : 'No students match your search.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-900">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Student</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Enrolled</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Progress</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Performance</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Last Active</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                      {filteredStudents.map((student) => (
                        <tr key={`${student.id}-${student.enrollment_id || student.course_id}`} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                                <span className="text-sm font-bold text-white">
                                  {(student.first_name?.[0] || student.username?.[0] || '?').toUpperCase()}
                                </span>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-slate-900 dark:text-white">
                                  {student.first_name && student.last_name
                                    ? `${student.first_name} ${student.last_name}`
                                    : student.username}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">{student.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-slate-600 dark:text-slate-400">
                              {student.enrollment_date
                                ? new Date(student.enrollment_date).toLocaleDateString()
                                : '—'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 max-w-[100px] bg-slate-200 dark:bg-slate-600 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full transition-all ${
                                    (student.progress || 0) >= 80 ? 'bg-green-500' :
                                    (student.progress || 0) >= 50 ? 'bg-blue-500' :
                                    (student.progress || 0) >= 25 ? 'bg-yellow-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${Math.min(student.progress || 0, 100)}%` }}
                                />
                              </div>
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 min-w-[40px]">
                                {student.progress || 0}%
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {student.average_score ? (
                              <div className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                                student.average_score >= 90 ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                                student.average_score >= 80 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' :
                                student.average_score >= 70 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' :
                                'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                              }`}>
                                <TrendingUp className="w-3 h-3" />
                                <span>{student.average_score.toFixed(1)}%</span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">No data</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-slate-500 dark:text-slate-400">
                              {student.last_accessed
                                ? new Date(student.last_accessed).toLocaleDateString()
                                : 'Never'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className="flex items-center gap-2">
                              <button className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium text-xs">
                                View
                              </button>
                              <span className="text-slate-300 dark:text-slate-600">|</span>
                              <button
                                onClick={() => handleUnenrollClick(student)}
                                disabled={unenrolling === student.enrollment_id}
                                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium text-xs disabled:opacity-50"
                              >
                                {unenrolling === student.enrollment_id ? 'Removing...' : 'Unenroll'}
                              </button>
                            </div>
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
            <StudentPerformanceAnalytics
              onActionRequired={handleActivityAnalysisAction}
            />
          </TabsContent>

          <TabsContent value="activity" className="space-y-6">
            <StudentActivityAnalysis />
          </TabsContent>
        </Tabs>
      )}

      {/* Confirmation Dialog */}
      {showConfirmDialog.show && showConfirmDialog.student && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Confirm Unenrollment
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Are you sure you want to unenroll <strong>{showConfirmDialog.student.first_name} {showConfirmDialog.student.last_name}</strong> from <strong>{selectedCourseData?.title}</strong>?
              <br /><br />
              <span className="text-red-600 dark:text-red-400">This action cannot be undone and will remove all their progress in this course.</span>
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowConfirmDialog({ show: false, student: null })}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleUnenrollConfirm}
                disabled={unenrolling !== null}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {unenrolling !== null ? 'Unenrolling...' : 'Yes, Unenroll'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ══════════════════════════════════════
  // MAIN RENDER
  // ══════════════════════════════════════

  return (
    <div className="space-y-6">
      {renderBreadcrumb()}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg text-center">
          <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-xs text-red-500 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {step === 'courses' && renderCourseSelection()}
      {step === 'cohorts' && renderCohortSelection()}
      {step === 'students' && renderStudentsDashboard()}
    </div>
  );
};

export default StudentsPage;