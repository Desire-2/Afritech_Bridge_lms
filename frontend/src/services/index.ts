// Export all services for easy importing
export { AuthService } from './auth.service';
export { CourseService, ModuleService, LessonService, QuizService, QuestionService, AnnouncementService } from './course.service';
export { OpportunityService } from './opportunity.service';
export { QuizProgressService } from './quiz-progress.service';
export { AdminService } from './admin.service';
export { StudentService } from './student.service';

// Re-export commonly used types
export type {
  User,
  Course,
  Module,
  Lesson,
  Quiz,
  Question,
  Answer,
  Enrollment,
  Submission,
  Opportunity,
  Announcement,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  ApiError,
} from '@/types/api';