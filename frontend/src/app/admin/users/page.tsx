'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AdminService } from '@/services/admin.service';
import { User } from '@/types/api';
import UserManagementTable from '@/components/admin/UserManagementTable';
import UserFilters from '@/components/admin/UserFilters';
import UserStatsCards from '@/components/admin/UserStatsCards';
import CreateUserModal from '@/components/admin/CreateUserModal';
import EditUserModal from '@/components/admin/EditUserModal';
import UserDetailsModal from '@/components/admin/UserDetailsModal';
import BulkActionsBar from '@/components/admin/BulkActionsBar';
import InactiveUsersManagement from '@/components/admin/InactiveUsersManagement';
import { toast } from 'sonner';
import { RefreshCw, Download, Plus, Upload, Users, UserX } from 'lucide-react';

// Debounce hook for search
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

type TabType = 'all-users' | 'inactive-users';

export default function UserManagementPage() {
  const [activeTab, setActiveTab] = useState<TabType>('all-users');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pagination, setPagination] = useState({
    current_page: 1,
    per_page: 20,
    total_pages: 1,
    total_items: 0,
    has_next: false,
    has_prev: false
  });
  
  const [filters, setFilters] = useState({
    role: '',
    search: '',
    status: '',
    sort_by: 'created_at',
    sort_order: 'desc' as 'asc' | 'desc'
  });
  
  // Debounce search to avoid too many API calls
  const debouncedSearch = useDebounce(filters.search, 300);
  
  const [stats, setStats] = useState<any>(null);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Track if this is the initial load
  const initialLoadRef = useRef(true);

  // Fetch users - with debounced search
  useEffect(() => {
    // Skip the initial fetch if search is still empty and we haven't loaded yet
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      fetchUsers();
    } else {
      fetchUsers();
    }
  }, [pagination.current_page, filters.role, filters.status, filters.sort_by, filters.sort_order, debouncedSearch, refreshTrigger]);

  // Fetch user statistics
  useEffect(() => {
    fetchStats();
  }, [refreshTrigger]);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await AdminService.getAllUsers({
        page: pagination.current_page,
        per_page: pagination.per_page,
        role: filters.role || undefined,
        search: debouncedSearch || undefined,
        status: filters.status || undefined,
        sort_by: filters.sort_by,
        sort_order: filters.sort_order
      });
      
      setUsers(response.users || []);
      setPagination(prev => ({
        ...prev,
        ...response.pagination
      }));
    } catch (error: any) {
      toast.error(error.message || 'Failed to load users');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [pagination.current_page, pagination.per_page, filters.role, filters.status, filters.sort_by, filters.sort_order, debouncedSearch]);

  const fetchStats = async () => {
    try {
      const statsData = await AdminService.getUserStats();
      setStats(statsData);
    } catch (error: any) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleFilterChange = (newFilters: any) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    // Reset to page 1 when filters change (except for sort changes)
    if (!('sort_by' in newFilters && Object.keys(newFilters).length === 1) &&
        !('sort_order' in newFilters && Object.keys(newFilters).length === 1)) {
      setPagination(prev => ({ ...prev, current_page: 1 }));
    }
  };

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, current_page: page }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshTrigger(prev => prev + 1);
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
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    
    try {
      await AdminService.deleteUser(userId);
      setRefreshTrigger(prev => prev + 1);
      toast.success('User deleted successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete user');
    }
  };

  // Quick action for activate/deactivate single user
  const handleQuickAction = async (userId: number, action: 'activate' | 'deactivate') => {
    try {
      await AdminService.bulkUserAction({
        user_ids: [userId],
        action
      });
      setRefreshTrigger(prev => prev + 1);
      toast.success(`User ${action}d successfully`);
    } catch (error: any) {
      toast.error(error.message || `Failed to ${action} user`);
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

  if (loading && users.length === 0 && activeTab === 'all-users') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
            <p className="text-gray-600 mt-1">
              Manage and monitor all system users
              {activeTab === 'all-users' && pagination.total_items > 0 && (
                <span className="ml-2 text-sm text-gray-500">
                  ({pagination.total_items} total users)
                </span>
              )}
            </p>
          </div>
          {activeTab === 'all-users' && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <div className="relative group">
                <button
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors"
                  onClick={() => handleExportUsers('csv')}
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
                <div className="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                  <button
                    onClick={() => handleExportUsers('csv')}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-100 text-sm rounded-t-lg"
                  >
                    📊 Export CSV
                  </button>
                  <button
                    onClick={() => handleExportUsers('json')}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-100 text-sm rounded-b-lg"
                  >
                    📋 Export JSON
                  </button>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-brand hover:bg-brand-light text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create User
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex gap-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('all-users')}
              className={`group inline-flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'all-users'
                  ? 'border-brand text-brand'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Users className={`w-5 h-5 ${activeTab === 'all-users' ? 'text-brand' : 'text-gray-400 group-hover:text-gray-500'}`} />
              All Users
              {pagination.total_items > 0 && (
                <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                  activeTab === 'all-users'
                    ? 'bg-brand/10 text-brand'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {pagination.total_items}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('inactive-users')}
              className={`group inline-flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'inactive-users'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <UserX className={`w-5 h-5 ${activeTab === 'inactive-users' ? 'text-orange-500' : 'text-gray-400 group-hover:text-gray-500'}`} />
              Inactive Users
              <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                activeTab === 'inactive-users'
                  ? 'bg-orange-100 text-orange-600'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                14+ days
              </span>
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'all-users' ? (
          <>
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
              onQuickAction={handleQuickAction}
            />
          </>
        ) : (
          <InactiveUsersManagement 
            onRefreshStats={() => {
              fetchStats();
              setRefreshTrigger(prev => prev + 1);
            }} 
          />
        )}

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
