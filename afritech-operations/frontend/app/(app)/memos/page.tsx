'use client';

import { useState } from 'react';
import { useFetch } from '@/lib/use-fetch';
import { api, can, fmtDate } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  PageHeader, Loading, ErrorAlert, EmptyState, Pagination, Badge, Modal, ConfirmDialog,
} from '@/components/ui';
import { Field, TextInput, SelectInput, TextArea } from '@/components/form';
import { useEmployeeOptions, useOrgOptions, options } from '@/lib/use-options';
import { useQuickCreate, isQuickPatch } from '@/lib/quick-create';

const CATEGORIES = ['office_notice', 'internal_circular', 'policy', 'reminder', 'other'];
const AUDIENCES = [
  { key: 'all', label: 'Whole company' },
  { key: 'department', label: 'One department' },
  { key: 'branch', label: 'One branch' },
  { key: 'custom', label: 'Specific employees' },
];

const EMPTY = {
  title: '', message: '', category: 'office_notice', audience: 'all',
  department_id: '', branch_id: '', recipient_ids: [] as number[], publish: true,
};

export default function MemosPage() {
  const { user } = useAuth();
  const canManage = can(user, 'memos.manage');
  const { employees } = useEmployeeOptions();
  const { departments, branches } = useOrgOptions();

  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [showDrafts, setShowDrafts] = useState(false);
  const { data, error, loading, reload } = useFetch('/api/memos', [page, category, search, showDrafts], {
    page, per_page: 15,
    category: category || undefined,
    search: search || undefined,
    published_only: showDrafts ? undefined : 'true',
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [actionError, setActionError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);

  const items = data?.items || [];

  function set<K extends keyof typeof form>(key: K, value: any) {
    setForm((f: any) => ({ ...f, [key]: value }));
  }

  function openCreate(patch?: Record<string, any>) {
    setEditing(null);
    setForm({ ...EMPTY, ...(isQuickPatch(patch) ? patch : {}) });
    setFormError('');
    setOpen(true);
  }
  useQuickCreate(openCreate);

  function openEdit(m: any) {
    setEditing(m);
    setForm({
      title: m.title || '', message: m.message || '', category: m.category,
      audience: m.audience,
      department_id: m.department_id ? String(m.department_id) : '',
      branch_id: m.branch_id ? String(m.branch_id) : '',
      recipient_ids: m.recipient_ids || [],
      publish: !!m.published_at,
    });
    setFormError('');
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      const body: any = {
        title: form.title, message: form.message, category: form.category,
        audience: form.audience, publish: !!form.publish,
      };
      if (form.audience === 'department') body.department_id = Number(form.department_id);
      if (form.audience === 'branch') body.branch_id = Number(form.branch_id);
      if (form.audience === 'custom') body.recipient_ids = form.recipient_ids;
      if (editing) {
        await api(`/api/memos/${editing.id}`, { method: 'PUT', body });
      } else {
        await api('/api/memos', { method: 'POST', body });
      }
      setOpen(false);
      reload();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function publish(m: any) {
    setActionError('');
    try {
      await api(`/api/memos/${m.id}/publish`, { method: 'POST' });
      reload();
    } catch (err: any) {
      setActionError(err.message);
    }
  }

  async function remove(m: any) {
    setActionError('');
    try {
      await api(`/api/memos/${m.id}`, { method: 'DELETE' });
      reload();
    } catch (err: any) {
      setActionError(err.message);
    }
  }

  return (
    <div className="d-flex flex-column gap-3">
      <PageHeader
        eyebrow="Coordination"
        title="Memos"
        subtitle="Internal office notices and circulars, addressed like announcements."
        actions={canManage && (
          <button className="btn btn-primary btn-sm" onClick={() => openCreate()}>
            <i className="bi bi-plus-lg me-1" />New memo
          </button>
        )}
      />

      {actionError && <ErrorAlert message={actionError} />}

      <div className="card">
        <div className="card-body d-flex flex-wrap align-items-end gap-2">
          <div style={{ minWidth: 200 }}>
            <label className="form-label small fw-semibold mb-1">Search</label>
            <TextInput className="form-control form-control-sm" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <div>
            <label className="form-label small fw-semibold mb-1">Category</label>
            <SelectInput className="form-select form-select-sm" value={category}
              onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
              <option value="">All</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
            </SelectInput>
          </div>
          <div className="form-check ms-2 mb-2">
            <input className="form-check-input" type="checkbox" id="showDrafts" checked={showDrafts}
              onChange={(e) => { setShowDrafts(e.target.checked); setPage(1); }} />
            <label className="form-check-label small" htmlFor="showDrafts">Include drafts</label>
          </div>
        </div>
      </div>

      {loading && <Loading />}
      {error && <ErrorAlert message={error} onRetry={reload} />}
      {!loading && !error && items.length === 0 && (
        <EmptyState message="No memos" icon="bi-sticky" />
      )}

      <div className="d-flex flex-column gap-2">
        {items.map((m: any) => (
          <div className="card" key={m.id}>
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
                <div className="min-w-0">
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <span className="fw-semibold">{m.title}</span>
                    <Badge status={m.published_at ? 'published' : 'draft'} />
                  </div>
                  <div className="small text-muted mt-1">
                    {m.category?.replace(/_/g, ' ')} · {m.audience}
                    {m.department ? ` · ${m.department}` : ''}
                    {m.branch ? ` · ${m.branch}` : ''}
                    {m.published_at ? ` · ${fmtDate(m.published_at)}` : ' · not published'}
                  </div>
                </div>
                {canManage && (
                  <div className="d-flex gap-1 flex-shrink-0">
                    {!m.published_at && (
                      <button className="btn btn-sm btn-success" onClick={() => publish(m)}>
                        <i className="bi bi-send me-1" />Publish
                      </button>
                    )}
                    <button className="btn btn-sm btn-outline-primary" onClick={() => openEdit(m)}>
                      <i className="bi bi-pencil" />
                    </button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => setConfirmDelete(m)}>
                      <i className="bi bi-trash" />
                    </button>
                  </div>
                )}
              </div>
              <p className="mb-0 mt-2 small">{m.message}</p>
              {m.attachment_name && (
                <div className="small text-muted mt-2">
                  <i className="bi bi-paperclip me-1" />{m.attachment_name}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <Pagination page={page} pages={data?.pages || 1} onPage={setPage} total={data?.total} />

      <Modal show={open} title={editing ? 'Edit memo' : 'New memo'} onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy} onClick={save}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Create memo'}
            </button>
          </>
        }>
        <form onSubmit={save}>
          {formError && <ErrorAlert message={formError} />}
          <Field label="Title" required>
            <TextInput value={form.title} onChange={(e) => set('title', e.target.value)} required />
          </Field>
          <Field label="Message" required>
            <TextArea rows={6} value={form.message} onChange={(e) => set('message', e.target.value)} required />
          </Field>
          <div className="row g-2">
            <div className="col-6">
              <Field label="Category">
                <SelectInput value={form.category} onChange={(e) => set('category', e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                </SelectInput>
              </Field>
            </div>
            <div className="col-6">
              <Field label="Audience" required>
                <SelectInput value={form.audience} onChange={(e) => set('audience', e.target.value)}>
                  {AUDIENCES.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
                </SelectInput>
              </Field>
            </div>
          </div>
          {form.audience === 'department' && (
            <Field label="Department" required>
              <SelectInput value={form.department_id} onChange={(e) => set('department_id', e.target.value)}>
                <option value="">Select department…</option>
                {options(departments)}
              </SelectInput>
            </Field>
          )}
          {form.audience === 'branch' && (
            <Field label="Branch" required>
              <SelectInput value={form.branch_id} onChange={(e) => set('branch_id', e.target.value)}>
                <option value="">Select branch…</option>
                {options(branches)}
              </SelectInput>
            </Field>
          )}
          {form.audience === 'custom' && (
            <Field label="Recipients" required>
              <SelectInput multiple size={8} value={form.recipient_ids.map(String)}
                onChange={(e) => set('recipient_ids',
                  Array.from(e.target.selectedOptions).map((o) => Number(o.value)))}>
                {options(employees)}
              </SelectInput>
            </Field>
          )}
          <div className="form-check">
            <input className="form-check-input" type="checkbox" id="memoPublish" checked={form.publish}
              onChange={(e) => set('publish', e.target.checked)} />
            <label className="form-check-label small" htmlFor="memoPublish">
              Publish immediately (notify recipients)
            </label>
          </div>
        </form>
      </Modal>

      <ConfirmDialog show={!!confirmDelete} title="Delete memo"
        message={`Delete "${confirmDelete?.title}"? This cannot be undone.`}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && remove(confirmDelete)} />
    </div>
  );
}