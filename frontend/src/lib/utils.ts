import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── Image dimension helpers (supports ![alt](url =WIDTHxHEIGHT) syntax) ──

const DIMENSION_RE = /\s+=(\d+)(?:x(\d+))?\s*$/;

/**
 * Parse optional ` =WIDTHxHEIGHT` suffix from an image URL / markdown src.
 * Returns the clean URL and optional numeric width/height.
 *
 * Examples:
 *   parseImageDimensions("https://img.com/photo.png =400x300")
 *   // => { src: "https://img.com/photo.png", width: 400, height: 300 }
 *
 *   parseImageDimensions("data:image/png;base64,...")
 *   // => { src: "data:image/png;base64,...", width: undefined, height: undefined }
 */
export function parseImageDimensions(src: string): {
  src: string;
  width?: number;
  height?: number;
} {
  if (!src) return { src };
  const match = src.match(DIMENSION_RE);
  if (!match) return { src };
  const cleanSrc = src.slice(0, src.length - match[0].length);
  const width = parseInt(match[1], 10);
  const height = match[2] ? parseInt(match[2], 10) : undefined;
  return { src: cleanSrc, width, height };
}

/**
 * Append a dimension suffix to an image URL so it can be consumed downstream
 * by `parseImageDimensions`.
 */
export function formatImageDimensions(
  src: string,
  width?: number,
  height?: number
): string {
  if (!width && !height) return src;
  if (width && height) return `${src} =${width}x${height}`;
  if (width) return `${src} =${width}`;
  return src;
}

