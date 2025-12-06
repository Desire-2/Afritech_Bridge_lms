'use client';

import React, { useState } from 'react';
import OpportunityListTable from '@/components/admin/OpportunityManagement/OpportunityListTable';
import { Opportunity } from '@/types/api';
import Link from 'next/link';

export default function OpportunitiesPage() {
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);

  return (
    <>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 -mx-6 -mt-6 mb-6 px-6 py-4 md:-mx-10 md:-mt-10 md:mb-6 md:px-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Opportunity Management</h1>
            <p className="text-gray-600 mt-1">Manage job and internship opportunities</p>
          </div>
          <Link
            href="/admin/opportunities/create"
            className="bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            + Create Opportunity
          </Link>
        </div>
      </div>

      {/* Content */}
      <OpportunityListTable
        onSelectOpportunity={(opportunity) => {
          setSelectedOpportunity(opportunity);
        }}
      />
    </>
  );
}