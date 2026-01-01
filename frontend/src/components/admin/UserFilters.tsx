import React from 'react';

interface UserFiltersProps {
  filters: {
    role: string;
    search: string;
    status: string;
    sort_by: string;
    sort_order: string;
  };
  onFilterChange: (filters: any) => void;
}

const UserFilters: React.FC<UserFiltersProps> = ({ filters, onFilterChange }) => {
  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Search */}
        <div className="lg:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search
          </label>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onFilterChange({ search: e.target.value })}
            placeholder="Search by name, email, username..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Role Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Role
          </label>
          <select
            value={filters.role}
            onChange={(e) => onFilterChange({ role: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Roles</option>
            <option value="student">Student</option>
            <option value="instructor">Instructor</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Status
          </label>
          <select
            value={filters.status}
            onChange={(e) => onFilterChange({ status: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* Sort By */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sort By
          </label>
          <select
            value={filters.sort_by}
            onChange={(e) => onFilterChange({ sort_by: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="created_at">Created Date</option>
            <option value="username">Username</option>
            <option value="email">Email</option>
            <option value="role">Role</option>
          </select>
        </div>
      </div>

      {/* Sort Order and Clear */}
      <div className="flex items-center gap-4 mt-4">
        <button
          onClick={() => onFilterChange({ 
            sort_order: filters.sort_order === 'asc' ? 'desc' : 'asc' 
          })}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
        >
          {filters.sort_order === 'asc' ? '↑ Ascending' : '↓ Descending'}
        </button>
        
        <button
          onClick={() => onFilterChange({
            role: '',
            search: '',
            status: '',
            sort_by: 'created_at',
            sort_order: 'desc'
          })}
          className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-medium transition-colors"
        >
          Clear Filters
        </button>
      </div>
    </div>
  );
};

export default UserFilters;
