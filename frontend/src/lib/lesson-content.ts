/**
 * Canonical lesson-content contract.
 *
 * Single source of truth for how lesson content is stored, normalized into
 * logical sections, and keyed for video-coverage progress. Every surface
 * (instructor editor, instructor preview, student player, progress tracker)
 * MUST derive its section boundaries from this module so the instructor and
 * the student never disagree about what a "section" is.
 *
 * ── Storage formats ────────────────────────────────────────────────────────
 *
 * 1. CANONICAL (new content, `content_type === "mixed"`):
 *    JSON array of section objects
 *      [{ id, type: "section", title, blocks: [{type, content|url, ...}] }]
 *    One section object holds its title AND all of its body blocks, so a
 *    heading can never become a navigation step of its own.
 *
 * 2. LEGACY FLAT (existing content produced by MixedContentBuilder / AI):
 *    JSON array of flat blocks
 *      [{type: "heading"|"text"|"video"|"pdf"|"image", content, url, title}]
 *    Normalized on read: a `heading` block becomes the title of the section
 *    that contains the blocks following it. Nothing is discarded.
 *
 * 3. MARKDOWN (text lessons, or malformed mixed JSON):
 *    Raw markdown split on every section header H2-H6 and standalone
 *    `**bold**` lines (code-fence aware), per
 *    frontend/MARKDOWN_CONTENT_GUIDELINES.md. Every header opens its own
 *    section holding only the content up to the next header, so a long
 *    lesson is read one header's worth of text at a time instead of as a
 *    single wall. A leading H1 (before any other content) is the lesson
 *    title: it stays inside the first section's body rather than becoming
 *    its own step. Header lines are never discarded - each becomes its
 *    section's title.
 *
 * ── Coverage-index invariant ───────────────────────────────────────────────
 *
 * Mixed-content video progress is stored keyed by an integer index. Legacy
 * content keys are positions in the original flat array. To keep those keys
 * valid after normalization, `videoCoverageIndices()` counts a phantom
 * "heading" slot for every section with a non-empty title — exactly where the
 * legacy `heading` block used to sit. Therefore:
 *
 *     videoCoverageIndices(normalize(legacyFlat)) === legacy video positions
 *
 * The backend mirrors this rule in
 * `backend/src/routes/student_routes.py::_mixed_video_section_indices`.
 * Any change here MUST be mirrored there (covered by
 * backend/tests/test_mixed_content_sections.py).
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type LessonBlockType =
  | 'text'
  | 'video'
  | 'pdf'
  | 'image'
  | 'code'
  | 'resource'
  | 'heading'
  | 'unknown';

/** A single ordered piece of lesson content inside a section. */
export interface LessonContentBlock {
  id?: string;
  type: string;
  content?: string;
  url?: string;
  title?: string;
  alt?: string;
  caption?: string;
  description?: string;
  language?: string;
  level?: number;
  metadata?: Record<string, unknown>;
  /** Unknown/extra fields are preserved verbatim — never dropped. */
  [key: string]: unknown;
}

/** One navigable lesson section: a title plus its ordered body blocks. */
export interface LessonSection {
  /** Stable identity. Survives reorder/edit; never an array index. */
  id: string;
  title: string;
  blocks: LessonContentBlock[];
}

export type LessonContentFormat = 'sections' | 'blocks' | 'text' | 'empty' | 'invalid';

export interface LessonContentDiagnostic {
  level: 'warning' | 'error';
  code: string;
  message: string;
}

export interface NormalizedLessonContent {
  format: LessonContentFormat;
  sections: LessonSection[];
  diagnostics: LessonContentDiagnostic[];
}

/** A navigable step rendered by InteractiveStepThroughViewer. */
export interface StepSection {
  id: string;
  type: 'text' | 'video' | 'pdf' | 'image' | 'heading' | 'composite';
  heading?: string;
  content?: string;
  url?: string;
  alt?: string;
  level?: number;
  blocks?: LessonContentBlock[];
  metadata?: Record<string, unknown>;
}

export const RENDERABLE_BLOCK_TYPES = ['text', 'video', 'pdf', 'image', 'code', 'resource', 'heading'] as const;

// ── Identity ───────────────────────────────────────────────────────────────

let idCounter = 0;

/**
 * Generate a new stable section/block id. Uses crypto.randomUUID when the
 * runtime provides it so ids are collision-safe across sessions.
 */
export function createId(prefix: 'sec' | 'blk' = 'sec'): string {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : `${Date.now().toString(36)}${(idCounter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return `${prefix}_${uuid}`;
}

/** FNV-1a 32-bit string hash (stable across runs and machines). */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Deterministic, collision-safe-within-the-lesson id for content that was
 * stored without one (legacy blocks). Same content ⇒ same id, so viewed
 * state survives a reload. Duplicates get a positional suffix.
 */
function stableIdFor(parts: string[], taken: Set<string>): string {
  const base = `sec_${fnv1a(parts.join('\u0000'))}`;
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

/** Signature used to decide whether section state may be reused. */
export function sectionSignature(sections: LessonSection[]): string {
  return sections.map((s) => s.id).join('|');
}

// ── Small helpers ──────────────────────────────────────────────────────────

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
}

function toBlock(raw: Record<string, unknown>): LessonContentBlock {
  const block = { ...raw } as LessonContentBlock;
  if (typeof block.type !== 'string' || !block.type) block.type = 'text';
  return block;
}

function newSection(title = ''): LessonSection {
  return { id: createId('sec'), title, blocks: [] };
}

// ── Markdown splitting (code-fence aware) ──────────────────────────────────

interface MarkdownChunk {
  title: string;
  blocks: LessonContentBlock[];
}

const H2_RE = /^ {0,3}##[ \t]+(.*)$/;
// Every section-header level (H2-H6): each opens its own section so learners
// navigate one header's worth of content per step.
const SECTION_HEADER_RE = /^ {0,3}#{2,6}[ \t]+(.*)$/;
const BOLD_LINE_RE = /^[ \t]*\*\*([^*\n]+)\*\*[ \t]*$/;
const FENCE_RE = /^[ \t]{0,3}(`{3,}|~{3,})/;
const H1_RE = /^ {0,3}#[ \t]+(.*)$/;
const VIDEO_FILE_RE = /^https?:\/\/\S+\.(mp4|webm|mov|m4v|ogg)(\?\S*)?$/i;
const VIDEO_HOST_RE = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|vimeo\.com|player\.vimeo\.com)\/\S*$/i;
const DRIVE_FILE_RE = /^https?:\/\/drive\.google\.com\/file\/d\/\S+$/i;
const PDF_FILE_RE = /^https?:\/\/\S+\.pdf(\?\S*)?$/i;
const IMAGE_MD_RE = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/;

/** Detect a standalone media line (never corrupts URLs or Markdown). */
function mediaBlockFor(line: string): LessonContentBlock | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const image = IMAGE_MD_RE.exec(trimmed);
  if (image) return { type: 'image', url: image[2], alt: image[1] || '' };
  if (VIDEO_FILE_RE.test(trimmed) || VIDEO_HOST_RE.test(trimmed)) {
    return { type: 'video', url: trimmed };
  }
  if (DRIVE_FILE_RE.test(trimmed) || PDF_FILE_RE.test(trimmed)) {
    return { type: 'pdf', url: trimmed };
  }
  return null;
}

/**
 * Scan markdown into an ordered item list.
 *
 * Boundaries: every section header (H2-H6) and a standalone `**bold**` line
 * (the legacy poor-man's heading, kept for compatibility). Each header opens
 * its own section, so long content is consumed one header's worth at a time
 * instead of as one wall of text. H1 is the lesson title: a leading H1 (before
 * any other content) stays in the body so the player never shows the title as
 * its own step, while an H1 after content is treated like any other header.
 * Header text becomes the section title - it is never discarded. Lines inside
 * fenced code blocks are never inspected, so `## example` in a code sample
 * cannot split a section.
 *
 * Standalone media URLs / `![alt](src)` lines become their own blocks so the
 * player can embed them instead of rendering a bare link.
 */
type MarkdownItem = { kind: 'title'; title: string } | { kind: 'block'; block: LessonContentBlock };

function scanMarkdown(text: string): MarkdownItem[] {
  const items: MarkdownItem[] = [];
  let buffer: string[] = [];
  let inFence = false;
  let fenceChar = '';

  const flushBuffer = () => {
    const body = buffer.join('\n').replace(/^\n+/, '').replace(/\s+$/, '');
    buffer = [];
    if (body) items.push({ kind: 'block', block: { type: 'text', content: body } });
  };

  for (const line of text.split('\n')) {
    const fence = FENCE_RE.exec(line);
    if (fence) {
      const marker = fence[1];
      if (!inFence) {
        inFence = true;
        fenceChar = marker[0];
        buffer.push(line);
        continue;
      }
      if (marker[0] === fenceChar) inFence = false;
      buffer.push(line);
      continue;
    }

    if (!inFence) {
      const h1 = H1_RE.exec(line);
      const header = h1 ?? SECTION_HEADER_RE.exec(line);
      if (header) {
        // A leading H1 (before any other content) is the lesson title: it
        // stays in the body so it never becomes its own navigation step.
        const leadingTitleH1 =
          h1 !== null && items.length === 0 && buffer.every((entry) => entry.trim() === '');
        if (!leadingTitleH1) {
          flushBuffer();
          items.push({ kind: 'title', title: header[1].replace(/[ \t]+#+[ \t]*$/, '').trim() });
          continue;
        }
      }
      const bold = BOLD_LINE_RE.exec(line);
      if (bold) {
        flushBuffer();
        items.push({ kind: 'title', title: bold[1].trim() });
        continue;
      }
      const media = mediaBlockFor(line);
      if (media) {
        flushBuffer();
        items.push({ kind: 'block', block: media });
        continue;
      }
    }

    buffer.push(line);
  }
  flushBuffer();
  return items;
}

/**
 * Group scanned markdown into title/body chunks, then normalize the leading
 * chunk: an empty stub is dropped, and a leading H1-only stub is hoisted into
 * the first real section (the player already renders the lesson title, so a
 * bare H1 must not become a heading-only step).
 */
export function splitMarkdownChunks(text: string): MarkdownChunk[] {
  const chunks: MarkdownChunk[] = [];
  let title = '';
  let blocks: LessonContentBlock[] = [];

  const flush = () => {
    chunks.push({ title, blocks });
    blocks = [];
  };

  for (const item of scanMarkdown(text)) {
    if (item.kind === 'title') {
      flush();
      title = item.title;
    } else {
      blocks.push(item.block);
    }
  }
  flush();

  while (chunks.length > 1 && chunks[0].title === '' && chunks[0].blocks.length === 0) {
    chunks.shift();
  }

  if (chunks.length > 1 && chunks[0].title === '' && chunks[0].blocks.length === 1) {
    const lead = chunks[0].blocks[0];
    if (lead.type === 'text') {
      const lines = String(lead.content ?? '').split('\n');
      const meaningful = lines.filter((line) => line.trim() !== '' && !H1_RE.test(line));
      if (meaningful.length === 0 && lines.join('').trim()) {
        const h1 = lines.join('\n').trim();
        const target = chunks[1];
        const index = target.blocks.findIndex((block) => block.type === 'text');
        if (index >= 0) {
          const existing = String(target.blocks[index].content ?? '');
          target.blocks[index] = {
            ...target.blocks[index],
            content: existing.trim() ? `${h1}\n\n${existing}` : h1,
          };
        } else {
          target.blocks.unshift({ type: 'text', content: h1 });
        }
        chunks.shift();
      }
    }
  }

  return chunks;
}


/**
 * Markdown → sections. Used for `content_type === "text"` lessons and as the
 * fallback when mixed-content JSON cannot be parsed.
 */
export function sectionsFromMarkdown(text: string): LessonSection[] {
  const chunks = splitMarkdownChunks(text);
  const taken = new Set<string>();
  const sections: LessonSection[] = [];

  for (const chunk of chunks) {
    const blocks = chunk.blocks
      .map((block) =>
        block.type === 'text'
          ? { ...block, content: String(block.content ?? '').replace(/^\n+/, '').replace(/\s+$/, '') }
          : block
      )
      .filter((block) => block.type !== 'text' || String(block.content ?? '').trim() !== '');
    if (!chunk.title && blocks.length === 0) continue;
    const id = stableIdFor([chunk.title, JSON.stringify(blocks)], taken);
    taken.add(id);
    sections.push({ id, title: chunk.title, blocks });
  }

  return sections;
}

// ── Legacy flat block → sections ──────────────────────────────────────────

/**
 * Group a legacy flat block array into sections.
 *
 * A `heading` block opens a new section and becomes its title; every
 * following block belongs to that section until the next heading. A heading
 * with no usable text is kept in place as an ordinary block so item count and
 * order (and therefore video-coverage indices) never change.
 *
 * A `video` block always opens its OWN section (never merged into a
 * preceding heading's section): the video is the section anchor, and any
 * trailing non-heading blocks attach to it as its notes. This preserves the
 * flat coverage-index order while keeping header+text as one step.
 */
export function sectionsFromBlocks(items: unknown[]): LessonSection[] {
  const sections: LessonSection[] = [];
  const taken = new Set<string>();
  let current: LessonSection | null = null;

  const finish = () => {
    if (current) {
      sections.push(current);
      current = null;
    }
  };

  const ensure = (): LessonSection => {
    if (!current) {
      const id = stableIdFor(['', ''], taken);
      taken.add(id);
      current = { id, title: '', blocks: [] };
    }
    return current;
  };

  for (const item of items) {
    if (!isPlainObject(item)) {
      // Preserve scalars so nothing silently disappears from the lesson.
      ensure().blocks.push({ type: 'unknown', content: String(item) });
      continue;
    }

    // Canonical section object (nested blocks) — reuse its identity.
    if (Array.isArray(item.blocks)) {
      finish();
      const title = firstString(item.title, item.name, item.heading);
      const id = firstString(item.id) || stableIdFor([title, JSON.stringify(item.blocks)], taken);
      taken.add(id);
      const blocks = (item.blocks as unknown[]).filter(isPlainObject).map(toBlock);
      const rest: Record<string, unknown> = { ...item };
      delete rest.blocks;
      delete rest.id;
      delete rest.type;
      delete rest.title;
      const section: LessonSection = { id, title, blocks };
      if (Object.keys(rest).length > 0) {
        section.metadata = rest as Record<string, unknown>;
      }
      current = section;
      continue;
    }

    const type = typeof item.type === 'string' ? item.type : '';
    if (type === 'heading' || type === 'section-title') {
      const title = firstString(item.content, item.title, item.heading, item.name);
      if (title.trim()) {
        finish();
        const id = stableIdFor([title.trim(), String(item.level ?? '')], taken);
        taken.add(id);
        current = { id, title: title.trim(), blocks: [] };
        continue;
      }
    }

    // A video is always its own section: close the open section and push a
    // video-anchored one containing only the video (empty title so no phantom
    // slot shifts coverage). The next block starts a fresh section.
    if (type === 'video') {
      finish();
      const id = stableIdFor(
        [String(item.url ?? ''), String(item.title ?? ''), 'video'],
        taken
      );
      taken.add(id);
      sections.push({ id, title: '', blocks: [toBlock(item)] });
      current = null;
      continue;
    }

    ensure().blocks.push(toBlock(item));
  }

  finish();

  // Guarantee uniqueness even when two identical legacy sections hash alike.
  const seen = new Map<string, number>();
  for (const section of sections) {
    const count = seen.get(section.id) ?? 0;
    if (count > 0) section.id = `${section.id}_${count + 1}`;
    seen.set(section.id, count + 1);
  }

  return sections;
}

// ── Normalization ──────────────────────────────────────────────────────────

/**
 * Normalize mixed-content storage into canonical sections.
 *
 * Accepts, in order: canonical section arrays, legacy flat block arrays,
 * JSON objects with a `sections` array, and finally raw markdown/text.
 * Never throws; malformed input yields diagnostics instead of data loss.
 */
export function normalizeMixedContent(raw: string): NormalizedLessonContent {
  const diagnostics: LessonContentDiagnostic[] = [];
  const source = typeof raw === 'string' ? raw.trim() : '';

  if (!source) {
    return { format: 'empty', sections: [], diagnostics };
  }

  let parsed: unknown = null;
  let jsonOk = false;
  try {
    parsed = JSON.parse(source);
    jsonOk = true;
  } catch {
    jsonOk = false;
  }

  if (!jsonOk) {
    // Not JSON. Only fall back to markdown when the payload does not look
    // like an accidental JSON fragment; otherwise report the parse failure.
    diagnostics.push({
      level: 'warning',
      code: 'mixed_content_not_json',
      message: 'Mixed content is not valid JSON; rendered using the Markdown fallback parser.',
    });
    const sections = sectionsFromMarkdown(source);
    return { format: 'text', sections, diagnostics };
  }

  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      return { format: 'empty', sections: [], diagnostics };
    }
    const looksNested = parsed.some((item) => isPlainObject(item) && Array.isArray(item.blocks));
    const sections = sectionsFromBlocks(parsed);
    if (sections.length === 0) {
      diagnostics.push({
        level: 'error',
        code: 'mixed_content_no_sections',
        message: 'Mixed content did not contain any usable sections.',
      });
      return { format: 'invalid', sections: [], diagnostics };
    }
    return { format: looksNested ? 'sections' : 'blocks', sections, diagnostics };
  }

  if (isPlainObject(parsed)) {
    const nested = Array.isArray(parsed.sections) ? parsed.sections : null;
    if (nested) {
      const sections = sectionsFromBlocks(nested);
      return { format: 'sections', sections, diagnostics };
    }
    if (typeof parsed.content === 'string' || typeof parsed.text === 'string') {
      const text = typeof parsed.content === 'string' ? parsed.content : (parsed.text as string);
      return { format: 'text', sections: sectionsFromMarkdown(text), diagnostics };
    }
    diagnostics.push({
      level: 'error',
      code: 'mixed_content_unexpected_object',
      message: 'Mixed content JSON was an object without a "sections" array.',
    });
    return { format: 'invalid', sections: [], diagnostics };
  }

  diagnostics.push({
    level: 'error',
    code: 'mixed_content_unexpected_shape',
    message: 'Mixed content JSON must be an array of sections.',
  });
  return { format: 'invalid', sections: [], diagnostics };
}

/** Normalize a `content_type === "text"` lesson (markdown) into sections. */
export function normalizeTextContent(raw: string): NormalizedLessonContent {
  const source = typeof raw === 'string' ? raw : '';
  if (!source.trim()) {
    return { format: 'empty', sections: [], diagnostics: [] };
  }
  const sections = sectionsFromMarkdown(source);
  return { format: 'text', sections, diagnostics: [] };
}

/** Detect mixed-content JSON that is actually a markdown payload. */
export function normalizeLessonContent(
  raw: string,
  contentType: string | undefined | null
): NormalizedLessonContent {
  if (contentType === 'text') return normalizeTextContent(raw);
  return normalizeMixedContent(raw);
}

// ── Serialization ──────────────────────────────────────────────────────────

/** Serialize canonical sections for storage in `Lesson.content_data`. */
export function sectionsToContentData(sections: LessonSection[]): string {
  const payload = sections.map((section) => ({
    id: section.id,
    type: 'section',
    title: section.title,
    ...(section.metadata ? { metadata: section.metadata } : {}),
    blocks: section.blocks,
  }));
  return JSON.stringify(payload, null, 2);
}

// ── Instructor-editor adapter ──────────────────────────────────────────────
//
// The mixed-content builder edits a FLAT list of items (one heading item,
// then one item per block). These two functions convert that editing model
// to and from the canonical section storage, so the structure the instructor
// arranges is exactly the structure the student navigates.

/** One flat item in the instructor editor's mixed-content builder. */
export interface LessonBuilderItem {
  id: string;
  type: string;
  content: string;
  metadata?: { title?: string; caption?: string; url?: string };
}

function builderItemToBlock(item: LessonBuilderItem): LessonContentBlock {
  const metadata = item.metadata;
  switch (item.type) {
    case 'heading':
      return { type: 'heading', content: item.content, title: metadata?.title || item.content };
    case 'text':
      return { type: 'text', content: item.content };
    case 'video':
    case 'pdf':
      return {
        type: item.type,
        url: metadata?.url || item.content,
        title: metadata?.title || '',
        description: metadata?.caption || '',
      };
    case 'image':
      return {
        type: 'image',
        url: metadata?.url || item.content,
        caption: metadata?.caption || '',
        title: metadata?.title || '',
      };
    default:
      return { type: item.type || 'text', content: item.content };
  }
}

/**
 * Builder items → canonical section storage. A heading item becomes the
 * TITLE of the section that owns the items after it (shared grouping rule),
 * so it never becomes a navigation step of its own.
 */
export function builderItemsToContentData(items: LessonBuilderItem[]): string {
  const { sections } = normalizeMixedContent(JSON.stringify(items.map(builderItemToBlock)));
  return sectionsToContentData(sections);
}

/** Canonical (or legacy) storage → instructor-editor items. */
export function contentDataToBuilderItems(raw: string): LessonBuilderItem[] {
  const items: LessonBuilderItem[] = [];

  normalizeMixedContent(raw).sections.forEach((section) => {
    if (section.title.trim()) {
      items.push({
        id: `${section.id}-title`,
        type: 'heading',
        content: section.title,
        metadata: { title: section.title },
      });
    }
    section.blocks.forEach((block, index) => {
      const type =
        block.type === 'video' || block.type === 'pdf' || block.type === 'image' || block.type === 'heading'
          ? block.type
          : 'text';
      const isMedia = type === 'video' || type === 'pdf' || type === 'image';
      items.push({
        id: `${section.id}-b${index}`,
        type,
        content: isMedia ? String(block.url || block.content || '') : String(block.content || ''),
        metadata: {
          title: String(block.title || ''),
          caption: String(block.caption || block.description || ''),
          url: String(block.url || ''),
        },
      });
    });
  });

  return items;
}

// ── Video coverage index space ────────────────────────────────────────────

export interface CoveragePosition {
  sectionIndex: number;
  blockIndex: number;
  /** Position in the legacy-equivalent flat sequence. */
  coverageIndex: number;
  block: LessonContentBlock;
}

/**
 * Walk every block while computing the legacy-compatible coverage index.
 *
 * A section with a non-empty title contributes one phantom "heading" slot
 * first — exactly where its legacy `heading` block used to live — so indices
 * recorded before normalization stay valid afterwards.
 */
export function coveragePositions(sections: LessonSection[]): CoveragePosition[] {
  const positions: CoveragePosition[] = [];
  let index = 0;
  sections.forEach((section, sectionIndex) => {
    if (section.title.trim()) index += 1;
    section.blocks.forEach((block, blockIndex) => {
      positions.push({ sectionIndex, blockIndex, coverageIndex: index, block });
      index += 1;
    });
  });
  return positions;
}

/** Coverage indices of every video block, in document order. */
export function videoCoverageIndices(sections: LessonSection[]): number[] {
  return coveragePositions(sections)
    .filter((position) => position.block.type === 'video')
    .map((position) => position.coverageIndex);
}

/** Number of videos in mixed content, tolerant of any storage format. */
export function mixedVideoCount(raw: string): number {
  return videoCoverageIndices(normalizeMixedContent(raw).sections).length;
}

/** Coverage index for a specific block, or undefined when not a video. */
export function videoCoverageIndexFor(
  sections: LessonSection[],
  sectionIndex: number,
  blockIndex: number
): number | undefined {
  const found = coveragePositions(sections).find(
    (position) => position.sectionIndex === sectionIndex && position.blockIndex === blockIndex
  );
  return found?.coverageIndex;
}

// ── Step sections (what the student player navigates) ─────────────────────

function stripLeadingH1(body: string, lessonTitle: string): string {
  const title = (lessonTitle || '').trim().toLowerCase();
  if (!title) return body;
  const lines = body.split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  if (i >= lines.length) return body;
  const match = H1_RE.exec(lines[i]);
  if (!match) return body;
  if (match[1].replace(/[ \t]+#+[ \t]*$/, '').trim().toLowerCase() !== title) return body;
  return [...lines.slice(0, i), ...lines.slice(i + 1)].join('\n').replace(/^\n+/, '');
}

function stripDuplicateTitleLead(body: string, title: string): string {
  const normalizedTitle = title.trim().toLowerCase();
  if (!normalizedTitle) return body;
  const lines = body.split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  const match = i < lines.length ? H2_RE.exec(lines[i]) : null;
  if (!match) return body;
  if (match[1].replace(/[ \t]+#+[ \t]*$/, '').trim().toLowerCase() !== normalizedTitle) return body;
  return [...lines.slice(0, i), ...lines.slice(i + 1)].join('\n').replace(/^\n+/, '');
}

/**
 * Convert normalized sections into the navigable step list.
 *
 * One section ⇒ one step. A section title is never emitted as its own step,
 * and a section title is never duplicated as an H2 inside its own body.
 */
export function toStepSections(normalized: NormalizedLessonContent, lessonTitle = ''): StepSection[] {
  const { sections } = normalized;
  const steps: StepSection[] = [];

  sections.forEach((section, sectionIndex) => {
    const blocks = section.blocks.map((block) => ({ ...block }));

    // Drop a leading H2 that merely repeats the section title (the AI
    // generator historically emitted `heading` + `## Heading` text pairs).
    const firstText = blocks.findIndex((block) => block.type === 'text');
    if (firstText !== -1 && section.title) {
      const content = stripDuplicateTitleLead(String(blocks[firstText].content ?? ''), section.title);
      if (content !== blocks[firstText].content) {
        if (content.trim()) blocks[firstText].content = content;
        else blocks.splice(firstText, 1);
      }
    }

    const firstTextAfter = blocks.findIndex((block) => block.type === 'text');
    if (firstTextAfter !== -1) {
      const content = stripLeadingH1(String(blocks[firstTextAfter].content ?? ''), lessonTitle);
      if (content !== blocks[firstTextAfter].content) {
        if (content.trim()) blocks[firstTextAfter].content = content;
        else blocks.splice(firstTextAfter, 1);
      }
    }

    // Untitled leading section: call it "Introduction" only when other
    // sections do carry titles (avoids inventing labels for single-section
    // lessons while keeping the historical introduction behaviour). An
    // untitled video-anchored section is labelled with the video title (or
    // "Video") so the step is identifiable.
    let heading = section.title;
    if (!heading) {
      const single = blocks.length === 1 ? blocks[0] : null;
      if (single && single.type === 'video') {
        heading =
          typeof single.title === 'string' && single.title.trim()
            ? single.title
            : 'Video';
      } else if (sectionIndex === 0 && sections.some((s, i) => i > 0 && s.title.trim())) {
        heading = 'Introduction';
      }
    }

    if (blocks.length === 0) {
      steps.push({
        id: section.id,
        type: 'heading',
        heading: heading || section.title,
        content: '',
        metadata: { sectionIndex },
      });
      return;
    }

    const single = blocks.length === 1 ? blocks[0] : null;
    const type: StepSection['type'] = single
      ? (RENDERABLE_BLOCK_TYPES as readonly string[]).includes(single.type)
        ? (single.type as StepSection['type'])
        : 'text'
      : 'composite';

    steps.push({
      id: section.id,
      type,
      heading,
      content: single?.content,
      url: single?.url,
      alt: single?.alt,
      blocks,
      metadata: { sectionIndex },
    });
  });

  return steps;
}

/** Convenience: storage → step sections in one call. */
export function lessonContentToStepSections(
  raw: string,
  contentType: string | undefined | null,
  lessonTitle = ''
): { normalized: NormalizedLessonContent; steps: StepSection[] } {
  const normalized = normalizeLessonContent(raw, contentType);
  return { normalized, steps: toStepSections(normalized, lessonTitle) };
}

/** Section count for progress reporting, tolerant of every format. */
export function lessonSectionCount(raw: string, contentType: string | undefined | null): number {
  return normalizeLessonContent(raw, contentType).sections.length;
}
