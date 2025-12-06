'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';

// Lazy load the analytics dashboard for better performance
const AnalyticsDashboard = dynamic(
  () => import('@/components/admin/AnalyticsDashboard'),
  {
    loading: () => (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-600"></div>
      </div>
    ),
  }
);

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="text-gray-600">Loading...</div></div>}>
      <AnalyticsDashboard />
    </Suspense>
  );
}

