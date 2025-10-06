"use client";

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  BookOpen, 
  Trophy, 
  Clock, 
  TrendingUp, 
  Target,
  Calendar,
  Award,
  BarChart3,
  Users,
  Star,
  Flame,
  ChevronRight,
  PlayCircle,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StudentApiService, DashboardData } from '@/services/studentApi';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.5
    }
  }
};

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  trend?: string;
  description?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, trend, description }) => (
  <motion.div variants={itemVariants}>
    <Card className="hover:shadow-lg transition-shadow duration-300">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-3xl font-bold mt-2">{value}</p>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
            {trend && (
              <div className="flex items-center mt-2">
                <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-sm text-green-500 font-medium">{trend}</span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-full ${color}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  </motion.div>
);

interface CourseCardProps {
  course: any;
  progress: number;
  lastAccessed: string;
}

const CourseCard: React.FC<CourseCardProps> = ({ course, progress, lastAccessed }) => (
  <motion.div variants={itemVariants}>
    <Card className="hover:shadow-lg transition-all duration-300 hover:scale-105">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-2 line-clamp-2">{course.title}</h3>
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{course.description}</p>
            <div className="flex items-center text-sm text-muted-foreground mb-3">
              <Users className="h-4 w-4 mr-1" />
              {course.instructor_name}
            </div>
          </div>
        </div>
        
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Progress</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Last accessed: {new Date(lastAccessed).toLocaleDateString()}
            </div>
            <Link href={`/student/courses/${course.id}`}>
              <Button size="sm" className="ml-auto">
                Continue
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  </motion.div>
);

interface ActivityItemProps {
  activity: any;
}

const ActivityItem: React.FC<ActivityItemProps> = ({ activity }) => {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'lesson_completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'quiz_completed':
        return <Trophy className="h-4 w-4 text-yellow-500" />;
      case 'assignment_submitted':
        return <BookOpen className="h-4 w-4 text-blue-500" />;
      case 'course_enrolled':
        return <PlayCircle className="h-4 w-4 text-purple-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <motion.div 
      variants={itemVariants}
      className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
    >
      <div className="mt-0.5">
        {getActivityIcon(activity.type)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{activity.description}</p>
        {activity.course_title && (
          <p className="text-xs text-muted-foreground">{activity.course_title}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {new Date(activity.timestamp).toLocaleString()}
        </p>
      </div>
    </motion.div>
  );
};

const StudentDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setError(null);
        const data = await StudentApiService.getDashboard();
        setDashboardData(data);
      } catch (error: any) {
        console.error('Failed to fetch dashboard data:', error);
        if (error.response?.status === 401 || error.response?.status === 422) {
          setError('Authentication expired. Please login again.');
        } else if (error.response?.status === 400) {
          setError('Bad request. Please check your data.');
        } else {
          setError('Failed to load dashboard data. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-lg font-semibold mb-2">Unable to load dashboard</p>
          <p className="text-muted-foreground mb-4">
            {error || 'Failed to load dashboard data'}
          </p>
          <Button 
            onClick={() => window.location.reload()}
            className="mr-2"
          >
            Try Again
          </Button>
          <Button 
            variant="outline"
            onClick={() => window.location.href = '/auth/login'}
          >
            Login Again
          </Button>
        </div>
      </div>
    );
  }

  const { 
    overview, 
    my_learning, 
    recent_activity, 
    achievements, 
    upcoming_tasks,
    performance_insights,
    learning_recommendations
  } = dashboardData;

  return (
    <motion.div 
      className="space-y-8 p-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Welcome Section */}
      <motion.div variants={itemVariants} className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Welcome back, {user?.first_name}! 👋
            </h1>
            <p className="text-muted-foreground mt-2">
              Ready to continue your learning journey?
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Flame className="h-6 w-6 text-orange-500" />
            <span className="text-xl font-bold">{overview.learning_streak}</span>
            <span className="text-sm text-muted-foreground">day streak</span>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div 
        variants={containerVariants}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        <StatCard
          title="Total Courses"
          value={overview.total_courses}
          icon={<BookOpen className="h-6 w-6 text-white" />}
          color="bg-blue-500"
          description="Currently enrolled"
        />
        <StatCard
          title="Completed Courses"
          value={overview.completed_courses}
          icon={<Trophy className="h-6 w-6 text-white" />}
          color="bg-green-500"
          description="Successfully finished"
        />
        <StatCard
          title="Certificates Earned"
          value={overview.certificates_earned}
          icon={<Award className="h-6 w-6 text-white" />}
          color="bg-purple-500"
          description="Verified achievements"
        />
        <StatCard
          title="Learning Time"
          value={`${Math.round(overview.total_learning_hours)}h`}
          icon={<Clock className="h-6 w-6 text-white" />}
          color="bg-orange-500"
          description="Total time invested"
        />
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Courses */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <BookOpen className="h-5 w-5 mr-2" />
                  Continue Learning
                </CardTitle>
                <Link href="/student/learning">
                  <Button variant="outline" size="sm">
                    View All
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <motion.div 
                variants={containerVariants}
                className="space-y-4"
              >
                {my_learning.active_courses.slice(0, 3).map((courseData: any) => (
                  <CourseCard
                    key={courseData.course.id}
                    course={courseData.course}
                    progress={courseData.progress_percentage || 0}
                    lastAccessed={courseData.last_accessed || new Date().toISOString()}
                  />
                ))}
              </motion.div>
              {my_learning.active_courses.length === 0 && (
                <div className="text-center py-12">
                  <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No active courses</h3>
                  <p className="text-muted-foreground mb-4">
                    Start your learning journey by enrolling in a course
                  </p>
                  <Link href="/student/courses">
                    <Button>Browse Courses</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Sidebar Content */}
        <motion.div variants={itemVariants} className="space-y-6">
          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="h-5 w-5 mr-2" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <motion.div variants={containerVariants} className="space-y-2">
                {recent_activity.slice(0, 5).map((activity, index) => (
                  <ActivityItem key={index} activity={activity} />
                ))}
              </motion.div>
              {recent_activity.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  No recent activity
                </p>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Tasks */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                Upcoming Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <motion.div variants={containerVariants} className="space-y-3">
                {upcoming_tasks.slice(0, 4).map((task, index) => (
                  <motion.div 
                    key={index}
                    variants={itemVariants}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{task.title || 'Task'}</p>
                      <p className="text-xs text-muted-foreground">{task.course_title || 'General'}</p>
                    </div>
                    <div className="text-right">
                      <Badge 
                        variant={task.priority === 'high' ? 'destructive' : 
                                task.priority === 'medium' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date'}
                      </Badge>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
              {upcoming_tasks.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  No upcoming tasks
                </p>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/student/courses">
                <Button className="w-full justify-start" variant="outline">
                  <BookOpen className="h-4 w-4 mr-2" />
                  Browse Courses
                </Button>
              </Link>
              <Link href="/student/progress">
                <Button className="w-full justify-start" variant="outline">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  View Progress
                </Button>
              </Link>
              <Link href="/student/certificates">
                <Button className="w-full justify-start" variant="outline">
                  <Award className="h-4 w-4 mr-2" />
                  My Certificates
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default StudentDashboard;