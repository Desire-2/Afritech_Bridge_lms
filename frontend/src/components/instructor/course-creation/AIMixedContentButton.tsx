"use client";

import React from 'react';
import { Sparkles, Loader2, XCircle, BookOpen, FileText, Layers, Layout, TimerReset } from 'lucide-react';

export interface MixedGenProgressState {
  taskId: string;
  progress: number;
  description: string;
  status: string;
  rateLimit?: { wait_duration_seconds?: number; wait_remaining_seconds?: number };
}

interface AIMixedContentButtonProps {
  lessonTitle: string;
  courseTitle: string;
  moduleTitle?: string;
  existingContent: string;
  isGenerating: boolean;
  showDialog: boolean;
  onToggleDialog: () => void;
  onGenerate: () => void;
  /** Live background-task progress while generating */
  progress?: MixedGenProgressState | null;
  /** Seconds since generation started */
  elapsedSeconds?: number;
  /** Cancel the running generation task */
  onCancel?: () => void;
}

const formatTime = (totalSeconds: number) =>
  `${Math.floor(totalSeconds / 60)}:${String(Math.max(0, totalSeconds) % 60).padStart(2, '0')}`;

export const AIMixedContentButton: React.FC<AIMixedContentButtonProps> = ({
  lessonTitle,
  courseTitle,
  moduleTitle,
  existingContent,
  isGenerating,
  showDialog,
  onToggleDialog,
  onGenerate,
  progress,
  elapsedSeconds = 0,
  onCancel
}) => {
  const percent = progress && progress.progress > 0 ? Math.round(progress.progress) : 0;
  const barWidth = Math.max(3, progress?.progress || 0);

  return (
    <>
      {isGenerating ? (
        <div className="flex items-center gap-3 px-3 py-2.5 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/25 dark:to-indigo-900/15 border border-purple-200/70 dark:border-purple-700/50 rounded-md shadow-sm">
          <Loader2 className="w-4 h-4 animate-spin text-purple-600 dark:text-purple-300 shrink-0" />
          <div className="min-w-0 flex-1 flex items-center gap-3">
            <span className="text-xs font-medium text-purple-700 dark:text-purple-300 truncate max-w-[180px]">
              {progress?.description || 'Generating mixed content…'}
            </span>
            <div className="w-24 h-1.5 bg-purple-100 dark:bg-purple-900/40 rounded-full overflow-hidden shrink-0">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${
                  progress?.status === 'rate_limited'
                    ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                    : 'bg-gradient-to-r from-purple-500 to-indigo-500'
                } ${percent === 0 ? 'animate-pulse' : ''}`}
                style={{ width: `${barWidth}%` }}
              />
            </div>
            <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-300 tabular-nums min-w-[64px]">
              {percent > 0 ? `${percent}%` : formatTime(elapsedSeconds)}
              {percent > 0 && elapsedSeconds > 0 && (
                <span className="ml-1 font-normal opacity-70">
                  · {formatTime(elapsedSeconds)}
                </span>
              )}
            </span>
            {progress?.status === 'rate_limited' && (
              <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300 shrink-0">
                <TimerReset className="w-3 h-3" />
                Rate limited
                {typeof progress.rateLimit?.wait_remaining_seconds === 'number' &&
                  ` — retry in ${formatTime(progress.rateLimit.wait_remaining_seconds)}`}
              </span>
            )}
          </div>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              title="Cancel generation"
              className="shrink-0 p-1 rounded-md text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={onToggleDialog}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-md hover:from-purple-700 hover:to-indigo-700 transition-all shadow-sm hover:shadow-md"
          title="Generate mixed content with AI"
        >
          <Layout className="w-3 h-3" />
          AI Generate Mixed
        </button>
      )}

      {showDialog && !isGenerating && (
        <div className="mb-3 p-4 bg-gradient-to-br from-slate-50 to-purple-50/50 dark:from-slate-800/60 dark:to-purple-900/20 rounded-xl border border-purple-200/80 dark:border-purple-800/60 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-md">
                <Layout className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <h6 className="text-sm font-semibold text-slate-900 dark:text-white">
                  AI Mixed Content Generator
                </h6>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Generate structured sections with headings, text, and media placeholders
                </p>
              </div>
            </div>
            <button
              onClick={onToggleDialog}
              className="p-1 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
          
          {/* Context pills */}
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-md text-xs">
              <BookOpen className="w-3 h-3" />
              {courseTitle}
            </div>
            {moduleTitle && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-md text-xs">
                <Layers className="w-3 h-3" />
                {moduleTitle}
              </div>
            )}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-md text-xs">
              <FileText className="w-3 h-3" />
              {lessonTitle || '(Enter title above)'}
            </div>
          </div>

          {existingContent && (
            <div className="flex items-center gap-2 px-3 py-2 mb-4 bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/50 rounded-lg text-xs text-amber-700 dark:text-amber-300">
              <span className="shrink-0">⚠️</span>
              <span>Existing mixed content will be replaced</span>
            </div>
          )}

          <button
            type="button"
            onClick={onGenerate}
            disabled={!lessonTitle || isGenerating}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium text-sm shadow-md hover:shadow-lg"
          >
            <Sparkles className="w-4 h-4" />
            Generate Mixed Content
          </button>
        </div>
      )}
    </>
  );
};
