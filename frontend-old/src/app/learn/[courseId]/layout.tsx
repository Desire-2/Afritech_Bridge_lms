'use client';
import React, { ReactNode } from 'react';
import CourseNavigationSidebar from '@/components/learn/CourseNavigationSidebar'; // Assuming this component will be created

interface LearnLayoutProps {
  children: ReactNode;
  params: { courseId: string }; // To pass courseId to the sidebar
}

const LearnLayout: React.FC<LearnLayoutProps> = ({ children, params }) => {
  const courseId = params.courseId;

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Minimal Header for Learning Interface - can be expanded */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="text-xl font-semibold text-gray-800">
            {/* Course Title can be fetched and displayed here */}
            Afritec Bridge LMS
          </div>
          <div>
            {/* User Profile/Logout or Back to Dashboard Link */}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <CourseNavigationSidebar courseId={courseId} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default LearnLayout;

