'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, 
  Play, 
  Users, 
  Star, 
  BookOpen, 
  Award, 
  CheckCircle, 
  Lock,
  Unlock,
  AlertCircle,
  Target,
  TrendingUp,
  Video,
  FileText,
  HelpCircle,
  Sparkles,
  ArrowRight,
  User,
  Calendar,
  Clock,
  BarChart3,
  MessageSquare,
  Shield,
  Globe,
  Heart,
  Zap,
  Trophy,
  GraduationCap,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { StudentService } from '@/services/student.service';
import ModuleUnlockAnimation from '@/components/student/ModuleUnlockAnimation';
import ContextualHelpDialog from '@/components/student/ContextualHelpDialog';

interface CourseLesson {
  id: number;
  title: string;
  description: string;
  content_type: 'video' | 'text' | 'quiz' | 'assignment';
  duration_minutes: number;
  is_completed?: boolean;
  is_locked?: boolean;
  video_url?: string;
  content_data?: string;
  transcript?: string;
  resources?: any[];
}

interface CourseModule {
  id: number;
  title: string;
  description: string;
  order_index: number;
  lessons: CourseLesson[];
  is_unlocked?: boolean;
  completion_percentage?: number;
}

interface Course {
  id: number;
  title: string;
  description: string;
  instructor_name?: string;
  thumbnail_url?: string;
  duration_hours?: number;
  difficulty_level?: string;
  modules?: CourseModule[];
  target_audience?: string;
  learning_outcomes?: string[];
  prerequisites?: string[];
  category?: string;
  price?: number;
  rating?: number;
  total_students?: number;
  is_published?: boolean;
  created_at?: string;
}

interface Enrollment {
  enrolled_at: string;
  completion_date?: string;
  is_completed: boolean;
}

interface ProgressData {
  overall_progress: number;
  current_module: any;
  modules: any[];
}

interface CourseDetailData {
  success: boolean;
  course: Course;
  current_lesson?: CourseLesson;
  progress: ProgressData;
  enrollment?: Enrollment;
}

export default function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // Unwrap params using React.use() for Next.js 15+ compatibility
  const { id: courseIdParam } = use(params);
  const courseId = parseInt(courseIdParam);

  const [courseData, setCourseData] = useState<CourseDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [showUnlockAnimation, setShowUnlockAnimation] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [unlockedModuleName, setUnlockedModuleName] = useState('');

  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const fetchCourseData = async () => {
      try {
        setLoading(true);
        setError(null);

        // First try to get enrolled course data (this will fail if not enrolled)
        try {
          const enrolledCourseData = await StudentService.getCourseForLearning(courseId);
          setCourseData(enrolledCourseData);
          setIsEnrolled(true);
          console.log('Enrolled course data:', enrolledCourseData);
        } catch (enrolledError) {
          console.log('Not enrolled, fetching browse data:', enrolledError);
          
          // If not enrolled, get course from browse API
          const browseData = await StudentService.browseCourses();
          console.log('Browse data:', browseData);
          
          // browseData is already the array of courses (not wrapped in a 'courses' property)
          const course = Array.isArray(browseData) 
            ? browseData.find((c: Course) => c.id === courseId)
            : browseData.courses?.find((c: Course) => c.id === courseId);
          
          if (!course) {
            throw new Error('Course not found');
          }

          console.log('Found course:', course);

          // Create basic course data structure
          setCourseData({
            success: true,
            course: course,
            progress: {
              overall_progress: 0,
              current_module: null,
              modules: []
            }
          });
          setIsEnrolled(false);
        }
      } catch (err: any) {
        console.error('Error fetching course data:', err);
        setError(err.message || 'Failed to load course details');
      } finally {
        setLoading(false);
      }
    };

    fetchCourseData();
  }, [courseId]);

  const handleEnroll = async () => {
    if (!user) {
      router.push('/auth/login');
      return;
    }

    setEnrolling(true);
    try {
      await StudentService.enrollInCourse(courseId);
      
      // Show unlock animation for first module
      setUnlockedModuleName(courseData?.course.modules?.[0]?.title || 'First Module');
      setShowUnlockAnimation(true);
      
      // Refresh course data to get enrolled version
      const enrolledCourseData = await StudentService.getCourseForLearning(courseId);
      setCourseData(enrolledCourseData);
      setIsEnrolled(true);
    } catch (err: any) {
      console.error('Enrollment failed:', err);
      setError('Failed to enroll in course. Please try again.');
    } finally {
      setEnrolling(false);
    }
  };

  const handleStartLearning = () => {
    if (isEnrolled) {
      // Navigate to the dedicated Phase 5 Enhanced Learning Interface
      // This connects to the full learning environment with all Phase 5 features:
      // - Progressive learning hooks with attempt counters
      // - ModuleUnlockAnimation with celebration effects
      // - ContextualHelpDialog with 4-tab help system
      // - Enhanced content viewer with interactive features
      // - Learning analytics and progress tracking
      router.push(`/learn/${courseId}`);
    }
  };

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'video': return <Video className="h-4 w-4" />;
      case 'text': return <FileText className="h-4 w-4" />;
      case 'quiz': return <HelpCircle className="h-4 w-4" />;
      case 'assignment': return <Target className="h-4 w-4" />;
      default: return <BookOpen className="h-4 w-4" />;
    }
  };

  const getDifficultyColor = (level?: string) => {
    switch (level?.toLowerCase()) {
      case 'beginner': return 'bg-green-100 text-green-800 border-green-200';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'advanced': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading course details...</p>
        </div>
      </div>
    );
  }

  if (error || !courseData?.course) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <h1 className="text-2xl font-bold">Error</h1>
          <p className="text-muted-foreground">{error || 'Course not found'}</p>
          <Button onClick={() => router.back()}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const { course, progress, enrollment } = courseData;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="container mx-auto px-4 py-6">
        {/* Navigation */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <Button variant="ghost" onClick={() => router.back()}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Courses
          </Button>
        </motion.div>

        <div className="max-w-7xl mx-auto space-y-8">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white"
          >
            <div className="absolute inset-0 bg-black/20" />
            <div className="relative p-8 md:p-12">
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Badge variant="secondary" className="mb-2">
                      {course.category || course.target_audience || 'Programming'}
                    </Badge>
                    <h1 className="text-3xl md:text-5xl font-bold leading-tight">
                      {course.title}
                    </h1>
                    <p className="text-lg md:text-xl text-blue-100 leading-relaxed">
                      {course.description}
                    </p>
                  </div>

                  {/* Course Stats */}
                  <div className="flex flex-wrap gap-6">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-5 w-5 text-blue-200" />
                      <span className="text-sm font-medium">
                        {course.duration_hours ? `${course.duration_hours} hours` : '8 hours'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Users className="h-5 w-5 text-blue-200" />
                      <span className="text-sm font-medium">
                        {course.total_students || 2456} students
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Star className="h-5 w-5 text-yellow-300 fill-current" />
                      <span className="text-sm font-medium">
                        {course.rating || 4.8} rating
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <GraduationCap className="h-5 w-5 text-blue-200" />
                      <Badge className={getDifficultyColor(course.difficulty_level)}>
                        {course.difficulty_level || 'Intermediate'}
                      </Badge>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-4">
                    {!isEnrolled ? (
                      <Button
                        size="lg"
                        onClick={handleEnroll}
                        disabled={enrolling}
                        className="bg-white text-blue-600 hover:bg-blue-50 font-semibold"
                      >
                        {enrolling ? (
                          <>
                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                            Enrolling...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-5 w-5 mr-2" />
                            Enroll Now - Free
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button
                        size="lg"
                        onClick={handleStartLearning}
                        className="bg-green-500 hover:bg-green-600 text-white font-semibold"
                      >
                        <Play className="h-5 w-5 mr-2" />
                        {progress?.overall_progress > 0 ? 'Continue Learning' : 'Start Learning'}
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => setShowHelpDialog(true)}
                      className="border-white/30 text-white hover:bg-white/10"
                    >
                      <HelpCircle className="h-5 w-5 mr-2" />
                      Get Help
                    </Button>
                  </div>

                  {/* Progress for Enrolled Students */}
                  {isEnrolled && progress && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-white/10 backdrop-blur-sm rounded-xl p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Course Progress</span>
                        <span className="text-sm font-bold">
                          {Math.round(progress.overall_progress)}%
                        </span>
                      </div>
                      <Progress 
                        value={progress.overall_progress} 
                        className="bg-white/20"
                      />
                      {enrollment?.enrolled_at && (
                        <p className="text-xs text-blue-100">
                          Enrolled on {new Date(enrollment.enrolled_at).toLocaleDateString()}
                        </p>
                      )}
                    </motion.div>
                  )}
                </div>

                {/* Course Image/Video Preview */}
                <div className="relative">
                  <div className="aspect-video rounded-xl overflow-hidden bg-black/20 backdrop-blur-sm border border-white/20">
                    {course.thumbnail_url ? (
                      <img
                        src={course.thumbnail_url}
                        alt={course.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Play className="h-16 w-16 text-white/60" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/20" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Button
                        size="lg"
                        variant="secondary"
                        className="bg-white/20 backdrop-blur-sm border-white/30 text-white hover:bg-white/30"
                      >
                        <Play className="h-6 w-6 mr-2" />
                        Preview Course
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Main Content */}
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left Column - Course Content */}
            <div className="lg:col-span-2 space-y-8">
              <Tabs defaultValue="curriculum" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="curriculum">
                    <BookOpen className="h-4 w-4 mr-2" />
                    Curriculum
                  </TabsTrigger>
                  <TabsTrigger value="overview">
                    <Target className="h-4 w-4 mr-2" />
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="instructor">
                    <User className="h-4 w-4 mr-2" />
                    Instructor
                  </TabsTrigger>
                  <TabsTrigger value="reviews">
                    <Star className="h-4 w-4 mr-2" />
                    Reviews
                  </TabsTrigger>
                </TabsList>

                {/* Curriculum Tab */}
                <TabsContent value="curriculum" className="space-y-4">
                  {course.modules && course.modules.length > 0 ? (
                    <div className="space-y-4">
                      {course.modules.map((module, moduleIndex) => (
                        <motion.div
                          key={module.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: moduleIndex * 0.1 }}
                        >
                          <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className="h-8 w-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold">
                                    {moduleIndex + 1}
                                  </div>
                                  <div>
                                    <CardTitle className="text-lg">{module.title}</CardTitle>
                                    <p className="text-sm text-muted-foreground mt-1">
                                      {module.description}
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                  {isEnrolled ? (
                                    module.is_unlocked !== false ? (
                                      <Badge variant="outline" className="text-green-600 border-green-300">
                                        <Unlock className="h-3 w-3 mr-1" />
                                        Unlocked
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-gray-500 border-gray-300">
                                        <Lock className="h-3 w-3 mr-1" />
                                        Locked
                                      </Badge>
                                    )
                                  ) : (
                                    <Badge variant="outline">
                                      {module.lessons?.length || 0} lessons
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              {isEnrolled && module.completion_percentage !== undefined && (
                                <div className="mt-3">
                                  <div className="flex items-center justify-between text-sm mb-1">
                                    <span>Progress</span>
                                    <span>{Math.round(module.completion_percentage)}%</span>
                                  </div>
                                  <Progress value={module.completion_percentage} className="h-2" />
                                </div>
                              )}
                            </CardHeader>

                            <CardContent className="p-0">
                              {module.lessons && module.lessons.length > 0 && (
                                <div className="divide-y">
                                  {module.lessons.map((lesson, lessonIndex) => (
                                    <div
                                      key={lesson.id}
                                      className={`p-4 flex items-center justify-between hover:bg-gray-50 transition-colors ${
                                        lesson.is_locked && isEnrolled ? 'opacity-50' : ''
                                      }`}
                                    >
                                      <div className="flex items-center space-x-4">
                                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm ${
                                          lesson.is_completed 
                                            ? 'bg-green-100 text-green-600' 
                                            : 'bg-gray-100 text-gray-600'
                                        }`}>
                                          {lesson.is_completed ? (
                                            <CheckCircle className="h-4 w-4" />
                                          ) : (
                                            getContentTypeIcon(lesson.content_type)
                                          )}
                                        </div>
                                        
                                        <div className="flex-1 min-w-0">
                                          <h4 className="font-medium text-gray-900 truncate">
                                            {lesson.title}
                                          </h4>
                                          <p className="text-sm text-gray-500 truncate">
                                            {lesson.description}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="flex items-center space-x-3 flex-shrink-0">
                                        <div className="flex items-center space-x-1 text-sm text-gray-500">
                                          <Clock className="h-3 w-3" />
                                          <span>{lesson.duration_minutes}m</span>
                                        </div>
                                        
                                        {lesson.is_locked && isEnrolled && (
                                          <Lock className="h-4 w-4 text-gray-400" />
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <Card className="p-8 text-center">
                      <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Course Content Coming Soon
                      </h3>
                      <p className="text-gray-500">
                        The course curriculum is being prepared and will be available soon.
                      </p>
                    </Card>
                  )}
                </TabsContent>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-6">
                  {/* Learning Outcomes */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Target className="h-5 w-5 text-blue-500" />
                        <span>What You'll Learn</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-2 gap-3">
                        {course.learning_outcomes && course.learning_outcomes.length > 0 ? (
                          course.learning_outcomes.map((outcome, index) => (
                            <div key={index} className="flex items-start space-x-3">
                              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                              <span className="text-sm">{outcome}</span>
                            </div>
                          ))
                        ) : (
                          [
                            'Master core programming concepts',
                            'Build real-world projects',
                            'Apply best practices and patterns',
                            'Understand advanced techniques',
                            'Develop problem-solving skills',
                            'Create production-ready code'
                          ].map((outcome, index) => (
                            <div key={index} className="flex items-start space-x-3">
                              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                              <span className="text-sm">{outcome}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Prerequisites */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Shield className="h-5 w-5 text-orange-500" />
                        <span>Prerequisites</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {course.prerequisites && course.prerequisites.length > 0 ? (
                          course.prerequisites.map((prereq, index) => (
                            <div key={index} className="flex items-start space-x-3">
                              <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                              <span className="text-sm">{prereq}</span>
                            </div>
                          ))
                        ) : (
                          <div className="flex items-start space-x-3">
                            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span className="text-sm">No prerequisites required - perfect for beginners!</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Course Features */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Sparkles className="h-5 w-5 text-purple-500" />
                        <span>Course Features</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="flex items-center space-x-3">
                          <Video className="h-5 w-5 text-red-500" />
                          <span className="text-sm">HD Video Lessons</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <FileText className="h-5 w-5 text-blue-500" />
                          <span className="text-sm">Downloadable Resources</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Award className="h-5 w-5 text-yellow-500" />
                          <span className="text-sm">Certificate of Completion</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <MessageSquare className="h-5 w-5 text-green-500" />
                          <span className="text-sm">Community Support</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Clock className="h-5 w-5 text-purple-500" />
                          <span className="text-sm">Lifetime Access</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Globe className="h-5 w-5 text-cyan-500" />
                          <span className="text-sm">Mobile & Desktop</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Instructor Tab */}
                <TabsContent value="instructor">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-start space-x-4">
                        <Avatar className="h-16 w-16">
                          <AvatarImage src="/placeholder-instructor.jpg" />
                          <AvatarFallback className="bg-blue-500 text-white text-lg">
                            {course.instructor_name?.[0] || 'I'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-gray-900 mb-2">
                            {course.instructor_name || 'Expert Instructor'}
                          </h3>
                          <p className="text-gray-600 mb-4">
                            Senior Software Engineer & Educational Content Creator
                          </p>
                          <p className="text-sm text-gray-500 leading-relaxed">
                            With over 10 years of experience in software development and education, 
                            our instructor has taught thousands of students and worked with top tech companies. 
                            Passionate about making complex concepts accessible and engaging.
                          </p>
                          
                          <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-blue-600">50K+</div>
                              <div className="text-sm text-gray-500">Students Taught</div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-green-600">4.9</div>
                              <div className="text-sm text-gray-500">Instructor Rating</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Reviews Tab */}
                <TabsContent value="reviews">
                  <Card>
                    <CardContent className="p-6">
                      <div className="text-center py-8">
                        <Star className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          Student Reviews Coming Soon
                        </h3>
                        <p className="text-gray-500">
                          Be among the first to review this course after enrollment.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>

            {/* Right Sidebar */}
            <div className="space-y-6">
              {/* Enrollment Card */}
              <Card className="sticky top-6">
                <CardContent className="p-6">
                  <div className="text-center space-y-4">
                    <div className="text-3xl font-bold text-green-600">
                      {course.price ? `$${course.price}` : 'Free'}
                    </div>
                    
                    {!isEnrolled ? (
                      <Button
                        size="lg"
                        onClick={handleEnroll}
                        disabled={enrolling}
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold"
                      >
                        {enrolling ? (
                          <>
                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                            Enrolling...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-5 w-5 mr-2" />
                            Enroll Now
                          </>
                        )}
                      </Button>
                    ) : (
                      <div className="space-y-3">
                        <Badge variant="outline" className="text-green-600 border-green-300 w-full py-2">
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Enrolled
                        </Badge>
                        <Button
                          size="lg"
                          onClick={handleStartLearning}
                          className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold"
                        >
                          <Play className="h-5 w-5 mr-2" />
                          {progress?.overall_progress > 0 ? 'Continue Learning' : 'Start Learning'}
                        </Button>
                      </div>
                    )}

                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <Heart className="h-4 w-4" />
                      <span>30-day money-back guarantee</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Course Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">Duration</span>
                    </div>
                    <span className="text-sm font-medium">
                      {course.duration_hours ? `${course.duration_hours} hours` : '8 hours'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <BookOpen className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">Modules</span>
                    </div>
                    <span className="text-sm font-medium">
                      {course.modules?.length || 6}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">Students</span>
                    </div>
                    <span className="text-sm font-medium">
                      {course.total_students || '2.4K'}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">Last Updated</span>
                    </div>
                    <span className="text-sm font-medium">
                      {course.created_at 
                        ? new Date(course.created_at).toLocaleDateString()
                        : 'Recently'
                      }
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Help Card */}
              <Card>
                <CardContent className="p-6 text-center space-y-4">
                  <HelpCircle className="h-12 w-12 text-blue-500 mx-auto" />
                  <div>
                    <h3 className="font-semibold mb-2">Need Help?</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Get personalized guidance and support throughout your learning journey.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowHelpDialog(true)}
                      className="w-full"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Get Support
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Module Unlock Animation */}
      <ModuleUnlockAnimation
        isVisible={showUnlockAnimation}
        moduleName={unlockedModuleName}
        onComplete={() => setShowUnlockAnimation(false)}
        celebrationType="unlock"
      />

      {/* Contextual Help Dialog */}
      <ContextualHelpDialog
        isOpen={showHelpDialog}
        onClose={() => setShowHelpDialog(false)}
        context={{
          moduleId: 1,
          moduleName: course.title,
          difficulty: course.difficulty_level
        }}
        strugglingAreas={[]}
      />
    </div>
  );
}

