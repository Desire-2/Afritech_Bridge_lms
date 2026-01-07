import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  BarChart3,
  Send,
  RefreshCw
} from 'lucide-react';

interface ModificationStats {
  pending_resubmissions: number;
  completed_resubmissions: number;
  modification_rate: number;
}

interface ModificationRequest {
  id: number;
  title: string;
  course_title: string;
  lesson_title: string;
  student_name: string;
  student_email: string;
  modification_reason: string;
  requested_at: string;
  needs_resubmission: boolean;
  resubmission_count: number;
  max_resubmissions: number;
  status: string;
}

interface TrendData {
  date: string;
  modification_requests: number;
}

const ResponsiveModificationDashboard: React.FC = () => {
  const [stats, setStats] = useState<ModificationStats | null>(null);
  const [requests, setRequests] = useState<ModificationRequest[]>([]);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequests, setSelectedRequests] = useState<Set<number>>(new Set());
  const [bulkReminderDays, setBulkReminderDays] = useState(7);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [reminderResult, setReminderResult] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('No authentication token found');
        return;
      }

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Load stats, requests, and trends in parallel
      const [statsResponse, requestsResponse, trendsResponse] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/modification/instructor/modification-stats`, { headers }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/modification/instructor/modification-requests`, { headers }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/modification/instructor/modification-trends?days=30`, { headers })
      ]);

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.data);
      }

      if (requestsResponse.ok) {
        const requestsData = await requestsResponse.json();
        setRequests(requestsData.data.modification_requests || []);
      }

      if (trendsResponse.ok) {
        const trendsData = await trendsResponse.json();
        setTrends(trendsData.data.trends || []);
      }

    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const sendBulkReminders = async () => {
    try {
      setReminderLoading(true);
      setReminderResult(null);
      
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/modification/instructor/send-reminders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          days_overdue: bulkReminderDays
        })
      });

      if (response.ok) {
        const result = await response.json();
        setReminderResult(`Successfully sent ${result.data.reminders_sent} reminders`);
        loadDashboardData(); // Refresh data
      } else {
        const error = await response.json();
        setReminderResult(`Failed to send reminders: ${error.error}`);
      }
    } catch (err) {
      console.error('Error sending reminders:', err);
      setReminderResult('Failed to send reminders');
    } finally {
      setReminderLoading(false);
    }
  };

  const toggleRequestSelection = (requestId: number) => {
    const newSelected = new Set(selectedRequests);
    if (newSelected.has(requestId)) {
      newSelected.delete(requestId);
    } else {
      newSelected.add(requestId);
    }
    setSelectedRequests(newSelected);
  };

  const selectAllPendingRequests = () => {
    const pendingIds = requests
      .filter(req => req.needs_resubmission)
      .map(req => req.id);
    setSelectedRequests(new Set(pendingIds));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-sm sm:text-base">Loading dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="border-red-200 bg-red-50 mx-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-full">
      {/* Header */}
      <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Modification Dashboard</h1>
        <Button 
          onClick={loadDashboardData} 
          variant="outline" 
          size="sm" 
          className="w-full sm:w-auto"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          <span className="text-xs sm:text-sm">Refresh</span>
        </Button>
      </div>

      {/* Stats Overview - Simplified and Responsive */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="h-8 w-8 sm:h-10 sm:w-10 text-yellow-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Pending</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold">{stats.pending_resubmissions}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-8 w-8 sm:h-10 sm:w-10 text-green-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Completed</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold">{stats.completed_resubmissions}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center space-x-3">
                <TrendingUp className="h-8 w-8 sm:h-10 sm:w-10 text-purple-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Rate</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-bold">{stats.modification_rate}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Responsive Tabs */}
      <Tabs defaultValue="requests" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto p-1">
          <TabsTrigger 
            value="requests" 
            className="text-xs sm:text-sm px-2 sm:px-4 py-2"
          >
            Requests
          </TabsTrigger>
          <TabsTrigger 
            value="trends" 
            className="text-xs sm:text-sm px-2 sm:px-4 py-2"
          >
            Trends
          </TabsTrigger>
          <TabsTrigger 
            value="reminders" 
            className="text-xs sm:text-sm px-2 sm:px-4 py-2"
          >
            Actions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                <span className="text-base sm:text-lg">Modification Requests</span>
                <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-2">
                  <Badge variant="secondary" className="text-xs w-fit">
                    {requests.filter(req => req.needs_resubmission).length} pending
                  </Badge>
                  <Button 
                    onClick={selectAllPendingRequests} 
                    variant="outline" 
                    size="sm" 
                    className="text-xs px-2 sm:px-3 w-full sm:w-auto"
                  >
                    Select All Pending
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {requests.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm sm:text-base">No modification requests found</p>
                  </div>
                ) : (
                  requests.map((request) => (
                    <div
                      key={request.id}
                      className={`border rounded-lg p-3 sm:p-4 transition-all duration-200 ${
                        selectedRequests.has(request.id)
                          ? 'border-blue-500 bg-blue-50 shadow-sm'
                          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <input
                          type="checkbox"
                          checked={selectedRequests.has(request.id)}
                          onChange={() => toggleRequestSelection(request.id)}
                          className="mt-1 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col space-y-2 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
                            <div className="min-w-0 flex-1">
                              <h3 className="font-semibold text-sm sm:text-base truncate">{request.title}</h3>
                              <p className="text-xs sm:text-sm text-gray-600 truncate">
                                {request.course_title} • {request.lesson_title}
                              </p>
                              <p className="text-xs sm:text-sm font-medium text-gray-800 mt-1">
                                Student: {request.student_name}
                              </p>
                            </div>
                            <Badge
                              variant={request.needs_resubmission ? 'destructive' : 'default'}
                              className="text-xs flex-shrink-0"
                            >
                              {request.needs_resubmission ? 'Pending' : 'Completed'}
                            </Badge>
                          </div>
                          <div className="mt-3 p-2 sm:p-3 bg-gray-50 rounded text-xs sm:text-sm">
                            <strong>Reason:</strong> {request.modification_reason}
                          </div>
                          <div className="flex flex-col space-y-1 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-4 mt-2 text-xs text-gray-600">
                            <span>Requested: {new Date(request.requested_at).toLocaleDateString()}</span>
                            <span>Resubmissions: {request.resubmission_count}/{request.max_resubmissions}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-base sm:text-lg">
                <BarChart3 className="h-5 w-5 mr-2 flex-shrink-0" />
                <span>Trends (Last 30 Days)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {trends.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm sm:text-base">No trend data available</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {trends.map((trend, index) => (
                    <div key={index} className="flex items-center justify-between py-2 border-b last:border-b-0">
                      <span className="text-xs sm:text-sm font-medium">
                        {new Date(trend.date).toLocaleDateString()}
                      </span>
                      <div className="flex items-center space-x-2">
                        <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                          {trend.modification_requests} requests
                        </div>
                        <div 
                          className="bg-blue-500 h-2 rounded"
                          style={{ 
                            width: `${Math.max(10, (trend.modification_requests / Math.max(...trends.map(t => t.modification_requests))) * 60)}px` 
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reminders" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-base sm:text-lg">
                <Send className="h-5 w-5 mr-2 flex-shrink-0" />
                <span>Bulk Actions & Reminders</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Bulk Reminders Section */}
              <div className="border rounded-lg p-3 sm:p-4">
                <h3 className="font-semibold mb-2 text-sm sm:text-base">Send Bulk Reminders</h3>
                <p className="text-xs sm:text-sm text-gray-600 mb-4">
                  Send reminder emails to students with overdue resubmissions.
                </p>
                <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-3">
                  <label className="text-xs sm:text-sm font-medium">Days overdue:</label>
                  <Input
                    type="number"
                    value={bulkReminderDays}
                    onChange={(e) => setBulkReminderDays(parseInt(e.target.value) || 7)}
                    min="1"
                    max="30"
                    className="w-full sm:w-24"
                  />
                  <Button
                    onClick={sendBulkReminders}
                    disabled={reminderLoading}
                    className="flex items-center justify-center space-x-2 w-full sm:w-auto"
                    size="sm"
                  >
                    {reminderLoading ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    <span className="text-xs sm:text-sm">Send Reminders</span>
                  </Button>
                </div>
                
                {reminderResult && (
                  <Alert className="mt-3">
                    <AlertDescription className="text-xs sm:text-sm">{reminderResult}</AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Selected Requests Actions */}
              {selectedRequests.size > 0 && (
                <div className="border rounded-lg p-3 sm:p-4">
                  <h3 className="font-semibold mb-2 text-sm sm:text-base">
                    Selected Requests ({selectedRequests.size})
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 mb-4">
                    Perform actions on selected modification requests.
                  </p>
                  <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-3">
                    <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs">
                      Individual Reminders
                    </Button>
                    <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs">
                      Export Selected
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedRequests(new Set())}
                      className="w-full sm:w-auto text-xs"
                    >
                      Clear Selection
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ResponsiveModificationDashboard;