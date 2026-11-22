/**
 * Pure AAGE UI adapter tests.
 *
 * React Testing Library is not installed in this repo, so browser rendering is
 * not automated here. Instead, the unit contracts that prevent the original
 * findings — role gating, percentage scales and payload whitelisting — live in
 * dependency-free modules and are covered with node:test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCalibrationMetric,
  formatDuration,
  formatPercent,
} from '../src/components/aage/format';
import { projectReportRow } from '../src/components/aage/reports';
import {
  canAccessInstructorAage,
  canAdministerAage,
  canViewAllCourses,
  isAdminRole,
  isInstructorRole,
} from '../src/components/aage/roles';

test('role helpers allow instructors/admins but never students', () => {
  assert.equal(isInstructorRole('Instructor'), true);
  assert.equal(canAccessInstructorAage('instructor'), true);
  assert.equal(canAccessInstructorAage('admin'), true);
  assert.equal(canAccessInstructorAage('superadmin'), true);
  assert.equal(canAccessInstructorAage('student'), false);
  assert.equal(canAccessInstructorAage(null), false);
});

test('all-course and admin-only helpers exclude instructors', () => {
  assert.equal(isAdminRole('admin'), true);
  assert.equal(isAdminRole('superadmin'), true);
  assert.equal(isAdminRole('instructor'), false);
  assert.equal(canViewAllCourses('instructor'), false);
  assert.equal(canViewAllCourses('admin'), true);
  assert.equal(canAdministerAage('instructor'), false);
  assert.equal(canAdministerAage('superadmin'), true);
});

test('formatPercent treats service values as already-0-100 percentages', () => {
  assert.equal(formatPercent(92.36), '92.4%');
  assert.equal(formatPercent(25, 0), '25%');
  assert.equal(formatPercent(null), '—');
});

test('formatDuration reads backend milliseconds', () => {
  assert.equal(formatDuration(450.5), '0.5s');
  assert.equal(formatDuration(90_000), '1m 30s');
  assert.equal(formatDuration(undefined), '—');
});

test('formatCalibrationMetric formats service-normalized values once', () => {
  assert.equal(formatCalibrationMetric('criterion_agreement', 92), '92.0%');
  assert.equal(formatCalibrationMetric('override_rate', 10), '10.0%');
  assert.equal(formatCalibrationMetric('case_count', 18), '18');
  assert.equal(formatCalibrationMetric('mae', 3.456), '3.5%');
});

test('projectReportRow whitelists instructor report fields', () => {
  const row = projectReportRow({
    id: 4,
    submission_id: 42,
    submission_type: 'assignment',
    status: 'published',
    is_official: true,
    final_score: 77.5,
    created_at: '2026-01-01T00:00:00Z',
    confidence: 88,
    feedback: 'instructor only',
    rationale: 'evaluator only',
    evidence: [{ id: 1 }],
  });
  assert.ok(row);
  assert.equal(row.final_score, 77.5);
  assert.deepEqual(Object.keys(row).sort(), [
    'created_at', 'final_score', 'id', 'is_official',
    'status', 'submission_id', 'submission_type',
  ]);
});

test('projectReportRow does not expose unpublished scores', () => {
  const row = projectReportRow({
    id: 5,
    submission_id: 42,
    submission_type: 'project',
    status: 'draft',
    final_score: 55,
  });
  assert.ok(row);
  assert.equal(row.is_official, false);
  assert.equal(row.final_score, null);
  assert.equal(projectReportRow({ id: 6 }), null);
});
