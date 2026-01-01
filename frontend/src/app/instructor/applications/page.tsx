import { Metadata } from 'next';
import InstructorApplicationsManager from '@/components/applications/InstructorApplicationsManager';

export const metadata: Metadata = {
  title: 'Course Applications | Instructor Dashboard',
  description: 'Manage applications for your courses',
};

export default function InstructorApplicationsPage() {
  return (
    <div className="container mx-auto py-8">
      <InstructorApplicationsManager />
    </div>
  );
}
