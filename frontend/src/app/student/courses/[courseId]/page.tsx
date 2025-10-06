"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowLeft,
  BookOpen,
  Clock,
  Users,
  Star,
  Award,
  Play,
  Download,
  Share2,
  Bookmark,
  MessageSquare,
  ChevronRight,
  CheckCircle,
  Lock,
  Calendar,
  DollarSign,
  Globe,
  Video,
  FileText,
  Target,
  TrendingUp,
  Heart,
  Flag
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { StudentApiService } from '@/services/studentApi';
import { Course } from '@/types/api';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const CourseDetailsPage = () => {
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollmentStatus, setEnrollmentStatus] = useState<string>('available');
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const courseId = parseInt(params.courseId as string);

  useEffect(() => {
    if (courseId) {
      fetchCourseDetails();
    }
  }, [courseId]);

  const fetchCourseDetails = async () => {
    try {
      setLoading(true);
      
      // Fetch both course details and enrollment status in parallel
      const [courseResponse, enrollmentResponse] = await Promise.all([
        StudentApiService.getCourseEnrollmentDetails(courseId),
        StudentApiService.getEnrollmentStatus(courseId)
      ]);
      
      setCourse(courseResponse);
      setEnrollmentStatus(enrollmentResponse.data?.status || 'available');
    } catch (error) {
      console.error('Failed to fetch course details:', error);
      // If enrollment status fails, still show the course details
      try {
        const courseResponse = await StudentApiService.getCourseEnrollmentDetails(courseId);
        setCourse(courseResponse);
      } catch (courseError) {
        console.error('Failed to fetch course details:', courseError);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async () => {
    if (!course) return;
    
    try {
      setEnrolling(true);
      
      if (course.enrollment_type === 'scholarship') {
        // Redirect to application process
        await StudentApiService.applyCourse(courseId, {
          motivation: 'I am interested in this course to advance my skills.',
          background: 'Student background'
        });
        alert('Scholarship application submitted successfully!');
      } else {
        // Direct enrollment
        await StudentApiService.enrollCourse(courseId);
        alert('Successfully enrolled in the course!');
        // Refresh course details and enrollment status
        await fetchCourseDetails();
      }
    } catch (error) {
      console.error('Enrollment failed:', error);
      alert('Enrollment failed. Please try again.');
    } finally {
      setEnrolling(false);
    }
  };

  const handleStartLearning = () => {
    if (enrollmentStatus === 'enrolled') {
      // Navigate to the learning interface
      router.push(`/student/learning/${courseId}`);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'advanced': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getLessonIcon = (content_type: string) => {
    switch (content_type) {
      case 'video': return <Video className="h-4 w-4" />;
      case 'text': return <FileText className="h-4 w-4" />;
      case 'pdf': return <FileText className="h-4 w-4" />;
      case 'mixed': return <BookOpen className="h-4 w-4" />;
      default: return <BookOpen className="h-4 w-4" />;
    }
  };

  const totalLessons = course?.modules?.reduce((acc, module) => acc + (module.lessons?.length || 0), 0) || 0;
  const completedLessons = 0; // This would need to come from progress data

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground">Loading course details...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-4">
              <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto">
                <BookOpen className="h-12 w-12 text-muted-foreground" />
              </div>
              <h2 className="text-2xl font-bold">Course Not Found</h2>
              <p className="text-muted-foreground">The course you're looking for doesn't exist or has been removed.</p>
              <Button asChild>
                <Link href="/student/courses">Browse Other Courses</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </motion.div>

        {/* Course Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8"
        >
          {/* Main Content */}
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-8">
                <div className="space-y-6">
                  {/* Course Header */}
                  <div>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <Badge variant="secondary" className={getDifficultyColor(course.difficulty_level)}>
                            {course.difficulty_level}
                          </Badge>
                          <Badge variant="outline">
                            {course.enrollment_type === 'free' ? 'Free' : `$${course.price}`}
                          </Badge>
                        </div>
                        <h1 className="text-3xl font-bold mb-3">{course.title}</h1>
                        <p className="text-lg text-muted-foreground">{course.description}</p>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setIsBookmarked(!isBookmarked)}
                        >
                          <Bookmark className={`h-4 w-4 ${isBookmarked ? 'fill-current' : ''}`} />
                        </Button>
                        <Button variant="outline" size="icon">
                          <Share2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Course Stats */}
                    <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <Clock className="h-4 w-4" />
                        <span>{course.estimated_duration || 'Duration not specified'}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <BookOpen className="h-4 w-4" />
                        <span>{totalLessons} lessons</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Users className="h-4 w-4" />
                        <span>Level: {course.difficulty_level}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-4 w-4" />
                        <span>Last updated {new Date(course.updated_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Instructor Info */}
                  <div className="flex items-center space-x-4 p-4 bg-muted/50 rounded-lg">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={course.instructor_avatar} />
                      <AvatarFallback>
                        {course.instructor_name?.split(' ').map(n => n[0]).join('') || 'IN'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">Instructor: {course.instructor_name || 'Unknown'}</p>
                      {course.instructor_bio && (
                        <p className="text-sm text-muted-foreground">{course.instructor_bio}</p>
                      )}
                    </div>
                  </div>

                  {/* Progress (if enrolled) */}
                  {false && ( // TODO: Add enrollment status from API
                    <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Your Progress</span>
                        <span className="text-sm text-muted-foreground">
                          {completedLessons}/{totalLessons} lessons completed
                        </span>
                      </div>
                      <Progress value={0} className="h-2" />
                      <p className="text-sm text-muted-foreground mt-1">
                        {Math.round(course.progress)}% complete
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Course Thumbnail */}
            <Card>
              <CardContent className="p-0">
                <div className="aspect-video bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 rounded-t-lg flex items-center justify-center">
                  <BookOpen className="h-16 w-16 text-muted-foreground" />
                </div>
                <div className="p-6 space-y-4">
                  {enrollmentStatus === 'enrolled' ? (
                    <Button onClick={handleStartLearning} className="w-full" size="lg">
                      <Play className="h-4 w-4 mr-2" />
                      Continue Learning
                    </Button>
                  ) : enrollmentStatus === 'applied' ? (
                    <Button disabled className="w-full" size="lg">
                      Application Pending
                    </Button>
                  ) : (
                    <Button onClick={handleEnroll} disabled={enrolling} className="w-full" size="lg">
                      {enrolling ? (
                        'Enrolling...'
                      ) : course.enrollment_type === 'scholarship' ? (
                        'Apply for Scholarship'
                      ) : course.enrollment_type === 'free' ? (
                        'Enroll for Free'
                      ) : (
                        `Enroll for $${course.price}`
                      )}
                    </Button>
                  )}
                  
                  <div className="text-center text-sm text-muted-foreground">
                    {enrollmentStatus === 'enrolled' 
                      ? 'Access all course materials' 
                      : '30-day money-back guarantee'
                    }
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Course Features */}
            <Card>
              <CardHeader>
                <CardTitle>This course includes:</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Video className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Video lectures</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Download className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Downloadable resources</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Award className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Certificate of completion</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Lifetime access</span>
                </div>
                <div className="flex items-center space-x-3">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Discussion forum</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>

        {/* Course Content Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Tabs defaultValue="curriculum" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="curriculum">Curriculum</TabsTrigger>
              <TabsTrigger value="objectives">Objectives</TabsTrigger>
              <TabsTrigger value="reviews">Reviews</TabsTrigger>
              <TabsTrigger value="instructor">Instructor</TabsTrigger>
            </TabsList>

            <TabsContent value="curriculum" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Course Curriculum</CardTitle>
                  <p className="text-muted-foreground">
                    {course?.modules?.length || 0} modules • {totalLessons} lessons • {course.estimated_duration}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {course.modules.map((module, index) => (
                    <div key={module.id} className="border rounded-lg">
                      <div className="p-4 bg-muted/30">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-medium">
                              {index + 1}. {module.title}
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              {module.description}
                            </p>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {module.lesson_count} lessons • {module.duration}
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-4 space-y-3">
                        {module.lessons?.map((lesson) => (
                          <div key={lesson.id} className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="flex items-center">
                                {getLessonIcon(lesson.content_type)}
                              </div>
                              <span className="text-sm">
                                {lesson.title}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-muted-foreground">
                                {lesson.duration_minutes} min
                              </span>
                              <Button size="sm" variant="ghost">
                                <Play className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )) || []}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="objectives" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Learning Objectives</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="font-medium mb-3">What you'll learn:</h3>
                    <ul className="space-y-2">
                      {(Array.isArray(course.learning_objectives) 
                        ? course.learning_objectives 
                        : course.learning_objectives 
                          ? [course.learning_objectives] 
                          : ['Course objectives will be provided']
                      ).map((objective, index) => (
                        <li key={index} className="flex items-start space-x-2">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                          <span className="text-sm">{objective}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {course.prerequisites.length > 0 && (
                    <div>
                      <h3 className="font-medium mb-3">Prerequisites:</h3>
                      <ul className="space-y-2">
                        {course.prerequisites.map((prerequisite, index) => (
                          <li key={index} className="flex items-start space-x-2">
                            <Target className="h-4 w-4 text-blue-500 mt-1 flex-shrink-0" />
                            <span className="text-sm">{prerequisite}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <h3 className="font-medium mb-3">Target Audience:</h3>
                    <p className="text-sm text-muted-foreground">{course.target_audience || 'This course is suitable for all learners'}</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reviews" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Student Reviews</CardTitle>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1">
                      <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                      <span className="text-lg font-bold">No ratings yet</span>
                    </div>
                    <span className="text-muted-foreground">
                      0 reviews
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  {false ? ( // TODO: Add reviews from API
                    <div className="space-y-6">
                      {/* Reviews would be mapped here */}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No reviews yet. Be the first to review this course!</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="instructor" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>About the Instructor</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-start space-x-4">
                    <Avatar className="w-16 h-16">
                      <AvatarImage src={course.instructor_avatar} />
                      <AvatarFallback className="text-lg">
                        {course.instructor_name?.split(' ').map(n => n[0]).join('') || 'IN'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-2">{course.instructor_name || 'Unknown Instructor'}</h3>
                      {course.instructor_bio ? (
                        <p className="text-muted-foreground">{course.instructor_bio}</p>
                      ) : (
                        <p className="text-muted-foreground">
                          Experienced instructor passionate about education and helping students achieve their goals.
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
};

export default CourseDetailsPage;