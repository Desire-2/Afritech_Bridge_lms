"use client";

import React, { useState } from 'react';
import { Course, EnhancedModule, EnhancedLesson, ModuleOrderUpdate, LessonOrderUpdate } from '@/types/api';
import CourseCreationService from '@/services/course-creation.service';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

interface ModuleManagementProps {
  course: Course;
  onCourseUpdate: (course: Course) => void;
}

const ModuleManagement: React.FC<ModuleManagementProps> = ({ course, onCourseUpdate }) => {
  // Safety check - don't render if course is null or undefined
  if (!course || !course.id) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-slate-600 dark:text-slate-300">Loading course data...</div>
      </div>
    );
  }

  const [modules, setModules] = useState<EnhancedModule[]>(course.modules as EnhancedModule[] || []);
  const [showModuleForm, setShowModuleForm] = useState(false);
  const [editingModule, setEditingModule] = useState<EnhancedModule | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set());
  const [showLessonForm, setShowLessonForm] = useState<{ moduleId: number | null }>({ moduleId: null });
  const [editingLesson, setEditingLesson] = useState<{ moduleId: number; lesson: EnhancedLesson } | null>(null);
  
  const [moduleForm, setModuleForm] = useState({
    title: '',
    description: '',
    learning_objectives: '',
    is_published: false
  });

  const [lessonForm, setLessonForm] = useState({
    title: '',
    content_type: 'text' as 'text' | 'video' | 'pdf' | 'mixed',
    content_data: '',
    description: '',
    learning_objectives: '',
    duration_minutes: '',
    is_published: false
  });

  const resetModuleForm = () => {
    setModuleForm({
      title: '',
      description: '',
      learning_objectives: '',
      is_published: false
    });
  };

  const resetLessonForm = () => {
    setLessonForm({
      title: '',
      content_type: 'text',
      content_data: '',
      description: '',
      learning_objectives: '',
      duration_minutes: '',
      is_published: false
    });
  };

  // Helper function to get content data configuration based on content type
  const getContentDataConfig = (contentType: string) => {
    switch (contentType) {
      case 'video':
        return {
          label: 'Video URL or Embed Code',
          placeholder: 'Enter YouTube URL, Vimeo URL, or embed code (e.g., https://www.youtube.com/watch?v=...)',
          helperText: 'Supports YouTube, Vimeo, and other video platforms. You can also paste embed codes.',
          inputType: 'textarea' as const,
          rows: 3
        };
      case 'pdf':
        return {
          label: 'PDF File URL or Path',
          placeholder: 'Enter PDF file URL or path (e.g., /uploads/documents/lesson.pdf or https://...)',
          helperText: 'Provide a direct link to the PDF file or upload path.',
          inputType: 'input' as const,
          rows: 1
        };
      case 'mixed':
        return {
          label: 'Mixed Content (JSON Format)',
          placeholder: 'Enter content in JSON format:\n{\n  "text": "Your text content...",\n  "video_url": "https://...",\n  "pdf_url": "https://...",\n  "images": ["url1", "url2"]\n}',
          helperText: 'Use JSON format to combine different content types (text, videos, PDFs, images).',
          inputType: 'textarea' as const,
          rows: 8
        };
      case 'text':
      default:
        return {
          label: 'Text Content (Markdown Supported)',
          placeholder: 'Enter your lesson content here. You can use Markdown formatting:\n\n# Heading\n## Subheading\n- Bullet point\n**bold text**\n*italic text*\n\nAdd paragraphs, code blocks, and more...',
          helperText: 'Supports Markdown formatting for rich text content. Use headings, lists, code blocks, etc.',
          inputType: 'textarea' as const,
          rows: 8
        };
    }
  };

  const handleCreateModule = async () => {
    try {
      const newModule = await CourseCreationService.createModule(course.id, moduleForm);
      setModules([...modules, newModule]);
      setShowModuleForm(false);
      resetModuleForm();
    } catch (error) {
      console.error('Error creating module:', error);
      alert('Failed to create module');
    }
  };

  const handleUpdateModule = async (moduleId: number) => {
    if (!editingModule) return;
    
    try {
      const updatedModule = await CourseCreationService.updateModule(course.id, moduleId, moduleForm);
      setModules(modules.map(m => m.id === moduleId ? updatedModule : m));
      setEditingModule(null);
      resetModuleForm();
    } catch (error) {
      console.error('Error updating module:', error);
      alert('Failed to update module');
    }
  };

  const handleDeleteModule = async (moduleId: number) => {
    if (!confirm('Are you sure you want to delete this module? This will also delete all lessons in it.')) {
      return;
    }
    
    try {
      await CourseCreationService.deleteModule(course.id, moduleId);
      setModules(modules.filter(m => m.id !== moduleId));
    } catch (error) {
      console.error('Error deleting module:', error);
      alert('Failed to delete module');
    }
  };

  const handleCreateLesson = async (moduleId: number) => {
    try {
      const durationMinutes = lessonForm.duration_minutes ? parseInt(lessonForm.duration_minutes) : undefined;
      const newLesson = await CourseCreationService.createLesson(course.id, moduleId, {
        ...lessonForm,
        duration_minutes: durationMinutes
      });
      
      setModules(modules.map(m => 
        m.id === moduleId 
          ? { ...m, lessons: [...(m.lessons || []), newLesson] }
          : m
      ));
      setShowLessonForm({ moduleId: null });
      resetLessonForm();
    } catch (error) {
      console.error('Error creating lesson:', error);
      alert('Failed to create lesson');
    }
  };

  const handleUpdateLesson = async (moduleId: number, lessonId: number) => {
    if (!editingLesson) return;
    
    try {
      const durationMinutes = lessonForm.duration_minutes ? parseInt(lessonForm.duration_minutes) : undefined;
      const updatedLesson = await CourseCreationService.updateLesson(course.id, moduleId, lessonId, {
        ...lessonForm,
        duration_minutes: durationMinutes
      });
      
      setModules(modules.map(m => 
        m.id === moduleId 
          ? { 
              ...m, 
              lessons: m.lessons?.map(l => l.id === lessonId ? updatedLesson : l) || []
            }
          : m
      ));
      setEditingLesson(null);
      resetLessonForm();
    } catch (error) {
      console.error('Error updating lesson:', error);
      alert('Failed to update lesson');
    }
  };

  const handleDeleteLesson = async (moduleId: number, lessonId: number) => {
    if (!confirm('Are you sure you want to delete this lesson?')) {
      return;
    }
    
    try {
      await CourseCreationService.deleteLesson(course.id, moduleId, lessonId);
      setModules(modules.map(m => 
        m.id === moduleId 
          ? { ...m, lessons: m.lessons?.filter(l => l.id !== lessonId) || [] }
          : m
      ));
    } catch (error) {
      console.error('Error deleting lesson:', error);
      alert('Failed to delete lesson');
    }
  };

  const handlePublishModule = async (moduleId: number, isPublished: boolean) => {
    try {
      await CourseCreationService.updateModule(course.id, moduleId, {
        is_published: !isPublished
      });
      
      // Update the local state
      setModules(modules.map(m => 
        m.id === moduleId 
          ? { ...m, is_published: !isPublished }
          : m
      ));
    } catch (error) {
      console.error('Error publishing/unpublishing module:', error);
      alert('Failed to update module publication status');
    }
  };

  const handlePublishLesson = async (moduleId: number, lessonId: number, isPublished: boolean) => {
    try {
      await CourseCreationService.updateLesson(course.id, moduleId, lessonId, {
        is_published: !isPublished
      });
      
      // Update the local state
      setModules(modules.map(m => 
        m.id === moduleId 
          ? { 
              ...m, 
              lessons: m.lessons?.map(l => 
                l.id === lessonId 
                  ? { ...l, is_published: !isPublished }
                  : l
              ) || []
            }
          : m
      ));
    } catch (error) {
      console.error('Error publishing/unpublishing lesson:', error);
      alert('Failed to update lesson publication status');
    }
  };

  const toggleModuleExpansion = (moduleId: number) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleId)) {
      newExpanded.delete(moduleId);
    } else {
      newExpanded.add(moduleId);
    }
    setExpandedModules(newExpanded);
  };

  const startEditingModule = (module: EnhancedModule) => {
    setEditingModule(module);
    setModuleForm({
      title: module.title,
      description: module.description || '',
      learning_objectives: module.learning_objectives || '',
      is_published: module.is_published
    });
  };

  const startEditingLesson = (moduleId: number, lesson: EnhancedLesson) => {
    setEditingLesson({ moduleId, lesson });
    setLessonForm({
      title: lesson.title,
      content_type: (lesson.content_type as 'text' | 'video' | 'pdf' | 'mixed') || 'text',
      content_data: lesson.content_data,
      description: lesson.description || '',
      learning_objectives: lesson.learning_objectives || '',
      duration_minutes: lesson.duration_minutes?.toString() || '',
      is_published: lesson.is_published
    });
  };

  const onDragEnd = async (result: any) => {
    if (!result.destination) return;

    const { source, destination, type } = result;

    if (type === 'module') {
      const newModules = Array.from(modules);
      const [reorderedModule] = newModules.splice(source.index, 1);
      newModules.splice(destination.index, 0, reorderedModule);

      const moduleOrders: ModuleOrderUpdate[] = newModules.map((module, index) => ({
        id: module.id,
        order: index + 1
      }));

      setModules(newModules);

      try {
        await CourseCreationService.reorderModules(course.id, moduleOrders);
      } catch (error) {
        console.error('Error reordering modules:', error);
        // Revert on error
        setModules(modules);
        alert('Failed to reorder modules');
      }
    } else if (type.startsWith('lesson-')) {
      const moduleId = parseInt(type.split('-')[1]);
      const moduleIndex = modules.findIndex(m => m.id === moduleId);
      const module = modules[moduleIndex];
      
      if (!module.lessons) return;

      const newLessons = Array.from(module.lessons);
      const [reorderedLesson] = newLessons.splice(source.index, 1);
      newLessons.splice(destination.index, 0, reorderedLesson);

      const lessonOrders: LessonOrderUpdate[] = newLessons.map((lesson, index) => ({
        id: lesson.id,
        order: index + 1
      }));

      const newModules = [...modules];
      newModules[moduleIndex] = { ...module, lessons: newLessons };
      setModules(newModules);

      try {
        await CourseCreationService.reorderLessons(course.id, moduleId, lessonOrders);
      } catch (error) {
        console.error('Error reordering lessons:', error);
        // Revert on error
        setModules(modules);
        alert('Failed to reorder lessons');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          Course Modules & Lessons
        </h3>
        <button
          onClick={() => setShowModuleForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Add Module
        </button>
      </div>

      {/* Module Form */}
      {(showModuleForm || editingModule) && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            {editingModule ? 'Edit Module' : 'Create New Module'}
          </h4>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Module Title *
              </label>
              <input
                type="text"
                value={moduleForm.title}
                onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                placeholder="Enter module title"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Description
              </label>
              <textarea
                value={moduleForm.description}
                onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                placeholder="Describe what this module covers"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Learning Objectives
              </label>
              <textarea
                value={moduleForm.learning_objectives}
                onChange={(e) => setModuleForm({ ...moduleForm, learning_objectives: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                placeholder="What will students learn in this module?"
              />
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="module-published"
                checked={moduleForm.is_published}
                onChange={(e) => setModuleForm({ ...moduleForm, is_published: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
              />
              <label htmlFor="module-published" className="ml-2 block text-sm text-slate-900 dark:text-white">
                Publish module immediately
              </label>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowModuleForm(false);
                  setEditingModule(null);
                  resetModuleForm();
                }}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={() => editingModule ? handleUpdateModule(editingModule.id) : handleCreateModule()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {editingModule ? 'Update Module' : 'Create Module'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modules List */}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="modules" type="module">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
              {modules.map((module, index) => (
                <Draggable key={module.id} draggableId={`module-${module.id}`} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 ${
                        snapshot.isDragging ? 'shadow-lg' : ''
                      }`}
                    >
                      {/* Module Header */}
                      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div {...provided.dragHandleProps} className="cursor-move text-slate-400 hover:text-slate-600">
                              ⋮⋮
                            </div>
                            <button
                              onClick={() => toggleModuleExpansion(module.id)}
                              className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                            >
                              {expandedModules.has(module.id) ? '▼' : '▶'}
                            </button>
                            <div>
                              <h4 className="font-semibold text-slate-900 dark:text-white">
                                {module.title}
                              </h4>
                              <p className="text-sm text-slate-600 dark:text-slate-400">
                                {module.lessons?.length || 0} lessons
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              module.is_published 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                            }`}>
                              {module.is_published ? 'Published' : 'Draft'}
                            </span>
                            <button
                              onClick={() => setShowLessonForm({ moduleId: module.id })}
                              className="text-sm px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-400 rounded transition-colors"
                            >
                              Add Lesson
                            </button>
                            <button
                              onClick={() => startEditingModule(module)}
                              className="text-sm px-3 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 rounded transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handlePublishModule(module.id, module.is_published)}
                              className={`text-sm px-3 py-1 rounded transition-colors ${
                                module.is_published
                                  ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400'
                                  : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-400'
                              }`}
                            >
                              {module.is_published ? 'Unpublish' : 'Publish'}
                            </button>
                            <button
                              onClick={() => handleDeleteModule(module.id)}
                              className="text-sm px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 rounded transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        
                        {module.description && (
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                            {module.description}
                          </p>
                        )}
                      </div>

                      {/* Lesson Form */}
                      {showLessonForm.moduleId === module.id && (
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
                          <h5 className="font-medium text-slate-900 dark:text-white mb-4">Add New Lesson</h5>
                          
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                  Lesson Title *
                                </label>
                                <input
                                  type="text"
                                  value={lessonForm.title}
                                  onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                                  placeholder="Enter lesson title"
                                />
                              </div>
                              
                              <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                  Content Type
                                </label>
                                <select
                                  value={lessonForm.content_type}
                                  onChange={(e) => {
                                    const newContentType = e.target.value as any;
                                    setLessonForm({ 
                                      ...lessonForm, 
                                      content_type: newContentType,
                                      // Clear content_data when changing type to avoid confusion
                                      content_data: ''
                                    });
                                  }}
                                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                                >
                                  <option value="text">📝 Text Content</option>
                                  <option value="video">🎥 Video</option>
                                  <option value="pdf">📄 PDF Document</option>
                                  <option value="mixed">🎨 Mixed Content</option>
                                </select>
                              </div>
                            </div>
                            
                            <div>
                              {(() => {
                                const config = getContentDataConfig(lessonForm.content_type);
                                return (
                                  <>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                      {config.label} *
                                    </label>
                                    {config.inputType === 'textarea' ? (
                                      <textarea
                                        value={lessonForm.content_data}
                                        onChange={(e) => setLessonForm({ ...lessonForm, content_data: e.target.value })}
                                        rows={config.rows}
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white font-mono text-sm"
                                        placeholder={config.placeholder}
                                      />
                                    ) : (
                                      <input
                                        type="text"
                                        value={lessonForm.content_data}
                                        onChange={(e) => setLessonForm({ ...lessonForm, content_data: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                                        placeholder={config.placeholder}
                                      />
                                    )}
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                      {config.helperText}
                                    </p>
                                  </>
                                );
                              })()}
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                  Duration (minutes)
                                </label>
                                <input
                                  type="number"
                                  value={lessonForm.duration_minutes}
                                  onChange={(e) => setLessonForm({ ...lessonForm, duration_minutes: e.target.value })}
                                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                                  placeholder="Estimated duration"
                                />
                              </div>
                              
                              <div className="flex items-end">
                                <div className="flex items-center">
                                  <input
                                    type="checkbox"
                                    id="lesson-published"
                                    checked={lessonForm.is_published}
                                    onChange={(e) => setLessonForm({ ...lessonForm, is_published: e.target.checked })}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                                  />
                                  <label htmlFor="lesson-published" className="ml-2 block text-sm text-slate-900 dark:text-white">
                                    Publish immediately
                                  </label>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex justify-end space-x-3">
                              <button
                                onClick={() => {
                                  setShowLessonForm({ moduleId: null });
                                  resetLessonForm();
                                }}
                                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleCreateLesson(module.id)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                              >
                                Add Lesson
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Lessons List */}
                      {expandedModules.has(module.id) && (
                        <div className="p-4">
                          {module.lessons && module.lessons.length > 0 ? (
                            <Droppable droppableId={`lessons-${module.id}`} type={`lesson-${module.id}`}>
                              {(provided) => (
                                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                                  {module.lessons!.map((lesson, lessonIndex) => (
                                    <Draggable key={lesson.id} draggableId={`lesson-${lesson.id}`} index={lessonIndex}>
                                      {(provided, snapshot) => (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          className={`p-3 border border-slate-200 dark:border-slate-600 rounded-lg ${
                                            snapshot.isDragging ? 'shadow-lg bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-700/50'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-3">
                                              <div {...provided.dragHandleProps} className="cursor-move text-slate-400 hover:text-slate-600">
                                                ⋮⋮
                                              </div>
                                              <div>
                                                <h5 className="font-medium text-slate-900 dark:text-white">
                                                  {lesson.title}
                                                </h5>
                                                <div className="flex items-center space-x-3 text-sm text-slate-600 dark:text-slate-400">
                                                  <span className="capitalize">{(lesson as EnhancedLesson).content_type || 'text'}</span>
                                                  {(lesson as EnhancedLesson).duration_minutes && (
                                                    <span>{(lesson as EnhancedLesson).duration_minutes} min</span>
                                                  )}
                                                  <span className={`px-2 py-1 rounded-full text-xs ${
                                                    (lesson as EnhancedLesson).is_published 
                                                      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                                                  }`}>
                                                    {(lesson as EnhancedLesson).is_published ? 'Published' : 'Draft'}
                                                  </span>
                                                </div>
                                              </div>
                                            </div>
                                            
                                            <div className="flex items-center space-x-2">
                                              <button
                                                onClick={() => startEditingLesson(module.id, lesson as EnhancedLesson)}
                                                className="text-xs px-2 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-600 dark:text-slate-300 rounded"
                                              >
                                                Edit
                                              </button>
                                              <button
                                                onClick={() => handlePublishLesson(module.id, lesson.id, (lesson as EnhancedLesson).is_published)}
                                                className={`text-xs px-2 py-1 rounded transition-colors ${
                                                  (lesson as EnhancedLesson).is_published
                                                    ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400'
                                                    : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-400'
                                                }`}
                                              >
                                                {(lesson as EnhancedLesson).is_published ? 'Unpublish' : 'Publish'}
                                              </button>
                                              <button
                                                onClick={() => handleDeleteLesson(module.id, lesson.id)}
                                                className="text-xs px-2 py-1 bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 rounded"
                                              >
                                                Delete
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </Draggable>
                                  ))}
                                  {provided.placeholder}
                                </div>
                              )}
                            </Droppable>
                          ) : (
                            <p className="text-slate-600 dark:text-slate-400 text-center py-4">
                              No lessons yet. Click "Add Lesson" to get started.
                            </p>
                          )}
                        </div>
                      )}

                      {/* Edit Lesson Form */}
                      {editingLesson?.moduleId === module.id && (
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
                          <h5 className="font-medium text-slate-900 dark:text-white mb-4">Edit Lesson</h5>
                          
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                  Lesson Title *
                                </label>
                                <input
                                  type="text"
                                  value={lessonForm.title}
                                  onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                                />
                              </div>
                              
                              <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                  Content Type
                                </label>
                                <select
                                  value={lessonForm.content_type}
                                  onChange={(e) => {
                                    const newContentType = e.target.value as any;
                                    setLessonForm({ 
                                      ...lessonForm, 
                                      content_type: newContentType
                                      // Keep existing content_data when editing
                                    });
                                  }}
                                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                                >
                                  <option value="text">📝 Text Content</option>
                                  <option value="video">🎥 Video</option>
                                  <option value="pdf">📄 PDF Document</option>
                                  <option value="mixed">🎨 Mixed Content</option>
                                </select>
                              </div>
                            </div>
                            
                            <div>
                              {(() => {
                                const config = getContentDataConfig(lessonForm.content_type);
                                return (
                                  <>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                      {config.label} *
                                    </label>
                                    {config.inputType === 'textarea' ? (
                                      <textarea
                                        value={lessonForm.content_data}
                                        onChange={(e) => setLessonForm({ ...lessonForm, content_data: e.target.value })}
                                        rows={config.rows}
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white font-mono text-sm"
                                        placeholder={config.placeholder}
                                      />
                                    ) : (
                                      <input
                                        type="text"
                                        value={lessonForm.content_data}
                                        onChange={(e) => setLessonForm({ ...lessonForm, content_data: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                                        placeholder={config.placeholder}
                                      />
                                    )}
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                      {config.helperText}
                                    </p>
                                  </>
                                );
                              })()}
                            </div>
                            
                            <div className="flex justify-end space-x-3">
                              <button
                                onClick={() => {
                                  setEditingLesson(null);
                                  resetLessonForm();
                                }}
                                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleUpdateLesson(module.id, editingLesson.lesson.id)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                              >
                                Update Lesson
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {modules.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📚</div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            No modules yet
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Start building your course by adding your first module.
          </p>
          <button
            onClick={() => setShowModuleForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add Your First Module
          </button>
        </div>
      )}
    </div>
  );
};

export default ModuleManagement;