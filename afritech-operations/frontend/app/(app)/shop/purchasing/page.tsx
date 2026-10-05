'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useFetch } from '@/lib/use-fetch';
import { api, can, fmtDate, fmtDateTime, fmtMoney } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { P } from '@/lib/permissions';
import { PageHeader, Loading, ErrorAlert, EmptyState, Pagination, Modal, Badge, ConfirmDialog } from '@/components/ui';
import { Field, TextInput, SelectInput, TextArea } from '@/components/form';
import { BarcodeInput, BarcodeScanner, ProductScanResult } from '@/components/shop';
import type { BarcodeInputHandle } from '@/components/shop';
import { BarcodeLookup, lookupBarcode, scanFeedback } from '@/lib/barcode';

type Tab = 'orders' | 'suppliers';

type ConfirmState = { title: string; message: string; run: () => void; danger?: boolean; label?: string } | null;

type PoLine = { product_id: string; variant_id: string; quantity: string; unit_cost: string };

type ScanNote = { kind: 'ok' | 'info' | 'warn' | 'error'; text: string };

const blankLine = (): PoLine => ({ product_id: '', variant_id: '', quantity: '', unit_cost: '' });

const emptySupplier = {
  company_name: '', contact_person: '', phone: '', email: '',
  address: '', payment_terms: '', notes: '',
};

const NOTE_CLASS: Record<ScanNote['kind'], string> = {
  ok: 'alert-success', info: 'alert-info', warn: 'alert-warning', error: 'alert-danger',
};

function scanFailureText(err: any): string {
  const message = String(err?.message || '');
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (offline || err instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(message)) {
    return 'Cannot verify product because the network is unavailable.';
  }
  return message || 'Could not look up that barcode.';
}

function ScanNoteAlert({ note }: { note: ScanNote | null }) {
  if (!note) return null;
  return <div className={`alert ${NOTE_CLASS[note.kind]} py-2 small mt-2 mb-0`}>{note.text}</div>;
}

function ScanUnknownPanel({ user, result, onScanAgain, onEnter, onCancel }: {
  user: any;
  result: BarcodeLookup;
  onScanAgain: () => void;
  onEnter: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="alert alert-warning py-2 small mt-2 mb-0">
      <div className="d-flex align-items-center flex-wrap gap-2">
        <i className="bi bi-exclamation-triangle" />
        <span className="fw-semibold flex-grow-1">
          Barcode not found in inventory.{' '}
          <span className="font-monospace fw-normal">{result.barcode}</span>
        </span>
        {can(user, P.shopProductsCreate) && (
          <Link className="btn btn-sm btn-outline-primary"
            href={`/shop/catalog?new=1&barcode=${encodeURIComponent(result.barcode)}`}>
            Create Product
          </Link>
        )}
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onScanAgain}>Scan Again</button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onEnter}>Enter Barcode</button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export default function ShopPurchasingPage() {
  const { user } = useAuth();
  const canCreate = can(user, P.shopPurchasesCreate);
  const canApprove = can(user, P.shopPurchasesApprove);
  const canReceive = can(user, P.shopPurchasesReceive);
  const canSuppliers = can(user, P.shopSuppliersCreate);
  // Unit costs only exist in the payload for roles holding a cost permission.
  const canSeeCost = can(user, P.shopPricingView) || can(user, P.shopPricingManage)
    || can(user, P.shopPurchasesCreate) || can(user, P.shopPurchasesApprove)
    || can(user, P.shopPurchasesReceive) || can(user, P.shopFinancialReportsView);

  const [tab, setTab] = useState<Tab>('orders');

  const allTabs: { key: Tab; label: string; perm: string }[] = [
    { key: 'orders', label: 'Purchase orders', perm: P.shopPurchasesView },
    { key: 'suppliers', label: 'Suppliers', perm: P.shopSuppliersView },
  ];
  const tabs = allTabs.filter((t) => can(user, t.perm));
  const active: Tab | '' = tabs.some((t) => t.key === tab) ? tab : (tabs[0]?.key || '');

  const [page, setPage] = useState(1);
  function goTab(t: Tab) { setTab(t); setPage(1); setRowErr(''); }

  const [poQ, setPoQ] = useState('');
  const [poStatus, setPoStatus] = useState('');
  const orders = useFetch(active === 'orders' ? '/api/shop/purchases' : '', [page, poQ, poStatus], {
    page, per_page: 15, q: poQ || undefined, status: poStatus || undefined,
  });
  const orderItems = orders.data?.items || [];
  const showTotal = orderItems.some((o: any) => o.total_amount !== undefined);

  const [supQ, setSupQ] = useState('');
  const suppliers = useFetch(active === 'suppliers' ? '/api/shop/suppliers' : '', [page, supQ], {
    page, per_page: 15, q: supQ || undefined,
  });
  const supplierItems = suppliers.data?.items || [];
  const showSpend = supplierItems.some((s: any) => s.total_purchased !== undefined);

  const [rowErr, setRowErr] = useState('');
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  async function act(path: string) {
    setRowErr('');
    try {
      await api(path, { method: 'POST', body: {} });
      orders.reload();
    } catch (err: any) {
      setRowErr(err.message);
    }
  }

  // ── reference data ────────────────────────────────────────────────────────
  const [suppliersList, setSuppliersList] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  const [prodQ, setProdQ] = useState('');
  const [variantMap, setVariantMap] = useState<Record<string, any[]>>({});

  async function loadSuppliers() {
    try {
      const d: any = await api('/api/shop/suppliers', { params: { per_page: 100, active: 'true' } });
      setSuppliersList(d.items || []);
    } catch {
      setSuppliersList([]);
    }
  }

  async function loadProducts(q?: string) {
    try {
      const d: any = await api('/api/shop/products', { params: { per_page: 50, q: q || undefined } });
      setProducts(d.items || []);
    } catch {
      setProducts([]);
    }
  }

  async function loadBranches() {
    try {
      const d: any = await api('/api/employees/branches');
      const list = (d.branches || []).map((b: any) => ({ id: b.id, name: b.name }));
      if (list.length) { setBranches(list); return; }
    } catch { /* shop roles may lack employees.view — fall back below */ }
    try {
      const d: any = await api('/api/shop/inventory/balances', { params: { per_page: 100 } });
      const seen = new Map<number, string>();
      (d.items || []).forEach((b: any) => {
        if (b.branch_id && !seen.has(b.branch_id)) seen.set(b.branch_id, b.branch);
      });
      setBranches(Array.from(seen, ([id, name]) => ({ id, name })));
    } catch {
      setBranches([]);
    }
  }

  async function ensureVariants(productId: string) {
    if (!productId || variantMap[productId]) return;
    try {
      const d: any = await api(`/api/shop/products/${productId}`);
      setVariantMap((m) => ({ ...m, [productId]: d?.product?.variants || [] }));
    } catch {
      setVariantMap((m) => ({ ...m, [productId]: [] }));
    }
  }

  // ── purchase order detail ─────────────────────────────────────────────────
  const [detail, setDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState('');

  async function openDetail(po: any) {
    setDetail(null);
    setDetailErr('');
    setDetailLoading(true);
    try {
      const d: any = await api(`/api/shop/purchases/${po.id}`);
      setDetail(d.purchase_order || null);
    } catch (err: any) {
      setDetailErr(err.message);
    } finally {
      setDetailLoading(false);
    }
  }

  // ── receive goods ─────────────────────────────────────────────────────────
  const [recvPo, setRecvPo] = useState<any | null>(null);
  const [recvItems, setRecvItems] = useState<any[]>([]);
  const [recvQty, setRecvQty] = useState<Record<string, string>>({});
  const [recvCost, setRecvCost] = useState<Record<string, string>>({});
  const [recvInvoice, setRecvInvoice] = useState('');
  const [recvBusy, setRecvBusy] = useState(false);
  const [recvErr, setRecvErr] = useState('');

  const recvScanRef = useRef<BarcodeInputHandle>(null);
  const [recvScan, setRecvScan] = useState('');
  const [recvScanBusy, setRecvScanBusy] = useState(false);
  const [recvCam, setRecvCam] = useState(false);
  const [recvNote, setRecvNote] = useState<ScanNote | null>(null);
  const [recvUnknown, setRecvUnknown] = useState<BarcodeLookup | null>(null);
  const [recvExtra, setRecvExtra] = useState<BarcodeLookup | null>(null);
  const recvQtyRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const recvTouched = useRef<Set<string>>(new Set());

  function resetRecvScan() {
    setRecvScan('');
    setRecvNote(null);
    setRecvUnknown(null);
    setRecvExtra(null);
  }

  async function openReceive(po: any) {
    setRecvPo(po);
    setRecvItems([]);
    setRecvQty({});
    setRecvCost({});
    setRecvInvoice('');
    setRecvErr('');
    resetRecvScan();
    recvTouched.current = new Set();
    setTimeout(() => recvScanRef.current?.focus(), 0);
    try {
      const d: any = await api(`/api/shop/purchases/${po.id}`);
      const lines: any[] = d?.purchase_order?.items || [];
      setRecvItems(lines);
      const qty: Record<string, string> = {};
      const cost: Record<string, string> = {};
      lines.forEach((it) => {
        qty[String(it.id)] = String(it.outstanding_quantity ?? 0);
        if (it.unit_cost !== undefined) cost[String(it.id)] = String(it.unit_cost);
      });
      setRecvQty(qty);
      setRecvCost(cost);
    } catch (err: any) {
      setRecvErr(err.message);
    }
  }

  async function handleRecvScan(raw: string) {
    const code = String(raw || '').trim();
    if (!code) return;
    setRecvScanBusy(true);
    setRecvNote(null);
    setRecvUnknown(null);
    setRecvExtra(null);
    try {
      const res: BarcodeLookup = await lookupBarcode(code, {
        branchId: recvPo?.branch_id ? Number(recvPo.branch_id) : null,
        context: 'receiving',
      });
      if (!res.found) {
        setRecvUnknown(res);
        scanFeedback('error');
        return;
      }
      const product = res.product || {};
      const variant = res.variant || null;
      const label = [product.name, variant?.name].filter(Boolean).join(' — ');
      if (!recvItems.length) {
        setRecvNote({ kind: 'warn', text: 'Order lines are not loaded yet — scan again in a moment.' });
        scanFeedback('error');
        return;
      }
      const vid = variant ? Number(variant.id) : null;
      let line: any = recvItems.find((it: any) =>
        Number(it.product_id) === Number(product.id)
        && (vid === null ? !it.variant_id : Number(it.variant_id) === vid));
      if (!line) line = recvItems.find((it: any) => Number(it.product_id) === Number(product.id));
      if (!line) {
        setRecvNote({
          kind: 'info',
          text: 'Not on this purchase order — add it via a new PO line or receive it as an adjustment.',
        });
        setRecvExtra(res);
        scanFeedback('error');
        return;
      }
      const key = String(line.id);
      const outstanding = Number(line.outstanding_quantity || 0);
      const current = recvQty[key];
      // The form prefills every line with the full outstanding quantity; a scan
      // starts counting from zero until the user has set the figure themselves.
      const untouched = !recvTouched.current.has(key);
      const base = untouched ? 0 : Number(current || 0);
      const next = Math.min(base + 1, outstanding);
      const advanced = next > base;
      recvTouched.current.add(key);
      setRecvQty((m) => ({ ...m, [key]: String(next) }));
      const input = recvQtyRefs.current[key];
      if (input) input.scrollIntoView({ block: 'nearest' });
      if (advanced) {
        setRecvNote({ kind: 'ok', text: `${label} — receiving ${next} of ${outstanding} outstanding.` });
      } else if (outstanding > 0) {
        setRecvNote({ kind: 'warn', text: `${label} is already at the outstanding quantity (${outstanding}).` });
      } else {
        setRecvNote({ kind: 'warn', text: `${label} has nothing outstanding on this order.` });
      }
      scanFeedback(advanced ? 'ok' : 'error');
    } catch (err: any) {
      setRecvNote({ kind: 'error', text: scanFailureText(err) });
      scanFeedback('error');
    } finally {
      setRecvScanBusy(false);
      setRecvScan('');
      recvScanRef.current?.focus();
    }
  }

  async function saveReceive(e: React.FormEvent) {
    e.preventDefault();
    setRecvBusy(true);
    setRecvErr('');
    try {
      const items = recvItems
        .map((it) => ({
          item_id: it.id,
          product_id: it.product_id,
          variant_id: it.variant_id ?? undefined,
          quantity: Number(recvQty[String(it.id)] || 0),
          unit_cost: it.unit_cost !== undefined && recvCost[String(it.id)] !== ''
            ? Number(recvCost[String(it.id)]) : undefined,
        }))
        .filter((it) => it.quantity > 0);
      await api(`/api/shop/purchases/${recvPo.id}/receive`, {
        method: 'POST',
        body: { items, supplier_invoice: recvInvoice || undefined },
      });
      setRecvPo(null);
      orders.reload();
    } catch (err: any) {
      setRecvErr(err.message);
    } finally {
      setRecvBusy(false);
    }
  }

  // ── new purchase order ────────────────────────────────────────────────────
  const [poOpen, setPoOpen] = useState(false);
  const [poForm, setPoForm] = useState({ supplier_id: '', branch_id: '', expected_date: '', notes: '' });
  const [poLines, setPoLines] = useState<PoLine[]>([blankLine()]);
  const [poBusy, setPoBusy] = useState(false);
  const [poErr, setPoErr] = useState('');

  function setPoLine(index: number, key: keyof PoLine, value: string) {
    setPoLines((rows) => rows.map((r, i) => (i === index ? { ...r, [key]: value } : r)));
  }

  async function openCreate() {
    setPoForm({ supplier_id: '', branch_id: '', expected_date: '', notes: '' });
    setPoLines([blankLine()]);
    setProdQ('');
    setPoErr('');
    setPoOpen(true);
    await Promise.all([loadSuppliers(), loadProducts(), loadBranches()]);
  }

  async function savePo(e: React.FormEvent) {
    e.preventDefault();
    setPoBusy(true);
    setPoErr('');
    try {
      await api('/api/shop/purchases', {
        method: 'POST',
        body: {
          supplier_id: poForm.supplier_id ? Number(poForm.supplier_id) : undefined,
          branch_id: poForm.branch_id ? Number(poForm.branch_id) : undefined,
          expected_date: poForm.expected_date || undefined,
          notes: poForm.notes || undefined,
          items: poLines
            .filter((l) => l.product_id && l.quantity !== '')
            .map((l) => ({
              product_id: Number(l.product_id),
              variant_id: l.variant_id ? Number(l.variant_id) : undefined,
              quantity: Number(l.quantity),
              unit_cost: canSeeCost && l.unit_cost !== '' ? Number(l.unit_cost) : undefined,
            })),
        },
      });
      setPoOpen(false);
      orders.reload();
    } catch (err: any) {
      setPoErr(err.message);
    } finally {
      setPoBusy(false);
    }
  }

  // ── supplier form ─────────────────────────────────────────────────────────
  const [supOpen, setSupOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [supForm, setSupForm] = useState<any>({ ...emptySupplier });
  const [supBusy, setSupBusy] = useState(false);
  const [supErr, setSupErr] = useState('');

  function set<K extends keyof typeof emptySupplier>(key: K, value: string) {
    setSupForm((f: any) => ({ ...f, [key]: value }));
  }

  function openCreateSupplier() {
    setEditing(null);
    setSupForm({ ...emptySupplier });
    setSupErr('');
    setSupOpen(true);
  }

  function openEditSupplier(row: any) {
    setEditing(row);
    setSupForm({
      company_name: row.company_name || '',
      contact_person: row.contact_person || '',
      phone: row.phone || '',
      email: row.email || '',
      address: row.address || '',
      payment_terms: row.payment_terms || '',
      notes: row.notes || '',
    });
    setSupErr('');
    setSupOpen(true);
  }

  async function saveSupplier(e: React.FormEvent) {
    e.preventDefault();
    setSupBusy(true);
    setSupErr('');
    const body = {
      company_name: supForm.company_name,
      contact_person: supForm.contact_person || null,
      phone: supForm.phone || null,
      email: supForm.email || null,
      address: supForm.address || null,
      payment_terms: supForm.payment_terms || null,
      notes: supForm.notes || null,
    };
    try {
      if (editing) {
        await api(`/api/shop/suppliers/${editing.id}`, { method: 'PATCH', body });
      } else {
        await api('/api/shop/suppliers', { method: 'POST', body });
      }
      setSupOpen(false);
      suppliers.reload();
    } catch (err: any) {
      setSupErr(err.message);
    } finally {
      setSupBusy(false);
    }
  }

  const productPicker = (
    <Field label="Find products">
      <TextInput value={prodQ} placeholder="Search name or SKU…"
        onChange={(e) => { setProdQ(e.target.value); loadProducts(e.target.value); }} />
    </Field>
  );

  return (
    <div>
      <PageHeader title="Purchasing" subtitle="Purchase orders, goods receipts and suppliers"
        actions={
          <>
            {active === 'orders' && canCreate && (
              <button className="btn btn-primary" onClick={openCreate}><i className="bi bi-plus-circle me-1" /> New purchase order</button>
            )}
            {active === 'suppliers' && canSuppliers && (
              <button className="btn btn-primary" onClick={openCreateSupplier}><i className="bi bi-plus-circle me-1" /> New supplier</button>
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

      {active === 'orders' && (
        <div>
          <div className="card mb-3">
            <div className="card-body d-flex flex-wrap gap-2 align-items-center">
              <i className="bi bi-search text-muted" />
              <input className="form-control form-control-sm" style={{ maxWidth: 280 }} placeholder="Search PO number or supplier…"
                value={poQ} onChange={(e) => { setPoQ(e.target.value); setPage(1); }} />
              <select className="form-select form-select-sm" style={{ width: 190 }} value={poStatus}
                onChange={(e) => { setPoStatus(e.target.value); setPage(1); }}>
                <option value="">All statuses</option>
                <option value="draft">Draft</option>
                <option value="pending_approval">Pending approval</option>
                <option value="approved">Approved</option>
                <option value="partially_received">Partially received</option>
                <option value="received">Received</option>
                <option value="cancelled">Cancelled</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>

          {orders.error && <ErrorAlert message={orders.error} onRetry={orders.reload} />}
          {orders.loading && <Loading />}
          {!orders.loading && !orders.error && orderItems.length === 0 && <EmptyState message="No purchase orders found" />}

          {!orders.loading && !orders.error && orderItems.length > 0 && (
            <>
              <div className="card">
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead>
                      <tr>
                        <th>PO #</th><th>Supplier</th><th>Branch</th>
                        <th className="text-end">Lines</th><th>Status</th>
                        <th className="text-end">Ordered</th><th className="text-end">Received</th>
                        {showTotal && <th className="text-end">Total</th>}
                        <th>Created</th><th />
                      </tr>
                    </thead>
                    <tbody>
                      {orderItems.map((p: any) => (
                        <tr key={p.id}>
                          <td className="fw-semibold">{p.po_number}</td>
                          <td>{p.supplier || '—'}</td>
                          <td>{p.branch || '—'}</td>
                          <td className="text-end">{p.line_count}</td>
                          <td><Badge status={p.status} /></td>
                          <td className="text-end">{p.ordered_quantity}</td>
                          <td className={`text-end ${p.received_quantity < p.ordered_quantity ? 'text-warning fw-semibold' : 'text-success'}`}>
                            {p.received_quantity}
                          </td>
                          {showTotal && <td className="text-end money fw-semibold">{fmtMoney(p.total_amount)}</td>}
                          <td>{fmtDateTime(p.created_at)}</td>
                          <td className="text-end">
                            {p.status === 'draft' && canCreate && (
                              <button className="btn btn-sm btn-outline-primary me-1" onClick={() => act(`/api/shop/purchases/${p.id}/submit`)}>Submit</button>
                            )}
                            {p.status === 'pending_approval' && canApprove && (
                              <button className="btn btn-sm btn-outline-success me-1" onClick={() => act(`/api/shop/purchases/${p.id}/approve`)}>Approve</button>
                            )}
                            {canApprove && (p.status === 'draft' || p.status === 'pending_approval' || (p.status === 'approved' && !p.received_quantity)) && (
                              <button className="btn btn-sm btn-outline-danger me-1"
                                onClick={() => setConfirm({
                                  title: 'Cancel purchase order',
                                  message: `Cancel ${p.po_number}? It can no longer be approved or received.`,
                                  label: 'Cancel order',
                                  run: () => act(`/api/shop/purchases/${p.id}/cancel`),
                                })}>Cancel</button>
                            )}
                            {(p.status === 'approved' || p.status === 'partially_received') && canReceive && (
                              <button className="btn btn-sm btn-outline-primary me-1" onClick={() => openReceive(p)}>Receive</button>
                            )}
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => openDetail(p)}>View</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <Pagination page={page} pages={orders.data?.pages || 1} total={orders.data?.total} onPage={setPage} />
            </>
          )}
        </div>
      )}

      {active === 'suppliers' && (
        <div>
          <div className="card mb-3">
            <div className="card-body d-flex flex-wrap gap-2 align-items-center">
              <i className="bi bi-search text-muted" />
              <input className="form-control form-control-sm" style={{ maxWidth: 280 }} placeholder="Search company, code or phone…"
                value={supQ} onChange={(e) => { setSupQ(e.target.value); setPage(1); }} />
            </div>
          </div>

          {suppliers.error && <ErrorAlert message={suppliers.error} onRetry={suppliers.reload} />}
          {suppliers.loading && <Loading />}
          {!suppliers.loading && !suppliers.error && supplierItems.length === 0 && <EmptyState message="No suppliers found" />}

          {!suppliers.loading && !suppliers.error && supplierItems.length > 0 && (
            <>
              <div className="card">
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead>
                      <tr>
                        <th>Code</th><th>Company</th><th>Contact person</th><th>Phone</th><th>Email</th>
                        <th>Payment terms</th>
                        <th className="text-end">Products</th>
                        {showSpend && <th className="text-end">Total purchased</th>}
                        <th>Status</th>
                        {canSuppliers && <th />}
                      </tr>
                    </thead>
                    <tbody>
                      {supplierItems.map((s: any) => (
                        <tr key={s.id}>
                          <td>{s.code}</td>
                          <td className="fw-semibold">{s.company_name}</td>
                          <td>{s.contact_person || '—'}</td>
                          <td>{s.phone || '—'}</td>
                          <td>{s.email || '—'}</td>
                          <td>{s.payment_terms || '—'}</td>
                          <td className="text-end">{s.product_count}</td>
                          {showSpend && <td className="text-end money fw-semibold">{fmtMoney(s.total_purchased)}</td>}
                          <td><Badge status={s.is_active ? 'active' : 'inactive'} /></td>
                          {canSuppliers && (
                            <td className="text-end">
                              <button className="btn btn-sm btn-outline-secondary" onClick={() => openEditSupplier(s)}><i className="bi bi-pencil" /></button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <Pagination page={page} pages={suppliers.data?.pages || 1} total={suppliers.data?.total} onPage={setPage} />
            </>
          )}
        </div>
      )}

      <Modal show={poOpen} title="New purchase order" onClose={() => setPoOpen(false)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setPoOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={savePo} disabled={poBusy}>{poBusy ? 'Saving…' : 'Create order'}</button>
          </>
        }
      >
        <form onSubmit={savePo}>
          {poErr && <div className="alert alert-danger py-2 small">{poErr}</div>}
          <div className="row">
            <div className="col-md-4">
              <Field label="Supplier" required>
                <SelectInput value={poForm.supplier_id} required onChange={(e) => setPoForm((f) => ({ ...f, supplier_id: e.target.value }))}>
                  <option value="">Select supplier…</option>
                  {suppliersList.map((s) => <option key={s.id} value={s.id}>{s.company_name}</option>)}
                </SelectInput>
              </Field>
            </div>
            <div className="col-md-4">
              <Field label="Branch">
                <SelectInput value={poForm.branch_id} onChange={(e) => setPoForm((f) => ({ ...f, branch_id: e.target.value }))}>
                  <option value="">My branch (default)</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </SelectInput>
              </Field>
            </div>
            <div className="col-md-4">
              <Field label="Expected date">
                <TextInput type="date" value={poForm.expected_date}
                  onChange={(e) => setPoForm((f) => ({ ...f, expected_date: e.target.value }))} />
              </Field>
            </div>
          </div>
          <Field label="Notes"><TextArea rows={2} value={poForm.notes} onChange={(e) => setPoForm((f) => ({ ...f, notes: e.target.value }))} /></Field>

          {productPicker}
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="small fw-semibold text-muted">Order lines</span>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setPoLines((rows) => [...rows, blankLine()])}>
              <i className="bi bi-plus-lg me-1" />Add line
            </button>
          </div>
          {poLines.map((l, i) => {
            const variants: any[] = l.product_id ? (variantMap[l.product_id] || []) : [];
            return (
              <div className="border rounded p-2 mb-2" key={i}>
                <div className="row g-2">
                  <div className="col-md-4">
                    <Field label="Product" required>
                      <SelectInput value={l.product_id} required
                        onChange={(e) => { setPoLine(i, 'product_id', e.target.value); setPoLine(i, 'variant_id', ''); ensureVariants(e.target.value); }}>
                        <option value="">Select product…</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}
                      </SelectInput>
                    </Field>
                  </div>
                  <div className="col-md-3">
                    <Field label="Variant">
                      <SelectInput value={l.variant_id} onChange={(e) => setPoLine(i, 'variant_id', e.target.value)}>
                        <option value="">Default</option>
                        {variants.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </SelectInput>
                    </Field>
                  </div>
                  <div className="col-md-2">
                    <Field label="Quantity" required>
                      <TextInput type="number" step="1" min="1" value={l.quantity} required
                        onChange={(e) => setPoLine(i, 'quantity', e.target.value)} />
                    </Field>
                  </div>
                  {canSeeCost && (
                    <div className="col-md-2">
                      <Field label="Unit cost">
                        <TextInput type="number" step="0.01" min="0" value={l.unit_cost}
                          onChange={(e) => setPoLine(i, 'unit_cost', e.target.value)} />
                      </Field>
                    </div>
                  )}
                  <div className="col-md-1 d-flex align-items-end pb-3 justify-content-end">
                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setPoLines((rows) => rows.filter((_, j) => j !== i))} aria-label="Remove line">
                      <i className="bi bi-trash" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </form>
      </Modal>

      <Modal show={!!recvPo} title={recvPo ? `Receive ${recvPo.po_number}` : 'Receive goods'} onClose={() => setRecvPo(null)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setRecvPo(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveReceive} disabled={recvBusy}>{recvBusy ? 'Receiving…' : 'Confirm receipt'}</button>
          </>
        }
      >
        <form onSubmit={saveReceive}>
          <div className="border rounded p-2 mb-2">
            <BarcodeInput
              ref={recvScanRef}
              value={recvScan}
              onChange={setRecvScan}
              onScan={handleRecvScan}
              onCamera={() => setRecvCam(true)}
              onClear={() => { setRecvScan(''); setRecvUnknown(null); }}
              busy={recvScanBusy}
              label="Scan barcode"
              hint="Scan a barcode to advance its receiving quantity"
              placeholder="Scan or type a barcode, then Enter"
              dedupeMs={1200}
            />
            <ScanNoteAlert note={recvNote} />
            {recvExtra && (
              <div className="mt-2">
                <ProductScanResult result={recvExtra} />
              </div>
            )}
            {recvUnknown && (
              <ScanUnknownPanel user={user} result={recvUnknown}
                onScanAgain={() => { setRecvUnknown(null); setRecvScan(''); recvScanRef.current?.focus(); }}
                onEnter={() => { setRecvScan(recvUnknown.barcode); recvScanRef.current?.focus(); }}
                onCancel={() => setRecvUnknown(null)} />
            )}
          </div>
          {recvErr && <div className="alert alert-danger py-2 small">{recvErr}</div>}
          <Field label="Supplier invoice">
            <TextInput value={recvInvoice} onChange={(e) => setRecvInvoice(e.target.value)} placeholder="Optional" />
          </Field>
          <div className="table-responsive">
            <table className="table table-sm mb-2">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="text-end">Ordered</th>
                  <th className="text-end">Received</th>
                  <th className="text-end">Outstanding</th>
                  <th style={{ width: 120 }}>Receiving now</th>
                  {canSeeCost && <th style={{ width: 130 }}>Unit cost</th>}
                </tr>
              </thead>
              <tbody>
                {recvItems.map((it: any) => (
                  <tr key={it.id}>
                    <td><div className="fw-semibold">{it.product}</div><div className="small text-muted">{it.sku}</div></td>
                    <td className="text-end">{it.quantity_ordered}</td>
                    <td className="text-end">{it.quantity_received}</td>
                    <td className="text-end fw-semibold">{it.outstanding_quantity}</td>
                    <td>
                      <input type="number" step="1" min="0" className="form-control form-control-sm"
                        ref={(el) => { recvQtyRefs.current[String(it.id)] = el; }}
                        value={recvQty[String(it.id)] ?? ''}
                        onChange={(e) => {
                          recvTouched.current.add(String(it.id));
                          setRecvQty((m) => ({ ...m, [String(it.id)]: e.target.value }));
                        }} />
                    </td>
                    {canSeeCost && (
                      <td>
                        <input type="number" step="0.01" min="0" className="form-control form-control-sm"
                          value={recvCost[String(it.id)] ?? ''}
                          onChange={(e) => setRecvCost((m) => ({ ...m, [String(it.id)]: e.target.value }))} />
                      </td>
                    )}
                  </tr>
                ))}
                {recvItems.length === 0 && !recvErr && (
                  <tr><td colSpan={6}><Loading /></td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="small text-muted mb-0">Lines left at 0 are not received. Stock is posted at the unit cost shown.</p>
        </form>
      </Modal>

      <Modal show={detailLoading || !!detail || !!detailErr} title={detail ? detail.po_number : 'Purchase order'} onClose={() => setDetail(null)}
        footer={<button className="btn btn-outline-secondary" onClick={() => setDetail(null)}>Close</button>}
      >
        {detailLoading && <Loading />}
        {!detailLoading && detailErr && <div className="alert alert-danger py-2 small">{detailErr}</div>}
        {!detailLoading && !detailErr && detail && (
          <div>
            <div className="row g-3 mb-4">
              <div className="col-6 col-md-3">
                <div className="small text-muted">Supplier</div>
                <div className="fw-semibold">{detail.supplier || '—'}</div>
              </div>
              <div className="col-6 col-md-3">
                <div className="small text-muted">Branch</div>
                <div>{detail.branch || '—'}</div>
              </div>
              <div className="col-6 col-md-3">
                <div className="small text-muted">Status</div>
                <Badge status={detail.status} />
              </div>
              <div className="col-6 col-md-3">
                <div className="small text-muted">Expected</div>
                <div>{fmtDate(detail.expected_date)}</div>
              </div>
              <div className="col-6 col-md-3">
                <div className="small text-muted">Ordered / received</div>
                <div className="fw-semibold">{detail.ordered_quantity} / {detail.received_quantity}</div>
              </div>
              {detail.total_amount !== undefined && (
                <div className="col-6 col-md-3">
                  <div className="small text-muted">Total</div>
                  <div className="money fw-semibold">{fmtMoney(detail.total_amount)}</div>
                </div>
              )}
              <div className="col-6 col-md-3">
                <div className="small text-muted">Created</div>
                <div>{fmtDateTime(detail.created_at)}</div>
              </div>
              <div className="col-6 col-md-3">
                <div className="small text-muted">Created by</div>
                <div>{detail.created_by_name || '—'}</div>
              </div>
              {detail.notes && (
                <div className="col-12">
                  <div className="small text-muted">Notes</div>
                  <div>{detail.notes}</div>
                </div>
              )}
            </div>

            <h6 className="fw-semibold mb-2">Lines</h6>
            <div className="table-responsive">
              <table className="table table-sm mb-0">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="text-end">Ordered</th>
                    <th className="text-end">Received</th>
                    {detail.items?.some((i: any) => i.unit_cost !== undefined) && <th className="text-end">Unit cost</th>}
                    {detail.items?.some((i: any) => i.line_total !== undefined) && <th className="text-end">Line total</th>}
                  </tr>
                </thead>
                <tbody>
                  {(detail.items || []).map((it: any) => (
                    <tr key={it.id}>
                      <td>
                        <div className="fw-semibold">{it.product}</div>
                        <div className="small text-muted">{it.sku}{it.variant ? ` · ${it.variant}` : ''}</div>
                      </td>
                      <td className="text-end">{it.quantity_ordered}</td>
                      <td className="text-end">{it.quantity_received}</td>
                      {it.unit_cost !== undefined && <td className="text-end money">{fmtMoney(it.unit_cost)}</td>}
                      {it.line_total !== undefined && <td className="text-end money fw-semibold">{fmtMoney(it.line_total)}</td>}
                    </tr>
                  ))}
                  {(detail.items || []).length === 0 && (
                    <tr><td colSpan={5}><EmptyState message="No lines on this order" /></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      <Modal show={supOpen} title={editing ? 'Edit supplier' : 'New supplier'} onClose={() => setSupOpen(false)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setSupOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveSupplier} disabled={supBusy}>{supBusy ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        <form onSubmit={saveSupplier}>
          {supErr && <div className="alert alert-danger py-2 small">{supErr}</div>}
          <Field label="Company name" required>
            <TextInput value={supForm.company_name} required onChange={(e) => set('company_name', e.target.value)} />
          </Field>
          <div className="row">
            <div className="col-md-6"><Field label="Contact person"><TextInput value={supForm.contact_person} onChange={(e) => set('contact_person', e.target.value)} /></Field></div>
            <div className="col-md-6"><Field label="Phone"><TextInput value={supForm.phone} onChange={(e) => set('phone', e.target.value)} /></Field></div>
          </div>
          <div className="row">
            <div className="col-md-6"><Field label="Email"><TextInput type="email" value={supForm.email} onChange={(e) => set('email', e.target.value)} /></Field></div>
            <div className="col-md-6"><Field label="Payment terms"><TextInput value={supForm.payment_terms} onChange={(e) => set('payment_terms', e.target.value)} placeholder="e.g. 30 days" /></Field></div>
          </div>
          <Field label="Address"><TextInput value={supForm.address} onChange={(e) => set('address', e.target.value)} /></Field>
          <Field label="Notes"><TextArea rows={2} value={supForm.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        </form>
      </Modal>

      <BarcodeScanner show={recvCam}
        onClose={() => { setRecvCam(false); recvScanRef.current?.focus(); }}
        onDetected={(value) => handleRecvScan(value)} sound={false} vibration={false} />
    </div>
  );
}
