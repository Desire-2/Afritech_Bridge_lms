import axios, { type AxiosRequestConfig } from 'axios';

import { axiosInstance } from './api/base.service';
import {
  unwrapEnvelope,
  type AchievementsResponse,
  type CertificatesResponse,
  type CompletenessResponse,
  type EvidenceResponse,
  type OverviewResponse,
  type ProfileResponse,
  type ProjectPayload,
  type ProjectsResponse,
  type PublishResult,
  type SkillsResponse,
  type SyncResult,
  type TalentDocument,
  type TalentDocumentEdition,
  type TalentDocumentList,
  type TalentDocumentVerification,
  type TaxonomyData,
  type TimelineResponse,
  type UnpublishResult,
  type VisibilitySettings,
} from '../types/talent-passport';

export const TALENT_BASE = '/student/talent-passport';
export const PUBLIC_BASE = '/talent/public';
export const ADMIN_BASE = '/admin/talent';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';

/**
 * Public endpoints must not carry a JWT. The shared apiClient adds one from
 * localStorage, so public calls use a bare instance with the same base URL.
 */
export const talentPublicClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

/** Structural subset of axios used by the API class (easy to stub in tests). */
export interface TalentHttpClient {
  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<{ data: T }>;
  post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<{ data: T }>;
  put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<{ data: T }>;
  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<{ data: T }>;
}

export type QueryValue = string | number | boolean | null | undefined;

/** Builds the relative URL (including query string) sent to the API. */
export function buildTalentUrl(
  path: string,
  params?: Record<string, QueryValue>,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null) continue;
    query.append(key, String(value));
  }
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
}

export function encodeTalentId(id: string | number): string {
  return encodeURIComponent(String(id));
}

const STATUS_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  410: 'GONE',
  422: 'VALIDATION_ERROR',
  429: 'RATE_LIMITED',
  500: 'SERVER_ERROR',
};

export class TalentApiError extends Error {
  readonly status: number | null;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number | null, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'TalentApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface ErrorLike {
  response?: { status?: number; data?: unknown };
  message?: string;
}

function asErrorObject(error: unknown): ErrorLike {
  return error && typeof error === 'object' ? (error as ErrorLike) : {};
}

/** Reads `{ error: { code, message, details } }` with axios/network fallbacks. */
export function parseTalentApiError(error: unknown): TalentApiError {
  const candidate = asErrorObject(error);
  const status = typeof candidate.response?.status === 'number' ? candidate.response.status : null;
  const data = candidate.response?.data;
  const dataRecord = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  const errorRecord =
    dataRecord && dataRecord.error && typeof dataRecord.error === 'object'
      ? (dataRecord.error as Record<string, unknown>)
      : dataRecord;

  const code =
    typeof errorRecord?.code === 'string' && errorRecord.code
      ? errorRecord.code
      : (status !== null && STATUS_CODES[status]) || (status === null ? 'NETWORK_ERROR' : 'REQUEST_FAILED');

  const message =
    (typeof errorRecord?.message === 'string' && errorRecord.message) ||
    (typeof dataRecord?.message === 'string' && dataRecord.message) ||
    (typeof candidate.message === 'string' && candidate.message) ||
    'Unable to complete the request. Please try again.';

  return new TalentApiError(status, code, message, errorRecord?.details ?? dataRecord?.details);
}

export function getTalentErrorStatus(error: unknown): number | null {
  return asErrorObject(error).response?.status ?? null;
}

export function isTalentUnauthorized(error: unknown): boolean {
  const status = getTalentErrorStatus(error);
  return status === 401 || status === 403;
}

export function isTalentNotFound(error: unknown): boolean {
  return getTalentErrorStatus(error) === 404;
}

export function isTalentGone(error: unknown): boolean {
  return getTalentErrorStatus(error) === 410;
}

function toBlob(payload: unknown): Blob {
  if (payload instanceof Blob) return payload;
  if (payload instanceof ArrayBuffer) return new Blob([payload], { type: 'application/pdf' });
  const unwrapped = unwrapEnvelope<unknown>(payload);
  if (unwrapped instanceof Blob) return unwrapped;
  if (unwrapped instanceof ArrayBuffer) {
    return new Blob([unwrapped], { type: 'application/pdf' });
  }
  throw new Error('Unexpected PDF response from the server');
}

/** Creates a temporary object URL so the browser can save an API blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') return;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Create a revocable object URL for a backend-generated PDF. The caller owns
 * the URL and must release it with `URL.revokeObjectURL` when finished.
 */
export function createPdfPreviewUrl(blob: Blob): string | null {
  if (typeof URL.createObjectURL !== 'function') return null;
  return URL.createObjectURL(blob);
}

export interface PageParams {
  page?: number;
  page_size?: number;
}

function pageParams(params: PageParams = {}): Record<string, QueryValue> {
  return { page: params.page ?? 1, page_size: params.page_size ?? 20 };
}

export class TalentPassportApi {
  constructor(
    private readonly http: TalentHttpClient = axiosInstance as unknown as TalentHttpClient,
    private readonly publicHttp: TalentHttpClient = talentPublicClient as unknown as TalentHttpClient,
  ) {}

  private async read<T>(client: TalentHttpClient, url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await client.get<unknown>(url, config);
      return unwrapEnvelope<T>(response.data);
    } catch (error) {
      throw parseTalentApiError(error);
    }
  }

  private async write<T>(
    method: 'post' | 'put' | 'delete',
    url: string,
    body?: unknown,
  ): Promise<T> {
    try {
      const response =
        method === 'delete'
          ? await this.http.delete<unknown>(url)
          : await this.http[method]<unknown>(url, body);
      return unwrapEnvelope<T>(response.data);
    } catch (error) {
      throw parseTalentApiError(error);
    }
  }

  getProfile(): Promise<ProfileResponse> {
    return this.read<ProfileResponse>(this.http, `${TALENT_BASE}/profile`);
  }

  updateProfile(payload: Partial<import('../types/talent-passport').TalentProfile>): Promise<ProfileResponse> {
    return this.write<ProfileResponse>('put', `${TALENT_BASE}/profile`, payload);
  }

  getOverview(): Promise<OverviewResponse> {
    return this.read<OverviewResponse>(this.http, `${TALENT_BASE}/overview`);
  }

  getSkills(): Promise<SkillsResponse> {
    return this.read<SkillsResponse>(this.http, `${TALENT_BASE}/skills`);
  }

  getEvidence(skillId: string | number): Promise<EvidenceResponse> {
    const url = buildTalentUrl(`${TALENT_BASE}/skills/${encodeTalentId(skillId)}/evidence`);
    return this.read<EvidenceResponse>(this.http, url);
  }

  getProjects(params: PageParams = {}): Promise<ProjectsResponse> {
    return this.read<ProjectsResponse>(
      this.http,
      buildTalentUrl(`${TALENT_BASE}/projects`, pageParams(params)),
    );
  }

  createProject(payload: ProjectPayload): Promise<ProjectsResponse['items'][number]> {
    return this.write<ProjectsResponse['items'][number]>('post', `${TALENT_BASE}/projects`, payload);
  }

  updateProject(id: string | number, payload: ProjectPayload): Promise<ProjectsResponse['items'][number]> {
    return this.write<ProjectsResponse['items'][number]>(
      'put',
      `${TALENT_BASE}/projects/${encodeTalentId(id)}`,
      payload,
    );
  }

  deleteProject(id: string | number): Promise<{ success: true }> {
    return this.write<{ success: true }>('delete', `${TALENT_BASE}/projects/${encodeTalentId(id)}`);
  }

  getCertificates(params: PageParams = {}): Promise<CertificatesResponse> {
    return this.read<CertificatesResponse>(
      this.http,
      buildTalentUrl(`${TALENT_BASE}/certificates`, pageParams(params)),
    );
  }

  getAchievements(params: PageParams = {}): Promise<AchievementsResponse> {
    return this.read<AchievementsResponse>(
      this.http,
      buildTalentUrl(`${TALENT_BASE}/achievements`, pageParams(params)),
    );
  }

  getTimeline(params: PageParams = {}): Promise<TimelineResponse> {
    return this.read<TimelineResponse>(
      this.http,
      buildTalentUrl(`${TALENT_BASE}/timeline`, pageParams(params)),
    );
  }

  getCompleteness(): Promise<CompletenessResponse> {
    return this.read<CompletenessResponse>(this.http, `${TALENT_BASE}/completeness`);
  }

  getVisibility(): Promise<VisibilitySettings> {
    return this.read<VisibilitySettings>(this.http, `${TALENT_BASE}/visibility`);
  }

  updateVisibility(payload: Partial<VisibilitySettings>): Promise<VisibilitySettings> {
    return this.write<VisibilitySettings>('put', `${TALENT_BASE}/visibility`, payload);
  }

  publish(): Promise<PublishResult> {
    return this.write<PublishResult>('post', `${TALENT_BASE}/publish`, {});
  }

  unpublish(): Promise<UnpublishResult> {
    return this.write<UnpublishResult>('post', `${TALENT_BASE}/unpublish`, {});
  }

  sync(): Promise<SyncResult> {
    return this.write<SyncResult>('post', `${TALENT_BASE}/sync`, {});
  }

  getTaxonomy(): Promise<TaxonomyData> {
    return this.read<TaxonomyData>(this.http, `${TALENT_BASE}/taxonomy`);
  }

  /** Request a fresh backend-owned document snapshot. No layout is sent. */
  generateDocument(edition: TalentDocumentEdition): Promise<TalentDocument> {
    return this.write<TalentDocument>('post', `${TALENT_BASE}/documents/generate`, { edition });
  }

  /** Version history for the current user's passport, newest first. */
  listDocuments(edition?: TalentDocumentEdition): Promise<TalentDocumentList> {
    return this.read<TalentDocumentList>(
      this.http,
      buildTalentUrl(`${TALENT_BASE}/documents`, edition ? { edition } : undefined),
    );
  }

  getDocumentMetadata(documentRef: string): Promise<TalentDocument> {
    return this.read<TalentDocument>(
      this.http,
      `${TALENT_BASE}/documents/${encodeTalentId(documentRef)}/metadata`,
    );
  }

  private async requestDocumentBlob(url: string, client: TalentHttpClient = this.http): Promise<Blob> {
    try {
      const response = await client.get<unknown>(url, { responseType: 'blob' });
      return toBlob(response.data);
    } catch (error) {
      throw parseTalentApiError(error);
    }
  }

  /** Inline PDF bytes for embedding a backend-owned preview. */
  previewDocument(documentRef: string): Promise<Blob> {
    return this.requestDocumentBlob(`${TALENT_BASE}/documents/${encodeTalentId(documentRef)}/preview`);
  }

  downloadDocument(documentRef: string): Promise<Blob> {
    return this.requestDocumentBlob(`${TALENT_BASE}/documents/${encodeTalentId(documentRef)}/download`);
  }

  /** Legacy owner export: delegates to a Personal Record document snapshot. */
  async exportPdf(payload?: Record<string, unknown>): Promise<Blob> {
    const edition: TalentDocumentEdition =
      payload && (payload.edition === 'professional_share' || payload.edition === 'personal_record')
        ? payload.edition
        : 'personal_record';
    const document = await this.generateDocument(edition);
    return this.downloadDocument(document.document_ref);
  }

  async downloadPassportPdf(filename = 'talent-passport.pdf'): Promise<void> {
    downloadBlob(await this.exportPdf(), filename);
  }

  /** Public endpoint - routed through the JWT-free client. */
  getPublicPassport(slug: string): Promise<unknown> {
    return this.read<unknown>(
      this.publicHttp,
      `${PUBLIC_BASE}/${encodeTalentId(slug)}`,
    );
  }

  getPublicDocumentMetadata(slug: string): Promise<TalentDocument> {
    return this.read<TalentDocument>(
      this.publicHttp,
      `${PUBLIC_BASE}/${encodeTalentId(slug)}/documents/current/metadata`,
    );
  }

  /** Public preview of the current Professional Share document. */
  previewPublicDocument(slug: string): Promise<Blob> {
    return this.requestDocumentBlob(
      `${PUBLIC_BASE}/${encodeTalentId(slug)}/documents/current/preview`,
      this.publicHttp,
    );
  }

  /** Legacy public PDF route: current Professional Share document. */
  async getPublicPdf(slug: string): Promise<Blob> {
    return this.requestDocumentBlob(
      `${PUBLIC_BASE}/${encodeTalentId(slug)}/documents/current/download`,
      this.publicHttp,
    );
  }

  getVerification(documentRef: string): Promise<TalentDocumentVerification> {
    return this.read<TalentDocumentVerification>(
      this.publicHttp,
      `/talent/verify/${encodeTalentId(documentRef)}`,
    );
  }

  async downloadPublicPassportPdf(slug: string, filename = 'talent-passport.pdf'): Promise<void> {
    downloadBlob(await this.getPublicPdf(slug), filename);
  }

  /* Admin endpoints (JWT with admin/instructor role where applicable). */

  adminGetSkills(): Promise<unknown> {
    return this.read<unknown>(this.http, `${ADMIN_BASE}/skills`);
  }

  adminCreateSkill(payload: unknown): Promise<unknown> {
    return this.write<unknown>('post', `${ADMIN_BASE}/skills`, payload);
  }

  adminGetMappings(): Promise<unknown> {
    return this.read<unknown>(this.http, `${ADMIN_BASE}/mappings`);
  }

  adminCreateMapping(payload: unknown): Promise<unknown> {
    return this.write<unknown>('post', `${ADMIN_BASE}/mappings`, payload);
  }

  adminUpdateMapping(id: string | number, payload: unknown): Promise<unknown> {
    return this.write<unknown>('put', `${ADMIN_BASE}/mappings/${encodeTalentId(id)}`, payload);
  }

  adminDeleteMapping(id: string | number): Promise<unknown> {
    return this.write<unknown>('delete', `${ADMIN_BASE}/mappings/${encodeTalentId(id)}`);
  }

  adminGetEvidence(params: Record<string, QueryValue> = {}): Promise<unknown> {
    return this.read<unknown>(this.http, buildTalentUrl(`${ADMIN_BASE}/evidence`, params));
  }

  adminVerifyEvidence(evidenceId: string | number): Promise<unknown> {
    return this.write<unknown>('post', `${ADMIN_BASE}/evidence/${encodeTalentId(evidenceId)}/verify`, {});
  }

  adminRejectEvidence(evidenceId: string | number): Promise<unknown> {
    return this.write<unknown>('post', `${ADMIN_BASE}/evidence/${encodeTalentId(evidenceId)}/reject`, {});
  }

  adminGetAudit(params: PageParams = {}): Promise<unknown> {
    return this.read<unknown>(this.http, buildTalentUrl(`${ADMIN_BASE}/audit`, pageParams(params)));
  }
}

export const talentPassportService = new TalentPassportApi();
export default talentPassportService;
