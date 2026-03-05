'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import contentAssignmentService from '@/services/contentAssignmentApi';
import type { ContentAssignment as ApiContentAssignment } from '@/services/contentAssignmentApi';
import { EnhancedAssignmentPanel } from '@/components/assignments/EnhancedAssignmentPanel';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Edit3,
  RefreshCw,
} from 'lucide-react';

export default function AssignmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const assignmentId = Number(params.id);

  const [assignment, setAssignment] = useState<ApiContentAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssignment = useCallback(async () => {
    if (!assignmentId || isNaN(assignmentId)) {
      setError('Invalid assignment ID');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await contentAssignmentService.getAssignmentDetails(assignmentId);
      setAssignment(data);
    } catch (err: any) {
      console.error('Error fetching assignment:', err);
      setError(err?.message || 'Failed to load assignment details');
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    fetchAssignment();
  }, [fetchAssignment]);

  const handleSubmit = () => {
    // Refresh assignment data after submission
    fetchAssignment();
  };

  const handleSubmitComplete = () => {
    fetchAssignment();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-green-600 mx-auto" />
          <p className="text-gray-600 dark:text-gray-400">Loading assignment...</p>
        </div>
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <Button variant="ghost" onClick={() => router.push('/student/assessments')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Assessments
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error || 'Assignment not found'}</AlertDescription>
        </Alert>
        <Button onClick={fetchAssignment} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const needsRevision = assignment.modification_requested && assignment.can_resubmit;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
      {/* Back Navigation */}
      <Button
        variant="ghost"
        onClick={() => router.push('/student/assessments')}
        className="mb-2"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Assessments
      </Button>

      {/* Needs Revision Banner */}
      {needsRevision && (
        <Alert className="border-orange-300 bg-orange-50 dark:bg-orange-950/20">
          <Edit3 className="h-4 w-4 text-orange-600" />
          <AlertTitle className="text-orange-800 dark:text-orange-300">
            Revision Requested
          </AlertTitle>
          <AlertDescription className="text-orange-700 dark:text-orange-400">
            {assignment.modification_request_reason ||
              'Your instructor has requested modifications to your submission. Please review the feedback and resubmit.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Assignment Panel */}
      <EnhancedAssignmentPanel
        assignment={assignment as any}
        onSubmit={handleSubmit}
        onSubmitComplete={handleSubmitComplete}
      />
    </div>
  );
}
