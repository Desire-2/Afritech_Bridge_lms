"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronDown, 
  ChevronRight, 
  CheckCircle, 
  Circle, 
  Clock, 
  Video, 
  FileText, 
  BookOpen,
  HelpCircle as Quiz,
  Lock,
  Star,
  Play,
  Pause,
  Search,
  Filter,
  MapPin,
  TrendingUp,
  Target,
  BarChart3,
  Compass,
  Route,
  Flag,
  Award,
  Timer,
  Users,
  MessageSquare,
  Bookmark,
  Download,
  ExternalLink,
  Settings,
  MoreVertical,
  Maximize2,
  Minimize2,
  PinIcon,
  Eye,
  EyeOff
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Lesson {
  id: number;
  title: string;
  type: 'video' | 'text' | 'quiz' | 'assignment' | 'interactive';
  duration: number;
  description?: string;
  isCompleted: boolean;
  isLocked: boolean;
  progress: number;
  score?: number;
  lastAccessed?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  prerequisites?: number[];
  estimatedTime: string;
  resources?: { name: string; type: string; url: string }[];
}

interface Module {
  id: number;
  title: string;
  description: string;
  lessons: Lesson[];
  isCompleted: boolean;
  progress: number;
  estimatedDuration: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  learningObjectives: string[];
  order: number;
}

interface Course {
  id: number;
  title: string;
  description: string;
  modules: Module[];
  instructor: string;
  rating: number;
  totalDuration: string;
  enrollmentCount: number;
  completionRate: number;
  lastAccessed?: string;
  bookmarks?: number[];
}

interface CourseNavigationProps {
  course: Course;
  currentLessonId?: number;
  onLessonSelect: (lessonId: number, moduleId: number) => void;
  onModuleToggle?: (moduleId: number) => void;
  isCollapsed?: boolean;
  onCollapse?: (collapsed: boolean) => void;
}

const LessonIcon: React.FC<{ type: string; isCompleted: boolean; isPlaying?: boolean }> = ({ 
  type, 
  isCompleted, 
  isPlaying 
}) => {
  if (isPlaying) {
    return <Play className="h-4 w-4 text-blue-500 animate-pulse" />;
  }
  
  if (isCompleted) {
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  }

  switch (type) {
    case 'video':
      return <Video className="h-4 w-4 text-blue-500" />;
    case 'text':
      return <FileText className="h-4 w-4 text-gray-500" />;
    case 'quiz':
      return <Quiz className="h-4 w-4 text-purple-500" />;
    case 'assignment':
      return <BookOpen className="h-4 w-4 text-orange-500" />;
    case 'interactive':
      return <Target className="h-4 w-4 text-cyan-500" />;
    default:
      return <Circle className="h-4 w-4 text-gray-400" />;
  }
};

const DifficultyBadge: React.FC<{ difficulty: string }> = ({ difficulty }) => {
  const colors = {
    beginner: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    intermediate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    advanced: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
  };

  return (
    <Badge variant="secondary" className={`text-xs ${colors[difficulty as keyof typeof colors] || colors.beginner}`}>
      {difficulty}
    </Badge>
  );
};

const LearningPath: React.FC<{ 
  modules: Module[]; 
  currentLessonId?: number; 
  onLessonSelect: (lessonId: number, moduleId: number) => void;
}> = ({ modules, currentLessonId, onLessonSelect }) => {
  const allLessons = modules.flatMap(module => 
    module.lessons.map(lesson => ({ ...lesson, moduleTitle: module.title, moduleId: module.id }))
  );
  
  const currentIndex = allLessons.findIndex(lesson => lesson.id === currentLessonId);
  const completedCount = allLessons.filter(lesson => lesson.isCompleted).length;
  const totalCount = allLessons.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Learning Path</h3>
        <div className="text-sm text-muted-foreground">
          {completedCount}/{totalCount} complete
        </div>
      </div>
      
      <div className="relative">
        {/* Progress Line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-muted"></div>
        <div 
          className="absolute left-6 top-0 w-0.5 bg-blue-500 transition-all duration-1000"
          style={{ height: `${(completedCount / totalCount) * 100}%` }}
        ></div>
        
        <div className="space-y-3">
          {allLessons.map((lesson, index) => (
            <motion.div
              key={lesson.id}
              className={`relative flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                lesson.id === currentLessonId 
                  ? 'bg-blue-50 dark:bg-blue-950/20 ring-2 ring-blue-200' 
                  : 'hover:bg-muted/50'
              }`}
              onClick={() => !lesson.isLocked && onLessonSelect(lesson.id, lesson.moduleId)}
              whileHover={{ scale: lesson.isLocked ? 1 : 1.02 }}
              whileTap={{ scale: lesson.isLocked ? 1 : 0.98 }}
            >
              {/* Node */}
              <div className={`w-3 h-3 rounded-full z-10 ${
                lesson.isCompleted 
                  ? 'bg-green-500' 
                  : lesson.id === currentLessonId 
                    ? 'bg-blue-500' 
                    : 'bg-muted'
              }`}></div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 min-w-0">
                    <LessonIcon 
                      type={lesson.type} 
                      isCompleted={lesson.isCompleted}
                      isPlaying={lesson.id === currentLessonId}
                    />
                    <span className={`text-sm font-medium truncate ${
                      lesson.isLocked ? 'text-muted-foreground' : ''
                    }`}>
                      {lesson.title}
                    </span>
                    {lesson.isLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-xs text-muted-foreground">{lesson.estimatedTime}</span>
                    {lesson.score && (
                      <Badge variant="outline" className="text-xs">
                        {lesson.score}%
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div className="text-xs text-muted-foreground mt-1">
                  {lesson.moduleTitle}
                </div>
                
                {lesson.progress > 0 && lesson.progress < 100 && (
                  <Progress value={lesson.progress} className="h-1 mt-2" />
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

const CourseNavigation: React.FC<CourseNavigationProps> = ({
  course,
  currentLessonId,
  onLessonSelect,
  onModuleToggle,
  isCollapsed = false,
  onCollapse
}) => {
  const [expandedModules, setExpandedModules] = useState<number[]>(
    course.modules.map(m => m.id) // All modules expanded by default
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [showCompleted, setShowCompleted] = useState(true);
  const [viewMode, setViewMode] = useState<'modules' | 'path' | 'timeline'>('modules');
  const [isPinned, setIsPinned] = useState(false);
  const [showMinimap, setShowMinimap] = useState(false);

  const toggleModule = (moduleId: number) => {
    setExpandedModules(prev => 
      prev.includes(moduleId) 
        ? prev.filter(id => id !== moduleId)
        : [...prev, moduleId]
    );
    onModuleToggle?.(moduleId);
  };

  const filteredLessons = course.modules.flatMap(module => 
    module.lessons.filter(lesson => {
      const matchesSearch = lesson.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           lesson.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'all' || lesson.type === filterType;
      const matchesCompletion = showCompleted || !lesson.isCompleted;
      
      return matchesSearch && matchesType && matchesCompletion;
    })
  );

  const overallProgress = course.modules.reduce((acc, module) => acc + module.progress, 0) / course.modules.length;

  if (isCollapsed) {
    return (
      <motion.div
        className="w-16 border-r bg-muted/30 flex flex-col items-center py-4 space-y-4"
        initial={{ width: 320 }}
        animate={{ width: 64 }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onCollapse?.(false)}
          className="w-10 h-10"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
        
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-xs font-bold">{Math.round(overallProgress)}%</span>
        </div>
        
        <div className="flex-1 flex flex-col items-center space-y-2">
          {course.modules.map((module) => (
            <TooltipProvider key={module.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div 
                    className={`w-8 h-2 rounded-full cursor-pointer transition-colors ${
                      module.isCompleted ? 'bg-green-500' : 'bg-muted'
                    }`}
                    onClick={() => toggleModule(module.id)}
                  />
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{module.title}</p>
                  <p className="text-xs text-muted-foreground">{module.progress}% complete</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={`${isPinned ? 'w-96' : 'w-80'} border-r bg-background flex flex-col h-full`}
      initial={{ width: 64 }}
      animate={{ width: isPinned ? 384 : 320 }}
    >
      {/* Header */}
      <div className="p-4 border-b bg-muted/20">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-lg truncate">{course.title}</h2>
          <div className="flex space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsPinned(!isPinned)}
              className={isPinned ? 'text-blue-500' : ''}
            >
              <PinIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCollapse?.(true)}
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-medium">{Math.round(overallProgress)}%</span>
          </div>
          <Progress value={overallProgress} className="h-2" />
        </div>
        
        <div className="flex items-center space-x-4 mt-3 text-sm text-muted-foreground">
          <div className="flex items-center space-x-1">
            <Users className="h-4 w-4" />
            <span>{course.enrollmentCount}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            <span>{course.rating}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Clock className="h-4 w-4" />
            <span>{course.totalDuration}</span>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="p-4 border-b space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search lessons..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <div className="flex space-x-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="video">Videos</SelectItem>
              <SelectItem value="text">Reading</SelectItem>
              <SelectItem value="quiz">Quizzes</SelectItem>
              <SelectItem value="assignment">Assignments</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            variant={showCompleted ? "default" : "outline"}
            size="sm"
            onClick={() => setShowCompleted(!showCompleted)}
          >
            {showCompleted ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* View Mode Tabs */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-3 mx-4 mt-2">
          <TabsTrigger value="modules" className="text-xs">
            <BookOpen className="h-3 w-3 mr-1" />
            Modules
          </TabsTrigger>
          <TabsTrigger value="path" className="text-xs">
            <Route className="h-3 w-3 mr-1" />
            Path
          </TabsTrigger>
          <TabsTrigger value="timeline" className="text-xs">
            <BarChart3 className="h-3 w-3 mr-1" />
            Progress
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="modules" className="h-full m-0 p-4 overflow-y-auto">
            <div className="space-y-3">
              {course.modules.map((module) => (
                <Collapsible
                  key={module.id}
                  open={expandedModules.includes(module.id)}
                  onOpenChange={() => toggleModule(module.id)}
                >
                  <CollapsibleTrigger asChild>
                    <motion.div
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer border"
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className="flex items-center">
                          {module.isCompleted ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <Circle className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2">
                            <h4 className="font-medium truncate">{module.title}</h4>
                            <DifficultyBadge difficulty={module.difficulty} />
                          </div>
                          <div className="flex items-center space-x-2 mt-1">
                            <p className="text-sm text-muted-foreground">
                              {module.lessons.length} lessons • {module.estimatedDuration}
                            </p>
                          </div>
                          <Progress value={module.progress} className="h-1 mt-2" />
                        </div>
                      </div>
                      <ChevronRight className={`h-4 w-4 transition-transform ${
                        expandedModules.includes(module.id) ? 'rotate-90' : ''
                      }`} />
                    </motion.div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <div className="mt-2 ml-8 space-y-1">
                      {module.lessons.map((lesson) => (
                        <motion.div
                          key={lesson.id}
                          className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-all duration-200 ${
                            currentLessonId === lesson.id 
                              ? 'bg-primary/10 border-l-4 border-l-primary' 
                              : 'hover:bg-muted/30'
                          } ${lesson.isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                          onClick={() => !lesson.isLocked && onLessonSelect(lesson.id, module.id)}
                          whileHover={{ scale: lesson.isLocked ? 1 : 1.02 }}
                          whileTap={{ scale: lesson.isLocked ? 1 : 0.98 }}
                        >
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <LessonIcon 
                              type={lesson.type} 
                              isCompleted={lesson.isCompleted}
                              isPlaying={lesson.id === currentLessonId}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium truncate">{lesson.title}</span>
                                {lesson.isLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
                              </div>
                              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                                <span>{lesson.estimatedTime}</span>
                                <DifficultyBadge difficulty={lesson.difficulty} />
                                {lesson.score && (
                                  <Badge variant="outline" className="text-xs">
                                    {lesson.score}%
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {lesson.progress > 0 && lesson.progress < 100 && (
                            <div className="w-16">
                              <Progress value={lesson.progress} className="h-1" />
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="path" className="h-full m-0 p-4 overflow-y-auto">
            <LearningPath 
              modules={course.modules}
              currentLessonId={currentLessonId}
              onLessonSelect={onLessonSelect}
            />
          </TabsContent>

          <TabsContent value="timeline" className="h-full m-0 p-4 overflow-y-auto">
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="font-semibold mb-2">Learning Statistics</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-3 text-center">
                      <div className="text-2xl font-bold text-green-500">
                        {course.modules.reduce((acc, m) => acc + m.lessons.filter(l => l.isCompleted).length, 0)}
                      </div>
                      <div className="text-xs text-muted-foreground">Completed</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <div className="text-2xl font-bold text-blue-500">
                        {course.modules.reduce((acc, m) => acc + m.lessons.length, 0) - 
                         course.modules.reduce((acc, m) => acc + m.lessons.filter(l => l.isCompleted).length, 0)}
                      </div>
                      <div className="text-xs text-muted-foreground">Remaining</div>
                    </CardContent>
                  </Card>
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium">Module Progress</h4>
                {course.modules.map((module) => (
                  <div key={module.id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="truncate">{module.title}</span>
                      <span>{Math.round(module.progress)}%</span>
                    </div>
                    <Progress value={module.progress} className="h-2" />
                  </div>
                ))}
              </div>
              
              {course.lastAccessed && (
                <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                  <div className="text-sm font-medium">Last Studied</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(course.lastAccessed).toLocaleDateString()}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </div>
      </Tabs>

      {/* Mini-map Toggle */}
      <div className="p-4 border-t">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowMinimap(!showMinimap)}
          className="w-full"
        >
          <Compass className="h-4 w-4 mr-2" />
          {showMinimap ? 'Hide' : 'Show'} Course Map
        </Button>
      </div>

      {/* Course Mini-map Modal */}
      <Dialog open={showMinimap} onOpenChange={setShowMinimap}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Course Overview</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto max-h-[60vh]">
            {course.modules.map((module) => (
              <Card key={module.id} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm">{module.title}</h4>
                    {module.isCompleted && <CheckCircle className="h-4 w-4 text-green-500" />}
                  </div>
                  <Progress value={module.progress} className="h-1 mb-2" />
                  <div className="space-y-1">
                    {module.lessons.map((lesson) => (
                      <div
                        key={lesson.id}
                        className={`flex items-center space-x-2 text-xs p-1 rounded ${
                          lesson.id === currentLessonId ? 'bg-primary/10' : ''
                        }`}
                        onClick={() => onLessonSelect(lesson.id, module.id)}
                      >
                        <LessonIcon 
                          type={lesson.type} 
                          isCompleted={lesson.isCompleted}
                        />
                        <span className="truncate">{lesson.title}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default CourseNavigation;