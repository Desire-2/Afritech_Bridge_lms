'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type PaymentMethod = 'paypal' | 'mobile_money' | 'bank_transfer' | 'stripe' | 'kpay' | 'flutterwave' | string;
type PaymentStatus =
  | 'pending'
  | 'pending_bank_transfer'
  | 'completed'
  | 'confirmed'
  | 'failed'
  | 'refunded'
  | 'initiated';

interface PaymentRecord {
  id: number;
  full_name: string;
  email: string;
  phone?: string;
  course_title?: string;
  course_id?: number;
  course_price?: number;
  course_currency?: string;
  course_payment_mode?: string;
  course_enabled_methods?: PaymentMethod[];
  amount_paid?: number;
  payment_method?: PaymentMethod;
  payment_status?: PaymentStatus;
  payment_reference?: string;
  payment_currency?: string;
  status: string;
  created_at: string;
  admin_notes?: string;
  country?: string;
  cohort_label?: string;
  cohort_effective_price?: number;
  cohort_scholarship_type?: string;
  cohort_scholarship_percentage?: number;
  cohort_enrollment_type?: string;
  payment_slip_url?: string;
  payment_slip_filename?: string;
  has_payment_slip?: boolean;
}

interface MethodRevenue {
  count: number;
  revenue: Record<string, number>;
}

interface CourseBreakdown {
  course_id: number;
  course_title: string;
  price?: number;
  currency: string;
  payment_mode: string;
  enabled_methods: PaymentMethod[];
  total: number;
  completed: number;
  pending_bank: number;
  failed: number;
  revenue: Record<string, number>;
  cohort_label?: string;
  cohort_effective_price?: number;
  cohort_enrollment_type?: string;
}

interface PaymentSummary {
  total_with_payment: number;
  completed_count: number;
  pending_bank_count: number;
  failed_count: number;
  revenue_by_currency: Record<string, number>;
  by_method: Partial<Record<PaymentMethod, number>>;
  by_method_revenue: Partial<Record<PaymentMethod, MethodRevenue>>;
  by_status: Record<string, number>;
  by_course: CourseBreakdown[];
  recent_payments: PaymentRecord[];
}

interface Props {
  role: 'admin' | 'instructor';
}

type Tab = 'all' | 'action' | 'courses';

// ─── Constants ────────────────────────────────────────────────────────────────

const METHOD_LABELS: Record<string, string> = {
  paypal: 'PayPal',
  mobile_money: 'Mobile Money',
  bank_transfer: 'Bank Transfer',
  stripe: 'Stripe',
  kpay: 'K-Pay',
  flutterwave: 'Flutterwave',
};

const METHOD_BG: Record<string, string> = {
  paypal: 'bg-blue-50 text-blue-700 border-blue-200',
  mobile_money: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  bank_transfer: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  stripe: 'bg-violet-50 text-violet-700 border-violet-200',
  kpay: 'bg-orange-50 text-orange-700 border-orange-200',
  flutterwave: 'bg-amber-50 text-amber-700 border-amber-200',
};

const METHOD_ICON_BG: Record<string, string> = {
  paypal: 'bg-blue-600',
  mobile_money: 'bg-yellow-500',
  bank_transfer: 'bg-emerald-600',
  stripe: 'bg-violet-600',
  kpay: 'bg-orange-600',
  flutterwave: 'bg-amber-500',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  pending_bank_transfer: 'Awaiting Transfer',
  completed: 'Completed',
  confirmed: 'Confirmed',
  failed: 'Failed',
  refunded: 'Refunded',
  initiated: 'Initiated',
};

const STATUS_BG: Record<string, string> = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  pending_bank_transfer: 'bg-orange-50 text-orange-700 border-orange-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  refunded: 'bg-gray-100 text-gray-600 border-gray-300',
  initiated: 'bg-gray-50 text-gray-500 border-gray-200',
};

const ACTIONABLE_STATUSES = new Set(['pending', 'pending_bank_transfer', 'initiated']);

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getToken() {
  return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
}

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` };
}

function formatAmount(amount?: number | null, currency?: string | null) {
  if (amount === null || amount === undefined) return '—';
  const ccy = currency || 'USD';
  const SYMBOLS: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', GHS: 'GH₵', XAF: 'XAF ',
    RWF: 'RWF ', KES: 'KES ', UGX: 'UGX ', TZS: 'TZS ', NGN: '₦',
    ZAR: 'R', INR: '₹',
  };
  const sym = SYMBOLS[ccy] || `${ccy} `;
  return `${sym}${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatRevenue(rev: Record<string, number>) {
  if (!rev || Object.keys(rev).length === 0) return '—';
  return Object.entries(rev).map(([cur, amt]) => formatAmount(amt, cur)).join(' · ');
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MethodIcon({ method, size = 'sm' }: { method: PaymentMethod; size?: 'sm' | 'md' }) {
  const sz = size === 'md' ? 'w-9 h-9' : 'w-7 h-7';
  const bg = METHOD_ICON_BG[method];

  if (method === 'paypal') return (
    <span className={`${sz} ${bg} rounded-full flex items-center justify-center shrink-0`} title="PayPal">
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
        <path d="M7.144 19.532l1.049-5.967h3.028c3.325 0 5.49-1.644 6.19-4.875.52-2.405-.072-3.72-1.795-4.561C14.87 3.65 13.6 3.5 12.068 3.5H5.8L4 19.532h3.144zm2.76-8.4l.676-3.834h2.73c1.084 0 1.804.162 2.248.613.443.45.52 1.2.248 2.32-.395 1.653-1.414 2.46-3.297 2.46H9.24l.665-1.559z" />
      </svg>
    </span>
  );

  if (method === 'stripe') return (
    <span className={`${sz} ${bg} rounded-full flex items-center justify-center shrink-0`} title="Stripe">
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
        <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
      </svg>
    </span>
  );

  if (method === 'bank_transfer') return (
    <span className={`${sz} ${bg} rounded-full flex items-center justify-center shrink-0`} title="Bank Transfer">
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
        <path d="M2 10h20v2H2zM4 13h2v5H4zm5 0h2v5H9zm5 0h2v5h-2zm5 0h2v5h-2zM12 2L2 7h20z" />
      </svg>
    </span>
  );

  if (method === 'kpay') return (
    <span className={`${sz} ${bg} rounded-full flex items-center justify-center shrink-0`} title="K-Pay">
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
      </svg>
    </span>
  );

  if (method === 'flutterwave') return (
    <span className={`${sz} ${bg} rounded-full flex items-center justify-center shrink-0`} title="Flutterwave">
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
        <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z" />
      </svg>
    </span>
  );

  return (
    <span className={`${sz} ${bg || 'bg-yellow-500'} rounded-full flex items-center justify-center shrink-0`} title={METHOD_LABELS[method] || 'Mobile Money'}>
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="white" strokeWidth={2}>
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
        <line x1="12" y1="18" x2="12.01" y2="18" />
      </svg>
    </span>
  );
}

function Badge({ text, cls }: { text: string; cls: string }) {
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>{text}</span>;
}

function KpiCard({ label, value, icon, color, sub }: {
  label: string; value: string | number; icon: string; color: string; sub?: string;
}) {
  return (
    <div className={`rounded-xl p-5 shadow-sm border flex items-start gap-3 ${color}`}>
      <span className="text-2xl mt-0.5">{icon}</span>
      <div>
        <p className="text-xs font-medium opacity-70">{label}</p>
        <p className="text-2xl font-bold leading-tight">{value}</p>
        {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────

function DRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-4 py-1.5">
      <span className="text-xs text-gray-500 shrink-0 w-32">{label}</span>
      <span className="text-sm text-right flex-1 font-medium text-gray-800">{children}</span>
    </div>
  );
}

function DetailDrawer({
  record, onClose, onStatusChange, onConfirmTransfer,
}: {
  record: PaymentRecord;
  onClose: () => void;
  onStatusChange: (id: number, status: string, notes: string) => Promise<void>;
  onConfirmTransfer: (id: number, notes: string) => Promise<void>;
}) {
  const [newStatus, setNewStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Lazy-load payment slip on demand (base64 data can be 7MB+, too big for list API)
  const [slipUrl, setSlipUrl] = useState<string | null>(record.payment_slip_url || null);
  const [slipLoading, setSlipLoading] = useState(false);
  const hasSlip = record.has_payment_slip || !!record.payment_slip_url;

  useEffect(() => {
    // If we already have a URL (Google Drive link), no need to fetch
    if (slipUrl || !hasSlip) return;
    let cancelled = false;
    setSlipLoading(true);
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    fetch(`${API_BASE}/applications/${record.id}/payment-slip`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    })
      .then(r => r.ok ? r.json() as Promise<{ slip_url?: string }> : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(data => { if (!cancelled) setSlipUrl(data.slip_url || null); })
      .catch(() => { /* silently ignore — slip section just won't render */ })
      .finally(() => { if (!cancelled) setSlipLoading(false); });
    return () => { cancelled = true; };
  }, [record.id, hasSlip, slipUrl]);

  const handleChange = async () => {
    if (!newStatus) return;
    setLoading(true);
    setMsg(null);
    try {
      if (newStatus === 'confirmed' && record.payment_method === 'bank_transfer') {
        await onConfirmTransfer(record.id, notes);
      } else {
        await onStatusChange(record.id, newStatus, notes);
      }
      setMsg({ type: 'ok', text: `Status updated to "${STATUS_LABELS[newStatus] || newStatus}"` });
      setNewStatus(''); setNotes('');
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Error' });
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-end" onClick={onClose}>
      <div className="w-full max-w-md bg-white h-full shadow-2xl overflow-y-auto flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b bg-gray-50 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            {record.payment_method && <MethodIcon method={record.payment_method} size="md" />}
            <div>
              <h2 className="font-bold text-gray-900 text-base leading-tight">{record.full_name}</h2>
              <p className="text-xs text-gray-500">{record.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 text-gray-500 text-xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4 flex-1">
          <section className="bg-gray-50 rounded-xl p-4 space-y-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Payment Details</p>
            <DRow label="Method">{record.payment_method ? METHOD_LABELS[record.payment_method] : '—'}</DRow>
            <DRow label="Status">
              {record.payment_status
                ? <Badge text={STATUS_LABELS[record.payment_status] || record.payment_status} cls={STATUS_BG[record.payment_status] || 'bg-gray-100 text-gray-600 border-gray-200'} />
                : '—'}
            </DRow>
            <DRow label="Amount">
              <span className="font-bold text-emerald-700">
                {formatAmount(record.amount_paid, record.course_currency)}
                {record.course_payment_mode === 'partial' && <span className="ml-1 text-xs text-gray-400 font-normal">(partial)</span>}
              </span>
            </DRow>
            <DRow label="Reference">
              {record.payment_reference ? <span className="font-mono text-xs break-all">{record.payment_reference}</span> : '—'}
            </DRow>
            <DRow label="Date">{record.created_at ? new Date(record.created_at).toLocaleString() : '—'}</DRow>
          </section>

          {/* Payment Slip — lazy-loaded from dedicated endpoint */}
          {hasSlip && (() => {
            if (slipLoading) {
              return (
                <section className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-gray-500">Loading payment slip…</p>
                </section>
              );
            }
            if (!slipUrl) {
              return (
                <section className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Payment Slip / Receipt</p>
                  <p className="text-sm text-gray-500">Slip uploaded but could not be loaded.</p>
                </section>
              );
            }

            const isDataUrl = slipUrl.startsWith('data:');
            const isImage = isDataUrl
              ? /^data:image\//i.test(slipUrl)
              : /\.(png|jpg|jpeg|gif|webp)$/i.test(record.payment_slip_filename || '');
            const isPdf = isDataUrl
              ? /^data:application\/pdf/i.test(slipUrl)
              : /\.pdf$/i.test(record.payment_slip_filename || '');

            const openSlip = () => {
              if (!isDataUrl) { window.open(slipUrl, '_blank', 'noopener'); return; }
              try {
                const [header, b64] = slipUrl.split(',');
                const mime = (header.match(/data:([^;]+)/)?.[1]) || 'application/octet-stream';
                const bin = atob(b64);
                const bytes = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                const blob = new Blob([bytes], { type: mime });
                const blobUrl = URL.createObjectURL(blob);
                window.open(blobUrl, '_blank', 'noopener');
                setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
              } catch {
                const a = document.createElement('a');
                a.href = slipUrl;
                a.download = record.payment_slip_filename || 'payment-slip';
                a.click();
              }
            };

            return (
              <section className="bg-gray-50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Payment Slip / Receipt</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-emerald-600">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{record.payment_slip_filename || 'Payment Slip'}</p>
                    <p className="text-xs text-gray-500">Uploaded by applicant</p>
                  </div>
                  <button onClick={openSlip} type="button"
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer">
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                      <path d="M19 19H5V5h7V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
                    </svg>
                    View
                  </button>
                </div>
                {isImage && (
                  <div className="mt-2 rounded-lg overflow-hidden border border-gray-200 bg-white">
                    <img src={slipUrl} alt="Payment slip" className="max-h-64 w-auto mx-auto" />
                  </div>
                )}
                {isPdf && isDataUrl && (
                  <div className="mt-2 rounded-lg overflow-hidden border border-gray-200 bg-white">
                    <iframe src={slipUrl} title="Payment slip PDF" className="w-full h-96 border-0" />
                  </div>
                )}
              </section>
            );
          })()}

          <section className="bg-gray-50 rounded-xl p-4 space-y-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Course & Cohort</p>
            <DRow label="Title">{record.course_title || '—'}</DRow>
            <DRow label="Cohort">
              {record.cohort_label
                ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">{record.cohort_label}</span>
                : '—'}
            </DRow>
            <DRow label="Full Price">{formatAmount(record.course_price, record.course_currency)}</DRow>
            {record.cohort_effective_price !== undefined && record.cohort_effective_price !== null && record.cohort_effective_price !== record.course_price && (
              <DRow label="Cohort Price">
                <span className="font-bold text-emerald-700">{formatAmount(record.cohort_effective_price, record.course_currency)}</span>
              </DRow>
            )}
            {record.cohort_enrollment_type === 'scholarship' && (
              <DRow label="Scholarship">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                  record.cohort_scholarship_type === 'full'
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {record.cohort_scholarship_type === 'full'
                    ? '🎓 Full Scholarship'
                    : `🎓 ${record.cohort_scholarship_percentage || 0}% Scholarship`}
                </span>
              </DRow>
            )}
            {record.cohort_enrollment_type === 'free' && (
              <DRow label="Type">
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">Free Enrollment</span>
              </DRow>
            )}
            <DRow label="Payment Mode"><span className="capitalize">{record.course_payment_mode || 'full'}</span></DRow>
            {record.course_enabled_methods && record.course_enabled_methods.length > 0 && (
              <DRow label="Enabled Methods">
                <div className="flex flex-wrap gap-1 justify-end">
                  {record.course_enabled_methods.map((m) => (
                    <span key={m} className={`text-xs px-2 py-0.5 rounded-full border ${METHOD_BG[m] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>{METHOD_LABELS[m] || m}</span>
                  ))}
                </div>
              </DRow>
            )}
          </section>

          <section className="bg-gray-50 rounded-xl p-4 space-y-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Applicant</p>
            <DRow label="Phone">{record.phone || '—'}</DRow>
            <DRow label="Country">{record.country || '—'}</DRow>
            <DRow label="App Status"><span className="capitalize">{record.status}</span></DRow>
          </section>

          {record.admin_notes && (
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Admin Notes</p>
              <pre className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed border">{record.admin_notes}</pre>
            </section>
          )}

          <section className="border rounded-xl p-4 bg-amber-50 border-amber-200">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-3">Update Payment Status</p>
            {msg && (
              <div className={`mb-3 text-xs p-2 rounded ${msg.type === 'ok' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{msg.text}</div>
            )}
            <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}
              className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm mb-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
              <option value="">Choose new status…</option>
              <option value="completed">✅ Completed</option>
              <option value="confirmed">✔ Confirmed (Bank Transfer)</option>
              <option value="pending">⏳ Pending</option>
              <option value="pending_bank_transfer">🏦 Awaiting Bank Transfer</option>
              <option value="failed">❌ Failed</option>
              <option value="refunded">↩ Refunded</option>
            </select>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="Optional note…"
              className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm mb-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400" />
            <button onClick={handleChange} disabled={!newStatus || loading}
              className="w-full py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
              {loading ? 'Saving…' : 'Save Status Change'}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

// ─── Course Breakdown Card ────────────────────────────────────────────────────

function CourseBreakdownCard({ course, onFilter }: { course: CourseBreakdown; onFilter: (id: number) => void }) {
  const isFreeOrScholarship = course.cohort_enrollment_type === 'free' || course.cohort_enrollment_type === 'scholarship';
  return (
    <div className="bg-white border rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{course.course_title}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
            {course.cohort_label && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">{course.cohort_label}</span>
            )}
            <span className="text-xs text-gray-500">
              {course.cohort_effective_price !== undefined && course.cohort_effective_price !== null
                ? formatAmount(course.cohort_effective_price, course.currency)
                : formatAmount(course.price, course.currency)}
              {' \u00b7 '}<span className="capitalize">{course.payment_mode}</span>
            </span>
            {isFreeOrScholarship && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">
                {course.cohort_enrollment_type === 'free' ? 'Free' : 'Scholarship'}
              </span>
            )}
          </div>
        </div>
        <button onClick={() => onFilter(course.course_id)}
          className="text-xs text-indigo-600 hover:text-indigo-800 border border-indigo-200 px-2 py-1 rounded-lg shrink-0">
          Filter
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center bg-gray-50 rounded-lg p-2">
          <p className="text-lg font-bold text-gray-900">{course.total}</p>
          <p className="text-xs text-gray-500">Total</p>
        </div>
        <div className="text-center bg-emerald-50 rounded-lg p-2">
          <p className="text-lg font-bold text-emerald-700">{course.completed}</p>
          <p className="text-xs text-emerald-600">Paid</p>
        </div>
        <div className="text-center bg-orange-50 rounded-lg p-2">
          <p className="text-lg font-bold text-orange-700">{course.pending_bank}</p>
          <p className="text-xs text-orange-600">Pending</p>
        </div>
      </div>

      {Object.keys(course.revenue).length > 0 && (
        <div className="bg-indigo-50 rounded-lg px-3 py-2 mb-2">
          <p className="text-xs text-indigo-500 mb-0.5">Revenue collected</p>
          <p className="text-sm font-bold text-indigo-800">{formatRevenue(course.revenue)}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-1 mt-1">
        {course.enabled_methods.map((m) => (
          <span key={m} className={`text-xs px-2 py-0.5 rounded-full border ${METHOD_BG[m]}`}>{METHOD_LABELS[m]}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PaymentsDashboard({ role }: Props) {
  const { user } = useAuth();

  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [records, setRecords] = useState<PaymentRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('all');
  const [selected, setSelected] = useState<PaymentRecord | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [filterMethod, setFilterMethod] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCourse, setFilterCourse] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 20;

  const instructorParam = role === 'instructor' && user?.id ? `instructor_id=${user.id}` : '';

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/applications/payment-summary?${instructorParam}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSummary(await res.json() as PaymentSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load summary');
    }
  }, [instructorParam]);

  const buildParams = useCallback(() => {
    const p = new URLSearchParams();
    if (filterMethod) p.set('payment_method', filterMethod);
    if (filterStatus) p.set('payment_status', filterStatus);
    if (filterCourse) p.set('course_id', String(filterCourse));
    if (search) p.set('search', search);
    p.set('page', String(page));
    p.set('per_page', String(perPage));
    p.set('sort_by', 'created_at');
    p.set('order', 'desc');
    if (role === 'instructor' && user?.id) p.set('instructor_id', String(user.id));
    return p.toString();
  }, [filterMethod, filterStatus, filterCourse, search, page, role, user?.id]);

  const fetchRecords = useCallback(async () => {
    setTableLoading(true);
    try {
      const res = await fetch(`${API_BASE}/applications?${buildParams()}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { applications?: PaymentRecord[]; items?: PaymentRecord[]; total?: number };
      let apps = (data.applications || data.items || []).filter((a) => a.payment_method);
      if (tab === 'action') apps = apps.filter((a) => a.payment_status && ACTIONABLE_STATUSES.has(a.payment_status));
      setRecords(apps);
      setTotalRecords(data.total || apps.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load records');
    } finally { setTableLoading(false); }
  }, [buildParams, tab]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchSummary(), fetchRecords()]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMethod, filterStatus, filterCourse, search, page, tab]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 4000); };

  const handleConfirmTransfer = async (id: number, notes: string) => {
    const res = await fetch(`${API_BASE}/applications/${id}/confirm-bank-transfer`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ notes }),
    });
    const data = await res.json() as { error?: string };
    if (!res.ok) throw new Error(data.error || 'Failed to confirm');
    showToast('Bank transfer confirmed ✓');
    setRecords((prev) => prev.map((r) => r.id === id ? { ...r, payment_status: 'confirmed' } : r));
    if (selected?.id === id) setSelected((s) => s ? { ...s, payment_status: 'confirmed' } : s);
    fetchSummary();
  };

  const handleStatusChange = async (id: number, newStatus: string, notes: string) => {
    const res = await fetch(`${API_BASE}/applications/${id}/update-payment-status`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ payment_status: newStatus, notes }),
    });
    const data = await res.json() as { error?: string; payment_status?: string };
    if (!res.ok) throw new Error(data.error || 'Failed to update status');
    showToast(`Payment status → ${STATUS_LABELS[newStatus] || newStatus}`);
    const ps = (data.payment_status || newStatus) as PaymentStatus;
    setRecords((prev) => prev.map((r) => r.id === id ? { ...r, payment_status: ps } : r));
    if (selected?.id === id) setSelected((s) => s ? { ...s, payment_status: ps } : s);
    fetchSummary();
  };

  const exportCSV = () => {
    const headers = ['ID', 'Name', 'Email', 'Course', 'Cohort', 'Method', 'Amount', 'Currency', 'Status', 'Reference', 'Scholarship', 'Payment Slip', 'Date'];
    const rows = records.map((r) => [
      r.id, `"${r.full_name}"`, r.email, `"${r.course_title || ''}"`,
      `"${r.cohort_label || ''}"`,
      r.payment_method || '', r.amount_paid ?? '', r.payment_currency || r.course_currency || '',
      r.payment_status || '', `"${r.payment_reference || ''}"`,
      r.cohort_scholarship_type ? `${r.cohort_scholarship_type}${r.cohort_scholarship_percentage ? ` (${r.cohort_scholarship_percentage}%)` : ''}` : '',
      (r.has_payment_slip || r.payment_slip_url) ? 'Yes' : 'No',
      r.created_at ? new Date(r.created_at).toLocaleDateString() : '',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
      download: `payments_${Date.now()}.csv`,
    });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const resetFilters = () => { setFilterMethod(''); setFilterStatus(''); setFilterCourse(null); setSearch(''); setPage(1); };

  const handleCourseFilter = (courseId: number) => {
    setFilterCourse((prev) => (prev === courseId ? null : courseId));
    setTab('all'); setPage(1);
  };

  const actionableCount = (summary?.pending_bank_count ?? 0)
    + (summary?.by_status?.pending ?? 0)
    + (summary?.by_status?.initiated ?? 0);

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
    </div>
  );

  if (error && !summary) return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">
      <p className="font-semibold">Failed to load payment data</p>
      <p className="text-sm mt-1">{error}</p>
      <button onClick={() => { setError(null); fetchSummary(); fetchRecords(); }} className="mt-3 text-sm underline">Retry</button>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white px-5 py-3 rounded-xl shadow-xl text-sm font-medium">
          {toast}
        </div>
      )}

      {/* Detail Drawer */}
      {selected && (
        <DetailDrawer record={selected} onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange} onConfirmTransfer={handleConfirmTransfer} />
      )}

      {/* ── KPI Row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Total Transactions" value={summary?.total_with_payment ?? 0} icon="💳" color="bg-indigo-50 border-indigo-200 text-indigo-900" />
        <KpiCard
          label="Completed / Confirmed"
          value={summary?.completed_count ?? 0}
          icon="✅"
          color="bg-emerald-50 border-emerald-200 text-emerald-900"
          sub={summary?.revenue_by_currency ? formatRevenue(summary.revenue_by_currency) : undefined}
        />
        <KpiCard label="Awaiting Bank Transfer" value={summary?.pending_bank_count ?? 0} icon="🏦" color="bg-orange-50 border-orange-200 text-orange-900" />
        <KpiCard label="Failed Payments" value={summary?.failed_count ?? 0} icon="❌" color="bg-red-50 border-red-200 text-red-900" />
      </div>

      {/* ── Method Revenue Cards ──────────────────────────────────────── */}
      {summary && Object.keys(summary.by_method_revenue).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(Object.entries(summary.by_method_revenue) as [PaymentMethod, MethodRevenue][]).map(([method, mdata]) => (
            <button key={method}
              onClick={() => { setFilterMethod((p) => p === method ? '' : method); setTab('all'); setPage(1); }}
              className={`rounded-xl border p-4 text-left transition-all hover:shadow-sm ${filterMethod === method ? 'ring-2 ring-indigo-400 ' : ''}${METHOD_BG[method]}`}>
              <div className="flex items-center gap-2 mb-2">
                <MethodIcon method={method} />
                <span className="text-xs font-semibold">{METHOD_LABELS[method]}</span>
              </div>
              <p className="text-lg font-bold">{mdata.count} <span className="text-xs font-normal opacity-70">payment{mdata.count !== 1 ? 's' : ''}</span></p>
              {Object.keys(mdata.revenue).length > 0 && (
                <p className="text-xs mt-1 opacity-80">{formatRevenue(mdata.revenue)} collected</p>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {([
          { key: 'all' as Tab, label: 'All Payments' },
          { key: 'action' as Tab, label: `Needs Action${actionableCount > 0 ? ` · ${actionableCount}` : ''}` },
          { key: 'courses' as Tab, label: `By Course${summary?.by_course?.length ? ` · ${summary.by_course.length}` : ''}` },
        ]).map(({ key, label }) => (
          <button key={key} onClick={() => { setTab(key); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── By Course Tab ───────────────────────────────────────────────── */}
      {tab === 'courses' && (
        summary?.by_course?.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...summary.by_course].sort((a, b) => b.total - a.total).map((c) => (
              <CourseBreakdownCard key={c.course_id} course={c} onFilter={handleCourseFilter} />
            ))}
          </div>
        ) : (
          <div className="py-16 text-center text-gray-400">
            <p className="text-3xl mb-2">📊</p>
            <p className="text-sm">No payment data per course yet.</p>
          </div>
        )
      )}

      {/* ── All / Needs Action Table ────────────────────────────────────── */}
      {tab !== 'courses' && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b flex flex-wrap items-center gap-3">
            <input type="text" placeholder="Search name, email…" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="flex-1 min-w-40 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            <select value={filterMethod} onChange={(e) => { setFilterMethod(e.target.value); setPage(1); }}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
              <option value="">All Methods</option>
              <option value="paypal">PayPal</option>
              <option value="stripe">Stripe</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="mobile_money">Mobile Money</option>
              <option value="kpay">K-Pay</option>
              <option value="flutterwave">Flutterwave</option>
            </select>
            <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
              <option value="">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending_bank_transfer">Awaiting Bank Transfer</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
              <option value="initiated">Initiated</option>
            </select>
            {filterCourse && (
              <span className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-1.5 rounded-lg">
                Course #{filterCourse}
                <button onClick={() => setFilterCourse(null)} className="ml-1 hover:text-red-500">×</button>
              </span>
            )}
            {(filterMethod || filterStatus || filterCourse || search) && (
              <button onClick={resetFilters} className="px-3 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50">Clear</button>
            )}
            <button onClick={exportCSV}
              className="ml-auto flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {tableLoading ? (
              <div className="flex justify-center items-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
              </div>
            ) : records.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <p className="text-4xl mb-2">💳</p>
                <p className="text-sm">No payment records found{tab === 'action' ? ' that need action' : ''}.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Applicant</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Course / Cohort</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Method</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Reference</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {records.map((rec) => (
                    <tr key={rec.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setSelected(rec)}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{rec.full_name}</p>
                        <p className="text-xs text-gray-500">{rec.email}</p>
                      </td>
                      <td className="px-4 py-3 max-w-44">
                        <p className="text-gray-600 text-xs truncate">{rec.course_title || '—'}</p>
                        {rec.cohort_label && (
                          <span className="inline-block mt-0.5 text-xs px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">{rec.cohort_label}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {rec.payment_method ? (
                          <div className="flex items-center gap-1.5">
                            <MethodIcon method={rec.payment_method} />
                            <span className="text-xs text-gray-700 hidden sm:inline">{METHOD_LABELS[rec.payment_method] || rec.payment_method}</span>
                            {(rec.has_payment_slip || rec.payment_slip_url) && (
                              <span title="Payment slip attached" className="text-emerald-500">📎</span>
                            )}
                          </div>
                        ) : <span className="text-gray-400 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800 text-xs whitespace-nowrap">
                        {formatAmount(rec.amount_paid, rec.payment_currency || rec.course_currency)}
                        {rec.course_payment_mode === 'partial' && <span className="ml-1 text-gray-400 text-xs font-normal">(part)</span>}
                      </td>
                      <td className="px-4 py-3">
                        {rec.payment_status
                          ? <Badge text={STATUS_LABELS[rec.payment_status] || rec.payment_status} cls={STATUS_BG[rec.payment_status] || 'bg-gray-50 text-gray-600 border-gray-200'} />
                          : <span className="text-gray-400 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500 max-w-28 truncate">{rec.payment_reference || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {rec.created_at ? new Date(rec.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {rec.payment_method === 'bank_transfer' && rec.payment_status === 'pending_bank_transfer' ? (
                          <button onClick={() => handleConfirmTransfer(rec.id, '')}
                            className="px-3 py-1 bg-emerald-50 border border-emerald-300 text-emerald-700 hover:bg-emerald-100 text-xs font-medium rounded-lg transition-colors whitespace-nowrap">
                            ✓ Confirm
                          </button>
                        ) : rec.payment_status && ACTIONABLE_STATUSES.has(rec.payment_status) ? (
                          <button onClick={() => setSelected(rec)}
                            className="px-3 py-1 bg-amber-50 border border-amber-300 text-amber-700 hover:bg-amber-100 text-xs font-medium rounded-lg transition-colors">
                            Review
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {totalRecords > perPage && (
            <div className="p-4 border-t flex items-center justify-between">
              <p className="text-sm text-gray-500">{totalRecords.toLocaleString()} total records</p>
              <div className="flex gap-2 items-center">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1 border rounded text-sm disabled:opacity-40 hover:bg-gray-50">← Prev</button>
                <span className="text-sm font-medium px-1">Page {page}</span>
                <button onClick={() => setPage((p) => p + 1)} disabled={records.length < perPage}
                  className="px-3 py-1 border rounded text-sm disabled:opacity-40 hover:bg-gray-50">Next →</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
