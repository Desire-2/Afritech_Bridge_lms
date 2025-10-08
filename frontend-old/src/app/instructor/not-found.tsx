'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { InstructorGuard } from '@/components/guards/instructor-guard';

export default function InstructorNotFound() {
  useEffect(() => {
    console.log('Instructor section 404 error occurred');
  }, []);

  return (
    <InstructorGuard>
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center">
        <div className="w-24 h-24 mb-6 rounded-full bg-blue-500/20 flex items-center justify-center">
          <span className="text-5xl">🧭</span>
        </div>
        <h1 className="text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-600">404</h1>
        <h2 className="mt-4 text-3xl font-medium text-slate-800 dark:text-white">Page Not Found</h2>
        <p className="mt-4 text-lg text-slate-600 dark:text-slate-300 max-w-md">
          The instructor page you're looking for doesn't exist or may have been moved.
        </p>
        <div className="mt-8 flex gap-4">
          <Link 
            href="/instructor/dashboard" 
            className="px-6 py-3 text-base font-medium text-white transition-colors bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 rounded-lg shadow-lg"
          >
            Return to Instructor Dashboard
          </Link>
        </div>
      </div>
    </InstructorGuard>
  );
}