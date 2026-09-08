'use client';

import { useState } from 'react';
import { useFetch, todayIso } from '@/lib/use-fetch';
import { api, fmtMoney, fmtDate, getUserCache } from '@/lib/api';
import { PageHeader, Loading, ErrorAlert, EmptyState, Pagination, Modal, Badge, ConfirmDialog } from '@/components/ui';
import { Field, TextInput, SelectInput, TextArea } from '@/components/form';

export default function ClosingsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [date, setDate] = useState(todayIso());
  const { data, error, loading, reload } = useFetch('/api/closings', [page, status], { page, per_page: 15, status: status || undefined });
  const [totals, setTotals] = useState<any | null>(null);
  const [loadingTotals, setLoadingTotals] = useState(false);
  const [totalErr, setTotalErr] = useState('');
  const [submitOpen, setSubmitOpen] = useState(false);
  const [actualCash, setActualCash] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState<any | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [error2, setError2] = useState('');

  const items = data?.items || [];

  async function loadTotals() {
    setLoadingTotals(true);
    setTotalErr('');
    try {
      const me = getUserCache();
      const d: any = await api('/api/closings/totals?date=' + date + (me?.employee_id ? '&employee_id=' + me.employee_id : ''));
      setTotals(d.totals);
    } catch (e: any) {
      setTotalErr(e.message);
    } finally {
      setLoadingTotals(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError2('');
    try {
      const body = { closing_date: date, actual_cash: actualCash !== '' ? Number(actualCash) : undefined, notes: notes || undefined };
      await api('/api/closings/submit', { method: 'POST', body });
      setSubmitOpen(false);
      setActualCash('');
      setNotes('');
      setTotals(null);
      reload();
      await loadTotals();
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

  return (
    <div>
      <PageHeader title="Daily Closing" subtitle="End-of-day cash reconciliation and approval"
        actions={<button className="btn btn-primary" onClick={() => { loadTotals(); setSubmitOpen(true); }}><i className="bi bi-cash-coin me-1" /> Run closing</button>} />

      <div className="row g-4">
        <div className="col-lg-5">
          <div className="card mb-3">
            <div className="card-body">
              <h6 className="card-title fw-semibold">Expected totals for the day</h6>
              <div className="input-group mb-2">
                <input type="date" className="form-control form-control-sm" value={date} onChange={(e) => setDate(e.target.value)} />
                <button className="btn btn-sm btn-outline-primary" onClick={loadTotals}>{loadingTotals ? 'Loading…' : 'Load'}</button>
              </div>
              {totalErr && <div className="alert alert-danger py-2 small">{totalErr}</div>}
              {totals && (
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
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-7">
          <div className="card mb-3">
            <div className="card-body">
              <div className="d-flex justify-content-between mb-2">
                <h6 className="card-title fw-semibold mb-0">Closings history</h6>
                <div>
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
              {!loading && !error && items.length === 0 && <EmptyState message="No closings yet" />}
              {items.map((c: any) => (
                <div key={c.id} className="d-flex justify-content-between align-items-center py-2 border-bottom small">
                  <div>
                    <div className="fw-semibold">{fmtDate(c.closing_date)} · {c.employee_name}</div>
                    <div className="text-muted">{c.transaction_count} txns · cash {fmtMoney(c.cash_payments)} · expected {fmtMoney(c.expected_cash)} · actual {fmtMoney(c.actual_cash)} · diff {fmtMoney(c.cash_difference)}</div>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <Badge status={c.reconciliation_class} />
                    <Badge status={c.status} />
                    {c.status === 'submitted' && (
                      <button className="btn btn-sm btn-outline-primary" onClick={() => setReviewing(c)}>Review</button>
                    )}
                  </div>
                </div>
              ))}
              <Pagination page={page} pages={data?.pages || 1} total={data?.total} onPage={setPage} />
            </div>
          </div>
        </div>
      </div>

      <Modal show={submitOpen} title={`Submit closing for ${fmtDate(date)}`} onClose={() => setSubmitOpen(false)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setSubmitOpen(false)}>Close</button>
            <button className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? 'Submitting…' : 'Submit closing'}</button>
          </>
        }
      >
        {error2 && <div className="alert alert-danger py-2 small">{error2}</div>}
        <p className="small text-muted">Enter the actual cash counted at the end of the day. The system compares it with the expected cash above to detect shortages or overages.</p>
        {totals && (
          <div className="alert alert-info small py-2">
            Expected cash from records: <strong>{fmtMoney(totals.expected_cash)}</strong>
          </div>
        )}
        <Field label="Actual cash counted" required>
          <TextInput type="number" step="0.01" min="0" value={actualCash} onChange={(e) => setActualCash(e.target.value)} required />
        </Field>
        <Field label="Notes">
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </Modal>

      <Modal show={!!reviewing} title={`Review closing — ${reviewing ? fmtDate(reviewing.closing_date) : ''}`} onClose={() => setReviewing(null)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setReviewing(null)}>Close</button>
            <button className="btn btn-outline-warning" disabled={busy} onClick={() => review('correction_requested')}>Request correction</button>
            <button className="btn btn-outline-danger" disabled={busy} onClick={() => review('rejected')}>Reject</button>
            <button className="btn btn-success" disabled={busy} onClick={() => review('approved')}>Approve & lock</button>
          </>
        }
      >
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