"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, Loader2, AlertCircle, CheckCircle2, Clock, XCircle, CircleDot, Zap, Brain, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import aiAgentService, { TaskStatus } from '@/services/ai-agent.service';

interface AIContentGeneratorProps {
  type: 'module' | 'lesson' | 'quiz' | 'assignment' | 'project';
  courseId: number;
  moduleId?: number;
  lessonId?: number;
  onGenerate: (data: any) => void;
  batchMode?: boolean;
  context?: {
    courseTitle?: string;
    moduleTitle?: string;
    lessonTitle?: string;
  };
}

export const AIContentGenerator: React.FC<AIContentGeneratorProps> = ({
  type,
  courseId,
  moduleId,
  lessonId,
  onGenerate,
  batchMode = false,
  context = {}
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Background task state
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null);

  // Elapsed time tracker
  useEffect(() => {
    if (loading) {
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading]);

  const handleProgressUpdate = useCallback((status: TaskStatus) => {
    setTaskStatus(status);
  }, []);

  const handleCancel = useCallback(async () => {
    if (taskId) {
      await aiAgentService.cancelTask(taskId);
      setLoading(false);
      setTaskId(null);
      setTaskStatus(null);
      setError('Generation cancelled');
    }
  }, [taskId]);

  const getTypeConfig = () => {
    switch (type) {
      case 'module':
        return {
          title: batchMode ? 'AI Batch Module Generator' : 'AI Module Generator',
          description: batchMode ? 'Generate modules one by one in background (avoids timeouts)' : 'Generate module content in background',
          placeholder: batchMode ? 'Number of modules to generate (default: 5)' : 'Optional: Enter module title or topic',
          buttonText: batchMode ? 'Generate Multiple Modules' : 'Generate Module Content'
        };
      case 'lesson':
        return {
          title: batchMode ? 'AI Batch Lesson Generator' : 'AI Lesson Generator',
          description: batchMode ? 'Generate lessons one by one in background (avoids timeouts)' : 'Generate detailed lesson content in background',
          placeholder: batchMode ? 'Number of lessons to generate (default: 5)' : 'Optional: Enter lesson title or focus area',
          buttonText: batchMode ? 'Generate Multiple Lessons' : 'Generate Lesson Content'
        };
      case 'quiz':
        return {
          title: 'AI Quiz Generator',
          description: 'Generate quiz questions in background',
          placeholder: 'Number of questions (default: 5)',
          buttonText: 'Generate Quiz Questions'
        };
      case 'assignment':
        return {
          title: 'AI Assignment Generator',
          description: 'Generate assignment in background',
          placeholder: 'Optional: Additional requirements',
          buttonText: 'Generate Assignment'
        };
      case 'project':
        return {
          title: 'AI Project Generator',
          description: 'Generate capstone project in background',
          placeholder: 'Optional: Project focus or requirements',
          buttonText: 'Generate Final Project'
        };
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    setTaskId(null);
    setTaskStatus(null);

    try {
      let response;

      switch (type) {
        case 'module':
          if (batchMode) {
            const numModules = parseInt(customInput) || 5;
            response = await aiAgentService.generateMultipleModules(
              { course_id: courseId, num_modules: numModules },
              handleProgressUpdate,
            );
          } else {
            response = await aiAgentService.generateModuleContent(
              { course_id: courseId, module_title: customInput.trim() },
              handleProgressUpdate,
            );
          }
          break;

        case 'lesson':
          if (!moduleId) {
            setError('Module ID is required for lesson generation');
            setLoading(false);
            return;
          }
          if (batchMode) {
            const numLessons = parseInt(customInput) || 5;
            response = await aiAgentService.generateMultipleLessons(
              { course_id: courseId, module_id: moduleId, num_lessons: numLessons },
              handleProgressUpdate,
            );
          } else {
            response = await aiAgentService.generateLessonContent(
              { course_id: courseId, module_id: moduleId, lesson_title: customInput.trim() },
              handleProgressUpdate,
            );
          }
          break;

        case 'quiz':
          if (!moduleId) {
            setError('Module ID is required for quiz generation');
            setLoading(false);
            return;
          }
          const numQuestions = parseInt(customInput) || 5;
          response = await aiAgentService.generateQuizQuestions(
            {
              course_id: courseId,
              module_id: moduleId,
              lesson_id: lessonId,
              num_questions: numQuestions,
              question_types: ['multiple_choice', 'true_false']
            },
            handleProgressUpdate,
          );
          break;

        case 'assignment':
          if (!moduleId) {
            setError('Module ID is required for assignment generation');
            setLoading(false);
            return;
          }
          response = await aiAgentService.generateAssignment(
            { course_id: courseId, module_id: moduleId },
            handleProgressUpdate,
          );
          break;

        case 'project':
          response = await aiAgentService.generateFinalProject(
            { course_id: courseId },
            handleProgressUpdate,
          );
          break;

        default:
          setError('Unknown content type');
          setLoading(false);
          return;
      }

      // Store task_id for cancellation
      if (response && 'task_id' in response) {
        setTaskId(response.task_id as string);
      }

      const isUsableResponse = (response.success || response.status === 'partial_success') && response.data;
      
      if (isUsableResponse) {
        setSuccess(true);
        onGenerate(response.data);
        setCustomInput('');
        
        if (response.status === 'partial_success') {
          setError(response.message || 'Content generated with some limitations. You may want to review and enhance it.');
        }
        
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(response.message || 'Failed to generate content');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
      setTaskId(null);
      setTaskStatus(null);
    }
  };

  const config = getTypeConfig();
  const progress = taskStatus?.progress ?? 0;
  const isBatchWithSteps = taskStatus && taskStatus.total_steps > 1;

  const getTypeIcon = () => {
    switch (type) {
      case 'module': return <Layers className="w-5 h-5" />;
      case 'lesson': return <Brain className="w-5 h-5" />;
      default: return <Zap className="w-5 h-5" />;
    }
  };

  return (
    <Card className="border-purple-200/80 dark:border-purple-800/60 shadow-md overflow-hidden">
      {/* Gradient accent bar */}
      <div className="h-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-600" />

      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2.5 text-lg">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-sm">
            {getTypeIcon()}
          </div>
          {config.title}
        </CardTitle>
        <CardDescription className="text-sm">{config.description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Context info */}
        {(context.courseTitle || context.moduleTitle) && (
          <div className="flex flex-wrap gap-2">
            {context.courseTitle && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-md text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                {context.courseTitle}
              </span>
            )}
            {context.moduleTitle && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-md text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {context.moduleTitle}
              </span>
            )}
          </div>
        )}

        <div>
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder={config.placeholder}
            className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-slate-800 dark:text-white text-sm transition-shadow"
            disabled={loading}
          />
        </div>

        {error && (
          <Alert variant="destructive" className="py-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800 py-2">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription className="text-sm">Content generated successfully!</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleGenerate}
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all"
            size="default"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {taskStatus ? `Step ${taskStatus.current_step}/${taskStatus.total_steps}` : 'Starting...'}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                {config.buttonText}
              </>
            )}
          </Button>

          {loading && (
            <Button
              onClick={handleCancel}
              variant="outline"
              size="default"
              className="shrink-0 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              <XCircle className="w-4 h-4 mr-1" />
              Cancel
            </Button>
          )}
        </div>

        {/* Step-by-step progress panel */}
        {loading && (
          <div className="space-y-3 p-4 bg-gradient-to-br from-purple-50/80 to-indigo-50/50 dark:from-purple-900/15 dark:to-indigo-900/10 rounded-xl border border-purple-200/60 dark:border-purple-800/40">
            {/* Current step description */}
            <div className="flex items-center gap-2.5 text-sm text-purple-700 dark:text-purple-300">
              <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-800/40 flex items-center justify-center shrink-0">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <span className="truncate font-medium">
                {taskStatus?.current_step_description || 'Submitting task to background...'}
              </span>
            </div>

            {/* Progress bar */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2.5 bg-purple-100 dark:bg-purple-900/30 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${Math.max(3, taskStatus ? progress : Math.min(10, elapsedSeconds))}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 tabular-nums min-w-[48px] text-right">
                {taskStatus ? `${Math.round(progress)}%` : `${elapsedSeconds}s`}
              </span>
            </div>

            {/* Step list for multi-step tasks */}
            {isBatchWithSteps && taskStatus.steps.length > 0 && (
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
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
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {step.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                    {step.status === 'in_progress' && <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />}
                    {step.status === 'failed' && <XCircle className="w-3.5 h-3.5 shrink-0" />}
                    {step.status === 'pending' && <CircleDot className="w-3.5 h-3.5 shrink-0 opacity-30" />}
                    <span className="truncate">{step.description}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Elapsed time */}
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-purple-100 dark:border-purple-800/30">
              <span>Elapsed: {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, '0')}</span>
              {batchMode && <span className="text-purple-500 dark:text-purple-400">Runs in background — safe to wait</span>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AIContentGenerator;
