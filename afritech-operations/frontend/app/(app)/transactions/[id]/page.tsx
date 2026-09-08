'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useFetch } from '@/lib/use-fetch';
import { api, fmtMoney, fmtDate, fmtDateTime, can } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PageHeader, Loading, ErrorAlert, Badge, Modal } from '@/components/ui';

export default function TransactionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user } = useAuth();
  const { data, error, loading, reload } = useFetch<any>(`/api/transactions/${id}`, [id]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error2, setError2] = useState('');

  if (loading) return <Loading />;
  if (error) return <ErrorAlert message={error} onRetry={reload} />;

  const t = data.transaction;
  const ownsTxn = !!user && t.employee_id === user.employee_id;
  const canCancel = can(user, 'transactions.cancel');
  const canComplete = can(user, 'transactions.approve') || ownsTxn;

  async function updateStatus(status: string) {
    setError2('');
    setBusy(true);
    try {
      await api(`/api/transactions/${id}/status`, {
        method: 'POST',
        body: { status, reason: reason || undefined },
      });
      setCancelOpen(false);
      setReason('');
      reload();
    } catch (e: any) {
      setError2(e.message);
    } finally {
      setBusy(false);
    }
  }

  const actions = (
    <>
      <Link href="/transactions/new" className="btn btn-sm btn-outline-primary">New transaction</Link>
      {t.status !== 'cancelled' && t.status !== 'refunded' && t.status !== 'completed' && canComplete && (
        <button className="btn btn-sm btn-outline-success" onClick={() => updateStatus('completed')}>Mark completed</button>
      )}
      {t.status !== 'cancelled' && t.status !== 'refunded' && t.status !== 'failed' && canCancel && (
        <button className="btn btn-sm btn-outline-danger" onClick={() => setCancelOpen(true)}>Cancel / refund</button>
      )}
    </>
  );

  return (
    <div>
      <PageHeader title={t.transaction_number} subtitle={`Recorded ${fmtDateTime(t.created_at)}`} actions={actions} />

      {error2 && <ErrorAlert message={error2} />}

      <div className="row g-3">
        <div className="col-lg-7">
          <div className="card">
            <div className="card-body">
              <h6 className="card-title fw-semibold d-flex justify-content-between">
                Details
                <Badge status={t.status} />
              </h6>
              <table className="table table-sm mb-0">
                <tbody>
                  <tr><td className="text-muted">Service</td><td className="fw-semibold">{t.service_name}</td></tr>
                  <tr><td className="text-muted">Client</td><td>{t.client_name} <span className="text-muted small">({t.client_number})</span></td></tr>
                  <tr><td className="text-muted">Employee</td><td>{t.employee_name}</td></tr>
                  <tr><td className="text-muted">Transaction date</td><td>{fmtDate(t.transaction_date)}</td></tr>
                  <tr><td className="text-muted">Payment</td><td>{t.is_cash ? 'Cash' : 'Non-cash'}</td></tr>
                  <tr><td className="text-muted">Reference</td><td>{t.reference || '—'}</td></tr>
                  <tr><td className="text-muted">Notes</td><td>{t.notes || '—'}</td></tr>
                  {t.cancellation_reason && <tr><td className="text-muted">Cancellation reason</td><td>{t.cancellation_reason}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {(t.payments?.length > 0) && (
            <div className="card mt-3">
              <div className="card-body">
                <h6 className="card-title fw-semibold">Payments</h6>
                <table className="table table-sm mb-0">
                  <thead><tr><th>Method</th><th className="text-end">Amount</th><th>Paid at</th></tr></thead>
                  <tbody>
                    {t.payments.map((p: any) => (
                      <tr key={p.id}>
                        <td>{p.payment_method}</td>
                        <td className="text-end money">{fmtMoney(p.amount)}</td>
                        <td>{fmtDateTime(p.paid_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="col-lg-5">
          <div className="card">
            <div className="card-body">
              <h6 className="card-title fw-semibold">Financial breakdown</h6>
              <table className="table table-sm mb-0">
                <tbody>
                  <tr><td className="text-muted">Revenue (customer price)</td><td className="text-end money">{fmtMoney(t.customer_price)}</td></tr>
                  <tr><td className="text-muted">Official cost</td><td className="text-end money">{fmtMoney(t.official_cost)}</td></tr>
                  <tr><td className="text-muted">Gross profit</td><td className="text-end money fw-semibold">{fmtMoney(t.gross_profit)}</td></tr>
                  <tr>
                    <td className="text-muted">Commission ({Math.round(t.commission_rate_used * 100)}%{t.commission_source !== 'default' ? ` · ${t.commission_source.replace(/_/g, ' ')}` : ''})</td>
                    <td className="text-end money text-warning fw-semibold">{fmtMoney(t.commission_amount)}</td>
                  </tr>
                  <tr><td className="text-muted">Company profit</td><td className="text-end money text-success fw-semibold">{fmtMoney(t.company_profit)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <Modal show={cancelOpen} title="Cancel or refund this transaction" onClose={() => setCancelOpen(false)} size="sm"
        footer={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setCancelOpen(false)}>Close</button>
            <button className="btn btn-danger" disabled={busy} onClick={() => updateStatus('refunded')}>Refund & reverse</button>
          </>
        }
      >
        <label className="form-label small fw-semibold">Reason <span className="text-danger">*</span></label>
        <textarea className="form-control" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this being cancelled/refunded?" />
      </Modal>
    </div>
  );
}