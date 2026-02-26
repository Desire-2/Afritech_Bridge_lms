'use client';

import React from 'react';
import { AlertTriangle, CreditCard, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface PaymentStatusBannerProps {
  paymentRequired: boolean;
  paymentStatus?: string | null;
  paymentVerified?: boolean;
  accessAllowed?: boolean;
  accessReason?: string;
  enrollmentStatus?: string;
  courseName?: string;
  cohortLabel?: string;
}

/**
 * Banner displayed on the student dashboard and course page
 * when enrollment is in a paid cohort and payment hasn't been verified.
 */
export default function PaymentStatusBanner({
  paymentRequired,
  paymentStatus,
  paymentVerified,
  accessAllowed,
  accessReason,
  enrollmentStatus,
  courseName,
  cohortLabel,
}: PaymentStatusBannerProps) {
  // Don't show anything if no payment is required or payment is verified
  if (!paymentRequired && accessAllowed !== false) return null;
  if (paymentVerified && accessAllowed) return null;

  // Payment completed but not yet admin-verified
  if (paymentStatus === 'completed' && !paymentVerified) {
    return (
      <Alert className="border-blue-200 bg-blue-50 mb-4">
        <Clock className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-800">Payment Under Review</AlertTitle>
        <AlertDescription className="text-blue-700">
          <p>
            Your payment for <strong>{courseName}</strong>
            {cohortLabel && <> ({cohortLabel})</>} has been received and is being verified.
            You&apos;ll get full access once an admin confirms it.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="outline" className="border-blue-300 text-blue-700">
              <Clock className="h-3 w-3 mr-1" /> Verification Pending
            </Badge>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // Payment waived — all good
  if (paymentStatus === 'waived') {
    return (
      <Alert className="border-green-200 bg-green-50 mb-4">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-800">Payment Waived</AlertTitle>
        <AlertDescription className="text-green-700">
          Your payment for <strong>{courseName}</strong> has been waived. You have full access.
        </AlertDescription>
      </Alert>
    );
  }

  // Enrollment is pending_payment — hasn't paid yet
  if (enrollmentStatus === 'pending_payment' || (paymentRequired && !paymentVerified && paymentStatus !== 'completed')) {
    return (
      <Alert className="border-amber-200 bg-amber-50 mb-4">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800 flex items-center gap-2">
          Payment Required
          <Badge variant="destructive" className="text-xs">
            <CreditCard className="h-3 w-3 mr-1" /> Unpaid
          </Badge>
        </AlertTitle>
        <AlertDescription className="text-amber-700">
          <p>
            Your enrollment in <strong>{courseName}</strong>
            {cohortLabel && <> ({cohortLabel})</>} requires payment before you can access the course content.
          </p>
          <p className="mt-2 text-sm">
            Please complete your payment to unlock the learning materials.
            If you&apos;ve already paid, contact support so an admin can verify your payment.
          </p>
          {accessReason && (
            <p className="mt-1 text-xs text-amber-600 italic">{accessReason}</p>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  // Payment failed
  if (paymentStatus === 'failed') {
    return (
      <Alert className="border-red-200 bg-red-50 mb-4">
        <XCircle className="h-4 w-4 text-red-600" />
        <AlertTitle className="text-red-800">Payment Failed</AlertTitle>
        <AlertDescription className="text-red-700">
          <p>
            Your payment for <strong>{courseName}</strong> could not be processed.
            Please try again or contact support for assistance.
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  // Generic access blocked
  if (!accessAllowed) {
    return (
      <Alert className="border-red-200 bg-red-50 mb-4">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <AlertTitle className="text-red-800">Access Restricted</AlertTitle>
        <AlertDescription className="text-red-700">
          {accessReason || 'Your access to this course is currently restricted. Please contact an administrator.'}
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
