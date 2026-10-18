"use client";

import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '@/lib/api-client';
import InstructorService from '@/services/instructor.service';

interface TeamMember {
  id: number;
  name: string;
  email: string;
  phone?: string;
  is_primary?: boolean;
  joined_at?: string;
}

interface Team {
  submission_id: number;
  primary_student: TeamMember;
  members: TeamMember[];
  created_at: string;
  submitted_at?: string | null;
  team_size?: number;
  status: string;
}

interface UnassignedStudent {
  id: number;
  name: string;
  email: string;
  phone?: string;
  cohort_id?: number | null;
  cohort_label?: string;
  enrollment_date?: string;
}

interface TeamHistoryEntry {
  id: number;
  action: string;
  event_type?: string;
  student_name: string;
  team_number?: number;
  performed_by: string;
  team_size?: number;
  member_names?: string[];
  created_at: string;
  details?: string;
}

interface Cohort {
  id: number | null;
  cohort_label?: string;
  status?: string;
  student_count?: number;
}

interface TeamManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: {
    id: number;
    title: string;
    course_id: number;
    max_team_size: number;
    collaboration_allowed: boolean;
  };
  onTeamsUpdated: () => void;
}

const TEAMS_BASE = (projectId: number) => `/instructor/assessments/projects/${projectId}`;

export default function TeamManagerModal({
  isOpen,
  onClose,
  project,
  onTeamsUpdated
}: TeamManagerModalProps) {
  const [activeTab, setActiveTab] = useState<'teams' | 'history'>('teams');
  const [teams, setTeams] = useState<Team[]>([]);
  const [unassignedStudents, setUnassignedStudents] = useState<UnassignedStudent[]>([]);
  const [teamHistory, setTeamHistory] = useState<TeamHistoryEntry[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingCohorts, setIsLoadingCohorts] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Cohort scoping — assignment is always performed against ONE cohort.
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState<number | null>(null);

  // Auto-assign state. Clamped to the project's configured maximum so the
  // request can never exceed what the backend will accept.
  const maxTeamSize = project.max_team_size || 3;
  const [teamSize, setTeamSize] = useState(maxTeamSize);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);

  // Drag/drop state
  const [draggedStudent, setDraggedStudent] = useState<{ student: TeamMember; fromTeamId: number } | null>(null);
  const [dragOverTeamId, setDragOverTeamId] = useState<number | null>(null);

  // Remove member confirmation
  const [confirmRemove, setConfirmRemove] = useState<{ submissionId: number; memberId: number; memberName: string } | null>(null);

  // Clamp the requested size if the project's max changed since mount.
  useEffect(() => {
    setTeamSize((prev) => Math.min(Math.max(prev, 2), maxTeamSize));
  }, [maxTeamSize]);

  const fetchCohorts = useCallback(async () => {
    setIsLoadingCohorts(true);
    try {
      const data = await InstructorService.getCourseCohorts(project.course_id);
      // Entries with a null id are legacy label-only or unlabelled groups and
      // cannot be used to scope assignment — the backend needs a real window id.
      const usable = (Array.isArray(data) ? data : []).filter(
        (c: Cohort) => typeof c.id === 'number'
      );
      setCohorts(usable);
      setSelectedCohortId((prev) => {
        if (prev !== null && usable.some((c: Cohort) => c.id === prev)) return prev;
        return usable.length > 0 ? usable[0].id : null;
      });
    } catch {
      setCohorts([]);
      setSelectedCohortId(null);
    } finally {
      setIsLoadingCohorts(false);
    }
  }, [project.course_id]);

  const fetchTeams = useCallback(async () => {
    setIsLoadingTeams(true);
    try {
      const response = await apiClient.get(`${TEAMS_BASE(project.id)}/teams`);
      setTeams(response.data.teams || []);
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.message || error.message || 'Failed to load teams');
    } finally {
      setIsLoadingTeams(false);
    }
  }, [project.id]);

  const fetchUnassignedStudents = useCallback(async (cohortId: number | null) => {
    try {
      const params: Record<string, string> = {};
      if (cohortId !== null) params.cohort_id = String(cohortId);
      const response = await apiClient.get(
        `${TEAMS_BASE(project.id)}/unassigned-students`,
        { params }
      );
      setUnassignedStudents(response.data.students || []);
    } catch (error: any) {
      // Surface this instead of swallowing it — an empty list with no message
      // is indistinguishable from "nobody left to assign".
      setErrorMessage(
        error?.response?.data?.message || error.message || 'Failed to load unassigned students'
      );
    }
  }, [project.id]);

  const fetchTeamHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const response = await apiClient.get(`${TEAMS_BASE(project.id)}/team-history`);
      setTeamHistory(response.data.history || []);
    } catch (error: any) {
      setErrorMessage(
        error?.response?.data?.message || error.message || 'Failed to load team history'
      );
    } finally {
      setIsLoadingHistory(false);
    }
  }, [project.id]);

  useEffect(() => {
    if (isOpen) {
      fetchCohorts();
      fetchTeams();
      fetchUnassignedStudents(selectedCohortId);
      fetchTeamHistory();
    }
    // Only re-run when the modal opens or the cohort changes — not on every
    // history refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedCohortId, fetchCohorts, fetchTeams, fetchUnassignedStudents, fetchTeamHistory]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      fetchTeams(),
      fetchUnassignedStudents(selectedCohortId),
      fetchTeamHistory()
    ]);
  }, [fetchTeams, fetchUnassignedStudents, fetchTeamHistory, selectedCohortId]);

  const handleCohortChange = (value: string) => {
    const cohortId = value === '' ? null : parseInt(value, 10);
    setSelectedCohortId(Number.isNaN(cohortId) ? null : cohortId);
    setErrorMessage(null);
  };

  const handleAutoAssign = async () => {
    if (selectedCohortId === null) {
      setErrorMessage('Select a cohort first — teams are formed from students active in one cohort.');
      return;
    }
    const cohort = cohorts.find((c) => c.id === selectedCohortId);
    const cohortLabel = cohort?.cohort_label || `#${selectedCohortId}`;
    if (
      !confirm(
        `Auto-assign teams of ${teamSize} from cohort "${cohortLabel}"?\n\n` +
          `Only students ACTIVE in that cohort are eligible. ` +
          `Existing teams are preserved; only unassigned students are grouped.`
      )
    ) {
      return;
    }

    setIsAutoAssigning(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const response = await apiClient.post(
        `${TEAMS_BASE(project.id)}/assign-teams`,
        { team_size: teamSize, cohort_id: selectedCohortId }
      );
      setSuccessMessage(`✅ ${response.data.message}`);
      await refreshAll();
      onTeamsUpdated();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.message || 'Auto-assign failed');
    } finally {
      setIsAutoAssigning(false);
    }
  };

  const handleReassignMember = async (submissionId: number, memberId: number, targetTeamId: number) => {
    setActionLoading(`reassign-${memberId}`);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const response = await apiClient.post(
        `${TEAMS_BASE(project.id)}/teams/${submissionId}/reassign`,
        { member_id: memberId, target_team_id: targetTeamId }
      );
      setSuccessMessage(`✅ ${response.data.message}`);
      await refreshAll();
      onTeamsUpdated();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.message || 'Reassign failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddUnassignedStudent = async (student: UnassignedStudent, targetTeamId: number) => {
    setActionLoading(`assign-${student.id}`);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const response = await apiClient.post(
        `${TEAMS_BASE(project.id)}/teams/${targetTeamId}/reassign`,
        {
          member_id: student.id,
          target_team_id: targetTeamId,
          is_new_student: true
        }
      );
      const teamNumber = teams.findIndex((t) => t.submission_id === targetTeamId) + 1;
      setSuccessMessage(`✅ ${response.data.message || `${student.name} added to Team ${teamNumber}`}`);
      await refreshAll();
      onTeamsUpdated();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.message || 'Failed to add student');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveMember = async () => {
    if (!confirmRemove) return;
    setActionLoading(`remove-${confirmRemove.memberId}`);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const response = await apiClient.post(
        `${TEAMS_BASE(project.id)}/teams/${confirmRemove.submissionId}/remove-member`,
        { member_id: confirmRemove.memberId }
      );
      setSuccessMessage(`✅ ${response.data.message}`);
      setConfirmRemove(null);
      await refreshAll();
      onTeamsUpdated();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.message || 'Remove failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDragStart = (student: TeamMember, fromTeamId: number) => {
    setDraggedStudent({ student, fromTeamId });
  };

  const handleDragOver = (e: React.DragEvent, teamId: number) => {
    e.preventDefault();
    setDragOverTeamId(teamId);
  };

  const handleDrop = async (e: React.DragEvent, targetTeamId: number) => {
    e.preventDefault();
    setDragOverTeamId(null);
    if (!draggedStudent || draggedStudent.fromTeamId === targetTeamId) {
      setDraggedStudent(null);
      return;
    }
    await handleReassignMember(draggedStudent.fromTeamId, draggedStudent.student.id, targetTeamId);
    setDraggedStudent(null);
  };

  const handleDragEnd = () => {
    setDraggedStudent(null);
    setDragOverTeamId(null);
  };

  const historyIcon = (entry: TeamHistoryEntry) => {
    const type = entry.event_type || entry.action;
    if (type === 'team_assign' || type === 'assign' || entry.action === 'team_created') return '👥';
    if (type === 'team_reassign' || type === 'reassign' || entry.action === 'member_moved') return '🔄';
    if (type === 'team_remove' || type === 'remove' || entry.action === 'member_removed') return '➖';
    return '📝';
  };

  if (!isOpen) return null;

  const totalStudentsInTeams = teams.reduce((sum, t) => sum + t.members.length, 0);
  const totalUnassigned = unassignedStudents.length;
  const selectedCohort = cohorts.find((c) => c.id === selectedCohortId);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
        
        <div className="relative inline-block w-full max-w-4xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 text-left align-middle transition-all transform overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  👥 Team Manager
                </h2>
                <p className="text-indigo-200 text-sm mt-1">
                  {project.title} — Manage teams & members
                </p>
              </div>
              <button onClick={onClose} className="text-white/80 hover:text-white transition-colors text-2xl">&times;</button>
            </div>
          </div>

          {/* Cohort Selector */}
          <div className="bg-indigo-50 dark:bg-indigo-900/20 px-6 py-3 border-b border-indigo-200 dark:border-indigo-800">
            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">
                Cohort:
              </label>
              <select
                value={selectedCohortId === null ? '' : String(selectedCohortId)}
                onChange={(e) => handleCohortChange(e.target.value)}
                disabled={isLoadingCohorts}
                className="px-3 py-1.5 border border-indigo-300 dark:border-indigo-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                <option value="" disabled>
                  {isLoadingCohorts ? 'Loading cohorts…' : 'Select a cohort…'}
                </option>
                {cohorts.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.cohort_label || `Cohort #${c.id}`}
                    {typeof c.student_count === 'number' ? ` (${c.student_count} enrolled)` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-indigo-600 dark:text-indigo-400">
                {selectedCohort
                  ? `Teams are formed from students ACTIVE in "${selectedCohort.cohort_label || `Cohort #${selectedCohort.id}`}"`
                  : 'Select a cohort to see who can be assigned'}
              </p>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="bg-slate-50 dark:bg-slate-700/50 px-6 py-3 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Teams:</span>
                <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{teams.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Students in Teams:</span>
                <span className="text-lg font-bold text-green-600 dark:text-green-400">{totalStudentsInTeams}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Unassigned:</span>
                <span className="text-lg font-bold text-orange-600 dark:text-orange-400">{totalUnassigned}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Max Team Size:</span>
                <span className="text-lg font-bold text-purple-600 dark:text-purple-400">{maxTeamSize}</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab('teams')}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'teams'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              👥 Teams & Members
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'history'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              📋 Assignment History
            </button>
          </div>

          {/* Messages */}
          <div className="px-6 pt-3">
            {errorMessage && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-2.5 rounded-lg flex items-center justify-between mb-3">
                <span className="text-sm font-medium">⚠️ {errorMessage}</span>
                <button onClick={() => setErrorMessage(null)} className="text-red-600 hover:text-red-800">&times;</button>
              </div>
            )}
            {successMessage && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 px-4 py-2.5 rounded-lg flex items-center justify-between mb-3">
                <span className="text-sm font-medium">{successMessage}</span>
                <button onClick={() => setSuccessMessage(null)} className="text-green-600 hover:text-green-800">&times;</button>
              </div>
            )}
          </div>

          <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
            {/* Teams Tab */}
            {activeTab === 'teams' && (
              <div className="space-y-4">
                {/* Auto-Assign Controls */}
                <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">Auto-Assign Teams</h4>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">
                        {selectedCohortId === null
                          ? 'Select a cohort above to enable auto-assign'
                          : `Randomly group ${totalUnassigned} unassigned student${totalUnassigned === 1 ? '' : 's'} from the selected cohort into teams`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Team Size:</label>
                      <input
                        type="number"
                        min={2}
                        max={maxTeamSize}
                        value={teamSize}
                        onChange={(e) =>
                          setTeamSize(Math.min(Math.max(parseInt(e.target.value) || 2, 2), maxTeamSize))
                        }
                        className="w-16 px-2 py-1.5 border border-indigo-300 dark:border-indigo-600 rounded-md text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:text-white"
                      />
                      <button
                        onClick={handleAutoAssign}
                        disabled={isAutoAssigning || totalUnassigned === 0 || selectedCohortId === null}
                        title={
                          selectedCohortId === null
                            ? 'Select a cohort first'
                            : totalUnassigned === 0
                              ? 'No unassigned students in this cohort'
                              : undefined
                        }
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed flex items-center gap-1.5"
                      >
                        {isAutoAssigning ? (
                          <>
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                            Assigning...
                          </>
                        ) : (
                          <>🎲 Auto-Assign</>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Teams Grid */}
                {isLoadingTeams ? (
                  <div className="flex items-center justify-center py-12">
                    <svg className="animate-spin h-8 w-8 text-indigo-500" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                    <span className="ml-3 text-slate-500">Loading teams...</span>
                  </div>
                ) : teams.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-5xl mb-4">👥</div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No Teams Yet</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Select a cohort and use the Auto-Assign button above to create teams from students active in it,{'\n'}
                      or teams will appear here once students are grouped.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {teams.map((team, teamIndex) => {
                      const isFull = team.members.length >= maxTeamSize;
                      return (
                      <div
                        key={team.submission_id}
                        className={`bg-white dark:bg-slate-700 border-2 rounded-xl overflow-hidden transition-all duration-200 ${
                          dragOverTeamId === team.submission_id
                            ? 'border-indigo-400 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 scale-[1.02]'
                            : 'border-slate-200 dark:border-slate-600 hover:shadow-md'
                        }`}
                        onDragOver={(e) => handleDragOver(e, team.submission_id)}
                        onDragLeave={() => setDragOverTeamId(null)}
                        onDrop={(e) => handleDrop(e, team.submission_id)}
                      >
                        {/* Team Header */}
                        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-bold text-sm">Team {teamIndex + 1}</span>
                            <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
                              {team.members.length} member{team.members.length !== 1 ? 's' : ''}
                              {isFull ? ' · full' : ''}
                            </span>
                          </div>
                          <span className="text-white/70 text-xs">
                            {team.created_at ? new Date(team.created_at).toLocaleDateString() : ''}
                          </span>
                        </div>

                        {/* Team Members */}
                        <div className="p-3 space-y-2">
                          {team.members.map((member) => (
                            <div
                              key={member.id}
                              draggable
                              onDragStart={() => handleDragStart(member, team.submission_id)}
                              onDragEnd={handleDragEnd}
                              className={`flex items-center justify-between p-2.5 rounded-lg cursor-grab active:cursor-grabbing transition-all ${
                                draggedStudent?.student.id === member.id
                                  ? 'opacity-50 bg-indigo-50 dark:bg-indigo-900/30'
                                  : 'bg-slate-50 dark:bg-slate-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
                              } border border-slate-200 dark:border-slate-500`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                  {member.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                      {member.name}
                                    </span>
                                    {member.is_primary && (
                                      <span className="text-[10px] bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 px-1.5 py-0.5 rounded font-medium">
                                        Lead
                                      </span>
                                    )}
                                    {draggedStudent && (
                                      <span className="text-[10px] text-indigo-500 font-medium">(drag to move)</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                    <span>{member.email}</span>
                                    {member.phone && <span>&bull; {member.phone}</span>}
                                  </div>
                                </div>
                              </div>

                              {/* Reassign Dropdown */}
                              <div className="flex items-center gap-1 shrink-0 ml-2">
                                {teams.length > 1 && (
                                  <select
                                    value=""
                                    onChange={(e) => {
                                      if (e.target.value) {
                                        handleReassignMember(team.submission_id, member.id, parseInt(e.target.value));
                                        e.target.value = '';
                                      }
                                    }}
                                    disabled={!!actionLoading}
                                    className="text-xs px-1.5 py-1 border border-slate-300 dark:border-slate-500 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-700 dark:text-white bg-transparent disabled:opacity-50"
                                    title={isFull ? `This team is at the maximum size of ${maxTeamSize}` : 'Move to team...'}
                                  >
                                    <option value="">⇄ Move</option>
                                    {teams
                                      .filter((t) => t.submission_id !== team.submission_id)
                                      .map((t) => (
                                        <option key={t.submission_id} value={t.submission_id}>
                                          Team {teams.findIndex((t2) => t2.submission_id === t.submission_id) + 1}
                                          {t.members.length >= maxTeamSize ? ' (full)' : ''}
                                        </option>
                                      ))}
                                  </select>
                                )}
                                <button
                                  onClick={() => setConfirmRemove({ submissionId: team.submission_id, memberId: member.id, memberName: member.name })}
                                  disabled={!!actionLoading}
                                  className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                                  title="Remove from team"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Drop Zone Hint */}
                        <div className={`border-t border-dashed py-2 text-center text-xs transition-colors ${
                          dragOverTeamId === team.submission_id
                            ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                            : 'border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-500'
                        }`}>
                          {dragOverTeamId === team.submission_id ? '📥 Drop student here' : '⬡ Drag & drop students between teams'}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}

                {/* Unassigned Students Section */}
                {unassignedStudents.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                      Unassigned Students ({unassignedStudents.length})
                      {selectedCohort && (
                        <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                          in {selectedCohort.cohort_label || `Cohort #${selectedCohort.id}`}
                        </span>
                      )}
                    </h4>
                    <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-xl overflow-hidden">
                      <div className="divide-y divide-orange-100 dark:divide-orange-800/50">
                        {unassignedStudents.map((student) => (
                          <div key={student.id} className="flex items-center justify-between px-4 py-2.5">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-full bg-orange-400 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                {student.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <span className="text-sm font-medium text-slate-900 dark:text-white">{student.name}</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">{student.email}</span>
                                {student.cohort_label && (
                                  <span className="text-xs text-orange-600 dark:text-orange-400 ml-2">
                                    {student.cohort_label}
                                  </span>
                                )}
                              </div>
                            </div>
                            {teams.length > 0 && (
                              <select
                                value=""
                                disabled={!!actionLoading}
                                onChange={async (e) => {
                                  if (e.target.value) {
                                    const targetTeamId = parseInt(e.target.value, 10);
                                    await handleAddUnassignedStudent(student, targetTeamId);
                                    e.target.value = '';
                                  }
                                }}
                                className="text-xs px-2 py-1 border border-orange-300 dark:border-orange-600 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 dark:bg-slate-700 dark:text-white bg-white disabled:opacity-50"
                              >
                                <option value="">➕ Add to team...</option>
                                {teams.map((t, i) => (
                                  <option key={t.submission_id} value={t.submission_id}>
                                    Team {i + 1} ({t.members.length} member{t.members.length !== 1 ? 's' : ''}{t.members.length >= maxTeamSize ? ', full' : ''})
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div>
                {isLoadingHistory ? (
                  <div className="flex items-center justify-center py-12">
                    <svg className="animate-spin h-8 w-8 text-indigo-500" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                    <span className="ml-3 text-slate-500">Loading history...</span>
                  </div>
                ) : teamHistory.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-5xl mb-4">📋</div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No History Yet</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Team assignment actions will be recorded here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {teamHistory.map((entry) => (
                      <div key={`${entry.id}-${entry.action}`} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-sm shrink-0">
                          {historyIcon(entry)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-slate-900 dark:text-white">
                              {entry.details || entry.action.replace(/_/g, ' ')}
                            </span>
                            <span className="text-xs text-slate-400 shrink-0">
                              {entry.created_at ? new Date(entry.created_at).toLocaleString() : ''}
                            </span>
                          </div>
                          {entry.member_names && entry.member_names.length > 0 && (
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {entry.member_names.join(', ')}
                            </div>
                          )}
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            by {entry.performed_by}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-slate-50 dark:bg-slate-700/50 px-6 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              💡 Drag &amp; drop students between teams to reassign, or use dropdown to move members
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Remove */}
      {confirmRemove && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setConfirmRemove(null)} />
          <div className="relative bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Remove Member</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Remove <strong>{confirmRemove.memberName}</strong> from this team? They will become unassigned and can be added to another team.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmRemove(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveMember}
                disabled={!!actionLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {actionLoading === `remove-${confirmRemove.memberId}` ? (
                  <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg> Removing...</>
                ) : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
