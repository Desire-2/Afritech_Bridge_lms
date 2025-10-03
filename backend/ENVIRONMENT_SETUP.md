# Environment Configuration Guide

## Overview
This guide explains how to properly configure environment variables for the Afritec Bridge LMS backend using `.env` files.

## Quick Start

1. **Copy the example file:**
   ```bash
   cp .env.example .env
   ```

2. **Generate secure keys:**
   ```bash
   # Generate SECRET_KEY
   python -c "import secrets; print('SECRET_KEY=' + secrets.token_hex(32))"
   
   # Generate JWT_SECRET_KEY
   python -c "import secrets; print('JWT_SECRET_KEY=' + secrets.token_hex(32))"
   ```

3. **Edit your .env file with the generated keys and your specific configuration**

## Environment-Specific Configurations

### Development Environment (.env)
```bash
FLASK_ENV=development
SECRET_KEY=your_generated_secret_key_here
JWT_SECRET_KEY=your_generated_jwt_secret_key_here
PORT=5000

# Database (SQLite for development)
# DATABASE_URL will be auto-generated if not set

# Email (optional for development)
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USERNAME=your-dev-email@gmail.com
MAIL_PASSWORD=your-app-password

# CORS for local development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:5173
```

### Production Environment (Render/Heroku)
```bash
FLASK_ENV=production
SECRET_KEY=your_production_secret_key_here
JWT_SECRET_KEY=your_production_jwt_secret_key_here

# Database (PostgreSQL)
DATABASE_URL=postgresql://username:password@host:port/database

# Email configuration
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USERNAME=your-production-email@gmail.com
MAIL_PASSWORD=your-production-app-password
MAIL_DEFAULT_SENDER=noreply@yourdomain.com

# CORS for production
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# JWT settings
JWT_ACCESS_TOKEN_EXPIRES_HOURS=1
JWT_REFRESH_TOKEN_EXPIRES_DAYS=30
```

## Email Configuration

### Gmail Setup
1. **Enable 2-Factor Authentication:**
   - Go to your Google Account settings
   - Security → 2-Step Verification → Turn on

2. **Generate App Password:**
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (custom name)"
   - Enter "Afritec Bridge LMS"
   - Copy the generated 16-character password

3. **Configure .env:**
   ```bash
   MAIL_USERNAME=your-email@gmail.com
   MAIL_PASSWORD=your-16-character-app-password
   ```

### Other Email Providers
For other SMTP providers, adjust these settings:

**Outlook/Hotmail:**
```bash
MAIL_SERVER=smtp-mail.outlook.com
MAIL_PORT=587
MAIL_USE_TLS=True
```

**Yahoo:**
```bash
MAIL_SERVER=smtp.mail.yahoo.com
MAIL_PORT=587
MAIL_USE_TLS=True
```

## Security Best Practices

1. **Never commit .env files to version control**
   - Always use .env.example for templates
   - Add .env to .gitignore

2. **Use strong, unique keys for each environment**
   - Generate new keys for production
   - Use different keys for development and production

3. **Rotate keys regularly**
   - Change production keys periodically
   - Update all deployment environments

4. **Validate environment variables**
   - The application will warn about missing required variables
   - Check logs for configuration errors

## Troubleshooting

### Common Issues

1. **"SECRET_KEY not set" error:**
   - Ensure SECRET_KEY is defined in .env
   - Check that .env file is in the same directory as main.py

2. **Email not sending:**
   - Verify MAIL_USERNAME and MAIL_PASSWORD
   - Check if App Password is correctly generated
   - Ensure MAIL_USE_TLS=True for most providers

3. **Database connection errors:**
   - Check DATABASE_URL format
   - Ensure PostgreSQL is running (production)
   - Verify database credentials

4. **CORS errors:**
   - Add your frontend URL to ALLOWED_ORIGINS
   - Use comma separation for multiple origins
   - Include protocol (http/https)

### Environment Variable Loading Order

The application loads environment variables in this order:
1. System environment variables
2. .env file in the backend directory
3. Default values in the code

Higher priority sources override lower ones.

## Testing Your Configuration

Run this script to validate your environment setup:

```bash
cd backend
source venv/bin/activate  # or venv-new/bin/activate
python -c "
from dotenv import load_dotenv
import os
load_dotenv()

required_vars = ['SECRET_KEY', 'JWT_SECRET_KEY']
optional_vars = ['DATABASE_URL', 'MAIL_USERNAME', 'ALLOWED_ORIGINS']

print('=== Required Variables ===')
for var in required_vars:
    value = os.getenv(var)
    status = '✓' if value else '✗'
    print(f'{status} {var}: {\"Set\" if value else \"Missing\"}')

print('\\n=== Optional Variables ===')
for var in optional_vars:
    value = os.getenv(var)
    status = '✓' if value else '-'
    print(f'{status} {var}: {\"Set\" if value else \"Not set\"}')
"
```