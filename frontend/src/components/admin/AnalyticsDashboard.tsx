'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ComposedChart,
} from 'recharts';
import AdminSidebar from './AdminSidebar';
import AdminBreadcrumb from './AdminBreadcrumb';
import adminAnalyticsService, {
  type AnalyticsDashboardData,
  type AnalyticsPeriod,
  type ExportType,
} from '@/services/api/admin-analytics.service';

// ═══════════ Sub-components ═══════════

const SkeletonCard = () => (
  <div className="bg-white rounded-xl p-6 border border-gray-200 animate-pulse">
    <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
    <div className="h-8 bg-gray-200 rounded w-2/3 mb-2" />
    <div className="h-3 bg-gray-200 rounded w-1/3" />
  </div>
);

const SkeletonChart = ({ height = 300 }: { height?: number }) => (
  <div className="bg-white rounded-xl p-6 border border-gray-200 animate-pulse">
    <div className="h-5 bg-gray-200 rounded w-1/3 mb-4" />
    <div className="bg-gray-100 rounded" style={{ height }} />
  </div>
);

const ErrorBanner = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-center justify-between">
    <div className="flex items-center gap-3">
      <span className="text-red-500 text-xl">⚠️</span>
      <div>
        <p className="font-semibold text-red-800">Failed to load analytics</p>
        <p className="text-red-600 text-sm mt-1">{message}</p>
      </div>
    </div>
    <button
      onClick={onRetry}
      className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition"
    >
      Retry
    </button>
  </div>
);

const KpiCard = ({
  label,
  value,
  change,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  change?: number;
  icon: string;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'indigo' | 'rose';
}) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
  };
  const changeColor = change !== undefined && change >= 0 ? 'text-green-600' : 'text-red-600';
  const changeIcon = change !== undefined && change >= 0 ? '↑' : '↓';

  return (
    <div className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-lg transition-all duration-200 group">
      <div className="flex items-center justify-between mb-3">
        <span className={`text-2xl p-2 rounded-lg ${colorClasses[color]} border`}>{icon}</span>
        {change !== undefined && (
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${change >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {changeIcon} {Math.abs(change)}%
          </span>
        )}
      </div>
      <p className="text-gray-500 text-sm font-medium">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1 group-hover:text-blue-700 transition-colors">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  );
};

const ActivityItem = ({
  type,
  description,
  timestamp,
}: {
  type: string;
  description: string;
  timestamp: string | null;
}) => {
  const icons: Record<string, string> = {
    user_registration: '👤',
    enrollment: '📚',
    course_completion: '🎓',
  };
  const colors: Record<string, string> = {
    user_registration: 'bg-blue-100 text-blue-700',
    enrollment: 'bg-green-100 text-green-700',
    course_completion: 'bg-purple-100 text-purple-700',
  };

  const formatDate = (ts: string | null) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      <span className={`text-sm p-1.5 rounded-lg ${colors[type] || 'bg-gray-100'}`}>
        {icons[type] || '📋'}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 truncate">{description}</p>
        <p className="text-xs text-gray-400 mt-1">{formatDate(timestamp)}</p>
      </div>
    </div>
  );
};

// ═══════════ Custom Tooltips ═══════════

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 shadow-lg rounded-lg p-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color }} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
          {entry.name}: <span className="font-semibold">{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}</span>
        </p>
      ))}
    </div>
  );
};

// ═══════════ Main Component ═══════════

const AnalyticsDashboard = () => {
  const [data, setData] = useState<AnalyticsDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<AnalyticsPeriod>('30days');
  const [activeTab, setActiveTab] = useState('overview');
  const [exporting, setExporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (showFullLoader = true) => {
    try {
      if (showFullLoader) setLoading(true);
      else setRefreshing(true);
      setError(null);
      const result = await adminAnalyticsService.getDashboard(period);
      setData(result);
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || 'Unknown error';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => fetchData(false), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleExport = async (type: ExportType) => {
    try {
      setExporting(true);
      const blob = await adminAnalyticsService.exportCsv(type, period);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics_${type}_${period}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      alert('Failed to export data. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const breadcrumbs = [
    { label: 'Admin', href: '/admin' },
    { label: 'Analytics', href: '/admin/analytics', active: true },
  ];

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'users', label: 'Users', icon: '👥' },
    { id: 'courses', label: 'Courses', icon: '📚' },
    { id: 'engagement', label: 'Engagement', icon: '🎯' },
    { id: 'payments', label: 'Payments', icon: '💳' },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 overflow-auto">
        {/* ── Header ── */}
        <div className="bg-white border-b border-gray-200 px-6 py-5 sticky top-0 z-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <AdminBreadcrumb items={breadcrumbs} />
              <h1 className="text-2xl font-bold text-gray-900 mt-2">Analytics Dashboard</h1>
              <p className="text-gray-500 text-sm mt-1">
                Real-time insights and metrics
                {data?.generated_at && (
                  <span className="ml-2 text-xs text-gray-400">
                    Updated {new Date(data.generated_at).toLocaleTimeString()}
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Refresh */}
              <button
                onClick={() => fetchData(false)}
                disabled={refreshing}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                title="Refresh data"
              >
                <span className={`text-lg ${refreshing ? 'animate-spin inline-block' : ''}`}>🔄</span>
              </button>

              {/* Period selector */}
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as AnalyticsPeriod)}
                className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="7days">Last 7 days</option>
                <option value="30days">Last 30 days</option>
                <option value="90days">Last 90 days</option>
                <option value="1year">Last year</option>
                <option value="all">All time</option>
              </select>

              {/* Export dropdown */}
              <div className="relative group">
                <button
                  disabled={exporting || loading}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-1"
                >
                  {exporting ? '⏳' : '📥'} Export
                </button>
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 min-w-[160px]">
                  <button onClick={() => handleExport('users')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 rounded-t-lg">
                    👤 Export Users
                  </button>
                  <button onClick={() => handleExport('enrollments')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50">
                    📚 Export Enrollments
                  </button>
                  <button onClick={() => handleExport('courses')} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 rounded-b-lg">
                    🎓 Export Courses
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="p-6 space-y-6">
          {/* Error state */}
          {error && <ErrorBanner message={error} onRetry={() => fetchData()} />}

          {/* KPI Cards */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : data?.kpi ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <KpiCard label="Total Users" value={data.kpi.total_users} change={data.kpi.user_change_pct} icon="👥" color="blue" />
              <KpiCard label="Active Users" value={data.kpi.active_users} icon="🟢" color="green" />
              <KpiCard label="Total Enrollments" value={data.kpi.total_enrollments} change={data.kpi.enrollment_change_pct} icon="📚" color="purple" />
              <KpiCard label="Courses" value={`${data.kpi.published_courses} / ${data.kpi.total_courses}`} icon="🎓" color="indigo" />
              <KpiCard label="Completion Rate" value={`${data.kpi.completion_rate}%`} icon="✅" color="orange" />
              <KpiCard label="New This Period" value={data.kpi.period_new_users} icon="🆕" color="rose" />
            </div>
          ) : null}

          {/* Tab Navigation */}
          <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3 font-medium text-sm border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* ════════════ OVERVIEW TAB ════════════ */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {loading ? (
                <>
                  <SkeletonChart height={300} />
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <SkeletonChart height={250} />
                    <SkeletonChart height={250} />
                  </div>
                </>
              ) : data ? (
                <>
                  {/* User Growth + Enrollment Trends Combined */}
                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">User Growth & New Registrations</h3>
                      <span className="text-sm text-gray-400">Cumulative vs New</span>
                    </div>
                    <ResponsiveContainer width="100%" height={320}>
                      <ComposedChart data={data.user_growth}>
                        <defs>
                          <linearGradient id="gradUsers" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Area type="monotone" dataKey="users" stroke="#3b82f6" fill="url(#gradUsers)" name="Total Users" strokeWidth={2} />
                        <Line type="monotone" dataKey="active" stroke="#10b981" name="Active Users" strokeWidth={2} dot={{ r: 3 }} />
                        <Bar dataKey="new" fill="#8b5cf6" name="New Users" opacity={0.7} barSize={20} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Enrollment Trends */}
                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Enrollment Trends</h3>
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={data.enrollment_trends}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend />
                          <Bar dataKey="enrollments" fill="#3b82f6" name="New Enrollments" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="completions" fill="#10b981" name="Completions" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Completion Rates Pie */}
                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Enrollment Status Breakdown</h3>
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                          <Pie
                            data={data.completion_rates.filter(d => d.value > 0)}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={90}
                            paddingAngle={3}
                            dataKey="value"
                            label={({ name, value }) => `${name} (${value})`}
                            labelLine={{ strokeWidth: 1 }}
                          >
                            {data.completion_rates.filter(d => d.value > 0).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Recent Activity + Top Students */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
                      <div className="max-h-[340px] overflow-y-auto pr-2">
                        {data.recent_activity.length > 0 ? (
                          data.recent_activity.map((item, i) => (
                            <ActivityItem key={i} {...item} />
                          ))
                        ) : (
                          <p className="text-gray-400 text-sm text-center py-8">No recent activity</p>
                        )}
                      </div>
                    </div>

                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Active Students</h3>
                      <div className="space-y-3">
                        {data.top_active_students.length > 0 ? (
                          data.top_active_students.slice(0, 8).map((student, i) => (
                            <div key={student.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                                i === 0 ? 'bg-yellow-100 text-yellow-700' :
                                i === 1 ? 'bg-gray-100 text-gray-600' :
                                i === 2 ? 'bg-orange-100 text-orange-700' :
                                'bg-blue-50 text-blue-600'
                              }`}>
                                {i + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">{student.name}</p>
                                <p className="text-xs text-gray-400">@{student.username}</p>
                              </div>
                              <span className="text-sm font-semibold text-blue-600">{student.lessons_completed} lessons</span>
                            </div>
                          ))
                        ) : (
                          <p className="text-gray-400 text-sm text-center py-8">No data available</p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {/* ════════════ USERS TAB ════════════ */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              {loading ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <SkeletonChart height={300} />
                  <SkeletonChart height={300} />
                </div>
              ) : data ? (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* User Demographics Donut */}
                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">User Demographics</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={data.user_demographics}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={5}
                            dataKey="value"
                            label={({ name, value }) => `${name} (${value})`}
                            labelLine={{ strokeWidth: 1 }}
                          >
                            {data.user_demographics.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                      {/* Summary below */}
                      <div className="grid grid-cols-3 gap-2 mt-4">
                        {data.user_demographics.map((d) => (
                          <div key={d.name} className="text-center p-2 bg-gray-50 rounded-lg">
                            <p className="text-lg font-bold" style={{ color: d.color }}>{d.value}</p>
                            <p className="text-xs text-gray-500">{d.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* User Growth (New registrations per month) */}
                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Registrations</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={data.user_growth}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="new" fill="#8b5cf6" name="New Users" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* User Growth Over Time */}
                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Cumulative User Growth</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={data.user_growth}>
                        <defs>
                          <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gradActive" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Area type="monotone" dataKey="users" stroke="#3b82f6" fill="url(#gradTotal)" name="Total" strokeWidth={2} />
                        <Area type="monotone" dataKey="active" stroke="#10b981" fill="url(#gradActive)" name="Active" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {/* ════════════ COURSES TAB ════════════ */}
          {activeTab === 'courses' && (
            <div className="space-y-6">
              {loading ? (
                <>
                  <SkeletonChart height={300} />
                  <SkeletonChart height={200} />
                </>
              ) : data ? (
                <>
                  {/* Course Status Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl p-5 border border-gray-200">
                      <p className="text-sm text-gray-500">Published</p>
                      <p className="text-2xl font-bold text-green-600">{data.course_status.published}</p>
                    </div>
                    <div className="bg-white rounded-xl p-5 border border-gray-200">
                      <p className="text-sm text-gray-500">Draft</p>
                      <p className="text-2xl font-bold text-gray-600">{data.course_status.draft}</p>
                    </div>
                    <div className="bg-white rounded-xl p-5 border border-gray-200">
                      <p className="text-sm text-gray-500">Paid Courses</p>
                      <p className="text-2xl font-bold text-blue-600">{data.course_status.paid}</p>
                    </div>
                    <div className="bg-white rounded-xl p-5 border border-gray-200">
                      <p className="text-sm text-gray-500">Free Courses</p>
                      <p className="text-2xl font-bold text-purple-600">{data.course_status.free}</p>
                    </div>
                  </div>

                  {/* Course Popularity Chart */}
                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Course Popularity by Enrollments</h3>
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={data.course_popularity} layout="vertical" margin={{ left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis dataKey="title" type="category" tick={{ fontSize: 11 }} width={180} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="enrollments" fill="#3b82f6" name="Enrollments" radius={[0, 6, 6, 0]} barSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Course Table */}
                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Course Details</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-50">
                            <th className="text-left py-3 px-4 font-semibold text-gray-600 rounded-tl-lg">Course</th>
                            <th className="text-center py-3 px-4 font-semibold text-gray-600">Status</th>
                            <th className="text-center py-3 px-4 font-semibold text-gray-600">Type</th>
                            <th className="text-right py-3 px-4 font-semibold text-gray-600">Price</th>
                            <th className="text-right py-3 px-4 font-semibold text-gray-600">Enrollments</th>
                            <th className="text-right py-3 px-4 font-semibold text-gray-600">Completed</th>
                            <th className="text-right py-3 px-4 font-semibold text-gray-600 rounded-tr-lg">Completion %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.course_popularity.map((course) => (
                            <tr key={course.id} className="border-b border-gray-100 hover:bg-blue-50/30 transition">
                              <td className="py-3 px-4 font-medium text-gray-800">{course.title}</td>
                              <td className="text-center py-3 px-4">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  course.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {course.is_published ? 'Published' : 'Draft'}
                                </span>
                              </td>
                              <td className="text-center py-3 px-4">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  course.enrollment_type === 'paid' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                                }`}>
                                  {course.enrollment_type || 'free'}
                                </span>
                              </td>
                              <td className="text-right py-3 px-4 text-gray-600">
                                {course.price ? `${course.currency} ${course.price.toLocaleString()}` : 'Free'}
                              </td>
                              <td className="text-right py-3 px-4 font-semibold">{course.enrollments}</td>
                              <td className="text-right py-3 px-4">{course.completed}</td>
                              <td className="text-right py-3 px-4">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-16 bg-gray-100 rounded-full h-2 overflow-hidden">
                                    <div
                                      className="h-full bg-green-500 rounded-full transition-all"
                                      style={{ width: `${Math.min(course.completion_rate, 100)}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-semibold text-gray-600">{course.completion_rate}%</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {data.course_popularity.length === 0 && (
                        <p className="text-center text-gray-400 py-8">No courses found</p>
                      )}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {/* ════════════ ENGAGEMENT TAB ════════════ */}
          {activeTab === 'engagement' && (
            <div className="space-y-6">
              {loading ? (
                <>
                  <SkeletonChart height={300} />
                  <SkeletonChart height={300} />
                </>
              ) : data ? (
                <>
                  {/* Engagement Overview */}
                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Engagement Metrics</h3>
                    <ResponsiveContainer width="100%" height={320}>
                      <ComposedChart data={data.engagement_metrics}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="week_label" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Bar yAxisId="left" dataKey="lessons_completed" fill="#3b82f6" name="Lessons Completed" radius={[4, 4, 0, 0]} barSize={24} />
                        <Bar yAxisId="left" dataKey="active_students" fill="#8b5cf6" name="Active Students" radius={[4, 4, 0, 0]} barSize={24} />
                        <Line yAxisId="right" type="monotone" dataKey="retention_rate" stroke="#10b981" name="Retention %" strokeWidth={3} dot={{ r: 4 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Retention Trend */}
                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Student Retention Rate</h3>
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={data.engagement_metrics}>
                        <defs>
                          <linearGradient id="gradRetention" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="week_label" tick={{ fontSize: 11 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="retention_rate" stroke="#10b981" fill="url(#gradRetention)" name="Retention Rate %" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Engagement Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(() => {
                      const latest = data.engagement_metrics[data.engagement_metrics.length - 1];
                      const totalLessons = data.engagement_metrics.reduce((s, m) => s + m.lessons_completed, 0);
                      const avgRetention = data.engagement_metrics.length > 0
                        ? Math.round(data.engagement_metrics.reduce((s, m) => s + m.retention_rate, 0) / data.engagement_metrics.length)
                        : 0;
                      return (
                        <>
                          <div className="bg-white rounded-xl p-5 border border-gray-200 text-center">
                            <p className="text-sm text-gray-500">Total Lessons Completed</p>
                            <p className="text-3xl font-bold text-blue-600 mt-1">{totalLessons.toLocaleString()}</p>
                            <p className="text-xs text-gray-400 mt-1">across all weeks</p>
                          </div>
                          <div className="bg-white rounded-xl p-5 border border-gray-200 text-center">
                            <p className="text-sm text-gray-500">Current Active Students</p>
                            <p className="text-3xl font-bold text-purple-600 mt-1">{latest?.active_students || 0}</p>
                            <p className="text-xs text-gray-400 mt-1">most recent week</p>
                          </div>
                          <div className="bg-white rounded-xl p-5 border border-gray-200 text-center">
                            <p className="text-sm text-gray-500">Avg Retention Rate</p>
                            <p className="text-3xl font-bold text-green-600 mt-1">{avgRetention}%</p>
                            <p className="text-xs text-gray-400 mt-1">week-over-week</p>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </>
              ) : null}
            </div>
          )}

          {/* ════════════ PAYMENTS TAB ════════════ */}
          {activeTab === 'payments' && (
            <div className="space-y-6">
              {loading ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <SkeletonChart height={300} />
                  <SkeletonChart height={300} />
                </div>
              ) : data ? (
                <>
                  {/* Payment KPIs */}
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="bg-white rounded-xl p-5 border border-gray-200 text-center">
                      <p className="text-sm text-gray-500">Paid Courses</p>
                      <p className="text-2xl font-bold text-blue-600">{data.payment_stats.paid_courses}</p>
                    </div>
                    <div className="bg-white rounded-xl p-5 border border-gray-200 text-center">
                      <p className="text-sm text-gray-500">Free Courses</p>
                      <p className="text-2xl font-bold text-green-600">{data.payment_stats.free_courses}</p>
                    </div>
                    <div className="bg-white rounded-xl p-5 border border-gray-200 text-center">
                      <p className="text-sm text-gray-500">Pending Payments</p>
                      <p className="text-2xl font-bold text-yellow-600">{data.payment_stats.pending_payments}</p>
                    </div>
                    <div className="bg-white rounded-xl p-5 border border-gray-200 text-center">
                      <p className="text-sm text-gray-500">Completed Payments</p>
                      <p className="text-2xl font-bold text-green-600">{data.payment_stats.completed_payments}</p>
                    </div>
                    <div className="bg-white rounded-xl p-5 border border-gray-200 text-center">
                      <p className="text-sm text-gray-500">Waived Payments</p>
                      <p className="text-2xl font-bold text-purple-600">{data.payment_stats.waived_payments}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Payment Status Pie */}
                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Status Distribution</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Completed', value: data.payment_stats.completed_payments, color: '#10b981' },
                              { name: 'Pending', value: data.payment_stats.pending_payments, color: '#f59e0b' },
                              { name: 'Waived', value: data.payment_stats.waived_payments, color: '#8b5cf6' },
                            ].filter(d => d.value > 0)}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={90}
                            paddingAngle={3}
                            dataKey="value"
                            label={({ name, value }) => `${name} (${value})`}
                            labelLine={{ strokeWidth: 1 }}
                          >
                            {[
                              { name: 'Completed', value: data.payment_stats.completed_payments, color: '#10b981' },
                              { name: 'Pending', value: data.payment_stats.pending_payments, color: '#f59e0b' },
                              { name: 'Waived', value: data.payment_stats.waived_payments, color: '#8b5cf6' },
                            ].filter(d => d.value > 0).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Course Type Distribution */}
                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Course Type Distribution</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Paid', value: data.payment_stats.paid_courses, color: '#3b82f6' },
                              { name: 'Free', value: data.payment_stats.free_courses, color: '#10b981' },
                            ].filter(d => d.value > 0)}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={90}
                            paddingAngle={5}
                            dataKey="value"
                            label={({ name, value }) => `${name} (${value})`}
                            labelLine={{ strokeWidth: 1 }}
                          >
                            {[
                              { name: 'Paid', value: data.payment_stats.paid_courses, color: '#3b82f6' },
                              { name: 'Free', value: data.payment_stats.free_courses, color: '#10b981' },
                            ].filter(d => d.value > 0).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AnalyticsDashboard;
