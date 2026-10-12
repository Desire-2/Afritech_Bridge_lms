import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  LESSON_PASSING_THRESHOLD,
  LESSON_READING_PROGRESS_THRESHOLD,
  LESSON_ENGAGEMENT_THRESHOLD,
  MODULE_PASSING_THRESHOLD,
  DEFAULT_QUIZ_PASSING_THRESHOLD,
  ASSIGNMENT_PASSING_THRESHOLD,
  CERTIFICATE_PASSING_THRESHOLD,
  VIDEO_WATCH_COMPLETE_THRESHOLD,
  describeCertificateRequirement,
} from '../src/constants/learningRules';

test('thresholds match the canonical backend scoring constants', () => {
  assert.equal(LESSON_PASSING_THRESHOLD, 80);
  assert.equal(LESSON_READING_PROGRESS_THRESHOLD, 90);
  assert.equal(LESSON_ENGAGEMENT_THRESHOLD, 60);
  assert.equal(MODULE_PASSING_THRESHOLD, 70);
  assert.equal(DEFAULT_QUIZ_PASSING_THRESHOLD, 70);
  assert.equal(ASSIGNMENT_PASSING_THRESHOLD, 60);
  assert.equal(CERTIFICATE_PASSING_THRESHOLD, 70);
  assert.equal(VIDEO_WATCH_COMPLETE_THRESHOLD, 90);
});

test('describeCertificateRequirement explains every backend eligibility code', () => {
  assert.equal(
    describeCertificateRequirement('overall_score'),
    'Overall score below 70%'
  );
  assert.equal(
    describeCertificateRequirement('final_assessment'),
    'Final assessment not passed (at least 70% required)'
  );
  assert.equal(
    describeCertificateRequirement('all_modules_completed'),
    'Not all modules are complete'
  );
  assert.equal(
    describeCertificateRequirement('all_lessons_completed'),
    'Not all lessons are completed'
  );
  assert.equal(describeCertificateRequirement('enrollment'), 'Not enrolled in this course');
  assert.equal(describeCertificateRequirement('course'), 'Course not found');
});

test('describeCertificateRequirement honours the course-specific required score', () => {
  assert.equal(
    describeCertificateRequirement('overall_score', 85),
    'Overall score below 85%'
  );
});

test('describeCertificateRequirement passes unknown codes through instead of hiding them', () => {
  assert.equal(describeCertificateRequirement('some_future_rule'), 'some_future_rule');
});
