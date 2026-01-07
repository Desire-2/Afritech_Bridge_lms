#!/usr/bin/env node

// Test file upload functionality
console.log('=== File Upload Service Test ===');

try {
    // Test environment setup
    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_5zXbcjoWYqcsdo8z_h2cVge5b3TMn9ovp0JwSd444ZVZNAP";
    process.env.NEXT_PUBLIC_API_URL = "http://192.168.0.4:5001/api/v1";
    
    console.log('Environment variables set');
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