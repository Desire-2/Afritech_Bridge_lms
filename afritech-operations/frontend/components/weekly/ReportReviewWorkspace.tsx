'use client';

/**
 * Reviewer-facing report workspace. Every amount is read from the backend
 * calculation; verification decisions are sent back to the same authoritative
 * endpoints used by the legacy dashboard.
 */
import { useMemo, useState, type ReactNode } from 'react';
import {
  Bar, BarChart, Cell, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  AlertTriangle, ArrowLeft, BadgeCheck, CalendarDays, CheckCircle2, ClipboardCheck,
  Download, FileCheck2, ReceiptText, RotateCcw, ShieldCheck, Wallet, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { cva } from 'class-variance-authority';

import { api, can, downloadFile, fmtDate, fmtDateTime, fmtMoney } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useFetch } from '@/lib/use-fetch';
import { P } from '@/lib/permissions';
import { useWeeklyI18n, WeeklyLangSwitcher } from '@/lib/weekly-i18n';
import { ErrorAlert, Loading } from '@/components/ui';
import {
  SectionState, UserText, WeeklyBadge, WeeklyExportButtons, weeklyErrorMessage,
} from './weekly-shared';

export type ReviewTab = 'overview' | 'officialCosts' | 'momo' | 'closings' | 'audit';

const REVIEW_TABS: { key: ReviewTab; label: string; icon: ReactNode }[] = [
  { key: 'overview', label: 'review.overviewTab', icon: <ClipboardCheck size={15} /> },
  { key: 'officialCosts', label: 'review.officialTab', icon: <ReceiptText size={15} /> },
  { key: 'momo', label: 'review.momoTab', icon: <Wallet size={15} /> },
  { key: 'closings', label: 'review.closingsTab', icon: <CalendarDays size={15} /> },
  { key: 'audit', label: 'review.auditTab', icon: <ShieldCheck size={15} /> },
];

const DECISION_STATUSES = ['submitted', 'under_financial_review'];
const REVIEWABLE_STATUSES = [...DECISION_STATUSES, 'returned_for_correction'];

const pill = cva('rv-pill', {
  variants: {
    tone: {
      neutral: 'rv-pill-neutral',
      good: 'rv-pill-good',
      warn: 'rv-pill-warn',
      danger: 'rv-pill-danger',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

function ReviewPill({ tone, children }: { tone?: 'neutral' | 'good' | 'warn' | 'danger'; children: ReactNode }) {
  return <span className={pill({ tone })}>{children}</span>;
}

type Props = {
  reportId: number;
  tab: ReviewTab;
  onTabChange?: (tab: ReviewTab) => void;
  onBack?: () => void;
  onChanged?: () => void;
};

export default function ReportReviewWorkspace({ reportId, tab, onTabChange, onBack, onChanged }: Props) {
  const { t, statusLabel } = useWeeklyI18n();
  const { user } = useAuth();
  const canReview = can(user, P.weeklyReportsReview);

  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});

  const detail = useFetch<any>(`/api/weekly-reports/${reportId}`, [reportId]);
  const closings = useFetch<any>(
    tab === 'closings' ? `/api/weekly-reports/${reportId}/daily-closings` : '', [tab, reportId]);
  const audit = useFetch<any>(
    tab === 'audit' ? `/api/weekly-reports/${reportId}/audit` : '', [tab, reportId]);

  const report = detail.data?.report || null;
  const calc = report?.calculation || {};
  const c = calc.components || {};
  const claims: any[] = report?.cost_payment_claims || calc.official_cost_payments || [];
  const transfers: any[] = report?.momo_submissions || calc.momo_submissions || [];
  const declaration = calc.declaration || {};
  const canDecide = canReview && DECISION_STATUSES.includes(report?.status);
  const reviewable = canReview && REVIEWABLE_STATUSES.includes(report?.status);

  const pendingClaims = claims.filter((claim) =>
    claim.personal_payment && !claim.auto_personal && claim.verification_status === 'pending').length;
  const pendingTransfers = transfers.filter((item) => item.verification_status === 'pending').length;
  const shortage = Number(c.shortage_amount || 0);
  const surplus = Number(c.surplus_amount || 0);
  const expected = Number(c.expected_remittance || 0);
  const verified = Number(c.verified_submitted || 0);
  const declared = Number(c.declared_submitted_amount || 0);

  const chartData = useMemo(() => [
    { name: t('review.expected'), value: expected, tone: 'navy' },
    { name: t('review.verified'), value: verified, tone: 'teal' },
    { name: t('review.declared'), value: declared, tone: 'orange' },
  ], [t, expected, verified, declared]);

  const reconciliationRows: { label: string; value: string; sign?: 'add' | 'subtract' }[] = [
    { label: 'field.openingOutstanding', value: fmtMoney(c.opening_outstanding), sign: 'add' },
    { label: 'field.collections', value: fmtMoney(c.eligible_collections), sign: 'add' },
    { label: 'ui.agent.verifiedCredits', value: fmtMoney(c.verified_service_costs), sign: 'subtract' },
    { label: 'field.authorizedReceipts', value: fmtMoney(c.authorized_receipts), sign: 'add' },
    { label: 'field.providerPayments', value: fmtMoney(c.verified_provider_payments), sign: 'subtract' },
    { label: 'field.approvedExpenses', value: fmtMoney(c.approved_collection_expenses), sign: 'subtract' },
    { label: 'field.refunds', value: fmtMoney(c.authorized_refunds), sign: 'subtract' },
    { label: 'field.otherOutflows', value: fmtMoney(c.other_outflows), sign: 'subtract' },
    { label: 'field.commissionRetained', value: fmtMoney(c.commission_retained), sign: 'subtract' },
  ];

  function setNote(key: string, value: string) {
    setItemNotes((old) => ({ ...old, [key]: value }));
  }

  async function refresh() {
    detail.reload();
    closings.reload();
    audit.reload();
    onChanged?.();
  }

  async function sendReview(action: string, payload: Record<string, unknown>, messageKey: string) {
    setBusy(true);
    try {
      await api(`/api/weekly-reports/${reportId}/review`, {
        method: 'POST',
        body: { action, ...payload },
      });
      toast.success(t(messageKey));
      setReason('');
      await refresh();
    } catch (err: any) {
      toast.error(weeklyErrorMessage(err, t) || t('review.actionFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function decide(action: 'approve' | 'request_correction' | 'reject') {
    if (!canDecide) return;
    const trimmed = reason.trim();
    if (action !== 'approve' && !trimmed) {
      toast.error(t('ui.error.required'));
      return;
    }
    const key = action === 'approve' ? 'review.approved'
      : action === 'request_correction' ? 'review.returned' : 'review.rejected';
    await sendReview(action,
      { reason: trimmed || undefined, report_note: trimmed || undefined }, key);
  }

  async function verifyTransfer(id: number, action: 'verify_momo' | 'reject_momo') {
    if (!reviewable) return;
    const note = (itemNotes[`momo-${id}`] || '').trim();
    if (action === 'reject_momo' && !note) {
      toast.error(t('ui.error.required'));
      return;
    }
    await sendReview(action, { momo_id: id, note: note || undefined }, 'review.transferVerified');
  }

  async function verifyClaim(id: number, action: 'verify_cost_payment' | 'reject_cost_payment') {
    if (!reviewable) return;
    const note = (itemNotes[`claim-${id}`] || '').trim();
    if (action === 'reject_cost_payment' && !note) {
      toast.error(t('ui.error.required'));
      return;
    }
    await sendReview(action, { claim_id: id, note: note || undefined }, 'review.costVerified');
  }

  async function openEvidence(path: string) {
    try {
      await downloadFile(path);
    } catch (err: any) {
      toast.error(weeklyErrorMessage(err, t) || t('review.actionFailed'));
    }
  }

  if (detail.loading) return <Loading label={t('ui.label.loading')} />;
  if (detail.error) {
    return <ErrorAlert message={weeklyErrorMessage(detail.error, t)} onRetry={detail.reload} retryLabel={t('action.retry')} />;
  }
  if (!report) return <ErrorAlert message={t('ui.error.loadFailed')} onRetry={detail.reload} retryLabel={t('action.retry')} />;

  const evidenceButton = (row: any, kind: 'claim' | 'momo') => row.evidence_path ? (
    <button type="button" className="rv-link-btn"
      onClick={() => openEvidence(kind === 'claim'
        ? `/api/weekly-reports/${reportId}/official-cost-payments/${row.id}/evidence`
        : `/api/weekly-reports/${reportId}/momo/${row.id}/evidence`)}>
      <Download size={13} /> {t('review.openEvidence')}
    </button>
  ) : <span className="text-muted small">—</span>;

  return (
    <div className="rv-shell">
      <div className="rv-topline">
        {onBack && (
          <button type="button" className="rv-back" onClick={onBack}>
            <ArrowLeft size={15} /> {t('ui.label.backToQueue')}
          </button>
        )}
        <span className="rv-context">{t('review.title')}</span>
      </div>

      <header className="rv-head">
        <div className="rv-head-main">
          <div className="rv-head-labels">
            <WeeklyBadge status={report.status} />
            {report.is_late && <ReviewPill tone="warn">{statusLabel('late')}</ReviewPill>}
            {shortage > 0 && <ReviewPill tone="danger">{t('field.shortage')}</ReviewPill>}
            {surplus > 0 && <ReviewPill tone="good">{t('field.surplus')}</ReviewPill>}
          </div>
          <h2 className="rv-title">{report.report_number}</h2>
          <p className="rv-meta">
            <span><CalendarDays size={13} /> {fmtDate(report.week_start)} – {fmtDate(report.week_end)}</span>
            <span><ShieldCheck size={13} /> {report.employee_name || '—'}</span>
            <span>{report.branch_name || '—'}</span>
            <span>{t('ui.label.submittedAt')}: {fmtDateTime(report.submitted_at)}</span>
          </p>
        </div>
        <div className="rv-head-actions">
          <WeeklyLangSwitcher />
          <WeeklyExportButtons reportId={reportId} />
        </div>
      </header>

      <div className="rv-body">
        <div className="rv-main">
          <section className="rv-metrics" aria-label={t('review.section.financial')}>
            <div className="rv-metric">
              <span>{t('review.expected')}</span>
              <strong>{fmtMoney(c.expected_remittance)}</strong>
              <small>{t('field.openingOutstanding')}: {fmtMoney(c.opening_outstanding)}</small>
            </div>
            <div className="rv-metric">
              <span>{t('review.verified')}</span>
              <strong className="text-success">{fmtMoney(c.verified_submitted)}</strong>
              <small>{t('field.agentReported')}: {fmtMoney(c.agent_reported_submitted)}</small>
            </div>
            <div className="rv-metric">
              <span>{shortage > 0 ? t('field.shortage') : t('field.surplus')}</span>
              <strong className={shortage > 0 ? 'text-danger' : 'text-success'}>
                {fmtMoney(shortage > 0 ? shortage : surplus)}
              </strong>
              <small>{t('review.declaredGap')}: {fmtMoney(declared > verified ? declared - verified : 0)}</small>
            </div>
            <div className="rv-metric">
              <span>{t('field.closingOutstanding')}</span>
              <strong>{fmtMoney(c.closing_outstanding)}</strong>
              <small>{t('field.transactionCount')}: {calc.eligible_transaction_count ?? 0}/{calc.transaction_count ?? 0}</small>
            </div>
          </section>

          <nav className="rv-tabs" aria-label={t('review.title')}>
            {REVIEW_TABS.map((item) => (
              <button key={item.key} type="button" className={clsx('rv-tab', tab === item.key && 'rv-tab-active')}
                aria-current={tab === item.key ? 'page' : undefined}
                onClick={() => onTabChange?.(item.key)}>
                {item.icon}{t(item.label)}
                {item.key === 'officialCosts' && pendingClaims > 0 && <span className="rv-tab-count">{pendingClaims}</span>}
                {item.key === 'momo' && pendingTransfers > 0 && <span className="rv-tab-count">{pendingTransfers}</span>}
              </button>
            ))}
          </nav>

          {tab === 'overview' && (
            <div className="rv-stack">
              <section className="rv-panel">
                <div className="rv-panel-head">
                  <div>
                    <h3>{t('review.section.reconciliation')}</h3>
                    <p>{t('review.verificationHelp')}</p>
                  </div>
                </div>
                <div className="rv-panel-body">
                  <div className="rv-chart" aria-label={t('review.section.reconciliation')}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 6, right: 8, bottom: 2, left: -8 }}>
                        <CartesianGrid stroke="#EDF1F6" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#7C8CA3' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#7C8CA3' }} axisLine={false} tickLine={false}
                          tickFormatter={(value: number) => value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : String(value)} />
                        <Tooltip formatter={(value) => fmtMoney(Number(value))} cursor={{ fill: '#F4F7FC' }} />
                        <Bar dataKey="value" radius={[5, 5, 0, 0]} maxBarSize={52}>
                          {chartData.map((entry) => (
                            <Cell key={entry.name} fill={entry.tone === 'teal' ? '#3ECFB2' : entry.tone === 'orange' ? '#F07C2E' : '#0B1C3A'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="rv-trail">
                    {reconciliationRows.map((row) => (
                      <div className="rv-trail-row" key={row.label}>
                        <span className={clsx('rv-trail-sign', row.sign === 'subtract' && 'rv-trail-sub')}>
                          {row.sign === 'subtract' ? '−' : '+'}
                        </span>
                        <span>{t(row.label)}</span>
                        <strong>{row.value}</strong>
                      </div>
                    ))}
                    <div className="rv-trail-row rv-trail-total">
                      <span className="rv-trail-sign">=</span>
                      <span>{t('review.expected')}</span>
                      <strong>{fmtMoney(c.expected_remittance)}</strong>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rv-panel">
                <div className="rv-panel-head">
                  <div>
                    <h3>{t('review.section.shortage')}</h3>
                    <p>{t('ui.label.shortageNote')}</p>
                  </div>
                  <ReviewPill tone={shortage > 0 ? 'danger' : surplus > 0 ? 'warn' : 'good'}>
                    {shortage > 0 ? t('field.shortage') : surplus > 0 ? t('field.surplus') : t('status.no')}
                  </ReviewPill>
                </div>
                <div className="rv-panel-body">
                  <div className="rv-answer-grid">
                    <div>
                      <span>{t('field.reasonCategory')}</span>
                      <strong>{declaration.shortage_reason_category
                        ? t(`reason.${declaration.shortage_reason_category}`) !== `reason.${declaration.shortage_reason_category}`
                          ? t(`reason.${declaration.shortage_reason_category}`)
                          : declaration.shortage_reason_category
                        : '—'}</strong>
                    </div>
                    <div>
                      <span>{t('field.resolutionDate')}</span>
                      <strong>{fmtDate(declaration.expected_resolution_date)}</strong>
                    </div>
                    <div className="rv-answer-wide">
                      <span>{t('review.agentAnswer')}</span>
                      <p><UserText value={declaration.shortage_explanation} /></p>
                    </div>
                    {declaration.override_reason && (
                      <div className="rv-answer-wide rv-answer-alert">
                        <span>{t('review.authorizedOverride')}</span>
                        <p><UserText value={declaration.override_reason} /></p>
                      </div>
                    )}
                  </div>
                  {report.shortage_evidence_path && (
                    <button type="button" className="rv-link-btn mt-2"
                      onClick={() => openEvidence(`/api/weekly-reports/${reportId}/evidence`)}>
                      <Download size={13} /> {t('review.openEvidence')}
                    </button>
                  )}
                </div>
              </section>
            </div>
          )}

          {tab === 'officialCosts' && (
            <section className="rv-panel">
              <div className="rv-panel-head">
                <div>
                  <h3>{t('review.section.officialCosts')}</h3>
                  <p>{t('ui.label.costPaymentNote')}</p>
                </div>
              </div>
              <div className="rv-panel-body rv-panel-body-flush">
                {claims.length === 0 && <p className="rv-empty">{t('review.noClaims')}</p>}
                {claims.length > 0 && claims.map((claim) => {
                  const verifiedCost = claim.personal_payment
                    && (claim.verification_status === 'verified' || claim.auto_personal);
                  return (
                    <div className="rv-item" key={claim.id}>
                      <div className="rv-item-main">
                        <div className="rv-item-title">
                          <ReceiptText size={15} />
                          <strong>{claim.transaction_number || `#${claim.transaction_id}`}</strong>
                          <WeeklyBadge status={claim.auto_personal ? 'auto_applied' : claim.verification_status} />
                          {claim.is_partial && <ReviewPill tone="warn">{t('ui.label.partialPayment')}</ReviewPill>}
                        </div>
                        <div className="rv-item-grid">
                          <span>{t('ui.label.cost')}: {fmtMoney(claim.official_cost)}</span>
                          <span>{t('field.personalPaidAmount')}: {fmtMoney(claim.amount)}</span>
                          <span>{t('ui.label.deductibleAmount')}: {fmtMoney(verifiedCost ? claim.amount : 0)}</span>
                          <span>{t('field.paymentProvider')}: {claim.provider ? t(`ui.provider.${claim.provider}`) : '—'}</span>
                          <span>{t('field.reference')}: {claim.reference || '—'}</span>
                          <span>{t('field.senderPhone')}: {claim.sender_phone || '—'}</span>
                        </div>
                        {claim.notes && <p className="rv-item-note"><UserText value={claim.notes} /></p>}
                        {claim.verification_note && (
                          <p className="rv-item-note"><strong>{t('ui.label.costVerificationNote')}:</strong> <UserText value={claim.verification_note} /></p>
                        )}
                        <div className="rv-item-actions">
                          {evidenceButton(claim, 'claim')}
                        </div>
                      </div>
                      {reviewable && claim.personal_payment && !claim.auto_personal && (
                        <div className="rv-item-review">
                          <input className="form-control form-control-sm" type="text"
                            aria-label={t('ui.label.costVerificationNote')} placeholder={t('field.notes')}
                            value={itemNotes[`claim-${claim.id}`] || ''}
                            onChange={(e) => setNote(`claim-${claim.id}`, e.target.value)} />
                          <div className="d-flex gap-2 flex-wrap">
                            {claim.verification_status !== 'verified' && (
                              <button type="button" className="btn btn-sm btn-outline-success" disabled={busy}
                                onClick={() => verifyClaim(claim.id, 'verify_cost_payment')}>
                                <BadgeCheck size={14} /> {t('action.verifyCost')}
                              </button>
                            )}
                            {claim.verification_status !== 'rejected' && (
                              <button type="button" className="btn btn-sm btn-outline-danger" disabled={busy}
                                onClick={() => verifyClaim(claim.id, 'reject_cost_payment')}>
                                <XCircle size={14} /> {t('action.rejectCost')}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {tab === 'momo' && (
            <section className="rv-panel">
              <div className="rv-panel-head">
                <div>
                  <h3>{t('review.section.momo')}</h3>
                  <p>{t('ui.label.verifiedTotal')}</p>
                </div>
                <ReviewPill tone={pendingTransfers ? 'warn' : 'good'}>
                  {pendingTransfers ? `${pendingTransfers} ${t('review.pendingBadge')}` : t('status.verified')}
                </ReviewPill>
              </div>
              <div className="rv-panel-body rv-panel-body-flush">
                {transfers.length === 0 && <p className="rv-empty">{t('review.noTransfers')}</p>}
                {transfers.length > 0 && transfers.map((item) => (
                  <div className="rv-item" key={item.id}>
                    <div className="rv-item-main">
                      <div className="rv-item-title">
                        <Wallet size={15} />
                        <strong>{item.reference}</strong>
                        <WeeklyBadge status={item.verification_status} />
                      </div>
                      <div className="rv-item-grid">
                        <span>{t('field.provider')}: {item.provider ? t(`ui.provider.${item.provider}`) : '—'}</span>
                        <span>{t('field.amount')}: {fmtMoney(item.amount)}</span>
                        <span>{t('field.datetime')}: {fmtDateTime(item.submitted_at)}</span>
                        <span>{t('field.senderPhone')}: {item.sender_phone || '—'}</span>
                        <span>{t('field.confirmation')}: {item.confirmation_code || '—'}</span>
                      </div>
                      {item.notes && <p className="rv-item-note"><UserText value={item.notes} /></p>}
                      {item.verification_note && (
                        <p className="rv-item-note"><strong>{t('ui.label.reviewNote')}:</strong> <UserText value={item.verification_note} /></p>
                      )}
                      <div className="rv-item-actions">{evidenceButton(item, 'momo')}</div>
                    </div>
                    {reviewable && (
                      <div className="rv-item-review">
                        <input className="form-control form-control-sm" type="text"
                          aria-label={t('ui.label.reviewNote')} placeholder={t('field.notes')}
                          value={itemNotes[`momo-${item.id}`] || ''}
                          onChange={(e) => setNote(`momo-${item.id}`, e.target.value)} />
                        <div className="d-flex gap-2 flex-wrap">
                          {item.verification_status !== 'verified' && (
                            <button type="button" className="btn btn-sm btn-outline-success" disabled={busy}
                              onClick={() => verifyTransfer(item.id, 'verify_momo')}>
                              <CheckCircle2 size={14} /> {t('action.verify')}
                            </button>
                          )}
                          {item.verification_status !== 'rejected' && (
                            <button type="button" className="btn btn-sm btn-outline-danger" disabled={busy}
                              onClick={() => verifyTransfer(item.id, 'reject_momo')}>
                              <XCircle size={14} /> {t('action.rejectTransfer')}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {tab === 'closings' && (
            <section className="rv-panel">
              <div className="rv-panel-head">
                <div>
                  <h3>{t('review.section.closings')}</h3>
                  <p>{t('ui.label.missingNotice')}</p>
                </div>
                {!!closings.data?.override?.reason && (
                  <ReviewPill tone="warn">{t('ui.label.missingOverride')}</ReviewPill>
                )}
              </div>
              <div className="rv-panel-body">
                {closings.data?.override?.reason && (
                  <div className="rv-callout"><AlertTriangle size={15} />
                    <div><strong>{t('ui.label.missingOverride')}:</strong> <UserText value={closings.data.override.reason} /></div>
                  </div>
                )}
                <SectionState loading={closings.loading} error={closings.error} onRetry={closings.reload} />
                <div className="rv-daily">
                  {(closings.data?.items || calc.daily_closings || []).map((day: any) => {
                    const missing = day.status === 'missing'
                      || (closings.data?.missing || calc.missing_closings || []).includes(day.date);
                    return (
                      <div className={clsx('rv-daily-row', missing && 'rv-daily-missing')} key={day.date}>
                        <div className="rv-daily-date">
                          <CalendarDays size={14} />
                          <strong>{fmtDate(day.date)}</strong>
                          <WeeklyBadge status={missing ? 'missing' : day.status} />
                        </div>
                        <div className="rv-daily-values">
                          <span>{t('ui.label.collections')} <strong>{fmtMoney(day.collections)}</strong></span>
                          <span>{t('ui.label.costs')} <strong>{fmtMoney(day.service_costs)}</strong></span>
                          <span>{t('ui.label.expectedCash')} <strong>{missing ? t('review.dailyMissing') : fmtMoney(day.expected_cash)}</strong></span>
                          <span>{t('ui.label.actual')} <strong>{missing ? t('review.dailyMissing') : fmtMoney(day.actual_cash)}</strong></span>
                          <span>{t('ui.label.difference')} <strong>{missing ? t('review.dailyMissing') : fmtMoney(day.difference)}</strong></span>
                        </div>
                        {day.comments && <p className="rv-item-note"><UserText value={day.comments} /></p>}
                      </div>
                    );
                  })}
                  {!closings.loading && !closings.error
                    && (closings.data?.items || calc.daily_closings || []).length === 0 && (
                    <p className="rv-empty">{t('ui.list.empty')}</p>
                  )}
                </div>
              </div>
            </section>
          )}

          {tab === 'audit' && (
            <section className="rv-panel">
              <div className="rv-panel-head">
                <div>
                  <h3>{t('review.section.audit')}</h3>
                  <p>{t('ui.label.auditDetails')}</p>
                </div>
              </div>
              <div className="rv-panel-body">
                <SectionState loading={audit.loading} error={audit.error} onRetry={audit.reload} />
                <div className="rv-audit">
                  {(audit.data?.items || []).map((entry: any) => (
                    <div className="rv-audit-row" key={entry.id}>
                      <span className="rv-audit-mark"><ShieldCheck size={14} /></span>
                      <div className="min-w-0 flex-grow-1">
                        <strong>{entry.action}</strong>
                        <small>{entry.actor_email || '—'} · {fmtDateTime(entry.created_at)}</small>
                        {entry.reason && <p><UserText value={entry.reason} /></p>}
                      </div>
                      {(entry.previous || entry.new) && (
                        <details className="rv-audit-details">
                          <summary>{t('ui.label.details')}</summary>
                          <pre>{JSON.stringify({ previous: entry.previous, new: entry.new }, null, 2)}</pre>
                        </details>
                      )}
                    </div>
                  ))}
                  {!audit.loading && !audit.error && (audit.data?.items || []).length === 0 && (
                    <p className="rv-empty">{t('ui.list.empty')}</p>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>

        <aside className="rv-aside">
          <section className="rv-decision">
            <div className="rv-decision-head">
              <ClipboardCheck size={16} />
              <h3>{t('review.section.decision')}</h3>
            </div>
            <div className="rv-decision-status">
              <span>{t('review.recommendation')}</span>
              <ReviewPill tone={shortage > 0 || pendingClaims || pendingTransfers ? 'warn' : 'good'}>
                {shortage > 0 || pendingClaims || pendingTransfers
                  ? t('review.pendingBadge') : t('status.verified')}
              </ReviewPill>
            </div>
            <dl className="rv-decision-facts">
              <div><dt>{t('review.verifiedGap')}</dt><dd>{fmtMoney(shortage)}</dd></div>
              <div><dt>{t('ui.metric.pending')}</dt><dd>{pendingClaims + pendingTransfers}</dd></div>
              <div><dt>{t('ui.metric.missing')}</dt><dd>{(calc.missing_closings || []).length}</dd></div>
            </dl>
            {canDecide ? (
              <>
                <label className="rv-decision-label" htmlFor="weekly-review-reason">
                  {t('review.decisionReason')}
                </label>
                <textarea id="weekly-review-reason" className="form-control form-control-sm" rows={3}
                  value={reason} onChange={(e) => setReason(e.target.value)}
                  placeholder={t('review.returnHelp')} />
                <div className="rv-decision-actions">
                  <button type="button" className="btn btn-teal btn-sm w-100" disabled={busy}
                    onClick={() => decide('approve')}>
                    <CheckCircle2 size={15} /> {t('action.approve')}
                  </button>
                  <button type="button" className="btn btn-outline-warning btn-sm w-100" disabled={busy}
                    onClick={() => decide('request_correction')}>
                    <RotateCcw size={15} /> {t('action.requestCorrection')}
                  </button>
                  <button type="button" className="btn btn-outline-danger btn-sm w-100" disabled={busy}
                    onClick={() => decide('reject')}>
                    <XCircle size={15} /> {t('action.reject')}
                  </button>
                </div>
                <p className="rv-decision-help">{t('review.approveHelp')}</p>
              </>
            ) : (
              <p className="rv-decision-locked">
                <FileCheck2 size={15} /> {t('review.notDecisionStatus')}
              </p>
            )}
          </section>

          <section className="rv-aside-card">
            <h3>{t('review.section.financial')}</h3>
            <div className="rv-aside-row"><span>{t('field.serviceCosts')}</span><strong>{fmtMoney(c.service_costs)}</strong></div>
            <div className="rv-aside-row"><span>{t('ui.agent.verifiedCredits')}</span><strong>{fmtMoney(c.verified_service_costs)}</strong></div>
            <div className="rv-aside-row"><span>{t('field.commissionEarned')}</span><strong>{fmtMoney(c.commission_earned)}</strong></div>
            <div className="rv-aside-row"><span>{t('field.due')}</span><strong>{fmtDateTime(report.due_at)}</strong></div>
          </section>
        </aside>
      </div>
    </div>
  );
}
