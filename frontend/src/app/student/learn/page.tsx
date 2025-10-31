"use client";"use client";"use client";"use client";"use client";



import React, { useEffect } from 'react';

import { useRouter } from 'next/navigation';

import { useAuth } from '@/contexts/AuthContext';import React, { useEffect } from 'react';

import { Loader2 } from 'lucide-react';

import { useRouter } from 'next/navigation';

/**

 * Redirect page for /student/learnimport { useAuth } from '@/contexts/AuthContext';import React, { useState, useEffect } from 'react';

 * 

 * This page redirects users to the appropriate location:import { Loader2 } from 'lucide-react';

 * - Unauthenticated users → Sign in page

 * - Authenticated users → Student dashboard (to see enrolled courses)import { motion } from 'framer-motion';

 * 

 * Individual course learning should use /student/learn/[id] directlyconst LearnRedirectPage = () => {

 */

const LearnRedirectPage = () => {  const router = useRouter();import { import React, { useState, useEffect } from 'react';import React, { useState, useEffect } from 'react';

  const router = useRouter();

  const { isAuthenticated, isLoading } = useAuth();  const { isAuthenticated, isLoading } = useAuth();



  useEffect(() => {  BookOpen, 

    if (!isLoading) {

      if (!isAuthenticated) {  useEffect(() => {

        // Redirect to sign in if not authenticated

        router.push('/auth/signin');    if (!isLoading) {  Clock, import { motion } from 'framer-motion';import { motion } from 'framer-motion';

      } else {

        // Redirect to the student dashboard which shows enrolled courses      if (!isAuthenticated) {

        router.push('/student/dashboard');

      }        // Redirect to sign in if not authenticated  TrendingUp, 

    }

  }, [isAuthenticated, isLoading, router]);        router.push('/auth/signin');



  return (      } else {  Award, import { import { 

    <div className="min-h-screen flex items-center justify-center">

      <div className="text-center">        // Redirect to the student dashboard which shows enrolled courses

        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />

        <p className="text-gray-600">Redirecting to your learning dashboard...</p>        router.push('/student/dashboard');  Play, 

      </div>

    </div>      }

  );

};    }  Star,  BookOpen,   BookOpen, 



export default LearnRedirectPage;  }, [isAuthenticated, isLoading, router]);

  Target,

  return (

    <div className="min-h-screen flex items-center justify-center">  BarChart3,  Clock,   Clock, 

      <div className="text-center">

        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />  Loader2,

        <p className="text-gray-600">Redirecting to your learning dashboard...</p>

      </div>  AlertCircle,  TrendingUp,   TrendingUp, 

    </div>

  );  Search,

};

  Grid3X3,  Award,   Award, 

export default LearnRedirectPage;
  List,

  ChevronRight  Play,   Play, 

} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';  Star,  Star,

import { Button } from '@/components/ui/button';

import { Progress } from '@/components/ui/progress';  Target,  Target,

import { Badge } from '@/components/ui/badge';

import { Input } from '@/components/ui/input';  BarChart3,  BarChart3,

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { useAuth } from '@/contexts/AuthContext';  Loader2,  Loader2,

import Link from 'next/link';

import { StudentService } from '@/services/student.service';  AlertCircle,  AlertCircle,



interface Course {  Search,  Search,

  id: number;

  title: string;  Filter,  Filter,

  description: string;

  instructor_name: string;  Grid3X3,  Grid3X3,

  progress: number;

  total_lessons: number;  List  List

  completed_lessons: number;

  estimated_duration: string;} from 'lucide-react';} from 'lucide-react';

  last_accessed: string;

  thumbnail_url?: string;import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

  difficulty: 'beginner' | 'intermediate' | 'advanced';

  rating: number;import { Button } from '@/components/ui/button';import { Button } from '@/components/ui/button';

  enrollment_count: number;

  current_lesson?: {import { Progress } from '@/components/ui/progress';import { Progress } from '@/components/ui/progress';

    id: number;

    title: string;import { Badge } from '@/components/ui/badge';import { Badge } from '@/components/ui/badge';

    type: string;

  };import { Input } from '@/components/ui/input';import { Input } from '@/components/ui/input';

  enrollment_date: string;

}import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';



const LearningDashboard = () => {import { useAuth } from '@/contexts/AuthContext';import { useAuth } from '@/contexts/AuthContext';

  const { user, isAuthenticated } = useAuth();

  const [courses, setCourses] = useState<Course[]>([]);import Link from 'next/link';import Link from 'next/link';

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');

  const [sortBy, setSortBy] = useState('recent');interface Course {interface Course {

  const [filterStatus, setFilterStatus] = useState('all');

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');  id: number;  id: number;



  useEffect(() => {  title: string;  title: string;

    const fetchEnrolledCourses = async () => {

      if (!isAuthenticated) return;  description: string;  description: string;



      try {  instructor_name: string;  instructor_name: string;

        setLoading(true);

        setError(null);  progress: number;  progress: number;

        

        // Get enrolled courses from the student service  total_lessons: number;  total_lessons: number;

        const enrolledCourses = await StudentService.getMyLearning();

        setCourses(enrolledCourses);  completed_lessons: number;  completed_lessons: number;

      } catch (err: any) {

        console.error('Error fetching enrolled courses:', err);  estimated_duration: string;  estimated_duration: string;

        setError('Failed to load your courses');

      } finally {  last_accessed: string;  last_accessed: string;

        setLoading(false);

      }  thumbnail_url?: string;  thumbnail_url?: string;

    };

  difficulty: 'beginner' | 'intermediate' | 'advanced';  difficulty: 'beginner' | 'intermediate' | 'advanced';

    fetchEnrolledCourses();

  }, [isAuthenticated]);  rating: number;  rating: number;



  const totalProgress = courses.length > 0  enrollment_count: number;  enrollment_count: number;

    ? courses.reduce((sum: number, course: Course) => sum + course.progress, 0) / courses.length

    : 0;  current_lesson?: {  current_lesson?: {



  const completedCourses = courses.filter((course: Course) => course.progress === 100).length;    id: number;    id: number;

  const inProgressCourses = courses.filter((course: Course) => course.progress > 0 && course.progress < 100).length;

  const notStartedCourses = courses.filter((course: Course) => course.progress === 0).length;    title: string;    title: string;



  const filteredCourses = courses.filter((course: Course) => {    type: string;    type: string;

    const matchesSearch = course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||

                         course.instructor_name.toLowerCase().includes(searchTerm.toLowerCase());  };  };

    

    let matchesStatus = true;}}

    if (filterStatus === 'completed') {

      matchesStatus = course.progress === 100;

    } else if (filterStatus === 'in-progress') {

      matchesStatus = course.progress > 0 && course.progress < 100;const LearningDashboard = () => {const LearningDashboard = () => {

    } else if (filterStatus === 'not-started') {

      matchesStatus = course.progress === 0;  const { user, isAuthenticated } = useAuth();  const [courses, setCourses] = useState<Course[]>([]);

    }

      const [courses, setCourses] = useState<Course[]>([]);  const [loading, setLoading] = useState(true);

    return matchesSearch && matchesStatus;

  });  const [loading, setLoading] = useState(true);  const [error, setError] = useState<string | null>(null);



  const sortedCourses = [...filteredCourses].sort((a: Course, b: Course) => {  const [error, setError] = useState<string | null>(null);  const [searchQuery, setSearchQuery] = useState('');

    switch (sortBy) {

      case 'recent':  const [searchTerm, setSearchTerm] = useState('');  const [filterStatus, setFilterStatus] = useState<'all' | 'in-progress' | 'completed'>('all');

        return new Date(b.last_accessed).getTime() - new Date(a.last_accessed).getTime();

      case 'progress':  const [sortBy, setSortBy] = useState('recent');  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

        return b.progress - a.progress;

      case 'alphabetical':  const [filterDifficulty, setFilterDifficulty] = useState('all');  const [sortBy, setSortBy] = useState<'recent' | 'progress' | 'title'>('recent');

        return a.title.localeCompare(b.title);

      case 'enrollment':  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');  const { user, isAuthenticated } = useAuth();

        return new Date(b.enrollment_date).getTime() - new Date(a.enrollment_date).getTime();

      default:

        return 0;

    }  // Mock data for development  useEffect(() => {

  });

  const mockCourses: Course[] = [    const fetchEnrolledCourses = async () => {

  if (!isAuthenticated) {

    return (    {      if (!isAuthenticated) return;

      <div className="min-h-screen flex items-center justify-center">

        <Card className="w-full max-w-md">      id: 1,      

          <CardContent className="pt-6">

            <div className="text-center">      title: "Introduction to Web Development",      try {

              <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />

              <h3 className="mt-2 text-sm font-semibold">Authentication Required</h3>      description: "Learn the fundamentals of HTML, CSS, and JavaScript to build modern web applications.",        setLoading(true);

              <p className="mt-1 text-sm text-muted-foreground">

                Please log in to access your learning dashboard.      instructor_name: "John Doe",        setError(null);

              </p>

              <Button asChild className="mt-4">      progress: 75,        

                <Link href="/auth/signin">Sign In</Link>

              </Button>      total_lessons: 20,        // Mock data for now until we fix the API connection

            </div>

          </CardContent>      completed_lessons: 15,        const mockCourses: Course[] = [

        </Card>

      </div>      estimated_duration: "8 weeks",          {

    );

  }      last_accessed: "2024-01-15",            id: 1,



  if (loading) {      difficulty: 'beginner',            title: "Introduction to Web Development",

    return (

      <div className="min-h-screen flex items-center justify-center">      rating: 4.8,            description: "Learn the basics of HTML, CSS, and JavaScript",

        <div className="text-center">

          <Loader2 className="h-8 w-8 animate-spin mx-auto" />      enrollment_count: 1250,            instructor_name: "John Doe",

          <p className="mt-2 text-sm text-muted-foreground">Loading your courses...</p>

        </div>      current_lesson: {            progress: 45,

      </div>

    );        id: 16,            total_lessons: 20,

  }

        title: "JavaScript DOM Manipulation",            completed_lessons: 9,

  if (error) {

    return (        type: "video"            estimated_duration: "8 weeks",

      <div className="min-h-screen flex items-center justify-center">

        <Card className="w-full max-w-md">      }            last_accessed: "2024-10-07T10:00:00Z",

          <CardContent className="pt-6">

            <div className="text-center">    },            difficulty: "beginner",

              <AlertCircle className="mx-auto h-12 w-12 text-red-500" />

              <h3 className="mt-2 text-sm font-semibold">Error Loading Courses</h3>    {            rating: 4.5,

              <p className="mt-1 text-sm text-muted-foreground">{error}</p>

              <Button       id: 2,            enrollment_count: 1250,

                className="mt-4" 

                onClick={() => window.location.reload()}      title: "Python for Data Science",            current_lesson: {

              >

                Try Again      description: "Master Python programming for data analysis, visualization, and machine learning.",              id: 10,

              </Button>

            </div>      instructor_name: "Jane Smith",              title: "JavaScript Fundamentals",

          </CardContent>

        </Card>      progress: 45,              type: "video"

      </div>

    );      total_lessons: 25,            }

  }

      completed_lessons: 11,          },

  const getDifficultyColor = (difficulty: string) => {

    switch (difficulty) {      estimated_duration: "10 weeks",          {

      case 'beginner':

        return 'bg-green-100 text-green-800';      last_accessed: "2024-01-14",            id: 2,

      case 'intermediate':

        return 'bg-yellow-100 text-yellow-800';      difficulty: 'intermediate',            title: "Advanced React Development",

      case 'advanced':

        return 'bg-red-100 text-red-800';      rating: 4.9,            description: "Master React hooks, context, and state management",

      default:

        return 'bg-gray-100 text-gray-800';      enrollment_count: 980,            instructor_name: "Jane Smith",

    }

  };      current_lesson: {            progress: 20,



  return (        id: 12,            total_lessons: 15,

    <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8">

      <div className="max-w-7xl mx-auto space-y-6">        title: "Data Visualization with Matplotlib",            completed_lessons: 3,

        {/* Header */}

        <motion.div        type: "video"            estimated_duration: "6 weeks",

          initial={{ opacity: 0, y: 20 }}

          animate={{ opacity: 1, y: 0 }}      }            last_accessed: "2024-10-06T14:30:00Z",

          className="text-center"

        >    },            difficulty: "advanced",

          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">

            My Learning Dashboard    {            rating: 4.8,

          </h1>

          <p className="text-lg text-gray-600">      id: 3,            enrollment_count: 890,

            Continue your learning journey with {courses.length} enrolled course{courses.length !== 1 ? 's' : ''}

          </p>      title: "Advanced React Patterns",            current_lesson: {

        </motion.div>

      description: "Explore advanced React concepts including hooks, context, and performance optimization.",              id: 4,

        {/* Stats Cards */}

        <motion.div      instructor_name: "Mike Johnson",              title: "React Hooks Deep Dive",

          initial={{ opacity: 0, y: 20 }}

          animate={{ opacity: 1, y: 0 }}      progress: 20,              type: "text"

          transition={{ delay: 0.1 }}

          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"      total_lessons: 18,            }

        >

          <Card>      completed_lessons: 4,          }

            <CardContent className="p-6">

              <div className="flex items-center">      estimated_duration: "6 weeks",        ];

                <BookOpen className="h-8 w-8 text-blue-600" />

                <div className="ml-4">      last_accessed: "2024-01-13",        

                  <p className="text-sm font-medium text-gray-600">Total Courses</p>

                  <p className="text-2xl font-bold text-gray-900">{courses.length}</p>      difficulty: 'advanced',        setCourses(mockCourses);

                </div>

              </div>      rating: 4.7,      } catch (err: any) {

            </CardContent>

          </Card>      enrollment_count: 750,        console.error('Failed to fetch enrolled courses:', err);



          <Card>      current_lesson: {        setError('Failed to load your courses');

            <CardContent className="p-6">

              <div className="flex items-center">        id: 5,      } finally {

                <TrendingUp className="h-8 w-8 text-green-600" />

                <div className="ml-4">        title: "Custom Hooks",        setLoading(false);

                  <p className="text-sm font-medium text-gray-600">In Progress</p>

                  <p className="text-2xl font-bold text-gray-900">{inProgressCourses}</p>        type: "video"      }

                </div>

              </div>      }    };

            </CardContent>

          </Card>    },



          <Card>    {    fetchEnrolledCourses();

            <CardContent className="p-6">

              <div className="flex items-center">      id: 4,  }, [isAuthenticated]);

                <Award className="h-8 w-8 text-yellow-600" />

                <div className="ml-4">      title: "Digital Marketing Fundamentals",

                  <p className="text-sm font-medium text-gray-600">Completed</p>

                  <p className="text-2xl font-bold text-gray-900">{completedCourses}</p>      description: "Learn the essentials of digital marketing including SEO, social media, and analytics.",  // Filter and sort courses

                </div>

              </div>      instructor_name: "Sarah Wilson",  const filteredAndSortedCourses = courses

            </CardContent>

          </Card>      progress: 100,    .filter(course => {



          <Card>      total_lessons: 15,      const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||

            <CardContent className="p-6">

              <div className="flex items-center">      completed_lessons: 15,                           course.instructor_name.toLowerCase().includes(searchQuery.toLowerCase());

                <Target className="h-8 w-8 text-purple-600" />

                <div className="ml-4">      estimated_duration: "5 weeks",      

                  <p className="text-sm font-medium text-gray-600">Overall Progress</p>

                  <p className="text-2xl font-bold text-gray-900">{Math.round(totalProgress)}%</p>      last_accessed: "2024-01-12",      const matchesFilter = 

                </div>

              </div>      difficulty: 'beginner',        filterStatus === 'all' ||

            </CardContent>

          </Card>      rating: 4.6,        (filterStatus === 'in-progress' && course.progress > 0 && course.progress < 100) ||

        </motion.div>

      enrollment_count: 1500,        (filterStatus === 'completed' && course.progress === 100);

        {/* Overall Progress */}

        <motion.div    },      

          initial={{ opacity: 0, y: 20 }}

          animate={{ opacity: 1, y: 0 }}    {      return matchesSearch && matchesFilter;

          transition={{ delay: 0.2 }}

        >      id: 5,    })

          <Card>

            <CardHeader>      title: "Machine Learning Basics",    .sort((a, b) => {

              <CardTitle className="flex items-center">

                <BarChart3 className="h-5 w-5 mr-2" />      description: "Introduction to machine learning algorithms and their practical applications.",      switch (sortBy) {

                Learning Progress Overview

              </CardTitle>      instructor_name: "David Brown",        case 'recent':

            </CardHeader>

            <CardContent>      progress: 60,          return new Date(b.last_accessed).getTime() - new Date(a.last_accessed).getTime();

              <div className="space-y-4">

                <div>      total_lessons: 22,        case 'progress':

                  <div className="flex justify-between text-sm mb-2">

                    <span>Overall Progress Across All Courses</span>      completed_lessons: 13,          return b.progress - a.progress;

                    <span>{Math.round(totalProgress)}%</span>

                  </div>      estimated_duration: "12 weeks",        case 'title':

                  <Progress value={totalProgress} className="h-3" />

                </div>      last_accessed: "2024-01-11",          return a.title.localeCompare(b.title);

                <div className="grid grid-cols-3 gap-4 text-center">

                  <div>      difficulty: 'intermediate',        default:

                    <div className="text-2xl font-bold text-blue-600">{notStartedCourses}</div>

                    <div className="text-sm text-gray-600">Not Started</div>      rating: 4.8,          return 0;

                  </div>

                  <div>      enrollment_count: 890,      }

                    <div className="text-2xl font-bold text-green-600">{inProgressCourses}</div>

                    <div className="text-sm text-gray-600">In Progress</div>      current_lesson: {    });

                  </div>

                  <div>        id: 14,

                    <div className="text-2xl font-bold text-yellow-600">{completedCourses}</div>

                    <div className="text-sm text-gray-600">Completed</div>        title: "Linear Regression",  // Calculate stats

                  </div>

                </div>        type: "video"  const totalProgress = courses.length > 0 

              </div>

            </CardContent>      }    ? courses.reduce((sum, course) => sum + course.progress, 0) / courses.length 

          </Card>

        </motion.div>    },    : 0;



        {/* Search and Filters */}    {

        <motion.div

          initial={{ opacity: 0, y: 20 }}      id: 6,  const completedCourses = courses.filter(course => course.progress === 100).length;

          animate={{ opacity: 1, y: 0 }}

          transition={{ delay: 0.3 }}      title: "UI/UX Design Principles",  const inProgressCourses = courses.filter(course => course.progress > 0 && course.progress < 100).length;

          className="flex flex-col sm:flex-row gap-4 items-center justify-between"

        >      description: "Master the principles of user interface and user experience design.",

          <div className="flex flex-col sm:flex-row gap-4 flex-1">

            <div className="relative flex-1 max-w-md">      instructor_name: "Emily Davis",  const getDifficultyColor = (difficulty: string) => {

              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />

              <Input      progress: 30,    switch (difficulty) {

                placeholder="Search your courses..."

                value={searchTerm}      total_lessons: 16,      case 'beginner': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';

                onChange={(e) => setSearchTerm(e.target.value)}

                className="pl-10"      completed_lessons: 5,      case 'intermediate': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';

              />

            </div>      estimated_duration: "7 weeks",      case 'advanced': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';

            

            <Select value={sortBy} onValueChange={setSortBy}>      last_accessed: "2024-01-10",      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';

              <SelectTrigger className="w-[180px]">

                <SelectValue placeholder="Sort by" />      difficulty: 'beginner',    }

              </SelectTrigger>

              <SelectContent>      rating: 4.7,  };

                <SelectItem value="recent">Recently Accessed</SelectItem>

                <SelectItem value="progress">Progress</SelectItem>      enrollment_count: 1100,

                <SelectItem value="alphabetical">Alphabetical</SelectItem>

                <SelectItem value="enrollment">Enrollment Date</SelectItem>      current_lesson: {  const getLastAccessedText = (dateString: string) => {

              </SelectContent>

            </Select>        id: 6,    const date = new Date(dateString);



            <Select value={filterStatus} onValueChange={setFilterStatus}>        title: "Color Theory",    const now = new Date();

              <SelectTrigger className="w-[140px]">

                <SelectValue placeholder="Status" />        type: "reading"    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

              </SelectTrigger>

              <SelectContent>      }    

                <SelectItem value="all">All Status</SelectItem>

                <SelectItem value="not-started">Not Started</SelectItem>    }    if (diffInDays === 0) return 'Today';

                <SelectItem value="in-progress">In Progress</SelectItem>

                <SelectItem value="completed">Completed</SelectItem>  ];    if (diffInDays === 1) return 'Yesterday';

              </SelectContent>

            </Select>    if (diffInDays < 7) return `${diffInDays} days ago`;

          </div>

  useEffect(() => {    return date.toLocaleDateString();

          <div className="flex items-center gap-2">

            <Button    const fetchCourses = async () => {  };

              variant={viewMode === 'grid' ? 'default' : 'outline'}

              size="sm"      if (!isAuthenticated) return;

              onClick={() => setViewMode('grid')}

            >  if (!isAuthenticated) {

              <Grid3X3 className="h-4 w-4" />

            </Button>      try {    return (

            <Button

              variant={viewMode === 'list' ? 'default' : 'outline'}        setLoading(true);      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-orange-50">

              size="sm"

              onClick={() => setViewMode('list')}        setError(null);        <div className="text-center space-y-4 p-6 bg-white rounded-lg shadow-lg max-w-md">

            >

              <List className="h-4 w-4" />                  <AlertCircle className="h-16 w-16 text-red-500 mx-auto" />

            </Button>

          </div>        // TODO: Replace with actual API call when backend is working          <h2 className="text-xl font-semibold">Access Denied</h2>

        </motion.div>

        // const response = await fetch('/v1/student/courses', {          <p className="text-muted-foreground">Please log in to access your learning dashboard.</p>

        {/* Courses Grid/List */}

        <motion.div        //   method: 'GET',          <Button asChild>

          initial={{ opacity: 0 }}

          animate={{ opacity: 1 }}        //   headers: {            <Link href="/auth/login">Login</Link>

          transition={{ delay: 0.4 }}

        >        //     'Authorization': `Bearer ${localStorage.getItem('token')}`,          </Button>

          {sortedCourses.length === 0 ? (

            <Card>        //     'Content-Type': 'application/json',        </div>

              <CardContent className="py-12">

                <div className="text-center">        //   },      </div>

                  <BookOpen className="mx-auto h-12 w-12 text-gray-400" />

                  <h3 className="mt-2 text-sm font-semibold text-gray-900">No courses found</h3>        // });    );

                  <p className="mt-1 text-sm text-gray-500">

                    {searchTerm || filterStatus !== 'all'           }

                      ? 'Try adjusting your search or filters'

                      : 'You haven\'t enrolled in any courses yet'        // if (!response.ok) {

                    }

                  </p>        //   throw new Error('Failed to fetch courses');  if (loading) {

                  <Button asChild className="mt-4">

                    <Link href="/student/courses">Browse Courses</Link>        // }    return (

                  </Button>

                </div>              <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">

              </CardContent>

            </Card>        // const data = await response.json();        <div className="container mx-auto px-4 py-8">

          ) : (

            <div className={        // setCourses(data);          <div className="flex items-center justify-center min-h-[400px]">

              viewMode === 'grid' 

                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"                    <div className="text-center space-y-4">

                : "space-y-4"

            }>        // For now, use mock data              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />

              {sortedCourses.map((course: Course, index: number) => (

                <motion.div        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API delay              <p className="text-muted-foreground">Loading your learning journey...</p>

                  key={course.id}

                  initial={{ opacity: 0, y: 20 }}        setCourses(mockCourses);            </div>

                  animate={{ opacity: 1, y: 0 }}

                  transition={{ delay: index * 0.1 }}      } catch (err) {          </div>

                >

                  <Card className="h-full hover:shadow-lg transition-shadow">        console.error('Error fetching courses:', err);        </div>

                    <CardContent className="p-6">

                      <div className="space-y-4">        setError('Failed to load your courses');      </div>

                        {/* Course Header */}

                        <div className="flex justify-between items-start">      } finally {    );

                          <div className="flex-1">

                            <h3 className="text-lg font-semibold text-gray-900 mb-1">        setLoading(false);  }

                              {course.title}

                            </h3>      }

                            <p className="text-sm text-gray-600 mb-2">

                              by {course.instructor_name}    };  if (error) {

                            </p>

                            <Badge className={getDifficultyColor(course.difficulty)}>    return (

                              {course.difficulty}

                            </Badge>    fetchCourses();      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50">

                          </div>

                          <div className="flex items-center text-sm text-gray-500">  }, [isAuthenticated]);        <div className="container mx-auto px-4 py-8">

                            <Star className="h-4 w-4 text-yellow-400 mr-1" />

                            {course.rating}          <div className="flex items-center justify-center min-h-[400px]">

                          </div>

                        </div>  const totalProgress = courses.length > 0            <div className="text-center space-y-4 p-6 bg-white rounded-lg shadow-lg max-w-md">



                        {/* Course Description */}    ? courses.reduce((sum: number, course: Course) => sum + course.progress, 0) / courses.length              <AlertCircle className="h-16 w-16 text-red-500 mx-auto" />

                        <p className="text-sm text-gray-600 line-clamp-2">

                          {course.description}    : 0;              <h2 className="text-xl font-semibold">Error</h2>

                        </p>

              <p className="text-muted-foreground">{error}</p>

                        {/* Progress */}

                        <div className="space-y-2">  const completedCourses = courses.filter((course: Course) => course.progress === 100).length;              <Button onClick={() => window.location.reload()}>Try Again</Button>

                          <div className="flex justify-between text-sm">

                            <span>Progress</span>  const inProgressCourses = courses.filter((course: Course) => course.progress > 0 && course.progress < 100).length;            </div>

                            <span>{course.progress}%</span>

                          </div>          </div>

                          <Progress value={course.progress} className="h-2" />

                          <p className="text-xs text-gray-500">  const filteredCourses = courses.filter((course: Course) => {        </div>

                            {course.completed_lessons} of {course.total_lessons} lessons completed

                          </p>    const matchesSearch = course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||      </div>

                        </div>

                         course.instructor_name.toLowerCase().includes(searchTerm.toLowerCase());    );

                        {/* Course Info */}

                        <div className="flex items-center justify-between text-sm text-gray-500">    const matchesDifficulty = filterDifficulty === 'all' || course.difficulty === filterDifficulty;  }

                          <div className="flex items-center">

                            <Clock className="h-4 w-4 mr-1" />    return matchesSearch && matchesDifficulty;

                            {course.estimated_duration}

                          </div>  });  return (

                          <div>

                            Last accessed: {new Date(course.last_accessed).toLocaleDateString()}    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">

                          </div>

                        </div>  const sortedCourses = [...filteredCourses].sort((a: Course, b: Course) => {      <div className="container mx-auto px-4 py-8">



                        {/* Current Lesson */}    switch (sortBy) {        {/* Header */}

                        {course.current_lesson && course.progress > 0 && course.progress < 100 && (

                          <div className="bg-blue-50 p-3 rounded-lg">      case 'recent':        <motion.div

                            <p className="text-xs text-blue-700 font-medium mb-1">Continue Learning</p>

                            <p className="text-sm text-blue-900">{course.current_lesson.title}</p>        return new Date(b.last_accessed).getTime() - new Date(a.last_accessed).getTime();          initial={{ opacity: 0, y: 20 }}

                          </div>

                        )}      case 'progress':          animate={{ opacity: 1, y: 0 }}



                        {/* Action Button */}        return b.progress - a.progress;          className="mb-8"

                        <Link href={`/student/learn/${course.id}`} className="block">

                          <Button className="w-full" size="sm">      case 'alphabetical':        >

                            <Play className="h-4 w-4 mr-2" />

                            {course.progress === 0 ? 'Start Course' :         return a.title.localeCompare(b.title);          <div className="flex items-center justify-between mb-4">

                             course.progress === 100 ? 'Review Course' : 'Continue Learning'}

                            <ChevronRight className="h-4 w-4 ml-2" />      case 'rating':            <div>

                          </Button>

                        </Link>        return b.rating - a.rating;              <h1 className="text-3xl font-bold mb-2">My Learning</h1>

                      </div>

                    </CardContent>      default:              <p className="text-muted-foreground">

                  </Card>

                </motion.div>        return 0;                Continue your educational journey and track your progress

              ))}

            </div>    }              </p>

          )}

        </motion.div>  });            </div>



        {/* Quick Actions */}          </div>

        <motion.div

          initial={{ opacity: 0, y: 20 }}  if (!isAuthenticated) {        </motion.div>

          animate={{ opacity: 1, y: 0 }}

          transition={{ delay: 0.5 }}    return (

        >

          <Card>      <div className="min-h-screen flex items-center justify-center">        {/* Stats Overview */}

            <CardHeader>

              <CardTitle>Quick Actions</CardTitle>        <Card className="w-full max-w-md">        <motion.div

            </CardHeader>

            <CardContent>          <CardContent className="pt-6">          initial={{ opacity: 0, y: 20 }}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                <Button asChild variant="outline" className="h-auto p-4">            <div className="text-center">          animate={{ opacity: 1, y: 0 }}

                  <Link href="/student/courses">

                    <div className="text-center">              <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />          transition={{ delay: 0.1 }}

                      <BookOpen className="h-8 w-8 mx-auto mb-2 text-blue-600" />

                      <div className="font-medium">Browse Courses</div>              <h3 className="mt-2 text-sm font-semibold">Authentication Required</h3>          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"

                      <div className="text-sm text-gray-500">Discover new learning opportunities</div>

                    </div>              <p className="mt-1 text-sm text-muted-foreground">        >

                  </Link>

                </Button>                Please log in to access your learning dashboard.          <Card>

                

                <Button asChild variant="outline" className="h-auto p-4">              </p>            <CardContent className="p-6">

                  <Link href="/student/courses/myprogress">

                    <div className="text-center">            </div>              <div className="flex items-center space-x-3">

                      <BarChart3 className="h-8 w-8 mx-auto mb-2 text-green-600" />

                      <div className="font-medium">View Progress</div>          </CardContent>                <div className="p-2 bg-blue-100 rounded-lg dark:bg-blue-900">

                      <div className="text-sm text-gray-500">Track your learning analytics</div>

                    </div>        </Card>                  <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />

                  </Link>

                </Button>      </div>                </div>

                

                <Button asChild variant="outline" className="h-auto p-4">    );                <div>

                  <Link href="/student/certificates">

                    <div className="text-center">  }                  <p className="text-sm text-muted-foreground">Enrolled Courses</p>

                      <Award className="h-8 w-8 mx-auto mb-2 text-yellow-600" />

                      <div className="font-medium">Certificates</div>                  <p className="text-2xl font-bold">{courses.length}</p>

                      <div className="text-sm text-gray-500">View earned certificates</div>

                    </div>  if (loading) {                </div>

                  </Link>

                </Button>    return (              </div>

              </div>

            </CardContent>      <div className="min-h-screen flex items-center justify-center">            </CardContent>

          </Card>

        </motion.div>        <div className="text-center">          </Card>

      </div>

    </div>          <Loader2 className="h-8 w-8 animate-spin mx-auto" />

  );

};          <p className="mt-2 text-sm text-muted-foreground">Loading your courses...</p>          <Card>



export default LearningDashboard;        </div>            <CardContent className="p-6">

      </div>              <div className="flex items-center space-x-3">

    );                <div className="p-2 bg-green-100 rounded-lg dark:bg-green-900">

  }                  <Award className="h-6 w-6 text-green-600 dark:text-green-400" />

                </div>

  if (error) {                <div>

    return (                  <p className="text-sm text-muted-foreground">Completed</p>

      <div className="min-h-screen flex items-center justify-center">                  <p className="text-2xl font-bold">{completedCourses}</p>

        <Card className="w-full max-w-md">                </div>

          <CardContent className="pt-6">              </div>

            <div className="text-center">            </CardContent>

              <AlertCircle className="mx-auto h-12 w-12 text-red-500" />          </Card>

              <h3 className="mt-2 text-sm font-semibold">Error Loading Courses</h3>

              <p className="mt-1 text-sm text-muted-foreground">{error}</p>          <Card>

              <Button             <CardContent className="p-6">

                className="mt-4"               <div className="flex items-center space-x-3">

                onClick={() => window.location.reload()}                <div className="p-2 bg-orange-100 rounded-lg dark:bg-orange-900">

              >                  <TrendingUp className="h-6 w-6 text-orange-600 dark:text-orange-400" />

                Try Again                </div>

              </Button>                <div>

            </div>                  <p className="text-sm text-muted-foreground">In Progress</p>

          </CardContent>                  <p className="text-2xl font-bold">{inProgressCourses}</p>

        </Card>                </div>

      </div>              </div>

    );            </CardContent>

  }          </Card>



  const getDifficultyColor = (difficulty: string) => {          <Card>

    switch (difficulty) {            <CardContent className="p-6">

      case 'beginner':              <div className="flex items-center space-x-3">

        return 'bg-green-100 text-green-800';                <div className="p-2 bg-purple-100 rounded-lg dark:bg-purple-900">

      case 'intermediate':                  <Target className="h-6 w-6 text-purple-600 dark:text-purple-400" />

        return 'bg-yellow-100 text-yellow-800';                </div>

      case 'advanced':                <div>

        return 'bg-red-100 text-red-800';                  <p className="text-sm text-muted-foreground">Overall Progress</p>

      default:                  <p className="text-2xl font-bold">{Math.round(totalProgress)}%</p>

        return 'bg-gray-100 text-gray-800';                </div>

    }              </div>

  };            </CardContent>

          </Card>

  return (        </motion.div>

    <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8">

      <div className="max-w-7xl mx-auto space-y-6">        {/* Filters and Search */}

        {/* Header */}        <motion.div

        <motion.div          initial={{ opacity: 0, y: 20 }}

          initial={{ opacity: 0, y: 20 }}          animate={{ opacity: 1, y: 0 }}

          animate={{ opacity: 1, y: 0 }}          transition={{ delay: 0.2 }}

          className="text-center"          className="flex flex-col md:flex-row gap-4 mb-6"

        >        >

          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">          <div className="flex-1">

            Welcome back, {user?.first_name || 'Student'}!            <div className="relative">

          </h1>              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />

          <p className="text-lg text-gray-600">              <Input

            Continue your learning journey                placeholder="Search courses..."

          </p>                value={searchQuery}

        </motion.div>                onChange={(e) => setSearchQuery(e.target.value)}

                className="pl-9"

        {/* Stats Cards */}              />

        <motion.div            </div>

          initial={{ opacity: 0, y: 20 }}          </div>

          animate={{ opacity: 1, y: 0 }}

          transition={{ delay: 0.1 }}          <div className="flex space-x-2">

          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"            <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>

        >              <SelectTrigger className="w-40">

          <Card>                <Filter className="h-4 w-4 mr-2" />

            <CardContent className="p-6">                <SelectValue />

              <div className="flex items-center">              </SelectTrigger>

                <BookOpen className="h-8 w-8 text-blue-600" />              <SelectContent>

                <div className="ml-4">                <SelectItem value="all">All Courses</SelectItem>

                  <p className="text-sm font-medium text-gray-600">Total Courses</p>                <SelectItem value="in-progress">In Progress</SelectItem>

                  <p className="text-2xl font-bold text-gray-900">{courses.length}</p>                <SelectItem value="completed">Completed</SelectItem>

                </div>              </SelectContent>

              </div>            </Select>

            </CardContent>

          </Card>            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>

              <SelectTrigger className="w-32">

          <Card>                <SelectValue />

            <CardContent className="p-6">              </SelectTrigger>

              <div className="flex items-center">              <SelectContent>

                <TrendingUp className="h-8 w-8 text-green-600" />                <SelectItem value="recent">Recent</SelectItem>

                <div className="ml-4">                <SelectItem value="progress">Progress</SelectItem>

                  <p className="text-sm font-medium text-gray-600">In Progress</p>                <SelectItem value="title">Title</SelectItem>

                  <p className="text-2xl font-bold text-gray-900">{inProgressCourses}</p>              </SelectContent>

                </div>            </Select>

              </div>

            </CardContent>            <div className="flex border rounded-lg">

          </Card>              <Button

                variant={viewMode === 'grid' ? 'default' : 'ghost'}

          <Card>                size="sm"

            <CardContent className="p-6">                onClick={() => setViewMode('grid')}

              <div className="flex items-center">                className="rounded-r-none"

                <Award className="h-8 w-8 text-yellow-600" />              >

                <div className="ml-4">                <Grid3X3 className="h-4 w-4" />

                  <p className="text-sm font-medium text-gray-600">Completed</p>              </Button>

                  <p className="text-2xl font-bold text-gray-900">{completedCourses}</p>              <Button

                </div>                variant={viewMode === 'list' ? 'default' : 'ghost'}

              </div>                size="sm"

            </CardContent>                onClick={() => setViewMode('list')}

          </Card>                className="rounded-l-none"

              >

          <Card>                <List className="h-4 w-4" />

            <CardContent className="p-6">              </Button>

              <div className="flex items-center">            </div>

                <Target className="h-8 w-8 text-purple-600" />          </div>

                <div className="ml-4">        </motion.div>

                  <p className="text-sm font-medium text-gray-600">Overall Progress</p>

                  <p className="text-2xl font-bold text-gray-900">{Math.round(totalProgress)}%</p>        {/* Courses Grid/List */}

                </div>        {filteredAndSortedCourses.length === 0 ? (

              </div>          <motion.div

            </CardContent>            initial={{ opacity: 0 }}

          </Card>            animate={{ opacity: 1 }}

        </motion.div>            transition={{ delay: 0.3 }}

            className="text-center py-12"

        {/* Overall Progress */}          >

        <motion.div            <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">

          initial={{ opacity: 0, y: 20 }}              <BookOpen className="h-12 w-12 text-muted-foreground" />

          animate={{ opacity: 1, y: 0 }}            </div>

          transition={{ delay: 0.2 }}            <h3 className="text-lg font-semibold mb-2">No courses found</h3>

        >            <p className="text-muted-foreground mb-4">

          <Card>              {searchQuery ? 'Try adjusting your search terms' : 'Start your learning journey by enrolling in a course'}

            <CardHeader>            </p>

              <CardTitle className="flex items-center">            <Button asChild>

                <BarChart3 className="h-5 w-5 mr-2" />              <Link href="/student/courses">Browse Courses</Link>

                Learning Progress            </Button>

              </CardTitle>          </motion.div>

            </CardHeader>        ) : (

            <CardContent>          <motion.div

              <div className="space-y-4">            initial={{ opacity: 0 }}

                <div>            animate={{ opacity: 1 }}

                  <div className="flex justify-between text-sm mb-2">            transition={{ delay: 0.3 }}

                    <span>Overall Progress</span>            className={

                    <span>{Math.round(totalProgress)}%</span>              viewMode === 'grid'

                  </div>                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'

                  <Progress value={totalProgress} className="h-3" />                : 'space-y-4'

                </div>            }

              </div>          >

            </CardContent>            {filteredAndSortedCourses.map((course, index) => (

          </Card>              <motion.div

        </motion.div>                key={course.id}

                initial={{ opacity: 0, y: 20 }}

        {/* Search and Filters */}                animate={{ opacity: 1, y: 0 }}

        <motion.div                transition={{ delay: 0.1 * index }}

          initial={{ opacity: 0, y: 20 }}              >

          animate={{ opacity: 1, y: 0 }}                {viewMode === 'grid' ? (

          transition={{ delay: 0.3 }}                  <Card className="hover:shadow-lg transition-shadow duration-200 cursor-pointer group">

          className="flex flex-col sm:flex-row gap-4 items-center justify-between"                    <div className="aspect-video bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 rounded-t-lg flex items-center justify-center">

        >                      {course.thumbnail_url ? (

          <div className="flex flex-col sm:flex-row gap-4 flex-1">                        <img

            <div className="relative flex-1 max-w-md">                          src={course.thumbnail_url}

              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />                          alt={course.title}

              <Input                          className="w-full h-full object-cover rounded-t-lg"

                placeholder="Search courses..."                        />

                value={searchTerm}                      ) : (

                onChange={(e) => setSearchTerm(e.target.value)}                        <BookOpen className="h-12 w-12 text-muted-foreground" />

                className="pl-10"                      )}

              />                    </div>

            </div>                    <CardContent className="p-6">

                                  <div className="flex items-start justify-between mb-3">

            <Select value={sortBy} onValueChange={setSortBy}>                        <Badge variant="secondary" className={getDifficultyColor(course.difficulty)}>

              <SelectTrigger className="w-[180px]">                          {course.difficulty}

                <SelectValue placeholder="Sort by" />                        </Badge>

              </SelectTrigger>                        <div className="flex items-center space-x-1 text-sm text-muted-foreground">

              <SelectContent>                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />

                <SelectItem value="recent">Recently Accessed</SelectItem>                          <span>{course.rating}</span>

                <SelectItem value="progress">Progress</SelectItem>                        </div>

                <SelectItem value="alphabetical">Alphabetical</SelectItem>                      </div>

                <SelectItem value="rating">Rating</SelectItem>                      

              </SelectContent>                      <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">

            </Select>                        {course.title}

                      </h3>

            <Select value={filterDifficulty} onValueChange={setFilterDifficulty}>                      

              <SelectTrigger className="w-[140px]">                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">

                <SelectValue placeholder="Difficulty" />                        {course.description}

              </SelectTrigger>                      </p>

              <SelectContent>                      

                <SelectItem value="all">All Levels</SelectItem>                      <div className="space-y-3">

                <SelectItem value="beginner">Beginner</SelectItem>                        <div className="flex items-center justify-between text-sm">

                <SelectItem value="intermediate">Intermediate</SelectItem>                          <span className="text-muted-foreground">Progress</span>

                <SelectItem value="advanced">Advanced</SelectItem>                          <span className="font-medium">{Math.round(course.progress)}%</span>

              </SelectContent>                        </div>

            </Select>                        <Progress value={course.progress} className="h-2" />

          </div>                        

                        <div className="flex items-center justify-between text-sm text-muted-foreground">

          <div className="flex items-center gap-2">                          <span>{course.completed_lessons}/{course.total_lessons} lessons</span>

            <Button                          <span>Last: {getLastAccessedText(course.last_accessed)}</span>

              variant={viewMode === 'grid' ? 'default' : 'outline'}                        </div>

              size="sm"                        

              onClick={() => setViewMode('grid')}                        {course.current_lesson && (

            >                          <div className="pt-2 border-t">

              <Grid3X3 className="h-4 w-4" />                            <p className="text-sm font-medium mb-1">Continue with:</p>

            </Button>                            <p className="text-sm text-muted-foreground">{course.current_lesson.title}</p>

            <Button                          </div>

              variant={viewMode === 'list' ? 'default' : 'outline'}                        )}

              size="sm"                      </div>

              onClick={() => setViewMode('list')}                      

            >                      <div className="flex space-x-2 mt-4">

              <List className="h-4 w-4" />                        <Button asChild className="flex-1">

            </Button>                          <Link href={`/student/learn/${course.id}`}>

          </div>                            <Play className="h-4 w-4 mr-2" />

        </motion.div>                            Continue Learning

                          </Link>

        {/* Courses Grid/List */}                        </Button>

        <motion.div                        <Button asChild variant="outline">

          initial={{ opacity: 0 }}                          <Link href={`/student/courses/${course.id}`}>

          animate={{ opacity: 1 }}                            <Target className="h-4 w-4" />

          transition={{ delay: 0.4 }}                          </Link>

        >                        </Button>

          {sortedCourses.length === 0 ? (                      </div>

            <Card>                    </CardContent>

              <CardContent className="py-12">                  </Card>

                <div className="text-center">                ) : (

                  <BookOpen className="mx-auto h-12 w-12 text-gray-400" />                  <Card className="hover:shadow-md transition-shadow duration-200">

                  <h3 className="mt-2 text-sm font-semibold text-gray-900">No courses found</h3>                    <CardContent className="p-6">

                  <p className="mt-1 text-sm text-gray-500">                      <div className="flex items-center space-x-4">

                    {searchTerm || filterDifficulty !== 'all'                         <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 rounded-lg flex items-center justify-center flex-shrink-0">

                      ? 'Try adjusting your search or filters'                          {course.thumbnail_url ? (

                      : 'Enroll in courses to start learning'                            <img

                    }                              src={course.thumbnail_url}

                  </p>                              alt={course.title}

                </div>                              className="w-full h-full object-cover rounded-lg"

              </CardContent>                            />

            </Card>                          ) : (

          ) : (                            <BookOpen className="h-8 w-8 text-muted-foreground" />

            <div className={                          )}

              viewMode === 'grid'                         </div>

                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"                        

                : "space-y-4"                        <div className="flex-1 min-w-0">

            }>                          <div className="flex items-start justify-between mb-2">

              {sortedCourses.map((course: Course, index: number) => (                            <div>

                <motion.div                              <h3 className="font-semibold text-lg mb-1">{course.title}</h3>

                  key={course.id}                              <p className="text-sm text-muted-foreground">by {course.instructor_name}</p>

                  initial={{ opacity: 0, y: 20 }}                            </div>

                  animate={{ opacity: 1, y: 0 }}                            <div className="flex items-center space-x-2">

                  transition={{ delay: index * 0.1 }}                              <Badge variant="secondary" className={getDifficultyColor(course.difficulty)}>

                >                                {course.difficulty}

                  <Card className="h-full hover:shadow-lg transition-shadow">                              </Badge>

                    <CardContent className="p-6">                              <div className="flex items-center space-x-1 text-sm text-muted-foreground">

                      <div className="space-y-4">                                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />

                        {/* Course Header */}                                <span>{course.rating}</span>

                        <div className="flex justify-between items-start">                              </div>

                          <div className="flex-1">                            </div>

                            <h3 className="text-lg font-semibold text-gray-900 mb-1">                          </div>

                              {course.title}                          

                            </h3>                          <div className="flex items-center space-x-6 mb-3">

                            <p className="text-sm text-gray-600 mb-2">                            <div className="flex items-center space-x-2">

                              by {course.instructor_name}                              <Progress value={course.progress} className="w-32 h-2" />

                            </p>                              <span className="text-sm font-medium">{Math.round(course.progress)}%</span>

                            <Badge className={getDifficultyColor(course.difficulty)}>                            </div>

                              {course.difficulty}                            <span className="text-sm text-muted-foreground">

                            </Badge>                              {course.completed_lessons}/{course.total_lessons} lessons

                          </div>                            </span>

                          <div className="flex items-center text-sm text-gray-500">                            <span className="text-sm text-muted-foreground">

                            <Star className="h-4 w-4 text-yellow-400 mr-1" />                              Last: {getLastAccessedText(course.last_accessed)}

                            {course.rating}                            </span>

                          </div>                          </div>

                        </div>                          

                          {course.current_lesson && (

                        {/* Course Description */}                            <p className="text-sm text-muted-foreground mb-3">

                        <p className="text-sm text-gray-600 line-clamp-2">                              Next: {course.current_lesson.title}

                          {course.description}                            </p>

                        </p>                          )}

                        </div>

                        {/* Progress */}                        

                        <div className="space-y-2">                        <div className="flex space-x-2">

                          <div className="flex justify-between text-sm">                          <Button asChild>

                            <span>Progress</span>                            <Link href={`/student/learn/${course.id}`}>

                            <span>{course.progress}%</span>                              <Play className="h-4 w-4 mr-2" />

                          </div>                              Continue

                          <Progress value={course.progress} className="h-2" />                            </Link>

                          <p className="text-xs text-gray-500">                          </Button>

                            {course.completed_lessons} of {course.total_lessons} lessons completed                          <Button asChild variant="outline">

                          </p>                            <Link href={`/student/courses/${course.id}`}>

                        </div>                              <Target className="h-4 w-4" />

                            </Link>

                        {/* Course Info */}                          </Button>

                        <div className="flex items-center justify-between text-sm text-gray-500">                        </div>

                          <div className="flex items-center">                      </div>

                            <Clock className="h-4 w-4 mr-1" />                    </CardContent>

                            {course.estimated_duration}                  </Card>

                          </div>                )}

                          <div>              </motion.div>

                            {course.enrollment_count} students            ))}

                          </div>          </motion.div>

                        </div>        )}

      </div>

                        {/* Current Lesson */}    </div>

                        {course.current_lesson && course.progress > 0 && course.progress < 100 && (  );

                          <div className="bg-blue-50 p-3 rounded-lg">};

                            <p className="text-xs text-blue-700 font-medium mb-1">Continue Learning</p>

                            <p className="text-sm text-blue-900">{course.current_lesson.title}</p>export default LearningDashboard;

                          </div>

                        )}  useEffect(() => {

    const fetchEnrolledCourses = async () => {

                        {/* Action Button */}      if (!isAuthenticated) return;

                        <Link href={`/student/learn/${course.id}`} className="block">      

                          <Button className="w-full" size="sm">      try {

                            <Play className="h-4 w-4 mr-2" />        setLoading(true);

                            {course.progress === 0 ? 'Start Course' :         setError(null);

                             course.progress === 100 ? 'Review' : 'Continue'}        

                          </Button>        // For now, let's use mock data since we need to fix the API

                        </Link>        const mockCourses: Course[] = [

                      </div>          {

                    </CardContent>            id: 1,

                  </Card>            title: "Introduction to Web Development",

                </motion.div>            description: "Learn the basics of HTML, CSS, and JavaScript",

              ))}            instructor_name: "John Doe",

            </div>            progress: 45,

          )}            total_lessons: 20,

        </motion.div>            completed_lessons: 9,

      </div>            estimated_duration: "8 weeks",

    </div>            last_accessed: "2024-10-07T10:00:00Z",

  );            difficulty: "beginner",

};            rating: 4.5,

            enrollment_count: 1250,

export default LearningDashboard;            current_lesson: {
              id: 10,
              title: "JavaScript Fundamentals",
              type: "video"
            }
          },
          {
            id: 2,
            title: "Advanced React Development",
            description: "Master React hooks, context, and state management",
            instructor_name: "Jane Smith",
            progress: 20,
            total_lessons: 15,
            completed_lessons: 3,
            estimated_duration: "6 weeks",
            last_accessed: "2024-10-06T14:30:00Z",
            difficulty: "advanced",
            rating: 4.8,
            enrollment_count: 890,
            current_lesson: {
              id: 4,
              title: "React Hooks Deep Dive",
              type: "text"
            }
          }
        ];
        
        setCourses(mockCourses);
      } catch (err: any) {
        console.error('Failed to fetch enrolled courses:', err);
        setError('Failed to load your courses');
      } finally {
        setLoading(false);
      }
    };

    fetchEnrolledCourses();
  }, [isAuthenticated]);

  const totalProgress = courses.length > 0 
    ? courses.reduce((sum, course) => sum + course.progress, 0) / courses.length 
    : 0;

  const completedCourses = courses.filter(course => course.progress === 100).length;
  const inProgressCourses = courses.filter(course => course.progress > 0 && course.progress < 100).length;

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'advanced': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getLastAccessedText = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    return date.toLocaleDateString();
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-orange-50">
        <div className="text-center space-y-4 p-6 bg-white rounded-lg shadow-lg max-w-md">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto" />
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">Please log in to access your learning dashboard.</p>
          <Button asChild>
            <Link href="/auth/login">Login</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
              <p className="text-muted-foreground">Loading your learning journey...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-4 p-6 bg-white rounded-lg shadow-lg max-w-md">
              <AlertCircle className="h-16 w-16 text-red-500 mx-auto" />
              <h2 className="text-xl font-semibold">Error</h2>
              <p className="text-muted-foreground">{error}</p>
              <Button onClick={() => window.location.reload()}>Try Again</Button>
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
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">My Learning</h1>
              <p className="text-muted-foreground">
                Continue your educational journey and track your progress
              </p>
            </div>
          </div>
        </motion.div>

        {/* Stats Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg dark:bg-blue-900">
                  <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Enrolled Courses</p>
                  <p className="text-2xl font-bold">{courses.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 rounded-lg dark:bg-green-900">
                  <Award className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold">{completedCourses}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-orange-100 rounded-lg dark:bg-orange-900">
                  <TrendingUp className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                  <p className="text-2xl font-bold">{inProgressCourses}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 rounded-lg dark:bg-purple-900">
                  <Target className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Overall Progress</p>
                  <p className="text-2xl font-bold">{Math.round(totalProgress)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Courses Grid */}
        {courses.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center py-12"
          >
            <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No courses found</h3>
            <p className="text-muted-foreground mb-4">
              Start your learning journey by enrolling in a course
            </p>
            <Button asChild>
              <Link href="/student/courses">Browse Courses</Link>
            </Button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {courses.map((course, index) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
              >
                <Card className="hover:shadow-lg transition-shadow duration-200 cursor-pointer group">
                  <div className="aspect-video bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 rounded-t-lg flex items-center justify-center">
                    {course.thumbnail_url ? (
                      <img
                        src={course.thumbnail_url}
                        alt={course.title}
                        className="w-full h-full object-cover rounded-t-lg"
                      />
                    ) : (
                      <BookOpen className="h-12 w-12 text-muted-foreground" />
                    )}
                  </div>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <Badge variant="secondary" className={getDifficultyColor(course.difficulty)}>
                        {course.difficulty}
                      </Badge>
                      <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span>{course.rating}</span>
                      </div>
                    </div>
                    
                    <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">
                      {course.title}
                    </h3>
                    
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {course.description}
                    </p>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">{Math.round(course.progress)}%</span>
                      </div>
                      <Progress value={course.progress} className="h-2" />
                      
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>{course.completed_lessons}/{course.total_lessons} lessons</span>
                        <span>Last: {getLastAccessedText(course.last_accessed)}</span>
                      </div>
                      
                      {course.current_lesson && (
                        <div className="pt-2 border-t">
                          <p className="text-sm font-medium mb-1">Continue with:</p>
                          <p className="text-sm text-muted-foreground">{course.current_lesson.title}</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex space-x-2 mt-4">
                      <Button asChild className="flex-1">
                        <Link href={`/student/learn/${course.id}`}>
                          <Play className="h-4 w-4 mr-2" />
                          Continue Learning
                        </Link>
                      </Button>
                      <Button asChild variant="outline">
                        <Link href={`/student/courses/${course.id}`}>
                          <Target className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default LearningDashboard;
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
import Link from 'next/link';

interface Course {
  id: number;
  title: string;
  description: string;
  instructor_name: string;
  progress: number;
  total_lessons: number;
  completed_lessons: number;
  estimated_duration: string;
  last_accessed: string;
  thumbnail_url?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  rating: number;
  enrollment_count: number;
  current_lesson?: {
    id: number;
    title: string;
    type: string;
  };
  modules?: ModuleData[];
  suspension_status?: SuspensionStatus;
}

const ModuleCard = ({ 
  moduleData, 
  isLocked, 
  onRetake, 
  onContinue 
}: { 
  moduleData: ModuleData;
  isLocked: boolean;
  onRetake: (moduleId: number) => void;
  onContinue: (moduleId: number) => void;
}) => {
  const { module, progress, can_retake } = moduleData;
  
  // Use progression service for calculations
  const progressionValidation = ProgressionService.validateProgression(progress);
  const retakeEligibility = ProgressionService.checkRetakeEligibility(progress);
  const suspensionRisk = ProgressionService.assessSuspensionRisk(moduleData);
  const formattedScore = ProgressionService.formatScore(progressionValidation.currentScore);
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'in_progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'unlocked': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'locked': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-5 w-5" />;
      case 'in_progress': return <Play className="h-5 w-5" />;
      case 'failed': return <XCircle className="h-5 w-5" />;
      case 'unlocked': return <Zap className="h-5 w-5" />;
      case 'locked': return <Lock className="h-5 w-5" />;
      default: return <Lock className="h-5 w-5" />;
    }
  };

  return (
    <Card className={`${isLocked ? 'opacity-60' : ''} hover:shadow-lg transition-shadow duration-200`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg mb-2 flex items-center space-x-2">
              {getStatusIcon(progress.status)}
              <span>{module.title}</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className={getStatusColor(progress.status)}>
                {progress.status.replace('_', ' ').toUpperCase()}
              </Badge>
              {suspensionRisk.isAtRisk && (
                <Badge variant="destructive" className={ProgressionService.getRiskColorClass(suspensionRisk.riskLevel)}>
                  {suspensionRisk.riskLevel.toUpperCase()} RISK
                </Badge>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">
              Attempt {progress.attempts_count}/{progress.max_attempts}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {module.description}
        </p>
        
        {/* Score Breakdown */}
        {progress.status !== 'locked' && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Score Breakdown:</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(progressionValidation.breakdown).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()} ({value.percentage}%):
                  </span>
                  <span className={value.current < 70 ? 'text-red-600' : 'text-green-600'}>
                    {ProgressionService.formatScore(value.current)}
                  </span>
                </div>
              ))}
            </div>
            
            <Separator />
            
            <div className="flex justify-between items-center">
              <span className="font-medium">Cumulative Score:</span>
              <span className={`font-bold ${progressionValidation.canProceed ? 'text-green-600' : 'text-red-600'}`}>
                {formattedScore}
              </span>
            </div>
            
            <Progress 
              value={progressionValidation.currentScore} 
              className={`h-2 ${progressionValidation.canProceed ? '[&>div]:bg-green-500' : '[&>div]:bg-red-500'}`}
            />
            
            {!progressionValidation.canProceed && (
              <div className="text-xs text-muted-foreground">
                Need {ProgressionService.formatScore(progressionValidation.missingPoints)} more to proceed
              </div>
            )}
          </div>
        )}
        
        {/* Warnings and Recommendations */}
        {(progressionValidation.warnings.length > 0 || suspensionRisk.isAtRisk) && (
          <div className="space-y-2">
            {progressionValidation.warnings.map((warning, index) => (
              <Alert key={index} className="py-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">{warning}</AlertDescription>
              </Alert>
            ))}
            
            {suspensionRisk.isAtRisk && (
              <Alert className={`py-2 ${ProgressionService.getRiskColorClass(suspensionRisk.riskLevel)}`}>
                <Ban className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <div className="font-medium mb-1">Suspension Risk: {suspensionRisk.riskLevel.toUpperCase()}</div>
                  <ul className="text-xs space-y-1">
                    {suspensionRisk.reasons.map((reason, idx) => (
                      <li key={idx}>• {reason}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="flex space-x-2">
          {progress.status === 'locked' && (
            <Button disabled className="flex-1">
              <Lock className="h-4 w-4 mr-2" />
              Locked
            </Button>
          )}
          
          {(progress.status === 'unlocked' || progress.status === 'in_progress') && (
            <Button 
              className="flex-1"
              onClick={() => onContinue(module.id)}
            >
              <Play className="h-4 w-4 mr-2" />
              {progress.status === 'unlocked' ? 'Start Module' : 'Continue'}
            </Button>
          )}
          
          {progress.status === 'completed' && (
            <Button variant="outline" className="flex-1">
              <CheckCircle className="h-4 w-4 mr-2" />
              Completed ({formattedScore})
            </Button>
          )}
          
          {progress.status === 'failed' && retakeEligibility.canRetake && (
            <Button 
              variant="destructive" 
              className="flex-1"
              onClick={() => onRetake(module.id)}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Retake ({retakeEligibility.remainingAttempts} left)
            </Button>
          )}
          
          {progress.status === 'failed' && !retakeEligibility.canRetake && (
            <Button disabled variant="destructive" className="flex-1">
              <Ban className="h-4 w-4 mr-2" />
              No Retakes Left
            </Button>
          )}
        </div>
        
        {/* Recommendations */}
        {progressionValidation.recommendations.length > 0 && progress.status !== 'completed' && (
          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <div className="text-xs font-medium mb-2 text-blue-800 dark:text-blue-200">
              Recommendations:
            </div>
            <ul className="text-xs space-y-1 text-blue-700 dark:text-blue-300">
              {progressionValidation.recommendations.slice(0, 3).map((rec, idx) => (
                <li key={idx}>• {rec}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const SuspensionAlert = ({ 
  suspensionStatus, 
  onSubmitAppeal 
}: { 
  suspensionStatus: SuspensionStatus;
  onSubmitAppeal: (appealText: string) => void;
}) => {
  const [appealText, setAppealText] = useState('');
  const [showAppealForm, setShowAppealForm] = useState(false);

  if (!suspensionStatus.is_suspended || !suspensionStatus.suspension_details) {
    return null;
  }

  const details = suspensionStatus.suspension_details;

  return (
    <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
      <Ban className="h-4 w-4" />
      <AlertTitle className="text-red-800 dark:text-red-200">Course Suspension</AlertTitle>
      <AlertDescription className="space-y-3">
        <div className="text-red-700 dark:text-red-300">
          You have been suspended from this course due to: {details.reason}
        </div>
        
        <div className="text-sm space-y-1">
          <div>Failed Module: {details.failed_module_title}</div>
          <div>Suspension Date: {new Date(details.suspended_at).toLocaleDateString()}</div>
          <div>Total Attempts Made: {details.total_attempts_made}</div>
        </div>
        
        {details.can_submit_appeal && !details.appeal_submitted && (
          <div className="space-y-2">
            <div className="text-sm">
              Appeal Deadline: {details.appeal_deadline ? new Date(details.appeal_deadline).toLocaleDateString() : 'N/A'}
            </div>
            {!showAppealForm ? (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowAppealForm(true)}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Submit Appeal
              </Button>
            ) : (
              <div className="space-y-2">
                <Textarea
                  placeholder="Explain why you believe the suspension should be reversed..."
                  value={appealText}
                  onChange={(e) => setAppealText(e.target.value)}
                  className="min-h-[100px]"
                />
                <div className="flex space-x-2">
                  <Button 
                    size="sm"
                    onClick={() => {
                      onSubmitAppeal(appealText);
                      setShowAppealForm(false);
                      setAppealText('');
                    }}
                    disabled={!appealText.trim()}
                  >
                    Submit Appeal
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowAppealForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
        
        {details.appeal_submitted && (
          <div className="space-y-1 text-sm">
            <div className="font-medium">Appeal Status: {details.review_status.toUpperCase()}</div>
            <div>Submitted: {details.appeal_submitted_at ? new Date(details.appeal_submitted_at).toLocaleDateString() : 'N/A'}</div>
            {details.review_status === 'pending' && (
              <div className="text-yellow-600 dark:text-yellow-400">
                Your appeal is under review. You will be notified of the decision.
              </div>
            )}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
};

const LearningDashboard = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'in-progress' | 'completed'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'recent' | 'progress' | 'title'>('recent');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showModuleView, setShowModuleView] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    fetchEnrolledCourses();
  }, []);

  const fetchEnrolledCourses = async () => {
    try {
      setLoading(true);
      const response = await StudentApiService.getEnrolledCourses();
      setCourses(response.courses || []);
    } catch (error) {
      console.error('Failed to fetch enrolled courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCourseModules = async (courseId: number) => {
    try {
      const response = await StudentApiService.getCourseModules(courseId);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch course modules:', error);
      return null;
    }
  };

  const handleViewModules = async (course: Course) => {
    try {
      setLoading(true);
      const moduleData = await fetchCourseModules(course.id);
      if (moduleData) {
        setSelectedCourse({
          ...course,
          modules: moduleData.modules,
          suspension_status: moduleData.suspension_status
        });
        setShowModuleView(true);
      }
    } catch (error) {
      console.error('Failed to load modules:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetakeModule = async (moduleId: number) => {
    try {
      const response = await StudentApiService.retakeModule(moduleId);
      if (response.success) {
        // Refresh module data
        if (selectedCourse) {
          await handleViewModules(selectedCourse);
        }
      } else {
        alert(response.error || 'Failed to initiate retake');
      }
    } catch (error) {
      console.error('Failed to retake module:', error);
      alert('Failed to initiate retake');
    }
  };

  const handleContinueModule = (moduleId: number) => {
    if (selectedCourse) {
      window.location.href = `/student/learn/${selectedCourse.id}?module=${moduleId}`;
    }
  };

  const handleSubmitAppeal = async (appealText: string) => {
    if (!selectedCourse) return;
    
    try {
      const response = await StudentApiService.submitSuspensionAppeal(selectedCourse.id, appealText);
      if (response.success) {
        alert('Appeal submitted successfully');
        // Refresh the course data
        await handleViewModules(selectedCourse);
      } else {
        alert(response.error || 'Failed to submit appeal');
      }
    } catch (error) {
      console.error('Failed to submit appeal:', error);
      alert('Failed to submit appeal');
    }
  };

  const filteredAndSortedCourses = courses
    .filter(course => {
      const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           course.instructor_name.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFilter = 
        filterStatus === 'all' ||
        (filterStatus === 'in-progress' && course.progress > 0 && course.progress < 100) ||
        (filterStatus === 'completed' && course.progress === 100);
      
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return new Date(b.last_accessed).getTime() - new Date(a.last_accessed).getTime();
        case 'progress':
          return b.progress - a.progress;
        case 'title':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

  const totalProgress = courses.length > 0 
    ? courses.reduce((sum, course) => sum + course.progress, 0) / courses.length 
    : 0;

  const completedCourses = courses.filter(course => course.progress === 100).length;
  const inProgressCourses = courses.filter(course => course.progress > 0 && course.progress < 100).length;

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'advanced': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getLastAccessedText = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground">Loading your learning journey...</p>
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
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">My Learning</h1>
              <p className="text-muted-foreground">
                Continue your educational journey and track your progress
              </p>
            </div>
            {showModuleView && selectedCourse && (
              <Button 
                variant="outline"
                onClick={() => setShowModuleView(false)}
              >
                ← Back to Courses
              </Button>
            )}
          </div>
        </motion.div>

        {showModuleView && selectedCourse ? (
          /* Module View */
          <div className="space-y-6">
            {/* Course Header */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl mb-2">{selectedCourse.title}</CardTitle>
                    <p className="text-muted-foreground mb-4">{selectedCourse.description}</p>
                    <div className="flex items-center space-x-4 text-sm">
                      <span>Instructor: {selectedCourse.instructor_name}</span>
                      <Badge variant="secondary" className={getDifficultyColor(selectedCourse.difficulty)}>
                        {selectedCourse.difficulty}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{Math.round(selectedCourse.progress)}%</div>
                    <div className="text-sm text-muted-foreground">Overall Progress</div>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Suspension Alert */}
            {selectedCourse.suspension_status && (
              <SuspensionAlert 
                suspensionStatus={selectedCourse.suspension_status}
                onSubmitAppeal={handleSubmitAppeal}
              />
            )}

            {/* Modules Grid */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Course Modules</h2>
              
              {/* Overall Progress Summary */}
              {selectedCourse.modules && selectedCourse.modules.length > 0 && (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <BarChart3 className="h-5 w-5" />
                      <span>Course Progress Summary</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const progressSummary = ProgressionService.calculateCourseProgress(selectedCourse.modules);
                      const nextModule = ProgressionService.getNextUnlockableModule(selectedCourse.modules);
                      
                      return (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <div className="text-sm text-muted-foreground">Overall Progress</div>
                            <div className="text-2xl font-bold">{Math.round(progressSummary.overallProgress)}%</div>
                            <Progress value={progressSummary.overallProgress} className="h-2" />
                            <div className="text-xs text-muted-foreground">
                              {progressSummary.completedModules}/{progressSummary.totalModules} modules completed
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="text-sm text-muted-foreground">Average Score</div>
                            <div className="text-2xl font-bold">
                              {ProgressionService.formatScore(progressSummary.averageScore)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              From completed modules
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="text-sm text-muted-foreground">Next Module</div>
                            <div className="text-lg font-medium">
                              {nextModule ? nextModule.module.title : 'All modules unlocked'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {nextModule ? 'Available to unlock' : 'Course progression complete'}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {selectedCourse.modules?.map((moduleData, index) => (
                  <ModuleCard
                    key={moduleData.module.id}
                    moduleData={moduleData}
                    isLocked={moduleData.progress.status === 'locked'}
                    onRetake={handleRetakeModule}
                    onContinue={handleContinueModule}
                  />
                ))}
              </div>
            </div>

            {/* Module Progression Guide */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Target className="h-5 w-5" />
                  <span>Progression Requirements</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Score Breakdown (80% required to proceed):</h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Course Contribution: 10% (lesson completion, participation)</li>
                      <li>• Quizzes: 30% (knowledge checks throughout module)</li>
                      <li>• Assignments: 40% (hands-on projects and exercises)</li>
                      <li>• Final Assessment: 20% (comprehensive module evaluation)</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Retake Policy:</h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Maximum 3 attempts per module</li>
                      <li>• Failed attempts reset all module content</li>
                      <li>• Final failure results in course suspension</li>
                      <li>• 30-day appeal window for suspensions</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Course List View */
          <>
            {/* Stats Overview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
            >
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 rounded-lg dark:bg-blue-900">
                      <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Enrolled Courses</p>
                      <p className="text-2xl font-bold">{courses.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-green-100 rounded-lg dark:bg-green-900">
                      <Award className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Completed</p>
                      <p className="text-2xl font-bold">{completedCourses}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-orange-100 rounded-lg dark:bg-orange-900">
                      <TrendingUp className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">In Progress</p>
                      <p className="text-2xl font-bold">{inProgressCourses}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-purple-100 rounded-lg dark:bg-purple-900">
                      <Target className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Overall Progress</p>
                      <p className="text-2xl font-bold">{Math.round(totalProgress)}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Filters and Search */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col md:flex-row gap-4 mb-6"
            >
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search courses..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="flex space-x-2">
                <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
                  <SelectTrigger className="w-40">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Courses</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Recent</SelectItem>
                    <SelectItem value="progress">Progress</SelectItem>
                    <SelectItem value="title">Title</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex border rounded-lg">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="rounded-r-none"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className="rounded-l-none"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>

            {/* Courses Grid/List */}
            {filteredAndSortedCourses.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-center py-12"
              >
                <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No courses found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery ? 'Try adjusting your search terms' : 'Start your learning journey by enrolling in a course'}
                </p>
                <Button asChild>
                  <Link href="/student/courses">Browse Courses</Link>
                </Button>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className={
                  viewMode === 'grid'
                    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                    : 'space-y-4'
                }
              >
                {filteredAndSortedCourses.map((course, index) => (
                  <motion.div
                    key={course.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * index }}
                  >
                    {viewMode === 'grid' ? (
                      <Card className="hover:shadow-lg transition-shadow duration-200 cursor-pointer group">
                        <div className="aspect-video bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 rounded-t-lg flex items-center justify-center">
                          {course.thumbnail_url ? (
                            <img
                              src={course.thumbnail_url}
                              alt={course.title}
                              className="w-full h-full object-cover rounded-t-lg"
                            />
                          ) : (
                            <BookOpen className="h-12 w-12 text-muted-foreground" />
                          )}
                        </div>
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-3">
                            <Badge variant="secondary" className={getDifficultyColor(course.difficulty)}>
                              {course.difficulty}
                            </Badge>
                            <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                              <span>{course.rating}</span>
                            </div>
                          </div>
                          
                          <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">
                            {course.title}
                          </h3>
                          
                          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                            {course.description}
                          </p>
                          
                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Progress</span>
                              <span className="font-medium">{Math.round(course.progress)}%</span>
                            </div>
                            <Progress value={course.progress} className="h-2" />
                            
                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                              <span>{course.completed_lessons}/{course.total_lessons} lessons</span>
                              <span>Last: {getLastAccessedText(course.last_accessed)}</span>
                            </div>
                            
                            {course.current_lesson && (
                              <div className="pt-2 border-t">
                                <p className="text-sm font-medium mb-1">Continue with:</p>
                                <p className="text-sm text-muted-foreground">{course.current_lesson.title}</p>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex space-x-2 mt-4">
                            <Button 
                              onClick={() => handleViewModules(course)}
                              className="flex-1"
                            >
                              <Target className="h-4 w-4 mr-2" />
                              View Modules
                            </Button>
                            <Button asChild variant="outline">
                              <Link href={`/student/learn/${course.id}`}>
                                <Play className="h-4 w-4" />
                              </Link>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <Card className="hover:shadow-md transition-shadow duration-200">
                        <CardContent className="p-6">
                          <div className="flex items-center space-x-4">
                            <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 rounded-lg flex items-center justify-center flex-shrink-0">
                              {course.thumbnail_url ? (
                                <img
                                  src={course.thumbnail_url}
                                  alt={course.title}
                                  className="w-full h-full object-cover rounded-lg"
                                />
                              ) : (
                                <BookOpen className="h-8 w-8 text-muted-foreground" />
                              )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <h3 className="font-semibold text-lg mb-1">{course.title}</h3>
                                  <p className="text-sm text-muted-foreground">by {course.instructor_name}</p>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Badge variant="secondary" className={getDifficultyColor(course.difficulty)}>
                                    {course.difficulty}
                                  </Badge>
                                  <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                    <span>{course.rating}</span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center space-x-6 mb-3">
                                <div className="flex items-center space-x-2">
                                  <Progress value={course.progress} className="w-32 h-2" />
                                  <span className="text-sm font-medium">{Math.round(course.progress)}%</span>
                                </div>
                                <span className="text-sm text-muted-foreground">
                                  {course.completed_lessons}/{course.total_lessons} lessons
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  Last: {getLastAccessedText(course.last_accessed)}
                                </span>
                              </div>
                              
                              {course.current_lesson && (
                                <p className="text-sm text-muted-foreground mb-3">
                                  Next: {course.current_lesson.title}
                                </p>
                              )}
                            </div>
                            
                            <div className="flex space-x-2">
                              <Button 
                                onClick={() => handleViewModules(course)}
                              >
                                <Target className="h-4 w-4 mr-2" />
                                Modules
                              </Button>
                              <Button asChild variant="outline">
                                <Link href={`/student/learn/${course.id}`}>
                                  <Play className="h-4 w-4" />
                                </Link>
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </motion.div>
                ))}
              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default LearningDashboard;