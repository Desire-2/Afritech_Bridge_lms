"use client";

import React, { useContext, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import InstructorSidebar from '@/components/instructor/InstructorSidebar';
import { AuthContext } from '@/contexts/AuthContext';

export default function InstructorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authContext = useContext(AuthContext);
  const router = useRouter();

  useEffect(() => {
    if (authContext?.loading) return; // Wait for auth state to load

    if (!authContext?.isAuthenticated) {
      router.push('/auth/login?message=Please login to access the instructor panel.');
      return;
    }
    // Assuming user object has a 'role' property
    if (authContext.user?.role !== 'instructor' && authContext.user?.role !== 'admin') { // Admins might also access instructor panel
      router.push('/dashboard?message=You are not authorized to access the instructor panel.'); // Redirect to a general dashboard or home
    }
  }, [authContext, router]);

  if (authContext?.loading || !authContext?.isAuthenticated || (authContext.user?.role !== 'instructor' && authContext.user?.role !== 'admin')) {
    // Show a loading state or a minimal layout while checking auth/redirecting
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p className="text-lg text-gray-600">Loading instructor panel...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <InstructorSidebar />
      <main className="flex-1 p-6 md:p-10">
        {children}
      </main>
    </div>
  );
}

