'use client';

import { useEffect, useState } from 'react';
import { useFetch, todayIso } from '@/lib/use-fetch';
import { api, fmtMoney, fmtDate, can } from '@/lib/api';
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
  const [reRunning, setReRunning] = useState<any | null>(null);
  const [error2, setError2] = useState('');

  const canApprove = can(user, 'closings.approve');
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

  async function review(decision: string) {
    setBusy(true);
    setError2('');
    try {
      await api(`/api/closings/${reviewing.id}/review`, { method: 'POST', body: { decision, note: reviewNote || undefined } });
      setReviewing(null);
      setReviewNote('');
      reload();
    } catch (err: any) {
      setError2(err.message);
    } finally {
      setBusy(false);
    }
  }

  function openReview(c: any) {
    setReviewNote(c.review_note || '');
    setError2('');
    setReviewing(c);
  }

  return (
    <div>
      <PageHeader title="Daily Closing" subtitle="End-of-day cash reconciliation and approval"
        actions={
          <button className="btn btn-primary"
            onClick={() => { setReRunning(null); setActualCash(''); setNotes(''); setError2(''); setSubmitOpen(true); }}>
            <i className="bi bi-cash-coin me-1" /> Run closing
          </button>
        } />

      <div className="row g-4">
        <div className="col-lg-5">
          <div className="card mb-3">
            <div className="card-body">
              <h6 className="card-title fw-semibold">
                Expected totals for {dateValid ? fmtDate(date) : '—'}
                {selectedEmployeeName && (
                  <span className="text-muted fw-normal small"> · {selectedEmployeeName}</span>
                )}
              </h6>
              {canApprove && (
                <div className="mb-2">
                  <label className="form-label small text-muted mb-1" htmlFor="closingEmployee">Employee</label>
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
              <div className="input-group mb-2">
                <input type="date" className="form-control form-control-sm" value={date}
                  aria-label="Closing date" onChange={(e) => pickDate(e.target.value)} />
                <button className="btn btn-sm btn-outline-primary"
                  onClick={() => setTotalsNonce((n) => n + 1)}
                  disabled={!dateValid || !selectedEmployeeId || loadingTotals}>
                  {loadingTotals ? 'Loading…' : 'Load'}
                </button>
              </div>
              {!dateValid && (
                <div className="alert alert-warning py-2 small mb-2">
                  {date ? 'Date must be in YYYY-MM-DD format.' : 'Pick a date to load its totals.'}
                </div>
              )}
              {totalErr && <div className="alert alert-danger py-2 small">{totalErr}</div>}
              {loadingTotals && !totalsCurrent && <Loading />}
              {totalsCurrent && (
                <>
                  {Number(totals.transaction_count) === 0 && (
                    <p className="small text-muted mb-2">
                      No completed transactions recorded for this employee on this date.
                    </p>
                  )}
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
                      <tr className="border-top">
                        <td className="fw-semibold">Expected cash</td>
                        <td className="text-end money fw-bold">{fmtMoney(totals.expected_cash)}</td>
                      </tr>
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-7">
          <div className="card mb-3">
            <div className="card-body">
              <div className="d-flex justify-content-between flex-wrap gap-2 mb-2">
                <h6 className="card-title fw-semibold mb-0">
                  Closings history
                  <span className="text-muted fw-normal small ms-2">
                    {showAllDates || !dateValid ? 'All dates' : fmtDate(date)}
                  </span>
                </h6>
                <div className="d-flex align-items-center gap-2">
                  <div className="form-check mb-0">
                    <input className="form-check-input" type="checkbox" id="onlyThisDate"
                      checked={!showAllDates}
                      onChange={(e) => { setShowAllDates(!e.target.checked); setPage(1); }} />
                    <label className="form-check-label small" htmlFor="onlyThisDate">This date only</label>
                  </div>
                  <select className="form-select form-select-sm" style={{ width: 180 }} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                    <option value="">All statuses</option>
                    <option value="submitted">Submitted</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="correction_requested">Correction requested</option>
                  </select>
                </div>
              </div>
              {error && <ErrorAlert message={error} onRetry={reload} />}
              {loading && <Loading />}
              {!loading && !error && items.length === 0 && (
                <EmptyState message={showAllDates || !dateValid ? 'No closings yet' : `No closings for ${fmtDate(date)}`} />
              )}
              {items.map((c: any) => (
                <div key={c.id} className="d-flex justify-content-between align-items-center py-2 border-bottom small">
                  <div>
                    <div className="fw-semibold">{fmtDate(c.closing_date)} · {c.employee_name}</div>
                    <div className="text-muted">{c.transaction_count} txns · cash {fmtMoney(c.cash_payments)} · expected {fmtMoney(c.expected_cash)} · actual {fmtMoney(c.actual_cash)} · diff {fmtMoney(c.cash_difference)}</div>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <Badge status={c.reconciliation_class} />
                    <Badge status={c.status} />
                    {c.status === 'submitted' && canApprove && (
                      <button className="btn btn-sm btn-outline-primary" onClick={() => openReview(c)}>Review</button>
                    )}
                    {c.status === 'correction_requested' && (
                      <button className="btn btn-sm btn-outline-warning" onClick={() => rerunClosing(c)}>
                        <i className="bi bi-arrow-repeat me-1" />Re-run
                      </button>
                    )}
                    {c.status === 'rejected' && (
                      <>
                        <button className="btn btn-sm btn-outline-warning" onClick={() => rerunClosing(c)}>
                          <i className="bi bi-arrow-repeat me-1" />Re-run
                        </button>
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => openReview(c)}>View</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              <Pagination page={page} pages={data?.pages || 1} total={data?.total} onPage={setPage} />
            </div>
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

      <Modal show={!!reviewing} title={`Review closing — ${reviewing ? fmtDate(reviewing.closing_date) : ''}`}
        onClose={() => { setReviewing(null); setError2(''); }}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setReviewing(null)}>Close</button>
            {canApprove && (
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
        <div className="alert alert-secondary small">
          Expected cash <strong>{fmtMoney(reviewing?.expected_cash)}</strong> vs actual <strong>{fmtMoney(reviewing?.actual_cash)}</strong> — difference <strong>{fmtMoney(reviewing?.cash_difference)}</strong>. Submitter note: {reviewing?.notes || '—'}
        </div>
        <Field label="Review note">
          <TextArea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} />
        </Field>
      </Modal>
    </div>
  );
}