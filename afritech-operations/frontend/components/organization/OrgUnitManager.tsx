'use client';

import { useState } from 'react';
import { api, can, fmtDate } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useFetch } from '@/lib/use-fetch';
import { P } from '@/lib/permissions';
import {
  PageHeader, Loading, ErrorAlert, EmptyState, Pagination, Modal,
  ConfirmDialog, Badge, StatCard,
} from '@/components/ui';
import { Field, TextInput, SelectInput, TextArea } from '@/components/form';

type Kind = 'branches' | 'departments';
type Status = 'all' | 'active' | 'inactive';
type ConfirmState = { title: string; message: string; run: () => Promise<void> } | null;
type Flash = { tone: 'ok' | 'error'; text: string } | null;

const CONFIG: Record<Kind, {
  noun: string;
  plural: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  hint: string;
  permission: string;
  icon: string;
}> = {
  branches: {
    noun: 'branch',
    plural: 'branches',
    eyebrow: 'Administration · Organization',
    title: 'Branches',
    subtitle: 'Manage the locations staff are assigned to. Branch and department are independent.',
    hint: 'Short codes are normalized to uppercase and used in exports and reports.',
    permission: P.branchesManage,
    icon: 'bi-building',
  },
  departments: {
    noun: 'department',
    plural: 'departments',
    eyebrow: 'Administration · Organization',
    title: 'Departments',
    subtitle: 'Manage functional teams. An employee carries both a branch and a department assignment.',
    hint: 'Short codes are normalized to uppercase and used in exports and reports.',
    permission: P.departmentsManage,
    icon: 'bi-diagram-3',
  },
};

const emptyForm = {
  name: '', code: '', city: '', address: '', phone: '', description: '', is_active: true,
};

function errText(err: any) {
  return err?.message || 'The request could not be completed.';
}

/** One table-driven screen for both organization dimensions. */
export default function OrgUnitManager({ kind }: { kind: Kind }) {
  const cfg = CONFIG[kind];
  const { user } = useAuth();
  const canManage = can(user, cfg.permission);

  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<Status>('all');
  const list = useFetch(`/api/organization/${kind}`, [page, q, status], {
    page,
    per_page: 15,
    search: q || undefined,
    is_active: status === 'all' ? undefined : status,
  });
  const summary = useFetch('/api/organization/summary');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ ...emptyForm });
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<{ message: string; code?: string } | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [flash, setFlash] = useState<Flash>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);

  const items: any[] = list.data?.items || [];

  function set(key: string, value: any) { setForm((f) => ({ ...f, [key]: value })); }
  function flashOk(text: string) { setFlash({ tone: 'ok', text }); }
  function flashErr(text: string) { setFlash({ tone: 'error', text }); }
  function reloadAll() { list.reload(); summary.reload(); }

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm });
    setFormErr(null);
    setFlash(null);
    setOpen(true);
  }

  function openEdit(row: any) {
    setEditing(row);
    setForm({
      name: row.name || '',
      code: row.code || '',
      city: row.city || '',
      address: row.address || '',
      phone: row.phone || '',
      description: row.description || '',
      is_active: !!row.is_active,
    });
    setFormErr(null);
    setFlash(null);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormErr(null);
    try {
      const body: any = { name: form.name, code: form.code, is_active: form.is_active };
      if (kind === 'branches') {
        body.city = form.city || null;
        body.address = form.address || null;
        body.phone = form.phone || null;
      } else {
        body.description = form.description || null;
      }
      if (editing) {
        await api(`/api/organization/${kind}/${editing.id}`, { method: 'PATCH', body });
        flashOk(`${cfg.noun[0].toUpperCase()}${cfg.noun.slice(1)} updated.`);
      } else {
        await api(`/api/organization/${kind}`, { method: 'POST', body });
        flashOk(`${cfg.noun[0].toUpperCase()}${cfg.noun.slice(1)} created.`);
      }
      setOpen(false);
      reloadAll();
    } catch (err: any) {
      setFormErr({ message: errText(err), code: err?.data?.code });
    } finally {
      setBusy(false);
    }
  }

  function askArchive(row: any) {
    setFlash(null);
    setConfirm({
      title: `Archive ${cfg.noun}`,
      message: `“${row.name}” will be hidden from employee and scheduling pickers. ${row.employee_count || 0} employee${row.employee_count === 1 ? '' : 's'} currently reference it; their assignments stay intact. You can restore it later.`,
      run: async () => {
        await api(`/api/organization/${kind}/${row.id}`, { method: 'DELETE' });
        flashOk(`${cfg.noun[0].toUpperCase()}${cfg.noun.slice(1)} archived. Existing assignments were preserved.`);
        reloadAll();
      },
    });
  }

  async function restore(row: any) {
    setFlash(null);
    try {
      await api(`/api/organization/${kind}/${row.id}/restore`, { method: 'POST' });
      flashOk(`${cfg.noun[0].toUpperCase()}${cfg.noun.slice(1)} restored.`);
      reloadAll();
    } catch (err: any) {
      flashErr(errText(err));
    }
  }

  async function openDetail(row: any) {
    setDetail(null);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const res: any = await api(`/api/organization/${kind}/${row.id}`);
      setDetail(res[kind === 'branches' ? 'branch' : 'department']);
    } catch (err: any) {
      flashErr(errText(err));
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }

  const otherKind: Kind = kind === 'branches' ? 'departments' : 'branches';
  const ownKey = kind === 'branches' ? 'branches' : 'departments';
  const activeKey = kind === 'branches' ? 'active_branches' : 'active_departments';

  if (!canManage) {
    return (
      <div>
        <PageHeader title={cfg.title} eyebrow={cfg.eyebrow} />
        <ErrorAlert message={`You need ${cfg.permission} to manage ${cfg.plural}.`} />
      </div>
    );
  }

  return (
    <div className="d-flex flex-column gap-3">
      <PageHeader
        eyebrow={cfg.eyebrow}
        title={cfg.title}
        subtitle={cfg.subtitle}
        actions={
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <i className="bi bi-plus-lg me-1" aria-hidden="true" /> New {cfg.noun}
          </button>
        }
      />

      <div className="row g-2">
        <div className="col-md-6 col-xl-3">
          <StatCard label={`Total ${cfg.plural}`} value={summary.data?.[ownKey] ?? '—'} sub="All records" tone="primary" icon={cfg.icon} />
        </div>
        <div className="col-md-6 col-xl-3">
          <StatCard label="Active" value={summary.data?.[activeKey] ?? '—'} sub="Available in pickers" tone="success" icon="bi-check2-circle" />
        </div>
        <div className="col-md-6 col-xl-3">
          <StatCard label={`Total ${otherKind}`} value={summary.data?.[otherKind] ?? '—'} sub="Independent dimension" tone="warning" icon={CONFIG[otherKind].icon} />
        </div>
        <div className="col-md-6 col-xl-3">
          <StatCard label="Employees" value={summary.data?.employees ?? '—'} sub={`${summary.data?.unassigned_employees ?? 0} without either assignment`} tone="primary" icon="bi-people" />
        </div>
      </div>

      <div className="filter-bar">
        <div className="row g-2 align-items-end">
          <div className="col-md-5 col-lg-4">
            <label className="form-label" htmlFor="org-search">Search</label>
            <div className="input-group input-group-sm">
              <span className="input-group-text"><i className="bi bi-search" aria-hidden="true" /></span>
              <input id="org-search" className="form-control" placeholder="Name, code, city…"
                value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
            </div>
          </div>
          <div className="col-md-4 col-lg-3">
            <label className="form-label" htmlFor="org-status">Status</label>
            <SelectInput id="org-status" className="form-select-sm" value={status}
              onChange={(e) => { setStatus(e.target.value as Status); setPage(1); }}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Archived</option>
            </SelectInput>
          </div>
          <div className="col-md-3 col-lg-5">
            <div className="small text-muted text-md-end">
              <strong className="text-body">{list.data?.total ?? 0}</strong> {cfg.plural} in view
            </div>
          </div>
        </div>
      </div>

      {flash && <div className={`alert ${flash.tone === 'ok' ? 'alert-success' : 'alert-danger'} py-2 small`} role="status">{flash.text}</div>}
      {confirm && (
        <ConfirmDialog show title={confirm.title} message={confirm.message}
          onConfirm={() => confirm.run()} onClose={() => setConfirm(null)} confirmLabel="Archive" />
      )}

      {list.error && <ErrorAlert message={list.error} onRetry={list.reload} />}
      {list.loading && <Loading />}
      {!list.loading && !list.error && items.length === 0 && (
        <EmptyState message={`No ${cfg.plural} found`} hint="Create one or clear the current filters."
          icon={cfg.icon}
          action={<button className="btn btn-sm btn-outline-primary" onClick={openCreate}>New {cfg.noun}</button>} />
      )}

      {!list.loading && !list.error && items.length > 0 && (
        <>
          <div className="data-table-wrap">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Code</th>
                    <th>{kind === 'branches' ? 'City' : 'Description'}</th>
                    <th className="text-end">People</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row: any) => (
                    <tr key={row.id} className={row.is_active ? '' : 'text-muted'}>
                      <td className="fw-semibold">{row.name}</td>
                      <td className="font-monospace">{row.code}</td>
                      <td>{kind === 'branches' ? (row.city || '—') : (row.description || '—')}</td>
                      <td className="text-end">{row.employee_count ?? 0}</td>
                      <td><Badge status={row.is_active ? 'active' : 'inactive'} label={row.is_active ? 'Active' : 'Archived'} /></td>
                      <td className="small text-muted text-nowrap">{fmtDate(row.updated_at)}</td>
                      <td className="text-end text-nowrap">
                        <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => openDetail(row)}
                          aria-label={`View details for ${row.name}`}>
                          <i className="bi bi-eye" aria-hidden="true" />
                        </button>
                        <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => openEdit(row)}
                          aria-label={`Edit ${row.name}`}>
                          <i className="bi bi-pencil" aria-hidden="true" />
                        </button>
                        {row.is_active ? (
                          <button className="btn btn-sm btn-outline-danger" onClick={() => askArchive(row)}
                            aria-label={`Archive ${row.name}`}>
                            <i className="bi bi-archive" aria-hidden="true" />
                          </button>
                        ) : (
                          <button className="btn btn-sm btn-outline-success" onClick={() => restore(row)}
                            aria-label={`Restore ${row.name}`}>
                            <i className="bi bi-arrow-counterclockwise" aria-hidden="true" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination page={list.data?.page || page} pages={list.data?.pages || 0}
            onPage={setPage} total={list.data?.total} recordsLabel={cfg.plural} />
        </>
      )}

      <Modal show={open} title={`${editing ? 'Edit' : 'New'} ${cfg.noun}`} onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={busy}>
              {busy && <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />}
              {busy ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <form onSubmit={save}>
          {formErr && (
            <div className="alert alert-danger py-2 small" role="alert">
              {formErr.message}
              {formErr.code && <span className="font-monospace ms-1">({formErr.code})</span>}
            </div>
          )}
          <p className="small text-muted">{cfg.hint}</p>
          <div className="row">
            <div className="col-md-7">
              <Field label="Name" required htmlFor="org-name">
                <TextInput id="org-name" value={form.name} onChange={(e) => set('name', e.target.value)} required maxLength={128} />
              </Field>
            </div>
            <div className="col-md-5">
              <Field label="Code" required htmlFor="org-code">
                <TextInput id="org-code" className="font-monospace" value={form.code}
                  onChange={(e) => set('code', e.target.value)} required maxLength={32} />
              </Field>
            </div>
          </div>
          {kind === 'branches' ? (
            <>
              <Field label="City" htmlFor="org-city">
                <TextInput id="org-city" value={form.city} onChange={(e) => set('city', e.target.value)} maxLength={128} />
              </Field>
              <Field label="Address" htmlFor="org-address">
                <TextInput id="org-address" value={form.address} onChange={(e) => set('address', e.target.value)} maxLength={255} />
              </Field>
              <Field label="Phone" htmlFor="org-phone">
                <TextInput id="org-phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} maxLength={32} />
              </Field>
            </>
          ) : (
            <Field label="Description" htmlFor="org-description">
              <TextArea id="org-description" rows={2} value={form.description}
                onChange={(e) => set('description', e.target.value)} maxLength={255} />
            </Field>
          )}
          <Field label="Status" htmlFor="org-form-status" hint="Archived records stay on historical documents but disappear from pickers.">
            <SelectInput id="org-form-status" value={form.is_active ? 'active' : 'inactive'}
              onChange={(e) => set('is_active', e.target.value === 'active')}>
              <option value="active">Active</option>
              <option value="inactive">Archived</option>
            </SelectInput>
          </Field>
        </form>
      </Modal>

      <Modal show={detailOpen} title={detail ? `${cfg.noun[0].toUpperCase()}${cfg.noun.slice(1)} details` : `${cfg.noun[0].toUpperCase()}${cfg.noun.slice(1)}`}
        onClose={() => setDetailOpen(false)}
        footer={<button className="btn btn-outline-secondary" onClick={() => setDetailOpen(false)}>Close</button>}
      >
        {detailLoading && <Loading label="Loading details…" />}
        {!detailLoading && detail && (
          <div>
            <div className="d-flex align-items-center gap-2 mb-3">
              <h5 className="mb-0">{detail.name}</h5>
              <Badge status={detail.is_active ? 'active' : 'inactive'} label={detail.is_active ? 'Active' : 'Archived'} />
            </div>
            <dl className="row mb-3 small">
              <dt className="col-sm-3 text-muted">Code</dt><dd className="col-sm-9 font-monospace">{detail.code}</dd>
              {kind === 'branches' && (
                <>
                  <dt className="col-sm-3 text-muted">City</dt><dd className="col-sm-9">{detail.city || '—'}</dd>
                  <dt className="col-sm-3 text-muted">Address</dt><dd className="col-sm-9">{detail.address || '—'}</dd>
                  <dt className="col-sm-3 text-muted">Phone</dt><dd className="col-sm-9">{detail.phone || '—'}</dd>
                </>
              )}
              {kind === 'departments' && (
                <>
                  <dt className="col-sm-3 text-muted">Description</dt><dd className="col-sm-9">{detail.description || '—'}</dd>
                </>
              )}
              <dt className="col-sm-3 text-muted">People</dt><dd className="col-sm-9">{detail.employee_count ?? 0}</dd>
              <dt className="col-sm-3 text-muted">Created</dt><dd className="col-sm-9">{fmtDate(detail.created_at)}</dd>
              <dt className="col-sm-3 text-muted">Updated</dt><dd className="col-sm-9">{fmtDate(detail.updated_at)}</dd>
            </dl>
            <hr />
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="mb-0">Recent employees</h6>
              <span className="small text-muted">Latest {detail.recent_employees?.length || 0} of {detail.employee_count ?? 0}</span>
            </div>
            {!detail.recent_employees?.length ? (
              <p className="small text-muted mb-0">No employee is assigned here yet.</p>
            ) : (
              <ul className="list-unstyled mb-0">
                {detail.recent_employees.map((e: any) => (
                  <li key={e.id} className="list-row d-flex justify-content-between gap-2 py-2">
                    <span className="fw-semibold">{e.name}</span>
                    <span className="small text-muted">{e.position || '—'}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
