'use client';

import React, { useState, useEffect, useRef } from 'react';

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: string; actions?: React.ReactNode; eyebrow?: string }) {
  return (
    <div className="page-header d-flex justify-content-between align-items-start flex-wrap gap-2">
      <div>
        {eyebrow && <div className="page-header-eyebrow">{eyebrow}</div>}
        <h1 className="page-header-title">{title}</h1>
        {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="d-flex gap-2 flex-wrap pt-1">{actions}</div>}
    </div>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="d-flex justify-content-center align-items-center py-5 text-muted">
      <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorAlert({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
      <span>
        <i className="bi bi-exclamation-triangle me-2" />
        {message}
      </span>
      {onRetry && (
        <button className="btn btn-sm btn-outline-danger" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ message = 'No records found', hint, icon = 'bi-inbox', action }: { message?: string; hint?: string; icon?: string; action?: React.ReactNode }) {
  return (
    <div className="text-center py-5 text-muted">
      <div className="empty-state-icon mx-auto mb-3 d-flex align-items-center justify-content-center">
        <i className={`bi ${icon}`} />
      </div>
      <span className="fw-semibold d-block text-body">{message}</span>
      {hint && <span className="small d-block mt-1">{hint}</span>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/** Lightweight skeleton placeholder block for loading tables/cards. */
export function Skeleton({ rows = 3, height = 44 }: { rows?: number; height?: number }) {
  return (
    <div className="w-100">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton w-100 mb-2" style={{ height }} />
      ))}
    </div>
  );
}

export function StatCard({ label, value, sub, tone = 'primary', icon }: { label: string; value: React.ReactNode; sub?: string; tone?: string; icon?: string }) {
  return (
    <div className={`stat-card stat-${tone}`}>
      <div className="card">
        <div className="card-body d-flex align-items-start">
          {icon && (
            <div className="stat-icon">
              <i className={`bi ${icon}`} />
            </div>
          )}
          <div className="min-w-0">
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}</div>
            {sub && <div className="stat-sub">{sub}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Badge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: 'bg-success-subtle text-success border-success-subtle',
    active: 'bg-success-subtle text-success border-success-subtle',
    present: 'bg-success-subtle text-success border-success-subtle',
    approved: 'bg-success-subtle text-success border-success-subtle',
    paid: 'bg-success-subtle text-success border-success-subtle',
    reopened: 'bg-success-subtle text-success border-success-subtle',
    submitted: 'bg-info-subtle text-info border-info-subtle',
    in_progress: 'bg-info-subtle text-info border-info-subtle',
    processing: 'bg-info-subtle text-info border-info-subtle',
    reviewed: 'bg-info-subtle text-info border-info-subtle',
    grading: 'bg-info-subtle text-info border-info-subtle',
    pending: 'bg-warning-subtle text-warning border-warning-subtle',
    created: 'bg-warning-subtle text-warning border-warning-subtle',
    review: 'bg-warning-subtle text-warning border-warning-subtle',
    todo: 'bg-secondary-subtle text-secondary border-secondary-subtle',
    draft: 'bg-secondary-subtle text-secondary border-secondary-subtle',
    cancelled: 'bg-danger-subtle text-danger border-danger-subtle',
    failed: 'bg-danger-subtle text-danger border-danger-subtle',
    shortage: 'bg-danger-subtle text-danger border-danger-subtle',
    rejected: 'bg-danger-subtle text-danger border-danger-subtle',
    inactive: 'bg-secondary-subtle text-secondary border-secondary-subtle',
    late: 'bg-warning-subtle text-warning border-warning-subtle',
    absent: 'bg-danger-subtle text-danger border-danger-subtle',
    refunded: 'bg-danger-subtle text-danger border-danger-subtle',
    overdue: 'bg-danger-subtle text-danger border-danger-subtle',
    done: 'bg-success-subtle text-success border-success-subtle',
    verified: 'bg-success-subtle text-success border-success-subtle',
    exact: 'bg-success-subtle text-success border-success-subtle',
    overage: 'bg-warning-subtle text-warning border-warning-subtle',
    on_track: 'bg-success-subtle text-success border-success-subtle',
    at_risk: 'bg-warning-subtle text-warning border-warning-subtle',
    behind: 'bg-danger-subtle text-danger border-danger-subtle',
    critical: 'bg-danger-subtle text-danger border-danger-subtle',
    low: 'bg-secondary-subtle text-secondary border-secondary-subtle',
    medium: 'bg-info-subtle text-info border-info-subtle',
    high: 'bg-warning-subtle text-warning border-warning-subtle',
    urgent: 'bg-danger-subtle text-danger border-danger-subtle',
    info: 'bg-info-subtle text-info border-info-subtle',
    warning: 'bg-warning-subtle text-warning border-warning-subtle',
    error: 'bg-danger-subtle text-danger border-danger-subtle',
    success: 'bg-success-subtle text-success border-success-subtle',
    correction_requested: 'bg-warning-subtle text-warning border-warning-subtle',
  };
  const cls = map[status] || 'bg-light-subtle text-body border-light-subtle';
  return (
    <span className={`badge border ${cls}`}>{status.replace(/_/g, ' ')}</span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    low: 'bg-secondary-subtle text-secondary border-secondary-subtle',
    medium: 'bg-info-subtle text-info border-info-subtle',
    high: 'bg-warning-subtle text-warning border-warning-subtle',
    urgent: 'bg-danger-subtle text-danger border-danger-subtle',
  };
  const cls = map[priority] || map.medium;
  return <span className={`badge border ${cls}`}>{priority}</span>;
}

export function RiskBadge({ risk }: { risk: string }) {
  const map: Record<string, string> = {
    on_track: 'bg-success-subtle text-success border-success-subtle',
    at_risk: 'bg-warning-subtle text-warning border-warning-subtle',
    behind: 'bg-danger-subtle text-danger border-danger-subtle',
    critical: 'bg-danger-subtle text-danger border-danger-subtle',
  };
  const cls = map[risk] || map.on_track;
  return <span className={`badge border ${cls}`}>{risk.replace(/_/g, ' ')}</span>;
}

export function Pagination({ page, pages, onPage, total }: { page: number; pages: number; onPage: (p: number) => void; total?: number }) {
  if (pages <= 1) return null;
  const go = (p: number) => {
    if (p >= 1 && p <= pages) onPage(p);
  };
  const window = 2;
  const from = Math.max(1, page - window);
  const to = Math.min(pages, page + window);
  const nums: number[] = [];
  for (let p = from; p <= to; p++) nums.push(p);
  return (
    <nav aria-label="Pagination" className="d-flex align-items-center justify-content-between flex-wrap gap-2 mt-3">
      <span className="small text-muted">
        {total !== undefined ? `${total.toLocaleString()} records` : ''}
        {total !== undefined && ` · Page ${page} of ${pages}`}
      </span>
      <div className="d-flex align-items-center gap-1">
        <button className="btn btn-sm btn-outline-secondary" disabled={page <= 1} onClick={() => go(page - 1)} aria-label="Previous page">
          <i className="bi bi-chevron-left" />
        </button>
        {from > 1 && <span className="small text-muted px-1">…</span>}
        {nums.map((n) => (
          <button
            key={n}
            className={`btn btn-sm ${n === page ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => go(n)}
            aria-current={n === page ? 'page' : undefined}
          >
            {n}
          </button>
        ))}
        {to < pages && <span className="small text-muted px-1">…</span>}
        <button className="btn btn-sm btn-outline-secondary" disabled={page >= pages} onClick={() => go(page + 1)} aria-label="Next page">
          <i className="bi bi-chevron-right" />
        </button>
      </div>
    </nav>
  );
}

export function Modal({
  show,
  title,
  onClose,
  children,
  footer,
  size = 'lg',
}: {
  show: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'lg' | 'xl';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  if (!show) return null;
  const cls = size === 'sm' ? 'modal-sm' : size === 'xl' ? 'modal-xl' : 'modal-lg';
  return (
    <div className="modal show d-block" role="dialog" aria-modal="true" aria-label={title}
      tabIndex={-1} ref={ref}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal-dialog modal-dialog-scrollable ${cls}`}>
        <div className="modal-content">
          <div className="modal-header py-2">
            <h5 className="modal-title">{title}</h5>
            <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
          </div>
          <div className="modal-body">{children}</div>
          {footer && <div className="modal-footer">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  show,
  title,
  message,
  onConfirm,
  onClose,
  danger = true,
  confirmLabel = 'Confirm',
}: {
  show: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onClose: () => void;
  danger?: boolean;
  confirmLabel?: string;
}) {
  return (
    <Modal show={show} title={title} onClose={onClose} size="sm"
      footer={
        <>
          <button className="btn btn-outline-secondary" onClick={onClose}>Cancel</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => { onConfirm(); onClose(); }}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="mb-0">{message}</p>
    </Modal>
  );
}

export function usePaged() {
  const [page, setPage] = useState(1);
  return { page, setPage };
}

export function formatSort(value: any) {
  return value;
}