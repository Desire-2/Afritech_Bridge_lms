import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.NEXT_PUBLIC_EXCHANGE_RATE_API_KEY ?? '';
const BASE_URL = process.env.NEXT_PUBLIC_EXCHANGE_RATE_API_BASE ?? 'https://api.exchangerateapi.net/v1';

// Approximate fallback rates (USD-based, updated Feb 2026)
// Used when the external API quota is exhausted or unreachable.
const FALLBACK_RATES: Record<string, Record<string, number>> = {
  USD: { USD: 1, RWF: 1390, EUR: 0.92, GBP: 0.79, KES: 129, UGX: 3700, TZS: 2700 },
  EUR: { EUR: 1, USD: 1.087, RWF: 1511, GBP: 0.859, KES: 140, UGX: 4023, TZS: 2934 },
  GBP: { GBP: 1, USD: 1.266, EUR: 1.165, RWF: 1759, KES: 163, UGX: 4682, TZS: 3416 },
  RWF: { RWF: 1, USD: 0.000719, EUR: 0.000662, GBP: 0.000568, KES: 0.0928, UGX: 2.66, TZS: 1.94 },
  KES: { KES: 1, USD: 0.00775, EUR: 0.00713, GBP: 0.00613, RWF: 10.77, UGX: 28.68, TZS: 20.9 },
  UGX: { UGX: 1, USD: 0.00027, EUR: 0.000249, GBP: 0.000214, RWF: 0.376, KES: 0.0349, TZS: 0.73 },
  TZS: { TZS: 1, USD: 0.00037, EUR: 0.000341, GBP: 0.000293, RWF: 0.515, KES: 0.0478, UGX: 1.37 },
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const base = (searchParams.get('base') || 'USD').toUpperCase();
  const currencies = searchParams.get('currencies') || 'RWF,USD,EUR,GBP,KES,UGX,TZS';

  // Try external API
  try {
    const url = `${BASE_URL}/latest?base=${base}&currencies=${currencies}`;
    const res = await fetch(url, {
      headers: { apikey: API_KEY },
      next: { revalidate: 3600 }, // Next.js cache: 1 hour
    });

    if (res.ok) {
      const data = await res.json() as Record<string, unknown>;
      const rates =
        (data.rates as Record<string, number> | undefined) ??
        (data.conversion_rates as Record<string, number> | undefined);

      if (rates && Object.keys(rates).length > 0) {
        return NextResponse.json({ rates, base, source: 'live' });
      }
    }
  } catch {
    // fall through to fallback
  }

  // Fallback: return hardcoded estimates
  const fallbackForBase = FALLBACK_RATES[base] ?? FALLBACK_RATES['USD'];
  return NextResponse.json({
    rates: fallbackForBase,
    base,
    source: 'fallback',
    fallback_note: 'Live rates temporarily unavailable. Showing estimated rates (Feb 2026).',
  });
}
