'use client';

import Link from 'next/link';
import { useFetch } from '@/lib/use-fetch';
import { can, fmtMoney, fmtDateTime } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { P } from '@/lib/permissions';
import { PageHeader, Loading, ErrorAlert, EmptyState, StatCard, Badge } from '@/components/ui';

export default function ShopOverviewPage() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useFetch('/api/shop/dashboard', []);
  const { data: alerts } = useFetch(
    can(user, P.shopInventoryView) ? '/api/shop/inventory/alerts' : '',
    [], { open: 'true', per_page: 5 });

  if (loading) return <Loading />;
  if (error) return <ErrorAlert message={error} onRetry={reload} />;

  const today = data?.today || {};
  const month = data?.month || {};
  const stock = data?.stock || {};
  const pending = data?.pending || {};
  const recent: any[] = data?.recent_sales || [];
  const top: any[] = data?.top_products || [];
  const alertRows: any[] = alerts?.items || [];
  const showMoney = Object.prototype.hasOwnProperty.call(month, 'gross');
  const pendingTotal =
    (pending.purchase_orders || 0) + (pending.returns || 0) +
    (pending.transfers || 0) + (pending.closings || 0);

  return (
    <div>
      <PageHeader
        title="Shop Overview"
        subtitle="Today's till, stock health and anything waiting on a decision."
        actions={(
          <>
            {can(user, P.shopSalesCreate) && (
              <Link href="/shop/pos" className="btn btn-primary btn-sm">
                <i className="bi bi-cart-check me-1" /> Open POS
              </Link>
            )}
            {can(user, P.shopReportsView) && (
              <Link href="/shop/reports" className="btn btn-outline-secondary btn-sm">
                <i className="bi bi-graph-up-arrow me-1" /> Reports
              </Link>
            )}
          </>
        )}
      />

      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <StatCard label="Today's sales" value={showMoney ? fmtMoney(today.gross) : '—'}
            sub={`${today.transactions || 0} transactions`} icon="bi-receipt-cutoff" tone="primary" />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard label="Today's net" value={showMoney ? fmtMoney(today.net) : '—'}
            sub={`${today.items_sold || 0} items sold`} icon="bi-cash-stack" tone="success" />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard label="Low stock lines" value={stock.low ?? 0}
            sub={`${stock.out_of_stock ?? 0} out of stock`} icon="bi-exclamation-triangle"
            tone={(stock.low || 0) > 0 ? 'warning' : 'success'} />
        </div>
        <div className="col-6 col-lg-3">
          <StatCard label="Awaiting approval" value={pendingTotal}
            sub={`${pending.purchase_orders || 0} POs · ${pending.returns || 0} returns`}
            icon="bi-hourglass-split" tone={pendingTotal > 0 ? 'warning' : 'success'} />
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-lg-4">
          <div className="card h-100">
            <div className="card-header py-2 d-flex justify-content-between align-items-center">
              <span className="card-title mb-0 small text-uppercase">Waiting on someone</span>
            </div>
            <div className="card-body py-2">
              {pendingTotal === 0 ? (
                <div className="small text-muted-2 py-2">Nothing is waiting for approval.</div>
              ) : (
                <ul className="list-unstyled mb-0">
                  <PendingRow label="Purchase orders" value={pending.purchase_orders} href="/shop/purchasing" perm={P.shopPurchasesView} />
                  <PendingRow label="Customer returns" value={pending.returns} href="/shop/sales" perm={P.shopReturnsView} />
                  <PendingRow label="Stock transfers" value={pending.transfers} href="/shop/inventory" perm={P.shopInventoryView} />
                  <PendingRow label="Daily closings" value={pending.closings} href="/shop/shifts" perm={P.shopClosingView} />
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card h-100">
            <div className="card-header py-2">
              <span className="card-title mb-0 small text-uppercase">Stock alerts</span>
            </div>
            <div className="card-body py-2">
              {alertRows.length === 0 ? (
                <div className="small text-muted-2 py-2">No open alerts right now.</div>
              ) : (
                <ul className="list-unstyled mb-0">
                  {alertRows.map((a: any) => (
                    <li key={a.id} className="d-flex justify-content-between gap-2 py-1 border-bottom small">
                      <span className="text-wrap">
                        <span className="badge border bg-warning-subtle text-warning border-warning-subtle me-1">
                          {a.alert_type.replace(/_/g, ' ')}
                        </span>
                        {a.product}{a.variant ? ` · ${a.variant}` : ''}
                      </span>
                      <span className="text-nowrap text-muted-2">{a.branch}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card h-100">
            <div className="card-header py-2">
              <span className="card-title mb-0 small text-uppercase">Top products this month</span>
            </div>
            <div className="card-body py-2">
              {top.length === 0 ? (
                <div className="small text-muted-2 py-2">No sales recorded yet this month.</div>
              ) : (
                <ul className="list-unstyled mb-0">
                  {top.slice(0, 6).map((t: any, i: number) => (
                    <li key={`${t.name}-${i}`}
                      className="d-flex justify-content-between gap-2 py-1 border-bottom small">
                      <span className="text-truncate">{t.name}</span>
                      <span className="text-nowrap money text-muted-2">
                        {t.units} · {showMoney ? fmtMoney(t.revenue) : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header py-2 d-flex justify-content-between align-items-center">
          <span className="card-title mb-0 small text-uppercase">Recent sales</span>
          {can(user, P.shopSalesView) && (
            <Link href="/shop/sales" className="small">View all</Link>
          )}
        </div>
        {recent.length === 0 ? (
          <div className="card-body">
            <EmptyState message="No sales yet" hint="Ring up the first sale from the POS." />
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead>
                <tr>
                  <th>Sale</th>
                  <th>When</th>
                  <th>Customer</th>
                  <th>Branch</th>
                  <th className="text-end">Items</th>
                  <th>Status</th>
                  <th className="text-end">Total</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((s: any) => (
                  <tr key={s.id}>
                    <td className="fw-semibold">{s.sale_number}</td>
                    <td className="text-muted-2">{fmtDateTime(s.created_at)}</td>
                    <td>{s.customer || 'Walk-in'}</td>
                    <td>{s.branch}</td>
                    <td className="text-end">{s.item_count}</td>
                    <td><Badge status={s.status} /></td>
                    <td className="text-end money fw-semibold">
                      {showMoney ? fmtMoney(s.total_amount) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showMoney && (
        <div className="text-muted-2 small mt-3">
          This month to date: {fmtMoney(month.gross)} gross · {fmtMoney(month.net)} net ·{' '}
          {month.transactions || 0} transactions · {fmtMoney(month.refunds || 0)} refunded.
        </div>
      )}
    </div>
  );
}

function PendingRow({ label, value, href, perm }: {
  label: string; value?: number; href: string; perm: string;
}) {
  const { user } = useAuth();
  if (!value) return null;
  if (!can(user, perm)) return null;
  return (
    <li className="d-flex justify-content-between py-1 border-bottom small">
      <Link href={href}>{label}</Link>
      <span className="badge border bg-warning-subtle text-warning border-warning-subtle">{value}</span>
    </li>
  );
}
