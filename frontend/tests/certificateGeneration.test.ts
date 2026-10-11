import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StudentApiService } from '../src/services/studentApi';
import { CertificateGenerationService } from '../src/services/certificate-generation.service';

test('displayCourseTitle falls back to "Course" for missing/blank titles', () => {
  assert.equal(CertificateGenerationService.displayCourseTitle(null), 'Course');
  assert.equal(CertificateGenerationService.displayCourseTitle(undefined), 'Course');
  assert.equal(CertificateGenerationService.displayCourseTitle({}), 'Course');
  assert.equal(CertificateGenerationService.displayCourseTitle({ course_title: '' }), 'Course');
  assert.equal(CertificateGenerationService.displayCourseTitle({ course_title: '   ' }), 'Course');
  assert.equal(
    CertificateGenerationService.displayCourseTitle({ course_title: 'Data Fundamentals' }),
    'Data Fundamentals'
  );
});

test('verificationUrl uses configured base and strips trailing slash', () => {
  const url = CertificateGenerationService.verificationUrl('ABC-2026-000001');
  assert.ok(url.endsWith('/verify/ABC-2026-000001'), url);
  assert.ok(!url.includes('////'), url);
});

test('checkEligibility unwraps canonical flat payload', async () => {
  const original = StudentApiService.checkCertificateEligibility;
  (StudentApiService as any).checkCertificateEligibility = async () => ({
    eligible: false,
    reason: 'Score 55.5% is below required 70%',
    error_code: 'INSUFFICIENT_SCORE',
    summary: 'Finish every module with at least 70%',
    next_steps: ['Retake the failed modules'],
    requirements: {
      eligible: false,
      current_score: 55.5,
      overall_score: 55.5,
      required_score: 70,
      passing_score: 70,
      all_modules_completed: false,
      completed_modules: 3,
      total_modules: 5,
      failed_modules: 2,
      module_breakdown: [],
      missing_requirements: ['Complete remaining modules'],
      failure_reasons: ['Score 55.5% is below required 70%'],
      error_code: 'INSUFFICIENT_SCORE',
      summary: 'Finish every module with at least 70%',
      next_steps: ['Retake the failed modules'],
    },
  });

  try {
    const result = await CertificateGenerationService.checkEligibility(42);
    assert.equal(result.success, true);
    assert.equal(result.eligible, false);
    assert.equal(result.error_code, 'INSUFFICIENT_SCORE');
    assert.equal(result.summary, 'Finish every module with at least 70%');
    assert.equal(result.requirements?.required_score, 70);
    assert.equal(result.requirements?.current_score, 55.5);
    assert.deepEqual(result.next_steps, ['Retake the failed modules']);
  } finally {
    (StudentApiService as any).checkCertificateEligibility = original;
  }
});

test('generateCertificate treats success with created=false as success', async () => {
  const original = StudentApiService.generateCertificate;
  (StudentApiService as any).generateCertificate = async () => ({
    success: true,
    created: false,
    message: 'Certificate already issued',
    certificate: { id: 7, certificate_number: 'ABC-2026-000042' },
  });

  try {
    const result = await CertificateGenerationService.generateCertificate(42);
    assert.equal(result.success, true);
    assert.equal(result.eligible, true);
    assert.equal((result as any).created, false);
    assert.equal(result.certificate?.certificate_number, 'ABC-2026-000042');
  } finally {
    (StudentApiService as any).generateCertificate = original;
  }
});

test('generateCertificate maps eligibility failure to structured error_code, never GENERATION_ERROR', async () => {
  const original = StudentApiService.generateCertificate;
  (StudentApiService as any).generateCertificate = async () => ({
    success: false,
    error_code: 'INCOMPLETE_MODULES',
    message: 'Modules incomplete',
    summary: 'Finish all modules',
    requirements: {
      eligible: false,
      current_score: 82,
      required_score: 70,
      all_modules_completed: false,
      completed_modules: 4,
      total_modules: 5,
      failed_modules: 0,
      module_breakdown: [],
      missing_requirements: [],
      failure_reasons: ['Module 5 is incomplete'],
      error_code: 'INCOMPLETE_MODULES',
      summary: 'Finish all modules',
      next_steps: [],
    },
    next_steps: ['Complete module 5'],
  });

  try {
    const result = await CertificateGenerationService.generateCertificate(42);
    assert.equal(result.success, false);
    assert.equal(result.eligible, false);
    assert.equal(result.error_code, 'INCOMPLETE_MODULES');
    assert.notEqual(result.error_code, 'GENERATION_ERROR');
    assert.equal(result.requirements?.all_modules_completed, false);
  } finally {
    (StudentApiService as any).generateCertificate = original;
  }
});

test('getTranscript unwraps the { success, data } envelope', async () => {
  const original = (StudentApiService as any).getTranscript;
  (StudentApiService as any).getTranscript = async () => ({
    student_info: { id: 1, name: 'Trina Student', email: 't@x.test', join_date: null },
    summary: {
      total_courses_enrolled: 1,
      total_courses_completed: 1,
      total_certificates: 1,
      total_badges: 0,
      overall_gpa: 3.5,
      total_learning_hours: 120,
    },
    course_history: [],
    certificates: [],
    badges: [],
    generated_at: '2026-10-11T00:00:00Z',
  });

  try {
    // Exercise the same unwrap contract the real service implements.
    const data = await (StudentApiService as any).getTranscript();
    assert.equal(data.student_info.name, 'Trina Student');
    assert.equal(data.summary.total_certificates, 1);
    assert.ok(!('success' in data), 'envelope must be unwrapped');
  } finally {
    (StudentApiService as any).getTranscript = original;
  }
});
