import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  AlertCircle,
  Loader2
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
  onMixedContentVideoProgress?: (videoIndex: number, progress: number) => void;
  onMixedContentVideoComplete?: (videoIndex: number) => void;
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
  onVideoProgress,
  onMixedContentVideoProgress,
  onMixedContentVideoComplete
}) => {
  // Debug: Log the entire lesson object when component mounts or lesson changes
  useEffect(() => {
    console.log('=== ContentRichPreview Lesson Data ===');
    console.log('Lesson:', lesson);
    console.log('Content Type:', lesson.content_type);
    console.log('Content Data (raw):', lesson.content_data);
    console.log('Content Data type:', typeof lesson.content_data);
    console.log('Content Data length:', lesson.content_data?.length);
    
    if (lesson.content_type === 'mixed') {
      try {
        const parsed = JSON.parse(lesson.content_data);
        console.log('Parsed mixed content:', parsed);
        console.log('Number of sections:', Array.isArray(parsed) ? parsed.length : 'Not an array');
      } catch (e) {
        console.error('Failed to parse mixed content:', e);
      }
    }
    console.log('======================================');
  }, [lesson]);
  
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
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const youtubePlayerRef = useRef<any>(null);
  const vimeoPlayerRef = useRef<any>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const contentSectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  // Refs for tracking mixed content videos
  const mixedVideoRefs = useRef<{[key: string]: {
    iframe?: HTMLIFrameElement | null;
    player?: any;
    interval?: NodeJS.Timeout;
    videoElement?: HTMLVideoElement | null;
  }}>({});

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
      
      // Always call onVideoProgress for both main video and mixed content
      if (onVideoProgress) {
        onVideoProgress(progress);
      }
      
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

  // Load YouTube API (works for both main video lessons and mixed content)
  useEffect(() => {
    // Check if we need YouTube API (either main video or mixed content with YouTube)
    const needsYouTubeAPI = 
      (lesson.content_type === 'video' && (lesson.content_data.includes('youtube.com') || lesson.content_data.includes('youtu.be'))) ||
      (lesson.content_type === 'mixed' && lesson.content_data.includes('youtube.com'));
    
    if (!needsYouTubeAPI) return;

    // Load YouTube IFrame API if not already loaded
    if (!(window as any).YT) {
      console.log('📺 Loading YouTube IFrame API...');
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
                
                // Always call onVideoProgress for both main video and mixed content
                if (onVideoProgress) {
                  onVideoProgress(progress);
                }
                
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
          
          // Always call onVideoProgress for both main video and mixed content
          if (onVideoProgress) {
            onVideoProgress(progress);
          }
          
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
      // Cleanup mixed content video players
      Object.values(mixedVideoRefs.current).forEach(({ player, interval }) => {
        if (interval) clearInterval(interval);
        if (player?.destroy) player.destroy();
      });
    };
  }, []);

  // Initialize YouTube player for MAIN video lessons
  useEffect(() => {
    if (lesson.content_type !== 'video') return;
    if (!lesson.content_data || !(window as any).YT || !(window as any).YT.Player) return;
    
    const videoUrl = lesson.content_data.trim();
    const isYouTube = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
    
    if (!isYouTube) return;
    
    console.log('🎬 Initializing MAIN YouTube video player');
    
    const timeoutId = setTimeout(() => {
      const iframe = document.getElementById('main-youtube-video');
      if (!iframe) {
        console.warn('❌ Main YouTube iframe not found');
        return;
      }
      
      try {
        const player = new (window as any).YT.Player('main-youtube-video', {
          events: {
            onReady: (event: any) => {
              console.log('✅ Main YouTube player ready');
              youtubePlayerRef.current = player;
              
              // Start tracking progress
              const interval = setInterval(() => {
                try {
                  const currentTime = event.target.getCurrentTime();
                  const duration = event.target.getDuration();
                  
                  if (duration > 0) {
                    const progress = (currentTime / duration) * 100;
                    
                    // Update local state for UI display
                    setVideoProgress(progress);
                    setCurrentTime(currentTime);
                    setVideoDuration(duration);
                    
                    if (typeof onVideoProgress === 'function' && progress > 0) {
                      console.log(`📊 Main video progress:`, progress.toFixed(1) + '%');
                      onVideoProgress(progress);
                    }
                    
                    // Mark as complete at 90%
                    if (progress >= 90 && typeof onVideoComplete === 'function') {
                      console.log('✅ Main video completed');
                      setVideoWatched(true);
                      onVideoComplete();
                      clearInterval(interval);
                    }
                  }
                } catch (error) {
                  console.error('Error tracking main YouTube video:', error);
                }
              }, 2000);
              
              progressIntervalRef.current = interval;
            },
            onError: (event: any) => {
              console.error('❌ Main YouTube player error:', event.data);
            }
          }
        });
      } catch (error) {
        console.error('Failed to initialize main YouTube player:', error);
      }
    }, 1000);
    
    return () => {
      clearTimeout(timeoutId);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (youtubePlayerRef.current?.destroy) youtubePlayerRef.current.destroy();
    };
  }, [lesson.content_type, lesson.content_data, lesson.title, onVideoProgress, onVideoComplete]);

  // Initialize Vimeo player for MAIN video lessons
  useEffect(() => {
    if (lesson.content_type !== 'video') return;
    if (!lesson.content_data || typeof window === 'undefined' || !(window as any).Vimeo) return;
    
    const videoUrl = lesson.content_data.trim();
    const isVimeo = videoUrl.includes('vimeo.com');
    
    if (!isVimeo) return;
    
    console.log('🎬 Initializing MAIN Vimeo video player');
    
    const timeoutId = setTimeout(() => {
      const iframe = document.getElementById('main-vimeo-video');
      if (!iframe) {
        console.warn('❌ Main Vimeo iframe not found');
        return;
      }
      
      try {
        const player = new (window as any).Vimeo.Player(iframe);
        vimeoPlayerRef.current = player;
        
        player.on('loaded', () => {
          console.log('📺 Main Vimeo player ready');
        });
        
        player.on('timeupdate', async (data: any) => {
          try {
            const progress = (data.percent || 0) * 100;
            
            // Update local state for UI display
            setVideoProgress(progress);
            setCurrentTime(data.seconds || 0);
            
            // Get duration if not set
            if (videoDuration === 0 && player) {
              player.getDuration().then((duration: number) => {
                setVideoDuration(duration);
              });
            }
            
            if (typeof onVideoProgress === 'function') {
              console.log(`📊 Main Vimeo video progress:`, progress.toFixed(1) + '%');
              onVideoProgress(progress);
            }
            
            // Check for completion (90% threshold)
            if (progress >= 90 && typeof onVideoComplete === 'function') {
              console.log('✅ Main Vimeo video completed');
              setVideoWatched(true);
              onVideoComplete();
            }
          } catch (error) {
            console.error('Error tracking main Vimeo video:', error);
          }
        });
        
        player.on('error', (error: any) => {
          console.error('❌ Main Vimeo player error:', error);
        });
      } catch (error) {
        console.error('Failed to initialize main Vimeo player:', error);
      }
    }, 1000);
    
    return () => {
      clearTimeout(timeoutId);
      if (vimeoPlayerRef.current?.off) {
        vimeoPlayerRef.current.off('timeupdate');
        vimeoPlayerRef.current.off('loaded');
        vimeoPlayerRef.current.off('error');
      }
    };
  }, [lesson.content_type, lesson.content_data, lesson.title, onVideoProgress, onVideoComplete]);

  // Initialize YouTube players for mixed content videos
  useEffect(() => {
    if (lesson.content_type !== 'mixed') return;
    if (!(window as any).YT || !(window as any).YT.Player) {
      console.log('⚠️ YouTube IFrame API not loaded yet');
      return;
    }

    console.log('🎬 Starting YouTube player initialization for mixed content...');

    // Small delay to ensure DOM is fully rendered
    const timeoutId = setTimeout(() => {
      try {
        // Parse mixed content to find YouTube videos
        const content = typeof lesson.content_data === 'string' 
          ? JSON.parse(lesson.content_data) 
          : lesson.content_data;
        
        const sections = Array.isArray(content) ? content : (content.sections || []);
        
        console.log(`📋 Found ${sections.length} total sections in mixed content`);
        
        sections.forEach((section: any, index: number) => {
        if (section.type !== 'video') return;
        
        // Get video URL from multiple possible locations with priority order
        const videoUrl = (section.url || section.metadata?.url || section.content || '').trim();
        const isYouTube = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
        
        console.log(`🔍 Checking section ${index} for YouTube video:`, { 
          type: section.type, 
          videoUrl, 
          isYouTube,
          hasUrl: !!section.url,
          hasMetadataUrl: !!section.metadata?.url,
          hasContent: !!section.content
        });
        
        if (!isYouTube) return;
        
        const videoId = videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1];
        if (!videoId) return;
        
        const playerId = `mixed-youtube-${index}`;
        const existingPlayer = mixedVideoRefs.current[playerId];
        
        // Don't reinitialize if player already exists
        if (existingPlayer?.player) return;
        
        console.log(`🎬 Initializing YouTube player for mixed content video ${index}:`, videoId);
        
        // Find the iframe element
        const iframe = document.getElementById(playerId) as HTMLIFrameElement;
        if (!iframe) {
          console.warn(`❌ Could not find iframe with id ${playerId}`);
          return;
        }
        
        try {
          const player = new (window as any).YT.Player(playerId, {
            events: {
              onReady: (event: any) => {
                const duration = event.target.getDuration();
                console.log(`✅ YouTube player ${index} ready, duration: ${duration}s`);
                
                // Start tracking progress
                const interval = setInterval(() => {
                  try {
                    const currentTime = event.target.getCurrentTime();
                    const duration = event.target.getDuration();
                    
                    if (duration > 0) {
                      const progress = (currentTime / duration) * 100;
                      
                      // Track progress for mixed content videos
                      console.log(`📊 Mixed YouTube video ${index} progress:`, progress.toFixed(1));
                      
                      if (typeof onMixedContentVideoProgress === 'function') {
                        try {
                          onMixedContentVideoProgress(index, progress);
                        } catch (error) {
                          console.error('Error calling onMixedContentVideoProgress:', error);
                        }
                      }
                      
                      // Mark as watched if >= 90%
                      if (progress >= 90) {
                        console.log(`✅ Mixed YouTube video ${index} completed (90% threshold)`);
                        
                        if (typeof onMixedContentVideoComplete === 'function') {
                          try {
                            onMixedContentVideoComplete(index);
                          } catch (error) {
                            console.error('Error calling onMixedContentVideoComplete:', error);
                          }
                        }
                        
                        if (interval) clearInterval(interval);
                      }
                    }
                  } catch (error) {
                    console.error(`Error tracking YouTube video ${index}:`, error);
                  }
                }, 2000); // Update every 2 seconds
                
                mixedVideoRefs.current[playerId] = {
                  ...mixedVideoRefs.current[playerId],
                  player,
                  interval
                };
              },
              onError: (event: any) => {
                console.error(`❌ YouTube player ${index} error:`, event.data);
              }
            }
          });
        } catch (error) {
          console.error(`Failed to initialize YouTube player ${index}:`, error);
        }
      });
      } catch (error) {
        console.error('Error parsing mixed content for YouTube players:', error);
      }
    }, 1000); // 1 second delay to ensure DOM is ready
    
    // Cleanup on unmount or content change
    return () => {
      clearTimeout(timeoutId);
      Object.values(mixedVideoRefs.current).forEach(({ player, interval }) => {
        if (interval) clearInterval(interval);
        if (player?.destroy) player.destroy();
      });
      mixedVideoRefs.current = {};
    };
  }, [lesson.content_type, lesson.content_data, onVideoProgress, onVideoComplete]);

  // Initialize Vimeo players for mixed content videos
  useEffect(() => {
    if (lesson.content_type !== 'mixed' || !lesson.content_data) return;
    if (typeof window === 'undefined' || !(window as any).Vimeo) {
      console.log('⚠️ Vimeo Player API not loaded yet');
      return;
    }

    console.log('🎬 Starting Vimeo player initialization for mixed content...');

    // Small delay to ensure DOM is fully rendered
    const timeoutId = setTimeout(() => {
      try {
        const content = JSON.parse(lesson.content_data);
      if (!Array.isArray(content.sections)) return;

      // Find all video sections with Vimeo URLs
      const vimeoSections = content.sections
        .map((section: any, index: number) => {
          const videoUrl = (section.url || section.metadata?.url || section.content || '').trim();
          return { section, index, videoUrl };
        })
        .filter(({ videoUrl }: any) => 
          videoUrl && /vimeo\.com/.test(videoUrl)
        );

      console.log(`Found ${vimeoSections.length} Vimeo videos in mixed content`);

      vimeoSections.forEach(({ section, index, videoUrl }: any) => {
        const playerId = `mixed-vimeo-${index}`;
        const iframe = document.getElementById(playerId) as HTMLIFrameElement;

        if (!iframe) {
          console.warn(`❌ Could not find iframe with id ${playerId}`);
          return;
        }

        try {
          console.log(`Initializing Vimeo player ${index}...`);
          const player = new (window as any).Vimeo.Player(iframe);
          
          console.log(`✅ Vimeo player ${index} initialized`);

          player.on('loaded', () => {
            console.log(`📺 Vimeo player ${index} ready`);
          });

          // Track progress
          player.on('timeupdate', async (data: any) => {
            try {
              const progress = (data.percent || 0) * 100;
              
              console.log(`📊 Mixed Vimeo video ${index} progress:`, progress.toFixed(1) + '%');
              
              if (typeof onMixedContentVideoProgress === 'function') {
                try {
                  onMixedContentVideoProgress(index, progress);
                } catch (error) {
                  console.error('Error calling onMixedContentVideoProgress:', error);
                }
              }

              // Check for completion (90% threshold)
              if (progress >= 90) {
                console.log(`✅ Mixed Vimeo video ${index} completed (90% threshold)`);
                
                if (typeof onMixedContentVideoComplete === 'function') {
                  try {
                    onMixedContentVideoComplete(index);
                  } catch (error) {
                    console.error('Error calling onMixedContentVideoComplete:', error);
                  }
                }
              }
            } catch (error) {
              console.error(`Error tracking Vimeo video ${index}:`, error);
            }
          });

          player.on('error', (error: any) => {
            console.error(`❌ Vimeo player ${index} error:`, error);
          });

          mixedVideoRefs.current[playerId] = {
            ...mixedVideoRefs.current[playerId],
            player
          };
        } catch (error) {
          console.error(`Failed to initialize Vimeo player ${index}:`, error);
        }
      });
      } catch (error) {
        console.error('Error parsing mixed content for Vimeo players:', error);
      }
    }, 1000); // 1 second delay to ensure DOM is ready

    // Cleanup on unmount or content change
    return () => {
      clearTimeout(timeoutId);
      Object.values(mixedVideoRefs.current).forEach(({ player }) => {
        if (player?.off) {
          player.off('timeupdate');
          player.off('loaded');
          player.off('error');
        }
      });
    };
  }, [lesson.content_type, lesson.content_data, lesson.title, onVideoProgress, onVideoComplete, onMixedContentVideoProgress, onMixedContentVideoComplete]);

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

  const renderVideoContent = (videoUrl: string, mixedContentIndex?: number) => {
    // Debug logging
    console.log('🎬 renderVideoContent called with:', { 
      videoUrl, 
      mixedContentIndex, 
      contentType: lesson.content_type,
      isMainVideo: lesson.content_type === 'video' && mixedContentIndex === undefined
    });
    
    // Validate URL first
    if (!videoUrl || videoUrl.trim() === '') {
      setVideoError('No video URL provided');
      return (
        <Alert className="bg-red-900/20 border-red-700">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <AlertDescription className="text-red-200">
            <p className="font-semibold text-base mb-2">❌ Video URL Missing</p>
            <p className="text-sm">No video URL was provided for this section.</p>
          </AlertDescription>
        </Alert>
      );
    }
    
    // Support YouTube, Vimeo, and direct video URLs
    const isYouTube = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
    const isVimeo = videoUrl.includes('vimeo.com');
    const isDirect = !isYouTube && !isVimeo && /\.(mp4|webm|ogg|mov)$/i.test(videoUrl);
    
    console.log('🎬 Video type detection:', { isYouTube, isVimeo, isDirect, videoUrl });
    
    // Reset playerReady for YouTube videos in mixed content
    useEffect(() => {
      if (isYouTube) {
        setPlayerReady(false);
        
        // Fallback timeout to hide loading after 10 seconds
        const timeout = setTimeout(() => {
          console.warn('⏱️ YouTube loading timeout - forcing playerReady');
          setPlayerReady(true);
        }, 10000);
        
        return () => clearTimeout(timeout);
      }
    }, [videoUrl]);
    
    if (isYouTube) {
      // Extract YouTube video ID
      const videoId = videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1];
      console.log('🎬 Extracted YouTube video ID:', videoId);
      
      if (!videoId) {
        setVideoError('Invalid YouTube URL format');
        return (
          <Alert className="bg-red-900/20 border-red-700">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <AlertDescription className="text-red-200">
              <p className="font-semibold text-base mb-2">❌ Invalid YouTube URL</p>
              <p className="text-sm mb-2">Could not extract video ID from the YouTube URL.</p>
              <p className="text-xs font-mono bg-black/30 p-2 rounded break-all">{videoUrl}</p>
            </AlertDescription>
          </Alert>
        );
      }
      
      // Check if this is a main video (not mixed content)
      const isMainVideo = lesson.content_type === 'video' && mixedContentIndex === undefined;
      console.log('🎬 Video type:', isMainVideo ? 'MAIN VIDEO' : 'MIXED CONTENT VIDEO');
      
      return (
        <div className="space-y-4">
          <div 
            ref={videoContainerRef}
            className="relative aspect-video rounded-lg overflow-hidden bg-black group shadow-2xl"
            role="region"
            aria-label="Video player"
          >
            <iframe
              id={mixedContentIndex !== undefined ? `mixed-youtube-${mixedContentIndex}` : 'main-youtube-video'}
              ref={iframeRef}
              src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${window.location.origin}`}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={`YouTube video: ${lesson.title}`}
              onLoad={() => {
                console.log('🎬 YouTube iframe loaded' + (mixedContentIndex !== undefined ? ` (mixed ${mixedContentIndex})` : ''));
                // Short delay to ensure iframe is fully initialized
                setTimeout(() => {
                  console.log('🎬 Setting playerReady to true' + (mixedContentIndex !== undefined ? ` (mixed ${mixedContentIndex})` : ''));
                  setPlayerReady(true);
                }, 1000);
              }}
            />
            
            {/* Loading state overlay for YouTube */}
            {!playerReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-20">
                <div className="flex flex-col items-center space-y-3">
                  <Loader2 className="h-10 w-10 sm:h-12 sm:w-12 text-red-500 animate-spin" />
                  <span className="text-sm sm:text-base text-white font-medium">Loading YouTube video...</span>
                  <span className="text-xs text-gray-400">Connecting to YouTube</span>
                </div>
              </div>
            )}
            
            {/* Enhanced fullscreen button with better mobile support */}
            <button
              onClick={() => handleFullscreenToggle(videoContainerRef.current)}
              className="absolute bottom-4 right-4 bg-black/70 hover:bg-black/90 text-white p-2.5 sm:p-3 rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all duration-200 shadow-lg z-10"
              title={fullscreen ? "Exit fullscreen (F)" : "Enter fullscreen (F)"}
              aria-label={fullscreen ? "Exit fullscreen mode" : "Enter fullscreen mode"}
            >
              {fullscreen ? (
                <Minimize2 className="h-4 w-4 sm:h-5 sm:w-5" />
              ) : (
                <Maximize2 className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
            </button>
          </div>
          
          {/* YouTube Progress Tracker */}
          <Card 
            className={`border-2 ${videoWatched ? 'bg-green-900/30 border-green-700' : 'bg-blue-900/30 border-blue-700'}`}
            role="status"
            aria-live="polite"
          >
            <div className="p-3 sm:p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                <div className="flex items-center space-x-2">
                  <Video className={`h-4 w-4 ${videoWatched ? 'text-green-400' : 'text-blue-400'}`} aria-hidden="true" />
                  <span className={`text-sm font-medium ${videoWatched ? 'text-green-200' : 'text-blue-200'}`}>
                    Video Progress
                  </span>
                </div>
                {videoWatched ? (
                  <Badge className="bg-green-600 w-fit">
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
                <div className="flex items-center space-x-2 text-xs text-blue-300 bg-blue-950/50 p-2 rounded" role="alert">
                  <Lock className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                  <span>Watch at least 90% to unlock next lesson</span>
                </div>
              )}
            </div>
          </Card>
        </div>
      );
    } else if (isVimeo) {
      // Extract Vimeo video ID
      const videoId = videoUrl.match(/vimeo\.com\/(\d+)/)?.[1];
      
      // Set loading state for Vimeo
      setVideoLoading(true);
      
      // Fallback timeout to hide loading after 8 seconds
      const timeout = setTimeout(() => {
        console.warn('⏱️ Vimeo loading timeout - forcing videoLoading false');
        setVideoLoading(false);
      }, 8000);
      
      // Cleanup timeout on unmount
      useEffect(() => {
        return () => clearTimeout(timeout);
      }, []);
      
      if (!videoId) {
        setVideoError('Invalid Vimeo URL format');
        return (
          <Alert className="bg-red-900/20 border-red-700">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <AlertDescription className="text-red-200">
              <p className="font-semibold text-base mb-2">❌ Invalid Vimeo URL</p>
              <p className="text-sm mb-2">Could not extract video ID from the Vimeo URL.</p>
              <p className="text-xs font-mono bg-black/30 p-2 rounded break-all">{videoUrl}</p>
            </AlertDescription>
          </Alert>
        );
      }
      
      return (
        <div className="space-y-4">
          <div 
            ref={videoContainerRef}
            className="relative aspect-video rounded-lg overflow-hidden bg-black group shadow-2xl"
            role="region"
            aria-label="Vimeo video player"
          >
            <iframe
              id={mixedContentIndex !== undefined ? `mixed-vimeo-${mixedContentIndex}` : 'main-vimeo-video'}
              ref={iframeRef}
              src={`https://player.vimeo.com/video/${videoId}`}
              className="absolute inset-0 w-full h-full"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              title="Vimeo video player"
              onLoad={() => {
                console.log('🎬 Vimeo iframe loaded' + (mixedContentIndex !== undefined ? ` (mixed ${mixedContentIndex})` : ''));
                setVideoLoading(false);
              }}
            />
            
            {/* Loading state overlay for Vimeo */}
            {videoLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-20">
                <div className="flex flex-col items-center space-y-3">
                  <Loader2 className="h-10 w-10 sm:h-12 sm:w-12 text-blue-500 animate-spin" />
                  <span className="text-sm sm:text-base text-white font-medium">Loading Vimeo video...</span>
                  <span className="text-xs text-gray-400">Initializing player</span>
                </div>
              </div>
            )}
            
            <button
              onClick={() => handleFullscreenToggle(videoContainerRef.current)}
              className="absolute bottom-4 right-4 bg-black/70 hover:bg-black/90 text-white p-2.5 sm:p-3 rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all duration-200 shadow-lg z-10"
              title={fullscreen ? "Exit fullscreen (F)" : "Enter fullscreen (F)"}
              aria-label={fullscreen ? "Exit fullscreen mode" : "Enter fullscreen mode"}
            >
              {fullscreen ? (
                <Minimize2 className="h-4 w-4 sm:h-5 sm:w-5" />
              ) : (
                <Maximize2 className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
            </button>
          </div>
          
          {/* Vimeo Progress Tracker */}
          <Card className={`border-2 ${videoWatched ? 'bg-green-900/30 border-green-700' : 'bg-blue-900/30 border-blue-700'}`}>
            <div className="p-3 sm:p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                <div className="flex items-center space-x-2">
                  <Video className={`h-4 w-4 ${videoWatched ? 'text-green-400' : 'text-blue-400'}`} />
                  <span className={`text-sm font-medium ${videoWatched ? 'text-green-200' : 'text-blue-200'}`}>
                    Video Progress
                  </span>
                </div>
                {videoWatched ? (
                  <Badge className="bg-green-600 w-fit">
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
                <div className="flex items-center space-x-2 text-xs text-blue-300 bg-blue-950/50 p-2 rounded">
                  <Lock className="h-3 w-3 flex-shrink-0" />
                  <span>Watch at least 90% to unlock next lesson</span>
                </div>
              )}
            </div>
          </Card>
        </div>
      );
    }
    
    // Direct video URL or unsupported - try HTML5 video with enhanced controls
    return (
      <div className="space-y-4">
        <div 
          ref={videoContainerRef}
          className="relative aspect-video rounded-lg overflow-hidden bg-black group shadow-2xl"
          role="region"
          aria-label="HTML5 video player"
        >
          <video
            ref={(el) => {
              videoRef.current = el;
              // For mixed content videos, track progress
              if (el && mixedContentIndex !== undefined) {
                const playerId = `mixed-direct-${mixedContentIndex}`;
                mixedVideoRefs.current[playerId] = {
                  ...mixedVideoRefs.current[playerId],
                  videoElement: el
                };
                
                // Add timeupdate listener for progress tracking
                const handleTimeUpdate = () => {
                  if (el.duration > 0) {
                    const progress = (el.currentTime / el.duration) * 100;
                    console.log(`📊 Mixed direct video ${mixedContentIndex} progress:`, progress.toFixed(1) + '%');
                    
                    if (typeof onMixedContentVideoProgress === 'function') {
                      try {
                        onMixedContentVideoProgress(mixedContentIndex, progress);
                      } catch (error) {
                        console.error('Error calling onMixedContentVideoProgress:', error);
                      }
                    }
                    
                    // Check for completion (90% threshold)
                    if (progress >= 90) {
                      console.log(`✅ Mixed direct video ${mixedContentIndex} completed (90% threshold)`);
                      
                      if (typeof onMixedContentVideoComplete === 'function') {
                        try {
                          onMixedContentVideoComplete(mixedContentIndex);
                        } catch (error) {
                          console.error('Error calling onMixedContentVideoComplete:', error);
                        }
                      }
                    }
                  }
                };
                
                el.addEventListener('timeupdate', handleTimeUpdate);
                
                // Cleanup on unmount
                return () => {
                  el.removeEventListener('timeupdate', handleTimeUpdate);
                };
              }
            }}
            controls
            controlsList="nodownload"
            className="w-full h-full"
            onPlay={() => {
              setIsPlaying(true);
              setVideoError(null);
            }}
            onPause={() => setIsPlaying(false)}
            onError={(e) => {
              console.error('Video playback error:', e);
              setVideoError('Failed to load video. Please check the video URL or try a different browser.');
            }}
            onLoadStart={() => setVideoLoading(true)}
            onLoadedData={() => setVideoLoading(false)}
          >
            <source src={videoUrl} type="video/mp4" />
            <source src={videoUrl} type="video/webm" />
            <source src={videoUrl} type="video/ogg" />
            Your browser does not support the video tag.
          </video>
          {videoLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-20">
              <div className="flex flex-col items-center space-y-3">
                <Loader2 className="h-10 w-10 sm:h-12 sm:w-12 text-blue-400 animate-spin" />
                <span className="text-sm sm:text-base text-white font-medium">Loading video...</span>
                <span className="text-xs text-gray-400">Buffering content</span>
              </div>
            </div>
          )}
          <button
            onClick={() => handleFullscreenToggle(videoContainerRef.current)}
            className="absolute bottom-4 right-4 bg-black/70 hover:bg-black/90 text-white p-2.5 sm:p-3 rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all duration-200 shadow-lg z-10"
            title={fullscreen ? "Exit fullscreen (F)" : "Enter fullscreen (F)"}
            aria-label={fullscreen ? "Exit fullscreen mode" : "Enter fullscreen mode"}
          >
            {fullscreen ? (
              <Minimize2 className="h-4 w-4 sm:h-5 sm:w-5" />
            ) : (
              <Maximize2 className="h-4 w-4 sm:h-5 sm:w-5" />
            )}
          </button>
        </div>
        
        {/* Video Error Display */}
        {videoError && (
          <Alert className="bg-red-900/20 border-red-700">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <AlertDescription className="text-red-200">
              <p className="font-semibold text-base mb-1">⚠️ Video Playback Error</p>
              <p className="text-sm text-red-300/90">{videoError}</p>
              <p className="text-xs text-red-400/70 mt-2">
                If this persists, contact your instructor or try accessing the video on a different device.
              </p>
            </AlertDescription>
          </Alert>
        )}
        
        {/* Enhanced Video Controls Card */}
        <Card className="bg-gray-800/50 border-gray-700">
          <div className="p-3 sm:p-4 space-y-4">
            {/* Playback Speed Control */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
              <div className="flex items-center space-x-2">
                <Settings className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-300">Playback Speed:</span>
              </div>
              <Select
                value={playbackSpeed.toString()}
                onValueChange={(value) => handlePlaybackSpeedChange(parseFloat(value))}
              >
                <SelectTrigger className="w-full sm:w-28 h-8 text-xs bg-gray-700 border-gray-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.5">0.5x Slower</SelectItem>
                  <SelectItem value="0.75">0.75x</SelectItem>
                  <SelectItem value="1">1x Normal</SelectItem>
                  <SelectItem value="1.25">1.25x</SelectItem>
                  <SelectItem value="1.5">1.5x Faster</SelectItem>
                  <SelectItem value="1.75">1.75x</SelectItem>
                  <SelectItem value="2">2x Fast</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Video Progress Section */}
            <div className="space-y-3 pt-3 border-t border-gray-700">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                <div className="flex items-center space-x-2">
                  <Video className={`h-4 w-4 ${videoWatched ? 'text-green-400' : 'text-blue-400'}`} />
                  <span className={`text-sm font-medium ${videoWatched ? 'text-green-200' : 'text-blue-200'}`}>
                    Video Progress
                  </span>
                </div>
                {videoWatched ? (
                  <Badge className="bg-green-600 w-fit">
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
                <div className="flex items-center space-x-2 text-xs text-blue-300 bg-blue-950/50 p-2 rounded">
                  <Lock className="h-3 w-3 flex-shrink-0" />
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

  // Enhanced mixed content parser with robust error handling (memoized to prevent infinite loops)
  const parseMixedContent = useMemo(() => {
    return (contentData: string): { sections: MixedContentSection[], error: string | null } => {
      try {
        // First, try to parse as JSON
        const parsed = JSON.parse(contentData);
        
        // Validate the structure
        if (Array.isArray(parsed)) {
          return { sections: parsed.filter(section => section && section.type), error: null };
        }
        
        if (parsed.sections && Array.isArray(parsed.sections)) {
          return { sections: parsed.sections.filter((section: any) => section && section.type), error: null };
        }
        
        if (parsed.content && Array.isArray(parsed.content)) {
          return { sections: parsed.content.filter((section: any) => section && section.type), error: null };
        }
        
        // If it's an object with type property, wrap it in an array
        if (parsed.type) {
          return { sections: [parsed], error: null };
        }
        
        // Couldn't extract sections from JSON
        return { 
          sections: [{ type: 'text', content: contentData }], 
          error: 'Invalid mixed content format. Displaying as text.' 
        };
        
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
          
          return { 
            sections: sections.length > 0 ? sections : [{ type: 'text', content: contentData }], 
            error: null 
          };
          
        } catch (parseError) {
          console.error('Error parsing mixed content:', parseError);
          return { 
            sections: [{ type: 'text', content: contentData }], 
            error: 'Failed to parse content structure. Displaying as text.' 
          };
        }
      }
    };
  }, []);

  // Parse mixed content and update error state (memoized to prevent re-parsing on every render)
  const mixedContentResult = useMemo(() => {
    if (lesson.content_type !== 'mixed') return null;
    return parseMixedContent(lesson.content_data);
  }, [lesson.content_type, lesson.content_data, parseMixedContent]);

  // Update error state when parsed result changes
  useEffect(() => {
    if (mixedContentResult?.error !== mixedContentError) {
      setMixedContentError(mixedContentResult?.error || null);
    }
  }, [mixedContentResult]);

  const renderMixedContent = (contentData: string) => {
    // Use pre-parsed result
    const sections = mixedContentResult?.sections || [{ type: 'text' as const, content: contentData }];
    const error = mixedContentResult?.error;
    
    // Enhanced debug logging
    console.log('🔍 renderMixedContent - DETAILED ANALYSIS:');
    console.log('  Total sections:', sections.length);
    console.log('  Raw contentData:', contentData.substring(0, 200));
    console.log('  Sections array:', sections);
    console.log('  Video sections found:', sections.filter(s => s.type === 'video').length);
    
    // Log each section with details
    sections.forEach((section, idx) => {
      console.log(`  Section ${idx + 1}:`, {
        type: section.type,
        hasUrl: 'url' in section,
        urlValue: (section as any).url,
        hasContent: 'content' in section,
        contentValue: typeof (section as any).content === 'string' ? (section as any).content?.substring(0, 50) : (section as any).content,
        allKeys: Object.keys(section)
      });
    });
    
    return (
      <div className="space-y-6">
        {/* Error Alert */}
        {error && (
          <Alert className="bg-yellow-900/20 border-yellow-700">
            <AlertCircle className="h-4 w-4 text-yellow-400" />
            <AlertDescription className="text-yellow-200">
              {error}
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
            
            {section.type === 'video' && (
              <Card className="bg-gray-800/30 border-gray-700 p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 mb-4">
                  <div className="flex items-center space-x-2">
                    <Video className="h-5 w-5 text-blue-400" />
                    <h4 className="font-semibold text-white">Video Content</h4>
                  </div>
                  <Badge variant="outline" className="w-fit sm:ml-auto">Section {index + 1}</Badge>
                </div>
                {section.metadata?.title && (
                  <h5 className="text-lg font-medium text-gray-200 mb-3">{section.metadata.title}</h5>
                )}
                {(() => {
                  // Get video URL from multiple possible locations with priority order
                  // Priority: root url > metadata.url > content field (for backward compatibility)
                  const videoUrl = (
                    section.url || 
                    (section as any).metadata?.url ||
                    section.content || 
                    ''
                  ).trim();
                  
                  // Enhanced debug logging
                  console.log('🎥 Video section rendering (DETAILED):', {
                    index,
                    sectionId: (section as any).id,
                    sectionType: section.type,
                    hasUrl: !!section.url,
                    urlValue: section.url,
                    hasContent: !!section.content,
                    contentValue: section.content,
                    hasMetadata: !!(section as any).metadata,
                    hasMetadataUrl: !!(section as any).metadata?.url,
                    metadataUrlValue: (section as any).metadata?.url,
                    finalVideoUrl: videoUrl,
                    videoUrlLength: videoUrl.length,
                    isPlaceholder: videoUrl.includes('[INSERT_VIDEO_URL_HERE]') || 
                                  videoUrl.includes('INSERT_') ||
                                  videoUrl.includes('YOUR_VIDEO_URL'),
                    fullSection: JSON.stringify(section, null, 2)
                  });
                  
                  // Enhanced placeholder detection
                  const isPlaceholder = !videoUrl || 
                                      videoUrl.includes('[INSERT_VIDEO_URL_HERE]') || 
                                      videoUrl.includes('INSERT_') ||
                                      videoUrl.includes('YOUR_VIDEO_URL') ||
                                      videoUrl.includes('ADD_VIDEO_URL') ||
                                      videoUrl.includes('PLACEHOLDER') ||
                                      videoUrl === 'null' ||
                                      videoUrl === 'undefined';
                  
                  if (isPlaceholder) {
                    return (
                      <Alert className="bg-amber-900/20 border-amber-700">
                        <AlertCircle className="h-5 w-5 text-amber-400" />
                        <AlertDescription className="text-amber-200">
                          <p className="font-semibold text-base mb-2">📹 No video URL provided</p>
                          <p className="text-sm text-amber-300/90">
                            The instructor needs to add a video link to this section. 
                            This could be a YouTube, Vimeo, or direct video file URL.
                          </p>
                          <p className="text-xs text-amber-400/70 mt-2 italic">
                            Please check back later or contact your instructor for updates.
                          </p>
                        </AlertDescription>
                      </Alert>
                    );
                  }
                  
                  // Validate URL format
                  const isValidUrl = /^https?:\/\/.+/.test(videoUrl);
                  if (!isValidUrl) {
                    return (
                      <Alert className="bg-red-900/20 border-red-700">
                        <AlertCircle className="h-5 w-5 text-red-400" />
                        <AlertDescription className="text-red-200">
                          <p className="font-semibold text-base mb-2">❌ Invalid video URL</p>
                          <p className="text-sm text-red-300/90">
                            The video URL appears to be invalid or improperly formatted.
                          </p>
                          <p className="text-xs text-red-400/70 mt-2 font-mono bg-black/30 p-2 rounded">
                            Provided: {videoUrl.substring(0, 100)}{videoUrl.length > 100 ? '...' : ''}
                          </p>
                        </AlertDescription>
                      </Alert>
                    );
                  }
                  
                  return renderVideoContent(videoUrl, index);
                })()}
              </Card>
            )}
            
            {section.type === 'pdf' && (
              <Card className="bg-gray-800/30 border-gray-700 p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 mb-4">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-5 w-5 text-red-400" />
                    <h4 className="font-semibold text-white">PDF Document</h4>
                  </div>
                  <Badge variant="outline" className="w-fit sm:ml-auto">Section {index + 1}</Badge>
                </div>
                {section.metadata?.title && (
                  <h5 className="text-lg font-medium text-gray-200 mb-3">{section.metadata.title}</h5>
                )}
                {(() => {
                  // Get PDF URL from multiple possible locations with priority order
                  // Priority: root url > metadata.url > content field (for backward compatibility)
                  const pdfUrl = (
                    section.url || 
                    (section as any).metadata?.url ||
                    section.content || 
                    ''
                  ).trim();
                  
                  console.log('📄 PDF section:', {
                    hasUrl: !!section.url,
                    urlValue: section.url,
                    hasMetadataUrl: !!(section as any).metadata?.url,
                    metadataUrlValue: (section as any).metadata?.url,
                    hasContent: !!section.content,
                    contentValue: section.content,
                    finalPdfUrl: pdfUrl
                  });
                  
                  // Enhanced placeholder detection
                  const isPlaceholder = !pdfUrl || 
                                      pdfUrl.includes('[INSERT_PDF_URL_HERE]') || 
                                      pdfUrl.includes('INSERT_') ||
                                      pdfUrl.includes('YOUR_PDF_URL') ||
                                      pdfUrl.includes('ADD_PDF_URL') ||
                                      pdfUrl.includes('PLACEHOLDER') ||
                                      pdfUrl === 'null' ||
                                      pdfUrl === 'undefined';
                  
                  if (isPlaceholder) {
                    return (
                      <Alert className="bg-amber-900/20 border-amber-700">
                        <AlertCircle className="h-5 w-5 text-amber-400" />
                        <AlertDescription className="text-amber-200">
                          <p className="font-semibold text-base mb-2">📄 No PDF URL provided</p>
                          <p className="text-sm text-amber-300/90">
                            The instructor needs to add a PDF document link to this section. 
                            This should be a direct PDF URL or Google Drive link.
                          </p>
                          <p className="text-xs text-amber-400/70 mt-2 italic">
                            Please check back later or contact your instructor for updates.
                          </p>
                        </AlertDescription>
                      </Alert>
                    );
                  }
                  
                  // Validate URL format
                  const isValidUrl = /^https?:\/\/.+/.test(pdfUrl);
                  if (!isValidUrl) {
                    return (
                      <Alert className="bg-red-900/20 border-red-700">
                        <AlertCircle className="h-5 w-5 text-red-400" />
                        <AlertDescription className="text-red-200">
                          <p className="font-semibold text-base mb-2">❌ Invalid PDF URL</p>
                          <p className="text-sm text-red-300/90">
                            The PDF URL appears to be invalid or improperly formatted.
                          </p>
                          <p className="text-xs text-red-400/70 mt-2 font-mono bg-black/30 p-2 rounded">
                            Provided: {pdfUrl.substring(0, 100)}{pdfUrl.length > 100 ? '...' : ''}
                          </p>
                        </AlertDescription>
                      </Alert>
                    );
                  }
                  
                  return renderPdfContent(pdfUrl);
                })()}
              </Card>
            )}
            
            {section.type === 'image' && (
              <Card className="bg-gray-800/30 border-gray-700 p-4 sm:p-6">
                {(() => {
                  // Get image URL from multiple possible locations with priority order
                  // Priority: root url > metadata.url > content field (for backward compatibility)
                  const imageUrl = (
                    section.url || 
                    (section as any).metadata?.url ||
                    section.content || 
                    ''
                  ).trim();
                  
                  console.log('🖼️ Image section:', {
                    hasUrl: !!section.url,
                    urlValue: section.url,
                    hasMetadataUrl: !!(section as any).metadata?.url,
                    metadataUrlValue: (section as any).metadata?.url,
                    hasContent: !!section.content,
                    contentValue: section.content,
                    finalImageUrl: imageUrl
                  });
                  
                  // Enhanced placeholder detection
                  const isPlaceholder = !imageUrl || 
                                      imageUrl.includes('[INSERT_IMAGE_URL_HERE]') || 
                                      imageUrl.includes('INSERT_') ||
                                      imageUrl.includes('YOUR_IMAGE_URL') ||
                                      imageUrl.includes('ADD_IMAGE_URL') ||
                                      imageUrl.includes('PLACEHOLDER') ||
                                      imageUrl === 'null' ||
                                      imageUrl === 'undefined';
                  
                  if (isPlaceholder) {
                    return (
                      <Alert className="bg-amber-900/20 border-amber-700">
                        <AlertCircle className="h-5 w-5 text-amber-400" />
                        <AlertDescription className="text-amber-200">
                          <p className="font-semibold text-base mb-2">🖼️ No image URL provided</p>
                          <p className="text-sm text-amber-300/90">
                            The instructor needs to add an image link to this section.
                          </p>
                          <p className="text-xs text-amber-400/70 mt-2 italic">
                            Please check back later or contact your instructor for updates.
                          </p>
                        </AlertDescription>
                      </Alert>
                    );
                  }
                  
                  // Validate URL format
                  const isValidUrl = /^https?:\/\/.+/.test(imageUrl);
                  if (!isValidUrl) {
                    return (
                      <Alert className="bg-red-900/20 border-red-700">
                        <AlertCircle className="h-5 w-5 text-red-400" />
                        <AlertDescription className="text-red-200">
                          <p className="font-semibold text-base mb-2">❌ Invalid image URL</p>
                          <p className="text-sm text-red-300/90">
                            The image URL appears to be invalid or improperly formatted.
                          </p>
                          <p className="text-xs text-red-400/70 mt-2 font-mono bg-black/30 p-2 rounded break-all">
                            Provided: {imageUrl.substring(0, 100)}{imageUrl.length > 100 ? '...' : ''}
                          </p>
                        </AlertDescription>
                      </Alert>
                    );
                  }
                  
                  return (
                    <div className="space-y-3">
                      <img 
                        src={imageUrl} 
                        alt={section.alt || (section as any).metadata?.caption || (section as any).metadata?.title || 'Lesson image'} 
                        className="w-full rounded-lg shadow-lg hover:shadow-2xl transition-shadow duration-300"
                        loading="lazy"
                        onError={(e) => {
                          // Handle image load errors gracefully
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const errorDiv = document.createElement('div');
                          errorDiv.className = 'bg-red-900/20 border border-red-700 rounded-lg p-4 text-red-200';
                          errorDiv.innerHTML = `
                            <p class="font-semibold mb-1">⚠️ Image failed to load</p>
                            <p class="text-sm text-red-300/90">The image could not be displayed. The URL might be incorrect or the image file may be unavailable.</p>
                          `;
                          target.parentNode?.appendChild(errorDiv);
                        }}
                      />
                      {(section.alt || (section as any).metadata?.caption || (section as any).metadata?.title) && (
                        <p className="text-sm text-gray-400 text-center italic px-4">
                          {section.alt || (section as any).metadata?.caption || (section as any).metadata?.title}
                        </p>
                      )}
                    </div>
                  );
                })()}
              </Card>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 w-full">
      {/* Keyboard Shortcuts Help (for video content) - Desktop only */}
      {lesson.content_type === 'video' && (
        <Alert className="bg-gray-800/50 border-gray-700 hidden md:block">
          <Settings className="h-4 w-4 text-gray-400" />
          <AlertDescription className="text-gray-300 text-sm">
            <strong className="block mb-2">⌨️ Keyboard Shortcuts:</strong>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span><kbd className="px-2 py-0.5 bg-gray-700 rounded text-xs">Space</kbd> Play/Pause</span>
              <span><kbd className="px-2 py-0.5 bg-gray-700 rounded text-xs">←/→</kbd> Skip 5s</span>
              <span><kbd className="px-2 py-0.5 bg-gray-700 rounded text-xs">↑/↓</kbd> Volume</span>
              <span><kbd className="px-2 py-0.5 bg-gray-700 rounded text-xs">F</kbd> Fullscreen</span>
              <span><kbd className="px-2 py-0.5 bg-gray-700 rounded text-xs">&gt;/&lt;</kbd> Speed</span>
              <span><kbd className="px-2 py-0.5 bg-gray-700 rounded text-xs">M</kbd> Mute</span>
              <span><kbd className="px-2 py-0.5 bg-gray-700 rounded text-xs">0/Home</kbd> Restart</span>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      {/* Mobile Video Tip */}
      {lesson.content_type === 'video' && (
        <Alert className="bg-blue-900/20 border-blue-700 md:hidden">
          <Video className="h-4 w-4 text-blue-400" />
          <AlertDescription className="text-blue-200 text-sm">
            <strong>📱 Mobile Tip:</strong> Tap the fullscreen button for the best viewing experience. 
            Rotate your device to landscape mode for larger video display.
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
