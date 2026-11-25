/**
 * Talent Passport domain types and dependency-free helpers.
 *
 * The helpers at the bottom are intentionally pure so they can be exercised by
 * `node:test` without a DOM harness or framework/alias resolution.
 */

export type Locale = 'en' | 'fr' | 'rw';

/** Canonical skill states. Never derive VERIFIED from provisional/AI data. */
export type SkillState =
  | 'LEARNING'
  | 'EVIDENCE_SUBMITTED'
  | 'DEMONSTRATED'
  | 'VERIFIED';

export interface TalentProfile {
  headline: string | null;
  summary: string | null;
  country: string | null;
  city: string | null;
  career_interests: string[];
  professional_goals: string | null;
  areas_of_specialization: string[];
  preferred_work_arrangement: string | null;
  preferred_opportunities: string[];
  languages: string[];
  portfolio_url: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  other_links: OtherLink[];
}

export type OtherLink = string | { label?: string | null; title?: string | null; url?: string | null };

export interface ProfileResponse {
  profile: TalentProfile;
  completeness: number;
}

export interface PassportStats {
  courses_in_progress: number;
  courses_completed: number;
  skills_learning: number;
  skills_demonstrated: number;
  skills_verified: number;
  projects: number;
  certificates: number;
  achievements: number;
}

export interface OverviewResponse {
  profile: TalentProfile;
  stats: PassportStats;
  recent_timeline: TimelineEvent[];
  completeness: number;
  last_synced_at: string | null;
}

export interface PassportSkill {
  id: string | number;
  skill: { key: string; name: string; category: string | null };
  status: SkillState;
  proficiency_level: string | null;
  proficiency_basis: string | null;
  evidence_count: number;
  latest_evidence_at: string | null;
}

export interface SkillsResponse {
  items: PassportSkill[];
  total: number;
}

export interface SkillEvidence {
  id: string | number;
  source_type: string;
  source_id: string | number | null;
  title: string;
  happened_at: string | null;
  score: number | null;
  grading_state: string | null;
  verification_status: string | null;
  status: string | null;
  course: { id: string | number; title: string } | null;
  extra: Record<string, unknown>;
}

export interface EvidenceResponse {
  items: SkillEvidence[];
  total: number;
}

export interface CourseRef {
  id: string | number;
  title: string;
}

export interface PortfolioItem {
  id: string | number;
  title: string;
  description: string | null;
  reflection: string | null;
  technologies: string[];
  external_url: string | null;
  is_featured: boolean;
  display_order: number;
  course: CourseRef | null;
  source_type: string;
  source_id: string | number | null;
  updated_at: string | null;
}

export interface ProjectPayload {
  title: string;
  description?: string | null;
  reflection?: string | null;
  technologies?: string[];
  external_url?: string | null;
  is_featured?: boolean;
  display_order?: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export type ProjectsResponse = Paginated<PortfolioItem>;

export interface PassportCertificate {
  id: string | number;
  certificate_number: string;
  title: string;
  course: CourseRef | null;
  issued_at: string | null;
  expires_at: string | null;
  status: string;
  verification_url: string | null;
  verification_hash: string | null;
}

export type CertificatesResponse = Paginated<PassportCertificate>;

export interface PassportAchievement {
  id: string | number;
  key: string;
  title: string;
  description: string | null;
  icon: string | null;
  earned_at: string | null;
  source_type: string | null;
  source_id: string | number | null;
}

export type AchievementsResponse = Paginated<PassportAchievement>;

export interface TimelineEvent {
  id: string | number;
  kind: string;
  title: string;
  description: string | null;
  date: string | null;
  source_type: string | null;
  source_id: string | number | null;
  status: string | null;
}

export type TimelineResponse = Paginated<TimelineEvent>;

export interface CompletenessItem {
  key: string;
  label: string;
  weight: number;
  earned: number;
  completed: boolean;
}

export interface CompletenessResponse {
  score: number;
  items: CompletenessItem[];
  missing: unknown[];
}

export interface VisibilitySettings {
  is_published: boolean;
  professional_profile: boolean;
  skills: boolean;
  projects: boolean;
  certificates: boolean;
  learning_history: boolean;
  achievements: boolean;
  show_email: boolean;
  show_phone: boolean;
  public_slug?: string | null;
  public_url?: string | null;
}

export interface PublishResult {
  success: true;
  public_slug: string;
  public_url: string;
  is_published: true;
}

export interface UnpublishResult {
  success: true;
  is_published: false;
}

export interface SyncResult {
  success: true;
  [count: string]: unknown;
}

/* ------------------------------------------------------------------ */
/* Backend-owned PDF documents                                          */
/* ------------------------------------------------------------------ */

export type TalentDocumentEdition = 'professional_share' | 'personal_record';
export type TalentDocumentStatus = 'current' | 'superseded' | 'revoked';

/** Metadata returned by the versioned document APIs. */
export interface TalentDocument {
  document_ref: string;
  edition: TalentDocumentEdition;
  status: TalentDocumentStatus;
  template_version: string;
  generated_at: string | null;
  verification_url: string;
  /** Private-only fields, absent from public metadata. */
  id?: number;
  data_revision?: string;
  content_sha256?: string;
  file_sha256?: string;
  is_current?: boolean;
  superseded_at?: string | null;
  revoked_at?: string | null;
}

export interface TalentDocumentList {
  items: TalentDocument[];
}

/** Public verification payload deliberately contains no hashes or ids. */
export interface TalentDocumentVerification {
  document_ref: string;
  verified: boolean;
  state: 'not_found' | 'issued' | 'revoked' | 'unpublished' | 'integrity_failed';
  edition: TalentDocumentEdition | null;
  template_version: string | null;
  generated_at: string | null;
  verification_url: string;
}

export interface TaxonomyCategory {
  id: string | number;
  key: string;
  name: string;
  name_fr: string | null;
  name_rw: string | null;
  sort_order: number;
}

export interface TaxonomySkill {
  id: string | number;
  key: string;
  name: string;
  category_id: string | number | null;
  source_profile_key: string | null;
}

export interface TaxonomyData {
  categories: TaxonomyCategory[];
  skills: TaxonomySkill[];
}

/* ------------------------------------------------------------------ */
/* Public passport                                                      */
/* ------------------------------------------------------------------ */

export type PublicSectionKey =
  | 'professional_profile'
  | 'skills'
  | 'projects'
  | 'certificates'
  | 'learning_history'
  | 'achievements';

export interface PublicProfile {
  name?: string;
  headline?: string;
  summary?: string;
  country?: string;
  city?: string;
  career_interests?: string[];
  professional_goals?: string;
  areas_of_specialization?: string[];
  preferred_work_arrangement?: string;
  preferred_opportunities?: string[];
  languages?: string[];
  portfolio_url?: string;
  github_url?: string;
  linkedin_url?: string;
  other_links?: OtherLink[];
  show_email?: boolean;
  show_phone?: boolean;
  email?: string;
  phone?: string;
}

/** Normalized view consumed by the public page. Only backend keys survive. */
export interface PublicPassportView {
  profile: PublicProfile;
  sections: Partial<Record<PublicSectionKey, boolean>>;
  skills: Array<Record<string, unknown>>;
  projects: Array<Record<string, unknown>>;
  certificates: Array<Record<string, unknown>>;
  achievements: Array<Record<string, unknown>>;
  timeline: Array<Record<string, unknown>>;
  published_at?: string | null;
  completeness?: number;
}

/* ------------------------------------------------------------------ */
/* Pure helpers                                                         */
/* ------------------------------------------------------------------ */

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

export function stringList(value: unknown): string[] {
  return asArray(value).filter((item): item is string => typeof item === 'string');
}

/** Unwraps the optional `{ success: true, data }` API envelope. */
export function unwrapEnvelope<T>(payload: unknown): T {
  const record = asRecord(payload);
  if (record && record.success === true && 'data' in record) {
    return record.data as T;
  }
  return payload as T;
}

const PUBLIC_PROFILE_KEYS = [
  'name',
  'headline',
  'summary',
  'country',
  'city',
  'career_interests',
  'professional_goals',
  'areas_of_specialization',
  'preferred_work_arrangement',
  'preferred_opportunities',
  'languages',
  'portfolio_url',
  'github_url',
  'linkedin_url',
  'other_links',
  'show_email',
  'show_phone',
  'email',
  'phone',
] as const;

export const PUBLIC_SECTION_KEYS: readonly PublicSectionKey[] = [
  'professional_profile',
  'skills',
  'projects',
  'certificates',
  'learning_history',
  'achievements',
] as const;

const PUBLIC_LIST_KEYS: Record<string, readonly string[]> = {
  skills: [
    'id',
    'skill',
    'key',
    'name',
    'category',
    'status',
    'proficiency_level',
    'proficiency_basis',
    'evidence_count',
    'latest_evidence_at',
  ],
  projects: [
    'id',
    'title',
    'description',
    'reflection',
    'technologies',
    'external_url',
    'is_featured',
    'display_order',
    'course',
    'updated_at',
  ],
  certificates: [
    'id',
    'certificate_number',
    'title',
    'course',
    'issued_at',
    'expires_at',
    'status',
    'verification_url',
    'verification_hash',
  ],
  achievements: ['id', 'key', 'title', 'description', 'icon', 'earned_at', 'source_type', 'source_id'],
  timeline: ['id', 'kind', 'title', 'description', 'date', 'source_type', 'source_id', 'status'],
};

function pickFields(source: Record<string, unknown> | null, keys: readonly string[]): Record<string, unknown> {
  if (!source) return {};
  const picked: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in source && source[key] !== undefined) {
      picked[key] = source[key];
    }
  }
  return picked;
}

function serializeList(
  payload: Record<string, unknown>,
  listKey: keyof typeof PUBLIC_LIST_KEYS,
  enabled: boolean,
): Array<Record<string, unknown>> {
  if (!enabled) return [];
  return asArray(payload[listKey])
    .map((item) => pickFields(asRecord(item), PUBLIC_LIST_KEYS[listKey]))
    .filter((item) => Object.keys(item).length > 0);
}

/**
 * Builds the exact view the public page may render. Disabled sections and
 * unknown backend fields are removed; no values are invented or defaulted.
 */
export function serializePublicPassport(raw: unknown): PublicPassportView {
  const payload = unwrapEnvelope<Record<string, unknown>>(asRecord(raw) ?? {});
  const root = asRecord(payload) ?? {};

  const rawSections = asRecord(root.sections);
  const sections: PublicPassportView['sections'] = {};
  for (const key of PUBLIC_SECTION_KEYS) {
    const value = asBoolean(rawSections?.[key]);
    if (value !== null) sections[key] = value;
  }

  const view: PublicPassportView = {
    profile: pickFields(asRecord(root.profile), PUBLIC_PROFILE_KEYS),
    sections,
    skills: serializeList(root, 'skills', sections.skills === true),
    projects: serializeList(root, 'projects', sections.projects === true),
    certificates: serializeList(root, 'certificates', sections.certificates === true),
    achievements: serializeList(root, 'achievements', sections.achievements === true),
    timeline: serializeList(root, 'timeline', sections.learning_history === true),
  };

  const publishedAt = asString(root.published_at);
  if (publishedAt !== null) view.published_at = publishedAt;
  const completeness = asNumber(root.completeness);
  if (completeness !== null) view.completeness = completeness;

  return view;
}

export function enabledPublicSections(view: PublicPassportView): PublicSectionKey[] {
  return PUBLIC_SECTION_KEYS.filter((key) => view.sections[key] === true);
}
