# Afritec Bridge LMS Backend

This repository contains the backend API for the Afritec Bridge Learning Management System.

## Features

- User authentication and management
- Course management
- Student enrollments
- Quizzes and assignments
- Learning opportunities

## Technologies

- Python 3.9+
- Flask
- SQLAlchemy
- Flask-JWT-Extended for authentication
- PostgreSQL (production)
- SQLite (development)
- Gunicorn for WSGI server

## Local Development Setup

### Quick Setup (Recommended)

We've created helper scripts to simplify the setup process:

1. Clone the repository:
```bash
git clone https://github.com/Desire-2/Afritech_Bridge.git
cd Afritech_Bridge/afritec_bridge_lms/backend
```

2. Run the setup script:
```bash
./setup.sh
```
This script will:
- Install required system packages (if needed)
- Create a virtual environment
- Install all dependencies
- Create a .env file from the example
- Set up the static files directory

3. Run the application:
```bash
./run.sh
```

### Manual Setup

If you prefer to set up manually:

1. Clone the repository:
```bash
git clone https://github.com/Desire-2/Afritech_Bridge.git
cd Afritech_Bridge
```

2. Set up a virtual environment:
```bash
cd afritec_bridge_lms/backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

4. Set up environment variables:
```bash
cp .env.example .env
# Edit the .env file with your configuration
```

5. Create the static directory:
```bash
mkdir -p static
```

6. Run the development server:
```bash
python main.py
```

## Deployment to Render

### Prerequisites

1. A [Render](https://render.com) account
2. A PostgreSQL database (can be created through Render)

### Setting Up the Database

1. In your Render dashboard, create a new PostgreSQL database
2. Note the external connection string provided by Render

### Deploying the Web Service

1. In your Render dashboard, create a new "Web Service"
2. Connect your GitHub repository
3. Configure the web service:
   - **Name**: afritec-bridge-lms-backend
   - **Environment**: Python 3
   - **Build Command**: `cd afritec_bridge_lms/backend && ./build.sh`
   - **Start Command**: `cd afritec_bridge_lms/backend && if [ -d "venv" ] && [ -f "venv/bin/gunicorn" ]; then ./venv/bin/gunicorn -c gunicorn_config.py main:app; else gunicorn -c gunicorn_config.py main:app; fi`
   - **Root Directory**: Leave as default (root of your repository)

4. Add the following environment variables:
   - `FLASK_ENV`: production
   - `SECRET_KEY`: [Generate a secure random key]
   - `JWT_SECRET_KEY`: [Generate a secure random key]
   - `DATABASE_URL`: [Your PostgreSQL connection string from Render]
   - `ALLOWED_ORIGINS`: https://your-frontend-domain.com (comma-separated list for multiple domains)
   - `PORT`: 10000 (default for Render)
   - `RENDER`: true (This helps the build script identify it's running on Render)

5. Click "Create Web Service"

### Post-Deployment

1. Verify that your service is running by visiting the Render URL
2. Check the logs for any errors
3. Test API endpoints using a tool like Postman

## Environment Variables

The following environment variables can be configured in your `.env` file:

### Core Application Settings
- `FLASK_ENV`: Set to 'development' or 'production'
- `SECRET_KEY`: Secret key for Flask (generate with: `python -c "import secrets; print(secrets.token_hex(32))"`)
- `PORT`: Port to run the application on (set by Render in production)

### Database Configuration
- `DATABASE_URL`: PostgreSQL connection string (required for production)
- `SQLALCHEMY_DATABASE_URI`: Database URI (defaults to SQLite in development)

### JWT Authentication
- `JWT_SECRET_KEY`: Secret key for JWT token generation (generate with: `python -c "import secrets; print(secrets.token_hex(32))"`)
- `JWT_ACCESS_TOKEN_EXPIRES_HOURS`: Access token expiry in hours (default: 1)
- `JWT_REFRESH_TOKEN_EXPIRES_DAYS`: Refresh token expiry in days (default: 30)

### Email Configuration (SMTP)
- `MAIL_SERVER`: SMTP server (default: smtp.gmail.com)
- `MAIL_PORT`: SMTP port (default: 587)
- `MAIL_USE_TLS`: Use TLS encryption (default: True)
- `MAIL_USE_SSL`: Use SSL encryption (default: False)
- `MAIL_USERNAME`: SMTP username (your email)
- `MAIL_PASSWORD`: SMTP password (use App Password for Gmail)
- `MAIL_DEFAULT_SENDER`: Default sender email (default: noreply@afritecbridge.online)

### CORS Configuration
- `ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins

### Setting Up Your .env File

1. Copy the example file:
```bash
cp .env.example .env
```

2. Edit the `.env` file with your specific configuration:
```bash
nano .env  # or use your preferred editor
```

3. Generate secure keys:
```bash
# For SECRET_KEY
python -c "import secrets; print(secrets.token_hex(32))"

# For JWT_SECRET_KEY  
python -c "import secrets; print(secrets.token_hex(32))"
```

4. Configure email settings (for Gmail):
   - Enable 2-factor authentication on your Google account
   - Generate an App Password: https://myaccount.google.com/apppasswords
   - Use the App Password as your `MAIL_PASSWORD`

## Troubleshooting

### CORS Errors

If you're getting CORS errors like "No 'Access-Control-Allow-Origin' header":

1. **Set ALLOWED_ORIGINS environment variable:**
   ```bash
   # For production on Render
   ALLOWED_ORIGINS=https://study.afritechbridge.online
   
   # For multiple domains
   ALLOWED_ORIGINS=https://study.afritechbridge.online,https://app.afritechbridge.online
   ```

2. **Ensure FLASK_ENV is set to production:**
   ```bash
   FLASK_ENV=production
   ```

3. **Test CORS configuration:**
   ```bash
   python test_cors.py https://your-backend-url.com https://your-frontend-domain.com
   ```

4. **Check Render environment variables:**
   - Go to Render Dashboard → Your Service → Environment
   - Verify ALLOWED_ORIGINS and FLASK_ENV are set correctly
   - Restart the service after changes

For detailed CORS troubleshooting, see [CORS_FIX_GUIDE.md](CORS_FIX_GUIDE.md)

### Database Connection Issues

If you're experiencing database connection issues:

1. Verify that your DATABASE_URL environment variable is correctly set
2. Make sure your IP address is allowed in the database firewall settings
3. Check the logs for specific error messages

### Application Not Starting

If the application fails to start:

1. Check the Render logs for error messages
2. Verify that all required environment variables are set
3. Make sure the build.sh script is executable
4. Check that your requirements.txt is up to date

### API Errors

If you're getting unexpected API behavior:

1. Check if you're using the correct API endpoints
2. Verify authentication tokens are valid and not expired
3. Check request and response formats

### Virtual Environment Issues

If you encounter the "externally-managed-environment" error:

1. Make sure you're using a virtual environment:
   ```bash
   # Create virtual environment
   python3 -m venv venv
   
   # Activate it
   source venv/bin/activate
   ```

2. If you still have issues, ensure you have python3-venv installed:
   ```bash
   sudo apt update
   sudo apt install python3-venv python3-full
   ```

3. Use the provided helper scripts:
   ```bash
   # For initial setup
   ./setup.sh
   
   # For running the application
   ./run.sh
   ```

## Support

For support, contact the Afritec Bridge technical team.