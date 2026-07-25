"use client";

import React, { useMemo, useCallback } from "react";
import { InteractiveStepThroughViewer } from "../InteractiveStepThroughViewer";
import { TextContentRenderer } from "./TextContentRenderer";
import { VideoPlayer } from "./VideoPlayer";
import type { StepSection } from "../InteractiveStepThroughViewer";

// ── Types ──────────────────────────────────────────────────────────
interface MixedSection {
  type: "text" | "video" | "pdf" | "image" | "heading";
  content?: string;
  url?: string;
  title?: string;
  level?: number;
  alt?: string;
}

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
}

// ── Helpers ────────────────────────────────────────────────────────
function parseMixedContent(raw: string): MixedSection[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
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
  onSwitchToQuiz, onSwitchToAssignment, onGoToNextLesson,
}) => {
  // Step sections derived from content
  const mixedStepSections = useMemo((): StepSection[] => {
    if (lesson.content_type === "text") {
      return parseTextIntoSections(lesson.content_data);
    }

    const mixed = parseMixedContent(lesson.content_data);
    const sections: StepSection[] = [];
    let textIdx = 0;

    mixed.forEach((s, i) => {
      if (s.type === "text" || s.type === "heading") {
        const textSections = parseTextIntoSections(s.content || s.title || "");
        textSections.forEach((ts) => {
          sections.push({
            ...ts,
            id: `step-${i}-${textIdx++}`,
            heading: ts.heading || s.title || `Section ${i + 1}`,
            metadata: { originalIndex: i },
          });
        });
      } else {
        const heading =
          s.title ||
          (s.type === "video" ? "Video" : s.type === "pdf" ? "Document" : s.type === "image" ? "Image" : `Step ${i + 1}`);
        sections.push({
          id: `step-${i}`,
          type: s.type === "image" ? "image" : s.type === "pdf" ? "text" : s.type as StepSection["type"],
          heading,
          content: s.content || s.url,
          url: s.url,
          alt: s.alt,
          metadata: { originalIndex: i, originalSection: s },
        });
      }
    });

    return sections;
  }, [lesson.content_data, lesson.content_type]);

  // Last step button
  const lastStepButton = useMemo(() => {
    if (isLessonCompleted) return null;
    if (hasQuiz) {
      return (
        <button onClick={onSwitchToQuiz}
          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all" >
          Continue to Quiz →
        </button >
      );
    }
    if (hasAssignments) {
      return (
        <button onClick={onSwitchToAssignment}
          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all" >
          Continue to Assignment →
        </button >
      );
    }
    return (
      <button onClick={onGoToNextLesson}
        className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all" >
        Next Lesson →
      </button >
    );
  }, [hasQuiz, hasAssignments, isLessonCompleted, onSwitchToQuiz, onSwitchToAssignment, onGoToNextLesson]);

  const renderSection = useCallback(
    (section: StepSection, index: number, isActive: boolean) => {
      const meta = section.metadata as { originalSection?: MixedSection } | undefined;
      const originalSection = meta?.originalSection;

      if (originalSection?.type === "video") {
        return (
          <div className="video-section-wrapper" data-active={isActive}>
            <VideoPlayer
              videoUrl={section.url || section.content || ""}
              lessonTitle={lesson.title}
              isMainVideo={false}
              mixedContentIndex={index}
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

      return <TextContentRenderer content={section.content || ""} showFontControls={false} />;
    },
    [lesson.title, onMixedContentVideoProgress, onMixedContentVideoComplete]
  );

  const handleStepChange = useCallback(
    (stepIndex: number, total: number) => {
      onSectionProgress?.(stepIndex + 1, total);
    },
    [onSectionProgress]
  );

  const handleAllSectionsViewed = useCallback(() => {
    onSectionProgress?.(mixedStepSections.length, mixedStepSections.length);
  }, [mixedStepSections.length, onSectionProgress]);

  return (
    <InteractiveStepThroughViewer
      sections={mixedStepSections}
      totalSteps={mixedStepSections.length}
      renderSection={renderSection}
      onStepChange={handleStepChange}
      onAllSectionsViewed={handleAllSectionsViewed}
      onViewedSectionsUpdate={(viewed, total) => onSectionProgress?.(viewed, total)}
      lastStepButton={!isLessonCompleted ? lastStepButton : undefined}
    />
  );
};

// Re-export for convenience
export { parseTextIntoSections, parseMixedContent };
