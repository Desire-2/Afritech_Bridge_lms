"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';
import SubmissionFileManager from '@/components/SubmissionFileManager';
import GradingService, { SubmissionDetail, FeedbackTemplate } from '@/services/grading.service';
import { EnhancedFileService } from '@/services/enhanced-file.service';
import { parseFileInfo } from '@/utils/fileUtils';
import { RequestModificationModal } from '@/components/grading/RequestModificationModal';
import { CommentBankPanel } from '@/components/grading/CommentBankPanel';
import { RubricGradingPanel } from '@/components/grading/RubricGradingPanel';
import ExcelAIGradingButton from '@/components/grading/ExcelAIGradingButton';
import {
  FileText, User, Calendar, Clock, BookOpen, ExternalLink, Star,
  MessageSquare, History, AlertTriangle, CheckCircle, Eye, Award, Target,
  Info, Users, Layers, RefreshCw, AlertCircle, Save, Sparkles,
  FileBarChart, ArrowLeft, ChevronDown, ChevronUp, Hash, Mail, Bot,
  RotateCcw, Send, CircleCheck, XCircle
} from 'lucide-react';

// ═════════════════════════════════════════════════════
//  CONSTANTS
// ═════════════════════════════════════════════════════
const AUTO_REFRESH_INTERVAL = 20_000;
const AUTO_SAVE_INTERVAL = 30_000;
const QUICK_GRADES = [100, 90, 80, 70, 60, 50];

// ═════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═════════════════════════════════════════════════════
const ProjectGradingDetail = () => {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuth();
  const submissionId = parseInt(params.id as string);
  const feedbackRef = useRef<HTMLTextAreaElement>(null);

  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [templates, setTemplates] = useState<FeedbackTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [grade, setGrade] = useState<string>('');
  const [feedback, setFeedback] = useState<string>('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showModificationModal, setShowModificationModal] = useState(false);
  const [maxResubmissions, setMaxResubmissions] = useState<string>('');

  const [showCommentBank, setShowCommentBank] = useState(false);
  const [showRubricPanel, setShowRubricPanel] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [rubricScores, setRubricScores] = useState<Record<string, number>>({});

  const [showDescription, setShowDescription] = useState(false);
  const [showObjectives, setShowObjectives] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ═════════════════════════════════════════════════════
  //  HELPERS
  // ═════════════════════════════════════════════════════

  const getStudentName = () => {
    if (!submission?.student_info) return 'N/A';
    return submission.student_info.name ||
      `${submission.student_info.first_name || ''} ${submission.student_info.last_name || ''}`.trim() ||
      'N/A';
  };

  const getStudentInitials = () => {
    const name = getStudentName();
    if (name === 'N/A') return 'NA';
    return name.split(' ').map(n => n[0] || '').join('').substring(0, 2).toUpperCase();
  };

  const passingScore = submission?.project?.passing_score ?? 60;
  const maxPoints = submission?.project_points || 100;

  const calculatePercentage = (val?: string) => {
    const v = val ?? grade;
    if (!v || !maxPoints) return 0;
    const n = parseFloat(v);
    return isNaN(n) ? 0 : (n / maxPoints) * 100;
  };

  const getGradeColor = (pct: number) => {
    if (pct >= 80) return { bg: 'bg-green-500', text: 'text-green-600 dark:text-green-400', badge: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' };
    if (pct >= 70) return { bg: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400', badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' };
    if (pct >= passingScore) return { bg: 'bg-yellow-500', text: 'text-yellow-600 dark:text-yellow-400', badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' };
    return { bg: 'bg-red-500', text: 'text-red-600 dark:text-red-400', badge: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' };
  };

  const isModificationRequested = submission?.project?.modification_requested;
  const isAIGraded = submission?.graded_by === null && submission?.grade !== undefined && submission?.grade !== null;
  const hasExistingGrade = submission?.grade !== undefined && submission?.grade !== null;

  // ═════════════════════════════════════════════════════
  //  DATA FETCHING
  // ═════════════════════════════════════════════════════

  const fetchSubmission = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setIsRefreshing(true);
    try {
      const data = await GradingService.getProjectSubmissionDetail(submissionId);
      setSubmission(data);
      if (!silent) {
        if (data.grade !== undefined && data.grade !== null) {
          setGrade(data.grade.toString());
          setFeedback(data.feedback || '');
        }
        if (data.project?.max_resubmissions !== undefined) {
          setMaxResubmissions(data.project.max_resubmissions.toString());
        }
      }
    } catch (err: any) {
      if (!silent) setError(err.message || 'Failed to load submission');
    } finally {
      if (!silent) setLoading(false);
      setIsRefreshing(false);
    }
  }, [submissionId]);

  const fetchTemplates = async () => {
    try {
      const data = await GradingService.getFeedbackTemplates();
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  useEffect(() => {
    if (token && submissionId) { fetchSubmission(); fetchTemplates(); }
  }, [token, submissionId, fetchSubmission]);

  useEffect(() => {
    if (!token || !submissionId) return;
    const interval = setInterval(() => fetchSubmission(true), AUTO_REFRESH_INTERVAL);
    const handleVisibility = () => { if (document.visibilityState === 'visible') fetchSubmission(true); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', handleVisibility); };
  }, [token, submissionId, fetchSubmission]);

  // ═════════════════════════════════════════════════════
  //  GRADING
  // ═════════════════════════════════════════════════════

  const handleSubmitGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submission) return;
    const gradeValue = parseFloat(grade);
    if (isNaN(gradeValue) || gradeValue < 0 || gradeValue > maxPoints) {
      setError(`Grade must be between 0 and ${maxPoints}`); return;
    }
    setGrading(true); setError(null); setSuccessMsg(null);
    try {
      const resubLimit = maxResubmissions ? parseInt(maxResubmissions) : undefined;
      if (hasExistingGrade) {
        await GradingService.updateProjectGrade(submissionId, { grade: gradeValue, feedback, max_resubmissions: resubLimit });
      } else {
        await GradingService.gradeProject(submissionId, { grade: gradeValue, feedback, max_resubmissions: resubLimit });
      }
      localStorage.removeItem(`grading_draft_project_${submissionId}`);
      setSuccessMsg(`Grade ${hasExistingGrade ? 'updated' : 'submitted'} successfully! Redirecting...`);
      setTimeout(() => router.push('/instructor/grading?status=graded&type=project'), 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to submit grade');
    } finally { setGrading(false); }
  };

  const applyTemplate = (template: FeedbackTemplate) => { setFeedback(template.content); setShowTemplates(false); };
  const applyQuickGrade = (pct: number) => { const val = Math.round((pct / 100) * maxPoints * 10) / 10; setGrade(val.toString()); };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && grade && !grading) {
        e.preventDefault();
        const form = document.getElementById('grading-form') as HTMLFormElement;
        form?.requestSubmit();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [grade, grading]);

  // ═════════════════════════════════════════════════════
  //  AUTO-SAVE
  // ═════════════════════════════════════════════════════

  const autoSaveDraft = useCallback(async () => {
    if (!grade && !feedback) return;
    setAutoSaving(true);
    try {
      localStorage.setItem(`grading_draft_project_${submissionId}`, JSON.stringify({
        grade, feedback, rubricScores, timestamp: new Date().toISOString()
      }));
      setLastSaved(new Date());
    } catch { /* ignore */ } finally { setAutoSaving(false); }
  }, [grade, feedback, rubricScores, submissionId]);

  useEffect(() => {
    const saved = localStorage.getItem(`grading_draft_project_${submissionId}`);
    if (saved && !grade && !feedback) {
      try { const d = JSON.parse(saved); setGrade(d.grade || ''); setFeedback(d.feedback || ''); setRubricScores(d.rubricScores || {}); } catch { /* ignore */ }
    }
  }, [submissionId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { const iv = setInterval(autoSaveDraft, AUTO_SAVE_INTERVAL); return () => clearInterval(iv); }, [autoSaveDraft]);

  const handleCommentSelect = (comment: string) => { setFeedback(prev => prev ? `${prev}\n\n${comment}` : comment); feedbackRef.current?.focus(); };
  const handleRubricApply = (totalScore: number, scores: Record<string, number>) => { setGrade(totalScore.toString()); setRubricScores(scores); };

  // ═════════════════════════════════════════════════════
  //  LOADING / ERROR STATES
  // ═════════════════════════════════════════════════════

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="relative">
          <div className="animate-spin rounded-full h-14 w-14 border-t-4 border-b-4 border-purple-500" />
          <Layers className="absolute inset-0 m-auto w-6 h-6 text-purple-500" />
        </div>
        <h3 className="mt-6 text-lg font-semibold text-slate-900 dark:text-white">Loading Submission</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Fetching project details...</p>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="text-center py-20 max-w-md mx-auto">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Submission Not Found</h3>
        <p className="text-slate-600 dark:text-slate-400 mb-6">Could not find this submission or you lack permission to view it.</p>
        <button onClick={() => router.back()} className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" /> Go Back
        </button>
      </div>
    );
  }

  const pct = calculatePercentage();
  const colors = getGradeColor(pct);

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6 space-y-4">
      {/* HEADER */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-3 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-600 flex-shrink-0" />
                <span className="truncate max-w-[300px] sm:max-w-none">{submission.project_title}</span>
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-slate-500 dark:text-slate-400">
                <span>{submission.course_title}</span>
                <span className="hidden sm:inline">&middot;</span>
                <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{getStudentName()}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isRefreshing && <span className="text-xs text-purple-500 flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin" /> Syncing...</span>}
            {submission.is_resubmission && <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400"><RotateCcw className="w-3 h-3 mr-1" /> Resubmission #{submission.resubmission_count || 1}</span>}
            {isModificationRequested && <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400"><AlertCircle className="w-3 h-3 mr-1" /> Modification Requested</span>}
            {isAIGraded && <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400"><Bot className="w-3 h-3 mr-1" /> AI Graded</span>}
            {submission.project?.collaboration_allowed && <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"><Users className="w-3 h-3 mr-1" /> Team Project</span>}
            {submission.days_late === 0 ? <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"><CheckCircle className="w-3 h-3 mr-1" /> On Time</span>
            : submission.days_late > 0 ? <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"><AlertTriangle className="w-3 h-3 mr-1" /> {submission.days_late}d Late</span> : null}
          </div>
        </div>
      </div>

      {/* MODIFICATION REQUEST BANNER */}
      {isModificationRequested && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-800/30 rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-amber-800 dark:text-amber-300 text-sm">Modification Requested</h3>
              {submission.project?.modification_request_reason && (
                <div className="mt-1.5 text-sm text-amber-700 dark:text-amber-400">
                  <MarkdownRenderer content={submission.project.modification_request_reason} variant="card" className="prose-amber text-sm" />
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-amber-600 dark:text-amber-500">
                {submission.project?.modification_requested_at && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(submission.project.modification_requested_at).toLocaleString()}</span>}
                {submission.project?.can_resubmit && <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Student can resubmit</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ALERTS */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-lg flex items-center gap-2">
          <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600"><XCircle className="w-4 h-4" /></button>
        </div>
      )}
      {successMsg && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 rounded-lg flex items-center gap-2 animate-in fade-in">
          <CircleCheck className="w-4 h-4 text-green-500 flex-shrink-0" />
          <p className="text-sm text-green-600 dark:text-green-400 font-medium">{successMsg}</p>
        </div>
      )}

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-2 space-y-4">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">Points</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{maxPoints}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">Pass Threshold</p>
              <p className="text-xl font-bold text-purple-600 dark:text-purple-400">{passingScore}%</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">Submitted</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{new Date(submission.submitted_at).toLocaleDateString()}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">Format</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white capitalize">{submission.project?.submission_format?.replace('_', ' ') || 'Mixed'}</p>
            </div>
          </div>

          {/* Project Description (Collapsible) */}
          {submission.project?.description && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <button onClick={() => setShowDescription(!showDescription)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300"><Info className="w-4 h-4 text-slate-500" /> Project Description</span>
                {showDescription ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              {showDescription && (
                <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-700">
                  <div className="mt-3 bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                    <MarkdownRenderer content={submission.project.description} variant="card" className="prose-slate text-sm" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Project Objectives (Collapsible) */}
          {submission.project?.objectives && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <button onClick={() => setShowObjectives(!showObjectives)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300"><Target className="w-4 h-4 text-purple-500" /> Project Objectives</span>
                {showObjectives ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              {showObjectives && (
                <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-700">
                  <div className="mt-3 bg-purple-50 dark:bg-purple-900/10 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                    <MarkdownRenderer content={submission.project.objectives} variant="card" className="prose-purple text-sm" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Covered Modules */}
          {submission.project?.modules && submission.project.modules.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Covered Modules</span>
                <span className="bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full text-[10px] font-medium">{submission.project.modules.length}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {submission.project.modules.map((module: any) => (
                  <span key={module.id} className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg text-xs font-medium border border-blue-200 dark:border-blue-800">{module.title}</span>
                ))}
              </div>
            </div>
          )}

          {/* Student Submission Content */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 to-indigo-600 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><FileText className="w-5 h-5 text-white" /><h3 className="text-base font-bold text-white">Student Submission</h3></div>
                <div className="flex items-center gap-2">
                  {submission.files_count !== undefined && submission.files_count > 0 && <span className="bg-white/20 text-white px-2 py-0.5 rounded-full text-xs font-medium">{submission.files_count} file{submission.files_count > 1 ? 's' : ''}</span>}
                  {submission.submission_status?.is_first === false && <span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full text-xs font-medium">Resubmission</span>}
                </div>
              </div>
            </div>
            <div className="p-4">
              {/* Submission Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="flex items-center gap-2.5 text-sm">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">Submitted</p>
                    <p className="font-medium text-slate-700 dark:text-slate-200">{new Date(submission.submitted_at).toLocaleString()}</p>
                  </div>
                </div>
                {submission.due_date && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">Due Date</p>
                      <p className={`font-medium ${submission.days_late > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}`}>{new Date(submission.due_date).toLocaleDateString()}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2.5 text-sm">
                  <RefreshCw className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">Attempt</p>
                    <p className="font-medium text-slate-700 dark:text-slate-200">{submission.submission_status?.is_first ? 'First attempt' : `Resubmission #${submission.submission_status?.count || submission.resubmission_count || 1}`}</p>
                  </div>
                </div>
              </div>

              {/* Resubmission Notes */}
              {submission.submission_status && !submission.submission_status.is_first && (submission.submission_status.notes || submission.submission_notes) && (
                <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-orange-800 dark:text-orange-300">Student&apos;s Resubmission Note</p>
                      <p className="text-sm text-orange-700 dark:text-orange-400 mt-0.5">{submission.submission_status.notes || submission.submission_notes}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Team Members */}
              {submission.team_members_info && submission.team_members_info.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Team Members</h4>
                  <div className="flex flex-wrap gap-2">
                    {submission.team_members_info.map((member) => (
                      <div key={member.id} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-[10px] font-bold">{member.name.split(' ').map(n => n[0]).join('').substring(0, 2)}</span>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-900 dark:text-white">{member.name}</p>
                          <p className="text-[10px] text-slate-500">{member.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Text Content */}
              {(submission.content || submission.text_content) && (
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Text Response</h4>
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700 max-h-[400px] overflow-y-auto">
                    <MarkdownRenderer content={submission.content || submission.text_content || ''} variant="card" className="prose-slate text-sm" />
                  </div>
                </div>
              )}

              {/* External URL */}
              {submission.external_url && (
                <div className="mb-4">
                  <a href={submission.external_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-sm font-medium">
                    <ExternalLink className="w-4 h-4" /> View External Submission
                  </a>
                </div>
              )}

              {/* File Manager */}
              <SubmissionFileManager
                files={(submission.files && Array.isArray(submission.files) && submission.files.length > 0)
                  ? submission.files.map((file: any, index: number) => {
                      const filename = file.filename || file.original_filename || 'Unknown File';
                      return { id: `file-${index}`, filename, file_url: file.url, file_size: file.size || 0, uploaded_at: file.uploadedAt || submission.submitted_at, fileInfo: parseFileInfo(filename, file.size) };
                    })
                  : (submission.file_url || submission.file_path ? [{
                      id: 'main-file', filename: submission.file_name || submission.original_filename || 'Project File',
                      file_url: submission.file_url || submission.file_path || '', file_size: 0,
                      uploaded_at: submission.submitted_at, fileInfo: parseFileInfo(submission.file_name || submission.original_filename || 'Project File')
                    }] : [])
                }
                submissionId={submissionId}
                studentName={getStudentName()}
                onDownloadSingle={async (fileId) => {
                  try {
                    let file: any = null;
                    if (submission.files && Array.isArray(submission.files)) {
                      const idx = parseInt(fileId.replace('file-', ''));
                      if (!isNaN(idx) && submission.files[idx]) {
                        const src = submission.files[idx] as any;
                        file = { id: fileId, filename: src.filename || 'Unknown', file_url: src.url, file_size: src.size || 0, uploaded_at: src.uploadedAt || submission.submitted_at };
                      }
                    }
                    if (!file && fileId === 'main-file') {
                      const url = submission.file_url || submission.file_path;
                      if (url) file = { id: 'main-file', filename: submission.file_name || submission.original_filename || 'Project File', file_url: url, file_size: 0, uploaded_at: submission.submitted_at };
                    }
                    if (file?.file_url) {
                      const { blob, filename } = await EnhancedFileService.downloadSingleFile(file.file_url, file.filename);
                      EnhancedFileService.triggerFileDownload(blob, filename);
                    } else { alert('File not found or URL missing'); }
                  } catch (err) { alert(`Download failed: ${err instanceof Error ? err.message : 'Unknown error'}`); }
                }}
                onDownloadAll={() => {
                  EnhancedFileService.downloadSubmissionFiles(submissionId)
                    .then(({ blob, filename }) => EnhancedFileService.triggerFileDownload(blob, filename))
                    .catch(err => console.error('Download all failed:', err));
                }}
                onAddFileComment={(fileId, comment) => {
                  EnhancedFileService.addFileComment({ file_id: fileId, comment_text: comment, submission_id: submissionId, is_private: false })
                    .catch(err => console.error('Failed to add comment:', err));
                }}
                allowComments={true}
                allowDownload={true}
              />
            </div>
          </div>

          {/* GRADING FORM */}
          <form id="grading-form" onSubmit={handleSubmitGrade} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><Award className="w-5 h-5 text-white" /><h3 className="text-base font-bold text-white">{hasExistingGrade ? 'Update Grade' : 'Submit Grade'}</h3></div>
                <div className="flex items-center gap-3">
                  {lastSaved && <span className="text-white/70 text-xs flex items-center gap-1"><Save className="w-3 h-3" /> {lastSaved.toLocaleTimeString()}</span>}
                  <span className="text-white/60 text-[10px]">Ctrl+Enter to submit</span>
                </div>
              </div>
            </div>
            <div className="p-4 space-y-5">
              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2 pb-4 border-b border-slate-200 dark:border-slate-700">
                <button type="button" onClick={() => setShowRubricPanel(!showRubricPanel)} className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showRubricPanel ? 'bg-purple-600 text-white' : 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/30'}`}><FileBarChart className="w-3.5 h-3.5 mr-1.5" /> Rubric</button>
                <button type="button" onClick={() => setShowCommentBank(!showCommentBank)} className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showCommentBank ? 'bg-blue-600 text-white' : 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/30'}`}><MessageSquare className="w-3.5 h-3.5 mr-1.5" /> Comments</button>
                <button type="button" onClick={autoSaveDraft} disabled={autoSaving} className="flex items-center px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"><Save className="w-3.5 h-3.5 mr-1.5" /> {autoSaving ? 'Saving...' : 'Save Draft'}</button>
              </div>

              {showRubricPanel && (
                <div className="border border-purple-200 dark:border-purple-800 rounded-lg p-4 bg-purple-50 dark:bg-purple-900/10">
                  <RubricGradingPanel projectId={submission.project?.id} maxPoints={maxPoints} onApplyScores={handleRubricApply} initialScores={rubricScores} />
                </div>
              )}

              {/* Grade Input */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Grade <span className="font-normal text-slate-400">/ {maxPoints} pts</span></label>
                  {grade && !isNaN(parseFloat(grade)) && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className={`font-bold ${colors.text}`}>{pct.toFixed(1)}%</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${colors.badge}`}>{GradingService.getLetterGrade(pct)}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-3 items-start">
                  <div className="flex-1 relative">
                    <input type="number" value={grade} onChange={(e) => setGrade(e.target.value)} min="0" max={maxPoints} step="0.1" className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500 text-lg font-bold" placeholder="0" />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">/{maxPoints}</div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {QUICK_GRADES.map(p => (
                      <button key={p} type="button" onClick={() => applyQuickGrade(p)} className={`px-2 py-1.5 rounded-md text-xs font-semibold transition-colors border ${Math.round(calculatePercentage()) === p ? 'bg-green-600 text-white border-green-600' : p >= passingScore ? 'bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-100' : 'bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-100'}`}>{p}%</button>
                    ))}
                  </div>
                </div>
                {grade && !isNaN(parseFloat(grade)) && (
                  <div className="mt-3">
                    <div className="relative h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-visible">
                      <div className={`absolute top-0 left-0 h-full rounded-full transition-all duration-300 ${colors.bg}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                      <div className="absolute top-0 h-full w-0.5 bg-slate-900 dark:bg-white z-10" style={{ left: `${passingScore}%` }} title={`Passing: ${passingScore}%`} />
                      <div className="absolute -top-5 text-[9px] font-semibold text-slate-500 dark:text-slate-400 -translate-x-1/2" style={{ left: `${passingScore}%` }}>Pass {passingScore}%</div>
                    </div>
                    {pct < passingScore && <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Below passing threshold — modification will be auto-requested on submit</p>}
                  </div>
                )}
              </div>

              {showCommentBank && (
                <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/10">
                  <CommentBankPanel onSelectComment={handleCommentSelect} currentFeedback={feedback} />
                </div>
              )}

              {/* Max Resubmissions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Max Resubmissions</label>
                  <span className="text-xs text-slate-400">Used: {submission.submission_status?.count || submission.resubmission_count || 0} / {maxResubmissions || '3'}</span>
                </div>
                <input type="number" value={maxResubmissions} onChange={(e) => setMaxResubmissions(e.target.value)} min="0" max="20" step="1" className="w-28 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500 text-sm" placeholder="3" />
              </div>

              {/* Feedback */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Feedback</label>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">{feedback.length} chars</span>
                    {templates.length > 0 && (
                      <div className="relative">
                        <button type="button" onClick={() => setShowTemplates(!showTemplates)} className="flex items-center px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"><Eye className="w-3 h-3 mr-1" /> Templates</button>
                        {showTemplates && (
                          <div className="absolute right-0 top-8 w-64 bg-white dark:bg-slate-700 rounded-lg shadow-xl border border-slate-200 dark:border-slate-600 z-20 max-h-48 overflow-y-auto">
                            {templates.map(t => (
                              <button key={t.id} type="button" onClick={() => applyTemplate(t)} className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-600">
                                <div className="font-medium text-slate-900 dark:text-white">{t.name}</div>
                                <div className="text-slate-500 text-xs mt-0.5 line-clamp-2">{t.content}</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <textarea ref={feedbackRef} value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={5} className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm" placeholder="Provide detailed feedback on the project..." />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button type="submit" disabled={grading || !grade} className="flex-1 flex items-center justify-center px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold text-sm shadow-sm">
                  {grading ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" /> Submitting...</> : <><Send className="w-4 h-4 mr-2" /> {hasExistingGrade ? 'Update Grade' : 'Submit Grade'}</>}
                </button>
                <button type="button" onClick={() => setShowModificationModal(true)} className="flex items-center justify-center px-4 py-3 border border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors font-medium text-sm">
                  <RotateCcw className="w-4 h-4 mr-2" /> Request Modification
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* RIGHT COLUMN (Sidebar) */}
        <div className="space-y-4">
          {/* Student Info */}
          {submission.student_info && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2"><User className="w-4 h-4" />{submission.team_members_info && submission.team_members_info.length > 0 ? 'Team Lead' : 'Student'}</h3>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold">{getStudentInitials()}</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">{getStudentName()}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">@{submission.student_info.username || 'N/A'}</p>
                  </div>
                </div>
                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center gap-2.5"><Mail className="w-4 h-4 text-slate-400" /><span className="text-slate-600 dark:text-slate-300 truncate">{submission.student_info.email || 'N/A'}</span></div>
                  <div className="flex items-center gap-2.5"><Hash className="w-4 h-4 text-slate-400" /><span className="text-slate-600 dark:text-slate-300">ID: {submission.student_info.id}</span></div>
                </div>
              </div>
            </div>
          )}

          {/* AI Excel Grading */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2"><Sparkles className="w-4 h-4" /> AI Excel Grading</h3>
              <p className="text-purple-200 text-[10px] mt-0.5">Automated analysis for Excel submissions</p>
            </div>
            <div className="p-4">
              <ExcelAIGradingButton submissionId={submissionId} submissionType="project" onGradingComplete={(aiResult) => {
                if (aiResult.total_score != null && !grade) setGrade(aiResult.total_score.toString());
                if (aiResult.overall_feedback && !feedback) setFeedback(aiResult.overall_feedback);
                fetchSubmission(true);
              }} />
            </div>
          </div>

          {/* Current Grade */}
          {hasExistingGrade && submission.project_points && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="bg-gradient-to-r from-yellow-500 to-orange-500 px-4 py-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2"><Star className="w-4 h-4" /> Current Grade</h3>
              </div>
              <div className="p-4">
                <div className="text-center">
                  {(() => {
                    const currentPct = GradingService.calculatePercentage(submission.grade!, submission.project_points);
                    const currentColors = getGradeColor(currentPct);
                    const letter = GradingService.getLetterGrade(currentPct);
                    return (<>
                      <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full ${currentColors.bg} mb-3`}>
                        <div className="text-center"><p className="text-lg font-bold text-white leading-tight">{submission.grade}</p><p className="text-[10px] text-white/80">/ {submission.project_points}</p></div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xl font-bold text-slate-900 dark:text-white">{currentPct.toFixed(1)}%</p>
                        <span className={`inline-block px-3 py-0.5 rounded-full text-sm font-semibold ${currentColors.badge}`}>Grade: {letter}</span>
                        {currentPct < passingScore && <p className="text-xs text-red-500 flex items-center justify-center gap-1 mt-1"><XCircle className="w-3 h-3" /> Below passing ({passingScore}%)</p>}
                      </div>
                    </>);
                  })()}
                </div>
                {isAIGraded && <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700"><div className="flex items-center justify-center gap-1.5 text-xs text-purple-600 dark:text-purple-400"><Bot className="w-3.5 h-3.5" /><span className="font-medium">AI Auto-Graded</span></div></div>}
                {submission.graded_at && <div className={`${isAIGraded ? 'mt-1' : 'mt-3 pt-3 border-t border-slate-200 dark:border-slate-700'} text-center`}><p className="text-[10px] text-slate-400 flex items-center justify-center gap-1"><Clock className="w-3 h-3" /> {new Date(submission.graded_at).toLocaleString()}</p></div>}
                {submission.feedback && (
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-1.5 mb-2"><MessageSquare className="w-3.5 h-3.5 text-blue-500" /><span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Feedback</span></div>
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 max-h-40 overflow-y-auto">
                      <MarkdownRenderer content={submission.feedback} variant="card" className="prose-slate text-xs" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Previous Attempts */}
          {submission.previous_attempts && submission.previous_attempts.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="bg-gradient-to-r from-slate-600 to-slate-700 px-4 py-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2"><History className="w-4 h-4" /> Previous Attempts</h3>
                  <span className="bg-white/20 text-white px-2 py-0.5 rounded-full text-[10px] font-medium">{submission.previous_attempts.length}</span>
                </div>
              </div>
              <div className="p-3 space-y-2">
                {submission.previous_attempts.map((attempt: any, index: number) => (
                  <div key={attempt.id} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                        <span className="text-purple-600 dark:text-purple-400 text-xs font-bold">#{submission.previous_attempts!.length - index}</span>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-200">Attempt {submission.previous_attempts!.length - index}</p>
                        <p className="text-[10px] text-slate-400">{new Date(attempt.submitted_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {attempt.grade !== undefined ? (<><span className="font-bold text-sm text-slate-900 dark:text-white">{attempt.grade}/{maxPoints}</span><p className="text-[10px] text-slate-400">{GradingService.calculatePercentage(attempt.grade, maxPoints).toFixed(0)}%</p></>) : <span className="text-xs text-slate-400 italic">Pending</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Project Details Card */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-4 py-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2"><Layers className="w-4 h-4" /> Project Details</h3>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Points Possible</span><span className="font-semibold text-slate-900 dark:text-white">{maxPoints}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Passing Score</span><span className="font-semibold text-purple-600 dark:text-purple-400">{passingScore}%</span></div>
              {submission.due_date && <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Due Date</span><span className={`font-medium ${submission.days_late > 0 ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>{new Date(submission.due_date).toLocaleDateString()}</span></div>}
              <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Format</span><span className="font-medium text-slate-900 dark:text-white capitalize">{submission.project?.submission_format?.replace('_', ' ') || 'Mixed'}</span></div>
              {submission.project?.collaboration_allowed && <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Team Size</span><span className="font-medium text-slate-900 dark:text-white">Up to {submission.project.max_team_size} members</span></div>}
              {submission.project?.max_resubmissions !== undefined && <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Max Resubmissions</span><span className="font-medium text-slate-900 dark:text-white">{submission.project.max_resubmissions}</span></div>}
              {submission.project?.expected_length && <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Expected Length</span><span className="font-medium text-slate-900 dark:text-white">{submission.project.expected_length}</span></div>}
              {submission.project?.allowed_file_types && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1.5">Allowed Types</span>
                  <div className="flex flex-wrap gap-1">
                    {submission.project.allowed_file_types.split(',').map((type: string, i: number) => (
                      <span key={i} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[10px] font-medium text-slate-600 dark:text-slate-400">{type.trim()}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* REQUEST MODIFICATION MODAL */}
      {submission && (
        <RequestModificationModal
          isOpen={showModificationModal}
          onClose={() => setShowModificationModal(false)}
          submission={{
            id: submission.id,
            student_name: getStudentName(),
            student_id: submission.student_info?.id || 0,
            assignment_title: submission.project_title || submission.project?.title || 'Unknown Project',
            assignment_id: submission.project?.id || 0,
            submission_type: 'project'
          }}
          onSuccess={() => { setShowModificationModal(false); fetchSubmission(); }}
        />
      )}
    </div>
  );
};

export default ProjectGradingDetail;
