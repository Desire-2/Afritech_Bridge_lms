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

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`Business overview — ${data.period.today}`}
        actions={
          <>
            <Link href="/transactions/new" className="btn btn-primary">
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
            <div className="card-body">
              <h5 className="card-title h6 fw-semibold mb-3">Service centre</h5>
              <div className="row g-3 text-center">
                <div className="col-6 col-md-3">
                  <div className="fs-4 fw-semibold text-primary">{s.transactions_today}</div>
                  <div className="small text-muted">Transactions today</div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="fs-4 fw-semibold">{s.transactions_month}</div>
                  <div className="small text-muted">Transactions this month</div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="fs-4 fw-semibold text-warning">{s.pending_services}</div>
                  <div className="small text-muted">Pending (processing)</div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="fs-4 fw-semibold text-danger">{s.cancelled_month}</div>
                  <div className="small text-muted">Cancelled/refunded (month)</div>
                </div>
              </div>
            </div>
          </div>

          <div className="row g-3">
            <div className="col-md-6">
              <div className="card h-100">
                <div className="card-body">
                  <h5 className="card-title h6 fw-semibold">Top services (month)</h5>
                  {(s.top_services || []).length === 0 && <EmptyState message="No data yet." icon="bi-bar-chart-line" />}
                  {s.top_services.map((ts: any, idx: number) => (
                    <div key={ts.name} className="d-flex justify-content-between py-1 border-bottom small">
                      <span>{idx + 1}. {ts.name}</span>
                      <span className="fw-semibold">{ts.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="card h-100">
                <div className="card-body">
                  <h5 className="card-title h6 fw-semibold">Top earners (company profit)</h5>
                  {(s.top_employees || []).length === 0 && <EmptyState message="No data yet." icon="bi-bar-chart-line" />}
                  {s.top_employees.map((te: any, idx: number) => (
                    <div key={te.name} className="d-flex justify-content-between py-1 border-bottom small">
                      <span>{idx + 1}. {te.name}</span>
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
            <div className="card-body">
              <h5 className="card-title h6 fw-semibold">Pulse</h5>
              <div className="d-flex justify-content-between py-1 border-bottom small">
                <span className="text-muted">Active employees</span><span>{e.active_employees} / {e.total_employees}</span>
              </div>
              <div className="d-flex justify-content-between py-1 border-bottom small">
                <span className="text-muted">Attendance recorded today</span><span>{e.today_attendance}</span>
              </div>
              <div className="d-flex justify-content-between py-1 border-bottom small">
                <span className="text-muted">Open / overdue tasks</span><span>{e.open_tasks} / {e.overdue_tasks}</span>
              </div>
              <div className="d-flex justify-content-between py-1 border-bottom small">
                <span className="text-muted">Active instructors</span><span>{i.active_instructors}</span>
              </div>
              <div className="d-flex justify-content-between py-1 border-bottom small">
                <span className="text-muted">Current weekly plans</span><span>{i.current_plans}</span>
              </div>
              <div className="d-flex justify-content-between py-1 small">
                <span className="text-muted">Plan completion</span><span>{i.plan_completion}%</span>
              </div>
            </div>
          </div>

          <div className="card mb-4">
            <div className="card-body">
              <h5 className="card-title h6 fw-semibold">Attention needed</h5>
              <div className="d-flex justify-content-between py-1 border-bottom small">
                <span className="text-muted">Closings awaiting review</span>
                <Link href="/closings" className="fw-semibold text-decoration-none">{data.closings_pending}</Link>
              </div>
              <div className="d-flex justify-content-between py-1 border-bottom small">
                <span className="text-muted">Pending expenses</span>
                <Link href="/finance/expenses" className="fw-semibold text-decoration-none">{data.expenses_pending}</Link>
              </div>
              <div className="d-flex justify-content-between py-1 small">
                <span className="text-muted">Unread notifications</span>
                <span className="fw-semibold">{data.unread_notifications}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <h5 className="card-title h6 fw-semibold">Recent instructor scores</h5>
              {(i.recent_scores || []).length === 0 && <EmptyState message="No scores calculated yet." icon="bi-clipboard-data" />}
              {i.recent_scores.map((sc: any) => (
                <div key={sc.id} className="d-flex justify-content-between py-1 border-bottom small">
                  <span>{sc.employee_name}</span>
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