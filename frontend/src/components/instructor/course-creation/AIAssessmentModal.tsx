"use client";

import React, { useEffect, useState } from 'react';
import { EnhancedModule } from '@/types/api';
import { TaskStatus } from '@/services/ai-agent.service';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  CircleDot,
  Clock,
  TimerReset,
} from 'lucide-react';

interface AIAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: () => void;
  assessmentType: 'quiz' | 'assignment' | 'project';
  contentType: 'lesson' | 'module';
  setContentType: (type: 'lesson' | 'module') => void;
  modules: EnhancedModule[];
  selectedModuleId: number | null;
  setSelectedModuleId: (id: number | null) => void;
  /** For project multi-select: array of selected module IDs */
  selectedModuleIds?: number[];
  setSelectedModuleIds?: (ids: number[]) => void;
  lessons: any[];
  selectedLessonId: number | null;
  setSelectedLessonId: (id: number | null) => void;
  numQuestions: number;
  setNumQuestions: (num: number) => void;
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  setDifficulty: (diff: 'easy' | 'medium' | 'hard' | 'mixed') => void;
  assignmentType: 'practical' | 'theoretical' | 'project' | 'mixed';
  setAssignmentType: (type: 'practical' | 'theoretical' | 'project' | 'mixed') => void;
  isGenerating: boolean;
  /** Real-time task status for background generation progress */
  taskStatus?: TaskStatus | null;
  /** Cancel generation callback */
  onCancelTask?: () => void;
}

const AIAssessmentModal: React.FC<AIAssessmentModalProps> = ({
  isOpen,
  onClose,
  onGenerate,
  assessmentType,
  contentType,
  setContentType,
  modules,
  selectedModuleId,
  setSelectedModuleId,
  selectedModuleIds,
  setSelectedModuleIds,
  lessons,
  selectedLessonId,
  setSelectedLessonId,
  numQuestions,
  setNumQuestions,
  difficulty,
  setDifficulty,
  assignmentType,
  setAssignmentType,
  isGenerating,
  taskStatus,
  onCancelTask,
}) => {
  const [waitRemaining, setWaitRemaining] = useState(0);

  // Rate limit countdown
  useEffect(() => {
    const rl = taskStatus?.rate_limit_info;
    if (!rl?.is_waiting) { setWaitRemaining(0); return; }
    setWaitRemaining(rl.wait_remaining_seconds);
    const interval = setInterval(() => setWaitRemaining(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(interval);
  }, [taskStatus?.rate_limit_info?.is_waiting, taskStatus?.rate_limit_info?.wait_remaining_seconds]);

  if (!isOpen) return null;

  const progress = taskStatus?.progress ?? 0;
  const hasSteps = taskStatus && taskStatus.total_steps > 1;

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isGenerating) {
          onClose();
        }
      }}
    >
      <div 
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 rounded-t-2xl">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <span className="text-4xl">🤖</span>
              <div>
                <h2 className="text-2xl font-bold text-white">
                  AI {assessmentType === 'quiz' ? 'Quiz' : assessmentType === 'assignment' ? 'Assignment' : 'Project'} Generator
                </h2>
                <p className="text-purple-100 text-sm mt-1">
                  {assessmentType === 'project' ? 'Generate from selected modules or entire course' : 'Generate from lesson or module content'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-purple-200 text-2xl transition-colors"
              disabled={isGenerating}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {isGenerating && !taskStatus ? (
            /* ── Initial submit state (before first poll response) ── */
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-purple-50/80 to-indigo-50/50 dark:from-purple-900/15 dark:to-indigo-900/10 rounded-xl border border-purple-200/60 dark:border-purple-800/40 p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-800/40 flex items-center justify-center shrink-0">
                    <Loader2 className="w-5 h-5 text-purple-600 dark:text-purple-400 animate-spin" />
                  </div>
                  <div>
                    <p className="font-semibold text-purple-800 dark:text-purple-300">Starting AI generation...</p>
                    <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">
                      Submitting task to background worker
                    </p>
                  </div>
                </div>
                <div className="h-2 bg-purple-100 dark:bg-purple-900/30 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full animate-pulse" style={{ width: '30%' }} />
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                  <div className="text-sm text-blue-900 dark:text-blue-100">
                    <p className="font-semibold mb-1">⏳ AI is preparing to generate your {assessmentType}...</p>
                    <p>Progress details will appear momentarily as the generation begins.</p>
                  </div>
                </div>
              </div>
            </div>
          ) : isGenerating && taskStatus ? (
            /* ── Real-time progress panel during generation ── */
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-purple-50/80 to-indigo-50/50 dark:from-purple-900/15 dark:to-indigo-900/10 rounded-xl border border-purple-200/60 dark:border-purple-800/40 p-4 space-y-3">
                {/* Current step */}
                <div className="flex items-center gap-2.5 text-sm text-purple-700 dark:text-purple-300">
                  <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-800/40 flex items-center justify-center shrink-0">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <span className="truncate font-medium">
                    {taskStatus.current_step_description || 'Generating...'}
                  </span>
                  <span className="ml-auto text-xs font-semibold tabular-nums">
                    {Math.round(progress)}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="flex-1 h-2.5 bg-purple-100 dark:bg-purple-900/30 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-700 ease-out ${
                      taskStatus.status === 'rate_limited' 
                        ? 'bg-gradient-to-r from-amber-400 to-amber-500' 
                        : 'bg-gradient-to-r from-purple-500 to-indigo-500'
                    }`}
                    style={{ width: `${Math.max(3, progress)}%` }}
                  />
                </div>

                {/* Step list */}
                {hasSteps && taskStatus.steps.length > 0 && (
                  <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                    {taskStatus.steps.map((step) => (
                      <div 
                        key={step.step_number}
                        className={`flex items-center gap-2 text-xs py-1.5 px-2.5 rounded-lg transition-colors ${
                          step.status === 'completed' 
                            ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50/80 dark:bg-emerald-900/15'
                            : step.status === 'in_progress'
                            ? 'text-purple-700 dark:text-purple-300 bg-purple-100/80 dark:bg-purple-900/20 ring-1 ring-purple-200 dark:ring-purple-700'
                            : step.status === 'failed'
                            ? 'text-red-600 dark:text-red-400 bg-red-50/80 dark:bg-red-900/15'
                            : step.status === 'rate_limited'
                            ? 'text-amber-700 dark:text-amber-400 bg-amber-50/80 dark:bg-amber-900/15 ring-1 ring-amber-300 dark:ring-amber-700'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {step.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                        {step.status === 'in_progress' && <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />}
                        {step.status === 'failed' && <XCircle className="w-3.5 h-3.5 shrink-0" />}
                        {step.status === 'rate_limited' && <TimerReset className="w-3.5 h-3.5 shrink-0 animate-pulse" />}
                        {step.status === 'pending' && <CircleDot className="w-3.5 h-3.5 shrink-0 opacity-30" />}
                        <span className="truncate">{step.description}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Rate limit card */}
                {taskStatus.status === 'rate_limited' && (
                  <div className="p-3 bg-amber-50/80 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700/50 space-y-2">
                    <div className="flex items-center gap-2">
                      <TimerReset className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Rate limit cooling down...</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-2xl font-bold text-amber-900 dark:text-amber-100 tabular-nums">
                        {Math.floor(waitRemaining / 60)}:{String(waitRemaining % 60).padStart(2, '0')}
                      </p>
                      <div className="flex-1 h-1.5 bg-amber-200 dark:bg-amber-800/30 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-amber-500 rounded-full transition-all duration-1000 ease-linear"
                          style={{ width: taskStatus.rate_limit_info?.wait_duration_seconds ? `${((taskStatus.rate_limit_info.wait_duration_seconds - waitRemaining) / taskStatus.rate_limit_info.wait_duration_seconds) * 100}%` : '0%' }}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Auto-retrying after cooldown — no action needed
                    </p>
                  </div>
                )}

                {/* Cancel button */}
                {onCancelTask && (
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={onCancelTask}
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors font-medium"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Cancel Generation
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                  <div className="text-sm text-blue-900 dark:text-blue-100">
                    <p className="font-semibold mb-1">⏳ AI is generating your {assessmentType}...</p>
                    <p>
                      Generation runs in the background. You can monitor the progress above or 
                      continue working — results will be saved automatically when complete.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ── Form content (shown when NOT generating) ── */
            <>
              {/* Content Type Selection — hidden for projects (projects use module multi-select directly) */}
              {assessmentType !== 'project' && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Generate from:
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setContentType('lesson')}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        contentType === 'lesson'
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-slate-300 dark:border-slate-600 hover:border-purple-300'
                      }`}
                      disabled={isGenerating}
                    >
                      <div className="text-2xl mb-2">📄</div>
                      <div className="font-semibold text-slate-900 dark:text-white">Single Lesson</div>
                      <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        Based on one lesson's content
                      </div>
                    </button>
                    <button
                      onClick={() => setContentType('module')}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        contentType === 'module'
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-slate-300 dark:border-slate-600 hover:border-purple-300'
                      }`}
                      disabled={isGenerating}
                    >
                      <div className="text-2xl mb-2">📚</div>
                      <div className="font-semibold text-slate-900 dark:text-white">Entire Module</div>
                      <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        Based on all lessons in module
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Module Selection */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  {assessmentType === 'project' ? 'Select Modules (Optional — leave empty for whole course project)' : 'Select Module *'}
                </label>
                
                {assessmentType === 'project' && selectedModuleIds !== undefined && setSelectedModuleIds ? (
                  /* ── Multi-select for projects ── */
                  <div className="space-y-1.5 max-h-48 overflow-y-auto border-2 border-slate-300 dark:border-slate-600 rounded-lg p-2">
                    <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={selectedModuleIds.length === 0}
                        onChange={() => {
                          if (selectedModuleIds.length > 0) {
                            // Save current selection and switch to whole-course mode
                            localStorage.setItem('lastProjectModuleIds', JSON.stringify(selectedModuleIds));
                            setSelectedModuleIds([]);
                          } else {
                            // Restore previous selection from localStorage, or select all if none saved
                            const saved = localStorage.getItem('lastProjectModuleIds');
                            if (saved) {
                              try {
                                const parsed = JSON.parse(saved);
                                setSelectedModuleIds(parsed);
                              } catch {
                                setSelectedModuleIds(modules.map(m => m.id));
                              }
                            } else {
                              setSelectedModuleIds(modules.map(m => m.id));
                            }
                          }
                        }}
                        className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                        disabled={isGenerating}
                      />
                      <span className="font-medium text-blue-600 dark:text-blue-400">Whole Course Project (all modules)</span>
                    </label>
                    <div className="border-t border-slate-200 dark:border-slate-600 my-1" />
                    {modules.map((module) => (
                      <label
                        key={module.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={selectedModuleIds.includes(module.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedModuleIds([...selectedModuleIds, module.id]);
                            } else {
                              setSelectedModuleIds(selectedModuleIds.filter(id => id !== module.id));
                            }
                          }}
                          className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                          disabled={isGenerating}
                        />
                        <span>{module.title}</span>
                        <span className="text-xs text-slate-400 ml-auto">({module.lessons?.length || 0} lessons)</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  /* ── Single-select for quizzes/assignments ── */
                  <select
                    value={selectedModuleId || ''}
                    onChange={(e) => setSelectedModuleId(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-4 py-3 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-700 dark:text-white"
                    disabled={isGenerating}
                  >
                    <option value="">Select a module...</option>
                    {modules.map((module) => (
                      <option key={module.id} value={module.id}>
                        {module.title} ({module.lessons?.length || 0} lessons)
                      </option>
                    ))}
                  </select>
                )}
                
                {assessmentType === 'project' && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    {selectedModuleIds !== undefined && selectedModuleIds.length === 0
                      ? '💡 No modules selected — will generate a comprehensive capstone project covering the entire course'
                      : selectedModuleIds !== undefined && selectedModuleIds.length === 1
                      ? '📋 Will generate a project focused on the selected module'
                      : selectedModuleIds !== undefined && selectedModuleIds.length > 1
                      ? `📋 Will generate a project integrating ${selectedModuleIds.length} selected modules`
                      : ''}
                  </p>
                )}
              </div>

              {/* Lesson Selection (only for quizzes/assignments when content type is lesson) */}
              {assessmentType !== 'project' && contentType === 'lesson' && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Select Lesson *
                  </label>
                  <select
                    value={selectedLessonId || ''}
                    onChange={(e) => setSelectedLessonId(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-4 py-3 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-700 dark:text-white"
                    disabled={isGenerating || !selectedModuleId}
                  >
                    <option value="">
                      {selectedModuleId ? 'Select a lesson...' : 'Select a module first...'}
                    </option>
                    {lessons.map((lesson) => (
                      <option key={lesson.id} value={lesson.id}>
                        {lesson.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Quiz-specific options */}
              {assessmentType === 'quiz' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Number of Questions
                    </label>
                    <input
                      type="number"
                      value={numQuestions}
                      onChange={(e) => setNumQuestions(parseInt(e.target.value) || 10)}
                      min="5"
                      max="50"
                      className="w-full px-4 py-3 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-700 dark:text-white"
                      disabled={isGenerating}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Difficulty Level
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {(['easy', 'medium', 'hard', 'mixed'] as const).map((level) => (
                        <button
                          key={level}
                          onClick={() => setDifficulty(level)}
                          className={`px-4 py-2 rounded-lg border-2 font-medium capitalize transition-all ${
                            difficulty === level
                              ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                              : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-purple-300'
                          }`}
                          disabled={isGenerating}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Assignment-specific options */}
              {assessmentType === 'assignment' && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Assignment Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['practical', 'theoretical', 'project', 'mixed'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setAssignmentType(type)}
                        className={`px-4 py-2 rounded-lg border-2 font-medium capitalize transition-all ${
                          assignmentType === type
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                            : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-purple-300'
                        }`}
                        disabled={isGenerating}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Info Box */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <span className="text-2xl">ℹ️</span>
                  <div className="text-sm text-blue-900 dark:text-blue-100">
                    <p className="font-semibold mb-1">How it works:</p>
                    {assessmentType === 'project' ? (
                      <p>
                        The AI will analyze the actual content from your selected modules and generate a comprehensive project that integrates concepts across them. This ensures the project aligns with your course content and saves you hours of work!
                      </p>
                    ) : (
                      <p>
                        The AI will analyze the actual content from your selected {contentType} and generate a {assessmentType} that tests exactly what students learned. This ensures content alignment and saves you hours of work!
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Content Validation Warning — only for quizzes/assignments with lesson content */}
              {assessmentType !== 'project' && !isGenerating && contentType === 'lesson' && selectedModuleId && selectedLessonId && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                  <div className="flex items-start space-x-2">
                    <span className="text-lg">⚠️</span>
                    <div className="text-xs text-yellow-900 dark:text-yellow-100">
                      <p className="font-semibold">Important:</p>
                      <p>Make sure the selected lesson has substantial content (at least 100 characters). AI cannot generate quality assessments from empty or very short lessons.</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer (hidden during generation — progress panel has its own controls) */}
        {!isGenerating && (
          <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-b-2xl flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-6 py-3 border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors font-medium"
              disabled={isGenerating}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onGenerate();
              }}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all font-medium flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
              disabled={
                isGenerating || 
                (assessmentType !== 'project' && !selectedModuleId) || 
                (assessmentType !== 'project' && contentType === 'lesson' && !selectedLessonId)
              }
              title={
                assessmentType === 'project'
                  ? 'Generate project with AI'
                  : !selectedModuleId
                  ? 'Please select a module'
                  : contentType === 'lesson' && !selectedLessonId
                  ? 'Please select a lesson'
                  : 'Generate assessment with AI'
              }
            >
              <span>✨</span>
              <span>Generate with AI</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIAssessmentModal;
