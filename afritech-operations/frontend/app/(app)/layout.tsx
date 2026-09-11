'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import AccessDenied from '@/components/AccessDenied';
import { useAuth } from '@/lib/auth';
import { api, fmtDateTime, logout } from '@/lib/api';
import { routeDenied, pageIdentity, roleLabel } from '@/lib/permissions';
import { Loading, Badge } from '@/components/ui';

interface NotifItem {
  id: number;
  type: string;
  severity: string;
  message: string;
  is_read: boolean;
  created_at: string | null;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [notice, setNotice] = useState<NotifItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const [list, count] = await Promise.all([
        api('/api/notifications?per_page=8'),
        api('/api/notifications/unread-count'),
      ]);
      setNotice((list as any)?.items || []);
      setUnread((count as any)?.unread || 0);
    } catch {
      setNotice([]);
      setUnread(0);
    }
  }, [user]);

  const markRead = useCallback(async (n: NotifItem) => {
    try {
      await api(`/api/notifications/${n.id}/read`, { method: 'POST' });
    } catch {
      // ignore; unread badge refreshes next poll
    }
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    refresh();
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, [user, refresh]);

  useEffect(() => {
    setBellOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  if (loading || !user) {
    return (
      <div className="login-page">
        <Loading label="Checking session…" />
      </div>
    );
  }

  const identity = pageIdentity(pathname);

  return (
    <div className="d-flex">
      <Sidebar open={menuOpen} onClose={closeMenu} />
      <div className="main-area flex-grow-1 d-flex flex-column">
        <header className="app-header">
          <div className="d-flex align-items-center gap-2">
            <button type="button" className="btn btn-sm btn-outline-secondary d-lg-none" onClick={() => setMenuOpen(true)} aria-label="Open menu">
              <i className="bi bi-list" />
            </button>
            <div>
              {identity.group && <div className="header-eyebrow">{identity.group}</div>}
              <h1>{identity.title}</h1>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2 position-relative">
            <button
              type="button"
              className="icon-btn"
              onClick={() => { setBellOpen((o) => !o); refresh(); }}
              aria-label="Notifications"
              aria-expanded={bellOpen}
            >
              <i className="bi bi-bell" />
              {unread > 0 && (
                <span className="badge-notify position-absolute top-0 start-100 translate-middle bg-danger text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
            {bellOpen && (
              <div className="notif-dropdown card shadow border-0">
                <div className="card-header py-2 small fw-semibold d-flex justify-content-between align-items-center">
                  Notifications
                  <Link href="/notifications" className="small text-decoration-none">View all</Link>
                </div>
                <div className="list-group list-group-flush notif-list">
                  {notice.length === 0 && <div className="list-group-item small text-muted">No notifications.</div>}
                  {notice.map((n) => (
                    <Link href="/notifications" key={n.id} onClick={() => markRead(n)} className={`list-group-item list-group-item-action ${n.is_read ? '' : 'bg-primary-subtle'}`}>
                      <div className="small fw-semibold mb-1">{n.message || n.type}</div>
                      <div className="small text-muted d-flex align-items-center gap-2">
                        <Badge status={n.severity} />
                        <span>{fmtDateTime(n.created_at)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            <span className="role-chip">{roleLabel(user)}</span>
            <Link href="/profile" className="nav-user d-inline-flex align-items-center gap-2 px-3 py-2 small text-decoration-none">
              <i className="bi bi-person-circle fs-6 text-primary" />
              <span className="d-none d-md-inline fw-semibold">{user.employee_name || user.email}</span>
            </Link>
            <button type="button" className="icon-btn" onClick={() => { logout(); router.replace('/login'); }} title="Sign out">
              <i className="bi bi-box-arrow-right" />
            </button>
          </div>
        </header>
        <main className="main-content flex-grow-1">
          {routeDenied(user, pathname) ? <AccessDenied /> : children}
        </main>
      </div>
    </div>
  );
}