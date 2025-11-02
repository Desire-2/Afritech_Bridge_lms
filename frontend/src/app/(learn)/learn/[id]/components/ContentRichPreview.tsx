import React, { useState, useRef, useEffect } from 'react';
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
  Lock
} from 'lucide-react';

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
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const youtubePlayerRef = useRef<any>(null);
  const vimeoPlayerRef = useRef<any>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

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
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [videoWatched, onVideoComplete, onVideoProgress]);

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
      <div className="prose prose-invert max-w-none">
        <div 
          className="text-gray-200 leading-relaxed whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: content }}
        />
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
            >
              <div
                ref={iframeRef as any}
                id={`youtube-player-${videoId}`}
                className="absolute inset-0 w-full h-full"
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
            
            {/* YouTube Progress Tracker */}
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
    
    // Direct video URL with progress tracking
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
        
        {/* Video Progress Tracker */}
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
  };

  const renderPdfContent = (pdfUrl: string) => {
    return (
      <div className="space-y-4">
        <Card className="bg-gradient-to-r from-red-900/30 to-orange-900/30 border-red-800">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="h-12 w-12 bg-red-600 rounded-lg flex items-center justify-center">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-white">PDF Document</h4>
                  <p className="text-sm text-gray-300">View or download the lesson material</p>
                </div>
              </div>
              <div className="flex space-x-2">
                <Button
                  onClick={() => window.open(pdfUrl, '_blank')}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Maximize2 className="h-4 w-4 mr-2" />
                  Open in New Tab
                </Button>
                <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700" asChild>
                  <a href={pdfUrl} download>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </Card>
        
        {/* PDF Viewer */}
        <div className="border border-gray-700 rounded-lg overflow-hidden bg-gray-900" style={{ height: '600px' }}>
          <iframe
            src={`${pdfUrl}#view=FitH`}
            className="w-full h-full"
            title="PDF Viewer"
          />
        </div>
      </div>
    );
  };

  const renderMixedContent = (contentData: string) => {
    // Parse mixed content (could be JSON or structured format)
    try {
      const parsed = JSON.parse(contentData);
      return (
        <div className="space-y-6">
          {parsed.sections?.map((section: any, index: number) => (
            <div key={index} className="space-y-4">
              {section.type === 'text' && (
                <div className="prose max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: section.content }} />
                </div>
              )}
              {section.type === 'video' && (
                <div className="my-6">
                  {renderVideoContent(section.url)}
                </div>
              )}
              {section.type === 'pdf' && (
                <div className="my-6">
                  {renderPdfContent(section.url)}
                </div>
              )}
            </div>
          ))}
        </div>
      );
    } catch {
      // Fallback to plain text if parsing fails
      return renderTextContent(contentData);
    }
  };

  return (
    <div className="space-y-6 w-full">
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
          
          <div className="flex items-center space-x-2">
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
            <div className="text-gray-300 text-sm">
              <div dangerouslySetInnerHTML={{ __html: lesson.learning_objectives }} />
            </div>
          </div>
        )}
      </div>

      {/* Content Display based on type */}
      <div className="bg-gray-800/30 rounded-lg p-6 border border-gray-700 w-full">
        {lesson.content_type === 'text' && renderTextContent(lesson.content_data)}
        {lesson.content_type === 'video' && renderVideoContent(lesson.content_data)}
        {lesson.content_type === 'pdf' && renderPdfContent(lesson.content_data)}
        {lesson.content_type === 'mixed' && renderMixedContent(lesson.content_data)}
      </div>
    </div>
  );
};
