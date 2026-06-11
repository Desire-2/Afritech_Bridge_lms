'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import PaymentSlip, { PaymentSlipData } from '@/components/payments/PaymentSlip';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';

type VerifyStatus = 'verifying' | 'success' | 'failed';

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const courseId = searchParams.get('course_id');
  const courseName = searchParams.get('course_name') || '';
  // PayPal returns: ?token=ORDER_ID&PayerID=PAYER_ID
  const paypalToken = searchParams.get('token');
  // Stripe returns: ?session_id=SESSION_ID
  const stripeSessionId = searchParams.get('session_id');
  // Flutterwave v4 returns: ?status=successful&checkout_session_id=che_xxx or ?tx_ref=xxx
  const fwCheckoutSession = searchParams.get('checkout_session_id');
  const fwTxRef = searchParams.get('tx_ref');
  const [status, setStatus] = useState<VerifyStatus>('verifying');
  const [message, setMessage] = useState('Verifying your payment…');
  const [reference, setReference] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(5);
  const [slipData, setSlipData] = useState<PaymentSlipData | null>(null);

  useEffect(() => {
    if (!courseId) {
      setStatus('failed');
      setMessage('Missing course information. Please contact support.');
      return;
    }

    let paymentMethod: string;
    let paymentReference: string | null = null;

    if (paypalToken) {
      paymentMethod = 'paypal';
      paymentReference = paypalToken;
    } else if (stripeSessionId) {
      paymentMethod = 'stripe';
      paymentReference = stripeSessionId;
    } else if (fwCheckoutSession) {
      paymentMethod = 'flutterwave';
      paymentReference = fwCheckoutSession;
    } else if (fwTxRef) {
      paymentMethod = 'flutterwave';
      paymentReference = localStorage.getItem('flutterwave_charge_id') || fwTxRef;
    } else {
      const storedKpay = localStorage.getItem('kpay_reference');
      const storedFlutterwave = localStorage.getItem('flutterwave_charge_id');
      const storedPaypal = localStorage.getItem('paypal_order_id');
      const storedStripe = localStorage.getItem('stripe_session_id');
      if (storedKpay) {
        paymentMethod = 'kpay';
        paymentReference = storedKpay;
      } else if (storedFlutterwave) {
        paymentMethod = 'flutterwave';
        paymentReference = storedFlutterwave;
      } else if (storedPaypal) {
        paymentMethod = 'paypal';
        paymentReference = storedPaypal;
      } else if (storedStripe) {
        paymentMethod = 'stripe';
        paymentReference = storedStripe;
      } else {
        setStatus('failed');
        setMessage('No payment reference found. The payment may have already been processed, or the session expired.');
        return;
      }
    }

    const verify = async () => {
      try {
        const res = await fetch(`${API_BASE}/applications/verify-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payment_method: paymentMethod,
            reference: paymentReference,
            course_id: parseInt(courseId, 10),
          }),
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = await res.json();

        if (res.ok && (data.status === 'completed' || data.status === 'approved' || data.status === 'SUCCESSFUL')) {
          localStorage.setItem(`payment_verified_for_course_${courseId}`, 'true');
          localStorage.setItem(`payment_reference_for_course_${courseId}`, paymentReference!);
          localStorage.setItem(`payment_method_for_course_${courseId}`, paymentMethod);
          localStorage.removeItem('paypal_order_id');
          localStorage.removeItem('stripe_session_id');
          localStorage.removeItem('kpay_reference');
          localStorage.removeItem('kpay_tid');
          localStorage.removeItem('flutterwave_charge_id');
          localStorage.removeItem('flutterwave_reference');

          setReference(paymentReference);

          // Fetch course name if not provided in URL
          let resolvedCourseName = courseName;
          if (!resolvedCourseName && courseId) {
            try {
              const courseRes = await fetch(`${API_BASE}/courses/${courseId}`);
              if (courseRes.ok) {
                const courseData = await courseRes.json();
                resolvedCourseName = courseData.title || '';
              }
            } catch { /* use fallback */ }
          }

          // Build slip data
          const studentName = localStorage.getItem('user_name') || localStorage.getItem('applicant_name') || 'Student';
          setSlipData({
            studentName,
            courseTitle: resolvedCourseName || 'Course',
            amount: parseFloat(data.amount || data.amount_paid || '0') || 0,
            currency: data.currency || 'USD',
            paymentMethod,
            reference: paymentReference || undefined,
            paymentDate: new Date(),
            status: 'completed',
            enrollmentId: data.enrollment_id,
            originalPrice: data.original_price ? parseFloat(data.original_price) : undefined,
            scholarshipPercentage: data.scholarship_percentage ? parseFloat(data.scholarship_percentage) : undefined,
            isPartial: data.is_partial || false,
          });

          setStatus('success');
          setMessage('Payment verified successfully!');
        } else {
          setStatus('failed');
          setMessage(data.message || `Payment verification returned status: ${data.status}. Please contact support if you were charged.`);
        }
      } catch {
        setStatus('failed');
        setMessage('Unable to verify payment. Please check your connection and try again, or contact support.');
      }
    };

    verify();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-redirect countdown on success
  useEffect(() => {
    if (status !== 'success' || !courseId) return;
    if (countdown <= 0) {
      router.push(`/courses/${courseId}/apply?payment_verified=true`);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [status, countdown, courseId, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#132d54] to-[#1a3a6b] flex items-center justify-center p-4">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute top-1/3 left-1/4 w-64 h-64 rounded-full bg-teal-400/5" />
      </div>

      <div className="relative z-10 w-full max-w-lg">
        {/* Verifying State */}
        {status === 'verifying' && (
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 p-10 text-center">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 border-4 border-teal-400 border-t-transparent rounded-full animate-spin" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Verifying Payment</h1>
            <p className="text-white/60 text-sm">{message}</p>
            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-white/40">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-emerald-400">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
              </svg>
              <span>Secure verification in progress</span>
            </div>
          </div>
        )}

        {/* Success State — Branded Payment Slip */}
        {status === 'success' && slipData && (
          <div className="space-y-4">
            <PaymentSlip data={slipData} />

            {/* Redirect countdown */}
            <div className="text-center print:hidden">
              <p className="text-sm text-white/60">
                Redirecting to your application in{' '}
                <span className="font-bold text-teal-400">{countdown}s</span>…
              </p>
              <Link
                href={`/courses/${courseId}/apply?payment_verified=true`}
                className="mt-3 inline-block px-6 py-2.5 bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold rounded-xl transition-colors"
              >
                Continue Application Now
              </Link>
            </div>
          </div>
        )}

        {/* Failed State */}
        {status === 'failed' && (
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 p-10 text-center">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Verification Failed</h1>
            <p className="text-white/60 text-sm mb-6">{message}</p>
            <div className="flex flex-col gap-3">
              {courseId && (
                <Link
                  href={`/courses/${courseId}/apply`}
                  className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
                >
                  Return to Application
                </Link>
              )}
              <Link
                href="/courses"
                className="w-full border border-white/20 hover:bg-white/10 text-white/70 font-semibold py-3 px-6 rounded-xl transition-colors"
              >
                Browse Courses
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-[#0a1628] to-[#1a3a6b] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-teal-400 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}
