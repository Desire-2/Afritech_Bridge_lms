"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Award,
  BookOpen,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  AlertCircle,
  Star,
  GraduationCap,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  StudentApiService,
  TranscriptData,
  TranscriptCourseEntry,
} from '@/services/studentApi';
import {
  buildTranscriptPdf,
  transcriptPdfFilename,
  safeTranscriptCourseTitle,
} from '@/lib/transcriptPdf';
import { describeCertificateRequirement } from '@/constants/learningRules';

const safeTitle = safeTranscriptCourseTitle;

const courseKey = (entry: TranscriptCourseEntry, index: number): string =>
  entry.course?.id != null ? String(entry.course.id) : `idx-${index}`;

const fmtDate = (value?: string | null): string => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
};

const moduleCompleted = (m: Record<string, unknown>): boolean =>
  Boolean(m.is_completed ?? m.completed);

export default function TranscriptPanel() {
  const [transcript, setTranscript] = useState<TranscriptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [generatingCourseId, setGeneratingCourseId] = useState<number | null>(null);
  const [courseMessage, setCourseMessage] = useState<
    Record<string, { type: 'success' | 'error'; text: string }>
  >({});
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const loadTranscript = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await StudentApiService.getTranscript();
      setTranscript(data);
    } catch (err: any) {
      console.error('Failed to load transcript:', err);
      setError(err?.response?.data?.error || err?.message || 'Failed to load transcript');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTranscript();
  }, []);

  const courses = useMemo(() => transcript?.course_history ?? [], [transcript]);
  const selectedEntry = useMemo(() => {
    if (selectedCourse === 'all') return null;
    return courses.find((c, i) => courseKey(c, i) === selectedCourse) ?? null;
  }, [courses, selectedCourse]);

  useEffect(() => {
    // Reset selection if the course disappeared after a refresh
    if (
      selectedCourse !== 'all' &&
      courses.length > 0 &&
      !courses.some((c, i) => courseKey(c, i) === selectedCourse)
    ) {
      setSelectedCourse('all');
    }
  }, [courses, selectedCourse]);

  const certForCourse = (courseId?: number) =>
    transcript?.certificates?.find(c => c.course_id === courseId) ?? null;

  const handleGenerateCertificate = async (courseId: number) => {
    if (generatingCourseId != null) return;
    setGeneratingCourseId(courseId);
    setCourseMessage(prev => ({ ...prev, [courseId]: { type: 'success', text: '' } }));
    try {
      const result = await StudentApiService.generateCertificate(courseId);
      if (result.success) {
        setCourseMessage(prev => ({
          ...prev,
          [courseId]: {
            type: 'success',
            text: result.created
              ? 'Certificate generated! It is now in your Certificates tab.'
              : 'Certificate already issued — opening your certificate.',
          },
        }));
        await loadTranscript();
      } else {
        const req = result.requirements;
        const required = req?.required_score;
        const reasons = req?.failure_reasons
          ?.map((code) => describeCertificateRequirement(code, required))
          .join('; ');
        const pending = req?.pending_gradings?.length
          ? 'Waiting for instructor grading'
          : null;
        const detail = [reasons, pending].filter(Boolean).join('; ');
        setCourseMessage(prev => ({
          ...prev,
          [courseId]: {
            type: 'error',
            text: detail
              ? `${result.summary || result.message || 'Requirements not met'} — ${detail}`
              : result.summary || result.message || 'Requirements not met',
          },
        }));
      }
    } catch (err: any) {
      // Network/server failure — clearly distinct from legitimate
      // ineligibility (which is handled in the try block above).
      const body = err?.response?.data || {};
      setCourseMessage(prev => ({
        ...prev,
        [courseId]: {
          type: 'error',
          text: body.message || body.error || err?.message || 'Failed to generate certificate',
        },
      }));
    } finally {
      setGeneratingCourseId(null);
    }
  };

  const handleDownloadPdf = () => {
    if (!transcript) return;
    setDownloadingPdf(true);
    try {
      const doc = buildTranscriptPdf(transcript);
      doc.save(transcriptPdfFilename(transcript));
    } catch (err) {
      console.error('PDF generation failed:', err);
      setError('Failed to build the PDF. Please try again.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <Card aria-busy="true">
        <CardContent className="py-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" aria-hidden="true" />
          <p className="text-muted-foreground">Preparing your transcript…</p>
        </CardContent>
      </Card>
    );
  }

  if (error && !transcript) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-4" aria-hidden="true" />
          <h3 className="text-lg font-medium mb-2">Transcript unavailable</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={loadTranscript} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!transcript) return null;

  const stats = [
    { label: 'Courses Enrolled', value: transcript.summary?.total_courses_enrolled ?? 0 },
    { label: 'Courses Completed', value: transcript.summary?.total_courses_completed ?? 0 },
    { label: 'Certificates', value: transcript.summary?.total_certificates ?? 0 },
    { label: 'Badges', value: transcript.summary?.total_badges ?? 0 },
    { label: 'Average Score', value: `${Number(transcript.summary?.overall_gpa ?? 0).toFixed(2)} / 4.0` },
    { label: 'Learning Hours', value: Math.round((transcript.summary?.total_learning_hours ?? 0) / 60) },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-teal-600 to-teal-500 px-6 py-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FileText className="h-5 w-5" aria-hidden="true" />
              Academic Transcript
            </h2>
            <p className="text-teal-50/90 text-sm mt-1">
              {transcript.student_info?.name}
              {transcript.student_info?.email ? ` · ${transcript.student_info.email}` : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={loadTranscript}
              className="bg-white/15 text-white hover:bg-white/25 border border-white/20"
            >
              <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {downloadingPdf ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="h-4 w-4 mr-2" aria-hidden="true" />
              )}
              Download PDF
            </Button>
          </div>
        </div>
      </Card>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map(stat => (
          <Card key={stat.label}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-teal-700 dark:text-teal-400">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Course selector — only when enrolled in more than one course */}
      {courses.length > 1 && (
        <div>
          <p className="text-sm font-medium mb-2 text-muted-foreground" id="course-selector-label">
            Select a course
          </p>
          <div
            className="flex flex-wrap gap-2"
            role="tablist"
            aria-labelledby="course-selector-label"
          >
            <button
              type="button"
              role="tab"
              aria-selected={selectedCourse === 'all'}
              onClick={() => setSelectedCourse('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors min-h-[44px] cursor-pointer ${
                selectedCourse === 'all'
                  ? 'bg-teal-600 text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              All courses
            </button>
            {courses.map((entry, i) => {
              const key = courseKey(entry, i);
              const active = selectedCourse === key;
              return (
                <button
                  type="button"
                  key={key}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedCourse(key)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors min-h-[44px] cursor-pointer max-w-[260px] truncate ${
                    active
                      ? 'bg-teal-600 text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted/70'
                  }`}
                >
                  {safeTitle(entry)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedEntry ? (
        /* ── Single-course view ── */
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Button variant="ghost" size="sm" onClick={() => setSelectedCourse('all')}>
              <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
              All courses
            </Button>
            <Badge variant={selectedEntry.enrollment?.status === 'completed' ? 'default' : 'secondary'}>
              {selectedEntry.enrollment?.status === 'completed' ? 'Completed' : 'In Progress'}
            </Badge>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="h-5 w-5 text-teal-600" aria-hidden="true" />
                {safeTitle(selectedEntry)}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Enrolled {fmtDate(selectedEntry.enrollment?.enrollment_date as string)}
                {typeof selectedEntry.enrollment?.course_score === 'number' &&
                  selectedEntry.enrollment.course_score > 0 && (
                    <> · Overall score {Number(selectedEntry.enrollment.course_score).toFixed(1)}%</>
                  )}
                {Boolean(selectedEntry.enrollment?.completed_at) && (
                  <> · Completed {fmtDate(selectedEntry.enrollment?.completed_at as string)}</>
                )}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Modules */}
              {(selectedEntry.modules?.length ?? 0) > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Modules completed:{' '}
                    {selectedEntry.modules.filter(m => moduleCompleted(m)).length} /{' '}
                    {selectedEntry.modules.length}
                  </p>
                  <ul className="space-y-1.5">
                    {selectedEntry.modules.map((m, idx) => {
                      const name =
                        (m.module_info?.title as string) || `Module ${idx + 1}`;
                      const done = moduleCompleted(m);
                      return (
                        <li
                          key={idx}
                          className="flex items-center gap-2 text-sm rounded-md border px-3 py-2"
                        >
                          {done ? (
                            <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0" aria-hidden="true" />
                          ) : (
                            <div className="h-4 w-4 rounded-full border shrink-0" aria-hidden="true" />
                          )}
                          <span className={done ? '' : 'text-muted-foreground'}>{name}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Certificate block */}
              <div className="rounded-lg border p-4 space-y-3">
                {(() => {
                  const courseId = selectedEntry.course?.id as number | undefined;
                  const existingCert =
                    courseId != null ? certForCourse(courseId) : null;
                  const msg = courseId != null ? courseMessage[courseId] : null;

                  if (existingCert) {
                    return (
                      <>
                        <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400">
                          <Award className="h-5 w-5" aria-hidden="true" />
                          <span className="font-semibold">Certificate issued</span>
                        </div>
                        <p className="text-sm font-mono">{existingCert.certificate_number}</p>
                        {existingCert.overall_score != null && (
                          <p className="text-sm text-muted-foreground">
                            Score: {Number(existingCert.overall_score).toFixed(1)}%
                          </p>
                        )}
                      </>
                    );
                  }

                  if (courseId == null) return null;

                  return (
                    <>
                      <div className="flex items-center gap-2">
                        <GraduationCap className="h-5 w-5 text-amber-600" aria-hidden="true" />
                        <span className="font-semibold">Certificate</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Finish every module with at least 70% to earn your certificate for
                        this course.
                      </p>
                      {msg?.type === 'error' && (
                        <p className="text-sm text-destructive" role="alert">
                          {msg.text}
                        </p>
                      )}
                      {msg?.type === 'success' && msg.text && (
                        <p className="text-sm text-teal-700 dark:text-teal-400" role="status">
                          {msg.text}
                        </p>
                      )}
                      <Button
                        onClick={() => handleGenerateCertificate(courseId)}
                        disabled={generatingCourseId != null}
                        className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white"
                      >
                        {generatingCourseId === courseId ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                            Checking eligibility…
                          </>
                        ) : (
                          <>
                            <GraduationCap className="h-4 w-4 mr-2" aria-hidden="true" />
                            Generate Certificate
                          </>
                        )}
                      </Button>
                    </>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        /* ── All-courses view ── */
        <div className="space-y-6">
          {/* Course list */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <BookOpen className="h-5 w-5 mr-2 text-teal-600" aria-hidden="true" />
                Course Record ({courses.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {courses.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No enrollments yet. Complete a course to build your transcript.
                </p>
              ) : (
                courses.map((entry, i) => {
                  const key = courseKey(entry, i);
                  const done = (entry.modules || []).filter(m => moduleCompleted(m)).length;
                  const cert = certForCourse(entry.course?.id as number | undefined);
                  return (
                    <button
                      type="button"
                      key={key}
                      onClick={() => setSelectedCourse(key)}
                      className="w-full text-left rounded-lg border p-4 hover:border-teal-500 hover:bg-teal-500/5 transition-colors cursor-pointer min-h-[44px]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{safeTitle(entry)}</p>
                          <p className="text-sm text-muted-foreground">
                            Enrolled {fmtDate(entry.enrollment?.enrollment_date as string)} ·
                            Modules {done}/{(entry.modules || []).length}
                            {cert ? ' · Certificate issued' : ''}
                          </p>
                        </div>
                        <Badge
                          variant={entry.enrollment?.status === 'completed' ? 'default' : 'secondary'}
                        >
                          {entry.enrollment?.status === 'completed' ? 'Completed' : 'In Progress'}
                        </Badge>
                      </div>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Certificates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <Award className="h-5 w-5 mr-2 text-amber-600" aria-hidden="true" />
                Certificates ({transcript.certificates?.length ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(transcript.certificates?.length ?? 0) === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No certificates yet. Open a completed course above to generate one.
                </p>
              ) : (
                transcript.certificates.map((cert, index) => (
                  <div
                    key={cert.id ?? cert.certificate_number ?? index}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{cert.course_title || 'Course'}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {cert.certificate_number}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      {cert.overall_score != null && (
                        <p className="font-semibold">{Number(cert.overall_score).toFixed(1)}%</p>
                      )}
                      {cert.issued_at && (
                        <p className="text-xs text-muted-foreground">{fmtDate(cert.issued_at)}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Skills */}
          {(transcript.summary?.skills_acquired?.length ?? 0) > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <Star className="h-5 w-5 mr-2 text-teal-600" aria-hidden="true" />
                  Skills Acquired
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {transcript.summary!.skills_acquired!.map((skill, index) => (
                  <Badge key={index} variant="secondary">
                    {skill}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
