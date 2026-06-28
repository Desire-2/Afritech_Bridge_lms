"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { StudentSubmissionService, TeamDashboardData, TeamMember } from '@/services/student-submission.service';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Users,
  Mail,
  Phone,
  Calendar,
  Award,
  CheckCircle2,
  Clock,
  FileText,
  Edit3,
  ExternalLink,
  Crown,
  User,
  Send,
  AlertTriangle,
  RefreshCw,
  Target,
  BookOpen,
  MessageSquare,
  Shield
} from 'lucide-react';

export default function StudentTeamDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = Number(params.id);

  const [data, setData] = useState<TeamDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeamData = useCallback(async () => {
    if (!projectId || isNaN(projectId)) {
      setError('Invalid project ID');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await StudentSubmissionService.getMyTeamInfo(projectId);
      setData(res);
    } catch (err: any) {
      console.error('Error fetching team data:', err);
      setError(err?.message || 'Failed to load team dashboard');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchTeamData();
  }, [fetchTeamData]);

  // ── Loading ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative">
            <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mx-auto" />
            <Users className="h-6 w-6 text-indigo-400 absolute inset-0 m-auto animate-pulse" />
          </div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">Loading your team...</p>
        </div>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="max-w-3xl mx-auto p-6 space-y-4">
          <button
            onClick={() => router.push('/student/assessments?tab=projects')}
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Assessments
          </button>
          <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-1">Could Not Load Team</h3>
            <p className="text-red-600 dark:text-red-400 mb-4">{error || 'Team data not found'}</p>
            <button
              onClick={fetchTeamData}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { project, team, submission, enrollment, in_team } = data;

  // ── Not in a team ──────────────────────────────────────────
  if (!in_team || !team) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="max-w-3xl mx-auto p-6 space-y-4">
          <button
            onClick={() => router.push('/student/assessments?tab=projects')}
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Assessments
          </button>
          <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-8 text-center">
            <div className="w-20 h-20 mx-auto bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-4">
              <Users className="w-10 h-10 text-indigo-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Not Assigned to a Team</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
              You haven't been assigned to a team for <strong>{project.title}</strong> yet. 
              Your instructor will assign teams soon.
            </p>
            <button
              onClick={() => router.push(`/student/projects/${project.id}`)}
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors inline-flex items-center gap-2 font-medium"
            >
              <ExternalLink className="w-4 h-4" />
              View Project Details
            </button>
          </div>
        </div>
      </div>
    );
  }

  const dueDate = project.due_date ? new Date(project.due_date) : null;
  const isOverdue = dueDate ? dueDate < new Date() : false;
  const daysRemaining = dueDate ? Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  const getStatusBadge = () => {
    if (submission?.needs_revision) {
      return { label: 'Needs Revision', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300', icon: Edit3 };
    }
    if (submission?.grade != null) {
      return { label: 'Graded', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: CheckCircle2 };
    }
    if (submission?.submitted) {
      return { label: 'Submitted', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icon: Clock };
    }
    if (isOverdue) {
      return { label: 'Overdue', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: AlertTriangle };
    }
    return { label: 'Not Submitted', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', icon: FileText };
  };

  const statusBadge = getStatusBadge();
  const StatusIcon = statusBadge.icon;

  const getPercentage = () => {
    if (submission?.grade != null && project.points_possible) {
      return Math.round((submission.grade / project.points_possible) * 100);
    }
    return null;
  };
  const pct = getPercentage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
        {/* Back Navigation */}
        <button
          onClick={() => router.push(`/student/projects/${project.id}`)}
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Project
        </button>

        {/* Needs Revision Banner */}
        {submission?.needs_revision && (
          <div className="bg-orange-50 dark:bg-orange-950/20 border-2 border-orange-300 dark:border-orange-700 rounded-xl p-4 flex items-start gap-3">
            <Edit3 className="w-5 h-5 text-orange-600 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-semibold text-orange-800 dark:text-orange-300">Revision Requested</h4>
              <p className="text-sm text-orange-700 dark:text-orange-400">
                {submission.modification_reason || 'Your instructor has requested modifications. Please revise and resubmit.'}
              </p>
            </div>
          </div>
        )}

        {/* Header Card */}
        <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <Users className="w-6 h-6" />
                  My Team
                </h1>
                <p className="text-indigo-200 text-sm mt-1">{project.title}</p>
              </div>
              <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${statusBadge.color}`}>
                <StatusIcon className="w-3.5 h-3.5" />
                {statusBadge.label}
              </div>
            </div>
          </div>

          {/* Quick Info Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-100 dark:divide-gray-700 border-b border-gray-100 dark:border-gray-700">
            <div className="p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                {team.member_count}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Team Members</p>
            </div>
            <div className="p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 text-2xl font-bold text-purple-600 dark:text-purple-400">
                {project.points_possible}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Total Points</p>
            </div>
            <div className="p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 text-2xl font-bold text-pink-600 dark:text-pink-400">
                {daysRemaining !== null ? (daysRemaining > 0 ? daysRemaining : 0) : '—'}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Days {daysRemaining !== null && daysRemaining >= 0 ? 'Remaining' : 'Overdue'}</p>
            </div>
            <div className="p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {pct !== null ? `${pct}%` : '—'}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Score</p>
            </div>
          </div>
        </div>

        {/* Team Members Section */}
        <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-500" />
              Team Members
            </h2>
            <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
              {team.member_count} {team.member_count === 1 ? 'member' : 'members'}
            </span>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {team.members.map((member: TeamMember) => (
                <div
                  key={member.id}
                  className={`relative rounded-xl border-2 p-4 transition-all duration-200 hover:shadow-md ${
                    member.is_me
                      ? 'border-indigo-300 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800'
                  }`}
                >
                  {/* Badges */}
                  <div className="absolute top-3 right-3 flex gap-1.5">
                    {member.is_primary && (
                      <span className="text-[10px] bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                        <Crown className="w-3 h-3" />
                        Lead
                      </span>
                    )}
                    {member.is_me && (
                      <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                        <User className="w-3 h-3" />
                        You
                      </span>
                    )}
                  </div>

                  {/* Avatar */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                      member.is_primary
                        ? 'bg-gradient-to-br from-yellow-400 to-orange-500'
                        : member.is_me
                          ? 'bg-gradient-to-br from-indigo-500 to-purple-600'
                          : 'bg-gradient-to-br from-purple-400 to-pink-500'
                    }`}>
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{member.name}</h3>
                      {member.is_primary && (
                        <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">Team Lead</p>
                      )}
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <a
                      href={`mailto:${member.email}`}
                      className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    >
                      <Mail className="w-4 h-4 text-gray-400" />
                      {member.email}
                    </a>
                    {member.phone && (
                      <a
                        href={`tel:${member.phone}`}
                        className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      >
                        <Phone className="w-4 h-4 text-gray-400" />
                        {member.phone}
                      </a>
                    )}
                    {!member.phone && member.is_me && (
                      <p className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 italic">
                        <Phone className="w-3.5 h-3.5" />
                        No phone number on file
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Submission Status Section */}
        <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-500" />
              Submission Status
            </h2>
            {submission && (
              <button
                onClick={() => router.push(`/student/projects/${project.id}`)}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                View Full Details
              </button>
            )}
          </div>
          <div className="p-6">
            {submission ? (
              <div className="space-y-4">
                {/* Submission Info Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Submitted
                    </p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {submission.submitted_at
                        ? new Date(submission.submitted_at).toLocaleDateString('en-US', {
                            month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                          })
                        : 'Not yet submitted'}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Due Date
                    </p>
                    <p className={`font-medium ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                      {dueDate
                        ? dueDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                        : 'No due date'}
                      {isOverdue && submission && !submission.submitted && (
                        <span className="text-xs text-red-500 ml-2 font-semibold">(Overdue!)</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Grade Display */}
                {submission.grade != null && (
                  <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Award className="w-5 h-5 text-green-600" />
                        <span className="font-semibold text-green-800 dark:text-green-300">Grade</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-green-700 dark:text-green-300">
                          {submission.grade}/{project.points_possible}
                        </span>
                        {pct !== null && (
                          <span className={`text-2xl font-bold ${
                            pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {pct >= 90 ? 'A' : pct >= 80 ? 'B' : pct >= 70 ? 'C' : pct >= 60 ? 'D' : 'F'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Feedback Display */}
                {submission.feedback && (
                  <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <MessageSquare className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-1">Instructor Feedback</p>
                        <p className="text-sm text-indigo-700 dark:text-indigo-400">{submission.feedback}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* File Display */}
                {submission.file_path && (
                  <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                    <FileText className="w-5 h-5 text-gray-400" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{submission.file_name || 'Submitted file'}</span>
                    {submission.file_path && (
                      <a
                        href={submission.file_path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        View
                      </a>
                    )}
                  </div>
                )}

                {/* Submit Button if not yet submitted or needs revision */}
                {(!submission.submitted || submission.needs_revision) && (
                  <button
                    onClick={() => router.push(`/student/projects/${project.id}`)}
                    className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                  >
                    <Send className="w-4 h-4" />
                    {submission.needs_revision ? 'Resubmit Project' : 'Submit Project'}
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="w-14 h-14 mx-auto bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mb-3">
                  <FileText className="w-7 h-7 text-yellow-500" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Not Submitted Yet</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  Your team hasn't submitted the project yet.
                </p>
                <button
                  onClick={() => router.push(`/student/projects/${project.id}`)}
                  className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors inline-flex items-center gap-2 text-sm font-medium"
                >
                  <Send className="w-4 h-4" />
                  Go to Project Submission
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Project Info Card */}
        <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-pink-500" />
              Project Details
            </h2>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <BookOpen className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{project.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{project.course_title}</p>
                </div>
              </div>
              {enrollment?.cohort_label && (
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-indigo-400 shrink-0" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Cohort: <strong>{enrollment.cohort_label}</strong>
                  </span>
                </div>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => router.push(`/student/projects/${project.id}`)}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View Full Project Details
              </button>
            </div>
          </div>
        </div>

        {/* Collaboration Tips */}
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 border-2 border-indigo-200 dark:border-indigo-800 rounded-2xl p-6">
          <h3 className="font-semibold text-indigo-800 dark:text-indigo-300 flex items-center gap-2 mb-3">
            <Users className="w-5 h-5" />
            Collaboration Tips
          </h3>
          <ul className="space-y-2">
            {[
              'Reach out to your teammates using the contact info above',
              'Divide project tasks among team members based on strengths',
              'Communicate regularly to track progress and help each other',
              'One team member submits the final project on behalf of the team',
              'Make sure all team members contribute before the deadline'
            ].map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-indigo-700 dark:text-indigo-300">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-indigo-400" />
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
