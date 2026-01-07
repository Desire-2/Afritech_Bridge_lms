# Real-time Grading Dashboard with WebSocket Integration

"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  BellIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  UserGroupIcon,
  DocumentTextIcon,
  SparklesIcon,
  EyeIcon,
  ChatBubbleLeftEllipsisIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { BellIcon as BellIconSolid } from '@heroicons/react/24/solid';
import EnhancedGradingService, { 
  EnhancedAssignmentSubmission,
  GradingNotification,
  RealTimeGradingStats 
} from '@/services/enhanced-grading.service';

interface RealTimeGradingDashboardProps {
  courseId?: number;
  instructorId: number;
}

interface WebSocketMessage {
  type: 'new_submission' | 'grading_update' | 'notification' | 'stats_update';
  data: any;
}

export const RealTimeGradingDashboard: React.FC<RealTimeGradingDashboardProps> = ({
  courseId,
  instructorId
}) => {
  const [recentSubmissions, setRecentSubmissions] = useState<EnhancedAssignmentSubmission[]>([]);
  const [notifications, setNotifications] = useState<GradingNotification[]>([]);
  const [realTimeStats, setRealTimeStats] = useState<RealTimeGradingStats | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const notificationSoundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Initialize notification sound
    notificationSoundRef.current = new Audio('/sounds/notification.mp3');
    notificationSoundRef.current.volume = 0.5;

    // Fetch initial data
    fetchInitialData();

    // Setup WebSocket connection
    setupWebSocket();

    // Cleanup on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [courseId, instructorId]);

  const fetchInitialData = async () => {
    try {
      const params: any = { 
        instructor_id: instructorId,
        limit: 10,
        sort_by: 'submission_date',
        order: 'desc'
      };
      if (courseId) params.course_id = courseId;

      const [submissionsData, notificationsData, statsData] = await Promise.all([
        EnhancedGradingService.getSubmissions(params),
        EnhancedGradingService.getNotifications({ instructor_id: instructorId, unread_only: false }),
        EnhancedGradingService.getRealTimeStats(instructorId)
      ]);

      setRecentSubmissions(submissionsData.submissions);
      setNotifications(notificationsData);
      setRealTimeStats(statsData);
      setUnreadCount(notificationsData.filter(n => !n.is_read).length);
    } catch (error) {
      console.error('Failed to fetch initial data:', error);
    }
  };

  const setupWebSocket = () => {
    try {
      // In production, this would use the actual WebSocket endpoint
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/ws/grading/${instructorId}`;
      
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        console.log('WebSocket connected');
      };

      wsRef.current.onclose = () => {
        setIsConnected(false);
        console.log('WebSocket disconnected');
        
        // Attempt to reconnect after 3 seconds
        if (autoRefresh) {
          setTimeout(setupWebSocket, 3000);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
    } catch (error) {
      console.error('Failed to setup WebSocket:', error);
      // Fallback to polling for updates
      if (autoRefresh) {
        setTimeout(fetchInitialData, 30000); // Refresh every 30 seconds
      }
    }
  };

  const handleWebSocketMessage = (message: WebSocketMessage) => {
    switch (message.type) {
      case 'new_submission':
        handleNewSubmission(message.data);
        break;
      case 'grading_update':
        handleGradingUpdate(message.data);
        break;
      case 'notification':
        handleNewNotification(message.data);
        break;
      case 'stats_update':
        setRealTimeStats(message.data);
        break;
    }
  };

  const handleNewSubmission = (submission: EnhancedAssignmentSubmission) => {
    setRecentSubmissions(prev => [submission, ...prev.slice(0, 9)]);
    
    // Play notification sound
    if (notificationSoundRef.current) {
      notificationSoundRef.current.play().catch(console.error);
    }

    // Show browser notification (if permission granted)
    if (Notification.permission === 'granted') {
      new Notification('New Submission', {
        body: `${submission.student_name} submitted ${submission.assignment_title}`,
        icon: '/icons/submission.png'
      });
    }
  };

  const handleGradingUpdate = (update: any) => {
    setRecentSubmissions(prev => 
      prev.map(sub => 
        sub.id === update.submission_id 
          ? { ...sub, ...update } 
          : sub
      )
    );
  };

  const handleNewNotification = (notification: GradingNotification) => {
    setNotifications(prev => [notification, ...prev]);
    setUnreadCount(prev => prev + 1);
  };

  const markNotificationAsRead = async (notificationId: number) => {
    try {
      await EnhancedGradingService.markNotificationAsRead(notificationId);
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, is_read: true } 
            : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllNotificationsAsRead = async () => {
    try {
      await EnhancedGradingService.markAllNotificationsAsRead(instructorId);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const requestNotificationPermission = () => {
    if ('Notification' in window) {
      Notification.requestPermission();
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'new_submission':
        return <DocumentTextIcon className="h-4 w-4" />;
      case 'deadline_approaching':
        return <ClockIcon className="h-4 w-4" />;
      case 'grade_dispute':
        return <ExclamationTriangleIcon className="h-4 w-4" />;
      case 'ai_suggestion':
        return <SparklesIcon className="h-4 w-4" />;
      default:
        return <BellIcon className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Connection Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Real-time Grading Dashboard
          </h2>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Auto-refresh Toggle */}
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-slate-300 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-slate-600 dark:text-slate-400">
              Auto-refresh
            </span>
          </label>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              {unreadCount > 0 ? (
                <BellIconSolid className="h-5 w-5 text-blue-600" />
              ) : (
                <BellIcon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              )}
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-50">
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                  <h3 className="font-medium text-slate-900 dark:text-white">Notifications</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllNotificationsAsRead}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 dark:text-slate-400">
                      No notifications
                    </div>
                  ) : (
                    notifications.slice(0, 10).map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-3 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer ${
                          !notification.is_read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}
                        onClick={() => markNotificationAsRead(notification.id)}
                      >
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0 mt-1">
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-white">
                              {notification.title}
                            </p>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                              {notification.message}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                              {formatTimeAgo(notification.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Enable Notifications Button */}
          {Notification.permission === 'default' && (
            <button
              onClick={requestNotificationPermission}
              className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Enable Notifications
            </button>
          )}
        </div>
      </div>

      {/* Real-time Statistics Cards */}
      {realTimeStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Pending Reviews</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {realTimeStats.pending_submissions}
                </p>
              </div>
              <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                <ClockIcon className="h-5 w-5 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Today's Submissions</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {realTimeStats.todays_submissions}
                </p>
              </div>
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                <DocumentTextIcon className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Graded Today</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {realTimeStats.graded_today}
                </p>
              </div>
              <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded">
                <CheckCircleIcon className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Avg Response Time</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {realTimeStats.avg_response_time.toFixed(1)}h
                </p>
              </div>
              <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
                <ArrowPathIcon className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Submissions Feed */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Recent Submissions
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Live feed of new submissions requiring your attention
          </p>
        </div>
        
        <div className="divide-y divide-slate-200 dark:divide-slate-700">
          {recentSubmissions.length === 0 ? (
            <div className="p-8 text-center">
              <DocumentTextIcon className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400">No recent submissions</p>
            </div>
          ) : (
            recentSubmissions.map((submission) => (
              <div key={submission.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h4 className="font-medium text-slate-900 dark:text-white">
                        {submission.student_name}
                      </h4>
                      <span className={`px-2 py-1 text-xs rounded-full border ${getPriorityColor(submission.priority_level)}`}>
                        {submission.priority_level} priority
                      </span>
                      {submission.ai_flagged && (
                        <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full flex items-center">
                          <SparklesIcon className="h-3 w-3 mr-1" />
                          AI Review
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      {submission.assignment_title}
                    </p>
                    <div className="flex items-center space-x-4 mt-2 text-xs text-slate-500">
                      <span>{submission.word_count} words</span>
                      <span>{formatTimeAgo(submission.submission_date)}</span>
                      {submission.days_late > 0 && (
                        <span className="text-red-600 font-medium">
                          {submission.days_late.toFixed(1)} days late
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {submission.requires_manual_review && (
                      <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                        Manual Review Required
                      </span>
                    )}
                    <button
                      onClick={() => window.location.href = `/instructor/grading/enhanced/assignment/${submission.id}`}
                      className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <EyeIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};