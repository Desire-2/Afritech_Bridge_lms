'use client';

import { api } from './api';

export type BarcodeFormat =
  | 'EAN_13'
  | 'UPC_A'
  | 'EAN_8'
  | 'UPC_E'
  | 'CODE_128'
  | 'CODE_39'
  | 'ITF'
  | 'QR_CODE'
  | 'DATA_MATRIX'
  | 'UNKNOWN';

export type ScanContext = 'pos' | 'receiving' | 'count' | 'lookup';

/** Formats the camera layer should try first, retail trade items first. */
export const RETAIL_FORMATS: BarcodeFormat[] = [
  'EAN_13', 'UPC_A', 'EAN_8', 'UPC_E', 'CODE_128', 'CODE_39',
];

const NATIVE_FORMAT_NAMES: BarcodeFormat[] = [
  ...RETAIL_FORMATS, 'ITF', 'QR_CODE', 'DATA_MATRIX',
];

export const FORMAT_LABELS: Record<BarcodeFormat, string> = {
  EAN_13: 'EAN-13',
  UPC_A: 'UPC-A',
  EAN_8: 'EAN-8',
  UPC_E: 'UPC-E',
  CODE_128: 'Code 128',
  CODE_39: 'Code 39',
  ITF: 'ITF',
  QR_CODE: 'QR Code',
  DATA_MATRIX: 'Data Matrix',
  UNKNOWN: 'Unknown format',
};

export function formatLabel(format?: string | null): string {
  return FORMAT_LABELS[(format as BarcodeFormat) || 'UNKNOWN'] || 'Unknown format';
}

/** Trim scanner line endings and stray whitespace; never coerce to a number. */
export function normalizeBarcode(raw: string): string {
  return String(raw ?? '')
    .replace(/[\r\n\t]/g, '')
    .trim();
}

function ean13CheckOk(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(digits[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(digits[12]);
}

function upcACheckOk(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    sum += Number(digits[i]) * (i % 2 === 0 ? 3 : 1);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(digits[11]);
}

function ean8CheckOk(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    sum += Number(digits[i]) * (i % 2 === 0 ? 3 : 1);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(digits[7]);
}

/** Best-effort client-side hint — the server keeps its own detection. */
export function detectBarcodeFormat(raw: string): BarcodeFormat {
  const value = normalizeBarcode(raw);
  if (!/^\d+$/.test(value)) return 'UNKNOWN';
  if (value.length === 13 && ean13CheckOk(value)) return 'EAN_13';
  if (value.length === 12 && upcACheckOk(value)) return 'UPC_A';
  if (value.length === 8 && ean8CheckOk(value)) return 'EAN_8';
  if (value.length === 6) return 'UPC_E';
  // A 14-digit scan that only differs by a leading zero still reads as EAN-13.
  let padded = value;
  while (padded.length > 13 && padded[0] === '0') padded = padded.slice(1);
  if (padded.length === 13 && ean13CheckOk(padded)) return 'EAN_13';
  return 'UNKNOWN';
}

export interface BarcodeLookup {
  found: boolean;
  match?: 'barcode' | 'sku';
  barcode: string;
  barcode_format?: string;
  message?: string;
  product?: any;
  variant?: any;
  available_stock?: number;
  branch_id?: number | null;
  branches?: { branch_id: number; name: string; available: number }[];
}

/** SCAN → NORMALIZE → LOOK UP in the shop's own database. */
export async function lookupBarcode(
  value: string,
  opts: { branchId?: number | null; context?: ScanContext } = {}
): Promise<BarcodeLookup> {
  const code = normalizeBarcode(value);
  if (!code) throw new Error('Enter or scan a barcode first');
  const params: Record<string, any> = {};
  if (opts.branchId) params.branch_id = opts.branchId;
  if (opts.context) params.context = opts.context;
  // The path form is the documented API; codes containing "/" use the query form.
  if (code.includes('/')) {
    return api<BarcodeLookup>('/api/shop/products/barcode', { params: { ...params, value: code } });
  }
  return api<BarcodeLookup>(`/api/shop/products/barcode/${encodeURIComponent(code)}`, { params });
}

// ── feedback ────────────────────────────────────────────────────────────────

let audioCtx: AudioContext | null = null;

function beep(ok: boolean) {
  try {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return;
    if (!audioCtx) audioCtx = new Ctor();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.value = ok ? 1750 : 340;
    const now = audioCtx.currentTime;
    const duration = ok ? 0.07 : 0.22;
    gain.gain.setValueAtTime(0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  } catch {
    /* audio is best-effort */
  }
}

export function scanFeedback(
  kind: 'ok' | 'error',
  opts: { sound?: boolean; vibration?: boolean } = {}
): void {
  const sound = opts.sound !== false;
  const vibration = opts.vibration !== false;
  if (sound) beep(kind === 'ok');
  if (vibration && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(kind === 'ok' ? 45 : [70, 45, 70]);
    } catch {
      /* ignore */
    }
  }
}

// ── scanner preferences ─────────────────────────────────────────────────────

export interface ScannerSettings {
  preferred_input: 'camera' | 'hardware' | 'manual';
  auto_add: boolean;
  increment_repeat: boolean;
  sound: boolean;
  vibration: boolean;
  autofocus: boolean;
  scan_timeout_ms: number;
  dedupe_window_ms: number;
}

export const SCANNER_DEFAULTS: ScannerSettings = {
  preferred_input: 'hardware',
  auto_add: true,
  increment_repeat: true,
  sound: true,
  vibration: true,
  autofocus: true,
  scan_timeout_ms: 800,
  dedupe_window_ms: 1200,
};

let settingsCache: { settings: ScannerSettings; canManage: boolean } | null = null;

export function resetScannerSettingsCache() {
  settingsCache = null;
}

export async function getScannerSettings(): Promise<{
  settings: ScannerSettings;
  canManage: boolean;
}> {
  if (settingsCache) return settingsCache;
  try {
    const data = await api<any>('/api/shop/settings');
    const stored = (data && (data.scanner || data.settings?.scanner)) || {};
    const settings: ScannerSettings = { ...SCANNER_DEFAULTS, ...stored };
    const canManage = Boolean(data?.editable_keys?.includes('shop.scanner'));
    settingsCache = { settings, canManage };
  } catch {
    settingsCache = { settings: { ...SCANNER_DEFAULTS }, canManage: false };
  }
  return settingsCache;
}

// ── hardware scanner (keyboard wedge) burst detection ───────────────────────

interface Burst {
  first: number;
  last: number;
  count: number;
}

/** Fast keystroke bursts (< ~60ms apart, 4+ chars) are hardware scanners. */
export class ScanBurst {
  private burst: Burst | null = null;

  keystroke() {
    const now = Date.now();
    if (!this.burst || now - this.burst.last > 250) {
      this.burst = { first: now, last: now, count: 1 };
      return;
    }
    this.burst.last = now;
    this.burst.count += 1;
  }

  isScannerBurst(): boolean {
    if (!this.burst || this.burst.count < 4) return false;
    const elapsed = Math.max(this.burst.last - this.burst.first, 1);
    const perChar = elapsed / this.burst.count;
    return perChar <= 60;
  }

  reset() {
    this.burst = null;
  }
}

/** Suppress the same barcode when a scanner (or a double Enter) fires twice. */
export function makeScanGate(windowMs: number) {
  let last: { value: string; at: number } | null = null;
  return (value: string): boolean => {
    const now = Date.now();
    if (last && last.value === value && now - last.at < windowMs) return false;
    last = { value, at: now };
    return true;
  };
}
