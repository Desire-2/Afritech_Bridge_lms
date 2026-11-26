'use client';

/**
 * One management workspace for Admin, Manager and Accountant users.
 * The queue is read from the backend; browser-side checks never decide money.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { AlertTriangle, ArrowRight, ClipboardList, Filter, Plus, Search, Wallet } from 'lucide-react';
import clsx from 'clsx';

import { api, can, fmtDate, fmtDateTime, fmtMoney, hasRole } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useFetch } from '@/lib/use-fetch';
import { P } from '@/lib/permissions';
import { useWeeklyI18n, WeeklyLangSwitcher } from '@/lib/weekly-i18n';
import { EmptyState, ErrorAlert, Loading, PageHeader, Pagination } from '@/components/ui';
import { Field, SelectInput, TextInput } from '@/components/form';
import ReportReviewWorkspace, { type ReviewTab } from './ReportReviewWorkspace';
import {
  WeekOption, WeeklyBadge, weekOptionLabel, weeklyErrorMessage, weeklyPaginationLabels,
} from './weekly-shared';

const REVIEW_STATUSES = ['submitted', 'under_financial_review', 'returned_for_correction'];
const REVIEW_TABS: ReviewTab[] = ['overview', 'officialCosts', 'momo', 'closings', 'audit'];
type ViewMode = 'review' | 'all';
type Flags = { shortage: boolean; pending: boolean; unverified: boolean; missing: boolean };
const EMPTY_FLAGS: Flags = { shortage: false, pending: false, unverified: false, missing: false };

function asBool(value: string | null): boolean {
  return value === '1' || value === 'true';
}

export default function WeeklyManagementWorkspace() {
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const { t, statusLabel } = useWeeklyI18n();
  const [ready, setReady] = useState(false);

  const [view, setView] = useState<ViewMode>('review');
  const [weekStart, setWeekStart] = useState('');
  const [branchId, setBranchId] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [flags, setFlags] = useState<Flags>(EMPTY_FLAGS);
  const [page, setPage] = useState(1);
  const [reportId, setReportId] = useState<number | null>(null);
  const [reportTab, setReportTab] = useState<ReviewTab>('overview');
  const [busy, setBusy] = useState(false);

  const canReview = can(user, P.weeklyReportsReview);
  const canManage = can(user, P.weeklyReportsManage);
  const canSubmit = can(user, P.weeklyReportsSubmit);
  // Managers are branch-scoped by the backend. The auth payload does not carry
  // a branch id, so the UI must never try to derive or override that scope.
  const manager = hasRole(user, 'manager') && !hasRole(user, 'accountant') && !user?.is_super_admin;

  const policy = useFetch<any>('/api/weekly-reports/policy');
  const weeks = useFetch<any>('/api/weekly-reports/weeks');
  const branches = useFetch<any>(manager ? '' : '/api/employees/branches');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedView = params.get('view');
    const requestedTab = params.get('tab');
    const requestedReport = Number(params.get('report'));
    setView(requestedView === 'all' && canReview ? 'all' : 'review');
    setWeekStart(params.get('week') || '');
    setBranchId(manager ? '' : params.get('branch') || '');
    setStatus(params.get('status') || '');
    setSearch(params.get('q') || '');
    setFlags({
      shortage: asBool(params.get('shortage')),
      pending: asBool(params.get('pending')),
      unverified: asBool(params.get('unverified')),
      missing: asBool(params.get('missing')),
    });
    setPage(Math.max(1, Number(params.get('page')) || 1));
    setReportId(Number.isInteger(requestedReport) && requestedReport > 0 ? requestedReport : null);
    setReportTab(REVIEW_TABS.includes(requestedTab as ReviewTab) ? requestedTab as ReviewTab : 'overview');
    setReady(true);
    // Permission state is stable after auth hydration; this intentionally runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!ready || !weekStart && weeks.data?.current?.week_start) {
      if (weeks.data?.current?.week_start) setWeekStart(weeks.data.current.week_start);
    }
  }, [ready, weeks.data, weekStart]);

  useEffect(() => {
    if (!ready) return;
    const params = new URLSearchParams();
    if (view !== 'review') params.set('view', view);
    if (weekStart) params.set('week', weekStart);
    if (branchId && !manager) params.set('branch', branchId);
    if (status) params.set('status', status);
    if (search.trim()) params.set('q', search.trim());
    (Object.keys(flags) as (keyof Flags)[]).forEach((key) => {
      if (flags[key]) params.set(key, '1');
    });
    if (page > 1) params.set('page', String(page));
    if (reportId) {
      params.set('report', String(reportId));
      params.set('tab', reportTab);
    }
    const qs = params.toString();
    window.history.replaceState(null, '', `${pathname}${qs ? `?${qs}` : ''}`);
  }, [ready, view, weekStart, branchId, status, search, flags, page, reportId, reportTab, manager, pathname]);

  const queueParams = useMemo(() => ({
    week_start: weekStart || undefined,
    branch_id: !manager && branchId ? Number(branchId) : undefined,
    status: status || undefined,
    search: search.trim() || undefined,
    has_shortage: flags.shortage || undefined,
    has_pending: flags.pending || undefined,
    has_unverified: flags.unverified || undefined,
    missing_closings: flags.missing || undefined,
    page,
    per_page: 20,
  }), [weekStart, branchId, status, search, flags, page, manager]);

  const queue = useFetch<any>('/api/weekly-reports/queue',
    [view, weekStart, branchId, status, search, flags.shortage, flags.pending, flags.unverified, flags.missing, page],
    queueParams);
  const all = useFetch<any>(view === 'all' ? '/api/weekly-reports' : '',
    [view, weekStart, status, page],
    { week_start: weekStart || undefined, status: status || undefined, page, per_page: 20 });

  const branchOptions: any[] = manager ? [] : branches.data?.branches || [];

  const rows: any[] = view === 'review'
    ? queue.data?.items || []
    : (all.data?.items || []).filter((row: any) => {
        // Manager scoping is enforced by the backend list endpoint; do not try
        // to reproduce it in the browser with an incomplete user payload.
        if (!manager && branchId && Number(row.branch_id) !== Number(branchId)) return false;
        if (search.trim()) {
          const needle = search.trim().toLowerCase();
          return [row.report_number, row.employee_name, row.branch_name]
            .some((value: any) => String(value || '').toLowerCase().includes(needle));
        }
        return true;
      });
  const total = view === 'review' ? queue.data?.total ?? 0 : rows.length;
  const pages = view === 'review' ? queue.data?.pages ?? 1 : all.data?.pages ?? 1;
  const metrics = queue.data?.metrics || {};

  const activeFlags = (Object.keys(flags) as (keyof Flags)[]).filter((key) => flags[key]);
  const hasFilters = !!(weekStart || branchId || status || search.trim() || activeFlags.length);

  const clearFilters = useCallback(() => {
    setWeekStart(weeks.data?.current?.week_start || '');
    setBranchId('');
    setStatus('');
    setSearch('');
    setFlags(EMPTY_FLAGS);
    setPage(1);
  }, [weeks.data]);

  function pickReport(row: any) {
    setReportId(Number(row.id));
    setReportTab('overview');
  }

  async function generate() {
    setBusy(true);
    try {
      await api('/api/weekly-reports/generate', {
        method: 'POST',
        body: { week_start: weekStart || undefined },
      });
      toast.success(t('ui.label.generated'));
      queue.reload();
      all.reload();
      weeks.reload();
    } catch (err: any) {
      toast.error(weeklyErrorMessage(err, t));
    } finally {
      setBusy(false);
    }
  }

  if (authLoading) return <Loading label={t('ui.label.loading')} />;
  if (!can(user, P.weeklyReportsView)) {
    return <EmptyState message={t('ui.error.accessDenied')} icon="bi-shield-lock" />;
  }

  if (reportId) {
    return (
      <ReportReviewWorkspace
        reportId={reportId}
        tab={reportTab}
        onTabChange={setReportTab}
        onBack={() => setReportId(null)}
        onChanged={() => { queue.reload(); all.reload(); weeks.reload(); }}
      />
    );
  }

  const metricItems = [
    { key: 'ui.metric.total', value: metrics.total ?? 0, tone: 'neutral' },
    { key: 'ui.metric.reviewQueue', value: metrics.submitted ?? 0, tone: 'warn' },
    { key: 'ui.metric.shortage', value: metrics.shortage_reports ?? 0, tone: 'danger' },
    { key: 'ui.metric.pending', value: metrics.pending_submissions ?? 0, tone: 'warn' },
    { key: 'ui.metric.unverified', value: metrics.unverified_payments ?? 0, tone: 'orange' },
    { key: 'ui.metric.missing', value: metrics.missing_closings ?? 0, tone: 'neutral' },
  ];

  return (
    <div className="wm-shell">
      <PageHeader
        eyebrow="Finance"
        title={t('page.workspace.title')}
        subtitle={t('page.workspace.subtitle')}
        actions={
          <>
            <WeeklyLangSwitcher />
            {(canManage || canSubmit) && (
              <button type="button" className="btn btn-sm btn-primary" onClick={generate} disabled={busy}>
                <Plus size={14} /> {busy ? t('ui.label.generating') : canManage ? t('action.generate') : t('action.generateMine')}
              </button>
            )}
          </>
        }
      />

      <div className="wm-metrics" aria-label={t('review.section.financial')}>
        {metricItems.map((item) => (
          <div className="wm-metric" key={item.key}>
            <span>{t(item.key)}</span>
            <strong className={clsx(item.tone === 'danger' && 'text-danger', item.tone === 'warn' && 'text-warning')}>
              {item.value}
            </strong>
          </div>
        ))}
      </div>

      <div className="wm-toolbar">
        <div className="wm-modes" role="tablist" aria-label={t('page.workspace.title')}>
          <button type="button" role="tab" aria-selected={view === 'review'}
            className={clsx('wm-mode', view === 'review' && 'wm-mode-active')}
            onClick={() => { setView('review'); setPage(1); }}>
            <ClipboardList size={15} /> {t('ui.mode.review')}
          </button>
          <button type="button" role="tab" aria-selected={view === 'all'}
            className={clsx('wm-mode', view === 'all' && 'wm-mode-active')}
            onClick={() => { setView('all'); setPage(1); }}>
            <Wallet size={15} /> {t('ui.mode.all')}
          </button>
        </div>
        <div className="wm-search">
          <Search size={15} aria-hidden="true" />
          <input type="search" className="form-control form-control-sm"
            aria-label={t('ui.filter.searchReports')} placeholder={t('ui.filter.searchReports')}
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      <div className="wm-filters">
        <div className="row g-2 align-items-end">
          <div className="col-md-3 col-sm-6">
            <Field label={t('period.select')}>
              <SelectInput className="form-select-sm" value={weekStart}
                onChange={(e) => { setWeekStart(e.target.value); setPage(1); }}>
                <option value="">{t('ui.label.allWeeks')}</option>
                {(weeks.data?.weeks || []).map((w: WeekOption, index: number) => (
                  <option key={w.week_start} value={w.week_start}>{weekOptionLabel(w, t, index)}</option>
                ))}
              </SelectInput>
            </Field>
          </div>
          <div className="col-md-2 col-sm-6">
            <Field label={t('ui.filter.branch')}>
              <SelectInput className="form-select-sm" value={branchId} disabled={manager}
                aria-label={t('ui.filter.branch')}
                onChange={(e) => { setBranchId(e.target.value); setPage(1); }}>
                <option value="">{manager ? t('review.branchScope') : t('ui.label.allBranches')}</option>
                {branchOptions.map((branch: any) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </SelectInput>
            </Field>
          </div>
          <div className="col-md-2 col-sm-6">
            <Field label={t('field.status')}>
              <SelectInput className="form-select-sm" value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                <option value="">{t('ui.filter.status')}</option>
                {(policy.data?.statuses || WEEKLY_STATUS_FALLBACK).map((s: string) => (
                  <option key={s} value={s}>{statusLabel(s)}</option>
                ))}
              </SelectInput>
            </Field>
          </div>
          <div className="col-md-5 col-sm-6">
            {view === 'review' && (
              <div className="wm-flags" role="group" aria-label={t('ui.list.signals')}>
                <Filter size={14} aria-hidden="true" />
                {([
                  ['shortage', 'ui.filter.shortageOnly'],
                  ['pending', 'ui.filter.pendingOnly'],
                  ['unverified', 'ui.filter.unverifiedOnly'],
                  ['missing', 'ui.filter.missingClosings'],
                ] as [keyof Flags, string][]).map(([key, label]) => (
                  <button key={key} type="button" aria-pressed={flags[key]}
                    className={clsx('wm-flag', flags[key] && 'wm-flag-active')}
                    onClick={() => {
                      setFlags((old) => ({ ...old, [key]: !old[key] }));
                      setPage(1);
                    }}>
                    {t(label)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="wm-filter-foot">
          <span className="text-muted small">
            {total} {t('ui.label.reports')}
            {activeFlags.length > 0 && ` · ${activeFlags.length} ${t('ui.label.selectedFilters')}`}
            {manager && ` · ${t('review.branchScope')}`}
          </span>
          {hasFilters && (
            <button type="button" className="btn btn-sm btn-link p-0" onClick={clearFilters}>
              {t('ui.label.clearAll')}
            </button>
          )}
        </div>
        {(weeks.error || policy.error || branches.error) && (
          <ErrorAlert message={weeklyErrorMessage(weeks.error || policy.error || branches.error, t)}
            onRetry={() => { weeks.reload(); policy.reload(); branches.reload(); }}
            retryLabel={t('action.retry')} />
        )}
      </div>

      <div className="wm-table-wrap">
        {queue.loading && view === 'review' && <Loading label={t('ui.label.loading')} />}
        {view === 'all' && all.loading && <Loading label={t('ui.label.loading')} />}
        {(queue.error && view === 'review' || all.error && view === 'all') && (
          <ErrorAlert message={weeklyErrorMessage(view === 'review' ? queue.error : all.error, t)}
            onRetry={view === 'review' ? queue.reload : all.reload} retryLabel={t('action.retry')} />
        )}
        {!queue.loading && !all.loading && !queue.error && !all.error && rows.length === 0 && (
          <EmptyState message={view === 'review' ? t('ui.queue.empty') : t('ui.list.empty')}
            icon="bi-clipboard-check" />
        )}
        {rows.length > 0 && (
          <div className="table-responsive">
            <table className="table wm-table align-middle mb-0">
              <thead>
                <tr>
                  <th>{t('ui.list.report')}</th>
                  <th>{t('ui.list.agent')}</th>
                  <th>{t('field.verifiedSubmitted')}</th>
                  <th>{t('ui.list.signals')}</th>
                  <th>{t('field.status')}</th>
                  <th className="text-end">{t('ui.label.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row: any) => {
                  const shortageAmount = Number(row.shortage_amount || 0);
                  const actionable = canReview && REVIEW_STATUSES.includes(row.status);
                  return (
                    <tr key={row.id}>
                      <td>
                        <strong className="wm-report-no">{row.report_number}</strong>
                        <small className="wm-sub">{fmtDate(row.week_start)} – {fmtDate(row.week_end)}</small>
                        <small className="wm-sub">{fmtDateTime(row.submitted_at)}</small>
                      </td>
                      <td>
                        <span className="wm-agent">{row.employee_name || '—'}</span>
                        <small className="wm-sub">{row.branch_name || '—'}</small>
                      </td>
                      <td className="wm-money">
                        <strong>{fmtMoney(row.verified_submitted)}</strong>
                        <small className="wm-sub">{t('field.expectedRemittance')}: {fmtMoney(row.expected_remittance)}</small>
                      </td>
                      <td>
                        <div className="wm-signal-row">
                          {shortageAmount > 0 && (
                            <span className="wm-signal wm-signal-danger">
                              <AlertTriangle size={12} /> {fmtMoney(shortageAmount)}
                            </span>
                          )}
                          {!!row.pending_submission_count && (
                            <span className="wm-signal wm-signal-warn">
                              {row.pending_submission_count} {t('ui.metric.pending')}
                            </span>
                          )}
                          {!!row.unverified_personal_payment_count && (
                            <span className="wm-signal wm-signal-warn">
                              {row.unverified_personal_payment_count} {t('ui.metric.unverified')}
                            </span>
                          )}
                          {!!row.missing_closing_count && (
                            <span className="wm-signal">{row.missing_closing_count} {t('ui.metric.missing')}</span>
                          )}
                          {!shortageAmount && !row.pending_submission_count
                            && !row.unverified_personal_payment_count && !row.missing_closing_count && (
                            <span className="wm-signal wm-signal-good">{t('status.verified')}</span>
                          )}
                        </div>
                      </td>
                      <td><WeeklyBadge status={row.status} /></td>
                      <td className="text-end">
                        <button type="button" className="btn btn-sm btn-outline-primary wm-action"
                          onClick={() => pickReport(row)}>
                          {actionable ? t('ui.label.reviewReport') : t('ui.label.openReport')}
                          <ArrowRight size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="wm-pagination">
          <Pagination page={page} pages={pages || 1} total={view === 'review' ? queue.data?.total : total}
            onPage={setPage} {...weeklyPaginationLabels(t)} />
        </div>
      </div>
    </div>
  );
}

const WEEKLY_STATUS_FALLBACK = [
  'submitted', 'under_financial_review', 'returned_for_correction', 'approved', 'rejected', 'late',
];
