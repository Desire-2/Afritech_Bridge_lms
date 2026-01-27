'use client';

import React, { useState } from 'react';
import { Search, Filter, X, ChevronDown, ChevronUp, Calendar } from 'lucide-react';

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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const hasActiveFilters = filters.role || filters.status || dateFrom || dateTo;

  const handleClearFilters = () => {
    onFilterChange({
      role: '',
      search: '',
      status: '',
      sort_by: 'created_at',
      sort_order: 'desc'
    });
    setDateFrom('');
    setDateTo('');
  };

  const handleDateChange = (type: 'from' | 'to', value: string) => {
    if (type === 'from') {
      setDateFrom(value);
      onFilterChange({ date_from: value || undefined });
    } else {
      setDateTo(value);
      onFilterChange({ date_to: value || undefined });
    }
  };

  return (
    <div className="bg-white rounded-lg shadow mb-6">
      {/* Main Filters Row */}
      <div className="p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search - Takes more space */}
          <div className="flex-1 min-w-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => onFilterChange({ search: e.target.value })}
                placeholder="Search by name, email, or username..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {filters.search && (
                <button
                  onClick={() => onFilterChange({ search: '' })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap gap-2">
            {/* Role Filter */}
            <select
              value={filters.role}
              onChange={(e) => onFilterChange({ role: e.target.value })}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white min-w-[140px]"
            >
              <option value="">All Roles</option>
              <option value="student">🎓 Student</option>
              <option value="instructor">👨‍🏫 Instructor</option>
              <option value="admin">👑 Admin</option>
            </select>

            {/* Status Filter */}
            <select
              value={filters.status}
              onChange={(e) => onFilterChange({ status: e.target.value })}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white min-w-[140px]"
            >
              <option value="">All Status</option>
              <option value="active">✅ Active</option>
              <option value="inactive">⏸️ Inactive</option>
            </select>

            {/* Sort By */}
            <select
              value={filters.sort_by}
              onChange={(e) => onFilterChange({ sort_by: e.target.value })}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white min-w-[150px]"
            >
              <option value="created_at">Created Date</option>
              <option value="username">Username</option>
              <option value="email">Email</option>
              <option value="role">Role</option>
            </select>

            {/* Sort Order Toggle */}
            <button
              onClick={() => onFilterChange({ 
                sort_order: filters.sort_order === 'asc' ? 'desc' : 'asc' 
              })}
              className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors flex items-center gap-2"
              title={filters.sort_order === 'asc' ? 'Ascending' : 'Descending'}
            >
              {filters.sort_order === 'asc' ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  A-Z
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Z-A
                </>
              )}
            </button>

            {/* Advanced Filters Toggle */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                showAdvanced || hasActiveFilters
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {hasActiveFilters && (
                <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {[filters.role, filters.status, dateFrom, dateTo].filter(Boolean).length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showAdvanced && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-100">
          <div className="flex flex-wrap items-end gap-4">
            {/* Date Range */}
            <div className="flex items-center gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Created From</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => handleDateChange('from', e.target.value)}
                    className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>
              <span className="text-gray-400 pb-2">to</span>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Created To</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => handleDateChange('to', e.target.value)}
                    className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Clear All Filters
              </button>
            )}
          </div>

          {/* Active Filters Tags */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 mt-3">
              {filters.role && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                  Role: {filters.role}
                  <button onClick={() => onFilterChange({ role: '' })} className="hover:text-blue-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {filters.status && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                  Status: {filters.status}
                  <button onClick={() => onFilterChange({ status: '' })} className="hover:text-green-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {dateFrom && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                  From: {dateFrom}
                  <button onClick={() => handleDateChange('from', '')} className="hover:text-purple-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {dateTo && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                  To: {dateTo}
                  <button onClick={() => handleDateChange('to', '')} className="hover:text-purple-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UserFilters;
