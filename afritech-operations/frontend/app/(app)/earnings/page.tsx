'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useFetch } from '@/lib/use-fetch';
import { api, fmtMoney, can, getUserCache } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PageHeader, Loading, ErrorAlert, EmptyState, Pagination, Badge, Modal, StatCard } from '@/components/ui';

export default function EarningsPage() {
  const { user } = useAuth();
  const viewAll = can(user, 'employees.earnings.view_all');
  const myId = getUserCache()?.employee_id ?? (user as any)?.employee_id;

  // Everyone can view their own earnings; only authorised roles see the full roster.
  const { data, error, loading } = useFetch(viewAll ? '/api/employees' : (myId ? `/api/employees/${myId}/earnings` : ''), [myId]);

  const isRoster = viewAll;
  const items = data?.items || [];
  const mine = isRoster ? null : data;

  if (error && !viewAll) return <ErrorAlert message={error} />;
  if (loading && viewAll) return <Loading label="Loading employees…" />;
  if (!viewAll && !data) return <Loading label="Loading my earnings…" />;

  if (!viewAll) {
    return (
      <div>
        <PageHeader title="My Earnings" subtitle="Your commission and payroll earnings" />
        <div className="mb-4">
          <StatCard label="Total commission earned" value={fmtMoney(mine?.total_commission_earned)} tone="warning" icon="bi-percent" />
        </div>
        <div className="card">
          <div className="card-body">
            <h6 className="card-title fw-semibold">Payroll items</h6>
            {(mine?.payroll_items || []).length === 0 && <EmptyState message="No payroll items yet." icon="bi-wallet2" />}
            {(mine?.payroll_items || []).length > 0 && (
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead><tr><th>Period</th><th className="text-end">Commission</th><th className="text-end">Net salary</th></tr></thead>
                  <tbody>
                    {(mine?.payroll_items || []).map((it: any) => (
                      <tr key={it.id}>
                        <td>Period #{it.payroll_period_id}</td>
                        <td className="text-end money text-warning">{fmtMoney(it.commission)}</td>
                        <td className="text-end money fw-semibold">{fmtMoney(it.net_salary)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return <EarningsRoster />;
}

function EarningsRoster() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const { data, error, loading, reload } = useFetch('/api/employees', [page, q], { page, per_page: 15, search: q || undefined });
  const [detail, setDetail] = useState<any | null>(null);
  const [detailError, setDetailError] = useState('');
  const [loadingDetail, setLoadingDetail] = useState(false);

  const items = data?.items || [];

  async function openDetail(emp: any) {
    setDetailError('');
    setLoadingDetail(true);
    try {
      const d: any = await api(`/api/employees/${emp.id}/earnings`);
      setDetail(d);
    } catch (e: any) {
      setDetailError(e.message);
    } finally {
      setLoadingDetail(false);
    }
  }

  return (
    <div>
      <PageHeader title="Earnings" subtitle="Commission and payroll earnings by employee" />

      <div className="card mb-3">
        <div className="card-body py-2 d-flex align-items-center">
          <i className="bi bi-search text-muted me-2" />
          <input className="form-control form-control-sm border-0 shadow-none" placeholder="Search employees…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={reload} />}
      {loading && <Loading />}
      {!loading && !error && items.length === 0 && <EmptyState message="No employees found" />}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="card">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr><th>Employee</th><th>Position</th><th>Payment type</th><th className="text-end">Base pay</th><th>Status</th><th /></tr>
                </thead>
                <tbody>
                  {items.map((e: any) => (
                    <tr key={e.id}>
                      <td><Link href={`/employees/${e.id}`} className="text-decoration-none fw-semibold">{e.full_name}</Link><div className="small text-muted">{e.employee_number}</div></td>
                      <td>{e.position || '—'}</td>
                      <td className="text-capitalize">{e.salary_type}</td>
                      <td className="text-end money">{e.salary_type === 'hourly' ? `${fmtMoney(e.hourly_rate)}/hr` : fmtMoney(e.base_salary)}</td>
                      <td><Badge status={e.status} /></td>
                      <td className="text-end">
                        <button className="btn btn-sm btn-outline-primary" onClick={() => openDetail(e)} disabled={loadingDetail}><i className="bi bi-wallet2 me-1" /> Earnings</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination page={page} pages={data?.pages || 1} total={data?.total} onPage={setPage} />
        </>
      )}

      <Modal show={!!detail} title={`Earnings — ${detail?.employee?.full_name || ''}`} onClose={() => setDetail(null)}
        footer={<button className="btn btn-outline-secondary" onClick={() => setDetail(null)}>Close</button>}
      >
        {detailError && <ErrorAlert message={detailError} />}
        <div className="alert alert-info">Total commission earned (from payroll items): <strong>{fmtMoney(detail?.total_commission_earned)}</strong></div>
        {(detail?.payroll_items || []).length === 0 && <EmptyState message="No payroll items yet" />}
        {(detail?.payroll_items || []).length > 0 && (
          <div className="table-responsive">
            <table className="table table-sm mb-0">
              <thead><tr><th>Period</th><th className="text-end">Commission</th><th className="text-end">Net</th></tr></thead>
              <tbody>
                {(detail?.payroll_items || []).map((it: any) => (
                  <tr key={it.id}>
                    <td><Link href={`/finance/payroll?period=${it.payroll_period_id}`} className="text-decoration-none">Period #{it.payroll_period_id}</Link></td>
                    <td className="text-end money text-warning">{fmtMoney(it.commission)}</td>
                    <td className="text-end money fw-semibold">{fmtMoney(it.net_salary)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}