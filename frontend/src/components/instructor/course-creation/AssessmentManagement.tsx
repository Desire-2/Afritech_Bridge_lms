"use client";

import React, { useState } from 'react';
import { Course, Assignment, Project, Quiz, EnhancedModule } from '@/types/api';
import CourseCreationService from '@/services/course-creation.service';

interface AssessmentManagementProps {
  course: Course;
  assessments?: {
    quizzes?: Quiz[];
    assignments?: Assignment[];
    projects?: Project[];
  };
  onAssessmentUpdate: () => void;
}

type AssessmentType = 'quiz' | 'assignment' | 'project';

const AssessmentManagement: React.FC<AssessmentManagementProps> = ({ 
  course, 
  assessments, 
  onAssessmentUpdate 
}) => {
  const [activeTab, setActiveTab] = useState<AssessmentType>('assignment');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  // Assignment form state
  const [assignmentForm, setAssignmentForm] = useState({
    title: '',
    description: '',
    instructions: '',
    module_id: '',
    lesson_id: '',
    assignment_type: 'file_upload' as 'file_upload' | 'text_response' | 'both',
    max_file_size_mb: 10,
    allowed_file_types: '',
    due_date: '',
    points_possible: 100,
    is_published: false
  });

  // Project form state
  const [projectForm, setProjectForm] = useState({
    title: '',
    description: '',
    objectives: '',
    module_ids: [] as number[],
    due_date: '',
    points_possible: 100,
    is_published: false,
    submission_format: 'file_upload' as 'file_upload' | 'text_response' | 'both' | 'presentation',
    max_file_size_mb: 50,
    allowed_file_types: '',
    collaboration_allowed: false,
    max_team_size: 1
  });

  // Quiz form state
  const [quizForm, setQuizForm] = useState({
    title: '',
    description: '',
    module_id: '',
    lesson_id: '',
    is_published: false
  });

  const resetAssignmentForm = () => {
    setAssignmentForm({
      title: '',
      description: '',
      instructions: '',
      module_id: '',
      lesson_id: '',
      assignment_type: 'file_upload',
      max_file_size_mb: 10,
      allowed_file_types: '',
      due_date: '',
      points_possible: 100,
      is_published: false
    });
  };

  const resetProjectForm = () => {
    setProjectForm({
      title: '',
      description: '',
      objectives: '',
      module_ids: [],
      due_date: '',
      points_possible: 100,
      is_published: false,
      submission_format: 'file_upload',
      max_file_size_mb: 50,
      allowed_file_types: '',
      collaboration_allowed: false,
      max_team_size: 1
    });
  };

  const resetQuizForm = () => {
    setQuizForm({
      title: '',
      description: '',
      module_id: '',
      lesson_id: '',
      is_published: false
    });
  };

  const handleCreateAssignment = async () => {
    try {
      const assignmentData = {
        ...assignmentForm,
        course_id: course.id,
        module_id: assignmentForm.module_id ? parseInt(assignmentForm.module_id) : undefined,
        lesson_id: assignmentForm.lesson_id ? parseInt(assignmentForm.lesson_id) : undefined,
        due_date: assignmentForm.due_date || undefined
      };

      await CourseCreationService.createAssignment(assignmentData);
      onAssessmentUpdate();
      setShowForm(false);
      resetAssignmentForm();
    } catch (error) {
      console.error('Error creating assignment:', error);
      alert('Failed to create assignment');
    }
  };

  const handleCreateProject = async () => {
    try {
      const projectData = {
        ...projectForm,
        course_id: course.id,
        module_ids: projectForm.module_ids
      };

      await CourseCreationService.createProject(projectData);
      onAssessmentUpdate();
      setShowForm(false);
      resetProjectForm();
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Failed to create project');
    }
  };

  const handleCreateQuiz = async () => {
    try {
      const quizData = {
        ...quizForm,
        course_id: course.id,
        module_id: quizForm.module_id ? parseInt(quizForm.module_id) : undefined,
        lesson_id: quizForm.lesson_id ? parseInt(quizForm.lesson_id) : undefined
      };

      await CourseCreationService.createQuiz(quizData);
      onAssessmentUpdate();
      setShowForm(false);
      resetQuizForm();
    } catch (error) {
      console.error('Error creating quiz:', error);
      alert('Failed to create quiz');
    }
  };

  const handleDeleteAssignment = async (assignmentId: number) => {
    if (!confirm('Are you sure you want to delete this assignment?')) return;
    
    try {
      await CourseCreationService.deleteAssignment(assignmentId);
      onAssessmentUpdate();
    } catch (error) {
      console.error('Error deleting assignment:', error);
      alert('Failed to delete assignment');
    }
  };

  const handleDeleteProject = async (projectId: number) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    
    try {
      await CourseCreationService.deleteProject(projectId);
      onAssessmentUpdate();
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Failed to delete project');
    }
  };

  const handleDeleteQuiz = async (quizId: number) => {
    if (!confirm('Are you sure you want to delete this quiz?')) return;
    
    try {
      await CourseCreationService.deleteQuiz(quizId);
      onAssessmentUpdate();
    } catch (error) {
      console.error('Error deleting quiz:', error);
      alert('Failed to delete quiz');
    }
  };

  // Edit handlers
  const handleEditAssignment = (assignment: Assignment) => {
    setEditingItem(assignment);
    setAssignmentForm({
      title: assignment.title,
      description: assignment.description,
      instructions: assignment.instructions || '',
      module_id: assignment.module_id ? assignment.module_id.toString() : '',
      lesson_id: assignment.lesson_id ? assignment.lesson_id.toString() : '',
      assignment_type: assignment.assignment_type,
      max_file_size_mb: assignment.max_file_size_mb || 10,
      allowed_file_types: assignment.allowed_file_types || '',
      due_date: assignment.due_date ? new Date(assignment.due_date).toISOString().slice(0, 16) : '',
      points_possible: assignment.points_possible || 100,
      is_published: assignment.is_published
    });
    setActiveTab('assignment');
    setShowForm(true);
  };

  const handleEditProject = (project: Project) => {
    setEditingItem(project);
    setProjectForm({
      title: project.title,
      description: project.description,
      objectives: project.objectives || '',
      module_ids: project.module_ids || [],
      due_date: project.due_date ? new Date(project.due_date).toISOString().slice(0, 16) : '',
      points_possible: project.points_possible || 100,
      is_published: project.is_published,
      submission_format: project.submission_format,
      max_file_size_mb: project.max_file_size_mb || 50,
      allowed_file_types: project.allowed_file_types || '',
      collaboration_allowed: project.collaboration_allowed || false,
      max_team_size: project.max_team_size || 1
    });
    setActiveTab('project');
    setShowForm(true);
  };

  const handleEditQuiz = (quiz: Quiz) => {
    setEditingItem(quiz);
    setQuizForm({
      title: quiz.title,
      description: quiz.description || '',
      module_id: quiz.module_id ? quiz.module_id.toString() : '',
      lesson_id: quiz.lesson_id ? quiz.lesson_id.toString() : '',
      is_published: quiz.is_published || false
    });
    setActiveTab('quiz');
    setShowForm(true);
  };

  // Update handlers
  const handleUpdateAssignment = async () => {
    if (!editingItem) return;
    
    try {
      const assignmentData = {
        title: assignmentForm.title,
        description: assignmentForm.description,
        instructions: assignmentForm.instructions,
        module_id: assignmentForm.module_id ? parseInt(assignmentForm.module_id) : undefined,
        lesson_id: assignmentForm.lesson_id ? parseInt(assignmentForm.lesson_id) : undefined,
        assignment_type: assignmentForm.assignment_type,
        max_file_size_mb: assignmentForm.max_file_size_mb,
        allowed_file_types: assignmentForm.allowed_file_types,
        due_date: assignmentForm.due_date || undefined,
        points_possible: assignmentForm.points_possible,
        is_published: assignmentForm.is_published
      };

      await CourseCreationService.updateAssignment(editingItem.id, assignmentData);
      onAssessmentUpdate();
      setShowForm(false);
      setEditingItem(null);
      resetAssignmentForm();
    } catch (error) {
      console.error('Error updating assignment:', error);
      alert('Failed to update assignment');
    }
  };

  const handleUpdateProject = async () => {
    if (!editingItem) return;
    
    try {
      const projectData = {
        title: projectForm.title,
        description: projectForm.description,
        objectives: projectForm.objectives,
        module_ids: projectForm.module_ids,
        due_date: projectForm.due_date || undefined,
        points_possible: projectForm.points_possible,
        is_published: projectForm.is_published,
        submission_format: projectForm.submission_format,
        max_file_size_mb: projectForm.max_file_size_mb,
        allowed_file_types: projectForm.allowed_file_types,
        collaboration_allowed: projectForm.collaboration_allowed,
        max_team_size: projectForm.max_team_size
      };

      await CourseCreationService.updateProject(editingItem.id, projectData);
      onAssessmentUpdate();
      setShowForm(false);
      setEditingItem(null);
      resetProjectForm();
    } catch (error) {
      console.error('Error updating project:', error);
      alert('Failed to update project');
    }
  };

  const handleUpdateQuiz = async () => {
    if (!editingItem) return;
    
    try {
      const quizData = {
        title: quizForm.title,
        description: quizForm.description,
        module_id: quizForm.module_id ? parseInt(quizForm.module_id) : undefined,
        lesson_id: quizForm.lesson_id ? parseInt(quizForm.lesson_id) : undefined,
        is_published: quizForm.is_published
      };

      await CourseCreationService.updateQuiz(editingItem.id, quizData);
      onAssessmentUpdate();
      setShowForm(false);
      setEditingItem(null);
      resetQuizForm();
    } catch (error) {
      console.error('Error updating quiz:', error);
      alert('Failed to update quiz');
    }
  };

  const getModuleOptions = () => {
    return course.modules?.map(module => ({
      id: module.id,
      title: module.title
    })) || [];
  };

  const getLessonOptions = (moduleId: string) => {
    if (!moduleId) return [];
    const module = course.modules?.find(m => m.id === parseInt(moduleId));
    return module?.lessons?.map(lesson => ({
      id: lesson.id,
      title: lesson.title
    })) || [];
  };

  const tabs = [
    { id: 'assignment' as AssessmentType, label: 'Assignments', icon: '📝', count: assessments?.assignments?.length || 0 },
    { id: 'quiz' as AssessmentType, label: 'Quizzes', icon: '❓', count: assessments?.quizzes?.length || 0 },
    { id: 'project' as AssessmentType, label: 'Projects', icon: '🎯', count: assessments?.projects?.length || 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          Course Assessments
        </h3>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Create {activeTab === 'assignment' ? 'Assignment' : activeTab === 'quiz' ? 'Quiz' : 'Project'}
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 px-2 py-1 rounded-full text-xs">
                {tab.count}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Assessment Forms */}
      {showForm && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Create New {activeTab === 'assignment' ? 'Assignment' : activeTab === 'quiz' ? 'Quiz' : 'Project'}
          </h4>

          {/* Assignment Form */}
          {activeTab === 'assignment' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Assignment Title *
                </label>
                <input
                  type="text"
                  value={assignmentForm.title}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                  placeholder="Enter assignment title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Description *
                </label>
                <textarea
                  value={assignmentForm.description}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                  placeholder="Describe the assignment"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Instructions
                </label>
                <textarea
                  value={assignmentForm.instructions}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, instructions: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                  placeholder="Detailed instructions for students"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Attach to Module (Optional)
                  </label>
                  <select
                    value={assignmentForm.module_id}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, module_id: e.target.value, lesson_id: '' })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                  >
                    <option value="">Select module...</option>
                    {getModuleOptions().map(module => (
                      <option key={module.id} value={module.id}>{module.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Attach to Lesson (Optional)
                  </label>
                  <select
                    value={assignmentForm.lesson_id}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, lesson_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                    disabled={!assignmentForm.module_id}
                  >
                    <option value="">Select lesson...</option>
                    {getLessonOptions(assignmentForm.module_id).map(lesson => (
                      <option key={lesson.id} value={lesson.id}>{lesson.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Assignment Type
                  </label>
                  <select
                    value={assignmentForm.assignment_type}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, assignment_type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                  >
                    <option value="file_upload">File Upload</option>
                    <option value="text_response">Text Response</option>
                    <option value="both">Both</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Due Date
                  </label>
                  <input
                    type="datetime-local"
                    value={assignmentForm.due_date}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, due_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Points Possible
                  </label>
                  <input
                    type="number"
                    value={assignmentForm.points_possible}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, points_possible: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="assignment-published"
                  checked={assignmentForm.is_published}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, is_published: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                />
                <label htmlFor="assignment-published" className="ml-2 block text-sm text-slate-900 dark:text-white">
                  Publish assignment immediately
                </label>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingItem(null);
                    resetAssignmentForm();
                  }}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={editingItem ? handleUpdateAssignment : handleCreateAssignment}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingItem ? 'Update Assignment' : 'Create Assignment'}
                </button>
              </div>
            </div>
          )}

          {/* Project Form */}
          {activeTab === 'project' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Project Title *
                </label>
                <input
                  type="text"
                  value={projectForm.title}
                  onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                  placeholder="Enter project title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Description *
                </label>
                <textarea
                  value={projectForm.description}
                  onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                  placeholder="Describe the project"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Learning Objectives
                </label>
                <textarea
                  value={projectForm.objectives}
                  onChange={(e) => setProjectForm({ ...projectForm, objectives: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                  placeholder="What will students learn from this project?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Modules Covered *
                </label>
                <div className="space-y-2">
                  {getModuleOptions().map(module => (
                    <label key={module.id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={projectForm.module_ids.includes(module.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setProjectForm({ 
                              ...projectForm, 
                              module_ids: [...projectForm.module_ids, module.id] 
                            });
                          } else {
                            setProjectForm({ 
                              ...projectForm, 
                              module_ids: projectForm.module_ids.filter(id => id !== module.id)
                            });
                          }
                        }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                      />
                      <span className="ml-2 text-sm text-slate-900 dark:text-white">{module.title}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Due Date *
                  </label>
                  <input
                    type="datetime-local"
                    value={projectForm.due_date}
                    onChange={(e) => setProjectForm({ ...projectForm, due_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Points Possible
                  </label>
                  <input
                    type="number"
                    value={projectForm.points_possible}
                    onChange={(e) => setProjectForm({ ...projectForm, points_possible: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="collaboration-allowed"
                    checked={projectForm.collaboration_allowed}
                    onChange={(e) => setProjectForm({ ...projectForm, collaboration_allowed: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                  />
                  <label htmlFor="collaboration-allowed" className="ml-2 block text-sm text-slate-900 dark:text-white">
                    Allow team collaboration
                  </label>
                </div>

                {projectForm.collaboration_allowed && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Maximum Team Size
                    </label>
                    <input
                      type="number"
                      min="2"
                      value={projectForm.max_team_size}
                      onChange={(e) => setProjectForm({ ...projectForm, max_team_size: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingItem(null);
                    resetProjectForm();
                  }}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={editingItem ? handleUpdateProject : handleCreateProject}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingItem ? 'Update Project' : 'Create Project'}
                </button>
              </div>
            </div>
          )}

          {/* Quiz Form */}
          {activeTab === 'quiz' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Quiz Title *
                </label>
                <input
                  type="text"
                  value={quizForm.title}
                  onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                  placeholder="Enter quiz title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Description
                </label>
                <textarea
                  value={quizForm.description}
                  onChange={(e) => setQuizForm({ ...quizForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                  placeholder="Describe the quiz"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Attach to Module (Optional)
                  </label>
                  <select
                    value={quizForm.module_id}
                    onChange={(e) => setQuizForm({ ...quizForm, module_id: e.target.value, lesson_id: '' })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                  >
                    <option value="">Select module...</option>
                    {getModuleOptions().map(module => (
                      <option key={module.id} value={module.id}>{module.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Attach to Lesson (Optional)
                  </label>
                  <select
                    value={quizForm.lesson_id}
                    onChange={(e) => setQuizForm({ ...quizForm, lesson_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                    disabled={!quizForm.module_id}
                  >
                    <option value="">Select lesson...</option>
                    {getLessonOptions(quizForm.module_id).map(lesson => (
                      <option key={lesson.id} value={lesson.id}>{lesson.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={quizForm.is_published}
                    onChange={(e) => setQuizForm({ ...quizForm, is_published: e.target.checked })}
                    className="form-checkbox h-4 w-4 text-blue-600"
                  />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Publish quiz immediately
                  </span>
                </label>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingItem(null);
                    resetQuizForm();
                  }}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={editingItem ? handleUpdateQuiz : handleCreateQuiz}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingItem ? 'Update Quiz' : 'Create Quiz'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Assessment Lists */}
      <div className="space-y-4">
        {/* Assignments */}
        {activeTab === 'assignment' && (
          <div className="space-y-4">
            {(assessments?.assignments?.length || 0) > 0 ? (
              assessments?.assignments?.map((assignment) => (
                <div key={assignment.id} className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-900 dark:text-white">{assignment.title}</h4>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">{assignment.description}</p>
                      <div className="flex items-center space-x-4 mt-3 text-sm text-slate-600 dark:text-slate-400">
                        <span className="capitalize">{assignment.assignment_type.replace('_', ' ')}</span>
                        <span>{assignment.points_possible} points</span>
                        {assignment.due_date && (
                          <span>Due: {new Date(assignment.due_date).toLocaleDateString()}</span>
                        )}
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          assignment.is_published 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                        }`}>
                          {assignment.is_published ? 'Published' : 'Draft'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button 
                        onClick={() => handleEditAssignment(assignment)}
                        className="text-sm px-3 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 rounded"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDeleteAssignment(assignment.id)}
                        className="text-sm px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 rounded"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📝</div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No assignments yet</h3>
                <p className="text-slate-600 dark:text-slate-400">Create your first assignment to get started.</p>
              </div>
            )}
          </div>
        )}

        {/* Projects */}
        {activeTab === 'project' && (
          <div className="space-y-4">
            {(assessments?.projects?.length || 0) > 0 ? (
              assessments?.projects?.map((project) => (
                <div key={project.id} className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-900 dark:text-white">{project.title}</h4>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">{project.description}</p>
                      <div className="flex items-center space-x-4 mt-3 text-sm text-slate-600 dark:text-slate-400">
                        <span>{project.module_ids.length} modules</span>
                        <span>{project.points_possible} points</span>
                        <span>Due: {new Date(project.due_date).toLocaleDateString()}</span>
                        {project.collaboration_allowed && (
                          <span>Team project (max {project.max_team_size})</span>
                        )}
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          project.is_published 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                        }`}>
                          {project.is_published ? 'Published' : 'Draft'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button 
                        onClick={() => handleEditProject(project)}
                        className="text-sm px-3 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 rounded"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDeleteProject(project.id)}
                        className="text-sm px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 rounded"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🎯</div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No projects yet</h3>
                <p className="text-slate-600 dark:text-slate-400">Create your first project to get started.</p>
              </div>
            )}
          </div>
        )}

        {/* Quizzes */}
        {activeTab === 'quiz' && (
          <div className="space-y-4">
            {(assessments?.quizzes?.length || 0) > 0 ? (
              assessments?.quizzes?.map((quiz) => (
                <div key={quiz.id} className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-900 dark:text-white">{quiz.title}</h4>
                      {quiz.description && (
                        <p className="text-slate-600 dark:text-slate-400 mt-1">{quiz.description}</p>
                      )}
                      <div className="flex items-center space-x-4 mt-3 text-sm text-slate-600 dark:text-slate-400">
                        <span>Quiz</span>
                        <span>Created: {new Date(quiz.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button 
                        onClick={() => handleEditQuiz(quiz)}
                        className="text-sm px-3 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 rounded"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDeleteQuiz(quiz.id)}
                        className="text-sm px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 rounded"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">❓</div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No quizzes yet</h3>
                <p className="text-slate-600 dark:text-slate-400">Create your first quiz to get started.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AssessmentManagement;