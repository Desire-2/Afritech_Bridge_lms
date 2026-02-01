# Google Drive Integration Setup Guide

This guide explains how to set up Google Drive as the file storage backend for the Afritec Bridge LMS assignment submission system.

## Overview

The system has been updated to use Google Drive API for storing assignment files instead of Vercel Blob storage. This provides:

- **Better organization**: Files are automatically organized in folders by assignment and student
- **Reliable access**: Google Drive provides robust file hosting and access
- **No vendor lock-in**: Files remain accessible even if you change hosting providers
- **Better management**: Instructors can access files directly through Google Drive interface

## Prerequisites

1. Google Cloud Console account
2. Google Drive account for file storage
3. Admin/instructor access to the LMS

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note down your Project ID

## Step 2: Enable Google Drive API

1. In the Google Cloud Console, go to **APIs & Services > Library**
2. Search for "Google Drive API"
3. Click on "Google Drive API" and click **Enable**

## Step 3: Create Service Account

1. Go to **IAM & Admin > Service Accounts**
2. Click **Create Service Account**
3. Fill in the details:
   - **Service account name**: `afritec-lms-storage`
   - **Description**: `Service account for LMS file storage`
4. Click **Create and Continue**
5. Skip role assignment (not needed for Drive API)
6. Click **Done**

## Step 4: Generate Service Account Key

1. Click on the created service account
2. Go to the **Keys** tab
3. Click **Add Key > Create new key**
4. Select **JSON** format
5. Download the JSON key file
6. Keep this file secure - it provides access to your Google Drive

## Step 5: Set Up Google Drive Folder

1. Open [Google Drive](https://drive.google.com/)
2. Create a new folder for LMS files (e.g., "Afritec_Bridge_LMS_Files")
3. Get the folder ID from the URL:
   - URL: `https://drive.google.com/drive/folders/1ABCDEfGhIjKlMnOpQrStUvWxYz`
   - Folder ID: `1ABCDEfGhIjKlMnOpQrStUvWxYz`
4. Share the folder with the service account:
   - Right-click the folder > Share
   - Add the service account email (found in the JSON key file)
   - Give it "Editor" permissions

## Step 6: Configure Environment Variables

1. Open your backend `.env` file
2. Add the Google Drive configuration:

```env
# Google Drive Configuration
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"your-project","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n","client_email":"afritec-lms-storage@your-project.iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/afritec-lms-storage%40your-project.iam.gserviceaccount.com"}

GOOGLE_DRIVE_ROOT_FOLDER_ID=1ABCDEfGhIjKlMnOpQrStUvWxYz

# Set storage provider
FILE_STORAGE_PROVIDER=google_drive
```

**Important**: The `GOOGLE_SERVICE_ACCOUNT_JSON` should be the entire JSON content on a single line.

## Step 7: Install Dependencies

```bash
cd backend
pip install google-api-python-client google-auth google-auth-oauthlib google-auth-httplib2
```

Or if using the requirements file:
```bash
cd backend
pip install -r requirements.txt
```

## Step 8: Test the Connection

1. Start the backend server:
```bash
cd backend
python main.py
```

2. Test the Google Drive connection:
```bash
cd backend
python migrate_to_google_drive.py --test-connection
```

You should see: `✓ Google Drive connection successful!`

## Step 9: Migrate Existing Files (Optional)

If you have existing files in Vercel Blob or local storage:

1. **Dry run** (recommended first):
```bash
cd backend
python migrate_to_google_drive.py
```

2. **Execute migration**:
```bash
cd backend
python migrate_to_google_drive.py --execute
```

## Step 10: Update Frontend Environment

Add to your frontend `.env.local`:
```env
FILE_STORAGE_PROVIDER=google_drive
```

## Folder Structure

Files will be organized in Google Drive as follows:
```
Afritec_Bridge_LMS_Files/
├── Assignment_1/
│   ├── Student_123/
│   │   ├── 20240130_143022_assignment.pdf
│   │   └── 20240130_143055_code.zip
│   └── Student_456/
│       └── 20240130_144012_report.docx
├── Assignment_2/
│   └── Student_123/
│       └── 20240130_145033_presentation.pptx
└── ...
```

## Security Considerations

1. **Service Account Key**: Keep the JSON key file secure. Never commit it to version control.
2. **Folder Permissions**: Only share the root folder with the service account.
3. **Access Control**: The LMS handles user access control - students can only access their own files.
4. **File Permissions**: All uploaded files are set to "anyone with link can view" for LMS access.

## Troubleshooting

### Connection Issues

1. **"Service account not found"**:
   - Verify the JSON key is properly formatted
   - Check that the service account exists in Google Cloud Console

2. **"Permission denied"**:
   - Ensure the root folder is shared with the service account email
   - Verify the service account has "Editor" permissions

3. **"Folder not found"**:
   - Check the `GOOGLE_DRIVE_ROOT_FOLDER_ID` is correct
   - Verify the folder exists and is accessible

### Testing Endpoints

Once configured, you can test these endpoints (requires admin/instructor login):

- **Test connection**: `GET /api/v1/uploads/google-drive/test`
- **Upload file**: `POST /api/v1/uploads/file`
- **Get file info**: `GET /api/v1/uploads/google-drive/files/{file_id}`
- **Delete file**: `DELETE /api/v1/uploads/google-drive/files/{file_id}`

## Monitoring

Monitor your Google Cloud project for:
- API usage quotas
- Service account activity
- Drive storage usage

The Google Drive API has generous free quotas that should be sufficient for most LMS usage.

## Backup and Recovery

- All files are stored in your Google Drive account
- You can access files directly through the Google Drive web interface
- Consider setting up automated backups of your Google Drive folder
- The database stores Google Drive file IDs and metadata for quick access

## Support

For issues with this integration:
1. Check the backend logs for error messages
2. Verify Google Cloud Console configuration
3. Test the connection using the migration script
4. Ensure environment variables are properly set

The migration preserves all existing functionality while providing a more robust and organized file storage solution.