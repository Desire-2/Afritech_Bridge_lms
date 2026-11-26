'use client';

import Link from 'next/link';
import { fmtMoney, fmtDate } from '@/lib/api';
import { useFetch } from '@/lib/use-fetch';
import { PageHeader, Loading, ErrorAlert, EmptyState } from '@/components/ui';

function TrendValue({ value, tone = '' }: { value: React.ReactNode; tone?: string }) {
  return <div className={`stat-value ${tone}`}>{value}</div>;
}

export default function AdminDashboard() {
  const { data, error, loading, reload } = useFetch('/api/dashboard');

  if (loading) return <Loading label="Loading administration overview…" />;
  if (error) return <ErrorAlert message={error} onRetry={reload} />;
  if (!data) return <EmptyState message="Dashboard data is unavailable." />;

  const f = data.financial || {};
  const s = data.service_center || {};
  const e = data.employees || {};
  const i = data.instructors || {};
  const period = data.period || {};

  const attention = [
    { label: 'Weekly reports to review', value: data.weekly_reports_pending || 0, href: '/finance/weekly-reports?view=review', tone: (data.weekly_reports_pending || 0) > 0 ? 'warn' : '' },
    { label: 'Closings awaiting review', value: data.closings_pending || 0, href: '/closings', tone: (data.closings_pending || 0) > 0 ? 'warn' : '' },
    { label: 'Pending expenses', value: data.expenses_pending || 0, href: '/finance/expenses', tone: (data.expenses_pending || 0) > 0 ? 'warn' : '' },
    { label: 'Overdue tasks', value: e.overdue_tasks || 0, href: '/tasks', tone: (e.overdue_tasks || 0) > 0 ? 'danger' : '' },
  ];

  return (
    <div className="d-flex flex-column gap-4">
      <PageHeader
        eyebrow="Administration"
        title="Operations overview"
        subtitle={`System-wide performance and control signals for ${fmtDate(period.today)}.`}
        actions={
          <>
            <Link href="/reports" className="btn btn-outline-primary btn-sm">
              <i className="bi bi-file-earmark-bar-graph me-1" aria-hidden="true" />Reports
            </Link>
            <Link href="/admin/users" className="btn btn-outline-secondary btn-sm">
              <i className="bi bi-shield-lock me-1" aria-hidden="true" />Users & roles
            </Link>
            <Link href="/admin/settings" className="btn btn-primary btn-sm">
              <i className="bi bi-gear me-1" aria-hidden="true" />Settings
            </Link>
          </>
        }
      />

      <section aria-label="Key metrics">
        <div className="metric-grid">
          <div className="stat-card stat-primary"><div className="card"><div className="card-body"><div className="stat-icon" aria-hidden="true"><i className="bi bi-cash-stack" /></div><div className="min-w-0 flex-grow-1"><div className="stat-label">Revenue today</div><TrendValue value={fmtMoney(f.today_revenue)} /><div className="stat-sub">{s.transactions_today || 0} completed transactions</div></div></div></div></div>
          <div className="stat-card stat-primary"><div className="card"><div className="card-body"><div className="stat-icon" aria-hidden="true"><i className="bi bi-graph-up-arrow" /></div><div className="min-w-0 flex-grow-1"><div className="stat-label">Revenue this month</div><TrendValue value={fmtMoney(f.month_revenue)} /><div className="stat-sub">Gross {fmtMoney(f.month_gross_profit)}</div></div></div></div></div>
          <div className="stat-card stat-success"><div className="card"><div className="card-body"><div className="stat-icon" aria-hidden="true"><i className="bi bi-building-check" /></div><div className="min-w-0 flex-grow-1"><div className="stat-label">Company profit</div><TrendValue value={fmtMoney(f.month_company_profit)} /><div className="stat-sub">Month to date</div></div></div></div></div>
          <div className={`stat-card ${(f.month_net_profit || 0) < 0 ? 'stat-danger' : 'stat-success'}`}><div className="card"><div className="card-body"><div className="stat-icon" aria-hidden="true"><i className="bi bi-calculator" /></div><div className="min-w-0 flex-grow-1"><div className="stat-label">Net profit</div><TrendValue value={fmtMoney(f.month_net_profit)} /><div className="stat-sub">After expenses and payroll</div></div></div></div></div>
        </div>
      </section>

      <div className="row g-3">
        <div className="col-xl-8 d-flex flex-column gap-3">
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Financial control</h2>
                <p className="panel-subtitle">Month-to-date movement across revenue, costs, and payouts.</p>
              </div>
              <Link href="/finance/revenue" className="btn btn-sm btn-outline-secondary">Revenue detail</Link>
            </div>
            <div className="panel-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <ul className="signal-list">
                    <li className="signal-item"><div><div className="signal-label">Commissions</div><div className="signal-meta">Month to date</div></div><div className="signal-value warn">{fmtMoney(f.month_commission)}</div></li>
                    <li className="signal-item"><div><div className="signal-label">Expenses</div><div className="signal-meta">Approved / paid this month</div></div><div className="signal-value">{fmtMoney(f.month_expenses)}</div></li>
                    <li className="signal-item"><div><div className="signal-label">Payroll</div><div className="signal-meta">Approved / paid periods</div></div><div className="signal-value">{fmtMoney(f.month_payroll)}</div></li>
                  </ul>
                </div>
                <div className="col-md-6">
                  <ul className="signal-list">
                    <li className="signal-item"><div><div className="signal-label">Today&apos;s expenses</div><div className="signal-meta">Approved / paid</div></div><div className="signal-value">{fmtMoney(f.today_expenses)}</div></li>
                    <li className="signal-item"><div><div className="signal-label">Today&apos;s gross profit</div><div className="signal-meta">Completed transactions</div></div><div className="signal-value good">{fmtMoney(f.today_gross_profit)}</div></li>
                    <li className="signal-item"><div><div className="signal-label">Commission default</div><div className="signal-meta">Current configured rate</div></div><div className="signal-value">{Number(data.commission_default || 0).toLocaleString(undefined, { style: 'percent', maximumFractionDigits: 2 })}</div></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="row g-3">
            <div className="col-md-6">
              <div className="panel h-100">
                <div className="panel-header">
                  <div><h2 className="panel-title">Top services</h2><p className="panel-subtitle">By completed transaction count this month.</p></div>
                </div>
                <div className="panel-body flush">
                  {(s.top_services || []).length === 0 ? <div className="p-3"><EmptyState message="No service data yet." icon="bi-bar-chart" /></div> : (
                    <div className="table-responsive">
                      <table className="table mb-0">
                        <thead><tr><th>Service</th><th className="text-end">Count</th></tr></thead>
                        <tbody>
                          {(s.top_services || []).map((item: any, idx: number) => (
                            <tr key={item.name}><td><span className="rank-badge me-2">{idx + 1}</span>{item.name}</td><td className="text-end money fw-semibold">{item.count}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="panel h-100">
                <div className="panel-header">
                  <div><h2 className="panel-title">Top performers</h2><p className="panel-subtitle">By company profit contribution this month.</p></div>
                </div>
                <div className="panel-body flush">
                  {(s.top_employees || []).length === 0 ? <div className="p-3"><EmptyState message="No employee performance data yet." icon="bi-people" /></div> : (
                    <div className="table-responsive">
                      <table className="table mb-0">
                        <thead><tr><th>Employee</th><th className="text-end">Company profit</th></tr></thead>
                        <tbody>
                          {(s.top_employees || []).map((item: any, idx: number) => (
                            <tr key={item.name}><td><span className="rank-badge me-2">{idx + 1}</span>{item.name}</td><td className="text-end money fw-semibold">{fmtMoney(item.profit)}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-xl-4 d-flex flex-column gap-3">
          <div className="panel">
            <div className="panel-header">
              <div><h2 className="panel-title">Needs attention</h2><p className="panel-subtitle">Items requiring administrative review.</p></div>
            </div>
            <div className="panel-body">
              <ul className="signal-list">
                {attention.map((a) => (
                  <li className="signal-item" key={a.label}>
                    <div><div className="signal-label">{a.label}</div></div>
                    <Link href={a.href} className={`signal-value text-decoration-none ${a.tone}`}>{a.value}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div><h2 className="panel-title">Organization</h2><p className="panel-subtitle">People, delivery, and system footprint.</p></div>
            </div>
            <div className="panel-body">
              <ul className="signal-list">
                <li className="signal-item"><div className="signal-label">Active employees</div><div className="signal-value">{e.active_employees || 0} / {e.total_employees || 0}</div></li>
                <li className="signal-item"><div className="signal-label">Attendance recorded today</div><div className="signal-value">{e.today_attendance || 0}</div></li>
                <li className="signal-item"><div className="signal-label">Open / overdue tasks</div><div className={`signal-value ${(e.overdue_tasks || 0) > 0 ? 'danger' : ''}`}>{e.open_tasks || 0} / {e.overdue_tasks || 0}</div></li>
                <li className="signal-item"><div className="signal-label">Active instructors</div><div className="signal-value">{i.active_instructors || 0}</div></li>
                <li className="signal-item"><div className="signal-label">Plan completion</div><div className="signal-value">{i.plan_completion || 0}%</div></li>
                <li className="signal-item"><div className="signal-label">Branches / services / clients</div><div className="signal-value">{data.branch_count || 0} / {data.service_count || 0} / {data.client_count || 0}</div></li>
              </ul>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><div><h2 className="panel-title">Recent instructor scores</h2><p className="panel-subtitle">Latest performance snapshots.</p></div></div>
            <div className="panel-body flush">
              {(i.recent_scores || []).length === 0 ? <div className="p-3"><EmptyState message="No scores calculated yet." icon="bi-clipboard-data" /></div> : (
                <div className="table-responsive">
                  <table className="table mb-0">
                    <tbody>
                      {(i.recent_scores || []).map((sc: any) => (
                        <tr key={sc.id}>
                          <td>{sc.employee_name}</td>
                          <td className="text-end"><span className="fw-semibold">{sc.overall_score}</span> <span className="text-muted small text-capitalize">({sc.rating})</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
