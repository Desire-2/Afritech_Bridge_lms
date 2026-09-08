'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useFetch } from '@/lib/use-fetch';
import { api } from '@/lib/api';
import { PageHeader, Loading, ErrorAlert, EmptyState, Pagination, Modal, Badge } from '@/components/ui';
import { Field, TextInput, SelectInput, TextArea } from '@/components/form';

export default function InstructorsPage() {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useFetch('/api/instructors', [page], { page, per_page: 15 });
  const [employees, setEmployees] = useState<any[]>([]);
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ employee_id: '', specialization: '', bio: '', cohort_ids: [] as number[] });
  const [busy, setBusy] = useState(false);
  const [error2, setError2] = useState('');

  const items = data?.items || [];

  async function openCreate() {
    setOpen(true);
    setError2('');
    const [e, c] = await Promise.all([
      api('/api/employees?per_page=500').catch(() => ({ items: [] })),
      api('/api/instructors/cohorts/list?per_page=500').catch(() => ({ items: [] })),
    ]);
    setEmployees(e.items || []);
    setCohorts(c.items || []);
    setForm({ employee_id: '', specialization: '', bio: '', cohort_ids: [] });
  }

  function set<K extends keyof typeof form>(key: K, value: any) { setForm((f) => ({ ...f, [key]: value })); }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError2('');
    try {
      await api('/api/instructors', { method: 'POST', body: { employee_id: Number(form.employee_id), specialization: form.specialization || undefined, bio: form.bio || undefined, cohort_ids: form.cohort_ids } });
      setOpen(false);
      reload();
    } catch (err: any) {
      setError2(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Instructors" subtitle="Learning instructors and their assignments"
        actions={
          <>
            <Link href="/learning/weekly-plans" className="btn btn-outline-primary me-2"><i className="bi bi-journal-richtext me-1" /> Weekly plans</Link>
            <button className="btn btn-primary" onClick={openCreate}><i className="bi bi-person-plus me-1" /> New instructor</button>
          </>
        } />

      {error && <ErrorAlert message={error} onRetry={reload} />}
      {loading && <Loading />}
      {!loading && !error && items.length === 0 && <EmptyState message="No instructors yet" />}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="row g-3">
            {items.map((ins: any) => (
              <div className="col-md-6 col-xl-4" key={ins.id}>
                <div className="card h-100">
                  <div className="card-body">
                    <div className="d-flex align-items-center gap-3">
                      <div className="stat-primary rounded-3 d-flex align-items-center justify-content-center" style={{ width: 48, height: 48 }}>
                        <i className="bi bi-person-video3" />
                      </div>
                      <div className="flex-grow-1">
                        <h6 className="mb-0 fw-semibold">{ins.name}</h6>
                        <div className="small text-muted">{ins.specialization || '—'}</div>
                        <Badge status={ins.is_active ? 'active' : 'inactive'} />
                      </div>
                    </div>
                    <div className="d-flex justify-content-between mt-3 small text-muted">
                      <span><i className="bi bi-mortarboard me-1" />{ins.cohort_count} cohorts</span>
                      <span><i className="bi bi-journal-richtext me-1" />{ins.plan_count} plans</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Pagination page={page} pages={data?.pages || 1} total={data?.total} onPage={setPage} />
        </>
      )}

      <Modal show={open} title="New instructor" onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        {error2 && <div className="alert alert-danger py-2 small">{error2}</div>}
        <form onSubmit={save}>
          <Field label="Employee" required>
            <SelectInput value={form.employee_id} onChange={(e) => set('employee_id', e.target.value)} required>
              <option value="">Select employee…</option>
              {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.full_name} — {emp.position || ''}</option>)}
            </SelectInput>
          </Field>
          <Field label="Specialization"><TextInput value={form.specialization} onChange={(e) => set('specialization', e.target.value)} placeholder="e.g. Digital skills, Excel" /></Field>
          <Field label="Bio"><TextArea value={form.bio} onChange={(e) => set('bio', e.target.value)} /></Field>
          <Field label="Assign cohorts">
            <div className="border rounded-3 p-2" style={{ maxHeight: 160, overflowY: 'auto' }}>
              {cohorts.map((c) => (
                <div className="form-check" key={c.id}>
                  <input className="form-check-input" type="checkbox" id={`coh-${c.id}`}
                    checked={(form.cohort_ids || []).includes(c.id)}
                    onChange={(e) => {
                      const cur = form.cohort_ids || [];
                      set('cohort_ids', e.target.checked ? [...cur, c.id] : cur.filter((x: number) => x !== c.id));
                    }} />
                  <label className="form-check-label small" htmlFor={`coh-${c.id}`}>{c.name} ({c.code})</label>
                </div>
              ))}
            </div>
          </Field>
        </form>
      </Modal>
    </div>
  );
}