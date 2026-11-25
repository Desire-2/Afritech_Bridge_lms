'use client';

import Link from 'next/link';
import { fmtMoney, fmtDate, fmtDateTime } from '@/lib/api';
import { useFetch } from '@/lib/use-fetch';
import { PageHeader, Loading, ErrorAlert, EmptyState, Badge } from '@/components/ui';

export default function ManagerDashboard() {
  const { data, error, loading, reload } = useFetch('/api/dashboard');
  const weeklyQueue = useFetch('/api/weekly-reports/queue?per_page=5');

  if (loading) return <Loading label="Loading management workspace…" />;
  if (error) return <ErrorAlert message={error} onRetry={reload} />;
  if (!data) return <EmptyState message="Dashboard data is unavailable." />;

  const f = data.financial || {};
  const s = data.service_center || {};
  const e = data.employees || {};
  const period = data.period || {};
  const queueItems = weeklyQueue.data?.items || [];

  const actionItems = [
    { label: 'Weekly reports to review', value: data.weekly_reports_pending ?? weeklyQueue.data?.total ?? '—', href: '/finance/weekly-reports/review', detail: 'Submitted or under review', tone: ((data.weekly_reports_pending ?? weeklyQueue.data?.total) || 0) > 0 ? 'warn' : '' },
    { label: 'Closings awaiting review', value: data.closings_pending || 0, href: '/closings', detail: 'Daily cash submissions', tone: (data.closings_pending || 0) > 0 ? 'warn' : '' },
    { label: 'Pending expenses', value: data.expenses_pending || 0, href: '/finance/expenses', detail: 'Approval queue', tone: (data.expenses_pending || 0) > 0 ? 'warn' : '' },
    { label: 'Overdue tasks', value: e.overdue_tasks || 0, href: '/tasks', detail: 'Needs follow-up', tone: (e.overdue_tasks || 0) > 0 ? 'danger' : '' },
  ];

  return (
    <div className="d-flex flex-column gap-4">
      <PageHeader
        eyebrow="Management"
        title="Manager workspace"
        subtitle={`Operational and financial priorities for ${fmtDate(period.today)}.`}
        actions={
          <>
            <Link href="/finance/weekly-reports/review" className="btn btn-primary btn-sm">
              <i className="bi bi-clipboard-check me-1" aria-hidden="true" />Review weekly reports
            </Link>
            <Link href="/closings" className="btn btn-outline-secondary btn-sm">
              <i className="bi bi-calendar-check me-1" aria-hidden="true" />Daily closings
            </Link>
          </>
        }
      />

      <section aria-label="Manager priorities">
        <div className="metric-grid">
          {actionItems.map((item) => (
            <div key={item.label} className={`stat-card ${item.tone === 'danger' ? 'stat-danger' : item.tone === 'warn' ? 'stat-warning' : 'stat-primary'}`}>
              <div className="card"><div className="card-body">
                <div className="min-w-0 flex-grow-1">
                  <div className="stat-label">{item.label}</div>
                  <div className="stat-value">{item.value}</div>
                  <div className="stat-sub">{item.detail}</div>
                </div>
                <Link href={item.href} className="btn btn-sm btn-outline-secondary">Open</Link>
              </div></div>
            </div>
          ))}
        </div>
      </section>

      <div className="row g-3">
        <div className="col-xl-8 d-flex flex-column gap-3">
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Weekly financial reports</h2>
                <p className="panel-subtitle">Submitted reports waiting for accounting review or decision.</p>
              </div>
              <Link href="/finance/weekly-reports/review" className="btn btn-sm btn-outline-primary">Open review queue</Link>
            </div>
            <div className="panel-body flush">
              {weeklyQueue.loading && <div className="p-3"><Loading label="Loading review queue…" /></div>}
              {weeklyQueue.error && <div className="p-3"><ErrorAlert message={weeklyQueue.error} onRetry={weeklyQueue.reload} /></div>}
              {!weeklyQueue.loading && !weeklyQueue.error && queueItems.length === 0 && (
                <div className="p-3"><EmptyState message="No weekly reports are waiting for review." icon="bi-clipboard-check" /></div>
              )}
              {!weeklyQueue.loading && !weeklyQueue.error && queueItems.length > 0 && (
                <div className="table-responsive">
                  <table className="table mb-0">
                    <thead><tr><th>Report</th><th>Agent</th><th>Period</th><th>Status</th><th className="text-end">Outstanding</th></tr></thead>
                    <tbody>
                      {queueItems.map((r: any) => (
                        <tr key={r.id}>
                          <td>
                            <Link href="/finance/weekly-reports/review" className="fw-semibold text-decoration-none">{r.report_number}</Link>
                            <div className="small text-muted">{r.branch_name || '—'}</div>
                          </td>
                          <td>{r.employee_name || '—'}</td>
                          <td className="small text-muted">{fmtDate(r.week_start)} – {fmtDate(r.week_end)}</td>
                          <td><Badge status={r.status} /></td>
                          <td className="text-end money fw-semibold">{fmtMoney(r.closing_outstanding)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div><h2 className="panel-title">Financial snapshot</h2><p className="panel-subtitle">Month-to-date figures from backend reporting.</p></div>
              <Link href="/reports" className="btn btn-sm btn-outline-secondary">Reports</Link>
            </div>
            <div className="panel-body">
              <div className="row g-3">
                <div className="col-sm-6 col-lg-4"><div className="mini-stat"><div className="stat-label">Revenue</div><div className="fs-4 fw-bold money">{fmtMoney(f.month_revenue)}</div></div></div>
                <div className="col-sm-6 col-lg-4"><div className="mini-stat"><div className="stat-label">Company profit</div><div className="fs-4 fw-bold money text-success">{fmtMoney(f.month_company_profit)}</div></div></div>
                <div className="col-sm-6 col-lg-4"><div className="mini-stat"><div className="stat-label">Net profit</div><div className={`fs-4 fw-bold money ${(f.month_net_profit || 0) < 0 ? 'text-danger' : 'text-success'}`}>{fmtMoney(f.month_net_profit)}</div></div></div>
                <div className="col-sm-6 col-lg-4"><div className="mini-stat"><div className="stat-label">Commissions</div><div className="fs-5 fw-semibold money">{fmtMoney(f.month_commission)}</div></div></div>
                <div className="col-sm-6 col-lg-4"><div className="mini-stat"><div className="stat-label">Expenses</div><div className="fs-5 fw-semibold money">{fmtMoney(f.month_expenses)}</div></div></div>
                <div className="col-sm-6 col-lg-4"><div className="mini-stat"><div className="stat-label">Payroll</div><div className="fs-5 fw-semibold money">{fmtMoney(f.month_payroll)}</div></div></div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-xl-4 d-flex flex-column gap-3">
          <div className="panel">
            <div className="panel-header"><div><h2 className="panel-title">Team pulse</h2><p className="panel-subtitle">Current operational state.</p></div></div>
            <div className="panel-body">
              <ul className="signal-list">
                <li className="signal-item"><div className="signal-label">Active employees</div><div className="signal-value">{e.active_employees || 0} / {e.total_employees || 0}</div></li>
                <li className="signal-item"><div className="signal-label">Attendance today</div><div className="signal-value">{e.today_attendance || 0}</div></li>
                <li className="signal-item"><div className="signal-label">Open tasks</div><div className="signal-value">{e.open_tasks || 0}</div></li>
                <li className="signal-item"><div className="signal-label">Overdue tasks</div><div className={`signal-value ${(e.overdue_tasks || 0) > 0 ? 'danger' : ''}`}>{e.overdue_tasks || 0}</div></li>
                <li className="signal-item"><div className="signal-label">Pending services</div><div className="signal-value">{s.pending_services || 0}</div></li>
              </ul>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><div><h2 className="panel-title">Service performance</h2><p className="panel-subtitle">Top services this month.</p></div></div>
            <div className="panel-body flush">
              {(s.top_services || []).length === 0 ? <div className="p-3"><EmptyState message="No service data yet." icon="bi-bar-chart" /></div> : (
                <div className="table-responsive">
                  <table className="table mb-0">
                    <tbody>
                      {(s.top_services || []).map((item: any) => (
                        <tr key={item.name}><td>{item.name}</td><td className="text-end money fw-semibold">{item.count}</td></tr>
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
