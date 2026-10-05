'use client';

/**
 * 1D barcode rendering for printable shelf labels.
 *
 * `barsFor` returns bar geometry in module units (narrow = 1), `barcodeSvg`
 * turns it into an SVG string. Only symbologies the shop actually prints are
 * implemented: Code 39 for internal shop codes and EAN-13/UPC-A for retail
 * trade items (UPC-A is EAN-13 with the leading zero implied by parity).
 */

export interface BarcodeBar {
  /** Left edge of the bar, in modules from the start of the symbol. */
  x: number;
  /** Bar width, in modules. */
  width: number;
}

export interface BarcodeSvgOptions {
  /** Pixels per module. */
  moduleWidth?: number;
  /** Bar height in pixels. */
  height?: number;
  /** Quiet zone in modules, on both sides. */
  quietZone?: number;
  background?: string;
  color?: string;
}

/** Code 39: 9 elements per character (5 bars, 4 spaces), 3 of them wide. */
const CODE39_PATTERNS: Record<string, string> = {
  '0': '000110100',
  '1': '100100001',
  '2': '001100001',
  '3': '101100000',
  '4': '000110001',
  '5': '100110000',
  '6': '001110000',
  '7': '000100101',
  '8': '100100100',
  '9': '001100100',
  A: '100001001',
  B: '001001001',
  C: '101001000',
  D: '000011001',
  E: '100011000',
  F: '001011000',
  G: '000001101',
  H: '100001100',
  I: '001001100',
  J: '000011100',
  K: '100000011',
  L: '001000011',
  M: '101000010',
  N: '000010011',
  O: '100010010',
  P: '001010010',
  Q: '000000111',
  R: '100000110',
  S: '001000110',
  T: '000010110',
  U: '110000001',
  V: '011000001',
  W: '111000000',
  X: '010010001',
  Y: '110010000',
  Z: '011010000',
  '-': '010000101',
  '.': '110000100',
  ' ': '011000100',
  $: '010101000',
  '/': '010100010',
  '+': '010001010',
  '%': '000101010',
  '*': '010010100',
};

/** EAN/UPC digit encodings: 7 modules each, 1 = bar. */
const EAN_L = [
  '0001101', '0011001', '0010011', '0111101', '0100011',
  '0110001', '0101111', '0111011', '0110111', '0001011',
];
const EAN_G = [
  '0100111', '0110011', '0011011', '0100001', '0011101',
  '0111001', '0000101', '0010001', '0001001', '0010111',
];
const EAN_R = [
  '1110010', '1100110', '1101100', '1000010', '1011100',
  '1001110', '1010000', '1000100', '1001000', '1110100',
];

/** Left-group parity of the first digit for EAN-13. */
const EAN_PARITY = [
  'LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG',
  'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL',
];

const GTIN_FORMATS = ['EAN_13', 'UPC_A', 'EAN_8', 'UPC_E'];

function modulesToBars(modules: boolean[]): BarcodeBar[] {
  const bars: BarcodeBar[] = [];
  let i = 0;
  while (i < modules.length) {
    if (!modules[i]) {
      i += 1;
      continue;
    }
    let j = i;
    while (j < modules.length && modules[j]) j += 1;
    bars.push({ x: i, width: j - i });
    i = j;
  }
  return bars;
}

function pushPattern(modules: boolean[], pattern: string) {
  for (const ch of pattern) modules.push(ch === '1');
}

/** Check digit for the 12 digits that precede an EAN-13 check digit. */
function ean13CheckDigit(twelve: string): number {
  let sum = 0;
  for (let i = 0; i < twelve.length; i += 1) {
    sum += Number(twelve[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

function code39Modules(value: string): boolean[] {
  const chars = String(value ?? '').toUpperCase().split('');
  if (chars.length === 0) throw new Error('Barcode value is empty');
  // Every Code 39 symbol is framed by the start/stop "*" character; a "*"
  // inside the data would make a reader stop early, so it is rejected.
  if (chars.includes('*')) throw new Error('Code 39 cannot print "*"');
  const symbols = ['*', ...chars, '*'];
  const modules: boolean[] = [];
  symbols.forEach((ch, index) => {
    const pattern = CODE39_PATTERNS[ch];
    if (!pattern) throw new Error(`Code 39 cannot print "${ch}"`);
    if (index > 0) modules.push(false); // inter-character gap: 1 narrow space
    for (let element = 0; element < 9; element += 1) {
      const width = pattern[element] === '1' ? 3 : 1;
      const isBar = element % 2 === 0;
      for (let k = 0; k < width; k += 1) modules.push(isBar);
    }
  });
  return modules;
}

/** EAN-13 (95 modules) — also renders UPC-A by implying the leading zero. */
function ean13Modules(value: string, format: string): boolean[] {
  let digits = String(value ?? '').trim();
  if (!/^\d+$/.test(digits)) throw new Error('EAN-13 and UPC-A are numeric codes');
  if (format === 'UPC_A') {
    if (digits.length === 12) digits = `0${digits}`;
    else if (digits.length !== 13) throw new Error('A UPC-A barcode must be 12 digits');
  } else if (digits.length === 12) {
    digits = `${digits}${ean13CheckDigit(digits)}`;
  }
  if (digits.length !== 13) throw new Error('An EAN-13 barcode must be 13 digits');

  const modules: boolean[] = [];
  pushPattern(modules, '101');
  const parity = EAN_PARITY[Number(digits[0])] || 'LLLLLL';
  for (let i = 1; i <= 6; i += 1) {
    const digit = Number(digits[i]);
    pushPattern(modules, parity[i - 1] === 'L' ? EAN_L[digit] : EAN_G[digit]);
  }
  pushPattern(modules, '01010');
  for (let i = 7; i <= 12; i += 1) pushPattern(modules, EAN_R[Number(digits[i])]);
  pushPattern(modules, '101');
  if (modules.length !== 95) throw new Error('EAN-13 must encode 95 modules');
  return modules;
}

/**
 * Bar geometry for `value` in module units.
 *
 * `EAN_13`/`UPC_A` are rendered as the 95-module retail symbol; every other
 * known symbology (QR, Code 128…) is not a bar code this dialog can print, so
 * only `CODE_39` and `UNKNOWN` (the default for internal codes) fall back to
 * Code 39.
 */
export function barsFor(value: string, format?: string | null): BarcodeBar[] {
  const fmt = String(format || 'UNKNOWN').toUpperCase();
  if (fmt === 'EAN_13' || fmt === 'UPC_A') return modulesToBars(ean13Modules(value, fmt));
  if (fmt !== 'UNKNOWN' && !['CODE_39', 'CODE_39_TEXT'].includes(fmt)) {
    throw new Error(`${formatLabelFor(fmt)} cannot be printed as a shelf label`);
  }
  return modulesToBars(code39Modules(value));
}

function formatLabelFor(format: string): string {
  const map: Record<string, string> = {
    EAN_8: 'EAN-8',
    UPC_E: 'UPC-E',
    CODE_128: 'Code 128',
    ITF: 'ITF',
    QR_CODE: 'QR Code',
    DATA_MATRIX: 'Data Matrix',
  };
  return map[format] || format;
}

/** True when `value` can be drawn as a 1D shelf label in `format`. */
export function canRenderBarcode(value: string, format?: string | null): boolean {
  try {
    return barsFor(value, format).length > 0;
  } catch {
    return false;
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function escapeXml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** SVG document for `value`: black bars, quiet zones on both sides. */
export function barcodeSvg(
  value: string,
  format?: string | null,
  opts: BarcodeSvgOptions = {}
): string {
  const bars = barsFor(value, format);
  const fmt = String(format || 'UNKNOWN').toUpperCase();
  const moduleWidth = opts.moduleWidth ?? 3;
  const height = opts.height ?? 56;
  const quiet = opts.quietZone ?? (GTIN_FORMATS.includes(fmt) ? 11 : 10);
  const background = opts.background ?? '#ffffff';
  const color = opts.color ?? '#000000';

  const extent = bars.reduce((max, bar) => Math.max(max, bar.x + bar.width), 0);
  const width = round((extent + quiet * 2) * moduleWidth);

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"` +
      ` viewBox="0 0 ${width} ${height}" role="img" aria-label="Barcode ${escapeXml(value)}">`
  );
  parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="${background}"/>`);
  for (const bar of bars) {
    const x = round((quiet + bar.x) * moduleWidth);
    const w = round(bar.width * moduleWidth);
    parts.push(`<rect x="${x}" y="0" width="${w}" height="${height}" fill="${color}"/>`);
  }
  parts.push('</svg>');
  return parts.join('');
}
