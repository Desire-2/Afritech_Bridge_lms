'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useFetch } from '@/lib/use-fetch';
import { api, fmtMoney } from '@/lib/api';
import { PageHeader, Loading, ErrorAlert, EmptyState, Pagination, Modal, Badge, ConfirmDialog } from '@/components/ui';
import { Field, TextInput, SelectInput, TextArea } from '@/components/form';

export default function EmployeesPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const { data, error, loading, reload } = useFetch('/api/employees', [page, q], { page, per_page: 15, search: q || undefined });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [depts, setDepts] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [form, setForm] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [error2, setError2] = useState('');
  const [deact, setDeact] = useState<any | null>(null);

  const items = data?.items || [];

  async function loadMeta() {
    const [b, d, r] = await Promise.all([
      api('/api/employees/branches').catch(() => ({ branches: [] })),
      api('/api/employees/departments').catch(() => ({ departments: [] })),
      api('/api/users/roles').catch(() => ({ roles: [] })),
    ]);
    setBranches(b.branches || []);
    setDepts(d.departments || []);
    setRoles(r.roles || []);
  }

  async function openCreate() {
    setEditing(null);
    await loadMeta();
    setForm({ first_name: '', last_name: '', phone: '', email: '', position: '', status: 'active', salary_type: 'monthly', base_salary: '', branch_id: '', department_id: '', default_commission_rate: '', employment_date: '', password: '', roles: [] as string[], is_instructor: false, specialization: '' });
    setError2('');
    setOpen(true);
  }

  async function openEdit(emp: any) {
    setEditing(emp);
    await loadMeta();
    setForm({
      first_name: emp.first_name, last_name: emp.last_name, phone: emp.phone || '', email: emp.email || '',
      position: emp.position || '', status: emp.status, salary_type: emp.salary_type || 'monthly',
      base_salary: emp.base_salary, branch_id: emp.branch_id || '', department_id: emp.department_id || '',
      default_commission_rate: emp.default_commission_rate != null ? emp.default_commission_rate * 100 : '',
      employment_date: emp.employment_date || '', emergency_contact: emp.emergency_contact || '',
    });
    setError2('');
    setOpen(true);
  }

  function set<K extends keyof typeof form>(key: K, value: any) { setForm((f) => ({ ...f, [key]: value })); }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError2('');
    try {
      const body: any = {
        first_name: form.first_name, last_name: form.last_name, phone: form.phone || undefined,
        email: form.email || undefined, position: form.position || undefined,
        status: form.status, salary_type: form.salary_type,
        base_salary: form.base_salary !== '' ? Number(form.base_salary) : undefined,
        branch_id: form.branch_id ? Number(form.branch_id) : undefined,
        department_id: form.department_id ? Number(form.department_id) : undefined,
        default_commission_rate: form.default_commission_rate !== '' ? Number(form.default_commission_rate) / 100 : undefined,
        employment_date: form.employment_date || undefined,
      };
      if (editing) {
        if (form.emergency_contact) body.emergency_contact = form.emergency_contact;
        await api(`/api/employees/${editing.id}`, { method: 'PUT', body });
      } else {
        body.password = form.password;
        body.roles = form.roles;
        body.is_instructor = form.is_instructor;
        body.specialization = form.specialization || undefined;
        await api('/api/employees', { method: 'POST', body });
      }
      setOpen(false);
      reload();
    } catch (err: any) {
      setError2(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(emp: any) {
    await api(`/api/employees/${emp.id}`, { method: 'PUT', body: { status: emp.status === 'active' ? 'inactive' : 'active' } });
    setDeact(null);
    reload();
  }

  const salaryLabel = (e: any) => e.salary_type === 'hourly' ? `${fmtMoney(e.hourly_rate)}/hr` : fmtMoney(e.base_salary);

  return (
    <div>
      <PageHeader title="Employees" subtitle="Staff, branches and departments"
        actions={<button className="btn btn-primary" onClick={openCreate}><i className="bi bi-person-plus me-1" /> New employee</button>} />

      <div className="card mb-3">
        <div className="card-body py-2 d-flex align-items-center">
          <i className="bi bi-search text-muted me-2" />
          <input className="form-control form-control-sm border-0 shadow-none" placeholder="Search name, email, position, ID…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={reload} />}
      {loading && <Loading />}
      {!loading && !error && items.length === 0 && <EmptyState message="No employees found" />}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="card">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr><th>Employee</th><th>Position</th><th>Branch</th><th>Department</th><th className="text-end">Pay</th><th>Commission</th><th>Status</th><th /></tr>
                </thead>
                <tbody>
                  {items.map((e: any) => (
                    <tr key={e.id}>
                      <td>
                        <Link href={`/employees/${e.id}`} className="text-decoration-none fw-semibold">{e.full_name}</Link>
                        <div className="small text-muted">{e.employee_number}</div>
                      </td>
                      <td>{e.position || '—'}</td>
                      <td>{e.branch || '—'}</td>
                      <td>{e.department || '—'}</td>
                      <td className="text-end money">{salaryLabel(e)}</td>
                      <td>{e.default_commission_rate != null ? `${Math.round(e.default_commission_rate * 100)}%` : '—'}</td>
                      <td><Badge status={e.status} /></td>
                      <td className="text-end">
                        <Link href={`/employees/${e.id}`} className="btn btn-sm btn-outline-secondary me-1">View</Link>
                        <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => openEdit(e)}><i className="bi bi-pencil" /></button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => setDeact(e)}>
                          <i className={`bi ${e.status === 'active' ? 'bi-pause-circle' : 'bi-play-circle'}`} />
                        </button>
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

      <Modal show={open} title={editing ? `Edit ${editing.full_name}` : 'New employee'} onClose={() => setOpen(false)} size="xl"
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        {error2 && <div className="alert alert-danger py-2 small">{error2}</div>}
        <form onSubmit={save} className="row">
          <div className="col-md-6">
            <div className="row">
              <div className="col-md-6"><Field label="First name" required><TextInput value={form.first_name} onChange={(e) => set('first_name', e.target.value)} required /></Field></div>
              <div className="col-md-6"><Field label="Last name" required><TextInput value={form.last_name} onChange={(e) => set('last_name', e.target.value)} required /></Field></div>
            </div>
            <div className="row">
              <div className="col-md-6"><Field label="Phone"><TextInput value={form.phone} onChange={(e) => set('phone', e.target.value)} /></Field></div>
              <div className="col-md-6"><Field label="Email"><TextInput type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></Field></div>
            </div>
            <div className="row">
              <div className="col-md-6"><Field label="Position"><TextInput value={form.position} onChange={(e) => set('position', e.target.value)} /></Field></div>
              <div className="col-md-6"><Field label="Employment date"><TextInput type="date" value={form.employment_date} onChange={(e) => set('employment_date', e.target.value)} /></Field></div>
            </div>
            <div className="row">
              <div className="col-md-6">
                <Field label="Branch">
                  <SelectInput value={form.branch_id} onChange={(e) => set('branch_id', e.target.value)}>
                    <option value="">None</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </SelectInput>
                </Field>
              </div>
              <div className="col-md-6">
                <Field label="Department">
                  <SelectInput value={form.department_id} onChange={(e) => set('department_id', e.target.value)}>
                    <option value="">None</option>
                    {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </SelectInput>
                </Field>
              </div>
            </div>
            {editing && <Field label="Emergency contact"><TextInput value={form.emergency_contact} onChange={(e) => set('emergency_contact', e.target.value)} /></Field>}
          </div>

          <div className="col-md-6">
            <div className="row">
              <div className="col-md-6">
                <Field label="Salary type">
                  <SelectInput value={form.salary_type} onChange={(e) => set('salary_type', e.target.value)}>
                    <option value="monthly">Monthly</option>
                    <option value="hourly">Hourly</option>
                  </SelectInput>
                </Field>
              </div>
              <div className="col-md-6">
                <Field label={form.salary_type === 'hourly' ? 'Hourly rate' : 'Base salary (monthly)'}>
                  <TextInput type="number" step="0.01" min="0" value={form.base_salary} onChange={(e) => set('base_salary', e.target.value)} />
                </Field>
              </div>
            </div>
            <Field label="Default commission rate (%)">
              <TextInput type="number" step="0.5" min="0" max="100" value={form.default_commission_rate} onChange={(e) => set('default_commission_rate', e.target.value)} placeholder="Blank = use default" />
            </Field>
            <Field label="Employee status">
              <SelectInput value={form.status} onChange={(e) => set('status', e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="on_leave">On leave</option>
              </SelectInput>
            </Field>
            {!editing && (
              <>
                <Field label="Initial password" required>
                  <TextInput type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="At least 8 characters" required />
                </Field>
                <Field label="Roles">
                  <div className="border rounded-3 p-2" style={{ maxHeight: 120, overflowY: 'auto' }}>
                    {roles.map((r) => (
                      <div className="form-check" key={r.id}>
                        <input className="form-check-input" type="checkbox" id={`role-${r.id}`}
                          checked={(form.roles || []).includes(r.code)}
                          onChange={(e) => {
                            const current = form.roles || [];
                            set('roles', e.target.checked ? [...current, r.code] : current.filter((c: string) => c !== r.code));
                          }} />
                        <label className="form-check-label small" htmlFor={`role-${r.id}`}>{r.name} <span className="text-muted">({r.code})</span></label>
                      </div>
                    ))}
                  </div>
                </Field>
                <div className="form-check form-switch">
                  <input className="form-check-input" type="checkbox" id="isInstructor" checked={form.is_instructor} onChange={(e) => set('is_instructor', e.target.checked)} />
                  <label className="form-check-label" htmlFor="isInstructor">This employee is an instructor</label>
                </div>
                {form.is_instructor && (
                  <Field label="Specialization"><TextInput value={form.specialization} onChange={(e) => set('specialization', e.target.value)} /></Field>
                )}
              </>
            )}
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        show={!!deact}
        title={deact?.status === 'active' ? 'Deactivate employee' : 'Reactivate employee'}
        message={`Set ${deact?.full_name || 'this employee'} to ${deact?.status === 'active' ? 'inactive' : 'active'}?`}
        confirmLabel={deact?.status === 'active' ? 'Deactivate' : 'Reactivate'}
        onConfirm={() => toggleActive(deact)}
        onClose={() => setDeact(null)}
        danger={deact?.status === 'active'}
      />
    </div>
  );
}