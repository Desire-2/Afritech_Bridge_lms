"use client";

import React from 'react';
import { Sparkles, Loader2, XCircle, BookOpen, FileText, Layers, Layout } from 'lucide-react';

interface AIMixedContentButtonProps {
  lessonTitle: string;
  courseTitle: string;
  moduleTitle?: string;
  existingContent: string;
  isGenerating: boolean;
  showDialog: boolean;
  onToggleDialog: () => void;
  onGenerate: () => void;
}

export const AIMixedContentButton: React.FC<AIMixedContentButtonProps> = ({
  lessonTitle,
  courseTitle,
  moduleTitle,
  existingContent,
  isGenerating,
  showDialog,
  onToggleDialog,
  onGenerate
}) => {
  return (
    <>
      <button
        type="button"
        onClick={onToggleDialog}
        disabled={isGenerating}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-md hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
        title="Generate mixed content with AI"
      >
        {isGenerating ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Layout className="w-3 h-3" />
        )}
        {isGenerating ? 'Generating...' : 'AI Generate Mixed'}
      </button>

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
