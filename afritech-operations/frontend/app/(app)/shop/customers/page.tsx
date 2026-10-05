'use client';

import { useState } from 'react';
import { useFetch } from '@/lib/use-fetch';
import { api, can, fmtMoney, fmtDate } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { P } from '@/lib/permissions';
import { PageHeader, Loading, ErrorAlert, EmptyState, Pagination, Modal } from '@/components/ui';
import { Field, TextInput, SelectInput, TextArea } from '@/components/form';

const emptyForm = {
  full_name: '', phone: '', email: '', customer_type: 'individual',
  address: '', tax_number: '', notes: '',
};

export default function ShopCustomersPage() {
  const { user } = useAuth();
  const canManage = can(user, P.shopCustomersManage);

  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const { data, error, loading, reload } = useFetch('/api/shop/customers', [page, q], { page, per_page: 15, q: q || undefined });
  const items = data?.items || [];

  // Spend figures are stripped from the payload without financial permission.
  const showPurchases = items.some((c: any) => c.total_purchases !== undefined);
  const showLastPurchase = items.some((c: any) => c.last_purchase_at !== undefined);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ ...emptyForm });
  const [busy, setBusy] = useState(false);
  const [error2, setError2] = useState('');

  function set<K extends keyof typeof form>(key: K, value: any) { setForm((f) => ({ ...f, [key]: value })); }

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm });
    setError2('');
    setOpen(true);
  }

  function openEdit(customer: any) {
    setEditing(customer);
    setForm({
      full_name: customer.full_name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      customer_type: customer.customer_type || 'individual',
      address: customer.address || '',
      tax_number: customer.tax_number || '',
      notes: customer.notes || '',
    });
    setError2('');
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError2('');
    try {
      const body = {
        full_name: form.full_name,
        phone: form.phone || null,
        email: form.email || null,
        customer_type: form.customer_type || 'individual',
        address: form.address || null,
        tax_number: form.tax_number || null,
        notes: form.notes || null,
      };
      if (editing) {
        await api(`/api/shop/customers/${editing.id}`, { method: 'PATCH', body });
      } else {
        await api('/api/shop/customers', { method: 'POST', body });
      }
      setOpen(false);
      reload();
    } catch (err: any) {
      setError2(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Customers" subtitle="Customer directory, loyalty and purchase history"
        actions={canManage && <button className="btn btn-primary" onClick={openCreate}><i className="bi bi-plus-circle me-1" /> New customer</button>} />

      <div className="card mb-3">
        <div className="card-body py-2 d-flex align-items-center">
          <i className="bi bi-search text-muted me-2" />
          <input className="form-control form-control-sm border-0 shadow-none" placeholder="Search name, phone, email or customer number…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={reload} />}
      {loading && <Loading />}
      {!loading && !error && items.length === 0 && <EmptyState message="No customers found" />}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="card">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr>
                    <th>Customer #</th><th>Name</th><th>Type</th><th>Phone</th><th>Email</th>
                    <th className="text-end">Loyalty points</th>
                    {showPurchases && <th className="text-end">Total purchases</th>}
                    {showLastPurchase && <th>Last purchase</th>}
                    {canManage && <th />}
                  </tr>
                </thead>
                <tbody>
                  {items.map((c: any) => (
                    <tr key={c.id}>
                      <td>{c.customer_number || '—'}</td>
                      <td className="fw-semibold">{c.full_name}</td>
                      <td className="text-capitalize">{c.customer_type || '—'}</td>
                      <td>{c.phone || '—'}</td>
                      <td>{c.email || '—'}</td>
                      <td className="text-end">{c.loyalty_points ?? 0}</td>
                      {showPurchases && <td className="text-end money fw-semibold">{fmtMoney(c.total_purchases)}</td>}
                      {showLastPurchase && <td>{fmtDate(c.last_purchase_at)}</td>}
                      {canManage && (
                        <td className="text-end">
                          <button className="btn btn-sm btn-outline-secondary" onClick={() => openEdit(c)}><i className="bi bi-pencil" /></button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination page={page} pages={data?.pages || 1} total={data?.total} onPage={setPage} />
        </>
      )}

      <Modal show={open} title={editing ? 'Edit customer' : 'New customer'} onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        <form onSubmit={save}>
          {error2 && <div className="alert alert-danger py-2 small">{error2}</div>}
          <Field label="Full name" required><TextInput value={form.full_name} onChange={(e) => set('full_name', e.target.value)} required /></Field>
          <div className="row">
            <div className="col-md-6"><Field label="Phone"><TextInput value={form.phone} onChange={(e) => set('phone', e.target.value)} /></Field></div>
            <div className="col-md-6"><Field label="Email"><TextInput type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></Field></div>
          </div>
          <div className="row">
            <div className="col-md-6">
              <Field label="Customer type">
                <SelectInput value={form.customer_type} onChange={(e) => set('customer_type', e.target.value)}>
                  <option value="individual">Individual</option>
                  <option value="business">Business</option>
                </SelectInput>
              </Field>
            </div>
            <div className="col-md-6"><Field label="Tax number"><TextInput value={form.tax_number} onChange={(e) => set('tax_number', e.target.value)} /></Field></div>
          </div>
          <Field label="Address"><TextInput value={form.address} onChange={(e) => set('address', e.target.value)} /></Field>
          <Field label="Notes"><TextArea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} /></Field>
        </form>
      </Modal>
    </div>
  );
}
