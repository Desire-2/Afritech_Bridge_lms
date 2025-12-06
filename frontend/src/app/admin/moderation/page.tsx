'use client';

import React from 'react';
import dynamic from 'next/dynamic';

// Lazy load moderation panel for better performance
const ModerationPanel = dynamic(
  () => import('@/components/admin/ModerationPanel'),
  {
    loading: () => (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-600"></div>
      </div>
    ),
  }
);

export default function ModerationPage() {
  return <ModerationPanel />;
}