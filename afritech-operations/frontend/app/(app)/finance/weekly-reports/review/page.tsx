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
    <div className="d-flex flex-column gap-3">
      <PageHeader
        eyebrow="Finance"
        title={t('nav.weeklyReview')}
        subtitle="Review submitted weekly financial reports, verify evidence, and record decisions. Access is limited to authorized reviewers."
        actions={
          <>
            <WeeklyLangSwitcher />
            <Link href="/finance/weekly-reports" className="btn btn-sm btn-outline-secondary">
              <i className="bi bi-arrow-left me-1" aria-hidden="true" />{t('ui.label.openWorkspace')}
            </Link>
          </>
        }
      />

      {selectedId ? (
        <>
          <button type="button" className="btn btn-sm btn-outline-secondary align-self-start"
            onClick={() => setSelectedId(null)}>
            <i className="bi bi-arrow-left me-1" aria-hidden="true" />{t('ui.label.backToQueue')}
          </button>
          <ReportDashboard reportId={selectedId} policy={policyData.data?.policy} reviewMode
            onChanged={queue.reload} />
        </>
      ) : (
        <>
          <div className="filter-bar">
            <div className="row g-2 align-items-end">
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
              <div className="col-md-8 small text-muted text-md-end">
                <strong className="text-body">{queue.data?.total ?? 0}</strong> reports in queue
              </div>
            </div>
            {policyData.error && <div className="mt-2"><ErrorAlert message={weeklyErrorMessage(policyData.error, t)} onRetry={policyData.reload} retryLabel={t('action.retry')} /></div>}
          </div>

          <div className="data-table-wrap">
            <div className="data-table-toolbar">
              <div>
                <div className="panel-title">{t('ui.queue.title')}</div>
                <div className="panel-subtitle">{t('ui.queue.hint')}</div>
              </div>
            </div>
            {queue.loading && <div className="p-3"><Loading label={t('ui.label.loading')} /></div>}
            {queue.error && <div className="p-3"><ErrorAlert message={weeklyErrorMessage(queue.error, t)} onRetry={queue.reload} retryLabel={t('action.retry')} /></div>}
            {!queue.loading && !queue.error && (queue.data?.items || []).length === 0 && (
              <div className="p-3"><EmptyState message={t('ui.queue.empty')} icon="bi-clipboard-check" /></div>
            )}
            {!queue.loading && !queue.error && (queue.data?.items || []).length > 0 && (
              <>
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead><tr><th>Report</th><th>Agent / Branch</th><th>Period</th><th className="text-end">Reported</th><th className="text-end">Outstanding</th><th>Status</th><th className="text-end">Action</th></tr></thead>
                    <tbody>
                      {(queue.data?.items || []).map((r: any) => (
                        <tr key={r.id}>
                          <td><div className="fw-semibold">{r.report_number}</div><div className="small text-muted">{fmtDateTime(r.submitted_at)}</div></td>
                          <td><div>{r.employee_name || '—'}</div><div className="small text-muted">{r.branch_name || '—'}</div></td>
                          <td className="small text-muted">{fmtDate(r.week_start)} – {fmtDate(r.week_end)}</td>
                          <td className="text-end money">{fmtMoney(r.agent_reported_submitted)}</td>
                          <td className="text-end money fw-semibold">{fmtMoney(r.closing_outstanding)}</td>
                          <td><WeeklyBadge status={r.status} /></td>
                          <td className="text-end"><button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setSelectedId(r.id)}>{t('ui.label.view')}</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-3 border-top">
                  <Pagination page={page} pages={queue.data?.pages || 1} total={queue.data?.total} onPage={setPage} {...weeklyPaginationLabels(t)} />
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
