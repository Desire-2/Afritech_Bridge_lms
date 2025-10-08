/**
 * Enhanced Progress Analytics Page
 * Comprehensive learning analytics with real-time updates
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  Award,
  Clock,
  Target,
  BookOpen,
  Zap,
  Download,
  RefreshCw,
  BarChart3,
  PieChart,
  Activity,
  Calendar,
  Star,
  Trophy,
  Brain,
  Sparkles
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { ProgressApiService } from '@/services/api';
import { useLearningAnalytics, useRealTimeProgress } from '@/hooks/useProgressiveLearning';
import SkillRadarChart from '@/components/student/SkillRadarChart';
import LearningVelocityGraph from '@/components/student/LearningVelocityGraph';

interface ProgressData {
  overview: {
    total_courses: number;
    completed_courses: number;
    certificates_earned: number;
    badges_earned: number;
    total_learning_hours: number;
    learning_streak: number;
    current_level: {
      current_level: string;
      current_points: number;
      next_level_points: number;
      progress_to_next: number;
    };
  };
  learning_analytics: any;
}

const EnhancedProgressPage = () => {
  const { user } = useAuth();
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [skillData, setSkillData] = useState<any[]>([]);
  const [velocityData, setVelocityData] = useState<any>(null);
  const [timeAnalytics, setTimeAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState('overview');

  const { analytics: liveAnalytics } = useLearningAnalytics('30d');
  const { updates: realTimeUpdates, connected: wsConnected } = useRealTimeProgress(0);

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    // Handle real-time updates
    if (realTimeUpdates.length > 0) {
      const latestUpdate = realTimeUpdates[realTimeUpdates.length - 1];
      if (latestUpdate.type === 'progress_update') {
        loadAllData();
      }
    }
  }, [realTimeUpdates]);

  const loadAllData = async () => {
    try {
      setLoading(true);

      // Load all data in parallel
      const [overview, skills, velocity, time] = await Promise.all([
        ProgressApiService.getProgressOverview(),
        ProgressApiService.getSkillBreakdown(),
        ProgressApiService.getLearningVelocity(),
        ProgressApiService.getTimeAnalytics(),
      ]);

      setProgressData(overview);
      setSkillData(skills.skills || []);
      setVelocityData(velocity);
      setTimeAnalytics(time);
    } catch (error) {
      console.error('Failed to load progress data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

  const handleExport = async (format: 'pdf' | 'csv') => {
    try {
      const blob = await ProgressApiService.exportProgressReport(format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `progress-report-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to export report:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary mx-auto"></div>
          <p className="text-lg text-muted-foreground">Loading your learning analytics...</p>
        </div>
      </div>
    );
  }

  if (!progressData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-muted-foreground">Failed to load progress data</p>
          <Button onClick={loadAllData} className="mt-4">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const { overview } = progressData;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-4xl font-bold mb-2 flex items-center space-x-3">
              <BarChart3 className="h-8 w-8 text-primary" />
              <span>Learning Analytics</span>
            </h1>
            <p className="text-muted-foreground flex items-center space-x-2">
              <span>Track your progress and master new skills</span>
              {wsConnected && (
                <Badge variant="outline" className="ml-2">
                  <Activity className="h-3 w-3 mr-1 animate-pulse text-green-600" />
                  Live
                </Badge>
              )}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExport('pdf')}
            >
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </motion.div>

        {/* Key Metrics Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {/* Total Courses */}
          <Card className="hover:shadow-lg transition-shadow duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold">{overview.total_courses}</p>
                  <p className="text-sm text-muted-foreground">Courses</p>
                </div>
              </div>
              <Progress 
                value={(overview.completed_courses / overview.total_courses) * 100} 
                className="h-2"
              />
              <p className="text-xs text-muted-foreground mt-2">
                {overview.completed_courses} completed
              </p>
            </CardContent>
          </Card>

          {/* Learning Hours */}
          <Card className="hover:shadow-lg transition-shadow duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <Clock className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold">{overview.total_learning_hours}</p>
                  <p className="text-sm text-muted-foreground">Hours</p>
                </div>
              </div>
              {timeAnalytics && (
                <>
                  <Progress 
                    value={(timeAnalytics.weekly_average / timeAnalytics.monthly_average) * 100} 
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    {timeAnalytics.weekly_average}h this week
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Achievements */}
          <Card className="hover:shadow-lg transition-shadow duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                  <Trophy className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold">
                    {overview.certificates_earned + overview.badges_earned}
                  </p>
                  <p className="text-sm text-muted-foreground">Achievements</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {overview.certificates_earned} Certificates
                </span>
                <span className="text-muted-foreground">
                  {overview.badges_earned} Badges
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Learning Streak */}
          <Card className="hover:shadow-lg transition-shadow duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                  <Zap className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold">{overview.learning_streak}</p>
                  <p className="text-sm text-muted-foreground">Day Streak</p>
                </div>
              </div>
              <div className="flex items-center space-x-1">
                {[...Array(7)].map((_, i) => (
                  <div
                    key={i}
                    className={`flex-1 h-2 rounded-full ${
                      i < overview.learning_streak % 7 
                        ? 'bg-green-500' 
                        : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Keep it up! 🔥
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Level Progress */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-gradient-to-r from-purple-500 to-blue-500 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <div className="p-4 bg-white/20 rounded-full backdrop-blur-sm">
                    <Star className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">{overview.current_level.current_level}</h3>
                    <p className="text-sm opacity-90">Current Level</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold">{overview.current_level.current_points}</p>
                  <p className="text-sm opacity-90">/ {overview.current_level.next_level_points} XP</p>
                </div>
              </div>
              <Progress 
                value={overview.current_level.progress_to_next} 
                className="h-3 bg-white/20"
              />
              <p className="text-sm mt-2 opacity-90">
                {Math.round(100 - overview.current_level.progress_to_next)}% to next level
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tabbed Analytics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">
                <PieChart className="h-4 w-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="skills">
                <Brain className="h-4 w-4 mr-2" />
                Skills
              </TabsTrigger>
              <TabsTrigger value="velocity">
                <TrendingUp className="h-4 w-4 mr-2" />
                Velocity
              </TabsTrigger>
              <TabsTrigger value="time">
                <Calendar className="h-4 w-4 mr-2" />
                Time
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Target className="h-5 w-5" />
                      <span>Performance Summary</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {liveAnalytics && (
                      <>
                        <div>
                          <div className="flex justify-between mb-2">
                            <span className="text-sm text-muted-foreground">Overall GPA</span>
                            <span className="font-bold">{liveAnalytics.overall_gpa?.toFixed(2)}</span>
                          </div>
                          <Progress value={(liveAnalytics.overall_gpa / 4) * 100} />
                        </div>

                        <div>
                          <div className="flex justify-between mb-2">
                            <span className="text-sm text-muted-foreground">Average Score</span>
                            <span className="font-bold">{liveAnalytics.average_score}%</span>
                          </div>
                          <Progress value={liveAnalytics.average_score} />
                        </div>

                        <div className="pt-4 border-t">
                          <h4 className="font-semibold mb-3">Performance Trend</h4>
                          <Badge 
                            variant="secondary"
                            className={
                              liveAnalytics.performance_trend === 'improving' 
                                ? 'bg-green-100 text-green-800'
                                : liveAnalytics.performance_trend === 'declining'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-blue-100 text-blue-800'
                            }
                          >
                            <Sparkles className="h-3 w-3 mr-1" />
                            {liveAnalytics.performance_trend}
                          </Badge>
                        </div>

                        <div className="space-y-2">
                          <h4 className="font-semibold text-sm">Strong Areas</h4>
                          <div className="flex flex-wrap gap-2">
                            {liveAnalytics.strong_areas?.map((area: string, i: number) => (
                              <Badge key={i} variant="outline" className="bg-green-50">
                                {area}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <h4 className="font-semibold text-sm">Improvement Areas</h4>
                          <div className="flex flex-wrap gap-2">
                            {liveAnalytics.improvement_areas?.map((area: string, i: number) => (
                              <Badge key={i} variant="outline" className="bg-yellow-50">
                                {area}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Course Distribution</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-muted-foreground">Completed</span>
                          <span className="font-semibold">{overview.completed_courses}</span>
                        </div>
                        <Progress 
                          value={(overview.completed_courses / overview.total_courses) * 100}
                          className="[&>div]:bg-green-500"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-muted-foreground">In Progress</span>
                          <span className="font-semibold">
                            {overview.total_courses - overview.completed_courses}
                          </span>
                        </div>
                        <Progress 
                          value={((overview.total_courses - overview.completed_courses) / overview.total_courses) * 100}
                          className="[&>div]:bg-blue-500"
                        />
                      </div>

                      <div className="pt-4 border-t">
                        <h4 className="font-semibold mb-3">Completion Rate</h4>
                        <div className="text-center">
                          <p className="text-4xl font-bold text-primary">
                            {Math.round((overview.completed_courses / overview.total_courses) * 100)}%
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {overview.completed_courses} of {overview.total_courses} courses
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Skills Tab */}
            <TabsContent value="skills" className="space-y-6">
              {skillData.length > 0 ? (
                <SkillRadarChart 
                  skills={skillData}
                  interactive={true}
                  showLegend={true}
                />
              ) : (
                <Card>
                  <CardContent className="p-12 text-center">
                    <Brain className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Complete more courses to see your skill breakdown
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Velocity Tab */}
            <TabsContent value="velocity" className="space-y-6">
              {velocityData ? (
                <LearningVelocityGraph
                  dailyProgress={velocityData.daily_progress}
                  weeklySummary={velocityData.weekly_summary}
                />
              ) : (
                <Card>
                  <CardContent className="p-12 text-center">
                    <TrendingUp className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Not enough data to show learning velocity
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Time Tab */}
            <TabsContent value="time" className="space-y-6">
              {timeAnalytics && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Time Distribution</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 rounded-lg">
                        <p className="text-5xl font-bold text-primary">{timeAnalytics.total_learning_hours}</p>
                        <p className="text-sm text-muted-foreground mt-2">Total Hours</p>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                          <span className="text-sm">Daily Average</span>
                          <span className="font-bold">{timeAnalytics.daily_average}h</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                          <span className="text-sm">Weekly Average</span>
                          <span className="font-bold">{timeAnalytics.weekly_average}h</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                          <span className="text-sm">Most Active Day</span>
                          <span className="font-bold capitalize">{timeAnalytics.most_active_day}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Time by Course</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {timeAnalytics.time_by_course?.slice(0, 5).map((course: any, i: number) => (
                        <div key={i} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="truncate mr-2">{course.course_title}</span>
                            <span className="font-semibold">{course.hours_spent}h</span>
                          </div>
                          <Progress 
                            value={(course.hours_spent / timeAnalytics.total_learning_hours) * 100}
                          />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
};

export default EnhancedProgressPage;
