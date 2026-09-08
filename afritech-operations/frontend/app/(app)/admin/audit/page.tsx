'use client';

import { useState } from 'react';
import { useFetch } from '@/lib/use-fetch';
import { fmtDateTime } from '@/lib/api';
import { PageHeader, Loading, ErrorAlert, EmptyState, Pagination, Badge } from '@/components/ui';

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const { data, error, loading } = useFetch('/api/audit', [page, action], { page, per_page: 30, action: action || undefined });

  const items = data?.items || [];

  return (
    <div>
      <PageHeader title="Audit Log" subtitle="Complete trail of actions and changes" />

      <div className="card mb-3">
        <div className="card-body d-flex align-items-center gap-2 py-2 flex-wrap">
          <i className="bi bi-funnel text-muted" />
          <input className="form-control form-control-sm" style={{ width: 220 }} placeholder="Filter by action (e.g. login, transaction_created)…" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} />
        </div>
      </div>

      {error && <ErrorAlert message={error} />}
      {loading && <Loading />}
      {!loading && !error && items.length === 0 && <EmptyState message="No audit records" />}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="card">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr><th>When</th><th>User</th><th>Action</th><th>Entity</th><th>IP</th></tr>
                </thead>
                <tbody>
                  {items.map((a: any) => (
                    <tr key={a.id}>
                      <td className="small">{fmtDateTime(a.created_at)}</td>
                      <td>{a.user_email || 'System'}</td>
                      <td><Badge status={a.action} /></td>
                      <td>{a.entity} <span className="text-muted">#{a.entity_id}</span></td>
                      <td className="small text-muted">{a.ip_address || '—'}</td>
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