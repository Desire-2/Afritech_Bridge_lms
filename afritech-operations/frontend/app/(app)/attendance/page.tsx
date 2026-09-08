'use client';

import { useState } from 'react';
import { useFetch } from '@/lib/use-fetch';
import { api, fmtDate, can } from '@/lib/api';
import { todayIso } from '@/lib/use-fetch';
import { PageHeader, Loading, ErrorAlert, EmptyState, Pagination, Badge, Modal, ConfirmDialog } from '@/components/ui';
import { Field, SelectInput, TextInput } from '@/components/form';
import { useAuth } from '@/lib/auth';

export default function AttendancePage() {
  const { user } = useAuth();
  const canManage = can(user, 'attendance.manage');
  const [page, setPage] = useState(1);
  const [date, setDate] = useState('');
  const { data, error, loading, reload } = useFetch('/api/attendance', [page, date], { page, per_page: 20, start: date || undefined, end: date || undefined });
  const [open, setOpen] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ employee_id: '', attendance_date: todayIso(), status: 'present', note: '', clock_in: '', clock_out: '' });
  const [busy, setBusy] = useState(false);
  const [error2, setError2] = useState('');
  const [clockAction, setClockAction] = useState<'in' | 'out' | null>(null);

  const items = data?.items || [];

  async function openCreate() {
    setOpen(true);
    setError2('');
    if (records.length === 0 || records[0]?.full_name !== undefined) {
      const d: any = await api('/api/employees?per_page=500').catch(() => ({ items: [] }));
      setRecords(d.items || []);
    }
    setForm({ employee_id: '', attendance_date: todayIso(), status: 'present', note: '', clock_in: '', clock_out: '' });
  }

  function set<K extends keyof typeof form>(key: K, value: any) { setForm((f) => ({ ...f, [key]: value })); }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError2('');
    try {
      const body: any = {
        employee_id: Number(form.employee_id),
        attendance_date: form.attendance_date,
        status: form.status,
        note: form.note || undefined,
      };
      if (form.clock_in) body.clock_in = new Date(form.clock_in).toISOString();
      if (form.clock_out) body.clock_out = new Date(form.clock_out).toISOString();
      await api('/api/attendance/record', { method: 'POST', body });
      setOpen(false);
      reload();
    } catch (err: any) {
      setError2(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function doClock(action: 'in' | 'out') {
    setBusy(true);
    setError2('');
    try {
      const d: any = await api(`/api/attendance/clock-${action}`, { method: 'POST' });
      setClockAction(null);
      setError2(d.message || '');
      reload();
    } catch (err: any) {
      setError2(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Attendance" subtitle="Clock in/out and daily attendance records"
        actions={
          <>
            <button className="btn btn-outline-success" onClick={() => setClockAction('in')}><i className="bi bi-box-arrow-in-right me-1" /> Clock in</button>
            <button className="btn btn-outline-danger" onClick={() => setClockAction('out')}><i className="bi bi-box-arrow-right me-1" /> Clock out</button>
            {canManage && <button className="btn btn-primary" onClick={openCreate}><i className="bi bi-plus-circle me-1" /> Record attendance</button>}
          </>
        } />

      {error2 && <div className="alert alert-info py-2 small">{error2}</div>}

      <div className="card mb-3">
        <div className="card-body py-2 d-flex align-items-center gap-2">
          <i className="bi bi-funnel text-muted" />
          <input type="date" className="form-control form-control-sm" style={{ width: 180 }} value={date} onChange={(e) => { setDate(e.target.value); setPage(1); }} />
          {(error || loading) && <Loading />}
        </div>
      </div>

      {!loading && !error && items.length === 0 && <EmptyState message="No attendance records" />}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="card">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr><th>Employee</th><th>Date</th><th>Clock in</th><th>Clock out</th><th className="text-end">Hours</th><th className="text-end">Overtime</th><th>Status</th><th>Note</th></tr>
                </thead>
                <tbody>
                  {items.map((a: any) => (
                    <tr key={a.id}>
                      <td className="fw-semibold">{a.employee_name}</td>
                      <td>{fmtDate(a.attendance_date)}</td>
                      <td>{a.clock_in || '—'}</td>
                      <td>{a.clock_out || '—'}</td>
                      <td className="text-end">{a.total_hours || 0}</td>
                      <td className="text-end">{a.overtime_hours || 0}</td>
                      <td><Badge status={a.status} /></td>
                      <td className="text-muted">{a.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination page={page} pages={data?.pages || 1} total={data?.total} onPage={setPage} />
        </>
      )}

      <Modal show={open} title="Record attendance" onClose={() => setOpen(false)}
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
              {records.map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}
            </SelectInput>
          </Field>
          <Field label="Date" required><TextInput type="date" value={form.attendance_date} onChange={(e) => set('attendance_date', e.target.value)} required /></Field>
          <Field label="Status">
            <SelectInput value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="absent">Absent</option>
              <option value="leave">Leave</option>
              <option value="holiday">Holiday</option>
            </SelectInput>
          </Field>
          <div className="row">
            <div className="col-md-6"><Field label="Clock in"><TextInput type="datetime-local" value={form.clock_in} onChange={(e) => set('clock_in', e.target.value)} /></Field></div>
            <div className="col-md-6"><Field label="Clock out"><TextInput type="datetime-local" value={form.clock_out} onChange={(e) => set('clock_out', e.target.value)} /></Field></div>
          </div>
          <Field label="Note"><TextInput value={form.note} onChange={(e) => set('note', e.target.value)} /></Field>
        </form>
      </Modal>

      <ConfirmDialog
        show={clockAction !== null}
        title={clockAction === 'in' ? 'Clock in' : 'Clock out'}
        message={clockAction === 'in' ? 'Record your clock-in time?' : 'Record your clock-out time?'}
        confirmLabel={clockAction === 'in' ? 'Clock in' : 'Clock out'}
        onConfirm={() => doClock(clockAction!)}
        onClose={() => setClockAction(null)}
      />
    </div>
  );
}