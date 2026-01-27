'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AdminService, InactiveUser } from '@/services/admin.service';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Clock,
  Trash2,
  RefreshCw,
  Users,
  UserX,
  Shield,
  GraduationCap,
  BookOpen,
  CheckCircle2,
  XCircle,
  Calendar,
  Mail,
  Info,
  Filter
} from 'lucide-react';

interface InactiveUsersManagementProps {
  onRefreshStats?: () => void;
}

export default function InactiveUsersManagement({ onRefreshStats }: InactiveUsersManagementProps) {
  const [inactiveUsers, setInactiveUsers] = useState<InactiveUser[]>([]);
  const [usersByRole, setUsersByRole] = useState<Record<string, InactiveUser[]>>({});
  const [loading, setLoading] = useState(true);
  const [thresholdDays, setThresholdDays] = useState(14);
  const [roleFilter, setRoleFilter] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<InactiveUser | null>(null);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);

  const fetchInactiveUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await AdminService.getInactiveUsers({
        threshold_days: thresholdDays,
        role: roleFilter || undefined
      });
      setInactiveUsers(response.inactive_users);
      setUsersByRole(response.users_by_role);
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch inactive users');
    } finally {
      setLoading(false);
    }
  }, [thresholdDays, roleFilter]);

  const fetchAnalysis = useCallback(async () => {
    try {
      const response = await AdminService.getInactivityAnalysis();
      setAnalysis(response.analysis);
    } catch (error: any) {
      console.error('Failed to fetch inactivity analysis:', error);
    }
  }, []);

  useEffect(() => {
    fetchInactiveUsers();
    fetchAnalysis();
  }, [fetchInactiveUsers, fetchAnalysis]);

  const handleDeleteUser = async (user: InactiveUser) => {
    setUserToDelete(user);
    setShowConfirmModal(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    
    try {
      setIsDeleting(true);
      const response = await AdminService.autoDeleteUser(userToDelete.user_id);
      
      if (response.success) {
        toast.success(`User "${userToDelete.username}" has been deleted`);
        fetchInactiveUsers();
        fetchAnalysis();
        onRefreshStats?.();
      } else {
        toast.error(response.message || 'Failed to delete user');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete user');
    } finally {
      setIsDeleting(false);
      setShowConfirmModal(false);
      setUserToDelete(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedUsers.length === 0) {
      toast.error('No users selected');
      return;
    }
    setShowBulkConfirm(true);
  };

  const confirmBulkDelete = async () => {
    try {
      setIsDeleting(true);
      const response = await AdminService.bulkAutoDeleteUsers(selectedUsers);
      
      const successCount = response.results.successful.length;
      const failedCount = response.results.failed.length;
      
      if (successCount > 0) {
        toast.success(`Successfully deleted ${successCount} user(s)`);
      }
      
      if (failedCount > 0) {
        toast.warning(`Failed to delete ${failedCount} user(s)`);
      }
      
      setSelectedUsers([]);
      fetchInactiveUsers();
      fetchAnalysis();
      onRefreshStats?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete users');
    } finally {
      setIsDeleting(false);
      setShowBulkConfirm(false);
    }
  };

  const handleSelectUser = (userId: number) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedUsers(checked ? inactiveUsers.map(u => u.user_id) : []);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-4 h-4 text-purple-600" />;
      case 'instructor':
        return <BookOpen className="w-4 h-4 text-blue-600" />;
      case 'student':
        return <GraduationCap className="w-4 h-4 text-green-600" />;
      default:
        return <Users className="w-4 h-4 text-gray-600" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-800';
      case 'instructor':
        return 'bg-blue-100 text-blue-800';
      case 'student':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getDaysInactiveColor = (days: number) => {
    if (days >= 30) return 'text-red-600 bg-red-50';
    if (days >= 14) return 'text-orange-600 bg-orange-50';
    return 'text-yellow-600 bg-yellow-50';
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Analysis Summary Cards */}
      {analysis && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">7+ Days Inactive</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {analysis.inactivity_rates?.['7_days']?.count || 0}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {(analysis.inactivity_rates?.['7_days']?.rate || 0).toFixed(1)}% of users
                </p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">14+ Days Inactive</p>
                <p className="text-2xl font-bold text-orange-600">
                  {analysis.inactivity_rates?.['14_days']?.count || 0}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {(analysis.inactivity_rates?.['14_days']?.rate || 0).toFixed(1)}% of users
                </p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">30+ Days Inactive</p>
                <p className="text-2xl font-bold text-red-600">
                  {analysis.inactivity_rates?.['30_days']?.count || 0}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {(analysis.inactivity_rates?.['30_days']?.rate || 0).toFixed(1)}% of users
                </p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <UserX className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Active Users</p>
                <p className="text-2xl font-bold text-brand">
                  {analysis.total_active_users || 0}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Across all roles
                </p>
              </div>
              <div className="p-3 bg-brand/10 rounded-lg">
                <Users className="w-6 h-6 text-brand" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {analysis?.recommendations && analysis.recommendations.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-600" />
            Recommendations
          </h3>
          <div className="space-y-3">
            {analysis.recommendations.map((rec: any, index: number) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${
                  rec.type === 'urgent'
                    ? 'bg-red-50 border-red-200'
                    : rec.type === 'warning'
                    ? 'bg-orange-50 border-orange-200'
                    : 'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  {rec.type === 'urgent' ? (
                    <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  ) : rec.type === 'warning' ? (
                    <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
                  ) : (
                    <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                  )}
                  <div>
                    <p className="font-medium text-gray-900">{rec.title}</p>
                    <p className="text-sm text-gray-600 mt-1">{rec.message}</p>
                    <p className="text-sm font-medium text-gray-700 mt-2">
                      Action: {rec.action}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Inactive for:</label>
            <select
              value={thresholdDays}
              onChange={(e) => setThresholdDays(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
            >
              <option value={7}>7+ days</option>
              <option value={14}>14+ days</option>
              <option value={30}>30+ days</option>
              <option value={60}>60+ days</option>
              <option value={90}>90+ days</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Role:</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
            >
              <option value="">All Roles</option>
              <option value="student">Students</option>
              <option value="instructor">Instructors</option>
              <option value="admin">Admins</option>
            </select>
          </div>

          <button
            onClick={() => fetchInactiveUsers()}
            className="ml-auto flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedUsers.length > 0 && (
        <div className="bg-brand text-white rounded-xl shadow-lg p-4 flex items-center justify-between sticky top-4 z-10">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium">
              {selectedUsers.length} user{selectedUsers.length > 1 ? 's' : ''} selected
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedUsers([])}
              className="px-4 py-2 text-sm bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
            >
              Clear Selection
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <UserX className="w-5 h-5 text-orange-600" />
            Inactive Users ({inactiveUsers.length})
          </h3>
          {inactiveUsers.length > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedUsers.length === inactiveUsers.length}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand"
              />
              Select All
            </label>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        ) : inactiveUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="w-12 h-12 text-green-500 mb-4" />
            <p className="text-gray-600 font-medium">No inactive users found</p>
            <p className="text-sm text-gray-500 mt-1">
              All users have been active within the last {thresholdDays} days
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Days Inactive
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Activity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Details
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {inactiveUsers.map((user) => (
                  <tr key={user.user_id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.user_id)}
                        onChange={() => handleSelectUser(user.user_id)}
                        className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center text-brand font-semibold">
                          {user.first_name?.[0] || user.username[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {user.first_name && user.last_name
                              ? `${user.first_name} ${user.last_name}`
                              : user.username}
                          </p>
                          <p className="text-sm text-gray-500 flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                        {getRoleIcon(user.role)}
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${getDaysInactiveColor(user.days_inactive)}`}>
                        <Clock className="w-4 h-4" />
                        {user.days_inactive} days
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm">
                        <p className="text-gray-900 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          {formatDate(user.last_activity)}
                        </p>
                        <p className="text-gray-500 text-xs mt-1">
                          Last login: {formatDate(user.last_login)}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-xs text-gray-600 space-y-1">
                        {user.role === 'student' && user.role_data && (
                          <>
                            <p>📚 {user.role_data.enrollments_count || 0} enrollments</p>
                            <p>✅ {user.role_data.lessons_completed || 0} lessons done</p>
                          </>
                        )}
                        {user.role === 'instructor' && user.role_data && (
                          <p>📖 {user.role_data.courses_created || 0} courses</p>
                        )}
                        <p className="text-gray-400">
                          Joined: {formatDate(user.created_at)}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={() => handleDeleteUser(user)}
                        disabled={isDeleting || user.role === 'admin'}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={user.role === 'admin' ? 'Cannot delete admin users' : 'Delete user'}
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm Delete Modal */}
      {showConfirmModal && userToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Confirm Deletion</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            
            <p className="text-gray-700 mb-4">
              Are you sure you want to delete user <strong>{userToDelete.username}</strong>?
            </p>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-sm">
              <p><strong>Email:</strong> {userToDelete.email}</p>
              <p><strong>Role:</strong> {userToDelete.role}</p>
              <p><strong>Days Inactive:</strong> {userToDelete.days_inactive}</p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setUserToDelete(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteUser}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete User
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirm Modal */}
      {showBulkConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Confirm Bulk Deletion</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete <strong>{selectedUsers.length}</strong> selected user{selectedUsers.length > 1 ? 's' : ''}?
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowBulkConfirm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmBulkDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete {selectedUsers.length} Users
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
