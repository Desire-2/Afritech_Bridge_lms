/**
 * Regression tests for unique video-coverage tracking.
 *
 * Run with: npm run test:video
 * (node's built-in test runner via tsx — no extra test framework needed)
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { VideoCoverageTracker } from "../videoCoverage";

const DURATION = 100; // seconds, easy mental math

describe("VideoCoverageTracker", () => {
  it("starts at zero for a fresh video", () => {
    const t = new VideoCoverageTracker();
    t.setDuration(DURATION);
    assert.equal(t.coveragePct, 0);
  });

  it("raiseBase floors coverage at the persisted snapshot without clearing live buckets", () => {
    const t = new VideoCoverageTracker({ seekThresholdSec: 5 });
    t.setDuration(DURATION);
    for (let s = 0; s <= 10; s += 2) t.observe(s); // ~10% live coverage
    const live = t.coveragePct;
    assert.ok(live >= 8 && live <= 12, `live coverage ${live}`);

    // Backend snapshot (45%) resolves AFTER live watching started.
    t.raiseBase(45);
    assert.equal(t.coveragePct, 45, "floor must lift display to persisted snapshot");

    // Continued playback still accrues on top of the floor.
    for (let s = 10; s <= 60; s += 2) t.observe(s);
    assert.ok(t.coveragePct >= 45, "coverage must never fall below the floor");
    assert.ok(t.coveragePct > 45, "live watching past the floor must still count");

    // raiseBase never lowers.
    t.raiseBase(10);
    assert.ok(t.coveragePct >= 45, "raiseBase(10) must not lower a higher floor");
  });

  it("credits continuous forward playback", () => {
    const t = new VideoCoverageTracker({ seekThresholdSec: 5 });
    t.setDuration(DURATION);
    for (let s = 0; s <= 50; s += 2) t.observe(s);
    assert.ok(t.coveragePct >= 48 && t.coveragePct <= 52, `got ${t.coveragePct}`);
  });

  it("does NOT credit a seek to the end", () => {
    const t = new VideoCoverageTracker({ seekThresholdSec: 5 });
    t.setDuration(DURATION);
    t.observe(0);
    t.observe(1); // tiny lead-in
    t.observe(99); // big seek — must not count the gap
    const coverage = t.coveragePct;
    assert.ok(coverage < 10, `seek-to-end fabricated ${coverage}% coverage`);
    assert.equal(t.positionSec, 99, "resume position still tracks the seek");
  });

  it("does not double-count rewatched segments", () => {
    const t = new VideoCoverageTracker({ seekThresholdSec: 5 });
    t.setDuration(DURATION);
    for (let pass = 0; pass < 3; pass++) {
      for (let s = 0; s <= 20; s += 2) t.observe(s);
      t.observe(0); // rewind (jump back)
    }
    assert.ok(t.coveragePct <= 25, `rewatch inflated coverage to ${t.coveragePct}%`);
  });

  it("coverage never decreases (monotonic)", () => {
    const t = new VideoCoverageTracker({ seekThresholdSec: 5 });
    t.setDuration(DURATION);
    for (let s = 0; s <= 40; s += 2) t.observe(s);
    const high = t.coveragePct;
    t.observe(2); // rewind
    t.observe(500); // absurd forward jump beyond duration
    assert.ok(t.coveragePct >= high, "coverage regressed");
  });

  it("floors coverage at the restored base (persisted progress)", () => {
    const t = new VideoCoverageTracker({ baseCoveragePct: 80 });
    t.setDuration(DURATION);
    assert.equal(t.coveragePct, 80);
    t.observe(10);
    t.observe(12);
    assert.ok(t.coveragePct >= 80, "live coverage dipped below restored base");
  });

  it("restored base alone does not fabricate position-based credit after seeks", () => {
    // Simulates: student watched 10%, seeked to 90%, closed. Server stored
    // coverage=10, position=90. On restore, coverage must stay ~10.
    const t = new VideoCoverageTracker({ baseCoveragePct: 10 });
    t.setDuration(DURATION);
    t.observe(90); // restored position applied as a seek
    assert.ok(t.coveragePct <= 12, `restore seek inflated coverage to ${t.coveragePct}%`);
  });

  it("marks complete at the configured threshold only", () => {
    const t = new VideoCoverageTracker({ seekThresholdSec: 5 });
    t.setDuration(DURATION);
    t.observe(0);
    assert.equal(t.isComplete(90), false);
    for (let s = 0; s <= 92; s += 2) t.observe(s);
    assert.equal(t.isComplete(90), true);
  });

  it("ignores invalid observations (NaN, negative)", () => {
    const t = new VideoCoverageTracker({ seekThresholdSec: 5 });
    t.setDuration(DURATION);
    t.observe(Number.NaN);
    t.observe(-5);
    t.observe(Number.POSITIVE_INFINITY);
    assert.equal(t.coveragePct, 0);
    assert.equal(t.positionSec, 0);
  });

  it("handles unknown duration without fabricating coverage", () => {
    const t = new VideoCoverageTracker();
    t.observe(10);
    t.observe(12);
    assert.equal(t.coveragePct, 0, "coverage must wait for a real duration");
    t.setDuration(0); // invalid duration ignored
    t.setDuration(-1);
    assert.equal(t.getDuration(), 0);
  });

  it("handles playback-rate-like small gaps as continuous watching", () => {
    // 2x playback still advances ~4s of video per 2s wall clock in the
    // timeupdate stream; deltas up to the seek threshold count.
    const t = new VideoCoverageTracker({ seekThresholdSec: 5 });
    t.setDuration(DURATION);
    t.observe(0);
    t.observe(4);
    t.observe(8);
    assert.ok(t.coveragePct >= 7, `got ${t.coveragePct}`);
  });
});
