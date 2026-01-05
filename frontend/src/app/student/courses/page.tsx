'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function StudentCoursesRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect students to their learning dashboard instead of browse courses
    router.replace('/student/mylearning');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-gray-700 mb-2">Redirecting...</h1>
        <p className="text-gray-500">Taking you to your learning dashboard</p>
      </div>
    </div>
  );
}
