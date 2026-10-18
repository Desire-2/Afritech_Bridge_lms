/**
 * Shared rules for how a student project is submitted and displayed.
 *
 * Both student surfaces — the learning-interface `ProjectPanel` and the
 * standalone `/student/projects/[id]` page — must agree on what
 * `submission_format` means, what counts as an actual hand-in, and how the
 * `file_path` column decodes. Keeping the logic here stops the two views
 * drifting apart again.
 */

/** The row shape returned by `GET /student/projects/<id>/details`. */
export interface SubmissionRowLike {
  text_content?: string | null;
  file_path?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  submitted_at?: string | null;
  grade?: number | null;
  feedback?: string | null;
}

export type SubmissionRow = SubmissionRowLike | null | undefined;

export const DEFAULT_MAX_FILE_SIZE_MB = 50;

export const SUBMISSION_FORMAT_LABELS: Record<string, string> = {
  file_upload: 'File upload',
  text_response: 'Written response',
  both: 'Written response + file',
  presentation: 'Presentation file',
};

/**
 * `allowed_file_types` is written by instructors as a comma-separated list
 * with leading dots (".pdf,.docx"), matching the instructor input's
 * placeholder. Some older rows hold a JSON array instead, so both shapes are
 * accepted and normalised to `[".pdf", ".docx"]`. Empty means "any type".
 */
export function parseAllowedFileTypes(raw?: string | null): string[] {
  const value = raw?.trim();
  if (!value) return [];

  let parts: string[] = [];
  if (value.startsWith('[')) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) parts = parsed.map((entry) => String(entry));
    } catch {
      parts = [];
    }
  }
  if (!parts.length) parts = value.split(',');

  return parts
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .map((entry) => (entry.startsWith('.') ? entry : `.${entry}`));
}

/** `"Essay.DOCX"` -> `".docx"`; `""` when there is no extension. */
export function extensionOf(fileName: string): string {
  const index = fileName.lastIndexOf('.');
  return index > 0 ? fileName.slice(index).toLowerCase() : '';
}

/** Files a chosen name is allowed to be, given the project's allow-list. */
export function isFileTypeAllowed(fileName: string, allowed: string[]): boolean {
  if (!allowed.length) return true;
  return allowed.includes(extensionOf(fileName));
}

/** Normalised format string; older projects default to `both`. */
export function resolveSubmissionFormat(format?: string | null): string {
  return (format || 'both').toLowerCase();
}

export interface SubmissionRequirements {
  format: string;
  label: string;
  needsText: boolean;
  needsFile: boolean;
}

export function getSubmissionRequirements(format?: string | null): SubmissionRequirements {
  const resolved = resolveSubmissionFormat(format);
  return {
    format: resolved,
    label: SUBMISSION_FORMAT_LABELS[resolved] || resolved,
    needsText: resolved === 'text_response' || resolved === 'both',
    needsFile:
      resolved === 'file_upload' ||
      resolved === 'both' ||
      resolved === 'presentation',
  };
}

export interface FileRules {
  allowedFileTypes: string[];
  maxFileSizeMB: number;
  maxFileSizeBytes: number;
  /** Value for `<input accept>`, or `undefined` when anything is allowed. */
  accept?: string;
}

interface ProjectLike {
  max_file_size_mb?: number | null;
  allowed_file_types?: string | null;
}

/** Upload limits for a project, falling back to sane defaults when unset. */
export function getFileRules(project?: ProjectLike | null): FileRules {
  const allowedFileTypes = parseAllowedFileTypes(project?.allowed_file_types);
  const maxFileSizeMB =
    project?.max_file_size_mb && project.max_file_size_mb > 0
      ? project.max_file_size_mb
      : DEFAULT_MAX_FILE_SIZE_MB;
  return {
    allowedFileTypes,
    maxFileSizeMB,
    maxFileSizeBytes: maxFileSizeMB * 1024 * 1024,
    accept: allowedFileTypes.length ? allowedFileTypes.join(',') : undefined,
  };
}

/**
 * A team row scaffolded by the instructor carries no text and no file. It
 * must not count as a hand-in, otherwise the student is shown "Submitted"
 * with no way to start the work.
 */
export function submissionHasContent(row: SubmissionRow): boolean {
  return !!row && !!(row.text_content?.trim() || row.file_path || row.file_url);
}

/** A recorded grade or feedback means the instructor has seen the work. */
export function submissionHasOutcome(row: SubmissionRow): boolean {
  return (
    !!row && ((row.grade !== undefined && row.grade !== null) || !!row.feedback)
  );
}

/** The one predicate both surfaces use to decide "has this been handed in?". */
export function isSubmissionHandedIn(row: SubmissionRow): boolean {
  return submissionHasContent(row) || submissionHasOutcome(row);
}

export interface Attachment {
  url: string;
  name?: string;
}

/**
 * `file_path` is either a single URL, or — when submitted through
 * `/uploads/projects/<id>/submit-with-files` — a JSON array of
 * `{name, size, url}` objects. Decoding it here means no surface emits a
 * raw JSON string as an `href`.
 */
export function parseAttachments(
  filePath?: string | null,
  fallbackName?: string | null,
): Attachment[] {
  const raw = filePath?.trim();
  if (!raw) return [];

  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const attachments = parsed
          .map((entry): Attachment | null => {
            if (typeof entry === 'string') {
              return entry.trim() ? { url: entry.trim() } : null;
            }
            if (entry && typeof entry === 'object') {
              const record = entry as Record<string, unknown>;
              const url =
                typeof record.url === 'string' ? record.url.trim() : '';
              if (!url) return null;
              const name =
                typeof record.name === 'string' && record.name.trim()
                  ? record.name.trim()
                  : undefined;
              return { url, name };
            }
            return null;
          })
          .filter((entry): entry is Attachment => entry !== null);
        if (attachments.length) return attachments;
      }
    } catch {
      // fall through to treat it as a single URL
    }
  }

  return [{ url: raw, name: fallbackName || undefined }];
}
