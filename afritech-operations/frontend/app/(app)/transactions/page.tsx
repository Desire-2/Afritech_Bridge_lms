'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useFetch, todayIso, yearAgoIso } from '@/lib/use-fetch';
import { api, fmtMoney, fmtDate } from '@/lib/api';
import { PageHeader, Loading, ErrorAlert, EmptyState, Badge, Pagination } from '@/components/ui';
import { DateRange } from '@/components/form';
import { useAuth } from '@/lib/auth';
import { hasRole } from '@/lib/api';

export default function TransactionsPage() {
  const { user } = useAuth();
  const [start, setStart] = useState(yearAgoIso());
  const [end, setEnd] = useState(todayIso());
  const [status, setStatus] = useState('completed');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const isAgent = hasRole(user, 'service_agent') && !user?.is_super_admin;

  const { data, error, loading, reload } = useFetch('/api/transactions', [page, status, start, end], {
    page,
    per_page: 20,
    status: status === 'all' ? undefined : status,
    start,
    end,
    search: search || undefined,
  });

  const items = data?.items || [];

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Transactions"
        subtitle="Service centre transactions and commissions"
        actions={
          <Link href="/transactions/new" className="btn btn-accent">
            <i className="bi bi-plus-circle me-1" /> New transaction
          </Link>
        }
      />

      <div className="card mb-3">
        <div className="card-body d-flex flex-wrap gap-2 align-items-center">
          <DateRange start={start} end={end} onStart={(v) => { setStart(v); setPage(1); }} onEnd={(v) => { setEnd(v); setPage(1); }} />
          <select className="form-select form-select-sm" style={{ width: 160 }} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="completed">Completed</option>
            <option value="all">All statuses</option>
            <option value="processing">Processing</option>
            <option value="created">Created</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
            <option value="failed">Failed</option>
          </select>
          <div className="input-group input-group-sm" style={{ maxWidth: 280 }}>
            <span className="input-group-text"><i className="bi bi-search" /></span>
            <input
              className="form-control"
              placeholder="Search ref / client / service…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); reload(); } }}
            />
          </div>
          <button className="btn btn-sm btn-outline-secondary" onClick={reload} title="Refresh"><i className="bi bi-arrow-clockwise" /></button>
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={reload} />}
      {loading && <Loading />}
      {!loading && !error && items.length === 0 && <EmptyState message="No transactions in this range" icon="bi-receipt-cutoff" />}
      {!loading && !error && items.length > 0 && (
        <>
          <div className="card">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr>
                    <th>Number</th>
                    <th>Date</th>
                    <th>Service</th>
                    <th>Client</th>
                    <th>{isAgent ? 'You' : 'Employee'}</th>
                    <th className="text-end">Revenue</th>
                    <th className="text-end">Commission</th>
                    <th className="text-end">Company</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((t: any) => (
                    <tr key={t.id}>
                      <td><Link href={`/transactions/${t.id}`} className="fw-semibold text-decoration-none text-primary">{t.transaction_number}</Link></td>
                      <td className="text-muted">{fmtDate(t.transaction_date)}</td>
                      <td>{t.service_name}</td>
                      <td>{t.client_name}</td>
                      <td>{t.employee_name}</td>
                      <td className="text-end money fw-semibold">{fmtMoney(t.customer_price)}</td>
                      <td className="text-end money text-warning">{fmtMoney(t.commission_amount)}</td>
                      <td className="text-end money text-success fw-semibold">{fmtMoney(t.company_profit)}</td>
                      <td><Badge status={t.status} /></td>
                      <td className="text-end">
                        <Link href={`/transactions/${t.id}`} className="btn btn-sm btn-outline-secondary" title="View details">
                          <i className="bi bi-chevron-right" />
                        </Link>
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
    </div>
  );
}