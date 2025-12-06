"use client";

import React, { useState, useEffect } from 'react';
import { Opportunity } from '@/types/api';

interface OpportunityListTableProps {
  onSelectOpportunity?: (opportunity: Opportunity) => void;
}

export const OpportunityListTable: React.FC<OpportunityListTableProps> = ({
  onSelectOpportunity,
}) => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    const fetchOpportunities = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/v1/admin/opportunities', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });
        const data = await response.json();
        setOpportunities(data);
      } catch (err: any) {
        setError('Failed to load opportunities');
      } finally {
        setLoading(false);
      }
    };

    fetchOpportunities();
  }, []);

  const filteredOpportunities = opportunities.filter((opportunity) => {
    const matchesSearch = opportunity.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = typeFilter === 'all' || opportunity.opportunity_type === typeFilter;
    return matchesSearch && matchesFilter;
  });

  const handleDeleteOpportunity = async (opportunityId: number, opportunityTitle: string) => {
    if (!window.confirm(`Are you sure you want to delete opportunity "${opportunityTitle}"?`)) {
      return;
    }

    try {
      await fetch(`/api/v1/admin/opportunities/${opportunityId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      setOpportunities(opportunities.filter(o => o.id !== opportunityId));
    } catch (err: any) {
      setError(`Failed to delete opportunity: ${err.message}`);
    }
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      scholarship: 'bg-purple-100 text-purple-800',
      internship: 'bg-blue-100 text-blue-800',
      job: 'bg-green-100 text-green-800',
      fellowship: 'bg-orange-100 text-orange-800',
      grant: 'bg-pink-100 text-pink-800',
      other: 'bg-gray-100 text-gray-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Search & Filter</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search by title
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter opportunity title..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="scholarship">Scholarship</option>
              <option value="internship">Internship</option>
              <option value="job">Job</option>
              <option value="fellowship">Fellowship</option>
              <option value="grant">Grant</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Opportunities Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">ID</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Title</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                  Organization
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Type</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Deadline</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  </td>
                </tr>
              ) : filteredOpportunities.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No opportunities found
                  </td>
                </tr>
              ) : (
                filteredOpportunities.map((opportunity) => (
                  <tr key={opportunity.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-700">{opportunity.id}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {opportunity.title}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {opportunity.organization || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${getTypeColor(opportunity.opportunity_type)}`}>
                        {opportunity.opportunity_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {opportunity.application_deadline
                        ? new Date(opportunity.application_deadline).toLocaleDateString()
                        : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm space-x-2">
                      <button
                        onClick={() => onSelectOpportunity?.(opportunity)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteOpportunity(opportunity.id, opportunity.title)}
                        className="text-red-600 hover:text-red-800 font-medium"
                      >
                        Delete
                      </button>
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

export default OpportunityListTable;
