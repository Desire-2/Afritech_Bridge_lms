'use client';

import { useState } from 'react';
import { useFetch } from '@/lib/use-fetch';
import { api, fmtDate } from '@/lib/api';
import { PageHeader, Loading, ErrorAlert, EmptyState, Pagination, Modal } from '@/components/ui';
import { Field, TextInput } from '@/components/form';

export default function ClientsPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const { data, error, loading, reload } = useFetch('/api/clients', [page, q], { page, per_page: 20, search: q || undefined });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ first_name: '', last_name: '', phone: '', reference_info: '' });
  const [busy, setBusy] = useState(false);
  const [error2, setError2] = useState('');

  const items = data?.items || [];

  function openCreate() {
    setEditing(null);
    setForm({ first_name: '', last_name: '', phone: '', reference_info: '' });
    setError2('');
    setOpen(true);
  }

  function openEdit(c: any) {
    setEditing(c);
    setForm({ first_name: c.first_name, last_name: c.last_name, phone: c.phone || '', reference_info: c.reference_info || '' });
    setError2('');
    setOpen(true);
  }

  function set<K extends keyof typeof form>(key: K, value: any) { setForm((f) => ({ ...f, [key]: value })); }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError2('');
    try {
      if (editing) await api(`/api/clients/${editing.id}`, { method: 'PUT', body: form });
      else await api('/api/clients', { method: 'POST', body: form });
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
      <PageHeader title="Clients" subtitle="Client directory"
        actions={<button className="btn btn-primary" onClick={openCreate}><i className="bi bi-plus-circle me-1" /> New client</button>} />

      <div className="card mb-3">
        <div className="card-body py-2 d-flex align-items-center">
          <i className="bi bi-search text-muted me-2" />
          <input className="form-control form-control-sm border-0 shadow-none" placeholder="Search name, phone or client number…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={reload} />}
      {loading && <Loading />}
      {!loading && !error && items.length === 0 && <EmptyState message="No clients found" />}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="card">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr><th>Client number</th><th>Name</th><th>Phone</th><th>Reference info</th><th>Registered</th><th /></tr>
                </thead>
                <tbody>
                  {items.map((c: any) => (
                    <tr key={c.id}>
                      <td className="fw-semibold">{c.client_number}</td>
                      <td>{c.full_name}</td>
                      <td>{c.phone || '—'}</td>
                      <td className="text-muted">{c.reference_info || '—'}</td>
                      <td>{fmtDate(c.created_at)}</td>
                      <td className="text-end"><button className="btn btn-sm btn-outline-secondary" onClick={() => openEdit(c)}><i className="bi bi-pencil" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination page={page} pages={data?.pages || 1} total={data?.total} onPage={setPage} />
        </>
      )}

      <Modal show={open} title={editing ? 'Edit client' : 'New client'} onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        {error2 && <div className="alert alert-danger py-2 small">{error2}</div>}
        <form onSubmit={save}>
          <div className="row">
            <div className="col-md-6">
              <Field label="First name" required><TextInput value={form.first_name} onChange={(e) => set('first_name', e.target.value)} required /></Field>
            </div>
            <div className="col-md-6">
              <Field label="Last name" required><TextInput value={form.last_name} onChange={(e) => set('last_name', e.target.value)} required /></Field>
            </div>
          </div>
          <Field label="Phone"><TextInput value={form.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
          <Field label="Reference info"><TextInput value={form.reference_info} onChange={(e) => set('reference_info', e.target.value)} placeholder="e.g. voucher no., referral, notes" /></Field>
        </form>
      </Modal>
    </div>
  );
}