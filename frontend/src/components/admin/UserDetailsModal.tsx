import React, { useState, useEffect } from 'react';
import { AdminService } from '@/services/admin.service';
import { User } from '@/types/api';

interface UserDetailsModalProps {
  user: User;
  onClose: () => void;
  onEdit: () => void;
}

const UserDetailsModal: React.FC<UserDetailsModalProps> = ({ user, onClose, onEdit }) => {
  const [userDetails, setUserDetails] = useState<any>(null);
  const [activity, setActivity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'activity' | 'statistics'>('details');

  useEffect(() => {
    fetchUserDetails();
  }, [user.id]);

  const fetchUserDetails = async () => {
    try {
      setLoading(true);
      const [details, activityData] = await Promise.all([
        AdminService.getUser(user.id),
        AdminService.getUserActivity(user.id).catch(() => null)
      ]);
      setUserDetails(details);
      setActivity(activityData);
    } catch (error) {
      console.error('Failed to fetch user details');
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    const colors = {
      admin: 'bg-purple-100 text-purple-800',
      instructor: 'bg-blue-100 text-blue-800',
      student: 'bg-green-100 text-green-800'
    };
    return colors[role as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                {user.first_name?.[0] || user.username[0].toUpperCase()}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {user.first_name && user.last_name
                    ? `${user.first_name} ${user.last_name}`
                    : user.username}
                </h2>
                <p className="text-gray-600">@{user.username}</p>
                <span className={`inline-block mt-2 px-3 py-1 text-xs font-semibold rounded-full ${getRoleBadge(user.role)}`}>
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex">
            {['details', 'activity', 'statistics'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-6 py-3 font-medium text-sm transition-colors ${
                  activeTab === tab
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {activeTab === 'details' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
                      <p className="text-gray-900">{userDetails?.email || user.email}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Phone</label>
                      <p className="text-gray-900">{userDetails?.phone_number || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Status</label>
                      <p className="text-gray-900">
                        {userDetails?.is_active !== false ? (
                          <span className="text-green-600">Active</span>
                        ) : (
                          <span className="text-red-600">Inactive</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Created At</label>
                      <p className="text-gray-900">
                        {new Date(userDetails?.created_at || user.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {userDetails?.bio && (
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Bio</label>
                      <p className="text-gray-900">{userDetails.bio}</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'statistics' && userDetails?.statistics && (
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(userDetails.statistics).map(([key, value]) => (
                    <div key={key} className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="text-sm font-medium text-gray-600 mb-1 capitalize">
                        {key.replace(/_/g, ' ')}
                      </h4>
                      <p className="text-2xl font-bold text-gray-900">{value as any}</p>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'activity' && (
                <div className="space-y-4">
                  {activity?.activities && activity.activities.length > 0 ? (
                    activity.activities.map((item: any, index: number) => (
                      <div key={index} className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                          {item.type === 'enrollment' && '📚'}
                          {item.type === 'quiz_submission' && '📝'}
                          {item.type === 'course_created' && '✨'}
                        </div>
                        <div className="flex-1">
                          <p className="text-gray-900 font-medium">{item.type.replace(/_/g, ' ')}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            {item.course_title || item.quiz_title}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(item.date).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-gray-500 py-8">No recent activity</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserDetailsModal;
