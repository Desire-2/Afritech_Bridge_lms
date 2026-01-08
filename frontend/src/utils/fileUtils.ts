/**
 * File utilities for handling various file operations and type detection
 */

export interface FileInfo {
  name: string;
  type: string;
  size?: number;
  extension: string;
  category: 'document' | 'image' | 'video' | 'audio' | 'archive' | 'code' | 'other';
  viewable: boolean;
  downloadable: boolean;
}

/**
 * File type categories and their associated extensions
 */
const FILE_CATEGORIES = {
  document: [
    'pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'pages',
    'ppt', 'pptx', 'xls', 'xlsx', 'csv', 'md', 'tex'
  ],
  image: [
    'jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp',
    'ico', 'tiff', 'tif', 'eps', 'raw'
  ],
  video: [
    'mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv',
    'm4v', '3gp', 'ogv', 'ts', 'mts'
  ],
  audio: [
    'mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a',
    'opus', 'aiff', 'au', 'ra'
  ],
  archive: [
    'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz',
    'tar.gz', 'tar.bz2', 'tar.xz'
  ],
  code: [
    'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c',
    'cs', 'php', 'rb', 'go', 'rs', 'kt', 'swift',
    'html', 'css', 'scss', 'sass', 'json', 'xml', 'yaml', 'yml'
  ]
};

/**
 * Viewable file types that can be previewed in browser
 */
const VIEWABLE_TYPES = [
  'pdf', 'txt', 'md', 'json', 'xml', 'csv',
  'jpg', 'jpeg', 'png', 'gif', 'svg', 'webp',
  'mp4', 'webm', 'ogg', 'mp3', 'wav',
  'html', 'css', 'js', 'ts', 'py', 'java', 'cpp', 'c'
];

/**
 * Get file extension from filename or URL
 */
export function getFileExtension(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase();
  return extension || '';
}

/**
 * Determine file category based on extension
 */
export function getFileCategory(extension: string): FileInfo['category'] {
  for (const [category, extensions] of Object.entries(FILE_CATEGORIES)) {
    if (extensions.includes(extension)) {
      return category as FileInfo['category'];
    }
  }
  return 'other';
}

/**
 * Check if file type is viewable in browser
 */
export function isViewableFile(extension: string): boolean {
  return VIEWABLE_TYPES.includes(extension);
}

/**
 * Parse file information from filename
 */
export function parseFileInfo(filename: string, size?: number): FileInfo {
  const extension = getFileExtension(filename);
  const category = getFileCategory(extension);
  const viewable = isViewableFile(extension);
  
  return {
    name: filename,
    type: getMimeType(extension),
    size,
    extension,
    category,
    viewable,
    downloadable: true // All files are downloadable
  };
}

/**
 * Get MIME type for file extension
 */
export function getMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    // Documents
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'txt': 'text/plain',
    'rtf': 'application/rtf',
    'odt': 'application/vnd.oasis.opendocument.text',
    
    // Spreadsheets
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'csv': 'text/csv',
    
    // Presentations
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    'ico': 'image/x-icon',
    
    // Video
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'ogg': 'video/ogg',
    'avi': 'video/x-msvideo',
    'mov': 'video/quicktime',
    
    // Audio
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'aac': 'audio/aac',
    'flac': 'audio/flac',
    
    // Archives
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    'tar': 'application/x-tar',
    'gz': 'application/gzip',
    
    // Code
    'js': 'application/javascript',
    'json': 'application/json',
    'xml': 'application/xml',
    'html': 'text/html',
    'css': 'text/css',
    'py': 'text/x-python',
    'java': 'text/x-java',
    'cpp': 'text/x-c++',
    'c': 'text/x-c',
    'md': 'text/markdown'
  };
  
  return mimeTypes[extension] || 'application/octet-stream';
}

/**
 * Format file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Extract Google Drive file ID from URL
 */
export function extractGoogleDriveFileId(url: string): string | null {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9-_]+)/,
    /id=([a-zA-Z0-9-_]+)/,
    /\/d\/([a-zA-Z0-9-_]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

/**
 * Convert Google Drive share URL to direct view/download URL
 */
export function convertGoogleDriveUrl(url: string, action: 'view' | 'download' = 'view'): string | null {
  const fileId = extractGoogleDriveFileId(url);
  if (!fileId) return null;
  
  switch (action) {
    case 'view':
      return `https://drive.google.com/file/d/${fileId}/view`;
    case 'download':
      return `https://drive.google.com/uc?export=download&id=${fileId}`;
    default:
      return url;
  }
}

/**
 * Check if URL is a Google Drive URL
 */
export function isGoogleDriveUrl(url: string): boolean {
  return url.includes('drive.google.com') || url.includes('docs.google.com');
}

/**
 * Validate URL format
 */
export function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Extract filename from URL
 */
export function extractFilenameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop() || 'unknown_file';
    
    // Remove query parameters and decode URI
    return decodeURIComponent(filename.split('?')[0]);
  } catch {
    return 'unknown_file';
  }
}

/**
 * Generate file preview URL based on file type and source
 */
export function generatePreviewUrl(url: string, fileInfo?: FileInfo): string {
  if (isGoogleDriveUrl(url)) {
    // For Google Drive, try to generate embed URL
    const fileId = extractGoogleDriveFileId(url);
    if (fileId) {
      return `https://drive.google.com/file/d/${fileId}/preview`;
    }
  }
  
  // For direct file URLs, return as-is if viewable
  if (fileInfo?.viewable || isViewableFile(getFileExtension(url))) {
    return url;
  }
  
  return url;
}

/**
 * Detect file type from content (basic detection)
 */
export function detectFileTypeFromContent(content: string): {
  isUrl: boolean;
  isGoogleDrive: boolean;
  fileInfo?: FileInfo;
} {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = content.match(urlRegex);
  
  if (urls && urls.length > 0) {
    const url = urls[0];
    const isGoogleDrive = isGoogleDriveUrl(url);
    const filename = extractFilenameFromUrl(url);
    const fileInfo = parseFileInfo(filename);
    
    return {
      isUrl: true,
      isGoogleDrive,
      fileInfo
    };
  }
  
  return {
    isUrl: false,
    isGoogleDrive: false
  };
}

/**
 * Parse multiple files from content (URLs, file references, etc.)
 */
export function extractFilesFromContent(content: string): Array<{
  url: string;
  fileInfo: FileInfo;
  isGoogleDrive: boolean;
}> {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = content.match(urlRegex) || [];
  
  return urls.map(url => {
    const isGoogleDrive = isGoogleDriveUrl(url);
    const filename = extractFilenameFromUrl(url);
    const fileInfo = parseFileInfo(filename);
    
    return {
      url,
      fileInfo,
      isGoogleDrive
    };
  });
}