'use client';

import { useState } from 'react';
import { useFetch, todayIso } from '@/lib/use-fetch';
import { api, fmtDate } from '@/lib/api';
import { PageHeader, Loading, ErrorAlert, EmptyState, Pagination, Badge, Modal, RiskBadge } from '@/components/ui';
import { Field, TextInput } from '@/components/form';

export default function CohortsPage() {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useFetch('/api/instructors/cohorts/list', [page], { page, per_page: 12 });
  const [selCohort, setSelCohort] = useState<any | null>(null);
  const [lPage, setLPage] = useState(1);
  const { data: learners, loading: lLoading, reload: reloadLearners, error: lError } = useFetch<any>(
    selCohort ? `/api/instructors/cohorts/${selCohort.id}/learners` : null,
    [selCohort, lPage],
    { page: lPage, per_page: 15 }
  );
  const [course, setCourse] = useState<any | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [lf, setLf] = useState<any>({ name: '', email: '', phone: '', lms_user_id: '' });
  const [enrollEdit, setEnrollEdit] = useState<any | null>(null);
  const [ef, setEf] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [error2, setError2] = useState('');

  const items = data?.items || [];

  function selectCohort(c: any) {
    setSelCohort(c);
    setCourse(c.course || null);
  }

  async function addLearner(e: React.FormEvent) {
    e.preventDefault();
    if (!selCohort) return;
    setBusy(true);
    setError2('');
    try {
      await api(`/api/instructors/cohorts/${selCohort.id}/learners`, { method: 'POST', body: {
        name: lf.name, email: lf.email || undefined, phone: lf.phone || undefined, lms_user_id: lf.lms_user_id || undefined,
      } });
      setAddOpen(false);
      setLf({ name: '', email: '', phone: '', lms_user_id: '' });
      reloadLearners();
    } catch (err: any) {
      setError2(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveEnrollment(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError2('');
    try {
      await api(`/api/instructors/enrollments/${enrollEdit.enrollment.id}`, { method: 'PUT', body: { progress_percent: Number(ef.progress_percent) || undefined, average_score: ef.average_score !== '' ? Number(ef.average_score) : undefined, attendance_rate: ef.attendance_rate !== '' ? Number(ef.attendance_rate) : undefined, risk_status: ef.risk_status || undefined } });
      setEnrollEdit(null);
      reloadLearners();
    } catch (err: any) {
      setError2(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Cohorts & Learners" subtitle="Course cohorts, learner progress and risk tracking"
        actions={
          selCohort && (
            <button className="btn btn-primary" onClick={() => { setAddOpen(true); setError2(''); }}>
              <i className="bi bi-person-plus me-1" /> Add learner
            </button>
          )
        } />

      {error && <ErrorAlert message={error} onRetry={reload} />}
      {loading && <Loading />}
      {!loading && !error && !selCohort && (
        <div className="row g-3">
          {items.length === 0 && <EmptyState message="No cohorts yet" />}
          {items.map((c: any) => (
            <div className="col-md-6 col-xl-4" key={c.id}>
              <button className="card h-100 text-start border-0 shadow-sm w-100 text-body" onClick={() => selectCohort(c)}>
                <div className="card-body">
                  <div className="d-flex justify-content-between">
                    <h6 className="fw-semibold mb-1">{c.name}</h6>
                    <Badge status={c.is_active ? 'active' : 'inactive'} />
                  </div>
                  <div className="small text-muted mb-2">{c.course_name || '—'} · {c.code}</div>
                  <div className="small text-muted"><i className="bi bi-calendar3 me-1" />{fmtDate(c.start_date)} → {fmtDate(c.end_date)}</div>
                </div>
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && selCohort && (
        <>
          <button className="btn btn-link btn-sm text-decoration-none mb-2" onClick={() => setSelCohort(null) as any}>← All cohorts</button>
          <div className="d-flex align-items-center gap-3 mb-3 flex-wrap">
            <h2 className="h5 fw-semibold mb-0">{selCohort.name}</h2>
            {course && <span className="badge border bg-light-subtle text-body border-light-subtle">{course.name}</span>}
            <Badge status={selCohort.is_active ? 'active' : 'inactive'} />
          </div>
          {lError && <ErrorAlert message={lError} onRetry={reloadLearners} />}
          {lLoading && <Loading />}
          {!lLoading && (learners?.items || []).length === 0 && <EmptyState message="No learners enrolled yet" />}
          {!lLoading && (learners?.items || []).length > 0 && (
            <>
              <div className="card">
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead>
                      <tr><th>Learner</th><th>Enrollment</th><th>Progress</th><th>Avg score</th><th>Attendance</th><th>Risk</th><th /></tr>
                    </thead>
                    <tbody>
                      {(learners?.items || []).map((l: any) => {
                        const en = l.enrollment;
                        return (
                          <tr key={l.id}>
                            <td>
                              <div className="fw-semibold">{l.name}</div>
                              <div className="small text-muted">{l.email || '—'}</div>
                            </td>
                            <td className="small">{en && fmtDate(en.enrollment_date || l.enrollment_date)}</td>
                            <td style={{ width: 140 }}>
                              <div className="progress" style={{ height: 6 }}><div className="progress-bar" style={{ width: `${en?.progress_percent || 0}%` }} /></div>
                              <span className="small text-muted">{en?.progress_percent ?? 0}%</span>
                            </td>
                            <td>{en?.average_score ?? '—'}</td>
                            <td>{en?.attendance_rate != null ? `${en.attendance_rate}%` : '—'}</td>
                            <td>{en ? <RiskBadge risk={en.risk_status} /> : <span className="text-muted">—</span>}</td>
                            <td className="text-end">
                              {en && (
                                <button className="btn btn-sm btn-outline-secondary" onClick={() => {
                                  setEnrollEdit(l);
                                  setEf({ progress_percent: en.progress_percent ?? '', average_score: en.average_score ?? '', attendance_rate: en.attendance_rate ?? '', risk_status: en.risk_status || 'on_track' });
                                  setError2('');
                                }}>
                                  <i className="bi bi-pencil" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <Pagination page={lPage} pages={learners?.pages || 1} total={learners?.total} onPage={setLPage} />
            </>
          )}
        </>
      )}

      <Modal show={addOpen} title={`Add learner to ${selCohort?.name || ''}`} onClose={() => setAddOpen(false)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setAddOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={addLearner} disabled={busy}>{busy ? 'Saving…' : 'Add learner'}</button>
          </>
        }
      >
        {error2 && <div className="alert alert-danger py-2 small">{error2}</div>}
        <form onSubmit={addLearner}>
          <div className="row">
            <div className="col-md-6"><Field label="Name" required><TextInput required value={lf.name} onChange={(e) => setLf((f) => ({ ...f, name: e.target.value }))} /></Field></div>
            <div className="col-md-6"><Field label="Email"><TextInput type="email" value={lf.email} onChange={(e) => setLf((f) => ({ ...f, email: e.target.value }))} /></Field></div>
          </div>
          <Field label="Phone"><TextInput value={lf.phone} onChange={(e) => setLf((f) => ({ ...f, phone: e.target.value }))} /></Field>
          <Field label="LMS user ID"><TextInput value={lf.lms_user_id} onChange={(e) => setLf((f) => ({ ...f, lms_user_id: e.target.value }))} placeholder="Optional — if integrating with LMS" /></Field>
        </form>
      </Modal>

      <Modal show={!!enrollEdit} title={`Update enrollment — ${enrollEdit?.name || ''}`} onClose={() => setEnrollEdit(null)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setEnrollEdit(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveEnrollment} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        {error2 && <div className="alert alert-danger py-2 small">{error2}</div>}
        <form onSubmit={saveEnrollment} className="row">
          <div className="col-md-6"><Field label="Progress (%)"><TextInput type="number" min="0" max="100" value={ef.progress_percent} onChange={(e) => setEf((f) => ({ ...f, progress_percent: e.target.value }))} /></Field></div>
          <div className="col-md-6"><Field label="Average score"><TextInput type="number" min="0" max="100" value={ef.average_score} onChange={(e) => setEf((f) => ({ ...f, average_score: e.target.value }))} /></Field></div>
          <div className="col-md-6"><Field label="Attendance rate (%)"><TextInput type="number" min="0" max="100" value={ef.attendance_rate} onChange={(e) => setEf((f) => ({ ...f, attendance_rate: e.target.value }))} /></Field></div>
          <div className="col-md-6">
            <Field label="Risk status">
              <select className="form-select" value={ef.risk_status} onChange={(e) => setEf((f) => ({ ...f, risk_status: e.target.value }))}>
                <option value="on_track">On track</option>
                <option value="at_risk">At risk</option>
                <option value="behind">Behind</option>
                <option value="critical">Critical</option>
              </select>
            </Field>
          </div>
        </form>
      </Modal>
    </div>
  );
}