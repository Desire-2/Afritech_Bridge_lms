'use client';

import { useState } from 'react';
import { useFetch, todayIso, yearAgoIso } from '@/lib/use-fetch';
import { api, fmtMoney, fmtDate } from '@/lib/api';
import { PageHeader, Loading, ErrorAlert, EmptyState, Badge, StatCard } from '@/components/ui';
import { DateRange } from '@/components/form';

export default function CashReconciliationPage() {
  const [start, setStart] = useState(yearAgoIso());
  const [end, setEnd] = useState(todayIso());
  const { data, error, loading } = useFetch<any>('/api/reports/cash-reconciliation', [start, end], { start, end });

  if (error) return <ErrorAlert message={error} />;

  return (
    <div>
      <PageHeader title="Cash Reconciliation" subtitle="Daily closings vs actual cash counted" />

      <div className="card mb-3">
        <div className="card-body d-flex gap-2 align-items-center">
          <DateRange start={start} end={end} onStart={setStart} onEnd={setEnd} />
        </div>
      </div>

      {loading && <Loading />}
      {data && (
        <>
          <div className="row g-3 mb-4">
            <StatCard label="Closings" value={data.count} tone="primary" icon="bi-calendar-check" />
            <StatCard label="Expected cash" value={fmtMoney(data.total_expected)} tone="primary" icon="bi-cash-stack" />
            <StatCard label="Actual cash" value={fmtMoney(data.total_actual)} tone="success" icon="bi-cash-coin" />
            <StatCard label="Total difference" value={fmtMoney(data.total_difference)} tone={Number(data.total_difference) === 0 ? 'success' : 'danger'} icon="bi-exclamation-triangle" />
            <StatCard label="Exact matches" value={data.exact_count} tone="success" icon="bi-check-circle" />
            <StatCard label="Shortages" value={String(data.shortage_count)} tone="danger" icon="bi-arrow-down" />
            <StatCard label="Overages" value={String(data.overage_count)} tone="warning" icon="bi-arrow-up" />
          </div>

          <div className="card">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr><th>Date</th><th>Employee</th><th className="text-end">Expected cash</th><th className="text-end">Actual cash</th><th className="text-end">Difference</th><th>Class</th><th>Status</th><th>Note</th></tr>
                </thead>
                <tbody>
                  {(data.closings || []).length === 0 && <tr><td colSpan={8}><EmptyState message="No closings in range" /></td></tr>}
                  {(data.closings || []).map((c: any) => (
                    <tr key={c.id}>
                      <td>{fmtDate(c.closing_date)}</td>
                      <td>{c.employee_name}</td>
                      <td className="text-end money">{fmtMoney(c.expected_cash)}</td>
                      <td className="text-end money">{fmtMoney(c.actual_cash)}</td>
                      <td className={`text-end money fw-semibold ${Number(c.cash_difference) < 0 ? 'text-danger' : Number(c.cash_difference) > 0 ? 'text-warning' : 'text-success'}`}>{fmtMoney(c.cash_difference)}</td>
                      <td><Badge status={c.reconciliation_class} /></td>
                      <td><Badge status={c.status} /></td>
                      <td className="text-muted small">{c.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}