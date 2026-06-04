'use client';

import React, { useState, useEffect } from 'react';

interface CohortCountdownTimerProps {
  /** ISO 8601 date string for the cohort start date */
  startDate: string;
  /** Optional size variant */
  size?: 'sm' | 'md' | 'lg';
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function calculateTimeLeft(targetDate: string): TimeLeft | null {
  const now = new Date().getTime();
  const target = new Date(targetDate).getTime();
  const diff = target - now;

  if (diff <= 0) return null;

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
  };
}

function TimeUnit({ value, label, size }: { value: number; label: string; size: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-12 h-12 text-lg',
    md: 'w-16 h-16 text-2xl',
    lg: 'w-20 h-20 text-3xl',
  };
  const labelClasses = {
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-sm',
  };

  return (
    <div className="flex flex-col items-center">
      <div
        className={`${sizeClasses[size]} rounded-lg bg-indigo-900/40 border border-indigo-500/30 flex items-center justify-center font-mono font-bold text-indigo-200`}
      >
        {String(value).padStart(2, '0')}
      </div>
      <span className={`${labelClasses[size]} text-indigo-400 mt-1 uppercase tracking-wider font-medium`}>
        {label}
      </span>
    </div>
  );
}

/**
 * Live countdown timer that shows days, hours, minutes, and seconds
 * until the cohort start date. Updates every second.
 */
export default function CohortCountdownTimer({ startDate, size = 'md' }: CohortCountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(() => calculateTimeLeft(startDate));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Recalculate immediately in case of server/client time drift
    setTimeLeft(calculateTimeLeft(startDate));

    const timer = setInterval(() => {
      const remaining = calculateTimeLeft(startDate);
      setTimeLeft(remaining);
      if (!remaining) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [startDate]);

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <div className={`flex items-center gap-2 ${size === 'sm' ? 'gap-1' : 'gap-3'}`}>
        {['Days', 'Hrs', 'Min', 'Sec'].map((label) => (
          <TimeUnit key={label} value={0} label={label} size={size} />
        ))}
      </div>
    );
  }

  if (!timeLeft) {
    return (
      <div className="text-center">
        <span className="text-indigo-300 font-semibold text-lg animate-pulse">
          🎉 Cohort has started!
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-center ${size === 'sm' ? 'gap-1' : 'gap-3'}`}>
      <TimeUnit value={timeLeft.days} label="Days" size={size} />
      <span className={`${size === 'lg' ? 'text-2xl' : 'text-xl'} text-indigo-500 font-bold self-start mt-2`}>:</span>
      <TimeUnit value={timeLeft.hours} label="Hrs" size={size} />
      <span className={`${size === 'lg' ? 'text-2xl' : 'text-xl'} text-indigo-500 font-bold self-start mt-2`}>:</span>
      <TimeUnit value={timeLeft.minutes} label="Min" size={size} />
      <span className={`${size === 'lg' ? 'text-2xl' : 'text-xl'} text-indigo-500 font-bold self-start mt-2`}>:</span>
      <TimeUnit value={timeLeft.seconds} label="Sec" size={size} />
    </div>
  );
}
