'use client';

import { useState } from 'react';
import { useFetch, todayIso } from '@/lib/use-fetch';
import { api, can, fmtDate } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  PageHeader, Loading, ErrorAlert, EmptyState, Pagination, Badge, Modal,
} from '@/components/ui';
import { Field, TextInput, SelectInput, TextArea } from '@/components/form';
import { useEmployeeOptions, useOrgOptions, options } from '@/lib/use-options';
import { useQuickCreate, isQuickPatch } from '@/lib/quick-create';

const STATUSES = ['planned', 'in_progress', 'completed', 'postponed', 'cancelled'];
const CATEGORIES = [
  'Administration', 'Meeting', 'Employee Coordination', 'Management Follow-up',
  'Documentation', 'Planning', 'Communication', 'Event',
  'Department Coordination', 'Branch Coordination', 'Other',
];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const EMPTY = {
  title: '', description: '', activity_date: todayIso(), start_time: '', end_time: '',
  category: 'Administration', priority: 'medium', location: '', expected_outcome: '',
  status: 'planned', scope: 'company', department_id: '', branch_id: '',
  notes: '', participant_ids: [] as number[],
};

/** Daily planner + weekly planner over company and personal activities. */
export default function ActivitiesPage() {
  const { user } = useAuth();
  const canManage = can(user, 'activities.manage');
  const { employees } = useEmployeeOptions();
  const { departments, branches } = useOrgOptions();

  const [view, setView] = useState<'day' | 'week' | 'list'>('day');
  const [date, setDate] = useState(todayIso());
  const [scope, setScope] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const params: any = { page, per_page: 20, search: search || undefined, status: status || undefined };
  if (view === 'day') {
    params.start = date;
    params.end = date;
  } else if (view === 'week') {
    params.start = date;
    params.end = shiftIsoFrom(date, 6);
  }
  if (scope) params.scope = scope;

  const { data, error, loading, reload } = useFetch('/api/activities',
    [view, date, scope, status, search, page], params);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY);
  const [checklistDraft, setChecklistDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [actionError, setActionError] = useState('');

  const [acting, setActing] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);
  const [checklistTitle, setChecklistTitle] = useState('');

  const items = data?.items || [];

  function set(key: string, value: any) {
    setForm((f: any) => ({ ...f, [key]: value }));
  }

  function openCreate(patch?: Record<string, any>) {
    setForm({ ...EMPTY, activity_date: view === 'list' ? todayIso() : date, ...(isQuickPatch(patch) ? patch : {}) });
    setChecklistDraft('');
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
        title: form.title, activity_date: form.activity_date, category: form.category,
        priority: form.priority, status: form.status, scope: form.scope,
      };
      for (const k of ['description', 'location', 'expected_outcome', 'notes']) {
        if (form[k]) body[k] = form[k];
      }
      for (const k of ['start_time', 'end_time']) {
        if (form[k]) body[k] = form[k];
      }
      if (form.department_id) body.department_id = Number(form.department_id);
      if (form.branch_id) body.branch_id = Number(form.branch_id);
      if (form.participant_ids.length) body.participant_ids = form.participant_ids;
      // The checklist textarea is one item per line; blank lines are dropped.
      const checklist = checklistDraft.split('\n').map((l) => l.trim()).filter(Boolean);
      if (checklist.length) body.checklist = checklist;
      await api('/api/activities', { method: 'POST', body });
      setOpen(false);
      reload();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function loadDetail(id: number) {
    setActionError('');
    try {
      const d = await api(`/api/activities/${id}`);
      setDetail(d.activity || d);
      setChecklistTitle('');
    } catch (err: any) {
      setActionError(err.message);
      setDetail(null);
    }
  }

  async function applyStatus(a: any, next: string) {
    setActionError('');
    try {
      await api(`/api/activities/${a.id}`, { method: 'PUT', body: { status: next } });
      reload();
      if (detail?.id === a.id) await loadDetail(a.id);
    } catch (err: any) {
      setActionError(err.message);
    }
  }

  async function addChecklistItem(e: React.FormEvent) {
    e.preventDefault();
    if (!detail || !checklistTitle.trim() || acting) return;
    setActionError('');
    setActing(true);
    try {
      await api(`/api/activities/${detail.id}/checklist`, {
        method: 'POST', body: { title: checklistTitle },
      });
      setChecklistTitle('');
      await loadDetail(detail.id);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActing(false);
    }
  }

  async function toggleChecklistItem(item: any, isDone: boolean) {
    if (!detail || acting) return;
    setActionError('');
    setActing(true);
    try {
      await api(`/api/activities/checklist/${item.id}`, { method: 'PUT', body: { is_done: isDone } });
      await loadDetail(detail.id);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActing(false);
    }
  }

  async function removeChecklistItem(itemId: number) {
    if (!detail || acting) return;
    setActionError('');
    setActing(true);
    try {
      await api(`/api/activities/checklist/${itemId}`, { method: 'DELETE' });
      await loadDetail(detail.id);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActing(false);
    }
  }

  return (
    <div className="d-flex flex-column gap-3">
      <PageHeader
        eyebrow="Coordination"
        title="Activities"
        subtitle="Daily and weekly planner for company and personal activities."
        actions={canManage && (
          <button className="btn btn-primary btn-sm" onClick={() => openCreate()}>
            <i className="bi bi-plus-lg me-1" />New activity
          </button>
        )}
      />

      {actionError && <ErrorAlert message={actionError} />}

      <div className="card">
        <div className="card-body d-flex flex-wrap align-items-end gap-2">
          <div className="btn-group btn-group-sm">
            {([['day', 'Day'], ['week', 'Week'], ['list', 'All']] as const).map(([key, label]) => (
              <button key={key} type="button"
                className={`btn ${view === key ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => { setView(key); setPage(1); }}>
                {label}
              </button>
            ))}
          </div>
          {view !== 'list' && (
            <div className="d-flex align-items-center gap-1">
              <button className="btn btn-sm btn-outline-secondary"
                onClick={() => setDate(shiftIsoFrom(date, view === 'week' ? -7 : -1))}
                aria-label="Previous">
                <i className="bi bi-chevron-left" />
              </button>
              <TextInput type="date" className="form-control form-control-sm" value={date}
                onChange={(e) => { setDate(e.target.value); setPage(1); }} />
              <button className="btn btn-sm btn-outline-secondary"
                onClick={() => setDate(shiftIsoFrom(date, view === 'week' ? 7 : 1))}
                aria-label="Next">
                <i className="bi bi-chevron-right" />
              </button>
              <button className="btn btn-sm btn-outline-secondary" onClick={() => { setDate(todayIso()); setPage(1); }}>
                Today
              </button>
            </div>
          )}
          <div style={{ minWidth: 180 }}>
            <label className="form-label small fw-semibold mb-1">Search</label>
            <TextInput className="form-control form-control-sm" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <div>
            <label className="form-label small fw-semibold mb-1">Scope</label>
            <SelectInput className="form-select form-control-sm" value={scope}
              onChange={(e) => { setScope(e.target.value); setPage(1); }}>
              <option value="">Company + mine</option>
              <option value="company">Company only</option>
              <option value="personal">My planner only</option>
            </SelectInput>
          </div>
          <div>
            <label className="form-label small fw-semibold mb-1">Status</label>
            <SelectInput className="form-select form-control-sm" value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </SelectInput>
          </div>
        </div>
      </div>

      {loading && <Loading />}
      {error && <ErrorAlert message={error} onRetry={reload} />}
      {!loading && !error && items.length === 0 && (
        <EmptyState
          message={view === 'day' ? 'Nothing planned for this day' : 'No activities found'}
          icon="bi-clipboard-check" />
      )}

      {items.length > 0 && (
        <div className="d-flex flex-column gap-2">
          {items.map((a: any) => (
            <div className="card" key={a.id}>
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
                  <div className="min-w-0">
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <span className="fw-semibold">{a.title}</span>
                      <Badge status={a.status} />
                      {a.scope === 'personal'
                        ? <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle">my planner</span>
                        : null}
                    </div>
                    <div className="small text-muted mt-1">
                      {fmtDate(a.activity_date)}
                      {a.start_time ? ` · ${a.start_time}${a.end_time ? `–${a.end_time}` : ''}` : ''}
                      {a.location ? ` · ${a.location}` : ''}
                      {a.category ? ` · ${a.category}` : ''}
                      {a.organizer ? ` · ${a.organizer}` : ''}
                    </div>
                    {a.expected_outcome && (
                      <div className="small text-muted mt-1">
                        <i className="bi bi-bullseye me-1" />{a.expected_outcome}
                      </div>
                    )}
                    {a.checklist_total > 0 && (
                      <div className="small mt-1">
                        <i className="bi bi-list-check me-1" />
                        {a.checklist_done}/{a.checklist_total} checklist done
                      </div>
                    )}
                  </div>
                  <div className="d-flex gap-1 flex-shrink-0">
                    {canManage && a.status === 'planned' && (
                      <button className="btn btn-sm btn-outline-primary" title="Start"
                        onClick={() => applyStatus(a, 'in_progress')}>
                        <i className="bi bi-play-fill" />
                      </button>
                    )}
                    {canManage && a.status === 'in_progress' && (
                      <button className="btn btn-sm btn-outline-success" title="Complete"
                        onClick={() => applyStatus(a, 'completed')}>
                        <i className="bi bi-check2" />
                      </button>
                    )}
                    <button className="btn btn-sm btn-outline-secondary" title="Checklist and participants"
                      onClick={() => loadDetail(a.id)}>
                      <i className="bi bi-journal-check" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'list' && <Pagination page={page} pages={data?.pages || 1} onPage={setPage} total={data?.total} />}

      <Modal show={open} title="New activity" onClose={() => setOpen(false)} size="xl"
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy} onClick={create}>
              {busy ? 'Saving…' : 'Create activity'}
            </button>
          </>
        }>
        <form onSubmit={create}>
          {formError && <ErrorAlert message={formError} />}
          <Field label="Title" required>
            <TextInput value={form.title} onChange={(e) => set('title', e.target.value)} required />
          </Field>
          <Field label="Description">
            <TextArea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
          <div className="row g-2">
            <div className="col-4">
              <Field label="Date" required>
                <TextInput type="date" value={form.activity_date}
                  onChange={(e) => set('activity_date', e.target.value)} required />
              </Field>
            </div>
            <div className="col-4">
              <Field label="Start time">
                <TextInput type="time" value={form.start_time} onChange={(e) => set('start_time', e.target.value)} />
              </Field>
            </div>
            <div className="col-4">
              <Field label="End time">
                <TextInput type="time" value={form.end_time} onChange={(e) => set('end_time', e.target.value)} />
              </Field>
            </div>
          </div>
          <div className="row g-2">
            <div className="col-6">
              <Field label="Category">
                <SelectInput value={form.category} onChange={(e) => set('category', e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
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
              <Field label="Scope" hint="Personal activities are private to you.">
                <SelectInput value={form.scope} onChange={(e) => set('scope', e.target.value)}>
                  <option value="company">Company</option>
                  <option value="personal">My personal planner</option>
                </SelectInput>
              </Field>
            </div>
            <div className="col-6">
              <Field label="Location">
                <TextInput value={form.location} onChange={(e) => set('location', e.target.value)} />
              </Field>
            </div>
          </div>
          <div className="row g-2">
            <div className="col-6">
              <Field label="Department">
                <SelectInput value={form.department_id} onChange={(e) => set('department_id', e.target.value)}>
                  <option value="">Whole company</option>
                  {options(departments)}
                </SelectInput>
              </Field>
            </div>
            <div className="col-6">
              <Field label="Branch">
                <SelectInput value={form.branch_id} onChange={(e) => set('branch_id', e.target.value)}>
                  <option value="">All branches</option>
                  {options(branches)}
                </SelectInput>
              </Field>
            </div>
          </div>
          <Field label="Expected outcome">
            <TextArea rows={2} value={form.expected_outcome}
              onChange={(e) => set('expected_outcome', e.target.value)} />
          </Field>
          <Field label="Checklist" hint="One item per line.">
            <TextArea rows={3} value={checklistDraft}
              onChange={(e) => setChecklistDraft(e.target.value)}
              placeholder={'Confirm venue\nPrint agenda\nNotify attendees'} />
          </Field>
          <Field label="Participants" hint="Service Agents are not listed.">
            <SelectInput multiple size={5} value={form.participant_ids.map(String)}
              onChange={(e) => set('participant_ids',
                Array.from(e.target.selectedOptions).map((o) => Number(o.value)))}>
              {options(employees)}
            </SelectInput>
          </Field>
        </form>
      </Modal>

      <Modal show={!!detail} title={detail?.title || 'Activity'} onClose={() => setDetail(null)}
        footer={<button className="btn btn-outline-secondary" onClick={() => setDetail(null)}>Close</button>}>
        {detail && (
          <div className="d-flex flex-column gap-3">
            <div className="small text-muted d-flex flex-wrap gap-3">
              <span>{fmtDate(detail.activity_date)}</span>
              {detail.start_time && <span>{detail.start_time}{detail.end_time ? `–${detail.end_time}` : ''}</span>}
              {detail.location && <span>{detail.location}</span>}
              <Badge status={detail.status} />
            </div>

            <div>
              <h6 className="fw-semibold">Checklist</h6>
              {(detail.checklist || []).length === 0 ? (
                <p className="small text-muted mb-2">No checklist items.</p>
              ) : (
                <ul className="list-group list-group-flush mb-2">
                  {detail.checklist.map((c: any) => (
                    <li key={c.id} className="list-group-item px-0 d-flex justify-content-between align-items-center gap-2">
                      <div className="form-check mb-0">
                        <input className="form-check-input" type="checkbox" id={`cl-${c.id}`}
                          checked={!!c.is_done} disabled={!canManage || acting}
                          onChange={(e) => toggleChecklistItem(c, e.target.checked)} />
                        <label className={`form-check-label small ${c.is_done ? 'text-decoration-line-through text-muted' : ''}`}
                          htmlFor={`cl-${c.id}`}>
                          {c.title}
                        </label>
                      </div>
                      {canManage && (
                        <button className="btn btn-sm btn-outline-danger" disabled={acting}
                          onClick={() => removeChecklistItem(c.id)} aria-label={`Remove ${c.title}`}>
                          <i className="bi bi-x" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {canManage && (
                <form className="d-flex gap-2" onSubmit={addChecklistItem}>
                  <TextInput className="form-control form-control-sm" placeholder="Add a checklist item…"
                    value={checklistTitle} onChange={(e) => setChecklistTitle(e.target.value)} />
                  <button className="btn btn-sm btn-outline-primary" type="submit" disabled={!checklistTitle.trim() || acting}>
                    <i className="bi bi-plus-lg" />
                  </button>
                </form>
              )}
            </div>

            <div>
              <h6 className="fw-semibold">Participants</h6>
              {(detail.participants || []).length === 0 ? (
                <p className="small text-muted mb-0">No participants.</p>
              ) : (
                <div className="d-flex flex-wrap gap-1">
                  {detail.participants.map((p: any) => (
                    <span key={p.id} className="badge bg-light text-body border">
                      {p.employee_name}{p.department ? ` · ${p.department}` : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {detail.notes && (
              <div>
                <h6 className="fw-semibold">Notes</h6>
                <p className="small mb-0">{detail.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function shiftIsoFrom(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}