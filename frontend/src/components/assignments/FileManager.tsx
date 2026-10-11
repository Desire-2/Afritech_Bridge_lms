// File Management Component for Assignment Files
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  File,
  Download,
  Eye,
  Trash2,
  Upload,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Image,
  Video,
  Music,
  Archive,
  Share,
  Copy
} from 'lucide-react';
import FileUploadService, { UploadedFile } from '@/services/file-upload.service';
import { toast } from 'sonner';

interface FileManagerProps {
  assignmentId?: number;
  projectId?: number;
  submissionId?: number;
  isInstructor?: boolean;
  onFileUpdate?: () => void;
}

interface FileWithMetadata extends UploadedFile {
  id?: string;
  originalName: string;
  uploadedBy?: string;
  canDelete?: boolean;
  canDownload?: boolean;
  canPreview?: boolean;
}

export const FileManager: React.FC<FileManagerProps> = ({
  assignmentId,
  projectId,
  submissionId,
  isInstructor = false,
  onFileUpdate
}) => {
  const [files, setFiles] = useState<FileWithMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadFiles();
  }, [assignmentId, projectId, submissionId]);

  const loadFiles = async () => {
    if (!assignmentId && !projectId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const endpoint = assignmentId 
        ? `/api/v1/uploads/assignments/${assignmentId}/files`
        : `/api/v1/uploads/projects/${projectId}/files`;
      
      const params = new URLSearchParams();
      if (submissionId) {
        params.append('submission_id', submissionId.toString());
      }
      
      const response = await fetch(`${endpoint}?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const result = (await response.json()) as {
        error?: string;
        files?: Array<Record<string, unknown>>;
      };
      const fileList = result.files ?? [];
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to load files');
      }
      
      // Transform the files data
      const transformedFiles: FileWithMetadata[] = fileList.map((file: any, index: number) => ({
        id: file.id || `file-${index}`,
        url: file.url,
        originalName: file.filename || file.originalName || 'Unknown file',
        size: file.size || 0,
        contentType: file.contentType || FileUploadService.getContentType(file.filename || ''),
        uploadedAt: file.uploadedAt || new Date().toISOString(),
        pathname: file.url,
        contentDisposition: `attachment; filename="${file.filename || 'file'}"`,
        uploadedBy: file.uploadedBy,
        canDelete: isInstructor || !submissionId, // Students can delete only before submission
        canDownload: true,
        canPreview: FileUploadService.canPreviewFile(file.filename || '')
      }));
      
      setFiles(transformedFiles);
    } catch (error: any) {
      console.error('Error loading files:', error);
      setError(error.message);
      toast.error('Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  const getFileIcon = (filename: string) => {
    const ext = FileUploadService.getFileExtension(filename).toLowerCase();
    
    if (FileUploadService.isImageFile(filename)) {
      return <Image className="h-5 w-5" />;
    } else if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) {
      return <Video className="h-5 w-5" />;
    } else if (['mp3', 'wav', 'ogg'].includes(ext)) {
      return <Music className="h-5 w-5" />;
    } else if (['zip', 'tar', 'gz', 'rar'].includes(ext)) {
      return <Archive className="h-5 w-5" />;
    } else {
      return <File className="h-5 w-5" />;
    }
  };

  const handleDownload = async (file: FileWithMetadata) => {
    if (!file.canDownload) {
      toast.error('Download not allowed for this file');
      return;
    }
    
    try {
      const link = document.createElement('a');
      link.href = FileUploadService.getDownloadUrl(file.url, file.originalName);
      link.download = file.originalName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`Downloading ${file.originalName}`);
    } catch (error: any) {
      console.error('Download error:', error);
      toast.error('Failed to download file');
    }
  };

  const handlePreview = (file: FileWithMetadata) => {
    if (!file.canPreview) {
      toast.error('Preview not available for this file type');
      return;
    }
    
    window.open(file.url, '_blank');
  };

  const handleDelete = async (file: FileWithMetadata) => {
    if (!file.canDelete) {
      toast.error('Delete not allowed for this file');
      return;
    }
    
    if (!confirm(`Are you sure you want to delete ${file.originalName}?`)) {
      return;
    }
    
    setActionLoading(true);
    
    try {
      await FileUploadService.deleteFile(file.url);
      setFiles(prev => prev.filter(f => f.id !== file.id));
      toast.success('File deleted successfully');
      
      if (onFileUpdate) {
        onFileUpdate();
      }
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error('Failed to delete file');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopyLink = async (file: FileWithMetadata) => {
    try {
      await navigator.clipboard.writeText(file.url);
      toast.success('Link copied to clipboard');
    } catch (error: any) {
      console.error('Copy error:', error);
      toast.error('Failed to copy link');
    }
  };

  const handleShare = async (file: FileWithMetadata) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: file.originalName,
          url: file.url
        });
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Share error:', error);
          handleCopyLink(file);
        }
      }
    } else {
      handleCopyLink(file);
    }
  };

  const toggleFileSelection = (fileId: string) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  const handleBulkAction = async (action: 'download' | 'delete') => {
    if (selectedFiles.size === 0) {
      toast.error('No files selected');
      return;
    }
    
    const selectedFilesList = files.filter(f => selectedFiles.has(f.id!));
    
    if (action === 'download') {
      setActionLoading(true);
      try {
        for (const file of selectedFilesList) {
          if (file.canDownload) {
            await handleDownload(file);
            await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between downloads
          }
        }
        toast.success(`Downloaded ${selectedFilesList.length} files`);
      } finally {
        setActionLoading(false);
      }
    } else if (action === 'delete') {
      const deletableFiles = selectedFilesList.filter(f => f.canDelete);
      
      if (deletableFiles.length === 0) {
        toast.error('No files can be deleted');
        return;
      }
      
      if (!confirm(`Are you sure you want to delete ${deletableFiles.length} files?`)) {
        return;
      }
      
      setActionLoading(true);
      try {
        for (const file of deletableFiles) {
          await FileUploadService.deleteFile(file.url);
        }
        
        setFiles(prev => prev.filter(f => !deletableFiles.some(df => df.id === f.id)));
        setSelectedFiles(new Set());
        toast.success(`Deleted ${deletableFiles.length} files`);
        
        if (onFileUpdate) {
          onFileUpdate();
        }
      } catch (error: any) {
        console.error('Bulk delete error:', error);
        toast.error('Failed to delete some files');
      } finally {
        setActionLoading(false);
      }
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Loading files...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={loadFiles} className="mt-4" variant="outline">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (files.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <File className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No files uploaded yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <File className="h-5 w-5 mr-2" />
            Files ({files.length})
          </CardTitle>
          
          {selectedFiles.size > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="outline">{selectedFiles.size} selected</Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkAction('download')}
                disabled={actionLoading}
              >
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
              {(isInstructor || !submissionId) && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleBulkAction('delete')}
                  disabled={actionLoading}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-3">
          {files.map((file) => (
            <div 
              key={file.id} 
              className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                selectedFiles.has(file.id!) 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' 
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <input
                  type="checkbox"
                  checked={selectedFiles.has(file.id!)}
                  onChange={() => toggleFileSelection(file.id!)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                
                <div className="flex-shrink-0 text-blue-600 dark:text-blue-400">
                  {getFileIcon(file.originalName)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {file.originalName}
                  </p>
                  <div className="flex items-center gap-4 mt-1">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {FileUploadService.formatBytes(file.size)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(file.uploadedAt).toLocaleDateString()}
                    </p>
                    {file.uploadedBy && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        by {file.uploadedBy}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                {file.canPreview && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePreview(file)}
                    className="h-8 w-8 p-0"
                    title="Preview"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
                
                {file.canDownload && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(file)}
                    className="h-8 w-8 p-0"
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleShare(file)}
                  className="h-8 w-8 p-0"
                  title="Share"
                >
                  <Share className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyLink(file)}
                  className="h-8 w-8 p-0"
                  title="Copy Link"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                
                {file.canDelete && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(file)}
                    className="h-8 w-8 p-0"
                    title="Delete"
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {/* Summary */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>
              Total: {files.length} files ({FileUploadService.formatBytes(files.reduce((sum, file) => sum + file.size, 0))})
            </span>
            <span>
              {files.filter(f => f.canDelete).length > 0 && `${files.filter(f => f.canDelete).length} can be deleted`}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FileManager;