"use client";

import React from 'react';
import { StudentGuard } from '@/components/guards/student-guard';
import StudentSidebar from '@/components/student/StudentSidebar';

interface StudentLayoutProps {
  children: React.ReactNode;
}

const StudentLayout: React.FC<StudentLayoutProps> = ({ children }) => {
  return (
    <StudentGuard>
      <div className="flex min-h-screen bg-gray-100">
        <StudentSidebar />
        <main className="flex-1 overflow-x-hidden">
          {children}
        </main>
      </div>
    </StudentGuard>
  );
};

export default StudentLayout;