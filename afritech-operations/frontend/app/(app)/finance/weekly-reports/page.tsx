'use client';

/** Agent workspace: pick a week, pick a report, reconcile it against the
 * backend-authoritative calculation. Reviewers may use this page too. */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, can, fmtDate, fmtDateTime, fmtMoney } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useFetch } from '@/lib/use-fetch';
import { P } from '@/lib/permissions';
import { EmptyState, ErrorAlert, Loading, PageHeader, Pagination } from '@/components/ui';
import { Field, SelectInput, TextInput } from '@/components/form';
import { useWeeklyI18n, WeeklyLangSwitcher } from '@/lib/weekly-i18n';
import ReportDashboard from '@/components/weekly/ReportDashboard';
import {
  WEEKLY_TABS, WeekOption, WeeklyBadge, WeeklyTab, weekOptionLabel,
  weeklyErrorMessage, weeklyPaginationLabels,
} from '@/components/weekly/weekly-shared';

export default function WeeklyReportsPage() {
  const { user, loading } = useAuth();
  const { t, statusLabel } = useWeeklyI18n();
  const [weekStart, setWeekStart] = useState('');
  const [status, setStatus] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [deepLink, setDeepLink] = useState<{ report?: number; tab?: WeeklyTab }>({});

  const policyData = useFetch<any>('/api/weekly-reports/policy');
  const weeksData = useFetch<any>('/api/weekly-reports/weeks');
  const list = useFetch<any>('/api/weekly-reports', [weekStart, status, employeeId, page], {
    week_start: weekStart || undefined,
    status: status || undefined,
    employee_id: employeeId ? Number(employeeId) : undefined,
    page,
    per_page: 20,
  });

  const canReview = can(user, P.weeklyReportsReview);
  const canManage = can(user, P.weeklyReportsManage);
  const weeks: WeekOption[] = weeksData.data?.weeks || [];

  useEffect(() => {
    if (!weekStart && weeksData.data?.current?.week_start) {
      setWeekStart(weeksData.data.current.week_start);
    }
  }, [weeksData.data, weekStart]);

  // Dashboard shortcut: ?report=<id>&tab=<key> opens the exact report and tab
  // where the agent declares shortages and submits. Read after mount so the
  // client page does not need a Suspense boundary for useSearchParams().
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const report = Number(params.get('report'));
    const requestedTab = params.get('tab');
    setDeepLink({
      report: Number.isInteger(report) && report > 0 ? report : undefined,
      tab: WEEKLY_TABS.some((item) => item.key === requestedTab)
        ? requestedTab as WeeklyTab
        : undefined,
    });
  }, []);

  useEffect(() => {
    if (deepLink.report) setSelectedId(deepLink.report);
  }, [deepLink.report]);

  if (loading) return <Loading label={t('ui.label.loading')} />;
  if (!can(user, P.weeklyReportsView)) {
    return <EmptyState message={t('ui.error.accessDenied')} icon="bi-shield-lock" />;
  }

  async function generate() {
    setBusy(true);
    setActionError('');
    setNotice('');
    try {
      await api('/api/weekly-reports/generate', {
        method: 'POST',
        body: { week_start: weekStart || undefined },
      });
      setNotice(t('ui.label.generated'));
      list.reload();
      weeksData.reload();
    } catch (e: any) {
      setActionError(weeklyErrorMessage(e, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t('page.title')}
        subtitle={t('page.subtitle')}
        actions={
          <>
            <WeeklyLangSwitcher />
            {canReview && (
              <Link href="/finance/weekly-reports/review" className="btn btn-outline-secondary btn-sm">
                <i className="bi bi-clipboard-check me-1" />{t('nav.weeklyReview')}
              </Link>
            )}
            {canManage && (
              <button type="button" className="btn btn-primary btn-sm" onClick={generate} disabled={busy}>
                <i className="bi bi-plus-circle me-1" />{busy ? t('ui.label.generating') : t('action.generate')}
              </button>
            )}
          </>
        }
      />

      {actionError && <div className="alert alert-danger py-2 small">{actionError}</div>}
      {notice && <div className="alert alert-success py-2 small">{notice}</div>}

      {selectedId ? (
        <>
          <button type="button" className="btn btn-sm btn-outline-secondary mb-3"
            onClick={() => setSelectedId(null)}>
            <i className="bi bi-arrow-left me-1" />{t('ui.label.backToQueue')}
          </button>
          <ReportDashboard reportId={selectedId} policy={policyData.data?.policy}
            initialTab={deepLink.tab}
            onChanged={() => { list.reload(); weeksData.reload(); }} />
        </>
      ) : (
        <>
          <div className="card mb-3">
            <div className="card-body">
              <div className="row g-3 align-items-end">
                <div className="col-md-4">
                  <Field label={t('period.select')}>
                    <SelectInput value={weekStart}
                      onChange={(e) => { setWeekStart(e.target.value); setPage(1); }}>
                      <option value="">{t('ui.label.allWeeks')}</option>
                      {weeks.map((w, index) => (
                        <option key={w.week_start} value={w.week_start}>
                          {weekOptionLabel(w, t, index)} {w.report_count ? `(${w.report_count})` : ''}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                </div>
                <div className="col-md-3">
                  <Field label={t('field.status')}>
                    <SelectInput value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                      <option value="">{t('ui.filter.status')}</option>
                      {(policyData.data?.statuses || []).map((s: string) => (
                        <option key={s} value={s}>{statusLabel(s)}</option>
                      ))}
                    </SelectInput>
                  </Field>
                </div>
                {canReview && (
                  <div className="col-md-3">
                    <Field label={t('field.agent')}>
                      <TextInput type="number" value={employeeId} placeholder={t('ui.filter.employee')}
                        onChange={(e) => { setEmployeeId(e.target.value); setPage(1); }} />
                    </Field>
                  </div>
                )}
                <div className="col-md-2 text-md-end">
                  <button type="button" className="btn btn-sm btn-outline-secondary"
                    onClick={() => { setWeekStart(weeksData.data?.current?.week_start || ''); setStatus(''); setEmployeeId(''); setPage(1); }}>
                    {t('ui.filter.reset')}
                  </button>
                </div>
              </div>
              {(weeksData.loading || policyData.loading) && <Loading label={t('ui.label.loading')} />}
              {(weeksData.error || policyData.error) && (
                <ErrorAlert message={weeklyErrorMessage(weeksData.error || policyData.error, t)} onRetry={() => { weeksData.reload(); policyData.reload(); }} retryLabel={t('action.retry')} />
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header py-2 d-flex justify-content-between align-items-center flex-wrap gap-2">
              <span className="small fw-semibold">{t('ui.list.title')}</span>
              <span className="small text-muted">{t('ui.list.hint')}</span>
            </div>
            <div className="card-body">
              {list.loading && <Loading label={t('ui.label.loading')} />}
              {list.error && <ErrorAlert message={weeklyErrorMessage(list.error, t)} onRetry={list.reload} retryLabel={t('action.retry')} />}
              {!list.loading && !list.error && (list.data?.items || []).length === 0 && (
                <EmptyState message={t('ui.list.empty')} />
              )}
              {(list.data?.items || []).map((r: any) => (
                <div key={r.id} className="d-flex justify-content-between align-items-center flex-wrap gap-2 py-2 border-bottom">
                  <button type="button" className="btn btn-link text-start p-0 fw-semibold"
                    onClick={() => setSelectedId(r.id)}>
                    {r.report_number}
                    <span className="d-block small text-muted fw-normal">
                      {fmtDate(r.week_start)} – {fmtDate(r.week_end)}
                      {r.employee_name ? ` · ${r.employee_name}` : ''}
                    </span>
                  </button>
                  <div className="d-flex align-items-center gap-3 flex-wrap">
                    <span className="small text-muted">
                      {t('field.agentReported')}: {fmtMoney(r.agent_reported_submitted)} ·{' '}
                      {t('field.verifiedSubmitted')}: {fmtMoney(r.verified_submitted)}
                    </span>
                    <span className="small text-muted">{fmtDateTime(r.submitted_at)}</span>
                    <WeeklyBadge status={r.status} />
                    <button type="button" className="btn btn-sm btn-outline-primary"
                      onClick={() => setSelectedId(r.id)}>{t('ui.label.view')}</button>
                  </div>
                </div>
              ))}
              <Pagination page={page} pages={list.data?.pages || 1} total={list.data?.total}
                onPage={setPage} {...weeklyPaginationLabels(t)} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
