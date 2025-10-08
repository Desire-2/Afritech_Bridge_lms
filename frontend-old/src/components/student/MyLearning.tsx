"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  PlayCircle,
  CheckCircle,
  Clock,
  Users,
  Target,
  TrendingUp,
  Star,
  Award,
  BarChart3,
  Calendar,
  ChevronRight,
  Filter,
  Search,
  Download,
  Share,
  Bookmark,
  ArrowRight,
  Lock,
  Unlock,
  Trophy,
  Flame,
  Zap,
  Code,
  FileText,
  Video,
  Headphones
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import ProgressionSystem from './ProgressionSystem';

interface LessonContent {
  id: string;
  title: string;
  type: 'video' | 'text' | 'interactive' | 'quiz' | 'assignment' | 'project';
  duration: number; // in minutes
  completed: boolean;
  score?: number;
  attempts?: number;
  last_accessed?: string;
}

interface Module {
  id: string;
  title: string;
  description: string;
  order: number;
  status: 'locked' | 'unlocked' | 'in_progress' | 'completed' | 'failed';
  progress_percentage: number;
  cumulative_score: number;
  lessons: LessonContent[];
  estimated_duration: number; // total minutes
  skills: string[];
  hands_on_projects: number;
  prerequisites_met: boolean;
}

interface EnrolledCourse {
  id: string;
  title: string;
  instructor_name: string;
  thumbnail_url?: string;
  progress_percentage: number;
  current_module_id?: string;
  modules: Module[];
  total_duration: number; // in minutes
  skills_acquired: string[];
  certificates_available: number;
  last_accessed: string;
  enrollment_date: string;
  estimated_completion: string;
  learning_path: string[];
  hands_on_score: number;
  engagement_score: number;
}

interface LearningStats {
  total_learning_time: number; // minutes
  streak_days: number;
  modules_completed: number;
  projects_completed: number;
  skills_acquired: number;
  certificates_earned: number;
  weekly_goal_progress: number;
  current_level: string;
}

const LessonCard: React.FC<{
  lesson: LessonContent;
  moduleId: string;
  courseId: string;
  isLocked: boolean;
}> = ({ lesson, moduleId, courseId, isLocked }) => {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Video className="h-4 w-4" />;
      case 'text':
        return <FileText className="h-4 w-4" />;
      case 'interactive':
        return <Code className="h-4 w-4" />;
      case 'quiz':
        return <Target className="h-4 w-4" />;
      case 'assignment':
        return <BookOpen className="h-4 w-4" />;
      case 'project':
        return <Trophy className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'video':
        return 'bg-red-100 text-red-600';
      case 'text':
        return 'bg-blue-100 text-blue-600';
      case 'interactive':
        return 'bg-purple-100 text-purple-600';
      case 'quiz':
        return 'bg-yellow-100 text-yellow-600';
      case 'assignment':
        return 'bg-green-100 text-green-600';
      case 'project':
        return 'bg-orange-100 text-orange-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`p-3 rounded-lg border transition-all duration-200 hover:shadow-md ${
        lesson.completed ? 'bg-green-50 border-green-200' :
        isLocked ? 'bg-gray-50 border-gray-200 opacity-60' :
        'bg-white border-gray-200 hover:border-blue-300'
      }`}
    >
      <div className="flex items-center space-x-3">
        <div className={`p-2 rounded-lg ${getTypeColor(lesson.type)}`}>
          {getTypeIcon(lesson.type)}
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate">{lesson.title}</h4>
          <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-1">
            <span className="capitalize">{lesson.type}</span>
            <span>•</span>
            <span>{lesson.duration} min</span>
            {lesson.score && (
              <>
                <span>•</span>
                <span className={lesson.score >= 80 ? 'text-green-600' : 'text-red-600'}>
                  {lesson.score}%
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {lesson.completed ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : isLocked ? (
            <Lock className="h-5 w-5 text-gray-400" />
          ) : (
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
              <PlayCircle className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const ModuleProgressCard: React.FC<{
  module: Module;
  courseId: string;
  onViewDetails: (moduleId: string) => void;
}> = ({ module, courseId, onViewDetails }) => {
  const completedLessons = module.lessons.filter(l => l.completed).length;
  const isPassing = module.cumulative_score >= 80;

  return (
    <Card className={`transition-all duration-300 hover:shadow-lg ${
      module.status === 'completed' ? 'border-green-200 bg-green-50/50' :
      module.status === 'in_progress' ? 'border-blue-200 bg-blue-50/50' :
      module.status === 'failed' ? 'border-red-200 bg-red-50/50' :
      'border-gray-200'
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{module.title}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{module.description}</p>
          </div>
          <Badge variant={
            module.status === 'completed' ? 'default' :
            module.status === 'in_progress' ? 'secondary' :
            module.status === 'failed' ? 'destructive' :
            'outline'
          }>
            {module.status === 'completed' && <CheckCircle className="h-3 w-3 mr-1" />}
            {module.status === 'in_progress' && <PlayCircle className="h-3 w-3 mr-1" />}
            {module.status === 'locked' && <Lock className="h-3 w-3 mr-1" />}
            {module.status.replace('_', ' ')}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress Overview */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Content Progress</span>
            <span>{completedLessons}/{module.lessons.length} completed</span>
          </div>
          <Progress value={module.progress_percentage} className="h-2" />
        </div>

        {/* Score Display */}
        {(module.status === 'in_progress' || module.status === 'completed' || module.status === 'failed') && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Current Score</span>
              <span className={isPassing ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                {module.cumulative_score.toFixed(1)}% / 80%
              </span>
            </div>
            <Progress 
              value={module.cumulative_score} 
              max={100}
              className="h-2"
            />
          </div>
        )}

        {/* Skills & Projects */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Skills to learn:</span>
            <span className="text-muted-foreground">{module.hands_on_projects} projects</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {module.skills.slice(0, 3).map((skill, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {skill}
              </Badge>
            ))}
            {module.skills.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{module.skills.length - 3} more
              </Badge>
            )}
          </div>
        </div>

        {/* Lessons Preview */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Lessons</h4>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {module.lessons.slice(0, 5).map((lesson) => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                moduleId={module.id}
                courseId={courseId}
                isLocked={module.status === 'locked'}
              />
            ))}
            {module.lessons.length > 5 && (
              <div className="text-center py-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => onViewDetails(module.id)}
                >
                  View {module.lessons.length - 5} more lessons
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <Button 
          className="w-full"
          onClick={() => onViewDetails(module.id)}
          disabled={module.status === 'locked'}
        >
          {module.status === 'locked' ? (
            <>
              <Lock className="h-4 w-4 mr-2" />
              Complete Prerequisites
            </>
          ) : module.status === 'completed' ? (
            <>
              <Trophy className="h-4 w-4 mr-2" />
              Review Module
            </>
          ) : (
            <>
              <PlayCircle className="h-4 w-4 mr-2" />
              {module.status === 'in_progress' ? 'Continue Learning' : 'Start Module'}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

const CourseCard: React.FC<{
  course: EnrolledCourse;
  onViewCourse: (courseId: string) => void;
}> = ({ course, onViewCourse }) => {
  const completedModules = course.modules.filter(m => m.status === 'completed').length;
  const currentModule = course.modules.find(m => m.id === course.current_module_id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="h-full hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer"
            onClick={() => onViewCourse(course.id)}>
        {course.thumbnail_url && (
          <div className="aspect-video bg-muted rounded-t-lg overflow-hidden">
            <img 
              src={course.thumbnail_url} 
              alt={course.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        
        <CardContent className="p-4 space-y-3">
          <div>
            <h3 className="font-semibold text-lg line-clamp-2">{course.title}</h3>
            <p className="text-sm text-muted-foreground">{course.instructor_name}</p>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span className="font-medium">{Math.round(course.progress_percentage)}%</span>
            </div>
            <Progress value={course.progress_percentage} className="h-2" />
          </div>

          {/* Current Module */}
          {currentModule && (
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-xs text-blue-600 font-medium mb-1">CURRENT MODULE</div>
              <div className="text-sm font-medium">{currentModule.title}</div>
              <div className="text-xs text-blue-600 mt-1">
                {currentModule.lessons.filter(l => l.completed).length}/{currentModule.lessons.length} lessons completed
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-sm font-medium">{completedModules}/{course.modules.length}</div>
              <div className="text-xs text-muted-foreground">Modules</div>
            </div>
            <div>
              <div className="text-sm font-medium">{course.hands_on_score}%</div>
              <div className="text-xs text-muted-foreground">Hands-on</div>
            </div>
            <div>
              <div className="text-sm font-medium">{course.certificates_available}</div>
              <div className="text-xs text-muted-foreground">Certificates</div>
            </div>
          </div>

          {/* Skills */}
          <div className="flex flex-wrap gap-1">
            {course.skills_acquired.slice(0, 3).map((skill, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {skill}
              </Badge>
            ))}
            {course.skills_acquired.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{course.skills_acquired.length - 3} more
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Last accessed: {new Date(course.last_accessed).toLocaleDateString()}</span>
            <Button size="sm" variant="outline">
              Continue
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const MyLearning: React.FC = () => {
  const [courses, setCourses] = useState<EnrolledCourse[]>([]);
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [selectedCourse, setSelectedCourse] = useState<EnrolledCourse | null>(null);
  const [viewMode, setViewMode] = useState<'courses' | 'modules'>('courses');
  const { user } = useAuth();

  // Mock data - replace with actual API calls
  useEffect(() => {
    const fetchLearningData = async () => {
      setLoading(true);
      try {
        // Mock enrolled courses
        const mockCourses: EnrolledCourse[] = [
          {
            id: '1',
            title: 'Full Stack Web Development with React & Node.js',
            instructor_name: 'Dr. Sarah Johnson',
            thumbnail_url: '/course-thumbnails/fullstack.jpg',
            progress_percentage: 65,
            current_module_id: '2',
            total_duration: 2880, // 48 hours
            skills_acquired: ['React', 'Node.js', 'MongoDB', 'JavaScript'],
            certificates_available: 1,
            last_accessed: '2024-01-20T10:30:00Z',
            enrollment_date: '2024-01-01T09:00:00Z',
            estimated_completion: '2024-03-15T17:00:00Z',
            learning_path: ['Frontend Basics', 'React Advanced', 'Backend Development', 'Full Stack Projects'],
            hands_on_score: 88,
            engagement_score: 92,
            modules: [
              {
                id: '1',
                title: 'Introduction to Web Development',
                description: 'Learn HTML, CSS, and JavaScript fundamentals',
                order: 1,
                status: 'completed',
                progress_percentage: 100,
                cumulative_score: 88.5,
                estimated_duration: 480, // 8 hours
                skills: ['HTML', 'CSS', 'JavaScript'],
                hands_on_projects: 3,
                prerequisites_met: true,
                lessons: [
                  {
                    id: '1-1',
                    title: 'Introduction to HTML',
                    type: 'video',
                    duration: 45,
                    completed: true,
                    score: 95,
                    last_accessed: '2024-01-02T14:30:00Z'
                  },
                  {
                    id: '1-2',
                    title: 'CSS Styling Basics',
                    type: 'interactive',
                    duration: 60,
                    completed: true,
                    score: 88,
                    last_accessed: '2024-01-03T10:15:00Z'
                  },
                  {
                    id: '1-3',
                    title: 'JavaScript Fundamentals',
                    type: 'text',
                    duration: 90,
                    completed: true,
                    score: 82,
                    last_accessed: '2024-01-04T16:20:00Z'
                  },
                  {
                    id: '1-4',
                    title: 'Build Your First Website',
                    type: 'project',
                    duration: 120,
                    completed: true,
                    score: 92,
                    last_accessed: '2024-01-06T11:45:00Z'
                  }
                ]
              },
              {
                id: '2',
                title: 'React Development',
                description: 'Master React components and state management',
                order: 2,
                status: 'in_progress',
                progress_percentage: 60,
                cumulative_score: 72.5, // Below passing
                estimated_duration: 720, // 12 hours
                skills: ['React', 'JSX', 'State Management', 'Hooks'],
                hands_on_projects: 4,
                prerequisites_met: true,
                lessons: [
                  {
                    id: '2-1',
                    title: 'React Components',
                    type: 'video',
                    duration: 75,
                    completed: true,
                    score: 85,
                    last_accessed: '2024-01-15T09:30:00Z'
                  },
                  {
                    id: '2-2',
                    title: 'State and Props',
                    type: 'interactive',
                    duration: 90,
                    completed: true,
                    score: 78,
                    last_accessed: '2024-01-16T14:20:00Z'
                  },
                  {
                    id: '2-3',
                    title: 'React Hooks',
                    type: 'video',
                    duration: 105,
                    completed: false,
                    last_accessed: '2024-01-18T11:00:00Z'
                  },
                  {
                    id: '2-4',
                    title: 'Building a Todo App',
                    type: 'project',
                    duration: 180,
                    completed: false
                  }
                ]
              },
              {
                id: '3',
                title: 'Backend Development with Node.js',
                description: 'Build server-side applications and APIs',
                order: 3,
                status: 'locked',
                progress_percentage: 0,
                cumulative_score: 0,
                estimated_duration: 960, // 16 hours
                skills: ['Node.js', 'Express', 'MongoDB', 'API Design'],
                hands_on_projects: 5,
                prerequisites_met: false,
                lessons: []
              }
            ]
          }
        ];

        // Mock learning stats
        const mockStats: LearningStats = {
          total_learning_time: 1250, // minutes
          streak_days: 7,
          modules_completed: 8,
          projects_completed: 12,
          skills_acquired: 15,
          certificates_earned: 3,
          weekly_goal_progress: 85,
          current_level: 'Intermediate'
        };

        setCourses(mockCourses);
        setStats(mockStats);
      } catch (error) {
        console.error('Failed to fetch learning data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLearningData();
  }, []);

  const filteredCourses = courses.filter(course =>
    course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    course.instructor_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleViewCourse = (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    if (course) {
      setSelectedCourse(course);
      setViewMode('modules');
    }
  };

  const handleViewModuleDetails = (moduleId: string) => {
    // Navigate to detailed module view
    console.log('Viewing module details:', moduleId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Learning</h1>
          <p className="text-muted-foreground">
            Continue your learning journey with hands-on projects and skill mastery
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="bg-orange-50 text-orange-800">
            <Flame className="h-4 w-4 mr-1" />
            {stats?.streak_days} day streak
          </Badge>
          <Badge variant="outline" className="bg-purple-50 text-purple-800">
            <Zap className="h-4 w-4 mr-1" />
            {stats?.current_level}
          </Badge>
        </div>
      </div>

      {/* Learning Stats */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Learning Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{Math.floor(stats.total_learning_time / 60)}h</div>
                <div className="text-xs text-muted-foreground">Learning Time</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.modules_completed}</div>
                <div className="text-xs text-muted-foreground">Modules Done</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{stats.projects_completed}</div>
                <div className="text-xs text-muted-foreground">Projects Built</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{stats.skills_acquired}</div>
                <div className="text-xs text-muted-foreground">Skills Learned</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{stats.certificates_earned}</div>
                <div className="text-xs text-muted-foreground">Certificates</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.streak_days}</div>
                <div className="text-xs text-muted-foreground">Day Streak</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-600">{stats.weekly_goal_progress}%</div>
                <div className="text-xs text-muted-foreground">Weekly Goal</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation Tabs */}
      <Tabs value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <TabsList>
            <TabsTrigger value="courses">My Courses</TabsTrigger>
            <TabsTrigger value="modules" disabled={!selectedCourse}>
              {selectedCourse ? `${selectedCourse.title} - Modules` : 'Module View'}
            </TabsTrigger>
          </TabsList>

          {viewMode === 'courses' && (
            <div className="flex space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search courses..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Recently Accessed</SelectItem>
                  <SelectItem value="progress">Progress</SelectItem>
                  <SelectItem value="title">Title</SelectItem>
                  <SelectItem value="enrollment">Enrollment Date</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {viewMode === 'modules' && selectedCourse && (
            <Button 
              variant="outline" 
              onClick={() => {
                setViewMode('courses');
                setSelectedCourse(null);
              }}
            >
              ← Back to Courses
            </Button>
          )}
        </div>

        <TabsContent value="courses" className="space-y-6">
          {filteredCourses.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No enrolled courses</h3>
                <p className="text-muted-foreground mb-4">
                  Start your learning journey by enrolling in a course
                </p>
                <Button>Browse Courses</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              <AnimatePresence>
                {filteredCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    onViewCourse={handleViewCourse}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>

        <TabsContent value="modules" className="space-y-6">
          {selectedCourse ? (
            <>
              {/* Course Header */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-2xl font-bold">{selectedCourse.title}</h2>
                      <p className="text-muted-foreground">{selectedCourse.instructor_name}</p>
                      <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                        <span>{Math.floor(selectedCourse.total_duration / 60)} hours total</span>
                        <span>•</span>
                        <span>{selectedCourse.modules.length} modules</span>
                        <span>•</span>
                        <span>Hands-on Score: {selectedCourse.hands_on_score}%</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">{Math.round(selectedCourse.progress_percentage)}%</div>
                      <div className="text-sm text-muted-foreground">Complete</div>
                    </div>
                  </div>
                  <Progress value={selectedCourse.progress_percentage} className="h-3 mt-4" />
                </CardContent>
              </Card>

              {/* Modules Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AnimatePresence>
                  {selectedCourse.modules.map((module) => (
                    <ModuleProgressCard
                      key={module.id}
                      module={module}
                      courseId={selectedCourse.id}
                      onViewDetails={handleViewModuleDetails}
                    />
                  ))}
                </AnimatePresence>
              </div>

              {/* Progression System */}
              <ProgressionSystem 
                courseId={selectedCourse.id}
                enrollmentId="enrollment-1" // This would come from the course data
              />
            </>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Select a course</h3>
                <p className="text-muted-foreground">
                  Choose a course from the courses tab to view its modules and progress
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MyLearning;