'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useFetch } from '@/lib/use-fetch';
import { api, fmtDateTime } from '@/lib/api';
import { PageHeader, Loading, ErrorAlert, EmptyState, Pagination, Badge } from '@/components/ui';

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useFetch('/api/notifications', [page], { page, per_page: 30 });
  const [unread, setUnread] = useState(0);
  const { data: countData } = useFetch('/api/notifications/unread-count');

  const items = data?.items || [];

  async function markRead(n: any) {
    if (n.is_read) return;
    await api(`/api/notifications/${n.id}/read`, { method: 'POST' });
    reload();
  }

  async function markAll() {
    await api('/api/notifications/read-all', { method: 'POST' });
    reload();
  }

  return (
    <div>
      <PageHeader title="Notifications" subtitle={`${countData?.unread ?? 0} unread`}
        actions={items.some((n: any) => !n.is_read) && (
          <button className="btn btn-sm btn-outline-primary" onClick={markAll}><i className="bi bi-check2-all me-1" />Mark all read</button>
        )} />

      {error && <ErrorAlert message={error} />}
      {loading && <Loading />}
      {!loading && !error && items.length === 0 && <EmptyState message="No notifications" icon="bi-bell-slash" />}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="list-group">
            {items.map((n: any) => (
              <button key={n.id} className={`list-group-item list-group-item-action ${n.is_read ? '' : 'bg-primary-subtle border-primary-subtle'}`} onClick={() => markRead(n)}>
                <div className="d-flex justify-content-between align-items-start gap-2">
                  <div>
                    <div className="fw-semibold d-flex align-items-center gap-2">
                      {!n.is_read && <span className="badge bg-primary rounded-pill">New</span>}
                      <span className="text-capitalize">{n.type.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="small">{n.message}</div>
                    <div className="small text-muted">{fmtDateTime(n.created_at)}</div>
                  </div>
                  <Badge status={n.severity} />
                </div>
              </button>
            ))}
          </div>
          <Pagination page={page} pages={data?.pages || 1} total={data?.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}