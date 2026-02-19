'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import applicationService from '@/services/api/application.service';
import instructorService from '@/services/api/instructor.service';
import { CourseApplication, ApplicationStatistics } from '@/services/api/types';
import type { CohortOption, CohortStatus } from '@/types/api';
import { getStatusBadgeStyles as getCohortBadgeStyles } from '@/utils/cohort-utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle,
  XCircle,
  Clock,
  Download,
  Eye,
  Search,
  Users,
  TrendingUp,
  AlertCircle,
  Pause,
  RefreshCw,
  FileText,
  CalendarDays,
  GraduationCap,
  Layers,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────
interface CourseWithCohorts {
  id: number;
  title: string;
  applications_count: number;
  application_windows?: Array<{
    id: number;
    cohort_label?: string;
    status?: string;
    opens_at?: string;
    closes_at?: string;
    cohort_start?: string;
    cohort_end?: string;
    applications_count?: number;
  }>;
  no_window_applications_count?: number;
  cohort_label?: string;
}

// ─── Component ──────────────────────────────────────────────────────────
export default function InstructorApplicationsManager() {
  const { user } = useAuth();

  // Data
  const [applications, setApplications] = useState<CourseApplication[]>([]);
  const [statistics, setStatistics] = useState<ApplicationStatistics | null>(null);
  const [courses, setCourses] = useState<CourseWithCohorts[]>([]);
  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters — course must be selected first, then cohort
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedCohortId, setSelectedCohortId] = useState<string>('all');
  const [courseSelected, setCourseSelected] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  const [filters, setFilters] = useState({
    status: 'all',
    course_id: '' as string,
    cohort_label: '' as string,
    application_window_id: '' as string,
    search: '',
    sort_by: 'submission_date',
    sort_order: 'desc' as 'asc' | 'desc',
    page: 1,
    per_page: 20,
  });

  // Detail modal
  const [selectedApplication, setSelectedApplication] = useState<CourseApplication | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  // ─── Search debouncing ────────────────────────────────────────
  const debouncedSetSearch = useCallback((value: string) => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: value, page: 1 }));
    }, 300);
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    debouncedSetSearch(value);
  };

  useEffect(() => {
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, []);

  // ─── Load courses & build cohorts ─────────────────────────────
  useEffect(() => {
    if (user) loadCoursesAndCohorts();
  }, [user]);

  // When filters change, reload data (only if a course is selected)
  useEffect(() => {
    if (courseSelected && filters.course_id) {
      loadApplications();
      loadStatistics();
    }
  }, [filters, courseSelected]);

  const loadCoursesAndCohorts = async () => {
    try {
      // Get instructor's courses first
      const instructorData = await instructorService.getInstructorCourses();
      const instructorCourseList = Array.isArray(instructorData) ? instructorData : instructorData?.courses || [];

      if (instructorCourseList.length === 0) {
        setCourses([]);
        setCohorts([]);
        setLoading(false);
        return;
      }

      // Try to get enriched course data from /applications/courses
      let enrichedCourses: CourseWithCohorts[] = [];
      try {
        const response = await applicationService.getCoursesForFiltering();
        const allCourses = response.courses || [];
        // Only keep courses the instructor owns
        const instructorIds = new Set(instructorCourseList.map((c: any) => c.id));
        enrichedCourses = allCourses.filter((c: any) => instructorIds.has(c.id));

        // Also include instructor courses not in the API response 
        // (courses with no applications AND no windows)
        const enrichedIds = new Set(enrichedCourses.map(c => c.id));
        for (const ic of instructorCourseList) {
          if (!enrichedIds.has(ic.id)) {
            enrichedCourses.push({
              id: ic.id,
              title: ic.title,
              applications_count: 0,
            });
          }
        }
      } catch (err) {
        console.error('[DEBUG] getCoursesForFiltering FAILED:', err);
        // Fallback: use instructor courses without window data
        enrichedCourses = instructorCourseList.map((c: any) => ({
          id: c.id,
          title: c.title,
          applications_count: c.applications_count || 0,
        }));
      }

      setCourses(enrichedCourses);
      console.log('[DEBUG] enrichedCourses:', JSON.stringify(enrichedCourses.map(c => ({ id: c.id, title: c.title, windows: c.application_windows?.length || 0 }))));

      // Build cohort options from actual application windows only
      const options: CohortOption[] = [];
      for (const course of enrichedCourses) {
        // Only create cohort cards for actual application windows
        if (course.application_windows && course.application_windows.length > 0) {
          for (const win of course.application_windows) {
            options.push({
              id: `window-${win.id}`,
              label: win.cohort_label || `Cohort ${win.id}`,
              courseId: course.id,
              courseTitle: course.title,
              applicationWindowId: win.id,
              status: (win.status || 'open') as CohortStatus,
              opensAt: win.opens_at || null,
              closesAt: win.closes_at || null,
              cohortStart: win.cohort_start || null,
              cohortEnd: win.cohort_end || null,
              applicationsCount: win.applications_count || 0,
            });
          }
        }
        // Applications not linked to any window (legacy / unassigned)
        const unassignedCount = course.no_window_applications_count || 
          ((!course.application_windows || course.application_windows.length === 0) ? course.applications_count : 0);
        if (unassignedCount > 0) {
          options.push({
            id: `unassigned-${course.id}`,
            label: 'Unassigned',
            courseId: course.id,
            courseTitle: course.title,
            status: 'closed' as CohortStatus,
            applicationsCount: unassignedCount,
          });
        }
      }
      console.log('[DEBUG] cohort options built:', JSON.stringify(options.map(o => ({ id: o.id, label: o.label, courseId: o.courseId }))));
      setCohorts(options);

      // Auto-select course if only one
      if (enrichedCourses.length === 1) {
        const course = enrichedCourses[0];
        setSelectedCourseId(course.id.toString());
        setCourseSelected(true);
        setFilters(prev => ({ ...prev, course_id: course.id.toString(), page: 1 }));
      }

      setLoading(false);
    } catch (err) {
      console.error('Failed to load courses:', err);
      setError('Failed to load your courses');
      setLoading(false);
    }
  };

  // ─── Cohort selection handler ─────────────────────────────────
  const handleCohortSelect = (cohortId: string) => {
    setSelectedCohortId(cohortId);

    if (cohortId === 'all') {
      // Show all applications for the selected course
      setFilters(prev => ({
        ...prev,
        course_id: selectedCourseId,
        cohort_label: '',
        application_window_id: '',
        page: 1,
      }));
      return;
    }

    const selected = cohorts.find(c => c.id === cohortId);
    if (!selected) return;

    const isUnassigned = cohortId.startsWith('unassigned-');
    setFilters(prev => ({
      ...prev,
      course_id: selected.courseId ? selected.courseId.toString() : '',
      application_window_id: isUnassigned ? 'none' : (selected.applicationWindowId ? selected.applicationWindowId.toString() : ''),
      cohort_label: !isUnassigned && !selected.applicationWindowId && selected.label ? selected.label : '',
      page: 1,
    }));
  };

  const handleCourseSelect = (courseId: string) => {
    setSelectedCourseId(courseId);
    setSelectedCohortId('all');
    setCourseSelected(true);
    setFilters(prev => ({
      ...prev,
      course_id: courseId,
      cohort_label: '',
      application_window_id: '',
      page: 1,
    }));
  };

  const handleBackToCourses = () => {
    setSelectedCourseId('');
    setSelectedCohortId('all');
    setCourseSelected(false);
    setApplications([]);
    setStatistics(null);
    setFilters(prev => ({
      ...prev,
      course_id: '',
      cohort_label: '',
      application_window_id: '',
      page: 1,
    }));
  };

  // Filter cohorts to show only for the selected course
  const displayedCohorts = cohorts.filter(c => c.courseId?.toString() === selectedCourseId);
  console.log('[DEBUG] selectedCourseId:', selectedCourseId, 'courseSelected:', courseSelected, 'cohorts:', cohorts.length, 'displayedCohorts:', displayedCohorts.length);
  const selectedCourse = courses.find(c => c.id.toString() === selectedCourseId);

  // ─── API calls ────────────────────────────────────────────────
  const loadApplications = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await applicationService.listApplications({
        status: filters.status !== 'all' ? filters.status : undefined,
        course_id: filters.course_id ? parseInt(filters.course_id) : undefined,
        application_window_id: filters.application_window_id === 'none' ? 'none' : (filters.application_window_id ? parseInt(filters.application_window_id) : undefined),
        cohort_label: filters.cohort_label || undefined,
        search: filters.search || undefined,
        sort_by: filters.sort_by,
        sort_order: filters.sort_order,
        page: filters.page,
        per_page: filters.per_page,
      });
      setApplications(response.applications || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const stats = await applicationService.getStatistics({
        course_id: filters.course_id ? parseInt(filters.course_id) : undefined,
        application_window_id: filters.application_window_id === 'none' ? 'none' : (filters.application_window_id ? parseInt(filters.application_window_id) : undefined),
        cohort_label: filters.cohort_label || undefined,
      });
      setStatistics(stats);
    } catch (err) {
      console.error('Failed to load statistics:', err);
    }
  };

  // ─── Actions ──────────────────────────────────────────────────
  const handleViewDetails = (application: CourseApplication) => {
    setSelectedApplication(application);
    setNotes(application.admin_notes || '');
    setDetailModalOpen(true);
  };

  const handleUpdateNotes = async (applicationId: number) => {
    setActionLoading(true);
    setActionError(null);
    try {
      await applicationService.updateNotes(applicationId, { admin_notes: notes });
      await loadApplications();
    } catch (err: any) {
      setActionError(err.message || 'Failed to update notes');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecalculateScores = async (applicationId: number) => {
    setActionLoading(true);
    setActionError(null);
    try {
      await applicationService.recalculateScores(applicationId);
      await loadApplications();
      if (selectedApplication) {
        const updated = await applicationService.getApplication(applicationId);
        setSelectedApplication(updated);
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to recalculate scores');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      await applicationService.downloadExport({
        status: filters.status !== 'all' ? filters.status : undefined,
        course_id: filters.course_id || undefined,
        cohort_label: filters.cohort_label || undefined,
        application_window_id: filters.application_window_id === 'none' ? 'none' : (filters.application_window_id ? parseInt(filters.application_window_id) : undefined),
      });
    } catch (err: any) {
      setError(err.message || 'Failed to export applications');
    }
  };

  // ─── Badge helpers ────────────────────────────────────────────
  const getStatusBadge = (status: string) => {
    const cfg: Record<string, { variant: any; icon: any; label: string }> = {
      pending: { variant: 'default', icon: Clock, label: 'Pending' },
      approved: { variant: 'success', icon: CheckCircle, label: 'Approved' },
      rejected: { variant: 'destructive', icon: XCircle, label: 'Rejected' },
      waitlisted: { variant: 'secondary', icon: Pause, label: 'Waitlisted' },
    };
    const c = cfg[status] || cfg.pending;
    const Icon = c.icon;
    return (
      <Badge variant={c.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {c.label}
      </Badge>
    );
  };

  const getScoreBadge = (score: number | null | undefined, label: string) => {
    if (score === null || score === undefined) return null;
    let cls = 'bg-gray-100 text-gray-800';
    if (score >= 80) cls = 'bg-green-100 text-green-800';
    else if (score >= 60) cls = 'bg-blue-100 text-blue-800';
    else if (score >= 40) cls = 'bg-yellow-100 text-yellow-800';
    else cls = 'bg-red-100 text-red-800';
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label}: {score}</span>;
  };

  const formatShortDate = (value?: string | null) => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const selectedCohort = cohorts.find(c => c.id === selectedCohortId);

  // ─── Render ───────────────────────────────────────────────────
  if (loading && courses.length === 0) {
    return (
      <div className="text-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400" />
        <p className="text-gray-500 mt-2">Loading your courses…</p>
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="text-center py-16">
        <GraduationCap className="w-16 h-16 mx-auto text-gray-300" />
        <h3 className="text-lg font-semibold text-gray-700 mt-4">No Courses Found</h3>
        <p className="text-gray-500 mt-1">You don't have any courses with applications yet.</p>
      </div>
    );
  }

  // ── Step 1: Select a course (shown when no course selected and multiple courses exist)
  if (!courseSelected && courses.length > 1) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-blue-600" />
            Select a Course
          </h2>
          <p className="text-gray-500 mt-1">Choose a course to view and manage its applications by cohort.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map(course => {
            const windowCount = course.application_windows?.length || 0;
            return (
              <button
                key={course.id}
                onClick={() => handleCourseSelect(course.id.toString())}
                className="text-left p-5 rounded-xl border-2 border-gray-200 bg-white hover:border-blue-400 hover:shadow-lg transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <GraduationCap className="w-8 h-8 text-blue-500 group-hover:text-blue-600" />
                  <span className="text-2xl font-bold text-blue-600">{course.applications_count}</span>
                </div>
                <h3 className="font-semibold text-gray-900 text-base mb-1 line-clamp-2">{course.title}</h3>
                <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                  <Layers className="w-3.5 h-3.5" />
                  <span>{windowCount} cohort{windowCount !== 1 ? 's' : ''}</span>
                  <span className="text-gray-300">•</span>
                  <Users className="w-3.5 h-3.5" />
                  <span>{course.applications_count} application{course.applications_count !== 1 ? 's' : ''}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Course header with back button (multi-course) ── */}
      {courses.length > 1 && (
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={handleBackToCourses} className="text-gray-500 hover:text-gray-700">
            ← Back to courses
          </Button>
          <div className="h-5 w-px bg-gray-300" />
          <GraduationCap className="w-5 h-5 text-blue-600" />
          <span className="font-semibold text-gray-900">{selectedCourse?.title}</span>
          <Badge variant="outline" className="text-blue-700 border-blue-200">{selectedCourse?.applications_count} apps</Badge>
        </div>
      )}

      {/* ── Cohort switcher — only visible after course is selected ── */}
      <Card className="border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-base text-blue-900">
                Cohorts{selectedCourse ? ` — ${selectedCourse.title}` : ''}
              </CardTitle>
              {selectedCohort && (
                <Badge variant="outline" className="ml-2 text-blue-700 border-blue-300">
                  {selectedCohort.label}
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCohortSelect('all')}
              className={selectedCohortId === 'all' ? 'bg-blue-100' : ''}
            >
              All ({displayedCohorts.reduce((s, c) => s + (c.applicationsCount || 0), 0)})
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {displayedCohorts.length === 0 ? (
            <p className="text-sm text-gray-500">No cohorts found for this course. All applications will be shown below.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {displayedCohorts.map(cohort => (
                <button
                  key={cohort.id}
                  onClick={() => handleCohortSelect(cohort.id)}
                  className={`text-left p-3 rounded-lg border transition-all ${
                    selectedCohortId === cohort.id
                      ? 'border-blue-500 bg-blue-600 text-white shadow-md'
                      : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-semibold truncate ${
                      selectedCohortId === cohort.id ? 'text-white' : 'text-gray-900'
                    }`}>
                      {cohort.label}
                    </span>
                    <Badge
                      variant="outline"
                      className={selectedCohortId === cohort.id
                        ? 'bg-white/20 text-white border-white/40 text-xs'
                        : `${getCohortBadgeStyles(cohort.status)} text-xs`
                      }
                    >
                      {cohort.status}
                    </Badge>
                  </div>
                  {cohort.courseTitle && courses.length > 1 && (
                    <p className={`text-xs truncate mb-1 ${
                      selectedCohortId === cohort.id ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {cohort.courseTitle}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className={`text-xs ${
                      selectedCohortId === cohort.id ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {cohort.opensAt && (
                        <>
                          <CalendarDays className="w-3 h-3 inline mr-1" />
                          {formatShortDate(cohort.opensAt)}
                        </>
                      )}
                    </span>
                    <span className={`text-sm font-bold ${
                      selectedCohortId === cohort.id ? 'text-white' : 'text-blue-600'
                    }`}>
                      {cohort.applicationsCount ?? 0} <span className="text-xs font-normal">apps</span>
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Statistics ── */}
      {statistics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Total</p>
                  <p className="text-2xl font-bold mt-1">{statistics.total_applications}</p>
                </div>
                <Users className="w-8 h-8 text-blue-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Pending</p>
                  <p className="text-2xl font-bold mt-1 text-amber-600">
                    {statistics.status_breakdown?.pending ?? statistics.pending ?? 0}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-amber-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Approved</p>
                  <p className="text-2xl font-bold mt-1 text-green-600">
                    {statistics.status_breakdown?.approved ?? statistics.approved ?? 0}
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Avg Score</p>
                  <p className="text-2xl font-bold mt-1 text-indigo-600">
                    {statistics.average_scores?.application_score != null
                      ? statistics.average_scores.application_score.toFixed(0)
                      : statistics.average_score?.toFixed(0) ?? 'N/A'
                    }
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-indigo-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Instructor info alert ── */}
      <Alert className="bg-blue-50 border-blue-200">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-900">
          <strong>Instructor View:</strong> You can review applications and add notes.
          Only administrators can approve, reject, or waitlist applications.
        </AlertDescription>
      </Alert>

      {/* ── Main table card ── */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle>
                {selectedCohort ? `${selectedCohort.label} — Applications` : `${selectedCourse?.title || 'All'} — Applications`}
              </CardTitle>
              <CardDescription>
                {selectedCohort
                  ? `Showing applications for ${selectedCohort.label}${selectedCohort.courseTitle ? ` (${selectedCohort.courseTitle})` : ''}`
                  : 'Review and manage applications for your courses'
                }
              </CardDescription>
            </div>
            <Button onClick={handleExport} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters row */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search by name, email..."
                  value={searchInput}
                  onChange={handleSearchChange}
                  className="pl-10"
                />
              </div>
            </div>

            <Select
              value={filters.status}
              onValueChange={v => setFilters(prev => ({ ...prev, status: v, page: 1 }))}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="waitlisted">Waitlisted</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.sort_by}
              onValueChange={v => setFilters(prev => ({ ...prev, sort_by: v, page: 1 }))}
            >
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="submission_date">Date Applied</SelectItem>
                <SelectItem value="final_rank_score">Final Rank</SelectItem>
                <SelectItem value="application_score">App Score</SelectItem>
                <SelectItem value="readiness_score">Readiness</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Error */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Loading */}
          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400" />
              <p className="text-gray-500 mt-2">Loading applications…</p>
            </div>
          ) : applications.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto text-gray-300" />
              <p className="text-gray-500 mt-2 font-medium">No applications found</p>
              <p className="text-gray-400 text-sm mt-1">
                {selectedCohort
                  ? `No applications for ${selectedCohort.label} with the current filters.`
                  : 'Try adjusting your filters or select a different cohort.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {applications.map(app => (
                <div
                  key={app.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-white"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="font-semibold text-base truncate">{app.full_name}</h3>
                        {getStatusBadge(app.status)}
                        {app.cohort_label && (
                          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs">
                            {app.cohort_label}
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-sm text-gray-600 mb-3">
                        <div className="truncate">
                          <span className="font-medium text-gray-500">Email:</span> {app.email}
                        </div>
                        <div>
                          <span className="font-medium text-gray-500">Phone:</span> {app.phone}
                        </div>
                        <div>
                          <span className="font-medium text-gray-500">Excel:</span>{' '}
                          {app.excel_skill_level?.replace(/_/g, ' ')}
                        </div>
                        <div>
                          <span className="font-medium text-gray-500">Location:</span>{' '}
                          {[app.city, app.country].filter(Boolean).join(', ')}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {getScoreBadge(app.final_rank_score ?? app.final_rank, 'Rank')}
                        {getScoreBadge(app.application_score, 'App')}
                        {getScoreBadge(app.readiness_score, 'Ready')}
                        {getScoreBadge(app.commitment_score, 'Commit')}
                        {app.is_high_risk && (
                          <Badge variant="destructive" className="text-xs">High Risk</Badge>
                        )}
                      </div>

                      <p className="text-xs text-gray-400">
                        Applied: {app.created_at ? formatShortDate(app.created_at) : app.submission_date ? formatShortDate(app.submission_date) : '—'}
                      </p>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewDetails(app)}
                      className="ml-3 shrink-0"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {applications.length > 0 && (
            <div className="flex justify-center items-center gap-2 mt-6">
              <Button
                variant="outline" size="sm"
                onClick={() => setFilters(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={filters.page === 1}
              >
                Previous
              </Button>
              <span className="px-3 py-1 text-sm text-gray-600">Page {filters.page}</span>
              <Button
                variant="outline" size="sm"
                onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={applications.length < filters.per_page}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Detail Modal ── */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedApplication && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Application Details
                  {selectedApplication.cohort_label && (
                    <Badge variant="outline" className="text-sm bg-indigo-50 text-indigo-700 border-indigo-200">
                      {selectedApplication.cohort_label}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription>
                  {selectedApplication.full_name} — {selectedApplication.email}
                </DialogDescription>
              </DialogHeader>

              {actionError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{actionError}</AlertDescription>
                </Alert>
              )}

              <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="motivation">Motivation</TabsTrigger>
                  <TabsTrigger value="actions">Actions</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      ['Full Name', selectedApplication.full_name],
                      ['Email', selectedApplication.email],
                      ['Phone', selectedApplication.phone],
                      ['WhatsApp', selectedApplication.whatsapp_number || 'N/A'],
                      ['Gender', selectedApplication.gender || 'N/A'],
                      ['Age Range', selectedApplication.age_range || 'N/A'],
                      ['Country', selectedApplication.country],
                      ['City', selectedApplication.city],
                      ['Education', selectedApplication.education_level || 'N/A'],
                      ['Status', selectedApplication.current_status || 'N/A'],
                      ['Field', selectedApplication.field_of_study || 'N/A'],
                      ['Excel Level', selectedApplication.excel_skill_level],
                      ['Has Computer', selectedApplication.has_computer ? 'Yes' : 'No'],
                      ['Internet', selectedApplication.internet_access_type || 'N/A'],
                      ['Cohort', selectedApplication.cohort_label || 'N/A'],
                    ].map(([label, value]) => (
                      <div key={label as string}>
                        <Label className="text-xs text-gray-500">{label}</Label>
                        <p className="font-medium text-sm">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-4 border-t">
                    {getScoreBadge(selectedApplication.final_rank_score ?? selectedApplication.final_rank, 'Final Rank')}
                    {getScoreBadge(selectedApplication.application_score, 'Application')}
                    {getScoreBadge(selectedApplication.readiness_score, 'Readiness')}
                    {getScoreBadge(selectedApplication.commitment_score, 'Commitment')}
                    {getScoreBadge(selectedApplication.risk_score, 'Risk')}
                  </div>
                </TabsContent>

                <TabsContent value="motivation" className="space-y-4">
                  {[
                    ['Why do you want to join?', selectedApplication.motivation],
                    ['Learning Outcomes', selectedApplication.learning_outcomes],
                    ['Career Impact', selectedApplication.career_impact],
                    ['Referral Source', selectedApplication.referral_source],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <Label className="text-xs text-gray-500 uppercase tracking-wide">{label}</Label>
                      <p className="text-sm mt-1 whitespace-pre-wrap">{value || 'Not provided'}</p>
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="actions" className="space-y-4">
                  <div>
                    <Label htmlFor="notes">Internal Notes</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      rows={4}
                      placeholder="Add internal notes about this application..."
                    />
                    <Button
                      onClick={() => handleUpdateNotes(selectedApplication.id)}
                      disabled={actionLoading}
                      className="mt-2" size="sm"
                    >
                      Save Notes
                    </Button>
                  </div>

                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      onClick={() => handleRecalculateScores(selectedApplication.id)}
                      disabled={actionLoading}
                      variant="outline" size="sm"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Recalculate Scores
                    </Button>
                  </div>

                  <Alert className="bg-amber-50 border-amber-200">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-900">
                      Only administrators can approve, reject, or waitlist applications.
                    </AlertDescription>
                  </Alert>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
