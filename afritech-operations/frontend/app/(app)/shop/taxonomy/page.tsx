'use client';

import { useState } from 'react';
import { useFetch } from '@/lib/use-fetch';
import { api, can } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { P } from '@/lib/permissions';
import { PageHeader, Loading, ErrorAlert, EmptyState, Modal, Badge, ConfirmDialog } from '@/components/ui';
import { Field, TextInput, SelectInput, TextArea } from '@/components/form';

type Kind = 'categories' | 'brands' | 'attributes';

const KINDS: Record<Kind, { label: string; base: string; noun: string }> = {
  categories: { label: 'Categories', base: '/api/shop/categories', noun: 'category' },
  brands: { label: 'Brands', base: '/api/shop/brands', noun: 'brand' },
  attributes: { label: 'Attributes', base: '/api/shop/attributes', noun: 'attribute' },
};

type ConfirmState = { title: string; message: string; run: () => Promise<void> } | null;
type FormError = { message: string; code?: string } | null;
type Flash = { tone: 'ok' | 'error'; text: string } | null;

const emptyForm = { name: '', code: '', parent_id: '', description: '', sort_order: '' };

function errText(err: any) {
  return err?.message || 'The request could not be completed.';
}

function RowActions({ canEdit, is_active, onEdit, onDeactivate, onReactivate }: {
  canEdit: boolean; is_active: boolean;
  onEdit: () => void; onDeactivate: () => void; onReactivate: () => void;
}) {
  if (!canEdit) return <td />;
  return (
    <td className="text-end text-nowrap">
      <button className="btn btn-sm btn-outline-secondary me-1" onClick={onEdit}>
        <i className="bi bi-pencil me-1" />Edit
      </button>
      {is_active ? (
        <button className="btn btn-sm btn-outline-danger" onClick={onDeactivate}>
          <i className="bi bi-archive me-1" />Deactivate
        </button>
      ) : (
        <button className="btn btn-sm btn-outline-success" onClick={onReactivate}>
          <i className="bi bi-arrow-counterclockwise me-1" />Reactivate
        </button>
      )}
    </td>
  );
}

export default function ShopTaxonomyPage() {
  const { user } = useAuth();
  const canCreate = can(user, P.shopProductsCreate);
  const canEdit = can(user, P.shopProductsEdit);

  const [tab, setTab] = useState<Kind>('categories');
  const cats = useFetch('/api/shop/categories');
  const brands = useFetch('/api/shop/brands');
  const attrs = useFetch('/api/shop/attributes');
  const lists: Record<Kind, { data: any; error: string; loading: boolean; reload: () => void }> = {
    categories: cats, brands, attributes: attrs,
  };
  const list = lists[tab];

  const [open, setOpen] = useState(false);
  const [modalKind, setModalKind] = useState<Kind>('categories');
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ ...emptyForm });
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<FormError>(null);

  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [flash, setFlash] = useState<Flash>(null);

  function set<K extends keyof typeof form>(key: K, value: any) { setForm((f) => ({ ...f, [key]: value })); }

  function flashOk(text: string) { setFlash({ tone: 'ok', text }); }
  function flashErr(text: string) { setFlash({ tone: 'error', text }); }

  function openCreate(kind: Kind) {
    setModalKind(kind);
    setEditing(null);
    setForm({ ...emptyForm });
    setFormErr(null);
    setFlash(null);
    setOpen(true);
  }

  function openEdit(kind: Kind, row: any) {
    setModalKind(kind);
    setEditing(row);
    setForm({
      name: row.name || '',
      code: row.code || '',
      parent_id: row.parent_id != null ? String(row.parent_id) : '',
      description: row.description || '',
      sort_order: row.sort_order != null ? String(row.sort_order) : '',
    });
    setFormErr(null);
    setFlash(null);
    setOpen(true);
  }

  function reloadKind(kind: Kind) { lists[kind].reload(); }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormErr(null);
    try {
      const meta = KINDS[modalKind];
      const body: any = { name: form.name, code: form.code };
      if (modalKind === 'categories') {
        body.parent_id = form.parent_id ? Number(form.parent_id) : null;
        body.description = form.description || null;
        body.sort_order = form.sort_order === '' ? 0 : Number(form.sort_order);
      }
      if (editing) {
        await api(`${meta.base}/${editing.id}`, { method: 'PATCH', body });
        flashOk(`${meta.noun[0].toUpperCase()}${meta.noun.slice(1)} updated.`);
      } else {
        await api(meta.base, { method: 'POST', body });
        flashOk(`${meta.noun[0].toUpperCase()}${meta.noun.slice(1)} created.`);
      }
      setOpen(false);
      reloadKind(modalKind);
    } catch (err: any) {
      setFormErr({ message: errText(err), code: err?.data?.code });
    } finally {
      setBusy(false);
    }
  }

  function askDeactivate(kind: Kind, row: any) {
    const meta = KINDS[kind];
    setFlash(null);
    setConfirm({
      title: `Deactivate ${meta.noun}`,
      message: `“${row.name}” will be hidden from product forms. Existing products keep it so history and reports stay intact. You can reactivate it later.`,
      run: async () => {
        const res: any = await api(`${meta.base}/${row.id}`, { method: 'DELETE' });
        const count = res?.[kind === 'attributes' ? 'used_values' : 'affected_products'] ?? 0;
        const detail = kind === 'attributes'
          ? `${count} product ${count === 1 ? 'value' : 'values'} still use it.`
          : `${count} ${count === 1 ? 'product' : 'products'} still reference it.`;
        flashOk(`${meta.noun[0].toUpperCase()}${meta.noun.slice(1)} deactivated. ${detail}`);
        reloadKind(kind);
      },
    });
  }

  function reactivate(kind: Kind, row: any) {
    const meta = KINDS[kind];
    setFlash(null);
    api(`${meta.base}/${row.id}`, { method: 'PATCH', body: { is_active: true } })
      .then(() => {
        flashOk(`${meta.noun[0].toUpperCase()}${meta.noun.slice(1)} reactivated.`);
        reloadKind(kind);
      })
      .catch((err: any) => flashErr(errText(err)));
  }

  function goTab(kind: Kind) { setTab(kind); setFlash(null); }

  const items: any[] = list.data?.items || [];
  const parentOptions: any[] = (cats.data?.items || [])
    .filter((c: any) => c.parent_id == null && (!editing || c.id !== editing.id));

  const nounLabel = KINDS[tab].noun;

  return (
    <div>
      <PageHeader title="Catalogue Setup" subtitle="Manage the categories, brands and attributes that organise shop products" />

      <ul className="nav nav-pills mb-3">
        {(Object.keys(KINDS) as Kind[]).map((key) => (
          <li className="nav-item me-1" key={key}>
            <button className={`nav-link py-1 px-3 ${tab === key ? 'active' : ''}`} onClick={() => goTab(key)}>
              {KINDS[key].label}
            </button>
          </li>
        ))}
      </ul>

      {flash && <div className={`alert ${flash.tone === 'ok' ? 'alert-success' : 'alert-danger'} py-2 small`}>{flash.text}</div>}
      {confirm && (
        <ConfirmDialog show={!!confirm} title={confirm.title} message={confirm.message}
          onConfirm={() => confirm?.run()} onClose={() => setConfirm(null)} />
      )}

      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <p className="small text-muted mb-0">
          {tab === 'categories' && 'Categories group products for browsing and reporting. Nested under a parent when needed.'}
          {tab === 'brands' && 'Brands label products across the catalogue and POS.'}
          {tab === 'attributes' && 'Attributes describe configurable product traits such as colour or capacity.'}
        </p>
        {canCreate && (
          <button className="btn btn-primary" onClick={() => openCreate(tab)}>
            <i className="bi bi-plus-circle me-1" /> New {nounLabel.replace(/s$/, '')}
          </button>
        )}
      </div>

      {list.error && <ErrorAlert message={list.error} onRetry={list.reload} />}
      {list.loading && <Loading />}
      {!list.loading && !list.error && items.length === 0 && (
        <EmptyState message={`No ${KINDS[tab].label.toLowerCase()} yet`} icon="bi-tags" />
      )}

      {!list.loading && !list.error && items.length > 0 && (
        <div className="card">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead>
                {tab === 'categories' && (
                  <tr>
                    <th>Name</th><th>Code</th><th>Parent</th>
                    <th className="text-end">Products</th><th className="text-end">Sort</th>
                    <th>Status</th><th />
                  </tr>
                )}
                {tab === 'brands' && (
                  <tr>
                    <th>Name</th><th>Code</th><th className="text-end">Products</th>
                    <th>Status</th><th />
                  </tr>
                )}
                {tab === 'attributes' && (
                  <tr>
                    <th>Name</th><th>Code</th><th>Status</th><th />
                  </tr>
                )}
              </thead>
              <tbody>
                {items.map((row: any) => (
                  <tr key={row.id} className={row.is_active ? '' : 'text-muted'}>
                    <td className="fw-semibold">{row.name}</td>
                    <td className="font-monospace">{row.code}</td>
                    {tab === 'categories' && <td>{row.parent || '—'}</td>}
                    {(tab === 'categories' || tab === 'brands') && (
                      <td className="text-end">{row.product_count ?? 0}</td>
                    )}
                    {tab === 'categories' && <td className="text-end">{row.sort_order ?? 0}</td>}
                    <td><Badge status={row.is_active ? 'active' : 'inactive'} /></td>
                    <RowActions
                      canEdit={canEdit}
                      is_active={!!row.is_active}
                      onEdit={() => openEdit(tab, row)}
                      onDeactivate={() => askDeactivate(tab, row)}
                      onReactivate={() => reactivate(tab, row)}
                    />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal show={open} title={`${editing ? 'Edit' : 'New'} ${KINDS[modalKind].noun}`} onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        <form onSubmit={save}>
          {formErr && (
            <div className="alert alert-danger py-2 small">
              {formErr.message}
              {formErr.code && <span className="font-monospace ms-1">({formErr.code})</span>}
            </div>
          )}
          <div className="row">
            <div className="col-md-6">
              <Field label="Name" required><TextInput value={form.name} onChange={(e) => set('name', e.target.value)} required /></Field>
            </div>
            <div className="col-md-6">
              <Field label="Code" required hint="Unique identifier used in imports and reports">
                <TextInput value={form.code} onChange={(e) => set('code', e.target.value)} required />
              </Field>
            </div>
          </div>
          {modalKind === 'categories' && (
            <>
              <Field label="Parent category">
                <SelectInput value={form.parent_id} onChange={(e) => set('parent_id', e.target.value)}>
                  <option value="">None (top level)</option>
                  {parentOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </SelectInput>
              </Field>
              <Field label="Description"><TextArea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} /></Field>
              <Field label="Sort order" hint="Lower numbers appear first in pickers">
                <TextInput type="number" value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} />
              </Field>
            </>
          )}
        </form>
      </Modal>
    </div>
  );
}
