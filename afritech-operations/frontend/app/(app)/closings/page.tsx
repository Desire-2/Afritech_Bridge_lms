'use client';

import { useEffect, useState } from 'react';
import { useFetch, todayIso } from '@/lib/use-fetch';
import { api, fmtMoney, fmtDate, can, isSuperAdmin } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PageHeader, Loading, ErrorAlert, EmptyState, Pagination, Modal, Badge } from '@/components/ui';
import { Field, TextInput, SelectInput, TextArea } from '@/components/form';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default function ClosingsPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [date, setDate] = useState('');
  const [dateTouched, setDateTouched] = useState(false);
  const [showAllDates, setShowAllDates] = useState(false);
  const [totalsEmployeeId, setTotalsEmployeeId] = useState<number | null>(null);
  const [totalsNonce, setTotalsNonce] = useState(0);
  const [totals, setTotals] = useState<any | null>(null);
  const [totalsKey, setTotalsKey] = useState('');
  const [loadingTotals, setLoadingTotals] = useState(false);
  const [totalErr, setTotalErr] = useState('');
  const [submitOpen, setSubmitOpen] = useState(false);
  const [actualCash, setActualCash] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState<any | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [overrideMode, setOverrideMode] = useState(false);
  const [overrideDecision, setOverrideDecision] = useState('correction_requested');
  const [reRunning, setReRunning] = useState<any | null>(null);
  const [error2, setError2] = useState('');

  const canApprove = can(user, 'closings.approve');
  const isAdmin = isSuperAdmin(user);
  const canView = can(user, 'closings.view') || can(user, 'closings.submit') || canApprove;
  const dateValid = ISO_DATE.test(date);
  const selectedEmployeeId = totalsEmployeeId ?? user?.employee_id ?? null;
  const totalsCurrent = totals !== null && !!selectedEmployeeId
    && totalsKey === `${selectedEmployeeId}:${date}`;

  // The business calendar is server-authoritative. The browser's own "today"
  // is only a fallback if this endpoint is unavailable.
  const businessDate = useFetch<any>(canView ? '/api/closings/today' : '', [canView]);
  const employees = useFetch<any>(canApprove ? '/api/employees?per_page=500&status=active' : '', [canApprove]);
  const employeeOptions = employees.data?.items || [];
  const selectedEmployeeName = employeeOptions.find((e: any) => e.id === selectedEmployeeId)?.full_name
    || (selectedEmployeeId === user?.employee_id ? user?.employee_name : '')
    || (selectedEmployeeId ? `Employee #${selectedEmployeeId}` : '');

  useEffect(() => {
    if (dateTouched) return;
    if (businessDate.data?.date && ISO_DATE.test(businessDate.data.date)) {
      setDate(businessDate.data.date);
    } else if (businessDate.error) {
      setDate(todayIso());
    }
  }, [businessDate.data?.date, businessDate.error, dateTouched]);

  const dateFilter = showAllDates || !dateValid ? {} : { start: date, end: date };
  const employeeFilter = selectedEmployeeId || undefined;
  const { data, error, loading, reload } = useFetch('/api/closings',
    [page, status, date, showAllDates, employeeFilter],
    {
      page, per_page: 15,
      status: status || undefined,
      employee_id: employeeFilter,
      ...dateFilter,
    });
  const items = data?.items || [];

  // Totals always track the selected date AND employee. The response echo
  // keys the cache so a late/other-employee reply can never be shown as if it
  // belonged to the current selection.
  useEffect(() => {
    if (!dateValid) {
      setTotals(null);
      setTotalsKey('');
      setLoadingTotals(false);
      setTotalErr(date ? 'Date must be in YYYY-MM-DD format.' : 'Pick a date to load its totals.');
      return;
    }
    if (!selectedEmployeeId) {
      setTotals(null);
      setTotalsKey('');
      setLoadingTotals(false);
      setTotalErr('Select an employee to load totals.');
      return;
    }
    let cancelled = false;
    setLoadingTotals(true);
    setTotalErr('');
    const qs = new URLSearchParams({ date, employee_id: String(selectedEmployeeId) });
    api<any>(`/api/closings/totals?${qs}`)
      .then((d: any) => {
        if (cancelled) return;
        setTotals(d.totals);
        setTotalsKey(`${d.employee_id}:${d.date}`);
      })
      .catch((e: any) => {
        if (cancelled) return;
        setTotals(null);
        setTotalsKey('');
        setTotalErr(e.message || 'Could not load totals for this date.');
      })
      .finally(() => { if (!cancelled) setLoadingTotals(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, selectedEmployeeId, totalsNonce]);

  const canSubmit = dateValid && !!selectedEmployeeId && totalsCurrent && !loadingTotals && !totalErr
    && (canApprove || actualCash !== '');

  function pickDate(value: string) {
    setDateTouched(true);
    setDate(value);
    setPage(1);
    // Only the re-run context is dropped; the chosen employee is preserved.
    setReRunning(null);
  }

  function rerunClosing(c: any) {
    setReRunning(c);
    setTotalsEmployeeId(c.employee_id ?? null);
    setDateTouched(true);
    setDate(c.closing_date);
    setPage(1);
    setActualCash(c.actual_cash !== null && c.actual_cash !== undefined ? String(c.actual_cash) : '');
    setNotes(c.notes || '');
    setError2('');
    setSubmitOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    setError2('');
    try {
      const body: any = { closing_date: date, actual_cash: actualCash !== '' ? Number(actualCash) : undefined, notes: notes || undefined };
      if (selectedEmployeeId) body.employee_id = selectedEmployeeId;
      await api('/api/closings/submit', { method: 'POST', body });
      setSubmitOpen(false);
      setReRunning(null);
      if (!canApprove) setTotalsEmployeeId(null);
      setActualCash('');
      setNotes('');
      setPage(1);
      reload();
    } catch (err: any) {
      setError2(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function review(decision: string, override = false) {
    if (override && !reviewNote.trim()) {
      setError2('Give a reason for changing an approved closing.');
      return;
    }
    setBusy(true);
    setError2('');
    try {
      await api(`/api/closings/${reviewing.id}/review`, { method: 'POST', body: { decision, note: reviewNote || undefined } });
      setReviewing(null);
      setReviewNote('');
      setOverrideMode(false);
      reload();
    } catch (err: any) {
      setError2(err.message);
    } finally {
      setBusy(false);
    }
  }

  function openReview(c: any, override = false) {
    // An admin fixing an approval starts with an empty reason: the old review
    // note belongs to the original decision, not to this correction.
    setReviewNote(override ? '' : (c.review_note || ''));
    setOverrideMode(override);
    setOverrideDecision('correction_requested');
    setError2('');
    setReviewing(c);
  }

  return (
    <div className="d-flex flex-column gap-3">
      <PageHeader
        eyebrow="Finance"
        title="Daily closings"
        subtitle="Review expected cash, submit counted cash, and resolve discrepancies with a clear audit trail."
        actions={
          <button className="btn btn-primary btn-sm"
            onClick={() => { setReRunning(null); setActualCash(''); setNotes(''); setError2(''); setSubmitOpen(true); }}>
            <i className="bi bi-cash-coin me-1" aria-hidden="true" /> Run closing
          </button>
        }
      />

      <div className="row g-3">
        <div className="col-xl-5">
          <div className="panel h-100">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Expected totals</h2>
                <p className="panel-subtitle">
                  {dateValid ? fmtDate(date) : 'Select a date'}{selectedEmployeeName ? ` · ${selectedEmployeeName}` : ''}
                </p>
              </div>
            </div>
            <div className="panel-body">
              {canApprove && (
                <div className="mb-3">
                  <label className="form-label" htmlFor="closingEmployee">Employee</label>
                  <select id="closingEmployee" className="form-select form-select-sm"
                    value={selectedEmployeeId ?? ''}
                    onChange={(e) => {
                      setTotalsEmployeeId(e.target.value ? Number(e.target.value) : null);
                      setPage(1);
                    }}>
                    <option value="">Select an employee…</option>
                    {employeeOptions.map((emp: any) => (
                      <option key={emp.id} value={emp.id}>{emp.full_name || emp.email || `#${emp.id}`}</option>
                    ))}
                  </select>
                  {employees.loading && <div className="small text-muted mt-1">Loading employees…</div>}
                </div>
              )}
              <div className="d-flex gap-2 mb-3">
                <input type="date" className="form-control form-control-sm" value={date}
                  aria-label="Closing date" onChange={(e) => pickDate(e.target.value)} />
                <button className="btn btn-sm btn-outline-primary"
                  onClick={() => setTotalsNonce((n) => n + 1)}
                  disabled={!dateValid || !selectedEmployeeId || loadingTotals}>
                  {loadingTotals ? 'Loading…' : 'Load'}
                </button>
              </div>
              {!dateValid && (
                <div className="alert alert-warning py-2 small mb-0">
                  {date ? 'Date must be in YYYY-MM-DD format.' : 'Pick a date to load its totals.'}
                </div>
              )}
              {totalErr && <div className="alert alert-danger py-2 small mb-0">{totalErr}</div>}
              {loadingTotals && !totalsCurrent && <Loading />}
              {totalsCurrent && (
                <>
                  {Number(totals.transaction_count) === 0 && (
                    <p className="small text-muted mb-2">No completed transactions recorded for this employee on this date.</p>
                  )}
                  <div className="table-responsive">
                    <table className="table table-sm mb-0">
                      <tbody>
                        <tr><td className="text-muted">Transactions</td><td className="text-end fw-semibold">{totals.transaction_count}</td></tr>
                        <tr><td className="text-muted">Customer payments</td><td className="text-end money">{fmtMoney(totals.customer_payments)}</td></tr>
                        <tr><td className="text-muted">Cash payments</td><td className="text-end money">{fmtMoney(totals.cash_payments)}</td></tr>
                        <tr><td className="text-muted">Non-cash payments</td><td className="text-end money">{fmtMoney(totals.non_cash_payments)}</td></tr>
                        <tr><td className="text-muted">Service costs</td><td className="text-end money text-danger">− {fmtMoney(totals.service_costs)}</td></tr>
                        <tr><td className="text-muted">Gross profit</td><td className="text-end money">{fmtMoney(totals.gross_profit)}</td></tr>
                        <tr><td className="text-muted">Total commission</td><td className="text-end money text-warning">− {fmtMoney(totals.total_commission)}</td></tr>
                        <tr><td className="text-muted">Company profit</td><td className="text-end money fw-semibold text-success">{fmtMoney(totals.company_profit)}</td></tr>
                        <tr className="border-top"><td className="fw-semibold">Expected cash</td><td className="text-end money fw-bold">{fmtMoney(totals.expected_cash)}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="col-xl-7">
          <div className="data-table-wrap h-100">
            <div className="data-table-toolbar">
              <div>
                <div className="panel-title">Closings history</div>
                <div className="panel-subtitle">{showAllDates || !dateValid ? 'All dates' : fmtDate(date)}</div>
              </div>
              <div className="toolbar-group">
                <div className="form-check mb-0">
                  <input className="form-check-input" type="checkbox" id="onlyThisDate"
                    checked={!showAllDates}
                    onChange={(e) => { setShowAllDates(!e.target.checked); setPage(1); }} />
                  <label className="form-check-label small" htmlFor="onlyThisDate">This date only</label>
                </div>
                <select className="form-select form-select-sm" style={{ width: 180 }} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by status">
                  <option value="">All statuses</option>
                  <option value="submitted">Submitted</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="correction_requested">Correction requested</option>
                </select>
              </div>
            </div>
            {error && <div className="p-3"><ErrorAlert message={error} onRetry={reload} /></div>}
            {loading && <div className="p-3"><Loading /></div>}
            {!loading && !error && items.length === 0 && (
              <div className="p-3"><EmptyState message={showAllDates || !dateValid ? 'No closings yet' : `No closings for ${fmtDate(date)}`} icon="bi-calendar-check" /></div>
            )}
            {!loading && !error && items.length > 0 && (
              <>
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Date / Employee</th>
                        <th className="text-end">Expected</th>
                        <th className="text-end">Actual</th>
                        <th className="text-end">Difference</th>
                        <th>Status</th>
                        <th className="text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((c: any) => (
                        <tr key={c.id}>
                          <td>
                            <div className="fw-semibold">{fmtDate(c.closing_date)}</div>
                            <div className="small text-muted">{c.employee_name} · {c.transaction_count} txns</div>
                          </td>
                          <td className="text-end money">{fmtMoney(c.expected_cash)}</td>
                          <td className="text-end money">{fmtMoney(c.actual_cash)}</td>
                          <td className={`text-end money fw-semibold ${Number(c.cash_difference) < 0 ? 'text-danger' : Number(c.cash_difference) > 0 ? 'text-warning' : 'text-success'}`}>{fmtMoney(c.cash_difference)}</td>
                          <td><div className="d-flex gap-1 flex-wrap"><Badge status={c.reconciliation_class} /><Badge status={c.status} /></div></td>
                          <td>
                            <div className="d-flex justify-content-end gap-1 flex-wrap">
                              {c.status === 'approved' && isAdmin && <button className="btn btn-sm btn-outline-danger" onClick={() => openReview(c, true)}>Fix status</button>}
                              {c.status === 'submitted' && canApprove && <button className="btn btn-sm btn-outline-primary" onClick={() => openReview(c)}>Review</button>}
                              {c.status === 'correction_requested' && <button className="btn btn-sm btn-outline-warning" onClick={() => rerunClosing(c)}>Re-run</button>}
                              {c.status === 'rejected' && (<><button className="btn btn-sm btn-outline-warning" onClick={() => rerunClosing(c)}>Re-run</button><button className="btn btn-sm btn-outline-secondary" onClick={() => openReview(c)}>View</button></>)}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-3 border-top"><Pagination page={page} pages={data?.pages || 1} total={data?.total} onPage={setPage} /></div>
              </>
            )}
          </div>
        </div>
      </div>

      <Modal show={submitOpen} title={`Submit closing for ${fmtDate(date)}`}
        onClose={() => { setReRunning(null); setError2(''); setSubmitOpen(false); }}
        footer={
          <>
            <button className="btn btn-outline-secondary"
              onClick={() => { setReRunning(null); setError2(''); setSubmitOpen(false); }}>Close</button>
            <button className="btn btn-primary" onClick={submit} disabled={busy || !canSubmit}>
              {busy ? 'Submitting…' : loadingTotals ? 'Loading totals…' : 'Submit closing'}
            </button>
          </>
        }
      >
        {error2 && <div className="alert alert-danger py-2 small">{error2}</div>}
        {totalErr && <div className="alert alert-danger py-2 small">{totalErr}</div>}
        {!dateValid && (
          <div className="alert alert-warning py-2 small">
            Pick a valid date first — a closing cannot be submitted without one.
          </div>
        )}
        {reRunning ? (
          <div className="alert alert-warning py-2 small">
            Re-submitting a closing that was {reRunning.status === 'rejected' ? 'rejected' : 'returned for correction'}. After re-running, it moves back to <strong>submitted</strong> for manager review. Edit the underlying transactions first, then re-run.
          </div>
        ) : (
          <p className="small text-muted">Enter the actual cash counted at the end of the day. The system compares it with the expected cash above to detect shortages or overages.</p>
        )}
        {totalsCurrent && (
          <div className="alert alert-info small py-2">
            Expected cash from records for {fmtDate(date)}: <strong>{fmtMoney(totals.expected_cash)}</strong>
          </div>
        )}
        <Field label="Actual cash counted" required={!canApprove}>
          <TextInput type="number" step="0.01" min="0" value={actualCash}
            onChange={(e) => setActualCash(e.target.value)} required={!canApprove} />
        </Field>
        <Field label="Notes">
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </Modal>

      <Modal show={!!reviewing}
        title={`${overrideMode ? 'Correct approved closing' : 'Review closing'} — ${reviewing ? fmtDate(reviewing.closing_date) : ''}`}
        onClose={() => { setReviewing(null); setOverrideMode(false); setError2(''); }}
        footer={
          <>
            <button className="btn btn-outline-secondary"
              onClick={() => { setReviewing(null); setOverrideMode(false); }}>Close</button>
            {overrideMode && isAdmin ? (
              <button className="btn btn-danger" disabled={busy || !reviewNote.trim()}
                onClick={() => review(overrideDecision, true)}>Change status</button>
            ) : canApprove && (
              <>
                <button className="btn btn-outline-warning" disabled={busy} onClick={() => review('correction_requested')}>Request correction</button>
                <button className="btn btn-outline-danger" disabled={busy} onClick={() => review('rejected')}>Reject</button>
                <button className="btn btn-success" disabled={busy} onClick={() => review('approved')}>Approve & lock</button>
              </>
            )}
          </>
        }
      >
        {error2 && <div className="alert alert-danger py-2 small">{error2}</div>}
        {overrideMode && (
          <div className="alert alert-warning py-2 small">
            This closing was approved by mistake. Changing its status unlocks it so the agent can
            correct the day and re-submit. The reason below is stored in the audit log.
          </div>
        )}
        <div className="alert alert-secondary small">
          Expected cash <strong>{fmtMoney(reviewing?.expected_cash)}</strong> vs actual <strong>{fmtMoney(reviewing?.actual_cash)}</strong> — difference <strong>{fmtMoney(reviewing?.cash_difference)}</strong>. Submitter note: {reviewing?.notes || '—'}
        </div>
        {overrideMode && isAdmin && (
          <Field label="New status" required>
            <select className="form-select" value={overrideDecision}
              onChange={(e) => setOverrideDecision(e.target.value)}>
              <option value="correction_requested">Correction requested (reopen for edits)</option>
              <option value="rejected">Rejected</option>
              <option value="submitted">Submitted (back to review queue)</option>
            </select>
          </Field>
        )}
        <Field label={overrideMode ? 'Reason for change' : 'Review note'} required={overrideMode}>
          <TextArea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} required={overrideMode} />
        </Field>
      </Modal>
    </div>
  );
}
