import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTranscriptPdf, transcriptPdfFilename, safeTranscriptCourseTitle } from '../src/lib/transcriptPdf';
import type { TranscriptData } from '../src/services/studentApi';

const fixture = (): TranscriptData => ({
  student_info: { id: 1, name: 'Trina Student', email: 't@x.test', join_date: '2026-01-01T00:00:00' },
  summary: {
    total_courses_enrolled: 2,
    total_courses_completed: 1,
    total_certificates: 1,
    total_badges: 1,
    overall_gpa: 3.4,
    total_learning_hours: 600,
    skills_acquired: ['Python', 'Data analysis'],
  },
  course_history: [
    {
      course: { id: 10, title: 'Data Fundamentals' },
      enrollment: { status: 'completed', enrollment_date: '2026-02-01T00:00:00', course_score: 88 },
      modules: [
        { is_completed: true, module_info: { title: 'M1' } },
        { is_completed: true, module_info: { title: 'M2' } },
      ],
    },
    {
      course: { id: 11, title: 'Web Essentials' },
      enrollment: { status: 'in_progress', enrollment_date: '2026-03-01T00:00:00' },
      modules: [{ is_completed: false, module_info: { title: 'M1' } }],
    },
  ],
  certificates: [
    {
      id: 1,
      course_id: 10,
      certificate_number: 'ABC-2026-000042',
      overall_score: 88,
      course_title: 'Data Fundamentals',
      issued_at: '2026-04-01T00:00:00',
      skills_acquired: [],
      portfolio_items: [],
    } as any,
  ],
  badges: [],
  generated_at: '2026-10-11T00:00:00Z',
});

test('buildTranscriptPdf produces a real PDF with expected pages', () => {
  const doc = buildTranscriptPdf(fixture());
  const buf = doc.output('arraybuffer') as ArrayBuffer;
  const magic = String.fromCharCode(...new Uint8Array(buf.slice(0, 5)));
  assert.equal(magic, '%PDF-');
  assert.ok(buf.byteLength > 2000, `PDF too small: ${buf.byteLength}`);
  assert.ok(doc.getNumberOfPages() >= 1);
});

test('buildTranscriptPdf paginates long course histories', () => {
  const t = fixture();
  t.course_history = Array.from({ length: 40 }, (_, i) => ({
    course: { id: 100 + i, title: `Course ${i}` },
    enrollment: { status: 'in_progress', enrollment_date: '2026-01-01T00:00:00' },
    modules: Array.from({ length: 8 }, (_, j) => ({ is_completed: j % 2 === 0, module_info: { title: `M${j}` } })),
  }));
  const doc = buildTranscriptPdf(t);
  assert.ok(doc.getNumberOfPages() >= 2, `expected pagination, got ${doc.getNumberOfPages()}`);
});

test('transcriptPdfFilename sanitizes the student name', () => {
  const t = fixture();
  t.student_info.name = 'Ana María Osei';
  assert.equal(transcriptPdfFilename(t), 'transcript_Ana_Mara_Osei.pdf');
  assert.ok(transcriptPdfFilename(t).endsWith('.pdf'));
  assert.ok(!transcriptPdfFilename(t).includes(' '));
});

test('safeTranscriptCourseTitle falls back for missing titles', () => {
  assert.equal(safeTranscriptCourseTitle({ course: {}, enrollment: {}, modules: [] } as any), 'Untitled course');
  assert.equal(
    safeTranscriptCourseTitle({ course: { title: 'X' }, enrollment: {}, modules: [] } as any),
    'X'
  );
});
