'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    payer_name: '',
    phone_number: '',
    email: localStorage.getItem('user_email') || '',
  });
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

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

  // Filter and validate payment methods - only show enabled methods from course settings
  // This mirrors the application form's approach of filtering payment methods based on
  // course configuration. Only methods that:
  // 1. Are in the paymentMethods array (enabled by course settings)
  // 2. Have metadata defined (label, sub, color, icon)
  // will be displayed to the user
  const enabledMethods = paymentMethods.filter((m) => {
    // Only include methods that have metadata defined
    const hasMetadata = Object.keys(methodLabels).includes(m);
    if (hasMetadata) {
      console.log(`✅ Payment method "${m}" is enabled and will be displayed`);
    } else {
      console.warn(`⚠️ Payment method "${m}" has no metadata - it will be hidden from payment options`);
    }
    return hasMetadata;
  });

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
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
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
    } catch (err) {
      setPaymentStatus('failed');
      setError(err instanceof Error ? err.message : 'Payment initiation failed');
    } finally {
      setPaymentLoading(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  const handleClose = () => {
    if (paymentStatus === 'idle' || paymentStatus === 'failed') {
      onOpenChange(false);
      setPaymentStatus('idle');
      setSelectedMethod(null);
      setError(null);
      setPaymentReference(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-2xl flex items-center gap-2">
                <CreditCard className="w-6 h-6 text-indigo-600" />
                Complete Payment
              </DialogTitle>
              <DialogDescription className="text-base mt-2">{courseName}</DialogDescription>
            </div>
            <button
              onClick={() => handleClose()}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Info - Show enabled methods count and list */}
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
                <p className="text-xs text-blue-600 mt-2">Select your preferred option below to proceed with payment.</p>
              </div>
            </div>
          </div>

          {/* Amount Breakdown */}
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

          {/* Payment Methods */}
          {paymentStatus === 'idle' && (
            <>
              <div>
                <div className="mb-4">
                  <Label className="text-base font-bold text-gray-900 mb-2 block">Select Payment Method</Label>
                  <p className="text-sm text-gray-600">
                    {enabledMethods.length} payment {enabledMethods.length === 1 ? 'method' : 'methods'} available
                  </p>
                </div>
                
                {/* Payment Methods Grid - Only show enabled methods */}
                <div className={`grid ${enabledMethods.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'} gap-3`}>
                  {enabledMethods.map((method) => {
                    const meta = methodLabels[method];
                    if (!meta) return null; // Skip if no metadata
                    
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

          {/* Processing State */}
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

          {/* Success State */}
          {paymentStatus === 'success' && (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
              <p className="text-lg font-semibold text-gray-900">Payment Successful!</p>
              <p className="text-sm text-gray-600 mt-2">Your payment has been processed. You now have access to the course.</p>
              <Button
                onClick={() => {
                  handleClose();
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
  );
}
