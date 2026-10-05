'use client';

import { useState } from 'react';
import { useFetch, todayIso, yearAgoIso } from '@/lib/use-fetch';
import { api, can, fmtMoney, fmtDateTime } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { P } from '@/lib/permissions';
import { PageHeader, Loading, ErrorAlert, EmptyState, Pagination, Modal, ConfirmDialog, Badge } from '@/components/ui';
import { Field, TextInput, SelectInput, TextArea, DateRange } from '@/components/form';

type Tab = 'sales' | 'returns';

const TOTAL_LABELS: Record<string, string> = {
  subtotal: 'Subtotal',
  discount_amount: 'Discount',
  tax_amount: 'Tax',
  total_amount: 'Total',
  amount_paid: 'Amount paid',
  amount_due: 'Amount due',
  change_given: 'Change given',
  amount_refunded: 'Amount refunded',
};

const TOTAL_KEYS = Object.keys(TOTAL_LABELS);

const CONDITIONS = ['good', 'damaged', 'under_inspection', 'incomplete'];

export default function ShopSalesPage() {
  const { user } = useAuth();
  const canSales = can(user, P.shopSalesView) || can(user, P.shopSalesViewAll);
  const canReturns = can(user, P.shopReturnsView) || can(user, P.shopSalesView);
  const canCancel = can(user, P.shopSalesCancel);
  const canCreateReturn = can(user, P.shopReturnsCreate);
  const canReview = can(user, P.shopReturnsApprove) || can(user, P.shopSalesRefund);
  const canReceive = can(user, P.shopReturnsCreate) || can(user, P.shopReturnsApprove);

  const [tab, setTab] = useState<Tab>(canSales ? 'sales' : 'returns');

  // ── sales list ─────────────────────────────────────────────────────────────
  const [sPage, setSPage] = useState(1);
  const [sStatus, setSStatus] = useState('');
  const [sQ, setSQ] = useState('');
  const [sStart, setSStart] = useState(yearAgoIso());
  const [sEnd, setSEnd] = useState(todayIso());
  const salesPath = tab === 'sales' && canSales ? '/api/shop/sales' : '';
  const { data: salesData, error: salesError, loading: salesLoading, reload: reloadSales } = useFetch(
    salesPath,
    [sPage, sStatus, sQ, sStart, sEnd],
    { page: sPage, per_page: 15, status: sStatus || undefined, q: sQ || undefined, start: sStart, end: sEnd }
  );
  const sales = salesData?.items || [];
  const showDue = sales.some((s: any) => s.amount_due !== undefined && s.amount_due !== null);

  // ── returns list ───────────────────────────────────────────────────────────
  const [rPage, setRPage] = useState(1);
  const [rStatus, setRStatus] = useState('');
  const returnsPath = tab === 'returns' && canReturns ? '/api/shop/returns' : '';
  const { data: returnsData, error: returnsError, loading: returnsLoading, reload: reloadReturns } = useFetch(
    returnsPath,
    [rPage, rStatus],
    { page: rPage, per_page: 15, status: rStatus || undefined }
  );
  const returns = returnsData?.items || [];
  const showRefund = returns.some((r: any) => r.refund_amount !== undefined && r.refund_amount !== null);

  // ── sale detail + receipt ──────────────────────────────────────────────────
  const [saleId, setSaleId] = useState<number | null>(null);
  const [saleDetail, setSaleDetail] = useState<any | null>(null);
  const [saleDetailErr, setSaleDetailErr] = useState('');
  const [saleDetailLoading, setSaleDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionErr, setActionErr] = useState('');
  const [cancelling, setCancelling] = useState<any | null>(null);
  const [cancelErr, setCancelErr] = useState('');
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receipt, setReceipt] = useState<any | null>(null);
  const [receiptErr, setReceiptErr] = useState('');
  const [receiptLoading, setReceiptLoading] = useState(false);

  async function fetchSale(id: number) {
    setSaleDetailLoading(true);
    setSaleDetailErr('');
    try {
      const d: any = await api(`/api/shop/sales/${id}`);
      setSaleDetail(d.sale);
    } catch (err: any) {
      setSaleDetailErr(err.message);
    } finally {
      setSaleDetailLoading(false);
    }
  }

  function openSale(id: number) {
    setSaleId(id);
    setSaleDetail(null);
    setActionErr('');
    fetchSale(id);
  }

  async function fetchReceipt(id: number) {
    setReceiptLoading(true);
    setReceiptErr('');
    try {
      const d: any = await api(`/api/shop/sales/${id}/receipt`);
      setReceipt(d.receipt);
    } catch (err: any) {
      setReceiptErr(err.message);
    } finally {
      setReceiptLoading(false);
    }
  }

  function openReceipt(id: number) {
    setReceipt(null);
    setReceiptOpen(true);
    fetchReceipt(id);
  }

  async function confirmCancel() {
    const target = cancelling;
    if (!target) return;
    setBusy(true);
    setCancelErr('');
    try {
      await api(`/api/shop/sales/${target.id}/cancel`, {
        method: 'POST',
        body: { reason: 'Cancelled from sales list' },
      });
      setCancelling(null);
      reloadSales();
      if (saleId === target.id) fetchSale(target.id);
    } catch (err: any) {
      setCancelErr(err.message);
    } finally {
      setBusy(false);
    }
  }

  // ── return detail + actions ────────────────────────────────────────────────
  const [retId, setRetId] = useState<number | null>(null);
  const [retDetail, setRetDetail] = useState<any | null>(null);
  const [retDetailErr, setRetDetailErr] = useState('');
  const [retDetailLoading, setRetDetailLoading] = useState(false);
  const [retActionErr, setRetActionErr] = useState('');
  const [approveFor, setApproveFor] = useState<any | null>(null);
  const [receiveFor, setReceiveFor] = useState<any | null>(null);
  const [rejectFor, setRejectFor] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectErr, setRejectErr] = useState('');
  const [rejectBusy, setRejectBusy] = useState(false);

  async function fetchReturn(id: number) {
    setRetDetailLoading(true);
    setRetDetailErr('');
    try {
      const d: any = await api(`/api/shop/returns/${id}`);
      setRetDetail(d.return);
    } catch (err: any) {
      setRetDetailErr(err.message);
    } finally {
      setRetDetailLoading(false);
    }
  }

  function openReturn(id: number) {
    setRetId(id);
    setRetDetail(null);
    setRetActionErr('');
    fetchReturn(id);
  }

  async function returnAction(id: number, path: string, body?: any) {
    setBusy(true);
    setRetActionErr('');
    try {
      await api(path, { method: 'POST', body });
      reloadReturns();
      await fetchReturn(id);
    } catch (err: any) {
      setRetActionErr(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmReject() {
    const target = rejectFor;
    if (!target) return;
    setRejectBusy(true);
    setRejectErr('');
    try {
      await api(`/api/shop/returns/${target.id}/approve`, {
        method: 'POST',
        body: { decision: 'rejected', note: rejectReason || undefined },
      });
      setRejectFor(null);
      setRejectReason('');
      reloadReturns();
      await fetchReturn(target.id);
    } catch (err: any) {
      setRejectErr(err.message);
    } finally {
      setRejectBusy(false);
    }
  }

  // ── new return ─────────────────────────────────────────────────────────────
  const [newOpen, setNewOpen] = useState(false);
  const [nQ, setNQ] = useState('');
  const [nSearched, setNSearched] = useState(false);
  const [nSearching, setNSearching] = useState(false);
  const [nResults, setNResults] = useState<any[]>([]);
  const [nSale, setNSale] = useState<any | null>(null);
  const [nType, setNType] = useState('refund');
  const [nReason, setNReason] = useState('');
  const [nItems, setNItems] = useState<Record<number, any>>({});
  const [nBusy, setNBusy] = useState(false);
  const [nErr, setNErr] = useState('');

  function closeNewReturn() {
    setNewOpen(false);
    setNQ('');
    setNSearched(false);
    setNResults([]);
    setNSale(null);
    setNType('refund');
    setNReason('');
    setNItems({});
    setNErr('');
  }

  async function searchSales() {
    setNSearching(true);
    setNErr('');
    try {
      const d: any = await api('/api/shop/sales', { params: { q: nQ || undefined, per_page: 10 } });
      setNResults(d.items || []);
      setNSearched(true);
    } catch (err: any) {
      setNErr(err.message);
      setNResults([]);
      setNSearched(true);
    } finally {
      setNSearching(false);
    }
  }

  async function pickSale(row: any) {
    setNErr('');
    setNSale(null);
    setNItems({});
    try {
      const d: any = await api(`/api/shop/sales/${row.id}`);
      const items = ((d.sale?.items || []) as any[]).filter((i) => Number(i.returnable_quantity || 0) > 0);
      setNSale({ ...(d.sale || {}), items });
      const init: Record<number, any> = {};
      items.forEach((i) => { init[i.id] = { quantity: 1, condition: 'good', restock: true }; });
      setNItems(init);
    } catch (err: any) {
      setNErr(err.message);
    }
  }

  function updateNItem(id: number, patch: any) {
    setNItems((m) => ({ ...m, [id]: { ...m[id], ...patch } }));
  }

  async function submitReturn() {
    if (!nSale) { setNErr('Pick a sale first'); return; }
    const items = Object.entries(nItems)
      .filter(([, v]) => Number(v.quantity) > 0)
      .map(([id, v]) => ({
        sale_item_id: Number(id),
        quantity: Number(v.quantity),
        condition: v.condition,
        restock: !!v.restock,
      }));
    if (!items.length) { setNErr('Set a quantity on at least one item'); return; }
    if (!nReason.trim()) { setNErr('A reason is required'); return; }
    setNBusy(true);
    setNErr('');
    try {
      await api('/api/shop/returns', {
        method: 'POST',
        body: { sale_id: nSale.id, return_type: nType, reason: nReason, items },
      });
      closeNewReturn();
      setTab('returns');
      setRPage(1);
      reloadReturns();
    } catch (err: any) {
      setNErr(err.message);
    } finally {
      setNBusy(false);
    }
  }

  const tabs: { key: Tab; label: string }[] = [];
  if (canSales) tabs.push({ key: 'sales', label: 'Sales' });
  if (canReturns) tabs.push({ key: 'returns', label: 'Returns' });

  const retShowMoney = retDetail && (retDetail.items || []).some((i: any) => i.line_total !== undefined && i.line_total !== null);
  const saleItemMoney = saleDetail && (saleDetail.items || []).some((i: any) => i.line_total !== undefined && i.line_total !== null);
  const showPayments = !!(saleDetail && saleDetail.payments && saleDetail.payments.length);

  function cancelable(row: any) {
    if (!canCancel) return false;
    if (row.status === 'cancelled' || row.status === 'refunded') return false;
    if (row.status === 'completed' && Number(row.amount_paid || 0) > 0) return false;
    return true;
  }

  return (
    <div>
      <PageHeader title="Sales & Returns" subtitle="Shop transactions, receipts and customer returns" />

      <ul className="nav nav-pills mb-3">
        {tabs.map((t) => (
          <li className="nav-item me-1" key={t.key}>
            <button className={`nav-link py-1 px-3 ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
          </li>
        ))}
      </ul>

      {tab === 'sales' && canSales && (
        <div>
          <div className="card mb-3">
            <div className="card-body d-flex flex-wrap gap-2 align-items-center">
              <i className="bi bi-search text-muted" />
              <input className="form-control form-control-sm border-0 shadow-none" style={{ maxWidth: 240 }}
                placeholder="Search sale number or customer…" value={sQ}
                onChange={(e) => { setSQ(e.target.value); setSPage(1); }} />
              <select className="form-select form-select-sm" style={{ width: 190 }} value={sStatus}
                onChange={(e) => { setSStatus(e.target.value); setSPage(1); }}>
                <option value="">All statuses</option>
                <option value="completed">Completed</option>
                <option value="partially_refunded">Partially refunded</option>
                <option value="refunded">Refunded</option>
                <option value="cancelled">Cancelled</option>
                <option value="held">Held</option>
              </select>
              <DateRange start={sStart} end={sEnd}
                onStart={(v) => { setSStart(v); setSPage(1); }}
                onEnd={(v) => { setSEnd(v); setSPage(1); }} />
            </div>
          </div>

          {cancelErr && <div className="alert alert-danger py-2 small">{cancelErr}</div>}
          {salesError && <ErrorAlert message={salesError} onRetry={reloadSales} />}
          {salesLoading && <Loading />}
          {!salesLoading && !salesError && sales.length === 0 && <EmptyState message="No sales found" />}

          {!salesLoading && !salesError && sales.length > 0 && (
            <>
              <div className="card">
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead>
                      <tr>
                        <th>Sale</th><th>Date</th><th>Customer</th><th>Branch</th>
                        <th className="text-end">Items</th>
                        <th>Payment</th><th>Status</th>
                        <th className="text-end">Total</th>
                        {showDue && <th className="text-end">Due</th>}
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {sales.map((s: any) => (
                        <tr key={s.id}>
                          <td><div className="fw-semibold">{s.sale_number}</div><div className="small text-muted">{s.sale_type}</div></td>
                          <td className="text-nowrap">{fmtDateTime(s.created_at)}</td>
                          <td>{s.customer || 'Walk-in'}</td>
                          <td>{s.branch || '—'}</td>
                          <td className="text-end">{s.item_count}</td>
                          <td><Badge status={s.payment_status} /></td>
                          <td><Badge status={s.status} /></td>
                          <td className="text-end money fw-semibold">{fmtMoney(s.total_amount)}</td>
                          {showDue && (
                            <td className="text-end money">
                              {s.amount_due !== undefined && s.amount_due !== null ? fmtMoney(s.amount_due) : '—'}
                            </td>
                          )}
                          <td className="text-end text-nowrap">
                            <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => openSale(s.id)}>
                              <i className="bi bi-eye me-1" />View
                            </button>
                            {cancelable(s) && (
                              <button className="btn btn-sm btn-outline-danger"
                                onClick={() => { setCancelErr(''); setCancelling(s); }}>
                                <i className="bi bi-x-circle me-1" />Cancel
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <Pagination page={sPage} pages={salesData?.pages || 1} total={salesData?.total} onPage={setSPage} />
            </>
          )}
        </div>
      )}

      {tab === 'returns' && canReturns && (
        <div>
          <div className="card mb-3">
            <div className="card-body d-flex flex-wrap gap-2 align-items-center">
              <select className="form-select form-select-sm" style={{ width: 190 }} value={rStatus}
                onChange={(e) => { setRStatus(e.target.value); setRPage(1); }}>
                <option value="">All statuses</option>
                <option value="requested">Requested</option>
                <option value="received">Received</option>
                <option value="rejected">Rejected</option>
                <option value="completed">Completed</option>
              </select>
              {canCreateReturn && (
                <button className="btn btn-primary btn-sm ms-auto" onClick={() => { setNErr(''); setNewOpen(true); }}>
                  <i className="bi bi-plus-circle me-1" />New return
                </button>
              )}
            </div>
          </div>

          {returnsError && <ErrorAlert message={returnsError} onRetry={reloadReturns} />}
          {returnsLoading && <Loading />}
          {!returnsLoading && !returnsError && returns.length === 0 && <EmptyState message="No returns found" />}

          {!returnsLoading && !returnsError && returns.length > 0 && (
            <>
              <div className="card">
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead>
                      <tr>
                        <th>Return</th><th>Sale</th><th>Date</th><th>Type</th><th>Customer</th>
                        <th>Status</th>
                        {showRefund && <th className="text-end">Refund</th>}
                        <th>Reason</th><th />
                      </tr>
                    </thead>
                    <tbody>
                      {returns.map((r: any) => (
                        <tr key={r.id}>
                          <td className="fw-semibold">{r.return_number}</td>
                          <td>{r.sale_number || '—'}</td>
                          <td className="text-nowrap">{fmtDateTime(r.created_at)}</td>
                          <td className="text-uppercase small fw-semibold">{r.return_type}</td>
                          <td>{r.customer || 'Walk-in'}</td>
                          <td><Badge status={r.status} /></td>
                          {showRefund && (
                            <td className="text-end money fw-semibold">
                              {r.refund_amount !== undefined && r.refund_amount !== null ? fmtMoney(r.refund_amount) : '—'}
                            </td>
                          )}
                          <td className="small">{r.reason || '—'}</td>
                          <td className="text-end">
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => openReturn(r.id)}>
                              <i className="bi bi-eye me-1" />View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <Pagination page={rPage} pages={returnsData?.pages || 1} total={returnsData?.total} onPage={setRPage} />
            </>
          )}
        </div>
      )}

      {/* ── sale detail ─────────────────────────────────────────────────── */}
      <Modal show={saleId !== null} size="xl"
        title={saleDetail ? `Sale ${saleDetail.sale_number}` : 'Sale'}
        onClose={() => { setSaleId(null); setSaleDetail(null); setActionErr(''); }}
        footer={
          <>
            {saleDetail && (
              <button className="btn btn-outline-secondary" onClick={() => openReceipt(saleDetail.id)}>
                <i className="bi bi-printer me-1" />Receipt
              </button>
            )}
            <button className="btn btn-outline-secondary" onClick={() => { setSaleId(null); setSaleDetail(null); setActionErr(''); }}>Close</button>
          </>
        }>
        {actionErr && <div className="alert alert-danger py-2 small">{actionErr}</div>}
        {saleDetailLoading && <Loading />}
        {!saleDetailLoading && saleDetailErr && <ErrorAlert message={saleDetailErr} onRetry={() => saleId !== null && fetchSale(saleId)} />}
        {!saleDetailLoading && !saleDetailErr && saleDetail && (
          <div>
            <div className="row g-2 mb-3 small">
              <div className="col-6 col-md-3"><span className="text-muted d-block">Sale number</span><span className="fw-semibold">{saleDetail.sale_number}</span></div>
              <div className="col-6 col-md-3"><span className="text-muted d-block">Status</span><Badge status={saleDetail.status} /></div>
              <div className="col-6 col-md-3"><span className="text-muted d-block">Payment</span><Badge status={saleDetail.payment_status} /></div>
              <div className="col-6 col-md-3"><span className="text-muted d-block">Branch</span>{saleDetail.branch || '—'}</div>
              <div className="col-6 col-md-3"><span className="text-muted d-block">Customer</span>{saleDetail.customer || 'Walk-in'}</div>
              <div className="col-6 col-md-3"><span className="text-muted d-block">Created</span>{fmtDateTime(saleDetail.created_at)}</div>
              <div className="col-6 col-md-3"><span className="text-muted d-block">Created by</span>{saleDetail.created_by ?? '—'}</div>
              {saleDetail.notes && <div className="col-12"><span className="text-muted d-block">Notes</span>{saleDetail.notes}</div>}
            </div>

            <div className="card mb-3">
              <div className="table-responsive">
                <table className="table table-sm table-hover mb-0">
                  <thead>
                    <tr>
                      <th>Product</th><th>SKU</th><th className="text-end">Qty</th>
                      <th className="text-end">Unit price</th>
                      {saleItemMoney && <th className="text-end">Discount</th>}
                      {saleItemMoney && <th className="text-end">Tax</th>}
                      {saleItemMoney && <th className="text-end">Line total</th>}
                      <th>Serials</th><th className="text-end">Returned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(saleDetail.items || []).map((it: any) => (
                      <tr key={it.id}>
                        <td>
                          <div className="fw-semibold">{it.product}</div>
                          {it.variant && <div className="small text-muted">{it.variant}</div>}
                        </td>
                        <td className="small">{it.sku || '—'}</td>
                        <td className="text-end">{it.quantity}</td>
                        <td className="text-end money">{fmtMoney(it.unit_price)}</td>
                        {saleItemMoney && <td className="text-end money">{it.discount_amount != null ? fmtMoney(it.discount_amount) : '—'}</td>}
                        {saleItemMoney && <td className="text-end money">{it.tax_amount != null ? fmtMoney(it.tax_amount) : '—'}</td>}
                        {saleItemMoney && <td className="text-end money fw-semibold">{it.line_total != null ? fmtMoney(it.line_total) : '—'}</td>}
                        <td className="small">{(it.serials || []).join(', ') || '—'}</td>
                        <td className="text-end">{it.returned_quantity ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="row g-3">
              <div className="col-md-6">
                <div className="card">
                  <div className="card-header py-2 small fw-semibold">Totals</div>
                  <div className="table-responsive">
                    <table className="table table-sm mb-0">
                      <tbody>
                        {TOTAL_KEYS.filter((k) => saleDetail[k] !== undefined && saleDetail[k] !== null).map((k) => (
                          <tr key={k}>
                            <td className="text-muted">{TOTAL_LABELS[k]}</td>
                            <td className={`text-end money ${k === 'total_amount' ? 'fw-bold' : 'fw-semibold'}`}>{fmtMoney(saleDetail[k])}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              <div className="col-md-6">
                {showPayments ? (
                  <div className="card">
                    <div className="card-header py-2 small fw-semibold">Payments</div>
                    <div className="table-responsive">
                      <table className="table table-sm mb-0">
                        <thead>
                          <tr><th>Method</th><th>Reference</th><th>Paid</th><th>Status</th><th className="text-end">Amount</th></tr>
                        </thead>
                        <tbody>
                          {(saleDetail.payments || []).map((p: any) => (
                            <tr key={p.id}>
                              <td>{p.method || '—'}</td>
                              <td className="small">{p.reference || '—'}</td>
                              <td className="small text-nowrap">{fmtDateTime(p.paid_at)}</td>
                              <td><Badge status={p.status} /></td>
                              <td className="text-end money fw-semibold">
                                {p.amount !== undefined && p.amount !== null ? fmtMoney(p.amount) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="small text-muted">No payment records on this sale.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── receipt ─────────────────────────────────────────────────────── */}
      <Modal show={receiptOpen} size="lg" title="Receipt"
        onClose={() => { setReceiptOpen(false); setReceipt(null); setReceiptErr(''); }}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => { setReceiptOpen(false); setReceipt(null); setReceiptErr(''); }}>Close</button>
            <button className="btn btn-primary" disabled={!receipt || receiptLoading} onClick={() => window.print()}>
              <i className="bi bi-printer me-1" />Print
            </button>
          </>
        }>
        {receiptLoading && <Loading />}
        {!receiptLoading && receiptErr && (
          <ErrorAlert message={receiptErr} onRetry={() => saleId !== null && fetchReceipt(saleId)} />
        )}
        {!receiptLoading && !receiptErr && receipt && (
          <div className="border p-3 small">
            <div className="text-center mb-3">
              <div className="fw-bold">{receipt.business_name}</div>
              <div>{receipt.sale?.sale_number}</div>
              <div className="text-muted">{fmtDateTime(receipt.printed_at)}</div>
            </div>
            <div className="mb-3">
              <div><span className="text-muted">Customer:</span> {receipt.customer?.full_name || 'Walk-in'}</div>
              {receipt.customer?.phone && <div><span className="text-muted">Phone:</span> {receipt.customer.phone}</div>}
              <div><span className="text-muted">Date:</span> {fmtDateTime(receipt.sale?.created_at)}</div>
              <div><span className="text-muted">Branch:</span> {receipt.sale?.branch || '—'}</div>
            </div>
            <table className="table table-sm mb-3">
              <thead>
                <tr><th>Item</th><th className="text-end">Qty</th><th className="text-end">Unit price</th><th className="text-end">Line total</th></tr>
              </thead>
              <tbody>
                {(receipt.items || []).map((it: any) => (
                  <tr key={it.id}>
                    <td>
                      <div>{it.product}</div>
                      {it.variant && <div className="text-muted">{it.variant}</div>}
                      <div className="text-muted">{it.sku}</div>
                    </td>
                    <td className="text-end">{it.quantity}</td>
                    <td className="text-end money">{it.unit_price != null ? fmtMoney(it.unit_price, receipt.currency) : '—'}</td>
                    <td className="text-end money">{it.line_total != null ? fmtMoney(it.line_total, receipt.currency) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="table table-sm mb-0">
              <tbody>
                {TOTAL_KEYS.filter((k) => receipt.sale?.[k] !== undefined && receipt.sale?.[k] !== null).map((k) => (
                  <tr key={k}>
                    <td className="text-muted">{TOTAL_LABELS[k]}</td>
                    <td className={`text-end money ${k === 'total_amount' ? 'fw-bold' : 'fw-semibold'}`}>
                      {fmtMoney(receipt.sale[k], receipt.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-center text-muted mt-3">Thank you for shopping with us.</div>
          </div>
        )}
      </Modal>

      {/* ── return detail ───────────────────────────────────────────────── */}
      <Modal show={retId !== null} size="xl"
        title={retDetail ? `Return ${retDetail.return_number}` : 'Return'}
        onClose={() => { setRetId(null); setRetDetail(null); setRetActionErr(''); }}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => { setRetId(null); setRetDetail(null); setRetActionErr(''); }}>Close</button>
            {canReceive && retDetail?.status === 'requested' && (
              <button className="btn btn-outline-primary" disabled={busy} onClick={() => setReceiveFor(retDetail)}>Receive</button>
            )}
            {canReview && (retDetail?.status === 'requested' || retDetail?.status === 'received') && (
              <>
                <button className="btn btn-outline-danger" disabled={busy}
                  onClick={() => { setRejectErr(''); setRejectReason(''); setRejectFor(retDetail); }}>Reject</button>
                <button className="btn btn-success" disabled={busy} onClick={() => setApproveFor(retDetail)}>Approve</button>
              </>
            )}
          </>
        }>
        {retActionErr && <div className="alert alert-danger py-2 small">{retActionErr}</div>}
        {retDetailLoading && <Loading />}
        {!retDetailLoading && retDetailErr && <ErrorAlert message={retDetailErr} onRetry={() => retId !== null && fetchReturn(retId)} />}
        {!retDetailLoading && !retDetailErr && retDetail && (
          <div>
            <div className="row g-2 mb-3 small">
              <div className="col-6 col-md-3"><span className="text-muted d-block">Return number</span><span className="fw-semibold">{retDetail.return_number}</span></div>
              <div className="col-6 col-md-3"><span className="text-muted d-block">Status</span><Badge status={retDetail.status} /></div>
              <div className="col-6 col-md-3"><span className="text-muted d-block">Type</span><span className="text-uppercase">{retDetail.return_type}</span></div>
              <div className="col-6 col-md-3"><span className="text-muted d-block">Sale</span>{retDetail.sale_number || '—'}</div>
              <div className="col-6 col-md-3"><span className="text-muted d-block">Customer</span>{retDetail.customer || 'Walk-in'}</div>
              <div className="col-6 col-md-3"><span className="text-muted d-block">Branch</span>{retDetail.branch || '—'}</div>
              <div className="col-6 col-md-3"><span className="text-muted d-block">Created</span>{fmtDateTime(retDetail.created_at)}</div>
              <div className="col-6 col-md-3"><span className="text-muted d-block">Requested by</span>{retDetail.requested_by_name || '—'}</div>
              {retDetail.refund_amount !== undefined && retDetail.refund_amount !== null && (
                <div className="col-6 col-md-3"><span className="text-muted d-block">Refund amount</span><span className="money fw-semibold">{fmtMoney(retDetail.refund_amount)}</span></div>
              )}
              <div className="col-12"><span className="text-muted d-block">Reason</span>{retDetail.reason || '—'}</div>
              {retDetail.notes && <div className="col-12"><span className="text-muted d-block">Notes</span>{retDetail.notes}</div>}
              {retDetail.rejected_reason && (
                <div className="col-12"><span className="text-muted d-block">Rejection note</span>{retDetail.rejected_reason}</div>
              )}
            </div>

            <div className="card mb-3">
              <div className="table-responsive">
                <table className="table table-sm table-hover mb-0">
                  <thead>
                    <tr>
                      <th>Product</th><th>SKU</th><th className="text-end">Qty</th>
                      <th>Condition</th><th>Restock</th>
                      {retShowMoney && <th className="text-end">Unit price</th>}
                      {retShowMoney && <th className="text-end">Line total</th>}
                      <th>Serial</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(retDetail.items || []).map((it: any) => (
                      <tr key={it.id}>
                        <td>
                          <div className="fw-semibold">{it.product}</div>
                          {it.variant && <div className="small text-muted">{it.variant}</div>}
                        </td>
                        <td className="small">{it.sku || '—'}</td>
                        <td className="text-end">{it.quantity}</td>
                        <td className="small">{(it.condition || '—').replace(/_/g, ' ')}</td>
                        <td>{it.restock ? 'Yes' : 'No'}</td>
                        {retShowMoney && <td className="text-end money">{it.unit_price != null ? fmtMoney(it.unit_price) : '—'}</td>}
                        {retShowMoney && <td className="text-end money fw-semibold">{it.line_total != null ? fmtMoney(it.line_total) : '—'}</td>}
                        <td className="small">{it.serial_number || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── reject reason ───────────────────────────────────────────────── */}
      <Modal show={!!rejectFor} size="sm" title="Reject return" onClose={() => { setRejectFor(null); setRejectReason(''); setRejectErr(''); }}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => { setRejectFor(null); setRejectReason(''); setRejectErr(''); }}>Cancel</button>
            <button className="btn btn-danger" disabled={rejectBusy} onClick={confirmReject}>
              {rejectBusy ? 'Rejecting…' : 'Reject'}
            </button>
          </>
        }>
        {rejectErr && <div className="alert alert-danger py-2 small">{rejectErr}</div>}
        <p className="small text-muted">Rejecting {rejectFor?.return_number} against {rejectFor?.sale_number}.</p>
        <Field label="Reason">
          <TextArea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Why is this return being rejected?" />
        </Field>
      </Modal>

      {/* ── new return ──────────────────────────────────────────────────── */}
      <Modal show={newOpen} size="lg" title="New return" onClose={closeNewReturn}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={closeNewReturn}>Cancel</button>
            <button className="btn btn-primary" disabled={nBusy} onClick={submitReturn}>
              {nBusy ? 'Saving…' : 'Create return'}
            </button>
          </>
        }>
        {nErr && <div className="alert alert-danger py-2 small">{nErr}</div>}
        <div className="row">
          <div className="col-md-4">
            <Field label="Type" required>
              <SelectInput value={nType} onChange={(e) => setNType(e.target.value)}>
                <option value="refund">Refund</option>
                <option value="exchange">Exchange</option>
              </SelectInput>
            </Field>
          </div>
          <div className="col-md-8">
            <Field label="Reason" required>
              <TextInput value={nReason} onChange={(e) => setNReason(e.target.value)}
                placeholder="Why is this being returned?" required />
            </Field>
          </div>
        </div>

        {!nSale ? (
          <div>
            <Field label="Find the sale" hint="Search by sale number, customer name or phone.">
              <div className="d-flex gap-2">
                <TextInput value={nQ} onChange={(e) => setNQ(e.target.value)} placeholder="SAL-… or customer"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchSales(); } }} />
                <button type="button" className="btn btn-outline-secondary text-nowrap" disabled={nSearching || !nQ.trim()} onClick={searchSales}>
                  {nSearching ? 'Searching…' : 'Search'}
                </button>
              </div>
            </Field>
            {nSearching && <Loading />}
            {!nSearching && nSearched && nResults.length === 0 && (
              <div className="small text-muted">No matching sales.</div>
            )}
            {nResults.length > 0 && (
              <div className="list-group mb-3">
                {nResults.map((s: any) => (
                  <button type="button" key={s.id} className="list-group-item list-group-item-action" onClick={() => pickSale(s)}>
                    <div className="d-flex justify-content-between">
                      <span className="fw-semibold">{s.sale_number}</span>
                      <span className="small text-muted">{fmtDateTime(s.created_at)}</span>
                    </div>
                    <div className="small text-muted">{s.customer || 'Walk-in'} · {s.branch || '—'}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div>
                <span className="fw-semibold">{nSale.sale_number}</span>
                <span className="small text-muted ms-2">{nSale.customer || 'Walk-in'} · {nSale.branch || '—'}</span>
              </div>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setNSale(null); setNItems({}); setNResults([]); setNSearched(false); }}>
                Change sale
              </button>
            </div>

            {nSale.items.length === 0 && (
              <div className="alert alert-secondary py-2 small mb-0">Nothing left to return on this sale.</div>
            )}

            {nSale.items.map((i: any) => (
              <div className="border rounded p-2 mb-2" key={i.id}>
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <div className="fw-semibold">{i.product}{i.variant ? ` · ${i.variant}` : ''}</div>
                    <div className="small text-muted">{i.sku || '—'} · returnable {i.returnable_quantity} of {i.quantity}</div>
                  </div>
                  <div className="text-end money small">{fmtMoney(i.unit_price)}</div>
                </div>
                <div className="row g-2 align-items-end mt-0">
                  <div className="col-4">
                    <label className="form-label small mb-0" htmlFor={`qty-${i.id}`}>Qty</label>
                    <TextInput id={`qty-${i.id}`} type="number" min={0} max={i.returnable_quantity} className="form-control-sm"
                      value={nItems[i.id]?.quantity ?? 0}
                      onChange={(e) => updateNItem(i.id, {
                        quantity: Math.max(0, Math.min(Number(e.target.value) || 0, i.returnable_quantity)),
                      })} />
                  </div>
                  <div className="col-4">
                    <label className="form-label small mb-0" htmlFor={`cond-${i.id}`}>Condition</label>
                    <SelectInput id={`cond-${i.id}`} className="form-select-sm" value={nItems[i.id]?.condition || 'good'}
                      onChange={(e) => updateNItem(i.id, { condition: e.target.value, restock: e.target.value === 'good' })}>
                      {CONDITIONS.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                    </SelectInput>
                  </div>
                  <div className="col-4">
                    <div className="form-check mt-3">
                      <input className="form-check-input" type="checkbox" id={`restock-${i.id}`}
                        checked={!!nItems[i.id]?.restock}
                        onChange={(e) => updateNItem(i.id, { restock: e.target.checked })} />
                      <label className="form-check-label small" htmlFor={`restock-${i.id}`}>Restock</label>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <ConfirmDialog show={!!cancelling} title="Cancel sale"
        message={`Cancel ${cancelling?.sale_number}? Stock movements are reversed and the sale can no longer be paid.`}
        confirmLabel="Cancel sale"
        onConfirm={confirmCancel}
        onClose={() => setCancelling(null)} />

      <ConfirmDialog show={!!approveFor} title="Approve return" danger={false} confirmLabel="Approve"
        message={`Approve ${approveFor?.return_number} against ${approveFor?.sale_number}? This books the refund and updates stock.`}
        onConfirm={() => approveFor && returnAction(approveFor.id, `/api/shop/returns/${approveFor.id}/approve`, { decision: 'approved' })}
        onClose={() => setApproveFor(null)} />

      <ConfirmDialog show={!!receiveFor} title="Receive return" danger={false} confirmLabel="Receive"
        message={`Mark the items for ${receiveFor?.return_number} as physically received at the counter?`}
        onConfirm={() => receiveFor && returnAction(receiveFor.id, `/api/shop/returns/${receiveFor.id}/receive`)}
        onClose={() => setReceiveFor(null)} />
    </div>
  );
}
