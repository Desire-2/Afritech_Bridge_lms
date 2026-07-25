'use client';
import React, { useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Course, ApplicationWindowData } from '@/types/api';
import { normalizeApplicationWindows, getPrimaryWindow, formatDate } from '@/utils/cohort-utils';
import { 
  getCohortPaymentTier, 
  getApplyLabel 
} from '@/types/course-tiers';
import { TierBadge } from './TierBadge';
import { StatusDot } from './StatusDot';
import { PaymentInfoBlock } from './PaymentInfoBlock';

interface CourseCardProps {
  course: Course;
}

// Category icons for placeholder thumbnails
const categoryIcons: Record<string, string> = {
  programming: '💻',
  web: '🌐',
  data: '📊',
  design: '🎨',
  mobile: '📱',
  ai: '🤖',
  security: '🔒',
  cloud: '☁️',
  default: '📚',
};

function getCategoryIcon(category?: string): string {
  if (!category) return categoryIcons['default'];
  const lower = category.toLowerCase();
  for (const [key, icon] of Object.entries(categoryIcons)) {
    if (lower.includes(key)) return icon;
  }
  return categoryIcons['default'];
}

export const CourseCard: React.FC<CourseCardProps> = ({ course }) => {
  const windows = useMemo(() => normalizeApplicationWindows(course), [course]);
  const primaryWindow = useMemo(() => getPrimaryWindow(windows), [windows]);
  const tier = getCohortPaymentTier(primaryWindow, course);
  
  const openWindows = windows.filter(w => w.status === 'open');
  const upcomingWindows = windows.filter(w => w.status === 'upcoming');
  
  // Thumbnail gradient based on tier
  const thumbnailGradient = 
    tier === 'free' ? 'from-emerald-500 via-teal-500 to-cyan-600'
    : tier === 'scholarship' ? 'from-amber-500 via-orange-500 to-amber-600'
    : tier === 'partial_scholarship' ? 'from-violet-500 via-purple-500 to-indigo-600'
    : 'from-sky-500 via-blue-500 to-indigo-600';
  
  // Compact cohort info
  const cohortStatus = primaryWindow?.status;
  const cohortLabel = primaryWindow?.cohort_label || 'Current Cohort';
  const deadline = primaryWindow?.closes_at;
  const capacity = primaryWindow?.max_students;
  const enrolled = primaryWindow?.enrollment_count ?? 0;
  
  // Get course initial for watermark
  const courseInitial = course.title?.charAt(0)?.toUpperCase() || 'C';
  const categoryIcon = getCategoryIcon(course.category || course.target_audience);

  // Apply button colors
  const applyColors = 
    tier === 'free' ? 'bg-emerald-600 hover:bg-emerald-700'
    : tier === 'scholarship' ? 'bg-amber-600 hover:bg-amber-700'
    : 'bg-sky-600 hover:bg-sky-700';

  return (
    <div className="group relative bg-white border border-zinc-200 shadow-sm overflow-hidden rounded-xl hover:shadow-xl hover:border-zinc-300 hover:-translate-y-1 transition-all duration-300 ease-out h-full flex flex-col dark:bg-zinc-900/80 dark:border-zinc-700/60 dark:hover:border-zinc-600 dark:hover:shadow-zinc-900/50">
      {/* Thumbnail Zone - 16:9 aspect ratio */}
      <div className="relative aspect-[16/9] overflow-hidden">
        {course.thumbnail_url ? (
          /* ── Actual thumbnail image ── */
          <>
            <Image
              src={course.thumbnail_url}
              alt={course.title}
              fill
              sizes="(max-width: 640px) 72vw, (max-width: 1024px) 50vw, 25vw"
              className="object-cover transition-all duration-500 group-hover:scale-105"
            />
            {/* Dark overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          </>
        ) : (
          /* ── Fallback gradient ── */
          <>
            <div className={`absolute inset-0 bg-gradient-to-br ${thumbnailGradient} transition-all duration-500 group-hover:scale-105`} />
            
            {/* Decorative circles */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8 transition-all duration-500 group-hover:w-32 group-hover:h-32 group-hover:bg-white/15 group-hover:-mr-10 group-hover:-mt-10" />
            <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/10 rounded-full -ml-6 -mb-6 transition-all duration-500 group-hover:w-20 group-hover:h-20 group-hover:bg-white/15 group-hover:-ml-8 group-hover:-mb-8" />
            
            {/* Watermark icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-6xl opacity-20 transition-all duration-500 group-hover:opacity-35 group-hover:scale-125 group-hover:rotate-3">
                {categoryIcon || courseInitial}
              </span>
            </div>
          </>
        )}

        {/* Shimmer overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out pointer-events-none" />
        
        {/* Tier badge overlay - top left */}
        <div className="absolute top-3 left-3 z-10 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
          <TierBadge tier={tier} />
        </div>
        
        {/* Duration badge - top right */}
        {course.estimated_duration && (
          <div className="absolute top-3 right-3 z-10 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-black/30 text-white backdrop-blur-sm">
              {course.estimated_duration}
            </span>
          </div>
        )}
        
        {/* Cohort status indicator */}
        {cohortStatus && (
          <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm rounded-full px-2.5 py-1 transition-all duration-300 group-hover:bg-black/50">
            <StatusDot status={cohortStatus} />
            <span className="text-[10px] font-medium text-white capitalize">
              {cohortStatus === 'open' ? (
                <span className="flex items-center gap-1">
                  Open
                  <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                </span>
              ) : cohortStatus === 'upcoming' ? 'Upcoming' : 'Closed'}
            </span>
          </div>
        )}
        
        {/* Hover overlay with "View Course" hint */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 flex items-center justify-center pointer-events-none">
          <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-90 group-hover:scale-100">
            <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-lg">
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">View Course →</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-3.5 sm:p-4 flex-grow flex flex-col gap-2 sm:gap-2.5">
        {/* Title */}
        <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white line-clamp-2 leading-snug group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors duration-300">
          {course.title}
        </h3>

        {/* Compact metadata row — wraps on very small screens */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] sm:text-[11px] text-zinc-500 dark:text-zinc-400">
          {course.estimated_duration && (
            <span className="inline-flex items-center gap-1 transition-colors duration-200 group-hover:text-zinc-700 dark:group-hover:text-zinc-300">
              <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {course.estimated_duration}
            </span>
          )}
          <span className="text-zinc-300 dark:text-zinc-600">·</span>
          {course.difficulty_level && (
            <span className="inline-flex items-center gap-1 capitalize transition-colors duration-200 group-hover:text-zinc-700 dark:group-hover:text-zinc-300">
              <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                {course.difficulty_level}
              </span>
          )}
          <span className="text-zinc-300 dark:text-zinc-600">·</span>
          {course.instructor_name && (
            <span className="inline-flex items-center gap-1 truncate min-w-0 max-w-[140px] sm:max-w-[200px] transition-colors duration-200 group-hover:text-zinc-700 dark:group-hover:text-zinc-300">
              <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="truncate">{course.instructor_name}</span>
            </span>
          )}
        </div>

        {/* Description */}
        <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
          {course.description || 'No description available'}
        </p>

        {/* Condensed cohort/enrollment info — wraps on small screens */}
        {windows.length > 0 && primaryWindow && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] sm:text-[11px] text-zinc-500 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1 min-w-0 max-w-[50%] sm:max-w-none transition-colors duration-200 group-hover:text-zinc-700 dark:group-hover:text-zinc-300">
              <StatusDot status={cohortStatus || 'closed'} className="!w-1.5 !h-1.5 shrink-0" />
              <span className="truncate">{cohortLabel}</span>
            </span>
            {deadline && cohortStatus === 'open' && (
              <span className="inline-flex items-center gap-1 shrink-0 transition-colors duration-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {formatDate(deadline)}
              </span>
            )}
            {capacity && (
              <span className="inline-flex items-center gap-1 shrink-0 transition-colors duration-200 group-hover:text-zinc-700 dark:group-hover:text-zinc-300">
                <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {enrolled}/{capacity}
              </span>
            )}
          </div>
        )}

        {/* Payment info */}
        <div className="mt-auto pt-1.5 sm:pt-2">
          <PaymentInfoBlock course={course} window={primaryWindow} />
        </div>
      </div>

      {/* Footer actions */}
      <div className="px-3.5 sm:px-4 pb-3.5 sm:pb-4 pt-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/courses/${course.id}`}
            className="shrink-0 relative text-[11px] sm:text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 font-medium transition-all duration-200 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-px after:bg-current hover:after:w-full after:transition-all after:duration-300"
          >
            Details
          </Link>
          <Link
            href={`/courses/${course.id}/apply`}
            className={`group/btn flex-1 min-w-0 px-2.5 sm:px-3 py-2.5 font-semibold rounded-lg transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-sky-500/20 text-[11px] sm:text-xs text-center flex items-center justify-center gap-1 ${applyColors} active:scale-[0.97] sm:hover:scale-[1.02]`}
          >
            <span className="truncate">{getApplyLabel(course, primaryWindow)}</span>
            <svg 
              className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 transition-transform duration-300 group-hover/btn:translate-x-0.5" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>
      

    </div>
  );
};
