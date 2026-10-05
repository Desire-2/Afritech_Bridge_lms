'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useFetch } from '@/lib/use-fetch';
import { api, can, fmtDateTime, fmtMoney } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { P } from '@/lib/permissions';
import { PageHeader, Loading, ErrorAlert, EmptyState, Pagination, Modal, Badge, ConfirmDialog } from '@/components/ui';
import { Field, TextInput, SelectInput, TextArea } from '@/components/form';
import { BarcodeInput, BarcodeScanner } from '@/components/shop';
import type { BarcodeInputHandle } from '@/components/shop';
import { BarcodeLookup, lookupBarcode, scanFeedback } from '@/lib/barcode';

type Tab = 'balances' | 'movements' | 'adjustments' | 'counts' | 'transfers' | 'alerts';

type ConfirmState = { title: string; message: string; run: () => void; danger?: boolean; label?: string } | null;

type Line = { product_id: string; variant_id: string; quantity: string };

type ScanNote = { kind: 'ok' | 'info' | 'warn' | 'error'; text: string };

const blankLine = (): Line => ({ product_id: '', variant_id: '', quantity: '' });

/** Reasons accepted by POST /api/shop/inventory/adjustments (inventory.py). */
const ADJ_REASONS = ['damage', 'loss', 'correction', 'shrinkage', 'found', 'return_to_supplier', 'other'];

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

export default function ShopInventoryPage() {
  const { user } = useAuth();
  const canAdjust = can(user, P.shopInventoryAdjust);
  const canCount = can(user, P.shopInventoryCount);
  const canTransfer = can(user, P.shopInventoryTransfer);

  const [tab, setTab] = useState<Tab>('balances');

  // Every list endpoint behind these tabs requires shop.inventory.view.
  const allTabs: { key: Tab; label: string; perm: string }[] = [
    { key: 'balances', label: 'Balances', perm: P.shopInventoryView },
    { key: 'movements', label: 'Movements', perm: P.shopInventoryView },
    { key: 'adjustments', label: 'Adjustments', perm: P.shopInventoryView },
    { key: 'counts', label: 'Counts', perm: P.shopInventoryView },
    { key: 'transfers', label: 'Transfers', perm: P.shopInventoryView },
    { key: 'alerts', label: 'Alerts', perm: P.shopInventoryView },
  ];
  const tabs = allTabs.filter((t) => can(user, t.perm));
  const active: Tab | '' = tabs.some((t) => t.key === tab) ? tab : (tabs[0]?.key || '');

  const [page, setPage] = useState(1);
  function goTab(t: Tab) { setTab(t); setPage(1); setRowErr(''); }

  const [balQ, setBalQ] = useState('');
  const [balStatus, setBalStatus] = useState('');
  const [adjStatus, setAdjStatus] = useState('');
  const [cntStatus, setCntStatus] = useState('');
  const [trfStatus, setTrfStatus] = useState('');
  const [alertScope, setAlertScope] = useState('open');

  const bal = useFetch(active === 'balances' ? '/api/shop/inventory/balances' : '', [page, balQ, balStatus], {
    page, per_page: 15,
    q: balQ || undefined,
    low_stock: balStatus === 'low' ? 'true' : undefined,
    in_stock: balStatus === 'in' ? 'true' : undefined,
  });
  const balItems = bal.data?.items || [];
  const showStockValue = balItems.some((b: any) => b.stock_value !== undefined);

  const mov = useFetch(active === 'movements' ? '/api/shop/inventory/movements' : '', [page], { page, per_page: 15 });
  const movItems = mov.data?.items || [];

  const adj = useFetch(active === 'adjustments' ? '/api/shop/inventory/adjustments' : '', [page, adjStatus], {
    page, per_page: 15, status: adjStatus || undefined,
  });
  const adjRows = adj.data?.items || [];

  const counts = useFetch(active === 'counts' ? '/api/shop/inventory/counts' : '', [page, cntStatus], {
    page, per_page: 15, status: cntStatus || undefined,
  });
  const countRows = counts.data?.items || [];

  const trf = useFetch(active === 'transfers' ? '/api/shop/inventory/transfers' : '', [page, trfStatus], {
    page, per_page: 15, status: trfStatus || undefined,
  });
  const trfRows = trf.data?.items || [];

  const alr = useFetch(active === 'alerts' ? '/api/shop/inventory/alerts' : '', [page, alertScope], {
    page, per_page: 15, open: alertScope === 'all' ? 'false' : undefined,
  });
  const alrRows = alr.data?.items || [];

  const [rowErr, setRowErr] = useState('');
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  // Reference data for the modals (branch + product pickers).
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [prodQ, setProdQ] = useState('');
  const [variantMap, setVariantMap] = useState<Record<string, any[]>>({});

  async function loadBranches() {
    try {
      // Complete branch list for users who can see the employee directory.
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

  async function loadProducts(q?: string) {
    try {
      const d: any = await api('/api/shop/products', { params: { per_page: 50, q: q || undefined } });
      setProducts(d.items || []);
    } catch {
      setProducts([]);
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

  // ── adjustments ───────────────────────────────────────────────────────────
  const [adjOpen, setAdjOpen] = useState(false);
  const [adjForm, setAdjForm] = useState({ reason: 'damage', direction: 'out', branch_id: '', notes: '' });
  const [adjLines, setAdjLines] = useState<Line[]>([blankLine()]);
  const [adjBusy, setAdjBusy] = useState(false);
  const [adjErr, setAdjErr] = useState('');

  async function openAdjustment() {
    setAdjForm({ reason: 'damage', direction: 'out', branch_id: '', notes: '' });
    setAdjLines([blankLine()]);
    setProdQ('');
    setAdjErr('');
    resetAdjScan();
    setAdjOpen(true);
    setTimeout(() => adjScanRef.current?.focus(), 0);
    await Promise.all([loadBranches(), loadProducts()]);
  }

  const adjScanRef = useRef<BarcodeInputHandle>(null);
  const [adjScan, setAdjScan] = useState('');
  const [adjScanBusy, setAdjScanBusy] = useState(false);
  const [adjCam, setAdjCam] = useState(false);
  const [adjNote, setAdjNote] = useState<ScanNote | null>(null);
  const [adjSerial, setAdjSerial] = useState('');
  const [adjUnknown, setAdjUnknown] = useState<BarcodeLookup | null>(null);
  const adjQtyRefs = useRef<Record<number, HTMLInputElement | null>>({});

  function resetAdjScan() {
    setAdjScan('');
    setAdjNote(null);
    setAdjSerial('');
    setAdjUnknown(null);
  }

  function adjScanFocus() {
    adjScanRef.current?.focus();
  }

  async function handleAdjScan(raw: string) {
    const code = String(raw || '').trim();
    if (!code) return;
    setAdjScanBusy(true);
    setAdjNote(null);
    setAdjSerial('');
    setAdjUnknown(null);
    try {
      const res: BarcodeLookup = await lookupBarcode(code, {
        branchId: adjForm.branch_id ? Number(adjForm.branch_id) : null,
        context: 'receiving',
      });
      if (!res.found) {
        setAdjUnknown(res);
        scanFeedback('error');
        return;
      }
      const product = res.product || {};
      const variant = res.variant || null;
      const pid = String(product.id);
      const vid = variant ? String(variant.id) : '';
      const label = [product.name, variant?.name].filter(Boolean).join(' — ');
      const stock = typeof res.available_stock === 'number' ? res.available_stock : 0;
      setProducts((list) => (list.some((p: any) => String(p.id) === pid)
        ? list
        : [{ id: product.id, name: product.name, sku: product.sku }, ...list]));
      ensureVariants(pid);
      let index = adjLines.findIndex((l) => l.product_id === pid && (String(l.variant_id || '') === vid || !l.variant_id));
      if (index < 0) index = adjLines.findIndex((l) => l.product_id === pid);
      const existing = index >= 0 ? adjLines[index] : undefined;
      const quantity = existing ? (Number(existing.quantity) || 0) + 1 : 1;
      let targetIndex = index;
      if (targetIndex < 0) {
        const blank = adjLines.findIndex((l) => !l.product_id);
        targetIndex = blank >= 0 ? blank : adjLines.length;
      }
      setAdjLines((rows) => {
        const next = [...rows];
        if (index >= 0) {
          const line = next[index];
          next[index] = { ...line, variant_id: line.variant_id || vid, quantity: String(quantity) };
          return next;
        }
        const filled = { product_id: pid, variant_id: vid, quantity: '1' };
        if (targetIndex < rows.length) next[targetIndex] = filled;
        else next.push(filled);
        return next;
      });
      const target = adjQtyRefs.current[targetIndex];
      if (target) target.scrollIntoView({ block: 'nearest' });
      setAdjNote({
        kind: 'ok',
        text: `${label} added — quantity ${quantity} · ${stock} in stock at this branch`,
      });
      if (product.is_serialized) {
        setAdjSerial('Serialized product — enter each serial/IMEI before saving');
      }
      scanFeedback('ok');
    } catch (err: any) {
      setAdjNote({ kind: 'error', text: scanFailureText(err) });
      scanFeedback('error');
    } finally {
      setAdjScanBusy(false);
      setAdjScan('');
      adjScanFocus();
    }
  }

  function setAdjLine(index: number, key: keyof Line, value: string) {
    setAdjLines((rows) => rows.map((r, i) => (i === index ? { ...r, [key]: value } : r)));
  }

  async function saveAdjustment(e: React.FormEvent) {
    e.preventDefault();
    setAdjBusy(true);
    setAdjErr('');
    try {
      await api('/api/shop/inventory/adjustments', {
        method: 'POST',
        body: {
          reason: adjForm.reason,
          direction: adjForm.direction,
          branch_id: adjForm.branch_id ? Number(adjForm.branch_id) : undefined,
          notes: adjForm.notes || undefined,
          items: adjLines
            .filter((r) => r.product_id && r.quantity !== '')
            .map((r) => ({
              product_id: Number(r.product_id),
              variant_id: r.variant_id ? Number(r.variant_id) : undefined,
              quantity: Number(r.quantity),
            })),
        },
      });
      setAdjOpen(false);
      adj.reload();
    } catch (err: any) {
      setAdjErr(err.message);
    } finally {
      setAdjBusy(false);
    }
  }

  // ── counts ────────────────────────────────────────────────────────────────
  const [cntOpen, setCntOpen] = useState(false);
  const [cntBranch, setCntBranch] = useState('');
  const [cntBusy, setCntBusy] = useState(false);
  const [cntErr, setCntErr] = useState('');

  const [submitTarget, setSubmitTarget] = useState<any | null>(null);
  const [submitItems, setSubmitItems] = useState<any[]>([]);
  const [countInputs, setCountInputs] = useState<Record<string, string>>({});
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitErr, setSubmitErr] = useState('');

  async function openCount() {
    setCntBranch('');
    setCntErr('');
    setCntOpen(true);
    await loadBranches();
  }

  async function saveCount(e: React.FormEvent) {
    e.preventDefault();
    setCntBusy(true);
    setCntErr('');
    try {
      await api('/api/shop/inventory/counts', {
        method: 'POST',
        body: { branch_id: cntBranch ? Number(cntBranch) : undefined },
      });
      setCntOpen(false);
      counts.reload();
    } catch (err: any) {
      setCntErr(err.message);
    } finally {
      setCntBusy(false);
    }
  }

  async function openSubmit(row: any) {
    setSubmitTarget(row);
    setSubmitItems([]);
    setCountInputs({});
    setSubmitErr('');
    setCntScan('');
    setCntNote(null);
    setCntSerial('');
    setCntUnknown(null);
    setTimeout(() => cntScanRef.current?.focus(), 0);
    try {
      const d: any = await api(`/api/shop/inventory/counts/${row.id}`);
      setSubmitItems(d?.count?.items || []);
    } catch (err: any) {
      setSubmitErr(err.message);
    }
  }

  const cntScanRef = useRef<BarcodeInputHandle>(null);
  const [cntScan, setCntScan] = useState('');
  const [cntScanBusy, setCntScanBusy] = useState(false);
  const [cntCam, setCntCam] = useState(false);
  const [cntNote, setCntNote] = useState<ScanNote | null>(null);
  const [cntSerial, setCntSerial] = useState('');
  const [cntUnknown, setCntUnknown] = useState<BarcodeLookup | null>(null);
  const cntInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function handleCntScan(raw: string) {
    const code = String(raw || '').trim();
    if (!code) return;
    setCntScanBusy(true);
    setCntNote(null);
    setCntSerial('');
    setCntUnknown(null);
    try {
      const res: BarcodeLookup = await lookupBarcode(code, {
        branchId: submitTarget?.branch_id ? Number(submitTarget.branch_id) : null,
        context: 'count',
      });
      if (!res.found) {
        setCntUnknown(res);
        scanFeedback('error');
        return;
      }
      const product = res.product || {};
      const variant = res.variant || null;
      const label = [product.name, variant?.name].filter(Boolean).join(' — ');
      const vid = variant ? String(variant.id) : '';
      let row: any = submitItems.find((it: any) =>
        String(it.product_id) === String(product.id) && String(it.variant_id || '') === vid);
      if (!row) row = submitItems.find((it: any) => String(it.product_id) === String(product.id));
      if (!row) {
        setCntNote({ kind: 'warn', text: `${label} is not on this count sheet.` });
        scanFeedback('error');
        return;
      }
      const key = String(row.id);
      const quantity = (Number(countInputs[key] || 0) || 0) + 1;
      setCountInputs((m) => ({ ...m, [key]: String(quantity) }));
      const input = cntInputRefs.current[key];
      if (input) input.scrollIntoView({ block: 'nearest' });
      setCntNote({
        kind: 'ok',
        text: `${label} — counted ${quantity} · system ${row.system_quantity ?? 0}`,
      });
      if (product.is_serialized) {
        setCntSerial('Serialized product — enter each serial/IMEI before saving');
      }
      scanFeedback('ok');
    } catch (err: any) {
      setCntNote({ kind: 'error', text: scanFailureText(err) });
      scanFeedback('error');
    } finally {
      setCntScanBusy(false);
      setCntScan('');
      cntScanRef.current?.focus();
    }
  }

  async function saveSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitBusy(true);
    setSubmitErr('');
    try {
      // Backend accepts the {product_id: quantity} dict form.
      const counted: Record<string, string> = {};
      submitItems.forEach((it: any) => {
        const value = countInputs[String(it.id)];
        if (value !== undefined && value !== '') counted[String(it.product_id)] = value;
      });
      await api(`/api/shop/inventory/counts/${submitTarget.id}/submit`, {
        method: 'POST',
        body: { counted, allow_partial: true },
      });
      setSubmitTarget(null);
      counts.reload();
    } catch (err: any) {
      setSubmitErr(err.message);
    } finally {
      setSubmitBusy(false);
    }
  }

  async function act(path: string, body: any = {}) {
    setRowErr('');
    try {
      await api(path, { method: 'POST', body });
      counts.reload();
      trf.reload();
      alr.reload();
    } catch (err: any) {
      setRowErr(err.message);
    }
  }

  // ── transfers ─────────────────────────────────────────────────────────────
  const [trfOpen, setTrfOpen] = useState(false);
  const [trfForm, setTrfForm] = useState({ from_branch_id: '', to_branch_id: '' });
  const [trfLines, setTrfLines] = useState<Line[]>([blankLine()]);
  const [trfBusy, setTrfBusy] = useState(false);
  const [trfErr, setTrfErr] = useState('');

  async function openTransfer() {
    setTrfForm({ from_branch_id: '', to_branch_id: '' });
    setTrfLines([blankLine()]);
    setProdQ('');
    setTrfErr('');
    setTrfOpen(true);
    await Promise.all([loadBranches(), loadProducts()]);
  }

  function setTrfLine(index: number, key: keyof Line, value: string) {
    setTrfLines((rows) => rows.map((r, i) => (i === index ? { ...r, [key]: value } : r)));
  }

  async function saveTransfer(e: React.FormEvent) {
    e.preventDefault();
    setTrfBusy(true);
    setTrfErr('');
    try {
      await api('/api/shop/inventory/transfers', {
        method: 'POST',
        body: {
          from_branch_id: trfForm.from_branch_id ? Number(trfForm.from_branch_id) : undefined,
          to_branch_id: trfForm.to_branch_id ? Number(trfForm.to_branch_id) : undefined,
          items: trfLines
            .filter((r) => r.product_id && r.quantity !== '')
            .map((r) => ({
              product_id: Number(r.product_id),
              variant_id: r.variant_id ? Number(r.variant_id) : undefined,
              quantity: Number(r.quantity),
            })),
        },
      });
      setTrfOpen(false);
      trf.reload();
    } catch (err: any) {
      setTrfErr(err.message);
    } finally {
      setTrfBusy(false);
    }
  }

  async function resolveAlert(id: number) {
    setRowErr('');
    try {
      await api(`/api/shop/inventory/alerts/${id}/resolve`, { method: 'POST', body: {} });
      alr.reload();
    } catch (err: any) {
      setRowErr(err.message);
    }
  }

  function lineBlock(line: Line, index: number, setLine: (i: number, k: keyof Line, v: string) => void, remove: (i: number) => void,
    onQtyRef?: (i: number, el: HTMLInputElement | null) => void) {
    const variants: any[] = line.product_id ? (variantMap[line.product_id] || []) : [];
    return (
      <div className="border rounded p-2 mb-2" key={index}>
        <div className="row g-2">
          <div className="col-md-5">
            <Field label="Product" required>
              <SelectInput value={line.product_id} required
                onChange={(e) => { setLine(index, 'product_id', e.target.value); setLine(index, 'variant_id', ''); ensureVariants(e.target.value); }}>
                <option value="">Select product…</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}
              </SelectInput>
            </Field>
          </div>
          <div className="col-md-3">
            <Field label="Variant">
              <SelectInput value={line.variant_id} onChange={(e) => setLine(index, 'variant_id', e.target.value)}>
                <option value="">Default</option>
                {variants.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </SelectInput>
            </Field>
          </div>
          <div className="col-md-3">
            <Field label="Quantity" required>
              <input type="number" step="1" min="1" className="form-control" value={line.quantity} required
                ref={onQtyRef ? (el) => onQtyRef(index, el) : undefined}
                onChange={(e) => setLine(index, 'quantity', e.target.value)} />
            </Field>
          </div>
          <div className="col-md-1 d-flex align-items-end pb-3 justify-content-end">
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => remove(index)} aria-label="Remove line">
              <i className="bi bi-trash" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const productPicker = (
    <Field label="Find products">
      <TextInput value={prodQ} placeholder="Search name or SKU…"
        onChange={(e) => { setProdQ(e.target.value); loadProducts(e.target.value); }} />
    </Field>
  );

  const branchSelect = (value: string, onChange: (v: string) => void, placeholder: string) => (
    <SelectInput value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
    </SelectInput>
  );

  return (
    <div>
      <PageHeader title="Inventory" subtitle="Stock balances, movements, counts and branch transfers" />

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

      {active === 'balances' && (
        <div>
          <div className="card mb-3">
            <div className="card-body d-flex flex-wrap gap-2 align-items-center">
              <i className="bi bi-search text-muted" />
              <input className="form-control form-control-sm" style={{ maxWidth: 280 }} placeholder="Search product name or SKU…"
                value={balQ} onChange={(e) => { setBalQ(e.target.value); setPage(1); }} />
              <select className="form-select form-select-sm" style={{ width: 170 }} value={balStatus}
                onChange={(e) => { setBalStatus(e.target.value); setPage(1); }}>
                <option value="">All stock</option>
                <option value="low">Low stock</option>
                <option value="in">In stock</option>
              </select>
            </div>
          </div>

          {bal.error && <ErrorAlert message={bal.error} onRetry={bal.reload} />}
          {bal.loading && <Loading />}
          {!bal.loading && !bal.error && balItems.length === 0 && <EmptyState message="No stock balances found" />}

          {!bal.loading && !bal.error && balItems.length > 0 && (
            <>
              <div className="card">
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead>
                      <tr>
                        <th>Product</th><th>SKU</th><th>Variant</th><th>Branch</th>
                        <th className="text-end">Quantity</th>
                        <th className="text-end">Reserved</th>
                        <th className="text-end">Available</th>
                        <th className="text-end">Damaged</th>
                        <th className="text-end">Reorder level</th>
                        {showStockValue && <th className="text-end">Stock value</th>}
                        <th>Last movement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {balItems.map((b: any) => {
                        const low = (b.reorder_level || 0) > 0 && b.quantity <= b.reorder_level;
                        return (
                          <tr key={b.id}>
                            <td className="fw-semibold">{b.product || '—'}</td>
                            <td>{b.sku || '—'}</td>
                            <td>{b.variant || '—'}</td>
                            <td>{b.branch || '—'}</td>
                            <td className={`text-end fw-semibold ${b.quantity === 0 ? 'text-danger' : ''}`}>{b.quantity}</td>
                            <td className="text-end text-muted">{b.reserved_quantity}</td>
                            <td className="text-end">{b.available_quantity}</td>
                            <td className="text-end">{b.damaged_quantity}</td>
                            <td className="text-end">
                              {b.reorder_level}
                              {low && <span className="ms-1"><Badge status="low" /></span>}
                            </td>
                            {showStockValue && <td className="text-end money fw-semibold">{fmtMoney(b.stock_value)}</td>}
                            <td>{fmtDateTime(b.last_movement_at)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <Pagination page={page} pages={bal.data?.pages || 1} total={bal.data?.total} onPage={setPage} />
            </>
          )}
        </div>
      )}

      {active === 'movements' && (
        <div>
          {mov.error && <ErrorAlert message={mov.error} onRetry={mov.reload} />}
          {mov.loading && <Loading />}
          {!mov.loading && !mov.error && movItems.length === 0 && <EmptyState message="No stock movements recorded" />}

          {!mov.loading && !mov.error && movItems.length > 0 && (
            <>
              <div className="card">
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead>
                      <tr>
                        <th>Date</th><th>Product</th><th>SKU</th><th>Branch</th><th>Movement</th>
                        <th className="text-end">Quantity</th><th>Reference</th><th>Note</th><th>Recorded by</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movItems.map((m: any) => (
                        <tr key={m.id}>
                          <td>{fmtDateTime(m.created_at)}</td>
                          <td className="fw-semibold">{m.product || '—'}</td>
                          <td>{m.sku || '—'}</td>
                          <td>{m.branch || '—'}</td>
                          <td>{String(m.movement_type || '').replace(/_/g, ' ')}</td>
                          <td className={`text-end fw-semibold ${m.quantity < 0 ? 'text-danger' : 'text-success'}`}>
                            {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                          </td>
                          <td>{m.reference_type || '—'}{m.reference_id ? ` #${m.reference_id}` : ''}</td>
                          <td><div className="text-truncate" style={{ maxWidth: 200 }} title={m.note || ''}>{m.note || '—'}</div></td>
                          <td>{m.created_by_name || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <Pagination page={page} pages={mov.data?.pages || 1} total={mov.data?.total} onPage={setPage} />
            </>
          )}
        </div>
      )}

      {active === 'adjustments' && (
        <div>
          <div className="card mb-3">
            <div className="card-body d-flex flex-wrap gap-2 align-items-center justify-content-between">
              <div className="d-flex flex-wrap gap-2 align-items-center">
                <select className="form-select form-select-sm" style={{ width: 170 }} value={adjStatus}
                  onChange={(e) => { setAdjStatus(e.target.value); setPage(1); }}>
                  <option value="">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="applied">Applied</option>
                </select>
              </div>
              {canAdjust && (
                <button className="btn btn-primary btn-sm" onClick={openAdjustment}>
                  <i className="bi bi-plus-circle me-1" /> New adjustment
                </button>
              )}
            </div>
          </div>

          {adj.error && <ErrorAlert message={adj.error} onRetry={adj.reload} />}
          {adj.loading && <Loading />}
          {!adj.loading && !adj.error && adjRows.length === 0 && <EmptyState message="No adjustments found" />}

          {!adj.loading && !adj.error && adjRows.length > 0 && (
            <>
              <div className="card">
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead>
                      <tr>
                        <th>Adjustment #</th><th>Branch</th><th>Reason</th><th>Movement</th>
                        <th>Status</th><th>Created by</th><th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adjRows.map((a: any) => (
                        <tr key={a.id}>
                          <td className="fw-semibold">{a.adjustment_number}</td>
                          <td>{a.branch || '—'}</td>
                          <td>{String(a.reason || '').replace(/_/g, ' ')}</td>
                          <td>{String(a.movement_type || '').replace(/_/g, ' ')}</td>
                          <td><Badge status={a.status} /></td>
                          <td>{a.created_by_name || '—'}</td>
                          <td>{fmtDateTime(a.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <Pagination page={page} pages={adj.data?.pages || 1} total={adj.data?.total} onPage={setPage} />
            </>
          )}
        </div>
      )}

      {active === 'counts' && (
        <div>
          <div className="card mb-3">
            <div className="card-body d-flex flex-wrap gap-2 align-items-center justify-content-between">
              <select className="form-select form-select-sm" style={{ width: 170 }} value={cntStatus}
                onChange={(e) => { setCntStatus(e.target.value); setPage(1); }}>
                <option value="">All statuses</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              {canCount && (
                <button className="btn btn-primary btn-sm" onClick={openCount}>
                  <i className="bi bi-plus-circle me-1" /> New count
                </button>
              )}
            </div>
          </div>

          {counts.error && <ErrorAlert message={counts.error} onRetry={counts.reload} />}
          {counts.loading && <Loading />}
          {!counts.loading && !counts.error && countRows.length === 0 && <EmptyState message="No stock counts found" />}

          {!counts.loading && !counts.error && countRows.length > 0 && (
            <>
              <div className="card">
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead>
                      <tr>
                        <th>Count #</th><th>Branch</th><th>Type</th><th>Status</th><th>Totals</th>
                        <th>Created by</th><th>Created</th>
                        {(canCount || canAdjust) && <th />}
                      </tr>
                    </thead>
                    <tbody>
                      {countRows.map((c: any) => (
                        <tr key={c.id}>
                          <td className="fw-semibold">{c.count_number}</td>
                          <td>{c.branch || '—'}</td>
                          <td>{c.count_type || '—'}</td>
                          <td><Badge status={c.status} /></td>
                          <td>
                            <div className="small">{c.totals?.lines ?? 0} lines</div>
                            <div className="small text-muted">
                              expected {c.totals?.expected ?? 0} · counted {c.totals?.counted ?? 0}
                            </div>
                            <div className={`small fw-semibold ${(c.totals?.variance || 0) < 0 ? 'text-danger' : ''}`}>
                              variance {c.totals?.variance ?? 0}
                            </div>
                          </td>
                          <td>{c.created_by_name || '—'}</td>
                          <td>{fmtDateTime(c.created_at)}</td>
                          {(canCount || canAdjust) && (
                            <td className="text-end whitespace-nowrap">
                              {(c.status === 'draft' || c.status === 'submitted') && canCount && (
                                <button className="btn btn-sm btn-outline-primary me-1" onClick={() => openSubmit(c)}>Submit</button>
                              )}
                              {c.status === 'submitted' && canAdjust && (
                                <>
                                  <button className="btn btn-sm btn-outline-success me-1"
                                    onClick={() => setConfirm({
                                      title: 'Approve count',
                                      message: `Approve ${c.count_number}? Variances are posted to stock as permanent movements.`,
                                      label: 'Approve', danger: false,
                                      run: () => act(`/api/shop/inventory/counts/${c.id}/approve`),
                                    })}>Approve</button>
                                  <button className="btn btn-sm btn-outline-danger"
                                    onClick={() => setConfirm({
                                      title: 'Reject count',
                                      message: `Reject ${c.count_number}? No stock is changed.`,
                                      label: 'Reject',
                                      run: () => act(`/api/shop/inventory/counts/${c.id}/reject`),
                                    })}>Reject</button>
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
              <Pagination page={page} pages={counts.data?.pages || 1} total={counts.data?.total} onPage={setPage} />
            </>
          )}
        </div>
      )}

      {active === 'transfers' && (
        <div>
          <div className="card mb-3">
            <div className="card-body d-flex flex-wrap gap-2 align-items-center justify-content-between">
              <select className="form-select form-select-sm" style={{ width: 170 }} value={trfStatus}
                onChange={(e) => { setTrfStatus(e.target.value); setPage(1); }}>
                <option value="">All statuses</option>
                <option value="requested">Requested</option>
                <option value="approved">Approved</option>
                <option value="dispatched">Dispatched</option>
                <option value="received">Received</option>
                <option value="cancelled">Cancelled</option>
              </select>
              {canTransfer && (
                <button className="btn btn-primary btn-sm" onClick={openTransfer}>
                  <i className="bi bi-plus-circle me-1" /> New transfer
                </button>
              )}
            </div>
          </div>

          {trf.error && <ErrorAlert message={trf.error} onRetry={trf.reload} />}
          {trf.loading && <Loading />}
          {!trf.loading && !trf.error && trfRows.length === 0 && <EmptyState message="No stock transfers found" />}

          {!trf.loading && !trf.error && trfRows.length > 0 && (
            <>
              <div className="card">
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead>
                      <tr>
                        <th>Transfer #</th><th>Route</th><th>Status</th>
                        <th className="text-end">Items</th><th>Created</th>
                        {canTransfer && <th />}
                      </tr>
                    </thead>
                    <tbody>
                      {trfRows.map((t: any) => (
                        <tr key={t.id}>
                          <td className="fw-semibold">{t.transfer_number}</td>
                          <td>{t.from_branch || '—'} <i className="bi bi-arrow-right mx-1 text-muted" /> {t.to_branch || '—'}</td>
                          <td><Badge status={t.status} /></td>
                          <td className="text-end">{t.item_count}</td>
                          <td>{fmtDateTime(t.created_at)}</td>
                          {canTransfer && (
                            <td className="text-end">
                              {(t.status === 'requested' || t.status === 'approved') && (
                                <button className="btn btn-sm btn-outline-primary me-1"
                                  onClick={() => act(`/api/shop/inventory/transfers/${t.id}/dispatch`)}>Dispatch</button>
                              )}
                              {t.status === 'dispatched' && (
                                <button className="btn btn-sm btn-outline-success me-1"
                                  onClick={() => act(`/api/shop/inventory/transfers/${t.id}/receive`)}>Receive</button>
                              )}
                              {t.status !== 'received' && t.status !== 'cancelled' && (
                                <button className="btn btn-sm btn-outline-danger"
                                  onClick={() => setConfirm({
                                    title: 'Cancel transfer',
                                    message: `Cancel ${t.transfer_number}? Stock will not move between branches.`,
                                    label: 'Cancel transfer',
                                    run: () => act(`/api/shop/inventory/transfers/${t.id}/cancel`),
                                  })}>Cancel</button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <Pagination page={page} pages={trf.data?.pages || 1} total={trf.data?.total} onPage={setPage} />
            </>
          )}
        </div>
      )}

      {active === 'alerts' && (
        <div>
          <div className="card mb-3">
            <div className="card-body d-flex flex-wrap gap-2 align-items-center">
              <select className="form-select form-select-sm" style={{ width: 170 }} value={alertScope}
                onChange={(e) => { setAlertScope(e.target.value); setPage(1); }}>
                <option value="open">Open alerts</option>
                <option value="all">All (incl. resolved)</option>
              </select>
            </div>
          </div>

          {alr.error && <ErrorAlert message={alr.error} onRetry={alr.reload} />}
          {alr.loading && <Loading />}
          {!alr.loading && !alr.error && alrRows.length === 0 && <EmptyState message="No stock alerts" />}

          {!alr.loading && !alr.error && alrRows.length > 0 && (
            <>
              <div className="card">
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead>
                      <tr>
                        <th>Type</th><th>Product</th><th>SKU</th><th>Branch</th><th>Message</th>
                        <th className="text-end">Quantity</th><th>Created</th><th>State</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {alrRows.map((a: any) => (
                        <tr key={a.id}>
                          <td>{String(a.alert_type || '').replace(/_/g, ' ')}</td>
                          <td className="fw-semibold">{a.product || '—'}</td>
                          <td>{a.sku || '—'}</td>
                          <td>{a.branch || '—'}</td>
                          <td><div className="text-truncate" style={{ maxWidth: 260 }} title={a.message}>{a.message}</div></td>
                          <td className="text-end">{a.quantity ?? '—'}</td>
                          <td>{fmtDateTime(a.created_at)}</td>
                          <td><Badge status={a.is_open ? 'open' : 'resolved'} /></td>
                          <td className="text-end">
                            {a.is_open && (
                              <button className="btn btn-sm btn-outline-secondary"
                                onClick={() => setConfirm({
                                  title: 'Resolve alert',
                                  message: `Mark "${a.message}" as resolved?`,
                                  label: 'Resolve', danger: false,
                                  run: () => resolveAlert(a.id),
                                })}>Resolve</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <Pagination page={page} pages={alr.data?.pages || 1} total={alr.data?.total} onPage={setPage} />
            </>
          )}
        </div>
      )}

      <Modal show={adjOpen} title="New stock adjustment" onClose={() => setAdjOpen(false)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setAdjOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveAdjustment} disabled={adjBusy}>{adjBusy ? 'Saving…' : 'Apply adjustment'}</button>
          </>
        }
      >
        <form onSubmit={saveAdjustment}>
          {adjErr && <div className="alert alert-danger py-2 small">{adjErr}</div>}
          <div className="row">
            <div className="col-md-4">
              <Field label="Reason" required>
                <SelectInput value={adjForm.reason} onChange={(e) => setAdjForm((f) => ({ ...f, reason: e.target.value }))}>
                  {ADJ_REASONS.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                </SelectInput>
              </Field>
            </div>
            <div className="col-md-4">
              <Field label="Direction" required>
                <SelectInput value={adjForm.direction} onChange={(e) => setAdjForm((f) => ({ ...f, direction: e.target.value }))}>
                  <option value="out">Stock out</option>
                  <option value="in">Stock in</option>
                </SelectInput>
              </Field>
            </div>
            <div className="col-md-4">
              <Field label="Branch">
                {branchSelect(adjForm.branch_id, (v) => setAdjForm((f) => ({ ...f, branch_id: v })), 'My branch (default)')}
              </Field>
            </div>
          </div>
          <Field label="Notes"><TextArea rows={2} value={adjForm.notes} onChange={(e) => setAdjForm((f) => ({ ...f, notes: e.target.value }))} /></Field>

          <div className="border rounded p-2 mb-2">
            <BarcodeInput
              ref={adjScanRef}
              value={adjScan}
              onChange={setAdjScan}
              onScan={handleAdjScan}
              onCamera={() => setAdjCam(true)}
              onClear={() => { setAdjScan(''); setAdjUnknown(null); }}
              busy={adjScanBusy}
              label="Scan barcode"
              hint="Scan a barcode to add the product"
              placeholder="Scan or type a barcode, then Enter"
              dedupeMs={1200}
            />
            <ScanNoteAlert note={adjNote} />
            {adjSerial && <div className="alert alert-warning py-2 small mt-2 mb-0">{adjSerial}</div>}
            {adjUnknown && (
              <ScanUnknownPanel user={user} result={adjUnknown}
                onScanAgain={() => { setAdjUnknown(null); setAdjScan(''); adjScanFocus(); }}
                onEnter={() => { setAdjScan(adjUnknown.barcode); adjScanFocus(); }}
                onCancel={() => setAdjUnknown(null)} />
            )}
          </div>

          {productPicker}
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="small fw-semibold text-muted">Lines</span>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setAdjLines((rows) => [...rows, blankLine()])}>
              <i className="bi bi-plus-lg me-1" />Add line
            </button>
          </div>
          {adjLines.map((l, i) => lineBlock(l, i, setAdjLine, (idx) => setAdjLines((rows) => rows.filter((_, j) => j !== idx)),
            (idx, el) => { adjQtyRefs.current[idx] = el; }))}
        </form>
      </Modal>

      <Modal show={cntOpen} title="New stock count" onClose={() => setCntOpen(false)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setCntOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveCount} disabled={cntBusy}>{cntBusy ? 'Starting…' : 'Start count'}</button>
          </>
        }
      >
        <form onSubmit={saveCount}>
          {cntErr && <div className="alert alert-danger py-2 small">{cntErr}</div>}
          <Field label="Branch" required hint="Every product with a balance at this branch is added to the count sheet.">
            {branchSelect(cntBranch, setCntBranch, 'My branch (default)')}
          </Field>
        </form>
      </Modal>

      <Modal show={!!submitTarget} title={submitTarget ? `Count ${submitTarget.count_number}` : 'Submit count'}
        onClose={() => setSubmitTarget(null)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setSubmitTarget(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveSubmit} disabled={submitBusy}>{submitBusy ? 'Submitting…' : 'Submit count'}</button>
          </>
        }
      >
        {submitErr && <div className="alert alert-danger py-2 small">{submitErr}</div>}
        <div className="border rounded p-2 mb-2">
          <BarcodeInput
            ref={cntScanRef}
            value={cntScan}
            onChange={setCntScan}
            onScan={handleCntScan}
            onCamera={() => setCntCam(true)}
            onClear={() => { setCntScan(''); setCntUnknown(null); }}
            busy={cntScanBusy}
            label="Scan barcode"
            hint="Scan a barcode to jump to its counted quantity"
            placeholder="Scan or type a barcode, then Enter"
            dedupeMs={1200}
          />
          <ScanNoteAlert note={cntNote} />
          {cntSerial && <div className="alert alert-warning py-2 small mt-2 mb-0">{cntSerial}</div>}
          {cntUnknown && (
            <ScanUnknownPanel user={user} result={cntUnknown}
              onScanAgain={() => { setCntUnknown(null); setCntScan(''); cntScanRef.current?.focus(); }}
              onEnter={() => { setCntScan(cntUnknown.barcode); cntScanRef.current?.focus(); }}
              onCancel={() => setCntUnknown(null)} />
          )}
        </div>
        <p className="small text-muted">Enter the quantity physically counted for each line. Lines left blank stay uncounted.</p>
        <div className="table-responsive">
          <table className="table table-sm mb-0">
            <thead>
              <tr><th>Product</th><th>Variant</th><th className="text-end">System</th><th style={{ width: 140 }}>Counted</th></tr>
            </thead>
            <tbody>
              {submitItems.map((it: any) => (
                <tr key={it.id}>
                  <td><div className="fw-semibold">{it.product}</div><div className="small text-muted">{it.sku}</div></td>
                  <td>{it.variant || '—'}</td>
                  <td className="text-end">{it.system_quantity}</td>
                  <td>
                    <input type="number" step="1" min="0" className="form-control form-control-sm"
                      ref={(el) => { cntInputRefs.current[String(it.id)] = el; }}
                      value={countInputs[String(it.id)] ?? ''}
                      onChange={(e) => setCountInputs((m) => ({ ...m, [String(it.id)]: e.target.value }))} />
                  </td>
                </tr>
              ))}
              {submitItems.length === 0 && !submitErr && (
                <tr><td colSpan={4}><Loading /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Modal>

      <Modal show={trfOpen} title="New stock transfer" onClose={() => setTrfOpen(false)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setTrfOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveTransfer} disabled={trfBusy}>{trfBusy ? 'Saving…' : 'Create transfer'}</button>
          </>
        }
      >
        <form onSubmit={saveTransfer}>
          {trfErr && <div className="alert alert-danger py-2 small">{trfErr}</div>}
          <div className="row">
            <div className="col-md-6">
              <Field label="From branch">
                {branchSelect(trfForm.from_branch_id, (v) => setTrfForm((f) => ({ ...f, from_branch_id: v })), 'My branch (default)')}
              </Field>
            </div>
            <div className="col-md-6">
              <Field label="To branch" required>
                {branchSelect(trfForm.to_branch_id, (v) => setTrfForm((f) => ({ ...f, to_branch_id: v })), 'Select branch…')}
              </Field>
            </div>
          </div>

          {productPicker}
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="small fw-semibold text-muted">Lines</span>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setTrfLines((rows) => [...rows, blankLine()])}>
              <i className="bi bi-plus-lg me-1" />Add line
            </button>
          </div>
          {trfLines.map((l, i) => lineBlock(l, i, setTrfLine, (idx) => setTrfLines((rows) => rows.filter((_, j) => j !== idx))))}
        </form>
      </Modal>

      <BarcodeScanner show={adjCam}
        onClose={() => { setAdjCam(false); adjScanFocus(); }}
        onDetected={(value) => handleAdjScan(value)} sound={false} vibration={false} />
      <BarcodeScanner show={cntCam}
        onClose={() => { setCntCam(false); cntScanRef.current?.focus(); }}
        onDetected={(value) => handleCntScan(value)} sound={false} vibration={false} />
    </div>
  );
}
