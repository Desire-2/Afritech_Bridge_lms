'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useOpportunities } from '@/hooks/use-opportunities';
import { usePagination } from '@/hooks/use-api';
import ProtectedLayout from "@/app/dashboard/layout";

// Basic UI components (replace with your actual UI library, e.g., shadcn/ui)
const OpportunityCard: React.FC<{ opportunity: any }> = ({ opportunity }) => (
  <div className="bg-white shadow overflow-hidden sm:rounded-lg">
    <div className="px-4 py-5 sm:px-6">
      <h3 className="text-lg leading-6 font-medium text-gray-900">
        <Link href={`/opportunities/${opportunity.id}`} className="hover:text-indigo-600">
          {opportunity.title}
        </Link>
      </h3>
      <p className="mt-1 max-w-2xl text-sm text-gray-500">
        {opportunity.organization && `${opportunity.organization} - `}{opportunity.location || 'Remote'}
      </p>
      {opportunity.opportunity_type && (
        <span className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {opportunity.opportunity_type}
        </span>
      )}
    </div>
    <div className="border-t border-gray-200 px-4 py-4 sm:px-6">
      <p className="text-sm text-gray-700 line-clamp-3">{opportunity.description}</p>
      <div className="mt-4">
        <Link href={`/opportunities/${opportunity.id}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
          View Details &rarr;
        </Link>
      </div>
    </div>
  </div>
);

const OpportunitiesPage: React.FC = () => {
  const [selectedType, setSelectedType] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const { page, perPage, goToPage, changePerPage } = usePagination(1, 12);
  
  const { 
    opportunities, 
    pagination, 
    loading, 
    error 
  } = useOpportunities({
    page,
    per_page: perPage,
    opportunity_type: selectedType || undefined,
    search: searchQuery || undefined,
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-red-600">
        <p>Error: {error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-md p-4 max-w-md mx-auto">
          <p className="text-red-800 dark:text-red-200">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedLayout>
      <div className="bg-gray-100 dark:bg-gray-900 min-h-screen">
        <main className="py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white sm:text-5xl sm:tracking-tight lg:text-6xl">
                Global Opportunities
              </h1>
              <p className="mt-5 max-w-xl mx-auto text-xl text-gray-500 dark:text-gray-400">
                Connect with internships, jobs, scholarships, and other opportunities for innovators.
              </p>
            </div>

            {/* Filters and Search */}
            <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="search" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Search Opportunities
                  </label>
                  <input
                    type="text"
                    id="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by title, organization..."
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Opportunity Type
                  </label>
                  <select
                    id="type"
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">All Types</option>
                    <option value="scholarship">Scholarship</option>
                    <option value="internship">Internship</option>
                    <option value="job">Job</option>
                    <option value="fellowship">Fellowship</option>
                    <option value="grant">Grant</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="perPage" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Per Page
                  </label>
                  <select
                    id="perPage"
                    value={perPage}
                    onChange={(e) => changePerPage(Number(e.target.value))}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value={6}>6</option>
                    <option value={12}>12</option>
                    <option value={24}>24</option>
                  </select>
                </div>
              </div>
            </div>

            {opportunities.length === 0 ? (
              <div className="mt-12 text-center">
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  No opportunities available at the moment. Please check back later.
                </p>
              </div>
            ) : (
              <>
                <div className="mt-12 max-w-lg mx-auto grid gap-5 lg:grid-cols-3 lg:max-w-none">
                  {opportunities.map((opportunity) => (
                    <OpportunityCard key={opportunity.id} opportunity={opportunity} />
                  ))}
                </div>

                {/* Pagination */}
                {pagination && pagination.total_pages > 1 && (
                  <div className="mt-8 flex items-center justify-between">
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      Showing {((pagination.page - 1) * pagination.per_page) + 1} to{' '}
                      {Math.min(pagination.page * pagination.per_page, pagination.total)} of{' '}
                      {pagination.total} results
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => goToPage(pagination.page - 1)}
                        disabled={pagination.page <= 1}
                        className="px-3 py-1 text-sm bg-white dark:bg-gray-800 border rounded disabled:opacity-50"
                      >
                        Previous
                      </button>
                      {Array.from({ length: pagination.total_pages }, (_, i) => i + 1).map(pageNum => (
                        <button
                          key={pageNum}
                          onClick={() => goToPage(pageNum)}
                          className={`px-3 py-1 text-sm border rounded ${
                            pageNum === pagination.page 
                              ? 'bg-indigo-600 text-white' 
                              : 'bg-white dark:bg-gray-800'
                          }`}
                        >
                          {pageNum}
                        </button>
                      ))}
                      <button
                        onClick={() => goToPage(pagination.page + 1)}
                        disabled={pagination.page >= pagination.total_pages}
                        className="px-3 py-1 text-sm bg-white dark:bg-gray-800 border rounded disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </ProtectedLayout>
  );
};

export default OpportunitiesPage;

