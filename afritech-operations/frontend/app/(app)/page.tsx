'use client';

import { useAuth } from '@/lib/auth';
import { hasRole, isSuperAdmin } from '@/lib/api';
import ManagementDashboard from '@/components/dashboards/ManagementDashboard';
import AgentDashboard from '@/components/dashboards/AgentDashboard';
import InstructorDashboard from '@/components/dashboards/InstructorDashboard';

export default function DashboardPage() {
  const { user } = useAuth();

  const isInstructor = hasRole(user, 'instructor') && !isSuperAdmin(user) && !hasRole(user, 'manager');
  const isAgent = hasRole(user, 'service_agent') && !isSuperAdmin(user);

  if (isInstructor) return <InstructorDashboard />;
  if (isAgent) return <AgentDashboard />;
  return <ManagementDashboard />;
}