'use client';

import { useState } from 'react';
import { useFetch, todayIso } from '@/lib/use-fetch';
import { api, can, fmtDate } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  PageHeader, Loading, ErrorAlert, EmptyState, Pagination, Badge, Modal,
} from '@/components/ui';
import { Field, TextInput, SelectInput, TextArea } from '@/components/form';
import { useEmployeeOptions, options } from '@/lib/use-options';

const LEAVE_TYPES = ['annual', 'sick', 'unpaid', 'other'];
const STATUSES = ['pending', 'in_review', 'forwarded', 'approved', 'rejected'];

function shiftIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Leave coordination. The payload carries dates, type and status only — no pay,
 * so this role can work the queue without touching payroll figures.
 */
export default function LeavePage() {
  const { user } = useAuth();
  const canManage = can(user, 'leave.manage');
  const { employees } = useEmployeeOptions();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [searchStart, setSearchStart] = useState('');
  const { data, error, loading, reload } = useFetch('/api/leave',
    [page, status, type, employeeId, searchStart], {
      page, per_page: 20,
      status: status || undefined,
      type: type || undefined,
      employee_id: employeeId || undefined,
      start: searchStart || undefined,
    });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({
    leave_type: 'annual', start_date: todayIso(1), end_date: shiftIso(2),
    reason: '', employee_id: '', note: '',
  });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [actionError, setActionError] = useState('');

  const [decideFor, setDecideFor] = useState<any | null>(null);
  const [decision, setDecision] = useState('approved');
  const [note, setNote] = useState('');

  const items = data?.items || [];

  function set(key: string, value: any) {
    setForm((f: any) => ({ ...f, [key]: value }));
  }

  function openCreate() {
    setForm({
      leave_type: 'annual', start_date: todayIso(1), end_date: shiftIso(2),
      reason: '', employee_id: '', note: '',
    });
    setFormError('');
    setOpen(true);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      const body: any = {
        leave_type: form.leave_type,
        start_date: form.start_date,
        end_date: form.end_date,
      };
      if (form.reason) body.reason = form.reason;
      if (canManage) {
        if (form.employee_id) body.employee_id = Number(form.employee_id);
        if (form.note) body.note = form.note;
      }
      await api('/api/leave', { method: 'POST', body });
      setOpen(false);
      reload();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function applyStatus(lv: any, next: string) {
    setActionError('');
    try {
      await api(`/api/leave/${lv.id}`, { method: 'PUT', body: { status: next } });
      reload();
    } catch (err: any) {
      setActionError(err.message);
    }
  }

  async function submitDecision(e: React.FormEvent) {
    e.preventDefault();
    if (!decideFor) return;
    setBusy(true);
    setFormError('');
    try {
      await api(`/api/leave/${decideFor.id}/decision`, {
        method: 'POST', body: { decision, note },
      });
      setDecideFor(null);
      setNote('');
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
        title="Leave Requests"
        subtitle="Company leave queue. Dates, type and status only — no pay data."
        actions={
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <i className="bi bi-plus-lg me-1" />Request leave
          </button>
        }
      />

      {actionError && <ErrorAlert message={actionError} />}

      <div className="card">
        <div className="card-body d-flex flex-wrap align-items-end gap-2">
          <div>
            <label className="form-label small fw-semibold mb-1">Employee</label>
            <SelectInput className="form-select form-control-sm" value={employeeId}
              onChange={(e) => { setEmployeeId(e.target.value); setPage(1); }}>
              <option value="">{canManage ? 'All in scope' : 'Mine'}</option>
              {options(employees)}
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
          <div>
            <label className="form-label small fw-semibold mb-1">Type</label>
            <SelectInput className="form-select form-control-sm" value={type}
              onChange={(e) => { setType(e.target.value); setPage(1); }}>
              <option value="">All</option>
              {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </SelectInput>
          </div>
          <div>
            <label className="form-label small fw-semibold mb-1">Overlapping from</label>
            <TextInput type="date" className="form-control form-control-sm" value={searchStart}
              onChange={(e) => { setSearchStart(e.target.value); setPage(1); }} />
          </div>
        </div>
      </div>

      {loading && <Loading />}
      {error && <ErrorAlert message={error} onRetry={reload} />}
      {!loading && !error && items.length === 0 && (
        <EmptyState message="No leave requests" icon="bi-airplane" />
      )}

      {items.length > 0 && (
        <div className="card">
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Type</th>
                  <th>Dates</th>
                  <th>Reason</th>
                  <th>Status</th>
                  {canManage && <th className="text-end">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((lv: any) => (
                  <tr key={lv.id}>
                    <td className="text-nowrap">{lv.employee || '—'}</td>
                    <td className="text-nowrap">{lv.leave_type}</td>
                    <td className="text-nowrap">
                      {fmtDate(lv.start_date)} → {fmtDate(lv.end_date)}
                    </td>
                    <td className="small" style={{ maxWidth: 260 }}>
                      {lv.reason || <span className="text-muted">—</span>}
                      {lv.note && <div className="text-muted">Note: {lv.note}</div>}
                    </td>
                    <td><Badge status={lv.status} /></td>
                    {canManage && (
                      <td className="text-end">
                        <div className="btn-group btn-group-sm">
                          {lv.status === 'pending' && (
                            <button className="btn btn-outline-secondary" title="Start review"
                              onClick={() => applyStatus(lv, 'in_review')}>
                              <i className="bi bi-eye" />
                            </button>
                          )}
                          {lv.status !== 'approved' && lv.status !== 'rejected' && (
                            <button className="btn btn-outline-success" title="Decide"
                              onClick={() => {
                                setDecideFor(lv); setDecision('approved'); setNote(lv.note || ''); setFormError('');
                              }}>
                              <i className="bi bi-check2-circle" />
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

      <Modal show={open} title="Request leave" onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy} onClick={create}>
              {busy ? 'Submitting…' : 'Submit request'}
            </button>
          </>
        }>
        <form onSubmit={create}>
          {formError && <ErrorAlert message={formError} />}
          <div className="row g-2">
            <div className="col-6">
              <Field label="Leave type" required>
                <SelectInput value={form.leave_type} onChange={(e) => set('leave_type', e.target.value)}>
                  {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </SelectInput>
              </Field>
            </div>
            <div className="col-6">
              {canManage ? (
                <Field label="Employee" hint="Leave empty to request for yourself.">
                  <SelectInput value={form.employee_id} onChange={(e) => set('employee_id', e.target.value)}>
                    <option value="">Myself</option>
                    {options(employees)}
                  </SelectInput>
                </Field>
              ) : (
                <Field label="Employee">
                  <TextInput value="Myself" disabled />
                </Field>
              )}
            </div>
          </div>
          <div className="row g-2">
            <div className="col-6">
              <Field label="Start date" required>
                <TextInput type="date" value={form.start_date}
                  onChange={(e) => set('start_date', e.target.value)} required />
              </Field>
            </div>
            <div className="col-6">
              <Field label="End date" required hint="Must be at least one day after the start.">
                <TextInput type="date" value={form.end_date}
                  onChange={(e) => set('end_date', e.target.value)} required />
              </Field>
            </div>
          </div>
          <Field label="Reason">
            <TextArea rows={3} value={form.reason} onChange={(e) => set('reason', e.target.value)} />
          </Field>
          {canManage && (
            <Field label="Coordinator note">
              <TextArea rows={2} value={form.note} onChange={(e) => set('note', e.target.value)} />
            </Field>
          )}
        </form>
      </Modal>

      <Modal show={!!decideFor} title={`Decide — ${decideFor?.employee || ''}`}
        onClose={() => setDecideFor(null)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setDecideFor(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy} onClick={submitDecision}>
              {busy ? 'Saving…' : 'Record decision'}
            </button>
          </>
        }>
        <form onSubmit={submitDecision}>
          {formError && <ErrorAlert message={formError} />}
          <p className="small text-muted">
            {fmtDate(decideFor?.start_date)} → {fmtDate(decideFor?.end_date)} · {decideFor?.leave_type}
          </p>
          <Field label="Decision" required>
            <SelectInput value={decision} onChange={(e) => setDecision(e.target.value)}>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </SelectInput>
          </Field>
          <Field label="Note" required={decision === 'rejected'}>
            <TextArea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </form>
      </Modal>
    </div>
  );
}