'use client';
import { StudentGuard } from '@/components/guards/student-guard';
import StudentSidebar from '@/components/student/StudentSidebar';
import { ClientOnly } from '@/lib/hydration-helper';

export default function OpportunitiesLayout({ children }: { children: React.ReactNode }) {
  return (
    <StudentGuard>
      <ClientOnly>
        <div className="flex min-h-screen bg-gray-50" suppressHydrationWarning>
          <StudentSidebar />
          <main className="flex-1 p-6 md:p-8 lg:p-10">
            {children}
          </main>
        </div>
      </ClientOnly>
    </StudentGuard>
  );
}