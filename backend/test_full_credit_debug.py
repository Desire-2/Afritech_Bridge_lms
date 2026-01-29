#!/usr/bin/env python3
"""
Test the full credit endpoint directly to identify the 500 error
"""
import sys
import os
sys.path.insert(0, 'src')

# Set up Flask application context
from flask import Flask
from src.models.user_models import db

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///instance/afritec_lms_db.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'test_secret_key'
app.config['JWT_SECRET_KEY'] = 'test_jwt_secret'

# Initialize database
db.init_app(app)

def test_full_credit_imports():
    """Test all imports needed for full credit functionality"""
    with app.app_context():
        try:
            print("Testing imports...")
            
            # Test models
            from src.models.user_models import User, Role
            from src.models.course_models import Module, Course, Enrollment
            print("✅ Models imported successfully")
            
            # Test FullCreditService
            from src.services.full_credit_service import FullCreditService
            print("✅ FullCreditService imported successfully")
            
            # Test email notification
            from src.utils.email_notifications import send_full_credit_notification
            print("✅ Email notification function imported successfully")
            
            # Test email template
            from src.utils.email_templates import full_credit_awarded_email
            print("✅ Email template imported successfully")
            
            return True
            
        except Exception as e:
            print(f"❌ Import error: {str(e)}")
            import traceback
            traceback.print_exc()
            return False

def test_full_credit_service():
    """Test the FullCreditService method call"""
    with app.app_context():
        try:
            from src.services.full_credit_service import FullCreditService
            
            # Test if the service method exists and can be called with dummy data
            method = getattr(FullCreditService, 'give_module_full_credit', None)
            if method is None:
                print("❌ give_module_full_credit method not found")
                return False
            
            print("✅ FullCreditService.give_module_full_credit method found")
            
            # Check method signature
            import inspect
            sig = inspect.signature(method)
            print(f"✅ Method signature: {sig}")
            
            return True
            
        except Exception as e:
            print(f"❌ FullCreditService error: {str(e)}")
            import traceback
            traceback.print_exc()
            return False

def test_database_connection():
    """Test database connection"""
    with app.app_context():
        try:
            from src.models.user_models import User
            from src.models.course_models import Module
            
            # Try a simple query
            user_count = User.query.count()
            module_count = Module.query.count()
            
            print(f"✅ Database connected - Users: {user_count}, Modules: {module_count}")
            return True
            
        except Exception as e:
            print(f"❌ Database error: {str(e)}")
            import traceback
            traceback.print_exc()
            return False

if __name__ == "__main__":
    print("🧪 Testing Full Credit Functionality - Runtime Issues")
    print("=" * 60)
    
    # Test imports
    print("\n1. Testing Imports:")
    import_success = test_full_credit_imports()
    
    # Test service
    print("\n2. Testing FullCreditService:")
    service_success = test_full_credit_service()
    
    # Test database
    print("\n3. Testing Database:")
    db_success = test_database_connection()
    
    print("\n" + "=" * 60)
    if all([import_success, service_success, db_success]):
        print("✅ All tests passed! The issue might be in the route logic or JWT authentication.")
    else:
        print("❌ Found issues that need to be resolved.")
        sys.exit(1)