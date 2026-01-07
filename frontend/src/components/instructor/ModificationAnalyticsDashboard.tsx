import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, TrendingUp, TrendingDown, Target, BookOpen, Users, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

interface ModificationAnalytics {
  summary: {
    total_assignments: number;
    assignments_with_modifications: number;
    modification_rate: number;
    total_modification_requests: number;
    resubmission_success_rate: number;
    date_range: {
      start: string;
      end: string;
    };
  };
  top_modification_reasons: Array<[string, number]>;
  course_breakdown: Array<{
    course_title: string;
    course_id: number;
    total_assignments: number;
    modifications: number;
    modification_rate: number;
  }>;
}

interface Insight {
  type: 'warning' | 'success' | 'info';
  title: string;
  message: string;
  recommendation: string;
  priority: 'high' | 'medium' | 'info';
  courses?: string[];
}

interface ImprovementPlan {
  immediate_actions: string[];
  short_term_goals: string[];
  long_term_objectives: string[];
  resources: string[];
}

interface AnalyticsData {
  analytics: ModificationAnalytics;
  insights: Insight[];
  improvement_plan: ImprovementPlan;
}

interface TrendData {
  period: string;
  date: string;
  modifications: number;
  resubmissions: number;
  success_rate: number;
}

const ModificationAnalyticsDashboard: React.FC = () => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [trendsData, setTrendsData] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('90');
  const [trendsPeriod, setTrendsPeriod] = useState<string>('weekly');
  
  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        days_back: timeRange
      });
      
      if (selectedCourse !== 'all') {
        params.append('course_id', selectedCourse);
      }
      
      const response = await fetch(`/api/v1/modification/analytics/instructor?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAnalyticsData(data.data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };
  
  const fetchTrends = async () => {
    try {
      const params = new URLSearchParams({
        period: trendsPeriod,
        weeks_back: '12'
      });
      
      if (selectedCourse !== 'all') {
        params.append('course_id', selectedCourse);
      }
      
      const response = await fetch(`/api/v1/modification/analytics/trends?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTrendsData(data.data.trends);
      }
    } catch (error) {
      console.error('Error fetching trends:', error);
    }
  };
  
  useEffect(() => {
    fetchAnalytics();
    fetchTrends();
  }, [selectedCourse, timeRange, trendsPeriod]);
  
  useEffect(() => {
    if (analyticsData) {
      setLoading(false);
    }
  }, [analyticsData]);
  
  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'success':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      default:
        return <Activity className="h-4 w-4 text-blue-500" />;
    }
  };
  
  const getInsightColor = (type: string) => {
    switch (type) {
      case 'warning':
        return 'border-yellow-200 bg-yellow-50';
      case 'success':
        return 'border-green-200 bg-green-50';
      default:
        return 'border-blue-200 bg-blue-50';
    }
  };
  
  const getPriorityBadge = (priority: string) => {
    const colors = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-yellow-100 text-yellow-800',
      info: 'bg-blue-100 text-blue-800'
    };
    return <Badge className={colors[priority as keyof typeof colors]}>{priority}</Badge>;
  };
  
  const reasonsChartData = analyticsData?.analytics.top_modification_reasons.map(([reason, count]) => ({
    name: reason,
    count: count
  })) || [];
  
  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1'];
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }
  
  if (!analyticsData) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Failed to load analytics data</p>
        <Button onClick={fetchAnalytics} className="mt-4">Retry</Button>
      </div>
    );
  }
  
  const { analytics, insights, improvement_plan } = analyticsData;
  
  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            Insights into assignment modification requests
          </p>
        </div>
        
        <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="180">Last 6 months</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={selectedCourse} onValueChange={setSelectedCourse}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="All courses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {analytics.course_breakdown.map((course) => (
                <SelectItem key={course.course_id} value={course.course_id.toString()}>
                  {course.course_title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Summary Cards - Remove duplicate Total Assignments */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Modification Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{analytics.summary.modification_rate}%</div>
            <p className="text-xs text-muted-foreground">
              {analytics.summary.assignments_with_modifications} assignments modified
            </p>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{analytics.summary.resubmission_success_rate}%</div>
            <p className="text-xs text-muted-foreground">
              Successful resubmissions
            </p>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Requests</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{analytics.summary.total_modification_requests}</div>
            <p className="text-xs text-muted-foreground">
              Modification requests
            </p>
          </CardContent>
        </Card>
      </div>
      
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
          <TabsTrigger value="overview" className="text-xs sm:text-sm px-2 sm:px-4">Overview</TabsTrigger>
          <TabsTrigger value="trends" className="text-xs sm:text-sm px-2 sm:px-4">Trends</TabsTrigger>
          <TabsTrigger value="insights" className="text-xs sm:text-sm px-2 sm:px-4">Insights</TabsTrigger>
          <TabsTrigger value="improvement" className="text-xs sm:text-sm px-2 sm:px-4">Plan</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Modification Reasons Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm sm:text-base">Top Modification Reasons</CardTitle>
              </CardHeader>
              <CardContent>
                {reasonsChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={reasonsChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {reasonsChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-gray-500 py-8 text-sm">No modification reasons data available</p>
                )}
              </CardContent>
            </Card>
            
            {/* Course Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm sm:text-base">Course Performance</CardTitle>
              </CardHeader>
              <CardContent className="max-h-80 overflow-y-auto">
                <div className="space-y-3">
                  {analytics.course_breakdown.map((course) => (
                    <div key={course.course_id} className="flex items-center justify-between p-3 border rounded hover:shadow-sm transition-shadow">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{course.course_title}</p>
                        <p className="text-xs text-gray-500">
                          {course.total_assignments} assignments, {course.modifications} modifications
                        </p>
                      </div>
                      <div className="flex-shrink-0 ml-2">
                        <Badge variant={course.modification_rate > 25 ? "destructive" : course.modification_rate > 15 ? "secondary" : "default"} className="text-xs">
                          {course.modification_rate}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {analytics.course_breakdown.length === 0 && (
                    <p className="text-center text-gray-500 py-8 text-sm">No course data available</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
              <CardTitle className="text-sm sm:text-base">Modification Trends</CardTitle>
              <Select value={trendsPeriod} onValueChange={setTrendsPeriod}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {trendsData.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={trendsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="period" 
                      tick={{ fontSize: 12 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value, name) => [
                        name === 'success_rate' ? `${value}%` : value,
                        name === 'modifications' ? 'Modifications' : 
                        name === 'resubmissions' ? 'Resubmissions' : 'Success Rate'
                      ]}
                    />
                    <Line yAxisId="left" type="monotone" dataKey="modifications" stroke="#8884d8" name="modifications" strokeWidth={2} />
                    <Line yAxisId="left" type="monotone" dataKey="resubmissions" stroke="#82ca9d" name="resubmissions" strokeWidth={2} />
                    <Line yAxisId="right" type="monotone" dataKey="success_rate" stroke="#ffc658" name="success_rate" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-gray-500 py-8 text-sm">No trends data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="insights" className="space-y-4">
          <div className="grid gap-4">
            {insights.map((insight, index) => (
              <Card key={index} className={`border-l-4 ${getInsightColor(insight.type)}`}>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    {getInsightIcon(insight.type)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{insight.title}</h3>
                        {getPriorityBadge(insight.priority)}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{insight.message}</p>
                      <p className="text-sm font-medium text-gray-900">
                        <strong>Recommendation:</strong> {insight.recommendation}
                      </p>
                      {insight.courses && (
                        <div className="mt-2">
                          <p className="text-sm text-gray-600 mb-1">Affected courses:</p>
                          <div className="flex gap-2 flex-wrap">
                            {insight.courses.map((course, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {course}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {insights.length === 0 && (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-gray-500">No specific insights at this time. Great work!</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="improvement" className="space-y-4">
          <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                  <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 flex-shrink-0" />
                  <span>Immediate Actions</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {improvement_plan.immediate_actions.map((action, index) => (
                    <li key={index} className="flex items-start gap-2 text-xs sm:text-sm">
                      <span className="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0"></span>
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                  <Target className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500 flex-shrink-0" />
                  <span>Short-term Goals</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {improvement_plan.short_term_goals.map((goal, index) => (
                    <li key={index} className="flex items-start gap-2 text-xs sm:text-sm">
                      <span className="w-2 h-2 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></span>
                      <span>{goal}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                  <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 flex-shrink-0" />
                  <span>Long-term Objectives</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {improvement_plan.long_term_objectives.map((objective, index) => (
                    <li key={index} className="flex items-start gap-2 text-xs sm:text-sm">
                      <span className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></span>
                      <span>{objective}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                  <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 flex-shrink-0" />
                  <span>Resources</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {improvement_plan.resources.map((resource, index) => (
                    <li key={index} className="flex items-start gap-2 text-xs sm:text-sm">
                      <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
                      <span>{resource}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ModificationAnalyticsDashboard;