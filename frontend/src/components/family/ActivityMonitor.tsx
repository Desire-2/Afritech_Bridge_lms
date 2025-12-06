'use client';

import React, { useState, useEffect } from 'react';
import { FamilyService } from '@/services/family.service';
import { ChildProfile, FamilyActivityLog, FamilyEnrollment } from '@/types/family';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ActivityMonitorProps {
  familyId: number;
  childId?: number;
}

export const ActivityMonitor: React.FC<ActivityMonitorProps> = ({ familyId, childId }) => {
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<number | undefined>(childId);
  const [activities, setActivities] = useState<FamilyActivityLog[]>([]);
  const [enrollments, setEnrollments] = useState<FamilyEnrollment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'year'>('week');
  const [activityFilter, setActivityFilter] = useState<string>('all');

  useEffect(() => {
    fetchInitialData();
  }, [familyId]);

  useEffect(() => {
    if (selectedChildId) {
      fetchActivityData();
    }
  }, [selectedChildId, dateRange, activityFilter]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const childrenData = await FamilyService.getFamilyChildren(familyId);
      setChildren(childrenData);
      if (!selectedChildId && childrenData.length > 0) {
        setSelectedChildId(childrenData[0].id);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivityData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [activityData, enrollmentData] = await Promise.all([
        FamilyService.getFamilyActivityLogs(familyId, {
          childId: selectedChildId,
          activityType: activityFilter !== 'all' ? activityFilter : undefined,
          limit: 100,
        }),
        selectedChildId ? FamilyService.getChildEnrollments(familyId, selectedChildId) : Promise.resolve([]),
      ]);

      setActivities(activityData.data || []);
      setEnrollments(enrollmentData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedChild = children.find(c => c.id === selectedChildId);

  const getActivityColor = (type: string) => {
    const colors: Record<string, string> = {
      enrollment: 'bg-blue-100 text-blue-800',
      quiz_submission: 'bg-green-100 text-green-800',
      lesson_completion: 'bg-purple-100 text-purple-800',
      assignment_submission: 'bg-orange-100 text-orange-800',
      profile_update: 'bg-gray-100 text-gray-800',
      login: 'bg-indigo-100 text-indigo-800',
      achievement_unlocked: 'bg-yellow-100 text-yellow-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getActivityIcon = (type: string) => {
    const icons: Record<string, string> = {
      enrollment: '📚',
      quiz_submission: '✅',
      lesson_completion: '🎓',
      assignment_submission: '📝',
      profile_update: '👤',
      login: '🔐',
      achievement_unlocked: '🏆',
    };
    return icons[type] || '📌';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Activity Monitor</h2>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Child</label>
            <select
              value={selectedChildId || ''}
              onChange={(e) => setSelectedChildId(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a child...</option>
              {children.map(child => (
                <option key={child.id} value={child.id}>
                  {child.first_name} {child.last_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Time Range</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as 'week' | 'month' | 'year')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="year">Last Year</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Activity Type</label>
            <select
              value={activityFilter}
              onChange={(e) => setActivityFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Activities</option>
              <option value="enrollment">Enrollments</option>
              <option value="quiz_submission">Quiz Submissions</option>
              <option value="lesson_completion">Lesson Completion</option>
              <option value="assignment_submission">Assignments</option>
              <option value="achievement_unlocked">Achievements</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {selectedChild && !loading && (
        <>
          {/* Child Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
              <p className="text-sm font-medium text-blue-900">Active Courses</p>
              <p className="text-2xl font-bold text-blue-600 mt-2">
                {enrollments.filter(e => e.enroll_status === 'active').length}
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
              <p className="text-sm font-medium text-green-900">Completed</p>
              <p className="text-2xl font-bold text-green-600 mt-2">
                {enrollments.filter(e => e.enroll_status === 'completed').length}
              </p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
              <p className="text-sm font-medium text-purple-900">Total Activities</p>
              <p className="text-2xl font-bold text-purple-600 mt-2">{activities.length}</p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
              <p className="text-sm font-medium text-orange-900">Last Activity</p>
              <p className="text-sm text-orange-600 mt-2">
                {activities.length > 0
                  ? new Date(activities[0].created_at).toLocaleDateString()
                  : 'No activity'}
              </p>
            </div>
          </div>

          {/* Active Courses */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Courses</h3>
            {enrollments.filter(e => e.enroll_status === 'active').length === 0 ? (
              <p className="text-gray-600 text-center py-6">No active courses</p>
            ) : (
              <div className="space-y-3">
                {enrollments
                  .filter(e => e.enroll_status === 'active')
                  .map(enrollment => (
                    <div key={enrollment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{enrollment.course_title}</h4>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-sm text-gray-600">Progress: {enrollment.completion_percentage}%</span>
                          <div className="flex-1 bg-gray-300 rounded-full h-2 max-w-xs">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all"
                              style={{ width: `${enrollment.completion_percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Recent Activities Timeline */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Recent Activities</h3>

            {activities.length === 0 ? (
              <p className="text-gray-600 text-center py-8">No activities recorded in this period</p>
            ) : (
              <div className="space-y-4">
                {activities.map((activity, idx) => (
                  <div key={activity.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <span className="text-2xl">{getActivityIcon(activity.activity_type)}</span>
                      {idx < activities.length - 1 && (
                        <div className="w-0.5 h-12 bg-gray-300 my-2"></div>
                      )}
                    </div>

                    <div className="flex-1 pb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getActivityColor(activity.activity_type)}`}>
                          {activity.activity_type.replace(/_/g, ' ').toUpperCase()}
                        </span>
                        <span className="text-sm text-gray-600">
                          {new Date(activity.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-gray-700">{activity.activity_description}</p>
                      {activity.course_title && (
                        <p className="text-sm text-gray-600 mt-1">📚 {activity.course_title}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}
    </div>
  );
};

export default ActivityMonitor;
