'use client';

import React, { useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Clock3,
  Layers3,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { Course } from '@/types/api';
import { normalizeApplicationWindows, getPrimaryWindow, formatDate } from '@/utils/cohort-utils';
import { getCohortPaymentTier } from '@/types/course-tiers';
import { TierBadge } from './TierBadge';
import { StatusDot } from './StatusDot';
import { PaymentInfoBlock } from './PaymentInfoBlock';

interface CourseCardProps {
  course: Course;
}

function getCategory(course: Course): string {
  return course.category || course.target_audience || 'Technology';
}

function getCategoryGradient(category: string): string {
  const lower = category.toLowerCase();
  if (lower.includes('excel') || lower.includes('data')) return 'from-cyan-500/80 via-blue-700 to-indigo-950';
  if (lower.includes('web') || lower.includes('program')) return 'from-blue-500/80 via-indigo-700 to-[#171a58]';
  if (lower.includes('ai') || lower.includes('machine')) return 'from-violet-500/80 via-indigo-700 to-[#19143d]';
  if (lower.includes('design')) return 'from-fuchsia-500/70 via-violet-700 to-[#241640]';
  return 'from-sky-500/75 via-blue-800 to-[#14213f]';
}

function getInitials(name?: string): string {
  return (name || 'AB')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function getStatusLabel(status?: string): string | null {
  if (status === 'open') return 'Enrolling now';
  if (status === 'upcoming') return 'Upcoming';
  if (status === 'closed') return 'Closed';
  return null;
}

export const CourseCard: React.FC<CourseCardProps> = ({ course }) => {
  const windows = useMemo(() => normalizeApplicationWindows(course), [course]);
  const primaryWindow = useMemo(() => getPrimaryWindow(windows), [windows]);
  const tier = getCohortPaymentTier(primaryWindow, course);
  const enrollmentType = primaryWindow?.effective_enrollment_type ?? primaryWindow?.enrollment_type ?? course.enrollment_type;
  const isScholarshipBacked = enrollmentType === 'scholarship' || tier === 'scholarship';
  const category = getCategory(course);
  const cohortStatus = primaryWindow?.status;
  const statusLabel = getStatusLabel(cohortStatus);
  const actionHref = `/courses/${course.id}/apply`;
  const moduleCount = course.modules?.length;
  const deadline = primaryWindow?.closes_at && cohortStatus === 'open' ? formatDate(primaryWindow.closes_at) : null;
  const enrollmentCount = primaryWindow?.enrollment_count ?? course.enrollment_count;
  const capacity = primaryWindow?.max_students;
  const categoryGradient = getCategoryGradient(category);

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0d131e] shadow-[0_18px_50px_rgba(0,0,0,0.18)] transition-all duration-300 ease-out hover:-translate-y-1 hover:border-cyan-200/30 hover:shadow-[0_22px_65px_rgba(0,0,0,0.35),0_0_35px_rgba(34,211,238,0.07)] motion-reduce:transform-none motion-reduce:transition-none">
      <div className="relative aspect-[16/10] overflow-hidden border-b border-white/[0.08]">
        {course.thumbnail_url ? (
          <Image
            src={course.thumbnail_url}
            alt={course.title}
            fill
            sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, (max-width: 1535px) 33vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.035] motion-reduce:transition-none motion-reduce:transform-none"
          />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${categoryGradient} transition-transform duration-500 group-hover:scale-[1.035] motion-reduce:transition-none motion-reduce:transform-none`}>
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage: 'linear-gradient(rgba(255,255,255,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.16) 1px, transparent 1px)',
                backgroundSize: '32px 32px',
                maskImage: 'linear-gradient(135deg, black, transparent 75%)',
              }}
            />
            <span className="absolute -bottom-8 -right-4 text-[9rem] font-semibold leading-none tracking-[-0.12em] text-white/[0.1]">
              {course.title?.charAt(0)?.toUpperCase() || 'C'}
            </span>
            <span className="absolute left-6 top-1/2 max-w-[12rem] -translate-y-1/2 text-sm font-medium leading-5 text-white/80">
              Practical skills for a digital future
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d131e]/85 via-transparent to-black/10" />

        <div className="absolute left-4 top-4">
          <TierBadge tier={tier} isScholarship={isScholarshipBacked} />
        </div>

        {course.estimated_duration && (
          <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/30 px-2.5 py-1.5 text-[11px] font-medium text-white backdrop-blur-md">
            <Clock3 className="h-3.5 w-3.5 text-cyan-200" aria-hidden="true" />
            {course.estimated_duration}
          </span>
        )}

        {statusLabel && (
          <span className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-2.5 py-1.5 text-[11px] font-medium text-white backdrop-blur-md">
            <StatusDot status={cohortStatus || 'closed'} />
            {statusLabel}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300/80">{category}</span>
          {course.skill_assessment_config && (
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-300/80">AI assessed</span>
          )}
        </div>

        <h3 className="mt-3 min-h-[3.7rem] text-xl font-semibold leading-[1.12] tracking-[-0.04em] text-white transition-colors group-hover:text-cyan-100">
          {course.title}
        </h3>

        <p className="mt-3 min-h-[4.5rem] line-clamp-3 text-sm leading-6 text-slate-400">
          {course.description || 'Build practical technology skills with a focused learning path.'}
        </p>

        <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-y border-white/[0.08] py-4 text-xs text-slate-400">
          {course.estimated_duration && (
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              {course.estimated_duration}
            </span>
          )}
          {moduleCount ? (
            <span className="inline-flex items-center gap-1.5">
              <Layers3 className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              {moduleCount} {moduleCount === 1 ? 'module' : 'modules'}
            </span>
          ) : null}
          {course.difficulty_level && (
            <span className="inline-flex items-center gap-1.5 capitalize">
              <BarChart3 className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              {course.difficulty_level}
            </span>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 text-xs">
          {course.instructor_name ? (
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/10 text-[10px] font-semibold text-cyan-200">
                {getInitials(course.instructor_name)}
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] uppercase tracking-[0.12em] text-slate-600">Instructor</span>
                <span className="mt-0.5 block truncate font-medium text-slate-300">{course.instructor_name}</span>
              </span>
            </div>
          ) : <span />}

          {primaryWindow?.cohort_label && (
            <div className="flex min-w-0 items-center gap-1.5 text-right text-slate-400">
              <div className="min-w-0">
                <span className="block text-[10px] uppercase tracking-[0.12em] text-slate-600">Cohort</span>
                <span className="mt-0.5 block max-w-[8rem] truncate font-medium text-slate-300">{primaryWindow.cohort_label}</span>
              </div>
              <UsersRound className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
            </div>
          )}
        </div>

        {deadline || (enrollmentCount != null && capacity) ? (
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
            {deadline && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-emerald-300/70" aria-hidden="true" />
                Apply by {deadline}
              </span>
            )}
            {enrollmentCount != null && capacity ? (
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                {enrollmentCount}/{capacity} seats
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="mt-auto pt-6">
          <PaymentInfoBlock course={course} window={primaryWindow} />
          <div className="mt-4">
            <Link
              href={actionHref}
              className="group/cta inline-flex w-full min-w-0 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-3 py-3 text-center text-xs font-semibold text-slate-950 transition-all hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-300/70 focus:ring-offset-2 focus:ring-offset-[#0d131e] active:scale-[0.99]"
            >
              <span className="truncate">Apply now</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover/cta:translate-x-0.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
};
