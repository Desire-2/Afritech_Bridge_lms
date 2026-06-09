/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import Markdown from 'react-markdown';
import { api, extractApiError } from '../../lib/api';
import { TaskAssignment } from '../../types';
import { 
  ArrowLeft, 
  Clock, 
  HelpCircle,
  FileCheck2,
  FileDown,
  UploadCloud,
  CheckCircle,
  XOctagon,
  AlertCircle,
  Loader2,
  Lock,
  ChevronRight,
  Code,
  FileText,
  BadgeAlert
} from 'lucide-react';

interface TaskDetailViewProps {
  assignmentId: string;
  onNavigate: (path: string) => void;
}

export const TaskDetailView: React.FC<TaskDetailViewProps> = ({ assignmentId, onNavigate }) => {
  const [task, setTask] = useState<TaskAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Submission States
  const [solutionText, setSolutionText] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchTaskDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const taskData = await api.getTaskDetail(assignmentId);
      if (taskData && taskData.assignment_id) {
        setTask(taskData);
        setSolutionText(taskData.submission_text || '');
        if (taskData.submission_file_path) {
          // Previously uploaded file — show the path as label (no File object available)
        }
      }
    } catch (err: any) {
      const apiErr = extractApiError(err);
      setError(apiErr.message || 'Failed connecting to remote databases.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTaskDetail();
  }, [assignmentId]);

  // Drag and Drop Handles
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setAttachmentFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAttachmentFile(e.target.files[0]);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleSubmissionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!solutionText.trim() && !attachmentFile) {
      setError('Please provide a text response or drop a file attachment to submit your assignment.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const submitResult = await api.submitTask(assignmentId, {
        submission_text: solutionText,
        submission_file: attachmentFile || undefined
      });
      if (submitResult) {
        setTask(submitResult);
        await fetchTaskDetail();
      }
    } catch (err: any) {
      const apiErr = extractApiError(err);
      setError(apiErr.message || 'Technical submission error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'urgent':
        return 'bg-rose-950 border-rose-500/35 text-rose-300';
      case 'high':
        return 'bg-orange-950 border-orange-500/25 text-orange-400';
      case 'medium':
        return 'bg-amber-950 border-amber-500/20 text-amber-400';
      default:
        return 'bg-emerald-950 border-emerald-500/20 text-emerald-400';
    }
  };

  const formatSimpleDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  };

  // Due Date helper
  const getDueStatus = (dueDateString: string, status: string) => {
    try {
      const targetTime = new Date(dueDateString).getTime();
      const diffTime = targetTime - new Date().getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (status === 'approved' || status === 'submitted') {
        return <span className="text-emerald-400 font-mono text-xs">Completed</span>;
      }

      if (diffDays < 0) {
        return <span className="text-rose-400 font-bold font-mono">Overdue ({formatSimpleDate(dueDateString)})</span>;
      }
      if (diffDays === 0) {
        return <span className="text-orange-400 font-bold font-mono animate-pulse">Due today!</span>;
      }
      return <span className="text-slate-400 font-mono text-xs">Due in {diffDays} days ({formatSimpleDate(dueDateString)})</span>;
    } catch {
      return '';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="h-8 w-8 text-teal-400 animate-spin" />
        <p className="text-xs text-slate-500 font-mono">Retrieving assignment instructions...</p>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center max-w-lg mx-auto space-y-4 mt-12">
        <BadgeAlert className="h-10 w-10 text-rose-500 mx-auto" />
        <div>
          <h3 className="text-md font-bold text-white">Instruction Feed Alert</h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            {error || 'This assignment records could not be fetched.'}
          </p>
        </div>
        <button
          onClick={() => onNavigate('/intern/tasks')}
          className="px-4 py-2 bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 rounded-xl text-xs text-slate-300 font-semibold cursor-pointer"
        >
          Back to list
        </button>
      </div>
    );
  }

  // Determine timeline steps
  const isPending = task.status === 'pending';
  const isInProgress = task.status === 'in_progress';
  const isSubmitted = task.status === 'submitted';
  const isApproved = task.status === 'approved';
  const isRejected = task.status === 'rejected';

  return (
    <div className="space-y-8 font-sans animate-fadeIn" id="task-detail-pane">
      
      {/* Back navigation */}
      <button
        onClick={() => onNavigate('/intern/tasks')}
        className="inline-flex items-center space-x-2 text-xs text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-xl transition-all cursor-pointer"
        id="task-back-btn"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Return to Assignments</span>
      </button>

      {/* Task Header info */}
      <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-teal-500/5 to-transparent pointer-events-none rounded-full" />
        
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 z-10 relative">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-850 text-[10px] font-mono text-slate-400">
                TASK ID: {task.task_id}
              </span>
              <span className={`${getPriorityBadge(task.priority)} px-2 py-0.5 rounded-md border text-[9px] font-bold font-mono uppercase`}>
                {task.priority} Priority
              </span>
              <span className="text-[10px] text-teal-400 font-mono capitalize">
                {task.task_type} Task
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">{task.title}</h1>
          </div>

          <div className="text-left sm:text-right text-xs bg-slate-950/80 p-3 border border-slate-850/80 rounded-xl shrink-0">
            <span className="block text-[9px] text-slate-500 font-mono uppercase">Submission Deadline:</span>
            <span className="block font-bold text-slate-200 mt-0.5">{getDueStatus(task.due_date, task.status)}</span>
          </div>
        </div>

        {/* TIMELINE PROGRESS SUB-STEPS */}
        <div className="pt-3 border-t border-slate-800/80 grid grid-cols-4 gap-3 text-center sm:px-1 select-none">
          <div className="space-y-1.5 flex flex-col items-center">
            <div className="w-5 h-5 rounded-full bg-teal-600 text-white text-[10px] flex items-center justify-center font-bold font-mono">1</div>
            <span className="text-[10px] font-bold text-teal-400 block font-mono">Assigned</span>
          </div>
          <div className="space-y-1.5 flex flex-col items-center">
            <div className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold font-mono ${
              isInProgress || isSubmitted || isApproved || isRejected ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-500'
            }`}>2</div>
            <span className={`text-[10px] font-bold block font-mono ${
              isInProgress || isSubmitted || isApproved || isRejected ? 'text-teal-400' : 'text-slate-550'
            }`}>Drafting</span>
          </div>
          <div className="space-y-1.5 flex flex-col items-center">
            <div className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold font-mono ${
              isSubmitted || isApproved || isRejected ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-500'
            }`}>3</div>
            <span className={`text-[10px] font-bold block font-mono ${
              isSubmitted || isApproved || isRejected ? 'text-teal-400' : 'text-slate-550'
            }`}>Submitted</span>
          </div>
          <div className="space-y-1.5 flex flex-col items-center">
            <div className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold font-mono ${
              isApproved ? 'bg-emerald-600 text-white' : isRejected ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-550'
            }`}>4</div>
            <span className={`text-[10px] font-bold block font-mono ${
              isApproved ? 'text-emerald-400' : isRejected ? 'text-rose-450' : 'text-slate-550'
            }`}>{isApproved ? 'Approved' : isRejected ? 'Rejected' : 'Graded'}</span>
          </div>
        </div>
      </section>

      {/* Grid: Descriptions vs Submission blocks */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* LEFT COLUMN: Markdown instructions (3/5 width) */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
            <h2 className="text-md font-bold text-slate-205 border-b border-slate-800 pb-2">
              Assignment Directive
            </h2>
            
            {/* COMPLY WITH REACT_MARKDOWN SYNTAX RULES */}
            <div className="markdown-body text-xs sm:text-sm">
              <Markdown>{task.description}</Markdown>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Submission or Feedback cards (2/5 width) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* A. FEEDBACK SECTION (If Graded - Approved/Rejected) */}
          {(isApproved || isRejected) && (
            <div className={`border rounded-3xl p-6 shadow-md space-y-4 ${
              isApproved ? 'bg-emerald-950/20 border-emerald-500/20' : 'bg-rose-950/20 border-rose-500/20'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {isApproved ? (
                    <CheckCircle className="h-5.5 w-5.5 text-emerald-450" />
                  ) : (
                    <XOctagon className="h-5.5 w-5.5 text-rose-450" />
                  )}
                  <span className="font-extrabold text-sm text-slate-200">
                    Evaluation Dashboard ({isApproved ? 'Approved' : 'Correction Needed'})
                  </span>
                </div>
                
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                  isApproved ? 'bg-emerald-950 border border-emerald-500/30 text-emerald-450' : 'bg-rose-950 border border-rose-500/30 text-rose-400'
                }`}>
                  {task.status}
                </span>
              </div>

              {/* Score Display Card */}
              <div className="bg-slate-950 p-4 border border-slate-900 rounded-2xl text-center space-y-1">
                <span className="text-[10px] text-slate-500 font-mono uppercase block">Graded performance score:</span>
                <span className="text-2xl font-black text-white font-mono leading-none">
                  {task.score ?? 0}
                  <span className="text-slate-500 font-normal text-md">/{task.max_score || 100}</span>
                </span>
                <span className="block text-xs text-teal-400 font-bold font-mono">
                  {Math.round(((task.score ?? 0) / (task.max_score || 100)) * 100)}% Overall
                </span>
              </div>

              {/* Feedback memo */}
              {task.feedback && (
                <div className="space-y-1.5">
                  <span className="text-[10px] text-slate-400 font-mono uppercase block">Instructor Comments:</span>
                  <div className="bg-slate-950 p-3.5 border border-slate-900 rounded-xl text-slate-350 text-xs leading-relaxed italic">
                    "{task.feedback}"
                  </div>
                </div>
              )}

              <div className="text-[11px] text-slate-500 font-mono text-center pt-2">
                Evaluated: {formatSimpleDate(task.graded_at)}
              </div>
            </div>
          )}

          {/* B. CORE SUBMISSION CARD (Active work box) */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md space-y-5">
            <div>
              <h3 className="text-sm font-bold text-white">Your solution draft</h3>
              <p className="text-[11px] text-slate-400">
                {isApproved || isRejected || isSubmitted 
                  ? 'Your submitted response and files (READ ONLY).' 
                  : 'Submit code repositories, solution diagrams or written texts.'}
              </p>
            </div>

            <form onSubmit={handleSubmissionSubmit} className="space-y-4">
              {/* Text solution */}
              <div>
                <label htmlFor="solution-body" className="block text-xs font-semibold text-slate-350 mb-1.5">
                  Written explanation / Solution links
                </label>
                <textarea
                  id="solution-body"
                  disabled={isApproved || isSubmitted}
                  placeholder="Paste git repositories URLs, write solution reports, or detail architectural blocks..."
                  value={solutionText}
                  onChange={(e) => setSolutionText(e.target.value)}
                  rows={6}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all font-mono disabled:opacity-50 disabled:text-slate-450"
                />
              </div>

              {/* File dragging & drop box (COMPLYING WITH DRAG & DROP USABILITY RULES) */}
              <div className="space-y-1.5">
                <span className="block text-xs font-semibold text-slate-350">
                  Document Attachments (Optional PDF/DOC)
                </span>

                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`
                    border border-dashed rounded-xl p-4.5 text-center flex flex-col items-center justify-center space-y-2 transition-all select-none
                    ${dragActive ? 'border-teal-400 bg-teal-950/10' : 'border-slate-800 hover:border-slate-700 bg-slate-950'}
                    ${(isApproved || isSubmitted) ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
                  `}
                  onClick={!(isApproved || isSubmitted) ? triggerFileSelect : undefined}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                  />
                  
                  {attachmentFile ? (
                    <div className="flex items-center space-x-2 text-teal-400 font-mono text-xs max-w-full truncate">
                      <FileDown className="h-4.5 w-4.5 shrink-0" />
                      <span className="truncate">{attachmentFile.name}</span>
                    </div>
                  ) : (
                    <>
                      <UploadCloud className="h-6 w-6 text-slate-500" />
                      <div className="text-xs">
                        <span className="text-teal-450 font-bold hover:underline">Click to upload</span> or drag paper here
                      </div>
                      <span className="text-[10px] text-slate-550 block font-mono">PDF, ZIP, DOC or Images up to 10MB</span>
                    </>
                  )}
                </div>

                {attachmentFile && !(isApproved || isSubmitted) && (
                  <button
                    type="button"
                    onClick={() => setAttachmentFile(null)}
                    className="text-[10px] text-rose-455 hover:underline focus:outline-none block pt-0.5"
                  >
                    Remove attachment
                  </button>
                )}
              </div>

              {error && (
                <div className="p-3 bg-rose-950/40 border border-rose-500/20 rounded-xl flex items-start space-x-2 text-rose-300 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              {/* Action submission control */}
              {!(isApproved || isSubmitted) ? (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-md shadow-teal-950 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  id="solution-submit-btn"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Transmitting Files...</span>
                    </>
                  ) : (
                    <>
                      <FileCheck2 className="h-4 w-4" />
                      <span>Send Submission to Instructor</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center space-x-2.5 text-xs text-slate-450">
                  <Lock className="h-4 w-4 text-slate-550" />
                  <span>Submission is locked. Draft received {formatSimpleDate(task.submitted_at)}.</span>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
