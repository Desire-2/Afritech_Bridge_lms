'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useFetch } from '@/lib/use-fetch';
import { api, fmtMoney, fmtDate, fmtDateTime } from '@/lib/api';
import { PageHeader, Loading, ErrorAlert, Badge, Pagination, EmptyState } from '@/components/ui';

type Tab = 'overview' | 'earnings' | 'transactions' | 'attendance' | 'tasks' | 'performance';

export default function EmployeeDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [tab, setTab] = useState<Tab>('overview');
  const { data, error, loading: l1, reload } = useFetch<any>(`/api/employees/${id}`, [id]);

  // sub-resource pages
  const [tPage, setTPage] = useState(1);
  const { data: txns } = useFetch<any>(`/api/employees/${id}/transactions`, [id, tab, tPage], { page: tPage, per_page: 10 });
  const [aPage, setAPage] = useState(1);
  const { data: att } = useFetch<any>(`/api/employees/${id}/attendance`, [id, tab, aPage], { page: aPage, per_page: 10 });
  const [taskPage, setTaskPage] = useState(1);
  const { data: tasks } = useFetch<any>(`/api/employees/${id}/tasks`, [id, tab, taskPage], { page: taskPage, per_page: 10 });
  const { data: earnings } = useFetch<any>(`/api/employees/${id}/earnings`, [id]);
  const { data: perf } = useFetch<any>(`/api/employees/${id}/performance`, [id]);

  if (l1) return <Loading />;
  if (error) return <ErrorAlert message={error} onRetry={reload} />;

  const emp = data.employee;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'earnings', label: 'Earnings' },
    { key: 'transactions', label: 'Transactions' },
    { key: 'attendance', label: 'Attendance' },
    { key: 'tasks', label: 'Tasks' },
    { key: 'performance', label: 'Performance' },
  ];

  return (
    <div>
      <PageHeader title={emp.full_name} subtitle={`${emp.employee_number} · ${emp.position || '—'}`}
        actions={<Link href="/employees" className="btn btn-sm btn-outline-secondary"><i className="bi bi-arrow-left me-1" /> Employees</Link>} />

      <div className="mb-3">
        <Badge status={emp.status} />
        {emp.is_instructor && <span className="badge border bg-info-subtle text-info border-info-subtle ms-1">Instructor</span>}
      </div>

      <ul className="nav nav-pills mb-3">
        {tabs.map((t) => (
          <li className="nav-item me-1" key={t.key}>
            <button className={`nav-link ${tab === t.key ? 'active' : ''} py-1 px-3`} onClick={() => setTab(t.key)}>{t.label}</button>
          </li>
        ))}
      </ul>

      {tab === 'overview' && (
        <div className="card">
          <div className="card-body">
            <table className="table table-sm mb-0">
              <tbody>
                <tr><td className="text-muted">Branch</td><td>{emp.branch || '—'}</td></tr>
                <tr><td className="text-muted">Department</td><td>{emp.department || '—'}</td></tr>
                <tr><td className="text-muted">Email</td><td>{emp.email || '—'}</td></tr>
                <tr><td className="text-muted">Phone</td><td>{emp.phone || '—'}</td></tr>
                <tr><td className="text-muted">National ID</td><td>{emp.national_id || '—'}</td></tr>
                <tr><td className="text-muted">Employment date</td><td>{fmtDate(emp.employment_date)}</td></tr>
                <tr><td className="text-muted">Pay</td><td>{emp.salary_type === 'hourly' ? `${fmtMoney(emp.hourly_rate)}/hr` : `${fmtMoney(emp.base_salary)}/month`}</td></tr>
                <tr><td className="text-muted">Default commission rate</td><td>{emp.default_commission_rate != null ? `${Math.round(emp.default_commission_rate * 100)}%` : 'Default'}</td></tr>
                <tr><td className="text-muted">Emergency contact</td><td>{emp.emergency_contact || '—'}</td></tr>
                <tr><td className="text-muted">Gender</td><td>{emp.gender || '—'}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'earnings' && (
        <div className="card">
          <div className="card-body">
            <div className="alert alert-info small">Total commission earned from transactions: <strong>{fmtMoney(earnings?.total_commission_earned)}</strong></div>
            {(earnings?.payroll_items || []).length === 0 && <EmptyState message="No payroll items yet" />}
            <div className="table-responsive">
              <table className="table table-sm mb-0">
                <thead>
                  <tr><th>Period</th><th className="text-end">Base</th><th className="text-end">Commission</th><th className="text-end">Bonus</th><th className="text-end">Deduction</th><th className="text-end">Advance</th><th className="text-end">Adjustment</th><th className="text-end">Net</th></tr>
                </thead>
                <tbody>
                  {(earnings?.payroll_items || []).map((it: any) => (
                    <tr key={it.id}>
                      <td><Link href={`/finance/payroll?period=${it.payroll_period_id}`} className="text-decoration-none">Period #{it.payroll_period_id}</Link></td>
                      <td className="text-end money">{fmtMoney(it.base_salary)}</td>
                      <td className="text-end money text-warning">{fmtMoney(it.commission)}</td>
                      <td className="text-end money">{fmtMoney(it.bonus)}</td>
                      <td className="text-end money text-danger">{fmtMoney(it.deduction)}</td>
                      <td className="text-end money">{fmtMoney(it.advance)}</td>
                      <td className="text-end money">{fmtMoney(it.adjustment)}</td>
                      <td className="text-end money fw-semibold">{fmtMoney(it.net_salary)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'transactions' && (
        <div className="card">
          <div className="card-body">
            {(txns?.items || []).length === 0 && <EmptyState message="No transactions yet" />}
            <div className="table-responsive">
              <table className="table table-sm mb-0">
                <thead><tr><th>Number</th><th>Date</th><th>Service</th><th>Client</th><th className="text-end">Revenue</th><th className="text-end">Commission</th><th>Status</th></tr></thead>
                <tbody>
                  {(txns?.items || []).map((t: any) => (
                    <tr key={t.id}>
                      <td><Link href={`/transactions/${t.id}`} className="text-decoration-none fw-semibold">{t.transaction_number}</Link></td>
                      <td>{fmtDate(t.transaction_date)}</td>
                      <td>{t.service_name}</td>
                      <td>{t.client_name}</td>
                      <td className="text-end money">{fmtMoney(t.customer_price)}</td>
                      <td className="text-end money text-warning">{fmtMoney(t.commission_amount)}</td>
                      <td><Badge status={t.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={tPage} pages={txns?.pages || 1} onPage={setTPage} />
          </div>
        </div>
      )}

      {tab === 'attendance' && (
        <div className="card">
          <div className="card-body">
            {(att?.items || []).length === 0 && <EmptyState message="No attendance records" />}
            <div className="table-responsive">
              <table className="table table-sm mb-0">
                <thead><tr><th>Date</th><th>Clock in</th><th>Clock out</th><th>Hours</th><th>Overtime</th><th>Status</th><th>Note</th></tr></thead>
                <tbody>
                  {(att?.items || []).map((a: any) => (
                    <tr key={a.id}>
                      <td>{fmtDate(a.attendance_date)}</td>
                      <td>{a.clock_in ? fmtDateTime(a.clock_in) : '—'}</td>
                      <td>{a.clock_out ? fmtDateTime(a.clock_out) : '—'}</td>
                      <td>{a.total_hours || 0}</td>
                      <td>{a.overtime_hours || 0}</td>
                      <td><Badge status={a.status} /></td>
                      <td className="text-muted">{a.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={aPage} pages={att?.pages || 1} onPage={setAPage} />
          </div>
        </div>
      )}

      {tab === 'tasks' && (
        <div className="card">
          <div className="card-body">
            {(tasks?.items || []).length === 0 && <EmptyState message="No tasks assigned" />}
            <div className="table-responsive">
              <table className="table table-sm mb-0">
                <thead><tr><th>Title</th><th>Priority</th><th>Due</th><th>Status</th><th>Created</th></tr></thead>
                <tbody>
                  {(tasks?.items || []).map((t: any) => (
                    <tr key={t.id}>
                      <td className="fw-semibold">{t.title}</td>
                      <td>{t.priority.toUpperCase()}</td>
                      <td>{fmtDate(t.due_date)}</td>
                      <td><Badge status={t.status} /></td>
                      <td>{fmtDate(t.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={taskPage} pages={tasks?.pages || 1} onPage={setTaskPage} />
          </div>
        </div>
      )}

      {tab === 'performance' && (
        <div className="card">
          <div className="card-body">
            {(perf?.scores || []).length === 0 && <EmptyState message="No performance scores yet — calculate them from Instructor Performance." />}
            {(perf?.scores || []).map((s: any) => (
              <div key={s.id} className="border-bottom py-2">
                <div className="d-flex justify-content-between">
                  <span className="fw-semibold">{s.period_start} → {s.period_end}</span>
                  <span className="fw-semibold">{s.overall_score} <span className="text-capitalize text-muted">({s.rating})</span></span>
                </div>
                <div className="row g-1 mt-1">
                  {(s.components || []).map((c: any) => (
                    <div className="col-md-6 small" key={c.id}>
                      <span className="text-muted">{c.name}:</span> {c.score} <span className="text-grey-muted">({Math.round(c.weighted_score * 100) / 100})</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}