'use client';

import { useState } from 'react';
import { useFetch, todayIso, yearAgoIso } from '@/lib/use-fetch';
import { api, fmtMoney, fmtDate } from '@/lib/api';
import { PageHeader, Loading, ErrorAlert, EmptyState, Pagination, Badge, Modal } from '@/components/ui';
import { Field, TextInput, SelectInput, TextArea, DateRange } from '@/components/form';

export default function ExpensesPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [start, setStart] = useState(yearAgoIso());
  const [end, setEnd] = useState(todayIso());
  const { data, error, loading, reload } = useFetch('/api/expenses', [page, status, start, end], { page, per_page: 20, status: status || undefined, start, end });
  const [open, setOpen] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [categories] = useState(['internet', 'transport', 'supplies', 'equipment', 'rent', 'utilities', 'office', 'marketing', 'maintenance', 'other']);
  const [form, setForm] = useState<any>({ amount: '', category: 'supplies', description: '', expense_date: todayIso(), payment_method_id: '', notes: '', receipt: null });
  const [busy, setBusy] = useState(false);
  const [error2, setError2] = useState('');
  const [reviewing, setReviewing] = useState<any | null>(null);

  const items = data?.items || [];

  async function openCreate() {
    setOpen(true);
    setError2('');
    const d: any = await api('/api/services/payment-methods').catch(() => ({ payment_methods: [] }));
    setPayments(d.payment_methods || []);
    setForm({ amount: '', category: 'supplies', description: '', expense_date: todayIso(), payment_method_id: '', notes: '', receipt: null });
  }

  function set<K extends keyof typeof form>(key: K, value: any) { setForm((f) => ({ ...f, [key]: value })); }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError2('');
    try {
      const fd = new FormData();
      fd.append('amount', String(form.amount));
      fd.append('category', form.category);
      fd.append('description', form.description);
      fd.append('expense_date', form.expense_date);
      if (form.payment_method_id) fd.append('payment_method_id', String(form.payment_method_id));
      if (form.notes) fd.append('notes', form.notes);
      if (form.receipt) fd.append('receipt', form.receipt);
      await api('/api/expenses', { method: 'POST', formData: fd });
      setOpen(false);
      reload();
    } catch (err: any) {
      setError2(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function approve(decision: string) {
    setBusy(true);
    setError2('');
    try {
      await api(`/api/expenses/${reviewing.id}/approve`, { method: 'POST', body: { decision } });
      setReviewing(null);
      reload();
    } catch (err: any) {
      setError2(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Expenses" subtitle="Business expenses and approvals"
        actions={<button className="btn btn-primary" onClick={openCreate}><i className="bi bi-plus-circle me-1" /> New expense</button>} />

      <div className="card mb-3">
        <div className="card-body d-flex flex-wrap gap-2 align-items-center">
          <DateRange start={start} end={end} onStart={(v) => { setStart(v); setPage(1); }} onEnd={(v) => { setEnd(v); setPage(1); }} />
          <select className="form-select form-select-sm" style={{ width: 180 }} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="paid">Paid</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={reload} />}
      {loading && <Loading />}
      {!loading && !error && items.length === 0 && <EmptyState message="No expenses found" />}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="card">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr><th>Date</th><th>Category</th><th>Description</th><th>Submitted by</th><th>Pay method</th><th className="text-end">Amount</th><th>Status</th><th /></tr>
                </thead>
                <tbody>
                  {items.map((x: any) => (
                    <tr key={x.id}>
                      <td>{fmtDate(x.expense_date)}</td>
                      <td className="text-uppercase small fw-semibold">{x.category}</td>
                      <td>{x.description}</td>
                      <td>{x.submitted_by_name || '—'}</td>
                      <td>{x.payment_method || '—'}</td>
                      <td className="text-end money fw-semibold">{fmtMoney(x.amount)}</td>
                      <td><Badge status={x.status} /></td>
                      <td className="text-end">
                        {x.status === 'pending' && (
                          <button className="btn btn-sm btn-outline-primary" onClick={() => setReviewing(x)}>Approve / reject</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination page={page} pages={data?.pages || 1} total={data?.total} onPage={setPage} />
        </>
      )}

      <Modal show={open} title="Record expense" onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Submit'}</button>
          </>
        }
      >
        {error2 && <div className="alert alert-danger py-2 small">{error2}</div>}
        <form onSubmit={save}>
          <div className="row">
            <div className="col-md-6">
              <Field label="Amount (RWF)" required>
                <TextInput type="number" step="0.01" min="0" value={form.amount} onChange={(e) => set('amount', e.target.value)} required />
              </Field>
            </div>
            <div className="col-md-6">
              <Field label="Category" required>
                <SelectInput value={form.category} onChange={(e) => set('category', e.target.value)} required>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </SelectInput>
              </Field>
            </div>
          </div>
          <Field label="Description" required><TextInput value={form.description} onChange={(e) => set('description', e.target.value)} required /></Field>
          <div className="row">
            <div className="col-md-6">
              <Field label="Expense date"><TextInput type="date" value={form.expense_date} onChange={(e) => set('expense_date', e.target.value)} /></Field>
            </div>
            <div className="col-md-6">
              <Field label="Payment method">
                <SelectInput value={form.payment_method_id} onChange={(e) => set('payment_method_id', e.target.value)}>
                  <option value="">Default</option>
                  {payments.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </SelectInput>
              </Field>
            </div>
          </div>
          <Field label="Receipt (image or PDF)">
            <input type="file" className="form-control" accept="image/*,.pdf" onChange={(e) => set('receipt', e.target.files?.[0] || null)} />
          </Field>
          <Field label="Notes"><TextArea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} /></Field>
        </form>
      </Modal>

      <Modal show={!!reviewing} title={`Review expense — ${fmtMoney(reviewing?.amount)}`} onClose={() => setReviewing(null)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setReviewing(null)}>Close</button>
            <button className="btn btn-outline-danger" disabled={busy} onClick={() => approve('rejected')}>Reject</button>
            <button className="btn btn-success" disabled={busy} onClick={() => approve('approved')}>Approve</button>
            <button className="btn btn-primary" disabled={busy} onClick={() => approve('paid')}>Approve & mark paid</button>
          </>
        }
      >
        <div className="alert alert-secondary small">
          <strong>{reviewing?.category?.toUpperCase()}</strong> — {reviewing?.description}<br />
          Submitted by {reviewing?.submitted_by_name || '—'} on {fmtDate(reviewing?.created_at)}<br />
          Note: {reviewing?.notes || '—'}
        </div>
        {reviewing?.receipt_path && (
          <a href={`/uploads/${reviewing.receipt_path.split('/').pop()}`} target="_blank" rel="noreferrer" className="small"><i className="bi bi-paperclip me-1" />View receipt</a>
        )}
      </Modal>
    </div>
  );
}