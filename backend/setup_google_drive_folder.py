#!/usr/bin/env python3
"""
Script to create a Google Drive folder and set up proper permissions for the LMS
"""

from dotenv import load_dotenv
load_dotenv()

import sys
from src.utils.google_drive_service import google_drive_service

def setup_lms_folder():
    """Create and configure the main LMS folder in Google Drive"""
    
    print("=== Setting up LMS Google Drive Folder ===")
    
    if not google_drive_service.is_configured:
        print("❌ Google Drive service not configured")
        return False
    
    # Test connection first
    print("1. Testing connection...")
    if not google_drive_service.test_connection():
        print("❌ Connection failed")
        return False
    print("✅ Connection successful")
    
    try:
        # Create the main LMS folder
        print("\n2. Creating main LMS folder...")
        
        folder_metadata = {
            'name': 'Afritec_Bridge_LMS_Files',
            'mimeType': 'application/vnd.google-apps.folder',
            'description': 'File storage for Afritec Bridge Learning Management System'
        }
        
        folder = google_drive_service.service.files().create(
            body=folder_metadata,
            fields='id,name,webViewLink'
        ).execute()
        
        folder_id = folder.get('id')
        folder_name = folder.get('name')
        folder_link = folder.get('webViewLink')
        
        print(f"✅ Folder created successfully!")
        print(f"Folder ID: {folder_id}")
        print(f"Folder Name: {folder_name}")
        print(f"Folder Link: {folder_link}")
        
        # Create subfolders for organization
        print("\n3. Creating organizational subfolders...")
        subfolders = [
            'Assignments',
            'Projects', 
            'Submissions',
            'Certificates'
        ]
        
        for subfolder_name in subfolders:
            subfolder_metadata = {
                'name': subfolder_name,
                'parents': [folder_id],
                'mimeType': 'application/vnd.google-apps.folder'
            }
            
            subfolder = google_drive_service.service.files().create(
                body=subfolder_metadata,
                fields='id,name'
            ).execute()
            
            print(f"   ✅ Created subfolder: {subfolder.get('name')} (ID: {subfolder.get('id')})")
        
        print(f"\n🎉 Setup complete!")
        print(f"\n📝 UPDATE YOUR .env FILE:")
        print(f"GOOGLE_DRIVE_ROOT_FOLDER_ID={folder_id}")
        print(f"\n🔗 Folder Link: {folder_link}")
        print(f"\n⚠️  IMPORTANT: The service account already has access to this folder since it created it.")
        
        return folder_id
        
    except Exception as e:
        print(f"❌ Setup failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_folder_access(folder_id):
    """Test if we can access and write to the folder"""
    print(f"\n=== Testing Access to Folder {folder_id} ===")
    
    try:
        # Try to list contents
        results = google_drive_service.service.files().list(
            q=f"'{folder_id}' in parents",
            pageSize=10,
            fields="files(id, name)"
        ).execute()
        
        files = results.get('files', [])
        print(f"✅ Folder accessible! Contains {len(files)} items.")
        
        return True
        
    except Exception as e:
        print(f"❌ Cannot access folder: {str(e)}")
        return False

if __name__ == "__main__":
    print("Google Drive LMS Folder Setup")
    print("=" * 40)
    
    # Check current folder if specified
    import os
    current_folder = os.getenv('GOOGLE_DRIVE_ROOT_FOLDER_ID')
    
    if current_folder:
        print(f"Current folder ID in .env: {current_folder}")
        if test_folder_access(current_folder):
            print("✅ Current folder is working! No setup needed.")
            sys.exit(0)
        else:
            print("❌ Current folder has issues. Creating new one...")
    
    folder_id = setup_lms_folder()
    
    if folder_id:
        print("\n🎯 Next steps:")
        print("1. Update your .env file with the new GOOGLE_DRIVE_ROOT_FOLDER_ID")
        print("2. Restart your backend server")
        print("3. Test file uploads again")
    else:
        print("\n💥 Setup failed. Please check the error messages above.")
        sys.exit(1)