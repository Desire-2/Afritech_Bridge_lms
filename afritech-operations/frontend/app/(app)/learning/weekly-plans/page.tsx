'use client';

import { useState } from 'react';
import { useFetch, todayIso } from '@/lib/use-fetch';
import { api, fmtDate } from '@/lib/api';
import { PageHeader, Loading, ErrorAlert, EmptyState, Pagination, Badge, Modal, ConfirmDialog } from '@/components/ui';
import { Field, TextInput, SelectInput, TextArea } from '@/components/form';

function weekStartIso(): string {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

function weekEndIso(): string {
  const d = new Date(weekStartIso());
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

export default function WeeklyPlansPage() {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useFetch('/api/instructors/weekly-plans/list', [page], { page, per_page: 15 });
  const [instructors, setInstructors] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ week_start: weekStartIso(), week_end: weekEndIso(), instructor_id: '', title: '', note: '', activities: [] });
  const [busy, setBusy] = useState(false);
  const [error2, setError2] = useState('');
  const [editActivity, setEditActivity] = useState<any | null>(null);
  const [actForm, setActForm] = useState<any>({});

  const items = data?.items || [];

  async function loadRefs() {
    const [i, c, co] = await Promise.all([
      api('/api/instructors?per_page=500').catch(() => ({ items: [] })),
      api('/api/instructors/courses/list').catch(() => ({ courses: [] })),
      api('/api/instructors/cohorts/list?per_page=500').catch(() => ({ items: [] })),
    ]);
    setInstructors(i.items || []);
    setCourses(c.courses || []);
    setCohorts(co.items || []);
  }

  async function openCreate() {
    setError2('');
    await loadRefs();
    setEditPlan(null);
    setForm({ week_start: weekStartIso(), week_end: weekEndIso(), instructor_id: '', title: '', note: '', activities: [{ activity_date: todayIso(), activity: '', course_id: '', cohort_id: '', module: '', lesson: '', expected_outcome: '', duration_hours: 2 }] });
    setOpen(true);
  }

  async function openActivities(plan: any) {
    setError2('');
    await loadRefs();
    setEditPlan(plan);
    setOpen(true);
  }

  async function refreshPlan() {
    if (!editPlan) return;
    const d: any = await api('/api/instructors/weekly-plans/list?per_page=500').catch(() => ({ items: [] }));
    const found = (d.items || []).find((p: any) => p.id === editPlan.id);
    if (found) setEditPlan(found);
  }

  function set<K extends keyof typeof form>(key: K, value: any) { setForm((f) => ({ ...f, [key]: value })); }

  function setAct(idx: number, key: string, value: any) {
    setForm((f) => {
      const acts = f.activities.map((a: any, i: number) => (i === idx ? { ...a, [key]: value } : a));
      return { ...f, activities: acts };
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError2('');
    try {
      if (editPlan) {
        await api(`/api/instructors/weekly-plans/${editPlan.id}`, { method: 'PUT', body: { title: form.title, note: form.note || undefined } });
      } else {
        const body: any = {
          week_start: form.week_start,
          week_end: form.week_end,
          instructor_id: form.instructor_id ? Number(form.instructor_id) : undefined,
          title: form.title || undefined,
          note: form.note || undefined,
          activities: form.activities.filter((a: any) => a.activity).map((a: any) => ({
            activity_date: a.activity_date,
            activity: a.activity,
            course_id: a.course_id ? Number(a.course_id) : undefined,
            cohort_id: a.cohort_id ? Number(a.cohort_id) : undefined,
            module: a.module || undefined,
            lesson: a.lesson || undefined,
            expected_outcome: a.expected_outcome || undefined,
            duration_hours: a.duration_hours ? Number(a.duration_hours) : undefined,
          })),
        };
        await api('/api/instructors/weekly-plans', { method: 'POST', body });
      }
      setOpen(false);
      reload();
    } catch (err: any) {
      setError2(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function openActEditor(act: any) {
    setActForm({
      status: act.status,
      module: act.module || '',
      lesson: act.lesson || '',
      activity: act.activity || '',
      description: act.description || '',
      expected_outcome: act.expected_outcome || '',
      duration_hours: act.duration_hours ?? '',
      notes: act.notes || '',
      activity_date: act.activity_date || todayIso(),
    });
    setError2('');
    setEditActivity(act);
  }

  async function saveActivity(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError2('');
    try {
      const body: any = { status: actForm.status };
      if (editPlan) {
        if (actForm.module !== '') body.module = actForm.module;
        if (actForm.lesson !== '') body.lesson = actForm.lesson;
        if (actForm.activity !== '') body.activity = actForm.activity;
        if (actForm.description !== '') body.description = actForm.description;
        if (actForm.expected_outcome !== '') body.expected_outcome = actForm.expected_outcome;
        if (actForm.notes !== '') body.notes = actForm.notes;
        if (actForm.duration_hours !== '') body.duration_hours = Number(actForm.duration_hours);
        if (actForm.activity_date) body.activity_date = actForm.activity_date;
        await api(`/api/instructors/weekly-plans/${editPlan.id}/activities/${editActivity.id}`, { method: 'PUT', body });
      }
      setEditActivity(null);
      reload();
      await refreshPlan();
    } catch (err: any) {
      setError2(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function changePlanStatus(status: string) {
    if (!editPlan) return;
    await api(`/api/instructors/weekly-plans/${editPlan.id}`, { method: 'PUT', body: { status } });
    reload();
    await refreshPlan();
  }

  return (
    <div>
      <PageHeader title="Weekly Plans" subtitle="Instructor weekly lesson planning"
        actions={<button className="btn btn-primary" onClick={openCreate}><i className="bi bi-plus-circle me-1" /> New weekly plan</button>} />

      {error && <ErrorAlert message={error} onRetry={reload} />}
      {loading && <Loading />}
      {!loading && !error && items.length === 0 && <EmptyState message="No weekly plans yet" />}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="card">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr><th>Title</th><th>Instructor</th><th>Week</th><th className="text-center">Activities</th><th className="text-center">Progress</th><th>Status</th><th /></tr>
                </thead>
                <tbody>
                  {items.map((p: any) => (
                    <tr key={p.id}>
                      <td className="fw-semibold">{p.title || `${fmtDate(p.week_start)} → ${fmtDate(p.week_end)}`}</td>
                      <td>{p.instructor_name}</td>
                      <td>{fmtDate(p.week_start)} → {fmtDate(p.week_end)}</td>
                      <td className="text-center">{p.completed_count}/{p.activity_count}</td>
                      <td className="text-center">
                        <div className="progress" style={{ height: 6, width: 90, margin: '0 auto' }}>
                          <div className="progress-bar bg-success" style={{ width: `${p.progress_percent}%` }} />
                        </div>
                        <span className="small text-muted">{p.progress_percent}%</span>
                      </td>
                      <td><Badge status={p.status} /></td>
                      <td className="text-end">
                        <button className="btn btn-sm btn-outline-primary" onClick={() => openActivities(p)}><i className="bi bi-list-check me-1" /> Manage</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination page={page} pages={data?.pages || 1} total={data?.total} onPage={setPage} />
        </>
      )}

      <Modal show={open} title={editPlan ? `Manage plan — ${fmtDate(editPlan.week_start)} → ${fmtDate(editPlan.week_end)}` : 'New weekly plan'} onClose={() => setOpen(false)} size="xl"
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setOpen(false)}>Close</button>
            {editPlan && (
              <>
                <div className="me-auto">
                  {editPlan.status !== 'completed' && <button className="btn btn-sm btn-outline-success me-1" onClick={() => changePlanStatus('completed')}>Mark completed</button>}
                  {editPlan.status === 'planned' && <button className="btn btn-sm btn-outline-primary" onClick={() => changePlanStatus('in_progress')}>Start</button>}
                </div>
              </>
            )}
            <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : editPlan ? 'Save changes' : 'Create plan'}</button>
          </>
        }
      >
        {error2 && <div className="alert alert-danger py-2 small">{error2}</div>}
        <form onSubmit={save}>
          {!editPlan ? (
            <div className="row">
              <div className="col-md-6">
                <Field label="Week start" required><TextInput type="date" value={form.week_start} onChange={(e) => set('week_start', e.target.value)} required /></Field>
              </div>
              <div className="col-md-6">
                <Field label="Week end" required><TextInput type="date" value={form.week_end} onChange={(e) => set('week_end', e.target.value)} required /></Field>
              </div>
            </div>
          ) : (
            <div className="alert alert-info small">Plan progress: {editPlan.progress_percent}% · status: <Badge status={editPlan.status} /></div>
          )}

          <div className="row">
            <div className="col-md-6">
              <Field label="Instructor" required={!editPlan}>
                {editPlan
                  ? <TextInput value={editPlan.instructor_name} disabled />
                  : (
                    <SelectInput value={form.instructor_id} onChange={(e) => set('instructor_id', e.target.value)} required>
                      <option value="">Select instructor…</option>
                      {instructors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </SelectInput>
                  )}
              </Field>
            </div>
            <div className="col-md-6">
              <Field label="Title"><TextInput value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Excel fundamentals week" /></Field>
            </div>
          </div>
          <Field label="Note"><TextArea value={form.note} onChange={(e) => set('note', e.target.value)} rows={2} /></Field>
        </form>

        {!editPlan && (
          <>
            <hr />
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="fw-semibold mb-0">Activities</h6>
              <button className="btn btn-sm btn-outline-primary" onClick={() => setForm((f) => ({ ...f, activities: [...f.activities, { activity_date: todayIso(), activity: '', course_id: '', cohort_id: '', module: '', lesson: '', expected_outcome: '', duration_hours: 2 }] }))}>
                <i className="bi bi-plus-lg me-1" /> Add activity
              </button>
            </div>
            {form.activities.map((a: any, idx: number) => (
              <div className="border rounded-3 p-3 mb-2 bg-light-subtle" key={idx}>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="small fw-semibold">Activity {idx + 1}</span>
                  {form.activities.length > 1 && (
                    <button className="btn btn-sm btn-link text-danger" onClick={() => setForm((f) => ({ ...f, activities: f.activities.filter((_: any, i: number) => i !== idx) }))}>Remove</button>
                  )}
                </div>
                <div className="row">
                  <div className="col-md-4"><Field label="Activity / lesson"><TextInput required value={a.activity} onChange={(e) => setAct(idx, 'activity', e.target.value)} placeholder="e.g. Teach SUM formulas" /></Field></div>
                  <div className="col-md-4"><Field label="Date"><TextInput type="date" value={a.activity_date} onChange={(e) => setAct(idx, 'activity_date', e.target.value)} /></Field></div>
                  <div className="col-md-4"><Field label="Duration (hours)"><TextInput type="number" step="0.5" min="0" value={a.duration_hours} onChange={(e) => setAct(idx, 'duration_hours', e.target.value)} /></Field></div>
                </div>
                <div className="row">
                  <div className="col-md-4">
                    <Field label="Module">
                      <SelectInput value={a.course_id} onChange={(e) => setAct(idx, 'course_id', e.target.value)}>
                        <option value="">Select course…</option>
                        {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </SelectInput>
                    </Field>
                  </div>
                  <div className="col-md-4">
                    <Field label="Cohort">
                      <SelectInput value={a.cohort_id} onChange={(e) => setAct(idx, 'cohort_id', e.target.value)}>
                        <option value="">Select cohort…</option>
                        {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </SelectInput>
                    </Field>
                  </div>
                  <div className="col-md-4"><Field label="Expected outcome"><TextInput value={a.expected_outcome} onChange={(e) => setAct(idx, 'expected_outcome', e.target.value)} /></Field></div>
                </div>
              </div>
            ))}
          </>
        )}

        {editPlan && editPlan.activities_details && (
          <div className="table-responsive">
            <table className="table table-sm mb-0">
              <thead><tr><th>Date</th><th>Lesson</th><th>Course/Cohort</th><th>Status</th><th /></tr></thead>
              <tbody>
                {editPlan.activities_details.map((act: any) => (
                  <tr key={act.id}>
                    <td>{fmtDate(act.activity_date)}</td>
                    <td>{act.lesson || act.activity}</td>
                    <td className="small text-muted">{act.course_name || '—'} / {act.cohort_name || '—'}</td>
                    <td><Badge status={act.status} /></td>
                    <td className="text-end"><button className="btn btn-sm btn-outline-secondary" onClick={() => openActEditor(act)}>Update</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <Modal show={!!editActivity} title="Update activity" onClose={() => setEditActivity(null)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setEditActivity(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveActivity} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        {error2 && <div className="alert alert-danger py-2 small">{error2}</div>}
        <form onSubmit={saveActivity}>
          <Field label="Status">
            <SelectInput value={actForm.status} onChange={(e) => setActForm((f) => ({ ...f, status: e.target.value }))}>
              <option value="planned">Planned</option>
              <option value="done">Done</option>
              <option value="cancelled">Cancelled</option>
              <option value="missed">Missed</option>
            </SelectInput>
          </Field>
          <Field label="Module"><TextInput value={actForm.module} onChange={(e) => setActForm((f) => ({ ...f, module: e.target.value }))} /></Field>
          <Field label="Lesson"><TextInput value={actForm.lesson} onChange={(e) => setActForm((f) => ({ ...f, lesson: e.target.value }))} /></Field>
          <Field label="Notes"><TextArea value={actForm.notes} onChange={(e) => setActForm((f) => ({ ...f, notes: e.target.value }))} rows={2} /></Field>
        </form>
      </Modal>

      <ConfirmDialog
        show={editPlan?.showStatus}
        title="Mark plan completed"
        message="Mark this weekly plan as completed?"
        confirmLabel="Complete"
        onConfirm={async () => { await changePlanStatus('completed'); }}
        onClose={() => setEditPlan((p: any) => p ? { ...p, showStatus: false } : p)}
      />
    </div>
  );
}