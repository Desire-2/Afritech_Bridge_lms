/** Contract checks for the shared grading-detail AI buttons. */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AAGE_BASE_PATH,
  buildUnifiedGradingStartUrl,
  buildUnifiedGradingStatusUrl,
  isSpreadsheetSpecialist,
  publishedAageResult,
} from '../src/services/aage.service';

describe('unified grading detail endpoints', () => {
  it('uses the existing AAGE /api/v1 surface', () => {
    assert.equal(AAGE_BASE_PATH, '/aage');
    assert.equal(buildUnifiedGradingStartUrl(), '/aage/grading/unified/start');
  });

  it('builds a submission-scoped status URL', () => {
    assert.equal(
      buildUnifiedGradingStatusUrl('assignment', 42),
      '/aage/grading/unified/status/assignment/42'
    );
    assert.equal(
      buildUnifiedGradingStatusUrl('project', 7),
      '/aage/grading/unified/status/project/7'
    );
  });
});

describe('unified grading payload contract', () => {
  it('treats spreadsheet as an AAGE specialist hint, not an engine', () => {
    assert.equal(isSpreadsheetSpecialist({ specialist: 'spreadsheet', selected_engine: 'aage' }), true);
    assert.equal(isSpreadsheetSpecialist({ specialist: 'spreadsheet', selected_engine: 'excel' }), true);
    assert.equal(isSpreadsheetSpecialist({ specialist: 'code', selected_engine: 'aage' }), false);
    assert.equal(isSpreadsheetSpecialist({ selected_engine: 'aage' }), false);
    assert.equal(isSpreadsheetSpecialist(null), false);
  });

  it('prefers the official result over a newer re-grade draft', () => {
    const draft = { id: 9, status: 'draft', final_score: 55 };
    const official = { id: 4, status: 'published', final_score: 82, is_official: true };
    const status = {
      submission_type: 'assignment' as const,
      submission_id: 1,
      selected_engine: 'aage' as const,
      specialist: 'spreadsheet' as const,
      aage_result: draft,
      official_aage_result: official,
    };

    assert.deepEqual(publishedAageResult(status), official);
    assert.deepEqual(publishedAageResult({ ...status, official_aage_result: null }), draft);
    assert.deepEqual(publishedAageResult({ ...status, aage_result: null }), official);
    assert.equal(publishedAageResult(null), null);
  });
});
