/**
 * Enhanced File Service for Instructor File Review
 * Handles file operations, comments, downloads, and analysis
 */

import { axiosInstance } from './api/base.service';
import { ApiErrorHandler } from '@/lib/error-handler';

export interface FileComment {
  id: string;
  file_id: string;
  submission_id?: number;
  project_submission_id?: number;
  instructor_id: number;
  instructor_name: string;
  comment_text: string;
  created_at: string;
  updated_at: string;
  is_private: boolean;
}

export interface FileAnalysis {
  id: string;
  file_id: string;
  filename: string;
  file_size?: number;
  mime_type?: string;
  file_category: 'document' | 'image' | 'video' | 'audio' | 'archive' | 'code' | 'other';
  is_viewable: boolean;
  word_count?: number;
  page_count?: number;
  has_images: boolean;
  has_tables: boolean;
  is_password_protected: boolean;
  is_corrupted: boolean;
  virus_scan_clean: boolean;
  created_at: string;
  analyzed_at?: string;
}

export interface FileDownloadResponse {
  blob: Blob;
  filename: string;
}

export class EnhancedFileService {
  private static readonly BASE_PATH = '/api/v1/files';

  /**
   * Add a comment to a specific file
   */
  static async addFileComment(data: {
    file_id: string;
    comment_text: string;
    submission_id?: number;
    project_submission_id?: number;
    is_private?: boolean;
  }): Promise<{ message: string; comment: FileComment }> {
    try {
      const response = await axiosInstance.post(`${this.BASE_PATH}/comments`, data);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Update an existing file comment
   */
  static async updateFileComment(
    commentId: string,
    data: { comment_text: string }
  ): Promise<{ message: string; comment: FileComment }> {
    try {
      const response = await axiosInstance.put(`${this.BASE_PATH}/comments/${commentId}`, data);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Delete a file comment
   */
  static async deleteFileComment(commentId: string): Promise<{ message: string }> {
    try {
      const response = await axiosInstance.delete(`${this.BASE_PATH}/comments/${commentId}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Get all file comments for a submission
   */
  static async getSubmissionFileComments(submissionId: number): Promise<{ comments: FileComment[] }> {
    try {
      const response = await axiosInstance.get(`${this.BASE_PATH}/submission/${submissionId}/comments`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Download all files from a submission as ZIP
   */
  static async downloadSubmissionFiles(submissionId: number): Promise<FileDownloadResponse> {
    try {
      const response = await axiosInstance.get(`${this.BASE_PATH}/download/${submissionId}`, {
        responseType: 'blob',
        headers: {
          'Accept': 'application/zip'
        }
      });

      // Extract filename from Content-Disposition header
      let filename = `submission_${submissionId}_files.zip`;
      const contentDisposition = response.headers['content-disposition'];
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\\n]*=((['\"]).*?\\2|[^;\\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/[\"']/g, '');
        }
      }

      return {
        blob: response.data,
        filename
      };
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Download a single file
   */
  static async downloadSingleFile(fileUrl: string, filename: string): Promise<FileDownloadResponse> {
    try {
      // For Google Drive files, use our backend proxy
      if (fileUrl.includes('drive.google.com')) {
        const response = await axiosInstance.post(`${this.BASE_PATH}/download/single`, {
          file_url: fileUrl,
          filename: filename
        }, {
          responseType: 'blob'
        });
        
        return {
          blob: response.data,
          filename
        };
      }

      // For direct URLs (fallback)
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error('Failed to download file');
      }

      return {
        blob: await response.blob(),
        filename
      };
    } catch (error) {
      throw new Error(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Trigger file analysis for submission
   */
  static async analyzeSubmissionFiles(submissionId: number): Promise<{ message: string; analyses: FileAnalysis[] }> {
    try {
      const response = await axiosInstance.post(`${this.BASE_PATH}/analyze/${submissionId}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Utility function to trigger file download in browser
   */
  static triggerFileDownload(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(link);
  }

  /**
   * Download multiple files sequentially
   */
  static async downloadMultipleFiles(
    files: Array<{ url: string; filename: string }>,
    onProgress?: (completed: number, total: number) => void
  ): Promise<void> {
    for (let i = 0; i < files.length; i++) {
      try {
        const { blob, filename } = await this.downloadSingleFile(files[i].url, files[i].filename);
        this.triggerFileDownload(blob, filename);
        onProgress?.(i + 1, files.length);
        
        // Small delay to prevent overwhelming the browser
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Failed to download ${files[i].filename}:`, error);
        // Continue with other files even if one fails
      }
    }
  }

  /**
   * Get file preview URL for supported file types
   */
  static getFilePreviewUrl(fileUrl: string): string | null {
    if (!fileUrl) return null;

    // Google Drive preview
    if (fileUrl.includes('drive.google.com')) {
      const fileIdMatch = fileUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (fileIdMatch) {
        const fileId = fileIdMatch[1];
        return `https://drive.google.com/file/d/${fileId}/preview`;
      }
    }

    // For direct file URLs, return as-is for preview
    return fileUrl;
  }

  /**
   * Check if file is previewable in browser
   */
  static isFilePreviewable(filename: string): boolean {
    const extension = filename.split('.').pop()?.toLowerCase();
    if (!extension) return false;

    const previewableTypes = [
      'pdf', 'txt', 'md', 'json', 'xml', 'csv',
      'jpg', 'jpeg', 'png', 'gif', 'svg', 'webp',
      'mp4', 'webm', 'ogg', 'mp3', 'wav',
      'html', 'css', 'js', 'ts', 'py', 'java', 'cpp', 'c'
    ];

    return previewableTypes.includes(extension);
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes?: number): string {
    if (!bytes) return 'Unknown size';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Get file type icon class
   */
  static getFileIconClass(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();
    if (!extension) return 'file';

    const iconMap: Record<string, string> = {
      // Documents
      pdf: 'file-text',
      doc: 'file-text',
      docx: 'file-text',
      txt: 'file-text',
      rtf: 'file-text',
      odt: 'file-text',
      
      // Spreadsheets
      xls: 'file-text',
      xlsx: 'file-text',
      csv: 'file-text',
      
      // Images
      jpg: 'image',
      jpeg: 'image',
      png: 'image',
      gif: 'image',
      svg: 'image',
      bmp: 'image',
      webp: 'image',
      
      // Video
      mp4: 'video',
      avi: 'video',
      mov: 'video',
      wmv: 'video',
      webm: 'video',
      
      // Audio
      mp3: 'music',
      wav: 'music',
      flac: 'music',
      aac: 'music',
      
      // Archives
      zip: 'archive',
      rar: 'archive',
      '7z': 'archive',
      tar: 'archive',
      
      // Code
      js: 'code',
      ts: 'code',
      py: 'code',
      java: 'code',
      cpp: 'code',
      html: 'code',
      css: 'code',
      json: 'code'
    };

    return iconMap[extension] || 'file';
  }

  /**
   * Analyze ZIP file contents
   */
  static async analyzeZipFile(fileUrl: string, filename: string): Promise<{
    message: string;
    archive_info: {
      filename: string;
      total_files: number;
      total_size: number;
      files: Array<{
        filename: string;
        size: number;
        compressed_size: number;
        modified: number[];
        crc: number;
        is_encrypted: boolean;
      }>;
    };
  }> {
    try {
      const response = await axiosInstance.post(`${this.BASE_PATH}/analyze-zip`, {
        file_url: fileUrl,
        filename: filename
      });
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Extract specific files from a ZIP archive
   */
  static async extractZipFiles(fileUrl: string, filesToExtract: string[]): Promise<{
    message: string;
    files: Array<{
      filename: string;
      size: number;
      mime_type: string;
      data: string; // hex encoded data
    }>;
  }> {
    try {
      const response = await axiosInstance.post(`${this.BASE_PATH}/extract-zip`, {
        file_url: fileUrl,
        files: filesToExtract
      });
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Convert hex data back to blob for download
   */
  static hexToBlob(hexData: string, mimeType: string): Blob {
    const bytes = new Uint8Array(hexData.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    return new Blob([bytes], { type: mimeType });
  }
}

export default EnhancedFileService;