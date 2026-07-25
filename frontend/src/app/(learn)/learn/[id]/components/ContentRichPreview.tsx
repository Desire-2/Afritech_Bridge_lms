"use client";

import React, { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CollapsibleCard } from "./CollapsibleCard";
import { VideoPlayer } from "./content/VideoPlayer";
import { TextContentRenderer } from "./content/TextContentRenderer";
import { MixedContentRenderer } from "./content/MixedContentRenderer";
import {
  BookOpen, Video, FileText, Clock, ChevronDown, Maximize2, AlertCircle, Loader2
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// ── Props ──────────────────────────────────────────────────────────
interface LessonShape {
  title: string;
  content_type: "text" | "video" | "pdf" | "mixed";
  content_data: string;
  description?: string;
  learning_objectives?: string;
  duration_minutes?: number;
}

export interface ContentRichPreviewProps {
  lesson: LessonShape;
  onVideoComplete?: () => void;
  onVideoProgress?: (progress: number, currentTime?: number, duration?: number) => void;
  onMixedContentVideoProgress?: (videoIndex: number, progress: number) => void;
  onMixedContentVideoComplete?: (videoIndex: number) => void;
  onSectionProgress?: (viewedSections: number, totalSections: number) => void;
  hasQuiz?: boolean;
  hasAssignments?: boolean;
  isLessonCompleted?: boolean;
  onSwitchToQuiz?: () => void;
  onSwitchToAssignment?: () => void;
  onGoToNextLesson?: () => void;
}

// ── PDF Viewer ────────────────────────────────────────────────────
function renderPdfContent(url: string) {
  // Extract Google Drive file ID or use URL directly
  const driveMatch = url.match(/\/file\/d\/([^/]+)/);
  const pdfUrl = driveMatch
    ? `https://drive.google.com/file/d/${driveMatch[1]}/preview`
    : url;

  return (
    <div className="space-y-4">
      <div className="relative w-full rounded-lg overflow-hidden bg-gray-900 shadow-xl" style={{ height: "75vh" }}>
        <iframe
          src={pdfUrl}
          className="absolute inset-0 w-full h-full"
          allow="autoplay"
          title="PDF Viewer"
        />
      </div>
      <Alert className="bg-blue-900/20 border-blue-700">
        <AlertCircle className="h-4 w-4 text-blue-400" />
        <AlertDescription className="text-blue-200 text-sm">
          Use the download button in the PDF viewer to save a copy for offline reading.
        </AlertDescription>
      </Alert>
    </div>
  );
}

// ── Content Type Badge ─────────────────────────────────────────────
const typeConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  text: { icon: <BookOpen className="h-3 w-3" />, label: "Text", color: "bg-blue-600" },
  video: { icon: <Video className="h-3 w-3" />, label: "Video", color: "bg-red-600" },
  pdf: { icon: <FileText className="h-3 w-3" />, label: "PDF", color: "bg-orange-600" },
  mixed: { icon: <BookOpen className="h-3 w-3" />, label: "Mixed Content", color: "bg-purple-600" },
};

// ── Main Component ─────────────────────────────────────────────────
export const ContentRichPreview: React.FC<ContentRichPreviewProps> = ({
  lesson, onVideoComplete, onVideoProgress, onMixedContentVideoProgress,
  onMixedContentVideoComplete, onSectionProgress, hasQuiz, hasAssignments,
  isLessonCompleted, onSwitchToQuiz, onSwitchToAssignment, onGoToNextLesson,
}) => {
  // Debug log lesson data
  useEffect(() => {
    console.log("📖 Lesson loaded:", lesson.title, "type:", lesson.content_type);
  }, [lesson]);

  // Derived state
  const cfg = typeConfig[lesson.content_type] || typeConfig.text;

  // ── Render by type ─────────────────────────────────────────────
  const renderContent = () => {
    switch (lesson.content_type) {
      case "video":
        return (
          <VideoPlayer
            videoUrl={lesson.content_data}
            lessonTitle={lesson.title}
            isMainVideo={true}
            onComplete={onVideoComplete}
            onProgress={onVideoProgress}
          />
        );

      case "pdf":
        return renderPdfContent(lesson.content_data);

      case "text":
      case "mixed":
        return (
          <MixedContentRenderer
            lesson={lesson}
            onMixedContentVideoProgress={onMixedContentVideoProgress}
            onMixedContentVideoComplete={onMixedContentVideoComplete}
            onSectionProgress={onSectionProgress}
            hasQuiz={hasQuiz}
            hasAssignments={hasAssignments}
            isLessonCompleted={isLessonCompleted}
            onSwitchToQuiz={onSwitchToQuiz}
            onSwitchToAssignment={onSwitchToAssignment}
            onGoToNextLesson={onGoToNextLesson}
          />
        );

      default:
        return (
          <Alert className="bg-yellow-900/20 border-yellow-700">
            <AlertCircle className="h-4 w-4 text-yellow-400" />
            <AlertDescription className="text-yellow-200">
              Unknown content type: {lesson.content_type}
            </AlertDescription>
          </Alert>
        );
    }
  };

  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto">
      {/* Keyboard shortcut hint for video lessons */}
      {lesson.content_type === "video" && (
        <div className="hidden md:flex items-center gap-2 text-xs text-gray-500 bg-gray-800/50 rounded-lg px-3 py-2">
          <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-[10px] font-mono">Space</kbd> Play/Pause
          <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-[10px] font-mono ml-2">←</kbd>
          <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-[10px] font-mono">→</kbd> Seek
          <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-[10px] font-mono ml-2">F</kbd> Fullscreen
        </div>
      )}

      {/* Mobile tip */}
      {lesson.content_type === "video" && (
        <div className="md:hidden flex items-center gap-2 text-xs text-gray-500 bg-gray-800/50 rounded-lg px-3 py-2">
          <Maximize2 className="h-3 w-3" />
          Tap the fullscreen button for better viewing
        </div>
      )}

      {/* Collapsible lesson header */}
      <CollapsibleCard defaultOpen={true} title={lesson.title}>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge className={`${cfg.color} text-white`}>
              {cfg.icon}
              <span className="ml-1">{cfg.label}</span>
            </Badge>
            {lesson.duration_minutes && (
              <span className="flex items-center text-sm text-gray-400">
                <Clock className="h-3.5 w-3.5 mr-1" />
                {lesson.duration_minutes} min
              </span>
            )}
            <Badge variant="outline" className="border-gray-700 text-gray-400 text-xs">
              {lesson.content_type.toUpperCase()}
            </Badge>
          </div>

          {lesson.description && (
            <p className="text-sm text-gray-400 leading-relaxed">{lesson.description}</p>
          )}

          {lesson.learning_objectives && (
            <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-4">
              <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider mb-2">Learning Objectives</p>
              <TextContentRenderer content={lesson.learning_objectives} showFontControls={false} />
            </div>
          )}
        </div>
      </CollapsibleCard>

      {/* Main content area */}
      <div className="bg-gray-800/30 rounded-xl p-4 sm:p-6 md:p-8 shadow-inner">
        {renderContent()}
      </div>
    </div>
  );
};
