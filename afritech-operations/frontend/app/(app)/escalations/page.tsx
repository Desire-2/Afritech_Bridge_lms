'use client';

import { useState } from 'react';
import { useFetch } from '@/lib/use-fetch';
import { api, can, fmtDateTime } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  PageHeader, Loading, ErrorAlert, EmptyState, Pagination, Badge, Modal, PriorityBadge,
} from '@/components/ui';
import { Field, TextInput, SelectInput, TextArea } from '@/components/form';

const STATUSES = ['created', 'assigned', 'resolved', 'dismissed'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const ESCALATE_TO = [
  { key: 'manager', label: 'Management' },
  { key: 'super_admin', label: 'Super admin' },
];
const RELATED_TYPES = [
  'request', 'task', 'meeting', 'follow_up', 'announcement', 'memo', 'employee', 'other',
];

const EMPTY = {
  subject: '', issue: '', reason: '', escalate_to: 'manager', priority: 'high',
  related_type: '', related_id: '',
};

export default function EscalationsPage() {
  const { user } = useAuth();
  const canManage = can(user, 'escalations.manage');

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [search, setSearch] = useState('');
  const { data, error, loading, reload } = useFetch('/api/escalations', [page, status, priority, search], {
    page, per_page: 20,
    status: status || undefined,
    priority: priority || undefined,
    search: search || undefined,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [actionError, setActionError] = useState('');

  const [resolveFor, setResolveFor] = useState<any | null>(null);
  const [resolution, setResolution] = useState('');

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
        subject: form.subject, issue: form.issue, escalate_to: form.escalate_to,
        priority: form.priority,
      };
      if (form.reason) body.reason = form.reason;
      if (form.related_type) {
        body.related_type = form.related_type;
        if (form.related_id) body.related_id = Number(form.related_id);
      }
      await api('/api/escalations', { method: 'POST', body });
      setOpen(false);
      reload();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const [actingId, setActingId] = useState<number | null>(null);

  async function applyStatus(e: any, next: string) {
    if (actingId) return;
    setActionError('');
    setActingId(e.id);
    try {
      await api(`/api/escalations/${e.id}`, { method: 'PUT', body: { status: next } });
      reload();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActingId(null);
    }
  }

  async function submitResolve(e: React.FormEvent) {
    e.preventDefault();
    if (!resolveFor) return;
    setBusy(true);
    setFormError('');
    try {
      await api(`/api/escalations/${resolveFor.id}/resolve`, {
        method: 'POST', body: { resolution },
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
        title="Escalations"
        subtitle="Blocked administrative matters raised up the chain."
        actions={
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <i className="bi bi-plus-lg me-1" />Raise escalation
          </button>
        }
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
            <label className="form-label small fw-semibold mb-1">Status</label>
            <SelectInput className="form-select form-control-sm" value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">Open only</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </SelectInput>
          </div>
          <div>
            <label className="form-label small fw-semibold mb-1">Priority</label>
            <SelectInput className="form-select form-control-sm" value={priority}
              onChange={(e) => { setPriority(e.target.value); setPage(1); }}>
              <option value="">All</option>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </SelectInput>
          </div>
        </div>
      </div>

      {loading && <Loading />}
      {error && <ErrorAlert message={error} onRetry={reload} />}
      {!loading && !error && items.length === 0 && (
        <EmptyState message="No escalations" icon="bi-exclamation-diamond" />
      )}

      {items.length > 0 && (
        <div className="card">
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Raised</th>
                  <th>Related to</th>
                  <th>Status</th>
                  {canManage && <th className="text-end">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((e: any) => (
                  <tr key={e.id}>
                    <td>
                      <div className="fw-semibold">{e.subject}</div>
                      <div className="small text-muted">{e.issue.slice(0, 90)}</div>
                      {e.resolution && (
                        <div className="small text-success mt-1">
                          <i className="bi bi-check2 me-1" />{e.resolution}
                        </div>
                      )}
                    </td>
                    <td className="text-nowrap small">
                      {fmtDateTime(e.created_at)}
                      <div className="text-muted">to {e.escalate_to === 'super_admin' ? 'super admin' : 'management'}</div>
                    </td>
                    <td className="small">
                      {e.related_type ? `${e.related_type.replace(/_/g, ' ')} #${e.related_id}` : '—'}
                      {e.assignee && <div className="text-muted">{e.assignee}</div>}
                    </td>
                    <td>
                      <div className="d-flex gap-1 align-items-center">
                        <Badge status={e.status} />
                        <PriorityBadge priority={e.priority} />
                      </div>
                    </td>
                    {canManage && (
                      <td className="text-end">
                        <div className="btn-group btn-group-sm">
                          <button className="btn btn-outline-success" title="Resolve"
                            onClick={() => { setResolveFor(e); setResolution(''); setFormError(''); }}>
                            <i className="bi bi-check2-circle" />
                          </button>
                          {e.status !== 'dismissed' && (
                            <button className="btn btn-outline-secondary" title="Dismiss" disabled={!!actingId}
                              onClick={() => applyStatus(e, 'dismissed')}>
                              <i className="bi bi-x-circle" />
                            </button>
                          )}
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

      <Modal show={open} title="Raise an escalation" onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy} onClick={create}>
              {busy ? 'Raising…' : 'Raise escalation'}
            </button>
          </>
        }>
        <form onSubmit={create}>
          {formError && <ErrorAlert message={formError} />}
          <Field label="Subject" required>
            <TextInput value={form.subject} onChange={(e) => set('subject', e.target.value)} required />
          </Field>
          <Field label="What is blocked" required>
            <TextArea rows={4} value={form.issue} onChange={(e) => set('issue', e.target.value)} required />
          </Field>
          <Field label="Why this needs escalating">
            <TextArea rows={2} value={form.reason} onChange={(e) => set('reason', e.target.value)} />
          </Field>
          <div className="row g-2">
            <div className="col-6">
              <Field label="Escalate to">
                <SelectInput value={form.escalate_to} onChange={(e) => set('escalate_to', e.target.value)}>
                  {ESCALATE_TO.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
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
              <Field label="Related record type">
                <SelectInput value={form.related_type} onChange={(e) => set('related_type', e.target.value)}>
                  <option value="">None</option>
                  {RELATED_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </SelectInput>
              </Field>
            </div>
            <div className="col-6">
              <Field label="Related record id">
                <TextInput type="number" min={1} value={form.related_id}
                  onChange={(e) => set('related_id', e.target.value)} />
              </Field>
            </div>
          </div>
        </form>
      </Modal>

      <Modal show={!!resolveFor} title={`Resolve — ${resolveFor?.subject || ''}`}
        onClose={() => setResolveFor(null)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setResolveFor(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy} onClick={submitResolve}>
              {busy ? 'Saving…' : 'Resolve'}
            </button>
          </>
        }>
        <form onSubmit={submitResolve}>
          {formError && <ErrorAlert message={formError} />}
          <Field label="Resolution" required>
            <TextArea rows={4} value={resolution} onChange={(e) => setResolution(e.target.value)} required />
          </Field>
        </form>
      </Modal>
    </div>
  );
}