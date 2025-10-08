"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Settings,
  SkipBack,
  SkipForward,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Download,
  FileText,
  Image as ImageIcon,
  Video,
  Code,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  MessageSquare,
  Share2,
  Eye,
  EyeOff,
  Lightbulb,
  CheckCircle,
  AlertCircle,
  Clock,
  Users,
  ThumbsUp,
  Heart,
  Repeat
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Toggle } from '@/components/ui/toggle';
import { Textarea } from '@/components/ui/textarea';

interface ContentData {
  type: 'video' | 'text' | 'pdf' | 'image' | 'interactive' | 'quiz' | 'code';
  url?: string;
  content?: string;
  title: string;
  description?: string;
  duration?: number;
  transcript?: TranscriptLine[];
  attachments?: Attachment[];
  interactiveElements?: InteractiveElement[];
}

interface TranscriptLine {
  timestamp: string;
  text: string;
  speaker?: string;
}

interface Attachment {
  id: string;
  name: string;
  type: string;
  url: string;
  size?: string;
}

interface InteractiveElement {
  id: string;
  type: 'hotspot' | 'quiz' | 'note' | 'bookmark';
  position: { x: number; y: number };
  timestamp?: number;
  content: string;
  title?: string;
}

interface ContentViewerProps {
  content: ContentData;
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
  onInteraction?: (type: string, data: any) => void;
}

const EnhancedVideoPlayer: React.FC<{
  videoUrl: string;
  transcript?: TranscriptLine[];
  interactiveElements?: InteractiveElement[];
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
}> = ({ videoUrl, transcript, interactiveElements, onProgress, onComplete }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showHotspots, setShowHotspots] = useState(true);
  const [activeHotspot, setActiveHotspot] = useState<InteractiveElement | null>(null);
  const [watchedSegments, setWatchedSegments] = useState<{start: number, end: number}[]>([]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const current = video.currentTime;
      setCurrentTime(current);
      
      // Track watched segments
      setWatchedSegments(prev => {
        const newSegment = { start: Math.floor(current), end: Math.floor(current) + 1 };
        const exists = prev.some(seg => seg.start <= newSegment.start && seg.end >= newSegment.end);
        if (!exists) {
          return [...prev, newSegment];
        }
        return prev;
      });

      // Calculate progress
      if (duration > 0) {
        const progressPercent = (current / duration) * 100;
        onProgress?.(progressPercent);
      }

      // Check for interactive elements at current time
      const currentHotspot = interactiveElements?.find(el => 
        el.timestamp && Math.abs(el.timestamp - current) < 1
      );
      if (currentHotspot && currentHotspot !== activeHotspot) {
        setActiveHotspot(currentHotspot);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      onComplete?.();
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
    };
  }, [duration, interactiveElements, activeHotspot, onProgress, onComplete]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
    setCurrentTime(time);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getWatchedPercentage = () => {
    if (duration === 0) return 0;
    const totalWatched = watchedSegments.reduce((acc, seg) => acc + (seg.end - seg.start), 0);
    return Math.min((totalWatched / duration) * 100, 100);
  };

  const getCurrentTranscriptLine = () => {
    return transcript?.find(line => {
      const [mins, secs] = line.timestamp.split(':').map(Number);
      const lineTime = mins * 60 + secs;
      return Math.abs(lineTime - currentTime) < 2;
    });
  };

  return (
    <div className="relative bg-black rounded-lg overflow-hidden group">
      <video
        ref={videoRef}
        className="w-full aspect-video"
        src={videoUrl}
        poster="/api/placeholder/800/450"
      />
      
      {/* Interactive Hotspots */}
      {showHotspots && interactiveElements?.map((element) => (
        <motion.div
          key={element.id}
          className="absolute w-8 h-8 bg-blue-500 rounded-full cursor-pointer shadow-lg flex items-center justify-center"
          style={{
            left: `${element.position.x}%`,
            top: `${element.position.y}%`,
          }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.2 }}
          onClick={() => setActiveHotspot(element)}
        >
          {element.type === 'quiz' && <Lightbulb className="h-4 w-4 text-white" />}
          {element.type === 'note' && <MessageSquare className="h-4 w-4 text-white" />}
          {element.type === 'bookmark' && <Bookmark className="h-4 w-4 text-white" />}
        </motion.div>
      ))}

      {/* Hotspot Modal */}
      <AnimatePresence>
        {activeHotspot && (
          <motion.div
            className="absolute inset-0 bg-black/50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveHotspot(null)}
          >
            <motion.div
              className="bg-white rounded-lg p-6 max-w-md w-full"
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 50 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-semibold mb-2">{activeHotspot.title}</h3>
              <p className="text-sm text-muted-foreground mb-4">{activeHotspot.content}</p>
              <div className="flex justify-end space-x-2">
                <Button size="sm" variant="outline" onClick={() => setActiveHotspot(null)}>
                  Close
                </Button>
                <Button size="sm">Continue</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video Controls */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        {/* Center Play Button */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Button
            size="lg"
            variant="ghost"
            onClick={togglePlay}
            className="h-16 w-16 rounded-full bg-black/50 hover:bg-black/70 text-white"
          >
            {isPlaying ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8" />}
          </Button>
        </div>

        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
          {/* Progress Bars */}
          <div className="space-y-1">
            {/* Main progress */}
            <div className="relative">
              <Progress value={(currentTime / duration) * 100} className="h-1 bg-white/30" />
              <input
                type="range"
                min="0"
                max={duration}
                value={currentTime}
                onChange={(e) => handleSeek(Number(e.target.value))}
                className="absolute inset-0 w-full h-1 opacity-0 cursor-pointer"
              />
            </div>
            {/* Watched progress */}
            <div className="flex justify-between text-xs text-white/70">
              <span>Watched: {Math.round(getWatchedPercentage())}%</span>
              <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center space-x-2">
              <Button size="sm" variant="ghost" onClick={() => handleSeek(Math.max(0, currentTime - 10))}>
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={togglePlay}>
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleSeek(Math.min(duration, currentTime + 10))}>
                <RotateCw className="h-4 w-4" />
              </Button>
              
              <Button size="sm" variant="ghost" onClick={() => setIsMuted(!isMuted)}>
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              
              <div className="w-20">
                <Slider
                  value={[volume]}
                  onValueChange={([value]) => setVolume(value)}
                  max={1}
                  step={0.1}
                  className="w-full"
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Toggle pressed={showTranscript} onPressedChange={setShowTranscript}>
                <FileText className="h-4 w-4" />
              </Toggle>
              <Toggle pressed={showHotspots} onPressedChange={setShowHotspots}>
                <Eye className="h-4 w-4" />
              </Toggle>
              
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="ghost">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Video Settings</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Playback Speed</label>
                      <div className="flex space-x-2 mt-2">
                        {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                          <Button
                            key={rate}
                            size="sm"
                            variant={playbackRate === rate ? "default" : "outline"}
                            onClick={() => setPlaybackRate(rate)}
                          >
                            {rate}x
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              
              <Button size="sm" variant="ghost">
                <Maximize className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Live Transcript */}
      {showTranscript && (
        <motion.div
          className="absolute bottom-20 left-4 right-4 bg-black/80 text-white p-3 rounded-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {getCurrentTranscriptLine() ? (
            <div>
              {getCurrentTranscriptLine()?.speaker && (
                <span className="font-semibold text-blue-300">
                  {getCurrentTranscriptLine()?.speaker}:
                </span>
              )}
              <span className="ml-2">{getCurrentTranscriptLine()?.text}</span>
            </div>
          ) : (
            <div className="text-white/50 text-sm">No transcript available for this moment</div>
          )}
        </motion.div>
      )}
    </div>
  );
};

const InteractiveContentViewer: React.FC<ContentViewerProps> = ({
  content,
  onProgress,
  onComplete,
  onInteraction
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [notes, setNotes] = useState<{[key: string]: string}>({});
  const [showNotes, setShowNotes] = useState(false);

  const handleBookmark = () => {
    const newBookmarks = bookmarks.includes(currentPage) 
      ? bookmarks.filter(p => p !== currentPage)
      : [...bookmarks, currentPage];
    setBookmarks(newBookmarks);
    onInteraction?.('bookmark', { page: currentPage, bookmarked: !bookmarks.includes(currentPage) });
  };

  const handleAddNote = (note: string) => {
    setNotes(prev => ({ ...prev, [currentPage]: note }));
    onInteraction?.('note', { page: currentPage, note });
  };

  if (content.type === 'video') {
    return (
      <EnhancedVideoPlayer
        videoUrl={content.url!}
        transcript={content.transcript}
        interactiveElements={content.interactiveElements}
        onProgress={onProgress}
        onComplete={onComplete}
      />
    );
  }

  if (content.type === 'text' || content.type === 'pdf') {
    return (
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>{content.title}</span>
            </CardTitle>
            
            <div className="flex items-center space-x-2">
              <Button size="sm" variant="outline" onClick={() => setZoom(Math.max(50, zoom - 25))}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm">{zoom}%</span>
              <Button size="sm" variant="outline" onClick={() => setZoom(Math.min(200, zoom + 25))}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              
              <Button 
                size="sm" 
                variant={bookmarks.includes(currentPage) ? "default" : "outline"}
                onClick={handleBookmark}
              >
                <Bookmark className="h-4 w-4" />
              </Button>
              
              <Button size="sm" variant="outline" onClick={() => setShowNotes(!showNotes)}>
                <MessageSquare className="h-4 w-4" />
              </Button>
              
              <Button size="sm" variant="outline">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div 
                className="prose max-w-none transition-all duration-200"
                style={{ fontSize: `${zoom}%` }}
              >
                <div dangerouslySetInnerHTML={{ __html: content.content! }} />
              </div>
            </div>
            
            {showNotes && (
              <motion.div
                className="w-80 border-l pl-4"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 320, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
              >
                <h4 className="font-semibold mb-2">Notes</h4>
                <Textarea
                  placeholder="Add your notes for this page..."
                  value={notes[currentPage] || ''}
                  onChange={(e) => handleAddNote(e.target.value)}
                  className="min-h-[200px] mb-4"
                />
                
                {bookmarks.length > 0 && (
                  <div className="mt-4">
                    <h5 className="font-medium mb-2">Bookmarks</h5>
                    <div className="space-y-1">
                      {bookmarks.map(page => (
                        <Button
                          key={page}
                          size="sm"
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={() => setCurrentPage(page)}
                        >
                          <Bookmark className="h-4 w-4 mr-2" />
                          Page {page}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>
          
          {/* Attachments */}
          {content.attachments && content.attachments.length > 0 && (
            <div className="mt-6 border-t pt-4">
              <h4 className="font-semibold mb-3">Attachments</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {content.attachments.map((attachment) => (
                  <div key={attachment.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{attachment.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {attachment.type} {attachment.size && `• ${attachment.size}`}
                        </p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (content.type === 'image') {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <ImageIcon className="h-5 w-5" />
            <span>{content.title}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <img 
              src={content.url} 
              alt={content.title}
              className="w-full h-auto rounded-lg"
              style={{ transform: `scale(${zoom / 100})` }}
            />
            
            <div className="absolute top-4 right-4 bg-black/50 rounded-lg p-2 space-y-2">
              <Button size="sm" variant="ghost" onClick={() => setZoom(Math.max(50, zoom - 25))}>
                <ZoomOut className="h-4 w-4 text-white" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setZoom(Math.min(300, zoom + 25))}>
                <ZoomIn className="h-4 w-4 text-white" />
              </Button>
            </div>
          </div>
          
          {content.description && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm">{content.description}</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (content.type === 'code') {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Code className="h-5 w-5" />
            <span>{content.title}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
            <pre>
              <code dangerouslySetInnerHTML={{ __html: content.content! }} />
            </pre>
          </div>
          
          <div className="flex justify-between items-center mt-4">
            <Button size="sm" variant="outline">
              <ExternalLink className="h-4 w-4 mr-2" />
              Run Code
            </Button>
            <Button size="sm" variant="outline">
              Copy to Clipboard
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardContent className="p-6 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Unsupported content type: {content.type}</p>
      </CardContent>
    </Card>
  );
};

export default InteractiveContentViewer;