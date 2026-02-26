'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';

type VerifyStatus = 'verifying' | 'success' | 'failed';

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const courseId = searchParams.get('course_id');
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
      // Flutterwave v4 redirect with checkout session ID in URL
      paymentMethod = 'flutterwave';
      paymentReference = fwCheckoutSession;
    } else if (fwTxRef) {
      // Flutterwave fallback: tx_ref in URL — use stored charge_id for verification
      paymentMethod = 'flutterwave';
      paymentReference = localStorage.getItem('flutterwave_charge_id') || fwTxRef;
    } else {
      // Fall back to localStorage (K-Pay, Flutterwave, PayPal, Stripe via stored refs)
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
          // Store verification so the application form can pick it up
          localStorage.setItem(`payment_verified_for_course_${courseId}`, 'true');
          localStorage.setItem(`payment_reference_for_course_${courseId}`, paymentReference!);
          localStorage.setItem(`payment_method_for_course_${courseId}`, paymentMethod);
          // Clean up order refs
          localStorage.removeItem('paypal_order_id');
          localStorage.removeItem('stripe_session_id');
          localStorage.removeItem('kpay_reference');
          localStorage.removeItem('kpay_tid');
          localStorage.removeItem('flutterwave_charge_id');
          localStorage.removeItem('flutterwave_reference');

          setReference(paymentReference);
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 text-center">

        {/* Verifying */}
        {status === 'verifying' && (
          <>
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <h1 className="text-xl font-semibold text-gray-800 mb-2">Verifying Payment</h1>
            <p className="text-gray-500 text-sm">{message}</p>
          </>
        )}

        {/* Success */}
        {status === 'success' && (
          <>
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Confirmed!</h1>
            <p className="text-gray-600 mb-4">{message}</p>
            {reference && (
              <p className="text-xs text-gray-400 mb-6 break-all">
                Reference: <span className="font-mono">{reference}</span>
              </p>
            )}
            <p className="text-sm text-blue-600 mb-4">
              Redirecting back to your application in <strong>{countdown}s</strong>…
            </p>
            <Link
              href={`/courses/${courseId}/apply?payment_verified=true`}
              className="inline-block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              Continue Application Now
            </Link>
          </>
        )}

        {/* Failed */}
        {status === 'failed' && (
          <>
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Verification Failed</h1>
            <p className="text-gray-600 mb-6 text-sm">{message}</p>
            <div className="flex flex-col gap-3">
              {courseId && (
                <Link
                  href={`/courses/${courseId}/apply`}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
                >
                  Return to Application
                </Link>
              )}
              <Link
                href="/courses"
                className="w-full border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-3 px-6 rounded-xl transition-colors"
              >
                Browse Courses
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}
