/**
 * Unified API Services Export
 * Import all API services from this single file
 */

export { default as BaseApiService } from './base.service';
export { default as CourseApiService } from './course.service';
export { default as ProgressApiService } from './progress.service';
export { default as AssessmentApiService } from './assessment.service';
export { default as InteractiveLearningApiService } from './interactive.service';
export { default as PaymentApiService } from './payment.service';

// Re-export types
export * from './types';
export type { ApiResponse, PaginatedResponse } from './base.service';

/**
 * Usage Examples:
 * 
 * import { CourseApiService, ProgressApiService } from '@/services/api';
 * 
 * // Get enrolled courses
 * const courses = await CourseApiService.getEnrolledCourses();
 * 
 * // Get progress overview
 * const progress = await ProgressApiService.getProgressOverview();
 * 
 * // Submit quiz
 * const result = await AssessmentApiService.submitQuiz(attemptId, answers);
 */
