"use client";

import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AdminService } from '@/services/admin.service';

interface StatCard {
  title: string;
  value: number | string;
  icon: string;
  trend?: number;
  color: string;
}

interface DashboardStats {
  total_users: number;
  total_courses: number;
  total_enrollments: number;
  total_opportunities: number;
  active_quizzes: number;
  recent_activity: any[];
}

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = await AdminService.getSystemStats();
        setStats(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700">
        <h3 className="font-semibold">Error Loading Dashboard</h3>
        <p>{error}</p>
      </div>
    );
  }

  const statCards: StatCard[] = [
    {
      title: 'Total Users',
      value: stats?.total_users || 0,
      icon: '👥',
      trend: 12,
      color: 'bg-blue-500',
    },
    {
      title: 'Total Courses',
      value: stats?.total_courses || 0,
      icon: '📚',
      trend: 5,
      color: 'bg-green-500',
    },
    {
      title: 'Total Enrollments',
      value: stats?.total_enrollments || 0,
      icon: '✅',
      trend: 23,
      color: 'bg-purple-500',
    },
    {
      title: 'Active Opportunities',
      value: stats?.total_opportunities || 0,
      icon: '🎯',
      trend: 8,
      color: 'bg-orange-500',
    },
    {
      title: 'Active Quizzes',
      value: stats?.active_quizzes || 0,
      icon: '❓',
      trend: 3,
      color: 'bg-pink-500',
    },
  ];

  // Sample data for charts - would be replaced with real data
  const userGrowthData = [
    { month: 'Jan', users: 400, courses: 24 },
    { month: 'Feb', users: 520, courses: 30 },
    { month: 'Mar', users: 680, courses: 35 },
    { month: 'Apr', users: 890, courses: 42 },
    { month: 'May', users: 1200, courses: 48 },
    { month: 'Jun', users: 1450, courses: 55 },
  ];

  const enrollmentData = [
    { name: 'In Progress', value: 45 },
    { name: 'Completed', value: 30 },
    { name: 'Not Started', value: 25 },
  ];

  const COLORS = ['#3b82f6', '#10b981', '#ef4444'];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Welcome back! Here's your system overview.</p>
        </div>

        {/* Stats Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {statCards.map((card, index) => (
            <div
              key={index}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-3xl">{card.icon}</span>
                {card.trend && (
                  <span className="text-sm font-semibold text-green-600">
                    +{card.trend}%
                  </span>
                )}
              </div>
              <h3 className="text-gray-600 text-sm font-medium mb-2">{card.title}</h3>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            </div>
          ))}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* User Growth Chart */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">User & Course Growth</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={userGrowthData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="users"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="courses"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ fill: '#10b981', r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Enrollment Status Pie Chart */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Enrollment Status</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={enrollmentData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {enrollmentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <div className="space-y-4">
            {stats?.recent_activity && stats.recent_activity.length > 0 ? (
              stats.recent_activity.map((activity, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                    {activity.type?.charAt(0).toUpperCase() || 'A'}
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-900 font-medium">{activity.description}</p>
                    <p className="text-gray-500 text-sm">{activity.timestamp}</p>
                  </div>
                  <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
                    {activity.type}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-8">No recent activity</p>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <a
            href="/admin/users/create"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg text-center transition-colors"
          >
            ➕ Create User
          </a>
          <a
            href="/admin/courses/create"
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg text-center transition-colors"
          >
            ➕ Create Course
          </a>
          <a
            href="/admin/opportunities/create"
            className="bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 px-4 rounded-lg text-center transition-colors"
          >
            ➕ Create Opportunity
          </a>
          <a
            href="/admin/analytics"
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-lg text-center transition-colors"
          >
            📊 View Analytics
          </a>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
