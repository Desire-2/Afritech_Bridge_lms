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
  FileText
 } from 'lucide-react';
import { GenerationProgress } from '@/services/ai-agent.service';

interface AIProgressTrackerProps {
  progress: GenerationProgress | null;
  onCancel?: () => void;
  showDetails?: boolean;
  className?: string;
}

export const AIProgressTracker: React.FC<AIProgressTrackerProps> = ({
  progress,
  onCancel,
  showDetails = true,
  className = ''
}) => {
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    if (!progress || progress.progress >= 100) return;

    const interval = setInterval(() => {
      setTimeElapsed(Date.now() - startTime);
    }, 1000);

    return () => clearInterval(interval);
  }, [progress, startTime]);

  if (!progress) return null;

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
            {getStageIcon(progress.stage)}
            <CardTitle className="text-lg">AI Generation in Progress</CardTitle>
          </div>
          <Badge variant={progress.progress < 100 ? 'default' : 'secondary'}>
            {Math.round(progress.progress)}%
          </Badge>
        </div>
        <CardDescription className="capitalize">
          {progress.stage.replace('_', ' ')}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Progress 
            value={progress.progress} 
            className="h-2"
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Progress</span>
            <span>{Math.round(progress.progress)}% complete</span>
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
              
              {progress.estimated_remaining > 0 && (
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
                  {progress.stage.replace('_', ' ')}
                </Badge>
              </div>
            </div>
          </>
        )}

        {progress.can_cancel && onCancel && progress.progress < 100 && (
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

        {progress.progress >= 100 && (
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