"use client";

import React, { useState, useCallback } from 'react';
import { 
  Sparkles, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Settings,
  RefreshCw,
  Eye,
  Download
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
  GenerationProgress, 
  QualityAssessment,
  CourseOutlineRequest,
  ModuleContentRequest,
  LessonContentRequest,
  QuizQuestionsRequest
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
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [result, setResult] = useState<any>(null);
  const [quality, setQuality] = useState<QualityAssessment | null>(null);
  const [error, setError] = useState<string | null>(null);
  
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

  const mockProgressSimulation = useCallback(async () => {
    const stages = [
      { stage: 'initializing', progress: 10 },
      { stage: 'analyzing_requirements', progress: 25 },
      { stage: 'generating_content', progress: 60 },
      { stage: 'quality_validation', progress: 85 },
      { stage: 'finalizing', progress: 100 }
    ];

    for (const stage of stages) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setProgress({
        stage: stage.stage,
        progress: stage.progress,
        estimated_remaining: (100 - stage.progress) * 0.05,
        can_cancel: stage.progress < 85,
        message: `Processing ${stage.stage.replace('_', ' ')}...`
      });
    }
  }, []);

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      setError(null);
      setResult(null);
      setQuality(null);

      // Start progress simulation
      mockProgressSimulation();

      let request: any;
      let response: any;

      switch (type) {
        case 'course':
          request = {
            title: formData.title,
            description: formData.description,
            target_audience: formData.targetAudience,
            difficulty_level: formData.difficulty,
            estimated_duration: formData.duration
          } as CourseOutlineRequest;
          response = await aiAgentService.generateCourseOutline(request);
          break;

        case 'module':
          request = {
            course_id: courseId,
            title: formData.title,
            description: formData.description,
            learning_objectives: formData.requirements.split('\n').filter(Boolean),
            difficulty_level: formData.difficulty
          } as ModuleContentRequest;
          response = await aiAgentService.generateModuleContent(request);
          break;

        case 'lesson':
          request = {
            module_id: moduleId,
            title: formData.title,
            description: formData.description,
            learning_objectives: formData.requirements.split('\n').filter(Boolean),
            difficulty_level: formData.difficulty,
            include_examples: settings.includeExamples,
            include_exercises: settings.includeExercises
          } as LessonContentRequest;
          response = await aiAgentService.generateLessonContent(request);
          break;

        case 'quiz':
          request = {
            module_id: moduleId,
            title: formData.title,
            topic: formData.topic,
            difficulty_level: formData.difficulty,
            question_count: 5
          } as QuizQuestionsRequest;
          response = await aiAgentService.generateQuizQuestions(request);
          break;
      }

      setResult(response.content);
      if (response.quality_assessment) {
        setQuality(response.quality_assessment);
      }
      
      onGenerate?.(response.content);

    } catch (error: any) {
      setError(error.message || 'Generation failed');
      console.error('Generation error:', error);
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  };

  const handleCancel = () => {
    setIsGenerating(false);
    setProgress(null);
  };

  const handleRetry = () => {
    setError(null);
    handleGenerate();
  };

  const isFormValid = () => {
    return formData.title.trim() && formData.description.trim();
  };

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
                  />
                </div>
                
                <div>
                  <Label htmlFor="difficulty">Difficulty Level</Label>
                  <select
                    id="difficulty"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    value={formData.difficulty}
                    onChange={(e) => handleInputChange('difficulty', e.target.value)}
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
                  />
                </div>
                
                {type === 'quiz' && (
                  <div>
                    <Label htmlFor="topic">Topic Focus</Label>
                    <Input
                      id="topic"
                      placeholder="Specific topic or concept"
                      value={formData.topic}
                      onChange={(e) => handleInputChange('topic', e.target.value)}
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
                />
              </div>
              
              <div className="flex justify-end pt-4">
                <Button 
                  onClick={handleGenerate}
                  disabled={!isFormValid() || isGenerating}
                  className="min-w-32"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate {type.charAt(0).toUpperCase() + type.slice(1)}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Progress/Results Tab */}
        <TabsContent value="progress" className="space-y-4">
          {isGenerating && progress && (
            <AIProgressTracker 
              progress={progress}
              onCancel={handleCancel}
            />
          )}
          
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>{error}</span>
                <Button variant="outline" size="sm" onClick={handleRetry}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
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
                    />
                  </div>
                )}
              </div>
              
              <div>
                <Label>Detail Level</Label>
                <select
                  className="w-full px-3 py-2 mt-2 border border-gray-300 rounded-md"
                  value={settings.detailLevel}
                  onChange={(e) => setSettings(prev => ({ ...prev, detailLevel: e.target.value }))}
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