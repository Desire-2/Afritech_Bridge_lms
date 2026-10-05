'use client';

import { useState } from 'react';
import { useFetch, todayIso } from '@/lib/use-fetch';
import { can, fmtMoney, fmtDate } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { P } from '@/lib/permissions';
import { PageHeader, Loading, ErrorAlert, EmptyState, StatCard, Badge } from '@/components/ui';
import { DateRange, SelectInput } from '@/components/form';

type Tab = 'sales' | 'profitability' | 'stock' | 'slow-moving' | 'purchases' | 'tax';

const FINANCE_NOTICE = 'Financial reports require the appropriate permission.';

export default function ShopReportsPage() {
  const { user } = useAuth();
  const canFinancial = can(user, P.shopFinancialReportsView);

  const [tab, setTab] = useState<Tab>('sales');
  const [from, setFrom] = useState(todayIso(-30));
  const [to, setTo] = useState(todayIso());
  const [groupBy, setGroupBy] = useState('day');

  const salesPath = tab === 'sales' ? '/api/shop/reports/sales' : '';
  const profPath = tab === 'profitability' && canFinancial ? '/api/shop/reports/profitability' : '';
  const stockPath = tab === 'stock' ? '/api/shop/reports/stock' : '';
  const slowPath = tab === 'slow-moving' ? '/api/shop/reports/slow-moving' : '';
  const purchPath = tab === 'purchases' ? '/api/shop/reports/purchases' : '';
  const taxPath = tab === 'tax' && canFinancial ? '/api/shop/reports/tax' : '';

  const { data: sales, error: sErr, loading: sLd, reload: sReload } =
    useFetch(salesPath, [from, to, groupBy], { from, to, group_by: groupBy });
  const { data: prof, error: pErr, loading: pLd, reload: pReload } =
    useFetch(profPath, [from, to], { from, to });
  const { data: stock, error: kErr, loading: kLd, reload: kReload } =
    useFetch(stockPath, []);
  const { data: slow, error: mErr, loading: mLd, reload: mReload } =
    useFetch(slowPath, []);
  const { data: purch, error: uErr, loading: uLd, reload: uReload } =
    useFetch(purchPath, [from, to], { from, to });
  const { data: tax, error: tErr, loading: tLd, reload: tReload } =
    useFetch(taxPath, [from, to], { from, to });

  const tabs: { key: Tab; label: string }[] = [
    { key: 'sales', label: 'Sales' },
    { key: 'profitability', label: 'Profitability' },
    { key: 'stock', label: 'Stock' },
    { key: 'slow-moving', label: 'Slow-moving' },
    { key: 'purchases', label: 'Purchases' },
    { key: 'tax', label: 'Tax' },
  ];

  const salesRows = sales?.rows || [];
  const salesMoney = !!sales?.money;
  const profRows = prof?.rows || [];
  const stockRows = stock?.rows || [];
  const slowRows = slow?.rows || [];
  const supplierRows = purch?.by_supplier || [];
  const taxRows = tax?.rows || [];

  return (
    <div>
      <PageHeader title="Shop Reports" subtitle="Sales, profitability, stock, purchases and tax" />

      <div className="card mb-3">
        <div className="card-body d-flex flex-wrap gap-3 align-items-center">
          <DateRange start={from} end={to} onStart={setFrom} onEnd={setTo} />
          {tab === 'sales' && (
            <div className="d-flex align-items-center gap-2">
              <label className="small text-muted mb-0" htmlFor="shopGroupBy">Group by</label>
              <SelectInput id="shopGroupBy" className="form-select-sm" style={{ width: 190 }}
                value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
                <option value="day">Day</option>
                <option value="branch">Branch</option>
                <option value="product">Product</option>
                <option value="category">Category</option>
                <option value="payment_method">Payment method</option>
              </SelectInput>
            </div>
          )}
        </div>
      </div>

      <ul className="nav nav-pills mb-3">
        {tabs.map((t) => (
          <li className="nav-item me-1" key={t.key}>
            <button className={`nav-link py-1 px-3 ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
          </li>
        ))}
      </ul>

      {tab === 'sales' && (
        <div>
          {sErr && <ErrorAlert message={sErr} onRetry={sReload} />}
          {sLd && <Loading />}
          {!sLd && !sErr && salesRows.length === 0 && <EmptyState message="No sales in this period" />}
          {!sLd && !sErr && salesRows.length > 0 && (
            <div className="card">
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead>
                    <tr>
                      <th>{sales?.group_by === 'product' ? 'Product' : sales?.group_by === 'branch' ? 'Branch' : sales?.group_by === 'category' ? 'Category' : sales?.group_by === 'payment_method' ? 'Payment method' : 'Day'}</th>
                      <th className="text-end">Transactions</th>
                      <th className="text-end">Items sold</th>
                      {salesMoney && (
                        <>
                          <th className="text-end">Gross</th>
                          <th className="text-end">Discounts</th>
                          <th className="text-end">Taxes</th>
                          <th className="text-end">Refunds</th>
                          <th className="text-end">Net</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {salesRows.map((r: any) => (
                      <tr key={r.label}>
                        <td className="fw-semibold">{r.label}</td>
                        <td className="text-end">{r.transactions}</td>
                        <td className="text-end">{r.items_sold}</td>
                        {salesMoney && (
                          <>
                            <td className="text-end money fw-semibold">{r.gross != null ? fmtMoney(r.gross) : '—'}</td>
                            <td className="text-end money">{r.discounts != null ? fmtMoney(r.discounts) : '—'}</td>
                            <td className="text-end money">{r.taxes != null ? fmtMoney(r.taxes) : '—'}</td>
                            <td className="text-end money">{r.refunds != null ? fmtMoney(r.refunds) : '—'}</td>
                            <td className="text-end money fw-semibold">{r.net != null ? fmtMoney(r.net) : '—'}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  {sales?.totals && (
                    <tfoot>
                      <tr className="border-top">
                        <td className="fw-semibold">Totals</td>
                        <td className="text-end fw-semibold">{sales.totals.transactions}</td>
                        <td className="text-end fw-semibold">{sales.totals.items_sold}</td>
                        {salesMoney && (
                          <>
                            <td className="text-end money fw-bold">{sales.totals.gross != null ? fmtMoney(sales.totals.gross) : '—'}</td>
                            <td className="text-end money fw-semibold">{sales.totals.discounts != null ? fmtMoney(sales.totals.discounts) : '—'}</td>
                            <td className="text-end money fw-semibold">{sales.totals.taxes != null ? fmtMoney(sales.totals.taxes) : '—'}</td>
                            <td className="text-end money fw-semibold">{sales.totals.refunds != null ? fmtMoney(sales.totals.refunds) : '—'}</td>
                            <td className="text-end money fw-bold">{sales.totals.net != null ? fmtMoney(sales.totals.net) : '—'}</td>
                          </>
                        )}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'profitability' && !canFinancial && (
        <div className="alert alert-secondary small mb-0">{FINANCE_NOTICE}</div>
      )}

      {tab === 'profitability' && canFinancial && (
        <div>
          {pErr && <ErrorAlert message={pErr} onRetry={pReload} />}
          {pLd && <Loading />}
          {!pLd && !pErr && prof && !prof.costs && (
            <div className="alert alert-secondary small mb-0">{FINANCE_NOTICE}</div>
          )}
          {!pLd && !pErr && prof?.costs && profRows.length === 0 && <EmptyState message="No sales in this period" />}
          {!pLd && !pErr && prof?.costs && profRows.length > 0 && (
            <div className="card">
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="text-end">Units sold</th>
                      <th className="text-end">Revenue</th>
                      <th className="text-end">COGS</th>
                      <th className="text-end">Gross profit</th>
                      <th className="text-end">Margin</th>
                      <th className="text-end">Refunds</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profRows.map((r: any) => (
                      <tr key={r.label}>
                        <td className="fw-semibold">{r.label}</td>
                        <td className="text-end">{r.units_sold}</td>
                        <td className="text-end money fw-semibold">{r.revenue != null ? fmtMoney(r.revenue) : '—'}</td>
                        <td className="text-end money">{r.cogs != null ? fmtMoney(r.cogs) : '—'}</td>
                        <td className="text-end money fw-semibold">{r.gross_profit != null ? fmtMoney(r.gross_profit) : '—'}</td>
                        <td className="text-end">{r.margin_percent != null ? `${r.margin_percent}%` : '—'}</td>
                        <td className="text-end money">{r.refunds != null ? fmtMoney(r.refunds) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  {prof?.totals && (
                    <tfoot>
                      <tr className="border-top">
                        <td className="fw-semibold">Totals</td>
                        <td className="text-end fw-semibold">{prof.totals.units_sold}</td>
                        <td className="text-end money fw-bold">{prof.totals.revenue != null ? fmtMoney(prof.totals.revenue) : '—'}</td>
                        <td className="text-end money fw-semibold">{prof.totals.cogs != null ? fmtMoney(prof.totals.cogs) : '—'}</td>
                        <td className="text-end money fw-bold">{prof.totals.gross_profit != null ? fmtMoney(prof.totals.gross_profit) : '—'}</td>
                        <td className="text-end fw-semibold">{prof.totals.margin_percent != null ? `${prof.totals.margin_percent}%` : '—'}</td>
                        <td className="text-end money fw-semibold">{prof.totals.refunds != null ? fmtMoney(prof.totals.refunds) : '—'}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'stock' && (
        <div>
          {kErr && <ErrorAlert message={kErr} onRetry={kReload} />}
          {kLd && <Loading />}
          {!kLd && !kErr && stock && stockRows.length === 0 && <EmptyState message="No stock records found" />}
          {!kLd && !kErr && stock && stockRows.length > 0 && (
            <div>
              <div className="row g-3 mb-4">
                <div className="col-6 col-md-3">
                  <StatCard label="SKUs" value={stock.total_skus} icon="bi-upc" tone="primary" />
                </div>
                {stock.money && (
                  <div className="col-6 col-md-3">
                    <StatCard label="Stock valuation" value={fmtMoney(stock.valuation)} icon="bi-box-seam" tone="success" />
                  </div>
                )}
              </div>
              <div className="card">
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead>
                      <tr>
                        <th>Product</th><th>SKU</th><th>Variant</th><th>Branch</th>
                        <th className="text-end">Qty</th>
                        <th className="text-end">Reserved</th>
                        <th className="text-end">Available</th>
                        <th className="text-end">Damaged</th>
                        <th className="text-end">Reorder level</th>
                        <th>Low</th>
                        <th className="text-end">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockRows.map((r: any, i: number) => (
                        <tr key={`${r.sku}-${r.branch}-${i}`}>
                          <td className="fw-semibold">{r.product}</td>
                          <td className="small">{r.sku || '—'}</td>
                          <td className="small">{r.variant || '—'}</td>
                          <td className="small">{r.branch || '—'}</td>
                          <td className="text-end">{r.quantity}</td>
                          <td className="text-end">{r.reserved}</td>
                          <td className="text-end">{r.available}</td>
                          <td className="text-end">{r.damaged}</td>
                          <td className="text-end">{r.reorder_level ?? '—'}</td>
                          <td><Badge status={r.low ? 'low' : 'on_track'} /></td>
                          <td className="text-end money fw-semibold">{stock.money && r.value != null ? fmtMoney(r.value) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'slow-moving' && (
        <div>
          {mErr && <ErrorAlert message={mErr} onRetry={mReload} />}
          {mLd && <Loading />}
          {!mLd && !mErr && slow && slowRows.length === 0 && (
            <EmptyState message="No slow-moving stock" hint={`Nothing idle for ${slow.days ?? 90} days or more`} />
          )}
          {!mLd && !mErr && slow && slowRows.length > 0 && (
            <div>
              <p className="small text-muted mb-3">No sales for {slow.days} days or more.</p>
              <div className="card">
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead>
                      <tr>
                        <th>Product</th><th>Branch</th>
                        <th className="text-end">Qty</th>
                        <th className="text-end">Days idle</th>
                        <th>Last activity</th>
                        <th className="text-end">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {slowRows.map((r: any, i: number) => (
                        <tr key={`${r.product}-${r.branch}-${i}`}>
                          <td className="fw-semibold">{r.product}</td>
                          <td>{r.branch || '—'}</td>
                          <td className="text-end">{r.quantity}</td>
                          <td className="text-end">{r.days_idle ?? '—'}</td>
                          <td className="text-nowrap">{fmtDate(r.last_activity)}</td>
                          <td className="text-end money fw-semibold">{slow.money && r.value != null ? fmtMoney(r.value) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'purchases' && (
        <div>
          {uErr && <ErrorAlert message={uErr} onRetry={uReload} />}
          {uLd && <Loading />}
          {!uLd && !uErr && purch && purch.orders === 0 && supplierRows.length === 0 && (
            <EmptyState message="No purchase orders in this period" />
          )}
          {!uLd && !uErr && purch && (purch.orders > 0 || supplierRows.length > 0) && (
            <div>
              <div className="row g-3 mb-4">
                <div className="col-6 col-md-3">
                  <StatCard label="Purchase orders" value={purch.orders} icon="bi-cart3" tone="primary" />
                </div>
                {purch.money && purch.total != null && (
                  <div className="col-6 col-md-3">
                    <StatCard label="Total spend" value={fmtMoney(purch.total)} icon="bi-cash-stack" tone="success" />
                  </div>
                )}
              </div>

              {Object.keys(purch.by_status || {}).length > 0 && (
                <div className="card mb-3">
                  <div className="card-header py-2 small fw-semibold">By status</div>
                  <div className="card-body d-flex flex-wrap gap-2 py-2">
                    {Object.entries(purch.by_status || {}).map(([k, v]: any) => (
                      <span key={k} className="d-inline-flex align-items-center gap-1 me-3 small">
                        <Badge status={k} />
                        <span className="fw-semibold">{v}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="card">
                <div className="card-header py-2 small fw-semibold">By supplier</div>
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead>
                      <tr>
                        <th>Supplier</th>
                        <th className="text-end">Orders</th>
                        {purch.money && <th className="text-end">Total</th>}
                        {purch.money && <th className="text-end">Received</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {supplierRows.map((r: any) => (
                        <tr key={r.supplier}>
                          <td className="fw-semibold">{r.supplier}</td>
                          <td className="text-end">{r.orders}</td>
                          {purch.money && <td className="text-end money fw-semibold">{r.total != null ? fmtMoney(r.total) : '—'}</td>}
                          {purch.money && <td className="text-end money">{r.received != null ? fmtMoney(r.received) : '—'}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'tax' && !canFinancial && (
        <div className="alert alert-secondary small mb-0">{FINANCE_NOTICE}</div>
      )}

      {tab === 'tax' && canFinancial && (
        <div>
          {tErr && <ErrorAlert message={tErr} onRetry={tReload} />}
          {tLd && <Loading />}
          {!tLd && !tErr && tax && taxRows.length === 0 && <EmptyState message="No taxable sales in this period" />}
          {!tLd && !tErr && tax && taxRows.length > 0 && (
            <div>
              <div className="row g-3 mb-4">
                <div className="col-6 col-md-3">
                  <StatCard label="Total tax" value={fmtMoney(tax.total_tax)} icon="bi-percent" tone="primary" />
                </div>
              </div>
              <div className="card">
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead>
                      <tr>
                        <th>Rate</th>
                        <th className="text-end">Units</th>
                        <th className="text-end">Taxable</th>
                        <th className="text-end">Tax</th>
                      </tr>
                    </thead>
                    <tbody>
                      {taxRows.map((r: any) => (
                        <tr key={r.rate}>
                          <td className="fw-semibold">{r.rate}</td>
                          <td className="text-end">{r.units}</td>
                          <td className="text-end money fw-semibold">{r.taxable != null ? fmtMoney(r.taxable) : '—'}</td>
                          <td className="text-end money fw-semibold">{r.tax != null ? fmtMoney(r.tax) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-top">
                        <td className="fw-semibold">Total tax</td>
                        <td />
                        <td />
                        <td className="text-end money fw-bold">{tax.total_tax != null ? fmtMoney(tax.total_tax) : '—'}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
