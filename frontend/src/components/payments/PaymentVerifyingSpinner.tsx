'use client';

import React, { useEffect, useState } from 'react';
import { Receipt } from 'lucide-react';

type Tone = 'blue' | 'emerald';

interface PaymentVerifyingSpinnerProps {
  tone?: Tone;
  className?: string;
}

const STAGES = [
  'Uploading your receipt…',
  'Reading the receipt…',
  'Verifying the payment receiver…',
];

const STAGE_INTERVAL_MS = 2600;

const TONES: Record<
  Tone,
  {
    card: string;
    ring1: string;
    ring2: string;
    disc: string;
    icon: string;
    heading: string;
    stage: string;
    dotActive: string;
    dotDone: string;
    dotIdle: string;
    sweep: string;
  }
> = {
  blue: {
    card: 'bg-blue-50 border-blue-300',
    ring1: 'border-blue-400',
    ring2: 'border-blue-300',
    disc: 'bg-white shadow-sm',
    icon: 'text-blue-600',
    heading: 'text-blue-900',
    stage: 'text-blue-700',
    dotActive: 'bg-blue-600',
    dotDone: 'bg-blue-400',
    dotIdle: 'bg-blue-100',
    sweep: 'rgba(37, 99, 235, 0.35)',
  },
  emerald: {
    card: 'bg-emerald-50 border-emerald-300',
    ring1: 'border-emerald-400',
    ring2: 'border-emerald-300',
    disc: 'bg-white shadow-sm',
    icon: 'text-emerald-600',
    heading: 'text-emerald-900',
    stage: 'text-emerald-700',
    dotActive: 'bg-emerald-600',
    dotDone: 'bg-emerald-400',
    dotIdle: 'bg-emerald-100',
    sweep: 'rgba(5, 150, 105, 0.35)',
  },
};

export default function PaymentVerifyingSpinner({
  tone = 'blue',
  className = '',
}: PaymentVerifyingSpinnerProps) {
  const [stage, setStage] = useState(0);
  const t = TONES[tone];

  useEffect(() => {
    const id = setInterval(() => {
      setStage((s) => (s + 1 < STAGES.length ? s + 1 : s));
    }, STAGE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`rounded-xl border-2 p-4 text-center overflow-hidden ${t.card} ${className}`}
    >
      {/* Radar: sonar rings + sweep + receipt disc */}
      <div className="relative mx-auto h-24 w-24" aria-hidden="true">
        <span
          className={`absolute inset-0 rounded-full border-2 animate-ping motion-reduce:animate-none ${t.ring1}`}
        />
        <span
          className={`absolute inset-2 rounded-full border animate-ping motion-reduce:animate-none opacity-70 ${t.ring2}`}
          style={{ animationDelay: '0.45s' }}
        />
        <span className="absolute inset-0 overflow-hidden rounded-full motion-reduce:hidden">
          <span
            className="absolute inset-0 animate-spin-slow"
            style={{
              background: `conic-gradient(from 0deg, transparent 0deg 285deg, ${t.sweep} 360deg)`,
            }}
          />
        </span>
        <span
          className={`absolute inset-4 rounded-full flex items-center justify-center ${t.disc}`}
        >
          <Receipt className={`h-8 w-8 ${t.icon}`} />
        </span>
      </div>

      <p className={`mt-3 font-semibold text-sm ${t.heading}`}>
        We&apos;re verifying your payment
      </p>

      <p className={`mt-0.5 h-5 text-sm ${t.stage}`}>{STAGES[stage]}</p>

      <div aria-hidden="true">
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {STAGES.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i === stage
                  ? `w-5 ${t.dotActive}`
                  : i < stage
                    ? `w-1.5 ${t.dotDone}`
                    : `w-1.5 ${t.dotIdle}`
              }`}
            />
          ))}
        </div>
        <p className={`mt-1.5 text-xs ${t.stage} opacity-80`}>
          This can take a few moments.
        </p>
      </div>
    </div>
  );
}
