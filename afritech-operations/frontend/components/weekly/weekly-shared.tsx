'use client';

/** Small pieces shared by the agent workspace and the review workspace. */
import { useState } from 'react';
import { Badge, ErrorAlert, Loading } from '@/components/ui';
import { downloadFile, fmtDate } from '@/lib/api';
import { useWeeklyI18n } from '@/lib/weekly-i18n';

export type WeeklyPolicy = Record<string, any>;
export type WeekOption = {
  week_start: string;
  week_end: string;
  report_count?: number;
  status_counts?: Record<string, number>;
};
export type ReportRow = Record<string, any>;
export type ReportDetail = Record<string, any>;

export const WEEKLY_TABS = [
  { key: 'overview', label: 'ui.tab.overview', icon: 'bi-pie-chart' },
  { key: 'transactions', label: 'ui.tab.transactions', icon: 'bi-receipt' },
  { key: 'closings', label: 'ui.tab.closings', icon: 'bi-calendar-check' },
  { key: 'expenses', label: 'ui.tab.expenses', icon: 'bi-receipt-cutoff' },
  { key: 'officialCosts', label: 'ui.tab.officialCosts', icon: 'bi-cash-coin' },
  { key: 'momo', label: 'ui.tab.momo', icon: 'bi-phone' },
  { key: 'shortage', label: 'ui.tab.shortage', icon: 'bi-exclamation-triangle' },
  { key: 'review', label: 'ui.tab.review', icon: 'bi-clipboard-check' },
  { key: 'audit', label: 'ui.tab.audit', icon: 'bi-journal-text' },
] as const;

export type WeeklyTab = (typeof WEEKLY_TABS)[number]['key'];

/** Backend error codes → translated messages; unknown errors keep backend text. */
export function weeklyErrorMessage(err: any, t: (key: string) => string): string {
  // `useFetch` keeps only `e.message`, so accept plain strings too.
  if (typeof err === 'string') err = { message: err };
  const code = err?.data?.code || '';
  const map: Record<string, string> = {
    'weekly_report.shortage_explanation': 'error.shortage_explanation',
    'weekly_report.surplus_explanation': 'error.surplus_explanation',
    'weekly_report.shortage_evidence': 'error.shortage_evidence',
    'weekly_report.shortage_resolution': 'error.shortage_resolution',
    'weekly_report.invalid_date': 'error.shortage_resolution',
    'weekly_report.late_blocked': 'error.late_blocked',
    'weekly_report.unexplained_shortage': 'error.unexplained_shortage',
    'weekly_report.duplicate_reference': 'error.duplicate_reference',
    'weekly_report.invalid_transition': 'error.invalid_transition',
    'weekly_report.locked': 'error.locked',
    'weekly_report.reason_required': 'ui.error.required',
    'weekly_report.reference_required': 'ui.error.referenceRequired',
    'weekly_report.invalid_amount': 'ui.error.amountRequired',
    'weekly_report.invalid_submission_source': 'ui.error.required',
    'weekly_report.override_reason_required': 'ui.error.required',
    'weekly_report.override_disabled': 'ui.error.overrideDisabled',
    'weekly_report.invalid_evidence': 'ui.error.evidenceType',
    'weekly_report.invalid_week': 'error.invalid_week',
    'weekly_report.claim_duplicate': 'error.claim_duplicate',
    'weekly_report.claim_invalid_amount': 'error.claim_invalid_amount',
    'weekly_report.claim_transaction_required': 'ui.error.required',
    'weekly_report.claim_transaction_invalid': 'ui.error.required',
    'weekly_report.claim_invalid_provider': 'ui.error.required',
    'weekly_report.claim_reference_required': 'error.claim_reference_required',
    'weekly_report.claim_sender_required': 'error.claim_sender_required',
    'weekly_report.claim_evidence_required': 'error.claim_evidence_required',
    'weekly_report.claim_invalid_date': 'error.claim_invalid_date',
    'weekly_report.claim_not_personal': 'error.claim_not_personal',
    'weekly_report.claim_reason_required': 'ui.error.required',
  };
  if (map[code]) return t(map[code]);
  // A few access-control failures are returned without a machine code.
  const messages: Record<string, string> = {
    'You do not have access to this weekly report': 'ui.error.accessDenied',
  };
  const message = err?.message || '';
  return messages[message] ? t(messages[message]) : message || 'Request failed';
}

/** Bootstrap badge with a translated label (colour still comes from status). */
export function WeeklyBadge({ status, text }: { status?: string | null; text?: string }) {
  const { statusLabel } = useWeeklyI18n();
  return <Badge status={status || 'unknown'} label={text ?? statusLabel(status)} />;
}

/** Export buttons carry the currently selected UI language to the backend. */
export function WeeklyExportButtons({ reportId, className = '' }: { reportId: number; className?: string }) {
  const { lang, t } = useWeeklyI18n();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function download(format: 'pdf' | 'xlsx') {
    setBusy(true);
    setError('');
    try {
      await downloadFile(`/api/weekly-reports/${reportId}/export?format=${format}&lang=${lang}`);
    } catch (e: any) {
      setError(weeklyErrorMessage(e, t) || t('ui.error.exportFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <div className="d-flex gap-2 flex-wrap">
        <button type="button" className="btn btn-sm btn-outline-primary" disabled={busy}
          onClick={() => download('pdf')}>
          <i className="bi bi-file-earmark-pdf me-1" />{t('action.downloadPdf')}
        </button>
        <button type="button" className="btn btn-sm btn-outline-primary" disabled={busy}
          onClick={() => download('xlsx')}>
          <i className="bi bi-file-earmark-excel me-1" />{t('action.downloadExcel')}
        </button>
      </div>
      {error && <div className="alert alert-danger py-2 small mt-2 mb-0">{error}</div>}
    </div>
  );
}

/** Consistent loading/error treatment across the report sections. */
export function SectionState({ loading, error, onRetry, empty, icon }: {
  loading: boolean;
  error: string;
  onRetry?: () => void;
  empty?: string;
  icon?: string;
}) {
  const { t } = useWeeklyI18n();
  if (loading) return <Loading label={t('ui.label.loading')} />;
  if (error) return <ErrorAlert message={weeklyErrorMessage(error, t)} onRetry={onRetry} retryLabel={t('action.retry')} />;
  if (empty) return <div className="py-4 text-muted small text-center"><i className={`bi ${icon || 'bi-inbox'} me-2`} />{empty}</div>;
  return null;
}

export function weekOptionLabel(week: WeekOption, t: (key: string) => string, index: number): string {
  const tag = index === 0 ? ` · ${t('period.current')}` : index === 1 ? ` · ${t('period.previous')}` : '';
  return `${fmtDate(week.week_start)} – ${fmtDate(week.week_end)}${tag}`;
}

/** Translated labels for the shared Pagination component. */
export function weeklyPaginationLabels(t: (key: string, vars?: Record<string, string | number>) => string) {
  return {
    recordsLabel: t('ui.label.records'),
    pageLabel: (page: number, pages: number) => t('ui.label.pageOf', { page, pages }),
  };
}

/** Only display a user-authored string verbatim — never translated or rewritten. */
export function UserText({ value, fallback = '—' }: { value?: string | null; fallback?: string }) {
  return <>{value ? value : fallback}</>;
}

export function prettyJson(value: any): string {
  if (!value) return '—';
  if (typeof value === 'string') {
    try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return value; }
  }
  return JSON.stringify(value, null, 2);
}
