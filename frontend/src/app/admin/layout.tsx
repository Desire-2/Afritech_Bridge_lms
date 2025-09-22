"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.isLoading) return; // Wait for auth state to load

    if (!auth.isAuthenticated) {
      router.push('/auth/login?message=Please login to access the admin panel.');
      return;
    }
    // Assuming user object has a 'role' property
    if (auth.user?.role !== 'admin') {
      router.push('/dashboard?message=You are not authorized to access the admin panel.'); // Redirect to a general dashboard or home
    }
  }, [auth, router]);

  if (auth.isLoading || !auth.isAuthenticated || auth.user?.role !== 'admin') {
    // Show a loading state or a minimal layout while checking auth/redirecting
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p className="text-lg text-gray-600">Loading admin panel...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <AdminSidebar />
      <main className="flex-1 p-6 md:p-10">
        {children}
      </main>
    </div>
  );
}

