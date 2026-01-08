// File Upload Service with Vercel Blob Storage and Backend Fallback
import { put, list, del, head } from '@vercel/blob';

export interface UploadedFile {
  url: string;
  size: number;
  uploadedAt: string;
  pathname: string;
  contentType: string;
  contentDisposition: string;
}

export interface StagedFile {
  file: File;
  id: string;
  preview?: string;
  validationResult: FileValidationResult;
}

export interface FileUploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  file: File;
}

export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface BatchUploadResult {
  successful: UploadedFile[];
  failed: { file: File; error: string }[];
  totalUploaded: number;
  totalFailed: number;
}

export class FileUploadService {
  private static readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  private static readonly DEFAULT_ALLOWED_TYPES = [
    // Note: Vercel Blob requires BLOB_READ_WRITE_TOKEN environment variable
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/rtf',
    
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/svg+xml',
    
    // Code files
    'text/html',
    'text/css',
    'text/javascript',
    'text/typescript',
    'text/x-python',
    'text/x-java-source',
    'text/x-c',
    'text/x-c++src',
    'application/json',
    'application/xml',
    
    // Archives
    'application/zip',
    'application/x-tar',
    'application/gzip',
    'application/x-rar-compressed',
    
    // Spreadsheets & Presentations
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    
    // Audio & Video (for media assignments)
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ];

  /**
   * Validate a file before upload
   */
  static validateFile(
    file: File, 
    allowedTypes?: string[], 
    maxSize?: number
  ): FileValidationResult {
    const errors: string[] = [];
    const types = allowedTypes || this.DEFAULT_ALLOWED_TYPES;
    const size = maxSize || this.MAX_FILE_SIZE;

    // Check file size
    if (file.size > size) {
      errors.push(`File size ${this.formatBytes(file.size)} exceeds maximum allowed size of ${this.formatBytes(size)}`);
    }

    // Check file type
    if (!types.includes(file.type)) {
      errors.push(`File type "${file.type}" is not allowed. Allowed types: ${types.join(', ')}`);
    }

    // Check file name
    if (file.name.length > 255) {
      errors.push('File name is too long (maximum 255 characters)');
    }

    // Check for potentially dangerous file names
    const dangerousPatterns = [/\.\./g, /[<>:"|?*]/g, /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i];
    if (dangerousPatterns.some(pattern => pattern.test(file.name))) {
      errors.push('File name contains invalid characters or reserved names');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Upload a single file to Vercel Blob
   */
  static async uploadFile(
    file: File,
    options: {
      folder?: string;
      assignmentId?: number;
      studentId?: number;
      onProgress?: (progress: FileUploadProgress) => void;
      allowedTypes?: string[];
      maxSize?: number;
    } = {}
  ): Promise<UploadedFile> {
    // Validate file
    const validation = this.validateFile(file, options.allowedTypes, options.maxSize);
    if (!validation.isValid) {
      throw new Error(`File validation failed: ${validation.errors.join(', ')}`);
    }

    // Generate unique file path
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2);
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const folder = options.folder || 'assignments';
    const pathname = `${folder}/${options.assignmentId || 'general'}/${options.studentId || 'unknown'}/${timestamp}_${randomId}_${sanitizedFileName}`;

    // Simulate progress if callback provided
    if (options.onProgress) {
      options.onProgress({
        loaded: 0,
        total: file.size,
        percentage: 0,
        file
      });
    }

    try {
      // Use Next.js API route for upload (handles Vercel Blob internally)
      const formData = new FormData();
      formData.append('file', file);
      
      if (options.folder) formData.append('folder', options.folder);
      if (options.assignmentId) formData.append('assignmentId', options.assignmentId.toString());
      if (options.studentId) formData.append('studentId', options.studentId.toString());

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      // Final progress update
      if (options.onProgress) {
        options.onProgress({
          loaded: file.size,
          total: file.size,
          percentage: 100,
          file
        });
      }

      return {
        url: result.url,
        size: result.size || file.size,
        uploadedAt: result.uploadedAt || new Date().toISOString(),
        pathname: result.pathname,
        contentType: result.contentType || file.type,
        contentDisposition: result.contentDisposition || `attachment; filename="${file.name}"`
      };

    } catch (error: any) {
      console.error('File upload error:', error);
      
      // Try backend fallback if Next.js API route fails
      try {
        console.warn('Next.js API upload failed, attempting backend upload fallback');
        return await this.uploadToBackend(file, options);
      } catch (backendError: any) {
        console.error('Backend upload also failed:', backendError);
        throw new Error(`Upload failed: ${error.message}. Backend fallback also failed: ${backendError.message}`);
      }
    }
  }

  /**
   * Upload multiple files with progress tracking
   */
  static async uploadFiles(
    files: File[],
    options: {
      folder?: string;
      assignmentId?: number;
      studentId?: number;
      onFileProgress?: (fileIndex: number, progress: FileUploadProgress) => void;
      onOverallProgress?: (completed: number, total: number) => void;
      allowedTypes?: string[];
      maxSize?: number;
      maxFiles?: number;
    } = {}
  ): Promise<UploadedFile[]> {
    if (options.maxFiles && files.length > options.maxFiles) {
      throw new Error(`Too many files. Maximum allowed: ${options.maxFiles}`);
    }

    const results: UploadedFile[] = [];
    let completed = 0;

    for (let i = 0; i < files.length; i++) {
      try {
        const uploadedFile = await this.uploadFile(files[i], {
          ...options,
          onProgress: options.onFileProgress 
            ? (progress) => options.onFileProgress!(i, progress)
            : undefined
        });
        
        results.push(uploadedFile);
        completed++;
        
        if (options.onOverallProgress) {
          options.onOverallProgress(completed, files.length);
        }
      } catch (error: any) {
        // Continue with other files, but record the error
        console.error(`Failed to upload file ${files[i].name}:`, error);
        throw new Error(`Failed to upload "${files[i].name}": ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Delete a file from Vercel Blob
   */
  static async deleteFile(url: string): Promise<void> {
    try {
      await del(url);
    } catch (error: any) {
      console.error('File deletion error:', error);
      throw new Error(`Delete failed: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Get file metadata
   */
  static async getFileInfo(url: string): Promise<any> {
    try {
      return await head(url);
    } catch (error: any) {
      console.error('File info error:', error);
      throw new Error(`Failed to get file info: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * List files in a folder
   */
  static async listFiles(prefix: string = ''): Promise<any[]> {
    try {
      const { blobs } = await list({ prefix });
      return blobs;
    } catch (error: any) {
      console.error('List files error:', error);
      throw new Error(`Failed to list files: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Format bytes to human readable format
   */
  static formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Get file extension from filename
   */
  static getFileExtension(filename: string): string {
    return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
  }

  /**
   * Get content type from file extension
   */
  static getContentType(filename: string): string {
    const ext = this.getFileExtension(filename).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'txt': 'text/plain',
      'rtf': 'application/rtf',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'bmp': 'image/bmp',
      'svg': 'image/svg+xml',
      'html': 'text/html',
      'css': 'text/css',
      'js': 'text/javascript',
      'ts': 'text/typescript',
      'py': 'text/x-python',
      'java': 'text/x-java-source',
      'c': 'text/x-c',
      'cpp': 'text/x-c++src',
      'json': 'application/json',
      'xml': 'application/xml',
      'zip': 'application/zip',
      'tar': 'application/x-tar',
      'gz': 'application/gzip',
      'rar': 'application/x-rar-compressed',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'mov': 'video/quicktime'
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Check if file is an image
   */
  static isImageFile(file: File | string): boolean {
    const type = typeof file === 'string' 
      ? this.getContentType(file)
      : file.type;
    
    return type.startsWith('image/');
  }

  /**
   * Check if file can be previewed in browser
   */
  static canPreviewFile(file: File | string): boolean {
    const type = typeof file === 'string' 
      ? this.getContentType(file)
      : file.type;
    
    const previewableTypes = [
      'application/pdf',
      'text/plain',
      'text/html',
      'text/css',
      'text/javascript',
      'application/json',
      'application/xml'
    ];
    
    return type.startsWith('image/') || previewableTypes.includes(type);
  }

  /**
   * Check if Vercel Blob is available and properly configured
   */
  private static isVercelBlobAvailable(): boolean {
    try {
      // Check if we have the required token - only server-side
      if (typeof window === 'undefined') {
        // Server-side: check process.env
        return !!process.env.BLOB_READ_WRITE_TOKEN;
      } else {
        // Client-side: Vercel Blob needs server-side token, so disable for client
        return false;
      }
    } catch {
      return false;
    }
  }

  /**
   * Upload file using backend API as fallback
   */
  private static async uploadToBackend(
    file: File,
    options: {
      folder?: string;
      assignmentId?: number;
      studentId?: number;
      onProgress?: (progress: FileUploadProgress) => void;
    } = {}
  ): Promise<UploadedFile> {
    const formData = new FormData();
    formData.append('file', file);
    
    if (options.folder) formData.append('folder', options.folder);
    if (options.assignmentId) formData.append('assignmentId', options.assignmentId.toString());
    if (options.studentId) formData.append('studentId', options.studentId.toString());

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
    
    try {
      const response = await fetch(`${apiUrl}/uploads/file`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Simulate final progress
      if (options.onProgress) {
        options.onProgress({
          loaded: file.size,
          total: file.size,
          percentage: 100,
          file
        });
      }

      return {
        url: result.url,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        pathname: result.pathname || file.name,
        contentType: file.type,
        contentDisposition: `attachment; filename="${file.name}"`
      };
    } catch (error: any) {
      console.error('Backend upload error:', error);
      throw new Error(`Backend upload failed: ${error.message}`);
    }
  }

  /**
   * Generate a download URL for a file
   */
  static getDownloadUrl(blobUrl: string, filename: string): string {
    try {
      // Handle different URL types
      if (blobUrl.startsWith('/uploads/')) {
        // Local file - serve directly
        return blobUrl;
      }
      
      if (blobUrl.startsWith('/mock-uploads/')) {
        // Mock URL - warn user
        console.warn('Attempted to download mock file URL:', blobUrl);
        return blobUrl;
      }
      
      // Vercel Blob or other external URL
      const url = new URL(blobUrl);
      url.searchParams.set('download', '1');
      url.searchParams.set('filename', filename);
      return url.toString();
    } catch {
      return blobUrl;
    }
  }

  /**
   * Check if file URL is valid for preview
   */
  static isValidPreviewUrl(url: string): boolean {
    // Mock URLs are not valid for preview
    if (url.startsWith('/mock-uploads/')) {
      return false;
    }
    
    // Local uploads and Vercel Blob URLs are valid
    return url.startsWith('/uploads/') || url.startsWith('https://') || url.startsWith('http://');
  }

  /**
   * Create a shareable link for a file
   */
  static createShareableLink(blobUrl: string, options: {
    expiresIn?: number; // minutes
    password?: string;
  } = {}): string {
    // For now, return the blob URL directly
    // In a production environment, you might want to create temporary links
    return blobUrl;
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Stage files for later upload (validate and prepare without uploading)
   */
  static stageFiles(
    files: File[],
    options: {
      allowedTypes?: string[];
      maxSize?: number;
      maxFiles?: number;
    } = {}
  ): StagedFile[] {
    if (options.maxFiles && files.length > options.maxFiles) {
      throw new Error(`Too many files. Maximum allowed: ${options.maxFiles}`);
    }

    const stagedFiles: StagedFile[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const id = `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).substring(2)}`;
      const validationResult = this.validateFile(file, options.allowedTypes, options.maxSize);
      
      // Create preview for images
      let preview: string | undefined;
      if (this.isImageFile(file.name)) {
        preview = URL.createObjectURL(file);
      }
      
      stagedFiles.push({
        file,
        id,
        preview,
        validationResult
      });
    }
    
    return stagedFiles;
  }

  /**
   * Upload multiple staged files with comprehensive progress tracking
   */
  static async uploadStagedFiles(
    stagedFiles: StagedFile[],
    options: {
      folder?: string;
      assignmentId?: number;
      projectId?: number;
      studentId?: number;
      onFileProgress?: (fileId: string, progress: FileUploadProgress) => void;
      onOverallProgress?: (completed: number, total: number, failed: number) => void;
      onFileComplete?: (fileId: string, result: UploadedFile | null, error?: string) => void;
    } = {}
  ): Promise<BatchUploadResult> {
    const successful: UploadedFile[] = [];
    const failed: { file: File; error: string }[] = [];
    let completed = 0;

    // Only upload valid files
    const validFiles = stagedFiles.filter(sf => sf.validationResult.isValid);
    const invalidFiles = stagedFiles.filter(sf => !sf.validationResult.isValid);
    
    // Add invalid files to failed list immediately
    for (const invalidFile of invalidFiles) {
      const error = `Validation failed: ${invalidFile.validationResult.errors.join(', ')}`;
      failed.push({ file: invalidFile.file, error });
      
      if (options.onFileComplete) {
        options.onFileComplete(invalidFile.id, null, error);
      }
    }

    for (let i = 0; i < validFiles.length; i++) {
      const stagedFile = validFiles[i];
      
      try {
        const uploadedFile = await this.uploadFile(stagedFile.file, {
          folder: options.folder,
          assignmentId: options.assignmentId,
          studentId: options.studentId,
          onProgress: options.onFileProgress 
            ? (progress) => options.onFileProgress!(stagedFile.id, progress) 
            : undefined
        });
        
        successful.push(uploadedFile);
        
        if (options.onFileComplete) {
          options.onFileComplete(stagedFile.id, uploadedFile);
        }
        
      } catch (error: any) {
        console.error(`Failed to upload ${stagedFile.file.name}:`, error);
        const errorMessage = error.message || `Upload failed: ${error}`;
        failed.push({ file: stagedFile.file, error: errorMessage });
        
        if (options.onFileComplete) {
          options.onFileComplete(stagedFile.id, null, errorMessage);
        }
      } finally {
        completed++;
        
        if (options.onOverallProgress) {
          options.onOverallProgress(successful.length, validFiles.length, failed.length);
        }
      }
    }

    return {
      successful,
      failed,
      totalUploaded: successful.length,
      totalFailed: failed.length + invalidFiles.length
    };
  }

  /**
   * Clean up staged file previews (revoke blob URLs)
   */
  static cleanupStagedFiles(stagedFiles: StagedFile[]): void {
    stagedFiles.forEach(stagedFile => {
      if (stagedFile.preview && stagedFile.preview.startsWith('blob:')) {
        URL.revokeObjectURL(stagedFile.preview);
      }
    });
  }

  /**
   * Get total size of staged files
   */
  static getTotalStagedSize(stagedFiles: StagedFile[]): number {
    return stagedFiles.reduce((total, stagedFile) => total + stagedFile.file.size, 0);
  }

  /**
   * Get valid staged files (only files that pass validation)
   */
  static getValidStagedFiles(stagedFiles: StagedFile[]): StagedFile[] {
    return stagedFiles.filter(sf => sf.validationResult.isValid);
  }

  /**
   * Get invalid staged files with their errors
   */
  static getInvalidStagedFiles(stagedFiles: StagedFile[]): { stagedFile: StagedFile; errors: string[] }[] {
    return stagedFiles
      .filter(sf => !sf.validationResult.isValid)
      .map(sf => ({ stagedFile: sf, errors: sf.validationResult.errors }));
  }

  /**
   * Verify that all staging methods are available (for debugging)
   */
  static verifyStagingMethods(): boolean {
    const methods = [
      'stageFiles',
      'uploadStagedFiles', 
      'cleanupStagedFiles',
      'getTotalStagedSize',
      'getValidStagedFiles',
      'getInvalidStagedFiles'
    ];
    
    const missing = methods.filter(method => typeof FileUploadService[method] !== 'function');
    
    if (missing.length > 0) {
      console.error('Missing FileUploadService methods:', missing);
      return false;
    }
    
    console.log('All staging methods are available');
    return true;
  }
}

export default FileUploadService;