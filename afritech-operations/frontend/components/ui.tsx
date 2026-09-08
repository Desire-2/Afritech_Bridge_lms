'use client';

import React, { useState, useEffect, useRef } from 'react';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-2">
      <div>
        <h1 className="h3 fw-semibold mb-1">{title}</h1>
        {subtitle && <p className="text-muted mb-0">{subtitle}</p>}
      </div>
      {actions && <div className="d-flex gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="d-flex justify-content-center align-items-center py-5 text-muted">
      <div className="spinner-border spinner-border-sm me-2" role="status" />
      {label}
    </div>
  );
}

export function ErrorAlert({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
      <span>{message}</span>
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
      <i className={`bi ${icon} d-block mb-2 fs-3`} />
      <span className="d-block">{message}</span>
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
    <div className={`card border-0 shadow-sm stat-${tone}`}>
      <div className="card-body d-flex align-items-center">
        {icon && (
          <div className="stat-icon me-3">
            <i className={`bi ${icon}`} />
          </div>
        )}
        <div>
          <div className="text-uppercase small text-muted fw-semibold">{label}</div>
          <div className="fs-5 fw-semibold">{value}</div>
          {sub && <div className="small text-muted">{sub}</div>}
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
    submitted: 'bg-info-subtle text-info border-info-subtle',
    in_progress: 'bg-info-subtle text-info border-info-subtle',
    processing: 'bg-info-subtle text-info border-info-subtle',
    reviewed: 'bg-info-subtle text-info border-info-subtle',
    pending: 'bg-warning-subtle text-warning border-warning-subtle',
    created: 'bg-warning-subtle text-warning border-warning-subtle',
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
  return (
    <nav aria-label="Pagination" className="d-flex align-items-center gap-2 mt-3">
      <button className="btn btn-sm btn-outline-secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Prev
      </button>
      <span className="small text-muted">
        Page {page} of {pages}
        {total !== undefined ? ` · ${total} records` : ''}
      </span>
      <button className="btn btn-sm btn-outline-secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </button>
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
  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [show, onClose]);

  if (!show) return null;
  const cls = size === 'sm' ? 'modal-sm' : size === 'xl' ? 'modal-xl' : 'modal-lg';
  return (
    <div className="modal show d-block" role="dialog" aria-modal="true" aria-label={title}
      tabIndex={-1} ref={ref}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal-dialog modal-dialog-scrollable ${cls}`}>
        <div className="modal-content">
          <div className="modal-header">
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