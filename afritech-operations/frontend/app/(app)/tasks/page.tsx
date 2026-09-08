'use client';

import { useState } from 'react';
import { useFetch } from '@/lib/use-fetch';
import { api, fmtDate, can } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PageHeader, Loading, ErrorAlert, EmptyState, Pagination, Badge, Modal, PriorityBadge } from '@/components/ui';
import { Field, TextInput, SelectInput, TextArea } from '@/components/form';

export default function TasksPage() {
  const { user } = useAuth();
  const canManage = can(user, 'tasks.manage');
  const canCreate = can(user, 'tasks.create');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [mine, setMine] = useState(false);
  const { data, error, loading, reload } = useFetch('/api/tasks', [page, status, mine], { page, per_page: 20, status: status || undefined });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ title: '', description: '', assigned_to: '', priority: 'medium', due_date: '', comments: '' });
  const [busy, setBusy] = useState(false);
  const [error2, setError2] = useState('');

  const items = (mine ? (data?.items || []).filter((t: any) => t.assignee_name === user?.employee_name) : data?.items) || [];

  async function loadEmployees() {
    if (employees.length) return;
    const d: any = await api('/api/employees?per_page=500').catch(() => ({ items: [] }));
    setEmployees(d.items || []);
  }

  async function openCreate() {
    setEditing(null);
    await loadEmployees();
    setForm({ title: '', description: '', assigned_to: '', priority: 'medium', due_date: '', comments: '' });
    setError2('');
    setOpen(true);
  }

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
    await api(`/api/tasks/${t.id}`, { method: 'PUT', body: { status } });
    reload();
  }

  return (
    <div>
      <PageHeader title="Tasks" subtitle="Internal task management"
        actions={canCreate
          ? <button className="btn btn-primary" onClick={openCreate}><i className="bi bi-plus-circle me-1" /> New task</button>
          : undefined} />

      <div className="d-flex gap-2 mb-3 flex-wrap">
        <select className="form-select form-select-sm" style={{ width: 170 }} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="todo">To do</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
          <option value="verified">Verified</option>
        </select>
        <div className="form-check form-switch align-self-center">
          <input className="form-check-input" type="checkbox" id="mineOnly" checked={mine} onChange={(e) => { setMine(e.target.checked); setPage(1); }} />
          <label className="form-check-label small" htmlFor="mineOnly">Assigned to me</label>
        </div>
      </div>
      {error2 && <ErrorAlert message={error2} onRetry={() => setError2('')} />}

      {error && <ErrorAlert message={error} onRetry={reload} />}
      {loading && <Loading />}
      {!loading && !error && items.length === 0 && <EmptyState message="No tasks found" />}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="row g-3">
            {items.map((t: any) => (
              <div className="col-md-6 col-xl-4" key={t.id}>
                <div className="card h-100">
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start mb-1">
                      <h6 className="card-title mb-0 fw-semibold">{t.title}</h6>
                      <PriorityBadge priority={t.priority} />
                    </div>
                    <p className="text-muted small mb-2">{t.description || 'No description'}</p>
                    <div className="small text-muted mb-2">
                      <i className="bi bi-person me-1" />{t.assignee_name || 'Unassigned'}
                      {t.due_date && <span className="ms-3"><i className="bi bi-calendar3 me-1" />{fmtDate(t.due_date)}{t.is_overdue && <span className="text-danger ms-1"><i className="bi bi-exclamation-triangle-fill" /> Overdue</span>}</span>}
                    </div>
                    <div className="d-flex justify-content-between align-items-center">
                      <Badge status={t.status} />
                      <div className="d-flex gap-1">
                        {canManage && t.status === 'todo' && <button className="btn btn-sm btn-outline-primary" onClick={() => setStatusItem(t, 'in_progress')}>Start</button>}
                        {t.status === 'in_progress' && <button className="btn btn-sm btn-outline-success" onClick={() => setStatusItem(t, 'completed')}>Complete</button>}
                        {canManage && t.status === 'completed' && <button className="btn btn-sm btn-outline-secondary" onClick={() => setStatusItem(t, 'verified')}>Verify</button>}
                        {canManage && <button className="btn btn-sm btn-outline-secondary" onClick={() => openEdit(t)}><i className="bi bi-pencil" /></button>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Pagination page={page} pages={data?.pages || 1} total={data?.total} onPage={setPage} />
        </>
      )}

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
                <option value="completed">Completed</option>
                <option value="verified">Verified</option>
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