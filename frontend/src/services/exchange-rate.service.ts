/**
 * Exchange Rate Service
 * Routes through the internal Next.js proxy (/api/exchange-rates) to avoid
 * CORS issues on the client side. The proxy tries the live exchangerateapi.net
 * API first, then falls back to hardcoded estimates (Feb 2026).
 */

const RATE_CACHE_TTL_MS    = 60 * 60 * 1000;  // 1 hour  (live rates)
const FALLBACK_CACHE_TTL_MS = 10 * 60 * 1000; // 10 min  (retry sooner for fallback)

/** East-Africa + global preset currencies */
export const PRESET_CURRENCIES: { code: string; name: string; flag: string }[] = [
  { code: 'RWF', name: 'Rwandan Franc',     flag: '🇷🇼' },
  { code: 'USD', name: 'US Dollar',          flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro',               flag: '🇪🇺' },
  { code: 'GBP', name: 'British Pound',      flag: '🇬🇧' },
  { code: 'KES', name: 'Kenyan Shilling',    flag: '🇰🇪' },
  { code: 'UGX', name: 'Ugandan Shilling',   flag: '🇺🇬' },
  { code: 'TZS', name: 'Tanzanian Shilling', flag: '🇹🇿' },
];

export const PRESET_CODES = PRESET_CURRENCIES.map((c) => c.code).join(',');

export interface RatesResult {
  rates: Record<string, number>;
  /** true when the live API was unavailable and estimated rates are used */
  isFallback: boolean;
}

interface CacheEntry extends RatesResult {
  timestamp: number;
}

function readCache(key: string): CacheEntry | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as CacheEntry) : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: CacheEntry): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* quota */ }
}

/**
 * Fetch exchange rates via the internal proxy.
 * Falls back to hardcoded estimates if the live API is unavailable / quota exceeded.
 */
export async function getExchangeRates(base: string = 'USD'): Promise<RatesResult> {
  const cacheKey = `exr_rates_v2_${base.toUpperCase()}`;
  const cached = readCache(cacheKey);

  if (cached) {
    const ttl = cached.isFallback ? FALLBACK_CACHE_TTL_MS : RATE_CACHE_TTL_MS;
    if (Date.now() - cached.timestamp < ttl) {
      return { rates: cached.rates, isFallback: cached.isFallback };
    }
  }

  const url =
    `/api/exchange-rates?base=${encodeURIComponent(base)}&currencies=${encodeURIComponent(PRESET_CODES)}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Exchange rate proxy responded with ${res.status}`);

  const data = await res.json() as {
    rates: Record<string, number>;
    source: 'live' | 'fallback';
  };

  const isFallback = data.source === 'fallback';
  const rates = data.rates ?? {};
  if (!rates[base]) rates[base] = 1;

  writeCache(cacheKey, { rates, isFallback, timestamp: Date.now() });
  return { rates, isFallback };
}

/** Format a money amount — no decimals for high-value currencies (RWF, UGX, TZS…) */
export function formatMoney(amount: number, currencyCode: string): string {
  const wholeNumber = ['RWF', 'UGX', 'TZS', 'BIF', 'GNF', 'IDR', 'JPY', 'KRW'].includes(
    currencyCode.toUpperCase()
  );
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: wholeNumber ? 0 : 2,
    maximumFractionDigits: wholeNumber ? 0 : 2,
  }).format(amount);
}
