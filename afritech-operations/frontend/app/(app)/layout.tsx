'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import AccessDenied from '@/components/AccessDenied';
import { useAuth } from '@/lib/auth';
import { api, fmtDateTime, logout } from '@/lib/api';
import { routeDenied, pageIdentity, roleLabel } from '@/lib/permissions';
import { Loading } from '@/components/ui';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [notice, setNotice] = useState<{ id: number; title: string; created_at: string; is_read: boolean }[]>([]);
  const [bellOpen, setBellOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    api('/api/notifications?limit=8')
      .then((d: any) => setNotice(d.notifications || []))
      .catch(() => setNotice([]));
  }, [user, pathname]);

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

  if (routeDenied(user, pathname)) {
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
              <div className="small text-muted text-uppercase">{pageIdentity(pathname).group}</div>
              <h1 className="h5 fw-semibold mb-0">{pageIdentity(pathname).title}</h1>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="small text-muted d-none d-md-inline-block">
              Signed in as <strong>{user.employee_name || user.email}</strong>
            </span>
            <span className="role-chip">{roleLabel(user)}</span>
          </div>
        </header>
          <main className="main-content flex-grow-1">
            <AccessDenied />
          </main>
        </div>
      </div>
    );
  }

  const unreadCount = notice.filter((n) => !n.is_read).length;

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
              {pageIdentity(pathname).group && (
                <div className="small text-muted text-uppercase">{pageIdentity(pathname).group}</div>
              )}
              <h1 className="h5 fw-semibold mb-0">{pageIdentity(pathname).title}</h1>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2 position-relative">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary position-relative"
              onClick={() => setBellOpen((o) => !o)}
              aria-label="Notifications"
            >
              <i className="bi bi-bell" />
              {unreadCount > 0 && (
                <span className="badge-notify position-absolute top-0 start-100 translate-middle bg-danger text-white rounded-pill">
                  {unreadCount > 9 ? '9+' : unreadCount}
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
                    <Link href="/notifications" key={n.id} className={`list-group-item list-group-item-action ${n.is_read ? '' : 'bg-primary-subtle'}`}>
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <span className="small">{n.title}</span>
                      </div>
                      <div className="small text-muted">{fmtDateTime(n.created_at)}</div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            <span className="role-chip">{roleLabel(user)}</span>
            <Link href="/profile" className="d-inline-flex align-items-center gap-2 nav-user rounded-3 px-3 py-1 small text-decoration-none">
              <i className="bi bi-person-circle text-primary" />
              <span className="d-none d-md-inline">{user.employee_name || user.email}</span>
            </Link>
            <button type="button" className="btn btn-sm btn-outline-secondary px-2" onClick={() => { logout(); router.replace('/login'); }} title="Sign out">
              <i className="bi bi-box-arrow-right" />
            </button>
          </div>
        </header>
        <main className="main-content flex-grow-1">{children}</main>
      </div>
    </div>
  );
}