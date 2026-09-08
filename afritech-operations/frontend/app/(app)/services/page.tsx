'use client';

import { useState } from 'react';
import { useFetch } from '@/lib/use-fetch';
import { api, fmtMoney } from '@/lib/api';
import { PageHeader, Loading, ErrorAlert, EmptyState, Pagination, Modal, Badge, ConfirmDialog } from '@/components/ui';
import { Field, TextInput, SelectInput, TextArea } from '@/components/form';

export default function ServicesPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const { data, error, loading, reload } = useFetch('/api/services', [page, q], { page, per_page: 15, search: q || undefined });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [cats, setCats] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ name: '', code: '', description: '', official_cost: '', customer_price: '', commission_rate: '', category_id: '', is_active: true });
  const [busy, setBusy] = useState(false);
  const [error2, setError2] = useState('');
  const [deact, setDeact] = useState<any | null>(null);

  const items = data?.items || [];

  async function openCreate() {
    setEditing(null);
    setForm({ name: '', code: '', description: '', official_cost: '', customer_price: '', commission_rate: '', category_id: '', is_active: true });
    try {
      const d: any = await api('/api/services/categories/list');
      setCats(d.categories || []);
    } catch { /* ignore */ }
    setError2('');
    setOpen(true);
  }

  async function openEdit(svc: any) {
    setEditing(svc);
    setForm({
      name: svc.name, code: svc.code, description: svc.description || '',
      official_cost: svc.official_cost, customer_price: svc.customer_price,
      commission_rate: svc.commission_rate != null ? svc.commission_rate * 100 : '',
      category_id: svc.category_id || '', is_active: svc.is_active,
    });
    const d: any = await api('/api/services/categories/list').catch(() => ({ categories: [] }));
    setCats(d.categories || []);
    setError2('');
    setOpen(true);
  }

  function set<K extends keyof typeof form>(key: K, value: any) { setForm((f) => ({ ...f, [key]: value })); }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError2('');
    try {
      const body = {
        name: form.name,
        code: form.code || undefined,
        description: form.description || undefined,
        official_cost: form.official_cost !== '' ? Number(form.official_cost) : undefined,
        customer_price: form.customer_price !== '' ? Number(form.customer_price) : undefined,
        commission_rate: form.commission_rate !== '' ? Number(form.commission_rate) / 100 : undefined,
        category_id: form.category_id ? Number(form.category_id) : undefined,
        is_active: form.is_active,
      };
      if (editing) {
        await api(`/api/services/${editing.id}`, { method: 'PUT', body });
      } else {
        await api('/api/services', { method: 'POST', body });
      }
      setOpen(false);
      reload();
    } catch (err: any) {
      setError2(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(svc: any) {
    setBusy(true);
    try {
      await api(`/api/services/${svc.id}/deactivate`, { method: 'POST' });
      setDeact(null);
      reload();
    } catch (err: any) {
      setError2(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function reactivate(svc: any) {
    await api(`/api/services/${svc.id}/reactivate`, { method: 'POST' });
    reload();
  }

  return (
    <div>
      <PageHeader title="Services" subtitle="Service catalogue, pricing and commission rates"
        actions={<button className="btn btn-primary" onClick={openCreate}><i className="bi bi-plus-circle me-1" /> New service</button>} />

      <div className="card mb-3">
        <div className="card-body py-2 d-flex align-items-center">
          <i className="bi bi-search text-muted me-2" />
          <input className="form-control form-control-sm border-0 shadow-none" placeholder="Search services…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={reload} />}
      {loading && <Loading />}
      {!loading && !error && items.length === 0 && <EmptyState message="No services found" />}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="card">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr>
                    <th>Service</th><th>Category</th><th className="text-end">Official cost</th>
                    <th className="text-end">Customer price</th><th className="text-end">Commission</th><th>Status</th><th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((s: any) => (
                    <tr key={s.id}>
                      <td><div className="fw-semibold">{s.name}</div><div className="small text-muted">{s.code}</div></td>
                      <td>{s.category || '—'}</td>
                      <td className="text-end money">{fmtMoney(s.official_cost)}</td>
                      <td className="text-end money">{fmtMoney(s.customer_price)}</td>
                      <td className="text-end money text-warning">{s.commission_rate != null ? `${Math.round(s.commission_rate * 100)}%` : 'Default'}</td>
                      <td><Badge status={s.is_active ? 'active' : 'inactive'} /></td>
                      <td className="text-end">
                        <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => openEdit(s)}><i className="bi bi-pencil" /></button>
                        {s.is_active
                          ? <button className="btn btn-sm btn-outline-danger" onClick={() => setDeact(s)}><i className="bi bi-x-circle" /></button>
                          : <button className="btn btn-sm btn-outline-success" onClick={() => reactivate(s)}><i className="bi bi-check2-circle" /></button>}
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

      <Modal show={open} title={editing ? 'Edit service' : 'New service'} onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        {error2 && <div className="alert alert-danger py-2 small">{error2}</div>}
        <form onSubmit={save}>
          <Field label="Name" required><TextInput value={form.name} onChange={(e) => set('name', e.target.value)} required /></Field>
          <div className="row">
            <div className="col-md-6"><Field label="Code"><TextInput value={form.code} onChange={(e) => set('code', e.target.value)} /></Field></div>
            <div className="col-md-6">
              <Field label="Category">
                <SelectInput value={form.category_id} onChange={(e) => set('category_id', e.target.value)}>
                  <option value="">None</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </SelectInput>
              </Field>
            </div>
          </div>
          <div className="row">
            <div className="col-md-6"><Field label="Official cost"><TextInput type="number" step="0.01" min="0" value={form.official_cost} onChange={(e) => set('official_cost', e.target.value)} /></Field></div>
            <div className="col-md-6"><Field label="Customer price" required><TextInput type="number" step="0.01" min="0" value={form.customer_price} onChange={(e) => set('customer_price', e.target.value)} required /></Field></div>
          </div>
          <Field label="Commission rate (%)">
            <TextInput type="number" step="0.5" min="0" max="100" value={form.commission_rate} onChange={(e) => set('commission_rate', e.target.value)} placeholder="Leave blank for default rate" />
          </Field>
          <Field label="Description">
            <TextArea value={form.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
          <div className="form-check form-switch">
            <input className="form-check-input" type="checkbox" id="svcActive" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
            <label className="form-check-label" htmlFor="svcActive">Active</label>
          </div>
        </form>
      </Modal>
      <ConfirmDialog show={!!deact} title="Deactivate service" message={`Deactivate "${deact?.name}"? It will no longer be available for new transactions.`} onConfirm={() => deactivate(deact)} onClose={() => setDeact(null)} />
    </div>
  );
}