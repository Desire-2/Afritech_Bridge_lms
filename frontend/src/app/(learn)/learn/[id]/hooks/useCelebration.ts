"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { StudentApiService } from "@/services/studentApi";

export function useCelebration(courseId: number) {
  const [showCelebration, setShowCelebration] = useState(false);
  const [newBadgesEarned, setNewBadgesEarned] = useState<string[]>([]);
  const [showCertificateNotification, setShowCertificateNotification] =
    useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [completionInFlight, setCompletionInFlight] = useState<number | null>(
    null
  );

  // Moved inside hook to avoid module-level shared mutable state
  const autoAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
      }
    };
  }, []);

  const triggerCelebration = useCallback(
    (badgeNames?: string[]) => {
      setShowCelebration(true);
      if (badgeNames?.length) {
        setNewBadgesEarned((prev) => [...prev, ...badgeNames]);
      }
    },
    []
  );

  const closeCelebration = useCallback(() => {
    setShowCelebration(false);
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
  }, []);

  const checkBadgeEligibility = useCallback(async () => {
    try {
      const progressData = await StudentApiService.getCourseProgress(courseId);
      const completedLessons = progressData.lessons_completed || 0;

      if (completedLessons > 0 && completedLessons % 3 === 0) {
        const newBadges = await StudentApiService.checkEarnedBadges(courseId);
        if (newBadges.length > 0) {
          setNewBadgesEarned((prev) => [
            ...prev,
            ...newBadges.map((b: any) => b.name),
          ]);
        }
      }
    } catch (error) {
      console.error("Error checking badge eligibility:", error);
    }
  }, [courseId]);

  const markLessonCompleted = useCallback((lessonId: number) => {
    setCompletionInFlight(lessonId);
  }, []);

  const clearCompletionInFlight = useCallback(() => {
    setCompletionInFlight(null);
  }, []);

  return {
    showCelebration,
    setShowCelebration,
    newBadgesEarned,
    setNewBadgesEarned,
    showCertificateNotification,
    setShowCertificateNotification,
    isBookmarked,
    setIsBookmarked,
    completionInFlight,
    autoAdvanceTimeoutRef,
    triggerCelebration,
    closeCelebration,
    checkBadgeEligibility,
    markLessonCompleted,
    clearCompletionInFlight,
  };
}
