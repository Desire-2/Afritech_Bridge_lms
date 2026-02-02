#!/usr/bin/env python3
"""
Test script to verify Google Drive upload functionality
"""

from dotenv import load_dotenv
load_dotenv()

import io
import sys
import os
import json
from src.utils.google_drive_service import google_drive_service

def test_google_drive_upload():
    """Test uploading a sample file to Google Drive"""
    
    print("=== Google Drive Upload Test ===")
    print(f"Service configured: {google_drive_service.is_configured}")
    
    if not google_drive_service.is_configured:
        print("❌ Google Drive service not configured")
        return False
    
    # Test connection first
    print("\n1. Testing connection...")
    connection_ok = google_drive_service.test_connection()
    print(f"Connection test: {'✅ SUCCESS' if connection_ok else '❌ FAILED'}")
    
    if not connection_ok:
        return False
    
    # Create a test file
    print("\n2. Creating test file...")
    test_content = "This is a test file for Google Drive upload verification.\nCreated by LMS test script.\nTimestamp: " + str(datetime.utcnow())
    test_file = io.BytesIO(test_content.encode('utf-8'))
    test_filename = "lms_upload_test.txt"
    
    try:
        print("3. Uploading test file...")
        result = google_drive_service.upload_file(
            file_data=test_file,
            filename=test_filename,
            mime_type="text/plain",
            assignment_id=999,  # Test assignment ID
            student_id=1,       # Test student ID
            metadata={
                'test': True,
                'script': 'test_google_drive_upload.py'
            }
        )
        
        print("✅ Upload successful!")
        print(f"File ID: {result.get('file_id')}")
        print(f"View link: {result.get('view_link')}")
        print(f"Download link: {result.get('download_link')}")
        print(f"Filename: {result.get('filename')}")
        print(f"Size: {result.get('size')} bytes")
        
        # Test getting file info
        print("\n4. Testing file info retrieval...")
        file_info = google_drive_service.get_file_info(result['file_id'])
        if file_info:
            print("✅ File info retrieved successfully!")
            print(f"Name: {file_info.get('name')}")
            print(f"Size: {file_info.get('size')} bytes")
        else:
            print("❌ Failed to retrieve file info")
        
        return True
        
    except Exception as e:
        print(f"❌ Upload failed: {str(e)}")
        import traceback
        print("Full error:")
        traceback.print_exc()
        return False

if __name__ == "__main__":
    from datetime import datetime
    
    print("Google Drive Upload Test")
    print("=" * 40)
    
    success = test_google_drive_upload()
    
    if success:
        print("\n🎉 All tests passed! Google Drive integration is working.")
    else:
        print("\n💥 Tests failed. Check the configuration and try again.")
        sys.exit(1)