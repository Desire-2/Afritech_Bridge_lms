/**
 * The three grading screens must stay reachable from one sidebar entry while
 * keeping every existing route and feature intact.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  GRADING_ROUTE_PREFIXES,
  GRADING_TABS,
  PRIMARY_GRADING_HREF,
  gradingTabForPath,
  isGradingRoute,
} from '../src/lib/grading-navigation';

describe('unified grading navigation', () => {
  it('keeps all three historical screens', () => {
    assert.deepEqual(
      GRADING_TABS.map((tab) => tab.href),
      [
        '/instructor/grading',
        '/instructor/ai-grading-dashboard',
        '/instructor/assessment-intelligence',
      ]
    );
    assert.deepEqual(
      GRADING_TABS.map((tab) => tab.key),
      ['submissions', 'excel', 'assessment']
    );
    assert.equal(PRIMARY_GRADING_HREF, '/instructor/grading');
  });

  it('treats every grading route as part of one workspace', () => {
    for (const href of GRADING_ROUTE_PREFIXES) {
      assert.equal(isGradingRoute(href), true, href);
      assert.equal(isGradingRoute(`${href}/child`), true, href);
    }
    assert.equal(isGradingRoute('/instructor/grading/assignment/11'), true);
    assert.equal(isGradingRoute('/instructor/grading/project/4'), true);
    assert.equal(isGradingRoute('/instructor/courses'), false);
    assert.equal(isGradingRoute('/instructor/assessment-intelligence-extra'), false);
    assert.equal(isGradingRoute(null), false);
  });

  it('maps detail routes back to the submissions tab', () => {
    assert.equal(gradingTabForPath('/instructor/grading/assignment/11'), 'submissions');
    assert.equal(gradingTabForPath('/instructor/grading/project/4'), 'submissions');
    assert.equal(gradingTabForPath('/instructor/ai-grading-dashboard'), 'excel');
    assert.equal(gradingTabForPath('/instructor/assessment-intelligence'), 'assessment');
    assert.equal(gradingTabForPath('/instructor/students'), null);
  });
});
