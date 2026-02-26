'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  CreditCard,
  Smartphone,
  Loader2,
  ExternalLink,
  Shield,
  CheckCircle2,
  X,
  Phone,
} from 'lucide-react';

/* ─── Types ──────────────────────────────────── */

type SubMethod = 'card' | 'mobile_money';

interface FlutterwaveCheckoutModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (data: { charge_id: string; reference: string; method: string }) => void;
  /** Amount to pay */
  amount: number;
  /** Currency code */
  currency: string;
  /** Course ID */
  courseId: number | string;
  /** User email */
  email: string;
  /** User full name */
  fullName: string;
  /** Pre-filled phone number */
  phone?: string;
  /** Backend API base URL */
  apiUrl?: string;
  /** Application window ID (if applicable) */
  applicationWindowId?: number;
  /** Payment mode */
  paymentMode?: string;
}

/* ─── Component ──────────────────────────────── */

export default function FlutterwaveCheckoutModal({
  open,
  onClose,
  onSuccess,
  amount,
  currency,
  courseId,
  email,
  fullName,
  phone: phoneProp = '',
  apiUrl,
  applicationWindowId,
  paymentMode,
}: FlutterwaveCheckoutModalProps) {
  const API = apiUrl || process.env.NEXT_PUBLIC_API_URL || '';

  /* ── Sub-method selection ── */
  const [subMethod, setSubMethod] = useState<SubMethod>('card');

  /* ── Mobile money form state ── */
  const [momoPhone, setMomoPhone] = useState(phoneProp);
  const [momoNetwork, setMomoNetwork] = useState('MTN');

  /* ── Card checkout (iframe) state ── */
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  /* ── Mobile money direct charge state ── */
  const [momoInstruction, setMomoInstruction] = useState('');
  const [momoChargeId, setMomoChargeId] = useState('');
  const [momoReference, setMomoReference] = useState('');

  /* ── Shared states ── */
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'select' | 'iframe' | 'momo_pending' | 'verifying' | 'done'>('select');

  // Reset when dialog opens/closes
  useEffect(() => {
    if (open) {
      setSubMethod('card');
      setStep('select');
      setCheckoutUrl(null);
      setIframeLoaded(false);
      setError('');
      setLoading(false);
      setMomoInstruction('');
      setMomoChargeId('');
      setMomoReference('');
      setMomoPhone(phoneProp);
    }
  }, [open, phoneProp]);

  /* ── Initiate payment ── */
  const handlePay = useCallback(async () => {
    setError('');
    setLoading(true);

    try {
      const payload: Record<string, unknown> = {
        course_id: courseId,
        amount,
        currency,
        payment_method: 'flutterwave',
        flutterwave_method: subMethod,
        email,
        payer_name: fullName,
        return_url: `${window.location.origin}/payment/success?course_id=${courseId}`,
        cancel_url: `${window.location.origin}/payment/cancel?course_id=${courseId}`,
      };

      if (applicationWindowId != null) {
        payload.application_window_id = applicationWindowId;
      }
      if (paymentMode) {
        payload.payment_mode = paymentMode;
      }

      if (subMethod === 'mobile_money') {
        if (!momoPhone.trim()) {
          setError('Phone number is required for mobile money.');
          setLoading(false);
          return;
        }
        payload.phone_number = momoPhone.trim();
        payload.network = momoNetwork;
        payload.country_code = 'RW'; // default
      } else {
        payload.phone_number = momoPhone.trim() || phoneProp;
      }

      const res = await fetch(`${API}/applications/initiate-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment initiation failed.');

      if (subMethod === 'mobile_money') {
        // Direct charge – show payment instruction
        setMomoChargeId(data.charge_id || '');
        setMomoReference(data.reference || '');
        setMomoInstruction(
          data.payment_instruction ||
          data.message ||
          'Please approve the payment on your phone.'
        );
        setStep('momo_pending');

        // Store for success page fallback
        localStorage.setItem('pending_application_form', JSON.stringify({
          formData: { email, full_name: fullName },
          courseId,
        }));
        localStorage.setItem('flutterwave_charge_id', data.charge_id || '');
        localStorage.setItem('flutterwave_reference', data.reference || '');
      } else {
        // Card – get checkout URL and show iframe
        const url = data.checkout_url;
        if (!url) throw new Error('No checkout URL returned.');
        setCheckoutUrl(url);
        setStep('iframe');

        localStorage.setItem('pending_application_form', JSON.stringify({
          formData: { email, full_name: fullName },
          courseId,
        }));
        localStorage.setItem('flutterwave_charge_id', data.charge_id || '');
        localStorage.setItem('flutterwave_reference', data.reference || '');
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, [subMethod, momoPhone, momoNetwork, amount, currency, courseId, email, fullName, phoneProp, API, applicationWindowId, paymentMode]);

  /* ── Iframe cross-origin redirect detection ── */
  const handleIframeLoad = useCallback(() => {
    setIframeLoaded(true);
    try {
      const href = iframeRef.current?.contentWindow?.location.href;
      if (href && href.includes('/payment/success')) {
        // Flutterwave redirected the iframe to our success URL
        setStep('done');
        const chargeId = localStorage.getItem('flutterwave_charge_id') || '';
        const ref = localStorage.getItem('flutterwave_reference') || '';
        onSuccess({ charge_id: chargeId, reference: ref, method: 'card' });
      }
    } catch {
      // Cross-origin – iframe still on Flutterwave domain, expected
    }
  }, [onSuccess]);

  /* ── Mobile money: verify charge status ── */
  const handleVerifyMomo = useCallback(async () => {
    if (!momoChargeId) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API}/applications/verify-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_method: 'flutterwave',
          reference: momoChargeId,
          course_id: Number(courseId),
        }),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json();

      if (res.ok && ['completed', 'approved', 'SUCCESSFUL'].includes(data.status)) {
        setStep('done');
        onSuccess({ charge_id: momoChargeId, reference: momoReference, method: 'mobile_money' });
      } else if (data.status === 'pending') {
        setError('Payment is still processing. Please approve on your phone and try again.');
      } else {
        setError(data.message || 'Payment not yet confirmed.');
      }
    } catch {
      setError('Unable to verify payment. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [momoChargeId, momoReference, courseId, API, onSuccess]);

  /* ── Render ── */
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="p-1.5 bg-orange-500 rounded-lg">
              <Shield className="h-4 w-4 text-white" />
            </div>
            Flutterwave Secure Checkout
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            {step === 'select' && `Pay ${currency} ${amount.toLocaleString()} securely`}
            {step === 'iframe' && 'Complete your card payment below'}
            {step === 'momo_pending' && 'Approve the payment on your phone'}
            {step === 'done' && 'Payment completed!'}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-4">

          {/* ── Step 1: Method selection ── */}
          {step === 'select' && (
            <>
              {/* Method tabs */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSubMethod('card')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    subMethod === 'card'
                      ? 'border-orange-500 bg-orange-50 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-orange-200'
                  }`}
                >
                  <CreditCard className={`h-6 w-6 ${subMethod === 'card' ? 'text-orange-600' : 'text-gray-400'}`} />
                  <div className="text-center">
                    <p className={`font-semibold text-sm ${subMethod === 'card' ? 'text-orange-700' : 'text-gray-700'}`}>
                      Card Payment
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">Visa, Mastercard, Amex</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSubMethod('mobile_money')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    subMethod === 'mobile_money'
                      ? 'border-orange-500 bg-orange-50 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-orange-200'
                  }`}
                >
                  <Smartphone className={`h-6 w-6 ${subMethod === 'mobile_money' ? 'text-orange-600' : 'text-gray-400'}`} />
                  <div className="text-center">
                    <p className={`font-semibold text-sm ${subMethod === 'mobile_money' ? 'text-orange-700' : 'text-gray-700'}`}>
                      Mobile Money
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">MTN, Airtel</p>
                  </div>
                </button>
              </div>

              {/* Mobile money fields */}
              {subMethod === 'mobile_money' && (
                <div className="space-y-3 pt-1">
                  <div className="space-y-1.5">
                    <Label htmlFor="fw_momo_phone" className="text-sm font-medium">
                      <Phone className="inline h-3.5 w-3.5 mr-1" />
                      Phone Number <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="fw_momo_phone"
                      value={momoPhone}
                      onChange={(e) => setMomoPhone(e.target.value)}
                      placeholder="0780000000"
                      className="h-11 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fw_momo_network" className="text-sm font-medium">
                      Network
                    </Label>
                    <select
                      id="fw_momo_network"
                      value={momoNetwork}
                      onChange={(e) => setMomoNetwork(e.target.value)}
                      className="w-full h-11 rounded-md border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="MTN">MTN Mobile Money</option>
                      <option value="AIRTEL">Airtel Money</option>
                    </select>
                  </div>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Smartphone className="h-3 w-3" />
                    You&apos;ll receive a USSD push to approve the payment on your phone.
                  </p>
                </div>
              )}

              {/* Card info note */}
              {subMethod === 'card' && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                  <p className="text-xs text-blue-700">
                    <Shield className="inline h-3 w-3 mr-1" />
                    You&apos;ll be taken to Flutterwave&apos;s secure checkout to enter your card details.
                    Your card information never touches our servers.
                  </p>
                </div>
              )}

              {/* Amount summary */}
              <div className="bg-gray-50 rounded-xl p-4 flex justify-between items-center">
                <div>
                  <p className="text-xs text-gray-500">Amount to pay</p>
                  <p className="text-xl font-bold text-gray-900">
                    {currency} {amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">{email}</p>
                  <p className="text-xs text-gray-400">{fullName}</p>
                </div>
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              {/* Pay button */}
              <Button
                onClick={handlePay}
                disabled={loading}
                className="w-full h-12 text-base font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-xl"
              >
                {loading ? (
                  <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Processing…</>
                ) : (
                  <>
                    {subMethod === 'card' ? <CreditCard className="h-5 w-5 mr-2" /> : <Smartphone className="h-5 w-5 mr-2" />}
                    Pay {currency} {amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </>
                )}
              </Button>

              <p className="text-center text-xs text-gray-400 flex items-center justify-center gap-1">
                <Shield className="h-3 w-3" /> Secured by Flutterwave
              </p>
            </>
          )}

          {/* ── Step 2a: Card checkout iframe ── */}
          {step === 'iframe' && checkoutUrl && (
            <div className="space-y-3">
              <div className="relative bg-gray-100 rounded-xl overflow-hidden" style={{ minHeight: '480px' }}>
                {!iframeLoaded && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 bg-gray-50">
                    <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                    <p className="text-sm text-gray-500">Loading secure checkout…</p>
                  </div>
                )}
                <iframe
                  ref={iframeRef}
                  src={checkoutUrl}
                  onLoad={handleIframeLoad}
                  className="w-full border-0 rounded-xl"
                  style={{ height: '480px' }}
                  title="Flutterwave Checkout"
                  allow="payment"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation"
                />
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  <Shield className="inline h-3 w-3 mr-1" />
                  Secure payment by Flutterwave
                </p>
                <a
                  href={checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-orange-600 hover:underline flex items-center gap-1"
                >
                  Open in new tab <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <Button
                variant="outline"
                onClick={onClose}
                className="w-full"
              >
                <X className="h-4 w-4 mr-2" /> Cancel
              </Button>
            </div>
          )}

          {/* ── Step 2b: Mobile money pending ── */}
          {step === 'momo_pending' && (
            <div className="space-y-4 text-center py-4">
              <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
                <Smartphone className="h-8 w-8 text-orange-600 animate-pulse" />
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-gray-900">Approve on your phone</h3>
                <p className="text-sm text-gray-600 max-w-xs mx-auto">
                  {momoInstruction || 'A payment prompt has been sent to your phone. Please approve it to continue.'}
                </p>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
                <p className="text-xs text-orange-700 font-medium">
                  Amount: {currency} {amount.toLocaleString()} &middot; Phone: {momoPhone}
                </p>
                {momoReference && (
                  <p className="text-xs text-orange-600 mt-1 font-mono">
                    Ref: {momoReference}
                  </p>
                )}
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Button
                  onClick={handleVerifyMomo}
                  disabled={loading}
                  className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-white rounded-xl"
                >
                  {loading ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Checking…</>
                  ) : (
                    "I've approved – Verify Payment"
                  )}
                </Button>
                <Button variant="outline" onClick={onClose} className="w-full">
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 3: Done ── */}
          {step === 'done' && (
            <div className="text-center py-6 space-y-3">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="font-bold text-lg text-gray-900">Payment Confirmed!</h3>
              <p className="text-sm text-gray-500">Closing in a moment…</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
