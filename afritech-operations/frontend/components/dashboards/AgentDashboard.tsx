'use client';

import Link from 'next/link';
import { useState, useCallback } from 'react';
import { api, fmtMoney, fmtDateTime } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useFetch } from '@/lib/use-fetch';
import { PageHeader, Loading, ErrorAlert, StatCard, Badge, EmptyState } from '@/components/ui';

export default function AgentDashboard() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useFetch('/api/dashboard/me');
  const txn = useFetch('/api/transactions?per_page=5');
  const [busy, setBusy] = useState('');
  const [actionError, setActionError] = useState('');

  const act = useCallback(async (kind: 'clock-in' | 'clock-out', label: string) => {
    setActionError('');
    setBusy(label);
    try {
      await api(`/api/attendance/${kind}`, { method: 'POST' });
      reload();
    } catch (e: any) {
      setActionError(e.message);
    } finally {
      setBusy('');
    }
  }, [reload]);

  if (error) return <ErrorAlert message={error} />;
  if (loading || !data) return <Loading label="Loading your dashboard…" />;

  const att = data.today_attendance;

  return (
    <div>
      <PageHeader
        title="My Dashboard"
        subtitle={`Operations snapshot for ${user?.employee_name || 'you'} — ${data.today}`}
        actions={
          <>
            <Link href="/transactions/new" className="btn btn-primary">
              <i className="bi bi-plus-circle me-1" /> New transaction
            </Link>
            <Link href="/closings" className="btn btn-outline-primary">Daily closing</Link>
            <Link href="/earnings" className="btn btn-outline-secondary">My earnings</Link>
          </>
        }
      />

      {actionError && <ErrorAlert message={actionError} onRetry={() => setActionError('')} />}

      <div className="row g-3 mb-4">
        <StatCard label="My transactions today" value={data.my_transactions_today} tone="primary" icon="bi-receipt" />
        <StatCard label="My transactions (month)" value={data.my_transactions_month} tone="primary" icon="bi-receipt-cutoff" />
        <StatCard label="My revenue (month)" value={fmtMoney(data.my_revenue_month)} tone="success" icon="bi-cash-stack" />
        <StatCard label="My commission (month)" value={fmtMoney(data.my_commission_month)} tone="warning" icon="bi-percent" />
        <StatCard label="Open tasks" value={data.my_open_tasks} sub={`${data.my_overdue_tasks} overdue`} tone={data.my_overdue_tasks > 0 ? 'danger' : 'primary'} icon="bi-check2-square" />
        <StatCard label="Closing (today)" value={data.closing_status_today ? data.closing_status_today.replace(/_/g, ' ') : 'Not submitted'} tone="primary" icon="bi-calendar-check" />
      </div>

      <div className="row g-4">
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h5 className="card-title h6 fw-semibold mb-0">Today&apos;s attendance</h5>
                {att && <Badge status={att.status} />}
              </div>
              {att ? (
                <table className="table table-sm mb-3">
                  <tbody>
                    <tr><td className="text-muted">Clock in</td><td>{att.clock_in ? fmtDateTime(att.clock_in) : '—'}</td></tr>
                    <tr><td className="text-muted">Clock out</td><td>{att.clock_out ? fmtDateTime(att.clock_out) : '—'}</td></tr>
                    <tr><td className="text-muted">Hours</td><td>{att.total_hours || 0}</td></tr>
                  </tbody>
                </table>
              ) : (
                <p className="text-muted small mb-3">No attendance record yet today. Clock in to start your shift.</p>
              )}
              <div className="d-flex gap-2">
                {(!att || !att.clock_in) && (
                  <button className="btn btn-sm btn-success" disabled={!!busy} onClick={() => act('clock-in', 'clock-in')}>
                    <i className="bi bi-box-arrow-in-right me-1" /> Clock in
                  </button>
                )}
                {att && att.clock_in && !att.clock_out && (
                  <button className="btn btn-sm btn-warning" disabled={!!busy} onClick={() => act('clock-out', 'clock-out')}>
                    <i className="bi bi-box-arrow-right me-1" /> Clock out
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h5 className="card-title h6 fw-semibold mb-0">Recent transactions</h5>
                <Link href="/transactions" className="small text-decoration-none">View all</Link>
              </div>
              {txn.error && <p className="text-danger small mb-0">{txn.error}</p>}
              {txn.loading && <Loading label="Loading…" />}
              {!txn.loading && (txn.data?.items || []).length === 0 && <EmptyState message="No transactions yet." icon="bi-receipt" />}
              {(txn.data?.items || []).map((t: any) => (
                <div key={t.id} className="d-flex justify-content-between align-items-center py-2 border-bottom small">
                  <div>
                    <Link href={`/transactions/${t.id}`} className="fw-semibold text-decoration-none">{t.transaction_number}</Link>
                    <div className="text-muted">{t.service_name} · {t.client_name}</div>
                  </div>
                  <div className="text-end">
                    <div className="money fw-semibold">{fmtMoney(t.customer_price)}</div>
                    <Badge status={t.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}