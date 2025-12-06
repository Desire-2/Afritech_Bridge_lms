'use client';

import React, { useState, useEffect } from 'react';
import { FamilyService } from '@/services/family.service';
import { FamilyAccount, FamilyDashboardData, ChildProfile, FamilyMember } from '@/types/family';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface FamilyManagementProps {
  familyId: number;
}

export const FamilyManagement: React.FC<FamilyManagementProps> = ({ familyId }) => {
  const [family, setFamily] = useState<FamilyAccount | null>(null);
  const [dashboardData, setDashboardData] = useState<FamilyDashboardData | null>(null);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'children' | 'members' | 'activities'>('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddChildModal, setShowAddChildModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, [familyId]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [familyData, dashData, childrenData, membersData] = await Promise.all([
        FamilyService.getFamilyAccount(familyId),
        FamilyService.getFamilyDashboard(familyId),
        FamilyService.getFamilyChildren(familyId),
        FamilyService.getFamilyMembers(familyId),
      ]);

      setFamily(familyData);
      setDashboardData(dashData);
      setChildren(childrenData);
      setMembers(membersData);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-lg shadow-lg p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{family?.family_name}</h1>
            <p className="text-blue-100 mt-2">Family Code: {family?.family_code}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{children.length}</p>
            <p className="text-blue-100">Children</p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-3 font-medium ${activeTab === 'overview' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('children')}
          className={`px-4 py-3 font-medium ${activeTab === 'children' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
        >
          Children ({children.length})
        </button>
        <button
          onClick={() => setActiveTab('members')}
          className={`px-4 py-3 font-medium ${activeTab === 'members' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
        >
          Family Members ({members.length})
        </button>
        <button
          onClick={() => setActiveTab('activities')}
          className={`px-4 py-3 font-medium ${activeTab === 'activities' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
        >
          Recent Activities
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab dashboardData={dashboardData} family={family} />
      )}

      {activeTab === 'children' && (
        <ChildrenTab
          children={children}
          onAddChild={() => setShowAddChildModal(true)}
          onRefresh={fetchDashboardData}
          familyId={familyId}
        />
      )}

      {activeTab === 'members' && (
        <MembersTab
          members={members}
          onAddMember={() => setShowAddMemberModal(true)}
          onRefresh={fetchDashboardData}
          familyId={familyId}
        />
      )}

      {activeTab === 'activities' && (
        <ActivitiesTab
          activities={dashboardData?.recent_activities || []}
          children={children}
        />
      )}
    </div>
  );
};

// ========================================
// Overview Tab Component
// ========================================

const OverviewTab: React.FC<{
  dashboardData: FamilyDashboardData | null;
  family: FamilyAccount | null;
}> = ({ dashboardData, family }) => {
  if (!dashboardData) return null;

  const progressData = dashboardData.progress_report.children_summaries.map(child => ({
    name: child.child_name,
    completion: child.average_completion_percentage,
    quizScore: child.average_quiz_score,
  }));

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-gray-600 text-sm font-medium">Total Children</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{dashboardData.progress_report.children_summaries.length}</p>
          <p className="text-green-600 text-sm mt-2">Active</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-gray-600 text-sm font-medium">Avg. Completion</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {dashboardData.progress_report.average_progress_percentage.toFixed(1)}%
          </p>
          <p className="text-blue-600 text-sm mt-2">This month</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-gray-600 text-sm font-medium">Total Learning Hours</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{dashboardData.total_learning_hours}</p>
          <p className="text-purple-600 text-sm mt-2">All time</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-gray-600 text-sm font-medium">Engagement Score</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{dashboardData.engagement_score}/100</p>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className="bg-blue-600 h-2 rounded-full"
              style={{ width: `${dashboardData.engagement_score}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Progress Chart */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Children Progress</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={progressData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="completion" fill="#3b82f6" name="Completion %" />
              <Bar dataKey="quizScore" fill="#10b981" name="Avg Quiz Score" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Activity Distribution */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Distribution</h3>
          <div className="space-y-3">
            {[
              { label: 'Courses Enrolled', value: dashboardData.progress_report.children_summaries.reduce((sum, c) => sum + c.total_courses_enrolled, 0), color: 'bg-blue-500' },
              { label: 'Quizzes Completed', value: dashboardData.progress_report.children_summaries.reduce((sum, c) => sum + c.total_quizzes_taken, 0), color: 'bg-green-500' },
              { label: 'Assignments', value: dashboardData.progress_report.children_summaries.reduce((sum, c) => sum + c.total_assignments_submitted, 0), color: 'bg-purple-500' },
              { label: 'Achievements', value: dashboardData.progress_report.children_summaries.reduce((sum, c) => sum + c.achievements_unlocked, 0), color: 'bg-yellow-500' },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
                  <span className="text-gray-700">{item.label}</span>
                </div>
                <span className="font-bold text-gray-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">System Recommendations</h3>
        <ul className="space-y-2">
          {dashboardData.progress_report.recommendations.map((rec, idx) => (
            <li key={idx} className="flex items-start gap-3">
              <span className="text-blue-600 font-bold mt-1">•</span>
              <span className="text-gray-700">{rec}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

// ========================================
// Children Tab Component
// ========================================

const ChildrenTab: React.FC<{
  children: ChildProfile[];
  onAddChild: () => void;
  onRefresh: () => void;
  familyId: number;
}> = ({ children, onAddChild, onRefresh, familyId }) => {
  const [selectedChild, setSelectedChild] = useState<ChildProfile | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Children ({children.length})</h2>
        <button
          onClick={onAddChild}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          + Add Child
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {children.map((child) => (
          <div key={child.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-4 mb-4">
              {child.profile_picture_url && (
                <img
                  src={child.profile_picture_url}
                  alt={child.first_name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              )}
              <div>
                <h3 className="font-semibold text-gray-900">{child.first_name} {child.last_name}</h3>
                <p className="text-gray-600 text-sm">{child.grade_level || 'Grade TBD'}</p>
              </div>
            </div>

            <div className="space-y-2 text-sm mb-4">
              <p><span className="text-gray-600">School:</span> {child.school_name || 'Not specified'}</p>
              <p><span className="text-gray-600">Status:</span> {child.is_active ? <span className="text-green-600 font-medium">Active</span> : <span className="text-red-600 font-medium">Inactive</span>}</p>
            </div>

            <button
              onClick={() => setSelectedChild(child)}
              className="w-full px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium"
            >
              View Details
            </button>
          </div>
        ))}
      </div>

      {selectedChild && (
        <ChildDetailModal child={selectedChild} onClose={() => setSelectedChild(null)} />
      )}
    </div>
  );
};

// ========================================
// Family Members Tab Component
// ========================================

const MembersTab: React.FC<{
  members: FamilyMember[];
  onAddMember: () => void;
  onRefresh: () => void;
  familyId: number;
}> = ({ members, onAddMember, onRefresh, familyId }) => {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Family Members ({members.length})</h2>
        <button
          onClick={onAddMember}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          + Add Member
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Role</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Permissions</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Last Login</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {member.first_name} {member.last_name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{member.email}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                      {member.role_in_family}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{member.permission_level}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {member.last_login ? new Date(member.last_login).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 text-sm space-x-2">
                    <button className="text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                    <button className="text-red-600 hover:text-red-800 font-medium">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ========================================
// Activities Tab Component
// ========================================

const ActivitiesTab: React.FC<{
  activities: any[];
  children: ChildProfile[];
}> = ({ activities, children }) => {
  const getChildName = (childId: number) => {
    const child = children.find(c => c.id === childId);
    return child ? `${child.first_name} ${child.last_name}` : 'Unknown Child';
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">Recent Activities</h2>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Child</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Activity</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Description</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Date/Time</th>
              </tr>
            </thead>
            <tbody>
              {activities.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No activities recorded yet
                  </td>
                </tr>
              ) : (
                activities.map((activity, idx) => (
                  <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {getChildName(activity.child_id)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                        {activity.activity_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{activity.activity_description}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {new Date(activity.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ========================================
// Child Detail Modal Component
// ========================================

const ChildDetailModal: React.FC<{
  child: ChildProfile;
  onClose: () => void;
}> = ({ child, onClose }) => {
  const [childDetail, setChildDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        // Fetch child detail - this would use family ID from context
        setLoading(false);
      } catch (error) {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [child.id]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-screen overflow-auto">
        <div className="sticky top-0 bg-gray-50 border-b border-gray-200 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">{child.first_name} {child.last_name}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-gray-600 text-sm font-medium">Date of Birth</p>
              <p className="text-gray-900 font-semibold mt-1">{child.date_of_birth}</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm font-medium">Grade Level</p>
              <p className="text-gray-900 font-semibold mt-1">{child.grade_level || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm font-medium">School</p>
              <p className="text-gray-900 font-semibold mt-1">{child.school_name || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm font-medium">Status</p>
              <p className={`font-semibold mt-1 ${child.is_active ? 'text-green-600' : 'text-red-600'}`}>
                {child.is_active ? 'Active' : 'Inactive'}
              </p>
            </div>
          </div>

          {/* Learning Goals */}
          {child.learning_goals && (
            <div>
              <p className="text-gray-600 text-sm font-medium">Learning Goals</p>
              <p className="text-gray-900 mt-1">{child.learning_goals}</p>
            </div>
          )}

          {/* Interests */}
          {child.interests && child.interests.length > 0 && (
            <div>
              <p className="text-gray-600 text-sm font-medium mb-2">Interests</p>
              <div className="flex flex-wrap gap-2">
                {child.interests.map((interest, idx) => (
                  <span key={idx} className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
              Edit Profile
            </button>
            <button className="flex-1 px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 font-medium">
              View Progress
            </button>
            <button onClick={onClose} className="flex-1 px-4 py-2 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 font-medium">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FamilyManagement;
