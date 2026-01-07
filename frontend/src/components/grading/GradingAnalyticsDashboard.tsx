# Grading Analytics Dashboard Component

"use client";

import React, { useState, useEffect } from 'react';
import { 
  ChartBarIcon,
  AcademicCapIcon,
  ClockIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  UserGroupIcon,
  DocumentTextIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter
} from 'recharts';
import EnhancedGradingService, { 
  GradingAnalytics,
  GradingPerformanceMetrics,
  GradingTrend,
  CourseGradingOverview 
} from '@/services/enhanced-grading.service';

interface GradingAnalyticsDashboardProps {
  courseId?: number;
  assignmentId?: number;
  dateRange?: {
    start_date: string;
    end_date: string;
  };
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export const GradingAnalyticsDashboard: React.FC<GradingAnalyticsDashboardProps> = ({
  courseId,
  assignmentId,
  dateRange
}) => {
  const [analytics, setAnalytics] = useState<GradingAnalytics | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<GradingPerformanceMetrics | null>(null);
  const [trends, setTrends] = useState<GradingTrend[]>([]);
  const [courseOverview, setCourseOverview] = useState<CourseGradingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<string>('grade_distribution');

  useEffect(() => {
    fetchAnalytics();
  }, [courseId, assignmentId, dateRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      const params: any = {};
      if (courseId) params.course_id = courseId;
      if (assignmentId) params.assignment_id = assignmentId;
      if (dateRange) {
        params.start_date = dateRange.start_date;
        params.end_date = dateRange.end_date;
      }

      const [analyticsData, performanceData, trendsData, overviewData] = await Promise.all([
        EnhancedGradingService.getGradingAnalytics(params),
        EnhancedGradingService.getGradingPerformance(params),
        EnhancedGradingService.getGradingTrends(params),
        courseId ? EnhancedGradingService.getCourseGradingOverview(courseId) : Promise.resolve(null)
      ]);

      setAnalytics(analyticsData);
      setPerformanceMetrics(performanceData);
      setTrends(trendsData);
      setCourseOverview(overviewData);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  const refreshAnalytics = async () => {
    setRefreshing(true);
    await fetchAnalytics();
    setRefreshing(false);
  };

  const formatGradeDistributionData = () => {
    if (!analytics?.grade_distribution) return [];
    
    return Object.entries(analytics.grade_distribution).map(([range, count]) => ({
      range,
      count,
      percentage: ((count / analytics.total_submissions) * 100).toFixed(1)
    }));
  };

  const formatSubmissionTrendData = () => {
    if (!analytics?.submission_timeline) return [];
    
    return analytics.submission_timeline.map(item => ({
      date: new Date(item.date).toLocaleDateString(),
      submissions: item.count,
      cumulative: item.cumulative_count
    }));
  };

  const formatPerformanceComparisonData = () => {
    if (!analytics?.assignment_performance) return [];
    
    return analytics.assignment_performance.map(item => ({
      assignment: item.title.substring(0, 20) + (item.title.length > 20 ? '...' : ''),
      average: item.average_grade,
      completion: item.completion_rate,
      difficulty: item.difficulty_score
    }));
  };

  const getGradingEfficiencyData = () => {
    if (!performanceMetrics) return [];
    
    return [
      {
        metric: 'Avg Time per Submission',
        value: performanceMetrics.average_grading_time,
        unit: 'minutes',
        trend: performanceMetrics.grading_time_trend
      },
      {
        metric: 'Daily Grading Capacity',
        value: performanceMetrics.daily_grading_capacity,
        unit: 'submissions',
        trend: performanceMetrics.productivity_trend
      },
      {
        metric: 'Feedback Quality Score',
        value: performanceMetrics.feedback_quality_score,
        unit: 'score',
        trend: performanceMetrics.quality_trend
      }
    ];
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-blue-600"></div>
            <span className="text-slate-600 dark:text-slate-400">Loading analytics...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
            <button
              onClick={fetchAnalytics}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Grading Analytics
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Comprehensive insights into grading performance and patterns
          </p>
        </div>
        <button
          onClick={refreshAnalytics}
          disabled={refreshing}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <ArrowPathIcon className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Key Metrics Cards */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Total Submissions
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {analytics.total_submissions.toLocaleString()}
                </p>
                <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                  {analytics.graded_submissions} graded
                </p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <DocumentTextIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Average Grade
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {analytics.average_grade?.toFixed(1) || 'N/A'}%
                </p>
                <div className="flex items-center mt-1">
                  {analytics.grade_trend === 'up' ? (
                    <TrendingUpIcon className="h-4 w-4 text-green-500 mr-1" />
                  ) : analytics.grade_trend === 'down' ? (
                    <TrendingDownIcon className="h-4 w-4 text-red-500 mr-1" />
                  ) : null}
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {analytics.grade_trend_percentage?.toFixed(1)}% vs last period
                  </p>
                </div>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <AcademicCapIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Pending Reviews
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {(analytics.total_submissions - analytics.graded_submissions).toLocaleString()}
                </p>
                <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
                  {analytics.urgent_submissions || 0} urgent
                </p>
              </div>
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <ClockIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Avg Grading Time
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {performanceMetrics?.average_grading_time?.toFixed(1) || 'N/A'}
                  <span className="text-base font-normal text-slate-600 dark:text-slate-400">min</span>
                </p>
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                  per submission
                </p>
              </div>
              <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <ChartBarIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Metric Selection Tabs */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="border-b border-slate-200 dark:border-slate-700">
          <nav className="flex space-x-8 px-6">
            {[
              { key: 'grade_distribution', label: 'Grade Distribution', icon: ChartBarIcon },
              { key: 'submission_trends', label: 'Submission Trends', icon: TrendingUpIcon },
              { key: 'performance_comparison', label: 'Assignment Performance', icon: AcademicCapIcon },
              { key: 'grading_efficiency', label: 'Grading Efficiency', icon: SparklesIcon }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSelectedMetric(tab.key)}
                className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                  selectedMetric === tab.key
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                }`}
              >
                <tab.icon className="h-4 w-4 mr-2" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Grade Distribution */}
          {selectedMetric === 'grade_distribution' && analytics && (
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Grade Distribution
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={formatGradeDistributionData()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="range" 
                        stroke="#64748b"
                        fontSize={12}
                      />
                      <YAxis 
                        stroke="#64748b"
                        fontSize={12}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          border: 'none',
                          borderRadius: '8px',
                          color: '#f1f5f9'
                        }}
                      />
                      <Bar 
                        dataKey="count" 
                        fill="#3b82f6" 
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={formatGradeDistributionData()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ range, percentage }) => `${range}: ${percentage}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {formatGradeDistributionData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Submission Trends */}
          {selectedMetric === 'submission_trends' && (
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Submission Trends
              </h3>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={formatSubmissionTrendData()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#64748b"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="#64748b"
                    fontSize={12}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#f1f5f9'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="submissions" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                    name="Daily Submissions"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="cumulative" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                    name="Cumulative"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Performance Comparison */}
          {selectedMetric === 'performance_comparison' && (
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Assignment Performance Comparison
              </h3>
              <ResponsiveContainer width="100%" height={400}>
                <ScatterChart data={formatPerformanceComparisonData()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis 
                    type="number"
                    dataKey="average" 
                    name="Average Grade"
                    domain={[0, 100]}
                    stroke="#64748b"
                    fontSize={12}
                  />
                  <YAxis 
                    type="number"
                    dataKey="completion" 
                    name="Completion Rate"
                    domain={[0, 100]}
                    stroke="#64748b"
                    fontSize={12}
                  />
                  <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#f1f5f9'
                    }}
                    formatter={(value, name, props) => [
                      `${value}${name === 'Average Grade' || name === 'Completion Rate' ? '%' : ''}`,
                      name
                    ]}
                  />
                  <Scatter 
                    name="Assignments" 
                    dataKey="completion" 
                    fill="#3b82f6"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Grading Efficiency */}
          {selectedMetric === 'grading_efficiency' && performanceMetrics && (
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Grading Efficiency Metrics
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {getGradingEfficiencyData().map((metric, index) => (
                  <div key={metric.metric} className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {metric.metric}
                      </h4>
                      {metric.trend === 'up' ? (
                        <TrendingUpIcon className="h-4 w-4 text-green-500" />
                      ) : metric.trend === 'down' ? (
                        <TrendingDownIcon className="h-4 w-4 text-red-500" />
                      ) : null}
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {typeof metric.value === 'number' ? metric.value.toFixed(1) : metric.value}
                      <span className="text-sm font-normal text-slate-600 dark:text-slate-400 ml-1">
                        {metric.unit}
                      </span>
                    </p>
                  </div>
                ))}
              </div>

              {/* Detailed Performance Breakdown */}
              <div className="mt-6 bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                  Performance Insights
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      AI-Assisted Gradings
                    </span>
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      {performanceMetrics.ai_assisted_count || 0} ({((performanceMetrics.ai_assisted_count || 0) / analytics!.graded_submissions * 100).toFixed(1)}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      Bulk Operations Used
                    </span>
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      {performanceMetrics.bulk_operations_count || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      Average Feedback Length
                    </span>
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      {performanceMetrics.average_feedback_length || 0} words
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Course Overview (if available) */}
      {courseOverview && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Course Grading Overview
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {courseOverview.total_assignments}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">Total Assignments</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {courseOverview.completion_rate.toFixed(1)}%
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">Completion Rate</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {courseOverview.average_grade.toFixed(1)}%
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">Course Average</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {courseOverview.struggling_students}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">Students Need Help</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};