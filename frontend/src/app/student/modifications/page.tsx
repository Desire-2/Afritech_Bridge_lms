"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { StudentModificationRequests } from '@/components/student/ModificationRequests';

const StudentModificationsPage = () => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Access Denied
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Please log in to view modification requests.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Modification Requests
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Review instructor feedback and resubmit your assignments
          </p>
        </div>

        <StudentModificationRequests />
      </div>
    </div>
  );
};

export default StudentModificationsPage;