"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  Target, 
  Award, 
  Clock, 
  BarChart3, 
  PieChart, 
  Calendar,
  Zap,
  BookOpen,
  Star,
  Flame,
  Brain,
  CheckCircle,
  AlertTriangle,
  Trophy,
  Activity,
  Users,
  ChevronRight,
  Download,
  Share2,
  Filter,
  RefreshCw,
  Lightbulb
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart as RechartsPieChart, 
  Cell, 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  RadialBarChart,
  RadialBar
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StudentApiService, ProgressAnalytics } from '@/services/studentApi';

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
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  description?: string;
}

const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  icon, 
  color, 
  change, 
  changeType = 'neutral',
  description 
}) => (
  <motion.div variants={itemVariants}>
    <Card className="hover:shadow-lg transition-all duration-300 hover:scale-105">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
            {change && (
              <div className={`flex items-center text-sm ${
                changeType === 'positive' ? 'text-green-600' : 
                changeType === 'negative' ? 'text-red-600' : 'text-muted-foreground'
              }`}>
                <TrendingUp className="h-3 w-3 mr-1" />
                {change}
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

interface CourseProgressCardProps {
  course: any;
}

const CourseProgressCard: React.FC<CourseProgressCardProps> = ({ course }) => {
  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getProgressBg = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-100';
    if (percentage >= 60) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-lg mb-2">{course.course_title}</h3>
              <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                <div className="flex items-center">
                  <BookOpen className="h-4 w-4 mr-1" />
                  {course.modules_completed}/{course.total_modules} modules
                </div>
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-1" />
                  {Math.round(course.time_spent_minutes / 60)}h studied
                </div>
              </div>
            </div>
            <Badge 
              className={`${getProgressBg(course.progress_percentage)} ${getProgressColor(course.progress_percentage)} border-0`}
            >
              {Math.round(course.progress_percentage)}%
            </Badge>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span className="font-medium">{Math.round(course.progress_percentage)}%</span>
            </div>
            <Progress value={course.progress_percentage} className="h-3" />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium">Avg Score: {course.average_score}%</span>
            </div>
            <Button size="sm" variant="outline">
              View Details
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

interface LearningTrendsChartProps {
  data: any[];
  type: 'activity' | 'progress' | 'scores';
}

const LearningTrendsChart: React.FC<LearningTrendsChartProps> = ({ data, type }) => {
  const getChartColor = () => {
    switch (type) {
      case 'activity': return '#3b82f6';
      case 'progress': return '#10b981';
      case 'scores': return '#f59e0b';
      default: return '#6366f1';
    }
  };

  const formatData = () => {
    if (!data || !Array.isArray(data)) return [];
    
    switch (type) {
      case 'activity':
        return data.map(item => ({
          date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          value: item.minutes,
          label: 'Minutes'
        }));
      case 'progress':
        return data.map(item => ({
          date: item.week,
          value: item.percentage,
          label: 'Progress %'
        }));
      case 'scores':
        return data.map(item => ({
          date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          value: item.score,
          label: 'Score %'
        }));
      default:
        return [];
    }
  };

  const chartData = formatData();

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id={`gradient-${type}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={getChartColor()} stopOpacity={0.8} />
            <stop offset="95%" stopColor={getChartColor()} stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis 
          tick={{ fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
          formatter={(value: any, name: string) => [value, chartData[0]?.label || 'Value']}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={getChartColor()}
          strokeWidth={3}
          fill={`url(#gradient-${type})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

interface SkillRadarProps {
  skills: { name: string; level: number; color: string }[];
}

const SkillRadar: React.FC<SkillRadarProps> = ({ skills }) => {
  const data = skills.map((skill, index) => ({
    name: skill.name,
    value: skill.level,
    fill: skill.color
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadialBarChart data={data} cx="50%" cy="50%" innerRadius="20%" outerRadius="80%">
        <RadialBar
          minAngle={15}
          label={{ position: 'insideStart', fill: '#fff', fontSize: 12 }}
          background
          clockWise
          dataKey="value"
        />
        <Tooltip 
          formatter={(value: any) => [`${value}%`, 'Proficiency']}
          contentStyle={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid #e2e8f0',
            borderRadius: '8px'
          }}
        />
      </RadialBarChart>
    </ResponsiveContainer>
  );
};

const ProgressAnalyticsPage: React.FC = () => {
  const [analyticsData, setAnalyticsData] = useState<ProgressAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');
  const [selectedTab, setSelectedTab] = useState('overview');

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const data = await StudentApiService.getProgressAnalytics();
        setAnalyticsData(data);
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [timeRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center">
          <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No analytics data available</p>
        </div>
      </div>
    );
  }

  const { 
    overall_progress = 0, 
    courses = [], 
    learning_trends = {
      daily_activity: [],
      weekly_progress: [],
      quiz_scores: []
    }, 
    performance_insights = {
      streak_count: 0,
      strong_areas: [],
      weak_areas: [],
      recommendations: []
    }
  } = analyticsData || {};

  const skillsData = [
    { name: 'Programming', level: 85, color: '#3b82f6' },
    { name: 'Web Development', level: 75, color: '#10b981' },
    { name: 'Database', level: 65, color: '#f59e0b' },
    { name: 'Design', level: 55, color: '#ef4444' },
    { name: 'DevOps', level: 45, color: '#8b5cf6' }
  ];

  return (
    <motion.div 
      className="space-y-8 p-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Learning Analytics</h1>
            <p className="text-muted-foreground mt-2">
              Track your learning progress and identify areas for improvement
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 3 months</SelectItem>
                <SelectItem value="1y">Last year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Key Metrics */}
      <motion.div 
        variants={containerVariants}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        <StatCard
          title="Overall Progress"
          value={`${Math.round(overall_progress)}%`}
          icon={<Target className="h-6 w-6 text-white" />}
          color="bg-blue-500"
          change="+12% this month"
          changeType="positive"
        />
        <StatCard
          title="Learning Streak"
          value={`${performance_insights.streak_count} days`}
          icon={<Flame className="h-6 w-6 text-white" />}
          color="bg-orange-500"
          change="Personal best!"
          changeType="positive"
        />
        <StatCard
          title="Courses Completed"
          value={courses.filter(c => c.progress_percentage === 100).length}
          icon={<Trophy className="h-6 w-6 text-white" />}
          color="bg-green-500"
          change="+2 this month"
          changeType="positive"
        />
        <StatCard
          title="Study Hours"
          value={`${Math.round(courses.reduce((acc, c) => acc + c.time_spent_minutes, 0) / 60)}h`}
          icon={<Clock className="h-6 w-6 text-white" />}
          color="bg-purple-500"
          change="+8h this week"
          changeType="positive"
        />
      </motion.div>

      {/* Main Analytics Tabs */}
      <motion.div variants={itemVariants}>
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="trends">Learning Trends</TabsTrigger>
            <TabsTrigger value="courses">Course Progress</TabsTrigger>
            <TabsTrigger value="skills">Skills Assessment</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Progress Overview */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Activity className="h-5 w-5 mr-2" />
                    Daily Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <LearningTrendsChart 
                    data={learning_trends.daily_activity} 
                    type="activity"
                  />
                </CardContent>
              </Card>

              {/* Insights Sidebar */}
              <div className="space-y-6">
                {/* Performance Insights */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Brain className="h-5 w-5 mr-2" />
                      Performance Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-medium text-green-600 mb-2">Strong Areas</h4>
                      <div className="space-y-1">
                        {performance_insights.strong_areas.map((area, index) => (
                          <Badge key={index} variant="secondary" className="mr-1 mb-1">
                            {area}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-orange-600 mb-2">Areas for Improvement</h4>
                      <div className="space-y-1">
                        {performance_insights.weak_areas.map((area, index) => (
                          <Badge key={index} variant="outline" className="mr-1 mb-1">
                            {area}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Recommendations */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Lightbulb className="h-5 w-5 mr-2" />
                      Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {performance_insights.recommendations.map((rec, index) => (
                        <div key={index} className="flex items-start space-x-3 p-3 bg-muted/50 rounded-lg">
                          <CheckCircle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                          <p className="text-sm">{rec}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="trends" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Weekly Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <LearningTrendsChart 
                    data={learning_trends.weekly_progress} 
                    type="progress"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Assessment Scores</CardTitle>
                </CardHeader>
                <CardContent>
                  <LearningTrendsChart 
                    data={learning_trends.score_trends} 
                    type="scores"
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="courses" className="mt-6">
            <motion.div 
              variants={containerVariants}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              {courses.map((course) => (
                <CourseProgressCard key={course.course_id} course={course} />
              ))}
            </motion.div>
          </TabsContent>

          <TabsContent value="skills" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Skill Proficiency</CardTitle>
                </CardHeader>
                <CardContent>
                  <SkillRadar skills={skillsData} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Skill Development</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {skillsData.map((skill, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex justify-between">
                          <span className="font-medium">{skill.name}</span>
                          <span className="text-sm text-muted-foreground">{skill.level}%</span>
                        </div>
                        <Progress value={skill.level} className="h-2" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </motion.div>
  );
};

export default ProgressAnalyticsPage;