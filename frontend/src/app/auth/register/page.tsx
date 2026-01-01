'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function RegisterPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Registration is disabled - redirect to application page
    router.replace('/courses');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Registration Not Available</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Please apply for a course. User accounts are created automatically upon application approval.
        </p>
      </div>
    </div>
  );
}