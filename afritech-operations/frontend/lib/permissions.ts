'use client';

/**
 * Central permission/access configuration — the single source of truth for
 * what each role can see and do in the UI. Keep in sync with the backend
 * permission catalog (backend/app/auth/permissions.py).
 */
import { can, hasRole, isSuperAdmin } from '@/lib/api';

/** Permission catalog (mirrors backend PERMISSIONS codes). */
export const P = {
  usersManage: 'users.manage',
  usersView: 'users.view',
  rolesManage: 'roles.manage',
  employeesManage: 'employees.manage',
  employeesView: 'employees.view',
  earningsViewAll: 'employees.earnings.view_all',
  earningsViewOwn: 'employees.earnings.view_own',
  servicesManage: 'services.manage',
  servicesView: 'services.view',
  clientsManage: 'clients.manage',
  clientsView: 'clients.view',
  transactionsCreate: 'transactions.create',
  transactionsView: 'transactions.view',
  transactionsViewAll: 'transactions.view_all',
  transactionsOperational: 'transactions.operational',
  transactionsCancel: 'transactions.cancel',
  transactionsEdit: 'transactions.edit',
  transactionsApprove: 'transactions.approve',
  closingsSubmit: 'closings.submit',
  closingsApprove: 'closings.approve',
  closingsView: 'closings.view',
  expensesCreate: 'expenses.create',
  expensesApprove: 'expenses.approve',
  expensesView: 'expenses.view',
  payrollManage: 'payroll.manage',
  payrollApprove: 'payroll.approve',
  payrollMarkPaid: 'payroll.mark_paid',
  payrollView: 'payroll.view',
  attendanceManage: 'attendance.manage',
  attendanceView: 'attendance.view',
  attendanceOverview: 'attendance.overview',
  leaveView: 'leave.view',
  leaveManage: 'leave.manage',
  tasksCreate: 'tasks.create',
  tasksManage: 'tasks.manage',
  tasksView: 'tasks.view',
  tasksAssign: 'tasks.assign',
  tasksVerify: 'tasks.verify',
  meetingsView: 'meetings.view',
  meetingsManage: 'meetings.manage',
  activitiesView: 'activities.view',
  activitiesManage: 'activities.manage',
  calendarView: 'calendar.view',
  calendarManage: 'calendar.manage',
  announcementsView: 'announcements.view',
  announcementsManage: 'announcements.manage',
  memosView: 'memos.view',
  memosManage: 'memos.manage',
  documentsView: 'documents.view',
  documentsManage: 'documents.manage',
  requestsView: 'requests.view',
  requestsManage: 'requests.manage',
  followupsView: 'followups.view',
  followupsManage: 'followups.manage',
  escalationsView: 'escalations.view',
  escalationsManage: 'escalations.manage',
  reportsView: 'reports.view',
  reportsExport: 'reports.export',
  reportsOperational: 'reports.operational',
  instructorsManage: 'instructors.manage',
  instructorsView: 'instructors.view',
  weeklyPlansManage: 'weekly_plans.manage',
  weeklyPlansView: 'weekly_plans.view',
  performanceView: 'performance.view',
  learnerProgressView: 'learner_progress.view',
  coursesManage: 'courses.manage',
  coursesView: 'courses.view',
  notificationsView: 'notifications.view',
  auditView: 'audit.view',
  settingsManage: 'settings.manage',
  integrationManage: 'integration.manage',
} as const;

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  manager: 'Manager',
  service_agent: 'Service Agent',
  instructor: 'Instructor',
  accountant: 'Accountant',
  company_secretary: 'Company Secretary',
};

export function roleLabel(user: any | null): string {
  if (!user) return '';
  if (isSuperAdmin(user)) return 'Super Admin';
  const labels = (user.role_codes || [])
    .map((r: string) => ROLE_LABELS[r] || r.replace(/_/g, ' '));
  return labels.join(', ') || 'User';
}

export type NavItem = {
  label: string;
  href: string;
  icon: string;
  /** Any single permission grants access. */
  perm?: string | string[];
  roles?: string[];
};

export type NavGroup = {
  group: string;
  items: NavItem[];
};

/** Sidebar navigation — permission-filtered at render time. */
export const NAV: NavGroup[] = [
  {
    group: 'Overview',
    items: [
      { label: 'Dashboard', href: '/', icon: 'bi-speedometer2' },
      { label: 'My Profile', href: '/profile', icon: 'bi-person-circle' },
      { label: 'Notifications', href: '/notifications', icon: 'bi-bell', perm: P.notificationsView },
    ],
  },
  {
    group: 'Operations',
    items: [
      { label: 'Services', href: '/services', icon: 'bi-grid-3x3-gap', perm: P.servicesView },
      { label: 'Transactions', href: '/transactions', icon: 'bi-receipt', perm: [P.transactionsView, P.transactionsOperational] },
      { label: 'New Transaction', href: '/transactions/new', icon: 'bi-plus-circle', perm: P.transactionsCreate },
      { label: 'Clients', href: '/clients', icon: 'bi-people', perm: P.clientsView },
      { label: 'Daily Closing', href: '/closings', icon: 'bi-calendar-check', perm: [P.closingsView, P.closingsSubmit] },
      { label: 'My Expenses', href: '/finance/expenses', icon: 'bi-receipt-cutoff', perm: [P.expensesView, P.expensesCreate] },
    ],
  },
  {
    group: 'Employees',
    items: [
      { label: 'Employees', href: '/employees', icon: 'bi-person-badge', perm: P.employeesView },
      { label: 'Attendance', href: '/attendance', icon: 'bi-clock-history', perm: P.attendanceView },
      { label: 'Tasks', href: '/tasks', icon: 'bi-check2-square', perm: P.tasksView },
      { label: 'Earnings', href: '/earnings', icon: 'bi-wallet2', perm: [P.earningsViewAll, P.earningsViewOwn] },
    ],
  },
  {
    group: 'Finance',
    items: [
      { label: 'Revenue', href: '/finance/revenue', icon: 'bi-cash-stack', perm: P.reportsView },
      { label: 'Commissions', href: '/finance/commissions', icon: 'bi-percent', perm: P.settingsManage },
      { label: 'Payroll', href: '/finance/payroll', icon: 'bi-credit-card-2-front', perm: P.payrollView },
      { label: 'Cash Reconciliation', href: '/finance/cash-reconciliation', icon: 'bi-cash-coin', perm: P.reportsView },
    ],
  },
  {
    group: 'Coordination',
    items: [
      { label: 'Company Calendar', href: '/calendar', icon: 'bi-calendar3', perm: P.calendarView },
      { label: 'Meetings', href: '/meetings', icon: 'bi-people', perm: P.meetingsView },
      { label: 'Activities', href: '/activities', icon: 'bi-clipboard-check', perm: P.activitiesView },
      { label: 'Announcements', href: '/announcements', icon: 'bi-megaphone', perm: P.announcementsView },
      { label: 'Memos', href: '/memos', icon: 'bi-sticky', perm: P.memosView },
      { label: 'Documents', href: '/documents', icon: 'bi-folder2-open', perm: P.documentsView },
    ],
  },
  {
    group: 'Requests & Follow-up',
    items: [
      { label: 'Administrative Requests', href: '/requests', icon: 'bi-inbox', perm: P.requestsView },
      { label: 'Follow-ups', href: '/follow-ups', icon: 'bi-arrow-repeat', perm: P.followupsView },
      { label: 'Escalations', href: '/escalations', icon: 'bi-exclamation-diamond', perm: P.escalationsView },
      { label: 'Leave Requests', href: '/leave', icon: 'bi-airplane', perm: P.leaveView },
    ],
  },
  {
    group: 'Learning',
    items: [
      { label: 'Instructors', href: '/learning/instructors', icon: 'bi-person-video3', perm: P.instructorsView },
      { label: 'Weekly Plans', href: '/learning/weekly-plans', icon: 'bi-journal-richtext', perm: [P.weeklyPlansView, P.weeklyPlansManage] },
      { label: 'Cohorts & Learners', href: '/learning/cohorts', icon: 'bi-mortarboard', perm: P.coursesView },
      { label: 'Instructor Performance', href: '/learning/performance', icon: 'bi-clipboard-data', perm: P.performanceView },
    ],
  },
  {
    group: 'Reports',
    items: [
      { label: 'Reports', href: '/reports', icon: 'bi-file-earmark-bar-graph', perm: P.reportsView },
      { label: 'Operational Reports', href: '/reports/operational', icon: 'bi-clipboard-data', perm: P.reportsOperational },
    ],
  },
  {
    group: 'Administration',
    items: [
      { label: 'Users & Roles', href: '/admin/users', icon: 'bi-shield-lock', perm: P.usersView },
      { label: 'Audit Log', href: '/admin/audit', icon: 'bi-journal-text', perm: P.auditView },
      { label: 'Settings', href: '/admin/settings', icon: 'bi-gear', perm: P.settingsManage },
      { label: 'LMS Integration', href: '/admin/integration', icon: 'bi-diagram-3', perm: P.integrationManage },
    ],
  },
];

export function hasPerm(user: any, perm: string | string[] | undefined): boolean {
  if (!user) return false;
  if (!perm) return true;
  const list = Array.isArray(perm) ? perm : [perm];
  return list.some((p) => can(user, p));
}

export function navGroupsFor(user: any): NavGroup[] {
  return NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => {
      if (isSuperAdmin(user)) return true;
      if (i.roles && !i.roles.some((r) => hasRole(user, r))) return false;
      return hasPerm(user, i.perm);
    }),
  })).filter((g) => g.items.length > 0);
}

/** Route → required permission (string = exactly one, array = any-of). Ordered longest-first. */
const ROUTE_GUARDS: { path: string; perm: string | string[] }[] = [
  { path: '/transactions/new', perm: P.transactionsCreate },
  { path: '/transactions', perm: [P.transactionsView, P.transactionsEdit, P.transactionsApprove, P.transactionsOperational] },
  { path: '/clients', perm: P.clientsView },
  { path: '/services', perm: P.servicesView },
  { path: '/closings', perm: P.closingsView },
  { path: '/employees', perm: P.employeesView },
  { path: '/attendance', perm: P.attendanceView },
  { path: '/tasks', perm: P.tasksView },
  { path: '/earnings', perm: [P.earningsViewAll, P.earningsViewOwn] },
  { path: '/calendar', perm: P.calendarView },
  { path: '/meetings', perm: P.meetingsView },
  { path: '/activities', perm: P.activitiesView },
  { path: '/announcements', perm: P.announcementsView },
  { path: '/memos', perm: P.memosView },
  { path: '/documents', perm: P.documentsView },
  { path: '/requests', perm: P.requestsView },
  { path: '/follow-ups', perm: P.followupsView },
  { path: '/escalations', perm: P.escalationsView },
  { path: '/leave', perm: P.leaveView },
  { path: '/reports/operational', perm: P.reportsOperational },
  { path: '/finance/revenue', perm: P.reportsView },
  { path: '/finance/expenses', perm: [P.expensesView, P.expensesCreate] },
  { path: '/finance/commissions', perm: P.settingsManage },
  { path: '/finance/payroll', perm: P.payrollView },
  { path: '/finance/cash-reconciliation', perm: P.reportsView },
  { path: '/learning/instructors', perm: P.instructorsView },
  { path: '/learning/weekly-plans', perm: [P.weeklyPlansView, P.weeklyPlansManage] },
  { path: '/learning/cohorts', perm: P.coursesView },
  { path: '/learning/performance', perm: P.performanceView },
  { path: '/reports', perm: P.reportsView },
  { path: '/admin/users', perm: P.usersView },
  { path: '/admin/audit', perm: P.auditView },
  { path: '/admin/settings', perm: P.settingsManage },
  { path: '/admin/integration', perm: P.integrationManage },
  { path: '/notifications', perm: P.notificationsView },
];

export function routeDenied(user: any | null, pathname: string): boolean {
  if (!user) return false;
  const match = ROUTE_GUARDS
    .filter((g) => pathname === g.path || pathname.startsWith(`${g.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0];
  if (!match) return false;
  return !hasPerm(user, match.perm);
}

/** Resolve current page title + group from the nav config (for the top header). */
export function pageIdentity(pathname: string): { title: string; group: string } {
  if (pathname === '/') return { title: 'Dashboard', group: 'Overview' };
  if (pathname === '/profile') return { title: 'My Profile', group: 'Overview' };
  let best: NavItem | undefined;
  let bestGroup = '';
  for (const g of NAV) {
    for (const item of g.items) {
      const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
      if (active && (!best || item.href.length > best.href.length)) {
        best = item;
        bestGroup = g.group;
      }
    }
  }
  return best ? { title: best.label, group: bestGroup } : { title: pathname, group: '' };
}