'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { PageHeader, Loading, ErrorAlert, Badge } from '@/components/ui';
import { Field, TextInput } from '@/components/form';

export default function IntegrationPage() {
  const [config, setConfig] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState<any>({ base_url: '', api_key: '' });
  const [busy, setBusy] = useState(false);
  const [busy2, setBusy2] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [mapping, setMapping] = useState<any | null>(null);
  const [showMapping, setShowMapping] = useState(false);

  async function reload() {
    setLoading(true);
    setError('');
    try {
      const d: any = await api('/api/integrations/lms/config');
      setConfig(d.config);
      setForm((f) => ({ ...f, base_url: d.config.base_url || '' }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading && !config) reload();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const d: any = await api('/api/integrations/lms/config', { method: 'POST', body: { base_url: form.base_url || undefined, api_key: form.api_key || undefined } });
      setConfig(d.config);
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function health() {
    setBusy2(true);
    setResult(null);
    setError('');
    try {
      const d: any = await api('/api/integrations/lms/health-check', { method: 'POST' });
      setResult({ ok: true, body: d });
    } catch (err: any) {
      setResult({ ok: false, body: err.data });
    } finally {
      setBusy2(false);
    }
  }

  async function sync() {
    setBusy2(true);
    setResult(null);
    setError('');
    try {
      const d: any = await api('/api/integrations/lms/sync-courses', { method: 'POST' });
      setResult({ ok: true, body: d });
    } catch (err: any) {
      setResult({ ok: false, body: err.data });
    } finally {
      setBusy2(false);
    }
  }

  async function loadMapping() {
    setBusy2(true);
    try {
      const d: any = await api('/api/integrations/lms/mapping');
      setMapping(d);
      setShowMapping(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy2(false);
    }
  }

  return (
    <div>
      <PageHeader title="LMS Integration" subtitle="Connect to the AfriTech Bridge LMS" />

      {error && <ErrorAlert message={error} />}
      {!config && loading && <Loading />}

      {config && (
        <div className="row g-4">
          <div className="col-lg-6">
            <form className="card" onSubmit={save}>
              <div className="card-body">
                <h6 className="fw-semibold mb-3">Connection settings</h6>
                <Field label="Integration" >
                  <Badge status={config.enabled ? 'active' : 'inactive'} />
                </Field>
                <Field label="LMS API base URL">
                  <TextInput value={form.base_url} onChange={(e) => setForm((f) => ({ ...f, base_url: e.target.value }))} placeholder="https://lms.example.com" />
                </Field>
                <Field label="API key">
                  <TextInput type="password" value={form.api_key} onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))} placeholder={config.has_api_key ? '•••••••• (stored)' : 'Enter API key'} />
                </Field>
                <div className="form-check form-switch mb-3">
                  <input className="form-check-input" type="checkbox" id="enabled" checked={config.enabled} onChange={async (e) => {
                    await api('/api/integrations/lms/config', { method: 'POST', body: { enabled: e.target.checked } });
                    reload();
                  }} />
                  <label className="form-check-label" htmlFor="enabled">Enable integration</label>
                </div>
                <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>

          <div className="col-lg-6">
            <div className="card mb-3">
              <div className="card-body">
                <h6 className="fw-semibold mb-3">Status & sync</h6>
                <div className="d-flex justify-content-between py-1 border-bottom small">
                  <span className="text-muted">Last sync</span>
                  <span>{config.last_sync_at || 'Never'}</span>
                </div>
                <div className="d-flex justify-content-between py-1 border-bottom small">
                  <span className="text-muted">Last sync status</span>
                  <span>{config.last_sync_status || '—'}</span>
                </div>
                <div className="d-flex gap-2 mt-3">
                  <button className="btn btn-sm btn-outline-primary" onClick={health} disabled={busy2}><i className="bi bi-activity me-1" />Health check</button>
                  <button className="btn btn-sm btn-outline-success" onClick={sync} disabled={busy2}><i className="bi bi-arrow-repeat me-1" />Sync courses</button>
                  <button className="btn btn-sm btn-outline-secondary" onClick={loadMapping} disabled={busy2}><i className="bi bi-diagram-3 me-1" />View mapping</button>
                </div>
              </div>
            </div>

            {result && (
              <div className={`card mb-3 ${result.ok ? 'border-success' : 'border-danger'}`}>
                <div className="card-body">
                  <div className={`fw-semibold ${result.ok ? 'text-success' : 'text-danger'}`}>
                    {result.body?.reachable ? 'LMS reachable' : result.body?.message || (result.ok ? 'Done' : 'Failed')}
                  </div>
                  <pre className="small my-2 text-muted mb-0" style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(result.body, null, 2)}</pre>
                </div>
              </div>
            )}

            {showMapping && mapping && (
              <div className="card">
                <div className="card-body">
                  <h6 className="fw-semibold">Current mapping</h6>
                  <div className="small text-muted mb-1">{mapping.courses?.length || 0} courses</div>
                  <div className="small text-muted mb-1">{mapping.cohorts?.length || 0} cohorts</div>
                  <div className="small text-muted mb-2">{mapping.learners?.length || 0} learners</div>
                  <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                    {(mapping.courses || []).map((c: any) => (
                      <div key={c.local_id} className="d-flex justify-content-between border-bottom py-1 small">
                        <span>{c.name}</span>
                        <span className="text-muted">local #{c.local_id} · lms #{c.lms_id}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}