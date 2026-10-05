'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useFetch, todayIso, yearAgoIso } from '@/lib/use-fetch';
import { api, fmtMoney, fmtDate, downloadFile } from '@/lib/api';
import { PageHeader, Loading, ErrorAlert, EmptyState, Badge, StatCard } from '@/components/ui';
import { DateRange } from '@/components/form';

export default function RevenuePage() {
  const [start, setStart] = useState(yearAgoIso());
  const [end, setEnd] = useState(todayIso());
  const [status, setStatus] = useState('completed');
  const [exporting, setExporting] = useState('');
  const [exportErr, setExportErr] = useState('');
  const { data, error, loading } = useFetch<any>('/api/reports/revenue', [start, end, status], { start, end, status: status === 'all' ? undefined : status });

  // window.open() sends no bearer token, so these downloads 401'd.
  async function exportFile(kind: 'csv' | 'excel') {
    setExportErr('');
    setExporting(kind);
    try {
      const url = kind === 'csv'
        ? `/api/reports/export/csv?report=revenue&start=${start}&end=${end}`
        : `/api/reports/export/excel?report=revenue&start=${start}&end=${end}`;
      await downloadFile(url, `revenue_${start}_${end}.${kind === 'csv' ? 'csv' : 'xlsx'}`);
    } catch (e: any) {
      setExportErr(e?.message || 'Export failed');
    } finally {
      setExporting('');
    }
  }

  if (error) return <ErrorAlert message={error} />;

  return (
    <div>
      <PageHeader title="Revenue" subtitle="Revenue and profit analysis" />

      <div className="card mb-3">
        <div className="card-body d-flex flex-wrap gap-2 align-items-center">
          <DateRange start={start} end={end} onStart={setStart} onEnd={setEnd} />
          <select className="form-select form-select-sm" style={{ width: 150 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="completed">Completed</option>
            <option value="all">All statuses</option>
          </select>
        </div>
      </div>

      {loading && <Loading />}
      {data && (
        <>
          <div className="row g-3 mb-4">
            <StatCard label="Total revenue" value={fmtMoney(data.total_revenue)} tone="primary" icon="bi-cash-stack" />
            <StatCard label="Gross profit" value={fmtMoney(data.total_gross_profit)} tone="success" icon="bi-graph-up-arrow" />
            <StatCard label="Commissions" value={fmtMoney(data.total_commission)} tone="warning" icon="bi-percent" />
            <StatCard label="Company profit" value={fmtMoney(data.total_company_profit)} tone="success" icon="bi-piggy-bank" />
          </div>
          <div className="card">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr><th>Number</th><th>Date</th><th>Service</th><th>Client</th><th>Employee</th><th className="text-end">Price</th><th className="text-end">Cost</th><th className="text-end">Gross</th><th className="text-end">Commission</th><th className="text-end">Company</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {(data.rows || []).length === 0 && <tr><td colSpan={11}><EmptyState message="No transactions in this window" /></td></tr>}
                  {(data.rows || []).map((r: any) => (
                    <tr key={r.transaction_number}>
                      <td className="fw-semibold">{r.transaction_number}</td>
                      <td>{fmtDate(r.date)}</td>
                      <td>{r.service}</td>
                      <td>{r.client}</td>
                      <td>{r.employee}</td>
                      <td className="text-end money">{fmtMoney(r.customer_price)}</td>
                      <td className="text-end money">{fmtMoney(r.official_cost)}</td>
                      <td className="text-end money">{fmtMoney(r.gross_profit)}</td>
                      <td className="text-end money text-warning">{fmtMoney(r.commission)}</td>
                      <td className="text-end money fw-semibold text-success">{fmtMoney(r.company_profit)}</td>
                      <td><Badge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="d-flex gap-2 mt-3 align-items-center flex-wrap">
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => exportFile('csv')} disabled={!!exporting}><i className="bi bi-filetype-csv me-1" /> Export CSV</button>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => exportFile('excel')} disabled={!!exporting}><i className="bi bi-file-earmark-excel me-1" /> Export Excel</button>
            {exporting && <span className="small text-muted"><span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />Preparing export…</span>}
          </div>
          {exportErr && <ErrorAlert message={exportErr} />}
        </>
      )}
    </div>
  );
}