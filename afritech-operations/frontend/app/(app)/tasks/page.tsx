'use client';

import { useState } from 'react';
import { useFetch } from '@/lib/use-fetch';
import { api, fmtDate, can } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PageHeader, Loading, ErrorAlert, EmptyState, Pagination, Badge, Modal, PriorityBadge } from '@/components/ui';
import { Field, TextInput, SelectInput, TextArea } from '@/components/form';
import { useQuickCreate, isQuickPatch } from '@/lib/quick-create';

export default function TasksPage() {
  const { user } = useAuth();
  const canManage = can(user, 'tasks.manage');
  const canAssign = canManage || can(user, 'tasks.assign');
  const canVerify = canManage || can(user, 'tasks.verify');
  const canCreate = can(user, 'tasks.create');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [mine, setMine] = useState(false);
  const { data, error, loading, reload } = useFetch('/api/tasks', [page, status, mine], {
    page, per_page: 20,
    status: status || undefined,
    mine: mine || undefined,
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ title: '', description: '', assigned_to: '', priority: 'medium', due_date: '', comments: '' });
  const [busy, setBusy] = useState(false);
  const [actingId, setActingId] = useState<number | null>(null);
  const [error2, setError2] = useState('');

  const items = data?.items || [];

  async function loadEmployees() {
    if (employees.length) return;
    const d: any = await api('/api/employees?per_page=500').catch(() => ({ items: [] }));
    setEmployees(d.items || []);
  }

  async function openCreate(patch?: Record<string, any>) {
    setEditing(null);
    await loadEmployees();
    setForm({ title: '', description: '', assigned_to: '', priority: 'medium', due_date: '', comments: '', ...(isQuickPatch(patch) ? patch : {}) });
    setError2('');
    setOpen(true);
  }
  useQuickCreate(openCreate);

  async function openEdit(t: any) {
    setEditing(t);
    await loadEmployees();
    setForm({ title: t.title, description: t.description || '', assigned_to: String(t.assigned_to), priority: t.priority, due_date: t.due_date || '', comments: t.comments || '', status: t.status });
    setError2('');
    setOpen(true);
    // After fetching employee options, keep assigned
    setForm((f) => ({ ...f, assigned_to: String(t.assigned_to) }));
  }

  function set<K extends keyof typeof form>(key: K, value: any) { setForm((f) => ({ ...f, [key]: value })); }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError2('');
    try {
      const body: any = { ...form, assigned_to: Number(form.assigned_to) };
      if (!body.description) delete body.description;
      if (!body.due_date) delete body.due_date;
      if (!body.comments) delete body.comments;
      if (editing) {
        delete body.title;
        await api(`/api/tasks/${editing.id}`, { method: 'PUT', body });
      } else {
        await api('/api/tasks', { method: 'POST', body });
      }
      setOpen(false);
      reload();
    } catch (err: any) {
      setError2(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function setStatusItem(t: any, status: string) {
    if (actingId) return;
    setError2('');
    setActingId(t.id);
    try {
      await api(`/api/tasks/${t.id}`, { method: 'PUT', body: { status } });
      reload();
    } catch (err: any) {
      setError2(err.message);
    } finally {
      setActingId(null);
    }
  }

  const counts = items.reduce((acc: Record<string, number>, t: any) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="d-flex flex-column gap-3">
      <PageHeader
        eyebrow="Operations"
        title="Tasks"
        subtitle="Track assignments, progress, and verification in one workspace."
        actions={canCreate ? (
          <button className="btn btn-primary btn-sm" onClick={() => openCreate()}>
            <i className="bi bi-plus-circle me-1" aria-hidden="true" /> New task
          </button>
        ) : undefined}
      />

      <div className="filter-bar">
        <div className="row g-2 align-items-end">
          <div className="col-sm-6 col-lg-3">
            <label className="form-label" htmlFor="task-status">Status</label>
            <select id="task-status" className="form-select form-select-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All statuses</option>
              <option value="todo">To do</option>
              <option value="in_progress">In progress</option>
              <option value="submitted">Submitted</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="col-sm-6 col-lg-3 d-flex align-items-center pb-1">
            <div className="form-check form-switch mb-0">
              <input className="form-check-input" type="checkbox" id="mineOnly" checked={mine} onChange={(e) => { setMine(e.target.checked); setPage(1); }} />
              <label className="form-check-label small" htmlFor="mineOnly">Assigned to me</label>
            </div>
          </div>
          <div className="col-lg-6">
            <div className="d-flex gap-2 flex-wrap justify-content-lg-end small text-muted">
              <span><strong className="text-body">{data?.total ?? 0}</strong> total</span>
              <span>In progress <strong className="text-body">{counts.in_progress || 0}</strong></span>
              <span>Submitted <strong className="text-body">{counts.submitted || 0}</strong></span>
              <span>Overdue <strong className="text-danger">{items.filter((t: any) => t.is_overdue).length}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {error2 && <ErrorAlert message={error2} onRetry={() => setError2('')} />}
      {error && <ErrorAlert message={error} onRetry={reload} />}

      <div className="data-table-wrap">
        <div className="data-table-toolbar">
          <div>
            <div className="panel-title">Task queue</div>
            <div className="panel-subtitle">Status, ownership, due dates, and next actions.</div>
          </div>
        </div>
        {loading && <div className="p-3"><Loading /></div>}
        {!loading && !error && items.length === 0 && <div className="p-3"><EmptyState message="No tasks found" icon="bi-check2-square" /></div>}
        {!loading && !error && items.length > 0 && (
          <>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Assigned to</th>
                    <th>Due</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((t: any) => (
                    <tr key={t.id}>
                      <td style={{ minWidth: 260 }}>
                        <div className="fw-semibold">{t.title}</div>
                        <div className="small text-muted text-truncate" style={{ maxWidth: 420 }}>{t.description || 'No description'}</div>
                      </td>
                      <td className="small">{t.assignee_name || 'Unassigned'}</td>
                      <td className="small">
                        {t.due_date ? (
                          <>
                            <div>{fmtDate(t.due_date)}</div>
                            {t.is_overdue && <div className="text-danger">Overdue</div>}
                          </>
                        ) : <span className="text-muted">—</span>}
                      </td>
                      <td><PriorityBadge priority={t.priority} /></td>
                      <td><Badge status={t.status} /></td>
                      <td>
                        <div className="d-flex gap-1 justify-content-end flex-wrap">
                          {t.status === 'todo' && <button className="btn btn-sm btn-outline-primary" disabled={!!actingId} onClick={() => setStatusItem(t, 'in_progress')}>Start</button>}
                          {t.status === 'in_progress' && <button className="btn btn-sm btn-outline-success" disabled={!!actingId} onClick={() => setStatusItem(t, 'submitted')}>Submit</button>}
                          {canVerify && t.status === 'submitted' && (
                            <>
                              <button className="btn btn-sm btn-outline-success" disabled={!!actingId} onClick={() => setStatusItem(t, 'verified')}>Verify</button>
                              <button className="btn btn-sm btn-outline-danger" disabled={!!actingId} onClick={() => setStatusItem(t, 'rejected')}>Reject</button>
                            </>
                          )}
                          {(canAssign || canVerify) && t.status === 'rejected' && (
                            <button className="btn btn-sm btn-outline-primary" disabled={!!actingId} onClick={() => setStatusItem(t, 'in_progress')}>Reopen</button>
                          )}
                          {canAssign && <button className="btn btn-sm btn-outline-secondary" onClick={() => openEdit(t)} aria-label={`Edit ${t.title}`}><i className="bi bi-pencil" aria-hidden="true" /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-top">
              <Pagination page={page} pages={data?.pages || 1} total={data?.total} onPage={setPage} />
            </div>
          </>
        )}
      </div>

      <Modal show={open} title={editing ? 'Edit task' : 'New task'} onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        {error2 && <div className="alert alert-danger py-2 small">{error2}</div>}
        <form onSubmit={save}>
          {!editing ? (
            <Field label="Title" required><TextInput value={form.title} onChange={(e) => set('title', e.target.value)} required /></Field>
          ) : (
            <Field label="Status">
              <SelectInput value={form.status} onChange={(e) => set('status', e.target.value)}>
                <option value="todo">To do</option>
                <option value="in_progress">In progress</option>
                <option value="submitted">Submitted</option>
                {canVerify && <option value="verified">Verified</option>}
                {canVerify && <option value="rejected">Rejected</option>}
                {canVerify && <option value="cancelled">Cancelled</option>}
              </SelectInput>
            </Field>
          )}
          <Field label="Description"><TextArea value={form.description} onChange={(e) => set('description', e.target.value)} /></Field>
          <Field label="Assigned to" required>
            <SelectInput value={form.assigned_to} onChange={(e) => set('assigned_to', e.target.value)} required>
              <option value="">Select employee…</option>
              {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
            </SelectInput>
          </Field>
          <div className="row">
            <div className="col-md-6">
              <Field label="Priority">
                <SelectInput value={form.priority} onChange={(e) => set('priority', e.target.value)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </SelectInput>
              </Field>
            </div>
            <div className="col-md-6">
              <Field label="Due date"><TextInput type="date" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} /></Field>
            </div>
          </div>
          <Field label="Comments"><TextArea value={form.comments} onChange={(e) => set('comments', e.target.value)} rows={2} /></Field>
        </form>
      </Modal>
    </div>
  );
}