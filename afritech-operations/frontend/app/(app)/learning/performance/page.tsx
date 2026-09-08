'use client';

import { useState } from 'react';
import { useFetch, todayIso } from '@/lib/use-fetch';
import { api } from '@/lib/api';
import { PageHeader, Loading, ErrorAlert, EmptyState, Badge, Modal } from '@/components/ui';
import { Field, TextInput, SelectInput } from '@/components/form';

export default function InstructorPerformancePage() {
  const currentMonth = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; })();
  const monthEnd = (() => { const d = new Date(); return d.toISOString().slice(0, 10); })();

  const [instructors, setInstructors] = useState<any[]>([]);
  const [start, setStart] = useState(currentMonth);
  const [end, setEnd] = useState(monthEnd);
  const [reloadKey, setReloadKey] = useState(0);
  const { data, error, loading, reload } = useFetch('/api/reports/instructor-performance', [start, end, reloadKey], { start, end });
  const [open, setOpen] = useState(false);
  const [selIns, setSelIns] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [error2, setError2] = useState('');
  const [result, setResult] = useState<any | null>(null);

  const scores = data?.scores || [];

  async function openCalc() {
    setError2('');
    setResult(null);
    const d: any = await api('/api/instructors?per_page=500').catch(() => ({ items: [] }));
    setInstructors(d.items || []);
    setOpen(true);
  }

  async function calculate() {
    if (!selIns) return;
    setBusy(true);
    setError2('');
    try {
      const d: any = await api(`/api/instructors/${selIns.id}/performance/calculate`, {
        method: 'POST',
        body: { period_start: start, period_end: end },
      });
      setResult(d.score);
      setOpen(false);
      setReloadKey((k) => k + 1);
    } catch (err: any) {
      setError2(err.message);
    } finally {
      setBusy(false);
    }
  }

  function ratingColor(rating: string) {
    if (rating === 'excellent') return 'text-success';
    if (rating === 'good') return 'text-primary';
    if (rating === 'fair') return 'text-warning';
    return 'text-danger';
  }

  return (
    <div>
      <PageHeader title="Instructor Performance" subtitle="Weighted performance scores per instructor"
        actions={
          <button className="btn btn-primary" onClick={openCalc}><i className="bi bi-calculator me-1" /> Calculate score</button>
        } />

      <div className="card mb-3">
        <div className="card-body d-flex flex-wrap gap-2 align-items-center">
          <span className="small text-muted">Period</span>
          <input type="date" className="form-control form-control-sm" style={{ width: 160 }} value={start} onChange={(e) => setStart(e.target.value)} />
          <span className="small text-muted">→</span>
          <input type="date" className="form-control form-control-sm" style={{ width: 160 }} value={end} onChange={(e) => setEnd(e.target.value)} />
          <button className="btn btn-sm btn-outline-secondary" onClick={reload}><i className="bi bi-arrow-clockwise" /></button>
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={reload} />}
      {loading && <Loading />}
      {!loading && !error && scores.length === 0 && <EmptyState message="No scores calculated for this period" />}

      {!loading && !error && scores.length > 0 && (
        <div className="row g-3">
          {scores.map((s: any) => (
            <div className="col-md-6 col-xl-4" key={s.id}>
              <div className="card h-100">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <h6 className="fw-semibold mb-0">{s.employee_name}</h6>
                      <div className="small text-muted">{s.period_start} → {s.period_end}</div>
                    </div>
                    <div className="text-end">
                      <div className={`fs-4 fw-bold ${ratingColor(s.rating)}`}>{s.overall_score}</div>
                      <span className="text-capitalize small text-muted">{s.rating}</span>
                    </div>
                  </div>
                  <hr />
                  <div>
                    {(s.components || []).map((c: any) => (
                      <div key={c.id} className="d-flex justify-content-between align-items-center py-1 small">
                        <span className="text-muted">{c.name}</span>
                        <span className="fw-semibold">{c.score} <span className="text-muted fw-normal">× {Math.round(c.weight * 100) / 100} = {c.weighted_score}</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal show={open} title="Calculate instructor score" onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={calculate} disabled={busy || !selIns}>{busy ? 'Calculating…' : 'Calculate'}</button>
          </>
        }
      >
        {error2 && <div className="alert alert-danger py-2 small">{error2}</div>}
        <Field label="Instructor" required>
          <SelectInput value={selIns?.id || ''} onChange={(e) => setSelIns(instructors.find((i) => String(i.id) === e.target.value) || null)} required>
            <option value="">Select instructor…</option>
            {instructors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </SelectInput>
        </Field>
        <div className="row">
          <div className="col-md-6"><Field label="Period start"><TextInput type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field></div>
          <div className="col-md-6"><Field label="Period end"><TextInput type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field></div>
        </div>
        <div className="alert alert-info small mb-0">
          Score = Σ(component score × weight). Weights: teaching delivery 25%, learner progress 25%, weekly planning 15%, assignment management 15%, attendance 10%, reporting 10%.
        </div>
      </Modal>

      {result && (
        <Modal show={!!result} title="Score calculated" onClose={() => setResult(null)}
          footer={<button className="btn btn-primary" onClick={() => setResult(null)}>Done</button>}
        >
          <div className="text-center mb-3">
            <div className="display-4 fw-bold">{result.overall_score}</div>
            <span className={`text-capitalize ${ratingColor(result.rating)}`}>{result.rating}</span>
          </div>
          {(result.components || []).map((c: any) => (
            <div key={c.id} className="d-flex justify-content-between py-1 border-bottom small">
              <span className="text-muted">{c.name}</span>
              <span>{c.weighted_score}</span>
            </div>
          ))}
        </Modal>
      )}
    </div>
  );
}