'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
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
  ExternalLink
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
import { StudentService, BrowseCourse } from '@/services/student.service';
import { useAuth } from '@/contexts/AuthContext';

// Use BrowseCourse from StudentService
type CourseData = BrowseCourse;

const getLevelColor = (level: string) => {
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

const CourseCard: React.FC<{ course: CourseData; index: number }> = ({ course, index }) => {
  const [isLiked, setIsLiked] = useState(false);

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
            <div className="absolute top-4 left-4 z-10">
              <Badge className="bg-green-600 text-white">
                <CheckCircle className="w-3 h-3 mr-1" />
                Enrolled
              </Badge>
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
            <Badge className={getLevelColor(course.level)}>
              {course.level}
            </Badge>
          </div>
        </div>

        {/* Course Content */}
        <CardContent className="p-6 flex-1 flex flex-col">
          {/* Category & Price */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">
              {course.category}
            </span>
            {course.isFree ? (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                Free
              </Badge>
            ) : course.isScholarshipRequired ? (
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                <Award className="w-3 h-3 mr-1" />
                Scholarship
              </Badge>
            ) : (
              <div className="flex items-center space-x-2">
                {course.originalPrice && (
                  <span className="text-sm text-gray-400 line-through">
                    ${course.originalPrice}
                  </span>
                )}
                <span className="text-lg font-bold text-gray-900 dark:text-white">
                  ${course.price}
                </span>
              </div>
            )}
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
              {course.instructor.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {course.instructor}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Instructor
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="flex items-center space-x-1">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {course.duration}
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <Users className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {course.studentsCount.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <BookOpen className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {course.modules} modules
              </span>
            </div>
          </div>

          {/* Rating */}
          <div className="flex items-center space-x-2 mb-4">
            <div className="flex items-center">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <span className="text-sm font-semibold text-gray-900 dark:text-white ml-1">
                {course.rating.toFixed(1)}
              </span>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ({course.reviewsCount} reviews)
            </span>
          </div>

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
              <Link href={`/learn/${course.id}`} className="block">
                <Button className="w-full bg-green-600 hover:bg-green-700">
                  <Play className="w-4 h-4 mr-2" />
                  Continue Learning
                </Button>
              </Link>
            ) : (
              <>
                <Link href={`/student/courses/${course.id}`} className="block">
                  <Button className="w-full" variant="default">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View Details
                  </Button>
                </Link>
                {course.certificateAvailable && (
                  <div className="flex items-center justify-center text-xs text-gray-500 dark:text-gray-400">
                    <GraduationCap className="w-3 h-3 mr-1" />
                    Certificate upon completion
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};


const CoursesPage: React.FC = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<CourseData[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<CourseData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [selectedPrice, setSelectedPrice] = useState('all');
  const [activeTab, setActiveTab] = useState('all');

  // Handle client-side hydration
  useEffect(() => {
    setIsClient(true);
  }, []);

  const fetchCourses = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const coursesData = await StudentService.browseCourses({
        category: selectedCategory,
        level: selectedLevel,
        price: selectedPrice,
        search: searchQuery
      });
      // Ensure data is always an array
      const safeCoursesData = Array.isArray(coursesData) ? coursesData : [];
      setCourses(safeCoursesData);
      setFilteredCourses(safeCoursesData);
    } catch (err: any) {
      console.error('Error fetching courses:', err);
      setError(err.message || 'Failed to load courses. Please try again.');
      setCourses([]); // Set empty array on error
      setFilteredCourses([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, [selectedCategory, selectedLevel, selectedPrice]);

  // Apply search filter
  useEffect(() => {
    if (!Array.isArray(courses)) {
      setFilteredCourses([]);
      return;
    }
    
    if (searchQuery.trim() === '') {
      setFilteredCourses(courses);
    } else {
      const filtered = courses.filter(course =>
        course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.instructor.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredCourses(filtered);
    }
  }, [searchQuery, courses]);

  // Apply tab filter
  const getTabFilteredCourses = () => {
    if (!Array.isArray(filteredCourses)) return [];
    
    switch (activeTab) {
      case 'enrolled':
        return filteredCourses.filter(c => c.isEnrolled);
      case 'free':
        return filteredCourses.filter(c => c.isFree);
      case 'scholarship':
        return filteredCourses.filter(c => c.isScholarshipRequired);
      default:
        return filteredCourses;
    }
  };

  const displayedCourses = getTabFilteredCourses();

  // Get unique categories with safety checks
  const categories = ['all', ...(Array.isArray(courses) ? Array.from(new Set(courses.map(c => c.category))) : [])];
  const levels = ['all', 'Beginner', 'Intermediate', 'Advanced'];

  // Stats with safety checks
  const stats = {
    total: Array.isArray(courses) ? courses.length : 0,
    enrolled: Array.isArray(courses) ? courses.filter(c => c.isEnrolled).length : 0,
    free: Array.isArray(courses) ? courses.filter(c => c.isFree).length : 0,
    scholarship: Array.isArray(courses) ? courses.filter(c => c.isScholarshipRequired).length : 0
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
              <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
              <Button onClick={fetchCourses} variant="outline">
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

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          <Card className="border-l-4 border-l-blue-500 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <BookOpen className="w-8 h-8 text-blue-600" />
                <Badge variant="secondary">{stats.total}</Badge>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.total}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Courses</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <CheckCircle className="w-8 h-8 text-green-600" />
                <Badge variant="secondary">{stats.enrolled}</Badge>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.enrolled}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">My Courses</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Zap className="w-8 h-8 text-amber-600" />
                <Badge variant="secondary">{stats.free}</Badge>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.free}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Free Courses</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Award className="w-8 h-8 text-purple-600" />
                <Badge variant="secondary">{stats.scholarship}</Badge>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.scholarship}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Scholarships</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Filters and Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-8"
        >
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Search */}
                <div className="relative md:col-span-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    type="text"
                    placeholder="Search courses, instructors..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Category Filter */}
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <Globe className="w-4 h-4 mr-2" />
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
                  <SelectTrigger>
                    <BarChart3 className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Level" />
                  </SelectTrigger>
                  <SelectContent>
                    {levels.map((level) => (
                      <SelectItem key={level} value={level}>
                        {level === 'all' ? 'All Levels' : level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mb-8"
        >
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
              <TabsTrigger value="all">
                All Courses ({Array.isArray(filteredCourses) ? filteredCourses.length : 0})
              </TabsTrigger>
              <TabsTrigger value="enrolled">
                My Courses ({stats.enrolled})
              </TabsTrigger>
              <TabsTrigger value="free">
                Free ({stats.free})
              </TabsTrigger>
              <TabsTrigger value="scholarship">
                Scholarships ({stats.scholarship})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </motion.div>

        {/* Courses Grid */}
        <AnimatePresence mode="wait">
          {(!Array.isArray(displayedCourses) || displayedCourses.length === 0) ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-16"
            >
              <Card className="max-w-md mx-auto">
                <CardContent className="p-12">
                  <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                    <BookOpen className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    No Courses Found
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Try adjusting your filters or search query.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('all');
                      setSelectedLevel('all');
                      setActiveTab('all');
                    }}
                  >
                    Clear Filters
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {Array.isArray(displayedCourses) && displayedCourses.map((course, index) => (
                <CourseCard key={course.id} course={course} index={index} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Load More Button (if needed) */}
        {Array.isArray(displayedCourses) && Array.isArray(filteredCourses) && 
         displayedCourses.length > 0 && displayedCourses.length < filteredCourses.length && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center mt-12"
          >
            <Button variant="outline" size="lg">
              <TrendingUp className="w-4 h-4 mr-2" />
              Load More Courses
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default CoursesPage;