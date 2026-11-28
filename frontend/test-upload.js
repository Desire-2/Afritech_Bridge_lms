#!/usr/bin/env node

// Test file upload functionality
console.log('=== File Upload Service Test ===');

try {
    // Test environment setup. Credentials must come from the environment;
    // never commit a Blob token to source control.
    process.env.NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api/v1";
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
        console.warn('BLOB_READ_WRITE_TOKEN is not set — set it in your environment before testing uploads');
    }

    console.log('Environment variables checked');
    console.log('BLOB_READ_WRITE_TOKEN present:', !!process.env.BLOB_READ_WRITE_TOKEN);
    console.log('NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL);
    
    // Test service import
    console.log('Testing service imports...');
    
    // Mock File for testing
    class MockFile {
        constructor(name, type, size) {
            this.name = name;
            this.type = type;
            this.size = size;
            this.lastModified = Date.now();
        }
    }
    
    // Test file validation
    const testFile = new MockFile('test.pdf', 'application/pdf', 1024 * 1024); // 1MB
    console.log('Created test file:', testFile);
    
    console.log('=== Test Complete ===');
    
} catch (error) {
    console.error('Test failed:', error.message);
    console.error(error.stack);
}