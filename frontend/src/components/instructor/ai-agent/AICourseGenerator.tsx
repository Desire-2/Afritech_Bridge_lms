"use client";

import React, { useState } from 'react';
import { Sparkles, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import aiAgentService, { CourseOutlineRequest } from '@/services/ai-agent.service';

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

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('Please enter a course topic');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const request: CourseOutlineRequest = {
        topic: topic.trim(),
        target_audience: targetAudience.trim(),
        learning_objectives: learningObjectives.trim()
      };

      const response = await aiAgentService.generateCourseOutline(request);

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
    }
  };

  return (
    <Card className="border-purple-200 dark:border-purple-800">
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

        <Button
          onClick={handleGenerate}
          disabled={loading || !topic.trim()}
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating with AI...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Course Outline
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default AICourseGenerator;
