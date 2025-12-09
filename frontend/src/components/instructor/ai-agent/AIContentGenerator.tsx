"use client";

import React, { useState } from 'react';
import { Sparkles, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import aiAgentService from '@/services/ai-agent.service';

interface AIContentGeneratorProps {
  type: 'module' | 'lesson' | 'quiz' | 'assignment' | 'project';
  courseId: number;
  moduleId?: number;
  lessonId?: number;
  onGenerate: (data: any) => void;
  batchMode?: boolean; // New prop for generating multiple items
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

  const getTypeConfig = () => {
    switch (type) {
      case 'module':
        return {
          title: batchMode ? 'AI Batch Module Generator' : 'AI Module Generator',
          description: batchMode ? 'Generate multiple modules with lessons at once' : 'Generate module content based on your course',
          placeholder: batchMode ? 'Number of modules to generate (default: 5)' : 'Optional: Enter module title or topic',
          buttonText: batchMode ? 'Generate Multiple Modules' : 'Generate Module Content'
        };
      case 'lesson':
        return {
          title: batchMode ? 'AI Batch Lesson Generator' : 'AI Lesson Generator',
          description: batchMode ? 'Generate multiple lessons with full content at once' : 'Generate detailed lesson content with markdown formatting',
          placeholder: batchMode ? 'Number of lessons to generate (default: 5)' : 'Optional: Enter lesson title or focus area',
          buttonText: batchMode ? 'Generate Multiple Lessons' : 'Generate Lesson Content'
        };
      case 'quiz':
        return {
          title: 'AI Quiz Generator',
          description: 'Generate quiz questions based on lesson content',
          placeholder: 'Number of questions (default: 5)',
          buttonText: 'Generate Quiz Questions'
        };
      case 'assignment':
        return {
          title: 'AI Assignment Generator',
          description: 'Generate assignment based on module content',
          placeholder: 'Optional: Additional requirements',
          buttonText: 'Generate Assignment'
        };
      case 'project':
        return {
          title: 'AI Project Generator',
          description: 'Generate capstone project for the entire course',
          placeholder: 'Optional: Project focus or requirements',
          buttonText: 'Generate Final Project'
        };
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      let response;

      switch (type) {
        case 'module':
          if (batchMode) {
            // Generate multiple modules
            const numModules = parseInt(customInput) || 5;
            response = await aiAgentService.generateMultipleModules({
              course_id: courseId,
              num_modules: numModules
            });
          } else {
            // Generate single module
            response = await aiAgentService.generateModuleContent({
              course_id: courseId,
              module_title: customInput.trim()
            });
          }
          break;

        case 'lesson':
          if (!moduleId) {
            setError('Module ID is required for lesson generation');
            setLoading(false);
            return;
          }
          if (batchMode) {
            // Generate multiple lessons
            const numLessons = parseInt(customInput) || 5;
            response = await aiAgentService.generateMultipleLessons({
              course_id: courseId,
              module_id: moduleId,
              num_lessons: numLessons
            });
          } else {
            // Generate single lesson
            response = await aiAgentService.generateLessonContent({
              course_id: courseId,
              module_id: moduleId,
              lesson_title: customInput.trim()
            });
          }
          break;

        case 'quiz':
          if (!moduleId) {
            setError('Module ID is required for quiz generation');
            setLoading(false);
            return;
          }
          const numQuestions = parseInt(customInput) || 5;
          response = await aiAgentService.generateQuizQuestions({
            course_id: courseId,
            module_id: moduleId,
            lesson_id: lessonId,
            num_questions: numQuestions,
            question_types: ['multiple_choice', 'true_false']
          });
          break;

        case 'assignment':
          if (!moduleId) {
            setError('Module ID is required for assignment generation');
            setLoading(false);
            return;
          }
          response = await aiAgentService.generateAssignment({
            course_id: courseId,
            module_id: moduleId
          });
          break;

        case 'project':
          response = await aiAgentService.generateFinalProject({
            course_id: courseId
          });
          break;

        default:
          setError('Unknown content type');
          setLoading(false);
          return;
      }

      if (response.success && response.data) {
        setSuccess(true);
        onGenerate(response.data);
        setCustomInput('');
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(response.message || 'Failed to generate content');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const config = getTypeConfig();

  return (
    <Card className="border-purple-200 dark:border-purple-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="w-5 h-5 text-purple-600" />
          {config.title}
        </CardTitle>
        <CardDescription>{config.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {context.courseTitle && (
          <div className="text-sm text-slate-600 dark:text-slate-400">
            <strong>Course:</strong> {context.courseTitle}
          </div>
        )}
        {context.moduleTitle && (
          <div className="text-sm text-slate-600 dark:text-slate-400">
            <strong>Module:</strong> {context.moduleTitle}
          </div>
        )}

        <div>
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder={config.placeholder}
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
            <AlertDescription>Content generated successfully!</AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
          size="sm"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              {config.buttonText}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default AIContentGenerator;
