'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function InstructorIndexPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the instructor dashboard with correct case
    router.push('/instructor/Dashboard');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-lg">Redirecting to instructor dashboard...</p>
      </div>
    </div>
  );
}