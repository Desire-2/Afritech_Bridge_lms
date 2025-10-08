"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  SkipBack, 
  SkipForward,
  Settings,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Circle,
  BookOpen,
  FileText,
  Video,
  Clock,
  Award,
  Users,
  Star,
  Download,
  MessageSquare,
  Share2,
  Bookmark,
  MoreVertical
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { StudentApiService } from '@/services/studentApi';
import Link from 'next/link';

interface VideoPlayerProps {
  videoUrl: string;
  onTimeUpdate: (currentTime: number, duration: number) => void;
  onComplete: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoUrl, onTimeUpdate, onComplete }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      onTimeUpdate(video.currentTime, video.duration);
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      onComplete();
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
    };
  }, [onTimeUpdate, onComplete]);

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

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (newVolume: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const handleSeek = (time: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = time;
    setCurrentTime(time);
  };

  const handlePlaybackRateChange = (rate: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.playbackRate = rate;
    setPlaybackRate(rate);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="relative bg-black rounded-lg overflow-hidden group">
      <video
        ref={videoRef}
        className="w-full aspect-video"
        src={videoUrl}
        poster="/api/placeholder/800/450"
      />
      
      {/* Video Controls Overlay */}
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
          {/* Progress Bar */}
          <div className="relative">
            <Progress value={progressPercentage} className="h-1 bg-white/30" />
            <input
              type="range"
              min="0"
              max={duration}
              value={currentTime}
              onChange={(e) => handleSeek(Number(e.target.value))}
              className="absolute inset-0 w-full h-1 opacity-0 cursor-pointer"
            />
          </div>
          
          {/* Control Buttons */}
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center space-x-2">
              <Button size="sm" variant="ghost" onClick={togglePlay}>
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              
              <Button size="sm" variant="ghost" onClick={toggleMute}>
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                className="w-20"
              />
              
              <span className="text-sm">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="ghost">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Playback Settings</DialogTitle>
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
                            onClick={() => handlePlaybackRateChange(rate)}
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
    </div>
  );
};

interface LessonSidebarProps {
  course: any;
  currentLessonId: number;
  onLessonSelect: (lessonId: number) => void;
}

const LessonSidebar: React.FC<LessonSidebarProps> = ({ course, currentLessonId, onLessonSelect }) => {
  const [expandedModules, setExpandedModules] = useState<number[]>([]);

  const toggleModule = (moduleId: number) => {
    setExpandedModules(prev => 
      prev.includes(moduleId) 
        ? prev.filter(id => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg">{course.title}</CardTitle>
        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
          <div className="flex items-center">
            <Users className="h-4 w-4 mr-1" />
            {course.instructor_name}
          </div>
          <div className="flex items-center">
            <Star className="h-4 w-4 mr-1 fill-yellow-400 text-yellow-400" />
            {course.rating}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="space-y-2">
          {course.modules?.map((module: any) => (
            <Collapsible
              key={module.id}
              open={expandedModules.includes(module.id)}
              onOpenChange={() => toggleModule(module.id)}
            >
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer border-b">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center">
                      {module.is_completed ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-medium">{module.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        {module.lessons?.length} lessons • {module.duration} min
                      </p>
                    </div>
                  </div>
                  <ChevronRight className={`h-4 w-4 transition-transform ${expandedModules.includes(module.id) ? 'rotate-90' : ''}`} />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="bg-muted/30">
                  {module.lessons?.map((lesson: any) => (
                    <button
                      key={lesson.id}
                      onClick={() => onLessonSelect(lesson.id)}
                      className={`w-full text-left p-4 pl-12 hover:bg-muted/50 transition-colors border-b last:border-b-0 ${
                        currentLessonId === lesson.id ? 'bg-primary/10 border-l-4 border-l-primary' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center">
                            {lesson.is_completed ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : currentLessonId === lesson.id ? (
                              <Play className="h-4 w-4 text-primary" />
                            ) : (
                              <Circle className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              {lesson.type === 'video' ? (
                                <Video className="h-4 w-4" />
                              ) : lesson.type === 'reading' ? (
                                <FileText className="h-4 w-4" />
                              ) : (
                                <BookOpen className="h-4 w-4" />
                              )}
                              <span className="font-medium text-sm">{lesson.title}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{lesson.duration} min</p>
                          </div>
                        </div>
                        {lesson.is_locked && (
                          <Badge variant="secondary" className="text-xs">Locked</Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

interface LearningInterfaceProps {
  courseId: number;
}

const LearningInterface: React.FC<LearningInterfaceProps> = ({ courseId }) => {
  const [course, setCourse] = useState<any>(null);
  const [currentLesson, setCurrentLesson] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lessonProgress, setLessonProgress] = useState(0);
  const [notes, setNotes] = useState('');
  const [isBookmarked, setIsBookmarked] = useState(false);

  useEffect(() => {
    const fetchCourseData = async () => {
      try {
        const data = await StudentApiService.getCourseDetails(courseId);
        setCourse(data.course);
        setCurrentLesson(data.current_lesson || data.course.modules?.[0]?.lessons?.[0]);
      } catch (error) {
        console.error('Failed to fetch course data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCourseData();
  }, [courseId]);

  const handleLessonSelect = (lessonId: number) => {
    const allLessons = course.modules?.flatMap((module: any) => module.lessons) || [];
    const lesson = allLessons.find((l: any) => l.id === lessonId);
    if (lesson && !lesson.is_locked) {
      setCurrentLesson(lesson);
      setLessonProgress(0);
    }
  };

  const handleVideoTimeUpdate = (currentTime: number, duration: number) => {
    const progress = (currentTime / duration) * 100;
    setLessonProgress(progress);
  };

  const handleVideoComplete = async () => {
    if (currentLesson && lessonProgress >= 80) {
      try {
        await StudentApiService.completeLesson(currentLesson.id, {
          time_spent: currentLesson.duration,
          notes: notes
        });
        
        // Move to next lesson
        const allLessons = course.modules?.flatMap((module: any) => module.lessons) || [];
        const currentIndex = allLessons.findIndex((l: any) => l.id === currentLesson.id);
        if (currentIndex < allLessons.length - 1) {
          setCurrentLesson(allLessons[currentIndex + 1]);
          setLessonProgress(0);
        }
      } catch (error) {
        console.error('Failed to complete lesson:', error);
      }
    }
  };

  const handleMarkComplete = async () => {
    if (currentLesson) {
      try {
        await StudentApiService.completeLesson(currentLesson.id, {
          time_spent: currentLesson.duration,
          notes: notes
        });
        
        // Refresh course data
        const data = await StudentApiService.getCourseDetails(courseId);
        setCourse(data.course);
      } catch (error) {
        console.error('Failed to mark lesson complete:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!course || !currentLesson) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Course content not available</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      className="flex h-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-background border-b p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/student/learning">
                <Button variant="ghost" size="sm">
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back to My Learning
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold">{currentLesson.title}</h1>
                <p className="text-sm text-muted-foreground">
                  Module: {course.modules?.find((m: any) => 
                    m.lessons?.some((l: any) => l.id === currentLesson.id)
                  )?.title}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" onClick={() => setIsBookmarked(!isBookmarked)}>
                <Bookmark className={`h-4 w-4 ${isBookmarked ? 'fill-current' : ''}`} />
              </Button>
              <Button variant="ghost" size="sm">
                <Share2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Video Player */}
            {currentLesson.type === 'video' && (
              <VideoPlayer
                videoUrl={currentLesson.video_url}
                onTimeUpdate={handleVideoTimeUpdate}
                onComplete={handleVideoComplete}
              />
            )}

            {/* Lesson Content */}
            <Card>
              <CardContent className="p-6">
                <Tabs defaultValue="content" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="content">Content</TabsTrigger>
                    <TabsTrigger value="transcript">Transcript</TabsTrigger>
                    <TabsTrigger value="notes">Notes</TabsTrigger>
                    <TabsTrigger value="discussion">Discussion</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="content" className="mt-6">
                    <div className="prose max-w-none">
                      <h3>{currentLesson.title}</h3>
                      <div dangerouslySetInnerHTML={{ __html: currentLesson.content }} />
                    </div>
                    
                    {currentLesson.resources && currentLesson.resources.length > 0 && (
                      <div className="mt-8">
                        <h4 className="font-semibold mb-4">Resources</h4>
                        <div className="space-y-2">
                          {currentLesson.resources.map((resource: any, index: number) => (
                            <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex items-center space-x-3">
                                <FileText className="h-5 w-5 text-muted-foreground" />
                                <div>
                                  <p className="font-medium">{resource.title}</p>
                                  <p className="text-sm text-muted-foreground">{resource.type}</p>
                                </div>
                              </div>
                              <Button size="sm" variant="outline">
                                <Download className="h-4 w-4 mr-1" />
                                Download
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="transcript" className="mt-6">
                    <div className="prose max-w-none">
                      <div className="bg-muted/30 p-4 rounded-lg">
                        <p className="text-sm text-muted-foreground mb-4">
                          Video transcript will appear here as the video plays
                        </p>
                        <div className="space-y-2">
                          {currentLesson.transcript?.map((line: any, index: number) => (
                            <div key={index} className="flex space-x-3">
                              <span className="text-xs text-muted-foreground w-12 flex-shrink-0">
                                {line.timestamp}
                              </span>
                              <p className="text-sm">{line.text}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="notes" className="mt-6">
                    <div className="space-y-4">
                      <Textarea
                        placeholder="Take notes while watching the lesson..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="min-h-[200px]"
                      />
                      <Button onClick={() => console.log('Save notes:', notes)}>
                        Save Notes
                      </Button>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="discussion" className="mt-6">
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <MessageSquare className="h-5 w-5" />
                        <h4 className="font-semibold">Discussion</h4>
                      </div>
                      <p className="text-muted-foreground">
                        Join the discussion about this lesson with your fellow students.
                      </p>
                      <Button>Start Discussion</Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Navigation and Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {currentLesson.duration} minutes
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">Progress:</span>
                  <Progress value={lessonProgress} className="w-24 h-2" />
                  <span className="text-sm text-muted-foreground">
                    {Math.round(lessonProgress)}%
                  </span>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                {!currentLesson.is_completed && lessonProgress >= 80 && (
                  <Button onClick={handleMarkComplete}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark Complete
                  </Button>
                )}
                <Button variant="outline">
                  <SkipForward className="h-4 w-4 mr-2" />
                  Next Lesson
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-80 border-l bg-muted/30">
        <LessonSidebar
          course={course}
          currentLessonId={currentLesson.id}
          onLessonSelect={handleLessonSelect}
        />
      </div>
    </motion.div>
  );
};

export default LearningInterface;