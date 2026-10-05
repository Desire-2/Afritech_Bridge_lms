'use client';

import { useAuth } from '@/lib/auth';
import { can, hasRole, isSuperAdmin } from '@/lib/api';
import { P } from '@/lib/permissions';
import ManagementDashboard from '@/components/dashboards/ManagementDashboard';
import AgentDashboard from '@/components/dashboards/AgentDashboard';
import InstructorDashboard from '@/components/dashboards/InstructorDashboard';
import SecretaryDashboard from '@/components/dashboards/SecretaryDashboard';
import ShopOverviewPage from '@/app/(app)/shop/page';
import AccessDenied from '@/components/AccessDenied';

export default function DashboardPage() {
  const { user } = useAuth();

  const isSuper = isSuperAdmin(user);
  const isInstructor = hasRole(user, 'instructor') && !isSuper && !hasRole(user, 'manager');
  const isAgent = hasRole(user, 'service_agent') && !isSuper;
  // A Company Secretary must never land on ManagementDashboard: that view is
  // built around financial KPIs this role has no permission to read.
  const isSecretary = hasRole(user, 'company_secretary') && !isSuper && !hasRole(user, 'manager');
  // ManagementDashboard reads /api/dashboard, which requires reports.view.
  const canReports = can(user, P.reportsView);
  const canShop = can(user, P.shopView);

  if (isInstructor) return <InstructorDashboard />;
  if (isAgent) return <AgentDashboard />;
  if (isSecretary) return <SecretaryDashboard />;
  if (canReports) return <ManagementDashboard />;
  // Shop roles (shop_manager / shop_attendant / storekeeper) hold no financial
  // reporting permission: they used to fall through to ManagementDashboard and
  // get a 403 error page instead of a home screen.
  if (canShop) return <ShopOverviewPage />;
  return <AccessDenied title="No dashboard for this account" />;
}
