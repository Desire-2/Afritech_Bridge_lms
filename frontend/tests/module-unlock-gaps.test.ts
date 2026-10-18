import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildUnlockErrorInfo,
  failedLessonItems,
  failedLessonsFromEligibility,
  mergeMissingItems,
  summarizeRequirementLabels,
} from '../src/app/(learn)/learn/[id]/utils/moduleUnlockGaps';

// The video message and the reading message are the ones the old
// keyword-only recommendation filter silently dropped.
const VIDEO_MSG = 'Watch at least 90% of the lesson video content';
const READING_MSG =
  'Complete reading (need 90% reading progress and 60% engagement, currently 40.0% reading and 30.0% engagement, or score 55.0% >= 80%)';
const START_MSG = 'lesson_must_be_started';

const eligibilityWithFailedLessons = {
  eligible: false,
  total_score: 62.5,
  required_score: 70,
  previous_module: { id: 7, title: 'Foundations', order: 1 },
  recommendations: [
    "Complete 2 lesson(s) with requirements in Module 1: 'Foundations'",
    "Lesson 'Video Recap': watch 90%+ of the video",
    'Complete Module 1 with 80%+ score (currently 62.5%, need 17.5% more)',
  ],
  lesson_requirements: {
    all_lessons_passed: false,
    passed_count: 3,
    total_count: 5,
    blocking_message: 'Module BLOCKED: 2 lesson(s) have critical requirement failures that prevent module completion',
    failed_lessons: [
      {
        id: 11,
        title: 'Video Recap',
        order: 4,
        status: 'requirements_not_met',
        score: 84.0,
        completed: true,
        requirements: [VIDEO_MSG],
      },
      {
        id: 12,
        title: 'Reading Deep Dive',
        order: 5,
        status: 'score_below_threshold',
        current_score: 55.0,
        completed: false,
        requirements: [READING_MSG],
      },
    ],
  },
};

describe('summarizeRequirementLabels', () => {
  test('the video requirement is never dropped', () => {
    assert.deepEqual(summarizeRequirementLabels([VIDEO_MSG]), ['watch 90%+ of the video']);
  });

  test('reading+engagement message is labelled before the score keyword', () => {
    assert.deepEqual(summarizeRequirementLabels([READING_MSG]), ['finish reading & engagement']);
  });

  test('recognised requirement keywords map to short labels', () => {
    assert.deepEqual(summarizeRequirementLabels(['Quiz score must be at least 70%']), [
      'pass the quiz',
    ]);
    assert.deepEqual(summarizeRequirementLabels(['Assignment must be graded and passed']), [
      'pass the assignment',
    ]);
    assert.deepEqual(summarizeRequirementLabels([START_MSG]), ['start the lesson']);
    assert.deepEqual(summarizeRequirementLabels(['lesson_score_must_be_at_least_80%']), [
      'reach an 80% lesson score',
    ]);
  });

  test('unknown requirements fall back to a truncated raw string instead of vanishing', () => {
    const long = 'x'.repeat(120);
    const labels = summarizeRequirementLabels([long]);
    assert.equal(labels.length, 1);
    assert.equal(labels[0].length, 80);
  });

  test('empty or missing requirements still produce one label', () => {
    assert.deepEqual(summarizeRequirementLabels(undefined), ['complete lesson requirements']);
    assert.deepEqual(summarizeRequirementLabels([]), ['complete lesson requirements']);
    assert.deepEqual(summarizeRequirementLabels(['', '  ']), ['complete lesson requirements']);
  });

  test('duplicate labels are deduped', () => {
    assert.deepEqual(summarizeRequirementLabels([READING_MSG, READING_MSG]), [
      'finish reading & engagement',
    ]);
  });
});

describe('failedLessonsFromEligibility', () => {
  test('extracts failed lessons when present', () => {
    const failed = failedLessonsFromEligibility(eligibilityWithFailedLessons);
    assert.equal(failed.length, 2);
    assert.equal(failed[0].title, 'Video Recap');
  });

  test('tolerates missing or malformed eligibility payloads', () => {
    assert.deepEqual(failedLessonsFromEligibility(null), []);
    assert.deepEqual(failedLessonsFromEligibility({}), []);
    assert.deepEqual(
      failedLessonsFromEligibility({ lesson_requirements: { failed_lessons: 'nope' } }),
      []
    );
  });
});

describe('failedLessonItems', () => {
  test('names every blocking lesson with what is missing', () => {
    const items = failedLessonItems(eligibilityWithFailedLessons);
    assert.equal(items.length, 2);
    assert.match(items[0], /Lesson “Video Recap” — marked completed, but re-check failed/);
    assert.match(items[0], /watch 90\%\+ of the video/);
    assert.match(items[1], /Lesson “Reading Deep Dive” — not completed/);
    assert.match(items[1], /finish reading & engagement/);
  });

  test('a completed lesson blocked only by the video rule is still named', () => {
    const items = failedLessonItems({
      lesson_requirements: {
        failed_lessons: [
          { id: 1, title: 'Demo', completed: true, requirements: [VIDEO_MSG] },
        ],
      },
    });
    assert.equal(items.length, 1);
    assert.match(items[0], /Demo/);
    assert.match(items[0], /watch 90\%\+ of the video/);
  });
});

describe('mergeMissingItems', () => {
  test('failed lessons come first and recommendation lesson lines are deduped', () => {
    const items = mergeMissingItems(eligibilityWithFailedLessons);
    assert.equal(items[0].includes('Video Recap'), true);
    assert.equal(items[1].includes('Reading Deep Dive'), true);
    // The count line and the score line survive…
    assert.equal(
      items.some((item) => item.startsWith('Complete 2 lesson(s)')),
      true
    );
    assert.equal(
      items.some((item) => item.startsWith('Complete Module 1 with 80%+ score')),
      true
    );
    // …but the recommendations' own `Lesson '…'` lines do not duplicate them.
    assert.equal(
      items.some((item) => item.startsWith("Lesson '")),
      false
    );
  });

  test('returns empty for missing eligibility', () => {
    assert.deepEqual(mergeMissingItems(null), []);
  });
});

describe('buildUnlockErrorInfo', () => {
  test('builds the dialog payload from eligibility', () => {
    const info = buildUnlockErrorInfo(eligibilityWithFailedLessons);
    assert.equal(
      info.mainError,
      'Module BLOCKED: 2 lesson(s) have critical requirement failures that prevent module completion'
    );
    assert.equal(info.failedLessons.length, 2);
    assert.deepEqual(info.previousModule, { id: 7, title: 'Foundations', order: 1 });
    assert.equal(info.lessonsChecked, 5);
    assert.equal(info.lessonsPassed, 3);
    assert.equal(info.moduleScore, 62.5);
    assert.equal(info.actionRequired, 'complete_requirements');
    assert.deepEqual(info.validationErrors, []);

    const videoLesson = info.failedLessons[0];
    assert.equal(videoLesson.id, 11);
    assert.equal(videoLesson.title, 'Video Recap');
    assert.equal(videoLesson.order, 4);
    assert.equal(videoLesson.lessonScore, 84);
    assert.deepEqual(videoLesson.requirements, [VIDEO_MSG]);
  });

  test('score falls back from score → current_score → 0', () => {
    const info = buildUnlockErrorInfo({
      lesson_requirements: {
        failed_lessons: [
          { id: 1, title: 'A', score: 71 },
          { id: 2, title: 'B', current_score: 42 },
          { id: 3, title: 'C' },
        ],
      },
    });
    assert.deepEqual(
      info.failedLessons.map((lesson) => lesson.lessonScore),
      [71, 42, 0]
    );
  });

  test('mainError degrades gracefully without blocking_message', () => {
    const info = buildUnlockErrorInfo({
      lesson_requirements: { failed_lessons: [{ id: 9, title: 'Solo' }] },
    });
    assert.match(info.mainError, /1 lesson in the previous module does not meet requirements/);
    assert.equal(info.failedLessons[0].title, 'Solo');
    assert.equal(info.failedLessons[0].order, 0);
  });
});
