import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  TrendingUp,
  Clock,
  Users,
  FileText,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Send,
  RefreshCw
} from 'lucide-react';

interface ModificationStats {
  total_assignments: number;
  assignments_with_modifications: number;
  total_modification_requests: number;
  pending_resubmissions: number;
  completed_resubmissions: number;
  average_resubmissions_per_assignment: number;
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

const EnhancedModificationDashboard: React.FC = () => {
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
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/modification/analytics/trends?period=weekly&weeks_back=4`, { headers })
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
        setTrends((trendsData.data.trends || []).map((trend: any) => ({
          date: trend.date,
          modification_requests: trend.modification_requests ?? trend.modifications ?? 0,
        })));
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
        <span className="ml-2">Loading modification dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Modification Request Dashboard</h1>
        <Button onClick={loadDashboardData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <FileText className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Assignments</p>
                  <p className="text-2xl font-bold">{stats.total_assignments}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-8 w-8 text-yellow-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending Resubmissions</p>
                  <p className="text-2xl font-bold">{stats.pending_resubmissions}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Completed Resubmissions</p>
                  <p className="text-2xl font-bold">{stats.completed_resubmissions}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-8 w-8 text-purple-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Modification Rate</p>
                  <p className="text-2xl font-bold">{stats.modification_rate}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="requests" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="requests">Modification Requests</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="reminders">Bulk Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Modification Requests</span>
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary">
                    {requests.filter(req => req.needs_resubmission).length} pending
                  </Badge>
                  <Button onClick={selectAllPendingRequests} variant="outline" size="sm">
                    Select All Pending
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {requests.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No modification requests found
                  </div>
                ) : (
                  requests.map((request) => (
                    <div
                      key={request.id}
                      className={`border rounded-lg p-4 transition-colors ${
                        selectedRequests.has(request.id)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <input
                            type="checkbox"
                            checked={selectedRequests.has(request.id)}
                            onChange={() => toggleRequestSelection(request.id)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <h3 className="font-semibold">{request.title}</h3>
                            <p className="text-sm text-gray-600">
                              {request.course_title} • {request.lesson_title}
                            </p>
                            <p className="text-sm font-medium text-gray-800 mt-1">
                              Student: {request.student_name}
                            </p>
                            <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                              <strong>Reason:</strong> {request.modification_reason}
                            </div>
                            <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                              <span>Requested: {new Date(request.requested_at).toLocaleDateString()}</span>
                              <span>Resubmissions: {request.resubmission_count}/{request.max_resubmissions}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge
                            variant={request.needs_resubmission ? 'destructive' : 'secondary'}
                          >
                            {request.needs_resubmission ? 'Pending' : 'Resubmitted'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="h-5 w-5 mr-2" />
                Modification Request Trends (Last 30 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {trends.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No trend data available
                </div>
              ) : (
                <div className="space-y-2">
                  {trends.map((trend, index) => (
                    <div key={index} className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm font-medium">
                        {new Date(trend.date).toLocaleDateString()}
                      </span>
                      <div className="flex items-center space-x-2">
                        <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                          {trend.modification_requests} requests
                        </div>
                        <div
                          className="bg-blue-500 h-2 rounded"
                          style={{
                            width: `${Math.max(10, (trend.modification_requests / Math.max(...trends.map(t => t.modification_requests))) * 100)}px`
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

        <TabsContent value="reminders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Send className="h-5 w-5 mr-2" />
                Bulk Actions & Reminders
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-3">Send Bulk Reminders</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Send reminder emails to students with overdue resubmissions.
                </p>
                <div className="flex items-center space-x-3">
                  <label className="text-sm font-medium">Days overdue:</label>
                  <Input
                    type="number"
                    value={bulkReminderDays}
                    onChange={(e) => setBulkReminderDays(parseInt(e.target.value) || 7)}
                    min="1"
                    max="30"
                    className="w-20"
                  />
                  <Button
                    onClick={sendBulkReminders}
                    disabled={reminderLoading}
                    className="flex items-center space-x-2"
                  >
                    {reminderLoading ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    <span>Send Reminders</span>
                  </Button>
                </div>

                {reminderResult && (
                  <Alert className="mt-3">
                    <AlertDescription>{reminderResult}</AlertDescription>
                  </Alert>
                )}
              </div>

              {selectedRequests.size > 0 && (
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-3">
                    Selected Requests ({selectedRequests.size})
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Perform bulk actions on selected modification requests.
                  </p>
                  <div className="flex items-center space-x-3">
                    <Button variant="outline" size="sm">
                      Send Individual Reminders
                    </Button>
                    <Button variant="outline" size="sm">
                      Export Selected
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedRequests(new Set())}
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

export default EnhancedModificationDashboard;