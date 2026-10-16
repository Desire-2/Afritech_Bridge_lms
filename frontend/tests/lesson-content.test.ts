import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeMixedContent,
  normalizeTextContent,
  sectionsFromMarkdown,
  sectionsFromBlocks,
  sectionsToContentData,
  toStepSections,
  videoCoverageIndexFor,
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

  test('a heading becomes the title of the section that owns the following text', () => {
    const { sections, format } = normalizeMixedContent(JSON.stringify(legacy));
    assert.equal(format, 'blocks');
    assert.equal(sections.length, 3);
    assert.equal(sections[0].title, 'Introduction');
    assert.deepEqual(
      sections[0].blocks.map((b) => b.type),
      ['text']
    );
    // The video is its own section (never merged into the heading's).
    assert.equal(sections[1].title, '');
    assert.deepEqual(
      sections[1].blocks.map((b) => b.type),
      ['video']
    );
    assert.equal(sections[2].title, 'Summary');
    assert.deepEqual(
      sections[2].blocks.map((b) => b.type),
      ['text']
    );
  });

  test('heading + body render as one step; video renders as its own step', () => {
    const steps = toStepSections(normalizeMixedContent(JSON.stringify(legacy)), 'Lesson');
    assert.equal(steps.length, 3);
    assert.equal(steps[0].heading, 'Introduction');
    assert.equal(steps[0].type, 'text');
    assert.equal(steps[0].blocks?.length, 1);
    // Video step is identified by its title, not merged into the heading.
    assert.equal(steps[1].heading, 'Main Video');
    assert.equal(steps[1].type, 'video');
    assert.equal(steps[2].heading, 'Summary');
  });

  test('a video is never merged into the preceding heading section', () => {
    // The core contract: a main header + its text = ONE section; a video is
    // ALWAYS its own section. Regression guard against grouping videos under
    // the previous heading.
    const flat = [
      { type: 'heading', content: 'Concept' },
      { type: 'text', content: 'Explanation of the concept.' },
      { type: 'video', url: 'https://example.com/demo.mp4', title: 'Demo' },
      { type: 'text', content: 'Notes that follow the video.' },
      { type: 'heading', content: 'Recap' },
      { type: 'text', content: 'Summary text.' },
    ];
    const steps = toStepSections(normalizeMixedContent(JSON.stringify(flat)), 'Lesson');
    // Concept(text), Demo(video), untitled(text notes), Recap(text)
    assert.deepEqual(
      steps.map((s) => [s.heading, s.type]),
      [
        ['Concept', 'text'],
        ['Demo', 'video'],
        ['', 'text'], // trailing notes are their own (video's) step, not under Concept
        ['Recap', 'text'],
      ]
    );
    // Concept must contain only its text — no video leaked in.
    assert.equal(steps[0].blocks?.length, 1);
    assert.equal(steps[1].blocks?.length, 1);
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

  test('consecutive headings keep their slots; video still breaks out', () => {
    const flat = [
      { type: 'heading', content: 'A' },
      { type: 'heading', content: 'B' },
      { type: 'video', url: 'https://example.com/c.mp4' },
    ];
    const { sections } = normalizeMixedContent(JSON.stringify(flat));
    // A (empty), B (empty), then the video as its own section.
    assert.equal(sections.length, 3);
    assert.equal(sections[0].title, 'A');
    assert.equal(sections[1].title, 'B');
    assert.equal(sections[2].blocks[0].type, 'video');
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
    assert.equal(second.sections.length, first.sections.length);
    assert.equal(second.sections[0].title, 'Introduction');
    assert.equal(second.sections[0].blocks.length, 1);
    assert.equal(second.sections[1].blocks[0].type, 'video');
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

  test('H2 headers become sections; the leading H1 stays in the body', () => {
    const sections = sectionsFromMarkdown(markdown);
    assert.deepEqual(
      sections.map((s) => s.title),
      ['Introduction', 'Basic Syntax', 'Key Points']
    );
    const first = sections[0].blocks[0].content ?? '';
    assert.ok(first.includes('Functions are reusable'));
  });

  test('H3-H6 headers each become their own section (no walls of text)', () => {
    const sections = sectionsFromMarkdown(
      [
        '# Lesson Title',
        '',
        '## Parent',
        '',
        'Parent intro.',
        '',
        '### Child',
        '',
        'Child body.',
        '',
        '#### Topic',
        '',
        'Topic body.',
        '',
        '##### Subtopic',
        '',
        'Subtopic body.',
        '',
        '###### Detail',
        '',
        'Detail body.',
      ].join('\n')
    );
    assert.deepEqual(
      sections.map((s) => s.title),
      ['Parent', 'Child', 'Topic', 'Subtopic', 'Detail']
    );
    // Every section holds only its own content — never the next header's body.
    const child = sections.find((s) => s.title === 'Child');
    const childBody = (child?.blocks ?? []).map((b) => String(b.content ?? '')).join('\n');
    assert.ok(childBody.includes('Child body.'));
    assert.ok(!childBody.includes('Parent intro.'));
    assert.ok(!childBody.includes('Topic body.'));
    // The leading H1 is folded into the first section, never its own step.
    assert.ok((sections[0].blocks[0]?.content ?? '').includes('# Lesson Title'));
  });

  test('an H3 inside a fenced code block never splits a section', () => {
    const sections = sectionsFromMarkdown(
      '## Example\n\n```python\n### not a heading\n```\n\nafter the fence'
    );
    assert.deepEqual(sections.map((s) => s.title), ['Example']);
    const body = String(sections[0].blocks[0]?.content ?? '');
    assert.ok(body.includes('### not a heading'));
    assert.ok(body.includes('after the fence'));
  });

  test('an H1 after content becomes its own section; only a leading H1 is the title', () => {
    const sections = sectionsFromMarkdown('# Lesson\n\nIntro body.\n\n# Chapter Two\n\nChapter body.');
    assert.deepEqual(
      sections.map((s) => s.title),
      ['', 'Chapter Two']
    );
    assert.ok((sections[0].blocks[0]?.content ?? '').includes('Intro body.'));
    assert.ok((sections[1].blocks[0]?.content ?? '').includes('Chapter body.'));
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

// ── HTML headings + header-driven step navigation ─────────────────────────

describe('HTML headings and mixed step navigation', () => {
  test('standalone HTML headings (h2-h6) become sections with isolated bodies', () => {
    const sections = sectionsFromMarkdown(
      [
        '<h2>Getting Started</h2>',
        '',
        'Getting started body.',
        '',
        '<h3>Configuration</h3>',
        '',
        'Configuration body.',
        '',
        '<h4 detail>Deep detail</h4>',
        '',
        'Detail body.',
      ].join('\n')
    );
    assert.deepEqual(
      sections.map((s) => s.title),
      ['Getting Started', 'Configuration', 'Deep detail']
    );
    const config = sections.find((s) => s.title === 'Configuration');
    const body = (config?.blocks ?? []).map((b) => String(b.content ?? '')).join('\n');
    assert.ok(body.includes('Configuration body.'));
    assert.ok(!body.includes('Getting started body.'));
    assert.ok(!body.includes('Detail body.'));
  });

  test('a leading HTML h1 is the lesson title: it never becomes its own section', () => {
    const sections = sectionsFromMarkdown('<h1>Only Title</h1>\n\n## Real\n\nBody');
    assert.deepEqual(
      sections.map((s) => s.title),
      ['Real']
    );
    assert.ok(String(sections[0].blocks[0]?.content ?? '').includes('<h1>Only Title</h1>'));
    // ...and when it repeats the lesson title, the step body drops it.
    const steps = toStepSections(
      { format: 'text', sections: sectionsFromMarkdown('<h1>Only Title</h1>\n\nBody copy.'), diagnostics: [] },
      'Only Title'
    );
    assert.ok(!String(steps[0].content ?? '').includes('<h1>'));
    assert.ok(String(steps[0].content ?? '').includes('Body copy.'));
  });

  test('an HTML heading inside a fenced code block never splits a section', () => {
    const sections = sectionsFromMarkdown(
      '## Example\n\n```html\n<h2>not a heading</h2>\n<h3>also not</h3>\n```\n\nafter the fence'
    );
    assert.deepEqual(sections.map((s) => s.title), ['Example']);
    const body = String(sections[0].blocks[0]?.content ?? '');
    assert.ok(body.includes('<h2>not a heading</h2>'));
    assert.ok(body.includes('after the fence'));
  });

  test('nested headers inside a mixed section become their own steps', () => {
    const mixed = JSON.stringify([
      {
        id: 'sec_a',
        type: 'section',
        title: 'Topic',
        blocks: [
          {
            type: 'text',
            content: 'Intro line.\n\n## Selecting\n\nSelect body.\n\n<h3>Detail</h3>\n\nDetail body.',
          },
          { type: 'video', url: 'https://example.com/v.mp4' },
        ],
      },
    ]);
    const normalized = normalizeMixedContent(mixed);
    const sectionsBefore = JSON.stringify(normalized.sections);
    const steps = toStepSections(normalized, 'Lesson');

    // Step-level splitting never rewrites the coverage/progress key space.
    assert.equal(JSON.stringify(normalized.sections), sectionsBefore);
    assert.deepEqual(
      steps.map((s) => s.heading),
      ['Topic', 'Selecting', 'Detail']
    );
    assert.deepEqual(
      steps.map((s) => s.id),
      ['sec_a::0', 'sec_a::1', 'sec_a::2']
    );
    assert.equal(new Set(steps.map((s) => s.id)).size, steps.length);

    // The video stays a renderable block of its last group, and its
    // metadata maps group blocks back to original section positions.
    const last = steps[2];
    assert.deepEqual(
      (last.blocks ?? []).map((b) => b.type),
      ['text', 'video']
    );
    const meta = last.metadata as { sectionIndex: number; blockIndices: number[] };
    assert.equal(meta.sectionIndex, 0);
    assert.deepEqual(meta.blockIndices, [0, 1]);
    const coverage = videoCoverageIndexFor(normalized.sections, meta.sectionIndex, meta.blockIndices[1]);
    assert.equal(coverage, videoCoverageIndices(normalized.sections)[0]);
    assert.equal(mixedVideoCount(mixed), 1);
  });

  test('an unsplit section keeps its persisted section id', () => {
    const mixed = JSON.stringify([
      { id: 'sec_plain', type: 'section', title: 'Plain', blocks: [{ type: 'text', content: 'No headers here.' }] },
    ]);
    const steps = toStepSections(normalizeMixedContent(mixed), 'Lesson');
    assert.equal(steps.length, 1);
    assert.equal(steps[0].id, 'sec_plain');
  });

  test('content saved with literal \\n escapes still splits into sections', () => {
    // Stored as one giant line: zero real newlines, four literal \n markers.
    const escaped = '## Intro\\nIntro body.\\n\\n## Setup\\nSetup body.';
    assert.ok(!escaped.includes('\n'));
    const sections = sectionsFromMarkdown(escaped);
    assert.deepEqual(
      sections.map((s) => s.title),
      ['Intro', 'Setup']
    );
  });

  test('an inline \\n mention in single-line content is never rewritten', () => {
    const single = 'Use \\n to print a newline from Python.';
    assert.ok(!single.includes('\n'));
    const sections = sectionsFromMarkdown(single);
    assert.equal(sections.length, 1);
    assert.ok(String(sections[0].blocks[0]?.content ?? '').includes('\\n'));
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

  test('a heading item becomes a section title; video is its own step', () => {
    const steps = toStepSections(normalizeMixedContent(builderItemsToContentData(items)), 'Lesson');
    assert.deepEqual(
      steps.map((s) => s.heading),
      ['Introduction', 'Main Video', 'Key Takeaways']
    );
    assert.equal(steps[0].blocks?.length, 1, 'heading title + text body share one step');
    assert.equal(steps[1].type, 'video', 'video is its own section/step');
    assert.equal(steps[2].blocks?.length, 1);
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
    // The video after the preamble is still its own step.
    assert.ok(steps.some((s) => s.type === 'video'), 'video remains its own step');
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
