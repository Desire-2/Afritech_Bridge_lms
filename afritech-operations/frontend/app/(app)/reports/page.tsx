'use client';

import { useState } from 'react';
import { useFetch, todayIso } from '@/lib/use-fetch';
import { api, fmtMoney } from '@/lib/api';
import { PageHeader, Loading, ErrorAlert, EmptyState, StatCard, Badge, Pagination } from '@/components/ui';
import { DateRange } from '@/components/form';

type Tab = 'summary' | 'by-service' | 'by-employee' | 'expenses' | 'attendance' | 'payroll';

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('summary');
  const [start, setStart] = useState(todayIso(-30));
  const [end, setEnd] = useState(todayIso());

  const { data: summary, loading: lSum, error: eSum } = useFetch<any>('/api/reports/summary', [start, end], { start, end });
  const { data: bySvc, loading: lSvc, error: eSvc } = useFetch<any>('/api/reports/by-service', [start, end], { start, end });
  const { data: byEmp, loading: lEmp, error: eEmp } = useFetch<any>('/api/reports/by-employee', [start, end], { start, end });
  const { data: exp, loading: lExp, error: eExp } = useFetch<any>('/api/reports/expenses', [start, end], { start, end });
  const { data: att, loading: lAtt, error: eAtt } = useFetch<any>('/api/reports/attendance', [start, end], { start, end });
  const { data: payroll, loading: lPay, error: ePay } = useFetch<any>('/api/reports/payroll', [start, end], { start, end });

  const tabs: { key: Tab; label: string }[] = [
    { key: 'summary', label: 'Summary' },
    { key: 'by-service', label: 'By service' },
    { key: 'by-employee', label: 'By employee' },
    { key: 'expenses', label: 'Expenses' },
    { key: 'attendance', label: 'Attendance' },
    { key: 'payroll', label: 'Payroll' },
  ];

  return (
    <div>
      <PageHeader title="Reports" subtitle="Business performance reports" />

      <div className="card mb-3">
        <div className="card-body d-flex flex-wrap gap-2 align-items-center">
          <DateRange start={start} end={end} onStart={(v) => { setStart(v); setTab('summary'); }} onEnd={(v) => { setEnd(v); setTab('summary'); }} />
          <a className="btn btn-sm btn-outline-secondary" href={`/api/reports/export/csv?report=revenue&start=${start}&end=${end}`} target="_blank" rel="noreferrer"><i className="bi bi-filetype-csv me-1" />CSV</a>
          <a className="btn btn-sm btn-outline-success" href={`/api/reports/export/excel?report=revenue&start=${start}&end=${end}`} target="_blank" rel="noreferrer"><i className="bi bi-file-earmark-excel me-1" />Excel</a>
          <a className="btn btn-sm btn-outline-danger" href={`/api/reports/export/transactions-pdf?start=${start}&end=${end}`} target="_blank" rel="noreferrer"><i className="bi bi-file-earmark-pdf me-1" />PDF</a>
        </div>
      </div>

      <ul className="nav nav-pills mb-3">
        {tabs.map((t) => (
          <li className="nav-item me-1" key={t.key}>
            <button className={`nav-link py-1 px-3 ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
          </li>
        ))}
      </ul>

      {tab === 'summary' && (lSum ? <Loading /> : eSum ? <ErrorAlert message={eSum} /> : summary && (
        <div>
          <div className="row g-3 mb-4">
            <StatCard label="Revenue" value={fmtMoney(summary.revenue)} tone="primary" icon="bi-cash-stack" />
            <StatCard label="Gross profit" value={fmtMoney(summary.gross_profit)} tone="success" icon="bi-graph-up-arrow" />
            <StatCard label="Company profit" value={fmtMoney(summary.company_profit)} tone="success" icon="bi-piggy-bank" />
            <StatCard label="Net profit" value={fmtMoney(summary.net_profit)} tone={summary.net_profit < 0 ? 'danger' : 'success'} icon="bi-calculator" />
          </div>
          <div className="card">
            <div className="table-responsive">
              <table className="table table-sm mb-0">
                <tbody>
                  <tr><td className="text-muted">Transactions ({summary.transaction_count})</td><td className="text-end money">{fmtMoney(summary.revenue)}</td></tr>
                  <tr><td className="text-muted">Service costs</td><td className="text-end money text-danger">− {fmtMoney(summary.service_costs)}</td></tr>
                  <tr><td className="text-muted">Commissions</td><td className="text-end money text-warning">− {fmtMoney(summary.commissions)}</td></tr>
                  <tr><td className="text-muted">Company profit</td><td className="text-end money text-success fw-semibold">{fmtMoney(summary.company_profit)}</td></tr>
                  <tr><td className="text-muted">Expenses</td><td className="text-end money text-danger">− {fmtMoney(summary.expenses)}</td></tr>
                  <tr><td className="text-muted">Payroll</td><td className="text-end money text-danger">− {fmtMoney(summary.payroll)}</td></tr>
                  <tr className="border-top"><td className="fw-semibold">Net profit</td><td className={`text-end money fw-bold ${summary.net_profit < 0 ? 'text-danger' : 'text-success'}`}>{fmtMoney(summary.net_profit)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}

      {(tab === 'by-service' || tab === 'by-employee') && (
        <div className="card">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead>
                {tab === 'by-service' ? (
                  <tr><th>Service</th><th className="text-center">Count</th><th className="text-end">Revenue</th><th className="text-end">Cost</th><th className="text-end">Gross profit</th><th className="text-end">Commission</th><th className="text-end">Company profit</th></tr>
                ) : (
                  <tr><th>Employee</th><th className="text-center">Count</th><th className="text-end">Revenue</th><th className="text-end">Gross profit</th><th className="text-end">Commission</th><th className="text-end">Company profit</th></tr>
                )}
              </thead>
              {lSvc || lEmp ? <tbody><tr><td colSpan={7}><Loading /></td></tr></tbody> : (eSvc || eEmp) ? <tbody><tr><td colSpan={7}><ErrorAlert message={eSvc || eEmp} /></td></tr></tbody> : (
                <tbody>
                  {tab === 'by-service'
                    ? ((bySvc?.items || []).map((r: any) => (
                      <tr key={r.service}>
                        <td className="fw-semibold">{r.service}</td>
                        <td className="text-center">{r.count}</td>
                        <td className="text-end money">{fmtMoney(r.revenue)}</td>
                        <td className="text-end money">{fmtMoney(r.cost)}</td>
                        <td className="text-end money">{fmtMoney(r.gross_profit)}</td>
                        <td className="text-end money text-warning">{fmtMoney(r.commission)}</td>
                        <td className="text-end money fw-semibold text-success">{fmtMoney(r.company_profit)}</td>
                      </tr>
                    )))
                    : ((byEmp?.items || []).map((r: any) => (
                      <tr key={r.employee}>
                        <td className="fw-semibold">{r.employee}</td>
                        <td className="text-center">{r.count}</td>
                        <td className="text-end money">{fmtMoney(r.revenue)}</td>
                        <td className="text-end money">{fmtMoney(r.gross_profit)}</td>
                        <td className="text-end money text-warning">{fmtMoney(r.commission)}</td>
                        <td className="text-end money fw-semibold text-success">{fmtMoney(r.company_profit)}</td>
                      </tr>
                    )))}
                  {(tab === 'by-service' ? bySvc?.items?.length : byEmp?.items?.length) === 0 && <tr><td colSpan={7}><EmptyState /></td></tr>}
                </tbody>
              )}
            </table>
          </div>
        </div>
      )}

      {tab === 'expenses' && (lExp ? <Loading /> : eExp ? <ErrorAlert message={eExp} /> : exp && (
        <div>
          <div className="row g-3 mb-4">
            <StatCard label="Total expenses" value={fmtMoney(exp.total)} tone="danger" icon="bi-receipt-cutoff" />
            <StatCard label="Expense records" value={exp.count} tone="primary" icon="bi-list" />
          </div>
          <div className="card">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead><tr><th>Category</th><th className="text-end">Count</th><th className="text-end">Total</th></tr></thead>
                <tbody>
                  {(exp.by_category || []).map((c: any) => (
                    <tr key={c.category}>
                      <td className="text-uppercase fw-semibold">{c.category}</td>
                      <td className="text-end">{c.count}</td>
                      <td className="text-end money fw-semibold">{fmtMoney(c.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}

      {tab === 'attendance' && (lAtt ? <Loading /> : eAtt ? <ErrorAlert message={eAtt} /> : att && (
        <div>
          <div className="row g-3 mb-4">
            <StatCard label="Total records" value={att.total_records} tone="primary" icon="bi-clock-history" />
            {Object.entries(att.by_status || {}).map(([k, v]: any) => (
              <StatCard key={k} label={k} value={v.count} tone={k === 'absent' ? 'danger' : 'primary'} icon="bi-calendar-check" />
            ))}
          </div>
          <div className="card">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead><tr><th>Employee</th><th className="text-end">Present</th><th className="text-end">Late</th><th className="text-end">Absent</th><th className="text-end">Leave</th><th className="text-end">Total hours</th></tr></thead>
                <tbody>
                  {(att.by_employee || []).map((r: any) => (
                    <tr key={r.employee_id}>
                      <td className="fw-semibold">{r.employee}</td>
                      <td className="text-end">{r.present}</td>
                      <td className="text-end">{r.late}</td>
                      <td className="text-end">{r.absent}</td>
                      <td className="text-end">{r.leave}</td>
                      <td className="text-end">{r.total_hours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}

      {tab === 'payroll' && (lPay ? <Loading /> : ePay ? <ErrorAlert message={ePay} /> : payroll && (
        <div>
          <div className="row g-3 mb-4">
            <StatCard label="Payroll total (approved/paid)" value={fmtMoney(payroll.total_net)} tone="primary" icon="bi-wallet2" />
          </div>
          <div className="card">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead><tr><th>Period</th><th>Status</th><th className="text-end">Total net</th></tr></thead>
                <tbody>
                  {(payroll.periods || []).map((p: any) => (
                    <tr key={p.name}>
                      <td className="fw-semibold">{p.name}</td>
                      <td><Badge status={p.status} /></td>
                      <td className="text-end money fw-semibold">{fmtMoney(p.total_net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}