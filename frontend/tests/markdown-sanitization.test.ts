import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import {
  lessonRemarkPlugins,
  lessonRehypePlugins,
  lessonUrlTransform,
  lessonSanitizeSchema,
  toPlainText,
  languageFromClassName,
} from '../src/lib/markdown';

/**
 * Renders markdown through the exact plugin configuration used by the
 * learning player and the shared MarkdownRenderer. If this pipeline ever
 * stops sanitizing, these assertions fail.
 */
function renderMarkdown(markdown: string): string {
  const element = React.createElement(
    ReactMarkdown,
    {
      remarkPlugins: lessonRemarkPlugins,
      rehypePlugins: lessonRehypePlugins,
      urlTransform: lessonUrlTransform,
    },
    markdown
  );
  return renderToStaticMarkup(element);
}

/** Strip tags and unescape entities so highlighted code can be compared to source. */
function renderedText(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * Only the real markup (tags + attributes) of the output. Text nodes are
 * escaped by react-dom, so a payload that survives as literal text (e.g.
 * `&lt;img onerror=...&gt;`) is inert and must not trip the assertions.
 */
function tagSoup(html: string): string {
  return (html.match(/<[^>]*>/g) || []).join(' ');
}

const XSS_PAYLOADS: Array<{ name: string; markdown: string; forbidden: RegExp[] }> = [
  {
    name: 'inline script tag',
    markdown: 'Hello <script>alert(document.cookie)</script> world',
    forbidden: [/<script/i, /alert\(/],
  },
  {
    name: 'script tag with attributes',
    markdown: '<script type="text/javascript" src="https://evil.test/x.js"></script>',
    forbidden: [/<script/i],
  },
  {
    name: 'img onerror handler',
    markdown: '<img src="https://example.test/a.png" onerror="alert(1)" alt="x">',
    forbidden: [/onerror/i, /alert\(1\)/],
  },
  {
    name: 'img handler without whitespace separator',
    markdown: '<img/src=x/onerror=alert(1)>',
    forbidden: [/<img/i],
  },
  {
    name: 'svg onload handler',
    markdown: '<svg/onload=alert(1)></svg>',
    forbidden: [/<svg/i],
  },
  {
    name: 'javascript: link',
    markdown: '[click me](javascript:alert(1))',
    forbidden: [/href="javascript:/i],
  },
  {
    name: 'encoded javascript: link',
    markdown: '[click me](java\nscript:alert(1))',
    forbidden: [/javascript:/i],
  },
  {
    name: 'data:text/html link',
    markdown: '[click me](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)',
    forbidden: [/data:text\/html/i],
  },
  {
    name: 'iframe embed',
    markdown: '<iframe src="https://evil.test"></iframe>',
    forbidden: [/<iframe/i],
  },
  {
    name: 'object/embed',
    markdown: '<object data="https://evil.test/x.swf"></object><embed src="https://evil.test/x.swf">',
    forbidden: [/<object/i, /<embed/i],
  },
  {
    name: 'form injection',
    markdown: '<form action="https://evil.test"><input name="pw" type="password"></form>',
    forbidden: [/<form/i],
  },
  {
    name: 'style tag / css expression',
    markdown: '<style>body{background:url("javascript:alert(1)")}</style>',
    forbidden: [/<style/i],
  },
  {
    name: 'meta refresh',
    markdown: '<meta http-equiv="refresh" content="0;url=https://evil.test">',
    forbidden: [/<meta/i],
  },
  {
    name: 'base tag hijack',
    markdown: '<base href="https://evil.test/">',
    forbidden: [/<base/i],
  },
  {
    name: 'mathml vector',
    markdown: '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
    forbidden: [/onerror/i, /<math/i],
  },
  {
    name: 'link rel injection',
    markdown: '<link rel="stylesheet" href="https://evil.test/x.css">',
    forbidden: [/<link/i],
  },
  {
    name: 'textarea escape hatch',
    markdown: '<textarea></textarea><script>alert(1)</script>',
    forbidden: [/<script/i, /<textarea/i],
  },
  {
    name: 'details ontoggle',
    markdown: '<details open ontoggle="alert(1)">x</details>',
    forbidden: [/ontoggle/i],
  },
];

test('XSS payloads are neutralized by the shared markdown pipeline', () => {
  for (const payload of XSS_PAYLOADS) {
    const html = renderMarkdown(payload.markdown);
    const soup = tagSoup(html);
    for (const pattern of payload.forbidden) {
      assert.ok(
        !pattern.test(soup),
        `payload "${payload.name}" leaked ${String(pattern)} into live markup:\n${soup}`
      );
    }
    // Nothing executable may survive as a real element either.
    assert.ok(!/<script/i.test(html), `payload "${payload.name}" produced a live script element`);
    assert.ok(!/\son\w+\s*=/i.test(soup), `payload "${payload.name}" produced a live event handler`);
  }
});

test('safe formatting survives sanitization', () => {
  const md = [
    '# Title',
    '',
    'A paragraph with **bold**, _italic_, `inline code`, and a [safe link](https://example.test/docs).',
    '',
    '- item one',
    '- item two',
    '',
    '1. first',
    '2. second',
    '',
    '> a quote',
    '',
    '| a | b |',
    '| - | - |',
    '| 1 | 2 |',
    '',
    '---',
  ].join('\n');

  const html = renderMarkdown(md);
  assert.match(html, /<h1[^>]*>Title<\/h1>/);
  assert.match(html, /<strong[^>]*>bold<\/strong>/);
  assert.match(html, /<em[^>]*>italic<\/em>/);
  assert.match(html, /inline code/);
  assert.match(html, /href="https:\/\/example\.test\/docs"/);
  assert.match(html, /<li[^>]*>item one<\/li>/);
  assert.match(html, /<blockquote[^>]*>/);
  assert.match(html, /<table[^>]*>/);
  assert.match(html, /<hr/);
});

test('code fences keep their exact source text and language class', () => {
  const source = [
    '```python',
    'def greet(name):',
    '    # keep this comment',
    '    return f"Hello, {name}!"',
    '```',
  ].join('\n');

  const html = renderMarkdown(source);
  assert.match(html, /language-python/);
  // The plain source must survive byte-for-byte (no regex rewriting).
  const text = renderedText(html);
  assert.ok(text.includes('def greet(name):'), `function signature preserved:\n${text}`);
  assert.ok(text.includes('    # keep this comment'), 'indentation + comment preserved');
  assert.ok(text.includes('return f"Hello, {name}!"'), 'f-string preserved');
});

test('code fence content is not executed as HTML', () => {
  const source = ['```html', '<script>alert("pwned")</script>', '```'].join('\n');
  const html = renderMarkdown(source);
  // No live script element may exist in the rendered markup.
  assert.ok(!/<script/i.test(html), 'no live script element');
  // The markup must still be present as literal text inside the code block.
  const text = renderedText(html);
  assert.ok(text.includes('<script>alert("pwned")</script>'), `literal text preserved:\n${text}`);
});

test('inline code longer than 60 chars stays inline', () => {
  const longIdentifier = 'this_is_a_very_long_identifier_that_exceeds_sixty_characters_total';
  const html = renderMarkdown(`Use \`${longIdentifier}\` here.`);
  assert.ok(html.includes(longIdentifier));
  // It must not be promoted into a block wrapper.
  assert.ok(!/<pre/.test(html), 'inline code must not become a pre block');
});

test('data: image URLs are not rendered', () => {
  const html = renderMarkdown('![x](data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=)');
  assert.ok(!/data:image/i.test(html), 'data: image must be stripped');
});

test('unknown raw HTML is unwrapped, not dropped silently with its text', () => {
  const html = renderMarkdown('<custom-widget>visible text</custom-widget>');
  assert.ok(!/<custom-widget/.test(html));
  assert.ok(html.includes('visible text'), 'text content preserved');
});

test('task lists render checkbox inputs', () => {
  const html = renderMarkdown('- [x] done\n- [ ] todo');
  assert.match(html, /type="checkbox"/);
  assert.match(html, /disabled/);
});

test('toPlainText flattens highlighted React trees without serialization artifacts', () => {
  const highlighted = React.createElement<any>(
    'code',
    { className: 'language-js' },
    React.createElement('span', { className: 'hljs-keyword' }, 'const'),
    ' ',
    React.createElement('span', { className: 'hljs-title' }, 'x'),
    ' = ',
    React.createElement('span', { className: 'hljs-number' }, '42'),
    '\n'
  );
  const plain = toPlainText(highlighted.props.children as React.ReactNode);
  assert.equal(plain, 'const x = 42\n');
  assert.ok(!plain.includes('[object Object]'));
});

test('toPlainText handles strings, numbers, nulls and nested arrays', () => {
  assert.equal(toPlainText(['a', 1, null, undefined, ['b', ['c']]]), 'a1bc');
  assert.equal(toPlainText(undefined), '');
});

test('languageFromClassName extracts fence languages', () => {
  assert.equal(languageFromClassName('language-ts'), 'ts');
  assert.equal(languageFromClassName('language-c++'), 'c++');
  assert.equal(languageFromClassName('hljs'), '');
  assert.equal(languageFromClassName(undefined), '');
});

test('sanitizer schema keeps language classes but rejects arbitrary classes', () => {
  const attrs = lessonSanitizeSchema.attributes as Record<string, unknown>;
  assert.ok(attrs.code, 'code attributes defined');
  assert.ok(attrs.span, 'span attributes defined');
  // The schema must never allow a blanket className on every element.
  const global = attrs['*'] as unknown[] | undefined;
  if (global) {
    assert.ok(!global.includes('className'), 'no global className allowance');
  }
});
