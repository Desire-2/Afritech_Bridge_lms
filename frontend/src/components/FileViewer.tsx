import React, { useState } from 'react';
import { 
  Eye, 
  Download, 
  ExternalLink, 
  FileText, 
  Image, 
  Video, 
  File, 
  Globe,
  Play,
  Maximize,
  X,
  Table,
  AlertCircle
} from 'lucide-react';
import { isOfficeDocument, isSpreadsheet, getOfficePrevUrl } from '@/utils/fileUtils';

interface FileViewerProps {
  file?: {
    name?: string;
    url?: string;
    type?: string;
    size?: number;
  };
  externalUrl?: string;
  content?: string;
}

interface GoogleDriveInfo {
  isGoogleDrive: boolean;
  fileId?: string;
  previewUrl?: string;
  embedUrl?: string;
}

const FileViewer: React.FC<FileViewerProps> = ({ file, externalUrl, content }) => {
  const [showPreview, setShowPreview] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  // Detect Google Drive links and extract file ID
  const getGoogleDriveInfo = (url: string): GoogleDriveInfo => {
    const result: GoogleDriveInfo = { isGoogleDrive: false };
    
    if (!url) return result;

    // Google Drive URL patterns
    const patterns = [
      /drive\.google\.com\/file\/d\/([a-zA-Z0-9-_]+)/,
      /docs\.google\.com\/(document|spreadsheets|presentation|forms)\/d\/([a-zA-Z0-9-_]+)/,
      /drive\.google\.com\/open\?id=([a-zA-Z0-9-_]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        result.isGoogleDrive = true;
        result.fileId = match[1] || match[2];
        result.previewUrl = `https://drive.google.com/file/d/${result.fileId}/view`;
        result.embedUrl = `https://drive.google.com/file/d/${result.fileId}/preview`;
        break;
      }
    }

    return result;
  };

  // Get file type icon
  const getFileIcon = (fileName?: string, fileType?: string, url?: string) => {
    const type = fileType || '';
    const name = (fileName || url || '').toLowerCase();
    
    if (type.includes('image') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name)) {
      return <Image className="w-5 h-5 text-blue-500" />;
    }
    if (type.includes('video') || /\.(mp4|avi|mov|wmv|flv|webm)$/i.test(name)) {
      return <Video className="w-5 h-5 text-purple-500" />;
    }
    if (type.includes('pdf') || name.includes('.pdf')) {
      return <FileText className="w-5 h-5 text-red-500" />;
    }
    if (/\.(xls|xlsx|xlsm|csv)$/i.test(name) || type.includes('spreadsheet') || type.includes('excel')) {
      return <Table className="w-5 h-5 text-green-600" />;
    }
    if (type.includes('text') || type.includes('document') || /\.(doc|docx|txt|rtf)$/i.test(name)) {
      return <FileText className="w-5 h-5 text-blue-500" />;
    }
    return <File className="w-5 h-5 text-slate-500" />;
  };

  // Check if file can be previewed
  const canPreview = (fileName?: string, fileType?: string, url?: string) => {
    const type = fileType || '';
    const name = (fileName || url || '').toLowerCase();
    
    return (
      type.includes('image') ||
      type.includes('pdf') ||
      name.includes('.pdf') ||
      /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name) ||
      /\.(xls|xlsx|xlsm|doc|docx|ppt|pptx)$/i.test(name) ||
      type.includes('spreadsheet') ||
      type.includes('excel') ||
      getGoogleDriveInfo(url || '').isGoogleDrive
    );
  };

  // Check if file is an Office document
  const isOfficeFile = (fileName?: string, fileType?: string) => {
    const name = (fileName || '').toLowerCase();
    const type = fileType || '';
    return (
      /\.(xls|xlsx|xlsm|doc|docx|ppt|pptx)$/i.test(name) ||
      type.includes('spreadsheet') ||
      type.includes('excel') ||
      type.includes('wordprocessingml') ||
      type.includes('presentationml')
    );
  };

  // Format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Handle Google Drive links
  const renderGoogleDriveLink = (url: string) => {
    const driveInfo = getGoogleDriveInfo(url);
    
    if (!driveInfo.isGoogleDrive) {
      return (
        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="flex items-center">
            <Globe className="w-5 h-5 text-slate-500 mr-3" />
            <div>
              <p className="font-medium text-slate-900 dark:text-white">External Link</p>
              <p className="text-sm text-slate-500 break-all">{url}</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              Open
            </a>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center mr-3 shadow-sm">
              <svg viewBox="0 0 24 24" className="w-6 h-6">
                <path fill="#4285F4" d="M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-slate-900 dark:text-white">Google Drive File</p>
              <p className="text-sm text-slate-500">Shared document or file</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowPreview(true)}
              className="flex items-center px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
            >
              <Eye className="w-4 h-4 mr-1" />
              Preview
            </button>
            <a
              href={driveInfo.previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              Open
            </a>
          </div>
        </div>

        {/* Google Drive Preview Modal */}
        {showPreview && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-4xl h-3/4 flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Google Drive Preview
                </h3>
                <button
                  onClick={() => setShowPreview(false)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <div className="flex-1 p-4">
                {!previewError ? (
                  <iframe
                    src={driveInfo.embedUrl}
                    className="w-full h-full rounded-lg border"
                    onError={() => setPreviewError(true)}
                    title="Google Drive Preview"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-600 dark:text-slate-400">
                        Preview not available. Please open the file directly.
                      </p>
                      <a
                        href={driveInfo.previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Open in Google Drive
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Handle regular file
  const renderFile = (fileData: { name?: string; url?: string; type?: string; size?: number }) => {
    const canShowPreview = canPreview(fileData.name, fileData.type, fileData.url);
    const icon = getFileIcon(fileData.name, fileData.type, fileData.url);
    
    return (
      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="flex items-center">
          {icon}
          <div className="ml-3">
            <p className="font-medium text-slate-900 dark:text-white">
              {fileData.name || 'Uploaded File'}
            </p>
            <p className="text-sm text-slate-500">
              {formatFileSize(fileData.size)}
              {fileData.type && ` • ${fileData.type}`}
            </p>
          </div>
        </div>
        <div className="flex space-x-2">
          {canShowPreview && (
            <button
              onClick={() => setShowPreview(true)}
              className="flex items-center px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
            >
              <Eye className="w-4 h-4 mr-1" />
              Preview
            </button>
          )}
          {fileData.url && (
            <a
              href={fileData.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
            >
              <Download className="w-4 h-4 mr-1" />
              Download
            </a>
          )}
        </div>
      </div>
    );
  };

  // Preview modal for regular files
  const renderPreviewModal = () => {
    if (!showPreview) return null;

    const fileUrl = file?.url;
    const fileName = file?.name || '';
    const fileType = file?.type || '';

    return (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-4xl h-3/4 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              File Preview: {fileName}
            </h3>
            <button
              onClick={() => setShowPreview(false)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
          <div className="flex-1 p-4">
            {fileType?.includes('image') ? (
              <img
                src={fileUrl}
                alt={fileName}
                className="max-w-full max-h-full object-contain mx-auto"
                onError={() => setPreviewError(true)}
              />
            ) : fileType?.includes('pdf') || fileName.toLowerCase().includes('.pdf') ? (
              <iframe
                src={fileUrl}
                className="w-full h-full rounded-lg border"
                title={fileName}
                onError={() => setPreviewError(true)}
              />
            ) : isOfficeFile(fileName, fileType) ? (
              (() => {
                const embedUrl = getOfficePrevUrl(fileUrl || '');
                return embedUrl ? (
                  <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-700 px-4 py-2 rounded-t-lg border-b">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold ${
                          /\.(xls|xlsx|xlsm|csv)$/i.test(fileName) ? 'bg-green-600' :
                          /\.(ppt|pptx)$/i.test(fileName) ? 'bg-orange-500' :
                          'bg-blue-600'
                        }`}>
                          {/\.(xls|xlsx|xlsm|csv)$/i.test(fileName) ? 'X' :
                           /\.(ppt|pptx)$/i.test(fileName) ? 'P' : 'W'}
                        </div>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                          {/\.(xls|xlsx|xlsm|csv)$/i.test(fileName) ? 'Excel' :
                           /\.(ppt|pptx)$/i.test(fileName) ? 'PowerPoint' : 'Word'} Document Preview
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {fileUrl && (
                          <a
                            href={fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                          >
                            Download Original
                          </a>
                        )}
                      </div>
                    </div>
                    <iframe
                      src={embedUrl}
                      className="flex-1 w-full rounded-b-lg border"
                      title={`${fileName} - Document Preview`}
                      sandbox="allow-scripts allow-same-origin allow-popups"
                      allow="autoplay"
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-600 dark:text-slate-400 mb-2">
                        Preview not available for local files.
                      </p>
                      {fileUrl && (
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download to View
                        </a>
                      )}
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-600 dark:text-slate-400">
                    Preview not available for this file type.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Detect Google Drive links in content
  const renderContent = (text: string) => {
    const googleDriveRegex = /(https?:\/\/(?:drive|docs)\.google\.com\/[^\s]+)/g;
    const matches = text.match(googleDriveRegex);
    
    if (!matches) {
      return <div className="whitespace-pre-wrap">{text}</div>;
    }

    const parts = text.split(googleDriveRegex);
    
    return (
      <div className="space-y-3">
        {parts.map((part, index) => {
          if (matches.includes(part)) {
            return (
              <div key={index}>
                {renderGoogleDriveLink(part)}
              </div>
            );
          }
          return part ? (
            <div key={index} className="whitespace-pre-wrap">{part}</div>
          ) : null;
        })}
      </div>
    );
  };

  return (
    <div>
      {file && renderFile(file)}
      {externalUrl && renderGoogleDriveLink(externalUrl)}
      {content && renderContent(content)}
      {renderPreviewModal()}
    </div>
  );
};

export default FileViewer;