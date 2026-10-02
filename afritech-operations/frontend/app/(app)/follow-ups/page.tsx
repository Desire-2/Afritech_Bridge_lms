'use client';

import { useState } from 'react';
import { useFetch, todayIso } from '@/lib/use-fetch';
import { api, can, fmtDate } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  PageHeader, Loading, ErrorAlert, EmptyState, Pagination, Badge, Modal, PriorityBadge,
} from '@/components/ui';
import { Field, TextInput, SelectInput, TextArea } from '@/components/form';
import { useEmployeeOptions, options } from '@/lib/use-options';
import { useQuickCreate, isQuickPatch } from '@/lib/quick-create';

const STATUSES = ['open', 'waiting', 'done', 'escalated', 'cancelled'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const EMPTY = {
  employee_id: '', subject: '', notes: '', priority: 'medium', status: 'open',
  next_follow_up: todayIso(), deadline: '', last_action: '', task_id: '',
};

export default function FollowUpsPage() {
  const { user } = useAuth();
  const canManage = can(user, 'followups.manage');
  const { employees } = useEmployeeOptions();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [search, setSearch] = useState('');
  const { data, error, loading, reload } = useFetch('/api/follow-ups',
    [page, status, priority, employeeId, overdueOnly, search], {
      page, per_page: 20,
      status: status || undefined,
      priority: priority || undefined,
      employee_id: employeeId || undefined,
      overdue_only: overdueOnly ? 'true' : undefined,
      search: search || undefined,
    });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [actionError, setActionError] = useState('');

  const [progressFor, setProgressFor] = useState<any | null>(null);
  const [progress, setProgress] = useState({ last_action: '', next_follow_up: todayIso(), status: '' });

  const items = data?.items || [];

  function set(key: string, value: any) {
    setForm((f: any) => ({ ...f, [key]: value }));
  }

  function openCreate(patch?: Record<string, any>) {
    setForm({ ...EMPTY, ...(isQuickPatch(patch) ? patch : {}) });
    setFormError('');
    setOpen(true);
  }
  useQuickCreate(openCreate);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      const body: any = {
        employee_id: Number(form.employee_id), subject: form.subject,
        priority: form.priority, status: form.status,
      };
      for (const k of ['notes', 'last_action', 'task_id']) {
        if (form[k]) body[k] = k === 'task_id' ? Number(form[k]) : form[k];
      }
      for (const k of ['next_follow_up', 'deadline']) {
        if (form[k]) body[k] = form[k];
      }
      await api('/api/follow-ups', { method: 'POST', body });
      setOpen(false);
      reload();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function applyStatus(f: any, next: string) {
    setActionError('');
    try {
      await api(`/api/follow-ups/${f.id}`, { method: 'PUT', body: { status: next } });
      reload();
    } catch (err: any) {
      setActionError(err.message);
    }
  }

  async function submitProgress(e: React.FormEvent) {
    e.preventDefault();
    if (!progressFor) return;
    setBusy(true);
    setFormError('');
    try {
      const body: any = { last_action: progress.last_action };
      if (progress.next_follow_up) body.next_follow_up = progress.next_follow_up;
      if (progress.status) body.status = progress.status;
      await api(`/api/follow-ups/${progressFor.id}/progress`, { method: 'POST', body });
      setProgressFor(null);
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
        title="Follow-ups"
        subtitle="What the office promised an employee, and whether it happened."
        actions={canManage && (
          <button className="btn btn-primary btn-sm" onClick={() => openCreate()}>
            <i className="bi bi-plus-lg me-1" />New follow-up
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
            <label className="form-label small fw-semibold mb-1">Employee</label>
            <SelectInput className="form-select form-control-sm" value={employeeId}
              onChange={(e) => { setEmployeeId(e.target.value); setPage(1); }}>
              <option value="">All in scope</option>
              {options(employees)}
            </SelectInput>
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
          <div className="form-check ms-2 mb-2">
            <input className="form-check-input" type="checkbox" id="overdueOnly" checked={overdueOnly}
              onChange={(e) => { setOverdueOnly(e.target.checked); setPage(1); }} />
            <label className="form-check-label small" htmlFor="overdueOnly">Overdue only</label>
          </div>
        </div>
      </div>

      {loading && <Loading />}
      {error && <ErrorAlert message={error} onRetry={reload} />}
      {!loading && !error && items.length === 0 && (
        <EmptyState message="No follow-ups" icon="bi-arrow-repeat" />
      )}

      {items.length > 0 && (
        <div className="card">
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Employee</th>
                  <th>Next follow-up</th>
                  <th>Last action</th>
                  <th>Status</th>
                  {canManage && <th className="text-end">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((f: any) => (
                  <tr key={f.id}>
                    <td>
                      <div className="fw-semibold">{f.subject}</div>
                      {f.task_title && <div className="small text-muted">Task: {f.task_title}</div>}
                    </td>
                    <td className="text-nowrap">
                      {f.employee || '—'}
                      {f.department && <div className="small text-muted">{f.department}</div>}
                    </td>
                    <td className="text-nowrap">
                      {fmtDate(f.next_follow_up)}
                      {f.is_overdue && <Badge status="overdue" />}
                    </td>
                    <td className="small" style={{ maxWidth: 240 }}>
                      {f.last_action ? (
                        <>
                          <div>{f.last_action}</div>
                          <div className="text-muted">{fmtDate(f.last_update)}</div>
                        </>
                      ) : <span className="text-muted">—</span>}
                    </td>
                    <td>
                      <div className="d-flex gap-1 align-items-center">
                        <Badge status={f.status} />
                        <PriorityBadge priority={f.priority} />
                      </div>
                    </td>
                    {canManage && (
                      <td className="text-end">
                        <div className="btn-group btn-group-sm">
                          <button className="btn btn-outline-primary" title="Record progress"
                            onClick={() => {
                              setProgressFor(f);
                              setProgress({
                                last_action: f.last_action || '',
                                next_follow_up: f.next_follow_up || todayIso(),
                                status: '',
                              });
                              setFormError('');
                            }}>
                            <i className="bi bi-pencil-square" />
                          </button>
                          {f.status !== 'done' && (
                            <button className="btn btn-outline-success" title="Mark done"
                              onClick={() => applyStatus(f, 'done')}>
                              <i className="bi bi-check2" />
                            </button>
                          )}
                          {f.status === 'open' && (
                            <button className="btn btn-outline-warning" title="Mark waiting"
                              onClick={() => applyStatus(f, 'waiting')}>
                              <i className="bi bi-hourglass-split" />
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

      <Modal show={open} title="New follow-up" onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy} onClick={create}>
              {busy ? 'Saving…' : 'Create'}
            </button>
          </>
        }>
        <form onSubmit={create}>
          {formError && <ErrorAlert message={formError} />}
          <Field label="Employee" required>
            <SelectInput value={form.employee_id} onChange={(e) => set('employee_id', e.target.value)} required>
              <option value="">Select employee…</option>
              {options(employees)}
            </SelectInput>
          </Field>
          <Field label="Subject" required>
            <TextInput value={form.subject} onChange={(e) => set('subject', e.target.value)} required />
          </Field>
          <Field label="Notes">
            <TextArea rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>
          <div className="row g-2">
            <div className="col-4">
              <Field label="Next follow-up">
                <TextInput type="date" value={form.next_follow_up}
                  onChange={(e) => set('next_follow_up', e.target.value)} />
              </Field>
            </div>
            <div className="col-4">
              <Field label="Deadline">
                <TextInput type="date" value={form.deadline}
                  onChange={(e) => set('deadline', e.target.value)} />
              </Field>
            </div>
            <div className="col-4">
              <Field label="Priority">
                <SelectInput value={form.priority} onChange={(e) => set('priority', e.target.value)}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </SelectInput>
              </Field>
            </div>
          </div>
          <Field label="Last action taken">
            <TextArea rows={2} value={form.last_action}
              onChange={(e) => set('last_action', e.target.value)} />
          </Field>
        </form>
      </Modal>

      <Modal show={!!progressFor} title={`Record progress — ${progressFor?.subject || ''}`}
        onClose={() => setProgressFor(null)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setProgressFor(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy} onClick={submitProgress}>
              {busy ? 'Saving…' : 'Record progress'}
            </button>
          </>
        }>
        <form onSubmit={submitProgress}>
          {formError && <ErrorAlert message={formError} />}
          <Field label="What was done" required>
            <TextArea rows={3} value={progress.last_action}
              onChange={(e) => setProgress((p) => ({ ...p, last_action: e.target.value }))} required />
          </Field>
          <div className="row g-2">
            <div className="col-6">
              <Field label="Next follow-up date">
                <TextInput type="date" value={progress.next_follow_up}
                  onChange={(e) => setProgress((p) => ({ ...p, next_follow_up: e.target.value }))} />
              </Field>
            </div>
            <div className="col-6">
              <Field label="Status" hint="Leave unchanged to keep the current status.">
                <SelectInput value={progress.status}
                  onChange={(e) => setProgress((p) => ({ ...p, status: e.target.value }))}>
                  <option value="">Unchanged</option>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </SelectInput>
              </Field>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}