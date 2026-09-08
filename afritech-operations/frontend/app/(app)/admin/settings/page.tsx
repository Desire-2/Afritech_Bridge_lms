'use client';

import { useEffect, useState } from 'react';
import { useFetch } from '@/lib/use-fetch';
import { api } from '@/lib/api';
import { PageHeader, Loading, ErrorAlert } from '@/components/ui';

export default function SettingsPage() {
  const { data, error, loading, reload } = useFetch<any>('/api/settings');
  const { data: metrics, reload: reloadMetrics } = useFetch<any>('/api/settings/performance-metrics');
  const { data: pms, reload: reloadPms } = useFetch<any>('/api/settings/payment-methods');
  const [draft, setDraft] = useState<any>(null);
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error2, setError2] = useState('');
  const [saved, setSaved] = useState('');

  useEffect(() => { if (data) setDraft(data); }, [data]);
  useEffect(() => {
    if (metrics?.metrics?.length) {
      const w: Record<string, number> = {};
      metrics.metrics.forEach((m: any) => { w[m.code] = Number(m.current_weight ?? m.default_weight); });
      setWeights(w);
    }
  }, [metrics]);

  if (error) return <ErrorAlert message={error} />;
  if (loading) return <Loading />;

  function setValue(group: string, key: string, value: any) {
    setDraft((d: any) => ({ ...d, groups: { ...d.groups, [group]: { ...d.groups[group], [key]: value } } }));
  }

  async function save() {
    setBusy(true);
    setError2('');
    setSaved('');
    try {
      await api('/api/settings', { method: 'PUT', body: draft.groups });
      setSaved('Settings saved');
      reload();
    } catch (err: any) {
      setError2(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveMetrics() {
    const body = { metrics: (metrics?.metrics || []).map((m: any) => ({ code: m.code, weight: Number(weights[m.code] ?? m.default_weight) })) };
    setBusy(true);
    setSaved('');
    try {
      await api('/api/settings/performance-metrics', { method: 'PUT', body });
      await reloadMetrics();
      await reload();
      setSaved('Performance metric weights saved');
    } catch (err: any) {
      setError2(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function togglePaymentMethod(p: any) {
    const body = { payment_methods: (pms?.payment_methods || []).map((x: any) => ({ code: x.code, is_active: x.id === p.id ? !p.is_active : x.is_active })) };
    try {
      await api('/api/settings/payment-methods', { method: 'PUT', body });
      await reloadPms();
    } catch (err: any) {
      setError2(err.message);
    }
  }

  const groups = draft?.groups || {};

  return (
    <div>
      <PageHeader title="Settings" subtitle="Business configuration"
        actions={draft && <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button>} />

      {error2 && <div className="alert alert-danger py-2 small">{error2}</div>}
      {saved && <div className="alert alert-success py-2 small">{saved}</div>}

      <div className="row g-4">
        <div className="col-lg-7">
          <div className="card">
            <div className="card-body">
              <h6 className="fw-semibold mb-3">Business settings</h6>
              <div className="accordion" id="settings-accordion">
                {Object.entries(groups).map(([group, values]: [string, any]) => (
                  <div className="accordion-item" key={group}>
                    <h2 className="accordion-header">
                      <button className="accordion-button collapsed py-2" type="button" data-bs-toggle="collapse" data-bs-target={`#acc-${group}`}>
                        <span className="text-capitalize fw-semibold">{group.replace(/_/g, ' ')}</span>
                      </button>
                    </h2>
                    <div id={`acc-${group}`} className="accordion-collapse collapse">
                      <div className="accordion-body">
                        <div className="row">
                          {Object.entries(values || {}).map(([key, value]: [string, any]) => (
                            <div className="col-md-6" key={key}>
                              <label className="form-label small fw-semibold text-capitalize">{key.replace(/_/g, ' ')}</label>
                              {typeof value === 'boolean' ? (
                                <div className="form-check form-switch mb-3">
                                  <input className="form-check-input" type="checkbox" id={`s-${group}-${key}`} checked={value} onChange={(e) => setValue(group, key, e.target.checked)} />
                                </div>
                              ) : typeof value === 'number' ? (
                                <input className="form-control mb-3" type="number" step="any" value={value} onChange={(e) => setValue(group, key, e.target.value === '' ? 0 : Number(e.target.value))} />
                              ) : (
                                <input className="form-control mb-3" type="text" value={value ?? ''} onChange={(e) => setValue(group, key, e.target.value)} />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-5">
          <div className="card mb-3">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="fw-semibold mb-0">Performance metric weights</h6>
                <button className="btn btn-sm btn-outline-primary" onClick={saveMetrics} disabled={busy}><i className="bi bi-check2 me-1" />Save</button>
              </div>
              <p className="small text-muted">Adjust component weights between 0 and 50. Must sum to 100.</p>
              {(metrics?.metrics || []).map((m: any) => (
                <div className="mb-3" key={m.id}>
                  <div className="d-flex justify-content-between small mb-1">
                    <span>{m.name}</span>
                    <input
                      type="number" className="form-control form-control-sm d-inline-block" style={{ width: 70 }}
                      min="0" max="50" step="1"
                      value={weights[m.code] ?? m.default_weight}
                      onChange={(e) => setWeights((w) => ({ ...w, [m.code]: Number(e.target.value) }))}
                    />
                  </div>
                  <input
                    type="range" className="form-range" min="0" max="50" step="1"
                    value={weights[m.code] ?? m.default_weight}
                    onChange={(e) => setWeights((w) => ({ ...w, [m.code]: Number(e.target.value) }))}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <h6 className="fw-semibold mb-2">Payment methods</h6>
              {(pms?.payment_methods || []).map((p: any) => (
                <button key={p.id} className="w-100 text-start d-flex justify-content-between py-1 border-bottom small bg-transparent border-0" onClick={() => togglePaymentMethod(p)}>
                  <span>{p.name} <span className="text-muted">({p.code})</span></span>
                  <span className={p.is_active ? 'text-success' : 'text-danger'}>{p.is_active ? 'active' : 'inactive'}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}