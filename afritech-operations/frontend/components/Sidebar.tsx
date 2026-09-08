'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { logout } from '@/lib/api';
import { navGroupsFor, roleLabel } from '@/lib/permissions';
import { useEffect } from 'react';

export default function Sidebar({ open = false, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const groups = navGroupsFor(user);

  useEffect(() => {
    if (onClose) onClose();
  }, [pathname, onClose]);

  return (
    <>
      {open && <div className="sidebar-backdrop d-lg-none" onClick={onClose} />}
      <nav className={`sidebar d-lg-flex flex-column ${open ? 'open' : ''}`}>
        <div className="sidebar-brand d-flex align-items-center gap-2 px-3 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt="AfriTech Bridge logo" className="brand-mark-img" />
          <div className="overflow-hidden">
            <div className="fw-semibold text-truncate">AfriTech Bridge</div>
            <div className="small text-muted text-truncate">{roleLabel(user)}</div>
          </div>
          <button type="button" className="btn btn-sm btn-outline-secondary border-0 ms-auto d-lg-none text-white" onClick={onClose} aria-label="Close menu">
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <div className="sidebar-scroll">
          {groups.map((g) => (
            <div key={g.group} className="mb-2">
              <div className="sidebar-group px-3 py-1 small text-uppercase">{g.group}</div>
              {g.items.map((item) => {
                const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                return (
                  <Link key={item.href} href={item.href} className={`sidebar-link d-flex align-items-center gap-2 px-3 py-2 ${active ? 'active' : ''}`}>
                    <i className={`bi ${item.icon} sidebar-icon`} />
                    <span className="sidebar-label">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
        <div className="sidebar-footer px-3 py-3 border-top">
          <div className="small text-muted mb-2 text-truncate">{user?.employee_name || user?.email}</div>
          <button type="button" className="btn btn-sm btn-outline-secondary w-100" onClick={() => { logout(); router.replace('/login'); }}>
            <i className="bi bi-box-arrow-right me-1" /> Sign out
          </button>
        </div>
      </nav>
    </>
  );
}