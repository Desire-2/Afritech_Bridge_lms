'use client';

import { useState } from 'react';
import { useFetch, todayIso } from '@/lib/use-fetch';
import { api, fmtDate, can } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PageHeader, Loading, ErrorAlert, EmptyState, Pagination, Badge, Modal, ConfirmDialog } from '@/components/ui';
import { Field, TextInput, SelectInput, TextArea } from '@/components/form';

// Local (not UTC) ISO day helpers — toISOString() formats the UTC calendar day,
// so anywhere the local date differs from UTC the week would land one day off
// the one shown on screen.
function toLocalIso(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toLocalIso(d);
}

function weekStartIso(): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toLocalIso(d);
}

function weekEndIso(): string {
  return addDaysIso(weekStartIso(), 6);
}

export default function WeeklyPlansPage() {
  const { user } = useAuth();
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

  // `GET /api/instructors` is the instructor *directory* and needs
  // instructors.view — a permission the Instructor role deliberately does not
  // hold (the endpoint is row-scoped and tested as forbidden for them). An
  // instructor only ever plans for themselves, so the picker is skipped here and
  // their own profile is selected from /api/auth/me instead.
  const canPickInstructor = can(user, 'instructors.view');
  const canWritePlans = can(user, 'weekly_plans.manage') || can(user, 'instructors.manage');
  // Own instructor profile, shipped by User.to_dict() so the form can
  // auto-select it without a directory request the Instructor cannot make.
  const myInstructorId = user?.instructor_id ?? '';
  const myInstructorName = user?.instructor_name || user?.employee_name || '';

  async function loadRefs() {
    const [i, c, co] = await Promise.all([
      canPickInstructor
        ? api('/api/instructors?per_page=500').catch(() => ({ items: [] }))
        : Promise.resolve({ items: [] }),
      api('/api/instructors/courses/list').catch(() => ({ courses: [] })),
      api('/api/instructors/cohorts/list?per_page=500').catch(() => ({ items: [] })),
    ]);
    setInstructors(i.items || []);
    setCourses(c.courses || []);
    setCohorts(co.items || []);
  }

  function emptyActivity(date: string) {
    return { activity_date: date, activity: '', course_id: '', cohort_id: '', module: '', lesson: '', expected_outcome: '', duration_hours: 2 };
  }

  async function openCreate() {
    setError2('');
    await loadRefs();
    setEditPlan(null);
    setForm({
      week_start: weekStartIso(),
      week_end: weekEndIso(),
      instructor_id: myInstructorId ? String(myInstructorId) : '',
      title: '',
      note: '',
      activities: [emptyActivity(weekStartIso())],
    });
    setOpen(true);
  }

  async function openActivities(plan: any) {
    setError2('');
    await loadRefs();
    // Seed the form from the plan — previously it stayed empty and "Save
    // changes" posted title: '' and wiped the plan's title.
    setForm({
      week_start: plan.week_start,
      week_end: plan.week_end,
      instructor_id: plan.instructor_id ? String(plan.instructor_id) : '',
      title: plan.title || '',
      note: plan.note || '',
      activities: [],
    });
    setEditPlan(plan);
    setOpen(true);
  }

  async function refreshPlan() {
    if (!editPlan) return;
    const d: any = await api('/api/instructors/weekly-plans/list?per_page=500').catch(() => ({ items: [] }));
    const found = (d.items || []).find((p: any) => p.id === editPlan.id);
    if (found) setEditPlan({ ...found, showStatus: editPlan.showStatus });
  }

  function set<K extends keyof typeof form>(key: K, value: any) { setForm((f) => ({ ...f, [key]: value })); }

  function setWeekStart(value: string) {
    if (!value) return;
    setForm((f) => {
      const week_end = addDaysIso(value, 6);
      return {
        ...f,
        week_start: value,
        week_end,
        // keep every row inside the week the backend now validates
        activities: f.activities.map((a: any) =>
          a.activity_date && a.activity_date >= value && a.activity_date <= week_end
            ? a : { ...a, activity_date: value }),
      };
    });
  }

  function setAct(idx: number, key: string, value: any) {
    setForm((f) => {
      const acts = f.activities.map((a: any, i: number) => (i === idx ? { ...a, [key]: value } : a));
      return { ...f, activities: acts };
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canWritePlans) {
      setError2('You do not have permission to manage weekly plans.');
      return;
    }
    setBusy(true);
    setError2('');
    try {
      if (editPlan) {
        await api(`/api/instructors/weekly-plans/${editPlan.id}`, { method: 'PUT', body: { title: form.title, note: form.note || undefined } });
        setOpen(false);
        reload();
        await refreshPlan();
        return;
      }
      if (!form.week_start || !form.week_end) throw new Error('Week start and week end are required.');
      if (form.week_end < form.week_start) throw new Error('Week end cannot be before week start.');
      const instructorId = form.instructor_id || (myInstructorId ? String(myInstructorId) : '');
      const dupe = items.find((p: any) =>
        p.week_start === form.week_start && String(p.instructor_id ?? '') === String(instructorId));
      if (dupe) throw new Error('A plan already exists for that instructor and that week — use Manage to edit it.');
      const partial = form.activities.some((a: any) => !a.activity &&
        (a.course_id || a.cohort_id || a.module || a.lesson || a.expected_outcome || (a.duration_hours !== '' && a.duration_hours != null)));
      if (partial) throw new Error('Each activity needs an activity description.');
      for (const a of form.activities) {
        if (!a.activity) continue;
        if (!a.activity_date) throw new Error('Each activity needs a date.');
        if (a.activity_date < form.week_start || a.activity_date > form.week_end) {
          throw new Error(`Activity dates must fall inside ${fmtDate(form.week_start)} → ${fmtDate(form.week_end)}.`);
        }
        if (a.duration_hours !== '' && a.duration_hours != null && !Number.isFinite(Number(a.duration_hours))) {
          throw new Error('Duration must be a number.');
        }
      }
      const body: any = {
        week_start: form.week_start,
        week_end: form.week_end,
        instructor_id: instructorId ? Number(instructorId) : undefined,
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
          duration_hours: a.duration_hours === '' || a.duration_hours == null ? undefined : Number(a.duration_hours),
        })),
      };
      await api('/api/instructors/weekly-plans', { method: 'POST', body });
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
      if (!actForm.activity || !String(actForm.activity).trim()) throw new Error('An activity description is required.');
      if (!actForm.activity_date) throw new Error('An activity date is required.');
      if (editPlan && (actForm.activity_date < editPlan.week_start || actForm.activity_date > editPlan.week_end)) {
        throw new Error(`The date must fall inside ${fmtDate(editPlan.week_start)} → ${fmtDate(editPlan.week_end)}.`);
      }
      if (actForm.duration_hours !== '' && actForm.duration_hours != null && !Number.isFinite(Number(actForm.duration_hours))) {
        throw new Error('Duration must be a number.');
      }
      // Send every field as typed so blanks actually clear the column.
      const body: any = {
        status: actForm.status,
        module: actForm.module,
        lesson: actForm.lesson,
        activity: actForm.activity,
        description: actForm.description,
        expected_outcome: actForm.expected_outcome,
        notes: actForm.notes,
        activity_date: actForm.activity_date,
        duration_hours: actForm.duration_hours === '' || actForm.duration_hours == null ? undefined : Number(actForm.duration_hours),
      };
      if (editPlan) {
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
    if (!editPlan || busy || !canWritePlans) return;
    setBusy(true);
    setError2('');
    try {
      await api(`/api/instructors/weekly-plans/${editPlan.id}`, { method: 'PUT', body: { status } });
      reload();
      await refreshPlan();
    } catch (err: any) {
      setError2(err?.message || 'Could not update the plan status.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Weekly Plans" subtitle="Instructor weekly lesson planning"
        actions={canWritePlans
          ? <button className="btn btn-primary" onClick={openCreate}><i className="bi bi-plus-circle me-1" /> New weekly plan</button>
          : null} />

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
            {editPlan && canWritePlans && (
              <div className="me-auto">
                {editPlan.status !== 'completed' && <button className="btn btn-sm btn-outline-success me-1" disabled={busy} onClick={() => setEditPlan((p: any) => (p ? { ...p, showStatus: true } : p))}>Mark completed</button>}
                {editPlan.status === 'planned' && <button className="btn btn-sm btn-outline-primary" disabled={busy} onClick={() => changePlanStatus('in_progress')}>Start</button>}
              </div>
            )}
            {canWritePlans && (
              <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : editPlan ? 'Save changes' : 'Create plan'}</button>
            )}
          </>
        }
      >
        {error2 && <div className="alert alert-danger py-2 small">{error2}</div>}
        <form onSubmit={save}>
          {!editPlan ? (
            <div className="row">
              <div className="col-md-6">
                <Field label="Week start" required><TextInput type="date" value={form.week_start} onChange={(e) => setWeekStart(e.target.value)} required /></Field>
              </div>
              <div className="col-md-6">
                <Field label="Week end" required hint="Defaults to a 7-day week"><TextInput type="date" value={form.week_end} onChange={(e) => set('week_end', e.target.value)} required /></Field>
              </div>
            </div>
          ) : (
            <div className="alert alert-info small">Plan progress: {editPlan.progress_percent}% · status: <Badge status={editPlan.status} /></div>
          )}

          <div className="row">
            <div className="col-md-6">
              <Field label="Instructor" required={!editPlan && canPickInstructor}>
                {editPlan
                  ? <TextInput value={editPlan.instructor_name || myInstructorName} disabled />
                  : canPickInstructor
                    ? (
                      <SelectInput value={form.instructor_id} onChange={(e) => set('instructor_id', e.target.value)} required>
                        <option value="">Select instructor…</option>
                        {myInstructorId && !instructors.some((i: any) => String(i.id) === String(myInstructorId)) && (
                          <option value={String(myInstructorId)}>{myInstructorName || 'You'} (you)</option>
                        )}
                        {instructors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                      </SelectInput>
                    )
                    : <TextInput value={myInstructorName ? `${myInstructorName} (you)` : 'Your instructor profile'} disabled />}
              </Field>
            </div>
            <div className="col-md-6">
              <Field label="Title"><TextInput value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Excel fundamentals week" disabled={!canWritePlans} /></Field>
            </div>
          </div>
          <Field label="Note"><TextArea value={form.note} onChange={(e) => set('note', e.target.value)} rows={2} disabled={!canWritePlans} /></Field>
        </form>

        {!editPlan && canWritePlans && (
          <>
            <hr />
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="fw-semibold mb-0">Activities</h6>
              <button className="btn btn-sm btn-outline-primary" onClick={() => setForm((f) => ({ ...f, activities: [...f.activities, emptyActivity(f.week_start || todayIso())] }))}>
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
                    <td className="text-end">{canWritePlans && <button className="btn btn-sm btn-outline-secondary" onClick={() => openActEditor(act)}>Update</button>}</td>
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
          <div className="row">
            <div className="col-md-6">
              <Field label="Activity / lesson" required><TextInput value={actForm.activity} onChange={(e) => setActForm((f) => ({ ...f, activity: e.target.value }))} placeholder="e.g. Teach SUM formulas" /></Field>
            </div>
            <div className="col-md-3">
              <Field label="Date" required><TextInput type="date" value={actForm.activity_date} onChange={(e) => setActForm((f) => ({ ...f, activity_date: e.target.value }))} /></Field>
            </div>
            <div className="col-md-3">
              <Field label="Duration (hours)"><TextInput type="number" step="0.5" min="0" value={actForm.duration_hours} onChange={(e) => setActForm((f) => ({ ...f, duration_hours: e.target.value }))} /></Field>
            </div>
          </div>
          <div className="row">
            <div className="col-md-6"><Field label="Module"><TextInput value={actForm.module} onChange={(e) => setActForm((f) => ({ ...f, module: e.target.value }))} /></Field></div>
            <div className="col-md-6"><Field label="Lesson"><TextInput value={actForm.lesson} onChange={(e) => setActForm((f) => ({ ...f, lesson: e.target.value }))} /></Field></div>
          </div>
          <div className="row">
            <div className="col-md-6"><Field label="Expected outcome"><TextInput value={actForm.expected_outcome} onChange={(e) => setActForm((f) => ({ ...f, expected_outcome: e.target.value }))} /></Field></div>
            <div className="col-md-6">
              <Field label="Status">
                <SelectInput value={actForm.status} onChange={(e) => setActForm((f) => ({ ...f, status: e.target.value }))}>
                  <option value="planned">Planned</option>
                  <option value="done">Done</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="missed">Missed</option>
                </SelectInput>
              </Field>
            </div>
          </div>
          <Field label="Description"><TextArea value={actForm.description} onChange={(e) => setActForm((f) => ({ ...f, description: e.target.value }))} rows={2} /></Field>
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