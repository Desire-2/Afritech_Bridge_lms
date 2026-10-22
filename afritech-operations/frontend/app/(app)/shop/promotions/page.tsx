'use client';

import { useRef, useState } from 'react';
import { useFetch } from '@/lib/use-fetch';
import { ApiClientError, api, can, fmtDate } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { P } from '@/lib/permissions';
import { PageHeader, Loading, ErrorAlert, EmptyState, Pagination, Modal, Badge, ConfirmDialog } from '@/components/ui';
import { Field, TextInput, SelectInput, TextArea } from '@/components/form';

type ScopeRow = {
  key: number;
  kind: 'product' | 'category';
  product_id: number | null;
  product_name: string;
  category_id: string;
  min_quantity: string;
  search: string;
  results: any[];
  loading: boolean;
};

const emptyForm = {
  name: '', code: '', promotion_type: 'percentage', value: '',
  min_purchase_amount: '', max_discount_amount: '',
  starts_at: '', ends_at: '', usage_limit: '', is_active: true, notes: '',
};

let rowSeq = 0;
const blankRow = (): ScopeRow => ({
  key: ++rowSeq, kind: 'product', product_id: null, product_name: '',
  category_id: '', min_quantity: '1', search: '', results: [], loading: false,
});

/** ISO timestamp → value for a datetime-local input (local time). */
function toLocalInput(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local value → ISO string for the API. */
function toIso(local: string) {
  if (!local) return undefined;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Derive the display status from is_active + the active window. */
function promotionStatus(p: any): 'active' | 'scheduled' | 'expired' | 'inactive' {
  if (!p.is_active) return 'inactive';
  const now = Date.now();
  const start = p.starts_at ? new Date(p.starts_at).getTime() : null;
  const end = p.ends_at ? new Date(p.ends_at).getTime() : null;
  if (start !== null && now < start) return 'scheduled';
  if (end !== null && now > end) return 'expired';
  return 'active';
}

function StatusBadge({ promotion }: { promotion: any }) {
  const status = promotionStatus(promotion);
  const cls =
    status === 'active' ? 'bg-success-subtle text-success border-success-subtle'
    : status === 'scheduled' ? 'bg-info-subtle text-info border-info-subtle'
    : status === 'expired' ? 'bg-secondary-subtle text-secondary border-secondary-subtle'
    : 'bg-secondary-subtle text-secondary border-secondary-subtle';
  return <span className={`badge border ${cls}`}>{status}</span>;
}

/** "10%" · "5,000 off" · "BOGO" */
function typeValueLabel(p: any) {
  if (p.promotion_type === 'bogo') return 'BOGO';
  const n = Number(p.value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
  return p.promotion_type === 'fixed' ? `${n} off` : `${n}%`;
}

export default function ShopPromotionsPage() {
  const { user } = useAuth();
  const canManage = can(user, P.shopPromotionsManage);

  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState(''); // '' | 'true' | 'false'
  const { data, error, loading, reload, setData } = useFetch('/api/shop/promotions', [page, q, statusFilter], {
    page, per_page: 15, q: q || undefined, active: statusFilter || undefined,
  });
  const items = data?.items || [];

  // ── create / edit ─────────────────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ ...emptyForm });
  const [rows, setRows] = useState<ScopeRow[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [error2, setError2] = useState('');
  const rowSearchSeq = useRef<Record<number, number>>({});

  function set<K extends keyof typeof form>(key: K, value: any) { setForm((f) => ({ ...f, [key]: value })); }
  function setRow(index: number, patch: Partial<ScopeRow>) {
    setRows((rs) => rs.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  async function loadCategories() {
    try {
      const d: any = await api('/api/shop/categories');
      setCats(d.items || []);
    } catch {
      setCats([]);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm });
    setRows([]);
    setError2('');
    setOpen(true);
    loadCategories();
  }

  function openEdit(promo: any) {
    setEditing(promo);
    setForm({
      name: promo.name || '',
      code: promo.code || '',
      promotion_type: promo.promotion_type || 'percentage',
      value: promo.value !== undefined && promo.value !== null ? String(promo.value) : '',
      min_purchase_amount: promo.min_purchase_amount !== undefined && promo.min_purchase_amount !== null ? String(promo.min_purchase_amount) : '',
      max_discount_amount: promo.max_discount_amount !== undefined && promo.max_discount_amount !== null ? String(promo.max_discount_amount) : '',
      starts_at: toLocalInput(promo.starts_at),
      ends_at: toLocalInput(promo.ends_at),
      usage_limit: promo.usage_limit !== undefined && promo.usage_limit !== null ? String(promo.usage_limit) : '',
      is_active: !!promo.is_active,
      notes: promo.notes || '',
    });
    setRows((promo.items || []).map((it: any) => ({
      ...blankRow(),
      kind: it.product_id ? 'product' : 'category',
      product_id: it.product_id || null,
      product_name: it.product || '',
      category_id: it.category_id ? String(it.category_id) : '',
      min_quantity: String(it.min_quantity ?? 1),
    })));
    setError2('');
    setOpen(true);
    loadCategories();
  }

  /** Live product search for one scope row; stale responses are dropped. */
  async function searchProducts(index: number, key: number, value: string) {
    setRow(index, { search: value, product_id: null, product_name: '', results: [], loading: !!value.trim() });
    const seq = (rowSearchSeq.current[key] || 0) + 1;
    rowSearchSeq.current[key] = seq;
    if (!value.trim()) return;
    try {
      const d: any = await api('/api/shop/products', { params: { q: value, per_page: 8 } });
      if (rowSearchSeq.current[key] !== seq) return;
      setRow(index, { results: d.items || [], loading: false });
    } catch {
      if (rowSearchSeq.current[key] !== seq) return;
      setRow(index, { results: [], loading: false });
    }
  }

  function pickProduct(index: number, product: any) {
    setRow(index, { product_id: product.id, product_name: product.name, search: '', results: [], loading: false });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.starts_at || !form.ends_at) { setError2('Start and end date-times are required'); return; }
    if (rows.some((r) => (r.kind === 'product' ? !r.product_id : !r.category_id))) {
      setError2('Each scope row needs a selected product or category');
      return;
    }
    setBusy(true);
    setError2('');
    try {
      const body: any = {
        name: form.name,
        code: form.code || null,
        promotion_type: form.promotion_type || 'percentage',
        value: form.value !== '' ? Number(form.value) : 0,
        min_purchase_amount: form.min_purchase_amount !== '' ? Number(form.min_purchase_amount) : 0,
        max_discount_amount: form.max_discount_amount !== '' ? Number(form.max_discount_amount) : null,
        starts_at: toIso(form.starts_at),
        ends_at: toIso(form.ends_at),
        is_active: !!form.is_active,
        usage_limit: form.usage_limit !== '' ? Number(form.usage_limit) : null,
        notes: form.notes || null,
        items: rows.map((r) => ({
          product_id: r.kind === 'product' ? r.product_id : undefined,
          category_id: r.kind === 'category' ? Number(r.category_id) : undefined,
          min_quantity: r.min_quantity !== '' ? Number(r.min_quantity) : 1,
        })),
      };
      if (editing) {
        await api(`/api/shop/promotions/${editing.id}`, { method: 'PATCH', body });
      } else {
        await api('/api/shop/promotions', { method: 'POST', body });
      }
      setOpen(false);
      reload();
    } catch (err: any) {
      setError2(err.message);
    } finally {
      setBusy(false);
    }
  }

  // ── deactivate ────────────────────────────────────────────────────────────
  const [confirm, setConfirm] = useState<any | null>(null);

  async function deactivate(promo: any) {
    try {
      const res: any = await api(`/api/shop/promotions/${promo.id}`, { method: 'DELETE' });
      // The endpoint soft-deactivates: reflect the returned row in place.
      const updated = res?.promotion;
      setData((prev: any) =>
        prev
          ? { ...prev, items: (prev.items || []).map((r: any) => (updated && r.id === updated.id ? updated : r)) }
          : prev,
      );
    } catch (err: any) {
      // Gone: someone else already removed it — refresh so the list is honest.
      if (err instanceof ApiClientError && err.status === 404) { reload(); return; }
      throw err; // surface inside the ConfirmDialog
    }
  }

  return (
    <div>
      <PageHeader title="Promotions" subtitle="Discounts and basket offers across the shop"
        actions={canManage && <button className="btn btn-primary" onClick={openCreate}><i className="bi bi-plus-circle me-1" /> New promotion</button>} />

      <div className="card mb-3">
        <div className="card-body py-2 d-flex align-items-center flex-wrap gap-2">
          <i className="bi bi-search text-muted" />
          <input className="form-control form-control-sm border-0 shadow-none" style={{ maxWidth: 280 }} placeholder="Search name or code…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          <select className="form-select form-select-sm" style={{ width: 160 }} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option value="true">Active only</option>
            <option value="false">Inactive only</option>
          </select>
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={reload} />}
      {loading && <Loading />}
      {!loading && !error && items.length === 0 && <EmptyState message="No promotions found" hint={canManage ? 'Create a promotion to offer discounts at the till.' : undefined} icon="bi-tags" />}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="card">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr>
                    <th>Name</th><th>Code</th><th>Discount</th><th>Active window</th>
                    <th className="text-end">Usage</th><th>Status</th><th>Created</th>
                    {canManage && <th />}
                  </tr>
                </thead>
                <tbody>
                  {items.map((p: any) => (
                    <tr key={p.id}>
                      <td className="fw-semibold">{p.name}</td>
                      <td>{p.code ? <span className="font-monospace">{p.code}</span> : <span className="text-muted">—</span>}</td>
                      <td><span className="badge border bg-light-subtle text-body border-light-subtle">{typeValueLabel(p)}</span></td>
                      <td className="small">{fmtDate(p.starts_at)} – {fmtDate(p.ends_at)}</td>
                      <td className="text-end">
                        {p.usage_limit ? `${p.used_count ?? 0} / ${p.usage_limit}` : (p.used_count ?? 0)}
                      </td>
                      <td><StatusBadge promotion={p} /></td>
                      <td className="small text-muted">{fmtDate(p.created_at)}</td>
                      {canManage && (
                        <td className="text-end">
                          <div className="d-flex gap-1 justify-content-end">
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => openEdit(p)} title="Edit"><i className="bi bi-pencil" /></button>
                            {p.is_active && (
                              <button className="btn btn-sm btn-outline-danger" title="Deactivate"
                                onClick={() => setConfirm(p)}>
                                <i className="bi bi-power" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination page={page} pages={data?.pages || 1} total={data?.total} onPage={setPage} />
        </>
      )}

      <Modal show={open} title={editing ? 'Edit promotion' : 'New promotion'} onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        <form onSubmit={save}>
          {error2 && <div className="alert alert-danger py-2 small">{error2}</div>}
          <div className="row">
            <div className="col-md-7"><Field label="Name" required><TextInput value={form.name} onChange={(e) => set('name', e.target.value)} required /></Field></div>
            <div className="col-md-5"><Field label="Code" hint="Optional — customers can enter it at the till."><TextInput value={form.code} onChange={(e) => set('code', e.target.value)} placeholder="e.g. XMAS10" /></Field></div>
          </div>
          <div className="row">
            <div className="col-md-6">
              <Field label="Type">
                <SelectInput value={form.promotion_type} onChange={(e) => set('promotion_type', e.target.value)}>
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed amount (RWF off)</option>
                  <option value="bogo">Buy one, get one (BOGO)</option>
                </SelectInput>
              </Field>
            </div>
            <div className="col-md-6">
              <Field label={form.promotion_type === 'percentage' ? 'Value (%)' : form.promotion_type === 'fixed' ? 'Value (RWF off)' : 'Value'}>
                <TextInput type="number" step="0.01" min="0" value={form.value} onChange={(e) => set('value', e.target.value)} disabled={form.promotion_type === 'bogo'} />
              </Field>
            </div>
          </div>
          <div className="row">
            <div className="col-md-4">
              <Field label="Min purchase (RWF)"><TextInput type="number" step="0.01" min="0" value={form.min_purchase_amount} onChange={(e) => set('min_purchase_amount', e.target.value)} /></Field>
            </div>
            <div className="col-md-4">
              <Field label="Max discount (RWF)" hint="Cap for percentage discounts."><TextInput type="number" step="0.01" min="0" value={form.max_discount_amount} onChange={(e) => set('max_discount_amount', e.target.value)} /></Field>
            </div>
            <div className="col-md-4">
              <Field label="Usage limit" hint="Leave empty for unlimited."><TextInput type="number" step="1" min="1" value={form.usage_limit} onChange={(e) => set('usage_limit', e.target.value)} /></Field>
            </div>
          </div>
          <div className="row">
            <div className="col-md-4">
              <Field label="Starts at" required><TextInput type="datetime-local" value={form.starts_at} onChange={(e) => set('starts_at', e.target.value)} required /></Field>
            </div>
            <div className="col-md-4">
              <Field label="Ends at" required><TextInput type="datetime-local" value={form.ends_at} onChange={(e) => set('ends_at', e.target.value)} required /></Field>
            </div>
            <div className="col-md-4 d-flex align-items-center">
              <div className="form-check form-switch mt-3">
                <input className="form-check-input" type="checkbox" id="promo-active" checked={!!form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
                <label className="form-check-label small fw-semibold" htmlFor="promo-active">Active</label>
              </div>
            </div>
          </div>
          <Field label="Notes"><TextArea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} /></Field>

          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="small fw-semibold text-muted">
              Scope items <span className="fw-normal">— leave empty for a site-wide promotion</span>
            </span>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setRows((rs) => [...rs, blankRow()])}>
              <i className="bi bi-plus-lg me-1" />Add scope row
            </button>
          </div>
          {rows.length === 0 && <p className="small text-muted mb-3">No scope rows — the promotion applies to whole baskets.</p>}
          {rows.map((r, i) => (
            <div className="border rounded p-2 mb-2" key={r.key}>
              <div className="d-flex gap-2 align-items-start">
                <div className="flex-grow-1 min-w-0">
                  <div className="d-flex gap-2 mb-2" style={{ maxWidth: 220 }}>
                    <SelectInput value={r.kind} onChange={(e) => setRow(i, {
                      kind: e.target.value as ScopeRow['kind'],
                      product_id: null, product_name: '', search: '', results: [],
                      category_id: '',
                    })}>
                      <option value="product">Product</option>
                      <option value="category">Category</option>
                    </SelectInput>
                    <SelectInput value={r.min_quantity} onChange={(e) => setRow(i, { min_quantity: e.target.value })} style={{ width: 90 }} title="Minimum quantity">
                      {[1, 2, 3, 4, 5, 10].map((n) => <option key={n} value={n}>Qty {n}</option>)}
                    </SelectInput>
                  </div>
                  {r.kind === 'product' ? (
                    r.product_id ? (
                      <div className="input-group input-group-sm">
                        <span className="input-group-text"><i className="bi bi-box-seam" /></span>
                        <input className="form-control" readOnly value={r.product_name} aria-label="Selected product" />
                        <button type="button" className="btn btn-outline-secondary" title="Clear product"
                          onClick={() => setRow(i, { product_id: null, product_name: '' })}>
                          <i className="bi bi-x-lg" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <input className="form-control form-control-sm" placeholder="Search products…" value={r.search}
                          onChange={(e) => searchProducts(i, r.key, e.target.value)} />
                        {r.loading && <div className="form-text small mt-1">Searching…</div>}
                        {r.results.length > 0 && (
                          <div className="border rounded mt-1 small" style={{ maxHeight: 150, overflowY: 'auto' }}>
                            {r.results.map((p: any) => (
                              <button type="button" key={p.id} className="btn btn-sm btn-link d-block w-100 text-start text-truncate text-decoration-none"
                                onClick={() => pickProduct(i, p)}>
                                {p.name}{p.sku ? <span className="text-muted small"> · {p.sku}</span> : null}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )
                  ) : (
                    <SelectInput value={r.category_id} onChange={(e) => setRow(i, { category_id: e.target.value })}>
                      <option value="">Select a category…</option>
                      {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </SelectInput>
                  )}
                </div>
                <button type="button" className="btn btn-sm btn-outline-danger" title="Remove row"
                  onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                  <i className="bi bi-trash" />
                </button>
              </div>
            </div>
          ))}
          <div className="form-text">Each scope row applies when the basket contains the chosen product or category at the minimum quantity.</div>
        </form>
      </Modal>

      {confirm && (
        <ConfirmDialog show={!!confirm} title="Deactivate promotion"
          message={`Deactivate “${confirm.name}”? It will no longer apply at the till — past sales keep their discounts.`}
          confirmLabel="Deactivate"
          onConfirm={() => deactivate(confirm)}
          onClose={() => setConfirm(null)} />
      )}
    </div>
  );
}
