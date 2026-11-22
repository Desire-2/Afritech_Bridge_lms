/**
 * Canonical interpretation of instructor-configured upload restrictions.
 *
 * `allowed_file_types` is persisted in more than one shape across this project:
 *
 *   - comma-separated extensions: ".pdf,.docx"
 *   - a JSON array string: '["html", "css", "mp4"]'  <- what the LMS writes
 *   - a literal "*" meaning "any file type"
 *
 * Older code called `value.split(',')`, which turns the JSON form into
 * `'["html"' / '"mp4"]'` and then asked a MIME helper for `"file[\"html\""`.
 * Every entry fell back to `application/octet-stream`, so valid uploads were
 * rejected with a list of seven identical "allowed" MIME types. Normalising
 * here keeps every submission surface (assignments, projects, resubmissions)
 * on the same rule.
 */

/** Normalise any stored form to lowercase, leading-dot extensions. */
export function parseAllowedFileExtensions(raw?: string | null): string[] {
  const value = raw?.trim();
  if (!value) return [];

  let parts: string[] = [];
  if (value.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) parts = parsed.map((entry) => String(entry));
    } catch {
      parts = [];
    }
  }
  if (!parts.length) parts = value.split(',');

  return parts
    .map((entry) => entry.trim().toLowerCase().replace(/^["']|["']$/g, ''))
    .filter(Boolean)
    .map((entry) => (entry.startsWith('.') ? entry : `.${entry}`));
}

/** `"Essay.DOCX"` -> `".docx"`; `""` when there is no extension. */
export function extensionOf(fileName: string): string {
  const index = fileName.lastIndexOf('.');
  return index > 0 ? fileName.slice(index).toLowerCase() : '';
}

/**
 * Extensions to pass to `FileUploadService.validateFile`, or `undefined` when
 * the field is empty/`*` and therefore imposes no restriction.
 */
export function resolveAllowedExtensions(raw?: string | null): string[] | undefined {
  const value = raw?.trim();
  if (!value || value === '*') return undefined;
  const extensions = parseAllowedFileExtensions(value).filter((ext) => ext !== '.*');
  return extensions.length ? extensions : undefined;
}
