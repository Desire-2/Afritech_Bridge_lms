'use client';

import { useAuth } from '@/lib/auth';
import { hasRole, isSuperAdmin } from '@/lib/api';
import ManagementDashboard from '@/components/dashboards/ManagementDashboard';
import AgentDashboard from '@/components/dashboards/AgentDashboard';
import InstructorDashboard from '@/components/dashboards/InstructorDashboard';
import SecretaryDashboard from '@/components/dashboards/SecretaryDashboard';

export default function DashboardPage() {
  const { user } = useAuth();

  const isSuper = isSuperAdmin(user);
  const isInstructor = hasRole(user, 'instructor') && !isSuper && !hasRole(user, 'manager');
  const isAgent = hasRole(user, 'service_agent') && !isSuper;
  // A Company Secretary must never land on ManagementDashboard: that view is
  // built around financial KPIs this role has no permission to read.
  const isSecretary = hasRole(user, 'company_secretary') && !isSuper && !hasRole(user, 'manager');

  if (isInstructor) return <InstructorDashboard />;
  if (isAgent) return <AgentDashboard />;
  if (isSecretary) return <SecretaryDashboard />;
  return <ManagementDashboard />;
}