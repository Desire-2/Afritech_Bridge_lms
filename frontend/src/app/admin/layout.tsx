'use client';

import { AdminGuard } from '@/components/guards/AdminGuard';
import AdminSidebar from '@/components/admin/AdminSidebar';
import NotificationBell from '@/components/notifications/NotificationBell';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminGuard>
      <div className="min-h-screen bg-gray-100">
        <AdminSidebar />
        <main className="ml-0 md:ml-64 p-6 md:p-10 min-h-screen">
          {/* Top-right notification bell */}
          <div className="flex justify-end mb-4">
            <NotificationBell />
          </div>
          {children}
        </main>
      </div>
    </AdminGuard>
  );
}