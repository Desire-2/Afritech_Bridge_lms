"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Video, CheckCircle, Lock, Loader2, Maximize2, Minimize2, AlertCircle } from "lucide-react";

// ── Duration formatting ────────────────────────────────────────────
const fmt = (s: number): string => {
  if (!s || !isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
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
        className={`relative h-2.5 rounded-full cursor-pointer group ${isWatched ? "bg-green-900/40" : "bg-gray-700/50"}`}
        onClick={handleClick}
        onMouseMove={(e) => {
          if (!barRef.current) return;
          const r = barRef.current.getBoundingClientRect();
          setHoverFrac(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
        }}
        onMouseLeave={() => setHoverFrac(null)}
        role="slider" aria-label="Video progress"
        aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); onSeek?.(Math.min(1, (progress + 5) / 100)); }
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); onSeek?.(Math.max(0, (progress - 5) / 100)); }
        }}
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
      {hoverFrac !== null && (
        <div className="absolute -top-9 transform -translate-x-1/2 bg-gray-900 border border-gray-700 text-white text-xs font-mono px-2.5 py-1.5 rounded-lg shadow-xl z-20 whitespace-nowrap pointer-events-none" style={{ left: `${hoverFrac * 100}%` }}>
          <span className="text-blue-300">{fmt(hoverFrac * duration)}</span>
          <span className="text-gray-500 mx-1">/</span>
          <span className="text-gray-400">{fmt(duration)}</span>
        </div>
      )}
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[11px] text-gray-500 font-mono">{fmt(currentTime)}</span>
        <span className="text-[11px] text-gray-500 font-mono">{fmt(duration)}</span>
      </div>
    </div>
  );
};

// ── VideoPlayer Props ──────────────────────────────────────────────
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
}

// ── VideoPlayer Component ──────────────────────────────────────────
export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoUrl, lessonTitle, isMainVideo, mixedContentIndex,
  onComplete, onProgress, onMixedContentVideoProgress, onMixedContentVideoComplete,
  initialProgress = 0, initialCurrentTime = 0, initialCompleted = false,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoWatched, setVideoWatched] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playerReady, setPlayerReady] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const youtubePlayerRef = useRef<any>(null);
  const vimeoPlayerRef = useRef<any>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resumeDisplayKeyRef = useRef<string | null>(null);
  const resumeSeekAppliedRef = useRef(false);

  const isYouTube = videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be");
  const isVimeo = videoUrl.includes("vimeo.com");
  const directExtension = videoUrl.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase();
  // CDN and signed media URLs often have no file extension. Anything that is
  // not a supported provider URL is still a native video source.
  const isDirect = !isYouTube && !isVimeo;
  const directMimeType = directExtension === 'webm'
    ? 'video/webm'
    : directExtension === 'ogg'
      ? 'video/ogg'
      : 'video/mp4';

  const reportProgress = useCallback((progress: number, time?: number, duration?: number) => {
    onProgress?.(progress, time, duration);
    if (mixedContentIndex !== undefined) {
      onMixedContentVideoProgress?.(mixedContentIndex, progress);
    }
  }, [mixedContentIndex, onMixedContentVideoProgress, onProgress]);

  const markWatched = useCallback(() => {
    if (!videoWatched) {
      setVideoWatched(true);
      onComplete?.();
      if (mixedContentIndex !== undefined) {
        onMixedContentVideoComplete?.(mixedContentIndex);
      }
    }
  }, [mixedContentIndex, onComplete, onMixedContentVideoComplete, videoWatched]);

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

  // Sync progress to parent and mixed-content tracking.
  useEffect(() => {
    reportProgress(videoProgress, currentTime, videoDuration);
  }, [videoProgress, currentTime, videoDuration, reportProgress]);

  useEffect(() => {
    setVideoProgress(0);
    setVideoWatched(false);
    setVideoDuration(0);
    setCurrentTime(0);
    setVideoError(null);
    setVideoLoading(false);
    setPlayerReady(false);
    youtubePlayerRef.current?.destroy?.();
    vimeoPlayerRef.current?.destroy?.();
    youtubePlayerRef.current = null;
    vimeoPlayerRef.current = null;
    resumeDisplayKeyRef.current = null;
    resumeSeekAppliedRef.current = false;
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
  }, [videoUrl]);

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
      setVideoProgress(savedProgress);
      setCurrentTime(savedTime);
      setVideoWatched(initialCompleted);
      resumeDisplayKeyRef.current = displayKey;
    }

    const duration = videoDuration || (videoRef.current?.duration ?? 0);
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

  // YouTube: load API + init player with 10s fallback timeout
  useEffect(() => {
    if (!isYouTube || !iframeRef.current) return;
    if (!(window as any).YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.getElementsByTagName("script")[0].parentNode?.insertBefore(tag, document.getElementsByTagName("script")[0]);
      (window as any).onYouTubeIframeAPIReady = () => setPlayerReady(true);
      setPlayerReady(false);
      const timeout = setTimeout(() => {
        console.warn("⏱️ YouTube loading timeout - forcing playerReady");
        setPlayerReady(true);
      }, 10000);
      return () => clearTimeout(timeout);
    }
    setPlayerReady(true);
  }, [isYouTube, videoUrl]);

  useEffect(() => {
    if (!playerReady || !isYouTube || !iframeRef.current || youtubePlayerRef.current) return;
    const vid = videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1];
    if (!vid) return;

    youtubePlayerRef.current = new (window as any).YT.Player(iframeRef.current, {
      videoId: vid,
      events: {
        onReady: (e: any) => {
          setVideoDuration(e.target.getDuration());
          progressIntervalRef.current = setInterval(() => {
            const ct = e.target.getCurrentTime();
            const dur = e.target.getDuration();
            if (dur > 0) {
              const pct = (ct / dur) * 100;
              setVideoProgress(pct);
              setCurrentTime(ct);
              if (pct >= 90) markWatched();
            }
          }, 2000);
        },
        onStateChange: (e: any) => setIsPlaying(e.data === 1),
      },
    });
    return () => { if (progressIntervalRef.current) clearInterval(progressIntervalRef.current); };
  }, [playerReady, isYouTube, videoUrl, markWatched, reportProgress]);

  // Vimeo: load SDK + init
  useEffect(() => {
    if (!isVimeo || !iframeRef.current) return;
    let cancelled = false;
    const loadVimeo = async () => {
      if (!(window as any).Vimeo) {
        const s = document.createElement("script");
        s.src = "https://player.vimeo.com/api/player.js";
        s.async = true;
        await new Promise<void>((resolve, reject) => {
          s.onload = () => resolve();
          s.onerror = () => reject(new Error('Vimeo player failed to load'));
          document.body.appendChild(s);
        });
      }
      if (cancelled) return;
      const Player = (window as any).Vimeo.Player;
      if (!Player) throw new Error('Vimeo player is unavailable');
      vimeoPlayerRef.current = new Player(iframeRef.current);
      vimeoPlayerRef.current.getDuration().then((d: number) => setVideoDuration(d));
      vimeoPlayerRef.current.on("timeupdate", (data: any) => {
        const pct = (data.seconds / data.duration) * 100;
        setVideoProgress(pct);
        setCurrentTime(data.seconds);
        if (pct >= 90) markWatched();
      });
      vimeoPlayerRef.current.on("play", () => setIsPlaying(true));
      vimeoPlayerRef.current.on("pause", () => setIsPlaying(false));
    };
    loadVimeo().catch(() => setVideoError('Vimeo could not be loaded. Open the lesson again or try another browser.'));
    return () => {
      cancelled = true;
      if (vimeoPlayerRef.current) {
        vimeoPlayerRef.current.off("timeupdate");
        vimeoPlayerRef.current.off("play");
        vimeoPlayerRef.current.off("pause");
      }
    };
  }, [isVimeo, videoUrl, markWatched, reportProgress]);

  // Direct video: track progress
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isDirect) return;
    const onTime = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) return;
      const pct = (video.currentTime / video.duration) * 100;
      setVideoProgress(pct);
      setCurrentTime(video.currentTime);
      if (pct >= 90) markWatched();
    };
    const onMeta = () => { setVideoDuration(video.duration); video.playbackRate = playbackSpeed; };
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("loadedmetadata", onMeta);
    return () => { video.removeEventListener("timeupdate", onTime); video.removeEventListener("loadedmetadata", onMeta); };
  }, [isDirect, markWatched, playbackSpeed, reportProgress]);

  // Keyboard shortcuts for direct video
  useEffect(() => {
    if (!isDirect) return;
    const handler = (e: KeyboardEvent) => {
      const v = videoRef.current;
      const activeElement = document.activeElement;
      if (!v || activeElement?.tagName === "INPUT" || activeElement?.tagName === "TEXTAREA" ||
        activeElement?.tagName === "SELECT" || activeElement?.tagName === "BUTTON" ||
        activeElement?.tagName === "A" || (activeElement instanceof HTMLElement && activeElement.isContentEditable)) return;
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
          <p className="font-semibold">❌ Video URL Missing</p>
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
      const src = isYouTube
        ? `https://www.youtube.com/embed/${videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1]}?enablejsapi=1&origin=${typeof window !== "undefined" ? window.location.origin : ""}`
        : `https://player.vimeo.com/video/${videoUrl.match(/vimeo\.com\/(\d+)/)?.[1]}`;
      return (
        <iframe
          ref={iframeRef}
          id={mixedContentIndex !== undefined ? `mixed-vid-${mixedContentIndex}` : "main-video"}
          src={src}
          className="absolute inset-0 w-full h-full"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          title={lessonTitle}
        />
      );
    }
    // Direct video
    return (
      <video
        ref={videoRef}
        controls
        controlsList="nodownload"
        className="w-full h-full"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onError={() => setVideoError("Failed to load video.")}
        onLoadStart={() => setVideoLoading(true)}
        onLoadedData={() => setVideoLoading(false)}
      >
        <source src={videoUrl} type={directMimeType} />
        Your browser does not support the video tag.
      </video>
    );
  };

  return (
    <div className="space-y-4">
      <div ref={containerRef} className="relative aspect-video rounded-lg overflow-hidden bg-black group shadow-2xl" role="region" aria-label="Video player">
        {renderPlayer()}
        {videoLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-20">
            <Loader2 className="h-10 w-10 text-blue-400 animate-spin" />
            <span className="ml-3 text-white text-sm">Loading video...</span>
          </div>
        )}
        <button
          onClick={() => handleFullscreenToggle(containerRef.current)}
          className="absolute bottom-4 right-4 bg-black/70 hover:bg-black/90 text-white p-2.5 rounded-lg opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white transition-all z-10"
          aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>

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
