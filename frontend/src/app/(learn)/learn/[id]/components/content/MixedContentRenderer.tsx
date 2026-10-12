"use client";

import React, { useMemo, useCallback } from "react";
import { InteractiveStepThroughViewer } from "../InteractiveStepThroughViewer";
import { TextContentRenderer } from "./TextContentRenderer";
import { VideoPlayer } from "./VideoPlayer";
import type { StepSection } from "../InteractiveStepThroughViewer";

// ── Types ──────────────────────────────────────────────────────────
interface MixedSection {
  type: "text" | "video" | "pdf" | "image" | "heading" | string;
  content?: string;
  url?: string;
  title?: string;
  level?: number;
  alt?: string;
}

/** Section types the player can render natively. Anything else is preserved
 *  and surfaced to the learner instead of being silently dropped. */
const RENDERABLE_SECTION_TYPES = ["text", "video", "pdf", "image", "heading"];

export interface MixedContentRendererProps {
  lesson: {
    title: string;
    content_data: string;
    content_type: "text" | "video" | "pdf" | "mixed";
  };
  onMixedContentVideoProgress?: (idx: number, progress: number) => void;
  onMixedContentVideoComplete?: (idx: number) => void;
  onSectionProgress?: (viewed: number, total: number) => void;
  hasQuiz?: boolean;
  hasAssignments?: boolean;
  isLessonCompleted?: boolean;
  onSwitchToQuiz?: () => void;
  onSwitchToAssignment?: () => void;
  onGoToNextLesson?: () => void;
  hasNextLesson?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────
function parseMixedContent(raw: string): MixedSection[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const validSections = parsed.filter((section): section is MixedSection => {
        if (!section || typeof section !== "object") return false;
        const typedSection = section as MixedSection;
        return typeof typedSection.type === "string" &&
          Boolean(typedSection.content || typedSection.url || typedSection.title);
      });
      if (validSections.length > 0) return validSections;
    }
  } catch {}
  // Fallback: try line-by-line parsing
  const lines = raw.split("\n");
  const sections: MixedSection[] = [];
  let currentText = "";

  const flushText = () => {
    if (currentText.trim()) {
      sections.push({ type: "text", content: currentText.trim() });
      currentText = "";
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^https?:\/\/.+\.(mp4|webm|mov|ogg)/i.test(trimmed)) {
      flushText();
      sections.push({ type: "video", url: trimmed });
    } else if (/^https?:\/\/(www\.)?(youtube|youtu\.be|vimeo)/i.test(trimmed)) {
      flushText();
      sections.push({ type: "video", url: trimmed });
    } else if (/^https?:\/\/drive\.google\.com\/file\/d\//i.test(trimmed)) {
      flushText();
      sections.push({ type: "pdf", url: trimmed });
    } else if (/^!\[.*\]\(.*\)/i.test(trimmed)) {
      flushText();
      const match = trimmed.match(/!\[(.*?)\]\((.*?)\)/);
      if (match) sections.push({ type: "image", alt: match[1], url: match[2] });
    } else if (/^#{1,6}\s/.test(trimmed)) {
      flushText();
      const level = trimmed.match(/^#+/)?.[0].length || 1;
      sections.push({ type: "heading", content: trimmed.replace(/^#+\s*/, ""), level });
    } else {
      currentText += line + "\n";
    }
  }
  flushText();
  return sections;
}

function parseTextIntoSections(text: string): StepSection[] {
  const lines = text.split("\n");
  const sections: StepSection[] = [];
  let currentBuffer = "";
  let sectionIdx = 0;

  const flush = () => {
    if (currentBuffer.trim()) {
      sections.push({
        id: `section-${sectionIdx++}`,
        type: "text",
        content: currentBuffer.trim(),
        heading: `Section ${sectionIdx}`,
      });
      currentBuffer = "";
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^#{1,6}\s/.test(trimmed) || /^\*\*[^*]+\*\*$/.test(trimmed)) {
      flush();
      const isBold = /^\*\*[^*]+\*\*$/.test(trimmed);
      const heading = isBold ? trimmed.replace(/\*\*/g, "") : trimmed.replace(/^#+\s*/, "");
      sections.push({
        id: `section-${sectionIdx++}`,
        type: "heading",
        heading: heading || `Section ${sectionIdx}`,
        content: trimmed,
      });
    } else {
      currentBuffer += line + "\n";
    }
  }
  flush();

  // Ensure first section has a friendly heading
  if (sections.length > 0 && !sections[0].heading) {
    sections[0] = { ...sections[0], heading: "Introduction" };
  }

  return sections;
}

// ── Component ──────────────────────────────────────────────────────
export const MixedContentRenderer: React.FC<MixedContentRendererProps> = ({
  lesson, onMixedContentVideoProgress, onMixedContentVideoComplete,
  onSectionProgress, isLessonCompleted, hasQuiz, hasAssignments,
  onSwitchToQuiz, onSwitchToAssignment, onGoToNextLesson, hasNextLesson,
}) => {
  // Step sections derived from content
  const mixedStepSections = useMemo((): StepSection[] => {
    if (lesson.content_type === "text") {
      const textSections = parseTextIntoSections(lesson.content_data);
      return textSections.length > 0
        ? textSections
        : [{
            id: "empty-content",
            type: "text",
            heading: "Content unavailable",
            content: "This lesson does not have readable content yet. Please contact your instructor.",
          }];
    }

    const mixed = parseMixedContent(lesson.content_data);
    const sections: StepSection[] = [];
    let textIdx = 0;

    mixed.forEach((s, i) => {
      if (s.type === "heading") {
        // The step viewer already renders `heading` as an <h3>, so the body is
        // intentionally empty — otherwise the same text shows up twice.
        sections.push({
          id: `step-${i}`,
          type: "heading",
          heading: s.title || s.content || `Section ${i + 1}`,
          content: "",
          metadata: { originalIndex: i, originalSection: s },
        });
        return;
      }

      if (s.type === "text") {
        const textSections = parseTextIntoSections(s.content || s.title || "");
        textSections.forEach((ts, j) => {
          const genericHeading = /^Section \d+$/.test(ts.heading || "");
          sections.push({
            ...ts,
            id: `step-${i}-${textIdx++}`,
            // Instructor-provided titles win over the auto-generated
            // "Section N" labels, including for the first parsed chunk.
            heading:
              (j === 0 && s.title) || (!genericHeading && ts.heading) || s.title || ts.heading || `Section ${i + 1}`,
            metadata: { originalIndex: i, originalSection: s },
          });
        });
        return;
      }

      if (!RENDERABLE_SECTION_TYPES.includes(s.type)) {
        // Unknown content type: never drop the section silently — show what
        // we have and tell the learner the format isn't supported yet.
        const detail = [
          `This lesson contains a "${s.type}" section, which this player can't display yet.`,
          s.content ? s.content : "",
        ]
          .filter(Boolean)
          .join("\n\n");
        sections.push({
          id: `step-${i}`,
          type: "text",
          heading: s.title || `Unsupported section (${s.type})`,
          content: detail,
          url: s.url,
          metadata: { originalIndex: i, originalSection: s },
        });
        return;
      }

      const heading =
        s.title ||
        (s.type === "video" ? "Video" : s.type === "pdf" ? "Document" : s.type === "image" ? "Image" : `Step ${i + 1}`);
      sections.push({
        id: `step-${i}`,
        type: s.type as StepSection["type"],
        heading,
        content: s.content || s.url,
        url: s.url,
        alt: s.alt,
        metadata: { originalIndex: i, originalSection: s },
      });
    });

    return sections.length > 0
      ? sections
      : [{
          id: "empty-content",
          type: "text",
          heading: "Content unavailable",
          content: "This lesson does not have readable content yet. Please contact your instructor.",
        }];
  }, [lesson.content_data, lesson.content_type]);

  // Last step button
  const lastStepButton = useMemo(() => {
    if (isLessonCompleted) {
      if (!hasNextLesson || !onGoToNextLesson) return null;
      return (
        <button type="button" onClick={onGoToNextLesson}
          className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all" >
          Next Lesson <span aria-hidden="true">&rarr;</span>
        </button >
      );
    }
    if (hasQuiz) {
      return (
        <button type="button" onClick={onSwitchToQuiz}
          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all" >
          Continue to Quiz <span aria-hidden="true">&rarr;</span>
        </button >
      );
    }
    if (hasAssignments) {
      return (
        <button type="button" onClick={onSwitchToAssignment}
          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all" >
          Continue to Assignment <span aria-hidden="true">&rarr;</span>
        </button >
      );
    }
    // Requirements still outstanding and no CTA to satisfy them: the parent
    // owns navigation (and explains why the next lesson is locked).
    return null;
  }, [hasQuiz, hasAssignments, isLessonCompleted, onSwitchToQuiz, onSwitchToAssignment, onGoToNextLesson, hasNextLesson]);

  const renderSection = useCallback(
    (section: StepSection, index: number, isActive: boolean) => {
      const meta = section.metadata as { originalSection?: MixedSection } | undefined;
      const originalSection = meta?.originalSection;

      // Headings are drawn by the step viewer itself (as an <h3>).
      if (section.type === "heading") return null;

      if (originalSection?.type === "video") {
        const meta = section.metadata as { originalIndex?: number } | undefined;
        return (
          <div className="video-section-wrapper" data-active={isActive}>
            <VideoPlayer
              videoUrl={section.url || section.content || ""}
              lessonTitle={lesson.title}
              isMainVideo={false}
              // Key by the ORIGINAL mixed-content index (not the step index)
              // so the server can map coverage back to video sections.
              mixedContentIndex={meta?.originalIndex ?? index}
              onMixedContentVideoProgress={onMixedContentVideoProgress}
              onMixedContentVideoComplete={onMixedContentVideoComplete}
            />
          </div>
        );
      }

      if (originalSection?.type === "image") {
        return (
          <div className="flex justify-center my-4">
            <img src={section.url || ""} alt={section.alt || ""} className="rounded-lg shadow-lg max-w-full h-auto" />
          </div>
        );
      }

      if (originalSection?.type === "pdf") {
        const url = section.url || section.content || "";
        const driveMatch = url.match(/\/file\/d\/([^/]+)/);
        const previewUrl = driveMatch
          ? `https://drive.google.com/file/d/${driveMatch[1]}/preview`
          : url;
        return (
          <div className="space-y-3">
            <iframe
              src={previewUrl}
              title={section.heading || "Lesson document"}
              className="w-full h-[min(70vh,42rem)] rounded-lg border border-gray-700 bg-gray-900"
            />
            <a href={url} target="_blank" rel="noreferrer" className="text-sm text-blue-300 underline">
              Open document in a new tab
            </a>
          </div>
        );
      }

      return <TextContentRenderer content={section.content || ""} showFontControls={false} />;
    },
    [lesson.title, onMixedContentVideoProgress, onMixedContentVideoComplete]
  );

  const handleAllSectionsViewed = useCallback(() => {
    onSectionProgress?.(mixedStepSections.length, mixedStepSections.length);
  }, [mixedStepSections.length, onSectionProgress]);

  return (
    <InteractiveStepThroughViewer
      sections={mixedStepSections}
      totalSteps={mixedStepSections.length}
      renderSection={renderSection}
      onAllSectionsViewed={handleAllSectionsViewed}
      onViewedSectionsUpdate={onSectionProgress}
      lastStepButton={lastStepButton}
    />
  );
};

// Re-export for convenience
export { parseTextIntoSections, parseMixedContent };
