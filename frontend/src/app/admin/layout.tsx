'use client';

import { AdminGuard } from '@/components/guards/admin-guard';
import AdminSidebar from '@/components/admin/AdminSidebar';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminGuard>
      <div className="flex min-h-screen bg-gray-100">
        <AdminSidebar />
        <main className="flex-1 p-6 md:p-10">
          {children}
        </main>
      </div>
    </AdminGuard>
  );
}