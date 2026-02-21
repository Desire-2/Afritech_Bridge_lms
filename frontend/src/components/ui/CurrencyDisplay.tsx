'use client';

/**
 * CurrencyDisplay — shows an amount in the original currency + a live
 * conversion to the user's chosen display currency (default: RWF).
 *
 * Components exported:
 *  <CurrencyDisplay>     – price block with optional selector & converted line
 *  <CurrencySelector>    – standalone <select> dropdown
 *  <ConvertedBadge>      – tiny "≈ RWF 285,600" inline badge  (no selector)
 */

import React from 'react';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { RefreshCw } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// CurrencySelector – standalone dropdown
// ─────────────────────────────────────────────────────────────────────────────

interface CurrencySelectorProps {
  /** Additional class names */
  className?: string;
  /** Compact style (narrower padding) */
  compact?: boolean;
}

/**
 * A `<select>` that lets the user pick a display currency.  All
 * `<CurrencyDisplay>` / `<ConvertedBadge>` instances on the page will
 * update immediately via the `afritec-currency-change` CustomEvent.
 */
export function CurrencySelector({ className = '', compact = false }: CurrencySelectorProps) {
  const { displayCurrency, setDisplayCurrency, presetCurrencies } = useExchangeRate();

  return (
    <select
      value={displayCurrency}
      onChange={(e) => setDisplayCurrency(e.target.value)}
      title="Select display currency"
      className={`border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200
        focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer transition-colors
        hover:border-indigo-300 ${compact ? 'text-xs px-2 py-1' : 'text-sm px-2.5 py-1.5'} ${className}`}
    >
      {presetCurrencies.map(({ code, name, flag }) => (
        <option key={code} value={code}>
          {flag} {code} — {name}
        </option>
      ))}
    </select>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ConvertedBadge – lightweight "≈ RWF 285,600" inline text
// ─────────────────────────────────────────────────────────────────────────────

interface ConvertedBadgeProps {
  amount: number | null | undefined;
  /** Original currency of `amount` (e.g. 'USD') */
  currency: string;
  className?: string;
}

/**
 * Shows only the converted amount as a small hint.
 * Returns `null` when:
 *  – rate is loading / unavailable
 *  – display currency == source currency
 *  – amount is null / 0
 */
export function ConvertedBadge({ amount, currency, className = '' }: ConvertedBadgeProps) {
  const { convert, formatAmount, displayCurrency, loading, isFallback } = useExchangeRate(currency);

  if (!amount || loading || displayCurrency === currency) return null;

  const converted = convert(amount, currency, displayCurrency);
  if (converted === null) return null;

  return (
    <span
      className={`text-gray-400 font-normal ${className}`}
      title={isFallback ? 'Estimated rate (Feb 2026) — live rates temporarily unavailable' : 'Live exchange rate'}
    >
      ≈ {displayCurrency} {formatAmount(converted, displayCurrency)}
      {isFallback && <span className="ml-1 text-[0.75em] text-amber-400">(est.)</span>}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CurrencyDisplay – full block: primary price + optional selector + badge
// ─────────────────────────────────────────────────────────────────────────────

interface CurrencyDisplayProps {
  amount: number | null | undefined;
  /** Original stored currency for `amount` */
  currency: string;
  className?: string;
  /** Show currency-selector dropdown next to the price */
  showSelector?: boolean;
  /**
   * How to render:
   *  'block'  – primary value on one line, converted hint on next line (default)
   *  'inline' – everything on one line: "USD 200 ≈ RWF 285,600"
   *  'large'  – same as block but sizes are big (for hero/sidebar price cards)
   */
  variant?: 'block' | 'inline' | 'large';
  /** Extra class for the converted amount text */
  convertedClass?: string;
}

/**
 * Displays a price with a live currency-conversion hint.
 *
 * @example
 * // Hero price card
 * <CurrencyDisplay amount={course.price} currency={course.currency || 'USD'}
 *                  variant="large" showSelector />
 *
 * // Compact inline usage inside a paragraph
 * <CurrencyDisplay amount={200} currency="USD" variant="inline" />
 */
export function CurrencyDisplay({
  amount,
  currency,
  className = '',
  showSelector = false,
  variant = 'block',
  convertedClass = '',
}: CurrencyDisplayProps) {
  const { convert, formatAmount, displayCurrency, loading, error } = useExchangeRate(currency);

  if (!amount) return null;

  const converted = displayCurrency !== currency ? convert(amount, currency, displayCurrency) : null;
  const primaryText = `${currency} ${formatAmount(amount, currency)}`;
  const convertedText =
    converted !== null && !loading
      ? `≈ ${displayCurrency} ${formatAmount(converted, displayCurrency)}`
      : null;

  // ── Inline variant ─────────────────────────────────────────────────────────
  if (variant === 'inline') {
    return (
      <span className={className}>
        {primaryText}
        {convertedText && (
          <span className={`ml-2 text-[0.8em] text-gray-400 ${convertedClass}`}>
            {convertedText}
          </span>
        )}
        {showSelector && <CurrencySelector compact className="ml-2" />}
      </span>
    );
  }

  // ── Large variant (hero price card) ───────────────────────────────────────
  if (variant === 'large') {
    return (
      <div className={className}>
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-3xl font-bold">{primaryText}</span>
          {showSelector && <CurrencySelector compact />}
        </div>
        {loading && (
          <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
            <RefreshCw className="w-3 h-3 animate-spin" /> Fetching live rate…
          </p>
        )}
        {convertedText && !loading && (
          <p className={`text-sm text-gray-400 mt-0.5 ${convertedClass}`}>{convertedText}</p>
        )}
        {error && !convertedText && (
          <p className="text-xs text-amber-500 mt-0.5">Rate unavailable — showing {currency} only</p>
        )}
      </div>
    );
  }

  // ── Block variant (default) ────────────────────────────────────────────────
  return (
    <div className={className}>
      <div className="flex items-center gap-2 flex-wrap">
        <span>{primaryText}</span>
        {showSelector && <CurrencySelector compact />}
      </div>
      {loading && (
        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
          <RefreshCw className="w-3 h-3 animate-spin" /> Fetching rate…
        </p>
      )}
      {convertedText && (
        <p className={`text-xs text-gray-500 mt-0.5 ${convertedClass}`}>{convertedText}</p>
      )}
    </div>
  );
}
