'use client';

import { useAuth } from '@/lib/auth';
import { can, hasRole, isSuperAdmin } from '@/lib/api';
import { P } from '@/lib/permissions';
import AdminDashboard from '@/components/dashboards/AdminDashboard';
import ManagerDashboard from '@/components/dashboards/ManagerDashboard';
import AgentDashboard from '@/components/dashboards/AgentDashboard';
import InstructorDashboard from '@/components/dashboards/InstructorDashboard';
import SecretaryDashboard from '@/components/dashboards/SecretaryDashboard';
import ShopOverviewPage from '@/app/(app)/shop/page';
import AccessDenied from '@/components/AccessDenied';

export default function DashboardPage() {
  const { user } = useAuth();

  const isSuper = isSuperAdmin(user);
  const isManager = hasRole(user, 'manager') && !isSuper;
  const isInstructor = hasRole(user, 'instructor') && !isSuper && !hasRole(user, 'manager');
  const isAgent = hasRole(user, 'service_agent') && !isSuper;
  // A Company Secretary must never land on a financial management dashboard.
  const isSecretary = hasRole(user, 'company_secretary') && !isSuper && !hasRole(user, 'manager');
  const canReports = can(user, P.reportsView);
  const canShop = can(user, P.shopView);

  if (isInstructor) return <InstructorDashboard />;
  if (isAgent) return <AgentDashboard />;
  if (isSecretary) return <SecretaryDashboard />;
  if (isSuper) return <AdminDashboard />;
  if (isManager) return <ManagerDashboard />;
  if (canReports) return <AdminDashboard />;
  if (canShop) return <ShopOverviewPage />;
  return <AccessDenied title="No dashboard for this account" />;
}
