import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeMixedContent,
  normalizeTextContent,
  sectionsFromMarkdown,
  sectionsFromBlocks,
  sectionsToContentData,
  toStepSections,
  videoCoverageIndices,
  mixedVideoCount,
  sectionSignature,
} from '../src/lib/lesson-content';

// ── Structured JSON ────────────────────────────────────────────────────────

describe('canonical section JSON', () => {
  const canonical = JSON.stringify([
    {
      id: 'sec_intro',
      type: 'section',
      title: 'Introduction to Python',
      blocks: [
        { type: 'text', content: 'Python is a general-purpose programming language...' },
        { type: 'video', url: 'https://example.com/v.mp4', title: 'Main Video' },
      ],
    },
    {
      id: 'sec_takeaways',
      type: 'section',
      title: 'Key Takeaways',
      blocks: [{ type: 'text', content: '- Point 1\n- Point 2' }],
    },
  ]);

  test('parses one section object holding its title and body', () => {
    const { format, sections, diagnostics } = normalizeMixedContent(canonical);
    assert.equal(format, 'sections');
    assert.equal(diagnostics.length, 0);
    assert.equal(sections.length, 2);
    assert.equal(sections[0].id, 'sec_intro');
    assert.equal(sections[0].title, 'Introduction to Python');
    assert.equal(sections[0].blocks.length, 2);
    assert.equal(sections[1].blocks.length, 1);
  });

  test('produces one navigable step per section (heading is not its own step)', () => {
    const normalized = normalizeMixedContent(canonical);
    const steps = toStepSections(normalized, 'Python 101');
    assert.equal(steps.length, 2);
    assert.equal(steps[0].heading, 'Introduction to Python');
    assert.equal(steps[0].blocks?.length, 2);
    assert.equal(steps[1].heading, 'Key Takeaways');
    // ids are the persisted section ids, never array indices
    assert.equal(steps[0].id, 'sec_intro');
    assert.equal(steps[1].id, 'sec_takeaways');
  });

  test('serializing normalized sections round-trips', () => {
    const first = normalizeMixedContent(canonical);
    const reserialized = sectionsToContentData(first.sections);
    const second = normalizeMixedContent(reserialized);
    assert.deepEqual(second.sections, first.sections);
    assert.equal(sectionSignature(second.sections), sectionSignature(first.sections));
  });
});

// ── Legacy flat content ────────────────────────────────────────────────────

describe('legacy flat block content', () => {
  const legacy = [
    { type: 'heading', content: 'Introduction', title: 'Introduction' },
    { type: 'text', content: 'Welcome to this lesson.' },
    { type: 'video', url: 'https://example.com/a.mp4', title: 'Main Video' },
    { type: 'heading', content: 'Summary', title: 'Summary' },
    { type: 'text', content: '- Point 1' },
  ];

  test('a heading becomes the title of the section that owns the following blocks', () => {
    const { sections, format } = normalizeMixedContent(JSON.stringify(legacy));
    assert.equal(format, 'blocks');
    assert.equal(sections.length, 2);
    assert.equal(sections[0].title, 'Introduction');
    assert.deepEqual(
      sections[0].blocks.map((b) => b.type),
      ['text', 'video']
    );
    assert.equal(sections[1].title, 'Summary');
    assert.deepEqual(
      sections[1].blocks.map((b) => b.type),
      ['text']
    );
  });

  test('heading + body render as one step, not two', () => {
    const steps = toStepSections(normalizeMixedContent(JSON.stringify(legacy)), 'Lesson');
    assert.equal(steps.length, 2);
    assert.equal(steps[0].heading, 'Introduction');
    assert.equal(steps[0].type, 'composite');
    assert.equal(steps[0].blocks?.length, 2);
  });

  test('video coverage indices are unchanged by normalization', () => {
    const legacyVideoIndices = legacy
      .map((block, index) => (block.type === 'video' ? index : -1))
      .filter((index) => index >= 0);
    const { sections } = normalizeMixedContent(JSON.stringify(legacy));
    assert.deepEqual(videoCoverageIndices(sections), legacyVideoIndices);
    assert.deepEqual(videoCoverageIndices(sections), [2]);
    assert.equal(mixedVideoCount(JSON.stringify(legacy)), 1);
  });

  test('coverage index is stable for content that starts without a heading', () => {
    const flat = [
      { type: 'text', content: 'intro' },
      { type: 'video', url: 'https://example.com/b.mp4' },
    ];
    const { sections } = normalizeMixedContent(JSON.stringify(flat));
    assert.deepEqual(videoCoverageIndices(sections), [1]);
  });

  test('consecutive headings keep their slots', () => {
    const flat = [
      { type: 'heading', content: 'A' },
      { type: 'heading', content: 'B' },
      { type: 'video', url: 'https://example.com/c.mp4' },
    ];
    const { sections } = normalizeMixedContent(JSON.stringify(flat));
    assert.equal(sections.length, 2);
    assert.deepEqual(videoCoverageIndices(sections), [2]);
  });

  test('a heading with no text stays a block so item count is preserved', () => {
    const flat = [{ type: 'heading', content: '' }, { type: 'video', url: 'https://x/v.mp4' }];
    const { sections } = normalizeMixedContent(JSON.stringify(flat));
    const totalItems = sections.reduce(
      (count, section) => count + section.blocks.length + (section.title ? 1 : 0),
      0
    );
    assert.equal(totalItems, flat.length);
    assert.deepEqual(videoCoverageIndices(sections), [1]);
  });

  test('unsupported block types are preserved, never dropped', () => {
    const flat = [
      { type: 'heading', content: 'Weird' },
      { type: 'h5p', content: 'interactive', url: 'https://example.com/x' },
      { type: 'text', content: 'after' },
    ];
    const { sections } = normalizeMixedContent(JSON.stringify(flat));
    assert.equal(sections[0].blocks.length, 2);
    assert.equal(sections[0].blocks[0].type, 'h5p');
    assert.equal(sections[0].blocks[0].content, 'interactive');
  });

  test('instructor-authored title wins over a generated "Section N" label', () => {
    const steps = toStepSections(normalizeMixedContent(JSON.stringify(legacy)), 'Lesson');
    assert.equal(steps[0].heading, 'Introduction');
    assert.ok(!/^Section \d+$/.test(steps[0].heading ?? ''));
  });

  test('a leading H2 that repeats the section title is not shown twice', () => {
    const flat = [
      { type: 'heading', content: 'Introduction' },
      { type: 'text', content: '## Introduction\n\nWelcome aboard.' },
    ];
    const steps = toStepSections(normalizeMixedContent(JSON.stringify(flat)), 'Lesson');
    assert.equal(steps.length, 1);
    assert.equal(steps[0].heading, 'Introduction');
    const body = steps[0].blocks?.[0]?.content ?? '';
    assert.ok(!body.includes('## Introduction'), 'duplicate H2 must be stripped');
    assert.ok(body.includes('Welcome aboard.'));
  });

  test('legacy round-trip preserves identity and ordering across re-save', () => {
    const first = normalizeMixedContent(JSON.stringify(legacy));
    const saved = sectionsToContentData(first.sections);
    const second = normalizeMixedContent(saved);
    assert.deepEqual(sectionSignature(second.sections), sectionSignature(first.sections));
    assert.deepEqual(videoCoverageIndices(second.sections), videoCoverageIndices(first.sections));
    assert.equal(second.sections[0].title, 'Introduction');
    assert.equal(second.sections[0].blocks.length, 2);
  });
});

// ── Malformed / empty content ──────────────────────────────────────────────

describe('invalid and empty content', () => {
  test('empty string yields no sections and no fake content', () => {
    const { format, sections } = normalizeMixedContent('');
    assert.equal(format, 'empty');
    assert.equal(sections.length, 0);
    const steps = toStepSections({ format, sections, diagnostics: [] }, 'Lesson');
    assert.equal(steps.length, 0);
  });

  test('malformed JSON falls back to the markdown parser with a diagnostic', () => {
    const raw = '## First\n\nBody one\n\n## Second\n\nBody two';
    const { format, sections, diagnostics } = normalizeMixedContent(raw);
    assert.equal(format, 'text');
    assert.equal(sections.length, 2);
    assert.equal(sections[0].title, 'First');
    assert.equal(diagnostics[0]?.code, 'mixed_content_not_json');
  });

  test('JSON array of the wrong shape reports an actionable error', () => {
    const { format, sections, diagnostics } = normalizeMixedContent('"just a string"');
    assert.equal(format, 'invalid');
    assert.equal(sections.length, 0);
    assert.equal(diagnostics[0]?.code, 'mixed_content_unexpected_shape');
  });

  test('an object without sections reports an error instead of dropping data', () => {
    const { format, diagnostics } = normalizeMixedContent('{"foo": 1}');
    assert.equal(format, 'invalid');
    assert.equal(diagnostics[0]?.code, 'mixed_content_unexpected_object');
  });

  test('an object carrying a sections array is accepted', () => {
    const { format, sections } = normalizeMixedContent(
      JSON.stringify({ sections: [{ title: 'A', blocks: [{ type: 'text', content: 'x' }] }] })
    );
    assert.equal(format, 'sections');
    assert.equal(sections.length, 1);
    assert.equal(sections[0].title, 'A');
  });

  test('non-object array entries are preserved as blocks', () => {
    const { sections } = normalizeMixedContent(JSON.stringify(['raw string', { type: 'text', content: 'ok' }]));
    assert.equal(sections[0].blocks.length, 2);
    assert.equal(sections[0].blocks[0].type, 'unknown');
    assert.equal(sections[0].blocks[0].content, 'raw string');
  });
});

// ── Markdown / text lessons ────────────────────────────────────────────────

describe('markdown section splitting', () => {
  const markdown = `# Python Functions Tutorial

## Introduction

Functions are reusable blocks of code.

## Basic Syntax

\`\`\`python
def function_name(parameters):
    ## not a real heading, inside a fence
    return result
\`\`\`

Use \`def\` to define functions.

## Key Points

- Use \`def\`
- Parameters are optional
`;

  test('H2 lines become sections; H1 and H3+ stay in the body', () => {
    const sections = sectionsFromMarkdown(markdown);
    assert.deepEqual(
      sections.map((s) => s.title),
      ['Introduction', 'Basic Syntax', 'Key Points']
    );
    const first = sections[0].blocks[0].content ?? '';
    assert.ok(first.includes('Functions are reusable'));
  });

  test('a heading inside a fenced code block never splits a section', () => {
    const sections = sectionsFromMarkdown(markdown);
    const syntax = sections.find((s) => s.title === 'Basic Syntax');
    assert.ok(syntax);
    assert.equal(syntax!.blocks.length, 1);
    assert.ok((syntax!.blocks[0].content ?? '').includes('## not a real heading'));
  });

  test('a leading H1-only stub does not become its own section', () => {
    const sections = sectionsFromMarkdown('# Only Title\n\n## Real\n\nBody');
    assert.deepEqual(
      sections.map((s) => s.title),
      ['Real']
    );
    assert.ok((sections[0].blocks[0].content ?? '').includes('# Only Title'));
  });

  test('standalone bold lines act as section titles, inline bold does not', () => {
    const sections = sectionsFromMarkdown(
      'Intro paragraph with **inline emphasis** inside.\n\n**Part One**\n\nBody one.\n\n**Part Two**\n\nBody two.'
    );
    // The prose before the first title is its own untitled section; inline
    // emphasis never opens a new section.
    assert.deepEqual(
      sections.map((s) => s.title),
      ['', 'Part One', 'Part Two']
    );
    assert.ok((sections[0].blocks[0].content ?? '').includes('inline emphasis'));
    // ...and it renders as the conventional "Introduction" step.
    const steps = toStepSections({ format: 'text', sections, diagnostics: [] }, 'Lesson');
    assert.equal(steps[0].heading, 'Introduction');
  });

  test('inline code containing markdown syntax is untouched', () => {
    const sections = sectionsFromMarkdown('Use `## not a heading` inline safely.');
    assert.equal(sections.length, 1);
    assert.equal(sections[0].title, '');
    assert.ok((sections[0].blocks[0].content ?? '').includes('`## not a heading`'));
  });

  test('bare media URLs on their own line become media blocks', () => {
    const sections = sectionsFromMarkdown(
      'Watch this:\n\nhttps://www.youtube.com/watch?v=abc123\n\nhttps://example.com/file.mp4\n\n![diagram](https://example.com/i.png)'
    );
    const types = sections.flatMap((s) => s.blocks.map((b) => b.type));
    assert.ok(types.includes('video'));
    assert.ok(types.includes('image'));
    // The prose sentence stays intact as text
    assert.ok(types.includes('text'));
  });

  test('text lessons keep H1 content (never silently discarded)', () => {
    const normalized = normalizeTextContent('# Custom Title\n\nBody copy.');
    const body = normalized.sections[0].blocks[0].content ?? '';
    assert.ok(body.includes('# Custom Title'));
  });

  test('empty markdown yields no sections', () => {
    assert.equal(normalizeTextContent('   \n\n  ').sections.length, 0);
  });
});

// ── XSS / unsafe content ───────────────────────────────────────────────────

describe('unsafe content handling', () => {
  test('a script payload inside a text block is preserved as data (not executed here)', () => {
    const raw = JSON.stringify([
      { type: 'heading', content: 'Bad' },
      { type: 'text', content: '<script>alert(1)</script>' },
    ]);
    const steps = toStepSections(normalizeMixedContent(raw), 'L');
    assert.equal(steps[0].blocks?.[0]?.content, '<script>alert(1)</script>');
    // Sanitization happens in TextContentRenderer via rehype-sanitize;
    // the parser must never turn it into markup or drop it silently.
    assert.equal(steps.length, 1);
  });

  test('javascript: URLs are kept as data, not transformed', () => {
    const raw = JSON.stringify([{ type: 'video', url: 'javascript:alert(1)' }]);
    const { sections } = normalizeMixedContent(raw);
    assert.equal(sections[0].blocks[0].url, 'javascript:alert(1)');
  });

  test('XSS payload in a markdown heading does not create extra sections', () => {
    const sections = sectionsFromMarkdown('## <img src=x onerror=alert(1)>\n\nbody');
    assert.equal(sections.length, 1);
    assert.ok(sections[0].title.includes('img src=x'));
  });
});

// ── Section identity ───────────────────────────────────────────────────────

describe('stable section identity', () => {
  test('legacy ids are deterministic across reloads', () => {
    const raw = JSON.stringify([
      { type: 'heading', content: 'Alpha' },
      { type: 'text', content: 'body' },
      { type: 'heading', content: 'Beta' },
      { type: 'text', content: 'body 2' },
    ]);
    const a = sectionSignature(normalizeMixedContent(raw).sections);
    const b = sectionSignature(normalizeMixedContent(raw).sections);
    assert.equal(a, b);
    assert.ok(!/^\d+(\|\d+)*$/.test(a), 'ids must not be array indices');
  });

  test('identical legacy sections still get distinct ids', () => {
    const raw = JSON.stringify([
      { type: 'heading', content: 'Same' },
      { type: 'text', content: 'x' },
      { type: 'heading', content: 'Same' },
      { type: 'text', content: 'x' },
    ]);
    const sections = normalizeMixedContent(raw).sections;
    assert.equal(sections.length, 2);
    assert.notEqual(sections[0].id, sections[1].id);
  });

  test('reordering sections does not change their ids', () => {
    const sections = normalizeMixedContent(
      JSON.stringify([
        { id: 'a', title: 'A', blocks: [{ type: 'text', content: '1' }] },
        { id: 'b', title: 'B', blocks: [{ type: 'text', content: '2' }] },
      ])
    ).sections;
    const reordered = [sections[1], sections[0]];
    assert.equal(reordered[0].id, 'b');
    assert.equal(reordered[1].id, 'a');
  });

  test('editing a title keeps the same section id', () => {
    const sections = normalizeMixedContent(
      JSON.stringify([{ id: 'keep', title: 'Old', blocks: [{ type: 'text', content: 'x' }] }])
    ).sections;
    sections[0].title = 'New';
    const reloaded = normalizeMixedContent(sectionsToContentData(sections)).sections;
    assert.equal(reloaded[0].id, 'keep');
    assert.equal(reloaded[0].title, 'New');
    assert.equal(reloaded[0].blocks.length, 1);
  });
});

// ── sectionsFromBlocks edge cases ─────────────────────────────────────────

describe('sectionsFromBlocks', () => {
  test('content before the first heading forms an untitled section', () => {
    const sections = sectionsFromBlocks([
      { type: 'text', content: 'preamble' },
      { type: 'heading', content: 'Later' },
      { type: 'text', content: 'after' },
    ]);
    assert.equal(sections.length, 2);
    assert.equal(sections[0].title, '');
    assert.equal(sections[0].blocks[0].content, 'preamble');
    assert.equal(sections[1].title, 'Later');
  });

  test('a trailing heading becomes a standalone divider section', () => {
    const sections = sectionsFromBlocks([
      { type: 'text', content: 'body' },
      { type: 'heading', content: 'Appendix' },
    ]);
    assert.equal(sections.length, 2);
    assert.equal(sections[1].title, 'Appendix');
    assert.equal(sections[1].blocks.length, 0);
  });
});

// ── Instructor editor adapter ──────────────────────────────────────────────

import {
  builderItemsToContentData,
  contentDataToBuilderItems,
  type LessonBuilderItem,
} from '../src/lib/lesson-content';

describe('instructor editor adapter', () => {
  const items: LessonBuilderItem[] = [
    { id: 'i1', type: 'heading', content: 'Introduction', metadata: { title: 'Introduction' } },
    { id: 'i2', type: 'text', content: 'Welcome.' },
    { id: 'i3', type: 'video', content: 'https://example.com/a.mp4', metadata: { url: 'https://example.com/a.mp4', title: 'Main Video' } },
    { id: 'i4', type: 'heading', content: 'Key Takeaways', metadata: { title: 'Key Takeaways' } },
    { id: 'i5', type: 'text', content: '- Point 1' },
  ];

  test('a heading item becomes a section title, not its own step', () => {
    const steps = toStepSections(normalizeMixedContent(builderItemsToContentData(items)), 'Lesson');
    assert.deepEqual(
      steps.map((s) => s.heading),
      ['Introduction', 'Key Takeaways']
    );
    assert.equal(steps[0].blocks?.length, 2, 'heading + body share one step');
    assert.equal(steps[1].blocks?.length, 1);
  });

  test('items before the first heading survive as an introduction step', () => {
    const withLead: LessonBuilderItem[] = [
      { id: 'a', type: 'text', content: 'Preamble.' },
      ...items,
    ];
    const steps = toStepSections(
      normalizeMixedContent(builderItemsToContentData(withLead)),
      'Lesson'
    );
    assert.equal(steps[0].heading, 'Introduction');
    assert.ok((steps[0].blocks?.[0] as { content?: string })?.content?.includes('Preamble.'));
  });

  test('editor round-trip preserves titles, types and media urls', () => {
    const stored = builderItemsToContentData(items);
    const restored = contentDataToBuilderItems(stored);
    assert.deepEqual(
      restored.map((item) => [item.type, item.content]),
      [
        ['heading', 'Introduction'],
        ['text', 'Welcome.'],
        ['video', 'https://example.com/a.mp4'],
        ['heading', 'Key Takeaways'],
        ['text', '- Point 1'],
      ]
    );
    assert.equal(restored[2].metadata?.title, 'Main Video');
  });

  test('legacy flat storage loads into the editor as grouped items', () => {
    const legacy = JSON.stringify([
      { type: 'heading', content: 'Intro' },
      { type: 'text', content: 'body' },
      { type: 'video', url: 'https://example.com/v.mp4' },
    ]);
    const restored = contentDataToBuilderItems(legacy);
    assert.deepEqual(
      restored.map((item) => item.type),
      ['heading', 'text', 'video']
    );
    assert.equal(restored[0].content, 'Intro');
    assert.equal(restored[2].content, 'https://example.com/v.mp4');
  });

  test('re-saving from the editor never changes video coverage indices', () => {
    const stored = builderItemsToContentData(items);
    const resaved = builderItemsToContentData(contentDataToBuilderItems(stored));
    assert.deepEqual(
      videoCoverageIndices(normalizeMixedContent(resaved).sections),
      videoCoverageIndices(normalizeMixedContent(stored).sections)
    );
  });
});
