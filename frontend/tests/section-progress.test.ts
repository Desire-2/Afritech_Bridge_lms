import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  MIN_SECTION_VIEW_MS,
  allSectionsViewed,
  dwellRemainingMs,
  dwellViewed,
  initialSectionViewState,
  mergeViewedCount,
  sectionCounts,
  sectionProgressPercent,
  stateMatchesSections,
  withActiveSection,
  withActiveViewed,
  withViewedSection,
} from '../src/lib/section-progress';

const IDS = ['sec_intro', 'sec_syntax', 'sec_takeaways'];

describe('initial state', () => {
  test('a fresh lesson starts with nothing viewed', () => {
    const state = initialSectionViewState(IDS);
    assert.deepEqual(state.sectionIds, IDS);
    assert.equal(state.activeIndex, 0);
    assert.deepEqual(state.viewedIds, []);
    assert.deepEqual(sectionCounts(state), { viewed: 0, total: 3 });
  });

  test('opening a lesson never reports 100% instantly', () => {
    const state = initialSectionViewState(IDS);
    assert.equal(sectionProgressPercent(state), 0);
    assert.equal(allSectionsViewed(state), false);
  });

  test('empty content can never report completion', () => {
    const state = initialSectionViewState([]);
    assert.equal(sectionProgressPercent(state), 0);
    assert.equal(allSectionsViewed(state), false);
  });

  test('initial state copies the id list', () => {
    const ids = [...IDS];
    const state = initialSectionViewState(ids);
    ids.push('mutated');
    assert.equal(state.sectionIds.length, 3);
  });
});

describe('dwell requirement', () => {
  test('a section is not viewed before the minimum dwell elapses', () => {
    assert.equal(dwellViewed(0), false);
    assert.equal(dwellViewed(MIN_SECTION_VIEW_MS - 1), false);
  });

  test('a section is viewed once the minimum dwell elapses', () => {
    assert.equal(dwellViewed(MIN_SECTION_VIEW_MS), true);
    assert.equal(dwellViewed(MIN_SECTION_VIEW_MS + 1), true);
  });

  test('nonsense elapsed values never count as viewed', () => {
    assert.equal(dwellViewed(Number.NaN), false);
    assert.equal(dwellViewed(-5), false);
    assert.equal(dwellViewed(Number.POSITIVE_INFINITY), false);
  });

  test('dwellRemainingMs reports how much longer to wait', () => {
    assert.equal(dwellRemainingMs(0), MIN_SECTION_VIEW_MS);
    assert.equal(dwellRemainingMs(500), MIN_SECTION_VIEW_MS - 500);
    assert.equal(dwellRemainingMs(MIN_SECTION_VIEW_MS + 100), 0);
    assert.equal(dwellRemainingMs(-1), MIN_SECTION_VIEW_MS);
  });

  test('skipping through steps with the arrow keys never marks them viewed', () => {
    // Simulate the player: only call withActiveViewed once dwellViewed is true.
    let state = initialSectionViewState(IDS);
    for (let i = 0; i < IDS.length; i += 1) {
      state = withActiveSection(state, i);
      const elapsedWhileReading = 50; // fast forward/back navigation
      if (dwellViewed(elapsedWhileReading)) state = withActiveViewed(state);
    }
    assert.deepEqual(state.viewedIds, []);
    assert.equal(sectionProgressPercent(state), 0);
  });

  test('reading each section for the required dwell reaches 100%', () => {
    let state = initialSectionViewState(IDS);
    for (let i = 0; i < IDS.length; i += 1) {
      state = withActiveSection(state, i);
      if (dwellViewed(MIN_SECTION_VIEW_MS)) state = withActiveViewed(state);
    }
    assert.equal(sectionProgressPercent(state), 100);
    assert.equal(allSectionsViewed(state), true);
  });
});

describe('viewed state', () => {
  test('withActiveViewed marks the active section', () => {
    let state = initialSectionViewState(IDS);
    state = withActiveSection(state, 1);
    state = withActiveViewed(state);
    assert.deepEqual(state.viewedIds, ['sec_syntax']);
  });

  test('marking is idempotent', () => {
    let state = initialSectionViewState(IDS);
    state = withActiveViewed(state);
    const again = withActiveViewed(state);
    assert.equal(again, state);
    assert.deepEqual(state.viewedIds, ['sec_intro']);
  });

  test('unknown section ids are ignored', () => {
    const state = withViewedSection(initialSectionViewState(IDS), 'sec_ghost');
    assert.deepEqual(state.viewedIds, []);
  });

  test('active index is clamped to a real section', () => {
    const state = initialSectionViewState(IDS);
    assert.equal(withActiveSection(state, 99).activeIndex, 2);
    assert.equal(withActiveSection(state, -3).activeIndex, 0);
  });

  test('clamping to the current index returns the same object', () => {
    const state = initialSectionViewState(IDS);
    assert.equal(withActiveSection(state, 0), state);
  });

  test('viewed count only counts ids still present', () => {
    let state = initialSectionViewState(IDS);
    state = withActiveViewed(state);
    const stale = { ...state, viewedIds: ['sec_intro', 'sec_removed'] };
    assert.deepEqual(sectionCounts(stale), { viewed: 1, total: 3 });
    assert.ok(Math.abs(sectionProgressPercent(stale) - 100 / 3) < 1e-9);
  });

  test('progress is partial until every section is viewed', () => {
    let state = initialSectionViewState(IDS);
    state = withActiveViewed(state);
    state = withActiveViewed(withActiveSection(state, 1));
    assert.ok(Math.abs(sectionProgressPercent(state) - (200 / 3)) < 1e-9);
    assert.equal(allSectionsViewed(state), false);
    state = withActiveViewed(withActiveSection(state, 2));
    assert.equal(allSectionsViewed(state), true);
  });
});

describe('state identity across content changes', () => {
  test('saved state matches the same section ids', () => {
    const state = initialSectionViewState(IDS);
    assert.equal(stateMatchesSections(state, IDS), true);
  });

  test('a content edit that changed ids invalidates saved state', () => {
    const state = initialSectionViewState(IDS);
    assert.equal(stateMatchesSections(state, ['sec_intro', 'sec_edited', 'sec_takeaways']), false);
  });

  test('reordering sections invalidates saved state', () => {
    const state = initialSectionViewState(IDS);
    assert.equal(stateMatchesSections(state, [...IDS].reverse()), false);
  });

  test('missing or empty saved state never matches', () => {
    assert.equal(stateMatchesSections(null, IDS), false);
    assert.equal(stateMatchesSections(undefined, IDS), false);
    assert.equal(stateMatchesSections(initialSectionViewState([]), IDS), false);
  });
});

describe('mergeViewedCount', () => {
  test('progress never moves backwards', () => {
    assert.equal(mergeViewedCount(3, 1, 10), 3);
    assert.equal(mergeViewedCount(3, 3, 10), 3);
    assert.equal(mergeViewedCount(2, 5, 10), 5);
  });

  test('reports are clamped to the total', () => {
    assert.equal(mergeViewedCount(0, 99, 4), 4);
    assert.equal(mergeViewedCount(0, -1, 4), 0);
    assert.equal(mergeViewedCount(0, Number.NaN, 4), 0);
  });

  test('a previous value of NaN is treated as zero', () => {
    assert.equal(mergeViewedCount(Number.NaN, 2, 4), 2);
  });

  test('fractional reports floor', () => {
    assert.equal(mergeViewedCount(0, 2.9, 4), 2);
  });
});
