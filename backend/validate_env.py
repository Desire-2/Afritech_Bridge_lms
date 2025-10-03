#!/usr/bin/env python3
"""
Environment Configuration Validator for Afritec Bridge LMS
Run this script to validate your .env file configuration
"""

import os
import sys
from dotenv import load_dotenv

def validate_environment():
    """Validate environment configuration"""
    print("🔍 Validating Afritec Bridge LMS Environment Configuration\n")
    
    # Load .env file
    env_file = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(env_file):
        load_dotenv(env_file)
        print(f"✅ Found .env file at: {env_file}")
    else:
        print(f"⚠️  No .env file found at: {env_file}")
        print("💡 Copy .env.example to .env and configure it")
    
    print("\n" + "="*50)
    
    # Required variables
    required_vars = {
        'SECRET_KEY': 'Flask secret key for session security',
        'JWT_SECRET_KEY': 'JWT token signing key'
    }
    
    print("📋 REQUIRED VARIABLES:")
    all_required_set = True
    for var, description in required_vars.items():
        value = os.getenv(var)
        if value:
            # Show first 8 characters for security
            display_value = value[:8] + "..." if len(value) > 8 else value
            print(f"  ✅ {var}: {display_value}")
        else:
            print(f"  ❌ {var}: Not set ({description})")
            all_required_set = False
    
    # Optional but recommended variables
    optional_vars = {
        'FLASK_ENV': 'Application environment (development/production)',
        'DATABASE_URL': 'Database connection URL',
        'MAIL_USERNAME': 'Email username for notifications',
        'MAIL_PASSWORD': 'Email password (use App Password for Gmail)',
        'ALLOWED_ORIGINS': 'CORS allowed origins',
        'PORT': 'Application port'
    }
    
    print("\n📋 OPTIONAL VARIABLES:")
    for var, description in optional_vars.items():
        value = os.getenv(var)
        if value:
            # Special handling for sensitive data
            if 'PASSWORD' in var or 'SECRET' in var:
                display_value = "***" + value[-4:] if len(value) > 4 else "***"
            elif 'DATABASE_URL' in var:
                # Show only the protocol and host
                if value.startswith('postgresql://'):
                    display_value = "postgresql://***@***/**"
                elif value.startswith('sqlite:'):
                    display_value = value
                else:
                    display_value = value[:20] + "..."
            else:
                display_value = value[:50] + "..." if len(value) > 50 else value
            print(f"  ✅ {var}: {display_value}")
        else:
            print(f"  ➖ {var}: Not set ({description})")
    
    print("\n" + "="*50)
    
    # Configuration recommendations
    print("💡 RECOMMENDATIONS:")
    
    flask_env = os.getenv('FLASK_ENV', 'development')
    if flask_env == 'development':
        print("  🔧 Development mode detected")
        if not os.getenv('DATABASE_URL'):
            print("     - SQLite database will be used automatically")
        if not os.getenv('MAIL_USERNAME'):
            print("     - Email features will be disabled")
    elif flask_env == 'production':
        print("  🚀 Production mode detected")
        if not os.getenv('DATABASE_URL'):
            print("     ⚠️  Consider setting DATABASE_URL for production")
        if not os.getenv('ALLOWED_ORIGINS'):
            print("     ⚠️  Set ALLOWED_ORIGINS for CORS security")
    
    # Security checks
    print("\n🔒 SECURITY CHECKS:")
    secret_key = os.getenv('SECRET_KEY')
    jwt_key = os.getenv('JWT_SECRET_KEY')
    
    if secret_key:
        if len(secret_key) < 32:
            print("  ⚠️  SECRET_KEY should be at least 32 characters long")
        elif secret_key in ['your_secure_secret_key_here', 'change-me']:
            print("  ❌ SECRET_KEY is using default value - CHANGE IT!")
        else:
            print("  ✅ SECRET_KEY length looks good")
    
    if jwt_key:
        if len(jwt_key) < 32:
            print("  ⚠️  JWT_SECRET_KEY should be at least 32 characters long")
        elif jwt_key in ['your_secure_jwt_secret_key_here', 'change-me']:
            print("  ❌ JWT_SECRET_KEY is using default value - CHANGE IT!")
        else:
            print("  ✅ JWT_SECRET_KEY length looks good")
    
    # Final status
    print("\n" + "="*50)
    if all_required_set:
        print("🎉 Configuration validation PASSED!")
        print("   Your environment is ready to run the application.")
    else:
        print("❌ Configuration validation FAILED!")
        print("   Please set the missing required variables.")
        return False
    
    print("\n🚀 To start the application:")
    print("   ./run.sh  or  python main.py")
    
    return True

if __name__ == "__main__":
    success = validate_environment()
    sys.exit(0 if success else 1)