"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import InstructorApiService from '@/services/api/instructor.service';
import { 
  Users, 
  UserCheck, 
  UserX, 
  AlertTriangle, 
  Clock, 
  Mail, 
  Shield,
  RefreshCw,
  Calendar,
  TrendingDown,
  Activity
} from 'lucide-react';
import { motion } from 'framer-motion';

interface InactiveStudent {
  student_id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  last_study_activity: string | null;
  last_general_activity: string | null;
  days_inactive: number;
  enrolled_courses: Array<{
    course_id: number;
    course_title: string;
    enrollment_id: number;
    enrollment_date: string;
    progress: number;
  }>;
}

interface StudentAnalysis {
  total_students: number;
  active_students: number;
  inactive_students: number;
  at_risk_students: number;
  activity_rate: number;
  students_by_course: Record<string, {
    course_id: number;
    total: number;
    active: number;
    inactive: number;
    inactive_rate: number;
  }>;
  recommendations: Array<{
    type: 'warning' | 'info' | 'urgent';
    title: string;
    message: string;
    action: string;
  }>;
  last_updated: string;
}

interface StudentActivityAnalysisProps {
  onTerminateStudent?: (studentId: number, reason: string) => void;
  onSendWarnings?: () => void;
}

const StudentActivityAnalysis: React.FC<StudentActivityAnalysisProps> = ({ 
  onTerminateStudent,
  onSendWarnings 
}) => {
  const [analysis, setAnalysis] = useState<StudentAnalysis | null>(null);
  const [inactiveStudents, setInactiveStudents] = useState<InactiveStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [terminating, setTerminating] = useState<number | null>(null);
  const [sendingWarnings, setSendingWarnings] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<Set<number>>(new Set());
  const [bulkTerminating, setBulkTerminating] = useState(false);
  const [pollTasks, setPollTasks] = useState<{
    analysis?: string, 
    inactive?: string, 
    warnings?: string
  }>({});

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Start both tasks
      const [analysisResponse, inactiveResponse] = await Promise.all([
        InstructorApiService.getStudentAnalysis(),
        InstructorApiService.getInactiveStudents()
      ]);

      // Handle analysis response
      if (analysisResponse.task_id) {
        setPollTasks(prev => ({ ...prev, analysis: analysisResponse.task_id }));
        pollForAnalysis(analysisResponse.task_id);
      } else if (analysisResponse.analysis) {
        setAnalysis(analysisResponse.analysis);
      }

      // Handle inactive students response
      if (inactiveResponse.task_id) {
        setPollTasks(prev => ({ ...prev, inactive: inactiveResponse.task_id }));
        pollForInactiveStudents(inactiveResponse.task_id);
      } else if (inactiveResponse.inactive_students) {
        setInactiveStudents(inactiveResponse.inactive_students);
      }

      // Only set loading to false when we have initial responses (even if polling)
      setLoading(false);

    } catch (err: any) {
      setError(err.message || 'Failed to fetch student data');
      setLoading(false);
    }
  };

  const pollForAnalysis = async (taskId: string) => {
    try {
      const response = await InstructorApiService.getStudentAnalysisStatus(taskId);
      
      if (response.analysis) {
        setAnalysis(response.analysis);
        setPollTasks(prev => ({ ...prev, analysis: undefined }));
      } else if (response.status === 'failed') {
        setError(response.error || 'Analysis failed');
        setPollTasks(prev => ({ ...prev, analysis: undefined }));
      } else if (response.status === 'running' || response.status === 'started') {
        // Poll again in 2 seconds
        setTimeout(() => pollForAnalysis(taskId), 2000);
      }
    } catch (err) {
      console.error('Error polling for analysis:', err);
      setTimeout(() => pollForAnalysis(taskId), 3000); // Retry after 3 seconds
    }
  };

  const pollForInactiveStudents = async (taskId: string) => {
    try {
      const response = await InstructorApiService.getInactiveStudentsStatus(taskId);
      
      if (response.inactive_students) {
        setInactiveStudents(response.inactive_students);
        setPollTasks(prev => ({ ...prev, inactive: undefined }));
      } else if (response.status === 'failed') {
        setError(response.error || 'Failed to fetch inactive students');
        setPollTasks(prev => ({ ...prev, inactive: undefined }));
      } else if (response.status === 'running' || response.status === 'started') {
        // Poll again in 2 seconds
        setTimeout(() => pollForInactiveStudents(taskId), 2000);
      }
    } catch (err) {
      console.error('Error polling for inactive students:', err);
      setTimeout(() => pollForInactiveStudents(taskId), 3000); // Retry after 3 seconds
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTerminateStudent = async (studentId: number, reason: string = 'Inactivity') => {
    try {
      setTerminating(studentId);
      
      await InstructorApiService.terminateStudent(studentId, reason);

      // Refresh data
      await fetchData();
      
      // Clear selection
      setSelectedStudents(new Set());
      
      if (onTerminateStudent) {
        onTerminateStudent(studentId, reason);
      }

    } catch (err: any) {
      setError(err.message || 'Failed to terminate student');
    } finally {
      setTerminating(null);
    }
  };

  const handleBulkTerminate = async () => {
    if (selectedStudents.size === 0) return;

    try {
      setBulkTerminating(true);
      
      await InstructorApiService.bulkTerminateStudents(
        Array.from(selectedStudents),
        'Bulk inactivity termination'
      );

      // Refresh data
      await fetchData();
      
      // Clear selection
      setSelectedStudents(new Set());

    } catch (err: any) {
      setError(err.message || 'Failed to bulk terminate students');
    } finally {
      setBulkTerminating(false);
    }
  };

  const handleSendWarnings = async () => {
    try {
      setSendingWarnings(true);
      
      const response = await InstructorApiService.sendInactivityWarnings(5);
      
      if (response.task_id) {
        setPollTasks(prev => ({ ...prev, warnings: response.task_id }));
        pollForWarnings(response.task_id);
      } else {
        // Handle immediate response (shouldn't happen with async implementation)
        if (onSendWarnings) {
          onSendWarnings();
        }
        alert(`Sent ${response.warnings_sent} inactivity warnings`);
        setSendingWarnings(false);
      }

    } catch (err: any) {
      setError(err.message || 'Failed to send warnings');
      setSendingWarnings(false);
    }
  };

  const pollForWarnings = async (taskId: string) => {
    try {
      const response = await InstructorApiService.getSendWarningsStatus(taskId);
      
      if (response.warnings_sent !== undefined) {
        // Task completed
        setPollTasks(prev => ({ ...prev, warnings: undefined }));
        setSendingWarnings(false);
        
        if (onSendWarnings) {
          onSendWarnings();
        }
        
        alert(`Sent ${response.warnings_sent} inactivity warnings to ${response.total_at_risk} students`);
      } else if (response.status === 'failed') {
        setError(response.error || 'Failed to send warnings');
        setPollTasks(prev => ({ ...prev, warnings: undefined }));
        setSendingWarnings(false);
      } else if (response.status === 'running' || response.status === 'started') {
        // Poll again in 2 seconds
        setTimeout(() => pollForWarnings(taskId), 2000);
      }
    } catch (err) {
      console.error('Error polling for warnings status:', err);
      setTimeout(() => pollForWarnings(taskId), 3000); // Retry after 3 seconds
    }
  };

  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'urgent': return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'info': return <Activity className="w-5 h-5 text-blue-500" />;
      default: return <Activity className="w-5 h-5 text-gray-500" />;
    }
  };

  const formatLastActivity = (dateString: string | null) => {
    if (!dateString) return 'Never';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Loading student analysis...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert className="bg-red-50 border-red-200">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription className="text-red-700">{error}</AlertDescription>
        </Alert>
      )}

      {/* Overview Cards */}
      {analysis ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Users className="w-8 h-8 text-blue-500" />
                <div className="ml-4">
                  <p className="text-2xl font-bold">{analysis.total_students}</p>
                  <p className="text-sm text-gray-600">Total Students</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <UserCheck className="w-8 h-8 text-green-500" />
                <div className="ml-4">
                  <p className="text-2xl font-bold">{analysis.active_students}</p>
                  <p className="text-sm text-gray-600">Active Students</p>
                  <p className="text-xs text-green-600">{analysis.activity_rate.toFixed(1)}% active</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <UserX className="w-8 h-8 text-red-500" />
                <div className="ml-4">
                  <p className="text-2xl font-bold">{analysis.inactive_students}</p>
                  <p className="text-sm text-gray-600">Inactive (7+ days)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <AlertTriangle className="w-8 h-8 text-yellow-500" />
                <div className="ml-4">
                  <p className="text-2xl font-bold">{analysis.at_risk_students}</p>
                  <p className="text-sm text-gray-600">At Risk (5-6 days)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : pollTasks.analysis ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-gray-200 rounded animate-pulse" />
                  <div className="ml-4 flex-1">
                    <div className="h-6 bg-gray-200 rounded animate-pulse mb-2" />
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {/* Recommendations */}
      {analysis && analysis.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysis.recommendations.map((rec, index) => (
                <div key={index} className="flex items-start p-3 bg-gray-50 rounded-lg">
                  {getRecommendationIcon(rec.type)}
                  <div className="ml-3 flex-1">
                    <h4 className="font-medium">{rec.title}</h4>
                    <p className="text-sm text-gray-600">{rec.message}</p>
                    <p className="text-xs text-gray-500 mt-1">{rec.action}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button 
          onClick={handleSendWarnings}
          disabled={sendingWarnings || pollTasks.warnings}
          className="flex items-center"
        >
          {(sendingWarnings || pollTasks.warnings) ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Mail className="w-4 h-4 mr-2" />
          )}
          {pollTasks.warnings ? 'Sending Warnings...' : 'Send Inactivity Warnings'}
        </Button>
        
        <Button 
          onClick={fetchData}
          variant="outline"
          className="flex items-center"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Analysis
        </Button>
        
        {selectedStudents.size > 0 && (
          <Button 
            onClick={handleBulkTerminate}
            disabled={bulkTerminating}
            variant="destructive"
            className="flex items-center"
          >
            {bulkTerminating ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
            Terminate Selected ({selectedStudents.size})
          </Button>
        )}
      </div>

      {/* Inactive Students Table */}
      {inactiveStudents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingDown className="w-5 h-5 mr-2" />
              Inactive Students ({inactiveStudents.length})
              {pollTasks.inactive && (
                <div className="ml-2 flex items-center text-orange-600">
                  <RefreshCw className="w-4 h-4 animate-spin mr-1" />
                  <span className="text-sm">Refreshing...</span>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">
                      <input
                        type="checkbox"
                        checked={selectedStudents.size === inactiveStudents.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedStudents(new Set(inactiveStudents.map(s => s.student_id)));
                          } else {
                            setSelectedStudents(new Set());
                          }
                        }}
                      />
                    </th>
                    <th className="text-left p-2">Student</th>
                    <th className="text-left p-2">Last Activity</th>
                    <th className="text-left p-2">Days Inactive</th>
                    <th className="text-left p-2">Courses</th>
                    <th className="text-left p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {inactiveStudents.map((student) => (
                    <motion.tr 
                      key={student.student_id} 
                      className="border-b hover:bg-gray-50"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={selectedStudents.has(student.student_id)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedStudents);
                            if (e.target.checked) {
                              newSelected.add(student.student_id);
                            } else {
                              newSelected.delete(student.student_id);
                            }
                            setSelectedStudents(newSelected);
                          }}
                        />
                      </td>
                      <td className="p-2">
                        <div>
                          <p className="font-medium">{student.first_name} {student.last_name}</p>
                          <p className="text-sm text-gray-500">{student.email}</p>
                        </div>
                      </td>
                      <td className="p-2">
                        <div>
                          <p className="text-sm">Study: {formatLastActivity(student.last_study_activity)}</p>
                          <p className="text-xs text-gray-500">Login: {formatLastActivity(student.last_general_activity)}</p>
                        </div>
                      </td>
                      <td className="p-2">
                        <Badge variant={student.days_inactive >= 14 ? "destructive" : student.days_inactive >= 10 ? "secondary" : "outline"}>
                          {student.days_inactive} days
                        </Badge>
                      </td>
                      <td className="p-2">
                        <div className="text-sm">
                          {student.enrolled_courses.map((course, index) => (
                            <div key={course.course_id} className="truncate">
                              {course.course_title} ({Math.round(course.progress * 100)}%)
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="p-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleTerminateStudent(student.student_id)}
                          disabled={terminating === student.student_id}
                          className="text-xs"
                        >
                          {terminating === student.student_id ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            'Terminate'
                          )}
                        </Button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {inactiveStudents.length === 0 && !loading && !pollTasks.inactive && (
        <Card>
          <CardContent className="p-8 text-center">
            <UserCheck className="w-12 h-12 mx-auto text-green-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">All Students Active!</h3>
            <p className="text-gray-600">No students have been inactive for 7+ days.</p>
          </CardContent>
        </Card>
      )}

      {pollTasks.inactive && inactiveStudents.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <RefreshCw className="w-12 h-12 mx-auto text-blue-500 mb-4 animate-spin" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Checking for Inactive Students</h3>
            <p className="text-gray-600">Analyzing student activity patterns...</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StudentActivityAnalysis;