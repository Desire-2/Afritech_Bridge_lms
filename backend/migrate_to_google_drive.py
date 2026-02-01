#!/usr/bin/env python3
"""
Migration script to move assignment files from Vercel Blob/local storage to Google Drive
This script will:
1. Find all assignment submissions with file URLs
2. Download files from existing URLs
3. Upload them to Google Drive
4. Update database records with new Google Drive URLs
"""

import os
import sys
import json
import logging
import requests
from datetime import datetime
from io import BytesIO
from urllib.parse import urlparse

# Add the backend src directory to Python path
backend_path = os.path.dirname(os.path.abspath(__file__))
src_path = os.path.join(backend_path, 'src')
sys.path.insert(0, src_path)

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import models and services after setting up the path
from models.user_models import db, User
from models.course_models import AssignmentSubmission, ProjectSubmission
from utils.google_drive_service import google_drive_service

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create Flask app for database context
app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///instance/afritec_lms_db.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Transform DATABASE_URL if needed
if app.config['SQLALCHEMY_DATABASE_URI'].startswith('postgres://'):
    app.config['SQLALCHEMY_DATABASE_URI'] = app.config['SQLALCHEMY_DATABASE_URI'].replace('postgres://', 'postgresql://', 1)

db.init_app(app)

class FileMigrationService:
    """Service to handle file migration from various sources to Google Drive"""
    
    def __init__(self):
        self.success_count = 0
        self.failure_count = 0
        self.skip_count = 0
        self.migration_log = []
    
    def download_file_from_url(self, url: str) -> tuple[BytesIO, str, str]:
        """
        Download a file from URL
        Returns: (file_data, filename, content_type)
        """
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            
            # Get filename from URL or Content-Disposition header
            filename = self._extract_filename_from_url(url, response.headers)
            content_type = response.headers.get('content-type', 'application/octet-stream')
            
            file_data = BytesIO(response.content)
            return file_data, filename, content_type
            
        except Exception as e:
            logger.error(f"Failed to download file from {url}: {str(e)}")
            raise
    
    def _extract_filename_from_url(self, url: str, headers: dict) -> str:
        """Extract filename from URL or headers"""
        # Try Content-Disposition header first
        content_disp = headers.get('content-disposition', '')
        if 'filename=' in content_disp:
            filename = content_disp.split('filename=')[1].strip('\"')
            return filename
        
        # Extract from URL
        parsed_url = urlparse(url)
        path = parsed_url.path
        
        if '/' in path:
            filename = path.split('/')[-1]
        else:
            filename = path
        
        # Remove query parameters
        if '?' in filename:
            filename = filename.split('?')[0]
        
        # Fallback if no extension
        if not filename or '.' not in filename:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f'migrated_file_{timestamp}'
        
        return filename
    
    def migrate_assignment_submission(self, submission: AssignmentSubmission) -> bool:
        """
        Migrate files for a single assignment submission
        Returns: True if successful, False otherwise
        """
        try:
            if not submission.file_url:
                logger.info(f"No files to migrate for submission {submission.id}")
                self.skip_count += 1
                return True
            
            # Parse file data (could be JSON list or single URL)
            files_data = []
            try:
                parsed_data = json.loads(submission.file_url)
                if isinstance(parsed_data, list):
                    files_data = parsed_data
                else:
                    # Single URL as string
                    files_data = [{'url': submission.file_url, 'filename': 'submission_file'}]
            except json.JSONDecodeError:
                # Assume it's a single URL string
                files_data = [{'url': submission.file_url, 'filename': 'submission_file'}]
            
            if not files_data:
                self.skip_count += 1
                return True
            
            new_files_data = []
            
            for file_info in files_data:
                if isinstance(file_info, str):
                    # Old format: just URL
                    url = file_info
                    original_filename = 'submission_file'
                elif isinstance(file_info, dict):
                    url = file_info.get('url', file_info.get('file_url', ''))
                    original_filename = file_info.get('filename', file_info.get('original_filename', 'submission_file'))
                else:
                    logger.warning(f"Unknown file format in submission {submission.id}: {file_info}")
                    continue
                
                # Skip if already a Google Drive URL
                if 'drive.google.com' in url or 'googleusercontent.com' in url:
                    logger.info(f"File already in Google Drive: {url}")
                    new_files_data.append(file_info)
                    continue
                
                # Skip mock URLs
                if url.startswith('/uploads/') or 'mock' in url.lower():
                    logger.info(f"Skipping mock URL: {url}")
                    new_files_data.append(file_info)
                    continue
                
                try:
                    # Download file
                    logger.info(f"Downloading file from: {url}")
                    file_data, filename, content_type = self.download_file_from_url(url)
                    
                    # Use original filename if available
                    if original_filename and original_filename != 'submission_file':
                        filename = original_filename
                    
                    # Upload to Google Drive
                    logger.info(f"Uploading {filename} to Google Drive...")
                    result = google_drive_service.upload_file(
                        file_data=file_data,
                        filename=filename,
                        mime_type=content_type,
                        assignment_id=submission.assignment_id,
                        student_id=submission.student_id,
                        metadata={
                            'migrated_from': url,
                            'migration_date': datetime.utcnow().isoformat(),
                            'original_submission_id': submission.id
                        }
                    )
                    
                    # Create new file info with Google Drive data
                    new_file_info = {
                        'file_id': result['file_id'],
                        'filename': result['filename'],
                        'original_filename': result['original_filename'],
                        'size': result['size'],
                        'mime_type': result['mime_type'],
                        'url': result['view_link'],
                        'download_link': result['download_link'],
                        'uploaded_at': result['uploaded_at'],
                        'storage': 'google_drive'
                    }
                    
                    new_files_data.append(new_file_info)
                    logger.info(f"Successfully migrated file {filename} to Google Drive: {result['file_id']}")
                    
                except Exception as file_error:
                    logger.error(f"Failed to migrate file {url}: {str(file_error)}")
                    # Keep original file info if migration fails
                    new_files_data.append(file_info)
            
            # Update submission with new file data
            submission.file_url = json.dumps(new_files_data)
            
            self.migration_log.append({
                'submission_id': submission.id,
                'assignment_id': submission.assignment_id,
                'student_id': submission.student_id,
                'files_migrated': len([f for f in new_files_data if f.get('storage') == 'google_drive']),
                'total_files': len(new_files_data),
                'status': 'success'
            })
            
            self.success_count += 1
            return True
            
        except Exception as e:
            logger.error(f"Failed to migrate submission {submission.id}: {str(e)}")
            self.migration_log.append({
                'submission_id': submission.id,
                'assignment_id': submission.assignment_id,
                'student_id': submission.student_id,
                'status': 'failed',
                'error': str(e)
            })
            self.failure_count += 1
            return False
    
    def run_migration(self, dry_run: bool = True):
        """
        Run the complete migration process
        
        Args:
            dry_run: If True, don't actually update the database
        """
        logger.info(f"Starting file migration (dry_run={dry_run})...")
        
        # Test Google Drive connection first
        if not google_drive_service.is_configured:
            logger.error("Google Drive service is not configured. Please set GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_DRIVE_ROOT_FOLDER_ID environment variables.")
            return False
            
        if not google_drive_service.test_connection():
            logger.error("Google Drive connection failed. Please check configuration.")
            return False
        
        with app.app_context():
            try:
                # Get all assignment submissions with files
                submissions = AssignmentSubmission.query.filter(
                    AssignmentSubmission.file_url.isnot(None),
                    AssignmentSubmission.file_url != ''
                ).all()
                
                logger.info(f"Found {len(submissions)} assignment submissions with files")
                
                for i, submission in enumerate(submissions, 1):
                    logger.info(f"Processing submission {i}/{len(submissions)}: ID {submission.id}")
                    
                    success = self.migrate_assignment_submission(submission)
                    
                    if success and not dry_run:
                        # Commit changes for this submission
                        db.session.add(submission)
                        db.session.commit()
                        logger.info(f"Database updated for submission {submission.id}")
                    elif success and dry_run:
                        # Rollback changes in dry run
                        db.session.rollback()
                
                # Print summary
                self.print_migration_summary()
                
                if not dry_run:
                    logger.info("Migration completed successfully!")
                else:
                    logger.info("Dry run completed. Use --execute to perform actual migration.")
                
                return True
                
            except Exception as e:
                logger.error(f"Migration failed: {str(e)}")
                db.session.rollback()
                return False
    
    def print_migration_summary(self):
        """Print migration summary"""
        logger.info("\\n" + "="*50)
        logger.info("MIGRATION SUMMARY")
        logger.info("="*50)
        logger.info(f"Successful migrations: {self.success_count}")
        logger.info(f"Failed migrations: {self.failure_count}")
        logger.info(f"Skipped (no files): {self.skip_count}")
        logger.info(f"Total processed: {self.success_count + self.failure_count + self.skip_count}")
        
        if self.failure_count > 0:
            logger.info("\\nFAILED MIGRATIONS:")
            for log_entry in self.migration_log:
                if log_entry['status'] == 'failed':
                    logger.error(f"Submission {log_entry['submission_id']}: {log_entry.get('error', 'Unknown error')}")

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Migrate assignment files to Google Drive')
    parser.add_argument('--execute', action='store_true', 
                       help='Execute the migration (default is dry run)')
    parser.add_argument('--test-connection', action='store_true',
                       help='Test Google Drive connection and exit')
    
    args = parser.parse_args()
    
    if args.test_connection:
        with app.app_context():
            if not google_drive_service.is_configured:
                print("✗ Google Drive service is not configured.")
                print("Please set GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_DRIVE_ROOT_FOLDER_ID environment variables.")
                return 1
            elif google_drive_service.test_connection():
                print("✓ Google Drive connection successful!")
                return 0
            else:
                print("✗ Google Drive connection failed. Please check configuration.")
                return 1
    
    # Run migration
    migration_service = FileMigrationService()
    success = migration_service.run_migration(dry_run=not args.execute)
    
    return 0 if success else 1

if __name__ == '__main__':
    sys.exit(main())