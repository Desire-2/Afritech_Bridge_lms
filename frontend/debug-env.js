#!/usr/bin/env node

// Debug environment variables
console.log('=== Frontend Environment Debug ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL);
console.log('BLOB_READ_WRITE_TOKEN present:', !!(process.env.BLOB_READ_WRITE_TOKEN));
console.log('BLOB_READ_WRITE_TOKEN value length:', process.env.BLOB_READ_WRITE_TOKEN?.length || 0);

// Check if running in browser vs server
if (typeof window !== 'undefined') {
    console.log('Running in browser');
    console.log('window.process exists:', !!(window as any).process);
} else {
    console.log('Running in Node.js server');
}

// Test Vercel Blob import
try {
    const { put } = require('@vercel/blob');
    console.log('Vercel Blob import successful');
    
    // Test token access
    try {
        // This will test if the token function works
        console.log('Testing token access...');
    } catch (tokenError) {
        console.error('Token access error:', tokenError.message);
    }
} catch (importError) {
    console.error('Vercel Blob import error:', importError.message);
}

console.log('=== End Debug ===');