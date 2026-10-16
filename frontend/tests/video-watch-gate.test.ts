import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { videoWatchGate } from '../src/app/(learn)/learn/[id]/utils/learningRules';
import { VIDEO_WATCH_COMPLETE_THRESHOLD } from '../src/constants/learningRules';

// Legacy flat mixed content: video coverage indices 1 and 3 (mirrors the
// backend fixture in backend/tests/test_mixed_video_progress.py).
const MIXED_TWO_VIDEOS = JSON.stringify([
  { type: 'text', content: 'intro' },
  { type: 'video', url: 'https://www.youtube.com/watch?v=aaa' },
  { type: 'text', content: 'middle' },
  { type: 'video', url: 'https://www.youtube.com/watch?v=bbb' },
]);

const MIXED_NO_VIDEO = JSON.stringify([
  { type: 'text', content: 'just prose' },
  { type: 'text', content: 'more prose' },
]);

describe('videoWatchGate', () => {
  test('threshold mirrors the canonical 90% constant', () => {
    assert.equal(VIDEO_WATCH_COMPLETE_THRESHOLD, 90);
  });

  test('main video lesson starts gated with zero coverage', () => {
    const gate = videoWatchGate({
      contentType: 'video',
      contentData: 'https://www.youtube.com/watch?v=abc',
      videoProgress: 0,
      videoCompleted: false,
    });
    assert.equal(gate.hasVideoContent, true);
    assert.equal(gate.hasUnwatchedVideo, true);
    assert.equal(gate.videoWatchRatio, 0);
    assert.equal(gate.videoCoverage, null);
  });

  test('main video lesson passes exactly at the 90% threshold', () => {
    const under = videoWatchGate({
      contentType: 'video',
      videoProgress: 89.9,
      videoCompleted: false,
    });
    assert.equal(under.hasUnwatchedVideo, true);

    const at = videoWatchGate({
      contentType: 'video',
      videoProgress: 90,
      videoCompleted: false,
    });
    assert.equal(at.hasUnwatchedVideo, false);
    assert.equal(at.videoWatchRatio, 0.9);
  });

  test('backend-derived video_completed flag also opens the gate', () => {
    const gate = videoWatchGate({
      contentType: 'video',
      videoProgress: 0,
      videoCompleted: true,
    });
    assert.equal(gate.hasUnwatchedVideo, false);
  });

  test('mixed lesson stays gated while any video is unwatched', () => {
    const gate = videoWatchGate({
      contentType: 'mixed',
      contentData: MIXED_TWO_VIDEOS,
      videoProgress: 100,
      videoCompleted: false,
      mixedVideoProgress: { 1: 100, 3: 40 },
    });
    assert.equal(gate.hasVideoContent, true);
    assert.equal(gate.hasUnwatchedVideo, true);
    // Honest ratio: average across BOTH videos, not the max.
    assert.equal(gate.videoWatchRatio, 0.7);
    assert.deepEqual(gate.videoCoverage, [1, 3]);
  });

  test('mixed lesson passes only when every video reaches the threshold', () => {
    const gate = videoWatchGate({
      contentType: 'mixed',
      contentData: MIXED_TWO_VIDEOS,
      videoProgress: 100,
      videoCompleted: true,
      mixedVideoProgress: { 1: 100, 3: 90 },
    });
    assert.equal(gate.hasUnwatchedVideo, false);
    assert.ok(Math.abs(gate.videoWatchRatio - 0.95) < 1e-9);
  });

  test('mixed lesson with a missing coverage entry counts that video as unwatched', () => {
    const gate = videoWatchGate({
      contentType: 'mixed',
      contentData: MIXED_TWO_VIDEOS,
      videoProgress: 100,
      videoCompleted: true, // stale flag must not override missing coverage
      mixedVideoProgress: { 1: 100 },
    });
    assert.equal(gate.hasUnwatchedVideo, true);
  });

  test('mixed lesson with an empty progress map is fully gated', () => {
    const gate = videoWatchGate({
      contentType: 'mixed',
      contentData: MIXED_TWO_VIDEOS,
      videoProgress: 0,
      videoCompleted: false,
    });
    assert.equal(gate.hasUnwatchedVideo, true);
    assert.equal(gate.videoWatchRatio, 0);
  });

  test('mixed lesson without any video blocks never gates completion', () => {
    const gate = videoWatchGate({
      contentType: 'mixed',
      contentData: MIXED_NO_VIDEO,
      videoProgress: 0,
      videoCompleted: false,
    });
    assert.equal(gate.hasVideoContent, false);
    assert.equal(gate.hasUnwatchedVideo, false);
  });

  test('plain text lesson has no video requirement', () => {
    const gate = videoWatchGate({
      contentType: 'text',
      contentData: '# Just markdown\n\nNo media here.',
      videoProgress: 0,
      videoCompleted: false,
    });
    assert.equal(gate.hasVideoContent, false);
    assert.equal(gate.hasUnwatchedVideo, false);
  });

  test('unknown content types fall back to shared telemetry', () => {
    const noTelemetry = videoWatchGate({
      contentType: 'pdf',
      videoProgress: 0,
      videoCompleted: false,
    });
    assert.equal(noTelemetry.hasVideoContent, false);

    const withTelemetry = videoWatchGate({
      contentType: 'pdf',
      videoProgress: 50,
      videoCompleted: false,
    });
    assert.equal(withTelemetry.hasVideoContent, true);
    assert.equal(withTelemetry.hasUnwatchedVideo, true);
  });

  test('garbage telemetry values are clamped', () => {
    const gate = videoWatchGate({
      contentType: 'video',
      videoProgress: Number.NaN,
      videoCompleted: false,
    });
    assert.equal(gate.videoWatchRatio, 0);
    assert.equal(gate.hasUnwatchedVideo, true);
  });
});
