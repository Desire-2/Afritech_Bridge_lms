"use client";

import React, { useState } from 'react';
import { Course, Assignment, Project, Quiz, EnhancedModule, Question, Answer } from '@/types/api';
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

interface RubricCriteria {
  name: string;
  description: string;
  max_points: number;
}

interface QuizQuestionForm {
  question_text: string;
  question_type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
  points: number;
  answers: { answer_text: string; is_correct: boolean }[];
  explanation?: string;
}

const AssessmentManagement: React.FC<AssessmentManagementProps> = ({ 
  course, 
  assessments, 
  onAssessmentUpdate 
}) => {
  const [activeTab, setActiveTab] = useState<AssessmentType>('assignment');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft'>('all');
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [showQuestionBuilder, setShowQuestionBuilder] = useState(false);
  const [currentQuestions, setCurrentQuestions] = useState<QuizQuestionForm[]>([]);
  const [rubricCriteria, setRubricCriteria] = useState<RubricCriteria[]>([]);

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
    is_published: false,
    time_limit: '',
    max_attempts: '',
    passing_score: 70,
    shuffle_questions: false,
    shuffle_answers: false,
    show_correct_answers: true,
    points_possible: 100,
    due_date: ''
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
    setRubricCriteria([]);
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
      is_published: false,
      time_limit: '',
      max_attempts: '',
      passing_score: 70,
      shuffle_questions: false,
      shuffle_answers: false,
      show_correct_answers: true,
      points_possible: 100,
      due_date: ''
    });
    setCurrentQuestions([]);
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
      // Validate required fields
      if (!quizForm.title || !quizForm.title.trim()) {
        alert('Quiz title is required');
        return;
      }

      // Only send fields that exist in the Quiz model
      const quizData = {
        title: quizForm.title,
        description: quizForm.description,
        course_id: course.id,
        module_id: quizForm.module_id ? parseInt(quizForm.module_id) : undefined,
        lesson_id: quizForm.lesson_id ? parseInt(quizForm.lesson_id) : undefined,
        is_published: quizForm.is_published,
        questions: currentQuestions.length > 0 ? currentQuestions : undefined
        // Note: time_limit and max_attempts are not in the current Quiz model
      };

      console.log('Creating quiz with data:', JSON.stringify(quizData, null, 2));

      const createdQuiz = await CourseCreationService.createQuiz(quizData);
      console.log('Quiz created successfully:', createdQuiz);
      
      // If questions weren't sent with quiz creation (backward compatibility),
      // add them using bulk endpoint
      if (!quizData.questions && currentQuestions.length > 0) {
        console.log('Adding questions separately:', currentQuestions);
        // Cast to any to avoid type issues - backend accepts flexible format
        await CourseCreationService.addBulkQuizQuestions(createdQuiz.id, currentQuestions as any);
      }
      
      alert('Quiz created successfully!');
      onAssessmentUpdate();
      setShowForm(false);
      resetQuizForm();
      setCurrentQuestions([]);  // Clear questions after successful creation
    } catch (error: any) {
      console.error('Error creating quiz:', error);
      console.error('Error details:', {
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status
      });
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to create quiz';
      alert(`Failed to create quiz: ${errorMessage}`);
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

  // Publish/Unpublish handlers
  const handlePublishAssignment = async (assignmentId: number, isPublished: boolean) => {
    try {
      await CourseCreationService.updateAssignment(assignmentId, {
        is_published: !isPublished
      });
      onAssessmentUpdate();
    } catch (error) {
      console.error('Error publishing/unpublishing assignment:', error);
      alert('Failed to update assignment publication status');
    }
  };

  const handlePublishProject = async (projectId: number, isPublished: boolean) => {
    try {
      await CourseCreationService.updateProject(projectId, {
        is_published: !isPublished
      });
      onAssessmentUpdate();
    } catch (error) {
      console.error('Error publishing/unpublishing project:', error);
      alert('Failed to update project publication status');
    }
  };

  const handlePublishQuiz = async (quizId: number, isPublished: boolean) => {
    try {
      await CourseCreationService.updateQuiz(quizId, {
        is_published: !isPublished
      });
      onAssessmentUpdate();
    } catch (error) {
      console.error('Error publishing/unpublishing quiz:', error);
      alert('Failed to update quiz publication status');
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
    console.log('Editing quiz:', quiz);
    setEditingItem(quiz);
    setQuizForm({
      title: quiz.title,
      description: quiz.description || '',
      module_id: quiz.module_id ? quiz.module_id.toString() : '',
      lesson_id: '',
      is_published: quiz.is_published || false,
      time_limit: quiz.time_limit?.toString() || '',
      max_attempts: quiz.max_attempts?.toString() || '',
      passing_score: 70,
      shuffle_questions: false,
      shuffle_answers: false,
      show_correct_answers: true,
      points_possible: 100,
      due_date: ''
    });
    
    // Load existing questions if available
    if (quiz.questions && Array.isArray(quiz.questions) && quiz.questions.length > 0) {
      console.log('Loading existing questions:', quiz.questions);
      const formattedQuestions = quiz.questions.map((q: Question) => ({
        question_text: q.text || '', // Backend uses 'text', frontend uses 'question_text'
        question_type: q.question_type || 'multiple_choice',
        points: 10, // Default points since it's not in the model
        answers: (q.answers || []).map((a: Answer) => ({
          answer_text: a.text || '', // Backend uses 'text', frontend uses 'answer_text'
          is_correct: a.is_correct || false
        })),
        explanation: ''
      }));
      setCurrentQuestions(formattedQuestions);
      console.log('Formatted questions for editing:', formattedQuestions);
    } else {
      console.log('No questions found in quiz data');
      setCurrentQuestions([]);
    }
    
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
      // Validate required fields
      if (!quizForm.title || !quizForm.title.trim()) {
        alert('Quiz title is required');
        return;
      }

      // Only send fields that exist in the Quiz model
      const quizData = {
        title: quizForm.title,
        description: quizForm.description,
        module_id: quizForm.module_id ? parseInt(quizForm.module_id) : undefined,
        lesson_id: quizForm.lesson_id ? parseInt(quizForm.lesson_id) : undefined,
        is_published: quizForm.is_published
        // Note: time_limit and max_attempts are not in the current Quiz model
      };

      console.log('Updating quiz with data:', JSON.stringify(quizData, null, 2));

      await CourseCreationService.updateQuiz(editingItem.id, quizData);
      console.log('Quiz updated successfully');
      
      // Add new questions if any were added
      if (currentQuestions.length > 0) {
        console.log('Adding new questions:', currentQuestions);
        // Cast to any to avoid type issues - backend accepts flexible format
        await CourseCreationService.addBulkQuizQuestions(editingItem.id, currentQuestions as any);
      }
      
      alert('Quiz updated successfully!');
      onAssessmentUpdate();
      setShowForm(false);
      setEditingItem(null);
      resetQuizForm();
      setCurrentQuestions([]);  // Clear questions after successful update
    } catch (error: any) {
      console.error('Error updating quiz:', error);
      console.error('Error details:', {
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status
      });
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to update quiz';
      alert(`Failed to update quiz: ${errorMessage}`);
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

  // Filter and search functions
  const filterAssessments = <T extends { is_published?: boolean; title: string }>(items: T[] | undefined): T[] => {
    if (!items) return [];
    
    let filtered = items;
    
    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(item => 
        filterStatus === 'published' ? (item.is_published ?? false) : !(item.is_published ?? false)
      );
    }
    
    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(item => 
        item.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return filtered;
  };

  // Question builder functions
  const addQuestion = () => {
    setCurrentQuestions([...currentQuestions, {
      question_text: '',
      question_type: 'multiple_choice',
      points: 10,
      answers: [
        { answer_text: '', is_correct: false },
        { answer_text: '', is_correct: false }
      ],
      explanation: ''
    }]);
  };

  const updateQuestion = (index: number, updates: Partial<QuizQuestionForm>) => {
    const newQuestions = [...currentQuestions];
    newQuestions[index] = { ...newQuestions[index], ...updates };
    setCurrentQuestions(newQuestions);
  };

  const removeQuestion = (index: number) => {
    setCurrentQuestions(currentQuestions.filter((_, i) => i !== index));
  };

  const addAnswer = (questionIndex: number) => {
    const newQuestions = [...currentQuestions];
    newQuestions[questionIndex].answers.push({ answer_text: '', is_correct: false });
    setCurrentQuestions(newQuestions);
  };

  const updateAnswer = (questionIndex: number, answerIndex: number, updates: Partial<{ answer_text: string; is_correct: boolean }>) => {
    const newQuestions = [...currentQuestions];
    newQuestions[questionIndex].answers[answerIndex] = {
      ...newQuestions[questionIndex].answers[answerIndex],
      ...updates
    };
    setCurrentQuestions(newQuestions);
  };

  const removeAnswer = (questionIndex: number, answerIndex: number) => {
    const newQuestions = [...currentQuestions];
    newQuestions[questionIndex].answers = newQuestions[questionIndex].answers.filter((_, i) => i !== answerIndex);
    setCurrentQuestions(newQuestions);
  };

  // Rubric functions
  const addRubricCriteria = () => {
    setRubricCriteria([...rubricCriteria, { name: '', description: '', max_points: 10 }]);
  };

  const updateRubricCriteria = (index: number, updates: Partial<RubricCriteria>) => {
    const newRubric = [...rubricCriteria];
    newRubric[index] = { ...newRubric[index], ...updates };
    setRubricCriteria(newRubric);
  };

  const removeRubricCriteria = (index: number) => {
    setRubricCriteria(rubricCriteria.filter((_, i) => i !== index));
  };

  const toggleItemExpansion = (itemId: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const tabs = [
    { id: 'assignment' as AssessmentType, label: 'Assignments', icon: '📝', count: assessments?.assignments?.length || 0 },
    { id: 'quiz' as AssessmentType, label: 'Quizzes', icon: '❓', count: assessments?.quizzes?.length || 0 },
    { id: 'project' as AssessmentType, label: 'Projects', icon: '🎯', count: assessments?.projects?.length || 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            📋 Course Assessments
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Create and manage quizzes, assignments, and projects
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingItem(null);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 shadow-sm"
        >
          <span>➕</span>
          <span>Create {activeTab === 'assignment' ? 'Assignment' : activeTab === 'quiz' ? 'Quiz' : 'Project'}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              <span>{tab.label}</span>
              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                activeTab === tab.id
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Search and Filter Controls */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Search assessments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
              />
              <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                filterStatus === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus('published')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                filterStatus === 'published'
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'
              }`}
            >
              Published
            </button>
            <button
              onClick={() => setFilterStatus('draft')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                filterStatus === 'draft'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'
              }`}
            >
              Drafts
            </button>
          </div>
        </div>
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

              {/* Grading Rubric Builder */}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h5 className="font-medium text-slate-900 dark:text-white flex items-center space-x-2">
                      <span>📊</span>
                      <span>Grading Rubric (Optional)</span>
                    </h5>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      Define clear grading criteria for consistent evaluation
                    </p>
                  </div>
                  {rubricCriteria.length === 0 && (
                    <button
                      onClick={addRubricCriteria}
                      className="text-sm px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-400 rounded transition-colors"
                    >
                      + Add Criteria
                    </button>
                  )}
                </div>

                {rubricCriteria.length > 0 && (
                  <div className="space-y-3">
                    {rubricCriteria.map((criteria, index) => (
                      <div key={index} className="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-200 dark:border-slate-600">
                        <div className="flex items-start justify-between mb-3">
                          <h6 className="font-medium text-slate-900 dark:text-white text-sm">
                            Criteria {index + 1}
                          </h6>
                          <button
                            onClick={() => removeRubricCriteria(index)}
                            className="text-red-600 hover:text-red-700 text-sm"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="md:col-span-2">
                              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Criteria Name *
                              </label>
                              <input
                                type="text"
                                value={criteria.name}
                                onChange={(e) => updateRubricCriteria(index, { name: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white text-sm"
                                placeholder="e.g., Code Quality, Documentation"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Max Points *
                              </label>
                              <input
                                type="number"
                                min="1"
                                value={criteria.max_points}
                                onChange={(e) => updateRubricCriteria(index, { max_points: parseInt(e.target.value) || 0 })}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white text-sm"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                              Description
                            </label>
                            <textarea
                              value={criteria.description}
                              onChange={(e) => updateRubricCriteria(index, { description: e.target.value })}
                              rows={2}
                              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white text-sm"
                              placeholder="Describe what you're evaluating"
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    <button
                      onClick={addRubricCriteria}
                      className="w-full py-2 px-4 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-400 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-sm"
                    >
                      + Add Another Criteria
                    </button>

                    {rubricCriteria.length > 0 && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-slate-900 dark:text-white">
                            Total Rubric Points:
                          </span>
                          <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                            {rubricCriteria.reduce((sum, c) => sum + c.max_points, 0)} points
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h5 className="font-medium text-slate-900 dark:text-white flex items-center space-x-2">
                  <span>📝</span>
                  <span>Basic Information</span>
                </h5>
                
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
              </div>

              {/* Advanced Settings */}
              <div className="space-y-4 border-t border-slate-200 dark:border-slate-700 pt-6">
                <h5 className="font-medium text-slate-900 dark:text-white flex items-center space-x-2">
                  <span>⚙️</span>
                  <span>Quiz Settings</span>
                </h5>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Time Limit (minutes)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={quizForm.time_limit}
                      onChange={(e) => setQuizForm({ ...quizForm, time_limit: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                      placeholder="No limit"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Max Attempts
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={quizForm.max_attempts}
                      onChange={(e) => setQuizForm({ ...quizForm, max_attempts: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                      placeholder="Unlimited"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Passing Score (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={quizForm.passing_score}
                      onChange={(e) => setQuizForm({ ...quizForm, passing_score: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Due Date (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={quizForm.due_date}
                      onChange={(e) => setQuizForm({ ...quizForm, due_date: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Total Points
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={quizForm.points_possible}
                      onChange={(e) => setQuizForm({ ...quizForm, points_possible: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={quizForm.shuffle_questions}
                      onChange={(e) => setQuizForm({ ...quizForm, shuffle_questions: e.target.checked })}
                      className="form-checkbox h-4 w-4 text-blue-600"
                    />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Shuffle questions for each student
                    </span>
                  </label>

                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={quizForm.shuffle_answers}
                      onChange={(e) => setQuizForm({ ...quizForm, shuffle_answers: e.target.checked })}
                      className="form-checkbox h-4 w-4 text-blue-600"
                    />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Shuffle answer choices
                    </span>
                  </label>

                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={quizForm.show_correct_answers}
                      onChange={(e) => setQuizForm({ ...quizForm, show_correct_answers: e.target.checked })}
                      className="form-checkbox h-4 w-4 text-blue-600"
                    />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Show correct answers after submission
                    </span>
                  </label>

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
              </div>

              {/* Question Builder Toggle */}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                <button
                  onClick={() => setShowQuestionBuilder(!showQuestionBuilder)}
                  className="flex items-center justify-between w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">❓</span>
                    <span className="font-medium text-slate-900 dark:text-white">Quiz Questions</span>
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      ({currentQuestions.length} questions)
                    </span>
                  </div>
                  <span className="text-slate-600 dark:text-slate-400">
                    {showQuestionBuilder ? '▼' : '▶'}
                  </span>
                </button>

                {showQuestionBuilder && (
                  <div className="mt-4 space-y-4">
                    {currentQuestions.map((question, qIndex) => (
                      <div key={qIndex} className="p-4 border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700/30">
                        <div className="flex items-start justify-between mb-3">
                          <h6 className="font-medium text-slate-900 dark:text-white">Question {qIndex + 1}</h6>
                          <button
                            onClick={() => removeQuestion(qIndex)}
                            className="text-red-600 hover:text-red-700 text-sm"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                              Question Text *
                            </label>
                            <textarea
                              value={question.question_text}
                              onChange={(e) => updateQuestion(qIndex, { question_text: e.target.value })}
                              rows={2}
                              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white text-sm"
                              placeholder="Enter your question"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Question Type
                              </label>
                              <select
                                value={question.question_type}
                                onChange={(e) => updateQuestion(qIndex, { question_type: e.target.value as any })}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white text-sm"
                              >
                                <option value="multiple_choice">Multiple Choice</option>
                                <option value="true_false">True/False</option>
                                <option value="short_answer">Short Answer</option>
                                <option value="essay">Essay</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Points
                              </label>
                              <input
                                type="number"
                                min="1"
                                value={question.points}
                                onChange={(e) => updateQuestion(qIndex, { points: parseInt(e.target.value) })}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white text-sm"
                              />
                            </div>
                          </div>

                          {(question.question_type === 'multiple_choice' || question.question_type === 'true_false') && (
                            <div className="space-y-2">
                              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Answer Choices
                              </label>
                              {question.answers.map((answer, aIndex) => (
                                <div key={aIndex} className="flex items-center space-x-2">
                                  <input
                                    type={question.question_type === 'multiple_choice' ? 'checkbox' : 'radio'}
                                    checked={answer.is_correct}
                                    onChange={(e) => {
                                      if (question.question_type === 'true_false') {
                                        // For true/false, only one can be correct
                                        const newAnswers = question.answers.map((a, i) => ({
                                          ...a,
                                          is_correct: i === aIndex
                                        }));
                                        updateQuestion(qIndex, { answers: newAnswers });
                                      } else {
                                        updateAnswer(qIndex, aIndex, { is_correct: e.target.checked });
                                      }
                                    }}
                                    className="h-4 w-4 text-green-600"
                                  />
                                  <input
                                    type="text"
                                    value={answer.answer_text}
                                    onChange={(e) => updateAnswer(qIndex, aIndex, { answer_text: e.target.value })}
                                    className="flex-1 px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white text-sm"
                                    placeholder={`Answer ${aIndex + 1}`}
                                  />
                                  {question.question_type !== 'true_false' && question.answers.length > 2 && (
                                    <button
                                      onClick={() => removeAnswer(qIndex, aIndex)}
                                      className="text-red-600 hover:text-red-700 text-sm px-2"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                              ))}
                              {question.question_type === 'multiple_choice' && (
                                <button
                                  onClick={() => addAnswer(qIndex)}
                                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                                >
                                  + Add Answer Choice
                                </button>
                              )}
                            </div>
                          )}

                          <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                              Explanation (Optional)
                            </label>
                            <textarea
                              value={question.explanation || ''}
                              onChange={(e) => updateQuestion(qIndex, { explanation: e.target.value })}
                              rows={2}
                              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white text-sm"
                              placeholder="Explain the correct answer"
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    <button
                      onClick={addQuestion}
                      className="w-full py-2 px-4 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-400 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      + Add Question
                    </button>
                  </div>
                )}
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                >
                  <span>{editingItem ? 'Update Quiz' : 'Create Quiz'}</span>
                  {currentQuestions.length > 0 && (
                    <span className="text-xs bg-blue-700 px-2 py-1 rounded">
                      {currentQuestions.length} questions
                    </span>
                  )}
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
            {filterAssessments(assessments?.assignments).length > 0 ? (
              filterAssessments(assessments?.assignments).map((assignment) => (
                <div key={assignment.id} className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="font-semibold text-slate-900 dark:text-white">{assignment.title}</h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            assignment.is_published 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                          }`}>
                            {assignment.is_published ? '✓ Published' : '📝 Draft'}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">{assignment.description}</p>
                        <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-slate-600 dark:text-slate-400">
                          <span className="flex items-center space-x-1">
                            <span>📄</span>
                            <span className="capitalize">{assignment.assignment_type.replace('_', ' ')}</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <span>🎯</span>
                            <span>{assignment.points_possible} points</span>
                          </span>
                          {assignment.due_date && (
                            <span className="flex items-center space-x-1">
                              <span>📅</span>
                              <span>Due: {new Date(assignment.due_date).toLocaleDateString()}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                      <button 
                        onClick={() => handleEditAssignment(assignment)}
                        className="text-sm px-3 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 rounded transition-colors"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handlePublishAssignment(assignment.id, assignment.is_published)}
                        className={`text-sm px-3 py-1 rounded transition-colors ${
                          assignment.is_published
                            ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400'
                            : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-400'
                        }`}
                      >
                        {assignment.is_published ? '📤 Unpublish' : '📣 Publish'}
                      </button>
                      <button 
                        onClick={() => handleDeleteAssignment(assignment.id)}
                        className="text-sm px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 rounded transition-colors"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>

                    {/* Analytics Preview */}
                    {assignment.is_published && (
                      <div className="border-t border-slate-200 dark:border-slate-700 mt-4 pt-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">0</div>
                            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Submissions</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">--</div>
                            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Avg Score</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">0%</div>
                            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Completion</div>
                          </div>
                        </div>
                      </div>
                    )}
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
            {filterAssessments(assessments?.projects).length > 0 ? (
              filterAssessments(assessments?.projects).map((project) => (
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
                        className="text-sm px-3 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 rounded transition-colors"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handlePublishProject(project.id, project.is_published)}
                        className={`text-sm px-3 py-1 rounded transition-colors ${
                          project.is_published
                            ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400'
                            : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-400'
                        }`}
                      >
                        {project.is_published ? '📤 Unpublish' : '📣 Publish'}
                      </button>
                      <button 
                        onClick={() => handleDeleteProject(project.id)}
                        className="text-sm px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 rounded transition-colors"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>

                  {/* Analytics Preview */}
                  {project.is_published && (
                    <div className="border-t border-slate-200 dark:border-slate-700 mt-4 pt-4">
                      <div className="grid grid-cols-4 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">0</div>
                          <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Submissions</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600 dark:text-green-400">--</div>
                          <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Avg Score</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">0%</div>
                          <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Completion</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">0</div>
                          <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Teams</div>
                        </div>
                      </div>
                    </div>
                  )}
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
            {filterAssessments(assessments?.quizzes).length > 0 ? (
              filterAssessments(assessments?.quizzes).map((quiz) => (
                <div key={quiz.id} className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-900 dark:text-white">{quiz.title}</h4>
                      {quiz.description && (
                        <p className="text-slate-600 dark:text-slate-400 mt-1">{quiz.description}</p>
                      )}
                      <div className="flex items-center space-x-4 mt-3 text-sm text-slate-600 dark:text-slate-400">
                        <span>Quiz</span>
                        <span>{quiz.questions?.length || 0} questions</span>
                        <span>Created: {new Date(quiz.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button 
                        onClick={() => handleEditQuiz(quiz)}
                        className="text-sm px-3 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 rounded transition-colors"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handlePublishQuiz(quiz.id, !!quiz.is_published)}
                        className={`text-sm px-3 py-1 rounded transition-colors ${
                          quiz.is_published
                            ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400'
                            : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-400'
                        }`}
                      >
                        {quiz.is_published ? '📤 Unpublish' : '📣 Publish'}
                      </button>
                      <button 
                        onClick={() => handleDeleteQuiz(quiz.id)}
                        className="text-sm px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 rounded transition-colors"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>

                  {/* Analytics Preview */}
                  {quiz.is_published && (
                    <div className="border-t border-slate-200 dark:border-slate-700 mt-4 pt-4">
                      <div className="grid grid-cols-4 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">0</div>
                          <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Attempts</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600 dark:text-green-400">--</div>
                          <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Avg Score</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">0%</div>
                          <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Pass Rate</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">--</div>
                          <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Avg Time</div>
                        </div>
                      </div>
                    </div>
                  )}
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