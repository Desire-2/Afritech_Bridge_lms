'use client';

import React, { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, FileText, CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PaymentProofErrorAlert from '@/components/payments/PaymentProofErrorAlert';
import PaymentVerifyingSpinner from '@/components/payments/PaymentVerifyingSpinner';

interface ScreenshotUploadProps {
  applicationId: number;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  apiUrl?: string;
  paymentMethod?: 'momo_pay_code' | 'bank_transfer' | 'default';
  applicantEmail?: string;
  autoUpload?: boolean;
}

export default function ScreenshotUpload({
  applicationId,
  onSuccess,
  onError,
  apiUrl,
  paymentMethod = 'default',
  applicantEmail,
  autoUpload = false,
}: ScreenshotUploadProps) {
  const API = apiUrl || process.env.NEXT_PUBLIC_API_URL || '';
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationReason, setVerificationReason] = useState<string | null>(null);

  // Use the same endpoint as Bank Transfer for MoMo Pay Code (no auth required)
  const usePaymentSlipEndpoint = paymentMethod === 'momo_pay_code' || paymentMethod === 'bank_transfer';

  // Spinner tone matches the surrounding payment panel (MoMo = yellow, bank = emerald)
  const spinnerTone =
    paymentMethod === 'bank_transfer'
      ? 'emerald'
      : paymentMethod === 'momo_pay_code'
        ? 'yellow'
        : 'blue';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type (same as Bank Transfer slip upload)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Only JPEG, PNG, WebP, or PDF files are allowed.');
      onError?.('Invalid file type');
      return;
    }

    // Validate file size (10MB max, same as Bank Transfer slip upload)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`File too large. Maximum size is 10MB, got ${(file.size / 1024 / 1024).toFixed(1)}MB`);
      onError?.('File too large');
      return;
    }

    // Create preview (images only — PDFs render as a file row instead)
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }

    setSelectedFile(file);
    setError(null);
    setVerificationReason(null);

    // Auto-upload for manual payment methods
    if (autoUpload) {
      handleUploadInternal(file);
    }
  };

  const handleUploadInternal = async (fileToUpload: File) => {
    setLoading(true);
    setError(null);
    setVerificationReason(null);
    // Captured from the 422 payload so the alert can render the structured
    // verification card once we land in the catch block.
    let reason: string | null = null;

    try {
      const formData = new FormData();
      
      // Use 'file' for payment-slip endpoint, 'screenshot' for screenshot endpoint
      if (usePaymentSlipEndpoint) {
        formData.append('file', fileToUpload);
      } else {
        formData.append('screenshot', fileToUpload);
      }

      // Choose endpoint based on payment method
      let endpoint = `${API}/applications/${applicationId}/upload-payment-screenshot`;
      const headers: HeadersInit = {
        'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`,
      };

      if (usePaymentSlipEndpoint) {
        // Use payment-slip endpoint for MoMo Pay Code and Bank Transfer (no auth required)
        endpoint = `${API}/applications/${applicationId}/upload-payment-slip`;
        // Add email verification for unauthenticated uploads
        const email = applicantEmail || localStorage.getItem('applicant_email') || '';
        if (email) {
          endpoint += `?email=${encodeURIComponent(email)}`;
        }
        // Remove auth header for unauthenticated endpoint
        delete headers['Authorization'];
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        headers: usePaymentSlipEndpoint ? {} : headers,
      });

      const data: any = await response.json();

      if (!response.ok) {
        reason = data?.verification?.reason ?? null;
        throw new Error(data.error || data.message || 'Failed to upload file');
      }

      // Keep selectedFile so the success card can show which proof was verified
      setUploaded(true);
      onSuccess?.();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMsg);
      setVerificationReason(reason);
      onError?.(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setPreview(null);
    setError(null);
    setVerificationReason(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Bank Transfer parity: after a verified upload the zone stays in place and
  // the user can swap the proof without reloading the page.
  const handleReplace = () => {
    setUploaded(false);
    handleClear();
  };

  if (uploaded) {
    return (
      <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-1" />
          <div className="min-w-0">
            <h4 className="font-bold text-emerald-900 mb-1">Payment Proof Verified!</h4>
            <p className="text-sm text-emerald-800">
              Your payment proof passed automatic verification and was uploaded successfully.
              An administrator will do a final confirmation — you will receive an email
              notification once your payment is confirmed.
            </p>
            {selectedFile && (
              <p className="text-xs text-emerald-600 mt-1.5 truncate">{selectedFile.name}</p>
            )}
            <button
              type="button"
              onClick={handleReplace}
              className="mt-3 text-xs font-semibold text-emerald-700 hover:text-emerald-900 border border-emerald-300 hover:bg-emerald-100 px-3 py-1.5 rounded-md transition-colors"
            >
              Upload a different proof
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-2xl p-4 sm:p-6 border-2 border-dashed border-gray-300">
      <div className="space-y-4">
        {/* Title */}
        <div>
          <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-yellow-600" />
            Upload Payment Proof
          </h4>
          <p className="text-sm text-gray-600">
            Take a screenshot or receipt of your payment confirmation and upload it below
          </p>
        </div>

        {/* Preview / selected file / drop zone */}
        {selectedFile ? (
          preview ? (
            <div className="relative inline-block w-full">
              <div className="bg-white rounded-xl p-2 border-2 border-gray-200">
                <img
                  src={preview}
                  alt="Screenshot preview"
                  className={`w-full h-auto rounded-lg max-h-64 object-contain transition-opacity duration-300 ${
                    loading ? 'opacity-60' : ''
                  }`}
                />
              </div>
              <div className="mt-2 flex gap-2">
                <p className="text-sm text-gray-600 flex-1">
                  {selectedFile.name} ({((selectedFile.size || 0) / 1024).toFixed(1)} KB)
                </p>
                <button
                  onClick={handleClear}
                  className="text-gray-500 hover:text-red-600 transition-colors disabled:opacity-50"
                  disabled={loading}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-white rounded-xl p-4 border-2 border-gray-200">
              <FileText className="w-7 h-7 text-gray-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">{selectedFile.name}</p>
                <p className="text-xs text-gray-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
              </div>
              <button
                onClick={handleClear}
                className="p-1 text-gray-500 hover:text-red-600 transition-colors disabled:opacity-50"
                disabled={loading}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-400 rounded-xl p-8 text-center cursor-pointer hover:border-yellow-600 hover:bg-yellow-50 transition-colors"
          >
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
            <p className="font-semibold text-gray-700 mb-1">
              Click to select or drag & drop
            </p>
            <p className="text-sm text-gray-500">
              JPEG, PNG, WebP, or PDF • Max 10MB
            </p>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Error Alert — sits below the upload area, matching the Bank Transfer slip zone */}
        {error && (
          <PaymentProofErrorAlert message={error} verificationReason={verificationReason} />
        )}

        {/* Verification in progress — the file above stays visible while the server runs OCR.
            Only shown while the request is actually in flight so the spinner always stops. */}
        {loading ? (
          <PaymentVerifyingSpinner tone={spinnerTone} />
        ) : (
          selectedFile &&
          (!autoUpload || error) && (
            <Button
              onClick={() => handleUploadInternal(selectedFile)}
              className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
            >
              <Upload className="w-5 h-5" />
              {autoUpload ? 'Try again' : 'Submit Screenshot'}
            </Button>
          )
        )}

        {/* Info */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded-r text-sm text-blue-800">
          <p className="font-semibold mb-1">📸 What to screenshot:</p>
          <ul className="ml-4 space-y-1">
            <li>✓ The payment confirmation message from your phone</li>
            <li>✓ Transaction ID or reference number (if visible)</li>
            <li>✓ Amount and timestamp</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
