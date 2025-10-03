#!/usr/bin/env python3
"""
CORS Configuration Test Script
Test CORS settings for the Afritec Bridge LMS backend
"""

import requests
import sys

def test_cors(base_url, origin):
    """Test CORS configuration by making a preflight request"""
    
    print(f"🔍 Testing CORS for {base_url} from origin {origin}")
    print("-" * 60)
    
    # Test preflight request (OPTIONS)
    headers = {
        'Origin': origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type,Authorization'
    }
    
    try:
        # Test OPTIONS request (preflight)
        response = requests.options(f"{base_url}/api/v1/auth/login", headers=headers, timeout=10)
        
        print(f"Preflight Response Status: {response.status_code}")
        print("Response Headers:")
        
        cors_headers = {}
        for header, value in response.headers.items():
            if 'access-control' in header.lower():
                cors_headers[header] = value
                print(f"  {header}: {value}")
        
        if not cors_headers:
            print("  ❌ No CORS headers found!")
            return False
            
        # Check specific CORS headers
        print("\nCORS Analysis:")
        
        allow_origin = cors_headers.get('Access-Control-Allow-Origin', '')
        if allow_origin == origin or allow_origin == '*':
            print(f"  ✅ Origin allowed: {allow_origin}")
        else:
            print(f"  ❌ Origin not allowed. Expected: {origin}, Got: {allow_origin}")
            return False
            
        allow_methods = cors_headers.get('Access-Control-Allow-Methods', '')
        if 'POST' in allow_methods:
            print(f"  ✅ POST method allowed: {allow_methods}")
        else:
            print(f"  ❌ POST method not allowed: {allow_methods}")
            
        allow_headers = cors_headers.get('Access-Control-Allow-Headers', '')
        if 'content-type' in allow_headers.lower() and 'authorization' in allow_headers.lower():
            print(f"  ✅ Required headers allowed: {allow_headers}")
        else:
            print(f"  ⚠️  Some headers may not be allowed: {allow_headers}")
            
        credentials = cors_headers.get('Access-Control-Allow-Credentials', '')
        if credentials.lower() == 'true':
            print(f"  ✅ Credentials allowed: {credentials}")
        else:
            print(f"  ⚠️  Credentials may not be allowed: {credentials}")
            
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return False

def main():
    """Main function to test CORS configuration"""
    
    if len(sys.argv) < 2:
        print("Usage: python test_cors.py <backend_url> [origin]")
        print("Example: python test_cors.py https://afritech-bridge-lms.onrender.com https://study.afritechbridge.online")
        sys.exit(1)
    
    backend_url = sys.argv[1].rstrip('/')
    origin = sys.argv[2] if len(sys.argv) > 2 else 'https://study.afritechbridge.online'
    
    success = test_cors(backend_url, origin)
    
    print("\n" + "="*60)
    if success:
        print("🎉 CORS configuration appears to be working!")
        print("💡 If you're still getting CORS errors, check:")
        print("   - Ensure the backend is running")
        print("   - Verify the ALLOWED_ORIGINS environment variable on Render")
        print("   - Check browser console for more details")
    else:
        print("❌ CORS configuration needs to be fixed")
        print("💡 Next steps:")
        print("   1. Set ALLOWED_ORIGINS environment variable on Render")
        print("   2. Include your frontend domain in the variable")
        print("   3. Restart the backend service")
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()