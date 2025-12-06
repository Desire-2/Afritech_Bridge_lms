'use client';

import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import AdminSidebar from './AdminSidebar';
import AdminBreadcrumb from './AdminBreadcrumb';

interface AnalyticsData {
  userGrowth: Array<{ month: string; users: number; active: number }>;
  coursePopularity: Array<{ name: string; enrollments: number }>;
  engagementMetrics: Array<{ week: string; engagement: number; retention: number }>;
  completionRates: Array<{ name: string; value: number; color: string }>;
  topCourses: Array<{ id: number; title: string; enrollments: number; revenue: number; rating: number }>;
  userDemographics: Array<{ name: string; value: number; color: string }>;
  revenue: Array<{ month: string; revenue: number; target: number }>;
}

const AnalyticsDashboard = () => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30days');
  const [selectedMetric, setSelectedMetric] = useState('overview');

  // Mock data - replace with API call
  const mockAnalyticsData: AnalyticsData = {
    userGrowth: [
      { month: 'Sep', users: 120, active: 85 },
      { month: 'Oct', users: 150, active: 105 },
      { month: 'Nov', users: 200, active: 145 },
      { month: 'Dec', users: 280, active: 210 },
      { month: 'Jan', users: 350, active: 280 },
    ],
    coursePopularity: [
      { name: 'Web Development', enrollments: 450 },
      { name: 'Data Science', enrollments: 380 },
      { name: 'Mobile Dev', enrollments: 320 },
      { name: 'Cloud Computing', enrollments: 280 },
      { name: 'AI/ML', enrollments: 250 },
    ],
    engagementMetrics: [
      { week: 'Week 1', engagement: 65, retention: 72 },
      { week: 'Week 2', engagement: 72, retention: 75 },
      { week: 'Week 3', engagement: 78, retention: 80 },
      { week: 'Week 4', engagement: 82, retention: 85 },
    ],
    completionRates: [
      { name: 'Completed', value: 65, color: '#10b981' },
      { name: 'In Progress', value: 25, color: '#3b82f6' },
      { name: 'Dropped', value: 10, color: '#ef4444' },
    ],
    topCourses: [
      { id: 1, title: 'Web Development Bootcamp', enrollments: 450, revenue: 22500, rating: 4.8 },
      { id: 2, title: 'Data Science Masterclass', enrollments: 380, revenue: 19000, rating: 4.7 },
      { id: 3, title: 'Mobile Dev Intensive', enrollments: 320, revenue: 16000, rating: 4.6 },
    ],
    userDemographics: [
      { name: 'Students', value: 450, color: '#3b82f6' },
      { name: 'Instructors', value: 85, color: '#10b981' },
      { name: 'Admins', value: 15, color: '#8b5cf6' },
    ],
    revenue: [
      { month: 'Sep', revenue: 8500, target: 10000 },
      { month: 'Oct', revenue: 12300, target: 12000 },
      { month: 'Nov', revenue: 15600, target: 14000 },
      { month: 'Dec', revenue: 22400, target: 20000 },
      { month: 'Jan', revenue: 28700, target: 25000 },
    ],
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnalyticsData(mockAnalyticsData);
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [dateRange]);

  const breadcrumbs = [
    { label: 'Admin', href: '/admin' },
    { label: 'Analytics', href: '/admin/analytics', active: true },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-600"></div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="flex h-screen bg-gray-50">
        <AdminSidebar />
        <main className="flex-1 overflow-auto p-8">
          <div className="text-center text-red-600">Failed to load analytics data</div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <AdminBreadcrumb items={breadcrumbs} />
              <h1 className="text-3xl font-bold text-gray-900 mt-2">Analytics Dashboard</h1>
              <p className="text-gray-600 mt-1">Comprehensive system insights and metrics</p>
            </div>
            <div className="flex gap-2">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="7days">Last 7 days</option>
                <option value="30days">Last 30 days</option>
                <option value="90days">Last 90 days</option>
                <option value="1year">Last year</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Revenue', value: '$92,600', change: '+18.2%', color: 'green' },
              { label: 'Total Enrollments', value: '1,380', change: '+12.5%', color: 'blue' },
              { label: 'Avg. Completion Rate', value: '65%', change: '+5.3%', color: 'purple' },
              { label: 'Active Users', value: '625', change: '+8.1%', color: 'orange' },
            ].map((kpi, idx) => (
              <div key={idx} className="bg-white rounded-lg p-6 border border-gray-200 hover:shadow-lg transition">
                <p className="text-gray-600 text-sm font-medium">{kpi.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{kpi.value}</p>
                <p className={`text-sm font-semibold mt-2 ${
                  kpi.color === 'green' ? 'text-green-600' :
                  kpi.color === 'blue' ? 'text-blue-600' :
                  kpi.color === 'purple' ? 'text-purple-600' :
                  'text-orange-600'
                }`}>
                  {kpi.change}
                </p>
              </div>
            ))}
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 border-b border-gray-200">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'users', label: 'Users' },
              { id: 'courses', label: 'Courses' },
              { id: 'revenue', label: 'Revenue' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedMetric(tab.id)}
                className={`px-6 py-3 font-medium border-b-2 transition ${
                  selectedMetric === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Overview Tab */}
          {selectedMetric === 'overview' && (
            <div className="space-y-6">
              {/* User Growth */}
              <div className="bg-white rounded-lg p-6 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">User Growth Trend</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={analyticsData.userGrowth}>
                    <defs>
                      <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="users" stroke="#3b82f6" fillOpacity={1} fill="url(#colorUsers)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Engagement Metrics */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg p-6 border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Engagement & Retention</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={analyticsData.engagementMetrics}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="engagement" stroke="#3b82f6" strokeWidth={2} />
                      <Line type="monotone" dataKey="retention" stroke="#10b981" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-lg p-6 border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Course Completion Status</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={analyticsData.completionRates}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name} ${value}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {analyticsData.completionRates.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Course Popularity */}
              <div className="bg-white rounded-lg p-6 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Course Popularity</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analyticsData.coursePopularity}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="enrollments" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Users Tab */}
          {selectedMetric === 'users' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg p-6 border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">User Demographics</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={analyticsData.userDemographics}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name} (${value})`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {analyticsData.userDemographics.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-lg p-6 border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">User Growth</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={analyticsData.userGrowth}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="users" stroke="#3b82f6" strokeWidth={2} />
                      <Line type="monotone" dataKey="active" stroke="#10b981" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Courses Tab */}
          {selectedMetric === 'courses' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg p-6 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Courses</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Course Title</th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-700">Enrollments</th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-700">Revenue</th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-700">Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyticsData.topCourses.map((course) => (
                        <tr key={course.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">{course.title}</td>
                          <td className="text-right py-3 px-4">{course.enrollments}</td>
                          <td className="text-right py-3 px-4 font-semibold text-green-600">${course.revenue.toLocaleString()}</td>
                          <td className="text-right py-3 px-4">
                            <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-semibold">
                              ⭐ {course.rating}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Revenue Tab */}
          {selectedMetric === 'revenue' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg p-6 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue vs Target</h3>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={analyticsData.revenue}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                    <Legend />
                    <Bar dataKey="revenue" fill="#10b981" name="Actual Revenue" />
                    <Bar dataKey="target" fill="#9ca3af" name="Target" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AnalyticsDashboard;
