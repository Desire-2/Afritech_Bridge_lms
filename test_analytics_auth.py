# Test script to verify instructor analytics endpoint with proper auth headers
import requests
import json
from datetime import datetime

# Configuration
API_BASE_URL = "https://afritech-bridge-lms-pc6f.onrender.com/api/v1"
FRONTEND_ORIGIN = "https://study.afritechbridge.online"

def test_analytics_endpoint():
    """Test the analytics endpoint with authorization headers"""
    
    print(f"\n{'='*60}")
    print("INSTRUCTOR ANALYTICS ENDPOINT TEST")
    print(f"{'='*60}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print(f"API URL: {API_BASE_URL}")
    print(f"Frontend Origin: {FRONTEND_ORIGIN}")
    
    # Simulate a request with proper headers (would be set by apiClient in frontend)
    headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer <YOUR_JWT_TOKEN_HERE>',  # This is set by localStorage in frontend
        'Origin': FRONTEND_ORIGIN,
        'User-Agent': 'Mozilla/5.0 (Chrome/91.0.0.0)',
    }
    
    print(f"\n{'REQUEST HEADERS:':25}")
    for key, value in headers.items():
        display_value = value if key != 'Authorization' else value[:30] + '...'
        print(f"  {key:20}: {display_value}")
    
    # Test endpoint
    endpoint = f"{API_BASE_URL}/instructor/students/analytics"
    print(f"\n{'ENDPOINT:':25} {endpoint}")
    print(f"{'METHOD:':25} GET")
    
    # Request parameters
    params = {
        'course_id': None  # Or specific course ID
    }
    print(f"{'PARAMETERS:':25} {params}")
    
    try:
        print(f"\n{'Sending request...':25}")
        response = requests.get(
            endpoint,
            headers=headers,
            params=params,
            timeout=30
        )
        
        print(f"\n{'='*60}")
        print(f"RESPONSE STATUS: {response.status_code}")
        print(f"{'='*60}")
        
        # Check CORS headers in response
        cors_headers = {
            k: v for k, v in response.headers.items()
            if 'Access-Control' in k
        }
        
        if cors_headers:
            print(f"\nCORS HEADERS:")
            for key, value in cors_headers.items():
                print(f"  {key}: {value}")
        else:
            print("\n⚠️  NO CORS HEADERS FOUND IN RESPONSE")
        
        # Print response data
        if response.status_code == 200:
            data = response.json()
            print(f"\n{'RESPONSE DATA (Summary)':25}")
            if isinstance(data, dict):
                for key in ['overview', 'struggling_students', 'top_performers', 'error', 'data_limited']:
                    if key in data:
                        if key == 'overview':
                            print(f"  {key}:")
                            for k, v in data[key].items():
                                print(f"    - {k}: {v}")
                        elif key in ['struggling_students', 'top_performers']:
                            print(f"  {key}: {len(data.get(key, []))} items")
                        else:
                            print(f"  {key}: {data[key]}")
        else:
            print(f"\n{'ERROR RESPONSE:':25}")
            print(response.text)
    
    except requests.exceptions.RequestException as e:
        print(f"\n{'NETWORK ERROR:':25} {str(e)}")
    
    print(f"\n{'='*60}")
    print("DIAGNOSTIC CHECKLIST:")
    print(f"{'='*60}")
    print("✓ Environment variable ALLOWED_ORIGINS includes:")
    print("  - https://study.afritechbridge.online")
    print("  - https://afritech-bridge-lms-pc6f.onrender.com")
    print("✓ Frontend sends 'Authorization' header with JWT Token")
    print("✓ Backend @instructor_required decorator validates JWT")
    print("✓ ApiClient interceptor adds Bearer token from localStorage")
    print("\n")

if __name__ == "__main__":
    test_analytics_endpoint()
