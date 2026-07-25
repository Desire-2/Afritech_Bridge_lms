"use client";

import { useEffect, useRef, useCallback } from "react";
import ContentAssignmentService from "@/services/contentAssignmentApi";
import type { ContentAssignment } from "@/services/contentAssignmentApi";

interface UseAssignmentPollingOptions {
  currentLessonId: number | undefined;
  lessonAssignments: ContentAssignment[];
  isLessonCompleted: boolean;
  onAssignmentsUpdate: (assignments: ContentAssignment[]) => void;
  enabled?: boolean;
}

const POLL_INTERVAL_MS = 30000;

export function useAssignmentPolling({
  currentLessonId,
  lessonAssignments,
  isLessonCompleted,
  onAssignmentsUpdate,
  enabled = true,
}: UseAssignmentPollingOptions) {
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastStatusRef = useRef("");

  const buildStatusKey = useCallback((assignments: ContentAssignment[]) => {
    return assignments
      .map(
        (a: any) =>
          `${a.id}:${a.submission_status?.score ?? "null"}:${a.submission_status?.status ?? "null"}`
      )
      .join("|");
  }, []);

  useEffect(() => {
    if (
      !enabled ||
      !currentLessonId ||
      !lessonAssignments.length ||
      isLessonCompleted
    ) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    // Only poll if at least one assignment is submitted but ungraded
    const hasUngraded = lessonAssignments.some(
      (a: any) =>
        a.submission_status?.submitted === true &&
        a.submission_status?.status !== "graded" &&
        (a.submission_status?.score === undefined ||
          a.submission_status?.score === null)
    );

    lastStatusRef.current = buildStatusKey(lessonAssignments);

    if (!hasUngraded) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    pollRef.current = setInterval(async () => {
      try {
        const response =
          await ContentAssignmentService.getLessonAssignments(currentLessonId);
        const freshAssignments = response.assignments || [];
        const newStatusKey = buildStatusKey(freshAssignments);

        if (newStatusKey !== lastStatusRef.current) {
          lastStatusRef.current = newStatusKey;
          onAssignmentsUpdate(freshAssignments);
        }
      } catch (error) {
        console.warn("⚠️ Failed to poll assignment grades:", error);
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [
    enabled,
    currentLessonId,
    lessonAssignments.length,
    isLessonCompleted,
    buildStatusKey,
    onAssignmentsUpdate,
  ]);
}
