'use client';

import { useState } from 'react';
import { useFetch, todayIso } from '@/lib/use-fetch';
import { api, can, fmtDate, fmtDateTime, fmtMoney } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { P } from '@/lib/permissions';
import { PageHeader, Loading, ErrorAlert, EmptyState, Pagination, Modal, Badge, ConfirmDialog } from '@/components/ui';
import { Field, TextInput, SelectInput, TextArea } from '@/components/form';

type Tab = 'shifts' | 'closings';

type ConfirmState = { title: string; message: string; run: () => void; danger?: boolean; label?: string } | null;

export default function ShopShiftsPage() {
  const { user } = useAuth();
  const canManage = can(user, P.shopShiftsManage);
  const canApprove = can(user, P.shopClosingApprove);

  const [tab, setTab] = useState<Tab>('shifts');

  const allTabs: { key: Tab; label: string; perm: string }[] = [
    { key: 'shifts', label: 'Shifts', perm: P.shopShiftsView },
    { key: 'closings', label: 'Daily closings', perm: P.shopClosingView },
  ];
  const tabs = allTabs.filter((t) => can(user, t.perm) || canManage);
  const active: Tab | '' = tabs.some((t) => t.key === tab) ? tab : (tabs[0]?.key || '');

  const [page, setPage] = useState(1);
  function goTab(t: Tab) { setTab(t); setPage(1); setRowErr(''); }

  const [shiftStatus, setShiftStatus] = useState('');
  const shifts = useFetch(active === 'shifts' ? '/api/shop/shifts' : '', [page, shiftStatus], {
    page, per_page: 15, status: shiftStatus || undefined,
  });
  const shiftItems = shifts.data?.items || [];
  // Money figures are only present for roles with shop financial visibility.
  const showShiftMoney = shiftItems.some((s: any) => s.total_sales !== undefined);

  const [closingStatus, setClosingStatus] = useState('');
  const closings = useFetch(active === 'closings' ? '/api/shop/closings' : '', [page, closingStatus], {
    page, per_page: 15, status: closingStatus || undefined,
  });
  const closingItems = closings.data?.items || [];
  const showClosingMoney = closingItems.some((c: any) => c.net_sales !== undefined);

  const [rowErr, setRowErr] = useState('');
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  async function act(path: string, reload: () => void, body: any = {}) {
    setRowErr('');
    try {
      await api(path, { method: 'POST', body });
      reload();
    } catch (err: any) {
      setRowErr(err.message);
    }
  }

  // ── branch options (no /api/branches endpoint: reuse list rows + balances) ─
  const [branchPool, setBranchPool] = useState<{ id: number; name: string }[]>([]);

  async function loadBranches() {
    try {
      const d: any = await api('/api/employees/branches');
      const list = (d.branches || []).map((b: any) => ({ id: b.id, name: b.name }));
      if (list.length) { setBranchPool(list); return; }
    } catch { /* shop roles may lack employees.view — fall back below */ }
    try {
      const d: any = await api('/api/shop/inventory/balances', { params: { per_page: 100 } });
      const seen = new Map<number, string>();
      (d.items || []).forEach((b: any) => {
        if (b.branch_id && !seen.has(b.branch_id)) seen.set(b.branch_id, b.branch);
      });
      setBranchPool(Array.from(seen, ([id, name]) => ({ id, name })));
    } catch {
      setBranchPool([]);
    }
  }

  function branchOptions(): { id: number; name: string }[] {
    const seen = new Map<number, string>();
    [...branchPool].forEach((b) => seen.set(b.id, b.name));
    [...shiftItems, ...closingItems].forEach((r: any) => {
      if (r.branch_id && r.branch && !seen.has(r.branch_id)) seen.set(r.branch_id, r.branch);
    });
    return Array.from(seen, ([id, name]) => ({ id, name }));
  }

  // ── open / close shift ────────────────────────────────────────────────────
  const [openOpen, setOpenOpen] = useState(false);
  const [openForm, setOpenForm] = useState({ branch_id: '', opening_float: '', notes: '' });
  const [openBusy, setOpenBusy] = useState(false);
  const [openErr, setOpenErr] = useState('');

  async function openShiftModal() {
    setOpenForm({ branch_id: '', opening_float: '', notes: '' });
    setOpenErr('');
    setOpenOpen(true);
    await loadBranches();
  }

  async function saveOpen(e: React.FormEvent) {
    e.preventDefault();
    setOpenBusy(true);
    setOpenErr('');
    try {
      await api('/api/shop/shifts', {
        method: 'POST',
        body: {
          branch_id: openForm.branch_id ? Number(openForm.branch_id) : undefined,
          opening_float: openForm.opening_float !== '' ? Number(openForm.opening_float) : 0,
          notes: openForm.notes || undefined,
        },
      });
      setOpenOpen(false);
      shifts.reload();
    } catch (err: any) {
      setOpenErr(err.message);
    } finally {
      setOpenBusy(false);
    }
  }

  const [closeShift, setCloseShift] = useState<any | null>(null);
  const [closeForm, setCloseForm] = useState({ counted_cash: '', notes: '' });
  const [closeBusy, setCloseBusy] = useState(false);
  const [closeErr, setCloseErr] = useState('');

  function openCloseModal(row: any) {
    setCloseShift(row);
    setCloseForm({ counted_cash: '', notes: '' });
    setCloseErr('');
  }

  async function saveClose(e: React.FormEvent) {
    e.preventDefault();
    setCloseBusy(true);
    setCloseErr('');
    try {
      await api(`/api/shop/shifts/${closeShift.id}/close`, {
        method: 'POST',
        body: {
          counted_cash: closeForm.counted_cash !== '' ? Number(closeForm.counted_cash) : 0,
          notes: closeForm.notes || undefined,
        },
      });
      setCloseShift(null);
      shifts.reload();
    } catch (err: any) {
      setCloseErr(err.message);
    } finally {
      setCloseBusy(false);
    }
  }

  // ── daily closing submit / review ─────────────────────────────────────────
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitForm, setSubmitForm] = useState({ branch_id: '', business_date: '', counted_cash: '', notes: '' });
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitErr, setSubmitErr] = useState('');

  async function openSubmitModal() {
    setSubmitForm({ branch_id: '', business_date: todayIso(), counted_cash: '', notes: '' });
    setSubmitErr('');
    setSubmitOpen(true);
    await loadBranches();
  }

  async function saveSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitBusy(true);
    setSubmitErr('');
    try {
      await api('/api/shop/closings', {
        method: 'POST',
        body: {
          branch_id: submitForm.branch_id ? Number(submitForm.branch_id) : undefined,
          business_date: submitForm.business_date || todayIso(),
          counted_cash: submitForm.counted_cash !== '' ? Number(submitForm.counted_cash) : 0,
          notes: submitForm.notes || undefined,
        },
      });
      setSubmitOpen(false);
      closings.reload();
    } catch (err: any) {
      setSubmitErr(err.message);
    } finally {
      setSubmitBusy(false);
    }
  }

  const [rejectTarget, setRejectTarget] = useState<any | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectBusy, setRejectBusy] = useState(false);
  const [rejectErr, setRejectErr] = useState('');

  async function saveReject(e: React.FormEvent) {
    e.preventDefault();
    setRejectBusy(true);
    setRejectErr('');
    try {
      await api(`/api/shop/closings/${rejectTarget.id}/reject`, {
        method: 'POST',
        body: { note: rejectNote || undefined },
      });
      setRejectTarget(null);
      closings.reload();
    } catch (err: any) {
      setRejectErr(err.message);
    } finally {
      setRejectBusy(false);
    }
  }

  const branches = branchOptions();

  return (
    <div>
      <PageHeader title="Shifts & Closings" subtitle="Till sessions and end-of-day cash reconciliation"
        actions={
          <>
            {active === 'shifts' && canManage && (
              <button className="btn btn-primary" onClick={openShiftModal}><i className="bi bi-unlock me-1" /> Open shift</button>
            )}
            {active === 'closings' && (canManage || can(user, P.shopClosingView)) && (
              <button className="btn btn-primary" onClick={openSubmitModal}><i className="bi bi-send me-1" /> Submit closing</button>
            )}
          </>
        } />

      <ul className="nav nav-pills mb-3">
        {tabs.map((t) => (
          <li className="nav-item me-1" key={t.key}>
            <button className={`nav-link py-1 px-3 ${active === t.key ? 'active' : ''}`} onClick={() => goTab(t.key)}>{t.label}</button>
          </li>
        ))}
      </ul>

      {rowErr && <div className="alert alert-danger py-2 small">{rowErr}</div>}
      {confirm && (
        <ConfirmDialog show={!!confirm} title={confirm.title} message={confirm.message} danger={confirm.danger}
          confirmLabel={confirm.label} onConfirm={() => confirm?.run()} onClose={() => setConfirm(null)} />
      )}

      {active === 'shifts' && (
        <div>
          <div className="card mb-3">
            <div className="card-body d-flex flex-wrap gap-2 align-items-center">
              <i className="bi bi-funnel text-muted" />
              <select className="form-select form-select-sm" style={{ width: 180 }} value={shiftStatus}
                onChange={(e) => { setShiftStatus(e.target.value); setPage(1); }}>
                <option value="">All shifts</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>

          {shifts.error && <ErrorAlert message={shifts.error} onRetry={shifts.reload} />}
          {shifts.loading && <Loading />}
          {!shifts.loading && !shifts.error && shiftItems.length === 0 && <EmptyState message="No shifts found" />}

          {!shifts.loading && !shifts.error && shiftItems.length > 0 && (
            <>
              <div className="card">
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead>
                      <tr>
                        <th>Shift #</th><th>Branch</th><th>Opened by</th><th>Opened at</th><th>Closed at</th>
                        <th className="text-end">Duration</th>
                        <th className="text-end">Sales</th><th>Status</th>
                        {showShiftMoney && <th className="text-end">Total sales</th>}
                        {showShiftMoney && <th className="text-end">Expected cash</th>}
                        {showShiftMoney && <th className="text-end">Counted cash</th>}
                        {showShiftMoney && <th className="text-end">Difference</th>}
                        {canManage && <th />}
                      </tr>
                    </thead>
                    <tbody>
                      {shiftItems.map((s: any) => (
                        <tr key={s.id}>
                          <td className="fw-semibold">{s.shift_number}</td>
                          <td>{s.branch || '—'}</td>
                          <td>{s.opened_by_name || '—'}</td>
                          <td>{fmtDateTime(s.opened_at)}</td>
                          <td>{fmtDateTime(s.closed_at)}</td>
                          <td className="text-end">{s.duration_minutes != null ? `${s.duration_minutes}m` : '—'}</td>
                          <td className="text-end">{s.sale_count}</td>
                          <td><Badge status={s.status} /></td>
                          {showShiftMoney && <td className="text-end money fw-semibold">{fmtMoney(s.total_sales)}</td>}
                          {showShiftMoney && <td className="text-end money">{fmtMoney(s.expected_cash)}</td>}
                          {showShiftMoney && <td className="text-end money">{fmtMoney(s.counted_cash)}</td>}
                          {showShiftMoney && (
                            <td className={`text-end money fw-semibold ${(s.cash_difference || 0) !== 0 ? 'text-danger' : 'text-success'}`}>
                              {fmtMoney(s.cash_difference)}
                            </td>
                          )}
                          {canManage && (
                            <td className="text-end">
                              {s.status === 'open' && (
                                <button className="btn btn-sm btn-outline-primary" onClick={() => openCloseModal(s)}>Close</button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <Pagination page={page} pages={shifts.data?.pages || 1} total={shifts.data?.total} onPage={setPage} />
            </>
          )}
        </div>
      )}

      {active === 'closings' && (
        <div>
          <div className="card mb-3">
            <div className="card-body d-flex flex-wrap gap-2 align-items-center">
              <i className="bi bi-funnel text-muted" />
              <select className="form-select form-select-sm" style={{ width: 210 }} value={closingStatus}
                onChange={(e) => { setClosingStatus(e.target.value); setPage(1); }}>
                <option value="">All closings</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="correction_requested">Correction requested</option>
              </select>
            </div>
          </div>

          {closings.error && <ErrorAlert message={closings.error} onRetry={closings.reload} />}
          {closings.loading && <Loading />}
          {!closings.loading && !closings.error && closingItems.length === 0 && <EmptyState message="No daily closings found" />}

          {!closings.loading && !closings.error && closingItems.length > 0 && (
            <>
              <div className="card">
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead>
                      <tr>
                        <th>Closing #</th><th>Branch</th><th>Business date</th><th>Status</th>
                        {showClosingMoney && <th className="text-end">Net sales</th>}
                        {showClosingMoney && <th className="text-end">Expected cash</th>}
                        {showClosingMoney && <th className="text-end">Counted cash</th>}
                        {showClosingMoney && <th className="text-end">Difference</th>}
                        <th>Submitted</th><th>Reviewed</th>
                        {canApprove && <th />}
                      </tr>
                    </thead>
                    <tbody>
                      {closingItems.map((c: any) => (
                        <tr key={c.id}>
                          <td className="fw-semibold">{c.closing_number}</td>
                          <td>{c.branch || '—'}</td>
                          <td>{fmtDate(c.business_date)}</td>
                          <td><Badge status={c.status} /></td>
                          {showClosingMoney && <td className="text-end money fw-semibold">{fmtMoney(c.net_sales)}</td>}
                          {showClosingMoney && <td className="text-end money">{fmtMoney(c.expected_cash)}</td>}
                          {showClosingMoney && <td className="text-end money">{fmtMoney(c.counted_cash)}</td>}
                          {showClosingMoney && (
                            <td className={`text-end money fw-semibold ${(c.cash_difference || 0) !== 0 ? 'text-danger' : 'text-success'}`}>
                              {fmtMoney(c.cash_difference)}
                            </td>
                          )}
                          <td>{fmtDateTime(c.submitted_at)}</td>
                          <td>{fmtDateTime(c.reviewed_at)}</td>
                          {canApprove && (
                            <td className="text-end">
                              {c.status === 'submitted' && (
                                <>
                                  <button className="btn btn-sm btn-outline-success me-1"
                                    onClick={() => setConfirm({
                                      title: 'Approve closing',
                                      message: `Approve closing ${c.closing_number} for ${fmtDate(c.business_date)}? Figures become final.`,
                                      danger: false,
                                      label: 'Approve',
                                      run: () => act(`/api/shop/closings/${c.id}/approve`, closings.reload),
                                    })}>Approve</button>
                                  <button className="btn btn-sm btn-outline-danger" onClick={() => { setRejectTarget(c); setRejectNote(''); setRejectErr(''); }}>Reject</button>
                                </>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <Pagination page={page} pages={closings.data?.pages || 1} total={closings.data?.total} onPage={setPage} />
            </>
          )}
        </div>
      )}

      <Modal show={openOpen} title="Open shift" onClose={() => setOpenOpen(false)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setOpenOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveOpen} disabled={openBusy}>{openBusy ? 'Opening…' : 'Open shift'}</button>
          </>
        }
      >
        <form onSubmit={saveOpen}>
          {openErr && <div className="alert alert-danger py-2 small">{openErr}</div>}
          <Field label="Branch" hint="Leave empty when your account is already tied to one branch.">
            <SelectInput value={openForm.branch_id} onChange={(e) => setOpenForm((f) => ({ ...f, branch_id: e.target.value }))}>
              <option value="">My branch (default)</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </SelectInput>
          </Field>
          <Field label="Opening float" required hint="Cash placed in the drawer before trading.">
            <TextInput type="number" step="0.01" min="0" required value={openForm.opening_float}
              onChange={(e) => setOpenForm((f) => ({ ...f, opening_float: e.target.value }))} />
          </Field>
          <Field label="Notes"><TextArea rows={2} value={openForm.notes} onChange={(e) => setOpenForm((f) => ({ ...f, notes: e.target.value }))} /></Field>
        </form>
      </Modal>

      <Modal show={!!closeShift} title={closeShift ? `Close ${closeShift.shift_number}` : 'Close shift'} onClose={() => setCloseShift(null)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setCloseShift(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveClose} disabled={closeBusy}>{closeBusy ? 'Closing…' : 'Close shift'}</button>
          </>
        }
      >
        <form onSubmit={saveClose}>
          {closeErr && <div className="alert alert-danger py-2 small">{closeErr}</div>}
          {closeShift && showShiftMoney && (
            <div className="row g-3 mb-3">
              <div className="col-6">
                <div className="small text-muted">Expected cash</div>
                <div className="money fw-semibold">{fmtMoney(closeShift.expected_cash)}</div>
              </div>
              <div className="col-6">
                <div className="small text-muted">Sales</div>
                <div className="money fw-semibold">{fmtMoney(closeShift.total_sales)}</div>
              </div>
            </div>
          )}
          <Field label="Counted cash" required hint="What you physically counted in the drawer.">
            <TextInput type="number" step="0.01" min="0" required value={closeForm.counted_cash}
              onChange={(e) => setCloseForm((f) => ({ ...f, counted_cash: e.target.value }))} />
          </Field>
          <Field label="Notes"><TextArea rows={2} value={closeForm.notes} onChange={(e) => setCloseForm((f) => ({ ...f, notes: e.target.value }))} /></Field>
        </form>
      </Modal>

      <Modal show={submitOpen} title="Submit daily closing" onClose={() => setSubmitOpen(false)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setSubmitOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveSubmit} disabled={submitBusy}>{submitBusy ? 'Submitting…' : 'Submit closing'}</button>
          </>
        }
      >
        <form onSubmit={saveSubmit}>
          {submitErr && <div className="alert alert-danger py-2 small">{submitErr}</div>}
          <div className="row">
            <div className="col-md-6">
              <Field label="Branch" hint="Leave empty when your account is already tied to one branch.">
                <SelectInput value={submitForm.branch_id} onChange={(e) => setSubmitForm((f) => ({ ...f, branch_id: e.target.value }))}>
                  <option value="">My branch (default)</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </SelectInput>
              </Field>
            </div>
            <div className="col-md-6">
              <Field label="Business date" required>
                <TextInput type="date" required value={submitForm.business_date}
                  onChange={(e) => setSubmitForm((f) => ({ ...f, business_date: e.target.value }))} />
              </Field>
            </div>
          </div>
          <Field label="Counted cash" required hint="Expected cash is recomputed by the server from the sales ledger.">
            <TextInput type="number" step="0.01" min="0" required value={submitForm.counted_cash}
              onChange={(e) => setSubmitForm((f) => ({ ...f, counted_cash: e.target.value }))} />
          </Field>
          <Field label="Notes"><TextArea rows={2} value={submitForm.notes} onChange={(e) => setSubmitForm((f) => ({ ...f, notes: e.target.value }))} /></Field>
        </form>
      </Modal>

      <Modal show={!!rejectTarget} title={rejectTarget ? `Reject ${rejectTarget.closing_number}` : 'Reject closing'} onClose={() => setRejectTarget(null)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setRejectTarget(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={saveReject} disabled={rejectBusy}>{rejectBusy ? 'Rejecting…' : 'Reject closing'}</button>
          </>
        }
      >
        <form onSubmit={saveReject}>
          {rejectErr && <div className="alert alert-danger py-2 small">{rejectErr}</div>}
          <Field label="Reason" hint="Sent to whoever submitted the closing.">
            <TextArea rows={3} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder="What needs correcting?" />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
