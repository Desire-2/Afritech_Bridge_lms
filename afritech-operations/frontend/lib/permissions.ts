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
  // Electronics shop (mirrors backend SHOP_PERMISSIONS)
  shopView: 'shop.view',
  shopProductsView: 'shop.products.view',
  shopProductsCreate: 'shop.products.create',
  shopProductsEdit: 'shop.products.edit',
  shopProductsArchive: 'shop.products.archive',
  shopInventoryView: 'shop.inventory.view',
  shopInventoryCount: 'shop.inventory.count',
  shopInventoryAdjust: 'shop.inventory.adjust',
  shopInventoryTransfer: 'shop.inventory.transfer',
  shopInventoryReceive: 'shop.inventory.receive',
  shopSuppliersView: 'shop.suppliers.view',
  shopSuppliersCreate: 'shop.suppliers.create',
  shopPurchasesView: 'shop.purchases.view',
  shopPurchasesCreate: 'shop.purchases.create',
  shopPurchasesApprove: 'shop.purchases.approve',
  shopPurchasesReceive: 'shop.purchases.receive',
  shopSalesView: 'shop.sales.view',
  shopSalesViewAll: 'shop.sales.view_all',
  shopSalesCreate: 'shop.sales.create',
  shopSalesCancel: 'shop.sales.cancel',
  shopSalesRefund: 'shop.sales.refund',
  shopCustomersView: 'shop.customers.view',
  shopCustomersManage: 'shop.customers.manage',
  shopReturnsView: 'shop.returns.view',
  shopReturnsCreate: 'shop.returns.create',
  shopReturnsApprove: 'shop.returns.approve',
  shopWarrantyView: 'shop.warranty.view',
  shopWarrantyManage: 'shop.warranty.manage',
  shopReportsView: 'shop.reports.view',
  shopFinancialReportsView: 'shop.financial_reports.view',
  shopPricingView: 'shop.pricing.view',
  shopPricingManage: 'shop.pricing.manage',
  shopDiscountsApprove: 'shop.discounts.approve',
  shopShiftsView: 'shop.shifts.view',
  shopShiftsManage: 'shop.shifts.manage',
  shopClosingView: 'shop.cash_closing.view',
  shopClosingApprove: 'shop.cash_closing.approve',
  shopPromotionsManage: 'shop.promotions.manage',
  shopSettingsManage: 'shop.settings.manage',
  shopActivitiesView: 'shop.activities.view',
} as const;

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  manager: 'Manager',
  service_agent: 'Service Agent',
  instructor: 'Instructor',
  accountant: 'Accountant',
  company_secretary: 'Company Secretary',
  shop_manager: 'Shop Manager',
  shop_attendant: 'Shop Attendant',
  storekeeper: 'Storekeeper',
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
      { label: 'Services', href: '/services', icon: 'bi-grid-3x3-gap', perm: [P.servicesView, P.servicesManage] },
      { label: 'Transactions', href: '/transactions', icon: 'bi-receipt', perm: [P.transactionsView, P.transactionsOperational] },
      { label: 'New Transaction', href: '/transactions/new', icon: 'bi-plus-circle', perm: P.transactionsCreate },
      { label: 'Clients', href: '/clients', icon: 'bi-people', perm: [P.clientsView, P.clientsManage] },
      { label: 'Daily Closing', href: '/closings', icon: 'bi-calendar-check', perm: [P.closingsView, P.closingsSubmit, P.closingsApprove] },
      { label: 'My Expenses', href: '/finance/expenses', icon: 'bi-receipt-cutoff', perm: [P.expensesView, P.expensesCreate] },
    ],
  },
  {
    group: 'Shop',
    items: [
      { label: 'Shop Overview', href: '/shop', icon: 'bi-shop', perm: P.shopView },
      { label: 'Point of Sale', href: '/shop/pos', icon: 'bi-cart-check', perm: P.shopSalesCreate },
      { label: 'Sales & Returns', href: '/shop/sales', icon: 'bi-receipt-cutoff', perm: [P.shopSalesView, P.shopSalesViewAll, P.shopReturnsView] },
      { label: 'Catalogue', href: '/shop/catalog', icon: 'bi-box-seam', perm: [P.shopProductsView, P.shopView] },
      { label: 'Inventory', href: '/shop/inventory', icon: 'bi-stack', perm: P.shopInventoryView },
      { label: 'Purchasing', href: '/shop/purchasing', icon: 'bi-truck', perm: [P.shopPurchasesView, P.shopSuppliersView] },
      { label: 'Customers', href: '/shop/customers', icon: 'bi-person-vcard', perm: [P.shopCustomersView, P.shopSalesView] },
      { label: 'Warranty', href: '/shop/warranty', icon: 'bi-shield-check', perm: [P.shopWarrantyView, P.shopWarrantyManage] },
      { label: 'Shifts & Closings', href: '/shop/shifts', icon: 'bi-cash-stack', perm: [P.shopShiftsView, P.shopShiftsManage, P.shopClosingView] },
      { label: 'Shop Reports', href: '/shop/reports', icon: 'bi-graph-up-arrow', perm: P.shopReportsView },
    ],
  },
  {
    group: 'Employees',
    items: [
      { label: 'Employees', href: '/employees', icon: 'bi-person-badge', perm: [P.employeesView, P.employeesManage] },
      { label: 'Attendance', href: '/attendance', icon: 'bi-clock-history', perm: [P.attendanceView, P.attendanceOverview, P.attendanceManage] },
      { label: 'Tasks', href: '/tasks', icon: 'bi-check2-square', perm: [P.tasksView, P.tasksManage] },
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
      { label: 'Company Calendar', href: '/calendar', icon: 'bi-calendar3', perm: [P.calendarView, P.calendarManage] },
      { label: 'Meetings', href: '/meetings', icon: 'bi-people', perm: [P.meetingsView, P.meetingsManage] },
      { label: 'Activities', href: '/activities', icon: 'bi-clipboard-check', perm: [P.activitiesView, P.activitiesManage] },
      { label: 'Announcements', href: '/announcements', icon: 'bi-megaphone', perm: [P.announcementsView, P.announcementsManage] },
      { label: 'Memos', href: '/memos', icon: 'bi-sticky', perm: [P.memosView, P.memosManage] },
      { label: 'Documents', href: '/documents', icon: 'bi-folder2-open', perm: [P.documentsView, P.documentsManage] },
    ],
  },
  {
    group: 'Requests & Follow-up',
    items: [
      { label: 'Administrative Requests', href: '/requests', icon: 'bi-inbox', perm: [P.requestsView, P.requestsManage] },
      { label: 'Follow-ups', href: '/follow-ups', icon: 'bi-arrow-repeat', perm: [P.followupsView, P.followupsManage] },
      { label: 'Escalations', href: '/escalations', icon: 'bi-exclamation-diamond', perm: [P.escalationsView, P.escalationsManage] },
      { label: 'Leave Requests', href: '/leave', icon: 'bi-airplane', perm: [P.leaveView, P.leaveManage] },
    ],
  },
  {
    group: 'Learning',
    items: [
      { label: 'Instructors', href: '/learning/instructors', icon: 'bi-person-video3', perm: [P.instructorsView, P.instructorsManage] },
      { label: 'Weekly Plans', href: '/learning/weekly-plans', icon: 'bi-journal-richtext', perm: [P.weeklyPlansView, P.weeklyPlansManage] },
      { label: 'Cohorts & Learners', href: '/learning/cohorts', icon: 'bi-mortarboard', perm: [P.coursesView, P.coursesManage] },
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
  { path: '/shop/pos', perm: P.shopSalesCreate },
  { path: '/shop/sales', perm: [P.shopSalesView, P.shopSalesViewAll, P.shopReturnsView] },
  { path: '/shop/catalog', perm: [P.shopProductsView, P.shopView] },
  { path: '/shop/inventory', perm: P.shopInventoryView },
  { path: '/shop/purchasing', perm: [P.shopPurchasesView, P.shopSuppliersView] },
  { path: '/shop/customers', perm: [P.shopCustomersView, P.shopSalesView] },
  { path: '/shop/warranty', perm: [P.shopWarrantyView, P.shopWarrantyManage] },
  { path: '/shop/shifts', perm: [P.shopShiftsView, P.shopShiftsManage, P.shopClosingView] },
  { path: '/shop/reports', perm: P.shopReportsView },
  { path: '/shop', perm: P.shopView },
  { path: '/transactions', perm: [P.transactionsView, P.transactionsEdit, P.transactionsApprove, P.transactionsOperational] },
  { path: '/clients', perm: [P.clientsView, P.clientsManage] },
  { path: '/services', perm: [P.servicesView, P.servicesManage] },
  { path: '/closings', perm: [P.closingsView, P.closingsSubmit, P.closingsApprove] },
  { path: '/employees', perm: [P.employeesView, P.employeesManage] },
  { path: '/attendance', perm: [P.attendanceView, P.attendanceOverview, P.attendanceManage] },
  { path: '/tasks', perm: [P.tasksView, P.tasksManage] },
  { path: '/earnings', perm: [P.earningsViewAll, P.earningsViewOwn] },
  { path: '/calendar', perm: [P.calendarView, P.calendarManage] },
  { path: '/meetings', perm: [P.meetingsView, P.meetingsManage] },
  { path: '/activities', perm: [P.activitiesView, P.activitiesManage] },
  { path: '/announcements', perm: [P.announcementsView, P.announcementsManage] },
  { path: '/memos', perm: [P.memosView, P.memosManage] },
  { path: '/documents', perm: [P.documentsView, P.documentsManage] },
  { path: '/requests', perm: [P.requestsView, P.requestsManage] },
  { path: '/follow-ups', perm: [P.followupsView, P.followupsManage] },
  { path: '/escalations', perm: [P.escalationsView, P.escalationsManage] },
  { path: '/leave', perm: [P.leaveView, P.leaveManage] },
  { path: '/reports/operational', perm: P.reportsOperational },
  { path: '/finance/revenue', perm: P.reportsView },
  { path: '/finance/expenses', perm: [P.expensesView, P.expensesCreate] },
  { path: '/finance/commissions', perm: P.settingsManage },
  { path: '/finance/payroll', perm: P.payrollView },
  { path: '/finance/cash-reconciliation', perm: P.reportsView },
  { path: '/learning/instructors', perm: [P.instructorsView, P.instructorsManage] },
  { path: '/learning/weekly-plans', perm: [P.weeklyPlansView, P.weeklyPlansManage] },
  { path: '/learning/cohorts', perm: [P.coursesView, P.coursesManage] },
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