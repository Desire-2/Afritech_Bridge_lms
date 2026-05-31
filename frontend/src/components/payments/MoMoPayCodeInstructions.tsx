'use client';

import React, { useState } from 'react';
import { AlertCircle, Copy, CheckCircle2, Loader2, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface MoMoPayCodeInstructionsProps {
  ussdCode: string;
  amount: number;
  currency: string;
  recipientName: string;
  onScreenshotReady?: (file: File) => void;
  loading?: boolean;
}

export default function MoMoPayCodeInstructions({
  ussdCode,
  amount,
  currency,
  recipientName,
  onScreenshotReady,
  loading = false,
}: MoMoPayCodeInstructionsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyUSSD = () => {
    navigator.clipboard.writeText(ussdCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 w-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full mb-3">
          <Phone className="w-4 h-4" />
          <span className="font-semibold text-sm">Pay via MoMo USSD Code</span>
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          {amount.toLocaleString()} {currency}
        </h3>
        <p className="text-gray-600 text-sm">
          Follow the steps below to complete your payment
        </p>
      </div>

      {/* USSD Code Display */}
      <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-6">
        <p className="text-sm font-semibold text-yellow-900 mb-3 uppercase tracking-wide">
          📱 Step 1: Dial This Code
        </p>
        
        {/* Monospace USSD Code */}
        <div className="bg-white border-2 border-yellow-300 rounded-xl p-4 mb-4">
          <code className="text-2xl font-mono font-bold text-yellow-700 break-all">
            {ussdCode}
          </code>
        </div>

        {/* Copy Button */}
        <Button
          onClick={handleCopyUSSD}
          className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 rounded-lg mb-4 flex items-center justify-center gap-2"
        >
          {copied ? (
            <>
              <CheckCircle2 className="w-5 h-5" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-5 h-5" />
              Copy USSD Code
            </>
          )}
        </Button>

        <p className="text-xs text-gray-600 text-center">
          Or manually type the code above in your phone's dialer
        </p>
      </div>

      {/* Important Warning */}
      <Alert className="border-2 border-red-200 bg-red-50">
        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
        <AlertDescription className="text-red-800 font-semibold text-sm ml-3">
          ⚠️ Before sending payment, confirm the recipient name on your screen shows: <span className="font-bold text-red-900">"{recipientName}"</span>
        </AlertDescription>
      </Alert>

      {/* Steps */}
      <div className="bg-gray-50 rounded-2xl p-6 space-y-4">
        <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Step-by-step Instructions:</p>
        
        <div className="space-y-3">
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-yellow-600 text-white font-bold text-sm">
                1
              </div>
            </div>
            <div>
              <p className="font-semibold text-gray-900">Open Phone Dialer</p>
              <p className="text-sm text-gray-600">On your phone, go to the Phone app and tap the Dialer/Keypad</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-yellow-600 text-white font-bold text-sm">
                2
              </div>
            </div>
            <div>
              <p className="font-semibold text-gray-900">Type Exactly</p>
              <p className="text-sm text-gray-600">
                Copy or type the code above: <code className="bg-gray-200 px-2 py-0.5 rounded font-mono text-xs">{ussdCode}</code>
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-yellow-600 text-white font-bold text-sm">
                3
              </div>
            </div>
            <div>
              <p className="font-semibold text-gray-900">Check Recipient</p>
              <p className="text-sm text-gray-600">
                Before confirming, verify the recipient shows: <span className="font-bold">"{recipientName}"</span>
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-yellow-600 text-white font-bold text-sm">
                4
              </div>
            </div>
            <div>
              <p className="font-semibold text-gray-900">Confirm & Send</p>
              <p className="text-sm text-gray-600">Tap Send/OK to complete the payment</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-yellow-600 text-white font-bold text-sm">
                5
              </div>
            </div>
            <div>
              <p className="font-semibold text-gray-900">Take Screenshot</p>
              <p className="text-sm text-gray-600">
                Once payment is complete, take a screenshot of the success confirmation screen
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-yellow-600 text-white font-bold text-sm">
                6
              </div>
            </div>
            <div>
              <p className="font-semibold text-gray-900">Upload Proof</p>
              <p className="text-sm text-gray-600">
                Upload your screenshot below as proof of payment
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
        <p className="font-semibold text-blue-900 text-sm mb-2">💡 Pro Tips:</p>
        <ul className="text-sm text-blue-800 space-y-1 ml-4">
          <li>• Make sure you have sufficient MoMo balance</li>
          <li>• Ensure you have a stable network connection</li>
          <li>• Double-check the recipient name before confirming</li>
          <li>• Take a clear screenshot showing the payment confirmation</li>
        </ul>
      </div>
    </div>
  );
}
