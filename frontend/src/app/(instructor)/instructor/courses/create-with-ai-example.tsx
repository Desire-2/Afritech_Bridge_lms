/**
 * Example: Enhanced Course Creation Page with AI Integration
 * Shows how to integrate AI assistant into existing course creation workflow
 */

"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, BookOpen, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AICourseGenerator } from '@/components/instructor/ai-agent';
import CourseCreationService from '@/services/course-creation.service';

export default function CreateCourseWithAIPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'manual' | 'ai'>('ai');
  const [loading, setLoading] = useState(false);
  const [courseForm, setCourseForm] = useState({
    title: '',
    description: '',
    learning_objectives: '',
    target_audience: '',
    estimated_duration: '',
    instructor_id: 0,
    is_published: false
  });

  // Handle AI-generated course data
  const handleAIGenerate = (aiData: any) => {
    setCourseForm({
      ...courseForm,
      title: aiData.title || '',
      description: aiData.description || '',
      learning_objectives: aiData.learning_objectives || '',
      target_audience: aiData.target_audience || '',
      estimated_duration: aiData.estimated_duration || ''
    });
    
    // Auto-switch to manual tab to review/edit
    setActiveTab('manual');
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await CourseCreationService.createCourse(courseForm);
      
      if (response.success) {
        // Navigate to module creation
        router.push(`/instructor/courses/${response.data.id}/modules`);
      } else {
        alert('Failed to create course: ' + response.message);
      }
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Create New Course</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Use AI to generate a course outline or create manually
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="ai" className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            AI Assistant
          </TabsTrigger>
          <TabsTrigger value="manual" className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Manual Entry
          </TabsTrigger>
        </TabsList>

        {/* AI Generation Tab */}
        <TabsContent value="ai" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI-Powered Course Creation</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Describe your course topic and let AI generate a comprehensive outline including
                title, description, learning objectives, and suggested modules.
              </p>
              
              <AICourseGenerator onGenerate={handleAIGenerate} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Manual Entry Tab */}
        <TabsContent value="manual" className="space-y-6">
          <form onSubmit={handleSubmit}>
            <Card>
              <CardHeader>
                <CardTitle>Course Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Course Title */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Course Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={courseForm.title}
                    onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-600"
                    placeholder="e.g., Introduction to Machine Learning"
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={courseForm.description}
                    onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-600"
                    rows={4}
                    placeholder="Provide a detailed description of the course..."
                    required
                  />
                </div>

                {/* Learning Objectives */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Learning Objectives <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={courseForm.learning_objectives}
                    onChange={(e) => setCourseForm({ ...courseForm, learning_objectives: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-600"
                    rows={4}
                    placeholder="• Objective 1&#10;• Objective 2&#10;• Objective 3"
                    required
                  />
                </div>

                {/* Target Audience */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Target Audience
                  </label>
                  <input
                    type="text"
                    value={courseForm.target_audience}
                    onChange={(e) => setCourseForm({ ...courseForm, target_audience: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-600"
                    placeholder="e.g., Beginners with basic programming knowledge"
                  />
                </div>

                {/* Estimated Duration */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Estimated Duration
                  </label>
                  <input
                    type="text"
                    value={courseForm.estimated_duration}
                    onChange={(e) => setCourseForm({ ...courseForm, estimated_duration: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-600"
                    placeholder="e.g., 40 hours"
                  />
                </div>

                {/* Is Published */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_published"
                    checked={courseForm.is_published}
                    onChange={(e) => setCourseForm({ ...courseForm, is_published: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300"
                  />
                  <label htmlFor="is_published" className="text-sm font-medium">
                    Publish course immediately
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || !courseForm.title || !courseForm.description}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {loading ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Create Course
                  </>
                )}
              </Button>
            </div>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
