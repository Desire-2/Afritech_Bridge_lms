/**
 * Content-type migration tests (instructor "change content type" flow).
 *
 * Run with: npm run test:content
 * (node's built-in test runner via tsx — no extra test framework needed)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  textToMixedContentData,
  mixedContentToText,
  firstMediaUrl,
  contentDataToBuilderItems,
  lessonSectionCount,
} from '../lesson-content';

const md = [
  '# Lesson One',
  '',
  'Intro paragraph.',
  '',
  '## Getting started',
  '',
  'Body one.',
  '',
  '## Going further',
  '',
  'Body two.',
].join('\n');

const mdWithMedia = [
  '## Watch first',
  '',
  'Watch the clip below:',
  '',
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  '',
  '## Handout',
  '',
  'Read the pdf:',
  '',
  'https://example.com/notes.pdf',
  '',
  '## Screenshot',
  '',
  '![A diagram](https://example.com/diagram.png)',
].join('\n');

const itemShape = (items: { type: string; content: string }[]) =>
  items.map((item) => ({ type: item.type, content: item.content }));

describe('textToMixedContentData', () => {
  it('analyses headers into one section per header', () => {
    const mixed = textToMixedContentData(md);
    const parsed = JSON.parse(mixed);
    assert.ok(Array.isArray(parsed), 'canonical storage must be a JSON array');
    assert.equal(lessonSectionCount(mixed, 'mixed'), 3);

    const headings = contentDataToBuilderItems(mixed)
      .filter((item) => item.type === 'heading')
      .map((item) => item.content);
    assert.deepEqual(headings, ['Getting started', 'Going further']);
  });

  it('promotes standalone video, pdf and image lines into media sections', () => {
    const items = contentDataToBuilderItems(textToMixedContentData(mdWithMedia));
    const types = items.map((item) => item.type);
    assert.ok(types.includes('video'), `expected video in ${JSON.stringify(types)}`);
    assert.ok(types.includes('pdf'), `expected pdf in ${JSON.stringify(types)}`);
    assert.ok(types.includes('image'), `expected image in ${JSON.stringify(types)}`);

    const video = items.find((item) => item.type === 'video');
    assert.equal(video?.content, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  it('keeps prose around a media line as its own text section', () => {
    const items = contentDataToBuilderItems(textToMixedContentData(mdWithMedia));
    const watchIdx = items.findIndex((item) => item.type === 'heading');
    assert.equal(items[watchIdx].content, 'Watch first');
    assert.equal(items[watchIdx + 1].type, 'text');
    assert.equal(items[watchIdx + 1].content, 'Watch the clip below:');
    assert.equal(items[watchIdx + 2].type, 'video');
  });

  it('returns empty for empty input', () => {
    assert.equal(textToMixedContentData(''), '');
    assert.equal(textToMixedContentData('   \n  '), '');
  });
});

describe('mixedContentToText', () => {
  it('flattens into markdown, never raw JSON', () => {
    const text = mixedContentToText(textToMixedContentData(md));
    assert.ok(text.trimStart().startsWith('#'), 'flattened text must start as markdown');
    assert.ok(text.includes('## Getting started'));
    assert.ok(text.includes('Body two.'));
    assert.throws(() => JSON.parse(text), 'flattened text must not parse as JSON');
  });

  it('emits media as standalone lines so switching back re-promotes them', () => {
    const text = mixedContentToText(textToMixedContentData(mdWithMedia));
    assert.ok(text.includes('https://www.youtube.com/watch?v=dQw4w9WgXcQ'));
    assert.ok(text.includes('![A diagram](https://example.com/diagram.png)'));
    assert.ok(text.includes('## Handout'));

    const types = contentDataToBuilderItems(textToMixedContentData(text)).map((i) => i.type);
    assert.ok(types.includes('video') && types.includes('pdf') && types.includes('image'));
  });

  it('round-trips builder items through text -> mixed -> text -> mixed', () => {
    const first = contentDataToBuilderItems(textToMixedContentData(mdWithMedia));
    const again = contentDataToBuilderItems(
      textToMixedContentData(mixedContentToText(textToMixedContentData(mdWithMedia)))
    );
    assert.deepEqual(itemShape(again), itemShape(first));
  });
});

describe('firstMediaUrl', () => {
  it('finds media in canonical mixed storage', () => {
    const mixed = textToMixedContentData(mdWithMedia);
    assert.equal(firstMediaUrl(mixed, 'video'), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    assert.equal(firstMediaUrl(mixed, 'pdf'), 'https://example.com/notes.pdf');
  });

  it('finds a standalone media line in markdown text', () => {
    assert.equal(firstMediaUrl('See below:\n\nhttps://example.com/handout.pdf', 'pdf'), 'https://example.com/handout.pdf');
    assert.equal(firstMediaUrl('https://youtu.be/abc123', 'video'), 'https://youtu.be/abc123');
  });

  it('returns empty when there is nothing to carry over', () => {
    assert.equal(firstMediaUrl('', 'video'), '');
    assert.equal(firstMediaUrl('no links in this lesson', 'video'), '');
    assert.equal(firstMediaUrl('https://example.com/notes.pdf', 'video'), '');
  });
});
