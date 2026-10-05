'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api, can, fmtDateTime } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useFetch } from '@/lib/use-fetch';
import { P } from '@/lib/permissions';
import { Badge, EmptyState, Pagination } from '@/components/ui';
import { SelectInput } from '@/components/form';
import { BarcodeStatus } from '@/components/shop';

/** Codes the shop floor keeps scanning that the catalogue does not hold. */
export function UnknownScans() {
  const { user } = useAuth();
  const canCreate = can(user, P.shopProductsCreate);
  const canEdit = can(user, P.shopProductsEdit);
  const canView = can(user, P.shopProductsView) || can(user, P.shopSettingsManage);
  const [status, setStatus] = useState('open');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState('');
  const { data, loading, error, reload } = useFetch(
    canView ? '/api/shop/unknown-barcodes' : '',
    [status, page],
    { status, per_page: 20, page }
  );

  // The card only exists for a permitted, successful response — no card, no
  // dead controls and no 403 request from a user who cannot see the queue.
  if (!canView || error || loading || !data) return null;
  const items: any[] = data.items || [];

  async function ignore(id: number) {
    setBusyId(id);
    setActionError('');
    try {
      await api(`/api/shop/unknown-barcodes/${id}`, { method: 'PATCH', body: { status: 'ignored' } });
      reload();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card mt-4">
      <div className="card-body py-3 border-bottom d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <div className="fw-semibold">Unknown scans</div>
          <div className="small text-muted">
            Barcodes scanned at the till, receiving or a stock count that no product holds yet.
          </div>
        </div>
        <div className="d-flex align-items-center gap-2">
          <label className="small text-muted mb-0">Status</label>
          <SelectInput
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="form-select-sm"
            style={{ width: 120 }}
          >
            <option value="open">Open</option>
            <option value="ignored">Ignored</option>
            <option value="all">All</option>
          </SelectInput>
        </div>
      </div>

      {actionError && <div className="alert alert-danger py-2 small rounded-0 mb-0">{actionError}</div>}

      {items.length === 0 ? (
        <div className="card-body">
          <EmptyState
            message="No unknown scans"
            hint="Barcodes scanned on the shop floor that are not in the catalogue will be queued here."
            icon="bi-upc"
          />
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Barcode</th>
                <th>Context</th>
                <th>Branch</th>
                <th className="text-end">Scans</th>
                <th>First seen</th>
                <th>Last seen</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <td>
                    <BarcodeStatus value={row.barcode} format={row.barcode_format} />
                  </td>
                  <td className="text-capitalize">{row.context}</td>
                  <td>{row.branch || '—'}</td>
                  <td className="text-end">{row.times_scanned}</td>
                  <td className="small text-muted">{fmtDateTime(row.first_seen_at)}</td>
                  <td className="small text-muted">{fmtDateTime(row.last_seen_at)}</td>
                  <td><Badge status={row.status} /></td>
                  <td className="text-end text-nowrap">
                    {canCreate && (
                      <Link
                        className="btn btn-sm btn-outline-primary me-1"
                        href={`/shop/catalog?new=1&barcode=${encodeURIComponent(row.barcode)}`}
                      >
                        Register
                      </Link>
                    )}
                    {canEdit && row.status !== 'ignored' && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        disabled={busyId === row.id}
                        onClick={() => ignore(row.id)}
                      >
                        {busyId === row.id ? 'Ignoring…' : 'Ignore'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {items.length > 0 && (
        <div className="card-body">
          <Pagination page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
        </div>
      )}
    </div>
  );
}

export default UnknownScans;
