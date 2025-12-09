"use client";

import React from 'react';
import { EnhancedModule } from '@/types/api';

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
  lessons,
  selectedLessonId,
  setSelectedLessonId,
  numQuestions,
  setNumQuestions,
  difficulty,
  setDifficulty,
  assignmentType,
  setAssignmentType,
  isGenerating
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        // Close modal only if clicking the backdrop, not the modal content
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
                  Generate from lesson or module content
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
          {/* Content Type Selection */}
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

          {/* Module Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Select Module *
            </label>
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
          </div>

          {/* Lesson Selection (if content type is lesson) */}
          {contentType === 'lesson' && (
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
                <p>
                  The AI will analyze the actual content from your selected {contentType} and generate a {assessmentType} that tests exactly what students learned. This ensures content alignment and saves you hours of work!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
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
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all font-medium flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isGenerating || !selectedModuleId || (contentType === 'lesson' && !selectedLessonId)}
          >
            {isGenerating ? (
              <>
                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                <span>Generating...</span>
              </>
            ) : (
              <>
                <span>✨</span>
                <span>Generate with AI</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIAssessmentModal;
