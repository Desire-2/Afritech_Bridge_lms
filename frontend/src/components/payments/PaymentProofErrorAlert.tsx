'use client';

import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PaymentProofErrorAlertProps {
  /** Error text to show — usually the backend's `error`/`message` field. */
  message: string;
  /**
   * `verification.reason` from a 422 upload response, when present. Turns
   * the plain error line into a structured card: friendly headline plus the
   * acceptance checklist, instead of a wall of tiny red text.
   */
  verificationReason?: string | null;
  className?: string;
}

export default function PaymentProofErrorAlert({
  message,
  verificationReason = null,
  className = '',
}: PaymentProofErrorAlertProps) {
  const isVerificationFailure = Boolean(verificationReason);
  // The OCR-outage message is a server problem, not a receipt problem —
  // don't tell people to fix their screenshot when our engine is down.
  const showChecklist =
    isVerificationFailure && verificationReason !== 'ocr_engine_unavailable';

  return (
    <Alert className={`border-2 border-red-200 bg-red-50 ${className}`}>
      <AlertCircle className="h-4 w-4 text-red-600" />
      <AlertDescription className="text-red-800 text-sm ml-3">
        {isVerificationFailure && (
          <p className="font-semibold text-red-900 mb-1">
            Payment proof couldn&apos;t be verified
          </p>
        )}
        <p className="leading-relaxed break-words">{message}</p>
        {showChecklist && (
          <div className="mt-2.5 rounded-lg border border-red-200 bg-white/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-900 mb-1.5">
              An acceptable proof shows
            </p>
            <ul className="space-y-1 text-xs text-red-800 list-disc list-inside">
              <li>
                <span className="font-semibold">AfriTech Bridge as the receiver</span>{' '}
                — often appears right after the word &quot;to&quot;
              </li>
              <li>
                <span className="font-semibold">A completed or successful status</span>{' '}
                — pending, failed or confirm-your-PIN screens are rejected
              </li>
              <li>
                <span className="font-semibold">The full receipt</span> — amount,
                date and reference, clear and not cropped
              </li>
            </ul>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
