'use client';

import { useRef, useState } from 'react';
import { useFetch } from '@/lib/use-fetch';
import { api, can, fmtDateTime, downloadFile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  PageHeader, Loading, ErrorAlert, EmptyState, Pagination, Badge, Modal, ConfirmDialog,
} from '@/components/ui';
import { Field, TextInput, SelectInput, TextArea } from '@/components/form';

const CATEGORIES = [
  'administrative', 'meeting_minutes', 'activity_plan', 'schedule',
  'form', 'notice', 'company',
];

function fmtSize(bytes: number | null | undefined) {
  const n = Number(bytes || 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const { user } = useAuth();
  const canManage = can(user, 'documents.manage');
  const fileRef = useRef<HTMLInputElement>(null);

  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const { data, error, loading, reload } = useFetch('/api/documents', [page, category, search], {
    page, per_page: 20,
    category: category || undefined,
    search: search || undefined,
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ title: '', description: '', category: 'administrative' });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [actionError, setActionError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);

  const items = data?.items || [];

  function set(key: string, value: any) {
    setForm((f: any) => ({ ...f, [key]: value }));
  }

  function openUpload() {
    setEditing(null);
    setForm({ title: '', description: '', category: 'administrative' });
    setFile(null);
    if (fileRef.current) fileRef.current.value = '';
    setFormError('');
    setOpen(true);
  }

  function openEdit(d: any) {
    setEditing(d);
    setForm({ title: d.title || '', description: d.description || '', category: d.category });
    setFile(null);
    setFormError('');
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      if (editing) {
        await api(`/api/documents/${editing.id}`, { method: 'PUT', body: form });
      } else {
        if (!file) throw new Error('Choose a file to upload');
        const fd = new FormData();
        fd.append('file', file);
        fd.append('title', form.title || file.name);
        fd.append('category', form.category);
        if (form.description) fd.append('description', form.description);
        await api('/api/documents', { method: 'POST', formData: fd });
      }
      setOpen(false);
      reload();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function download(d: any) {
    setActionError('');
    try {
      await downloadFile(`/api/documents/${d.id}/download`, d.file_name || d.title);
    } catch (err: any) {
      setActionError(err.message);
    }
  }

  async function remove(d: any) {
    setActionError('');
    try {
      await api(`/api/documents/${d.id}`, { method: 'DELETE' });
      reload();
    } catch (err: any) {
      setActionError(err.message);
    }
  }

  return (
    <div className="d-flex flex-column gap-3">
      <PageHeader
        eyebrow="Coordination"
        title="Documents"
        subtitle="Administrative document library. Every download is logged to the audit trail."
        actions={canManage && (
          <button className="btn btn-primary btn-sm" onClick={openUpload}>
            <i className="bi bi-upload me-1" />Upload
          </button>
        )}
      />

      {actionError && <ErrorAlert message={actionError} />}

      <div className="card">
        <div className="card-body d-flex flex-wrap align-items-end gap-2">
          <div style={{ minWidth: 220 }}>
            <label className="form-label small fw-semibold mb-1">Search</label>
            <TextInput className="form-control form-control-sm" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <div>
            <label className="form-label small fw-semibold mb-1">Category</label>
            <SelectInput className="form-select form-select-sm" value={category}
              onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
              <option value="">All</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </SelectInput>
          </div>
          <span className="small text-muted ms-auto">Max upload size 10 MB</span>
        </div>
      </div>

      {loading && <Loading />}
      {error && <ErrorAlert message={error} onRetry={reload} />}
      {!loading && !error && items.length === 0 && (
        <EmptyState message="No documents" icon="bi-folder2-open" />
      )}

      {items.length > 0 && (
        <div className="card">
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Size</th>
                  <th>Uploaded</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((d: any) => (
                  <tr key={d.id}>
                    <td>
                      <div className="fw-semibold">{d.title}</div>
                      <div className="small text-muted">{d.file_name}</div>
                    </td>
                    <td><Badge status={d.category} /></td>
                    <td className="text-nowrap">{fmtSize(d.size_bytes)}</td>
                    <td className="text-nowrap small">{fmtDateTime(d.created_at)}</td>
                    <td className="text-end">
                      <div className="btn-group btn-group-sm">
                        <button className="btn btn-outline-primary" title="Download"
                          onClick={() => download(d)}>
                          <i className="bi bi-download" />
                        </button>
                        {canManage && (
                          <>
                            <button className="btn btn-outline-secondary" title="Edit details"
                              onClick={() => openEdit(d)}>
                              <i className="bi bi-pencil" />
                            </button>
                            <button className="btn btn-outline-danger" title="Delete"
                              onClick={() => setConfirmDelete(d)}>
                              <i className="bi bi-trash" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Pagination page={page} pages={data?.pages || 1} onPage={setPage} total={data?.total} />

      <Modal show={open} title={editing ? 'Document details' : 'Upload document'} onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy} onClick={save}>
              {busy ? 'Working…' : editing ? 'Save changes' : 'Upload'}
            </button>
          </>
        }>
        <form onSubmit={save}>
          {formError && <ErrorAlert message={formError} />}
          {!editing && (
            <Field label="File" required hint="PDF, Office, CSV, TXT or image. Max 10 MB.">
              <input ref={fileRef} type="file" className="form-control"
                onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setFile(f);
                    set('title', form.title || f?.name || '');
                  }}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.webp" />
            </Field>
          )}
          <Field label="Title">
            <TextInput value={form.title} onChange={(e) => set('title', e.target.value)}
              placeholder="Defaults to the file name" />
          </Field>
          <Field label="Category">
            <SelectInput value={form.category} onChange={(e) => set('category', e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </SelectInput>
          </Field>
          <Field label="Description">
            <TextArea rows={3} value={form.description}
              onChange={(e) => set('description', e.target.value)} />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog show={!!confirmDelete} title="Delete document"
        message={`Delete "${confirmDelete?.title}" and its stored file? This cannot be undone.`}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && remove(confirmDelete)} />
    </div>
  );
}