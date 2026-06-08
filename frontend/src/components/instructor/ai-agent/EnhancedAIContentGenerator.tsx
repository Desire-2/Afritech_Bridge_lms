"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Settings,
  RefreshCw,
  Eye,
  Download,
  Clock,
  XCircle,
  CircleDot,
  AlertTriangle,
  TimerReset
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';

import aiAgentService, { 
  TaskStatus,
  QualityAssessment
} from '@/services/ai-agent.service';
import { AIProgressTracker } from './AIProgressTracker';
import QualityAssessmentDisplay from './QualityAssessmentDisplay';

interface EnhancedAIContentGeneratorProps {
  type: 'course' | 'module' | 'lesson' | 'quiz';
  courseId?: number;
  moduleId?: number;
  onGenerate?: (data: any) => void;
  className?: string;
}

const EnhancedAIContentGenerator: React.FC<EnhancedAIContentGeneratorProps> = ({
  type,
  courseId,
  moduleId,
  onGenerate,
  className = ''
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [quality, setQuality] = useState<QualityAssessment | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Background task state
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null);
  const [waitRemaining, setWaitRemaining] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    targetAudience: '',
    difficulty: 'intermediate',
    duration: '',
    topic: '',
    keywords: '',
    requirements: ''
  });
  
  // Advanced settings
  const [settings, setSettings] = useState({
    creativity: 0.7,
    includeExamples: true,
    includeExercises: true,
    generateQuiz: type === 'lesson',
    detailLevel: 'comprehensive'
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Elapsed time tracker
  useEffect(() => {
    if (isGenerating) {
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
  }, [isGenerating]);

  // Rate limit countdown
  useEffect(() => {
    const rl = taskStatus?.rate_limit_info;
    if (!rl?.is_waiting) {
      setWaitRemaining(0);
      return;
    }
    setWaitRemaining(rl.wait_remaining_seconds);
    const interval = setInterval(() => {
      setWaitRemaining(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [taskStatus?.rate_limit_info?.is_waiting, taskStatus?.rate_limit_info?.wait_remaining_seconds]);

  const handleProgressUpdate = useCallback((status: TaskStatus) => {
    setTaskStatus(status);
  }, []);

  const handleCancel = useCallback(async () => {
    if (taskId) {
      await aiAgentService.cancelTask(taskId);
      setIsGenerating(false);
      setTaskId(null);
      setTaskStatus(null);
      setError('Generation cancelled');
    }
  }, [taskId]);

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      setError(null);
      setResult(null);
      setQuality(null);
      setTaskId(null);
      setTaskStatus(null);

      let response: any;

      switch (type) {
        case 'course':
          response = await aiAgentService.generateCourseOutline(
            {
              topic: formData.title,
              target_audience: formData.targetAudience,
              learning_objectives: formData.requirements,
            },
            handleProgressUpdate,
          );
          break;

        case 'module':
          if (!courseId) {
            setError('Course ID is required for module generation');
            setIsGenerating(false);
            return;
          }
          response = await aiAgentService.generateModuleContent(
            { course_id: courseId, module_title: formData.title.trim() },
            handleProgressUpdate,
          );
          break;

        case 'lesson':
          if (!courseId || !moduleId) {
            setError('Course and Module IDs are required for lesson generation');
            setIsGenerating(false);
            return;
          }
          response = await aiAgentService.generateLessonContent(
            {
              course_id: courseId,
              module_id: moduleId,
              lesson_title: formData.title.trim(),
              lesson_description: formData.description,
            },
            handleProgressUpdate,
          );
          break;

        case 'quiz':
          if (!courseId || !moduleId) {
            setError('Course and Module IDs are required for quiz generation');
            setIsGenerating(false);
            return;
          }
          const numQuestions = parseInt(formData.topic) || 5;
          response = await aiAgentService.generateQuizQuestions(
            {
              course_id: courseId,
              module_id: moduleId,
              num_questions: numQuestions,
              question_types: ['multiple_choice', 'true_false'],
            },
            handleProgressUpdate,
          );
          break;
      }

      // Store task_id for cancellation
      if (response && 'task_id' in response) {
        setTaskId(response.task_id as string);
      }

      const isUsableResponse = (response.success || response.status === 'partial_success') && response.data;
      
      if (isUsableResponse) {
        setResult(response.data);
        if (response.quality_assessment) {
          setQuality(response.quality_assessment);
        }
        onGenerate?.(response.data);
      } else {
        setError(response.message || 'Failed to generate content');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
      console.error('Generation error:', err);
    } finally {
      setIsGenerating(false);
      setTaskId(null);
      setTaskStatus(null);
    }
  };

  const handleRetry = () => {
    setError(null);
    handleGenerate();
  };

  const isFormValid = () => {
    return formData.title.trim() && formData.description.trim();
  };

  const progress = taskStatus?.progress ?? 0;
  const isBatchWithSteps = taskStatus && taskStatus.total_steps > 1;

  return (
    <div className={`space-y-6 ${className}`}>
      <Tabs defaultValue="generate" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="generate">Generate</TabsTrigger>
          <TabsTrigger value="progress" disabled={!isGenerating && !result}>
            {isGenerating ? 'Progress' : 'Results'}
          </TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Generation Tab */}
        <TabsContent value="generate" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                {type.charAt(0).toUpperCase() + type.slice(1)} Generation
              </CardTitle>
              <CardDescription>
                Provide details about the {type} you want to generate
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    placeholder={`Enter ${type} title`}
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    disabled={isGenerating}
                  />
                </div>
                
                <div>
                  <Label htmlFor="difficulty">Difficulty Level</Label>
                  <select
                    id="difficulty"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                    value={formData.difficulty}
                    onChange={(e) => handleInputChange('difficulty', e.target.value)}
                    disabled={isGenerating}
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder={`Describe what this ${type} should cover`}
                  rows={3}
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  disabled={isGenerating}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="audience">Target Audience</Label>
                  <Input
                    id="audience"
                    placeholder="Who is this for?"
                    value={formData.targetAudience}
                    onChange={(e) => handleInputChange('targetAudience', e.target.value)}
                    disabled={isGenerating}
                  />
                </div>
                
                {type === 'quiz' && (
                  <div>
                    <Label htmlFor="topic">Number of Questions</Label>
                    <Input
                      id="topic"
                      placeholder="Number of questions (default: 5)"
                      value={formData.topic}
                      onChange={(e) => handleInputChange('topic', e.target.value)}
                      disabled={isGenerating}
                    />
                  </div>
                )}
              </div>
              
              <div>
                <Label htmlFor="requirements">Learning Objectives/Requirements</Label>
                <Textarea
                  id="requirements"
                  placeholder="List key learning objectives (one per line)"
                  rows={3}
                  value={formData.requirements}
                  onChange={(e) => handleInputChange('requirements', e.target.value)}
                  disabled={isGenerating}
                />
              </div>
              
              {error && !isGenerating && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm flex items-center justify-between">
                    <span>{error}</span>
                    <Button variant="outline" size="sm" onClick={handleRetry}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Retry
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={handleGenerate}
                  disabled={!isFormValid() || isGenerating}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-md"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {taskStatus ? `Step ${taskStatus.current_step}/${taskStatus.total_steps}` : 'Starting...'}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate {type.charAt(0).toUpperCase() + type.slice(1)}
                    </>
                  )}
                </Button>

                {isGenerating && (
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

              {/* Real-time progress panel during generation */}
              {isGenerating && (
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

                  {/* Rate limit card inside progress panel */}
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

                  {/* Elapsed time */}
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-purple-100 dark:border-purple-800/30">
                    <span>Elapsed: {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, '0')}</span>
                    <span className="text-purple-500 dark:text-purple-400">Runs in background — safe to wait</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Progress/Results Tab */}
        <TabsContent value="progress" className="space-y-4">
          {isGenerating && taskStatus && (
            <AIProgressTracker 
              progress={null}
              taskStatus={taskStatus}
              onCancel={handleCancel}
              rateLimitInfo={taskStatus.rate_limit_info}
            />
          )}
          
          {result && !isGenerating && (
            <div className="space-y-4">
              {quality && (
                <QualityAssessmentDisplay assessment={quality} />
              )}
              
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      Generated Content
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4 mr-2" />
                        Preview
                      </Button>
                      <Button variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        Export
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <pre className="whitespace-pre-wrap text-sm">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {!isGenerating && !result && !error && (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <div className="text-center text-muted-foreground">
                  <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No generation results yet</p>
                  <p className="text-sm">Generate content to see results here</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Generation Settings
              </CardTitle>
              <CardDescription>
                Customize how the AI generates your content
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <div>
                <Label>Creativity Level: {settings.creativity}</Label>
                <Slider
                  value={[settings.creativity]}
                  onValueChange={(value) => setSettings(prev => ({ ...prev, creativity: value[0] }))}
                  min={0.1}
                  max={1.0}
                  step={0.1}
                  className="mt-2"
                  disabled={isGenerating}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Higher values produce more creative and diverse content
                </p>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Include Examples</Label>
                    <p className="text-sm text-muted-foreground">Add practical examples to content</p>
                  </div>
                  <Switch
                    checked={settings.includeExamples}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, includeExamples: checked }))}
                    disabled={isGenerating}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Include Exercises</Label>
                    <p className="text-sm text-muted-foreground">Add practice exercises</p>
                  </div>
                  <Switch
                    checked={settings.includeExercises}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, includeExercises: checked }))}
                    disabled={isGenerating}
                  />
                </div>
                
                {type === 'lesson' && (
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Generate Quiz</Label>
                      <p className="text-sm text-muted-foreground">Include quiz questions</p>
                    </div>
                    <Switch
                      checked={settings.generateQuiz}
                      onCheckedChange={(checked) => setSettings(prev => ({ ...prev, generateQuiz: checked }))}
                      disabled={isGenerating}
                    />
                  </div>
                )}
              </div>
              
              <div>
                <Label>Detail Level</Label>
                <select
                  className="w-full px-3 py-2 mt-2 border border-gray-300 rounded-md dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                  value={settings.detailLevel}
                  onChange={(e) => setSettings(prev => ({ ...prev, detailLevel: e.target.value }))}
                  disabled={isGenerating}
                >
                  <option value="brief">Brief</option>
                  <option value="detailed">Detailed</option>
                  <option value="comprehensive">Comprehensive</option>
                </select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EnhancedAIContentGenerator;
