import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/atom-one-dark.css';
import './markdown-styles.css';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Play, 
  Pause, 
  FileText, 
  Video, 
  Download, 
  Maximize2,
  Minimize2,
  Clock,
  BookOpen,
  CheckCircle,
  Lock,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  SkipForward,
  SkipBack,
  Volume2,
  Settings,
  AlertCircle
} from 'lucide-react';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ContentRichPreviewProps {
  lesson: {
    title: string;
    content_type: 'text' | 'video' | 'pdf' | 'mixed';
    content_data: string;
    description?: string;
    learning_objectives?: string;
    duration_minutes?: number;
  };
  onVideoComplete?: () => void;
  onVideoProgress?: (progress: number) => void;
}

interface MixedContentSection {
  type: 'text' | 'video' | 'pdf' | 'image' | 'heading';
  content?: string;
  url?: string;
  title?: string;
  level?: number;
  alt?: string;
}

export const ContentRichPreview: React.FC<ContentRichPreviewProps> = ({ 
  lesson,
  onVideoComplete,
  onVideoProgress 
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoWatched, setVideoWatched] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playerReady, setPlayerReady] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [pdfZoom, setPdfZoom] = useState(100);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfTotalPages, setPdfTotalPages] = useState(0);
  const [activeContentSection, setActiveContentSection] = useState(0);
  const [mixedContentError, setMixedContentError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const youtubePlayerRef = useRef<any>(null);
  const vimeoPlayerRef = useRef<any>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const contentSectionRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Keyboard navigation for video controls
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video || lesson.content_type !== 'video') return;

      // Only handle if video player is focused or no input is focused
      const activeElement = document.activeElement;
      if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA') return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          if (video.paused) {
            video.play();
          } else {
            video.pause();
          }
          break;
        case 'ArrowLeft':
        case 'j':
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 5);
          break;
        case 'ArrowRight':
        case 'l':
          e.preventDefault();
          video.currentTime = Math.min(video.duration, video.currentTime + 5);
          break;
        case 'ArrowUp':
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.1);
          break;
        case 'f':
          e.preventDefault();
          handleFullscreenToggle(videoContainerRef.current);
          break;
        case 'm':
          e.preventDefault();
          video.muted = !video.muted;
          break;
        case '>':
          e.preventDefault();
          handlePlaybackSpeedChange(Math.min(2, playbackSpeed + 0.25));
          break;
        case '<':
          e.preventDefault();
          handlePlaybackSpeedChange(Math.max(0.5, playbackSpeed - 0.25));
          break;
        case '0':
        case 'Home':
          e.preventDefault();
          video.currentTime = 0;
          break;
        case 'End':
          e.preventDefault();
          video.currentTime = video.duration;
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [lesson.content_type, playbackSpeed]);

  // Handle playback speed changes for direct video elements
  const handlePlaybackSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  // Track video progress for direct video elements
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const progress = (video.currentTime / video.duration) * 100;
      setVideoProgress(progress);
      setCurrentTime(video.currentTime);
      
      onVideoProgress?.(progress);
      
      // Mark as watched if >= 90% completed
      if (progress >= 90 && !videoWatched) {
        setVideoWatched(true);
        onVideoComplete?.();
      }
    };

    const handleLoadedMetadata = () => {
      setVideoDuration(video.duration);
      // Apply saved playback speed
      video.playbackRate = playbackSpeed;
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [videoWatched, onVideoComplete, onVideoProgress, playbackSpeed]);

  // Load YouTube API
  useEffect(() => {
    if (lesson.content_type !== 'video') return;
    
    const videoUrl = lesson.content_data;
    const isYouTube = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
    
    if (!isYouTube) return;

    // Load YouTube IFrame API if not already loaded
    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      (window as any).onYouTubeIframeAPIReady = () => {
        setPlayerReady(true);
      };
    } else {
      setPlayerReady(true);
    }
  }, [lesson.content_type, lesson.content_data]);

  // Initialize YouTube Player
  useEffect(() => {
    if (!playerReady || !iframeRef.current || lesson.content_type !== 'video') return;
    
    const videoUrl = lesson.content_data;
    const isYouTube = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
    
    if (!isYouTube) return;

    const videoId = videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1];
    
    if (!videoId || youtubePlayerRef.current) return;

    try {
      youtubePlayerRef.current = new (window as any).YT.Player(iframeRef.current, {
        videoId,
        events: {
          onReady: (event: any) => {
            const duration = event.target.getDuration();
            setVideoDuration(duration);

            // Poll for progress updates
            if (progressIntervalRef.current) {
              clearInterval(progressIntervalRef.current);
            }

            progressIntervalRef.current = setInterval(() => {
              const currentTime = event.target.getCurrentTime();
              const duration = event.target.getDuration();
              
              if (duration > 0) {
                const progress = (currentTime / duration) * 100;
                setVideoProgress(progress);
                setCurrentTime(currentTime);
                
                onVideoProgress?.(progress);
                
                // Mark as watched if >= 90% completed
                if (progress >= 90 && !videoWatched) {
                  setVideoWatched(true);
                  onVideoComplete?.();
                  if (progressIntervalRef.current) {
                    clearInterval(progressIntervalRef.current);
                  }
                }
              }
            }, 1000);
          },
          onStateChange: (event: any) => {
            // 1 = playing, 2 = paused
            setIsPlaying(event.data === 1);
          }
        }
      });
    } catch (error) {
      console.error('Error initializing YouTube player:', error);
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [playerReady, lesson.content_type, lesson.content_data, videoWatched, onVideoComplete, onVideoProgress]);

  // Load and initialize Vimeo Player
  useEffect(() => {
    if (lesson.content_type !== 'video') return;
    
    const videoUrl = lesson.content_data;
    const isVimeo = videoUrl.includes('vimeo.com');
    
    if (!isVimeo || !iframeRef.current) return;

    // Load Vimeo Player SDK if not already loaded
    const loadVimeoSDK = async () => {
      if (!(window as any).Vimeo) {
        const script = document.createElement('script');
        script.src = 'https://player.vimeo.com/api/player.js';
        script.async = true;
        
        await new Promise<void>((resolve) => {
          script.onload = () => resolve();
          document.body.appendChild(script);
        });
      }

      // Initialize Vimeo player
      try {
        const Player = (window as any).Vimeo.Player;
        vimeoPlayerRef.current = new Player(iframeRef.current);

        // Get video duration
        vimeoPlayerRef.current.getDuration().then((duration: number) => {
          setVideoDuration(duration);
        });

        // Listen to timeupdate events
        vimeoPlayerRef.current.on('timeupdate', (data: any) => {
          const progress = (data.seconds / data.duration) * 100;
          setVideoProgress(progress);
          setCurrentTime(data.seconds);
          
          onVideoProgress?.(progress);
          
          // Mark as watched if >= 90% completed
          if (progress >= 90 && !videoWatched) {
            setVideoWatched(true);
            onVideoComplete?.();
          }
        });

        // Listen to play/pause events
        vimeoPlayerRef.current.on('play', () => setIsPlaying(true));
        vimeoPlayerRef.current.on('pause', () => setIsPlaying(false));

      } catch (error) {
        console.error('Error initializing Vimeo player:', error);
      }
    };

    loadVimeoSDK();

    return () => {
      if (vimeoPlayerRef.current) {
        vimeoPlayerRef.current.off('timeupdate');
        vimeoPlayerRef.current.off('play');
        vimeoPlayerRef.current.off('pause');
      }
    };
  }, [lesson.content_type, lesson.content_data, videoWatched, onVideoComplete, onVideoProgress]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      if (youtubePlayerRef.current) {
        youtubePlayerRef.current.destroy?.();
      }
      if (vimeoPlayerRef.current) {
        vimeoPlayerRef.current.destroy?.();
      }
    };
  }, []);

  const handleFullscreenToggle = async (element: HTMLElement | null) => {
    if (!element) return;

    try {
      if (!fullscreen) {
        // Enter fullscreen
        if (element.requestFullscreen) {
          await element.requestFullscreen();
        } else if ((element as any).webkitRequestFullscreen) {
          await (element as any).webkitRequestFullscreen();
        } else if ((element as any).mozRequestFullScreen) {
          await (element as any).mozRequestFullScreen();
        } else if ((element as any).msRequestFullscreen) {
          await (element as any).msRequestFullscreen();
        }
        setFullscreen(true);
      } else {
        // Exit fullscreen
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else if ((document as any).webkitFullscreenElement) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).mozFullScreenElement) {
          await (document as any).mozCancelFullScreen();
        } else if ((document as any).msFullscreenElement) {
          await (document as any).msExitFullscreen();
        }
        setFullscreen(false);
      }
    } catch (error) {
      console.error('Error toggling fullscreen:', error);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !((document as any).webkitFullscreenElement || (document as any).mozFullScreenElement || (document as any).msFullscreenElement)) {
        setFullscreen(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderTextContent = (content: string) => {
    return (
      <div className="prose prose-invert prose-lg max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw, rehypeHighlight]}
          components={{
            // Custom heading styles
            h1: ({ node, ...props }) => (
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-6 mt-8 border-b border-gray-700 pb-3" {...props} />
            ),
            h2: ({ node, ...props }) => (
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-5 mt-7 border-b border-gray-700/50 pb-2" {...props} />
            ),
            h3: ({ node, ...props }) => (
              <h3 className="text-xl sm:text-2xl font-semibold text-white mb-4 mt-6" {...props} />
            ),
            h4: ({ node, ...props }) => (
              <h4 className="text-lg sm:text-xl font-semibold text-gray-200 mb-3 mt-5" {...props} />
            ),
            h5: ({ node, ...props }) => (
              <h5 className="text-base sm:text-lg font-semibold text-gray-300 mb-2 mt-4" {...props} />
            ),
            h6: ({ node, ...props }) => (
              <h6 className="text-sm sm:text-base font-semibold text-gray-400 mb-2 mt-3" {...props} />
            ),
            // Paragraphs
            p: ({ node, ...props }) => (
              <p className="text-gray-200 leading-relaxed mb-4 text-base sm:text-lg" {...props} />
            ),
            // Lists
            ul: ({ node, ...props }) => (
              <ul className="list-disc list-inside space-y-2 mb-4 text-gray-200 ml-4" {...props} />
            ),
            ol: ({ node, ...props }) => (
              <ol className="list-decimal list-inside space-y-2 mb-4 text-gray-200 ml-4" {...props} />
            ),
            li: ({ node, ...props }) => (
              <li className="text-gray-200 leading-relaxed text-base sm:text-lg" {...props} />
            ),
            // Code blocks
            code: ({ node, inline, className, children, ...props }: any) => {
              const match = /language-(\w+)/.exec(className || '');
              const [copied, setCopied] = useState(false);
              
              const handleCopy = () => {
                navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              };
              
              return !inline ? (
                <div className="my-6 rounded-xl overflow-hidden border border-gray-700/50 shadow-2xl bg-gradient-to-br from-gray-900 to-gray-800">
                  {/* Code header with language badge */}
                  <div className="bg-gradient-to-r from-gray-800 to-gray-750 px-4 py-3 border-b border-gray-700/70 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {/* Color-coded language indicator */}
                      <div className="flex items-center space-x-2">
                        <div className={`h-3 w-3 rounded-full ${
                          match?.[1] === 'python' ? 'bg-blue-500' :
                          match?.[1] === 'javascript' || match?.[1] === 'js' ? 'bg-yellow-500' :
                          match?.[1] === 'typescript' || match?.[1] === 'ts' ? 'bg-blue-600' :
                          match?.[1] === 'html' ? 'bg-orange-500' :
                          match?.[1] === 'css' ? 'bg-blue-400' :
                          match?.[1] === 'java' ? 'bg-red-500' :
                          match?.[1] === 'cpp' || match?.[1] === 'c' ? 'bg-purple-500' :
                          match?.[1] === 'bash' || match?.[1] === 'sh' ? 'bg-green-500' :
                          match?.[1] === 'sql' ? 'bg-orange-600' :
                          match?.[1] === 'json' ? 'bg-yellow-400' :
                          'bg-gray-500'
                        }`} />
                        <span className="text-sm font-semibold text-gray-300 font-mono tracking-wide">
                          {match ? match[1].toUpperCase() : 'CODE'}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-3 text-xs text-gray-400 hover:text-white hover:bg-gray-700/50 transition-all duration-200"
                      onClick={handleCopy}
                    >
                      {copied ? (
                        <>
                          <CheckCircle className="h-3.5 w-3.5 mr-1.5 text-green-400" />
                          <span className="text-green-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <svg className="h-3.5 w-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy Code
                        </>
                      )}
                    </Button>
                  </div>
                  {/* Code content with line numbers */}
                  <div className="relative">
                    <pre className="bg-[#0d1117] p-6 overflow-x-auto text-sm leading-relaxed font-mono">
                      <code className={className} {...props}>
                        {children}
                      </code>
                    </pre>
                    {/* Subtle gradient overlay for depth */}
                    <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-transparent to-gray-900/10" />
                  </div>
                </div>
              ) : (
                <code className="bg-gray-800/80 text-blue-300 px-2.5 py-1 rounded-md text-[0.9em] font-mono border border-gray-700/50 shadow-sm" {...props}>
                  {children}
                </code>
              );
            },
            // Blockquotes
            blockquote: ({ node, ...props }) => (
              <blockquote className="border-l-4 border-blue-500 bg-blue-900/20 pl-4 py-2 my-4 italic text-gray-300" {...props} />
            ),
            // Links
            a: ({ node, ...props }) => (
              <a className="text-blue-400 hover:text-blue-300 underline decoration-blue-500/50 hover:decoration-blue-400" target="_blank" rel="noopener noreferrer" {...props} />
            ),
            // Tables
            table: ({ node, ...props }) => (
              <div className="overflow-x-auto my-4">
                <table className="min-w-full border border-gray-700 rounded-lg overflow-hidden" {...props} />
              </div>
            ),
            thead: ({ node, ...props }) => (
              <thead className="bg-gray-800" {...props} />
            ),
            tbody: ({ node, ...props }) => (
              <tbody className="divide-y divide-gray-700" {...props} />
            ),
            tr: ({ node, ...props }) => (
              <tr className="hover:bg-gray-800/50" {...props} />
            ),
            th: ({ node, ...props }) => (
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-200 border-b border-gray-700" {...props} />
            ),
            td: ({ node, ...props }) => (
              <td className="px-4 py-3 text-sm text-gray-300" {...props} />
            ),
            // Images
            img: ({ node, ...props }) => (
              <img className="rounded-lg my-4 max-w-full h-auto shadow-lg" {...props} alt={props.alt || ''} />
            ),
            // Strong/Bold
            strong: ({ node, ...props }) => (
              <strong className="font-bold text-white" {...props} />
            ),
            // Emphasis/Italic
            em: ({ node, ...props }) => (
              <em className="italic text-gray-200" {...props} />
            ),
            // Horizontal rule
            hr: ({ node, ...props }) => (
              <hr className="my-8 border-gray-700" {...props} />
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  };

  const renderVideoContent = (videoUrl: string) => {
    // Support YouTube, Vimeo, and direct video URLs
    const isYouTube = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
    const isVimeo = videoUrl.includes('vimeo.com');
    
    if (isYouTube) {
      // Extract YouTube video ID
      const videoId = videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1];
      if (videoId) {
        return (
          <div className="space-y-4">
            <div 
              ref={videoContainerRef}
              className="relative aspect-video rounded-lg overflow-hidden bg-black group"
              role="region"
              aria-label="Video player"
            >
              <div
                ref={iframeRef as any}
                id={`youtube-player-${videoId}`}
                className="absolute inset-0 w-full h-full"
                role="application"
                aria-label={`YouTube video: ${lesson.title}`}
              />
              <button
                onClick={() => handleFullscreenToggle(videoContainerRef.current)}
                className="absolute bottom-4 right-4 bg-black/60 hover:bg-black/80 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                title={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                aria-label={fullscreen ? "Exit fullscreen mode" : "Enter fullscreen mode"}
              >
                {fullscreen ? (
                  <Minimize2 className="h-5 w-5" />
                ) : (
                  <Maximize2 className="h-5 w-5" />
                )}
              </button>
            </div>
            
            {/* YouTube Progress Tracker */}
            <Card 
              className={`border-2 ${videoWatched ? 'bg-green-900/30 border-green-700' : 'bg-blue-900/30 border-blue-700'}`}
              role="status"
              aria-live="polite"
            >
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Video className={`h-4 w-4 ${videoWatched ? 'text-green-400' : 'text-blue-400'}`} aria-hidden="true" />
                    <span className={`text-sm font-medium ${videoWatched ? 'text-green-200' : 'text-blue-200'}`}>
                      Video Progress
                    </span>
                  </div>
                  {videoWatched ? (
                    <Badge className="bg-green-600">
                      <CheckCircle className="h-3 w-3 mr-1" aria-hidden="true" />
                      Completed
                    </Badge>
                  ) : (
                    <span className="text-sm text-gray-300" aria-label={`Video watched: ${Math.round(videoProgress)} percent`}>
                      {Math.round(videoProgress)}% watched
                    </span>
                  )}
                </div>
                
                <Progress 
                  value={videoProgress} 
                  className="h-2" 
                  aria-label="Video progress"
                  aria-valuenow={Math.round(videoProgress)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
                
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span aria-label={`Current time: ${formatTime(currentTime)}`}>{formatTime(currentTime)}</span>
                  <span aria-label={`Total duration: ${formatTime(videoDuration)}`}>{formatTime(videoDuration)}</span>
                </div>
                
                {!videoWatched && videoProgress > 0 && (
                  <div className="flex items-center space-x-2 text-xs text-blue-300" role="alert">
                    <Lock className="h-3 w-3" aria-hidden="true" />
                    <span>Watch at least 90% to unlock next lesson</span>
                  </div>
                )}
              </div>
            </Card>
          </div>
        );
      }
    } else if (isVimeo) {
      // Extract Vimeo video ID
      const videoId = videoUrl.match(/vimeo\.com\/(\d+)/)?.[1];
      if (videoId) {
        return (
          <div className="space-y-4">
            <div 
              ref={videoContainerRef}
              className="relative aspect-video rounded-lg overflow-hidden bg-black group"
            >
              <iframe
                ref={iframeRef}
                src={`https://player.vimeo.com/video/${videoId}`}
                className="absolute inset-0 w-full h-full"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
              />
              <button
                onClick={() => handleFullscreenToggle(videoContainerRef.current)}
                className="absolute bottom-4 right-4 bg-black/60 hover:bg-black/80 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                title={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {fullscreen ? (
                  <Minimize2 className="h-5 w-5" />
                ) : (
                  <Maximize2 className="h-5 w-5" />
                )}
              </button>
            </div>
            
            {/* Vimeo Progress Tracker */}
            <Card className={`border-2 ${videoWatched ? 'bg-green-900/30 border-green-700' : 'bg-blue-900/30 border-blue-700'}`}>
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Video className={`h-4 w-4 ${videoWatched ? 'text-green-400' : 'text-blue-400'}`} />
                    <span className={`text-sm font-medium ${videoWatched ? 'text-green-200' : 'text-blue-200'}`}>
                      Video Progress
                    </span>
                  </div>
                  {videoWatched ? (
                    <Badge className="bg-green-600">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Completed
                    </Badge>
                  ) : (
                    <span className="text-sm text-gray-300">
                      {Math.round(videoProgress)}% watched
                    </span>
                  )}
                </div>
                
                <Progress value={videoProgress} className="h-2" />
                
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(videoDuration)}</span>
                </div>
                
                {!videoWatched && videoProgress > 0 && (
                  <div className="flex items-center space-x-2 text-xs text-blue-300">
                    <Lock className="h-3 w-3" />
                    <span>Watch at least 90% to unlock next lesson</span>
                  </div>
                )}
              </div>
            </Card>
          </div>
        );
      }
    }
    
    // Direct video URL with progress tracking and enhanced controls
    return (
      <div className="space-y-4">
        <div 
          ref={videoContainerRef}
          className="relative aspect-video rounded-lg overflow-hidden bg-black group"
        >
          <video
            ref={videoRef}
            controls
            controlsList="nodownload"
            className="w-full h-full"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          >
            <source src={videoUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
          <button
            onClick={() => handleFullscreenToggle(videoContainerRef.current)}
            className="absolute bottom-4 right-4 bg-black/60 hover:bg-black/80 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
            title={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {fullscreen ? (
              <Minimize2 className="h-5 w-5" />
            ) : (
              <Maximize2 className="h-5 w-5" />
            )}
          </button>
        </div>
        
        {/* Enhanced Video Controls */}
        <Card className="bg-gray-800/50 border-gray-700">
          <div className="p-4 space-y-4">
            {/* Playback Speed Control */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Settings className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-300">Playback Speed:</span>
              </div>
              <Select
                value={playbackSpeed.toString()}
                onValueChange={(value) => handlePlaybackSpeedChange(parseFloat(value))}
              >
                <SelectTrigger className="w-24 h-8 text-xs bg-gray-700 border-gray-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.5">0.5x</SelectItem>
                  <SelectItem value="0.75">0.75x</SelectItem>
                  <SelectItem value="1">1x</SelectItem>
                  <SelectItem value="1.25">1.25x</SelectItem>
                  <SelectItem value="1.5">1.5x</SelectItem>
                  <SelectItem value="1.75">1.75x</SelectItem>
                  <SelectItem value="2">2x</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Video Progress Section */}
            <div className="space-y-3 pt-3 border-t border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Video className={`h-4 w-4 ${videoWatched ? 'text-green-400' : 'text-blue-400'}`} />
                  <span className={`text-sm font-medium ${videoWatched ? 'text-green-200' : 'text-blue-200'}`}>
                    Video Progress
                  </span>
                </div>
                {videoWatched ? (
                  <Badge className="bg-green-600">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Completed
                  </Badge>
                ) : (
                  <span className="text-sm text-gray-300">
                    {Math.round(videoProgress)}% watched
                  </span>
                )}
              </div>
              
              <Progress value={videoProgress} className="h-2" />
              
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(videoDuration)}</span>
              </div>
              
              {!videoWatched && videoProgress > 0 && (
                <div className="flex items-center space-x-2 text-xs text-blue-300">
                  <Lock className="h-3 w-3" />
                  <span>Watch at least 90% to unlock next lesson</span>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    );
  };

  // Helper function to convert Google Drive links to embeddable format
  const convertToEmbeddablePdfUrl = (pdfUrl: string): string => {
    // Check if it's a Google Drive link
    const driveRegex = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
    const driveMatch = pdfUrl.match(driveRegex);
    
    if (driveMatch) {
      const fileId = driveMatch[1];
      // Convert to preview format for embedding
      return `https://drive.google.com/file/d/${fileId}/preview`;
    }
    
    // Check if it's already a Google Drive preview link
    if (pdfUrl.includes('drive.google.com') && pdfUrl.includes('/preview')) {
      return pdfUrl;
    }
    
    // For other URLs, return as is
    return pdfUrl;
  };

  const renderPdfContent = (pdfUrl: string) => {
    const embeddableUrl = convertToEmbeddablePdfUrl(pdfUrl);
    const isGoogleDrive = pdfUrl.includes('drive.google.com');
    const downloadUrl = isGoogleDrive 
      ? pdfUrl.replace('/preview', '/view?usp=sharing') 
      : pdfUrl;
    
    return (
      <div className="space-y-4">
        <Card className="bg-gradient-to-r from-red-900/30 to-orange-900/30 border-red-800">
          <div className="p-6">
            <div className="flex flex-col gap-4">
              {/* Header Section */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center space-x-4">
                  <div className="h-12 w-12 bg-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">PDF Document</h4>
                    <p className="text-sm text-gray-300">
                      {isGoogleDrive ? 'Google Drive PDF' : 'View or download the lesson material'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => window.open(downloadUrl, '_blank')}
                    className="bg-red-600 hover:bg-red-700 text-sm"
                    size="sm"
                  >
                    <Maximize2 className="h-4 w-4 mr-2" />
                    Open in New Tab
                  </Button>
                  {!isGoogleDrive && (
                    <Button 
                      variant="outline" 
                      className="border-gray-600 text-gray-300 hover:bg-gray-700 text-sm" 
                      size="sm"
                      asChild
                    >
                      <a href={pdfUrl} download>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </a>
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Zoom Controls (for non-Google Drive PDFs) */}
              {!isGoogleDrive && (
                <div className="flex items-center justify-between pt-2 border-t border-red-800/50">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-300">Zoom:</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPdfZoom(Math.max(50, pdfZoom - 25))}
                      disabled={pdfZoom <= 50}
                      className="h-7 w-7 p-0"
                    >
                      <ZoomOut className="h-3 w-3" />
                    </Button>
                    <span className="text-sm font-medium text-white min-w-[50px] text-center">
                      {pdfZoom}%
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPdfZoom(Math.min(200, pdfZoom + 25))}
                      disabled={pdfZoom >= 200}
                      className="h-7 w-7 p-0"
                    >
                      <ZoomIn className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPdfZoom(100)}
                    className="text-xs text-gray-400 hover:text-white"
                  >
                    Reset
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>
        
        {/* PDF Viewer */}
        <div 
          className="border border-gray-700 rounded-lg overflow-hidden bg-gray-900 relative" 
          style={{ minHeight: '600px', height: '80vh' }}
        >
          <iframe
            src={embeddableUrl}
            className="w-full h-full"
            style={{ 
              transform: `scale(${pdfZoom / 100})`,
              transformOrigin: 'top left',
              width: `${10000 / pdfZoom}%`,
              height: `${10000 / pdfZoom}%`
            }}
            title="PDF Viewer"
            allow="autoplay"
          />
        </div>
        
        {/* Helper text for Google Drive PDFs */}
        {isGoogleDrive && (
          <Alert className="bg-blue-900/20 border border-blue-700/50">
            <AlertCircle className="h-4 w-4 text-blue-400" />
            <AlertDescription className="text-blue-300">
              <strong>Tip:</strong> If the PDF doesn't display, make sure the Google Drive file has proper sharing permissions set to "Anyone with the link can view".
            </AlertDescription>
          </Alert>
        )}
        
        {/* Mobile-friendly message */}
        <div className="block sm:hidden">
          <Alert className="bg-gray-800/50 border-gray-700">
            <AlertCircle className="h-4 w-4 text-gray-400" />
            <AlertDescription className="text-gray-300">
              <strong>Mobile Tip:</strong> For the best reading experience, tap "Open in New Tab" to view the PDF in full screen.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  };

  // Enhanced mixed content parser with robust error handling
  const parseMixedContent = (contentData: string): MixedContentSection[] => {
    setMixedContentError(null);
    
    try {
      // First, try to parse as JSON
      const parsed = JSON.parse(contentData);
      
      // Validate the structure
      if (Array.isArray(parsed)) {
        return parsed.filter(section => section && section.type);
      }
      
      if (parsed.sections && Array.isArray(parsed.sections)) {
        return parsed.sections.filter((section: any) => section && section.type);
      }
      
      if (parsed.content && Array.isArray(parsed.content)) {
        return parsed.content.filter((section: any) => section && section.type);
      }
      
      // If it's an object with type property, wrap it in an array
      if (parsed.type) {
        return [parsed];
      }
      
      // Couldn't extract sections from JSON
      setMixedContentError('Invalid mixed content format. Displaying as text.');
      return [{ type: 'text', content: contentData }];
      
    } catch (jsonError) {
      // Not JSON, try to parse as markdown with embedded media
      try {
        const sections: MixedContentSection[] = [];
        const lines = contentData.split('\n');
        let currentTextBlock = '';
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          
          // Detect YouTube/Vimeo video URLs
          if (line.match(/^https?:\/\/(www\.)?(youtube\.com|youtu\.be|vimeo\.com)/)) {
            // Save any accumulated text
            if (currentTextBlock.trim()) {
              sections.push({ type: 'text', content: currentTextBlock.trim() });
              currentTextBlock = '';
            }
            sections.push({ type: 'video', url: line });
            continue;
          }
          
          // Detect PDF URLs
          if (line.match(/^https?:\/\/.*\.pdf$/i) || line.includes('drive.google.com')) {
            if (currentTextBlock.trim()) {
              sections.push({ type: 'text', content: currentTextBlock.trim() });
              currentTextBlock = '';
            }
            sections.push({ type: 'pdf', url: line });
            continue;
          }
          
          // Detect markdown image syntax ![alt](url)
          const imgMatch = line.match(/!\[([^\]]*)\]\(([^)]+)\)/);
          if (imgMatch) {
            if (currentTextBlock.trim()) {
              sections.push({ type: 'text', content: currentTextBlock.trim() });
              currentTextBlock = '';
            }
            sections.push({ type: 'image', url: imgMatch[2], alt: imgMatch[1] });
            continue;
          }
          
          // Detect markdown headings
          const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
          if (headingMatch) {
            if (currentTextBlock.trim()) {
              sections.push({ type: 'text', content: currentTextBlock.trim() });
              currentTextBlock = '';
            }
            sections.push({ 
              type: 'heading', 
              level: headingMatch[1].length, 
              title: headingMatch[2] 
            });
            continue;
          }
          
          // Accumulate regular text
          currentTextBlock += line + '\n';
        }
        
        // Add remaining text
        if (currentTextBlock.trim()) {
          sections.push({ type: 'text', content: currentTextBlock.trim() });
        }
        
        return sections.length > 0 ? sections : [{ type: 'text', content: contentData }];
        
      } catch (parseError) {
        console.error('Error parsing mixed content:', parseError);
        setMixedContentError('Failed to parse content structure. Displaying as text.');
        return [{ type: 'text', content: contentData }];
      }
    }
  };

  const renderMixedContent = (contentData: string) => {
    const sections = parseMixedContent(contentData);
    
    return (
      <div className="space-y-6">
        {/* Error Alert */}
        {mixedContentError && (
          <Alert className="bg-yellow-900/20 border-yellow-700">
            <AlertCircle className="h-4 w-4 text-yellow-400" />
            <AlertDescription className="text-yellow-200">
              {mixedContentError}
            </AlertDescription>
          </Alert>
        )}
        
        {/* Content Navigation (if multiple sections) */}
        {sections.length > 3 && (
          <Card className="bg-gray-800/50 border-gray-700">
            <div className="p-4">
              <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center">
                <BookOpen className="h-4 w-4 mr-2" />
                Content Sections ({sections.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {sections.map((section, index) => (
                  <Button
                    key={index}
                    variant={activeContentSection === index ? "default" : "outline"}
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      setActiveContentSection(index);
                      contentSectionRefs.current[index]?.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'start' 
                      });
                    }}
                  >
                    {section.type === 'heading' ? section.title?.substring(0, 20) : 
                     section.type === 'text' ? `Text ${index + 1}` :
                     section.type === 'video' ? `Video ${index + 1}` :
                     section.type === 'pdf' ? `PDF ${index + 1}` :
                     section.type === 'image' ? `Image ${index + 1}` :
                     `Section ${index + 1}`}
                  </Button>
                ))}
              </div>
            </div>
          </Card>
        )}
        
        {/* Render Content Sections */}
        {sections.map((section, index) => (
          <div 
            key={index} 
            ref={(el) => contentSectionRefs.current[index] = el}
            className="scroll-mt-6"
          >
            {section.type === 'heading' && (
              <div className={`
                ${section.level === 1 ? 'text-3xl sm:text-4xl font-bold text-white mb-6 pb-3 border-b border-gray-700' : ''}
                ${section.level === 2 ? 'text-2xl sm:text-3xl font-bold text-white mb-5 pb-2 border-b border-gray-700/50' : ''}
                ${section.level === 3 ? 'text-xl sm:text-2xl font-semibold text-white mb-4' : ''}
                ${section.level === 4 ? 'text-lg sm:text-xl font-semibold text-gray-200 mb-3' : ''}
                ${section.level === 5 ? 'text-base sm:text-lg font-semibold text-gray-300 mb-2' : ''}
                ${section.level === 6 ? 'text-sm sm:text-base font-semibold text-gray-400 mb-2' : ''}
              `}>
                {section.title}
              </div>
            )}
            
            {section.type === 'text' && section.content && (
              <Card className="bg-gray-800/30 border-gray-700 p-6">
                {renderTextContent(section.content)}
              </Card>
            )}
            
            {section.type === 'video' && section.url && (
              <Card className="bg-gray-800/30 border-gray-700 p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <Video className="h-5 w-5 text-blue-400" />
                  <h4 className="font-semibold text-white">Video Content</h4>
                  <Badge variant="outline" className="ml-auto">Section {index + 1}</Badge>
                </div>
                {renderVideoContent(section.url)}
              </Card>
            )}
            
            {section.type === 'pdf' && section.url && (
              <Card className="bg-gray-800/30 border-gray-700 p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <FileText className="h-5 w-5 text-red-400" />
                  <h4 className="font-semibold text-white">PDF Document</h4>
                  <Badge variant="outline" className="ml-auto">Section {index + 1}</Badge>
                </div>
                {renderPdfContent(section.url)}
              </Card>
            )}
            
            {section.type === 'image' && section.url && (
              <Card className="bg-gray-800/30 border-gray-700 p-6">
                <img 
                  src={section.url} 
                  alt={section.alt || 'Lesson image'} 
                  className="w-full rounded-lg shadow-lg"
                  loading="lazy"
                />
                {section.alt && (
                  <p className="text-sm text-gray-400 mt-2 text-center italic">{section.alt}</p>
                )}
              </Card>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 w-full">
      {/* Keyboard Shortcuts Help (for video content) */}
      {lesson.content_type === 'video' && (
        <Alert className="bg-gray-800/50 border-gray-700">
          <Settings className="h-4 w-4 text-gray-400" />
          <AlertDescription className="text-gray-300 text-sm">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span><kbd className="px-2 py-0.5 bg-gray-700 rounded text-xs">Space</kbd> Play/Pause</span>
              <span><kbd className="px-2 py-0.5 bg-gray-700 rounded text-xs">←/→</kbd> Skip 5s</span>
              <span><kbd className="px-2 py-0.5 bg-gray-700 rounded text-xs">↑/↓</kbd> Volume</span>
              <span><kbd className="px-2 py-0.5 bg-gray-700 rounded text-xs">F</kbd> Fullscreen</span>
              <span><kbd className="px-2 py-0.5 bg-gray-700 rounded text-xs">&gt;/&lt;</kbd> Speed</span>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      {/* Content Header */}
      <div className="bg-gradient-to-r from-blue-900/30 to-indigo-900/30 rounded-lg p-6 border border-blue-800/50 w-full">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-white mb-2">
              {lesson.title}
            </h3>
            {lesson.description && (
              <p className="text-gray-300">{lesson.description}</p>
            )}
          </div>
          
          <div className="flex items-center space-x-2 flex-wrap">
            <Badge variant="secondary" className="flex items-center space-x-1 bg-gray-700 text-gray-200">
              {lesson.content_type === 'text' && <FileText className="h-3 w-3" />}
              {lesson.content_type === 'video' && <Video className="h-3 w-3" />}
              {lesson.content_type === 'pdf' && <FileText className="h-3 w-3" />}
              {lesson.content_type === 'mixed' && <BookOpen className="h-3 w-3" />}
              <span className="capitalize">{lesson.content_type}</span>
            </Badge>
            
            {lesson.duration_minutes && (
              <Badge variant="outline" className="flex items-center space-x-1 border-gray-600 text-gray-300">
                <Clock className="h-3 w-3" />
                <span>{lesson.duration_minutes} min</span>
              </Badge>
            )}
          </div>
        </div>
        
        {/* Learning Objectives */}
        {lesson.learning_objectives && (
          <div className="bg-gray-800/50 rounded-lg p-4 border-l-4 border-blue-500 mt-4">
            <h4 className="font-semibold text-white mb-2 flex items-center">
              <BookOpen className="h-4 w-4 mr-2 text-blue-400" />
              Learning Objectives:
            </h4>
            <div className="text-gray-300 text-sm prose prose-invert prose-sm max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
              >
                {lesson.learning_objectives}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      {/* Content Display based on type */}
      <div className="bg-gray-800/30 rounded-lg p-4 sm:p-6 border border-gray-700 w-full">
        {lesson.content_type === 'text' && renderTextContent(lesson.content_data)}
        {lesson.content_type === 'video' && renderVideoContent(lesson.content_data)}
        {lesson.content_type === 'pdf' && renderPdfContent(lesson.content_data)}
        {lesson.content_type === 'mixed' && renderMixedContent(lesson.content_data)}
      </div>
    </div>
  );
};
