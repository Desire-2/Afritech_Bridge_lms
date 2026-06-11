'use client';

import React, { useRef, useCallback } from 'react';
import Image from 'next/image';

export interface PaymentSlipData {
  /** Student/applicant full name */
  studentName: string;
  /** Course title */
  courseTitle: string;
  /** Cohort label (optional) */
  cohortLabel?: string;
  /** Payment amount */
  amount: number;
  /** Currency code */
  currency: string;
  /** Payment method key */
  paymentMethod: string;
  /** Payment reference/transaction ID */
  reference?: string;
  /** Payment date (ISO string or Date) */
  paymentDate?: string | Date;
  /** Payment status */
  status: 'completed' | 'pending' | 'processing' | 'submitted';
  /** Enrollment ID */
  enrollmentId?: number | string;
  /** Whether partial payment */
  isPartial?: boolean;
  /** Original full price (for scholarship display) */
  originalPrice?: number;
  /** Scholarship percentage */
  scholarshipPercentage?: number;
}

const METHOD_LABELS: Record<string, string> = {
  kpay: 'K-Pay',
  stripe: 'Stripe',
  paypal: 'PayPal',
  flutterwave: 'Flutterwave',
  mobile_money: 'Mobile Money',
  bank_transfer: 'Bank Transfer',
  momo_pay_code: 'MoMo Pay Code',
};

const STATUS_CONFIG = {
  completed: {
    label: 'Payment Confirmed',
    icon: '✓',
    gradient: 'from-emerald-500 to-green-600',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  pending: {
    label: 'Payment Pending',
    icon: '⏳',
    gradient: 'from-amber-500 to-orange-500',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  processing: {
    label: 'Processing',
    icon: '🔄',
    gradient: 'from-blue-500 to-indigo-500',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-800 border-blue-300',
  },
  submitted: {
    label: 'Awaiting Verification',
    icon: '📋',
    gradient: 'from-violet-500 to-purple-600',
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    border: 'border-violet-200',
    badge: 'bg-violet-100 text-violet-800 border-violet-300',
  },
};

function formatAmount(amount: number, currency: string) {
  const SYMBOLS: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', GHS: 'GH₵', XAF: 'XAF ',
    RWF: 'RWF ', KES: 'KES ', UGX: 'UGX ', TZS: 'TZS ', NGN: '₦',
    ZAR: 'R', INR: '₹',
  };
  const sym = SYMBOLS[currency] || `${currency} `;
  return `${sym}${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDate(date?: string | Date) {
  if (!date) return new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function PaymentSlip({ data }: { data: PaymentSlipData }) {
  const slipRef = useRef<HTMLDivElement>(null);
  const statusConfig = STATUS_CONFIG[data.status];

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleDownload = useCallback(() => {
    const el = slipRef.current;
    if (!el) return;
    // Create a printable version and trigger browser's Save as PDF
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Afritech Bridge Payment Receipt</title>
          <style>
            body { margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          ${el.outerHTML}
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => { printWindow.print(); }, 500);
    }
  }, []);

  return (
    <div className="w-full max-w-lg mx-auto">
      <div
        ref={slipRef}
        className="relative overflow-hidden rounded-2xl shadow-2xl border border-gray-200/50 bg-white print:shadow-none print:border-none"
      >
        {/* ── Decorative Background Pattern ── */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* ── Header with Brand Gradient ── */}
        <div className="relative bg-gradient-to-br from-[#0a1628] via-[#132d54] to-[#1a3a6b] px-6 pt-8 pb-10 text-white overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-white/5" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/5" />
          <div className="absolute top-6 right-20 w-16 h-16 rounded-full bg-teal-400/10" />

          {/* Logo & Brand */}
          <div className="relative flex items-center gap-3 mb-6">
            <div className="w-14 h-14 rounded-xl bg-white/10 backdrop-blur-sm p-1.5 border border-white/20 shadow-lg">
              <Image
                src="/logo.jpg"
                alt="Afritech Bridge"
                width={48}
                height={48}
                className="w-full h-full object-contain rounded-lg"
                priority
              />
            </div>
            <div>
              <h2 className="text-lg font-extrabold tracking-tight leading-none">
                AFRITECH BRIDGE
              </h2>
              <p className="text-[11px] text-white/60 tracking-widest uppercase mt-0.5">
                Learning Management System
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-[11px] text-white/50 uppercase tracking-widest mb-1">Payment Receipt</p>
              <p className="text-sm text-white/70">Official payment confirmation</p>
            </div>
            <div className={`px-3 py-1.5 rounded-full text-xs font-bold border ${statusConfig.badge} flex items-center gap-1.5`}>
              <span className="text-sm">{statusConfig.icon}</span>
              {statusConfig.label}
            </div>
          </div>
        </div>

        {/* ── Amount Highlight ── */}
        <div className="relative -mt-5 mx-4">
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-5 text-center">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">Amount Paid</p>
            <p className="text-3xl font-extrabold text-[#0a1628] tracking-tight">
              {formatAmount(data.amount, data.currency)}
            </p>
            {data.isPartial && (
              <p className="text-xs text-amber-600 font-medium mt-1">
                Partial payment
                {data.originalPrice && (
                  <span className="text-gray-400 ml-1">
                    of {formatAmount(data.originalPrice, data.currency)}
                  </span>
                )}
              </p>
            )}
            {data.scholarshipPercentage && data.scholarshipPercentage > 0 && (
              <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200">
                <span className="text-xs">🎓</span>
                <span className="text-[11px] font-bold text-emerald-700">
                  {data.scholarshipPercentage}% Scholarship Applied
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Details Section ── */}
        <div className="px-6 pt-6 pb-4 space-y-0">
          {/* Student & Course */}
          <div className="flex items-start gap-3 py-3 border-b border-gray-100">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-sm">👤</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Student</p>
              <p className="text-sm font-bold text-gray-900 truncate">{data.studentName}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 py-3 border-b border-gray-100">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-sm">📚</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Course</p>
              <p className="text-sm font-bold text-gray-900 truncate">{data.courseTitle}</p>
              {data.cohortLabel && (
                <span className="inline-block mt-0.5 text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-semibold border border-indigo-100">
                  {data.cohortLabel}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3 py-3 border-b border-gray-100">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-sm">💳</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Payment Method</p>
              <p className="text-sm font-bold text-gray-900">
                {METHOD_LABELS[data.paymentMethod] || data.paymentMethod}
              </p>
            </div>
          </div>

          {data.reference && (
            <div className="flex items-start gap-3 py-3 border-b border-gray-100">
              <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-sm">🔗</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Reference</p>
                <p className="text-xs font-mono font-bold text-gray-800 break-all bg-gray-50 px-2 py-1 rounded mt-0.5">
                  {data.reference}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3 py-3 border-b border-gray-100">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-sm">📅</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Date & Time</p>
              <p className="text-sm font-semibold text-gray-900">{formatDate(data.paymentDate)}</p>
            </div>
          </div>

          {data.enrollmentId && (
            <div className="flex items-start gap-3 py-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-sm">🆔</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Enrollment ID</p>
                <p className="text-sm font-semibold text-gray-900">#{data.enrollmentId}</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="mx-6 mb-6 relative">
          <div className="border-t-2 border-dashed border-gray-200 pt-4">
            {/* Decorative verification line */}
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gray-200" />
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-50 border border-gray-200">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-emerald-500">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
                </svg>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  Secure & Verified
                </span>
              </div>
              <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gray-200" />
            </div>

            <p className="text-center text-[10px] text-gray-400 leading-relaxed">
              This is an official payment receipt from Afritech Bridge LMS.<br />
              For support, contact{' '}
              <span className="font-semibold text-gray-500">afritech.bridge@yahoo.com</span>
            </p>
            <p className="text-center text-[10px] text-gray-300 mt-2">
              © {new Date().getFullYear()} Afritech Bridge · Empowering Africa Through Digital Education
            </p>
          </div>
        </div>
      </div>

      {/* ── Action Buttons (hidden on print) ── */}
      <div className="mt-4 flex gap-3 print:hidden">
        <button
          onClick={handlePrint}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#0a1628] hover:bg-[#132d54] text-white text-sm font-bold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print Receipt
        </button>
        <button
          onClick={handleDownload}
          className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-[#0a1628] text-[#0a1628] hover:bg-[#0a1628] hover:text-white text-sm font-bold rounded-xl transition-all duration-200"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download
        </button>
      </div>
    </div>
  );
}
