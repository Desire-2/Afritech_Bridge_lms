'use client';

import { useState } from 'react';
import { useFetch } from '@/lib/use-fetch';
import { api, fmtDate } from '@/lib/api';
import { PageHeader, Loading, ErrorAlert, EmptyState, Badge, Modal, ConfirmDialog } from '@/components/ui';
import { Field, TextInput, SelectInput } from '@/components/form';

export default function CommissionsPage() {
  const { data, error, loading, reload } = useFetch('/api/commissions/rules');
  const [employees, setEmployees] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ rate: '', scope: 'default', service_id: '', employee_id: '', effective_from: '', effective_until: '' });
  const [busy, setBusy] = useState(false);
  const [error2, setError2] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const [deact, setDeact] = useState<any | null>(null);

  // effective rate checker
  const [checkSvc, setCheckSvc] = useState<any[]>([]);
  const [checkEmp, setCheckEmp] = useState<any[]>([]);
  const [svcId, setSvcId] = useState('');
  const [empId, setEmpId] = useState('');
  const [eff, setEff] = useState<any | null>(null);
  const [checkOpen, setCheckOpen] = useState(false);

  const rules = data?.rules || [];

  async function openCreate() {
    setEditing(null);
    setError2('');
    await loadRefs();
    setForm({ rate: '', scope: 'default', service_id: '', employee_id: '', effective_from: '', effective_until: '' });
    setOpen(true);
  }

  async function loadRefs() {
    if (!employees.length) {
      const d: any = await api('/api/employees?per_page=500').catch(() => ({ items: [] }));
      setEmployees(d.items || []);
    }
    if (!services.length) {
      const d: any = await api('/api/services?per_page=500&active=true').catch(() => ({ items: [] }));
      setServices(d.items || []);
    }
    const [s, e] = await Promise.all([
      api('/api/services?per_page=500&active=true').catch(() => ({ items: [] })),
      api('/api/employees?per_page=500').catch(() => ({ items: [] })),
    ]);
    setCheckSvc(s.items || []);
    setCheckEmp(e.items || []);
  }

  function set<K extends keyof typeof form>(key: K, value: any) { setForm((f) => ({ ...f, [key]: value })); }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError2('');
    try {
      const body: any = {
        rate: Number(form.rate) / 100,
        scope: form.scope,
        effective_from: form.effective_from || undefined,
        effective_until: form.effective_until || undefined,
      };
      if (form.scope === 'service') body.service_id = Number(form.service_id);
      if (form.scope === 'employee') body.employee_id = Number(form.employee_id);
      await api('/api/commissions/rules', { method: 'POST', body });
      setOpen(false);
      reload();
    } catch (err: any) {
      setError2(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function checkRate() {
    const params: any = {};
    if (svcId) params.service_id = svcId;
    if (empId) params.employee_id = empId;
    const d: any = await api('/api/commissions/effective', { params });
    setEff(d);
  }

  async function toggleActive(r: any) {
    await api(`/api/commissions/rules/${r.id}`, { method: 'PUT', body: { is_active: !r.is_active } });
    setDeact(null);
    reload();
  }

  return (
    <div>
      <PageHeader title="Commissions" subtitle="Commission rules and rate precedence"
        actions={
          <>
            <button className="btn btn-outline-secondary me-2" onClick={async () => { setCheckOpen(true); setSvcId(''); setEmpId(''); setEff(null); await loadRefs(); }}><i className="bi bi-search me-1" /> Check effective rate</button>
            <button className="btn btn-primary" onClick={openCreate}><i className="bi bi-plus-circle me-1" /> New rule</button>
          </>
        } />

      <div className="alert alert-info small">
        <strong>Precedence:</strong> employee override &gt; service rate &gt; default. Commission = gross profit × rate. Company profit = gross − commission.
      </div>

      {error && <ErrorAlert message={error} onRetry={reload} />}
      {loading && <Loading />}
      {!loading && !error && rules.length === 0 && <EmptyState message="No commission rules yet" />}

      {!loading && !error && rules.length > 0 && (
        <div className="card">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead>
                <tr><th>Scope</th><th>Target</th><th className="text-end">Rate</th><th>Effective period</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {rules.map((r: any) => (
                  <tr key={r.id}>
                    <td className="text-uppercase small fw-semibold">{r.scope}</td>
                    <td>
                      {r.scope === 'service' ? r.service_name : r.scope === 'employee' ? r.employee_name : 'All transactions (default)'}
                    </td>
                    <td className="text-end fw-semibold text-warning">{Math.round(r.rate * 100)}%</td>
                    <td className="small">{r.effective_from ? fmtDate(r.effective_from) : '—'} → {r.effective_until ? fmtDate(r.effective_until) : '∞'}</td>
                    <td><Badge status={r.is_active ? 'active' : 'inactive'} /></td>
                    <td className="text-end">
                      <button className="btn btn-sm btn-outline-secondary" onClick={() => toggleActive(r)}>{r.is_active ? 'Deactivate' : 'Activate'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal show={open} title="New commission rule" onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        {error2 && <div className="alert alert-danger py-2 small">{error2}</div>}
        <form onSubmit={save}>
          <Field label="Scope" required>
            <SelectInput value={form.scope} onChange={(e) => set('scope', e.target.value)} required>
              <option value="default">Default (all services)</option>
              <option value="service">Specific service</option>
              <option value="employee">Specific employee</option>
            </SelectInput>
          </Field>
          {form.scope === 'service' && (
            <Field label="Service" required>
              <SelectInput value={form.service_id} onChange={(e) => set('service_id', e.target.value)} required>
                <option value="">Select service…</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </SelectInput>
            </Field>
          )}
          {form.scope === 'employee' && (
            <Field label="Employee" required>
              <SelectInput value={form.employee_id} onChange={(e) => set('employee_id', e.target.value)} required>
                <option value="">Select employee…</option>
                {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
              </SelectInput>
            </Field>
          )}
          <Field label="Rate (%)" required>
            <TextInput type="number" step="0.5" min="0" max="100" value={form.rate} onChange={(e) => set('rate', e.target.value)} placeholder="e.g. 15 = 15%" required />
          </Field>
          <div className="row">
            <div className="col-md-6"><Field label="Effective from"><TextInput type="date" value={form.effective_from} onChange={(e) => set('effective_from', e.target.value)} /></Field></div>
            <div className="col-md-6"><Field label="Effective until"><TextInput type="date" value={form.effective_until} onChange={(e) => set('effective_until', e.target.value)} /></Field></div>
          </div>
        </form>
      </Modal>

      {eff && (
        <Modal show={checkOpen} title="Check effective rate" onClose={() => setCheckOpen(false)} size="sm"
          footer={<button className="btn btn-outline-secondary" onClick={() => setCheckOpen(false)}>Close</button>}
        >
          <div className="mb-3">
            <label className="form-label small fw-semibold">Service</label>
            <select className="form-select" value={svcId} onChange={(e) => setSvcId(e.target.value)}>
              <option value="">Any / default</option>
              {checkSvc.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <label className="form-label small fw-semibold mt-2">Employee</label>
            <select className="form-select" value={empId} onChange={(e) => setEmpId(e.target.value)}>
              <option value="">Any / default</option>
              {checkEmp.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
            <button className="btn btn-primary btn-sm mt-3" onClick={checkRate}>Check</button>
          </div>
          {eff && (
            <div className={`alert ${eff.source !== 'default' ? 'alert-success' : 'alert-secondary'} small mb-0`}>
              Effective rate: <strong>{Math.round((eff.rate || 0) * 100)}%</strong><br />
              Source: {eff.source?.replace(/_/g, ' ') || 'default'}
            </div>
          )}
        </Modal>
      )}

      <ConfirmDialog
        show={!!deact}
        title={deact?.is_active ? 'Deactivate rule' : 'Activate rule'}
        message={`${deact?.is_active ? 'Deactivate' : 'Activate'} this commission rule?`}
        onConfirm={() => toggleActive(deact)}
        onClose={() => setDeact(null)}
        danger={deact?.is_active}
      />
    </div>
  );
}