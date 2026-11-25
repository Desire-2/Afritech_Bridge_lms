'use client';

/**
 * Guided Service Agent task: one page, three main sections.
 *
 * Every figure on screen is produced by `POST /agent-summary`, which reuses the
 * authoritative weekly calculation. This component never recalculates money;
 * the only local arithmetic is the immediate "does my declared amount match?"
 * hint, which the backend validates again on save and submit.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, fmtDate, fmtDateTime, fmtMoney } from '@/lib/api';
import { useWeeklyI18n } from '@/lib/weekly-i18n';
import { Modal, PageHeader } from '@/components/ui';
import { TextArea, TextInput } from '@/components/form';
import { WeeklyBadge, WeeklyExportButtons, weeklyErrorMessage } from './weekly-shared';

const EVIDENCE_TYPES = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];
const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;
const COST_SOURCES = ['personal', 'company', 'someone_else', 'not_paid'];

type CostForm = {
  source: string;
};

type TransferForm = {
  provider: string;
  reference: string;
  amount: string;
  submitted_at: string;
  sender_phone: string;
  recipient_phone: string;
  confirmation_code: string;
  notes: string;
  evidence: File | null;
};

function moneyNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function amountLabel(value: unknown): string {
  return moneyNumber(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseAmount(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function evidenceProblem(file: File | null, t: (key: string) => string): string {
  if (!file) return '';
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!EVIDENCE_TYPES.includes(ext)) return t('ui.error.evidenceType');
  if (file.size > MAX_EVIDENCE_BYTES) return t('ui.error.evidenceSize');
  return '';
}

export default function AgentWeeklyFlow({
  initialReportId,
  focusDeclaration = false,
}: {
  initialReportId?: number;
  focusDeclaration?: boolean;
}) {
  const { t, statusLabel } = useWeeklyI18n();
  const [bundle, setBundle] = useState<any>(null);
  const [loadError, setLoadError] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState('');
  const [weekLoading, setWeekLoading] = useState(false);
  const [weekLoadingLabel, setWeekLoadingLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editingCost, setEditingCost] = useState<number | null>(null);
  const [costForms, setCostForms] = useState<Record<number, CostForm>>({});
  const [costErrors, setCostErrors] = useState<Record<number, string>>({});
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferForm, setTransferForm] = useState<TransferForm>({
    provider: 'momo', reference: '', amount: '', submitted_at: '',
    sender_phone: '', recipient_phone: '', confirmation_code: '', notes: '',
    evidence: null,
  });
  const [declaration, setDeclaration] = useState('');
  const [fundingSource, setFundingSource] = useState('agent_phone');
  const [reasonCategory, setReasonCategory] = useState('');
  const [explanation, setExplanation] = useState('');
  const [success, setSuccess] = useState(false);
  const submitting = useRef(false);

  const report = bundle?.report;
  const summary = bundle?.summary || report?.summary;
  const calc = report?.calculation;
  const providers: string[] = bundle?.constants?.momo_providers?.length
    ? bundle.constants.momo_providers : ['momo', 'bank_transfer', 'cash_deposit'];
  const sources: string[] = bundle?.constants?.submission_sources?.length
    ? bundle.constants.submission_sources : ['agent_phone', 'company', 'someone_else'];
  const reasonOptions: string[] = summary?.shortage_reason_categories?.length
    ? summary.shortage_reason_categories
    : ['customer_not_paid', 'service_issue', 'payment_problem',
       'money_unavailable', 'incorrect_record', 'other'];
  const editable = !!summary?.editable && !success;
  const expected = moneyNumber(summary?.expected_amount);
  const declared = parseAmount(declaration);
  const difference = declared === null ? null : expected - declared;
  const situation = declared === null
    ? 'idle'
    : declared === 0
      ? 'zero'
      : difference && difference > 0
        ? 'less'
        : difference && difference < 0
          ? 'more'
          : 'equal';
  const needsReason = situation === 'less' || situation === 'zero' || situation === 'more';
  const reasonReady = situation === 'more'
    ? explanation.trim().length > 0
    : !!reasonCategory && explanation.trim().length > 0;

  const load = useCallback(async (payload: Record<string, unknown> = {}) => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await api<any>('/api/weekly-reports/agent-summary', {
        method: 'POST',
        body: payload,
      });
      setBundle(data);
      if (data?.summary?.week_start) setWeekStart(data.summary.week_start);
      return data;
    } catch (e) {
      setLoadError(e);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Switching weeks is the only navigation in this task. Keep the previous
  // selection visible until the backend confirms the new one, and give the
  // selected dates a deliberate loading treatment instead of a silent redraw.
  const selectWeek = useCallback(async (value: string) => {
    if (!value || value === weekStart) return;
    const previous = weekStart;
    const chosen = (bundle?.weeks || []).find((week: any) => week.week_start === value);
    setWeekStart(value);
    setWeekLoadingLabel(chosen
      ? `${fmtDate(chosen.week_start)} – ${fmtDate(chosen.week_end)}`
      : '');
    setWeekLoading(true);
    setActionError('');
    setNotice('');
    setCostErrors({});
    const data = await load({ week_start: value });
    if (!data) setWeekStart(previous);
    setWeekLoading(false);
  }, [bundle?.weeks, load, weekStart]);

  useEffect(() => {
    load(initialReportId ? { report_id: initialReportId } : {});
  }, [initialReportId, load]);

  // Reset editable fields only when a different report version is loaded. A
  // language switch changes labels through an external store without
  // remounting this component, so unsaved text and selected files survive.
  useEffect(() => {
    if (!report) return;
    if (report.declared_submitted_amount != null) {
      setDeclaration(String(report.declared_submitted_amount));
    } else {
      setDeclaration('');
    }
    setFundingSource(report.submission_funding_source || summary?.submission_funding_source
      || sources[0] || 'agent_phone');
    setReasonCategory(report.shortage_reason_category || '');
    setExplanation(report.shortage_explanation || '');
    setTransferForm((old) => ({ ...old, provider: providers[0] || 'momo' }));
    setTransferOpen(false);
    setEditingCost(null);
    setCostForms({});
    setCostErrors({});
    setSuccess(['submitted', 'under_financial_review', 'approved', 'rejected']
      .includes(report.status));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report?.id, report?.current_version]);

  // The dashboard's "Submit weekly report" link carries tab=shortage. In the
  // guided task that means section 3; the week still comes only from the
  // backend report id, never from the browser URL.
  useEffect(() => {
    if (!focusDeclaration || !report || !editable || success) return;
    const field = document.getElementById('agent-declared-amount') as HTMLInputElement | null;
    if (!field) return;
    field.scrollIntoView({ behavior: 'smooth', block: 'center' });
    field.focus({ preventScroll: true });
  }, [focusDeclaration, report?.id, editable, success]);

  // Cost-answer failures belong to the row that caused them. Bring that row
  // into view and focus its payer group as soon as the inline error appears.
  useEffect(() => {
    if (!editingCost || !costErrors[editingCost]) return;
    const group = document.getElementById(`cost-source-${editingCost}`);
    if (!group) return;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    group.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'center',
    });
    group.focus({ preventScroll: true });
  }, [costErrors, editingCost]);

  const costForm = (row: any): CostForm => costForms[row.transaction_id] || {
    source: row.payment_source || 'not_paid',
  };

  function updateCostForm(row: any, patch: Partial<CostForm>) {
    setCostForms((old) => ({
      ...old,
      [row.transaction_id]: { ...costForm(row), ...patch },
    }));
  }

  function setCostError(transactionId: number, message: string) {
    setCostErrors((old) => ({ ...old, [transactionId]: message }));
  }

  function clearCostError(transactionId: number) {
    setCostErrors((old) => {
      if (!(transactionId in old)) return old;
      const next = { ...old };
      delete next[transactionId];
      return next;
    });
  }

  function selectCostSource(row: any, source: string) {
    if (busy) return;
    updateCostForm(row, { source });
    if (source === 'personal') void saveCost(row, source);
  }

  async function afterMutation(messageKey: string) {
    if (report?.id) await load({ report_id: report.id });
    setNotice(t(messageKey));
  }

  async function saveCost(row: any, selectedSource?: string) {
    if (busy) return;
    if (row.company_funded || row.auto_company_funded) {
      setCostError(row.transaction_id, t('ui.agent.costAutoCompanyNote'));
      return;
    }
    const source = selectedSource || costForm(row).source;
    setBusy(true);
    setActionError('');
    setNotice('');
    clearCostError(row.transaction_id);
    try {
      if (!COST_SOURCES.includes(source)) {
        setCostError(row.transaction_id, t('ui.error.required'));
        return;
      }
      // The answer is already recorded. Do not delete and recreate a verified
      // claim just because the agent reopened it and pressed save.
      if (row.claim_id && row.payment_source === source) {
        setEditingCost(null);
        setNotice(t('ui.label.costPaymentRecorded'));
        return;
      }
      if (row.claim_id) {
        await api(`/api/weekly-reports/${report.id}/official-cost-payments/${row.claim_id}`,
          { method: 'DELETE' });
      }
      const body = new FormData();
      body.set('transaction_id', String(row.transaction_id));
      body.set('payment_source', source);
      body.set('personal_payment', source === 'personal' ? 'true' : 'false');
      if (source === 'personal') {
        // No extra fields: the backend records the full official cost from the
        // transaction and the employee profile already on file.
        body.set('auto_personal', 'true');
        body.set('amount', String(moneyNumber(row.official_cost)));
      }
      await api(`/api/weekly-reports/${report.id}/official-cost-payments`, {
        method: 'POST', formData: body,
      });
      setEditingCost(null);
      setCostForms((old) => {
        const next = { ...old };
        delete next[row.transaction_id];
        return next;
      });
      await afterMutation('ui.label.costPaymentRecorded');
    } catch (e) {
      setCostError(row.transaction_id, weeklyErrorMessage(e, t));
    } finally {
      setBusy(false);
    }
  }

  async function addTransfer() {
    setBusy(true);
    setActionError('');
    setNotice('');
    try {
      const amount = parseAmount(transferForm.amount);
      if (amount === null || amount <= 0) {
        setActionError(t('ui.agent.error.transferAmount'));
        return;
      }
      if (transferForm.reference.trim().length < 4) {
        setActionError(t('ui.agent.error.reference'));
        return;
      }
      const fileProblem = evidenceProblem(transferForm.evidence, t);
      if (fileProblem) {
        setActionError(fileProblem);
        return;
      }
      const body = new FormData();
      body.set('provider', transferForm.provider || 'momo');
      body.set('reference', transferForm.reference.trim().toUpperCase());
      body.set('amount', String(amount));
      if (transferForm.submitted_at) body.set('submitted_at', transferForm.submitted_at);
      if (transferForm.sender_phone) body.set('sender_phone', transferForm.sender_phone);
      if (transferForm.recipient_phone) body.set('recipient_phone', transferForm.recipient_phone);
      if (transferForm.confirmation_code) body.set('confirmation_code', transferForm.confirmation_code);
      if (transferForm.notes) body.set('notes', transferForm.notes);
      if (transferForm.evidence) body.set('evidence', transferForm.evidence);
      await api(`/api/weekly-reports/${report.id}/momo`, { method: 'POST', formData: body });
      setTransferForm({ provider: providers[0] || 'momo', reference: '', amount: '',
        submitted_at: '', sender_phone: '', recipient_phone: '', confirmation_code: '',
        notes: '', evidence: null });
      setTransferOpen(false);
      await afterMutation('ui.label.momoAdded');
    } catch (e) {
      setActionError(weeklyErrorMessage(e, t));
    } finally {
      setBusy(false);
    }
  }

  async function removeTransfer(id: number) {
    setBusy(true);
    setActionError('');
    try {
      await api(`/api/weekly-reports/${report.id}/momo/${id}`, { method: 'DELETE' });
      await afterMutation('ui.label.momoRemoved');
    } catch (e) {
      setActionError(weeklyErrorMessage(e, t));
    } finally {
      setBusy(false);
    }
  }

  function buildPayload(): FormData {
    const body = new FormData();
    body.set('declared_submitted_amount', declared === null ? '' : String(declared));
    body.set('submission_funding_source', fundingSource || 'agent_phone');
    if (situation === 'more') {
      if (explanation.trim()) body.set('surplus_explanation', explanation.trim());
    } else if (needsReason) {
      if (reasonCategory) body.set('shortage_reason_category', reasonCategory);
      if (explanation.trim()) body.set('shortage_explanation', explanation.trim());
    }
    return body;
  }

  async function saveDraft() {
    if (declared === null) {
      setActionError(t('ui.agent.error.money'));
      return;
    }
    if (needsReason && !reasonReady) {
      setActionError(t(situation === 'more'
        ? 'ui.agent.error.surplus' : 'ui.agent.error.reason'));
      return;
    }
    const body = new URLSearchParams();
    body.set('declared_submitted_amount', String(declared));
    body.set('submission_funding_source', fundingSource || 'agent_phone');
    if (situation === 'more') {
      body.set('surplus_explanation', explanation.trim());
    } else if (needsReason) {
      body.set('shortage_reason_category', reasonCategory);
      body.set('shortage_explanation', explanation.trim());
    }
    setBusy(true);
    setActionError('');
    setNotice('');
    try {
      await api(`/api/weekly-reports/${report.id}`, {
        method: 'PATCH',
        body: Object.fromEntries(body.entries()),
      });
      await afterMutation('ui.label.saved');
    } catch (e) {
      setActionError(weeklyErrorMessage(e, t));
    } finally {
      setBusy(false);
    }
  }

  async function submitReport() {
    if (submitting.current) return;
    if (declared === null) {
      setActionError(t('ui.agent.error.money'));
      return;
    }
    if (needsReason && !reasonReady) {
      setActionError(t(situation === 'more'
        ? 'ui.agent.error.surplus' : 'ui.agent.error.reason'));
      return;
    }
    submitting.current = true;
    setBusy(true);
    setActionError('');
    setNotice('');
    try {
      const result = await api<any>(`/api/weekly-reports/${report.id}/submit`, {
        method: 'POST', formData: buildPayload(),
      });
      const refreshed = await load({ report_id: report.id });
      setSuccess(true);
      setNotice(t('ui.agent.success'));
      if (result?.report?.report_number) {
        setBundle((old: any) => ({ ...old,
          report: { ...(refreshed?.report || old?.report || result.report),
            report_number: result.report.report_number } }));
      }
    } catch (e) {
      setActionError(weeklyErrorMessage(e, t));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (loading && !bundle) {
    return <div className="alert alert-light border">{t('ui.label.loading')}</div>;
  }
  if (loadError && !bundle) {
    return <div className="alert alert-danger">{weeklyErrorMessage(loadError, t)}</div>;
  }
  if (!summary || !report) {
    return <div className="alert alert-warning">{t('ui.error.loadFailed')}</div>;
  }

  const transfers: any[] = summary.momo_submissions || [];
  const costs: any[] = summary.official_costs || [];
  // AfriTech Bridge-funded Land Document costs are already confirmed, so they
  // do not need an answer and are kept out of the section 2 work list.
  const autoCompanyCosts = costs.filter((row) =>
    row.company_funded || row.auto_company_funded);
  const answerableCosts = costs.filter((row) =>
    !row.company_funded && !row.auto_company_funded);
  const confirmedCosts = answerableCosts.filter((row) => row.claim_id).length;

  const details = [
    [t('ui.agent.collections'), summary.total_collected],
    [t('ui.agent.previousOutstanding'), summary.previous_outstanding],
    [t('ui.agent.officialCosts'), summary.official_costs_total],
    [t('ui.agent.verifiedCredits'), summary.personal_paid_verified],
    [t('ui.agent.appliedCredits'), summary.personal_paid_applied],
    [t('ui.agent.pendingCredits'), summary.personal_paid_pending],
    [t('ui.agent.companyPaid'), summary.company_paid],
    [t('ui.agent.someoneElsePaid'), summary.someone_else_paid],
    [t('ui.agent.notPaid'), summary.not_paid],
  ];

  return (
    <div className="agent-weekly-flow">
      {actionError && <div className="alert alert-danger py-2 small">{actionError}</div>}
      {loadError && <div className="alert alert-warning py-2 small">{weeklyErrorMessage(loadError, t)}</div>}
      {notice && <div className="alert alert-success py-2 small">{notice}</div>}

      {success ? (
        <section className="card agent-weekly-card agent-weekly-success" aria-label={t('ui.agent.success')}>
          <div className="card-body text-center py-5">
            <div className="agent-success-icon"><i className="bi bi-check2" /></div>
            <h2 className="h4 mt-3 mb-2">{t('ui.agent.success')}</h2>
            <p className="text-muted mb-3">{t('ui.agent.successDetail')}</p>
            <p className="small fw-semibold mb-4">{report.report_number}</p>
            <div className="d-flex justify-content-center flex-wrap gap-2">
              <button type="button" className="btn btn-outline-secondary agent-touch"
                onClick={() => setSuccess(false)}>
                {t('ui.label.view')}
              </button>
              <WeeklyExportButtons reportId={report.id} />
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className="card agent-weekly-card mb-3" aria-label={t('ui.agent.step.summary')}>
            <div className="card-body">
              <div className="agent-step-heading">
                <span className="agent-step-number">1</span>
                <h2 className="h6 mb-0">{t('ui.agent.step.summary')}</h2>
              </div>
              <div className={`agent-hero mt-3 ${weekLoading ? 'is-loading' : ''}`}
                aria-busy={weekLoading}>
                <div className="agent-hero-main">
                  <div className="agent-eyebrow">{t('ui.agent.expected')}</div>
                  <div className="agent-amount">{fmtMoney(summary.expected_amount)}</div>
                  <div className="small text-muted">
                    {t('field.week')}:{' '}
                    {summary.period_label || `${fmtDate(summary.week_start)} – ${fmtDate(summary.week_end)}`}
                  </div>
                </div>
                <div className="agent-hero-side">
                  <WeeklyBadge status={summary.status} />
                  <div className="small text-muted mt-2">
                    {t('field.due')}: {fmtDateTime(summary.due_at)}
                  </div>
                  {summary.is_late && <div className="small text-danger mt-1">{statusLabel('late')}</div>}
                </div>
                {weekLoading && (
                  <div className="agent-week-overlay" role="status" aria-live="polite">
                    <span className="agent-week-spinner" aria-hidden="true">
                      <span className="agent-week-spinner-core" />
                    </span>
                    <span className="agent-week-loading-copy">
                      <strong>{t('ui.agent.loadingWeek')}</strong>
                      {weekLoadingLabel && <small>{weekLoadingLabel}</small>}
                    </span>
                  </div>
                )}
              </div>

              <div className="row g-3 mt-1 align-items-end">
                <div className="col-12 col-md-7 col-lg-6">
                  <label className="form-label small fw-semibold" htmlFor="agent-week-select">
                    {t('period.select')}
                  </label>
                  <select id="agent-week-select" className="form-select agent-touch"
                    value={weekStart} disabled={weekLoading} aria-busy={weekLoading}
                    onChange={(e) => { void selectWeek(e.target.value); }}>
                    {(bundle.weeks || []).map((week: any) => (
                      <option key={week.week_start} value={week.week_start}>
                        {fmtDate(week.week_start)} – {fmtDate(week.week_end)}
                        {week.selected ? ` · ${t('period.current')}` : ''}
                        {week.status ? ` · ${statusLabel(week.status)}` : ''}
                      </option>
                    ))}
                  </select>
                  {weekLoading && (
                    <div className="agent-week-inline-status" aria-hidden="true">
                      <span className="agent-week-dots"><i /><i /><i /></span>
                      {t('ui.label.loading')}
                    </div>
                  )}
                </div>
                <div className="col-12 col-md-5 col-lg-6 text-md-end">
                  <button type="button" className="btn btn-outline-primary agent-touch w-100 w-md-auto"
                    disabled={weekLoading} onClick={() => setDetailsOpen(true)}>
                    <i className="bi bi-info-circle me-1" />{t('ui.agent.viewDetails')}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="card agent-weekly-card mb-3" aria-label={t('ui.agent.step.costs')}>
            <div className="card-body">
              <div className="agent-step-heading">
                <span className="agent-step-number">2</span>
                <h2 className="h6 mb-0">{t('ui.agent.step.costs')}</h2>
              </div>
              <p className="small text-muted mt-2 mb-3">{t('ui.agent.costIntro')}</p>
              {autoCompanyCosts.length > 0 && (
                <p className="small text-muted mb-3">{t('ui.agent.costAutoCompanyNote')}</p>
              )}

              <div className="agent-chip-row mb-3">
                <span className="agent-chip"><b>{fmtMoney(summary.personal_paid_verified)}</b> {t('ui.agent.verifiedCredits')}</span>
                <span className="agent-chip"><b>{fmtMoney(summary.personal_paid_applied)}</b> {t('ui.agent.appliedCredits')}</span>
                <span className="agent-chip"><b>{fmtMoney(summary.personal_paid_pending)}</b> {t('ui.agent.pendingCredits')}</span>
                <span className="agent-chip"><b>{fmtMoney(summary.company_paid)}</b> {t('ui.agent.companyPaid')}</span>
                <span className="agent-chip"><b>{fmtMoney(summary.someone_else_paid)}</b> {t('ui.agent.someoneElsePaid')}</span>
                <span className="agent-chip"><b>{fmtMoney(summary.not_paid)}</b> {t('ui.agent.notPaid')}</span>
              </div>

              {answerableCosts.length === 0 && (
                <div className="alert alert-light border small mb-0">{t('ui.label.none')}</div>
              )}
              <div className="agent-item-list">
                {answerableCosts.map((row: any) => {
                  const form = costForm(row);
                  const costError = costErrors[row.transaction_id];
                  const errorId = `cost-error-${row.transaction_id}`;
                  const open = editingCost === row.transaction_id && editable;
                  const credit = moneyNumber(row.verified_amount) > 0;
                  const verified = credit && row.verification_status === 'verified';
                  const autoApplied = credit && !!row.auto_personal
                    && row.verification_status === 'pending';
                  return (
                    <div className={`agent-item ${costError ? 'has-error' : ''}`}
                      key={row.transaction_id}>
                      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                        <div className="min-w-0">
                          <div className="fw-semibold small">{row.transaction_number}</div>
                          <div className="small text-muted">
                            {row.service_name} · {fmtDate(row.date)} · {fmtMoney(row.official_cost)}
                          </div>
                        </div>
                        <div className="text-md-end">
                          <div className={`small fw-semibold ${credit ? 'text-success' : 'text-muted'}`}>
                            {autoApplied
                              ? t('ui.agent.costApplied', { amount: amountLabel(row.verified_amount) })
                              : verified
                                ? t('ui.agent.costVerified', { amount: amountLabel(row.verified_amount) })
                                : t('ui.agent.costNoDeduction')}
                          </div>
                          {row.claim_id && (
                            <div className="small text-muted">
                              {verified
                                ? statusLabel('verified')
                                : autoApplied
                                  ? t('status.auto_applied')
                                  : t('ui.agent.costPending')}
                            </div>
                          )}
                          {autoApplied && (
                            <div className="small text-muted">{t('ui.agent.costAutoAppliedNote')}</div>
                          )}
                        </div>
                      </div>

                      {!open ? (
                        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-2">
                          <span className="agent-answer">
                            {t(`ui.agent.costSource.${form.source}`)}
                          </span>
                          {editable && (
                            <button type="button" className="btn btn-outline-secondary btn-sm agent-touch"
                              onClick={() => {
                                clearCostError(row.transaction_id);
                                setEditingCost(row.transaction_id);
                              }}>
                              {row.claim_id ? t('ui.agent.changeAnswer') : t('ui.agent.saveAnswer')}
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="agent-subform mt-3">
                          <fieldset id={`cost-source-${row.transaction_id}`} tabIndex={-1}
                            className="agent-source-fieldset"
                            aria-describedby={costError ? errorId : undefined}>
                            <legend className="form-label small fw-semibold">
                              {t('field.personalPayment')}
                            </legend>
                            <div className="agent-source-grid">
                              {COST_SOURCES.map((source) => (
                                <label key={source}
                                  className={`agent-source-option ${form.source === source ? 'selected' : ''}`}>
                                  <input type="radio"
                                    name={`cost-source-${row.transaction_id}`}
                                    value={source} checked={form.source === source}
                                    disabled={busy}
                                    aria-invalid={costError ? true : undefined}
                                    aria-describedby={costError ? errorId : undefined}
                                    onChange={() => selectCostSource(row, source)} />
                                  <span>{t(`ui.agent.costSource.${source}`)}</span>
                                </label>
                              ))}
                            </div>
                          </fieldset>

                          {form.source === 'personal' && (
                            <p className="small text-muted mb-0 mt-2">
                              {t('ui.agent.costPersonalAuto')}
                            </p>
                          )}

                          {costError && (
                            <div id={errorId} className="agent-field-error"
                              role="alert" aria-live="polite">
                              <i className="bi bi-exclamation-circle-fill" aria-hidden="true" />
                              <div className="min-w-0 flex-grow-1">
                                <div className="fw-semibold small">
                                  {t('ui.agent.costErrorTitle')}
                                </div>
                                <div className="small">{costError}</div>
                              </div>
                              <button type="button"
                                className="btn btn-sm btn-outline-danger agent-touch"
                                disabled={busy}
                                onClick={() => void saveCost(row, form.source)}>
                                {t('ui.agent.costErrorRetry')}
                              </button>
                            </div>
                          )}

                          <div className="d-flex flex-wrap gap-2 mt-3">
                            {form.source !== 'personal' && (
                              <button type="button" className="btn btn-primary agent-touch"
                                disabled={busy} onClick={() => saveCost(row)}>
                                {t('ui.agent.saveAnswer')}
                              </button>
                            )}
                            <button type="button" className="btn btn-outline-secondary agent-touch"
                              disabled={busy} onClick={() => {
                                clearCostError(row.transaction_id);
                                setEditingCost(null);
                              }}>
                              {t('ui.label.cancel')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="card agent-weekly-card" aria-label={t('ui.agent.step.submit')}>
            <div className="card-body">
              <div className="agent-step-heading">
                <span className="agent-step-number">3</span>
                <h2 className="h6 mb-0">{t('ui.agent.step.submit')}</h2>
              </div>

              <div className="agent-amount-strip mt-3">
                <div><span className="small text-muted d-block">{t('ui.agent.declared')}</span><b>{fmtMoney(summary.declared_amount)}</b></div>
                <div><span className="small text-muted d-block">{t('ui.agent.evidenceBacked')}</span><b>{fmtMoney(summary.agent_reported_submitted)}</b></div>
                <div><span className="small text-muted d-block">{t('ui.agent.verifiedReceived')}</span><b>{fmtMoney(summary.verified_submitted)}</b></div>
              </div>

              <div className="mt-3">
                <label className="form-label small fw-semibold" htmlFor="agent-declared-amount">
                  {t('ui.agent.amountPrompt')}
                </label>
                <div className="input-group">
                  <TextInput id="agent-declared-amount" className="agent-touch" type="number"
                    min="0" step="0.01" inputMode="decimal" disabled={!editable}
                    placeholder="0.00" value={declaration}
                    onChange={(e) => setDeclaration(e.target.value)} />
                  <span className="input-group-text">RWF</span>
                </div>
                {declared === null && declaration !== '' && (
                  <div className="form-text text-danger">{t('ui.agent.error.money')}</div>
                )}
              </div>

              <div className="mt-3">
                <label className="form-label small fw-semibold" htmlFor="agent-funding-source">
                  {t('field.submissionFundingSource')}
                </label>
                <select id="agent-funding-source" className="form-select agent-touch"
                  disabled={!editable} value={fundingSource}
                  onChange={(e) => setFundingSource(e.target.value)}>
                  {sources.map((source) => (
                    <option key={source} value={source}>{t(`ui.source.${source}`)}</option>
                  ))}
                </select>
                <div className="form-text">{t('ui.label.fundingSourceHelp')}</div>
              </div>

              {situation !== 'idle' && (
                <div className={`agent-compare agent-compare-${situation} mt-3`} role="status">
                  <i className={`bi ${situation === 'equal'
                    ? 'bi-check-circle' : 'bi-exclamation-circle'} me-2`} />
                  {situation === 'equal' && t('ui.agent.compare.equal')}
                  {situation === 'less' && t('ui.agent.compare.less', {
                    amount: amountLabel(Math.abs(difference || 0)),
                  })}
                  {situation === 'zero' && t('ui.agent.compare.zero')}
                  {situation === 'more' && t('ui.agent.compare.more', {
                    amount: amountLabel(Math.abs(difference || 0)),
                  })}
                </div>
              )}

              {needsReason && editable && (
                <div className="agent-reason-box mt-3">
                  {situation !== 'more' && (
                    <>
                      <label className="form-label small fw-semibold" htmlFor="agent-reason">
                        {t('ui.agent.reason')}
                      </label>
                      <select id="agent-reason" className="form-select agent-touch"
                        value={reasonCategory}
                        onChange={(e) => setReasonCategory(e.target.value)}>
                        <option value="">{t('ui.filter.status')}</option>
                        {reasonOptions.map((reason) => (
                          <option key={reason} value={reason}>{t(`ui.reason.${reason}`)}</option>
                        ))}
                      </select>
                    </>
                  )}
                  <label className="form-label small fw-semibold mt-2" htmlFor="agent-explanation">
                    {t('ui.agent.explanation')}
                  </label>
                  <TextArea id="agent-explanation" value={explanation}
                    onChange={(e) => setExplanation(e.target.value)} />
                </div>
              )}

              <div className="agent-transfer-box mt-3">
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                  <div>
                    <div className="fw-semibold small">{t('section.momo')}</div>
                    <div className="small text-muted">{transfers.length} · {t('ui.agent.evidenceBacked')}</div>
                  </div>
                  {editable && (
                    <button type="button" className="btn btn-outline-primary agent-touch"
                      onClick={() => setTransferOpen((old) => !old)}>
                      <i className="bi bi-plus-circle me-1" />
                      {transfers.length ? t('ui.agent.addAnother') : t('ui.agent.addTransfer')}
                    </button>
                  )}
                </div>

                {transfers.length > 0 && (
                  <div className="agent-item-list mt-3">
                    {transfers.map((item: any) => (
                      <div className="agent-item agent-transfer-item" key={item.id}>
                        <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                          <div>
                            <div className="fw-semibold small">
                              {fmtMoney(item.amount)} · {item.reference}
                            </div>
                            <div className="small text-muted">
                              {t(`ui.provider.${item.provider}`)} · {fmtDateTime(item.submitted_at)}
                              {item.evidence_name ? ` · ${item.evidence_name}` : ''}
                            </div>
                          </div>
                          <div className="d-flex align-items-center gap-2 flex-wrap">
                            <span className={`small ${item.verification_status === 'verified'
                              ? 'text-success' : 'text-muted'}`}>
                              {statusLabel(item.verification_status)}
                            </span>
                            {editable && (
                              <button type="button" className="btn btn-link btn-sm agent-touch"
                                disabled={busy} onClick={() => removeTransfer(item.id)}>
                                {t('ui.label.remove')}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {transferOpen && editable && (
                  <div className="agent-subform mt-3">
                    <div className="fw-semibold small mb-2">{t('ui.agent.transferDetails')}</div>
                    <div className="row g-2">
                      <div className="col-12 col-sm-6">
                        <label className="form-label small" htmlFor="agent-transfer-provider">{t('field.provider')}</label>
                        <select id="agent-transfer-provider" className="form-select agent-touch"
                          value={transferForm.provider}
                          onChange={(e) => setTransferForm((old) => ({ ...old, provider: e.target.value }))}>
                          {providers.map((provider) => (
                            <option key={provider} value={provider}>{t(`ui.provider.${provider}`)}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12 col-sm-6">
                        <label className="form-label small" htmlFor="agent-transfer-reference">{t('field.reference')}</label>
                        <TextInput id="agent-transfer-reference" className="agent-touch"
                          value={transferForm.reference}
                          onChange={(e) => setTransferForm((old) => ({ ...old, reference: e.target.value }))} />
                      </div>
                      <div className="col-12 col-sm-6">
                        <label className="form-label small" htmlFor="agent-transfer-amount">{t('ui.agent.amountInRwf')}</label>
                        <TextInput id="agent-transfer-amount" className="agent-touch" type="number"
                          min="0" step="0.01" inputMode="decimal" value={transferForm.amount}
                          onChange={(e) => setTransferForm((old) => ({ ...old, amount: e.target.value }))} />
                      </div>
                      <div className="col-12 col-sm-6">
                        <label className="form-label small" htmlFor="agent-transfer-date">{t('field.datetime')}</label>
                        <TextInput id="agent-transfer-date" className="agent-touch" type="datetime-local"
                          value={transferForm.submitted_at}
                          onChange={(e) => setTransferForm((old) => ({ ...old, submitted_at: e.target.value }))} />
                      </div>
                      <div className="col-12 col-sm-6">
                        <label className="form-label small" htmlFor="agent-transfer-sender">{t('field.senderPhone')}</label>
                        <TextInput id="agent-transfer-sender" className="agent-touch" inputMode="tel"
                          value={transferForm.sender_phone}
                          onChange={(e) => setTransferForm((old) => ({ ...old, sender_phone: e.target.value }))} />
                      </div>
                      <div className="col-12 col-sm-6">
                        <label className="form-label small" htmlFor="agent-transfer-evidence">{t('field.evidence')}</label>
                        <TextInput id="agent-transfer-evidence" className="agent-touch" type="file"
                          accept=".pdf,.png,.jpg,.jpeg,.webp"
                          onChange={(e) => setTransferForm((old) => ({
                            ...old, evidence: e.target.files?.[0] || null,
                          }))} />
                      </div>
                    </div>
                    <div className="form-text">{t('ui.label.evidenceHelp')}</div>
                    <div className="d-flex flex-wrap gap-2 mt-3">
                      <button type="button" className="btn btn-primary agent-touch"
                        disabled={busy} onClick={addTransfer}>{t('action.addMomo')}</button>
                      <button type="button" className="btn btn-outline-secondary agent-touch"
                        disabled={busy} onClick={() => setTransferOpen(false)}>{t('ui.label.cancel')}</button>
                    </div>
                  </div>
                )}
              </div>

              <div className="agent-review mt-3">
                <div className="fw-semibold small mb-2">{t('ui.agent.quickReview')}</div>
                <div className="agent-kv"><span>{t('ui.agent.expected')}</span><b>{fmtMoney(summary.expected_amount)}</b></div>
                <div className="agent-kv"><span>{t('ui.agent.declared')}</span><b>{declared === null ? t('ui.label.none') : fmtMoney(declared)}</b></div>
                <div className="agent-kv"><span>{t('field.status')}</span><b>{statusLabel(summary.status)}</b></div>
                <div className="agent-kv"><span>{t('ui.agent.reviewCosts')}</span><b>{confirmedCosts}/{answerableCosts.length}</b></div>
                <div className="agent-kv"><span>{t('ui.agent.reviewTransfers')}</span><b>{transfers.length}</b></div>
              </div>

              {editable && (
                <div className="agent-actions mt-4">
                  <button type="button" className="btn btn-outline-secondary agent-touch"
                    disabled={busy} onClick={saveDraft}>
                    <i className="bi bi-save me-1" />{t('ui.label.save')}
                  </button>
                  <button type="button" className="btn btn-accent agent-touch agent-submit"
                    disabled={busy || declared === null}
                    onClick={submitReport}>
                    <i className="bi bi-send me-1" />
                    {busy ? t('ui.label.saving') : t('ui.agent.submit')}
                  </button>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      <Modal show={detailsOpen} title={t('ui.agent.detailsTitle')}
        onClose={() => setDetailsOpen(false)} closeLabel={t('ui.label.close')}>
        <div className="agent-details">
          {details.map(([label, value]) => (
            <div className="agent-kv" key={label}>
              <span>{label}</span><b>{fmtMoney(value)}</b>
            </div>
          ))}
          <div className="agent-kv">
            <span>{t('ui.agent.transactions')}</span>
            <b>{String(summary.transaction_count || 0)}</b>
          </div>
          {(calc?.missing_closings || []).length > 0 && (
            <div className="alert alert-warning small mt-3 mb-0">
              {t('ui.label.missingNotice')} ({calc.missing_closings.length})
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
