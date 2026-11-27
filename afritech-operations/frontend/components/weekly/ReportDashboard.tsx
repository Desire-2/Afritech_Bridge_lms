'use client';

/**
 * One reconciliation dashboard used by both the agent workspace and the
 * reviewer workspace. Every money figure is read from the backend calculation;
 * nothing is recomputed in the browser.
 */
import { useEffect, useState } from 'react';
import { api, can, downloadFile, fmtDate, fmtDateTime, fmtMoney, getUserCache, isSuperAdmin } from '@/lib/api';
import { useFetch } from '@/lib/use-fetch';
import { Field, SelectInput, TextArea, TextInput } from '@/components/form';
import { EmptyState, ErrorAlert, Loading, Modal, Pagination, StatCard } from '@/components/ui';
import { useWeeklyI18n } from '@/lib/weekly-i18n';
import { P } from '@/lib/permissions';
import {
  ReportDetail, SectionState, WEEKLY_TABS, WeeklyBadge, WeeklyExportButtons,
  WeeklyPolicy, WeeklyTab, prettyJson, weeklyErrorMessage, weeklyPaginationLabels,
} from './weekly-shared';

const DRAFT_STATUSES = ['draft', 'ready_for_submission', 'late', 'returned_for_correction'];
// Keep these mirrors of the backend state machine in one place so review forms
// are never offered for a transition the API will refuse.
const EDITABLE_STATUSES = DRAFT_STATUSES;
const DECISION_STATUSES = ['submitted', 'under_financial_review'];
const ADJUSTABLE_STATUSES = ['submitted', 'under_financial_review', 'returned_for_correction'];
const ADJUSTMENT_KINDS = [
  'authorized_receipt', 'provider_payment', 'collection_expense', 'authorized_refund',
  'other_outflow', 'commission_retained', 'outstanding_correction', 'outstanding_waiver',
];
const EVIDENCE_TYPES = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];

type TxFilters = {
  search: string; service: string; status: string; payment_status: string;
  start: string; end: string; page: number;
};

const EMPTY_TX_FILTERS: TxFilters = {
  search: '', service: '', status: '', payment_status: '', start: '', end: '', page: 1,
};

type Props = {
  reportId: number;
  policy?: WeeklyPolicy | null;
  reviewMode?: boolean;
  initialTab?: WeeklyTab;
  onChanged?: () => void;
};

export default function ReportDashboard({ reportId, policy, reviewMode = false, initialTab, onChanged }: Props) {
  const { t, statusLabel } = useWeeklyI18n();
  const me = getUserCache();
  const canSubmit = can(me, P.weeklyReportsSubmit);
  const canReview = can(me, P.weeklyReportsReview);
  const canAdjust = can(me, P.weeklyReportsAdjust);
  const canExport = can(me, P.weeklyReportsExport);

  const [tab, setTab] = useState<WeeklyTab>(
    initialTab && WEEKLY_TABS.some((item) => item.key === initialTab) ? initialTab : 'overview');
  const [txFilters, setTxFilters] = useState<TxFilters>(EMPTY_TX_FILTERS);
  const [txRow, setTxRow] = useState<any | null>(null);
  const [closingRow, setClosingRow] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');

  const [momoForm, setMomoForm] = useState<Record<string, string>>({
    provider: policy?.momo_providers?.[0] || 'momo', reference: '', amount: '',
    submitted_at: '', sender_phone: '', recipient_phone: '', confirmation_code: '', notes: '',
  });
  const [momoEvidence, setMomoEvidence] = useState<File | null>(null);
  const [momoNote, setMomoNote] = useState<Record<number, string>>({});

  const [claimTxnId, setClaimTxnId] = useState<number | null>(null);
  const [claimForms, setClaimForms] = useState<Record<number, Record<string, string>>>({});
  const [claimEvidence, setClaimEvidence] = useState<Record<number, File | null>>({});
  const [claimReviewNote, setClaimReviewNote] = useState<Record<number, string>>({});

  const [shortageForm, setShortageForm] = useState<Record<string, string>>({});
  const [submissionForm, setSubmissionForm] = useState<Record<string, string>>({
    declared_submitted_amount: '', submission_funding_source: 'agent_phone',
  });
  const [shortageEvidence, setShortageEvidence] = useState<File | null>(null);
  const [submissionNote, setSubmissionNote] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [missingOverrideReason, setMissingOverrideReason] = useState('');
  const [reviewReason, setReviewReason] = useState('');
  const [statusOverrideTarget, setStatusOverrideTarget] = useState('');
  const [statusOverrideReason, setStatusOverrideReason] = useState('');
  const [adjustForm, setAdjustForm] = useState<Record<string, string>>({
    kind: ADJUSTMENT_KINDS[0], label: '', original_amount: '0', adjusted_amount: '0', reason: '',
  });

  // The dashboard shortcut and self-generation both request the tab that holds
  // the declaration/submit controls. React keeps this component mounted when
  // only the requested tab changes, so honour later requests too.
  useEffect(() => {
    if (initialTab && WEEKLY_TABS.some((item) => item.key === initialTab)) setTab(initialTab);
  }, [initialTab]);

  const detail = useFetch<any>(reportId ? `/api/weekly-reports/${reportId}` : '', [reportId]);
  const report: ReportDetail | null = detail.data?.report || null;
  const calc = report?.calculation || {};
  const c = calc.components || {};
  const isOwner = !!me && !!report && me.employee_id === report.employee_id;
  const editable = isOwner && canSubmit && DRAFT_STATUSES.includes(report?.status);
  const locked = ['submitted', 'under_financial_review', 'approved', 'rejected'].includes(report?.status);
  const reviewable = ['submitted', 'under_financial_review', 'returned_for_correction'].includes(report?.status);
  const backendEditable = EDITABLE_STATUSES.includes(report?.status);
  const canDecide = canReview && DECISION_STATUSES.includes(report?.status);
  const canAdjustReport = canAdjust && ADJUSTABLE_STATUSES.includes(report?.status);
  const overrideTargets: string[] = report?.allowed_super_admin_transitions || [];
  const selectedOverride = statusOverrideTarget && overrideTargets.includes(statusOverrideTarget)
    ? statusOverrideTarget : overrideTargets[0] || '';
  const canOverrideApproval = isSuperAdmin(me) && overrideTargets.length > 0;
  const authorized = !!(report?.override_reason && report?.override_authorized_by);

  const tx = useFetch<any>(
    tab === 'transactions' && reportId ? `/api/weekly-reports/${reportId}/transactions` : '',
    [tab, reportId, txFilters.search, txFilters.service, txFilters.status, txFilters.payment_status,
      txFilters.start, txFilters.end, txFilters.page],
    { search: txFilters.search, service: txFilters.service, status: txFilters.status,
      payment_status: txFilters.payment_status, start: txFilters.start, end: txFilters.end,
      page: txFilters.page, per_page: 25 }
  );
  const closings = useFetch<any>(
    tab === 'closings' && reportId ? `/api/weekly-reports/${reportId}/daily-closings` : '',
    [tab, reportId]
  );
  const expenses = useFetch<any>(
    tab === 'expenses' && reportId ? `/api/weekly-reports/${reportId}/expenses` : '',
    [tab, reportId]
  );
  const claims = useFetch<any>(
    tab === 'officialCosts' && reportId
      ? `/api/weekly-reports/${reportId}/official-cost-payments` : '',
    [tab, reportId]
  );
  const audit = useFetch<any>(
    tab === 'audit' && reportId ? `/api/weekly-reports/${reportId}/audit` : '',
    [tab, reportId]
  );

  useEffect(() => {
    if (!report) return;
    setShortageForm({
      shortage_reason_category: report.shortage_reason_category || '',
      shortage_explanation: report.shortage_explanation || '',
      expected_resolution_date: report.expected_resolution_date || '',
      override_reason: report.override_reason || '',
    });
    setSubmissionForm({
      declared_submitted_amount: report.declared_submitted_amount != null
        ? String(report.declared_submitted_amount) : '',
      submission_funding_source: report.submission_funding_source || 'agent_phone',
    });
    setOverrideReason(report.override_reason || '');
    setSubmissionNote('');
    setClaimTxnId(null);
    setMomoForm((old) => ({ ...old, provider: policy?.momo_providers?.[0] || old.provider || 'momo' }));
    // Reset local declarations only when a different report/version is loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report?.id, report?.current_version]);

  function updateTx(patch: Partial<TxFilters>) {
    setTxFilters((old) => ({ ...old, ...patch, page: patch.page !== undefined ? patch.page : 1 }));
  }

  async function run(path: string, options: any = {}, successKey?: string) {
    setBusy(true);
    setActionError('');
    setNotice('');
    try {
      const result = await api<any>(path, options);
      // Several endpoints return only the changed child row, not a recalculated
      // report. Always re-read the detail so overlays, overrides, audit entries
      // and every backend-calculated amount shown here stay authoritative.
      detail.reload();
      if (tab === 'transactions') tx.reload();
      if (tab === 'closings') closings.reload();
      if (tab === 'expenses') expenses.reload();
      if (tab === 'officialCosts') claims.reload();
      if (tab === 'audit') audit.reload();
      if (successKey) setNotice(t(successKey));
      onChanged?.();
      return result;
    } catch (e: any) {
      setActionError(weeklyErrorMessage(e, t));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft(e: React.FormEvent) {
    e.preventDefault();
    if (!editable) return;
    await run(`/api/weekly-reports/${reportId}`, {
      method: 'PATCH',
      body: {
        shortage_reason_category: shortageForm.shortage_reason_category || null,
        shortage_explanation: shortageForm.shortage_explanation || null,
        expected_resolution_date: shortageForm.expected_resolution_date || null,
        declared_submitted_amount: submissionForm.declared_submitted_amount,
        submission_funding_source: submissionForm.submission_funding_source,
      },
    }, 'ui.label.saved');
  }

  async function submitReport(e: React.FormEvent) {
    e.preventDefault();
    if (!editable) return;
    const declared = Number(submissionForm.declared_submitted_amount);
    const sources: string[] = policy?.submission_sources
      || ['agent_phone', 'company', 'someone_else'];
    if (submissionForm.declared_submitted_amount === ''
      || !Number.isFinite(declared) || declared < 0) {
      setActionError(t('ui.error.amountRequired'));
      return;
    }
    if (!sources.includes(submissionForm.submission_funding_source)) {
      setActionError(t('ui.error.required'));
      return;
    }
    // The backend owns the submission rules. A declared shortage needs a
    // reason and explanation; evidence and a resolution date are optional
    // extras, so the browser must not block an otherwise valid submission.
    const askingShortage = Number(
      c.declared_shortage_amount ?? c.shortage_amount ?? 0);
    const explained = !!shortageForm.shortage_reason_category && !!shortageForm.shortage_explanation?.trim();
    if (askingShortage > 0 && !authorized && !explained) {
      setActionError(shortageForm.override_reason?.trim()
        ? t('error.unexplained_shortage')
        : t('error.shortage_explanation'));
      return;
    }
    const data = new FormData();
    data.set('shortage_reason_category', shortageForm.shortage_reason_category || '');
    data.set('shortage_explanation', shortageForm.shortage_explanation || '');
    data.set('expected_resolution_date', shortageForm.expected_resolution_date || '');
    data.set('override_reason', shortageForm.override_reason || '');
    data.set('submission_note', submissionNote || '');
    data.set('declared_submitted_amount', submissionForm.declared_submitted_amount);
    data.set('submission_funding_source', submissionForm.submission_funding_source);
    if (shortageEvidence) data.set('evidence', shortageEvidence);
    await run(`/api/weekly-reports/${reportId}/submit`, { method: 'POST', formData: data },
      'ui.label.submitted');
  }

  async function addMomo(e: React.FormEvent) {
    e.preventDefault();
    if (!editable) return;
    const reference = (momoForm.reference || '').trim();
    const amount = Number(momoForm.amount);
    if (reference.length < 4) {
      setActionError(reference ? t('ui.error.referenceShort') : t('ui.error.referenceRequired'));
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setActionError(t('ui.error.amountRequired'));
      return;
    }
    if (momoEvidence) {
      const ext = momoEvidence.name.split('.').pop()?.toLowerCase() || '';
      if (!EVIDENCE_TYPES.includes(ext)) {
        setActionError(t('ui.error.evidenceType'));
        return;
      }
      if (momoEvidence.size > 10 * 1024 * 1024) {
        setActionError(t('ui.error.evidenceSize'));
        return;
      }
    }
    const data = new FormData();
    Object.entries(momoForm).forEach(([key, value]) => { if (value) data.set(key, value); });
    if (momoEvidence) data.set('evidence', momoEvidence);
    const result = await run(`/api/weekly-reports/${reportId}/momo`,
      { method: 'POST', formData: data }, 'ui.label.momoAdded');
    if (result) {
      setMomoForm((old) => ({ ...old, reference: '', amount: '', submitted_at: '',
        sender_phone: '', recipient_phone: '', confirmation_code: '', notes: '' }));
      setMomoEvidence(null);
      const input = document.getElementById('weekly-momo-evidence') as HTMLInputElement | null;
      if (input) input.value = '';
    }
  }

  async function removeMomo(id: number) {
    await run(`/api/weekly-reports/${reportId}/momo/${id}`, { method: 'DELETE' },
      'ui.label.momoRemoved');
  }

  async function reviewMomo(id: number, action: 'verify_momo' | 'reject_momo') {
    await run(`/api/weekly-reports/${reportId}/review`, {
      method: 'POST', body: { action, momo_id: id, note: momoNote[id] || undefined },
    }, 'ui.label.reviewRecorded');
  }

  function claimFormValue(txnId: number, key: string): string {
    const fallback: Record<string, string> = {
      personal_payment: 'yes',
      provider: policy?.momo_providers?.[0] || 'momo',
    };
    return claimForms[txnId]?.[key] ?? fallback[key] ?? '';
  }

  function patchClaimForm(txnId: number, key: string, value: string) {
    setClaimForms((old) => ({
      ...old,
      [txnId]: { ...(old[txnId] || {}), [key]: value },
    }));
  }

  function openClaimForm(txnId: number) {
    if (!claimForms[txnId]) {
      setClaimForms((old) => ({
        ...old,
        [txnId]: {
          personal_payment: 'yes',
          provider: policy?.momo_providers?.[0] || 'momo',
        },
      }));
    }
    setClaimTxnId(txnId);
  }

  async function submitCostClaim(e: React.FormEvent) {
    e.preventDefault();
    if (!editable || !claimTxnId) return;
    const personal = claimFormValue(claimTxnId, 'personal_payment') !== 'no';
    const amount = Number(claimFormValue(claimTxnId, 'amount'));
    const reference = (claimFormValue(claimTxnId, 'reference') || '').trim();
    const senderPhone = (claimFormValue(claimTxnId, 'sender_phone') || '').trim();
    const source = (calc.transactions || []).find((row: any) => row.id === claimTxnId);
    if (personal) {
      if (!Number.isFinite(amount) || amount <= 0
        || (source && Number(source.official_cost) > 0 && amount > Number(source.official_cost))) {
        setActionError(t('error.claim_invalid_amount'));
        return;
      }
      if (reference.length < 4) {
        setActionError(t('error.claim_reference_required'));
        return;
      }
      if (!senderPhone) {
        setActionError(t('error.claim_sender_required'));
        return;
      }
      const evidence = claimEvidence[claimTxnId];
      if (!evidence) {
        setActionError(t('error.claim_evidence_required'));
        return;
      }
      const ext = evidence.name.split('.').pop()?.toLowerCase() || '';
      if (!EVIDENCE_TYPES.includes(ext)) {
        setActionError(t('ui.error.evidenceType'));
        return;
      }
      if (evidence.size > 10 * 1024 * 1024) {
        setActionError(t('ui.error.evidenceSize'));
        return;
      }
    }
    const data = new FormData();
    data.set('transaction_id', String(claimTxnId));
    data.set('personal_payment', personal ? 'true' : 'false');
    data.set('notes', claimFormValue(claimTxnId, 'notes'));
    if (personal) {
      data.set('amount', String(amount));
      data.set('provider', claimFormValue(claimTxnId, 'provider'));
      data.set('reference', reference);
      data.set('sender_phone', senderPhone);
      data.set('paid_at', claimFormValue(claimTxnId, 'paid_at'));
      const evidence = claimEvidence[claimTxnId];
      if (evidence) data.set('evidence', evidence);
    }
    const result = await run(`/api/weekly-reports/${reportId}/official-cost-payments`,
      { method: 'POST', formData: data }, 'ui.label.costPaymentRecorded');
    if (result) {
      const id = claimTxnId;
      setClaimForms((old) => {
        const next = { ...old };
        delete next[id];
        return next;
      });
      setClaimEvidence((old) => {
        const next = { ...old };
        delete next[id];
        return next;
      });
      setClaimTxnId(null);
    }
  }

  async function removeCostClaim(id: number) {
    await run(`/api/weekly-reports/${reportId}/official-cost-payments/${id}`,
      { method: 'DELETE' }, 'ui.label.costPaymentRemoved');
  }

  async function reviewClaim(id: number, action: 'verify_cost_payment' | 'reject_cost_payment') {
    if (action === 'reject_cost_payment' && !(claimReviewNote[id] || '').trim()) {
      setActionError(t('ui.error.required'));
      return;
    }
    await run(`/api/weekly-reports/${reportId}/review`, {
      method: 'POST', body: { action, claim_id: id, note: claimReviewNote[id] || undefined },
    }, 'ui.label.reviewRecorded');
  }

  async function downloadCostEvidence(claim: any) {
    try {
      await downloadFile(
        `/api/weekly-reports/${reportId}/official-cost-payments/${claim.id}/evidence`,
        claim.evidence_name || 'evidence'
      );
    } catch (e: any) {
      setActionError(weeklyErrorMessage(e, t));
    }
  }

  async function reviewAction(action: 'request_correction' | 'approve' | 'reject') {
    if (!canDecide) return;
    const reason = reviewReason.trim();
    if ((action === 'request_correction' || action === 'reject') && !reason) {
      setActionError(t('ui.error.required'));
      return;
    }
    const result = await run(`/api/weekly-reports/${reportId}/review`, {
      method: 'POST',
      // `reason` drives the transition; `report_note` is the report-level note
      // and is no longer polluted by per-item verification notes.
      body: { action, reason: reason || undefined, report_note: reason || undefined },
    }, 'ui.label.reviewRecorded');
    if (result) setReviewReason('');
  }

  async function overrideApproval() {
    if (!canOverrideApproval || !selectedOverride) return;
    const reason = statusOverrideReason.trim();
    if (!reason) {
      setActionError(t('ui.error.required'));
      return;
    }
    const result = await run(`/api/weekly-reports/${reportId}/status-override`, {
      method: 'POST', body: { status: selectedOverride, reason },
    }, 'review.overrideSuccess');
    if (result) setStatusOverrideReason('');
  }

  async function addAdjustment(e: React.FormEvent) {
    e.preventDefault();
    if (!canAdjustReport) return;
    if ((adjustForm.reason || '').trim().length < 5) {
      setActionError(t('ui.error.required'));
      return;
    }
    const result = await run(`/api/weekly-reports/${reportId}/adjustments`, {
      method: 'POST',
      body: {
        kind: adjustForm.kind, label: adjustForm.label || undefined,
        original_amount: Number(adjustForm.original_amount || 0),
        adjusted_amount: Number(adjustForm.adjusted_amount || 0),
        reason: adjustForm.reason,
      },
    }, 'ui.label.adjustmentRecorded');
    if (result) setAdjustForm((old) => ({ ...old, label: '', original_amount: '0',
      adjusted_amount: '0', reason: '' }));
  }

  async function authorizeOverride(e: React.FormEvent) {
    e.preventDefault();
    if (!canAdjust || !backendEditable || !overrideReason.trim()) {
      setActionError(t('ui.error.required'));
      return;
    }
    await run(`/api/weekly-reports/${reportId}/override`,
      { method: 'POST', body: { reason: overrideReason } }, 'ui.label.overrideRecorded');
  }

  async function authorizeMissing(e: React.FormEvent) {
    e.preventDefault();
    if (!canAdjust || !backendEditable || !missingOverrideReason.trim()) {
      setActionError(t('ui.error.required'));
      return;
    }
    await run(`/api/weekly-reports/${reportId}/missing-closings/override`,
      { method: 'POST', body: { reason: missingOverrideReason } }, 'ui.label.overrideRecorded');
  }

  async function downloadShortageEvidence() {
    try {
      await downloadFile(`/api/weekly-reports/${reportId}/evidence`);
    } catch (e: any) {
      setActionError(weeklyErrorMessage(e, t));
    }
  }

  async function downloadMoMoEvidence(m: any) {
    // Never download the raw upload path: the protected endpoint re-checks
    // report access and writes an audit entry.
    try {
      await downloadFile(`/api/weekly-reports/${reportId}/momo/${m.id}/evidence`,
        m.evidence_name || 'evidence');
    } catch (e: any) {
      setActionError(weeklyErrorMessage(e, t));
    }
  }

  function feedback() {
    return (
      <>
        {actionError && <div className="alert alert-danger py-2 small mb-3">{actionError}</div>}
        {notice && <div className="alert alert-success py-2 small mb-3">{notice}</div>}
      </>
    );
  }

  function renderOverview() {
    if (!report) return null;
    const rows: [string, string][] = [
      ['field.openingOutstanding', 'opening_outstanding'],
      ['field.collections', 'eligible_collections'],
      ['field.serviceCosts', 'service_costs'],
      ['field.authorizedReceipts', 'authorized_receipts'],
      ['field.providerPayments', 'verified_provider_payments'],
      ['field.approvedExpenses', 'approved_collection_expenses'],
      ['field.refunds', 'authorized_refunds'],
      ['field.otherOutflows', 'other_outflows'],
      ['field.commissionRetained', 'commission_retained'],
      ['field.expectedRemittance', 'expected_remittance'],
      ['field.agentReported', 'agent_reported_submitted'],
      ['field.declaredSubmitted', 'declared_submitted_amount'],
      ['field.verifiedSubmitted', 'verified_submitted'],
      ['field.shortage', 'shortage_amount'],
      ['field.surplus', 'surplus_amount'],
      ['field.commissionEarned', 'commission_earned'],
      ['field.closingOutstanding', 'closing_outstanding'],
    ];
    const statements = calc.statement || [];
    return (
      <div className="row g-3">
        <div className="col-12">
          <div className="d-flex flex-wrap gap-2 align-items-center small text-muted">
            <span className="me-3"><strong>{t('ui.label.reportNumber')}:</strong> {report.report_number}</span>
            <span className="me-3"><strong>{t('field.agent')}:</strong> {report.employee_name || '—'}</span>
            <span className="me-3"><strong>{t('field.week')}:</strong> {fmtDate(report.week_start)} – {fmtDate(report.week_end)}</span>
            <span className="me-3"><strong>{t('field.due')}:</strong> {fmtDateTime(report.due_at)}</span>
            <span className="me-3"><strong>{t('field.status')}:</strong> <WeeklyBadge status={report.status} /></span>
            <span className="me-3"><strong>{t('field.transactionCount')}:</strong> {calc.transaction_count ?? '—'} ({calc.eligible_transaction_count ?? 0} {t('ui.label.eligible')})</span>
            <span><strong>{t('field.submissionFundingSource')}:</strong> {t(`ui.source.${report.submission_funding_source || 'agent_phone'}`)}</span>
          </div>
          {report.is_late && <div className="small text-danger mt-2"><WeeklyBadge status="late" /></div>}
        </div>
        <div className="col-md-6 col-xl-4"><StatCard label={t('field.expectedRemittance')} value={fmtMoney(c.expected_remittance)} icon="bi-calculator" /></div>
        <div className="col-md-6 col-xl-4"><StatCard label={t('field.agentReported')} value={fmtMoney(c.agent_reported_submitted)} icon="bi-phone" /></div>
        <div className="col-md-6 col-xl-4"><StatCard label={t('field.verifiedSubmitted')} value={fmtMoney(c.verified_submitted)} icon="bi-patch-check" tone="success" /></div>
        <div className="col-md-6 col-xl-4"><StatCard label={t('field.shortage')} value={fmtMoney(c.shortage_amount)} icon="bi-exclamation-triangle" tone={Number(c.shortage_amount) > 0 ? 'danger' : 'primary'} /></div>
        <div className="col-md-6 col-xl-4"><StatCard label={t('field.surplus')} value={fmtMoney(c.surplus_amount)} icon="bi-arrow-up-circle" tone="success" /></div>
        <div className="col-md-6 col-xl-4"><StatCard label={t('field.closingOutstanding')} value={fmtMoney(c.closing_outstanding)} icon="bi-wallet2" /></div>

        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header py-2 small fw-semibold">{t('section.overview')}</div>
            <div className="card-body p-0">
              <table className="table table-sm mb-0">
                <tbody>
                  {rows.map(([label, key]) => (
                    <tr key={key}>
                      <td className="text-muted small ps-3">{t(label)}</td>
                      <td className="text-end money small pe-3">{fmtMoney(c[key])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header py-2 small fw-semibold">{t('ui.label.statement')}</div>
            <div className="card-body p-0 table-responsive">
              <table className="table table-sm mb-0">
                <thead><tr><th className="ps-3">#</th><th>{t('ui.label.details')}</th><th className="text-end pe-3">{t('ui.label.value')}</th></tr></thead>
                <tbody>
                  {statements.map((row: any) => (
                    <tr key={row.item}>
                      <td className="ps-3 text-muted">{row.item}</td>
                      <td className="small">{t(row.key)}</td>
                      <td className="text-end small pe-3">{row.value ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        {(report.adjustments || []).length > 0 && (
          <div className="col-12">
            <div className="card">
              <div className="card-header py-2 small fw-semibold">{t('ui.label.adjustments')}</div>
              <div className="card-body p-0 table-responsive">
                <table className="table table-sm mb-0">
                  <thead><tr><th>{t('ui.label.kind')}</th><th>{t('ui.label.label')}</th><th className="text-end">{t('field.original')}</th><th className="text-end">{t('field.adjusted')}</th><th>{t('ui.label.reason')}</th></tr></thead>
                  <tbody>
                    {report.adjustments.map((a: any) => (
                      <tr key={a.id}>
                        <td className="small">{t(`ui.adjustment.${a.kind}`) !== `ui.adjustment.${a.kind}` ? t(`ui.adjustment.${a.kind}`) : a.kind}</td>
                        <td className="small">{a.label || '—'}</td>
                        <td className="text-end small">{fmtMoney(a.original_amount)}</td>
                        <td className="text-end small">{fmtMoney(a.adjusted_amount)}</td>
                        <td className="small">{a.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        {(report.allocations || []).length > 0 && (
          <div className="col-12">
            <div className="card">
              <div className="card-header py-2 small fw-semibold">{t('ui.label.allocations')}</div>
              <div className="card-body p-0 table-responsive">
                <table className="table table-sm mb-0">
                  <thead><tr><th>{t('ui.label.date')}</th><th>{t('ui.label.kind')}</th><th className="text-end">{t('field.amount')}</th><th>{t('ui.label.reason')}</th><th>{t('ui.label.auditActor')}</th></tr></thead>
                  <tbody>
                    {report.allocations.map((a: any) => (
                      <tr key={a.id}>
                        <td className="small">{fmtDate(a.created_at)}</td>
                        <td className="small">{a.kind}</td>
                        <td className="text-end small">{fmtMoney(a.amount)}</td>
                        <td className="small">{a.reason || '—'}</td>
                        <td className="small">{a.actor_email || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderTransactions() {
    const items = tx.data?.items || [];
    const services = Array.from(new Set((calc.transactions || []).map((r: any) => r.service_name).filter(Boolean))) as string[];
    return (
      <div>
        <div className="row g-2 align-items-end mb-3">
          <div className="col-md-4">
            <Field label={t('ui.filter.search')}>
              <TextInput value={txFilters.search} placeholder={t('ui.filter.search')}
                onChange={(e) => updateTx({ search: e.target.value })} />
            </Field>
          </div>
          <div className="col-md-2">
            <Field label={t('ui.label.service')}>
              <SelectInput value={txFilters.service} onChange={(e) => updateTx({ service: e.target.value })}>
                <option value="">{t('ui.filter.service')}</option>
                {services.map((name) => <option key={name} value={name}>{name}</option>)}
              </SelectInput>
            </Field>
          </div>
          <div className="col-md-2">
            <Field label={t('field.status')}>
              <SelectInput value={txFilters.status} onChange={(e) => updateTx({ status: e.target.value })}>
                <option value="">{t('ui.filter.status')}</option>
                {Array.from(new Set((calc.transactions || []).map((r: any) => r.status).filter(Boolean))).map((s: any) => (
                  <option key={s} value={s}>{statusLabel(s)}</option>
                ))}
              </SelectInput>
            </Field>
          </div>
          <div className="col-md-2">
            <Field label={t('field.costPaymentStatus')}>
              <SelectInput value={txFilters.payment_status} onChange={(e) => updateTx({ payment_status: e.target.value })}>
                <option value="">{t('ui.filter.paymentStatus')}</option>
                {['paid', 'partially_paid', 'unpaid', 'cancelled', 'refunded', 'reversed', 'pending_payment']
                  .map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
              </SelectInput>
            </Field>
          </div>
          <div className="col-md-1">
            <Field label={t('ui.filter.start')}>
              <TextInput type="date" value={txFilters.start} onChange={(e) => updateTx({ start: e.target.value })} />
            </Field>
          </div>
          <div className="col-md-1">
            <Field label={t('ui.filter.end')}>
              <TextInput type="date" value={txFilters.end} onChange={(e) => updateTx({ end: e.target.value })} />
            </Field>
          </div>
        </div>
        <div className="mb-2">
          <button type="button" className="btn btn-sm btn-outline-secondary"
            onClick={() => setTxFilters({ ...EMPTY_TX_FILTERS, page: 1 })}>
            {t('ui.filter.reset')}
          </button>
        </div>
        <SectionState loading={tx.loading} error={tx.error} onRetry={tx.reload} />
        {!tx.loading && !tx.error && items.length === 0 && (
          <EmptyState message={t('ui.list.empty')} />
        )}
        {items.length > 0 && (
          <div className="table-responsive">
            <table className="table table-sm table-hover align-middle">
              <thead>
                <tr>
                  <th>{t('ui.label.date')}</th>
                  <th>{t('ui.label.transaction')}</th>
                  <th>{t('ui.label.service')}</th>
                  <th>{t('ui.label.client')}</th>
                  <th className="text-end">{t('ui.label.price')}</th>
                  <th className="text-end">{t('ui.label.paid')}</th>
                  <th>{t('field.status')}</th>
                  <th>{t('field.costPaymentStatus')}</th>
                  <th>{t('ui.label.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row: any) => (
                  <tr key={row.id || row.transaction_number}>
                    <td className="small">{fmtDate(row.date)}</td>
                    <td className="small fw-semibold">{row.transaction_number}</td>
                    <td className="small">{row.service_name || '—'}</td>
                    <td className="small">{row.client_name || '—'}</td>
                    <td className="text-end small">{fmtMoney(row.customer_price)}</td>
                    <td className="text-end small">{fmtMoney(row.payment_amount)}</td>
                    <td><WeeklyBadge status={row.status} /></td>
                    <td><WeeklyBadge status={row.payment_status} /></td>
                    <td>
                      <button type="button" className="btn btn-sm btn-outline-secondary"
                        onClick={() => setTxRow(row)}>{t('ui.label.view')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={tx.data?.page || 1} pages={tx.data?.pages || 1} total={tx.data?.total}
          onPage={(p) => updateTx({ page: p })} {...weeklyPaginationLabels(t)} />

        <Modal show={!!txRow} title={`${t('ui.label.transaction')} ${txRow?.transaction_number || ''}`}
          onClose={() => setTxRow(null)} closeLabel={t('ui.label.close')}>
          {txRow && (
            <table className="table table-sm mb-0">
              <tbody>
                <tr><td className="text-muted">{t('ui.label.date')}</td><td>{fmtDate(txRow.date)}</td></tr>
                <tr><td className="text-muted">{t('ui.label.service')}</td><td>{txRow.service_name || '—'}</td></tr>
                <tr><td className="text-muted">{t('ui.label.client')}</td><td>{txRow.client_name || '—'}</td></tr>
                <tr><td className="text-muted">{t('field.status')}</td><td><WeeklyBadge status={txRow.status} /></td></tr>
                <tr><td className="text-muted">{t('field.costPaymentStatus')}</td><td><WeeklyBadge status={txRow.payment_status} /></td></tr>
                <tr><td className="text-muted">{t('ui.label.price')}</td><td className="money">{fmtMoney(txRow.customer_price)}</td></tr>
                <tr><td className="text-muted">{t('ui.label.cost')}</td><td className="money">{fmtMoney(txRow.official_cost)}</td></tr>
                <tr><td className="text-muted">{t('ui.label.paid')}</td><td className="money">{fmtMoney(txRow.payment_amount)}</td></tr>
                <tr><td className="text-muted">{t('ui.label.grossProfit')}</td><td className="money">{fmtMoney(txRow.gross_profit)}</td></tr>
                <tr><td className="text-muted">{t('ui.label.commission')}</td><td className="money">{fmtMoney(txRow.commission_amount)}</td></tr>
                <tr><td className="text-muted">{t('ui.label.method')}</td><td>{txRow.payment_method || '—'}</td></tr>
                <tr><td className="text-muted">{t('ui.label.eligible')}</td><td>{txRow.is_eligible ? t('ui.label.eligible') : t('ui.label.notEligible')}</td></tr>
              </tbody>
            </table>
          )}
        </Modal>
      </div>
    );
  }

  function renderClosings() {
    const items = closings.data?.items || [];
    const missing = closings.data?.missing || [];
    const overrideInfo = closings.data?.override || {};
    return (
      <div>
        <div className="alert alert-info py-2 small">
          <i className="bi bi-info-circle me-2" />{t('ui.label.missingNotice')}
        </div>
        {overrideInfo.reason && (
          <div className="alert alert-warning py-2 small">
            <strong>{t('ui.label.missingOverride')}:</strong> {overrideInfo.reason}
            <div className="text-muted">{t('ui.label.overrideBy')} {overrideInfo.authorized_by ?? '—'} · {fmtDateTime(overrideInfo.authorized_at)}</div>
          </div>
        )}
        <SectionState loading={closings.loading} error={closings.error} onRetry={closings.reload} />
        {!closings.loading && !closings.error && items.length === 0 && <EmptyState message={t('ui.list.empty')} />}
        {items.length > 0 && (
          <div className="table-responsive">
            <table className="table table-sm table-hover align-middle">
              <thead>
                <tr>
                  <th>{t('ui.label.date')}</th>
                  <th className="text-end">{t('field.transactionCount')}</th>
                  <th className="text-end">{t('ui.label.collections')}</th>
                  <th className="text-end">{t('ui.label.costs')}</th>
                  <th className="text-end">{t('ui.label.expected')}</th>
                  <th className="text-end">{t('ui.label.actual')}</th>
                  <th className="text-end">{t('ui.label.difference')}</th>
                  <th>{t('field.status')}</th>
                  <th>{t('field.comments')}</th>
                  <th>{t('ui.label.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row: any) => {
                  const isMissing = row.status === 'missing' || missing.includes(row.date);
                  return (
                    <tr key={row.date} className={isMissing ? 'table-warning' : ''}>
                      <td className="small">{fmtDate(row.date)}</td>
                      <td className="text-end small">{row.transaction_count ?? '—'}</td>
                      <td className="text-end small">{fmtMoney(row.collections)}</td>
                      <td className="text-end small">{fmtMoney(row.service_costs)}</td>
                      <td className="text-end small">{isMissing ? t('ui.label.none') : fmtMoney(row.expected_cash)}</td>
                      <td className="text-end small">{isMissing ? t('ui.label.none') : fmtMoney(row.actual_cash)}</td>
                      <td className="text-end small">{isMissing ? t('ui.label.none') : fmtMoney(row.difference)}</td>
                      <td><WeeklyBadge status={row.status} /></td>
                      <td className="small">{row.comments || (isMissing ? t('status.missing') : '—')}</td>
                      <td>
                        <button type="button" className="btn btn-sm btn-outline-secondary"
                          onClick={() => setClosingRow(row)}>{t('ui.label.view')}</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Modal show={!!closingRow} title={`${t('section.closings')} — ${closingRow ? fmtDate(closingRow.date) : ''}`}
          onClose={() => setClosingRow(null)} closeLabel={t('ui.label.close')}>
          {closingRow && (
            <>
              <table className="table table-sm mb-3">
                <tbody>
                  <tr><td className="text-muted">{t('field.status')}</td><td><WeeklyBadge status={closingRow.status} /></td></tr>
                  <tr><td className="text-muted">{t('field.transactionCount')}</td><td>{closingRow.transaction_count}</td></tr>
                  <tr><td className="text-muted">{t('ui.label.collections')}</td><td className="money">{fmtMoney(closingRow.collections)}</td></tr>
                  <tr><td className="text-muted">{t('ui.label.costs')}</td><td className="money">{fmtMoney(closingRow.service_costs)}</td></tr>
                  <tr><td className="text-muted">{t('ui.label.expectedCash')}</td><td className="money">{closingRow.expected_cash === null ? t('status.missing') : fmtMoney(closingRow.expected_cash)}</td></tr>
                  <tr><td className="text-muted">{t('ui.label.actual')}</td><td className="money">{closingRow.actual_cash === null ? t('status.missing') : fmtMoney(closingRow.actual_cash)}</td></tr>
                  <tr><td className="text-muted">{t('ui.label.difference')}</td><td className="money">{closingRow.difference === null ? t('status.missing') : fmtMoney(closingRow.difference)}</td></tr>
                  <tr><td className="text-muted">{t('field.comments')}</td><td>{closingRow.comments || '—'}</td></tr>
                </tbody>
              </table>
              {closingRow.closing_id && (
                <a href={`/closings?date=${closingRow.date}`} className="small">
                  <i className="bi bi-box-arrow-up-right me-1" />{t('ui.label.openWorkspace')}
                </a>
              )}
            </>
          )}
        </Modal>
        {canAdjust && backendEditable && missing.length > 0 && (
          <div className="card mt-3">
            <div className="card-header py-2 small fw-semibold">{t('ui.label.missingOverride')}</div>
            <div className="card-body">
              {feedback()}
              <form onSubmit={authorizeMissing}>
                <Field label={t('field.overrideReason')} required
                  hint={missing.length ? `${missing.length} ${t('status.missing')}` : undefined}>
                  <TextArea value={missingOverrideReason}
                    onChange={(e) => setMissingOverrideReason(e.target.value)} required />
                </Field>
                <button className="btn btn-sm btn-outline-warning" disabled={busy || !missingOverrideReason.trim()}>
                  {t('action.adjust')}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderExpenses() {
    const items = expenses.data?.items || [];
    return (
      <div>
        <div className="alert alert-info py-2 small">
          <i className="bi bi-info-circle me-2" />{t('ui.label.expenseNote')}
        </div>
        <SectionState loading={expenses.loading} error={expenses.error} onRetry={expenses.reload} />
        {!expenses.loading && !expenses.error && items.length === 0 && <EmptyState message={t('ui.list.empty')} />}
        {items.length > 0 && (
          <div className="table-responsive">
            <table className="table table-sm table-hover align-middle">
              <thead>
                <tr>
                  <th>{t('ui.label.date')}</th>
                  <th>{t('ui.label.category')}</th>
                  <th>{t('ui.label.description')}</th>
                  <th className="text-end">{t('field.amount')}</th>
                  <th>{t('ui.label.paymentSource')}</th>
                  <th>{t('ui.label.receipt')}</th>
                  <th>{t('field.status')}</th>
                  <th>{t('ui.label.approver')}</th>
                  <th>{t('field.comments')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row: any) => (
                  <tr key={row.id}>
                    <td className="small">{fmtDate(row.date)}</td>
                    <td className="small">{row.category || '—'}</td>
                    <td className="small">{row.description || '—'}</td>
                    <td className="text-end small">{fmtMoney(row.amount)}</td>
                    <td className="small">{row.payment_source || '—'}</td>
                    <td className="small">
                      {row.receipt_path
                        ? <a href={row.receipt_path.startsWith('/') ? row.receipt_path : `/${row.receipt_path}`}
                            target="_blank" rel="noreferrer"><i className="bi bi-paperclip me-1" />{t('ui.label.receipt')}</a>
                        : t('ui.label.none')}
                    </td>
                    <td><WeeklyBadge status={row.payment_status} /></td>
                    <td className="small">{row.approver_name || '—'}</td>
                    <td className="small">{row.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  function renderOfficialCosts() {
    const items: any[] = claims.data?.items || [];
    const claimByTxn = new Map<number, any>(items.map((item) => [Number(item.transaction_id), item]));
    const transactions: any[] = (calc.transactions || [])
      .filter((row: any) => Number(row.official_cost) > 0);
    // Land Document costs are auto-confirmed as AfriTech Bridge-paid; there is
    // no agent-funded claim to record or verify for them.
    const unclaimed = transactions.filter((row: any) =>
      !claimByTxn.has(Number(row.id)) && !row.company_funded);
    const isPersonal = claimTxnId !== null && claimFormValue(claimTxnId, 'personal_payment') !== 'no';
    return (
      <div>
        <div className="alert alert-info py-2 small">
          <i className="bi bi-info-circle me-2" />{t('ui.label.costPaymentNote')}
        </div>
        <SectionState loading={claims.loading} error={claims.error} onRetry={claims.reload} />
        {feedback()}
        {editable && unclaimed.length > 0 && (
          <div className="card mb-3">
            <div className="card-header py-2 small fw-semibold">{t('action.addCostPayment')}</div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-12">
                  <Field label={t('ui.label.transaction')} required>
                    <SelectInput value={claimTxnId ?? ''}
                      onChange={(e) => e.target.value
                        ? openClaimForm(Number(e.target.value)) : setClaimTxnId(null)}>
                      <option value="">{t('ui.label.selectCostTransaction')}</option>
                      {unclaimed.map((row: any) => (
                        <option key={row.id} value={row.id}>
                          {row.transaction_number} · {fmtMoney(row.official_cost)}
                          {row.client_name ? ` · ${row.client_name}` : ''}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                </div>
                {claimTxnId !== null && (
                  <>
                    <div className="col-md-6">
                      <Field label={t('field.personalPayment')} required>
                        <SelectInput value={claimFormValue(claimTxnId, 'personal_payment')}
                          onChange={(e) => patchClaimForm(claimTxnId, 'personal_payment', e.target.value)}>
                          <option value="yes">{t('ui.label.personalPaymentYes')}</option>
                          <option value="no">{t('ui.label.personalPaymentNo')}</option>
                        </SelectInput>
                      </Field>
                    </div>
                    {isPersonal && (
                      <>
                        <div className="col-md-3">
                          <Field label={t('field.paymentProvider')} required>
                            <SelectInput value={claimFormValue(claimTxnId, 'provider')}
                              onChange={(e) => patchClaimForm(claimTxnId, 'provider', e.target.value)}>
                              {(policy?.momo_providers || ['momo', 'bank_transfer', 'cash_deposit']).map((p: string) => (
                                <option key={p} value={p}>
                                  {t(`ui.provider.${p}`) !== `ui.provider.${p}` ? t(`ui.provider.${p}`) : p}
                                </option>
                              ))}
                            </SelectInput>
                          </Field>
                        </div>
                        <div className="col-md-3">
                          <Field label={t('field.personalPaidAmount')} required>
                            <TextInput type="number" step="0.01" min="0.01"
                              value={claimFormValue(claimTxnId, 'amount')}
                              onChange={(e) => patchClaimForm(claimTxnId, 'amount', e.target.value)} />
                          </Field>
                        </div>
                        <div className="col-md-3">
                          <Field label={t('field.reference')} required>
                            <TextInput value={claimFormValue(claimTxnId, 'reference')}
                              onChange={(e) => patchClaimForm(claimTxnId, 'reference', e.target.value)} />
                          </Field>
                        </div>
                        <div className="col-md-3">
                          <Field label={t('field.paidAt')}>
                            <TextInput type="datetime-local" value={claimFormValue(claimTxnId, 'paid_at')}
                              onChange={(e) => patchClaimForm(claimTxnId, 'paid_at', e.target.value)} />
                          </Field>
                        </div>
                        <div className="col-md-4">
                          <Field label={t('field.senderPhone')} required>
                            <TextInput value={claimFormValue(claimTxnId, 'sender_phone')}
                              onChange={(e) => patchClaimForm(claimTxnId, 'sender_phone', e.target.value)} />
                          </Field>
                        </div>
                        <div className="col-md-8">
                          <Field label={t('field.evidence')} hint={t('ui.label.evidenceHelp')} required>
                            <TextInput type="file" accept=".pdf,.png,.jpg,.jpeg,.webp"
                              onChange={(e) => setClaimEvidence((old) => ({
                                ...old, [claimTxnId as number]: e.target.files?.[0] || null,
                              }))} />
                          </Field>
                        </div>
                      </>
                    )}
                    <div className="col-12">
                      <Field label={t('field.notes')}>
                        <TextArea value={claimFormValue(claimTxnId, 'notes')}
                          onChange={(e) => patchClaimForm(claimTxnId, 'notes', e.target.value)} />
                      </Field>
                    </div>
                    <div className="col-12 d-flex gap-2">
                      <button type="button" className="btn btn-sm btn-primary" disabled={busy}
                        onClick={submitCostClaim}>{t('action.addCostPayment')}</button>
                      <button type="button" className="btn btn-sm btn-outline-secondary"
                        onClick={() => setClaimTxnId(null)}>{t('ui.label.cancel')}</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
        {!claims.loading && !claims.error && transactions.length === 0 && (
          <EmptyState message={t('ui.list.empty')} />
        )}
        {transactions.length > 0 && (
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  <th>{t('ui.label.transaction')}</th>
                  <th>{t('ui.label.date')}</th>
                  <th>{t('field.costPaymentStatus')}</th>
                  <th className="text-end">{t('ui.label.cost')}</th>
                  <th>{t('field.personalPayment')}</th>
                  <th className="text-end">{t('field.personalPaidAmount')}</th>
                  <th>{t('field.officialCostPaymentStatus')}</th>
                  <th>{t('ui.label.costPaymentSummary')}</th>
                  <th className="text-end">{t('ui.label.deductibleAmount')}</th>
                  <th>{t('ui.label.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((row: any) => {
                  const claim = claimByTxn.get(Number(row.id));
                  const companyFunded = !!row.company_funded || !!claim?.auto_company_funded;
                  const verified = !companyFunded && !!claim && claim.personal_payment
                    && claim.verification_status === 'verified';
                  const autoApplied = !companyFunded && !!claim && claim.personal_payment
                    && !!claim.auto_personal && claim.verification_status === 'pending';
                  const credited = verified || autoApplied;
                  return (
                    <tr key={row.id}>
                      <td className="small fw-semibold">{row.transaction_number || row.id}</td>
                      <td className="small">{fmtDate(row.date)}</td>
                      <td><WeeklyBadge status={row.payment_status} /></td>
                      <td className="text-end small">{fmtMoney(row.official_cost)}</td>
                      <td className="small">
                        {companyFunded ? t('ui.agent.costAutoCompany')
                          : !claim ? t('status.not_claimed')
                            : claim.personal_payment ? t('ui.label.personalPaymentYes')
                              : t('ui.label.personalPaymentNo')}
                      </td>
                      <td className="text-end small">
                        {!claim ? '—'
                          : claim.personal_payment ? fmtMoney(claim.amount)
                            : t('status.not_applicable')}
                      </td>
                      <td>
                        <WeeklyBadge status={autoApplied ? 'auto_applied'
                          : claim?.verification_status || 'not_claimed'} />
                      </td>
                      <td className="small">
                        {!claim ? <span className="text-muted">{t('ui.label.none')}</span> : (
                          <div>
                            <div>{t(`ui.provider.${claim.provider}`) !== `ui.provider.${claim.provider}`
                              ? t(`ui.provider.${claim.provider}`) : claim.provider}</div>
                            <div className="fw-semibold">{claim.reference}</div>
                            <div>{claim.sender_phone || t('ui.label.none')} · {fmtDateTime(claim.paid_at)}</div>
                            {claim.is_partial && <div>{t('ui.label.partialPayment')}</div>}
                            {companyFunded && (
                              <div className="text-muted">{t('ui.agent.costAutoCompanyNote')}</div>
                            )}
                            {autoApplied && (
                              <div className="text-muted">{t('ui.agent.costAutoAppliedNote')}</div>
                            )}
                            {claim.evidence_path && (
                              <button type="button" className="btn btn-link btn-sm p-0"
                                onClick={() => downloadCostEvidence(claim)}
                                title={claim.evidence_name || ''}>
                                <i className="bi bi-paperclip me-1" />{t('ui.label.download')}
                              </button>
                            )}
                            {claim.notes && <div className="text-muted">{claim.notes}</div>}
                            {claim.verification_note && (
                              <div className="text-muted">
                                <strong>{t('ui.label.costVerificationNote')}:</strong> {claim.verification_note}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="text-end small">
                        {companyFunded
                          ? t('ui.agent.costNoDeduction')
                          : fmtMoney(credited ? claim.amount : 0)}
                      </td>
                      <td className="small">
                        <div className="d-flex flex-wrap gap-1">
                          {editable && !claim && !companyFunded && (
                            <button type="button" className="btn btn-sm btn-outline-primary"
                              disabled={busy} onClick={() => openClaimForm(Number(row.id))}>
                              {t('action.addCostPayment')}
                            </button>
                          )}
                          {editable && claim && !companyFunded && (
                            <button type="button" className="btn btn-sm btn-outline-danger"
                              disabled={busy} onClick={() => removeCostClaim(claim.id)}>
                              {t('ui.label.remove')}
                            </button>
                          )}
                          {canReview && reviewable && claim && !companyFunded && (
                            <div className="w-100 mt-1">
                              <TextInput aria-label={t('ui.label.costVerificationNote')}
                                className="form-control-sm mb-1"
                                value={claimReviewNote[claim.id] || ''}
                                placeholder={t('field.notes')}
                                onChange={(e) => setClaimReviewNote({
                                  ...claimReviewNote, [claim.id]: e.target.value,
                                })} />
                              <div className="d-flex gap-1">
                                {!autoApplied && (
                                  <button type="button" className="btn btn-sm btn-outline-success"
                                    disabled={busy || !claim.personal_payment}
                                    onClick={() => reviewClaim(claim.id, 'verify_cost_payment')}>
                                    {t('action.verifyCost')}
                                  </button>
                                )}
                                <button type="button" className="btn btn-sm btn-outline-danger"
                                  disabled={busy}
                                  onClick={() => reviewClaim(claim.id, 'reject_cost_payment')}>
                                  {t('action.rejectCost')}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="alert alert-secondary py-2 small mt-3 mb-0">
          {t('ui.label.costPaymentSummary')}: <strong>{items.length}</strong> ·{' '}
          {t('field.personalPaidAmount')}: <strong>{fmtMoney(claims.data?.verified_total)}</strong>.{' '}
          {t('ui.label.verifiedTotal')}
        </div>
      </div>
    );
  }

  function renderMomo() {
    const submissions = report?.momo_submissions || report?.calculation?.momo_submissions || [];
    return (
      <div>
        <SectionState loading={detail.loading} error={detail.error} onRetry={detail.reload} />
        {feedback()}
        {editable && (
          <div className="card mb-3">
            <div className="card-header py-2 small fw-semibold">{t('action.addMomo')}</div>
            <div className="card-body">
              <form onSubmit={addMomo}>
                <div className="row g-3">
                  <div className="col-md-3">
                    <Field label={t('field.provider')} required>
                      <SelectInput value={momoForm.provider}
                        onChange={(e) => setMomoForm({ ...momoForm, provider: e.target.value })}>
                        {(policy?.momo_providers || ['momo', 'bank_transfer', 'cash_deposit']).map((p: string) => (
                          <option key={p} value={p}>
                            {t(`ui.provider.${p}`) !== `ui.provider.${p}` ? t(`ui.provider.${p}`) : p}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>
                  </div>
                  <div className="col-md-3">
                    <Field label={t('field.reference')} required>
                      <TextInput value={momoForm.reference} required
                        onChange={(e) => setMomoForm({ ...momoForm, reference: e.target.value })} />
                    </Field>
                  </div>
                  <div className="col-md-3">
                    <Field label={t('field.amount')} required>
                      <TextInput type="number" step="0.01" min="0.01" value={momoForm.amount} required
                        onChange={(e) => setMomoForm({ ...momoForm, amount: e.target.value })} />
                    </Field>
                  </div>
                  <div className="col-md-3">
                    <Field label={t('field.datetime')}>
                      <TextInput type="datetime-local" value={momoForm.submitted_at}
                        onChange={(e) => setMomoForm({ ...momoForm, submitted_at: e.target.value })} />
                    </Field>
                  </div>
                  <div className="col-md-3">
                    <Field label={t('field.senderPhone')}>
                      <TextInput value={momoForm.sender_phone}
                        onChange={(e) => setMomoForm({ ...momoForm, sender_phone: e.target.value })} />
                    </Field>
                  </div>
                  <div className="col-md-3">
                    <Field label={t('field.recipientPhone')}>
                      <TextInput value={momoForm.recipient_phone}
                        onChange={(e) => setMomoForm({ ...momoForm, recipient_phone: e.target.value })} />
                    </Field>
                  </div>
                  <div className="col-md-3">
                    <Field label={t('field.confirmation')}>
                      <TextInput value={momoForm.confirmation_code}
                        onChange={(e) => setMomoForm({ ...momoForm, confirmation_code: e.target.value })} />
                    </Field>
                  </div>
                  <div className="col-md-3">
                    <Field label={t('field.evidence')} hint={t('ui.label.evidenceHelp')}>
                      <TextInput id="weekly-momo-evidence" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp"
                        onChange={(e) => setMomoEvidence(e.target.files?.[0] || null)} />
                    </Field>
                  </div>
                  <div className="col-12">
                    <Field label={t('field.notes')}>
                      <TextArea value={momoForm.notes}
                        onChange={(e) => setMomoForm({ ...momoForm, notes: e.target.value })} />
                    </Field>
                  </div>
                </div>
                <button type="submit" className="btn btn-sm btn-primary" disabled={busy}>
                  <i className="bi bi-plus-circle me-1" />{t('action.addMomo')}
                </button>
              </form>
            </div>
          </div>
        )}
        {submissions.length === 0 && <EmptyState message={t('ui.list.empty')} />}
        {submissions.length > 0 && (
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  <th>{t('field.provider')}</th>
                  <th>{t('field.reference')}</th>
                  <th className="text-end">{t('field.amount')}</th>
                  <th>{t('field.datetime')}</th>
                  <th>{t('field.senderPhone')}</th>
                  <th>{t('field.recipientPhone')}</th>
                  <th>{t('field.confirmation')}</th>
                  <th>{t('field.evidence')}</th>
                  <th>{t('field.verification')}</th>
                  {canReview && reviewable && <th>{t('ui.label.actions')}</th>}
                  {editable && <th>{t('ui.label.actions')}</th>}
                </tr>
              </thead>
              <tbody>
                {submissions.map((m: any) => (
                  <tr key={m.id}>
                    <td className="small">
                      {t(`ui.provider.${m.provider}`) !== `ui.provider.${m.provider}` ? t(`ui.provider.${m.provider}`) : m.provider}
                    </td>
                    <td className="small fw-semibold">{m.reference}</td>
                    <td className="text-end small">{fmtMoney(m.amount)}</td>
                    <td className="small">{fmtDateTime(m.submitted_at)}</td>
                    <td className="small">{m.sender_phone || '—'}</td>
                    <td className="small">{m.recipient_phone || '—'}</td>
                    <td className="small">{m.confirmation_code || '—'}</td>
                    <td className="small">
                      {m.evidence_path
                        ? <button type="button" className="btn btn-link btn-sm p-0"
                            onClick={() => downloadMoMoEvidence(m)} title={m.evidence_name || ''}>
                            <i className="bi bi-paperclip me-1" />{t('ui.label.download')}</button>
                        : t('ui.label.none')}
                    </td>
                    <td><WeeklyBadge status={m.verification_status} /></td>
                    {canReview && reviewable && (
                      <td className="small">
                        <TextInput aria-label={t('field.verification')} className="form-control-sm mb-1"
                          value={momoNote[m.id] || ''} placeholder={t('field.notes')}
                          onChange={(e) => setMomoNote({ ...momoNote, [m.id]: e.target.value })} />
                        <div className="d-flex gap-1">
                          <button className="btn btn-sm btn-outline-success" disabled={busy}
                            onClick={() => reviewMomo(m.id, 'verify_momo')}>{t('action.verify')}</button>
                          <button className="btn btn-sm btn-outline-danger" disabled={busy}
                            onClick={() => reviewMomo(m.id, 'reject_momo')}>{t('action.rejectTransfer')}</button>
                        </div>
                        {m.verification_note && <div className="text-muted mt-1">{m.verification_note}</div>}
                      </td>
                    )}
                    {editable && (
                      <td>
                        <button className="btn btn-sm btn-outline-danger" disabled={busy}
                          onClick={() => removeMomo(m.id)}>{t('ui.label.remove')}</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="alert alert-secondary py-2 small mt-3 mb-0">
          {t('field.agentReported')}: <strong>{fmtMoney(c.agent_reported_submitted)}</strong> ·{' '}
          {t('field.verifiedSubmitted')}: <strong>{fmtMoney(c.verified_submitted)}</strong>.{' '}
          {t('ui.label.verifiedTotal')}
        </div>
      </div>
    );
  }

  function renderShortage() {
    const shortage = Number(c.shortage_amount || 0);
    return (
      <div>
        <div className="alert alert-info py-2 small">{t('ui.label.shortageNote')}</div>
        <div className="card mb-3">
          <div className="card-header py-2 small fw-semibold">{t('ui.label.weeklySubmission')}</div>
          <div className="card-body">
            <div className="alert alert-warning py-2 small mb-3">
              {t('ui.label.fundingSourceHelp')}
            </div>
            <div className="row g-3">
              <div className="col-md-4">
                <Field label={t('field.declaredSubmitted')} required>
                  <TextInput type="number" step="0.01" min="0" disabled={!editable}
                    value={submissionForm.declared_submitted_amount}
                    onChange={(e) => setSubmissionForm({
                      ...submissionForm, declared_submitted_amount: e.target.value,
                    })} />
                </Field>
              </div>
              <div className="col-md-4">
                <Field label={t('field.submissionFundingSource')} required>
                  <SelectInput disabled={!editable}
                    value={submissionForm.submission_funding_source}
                    onChange={(e) => setSubmissionForm({
                      ...submissionForm, submission_funding_source: e.target.value,
                    })}>
                    {(policy?.submission_sources || ['agent_phone', 'company', 'someone_else']).map((s: string) => (
                      <option key={s} value={s}>{t(`ui.source.${s}`)}</option>
                    ))}
                  </SelectInput>
                </Field>
              </div>
              <div className="col-md-4">
                <Field label={t('field.verifiedSubmitted')}>
                  <div className="form-control-plaintext small fw-semibold">
                    {fmtMoney(c.verified_submitted)}
                  </div>
                </Field>
              </div>
            </div>
          </div>
        </div>
        <div className="row g-3 mb-3">
          <div className="col-md-4"><StatCard label={t('field.expectedRemittance')} value={fmtMoney(c.expected_remittance)} /></div>
          <div className="col-md-4"><StatCard label={t('field.verifiedSubmitted')} value={fmtMoney(c.verified_submitted)} /></div>
          <div className="col-md-4">
            <StatCard label={shortage > 0 ? t('field.shortage') : t('field.surplus')}
              value={fmtMoney(shortage > 0 ? c.shortage_amount : c.surplus_amount)}
              tone={shortage > 0 ? 'danger' : 'success'} />
          </div>
        </div>
        {feedback()}
        <div className="card">
          <div className="card-header py-2 small fw-semibold">{t('section.shortage')}</div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-6">
                <Field label={t('field.reasonCategory')}>
                  <SelectInput disabled={!editable} value={shortageForm.shortage_reason_category || ''}
                    onChange={(e) => setShortageForm({ ...shortageForm, shortage_reason_category: e.target.value })}>
                    <option value="">{t('ui.label.none')}</option>
                    {(policy?.shortage_reason_categories || []).map((category: string) => (
                      <option key={category} value={category}>
                        {t(`ui.reason.${category}`) !== `ui.reason.${category}` ? t(`ui.reason.${category}`) : category}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
              </div>
              <div className="col-md-6">
                <Field label={t('field.resolutionDate')}>
                  <TextInput type="date" disabled={!editable} value={shortageForm.expected_resolution_date || ''}
                    onChange={(e) => setShortageForm({ ...shortageForm, expected_resolution_date: e.target.value })} />
                </Field>
              </div>
              <div className="col-12">
                <Field label={t('field.explanation')}>
                  <TextArea disabled={!editable} rows={4} value={shortageForm.shortage_explanation || ''}
                    onChange={(e) => setShortageForm({ ...shortageForm, shortage_explanation: e.target.value })} />
                </Field>
              </div>
              <div className="col-md-6">
                <Field label={t('field.evidence')} hint={t('ui.label.evidenceHelp')}>
                  {editable && (
                    <TextInput type="file" accept=".pdf,.png,.jpg,.jpeg,.webp"
                      onChange={(e) => setShortageEvidence(e.target.files?.[0] || null)} />
                  )}
                  {report?.shortage_evidence_name && (
                    <div className="mt-2 small">
                      <button type="button" className="btn btn-link btn-sm p-0" onClick={downloadShortageEvidence}>
                        <i className="bi bi-paperclip me-1" />{report.shortage_evidence_name}
                      </button>
                    </div>
                  )}
                  {!editable && !report?.shortage_evidence_name && <div className="small text-muted">{t('ui.label.noEvidence')}</div>}
                </Field>
              </div>
              <div className="col-md-6">
                <Field label={t('field.overrideReason')}>
                  <TextArea disabled={!editable && !canAdjust} rows={3} value={shortageForm.override_reason || ''}
                    onChange={(e) => setShortageForm({ ...shortageForm, override_reason: e.target.value })} />
                  {report?.has_override && (
                    <div className="form-text">
                      {t('ui.label.overrideAuthorized')} · {t('ui.label.overrideBy')} {report.override_authorized_by}{' '}
                      · {fmtDateTime(report.override_authorized_at)}
                    </div>
                  )}
                </Field>
              </div>
              {editable && (
                <div className="col-md-6">
                  <Field label={t('ui.label.submissionNote')}>
                    <TextArea value={submissionNote} onChange={(e) => setSubmissionNote(e.target.value)} />
                  </Field>
                </div>
              )}
            </div>
            {editable && (
              <div className="d-flex gap-2 mt-3">
                <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy}
                  onClick={saveDraft}>{t('ui.label.save')}</button>
                <button type="button" className="btn btn-sm btn-primary" disabled={busy}
                  onClick={submitReport}>
                  {t(report?.status === 'returned_for_correction' ? 'action.resubmit' : 'action.submit')}
                </button>
              </div>
            )}
          </div>
        </div>
        {canAdjust && backendEditable && (
          <div className="card mt-3">
            <div className="card-header py-2 small fw-semibold">{t('ui.label.overrideAuthorized')}</div>
            <div className="card-body">
              <form onSubmit={authorizeOverride}>
                <Field label={t('field.overrideReason')} required
                  hint={policy?.allow_override === false ? t('error.unexplained_shortage') : undefined}>
                  <TextArea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} required />
                </Field>
                <button className="btn btn-sm btn-outline-warning" disabled={busy || !overrideReason.trim()}>
                  {t('action.adjust')}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderReview() {
    if (!canReview && !canAdjust) {
      return <EmptyState message={t('ui.label.reviewWorkspace')} icon="bi-shield-lock" />;
    }
    return (
      <div>
        {feedback()}
        <div className="row g-3 mb-3">
          <div className="col-md-4"><StatCard label={t('field.agentReported')} value={fmtMoney(c.agent_reported_submitted)} /></div>
          <div className="col-md-4"><StatCard label={t('field.verifiedSubmitted')} value={fmtMoney(c.verified_submitted)} tone="success" /></div>
          <div className="col-md-4"><StatCard label={t('field.closingOutstanding')} value={fmtMoney(c.closing_outstanding)} tone="warning" /></div>
        </div>
        {(report?.correction_note || report?.rejection_reason || report?.reviewer_note) && (
          <div className="alert alert-warning py-2 small">
            <div><strong>{t('ui.label.correctionReason')}:</strong> {report.correction_note || '—'}</div>
            <div><strong>{t('ui.label.rejectionReason')}:</strong> {report.rejection_reason || '—'}</div>
            <div><strong>{t('ui.label.reviewNote')}:</strong> {report.reviewer_note || '—'}</div>
          </div>
        )}
        <div className="row g-3">
          {canDecide && (
            <div className="col-lg-6">
              <div className="card h-100">
                <div className="card-header py-2 small fw-semibold">{t('section.review')}</div>
                <div className="card-body">
                  <Field label={t('ui.label.correctionReason')}>
                    <TextArea value={reviewReason} onChange={(e) => setReviewReason(e.target.value)} />
                  </Field>
                  <div className="d-flex gap-2 flex-wrap">
                    <button className="btn btn-sm btn-outline-warning" disabled={busy}
                      onClick={() => reviewAction('request_correction')}>{t('action.requestCorrection')}</button>
                    <button className="btn btn-sm btn-outline-danger" disabled={busy}
                      onClick={() => reviewAction('reject')}>{t('action.reject')}</button>
                    <button className="btn btn-sm btn-success" disabled={busy}
                      onClick={() => reviewAction('approve')}>{t('action.approve')}</button>
                  </div>
                  <div className="form-text mt-2">{t('ui.label.rejectionReason')}: {t('ui.error.required')}</div>
                </div>
              </div>
            </div>
          )}
          {canOverrideApproval && (
            <div className="col-lg-6">
              <div className="card h-100">
                <div className="card-header py-2 small fw-semibold">{t('review.superAdminOverride')}</div>
                <div className="card-body">
                  <Field label={t('review.overrideTarget')}>
                    <SelectInput value={selectedOverride}
                      onChange={(e) => setStatusOverrideTarget(e.target.value)}>
                      {overrideTargets.map((status) => (
                        <option key={status} value={status}>{statusLabel(status)}</option>
                      ))}
                    </SelectInput>
                  </Field>
                  <Field label={t('review.decisionReason')}>
                    <TextArea value={statusOverrideReason}
                      onChange={(e) => setStatusOverrideReason(e.target.value)} />
                  </Field>
                  <button className="btn btn-sm btn-outline-warning" disabled={busy}
                    onClick={overrideApproval}>{t('action.reopenApproval')}</button>
                  <div className="form-text mt-2">{t('review.superAdminHelp')}</div>
                </div>
              </div>
            </div>
          )}
          {canAdjustReport && (
            <div className="col-lg-6">
              <div className="card h-100">
                <div className="card-header py-2 small fw-semibold">{t('action.adjust')}</div>
                <div className="card-body">
                  <form onSubmit={addAdjustment}>
                    <div className="row g-2">
                      <div className="col-md-6">
                        <Field label={t('ui.label.kind')} required>
                          <SelectInput value={adjustForm.kind}
                            onChange={(e) => setAdjustForm({ ...adjustForm, kind: e.target.value })}>
                            {ADJUSTMENT_KINDS.map((kind) => (
                              <option key={kind} value={kind}>
                                {t(`ui.adjustment.${kind}`) !== `ui.adjustment.${kind}` ? t(`ui.adjustment.${kind}`) : kind}
                              </option>
                            ))}
                          </SelectInput>
                        </Field>
                      </div>
                      <div className="col-md-6">
                        <Field label={t('ui.label.label')}>
                          <TextInput value={adjustForm.label}
                            onChange={(e) => setAdjustForm({ ...adjustForm, label: e.target.value })} />
                        </Field>
                      </div>
                      <div className="col-md-6">
                        <Field label={t('field.original')} required>
                          <TextInput type="number" step="0.01" value={adjustForm.original_amount}
                            onChange={(e) => setAdjustForm({ ...adjustForm, original_amount: e.target.value })} />
                        </Field>
                      </div>
                      <div className="col-md-6">
                        <Field label={t('field.adjusted')} required>
                          <TextInput type="number" step="0.01" value={adjustForm.adjusted_amount}
                            onChange={(e) => setAdjustForm({ ...adjustForm, adjusted_amount: e.target.value })} />
                        </Field>
                      </div>
                      <div className="col-12">
                        <Field label={t('ui.label.reason')} required>
                          <TextArea value={adjustForm.reason}
                            onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })} />
                        </Field>
                      </div>
                    </div>
                    <button className="btn btn-sm btn-outline-primary" disabled={busy}>{t('action.adjust')}</button>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="small text-muted mt-3">
          {t('ui.label.actions')}: {report?.allowed_transitions?.length
            ? report.allowed_transitions.map((s: string) => statusLabel(s)).join(' · ')
            : t('ui.label.none')}
        </div>
        {canExport && <WeeklyExportButtons reportId={reportId} className="mt-3" />}
      </div>
    );
  }

  function renderAudit() {
    const items = audit.data?.items || [];
    return (
      <div>
        <SectionState loading={audit.loading} error={audit.error} onRetry={audit.reload} />
        {!audit.loading && !audit.error && items.length === 0 && <EmptyState message={t('ui.list.empty')} />}
        {items.length > 0 && (
          <div className="table-responsive">
            <table className="table table-sm table-hover align-middle">
              <thead>
                <tr>
                  <th>{t('ui.label.auditWhen')}</th>
                  <th>{t('ui.label.auditActor')}</th>
                  <th>{t('ui.label.auditAction')}</th>
                  <th>{t('ui.label.details')}</th>
                  <th>{t('ui.label.reason')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row: any) => (
                  <tr key={row.id}>
                    <td className="small">{fmtDateTime(row.created_at)}</td>
                    <td className="small">{row.user_email || '—'}</td>
                    <td className="small fw-semibold">{row.action}</td>
                    <td className="small"><pre className="mb-0 small" style={{ whiteSpace: 'pre-wrap' }}>{prettyJson(row.new_value || row.previous_value)}</pre></td>
                    <td className="small">{row.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  if (detail.loading && !report) return <Loading label={t('ui.label.loading')} />;
  if (detail.error && !report) return <ErrorAlert message={weeklyErrorMessage(detail.error, t)} onRetry={detail.reload} retryLabel={t('action.retry')} />;
  if (!report) return <EmptyState message={t('ui.error.loadFailed')} />;

  const renderers: Record<WeeklyTab, () => React.ReactNode> = {
    overview: renderOverview,
    transactions: renderTransactions,
    closings: renderClosings,
    expenses: renderExpenses,
    officialCosts: renderOfficialCosts,
    momo: renderMomo,
    shortage: renderShortage,
    review: renderReview,
    audit: renderAudit,
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
        <div>
          <div className="small text-muted">
            {report.report_number} · {fmtDate(report.week_start)} – {fmtDate(report.week_end)}
            {report.employee_name ? ` · ${report.employee_name}` : ''}
          </div>
          <div className="d-flex align-items-center gap-2 mt-1">
            <WeeklyBadge status={report.status} />
            {report.is_late && <WeeklyBadge status="late" />}
            {report.branch_name && <span className="small text-muted">{report.branch_name}</span>}
          </div>
        </div>
        {canExport && <WeeklyExportButtons reportId={reportId} />}
      </div>

      {feedback()}

      <ul className="nav nav-tabs flex-wrap">
        {WEEKLY_TABS.map((item) => (
          <li className="nav-item" key={item.key}>
            <button type="button"
              className={`nav-link small ${tab === item.key ? 'active' : ''}`}
              onClick={() => { setTab(item.key); setActionError(''); setNotice(''); }}>
              <i className={`bi ${item.icon} me-1`} />{t(item.label)}
            </button>
          </li>
        ))}
      </ul>
      <div className="card border-top-0 rounded-top-0">
        <div className="card-body">
          {renderers[tab]()}
        </div>
      </div>
      {reviewMode && !locked && (
        <div className="small text-muted mt-2">
          <i className="bi bi-info-circle me-1" />{t('ui.queue.hint')}
        </div>
      )}
    </div>
  );
}
