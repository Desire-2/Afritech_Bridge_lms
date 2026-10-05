'use client';

import { useEffect, useState } from 'react';
import { useFetch, todayIso } from '@/lib/use-fetch';
import { api, can, fmtDate, fmtDateTime } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  PageHeader, Loading, ErrorAlert, EmptyState, Pagination, Badge, Modal,
} from '@/components/ui';
import { Field, TextInput, SelectInput, TextArea } from '@/components/form';
import { useEmployeeOptions, useOrgOptions, options } from '@/lib/use-options';
import { useQuickCreate, isQuickPatch } from '@/lib/quick-create';

const STATUSES = ['scheduled', 'in_progress', 'completed', 'cancelled'];
const ACTION_STATUSES = ['open', 'in_progress', 'done', 'cancelled'];

const EMPTY = {
  title: '', description: '', meeting_date: todayIso(), start_time: '', end_time: '',
  location: '', online_link: '', status: 'scheduled',
  department_id: '', branch_id: '', participant_ids: [] as number[],
};

// Links are stored as typed ("meet.google.com/…") — add a scheme when missing.
function joinHref(url: string): string {
  const v = (url || '').trim();
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

export default function MeetingsPage() {
  const { user } = useAuth();
  const canManage = can(user, 'meetings.manage');
  const { employees } = useEmployeeOptions();
  const { departments, branches } = useOrgOptions();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [mine, setMine] = useState(false);
  const { data, error, loading, reload } = useFetch('/api/meetings', [page, status, search, mine], {
    page, per_page: 15,
    status: status || undefined,
    search: search || undefined,
    mine: mine ? 'true' : undefined,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [acting, setActing] = useState(false);
  const [formError, setFormError] = useState('');
  const [actionError, setActionError] = useState('');

  const [detail, setDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [agendaTitle, setAgendaTitle] = useState('');
  const [minutes, setMinutes] = useState({ summary: '', discussion: '', decisions: '' });
  const [actionItem, setActionItem] = useState<any>({ title: '', responsible_id: '', deadline: '', description: '' });

  const items = data?.items || [];

  function set(key: string, value: any) {
    setForm((f: any) => ({ ...f, [key]: value }));
  }

  function openCreate(patch?: Record<string, any>) {
    setForm({ ...EMPTY, meeting_date: todayIso(), ...(isQuickPatch(patch) ? patch : {}) });
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
        title: form.title, meeting_date: form.meeting_date, status: form.status,
      };
      for (const k of ['description', 'location', 'online_link']) {
        if (form[k]) body[k] = form[k];
      }
      for (const k of ['start_time', 'end_time']) {
        if (form[k]) body[k] = form[k];
      }
      if (form.department_id) body.department_id = Number(form.department_id);
      if (form.branch_id) body.branch_id = Number(form.branch_id);
      if (form.participant_ids.length) body.participant_ids = form.participant_ids;
      await api('/api/meetings', { method: 'POST', body });
      setOpen(false);
      reload();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function loadDetail(id: number) {
    setDetailLoading(true);
    setActionError('');
    try {
      const d = await api(`/api/meetings/${id}`);
      const m = d.meeting || d;
      setDetail(m);
      setAgendaTitle('');
      setMinutes({
        summary: m.minutes?.[0]?.summary || '',
        discussion: m.minutes?.[0]?.discussion || '',
        decisions: m.minutes?.[0]?.decisions || '',
      });
      setActionItem({ title: '', responsible_id: '', deadline: '', description: '' });
    } catch (err: any) {
      setActionError(err.message);
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    // Close the detail drawer when the list errors out.
    if (error) setDetail(null);
  }, [error]);

  async function addAgendaItem(e: React.FormEvent) {
    e.preventDefault();
    if (!detail || !agendaTitle.trim() || acting) return;
    setActionError('');
    setActing(true);
    try {
      await api(`/api/meetings/${detail.id}/agenda`, { method: 'POST', body: { title: agendaTitle } });
      setAgendaTitle('');
      await loadDetail(detail.id);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActing(false);
    }
  }

  async function removeAgendaItem(itemId: number) {
    if (!detail || acting) return;
    setActionError('');
    setActing(true);
    try {
      await api(`/api/meetings/agenda/${itemId}`, { method: 'DELETE' });
      await loadDetail(detail.id);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActing(false);
    }
  }

  async function saveMinutes(e: React.FormEvent) {
    e.preventDefault();
    if (!detail) return;
    setBusy(true);
    setActionError('');
    try {
      const existing = detail.minutes?.[0];
      if (existing) {
        await api(`/api/meetings/minutes/${existing.id}`, { method: 'PUT', body: minutes });
      } else {
        await api(`/api/meetings/${detail.id}/minutes`, { method: 'POST', body: minutes });
      }
      await loadDetail(detail.id);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function addActionItem(e: React.FormEvent) {
    e.preventDefault();
    if (!detail || acting) return;
    setActionError('');
    setActing(true);
    try {
      const body: any = {
        title: actionItem.title, responsible_id: Number(actionItem.responsible_id),
      };
      if (actionItem.description) body.description = actionItem.description;
      if (actionItem.deadline) body.deadline = actionItem.deadline;
      await api(`/api/meetings/${detail.id}/action-items`, { method: 'POST', body });
      setActionItem({ title: '', responsible_id: '', deadline: '', description: '' });
      await loadDetail(detail.id);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActing(false);
    }
  }

  async function setActionItemStatus(itemId: number, next: string) {
    if (!detail || acting) return;
    setActionError('');
    setActing(true);
    try {
      await api(`/api/meetings/action-items/${itemId}`, { method: 'PUT', body: { status: next } });
      await loadDetail(detail.id);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActing(false);
    }
  }

  async function toggleAttendance(employeeId: number, attended: boolean) {
    if (!detail || acting) return;
    setActionError('');
    setActing(true);
    try {
      await api(`/api/meetings/${detail.id}/attendance`, {
        method: 'POST',
        body: { records: [{ employee_id: employeeId, attended }] },
      });
      await loadDetail(detail.id);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActing(false);
    }
  }

  async function setMeetingStatus(m: any, next: string) {
    setActionError('');
    try {
      await api(`/api/meetings/${m.id}`, { method: 'PUT', body: { status: next } });
      reload();
      if (detail?.id === m.id) await loadDetail(m.id);
    } catch (err: any) {
      setActionError(err.message);
    }
  }

  return (
    <div className="d-flex flex-column gap-3">
      <PageHeader
        eyebrow="Coordination"
        title="Meetings"
        subtitle="Schedule meetings, run the agenda, record minutes and track action items."
        actions={canManage && (
          <button className="btn btn-primary btn-sm" onClick={() => openCreate()}>
            <i className="bi bi-plus-lg me-1" />New meeting
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
            <label className="form-label small fw-semibold mb-1">Status</label>
            <SelectInput className="form-select form-control-sm" value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </SelectInput>
          </div>
          <div className="form-check ms-2 mb-2">
            <input className="form-check-input" type="checkbox" id="mineMeetings" checked={mine}
              onChange={(e) => { setMine(e.target.checked); setPage(1); }} />
            <label className="form-check-label small" htmlFor="mineMeetings">Meetings I'm in</label>
          </div>
        </div>
      </div>

      {loading && <Loading />}
      {error && <ErrorAlert message={error} onRetry={reload} />}
      {!loading && !error && items.length === 0 && (
        <EmptyState message="No meetings" icon="bi-people" />
      )}

      {items.length > 0 && (
        <div className="card">
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>Meeting</th>
                  <th>When</th>
                  <th>Where</th>
                  <th>Scope</th>
                  <th>Output</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((m: any) => (
                  <tr key={m.id} onClick={() => loadDetail(m.id)} style={{ cursor: 'pointer' }}>
                    <td>
                      <button type="button" className="btn btn-link p-0 fw-semibold text-start"
                        style={{ textDecoration: 'none', color: 'inherit' }}
                        onClick={(e) => { e.stopPropagation(); loadDetail(m.id); }}>
                        {m.title}
                      </button>
                      <div className="small text-muted">
                        {m.organizer ? `Organiser: ${m.organizer}` : ''}
                        {m.participant_count ? ` · ${m.participant_count} participants` : ''}
                        {m.online_link ? ' · Online' : ''}
                      </div>
                    </td>
                    <td className="text-nowrap">
                      {fmtDate(m.meeting_date)}
                      <div className="small text-muted">
                        {m.start_time || 'All day'}{m.end_time ? `–${m.end_time}` : ''}
                      </div>
                    </td>
                    <td className="small">{m.location || '—'}</td>
                    <td className="small">
                      {m.department || 'Company'}
                      {m.branch ? <div className="text-muted">{m.branch}</div> : null}
                    </td>
                    <td className="small text-nowrap">
                      {m.agenda_count} agenda · {m.action_item_count} actions
                    </td>
                    <td><Badge status={m.status} /></td>
                    <td className="text-end" onClick={(e) => e.stopPropagation()}>
                      <div className="btn-group btn-group-sm">
                        <button className="btn btn-outline-primary" title="Open details, agenda, minutes and actions"
                          onClick={() => loadDetail(m.id)}>
                          <i className="bi bi-journal-text" />
                        </button>
                        {m.online_link && m.status !== 'completed' && m.status !== 'cancelled' && (
                          <a className="btn btn-outline-success" title="Join meeting"
                            href={joinHref(m.online_link)} target="_blank" rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}>
                            <i className="bi bi-camera-video" />
                          </a>
                        )}
                        {canManage && m.status !== 'completed' && m.status !== 'cancelled' && (
                          <button className="btn btn-outline-success" title="Mark completed"
                            onClick={() => setMeetingStatus(m, 'completed')}>
                            <i className="bi bi-check2" />
                          </button>
                        )}
                        {canManage && m.status !== 'cancelled' && (
                          <button className="btn btn-outline-secondary" title="Cancel meeting"
                            onClick={() => setMeetingStatus(m, 'cancelled')}>
                            <i className="bi bi-x-circle" />
                          </button>
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

      <Modal show={open} title="New meeting" onClose={() => setOpen(false)} size="xl"
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy} onClick={create}>
              {busy ? 'Saving…' : 'Create meeting'}
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
                <TextInput type="date" value={form.meeting_date}
                  onChange={(e) => set('meeting_date', e.target.value)} required />
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
              <Field label="Location">
                <TextInput value={form.location} onChange={(e) => set('location', e.target.value)} />
              </Field>
            </div>
            <div className="col-6">
              <Field label="Online link">
                <TextInput value={form.online_link} onChange={(e) => set('online_link', e.target.value)} />
              </Field>
            </div>
          </div>
          <div className="row g-2">
            <div className="col-6">
              <Field label="Department" hint="Optional — narrows the meeting to one department.">
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
          <Field label="Participants" hint="Service Agents are not listed.">
            <SelectInput multiple size={6} value={form.participant_ids.map(String)}
              onChange={(e) => set('participant_ids',
                Array.from(e.target.selectedOptions).map((o) => Number(o.value)))}>
              {options(employees)}
            </SelectInput>
          </Field>
        </form>
      </Modal>

      <Modal show={!!detail} title={detail?.title || 'Meeting'} size="xl"
        onClose={() => setDetail(null)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setDetail(null)}>Close</button>
            {detail?.online_link && !detailLoading && (
              detail.status === 'completed' || detail.status === 'cancelled' ? (
                <a className="btn btn-outline-success" href={joinHref(detail.online_link)}
                  target="_blank" rel="noopener noreferrer">
                  <i className="bi bi-box-arrow-up-right me-1" />Open meeting link
                </a>
              ) : (
                <a className="btn btn-success" href={joinHref(detail.online_link)}
                  target="_blank" rel="noopener noreferrer">
                  <i className="bi bi-camera-video me-1" />Join meeting
                </a>
              )
            )}
          </>
        }>
        {detailLoading && <Loading />}
        {!detailLoading && detail && (
          <div className="d-flex flex-column gap-4">
            <div className="d-flex flex-wrap gap-3 small text-muted">
              <span><i className="bi bi-calendar3 me-1" />{fmtDate(detail.meeting_date)}</span>
              <span><i className="bi bi-clock me-1" />{detail.start_time || 'All day'}{detail.end_time ? `–${detail.end_time}` : ''}</span>
              {detail.location && <span><i className="bi bi-geo-alt me-1" />{detail.location}</span>}
              <span><i className="bi bi-person-badge me-1" />{detail.organizer || 'Organiser not set'}</span>
              {(detail.department || detail.branch) && (
                <span><i className="bi bi-diagram-3 me-1" />
                  {[detail.department, detail.branch].filter(Boolean).join(' · ')}
                </span>
              )}
              <Badge status={detail.status} />
            </div>

            {detail.online_link && (
              <div className="d-flex align-items-center gap-2 flex-wrap small">
                <span className="badge text-bg-success">
                  <i className="bi bi-camera-video me-1" />Online
                </span>
                <a href={joinHref(detail.online_link)} target="_blank" rel="noopener noreferrer"
                  className="text-break">{detail.online_link}</a>
              </div>
            )}

            {detail.description && (
              <div className="border-start border-primary ps-3">
                <h6 className="fw-semibold mb-1">Description</h6>
                <p className="mb-0 small" style={{ whiteSpace: 'pre-wrap' }}>{detail.description}</p>
              </div>
            )}

            <div>
              <h6 className="fw-semibold">Participants</h6>
              {(detail.participants || []).length === 0 ? (
                <p className="small text-muted mb-0">No participants.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm mb-0">
                    <thead><tr><th>Employee</th><th>Department</th><th>Response</th><th>Attendance</th></tr></thead>
                    <tbody>
                      {detail.participants.map((p: any) => (
                        <tr key={p.id}>
                          <td>{p.employee_name}</td>
                          <td className="small text-muted">{p.department || '—'}</td>
                          <td><Badge status={p.response} /></td>
                          <td>
                            {canManage ? (
                              <div className="form-check form-switch mb-0">
                                <input className="form-check-input" type="checkbox"
                                  id={`att-${p.employee_id}`} checked={!!p.attended} disabled={acting}
                                  onChange={(e) => toggleAttendance(p.employee_id, e.target.checked)} />
                                <label className="form-check-label small" htmlFor={`att-${p.employee_id}`}>
                                  {p.attended ? 'Present' : 'Absent'}
                                </label>
                              </div>
                            ) : (p.attended ? 'Present' : '—')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h6 className="fw-semibold">Agenda</h6>
              {(detail.agenda || []).length === 0 ? (
                <p className="small text-muted mb-0">Nothing on the agenda yet.</p>
              ) : (
                <ol className="mb-2 ps-3">
                  {detail.agenda.map((a: any) => (
                    <li key={a.id} className="d-flex justify-content-between align-items-start gap-2">
                      <span>
                        {a.title}
                        {a.presenter && <span className="small text-muted"> — {a.presenter}</span>}
                      </span>
                      {canManage && (
                        <button className="btn btn-sm btn-outline-danger flex-shrink-0" disabled={acting}
                          onClick={() => removeAgendaItem(a.id)} aria-label={`Remove ${a.title}`}>
                          <i className="bi bi-x" />
                        </button>
                      )}
                    </li>
                  ))}
                </ol>
              )}
              {canManage && (
                <form className="d-flex gap-2" onSubmit={addAgendaItem}>
                  <TextInput className="form-control form-control-sm" placeholder="Add an agenda item…"
                    value={agendaTitle} onChange={(e) => setAgendaTitle(e.target.value)} />
                  <button className="btn btn-sm btn-outline-primary" type="submit" disabled={!agendaTitle.trim() || acting}>
                    <i className="bi bi-plus-lg" />
                  </button>
                </form>
              )}
            </div>

            <div>
              <h6 className="fw-semibold">Minutes</h6>
              {canManage ? (
                <form onSubmit={saveMinutes} className="d-flex flex-column gap-2">
                  <TextArea rows={2} placeholder="Summary" value={minutes.summary}
                    onChange={(e) => setMinutes((m) => ({ ...m, summary: e.target.value }))} />
                  <TextArea rows={3} placeholder="Discussion" value={minutes.discussion}
                    onChange={(e) => setMinutes((m) => ({ ...m, discussion: e.target.value }))} />
                  <TextArea rows={2} placeholder="Decisions" value={minutes.decisions}
                    onChange={(e) => setMinutes((m) => ({ ...m, decisions: e.target.value }))} />
                  <div>
                    <button className="btn btn-sm btn-primary" disabled={busy}>
                      {detail.minutes?.[0] ? 'Update minutes' : 'Save minutes'}
                    </button>
                    {detail.minutes?.[0]?.recorded_at && (
                      <span className="small text-muted ms-2">
                        Recorded {fmtDateTime(detail.minutes[0].recorded_at)}
                      </span>
                    )}
                  </div>
                </form>
              ) : (detail.minutes?.[0] ? (
                <div className="small d-flex flex-column gap-1">
                  {detail.minutes[0].summary && <p className="mb-0">{detail.minutes[0].summary}</p>}
                  {detail.minutes[0].decisions && (
                    <p className="mb-0 text-muted">Decisions: {detail.minutes[0].decisions}</p>
                  )}
                </div>
              ) : <p className="small text-muted mb-0">No minutes recorded.</p>)}
            </div>

            <div>
              <h6 className="fw-semibold">Action items</h6>
              {(detail.action_items || []).length === 0 ? (
                <p className="small text-muted mb-2">No action items yet.</p>
              ) : (
                <div className="table-responsive mb-2">
                  <table className="table table-sm mb-0">
                    <thead>
                      <tr><th>Action</th><th>Responsible</th><th>Deadline</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {detail.action_items.map((a: any) => (
                        <tr key={a.id}>
                          <td>{a.title}</td>
                          <td className="text-nowrap">{a.responsible || '—'}</td>
                          <td className="text-nowrap">
                            {fmtDate(a.deadline)}
                            {a.is_overdue && <Badge status="overdue" />}
                          </td>
                          <td>
                            {canManage ? (
                              <SelectInput className="form-select form-select-sm" style={{ minWidth: 130 }}
                                disabled={acting}
                                value={a.status} onChange={(e) => setActionItemStatus(a.id, e.target.value)}>
                                {ACTION_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                              </SelectInput>
                            ) : <Badge status={a.status} />}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {canManage && (
                <form className="d-flex flex-column gap-2" onSubmit={addActionItem}>
                  <div className="d-flex flex-wrap gap-2">
                    <TextInput className="form-control form-control-sm" style={{ minWidth: 220 }}
                      placeholder="New action item…" value={actionItem.title}
                      onChange={(e) => setActionItem((a) => ({ ...a, title: e.target.value }))} />
                    <SelectInput className="form-select form-control-sm" style={{ minWidth: 180 }}
                      value={actionItem.responsible_id}
                      onChange={(e) => setActionItem((a) => ({ ...a, responsible_id: e.target.value }))}>
                      <option value="">Responsible…</option>
                      {options(employees)}
                    </SelectInput>
                    <TextInput type="date" className="form-control form-control-sm" style={{ minWidth: 150 }}
                      value={actionItem.deadline}
                      onChange={(e) => setActionItem((a) => ({ ...a, deadline: e.target.value }))} />
                    <button className="btn btn-sm btn-outline-primary" type="submit"
                      disabled={!actionItem.title || !actionItem.responsible_id || acting}>
                      <i className="bi bi-plus-lg me-1" />Add
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}