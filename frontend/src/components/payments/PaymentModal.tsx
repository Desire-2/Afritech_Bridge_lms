'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  X,
  AlertCircle,
  Clock,
  Globe,
  Building2,
  Copy,
  Check,
  Shield,
  Zap,
  Phone,
  TrendingDown,
  Info,
  Upload,
  Image as ImageIcon,
  CheckSquare,
  AlertTriangle as TriangleAlert,
} from 'lucide-react';

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: number;
  courseName: string;
  amount: number;
  currency: string;
  enrollmentId: number;
  cohortId?: number;
  isPartialScholarship?: boolean;
  scholarshipPercentage?: number;
  paymentMethods: string[];
  onPaymentSuccess?: () => void;
}

export default function PaymentModal({
  open,
  onOpenChange,
  courseId,
  courseName,
  amount,
  currency,
  enrollmentId,
  cohortId,
  isPartialScholarship = false,
  scholarshipPercentage = 0,
  paymentMethods = ['kpay', 'paypal', 'mobile_money'],
  onPaymentSuccess,
}: PaymentModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'awaiting_confirmation' | 'success' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    payer_name: '',
    phone_number: '',
    email: localStorage.getItem('user_email') || '',
  });
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Manual payment method state (bank_transfer, momo_pay_code)
  const [bankDetails, setBankDetails] = useState<string | null>(null);
  const [bankTransferMessage, setBankTransferMessage] = useState<string | null>(null);
  const [ussdCode, setUssdCode] = useState<string | null>(null);
  const [recipientName, setRecipientName] = useState<string | null>(null);
  const [momoInstructions, setMomoInstructions] = useState<string | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);

  // Confirmation dialog before closing mid-flow
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  // Screenshot upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Payment method metadata
  const methodLabels: Record<string, { label: string; sub: string; color: string; icon: React.ReactNode }> = {
    kpay: {
      label: 'K-Pay',
      sub: 'MTN, Airtel, Card, SPENN',
      color: 'violet',
      icon: <CreditCard className="w-5 h-5" />,
    },
    stripe: {
      label: 'Stripe Card',
      sub: 'Visa, Mastercard, Amex',
      color: 'indigo',
      icon: <CreditCard className="w-5 h-5" />,
    },
    paypal: {
      label: 'PayPal',
      sub: 'PayPal account',
      color: 'blue',
      icon: <CreditCard className="w-5 h-5" />,
    },
    flutterwave: {
      label: 'Flutterwave',
      sub: 'Card, Mobile Money, Bank',
      color: 'orange',
      icon: <Globe className="w-5 h-5" />,
    },
    mobile_money: {
      label: 'Mobile Money',
      sub: 'MTN, Airtel MoMo',
      color: 'yellow',
      icon: <Phone className="w-5 h-5" />,
    },
    bank_transfer: {
      label: 'Bank Transfer',
      sub: 'Manual wire transfer',
      color: 'emerald',
      icon: <Building2 className="w-5 h-5" />,
    },
    momo_pay_code: {
      label: 'MoMo Pay Code',
      sub: 'USSD dial',
      color: 'yellow',
      icon: <Phone className="w-5 h-5" />,
    },
  };

  // Filter and validate payment methods
  const enabledMethods = paymentMethods.filter((m) => {
    const hasMetadata = Object.keys(methodLabels).includes(m);
    return hasMetadata;
  });

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setPaymentStatus('idle');
      setSelectedMethod(null);
      setError(null);
      setPaymentReference(null);
      setPaymentConfirmed(false);
      setBankDetails(null);
      setBankTransferMessage(null);
      setUssdCode(null);
      setRecipientName(null);
      setMomoInstructions(null);
      setSelectedFile(null);
      setPreview(null);
      setUploadLoading(false);
      setUploaded(false);
      setUploadError(null);
    }
  }, [open]);

  // If no methods are enabled, show error state
  if (enabledMethods.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payment Methods Unavailable</DialogTitle>
          </DialogHeader>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-amber-800">No payment methods available</p>
              <p className="text-sm text-amber-700 mt-1">This course does not have any payment methods configured. Please contact support.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const totalPrice = scholarshipPercentage ? (amount / (1 - scholarshipPercentage / 100)) : amount;
  const scholarshipAmount = totalPrice - amount;

  // Handle payment initiation
  const handlePayNow = async () => {
    if (!selectedMethod) {
      setError('Please select a payment method');
      return;
    }

    setPaymentLoading(true);
    setError(null);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/enrollments/${enrollmentId}/initiate-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          payment_method: selectedMethod,
          amount,
          currency,
          payer_name: formData.payer_name,
          phone_number: formData.phone_number,
          email: formData.email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Payment initiation failed');
      }

      setPaymentReference(data.reference || null);

      // ── Manual payment methods: show instructions with screenshot upload ──
      if (selectedMethod === 'bank_transfer') {
        setBankDetails(data.bank_details || null);
        setBankTransferMessage(data.message || null);
        setPaymentStatus('awaiting_confirmation');
      } else if (selectedMethod === 'momo_pay_code') {
        setUssdCode(data.ussd_code || null);
        setRecipientName(data.recipient_name || 'MTN MoMo');
        setMomoInstructions(data.instructions || null);
        setPaymentStatus('awaiting_confirmation');
      } else {
        // ── Auto payment methods: redirect or show processing ──
        setPaymentStatus('processing');

        // Redirect for third-party providers
        if (selectedMethod === 'stripe' && data.checkout_url) {
          window.location.href = data.checkout_url;
        } else if (selectedMethod === 'paypal' && data.approval_url) {
          window.location.href = data.approval_url;
        } else if (selectedMethod === 'kpay' && data.checkout_url) {
          window.location.href = data.checkout_url;
        } else if (selectedMethod === 'flutterwave' && data.checkout_url) {
          window.location.href = data.checkout_url;
        }
      }
    } catch (err) {
      setPaymentStatus('failed');
      setError(err instanceof Error ? err.message : 'Payment initiation failed');
    } finally {
      setPaymentLoading(false);
    }
  };

  // Handle screenshot upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Invalid file type. Only JPEG, PNG, and WebP images are allowed.');
      return;
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setUploadError(`File too large. Maximum size is 5MB, got ${(file.size / 1024 / 1024).toFixed(1)}MB`);
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    setSelectedFile(file);
    setUploadError(null);

    // Auto-upload immediately (same as application form ScreenshotUpload component)
    handleUploadScreenshotInternal(file);
  };

  const handleUploadScreenshotInternal = async (fileToUpload: File) => {
    setUploadLoading(true);
    setUploadError(null);

    try {
      const fd = new FormData();
      fd.append('file', fileToUpload);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/enrollments/${enrollmentId}/upload-payment-slip`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: fd,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to upload file');
      }

      setUploaded(true);
      setSelectedFile(null);
      setPreview(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Upload failed';
      setUploadError(errorMsg);
    } finally {
      setUploadLoading(false);
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setPreview(null);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  const handleConfirmPayment = () => {
    setPaymentConfirmed(true);
    setPaymentStatus('success');
  };

  // Completely close and reset everything
  const forceClose = () => {
    onOpenChange(false);
    setPaymentStatus('idle');
    setSelectedMethod(null);
    setError(null);
    setPaymentReference(null);
    setBankDetails(null);
    setBankTransferMessage(null);
    setUssdCode(null);
    setRecipientName(null);
    setMomoInstructions(null);
    setSelectedFile(null);
    setPreview(null);
    setUploaded(false);
    setUploadError(null);
    setPaymentConfirmed(false);
    setShowCloseConfirm(false);
  };

  // Intercept close attempts — show confirmation when mid-flow
  const handleClose = (openNext: boolean) => {
    // If the dialog is being told to close (openNext === false)
    // and we're in a mid-flow state, show confirmation
    if (!openNext && paymentStatus === 'awaiting_confirmation') {
      setShowCloseConfirm(true);
      return;
    }

    // Block close during active processing
    if (!openNext && paymentStatus === 'processing') return;

    // Normal close for success state — keep transition message
    if (!openNext && paymentStatus === 'success') {
      onOpenChange(false);
      return;
    }

    // For any other state, just pass through
    onOpenChange(openNext);

    // If closing from idle/failed state, reset
    if (!openNext && (paymentStatus === 'idle' || paymentStatus === 'failed')) {
      setPaymentStatus('idle');
      setSelectedMethod(null);
      setError(null);
      setPaymentReference(null);
      setBankDetails(null);
      setBankTransferMessage(null);
      setUssdCode(null);
      setRecipientName(null);
      setMomoInstructions(null);
      setSelectedFile(null);
      setPreview(null);
      setUploaded(false);
      setUploadError(null);
      setPaymentConfirmed(false);
    }
  };

  return (
    <>
      {/* ── Close Confirmation Dialog ── */}
      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <TriangleAlert className="w-5 h-5 text-amber-500" />
              Cancel Payment?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              {selectedMethod === 'bank_transfer'
                ? 'You have initiated a bank transfer. If you close now, your progress will be lost and you\'ll need to start over.'
                : 'You have started a MoMo Pay Code payment. If you close now, your progress will be lost and you\'ll need to start over.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Payment</AlertDialogCancel>
            <AlertDialogAction
              onClick={forceClose}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Yes, Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Main Payment Modal ── */}
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => {
          // Prevent backdrop click from closing when awaiting confirmation
          if (paymentStatus === 'awaiting_confirmation') {
            e.preventDefault();
            setShowCloseConfirm(true);
          }
        }}>
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-2xl flex items-center gap-2">
                  <CreditCard className="w-6 h-6 text-indigo-600" />
                  {paymentStatus === 'awaiting_confirmation'
                    ? selectedMethod === 'bank_transfer'
                      ? 'Complete Bank Transfer'
                      : 'Complete MoMo Pay Code'
                    : 'Complete Payment'}
                </DialogTitle>
                <DialogDescription className="text-base mt-2">{courseName}</DialogDescription>
              </div>
              <button
                onClick={() => handleClose(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </DialogHeader>

        <div className="space-y-6">
          {/* Header Info - payment methods available */}
          {paymentStatus === 'idle' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-blue-900">Available Payment Methods</p>
                  <p className="text-sm text-blue-700 mt-1">
                    This course accepts {enabledMethods.length} payment {enabledMethods.length === 1 ? 'method' : 'methods'}:
                    <span className="font-semibold ml-1">
                      {enabledMethods.map((m) => {
                        const meta = methodLabels[m];
                        return meta?.label || m;
                      }).join(', ')}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Amount Breakdown */}
          {paymentStatus !== 'success' && (
            <Card className="bg-gradient-to-r from-indigo-50 to-blue-50 border-indigo-200">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {isPartialScholarship && scholarshipAmount > 0 && (
                    <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingDown className="w-4 h-4 text-emerald-600" />
                        <p className="text-xs font-semibold text-gray-600 uppercase">Scholarship</p>
                      </div>
                      <p className="text-2xl font-bold text-emerald-700">
                        {currency} {scholarshipAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-emerald-600 mt-1">{scholarshipPercentage}% covered</p>
                    </div>
                  )}

                  <div className={`${isPartialScholarship ? 'bg-purple-50 border border-purple-200' : 'bg-indigo-50 border border-indigo-200'} rounded-lg p-4`}>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-4 h-4 text-indigo-600" />
                      <p className="text-xs font-semibold text-gray-600 uppercase">Your Payment</p>
                    </div>
                    <p className="text-2xl font-bold text-indigo-700">
                      {currency} {amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-indigo-600 mt-1">Due today</p>
                  </div>

                  {isPartialScholarship && (
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-4 h-4 text-gray-600" />
                        <p className="text-xs font-semibold text-gray-600 uppercase">Total Value</p>
                      </div>
                      <p className="text-2xl font-bold text-gray-700">
                        {currency} {totalPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">Program cost</p>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-2 text-xs text-gray-600 bg-white rounded-lg p-2 border border-gray-200">
                  <Shield className="w-4 h-4 text-blue-600" />
                  <span>Secure payment · 30-day refund policy applies</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-800">{error}</p>
                {paymentStatus === 'failed' && (
                  <p className="text-sm text-red-700 mt-1">Please try again or contact support.</p>
                )}
              </div>
            </div>
          )}

          {/* ── IDLE STATE: Payment Methods Selection ── */}
          {paymentStatus === 'idle' && (
            <>
              <div>
                <div className="mb-4">
                  <Label className="text-base font-bold text-gray-900 mb-2 block">Select Payment Method</Label>
                  <p className="text-sm text-gray-600">
                    {enabledMethods.length} payment {enabledMethods.length === 1 ? 'method' : 'methods'} available
                  </p>
                </div>

                <div className={`grid ${enabledMethods.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'} gap-3`}>
                  {enabledMethods.map((method) => {
                    const meta = methodLabels[method];
                    if (!meta) return null;

                    const isSelected = selectedMethod === method;
                    return (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setSelectedMethod(method)}
                        className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                          isSelected
                            ? `border-${meta.color}-600 bg-${meta.color}-50 shadow-md ring-2 ring-${meta.color}-200`
                            : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg flex-shrink-0 transition-colors ${
                            isSelected ? `bg-${meta.color}-600` : 'bg-gray-100'
                          }`}>
                            <div className={isSelected ? 'text-white' : 'text-gray-600'}>{meta.icon}</div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-bold text-sm ${isSelected ? `text-${meta.color}-900` : 'text-gray-900'}`}>
                              {meta.label}
                            </p>
                            <p className="text-xs text-gray-600 mt-0.5">{meta.sub}</p>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mobile Money Phone Input */}
              {(selectedMethod === 'mobile_money' || selectedMethod === 'kpay' || selectedMethod === 'flutterwave') && (
                <div className="space-y-2">
                  <Label className="font-bold">Phone Number</Label>
                  <Input
                    type="tel"
                    placeholder="e.g. +250700000000"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    className="py-3 border-2 rounded-lg"
                  />
                  <p className="text-xs text-gray-500">Required for Mobile Money payments</p>
                </div>
              )}

              {/* Payer Name Input */}
              {selectedMethod && selectedMethod !== 'bank_transfer' && (
                <div className="space-y-2">
                  <Label className="font-bold">Full Name (Optional)</Label>
                  <Input
                    type="text"
                    placeholder="Your full name"
                    value={formData.payer_name}
                    onChange={(e) => setFormData({ ...formData, payer_name: e.target.value })}
                    className="py-3 border-2 rounded-lg"
                  />
                </div>
              )}

              {/* Pay Now Button */}
              <Button
                onClick={handlePayNow}
                disabled={!selectedMethod || paymentLoading}
                className="w-full py-6 text-lg font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50"
              >
                {paymentLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Initiating Payment...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5 mr-2" />
                    Pay {currency} {amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                  </>
                )}
              </Button>
            </>
          )}

          {/* ── AWAITING CONFIRMATION: Bank Transfer ── */}
          {paymentStatus === 'awaiting_confirmation' && selectedMethod === 'bank_transfer' && (
            <div className="space-y-5">
              {/* Bank Transfer Details */}
              <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <Building2 className="w-6 h-6 text-emerald-700" />
                  <h3 className="font-bold text-emerald-900 text-lg">Bank Transfer Instructions</h3>
                </div>

                {/* Reference */}
                {paymentReference && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Your Payment Reference</p>
                    <div className="flex items-center gap-2 bg-white border-2 border-emerald-300 rounded-xl p-3">
                      <code className="text-lg font-mono font-bold text-emerald-700 flex-1 break-all">
                        {paymentReference}
                      </code>
                      <button
                        onClick={() => copyToClipboard(paymentReference, 'reference')}
                        className="p-2 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100 rounded-lg transition-colors"
                      >
                        {copiedField === 'reference' ? (
                          <Check className="w-5 h-5 text-green-600" />
                        ) : (
                          <Copy className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-emerald-700 mt-1">
                      Include this reference in your transfer so we can identify your payment.
                    </p>
                  </div>
                )}

                {/* Bank Details */}
                {bankDetails && (
                  <div className="bg-white border-2 border-emerald-200 rounded-xl p-4 mb-3">
                    <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Bank Account Details</p>
                    <pre className="text-sm font-mono text-gray-800 whitespace-pre-wrap break-words">
                      {bankDetails}
                    </pre>
                  </div>
                )}

                {/* Copy bank details button */}
                {bankDetails && (
                  <Button
                    onClick={() => copyToClipboard(bankDetails, 'bank_details')}
                    variant="outline"
                    className="w-full border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-100 font-bold py-3 rounded-xl"
                  >
                    {copiedField === 'bank_details' ? (
                      <><Check className="w-5 h-5 mr-2" /> Bank Details Copied!</>
                    ) : (
                      <><Copy className="w-5 h-5 mr-2" /> Copy Bank Details</>
                    )}
                  </Button>
                )}

                {bankTransferMessage && (
                  <p className="text-sm text-emerald-700 mt-3">{bankTransferMessage}</p>
                )}
              </div>

              {/* Screenshot Upload */}
              {!uploaded ? (
                <div className="bg-gray-50 rounded-2xl p-6 border-2 border-dashed border-gray-300">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                        <ImageIcon className="w-5 h-5 text-emerald-600" />
                        Upload Payment Proof
                      </h4>
                      <p className="text-sm text-gray-600">
                        Upload a screenshot or photo of your bank transfer receipt / payment confirmation
                      </p>
                    </div>

                    {/* Error */}
                    {uploadError && (
                      <Alert className="border-2 border-red-200 bg-red-50">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-red-800 text-sm ml-3">
                          {uploadError}
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Preview */}
                    {preview ? (
                      <div className="relative inline-block w-full">
                        <div className="bg-white rounded-xl p-2 border-2 border-gray-200">
                          <img
                            src={preview}
                            alt="Payment proof preview"
                            className="w-full h-auto rounded-lg max-h-64 object-contain"
                          />
                        </div>
                        <div className="mt-2 flex gap-2">
                          <p className="text-sm text-gray-600 flex-1">
                            {selectedFile?.name} ({((selectedFile?.size || 0) / 1024).toFixed(1)} KB)
                          </p>
                          <button
                            onClick={handleClearFile}
                            className="text-gray-500 hover:text-red-600 transition-colors"
                            disabled={uploadLoading}
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-gray-400 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-600 hover:bg-emerald-50 transition-colors"
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

                    {/* Auto-upload status */}
                    {selectedFile && uploadLoading && (
                      <div className="flex items-center justify-center gap-2 p-3 bg-emerald-50 border-2 border-emerald-300 rounded-lg">
                        <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
                        <p className="text-sm font-semibold text-emerald-700">Uploading payment proof...</p>
                      </div>
                    )}

                    {/* Info */}
                    <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded-r text-sm text-blue-800">
                      <p className="font-bold mb-1">📸 What to include:</p>
                      <ul className="ml-4 space-y-1">
                        <li>✓ Clear photo of your bank receipt or transfer confirmation</li>
                        <li>✓ Transaction reference number (must be visible)</li>
                        <li>✓ Amount, date, and beneficiary name</li>
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6">
                  <div className="flex items-start gap-4">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-1" />
                    <div>
                      <h4 className="font-bold text-emerald-900 mb-1">Proof Submitted!</h4>
                      <p className="text-sm text-emerald-800">
                        Your payment proof has been uploaded. An administrator will verify it shortly.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* I've Completed Payment Button */}
              <Button
                onClick={handleConfirmPayment}
                className="w-full py-6 text-lg font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
              >
                <CheckSquare className="w-5 h-5 mr-2" />
                I've Completed the Transfer
              </Button>

              <p className="text-xs text-center text-gray-500">
                By clicking, you confirm that you have initiated the bank transfer.
                Our team will verify your payment and activate your course access.
              </p>
            </div>
          )}

          {/* ── AWAITING CONFIRMATION: MoMo Pay Code ── */}
          {paymentStatus === 'awaiting_confirmation' && selectedMethod === 'momo_pay_code' && (
            <div className="space-y-5">
              {/* USSD Code Display */}
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <Phone className="w-6 h-6 text-yellow-700" />
                  <h3 className="font-bold text-yellow-900 text-lg">Pay via MoMo USSD Code</h3>
                </div>

                <p className="text-lg font-bold text-yellow-900 text-center mb-3">
                  {currency} {amount.toLocaleString()}
                </p>

                {/* USSD Code */}
                {ussdCode && (
                  <div className="bg-white border-2 border-yellow-300 rounded-xl p-4 mb-4">
                    <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Dial this code on your phone</p>
                    <code className="text-2xl font-mono font-bold text-yellow-700 break-all block text-center">
                      {ussdCode}
                    </code>
                  </div>
                )}

                {/* Copy USSD Button */}
                {ussdCode && (
                  <Button
                    onClick={() => copyToClipboard(ussdCode, 'ussd')}
                    className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 rounded-lg mb-3 flex items-center justify-center gap-2"
                  >
                    {copiedField === 'ussd' ? (
                      <><Check className="w-5 h-5" /> Copied!</>
                    ) : (
                      <><Copy className="w-5 h-5" /> Copy USSD Code</>
                    )}
                  </Button>
                )}

                {/* Important Warning */}
                <Alert className="border-2 border-red-200 bg-red-50">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                  <AlertDescription className="text-red-800 font-semibold text-sm ml-3">
                    ⚠️ Before sending payment, confirm the recipient name on your screen shows:{' '}
                    <span className="font-bold text-red-900">&quot;{recipientName || 'MTN MoMo'}&quot;</span>
                  </AlertDescription>
                </Alert>

                {/* Instructions */}
                <div className="mt-4 bg-gray-50 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-gray-700">Steps:</p>
                  <ol className="text-sm text-gray-700 space-y-2 ml-4 list-decimal">
                    <li>Open your phone dialer</li>
                    <li>Type the USSD code shown above</li>
                    <li>Confirm the recipient is <strong>{recipientName || 'MTN MoMo'}</strong></li>
                    <li>Enter the amount: {currency} {amount.toLocaleString()}</li>
                    <li>Confirm and send</li>
                    <li>Take a screenshot of the success message</li>
                  </ol>
                </div>
              </div>

              {/* Screenshot Upload */}
              {!uploaded ? (
                <div className="bg-gray-50 rounded-2xl p-6 border-2 border-dashed border-gray-300">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                        <ImageIcon className="w-5 h-5 text-yellow-600" />
                        Upload Payment Screenshot
                      </h4>
                      <p className="text-sm text-gray-600">
                        Take a screenshot of the payment success screen and upload it below
                      </p>
                    </div>

                    {uploadError && (
                      <Alert className="border-2 border-red-200 bg-red-50">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-red-800 text-sm ml-3">
                          {uploadError}
                        </AlertDescription>
                      </Alert>
                    )}

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
                            {selectedFile?.name} ({((selectedFile?.size || 0) / 1024).toFixed(1)} KB)
                          </p>
                          <button
                            onClick={handleClearFile}
                            className="text-gray-500 hover:text-red-600 transition-colors"
                            disabled={uploadLoading}
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

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    {/* Auto-upload status */}
                    {selectedFile && uploadLoading && (
                      <div className="flex items-center justify-center gap-2 p-3 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
                        <Loader2 className="w-5 h-5 text-yellow-600 animate-spin" />
                        <p className="text-sm font-semibold text-yellow-700">Uploading screenshot...</p>
                      </div>
                    )}

                    <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded-r text-sm text-blue-800">
                      <p className="font-bold mb-1">📸 What to screenshot:</p>
                      <ul className="ml-4 space-y-1">
                        <li>✓ The payment confirmation message from your phone</li>
                        <li>✓ Transaction ID or reference number (if visible)</li>
                        <li>✓ Amount, date, and recipient name</li>
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6">
                  <div className="flex items-start gap-4">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-1" />
                    <div>
                      <h4 className="font-bold text-emerald-900 mb-1">Screenshot Submitted!</h4>
                      <p className="text-sm text-emerald-800">
                        Your payment proof has been uploaded. An administrator will verify it shortly.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* I've Completed Payment Button */}
              <Button
                onClick={handleConfirmPayment}
                className="w-full py-6 text-lg font-bold bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg"
              >
                <CheckSquare className="w-5 h-5 mr-2" />
                I've Completed the Payment
              </Button>

              <p className="text-xs text-center text-gray-500">
                By clicking, you confirm that you have sent the MoMo payment.
                Our team will verify and activate your course access.
              </p>
            </div>
          )}

          {/* ── PROCESSING STATE ── */}
          {paymentStatus === 'processing' && (
            <div className="text-center py-8">
              <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
              <p className="text-lg font-semibold text-gray-900">Processing Payment</p>
              <p className="text-sm text-gray-600 mt-2">
                {selectedMethod === 'mobile_money'
                  ? 'A payment prompt has been sent to your phone. Please approve it.'
                  : 'Please wait while we process your payment...'}
              </p>
              {paymentReference && (
                <div className="mt-4 bg-amber-50 rounded-lg p-3 border border-amber-200">
                  <p className="text-xs text-amber-700 font-semibold">Reference: {paymentReference}</p>
                </div>
              )}
            </div>
          )}

          {/* ── SUCCESS STATE ── */}
          {paymentStatus === 'success' && (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
              <p className="text-lg font-semibold text-gray-900">
                {paymentConfirmed ? 'Payment Submitted!' : 'Payment Successful!'}
              </p>
              <p className="text-sm text-gray-600 mt-2">
                {paymentConfirmed
                  ? 'Your payment information has been submitted. Our team will verify your payment and activate your course access. This usually takes 1-2 business days.'
                  : 'Your payment has been processed. You now have access to the course.'}
              </p>
              <Button
                onClick={() => {
                  onOpenChange(false);
                  onPaymentSuccess?.();
                }}
                className="mt-4 bg-green-600 hover:bg-green-700 text-white"
              >
                Continue to Learning
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

