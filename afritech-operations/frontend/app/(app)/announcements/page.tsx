'use client';

import { useState } from 'react';
import { useFetch, todayIso } from '@/lib/use-fetch';
import { api, can, fmtDate, fmtDateTime } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  PageHeader, Loading, ErrorAlert, EmptyState, Pagination, Badge, Modal, ConfirmDialog,
} from '@/components/ui';
import { Field, TextInput, SelectInput, TextArea } from '@/components/form';
import { useEmployeeOptions, useOrgOptions, options } from '@/lib/use-options';
import { useQuickCreate } from '@/lib/quick-create';

const CATEGORIES = [
  'staff_announcement', 'meeting_notice', 'schedule_update', 'administrative_instruction',
  'training_reminder', 'office_notice', 'internal_deadline', 'other',
];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const AUDIENCES = [
  { key: 'all', label: 'Whole company' },
  { key: 'department', label: 'One department' },
  { key: 'branch', label: 'One branch' },
  { key: 'custom', label: 'Specific employees' },
];

const EMPTY = {
  title: '', message: '', category: 'staff_announcement', priority: 'normal',
  audience: 'all', department_id: '', branch_id: '', recipient_ids: [] as number[],
  publish_date: todayIso(), expiry_date: '', requires_ack: false,
};

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const canManage = can(user, 'announcements.manage');
  const { employees } = useEmployeeOptions();
  const { departments, branches } = useOrgOptions();

  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [search, setSearch] = useState('');
  const [showClosed, setShowClosed] = useState(false);
  const { data, error, loading, reload } = useFetch('/api/announcements', [page, category, priority, search, showClosed], {
    page, per_page: 15,
    category: category || undefined,
    priority: priority || undefined,
    search: search || undefined,
    active_only: showClosed ? undefined : 'true',
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const [ackFor, setAckFor] = useState<any | null>(null);
  const [ackData, setAckData] = useState<any>(null);
  const [ackLoading, setAckLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
  const [actionError, setActionError] = useState('');

  const items = data?.items || [];

  function set<K extends keyof typeof form>(key: K, value: any) {
    setForm((f: any) => ({ ...f, [key]: value }));
  }

  function openCreate(patch?: Record<string, any>) {
    setEditing(null);
    setForm({ ...EMPTY, publish_date: todayIso(), ...(patch || {}) });
    setFormError('');
    setOpen(true);
  }
  useQuickCreate(openCreate);

  function openEdit(a: any) {
    setEditing(a);
    setForm({
      title: a.title || '', message: a.message || '', category: a.category,
      priority: a.priority, audience: a.audience,
      department_id: a.department_id ? String(a.department_id) : '',
      branch_id: a.branch_id ? String(a.branch_id) : '',
      recipient_ids: a.recipient_ids || [],
      publish_date: a.publish_date || todayIso(),
      expiry_date: a.expiry_date || '',
      requires_ack: !!a.requires_ack,
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
        priority: form.priority, audience: form.audience, requires_ack: !!form.requires_ack,
        publish_date: form.publish_date || undefined,
        expiry_date: form.expiry_date || undefined,
      };
      if (form.audience === 'department') body.department_id = Number(form.department_id);
      if (form.audience === 'branch') body.branch_id = Number(form.branch_id);
      if (form.audience === 'custom') body.recipient_ids = form.recipient_ids;
      if (editing) {
        await api(`/api/announcements/${editing.id}`, { method: 'PUT', body });
      } else {
        await api('/api/announcements', { method: 'POST', body });
      }
      setOpen(false);
      reload();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function acknowledge(a: any) {
    setActionError('');
    try {
      await api(`/api/announcements/${a.id}/acknowledge`, { method: 'POST' });
      reload();
    } catch (err: any) {
      setActionError(err.message);
    }
  }

  async function openAcknowledgements(a: any) {
    setAckFor(a);
    setAckLoading(true);
    setActionError('');
    try {
      setAckData(await api(`/api/announcements/${a.id}/acknowledgements`));
    } catch (err: any) {
      setActionError(err.message);
      setAckData(null);
    } finally {
      setAckLoading(false);
    }
  }

  async function remove(a: any) {
    setActionError('');
    try {
      await api(`/api/announcements/${a.id}`, { method: 'DELETE' });
      reload();
    } catch (err: any) {
      setActionError(err.message);
    }
  }

  return (
    <div className="d-flex flex-column gap-3">
      <PageHeader
        eyebrow="Coordination"
        title="Announcements"
        subtitle="Publish company notices and track who has acknowledged them."
        actions={canManage && (
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <i className="bi bi-plus-lg me-1" />New announcement
          </button>
        )}
      />

      {actionError && <ErrorAlert message={actionError} />}

      <div className="card">
        <div className="card-body d-flex flex-wrap align-items-end gap-2">
          <div style={{ minWidth: 180 }}>
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
          <div>
            <label className="form-label small fw-semibold mb-1">Priority</label>
            <SelectInput className="form-select form-select-sm" value={priority}
              onChange={(e) => { setPriority(e.target.value); setPage(1); }}>
              <option value="">All</option>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </SelectInput>
          </div>
          <div className="form-check ms-2 mb-2">
            <input className="form-check-input" type="checkbox" id="showClosed"
              checked={showClosed} onChange={(e) => { setShowClosed(e.target.checked); setPage(1); }} />
            <label className="form-check-label small" htmlFor="showClosed">Include expired</label>
          </div>
        </div>
      </div>

      {loading && <Loading />}
      {error && <ErrorAlert message={error} onRetry={reload} />}
      {!loading && !error && items.length === 0 && (
        <EmptyState message="No announcements" icon="bi-megaphone"
          action={canManage && (
            <button className="btn btn-sm btn-primary" onClick={openCreate}>New announcement</button>
          )} />
      )}

      {items.length > 0 && (
        <div className="d-flex flex-column gap-2">
          {items.map((a: any) => (
            <div className={`card ${a.requires_my_ack ? 'border-warning' : ''}`} key={a.id}>
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
                  <div className="min-w-0">
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <span className="fw-semibold">{a.title}</span>
                      <Badge status={a.priority} />
                      {a.requires_ack && <Badge status="pending" />}
                      {a.acknowledged_by_me && <Badge status="verified" />}
                    </div>
                    <div className="small text-muted mt-1">
                      {a.category?.replace(/_/g, ' ')} · {a.audience} · published {fmtDate(a.publish_date)}
                      {a.expiry_date ? ` · expires ${fmtDate(a.expiry_date)}` : ''}
                    </div>
                  </div>
                  <div className="d-flex gap-1 flex-shrink-0">
                    {a.requires_my_ack && (
                      <button className="btn btn-sm btn-warning" onClick={() => acknowledge(a)}>
                        <i className="bi bi-check2 me-1" />Acknowledge
                      </button>
                    )}
                    {canManage && (
                      <button className="btn btn-sm btn-outline-secondary"
                        title="Who has acknowledged" onClick={() => openAcknowledgements(a)}>
                        <i className="bi bi-people" />
                      </button>
                    )}
                    {canManage && (
                      <button className="btn btn-sm btn-outline-primary" onClick={() => openEdit(a)}>
                        <i className="bi bi-pencil" />
                      </button>
                    )}
                    {canManage && (
                      <button className="btn btn-sm btn-outline-danger" onClick={() => setConfirmDelete(a)}>
                        <i className="bi bi-trash" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="mb-0 mt-2 small">{a.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination page={page} pages={data?.pages || 1} onPage={setPage} total={data?.total} />

      <Modal show={open} title={editing ? 'Edit announcement' : 'New announcement'} onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy} onClick={save}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Publish'}
            </button>
          </>
        }>
        <form onSubmit={save}>
          {formError && <ErrorAlert message={formError} />}
          <Field label="Title" required>
            <TextInput value={form.title} onChange={(e) => set('title', e.target.value)} required />
          </Field>
          <Field label="Message" required>
            <TextArea rows={5} value={form.message} onChange={(e) => set('message', e.target.value)} required />
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
              <Field label="Priority">
                <SelectInput value={form.priority} onChange={(e) => set('priority', e.target.value)}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </SelectInput>
              </Field>
            </div>
          </div>
          <div className="row g-2">
            <div className="col-6">
              <Field label="Publish date">
                <TextInput type="date" value={form.publish_date}
                  onChange={(e) => set('publish_date', e.target.value)} />
              </Field>
            </div>
            <div className="col-6">
              <Field label="Expiry date">
                <TextInput type="date" value={form.expiry_date}
                  onChange={(e) => set('expiry_date', e.target.value)} />
              </Field>
            </div>
          </div>
          <Field label="Audience" required>
            <SelectInput value={form.audience} onChange={(e) => set('audience', e.target.value)}>
              {AUDIENCES.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
            </SelectInput>
          </Field>
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
            <Field label="Recipients" required hint="Service Agents are never listed here.">
              <SelectInput multiple size={8} value={form.recipient_ids.map(String)}
                onChange={(e) => set('recipient_ids',
                  Array.from(e.target.selectedOptions).map((o) => Number(o.value)))}>
                {options(employees)}
              </SelectInput>
            </Field>
          )}
          <div className="form-check">
            <input className="form-check-input" type="checkbox" id="reqAck" checked={form.requires_ack}
              onChange={(e) => set('requires_ack', e.target.checked)} />
            <label className="form-check-label small" htmlFor="reqAck">
              Require acknowledgement from every recipient
            </label>
          </div>
        </form>
      </Modal>

      <Modal show={!!ackFor} title={`Acknowledgements — ${ackFor?.title || ''}`}
        onClose={() => { setAckFor(null); setAckData(null); }} size="xl">
        {ackLoading && <Loading />}
        {!ackLoading && ackData && (
          <div className="d-flex flex-column gap-3">
            <div className="d-flex gap-3 flex-wrap">
              <span className="badge bg-success-subtle text-success border border-success-subtle">
                {ackData.acknowledged_count} acknowledged
              </span>
              <span className="badge bg-warning-subtle text-warning border border-warning-subtle">
                {(ackData.outstanding || []).length} outstanding
              </span>
              {ackData.expected_count === null && (
                <span className="small text-muted">Company-wide — no fixed recipient list</span>
              )}
            </div>
            <div>
              <h6 className="fw-semibold small">Acknowledged</h6>
              {(ackData.acknowledged || []).length === 0 ? (
                <p className="small text-muted mb-0">Nobody yet.</p>
              ) : (
                <ul className="list-group list-group-flush">
                  {ackData.acknowledged.map((x: any) => (
                    <li key={x.id} className="list-group-item px-0 d-flex justify-content-between">
                      <span className="small">{x.employee_name || x.employee || `Employee ${x.employee_id}`}</span>
                      <span className="small text-muted">{fmtDateTime(x.acknowledged_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h6 className="fw-semibold small">Outstanding</h6>
              {(ackData.outstanding || []).length === 0 ? (
                <p className="small text-muted mb-0">
                  {ackData.all_acknowledged ? 'Everyone has acknowledged.' : 'No fixed recipient list.'}
                </p>
              ) : (
                <ul className="list-group list-group-flush">
                  {ackData.outstanding.map((x: any) => (
                    <li key={x.employee_id} className="list-group-item px-0 d-flex justify-content-between">
                      <span className="small">{x.employee}</span>
                      <span className="small text-muted">{x.department || '—'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog show={!!confirmDelete} title="Delete announcement"
        message={`Delete "${confirmDelete?.title}"? This cannot be undone.`}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && remove(confirmDelete)} />
    </div>
  );
}