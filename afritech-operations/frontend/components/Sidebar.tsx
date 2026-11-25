'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { logout } from '@/lib/api';
import { navGroupsFor, roleLabel } from '@/lib/permissions';
import { useWeeklyI18n } from '@/lib/weekly-i18n';
import { useEffect } from 'react';

function initials(name?: string | null, email?: string | null) {
  const source = (name || email || 'U').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export default function Sidebar({ open = false, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useWeeklyI18n();
  const groups = navGroupsFor(user);

  useEffect(() => {
    if (onClose) onClose();
  }, [pathname, onClose]);

  const displayName = user?.employee_name || user?.email || 'User';
  const role = roleLabel(user);

  return (
    <>
      {open && <div className="sidebar-backdrop d-lg-none" onClick={onClose} aria-hidden="true" />}
      <nav className={`sidebar d-lg-flex flex-column ${open ? 'open' : ''}`} aria-label="Primary navigation">
        <div className="sidebar-brand d-flex align-items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt="AfriTech Bridge logo" className="brand-mark-img" />
          <div className="overflow-hidden">
            <div className="sidebar-brand-name text-truncate">AfriTech Bridge</div>
            <div className="sidebar-brand-sub text-truncate">Operations workspace</div>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary border-0 ms-auto d-lg-none text-white"
            onClick={onClose}
            aria-label="Close navigation menu"
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>

        <div className="sidebar-scroll">
          {groups.map((g) => (
            <div key={g.group} className="mb-1">
              <div className="sidebar-group">{g.group}</div>
              {g.items.map((item) => {
                const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                const label = item.i18nKey ? t(item.i18nKey) : item.label;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`sidebar-link ${active ? 'active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    <i className={`bi ${item.icon} sidebar-icon`} aria-hidden="true" />
                    <span className="sidebar-label">{label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar" aria-hidden="true">{initials(displayName, user?.email)}</div>
            <div className="overflow-hidden">
              <div className="sidebar-user-name">{displayName}</div>
              <div className="sidebar-user-role">{role}</div>
            </div>
          </div>
          <button type="button" className="btn btn-sm w-100" onClick={() => { logout(); router.replace('/login'); }}>
            <i className="bi bi-box-arrow-right me-1" aria-hidden="true" /> Sign out
          </button>
        </div>
      </nav>
    </>
  );
}