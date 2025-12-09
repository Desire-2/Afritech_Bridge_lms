/**
 * Example: Enhanced Module Management with AI Integration
 * Shows how to add AI assistance to existing ModuleManagement component
 */

"use client";

import React, { useState } from 'react';
import { Sparkles, Plus, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AIContentGenerator } from '@/components/instructor/ai-agent';
import { Course, Module } from '@/types/api';
import CourseCreationService from '@/services/course-creation.service';

interface EnhancedModuleManagementProps {
  course: Course;
  onUpdate: () => void;
}

export const EnhancedModuleManagement: React.FC<EnhancedModuleManagementProps> = ({
  course,
  onUpdate
}) => {
  const [modules, setModules] = useState<Module[]>(course.modules || []);
  const [showModuleForm, setShowModuleForm] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [moduleForm, setModuleForm] = useState({
    title: '',
    description: '',
    learning_objectives: '',
    is_published: false
  });

  // Handle AI-generated module data
  const handleAIGenerate = (aiData: any) => {
    setModuleForm({
      title: aiData.title || '',
      description: aiData.description || '',
      learning_objectives: aiData.learning_objectives || '',
      is_published: false
    });
    
    // Show the form to review
    setShowModuleForm(true);
    setShowAIAssistant(false);
  };

  // Create new module
  const handleCreateModule = async () => {
    try {
      const response = await CourseCreationService.createModule(course.id, moduleForm);
      
      if (response.success) {
        setModules([...modules, response.data]);
        setModuleForm({
          title: '',
          description: '',
          learning_objectives: '',
          is_published: false
        });
        setShowModuleForm(false);
        onUpdate();
      }
    } catch (error: any) {
      alert('Failed to create module: ' + error.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with AI Toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Course Modules</h2>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowAIAssistant(!showAIAssistant)}
            variant="outline"
            className="border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-400"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {showAIAssistant ? 'Hide AI Assistant' : 'AI Assistant'}
          </Button>
          <Button
            onClick={() => {
              setShowModuleForm(true);
              setEditingModule(null);
              setModuleForm({
                title: '',
                description: '',
                learning_objectives: '',
                is_published: false
              });
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Module
          </Button>
        </div>
      </div>

      {/* AI Assistant Panel */}
      {showAIAssistant && (
        <AIContentGenerator
          type="module"
          courseId={course.id}
          onGenerate={handleAIGenerate}
          context={{
            courseTitle: course.title
          }}
        />
      )}

      {/* Module Creation Form */}
      {showModuleForm && (
        <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle>
              {editingModule ? 'Edit Module' : 'Create New Module'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Module Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={moduleForm.title}
                onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-600"
                placeholder="e.g., Introduction to Python Basics"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Description
              </label>
              <textarea
                value={moduleForm.description}
                onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-600"
                rows={3}
                placeholder="Brief description of the module..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Learning Objectives
              </label>
              <textarea
                value={moduleForm.learning_objectives}
                onChange={(e) => setModuleForm({ ...moduleForm, learning_objectives: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-600"
                rows={3}
                placeholder="• Objective 1&#10;• Objective 2&#10;• Objective 3"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="module_published"
                checked={moduleForm.is_published}
                onChange={(e) => setModuleForm({ ...moduleForm, is_published: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              <label htmlFor="module_published" className="text-sm">
                Publish immediately
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowModuleForm(false);
                  setEditingModule(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateModule}
                disabled={!moduleForm.title}
              >
                {editingModule ? 'Update Module' : 'Create Module'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing Modules List */}
      <div className="space-y-4">
        {modules.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-slate-500">
              No modules yet. Create your first module using the button above or try the AI assistant!
            </CardContent>
          </Card>
        ) : (
          modules.map((module, index) => (
            <Card key={module.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-500">
                        Module {index + 1}
                      </span>
                      {module.is_published && (
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                          Published
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-bold mt-1">{module.title}</h3>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingModule(module);
                        setModuleForm({
                          title: module.title,
                          description: module.description || '',
                          learning_objectives: module.learning_objectives || '',
                          is_published: module.is_published
                        });
                        setShowModuleForm(true);
                      }}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {module.description && (
                <CardContent>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {module.description}
                  </p>
                  {module.learning_objectives && (
                    <div className="mt-3">
                      <h4 className="text-sm font-medium mb-1">Learning Objectives:</h4>
                      <div className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-line">
                        {module.learning_objectives}
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default EnhancedModuleManagement;
