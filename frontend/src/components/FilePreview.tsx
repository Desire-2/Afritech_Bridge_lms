/**
 * Enhanced File Preview Component for Instructor Review
 * Supports multiple file types with better preview capabilities
 */

import React, { useState, useCallback } from 'react';
import {
  Eye,
  Download,
  ExternalLink,
  Image as ImageIcon,
  FileText,
  Play,
  Code2,
  Archive,
  FileIcon,
  Maximize2,
  Minimize2,
  RotateCw,
  ZoomIn,
  ZoomOut,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  Clock,
  User
} from 'lucide-react';
import { FileInfo, isOfficeDocument, isSpreadsheet, getOfficePrevUrl } from '@/utils/fileUtils';
import ZipFileViewer from './ZipFileViewer';

interface FilePreviewProps {
  file: {
    id: string;
    filename: string;
    file_url: string;
    file_size?: number;
    uploaded_at?: string;
  };
  fileInfo: FileInfo;
  onDownload?: (fileId: string) => void;
  onAddComment?: (fileId: string, comment: string) => void;
  comments?: Array<{
    id: string;
    text: string;
    author: string;
    timestamp: string;
  }>;
}

const FilePreview: React.FC<FilePreviewProps> = ({
  file,
  fileInfo,
  onDownload,
  onAddComment,
  comments = []
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!onDownload) return;
    
    setIsDownloading(true);
    try {
      await onDownload(file.id);
    } catch (error) {
      console.error('Download failed:', error);
      // Could add toast notification here
    } finally {
      setIsDownloading(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = () => {
    switch (fileInfo.category) {
      case 'image':
        return <ImageIcon className="w-5 h-5" />;
      case 'document':
        return <FileText className="w-5 h-5" />;
      case 'video':
        return <Play className="w-5 h-5" />;
      case 'code':
        return <Code2 className="w-5 h-5" />;
      case 'archive':
        return <Archive className="w-5 h-5" />;
      default:
        return <FileIcon className="w-5 h-5" />;
    }
  };

  const getFileStatusColor = () => {
    if (previewError) return 'text-red-600 bg-red-50 border-red-200';
    if (fileInfo.viewable) return 'text-green-600 bg-green-50 border-green-200';
    return 'text-blue-600 bg-blue-50 border-blue-200';
  };

  const renderFileContent = () => {
    if (previewError) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <AlertCircle className="w-12 h-12 mb-2 text-red-400" />
          <p className="text-sm">Failed to load preview</p>
          <p className="text-xs text-gray-400">{previewError}</p>
        </div>
      );
    }

    switch (fileInfo.category) {
      case 'image':
        return (
          <div className="relative overflow-hidden">
            <img
              src={file.file_url}
              alt={file.filename}
              className="max-w-full h-auto transition-transform duration-200"
              style={{ 
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transformOrigin: 'center'
              }}
              onError={() => setPreviewError('Failed to load image')}
              loading="lazy"
            />
            <div className="absolute top-2 right-2 flex space-x-1">
              <button
                onClick={() => setZoom(prev => Math.min(prev + 0.25, 3))}
                className="p-1 bg-black/50 text-white rounded hover:bg-black/70"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoom(prev => Math.max(prev - 0.25, 0.25))}
                className="p-1 bg-black/50 text-white rounded hover:bg-black/70"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={() => setRotation(prev => prev + 90)}
                className="p-1 bg-black/50 text-white rounded hover:bg-black/70"
                title="Rotate"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        );

      case 'video':
        return (
          <video
            controls
            className="max-w-full h-auto"
            onError={() => setPreviewError('Failed to load video')}
          >
            <source src={file.file_url} type={`video/${fileInfo.extension}`} />
            Your browser does not support the video tag.
          </video>
        );

      case 'document':
        if (fileInfo.extension === 'pdf') {
          return (
            <iframe
              src={`${file.file_url}#toolbar=1`}
              className="w-full h-96 border-0"
              title={file.filename}
              onError={() => setPreviewError('Failed to load PDF')}
            />
          );
        }
        // Excel, Word, PowerPoint - use appropriate embedded viewer
        if (isOfficeDocument(fileInfo.extension)) {
          const embedUrl = getOfficePrevUrl(file.file_url);
          return (
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-t-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold ${
                    isSpreadsheet(fileInfo.extension) ? 'bg-green-600' :
                    fileInfo.extension === 'pptx' || fileInfo.extension === 'ppt' ? 'bg-orange-500' :
                    'bg-blue-600'
                  }`}>
                    {isSpreadsheet(fileInfo.extension) ? 'X' :
                     fileInfo.extension === 'pptx' || fileInfo.extension === 'ppt' ? 'P' : 'W'}
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {isSpreadsheet(fileInfo.extension) ? 'Excel' :
                     fileInfo.extension === 'pptx' || fileInfo.extension === 'ppt' ? 'PowerPoint' : 'Word'} Preview
                  </span>
                  <span className="text-xs text-gray-400 uppercase">.{fileInfo.extension}</span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={file.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-2 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded transition-colors"
                  >
                    Open in new tab
                  </a>
                  <button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="text-xs px-2 py-1 bg-green-100 text-green-700 hover:bg-green-200 rounded transition-colors disabled:opacity-50"
                  >
                    Download
                  </button>
                </div>
              </div>
              {embedUrl ? (
                <iframe
                  src={embedUrl}
                  className="w-full h-[500px] border border-slate-200 dark:border-slate-700 rounded-b-lg"
                  title={`${file.filename} - Document Preview`}
                  sandbox="allow-scripts allow-same-origin allow-popups"
                  allow="autoplay"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500 border border-slate-200 dark:border-slate-700 rounded-b-lg">
                  <FileText className="w-12 h-12 mb-3" />
                  <p className="text-sm font-medium">Preview not available for local files</p>
                  <p className="text-xs text-gray-400 mt-1">Download the file to view its contents</p>
                  <button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className={`mt-3 px-4 py-2 rounded transition-colors flex items-center gap-2 ${
                      isDownloading
                        ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    <Download className="w-4 h-4" />
                    {isDownloading ? 'Downloading...' : 'Download to View'}
                  </button>
                </div>
              )}
            </div>
          );
        }
        // For other documents, show download option
        return (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <FileText className="w-12 h-12 mb-2" />
            <p className="text-sm">Preview not available</p>
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className={`mt-2 px-4 py-2 rounded transition-colors flex items-center gap-2 ${
                isDownloading 
                  ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isDownloading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-700 border-t-transparent"></div>
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download to View
                </>
              )}
            </button>
          </div>
        );

      case 'code':
        return (
          <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-sm overflow-x-auto">
            <iframe
              src={file.file_url}
              className="w-full h-64 border-0 bg-gray-900"
              title={file.filename}
              onError={() => setPreviewError('Failed to load code file')}
            />
          </div>
        );

      case 'archive':
        // Special handling for ZIP files
        if (fileInfo.extension === 'zip') {
          return (
            <ZipFileViewer
              fileUrl={file.file_url}
              filename={file.filename}
              onError={(error) => setPreviewError(error)}
            />
          );
        }
        // For other archive types, show download option
        return (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Archive className="w-12 h-12 mb-2" />
            <p className="text-sm">Archive file</p>
            <p className="text-xs text-gray-400">Download file to extract contents</p>
          </div>
        );

      default:
        return (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            {getFileIcon()}
            <p className="text-sm mt-2">Preview not available</p>
            <p className="text-xs text-gray-400">Download file to view contents</p>
          </div>
        );
    }
  };

  const handleAddComment = () => {
    if (newComment.trim() && onAddComment) {
      onAddComment(file.id, newComment.trim());
      setNewComment('');
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
      {/* File Header */}
      <div className="flex items-center justify-between gap-3 p-4 bg-gradient-to-r from-slate-50 to-slate-100 border-b">
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <div className={`p-2 rounded-lg flex-shrink-0 ${getFileStatusColor()}`}>
            {getFileIcon()}
          </div>
          <div className="min-w-0 flex-1">
            <h4 
              className="font-medium text-gray-900 truncate" 
              title={file.filename}
            >
              {file.filename}
            </h4>
            <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
              <span className="flex-shrink-0">{formatFileSize(file.file_size)}</span>
              <span className="uppercase flex-shrink-0">{fileInfo.extension}</span>
              {file.uploaded_at && (
                <span className="flex-shrink-0">Uploaded {new Date(file.uploaded_at).toLocaleDateString()}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
          {/* Comments Badge */}
          {comments.length > 0 && (
            <button
              onClick={() => setShowComments(!showComments)}
              className="flex items-center space-x-1 px-2 py-1.5 bg-blue-100 text-blue-700 rounded-full text-xs hover:bg-blue-200 transition-colors"
              title={`${comments.length} comment${comments.length > 1 ? 's' : ''}`}
            >
              <MessageSquare className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline">{comments.length}</span>
            </button>
          )}

          {/* Action Buttons */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
            title={isExpanded ? 'Collapse preview' : 'Expand preview'}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className={`p-1.5 sm:p-2 rounded transition-colors ${
              isDownloading
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
            title="Download file"
          >
            {isDownloading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent"></div>
            ) : (
              <Download className="w-4 h-4" />
            )}
          </button>

          <a
            href={file.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* File Preview */}
      {isExpanded && (
        <div className="p-4">
          {fileInfo.viewable ? (
            renderFileContent()
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
              {getFileIcon()}
              <p className="text-sm mt-2">Preview not supported for this file type</p>
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isDownloading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Download File
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Comments Section */}
      {showComments && (
        <div className="border-t bg-gray-50">
          <div className="p-4">
            <h5 className="font-medium text-gray-900 mb-3">Comments</h5>
            
            {/* Existing Comments */}
            {comments.length > 0 ? (
              <div className="space-y-3 mb-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="bg-white rounded-lg p-3 border">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-700">
                          {comment.author}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(comment.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-900 mt-2">{comment.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 mb-4">No comments yet</p>
            )}

            {/* Add New Comment */}
            {onAddComment && (
              <div className="space-y-2">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment about this file..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={3}
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Add Comment
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FilePreview;