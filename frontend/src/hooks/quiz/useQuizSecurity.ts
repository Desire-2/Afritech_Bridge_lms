"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface QuizSecurityConfig {
  enabled?: boolean;
  maxViolations?: number;
  onViolation?: (count: number, max: number) => void;
  onMaxViolationsReached?: () => void;
  onTabSwitch?: () => void;
}

export function useQuizSecurity(config: QuizSecurityConfig = {}) {
  const {
    enabled = true,
    maxViolations = 3,
    onViolation,
    onMaxViolationsReached,
    onTabSwitch,
  } = config;

  const [violationCount, setViolationCount] = useState(0);
  const [maxReached, setMaxReached] = useState(false);
  const [isContentHidden, setIsContentHidden] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Refs for values used in closures
  const violationCountRef = useRef(0);
  const maxReachedRef = useRef(false);
  const gracePeriodRef = useRef(false);
  const contentHiddenRef = useRef(false);
  const enabledRef = useRef(enabled);

  // Keep refs in sync
  useEffect(() => { violationCountRef.current = violationCount; }, [violationCount]);
  useEffect(() => { maxReachedRef.current = maxReached; }, [maxReached]);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  const recordViolation = useCallback(
    (label: string, description: string) => {
      if (gracePeriodRef.current || !enabledRef.current || maxReachedRef.current) return;

      setViolationCount((prev) => {
        const newCount = prev + 1;
        violationCountRef.current = newCount;
        onViolation?.(newCount, maxViolations);

        if (newCount >= maxViolations) {
          setMaxReached(true);
          maxReachedRef.current = true;
          onMaxViolationsReached?.();
        }
        return newCount;
      });
    },
    [maxViolations, onViolation, onMaxViolationsReached]
  );

  const showContent = useCallback(() => {
    if (contentHiddenRef.current) {
      contentHiddenRef.current = false;
      setIsContentHidden(false);
    }
  }, []);

  const hideContent = useCallback(() => {
    if (!contentHiddenRef.current) {
      contentHiddenRef.current = true;
      setIsContentHidden(true);
    }
  }, []);

  const enterFullscreen = useCallback(() => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => setIsFullscreen(false));
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    setIsFullscreen(false);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // Set up all security listeners
  useEffect(() => {
    if (!enabled) return;

    // Grace period to avoid false positives after mounting
    gracePeriodRef.current = true;
    const graceTimer = setTimeout(() => {
      gracePeriodRef.current = false;
    }, 2000);

    // --- 1. Tab switching ---
    const handleVisibilityChange = () => {
      if (document.hidden) {
        hideContent();
        recordViolation("Tab Switch", "Switching tabs is not allowed.");
        onTabSwitch?.();
      } else {
        setTimeout(showContent, 600);
      }
    };

    // --- 2. Window blur/focus ---
    const handleBlur = () => {
      if (!document.hidden) {
        hideContent();
        recordViolation("Window Change", "Changing windows is not allowed.");
      }
    };
    const handleFocus = () => setTimeout(showContent, 600);

    // --- 3. Keyboard shortcuts ---
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen") {
        e.preventDefault();
        navigator.clipboard?.writeText?.("")?.catch(() => {});
        hideContent();
        setTimeout(showContent, 1500);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        return;
      }
      if (e.metaKey && e.shiftKey && ["3", "4", "5"].includes(e.key)) {
        e.preventDefault();
        hideContent();
        setTimeout(showContent, 1500);
        return;
      }
      if (
        (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "i") ||
        e.key === "F12"
      ) {
        e.preventDefault();
        return;
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "s"
      ) {
        e.preventDefault();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "u") {
        e.preventDefault();
        return;
      }
    };

    // PrintScreen keyup to clear clipboard
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen") {
        navigator.clipboard?.writeText?.("")?.catch(() => {});
      }
    };

    // --- 4. Clipboard prevention ---
    const handleCopy = (e: ClipboardEvent) => e.preventDefault();
    const handleCut = (e: ClipboardEvent) => e.preventDefault();

    // --- 5. Context menu ---
    const handleContextMenu = (e: Event) => e.preventDefault();

    // --- 6. Drag prevention ---
    const handleDragStart = (e: DragEvent) => e.preventDefault();

    // --- 7. Multi-touch detection ---
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 3) {
        hideContent();
        recordViolation("Multi-touch", "3+ finger gestures are not allowed.");
        setTimeout(showContent, 1500);
      }
    };

    // --- 8. Fullscreen change ---
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !gracePeriodRef.current && !maxReachedRef.current) {
        setIsFullscreen(false);
        recordViolation("Fullscreen Exit", "Exiting fullscreen is not allowed.");
        enterFullscreen();
      } else if (document.fullscreenElement) {
        setIsFullscreen(true);
      }
    };

    // --- 9. Print prevention ---
    const printStyle = document.createElement("style");
    printStyle.id = "quiz-print-block";
    printStyle.textContent = `
      @media print {
        body * { display: none !important; }
        body::after {
          content: 'Printing is not allowed during the quiz.';
          display: block !important;
          font-size: 24px;
          text-align: center;
          padding: 100px;
          color: red;
        }
      }
    `;
    document.head.appendChild(printStyle);

    const handleBeforePrint = () => hideContent();
    const handleAfterPrint = () => setTimeout(showContent, 1000);

    // --- 10. Screen capture API detection ---
    let displayMediaCleanup: (() => void) | null = null;
    if (typeof navigator !== "undefined" && navigator.mediaDevices) {
      const original = navigator.mediaDevices.getDisplayMedia;
      if (original) {
        navigator.mediaDevices.getDisplayMedia = async function (...args: any[]) {
          recordViolation(
            "Screen Capture",
            "Screen recording is not allowed."
          );
          throw new DOMException(
            "Screen capture not allowed during quiz",
            "NotAllowedError"
          );
        } as any;
        displayMediaCleanup = () => {
          navigator.mediaDevices.getDisplayMedia = original;
        };
      }
    }

    // --- 11. CSS selection protection ---
    document.body.style.userSelect = "none";
    (document.body.style as any).webkitUserSelect = "none";
    (document.body.style as any).webkitTouchCallout = "none";

    // Register all listeners
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("keyup", handleKeyUp, true);
    document.addEventListener("copy", handleCopy, true);
    document.addEventListener("cut", handleCut, true);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("dragstart", handleDragStart);
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);

    return () => {
      clearTimeout(graceTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("keyup", handleKeyUp, true);
      document.removeEventListener("copy", handleCopy, true);
      document.removeEventListener("cut", handleCut, true);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("dragstart", handleDragStart);
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
      document.body.style.userSelect = "";
      (document.body.style as any).webkitUserSelect = "";
      (document.body.style as any).webkitTouchCallout = "";
      const pStyle = document.getElementById("quiz-print-block");
      if (pStyle) pStyle.remove();
      if (displayMediaCleanup) displayMediaCleanup();
      showContent();
    };
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    violationCount,
    maxReached,
    isContentHidden,
    isFullscreen,
    enterFullscreen,
    exitFullscreen,
    recordViolation,
    showContent,
    hideContent,
  };
}
