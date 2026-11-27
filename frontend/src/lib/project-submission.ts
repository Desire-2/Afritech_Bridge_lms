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

import {
  extensionOf,
  parseAllowedFileExtensions,
} from './file-upload-rules';

/**
 * `allowed_file_types` is written by instructors as a comma-separated list
 * with leading dots (".pdf,.docx"), matching the instructor input's
 * placeholder. Some rows hold a JSON array instead, so both shapes are
 * accepted and normalised to `[".pdf", ".docx"]` by the shared parser. Empty
 * means "any type". Re-exported here to keep this module's public API stable.
 */
export const parseAllowedFileTypes = parseAllowedFileExtensions;
export { extensionOf };

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
 * `file_path` is either a single URL (legacy rows), or — as with assignment
 * `file_url` — a JSON array of Vercel Blob file records. Both `filename`
 * (assignment shape) and `name` (older project shape) are accepted, so no
 * surface emits a raw JSON string as an `href`.
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
              const rawName = record.filename ?? record.name;
              const name =
                typeof rawName === 'string' && rawName.trim()
                  ? rawName.trim()
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

/**
 * Project uploads go through the same `/api/upload` Vercel Blob pipeline as
 * assignment uploads. Keep the metadata record identical to the one the
 * assignment surfaces already send, so `file_path` / `file_url` carry the
 * same shape and AAGE can read either column the same way.
 */
export interface ProjectFileMetadata {
  url: string;
  filename: string;
  size?: number;
  contentType?: string;
  uploadedAt?: string;
  storage?: string;
}

export function projectFileMetadata(uploaded: {
  url: string;
  pathname?: string;
  size?: number;
  contentType?: string;
  uploadedAt?: string;
  storage?: string;
}): ProjectFileMetadata {
  return {
    url: uploaded.url,
    filename: uploaded.pathname?.split('/').pop() || 'submission_file',
    size: uploaded.size,
    contentType: uploaded.contentType,
    uploadedAt: uploaded.uploadedAt,
    storage: uploaded.storage,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Submission routing (shared by student resubmission + instructor modification)
// ─────────────────────────────────────────────────────────────────────────────

export type SubmissionEndpointType = 'assignment' | 'project';

/** Default matches the app's own fallback in the grading surfaces. */
export const DEFAULT_API_BASE_URL = 'http://localhost:5001/api/v1';

function apiBase(apiBaseUrl?: string | null): string {
  return (apiBaseUrl || DEFAULT_API_BASE_URL).replace(/\/+$/, '');
}

/** Upload folder must match the type of record the endpoint expects. */
export function submissionUploadFolder(
  type: SubmissionEndpointType,
): 'assignments' | 'projects' {
  return type === 'project' ? 'projects' : 'assignments';
}

/**
 * File-backed submission/resubmission endpoint for one submission type.
 *
 * Projects do not have a dedicated `resubmit-with-files` route; the existing
 * project file endpoint is `submit-with-files`. Reusing it (rather than the
 * assignment route) keeps project ids out of assignment URLs.
 */
export function buildResubmissionEndpoint(
  type: SubmissionEndpointType,
  id: number,
  apiBaseUrl?: string | null,
): string {
  const base = apiBase(apiBaseUrl);
  return type === 'project'
    ? `${base}/uploads/projects/${id}/submit-with-files`
    : `${base}/uploads/assignments/${id}/resubmit-with-files`;
}

/** Instructor "request modification" endpoint for one submission type. */
export function buildModificationRequestEndpoint(
  type: SubmissionEndpointType,
  id: number,
  apiBaseUrl?: string | null,
): string {
  const base = apiBase(apiBaseUrl);
  return type === 'project'
    ? `${base}/modification/projects/${id}/request-modification`
    : `${base}/modification/assignments/${id}/request-modification`;
}

export interface ResubmissionPayloadOptions {
  text?: string | null;
  notes?: string | null;
  files?: unknown[];
  teamMembers?: number[];
}

/**
 * The assignment and project upload routes accept different body field names.
 * Keeping the projection here means neither student surface can accidentally
 * send an assignment-shaped body to a project endpoint (or vice versa).
 */
export function buildResubmissionPayload(
  type: SubmissionEndpointType,
  options: ResubmissionPayloadOptions,
): Record<string, unknown> {
  const files = Array.isArray(options.files) ? options.files : [];
  if (type === 'project') {
    return {
      text_content: options.text?.trim() || undefined,
      files,
      team_members: options.teamMembers ?? [],
    };
  }
  return {
    content: options.text?.trim() || undefined,
    files,
    resubmission_notes: options.notes?.trim() || undefined,
  };
}
