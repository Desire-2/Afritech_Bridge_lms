'use client';

import React, { useState, useEffect } from 'react';
import applicationService from '@/services/api/application.service';
import { CourseApplication, ApplicationStatistics } from '@/services/api/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle,
  XCircle,
  Clock,
  Download,
  Eye,
  Filter,
  Search,
  Users,
  TrendingUp,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  Pause,
  RefreshCw,
  FileText,
} from 'lucide-react';

export default function AdminApplicationsManager() {
  const [applications, setApplications] = useState<CourseApplication[]>([]);
  const [statistics, setStatistics] = useState<ApplicationStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courses, setCourses] = useState<Array<{ id: number; title: string; applications_count: number }>>([]);
  
  const [filters, setFilters] = useState({
    status: 'all',
    course_id: '',
    search: '',
    sort_by: 'submission_date',
    sort_order: 'desc' as 'asc' | 'desc',
    page: 1,
    per_page: 20,
  });

  const [selectedApplication, setSelectedApplication] = useState<CourseApplication | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  
  const [notes, setNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  
  // Bulk action state
  const [selectedApplicationIds, setSelectedApplicationIds] = useState<number[]>([]);
  const [bulkActionModalOpen, setBulkActionModalOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<'approve' | 'reject' | 'waitlist' | null>(null);
  const [bulkRejectionReason, setBulkRejectionReason] = useState('');
  const [bulkCustomMessage, setBulkCustomMessage] = useState('');
  
  // Background task state
  const [taskInProgress, setTaskInProgress] = useState(false);
  const [taskProgress, setTaskProgress] = useState({ processed: 0, total: 0 });
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskResults, setTaskResults] = useState<any>(null);
  
  // Waitlist action state
  const [waitlistModalOpen, setWaitlistModalOpen] = useState(false);
  const [waitlistUpdateMessage, setWaitlistUpdateMessage] = useState('');
  const [resendEmailModalOpen, setResendEmailModalOpen] = useState(false);
  const [resendWithCredentials, setResendWithCredentials] = useState(false);
  const [resendCustomMessage, setResendCustomMessage] = useState('');
  
  // Status change state
  const [statusChangeModalOpen, setStatusChangeModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<string>('');
  const [statusChangeReason, setStatusChangeReason] = useState('');

  useEffect(() => {
    loadApplications();
    loadStatistics();
    loadCourses();
  }, [filters]);

  const loadCourses = async () => {
    try {
      const response = await applicationService.getCoursesForFiltering();
      setCourses(response.courses || []);
    } catch (err) {
      console.error('Failed to load courses:', err);
    }
  };

  const loadApplications = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await applicationService.listApplications(
        filters.status !== 'all' ? filters.status : undefined,
        filters.course_id ? parseInt(filters.course_id) : undefined,
        filters.search || undefined,
        filters.sort_by,
        filters.sort_order,
        filters.page,
        filters.per_page
      );
      
      setApplications(response.applications || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const stats = await applicationService.getStatistics();
      setStatistics(stats);
    } catch (err) {
      console.error('Failed to load statistics:', err);
    }
  };

  const handleViewDetails = async (application: CourseApplication) => {
    setSelectedApplication(application);
    setNotes(application.admin_notes || '');
    setDetailModalOpen(true);
  };

  const handleApprove = async (applicationId: number) => {
    setActionLoading(true);
    setActionError(null);
    try {
      const result = await applicationService.approveApplication(applicationId);
      await loadApplications();
      await loadStatistics();
      setDetailModalOpen(false);
      setSelectedApplication(null);
      
      // Show success message
      alert(`✅ Application approved successfully!\n\nUsername: ${result.username || 'N/A'}\nPassword: ${result.temp_password || 'Existing user - no new password'}`);
    } catch (err: any) {
      // Handle specific error cases
      if (err.response?.status === 409) {
        const errorData = err.response?.data;
        const message = `⚠️ ${errorData.error}\n\n${errorData.details || ''}\n\n${errorData.action_taken || ''}`;
        setActionError(message);
        
        // If application was marked as approved, reload data
        if (errorData.application_status === 'approved') {
          await loadApplications();
          await loadStatistics();
        }
      } else if (err.response?.status === 400) {
        const errorData = err.response?.data;
        setActionError(`❌ ${errorData.error}\n${errorData.details || err.message}`);
      } else {
        setActionError(`❌ Failed to approve application\n${err.response?.data?.details || err.message}`);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (applicationId: number, reason: string) => {
    if (!reason.trim()) {
      setActionError('⚠️ Please provide a reason for rejection');
      return;
    }
    
    setActionLoading(true);
    setActionError(null);
    try {
      await applicationService.rejectApplication(applicationId, {
        rejection_reason: reason
      });
      await loadApplications();
      await loadStatistics();
      setDetailModalOpen(false);
      setSelectedApplication(null);
      setRejectionReason('');
      
      // Show success message
      alert('✅ Application rejected successfully. Notification email has been sent.');
    } catch (err: any) {
      if (err.response?.status === 400) {
        const errorData = err.response?.data;
        setActionError(`❌ ${errorData.error}\n${errorData.details || err.message}`);
      } else {
        setActionError(`❌ Failed to reject application\n${err.response?.data?.details || err.message}`);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleWaitlist = async (applicationId: number) => {
    setActionLoading(true);
    setActionError(null);
    try {
      await applicationService.waitlistApplication(applicationId);
      await loadApplications();
      await loadStatistics();
      setDetailModalOpen(false);
      setSelectedApplication(null);
      
      // Show success message
      alert('✅ Application moved to waitlist successfully. Notification email has been sent.');
    } catch (err: any) {
      if (err.response?.status === 400) {
        const errorData = err.response?.data;
        setActionError(`❌ ${errorData.error}\n${errorData.details || err.message}`);
      } else {
        setActionError(`❌ Failed to waitlist application\n${err.response?.data?.details || err.message}`);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateNotes = async (applicationId: number) => {
    setActionLoading(true);
    setActionError(null);
    try {
      await applicationService.updateNotes(applicationId, {
        admin_notes: notes
      });
      await loadApplications();
      setActionError(null);
      
      // Show success feedback
      const successMsg = document.createElement('div');
      successMsg.textContent = '✅ Notes saved';
      successMsg.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50';
      document.body.appendChild(successMsg);
      setTimeout(() => successMsg.remove(), 2000);
    } catch (err: any) {
      setActionError(`❌ Failed to update notes\n${err.response?.data?.details || err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecalculateScores = async (applicationId: number) => {
    setActionLoading(true);
    setActionError(null);
    try {
      const result = await applicationService.recalculateScores(applicationId);
      await loadApplications();
      if (selectedApplication) {
        const updated = await applicationService.getApplication(applicationId);
        setSelectedApplication(updated);
      }
      
      // Show updated scores
      alert(`✅ Scores recalculated!\n\nApplication Score: ${result.scores.application_score}\nReadiness Score: ${result.scores.readiness_score}\nCommitment Score: ${result.scores.commitment_score}\nRisk Score: ${result.scores.risk_score}\nFinal Rank: ${result.scores.final_rank}`);
    } catch (err: any) {
      setActionError(`❌ Failed to recalculate scores\n${err.response?.data?.details || err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      await applicationService.downloadExport(
        filters.status !== 'all' ? filters.status : undefined,
        filters.course_id || undefined
      );
    } catch (err: any) {
      setError(err.message || 'Failed to export applications');
    }
  };

  const toggleSelectApplication = (appId: number) => {
    setSelectedApplicationIds(prev =>
      prev.includes(appId) ? prev.filter(id => id !== appId) : [...prev, appId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedApplicationIds.length === applications.length) {
      setSelectedApplicationIds([]);
    } else {
      setSelectedApplicationIds(applications.map(app => app.id));
    }
  };

  const handleBulkActionClick = (action: 'approve' | 'reject' | 'waitlist') => {
    if (selectedApplicationIds.length === 0) {
      setError('Please select at least one application');
      return;
    }
    setBulkAction(action);
    setBulkActionModalOpen(true);
  };

  const executeBulkAction = async () => {
    if (!bulkAction) return;
    
    if (bulkAction === 'reject' && !bulkRejectionReason.trim()) {
      setActionError('Please provide a reason for rejection');
      return;
    }
    
    setActionLoading(true);
    setActionError(null);
    setTaskInProgress(true);
    setTaskProgress({ processed: 0, total: selectedApplicationIds.length });
    setTaskResults(null);
    
    try {
      // Start the background task
      const response = await applicationService.bulkAction({
        action: bulkAction,
        application_ids: selectedApplicationIds,
        rejection_reason: bulkAction === 'reject' ? bulkRejectionReason : undefined,
        custom_message: bulkAction === 'approve' ? bulkCustomMessage : undefined,
        send_emails: true,
      });
      
      setTaskId(response.task_id);
      setBulkActionModalOpen(false);
      
      // Start polling for task status
      const pollInterval = response.poll_interval_seconds || 2;
      const pollTaskStatus = async () => {
        try {
          const status = await applicationService.getBulkActionStatus(response.task_id);
          
          // Update progress
          setTaskProgress({
            processed: status.progress.processed,
            total: status.progress.total
          });
          
          if (status.status === 'completed') {
            // Task completed successfully
            setTaskInProgress(false);
            setTaskResults(status.results);
            setActionLoading(false);
            
            // Reload data
            await loadApplications();
            await loadStatistics();
            
            // Show success message with results
            let resultsMessage = `✅ Bulk ${status.action.toUpperCase()} completed successfully!\n\n`;
            if (status.summary) {
              resultsMessage += `📊 Summary:\n`;
              resultsMessage += `   Total Processed: ${status.summary.total_processed}\n`;
              resultsMessage += `   ✅ Successful: ${status.summary.successful}\n`;
              resultsMessage += `   ❌ Failed: ${status.summary.failed}\n`;
            }
            
            if (status.results?.failed && status.results.failed.length > 0) {
              resultsMessage += `\n❌ Failed Applications:\n`;
              status.results.failed.slice(0, 5).forEach((fail: any) => {
                resultsMessage += `   - ID ${fail.id}: ${fail.error}\n`;
              });
              if (status.results.failed.length > 5) {
                resultsMessage += `   ... and ${status.results.failed.length - 5} more\n`;
              }
            }
            
            alert(resultsMessage);
            
            // Reset state
            setSelectedApplicationIds([]);
            setBulkRejectionReason('');
            setBulkCustomMessage('');
            setBulkAction(null);
            setTaskId(null);
            setTaskResults(null);
            
          } else if (status.status === 'failed') {
            // Task failed
            setTaskInProgress(false);
            setActionLoading(false);
            setActionError(`❌ Bulk action failed: ${status.error || 'Unknown error'}`);
            setTaskId(null);
            
          } else {
            // Still processing, continue polling
            setTimeout(pollTaskStatus, pollInterval * 1000);
          }
        } catch (err: any) {
          console.error('Error polling task status:', err);
          setTaskInProgress(false);
          setActionLoading(false);
          setActionError(`❌ Failed to check task status: ${err.message}`);
          setTaskId(null);
        }
      };
      
      // Start polling after a brief delay
      setTimeout(pollTaskStatus, pollInterval * 1000);
      
    } catch (err: any) {
      const errorMsg = err.response?.data?.details || err.message || `Failed to start bulk ${bulkAction}`;
      setActionError(`❌ Failed to start bulk action\n\n${errorMsg}`);
      setActionLoading(false);
      setTaskInProgress(false);
      setTaskId(null);
    }
  };

  const handleChangeStatus = async () => {
    if (!selectedApplication || !newStatus) return;
    
    setActionLoading(true);
    setActionError(null);
    
    try {
      const result = await applicationService.changeStatus(selectedApplication.id, {
        status: newStatus as any,
        reason: statusChangeReason || undefined
      });
      
      await loadApplications();
      await loadStatistics();
      
      setStatusChangeModalOpen(false);
      setNewStatus('');
      setStatusChangeReason('');
      setSelectedApplication(null);
      
      alert(`✅ Status changed successfully: ${result.message}`);
    } catch (err: any) {
      setActionError(`❌ Failed to change status\n${err.response?.data?.details || err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResendApprovalEmail = async () => {
    if (!selectedApplication) return;
    
    setActionLoading(true);
    setActionError(null);
    
    try {
      const result = await applicationService.resendApprovalEmail(
        selectedApplication.id,
        {
          custom_message: resendCustomMessage,
          include_credentials: resendWithCredentials
        }
      );
      
      let message = `✅ Approval email resent successfully!\n\nUsername: ${result.username}`;
      if (result.credentials_reset) {
        message += '\n⚠️ New password has been generated and sent via email.';
      }
      
      alert(message);
      setResendEmailModalOpen(false);
      setResendWithCredentials(false);
      setResendCustomMessage('');
    } catch (err: any) {
      setActionError(`❌ Failed to resend email\n${err.response?.data?.details || err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePromoteFromWaitlist = async (applicationId: number) => {
    if (!confirm('Promote this application from waitlist to pending review?')) return;
    
    setActionLoading(true);
    setActionError(null);
    
    try {
      await applicationService.promoteFromWaitlist(applicationId);
      await loadApplications();
      await loadStatistics();
      setDetailModalOpen(false);
      
      alert('✅ Application promoted to pending review. Notification email sent.');
    } catch (err: any) {
      setActionError(`❌ Failed to promote application\n${err.response?.data?.details || err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendWaitlistUpdate = async () => {
    if (!selectedApplication || !waitlistUpdateMessage.trim()) {
      setActionError('⚠️ Please enter an update message');
      return;
    }
    
    setActionLoading(true);
    setActionError(null);
    
    try {
      await applicationService.sendWaitlistUpdate(
        selectedApplication.id,
        waitlistUpdateMessage
      );
      
      alert('✅ Waitlist update sent successfully!');
      setWaitlistModalOpen(false);
      setWaitlistUpdateMessage('');
      await loadApplications();
    } catch (err: any) {
      setActionError(`❌ Failed to send update\n${err.response?.data?.details || err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: any; icon: any; label: string }> = {
      pending: { variant: 'default', icon: Clock, label: 'Pending Review' },
      approved: { variant: 'success', icon: CheckCircle, label: 'Approved' },
      rejected: { variant: 'destructive', icon: XCircle, label: 'Rejected' },
      waitlisted: { variant: 'secondary', icon: Pause, label: 'Waitlisted' },
    };
    
    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const getScoreBadge = (score: number | null | undefined, label: string) => {
    if (score === null || score === undefined) return null;
    
    let colorClass = 'bg-gray-100 text-gray-800';
    if (score >= 80) colorClass = 'bg-green-100 text-green-800';
    else if (score >= 60) colorClass = 'bg-blue-100 text-blue-800';
    else if (score >= 40) colorClass = 'bg-yellow-100 text-yellow-800';
    else colorClass = 'bg-red-100 text-red-800';
    
    return (
      <div className={`px-2 py-1 rounded text-xs font-medium ${colorClass}`}>
        {label}: {score}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Background Task Progress Indicator */}
      {taskInProgress && (
        <Card className="border-blue-500 bg-blue-50">
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                  <div>
                    <h3 className="font-semibold text-blue-900">
                      Processing Bulk {bulkAction?.toUpperCase()}...
                    </h3>
                    <p className="text-sm text-blue-700">
                      {taskProgress.processed} of {taskProgress.total} applications processed
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-900">
                    {taskProgress.total > 0 
                      ? Math.round((taskProgress.processed / taskProgress.total) * 100)
                      : 0}%
                  </p>
                  <p className="text-xs text-blue-600">Complete</p>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-blue-200 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-blue-600 h-full rounded-full transition-all duration-500 ease-out"
                  style={{ 
                    width: `${taskProgress.total > 0 
                      ? (taskProgress.processed / taskProgress.total) * 100 
                      : 0}%` 
                  }}
                />
              </div>
              
              <Alert className="border-blue-300 bg-white">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  Please wait while we process your bulk action. This may take a few moments.
                  You can continue working on other tasks, and we'll notify you when it's complete.
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Applications</p>
                  <p className="text-3xl font-bold">{statistics.total_applications}</p>
                </div>
                <Users className="w-10 h-10 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Pending Review</p>
                  <p className="text-3xl font-bold text-yellow-600">{statistics.pending}</p>
                </div>
                <Clock className="w-10 h-10 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Approved</p>
                  <p className="text-3xl font-bold text-green-600">{statistics.approved}</p>
                </div>
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Avg Score</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {statistics.average_score?.toFixed(1) || 'N/A'}
                  </p>
                </div>
                <TrendingUp className="w-10 h-10 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Course Applications</CardTitle>
              <CardDescription>Review and manage all course applications</CardDescription>
            </div>
            <Button onClick={handleExport} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search by name or email..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
                  className="pl-10"
                />
              </div>
            </div>

            <Select
              value={filters.course_id || undefined}
              onValueChange={(value) => setFilters({ ...filters, course_id: value || '', page: 1 })}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Courses" />
              </SelectTrigger>
              <SelectContent>
                {courses.map(course => (
                  <SelectItem key={course.id} value={course.id.toString()}>
                    {course.title} ({course.applications_count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.status}
              onValueChange={(value) => setFilters({ ...filters, status: value, page: 1 })}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="waitlisted">Waitlisted</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.sort_by}
              onValueChange={(value) => setFilters({ ...filters, sort_by: value, page: 1 })}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="submission_date">Submission Date</SelectItem>
                <SelectItem value="final_rank">Final Rank</SelectItem>
                <SelectItem value="application_score">Application Score</SelectItem>
                <SelectItem value="readiness_score">Readiness Score</SelectItem>
                <SelectItem value="risk_score">Risk Score</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Bulk Actions Bar */}
          {selectedApplicationIds.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-blue-900">
                    {selectedApplicationIds.length} application(s) selected
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleBulkActionClick('approve')}
                    disabled={actionLoading}
                  >
                    <ThumbsUp className="w-4 h-4 mr-1" />
                    Bulk Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleBulkActionClick('waitlist')}
                    disabled={actionLoading}
                  >
                    <Pause className="w-4 h-4 mr-1" />
                    Bulk Waitlist
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleBulkActionClick('reject')}
                    disabled={actionLoading}
                  >
                    <ThumbsDown className="w-4 h-4 mr-1" />
                    Bulk Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedApplicationIds([])}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400" />
              <p className="text-gray-500 mt-2">Loading applications...</p>
            </div>
          ) : applications.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto text-gray-400" />
              <p className="text-gray-500 mt-2">No applications found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Select All Checkbox */}
              {applications.length > 0 && (
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <input
                    type="checkbox"
                    checked={selectedApplicationIds.length === applications.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Select All ({applications.length})
                  </span>
                </div>
              )}
              
              {applications.map((application) => (
                <div
                  key={application.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    {/* Selection Checkbox */}
                    <input
                      type="checkbox"
                      checked={selectedApplicationIds.includes(application.id)}
                      onChange={() => toggleSelectApplication(application.id)}
                      className="mt-1 w-4 h-4 rounded border-gray-300"
                      onClick={(e) => e.stopPropagation()}
                    />
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">{application.full_name}</h3>
                        {getStatusBadge(application.status)}
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600 mb-3">
                        <div>
                          <span className="font-medium">Email:</span> {application.email}
                        </div>
                        <div>
                          <span className="font-medium">Phone:</span> {application.phone}
                        </div>
                        <div>
                          <span className="font-medium">Excel Level:</span>{' '}
                          {application.excel_skill_level?.replace('_', ' ')}
                        </div>
                        <div>
                          <span className="font-medium">Location:</span>{' '}
                          {application.city}, {application.country}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-3">
                        {getScoreBadge(application.final_rank, 'Final Rank')}
                        {getScoreBadge(application.application_score, 'App')}
                        {getScoreBadge(application.readiness_score, 'Readiness')}
                        {getScoreBadge(application.commitment_score, 'Commitment')}
                        {getScoreBadge(application.risk_score, 'Risk')}
                      </div>

                      <p className="text-xs text-gray-500">
                        Submitted: {new Date(application.submission_date).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewDetails(application)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View Details
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedApplication(application);
                          setNewStatus(application.status);
                          setStatusChangeModalOpen(true);
                        }}
                        disabled={actionLoading}
                      >
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Change Status
                      </Button>
                      
                      {application.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleApprove(application.id)}
                            disabled={actionLoading}
                          >
                            <ThumbsUp className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setSelectedApplication(application);
                              setDetailModalOpen(true);
                            }}
                            disabled={actionLoading}
                          >
                            <Pause className="w-4 h-4 mr-1" />
                            Waitlist
                          </Button>
                        </>
                      )}
                      
                      {application.status === 'approved' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedApplication(application);
                            setResendEmailModalOpen(true);
                          }}
                          disabled={actionLoading}
                        >
                          <RefreshCw className="w-4 h-4 mr-1" />
                          Resend Email
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {applications.length > 0 && (
            <div className="flex justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters({ ...filters, page: Math.max(1, filters.page - 1) })}
                disabled={filters.page === 1}
              >
                Previous
              </Button>
              <span className="px-4 py-2 text-sm">Page {filters.page}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                disabled={applications.length < filters.per_page}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedApplication && (
            <>
              <DialogHeader>
                <DialogTitle>Application Details</DialogTitle>
                <DialogDescription>
                  Review complete application information and take action
                </DialogDescription>
              </DialogHeader>

              {actionError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{actionError}</AlertDescription>
                </Alert>
              )}

              <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="motivation">Motivation</TabsTrigger>
                  <TabsTrigger value="actions">Actions</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Full Name</Label>
                      <p className="font-medium">{selectedApplication.full_name}</p>
                    </div>
                    <div>
                      <Label>Email</Label>
                      <p className="font-medium">{selectedApplication.email}</p>
                    </div>
                    <div>
                      <Label>Phone</Label>
                      <p className="font-medium">{selectedApplication.phone}</p>
                    </div>
                    <div>
                      <Label>WhatsApp</Label>
                      <p className="font-medium">{selectedApplication.whatsapp_number || 'N/A'}</p>
                    </div>
                    <div>
                      <Label>Gender</Label>
                      <p className="font-medium">{selectedApplication.gender || 'N/A'}</p>
                    </div>
                    <div>
                      <Label>Age Range</Label>
                      <p className="font-medium">{selectedApplication.age_range || 'N/A'}</p>
                    </div>
                    <div>
                      <Label>Country</Label>
                      <p className="font-medium">{selectedApplication.country}</p>
                    </div>
                    <div>
                      <Label>City</Label>
                      <p className="font-medium">{selectedApplication.city}</p>
                    </div>
                    <div>
                      <Label>Education Level</Label>
                      <p className="font-medium">{selectedApplication.education_level || 'N/A'}</p>
                    </div>
                    <div>
                      <Label>Current Status</Label>
                      <p className="font-medium">{selectedApplication.current_status || 'N/A'}</p>
                    </div>
                    <div>
                      <Label>Field of Study</Label>
                      <p className="font-medium">{selectedApplication.field_of_study || 'N/A'}</p>
                    </div>
                    <div>
                      <Label>Excel Skill Level</Label>
                      <p className="font-medium">{selectedApplication.excel_skill_level}</p>
                    </div>
                    <div>
                      <Label>Has Computer</Label>
                      <p className="font-medium">{selectedApplication.has_computer ? 'Yes' : 'No'}</p>
                    </div>
                    <div>
                      <Label>Internet Access</Label>
                      <p className="font-medium">{selectedApplication.internet_access_type || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3 pt-4 border-t">
                    {getScoreBadge(selectedApplication.final_rank, 'Final Rank')}
                    {getScoreBadge(selectedApplication.application_score, 'Application')}
                    {getScoreBadge(selectedApplication.readiness_score, 'Readiness')}
                    {getScoreBadge(selectedApplication.commitment_score, 'Commitment')}
                    {getScoreBadge(selectedApplication.risk_score, 'Risk')}
                  </div>
                </TabsContent>

                <TabsContent value="motivation" className="space-y-4">
                  <div>
                    <Label>Why do you want to join this course?</Label>
                    <p className="text-sm mt-2 whitespace-pre-wrap">{selectedApplication.motivation}</p>
                  </div>
                  <div>
                    <Label>Learning Outcomes</Label>
                    <p className="text-sm mt-2 whitespace-pre-wrap">{selectedApplication.learning_outcomes || 'Not provided'}</p>
                  </div>
                  <div>
                    <Label>Career Impact</Label>
                    <p className="text-sm mt-2 whitespace-pre-wrap">{selectedApplication.career_impact || 'Not provided'}</p>
                  </div>
                  <div>
                    <Label>Referral Source</Label>
                    <p className="text-sm mt-2">{selectedApplication.referral_source || 'Not provided'}</p>
                  </div>
                </TabsContent>

                <TabsContent value="actions" className="space-y-4">
                  <div>
                    <Label htmlFor="notes">Admin Notes</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={4}
                      placeholder="Add internal notes about this application..."
                    />
                    <Button
                      onClick={() => handleUpdateNotes(selectedApplication.id)}
                      disabled={actionLoading}
                      className="mt-2"
                      size="sm"
                    >
                      Save Notes
                    </Button>
                  </div>

                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      onClick={() => handleRecalculateScores(selectedApplication.id)}
                      disabled={actionLoading}
                      variant="outline"
                      size="sm"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Recalculate Scores
                    </Button>
                  </div>

                  {selectedApplication.status === 'pending' && (
                    <div className="space-y-4 pt-4 border-t">
                      <Button
                        onClick={() => handleApprove(selectedApplication.id)}
                        disabled={actionLoading}
                        className="w-full"
                      >
                        <ThumbsUp className="w-4 h-4 mr-2" />
                        Approve Application
                      </Button>

                      <Button
                        onClick={() => handleWaitlist(selectedApplication.id)}
                        disabled={actionLoading}
                        variant="secondary"
                        className="w-full"
                      >
                        <Pause className="w-4 h-4 mr-2" />
                        Move to Waitlist
                      </Button>

                      <div>
                        <Label htmlFor="rejection_reason">Rejection Reason</Label>
                        <Textarea
                          id="rejection_reason"
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          rows={3}
                          placeholder="Provide a reason for rejection..."
                        />
                        <Button
                          onClick={() => handleReject(selectedApplication.id, rejectionReason)}
                          disabled={actionLoading || !rejectionReason.trim()}
                          variant="destructive"
                          className="w-full mt-2"
                        >
                          <ThumbsDown className="w-4 h-4 mr-2" />
                          Reject Application
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {selectedApplication.status === 'approved' && (
                    <div className="space-y-4 pt-4 border-t">
                      <Alert className="bg-green-50 border-green-200">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-900">
                          This application has been approved and the student is enrolled.
                        </AlertDescription>
                      </Alert>
                      
                      <Button
                        onClick={() => setResendEmailModalOpen(true)}
                        disabled={actionLoading}
                        variant="outline"
                        className="w-full"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Resend Approval Email
                      </Button>
                    </div>
                  )}
                  
                  {selectedApplication.status === 'waitlisted' && (
                    <div className="space-y-4 pt-4 border-t">
                      <Alert className="bg-yellow-50 border-yellow-200">
                        <Clock className="h-4 w-4 text-yellow-600" />
                        <AlertDescription className="text-yellow-900">
                          This application is on the waitlist.
                        </AlertDescription>
                      </Alert>
                      
                      <Button
                        onClick={() => handlePromoteFromWaitlist(selectedApplication.id)}
                        disabled={actionLoading}
                        className="w-full"
                      >
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Promote to Pending Review
                      </Button>
                      
                      <Button
                        onClick={() => setWaitlistModalOpen(true)}
                        disabled={actionLoading}
                        variant="outline"
                        className="w-full"
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Send Waitlist Update
                      </Button>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Action Modal */}
      <Dialog open={bulkActionModalOpen} onOpenChange={setBulkActionModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Bulk {bulkAction && bulkAction.charAt(0).toUpperCase() + bulkAction.slice(1)} Applications
            </DialogTitle>
            <DialogDescription>
              You are about to {bulkAction} {selectedApplicationIds.length} application(s)
            </DialogDescription>
          </DialogHeader>

          {actionError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            {bulkAction === 'approve' && (
              <div>
                <Label htmlFor="bulk_custom_message">Custom Welcome Message (Optional)</Label>
                <Textarea
                  id="bulk_custom_message"
                  value={bulkCustomMessage}
                  onChange={(e) => setBulkCustomMessage(e.target.value)}
                  rows={4}
                  placeholder="Add a personalized message for the welcome email..."
                />
              </div>
            )}

            {bulkAction === 'reject' && (
              <div>
                <Label htmlFor="bulk_rejection_reason">Rejection Reason (Required)</Label>
                <Textarea
                  id="bulk_rejection_reason"
                  value={bulkRejectionReason}
                  onChange={(e) => setBulkRejectionReason(e.target.value)}
                  rows={4}
                  placeholder="Provide a reason for rejection..."
                  className={!bulkRejectionReason.trim() ? 'border-red-500' : ''}
                />
                {!bulkRejectionReason.trim() && (
                  <p className="text-sm text-red-600 mt-1">Rejection reason is required</p>
                )}
              </div>
            )}

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {bulkAction === 'approve' && 'This will create user accounts and enroll selected applicants in their courses. They will receive welcome emails with login credentials.'}
                {bulkAction === 'reject' && 'This will reject all selected applications and send rejection emails to the applicants.'}
                {bulkAction === 'waitlist' && 'This will move selected applications to the waitlist and send notification emails.'}
              </AlertDescription>
            </Alert>

            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setBulkActionModalOpen(false);
                  setBulkRejectionReason('');
                  setBulkCustomMessage('');
                  setActionError(null);
                }}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={executeBulkAction}
                disabled={actionLoading || (bulkAction === 'reject' && !bulkRejectionReason.trim())}
                variant={bulkAction === 'reject' ? 'destructive' : 'default'}
              >
                {actionLoading ? 'Processing...' : `${bulkAction && bulkAction.charAt(0).toUpperCase() + bulkAction.slice(1)} ${selectedApplicationIds.length} Application(s)`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resend Approval Email Modal */}
      <Dialog open={resendEmailModalOpen} onOpenChange={setResendEmailModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resend Approval Email</DialogTitle>
            <DialogDescription>
              Resend the approval and welcome email to {selectedApplication?.full_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {actionError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="whitespace-pre-wrap">{actionError}</AlertDescription>
              </Alert>
            )}

            <div className="flex items-center space-x-2">
              <Checkbox
                id="include_credentials"
                checked={resendWithCredentials}
                onCheckedChange={(checked) => setResendWithCredentials(checked as boolean)}
              />
              <Label htmlFor="include_credentials" className="cursor-pointer">
                Reset password and send new credentials
              </Label>
            </div>

            {resendWithCredentials && (
              <Alert className="bg-yellow-50 border-yellow-200">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-900">
                  This will generate a new temporary password and force the user to change it on next login.
                </AlertDescription>
              </Alert>
            )}

            <div>
              <Label htmlFor="resend_message">Custom Message (Optional)</Label>
              <Textarea
                id="resend_message"
                value={resendCustomMessage}
                onChange={(e) => setResendCustomMessage(e.target.value)}
                rows={3}
                placeholder="Add a custom message to include in the email..."
              />
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setResendEmailModalOpen(false);
                  setResendWithCredentials(false);
                  setResendCustomMessage('');
                  setActionError(null);
                }}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleResendApprovalEmail}
                disabled={actionLoading}
              >
                {actionLoading ? 'Sending...' : 'Resend Email'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Waitlist Update Modal */}
      <Dialog open={waitlistModalOpen} onOpenChange={setWaitlistModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Waitlist Update</DialogTitle>
            <DialogDescription>
              Send a custom update email to {selectedApplication?.full_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {actionError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="whitespace-pre-wrap">{actionError}</AlertDescription>
              </Alert>
            )}

            <div>
              <Label htmlFor="waitlist_message">Update Message *</Label>
              <Textarea
                id="waitlist_message"
                value={waitlistUpdateMessage}
                onChange={(e) => setWaitlistUpdateMessage(e.target.value)}
                rows={5}
                placeholder="Enter the update message to send to the applicant..."
                className={!waitlistUpdateMessage.trim() ? 'border-red-500' : ''}
              />
              {!waitlistUpdateMessage.trim() && (
                <p className="text-sm text-red-600 mt-1">Message is required</p>
              )}
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This will send a personalized update email to the applicant about their waitlist status.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setWaitlistModalOpen(false);
                  setWaitlistUpdateMessage('');
                  setActionError(null);
                }}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendWaitlistUpdate}
                disabled={actionLoading || !waitlistUpdateMessage.trim()}
              >
                {actionLoading ? 'Sending...' : 'Send Update'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Status Change Modal */}
      <Dialog open={statusChangeModalOpen} onOpenChange={setStatusChangeModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change Application Status</DialogTitle>
            <DialogDescription>
              Update the status for {selectedApplication?.full_name}'s application
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {actionError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="whitespace-pre-wrap">{actionError}</AlertDescription>
              </Alert>
            )}

            <div>
              <Label htmlFor="status_select">New Status *</Label>
              <select
                id="status_select"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">-- Select Status --</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="waitlisted">Waitlisted</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
              {!newStatus && (
                <p className="text-sm text-red-600 mt-1">Please select a status</p>
              )}
            </div>

            <div>
              <Label htmlFor="status_reason">Reason (Optional)</Label>
              <Textarea
                id="status_reason"
                value={statusChangeReason}
                onChange={(e) => setStatusChangeReason(e.target.value)}
                rows={3}
                placeholder="Provide a reason for this status change (optional)..."
              />
              <p className="text-xs text-gray-500 mt-1">
                This reason will be logged for audit purposes.
              </p>
            </div>

            {selectedApplication && newStatus && newStatus !== selectedApplication.status && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Changing status from <strong>{selectedApplication.status}</strong> to <strong>{newStatus}</strong>.
                  {newStatus === 'approved' && ' This will enroll the student in the course.'}
                  {newStatus === 'rejected' && ' This will send a rejection notification email.'}
                  {newStatus === 'waitlisted' && ' This will move the applicant to the waitlist.'}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setStatusChangeModalOpen(false);
                  setNewStatus('');
                  setStatusChangeReason('');
                  setActionError(null);
                }}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleChangeStatus}
                disabled={actionLoading || !newStatus || newStatus === selectedApplication?.status}
              >
                {actionLoading ? 'Updating...' : 'Update Status'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
