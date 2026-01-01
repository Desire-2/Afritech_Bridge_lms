'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import applicationService from '@/services/api/application.service';
import instructorService from '@/services/api/instructor.service';
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

export default function InstructorApplicationsManager() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<CourseApplication[]>([]);
  const [instructorCourses, setInstructorCourses] = useState<any[]>([]);
  const [statistics, setStatistics] = useState<ApplicationStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
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

  useEffect(() => {
    loadInstructorCourses();
  }, [user]);

  useEffect(() => {
    if (instructorCourses.length > 0) {
      loadApplications();
      loadStatistics();
    }
  }, [filters, instructorCourses]);

  const loadInstructorCourses = async () => {
    if (!user) return;
    
    try {
      const data = await instructorService.getInstructorCourses();
      setInstructorCourses(data.courses || []);
    } catch (err) {
      console.error('Failed to load instructor courses:', err);
    }
  };

  const loadApplications = async () => {
    setLoading(true);
    setError(null);
    try {
      // Filter applications by instructor's courses only
      const courseIds = instructorCourses.map(c => c.id);
      
      const response = await applicationService.listApplications(
        filters.status !== 'all' ? filters.status : undefined,
        filters.course_id ? parseInt(filters.course_id) : undefined,
        filters.search || undefined,
        filters.sort_by,
        filters.sort_order,
        filters.page,
        filters.per_page
      );
      
      // Filter to only show applications for instructor's courses
      const filteredApps = (response.applications || []).filter(
        app => courseIds.includes(app.course_id)
      );
      
      setApplications(filteredApps);
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
      await applicationService.approveApplication(applicationId);
      await loadApplications();
      await loadStatistics();
      setDetailModalOpen(false);
      setSelectedApplication(null);
    } catch (err: any) {
      setActionError(err.message || 'Failed to approve application');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (applicationId: number, reason: string) => {
    if (!reason.trim()) {
      setActionError('Please provide a reason for rejection');
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
    } catch (err: any) {
      setActionError(err.message || 'Failed to reject application');
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
    } catch (err: any) {
      setActionError(err.message || 'Failed to waitlist application');
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
    } catch (err: any) {
      setActionError(err.message || 'Failed to update notes');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecalculateScores = async (applicationId: number) => {
    setActionLoading(true);
    setActionError(null);
    try {
      await applicationService.recalculateScores(applicationId);
      await loadApplications();
      if (selectedApplication) {
        const updated = await applicationService.getApplication(applicationId);
        setSelectedApplication(updated);
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to recalculate scores');
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
              <CardTitle>My Course Applications</CardTitle>
              <CardDescription>Review and manage applications for your courses</CardDescription>
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
              {applications.map((application) => (
                <div
                  key={application.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
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
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
