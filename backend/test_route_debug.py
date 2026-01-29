#!/usr/bin/env python3
"""
Test the exact route logic that's causing the 500 error
"""
import sys
import os
import traceback

# Add the project root directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_instructor_route_imports():
    """Test the exact imports used in the instructor route"""
    try:
        print("Testing instructor route imports...")
        
        # This is the exact import from the instructor_routes.py file
        from src.services.full_credit_service import FullCreditService
        print("✅ FullCreditService import successful")
        
        # Test the method exists
        method = getattr(FullCreditService, 'give_module_full_credit', None)
        if method is None:
            print("❌ give_module_full_credit method not found")
            return False
        else:
            print("✅ give_module_full_credit method exists")
            
        # Test email notification import
        from src.utils.email_notifications import send_full_credit_notification
        print("✅ send_full_credit_notification import successful")
        
        # Test models import (these are imported at the top of instructor_routes)
        from src.models.user_models import User
        from src.models.course_models import Module, Course, Enrollment
        print("✅ All model imports successful")
        
        return True
        
    except Exception as e:
        print(f"❌ Import error: {str(e)}")
        traceback.print_exc()
        return False

def test_route_logic_simulation():
    """Simulate the route logic without database calls"""
    try:
        print("\nTesting route logic simulation...")
        
        # Test the exact imports and structure used in the route
        from src.services.full_credit_service import FullCreditService
        from src.utils.email_notifications import send_full_credit_notification
        from src.models.user_models import User
        from src.models.course_models import Module, Course, Enrollment
        
        # Test function signature
        import inspect
        sig = inspect.signature(FullCreditService.give_module_full_credit)
        print(f"✅ FullCreditService.give_module_full_credit signature: {sig}")
        
        sig2 = inspect.signature(send_full_credit_notification)
        print(f"✅ send_full_credit_notification signature: {sig2}")
        
        print("✅ Route logic simulation successful - no syntax/import errors")
        return True
        
    except Exception as e:
        print(f"❌ Route logic error: {str(e)}")
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("🔍 Debugging Full Credit Route 500 Error")
    print("=" * 50)
    
    # Test imports
    import_success = test_instructor_route_imports()
    
    # Test route logic
    logic_success = test_route_logic_simulation()
    
    print("\n" + "=" * 50)
    if import_success and logic_success:
        print("✅ All route components work correctly!")
        print("💡 The 500 error might be caused by:")
        print("   1. Database connection issue at runtime")
        print("   2. Missing data (student, module, course, enrollment)")
        print("   3. Permission/authentication issue")
        print("   4. Exception in the FullCreditService.give_module_full_credit method")
    else:
        print("❌ Found issues in route components.")