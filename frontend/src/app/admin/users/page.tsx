'use client';

import React, { useState, useEffect } from 'react';
import { AdminService } from '@/services/admin.service';
import { User } from '@/types/api';
import UserManagementTable from '@/components/admin/UserManagementTable';
import UserFilters from '@/components/admin/UserFilters';
import UserStatsCards from '@/components/admin/UserStatsCards';
import CreateUserModal from '@/components/admin/CreateUserModal';
import EditUserModal from '@/components/admin/EditUserModal';
import UserDetailsModal from '@/components/admin/UserDetailsModal';
import BulkActionsBar from '@/components/admin/BulkActionsBar';
import { toast } from 'sonner';

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<any>({
    current_page: 1,
    per_page: 20,
    total_pages: 1,
    total_items: 0
  });
  
  const [filters, setFilters] = useState({
    role: '',
    search: '',
    status: '',
    sort_by: 'created_at',
    sort_order: 'desc'
  });
  
  const [stats, setStats] = useState<any>(null);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch users
  useEffect(() => {
    fetchUsers();
  }, [pagination.current_page, filters, refreshTrigger]);

  // Fetch user statistics
  useEffect(() => {
    fetchStats();
  }, [refreshTrigger]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await AdminService.getAllUsers({
        page: pagination.current_page,
        per_page: pagination.per_page,
        ...filters
      });
      
      setUsers(response.users || []);
      setPagination(response.pagination || pagination);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const statsData = await AdminService.getUserStats();
      setStats(statsData);
    } catch (error: any) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleFilterChange = (newFilters: any) => {
    setFilters({ ...filters, ...newFilters });
    setPagination({ ...pagination, current_page: 1 });
  };

  const handlePageChange = (page: number) => {
    setPagination({ ...pagination, current_page: page });
  };

  const handleUserCreated = () => {
    setShowCreateModal(false);
    setRefreshTrigger(prev => prev + 1);
    toast.success('User created successfully');
  };

  const handleUserUpdated = () => {
    setEditingUser(null);
    setRefreshTrigger(prev => prev + 1);
    toast.success('User updated successfully');
  };

  const handleUserDeleted = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
      await AdminService.deleteUser(userId);
      setRefreshTrigger(prev => prev + 1);
      toast.success('User deleted successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete user');
    }
  };

  const handleBulkAction = async (action: string, data?: any) => {
    if (selectedUsers.length === 0) {
      toast.error('No users selected');
      return;
    }

    try {
      const response = await AdminService.bulkUserAction({
        user_ids: selectedUsers,
        action,
        ...data
      });
      
      setSelectedUsers([]);
      setRefreshTrigger(prev => prev + 1);
      
      // Show detailed success message
      const affectedCount = response.affected_users;
      const userWord = affectedCount === 1 ? 'user' : 'users';
      
      let message = '';
      switch (action) {
        case 'activate':
          message = `${affectedCount} ${userWord} activated successfully`;
          break;
        case 'deactivate':
          message = `${affectedCount} ${userWord} deactivated successfully`;
          break;
        case 'delete':
          message = `${affectedCount} ${userWord} deleted successfully`;
          break;
        case 'change_role':
          message = `${affectedCount} ${userWord} role changed to ${data.role_name}`;
          break;
        default:
          message = `Bulk action completed successfully for ${affectedCount} ${userWord}`;
      }
      
      // Show warnings if any
      if (response.warnings && response.warnings.length > 0) {
        toast.warning(message, {
          description: response.warnings.join('. ')
        });
      } else {
        toast.success(message);
      }
      
      // Log errors if any (partial success)
      if (response.errors && response.errors.length > 0) {
        console.error('Bulk action errors:', response.errors);
      }
    } catch (error: any) {
      // Detailed error handling
      const errorMessage = error.message || 'Bulk action failed';
      const details = error.details;
      
      if (details && Array.isArray(details)) {
        toast.error(errorMessage, {
          description: details.slice(0, 3).join(', ') + (details.length > 3 ? '...' : '')
        });
      } else {
        toast.error(errorMessage);
      }
    }
  };

  const handleExportUsers = async (format: 'csv' | 'json' = 'csv') => {
    try {
      const blob = await AdminService.exportUsers({
        ...filters,
        format
      });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `users_export_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success(`Users exported as ${format.toUpperCase()} successfully`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to export users');
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
    setSelectedUsers(checked ? users.map(u => u.id) : []);
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
            <p className="text-gray-600 mt-1">Manage and monitor all system users</p>
          </div>
          <div className="flex gap-2">
            <div className="relative group">
              <button
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors"
                onClick={() => handleExportUsers('csv')}
              >
                <span>📥</span>
                Export
              </button>
              <div className="absolute right-0 mt-1 w-32 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                <button
                  onClick={() => handleExportUsers('csv')}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
                >
                  Export CSV
                </button>
                <button
                  onClick={() => handleExportUsers('json')}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
                >
                  Export JSON
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              <span className="text-xl">+</span>
              Create User
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        {stats && <UserStatsCards stats={stats} />}

        {/* Filters */}
        <UserFilters filters={filters} onFilterChange={handleFilterChange} />

        {/* Bulk Actions Bar */}
        {selectedUsers.length > 0 && (
          <BulkActionsBar
            selectedCount={selectedUsers.length}
            onBulkAction={handleBulkAction}
            onClearSelection={() => setSelectedUsers([])}
          />
        )}

        {/* Users Table */}
        <UserManagementTable
          users={users}
          loading={loading}
          selectedUsers={selectedUsers}
          onSelectUser={handleSelectUser}
          onSelectAll={handleSelectAll}
          onEdit={setEditingUser}
          onDelete={handleUserDeleted}
          onView={setViewingUser}
          pagination={pagination}
          onPageChange={handlePageChange}
        />

        {/* Modals */}
        {showCreateModal && (
          <CreateUserModal
            onClose={() => setShowCreateModal(false)}
            onSuccess={handleUserCreated}
          />
        )}

        {editingUser && (
          <EditUserModal
            user={editingUser}
            onClose={() => setEditingUser(null)}
            onSuccess={handleUserUpdated}
          />
        )}

        {viewingUser && (
          <UserDetailsModal
            user={viewingUser}
            onClose={() => setViewingUser(null)}
            onEdit={() => {
              setEditingUser(viewingUser);
              setViewingUser(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
