'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, 
  Clock, 
  Users, 
  Star, 
  Search,
  Filter,
  ChevronDown,
  Award,
  Play,
  CheckCircle,
  DollarSign,
  TrendingUp,
  Zap,
  Target,
  GraduationCap,
  Calendar,
  BarChart3,
  Globe,
  Heart,
  Share2,
  ExternalLink,
  Loader2,
  RefreshCw,
  FileText,
  TrendingDown,
  Activity
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CourseApiService } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Course } from '@/services/api/types';

// Enhanced Course Data with enrollment information
interface EnrolledCourseData extends Course {
  progress?: number;
  course_score?: number;
  enrollment_date?: string;
  enrollment_id?: number;
  total_modules?: number;
  completed_modules?: number;
  last_accessed?: string;
  isEnrolled: boolean;
}

const getLevelColor = (level?: string) => {
  if (!level) return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  
  switch (level.toLowerCase()) {
    case 'beginner':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    case 'intermediate':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    case 'advanced':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  }
};

const CourseCard: React.FC<{ course: EnrolledCourseData; index: number }> = ({ course, index }) => {
  const router = useRouter();
  const [isLiked, setIsLiked] = useState(false);
  const progress = course.progress || 0;
  const progressPercent = Math.round(progress * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <Card className="group hover:shadow-2xl transition-all duration-300 overflow-hidden h-full flex flex-col">
        {/* Course Thumbnail */}
        <div className="relative h-48 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 overflow-hidden">
          {course.isEnrolled && (
            <div className="absolute top-4 left-4 z-10 space-y-2">
              <Badge className="bg-green-600 text-white flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Enrolled
              </Badge>
              {progressPercent > 0 && (
                <div className="bg-white/90 dark:bg-gray-800/90 px-3 py-1 rounded-full">
                  <span className="text-xs font-semibold text-gray-900 dark:text-white">
                    {progressPercent}% Complete
                  </span>
                </div>
              )}
            </div>
          )}
          
          <div className="absolute top-4 right-4 z-10 flex space-x-2">
            <button
              onClick={() => setIsLiked(!isLiked)}
              className="p-2 bg-white/90 dark:bg-gray-800/90 rounded-full hover:scale-110 transition-transform"
            >
              <Heart className={`w-4 h-4 ${isLiked ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
            </button>
            <button className="p-2 bg-white/90 dark:bg-gray-800/90 rounded-full hover:scale-110 transition-transform">
              <Share2 className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </button>
          </div>

          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          
          {/* Course info overlay */}
          <div className="absolute bottom-4 left-4 right-4">
            {course.difficulty && (
              <Badge className={getLevelColor(course.difficulty)}>
                {course.difficulty}
              </Badge>
            )}
          </div>
        </div>

        {/* Course Content */}
        <CardContent className="p-6 flex-1 flex flex-col">
          {/* Category & Status */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">
              {course.category || 'Course'}
            </span>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              Free
            </Badge>
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {course.title}
          </h3>

          {/* Description */}
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2 flex-1">
            {course.description}
          </p>

          {/* Instructor */}
          <div className="flex items-center space-x-3 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
              {course.instructor_name ? course.instructor_name.charAt(0).toUpperCase() : 'I'}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {course.instructor_name || 'Instructor'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Course Instructor
              </p>
            </div>
          </div>

          {/* Enrollment Stats */}
          {course.isEnrolled && (
            <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Score</p>
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {course.course_score ? `${Math.round(course.course_score)}%` : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Modules</p>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">
                  {course.completed_modules || 0}/{course.total_modules || 0}
                </p>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="flex items-center space-x-1">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {course.duration || course.estimated_duration || 'Self-paced'}
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <Users className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {course.enrollment_count || 0}
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <BookOpen className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {course.total_modules || 0} modules
              </span>
            </div>
          </div>

          {/* Rating */}
          {course.rating && (
            <div className="flex items-center space-x-2 mb-4">
              <div className="flex items-center">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                <span className="text-sm font-semibold text-gray-900 dark:text-white ml-1">
                  {course.rating.toFixed(1)}
                </span>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                ({course.reviews_count || 0} reviews)
              </span>
            </div>
          )}

          {/* Progress Bar */}
          {course.isEnrolled && progressPercent > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Progress</span>
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{progressPercent}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Tags */}
          {course.tags && course.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {course.tags.slice(0, 3).map((tag, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-auto space-y-2">
            {course.isEnrolled ? (
              <>
                <Button 
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={() => router.push(`/student/learning/${course.id}`)}
                >
                  <Play className="w-4 h-4 mr-2" />
                  {progressPercent > 0 ? 'Continue Learning' : 'Start Learning'}
                </Button>
                {course.enrollment_date && (
                  <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                    Enrolled on {new Date(course.enrollment_date).toLocaleDateString()}
                  </p>
                )}
              </>
            ) : (
              <>
                <Button 
                  className="w-full" 
                  variant="default"
                  onClick={() => router.push(`/courses/${course.id}`)}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View Details
                </Button>
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={() => router.push(`/courses/${course.id}/apply`)}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Apply Now
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};


const CoursesPage: React.FC = () => {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<EnrolledCourseData[]>([]);
  const [displayCourses, setDisplayCourses] = useState<EnrolledCourseData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [enrollmentStats, setEnrollmentStats] = useState({
    total_enrollments: 0,
    completed_courses: 0,
    in_progress: 0,
    average_score: 0,
    completion_rate: 0
  });
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [activeTab, setActiveTab] = useState('all');

  // Handle client-side hydration
  useEffect(() => {
    setIsClient(true);
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch all courses (public)
      console.log('Fetching courses from:', process.env.NEXT_PUBLIC_API_URL);
      const coursesResponse = await CourseApiService.getCourses({
        page: 1,
        per_page: 100,
        sort_by: 'recent'
      });
      
      // Handle both array response and paginated response
      const courses = Array.isArray(coursesResponse) 
        ? coursesResponse 
        : (coursesResponse.items || []);
      
      console.log('Fetched courses:', courses.length, 'Response type:', Array.isArray(coursesResponse) ? 'array' : 'paginated');
      setAllCourses(courses);
      
      // Fetch enrolled courses if authenticated
      if (isAuthenticated && user) {
        try {
          // Fetch enrollment statistics first
          try {
            const token = localStorage.getItem('token');
            if (token) {
              const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/enrollments/statistics`, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              });
              
              if (response.ok) {
                const statsData = await response.json();
                console.log('Enrollment stats:', statsData);
                if (statsData.success && statsData.statistics) {
                  setEnrollmentStats(statsData.statistics);
                }
              } else {
                console.warn('Failed to fetch enrollment stats:', response.status);
              }
            }
          } catch (statsError) {
            console.error('Failed to fetch enrollment stats:', statsError);
          }
          
          // Fetch enrolled courses
          const enrolledResponse = await CourseApiService.getEnrolledCourses();
          const enrolled = enrolledResponse.courses || [];
          console.log('Fetched enrolled courses:', enrolled.length);
          
          // Merge enrolled data with all courses
          const mergedCourses: EnrolledCourseData[] = courses.map(course => {
            const enrolledData = enrolled.find(e => e.id === course.id);
            if (enrolledData) {
              return {
                ...course,
                progress: enrolledData.progress || 0,
                course_score: enrolledData.progress ? enrolledData.progress * 100 : 0,
                enrollment_date: enrolledData.enrollment_date,
                enrollment_id: enrolledData.id,
                last_accessed: enrolledData.last_accessed,
                isEnrolled: true
              };
            }
            return {
              ...course,
              isEnrolled: false,
              progress: 0
            };
          });
          
          console.log('Merged courses:', mergedCourses.length, 'enrolled:', mergedCourses.filter(c => c.isEnrolled).length);
          setEnrolledCourses(enrolled.map(e => ({ ...e, isEnrolled: true })));
          setDisplayCourses(mergedCourses);
        } catch (enrollError) {
          console.error('Failed to fetch enrolled courses:', enrollError);
          // Show all courses anyway without enrollment data
          setDisplayCourses(courses.map(c => ({ ...c, isEnrolled: false, progress: 0 })));
        }
      } else {
        // Not authenticated - show all courses
        console.log('User not authenticated, showing all courses');
        setDisplayCourses(courses.map(c => ({ ...c, isEnrolled: false, progress: 0 })));
      }
      
    } catch (err: any) {
      console.error('Error fetching courses:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to load courses. Please check your connection and try again.';
      setError(errorMessage);
      setDisplayCourses([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isClient) {
      console.log('Fetching data...', { isAuthenticated, user: !!user });
      fetchData();
    }
  }, [isClient, isAuthenticated, user]);

  // Apply search and tab filters
  const getFilteredCourses = () => {
    let filtered = [...displayCourses];
    
    // Apply category filter
    if (selectedCategory && selectedCategory !== 'all') {
      filtered = filtered.filter(course => 
        course.category?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }
    
    // Apply level filter
    if (selectedLevel && selectedLevel !== 'all') {
      filtered = filtered.filter(course => 
        course.level?.toLowerCase() === selectedLevel.toLowerCase()
      );
    }
    
    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(course =>
        course.title?.toLowerCase().includes(query) ||
        course.description?.toLowerCase().includes(query) ||
        course.instructor_name?.toLowerCase().includes(query)
      );
    }
    
    // Apply tab filter
    switch (activeTab) {
      case 'enrolled':
        filtered = filtered.filter(c => c.isEnrolled);
        break;
      case 'available':
        filtered = filtered.filter(c => !c.isEnrolled);
        break;
      case 'in-progress':
        filtered = filtered.filter(c => c.isEnrolled && c.progress > 0 && c.progress < 1.0);
        break;
      case 'completed':
        filtered = filtered.filter(c => c.isEnrolled && c.progress >= 1.0);
        break;
    }
    
    return filtered;
  };

  const filteredCourses = getFilteredCourses();

  // Get unique categories
  const categories = ['all', ...Array.from(new Set(allCourses.map(c => c.category).filter(Boolean)))];
  const levels = ['all', 'beginner', 'intermediate', 'advanced'];

  // Stats - using backend enrollment statistics
  const stats = {
    total: displayCourses.length,
    enrolled: enrollmentStats.total_enrollments || displayCourses.filter(c => c.isEnrolled).length,
    available: displayCourses.filter(c => !c.isEnrolled).length,
    inProgress: enrollmentStats.in_progress || displayCourses.filter(c => c.isEnrolled && (!c.progress || c.progress < 1.0)).length,
    completed: enrollmentStats.completed_courses || displayCourses.filter(c => c.isEnrolled && c.progress === 1.0).length,
    averageScore: enrollmentStats.average_score || 0,
    completionRate: enrollmentStats.completion_rate || 0
  };

  // Prevent hydration mismatch by showing loading state until client-side
  if (!isClient || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-8">
          {/* Header Skeleton */}
          <div className="animate-pulse mb-12">
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mx-auto mb-4"></div>
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto"></div>
          </div>

          {/* Stats Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-white dark:bg-gray-800 rounded-xl"></div>
            ))}
          </div>

          {/* Filters Skeleton */}
          <div className="animate-pulse mb-8">
            <div className="h-12 bg-white dark:bg-gray-800 rounded-lg"></div>
          </div>

          {/* Courses Grid Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-96 bg-white dark:bg-gray-800 rounded-xl animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto border-red-200 bg-red-50 dark:bg-red-950">
            <CardContent className="p-8 text-center">
              <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mb-4">
                <Target className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
                Unable to Load Courses
              </h3>
              <p className="text-red-600 dark:text-red-300 mb-4">
                {error}
              </p>
              {process.env.NODE_ENV === 'development' && (
                <p className="text-xs text-red-500 dark:text-red-400 mb-4 font-mono">
                  API: {process.env.NEXT_PUBLIC_API_URL}
                </p>
              )}
              <Button 
                onClick={() => {
                  setError(null);
                  fetchData();
                }}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Explore Our Courses
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Start learning and unlock your potential with our wide range of courses.
            {user && ` Welcome back, ${user.first_name}!`}
          </p>
        </motion.div>

        {/* Enhanced Stats Cards with Enrollment Data */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          {/* Total Courses */}
          <Card className="border-l-4 border-l-blue-500 hover:shadow-lg transition-shadow hover:scale-105 duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-300" />
                </div>
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                {stats.total}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Total Courses Available</p>
              <div className="flex items-center text-xs text-gray-500">
                <Globe className="w-3 h-3 mr-1" />
                <span>All categories</span>
              </div>
            </CardContent>
          </Card>

          {/* My Enrolled Courses */}
          <Card className="border-l-4 border-l-green-500 hover:shadow-lg transition-shadow hover:scale-105 duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-300" />
                </div>
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  {stats.enrolled}
                </Badge>
              </div>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                {stats.enrolled}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">My Enrolled Courses</p>
              <div className="flex items-center text-xs text-green-600 dark:text-green-400">
                <Activity className="w-3 h-3 mr-1" />
                <span>{stats.inProgress} active</span>
              </div>
            </CardContent>
          </Card>

          {/* Completion Rate */}
          <Card className="border-l-4 border-l-purple-500 hover:shadow-lg transition-shadow hover:scale-105 duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <Target className="w-6 h-6 text-purple-600 dark:text-purple-300" />
                </div>
                <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                  {stats.completionRate.toFixed(0)}%
                </Badge>
              </div>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                {stats.completed}/{stats.enrolled}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Courses Completed</p>
              <div className="flex items-center text-xs text-purple-600 dark:text-purple-400">
                <Award className="w-3 h-3 mr-1" />
                <span>{stats.completionRate.toFixed(1)}% completion rate</span>
              </div>
            </CardContent>
          </Card>

          {/* Average Score */}
          <Card className="border-l-4 border-l-amber-500 hover:shadow-lg transition-shadow hover:scale-105 duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="p-3 bg-amber-100 dark:bg-amber-900 rounded-lg">
                  <Star className="w-6 h-6 text-amber-600 dark:text-amber-300 fill-amber-600 dark:fill-amber-300" />
                </div>
                <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                  {stats.averageScore > 0 ? stats.averageScore.toFixed(1) : 'N/A'}
                </Badge>
              </div>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                {stats.averageScore > 0 ? `${stats.averageScore.toFixed(1)}%` : 'No Data'}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Average Course Score</p>
              <div className="flex items-center text-xs text-amber-600 dark:text-amber-400">
                <BarChart3 className="w-3 h-3 mr-1" />
                <span>
                  {stats.averageScore >= 80 ? 'Excellent!' : stats.averageScore >= 60 ? 'Good progress' : stats.averageScore > 0 ? 'Keep going!' : 'Start learning'}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Search and Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-8"
        >
          <Card className="p-6 shadow-lg">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  type="text"
                  placeholder="Search courses by name, description, or instructor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 h-12 text-base"
                />
              </div>

              {/* Category Filter */}
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full md:w-48 h-12">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat === 'all' ? 'All Categories' : cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Level Filter */}
              <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                <SelectTrigger className="w-full md:w-48 h-12">
                  <ChevronDown className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Level" />
                </SelectTrigger>
                <SelectContent>
                  {levels.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level === 'all' ? 'All Levels' : level.charAt(0).toUpperCase() + level.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Refresh Button */}
              <Button
                onClick={fetchData}
                variant="outline"
                className="h-12 px-6"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </Card>
        </motion.div>

        {/* Enhanced Tabs with Counts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mb-8"
        >
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 h-auto p-1 bg-white dark:bg-gray-800 shadow-md">
              <TabsTrigger value="all" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white py-3">
                <div className="flex flex-col items-center">
                  <Globe className="w-5 h-5 mb-1" />
                  <span className="text-sm font-medium">All Courses</span>
                  <Badge variant="secondary" className="mt-1 text-xs">{stats.total}</Badge>
                </div>
              </TabsTrigger>
              
              <TabsTrigger value="enrolled" className="data-[state=active]:bg-green-600 data-[state=active]:text-white py-3">
                <div className="flex flex-col items-center">
                  <CheckCircle className="w-5 h-5 mb-1" />
                  <span className="text-sm font-medium">Enrolled</span>
                  <Badge variant="secondary" className="mt-1 text-xs">{stats.enrolled}</Badge>
                </div>
              </TabsTrigger>
              
              <TabsTrigger value="available" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white py-3">
                <div className="flex flex-col items-center">
                  <BookOpen className="w-5 h-5 mb-1" />
                  <span className="text-sm font-medium">Available</span>
                  <Badge variant="secondary" className="mt-1 text-xs">{stats.available}</Badge>
                </div>
              </TabsTrigger>
              
              <TabsTrigger value="in-progress" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white py-3">
                <div className="flex flex-col items-center">
                  <Activity className="w-5 h-5 mb-1" />
                  <span className="text-sm font-medium">In Progress</span>
                  <Badge variant="secondary" className="mt-1 text-xs">{stats.inProgress}</Badge>
                </div>
              </TabsTrigger>
              
              <TabsTrigger value="completed" className="data-[state=active]:bg-teal-600 data-[state=active]:text-white py-3">
                <div className="flex flex-col items-center">
                  <Award className="w-5 h-5 mb-1" />
                  <span className="text-sm font-medium">Completed</span>
                  <Badge variant="secondary" className="mt-1 text-xs">{stats.completed}</Badge>
                </div>
              </TabsTrigger>
            </TabsList>

            {/* Tab Content - Courses Grid */}
            <TabsContent value={activeTab} className="mt-8">
              {filteredCourses.length === 0 ? (
                <Card className="p-12 text-center">
                  <div className="mx-auto w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                    <BookOpen className="w-12 h-12 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    No courses found
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    {searchQuery
                      ? `No courses match "${searchQuery}"`
                      : activeTab === 'enrolled'
                      ? "You haven't enrolled in any courses yet"
                      : activeTab === 'completed'
                      ? "You haven't completed any courses yet"
                      : 'No courses available in this category'}
                  </p>
                  {(activeTab === 'enrolled' || activeTab === 'completed') && (
                    <Button onClick={() => setActiveTab('available')} className="mx-auto">
                      Browse Available Courses
                    </Button>
                  )}
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredCourses.map((course, index) => (
                    <CourseCard key={course.id} course={course} index={index} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
};

export default CoursesPage;
