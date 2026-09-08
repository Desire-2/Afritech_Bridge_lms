'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useFetch } from '@/lib/use-fetch';
import { api, fmtMoney, fmtDate } from '@/lib/api';
import { PageHeader, Loading, ErrorAlert, EmptyState, Badge, Modal, ConfirmDialog, StatCard } from '@/components/ui';
import { Field, TextInput, SelectInput } from '@/components/form';

function PayrollInner() {
  const params = useSearchParams();
  const periodParam = params.get('period');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ name: '', period_start: '', period_end: '', branch_id: '' });
  const [busy, setBusy] = useState(false);
  const [error2, setError2] = useState('');
  const { data, error, loading, reload } = useFetch('/api/payroll/periods', [page], { page, per_page: 12 });
  const [activeId, setActiveId] = useState<string | null>(periodParam);
  const { data: detail, error: detailErr, reload: reloadDetail } = useFetch<any>(activeId ? `/api/payroll/periods/${activeId}` : null, [activeId]);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [itemForm, setItemForm] = useState<any>({ bonus: '', deduction: '', advance: '', adjustment: '', note: '' });
  const [confirmStatus, setConfirmStatus] = useState<any | null>(null);

  const periods = data?.items || [];
  const items = detail?.period?.items || [];
  const pd = detail?.period;

  async function createPeriod(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError2('');
    try {
      const d: any = await api('/api/payroll/periods', {
        method: 'POST',
        body: { name: form.name, period_start: form.period_start, period_end: form.period_end, branch_id: form.branch_id ? Number(form.branch_id) : undefined },
      });
      setOpen(false);
      setActiveId(String(d.period.id));
      reload();
    } catch (err: any) {
      setError2(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function recalc() {
    if (!activeId) return;
    const d: any = await api(`/api/payroll/periods/${activeId}/recalculate`, { method: 'POST' });
    reloadDetail();
  }

  async function saveItem(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError2('');
    try {
      const body: any = { note: itemForm.note || undefined };
      ['bonus', 'deduction', 'advance', 'adjustment'].forEach((k) => {
        if (itemForm[k] !== '') body[k] = Number(itemForm[k]);
      });
      await api(`/api/payroll/items/${editItem.id}`, { method: 'PUT', body });
      setEditItem(null);
      reloadDetail();
    } catch (err: any) {
      setError2(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(next: string) {
    if (!activeId) return;
    setBusy(true);
    setError2('');
    try {
      await api(`/api/payroll/periods/${activeId}/status`, { method: 'POST', body: { status: next } });
      setConfirmStatus(null);
      reloadDetail();
      reload();
    } catch (err: any) {
      setError2(err.message);
    } finally {
      setBusy(false);
    }
  }

  const nextStatus = pd?.status === 'draft' ? 'reviewed' : pd?.status === 'reviewed' ? 'approved' : pd?.status === 'approved' ? 'paid' : null;

  return (
    <div>
      <PageHeader title="Payroll" subtitle="Payroll periods, commissions and adjustments"
        actions={<button className="btn btn-primary" onClick={() => { setOpen(true); setError2(''); }}><i className="bi bi-plus-circle me-1" /> New period</button>} />

      <div className="row g-4">
        <div className="col-lg-4">
          <div className="card">
            <div className="card-body">
              <h6 className="card-title fw-semibold">Payroll periods</h6>
              {error && <ErrorAlert message={error} onRetry={reload} />}
              {loading && <Loading />}
              {!loading && !error && periods.length === 0 && <EmptyState message="No payroll periods yet" />}
              {(periods || []).map((p: any) => (
                <div key={p.id} className={`d-flex justify-content-between align-items-center py-2 border-bottom small rounded px-2 ${String(p.id) === activeId ? 'bg-light' : ''}`}>
                  <button className="btn btn-link btn-sm p-0 text-start text-decoration-none" onClick={() => setActiveId(String(p.id))}>
                    <div className="fw-semibold">{p.name}</div>
                    <div className="text-muted">{fmtDate(p.period_start)} → {fmtDate(p.period_end)} · {p.item_count} items</div>
                  </button>
                  <div className="text-end">
                    <Badge status={p.status} />
                    <div className="money fw-semibold small">{fmtMoney(p.total_net)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-lg-8">
          {!activeId ? (
            <div className="card"><div className="card-body"><EmptyState message="Select a payroll period" /></div></div>
          ) : detailErr ? (
            <ErrorAlert message={detailErr} onRetry={reloadDetail} />
          ) : !pd ? (
            <Loading />
          ) : (
            <>
              <div className="card mb-3">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <div>
                      <h5 className="h6 fw-semibold mb-1">{pd.name}</h5>
                      <div className="small text-muted">{fmtDate(pd.period_start)} → {fmtDate(pd.period_end)}</div>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <Badge status={pd.status} />
                      <button className="btn btn-sm btn-outline-secondary" onClick={recalc}><i className="bi bi-arrow-counterclockwise me-1" /> Recalculate</button>
                      {nextStatus && (
                        <button className="btn btn-sm btn-primary" onClick={() => setConfirmStatus(nextStatus)}>
                          {pd.status === 'draft' ? 'Send for review' : pd.status === 'reviewed' ? 'Approve' : 'Mark paid'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="row g-3 mb-3">
                <StatCard label="Total gross" value={fmtMoney(pd.total_gross)} tone="primary" icon="bi-cash-stack" />
                <StatCard label="Commission items" value={pd.total_commission_items} tone="warning" icon="bi-percent" />
                <StatCard label="Total net" value={fmtMoney(pd.total_net)} tone="success" icon="bi-wallet2" />
              </div>

              <div className="card">
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead>
                      <tr><th>Employee</th><th className="text-end">Base</th><th className="text-end">Commission</th><th className="text-end">Bonus</th><th className="text-end">Deduction</th><th className="text-end">Advance</th><th className="text-end">Adjustment</th><th className="text-end">Net</th><th /></tr>
                    </thead>
                    <tbody>
                      {items.length === 0 && <tr><td colSpan={9}><EmptyState message="No items in this period" /></td></tr>}
                      {items.map((it: any) => (
                        <tr key={it.id}>
                          <td className="fw-semibold">{it.employee_name}</td>
                          <td className="text-end money">{fmtMoney(it.base_salary)}</td>
                          <td className="text-end money text-warning">{fmtMoney(it.commission)}</td>
                          <td className="text-end money text-success">{fmtMoney(it.bonus)}</td>
                          <td className="text-end money text-danger">{fmtMoney(it.deduction)}</td>
                          <td className="text-end money">{fmtMoney(it.advance)}</td>
                          <td className="text-end money">{fmtMoney(it.adjustment)}</td>
                          <td className="text-end money fw-semibold">{fmtMoney(it.net_salary)}</td>
                          <td className="text-end">
                            {pd.status === 'draft' && (
                              <button className="btn btn-sm btn-outline-secondary" onClick={() => { setEditItem(it); setItemForm({ bonus: it.bonus ?? '', deduction: it.deduction ?? '', advance: it.advance ?? '', adjustment: it.adjustment ?? '', note: it.note || '' }); setError2(''); }}>
                                <i className="bi bi-pencil" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <Modal show={open} title="New payroll period" onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={createPeriod} disabled={busy}>{busy ? 'Creating…' : 'Create'}</button>
          </>
        }
      >
        {error2 && <div className="alert alert-danger py-2 small">{error2}</div>}
        <form onSubmit={createPeriod}>
          <Field label="Name" required><TextInput value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. September 2026" required /></Field>
          <div className="row">
            <div className="col-md-6"><Field label="Period start" required><TextInput type="date" value={form.period_start} onChange={(e) => setForm((f) => ({ ...f, period_start: e.target.value }))} required /></Field></div>
            <div className="col-md-6"><Field label="Period end" required><TextInput type="date" value={form.period_end} onChange={(e) => setForm((f) => ({ ...f, period_end: e.target.value }))} required /></Field></div>
          </div>
          <p className="small text-muted mb-0">The period will include all active employees and their completed-transaction commissions within the date range.</p>
        </form>
      </Modal>

      <Modal show={!!editItem} title={`Adjust payroll — ${editItem?.employee_name || ''}`} onClose={() => setEditItem(null)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setEditItem(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveItem} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        {error2 && <div className="alert alert-danger py-2 small">{error2}</div>}
        <form onSubmit={saveItem}>
          <div className="row">
            <div className="col-md-6"><Field label="Bonus"><TextInput type="number" step="0.01" value={itemForm.bonus} onChange={(e) => setItemForm((f) => ({ ...f, bonus: e.target.value }))} /></Field></div>
            <div className="col-md-6"><Field label="Deduction"><TextInput type="number" step="0.01" value={itemForm.deduction} onChange={(e) => setItemForm((f) => ({ ...f, deduction: e.target.value }))} /></Field></div>
          </div>
          <div className="row">
            <div className="col-md-6"><Field label="Advance"><TextInput type="number" step="0.01" value={itemForm.advance} onChange={(e) => setItemForm((f) => ({ ...f, advance: e.target.value }))} /></Field></div>
            <div className="col-md-6"><Field label="Adjustment"><TextInput type="number" step="0.01" value={itemForm.adjustment} onChange={(e) => setItemForm((f) => ({ ...f, adjustment: e.target.value }))} /></Field></div>
          </div>
          <Field label="Note"><TextInput value={itemForm.note} onChange={(e) => setItemForm((f) => ({ ...f, note: e.target.value }))} /></Field>
        </form>
      </Modal>

      <ConfirmDialog
        show={!!confirmStatus}
        title={`Mark period as "${confirmStatus}"`}
        message={confirmStatus === 'paid' ? 'Wages are marked paid. This is the final step.' : `Move this payroll period to "${confirmStatus}"?`}
        confirmLabel={confirmStatus || ''}
        onConfirm={() => changeStatus(confirmStatus!)}
        onClose={() => setConfirmStatus(null)}
        danger={confirmStatus === 'paid'}
      />
    </div>
  );
}

export default function PayrollPage() {
  return (
    <Suspense>
      <PayrollInner />
    </Suspense>
  );
}