'use client';

import Link from 'next/link';
import { fmtMoney } from '@/lib/api';
import { PageHeader, Loading, ErrorAlert, StatCard, EmptyState } from '@/components/ui';
import { useFetch } from '@/lib/use-fetch';

export default function ManagementDashboard() {
  const { data, error, loading } = useFetch('/api/dashboard');

  if (error) return <ErrorAlert message={error} />;
  if (loading || !data) return <Loading label="Loading dashboard…" />;

  const f = data.financial;
  const s = data.service_center;
  const e = data.employees;
  const i = data.instructors;

  const mini = [
    { label: 'Transactions today', value: s.transactions_today, tone: 'text-primary' },
    { label: 'This month', value: s.transactions_month, tone: '' },
    { label: 'Pending (processing)', value: s.pending_services, tone: 'text-warning' },
    { label: 'Cancelled / refunded (month)', value: s.cancelled_month, tone: 'text-danger' },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title="Business Dashboard"
        subtitle={`Company performance for ${data.period.today}`}
        actions={
          <>
            <Link href="/transactions/new" className="btn btn-accent">
              <i className="bi bi-plus-circle me-1" /> New transaction
            </Link>
            <Link href="/closings" className="btn btn-outline-primary">Daily closing</Link>
          </>
        }
      />

      <div className="row g-3 mb-4">
        <StatCard label="Revenue today" value={fmtMoney(f.today_revenue)} tone="primary" icon="bi-cash-stack" sub={`${s.transactions_today} transactions`} />
        <StatCard label="Revenue this month" value={fmtMoney(f.month_revenue)} tone="primary" icon="bi-graph-up-arrow" />
        <StatCard label="Company profit (month)" value={fmtMoney(f.month_company_profit)} tone="success" icon="bi-piggy-bank" />
        <StatCard label="Commissions (month)" value={fmtMoney(f.month_commission)} tone="warning" icon="bi-percent" />
        <StatCard label="Net profit (month)" value={fmtMoney(f.month_net_profit)} tone={f.month_net_profit < 0 ? 'danger' : 'success'} icon="bi-calculator" />
      </div>

      <div className="row g-4">
        <div className="col-lg-8">
          <div className="card mb-4">
            <div className="card-header">Service centre</div>
            <div className="card-body">
              <div className="row g-3">
                {mini.map((m) => (
                  <div className="col-6 col-md-3" key={m.label}>
                    <div className="mini-stat">
                      <div className={`fs-3 fw-bold ${m.tone} money`}>{m.value}</div>
                      <div className="small text-muted">{m.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-md-6">
              <div className="card h-100">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <span>Top services (month)</span>
                  <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle">{s.transactions_month} total</span>
                </div>
                <div className="card-body p-0">
                  {(s.top_services || []).length === 0 && (
                    <div className="p-3"><EmptyState message="No data yet." icon="bi-bar-chart-line" /></div>
                  )}
                  {s.top_services.map((ts: any, idx: number) => (
                    <div key={ts.name} className="list-row d-flex justify-content-between align-items-center px-3 py-2">
                      <div className="d-flex align-items-center gap-2">
                        <span className="rank-badge">{idx + 1}</span>
                        <span>{ts.name}</span>
                      </div>
                      <span className="fw-semibold money">{ts.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="card h-100">
                <div className="card-header">Top earners (company profit)</div>
                <div className="card-body p-0">
                  {(s.top_employees || []).length === 0 && (
                    <div className="p-3"><EmptyState message="No data yet." icon="bi-bar-chart-line" /></div>
                  )}
                  {s.top_employees.map((te: any, idx: number) => (
                    <div key={te.name} className="list-row d-flex justify-content-between align-items-center px-3 py-2">
                      <div className="d-flex align-items-center gap-2">
                        <span className="rank-badge">{idx + 1}</span>
                        <span>{te.name}</span>
                      </div>
                      <span className="money fw-semibold">{fmtMoney(te.profit)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card mb-4">
            <div className="card-header">Org pulse</div>
            <div className="card-body py-2">
              <div className="d-flex justify-content-between py-2 border-bottom small">
                <span className="text-muted">Active employees</span><span className="fw-semibold">{e.active_employees} / {e.total_employees}</span>
              </div>
              <div className="d-flex justify-content-between py-2 border-bottom small">
                <span className="text-muted">Attendance recorded today</span><span className="fw-semibold">{e.today_attendance}</span>
              </div>
              <div className="d-flex justify-content-between py-2 border-bottom small">
                <span className="text-muted">Open / overdue tasks</span>
                <span className={`fw-semibold ${e.overdue_tasks > 0 ? 'text-danger' : ''}`}>{e.open_tasks} / {e.overdue_tasks}</span>
              </div>
              <div className="d-flex justify-content-between py-2 border-bottom small">
                <span className="text-muted">Active instructors</span><span className="fw-semibold">{i.active_instructors}</span>
              </div>
              <div className="d-flex justify-content-between py-2 border-bottom small">
                <span className="text-muted">Current weekly plans</span><span className="fw-semibold">{i.current_plans}</span>
              </div>
              <div className="d-flex justify-content-between py-2 small">
                <span className="text-muted">Plan completion</span><span className="fw-semibold">{i.plan_completion}%</span>
              </div>
            </div>
          </div>

          <div className="card mb-4">
            <div className="card-header">Attention needed</div>
            <div className="card-body py-2">
              <div className="d-flex justify-content-between align-items-center py-2 border-bottom small">
                <span className="text-muted">Closings awaiting review</span>
                <Link href="/closings" className="btn btn-sm btn-outline-warning">{data.closings_pending}</Link>
              </div>
              <div className="d-flex justify-content-between align-items-center py-2 border-bottom small">
                <span className="text-muted">Pending expenses</span>
                <Link href="/finance/expenses" className="btn btn-sm btn-outline-warning">{data.expenses_pending}</Link>
              </div>
              <div className="d-flex justify-content-between align-items-center py-2 small">
                <span className="text-muted">Unread notifications</span>
                <Link href="/notifications" className="btn btn-sm btn-outline-primary">{data.unread_notifications}</Link>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">Recent instructor scores</div>
            <div className="card-body py-2">
              {(i.recent_scores || []).length === 0 && <EmptyState message="No scores calculated yet." icon="bi-clipboard-data" />}
              {i.recent_scores.map((sc: any) => (
                <div key={sc.id} className="d-flex justify-content-between align-items-center py-2 border-bottom small">
                  <span className="text-truncate">{sc.employee_name}</span>
                  <span className="fw-semibold">{sc.overall_score} <span className="text-capitalize text-muted">({sc.rating})</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}