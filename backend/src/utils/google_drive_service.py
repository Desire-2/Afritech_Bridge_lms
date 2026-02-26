# Google Drive API Service for File Management
# Handles file upload, download, sharing permissions, and organization

import os
import json
import logging
import tempfile
from typing import Optional, Dict, List, Tuple, Any
from io import BytesIO
from datetime import datetime, timedelta

# Google API imports
from google.auth.transport.requests import Request
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload, MediaFileUpload
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)

class GoogleDriveService:
    """
    Google Drive service for managing file uploads, downloads, and permissions
    for assignment submissions in the LMS.
    """
    
    # Define SCOPES at class level
    SCOPES = [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.file',
    ]
    
    def __init__(self):
        """Initialize the Google Drive service with authentication"""
        self.service = None
        self.credentials = None
        self.is_configured = False
        self._initialize_service()
    
    def _initialize_service(self):
        """Initialize Google Drive service with service account credentials.
        
        Supports OAuth domain-wide delegation: set GOOGLE_DRIVE_DELEGATED_USER
        to a real Google Workspace user email so the service account impersonates
        that user.  This avoids the "Service Accounts do not have storage quota"
        error because files are created under the delegated user's quota.
        """
        try:
            # Get service account credentials from environment
            service_account_info = os.getenv('GOOGLE_SERVICE_ACCOUNT_JSON')
            if not service_account_info or service_account_info.strip() == '':
                logger.warning("GOOGLE_SERVICE_ACCOUNT_JSON environment variable not configured - Google Drive features will be disabled")
                self.is_configured = False
                return
            
            # Parse JSON credentials
            try:
                creds_dict = json.loads(service_account_info)
            except json.JSONDecodeError as e:
                logger.warning(f"Invalid JSON in GOOGLE_SERVICE_ACCOUNT_JSON - Google Drive features will be disabled: {e}")
                self.is_configured = False
                return
            
            # Create credentials — with optional domain-wide delegation
            delegated_user = os.getenv('GOOGLE_DRIVE_DELEGATED_USER', '').strip()
            if delegated_user:
                self.credentials = Credentials.from_service_account_info(
                    creds_dict,
                    scopes=self.SCOPES,
                    subject=delegated_user,
                )
                logger.info(f"Google Drive: using domain-wide delegation as {delegated_user}")
            else:
                self.credentials = Credentials.from_service_account_info(
                    creds_dict,
                    scopes=self.SCOPES,
                )
            
            # Build the service
            self.service = build('drive', 'v3', credentials=self.credentials)
            self.is_configured = True
            
            logger.info("Google Drive service initialized successfully")
            
        except Exception as e:
            logger.warning(f"Failed to initialize Google Drive service - features will be disabled: {str(e)}")
            self.is_configured = False
            self.service = None
            self.credentials = None
    
    def _get_or_create_folder(self, folder_name: str, parent_folder_id: Optional[str] = None) -> str:
        """
        Get or create a folder in Google Drive
        
        Args:
            folder_name: Name of the folder
            parent_folder_id: ID of parent folder (optional)
            
        Returns:
            str: Folder ID
        """
        if not self.is_configured:
            raise ValueError("Google Drive service is not configured")
            
        try:
            # Search for existing folder
            query = f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
            if parent_folder_id:
                query += f" and '{parent_folder_id}' in parents"
            
            results = self.service.files().list(
                q=query,
                spaces='drive',
                supportsAllDrives=True,
                includeItemsFromAllDrives=True
            ).execute()
            
            items = results.get('files', [])
            
            if items:
                # Folder exists, return its ID
                folder_id = items[0]['id']
                logger.info(f"Found existing folder '{folder_name}': {folder_id}")
                return folder_id
            
            # Create new folder
            folder_metadata = {
                'name': folder_name,
                'mimeType': 'application/vnd.google-apps.folder'
            }
            
            if parent_folder_id:
                folder_metadata['parents'] = [parent_folder_id]
            
            folder = self.service.files().create(
                body=folder_metadata,
                supportsAllDrives=True,
                supportsTeamDrives=True
            ).execute()
            folder_id = folder.get('id')
            
            logger.info(f"Created new folder '{folder_name}': {folder_id}")
            return folder_id
            
        except HttpError as e:
            logger.error(f"Error managing folder '{folder_name}': {e}")
            raise
    
    def _setup_folder_structure(self, assignment_id: int, student_id: int) -> str:
        """
        Set up organized folder structure for assignment files
        
        Args:
            assignment_id: Assignment ID
            student_id: Student ID
            
        Returns:
            str: Target folder ID for file upload
        """
        try:
            # Get root folder ID from environment
            root_folder_id = os.getenv('GOOGLE_DRIVE_ROOT_FOLDER_ID')
            
            if not root_folder_id:
                raise ValueError("GOOGLE_DRIVE_ROOT_FOLDER_ID not configured")
            
            # Try to create organized subfolder structure
            try:
                # Create/get main LMS folder
                lms_folder_id = self._get_or_create_folder(
                    'Afritec_Bridge_LMS_Submissions', 
                    root_folder_id
                )
                
                # Create/get assignment folder
                assignment_folder_id = self._get_or_create_folder(
                    f'Assignment_{assignment_id}',
                    lms_folder_id
                )
                
                # Create/get student folder
                student_folder_id = self._get_or_create_folder(
                    f'Student_{student_id}',
                    assignment_folder_id
                )
                
                logger.info(f"Created organized folder structure: Assignment_{assignment_id}/Student_{student_id}")
                return student_folder_id
                
            except HttpError as folder_error:
                # If subfolder creation fails (permissions), use root folder directly
                logger.warning(f"Could not create organized subfolder structure: {folder_error}")
                logger.info(f"Falling back to root folder for upload: {root_folder_id}")
                return root_folder_id
            
        except Exception as e:
            logger.error(f"Error setting up folder structure: {e}")
            # Fallback to root folder
            root_folder_id = os.getenv('GOOGLE_DRIVE_ROOT_FOLDER_ID')
            if root_folder_id:
                logger.info(f"Using root folder as fallback: {root_folder_id}")
                return root_folder_id
            else:
                raise ValueError("No valid folder ID available for file upload")
    
    def upload_file(self, 
                   file_data: BytesIO, 
                   filename: str, 
                   mime_type: str,
                   assignment_id: int,
                   student_id: int,
                   metadata: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Upload a file to Google Drive
        
        Args:
            file_data: File data as BytesIO
            filename: Name of the file
            mime_type: MIME type of the file
            assignment_id: Assignment ID for organization
            student_id: Student ID for organization
            metadata: Additional metadata (optional)
            
        Returns:
            Dict containing file information
        """
        if not self.is_configured:
            raise ValueError("Google Drive service is not configured")
            
        try:
            # Set up folder structure
            folder_id = self._setup_folder_structure(assignment_id, student_id)
            
            # Generate unique filename with timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            unique_filename = f"{timestamp}_{filename}"
            
            # File metadata
            file_metadata = {
                'name': unique_filename,
                'parents': [folder_id],
                'description': json.dumps({
                    'assignment_id': assignment_id,
                    'student_id': student_id,
                    'original_filename': filename,
                    'uploaded_at': datetime.utcnow().isoformat(),
                    'metadata': metadata or {}
                })
            }
            
            # Upload file
            media = MediaIoBaseUpload(
                file_data,
                mimetype=mime_type,
                resumable=False  # Disable resumable upload for service accounts
            )
            
            # Create file with specific ownership settings
            file = self.service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id,name,size,createdTime,webViewLink,webContentLink,mimeType',
                supportsAllDrives=True,  # Support shared drives
                supportsTeamDrives=True  # Legacy support
            ).execute()
            
            # Make file accessible to anyone with the link (for LMS access)
            self._set_file_permissions(file['id'])
            
            # Get updated file info with public link
            file_info = self.service.files().get(
                fileId=file['id'],
                fields='id,name,size,createdTime,webViewLink,webContentLink,mimeType'
            ).execute()
            
            logger.info(f"Successfully uploaded file '{unique_filename}' with ID: {file['id']}")
            
            return {
                'file_id': file['id'],
                'filename': unique_filename,
                'original_filename': filename,
                'size': int(file_info.get('size', 0)),
                'mime_type': file_info['mimeType'],
                'view_link': file_info['webViewLink'],
                'download_link': file_info['webContentLink'],
                'uploaded_at': file_info['createdTime'],
                'folder_id': folder_id
            }
            
        except HttpError as e:
            logger.error(f"HTTP error uploading file '{filename}': {e}")
            raise
        except Exception as e:
            logger.error(f"Error uploading file '{filename}': {e}")
            raise
    
    def _set_file_permissions(self, file_id: str):
        """
        Set file permissions to allow anyone with link to view
        
        Args:
            file_id: Google Drive file ID
        """
        try:
            permission = {
                'type': 'anyone',
                'role': 'reader'
            }
            
            self.service.permissions().create(
                fileId=file_id,
                body=permission
            ).execute()
            
            logger.debug(f"Set public permissions for file: {file_id}")
            
        except HttpError as e:
            logger.warning(f"Could not set permissions for file {file_id}: {e}")
    
    def delete_file(self, file_id: str) -> bool:
        """
        Delete a file from Google Drive
        
        Args:
            file_id: Google Drive file ID
            
        Returns:
            bool: Success status
        """
        if not self.is_configured:
            logger.warning("Google Drive service is not configured")
            return False
            
        try:
            self.service.files().delete(fileId=file_id).execute()
            logger.info(f"Successfully deleted file: {file_id}")
            return True
            
        except HttpError as e:
            logger.error(f"Error deleting file {file_id}: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error deleting file {file_id}: {e}")
            return False
    
    def get_file_info(self, file_id: str) -> Optional[Dict[str, Any]]:
        """
        Get file information from Google Drive
        
        Args:
            file_id: Google Drive file ID
            
        Returns:
            Dict with file information or None if not found
        """
        if not self.is_configured:
            logger.warning("Google Drive service is not configured")
            return None
            
        try:
            file_info = self.service.files().get(
                fileId=file_id,
                fields='id,name,size,createdTime,webViewLink,webContentLink,mimeType,description'
            ).execute()
            
            # Parse metadata from description if available
            metadata = {}
            if file_info.get('description'):
                try:
                    metadata = json.loads(file_info['description'])
                except json.JSONDecodeError:
                    pass
            
            return {
                'file_id': file_info['id'],
                'filename': file_info['name'],
                'size': int(file_info.get('size', 0)),
                'mime_type': file_info['mimeType'],
                'view_link': file_info['webViewLink'],
                'download_link': file_info['webContentLink'],
                'created_time': file_info['createdTime'],
                'metadata': metadata
            }
            
        except HttpError as e:
            if e.resp.status == 404:
                logger.warning(f"File not found: {file_id}")
                return None
            logger.error(f"Error getting file info {file_id}: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error getting file info {file_id}: {e}")
            return None
    
    def list_assignment_files(self, assignment_id: int, student_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        List files for an assignment (optionally filtered by student)
        
        Args:
            assignment_id: Assignment ID
            student_id: Student ID (optional, for filtering)
            
        Returns:
            List of file information dictionaries
        """
        try:
            # Build query to find files
            query = f"description contains 'assignment_id\": {assignment_id}' and trashed=false"
            if student_id:
                query += f" and description contains 'student_id\": {student_id}'"
            
            results = self.service.files().list(
                q=query,
                fields='files(id,name,size,createdTime,webViewLink,webContentLink,mimeType,description)',
                orderBy='createdTime desc'
            ).execute()
            
            files = []
            for file_info in results.get('files', []):
                # Parse metadata
                metadata = {}
                if file_info.get('description'):
                    try:
                        metadata = json.loads(file_info['description'])
                    except json.JSONDecodeError:
                        pass
                
                files.append({
                    'file_id': file_info['id'],
                    'filename': file_info['name'],
                    'original_filename': metadata.get('original_filename', file_info['name']),
                    'size': int(file_info.get('size', 0)),
                    'mime_type': file_info['mimeType'],
                    'view_link': file_info['webViewLink'],
                    'download_link': file_info['webContentLink'],
                    'created_time': file_info['createdTime'],
                    'metadata': metadata
                })
            
            return files
            
        except HttpError as e:
            logger.error(f"Error listing files for assignment {assignment_id}: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error listing assignment files: {e}")
            return []
    
    def test_connection(self) -> bool:
        """
        Test the Google Drive connection
        
        Returns:
            bool: True if connection is successful
        """
        if not self.is_configured:
            logger.warning("Google Drive service is not configured")
            return False
            
        try:
            # Try to get information about the service account
            about = self.service.about().get(fields='user').execute()
            logger.info(f"Google Drive connection successful. Service account: {about.get('user', {}).get('emailAddress', 'Unknown')}")
            return True
            
        except Exception as e:
            logger.error(f"Google Drive connection test failed: {e}")
            return False


# Global instance for use throughout the application
google_drive_service = GoogleDriveService()