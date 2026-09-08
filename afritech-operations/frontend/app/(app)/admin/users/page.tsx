'use client';

import { useState } from 'react';
import { useFetch } from '@/lib/use-fetch';
import { api, fmtDateTime } from '@/lib/api';
import { PageHeader, Loading, ErrorAlert, EmptyState, Pagination, Badge, Modal, ConfirmDialog } from '@/components/ui';
import { Field, TextInput } from '@/components/form';

export default function UsersPage() {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useFetch('/api/users', [page], { page, per_page: 15 });
  const [rolesData, setRolesData] = useState<any[]>([]);
  const [perms, setPerms] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ email: '', password: '', is_active: true, is_super_admin: false, roles: [] as string[] });
  const [busy, setBusy] = useState(false);
  const [error2, setError2] = useState('');
  const [deactUser, setDeactUser] = useState<any | null>(null);

  const items = data?.items || [];

  async function loadMeta() {
    const [r, p] = await Promise.all([
      api('/api/users/roles').catch(() => ({ roles: [] })),
      api('/api/users/permissions').catch(() => ({ permissions: [] })),
    ]);
    setRolesData(r.roles || []);
    setPerms(p.permissions || []);
  }

  async function openCreate() {
    setEditing(null);
    await loadMeta();
    setForm({ email: '', password: '', is_active: true, is_super_admin: false, roles: [] as string[] });
    setError2('');
    setOpen(true);
  }

  async function openEdit(u: any) {
    setEditing(u);
    await loadMeta();
    setForm({ email: u.email, password: '', is_active: u.is_active, is_super_admin: u.is_super_admin, roles: u.role_codes || [] });
    setError2('');
    setOpen(true);
  }

  function set<K extends keyof typeof form>(key: K, value: any) { setForm((f) => ({ ...f, [key]: value })); }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError2('');
    try {
      if (editing) {
        const body: any = { is_active: form.is_active, is_super_admin: form.is_super_admin, roles: form.roles };
        if (form.password) body.password = form.password;
        await api(`/api/users/${editing.id}`, { method: 'PUT', body });
      } else {
        await api('/api/users', { method: 'POST', body: { email: form.email, password: form.password, is_active: form.is_active, is_super_admin: form.is_super_admin, roles: form.roles } });
      }
      setOpen(false);
      reload();
    } catch (err: any) {
      setError2(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    await api(`/api/users/${deactUser.id}`, { method: 'DELETE' });
    setDeactUser(null);
    reload();
  }

  return (
    <div>
      <PageHeader title="Users & Roles" subtitle="System user accounts and roles"
        actions={<button className="btn btn-primary" onClick={openCreate}><i className="bi bi-person-plus me-1" /> New user</button>} />

      {error && <ErrorAlert message={error} onRetry={reload} />}
      {loading && <Loading />}
      {!loading && !error && items.length === 0 && <EmptyState message="No users" />}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="card">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr><th>Email</th><th>Roles</th><th>Last login</th><th>Status</th><th /></tr>
                </thead>
                <tbody>
                  {items.map((u: any) => (
                    <tr key={u.id}>
                      <td className="fw-semibold">{u.email} {u.is_super_admin && <span className="badge border bg-danger-subtle text-danger border-danger-subtle ms-1">Super admin</span>}</td>
                      <td>{(u.role_codes || []).map((r: string) => <Badge key={r} status={r.replace(/_/g, ' ')} />)}</td>
                      <td>{u.last_login_at ? fmtDateTime(u.last_login_at) : '—'}</td>
                      <td><Badge status={u.is_active ? 'active' : 'inactive'} /></td>
                      <td className="text-end">
                        <button className="btn btn-sm btn-outline-secondary me-1" onClick={() => openEdit(u)}><i className="bi bi-pencil" /></button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => setDeactUser(u)}><i className="bi bi-person-x" /></button>
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

      <Modal show={open} title={editing ? `Edit user — ${editing.email}` : 'New user'} onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        {error2 && <div className="alert alert-danger py-2 small">{error2}</div>}
        <form onSubmit={save}>
          <Field label="Email" required><TextInput type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required disabled={!!editing} /></Field>
          <Field label={editing ? 'New password (leave blank to keep current)' : 'Password'} required={!editing}>
            <TextInput type="password" value={form.password} onChange={(e) => set('password', e.target.value)} required={!editing} minLength={8} />
          </Field>
          <Field label="Roles">
            <div className="border rounded-3 p-2" style={{ maxHeight: 180, overflowY: 'auto' }}>
              {rolesData.map((r) => (
                <div className="form-check" key={r.id}>
                  <input className="form-check-input" type="checkbox" id={`urole-${r.id}`}
                    checked={(form.roles || []).includes(r.code)}
                    onChange={(e) => {
                      const cur = form.roles || [];
                      set('roles', e.target.checked ? [...cur, r.code] : cur.filter((c: string) => c !== r.code));
                    }} />
                  <label className="form-check-label small" htmlFor={`urole-${r.id}`}>
                    {r.name} <span className="text-muted">({r.code})</span>
                    {r.permissions?.length > 0 && <span className="text-muted d-block ps-3" title={r.permissions.join(', ')}>{r.permissions.length} permissions</span>}
                  </label>
                </div>
              ))}
            </div>
          </Field>
          <div className="form-check form-switch">
            <input className="form-check-input" type="checkbox" id="uActive" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
            <label className="form-check-label" htmlFor="uActive">Active</label>
          </div>
          <div className="form-check form-switch">
            <input className="form-check-input" type="checkbox" id="uSuper" checked={form.is_super_admin} onChange={(e) => set('is_super_admin', e.target.checked)} />
            <label className="form-check-label" htmlFor="uSuper">Super admin (unrestricted access)</label>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        show={!!deactUser}
        title="Deactivate user"
        message={`Deactivate ${deactUser?.email}? They will no longer be able to sign in.`}
        onConfirm={deactivate}
        onClose={() => setDeactUser(null)}
      />
    </div>
  );
}