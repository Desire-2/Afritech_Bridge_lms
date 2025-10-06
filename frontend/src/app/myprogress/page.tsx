'use client';'use client';



import React, { useState, useEffect } from 'react';import React, { useState, useEffect } from 'react';

import Link from 'next/link';import Link from 'next/link';

import { BarChart3, TrendingUp, Target, Clock, BookOpen, Award, Trophy, Calendar } from 'lucide-react';import { BarChart3, TrendingUp, Target, Clock, BookOpen, Award, Trophy, Calendar } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Progress } from '@/components/ui/progress';import { Progress } from '@/components/ui/progress';

import { Badge } from '@/components/ui/badge';import { Badge } from '@/components/ui/badge';

import { StudentService, EnrolledCourse } from '@/services/student.service';import { StudentService, EnrolledCourse } from '@/services/student.service';



interface ProgressData {interface ProgressData {

  overallStats: {  overallStats: {

    totalHours: number;    totalHours: number;

    coursesCompleted: number;    coursesCompleted: number;

    averageScore: number;    averageScore: number;

    currentStreak: number;    currentStreak: number;

  };  };

  courseProgress: Array<{  courseProgress: Array<{

    id: number;    id: number;

    title: string;    title: string;

    progress: number;    progress: number;

    totalLessons: number;    totalLessons: number;

    completedLessons: number;    completedLessons: number;

  }>;  }>;

  skillProgress: Array<{  skillProgress: Array<{

    skill: string;    skill: string;

    level: number;    level: number;

    progress: number;    progress: number;

  }>;  }>;

}}



const MyProgressPage = () => {const MyProgressPage = () => {

  const [courses, setCourses] = useState<EnrolledCourse[]>([]);  const [courses, setCourses] = useState<EnrolledCourse[]>([]);

  const [loading, setLoading] = useState(true);  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState({  const [stats, setStats] = useState({

    total_courses: 0,    total_courses: 0,

    completed_courses: 0,    completed_courses: 0,

    hours_spent: 0,    hours_spent: 0,

    achievements: 0    achievements: 0

  });  });



  useEffect(() => {  useEffect(() => {

    const fetchData = async () => {    const fetchData = async () => {

      try {      try {

        setLoading(true);        setLoading(true);

        const [coursesData, dashboardData] = await Promise.all([        const [coursesData, dashboardData] = await Promise.all([

          StudentService.getMyLearning(),          StudentService.getMyLearning(),

          StudentService.getDashboard()          StudentService.getDashboard()

        ]);        ]);



        setCourses(coursesData.courses || []);        setCourses(coursesData.courses || []);

        setStats(dashboardData.stats || stats);        setStats(dashboardData.stats || stats);

      } catch (err: any) {      } catch (err: any) {

        console.error('Error fetching progress data:', err);        console.error('Error fetching progress data:', err);

        setError('Failed to load progress data');        setError('Failed to load progress data');

      } finally {      } finally {

        setLoading(false);        setLoading(false);

      }      }

    };    };



    fetchData();    fetchData();

  }, []);  }, []);



  const calculateOverallProgress = () => {  const calculateOverallProgress = () => {

    if (courses.length === 0) return 0;    if (courses.length === 0) return 0;

    const totalProgress = courses.reduce((sum, course) => sum + course.progress, 0);    const totalProgress = courses.reduce((sum, course) => sum + course.progress, 0);

    return Math.round(totalProgress / courses.length);    return Math.round(totalProgress / courses.length);

  };  };



  if (loading) {  if (loading) {

    return (    return (

      <div className="container mx-auto px-4 py-8">      <div className="container mx-auto px-4 py-8">

        <div className="flex items-center justify-center min-h-[400px]">        <div className="flex items-center justify-center min-h-[400px]">

          <div className="text-center">          <div className="text-center">

            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>

            <p className="text-muted-foreground">Loading your progress...</p>            <p className="text-muted-foreground">Loading your progress...</p>

          </div>          </div>

        </div>        </div>

      </div>      </div>

    );    );

  }  }



  if (error) {  if (error) {

    return (    return (

      <div className="container mx-auto px-4 py-8">      <div className="container mx-auto px-4 py-8">

        <div className="text-center">        <div className="text-center">

          <h1 className="text-2xl font-bold mb-4 text-red-600">Error</h1>          <h1 className="text-2xl font-bold mb-4 text-red-600">Error</h1>

          <p className="text-muted-foreground">{error}</p>          <p className="text-muted-foreground">{error}</p>

        </div>        </div>

      </div>      </div>

    );    );

  }  }



  return (  return (

    <div className="container mx-auto px-4 py-8">    <div className="container mx-auto px-4 py-8">

      {/* Header */}      {/* Header */}

      <div className="mb-8">      <div className="mb-8">

        <h1 className="text-3xl font-bold mb-2">My Progress</h1>        <h1 className="text-3xl font-bold mb-2">My Progress</h1>

        <p className="text-muted-foreground">        <p className="text-muted-foreground">

          Track your learning journey and achievements          Track your learning journey and achievements

        </p>        </p>

      </div>      </div>



      {/* Stats Overview */}      {/* Stats Overview */}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">

        <Card>        <Card>

          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">

            <CardTitle className="text-sm font-medium">Total Courses</CardTitle>            <CardTitle className="text-sm font-medium">Total Courses</CardTitle>

            <BookOpen className="h-4 w-4 text-muted-foreground" />            <BookOpen className="h-4 w-4 text-muted-foreground" />

          </CardHeader>          </CardHeader>

          <CardContent>          <CardContent>

            <div className="text-2xl font-bold">{stats.total_courses}</div>            <div className="text-2xl font-bold">{stats.total_courses}</div>

            <p className="text-xs text-muted-foreground">            <p className="text-xs text-muted-foreground">

              Enrolled courses              Enrolled courses

            </p>            </p>

          </CardContent>          </CardContent>

        </Card>        </Card>



        <Card>        <Card>

          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">

            <CardTitle className="text-sm font-medium">Completed</CardTitle>            <CardTitle className="text-sm font-medium">Completed</CardTitle>

            <Award className="h-4 w-4 text-muted-foreground" />            <Award className="h-4 w-4 text-muted-foreground" />

          </CardHeader>          </CardHeader>

          <CardContent>          <CardContent>

            <div className="text-2xl font-bold">{stats.completed_courses}</div>            <div className="text-2xl font-bold">{stats.completed_courses}</div>

            <p className="text-xs text-muted-foreground">            <p className="text-xs text-muted-foreground">

              Courses finished              Courses finished

            </p>            </p>

          </CardContent>          </CardContent>

        </Card>        </Card>



        <Card>        <Card>

          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">

            <CardTitle className="text-sm font-medium">Study Hours</CardTitle>            <CardTitle className="text-sm font-medium">Study Hours</CardTitle>

            <Clock className="h-4 w-4 text-muted-foreground" />            <Clock className="h-4 w-4 text-muted-foreground" />

          </CardHeader>          </CardHeader>

          <CardContent>          <CardContent>

            <div className="text-2xl font-bold">{stats.hours_spent}</div>            <div className="text-2xl font-bold">{stats.hours_spent}</div>

            <p className="text-xs text-muted-foreground">            <p className="text-xs text-muted-foreground">

              Hours invested              Hours invested

            </p>            </p>

          </CardContent>          </CardContent>

        </Card>        </Card>



        <Card>        <Card>

          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">

            <CardTitle className="text-sm font-medium">Achievements</CardTitle>            <CardTitle className="text-sm font-medium">Achievements</CardTitle>

            <Trophy className="h-4 w-4 text-muted-foreground" />            <Trophy className="h-4 w-4 text-muted-foreground" />

          </CardHeader>          </CardHeader>

          <CardContent>          <CardContent>

            <div className="text-2xl font-bold">{stats.achievements}</div>            <div className="text-2xl font-bold">{stats.achievements}</div>

            <p className="text-xs text-muted-foreground">            <p className="text-xs text-muted-foreground">

              Badges earned              Badges earned

            </p>            </p>

          </CardContent>          </CardContent>

        </Card>        </Card>

      </div>      </div>



      {/* Overall Progress Chart */}      {/* Overall Progress Chart */}

      <Card className="mb-8">      <Card className="mb-8">

        <CardHeader>        <CardHeader>

          <CardTitle className="flex items-center space-x-2">          <CardTitle className="flex items-center space-x-2">

            <BarChart3 className="h-5 w-5" />            <BarChart3 className="h-5 w-5" />

            <span>Overall Progress</span>            <span>Overall Progress</span>

          </CardTitle>          </CardTitle>

        </CardHeader>        </CardHeader>

        <CardContent>        <CardContent>

          <div className="space-y-4">          <div className="space-y-4">

            <div className="flex items-center justify-between">            <div className="flex items-center justify-between">

              <span className="text-sm font-medium">Course Completion</span>              <span className="text-sm font-medium">Course Completion</span>

              <span className="text-sm text-muted-foreground">              <span className="text-sm text-muted-foreground">

                {calculateOverallProgress()}%                {calculateOverallProgress()}%

              </span>              </span>

            </div>            </div>

            <Progress value={calculateOverallProgress()} className="h-2" />            <Progress value={calculateOverallProgress()} className="h-2" />

            <p className="text-xs text-muted-foreground">            <p className="text-xs text-muted-foreground">

              Average progress across all enrolled courses              Average progress across all enrolled courses

            </p>            </p>

          </div>          </div>

        </CardContent>        </CardContent>

      </Card>      </Card>



      {/* Course Progress List */}      {/* Course Progress List */}

      <Card>      <Card>

        <CardHeader>        <CardHeader>

          <CardTitle className="flex items-center space-x-2">          <CardTitle className="flex items-center space-x-2">

            <Target className="h-5 w-5" />            <Target className="h-5 w-5" />

            <span>Course Progress</span>            <span>Course Progress</span>

          </CardTitle>          </CardTitle>

        </CardHeader>        </CardHeader>

        <CardContent>        <CardContent>

          <div className="space-y-4">          <div className="space-y-4">

            {courses.length === 0 ? (            {courses.length === 0 ? (

              <div className="text-center py-8">              <div className="text-center py-8">

                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />

                <h3 className="text-lg font-semibold mb-2">No courses enrolled</h3>                <h3 className="text-lg font-semibold mb-2">No courses enrolled</h3>

                <p className="text-muted-foreground mb-4">                <p className="text-muted-foreground mb-4">

                  Start your learning journey by enrolling in a course                  Start your learning journey by enrolling in a course

                </p>                </p>

                <Link                 <Link 

                  href="/student/courses"                  href="/student/courses"

                  className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"                  className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"

                >                >

                  Browse Courses                  Browse Courses

                </Link>                </Link>

              </div>              </div>

            ) : (            ) : (

              courses.map((course) => (              courses.map((course) => (

                <div key={course.id} className="flex items-center space-x-4 p-4 rounded-lg border">                <div key={course.id} className="flex items-center space-x-4 p-4 rounded-lg border">

                  <div className="flex-1 min-w-0">                  <div className="flex-1 min-w-0">

                    <h4 className="text-sm font-medium mb-1">{course.title}</h4>                    <h4 className="text-sm font-medium mb-1">{course.title}</h4>

                    <div className="flex items-center space-x-4 mb-2">                    <div className="flex items-center space-x-4 mb-2">

                      <div className="flex items-center space-x-2">                      <div className="flex items-center space-x-2">

                        <Progress value={course.progress} className="w-24 h-2" />                        <Progress value={course.progress} className="w-24 h-2" />

                        <span className="text-sm text-muted-foreground">                        <span className="text-sm text-muted-foreground">

                          {Math.round(course.progress)}%                          {Math.round(course.progress)}%

                        </span>                        </span>

                      </div>                      </div>

                      <span className="text-xs text-muted-foreground">                      <span className="text-xs text-muted-foreground">

                        {course.completed_lessons || 0}/{course.total_lessons || 0} lessons                        {course.completed_lessons || 0}/{course.total_lessons || 0} lessons

                      </span>                      </span>

                    </div>                    </div>

                    <div className="flex items-center space-x-2">                    <div className="flex items-center space-x-2">

                      <Badge                       <Badge 

                        variant={course.progress === 100 ? "default" : "secondary"}                        variant={course.progress === 100 ? "default" : "secondary"}

                        className="text-xs"                        className="text-xs"

                      >                      >

                        {course.progress === 100 ? "Completed" : "In Progress"}                        {course.progress === 100 ? "Completed" : "In Progress"}

                      </Badge>                      </Badge>

                      {course.difficulty && (                      {course.difficulty && (

                        <Badge variant="outline" className="text-xs">                        <Badge variant="outline" className="text-xs">

                          {course.difficulty}                          {course.difficulty}

                        </Badge>                        </Badge>

                      )}                      )}

                    </div>                    </div>

                  </div>                  </div>

                  <div className="flex space-x-2">                  <div className="flex space-x-2">

                    <Link                    <Link

                      href={`/student/learning/${course.id}`}                      href={`/student/learning/${course.id}`}

                      className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"                      className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"

                    >                    >

                      Continue                      Continue

                    </Link>                    </Link>

                  </div>                  </div>

                </div>                </div>

              ))              ))

            )}            )}

          </div>          </div>

        </CardContent>        </CardContent>

      </Card>      </Card>

    </div>    </div>

  );  );

};};



export default MyProgressPage;export default MyProgressPage;

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { BarChart3, TrendingUp, Target, Clock, BookOpen, Award, Trophy, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { StudentService, EnrolledCourse } from '@/services/student.service';

interface ProgressData {

  overallStats: {

    totalHours: number;const MyProgressPage = () => {

    coursesCompleted: number;  const [courses, setCourses] = useState<EnrolledCourse[]>([]);

    averageScore: number;  const [loading, setLoading] = useState(true);

    currentStreak: number;  const [error, setError] = useState<string | null>(null);

  };  const [stats, setStats] = useState({

  courseProgress: Array<{    total_courses: 0,

    id: number;    completed_courses: 0,

    title: string;    hours_spent: 0,

    progress: number;    achievements: 0

    totalLessons: number;  });

    completedLessons: number;

  }>;  useEffect(() => {

  skillProgress: Array<{    const fetchData = async () => {

    skill: string;      try {

    level: number;        setLoading(true);

    progress: number;        const [coursesData, dashboardData] = await Promise.all([

  }>;          StudentService.getMyLearning(),

}          StudentService.getDashboard()

        ]);

export default function MyProgressPage() {        setCourses(coursesData);

  const [loading, setLoading] = useState(true);        setStats(dashboardData.stats);

  const [progressData, setProgressData] = useState<ProgressData | null>(null);      } catch (err: any) {

        setError(err.message || 'Failed to load progress data');

  useEffect(() => {      } finally {

    // Simulate loading and fetch progress data        setLoading(false);

    setTimeout(() => {      }

      setProgressData({    };

        overallStats: {

          totalHours: 45,    fetchData();

          coursesCompleted: 3,  }, []);

          averageScore: 87,

          currentStreak: 7  const calculateStreakData = () => {

        },    // Mock streak calculation - in real app, this would come from backend

        courseProgress: [    const currentStreak = 7;

          {    const longestStreak = 14;

            id: 1,    return { currentStreak, longestStreak };

            title: "React Fundamentals",  };

            progress: 85,

            totalLessons: 12,  const { currentStreak, longestStreak } = calculateStreakData();

            completedLessons: 10

          },  if (loading) {

          {    return (

            id: 2,      <div className="container mx-auto p-6">

            title: "JavaScript Advanced",        <div className="animate-pulse">

            progress: 60,          <div className="h-8 bg-gray-200 rounded w-1/3 mb-8"></div>

            totalLessons: 15,          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">

            completedLessons: 9            {[1, 2, 3, 4].map((_, i) => (

          },              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>

          {            ))}

            id: 3,          </div>

            title: "Node.js Basics",          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            progress: 30,            {[1, 2].map((_, i) => (

            totalLessons: 20,              <div key={i} className="h-96 bg-gray-200 rounded-lg"></div>

            completedLessons: 6            ))}

          }          </div>

        ],        </div>

        skillProgress: [      </div>

          { skill: "React", level: 4, progress: 75 },    );

          { skill: "JavaScript", level: 3, progress: 60 },  }

          { skill: "CSS", level: 3, progress: 80 },

          { skill: "Node.js", level: 2, progress: 40 }  if (error) {

        ]    return (

      });      <div className="container mx-auto p-6">

      setLoading(false);        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">

    }, 1000);          <p className="text-red-600 text-lg">{error}</p>

  }, []);          <button 

            onClick={() => window.location.reload()} 

  if (loading) {            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"

    return (          >

      <div className="min-h-screen bg-gray-50 flex items-center justify-center">            Try Again

        <div className="text-center">          </button>

          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>        </div>

          <p className="text-gray-600">Loading your progress...</p>      </div>

        </div>    );

      </div>  }

    );

  }  return (

    <div className="container mx-auto p-6">

  return (      {/* Header */}

    <div className="min-h-screen bg-gray-50 p-6">      <div className="mb-8">

      <div className="max-w-7xl mx-auto">        <h1 className="text-3xl font-bold text-gray-800 mb-2">My Progress</h1>

        <div className="mb-8">        <p className="text-gray-600">Track your learning journey and achievements</p>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Progress</h1>      </div>

          <p className="text-gray-600">Track your learning journey and skill development</p>

        </div>      {/* Key Statistics */}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">

        {/* Overall Stats Cards */}        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-xl text-white">

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">          <div className="flex items-center justify-between">

          <div className="bg-white p-6 rounded-lg shadow-md">            <div>

            <div className="flex items-center">              <p className="text-blue-100 text-sm">Total Courses</p>

              <div className="p-3 rounded-full bg-blue-100">              <p className="text-3xl font-bold">{stats.total_courses}</p>

                <Clock className="h-6 w-6 text-blue-600" />            </div>

              </div>            <BookOpen className="w-10 h-10 text-blue-200" />

              <div className="ml-4">          </div>

                <p className="text-sm font-medium text-gray-600">Total Hours</p>        </div>

                <p className="text-2xl font-bold text-gray-900">{progressData?.overallStats.totalHours}</p>

              </div>        <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-xl text-white">

            </div>          <div className="flex items-center justify-between">

          </div>            <div>

              <p className="text-green-100 text-sm">Completed</p>

          <div className="bg-white p-6 rounded-lg shadow-md">              <p className="text-3xl font-bold">{stats.completed_courses}</p>

            <div className="flex items-center">            </div>

              <div className="p-3 rounded-full bg-green-100">            <Trophy className="w-10 h-10 text-green-200" />

                <BookOpen className="h-6 w-6 text-green-600" />          </div>

              </div>        </div>

              <div className="ml-4">

                <p className="text-sm font-medium text-gray-600">Courses Completed</p>        <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-xl text-white">

                <p className="text-2xl font-bold text-gray-900">{progressData?.overallStats.coursesCompleted}</p>          <div className="flex items-center justify-between">

              </div>            <div>

            </div>              <p className="text-purple-100 text-sm">Hours Studied</p>

          </div>              <p className="text-3xl font-bold">{stats.hours_spent}</p>

            </div>

          <div className="bg-white p-6 rounded-lg shadow-md">            <Clock className="w-10 h-10 text-purple-200" />

            <div className="flex items-center">          </div>

              <div className="p-3 rounded-full bg-yellow-100">        </div>

                <Target className="h-6 w-6 text-yellow-600" />

              </div>        <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-6 rounded-xl text-white">

              <div className="ml-4">          <div className="flex items-center justify-between">

                <p className="text-sm font-medium text-gray-600">Average Score</p>            <div>

                <p className="text-2xl font-bold text-gray-900">{progressData?.overallStats.averageScore}%</p>              <p className="text-amber-100 text-sm">Achievements</p>

              </div>              <p className="text-3xl font-bold">{stats.achievements}</p>

            </div>            </div>

          </div>            <BarChart3 className="w-10 h-10 text-amber-200" />

          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">        </div>

            <div className="flex items-center">      </div>

              <div className="p-3 rounded-full bg-purple-100">

                <TrendingUp className="h-6 w-6 text-purple-600" />      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

              </div>        {/* Course Progress Overview */}

              <div className="ml-4">        <div className="bg-white rounded-xl shadow-sm border p-6">

                <p className="text-sm font-medium text-gray-600">Current Streak</p>          <h2 className="text-xl font-semibold text-gray-800 mb-6">Course Progress Overview</h2>

                <p className="text-2xl font-bold text-gray-900">{progressData?.overallStats.currentStreak} days</p>          

              </div>          {courses.length === 0 ? (

            </div>            <div className="text-center py-8">

          </div>              <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />

        </div>              <p className="text-gray-600">No courses enrolled yet</p>

              <Link 

        {/* Course Progress and Skills */}                href="/courses"

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">                className="inline-block mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"

          {/* Course Progress Section */}              >

          <div className="bg-white p-6 rounded-lg shadow-md">                Browse Courses

            <h2 className="text-xl font-semibold text-gray-900 mb-4">Course Progress</h2>              </Link>

            <div className="space-y-4">            </div>

              {progressData?.courseProgress.map((course) => (          ) : (

                <div key={course.id} className="border-b border-gray-200 pb-4 last:border-b-0">            <div className="space-y-4">

                  <div className="flex justify-between items-center mb-2">              {courses.slice(0, 5).map((course) => (

                    <h3 className="font-medium text-gray-900">{course.title}</h3>                <div key={course.id} className="border rounded-lg p-4">

                    <span className="text-sm text-gray-500">{course.progress}%</span>                  <div className="flex items-center justify-between mb-2">

                  </div>                    <h3 className="font-medium text-gray-800 truncate">{course.title}</h3>

                  <div className="w-full bg-gray-200 rounded-full h-2">                    <span className="text-sm font-medium text-gray-600">

                    <div                      {Math.round(course.progress)}%

                      className="bg-blue-600 h-2 rounded-full"                    </span>

                      style={{ width: `${course.progress}%` }}                  </div>

                    ></div>                  

                  </div>                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">

                  <p className="text-sm text-gray-500 mt-1">                    <div 

                    {course.completedLessons} of {course.totalLessons} lessons completed                      className="bg-gradient-to-r from-indigo-500 to-blue-500 h-2 rounded-full transition-all duration-300"

                  </p>                      style={{ width: `${course.progress}%` }}

                </div>                    ></div>

              ))}                  </div>

            </div>                  

          </div>                  <div className="flex justify-between text-xs text-gray-500">

                    <span>Instructor: {course.instructor_name}</span>

          {/* Skill Progress Section */}                    <span>Enrolled: {new Date(course.enrollment_date).toLocaleDateString()}</span>

          <div className="bg-white p-6 rounded-lg shadow-md">                  </div>

            <h2 className="text-xl font-semibold text-gray-900 mb-4">Skill Progress</h2>                  

            <div className="space-y-4">                  <div className="mt-3 flex gap-2">

              {progressData?.skillProgress.map((skill, index) => (                    <Link

                <div key={index} className="border-b border-gray-200 pb-4 last:border-b-0">                      href={`/learn/${course.id}`}

                  <div className="flex justify-between items-center mb-2">                      className="text-xs px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full hover:bg-indigo-200"

                    <div className="flex items-center">                    >

                      <h3 className="font-medium text-gray-900">{skill.skill}</h3>                      Continue Learning

                      <div className="ml-2 flex">                    </Link>

                        {[...Array(5)].map((_, i) => (                    <Link

                          <Award                      href={`/myprogress/${course.id}`}

                            key={i}                      className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200"

                            className={`h-4 w-4 ${                    >

                              i < skill.level ? 'text-yellow-500' : 'text-gray-300'                      View Details

                            }`}                    </Link>

                            fill="currentColor"                  </div>

                          />                </div>

                        ))}              ))}

                      </div>              

                    </div>              {courses.length > 5 && (

                    <span className="text-sm text-gray-500">{skill.progress}%</span>                <Link 

                  </div>                  href="/mylearning"

                  <div className="w-full bg-gray-200 rounded-full h-2">                  className="block text-center py-2 text-indigo-600 hover:text-indigo-700 font-medium"

                    <div                >

                      className="bg-green-600 h-2 rounded-full"                  View All Courses ({courses.length})

                      style={{ width: `${skill.progress}%` }}                </Link>

                    ></div>              )}

                  </div>            </div>

                </div>          )}

              ))}        </div>

            </div>

          </div>        {/* Learning Insights */}

        </div>        <div className="bg-white rounded-xl shadow-sm border p-6">

          <h2 className="text-xl font-semibold text-gray-800 mb-6">Learning Insights</h2>

        {/* Activity Chart Placeholder */}          

        <div className="mt-8 bg-white p-6 rounded-lg shadow-md">          <div className="space-y-6">

          <h2 className="text-xl font-semibold text-gray-900 mb-4">Learning Activity</h2>            {/* Learning Streak */}

          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">            <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-lg p-4">

            <div className="text-center">              <div className="flex items-center gap-3 mb-3">

              <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-2" />                <div className="p-2 bg-orange-100 rounded-lg">

              <p className="text-gray-500">Activity chart will be displayed here</p>                  <TrendingUp className="w-5 h-5 text-orange-600" />

            </div>                </div>

          </div>                <div>

        </div>                  <h3 className="font-medium text-gray-800">Learning Streak</h3>

      </div>                  <p className="text-sm text-gray-600">Keep up the momentum!</p>

    </div>                </div>

  );              </div>

}              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-2xl font-bold text-orange-600">{currentStreak}</p>
                  <p className="text-xs text-gray-600">Current Streak (days)</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800">{longestStreak}</p>
                  <p className="text-xs text-gray-600">Longest Streak (days)</p>
                </div>
              </div>
            </div>

            {/* Completion Rate */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Trophy className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-800">Completion Rate</h3>
                  <p className="text-sm text-gray-600">Course completion success</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Completion Rate</span>
                    <span className="font-medium">
                      {stats.total_courses > 0 
                        ? Math.round((stats.completed_courses / stats.total_courses) * 100)
                        : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full"
                      style={{ 
                        width: `${stats.total_courses > 0 
                          ? (stats.completed_courses / stats.total_courses) * 100 
                          : 0}%` 
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Weekly Goal */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-800">Weekly Goal</h3>
                  <p className="text-sm text-gray-600">Study time target</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span>5 hours/week</span>
                    <span className="font-medium">3.5/5 hours</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: '70%' }}
                    ></div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                1.5 hours remaining to reach your weekly goal
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 bg-gray-50 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/mylearning"
            className="flex items-center gap-3 p-4 bg-white rounded-lg border hover:shadow-md transition-shadow"
          >
            <BookOpen className="w-8 h-8 text-indigo-600" />
            <div>
              <p className="font-medium text-gray-800">Continue Learning</p>
              <p className="text-sm text-gray-600">Resume your courses</p>
            </div>
          </Link>
          
          <Link
            href="/courses"
            className="flex items-center gap-3 p-4 bg-white rounded-lg border hover:shadow-md transition-shadow"
          >
            <TrendingUp className="w-8 h-8 text-green-600" />
            <div>
              <p className="font-medium text-gray-800">Explore Courses</p>
              <p className="text-sm text-gray-600">Find new learning paths</p>
            </div>
          </Link>
          
          <Link
            href="/dashboard/profile"
            className="flex items-center gap-3 p-4 bg-white rounded-lg border hover:shadow-md transition-shadow"
          >
            <Trophy className="w-8 h-8 text-amber-600" />
            <div>
              <p className="font-medium text-gray-800">View Achievements</p>
              <p className="text-sm text-gray-600">See your badges</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default MyProgressPage;