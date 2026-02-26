'use client';

import React, { useState, useEffect, use, useMemo } from 'react';
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
  Loader2,
  CreditCard,
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
import { CourseApiService } from '@/services/api';
import ModuleUnlockAnimation from '@/components/student/ModuleUnlockAnimation';
import ContextualHelpDialog from '@/components/student/ContextualHelpDialog';
import {
  normalizeApplicationWindows,
  getPrimaryWindow,
  getCurrentCohort,
  getNextCohort,
  formatDate as cohortFormatDate,
  formatDateTime as cohortFormatDateTime,
  getStatusBadgeStyles,
} from '@/utils/cohort-utils';
import type { ApplicationWindowData } from '@/types/api';
import { CurrencySelector, ConvertedBadge } from '@/components/ui/CurrencyDisplay';

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
  application_start_date?: string | null;
  application_end_date?: string | null;
  cohort_start_date?: string | null;
  cohort_end_date?: string | null;
  cohort_label?: string | null;
  application_timezone?: string;
  enrollment_type?: 'free' | 'paid' | 'scholarship';
  currency?: string | null;
  payment_mode?: 'full' | 'partial' | 'installment';
  partial_payment_amount?: number | null;
  partial_payment_percentage?: number | null;
  payment_methods?: string[];
  paypal_enabled?: boolean;
  mobile_money_enabled?: boolean;
  bank_transfer_enabled?: boolean;
  bank_transfer_details?: string | null;
  require_payment_before_application?: boolean;
  payment_summary?: {
    total_price: number | null;
    original_price?: number | null;
    currency: string;
    payment_mode: string;
    amount_due_now: number | null;
    remaining_balance?: number;
    partial_payment_percentage?: number;
    enabled_methods: string[];
    bank_transfer_details?: string;
  } | null;
  application_window?: ApplicationWindowData;
  application_windows?: ApplicationWindowData[];
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

  const enhanceWithApplicationData = async (courseIdValue: number) => {
    try {
      const detailedCourse = await CourseApiService.getCourseDetails(courseIdValue);
      setCourseData(prev => {
        if (!prev) return prev;

        const applicationFields = {
          application_start_date: detailedCourse.application_start_date,
          application_end_date: detailedCourse.application_end_date,
          cohort_start_date: detailedCourse.cohort_start_date,
          cohort_end_date: detailedCourse.cohort_end_date,
          cohort_label: detailedCourse.cohort_label,
          application_timezone: detailedCourse.application_timezone,
          application_window: detailedCourse.application_window as ApplicationWindowData | undefined,
          application_windows: detailedCourse.application_windows || [],
          enrollment_type: detailedCourse.enrollment_type,
          currency: detailedCourse.currency ?? prev.course.currency ?? null,
          price: detailedCourse.price ?? prev.course.price,
          payment_mode: detailedCourse.payment_mode,
          partial_payment_amount: detailedCourse.partial_payment_amount,
          partial_payment_percentage: detailedCourse.partial_payment_percentage,
          payment_methods: detailedCourse.payment_methods,
          paypal_enabled: detailedCourse.paypal_enabled,
          mobile_money_enabled: detailedCourse.mobile_money_enabled,
          bank_transfer_enabled: detailedCourse.bank_transfer_enabled,
          bank_transfer_details: detailedCourse.bank_transfer_details,
          require_payment_before_application: detailedCourse.require_payment_before_application,
          payment_summary: detailedCourse.payment_summary ?? null,
        };

        return {
          ...prev,
          course: {
            ...prev.course,
            ...applicationFields
          }
        };
      });
    } catch (metaErr) {
      console.warn('Failed to load application window metadata', metaErr);
    }
  };

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
          enhanceWithApplicationData(courseId);
        } catch (enrolledError) {
          console.log('Not enrolled, fetching browse data:', enrolledError);
          
          // If not enrolled, get course from browse API
          const browseData = await StudentService.browseCourses();
          console.log('Browse data:', browseData);
          
          // browseData is already the array of courses (not wrapped in a 'courses' property)
          const course = Array.isArray(browseData) 
            ? (browseData as any[]).find((c: any) => c.id === courseId)
            : (browseData as any)?.courses?.find((c: any) => c.id === courseId);
          
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
          enhanceWithApplicationData(courseId);
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

  const formatDate = (value?: string | null) => cohortFormatDate(value);

  const formatDateTime = (value?: string | null) => cohortFormatDateTime(value);

  const getApplicationStatusStyles = (status?: string) => getStatusBadgeStyles(status);

  const applicationWindows = useMemo(() => {
    if (!courseData?.course) return [] as ApplicationWindowData[];
    return normalizeApplicationWindows(courseData.course);
  }, [courseData?.course]);

  const primaryApplicationWindow = useMemo(() => getPrimaryWindow(applicationWindows), [applicationWindows]);

  const currentCohort = useMemo(() => getCurrentCohort(applicationWindows), [applicationWindows]);

  const nextCohort = useMemo(() => getNextCohort(applicationWindows, currentCohort), [applicationWindows, currentCohort]);

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
  const applicationWindow = primaryApplicationWindow;
  const heroCohortLabel = applicationWindow?.cohort_label || course.cohort_label;
  const hasMultipleApplicationWindows = applicationWindows.length > 1;

  // Derive effective enrollment info from primary cohort window (falls back to course-level)
  const effectiveEnrollmentType = applicationWindow?.effective_enrollment_type ?? applicationWindow?.enrollment_type ?? course.enrollment_type;
  const effectivePrice = applicationWindow?.effective_price ?? applicationWindow?.price ?? course.price;
  const effectiveCurrency = applicationWindow?.effective_currency ?? applicationWindow?.currency ?? course.currency ?? 'USD';
  const effectivePaymentMode = applicationWindow?.payment_mode ?? course.payment_mode;
  const effectivePaymentMethods = applicationWindow?.payment_methods ?? course.payment_methods;
  const effectivePaymentSummary = applicationWindow?.payment_summary ?? course.payment_summary;
  const effectivePartialAmount = applicationWindow?.partial_payment_amount ?? course.partial_payment_amount;
  const isScholarshipPartial = effectiveEnrollmentType === 'scholarship' && applicationWindow?.scholarship_type === 'partial';
  const scholarshipPct = applicationWindow?.scholarship_percentage;
  // For scholarship: student pays (100 - scholarship_percentage)%; for paid partial: use partial_payment_percentage directly
  const effectiveStudentPct = isScholarshipPartial && scholarshipPct != null
    ? Math.round((100 - scholarshipPct) * 100) / 100
    : (applicationWindow?.partial_payment_percentage ?? course.partial_payment_percentage);
  const effectiveOriginalPrice = effectivePaymentSummary?.original_price ?? course.price; // Pre-scholarship total
  const isPartialScholarship = (effectiveEnrollmentType === 'scholarship' && applicationWindow?.scholarship_type === 'partial') ||
                               (effectiveEnrollmentType === 'paid' && effectivePaymentMode === 'partial');

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
            className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white shadow-2xl"
          >
            <div className="absolute inset-0 bg-black/20" />
            <div className="absolute -left-10 -top-10 h-48 w-48 rounded-full bg-white/15 blur-3xl" />
            <div className="absolute -right-10 -bottom-16 h-56 w-56 rounded-full bg-indigo-400/30 blur-3xl" />
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
                    <div className="flex flex-wrap gap-3 pt-2">
                      {heroCohortLabel && (
                        <Badge className="bg-white/15 border-white/20 text-white">
                          Cohort • {heroCohortLabel}
                        </Badge>
                      )}
                      {applicationWindow?.status && (
                        <Badge className="bg-white/15 border-white/20 text-white capitalize">
                          Application {applicationWindow.status}
                        </Badge>
                      )}
                      {course.application_timezone && (
                        <Badge className="bg-white/10 border-white/10 text-white">
                          TZ {course.application_timezone}
                        </Badge>
                      )}
                      {effectiveEnrollmentType && (
                        <Badge className="bg-emerald-400/30 border-white/10 text-white capitalize">
                          {isPartialScholarship ? 'partial scholarship' : effectiveEnrollmentType === 'scholarship' ? 'scholarship' : effectiveEnrollmentType} enrollment
                        </Badge>
                      )}
                    </div>
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

                  {/* Application highlights */}
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white/10 border border-white/15 px-4 py-3 backdrop-blur">
                      <div className="flex items-center gap-2 text-sm text-blue-100">
                        <Target className="h-4 w-4" />
                        Current cohort
                      </div>
                      <div className="text-lg font-semibold flex items-center gap-2">
                        <span>{currentCohort?.cohort_label || 'No active cohort'}</span>
                        {currentCohort?.status && (
                          <Badge className="bg-white/15 border-white/20 text-white capitalize">
                            {currentCohort.status}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-blue-100 mt-1">
                        {formatDate(currentCohort?.cohort_start) || 'Start date TBA'}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/10 border border-white/15 px-4 py-3 backdrop-blur">
                      <div className="flex items-center gap-2 text-sm text-blue-100">
                        <Calendar className="h-4 w-4" />
                        Next cohort
                      </div>
                      <div className="text-lg font-semibold flex items-center gap-2">
                        <span>{nextCohort?.cohort_label || 'Not scheduled yet'}</span>
                        {nextCohort?.status && (
                          <Badge className="bg-white/15 border-white/20 text-white capitalize">
                            {nextCohort.status}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-blue-100 mt-1">
                        {formatDateTime(nextCohort?.opens_at) || formatDate(nextCohort?.cohort_start) || 'Date TBA'}
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-4">
                    {!isEnrolled ? (
                      effectiveEnrollmentType === 'paid' || effectiveEnrollmentType === 'scholarship' ? (
                        <Button
                          size="lg"
                          onClick={() => router.push(`/courses/${courseId}/apply`)}
                          className={effectiveEnrollmentType === 'scholarship' && !isPartialScholarship
                            ? 'bg-amber-500 hover:bg-amber-600 text-white font-semibold shadow-lg shadow-amber-900/30'
                            : 'bg-white text-blue-600 hover:bg-blue-50 font-semibold shadow-lg shadow-blue-900/30'}
                        >
                          {effectiveEnrollmentType === 'scholarship' && !isPartialScholarship ? (
                            <><GraduationCap className="h-5 w-5 mr-2" />Apply for Scholarship</>
                          ) : isPartialScholarship ? (
                            <><GraduationCap className="h-5 w-5 mr-2" />Apply (Partial Scholarship)</>
                          ) : (
                            <><CreditCard className="h-5 w-5 mr-2" />Apply &amp; Pay</>
                          )}
                        </Button>
                      ) : (
                        <Button
                          size="lg"
                          onClick={handleEnroll}
                          disabled={enrolling}
                          className="bg-white text-blue-600 hover:bg-blue-50 font-semibold shadow-lg shadow-blue-900/30"
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
                      )
                    ) : (
                      <Button
                        size="lg"
                        onClick={handleStartLearning}
                        className="bg-green-500 hover:bg-green-600 text-white font-semibold shadow-lg shadow-green-900/30"
                      >
                        <Play className="h-5 w-5 mr-2" />
                        {progress?.overall_progress > 0 ? 'Continue Learning' : 'Start Learning'}
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => setShowHelpDialog(true)}
                      className="border-white/30 text-white hover:bg-white/10 backdrop-blur"
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
              {/* Tuition & Enrollment Card */}
              <Card className="sticky top-6 overflow-hidden">
                {/* Header bar by type */}
                {effectiveEnrollmentType === 'scholarship' && !isPartialScholarship ? (
                  <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4">
                    <div className="flex items-center gap-2 text-white">
                      <GraduationCap className="h-5 w-5" />
                      <span className="font-bold text-lg">Scholarship Program</span>
                    </div>
                    <p className="text-amber-100 text-xs mt-1">Merit-based enrollment · Application required</p>
                  </div>
                ) : effectiveEnrollmentType === 'paid' || isPartialScholarship ? (
                  <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-4">
                    <div className="flex items-center gap-2 text-white">
                      <CreditCard className="h-5 w-5" />
                      <span className="font-bold text-lg">
                        {isPartialScholarship ? 'Partial Scholarship' : 'Full Tuition'}
                      </span>
                    </div>
                    <p className="text-blue-100 text-xs mt-1">
                      {isPartialScholarship
                        ? 'Pay your share — scholarship covers the rest'
                        : 'One-time full payment to enroll'}
                    </p>
                  </div>
                ) : (
                  <div className="bg-gradient-to-r from-emerald-500 to-green-500 px-6 py-4">
                    <div className="flex items-center gap-2 text-white">
                      <Sparkles className="h-5 w-5" />
                      <span className="font-bold text-lg">Free Enrollment</span>
                    </div>
                    <p className="text-emerald-100 text-xs mt-1">No payment required · Open to all</p>
                  </div>
                )}

                <CardContent className="p-6 space-y-5">
                  {/* ── Scholarship: no price, just apply ── */}
                  {effectiveEnrollmentType === 'scholarship' && !isPartialScholarship && (
                    <div className="space-y-4">
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                        <p className="text-sm font-semibold text-amber-900 flex items-center gap-2">
                          <Award className="h-4 w-4 text-amber-600" />
                          Scholarship-Based Enrollment
                        </p>
                        <p className="text-xs text-amber-700 leading-relaxed">
                          This course is offered through a competitive scholarship process.
                          Submit your application — our team will review and notify you of your scholarship status.
                        </p>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs">Merit-based</Badge>
                          <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs">Application required</Badge>
                          <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs">Competitive selection</Badge>
                        </div>
                      </div>
                      {!isEnrolled && (
                        <Button
                          size="lg"
                          onClick={() => router.push(`/courses/${courseId}/apply`)}
                          className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold"
                        >
                          <GraduationCap className="h-5 w-5 mr-2" />
                          Apply for Scholarship
                        </Button>
                      )}
                    </div>
                  )}

                  {/* ── Paid: full or partial tuition ── */}
                  {(effectiveEnrollmentType === 'paid' || isPartialScholarship) && (
                    <div className="space-y-4">
                      {/* Price breakdown */}
                      <div className="flex items-center justify-end">
                        <CurrencySelector compact />
                      </div>
                      {isPartialScholarship ? (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
                          <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide">Partial Scholarship</p>
                          <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-indigo-700">
                              {effectivePaymentSummary?.amount_due_now != null
                                ? `${effectiveCurrency} ${effectivePaymentSummary.amount_due_now.toLocaleString()}`
                                : effectivePartialAmount != null
                                ? `${effectiveCurrency} ${effectivePartialAmount.toLocaleString()}`
                                : '—'}
                            </span>
                            <span className="text-sm text-indigo-500">your contribution</span>
                          </div>
                          <ConvertedBadge
                            amount={effectivePaymentSummary?.amount_due_now ?? effectivePartialAmount ?? undefined}
                            currency={effectiveCurrency}
                            className="text-sm"
                          />
                          {effectiveOriginalPrice != null && effectiveOriginalPrice > 0 && (
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="bg-white rounded-lg p-2 border border-indigo-100">
                                <p className="text-gray-500">Total program cost</p>
                                <p className="font-bold text-gray-800">{effectiveCurrency} {effectiveOriginalPrice.toLocaleString()}</p>
                                <ConvertedBadge amount={effectiveOriginalPrice} currency={effectiveCurrency} className="text-xs" />
                              </div>
                              <div className="bg-emerald-50 rounded-lg p-2 border border-emerald-200">
                                <p className="text-gray-500">Covered by scholarship</p>
                                <p className="font-bold text-emerald-700">{effectiveCurrency} {(() => {
                                  const amtDue = effectivePaymentSummary?.amount_due_now ?? effectivePartialAmount ?? 0;
                                  return (effectiveOriginalPrice - amtDue).toLocaleString();
                                })()}</p>
                                <ConvertedBadge amount={(() => {
                                  const amtDue = effectivePaymentSummary?.amount_due_now ?? effectivePartialAmount ?? 0;
                                  return effectiveOriginalPrice - amtDue;
                                })()} currency={effectiveCurrency} className="text-xs" />
                              </div>
                            </div>
                          )}
                          {effectiveStudentPct != null && effectiveStudentPct > 0 && (
                            <p className="text-xs text-indigo-500">
                              {isScholarshipPartial
                                ? `${effectiveStudentPct}% of total · scholarship covers the rest`
                                : `${effectiveStudentPct}% payment now`}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-1">
                          <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide">Full Tuition</p>
                          <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-indigo-700">
                              {effectivePrice
                                ? `${effectiveCurrency} ${effectivePrice.toLocaleString()}`
                                : 'Price on request'}
                            </span>
                          </div>
                          <ConvertedBadge amount={effectivePrice ?? undefined} currency={effectiveCurrency} className="text-sm" />
                          <p className="text-xs text-indigo-400">One-time payment — lifetime access</p>
                        </div>
                      )}

                      {/* Payment methods */}
                      {(effectivePaymentMethods && effectivePaymentMethods.length > 0) && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Accepted Payments</p>
                          <div className="flex flex-wrap gap-1.5">
                            {effectivePaymentMethods.includes('paypal') && (
                              <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs">PayPal</Badge>
                            )}
                            {effectivePaymentMethods.includes('stripe') && (
                              <Badge className="bg-violet-50 text-violet-700 border-violet-200 text-xs">Card (Stripe)</Badge>
                            )}
                            {effectivePaymentMethods.includes('mobile_money') && (
                              <Badge className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">Mobile Money</Badge>
                            )}
                            {effectivePaymentMethods.includes('kpay') && (
                              <Badge className="bg-violet-50 text-violet-700 border-violet-200 text-xs">K-Pay</Badge>
                            )}
                            {effectivePaymentMethods.includes('flutterwave') && (
                              <Badge className="bg-orange-50 text-orange-700 border-orange-200 text-xs">Flutterwave</Badge>
                            )}
                            {effectivePaymentMethods.includes('bank_transfer') && (
                              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">Bank Transfer</Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {!isEnrolled ? (
                        <Button
                          size="lg"
                          onClick={() => router.push(`/courses/${courseId}/apply`)}
                          className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-semibold"
                        >
                          <CreditCard className="h-5 w-5 mr-2" />
                          Apply &amp; Pay
                        </Button>
                      ) : (
                        <div className="space-y-3">
                          <Badge variant="outline" className="text-green-600 border-green-300 w-full py-2 justify-center">
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

                      <div className="flex items-center space-x-2 text-xs text-gray-400 justify-center">
                        <Shield className="h-3 w-3" />
                        <span>Secure payment · 30-day refund policy</span>
                      </div>
                    </div>
                  )}

                  {/* ── Free: direct enroll ── */}
                  {(!effectiveEnrollmentType || effectiveEnrollmentType === 'free') && (
                    <div className="space-y-4">
                      <div className="text-center">
                        <span className="text-4xl font-bold text-emerald-600">Free</span>
                        <p className="text-xs text-gray-400 mt-1">No credit card required</p>
                      </div>
                      {!isEnrolled ? (
                        <Button
                          size="lg"
                          onClick={handleEnroll}
                          disabled={enrolling}
                          className="w-full bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white font-semibold"
                        >
                          {enrolling ? (
                            <>
                              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                              Enrolling...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-5 w-5 mr-2" />
                              Enroll Now — Free
                            </>
                          )}
                        </Button>
                      ) : (
                        <div className="space-y-3">
                          <Badge variant="outline" className="text-green-600 border-green-300 w-full py-2 justify-center">
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

                      <div className="flex items-center space-x-2 text-xs text-gray-400 justify-center">
                        <Heart className="h-3 w-3" />
                        <span>30-day money-back guarantee</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Application Cycle & Cohort */}
              <Card className="border-blue-200/70 shadow-lg shadow-blue-100/60 bg-gradient-to-b from-white to-blue-50">
                <CardHeader className="space-y-3">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span className="flex items-center gap-2 text-blue-900">
                      <Calendar className="h-4 w-4" />
                      Application Cycle & Cohort
                    </span>
                    <Badge variant="outline" className={getApplicationStatusStyles(applicationWindow?.status)}>
                      {applicationWindow?.status ? applicationWindow.status : 'Not set'}
                    </Badge>
                  </CardTitle>
                  <div className="flex flex-wrap gap-2">
                    {heroCohortLabel && (
                      <Badge variant="outline" className="border-blue-200 bg-blue-100 text-blue-900">
                        <Target className="h-3 w-3 mr-1" />
                        {heroCohortLabel}
                      </Badge>
                    )}
                    {course.enrollment_type && (
                      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800 capitalize">
                        <Sparkles className="h-3 w-3 mr-1" />
                        {course.enrollment_type}
                      </Badge>
                    )}
                  </div>
                  {applicationWindow?.reason && (
                    <p className="text-xs text-amber-700 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      <span>{applicationWindow.reason}</span>
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                    <div className="rounded-md border border-blue-100 bg-blue-50/60 p-2">
                      <div className="flex items-center gap-2 font-semibold text-blue-900">
                        <Target className="h-3 w-3" />
                        Current cohort
                      </div>
                      <div className="text-slate-800 mt-1">
                        {currentCohort?.cohort_label || 'No active cohort'}
                      </div>
                      <div className="text-slate-600">
                        {formatDate(currentCohort?.cohort_start) || 'Start TBA'}
                      </div>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-white p-2">
                      <div className="flex items-center gap-2 font-semibold text-slate-900">
                        <Calendar className="h-3 w-3" />
                        Next cohort
                      </div>
                      <div className="text-slate-800 mt-1">
                        {nextCohort?.cohort_label || 'Not scheduled'}
                      </div>
                      <div className="text-slate-600">
                        {formatDateTime(nextCohort?.opens_at) || formatDate(nextCohort?.cohort_start) || 'Date TBA'}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-2 text-gray-600">
                      <Clock className="h-4 w-4" />
                      <span>Opens</span>
                    </div>
                    <span className="font-semibold text-gray-900">
                      {formatDateTime(applicationWindow?.opens_at ?? course.application_start_date) || 'Not set'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-2 text-gray-600">
                      <Clock className="h-4 w-4" />
                      <span>Closes</span>
                    </div>
                    <span className="font-semibold text-gray-900">
                      {formatDateTime(applicationWindow?.closes_at ?? course.application_end_date) || 'Not set'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-2 text-gray-600">
                      <Calendar className="h-4 w-4" />
                      <span>Cohort Start</span>
                    </div>
                    <span className="font-semibold text-gray-900">
                      {formatDate(applicationWindow?.cohort_start ?? course.cohort_start_date) || 'Not set'}
                    </span>
                  </div>

                  {(applicationWindow?.cohort_end || course.cohort_end_date) && (
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-2 text-gray-600">
                        <Calendar className="h-4 w-4" />
                        <span>Cohort End</span>
                      </div>
                      <span className="font-semibold text-gray-900">
                        {formatDate(applicationWindow?.cohort_end ?? course.cohort_end_date)}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-2 text-gray-600">
                      <Globe className="h-4 w-4" />
                      <span>Timezone</span>
                    </div>
                    <span className="font-medium text-gray-900">
                      {course.application_timezone || 'UTC'}
                    </span>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full border-blue-200 text-blue-700 hover:bg-blue-100"
                    onClick={() => router.push(`/courses/${courseId}/apply`)}
                  >
                    <ArrowRight className="h-4 w-4 mr-2" />
                    View application details
                  </Button>
                </CardContent>
              </Card>

              {applicationWindows.length > 0 && (
                <Card className="border-slate-200 shadow-sm bg-white">
                  <CardHeader className="space-y-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-600" />
                      Cohorts & Application Windows
                    </CardTitle>
                    <p className="text-sm text-slate-600">
                      {hasMultipleApplicationWindows
                        ? 'Multiple cohorts available — each may have different pricing and scholarship options.'
                        : 'Cohort timeline for this course.'}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {applicationWindows.map((window, index) => {
                      const effType = window.effective_enrollment_type ?? window.enrollment_type ?? course.enrollment_type;
                      const effPrice = window.effective_price ?? window.price ?? course.price;
                      const effCurrency = window.effective_currency ?? window.currency ?? course.currency ?? 'USD';
                      const scholarshipType = window.scholarship_type;
                      const ps = window.payment_summary;
                      const isFree = effType === 'free';
                      const isScholarship = effType === 'scholarship' && scholarshipType !== 'partial';
                      const isPartial = (effType === 'scholarship' && scholarshipType === 'partial') ||
                                        (effType === 'paid' && (window.payment_mode ?? course.payment_mode) === 'partial');
                      const isPaid = effType === 'paid' && !isPartial;

                      const tierBadge = isFree
                        ? { label: '✨ Free', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' }
                        : isScholarship
                        ? { label: '🎓 Scholarship', cls: 'bg-amber-100 text-amber-800 border-amber-200' }
                        : isPartial
                        ? { label: '🎓 Partial', cls: 'bg-indigo-100 text-indigo-800 border-indigo-200' }
                        : { label: '💳 Paid', cls: 'bg-blue-100 text-blue-800 border-blue-200' };

                      return (
                        <div
                          key={`cohort-${window.id ?? index}`}
                          className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className="bg-blue-100 text-blue-900 border-blue-200">
                                {window.cohort_label || `Cohort ${index + 1}`}
                              </Badge>
                              <Badge variant="outline" className={getApplicationStatusStyles(window.status)}>
                                {window.status || 'pending'}
                              </Badge>
                              <Badge variant="outline" className={tierBadge.cls}>
                                {tierBadge.label}
                              </Badge>
                            </div>
                          </div>

                          {/* Per-cohort payment info */}
                          <div className="flex items-center gap-3 text-xs">
                            {isFree && (
                              <span className="text-emerald-700 font-semibold">Free — No payment required</span>
                            )}
                            {isScholarship && (
                              <span className="text-amber-700 font-semibold">Full scholarship — Competitive selection</span>
                            )}
                            {isPartial && (
                              <span className="text-indigo-700 font-semibold">
                                Pay {ps?.amount_due_now != null
                                  ? `${effCurrency} ${ps.amount_due_now.toLocaleString()}`
                                  : window.partial_payment_amount != null
                                  ? `${effCurrency} ${window.partial_payment_amount.toLocaleString()}`
                                  : 'your contribution'}
                                {window.scholarship_percentage != null ? ` (${window.scholarship_percentage}% covered)` : ''}
                              </span>
                            )}
                            {isPaid && (
                              <span className="text-blue-700 font-semibold">
                                {effPrice != null ? `${effCurrency} ${effPrice.toLocaleString()}` : 'Price on request'} — Full tuition
                              </span>
                            )}
                          </div>

                          {/* Description */}
                          {window.description && (
                            <p className="text-xs text-slate-600 leading-relaxed">{window.description}</p>
                          )}

                          {/* Enrollment capacity */}
                          {window.max_students && (
                            <div className="flex items-center gap-2 text-xs text-slate-600">
                              <Users className="h-3 w-3" />
                              <span>{window.enrollment_count ?? 0} / {window.max_students} enrolled</span>
                              {(window.enrollment_count ?? 0) >= window.max_students && (
                                <Badge variant="outline" className="text-red-600 border-red-200 text-[10px] py-0">Full</Badge>
                              )}
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                            <div className="flex items-center gap-2">
                              <Clock className="h-3 w-3" />
                              <span>Opens {formatDateTime(window.opens_at) || 'TBA'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-3 w-3" />
                              <span>Closes {formatDateTime(window.closes_at) || 'TBA'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3 w-3" />
                              <span>Starts {formatDate(window.cohort_start) || 'TBA'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3 w-3" />
                              <span>Ends {formatDate(window.cohort_end) || 'TBD'}</span>
                            </div>
                          </div>

                          {/* Apply button per cohort */}
                          {window.status === 'open' && !isEnrolled && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full border-blue-200 text-blue-700 hover:bg-blue-50 mt-1"
                              onClick={() => router.push(`/courses/${courseId}/apply`)}
                            >
                              <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
                              {isFree ? 'Enroll Free' :
                               isScholarship ? 'Apply for Scholarship' :
                               isPartial ? `Apply & Pay ${ps?.amount_due_now != null ? `${effCurrency} ${ps.amount_due_now.toLocaleString()}` : ''}` :
                               `Apply & Pay ${effPrice != null ? `${effCurrency} ${effPrice.toLocaleString()}` : ''}`}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

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

