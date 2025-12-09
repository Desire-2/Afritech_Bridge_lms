"use client";

import React from 'react';
import { Sparkles } from 'lucide-react';

interface AIContentButtonProps {
  lessonTitle: string;
  courseTitle: string;
  moduleTitle?: string;
  existingContent: string;
  isGenerating: boolean;
  showDialog: boolean;
  onToggleDialog: () => void;
  onGenerate: () => void;
}

export const AIContentButton: React.FC<AIContentButtonProps> = ({
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
        className="flex items-center gap-1 text-xs px-3 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        title="Generate or enhance content with AI"
      >
        <Sparkles className="w-3 h-3" />
        {isGenerating ? 'Generating...' : 'AI Enhance'}
      </button>

      {showDialog && (
        <div className="mb-3 p-4 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg border-2 border-purple-200 dark:border-purple-800">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h6 className="text-sm font-semibold text-purple-900 dark:text-purple-300 mb-1">
                ✨ AI Content Generator
              </h6>
              <p className="text-xs text-purple-700 dark:text-purple-400">
                Generate comprehensive lesson content based on title and context
              </p>
            </div>
            <button
              onClick={onToggleDialog}
              className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              ✕
            </button>
          </div>
          
          <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400 mb-3">
            <div className="flex items-start gap-2">
              <span>📚</span>
              <span><strong>Course:</strong> {courseTitle}</span>
            </div>
            {moduleTitle && (
              <div className="flex items-start gap-2">
                <span>📖</span>
                <span><strong>Module:</strong> {moduleTitle}</span>
              </div>
            )}
            <div className="flex items-start gap-2">
              <span>📝</span>
              <span><strong>Lesson:</strong> {lessonTitle || '(Enter title above)'}</span>
            </div>
            {existingContent && (
              <div className="flex items-start gap-2">
                <span>💡</span>
                <span className="text-amber-600 dark:text-amber-400"><strong>Note:</strong> Existing content will be replaced</span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onGenerate}
            disabled={!lessonTitle || isGenerating}
            className="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            {isGenerating ? 'Generating Content...' : 'Generate Full Content'}
          </button>
        </div>
      )}
    </>
  );
};
