/**
 * Side-by-side File Comparison Component
 * Allows instructors to compare files between submissions or versions
 */

import React, { useState, useEffect } from 'react';
import {
  ArrowLeftRight,
  FileText,
  Image as ImageIcon,
  Code,
  Eye,
  Download,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
  X,
  Maximize2,
  Copy,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

interface FileComparisonItem {
  id: string;
  filename: string;
  file_url: string;
  file_size?: number;
  studentName: string;
  submissionDate: string;
  content?: string; // For text files
}

interface FileComparisonProps {
  leftFile: FileComparisonItem;
  rightFile: FileComparisonItem;
  onClose: () => void;
}

const FileComparison: React.FC<FileComparisonProps> = ({
  leftFile,
  rightFile,
  onClose
}) => {
  const [leftContent, setLeftContent] = useState<string>('');
  const [rightContent, setRightContent] = useState<string>('');
  const [leftZoom, setLeftZoom] = useState(1);
  const [rightZoom, setRightZoom] = useState(1);
  const [syncZoom, setSyncZoom] = useState(true);
  const [syncScroll, setSyncScroll] = useState(true);
  const [leftLoading, setLeftLoading] = useState(false);
  const [rightLoading, setRightLoading] = useState(false);
  const [showSimilarityAnalysis, setShowSimilarityAnalysis] = useState(false);

  const getFileType = (filename: string) => {
    const extension = filename.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(extension || '')) return 'image';
    if (['js', 'ts', 'py', 'java', 'cpp', 'html', 'css', 'json'].includes(extension || '')) return 'code';
    if (['txt', 'md', 'csv'].includes(extension || '')) return 'text';
    if (extension === 'pdf') return 'pdf';
    return 'unknown';
  };

  const leftFileType = getFileType(leftFile.filename);
  const rightFileType = getFileType(rightFile.filename);

  // Load file contents for text comparison
  useEffect(() => {
    const loadTextContent = async (file: FileComparisonItem, setContent: React.Dispatch<React.SetStateAction<string>>, setLoading: React.Dispatch<React.SetStateAction<boolean>>) => {
      if (getFileType(file.filename) !== 'text' && getFileType(file.filename) !== 'code') return;
      
      setLoading(true);
      try {
        const response = await fetch(file.file_url);
        const text = await response.text();
        setContent(text);
      } catch (error) {
        console.error('Failed to load file content:', error);
        setContent('Failed to load content');
      } finally {
        setLoading(false);
      }
    };

    if (file.content) {
      setLeftContent(leftFile.content);
      setRightContent(rightFile.content || '');
    } else {
      loadTextContent(leftFile, setLeftContent, setLeftLoading);
      loadTextContent(rightFile, setRightContent, setRightLoading);
    }
  }, [leftFile, rightFile]);

  const handleZoomChange = (side: 'left' | 'right', delta: number) => {
    const newZoom = Math.max(0.25, Math.min(3, (side === 'left' ? leftZoom : rightZoom) + delta));
    
    if (syncZoom) {
      setLeftZoom(newZoom);
      setRightZoom(newZoom);
    } else {
      if (side === 'left') setLeftZoom(newZoom);
      else setRightZoom(newZoom);
    }
  };

  const calculateSimilarity = () => {
    if (leftFileType !== 'text' && leftFileType !== 'code') return null;
    
    const left = leftContent.toLowerCase().replace(/\s+/g, ' ').trim();
    const right = rightContent.toLowerCase().replace(/\s+/g, ' ').trim();
    
    if (!left || !right) return null;
    
    // Simple similarity calculation (Jaccard similarity)
    const leftWords = new Set(left.split(' '));
    const rightWords = new Set(right.split(' '));
    const intersection = new Set([...leftWords].filter(x => rightWords.has(x)));
    const union = new Set([...leftWords, ...rightWords]);
    
    return Math.round((intersection.size / union.size) * 100);
  };

  const similarity = calculateSimilarity();

  const renderFileContent = (file: FileComparisonItem, content: string, zoom: number, loading: boolean) => {
    const fileType = getFileType(file.filename);
    
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    switch (fileType) {
      case 'image':
        return (
          <div className="overflow-auto">
            <img
              src={file.file_url}
              alt={file.filename}
              className="max-w-full h-auto transition-transform duration-200"
              style={{ transform: `scale(${zoom})` }}
              onError={() => console.error('Failed to load image')}
            />
          </div>
        );

      case 'pdf':
        return (
          <iframe
            src={`${file.file_url}#toolbar=1&zoom=${Math.round(zoom * 100)}`}
            className="w-full h-96 border-0"
            title={file.filename}
          />
        );

      case 'text':
      case 'code':
        return (
          <pre
            className="whitespace-pre-wrap font-mono text-sm p-4 bg-gray-50 rounded overflow-auto h-64"
            style={{ fontSize: `${zoom}rem` }}
          >
            {content || 'No content available'}
          </pre>
        );

      default:
        return (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <FileText className="w-12 h-12 mb-2" />
            <p>Preview not available</p>
            <p className="text-sm">File type: {file.filename.split('.').pop()}</p>
          </div>
        );
    }
  };

  const getSimilarityColor = (score: number) => {
    if (score > 80) return 'text-red-600 bg-red-50';
    if (score > 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-7xl w-full max-h-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold">File Comparison</h2>
            
            {/* Similarity Score */}
            {similarity !== null && (
              <div className={`px-3 py-1 rounded-full text-sm ${getSimilarityColor(similarity)}`}>
                {similarity}% similar
                {similarity > 80 && <AlertTriangle className="w-4 h-4 inline ml-1" />}
                {similarity <= 60 && <CheckCircle className="w-4 h-4 inline ml-1" />}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {/* Sync Controls */}
            <label className="flex items-center space-x-2 text-sm">
              <input
                type="checkbox"
                checked={syncZoom}
                onChange={(e) => setSyncZoom(e.target.checked)}
              />
              <span>Sync Zoom</span>
            </label>

            <label className="flex items-center space-x-2 text-sm">
              <input
                type="checkbox"
                checked={syncScroll}
                onChange={(e) => setSyncScroll(e.target.checked)}
              />
              <span>Sync Scroll</span>
            </label>

            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left File */}
          <div className="flex-1 border-r">
            {/* Left Header */}
            <div className="p-3 bg-blue-50 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-blue-900">{leftFile.filename}</h3>
                  <p className="text-sm text-blue-700">
                    {leftFile.studentName} • {new Date(leftFile.submissionDate).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleZoomChange('left', -0.25)}
                    className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-blue-700 min-w-12 text-center">
                    {Math.round(leftZoom * 100)}%
                  </span>
                  <button
                    onClick={() => handleZoomChange('left', 0.25)}
                    className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <a
                    href={leftFile.file_url}
                    download={leftFile.filename}
                    className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>

            {/* Left Content */}
            <div className="p-4 overflow-auto" style={{ height: 'calc(100vh - 200px)' }}>
              {renderFileContent(leftFile, leftContent, leftZoom, leftLoading)}
            </div>
          </div>

          {/* Divider */}
          <div className="w-1 bg-gray-300 flex items-center justify-center">
            <ArrowLeftRight className="w-4 h-4 text-gray-500" />
          </div>

          {/* Right File */}
          <div className="flex-1">
            {/* Right Header */}
            <div className="p-3 bg-green-50 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-green-900">{rightFile.filename}</h3>
                  <p className="text-sm text-green-700">
                    {rightFile.studentName} • {new Date(rightFile.submissionDate).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleZoomChange('right', -0.25)}
                    className="p-1 text-green-600 hover:bg-green-100 rounded"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-green-700 min-w-12 text-center">
                    {Math.round(rightZoom * 100)}%
                  </span>
                  <button
                    onClick={() => handleZoomChange('right', 0.25)}
                    className="p-1 text-green-600 hover:bg-green-100 rounded"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <a
                    href={rightFile.file_url}
                    download={rightFile.filename}
                    className="p-1 text-green-600 hover:bg-green-100 rounded"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>

            {/* Right Content */}
            <div className="p-4 overflow-auto" style={{ height: 'calc(100vh - 200px)' }}>
              {renderFileContent(rightFile, rightContent, rightZoom, rightLoading)}
            </div>
          </div>
        </div>

        {/* Footer with Analysis Options */}
        {similarity !== null && (
          <div className="p-4 border-t bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Similarity analysis based on text content comparison
              </div>
              
              <div className="flex space-x-2">
                {similarity > 80 && (
                  <span className="text-sm text-red-600 font-medium">
                    High similarity detected - possible plagiarism
                  </span>
                )}
                <button
                  onClick={() => setShowSimilarityAnalysis(!showSimilarityAnalysis)}
                  className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  {showSimilarityAnalysis ? 'Hide' : 'Show'} Details
                </button>
              </div>
            </div>

            {/* Detailed Analysis */}
            {showSimilarityAnalysis && (
              <div className="mt-3 p-3 bg-white rounded border">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>Left File:</strong>
                    <div className="text-gray-600">
                      Words: {leftContent.split(/\s+/).length} | 
                      Characters: {leftContent.length}
                    </div>
                  </div>
                  <div>
                    <strong>Right File:</strong>
                    <div className="text-gray-600">
                      Words: {rightContent.split(/\s+/).length} | 
                      Characters: {rightContent.length}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FileComparison;