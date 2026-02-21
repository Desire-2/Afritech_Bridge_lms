/**
 * useExchangeRate — React hook for live currency conversion.
 *
 * Features:
 *  - Fetches rates from exchangerateapi.net (1-hour cache via localStorage)
 *  - Persists user's chosen display currency in localStorage
 *  - Emits & listens to `afritec-currency-change` CustomEvent so all
 *    CurrencyDisplay instances on the same page stay in sync without Context
 *  - Default display currency: RWF (Rwandan Franc)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getExchangeRates,
  formatMoney,
  PRESET_CURRENCIES,
} from '@/services/exchange-rate.service';

export const DEFAULT_DISPLAY_CURRENCY = 'RWF';
const STORAGE_KEY = 'afritec_display_currency';
const SYNC_EVENT = 'afritec-currency-change';

function readStoredCurrency(): string {
  if (typeof window === 'undefined') return DEFAULT_DISPLAY_CURRENCY;
  return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_DISPLAY_CURRENCY;
}

export interface UseExchangeRateReturn {
  /** Exchange rates keyed by code, with `baseCurrency` → 1 */
  rates: Record<string, number>;
  /** True while the first fetch is in-flight */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** true when the live API is unavailable and estimated hardcoded rates are used */
  isFallback: boolean;
  /** Currently selected display / output currency */
  displayCurrency: string;
  /** Change the display currency (persisted + broadcast to other instances) */
  setDisplayCurrency: (code: string) => void;
  /**
   * Convert `amount` from `from` → `to`.
   * Defaults: from = baseCurrency, to = displayCurrency.
   * Returns null if the required rate is unavailable.
   */
  convert: (amount: number, from?: string, to?: string) => number | null;
  /** Format a number nicely for `currencyCode` (no decimals for RWF / UGX / etc.) */
  formatAmount: (amount: number, currencyCode: string) => string;
  /** Predefined currency list for the selector dropdown */
  presetCurrencies: typeof PRESET_CURRENCIES;
}

/**
 * @param baseCurrency  The currency the course prices are stored in (e.g. 'USD').
 *                      Rates are fetched with this as the base so conversion is
 *                      a single multiplication: `amount * rates[targetCurrency]`.
 */
export function useExchangeRate(baseCurrency: string = 'USD'): UseExchangeRateReturn {
  const [rates, setRates]           = useState<Record<string, number>>({});
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [displayCurrency, setDisplayCurrencyState] = useState<string>(readStoredCurrency);

  // ── Fetch rates whenever baseCurrency changes ──────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getExchangeRates(baseCurrency)
      .then(({ rates: r, isFallback: fb }) => {
        if (!cancelled) {
          setRates(r);
          setIsFallback(fb);
        }
      })
      .catch((e) => { if (!cancelled) setError(String(e?.message ?? e)); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [baseCurrency]);

  // ── Cross-tab / cross-component sync via CustomEvent ──────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const code = (e as CustomEvent<string>).detail;
      if (code && code !== displayCurrency) setDisplayCurrencyState(code);
    };
    window.addEventListener(SYNC_EVENT, handler);
    return () => window.removeEventListener(SYNC_EVENT, handler);
  }, [displayCurrency]);

  // ── Setters ──────────────────────────────────────────────────────────────
  const setDisplayCurrency = useCallback((code: string) => {
    setDisplayCurrencyState(code);
    try { localStorage.setItem(STORAGE_KEY, code); } catch { /* quota */ }
    window.dispatchEvent(new CustomEvent<string>(SYNC_EVENT, { detail: code }));
  }, []);

  // ── Conversion helper ─────────────────────────────────────────────────────
  const convert = useCallback(
    (amount: number, from: string = baseCurrency, to: string = displayCurrency): number | null => {
      if (!amount || from === to) return amount;

      if (from === baseCurrency) {
        // Direct lookup: rates are fetched with baseCurrency as base
        const rate = rates[to];
        return rate != null ? amount * rate : null;
      }

      // Cross-rate: pivot through baseCurrency
      // rates[from] means "1 baseCurrency = X from-currency"
      // So 1 from-currency = 1/rates[from] baseCurrency
      const fromInBase = rates[from];
      const toRate = rates[to];
      if (!fromInBase || !toRate) return null;
      return (amount / fromInBase) * toRate;
    },
    [rates, baseCurrency, displayCurrency]
  );

  const formatAmount = useCallback(
    (amount: number, currencyCode: string) => formatMoney(amount, currencyCode),
    []
  );

  return {
    rates,
    loading,
    error,
    isFallback,
    displayCurrency,
    setDisplayCurrency,
    convert,
    formatAmount,
    presetCurrencies: PRESET_CURRENCIES,
  };
}
