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
        eyebrow="My work"
        title={`Welcome back, ${user?.employee_name?.split(' ')[0] || 'there'}`}
        subtitle={`Your operations snapshot for ${data.today}`}
        actions={
          <>
            <Link href="/transactions/new" className="btn btn-accent">
              <i className="bi bi-plus-circle me-1" /> New transaction
            </Link>
            <Link href="/closings" className="btn btn-outline-primary">Daily closing</Link>
            <Link href="/earnings" className="btn btn-outline-primary">My earnings</Link>
          </>
        }
      />

      {actionError && <ErrorAlert message={actionError} onRetry={() => setActionError('')} />}

      <div className="row g-3 mb-4">
        <StatCard label="Transactions today" value={data.my_transactions_today} tone="primary" icon="bi-receipt" />
        <StatCard label="Transactions (month)" value={data.my_transactions_month} tone="primary" icon="bi-receipt-cutoff" />
        <StatCard label="Revenue (month)" value={fmtMoney(data.my_revenue_month)} tone="success" icon="bi-cash-stack" />
        <StatCard label="Commission (month)" value={fmtMoney(data.my_commission_month)} tone="warning" icon="bi-percent" />
        <StatCard label="Open tasks" value={data.my_open_tasks} sub={`${data.my_overdue_tasks} overdue`} tone={data.my_overdue_tasks > 0 ? 'danger' : 'primary'} icon="bi-check2-square" />
        <StatCard label="Closing (today)" value={data.closing_status_today ? data.closing_status_today.replace(/_/g, ' ') : 'Not submitted'} tone={data.closing_status_today === 'correction_requested' ? 'warning' : 'primary'} icon="bi-calendar-check" />
      </div>

      <div className="row g-4">
        <div className="col-lg-4">
          <div className="card h-100">
            <div className="card-header d-flex justify-content-between align-items-center">
              <span>Today&apos;s attendance</span>
              {att && <Badge status={att.status} />}
            </div>
            <div className="card-body">
              {att ? (
                <table className="table table-sm mb-3">
                  <tbody>
                    <tr><td className="text-muted">Clock in</td><td className="text-end">{att.clock_in ? fmtDateTime(att.clock_in) : '—'}</td></tr>
                    <tr><td className="text-muted">Clock out</td><td className="text-end">{att.clock_out ? fmtDateTime(att.clock_out) : '—'}</td></tr>
                    <tr><td className="text-muted">Hours</td><td className="text-end fw-semibold">{att.total_hours || 0}</td></tr>
                  </tbody>
                </table>
              ) : (
                <p className="text-muted small mb-3">No attendance record yet today. Clock in to start your shift.</p>
              )}
              <div className="d-flex gap-2">
                {(!att || !att.clock_in) && (
                  <button className="btn btn-teal" disabled={!!busy} onClick={() => act('clock-in', 'clock-in')}>
                    <i className="bi bi-box-arrow-in-right me-1" /> Clock in
                  </button>
                )}
                {att && att.clock_in && !att.clock_out && (
                  <button className="btn btn-warning text-white" disabled={!!busy} onClick={() => act('clock-out', 'clock-out')}>
                    <i className="bi bi-box-arrow-right me-1" /> Clock out
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-8">
          <div className="card h-100">
            <div className="card-header d-flex justify-content-between align-items-center">
              <span>Recent transactions</span>
              <Link href="/transactions" className="small text-decoration-none text-primary fw-semibold">View all</Link>
            </div>
            <div className="card-body p-0">
              {txn.error && <p className="text-danger small p-3 mb-0">{txn.error}</p>}
              {txn.loading && <Loading label="Loading…" />}
              {!txn.loading && (txn.data?.items || []).length === 0 && (
                <div className="p-3"><EmptyState message="No transactions yet." icon="bi-receipt" /></div>
              )}
              {(txn.data?.items || []).map((t: any) => (
                <div key={t.id} className="list-row d-flex justify-content-between align-items-center px-3 py-2">
                  <div className="d-flex align-items-center gap-3">
                    <div className="stat-icon d-none d-sm-flex" style={{ width: 36, height: 36, fontSize: 15, background: 'var(--brand-100)', color: 'var(--brand-700)' }}>
                      <i className="bi bi-receipt" />
                    </div>
                    <div>
                      <Link href={`/transactions/${t.id}`} className="fw-semibold text-decoration-none text-primary">{t.transaction_number}</Link>
                      <div className="small text-muted">{t.service_name} · {t.client_name}</div>
                    </div>
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