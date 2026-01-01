import { Metadata } from 'next';
import AdminApplicationsManager from '@/components/applications/AdminApplicationsManager';

export const metadata: Metadata = {
  title: 'Course Applications | Admin Dashboard',
  description: 'Manage and review course applications',
};

export default function AdminApplicationsPage() {
  return (
    <div className="container mx-auto py-8">
      <AdminApplicationsManager />
    </div>
  );
}
