'use client';

/** Reviewer workspace: branch-scoped queue from the backend, then the same
 * reconciliation dashboard with verification/decision controls. */
import { useState } from 'react';
import Link from 'next/link';
import { can, fmtDate, fmtDateTime, fmtMoney } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useFetch } from '@/lib/use-fetch';
import { P } from '@/lib/permissions';
import { EmptyState, ErrorAlert, Loading, PageHeader, Pagination } from '@/components/ui';
import { Field, SelectInput } from '@/components/form';
import { useWeeklyI18n, WeeklyLangSwitcher } from '@/lib/weekly-i18n';
import ReportDashboard from '@/components/weekly/ReportDashboard';
import { WeeklyBadge, weeklyErrorMessage, weeklyPaginationLabels } from '@/components/weekly/weekly-shared';

const REVIEW_STATUSES = ['submitted', 'under_financial_review', 'returned_for_correction'];

export default function WeeklyReportsReviewPage() {
  const { user, loading } = useAuth();
  const { t, statusLabel } = useWeeklyI18n();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const policyData = useFetch<any>('/api/weekly-reports/policy');
  const queue = useFetch<any>('/api/weekly-reports/queue', [status, page], {
    status: status || undefined,
    page,
    per_page: 20,
  });

  if (loading) return <Loading label={t('ui.label.loading')} />;
  if (!can(user, P.weeklyReportsReview)) {
    return <EmptyState message={t('ui.error.accessDenied')} icon="bi-shield-lock" />;
  }

  return (
    <div>
      <PageHeader
        title={t('nav.weeklyReview')}
        subtitle={t('page.subtitle')}
        actions={
          <>
            <WeeklyLangSwitcher />
            <Link href="/finance/weekly-reports" className="btn btn-sm btn-outline-secondary">
              <i className="bi bi-arrow-left me-1" />{t('ui.label.openWorkspace')}
            </Link>
          </>
        }
      />

      {selectedId ? (
        <>
          <button type="button" className="btn btn-sm btn-outline-secondary mb-3"
            onClick={() => setSelectedId(null)}>
            <i className="bi bi-arrow-left me-1" />{t('ui.label.backToQueue')}
          </button>
          <ReportDashboard reportId={selectedId} policy={policyData.data?.policy} reviewMode
            onChanged={queue.reload} />
        </>
      ) : (
        <>
          <div className="card mb-3">
            <div className="card-body">
              <div className="row g-3 align-items-end">
                <div className="col-md-4">
                  <Field label={t('field.status')}>
                    <SelectInput value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                      <option value="">{t('ui.filter.status')}</option>
                      {(policyData.data?.statuses || REVIEW_STATUSES)
                        .filter((s: string) => REVIEW_STATUSES.includes(s))
                        .map((s: string) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                    </SelectInput>
                  </Field>
                </div>
              </div>
              {policyData.error && <ErrorAlert message={weeklyErrorMessage(policyData.error, t)} onRetry={policyData.reload} retryLabel={t('action.retry')} />}
            </div>
          </div>

          <div className="card">
            <div className="card-header py-2 d-flex justify-content-between align-items-center flex-wrap gap-2">
              <span className="small fw-semibold">{t('ui.queue.title')}</span>
              <span className="small text-muted">{t('ui.queue.hint')}</span>
            </div>
            <div className="card-body">
              {queue.loading && <Loading label={t('ui.label.loading')} />}
              {queue.error && <ErrorAlert message={weeklyErrorMessage(queue.error, t)} onRetry={queue.reload} retryLabel={t('action.retry')} />}
              {!queue.loading && !queue.error && (queue.data?.items || []).length === 0 && (
                <EmptyState message={t('ui.queue.empty')} />
              )}
              {(queue.data?.items || []).map((r: any) => (
                <div key={r.id} className="d-flex justify-content-between align-items-center flex-wrap gap-2 py-2 border-bottom">
                  <button type="button" className="btn btn-link text-start p-0 fw-semibold"
                    onClick={() => setSelectedId(r.id)}>
                    {r.report_number}
                    <span className="d-block small text-muted fw-normal">
                      {fmtDate(r.week_start)} – {fmtDate(r.week_end)}
                      {r.employee_name ? ` · ${r.employee_name}` : ''}
                      {r.branch_name ? ` · ${r.branch_name}` : ''}
                    </span>
                  </button>
                  <div className="d-flex align-items-center gap-3 flex-wrap">
                    <span className="small text-muted">
                      {t('field.agentReported')}: {fmtMoney(r.agent_reported_submitted)} ·{' '}
                      {t('field.verifiedSubmitted')}: {fmtMoney(r.verified_submitted)} ·{' '}
                      {t('field.closingOutstanding')}: {fmtMoney(r.closing_outstanding)}
                    </span>
                    <span className="small text-muted">{fmtDateTime(r.submitted_at)}</span>
                    <WeeklyBadge status={r.status} />
                    <button type="button" className="btn btn-sm btn-outline-primary"
                      onClick={() => setSelectedId(r.id)}>{t('ui.label.view')}</button>
                  </div>
                </div>
              ))}
              <Pagination page={page} pages={queue.data?.pages || 1} total={queue.data?.total}
                onPage={setPage} {...weeklyPaginationLabels(t)} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
