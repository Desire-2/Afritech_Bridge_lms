// Pure jsPDF transcript renderer — kept out of React so it can be unit
// tested and reused (print, email, future routes).

import jsPDF from 'jspdf';
import {
  TranscriptData,
  TranscriptCourseEntry,
} from '@/services/studentApi';

const TEAL: [number, number, number] = [13, 148, 136];
const SLATE: [number, number, number] = [51, 65, 85];
const MUTED: [number, number, number] = [100, 116, 139];
const AMBER: [number, number, number] = [217, 119, 6];

export const safeTranscriptCourseTitle = (entry: TranscriptCourseEntry): string =>
  (entry.course?.title as string) || 'Untitled course';

const fmtDate = (value?: string | null): string => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
};

const moduleCompleted = (m: Record<string, unknown>): boolean =>
  Boolean(m.is_completed ?? m.completed);

export function buildTranscriptPdf(t: TranscriptData): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 50;
  let y = 0;

  const addFooter = () => {
    const page = doc.getNumberOfPages();
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(
      `Afritech Bridge · Academic Transcript · Page ${page}`,
      pageW / 2,
      pageH - 28,
      { align: 'center' }
    );
  };

  const ensureRoom = (needed: number) => {
    if (y + needed > pageH - margin) {
      addFooter();
      doc.addPage();
      y = margin;
    }
  };

  // Header band
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, pageW, 90, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('AFRITECH BRIDGE', margin, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Official Academic Transcript', margin, 62);
  doc.setFontSize(9);
  doc.text(
    t.generated_at ? `Generated ${new Date(t.generated_at).toLocaleString()}` : '',
    pageW - margin,
    42,
    { align: 'right' }
  );
  doc.text('study.afritechbridge.online', pageW - margin, 62, { align: 'right' });

  y = 120;

  // Student block
  doc.setTextColor(...SLATE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(t.student_info?.name || 'Student', margin, y);
  y += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  const studentLines = [
    t.student_info?.email || '',
    t.student_info?.join_date ? `Enrolled since ${fmtDate(t.student_info.join_date)}` : '',
  ].filter(Boolean);
  studentLines.forEach(line => {
    doc.text(line, margin, y);
    y += 14;
  });
  y += 8;

  doc.setDrawColor(...TEAL);
  doc.setLineWidth(1.2);
  doc.line(margin, y, pageW - margin, y);
  y += 24;

  // Summary
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...SLATE);
  doc.text('Summary', margin, y);
  y += 20;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const stats: Array<[string, string]> = [
    ['Courses enrolled', String(t.summary?.total_courses_enrolled ?? 0)],
    ['Courses completed', String(t.summary?.total_courses_completed ?? 0)],
    ['Certificates', String(t.summary?.total_certificates ?? 0)],
    ['Badges', String(t.summary?.total_badges ?? 0)],
    ['Average score', `${Number(t.summary?.overall_gpa ?? 0).toFixed(2)} / 4.0`],
    ['Learning hours', String(Math.round((t.summary?.total_learning_hours ?? 0) / 60))],
  ];
  stats.forEach(([label, value], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = margin + col * ((pageW - margin * 2) / 3);
    const yy = y + row * 34;
    doc.setTextColor(...MUTED);
    doc.setFontSize(8);
    doc.text(label.toUpperCase(), x, yy);
    doc.setTextColor(...SLATE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(value, x, yy + 16);
    doc.setFont('helvetica', 'normal');
  });
  y += 82;

  // Courses
  ensureRoom(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...SLATE);
  doc.text(`Course Record (${t.course_history?.length ?? 0})`, margin, y);
  y += 20;

  (t.course_history || []).forEach(entry => {
    ensureRoom(56);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...SLATE);
    const titleLines = doc.splitTextToSize(
      safeTranscriptCourseTitle(entry),
      pageW - margin * 2 - 100
    ) as string[];
    doc.text(titleLines[0], margin, y);
    const status = String(entry.enrollment?.status || 'in_progress');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...AMBER);
    doc.text(status.toUpperCase(), pageW - margin, y, { align: 'right' });
    y += 14;
    doc.setTextColor(...MUTED);
    doc.setFontSize(9);
    const score = entry.enrollment?.course_score;
    const enrolled = entry.enrollment?.enrollment_date
      ? fmtDate(entry.enrollment.enrollment_date as string)
      : '—';
    const completedModules = (entry.modules || []).filter(m => moduleCompleted(m)).length;
    doc.text(
      `Enrolled ${enrolled} · Modules ${completedModules}/${(entry.modules || []).length}` +
        (typeof score === 'number' && score > 0 ? ` · Score ${Number(score).toFixed(1)}%` : ''),
      margin,
      y
    );
    y += 20;
    const courseId = entry.course?.id as number | undefined;
    const cert = (t.certificates || []).find(c => c.course_id === courseId);
    if (cert) {
      ensureRoom(18);
      doc.setTextColor(...TEAL);
      doc.text(
        `Certificate ${cert.certificate_number}` +
          (cert.overall_score != null ? ` · Score ${Number(cert.overall_score).toFixed(1)}%` : ''),
        margin + 12,
        y
      );
      y += 16;
    }
    y += 8;
  });

  // Certificates
  ensureRoom(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...SLATE);
  doc.text(`Certificates (${t.certificates?.length ?? 0})`, margin, y);
  y += 18;
  (t.certificates || []).forEach(cert => {
    ensureRoom(20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...SLATE);
    doc.text(
      `${cert.course_title || 'Course'}  ·  ${cert.certificate_number}` +
        (cert.overall_score != null ? `  ·  ${Number(cert.overall_score).toFixed(1)}%` : ''),
      margin,
      y
    );
    y += 16;
  });
  y += 8;

  // Skills
  const skills = t.summary?.skills_acquired ?? [];
  if (skills.length) {
    ensureRoom(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...SLATE);
    doc.text('Skills Acquired', margin, y);
    y += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    const lines = doc.splitTextToSize(skills.join('  ·  '), pageW - margin * 2) as string[];
    lines.forEach(line => {
      ensureRoom(14);
      doc.text(line, margin, y);
      y += 14;
    });
  }

  addFooter();
  return doc;
}

export function transcriptPdfFilename(transcript: TranscriptData): string {
  const name = (transcript.student_info?.name || 'student')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '_');
  return `transcript_${name}.pdf`;
}
