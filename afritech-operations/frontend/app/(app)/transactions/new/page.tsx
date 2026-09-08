'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, fmtMoney } from '@/lib/api';
import { todayIso } from '@/lib/use-fetch';
import { PageHeader, ErrorAlert } from '@/components/ui';
import { Field, TextInput, SelectInput, TextArea } from '@/components/form';

export default function NewTransactionPage() {
  const router = useRouter();
  const [services, setServices] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [clientQuery, setClientQuery] = useState('');
  const [form, setForm] = useState<any>({
    service_id: '',
    client_id: '',
    payment_method_id: '',
    customer_price: '',
    official_cost: '',
    transaction_date: todayIso(),
    status: 'completed',
    reference: '',
    notes: '',
  });
  const [selected, setSelected] = useState<any>(null);
  const [clientSel, setClientSel] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/services?per_page=200&active=true').then((d: any) => setServices(d.items || []));
    api('/api/clients?per_page=20').then((d: any) => setClients(d.items || []));
    api('/api/services/payment-methods').then((d: any) => setPayments(d.payment_methods || []));
  }, []);

  function pickService(id: string) {
    const svc = services.find((s) => String(s.id) === id);
    setSelected(svc || null);
    if (svc) {
      setForm((f: any) => ({ ...f, service_id: id, customer_price: svc.customer_price, official_cost: svc.official_cost }));
    } else {
      setForm((f: any) => ({ ...f, service_id: id }));
    }
  }

  function pickClient(c: any) {
    setClientSel(c);
    setForm((f: any) => ({ ...f, client_id: String(c.id) }));
  }

  function update<K extends keyof typeof form>(key: K, value: any) {
    setForm((f: any) => ({ ...f, [key]: value }));
  }

  async function searchClients(q: string) {
    setClientQuery(q);
    if (!q.trim()) return;
    try {
      const d: any = await api('/api/clients?per_page=10&search=' + encodeURIComponent(q));
      setClients(d.items || []);
    } catch {
      /* ignore */
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const d: any = await api('/api/transactions', {
        method: 'POST',
        body: {
          ...form,
          customer_price: Number(form.customer_price) || 0,
          official_cost: Number(form.official_cost) || null,
        },
      });
      router.push(`/transactions/${d.transaction.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const gross = Number(form.customer_price || 0) - Number(form.official_cost || 0);
  const effRate = selected?.commission_rate;

  return (
    <div className="row">
      <div className="col-lg-8">
        <PageHeader title="New Transaction" subtitle="Record a service transaction — commissions are calculated automatically" />
        {error && <ErrorAlert message={error} />}
        <form onSubmit={submit} className="card">
          <div className="card-body">
            <h6 className="card-title fw-semibold">Transaction details</h6>
            <Field label="Service" required>
              <SelectInput value={form.service_id} onChange={(e) => pickService(e.target.value)} required>
                <option value="">Select service…</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} — {fmtMoney(s.customer_price)}</option>
                ))}
              </SelectInput>
            </Field>

            <Field label="Client" required>
              <input
                className="form-control mb-2"
                placeholder="Search client by name, phone, or client number…"
                value={clientQuery}
                onChange={(e) => searchClients(e.target.value)}
              />
              {clientSel ? (
                <div className="d-flex justify-content-between align-items-center border rounded-3 px-3 py-2">
                  <span>
                    <strong>{clientSel.full_name}</strong> <span className="text-muted small">{clientSel.client_number}</span>
                  </span>
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setClientSel(null); setForm((f: any) => ({ ...f, client_id: '' })); }}>
                    Change
                  </button>
                </div>
              ) : (
                <select className="form-select" value={form.client_id} onChange={(e) => {
                  const c = clients.find((c) => String(c.id) === e.target.value);
                  if (c) pickClient(c);
                }} required>
                  <option value="">Select client…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.full_name} ({c.client_number})</option>
                  ))}
                </select>
              )}
            </Field>

            <div className="row">
              <div className="col-md-6">
                <Field label="Payment method" required>
                  <SelectInput value={form.payment_method_id} onChange={(e) => update('payment_method_id', e.target.value)} required>
                    <option value="">Select…</option>
                    {payments.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </SelectInput>
                </Field>
              </div>
              <div className="col-md-6">
                <Field label="Transaction date">
                  <TextInput type="date" value={form.transaction_date} onChange={(e) => update('transaction_date', e.target.value)} />
                </Field>
              </div>
            </div>

            <hr />
            <h6 className="card-title fw-semibold">Amounts</h6>
            <div className="row">
              <div className="col-md-6">
                <Field label="Customer price (revenue)">
                  <TextInput type="number" step="0.01" min="0" value={form.customer_price} onChange={(e) => update('customer_price', e.target.value)} required />
                </Field>
              </div>
              <div className="col-md-6">
                <Field label="Official cost">
                  <TextInput type="number" step="0.01" min="0" value={form.official_cost} onChange={(e) => update('official_cost', e.target.value)} />
                </Field>
              </div>
            </div>
            <Field label="Reference">
              <TextInput value={form.reference} onChange={(e) => update('reference', e.target.value)} placeholder="Optional reference (receipt no., phone, note)" />
            </Field>
            <Field label="Notes">
              <TextArea value={form.notes} onChange={(e) => update('notes', e.target.value)} />
            </Field>
            <div className="d-flex gap-2">
              <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Create transaction'}</button>
              <button type="button" className="btn btn-outline-secondary" onClick={() => router.back()}>Cancel</button>
            </div>
          </div>
        </form>
      </div>

      <div className="col-lg-4">
        <div className="card">
          <div className="card-body">
            <h6 className="card-title fw-semibold">Commission preview</h6>
            <div className="d-flex justify-content-between py-1 border-bottom small">
              <span className="text-muted">Revenue</span>
              <span className="money">{fmtMoney(form.customer_price || 0)}</span>
            </div>
            <div className="d-flex justify-content-between py-1 border-bottom small">
              <span className="text-muted">Official cost</span>
              <span className="money">{fmtMoney(form.official_cost || 0)}</span>
            </div>
            <div className="d-flex justify-content-between py-1 border-bottom small">
              <span className="text-muted">Gross profit</span>
              <span className="money fw-semibold">{fmtMoney(gross)}</span>
            </div>
            <div className="d-flex justify-content-between py-1 border-bottom small">
              <span className="text-muted">Commission rate</span>
              <span className="fw-semibold">{effRate != null ? `${Math.round(effRate * 100)}%` : 'Default'}</span>
            </div>
            <div className="d-flex justify-content-between py-1 border-bottom small">
              <span className="text-muted">Commission amount</span>
              <span className="money fw-semibold text-warning">{fmtMoney(gross * (effRate ?? 0))}</span>
            </div>
            <div className="d-flex justify-content-between py-1 small">
              <span className="text-muted">Company profit</span>
              <span className="money fw-semibold text-success">{fmtMoney(gross * (effRate != null ? 1 - effRate : 1))}</span>
            </div>
            {!selected && <div className="alert alert-info small mt-3 mb-0">Pick a service to see the commission preview. If no service-specific rate is set, the default rate applies.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}