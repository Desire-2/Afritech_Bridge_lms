'use client';

import { useState } from 'react';
import { useFetch } from '@/lib/use-fetch';
import { api, fmtDateTime } from '@/lib/api';
import { PageHeader, Loading, ErrorAlert, EmptyState, Pagination, Badge } from '@/components/ui';

const SEVERITY_ICON: Record<string, string> = {
  info: 'bi-info-circle',
  warning: 'bi-exclamation-triangle',
  error: 'bi-x-octagon',
  success: 'bi-check-circle',
};

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useFetch('/api/notifications', [page], { page, per_page: 30 });
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
      <PageHeader eyebrow="Notifications" title="Notifications"
        subtitle={`${countData?.unread ?? 0} unread`}
        actions={items.some((n: any) => !n.is_read) && (
          <button className="btn btn-sm btn-outline-primary" onClick={markAll}><i className="bi bi-check2-all me-1" />Mark all read</button>
        )} />

      {error && <ErrorAlert message={error} />}
      {loading && <Loading />}
      {!loading && !error && items.length === 0 && <EmptyState message="No notifications" icon="bi-bell-slash" />}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="card">
            <div className="card-body p-0">
              {items.map((n: any) => (
                <button
                  key={n.id}
                  className={`notif-row w-100 text-start ${n.is_read ? '' : 'notif-unread'}`}
                  onClick={() => markRead(n)}
                >
                  <div className={`notif-sev bg-${n.severity === 'error' ? 'danger' : n.severity === 'warning' ? 'warning' : n.severity === 'success' ? 'success' : 'info'}-subtle`}>
                    <i className={`bi ${SEVERITY_ICON[n.severity] || SEVERITY_ICON.info}`} />
                  </div>
                  <div className="flex-grow-1 min-w-0">
                    <div className="d-flex justify-content-between align-items-center gap-2">
                      <div className="fw-semibold text-capitalize small">{n.type.replace(/_/g, ' ')}</div>
                      <span className="small text-muted text-nowrap">{fmtDateTime(n.created_at)}</span>
                    </div>
                    <div className="small text-muted text-truncate">{n.message}</div>
                  </div>
                  <div className="d-flex flex-column align-items-end gap-1">
                    <Badge status={n.severity} />
                    {!n.is_read && <span className="badge bg-primary rounded-pill">New</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
          <Pagination page={page} pages={data?.pages || 1} total={data?.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}