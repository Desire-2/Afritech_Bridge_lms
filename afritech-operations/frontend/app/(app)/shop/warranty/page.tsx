'use client';

import { useState } from 'react';
import { useFetch } from '@/lib/use-fetch';
import { api, can, fmtMoney, fmtDate, fmtDateTime } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { P } from '@/lib/permissions';
import { PageHeader, Loading, ErrorAlert, EmptyState, Pagination, Modal, Badge } from '@/components/ui';
import { Field, TextInput, SelectInput, TextArea } from '@/components/form';

type Tab = 'registrations' | 'cases';

/** Mirrors CASE_TRANSITIONS in backend/app/routes/shop/warranty.py. */
const CASE_TRANSITIONS: Record<string, string[]> = {
  open: ['under_inspection', 'approved', 'rejected'],
  under_inspection: ['approved', 'rejected'],
  approved: ['repairing', 'replacement_pending', 'resolved', 'rejected'],
  repairing: ['resolved', 'replacement_pending', 'rejected'],
  replacement_pending: ['resolved'],
  resolved: ['closed'],
  rejected: ['closed'],
};

export default function ShopWarrantyPage() {
  const { user } = useAuth();
  const canManage = can(user, P.shopWarrantyManage);

  const [tab, setTab] = useState<Tab>('registrations');

  const [regPage, setRegPage] = useState(1);
  const [regQ, setRegQ] = useState('');
  const [regStatus, setRegStatus] = useState('');
  const regs = useFetch('/api/shop/warranties', [regPage, regQ, regStatus], {
    page: regPage, per_page: 15, q: regQ || undefined,
    ...(regStatus === 'all' ? { include_expired: 'true' } : {}),
  });
  const regItems = regs.data?.items || [];

  const [casePage, setCasePage] = useState(1);
  const [caseQ, setCaseQ] = useState('');
  const [caseStatus, setCaseStatus] = useState('');
  const cases = useFetch('/api/shop/warranty-cases', [casePage, caseQ, caseStatus], {
    page: casePage, per_page: 15, q: caseQ || undefined, status: caseStatus || undefined,
  });
  const caseItems = cases.data?.items || [];

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ registration_id: '', issue_description: '', due_days: '7' });
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [error2, setError2] = useState('');

  const [detail, setDetail] = useState<any | null>(null);
  const [dForm, setDForm] = useState<any>({ status: '', diagnosis: '', resolution_notes: '', inspection_notes: '' });
  const [dBusy, setDBusy] = useState(false);
  const [dError, setDError] = useState('');

  function set<K extends keyof typeof form>(key: K, value: any) { setForm((f) => ({ ...f, [key]: value })); }

  async function openCase(reg?: any) {
    setForm({ registration_id: reg ? String(reg.id) : '', issue_description: '', due_days: '7' });
    setError2('');
    setOpen(true);
    const d: any = await api('/api/shop/warranties', { params: { page: 1, per_page: 100 } }).catch(() => ({ items: [] }));
    const list: any[] = d.items || [];
    if (reg && !list.some((r) => r.id === reg.id)) list.unshift(reg);
    setRegistrations(list);
  }

  async function saveCase(e: React.FormEvent) {
    e.preventDefault();
    if (!form.registration_id) { setError2('Select a warranty registration'); return; }
    if (!(form.issue_description || '').trim()) { setError2('Issue description is required'); return; }
    setBusy(true);
    setError2('');
    try {
      await api('/api/shop/warranty-cases', {
        method: 'POST',
        body: {
          registration_id: Number(form.registration_id),
          issue_description: form.issue_description,
          due_days: form.due_days !== '' ? Number(form.due_days) : undefined,
        },
      });
      setOpen(false);
      cases.reload();
    } catch (err: any) {
      setError2(err.message);
    } finally {
      setBusy(false);
    }
  }

  function openDetail(row: any) {
    setDetail(row);
    setDForm({
      status: row.status,
      diagnosis: row.diagnosis || '',
      resolution_notes: row.resolution_notes || '',
      inspection_notes: row.inspection_notes || '',
    });
    setDError('');
  }

  async function saveDetail() {
    setDBusy(true);
    setDError('');
    try {
      await api(`/api/shop/warranty-cases/${detail.id}`, {
        method: 'PATCH',
        body: {
          status: dForm.status,
          diagnosis: dForm.diagnosis || null,
          resolution_notes: dForm.resolution_notes || null,
          inspection_notes: dForm.inspection_notes || null,
        },
      });
      setDetail(null);
      cases.reload();
    } catch (err: any) {
      setDError(err.message);
    } finally {
      setDBusy(false);
    }
  }

  const allowedNext = detail ? (CASE_TRANSITIONS[detail.status] || []) : [];
  const statusOptions = detail ? [detail.status, ...allowedNext] : [];

  const tabs: { key: Tab; label: string }[] = [
    { key: 'registrations', label: 'Registrations' },
    { key: 'cases', label: 'Cases' },
  ];

  return (
    <div>
      <PageHeader title="Warranty" subtitle="Warranty registrations and after-sales cases"
        actions={canManage && <button className="btn btn-primary" onClick={() => openCase()}><i className="bi bi-plus-circle me-1" /> Open case</button>} />

      <ul className="nav nav-pills mb-3">
        {tabs.map((t) => (
          <li className="nav-item me-1" key={t.key}>
            <button className={`nav-link py-1 px-3 ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
          </li>
        ))}
      </ul>

      {tab === 'registrations' && (
        <div>
          <div className="card mb-3">
            <div className="card-body d-flex flex-wrap gap-2 align-items-center">
              <i className="bi bi-search text-muted" />
              <input className="form-control form-control-sm" style={{ maxWidth: 280 }} placeholder="Search warranty #, product or customer…" value={regQ} onChange={(e) => { setRegQ(e.target.value); setRegPage(1); }} />
              <select className="form-select form-select-sm" style={{ width: 190 }} value={regStatus} onChange={(e) => { setRegStatus(e.target.value); setRegPage(1); }}>
                <option value="">Active only</option>
                <option value="all">All (incl. expired)</option>
              </select>
            </div>
          </div>

          {regs.error && <ErrorAlert message={regs.error} onRetry={regs.reload} />}
          {regs.loading && <Loading />}
          {!regs.loading && !regs.error && regItems.length === 0 && <EmptyState message="No warranty registrations found" />}

          {!regs.loading && !regs.error && regItems.length > 0 && (
            <>
              <div className="card">
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead>
                      <tr>
                        <th>Warranty #</th><th>Product</th><th>Serial number</th><th>Customer</th>
                        <th className="text-end">Months</th><th>Start</th><th>End</th>
                        <th className="text-end">Days left</th><th>Status</th>
                        {canManage && <th />}
                      </tr>
                    </thead>
                    <tbody>
                      {regItems.map((w: any) => (
                        <tr key={w.id}>
                          <td className="fw-semibold">{w.warranty_number}</td>
                          <td>{w.product || '—'}</td>
                          <td>{w.serial_number || '—'}</td>
                          <td>{w.customer || '—'}</td>
                          <td className="text-end">{w.warranty_months}</td>
                          <td>{fmtDate(w.start_date)}</td>
                          <td>{fmtDate(w.end_date)}</td>
                          <td className="text-end">{w.days_remaining}</td>
                          <td><Badge status={w.status} /></td>
                          {canManage && (
                            <td className="text-end">
                              <button className="btn btn-sm btn-outline-secondary" onClick={() => openCase(w)}>Open case</button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <Pagination page={regPage} pages={regs.data?.pages || 1} total={regs.data?.total} onPage={setRegPage} />
            </>
          )}
        </div>
      )}

      {tab === 'cases' && (
        <div>
          <div className="card mb-3">
            <div className="card-body d-flex flex-wrap gap-2 align-items-center">
              <i className="bi bi-search text-muted" />
              <input className="form-control form-control-sm" style={{ maxWidth: 280 }} placeholder="Search case #, product or customer…" value={caseQ} onChange={(e) => { setCaseQ(e.target.value); setCasePage(1); }} />
              <select className="form-select form-select-sm" style={{ width: 200 }} value={caseStatus} onChange={(e) => { setCaseStatus(e.target.value); setCasePage(1); }}>
                <option value="">All (excl. closed)</option>
                <option value="open">Open</option>
                <option value="under_inspection">Under inspection</option>
                <option value="approved">Approved</option>
                <option value="repairing">Repairing</option>
                <option value="replacement_pending">Replacement pending</option>
                <option value="resolved">Resolved</option>
                <option value="rejected">Rejected</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>

          {cases.error && <ErrorAlert message={cases.error} onRetry={cases.reload} />}
          {cases.loading && <Loading />}
          {!cases.loading && !cases.error && caseItems.length === 0 && <EmptyState message="No warranty cases found" />}

          {!cases.loading && !cases.error && caseItems.length > 0 && (
            <>
              <div className="card">
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead>
                      <tr>
                        <th>Case #</th><th>Product</th><th>Customer</th><th>Status</th>
                        <th>Issue</th><th>Due at</th><th>Overdue</th><th>Assigned to</th>
                      </tr>
                    </thead>
                    <tbody>
                      {caseItems.map((c: any) => (
                        <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(c)}>
                          <td className="fw-semibold">{c.case_number}</td>
                          <td>{c.product || '—'}</td>
                          <td>{c.customer || '—'}</td>
                          <td><Badge status={c.status} /></td>
                          <td><div className="text-truncate" style={{ maxWidth: 240 }} title={c.issue_description}>{c.issue_description}</div></td>
                          <td>{fmtDateTime(c.due_at)}</td>
                          <td>{c.is_overdue ? <Badge status="overdue" /> : <span className="text-muted">—</span>}</td>
                          <td>{c.assigned_to_name || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <Pagination page={casePage} pages={cases.data?.pages || 1} total={cases.data?.total} onPage={setCasePage} />
            </>
          )}
        </div>
      )}

      <Modal show={open} title="Open warranty case" onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveCase} disabled={busy}>{busy ? 'Saving…' : 'Open case'}</button>
          </>
        }
      >
        <form onSubmit={saveCase}>
          {error2 && <div className="alert alert-danger py-2 small">{error2}</div>}
          <Field label="Warranty registration" required>
            <SelectInput value={form.registration_id} onChange={(e) => set('registration_id', e.target.value)} required>
              <option value="">Select a registration…</option>
              {registrations.map((r) => (
                <option key={r.id} value={r.id}>{`${r.warranty_number} · ${r.product || '—'}${r.customer ? ` · ${r.customer}` : ''}`}</option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Issue description" required>
            <TextArea value={form.issue_description} onChange={(e) => set('issue_description', e.target.value)} rows={3} required />
          </Field>
          <Field label="Due in (days)" hint="The case becomes due this many days from now.">
            <TextInput type="number" step="1" min="1" value={form.due_days} onChange={(e) => set('due_days', e.target.value)} />
          </Field>
        </form>
      </Modal>

      <Modal show={!!detail} title={detail ? `Case ${detail.case_number}` : 'Warranty case'} onClose={() => setDetail(null)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setDetail(null)}>Close</button>
            {canManage && <button className="btn btn-primary" onClick={saveDetail} disabled={dBusy}>{dBusy ? 'Saving…' : 'Save changes'}</button>}
          </>
        }
      >
        {detail && (
          <form onSubmit={(e) => { e.preventDefault(); saveDetail(); }}>
            {dError && <div className="alert alert-danger py-2 small">{dError}</div>}
            <div className="row g-3 mb-3">
              <div className="col-6 col-md-3">
                <div className="small text-muted">Warranty #</div>
                <div className="fw-semibold">{detail.warranty_number || '—'}</div>
              </div>
              <div className="col-6 col-md-3">
                <div className="small text-muted">Product</div>
                <div>{detail.product || '—'}</div>
              </div>
              <div className="col-6 col-md-3">
                <div className="small text-muted">Customer</div>
                <div>{detail.customer || '—'}</div>
              </div>
              <div className="col-6 col-md-3">
                <div className="small text-muted">Serial number</div>
                <div>{detail.serial_number || '—'}</div>
              </div>
              <div className="col-6 col-md-3">
                <div className="small text-muted">Received</div>
                <div>{fmtDateTime(detail.received_at)}</div>
              </div>
              <div className="col-6 col-md-3">
                <div className="small text-muted">Due at</div>
                <div>{fmtDateTime(detail.due_at)}</div>
              </div>
              <div className="col-6 col-md-3">
                <div className="small text-muted">Assigned to</div>
                <div>{detail.assigned_to_name || '—'}</div>
              </div>
              {detail.repair_cost !== undefined && (
                <div className="col-6 col-md-3">
                  <div className="small text-muted">Repair cost</div>
                  <div className="money fw-semibold">{fmtMoney(detail.repair_cost)}</div>
                </div>
              )}
            </div>

            <div className="mb-3">
              <label className="form-label small fw-semibold">Status</label>
              {canManage ? (
                <SelectInput value={dForm.status} onChange={(e) => setDForm((f: any) => ({ ...f, status: e.target.value }))}>
                  {statusOptions.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </SelectInput>
              ) : (
                <div><Badge status={detail.status} /></div>
              )}
              {canManage && allowedNext.length > 0 && (
                <div className="form-text">Allowed next: {allowedNext.map((s) => s.replace(/_/g, ' ')).join(', ')}</div>
              )}
            </div>

            <Field label="Issue description">
              <div className="border rounded p-2 small">{detail.issue_description}</div>
            </Field>
            <Field label="Diagnosis">
              <TextInput value={dForm.diagnosis} onChange={(e) => setDForm((f: any) => ({ ...f, diagnosis: e.target.value }))} disabled={!canManage} />
            </Field>
            <Field label="Inspection notes">
              <TextArea value={dForm.inspection_notes} onChange={(e) => setDForm((f: any) => ({ ...f, inspection_notes: e.target.value }))} rows={2} disabled={!canManage} />
            </Field>
            <Field label="Resolution notes">
              <TextArea value={dForm.resolution_notes} onChange={(e) => setDForm((f: any) => ({ ...f, resolution_notes: e.target.value }))} rows={2} disabled={!canManage} />
            </Field>
            {detail.rejected_reason && <div className="alert alert-secondary py-2 small mb-0">Rejected: {detail.rejected_reason}</div>}
          </form>
        )}
      </Modal>
    </div>
  );
}
