"use client";

import React, { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Zap,
  Cpu,
  FileText,
  TimerReset,
  Ban
 } from 'lucide-react';
import { GenerationProgress, RateLimitInfo, TaskStatus } from '@/services/ai-agent.service';

interface AIProgressTrackerProps {
  progress: GenerationProgress | null;
  /** Optional: TaskStatus for the new background polling pattern with step details */
  taskStatus?: TaskStatus | null;
  onCancel?: () => void;
  showDetails?: boolean;
  className?: string;
  rateLimitInfo?: RateLimitInfo | null;
}

export const AIProgressTracker: React.FC<AIProgressTrackerProps> = ({
  progress,
  taskStatus,
  onCancel,
  showDetails = true,
  className = '',
  rateLimitInfo = null
}) => {
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [startTime] = useState(Date.now());

  // Derive rateLimitInfo from taskStatus if not explicitly passed
  const resolvedRateLimit = rateLimitInfo ?? taskStatus?.rate_limit_info ?? null;
  
  const [waitRemaining, setWaitRemaining] = useState(resolvedRateLimit?.wait_remaining_seconds ?? 0);

  // Derive a progress percentage from either progress prop or taskStatus
  const derivedProgress = progress?.progress ?? taskStatus?.progress ?? 0;
  const derivedStage = progress?.stage ?? taskStatus?.current_step_description ?? '';
  const isComplete = (progress?.progress ?? 0) >= 100 || taskStatus?.status === 'completed';
  const isCancelable = progress?.can_cancel || taskStatus?.status === 'in_progress' || taskStatus?.status === 'rate_limited';

  useEffect(() => {
    if (!progress && !taskStatus) return;
    if (derivedProgress >= 100 || taskStatus?.status === 'completed') return;

    const interval = setInterval(() => {
      setTimeElapsed(Date.now() - startTime);
    }, 1000);

    return () => clearInterval(interval);
  }, [progress, taskStatus, startTime, derivedProgress]);

  // Rate limit countdown
  useEffect(() => {
    if (!resolvedRateLimit?.is_waiting) {
      setWaitRemaining(0);
      return;
    }
    setWaitRemaining(resolvedRateLimit.wait_remaining_seconds);
    const interval = setInterval(() => {
      setWaitRemaining(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resolvedRateLimit?.is_waiting, resolvedRateLimit?.wait_remaining_seconds]);

  if (!progress && !taskStatus) return null;

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    return minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
  };

  const getStageIcon = (stage: string) => {
    switch (stage.toLowerCase()) {
      case 'initializing':
      case 'setup':
        return <Cpu className="w-4 h-4" />;
      case 'generating':
      case 'processing':
        return <Zap className="w-4 h-4 animate-pulse" />;
      case 'validating':
      case 'quality_check':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'finalizing':
      case 'formatting':
        return <FileText className="w-4 h-4" />;
      default:
        return <Loader2 className="w-4 h-4 animate-spin" />;
    }
  };

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStageIcon(derivedStage)}
            <CardTitle className="text-lg">
              {taskStatus?.status === 'rate_limited' ? 'AI Generation — Rate Limited' : 'AI Generation in Progress'}
            </CardTitle>
          </div>
          <Badge variant={derivedProgress < 100 ? (taskStatus?.status === 'rate_limited' ? 'destructive' : 'default') : 'secondary'}>
            {taskStatus?.status === 'rate_limited' ? 'PAUSED' : taskStatus ? `Step ${taskStatus.current_step}/${taskStatus.total_steps}` : `${Math.round(derivedProgress)}%`}
          </Badge>
        </div>
        <CardDescription className="capitalize">
          {derivedStage.replace(/_/g, ' ') || (taskStatus?.current_step_description || 'Processing...')}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Progress 
            value={derivedProgress} 
            className={`h-2 ${taskStatus?.status === 'rate_limited' ? 'bg-amber-200 dark:bg-amber-800/30' : ''}`}
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Progress</span>
            <span>{Math.round(derivedProgress)}% complete</span>
          </div>
        </div>

        {showDetails && (
          <>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">Time Elapsed</p>
                  <p className="text-muted-foreground">{formatTime(timeElapsed)}</p>
                </div>
              </div>
              
              {progress?.estimated_remaining && progress.estimated_remaining > 0 && (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Estimated Remaining</p>
                    <p className="text-muted-foreground">
                      {formatTime(progress.estimated_remaining * 1000)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Current Stage</span>
                <Badge variant="outline" className="capitalize">
                  {derivedStage.replace(/_/g, ' ')}
                </Badge>
              </div>
            </div>
          </>
        )}

        {resolvedRateLimit?.is_waiting && (
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700/50 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <p className="font-medium text-amber-800 dark:text-amber-300">Rate Limited</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-amber-600 dark:text-amber-400 text-xs font-medium">WAIT TIME</p>
                <p className="text-2xl font-bold text-amber-900 dark:text-amber-100 tabular-nums">
                  {Math.floor(waitRemaining / 60)}:{String(waitRemaining % 60).padStart(2, '0')}
                </p>
              </div>
              <div>
                <p className="text-amber-600 dark:text-amber-400 text-xs font-medium">PROVIDER</p>
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100 capitalize">
                  {resolvedRateLimit.provider || 'Unknown'}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Attempt {resolvedRateLimit.attempt || 1}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
              <TimerReset className="w-3.5 h-3.5" />
              <span>Auto-retrying after cooldown — no action needed</span>
            </div>
            <div className="w-full h-1.5 bg-amber-200 dark:bg-amber-700/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-amber-500 rounded-full transition-all duration-1000 ease-linear"
                style={{ width: resolvedRateLimit.wait_duration_seconds > 0 ? `${((resolvedRateLimit.wait_duration_seconds - waitRemaining) / resolvedRateLimit.wait_duration_seconds) * 100}%` : '0%' }}
              />
            </div>
          </div>
        )}

        {isCancelable && onCancel && derivedProgress < 100 && taskStatus?.status !== 'completed' && (
          <div className="flex justify-end pt-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={onCancel}
              className="text-red-600 hover:text-red-700"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Cancel Generation
            </Button>
          </div>
        )}

        {(derivedProgress >= 100 || taskStatus?.status === 'completed') && (
          <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <div>
              <p className="font-medium text-green-800">Generation Complete!</p>
              <p className="text-sm text-green-600">
                Completed in {formatTime(timeElapsed)}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AIProgressTracker;