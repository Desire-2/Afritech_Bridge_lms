import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.status, error.response?.data);
    
    if (error.response?.status === 401 || error.response?.status === 422) {
      // Token expired or invalid
      localStorage.removeItem('token');
      console.log('Token expired, redirecting to login...');
      window.location.href = '/auth/login';
    }
    return Promise.reject(error);
  }
);

export interface DashboardData {
  student_info: {
    id: number;
    name: string;
    email: string;
    profile_picture: string | null;
    member_since: string;
  };
  overview: {
    total_courses: number;
    completed_courses: number;
    certificates_earned: number;
    badges_earned: number;
    total_learning_hours: number;
    learning_streak: number;
    current_level: {
      current_level: string;
      current_points: number;
      next_level_points: number;
      progress_to_next: number;
    };
  };
  my_learning: {
    active_courses: any[];
    continue_where_left: any | null;
    next_deadline: any | null;
  };
  my_progress: {
    overall_gpa: number;
    total_certificates: number;
    total_badges: number;
    learning_hours: number;
    recent_avg_score: number;
    skill_progress: {
      categories: Record<string, any>;
      total_skills: number;
      recent_skills: any[];
    };
  };
  recent_activity: any[];
  achievements: {
    recent_certificates: any[];
    recent_badges: any[];
    achievements_count: {
      certificates: number;
      badges: number;
    };
  };
  upcoming_tasks: any[];
  performance_insights: {
    performance_trend: string;
    strong_areas: string[];
    improvement_areas: string[];
    study_recommendation: string;
  };
  learning_recommendations: Array<{
    type: string;
    title: string;
    description: string;
    action: string;
  }>;
}

export interface Course {
  id: number;
  title: string;
  description: string;
  instructor_name: string;
  enrollment_type: 'free' | 'paid' | 'scholarship';
  enrollment_status?: string; // Backend field for enrollment status
  price?: number;
  duration_weeks?: number;
  estimated_duration?: string; // Backend uses this field name
  level?: string;
  difficulty_level?: string; // Backend uses this field name
  category?: string;
  rating?: number; // Optional since backend doesn't always provide it
  student_count?: number; // Optional since backend doesn't always provide it
  thumbnail_url?: string;
  skills?: string[];
  is_enrolled?: boolean;
  has_applied?: boolean;
  // Additional backend fields
  learning_objectives?: string;
  target_audience?: string;
  instructor_id?: number;
  currency?: string;
  scholarship_available?: boolean;
  max_scholarship_spots?: number;
  current_scholarship_spots?: number;
  prerequisites?: any[];
  strict_progression?: boolean;
  passing_score?: number;
  max_attempts_per_module?: number;
  created_at?: string;
  updated_at?: string;
  is_published?: boolean;
  enrolled_at?: string;
}

export interface Quiz {
  id: number;
  title: string;
  description: string;
  time_limit_minutes: number;
  max_attempts: number;
  passing_score: number;
  questions: QuizQuestion[];
}

export interface QuizQuestion {
  id: number;
  question_text: string;
  question_type: 'multiple_choice' | 'true_false' | 'short_answer';
  options?: string[];
  correct_answer?: string;
  points: number;
}

export interface Assessment {
  id: number;
  title: string;
  description: string;
  type: 'quiz' | 'assignment' | 'project';
  due_date?: string;
  max_score: number;
  status: 'not_started' | 'in_progress' | 'submitted' | 'graded';
  attempts?: AssessmentAttempt[];
}

export interface AssessmentAttempt {
  id: number;
  attempt_number: number;
  score: number;
  max_score: number;
  submitted_at: string;
  time_taken_minutes: number;
  feedback?: string;
}

export interface Certificate {
  id: number;
  course_id?: number;
  course_title: string;
  student_name: string;
  issued_date?: string;
  issued_at?: string;
  certificate_number: string;
  verification_url?: string;
  verification_hash?: string;
  skills_demonstrated?: string[];
  skills_acquired?: string[];
  overall_score?: number;
  grade?: string;
  is_active?: boolean;
  completion_status?: string;
  completion_percentage?: number;
  is_locked?: boolean;
  course_completed?: boolean;
}

export interface SkillBadge {
  id: number;
  name: string;
  description: string;
  icon_url: string;
  earned_date?: string;
  verification_code?: string;
}

export interface ProgressAnalytics {
  overall_progress: number;
  courses: Array<{
    course_id: number;
    course_title: string;
    progress_percentage: number;
    modules_completed: number;
    total_modules: number;
    time_spent_minutes: number;
    average_score: number;
  }>;
  learning_trends: {
    daily_activity: Array<{ date: string; minutes: number }>;
    weekly_progress: Array<{ week: string; percentage: number }>;
    score_trends: Array<{ assessment: string; score: number; date: string }>;
  };
  performance_insights: {
    strong_areas: string[];
    weak_areas: string[];
    recommendations: string[];
    streak_count: number;
  };
}

export interface ModuleProgress {
  id: number;
  student_id: number;
  module_id: number;
  enrollment_id: number;
  module_score?: number;  // Average of all lesson scores (0-100)
  course_contribution_score: number;
  lessons_average_score?: number;  // Backwards compatibility
  quiz_score: number;
  assignment_score: number;
  final_assessment_score: number;
  weighted_score?: number;  // Weighted score for passing (0-100), uses dynamic weights
  cumulative_score: number;  // Backwards compatibility (same as weighted_score)
  attempts_count: number;
  max_attempts: number;
  status: 'locked' | 'unlocked' | 'in_progress' | 'completed' | 'failed';
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  unlocked_at: string | null;
  prerequisites_met: boolean;
  module_title: string;
}

export interface ModuleData {
  module: {
    id: number;
    title: string;
    description: string;
    learning_objectives: string;
    course_id: number;
    order: number;
    is_published: boolean;
    created_at: string;
    updated_at: string;
    lessons?: any[];
  };
  progress: ModuleProgress;
  assessment_attempts: AssessmentAttempt[];
  can_retake: boolean;
}

export interface SuspensionStatus {
  is_suspended: boolean;
  suspension_details: {
    id: number;
    student_id: number;
    course_id: number;
    enrollment_id: number;
    suspended_at: string;
    reason: string;
    failed_module_id: number;
    total_attempts_made: number;
    can_appeal: boolean;
    appeal_deadline: string | null;
    appeal_submitted: boolean;
    appeal_text: string | null;
    appeal_submitted_at: string | null;
    review_status: 'pending' | 'approved' | 'denied';
    reviewed_by: number | null;
    reviewed_at: string | null;
    review_notes: string | null;
    reinstated: boolean;
    reinstated_at: string | null;
    additional_attempts_granted: number;
    can_submit_appeal: boolean;
    course_title: string;
    failed_module_title: string;
    student_name: string;
  } | null;
}

// Student API Service
export class StudentApiService {
  // Dashboard APIs
  static async getDashboard(): Promise<DashboardData> {
    const response = await api.get('/student/dashboard/');
    return response.data.data; // Extract the data from the wrapper
  }

  static async getDashboardAnalytics(): Promise<any> {
    const response = await api.get('/student/dashboard/analytics');
    return response.data;
  }

  static async getRecommendations(): Promise<any> {
    const response = await api.get('/student/dashboard/recommendations');
    return response.data;
  }

  // Learning APIs
  static async getActiveCourses(): Promise<any> {
    const response = await api.get('/student/learning/courses/active');
    return response.data;
  }

  static async getCompletedCourses(): Promise<any> {
    const response = await api.get('/student/learning/courses/completed');
    return response.data;
  }

  static async getEnrolledCourses(): Promise<any> {
    try {
      // Get both active and completed courses
      const [activeResponse, completedResponse] = await Promise.all([
        api.get('/student/learning/courses/active'),
        api.get('/student/learning/courses/completed')
      ]);
      
      const activeCourses = activeResponse.data.courses || [];
      const completedCourses = completedResponse.data.courses || [];
      
      // Combine and format the courses
      const allCourses = [
        ...activeCourses.map((course: any) => ({
          ...course,
          progress: course.progress || 0,
          last_accessed: course.last_accessed || new Date().toISOString(),
          total_lessons: course.total_lessons || 0,
          completed_lessons: course.completed_lessons || 0,
          estimated_duration: course.estimated_duration || '0h 0m',
          difficulty: course.difficulty || 'beginner',
          rating: course.rating || 4.0,
          enrollment_count: course.enrollment_count || 0
        })),
        ...completedCourses.map((course: any) => ({
          ...course,
          progress: 100,
          last_accessed: course.completed_at || course.last_accessed || new Date().toISOString(),
          total_lessons: course.total_lessons || 0,
          completed_lessons: course.total_lessons || 0,
          estimated_duration: course.estimated_duration || '0h 0m',
          difficulty: course.difficulty || 'beginner',
          rating: course.rating || 4.0,
          enrollment_count: course.enrollment_count || 0
        }))
      ];
      
      return { courses: allCourses };
    } catch (error) {
      console.error('Failed to fetch enrolled courses:', error);
      return { courses: [] };
    }
  }

  static async getCourseDetails(courseId: number): Promise<any> {
    const response = await api.get(`/student/learning/courses/${courseId}`);
    return response.data;
  }

  static async completeLesson(lessonId: number, data: any): Promise<any> {
    const response = await api.post(`/student/lessons/${lessonId}/complete`, data);
    return response.data;
  }

  static async updateLessonProgress(lessonId: number, progressData: {
    reading_progress?: number;
    engagement_score?: number;
    scroll_progress?: number;
    time_spent?: number;
    auto_saved?: boolean;
  }): Promise<any> {
    const response = await api.post(`/student/lessons/${lessonId}/progress`, progressData);
    return response.data;
  }

  static async getLessonProgress(lessonId: number): Promise<any> {
    const response = await api.get(`/student/lessons/${lessonId}/progress`);
    return response.data;
  }

  // Module progression APIs
  static async getCourseModules(courseId: number): Promise<any> {
    const response = await api.get(`/student/learning/course/${courseId}/modules`);
    return response.data;
  }

  static async retakeModule(moduleId: number): Promise<any> {
    const response = await api.post(`/student/learning/module/${moduleId}/retake`);
    return response.data;
  }

  static async checkModuleCompletion(moduleId: number): Promise<any> {
    const response = await api.post(`/student/learning/module/${moduleId}/check-completion`);
    return response.data;
  }

  static async getSuspensionStatus(courseId: number): Promise<any> {
    const response = await api.get(`/student/learning/course/${courseId}/suspension-status`);
    return response.data;
  }

  static async submitSuspensionAppeal(courseId: number, appealText: string): Promise<any> {
    const response = await api.post(`/student/learning/course/${courseId}/submit-appeal`, {
      appeal_text: appealText
    });
    return response.data;
  }

  // Enrollment APIs
  static async getBrowseCourses(filters?: any): Promise<Course[]> {
    const response = await api.get('/student/enrollment/browse-courses', { params: filters });
    return response.data.data.courses;
  }

  static async getCourseEnrollmentDetails(courseId: number): Promise<Course> {
    const response = await api.get(`/student/courses/${courseId}`);
    return response.data;
  }

  static async getEnrollmentStatus(courseId: number): Promise<any> {
    const response = await api.get(`/student/enrollment/course/${courseId}/status`);
    return response.data;
  }

  static async applyCourse(courseId: number, applicationData: any): Promise<any> {
    const response = await api.post(`/student/enrollment/courses/${courseId}/apply`, applicationData);
    return response.data;
  }

  static async enrollCourse(courseId: number, paymentData?: any): Promise<any> {
    const response = await api.post('/student/enrollment/enroll', { 
      course_id: courseId,
      ...paymentData 
    });
    return response.data;
  }

  static async getMyApplications(): Promise<any> {
    const response = await api.get('/student/enrollment/applications');
    return response.data;
  }

  // Progress APIs
  static async getProgress(): Promise<ProgressAnalytics> {
    const response = await api.get('/student/progress');
    return response.data;
  }

  static async getCourseProgress(courseId: number): Promise<{
    lessons_completed: number;
    total_lessons: number;
    completed_quizzes: number;
    total_quizzes: number;
    completed_assignments: number;
    total_assignments: number;
    overall_score: number;
  }> {
    const response = await api.get(`/student/courses/${courseId}/detailed-progress`);
    return response.data;
  }

  static async getProgressAnalytics(): Promise<any> {
    const response = await api.get('/student/progress/analytics');
    return response.data;
  }

  // Assessment APIs
  static async getQuizAttempts(quizId: number): Promise<AssessmentAttempt[]> {
    const response = await api.get(`/student/assessment/quizzes/${quizId}/attempts`);
    return response.data.attempts;
  }

  static async startQuizAttempt(quizId: number): Promise<any> {
    const response = await api.post(`/student/assessment/quizzes/${quizId}/start`);
    return response.data;
  }

  static async submitQuiz(quizId: number, attemptId: number, answers: any): Promise<any> {
    const response = await api.post(`/student/assessment/quizzes/${quizId}/submit/${attemptId}`, { answers });
    return response.data;
  }

  static async getAssignments(): Promise<Assessment[]> {
    const response = await api.get('/student/assessment/assignments');
    return response.data.assignments;
  }

  static async submitAssignment(assignmentId: number, formData: FormData): Promise<any> {
    const response = await api.post(`/student/assessment/assignments/${assignmentId}/submit`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  // Certificate APIs
  static async getCertificates(): Promise<Certificate[]> {
    try {
      // Updated endpoint to get certificates with completion status
      const response = await api.get('/student/certificate/my-certificates');
      console.log('📜 Certificates API Response:', response.data);
      
      // Handle both response formats (certificates array directly or nested in data)
      const certificates = response.data.certificates || response.data.data?.certificates || [];
      console.log(`✅ Found ${certificates.length} certificates`);
      
      return certificates;
    } catch (error: any) {
      console.error('❌ Error fetching certificates:', error.response?.data || error.message);
      throw error;
    }
  }

  static async getBadges(): Promise<SkillBadge[]> {
    const response = await api.get('/student/certificate/badges');
    return response.data.badges;
  }

  // Check for newly earned badges
  static async checkEarnedBadges(courseId: number): Promise<SkillBadge[]> {
    const response = await api.post('/student/badges/check', { course_id: courseId });
    return response.data.newBadges || [];
  }

  // Generate certificate for completed course
  static async generateCertificate(courseId: number): Promise<{ success: boolean; certificate?: any }> {
    const response = await api.post('/student/certificates/generate', { course_id: courseId });
    return response.data;
  }

  // Get course progress including quizzes and assignments
  static async getCourseProgress(courseId: number): Promise<{
    lessons_completed: number;
    total_lessons: number;
    completed_quizzes: number;
    total_quizzes: number;
    completed_assignments: number;
    total_assignments: number;
    overall_score: number;
  }> {
    const response = await api.get(`/student/courses/${courseId}/detailed-progress`);
    return response.data;
  }

  // Get module progress with scores
  static async getModuleProgress(moduleId: number): Promise<ModuleProgress> {
    const response = await api.get(`/student/modules/${moduleId}/progress`);
    return response.data;
  }

  static async checkCertificateEligibility(courseId: number): Promise<any> {
    const response = await api.get(`/student/certificate/courses/${courseId}/eligibility`);
    return response.data;
  }

  static async getTranscript(): Promise<any> {
    const response = await api.get('/student/certificate/transcript');
    return response.data;
  }
}

export default api;