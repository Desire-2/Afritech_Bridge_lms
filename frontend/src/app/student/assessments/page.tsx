'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  StudentSubmissionService,
  AssignmentWithStatus,
  ProjectWithStatus,
  SubmissionStatus,
} from '@/services/student-submission.service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Calendar,
  TrendingUp,
  Award,
  ChevronRight,
  BookOpen,
  RefreshCw,
  Edit3,
  Layers,
  Filter,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

// ─── Status category definitions ─────────────────────────────────
type StatusFilter = 'all' | 'pending' | 'graded' | 'needs_revision' | 'overdue' | 'not_submitted';

const STATUS_FILTERS: { key: StatusFilter; label: string; icon: React.ElementType; color: string }[] = [
  { key: 'all', label: 'All', icon: Layers, color: 'text-slate-600' },
  { key: 'pending', label: 'Pending Review', icon: Clock, color: 'text-blue-600' },
  { key: 'graded', label: 'Graded', icon: CheckCircle2, color: 'text-green-600' },
  { key: 'needs_revision', label: 'Needs Revision', icon: Edit3, color: 'text-orange-600' },
  { key: 'overdue', label: 'Overdue', icon: AlertCircle, color: 'text-red-600' },
  { key: 'not_submitted', label: 'Not Submitted', icon: FileText, color: 'text-yellow-600' },
];

function matchesFilter(status: SubmissionStatus | undefined, filter: StatusFilter): boolean {
  if (filter === 'all') return true;
  const s = status?.status;
  switch (filter) {
    case 'pending':
      return s === 'submitted';
    case 'graded':
      return s === 'graded';
    case 'needs_revision':
      return s === 'needs_revision';
    case 'overdue':
      return s === 'late';
    case 'not_submitted':
      return s === 'not_submitted';
    default:
      return true;
  }
}

// ── Helpers ──────────────────────────────────────────────────────

function formatDate(dateString?: string) {
  if (!dateString) return 'No due date';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getLetterGradeColor(pct: number) {
  if (pct >= 90) return 'text-green-600';
  if (pct >= 80) return 'text-emerald-600';
  if (pct >= 70) return 'text-blue-600';
  if (pct >= 60) return 'text-yellow-600';
  return 'text-red-600';
}

// ─── Main page component ────────────────────────────────────────

export default function StudentAssessmentsPage() {
  const searchParams = useSearchParams();
  const [assignments, setAssignments] = useState<AssignmentWithStatus[]>([]);
  const [projects, setProjects] = useState<ProjectWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initialTab = (searchParams.get('tab') as 'assignments' | 'projects') || 'assignments';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // ── Fetch ─────────────────────────────────────────────────────
  useEffect(() => {
    fetchAssessments();
  }, []);

  const fetchAssessments = async () => {
    try {
      setLoading(true);
      setError(null);
      const [a, p] = await Promise.all([
        StudentSubmissionService.getAssignments(),
        StudentSubmissionService.getProjects(),
      ]);
      setAssignments(a);
      setProjects(p);
    } catch (err: any) {
      console.error('Error fetching assessments:', err);
      setError(err.message || 'Failed to load assessments');
    } finally {
      setLoading(false);
    }
  };

  // ── Filtered lists ────────────────────────────────────────────
  const filteredAssignments = useMemo(
    () => assignments.filter((a) => matchesFilter(a.submission_status, statusFilter)),
    [assignments, statusFilter],
  );
  const filteredProjects = useMemo(
    () => projects.filter((p) => matchesFilter(p.submission_status, statusFilter)),
    [projects, statusFilter],
  );

  // ── Counts per filter (for badges on pills) ──────────────────
  const assignmentCounts = useMemo(() => {
    const m: Record<StatusFilter, number> = { all: 0, pending: 0, graded: 0, needs_revision: 0, overdue: 0, not_submitted: 0 };
    for (const a of assignments) {
      m.all++;
      const s = a.submission_status?.status;
      if (s === 'submitted') m.pending++;
      else if (s === 'graded') m.graded++;
      else if (s === 'needs_revision') m.needs_revision++;
      else if (s === 'late') m.overdue++;
      else if (s === 'not_submitted') m.not_submitted++;
    }
    return m;
  }, [assignments]);

  const projectCounts = useMemo(() => {
    const m: Record<StatusFilter, number> = { all: 0, pending: 0, graded: 0, needs_revision: 0, overdue: 0, not_submitted: 0 };
    for (const p of projects) {
      m.all++;
      const s = p.submission_status?.status;
      if (s === 'submitted') m.pending++;
      else if (s === 'graded') m.graded++;
      else if (s === 'needs_revision') m.needs_revision++;
      else if (s === 'late') m.overdue++;
      else if (s === 'not_submitted') m.not_submitted++;
    }
    return m;
  }, [projects]);

  const counts = activeTab === 'assignments' ? assignmentCounts : projectCounts;

  // ── Stats ─────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const gradedA = assignments.filter((a) => a.submission_status?.status === 'graded');
    const gradedP = projects.filter((p) => p.submission_status?.status === 'graded');
    const allGraded = [
      ...gradedA.map((a) => ({ grade: a.submission_status?.grade || 0, max: a.points_possible })),
      ...gradedP.map((p) => ({ grade: p.submission_status?.grade || 0, max: p.points_possible })),
    ];
    const avg =
      allGraded.length > 0
        ? allGraded.reduce((s, i) => s + (i.grade / i.max) * 100, 0) / allGraded.length
        : 0;
    const revisionCount =
      assignments.filter((a) => a.submission_status?.status === 'needs_revision').length +
      projects.filter((p) => p.submission_status?.status === 'needs_revision').length;
    return {
      total: assignments.length + projects.length,
      graded: gradedA.length + gradedP.length,
      pending:
        assignments.filter((a) => a.submission_status?.status === 'submitted').length +
        projects.filter((p) => p.submission_status?.status === 'submitted').length,
      overdue:
        assignments.filter((a) => a.submission_status?.status === 'late').length +
        projects.filter((p) => p.submission_status?.status === 'late').length,
      revision: revisionCount,
      averageGrade: avg,
    };
  }, [assignments, projects]);

  // ── Loading / Error states ────────────────────────────────────
  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <RefreshCw className="w-10 h-10 animate-spin text-primary mx-auto mb-3" />
            <p className="text-muted-foreground">Loading assessments...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={fetchAssessments} variant="outline" className="mt-4">
          <RefreshCw className="w-4 h-4 mr-2" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">My Assessments</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Assignments and projects from your released course modules
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAssessments} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard icon={Layers} label="Total" value={stats.total} color="text-slate-700" />
        <StatCard icon={CheckCircle2} label="Graded" value={stats.graded} color="text-green-600" />
        <StatCard icon={Clock} label="Pending" value={stats.pending} color="text-blue-600" />
        <StatCard icon={Edit3} label="Needs Revision" value={stats.revision} color="text-orange-600" />
        <StatCard
          icon={TrendingUp}
          label="Avg Grade"
          value={stats.averageGrade > 0 ? `${stats.averageGrade.toFixed(1)}%` : 'N/A'}
          color="text-emerald-600"
        />
      </div>

      {/* Main tabs: Assignments / Projects */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as any); setStatusFilter('all'); }}>
        <TabsList className="grid w-full sm:w-[340px] grid-cols-2">
          <TabsTrigger value="assignments">
            Assignments ({assignments.length})
          </TabsTrigger>
          <TabsTrigger value="projects">
            Projects ({projects.length})
          </TabsTrigger>
        </TabsList>

        {/* Status filter pills */}
        <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1">
          <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          {STATUS_FILTERS.map((f) => {
            const cnt = counts[f.key];
            const isActive = statusFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                }`}
              >
                <f.icon className="w-3.5 h-3.5" />
                {f.label}
                {cnt > 0 && (
                  <span
                    className={`ml-0.5 text-[10px] rounded-full px-1.5 leading-relaxed ${
                      isActive ? 'bg-white/20' : 'bg-background'
                    }`}
                  >
                    {cnt}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Assignments tab */}
        <TabsContent value="assignments" className="mt-4">
          {filteredAssignments.length === 0 ? (
            <EmptyState type="assignments" hasFilter={statusFilter !== 'all'} />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredAssignments.map((a) => (
                <AssignmentCard key={a.id} assignment={a} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Projects tab */}
        <TabsContent value="projects" className="mt-4">
          {filteredProjects.length === 0 ? (
            <EmptyState type="projects" hasFilter={statusFilter !== 'all'} />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredProjects.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Sub-components
// ═════════════════════════════════════════════════════════════════

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <Icon className={`w-5 h-5 ${color} flex-shrink-0`} />
        <div>
          <p className="text-2xl font-bold leading-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ type, hasFilter }: { type: string; hasFilter: boolean }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16">
        <FileText className="w-12 h-12 text-muted-foreground/40 mb-4" />
        <p className="text-muted-foreground text-sm">
          {hasFilter ? `No ${type} match this filter` : `No ${type} available yet`}
        </p>
      </CardContent>
    </Card>
  );
}

// ── Status badge ────────────────────────────────────────────────

function StatusBadge({ status }: { status?: SubmissionStatus }) {
  if (!status) return null;
  const info = StudentSubmissionService.getStatusBadge(status);
  const icons: Record<string, React.ElementType> = {
    'check-circle': CheckCircle2,
    clock: Clock,
    exclamation: AlertCircle,
    warning: AlertCircle,
  };
  const Icon = icons[info.icon] || Clock;
  return (
    <Badge className={`${info.color} flex items-center gap-1 text-xs`}>
      <Icon className="w-3 h-3" />
      {info.text}
    </Badge>
  );
}

// ── Due date badge ──────────────────────────────────────────────

function DueBadge({ dueDate, submitted }: { dueDate?: string; submitted?: boolean }) {
  if (!dueDate) return null;
  const days = StudentSubmissionService.getDaysUntilDue(dueDate);
  if (submitted)
    return (
      <Badge variant="outline" className="text-[10px]">
        Submitted
      </Badge>
    );
  if (days < 0)
    return (
      <Badge variant="destructive" className="text-[10px]">
        Overdue {Math.abs(days)}d
      </Badge>
    );
  if (days === 0)
    return (
      <Badge variant="destructive" className="text-[10px]">
        Due Today
      </Badge>
    );
  if (days <= 3)
    return (
      <Badge className="bg-orange-500 text-white text-[10px]">
        {days}d left
      </Badge>
    );
  return null;
}

// ── Assignment card ─────────────────────────────────────────────

function AssignmentCard({ assignment }: { assignment: AssignmentWithStatus }) {
  const st = assignment.submission_status;
  const pct = st?.grade
    ? StudentSubmissionService.calculatePercentage(st.grade, assignment.points_possible)
    : null;
  const letter = pct ? StudentSubmissionService.getLetterGrade(pct) : null;
  const isRevision = st?.status === 'needs_revision';

  const borderColor = isRevision
    ? 'border-l-orange-500'
    : st?.status === 'graded'
    ? 'border-l-green-500'
    : st?.status === 'submitted'
    ? 'border-l-blue-500'
    : st?.status === 'late'
    ? 'border-l-red-500'
    : 'border-l-slate-300';

  return (
    <Link href={`/student/assignments/${assignment.id}`} className="block group">
      <Card
        className={`hover:shadow-lg transition-all border-l-4 ${borderColor} group-hover:ring-2 group-hover:ring-primary/20`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base font-semibold flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span className="truncate">{assignment.title}</span>
              </CardTitle>
              <CardDescription className="space-y-0.5 text-xs">
                <span className="flex items-center gap-1">
                  <BookOpen className="w-3 h-3" />
                  {assignment.course_title}
                  {assignment.module_title && (
                    <span className="text-muted-foreground/70"> &middot; {assignment.module_title}</span>
                  )}
                </span>
                {assignment.due_date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Due {formatDate(assignment.due_date)}
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <StatusBadge status={st} />
              <DueBadge dueDate={assignment.due_date} submitted={st?.submitted} />
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0 pb-4">
          {/* Grade display */}
          {st?.status === 'graded' && pct !== null && (
            <div className="flex items-center justify-between bg-green-50 dark:bg-green-950/20 rounded-lg px-3 py-2 mb-3">
              <span className="text-xs text-muted-foreground">Score</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">
                  {st.grade}/{assignment.points_possible} ({pct.toFixed(0)}%)
                </span>
                <span className={`text-lg font-bold ${getLetterGradeColor(pct)}`}>{letter}</span>
              </div>
            </div>
          )}

          {/* Needs-revision banner */}
          {isRevision && (
            <div className="flex items-start gap-2 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg px-3 py-2 mb-3">
              <Edit3 className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs">
                <p className="font-medium text-orange-800 dark:text-orange-300">Revision Requested</p>
                {st?.feedback && (
                  <p className="text-orange-700 dark:text-orange-400 line-clamp-2 mt-0.5">{st.feedback}</p>
                )}
              </div>
            </div>
          )}

          {/* Feedback preview for graded */}
          {st?.status === 'graded' && st?.feedback && !isRevision && (
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 mb-3 line-clamp-2">
              <span className="font-medium">Feedback:</span> {st.feedback}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {assignment.points_possible} pts
            </span>
            <span className="text-xs text-primary font-medium flex items-center gap-1 group-hover:underline">
              {st?.status === 'not_submitted' ? 'Start Assignment' : 'View Details'}
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ── Project card ────────────────────────────────────────────────

function ProjectCard({ project }: { project: ProjectWithStatus }) {
  const st = project.submission_status;
  const pct = st?.grade
    ? StudentSubmissionService.calculatePercentage(st.grade, project.points_possible)
    : null;
  const letter = pct ? StudentSubmissionService.getLetterGrade(pct) : null;
  const isRevision = st?.status === 'needs_revision';

  const borderColor = isRevision
    ? 'border-l-orange-500'
    : st?.status === 'graded'
    ? 'border-l-green-500'
    : st?.status === 'submitted'
    ? 'border-l-blue-500'
    : st?.status === 'late'
    ? 'border-l-red-500'
    : 'border-l-slate-300';

  return (
    <Link href={`/student/projects/${project.id}`} className="block group">
      <Card
        className={`hover:shadow-lg transition-all border-l-4 ${borderColor} group-hover:ring-2 group-hover:ring-primary/20`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base font-semibold flex items-center gap-2 mb-1">
                <Award className="w-4 h-4 text-purple-600 flex-shrink-0" />
                <span className="truncate">{project.title}</span>
              </CardTitle>
              <CardDescription className="space-y-0.5 text-xs">
                <span className="flex items-center gap-1">
                  <BookOpen className="w-3 h-3" />
                  {project.course_title}
                  {project.module_titles && project.module_titles.length > 0 && (
                    <span className="text-muted-foreground/70">
                      {' '}&middot; {project.module_titles.join(', ')}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Due {formatDate(project.due_date)}
                </span>
                {project.collaboration_allowed && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 w-fit">
                    Team (max {project.max_team_size})
                  </Badge>
                )}
              </CardDescription>
            </div>
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <StatusBadge status={st} />
              <DueBadge dueDate={project.due_date} submitted={st?.submitted} />
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0 pb-4">
          {st?.status === 'graded' && pct !== null && (
            <div className="flex items-center justify-between bg-green-50 dark:bg-green-950/20 rounded-lg px-3 py-2 mb-3">
              <span className="text-xs text-muted-foreground">Score</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">
                  {st.grade}/{project.points_possible} ({pct.toFixed(0)}%)
                </span>
                <span className={`text-lg font-bold ${getLetterGradeColor(pct)}`}>{letter}</span>
              </div>
            </div>
          )}

          {isRevision && (
            <div className="flex items-start gap-2 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg px-3 py-2 mb-3">
              <Edit3 className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs">
                <p className="font-medium text-orange-800 dark:text-orange-300">Revision Requested</p>
                {st?.feedback && (
                  <p className="text-orange-700 dark:text-orange-400 line-clamp-2 mt-0.5">{st.feedback}</p>
                )}
              </div>
            </div>
          )}

          {st?.status === 'graded' && st?.feedback && !isRevision && (
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 mb-3 line-clamp-2">
              <span className="font-medium">Feedback:</span> {st.feedback}
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {project.points_possible} pts
            </span>
            <span className="text-xs text-primary font-medium flex items-center gap-1 group-hover:underline">
              {st?.status === 'not_submitted' ? 'Start Project' : 'View Details'}
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
