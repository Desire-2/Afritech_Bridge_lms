'use client';

import { useState } from 'react';
import { useFetch } from '@/lib/use-fetch';
import { api, can, fmtDate } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  PageHeader, Loading, ErrorAlert, EmptyState, Pagination, Badge, Modal, PriorityBadge,
} from '@/components/ui';
import { Field, TextInput, SelectInput, TextArea } from '@/components/form';
import { useEmployeeOptions, options } from '@/lib/use-options';

const TYPES = ['administrative', 'document', 'schedule', 'equipment', 'leave', 'meeting', 'other'];
const STATUSES = ['submitted', 'in_review', 'more_info', 'forwarded', 'approved', 'rejected', 'closed'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const EMPTY = {
  title: '', description: '', type: 'administrative', priority: 'medium',
  requested_by: '', start_date: '', end_date: '', due_date: '',
};

export default function RequestsPage() {
  const { user } = useAuth();
  const canManage = can(user, 'requests.manage');
  const { employees } = useEmployeeOptions();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [mine, setMine] = useState(false);
  const [search, setSearch] = useState('');
  const { data, error, loading, reload } = useFetch('/api/requests', [page, status, type, mine, search], {
    page, per_page: 20,
    status: status || undefined,
    type: type || undefined,
    mine: mine || undefined,
    search: search || undefined,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [actionError, setActionError] = useState('');

  const [resolveFor, setResolveFor] = useState<any | null>(null);
  const [resolution, setResolution] = useState('');
  const [decision, setDecision] = useState('approved');

  const items = data?.items || [];

  function set(key: string, value: any) {
    setForm((f: any) => ({ ...f, [key]: value }));
  }

  function openCreate() {
    setForm({ ...EMPTY });
    setFormError('');
    setOpen(true);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      const body: any = {
        title: form.title, type: form.type, priority: form.priority,
      };
      if (form.description) body.description = form.description;
      if (form.requested_by) body.requested_by = Number(form.requested_by);
      for (const k of ['start_date', 'end_date', 'due_date']) {
        if (form[k]) body[k] = form[k];
      }
      await api('/api/requests', { method: 'POST', body });
      setOpen(false);
      reload();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function applyStatus(r: any, next: string) {
    setActionError('');
    try {
      await api(`/api/requests/${r.id}`, { method: 'PUT', body: { status: next } });
      reload();
    } catch (err: any) {
      setActionError(err.message);
    }
  }

  async function assign(r: any, employeeId: string) {
    setActionError('');
    try {
      await api(`/api/requests/${r.id}`, {
        method: 'PUT',
        body: { assigned_to: employeeId ? Number(employeeId) : null },
      });
      reload();
    } catch (err: any) {
      setActionError(err.message);
    }
  }

  async function submitResolve(e: React.FormEvent) {
    e.preventDefault();
    if (!resolveFor) return;
    setBusy(true);
    setFormError('');
    try {
      await api(`/api/requests/${resolveFor.id}/resolve`, {
        method: 'POST',
        body: { status: decision, resolution },
      });
      setResolveFor(null);
      setResolution('');
      reload();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="d-flex flex-column gap-3">
      <PageHeader
        eyebrow="Coordination"
        title="Administrative Requests"
        subtitle="The intake queue: triage, assignment and resolution."
        actions={
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <i className="bi bi-plus-lg me-1" />New request
          </button>
        }
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
            <label className="form-label small fw-semibold mb-1">Status</label>
            <SelectInput className="form-select form-control-sm" value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">Open only</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </SelectInput>
          </div>
          <div>
            <label className="form-label small fw-semibold mb-1">Type</label>
            <SelectInput className="form-select form-control-sm" value={type}
              onChange={(e) => { setType(e.target.value); setPage(1); }}>
              <option value="">All</option>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </SelectInput>
          </div>
          <div className="form-check ms-2 mb-2">
            <input className="form-check-input" type="checkbox" id="mineOnly" checked={mine}
              onChange={(e) => { setMine(e.target.checked); setPage(1); }} />
            <label className="form-check-label small" htmlFor="mineOnly">Submitted by me</label>
          </div>
        </div>
      </div>

      {loading && <Loading />}
      {error && <ErrorAlert message={error} onRetry={reload} />}
      {!loading && !error && items.length === 0 && (
        <EmptyState message="No requests" icon="bi-inbox" />
      )}

      {items.length > 0 && (
        <div className="card">
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Requester</th>
                  <th>Assigned to</th>
                  <th>Due</th>
                  <th>Status</th>
                  {canManage && <th className="text-end">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((r: any) => (
                  <tr key={r.id}>
                    <td>
                      <div className="fw-semibold">{r.title}</div>
                      <div className="small text-muted">
                        {r.type}
                        {r.requester_department ? ` · ${r.requester_department}` : ''}
                        {r.description ? ` · ${r.description.slice(0, 60)}` : ''}
                      </div>
                    </td>
                    <td className="text-nowrap">{r.requester || '—'}</td>
                    <td className="text-nowrap">
                      {canManage ? (
                        <SelectInput className="form-select form-select-sm" style={{ minWidth: 150 }}
                          value={r.assigned_to ? String(r.assigned_to) : ''}
                          onChange={(e) => assign(r, e.target.value)}>
                          <option value="">Unassigned</option>
                          {options(employees)}
                        </SelectInput>
                      ) : (r.assignee || '—')}
                    </td>
                    <td className="text-nowrap">
                      {r.due_date ? fmtDate(r.due_date) : '—'}
                      {r.is_stale && <Badge status="overdue" />}
                    </td>
                    <td>
                      <div className="d-flex gap-1 align-items-center">
                        <Badge status={r.status} />
                        <PriorityBadge priority={r.priority} />
                      </div>
                    </td>
                    {canManage && (
                      <td className="text-end">
                        <div className="btn-group btn-group-sm">
                          {['in_review', 'more_info'].map((s) => (
                            r.status !== s && r.status !== 'closed' && (
                              <button key={s} className="btn btn-outline-secondary"
                                title={`Move to ${s.replace('_', ' ')}`}
                                onClick={() => applyStatus(r, s)}>
                                {s === 'in_review' ? <i className="bi bi-eye" /> : <i className="bi bi-question-circle" />}
                              </button>
                            )
                          ))}
                          <button className="btn btn-outline-success" title="Resolve"
                            onClick={() => { setResolveFor(r); setResolution(''); setFormError(''); }}>
                            <i className="bi bi-check2-circle" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Pagination page={page} pages={data?.pages || 1} onPage={setPage} total={data?.total} />

      <Modal show={open} title="New administrative request" onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy} onClick={create}>
              {busy ? 'Submitting…' : 'Submit request'}
            </button>
          </>
        }>
        <form onSubmit={create}>
          {formError && <ErrorAlert message={formError} />}
          <Field label="Title" required>
            <TextInput value={form.title} onChange={(e) => set('title', e.target.value)} required />
          </Field>
          <Field label="Description">
            <TextArea rows={4} value={form.description}
              onChange={(e) => set('description', e.target.value)} />
          </Field>
          <div className="row g-2">
            <div className="col-6">
              <Field label="Type">
                <SelectInput value={form.type} onChange={(e) => set('type', e.target.value)}>
                  {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
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
          {canManage && (
            <Field label="Submit on behalf of" hint="Leave as yourself unless filing for someone else.">
              <SelectInput value={form.requested_by} onChange={(e) => set('requested_by', e.target.value)}>
                <option value="">Myself</option>
                {options(employees)}
              </SelectInput>
            </Field>
          )}
          <div className="row g-2">
            <div className="col-4">
              <Field label="Start date">
                <TextInput type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} />
              </Field>
            </div>
            <div className="col-4">
              <Field label="End date">
                <TextInput type="date" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} />
              </Field>
            </div>
            <div className="col-4">
              <Field label="Due date">
                <TextInput type="date" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} />
              </Field>
            </div>
          </div>
        </form>
      </Modal>

      <Modal show={!!resolveFor} title={`Resolve — ${resolveFor?.title || ''}`}
        onClose={() => setResolveFor(null)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setResolveFor(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy} onClick={submitResolve}>
              {busy ? 'Saving…' : 'Save decision'}
            </button>
          </>
        }>
        <form onSubmit={submitResolve}>
          {formError && <ErrorAlert message={formError} />}
          <Field label="Decision" required>
            <SelectInput value={decision} onChange={(e) => setDecision(e.target.value)}>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="closed">Closed</option>
            </SelectInput>
          </Field>
          <Field label="Resolution note" required={decision !== 'rejected'}>
            <TextArea rows={4} value={resolution} onChange={(e) => setResolution(e.target.value)} />
          </Field>
        </form>
      </Modal>
    </div>
  );
}