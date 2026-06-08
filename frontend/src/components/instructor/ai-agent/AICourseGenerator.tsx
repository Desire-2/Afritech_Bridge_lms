"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Sparkles, Loader2, AlertCircle, CheckCircle2, Clock, XCircle, CircleDot, TimerReset } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import aiAgentService, { TaskStatus } from '@/services/ai-agent.service';

interface AICourseGeneratorProps {
  onGenerate: (data: any) => void;
  defaultTopic?: string;
}

export const AICourseGenerator: React.FC<AICourseGeneratorProps> = ({ onGenerate, defaultTopic = '' }) => {
  const [topic, setTopic] = useState(defaultTopic);
  const [targetAudience, setTargetAudience] = useState('');
  const [learningObjectives, setLearningObjectives] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Background task state
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null);
  const [waitRemaining, setWaitRemaining] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Elapsed time tracker
  useEffect(() => {
    if (loading) {
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => setElapsedSeconds(prev => prev + 1), 1000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [loading]);

  // Rate limit countdown
  useEffect(() => {
    const rl = taskStatus?.rate_limit_info;
    if (!rl?.is_waiting) { setWaitRemaining(0); return; }
    setWaitRemaining(rl.wait_remaining_seconds);
    const interval = setInterval(() => setWaitRemaining(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(interval);
  }, [taskStatus?.rate_limit_info?.is_waiting, taskStatus?.rate_limit_info?.wait_remaining_seconds]);

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

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('Please enter a course topic');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);
    setTaskId(null);
    setTaskStatus(null);

    try {
      const response = await aiAgentService.generateCourseOutline(
        {
          topic: topic.trim(),
          target_audience: targetAudience.trim(),
          learning_objectives: learningObjectives.trim()
        },
        handleProgressUpdate,
      );

      if (response && 'task_id' in response) {
        setTaskId(response.task_id as string);
      }

      if (response.success && response.data) {
        setSuccess(true);
        onGenerate(response.data);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(response.message || 'Failed to generate course outline');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
      setTaskId(null);
      setTaskStatus(null);
    }
  };

  const progress = taskStatus?.progress ?? 0;
  const isBatchWithSteps = taskStatus && taskStatus.total_steps > 1;

  return (
    <Card className="border-purple-200 dark:border-purple-800 overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-600" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          AI Course Generator
        </CardTitle>
        <CardDescription>
          Let AI help you create a comprehensive course outline
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Course Topic <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., Introduction to Machine Learning"
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-slate-800 dark:border-slate-600"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Target Audience (Optional)
          </label>
          <input
            type="text"
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            placeholder="e.g., Beginners with basic programming knowledge"
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-slate-800 dark:border-slate-600"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Learning Objectives (Optional)
          </label>
          <textarea
            value={learningObjectives}
            onChange={(e) => setLearningObjectives(e.target.value)}
            placeholder="e.g., Understand ML algorithms, Build prediction models, Deploy ML applications"
            rows={3}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-slate-800 dark:border-slate-600"
            disabled={loading}
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="bg-green-50 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>Course outline generated successfully!</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleGenerate}
            disabled={loading || !topic.trim()}
            className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {taskStatus ? `Step ${taskStatus.current_step}/${taskStatus.total_steps}` : 'Generating...'}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Course Outline
              </>
            )}
          </Button>

          {loading && (
            <Button
              onClick={handleCancel}
              variant="outline"
              className="shrink-0 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              <XCircle className="w-4 h-4 mr-1" />
              Cancel
            </Button>
          )}
        </div>

        {/* Real-time progress panel */}
        {loading && (
          <div className="space-y-3 p-4 bg-gradient-to-br from-purple-50/80 to-indigo-50/50 dark:from-purple-900/15 dark:to-indigo-900/10 rounded-xl border border-purple-200/60 dark:border-purple-800/40">
            <div className="flex items-center gap-2.5 text-sm text-purple-700 dark:text-purple-300">
              <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-800/40 flex items-center justify-center shrink-0">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <span className="truncate font-medium">
                {taskStatus?.current_step_description || 'Generating course outline...'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-2.5 bg-purple-100 dark:bg-purple-900/30 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-700 ease-out ${
                    taskStatus?.status === 'rate_limited' 
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500' 
                      : 'bg-gradient-to-r from-purple-500 to-indigo-500'
                  }`}
                  style={{ width: `${Math.max(3, taskStatus ? progress : Math.min(10, elapsedSeconds))}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 tabular-nums min-w-[48px] text-right">
                {taskStatus ? `${Math.round(progress)}%` : `${elapsedSeconds}s`}
              </span>
            </div>

            {/* Step list */}
            {isBatchWithSteps && taskStatus.steps.length > 0 && (
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
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
            {taskStatus?.status === 'rate_limited' && (
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
                      style={{ width: taskStatus?.rate_limit_info?.wait_duration_seconds ? `${((taskStatus.rate_limit_info.wait_duration_seconds - waitRemaining) / taskStatus.rate_limit_info.wait_duration_seconds) * 100}%` : '0%' }}
                    />
                  </div>
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Auto-retrying after cooldown — no action needed
                </p>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-purple-100 dark:border-purple-800/30">
              <span>Elapsed: {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, '0')}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AICourseGenerator;
