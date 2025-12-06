/**
 * Content Assignment API Service
 * Handles quiz, assignment, and project management for modules and lessons
 */

import BaseApiService from './api/base.service';

export interface ContentQuiz {
  id: number;
  title: string;
  description: string;
  course_id: number;
  module_id?: number;
  lesson_id?: number;
  is_published: boolean;
  created_at: string;
  questions?: QuizQuestion[];
  
  // Enhanced fields from backend - student attempt data
  quiz_id?: number;
  quiz_title?: string;
  passing_score?: number;
  current_score?: number;
  best_score?: number;
  last_attempted?: string;
  time_limit?: number;
  max_attempts?: number;
  points_possible?: number;
  shuffle_questions?: boolean;
  shuffle_answers?: boolean;
  show_correct_answers?: boolean;
}

export interface QuizQuestion {
  id: number;
  quiz_id: number;
  text: string;
  question_text?: string;  // Alias for compatibility
  question?: string;  // Alias for backward compatibility
  question_type: string;
  order: number;
  order_index?: number;  // Alias for compatibility
  points?: number;
  explanation?: string;
  answers?: QuizAnswer[];
}

export interface QuizAnswer {
  id: number;
  question_id: number;
  text: string;
  answer_text?: string;  // Alias for compatibility
  is_correct?: boolean;  // May not be sent to students before submission
  order?: number;
}

export interface ContentAssignment {
  id: number;
  title: string;
  description: string;
  instructions: string;
  course_id: number;
  module_id?: number;
  lesson_id?: number;
  instructor_id: number;
  assignment_type: string;
  max_file_size_mb: number;
  allowed_file_types: string;
  due_date?: string;
  points_possible: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  submission_status?: {
    submitted: boolean;
    status: 'not_submitted' | 'submitted' | 'graded' | 'late';
    grade?: number;
    feedback?: string;
    submitted_at?: string;
    graded_at?: string;
    grader_name?: string;
  };
}

export interface ContentProject {
  id: number;
  title: string;
  description: string;
  objectives: string;
  course_id: number;
  module_ids: number[];
  due_date: string;
  points_possible: number;
  is_published: boolean;
  submission_format: string;
  max_file_size_mb: number;
  allowed_file_types: string;
  collaboration_allowed: boolean;
  max_team_size: number;
  created_at: string;
  updated_at: string;
}

export interface ModuleContent {
  id: number;
  title: string;
  description: string;
  course_id: number;
  order: number;
  is_published: boolean;
  lessons: LessonContent[];
  quizzes: ContentQuiz[];
  assignments: ContentAssignment[];
}

export interface LessonContent {
  id: number;
  title: string;
  content_type: string;
  content_data: string;
  description: string;
  module_id: number;
  order: number;
  duration_minutes?: number;
  is_published: boolean;
  quiz?: ContentQuiz;
  assignments: ContentAssignment[];
}

export interface CourseContentOverview {
  course: {
    id: number;
    title: string;
    description: string;
    instructor_id: number;
    is_published: boolean;
  };
  modules: ModuleContent[];
  projects: ContentProject[];
}

export interface StudentContentProgress {
  lessons: Array<{
    lesson: LessonContent;
    completed: boolean;
    completion_date?: string;
  }>;
  quizzes: Array<{
    quiz: ContentQuiz;
    completed: boolean;
    score?: number;
    completion_date?: string;
  }>;
  assignments: Array<{
    assignment: ContentAssignment;
    submitted: boolean;
    score?: number;
    submission_date?: string;
  }>;
  projects: Array<{
    project: ContentProject;
    submitted: boolean;
    score?: number;
    submission_date?: string;
  }>;
  overall_stats: {
    total_lessons: number;
    completed_lessons: number;
    total_quizzes: number;
    completed_quizzes: number;
    total_assignments: number;
    completed_assignments: number;
    total_projects: number;
    completed_projects: number;
  };
}

class ContentAssignmentService extends BaseApiService {
  // ==================== QUIZ MANAGEMENT ====================

  /**
   * Create a new quiz
   */
  async createQuiz(data: {
    title: string;
    description?: string;
    course_id: number;
    module_id?: number;
    lesson_id?: number;
    is_published?: boolean;
  }): Promise<{ message: string; quiz: ContentQuiz }> {
    return this.post('/content-assignment/quizzes', data);
  }

  /**
   * Assign quiz to module/lesson
   */
  async assignQuiz(quizId: number, data: {
    module_id?: number;
    lesson_id?: number;
  }): Promise<{ message: string; quiz: ContentQuiz }> {
    return this.put(`/content-assignment/quizzes/${quizId}/assign`, data);
  }

  /**
   * Get quizzes for a module
   */
  async getModuleQuizzes(moduleId: number): Promise<{
    module: ModuleContent;
    quizzes: ContentQuiz[];
  }> {
    return this.get(`/content-assignment/modules/${moduleId}/quizzes`);
  }

  /**
   * Get quiz for a lesson
   */
  async getLessonQuiz(lessonId: number): Promise<{
    lesson: LessonContent;
    quiz: ContentQuiz | null;
    quizzes?: ContentQuiz[];
  }> {
    return this.get(`/content-assignment/lessons/${lessonId}/quiz`);
  }

  /**
   * Get quiz details with questions (for students)
   */
  async getQuizDetails(quizId: number): Promise<ContentQuiz> {
    return this.get(`/student/quizzes/${quizId}`);
  }

  /**
   * Submit quiz answers
   */
  async submitQuiz(quizId: number, answers: Record<number, string>): Promise<{
    message: string;
    score: number;
    passed: boolean;
    attempt_number: number;
    remaining_attempts: number;
  }> {
    return this.post(`/student/quizzes/${quizId}/submit`, { answers });
  }

  // ==================== ASSIGNMENT MANAGEMENT ====================

  /**
   * Create a new assignment
   */
  async createAssignment(data: {
    title: string;
    description: string;
    instructions?: string;
    course_id: number;
    module_id?: number;
    lesson_id?: number;
    assignment_type?: string;
    max_file_size_mb?: number;
    allowed_file_types?: string;
    due_date?: string;
    points_possible?: number;
    is_published?: boolean;
  }): Promise<{ message: string; assignment: ContentAssignment }> {
    return this.post('/content-assignment/assignments', data);
  }

  /**
   * Assign assignment to module/lesson
   */
  async assignAssignment(assignmentId: number, data: {
    module_id?: number;
    lesson_id?: number;
  }): Promise<{ message: string; assignment: ContentAssignment }> {
    return this.put(`/content-assignment/assignments/${assignmentId}/assign`, data);
  }

  /**
   * Get assignments for a module
   */
  async getModuleAssignments(moduleId: number): Promise<{
    module: ModuleContent;
    assignments: ContentAssignment[];
  }> {
    return this.get(`/content-assignment/modules/${moduleId}/assignments`);
  }

  /**
   * Get assignments for a lesson
   */
  async getLessonAssignments(lessonId: number): Promise<{
    lesson: LessonContent;
    assignments: ContentAssignment[];
  }> {
    return this.get(`/content-assignment/lessons/${lessonId}/assignments`);
  }

  /**
   * Get assignment details (for students)
   */
  async getAssignmentDetails(assignmentId: number): Promise<ContentAssignment> {
    return this.get(`/student/assignments/${assignmentId}/details`);
  }

  /**
   * Submit assignment
   */
  async submitAssignment(assignmentId: number, data: {
    content?: string;
    file_url?: string;
    external_url?: string;
  }): Promise<{
    message: string;
    submission: any;
  }> {
    return this.post(`/student/assignments/${assignmentId}/submit`, data);
  }

  /**
   * Get complete lesson content (quiz and assignments)
   */
  async getLessonContent(lessonId: number): Promise<{
    content: LessonContent | null;
    quiz: ContentQuiz | null;
    assignments: ContentAssignment[];
  }> {
    try {
      // Fetch quiz and assignments in parallel
      const [quizResponse, assignmentsResponse] = await Promise.all([
        this.getLessonQuiz(lessonId).catch(err => {
          console.warn('Failed to load lesson quiz:', err);
          return { lesson: null, quiz: null };
        }),
        this.getLessonAssignments(lessonId).catch(err => {
          console.warn('Failed to load lesson assignments:', err);
          return { lesson: null, assignments: [] };
        })
      ]);

      return {
        content: quizResponse.lesson || assignmentsResponse.lesson || null,
        quiz: quizResponse.quiz || null,
        assignments: assignmentsResponse.assignments || []
      };
    } catch (error) {
      console.error('Error loading lesson content:', error);
      return {
        content: null,
        quiz: null,
        assignments: []
      };
    }
  }

  // ==================== PROJECT MANAGEMENT ====================

  /**
   * Create a new project
   */
  async createProject(data: {
    title: string;
    description: string;
    objectives?: string;
    course_id: number;
    module_ids?: number[];
    due_date: string;
    points_possible?: number;
    is_published?: boolean;
    submission_format?: string;
    max_file_size_mb?: number;
    allowed_file_types?: string;
    collaboration_allowed?: boolean;
    max_team_size?: number;
  }): Promise<{ message: string; project: ContentProject }> {
    return this.post('/content-assignment/projects', data);
  }

  /**
   * Assign project to modules
   */
  async assignProjectModules(projectId: number, data: {
    module_ids: number[];
  }): Promise<{ message: string; project: ContentProject }> {
    return this.put(`/content-assignment/projects/${projectId}/assign-modules`, data);
  }

  /**
   * Get projects for a course
   */
  async getCourseProjects(courseId: number): Promise<{
    course: any;
    projects: ContentProject[];
  }> {
    return this.get(`/content-assignment/courses/${courseId}/projects`);
  }

  // ==================== COMPREHENSIVE OVERVIEW ====================

  /**
   * Get complete content overview for a course
   */
  async getCourseContentOverview(courseId: number): Promise<CourseContentOverview> {
    return this.get(`/content-assignment/courses/${courseId}/content-overview`);
  }

  /**
   * Get student's progress on all content types
   */
  async getStudentContentProgress(studentId: number, courseId: number): Promise<StudentContentProgress> {
    return this.get(`/content-assignment/students/${studentId}/course/${courseId}/content-progress`);
  }

  // ==================== HELPER METHODS ====================

  /**
   * Validate assignment data
   */
  validateAssignmentData(data: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.title || data.title.trim().length === 0) {
      errors.push('Title is required');
    }

    if (!data.description || data.description.trim().length === 0) {
      errors.push('Description is required');
    }

    if (!data.course_id) {
      errors.push('Course ID is required');
    }

    if (data.due_date) {
      const dueDate = new Date(data.due_date);
      if (isNaN(dueDate.getTime())) {
        errors.push('Invalid due date format');
      } else if (dueDate < new Date()) {
        errors.push('Due date cannot be in the past');
      }
    }

    if (data.points_possible && (data.points_possible < 0 || data.points_possible > 1000)) {
      errors.push('Points possible must be between 0 and 1000');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Format due date for display
   */
  formatDueDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Calculate content completion percentage
   */
  calculateCompletionPercentage(progress: StudentContentProgress): number {
    const { overall_stats } = progress;
    const totalItems = overall_stats.total_lessons + overall_stats.total_quizzes + 
                      overall_stats.total_assignments + overall_stats.total_projects;
    const completedItems = overall_stats.completed_lessons + overall_stats.completed_quizzes + 
                          overall_stats.completed_assignments + overall_stats.completed_projects;
    
    return totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  }

  /**
   * Get content type icon
   */
  getContentTypeIcon(type: string): string {
    const icons: { [key: string]: string } = {
      'quiz': '📝',
      'assignment': '📋',
      'project': '🚀',
      'lesson': '📖',
      'video': '🎥',
      'text': '📄',
      'mixed': '📚'
    };
    
    return icons[type] || '📄';
  }

  /**
   * Generate content summary
   */
  generateContentSummary(overview: CourseContentOverview): {
    totalLessons: number;
    totalQuizzes: number;
    totalAssignments: number;
    totalProjects: number;
    moduleBreakdown: Array<{
      moduleId: number;
      moduleName: string;
      lessonCount: number;
      quizCount: number;
      assignmentCount: number;
    }>;
  } {
    let totalLessons = 0;
    let totalQuizzes = 0;
    let totalAssignments = 0;
    const moduleBreakdown: any[] = [];

    overview.modules.forEach(module => {
      totalLessons += module.lessons.length;
      totalQuizzes += module.quizzes.length;
      totalAssignments += module.assignments.length;

      // Count lesson-specific content
      module.lessons.forEach(lesson => {
        if (lesson.quiz) totalQuizzes++;
        totalAssignments += lesson.assignments.length;
      });

      moduleBreakdown.push({
        moduleId: module.id,
        moduleName: module.title,
        lessonCount: module.lessons.length,
        quizCount: module.quizzes.length + module.lessons.filter(l => l.quiz).length,
        assignmentCount: module.assignments.length + 
                        module.lessons.reduce((sum, l) => sum + l.assignments.length, 0)
      });
    });

    return {
      totalLessons,
      totalQuizzes,
      totalAssignments,
      totalProjects: overview.projects.length,
      moduleBreakdown
    };
  }
}

export default new ContentAssignmentService();