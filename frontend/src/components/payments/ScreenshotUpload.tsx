'use client';

import React, { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, CheckCircle2, Loader2, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

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

  // Use the same endpoint as Bank Transfer for MoMo Pay Code (no auth required)
  const usePaymentSlipEndpoint = paymentMethod === 'momo_pay_code' || paymentMethod === 'bank_transfer';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Only JPEG, PNG, and WebP images are allowed.');
      onError?.('Invalid file type');
      return;
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`File too large. Maximum size is 5MB, got ${(file.size / 1024 / 1024).toFixed(1)}MB`);
      onError?.('File too large');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    setSelectedFile(file);
    setError(null);

    // Auto-upload for manual payment methods
    if (autoUpload) {
      handleUploadInternal(file);
    }
  };

  const handleUploadInternal = async (fileToUpload: File) => {
    setLoading(true);
    setError(null);

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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to upload file');
      }

      setUploaded(true);
      setSelectedFile(null);
      setPreview(null);
      onSuccess?.();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setPreview(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (uploaded) {
    return (
      <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-1" />
          <div>
            <h4 className="font-bold text-emerald-900 mb-1">Screenshot Submitted!</h4>
            <p className="text-sm text-emerald-800">
              Your payment proof has been uploaded successfully. An administrator will verify it shortly.
              You will receive an email notification once your payment is confirmed.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-2xl p-6 border-2 border-dashed border-gray-300">
      <div className="space-y-4">
        {/* Title */}
        <div>
          <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-yellow-600" />
            Upload Payment Proof
          </h4>
          <p className="text-sm text-gray-600">
            Take a screenshot of the payment confirmation screen and upload it below
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert className="border-2 border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800 text-sm ml-3">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Preview */}
        {preview ? (
          <div className="relative inline-block w-full">
            <div className="bg-white rounded-xl p-2 border-2 border-gray-200">
              <img
                src={preview}
                alt="Screenshot preview"
                className="w-full h-auto rounded-lg max-h-64 object-contain"
              />
            </div>
            <div className="mt-2 flex gap-2">
              <p className="text-sm text-gray-600 flex-1">
                {selectedFile?.name} ({(selectedFile?.size || 0 / 1024).toFixed(1)} KB)
              </p>
              <button
                onClick={handleClear}
                className="text-gray-500 hover:text-red-600 transition-colors"
                disabled={loading}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
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
              JPEG, PNG, or WebP • Max 5MB
            </p>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Upload Button - only show for manual upload */}
        {selectedFile && !autoUpload && (
          <Button
            onClick={() => handleUploadInternal(selectedFile)}
            disabled={loading}
            className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Submit Screenshot
              </>
            )}
          </Button>
        )}

        {/* Auto-upload status for manual payment methods */}
        {selectedFile && autoUpload && (
          <div className="flex items-center justify-center gap-2 p-3 bg-blue-50 border-2 border-blue-300 rounded-lg">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            <p className="text-sm font-semibold text-blue-700">Uploading...</p>
          </div>
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
