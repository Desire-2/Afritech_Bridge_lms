'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useFetch } from '@/lib/use-fetch';
import { ApiClientError, api, can, fmtDateTime, fmtMoney } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { P } from '@/lib/permissions';
import { PageHeader, Loading, ErrorAlert, EmptyState, Pagination, Modal, Badge } from '@/components/ui';
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

/** Retail symbologies — everything else is an internal shop code. */
const EXTERNAL_FORMATS = ['EAN_13', 'UPC_A', 'EAN_8', 'UPC_E'];

/** The inputs this form marks as required — drives the post-scan checklist. */
const REQUIRED_FIELDS: { key: keyof typeof emptyForm; label: string }[] = [
  { key: 'sku', label: 'SKU' },
  { key: 'name', label: 'Name' },
  { key: 'selling_price', label: 'Selling price (RWF)' },
];

interface ScanConflict {
  existing: BarcodeConflict;
  lookup?: BarcodeLookup | null;
  /** The code already sits on the item being edited. */
  own?: boolean;
}

const emptyScan = { checking: false, result: null as BarcodeLookup | null, conflict: null as ScanConflict | null, note: '' };
const emptyChange = {
  open: false, value: '', checking: false, result: null as BarcodeLookup | null,
  conflict: null as ScanConflict | null, busy: false, error: '',
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
    err.data?.code === 'duplicate_barcode' &&
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
  // Mirrors the backend cost permissions: without them purchase_cost is
  // stripped from every payload, so neither the column nor the field exists.
  const canSeeCost = can(user, P.shopPricingView) || can(user, P.shopPricingManage)
    || can(user, P.shopPurchasesCreate) || can(user, P.shopPurchasesApprove)
    || can(user, P.shopPurchasesReceive) || can(user, P.shopFinancialReportsView);

  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const { data, error, loading, reload } = useFetch('/api/shop/products', [page, q], { page, per_page: 15, q: q || undefined });
  const items = data?.items || [];

  const [open, setOpen] = useState(false);
  const [cats, setCats] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ ...emptyForm });
  const [variants, setVariants] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [error2, setError2] = useState('');
  const [saveConflict, setSaveConflict] = useState<ScanConflict | null>(null);
  const [scan, setScan] = useState({ ...emptyScan });
  const [cameraFor, setCameraFor] = useState<string | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [copied, setCopied] = useState(false);
  const [change, setChange] = useState({ ...emptyChange });
  const [labelOpen, setLabelOpen] = useState(false);

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
    setScan({ ...emptyScan });
    setOpen(true);
    const [c, b]: any[] = await Promise.all([
      api('/api/shop/categories').catch(() => ({ items: [] })),
      api('/api/shop/brands').catch(() => ({ items: [] })),
    ]);
    setCats(c.items || []);
    setBrands(b.items || []);
    if (prefill) checkProductBarcode(prefill);
  }

  async function openDetail(product: any) {
    const id = typeof product === 'number' ? product : product?.id;
    if (!id) return;
    setDetailId(id);
    setDetail(null);
    setDetailError('');
    setDetailLoading(true);
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
  }

  function useExistingProduct(productId: number) {
    setOpen(false);
    setSaveConflict(null);
    setScan({ ...emptyScan });
    openDetail(productId);
  }

  /** Exists-check for the create form's product barcode. Never clears it. */
  async function checkProductBarcode(raw: string) {
    const code = normalizeBarcode(raw);
    if (!code) {
      setScan({ ...emptyScan });
      return;
    }
    setScan({ ...emptyScan, checking: true });
    try {
      const result = await lookupBarcode(code);
      setScan({
        checking: false,
        result,
        conflict: result.found ? { existing: conflictFromLookup(result), lookup: result } : null,
        note: '',
      });
    } catch (err: any) {
      setScan({ ...emptyScan, note: err.message || 'The barcode could not be checked.' });
    }
  }

  function onProductBarcodeChange(value: string) {
    set('barcode', value);
    setScan({ ...emptyScan });
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
        setVariant(index, 'scan', {
          checking: false,
          conflict: { existing: conflictFromLookup(result), lookup: result },
        });
      }
    } catch (err: any) {
      setVariant(index, 'scan', { checking: false, note: err.message });
    }
  }

  async function handleCameraValue(target: string | null, value: string) {
    if (target === 'product') {
      set('barcode', value);
      await checkProductBarcode(value);
    } else if (target === 'change') {
      setChange((c) => ({ ...c, value }));
      await checkChangeBarcode(value);
    } else if (target && target.startsWith('variant')) {
      await checkVariantBarcode(Number(target.slice('variant'.length)), value);
    }
  }

  /** A 409 on save: show the same panel from the server's `existing` row. */
  async function showSaveConflict(existing: BarcodeConflict) {
    setSaveConflict({ existing });
    if (existing.kind !== 'variant') return;
    // Variant conflicts name no parent id — re-check this form's codes to find it.
    const candidates = [form.barcode, ...variants.map((v) => v.barcode)]
      .map((v: any) => normalizeBarcode(v))
      .filter(Boolean);
    for (const candidate of candidates) {
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

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError2('');
    setSaveConflict(null);
    try {
      const body: any = {
        sku: form.sku,
        name: form.name,
        selling_price: form.selling_price !== '' ? Number(form.selling_price) : undefined,
        category_id: form.category_id ? Number(form.category_id) : undefined,
        brand_id: form.brand_id ? Number(form.brand_id) : undefined,
        warranty_months: form.warranty_months !== '' ? Number(form.warranty_months) : undefined,
        description: form.description || undefined,
      };
      if (form.barcode) {
        body.barcode = form.barcode;
        applyBarcodeFields(body, form.barcode);
      }
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
      if (isDuplicateError(err)) await showSaveConflict(err.data.existing);
      else setError2(err.message);
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
      setChange((c) => ({ ...c, value: raw, result: null, conflict: null, error: '' }));
      return;
    }
    setChange((c) => ({ ...c, value: code, checking: true, result: null, conflict: null, error: '' }));
    try {
      const result = await lookupBarcode(code);
      const own = !!result.found && !!detail && result.product?.id === detail.id;
      setChange((c) => ({
        ...c,
        checking: false,
        result,
        conflict: result.found
          ? { existing: conflictFromLookup(result), lookup: result, own }
          : null,
      }));
    } catch (err: any) {
      setChange((c) => ({ ...c, checking: false, error: err.message || 'The barcode could not be checked.' }));
    }
  }

  async function submitChangeBarcode(e: React.FormEvent) {
    e.preventDefault();
    const code = normalizeBarcode(change.value);
    if (!code || !detail) return;
    setChange((c) => ({ ...c, busy: true, error: '' }));
    try {
      const body: any = { barcode: code };
      applyBarcodeFields(body, code);
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
        setChange((c) => ({ ...c, busy: false, conflict: { existing: err.data.existing, lookup } }));
        return;
      }
      setChange((c) => ({ ...c, busy: false, error: err.message }));
    }
  }

  const variantsOfDetail: any[] = detail?.variants || [];
  const showVariantCost = variantsOfDetail.some((v) => v.purchase_cost !== undefined);
  const priceHistory: any[] = detail?.price_history || [];
  const missingRequired = REQUIRED_FIELDS.map((f) => ({
    label: f.label,
    done: String(form[f.key] ?? '').trim() !== '',
  }));
  const scanFormat = scan.result?.barcode_format || detectBarcodeFormat(form.barcode);

  return (
    <div>
      <PageHeader title="Catalogue" subtitle="Products, variants and pricing"
        actions={canCreate && <button className="btn btn-primary" onClick={() => openCreate()}><i className="bi bi-plus-circle me-1" /> New product</button>} />

      <div className="card mb-3">
        <div className="card-body py-2 d-flex align-items-center">
          <i className="bi bi-search text-muted me-2" />
          <input className="form-control form-control-sm border-0 shadow-none" placeholder="Search name, SKU or barcode…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
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
                        <button className="btn btn-sm btn-outline-secondary" onClick={(e) => { e.stopPropagation(); openDetail(p); }}>View</button>
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
              onOpen={openDetail}
              onUse={useExistingProduct}
              className="mb-3"
            />
          )}
          <div className="row">
            <div className="col-md-6"><Field label="SKU" required><TextInput value={form.sku} onChange={(e) => set('sku', e.target.value)} required /></Field></div>
            <div className="col-md-6">
              <Field label="Barcode">
                <BarcodeInput
                  inputRef={barcodeInputRef}
                  value={form.barcode}
                  onChange={onProductBarcodeChange}
                  onScan={(value: string) => checkProductBarcode(value)}
                  onCamera={() => setCameraFor('product')}
                  onClear={() => { set('barcode', ''); setScan({ ...emptyScan }); }}
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
                    onOpen={openDetail}
                    onUse={useExistingProduct}
                    className="mt-2"
                  />
                )}
                {!scan.conflict && scan.result && !scan.result.found && (
                  <ScanOkPanel barcode={scan.result.barcode} format={scanFormat} missing={missingRequired} />
                )}
                {scan.conflict && (
                  <div className="invalid-feedback d-block">
                    This barcode is already assigned to another product.
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
        footer={<button className="btn btn-outline-secondary" onClick={closeDetail}>Close</button>}
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

            {priceHistory.length > 0 && (
              <>
                <h6 className="fw-semibold mb-2">Price history</h6>
                <div className="table-responsive">
                  <table className="table table-sm mb-0">
                    <thead>
                      <tr><th>Date</th><th>Field</th><th>From</th><th>To</th><th>By</th></tr>
                    </thead>
                    <tbody>
                      {priceHistory.map((h: any) => (
                        <tr key={h.id}>
                          <td>{fmtDateTime(h.created_at)}</td>
                          <td>{h.field}</td>
                          <td>{h.old_value ?? '—'}</td>
                          <td>{h.new_value ?? '—'}</td>
                          <td>{h.changed_by_name || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
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
                tone={change.conflict.own ? 'info' : 'error'}
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
