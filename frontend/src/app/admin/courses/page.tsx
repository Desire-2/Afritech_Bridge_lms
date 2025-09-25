'use client';

import React from 'react';
import { AdminGuard } from '@/components/guards/admin-guard';

export default function AdminCoursesPage() {
  return (
    <AdminGuard>
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-6">Course Management</h1>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="text-lg">
            Course management functionality is being implemented. Check back soon!
          </p>
        </div>
      </div>
    </AdminGuard>
  );
}
