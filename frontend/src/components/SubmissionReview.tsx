import React, { useState } from 'react';
import { 
  FileText, 
  Download, 
  ExternalLink, 
  Eye, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Star,
  Zap,
  FileIcon,
  Image,
  Video,
  Headphones,
  Archive,
  Code,
  Link,
  AlertCircle
} from 'lucide-react';
import FileViewer from './FileViewer';
import DocumentAnalysis from './DocumentAnalysis';
import { 
  parseFileInfo,
  extractFilesFromContent,
  isGoogleDriveUrl,
  convertGoogleDriveUrl,
  formatFileSize,
  FileInfo
} from '@/utils/fileUtils';

interface SubmissionFile {
  id?: string;
  filename: string;
  file_path?: string;
  file_url?: string;
  file_size?: number;
  uploaded_at?: string;
}

interface SubmissionReviewProps {
  textContent?: string;
  files?: SubmissionFile[];
  submissionType: 'assignment' | 'project';
  expectedLength?: number;
  maxFiles?: number;
  allowedFileTypes?: string[];
  className?: string;
}

const SubmissionReview: React.FC<SubmissionReviewProps> = ({
  textContent,
  files = [],
  submissionType,
  expectedLength,
  maxFiles,
  allowedFileTypes,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'content' | 'files' | 'analysis'>('content');
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  // Extract files from text content (URLs, Google Drive links, etc.)
  const contentFiles = textContent ? extractFilesFromContent(textContent) : [];

  // Get file category icon
  const getFileIcon = (fileInfo: FileInfo) => {
    switch (fileInfo.category) {
      case 'document': return <FileText className="w-4 h-4" />;
      case 'image': return <Image className="w-4 h-4" />;
      case 'video': return <Video className="w-4 h-4" />;
      case 'audio': return <Headphones className="w-4 h-4" />;
      case 'archive': return <Archive className="w-4 h-4" />;
      case 'code': return <Code className="w-4 h-4" />;
      default: return <FileIcon className="w-4 h-4" />;
    }
  };

  // Toggle file expansion
  const toggleFileExpansion = (fileId: string) => {
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(fileId)) {
      newExpanded.delete(fileId);
    } else {
      newExpanded.add(fileId);
    }
    setExpandedFiles(newExpanded);
  };

  // Render file preview
  const renderFilePreview = (file: SubmissionFile | { url: string; fileInfo: FileInfo }) => {
    try {
      const isContentFile = 'url' in file;
      
      // Safe file info parsing with null checks
      let fileInfo: FileInfo;
      let fileName: string;
      let fileUrl: string;
      let fileId: string;

      if (isContentFile) {
        fileInfo = file.fileInfo;
        fileName = fileInfo?.name || 'Unknown file';
        fileUrl = file.url || '';
        fileId = file.url || 'unknown';
      } else {
        // Ensure file has required properties before parsing
        const safeFilename = file.filename || file.name || 'untitled';
        const safeFileSize = file.file_size || file.size || undefined;
        
        fileInfo = parseFileInfo(safeFilename, safeFileSize);
        fileName = safeFilename;
        fileUrl = file.file_url || file.file_path || file.url || '';
        fileId = file.id?.toString() || fileName || 'unknown';
      }

      // Additional safety checks
      if (!fileUrl || !fileInfo || !fileName) {
        console.warn('Invalid file data:', file);
        return null;
      }

    const isExpanded = expandedFiles.has(fileId);
    const isGoogleDrive = isGoogleDriveUrl(fileUrl);
    
    return (
      <div key={fileId} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
        <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg ${
                fileInfo.viewable 
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                  : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
              }`}>
                {getFileIcon(fileInfo)}
              </div>
              
              <div>
                <h4 className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-xs">
                  {fileName}
                </h4>
                <div className="flex items-center space-x-4 text-sm text-slate-500 dark:text-slate-400">
                  <span className="capitalize">{fileInfo.category}</span>
                  <span className="uppercase">{fileInfo.extension}</span>
                  {file.file_size && <span>{formatFileSize(file.file_size)}</span>}
                  {isGoogleDrive && (
                    <span className="flex items-center space-x-1 text-blue-500">
                      <Link className="w-3 h-3" />
                      <span>Google Drive</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {fileInfo.viewable && (
                <button
                  onClick={() => toggleFileExpansion(fileId)}
                  className="p-2 text-slate-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                  title={isExpanded ? "Collapse preview" : "Expand preview"}
                >
                  <Eye className="w-4 h-4" />
                </button>
              )}
              
              <a
                href={isGoogleDrive ? convertGoogleDriveUrl(fileUrl, 'view') || fileUrl : fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-slate-500 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                title="View file"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
              
              <a
                href={isGoogleDrive ? convertGoogleDriveUrl(fileUrl, 'download') || fileUrl : fileUrl}
                download
                className="p-2 text-slate-500 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
                title="Download file"
              >
                <Download className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
        
        {isExpanded && fileInfo.viewable && (
          <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700">
            <FileViewer content={fileUrl} />
          </div>
        )}
      </div>
    );
    } catch (error) {
      console.error('Error rendering file preview:', error, file);
      return (
        <div className="border border-red-200 bg-red-50 rounded-lg p-4 text-red-700">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4" />
            <span>Error displaying file: {file?.filename || file?.name || 'Unknown'}</span>
          </div>
        </div>
      );
    }
  };

  // Get submission quality indicators
  const getQualityIndicators = () => {
    const indicators = [];
    
    if (textContent) {
      const wordCount = textContent.split(/\s+/).length;
      if (expectedLength) {
        const ratio = wordCount / expectedLength;
        if (ratio >= 0.8 && ratio <= 1.2) {
          indicators.push({ type: 'success', icon: CheckCircle, text: 'Appropriate length' });
        } else if (ratio < 0.8) {
          indicators.push({ type: 'warning', icon: AlertTriangle, text: 'May be too short' });
        } else {
          indicators.push({ type: 'info', icon: Clock, text: 'Comprehensive response' });
        }
      }
    }
    
    const totalFiles = files.length + contentFiles.length;
    if (maxFiles && totalFiles > maxFiles) {
      indicators.push({ type: 'warning', icon: AlertTriangle, text: `Exceeds file limit (${totalFiles}/${maxFiles})` });
    } else if (totalFiles > 0) {
      indicators.push({ type: 'success', icon: CheckCircle, text: `${totalFiles} files attached` });
    }
    
    return indicators;
  };

  const qualityIndicators = getQualityIndicators();

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 ${className}`}>
      {/* Header with Quality Indicators */}
      <div className="border-b border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 capitalize">
            {submissionType} Review
          </h3>
          
          {qualityIndicators.length > 0 && (
            <div className="flex items-center space-x-2">
              {qualityIndicators.map((indicator, index) => {
                const Icon = indicator.icon;
                const colorClasses = {
                  success: 'text-green-500',
                  warning: 'text-yellow-500',
                  info: 'text-blue-500',
                  error: 'text-red-500'
                };
                
                return (
                  <div 
                    key={index}
                    className={`flex items-center space-x-1 text-xs ${colorClasses[indicator.type as keyof typeof colorClasses]}`}
                    title={indicator.text}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{indicator.text}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
          {[
            { id: 'content', label: 'Content', icon: FileText },
            { id: 'files', label: `Files (${files.length + contentFiles.length})`, icon: FileIcon },
            { id: 'analysis', label: 'Analysis', icon: Star }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'content' && (
          <div className="space-y-4">
            {textContent ? (
              <div className="bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-900/20 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                <FileViewer content={textContent} />
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No text content provided</p>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'files' && (
          <div className="space-y-4">
            {/* Uploaded Files */}
            {files.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 flex items-center space-x-2">
                  <FileIcon className="w-4 h-4" />
                  <span>Uploaded Files ({files.length})</span>
                </h4>
                <div className="space-y-3">
                  {files.map(renderFilePreview)}
                </div>
              </div>
            )}
            
            {/* Files from Content */}
            {contentFiles.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 flex items-center space-x-2">
                  <Link className="w-4 h-4" />
                  <span>Files in Content ({contentFiles.length})</span>
                </h4>
                <div className="space-y-3">
                  {contentFiles.map(renderFilePreview)}
                </div>
              </div>
            )}
            
            {files.length === 0 && contentFiles.length === 0 && (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <FileIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No files attached</p>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'analysis' && (
          <div className="space-y-4">
            {textContent && textContent.length > 50 ? (
              <DocumentAnalysis 
                content={textContent}
                expectedLength={expectedLength}
              />
            ) : (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <Star className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Insufficient content for analysis</p>
                <p className="text-sm mt-1">At least 50 characters required</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SubmissionReview;