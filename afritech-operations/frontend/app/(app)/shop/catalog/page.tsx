'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useFetch } from '@/lib/use-fetch';
import { ApiClientError, api, can, fmtDateTime, fmtMoney } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { P } from '@/lib/permissions';
import { PageHeader, Loading, ErrorAlert, EmptyState, Pagination, Modal, Badge, ConfirmDialog } from '@/components/ui';
import { Field, TextInput, SelectInput, TextArea } from '@/components/form';
import { BarcodeInput, BarcodeScanner, BarcodeStatus } from '@/components/shop';
import {
  BarcodeLookup,
  detectBarcodeFormat,
  lookupBarcode,
  normalizeBarcode,
} from '@/lib/barcode';
import type { BarcodeConflict } from './DuplicateBarcodePanel';
import { DuplicateBarcodePanel } from './DuplicateBarcodePanel';
import { BarcodeLabelDialog } from './BarcodeLabelDialog';
import { UnknownScans } from './UnknownScans';

const emptyForm = {
  sku: '', name: '', category_id: '', brand_id: '', selling_price: '',
  purchase_cost: '', barcode: '', warranty_months: '', description: '',
};

/** Fields of the Edit product form — every editable column of a product. */
const emptyEditForm = {
  name: '', description: '', category_id: '', brand_id: '', supplier_id: '',
  unit: 'pcs', min_selling_price: '', min_stock_level: '', reorder_level: '',
  reorder_quantity: '', selling_price: '', purchase_cost: '',
  warranty_months: '', warranty_provider: '', warranty_terms: '', reason: '',
};

/** Coerce a money input to a number, treating blanks as zero. */
function moneyNum(value: any): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Retail symbologies — everything else is an internal shop code. */
const EXTERNAL_FORMATS = ['EAN_13', 'UPC_A', 'EAN_8', 'UPC_E'];

/**
 * The inputs this form marks as required — drives the post-scan checklist.
 * SKU is absent on purpose: the server mints it, so there is nothing left
 * for the operator to fill in.
 */
const REQUIRED_FIELDS: { key: keyof typeof emptyForm; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'selling_price', label: 'Selling price (RWF)' },
];

/** Backend endpoint that mints/reserves the `ATB…` SKU for a barcode. */
const GENERATE_SKU_URL = '/api/shop/products/generate-sku';

interface ScanConflict {
  existing: BarcodeConflict;
  lookup?: BarcodeLookup | null;
  /** Every row carrying the code, when it is shared. */
  candidates?: BarcodeConflict[];
  /** The code already sits on the item being edited. */
  own?: boolean;
}

const emptyScan = { checking: false, result: null as BarcodeLookup | null, conflict: null as ScanConflict | null, note: '' };
const emptyChange = {
  open: false, value: '', checking: false, result: null as BarcodeLookup | null,
  conflict: null as ScanConflict | null, busy: false, error: '', allowShared: false,
};

/** Describe the row that already owns a code, from a lookup result. */
function conflictFromLookup(result: BarcodeLookup): BarcodeConflict {
  const product: any = result.product || {};
  const variant: any = result.variant || null;
  return {
    kind: variant ? 'variant' : 'product',
    id: variant ? variant.id : product.id,
    name: variant ? variant.name : product.name,
    sku: variant ? variant.sku : product.sku,
    status: product.status || 'active',
    product_name: product.name,
  };
}

/** Every owner a 409 names — its `candidates`, or just `existing` when alone. */
function conflictCandidates(err: any): BarcodeConflict[] | undefined {
  if (err?.data?.candidates?.length) return err.data.candidates;
  return err?.data?.existing ? [err.data.existing] : undefined;
}

/** Owners of a lookup, in conflict-row shape. An ambiguous result carries no
 * `product` of its own, so the rows have to come from its candidates. */
function candidatesFromLookup(result: BarcodeLookup): BarcodeConflict[] | undefined {
  if (result.ambiguous) {
    return (result.candidates || []).map((c) => ({
      kind: c.variant ? 'variant' : 'product',
      id: c.product.id,
      name: c.variant?.name ?? c.product.name,
      sku: c.variant?.sku ?? c.product.sku,
      status: c.product.status || 'active',
      product_name: c.product.name,
      product_id: c.product.id,
    }));
  }
  return result.found ? [conflictFromLookup(result)] : undefined;
}

/** Format + type fields the server expects alongside a scanned barcode. */
function applyBarcodeFields(target: any, value: string) {
  const format = detectBarcodeFormat(value);
  if (format !== 'UNKNOWN') target.barcode_format = format;
  target.barcode_type = EXTERNAL_FORMATS.includes(format) ? 'external' : 'internal';
}

function isDuplicateError(err: any): boolean {
  return (
    err instanceof ApiClientError &&
    err.status === 409 &&
    (err.data?.code === 'duplicate_barcode' ||
      err.data?.code === 'duplicate_sku') &&
    !!err.data?.existing
  );
}

/** ✓ scanned + the required fields the form still needs. */
function ScanOkPanel({
  barcode,
  format,
  missing,
  children,
}: {
  barcode: string;
  format?: string;
  missing: { label: string; done: boolean }[];
  children?: React.ReactNode;
}) {
  return (
    <div className="border rounded p-2 small mt-2 bg-body">
      <div className="d-flex align-items-center gap-2 flex-wrap">
        <i className="bi bi-check-circle-fill text-success" />
        <span className="fw-semibold">Barcode scanned</span>
        <BarcodeStatus value={barcode} format={format} />
      </div>
      <div className="text-muted mt-1">Still required before saving:</div>
      <ul className="list-unstyled mb-0 mt-1">
        {missing.map((m) => (
          <li
            key={m.label}
            className={`d-flex align-items-center gap-1 ${m.done ? 'text-muted' : 'fw-semibold text-warning'}`}
          >
            <i className={`bi ${m.done ? 'bi-check2' : 'bi-exclamation-circle-fill'}`} />
            <span>{m.label}</span>
            {!m.done && <span className="fw-normal">— still required</span>}
          </li>
        ))}
      </ul>
      {children}
    </div>
  );
}

function CatalogInner() {
  const { user } = useAuth();
  const canCreate = can(user, P.shopProductsCreate);
  const canEdit = can(user, P.shopProductsEdit);
  const canArchive = can(user, P.shopProductsArchive);
  // Money columns are their own scope: without them the price inputs are
  // hidden and their keys never reach the PATCH payload.
  const canManageMoney = can(user, P.shopPricingManage);
  const canPriceHistory = can(user, P.shopPricingView);
  // Mirrors the backend cost permissions: without them purchase_cost is
  // stripped from every payload, so neither the column nor the field exists.
  const canSeeCost = can(user, P.shopPricingView) || can(user, P.shopPricingManage)
    || can(user, P.shopPurchasesCreate) || can(user, P.shopPurchasesApprove)
    || can(user, P.shopPurchasesReceive) || can(user, P.shopFinancialReportsView);

  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const { data, error, loading, reload } = useFetch('/api/shop/products', [page, q, status],
    { page, per_page: 15, q: q || undefined, status: status || undefined });
  const items = data?.items || [];

  const [open, setOpen] = useState(false);
  const [cats, setCats] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ ...emptyForm });
  const [variants, setVariants] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [error2, setError2] = useState('');
  const [saveConflict, setSaveConflict] = useState<ScanConflict | null>(null);
  /** Operator opted into reusing a code another product already carries. */
  const [allowShared, setAllowShared] = useState(false);
  const [scan, setScan] = useState({ ...emptyScan });
  /** True while `form.sku` holds a server-minted value tied to `form.barcode`. */
  const [skuAuto, setSkuAuto] = useState(false);
  const [skuNote, setSkuNote] = useState('');
  const [cameraFor, setCameraFor] = useState<string | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  /** Bumped per scan so a slow SKU response cannot overwrite a newer one. */
  const skuSeqRef = useRef(0);

  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [copied, setCopied] = useState(false);
  const [change, setChange] = useState({ ...emptyChange });
  const [labelOpen, setLabelOpen] = useState(false);

  // ── admin actions: edit, archive/restore, price history ──
  const [flash, setFlash] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const flashTimerRef = useRef<number | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({ ...emptyEditForm });
  /** Snapshot of the loaded values, so only real money changes carry a reason. */
  const [editOrig, setEditOrig] = useState<any>({ ...emptyEditForm });
  const [editLoading, setEditLoading] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editErr, setEditErr] = useState('');
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [confirmTarget, setConfirmTarget] = useState<any | null>(null);
  /** Row currently running a restore, so its button can show progress. */
  const [actionBusy, setActionBusy] = useState<number | null>(null);
  const [hist, setHist] = useState<{ items: any[]; total: number; pages: number }>({ items: [], total: 0, pages: 1 });
  const [histPage, setHistPage] = useState(1);
  const [histLoading, setHistLoading] = useState(false);
  const [histError, setHistError] = useState('');

  // ?new=1 opens the create modal, &barcode=… prefills and checks it. The key
  // is tracked so a Register link from this same page re-triggers the flow;
  // the flag is then stripped so the next link with the same code counts too.
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const linkKey = `${params.get('new') || ''}|${params.get('barcode') || ''}`;
  const lastLinkRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastLinkRef.current === linkKey) return;
    lastLinkRef.current = linkKey;
    if (!canCreate || params.get('new') !== '1') return;
    openCreate(params.get('barcode') || '');
    router.replace(pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkKey]);

  // The shared input owns its classes, so the invalid state is toggled here.
  useEffect(() => {
    barcodeInputRef.current?.classList.toggle('is-invalid', !!scan.conflict && !scan.conflict.own);
  });

  // Paged price history for the open product — fetched from its own endpoint
  // so a long-lived product never ships its whole change log at once.
  useEffect(() => {
    if (!detailId || !canPriceHistory) {
      setHistLoading(false);
      return;
    }
    let cancelled = false;
    setHistLoading(true);
    setHistError('');
    api(`/api/shop/products/${detailId}/price-history`, { params: { page: histPage, per_page: 20 } })
      .then((d: any) => {
        if (cancelled) return;
        setHist({ items: d?.items || [], total: d?.total || 0, pages: d?.pages || 1 });
      })
      .catch((err: any) => {
        if (cancelled) return;
        setHist({ items: [], total: 0, pages: 1 });
        // A missing pricing scope must not break the rest of the modal.
        setHistError(err instanceof ApiClientError && err.status === 403
          ? 'You do not have permission to view the price history.'
          : err.message || 'The price history could not be loaded.');
      })
      .finally(() => { if (!cancelled) setHistLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailId, histPage, canPriceHistory]);

  function set<K extends keyof typeof form>(key: K, value: any) { setForm((f) => ({ ...f, [key]: value })); }

  function setVariant(index: number, key: string, value: any) {
    setVariants((rows) => rows.map((r, i) => (i === index ? { ...r, [key]: value } : r)));
  }
  function addVariant() {
    setVariants((rows) => [...rows, { name: '', sku: '', barcode: '', selling_price: '', purchase_cost: '', scan: null }]);
  }
  function removeVariant(index: number) {
    setVariants((rows) => rows.filter((_, i) => i !== index));
  }

  async function openCreate(prefill = '') {
    setForm({ ...emptyForm, barcode: prefill });
    setVariants([]);
    setError2('');
    setSaveConflict(null);
    setAllowShared(false);
    setScan({ ...emptyScan });
    setSkuAuto(false);
    setSkuNote('');
    setOpen(true);
    const [c, b]: any[] = await Promise.all([
      api('/api/shop/categories').catch(() => ({ items: [] })),
      api('/api/shop/brands').catch(() => ({ items: [] })),
    ]);
    setCats(c.items || []);
    setBrands(b.items || []);
    if (prefill) checkProductBarcode(prefill);
  }

  function showFlash(tone: 'ok' | 'error', text: string) {
    setFlash({ tone, text });
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlash(null), 5000);
  }

  async function openDetail(product: any) {
    const id = typeof product === 'number' ? product : product?.id;
    if (!id) return;
    setDetailId(id);
    setDetail(null);
    setDetailError('');
    setDetailLoading(true);
    setHist({ items: [], total: 0, pages: 1 });
    setHistPage(1);
    setHistError('');
    try {
      const d: any = await api(`/api/shop/products/${id}`);
      setDetail(d.product || null);
    } catch (err: any) {
      setDetailError(err.message);
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setDetailId(null);
    setDetail(null);
    setCopied(false);
    setLabelOpen(false);
    setChange({ ...emptyChange });
    setHist({ items: [], total: 0, pages: 1 });
    setHistPage(1);
    setHistError('');
  }

  function setE(key: keyof typeof emptyEditForm, value: any) {
    setEditForm((f: any) => ({ ...f, [key]: value }));
  }

  /** Load the full product into the Edit form (details endpoint, not the row). */
  async function openEdit(product: any) {
    const id = typeof product === 'number' ? product : product?.id;
    if (!id || !canEdit) return;
    setEditId(id);
    setEditErr('');
    setEditForm({ ...emptyEditForm });
    setEditOrig({ ...emptyEditForm });
    setEditOpen(true);
    setEditLoading(true);
    try {
      const [d, c, b, s]: any[] = await Promise.all([
        api(`/api/shop/products/${id}`),
        api('/api/shop/categories').catch(() => ({ items: [] })),
        api('/api/shop/brands').catch(() => ({ items: [] })),
        api('/api/shop/suppliers', { params: { per_page: 200 } }).catch(() => ({ items: [] })),
      ]);
      const p = d?.product;
      if (!p) throw new Error('Product not found');
      const prefilled = {
        name: p.name || '',
        description: p.description || '',
        category_id: p.category_id ? String(p.category_id) : '',
        brand_id: p.brand_id ? String(p.brand_id) : '',
        supplier_id: p.supplier_id ? String(p.supplier_id) : '',
        unit: p.unit || 'pcs',
        min_selling_price: p.min_selling_price ?? '',
        min_stock_level: p.min_stock_level ?? 0,
        reorder_level: p.reorder_level ?? 0,
        reorder_quantity: p.reorder_quantity ?? 0,
        selling_price: p.selling_price ?? '',
        purchase_cost: p.purchase_cost ?? '',
        warranty_months: p.warranty_months ?? '',
        warranty_provider: p.warranty_provider || '',
        warranty_terms: p.warranty_terms || '',
        reason: '',
      };
      setEditForm(prefilled);
      setEditOrig(prefilled);
      setCats(c.items || []);
      setBrands(b.items || []);
      setSuppliers(s.items || []);
    } catch (err: any) {
      setEditErr(err.message);
    } finally {
      setEditLoading(false);
    }
  }

  async function saveEdit(e?: React.FormEvent) {
    e?.preventDefault();
    if (editId === null || editBusy || editLoading) return;
    setEditBusy(true);
    setEditErr('');
    try {
      const body: any = {
        name: String(editForm.name || '').trim(),
        description: editForm.description || '',
        unit: editForm.unit || 'pcs',
        category_id: editForm.category_id ? Number(editForm.category_id) : null,
        brand_id: editForm.brand_id ? Number(editForm.brand_id) : null,
        supplier_id: editForm.supplier_id ? Number(editForm.supplier_id) : null,
        min_stock_level: editForm.min_stock_level === '' ? 0 : Number(editForm.min_stock_level),
        reorder_level: editForm.reorder_level === '' ? 0 : Number(editForm.reorder_level),
        reorder_quantity: editForm.reorder_quantity === '' ? 0 : Number(editForm.reorder_quantity),
        warranty_months: editForm.warranty_months === '' ? 0 : Number(editForm.warranty_months),
        warranty_provider: editForm.warranty_provider || null,
        warranty_terms: editForm.warranty_terms || null,
      };
      // Money keys only leave the browser for a pricing manager, and only
      // when the value really moved — an unchanged price is not history.
      if (canManageMoney) {
        if (moneyNum(editForm.selling_price) !== moneyNum(editOrig.selling_price)) {
          body.selling_price = moneyNum(editForm.selling_price);
        }
        if (moneyNum(editForm.purchase_cost) !== moneyNum(editOrig.purchase_cost)) {
          body.purchase_cost = moneyNum(editForm.purchase_cost);
        }
        if (String(editForm.min_selling_price ?? '') !== String(editOrig.min_selling_price ?? '')) {
          body.min_selling_price = editForm.min_selling_price === ''
            ? null : moneyNum(editForm.min_selling_price);
        }
        if (('selling_price' in body || 'purchase_cost' in body) && String(editForm.reason || '').trim()) {
          body.reason = String(editForm.reason).trim();
        }
      }
      const res: any = await api(`/api/shop/products/${editId}`, { method: 'PATCH', body });
      setEditOpen(false);
      if (detailId === editId) setDetail((d: any) => (d ? { ...d, ...(res?.product || {}) } : d));
      reload();
      showFlash('ok', 'Product updated.');
    } catch (err: any) {
      setEditErr((err instanceof ApiClientError && err.data?.error) || err.message
        || 'The product could not be updated.');
    } finally {
      setEditBusy(false);
    }
  }

  /** DELETE = archive. 409 already_archived just refreshes the badge. */
  async function archiveProduct() {
    const target = confirmTarget;
    if (!target) return;
    try {
      await api(`/api/shop/products/${target.id}`, { method: 'DELETE' });
      if (detailId === target.id) setDetail((d: any) => (d ? { ...d, status: 'archived' } : d));
      reload();
      showFlash('ok', `“${target.name}” archived.`);
    } catch (err: any) {
      if (err instanceof ApiClientError && err.status === 409 && err.data?.code === 'already_archived') {
        if (detailId === target.id) setDetail((d: any) => (d ? { ...d, status: 'archived' } : d));
        reload();
        showFlash('ok', 'That product was already archived — the list has been refreshed.');
        return;
      }
      throw err; // surfaces inside the confirm dialog
    }
  }

  async function restoreProduct(product: any) {
    if (!product || actionBusy !== null) return;
    setActionBusy(product.id);
    try {
      const res: any = await api(`/api/shop/products/${product.id}/status`, {
        method: 'POST', body: { status: 'active' },
      });
      if (detailId === product.id) setDetail((d: any) => (d ? { ...d, ...(res?.product || {}) } : d));
      reload();
      showFlash('ok', `“${product.name}” restored to active.`);
    } catch (err: any) {
      showFlash('error', err.message || 'The product could not be restored.');
    } finally {
      setActionBusy(null);
    }
  }

  function useExistingProduct(productId: number) {
    setOpen(false);
    setSaveConflict(null);
    setScan({ ...emptyScan });
    openDetail(productId);
  }

  /**
   * Exists-check for the create form's product barcode, then — only when the
   * code really is new — ask the server for its `ATB…` SKU so the operator
   * sees it before typing anything else. An existing barcode never mints one.
   */
  async function checkProductBarcode(raw: string) {
    const code = normalizeBarcode(raw);
    if (!code) {
      setScan({ ...emptyScan });
      return;
    }
    const seq = skuSeqRef.current + 1;
    skuSeqRef.current = seq;
    setScan({ ...emptyScan, checking: true });
    setSkuNote('');
    try {
      const result = await lookupBarcode(code);
      if (result.found) {
        // The row already exists: show it and drop any SKU we minted earlier.
        // An ambiguous lookup has no `product` of its own — the conflict row
        // comes from its candidates instead.
        set('sku', '');
        setSkuAuto(false);
        const rows = candidatesFromLookup(result);
        setScan({
          checking: false,
          result,
          conflict: { existing: rows?.[0] ?? conflictFromLookup(result), lookup: result, candidates: rows },
          note: '',
        });
        return;
      }
      setScan({ checking: false, result, conflict: null, note: '' });
      await reserveSku(code, seq);
    } catch (err: any) {
      setScan({ ...emptyScan, note: err.message || 'The barcode could not be checked.' });
    }
  }

  /** Ask the server to mint (or hand back) this barcode's SKU. `allowShared`
   * is only set once the operator opted into reusing another product's code —
   * an owned code mints nothing without it. */
  async function reserveSku(code: string, seq: number, allowShared = false): Promise<any | null> {
    try {
      const body: any = { barcode: code };
      if (allowShared) body.allow_shared_barcode = true;
      const prepared: any = await api(GENERATE_SKU_URL, {
        method: 'POST',
        body,
      });
      if (seq !== skuSeqRef.current) return null; // superseded by a newer scan
      if (prepared?.sku) set('sku', prepared.sku);
      setSkuAuto(true);
      setSkuNote(
        prepared?.reserved
          ? 'Already generated for this barcode — rescanning returns the same SKU.'
          : '',
      );
      return prepared;
    } catch (err: any) {
      if (seq !== skuSeqRef.current) return null;
      setSkuNote(err.message || 'The SKU could not be generated — it will be made when you save.');
      return null;
    }
  }

  function onProductBarcodeChange(value: string) {
    set('barcode', value);
    setScan({ ...emptyScan });
    // A new code also invalidates any earlier "share this code" opt-in.
    setAllowShared(false);
    // A reserved SKU belongs to the code that produced it; a different code
    // needs a different one (the server still returns the same SKU if the
    // user comes back to the original barcode).
    if (skuAuto) {
      set('sku', '');
      setSkuAuto(false);
      setSkuNote('');
    }
  }

  /** Same exists-check under a variant row — a code belongs to one item only. */
  async function checkVariantBarcode(index: number, raw: string) {
    const code = normalizeBarcode(raw);
    setVariant(index, 'barcode', code);
    setVariant(index, 'scan', { checking: true });
    if (!code) {
      setVariant(index, 'scan', null);
      return;
    }
    try {
      const result = await lookupBarcode(code);
      if (!result.found) {
        setVariant(index, 'scan', {
          checking: false,
          ok: true,
          format: result.barcode_format || detectBarcodeFormat(code),
        });
      } else {
        const rows = candidatesFromLookup(result);
        setVariant(index, 'scan', {
          checking: false,
          conflict: { existing: rows?.[0] ?? conflictFromLookup(result), lookup: result, candidates: rows },
        });
      }
    } catch (err: any) {
      setVariant(index, 'scan', { checking: false, note: err.message });
    }
  }

  async function handleCameraValue(target: string | null, value: string) {
    if (target === 'product') {
      set('barcode', value);
      setAllowShared(false); // a camera pick is still a barcode change
      await checkProductBarcode(value);
    } else if (target === 'change') {
      setChange((c) => ({ ...c, value }));
      await checkChangeBarcode(value);
    } else if (target && target.startsWith('variant')) {
      await checkVariantBarcode(Number(target.slice('variant'.length)), value);
    }
  }

  /** A 409 on save: show the same panel from the server's `existing` row. */
  async function showSaveConflict(existing: BarcodeConflict, candidates?: BarcodeConflict[]) {
    setSaveConflict({ existing, candidates });
    // Candidates already describe every owner — the re-lookup below only
    // exists for older payloads that sent the single row alone.
    if (candidates) return;
    if (existing.kind !== 'variant') return;
    // Variant conflicts name no parent id — re-check this form's codes to find it.
    const rows = [form.barcode, ...variants.map((v) => v.barcode)]
      .map((v: any) => normalizeBarcode(v))
      .filter(Boolean);
    for (const candidate of rows) {
      try {
        const result = await lookupBarcode(candidate);
        if (result.found && (result.variant?.sku === existing.sku || result.product?.sku === existing.sku)) {
          setSaveConflict({ existing, lookup: result });
          return;
        }
      } catch {
        // keep the plain conflict panel
      }
    }
  }

  /**
   * The operator chose to keep the scanned code: drop every conflict panel
   * and — while the create form holds a barcode — mint the SKU that the new
   * row sharing that code will carry.
   */
  async function shareBarcode() {
    setAllowShared(true);
    setSaveConflict(null);
    setScan((s) => ({ ...s, conflict: null }));
    const code = normalizeBarcode(form.barcode);
    if (!code) return;
    const seq = skuSeqRef.current + 1;
    skuSeqRef.current = seq;
    const prepared = await reserveSku(code, seq, true);
    if (prepared && !prepared.reserved) {
      setSkuNote('Shared barcode — this SKU belongs to the new product you are creating.');
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError2('');
    setSaveConflict(null);
    try {
      const body: any = {
        name: form.name,
        selling_price: form.selling_price !== '' ? Number(form.selling_price) : undefined,
        category_id: form.category_id ? Number(form.category_id) : undefined,
        brand_id: form.brand_id ? Number(form.brand_id) : undefined,
        warranty_months: form.warranty_months !== '' ? Number(form.warranty_months) : undefined,
        description: form.description || undefined,
      };
      // Absent SKU = let the backend mint one; a reserved SKU is sent back so
      // the scan's number is the number the row ends up with.
      if (form.sku) body.sku = form.sku;
      if (form.barcode) {
        body.barcode = form.barcode;
        applyBarcodeFields(body, form.barcode);
      }
      if (allowShared) body.allow_shared_barcode = true;
      if (canSeeCost && form.purchase_cost !== '') body.purchase_cost = Number(form.purchase_cost);
      const rows = variants.filter((v) => (v.name || '').trim());
      if (rows.length) {
        body.variants = rows.map((v) => {
          const entry: any = { name: v.name };
          if (v.sku) entry.sku = v.sku;
          if (v.barcode) {
            entry.barcode = v.barcode;
            applyBarcodeFields(entry, v.barcode);
          }
          if (v.selling_price !== '') entry.selling_price = Number(v.selling_price);
          if (canSeeCost && v.purchase_cost !== '') entry.purchase_cost = Number(v.purchase_cost);
          return entry;
        });
      }
      await api('/api/shop/products', { method: 'POST', body });
      setOpen(false);
      reload();
    } catch (err: any) {
      if (isDuplicateError(err)) {
        await showSaveConflict(err.data.existing, conflictCandidates(err));
        // A share the server still refused (a code inside this same product
        // tree never shares) has nothing left but its own message to show.
        if (allowShared) {
          setAllowShared(false);
          setError2(err.data?.error || err.message);
        }
      } else setError2(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function copyBarcode() {
    if (!detail?.barcode) return;
    try {
      await navigator.clipboard.writeText(String(detail.barcode));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function openChangeBarcode() {
    if (!detail) return;
    setChange({ ...emptyChange, open: true, value: detail.barcode || '' });
  }

  /** Pre-check before POST /products/{id}/barcode. */
  async function checkChangeBarcode(raw: string) {
    const code = normalizeBarcode(raw);
    if (!code) {
      setChange((c) => ({ ...c, value: raw, result: null, conflict: null, error: '', allowShared: false }));
      return;
    }
    // Every check starts from a fresh code — the share opt-in does not travel.
    setChange((c) => ({ ...c, value: code, checking: true, result: null, conflict: null, error: '', allowShared: false }));
    try {
      const result = await lookupBarcode(code);
      const own = !!result.found && !!detail && result.product?.id === detail.id;
      // Only an unshared, unambiguous match can be `own`; every other lookup
      // carries its conflict rows as candidates (an ambiguous one has no product).
      const rows = result.found && !own ? candidatesFromLookup(result) : undefined;
      setChange((c) => ({
        ...c,
        checking: false,
        result,
        conflict: result.found
          ? {
              existing: rows?.[0] ?? conflictFromLookup(result),
              lookup: result,
              candidates: rows,
              own,
            }
          : null,
      }));
    } catch (err: any) {
      setChange((c) => ({ ...c, checking: false, error: err.message || 'The barcode could not be checked.' }));
    }
  }

  /** POST the new code for this product; `allowShared` retries after a 409. */
  async function postChangeBarcode(allowShared: boolean) {
    const code = normalizeBarcode(change.value);
    if (!code || !detail) return;
    setChange((c) => ({ ...c, busy: true, error: '' }));
    try {
      const body: any = { barcode: code };
      applyBarcodeFields(body, code);
      if (allowShared) body.allow_shared_barcode = true;
      const res: any = await api(`/api/shop/products/${detail.id}/barcode`, { method: 'POST', body });
      setDetail((d: any) => (d ? { ...d, ...(res.product || {}) } : d));
      setChange({ ...emptyChange });
      reload();
    } catch (err: any) {
      if (isDuplicateError(err)) {
        let lookup: BarcodeLookup | null = null;
        try {
          const result = await lookupBarcode(code);
          if (result.found) lookup = result;
        } catch {
          // the plain conflict panel still describes the row
        }
        const candidates = conflictCandidates(err);
        setChange((c) => ({
          ...c,
          busy: false,
          conflict: { existing: err.data.existing, candidates, lookup },
          // A refused share falls back to the plain conflict, with the
          // server's own wording of why it still said no.
          ...(allowShared
            ? { error: err.data?.error || err.message, allowShared: false }
            : {}),
        }));
        return;
      }
      setChange((c) => ({ ...c, busy: false, error: err.message }));
    }
  }

  async function submitChangeBarcode(e: React.FormEvent) {
    e.preventDefault();
    await postChangeBarcode(change.allowShared);
  }

  const variantsOfDetail: any[] = detail?.variants || [];
  const showVariantCost = variantsOfDetail.some((v) => v.purchase_cost !== undefined);
  const moneyTouched = canManageMoney && (
    moneyNum(editForm.selling_price) !== moneyNum(editOrig.selling_price) ||
    moneyNum(editForm.purchase_cost) !== moneyNum(editOrig.purchase_cost)
  );
  const missingRequired = REQUIRED_FIELDS.map((f) => ({
    label: f.label,
    done: String(form[f.key] ?? '').trim() !== '',
  }));
  const scanFormat = scan.result?.barcode_format || detectBarcodeFormat(form.barcode);

  return (
    <div>
      <PageHeader title="Catalogue" subtitle="Products, variants and pricing"
        actions={
          <>
            {canEdit && (
              <Link className="btn btn-outline-secondary" href="/shop/taxonomy">
                <i className="bi bi-tags me-1" /> Manage categories &amp; brands
              </Link>
            )}
            {canCreate && <button className="btn btn-primary" onClick={() => openCreate()}><i className="bi bi-plus-circle me-1" /> New product</button>}
          </>
        } />

      {flash && (
        <div className={`alert ${flash.tone === 'ok' ? 'alert-success' : 'alert-danger'} py-2 small`}>{flash.text}</div>
      )}

      <div className="card mb-3">
        <div className="card-body py-2 d-flex align-items-center flex-wrap gap-2">
          <i className="bi bi-search text-muted me-1" />
          <input className="form-control form-control-sm border-0 shadow-none" placeholder="Search name, SKU or barcode…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          <select className="form-select form-select-sm" style={{ width: 220 }} value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by status">
            <option value="">All statuses (hides archived)</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="discontinued">Discontinued</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={reload} />}
      {loading && <Loading />}
      {!loading && !error && items.length === 0 && <EmptyState message="No products found" />}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="card">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr>
                    <th>Name</th><th>SKU</th><th>Barcode</th><th>Category</th><th>Brand</th>
                    <th className="text-end">Selling price</th>
                    <th>Status</th><th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((p: any) => (
                    <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(p)}>
                      <td className="fw-semibold">{p.name}</td>
                      <td>{p.sku}</td>
                      <td>{p.barcode || '—'}</td>
                      <td>{p.category || '—'}</td>
                      <td>{p.brand || '—'}</td>
                      <td className="text-end money fw-semibold">{fmtMoney(p.selling_price)}</td>
                      <td><Badge status={p.status} /></td>
                      <td className="text-end">
                        <div className="d-flex justify-content-end gap-1 flex-wrap">
                          <button className="btn btn-sm btn-outline-secondary" onClick={(e) => { e.stopPropagation(); openDetail(p); }}>View</button>
                          {canEdit && (
                            <button className="btn btn-sm btn-outline-secondary" title="Edit product"
                              onClick={(e) => { e.stopPropagation(); openEdit(p); }}>
                              <i className="bi bi-pencil" />
                            </button>
                          )}
                          {canArchive && (p.status === 'archived' ? (
                            <button className="btn btn-sm btn-outline-success" title="Restore product"
                              disabled={actionBusy === p.id}
                              onClick={(e) => { e.stopPropagation(); restoreProduct(p); }}>
                              <i className="bi bi-arrow-clockwise" />
                            </button>
                          ) : (
                            <button className="btn btn-sm btn-outline-danger" title="Archive product"
                              onClick={(e) => { e.stopPropagation(); setConfirmTarget(p); }}>
                              <i className="bi bi-archive" />
                            </button>
                          ))}
                        </div>
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

      <UnknownScans />

      <Modal show={open} title="New product" onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        <form onSubmit={save}>
          {error2 && <div className="alert alert-danger py-2 small">{error2}</div>}
          {saveConflict && (
            <DuplicateBarcodePanel
              existing={saveConflict.existing}
              lookup={saveConflict.lookup}
              candidates={saveConflict.candidates}
              onOpen={openDetail}
              onUse={useExistingProduct}
              onShare={() => shareBarcode()}
              shared={allowShared}
              className="mb-3"
            />
          )}
          <div className="row">
            <div className="col-md-6">
              <Field
                label="SKU"
                hint={
                  skuAuto
                    ? 'Automatically generated — it stays the same while you edit this form.'
                    : 'Generated by the server as soon as you scan a new barcode, or when you save.'
                }
              >
                <div className="input-group">
                  <TextInput
                    className="font-monospace"
                    value={form.sku}
                    readOnly
                    placeholder="Auto-generated"
                    aria-label="SKU (automatically generated)"
                  />
                  {form.sku && (
                    <span className="input-group-text" title="Automatically generated">
                      <i className="bi bi-lock-fill" />
                    </span>
                  )}
                </div>
                {skuNote && (
                  <div className="form-text small text-warning mt-1">{skuNote}</div>
                )}
              </Field>
            </div>
            <div className="col-md-6">
              <Field label="Barcode">
                <BarcodeInput
                  inputRef={barcodeInputRef}
                  value={form.barcode}
                  onChange={onProductBarcodeChange}
                  onScan={(value: string) => checkProductBarcode(value)}
                  onCamera={() => setCameraFor('product')}
                  onClear={() => {
                    set('barcode', '');
                    setScan({ ...emptyScan });
                    setAllowShared(false);
                    if (skuAuto) { set('sku', ''); setSkuAuto(false); setSkuNote(''); }
                  }}
                  busy={scan.checking}
                  showCameraButton={false}
                  placeholder="Scan or type a barcode, then Enter"
                />
                <div className="d-flex gap-2 mt-2">
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setCameraFor('product')}>
                    <i className="bi bi-camera me-1" />Scan barcode
                  </button>
                  {form.barcode && !scan.checking && !scan.result && !scan.conflict && (
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => checkProductBarcode(form.barcode)}>
                      <i className="bi bi-upc-scan me-1" />Check barcode
                    </button>
                  )}
                </div>
                {scan.checking && <div className="form-text small mt-1">Checking barcode…</div>}
                {scan.note && <div className="small text-warning mt-1">{scan.note}</div>}
                {scan.conflict && (
                  <DuplicateBarcodePanel
                    existing={scan.conflict.existing}
                    lookup={scan.conflict.lookup}
                    candidates={scan.conflict.candidates}
                    onOpen={openDetail}
                    onUse={useExistingProduct}
                    onShare={() => shareBarcode()}
                    shared={allowShared}
                    className="mt-2"
                  />
                )}
                {!scan.conflict && scan.result && !scan.result.found && (
                  <ScanOkPanel barcode={scan.result.barcode} format={scanFormat} missing={missingRequired} />
                )}
                {scan.conflict && !allowShared && (
                  <div className="invalid-feedback d-block">
                    This barcode is already assigned to another product.
                  </div>
                )}
                {allowShared && form.barcode && !scan.conflict && (
                  <div className="form-text small text-info">
                    Saving will create another product that shares this barcode.
                  </div>
                )}
              </Field>
            </div>
          </div>
          <Field label="Name" required><TextInput value={form.name} onChange={(e) => set('name', e.target.value)} required /></Field>
          <div className="row">
            <div className="col-md-6">
              <Field label="Category">
                <SelectInput value={form.category_id} onChange={(e) => set('category_id', e.target.value)}>
                  <option value="">None</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </SelectInput>
              </Field>
            </div>
            <div className="col-md-6">
              <Field label="Brand">
                <SelectInput value={form.brand_id} onChange={(e) => set('brand_id', e.target.value)}>
                  <option value="">None</option>
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </SelectInput>
              </Field>
            </div>
          </div>
          <div className="row">
            <div className="col-md-6">
              <Field label="Selling price (RWF)" required>
                <TextInput type="number" step="0.01" min="0" value={form.selling_price} onChange={(e) => set('selling_price', e.target.value)} required />
              </Field>
            </div>
            {canSeeCost && (
              <div className="col-md-6">
                <Field label="Purchase cost (RWF)">
                  <TextInput type="number" step="0.01" min="0" value={form.purchase_cost} onChange={(e) => set('purchase_cost', e.target.value)} />
                </Field>
              </div>
            )}
            <div className="col-md-6">
              <Field label="Warranty (months)">
                <TextInput type="number" step="1" min="0" value={form.warranty_months} onChange={(e) => set('warranty_months', e.target.value)} />
              </Field>
            </div>
          </div>
          <Field label="Description"><TextArea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} /></Field>

          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="small fw-semibold text-muted">Variants</span>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={addVariant}><i className="bi bi-plus-lg me-1" />Add variant</button>
          </div>
          {variants.length === 0 && <p className="small text-muted mb-3">No variants — the product is sold as a single item.</p>}
          {variants.map((v, i) => (
            <div className="border rounded p-3 mb-2" key={i}>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="small fw-semibold">Variant {i + 1}</span>
                <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeVariant(i)}><i className="bi bi-trash" /></button>
              </div>
              <div className="row">
                <div className="col-md-6"><Field label="Variant name" required><TextInput value={v.name} onChange={(e) => setVariant(i, 'name', e.target.value)} /></Field></div>
                <div className="col-md-6"><Field label="Variant SKU"><TextInput value={v.sku} onChange={(e) => setVariant(i, 'sku', e.target.value)} placeholder="Defaults to SKU-1, SKU-2…" /></Field></div>
              </div>
              <div className="row">
                <div className="col-md-4">
                  <Field label="Barcode">
                    <BarcodeInput
                      value={v.barcode}
                      onChange={(value) => { setVariant(i, 'barcode', value); setVariant(i, 'scan', null); }}
                      onScan={(value: string) => checkVariantBarcode(i, value)}
                      onCamera={() => setCameraFor(`variant${i}`)}
                      onClear={() => { setVariant(i, 'barcode', ''); setVariant(i, 'scan', null); }}
                      busy={!!v.scan?.checking}
                      showCameraButton={false}
                    />
                    <button type="button" className="btn btn-sm btn-outline-secondary mt-2" onClick={() => setCameraFor(`variant${i}`)}>
                      <i className="bi bi-camera me-1" />Scan
                    </button>
                    {v.scan?.checking && <div className="form-text small mt-1">Checking barcode…</div>}
                    {v.scan?.note && <div className="small text-warning mt-1">{v.scan.note}</div>}
                    {v.scan?.conflict && (
                      <DuplicateBarcodePanel
                        existing={v.scan.conflict.existing}
                        lookup={v.scan.conflict.lookup}
                        candidates={v.scan.conflict.candidates}
                        onOpen={openDetail}
                        onShare={() => shareBarcode()}
                        shared={allowShared}
                        compact
                        className="mt-2"
                      />
                    )}
                    {!v.scan?.conflict && v.scan?.ok && (
                      <div className="d-flex align-items-center gap-2 flex-wrap small mt-2">
                        <i className="bi bi-check-circle-fill text-success" />
                        <span className="fw-semibold">Barcode scanned</span>
                        <BarcodeStatus value={v.barcode} format={v.scan.format} />
                      </div>
                    )}
                  </Field>
                </div>
                <div className="col-md-4"><Field label="Selling price (RWF)"><TextInput type="number" step="0.01" min="0" value={v.selling_price} onChange={(e) => setVariant(i, 'selling_price', e.target.value)} /></Field></div>
                {canSeeCost && (
                  <div className="col-md-4"><Field label="Purchase cost (RWF)"><TextInput type="number" step="0.01" min="0" value={v.purchase_cost} onChange={(e) => setVariant(i, 'purchase_cost', e.target.value)} /></Field></div>
                )}
              </div>
            </div>
          ))}
        </form>
      </Modal>

      <Modal show={detailId !== null} title={detail ? detail.name : 'Product'} onClose={closeDetail}
        footer={
          <>
            {canEdit && detail && (
              <button className="btn btn-outline-secondary" onClick={() => openEdit(detail)}>
                <i className="bi bi-pencil me-1" />Edit
              </button>
            )}
            {canArchive && detail && (detail.status === 'archived' ? (
              <button className="btn btn-outline-success" disabled={actionBusy === detail.id}
                onClick={() => restoreProduct(detail)}>
                <i className="bi bi-arrow-clockwise me-1" />{actionBusy === detail.id ? 'Restoring…' : 'Restore'}
              </button>
            ) : (
              <button className="btn btn-outline-danger" onClick={() => setConfirmTarget(detail)}>
                <i className="bi bi-archive me-1" />Archive
              </button>
            ))}
            <button className="btn btn-outline-secondary" onClick={closeDetail}>Close</button>
          </>
        }
      >
        {detailLoading && <Loading />}
        {!detailLoading && detailError && <div className="alert alert-danger py-2 small">{detailError}</div>}
        {!detailLoading && !detailError && detail && (
          <div>
            <div className="row g-3 mb-4">
              <div className="col-6 col-md-3">
                <div className="small text-muted">SKU</div>
                <div className="fw-semibold">{detail.sku}</div>
              </div>
              <div className="col-12 col-md-6">
                <div className="small text-muted">Barcode</div>
                {detail.barcode ? (
                  <>
                    <div className="d-flex align-items-center gap-2 flex-wrap mt-1">
                      <BarcodeStatus value={detail.barcode} format={detail.barcode_format} />
                      <span className={`badge border ${detail.barcode_type === 'internal' ? 'bg-secondary-subtle text-secondary border-secondary-subtle' : 'bg-info-subtle text-info border-info-subtle'}`}>
                        {detail.barcode_type === 'internal' ? 'Internal shop barcode' : 'External product barcode'}
                      </span>
                    </div>
                    <div className="d-flex flex-wrap gap-2 mt-2">
                      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={copyBarcode}>
                        <i className="bi bi-clipboard me-1" />Copy
                      </button>
                      {canEdit && (
                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={openChangeBarcode}>
                          <i className="bi bi-pencil me-1" />Change barcode
                        </button>
                      )}
                      {canEdit && (
                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setLabelOpen(true)}>
                          <i className="bi bi-printer me-1" />Print barcode
                        </button>
                      )}
                    </div>
                    {copied && <div className="small text-success mt-1">Copied</div>}
                  </>
                ) : (
                  <div className="d-flex align-items-center gap-2 flex-wrap mt-1">
                    <span className="text-muted">—</span>
                    {canEdit && (
                      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={openChangeBarcode}>
                        <i className="bi bi-plus-lg me-1" />Register barcode
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="col-6 col-md-3">
                <div className="small text-muted">Category</div>
                <div>{detail.category || '—'}</div>
              </div>
              <div className="col-6 col-md-3">
                <div className="small text-muted">Brand</div>
                <div>{detail.brand || '—'}</div>
              </div>
              <div className="col-6 col-md-3">
                <div className="small text-muted">Selling price</div>
                <div className="money fw-semibold">{fmtMoney(detail.selling_price)}</div>
              </div>
              {detail.purchase_cost !== undefined && (
                <div className="col-6 col-md-3">
                  <div className="small text-muted">Purchase cost</div>
                  <div className="money fw-semibold">{fmtMoney(detail.purchase_cost)}</div>
                </div>
              )}
              <div className="col-6 col-md-3">
                <div className="small text-muted">Warranty</div>
                <div>{detail.warranty_months ? `${detail.warranty_months} months` : '—'}</div>
              </div>
              <div className="col-6 col-md-3">
                <div className="small text-muted">Status</div>
                <Badge status={detail.status} />
              </div>
              <div className="col-12">
                <div className="small text-muted">Description</div>
                <div>{detail.description || '—'}</div>
              </div>
            </div>

            <h6 className="fw-semibold mb-2">Variants</h6>
            {variantsOfDetail.length === 0 && <p className="small text-muted mb-3">This product has no variants.</p>}
            {variantsOfDetail.length > 0 && (
              <div className="table-responsive mb-4">
                <table className="table table-sm mb-0">
                  <thead>
                    <tr>
                      <th>SKU</th><th>Name</th>
                      <th className="text-end">Selling price</th>
                      {showVariantCost && <th className="text-end">Purchase cost</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {variantsOfDetail.map((v: any) => (
                      <tr key={v.id}>
                        <td>{v.sku}</td>
                        <td>{v.name}</td>
                        <td className="text-end money fw-semibold">{fmtMoney(v.selling_price)}</td>
                        {showVariantCost && <td className="text-end money fw-semibold">{fmtMoney(v.purchase_cost)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {canPriceHistory && (
              <div className="mb-3">
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                  <h6 className="fw-semibold mb-0">Price history</h6>
                  {histLoading && (
                    <span className="small text-muted d-flex align-items-center">
                      <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />
                      Loading…
                    </span>
                  )}
                </div>
                {histError && <div className="alert alert-warning py-2 small mb-2">{histError}</div>}
                {!histError && !histLoading && hist.items.length === 0 && (
                  <p className="small text-muted mb-0">No price changes recorded yet.</p>
                )}
                {hist.items.length > 0 && (
                  <>
                    <div className="table-responsive">
                      <table className="table table-sm mb-0">
                        <thead>
                          <tr><th>Date</th><th>Field</th><th>Old value</th><th>New value</th><th>Reason</th><th>By</th></tr>
                        </thead>
                        <tbody>
                          {hist.items.map((h: any) => (
                            <tr key={h.id}>
                              <td className="text-nowrap">{fmtDateTime(h.created_at)}</td>
                              <td>{h.field}</td>
                              <td>{h.old_value ?? '—'}</td>
                              <td>{h.new_value ?? '—'}</td>
                              <td>{h.reason || '—'}</td>
                              <td>{h.changed_by_name || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Pagination page={histPage} pages={hist.pages || 1} total={hist.total} onPage={setHistPage} />
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal show={change.open} title={detail?.barcode ? 'Change barcode' : 'Register barcode'}
        onClose={() => setChange({ ...emptyChange })} size="sm"
        footer={
          <>
            <button type="button" className="btn btn-outline-secondary" onClick={() => setChange({ ...emptyChange })}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={submitChangeBarcode}
              disabled={change.busy || change.checking || !normalizeBarcode(change.value)}>
              {change.busy ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <form onSubmit={submitChangeBarcode}>
          <Field label="Barcode">
            <BarcodeInput
              value={change.value}
              onChange={(value) => setChange((c) => ({ ...c, value, result: null, conflict: null, error: '' }))}
              onScan={(value: string) => checkChangeBarcode(value)}
              onCamera={() => setCameraFor('change')}
              onClear={() => setChange((c) => ({ ...c, value: '' }))}
              busy={change.checking}
              autoFocus
              showCameraButton={false}
              placeholder="Scan or type a barcode, then Enter"
            />
            <div className="mt-2">
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setCameraFor('change')}>
                <i className="bi bi-camera me-1" />Scan barcode
              </button>
            </div>
            {change.checking && <div className="form-text small mt-1">Checking barcode…</div>}
            {change.error && <div className="alert alert-danger py-2 small mt-2 mb-0">{change.error}</div>}
            {change.conflict && (
              <DuplicateBarcodePanel
                existing={change.conflict.existing}
                lookup={change.conflict.lookup}
                candidates={change.conflict.candidates}
                tone={change.conflict.own ? 'info' : 'error'}
                // The code already sits on this item — sharing it is refused
                // by the server, so only foreign owners get the share action.
                onShare={change.conflict.own
                  ? undefined
                  : () => {
                      setChange((c) => ({ ...c, allowShared: true }));
                      postChangeBarcode(true);
                    }}
                shared={change.allowShared}
                className="mt-2"
              />
            )}
            {change.conflict?.own && (
              <div className="form-text mt-1">Pick a different code to replace it.</div>
            )}
            {!change.conflict && change.result && !change.result.found && (
              <ScanOkPanel
                barcode={change.result.barcode}
                format={change.result.barcode_format || detectBarcodeFormat(change.value)}
                missing={[]}
              >
                <div className="text-muted mt-1">Not registered anywhere — save to assign it to this item.</div>
              </ScanOkPanel>
            )}
          </Field>
          <div className="form-text">Changing a barcode never alters past sales or receipts.</div>
        </form>
      </Modal>

      <Modal show={editOpen} title="Edit product" onClose={() => setEditOpen(false)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setEditOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveEdit}
              disabled={editBusy || editLoading || !String(editForm.name || '').trim()}>
              {editBusy ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        {editLoading && <Loading label="Loading product…" />}
        {!editLoading && (
          <form onSubmit={saveEdit}>
            {editErr && <div className="alert alert-danger py-2 small">{editErr}</div>}
            <Field label="Name" required>
              <TextInput value={editForm.name} onChange={(e) => setE('name', e.target.value)} required />
            </Field>
            <div className="row">
              <div className="col-md-6">
                <Field label="Category">
                  <SelectInput value={editForm.category_id} onChange={(e) => setE('category_id', e.target.value)}>
                    <option value="">None</option>
                    {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </SelectInput>
                </Field>
              </div>
              <div className="col-md-6">
                <Field label="Brand">
                  <SelectInput value={editForm.brand_id} onChange={(e) => setE('brand_id', e.target.value)}>
                    <option value="">None</option>
                    {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </SelectInput>
                </Field>
              </div>
            </div>
            <div className="row">
              <div className="col-md-6">
                <Field label="Supplier">
                  <SelectInput value={editForm.supplier_id} onChange={(e) => setE('supplier_id', e.target.value)}>
                    <option value="">None</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.company_name}</option>)}
                  </SelectInput>
                </Field>
              </div>
              <div className="col-md-6">
                <Field label="Unit">
                  <TextInput value={editForm.unit} onChange={(e) => setE('unit', e.target.value)} placeholder="pcs" />
                </Field>
              </div>
            </div>
            {canManageMoney ? (
              <div className="row">
                <div className="col-md-4">
                  <Field label="Selling price (RWF)">
                    <TextInput type="number" step="0.01" min="0" value={editForm.selling_price}
                      onChange={(e) => setE('selling_price', e.target.value)} />
                  </Field>
                </div>
                <div className="col-md-4">
                  <Field label="Purchase cost (RWF)">
                    <TextInput type="number" step="0.01" min="0" value={editForm.purchase_cost}
                      onChange={(e) => setE('purchase_cost', e.target.value)} />
                  </Field>
                </div>
                <div className="col-md-4">
                  <Field label="Minimum selling price (RWF)"
                    hint="The selling price cannot be saved below this floor.">
                    <TextInput type="number" step="0.01" min="0" value={editForm.min_selling_price}
                      onChange={(e) => setE('min_selling_price', e.target.value)} />
                  </Field>
                </div>
                {moneyTouched && (
                  <div className="col-12">
                    <Field label="Reason for the price change"
                      hint="Optional — kept in the price history shown under the product.">
                      <TextInput value={editForm.reason} onChange={(e) => setE('reason', e.target.value)}
                        placeholder="e.g. new supplier cost" />
                    </Field>
                  </div>
                )}
              </div>
            ) : (
              <p className="small text-muted mb-3">
                Prices are managed by a user with pricing permission — they are not editable here.
              </p>
            )}
            <div className="row">
              <div className="col-md-4">
                <Field label="Minimum stock level">
                  <TextInput type="number" step="1" min="0" value={editForm.min_stock_level}
                    onChange={(e) => setE('min_stock_level', e.target.value)} />
                </Field>
              </div>
              <div className="col-md-4">
                <Field label="Reorder level">
                  <TextInput type="number" step="1" min="0" value={editForm.reorder_level}
                    onChange={(e) => setE('reorder_level', e.target.value)} />
                </Field>
              </div>
              <div className="col-md-4">
                <Field label="Reorder quantity">
                  <TextInput type="number" step="1" min="0" value={editForm.reorder_quantity}
                    onChange={(e) => setE('reorder_quantity', e.target.value)} />
                </Field>
              </div>
            </div>
            <div className="row">
              <div className="col-md-4">
                <Field label="Warranty (months)">
                  <TextInput type="number" step="1" min="0" value={editForm.warranty_months}
                    onChange={(e) => setE('warranty_months', e.target.value)} />
                </Field>
              </div>
              <div className="col-md-4">
                <Field label="Warranty provider">
                  <TextInput value={editForm.warranty_provider}
                    onChange={(e) => setE('warranty_provider', e.target.value)} />
                </Field>
              </div>
              <div className="col-md-4">
                <Field label="Warranty terms">
                  <TextInput value={editForm.warranty_terms}
                    onChange={(e) => setE('warranty_terms', e.target.value)} />
                </Field>
              </div>
            </div>
            <Field label="Description">
              <TextArea value={editForm.description} onChange={(e) => setE('description', e.target.value)} rows={3} />
            </Field>
            <p className="small text-muted mb-0">
              SKU and barcode are managed from the product view.
            </p>
          </form>
        )}
      </Modal>

      <BarcodeLabelDialog
        show={labelOpen && !!detail}
        onClose={() => setLabelOpen(false)}
        value={detail?.barcode || ''}
        format={detail?.barcode_format}
        barcodeType={detail?.barcode_type}
        name={detail?.name}
        sku={detail?.sku}
      />

      <BarcodeScanner
        show={cameraFor !== null}
        onClose={() => setCameraFor(null)}
        onDetected={(value: string) => {
          const target = cameraFor;
          setCameraFor(null);
          handleCameraValue(target, value);
        }}
      />

      <ConfirmDialog
        show={!!confirmTarget}
        title="Archive product"
        message={`Archive “${confirmTarget?.name || ''}”? It leaves the catalogue, the POS and new purchase orders until it is restored — sales and stock history stay intact.`}
        confirmLabel="Archive"
        onConfirm={archiveProduct}
        onClose={() => setConfirmTarget(null)}
      />
    </div>
  );
}

export default function ShopCatalogPage() {
  return (
    <Suspense>
      <CatalogInner />
    </Suspense>
  );
}
