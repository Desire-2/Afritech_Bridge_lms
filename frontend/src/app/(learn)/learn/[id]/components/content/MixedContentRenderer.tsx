"use client";

import React, { useMemo, useCallback } from "react";
import { InteractiveStepThroughViewer, type StepSection } from "../InteractiveStepThroughViewer";
import { TextContentRenderer } from "./TextContentRenderer";
import { VideoPlayer } from "./VideoPlayer";
import {
  lessonContentToStepSections,
  stepVideoWatchPct as computeStepVideoWatchPct,
  videoCoverageIndexFor,
  type LessonContentBlock,
  type NormalizedLessonContent,
} from "@/lib/lesson-content";

// ── Types ──────────────────────────────────────────────────────────

export interface MixedContentRendererProps {
  lesson: {
    id?: string;
    title: string;
    content_data: string;
    content_type: "text" | "video" | "pdf" | "mixed";
  };
  onMixedContentVideoProgress?: (idx: number, progress: number) => void;
  onMixedContentVideoComplete?: (idx: number) => void;
  /** Reported as (viewed, total) whenever the set of viewed sections changes. */
  onSectionProgress?: (viewed: number, total: number) => void;
  /** Per-coverage-index watch percentage used to gate video-step viewing. */
  mixedContentVideoProgress?: Record<number, number>;
  hasQuiz?: boolean;
  hasAssignments?: boolean;
  isLessonCompleted?: boolean;
  onSwitchToQuiz?: () => void;
  onSwitchToAssignment?: () => void;
  onGoToNextLesson?: () => void;
  hasNextLesson?: boolean;
}

// ── Component ──────────────────────────────────────────────────────
export const MixedContentRenderer: React.FC<MixedContentRendererProps> = ({
  lesson, onMixedContentVideoProgress, onMixedContentVideoComplete,
  onSectionProgress, mixedContentVideoProgress,
  isLessonCompleted, hasQuiz, hasAssignments,
  onSwitchToQuiz, onSwitchToAssignment, onGoToNextLesson, hasNextLesson,
}) => {
  // One shared parse: instructor editor, preview and player all derive the
  // same sections from the same contract (see src/lib/lesson-content.ts).
  const { normalized, steps } = useMemo(
    () => lessonContentToStepSections(lesson.content_data, lesson.content_type, lesson.title),
    [lesson.content_data, lesson.content_type, lesson.title]
  );

  const stepSections = useMemo((): StepSection[] => {
    if (steps.length > 0) return steps;
    return [{
      id: "empty-content",
      type: "text",
      heading: "Content unavailable",
      content: "This lesson does not have readable content yet. Please contact your instructor.",
    }];
  }, [steps]);

  // Per-step video watch gate: null for video-less steps, otherwise the
  // lowest coverage among the step's videos. Fed to the viewer so a video
  // step is only marked viewed after ≥90% was actually watched.
  const stepVideoWatchPct = useMemo(
    () => computeStepVideoWatchPct(stepSections, normalized, mixedContentVideoProgress),
    [stepSections, normalized, mixedContentVideoProgress]
  );

  // Last step button
  const lastStepButton = useMemo(() => {
    if (isLessonCompleted) {
      if (!hasNextLesson || !onGoToNextLesson) return null;
      return (
        <button type="button" onClick={onGoToNextLesson}
          className="inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-md bg-blue-600 px-4 text-sm font-medium text-white shadow-sm shadow-blue-950/40 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" >
          Next Lesson <span aria-hidden="true">&rarr;</span>
        </button >
      );
    }
    if (hasQuiz) {
      return (
        <button type="button" onClick={onSwitchToQuiz}
          className="inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-md bg-blue-600 px-4 text-sm font-medium text-white shadow-sm shadow-blue-950/40 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" >
          Continue to Quiz <span aria-hidden="true">&rarr;</span>
        </button >
      );
    }
    if (hasAssignments) {
      return (
        <button type="button" onClick={onSwitchToAssignment}
          className="inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-md bg-blue-600 px-4 text-sm font-medium text-white shadow-sm shadow-blue-950/40 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" >
          Continue to Assignment <span aria-hidden="true">&rarr;</span>
        </button >
      );
    }
    // Requirements still outstanding and no CTA to satisfy them: the parent
    // owns navigation (and explains why the next lesson is locked).
    return null;
  }, [hasQuiz, hasAssignments, isLessonCompleted, onSwitchToQuiz, onSwitchToAssignment, onGoToNextLesson, hasNextLesson]);

  const renderBlock = useCallback(
    (block: LessonContentBlock, sectionIndex: number, blockIndex: number) => {
      const key = `${sectionIndex}:${blockIndex}`;
      switch (block.type) {
        case "video": {
          // Key progress by the ORIGINAL flat coverage index so the server can
          // map coverage back to the legacy index space for old and new content.
          const coverageIndex = videoCoverageIndexFor(normalized.sections, sectionIndex, blockIndex);
          return (
            <VideoPlayer
              key={key}
              videoUrl={block.url || block.content || ""}
              lessonTitle={lesson.title}
              isMainVideo={false}
              mixedContentIndex={coverageIndex ?? blockIndex}
              onMixedContentVideoProgress={onMixedContentVideoProgress}
              onMixedContentVideoComplete={onMixedContentVideoComplete}
            />
          );
        }
        case "image":
          return (
            <div key={key} className="flex justify-center my-4">
              <img src={block.url || ""} alt={block.alt || block.title || ""} className="rounded-lg shadow-lg max-w-full h-auto" />
            </div>
          );
        case "pdf": {
          const url = block.url || block.content || "";
          const driveMatch = url.match(/\/file\/d\/([^/]+)/);
          const previewUrl = driveMatch
            ? `https://drive.google.com/file/d/${driveMatch[1]}/preview`
            : url;
          return (
            <div key={key} className="space-y-3">
              <iframe
                src={previewUrl}
                title={block.title || "Lesson document"}
                className="w-full h-[min(70vh,42rem)] rounded-lg border border-gray-700 bg-gray-900"
              />
              <a href={url} target="_blank" rel="noreferrer" className="text-sm text-blue-300 underline">
                Open document in a new tab
              </a>
            </div>
          );
        }
        case "heading":
          // Section titles are drawn by the step viewer itself (as an <h3>).
          return null;
        case "text":
        case "code":
          return <TextContentRenderer key={key} content={block.content || ""} showFontControls={false} />;
        default: {
          // Unsupported block type: never drop it silently — surface what we
          // have so the learner can tell the instructor the format is missing.
          const detail = [
            `This lesson contains a "${block.type}" block, which this player can't display yet.`,
            block.content ? String(block.content) : "",
            block.url ? String(block.url) : "",
          ]
            .filter(Boolean)
            .join("\n\n");
          return <TextContentRenderer key={key} content={detail} showFontControls={false} />;
        }
      }
    },
    [lesson.title, normalized.sections, onMixedContentVideoProgress, onMixedContentVideoComplete]
  );

  const renderSection = useCallback(
    (section: StepSection, index: number, _isActive: boolean) => {
      // Steps may be a slice of a section (nested headers split it into
      // groups), so block positions must map back to the original section —
      // that is the address space of the video coverage index.
      const metadata = section.metadata as
        | { sectionIndex?: number; blockIndices?: number[] }
        | undefined;
      const sectionIndex = metadata?.sectionIndex ?? index;
      const blockIndices = metadata?.blockIndices;
      const blocks = section.blocks as LessonContentBlock[] | undefined;
      if (blocks && blocks.length > 0) {
        return (
          <div className="space-y-4">
            {blocks.map((block, blockIndex) =>
              renderBlock(block, sectionIndex, blockIndices?.[blockIndex] ?? blockIndex)
            )}
          </div>
        );
      }
      // Single-block steps carry the block flattened onto the step itself.
      return renderBlock(
        { type: section.type, content: section.content, url: section.url, alt: section.alt },
        sectionIndex,
        blockIndices?.[0] ?? 0
      );
    },
    [renderBlock]
  );

  return (
    <InteractiveStepThroughViewer
      sections={stepSections}
      totalSteps={stepSections.length}
      lessonKey={lesson.id}
      renderSection={renderSection}
      stepVideoWatchPct={stepVideoWatchPct}
      onViewedSectionsUpdate={onSectionProgress}
      lastStepButton={lastStepButton}
    />
  );
};

export default MixedContentRenderer;
