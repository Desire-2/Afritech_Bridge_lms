"use client";
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ClientOnly, useIsClient } from '@/lib/hydration-helper';
import { 
  BookOpen, 
  Clock, 
  Trophy, 
  ChevronRight, 
  TrendingUp,
  Award,
  Target,
  Calendar,
  Play,
  CheckCircle,
  Star,
  Zap,
  BarChart3,
  ArrowRight,
  BookMarked,
  Brain,
  Lightbulb,
  Timer,
  Activity,
  Bell,
  Users,
  GraduationCap,
  CreditCard,
  Sparkles
} from 'lucide-react';
import { StudentService, StudentDashboard } from '@/services/student.service';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookingCard } from '@/components/booking/BookingCard';
import StudentAnnouncements from '@/components/student/StudentAnnouncements';

const StudentDashboardOverviewPage = () => {
  const { user, isAuthenticated } = useAuth();
  const isClient = useIsClient();
  const [dashboardData, setDashboardData] = useState<StudentDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setRefreshing(true);
      const data = await StudentService.getDashboard();
      setDashboardData(data);
      setError(null);
    } catch (err: any) {
      console.error('Dashboard error:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchDashboardData();
  }, [isAuthenticated]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getMotivationalMessage = () => {
    const progress = dashboardData?.stats?.completed_courses || 0;
    if (progress === 0) return "Let's start your learning journey! 🚀";
    if (progress < 3) return "You're building momentum! Keep it up! 💪";
    if (progress < 5) return "Excellent progress! You're on fire! 🔥";
    return "Outstanding dedication! You're a learning champion! 🏆";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-8 animate-pulse">
          <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg w-1/2 mb-8"></div>
          
          {/* Stats skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-white dark:bg-gray-800 rounded-xl shadow-sm"></div>
            ))}
          </div>
          
          {/* Content skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-96 bg-white dark:bg-gray-800 rounded-xl shadow-sm"></div>
            <div className="h-96 bg-white dark:bg-gray-800 rounded-xl shadow-sm"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !dashboardData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-8">
          <Card className="border-red-200 bg-red-50 dark:bg-red-950">
            <CardContent className="p-8 text-center">
              <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mb-4">
                <Activity className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
                Unable to Load Dashboard
              </h3>
              <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
              <Button onClick={fetchDashboardData} variant="outline">
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const stats = dashboardData?.stats || {
    total_courses: 0,
    completed_courses: 0,
    hours_spent: 0,
    achievements: 0
  };

  const enrolledCourses = dashboardData?.enrolled_courses || [];
  const inProgressCourses = enrolledCourses.filter(c => c.progress > 0 && c.progress < 100);
  const completedCourses = enrolledCourses.filter(c => c.progress >= 100);
  const recentActivity = dashboardData?.recent_activity || [];
  const achievements = dashboardData?.achievements || [];

  // Extract unique cohort info from enrolled courses
  const cohortCourses = enrolledCourses.filter(c => c.cohort_label);
  const uniqueCohorts = Array.from(
    new Map(cohortCourses.map(c => [
      `${c.id}-${c.cohort_label}`,
      {
        courseId: c.id,
        courseTitle: c.title,
        cohortLabel: c.cohort_label!,
        startDate: c.cohort_start_date,
        endDate: c.cohort_end_date,
        enrollmentType: c.cohort_enrollment_type,
        scholarshipType: c.cohort_scholarship_type,
        scholarshipPercentage: c.cohort_scholarship_percentage,
        effectivePrice: c.cohort_effective_price,
        currency: c.cohort_currency,
        paymentStatus: c.payment_status,
        paymentVerified: c.payment_verified,
        progress: c.progress,
        enrollmentStatus: c.enrollment_status,
      }
    ])).values()
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Welcome Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                {getGreeting()}, {user?.first_name || 'Learner'}! 👋
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                {getMotivationalMessage()}
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={fetchDashboardData}
              disabled={refreshing}
              className="hidden md:flex"
            >
              {refreshing ? (
                <>
                  <Timer className="w-4 h-4 mr-2 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <Activity className="w-4 h-4 mr-2" />
                  Refresh
                </>
              )}
            </Button>
          </div>
        </motion.div>

        {/* Quick Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          {/* Total Courses */}
          <Card className="hover:shadow-lg transition-shadow duration-300 border-l-4 border-l-blue-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  Active
                </Badge>
              </div>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                {stats.total_courses}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Enrolled Courses</p>
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <Link 
                  href="/student/mylearning"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center"
                >
                  View all courses
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Hours Spent */}
          <Card className="hover:shadow-lg transition-shadow duration-300 border-l-4 border-l-amber-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-amber-100 dark:bg-amber-900 rounded-lg">
                  <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
                <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                  Time
                </Badge>
              </div>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                {stats.hours_spent}h
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Learning Time</p>
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <TrendingUp className="w-3 h-3 mr-1 text-green-500" />
                  Keep up the pace!
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Completed Courses */}
          <Card className="hover:shadow-lg transition-shadow duration-300 border-l-4 border-l-green-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  Done
                </Badge>
              </div>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                {stats.completed_courses}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Completed</p>
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {stats.total_courses > 0 
                    ? `${Math.round((stats.completed_courses / stats.total_courses) * 100)}% completion rate`
                    : 'Start your first course'}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Achievements */}
          <Card className="hover:shadow-lg transition-shadow duration-300 border-l-4 border-l-purple-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <Trophy className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                  Earned
                </Badge>
              </div>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                {stats.achievements}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Achievements</p>
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <Link 
                  href="/student/achievements"
                  className="text-sm text-purple-600 dark:text-purple-400 hover:underline flex items-center"
                >
                  View badges
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Courses and Activity */}
          <div className="lg:col-span-2 space-y-6">
            {/* Continue Learning Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center space-x-2">
                      <Play className="w-5 h-5 text-blue-600" />
                      <span>Continue Learning</span>
                    </CardTitle>
                    <Link href="/student/mylearning">
                      <Button variant="ghost" size="sm">
                        View All
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  {inProgressCourses.length > 0 ? (
                    <div className="space-y-4">
                      {inProgressCourses.slice(0, 3).map((course, index) => (
                        <motion.div
                          key={course.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.1 }}
                          className="group"
                        >
                          <Link href={`/learn/${course.id}`}>
                            <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all duration-200">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <h4 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    {course.title}
                                  </h4>
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    {course.instructor_name}
                                  </p>
                                  {course.cohort_label && (
                                    <span className="inline-flex items-center px-2 py-0.5 mt-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                                      {course.cohort_label}
                                    </span>
                                  )}
                                </div>
                                <Badge variant="outline" className="ml-2">
                                  {Math.round(course.progress)}%
                                </Badge>
                              </div>
                              
                              <Progress value={course.progress} className="h-2 mb-2" />
                              
                              {course.current_lesson && (
                                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                                  <BookMarked className="w-4 h-4 mr-2" />
                                  <span className="truncate">Next: {course.current_lesson}</span>
                                </div>
                              )}
                            </div>
                          </Link>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
                        <BookOpen className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 mb-4">
                        No courses in progress yet. Contact your instructor for course access.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* My Cohorts Section */}
            {uniqueCohorts.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.25 }}
              >
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center space-x-2">
                        <Users className="w-5 h-5 text-indigo-600" />
                        <span>My Cohorts</span>
                      </CardTitle>
                      <Badge variant="secondary" className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                        {uniqueCohorts.length} {uniqueCohorts.length === 1 ? 'Cohort' : 'Cohorts'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {uniqueCohorts.map((cohort, index) => {
                        const isActive = cohort.startDate && cohort.endDate
                          ? new Date() >= new Date(cohort.startDate) && new Date() <= new Date(cohort.endDate)
                          : false;
                        const hasEnded = cohort.endDate ? new Date() > new Date(cohort.endDate) : false;
                        const statusLabel = hasEnded ? 'Completed' : isActive ? 'Active' : 'Upcoming';
                        const statusColor = hasEnded
                          ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                          : isActive
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';

                        return (
                          <motion.div
                            key={`${cohort.courseId}-${cohort.cohortLabel}`}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.1 }}
                          >
                            <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 transition-all duration-200">
                              {/* Cohort Header */}
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="font-semibold text-gray-900 dark:text-white">
                                      {cohort.cohortLabel}
                                    </h4>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                                      {statusLabel}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    {cohort.courseTitle}
                                  </p>
                                </div>
                                <div className="ml-2">
                                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                                    <GraduationCap className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                  </div>
                                </div>
                              </div>

                              {/* Cohort Details Grid */}
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                {/* Dates */}
                                {cohort.startDate && (
                                  <div className="flex items-center text-gray-600 dark:text-gray-400">
                                    <Calendar className="w-4 h-4 mr-2 text-indigo-500 flex-shrink-0" />
                                    <span>
                                      {new Date(cohort.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                      {cohort.endDate && (
                                        <> - {new Date(cohort.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>
                                      )}
                                    </span>
                                  </div>
                                )}

                                {/* Enrollment Type */}
                                {cohort.enrollmentType && (
                                  <div className="flex items-center text-gray-600 dark:text-gray-400">
                                    {cohort.enrollmentType === 'scholarship' ? (
                                      <Sparkles className="w-4 h-4 mr-2 text-amber-500 flex-shrink-0" />
                                    ) : cohort.enrollmentType === 'paid' ? (
                                      <CreditCard className="w-4 h-4 mr-2 text-green-500 flex-shrink-0" />
                                    ) : (
                                      <Award className="w-4 h-4 mr-2 text-indigo-500 flex-shrink-0" />
                                    )}
                                    <span className="capitalize">
                                      {cohort.enrollmentType === 'scholarship' && cohort.scholarshipType
                                        ? `${cohort.scholarshipType} Scholarship`
                                        : cohort.enrollmentType}
                                      {cohort.enrollmentType === 'scholarship' && cohort.scholarshipPercentage
                                        ? ` (${cohort.scholarshipPercentage}%)`
                                        : ''}
                                    </span>
                                  </div>
                                )}

                                {/* Progress */}
                                <div className="flex items-center text-gray-600 dark:text-gray-400">
                                  <TrendingUp className="w-4 h-4 mr-2 text-blue-500 flex-shrink-0" />
                                  <span>{Math.round(cohort.progress)}% Complete</span>
                                </div>

                                {/* Payment Info (if paid) */}
                                {cohort.enrollmentType === 'paid' && cohort.effectivePrice != null && (
                                  <div className="flex items-center text-gray-600 dark:text-gray-400">
                                    <CreditCard className="w-4 h-4 mr-2 text-green-500 flex-shrink-0" />
                                    <span>
                                      {cohort.currency || 'USD'} {Number(cohort.effectivePrice).toLocaleString()}
                                      {cohort.paymentVerified ? (
                                        <CheckCircle className="w-3 h-3 ml-1 inline text-green-500" />
                                      ) : null}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Progress Bar */}
                              <div className="mt-3">
                                <Progress value={cohort.progress} className="h-1.5" />
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Recent Activity */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Activity className="w-5 h-5 text-purple-600" />
                    <span>Recent Activity</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {recentActivity.length > 0 ? (
                    <div className="space-y-4">
                      {recentActivity.map((activity, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                          className="flex items-start space-x-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
                        >
                          <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                            <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {activity.lesson_title}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {activity.course_title}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                              {new Date(activity.completed_at).toLocaleDateString()}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="mx-auto w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3">
                        <Activity className="w-6 h-6 text-gray-400" />
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        No recent activity yet. Start learning to see your progress!
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Right Column - Quick Actions and Achievements */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Zap className="w-5 h-5 text-yellow-600" />
                    <span>Quick Actions</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">

                  <Link href="/student/mylearning">
                    <Button variant="outline" className="w-full justify-start">
                      <BookOpen className="w-4 h-4 mr-2" />
                      My Learning
                    </Button>
                  </Link>
                  <Link href="/student/progress">
                    <Button variant="outline" className="w-full justify-start">
                      <BarChart3 className="w-4 h-4 mr-2" />
                      Progress Analytics
                    </Button>
                  </Link>
                  <Link href="/student/announcements">
                    <Button variant="outline" className="w-full justify-start">
                      <Bell className="w-4 h-4 mr-2" />
                      Announcements
                    </Button>
                  </Link>
                  <Link href="/student/opportunities">
                    <Button variant="outline" className="w-full justify-start">
                      <Award className="w-4 h-4 mr-2" />
                      Scholarships
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>

            {/* Expert Mentorship Booking */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.45 }}
            >
              <BookingCard variant="compact" />
            </motion.div>

            {/* Announcements */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <StudentAnnouncements maxItems={3} />
            </motion.div>

            {/* Recent Achievements */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.55 }}
            >
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center space-x-2">
                      <Trophy className="w-5 h-5 text-yellow-600" />
                      <span>Achievements</span>
                    </CardTitle>
                    {achievements.length > 0 && (
                      <Link href="/student/achievements">
                        <Button variant="ghost" size="sm">
                          View All
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {achievements.length > 0 ? (
                    <div className="space-y-3">
                      {achievements.slice(0, 5).map((achievement, index) => (
                        <motion.div
                          key={achievement.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                          className="flex items-center space-x-3 p-3 rounded-lg bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20"
                        >
                          <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                            <Trophy className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {achievement.badge?.name || 'Achievement'}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                              {achievement.badge?.description || 'Well done!'}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="mx-auto w-12 h-12 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center mb-3">
                        <Star className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        Start earning achievements!
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        Complete courses to unlock badges
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Learning Tip */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.65 }}
            >
              <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                      <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                        Daily Learning Tip
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Study in 25-minute focused sessions with 5-minute breaks. This technique, 
                        known as the Pomodoro method, helps improve concentration and retention!
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Wrap the component with ClientOnly to prevent hydration issues
export default function DashboardPage() {
  const isClient = useIsClient();
  
  if (!isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-lg text-gray-600">Loading dashboard content...</p>
      </div>
    );
  }
  
  return (
    <ClientOnly>
      <StudentDashboardOverviewPage />
    </ClientOnly>
  );
}