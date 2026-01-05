'use client';

import { useState, useEffect } from 'react';
import { StudentSubmissionService, AssignmentWithStatus, ProjectWithStatus } from '@/services/student-submission.service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Calendar,
  TrendingUp,
  Award,
  ExternalLink,
  ChevronRight,
  BookOpen
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function StudentAssessmentsPage() {
  const searchParams = useSearchParams();
  const [assignments, setAssignments] = useState<AssignmentWithStatus[]>([]);
  const [projects, setProjects] = useState<ProjectWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Set initial tab based on URL parameter, default to 'assignments'
  const initialTab = searchParams.get('tab') || 'assignments';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Statistics
  const [stats, setStats] = useState({
    totalAssignments: 0,
    completedAssignments: 0,
    pendingAssignments: 0,
    overdueAssignments: 0,
    totalProjects: 0,
    completedProjects: 0,
    pendingProjects: 0,
    overdueProjects: 0,
    averageGrade: 0
  });

  useEffect(() => {
    fetchAssessments();
  }, []);

  const fetchAssessments = async () => {
    try {
      setLoading(true);
      setError(null);

      const [assignmentsData, projectsData] = await Promise.all([
        StudentSubmissionService.getAssignments(),
        StudentSubmissionService.getProjects()
      ]);

      setAssignments(assignmentsData);
      setProjects(projectsData);

      // Calculate statistics
      const completedAssignments = assignmentsData.filter(
        a => a.submission_status.status === 'graded'
      );
      const pendingAssignments = assignmentsData.filter(
        a => a.submission_status.status === 'submitted'
      );
      const overdueAssignments = assignmentsData.filter(
        a => a.submission_status.status === 'late'
      );

      const completedProjects = projectsData.filter(
        p => p.submission_status.status === 'graded'
      );
      const pendingProjects = projectsData.filter(
        p => p.submission_status.status === 'submitted'
      );
      const overdueProjects = projectsData.filter(
        p => p.submission_status.status === 'late'
      );

      // Calculate average grade
      const gradedItems = [
        ...completedAssignments.map(a => ({
          grade: a.submission_status.grade || 0,
          max: a.points_possible
        })),
        ...completedProjects.map(p => ({
          grade: p.submission_status.grade || 0,
          max: p.points_possible
        }))
      ];

      const avgGrade = gradedItems.length > 0
        ? gradedItems.reduce((sum, item) => sum + (item.grade / item.max) * 100, 0) / gradedItems.length
        : 0;

      setStats({
        totalAssignments: assignmentsData.length,
        completedAssignments: completedAssignments.length,
        pendingAssignments: pendingAssignments.length,
        overdueAssignments: overdueAssignments.length,
        totalProjects: projectsData.length,
        completedProjects: completedProjects.length,
        pendingProjects: pendingProjects.length,
        overdueProjects: overdueProjects.length,
        averageGrade: avgGrade
      });

    } catch (err: any) {
      console.error('Error fetching assessments:', err);
      setError(err.message || 'Failed to load assessments');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: any) => {
    const badgeInfo = StudentSubmissionService.getStatusBadge(status);
    
    const icons: Record<string, any> = {
      'check-circle': CheckCircle2,
      'clock': Clock,
      'exclamation': AlertCircle,
      'warning': AlertCircle
    };
    
    const Icon = icons[badgeInfo.icon] || Clock;
    
    return (
      <Badge className={`${badgeInfo.color} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {badgeInfo.text}
      </Badge>
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No due date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDueDateBadge = (dueDate?: string, submitted?: boolean) => {
    if (!dueDate) return null;
    
    const daysUntil = StudentSubmissionService.getDaysUntilDue(dueDate);
    
    if (submitted) {
      return (
        <Badge variant="outline" className="text-xs">
          Submitted
        </Badge>
      );
    }
    
    if (daysUntil < 0) {
      return (
        <Badge variant="destructive" className="text-xs">
          Overdue by {Math.abs(daysUntil)} days
        </Badge>
      );
    }
    
    if (daysUntil === 0) {
      return (
        <Badge variant="destructive" className="text-xs">
          Due Today
        </Badge>
      );
    }
    
    if (daysUntil <= 3) {
      return (
        <Badge variant="default" className="bg-orange-500 text-xs">
          Due in {daysUntil} days
        </Badge>
      );
    }
    
    return (
      <Badge variant="secondary" className="text-xs">
        Due in {daysUntil} days
      </Badge>
    );
  };

  const renderAssignmentCard = (assignment: AssignmentWithStatus) => {
    const status = assignment.submission_status;
    const percentage = status.grade
      ? StudentSubmissionService.calculatePercentage(status.grade, assignment.points_possible)
      : null;
    const letterGrade = percentage ? StudentSubmissionService.getLetterGrade(percentage) : null;

    return (
      <Card key={assignment.id} className="hover:shadow-lg transition-shadow border-l-4 border-l-blue-500">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg mb-2 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                {assignment.title}
              </CardTitle>
              <CardDescription className="flex flex-col gap-1">
                <span className="flex items-center gap-1 text-sm">
                  <BookOpen className="w-4 h-4" />
                  {assignment.course_title}
                </span>
                <span className="flex items-center gap-1 text-sm">
                  <Calendar className="w-4 h-4" />
                  Due: {formatDate(assignment.due_date)}
                </span>
              </CardDescription>
            </div>
            <div className="flex flex-col items-end gap-2">
              {getStatusBadge(status)}
              {getDueDateBadge(assignment.due_date, status.submitted)}
            </div>
          </div>
          
          {/* Assignment Description */}
          {assignment.description && (
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <MarkdownRenderer 
                content={assignment.description} 
                variant="compact" 
                className="text-sm" 
              />
            </div>
          )}
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            {/* Points */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Points Possible:</span>
              <span className="font-semibold">{assignment.points_possible}</span>
            </div>

            {/* Grade (if graded) */}
            {status.status === 'graded' && status.grade !== undefined && (
              <div className="space-y-2 p-4 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Your Grade:</span>
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-green-600" />
                    <span className="text-2xl font-bold text-green-600">
                      {letterGrade}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Score:</span>
                  <span className="font-semibold">
                    {status.grade} / {assignment.points_possible} ({percentage?.toFixed(1)}%)
                  </span>
                </div>
                {status.graded_at && (
                  <div className="text-xs text-muted-foreground">
                    Graded on {formatDate(status.graded_at)}
                    {status.grader_name && ` by ${status.grader_name}`}
                  </div>
                )}
              </div>
            )}

            {/* Feedback (if available) */}
            {status.feedback && (
              <div className="space-y-2">
                <span className="text-sm font-medium flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  Instructor Feedback:
                </span>
                <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                  <MarkdownRenderer 
                    content={status.feedback} 
                    variant="compact" 
                    className="text-sm" 
                  />
                </div>
              </div>
            )}

            {/* Submission info */}
            {status.submitted && status.submitted_at && (
              <div className="text-xs text-muted-foreground">
                Submitted on {formatDate(status.submitted_at)}
                {status.is_late && (
                  <span className="text-red-600 ml-1">(Late submission)</span>
                )}
              </div>
            )}

            {/* Action button */}
            <Link href={`/student/assignments/${assignment.id}`}>
              <Button 
                className="w-full" 
                variant={status.status === 'not_submitted' && !StudentSubmissionService.isOverdue(assignment.due_date) ? 'default' : 'outline'}
              >
                {status.status === 'not_submitted' && !StudentSubmissionService.isOverdue(assignment.due_date) 
                  ? 'Start Assignment'
                  : status.status === 'late'
                  ? 'View Details (Expired)'
                  : status.status === 'submitted'
                  ? 'View Submission'
                  : 'View Grade & Feedback'
                }
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderProjectCard = (project: ProjectWithStatus) => {
    const status = project.submission_status;
    const percentage = status.grade
      ? StudentSubmissionService.calculatePercentage(status.grade, project.points_possible)
      : null;
    const letterGrade = percentage ? StudentSubmissionService.getLetterGrade(percentage) : null;

    return (
      <Card key={project.id} className="hover:shadow-lg transition-shadow border-l-4 border-l-purple-500">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg mb-2 flex items-center gap-2">
                <Award className="w-5 h-5 text-purple-600" />
                {project.title}
              </CardTitle>
              <CardDescription className="flex flex-col gap-1">
                <span className="flex items-center gap-1 text-sm">
                  <BookOpen className="w-4 h-4" />
                  {project.course_title}
                </span>
                <span className="flex items-center gap-1 text-sm">
                  <Calendar className="w-4 h-4" />
                  Due: {formatDate(project.due_date)}
                </span>
                {project.collaboration_allowed && (
                  <Badge variant="secondary" className="w-fit text-xs">
                    Team Project (Max {project.max_team_size})
                  </Badge>
                )}
              </CardDescription>
            </div>
            <div className="flex flex-col items-end gap-2">
              {getStatusBadge(status)}
              {getDueDateBadge(project.due_date, status.submitted)}
            </div>
          </div>
          
          {/* Project Description */}
          {project.description && (
            <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-800/20 rounded-lg border border-purple-200 dark:border-purple-700">
              <MarkdownRenderer 
                content={project.description} 
                variant="compact" 
                className="text-sm" 
              />
            </div>
          )}
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            {/* Points */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Points Possible:</span>
              <span className="font-semibold">{project.points_possible}</span>
            </div>

            {/* Grade (if graded) */}
            {status.status === 'graded' && status.grade !== undefined && (
              <div className="space-y-2 p-4 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Your Grade:</span>
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-green-600" />
                    <span className="text-2xl font-bold text-green-600">
                      {letterGrade}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Score:</span>
                  <span className="font-semibold">
                    {status.grade} / {project.points_possible} ({percentage?.toFixed(1)}%)
                  </span>
                </div>
                {status.graded_at && (
                  <div className="text-xs text-muted-foreground">
                    Graded on {formatDate(status.graded_at)}
                    {status.grader_name && ` by ${status.grader_name}`}
                  </div>
                )}
              </div>
            )}

            {/* Feedback (if available) */}
            {status.feedback && (
              <div className="space-y-2">
                <span className="text-sm font-medium flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-purple-600" />
                  Instructor Feedback:
                </span>
                <div className="p-3 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-200 dark:border-purple-800">
                  <MarkdownRenderer 
                    content={status.feedback} 
                    variant="compact" 
                    className="text-sm" 
                  />
                </div>
              </div>
            )}

            {/* Submission info */}
            {status.submitted && status.submitted_at && (
              <div className="text-xs text-muted-foreground">
                Submitted on {formatDate(status.submitted_at)}
                {status.is_late && (
                  <span className="text-red-600 ml-1">(Late submission)</span>
                )}
              </div>
            )}

            {/* Feedback (if available) */}
            {status.feedback && (
              <div className="space-y-2">
                <span className="text-sm font-medium flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  Instructor Feedback:
                </span>
                <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                  <MarkdownRenderer 
                    content={status.feedback} 
                    variant="compact" 
                    className="text-sm" 
                  />
                </div>
              </div>
            )}

            {/* Submission info */}
            {status.submitted && status.submitted_at && (
              <div className="text-xs text-muted-foreground">
                Submitted on {formatDate(status.submitted_at)}
                {status.is_late && (
                  <span className="text-red-600 ml-1">(Late submission)</span>
                )}
              </div>
            )}

            {/* Action button */}
            <Link href={`/student/projects/${project.id}`}>
              <Button 
                className="w-full" 
                variant={status.status === 'not_submitted' && !StudentSubmissionService.isOverdue(project.due_date) ? 'default' : 'outline'}
              >
                {status.status === 'not_submitted' && !StudentSubmissionService.isOverdue(project.due_date) 
                  ? 'Start Project'
                  : status.status === 'late'
                  ? 'View Details (Expired)'
                  : status.status === 'submitted'
                  ? 'View Submission'
                  : 'View Grade & Feedback'
                }
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
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
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">My Assessments</h1>
        <p className="text-muted-foreground">
          Track your assignments and projects, view grades and feedback
        </p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average Grade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <span className="text-2xl font-bold">
                {stats.averageGrade > 0 ? `${stats.averageGrade.toFixed(1)}%` : 'N/A'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <span className="text-2xl font-bold">
                {stats.completedAssignments + stats.completedProjects}
              </span>
              <span className="text-sm text-muted-foreground">
                / {stats.totalAssignments + stats.totalProjects}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <span className="text-2xl font-bold">
                {stats.pendingAssignments + stats.pendingProjects}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overdue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="text-2xl font-bold">
                {stats.overdueAssignments + stats.overdueProjects}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full md:w-[400px] grid-cols-2">
          <TabsTrigger value="assignments">
            Assignments ({assignments.length})
          </TabsTrigger>
          <TabsTrigger value="projects">
            Projects ({projects.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assignments" className="space-y-4 mt-6">
          {assignments.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No assignments yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {assignments.map(renderAssignmentCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="projects" className="space-y-4 mt-6">
          {projects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No projects yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {projects.map(renderProjectCard)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
