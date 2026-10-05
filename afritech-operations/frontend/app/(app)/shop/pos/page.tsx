'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useFetch } from '@/lib/use-fetch';
import { api, can, fmtMoney } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { P } from '@/lib/permissions';
import { PageHeader, ErrorAlert, EmptyState, Modal, ConfirmDialog } from '@/components/ui';
import { Field, TextInput, SelectInput } from '@/components/form';
import { BarcodeInput, BarcodeScanner, OutOfStockDialog } from '@/components/shop';
import type { BarcodeInputHandle } from '@/components/shop';
import {
  BarcodeLookup,
  SCANNER_DEFAULTS,
  ScannerSettings,
  lookupBarcode,
  scanFeedback,
} from '@/lib/barcode';

type Line = {
  product_id: number;
  variant_id: number | null;
  name: string;
  sku: string;
  barcode: string | null;
  unit_price: number;
  quantity: number;
  available: number | null;
  discount_percent: number;
  discount_amount: number;
  tax_rate: number;
  serialized: boolean;
  branches?: any[];
};

const TAX_CHOICES = [
  { label: 'No tax', value: 0 },
  { label: 'VAT 18%', value: 18 },
];

export default function ShopPosPage() {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [scan, setScan] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [cartDiscountPercent, setCartDiscountPercent] = useState('');
  const [cartDiscountAmount, setCartDiscountAmount] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [promotionCode, setPromotionCode] = useState('');
  const [taxRate, setTaxRate] = useState(0);
  const [customerId, setCustomerId] = useState('');
  const [methodId, setMethodId] = useState('');
  const [tendered, setTendered] = useState('');
  const [busy, setBusy] = useState(false);
  const [error2, setError2] = useState('');
  const [done, setDone] = useState<any | null>(null);
  const [receipt, setReceipt] = useState<any | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [notFound, setNotFound] = useState<BarcodeLookup | null>(null);
  const [outOf, setOutOf] = useState<BarcodeLookup | null>(null);
  const [flash, setFlash] = useState<{ kind: 'ok' | 'warn'; text: string } | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [prefs, setPrefs] = useState<ScannerSettings>(SCANNER_DEFAULTS);
  const [prefsDraft, setPrefsDraft] = useState<ScannerSettings>(SCANNER_DEFAULTS);
  const [heldOpen, setHeldOpen] = useState(false);
  const [heldTarget, setHeldTarget] = useState<any | null>(null);
  const [heldTendered, setHeldTendered] = useState('');
  const [heldErr, setHeldErr] = useState('');
  const [heldBusy, setHeldBusy] = useState(false);
  const [discardTarget, setDiscardTarget] = useState<any | null>(null);
  const scanRef = useRef<BarcodeInputHandle>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  // Idempotency key for the current basket: a till that loses the network
  // mid-save retries with the same key so the backend replays the sale that
  // already exists instead of ringing it up twice.
  const clientRef = useRef(newClientRef());

  function newClientRef(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return `pos-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  const canSell = can(user, P.shopSalesCreate);
  const canManageScanner = can(user, P.shopSettingsManage);
  const { data: products, error, loading } = useFetch(
    canSell ? '/api/shop/products' : '',
    [q], { q: q || undefined, per_page: 8 });
  const { data: customers } = useFetch(
    canSell ? '/api/shop/customers' : '', [], { per_page: 100 });
  const { data: methods } = useFetch('/api/shop/payment-methods', []);
  const { data: settings } = useFetch(canSell ? '/api/shop/settings' : '', []);
  // Held baskets for this till's branch — the count is shown next to "Hold".
  const { data: heldData, reload: reloadHeld } = useFetch(
    canSell ? '/api/shop/sales' : '', [], { status: 'held', per_page: 50 });

  const paymentMethods: any[] = methods?.payment_methods || [];
  const heldSales: any[] = heldData?.items || [];
  const customerList: any[] = customers?.items || [];
  const searchResults: any[] = products?.items || [];

  const limit = useMemo(() => {
    const thresholds = settings?.discount_thresholds || {};
    let value = Number(thresholds.default || 0);
    for (const code of user?.role_codes || []) {
      if (thresholds[code] !== undefined) value = Math.max(value, Number(thresholds[code]));
    }
    return value;
  }, [settings, user]);

  useEffect(() => {
    if (!methods && paymentMethods.length === 0) return;
    if (methodId || paymentMethods.length === 0) return;
    // The till opens on cash; the endpoint returns methods alphabetically.
    const preferred = paymentMethods.find((m: any) => m.code === 'cash')
      || paymentMethods[0];
    setMethodId(String(preferred.id));
  }, [methods, methodId, paymentMethods]);

  useEffect(() => {
    if (settings?.scanner) setPrefs({ ...SCANNER_DEFAULTS, ...settings.scanner });
  }, [settings]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(t);
  }, [flash]);

  useEffect(() => {
    if (canSell && prefs.autofocus && !done) scanRef.current?.focus();
  }, [canSell, prefs.autofocus, done]);

  const totals = useMemo(() => {
    let subtotal = 0;
    let lineDiscounts = 0;
    for (const l of lines) {
      const base = l.unit_price * l.quantity;
      subtotal += base;
      lineDiscounts += Math.min(
        base * (l.discount_percent / 100) + l.discount_amount, base);
    }
    const cartPercent = Number(cartDiscountPercent || 0);
    const cartFixed = Number(cartDiscountAmount || 0);
    const afterLines = subtotal - lineDiscounts;
    const cartTotal = Math.min(afterLines * (cartPercent / 100) + cartFixed, afterLines);
    const discount = lineDiscounts + cartTotal;
    const net = subtotal - discount;
    const tax = net * (taxRate / 100);
    return { subtotal, discount, net, tax, total: net + tax };
  }, [lines, cartDiscountPercent, cartDiscountAmount, taxRate]);

  const change = useMemo(() => {
    const paid = Number(tendered || 0);
    if (!paid) return 0;
    return paid - totals.total;
  }, [tendered, totals.total]);

  async function addProduct(p: any, opts: { merge?: boolean } = {}) {
    // The list payload carries no variant array — resolve it from the detail
    // endpoint so the sale line points at a real variant balance.
    let variant: any = p.matched_variant || null;
    if (!variant) {
      if (Array.isArray(p.variants)) {
        variant = p.variants[0] || null;
      } else {
        try {
          const d: any = await api(`/api/shop/products/${p.id}`);
          variant = (d.product?.variants || [])[0] || null;
        } catch {
          variant = null;
        }
      }
    }
    const variantId = variant?.id ?? null;
    const unitPrice = Number(
      (variant && variant.selling_price != null ? variant.selling_price : p.selling_price) || 0);
    const available = p.available ?? null;
    const merge = opts.merge !== false;
    setLines((prev) => {
      if (merge) {
        const idx = prev.findIndex(
          (l) => l.product_id === p.id && (l.variant_id ?? null) === variantId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
          return next;
        }
      }
      return [...prev, {
        product_id: p.id, variant_id: variantId, name: p.name,
        sku: variant?.sku || p.sku,
        barcode: variant?.barcode || p.barcode || null,
        unit_price: unitPrice, quantity: 1,
        available, discount_percent: 0, discount_amount: 0, tax_rate: taxRate,
        serialized: !!p.is_serialized, branches: p.branches,
      }];
    });
    setError2('');
  }

  function update(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function remove(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function focusScanner() {
    if (prefs.autofocus) scanRef.current?.focus();
  }

  async function handleScan(raw: string, source: 'manual' | 'hardware' | 'camera') {
    const code = String(raw || '').trim();
    if (!code || !canSell) return;
    setError2('');
    setNotFound(null);
    if (!prefs.auto_add) {
      setQ(code);
      setScan('');
      return;
    }
    setScanBusy(true);
    try {
      const res: BarcodeLookup = await lookupBarcode(code, { context: 'pos' });
      if (!res.found) {
        setNotFound(res);
        setScan('');
        scanFeedback('error', prefs);
        focusScanner();
        return;
      }
      const stock = typeof res.available_stock === 'number' ? res.available_stock : null;
      const product = res.product || {};
      // Resolve the exact variant first so the guard counts the same line
      // that addProduct will increment.
      let variant: any = res.variant || null;
      if (!variant) {
        if (Array.isArray(product.variants)) {
          variant = product.variants[0] || null;
        } else {
          try {
            const d: any = await api(`/api/shop/products/${product.id}`);
            variant = (d.product?.variants || [])[0] || null;
          } catch {
            variant = null;
          }
        }
      }
      const variantId = variant?.id ?? null;
      const inCart = lines
        .filter((l) => l.product_id === product.id && (l.variant_id ?? null) === variantId)
        .reduce((sum, l) => sum + l.quantity, 0);
      if (stock !== null && stock <= 0) {
        setOutOf(res);
        setScan('');
        scanFeedback('error', prefs);
        return;
      }
      if (stock !== null && inCart + 1 > stock) {
        setError2(
          `Only ${stock} in stock at this branch — ${product.name} cannot be added again.`
        );
        setScan('');
        scanFeedback('error', prefs);
        focusScanner();
        return;
      }
      await addProduct(
        { ...product, available: stock, matched_variant: variant || undefined, branches: res.branches },
        { merge: prefs.increment_repeat }
      );
      setScan('');
      scanFeedback('ok', prefs);
      const remaining = stock !== null ? stock - (inCart + 1) : null;
      const minLevel = Number(product.min_stock_level || 0);
      const label = variant ? `${product.name} — ${variant.name}` : product.name;
      if (remaining !== null && remaining > 0 && minLevel > 0 && remaining <= minLevel) {
        setFlash({ kind: 'warn', text: `${remaining} remaining after this sale.` });
      } else {
        setFlash({ kind: 'ok', text: `✓ ${label} added` });
      }
      focusScanner();
    } catch (err: any) {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      setError2(
        offline
          ? 'Cannot verify product because the network is unavailable.'
          : err?.message || 'Could not look up that barcode.'
      );
      scanFeedback('error', prefs);
    } finally {
      setScanBusy(false);
    }
  }

  async function saveScannerPrefs() {
    try {
      await api('/api/shop/settings', {
        method: 'PATCH',
        body: { 'shop.scanner': prefsDraft },
      });
      setPrefs(prefsDraft);
      setPrefsOpen(false);
      setError2('');
      focusScanner();
    } catch (err: any) {
      setError2(err.message);
    }
  }

  async function charge(hold: boolean) {
    if (lines.length === 0) {
      setError2('Add at least one item to the basket.');
      return;
    }
    const paid = Number(tendered || 0);
    if (!hold && paid <= 0) {
      setError2('Enter the amount tendered.');
      return;
    }
    setBusy(true);
    setError2('');
    try {
      const body: any = {
        items: lines.map((l) => ({
          product_id: l.product_id,
          variant_id: l.variant_id ?? undefined,
          barcode: l.barcode || undefined,
          quantity: l.quantity,
          unit_price: l.unit_price,
          discount_percent: l.discount_percent || undefined,
          discount_amount: l.discount_amount || undefined,
          tax_rate: l.tax_rate,
        })),
        payments: hold ? [] : [{ amount: paid, payment_method_id: Number(methodId) || undefined }],
        discount_percent: Number(cartDiscountPercent || 0) || undefined,
        discount_amount: Number(cartDiscountAmount || 0) || undefined,
        discount_reason: discountReason || undefined,
        promotion_code: promotionCode || undefined,
        hold: hold || undefined,
        client_ref: clientRef.current,
      };
      if (customerId) body.customer_id = Number(customerId);
      const d: any = await api('/api/shop/sales', { method: 'POST', body });
      const sale = d.sale;
      setDone({ sale, hold });
      setLines([]);
      setCartDiscountPercent('');
      setCartDiscountAmount('');
      setDiscountReason('');
      setPromotionCode('');
      setTendered('');
      setCustomerId('');
      clientRef.current = newClientRef();
      if (hold) reloadHeld();
      if (!hold) await loadReceipt(sale.id);
    } catch (err: any) {
      setError2(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function startHeldSale(sale: any) {
    setHeldErr('');
    setHeldTarget(sale);
    // Default the tender to the basket total so Enter-and-go works.
    setHeldTendered(String(Number(sale.total_amount || 0)));
  }

  async function completeHeldSale() {
    const sale = heldTarget;
    if (!sale) return;
    const paid = Number(heldTendered || 0);
    if (paid <= 0) {
      setHeldErr('Enter the amount tendered.');
      return;
    }
    setHeldBusy(true);
    setHeldErr('');
    try {
      const d: any = await api(`/api/shop/sales/${sale.id}/complete`, {
        method: 'POST',
        body: {
          payments: [{
            amount: paid,
            payment_method_id: Number(methodId) || undefined,
          }],
        },
      });
      const doneSale = d.sale;
      setHeldOpen(false);
      setHeldTarget(null);
      setHeldTendered('');
      reloadHeld();
      setDone({ sale: doneSale, hold: false });
      await loadReceipt(doneSale.id);
    } catch (err: any) {
      setHeldErr(err.message);
    } finally {
      setHeldBusy(false);
    }
  }

  async function discardHeldSale() {
    const sale = discardTarget;
    if (!sale) return;
    await api(`/api/shop/sales/${sale.id}/cancel`, {
      method: 'POST',
      body: { reason: 'Discarded from the held list' },
    });
    if (heldTarget?.id === sale.id) {
      setHeldTarget(null);
      setHeldTendered('');
    }
    reloadHeld();
  }

  function closeHeldModal() {
    setHeldOpen(false);
    setHeldTarget(null);
    setHeldTendered('');
    setHeldErr('');
  }

  async function loadReceipt(saleId: number) {
    try {
      const d: any = await api(`/api/shop/sales/${saleId}/receipt`);
      setReceipt(d.receipt || null);
    } catch {
      setReceipt(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Point of Sale"
        subtitle="Scan or search the catalogue, ring up the basket and take payment."
        actions={(
          <div className="d-flex gap-2">
            {canSell && (
              <button type="button" className="btn btn-outline-secondary"
                onClick={() => { closeHeldModal(); setHeldOpen(true); }}>
                <i className="bi bi-pause-circle me-1" /> Held
                {heldSales.length > 0 && (
                  <span className="badge text-bg-secondary ms-1">{heldSales.length}</span>
                )}
              </button>
            )}
            {done && (
              <button type="button" className="btn btn-outline-secondary"
                onClick={() => { setDone(null); setReceipt(null); }}>
                <i className="bi bi-plus-lg me-1" /> New sale
              </button>
            )}
          </div>
        )}
      />

      {done && (
        <div className="alert alert-success d-flex flex-wrap align-items-center gap-2 py-2 mb-3">
          <i className="bi bi-check-circle" />
          <span>
            {done.hold ? 'Held sale' : 'Sale'} <strong>{done.sale.sale_number}</strong>
            {done.hold ? ' saved to the held list.' : ` recorded — ${fmtMoney(done.sale.total_amount)} total.`}
          </span>
          {done.hold ? (
            <button type="button" className="btn btn-sm btn-outline-secondary ms-auto"
              onClick={() => { closeHeldModal(); setHeldOpen(true); }}>
              Open held list
            </button>
          ) : (
            <button type="button" className="btn btn-sm btn-outline-success ms-auto"
              onClick={() => loadReceipt(done.sale.id)}>
              View receipt
            </button>
          )}
        </div>
      )}

      <div className="row g-3">
        <div className="col-xl-8">
          <div className="card mb-3">
            <div className="card-body py-2">
              <div className="d-flex flex-wrap gap-2 align-items-center">
                <BarcodeInput
                  ref={scanRef}
                  className="flex-grow-1"
                  value={scan}
                  onChange={setScan}
                  onScan={(v: string, source: any) => handleScan(v, source)}
                  onCamera={() => setCameraOpen(true)}
                  onClear={() => setScan('')}
                  busy={scanBusy}
                  autoFocus={prefs.autofocus}
                  dedupeMs={prefs.dedupe_window_ms}
                  placeholder="Scan barcode or type SKU, then Enter"
                />
                <input ref={searchRef} className="form-control form-control-sm"
                  style={{ maxWidth: 240 }}
                  placeholder="Search catalogue"
                  value={q} onChange={(e) => setQ(e.target.value)} />
                {canManageScanner && (
                  <button type="button" className="btn btn-sm btn-outline-secondary"
                    title="Scanner settings"
                    onClick={() => { setPrefsDraft(prefs); setPrefsOpen((v) => !v); }}>
                    <i className="bi bi-gear" />
                  </button>
                )}
              </div>
              {flash && (
                <div className={`small mt-1 ${flash.kind === 'ok' ? 'text-success' : 'text-warning'}`}>
                  {flash.text}
                </div>
              )}
              {notFound && (
                <div className="alert alert-warning py-2 small mt-2 mb-0 d-flex flex-wrap align-items-center gap-2">
                  <i className="bi bi-exclamation-triangle" />
                  <span className="flex-grow-1">
                    No product with this barcode exists in the current inventory.{' '}
                    <span className="font-monospace">{notFound.barcode}</span>
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => {
                      setQ(notFound.barcode);
                      setNotFound(null);
                      setTimeout(() => searchRef.current?.focus(), 0);
                    }}>
                    Search Product
                  </button>
                  {can(user, P.shopProductsCreate) && (
                    <Link
                      className="btn btn-sm btn-outline-primary"
                      href={`/shop/catalog?new=1&barcode=${encodeURIComponent(notFound.barcode)}`}>
                      Register Product
                    </Link>
                  )}
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => { setNotFound(null); focusScanner(); }}>
                    Scan Again
                  </button>
                </div>
              )}
              {prefsOpen && canManageScanner && (
                <div className="border rounded p-2 mt-2">
                  <div className="small text-uppercase text-secondary mb-2">Scanner settings</div>
                  <div className="row g-2 align-items-end">
                    <div className="col-md-3">
                      <label className="form-label small mb-1">Preferred input</label>
                      <select
                        className="form-select form-select-sm"
                        value={prefsDraft.preferred_input}
                        onChange={(e) =>
                          setPrefsDraft({ ...prefsDraft, preferred_input: e.target.value as any })}>
                        <option value="camera">Camera</option>
                        <option value="hardware">Hardware scanner</option>
                        <option value="manual">Manual</option>
                      </select>
                    </div>
                    {([
                      ['auto_add', 'Auto-add scanned products'],
                      ['increment_repeat', 'Increment quantity on repeat scan'],
                      ['sound', 'Scan sound'],
                      ['vibration', 'Vibration'],
                      ['autofocus', 'Auto-focus scanner'],
                    ] as const).map(([key, label]) => (
                      <div className="col-md-3" key={key}>
                        <div className="form-check form-switch mt-4">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={`scan-${key}`}
                            checked={Boolean((prefsDraft as any)[key])}
                            onChange={(e) =>
                              setPrefsDraft({ ...prefsDraft, [key]: e.target.checked } as any)} />
                          <label className="form-check-label small" htmlFor={`scan-${key}`}>
                            {label}
                          </label>
                        </div>
                      </div>
                    ))}
                    <div className="col-md-3">
                      <label className="form-label small mb-1">Scan timeout (ms)</label>
                      <input
                        type="number"
                        min={100}
                        max={5000}
                        className="form-control form-control-sm"
                        value={prefsDraft.scan_timeout_ms}
                        onChange={(e) =>
                          setPrefsDraft({ ...prefsDraft, scan_timeout_ms: Number(e.target.value || 800) })} />
                    </div>
                  </div>
                  <div className="d-flex gap-2 mt-2 justify-content-end">
                    <button type="button" className="btn btn-sm btn-outline-secondary"
                      onClick={() => setPrefsOpen(false)}>
                      Cancel
                    </button>
                    <button type="button" className="btn btn-sm btn-primary"
                      onClick={saveScannerPrefs}>
                      Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card mb-3">
            <div className="card-header py-2 d-flex align-items-center justify-content-between">
              <span className="card-title mb-0 small text-uppercase">Catalogue</span>
              {loading && <span className="small text-muted">Searching…</span>}
            </div>
            {error && <div className="card-body"><ErrorAlert message={error} /></div>}
            {!loading && !error && searchResults.length === 0 && (
              <div className="card-body">
                <EmptyState message="No products match that search" hint="Try a SKU, barcode or product name." />
              </div>
            )}
            {!loading && searchResults.length > 0 && (
              <div className="table-responsive">
                <table className="table table-sm table-hover mb-0">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>SKU</th>
                      <th className="text-end">Price</th>
                      <th className="text-end">Available</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map((p: any) => (
                      <tr key={p.id}>
                        <td className="text-wrap">{p.name}</td>
                        <td className="text-muted-2">{p.sku}</td>
                        <td className="text-end money">{fmtMoney(p.selling_price)}</td>
                        <td className="text-end">
                          {p.available != null ? p.available : '—'}
                        </td>
                        <td className="text-end">
                          <button type="button" className="btn btn-sm btn-outline-primary"
                            onClick={() => addProduct(p)}>
                            Add
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-header py-2">
              <span className="card-title mb-0 small text-uppercase">Basket</span>
            </div>
            {lines.length === 0 ? (
              <div className="card-body">
                <EmptyState message="Basket is empty" hint="Scan a barcode or add a product from the catalogue." />
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm mb-0 align-middle">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th style={{ width: 110 }}>Qty</th>
                      <th style={{ width: 130 }}>Unit price</th>
                      <th style={{ width: 110 }}>Disc %</th>
                      <th className="text-end">Line total</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => {
                      const base = l.unit_price * l.quantity;
                      const net = Math.max(
                        base - (base * l.discount_percent / 100 + l.discount_amount), 0);
                      const lineTotal = net * (1 + l.tax_rate / 100);
                      return (
                        <tr key={`${l.product_id}-${l.variant_id}`}>
                          <td>
                            <div className="fw-semibold">{l.name}</div>
                            <div className="small text-muted-2">
                              {l.sku}
                              {l.available != null && (
                                <span className={l.available < l.quantity ? ' text-danger' : ''}>
                                  {' · '}{l.available} on hand
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <input type="number" min={1} className="form-control form-control-sm"
                              value={l.quantity}
                              onChange={(e) => update(i, { quantity: Math.max(1, Number(e.target.value || 1)) })} />
                          </td>
                          <td>
                            <input type="number" min={0} step="any"
                              className="form-control form-control-sm text-end money"
                              value={l.unit_price}
                              onChange={(e) => update(i, { unit_price: Number(e.target.value || 0) })} />
                          </td>
                          <td>
                            <input type="number" min={0} max={100} step="any"
                              className="form-control form-control-sm text-end"
                              value={l.discount_percent}
                              onChange={(e) => update(i, { discount_percent: Number(e.target.value || 0) })} />
                          </td>
                          <td className="text-end money fw-semibold">{fmtMoney(lineTotal)}</td>
                          <td className="text-end">
                            <button type="button" className="btn btn-sm btn-outline-danger border-0"
                              onClick={() => remove(i)} aria-label="Remove line">
                              <i className="bi bi-x-lg" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="col-xl-4">
          <div className="card position-sticky" style={{ top: 'calc(var(--header-h) + 12px)' }}>
            <div className="card-header py-2">
              <span className="card-title mb-0 small text-uppercase">Current sale</span>
            </div>
            <div className="card-body">
              {error2 && <div className="alert alert-danger py-2 small">{error2}</div>}

              <Field label="Customer">
                <SelectInput value={customerId} onChange={(e: any) => setCustomerId(e.target.value)}>
                  <option value="">Walk-in customer</option>
                  {customerList.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.full_name} · {c.phone || c.customer_number}</option>
                  ))}
                </SelectInput>
              </Field>

              <div className="row g-2">
                <div className="col-6">
                  <Field label="Basket disc. %">
                    <TextInput type="number" min={0} max={100} step="any"
                      value={cartDiscountPercent}
                      onChange={(e) => setCartDiscountPercent(e.target.value)} />
                  </Field>
                </div>
                <div className="col-6">
                  <Field label="Basket disc. RWF">
                    <TextInput type="number" min={0} step="any"
                      value={cartDiscountAmount}
                      onChange={(e) => setCartDiscountAmount(e.target.value)} />
                  </Field>
                </div>
              </div>
              {limit !== null && (
                <div className="small text-muted-2 mb-2">
                  Your discount ceiling: <strong>{limit}%</strong>
                  {Number(cartDiscountPercent || 0) > limit && (
                    <span className="text-danger"> — above your limit, the server will refuse it.</span>
                  )}
                </div>
              )}
              {Number(cartDiscountPercent || 0) > 0 || Number(cartDiscountAmount || 0) > 0 ? (
                <Field label="Discount reason">
                  <TextInput value={discountReason} onChange={(e) => setDiscountReason(e.target.value)}
                    placeholder="Why is this discounted?" />
                </Field>
              ) : null}

              <Field label="Promotion code">
                <TextInput value={promotionCode} onChange={(e) => setPromotionCode(e.target.value)}
                  placeholder="e.g. SCHOOL10" />
              </Field>

              <Field label="Tax on this basket">
                <SelectInput value={taxRate} onChange={(e: any) => {
                  const rate = Number(e.target.value);
                  setTaxRate(rate);
                  setLines((prev) => prev.map((l) => ({ ...l, tax_rate: rate })));
                }}>
                  {TAX_CHOICES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </SelectInput>
              </Field>

              <hr className="my-3" />
              <div className="d-flex justify-content-between py-1 small">
                <span className="text-muted-2">Subtotal</span>
                <span className="money">{fmtMoney(totals.subtotal)}</span>
              </div>
              <div className="d-flex justify-content-between py-1 small">
                <span className="text-muted-2">Discount</span>
                <span className="money text-warning">−{fmtMoney(totals.discount)}</span>
              </div>
              <div className="d-flex justify-content-between py-1 small">
                <span className="text-muted-2">Tax ({taxRate}%)</span>
                <span className="money">{fmtMoney(totals.tax)}</span>
              </div>
              <div className="d-flex justify-content-between align-items-center py-1 border-top mt-1">
                <span className="fw-semibold">Total</span>
                <span className="fs-5 fw-bold money">{fmtMoney(totals.total)}</span>
              </div>

              <hr className="my-3" />
              <div className="row g-2">
                <div className="col-6">
                  <Field label="Payment method">
                    <SelectInput value={methodId} onChange={(e: any) => setMethodId(e.target.value)}>
                      {paymentMethods.map((m: any) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </SelectInput>
                  </Field>
                </div>
                <div className="col-6">
                  <Field label="Amount tendered">
                    <TextInput type="number" min={0} step="any" className="text-end money"
                      value={tendered}
                      onChange={(e) => setTendered(e.target.value)} />
                  </Field>
                </div>
              </div>
              <div className="d-flex justify-content-between small mb-3">
                <span className="text-muted-2">Change</span>
                <span className={`money fw-semibold ${change < 0 ? 'text-danger' : ''}`}>
                  {fmtMoney(change)}
                </span>
              </div>

              <div className="d-grid gap-2">
                <button type="button" className="btn btn-primary" disabled={busy || !canSell}
                  onClick={() => charge(false)}>
                  {busy ? 'Processing…' : `Charge ${fmtMoney(totals.total)}`}
                </button>
                <div className="d-flex gap-2">
                  <button type="button" className="btn btn-outline-secondary btn-sm flex-grow-1"
                    disabled={busy} onClick={() => charge(true)}>
                    Hold basket{heldSales.length > 0 ? ` (${heldSales.length})` : ''}
                  </button>
                  <button type="button" className="btn btn-outline-danger btn-sm flex-grow-1"
                    disabled={busy || lines.length === 0}
                    onClick={() => { setLines([]); setError2(''); clientRef.current = newClientRef(); }}>
                    Clear
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal show={heldOpen} title="Held baskets" onClose={closeHeldModal} size="lg"
        footer={heldTarget ? (
          <>
            <button type="button" className="btn btn-outline-secondary btn-sm"
              disabled={heldBusy} onClick={() => { setHeldTarget(null); setHeldErr(''); }}>
              Back to list
            </button>
            <button type="button" className="btn btn-primary btn-sm"
              disabled={heldBusy} onClick={completeHeldSale}>
              {heldBusy ? 'Processing…' : `Complete sale · ${fmtMoney(heldTendered || 0)}`}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-outline-secondary btn-sm"
            onClick={closeHeldModal}>Close</button>
        )}>
        {!heldTarget ? (
          heldSales.length === 0 ? (
            <EmptyState icon="bi-pause-circle"
              message="No held baskets"
              hint="Baskets held at the till appear here so they can be completed or discarded." />
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>Basket</th>
                    <th>Held at</th>
                    <th>Customer</th>
                    <th className="text-end">Items</th>
                    <th className="text-end">Total</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {heldSales.map((h: any) => (
                    <tr key={h.id}>
                      <td className="fw-semibold">{h.sale_number}</td>
                      <td className="text-nowrap small text-muted-2">
                        {h.created_at ? new Date(h.created_at).toLocaleString('en-GB') : '—'}
                      </td>
                      <td>{h.customer || 'Walk-in'}</td>
                      <td className="text-end">{h.item_count}</td>
                      <td className="text-end money fw-semibold">{fmtMoney(h.total_amount)}</td>
                      <td className="text-end text-nowrap">
                        <button type="button" className="btn btn-sm btn-primary me-1"
                          onClick={() => startHeldSale(h)}>
                          Resume
                        </button>
                        {can(user, P.shopSalesCancel) && (
                          <button type="button" className="btn btn-sm btn-outline-danger"
                            onClick={() => setDiscardTarget(h)}>
                            Discard
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="row g-3">
            <div className="col-md-6">
              <div className="border rounded p-3 h-100">
                <div className="d-flex justify-content-between mb-2">
                  <span className="text-muted-2">Basket</span>
                  <span className="fw-semibold">{heldTarget.sale_number}</span>
                </div>
                <div className="d-flex justify-content-between mb-2">
                  <span className="text-muted-2">Held at</span>
                  <span>
                    {heldTarget.created_at
                      ? new Date(heldTarget.created_at).toLocaleString('en-GB') : '—'}
                  </span>
                </div>
                <div className="d-flex justify-content-between mb-2">
                  <span className="text-muted-2">Customer</span>
                  <span>{heldTarget.customer || 'Walk-in'}</span>
                </div>
                <div className="d-flex justify-content-between">
                  <span className="text-muted-2">Items</span>
                  <span>{heldTarget.item_count}</span>
                </div>
                <hr className="my-2" />
                <div className="d-flex justify-content-between">
                  <span className="fw-semibold">Total</span>
                  <span className="fs-5 fw-bold money">{fmtMoney(heldTarget.total_amount)}</span>
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="border rounded p-3 h-100">
                <Field label="Payment method">
                  <SelectInput value={methodId} onChange={(e: any) => setMethodId(e.target.value)}>
                    {paymentMethods.map((m: any) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Amount tendered">
                  <TextInput type="number" min={0} step="any" className="text-end money"
                    value={heldTendered}
                    onChange={(e) => setHeldTendered(e.target.value)} />
                </Field>
                {heldErr && <div className="text-danger small">{heldErr}</div>}
                <div className="text-muted-2 small mt-2">
                  Completing keeps the original basket: same items, prices and
                  stock reservation.
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog show={!!discardTarget} title="Discard held basket"
        message={discardTarget
          ? `Discard ${discardTarget.sale_number} (${fmtMoney(discardTarget.total_amount)})? `
            + 'Its stock reservation is released and the basket cannot be recovered.'
          : ''}
        confirmLabel="Discard"
        onConfirm={discardHeldSale}
        onClose={() => setDiscardTarget(null)} />

      <Modal show={!!receipt} title="Receipt" onClose={() => setReceipt(null)} size="lg"
        footer={(
          <>
            <button type="button" className="btn btn-outline-secondary btn-sm"
              onClick={() => window.print()}>Print</button>
            <button type="button" className="btn btn-primary btn-sm"
              onClick={() => setReceipt(null)}>Close</button>
          </>
        )}>
        <ReceiptView receipt={receipt} />
      </Modal>

      <BarcodeScanner
        show={cameraOpen}
        onClose={() => { setCameraOpen(false); focusScanner(); }}
        onDetected={(value) => {
          setCameraOpen(false);
          handleScan(value, 'camera');
        }}
        sound={prefs.sound}
        vibration={prefs.vibration}
      />

      <OutOfStockDialog
        show={!!outOf}
        result={outOf}
        onClose={() => { setOutOf(null); focusScanner(); }}
      />
    </div>
  );
}

function ReceiptView({ receipt }: { receipt: any }) {
  if (!receipt) return null;
  const sale = receipt.sale || {};
  const items: any[] = receipt.items || [];
  const payments: any[] = receipt.payments || [];
  return (
    <div className="small">
      <div className="text-center mb-3">
        <div className="fw-bold">{receipt.business_name || 'AfriTech Bridge'}</div>
        <div className="text-muted-2">{sale.sale_number}</div>
        <div className="text-muted-2">
          {sale.branch} · {sale.customer || 'Walk-in'}
        </div>
      </div>
      <table className="table table-sm mb-2">
        <thead>
          <tr><th>Item</th><th className="text-end">Qty</th><th className="text-end">Amount</th></tr>
        </thead>
        <tbody>
          {items.map((it: any) => (
            <tr key={it.id}>
              <td>{it.product}</td>
              <td className="text-end">{it.quantity}</td>
              <td className="text-end money">{fmtMoney(it.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="d-flex justify-content-between py-1 small">
        <span className="text-muted-2">Subtotal</span>
        <span className="money">{fmtMoney(sale.subtotal)}</span>
      </div>
      <div className="d-flex justify-content-between py-1 small">
        <span className="text-muted-2">Discount</span>
        <span className="money">−{fmtMoney(sale.discount_amount)}</span>
      </div>
      <div className="d-flex justify-content-between py-1 small">
        <span className="text-muted-2">Tax</span>
        <span className="money">{fmtMoney(sale.tax_amount)}</span>
      </div>
      <div className="d-flex justify-content-between py-1 border-top mt-1">
        <span className="fw-semibold">Total</span>
        <span className="fw-bold money">{fmtMoney(sale.total_amount)}</span>
      </div>
      <div className="d-flex justify-content-between py-1 small">
        <span className="text-muted-2">Paid</span>
        <span className="money">{fmtMoney(sale.amount_paid)}</span>
      </div>
      {payments.length > 0 && (
        <div className="mt-2 small text-muted-2">
          {payments.map((p: any) => (
            <div key={p.id} className="d-flex justify-content-between">
              <span>{p.method_name || p.method || p.method_code || 'Payment'}</span>
              <span className="money">{fmtMoney(p.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
