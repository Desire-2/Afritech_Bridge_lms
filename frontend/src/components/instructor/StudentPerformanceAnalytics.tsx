"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Users, Award, AlertTriangle, 
  BookOpen, CheckCircle, Clock, Target, Filter
} from 'lucide-react';
import FullCreditManager from './FullCreditManager';
import InstructorService, { StudentPerformanceAnalytics } from '@/services/instructor.service';
import { Course } from '@/types/api';

interface StudentPerformanceAnalyticsProps {
  onActionRequired?: (action: string, data: any) => void;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const StudentPerformanceAnalytics: React.FC<StudentPerformanceAnalyticsProps> = ({ 
  onActionRequired 
}) => {
  const [analytics, setAnalytics] = useState<StudentPerformanceAnalytics | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadData();
    loadCourses();
  }, [selectedCourse]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Loading student performance analytics...');
      const data = await InstructorService.getStudentPerformanceAnalytics(selectedCourse);
      console.log('Analytics data received:', data);
      
      if (!data) {
        setError('No analytics data received from server');
        return;
      }
      
      if (data.error) {
        // Show a user-friendly error message instead of technical details
        setError('Unable to load analytics data. This may be because you haven\'t created any courses yet or there are no enrolled students.');
        return;
      }
      
      setAnalytics(data);
    } catch (err: any) {
      console.error('Analytics loading error:', err);
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const loadCourses = async () => {
    try {
      const coursesData = await InstructorService.getMyCourses();
      setCourses(coursesData);
    } catch (err) {
      console.error('Failed to load courses:', err);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'excellent': return 'default';
      case 'good': return 'secondary';
      case 'average': return 'outline';
      case 'struggling': return 'destructive';
      case 'inactive': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent': return <Award className="h-4 w-4" />;
      case 'good': return <TrendingUp className="h-4 w-4" />;
      case 'average': return <Target className="h-4 w-4" />;
      case 'struggling': return <AlertTriangle className="h-4 w-4" />;
      case 'inactive': return <Clock className="h-4 w-4" />;
      default: return <Users className="h-4 w-4" />;
    }
  };

  const prepareGradeDistributionData = (distribution: Record<string, number>) => {
    return Object.entries(distribution).map(([grade, count]) => ({
      name: grade,
      value: count
    }));
  };

  const prepareModulePerformanceData = (modules: any[]) => {
    return modules.map((module, index) => ({
      name: `Module ${index + 1}`,
      'Completion Rate': module.completion_rate,
      'Average Score': module.average_score,
      'Students': module.students_enrolled
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-sky-500"></div>
        <span className="ml-3 text-slate-600 dark:text-slate-300">Loading analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-600 mb-2">Error Loading Analytics</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={loadData} variant="outline">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analytics || !analytics.overview) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Student Performance Analytics</h2>
          <Button onClick={loadData} variant="outline">
            Refresh
          </Button>
        </div>
        
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-gray-600">No analytics data available. Click Refresh to try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Create safe analytics object with defaults
  const safeAnalytics = {
    overview: analytics.overview || {
      total_students: 0,
      active_students: 0,
      total_courses: 0,
      activity_rate: 0
    },
    course_analytics: analytics.course_analytics || [],
    students_performance: analytics.students_performance || [],
    struggling_students: analytics.struggling_students || [],
    top_performers: analytics.top_performers || [],
    recommendations: analytics.recommendations || []
  };

  return (
    <div className="space-y-6">
      {/* Header with Filter */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Student Performance Analytics</h2>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-slate-600" />
            <select
              value={selectedCourse || 'all'}
              onChange={(e) => setSelectedCourse(e.target.value === 'all' ? undefined : parseInt(e.target.value))}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
            >
              <option value="all">All Courses</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={loadData} variant="outline">
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{safeAnalytics.overview.total_students}</div>
            <p className="text-xs text-muted-foreground">
              Across {safeAnalytics.overview.total_courses} course{safeAnalytics.overview.total_courses !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Students</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{safeAnalytics.overview.active_students}</div>
            <p className="text-xs text-muted-foreground">
              {safeAnalytics.overview.activity_rate.toFixed(1)}% activity rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Struggling Students</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{safeAnalytics.struggling_students.length}</div>
            <p className="text-xs text-muted-foreground">
              Need additional support
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Performers</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{safeAnalytics.top_performers.length}</div>
            <p className="text-xs text-muted-foreground">
              Excellent performance
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="courses">Courses</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="recommendations">Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Course Completion Overview */}
            <Card>
              <CardHeader>
                <CardTitle>Course Completion Rates</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={safeAnalytics.course_analytics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="course.title" 
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="completion_rate" fill="#8884d8" name="Completion Rate %" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Student Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Student Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={(() => {
                        const statusCount: Record<string, number> = {};
                        safeAnalytics.students_performance.forEach(student => {
                          statusCount[student.status] = (statusCount[student.status] || 0) + 1;
                        });
                        return Object.entries(statusCount).map(([status, count]) => ({
                          name: status.charAt(0).toUpperCase() + status.slice(1),
                          value: count
                        }));
                      })()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {(() => {
                        const statusCount: Record<string, number> = {};
                        safeAnalytics.students_performance.forEach(student => {
                          statusCount[student.status] = (statusCount[student.status] || 0) + 1;
                        });
                        return Object.entries(statusCount).map(([status, count], index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ));
                      })()}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="courses" className="space-y-6">
          {safeAnalytics.course_analytics.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <p className="text-center text-gray-600">No course data available</p>
              </CardContent>
            </Card>
          ) : (
            safeAnalytics.course_analytics.map((courseData, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{courseData.course.title}</span>
                    <Badge variant="outline">
                      {courseData.total_enrolled} students enrolled
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {courseData.completion_rate.toFixed(1)}%
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Completion Rate</p>
                    </div>
                    <div className="text-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {courseData.average_progress.toFixed(1)}%
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Average Progress</p>
                    </div>
                    <div className="text-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">
                        {courseData.modules_performance.length}
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Modules</p>
                    </div>
                  </div>

                  {/* Module Performance */}
                  <div>
                    <h4 className="text-lg font-semibold mb-4">Module Performance</h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={prepareModulePerformanceData(courseData.modules_performance)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="Completion Rate" fill="#8884d8" />
                        <Bar dataKey="Average Score" fill="#82ca9d" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Grade Distribution */}
                  <div>
                    <h4 className="text-lg font-semibold mb-4">Grade Distribution</h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={prepareGradeDistributionData(courseData.grade_distribution)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill="#ffc658" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="students" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* All Students Table */}
            <Card>
              <CardHeader>
                <CardTitle>All Students Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {safeAnalytics.students_performance.length === 0 ? (
                    <p className="text-center py-8 text-slate-500 dark:text-slate-400">
                      No student performance data available.
                    </p>
                  ) : (
                    safeAnalytics.students_performance.map((student, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0 h-10 w-10 bg-slate-200 dark:bg-slate-600 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium">
                            {student.student.first_name?.[0] || student.student.username[0]}
                          </span>
                        </div>
                        <div>
                          <div className="text-sm font-medium">
                            {student.student.first_name && student.student.last_name 
                              ? `${student.student.first_name} ${student.student.last_name}`
                              : student.student.username}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {student.courses_enrolled} course{student.courses_enrolled !== 1 ? 's' : ''} enrolled
                          </div>
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <Badge variant={getStatusBadgeVariant(student.status)} className="flex items-center space-x-1">
                          {getStatusIcon(student.status)}
                          <span>{student.status}</span>
                        </Badge>
                        <div className="text-sm font-medium">
                          {student.overall_average.toFixed(1)}% avg
                        </div>
                      </div>
                    </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Struggling Students */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  <span>Students Needing Support</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {safeAnalytics.struggling_students.length === 0 ? (
                  <p className="text-center py-8 text-slate-500 dark:text-slate-400">
                    Great! No students currently need additional support.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {safeAnalytics.struggling_students.map((student, index) => (
                      <div key={index} className="p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">
                            {student.student.first_name && student.student.last_name 
                              ? `${student.student.first_name} ${student.student.last_name}`
                              : student.student.username}
                          </h4>
                          <Badge variant="destructive">{student.status}</Badge>
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                          Average: {student.overall_average.toFixed(1)}% | Recent Activity: {student.recent_activity} days
                        </div>
                        {student.support_needed && (
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-red-700 dark:text-red-300">Recommendations:</p>
                            <ul className="text-sm text-red-600 dark:text-red-400 space-y-1">
                              {student.support_needed.map((rec: string, i: number) => (
                                <li key={i} className="flex items-start space-x-2">
                                  <span className="text-red-500">•</span>
                                  <span>{rec}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          {/* Top Performers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Award className="h-5 w-5 text-yellow-500" />
                <span>Top Performers</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {safeAnalytics.top_performers.slice(0, 9).map((student, index) => (
                  <div key={index} className="p-4 border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="flex-shrink-0 h-8 w-8 bg-yellow-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <h4 className="font-medium text-sm">
                          {student.student.first_name && student.student.last_name 
                            ? `${student.student.first_name} ${student.student.last_name}`
                            : student.student.username}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {student.overall_average.toFixed(1)}% average
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      {student.courses_enrolled} course{student.courses_enrolled !== 1 ? 's' : ''} • 
                      {student.recent_activity} recent activities
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-6">
          {/* Student Management Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Student Management Actions</CardTitle>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Administrative tools for managing student progress and grades
              </p>
            </CardHeader>
            <CardContent>
              <FullCreditManager courses={courses} onCreditAwarded={loadData} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actionable Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              {safeAnalytics.recommendations.length === 0 ? (
                <p className="text-center py-8 text-slate-500 dark:text-slate-400">
                  No specific recommendations at this time. Your courses are performing well!
                </p>
              ) : (
                <div className="space-y-4">
                  {safeAnalytics.recommendations.map((rec, index) => (
                    <div 
                      key={index} 
                      className={`p-4 border rounded-lg ${
                        rec.priority === 'high' 
                          ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20' 
                          : 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium">{rec.title}</h4>
                        <Badge variant={rec.priority === 'high' ? 'destructive' : 'outline'}>
                          {rec.priority} priority
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                        {rec.description}
                      </p>
                      <div>
                        <p className="text-sm font-medium mb-2">Suggested Actions:</p>
                        <ul className="text-sm space-y-1">
                          {rec.actions.map((action, i) => (
                            <li key={i} className="flex items-start space-x-2">
                              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>{action}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <Button 
                          size="sm" 
                          onClick={() => onActionRequired?.(rec.type, rec)}
                          className="mr-2"
                        >
                          Take Action
                        </Button>
                        <Button size="sm" variant="outline">
                          View Details
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudentPerformanceAnalytics;