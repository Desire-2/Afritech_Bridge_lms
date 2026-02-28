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
export { default as AchievementApiService } from '../achievementApi';
export { default as WaitlistApiService } from './waitlist.service';
export { default as AdminAnalyticsService } from './admin-analytics.service';

// Re-export types
export * from './types';
export type { ApiResponse, PaginatedResponse } from './base.service';
export type {
  AnalyticsDashboardData,
  AnalyticsPeriod,
  ExportType,
  KpiData,
  UserGrowthPoint,
  EnrollmentTrendPoint,
  CoursePopularityItem,
  CompletionRateItem,
  UserDemographicItem,
  EngagementMetricPoint,
  RecentActivityItem,
  PaymentStats,
  CourseStatusData,
  TopStudentItem,
} from './admin-analytics.service';

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
