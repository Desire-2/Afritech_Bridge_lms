// Server-side helpers for SEO metadata, JSON-LD, and sitemaps.
// All fetches target the public course endpoints (no auth required).

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://study.afritechbridge.online'
).replace(/\/$/, '');
export const SITE_NAME = 'AfriTech Bridge';

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || ''
).replace(/\/$/, '');

/** Origin of the backend (API_URL minus the /api/v1 suffix) for asset paths. */
const API_ORIGIN = API_URL.replace(/\/api\/v\d+$/, '');

export interface PublicCourse {
  id: number;
  title?: string | null;
  description?: string | null;
  thumbnail_url?: string | null;
  instructor_name?: string | null;
  difficulty_level?: string | null;
  price?: number | null;
  currency?: string | null;
  is_published?: boolean;
  updated_at?: string | null;
}

/** Fetch a single published course. Returns null on any failure. */
export async function fetchPublicCourse(id: string): Promise<PublicCourse | null> {
  if (!API_URL || !id || !/^\d+$/.test(id)) return null;
  try {
    const res = await fetch(`${API_URL}/courses/${id}`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const data = (await res.json()) as PublicCourse | null;
    return data && typeof data === 'object' && data.id ? data : null;
  } catch {
    return null;
  }
}

/** Fetch the public course list. Returns [] on any failure. */
export async function fetchPublicCourses(): Promise<PublicCourse[]> {
  if (!API_URL) return [];
  try {
    const res = await fetch(`${API_URL}/courses`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? (data as PublicCourse[]) : [];
  } catch {
    return [];
  }
}

/** Resolve relative backend asset paths (e.g. /uploads/...) to absolute URLs. */
export function absoluteAssetUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('/') && API_ORIGIN) return `${API_ORIGIN}${path}`;
  return undefined;
}

/** Trim to a search-result friendly length on a word boundary when possible. */
export function truncate(text: string, max = 155): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Safe date for sitemap entries (undefined when the value is unparseable). */
export function safeDate(value?: string | null): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Escape a JSON-LD payload for a <script> tag (prevents </script> breakout). */
export function jsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
