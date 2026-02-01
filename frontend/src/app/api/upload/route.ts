// Next.js API Route for File Upload
// This provides a server-side proxy for file uploads with proper error handling

import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import fs from 'fs';
import path from 'path';

// Ensure upload directory exists
function ensureUploadDir() {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  return uploadDir;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File too large (max 50MB)' },
        { status: 400 }
      );
    }

    // Get optional parameters
    const folder = formData.get('folder') as string || 'assignments';
    const assignmentId = formData.get('assignmentId') as string;
    const studentId = formData.get('studentId') as string;

    // Check storage configuration
    const storageProvider = process.env.FILE_STORAGE_PROVIDER?.toLowerCase() || 'google_drive';
    
    if (storageProvider === 'google_drive') {
      // Forward to backend for Google Drive handling
      try {
        console.log('Forwarding to backend for Google Drive upload...');
        
        const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
        
        // Get authorization header from request
        const authHeader = request.headers.get('authorization');
        
        // Create new FormData for backend
        const backendFormData = new FormData();
        backendFormData.append('file', file);
        if (folder) backendFormData.append('folder', folder);
        if (assignmentId) backendFormData.append('assignmentId', assignmentId);
        if (studentId) backendFormData.append('studentId', studentId);
        
        const response = await fetch(`${backendUrl}/uploads/file`, {
          method: 'POST',
          body: backendFormData,
          headers: authHeader ? { 'Authorization': authHeader } : undefined
        });
        
        const result = await response.json();
        
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Backend upload failed');
        }
        
        console.log('Backend Google Drive upload successful');
        return NextResponse.json(result);
        
      } catch (backendError: any) {
        console.error('Backend upload failed:', backendError.message);
        // Continue to Vercel Blob fallback
      }
    }

    // Generate unique file path
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2);
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const pathname = `${folder}/${assignmentId || 'general'}/${studentId || 'unknown'}/${timestamp}_${randomId}_${sanitizedFileName}`;

    // Check if Vercel Blob is configured and working
    const hasValidToken = !!(process.env.BLOB_READ_WRITE_TOKEN && 
                            process.env.BLOB_READ_WRITE_TOKEN.startsWith('vercel_blob_rw_'));
    
    if (hasValidToken) {
      try {
        console.log('Attempting Vercel Blob upload...');
        // Upload to Vercel Blob
        const blob = await put(pathname, file, {
          access: 'public',
          contentType: file.type,
          addRandomSuffix: false,
        });

        console.log('Vercel Blob upload successful:', blob.url);
        return NextResponse.json({
          success: true,
          url: blob.url,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          pathname: blob.pathname,
          contentType: file.type,
          contentDisposition: `attachment; filename="${file.name}"`,
          message: 'File upload successful (Vercel Blob)',
          storage: 'vercel_blob'
        });

      } catch (blobError: any) {
        console.error('Vercel Blob upload failed:', blobError.message);
        // Fall through to local storage
      }
    } else {
      console.log('Vercel Blob token not configured, using local storage');
    }

    // Fallback: Store file locally and serve it
    try {
      const uploadDir = ensureUploadDir();
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      
      // Create proper subdirectory structure
      const subDirs = pathname.split('/').slice(0, -1).join('/');
      const fullUploadDir = path.join(uploadDir, subDirs);
      
      if (!fs.existsSync(fullUploadDir)) {
        fs.mkdirSync(fullUploadDir, { recursive: true });
      }
      
      // Store file with proper path structure
      const localFilePath = path.join(uploadDir, pathname);
      fs.writeFileSync(localFilePath, fileBuffer);
      
      const fileUrl = `/uploads/${pathname}`;
      console.log('File stored locally with structure:', fileUrl);
      
      return NextResponse.json({
        success: true,
        url: fileUrl,
        size: file.size,
        pathname: pathname,
        contentType: file.type,
        uploadedAt: new Date().toISOString(),
        contentDisposition: `attachment; filename="${file.name}"`,
        message: 'File upload successful (local storage)',
        storage: 'local'
      });
      
    } catch (localError: any) {
      console.error('Local file storage failed:', localError);
      throw new Error(`Failed to store file: ${localError.message}`);
    }

  } catch (error: any) {
    console.error('File upload error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: `Upload failed: ${error.message || 'Unknown error'}` 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'File upload endpoint. Use POST to upload files.',
    maxSize: '50MB',
    supportedFormats: [
      'Documents: PDF, DOC, DOCX, TXT, RTF',
      'Images: JPEG, PNG, GIF, WEBP, BMP, SVG',
      'Code: HTML, CSS, JS, TS, PY, JAVA, C, CPP, JSON, XML',
      'Archives: ZIP, TAR, GZ, RAR',
      'Office: XLS, XLSX, PPT, PPTX',
      'Media: MP3, WAV, OGG, MP4, WEBM, MOV'
    ]
  });
}