"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  CheckCircle2, 
  XCircle, 
  Shield, 
  Calendar, 
  User, 
  BookOpen,
  Loader2,
  CreditCard,
  Building,
  MapPin,
  Phone,
  Mail,
  Scan
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import axios from 'axios';

interface ScholarshipInfo {
  scholarship_type: string;
  scholarship_percentage: number | null;
  original_price: number | null;
  effective_amount: number;
  currency: string;
}

interface PaymentVerificationData {
  verified: boolean;
  verification_hash: string;
  student_name: string;
  course_title: string;
  cohort_label: string | null;
  amount_paid: number;
  currency: string;
  payment_status: string;
  payment_verified: boolean;
  payment_verified_at: string | null;
  enrollment_id: number | null;
  application_id: number | null;
  receipt_number: string;
  source: string;
  scholarship_info: ScholarshipInfo | null;
}

export default function VerifyPaymentPage() {
  const params = useParams();
  const hash = params.hash as string;
  
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentVerificationData | null>(null);

  useEffect(() => {
    const verifyPayment = async () => {
      if (!hash || hash.length < 8) {
        setError("Invalid verification link. Please scan the QR code on your payment slip again.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
        const response = await axios.get(
          `${apiUrl}/payments/verify/${hash}`
        );

        if (response.data.success) {
          setVerified(true);
          setPaymentData(response.data.data);
        } else {
          setError(response.data.error || "Payment verification failed");
        }
      } catch (err: unknown) {
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 404) {
            setError("Payment record not found. The verification link may be invalid or expired.");
          } else {
            setError(err.response?.data?.error || "Failed to verify payment. Please try again.");
          }
        } else {
          setError("An unexpected error occurred. Please try again.");
        }
      } finally {
        setLoading(false);
      }
    };

    verifyPayment();
  }, [hash]);

  const formatCurrency = (amount: number, currency: string) => {
    const symbols: Record<string, string> = {
      USD: "$", EUR: "€", GBP: "£", RWF: "FRw",
      XAF: "FCFA", NGN: "₦", GHS: "GH₵", KES: "KES",
      UGX: "UGX", TZS: "TZS", ZAR: "R",
    };
    const sym = symbols[currency] || currency + " ";
    return `${sym} ${Number(amount).toLocaleString()}`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-teal-900 to-slate-900">
      {/* Header */}
      <header className="py-6 px-4 border-b border-white/10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image 
              src="/logo.jpg" 
              alt="Afritech Bridge Logo" 
              width={40} 
              height={40}
              className="rounded-full"
            />
            <span className="text-white font-bold text-xl">Afritech Bridge</span>
          </Link>
          <Badge variant="outline" className="border-emerald-400 text-emerald-400">
            <Scan className="w-3 h-3 mr-1" />
            Payment Verification
          </Badge>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Loading State */}
        {loading && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <Loader2 className="w-16 h-16 text-emerald-400 animate-spin mx-auto mb-6" />
            <h2 className="text-2xl font-semibold text-white mb-2">Verifying Payment</h2>
            <p className="text-gray-400">Please wait while we verify the authenticity of this payment record...</p>
          </motion.div>
        )}

        {/* Error State */}
        {!loading && error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-12"
          >
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 max-w-lg mx-auto">
              <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-12 h-12 text-red-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Verification Failed</h2>
              <p className="text-gray-300 mb-6">{error}</p>
              <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-400 mb-1">Verification Code</p>
                <p className="font-mono text-white text-sm break-all">{hash}</p>
              </div>
              <div className="flex justify-center gap-4">
                <Button asChild variant="outline" className="border-gray-600 text-gray-300">
                  <Link href="/">Go to Homepage</Link>
                </Button>
                <Button 
                  onClick={() => window.location.reload()}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  Try Again
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Verified State */}
        {!loading && verified && paymentData && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Verification Banner */}
            <motion.div 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 text-center"
            >
              <div className="flex items-center justify-center gap-3 mb-3">
                <div className="w-14 h-14 bg-emerald-500/20 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <div className="text-left">
                  <h2 className="text-xl font-bold text-emerald-400">Payment Verified ✓</h2>
                  <p className="text-emerald-300/70 text-sm">This payment record is authentic and verified</p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                <Shield className="w-4 h-4" />
                <span>Securely verified through Afritech Bridge payment system</span>
              </div>
            </motion.div>

            {/* Institution Header */}
            <Card className="bg-gradient-to-r from-teal-600/20 to-emerald-600/20 border-teal-700/50">
              <CardContent className="p-6 flex items-center gap-4">
                <Image 
                  src="/logo.jpg" 
                  alt="Afritech Bridge Logo" 
                  width={56} 
                  height={56}
                  className="rounded-full border-2 border-white/20"
                />
                <div>
                  <h3 className="text-lg font-bold text-white">Afritech Bridge LMS</h3>
                  <p className="text-gray-400 text-sm flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Kigali, Rwanda
                  </p>
                  <p className="text-gray-400 text-xs flex items-center gap-1">
                    <Mail className="w-3 h-3" /> afritech.bridge@yahoo.com
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Payment Receipt Card */}
            <Card className="bg-gray-800/50 border-gray-700 overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-teal-600/20 to-emerald-600/20 border-b border-gray-700">
                <CardTitle className="flex items-center gap-3 text-white">
                  <CreditCard className="w-6 h-6 text-emerald-400" />
                  Payment Receipt
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Receipt Number */}
                <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700 text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Receipt Number</p>
                  <p className="font-mono text-lg text-emerald-400 font-bold">{paymentData.receipt_number}</p>
                </div>

                {/* Amount Hero */}
                <div className="bg-gradient-to-r from-emerald-900/40 to-teal-900/40 rounded-xl p-6 border border-emerald-700/30 text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Amount Paid</p>
                  <p className="text-4xl font-bold text-emerald-400">
                    {formatCurrency(paymentData.amount_paid, paymentData.currency)}
                  </p>
                  <p className="text-gray-400 text-sm mt-1">
                    {paymentData.currency} &middot; {paymentData.payment_status === 'completed' ? 'Completed' : paymentData.payment_status}
                  </p>
                </div>

                {/* Student & Course Info */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3 bg-gray-900/30 rounded-lg p-4 border border-gray-700/50">
                    <User className="w-5 h-5 text-blue-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Student</p>
                      <p className="text-lg font-semibold text-white">{paymentData.student_name}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 bg-gray-900/30 rounded-lg p-4 border border-gray-700/50">
                    <BookOpen className="w-5 h-5 text-purple-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Course</p>
                      <p className="text-lg font-semibold text-white">{paymentData.course_title}</p>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {/* Cohort */}
                  <div className="flex items-start gap-3 bg-gray-900/30 rounded-lg p-4 border border-gray-700/50">
                    <Building className="w-5 h-5 text-amber-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Cohort</p>
                      <p className="text-lg font-semibold text-white">{paymentData.cohort_label || '—'}</p>
                    </div>
                  </div>
                  {/* Date */}
                  <div className="flex items-start gap-3 bg-gray-900/30 rounded-lg p-4 border border-gray-700/50">
                    <Calendar className="w-5 h-5 text-rose-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Verified On</p>
                      <p className="text-lg font-semibold text-white">
                        {formatDate(paymentData.payment_verified_at)}
                      </p>
                    </div>
                  </div>
                </div>                  {/* Scholarship Info */}
                  {paymentData.scholarship_info && (
                    <div className={
                      paymentData.scholarship_info.scholarship_type === 'full'
                        ? 'bg-gradient-to-r from-emerald-900/40 to-teal-900/40 rounded-xl p-5 border border-emerald-700/30'
                        : 'bg-gradient-to-r from-blue-900/40 to-indigo-900/40 rounded-xl p-5 border border-blue-700/30'
                    }>
                      <div className="flex items-start gap-3">
                        <span className="text-3xl">🎓</span>
                        <div className="flex-1">
                          {paymentData.scholarship_info.scholarship_type === 'full' ? (
                            <>
                              <p className="text-emerald-400 font-bold text-base">Full Scholarship</p>
                              <p className="text-emerald-300/70 text-sm mt-1">100% tuition covered — no payment required</p>
                            </>
                          ) : (
                            <>
                              <p className="text-blue-300 font-bold text-base">
                                Partial Scholarship — {paymentData.scholarship_info.scholarship_percentage?.toFixed(0)}% Covered
                              </p>
                              <p className="text-blue-200/70 text-sm mt-1">
                                Original price: <span className="line-through text-blue-300/50">
                                  {formatCurrency(paymentData.scholarship_info.original_price || 0, paymentData.scholarship_info.currency)}
                                </span>
                                &nbsp;&nbsp;You pay: <strong className="text-amber-400">
                                  {formatCurrency(paymentData.scholarship_info.effective_amount, paymentData.scholarship_info.currency)}
                                </strong>
                                <span className="text-blue-200/50 text-xs ml-2">
                                  (Saved {formatCurrency(
                                    (paymentData.scholarship_info.original_price || 0) - paymentData.scholarship_info.effective_amount,
                                    paymentData.scholarship_info.currency
                                  )})
                                </span>
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Verification Details */}
                <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Verification Details</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Record ID</span>
                      <span className="text-white font-mono">
                        #{paymentData.enrollment_id || paymentData.application_id || '—'}
                        {paymentData.source === 'enrollment' ? ' (Enrollment)' : ' (Application)'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Payment Status</span>
                      <Badge variant="outline" className={
                        paymentData.payment_status === 'completed'
                          ? 'border-emerald-500 text-emerald-400'
                          : paymentData.payment_status === 'waived'
                          ? 'border-blue-500 text-blue-400'
                          : 'border-gray-500 text-gray-400'
                      }>
                        {paymentData.payment_status === 'completed' ? '✅ Completed' :
                         paymentData.payment_status === 'waived' ? '🔄 Waived' :
                         paymentData.payment_status}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Verified</span>
                      <span className={paymentData.payment_verified ? "text-emerald-400" : "text-red-400"}>
                        {paymentData.payment_verified ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Authenticity Seal */}
                <div className="text-center py-2">
                  <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-2">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400 text-sm font-medium">
                      Digitally Verified by Afritech Bridge
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Info */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="p-6">
                <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-400">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    <span>afritech.bridge@yahoo.com</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    <span>+250 780 784 924</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-center gap-4">
              <Button asChild className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700">
                <Link href="/">
                  <Building className="w-4 h-4 mr-2" />
                  Visit Afritech Bridge
                </Link>
              </Button>
            </div>
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-white/10 mt-auto">
        <div className="max-w-4xl mx-auto text-center text-gray-400 text-sm">
          <p>&copy; {new Date().getFullYear()} Afritech Bridge. All rights reserved.</p>
          <p className="mt-2">
            <Link href="https://study.afritechbridge.online" className="text-emerald-400 hover:underline">
              study.afritechbridge.online
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
