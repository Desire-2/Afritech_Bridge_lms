"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Video, CheckCircle, Lock, Loader2, Maximize2, Minimize2, AlertCircle, AlertTriangle, FileText, ExternalLink } from "lucide-react";
import { VIDEO_WATCH_COMPLETE_THRESHOLD } from "@/constants/learningRules";
import { VideoCoverageTracker } from "../../utils/videoCoverage";

type YouTubeApi = {
  Player: new (element: HTMLElement, options: Record<string, unknown>) => any;
};

let youtubeApiPromise: Promise<YouTubeApi> | null = null;
const failedYouTubeScriptSrcs = new Set<string>();

class FatalPlayerError extends Error {}

const getYouTubeVideoId = (url: string) =>
  url.match(/(?:youtube(?:-nocookie)?\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1];

const loadYouTubeApi = (): Promise<YouTubeApi> => {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube is only available in the browser"));
  }

  const browserWindow = window as typeof window & {
    YT?: Partial<YouTubeApi>;
    onYouTubeIframeAPIReady?: () => void;
  };

  if (typeof browserWindow.YT?.Player === "function") {
    return Promise.resolve(browserWindow.YT as YouTubeApi);
  }

  if (youtubeApiPromise) return youtubeApiPromise;

  const apiPromise = new Promise<YouTubeApi>((resolve, reject) => {
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
    let settled = false;
    const script = document.querySelector<HTMLScriptElement>(
      'script[src*="youtube.com/iframe_api"]'
    );
    // A previous attempt may have left a dead (failed) script tag in the DOM.
    // Remove it so the browser actually re-requests the API instead of us
    // waiting on a tag that will never fire load or error again.
    if (script && failedYouTubeScriptSrcs.has(script.src)) {
      script.remove();
    }
    const scriptTag = script && script.isConnected
      ? script
      : document.createElement("script");

    const cleanup = () => {
      if (pollTimer) clearTimeout(pollTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      scriptTag.removeEventListener("error", handleScriptError);
    };

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) {
        reject(error);
        return;
      }
      resolve(browserWindow.YT as YouTubeApi);
    };

    const checkForPlayer = () => {
      if (settled) return;
      if (typeof browserWindow.YT?.Player === "function") {
        finish();
        return;
      }
      pollTimer = setTimeout(checkForPlayer, 50);
    };

    const handleScriptError = () => {
      failedYouTubeScriptSrcs.add(scriptTag.src);
      finish(new Error("The YouTube player API failed to load"));
    };

    scriptTag.addEventListener("error", handleScriptError, { once: true });
    if (!scriptTag.src) {
      scriptTag.src = "https://www.youtube.com/iframe_api";
      scriptTag.async = true;
      document.head.appendChild(scriptTag);
    }

    const previousReadyHandler = browserWindow.onYouTubeIframeAPIReady;
    browserWindow.onYouTubeIframeAPIReady = () => {
      try {
        previousReadyHandler?.();
      } finally {
        checkForPlayer();
      }
    };

    timeoutTimer = setTimeout(() => {
      finish(new Error("Timed out while loading the YouTube player API"));
    }, 10000);
    checkForPlayer();
  });

  youtubeApiPromise = apiPromise.catch((error) => {
    youtubeApiPromise = null;
    throw error;
  });
  return youtubeApiPromise;
};

// Distinguishes "only the optional JS API is blocked" (an ad-blocker — the
// embed iframe still plays) from "YouTube is blocked entirely" (nothing will
// load). A no-cors fetch returns an opaque response when the host is reachable
// and rejects when the network cannot reach it at all.
let youtubeReachablePromise: Promise<boolean> | null = null;
const probeYouTubeReachable = (): Promise<boolean> => {
  if (youtubeReachablePromise) return youtubeReachablePromise;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  youtubeReachablePromise = fetch("https://www.youtube.com/robots.txt", {
    mode: "no-cors",
    cache: "no-store",
    signal: controller.signal,
  })
    .then(() => true)
    .catch(() => false)
    .finally(() => clearTimeout(timer))
    .then((reachable) => {
      // Cache success so every player in a mixed lesson does not re-probe,
      // but allow a failure to be retried on the next attempt.
      if (!reachable) youtubeReachablePromise = null;
      return reachable;
    });
  return youtubeReachablePromise;
};

// Vimeo SDK script management: a failed load must be retryable, so the script
// element (and its cached failure) is removed on error instead of lingering.
let vimeoScriptPromise: Promise<void> | null = null;
const loadVimeoSdk = (): Promise<void> => {
  if ((window as any).Vimeo?.Player) return Promise.resolve();
  if (vimeoScriptPromise) return vimeoScriptPromise;
  vimeoScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://player.vimeo.com/api/player.js"]',
    );
    const s = existing ?? document.createElement("script");
    s.src = "https://player.vimeo.com/api/player.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      vimeoScriptPromise = null;
      s.remove();
      reject(new Error("Vimeo player failed to load"));
    };
    if (!existing) document.body.appendChild(s);
  });
  return vimeoScriptPromise;
};
// ── Duration formatting ────────────────────────────────────────────
const fmt = (s: number): string => {
  if (!s || !isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

const KNOWN_VIDEO_EXTENSIONS = new Set(["mp4", "webm", "ogg", "mov", "m4v"]);

const SPEED_OPTIONS = [1, 1.25, 1.5, 2, 0.75];

// While a shortcut is being handled globally, never steal the keypress from a
// form control, link, or the progress slider itself.
const INTERACTIVE_GUARD_SELECTOR =
  'input, textarea, select, button, a, [contenteditable=""], [contenteditable="true"], [role="slider"]';

const isInteractiveTarget = (el: Element | null): boolean => {
  if (!el) return false;
  if (el instanceof HTMLElement && el.isContentEditable) return true;
  return el.closest(INTERACTIVE_GUARD_SELECTOR) !== null;
};

// ── VideoProgressBar ───────────────────────────────────────────────
const VideoProgressBar: React.FC<{
  progress: number; currentTime: number; duration: number;
  isWatched: boolean; onSeek?: (f: number) => void;
}> = ({ progress, currentTime, duration, isWatched, onSeek }) => {
  const [hoverFrac, setHoverFrac] = useState<number | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    if (!barRef.current || !onSeek) return;
    const r = barRef.current.getBoundingClientRect();
    onSeek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
  };

  return (
    <div className="relative">
      <div
        ref={barRef}
        className="relative py-2 -my-2 cursor-pointer group"
        onClick={handleClick}
        onMouseMove={(e) => {
          if (!barRef.current) return;
          const r = barRef.current.getBoundingClientRect();
          setHoverFrac(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
        }}
        onMouseLeave={() => setHoverFrac(null)}
        role="slider" aria-label="Video progress"
        aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}
        aria-valuetext={`${fmt(currentTime)} of ${fmt(duration)}`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); onSeek?.(Math.min(1, (progress + 5) / 100)); }
          else if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); onSeek?.(Math.max(0, (progress - 5) / 100)); }
          else if (e.key === "Home") { e.preventDefault(); onSeek?.(0); }
          else if (e.key === "End") { e.preventDefault(); onSeek?.(1); }
          else if (e.key === "PageUp") { e.preventDefault(); onSeek?.(Math.min(1, progress / 100 + 0.1)); }
          else if (e.key === "PageDown") { e.preventDefault(); onSeek?.(Math.max(0, progress / 100 - 0.1)); }
        }}
      >
        <div
          className={`relative h-2.5 rounded-full ${
            isWatched ? "bg-green-900/40" : "bg-gray-700/50"
          }`}
        >
          <div
            className={`h-full rounded-full transition-all duration-300 ease-out relative overflow-hidden ${
              progress >= 100
                ? "bg-gradient-to-r from-emerald-400 to-green-500"
                : isWatched
                  ? "bg-gradient-to-r from-emerald-400 to-teal-500"
                  : "bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"
            }`}
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
          </div>
          {hoverFrac !== null && (
            <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg shadow-black/40 border-2 border-blue-500 z-10" style={{ left: `calc(${hoverFrac * 100}% - 8px)` }} />
          )}
        </div>
      </div>
      {hoverFrac !== null && (
        <div className="absolute -top-9 transform -translate-x-1/2 bg-gray-900 border border-gray-700 text-white text-xs font-mono px-2.5 py-1.5 rounded-lg shadow-xl z-20 whitespace-nowrap pointer-events-none" style={{ left: `${hoverFrac * 100}%` }}>
          <span className="text-blue-300">{fmt(hoverFrac * duration)}</span>
          <span className="text-gray-500 mx-1">/</span>
          <span className="text-gray-400">{fmt(duration)}</span>
        </div>
      )}
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-xs text-gray-500 font-mono">{fmt(currentTime)}</span>
        <span className="text-xs text-gray-500 font-mono">{fmt(duration)}</span>
      </div>
    </div>
  );
};

// ── VideoPlayer Props ──────────────────────────────────────────────
export interface VideoCaptionTrack {
  src: string;
  srclang: string;
  label: string;
  default?: boolean;
}

export interface VideoPlayerProps {
  videoUrl: string;
  lessonTitle: string;
  isMainVideo: boolean;
  mixedContentIndex?: number;
  onComplete?: () => void;
  onProgress?: (progress: number, currentTime?: number, duration?: number) => void;
  onMixedContentVideoProgress?: (idx: number, progress: number) => void;
  onMixedContentVideoComplete?: (idx: number) => void;
  initialProgress?: number;
  initialCurrentTime?: number;
  initialCompleted?: boolean;
  poster?: string;
  captionTracks?: VideoCaptionTrack[];
  transcript?: string;
}

// ── VideoPlayer Component ──────────────────────────────────────────
export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoUrl, lessonTitle, isMainVideo, mixedContentIndex,
  onComplete, onProgress, onMixedContentVideoProgress, onMixedContentVideoComplete,
  initialProgress = 0, initialCurrentTime = 0, initialCompleted = false,
  poster, captionTracks, transcript,
}) => {
  const [fullscreen, setFullscreen] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoWatched, setVideoWatched] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoError, setVideoError] = useState<string | null>(null);
  // Non-fatal: the optional YouTube JS API failed, but the embed still plays.
  const [apiWarning, setApiWarning] = useState<string | null>(null);
  // Fatal for this network: YouTube itself is unreachable, so nothing loads.
  const [youtubeUnreachable, setYoutubeUnreachable] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [videoLoading, setVideoLoading] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  // Embed (YouTube/Vimeo) loading placeholder, hidden once the iframe loads.
  const [embedLoading, setEmbedLoading] = useState(true);
  const [showTranscript, setShowTranscript] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoWatchedRef = useRef(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const youtubePlayerRef = useRef<any>(null);
  const vimeoPlayerRef = useRef<any>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resumeDisplayKeyRef = useRef<string | null>(null);
  const resumeSeekAppliedRef = useRef(false);
  // Unique-coverage tracker: playback POSITION is not engagement credit.
  const trackerRef = useRef<VideoCoverageTracker>(
    new VideoCoverageTracker({ baseCoveragePct: initialProgress || 0 }),
  );
  // Monotonic guard for parent reports: a mount-time zero report must never
  // clobber a newer persisted snapshot (progress only rises; the resume
  // position never jumps back to zero after real playback telemetry).
  const lastReportedRef = useRef({ progress: 0, time: 0 });
  // Kept in sync so the YouTube onReady handler can apply a speed chosen
  // before the player finished initializing.
  const playbackRateRef = useRef(playbackSpeed);

  useEffect(() => {
    playbackRateRef.current = playbackSpeed;
  }, [playbackSpeed]);

  const isYouTube = videoUrl.includes("youtube.com") || videoUrl.includes("youtube-nocookie.com") || videoUrl.includes("youtu.be");
  const isVimeo = videoUrl.includes("vimeo.com");
  const lastPathSegment = videoUrl.split('?')[0].split('#')[0].split('/').pop() ?? '';
  const directExtension = lastPathSegment.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  const isGoogleDrive = videoUrl.includes("drive.google.com");
  // Google Drive previews and non-video files (PDF, ZIP, …) cannot be played
  // by a <video> element — render an honest fallback instead of a black box.
  const isUnsupportedMedia = !isYouTube && !isVimeo &&
    (isGoogleDrive || (directExtension !== undefined && !KNOWN_VIDEO_EXTENSIONS.has(directExtension)));
  // CDN and signed media URLs often have no file extension. Anything that is
  // not a provider URL or an unsupported file is still a native video source.
  const isDirect = !isYouTube && !isVimeo && !isUnsupportedMedia;
  const directMimeType = directExtension === 'webm'
    ? 'video/webm'
    : directExtension === 'ogg'
      ? 'video/ogg'
      : 'video/mp4';

  const hasCaptionTracks = (captionTracks?.length ?? 0) > 0;
  const hasTranscript = Boolean(transcript && transcript.trim());
  // Embeds surface their own caption UI (and YouTube is explicitly asked for
  // captions via cc_load_policy), so the "no captions" note only applies to
  // direct video without provided caption tracks.
  const captionsAvailable = hasCaptionTracks || isYouTube || isVimeo;

  const reportProgress = useCallback((progress: number, time?: number, duration?: number) => {
    onProgress?.(progress, time, duration);
    if (mixedContentIndex !== undefined) {
      onMixedContentVideoProgress?.(mixedContentIndex, progress);
    }
  }, [mixedContentIndex, onMixedContentVideoProgress, onProgress]);

  /**
   * Push the latest coverage snapshot to the parent with monotonic guards.
   * - Never reports a lower coverage than previously reported (coverage is
   *   already monotonic; this defends against tracker swaps mid-restore).
   * - Never reports a zero resume position after real telemetry was seen —
   *   a remount must not wipe the persisted resume point.
   * - Skips the meaningless all-zero report emitted before any player is
   *   ready, which used to overwrite saved backend progress with zeros.
   * - Only pushes real increases, so a transient zero (error teardown,
   *   remount) can never overwrite the parent's persisted snapshot.
   */
  const flushProgressToParent = useCallback(() => {
    const tracker = trackerRef.current;
    const progress = tracker.coveragePct;
    const time = tracker.positionSec;
    const duration = tracker.getDuration();
    if (progress === 0 && time === 0 && duration === 0) return; // nothing real yet
    const last = lastReportedRef.current;
    const safeProgress = Math.max(last.progress, progress);
    const safeTime = time > 0 ? time : last.time;
    const hadIncrease = safeProgress > last.progress || safeTime > last.time;
    lastReportedRef.current = { progress: safeProgress, time: safeTime };
    setVideoProgress(safeProgress);
    if (time > 0 || duration > 0) {
      setCurrentTime(safeTime);
      if (duration > 0) setVideoDuration(duration);
    }
    if (hadIncrease) {
      reportProgress(safeProgress, safeTime, duration);
    }
  }, [reportProgress]);

  const markWatched = useCallback(() => {
    if (!videoWatchedRef.current) {
      videoWatchedRef.current = true;
      setVideoWatched(true);
      onComplete?.();
      if (mixedContentIndex !== undefined) {
        onMixedContentVideoComplete?.(mixedContentIndex);
      }
    }
  }, [mixedContentIndex, onComplete, onMixedContentVideoComplete]);

  // Feed a playback observation into the coverage tracker and sync state.
  const observePlayback = useCallback((timeSec: number, durationSec?: number) => {
    const tracker = trackerRef.current;
    if (durationSec && durationSec > 0) tracker.setDuration(durationSec);
    tracker.observe(timeSec);
    const coverage = tracker.coveragePct;
    // Monotonic display: a session-union value can never visually regress
    // below a restored persisted snapshot (tracker.raiseBase keeps the floor
    // in sync; this guards tracker swaps mid-restore).
    setVideoProgress(prev => Math.max(prev, coverage));
    setCurrentTime(tracker.positionSec);
    if (coverage >= VIDEO_WATCH_COMPLETE_THRESHOLD) markWatched();
  }, [markWatched]);

  // Fullscreen toggle
  const handleFullscreenToggle = useCallback(async (el: HTMLElement | null) => {
    if (!el) return;
    try {
      const currentFullscreenElement = document.fullscreenElement || (document as any).webkitFullscreenElement;
      if (currentFullscreenElement !== el) {
        await (el.requestFullscreen?.() || (el as any).webkitRequestFullscreen?.());
      } else {
        await (document.exitFullscreen?.() || (document as any).webkitExitFullscreen?.());
      }
    } catch {}
  }, []);

  const cyclePlaybackSpeed = () => {
    const next = SPEED_OPTIONS[(SPEED_OPTIONS.indexOf(playbackSpeed) + 1) % SPEED_OPTIONS.length];
    setPlaybackSpeed(next);
    if (videoRef.current) videoRef.current.playbackRate = next;
    youtubePlayerRef.current?.setPlaybackRate?.(next);
    vimeoPlayerRef.current?.setPlaybackRate?.(next);
  };

  // Keep the custom control in sync when the browser exits fullscreen via
  // Escape or its native controls.
  useEffect(() => {
    const syncFullscreenState = () => {
      const activeElement = document.fullscreenElement || (document as any).webkitFullscreenElement;
      setFullscreen(activeElement === containerRef.current);
    };
    document.addEventListener('fullscreenchange', syncFullscreenState);
    document.addEventListener('webkitfullscreenchange', syncFullscreenState as EventListener);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState);
      document.removeEventListener('webkitfullscreenchange', syncFullscreenState as EventListener);
    };
  }, []);

  // Sync progress to parent and mixed-content tracking whenever local state
  // advances. flushProgressToParent applies the monotonic guards.
  useEffect(() => {
    flushProgressToParent();
  }, [videoProgress, currentTime, videoDuration, flushProgressToParent]);

  // Flush on pause and tab-hide so a student leaving mid-video never loses
  // the interval since the last throttled report.
  useEffect(() => {
    const flush = () => flushProgressToParent();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushProgressToParent();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      // Final flush on unmount/URL change so the last observed second is kept.
      flushProgressToParent();
    };
  }, [flushProgressToParent]);

  useEffect(() => {
    // Snapshot the outgoing lesson's coverage before resetting local state.
    flushProgressToParent();
    setVideoProgress(0);
    videoWatchedRef.current = false;
    setVideoWatched(false);
    setVideoDuration(0);
    setCurrentTime(0);
    setVideoError(null);
    setApiWarning(null);
    setYoutubeUnreachable(false);
    setVideoLoading(false);
    youtubePlayerRef.current?.destroy?.();
    vimeoPlayerRef.current?.destroy?.();
    youtubePlayerRef.current = null;
    vimeoPlayerRef.current = null;
    resumeDisplayKeyRef.current = null;
    resumeSeekAppliedRef.current = false;
    // Fresh tracker per URL, seeded with the persisted coverage floor so a
    // lesson switch (and back) can never regress previously saved progress.
    trackerRef.current = new VideoCoverageTracker({
      baseCoveragePct: initialProgress || 0,
    });
    lastReportedRef.current = { progress: 0, time: 0 };
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
  }, [videoUrl]); // eslint-disable-line react-hooks/exhaustive-deps -- flush intentionally once per URL change

  // Restore saved progress once the underlying player exposes its duration.
  // The seek is applied once per URL so live progress updates cannot move the
  // player back to an older parent snapshot.
  useEffect(() => {
    const savedProgress = Math.max(0, Math.min(100, initialProgress || 0));
    const savedTime = Math.max(0, initialCurrentTime || 0);
    const hasSavedState = savedProgress > 0 || savedTime > 0 || initialCompleted;
    if (!hasSavedState) return;

    const displayKey = `${videoUrl}:${savedProgress}:${savedTime}:${initialCompleted}`;
    if (resumeDisplayKeyRef.current !== displayKey) {
      // Raise the tracker floor so live session coverage can never visually
      // regress below the persisted snapshot (the tracker is created at
      // mount, often BEFORE the backend snapshot resolves).
      trackerRef.current.raiseBase(savedProgress);
      setVideoProgress(prev => Math.max(prev, savedProgress));
      setCurrentTime(prev => (prev > 0 ? prev : savedTime));
      if (initialCompleted) {
        videoWatchedRef.current = true;
        setVideoWatched(true);
      }
      if (savedProgress > lastReportedRef.current.progress || savedTime > lastReportedRef.current.time) {
        lastReportedRef.current = {
          progress: Math.max(lastReportedRef.current.progress, savedProgress),
          time: Math.max(lastReportedRef.current.time, savedTime),
        };
      }
      resumeDisplayKeyRef.current = displayKey;
    }

    const duration = videoDuration || (videoRef.current?.duration ?? 0);
    if (duration > 0) trackerRef.current.setDuration(duration);
    if (!duration || resumeSeekAppliedRef.current) return;

    if (isDirect && videoRef.current) {
      videoRef.current.currentTime = Math.min(savedTime, duration);
      resumeSeekAppliedRef.current = true;
    } else if (isYouTube && youtubePlayerRef.current?.seekTo) {
      youtubePlayerRef.current.seekTo(Math.min(savedTime, duration), true);
      resumeSeekAppliedRef.current = true;
    } else if (isVimeo && vimeoPlayerRef.current?.setCurrentTime) {
      void vimeoPlayerRef.current.setCurrentTime(Math.min(savedTime, duration));
      resumeSeekAppliedRef.current = true;
    }
  }, [videoUrl, initialProgress, initialCurrentTime, initialCompleted, isDirect, isYouTube, isVimeo, videoDuration]);

  // YouTube: wait for the actual Player constructor before creating the
  // player. The global YT object can exist briefly before YT.Player is ready.
  //
  // The JS API is only an enhancement (progress tracking + our custom UI).
  // If it fails to load (blocked by an extension or the network), we keep the
  // plain embed iframe so the lesson video still plays instead of replacing it
  // with a hard error.
  useEffect(() => {
    if (!isYouTube || !iframeRef.current) return;
    let cancelled = false;
    let readyFired = false;
    let readyTimeout: ReturnType<typeof setTimeout> | null = null;

    const initializePlayer = async () => {
      const api = await loadYouTubeApi();
      if (cancelled || !iframeRef.current || youtubePlayerRef.current) return;

      const videoId = getYouTubeVideoId(videoUrl);
      if (!videoId) throw new FatalPlayerError("The YouTube URL is invalid");
      if (typeof api.Player !== "function") {
        throw new Error("The YouTube Player constructor is unavailable");
      }

      youtubePlayerRef.current = new api.Player(iframeRef.current, {
        videoId,
        events: {
          onReady: (event: any) => {
            if (cancelled) return;
            readyFired = true;
            if (readyTimeout) clearTimeout(readyTimeout);
            setApiWarning(null);
            const duration = event.target.getDuration();
            setVideoDuration(duration);
            trackerRef.current.setDuration(duration);
            event.target.setPlaybackRate?.(playbackRateRef.current);
            progressIntervalRef.current = setInterval(() => {
              const current = event.target.getCurrentTime();
              const total = event.target.getDuration();
              if (total > 0) {
                observePlayback(current, total);
              }
            }, 2000);
          },
        },
      });

      // If the player never reports ready, offer a retry instead of hanging
      // on a black frame with no feedback.
      readyTimeout = setTimeout(() => {
        if (!cancelled && !readyFired) {
          setApiWarning("The video player is taking longer than usual. You can retry, or use the embedded player's own controls.");
        }
      }, 12000);
    };

    initializePlayer().catch(async (error) => {
      if (cancelled) return;
      console.error("Failed to initialize YouTube player:", error);
      if (error instanceof FatalPlayerError) {
        setVideoError("This lesson's video link is not a valid YouTube URL.");
        return;
      }
      // The JS API failed. Find out whether it was only the optional API
      // (ad-blocker — the embed still plays) or all of YouTube (blocked
      // network — nothing will load) so we show an accurate message.
      const reachable = await probeYouTubeReachable();
      if (cancelled) return;
      if (reachable) {
        setApiWarning("Progress tracking is unavailable here, but the video plays with the built-in controls.");
      } else {
        setYoutubeUnreachable(true);
      }
    });

    return () => {
      cancelled = true;
      if (readyTimeout) clearTimeout(readyTimeout);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      youtubePlayerRef.current?.destroy?.();
      youtubePlayerRef.current = null;
    };
  }, [isYouTube, videoUrl, observePlayback, retryToken]);

  // Vimeo: load SDK + init
  useEffect(() => {
    if (!isVimeo || !iframeRef.current) return;
    let cancelled = false;
    const loadVimeo = async () => {
      await loadVimeoSdk();
      if (cancelled) return;
      const Player = (window as any).Vimeo.Player;
      if (!Player) throw new Error('Vimeo player is unavailable');
      vimeoPlayerRef.current?.destroy?.();
      vimeoPlayerRef.current = new Player(iframeRef.current);
      const duration = await vimeoPlayerRef.current.getDuration().catch(() => 0);
      if (cancelled) return;
      if (duration > 0) {
        setVideoDuration(duration);
        trackerRef.current.setDuration(duration);
      }
      vimeoPlayerRef.current.on("timeupdate", (data: any) => {
        if (data.duration > 0) observePlayback(data.seconds, data.duration);
      });
      vimeoPlayerRef.current.on("pause", () => {
        flushProgressToParent();
      });
    };
    loadVimeo().catch(() => {
      if (!cancelled) setVideoError('Vimeo could not be loaded. Open the lesson again or try another browser.');
    });
    return () => {
      cancelled = true;
      if (vimeoPlayerRef.current) {
        vimeoPlayerRef.current.off("timeupdate");
        vimeoPlayerRef.current.off("pause");
        vimeoPlayerRef.current.destroy?.();
        vimeoPlayerRef.current = null;
      }
    };
  }, [isVimeo, videoUrl, observePlayback, flushProgressToParent, retryToken]);

  // Direct video: track progress
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isDirect) return;
    const onTime = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) return;
      observePlayback(video.currentTime, video.duration);
    };
    const onMeta = () => {
      setVideoDuration(video.duration);
      trackerRef.current.setDuration(video.duration);
      video.playbackRate = playbackSpeed;
    };
    const onPause = () => flushProgressToParent();
    const onSeeked = () => {
      // Re-anchor the coverage tracker after a manual seek so the skipped
      // gap is not later credited as continuous watching.
      if (Number.isFinite(video.currentTime)) {
        trackerRef.current.observe(video.currentTime);
      }
    };
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("pause", onPause);
    video.addEventListener("seeked", onSeeked);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("seeked", onSeeked);
    };
  }, [isDirect, observePlayback, flushProgressToParent, playbackSpeed]);

  // Keyboard shortcuts for direct video
  useEffect(() => {
    if (!isDirect) return;
    const handler = (e: KeyboardEvent) => {
      const v = videoRef.current;
      if (!v) return;
      const target = e.target instanceof Element ? e.target : null;
      // Never steal keys from form controls, links, buttons, or the
      // progress slider (which has its own arrow-key handling).
      if (isInteractiveTarget(target) || isInteractiveTarget(document.activeElement)) return;
      switch (e.key) {
        case " ": case "k": e.preventDefault(); v.paused ? v.play() : v.pause(); break;
        case "ArrowLeft": case "j": e.preventDefault(); v.currentTime = Math.max(0, v.currentTime - 5); break;
        case "ArrowRight": case "l": e.preventDefault(); v.currentTime = Math.min(v.duration, v.currentTime + 5); break;
        case "f": e.preventDefault(); handleFullscreenToggle(containerRef.current); break;
        case "m": e.preventDefault(); v.muted = !v.muted; break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isDirect, handleFullscreenToggle]);

  // Embed loading placeholder: hide when the iframe finishes loading, with a
  // timeout backstop so a blocked embed never traps the placeholder forever.
  useEffect(() => {
    if (!isYouTube && !isVimeo) {
      setEmbedLoading(false);
      return;
    }
    setEmbedLoading(true);
    const timer = setTimeout(() => setEmbedLoading(false), 8000);
    return () => clearTimeout(timer);
  }, [videoUrl, isYouTube, isVimeo]);

  // Cleanup
  useEffect(() => () => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    youtubePlayerRef.current?.destroy?.();
    vimeoPlayerRef.current?.destroy?.();
  }, []);

  // ── Render ──────────────────────────────────────────────────────
  if (!videoUrl?.trim()) {
    return (
      <Alert className="bg-red-900/20 border-red-700">
        <AlertCircle className="h-5 w-5 text-red-400" />
        <AlertDescription className="text-red-200">
          <p className="font-semibold flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-red-400" aria-hidden="true" />
            Video URL Missing
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  const youtubeId = isYouTube ? getYouTubeVideoId(videoUrl) : undefined;

  // A YouTube URL we cannot parse can never produce a valid embed, so fail fast
  // instead of rendering an /embed/undefined iframe.
  if (isYouTube && !youtubeId) {
    return (
      <Alert className="bg-red-900/20 border-red-700">
        <AlertCircle className="h-5 w-5 text-red-400" />
        <AlertDescription className="text-red-200">
          <p className="font-semibold">Invalid video link</p>
          <p>This lesson's video link is not a recognized YouTube URL.</p>
        </AlertDescription>
      </Alert>
    );
  }

  // YouTube is blocked on this network, so the embed cannot load here. Show an
  // honest message plus an escape hatch instead of a silent black box.
  if (isYouTube && youtubeUnreachable) {
    return (
      <Alert className="bg-amber-900/20 border-amber-700">
        <AlertCircle className="h-5 w-5 text-amber-400" />
        <AlertDescription className="space-y-2 text-amber-200">
          <p className="font-semibold">YouTube is unreachable on this network</p>
          <p>
            This network is blocking YouTube, so the video cannot load here. If you
            can open YouTube in your own browser tab, use the button below. Otherwise,
            ask your instructor for an offline copy of this lesson.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <a
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-md bg-amber-600/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600"
            >
              Open video in a new tab
            </a>
            <button
              onClick={() => {
                youtubeReachablePromise = null;
                setYoutubeUnreachable(false);
                setRetryToken((t) => t + 1);
              }}
              className="inline-flex items-center rounded-md border border-amber-600/60 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-900/40"
            >
              Try again
            </button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (videoError) {
    return (
      <Alert className="bg-red-900/20 border-red-700">
        <AlertCircle className="h-5 w-5 text-red-400" />
        <AlertDescription className="text-red-200"><p>{videoError}</p></AlertDescription>
      </Alert>
    );
  }

  const renderPlayer = () => {
    if (isYouTube || isVimeo) {
      let src = isYouTube
        ? `https://www.youtube.com/embed/${youtubeId}?enablejsapi=1&origin=${typeof window !== "undefined" ? window.location.origin : ""}`
        : `https://player.vimeo.com/video/${videoUrl.match(/vimeo\.com\/(\d+)/)?.[1]}`;
      if (isYouTube) {
        // Ask YouTube to load the player with captions UI available, and keep
        // related videos out of the end screen — without clobbering params.
        if (!/[?&]cc_load_policy=/.test(src)) src += "&cc_load_policy=1";
        if (!/[?&]rel=/.test(src)) src += "&rel=0";
      }
      return (
        <iframe
          // Force a fresh DOM node per URL. YT.Player replaces the node it is
          // given, so reusing it across lessons leaves a detached element.
          key={videoUrl}
          ref={iframeRef}
          id={mixedContentIndex !== undefined ? `mixed-vid-${mixedContentIndex}` : "main-video"}
          src={src}
          className="absolute inset-0 w-full h-full"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          title={lessonTitle}
          onLoad={() => setEmbedLoading(false)}
        />
      );
    }
    if (isUnsupportedMedia) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-950 p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-400" aria-hidden="true" />
          <p className="text-sm font-medium text-gray-200">This media type can&apos;t be played here.</p>
          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            Open in a new tab
          </a>
        </div>
      );
    }
    // Direct video
    return (
      <video
        ref={videoRef}
        controls
        controlsList="nodownload"
        className="w-full h-full"
        poster={poster}
        onError={() => setVideoError("Failed to load video.")}
        onLoadStart={() => setVideoLoading(true)}
        onLoadedData={() => setVideoLoading(false)}
      >
        <source src={videoUrl} type={directMimeType} />
        {captionTracks?.map((track) => (
          <track
            key={`${track.srclang}-${track.src}`}
            kind="captions"
            src={track.src}
            srcLang={track.srclang}
            label={track.label}
            default={track.default}
          />
        ))}
        Your browser does not support the video tag.
      </video>
    );
  };

  return (
    <div className="space-y-4">
      <div ref={containerRef} className="relative aspect-video rounded-lg overflow-hidden bg-black group shadow-2xl" role="region" aria-label="Video player">
        {renderPlayer()}
        {(isYouTube || isVimeo) && embedLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 animate-pulse pointer-events-none">
            <span className="text-sm text-gray-300">Loading video…</span>
          </div>
        )}
        {videoLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-20">
            <Loader2 className="h-10 w-10 text-blue-400 animate-spin" />
            <span className="ml-3 text-white text-sm">Loading video...</span>
          </div>
        )}
        <button
          onClick={() => handleFullscreenToggle(containerRef.current)}
          className="absolute bottom-4 right-4 flex h-11 w-11 items-center justify-center rounded-lg bg-black/70 hover:bg-black/90 text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white transition-all z-10"
          aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {hasTranscript && (
          <button
            type="button"
            onClick={() => setShowTranscript((v) => !v)}
            aria-expanded={showTranscript}
            className="inline-flex h-11 items-center gap-1.5 rounded-md border border-gray-700 bg-gray-800/60 px-3 text-xs font-medium text-gray-200 hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            Transcript
          </button>
        )}
        <button
          type="button"
          onClick={cyclePlaybackSpeed}
          aria-label={`Playback speed, currently ${playbackSpeed}x`}
          className="inline-flex h-11 items-center rounded-md border border-gray-700 bg-gray-800/60 px-3 text-xs font-medium text-gray-200 hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {playbackSpeed}x
        </button>
        {!captionsAvailable && !hasTranscript && (
          <p className="text-xs text-gray-400">Captions not available for this video</p>
        )}
      </div>

      {hasTranscript && showTranscript && (
        <div
          role="region"
          aria-label="Video transcript"
          className="max-h-64 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900/70 p-3 text-sm leading-relaxed text-gray-300 whitespace-pre-wrap"
        >
          {transcript}
        </div>
      )}

      {apiWarning && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-700/60 bg-amber-900/20 p-3">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-400" />
          <div className="flex-1 text-sm text-amber-200">{apiWarning}</div>
          <button
            onClick={() => {
              setApiWarning(null);
              setRetryToken((t) => t + 1);
            }}
            className="flex-shrink-0 text-xs font-medium text-amber-200 underline hover:text-amber-100"
          >
            Retry
          </button>
        </div>
      )}

      <Card className={`border-2 ${videoWatched ? "bg-green-900/30 border-green-700" : "bg-blue-900/30 border-blue-700"}`}>
        <div className="p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Video className={`h-4 w-4 ${videoWatched ? "text-green-400" : "text-blue-400"}`} />
              <span className={`text-sm font-medium ${videoWatched ? "text-green-200" : "text-blue-200"}`}>Video Progress</span>
            </div>
            {videoWatched ? (
              <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>
            ) : (
              <span className="text-sm text-gray-300">{Math.round(videoProgress)}% watched</span>
            )}
          </div>
          <VideoProgressBar
            progress={videoProgress} currentTime={currentTime} duration={videoDuration}
            isWatched={videoWatched}
            onSeek={(f) => {
              if (isYouTube && youtubePlayerRef.current?.seekTo) youtubePlayerRef.current.seekTo(f * videoDuration, true);
              if (isVimeo && vimeoPlayerRef.current?.setCurrentTime) vimeoPlayerRef.current.setCurrentTime(f * videoDuration);
              if (isDirect && videoRef.current) videoRef.current.currentTime = f * videoDuration;
            }}
          />
          {!videoWatched && videoProgress > 0 && (
            <div className="flex items-center space-x-2 text-xs text-blue-300 bg-blue-950/50 p-2 rounded">
              <Lock className="h-3 w-3 flex-shrink-0" />
              <span>Watch at least 90% to unlock next lesson</span>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
