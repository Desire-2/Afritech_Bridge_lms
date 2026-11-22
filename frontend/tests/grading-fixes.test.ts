/** Pure contract tests for the grading UI fixes (no React renderer needed). */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { GRADING_PAGE_SIZE, paginateItems } from '../src/lib/grading-navigation';
import {
  DEFAULT_API_BASE_URL,
  buildModificationRequestEndpoint,
  buildResubmissionEndpoint,
  buildResubmissionPayload,
  submissionUploadFolder,
} from '../src/lib/project-submission';
import {
  deriveGradingOutcome,
  projectEvidenceForDisplay,
  type Evidence,
} from '../src/services/aage.service';

describe('submission routing contracts', () => {
  it('keeps project ids out of assignment endpoints and vice versa', () => {
    const base = 'https://api.example.test/api/v1/';
    assert.equal(
      buildModificationRequestEndpoint('assignment', 12, base),
      'https://api.example.test/api/v1/modification/assignments/12/request-modification',
    );
    assert.equal(
      buildModificationRequestEndpoint('project', 34, base),
      'https://api.example.test/api/v1/modification/projects/34/request-modification',
    );
    assert.equal(
      buildResubmissionEndpoint('assignment', 12, base),
      'https://api.example.test/api/v1/uploads/assignments/12/resubmit-with-files',
    );
    assert.equal(
      buildResubmissionEndpoint('project', 34, base),
      'https://api.example.test/api/v1/uploads/projects/34/submit-with-files',
    );
    assert.equal(buildResubmissionEndpoint('project', 7), `${DEFAULT_API_BASE_URL}/uploads/projects/7/submit-with-files`);
  });

  it('uses matching upload folders and request body fields', () => {
    assert.equal(submissionUploadFolder('assignment'), 'assignments');
    assert.equal(submissionUploadFolder('project'), 'projects');

    const assignmentBody = buildResubmissionPayload('assignment', {
      text: ' revised ',
      notes: ' feedback ',
      files: [{ url: '/f' }],
    });
    assert.equal(assignmentBody.content, 'revised');
    assert.equal(assignmentBody.resubmission_notes, 'feedback');
    assert.deepEqual(assignmentBody.files, [{ url: '/f' }]);
    assert.equal('text_content' in assignmentBody, false);

    const projectBody = buildResubmissionPayload('project', {
      text: ' revised ',
      notes: 'feedback',
      files: [{ url: '/f' }],
    });
    assert.equal(projectBody.text_content, 'revised');
    assert.deepEqual(projectBody.team_members, []);
    assert.equal('resubmission_notes' in projectBody, false);
  });
});

describe('real-list grading pagination', () => {
  it('slices the supplied items and clamps impossible pages', () => {
    const items = Array.from({ length: GRADING_PAGE_SIZE + 3 }, (_, index) => index + 1);
    const first = paginateItems(items, 1);
    const second = paginateItems(items, 2);
    const clamped = paginateItems(items, 99);

    assert.equal(first.items.length, GRADING_PAGE_SIZE);
    assert.equal(first.totalItems, items.length);
    assert.equal(first.totalPages, 2);
    assert.deepEqual(second.items, items.slice(GRADING_PAGE_SIZE));
    assert.equal(clamped.page, 2);
    assert.deepEqual(clamped.items, second.items);
    assert.equal(paginateItems([], 5).totalPages, 1);
  });
});

describe('unified grading outcome projection', () => {
  it('uses a real passing score when the payload supplies one', () => {
    const outcome = deriveGradingOutcome(
      { status: 'published', is_official: true, final_score: 82 },
      60,
    );
    assert.equal(outcome.status, 'published');
    assert.equal(outcome.isOfficial, true);
    assert.equal(outcome.passed, true);
    assert.equal(outcome.progression, 'published');
  });

  it('never invents pass/fail or progression when data is missing', () => {
    const outcome = deriveGradingOutcome({ final_score: 82 });
    // A result row without a status is not evidence of a draft publication
    // state: leave both status and progression unknown instead of guessing.
    assert.equal(outcome.status, 'unknown');
    assert.equal(outcome.progression, 'unknown');
    assert.equal(outcome.passed, null);
    assert.equal(deriveGradingOutcome(null).status, 'unknown');

    const review = deriveGradingOutcome({ status: 'pending_review', requires_review: true });
    assert.equal(review.status, 'pending_review');
    assert.equal(review.progression, 'awaiting_review');
    assert.equal(review.passed, null);
  });
});

describe('evidence display projection', () => {
  it('surfaces ids, status, fix/missing, file references and locator', () => {
    const evidence: Evidence = {
      id: 9,
      criterion_score_id: 4,
      criterion_key: 'REQ-BUDGET-01',
      category: 'VERIFIED',
      source: 'submission-workbook.xlsx',
      reference: '/uploads/projects/8/report.xlsx',
      locator: 'Sheet2!D12',
      summary: 'Budget total found',
      detail: {
        quote: 'Total: 1,250',
        missing: ['signed appendix'],
        fix: 'Attach the signed appendix',
      },
      confidence: 0.91,
    };

    const shown = projectEvidenceForDisplay(evidence);
    assert.equal(shown.requirementId, 'REQ-BUDGET-01');
    assert.equal(shown.status, 'VERIFIED');
    assert.equal(shown.summary, 'Budget total found');
    assert.ok(shown.details.some((line) => line.includes('quote: Total: 1,250')));
    assert.deepEqual(shown.missing, ['signed appendix']);
    assert.equal(shown.fix, 'Attach the signed appendix');
    assert.equal(shown.reference, '/uploads/projects/8/report.xlsx');
    assert.equal(shown.locator, 'Sheet2!D12');
    assert.equal(shown.source, 'submission-workbook.xlsx');
    assert.equal(shown.confidence, 0.91);
  });

  it('uses safe fallbacks for absent fields', () => {
    const shown = projectEvidenceForDisplay(null);
    assert.equal(shown.requirementId, null);
    assert.equal(shown.status, 'UNVERIFIED');
    assert.equal(shown.summary, 'No evidence provided');
    assert.deepEqual(shown.details, []);
    assert.deepEqual(shown.missing, []);
    assert.equal(shown.fix, null);
    assert.equal(shown.reference, null);
    assert.equal(shown.locator, null);

    const partial = projectEvidenceForDisplay({
      id: 1,
      category: '',
      summary: '   ',
      detail: {},
    });
    assert.equal(partial.status, 'UNVERIFIED');
    assert.equal(partial.summary, 'No summary provided');
    assert.equal(partial.requirementId, null);
  });
});

describe('student result delivery', () => {
  const source = readFileSync(
    new URL('../src/components/grading/StudentAageGradingResult.tsx', import.meta.url),
    'utf8',
  );

  it('polls the published result while a job is pending', () => {
    assert.match(source, /getStudentPublishedResult/);
    assert.match(source, /setInterval/);
    assert.match(source, /load\(true\)/);
  });

  it('does not tell students to wait for instructor publication', () => {
    assert.doesNotMatch(source, /reviewed and published by your instructor/i);
    assert.match(source, /appear here\s+automatically/s);
  });
});
