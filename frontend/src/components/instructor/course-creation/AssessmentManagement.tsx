"use client";

import React, { useState, useEffect } from 'react';
import { Course, Assignment, Project, Quiz, EnhancedModule, Question, Answer, QuizQuestionPayload } from '@/types/api';
import CourseCreationService from '@/services/course-creation.service';
import aiAgentService from '@/services/ai-agent.service';
import AIAssessmentModal from './AIAssessmentModal';

interface AssessmentManagementProps {
  course: Course;
  assessments?: {
    quizzes?: Quiz[];
    assignments?: Assignment[];
    projects?: Project[];
  };
  onAssessmentUpdate: () => void | Promise<void>;
}

type AssessmentType = 'quiz' | 'assignment' | 'project';

interface RubricCriteria {
  name: string;
  description: string;
  max_points: number;
}

interface QuizAnswerForm {
  id?: number;
  answer_text: string;
  is_correct: boolean;
}

interface QuizQuestionForm {
  id?: number;
  question_text: string;
  question_type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
  points: number;
  answers: QuizAnswerForm[];
  explanation?: string;
  order_index?: number;
  isNew?: boolean;
  isDirty?: boolean;
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
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // AI Modal states
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiContentType, setAIContentType] = useState<'lesson' | 'module'>('lesson');
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [aiNumQuestions, setAINumQuestions] = useState(10);
  const [aiDifficulty, setAIDifficulty] = useState<'easy' | 'medium' | 'hard' | 'mixed'>('mixed');
  const [aiAssignmentType, setAIAssignmentType] = useState<'practical' | 'theoretical' | 'project' | 'mixed'>('practical');
  const [aiGenerating, setAIGenerating] = useState(false);
  const [modules, setModules] = useState<EnhancedModule[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);

  // Monitor assessments prop changes for debugging
  useEffect(() => {
    if (assessments?.quizzes) {
      console.log(`[AssessmentManagement] Prop update received - Total quizzes: ${assessments.quizzes.length}`);
      console.log('[AssessmentManagement] Full assessments object:', assessments);
      assessments.quizzes.forEach((quiz, idx) => {
        const qCount = quiz.questions?.length || 0;
        console.log(`  └─ Quiz ${idx + 1}: ID=${quiz.id}, Title="${quiz.title}", Questions=${qCount}`);
        if (quiz.questions) {
          console.log(`     └─ Questions array exists with ${quiz.questions.length} items`);
          if (quiz.questions.length > 0) {
            console.log(`     └─ First question in array: "${quiz.questions[0].question_text || quiz.questions[0].text}"`);
          }
        } else {
          console.log(`     └─ NO questions property found!`);
        }
      });
    } else {
      console.log('[AssessmentManagement] No quizzes in assessments prop');
    }
  }, [assessments]);

  // Fetch modules for AI modal
  useEffect(() => {
    const fetchModules = async () => {
      try {
        const courseDetails = await CourseCreationService.getCourseDetails(course.id);
        if (courseDetails.modules) {
          setModules(courseDetails.modules as EnhancedModule[]);
        }
      } catch (error) {
        console.error('Error fetching modules:', error);
      }
    };

    if (course?.id && showAIModal) {
      // First try to use modules from course prop
      if (course.modules && course.modules.length > 0) {
        setModules(course.modules as EnhancedModule[]);
      } else {
        // Otherwise fetch them
        fetchModules();
      }
    }
  }, [course?.id, course.modules, showAIModal]);

  // Fetch lessons when module is selected
  useEffect(() => {
    if (selectedModuleId && modules.length > 0) {
      const selectedModule = modules.find(m => m.id === selectedModuleId);
      if (selectedModule?.lessons) {
        setLessons(selectedModule.lessons);
      }
    } else {
      setLessons([]);
      setSelectedLessonId(null);
    }
  }, [selectedModuleId, modules]);

  const isAnswerBasedQuestion = (type: QuizQuestionForm['question_type']) =>
    type === 'multiple_choice' || type === 'true_false';

  const createDefaultTrueFalseAnswers = (): QuizAnswerForm[] => [
    { answer_text: 'True', is_correct: true },
    { answer_text: 'False', is_correct: false }
  ];

  const ensureAnswerStructure = (
    question: QuizQuestionForm,
    updatedType?: QuizQuestionForm['question_type']
  ): QuizQuestionForm => {
    const targetType = updatedType ?? question.question_type;

    if (!isAnswerBasedQuestion(targetType)) {
      return { ...question, question_type: targetType, answers: [] };
    }

    if (targetType === 'true_false') {
      const normalized = createDefaultTrueFalseAnswers().map((defaultAnswer, index) => {
        const existing = question.answers[index];
        return {
          id: existing?.id,
          answer_text: existing?.answer_text ?? defaultAnswer.answer_text,
          is_correct: index === 0 ? existing?.is_correct ?? true : existing?.is_correct ?? false
        };
      });

      // Ensure only one correct answer remains true
      const firstCorrectIndex = normalized.findIndex(answer => answer.is_correct);
      return {
        ...question,
        question_type: targetType,
        answers: normalized.map((answer, idx) => ({
          ...answer,
          is_correct: idx === (firstCorrectIndex >= 0 ? firstCorrectIndex : 0)
        }))
      };
    }

    // Multiple choice: ensure at least two answer slots
    const existingAnswers = question.answers.length > 0 ? question.answers : [
      { answer_text: '', is_correct: true },
      { answer_text: '', is_correct: false }
    ];

    const normalized = [...existingAnswers];
    while (normalized.length < 2) {
      normalized.push({ answer_text: '', is_correct: false });
    }

    return {
      ...question,
      question_type: targetType,
      answers: normalized
    };
  };

  const questionHasValidCorrectAnswer = (question: QuizQuestionForm) => {
    if (!isAnswerBasedQuestion(question.question_type)) {
      return true;
    }
    return question.answers.some(answer => answer.is_correct && answer.answer_text.trim().length > 0);
  };

  const mapQuestionFormToPayload = (
    question: QuizQuestionForm,
    index: number
  ): QuizQuestionPayload => {
    const orderIndex = question.order_index ?? index + 1;
    const commonFields: QuizQuestionPayload = {
      id: question.id,
      question_text: question.question_text.trim(),
      text: question.question_text.trim(),
      question_type: question.question_type,
      points: Number.isFinite(question.points) ? question.points : 0,
      order_index: orderIndex,
      order: orderIndex,
      explanation: question.explanation?.trim() || undefined
    };

    if (isAnswerBasedQuestion(question.question_type)) {
      commonFields.answers = question.answers.map(answer => ({
        id: answer.id,
        answer_text: answer.answer_text,
        text: answer.answer_text,
        is_correct: answer.is_correct
      }));
    }

    return commonFields;
  };

  const validateQuizQuestions = (questions: QuizQuestionForm[]): QuizQuestionForm[] | null => {
    setErrorMessage(null);

    const sanitizedQuestions = questions.map(question => ({
      ...question,
      answers: question.answers.map(answer => ({ ...answer }))
    }));

    const autoFixedIndices: number[] = [];

    for (const [index, question] of sanitizedQuestions.entries()) {
      if (!question.question_text || !question.question_text.trim()) {
        setErrorMessage(`Question ${index + 1} requires text.`);
        return null;
      }

      if (!Number.isFinite(question.points) || question.points <= 0) {
        setErrorMessage(`Question ${index + 1} must have points greater than 0.`);
        return null;
      }

      if (isAnswerBasedQuestion(question.question_type)) {
        if (question.answers.length < 2) {
          setErrorMessage(`Question ${index + 1} needs at least two answer choices.`);
          return null;
        }

        for (const [answerIndex, answer] of question.answers.entries()) {
          if (!answer.answer_text || !answer.answer_text.trim()) {
            setErrorMessage(`Answer ${answerIndex + 1} for question ${index + 1} cannot be empty.`);
            return null;
          }
        }

        if (!questionHasValidCorrectAnswer(question)) {
          const firstAnswerWithText = question.answers.findIndex(ans => ans.answer_text.trim().length > 0);
          if (firstAnswerWithText === -1) {
            setErrorMessage(`Question ${index + 1} requires at least one correct answer.`);
            return null;
          }

          autoFixedIndices.push(index);
          const updatedAnswers = question.answers.map((answer, answerIndex) => ({
            ...answer,
            is_correct: answerIndex === firstAnswerWithText
          }));

          sanitizedQuestions[index] = {
            ...question,
            answers: updatedAnswers,
            isDirty: question.id ? true : question.isDirty ?? true
          };
        }
      }
    }

    if (autoFixedIndices.length > 0) {
      setCurrentQuestions(sanitizedQuestions);
      const autoFixedCount = autoFixedIndices.length;
      setSuccessMessage(`Auto-selected a correct answer for ${autoFixedCount} question${autoFixedCount > 1 ? 's' : ''}.`);
    }

    return sanitizedQuestions;
  };

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

  // AI Generation Handlers
  const handleOpenAIModal = () => {
    setShowAIModal(true);
    setSelectedModuleId(null);
    setSelectedLessonId(null);
    setAIContentType('lesson');
  };

  const handleAIGenerate = async () => {
    console.log('handleAIGenerate called');
    setAIGenerating(true);
    setErrorMessage(null);
    
    try {
      console.log('Validating inputs...', { selectedModuleId, aiContentType, selectedLessonId });
      
      if (!selectedModuleId) {
        setErrorMessage('Please select a module');
        setAIGenerating(false);
        return;
      }

      if (aiContentType === 'lesson' && !selectedLessonId) {
        setErrorMessage('Please select a lesson');
        setAIGenerating(false);
        return;
      }

      console.log('Starting AI generation for tab:', activeTab);

      // Generate based on active tab
      if (activeTab === 'quizzes') {
        console.log('Calling generateQuizFromContent API...');
        const response = await aiAgentService.generateQuizFromContent({
          course_id: course.id,
          content_type: aiContentType,
          lesson_id: aiContentType === 'lesson' ? selectedLessonId : undefined,
          module_id: selectedModuleId,
          num_questions: aiNumQuestions,
          difficulty: aiDifficulty
        });
        console.log('Quiz generation response:', response);

        // Populate quiz form with AI-generated data
        setQuizForm({
          ...quizForm,
          title: response.quiz.title,
          description: response.quiz.description || '',
          module_id: selectedModuleId.toString(),
          lesson_id: aiContentType === 'lesson' ? selectedLessonId?.toString() || '' : '',
          time_limit: response.quiz.time_limit || 30,
          passing_score: response.quiz.passing_score || 70,
          max_attempts: 3,
          shuffle_questions: true,
          shuffle_answers: true
        });

        // Convert questions to the format expected by the form
        const formattedQuestions = response.quiz.questions.map((q, idx) => ({
          id: idx + 1,
          question_text: q.question_text,
          question_type: 'multiple_choice' as const,
          points: q.points,
          answers: q.answers.map((a, aIdx) => ({
            id: aIdx + 1,
            answer_text: a.answer_text,
            is_correct: a.is_correct,
            explanation: a.explanation || ''
          }))
        }));

        setCurrentQuestions(formattedQuestions);
        setSuccessMessage(`AI generated ${response.quiz.questions.length} questions! Review and save when ready.`);
        
      } else if (activeTab === 'assignments') {
        const response = await aiAgentService.generateAssignmentFromContent({
          course_id: course.id,
          content_type: aiContentType,
          lesson_id: aiContentType === 'lesson' ? selectedLessonId : undefined,
          module_id: selectedModuleId,
          assignment_type: aiAssignmentType
        });

        // Populate assignment form
        setAssignmentForm({
          ...assignmentForm,
          title: response.assignment.title,
          description: response.assignment.description,
          module_id: selectedModuleId.toString(),
          lesson_id: aiContentType === 'lesson' ? selectedLessonId?.toString() || '' : '',
          rubric_criteria: response.assignment.rubric_criteria || '',
          submission_format: response.assignment.submission_format || 'text',
          points_possible: response.assignment.points_possible || 100,
          due_date: ''
        });

        setSuccessMessage('AI generated assignment! Review and save when ready.');
        
      } else if (activeTab === 'projects') {
        const response = await aiAgentService.generateProjectFromContent({
          course_id: course.id,
          module_id: selectedModuleId
        });

        // Populate project form
        setProjectForm({
          ...projectForm,
          title: response.project.title,
          description: response.project.description,
          module_id: selectedModuleId.toString(),
          requirements: response.project.requirements || '',
          rubric_criteria: response.project.rubric_criteria || '',
          resources: response.project.resources || '',
          submission_format: response.project.submission_format || 'file',
          points_possible: response.project.points_possible || 100,
          timeline_weeks: response.project.timeline_weeks || 4,
          team_size_min: response.project.team_size_min || 1,
          team_size_max: response.project.team_size_max || 1,
          due_date: ''
        });

        setSuccessMessage('AI generated project! Review and save when ready.');
      }

      console.log('AI generation successful, closing modal');
      setShowAIModal(false);
      
    } catch (error: any) {
      console.error('AI generation error:', error);
      setErrorMessage(error.response?.data?.message || error.message || 'Failed to generate with AI');
    } finally {
      console.log('AI generation complete, resetting loading state');
      setAIGenerating(false);
    }
  };

  const handleCreateAssignment = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const assignmentData = {
        ...assignmentForm,
        course_id: course.id,
        module_id: assignmentForm.module_id ? parseInt(assignmentForm.module_id) : undefined,
        lesson_id: assignmentForm.lesson_id ? parseInt(assignmentForm.lesson_id) : undefined,
        due_date: assignmentForm.due_date || undefined
      };

      await CourseCreationService.createAssignment(assignmentData);
      setSuccessMessage('Assignment created successfully!');
      onAssessmentUpdate();
      setShowForm(false);
      resetAssignmentForm();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      console.error('Error creating assignment:', error);
      const errorMsg = error?.response?.data?.message || error?.message || 'Failed to create assignment';
      setErrorMessage(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProject = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const projectData = {
        ...projectForm,
        course_id: course.id,
        module_ids: projectForm.module_ids
      };

      await CourseCreationService.createProject(projectData);
      setSuccessMessage('Project created successfully!');
      onAssessmentUpdate();
      setShowForm(false);
      resetProjectForm();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      console.error('Error creating project:', error);
      const errorMsg = error?.response?.data?.message || error?.message || 'Failed to create project';
      setErrorMessage(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateQuiz = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      // Validate required fields
      if (!quizForm.title || !quizForm.title.trim()) {
        setErrorMessage('Quiz title is required');
        setIsLoading(false);
        return;
      }

      // Prevent publishing quiz without questions
      if (quizForm.is_published && currentQuestions.length === 0) {
        setErrorMessage('Cannot publish a quiz without questions. Please add at least one question or uncheck "Publish immediately"');
        setIsLoading(false);
        return;
      }

      let preparedQuestions: QuizQuestionForm[] = currentQuestions;
      if (preparedQuestions.length > 0) {
        const sanitized = validateQuizQuestions(preparedQuestions);
        if (!sanitized) {
          setIsLoading(false);
          return;
        }
        preparedQuestions = sanitized;
      }

      const questionPayloads = preparedQuestions.length > 0
        ? preparedQuestions.map((question, index) => mapQuestionFormToPayload(question, index))
        : undefined;

      // Include all quiz settings fields that exist in the model
      const quizData = {
        title: quizForm.title,
        description: quizForm.description,
        course_id: course.id,
        module_id: quizForm.module_id ? parseInt(quizForm.module_id) : undefined,
        lesson_id: quizForm.lesson_id ? parseInt(quizForm.lesson_id) : undefined,
        is_published: quizForm.is_published,
        time_limit: quizForm.time_limit ? parseInt(quizForm.time_limit) : undefined,
        max_attempts: quizForm.max_attempts ? parseInt(quizForm.max_attempts) : undefined,
        passing_score: quizForm.passing_score,
        due_date: quizForm.due_date || undefined,
        points_possible: quizForm.points_possible,
        shuffle_questions: quizForm.shuffle_questions,
        shuffle_answers: quizForm.shuffle_answers,
        show_correct_answers: quizForm.show_correct_answers,
        questions: questionPayloads
      };

      console.log('=== CREATING QUIZ ===');
  console.log('Current questions in state:', preparedQuestions);
      console.log('Quiz data being sent:', JSON.stringify(quizData, null, 2));

      const createdQuiz = await CourseCreationService.createQuiz(quizData);
      console.log('Quiz created successfully:', createdQuiz);
      console.log('Questions in created quiz:', createdQuiz.questions);
      
      // If questions weren't sent with quiz creation (backward compatibility),
      // add them using bulk endpoint
      if (!quizData.questions && preparedQuestions.length > 0) {
        console.log('Adding questions separately (fallback):', preparedQuestions);
        await CourseCreationService.addBulkQuizQuestions(createdQuiz.id, questionPayloads ?? []);
      }
      
      const questionCount = preparedQuestions.length;
      setSuccessMessage(`Quiz created successfully with ${questionCount} question${questionCount !== 1 ? 's' : ''}!`);
      onAssessmentUpdate();
      setShowForm(false);
      resetQuizForm();
  setCurrentQuestions([]);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      console.error('Error creating quiz:', error);
      console.error('Error details:', {
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status
      });
      const errorMsg = error?.response?.data?.message || error?.message || 'Failed to create quiz';
      setErrorMessage(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAssignment = async (assignmentId: number) => {
    if (!confirm('Are you sure you want to delete this assignment? This action cannot be undone.')) return;
    
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await CourseCreationService.deleteAssignment(assignmentId);
      setSuccessMessage('Assignment deleted successfully!');
      onAssessmentUpdate();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      console.error('Error deleting assignment:', error);
      const errorMsg = error?.response?.data?.message || error?.message || 'Failed to delete assignment';
      setErrorMessage(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProject = async (projectId: number) => {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) return;
    
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await CourseCreationService.deleteProject(projectId);
      setSuccessMessage('Project deleted successfully!');
      onAssessmentUpdate();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      console.error('Error deleting project:', error);
      const errorMsg = error?.response?.data?.message || error?.message || 'Failed to delete project';
      setErrorMessage(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteQuiz = async (quizId: number) => {
    if (!confirm('Are you sure you want to delete this quiz? This action cannot be undone.')) return;
    
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await CourseCreationService.deleteQuiz(quizId);
      setSuccessMessage('Quiz deleted successfully!');
      onAssessmentUpdate();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      console.error('Error deleting quiz:', error);
      const errorMsg = error?.response?.data?.message || error?.message || 'Failed to delete quiz';
      setErrorMessage(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Publish/Unpublish handlers
  const handlePublishAssignment = async (assignmentId: number, isPublished: boolean) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await CourseCreationService.updateAssignment(assignmentId, {
        is_published: !isPublished
      });
      setSuccessMessage(`Assignment ${!isPublished ? 'published' : 'unpublished'} successfully!`);
      onAssessmentUpdate();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      console.error('Error publishing/unpublishing assignment:', error);
      const errorMsg = error?.response?.data?.message || error?.message || 'Failed to update assignment publication status';
      setErrorMessage(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublishProject = async (projectId: number, isPublished: boolean) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await CourseCreationService.updateProject(projectId, {
        is_published: !isPublished
      });
      setSuccessMessage(`Project ${!isPublished ? 'published' : 'unpublished'} successfully!`);
      onAssessmentUpdate();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      console.error('Error publishing/unpublishing project:', error);
      const errorMsg = error?.response?.data?.message || error?.message || 'Failed to update project publication status';
      setErrorMessage(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublishQuiz = async (quizId: number, isPublished: boolean) => {
    // If trying to publish, check if quiz has questions
    if (!isPublished) {
      const quiz = assessments?.quizzes?.find(q => q.id === quizId);
      if (quiz && (!quiz.questions || quiz.questions.length === 0)) {
        setErrorMessage('Cannot publish a quiz without questions. Please edit the quiz and add questions first.');
        return;
      }
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      await CourseCreationService.updateQuiz(quizId, {
        is_published: !isPublished
      });
      setSuccessMessage(`Quiz ${!isPublished ? 'published' : 'unpublished'} successfully!`);
      onAssessmentUpdate();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      console.error('Error publishing/unpublishing quiz:', error);
      const errorMsg = error?.response?.data?.message || error?.message || 'Failed to update quiz publication status';
      setErrorMessage(errorMsg);
    } finally {
      setIsLoading(false);
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
    
    // Format due_date for datetime-local input (YYYY-MM-DDTHH:mm)
    let formattedDueDate = '';
    if (quiz.due_date) {
      try {
        const date = new Date(quiz.due_date);
        formattedDueDate = date.toISOString().slice(0, 16);
      } catch (e) {
        formattedDueDate = '';
      }
    }
    
    setQuizForm({
      title: quiz.title,
      description: quiz.description || '',
      module_id: quiz.module_id ? quiz.module_id.toString() : '',
      lesson_id: quiz.lesson_id ? quiz.lesson_id.toString() : '',
      is_published: quiz.is_published || false,
      time_limit: quiz.time_limit?.toString() || '',
      max_attempts: quiz.max_attempts?.toString() || '',
      passing_score: quiz.passing_score ?? 70,
      shuffle_questions: quiz.shuffle_questions ?? false,
      shuffle_answers: quiz.shuffle_answers ?? false,
      show_correct_answers: quiz.show_correct_answers ?? true,
      points_possible: quiz.points_possible ?? 100,
      due_date: formattedDueDate
    });
    
    // Load existing questions if available
    if (quiz.questions && Array.isArray(quiz.questions) && quiz.questions.length > 0) {
      console.log('Loading existing questions:', quiz.questions);
      const sortedQuestions = [...quiz.questions].sort((a, b) => {
        const orderA = a.order_index ?? a.order ?? 0;
        const orderB = b.order_index ?? b.order ?? 0;
        return orderA - orderB;
      });

      const formattedQuestions = sortedQuestions.map((q: Question, idx): QuizQuestionForm => {
        const baseQuestion: QuizQuestionForm = {
          id: q.id,
          question_text: q.question_text || q.text || '',
          question_type: (q.question_type as QuizQuestionForm['question_type']) || 'multiple_choice',
          points: q.points || 10,
          answers: (q.answers || []).map((a: Answer) => ({
            id: a.id,
            answer_text: a.answer_text || a.text || '',
            is_correct: !!a.is_correct
          })),
          explanation: q.explanation || '',
          order_index: q.order_index || q.order || idx + 1,
          isNew: false,
          isDirty: false
        };

        return ensureAnswerStructure(baseQuestion, baseQuestion.question_type);
      });

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
    
    setIsLoading(true);
    setErrorMessage(null);
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
      setSuccessMessage('Assignment updated successfully!');
      onAssessmentUpdate();
      setShowForm(false);
      setEditingItem(null);
      resetAssignmentForm();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      console.error('Error updating assignment:', error);
      const errorMsg = error?.response?.data?.message || error?.message || 'Failed to update assignment';
      setErrorMessage(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateProject = async () => {
    if (!editingItem) return;
    
    setIsLoading(true);
    setErrorMessage(null);
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
      setSuccessMessage('Project updated successfully!');
      onAssessmentUpdate();
      setShowForm(false);
      setEditingItem(null);
      resetProjectForm();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      console.error('Error updating project:', error);
      const errorMsg = error?.response?.data?.message || error?.message || 'Failed to update project';
      setErrorMessage(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateQuiz = async () => {
    if (!editingItem) return;
    
    setIsLoading(true);
    setErrorMessage(null);
    try {
      // Validate required fields
      if (!quizForm.title || !quizForm.title.trim()) {
        setErrorMessage('Quiz title is required');
        setIsLoading(false);
        return;
      }

      // Prevent publishing quiz without questions
      if (quizForm.is_published && currentQuestions.length === 0) {
        setErrorMessage('Cannot publish a quiz without questions. Please add at least one question or uncheck "Publish immediately"');
        setIsLoading(false);
        return;
      }

      let preparedQuestions: QuizQuestionForm[] = currentQuestions;
      if (preparedQuestions.length > 0) {
        const sanitized = validateQuizQuestions(preparedQuestions);
        if (!sanitized) {
          setIsLoading(false);
          return;
        }
        preparedQuestions = sanitized;
      }

      // Include all quiz settings fields that exist in the model
      const quizData = {
        title: quizForm.title,
        description: quizForm.description,
        module_id: quizForm.module_id ? parseInt(quizForm.module_id) : undefined,
        lesson_id: quizForm.lesson_id ? parseInt(quizForm.lesson_id) : undefined,
        is_published: quizForm.is_published,
        time_limit: quizForm.time_limit ? parseInt(quizForm.time_limit) : undefined,
        max_attempts: quizForm.max_attempts ? parseInt(quizForm.max_attempts) : undefined,
        passing_score: quizForm.passing_score,
        due_date: quizForm.due_date || undefined,
        points_possible: quizForm.points_possible,
        shuffle_questions: quizForm.shuffle_questions,
        shuffle_answers: quizForm.shuffle_answers,
        show_correct_answers: quizForm.show_correct_answers
      };

      console.log('Updating quiz with data:', JSON.stringify(quizData, null, 2));

      await CourseCreationService.updateQuiz(editingItem.id, quizData);
      console.log('Quiz updated successfully');
      
      const resolvedQuestions: QuizQuestionForm[] = [];

      for (let index = 0; index < preparedQuestions.length; index++) {
        const question = preparedQuestions[index];
        const payload = mapQuestionFormToPayload({
          ...question,
          order_index: index + 1
        }, index);

        if (question.id) {
          if (question.isDirty || question.order_index !== index + 1) {
            await CourseCreationService.updateQuizQuestion(editingItem.id, question.id, payload);
          }

          resolvedQuestions.push({
            ...ensureAnswerStructure({ ...question, order_index: index + 1 }, question.question_type),
            isDirty: false,
            isNew: false
          });
        } else {
          const createdQuestion = await CourseCreationService.addQuizQuestion(editingItem.id, payload);
          const responseAnswers = (createdQuestion.answers || []).map((answer: Answer) => ({
            id: answer.id,
            answer_text: answer.answer_text || answer.text || '',
            is_correct: !!answer.is_correct
          }));

          const normalizedAnswers: QuizAnswerForm[] = responseAnswers.length > 0
            ? responseAnswers
            : question.answers.map(answer => ({ ...answer }));

          const normalizedQuestion: QuizQuestionForm = ensureAnswerStructure({
            id: createdQuestion.id,
            question_text: createdQuestion.question_text || createdQuestion.text || question.question_text,
            question_type: (createdQuestion.question_type as QuizQuestionForm['question_type']) || question.question_type,
            points: createdQuestion.points || question.points,
            answers: normalizedAnswers,
            explanation: createdQuestion.explanation || question.explanation,
            order_index: createdQuestion.order_index || createdQuestion.order || index + 1,
            isNew: false,
            isDirty: false
          }, (createdQuestion.question_type as QuizQuestionForm['question_type']) || question.question_type);

          resolvedQuestions.push(normalizedQuestion);
        }
      }

      // Reorder all questions that have IDs (newly created will now have IDs from creation)
      const questionsWithIds = resolvedQuestions.filter(q => q.id);
      if (questionsWithIds.length > 0) {
        const orderingIds = questionsWithIds.map(q => q.id!) as number[];
        try {
          await CourseCreationService.reorderQuizQuestions(editingItem.id, orderingIds);
        } catch (reorderError: any) {
          // Log but don't fail - reorder is not critical to the update
          console.warn('Could not reorder questions:', reorderError?.response?.data?.message || reorderError?.message);
        }
      }

      setCurrentQuestions(resolvedQuestions);

      setSuccessMessage('Quiz updated successfully!');
      
      // Wait for parent to refresh data from backend before closing
      try {
        await Promise.resolve(onAssessmentUpdate());
      } catch (updateError) {
        console.warn('Error during assessment update callback:', updateError);
      }
      
      // Close form with slight delay to show success message
      setTimeout(() => {
        setShowForm(false);
        setEditingItem(null);
        resetQuizForm();
      }, 500);
      
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (error: any) {
      console.error('Error updating quiz:', error);
      console.error('Error details:', {
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status
      });
      const errorMsg = error?.response?.data?.message || error?.message || 'Failed to update quiz';
      setErrorMessage(errorMsg);
    } finally {
      setIsLoading(false);
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

  // Question builder helpers
  const recalculateQuestionOrder = (questions: QuizQuestionForm[]) =>
    questions.map((question, index) => ({
      ...question,
      order_index: index + 1
    }));

  const addQuestion = () => {
    setCurrentQuestions(prev => {
      const newQuestion: QuizQuestionForm = {
        question_text: '',
        question_type: 'multiple_choice',
        points: 10,
        answers: [
          { answer_text: '', is_correct: false },
          { answer_text: '', is_correct: false }
        ],
        explanation: '',
        order_index: prev.length + 1,
        isNew: true,
        isDirty: true
      };
      const updated: QuizQuestionForm[] = [...prev, newQuestion];
      return recalculateQuestionOrder(updated);
    });
    setShowQuestionBuilder(true);
  };

  const markQuestionDirty = (question: QuizQuestionForm): QuizQuestionForm =>
    question.id ? { ...question, isDirty: true } : { ...question };

  const updateQuestion = (index: number, updates: Partial<QuizQuestionForm>) => {
    setCurrentQuestions(prev => {
      const updated = prev.map((question, idx) => {
        if (idx !== index) {
          return question;
        }

        let merged: QuizQuestionForm = {
          ...question,
          ...updates
        };

        if (updates.question_type && updates.question_type !== question.question_type) {
          merged = ensureAnswerStructure(merged, updates.question_type);
        } else if (updates.answers) {
          merged = {
            ...merged,
            answers: updates.answers
          };
        }

        return markQuestionDirty({
          ...merged,
          order_index: index + 1
        });
      });

      return recalculateQuestionOrder(updated);
    });
  };

  const removeQuestion = async (index: number) => {
    const question = currentQuestions[index];

    if (question?.id && editingItem) {
      if (!confirm('Are you sure you want to delete this question? This action cannot be undone.')) {
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        await CourseCreationService.deleteQuizQuestion(editingItem.id, question.id);
        setSuccessMessage('Question deleted successfully!');
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (error: any) {
        console.error('Error deleting question:', error);
        const errorMsg = error?.response?.data?.message || error?.message || 'Failed to delete question';
        setErrorMessage(errorMsg);
        setIsLoading(false);
        return;
      }
      setIsLoading(false);
      let updatedQuestionsList: QuizQuestionForm[] = [];
      setCurrentQuestions(prev => {
        const filtered = prev.filter((_, i) => i !== index);
        updatedQuestionsList = recalculateQuestionOrder(filtered);
        return updatedQuestionsList;
      });

      if (editingItem) {
        const remainingIds = updatedQuestionsList.filter(q => q.id).map(q => q.id!) as number[];
        if (remainingIds.length > 0) {
          try {
            await CourseCreationService.reorderQuizQuestions(editingItem.id, remainingIds);
          } catch (error: any) {
            console.error('Error reordering questions after deletion:', error);
          }
        }
        onAssessmentUpdate();
      }

      setIsLoading(false);
      return;
    }

    setCurrentQuestions(prev => recalculateQuestionOrder(prev.filter((_, i) => i !== index)));
  };

  const addAnswer = (questionIndex: number) => {
    setCurrentQuestions(prev => {
      const updated = [...prev];
      updated[questionIndex] = markQuestionDirty({
        ...updated[questionIndex],
        answers: [
          ...updated[questionIndex].answers,
          { answer_text: '', is_correct: false }
        ]
      });
      return updated;
    });
  };

  const updateAnswer = (
    questionIndex: number,
    answerIndex: number,
    updates: Partial<QuizAnswerForm>
  ) => {
    setCurrentQuestions(prev => {
      const updated = [...prev];
      const question = updated[questionIndex];
      const newAnswers = [...question.answers];
      newAnswers[answerIndex] = {
        ...newAnswers[answerIndex],
        ...updates
      };
      updated[questionIndex] = markQuestionDirty({
        ...question,
        answers: newAnswers
      });
      return updated;
    });
  };

  const removeAnswer = (questionIndex: number, answerIndex: number) => {
    setCurrentQuestions(prev => {
      const updated = [...prev];
      const question = updated[questionIndex];
      const newAnswers = question.answers.filter((_, i) => i !== answerIndex);
      updated[questionIndex] = markQuestionDirty({
        ...question,
        answers: newAnswers
      });
      return updated;
    });
  };

  const moveQuestion = (from: number, to: number) => {
    setCurrentQuestions(prev => {
      if (to < 0 || to >= prev.length) {
        return prev;
      }
      const updated: QuizQuestionForm[] = [...prev];
      const [moved] = updated.splice(from, 1);
      updated.splice(to, 0, moved);
      const marked = updated.map(markQuestionDirty);
      return recalculateQuestionOrder(marked);
    });
  };

  const moveQuestionUp = (index: number) => moveQuestion(index, index - 1);
  const moveQuestionDown = (index: number) => moveQuestion(index, index + 1);

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
      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xl">✅</span>
            <span className="font-medium">{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xl">⚠️</span>
            <span className="font-medium">{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
          >
            ✕
          </button>
        </div>
      )}

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
        <div className="flex justify-between items-center">
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
          
          {/* AI Assistant Button for active tab */}
          <button
            onClick={handleOpenAIModal}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
            title={`Generate ${activeTab === 'assignment' ? 'Assignment' : activeTab === 'quiz' ? 'Quiz' : 'Project'} with AI`}
          >
            <span className="text-lg">🤖</span>
            <span className="font-medium">AI Assistant</span>
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
              {activeTab === 'assignment' ? 'Assignment' : activeTab === 'quiz' ? 'Quiz' : 'Project'}
            </span>
          </button>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border-2 border-slate-200 dark:border-slate-700 p-5">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search Bar */}
          <div className="flex-1">
            <div className="relative group">
              <input
                type="text"
                placeholder={`Search ${activeTab === 'assignment' ? 'assignments' : activeTab === 'quiz' ? 'quizzes' : 'projects'}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-white transition-all duration-200 group-hover:border-blue-400"
              />
              <span className="absolute left-4 top-3.5 text-slate-400 text-xl group-hover:scale-110 transition-transform">🔍</span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          
          {/* Status Filter Buttons */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-5 py-3 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center space-x-2 ${
                filterStatus === 'all'
                  ? 'bg-blue-600 text-white shadow-lg transform scale-105'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 hover:scale-105'
              }`}
            >
              <span>📋</span>
              <span>All</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                filterStatus === 'all' 
                  ? 'bg-blue-700 text-white' 
                  : 'bg-slate-200 dark:bg-slate-600'
              }`}>
                {activeTab === 'assignment' ? assessments?.assignments?.length || 0 
                  : activeTab === 'quiz' ? assessments?.quizzes?.length || 0 
                  : assessments?.projects?.length || 0}
              </span>
            </button>
            
            <button
              onClick={() => setFilterStatus('published')}
              className={`px-5 py-3 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center space-x-2 ${
                filterStatus === 'published'
                  ? 'bg-green-600 text-white shadow-lg transform scale-105'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 hover:scale-105'
              }`}
            >
              <span>✅</span>
              <span>Published</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                filterStatus === 'published' 
                  ? 'bg-green-700 text-white' 
                  : 'bg-slate-200 dark:bg-slate-600'
              }`}>
                {activeTab === 'assignment' ? assessments?.assignments?.filter(a => a.is_published).length || 0 
                  : activeTab === 'quiz' ? assessments?.quizzes?.filter(q => q.is_published).length || 0 
                  : assessments?.projects?.filter(p => p.is_published).length || 0}
              </span>
            </button>
            
            <button
              onClick={() => setFilterStatus('draft')}
              className={`px-5 py-3 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center space-x-2 ${
                filterStatus === 'draft'
                  ? 'bg-yellow-600 text-white shadow-lg transform scale-105'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 hover:scale-105'
              }`}
            >
              <span>📝</span>
              <span>Drafts</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                filterStatus === 'draft' 
                  ? 'bg-yellow-700 text-white' 
                  : 'bg-slate-200 dark:bg-slate-600'
              }`}>
                {activeTab === 'assignment' ? assessments?.assignments?.filter(a => !a.is_published).length || 0 
                  : activeTab === 'quiz' ? assessments?.quizzes?.filter(q => !q.is_published).length || 0 
                  : assessments?.projects?.filter(p => !p.is_published).length || 0}
              </span>
            </button>
          </div>
        </div>
        
        {/* Active Filters Display */}
        {(searchQuery || filterStatus !== 'all') && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Active filters:</span>
                {searchQuery && (
                  <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-xs font-medium flex items-center space-x-1">
                    <span>Search: "{searchQuery}"</span>
                    <button onClick={() => setSearchQuery('')} className="ml-1 hover:text-blue-600">✕</button>
                  </span>
                )}
                {filterStatus !== 'all' && (
                  <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-full text-xs font-medium flex items-center space-x-1">
                    <span>Status: {filterStatus}</span>
                    <button onClick={() => setFilterStatus('all')} className="ml-1 hover:text-purple-600">✕</button>
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterStatus('all');
                }}
                className="text-sm text-red-600 dark:text-red-400 hover:underline font-medium"
              >
                Clear all filters
              </button>
            </div>
          </div>
        )}
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
                  disabled={isLoading}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={editingItem ? handleUpdateAssignment : handleCreateAssignment}
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isLoading && (
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  <span>{isLoading ? 'Saving...' : (editingItem ? 'Update Assignment' : 'Create Assignment')}</span>
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
                  disabled={isLoading}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={editingItem ? handleUpdateProject : handleCreateProject}
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isLoading && (
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  <span>{isLoading ? 'Saving...' : (editingItem ? 'Update Project' : 'Create Project')}</span>
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
                      disabled={currentQuestions.length === 0}
                      className="form-checkbox h-4 w-4 text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <span className={`text-sm font-medium ${currentQuestions.length === 0 ? 'text-slate-400 dark:text-slate-600' : 'text-slate-700 dark:text-slate-300'}`}>
                      Publish quiz immediately {currentQuestions.length === 0 && '(Add questions first)'}
                    </span>
                  </label>
                </div>
              </div>

              {/* Question Builder Toggle */}
              <div className="border-t-2 border-slate-200 dark:border-slate-700 pt-6">
                <button
                  type="button"
                  onClick={() => setShowQuestionBuilder(!showQuestionBuilder)}
                  className={`flex items-center justify-between w-full px-5 py-4 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-[1.02] ${
                    currentQuestions.length === 0 
                      ? 'bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/10 dark:to-red-900/10 hover:from-orange-100 hover:to-red-100 dark:hover:from-orange-900/20 dark:hover:to-red-900/20 border-2 border-orange-300 dark:border-orange-700'
                      : 'bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/10 dark:to-purple-900/10 hover:from-blue-100 hover:to-purple-100 dark:hover:from-blue-900/20 dark:hover:to-purple-900/20 border-2 border-blue-300 dark:border-blue-700'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      currentQuestions.length === 0
                        ? 'bg-orange-200 dark:bg-orange-800'
                        : 'bg-blue-200 dark:bg-blue-800'
                    }`}>
                      <span className="text-xl">❓</span>
                    </div>
                    <div className="text-left">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900 dark:text-white text-lg">Quiz Questions</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm ${
                          currentQuestions.length === 0
                            ? 'bg-orange-500 text-white animate-pulse'
                            : 'bg-blue-600 text-white'
                        }`}>
                          {currentQuestions.length} {currentQuestions.length === 1 ? 'question' : 'questions'}
                        </span>
                        {currentQuestions.length === 0 && (
                          <span className="text-xs text-orange-700 dark:text-orange-300 font-bold bg-orange-200 dark:bg-orange-900/40 px-2 py-1 rounded animate-pulse">
                            ⚠️ Required
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-600 dark:text-slate-400 mt-1 block">
                        {showQuestionBuilder ? 'Click to collapse' : 'Click to expand and manage questions'}
                      </span>
                    </div>
                  </div>
                  <div className={`text-2xl transition-transform duration-200 ${showQuestionBuilder ? 'rotate-180' : ''}`}>
                    <span className="text-slate-600 dark:text-slate-400">▼</span>
                  </div>
                </button>

                {showQuestionBuilder && (
                  <div className="mt-6 space-y-5">
                    {currentQuestions.map((question, qIndex) => (
                      <div key={qIndex} className="p-5 border-2 border-slate-200 dark:border-slate-600 rounded-xl bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-700/50 shadow-md hover:shadow-lg transition-all duration-200">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between mb-4 gap-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                              {qIndex + 1}
                            </div>
                            <h6 className="font-bold text-slate-900 dark:text-white text-lg">Question {qIndex + 1}</h6>
                            <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs font-bold">
                              {question.points || 10} pts
                            </span>
                            {question.order_index && (
                              <span className="px-2 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full text-xs font-semibold">
                                Order #{question.order_index}
                              </span>
                            )}
                            {question.isNew && (
                              <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full text-xs font-semibold">
                                New
                              </span>
                            )}
                            {question.id && question.isDirty && (
                              <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full text-xs font-semibold animate-pulse">
                                Unsaved changes
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center overflow-hidden rounded-lg border border-slate-300 dark:border-slate-600 shadow-sm">
                              <button
                                type="button"
                                onClick={() => moveQuestionUp(qIndex)}
                                disabled={qIndex === 0}
                                className={`px-3 py-1 text-sm font-medium transition-colors ${
                                  qIndex === 0
                                    ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                                aria-label="Move question up"
                                title="Move question up"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                onClick={() => moveQuestionDown(qIndex)}
                                disabled={qIndex === currentQuestions.length - 1}
                                className={`px-3 py-1 text-sm font-medium border-l border-slate-200 dark:border-slate-700 transition-colors ${
                                  qIndex === currentQuestions.length - 1
                                    ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                                aria-label="Move question down"
                                title="Move question down"
                              >
                                ▼
                              </button>
                            </div>
                            <button
                              onClick={() => removeQuestion(qIndex)}
                              className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium flex items-center space-x-1 shadow-sm"
                            >
                              <span>🗑️</span>
                              <span>Remove</span>
                            </button>
                          </div>
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
                      type="button"
                      onClick={addQuestion}
                      className="w-full py-4 px-6 border-3 border-dashed border-blue-400 dark:border-blue-600 rounded-xl text-blue-700 dark:text-blue-300 hover:border-blue-600 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-blue-900/20 dark:hover:to-purple-900/20 transition-all duration-200 font-bold text-lg flex items-center justify-center space-x-3 group shadow-sm hover:shadow-md"
                    >
                      <span className="text-2xl group-hover:scale-110 transition-transform">➕</span>
                      <span>Add Another Question</span>
                    </button>
                  </div>
                )}

                {/* Quick Add Question Button (when collapsed) */}
                {!showQuestionBuilder && (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={addQuestion}
                      className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-bold text-lg flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:scale-[1.02] group"
                    >
                      <span className="text-2xl group-hover:scale-110 transition-transform">➕</span>
                      <span>Add {currentQuestions.length === 0 ? 'First' : 'Another'} Question</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Quiz Summary */}
              {currentQuestions.length > 0 && (
                <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-blue-900/20 dark:via-purple-900/20 dark:to-pink-900/20 border-2 border-blue-300 dark:border-blue-700 rounded-xl p-6 shadow-lg">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center shadow-md">
                      <span className="text-3xl">📊</span>
                    </div>
                    <div className="flex-1">
                      <h6 className="font-bold text-slate-900 dark:text-white mb-4 text-lg flex items-center space-x-2">
                        <span>Quiz Summary</span>
                        <span className="px-2 py-1 bg-green-500 text-white rounded-full text-xs font-bold animate-pulse">✓ Ready</span>
                      </h6>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-slate-800 rounded-lg p-3 shadow-md border border-slate-200 dark:border-slate-700">
                          <div className="text-xs text-slate-600 dark:text-slate-400 mb-1 flex items-center space-x-1">
                            <span>❓</span>
                            <span>Questions</span>
                          </div>
                          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{currentQuestions.length}</div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 rounded-lg p-3 shadow-md border border-slate-200 dark:border-slate-700">
                          <div className="text-xs text-slate-600 dark:text-slate-400 mb-1 flex items-center space-x-1">
                            <span>🎯</span>
                            <span>Total Points</span>
                          </div>
                          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                            {currentQuestions.reduce((sum, q) => sum + (q.points || 0), 0)}
                          </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 rounded-lg p-3 shadow-md border border-slate-200 dark:border-slate-700">
                          <div className="text-xs text-slate-600 dark:text-slate-400 mb-1 flex items-center space-x-1">
                            <span>📈</span>
                            <span>Avg Points</span>
                          </div>
                          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {(currentQuestions.reduce((sum, q) => sum + (q.points || 0), 0) / currentQuestions.length).toFixed(1)}
                          </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 rounded-lg p-3 shadow-md border border-slate-200 dark:border-slate-700">
                          <div className="text-xs text-slate-600 dark:text-slate-400 mb-1 flex items-center space-x-1">
                            <span>📋</span>
                            <span>Question Types</span>
                          </div>
                          <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-1">
                            {[...new Set(currentQuestions.map(q => q.question_type))].length} type(s)
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingItem(null);
                    resetQuizForm();
                  }}
                  disabled={isLoading}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={editingItem ? handleUpdateQuiz : handleCreateQuiz}
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isLoading && (
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  <span>{isLoading ? 'Saving...' : (editingItem ? 'Update Quiz' : 'Create Quiz')}</span>
                  {!isLoading && currentQuestions.length > 0 && !editingItem && (
                    <span className="text-xs bg-blue-700 px-2 py-1 rounded font-bold">
                      with {currentQuestions.length} question{currentQuestions.length !== 1 ? 's' : ''}
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
              <>
                {/* Quiz Overview Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/10 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">Total Quizzes</p>
                        <p className="text-3xl font-bold text-blue-900 dark:text-blue-100 mt-1">
                          {assessments?.quizzes?.length || 0}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-blue-200 dark:bg-blue-800 rounded-full flex items-center justify-center">
                        <span className="text-2xl">❓</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/10 rounded-xl p-4 border border-green-200 dark:border-green-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wide">Published</p>
                        <p className="text-3xl font-bold text-green-900 dark:text-green-100 mt-1">
                          {assessments?.quizzes?.filter(q => q.is_published).length || 0}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-green-200 dark:bg-green-800 rounded-full flex items-center justify-center">
                        <span className="text-2xl">✅</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-900/10 rounded-xl p-4 border border-yellow-200 dark:border-yellow-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400 uppercase tracking-wide">Drafts</p>
                        <p className="text-3xl font-bold text-yellow-900 dark:text-yellow-100 mt-1">
                          {assessments?.quizzes?.filter(q => !q.is_published).length || 0}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-yellow-200 dark:bg-yellow-800 rounded-full flex items-center justify-center">
                        <span className="text-2xl">📝</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-900/10 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wide">Total Questions</p>
                        <p className="text-3xl font-bold text-purple-900 dark:text-purple-100 mt-1">
                          {assessments?.quizzes?.reduce((sum, q) => sum + (q.questions?.length || 0), 0) || 0}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-purple-200 dark:bg-purple-800 rounded-full flex items-center justify-center">
                        <span className="text-2xl">📊</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quiz Cards */}
                <div className="space-y-4">
                  {filterAssessments(assessments?.quizzes).map((quiz) => {
                    const questionCount = quiz.questions?.length || 0;
                    const hasQuestions = questionCount > 0;
                    const totalPoints = quiz.questions?.reduce((sum, q) => sum + (q.points || 0), 0) || 0;
                    const difficulty = questionCount < 5 ? 'Easy' : questionCount < 10 ? 'Medium' : 'Hard';
                    const difficultyColor = difficulty === 'Easy' ? 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20' 
                                           : difficulty === 'Medium' ? 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/20'
                                           : 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20';

                    return (
                      <div 
                        key={quiz.id} 
                        className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border-2 border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-xl transition-all duration-300 hover:border-blue-300 dark:hover:border-blue-700"
                      >
                        {/* Header Section with Gradient */}
                        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-5 border-b-2 border-slate-200 dark:border-slate-700">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-2">
                                <span className="text-3xl">❓</span>
                                <h4 className="text-xl font-bold text-slate-900 dark:text-white">{quiz.title}</h4>
                              </div>
                              
                              {/* Status Badges */}
                              <div className="flex flex-wrap items-center gap-2 mb-3">
                                <span className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center space-x-1 ${
                                  quiz.is_published 
                                    ? 'bg-green-500 text-white shadow-md'
                                    : 'bg-yellow-500 text-white shadow-md'
                                }`}>
                                  <span>{quiz.is_published ? '✓' : '📝'}</span>
                                  <span>{quiz.is_published ? 'Published' : 'Draft'}</span>
                                </span>
                                
                                {!hasQuestions && (
                                  <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-orange-500 text-white shadow-md flex items-center space-x-1 animate-pulse">
                                    <span>⚠️</span>
                                    <span>No Questions</span>
                                  </span>
                                )}
                                
                                {hasQuestions && (
                                  <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${difficultyColor}`}>
                                    {difficulty}
                                  </span>
                                )}
                                
                                {quiz.time_limit && (
                                  <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 flex items-center space-x-1">
                                    <span>⏱️</span>
                                    <span>{quiz.time_limit} min</span>
                                  </span>
                                )}
                              </div>
                              
                              {quiz.description && (
                                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{quiz.description}</p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-4 gap-4 p-5 bg-slate-50 dark:bg-slate-900/30">
                          <div className="text-center">
                            <div className="flex items-center justify-center mb-1">
                              <span className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center space-x-1">
                                <span>❓</span>
                                <span>Questions</span>
                              </span>
                            </div>
                            <div className={`text-2xl font-bold ${hasQuestions ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                              {questionCount}
                            </div>
                          </div>
                          
                          <div className="text-center">
                            <div className="flex items-center justify-center mb-1">
                              <span className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center space-x-1">
                                <span>🎯</span>
                                <span>Points</span>
                              </span>
                            </div>
                            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                              {totalPoints}
                            </div>
                          </div>
                          
                          <div className="text-center">
                            <div className="flex items-center justify-center mb-1">
                              <span className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center space-x-1">
                                <span>🔄</span>
                                <span>Attempts</span>
                              </span>
                            </div>
                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                              {quiz.max_attempts || '∞'}
                            </div>
                          </div>
                          
                          <div className="text-center">
                            <div className="flex items-center justify-center mb-1">
                              <span className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center space-x-1">
                                <span>📅</span>
                                <span>Created</span>
                              </span>
                            </div>
                            <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                              {new Date(quiz.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="p-4 bg-white dark:bg-slate-800 flex items-center justify-between border-t border-slate-200 dark:border-slate-700">
                          <div className="flex items-center space-x-2">
                            <button 
                              onClick={() => handleEditQuiz(quiz)}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium text-sm flex items-center space-x-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                            >
                              <span>✏️</span>
                              <span>Edit Quiz</span>
                            </button>
                            
                            <button
                              onClick={() => handlePublishQuiz(quiz.id, !!quiz.is_published)}
                              disabled={!quiz.is_published && !hasQuestions}
                              className={`px-4 py-2 rounded-lg transition-all duration-200 font-medium text-sm flex items-center space-x-2 shadow-md ${
                                quiz.is_published
                                  ? 'bg-yellow-500 text-white hover:bg-yellow-600 hover:shadow-lg transform hover:-translate-y-0.5'
                                  : !hasQuestions
                                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-700 dark:text-slate-600'
                                  : 'bg-green-500 text-white hover:bg-green-600 hover:shadow-lg transform hover:-translate-y-0.5'
                              }`}
                              title={!quiz.is_published && !hasQuestions ? 'Add questions before publishing' : ''}
                            >
                              <span>{quiz.is_published ? '📤' : '📣'}</span>
                              <span>{quiz.is_published ? 'Unpublish' : 'Publish'}</span>
                            </button>
                            
                            <button 
                              onClick={() => {
                                setEditingItem(quiz);
                                setShowQuestionBuilder(true);
                              }}
                              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all duration-200 font-medium text-sm flex items-center space-x-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                            >
                              <span>➕</span>
                              <span>Add Questions</span>
                            </button>
                          </div>
                          
                          <button 
                            onClick={() => handleDeleteQuiz(quiz.id)}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 font-medium text-sm flex items-center space-x-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                          >
                            <span>🗑️</span>
                            <span>Delete</span>
                          </button>
                        </div>

                        {/* Analytics Preview (for published quizzes) */}
                        {quiz.is_published && (
                          <div className="p-5 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900/50 dark:to-blue-900/20 border-t-2 border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between mb-3">
                              <h5 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                                <span>📊</span>
                                <span>Performance Analytics</span>
                              </h5>
                              <span className="text-xs text-slate-500 dark:text-slate-400">Live Data</span>
                            </div>
                            <div className="grid grid-cols-4 gap-4">
                              <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                                <div className="text-xs text-slate-600 dark:text-slate-400 mb-1 flex items-center space-x-1">
                                  <span>📝</span>
                                  <span>Attempts</span>
                                </div>
                                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">0</div>
                                <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">Total submissions</div>
                              </div>
                              
                              <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                                <div className="text-xs text-slate-600 dark:text-slate-400 mb-1 flex items-center space-x-1">
                                  <span>📈</span>
                                  <span>Avg Score</span>
                                </div>
                                <div className="text-2xl font-bold text-green-600 dark:text-green-400">--</div>
                                <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">Out of {totalPoints}</div>
                              </div>
                              
                              <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                                <div className="text-xs text-slate-600 dark:text-slate-400 mb-1 flex items-center space-x-1">
                                  <span>✅</span>
                                  <span>Pass Rate</span>
                                </div>
                                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">0%</div>
                                <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">70% to pass</div>
                              </div>
                              
                              <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                                <div className="text-xs text-slate-600 dark:text-slate-400 mb-1 flex items-center space-x-1">
                                  <span>⏱️</span>
                                  <span>Avg Time</span>
                                </div>
                                <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">--</div>
                                <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">Minutes</div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Help Tip for Empty Quizzes */}
                        {!hasQuestions && !quiz.is_published && (
                          <div className="p-4 bg-orange-50 dark:bg-orange-900/10 border-t-2 border-orange-200 dark:border-orange-800">
                            <div className="flex items-start space-x-3">
                              <span className="text-2xl">💡</span>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-orange-900 dark:text-orange-200">
                                  Ready to build your quiz?
                                </p>
                                <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                                  Click "Add Questions" or "Edit Quiz" to start building your quiz. You need at least one question before publishing.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="text-center py-20">
                <div className="inline-block p-6 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-full mb-6">
                  <div className="text-7xl">❓</div>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">No quizzes yet</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
                  Create your first quiz to assess student learning and track their progress effectively.
                </p>
                <button
                  onClick={() => {
                    setShowForm(true);
                    setEditingItem(null);
                    setActiveTab('quiz');
                  }}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium flex items-center space-x-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 mx-auto"
                >
                  <span>➕</span>
                  <span>Create Your First Quiz</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI Assessment Generation Modal */}
      <AIAssessmentModal
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
        onGenerate={handleAIGenerate}
        assessmentType={activeTab === 'quizzes' ? 'quiz' : activeTab === 'assignments' ? 'assignment' : 'project'}
        contentType={aiContentType}
        setContentType={setAIContentType}
        modules={modules}
        selectedModuleId={selectedModuleId}
        setSelectedModuleId={setSelectedModuleId}
        lessons={lessons}
        selectedLessonId={selectedLessonId}
        setSelectedLessonId={setSelectedLessonId}
        numQuestions={aiNumQuestions}
        setNumQuestions={setAINumQuestions}
        difficulty={aiDifficulty}
        setDifficulty={setAIDifficulty}
        assignmentType={aiAssignmentType}
        setAssignmentType={setAIAssignmentType}
        isGenerating={aiGenerating}
      />
    </div>
  );
};

export default AssessmentManagement;