'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import internshipService, { type InternshipStats, type InternshipApplication } from '@/services/api/internship.service';
import { Users, Briefcase, Calendar, Clock, TrendingUp, TrendingDown, Activity, RefreshCw, FileText, GraduationCap, CheckCircle, XCircle, UserCheck, ArrowRight, Award } from 'lucide-react';
import Link from 'next/link';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#162844] border border-white/10 shadow-lg rounded-lg p-3 text-sm">
      <p className="font-semibold text-gray-200 mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color }} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
          {entry.name}: <span className="font-semibold">{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}</span>
        </p>
      ))}
    </div>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-900/40 text-yellow-300 border-yellow-700/40',
    reviewing: 'bg-blue-900/40 text-blue-300 border-blue-700/40',
    shortlisted: 'bg-purple-900/40 text-purple-300 border-purple-700/40',
    interview_scheduled: 'bg-indigo-900/40 text-indigo-300 border-indigo-700/40',
    accepted: 'bg-green-900/40 text-green-300 border-green-700/40',
    rejected: 'bg-red-900/40 text-red-300 border-red-700/40',
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${colors[status] || 'bg-gray-900/40 text-gray-300'}`}>
      {status.replace('_', ' ')}
    </span>
  );
};

const InternshipAdminDashboard = () => {
  const [stats, setStats] = useState<InternshipStats | null>(null);
  const [recentApps, setRecentApps] = useState<InternshipApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const [statsData, appsData] = await Promise.all([
        internshipService.getStats(),
        internshipService.getApplications({ per_page: 5, sort_by: 'created_at', sort_order: 'desc' }),
      ]);

      setStats(statsData);
      setRecentApps(appsData.data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load internship data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Build status chart data
  const statusChartData = stats?.by_status ? Object.entries(stats.by_status).map(([key, count]) => ({
    name: key.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
    value: count,
    color: {
      pending: '#f59e0b',
      reviewing: '#3b82f6',
      shortlisted: '#8b5cf6',
      interview_scheduled: '#6366f1',
      accepted: '#10b981',
      rejected: '#ef4444',
    }[key] || '#6b7280',
  })) : [];

  // Build track chart data
  const trackChartData = stats?.by_track ? Object.entries(stats.by_track).map(([key, count]) => ({
    name: key,
    applications: count,
  })).sort((a, b) => b.applications - a.applications) : [];

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-400">Loading internship dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-red-500 text-xl">⚠️</span>
          <h3 className="font-semibold text-red-300">Error Loading Dashboard</h3>
        </div>
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={() => fetchData()} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition">
          Try Again
        </button>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Applications',
      value: stats?.total_applications || 0,
      icon: <FileText className="h-6 w-6" />,
      color: 'text-blue-400',
      bgColor: 'bg-blue-900/40',
    },
    {
      title: 'Active Tracks',
      value: stats?.track_count || 0,
      icon: <Briefcase className="h-6 w-6" />,
      color: 'text-green-400',
      bgColor: 'bg-green-900/40',
    },
    {
      title: 'Cohorts',
      value: stats?.cohort_count || 0,
      icon: <Calendar className="h-6 w-6" />,
      color: 'text-purple-400',
      bgColor: 'bg-purple-900/40',
    },
    {
      title: 'Acceptance Rate',
      value: `${stats?.conversion_rates?.acceptance_rate?.toFixed(1) || 0}%`,
      icon: <CheckCircle className="h-6 w-6" />,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-900/40',
    },
    {
      title: 'Shortlist Rate',
      value: `${stats?.conversion_rates?.shortlist_rate?.toFixed(1) || 0}%`,
      icon: <UserCheck className="h-6 w-6" />,
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-900/40',
    },
    {
      title: 'Rejection Rate',
      value: `${stats?.conversion_rates?.rejection_rate?.toFixed(1) || 0}%`,
      icon: <XCircle className="h-6 w-6" />,
      color: 'text-rose-400',
      bgColor: 'bg-rose-900/40',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Internship Management</h1>
          <p className="text-gray-400 mt-1">Manage internship applications, tracks, and cohorts</p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center gap-3">
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-[#162844] border border-white/10 rounded-lg hover:bg-white/5 transition disabled:opacity-50 text-gray-300"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((card, i) => (
          <div key={i} className="bg-[#162844] rounded-xl border border-white/10 p-5 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2.5 rounded-lg ${card.bgColor}`}>
                <span className={card.color}>{card.icon}</span>
              </div>
            </div>
            <h3 className="text-gray-400 text-xs font-medium uppercase tracking-wide">{card.title}</h3>
            <p className="text-2xl font-bold text-white mt-1">{typeof card.value === 'number' ? card.value.toLocaleString() : card.value}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link
          href="/admin/internships/applications"
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl transition-all text-sm"
        >
          <FileText className="h-4 w-4" />
          View Applications
        </Link>
        <Link
          href="/admin/internships/applications?status=pending"
          className="flex items-center justify-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-3 px-4 rounded-xl transition-all text-sm"
        >
          <Clock className="h-4 w-4" />
          Pending Review
        </Link>
        <Link
          href="/admin/internships/tracks"
          className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-xl transition-all text-sm"
        >
          <Briefcase className="h-4 w-4" />
          Manage Tracks
        </Link>
        <Link
          href="/admin/internships/cohorts"
          className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-4 rounded-xl transition-all text-sm"
        >
          <Calendar className="h-4 w-4" />
          Manage Cohorts
        </Link>
        <Link
          href="/admin/internships/applications?status=accepted"
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 text-white font-medium py-3 px-4 rounded-xl transition-all text-sm shadow-lg shadow-teal-900/30"
        >
          <Award className="h-4 w-4" />
          Send Offers
        </Link>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Distribution Pie */}
        <div className="bg-[#162844] rounded-xl border border-white/10 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Application Status</h2>
          {statusChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={statusChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={{ strokeWidth: 1 }}
                >
                  {statusChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-gray-400">
              <p>No data available</p>
            </div>
          )}
        </div>

        {/* Applications by Track */}
        <div className="bg-[#162844] rounded-xl border border-white/10 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Applications by Track</h2>
          {trackChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={trackChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="applications" fill="#3b82f6" name="Applications" radius={[0, 6, 6, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-gray-400">
              <p>No track data available</p>
            </div>
          )}
        </div>

        {/* Conversion Funnel */}
        <div className="bg-[#162844] rounded-xl border border-white/10 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Conversion Funnel</h2>
          <div className="space-y-4">
            {stats?.conversion_rates ? (
              <>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300">Shortlist Rate</span>
                    <span className="text-purple-400 font-semibold">{stats.conversion_rates.shortlist_rate.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2.5">
                    <div className="bg-purple-500 h-2.5 rounded-full transition-all" style={{ width: `${Math.min(stats.conversion_rates.shortlist_rate, 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300">Acceptance Rate</span>
                    <span className="text-green-400 font-semibold">{stats.conversion_rates.acceptance_rate.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2.5">
                    <div className="bg-green-500 h-2.5 rounded-full transition-all" style={{ width: `${Math.min(stats.conversion_rates.acceptance_rate, 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300">Rejection Rate</span>
                    <span className="text-red-400 font-semibold">{stats.conversion_rates.rejection_rate.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2.5">
                    <div className="bg-red-500 h-2.5 rounded-full transition-all" style={{ width: `${Math.min(stats.conversion_rates.rejection_rate, 100)}%` }} />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-gray-400">
                <p>No conversion data available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Applications */}
      <div className="bg-[#162844] rounded-xl border border-white/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Recent Applications</h2>
          <Link href="/admin/internships/applications" className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1">
            View All <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {recentApps.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-3 font-semibold text-gray-400">Ref Code</th>
                  <th className="text-left py-3 px-3 font-semibold text-gray-400">Applicant</th>
                  <th className="text-left py-3 px-3 font-semibold text-gray-400">Track</th>
                  <th className="text-left py-3 px-3 font-semibold text-gray-400">Status</th>
                  <th className="text-right py-3 px-3 font-semibold text-gray-400">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentApps.map((app) => (
                  <tr key={app.id} className="border-b border-white/5 hover:bg-white/5 transition">
                    <td className="py-3 px-3 font-mono text-xs text-blue-400">{app.reference_code}</td>
                    <td className="py-3 px-3">
                      <div>
                        <p className="text-white font-medium">{app.full_name}</p>
                        <p className="text-gray-400 text-xs">{app.email}</p>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-gray-300">{app.track_name}</td>                      <td className="py-3 px-3"><StatusBadge status={app.status} /></td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-gray-400 text-xs">{new Date(app.created_at).toLocaleDateString()}</span>
                          {app.status === 'accepted' && (
                            <Link
                              href={`/admin/internships/applications/${app.id}`}
                              className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 text-white rounded-lg transition text-xs font-medium"
                            >
                              <Award className="h-3 w-3" />
                              Offer
                            </Link>
                          )}
                        </div>
                      </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-500 mx-auto mb-3" />
            <p className="text-gray-400">No applications yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InternshipAdminDashboard;
