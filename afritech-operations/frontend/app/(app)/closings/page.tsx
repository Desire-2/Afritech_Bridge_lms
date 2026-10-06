'use client';

import { useEffect, useState } from 'react';
import { useFetch, todayIso } from '@/lib/use-fetch';
import { api, fmtMoney, fmtDate, getUserCache, can } from '@/lib/api';
import { PageHeader, Loading, ErrorAlert, EmptyState, Pagination, Modal, Badge } from '@/components/ui';
import { Field, TextInput, SelectInput, TextArea } from '@/components/form';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default function ClosingsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [date, setDate] = useState(todayIso());
  const [showAllDates, setShowAllDates] = useState(false);
  const [totalsEmployeeId, setTotalsEmployeeId] = useState<number | null>(null);
  const [totalsNonce, setTotalsNonce] = useState(0);
  const [totals, setTotals] = useState<any | null>(null);
  const [totalsFor, setTotalsFor] = useState('');
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

  const me = getUserCache();
  const canApprove = can(me, 'closings.approve');
  const dateValid = ISO_DATE.test(date);
  const totalsCurrent = totals !== null && totalsFor === date;

  const dateFilter = showAllDates || !dateValid ? {} : { start: date, end: date };
  const { data, error, loading, reload } = useFetch('/api/closings',
    [page, status, date, showAllDates],
    {
      page, per_page: 15,
      status: status || undefined,
      ...dateFilter,
    });
  const items = data?.items || [];

  // Totals always track the selected date (and, while re-running, the employee
  // whose closing is being re-run) — changing the date reloads them.
  useEffect(() => {
    if (!dateValid) {
      setTotals(null);
      setTotalsFor('');
      setLoadingTotals(false);
      setTotalErr(date ? 'Date must be in YYYY-MM-DD format.' : 'Pick a date to load its totals.');
      return;
    }
    let cancelled = false;
    setLoadingTotals(true);
    setTotalErr('');
    const empId = totalsEmployeeId ?? me?.employee_id;
    const qs = new URLSearchParams({ date });
    if (empId) qs.set('employee_id', String(empId));
    api<any>(`/api/closings/totals?${qs}`)
      .then((d: any) => {
        if (cancelled) return;
        setTotals(d.totals);
        setTotalsFor(d.date);
      })
      .catch((e: any) => {
        if (cancelled) return;
        setTotals(null);
        setTotalsFor('');
        setTotalErr(e.message || 'Could not load totals for this date.');
      })
      .finally(() => { if (!cancelled) setLoadingTotals(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, totalsEmployeeId, totalsNonce]);

  const canSubmit = dateValid && totalsCurrent && !loadingTotals && !totalErr
    && (canApprove || actualCash !== '');

  function pickDate(value: string) {
    setDate(value);
    setPage(1);
    // A date change starts a fresh run — drop any re-run pinned to another date.
    setReRunning(null);
    setTotalsEmployeeId(null);
  }

  function rerunClosing(c: any) {
    setReRunning(c);
    setTotalsEmployeeId(c.employee_id ?? null);
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
      if (reRunning) body.employee_id = reRunning.employee_id;
      await api('/api/closings/submit', { method: 'POST', body });
      setSubmitOpen(false);
      setReRunning(null);
      setTotalsEmployeeId(null);
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
            onClick={() => { setReRunning(null); setTotalsEmployeeId(null); setActualCash(''); setNotes(''); setError2(''); setSubmitOpen(true); }}>
            <i className="bi bi-cash-coin me-1" /> Run closing
          </button>
        } />

      <div className="row g-4">
        <div className="col-lg-5">
          <div className="card mb-3">
            <div className="card-body">
              <h6 className="card-title fw-semibold">
                Expected totals for {dateValid ? fmtDate(date) : '—'}
                {reRunning?.employee_name && (
                  <span className="text-muted fw-normal small"> · {reRunning.employee_name}</span>
                )}
              </h6>
              <div className="input-group mb-2">
                <input type="date" className="form-control form-control-sm" value={date}
                  aria-label="Closing date" onChange={(e) => pickDate(e.target.value)} />
                <button className="btn btn-sm btn-outline-primary"
                  onClick={() => setTotalsNonce((n) => n + 1)}
                  disabled={!dateValid || loadingTotals}>
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
                    <p className="small text-muted mb-2">No transactions recorded on this date.</p>
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