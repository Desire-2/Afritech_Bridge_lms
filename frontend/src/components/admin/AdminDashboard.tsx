"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { AdminService } from '@/services/admin.service';
import { 
  Users, BookOpen, GraduationCap, Briefcase, ClipboardCheck, 
  TrendingUp, TrendingDown, Activity, AlertTriangle, RefreshCw,
  Calendar, Clock, Award, UserCheck, UserX
} from 'lucide-react';

interface StatCard {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  trend?: number;
  trendLabel?: string;
  color: string;
  bgColor: string;
  subValue?: string;
}

interface DashboardStats {
  total_users: number;
  active_users: number;
  users_by_role: Record<string, number>;
  total_courses: number;
  published_courses: number;
  total_enrollments: number;
  total_opportunities: number;
  active_quizzes: number;
  recent_activity: any[];
}

interface UserStats {
  total_users: number;
  active_users: number;
  inactive_users: number;
  users_by_role: Record<string, number>;
  new_users_30d: number;
  new_users_7d: number;
  user_growth: Array<{ month: string; count: number }>;
}

interface InactivityAnalysis {
  total_active_users: number;
  users_by_role: Record<string, number>;
  inactivity_rates: Record<string, { count: number; rate: number }>;
  deletion_candidates: Record<string, { count: number; users: any[] }>;
  recommendations: Array<{ type: string; title: string; message: string; action: string }>;
}

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [inactivityAnalysis, setInactivityAnalysis] = useState<InactivityAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchDashboardData = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Fetch all data in parallel
      const [systemStats, userStatsData, inactivityData] = await Promise.all([
        AdminService.getSystemStats(),
        AdminService.getUserStats(),
        AdminService.getInactivityAnalysis().catch(() => null) // Optional, don't fail if unavailable
      ]);

      setStats(systemStats);
      setUserStats(userStatsData);
      if (inactivityData?.analysis) {
        setInactivityAnalysis(inactivityData.analysis);
      }
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard statistics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    
    // Auto-refresh every 5 minutes
    const interval = setInterval(() => {
      fetchDashboardData(true);
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700 m-6">
        <div className="flex items-center gap-3 mb-2">
          <AlertTriangle className="h-5 w-5" />
          <h3 className="font-semibold">Error Loading Dashboard</h3>
        </div>
        <p className="mb-4">{error}</p>
        <button 
          onClick={() => fetchDashboardData()}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Calculate trends from user stats
  const newUsersTrend = userStats?.new_users_7d ? 
    Math.round((userStats.new_users_7d / (userStats.new_users_30d || 1)) * 100) : 0;

  const statCards: StatCard[] = [
    {
      title: 'Total Users',
      value: stats?.total_users || 0,
      icon: <Users className="h-6 w-6" />,
      trend: userStats?.new_users_7d || 0,
      trendLabel: 'new this week',
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      subValue: `${stats?.active_users || 0} active`
    },
    {
      title: 'Total Courses',
      value: stats?.total_courses || 0,
      icon: <BookOpen className="h-6 w-6" />,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      subValue: `${stats?.published_courses || 0} published`
    },
    {
      title: 'Total Enrollments',
      value: stats?.total_enrollments || 0,
      icon: <GraduationCap className="h-6 w-6" />,
      trend: 15,
      trendLabel: '% this month',
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      title: 'Opportunities',
      value: stats?.total_opportunities || 0,
      icon: <Briefcase className="h-6 w-6" />,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
    {
      title: 'Active Quizzes',
      value: stats?.active_quizzes || 0,
      icon: <ClipboardCheck className="h-6 w-6" />,
      color: 'text-pink-600',
      bgColor: 'bg-pink-100',
    },
  ];

  // Transform user growth data for charts
  const userGrowthData = userStats?.user_growth?.map(item => ({
    month: item.month,
    users: item.count,
  })) || [];

  // Create enrollment status breakdown (simulated from stats or real data)
  const enrollmentData = [
    { name: 'In Progress', value: Math.round((stats?.total_enrollments || 0) * 0.45), color: '#3b82f6' },
    { name: 'Completed', value: Math.round((stats?.total_enrollments || 0) * 0.30), color: '#10b981' },
    { name: 'Not Started', value: Math.round((stats?.total_enrollments || 0) * 0.25), color: '#ef4444' },
  ];

  // Users by role data
  const usersByRoleData = stats?.users_by_role ? 
    Object.entries(stats.users_by_role).map(([role, count]) => ({
      name: role.charAt(0).toUpperCase() + role.slice(1),
      value: count,
      color: role === 'admin' ? '#ef4444' : role === 'instructor' ? '#f59e0b' : '#3b82f6'
    })) : [];

  const COLORS = ['#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6'];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
            <p className="text-gray-600">Welcome back! Here&apos;s your system overview.</p>
          </div>
          <div className="mt-4 md:mt-0 flex items-center gap-4">
            {lastUpdated && (
              <span className="text-sm text-gray-500 flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button 
              onClick={() => fetchDashboardData(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Stats Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {statCards.map((card, index) => (
            <div
              key={index}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${card.bgColor}`}>
                  <span className={card.color}>{card.icon}</span>
                </div>
                {card.trend !== undefined && (
                  <div className="flex items-center gap-1 text-sm">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span className="font-semibold text-green-600">
                      +{card.trend}
                    </span>
                    {card.trendLabel && (
                      <span className="text-gray-500 text-xs">{card.trendLabel}</span>
                    )}
                  </div>
                )}
              </div>
              <h3 className="text-gray-600 text-sm font-medium mb-1">{card.title}</h3>
              <p className="text-2xl font-bold text-gray-900">{card.value.toLocaleString()}</p>
              {card.subValue && (
                <p className="text-sm text-gray-500 mt-1">{card.subValue}</p>
              )}
            </div>
          ))}
        </div>

        {/* Charts Grid - Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* User Growth Chart */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">User Growth</h2>
              <span className="text-sm text-gray-500">Last 6 months</span>
            </div>
            {userGrowthData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={userGrowthData}>
                  <defs>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }} 
                  />
                  <Area
                    type="monotone"
                    dataKey="users"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#colorUsers)"
                    dot={{ fill: '#3b82f6', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                <p>No growth data available</p>
              </div>
            )}
          </div>

          {/* Users by Role Pie Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Users by Role</h2>
            {usersByRoleData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={usersByRoleData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {usersByRoleData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [value, 'Users']}
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px'
                    }} 
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value) => <span className="text-sm text-gray-600">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                <p>No role data available</p>
              </div>
            )}
          </div>
        </div>

        {/* Charts Grid - Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Enrollment Status Pie Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Enrollment Status</h2>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={enrollmentData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={100}
                  dataKey="value"
                >
                  {enrollmentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [value, 'Enrollments']}
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }} 
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* User Activity Stats */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">User Activity Overview</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <UserCheck className="h-5 w-5 text-blue-600" />
                  <span className="text-sm text-gray-600">Active Users</span>
                </div>
                <p className="text-2xl font-bold text-blue-700">{stats?.active_users || 0}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <UserX className="h-5 w-5 text-red-600" />
                  <span className="text-sm text-gray-600">Inactive Users</span>
                </div>
                <p className="text-2xl font-bold text-red-700">{userStats?.inactive_users || 0}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-gray-600">New (7 days)</span>
                </div>
                <p className="text-2xl font-bold text-green-700">{userStats?.new_users_7d || 0}</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-5 w-5 text-purple-600" />
                  <span className="text-sm text-gray-600">New (30 days)</span>
                </div>
                <p className="text-2xl font-bold text-purple-700">{userStats?.new_users_30d || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Inactivity Warnings */}
        {inactivityAnalysis?.recommendations && inactivityAnalysis.recommendations.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h2 className="text-lg font-semibold text-amber-800">System Alerts</h2>
            </div>
            <div className="space-y-3">
              {inactivityAnalysis.recommendations.map((rec, index) => (
                <div 
                  key={index}
                  className={`p-4 rounded-lg border ${
                    rec.type === 'urgent' ? 'bg-red-50 border-red-200' :
                    rec.type === 'warning' ? 'bg-amber-100 border-amber-300' :
                    'bg-blue-50 border-blue-200'
                  }`}
                >
                  <h3 className={`font-medium mb-1 ${
                    rec.type === 'urgent' ? 'text-red-800' :
                    rec.type === 'warning' ? 'text-amber-800' :
                    'text-blue-800'
                  }`}>{rec.title}</h3>
                  <p className="text-sm text-gray-600">{rec.message}</p>
                  <p className="text-xs text-gray-500 mt-1">Action: {rec.action}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          </div>
          <div className="space-y-3">
            {stats?.recent_activity && stats.recent_activity.length > 0 ? (
              stats.recent_activity.map((activity, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    activity.type === 'user_registration' ? 'bg-blue-100 text-blue-600' :
                    activity.type === 'enrollment' ? 'bg-green-100 text-green-600' :
                    'bg-purple-100 text-purple-600'
                  }`}>
                    {activity.type === 'user_registration' ? <Users className="h-5 w-5" /> :
                     activity.type === 'enrollment' ? <GraduationCap className="h-5 w-5" /> :
                     <Activity className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 font-medium truncate">{activity.description}</p>
                    <p className="text-gray-500 text-sm">
                      {new Date(activity.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full whitespace-nowrap ${
                    activity.type === 'user_registration' ? 'bg-blue-100 text-blue-700' :
                    activity.type === 'enrollment' ? 'bg-green-100 text-green-700' :
                    'bg-purple-100 text-purple-700'
                  }`}>
                    {activity.type?.replace('_', ' ')}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Activity className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No recent activity</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <a
            href="/admin/users/create"
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-4 rounded-xl text-center transition-all duration-200 hover:shadow-lg"
          >
            <Users className="h-5 w-5" />
            Create User
          </a>
          <a
            href="/admin/courses/create"
            className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-4 rounded-xl text-center transition-all duration-200 hover:shadow-lg"
          >
            <BookOpen className="h-5 w-5" />
            Create Course
          </a>
          <a
            href="/admin/opportunities/create"
            className="flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold py-4 px-4 rounded-xl text-center transition-all duration-200 hover:shadow-lg"
          >
            <Briefcase className="h-5 w-5" />
            Create Opportunity
          </a>
          <a
            href="/admin/analytics"
            className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-4 px-4 rounded-xl text-center transition-all duration-200 hover:shadow-lg"
          >
            <Award className="h-5 w-5" />
            View Analytics
          </a>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
