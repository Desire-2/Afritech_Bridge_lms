'use client';

import NotificationCenter from '@/components/notifications/NotificationCenter';

export default function InstructorNotificationsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <NotificationCenter basePath="/instructor" />
    </div>
  );
}
