'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  CreditCard,
  Clock,
  CheckCircle2,
  Lock,
  TrendingDown,
  Shield,
  Zap,
  HelpCircle,
} from 'lucide-react';

interface PaymentBlockingCardProps {
  courseName: string;
  amount: number;
  currency: string;
  scholarshipPercentage?: number;
  isPartialScholarship?: boolean;
  paymentStatus?: 'pending' | 'processing' | 'verification_pending' | 'failed';
  onPayNow?: () => void;
  onContactSupport?: () => void;
  loading?: boolean;
}

export default function PaymentBlockingCardComponent({
  courseName,
  amount,
  currency,
  scholarshipPercentage = 0,
  isPartialScholarship = false,
  paymentStatus = 'pending',
  onPayNow,
  onContactSupport,
  loading = false,
}: PaymentBlockingCardProps) {
  const totalPrice = scholarshipPercentage && scholarshipPercentage > 0 
    ? (amount / (1 - scholarshipPercentage / 100)) 
    : amount;
  const scholarshipAmount = totalPrice - amount;

  const statusConfig = {
    pending: {
      icon: <Lock className="w-6 h-6" />,
      title: isPartialScholarship ? 'Partial Scholarship — Payment Required' : 'Tuition Payment Required',
      description: 'Your course access is locked until payment is completed.',
      bgColor: 'bg-red-50 border-red-200',
      badgeColor: 'bg-red-100 text-red-700',
      badgeText: 'Action Required',
    },
    processing: {
      icon: <Zap className="w-6 h-6 text-amber-600" />,
      title: 'Payment Processing',
      description: 'Your payment is being processed. This usually takes 1-2 minutes.',
      bgColor: 'bg-amber-50 border-amber-200',
      badgeColor: 'bg-amber-100 text-amber-700',
      badgeText: 'In Progress',
    },
    verification_pending: {
      icon: <Clock className="w-6 h-6 text-blue-600" />,
      title: 'Payment Under Review',
      description: 'Your payment has been received and is being verified by our team.',
      bgColor: 'bg-blue-50 border-blue-200',
      badgeColor: 'bg-blue-100 text-blue-700',
      badgeText: 'Pending Verification',
    },
    failed: {
      icon: <AlertTriangle className="w-6 h-6 text-red-600" />,
      title: 'Payment Failed',
      description: 'Your payment could not be processed. Please try again or contact support.',
      bgColor: 'bg-red-50 border-red-200',
      badgeColor: 'bg-red-100 text-red-700',
      badgeText: 'Payment Failed',
    },
  };

  const config = statusConfig[paymentStatus];

  return (
    <Card className={`border-2 ${config.bgColor}`}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className="p-2 rounded-lg bg-white">{config.icon}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <CardTitle className="text-lg">{config.title}</CardTitle>
                <Badge className={config.badgeColor}>{config.badgeText}</Badge>
              </div>
              <CardDescription className="text-sm">{config.description}</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Amount Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {isPartialScholarship && scholarshipAmount > 0 && (
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-4 h-4 text-emerald-600" />
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Scholarship</p>
              </div>
              <p className="text-xl font-bold text-emerald-700">
                {currency} {scholarshipAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-emerald-600 mt-1">{scholarshipPercentage}% covered</p>
            </div>
          )}

          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-4 h-4 text-indigo-600" />
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                {isPartialScholarship ? 'Your Payment' : 'Total Amount'}
              </p>
            </div>
            <p className="text-xl font-bold text-indigo-700">
              {currency} {amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-indigo-600 mt-1">Due today</p>
          </div>

          {isPartialScholarship && (
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-gray-600" />
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Total Value</p>
              </div>
              <p className="text-xl font-bold text-gray-700">
                {currency} {totalPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-600 mt-1">Program cost</p>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="bg-white rounded-lg p-3 border border-gray-200 space-y-2">
          <div className="flex gap-2 text-xs">
            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
            <span className="text-gray-700">30-day refund policy for all payments</span>
          </div>
          <div className="flex gap-2 text-xs">
            <Shield className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <span className="text-gray-700">Secure payment processing · SSL encrypted</span>
          </div>
          <div className="flex gap-2 text-xs">
            <Zap className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <span className="text-gray-700">Instant access to course content after payment</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          {paymentStatus === 'pending' || paymentStatus === 'failed' ? (
            <>
              <Button
                onClick={onPayNow}
                disabled={loading}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5"
              >
                <Zap className="w-4 h-4 mr-2" />
                {loading ? 'Processing...' : 'Pay Now'}
              </Button>
              <Button
                onClick={onContactSupport}
                variant="outline"
                className="flex-1 border-2 border-gray-300 text-gray-700 font-semibold py-2.5"
              >
                <HelpCircle className="w-4 h-4 mr-2" />
                Help
              </Button>
            </>
          ) : paymentStatus === 'processing' ? (
            <div className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-amber-100 text-amber-700 rounded-lg font-semibold">
              <Zap className="w-4 h-4 animate-spin" />
              Processing your payment...
            </div>
          ) : (
            <div className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-100 text-blue-700 rounded-lg font-semibold">
              <Clock className="w-4 h-4" />
              Verification in progress. This usually takes 1-2 hours.
            </div>
          )}
        </div>

        {/* Payment Method Info */}
        <div className="text-xs text-gray-600 text-center">
          We accept multiple payment methods including cards, mobile money, and bank transfers.
        </div>
      </CardContent>
    </Card>
  );
}
