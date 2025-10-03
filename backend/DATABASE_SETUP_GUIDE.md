# Render Database Setup Guide

## Problem
```
ValueError: DATABASE_URL must be set in production environment
```

The backend deployment is failing because PostgreSQL database is not configured on Render.

## Solution: Set Up PostgreSQL on Render

### Step 1: Create PostgreSQL Database

1. **Go to Render Dashboard**
   - Navigate to https://dashboard.render.com
   - Click "New +" button
   - Select "PostgreSQL"

2. **Configure Database**
   - **Name**: `afritec-bridge-lms-db`
   - **Database**: `afritec_lms`
   - **User**: `afritec_admin` (or leave default)
   - **Region**: Same as your web service (for better performance)
   - **PostgreSQL Version**: Latest stable (15 or 16)
   - **Plan**: Free tier is fine for development

3. **Create Database**
   - Click "Create Database"
   - Wait for database to be provisioned (2-3 minutes)

### Step 2: Get Database Connection String

1. **Access Database Info**
   - Go to your PostgreSQL database in Render dashboard
   - Click on "Info" tab

2. **Copy Connection Strings**
   You'll see several connection strings:
   - **External Database URL**: Use this for DATABASE_URL
   - **Internal Database URL**: For services within Render
   
   Example:
   ```
   External: postgresql://username:password@dpg-xxxxx-a.oregon-postgres.render.com/database_name
   Internal: postgresql://username:password@dpg-xxxxx-a/database_name
   ```

### Step 3: Configure Environment Variables

1. **Go to Web Service**
   - Navigate to your backend web service in Render
   - Go to "Environment" tab

2. **Add DATABASE_URL**
   - Click "Add Environment Variable"
   - **Key**: `DATABASE_URL`
   - **Value**: The External Database URL from Step 2
   - Click "Save Changes"

3. **Verify Other Environment Variables**
   Ensure these are set:
   ```
   FLASK_ENV=production
   SECRET_KEY=your_generated_secret_key
   JWT_SECRET_KEY=your_generated_jwt_secret_key
   DATABASE_URL=postgresql://username:password@host/database
   ALLOWED_ORIGINS=https://study.afritechbridge.online
   ```

### Step 4: Deploy and Initialize

1. **Deploy Service**
   - The service will automatically redeploy after adding DATABASE_URL
   - Check logs to ensure it starts successfully

2. **Initialize Database**
   After successful deployment, run:
   ```bash
   python init_production_db.py https://your-app.onrender.com
   ```

   Or make a POST request to:
   ```
   POST https://your-app.onrender.com/init-db
   ```

## Quick Fix Commands

### Using Render CLI (if installed):
```bash
# Create database
render services create postgresql --name afritec-bridge-lms-db

# Get database URL
render env get DATABASE_URL --service-type database --service-name afritec-bridge-lms-db

# Set environment variable on web service
render env set DATABASE_URL="postgresql://..." --service-id=your-web-service-id
```

### Manual Steps Summary:
1. ✅ Create PostgreSQL database on Render
2. ✅ Copy External Database URL
3. ✅ Add DATABASE_URL environment variable to web service
4. ✅ Wait for automatic redeploy
5. ✅ Initialize database via `/init-db` endpoint

## Alternative: Temporary SQLite Deployment

If you need to deploy immediately without PostgreSQL setup, the backend now supports SQLite fallback in production with warnings. This is NOT recommended for production use but allows initial deployment.

The logs will show:
```
WARNING - DATABASE_URL not set in production. Using SQLite fallback.
WARNING - For production use, please set up PostgreSQL and configure DATABASE_URL
```

## Database Migration (SQLite to PostgreSQL)

If you start with SQLite and later move to PostgreSQL:

1. Export data from SQLite (if needed)
2. Set up PostgreSQL as above
3. Run database initialization
4. Manually migrate data if required

## Troubleshooting

### Connection Issues
- Verify DATABASE_URL format: `postgresql://user:pass@host:port/db`
- Check database status in Render dashboard
- Ensure database and web service are in same region

### Database Not Found
- Confirm database name matches in connection string
- Check PostgreSQL version compatibility

### Permission Errors
- Verify user has proper permissions
- Check database user credentials

## Cost Considerations

- **Free PostgreSQL**: 1GB storage, shared CPU
- **Paid Plans**: Start at $7/month for dedicated resources
- **Scaling**: Can upgrade as your application grows

For production applications, consider using a paid PostgreSQL plan for better performance and reliability.