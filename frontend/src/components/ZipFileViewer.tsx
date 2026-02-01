/**
 * ZIP File Viewer Component
 * Shows contents of ZIP archives and allows extraction of individual files
 */

import React, { useState, useEffect } from 'react';
import {
  Archive,
  FileText,
  Download,
  Eye,
  Folder,
  File,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  HardDrive
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { EnhancedFileService } from '@/services/enhanced-file.service';

interface ZipFile {
  filename: string;
  size: number;
  compressed_size: number;
  modified: number[];
  crc: number;
  is_encrypted: boolean;
}

interface ZipArchiveInfo {
  filename: string;
  total_files: number;
  total_size: number;
  files: ZipFile[];
}

interface ZipFileViewerProps {
  fileUrl: string;
  filename: string;
  onError?: (error: string) => void;
}

const ZipFileViewer: React.FC<ZipFileViewerProps> = ({
  fileUrl,
  filename,
  onError
}) => {
  const [archiveInfo, setArchiveInfo] = useState<ZipArchiveInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [extracting, setExtracting] = useState(false);

  useEffect(() => {
    loadZipContents();
  }, [fileUrl]);

  const loadZipContents = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await EnhancedFileService.analyzeZipFile(fileUrl, filename);
      setArchiveInfo(result.archive_info);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to analyze ZIP file';
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateArray: number[]) => {
    if (dateArray.length < 6) return 'Unknown';
    const [year, month, day, hour, minute, second] = dateArray;
    return new Date(year, month - 1, day, hour, minute, second).toLocaleDateString();
  };

  const getFileIcon = (filename: string) => {
    const extension = filename.split('.').pop()?.toLowerCase();
    
    const iconMap: { [key: string]: any } = {
      txt: FileText,
      md: FileText,
      pdf: FileText,
      doc: FileText,
      docx: FileText,
      jpg: FileText,
      jpeg: FileText,
      png: FileText,
      gif: FileText,
      js: FileText,
      ts: FileText,
      py: FileText,
      java: FileText,
      cpp: FileText,
      html: FileText,
      css: FileText
    };

    const IconComponent = iconMap[extension || ''] || File;
    return <IconComponent className="w-4 h-4" />;
  };

  const toggleFileSelection = (filename: string) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(filename)) {
        newSet.delete(filename);
      } else {
        newSet.add(filename);
      }
      return newSet;
    });
  };

  const selectAllFiles = () => {
    if (!archiveInfo) return;
    setSelectedFiles(new Set(archiveInfo.files.map(f => f.filename)));
  };

  const clearSelection = () => {
    setSelectedFiles(new Set());
  };

  const extractSelectedFiles = async () => {
    if (selectedFiles.size === 0) return;
    
    setExtracting(true);
    try {
      const result = await EnhancedFileService.extractZipFiles(
        fileUrl,
        Array.from(selectedFiles)
      );
      
      // Download each extracted file
      for (const file of result.files) {
        const blob = EnhancedFileService.hexToBlob(file.data, file.mime_type);
        EnhancedFileService.triggerFileDownload(blob, file.filename);
        
        // Small delay between downloads
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      clearSelection();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to extract files';
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setExtracting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span>Analyzing ZIP file...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center text-red-600 mb-4">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span>Error loading ZIP file</span>
          </div>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <Button onClick={loadZipContents} variant="outline" size="sm">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!archiveInfo) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-gray-500">
          No archive information available
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <Archive className="w-5 h-5 mr-2" />
            {archiveInfo.filename}
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {archiveInfo.total_files} files
            </Badge>
            <Badge variant="outline">
              {formatFileSize(archiveInfo.total_size)}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Selection Controls */}
        {archiveInfo.files.length > 0 && (
          <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {selectedFiles.size} of {archiveInfo.files.length} files selected
              </span>
              
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={selectAllFiles}
                  disabled={selectedFiles.size === archiveInfo.files.length}
                >
                  Select All
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={clearSelection}
                  disabled={selectedFiles.size === 0}
                >
                  Clear
                </Button>
              </div>
            </div>
            
            {selectedFiles.size > 0 && (
              <Button
                onClick={extractSelectedFiles}
                disabled={extracting}
                className="flex items-center gap-2"
              >
                {extracting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Extract Selected
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {/* File List */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {archiveInfo.files.map((file, index) => (
            <div
              key={index}
              className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                selectedFiles.has(file.filename)
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <Checkbox
                  checked={selectedFiles.has(file.filename)}
                  onCheckedChange={() => toggleFileSelection(file.filename)}
                />
                
                <div className="flex-shrink-0 text-blue-600 dark:text-blue-400">
                  {getFileIcon(file.filename)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {file.filename}
                  </p>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatFileSize(file.size)}
                    </span>
                    {file.compressed_size < file.size && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Compressed: {formatFileSize(file.compressed_size)}
                      </span>
                    )}
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Modified: {formatDate(file.modified)}
                    </span>
                    {file.is_encrypted && (
                      <Badge variant="outline" className="text-xs">
                        Encrypted
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {archiveInfo.files.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Archive className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Empty archive</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ZipFileViewer;