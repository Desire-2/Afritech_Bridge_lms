/**
 * Bulk Operations Component for Managing Multiple Submissions
 * Allows instructors to perform batch operations on submissions and files
 */

import React, { useState, useEffect } from 'react';
import {
  Download,
  Archive,
  CheckSquare,
  Square,
  Filter,
  Search,
  X,
  FileText,
  Users,
  Calendar,
  MoreVertical,
  Eye,
  MessageSquare,
  Star,
  Clock,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { EnhancedFileService } from '@/services/enhanced-file.service';

interface SubmissionItem {
  id: number;
  student_id: number;
  student_name: string;
  student_email: string;
  submitted_at: string;
  grade?: number;
  feedback?: string;
  files: Array<{
    id: string;
    filename: string;
    file_url: string;
    file_size?: number;
  }>;
  status: 'pending' | 'graded' | 'late' | 'missing';
  assignment_title: string;
  max_points: number;
}

interface BulkOperationsProps {
  submissions: SubmissionItem[];
  assignmentTitle: string;
  onSelectionChange?: (selectedIds: number[]) => void;
  onBulkDownload?: (submissionIds: number[]) => void;
  onBulkGrade?: (submissionIds: number[]) => void;
  className?: string;
}

const BulkOperations: React.FC<BulkOperationsProps> = ({
  submissions,
  assignmentTitle,
  onSelectionChange,
  onBulkDownload,
  onBulkGrade,
  className = ''
}) => {
  const [selectedSubmissions, setSelectedSubmissions] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'graded' | 'late' | 'missing'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'grade' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [downloading, setDownloading] = useState(false);

  // Notify parent of selection changes
  useEffect(() => {
    onSelectionChange?.(Array.from(selectedSubmissions));
  }, [selectedSubmissions, onSelectionChange]);

  // Filter and sort submissions
  const filteredSubmissions = submissions
    .filter(submission => {
      const matchesSearch = submission.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           submission.student_email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || submission.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.student_name.localeCompare(b.student_name);
          break;
        case 'date':
          comparison = new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
          break;
        case 'grade':
          const aGrade = a.grade ?? -1;
          const bGrade = b.grade ?? -1;
          comparison = aGrade - bGrade;
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });

  const handleSelectAll = () => {
    if (selectedSubmissions.size === filteredSubmissions.length) {
      setSelectedSubmissions(new Set());
    } else {
      setSelectedSubmissions(new Set(filteredSubmissions.map(s => s.id)));
    }
  };

  const handleSelectSubmission = (submissionId: number, selected: boolean) => {
    const newSelection = new Set(selectedSubmissions);
    if (selected) {
      newSelection.add(submissionId);
    } else {
      newSelection.delete(submissionId);
    }
    setSelectedSubmissions(newSelection);
  };

  const handleBulkDownload = async () => {
    if (selectedSubmissions.size === 0) return;
    
    setDownloading(true);
    try {
      const selectedIds = Array.from(selectedSubmissions);
      
      if (onBulkDownload) {
        onBulkDownload(selectedIds);
      } else {
        // Default implementation - download each submission
        for (const submissionId of selectedIds) {
          try {
            const { blob, filename } = await EnhancedFileService.downloadSubmissionFiles(submissionId);
            EnhancedFileService.triggerFileDownload(blob, filename);
            
            // Small delay to prevent overwhelming the browser
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (error) {
            console.error(`Failed to download submission ${submissionId}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Bulk download failed:', error);
    } finally {
      setDownloading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'graded':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'late':
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'missing':
        return <X className="w-4 h-4 text-red-500" />;
      default:
        return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'graded':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'late':
        return 'bg-orange-100 text-orange-800';
      case 'missing':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSubmissionStats = () => {
    const total = submissions.length;
    const pending = submissions.filter(s => s.status === 'pending').length;
    const graded = submissions.filter(s => s.status === 'graded').length;
    const late = submissions.filter(s => s.status === 'late').length;
    const missing = submissions.filter(s => s.status === 'missing').length;
    
    return { total, pending, graded, late, missing };
  };

  const stats = getSubmissionStats();

  return (
    <div className={`bg-white rounded-lg border shadow-sm ${className}`}>
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Bulk Operations - {assignmentTitle}
            </h3>
            <p className="text-sm text-gray-500">
              {stats.total} submissions • {stats.pending} pending • {stats.graded} graded
            </p>
          </div>

          {/* Bulk Actions */}
          {selectedSubmissions.size > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                {selectedSubmissions.size} selected
              </span>
              <button
                onClick={handleBulkDownload}
                disabled={downloading}
                className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400 text-sm flex items-center space-x-1"
              >
                <Archive className="w-4 h-4" />
                <span>{downloading ? 'Downloading...' : 'Download All'}</span>
              </button>
              {onBulkGrade && (
                <button
                  onClick={() => onBulkGrade(Array.from(selectedSubmissions))}
                  className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm flex items-center space-x-1"
                >
                  <Star className="w-4 h-4" />
                  <span>Bulk Grade</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Search and Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status ({stats.total})</option>
            <option value="pending">Pending ({stats.pending})</option>
            <option value="graded">Graded ({stats.graded})</option>
            <option value="late">Late ({stats.late})</option>
            <option value="missing">Missing ({stats.missing})</option>
          </select>

          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split('-');
              setSortBy(field as any);
              setSortOrder(order as any);
            }}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="date-desc">Latest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="name-asc">Name A-Z</option>
            <option value="name-desc">Name Z-A</option>
            <option value="grade-desc">Highest Grade</option>
            <option value="grade-asc">Lowest Grade</option>
            <option value="status-asc">Status</option>
          </select>
        </div>
      </div>

      {/* Submissions Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={handleSelectAll}
                  className="flex items-center space-x-2"
                >
                  {selectedSubmissions.size === filteredSubmissions.length && filteredSubmissions.length > 0 ? (
                    <CheckSquare className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Square className="w-4 h-4 text-gray-400" />
                  )}
                  <span className="text-sm font-medium text-gray-700">Select All</span>
                </button>
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Student</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Submitted</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Files</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Grade</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredSubmissions.map((submission) => (
              <tr
                key={submission.id}
                className={`hover:bg-gray-50 ${
                  selectedSubmissions.has(submission.id) ? 'bg-blue-50' : ''
                }`}
              >
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleSelectSubmission(submission.id, !selectedSubmissions.has(submission.id))}
                  >
                    {selectedSubmissions.has(submission.id) ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div>
                    <div className="font-medium text-gray-900">{submission.student_name}</div>
                    <div className="text-sm text-gray-500">{submission.student_email}</div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(submission.status)}`}>
                    {getStatusIcon(submission.status)}
                    <span className="capitalize">{submission.status}</span>
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {new Date(submission.submitted_at).toLocaleDateString()}
                  <div className="text-xs text-gray-500">
                    {new Date(submission.submitted_at).toLocaleTimeString()}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center space-x-1">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-900">{submission.files.length}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {submission.grade !== undefined ? (
                    <div className="text-sm">
                      <span className="font-medium">{submission.grade}</span>
                      <span className="text-gray-500">/{submission.max_points}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">Not graded</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => window.open(`/instructor/grading/assignment/${submission.id}`, '_blank')}
                      className="p-1 text-gray-400 hover:text-blue-600"
                      title="View Submission"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => EnhancedFileService.downloadSubmissionFiles(submission.id)
                        .then(({ blob, filename }) => EnhancedFileService.triggerFileDownload(blob, filename))
                        .catch(console.error)
                      }
                      className="p-1 text-gray-400 hover:text-green-600"
                      title="Download Files"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    {submission.feedback && (
                      <button className="p-1 text-gray-400 hover:text-yellow-600" title="Has Feedback">
                        <MessageSquare className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredSubmissions.length === 0 && (
        <div className="text-center py-8">
          <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="text-gray-500">No submissions match your current filters</p>
        </div>
      )}
    </div>
  );
};

export default BulkOperations;