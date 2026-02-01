/**
 * Enhanced Submission File Manager for Instructor Review
 * Provides comprehensive file review, annotation, and download capabilities
 */

import React, { useState, useCallback } from 'react';
import {
  FileText,
  Download,
  Eye,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  Clock,
  Archive,
  Share,
  Grid,
  List,
  Filter,
  Search,
  X,
  Plus,
  MoreVertical
} from 'lucide-react';
import FilePreview from './FilePreview';
import { FileInfo, parseFileInfo } from '@/utils/fileUtils';

interface SubmissionFile {
  id: string;
  filename: string;
  file_url: string;
  file_size?: number;
  uploaded_at?: string;
  mime_type?: string;
  fileInfo: FileInfo;
}

interface FileComment {
  id: string;
  fileId: string;
  text: string;
  author: string;
  timestamp: string;
}

interface SubmissionFileManagerProps {
  files: SubmissionFile[];
  submissionId: string;
  studentName: string;
  onDownloadSingle?: (fileId: string) => void;
  onDownloadAll?: () => void;
  onAddFileComment?: (fileId: string, comment: string) => void;
  allowComments?: boolean;
  allowDownload?: boolean;
  className?: string;
}

type ViewMode = 'grid' | 'list';
type FilterType = 'all' | 'images' | 'documents' | 'code' | 'other';

const SubmissionFileManager: React.FC<SubmissionFileManagerProps> = ({
  files = [],
  submissionId,
  studentName,
  onDownloadSingle,
  onDownloadAll,
  onAddFileComment,
  allowComments = true,
  allowDownload = true,
  className = ''
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [fileComments, setFileComments] = useState<Record<string, FileComment[]>>({});
  const [expandedPreviews, setExpandedPreviews] = useState<Set<string>>(new Set());

  // Parse file info for all files
  const enrichedFiles = files.map(file => ({
    ...file,
    fileInfo: parseFileInfo(file.filename, file.file_size)
  }));

  // Filter files based on search and type
  const filteredFiles = enrichedFiles.filter(file => {
    const matchesSearch = file.filename.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;
    
    switch (filter) {
      case 'images':
        return file.fileInfo.category === 'image';
      case 'documents':
        return file.fileInfo.category === 'document';
      case 'code':
        return file.fileInfo.category === 'code';
      case 'other':
        return !['image', 'document', 'code'].includes(file.fileInfo.category);
      default:
        return true;
    }
  });

  // Get file statistics
  const getFileStats = () => {
    const totalSize = enrichedFiles.reduce((sum, file) => sum + (file.file_size || 0), 0);
    const categories = enrichedFiles.reduce((acc, file) => {
      acc[file.fileInfo.category] = (acc[file.fileInfo.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { totalSize, categories, totalFiles: enrichedFiles.length };
  };

  const stats = getFileStats();

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 Bytes';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFilterCount = (filterType: FilterType) => {
    switch (filterType) {
      case 'images':
        return stats.categories.image || 0;
      case 'documents':
        return stats.categories.document || 0;
      case 'code':
        return stats.categories.code || 0;
      case 'other':
        return (stats.categories.other || 0) + (stats.categories.archive || 0) + (stats.categories.video || 0) + (stats.categories.audio || 0);
      default:
        return stats.totalFiles;
    }
  };

  const handleFileSelection = (fileId: string, selected: boolean) => {
    const newSelection = new Set(selectedFiles);
    if (selected) {
      newSelection.add(fileId);
    } else {
      newSelection.delete(fileId);
    }
    setSelectedFiles(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedFiles.size === filteredFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(filteredFiles.map(f => f.id)));
    }
  };

  const handleAddComment = (fileId: string, comment: string) => {
    const newComment: FileComment = {
      id: Date.now().toString(),
      fileId,
      text: comment,
      author: 'Instructor', // This should come from context
      timestamp: new Date().toISOString()
    };

    setFileComments(prev => ({
      ...prev,
      [fileId]: [...(prev[fileId] || []), newComment]
    }));

    onAddFileComment?.(fileId, comment);
  };

  const togglePreview = (fileId: string) => {
    const newExpanded = new Set(expandedPreviews);
    if (newExpanded.has(fileId)) {
      newExpanded.delete(fileId);
    } else {
      newExpanded.add(fileId);
    }
    setExpandedPreviews(newExpanded);
  };

  const renderFileCard = (file: SubmissionFile & { fileInfo: FileInfo }) => {
    const isSelected = selectedFiles.has(file.id);
    const comments = fileComments[file.id] || [];
    const isExpanded = expandedPreviews.has(file.id);

    return (
      <div
        key={file.id}
        className={`border rounded-lg overflow-hidden transition-all duration-200 ${
          isSelected 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-200 bg-white hover:border-gray-300'
        }`}
      >
        {viewMode === 'list' ? (
          <FilePreview
            file={file}
            fileInfo={file.fileInfo}
            onDownload={onDownloadSingle}
            onAddComment={allowComments ? handleAddComment : undefined}
            comments={comments}
          />
        ) : (
          // Grid view - compact card
          <div className="p-4">
            <div className="flex items-start justify-between mb-2">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => handleFileSelection(file.id, e.target.checked)}
                className="mt-1"
              />
              <button className="p-1 text-gray-400 hover:text-gray-600">
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col items-center space-y-2">
              <div className={`p-3 rounded-lg ${
                file.fileInfo.viewable 
                  ? 'bg-green-100 text-green-600'
                  : 'bg-blue-100 text-blue-600'
              }`}>
                {file.fileInfo.category === 'image' && <FileText className="w-6 h-6" />}
                {file.fileInfo.category === 'document' && <FileText className="w-6 h-6" />}
                {file.fileInfo.category === 'code' && <FileText className="w-6 h-6" />}
                {!['image', 'document', 'code'].includes(file.fileInfo.category) && <FileText className="w-6 h-6" />}
              </div>

              <div className="text-center">
                <p className="text-sm font-medium text-gray-900 truncate w-full" title={file.filename}>
                  {file.filename}
                </p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(file.file_size || 0)}
                </p>
              </div>

              <div className="flex items-center space-x-2 w-full">
                <button
                  onClick={() => togglePreview(file.id)}
                  className="flex-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                >
                  <Eye className="w-3 h-3 mx-auto" />
                </button>
                {allowDownload && (
                  <button
                    onClick={() => onDownloadSingle?.(file.id)}
                    className="flex-1 px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 rounded"
                  >
                    <Download className="w-3 h-3 mx-auto" />
                  </button>
                )}
                {allowComments && (
                  <button className="flex-1 px-2 py-1 text-xs bg-green-100 hover:bg-green-200 rounded relative">
                    <MessageSquare className="w-3 h-3 mx-auto" />
                    {comments.length > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                        {comments.length}
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>

            {isExpanded && (
              <div className="mt-4 pt-4 border-t">
                <FilePreview
                  file={file}
                  fileInfo={file.fileInfo}
                  onDownload={onDownloadSingle}
                  onAddComment={allowComments ? handleAddComment : undefined}
                  comments={comments}
                />
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (!files.length) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
        <p className="text-gray-500">No files submitted</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with Stats and Controls */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Submitted Files ({stats.totalFiles})
            </h3>
            <p className="text-sm text-gray-500">
              Total size: {formatFileSize(stats.totalSize)} • From: {studentName}
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
              title={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
            >
              {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
            </button>
            
            {allowDownload && (
              <button
                onClick={onDownloadAll}
                className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                <Archive className="w-4 h-4 inline mr-1" />
                Download All
              </button>
            )}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search files..."
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

          <div className="flex space-x-2">
            {(['all', 'documents', 'images', 'code', 'other'] as FilterType[]).map((filterType) => (
              <button
                key={filterType}
                onClick={() => setFilter(filterType)}
                className={`px-3 py-1 rounded-full text-sm capitalize ${
                  filter === filterType
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {filterType} ({getFilterCount(filterType)})
              </button>
            ))}
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedFiles.size > 0 && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-700">
                {selectedFiles.size} files selected
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={handleSelectAll}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {selectedFiles.size === filteredFiles.length ? 'Deselect All' : 'Select All'}
                </button>
                {allowDownload && (
                  <button className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                    Download Selected
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Files Grid/List */}
      <div className={
        viewMode === 'grid'
          ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
          : 'space-y-4'
      }>
        {filteredFiles.map(renderFileCard)}
      </div>

      {filteredFiles.length === 0 && (
        <div className="text-center py-8">
          <Filter className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="text-gray-500">No files match your current filters</p>
        </div>
      )}
    </div>
  );
};

export default SubmissionFileManager;