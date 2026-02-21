'use client';

import React, { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function PaymentCancelContent() {
  const searchParams = useSearchParams();
  const courseId = searchParams.get('course_id');

  useEffect(() => {
    // Clean up payment order references but keep the form data
    // so the user doesn't have to re-fill the application
    localStorage.removeItem('paypal_order_id');
    localStorage.removeItem('stripe_session_id');
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 text-center">

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Canceled</h1>
        <p className="text-gray-600 mb-2">
          Your payment was not completed. You have not been charged.
        </p>
        <p className="text-gray-500 text-sm mb-8">
          Your application form data has been saved. You can return and try again whenever you&apos;re ready.
        </p>

        <div className="flex flex-col gap-3">
          {courseId ? (
            <Link
              href={`/courses/${courseId}/apply`}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              Return to Application
            </Link>
          ) : null}
          <Link
            href="/courses"
            className="w-full border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            Browse Courses
          </Link>
        </div>

        {/* Help note */}
        <p className="text-xs text-gray-400 mt-6">
          If you believe you were charged in error, please contact{' '}
          <a href="mailto:support@afritechbridge.online" className="text-blue-500 hover:underline">
            support@afritechbridge.online
          </a>
        </p>
      </div>
    </div>
  );
}

export default function PaymentCancelPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <PaymentCancelContent />
    </Suspense>
  );
}
