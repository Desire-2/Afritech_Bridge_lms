/**
 * Admin Analytics API Service
 * Provides methods to fetch comprehensive analytics data for the admin dashboard.
 */

import BaseApiService from './base.service';

// ═══════════ Response Interfaces ═══════════

export interface KpiData {
  total_users: number;
  active_users: number;
  total_enrollments: number;
  total_courses: number;
  published_courses: number;
  completion_rate: number;
  period_new_users: number;
  period_new_enrollments: number;
  user_change_pct: number;
  enrollment_change_pct: number;
}

export interface UserGrowthPoint {
  month: string;
  users: number;
  active: number;
  new: number;
}

export interface EnrollmentTrendPoint {
  month: string;
  enrollments: number;
  completions: number;
}

export interface CoursePopularityItem {
  id: number;
  title: string;
  enrollments: number;
  is_published: boolean;
  enrollment_type: string;
  price: number | null;
  currency: string;
  completion_rate: number;
  completed: number;
}

export interface CompletionRateItem {
  name: string;
  value: number;
  color: string;
}

export interface UserDemographicItem {
  name: string;
  value: number;
  color: string;
}

export interface EngagementMetricPoint {
  week: string;
  week_label: string;
  lessons_completed: number;
  active_students: number;
  retention_rate: number;
}

export interface RecentActivityItem {
  type: 'user_registration' | 'enrollment' | 'course_completion';
  description: string;
  timestamp: string | null;
  user: string;
  role?: string;
  course?: string;
}

export interface PaymentStats {
  paid_courses: number;
  free_courses: number;
  pending_payments: number;
  completed_payments: number;
  waived_payments: number;
}

export interface CourseStatusData {
  published: number;
  draft: number;
  paid: number;
  free: number;
}

export interface TopStudentItem {
  id: number;
  username: string;
  name: string;
  lessons_completed: number;
}

export interface AnalyticsDashboardData {
  success: boolean;
  period: string;
  generated_at: string;
  kpi: KpiData;
  user_growth: UserGrowthPoint[];
  enrollment_trends: EnrollmentTrendPoint[];
  course_popularity: CoursePopularityItem[];
  completion_rates: CompletionRateItem[];
  user_demographics: UserDemographicItem[];
  engagement_metrics: EngagementMetricPoint[];
  recent_activity: RecentActivityItem[];
  payment_stats: PaymentStats;
  course_status: CourseStatusData;
  top_active_students: TopStudentItem[];
}

export type AnalyticsPeriod = '7days' | '30days' | '90days' | '1year' | 'all';
export type ExportType = 'users' | 'enrollments' | 'courses';

// ═══════════ Service Class ═══════════

class AdminAnalyticsService extends BaseApiService {
  /**
   * Fetch the comprehensive analytics dashboard data.
   */
  async getDashboard(period: AnalyticsPeriod = '30days'): Promise<AnalyticsDashboardData> {
    return this.get<AnalyticsDashboardData>(`/admin/analytics/dashboard?period=${period}`);
  }

  /**
   * Export analytics data as CSV.
   * Returns a Blob for download.
   */
  async exportCsv(type: ExportType = 'enrollments', period: AnalyticsPeriod = '30days'): Promise<Blob> {
    const response = await this.api.get(`/admin/analytics/export?type=${type}&period=${period}`, {
      responseType: 'blob',
    });
    return response.data;
  }

  /**
   * Get system stats (existing lightweight endpoint).
   */
  async getSystemStats(): Promise<Record<string, unknown>> {
    return this.get<Record<string, unknown>>('/admin/stats');
  }

  /**
   * Get enrollment breakdown (existing endpoint).
   */
  async getEnrollmentBreakdown(): Promise<Record<string, unknown>> {
    return this.get<Record<string, unknown>>('/admin/analytics/enrollment-breakdown');
  }

  /**
   * Get course analytics (existing endpoint).
   */
  async getCourseAnalytics(): Promise<Record<string, unknown>> {
    return this.get<Record<string, unknown>>('/admin/analytics/courses');
  }
}

const adminAnalyticsService = new AdminAnalyticsService();
export default adminAnalyticsService;
