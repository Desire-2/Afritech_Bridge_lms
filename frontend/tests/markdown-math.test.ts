import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import {
  lessonRemarkPlugins,
  lessonRehypePlugins,
  lessonUrlTransform,
} from '../src/lib/markdown';

/**
 * Renders markdown through the exact plugin configuration used by the
 * learning player and the shared MarkdownRenderer. These assertions pin two
 * properties of the math pipeline: cued `$…$`/`$$…$$` renders as KaTeX, and
 * non-TeX dollars (Excel absolute refs, currency) stay literal text.
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

/** Only real markup (tags + attributes); escaped text is inert. */
function tagSoup(html: string): string {
  return (html.match(/<[^>]*>/g) || []).join(' ');
}

/** Strip tags so literal dollar text can be compared to the source. */
function renderedText(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

test('own-line $$ block renders as KaTeX display mode', () => {
  const html = renderMarkdown('Intro\n\n$$\nE = mc^2\n$$\n\nOutro');
  assert.ok(html.includes('katex-display'), 'display wrapper present');
  assert.ok(html.includes('class="katex"'), 'KaTeX markup present');
  assert.ok(html.includes('katex-mathml'), 'KaTeX MathML output present');
  assert.ok(!html.includes('$$'), 'block delimiters consumed');
});

test('single-line $$ … $$ renders as math', () => {
  const html = renderMarkdown('Formula: $$ P(X = k) = \\binom{n}{k} p^k $$');
  assert.ok(html.includes('class="katex"'), 'KaTeX rendered');
});

test('fenced ```math block renders in display mode', () => {
  const html = renderMarkdown('```math\nE = mc^2\n```');
  assert.ok(html.includes('katex-display'), 'fence maps to display mode');
});

test('cued inline $…$ renders as KaTeX', () => {
  const html = renderMarkdown('Null hypothesis ($H_0$) with $\\alpha = 0.05$');
  assert.ok(html.includes('class="katex"'), 'KaTeX rendered');
  assert.ok(!html.includes('$H_0$'), 'dollar delimiters consumed');
  assert.ok(!html.includes('$\\alpha'), 'dollar delimiters consumed');
});

test('Excel absolute references stay literal dollars', () => {
  for (const markdown of [
    'Keep $A$1 (stays fixed)',
    'Range $A$1:$A$5 selected',
    'Both $B$2 and $C$3',
  ]) {
    const html = renderMarkdown(markdown);
    assert.ok(!html.includes('class="katex"'), `no math for: ${markdown}`);
    assert.ok(renderedText(html).includes(markdown), `literal kept: ${markdown}`);
  }
});

test('currency dollars stay literal', () => {
  const html = renderMarkdown('It costs $5 or $10 total');
  assert.ok(!html.includes('class="katex"'), 'currency is not math');
  assert.ok(html.includes('$5 or $10'), 'literal currency preserved');
});

test('literal and math dollars coexist in one paragraph', () => {
  const html = renderMarkdown('Copy $A$1 into cell, then compare with $H_0$');
  assert.ok(html.includes('$A$1'), 'Excel reference literal');
  assert.ok(html.includes('class="katex"'), 'math rendered');
  assert.ok(!html.includes('$H_0$'), 'math delimiters consumed');
});

test('cue-free single dollars stay literal by design', () => {
  const html = renderMarkdown('Membership costs $5 per month');
  assert.ok(!html.includes('class="katex"'), 'no cue, no math');
  assert.ok(html.includes('$5 per month'), 'literal preserved');
});

test('dollars inside code are untouched', () => {
  const inline = renderMarkdown('Use `$H_0$` for the null hypothesis');
  assert.ok(!inline.includes('class="katex"'), 'inline code skipped');
  assert.ok(inline.includes('$H_0$'), 'inline code literal');

  const fence = renderMarkdown('```bash\necho $PATH and $HOME\n```');
  assert.ok(!fence.includes('class="katex"'), 'fenced code skipped');
  assert.ok(fence.includes('$PATH'), 'fenced code literal');
});

test('author HTML inside math cannot inject elements', () => {
  const html = renderMarkdown('$$ <img src=x onerror=alert(1)> $$');
  assert.ok(!/<img/i.test(tagSoup(html)), 'no img element survives');
  assert.ok(!/onerror/i.test(tagSoup(html)), 'no onerror attribute survives');
});

test('KaTeX output survives the sanitizer; author spoofing does not', () => {
  const math = renderMarkdown('$$ x^2 + y^2 $$');
  assert.ok(/class="katex/.test(math), 'katex ran after sanitize (order)');

  const spoof = renderMarkdown('<span class="katex">fake</span>');
  assert.ok(!spoof.includes('class="katex"'), 'author classes stripped');
});

test('invalid LaTeX fails soft instead of throwing', () => {
  const html = renderMarkdown('$$ \\notarealcommand $$');
  assert.ok(html.includes('class="katex"'), 'error is rendered, not thrown');
});
