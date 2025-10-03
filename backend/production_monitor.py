#!/usr/bin/env python3
"""
Production Monitoring and Debugging Script for Afritec Bridge LMS
Use this to monitor the health and performance of your production deployment
"""

import requests
import time
import json
import sys
from datetime import datetime

class ProductionMonitor:
    def __init__(self, base_url):
        self.base_url = base_url.rstrip('/')
        self.api_base = f"{self.base_url}/api/v1"
        
    def check_health(self):
        """Check basic health of the application"""
        print(f"🏥 Health Check for {self.base_url}")
        print("-" * 50)
        
        try:
            # Check basic connectivity
            response = requests.get(self.base_url, timeout=10)
            print(f"✅ Base URL: {response.status_code}")
            
            # Check API endpoint
            response = requests.options(f"{self.api_base}/auth/login", timeout=10)
            print(f"✅ API CORS: {response.status_code}")
            
            return True
        except Exception as e:
            print(f"❌ Health check failed: {e}")
            return False
    
    def test_registration(self):
        """Test user registration with unique credentials"""
        print(f"\n👤 Testing User Registration")
        print("-" * 50)
        
        timestamp = int(time.time())
        test_data = {
            'username': f'monitor_test_{timestamp}',
            'email': f'monitor_test_{timestamp}@example.com',
            'password': 'MonitorTest123!',
            'firstName': 'Monitor',
            'lastName': 'Test'
        }
        
        try:
            response = requests.post(
                f"{self.api_base}/auth/register",
                json=test_data,
                headers={'Content-Type': 'application/json'},
                timeout=30
            )
            
            if response.status_code == 201:
                print(f"✅ Registration: SUCCESS")
                return test_data
            else:
                print(f"❌ Registration: {response.status_code} - {response.text[:100]}")
                return None
                
        except Exception as e:
            print(f"❌ Registration failed: {e}")
            return None
    
    def test_login(self, credentials):
        """Test user login"""
        print(f"\n🔐 Testing User Login")
        print("-" * 50)
        
        if not credentials:
            print("⚠️ No credentials to test")
            return None
            
        login_data = {
            'identifier': credentials['email'],
            'password': credentials['password']
        }
        
        try:
            response = requests.post(
                f"{self.api_base}/auth/login",
                json=login_data,
                headers={'Content-Type': 'application/json'},
                timeout=30
            )
            
            if response.status_code == 200:
                print(f"✅ Login: SUCCESS")
                data = response.json()
                return data.get('access_token')
            else:
                print(f"❌ Login: {response.status_code} - {response.text[:100]}")
                return None
                
        except Exception as e:
            print(f"❌ Login failed: {e}")
            return None
    
    def test_performance(self):
        """Test response times"""
        print(f"\n⚡ Performance Testing")
        print("-" * 50)
        
        endpoints = [
            ('GET', '/'),
            ('OPTIONS', '/api/v1/auth/login'),
            ('OPTIONS', '/api/v1/auth/register'),
        ]
        
        for method, endpoint in endpoints:
            try:
                start_time = time.time()
                if method == 'GET':
                    response = requests.get(f"{self.base_url}{endpoint}", timeout=30)
                else:
                    response = requests.options(f"{self.base_url}{endpoint}", timeout=30)
                end_time = time.time()
                
                duration = (end_time - start_time) * 1000
                print(f"✅ {method} {endpoint}: {response.status_code} ({duration:.0f}ms)")
                
            except Exception as e:
                print(f"❌ {method} {endpoint}: {e}")
    
    def monitor_forgot_password(self):
        """Test the problematic forgot password endpoint"""
        print(f"\n📧 Testing Forgot Password")
        print("-" * 50)
        
        test_email = "nonexistent@example.com"
        
        try:
            start_time = time.time()
            response = requests.post(
                f"{self.api_base}/auth/forgot-password",
                json={'email': test_email},
                headers={'Content-Type': 'application/json'},
                timeout=45  # Longer timeout for email operations
            )
            end_time = time.time()
            
            duration = (end_time - start_time) * 1000
            print(f"✅ Forgot Password: {response.status_code} ({duration:.0f}ms)")
            print(f"Response: {response.text[:100]}")
            
        except Exception as e:
            print(f"❌ Forgot Password: {e}")
    
    def run_full_monitor(self):
        """Run complete monitoring suite"""
        print(f"🚀 Afritec Bridge LMS Production Monitor")
        print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 60)
        
        # Basic health check
        if not self.check_health():
            print("❌ Basic health check failed, stopping monitor")
            return False
        
        # Test registration and login flow
        credentials = self.test_registration()
        token = self.test_login(credentials)
        
        # Performance testing
        self.test_performance()
        
        # Test problematic endpoints
        self.monitor_forgot_password()
        
        print("\n" + "=" * 60)
        print("📊 Monitor Complete")
        
        return True

def main():
    if len(sys.argv) != 2:
        print("Usage: python production_monitor.py <base_url>")
        print("Example: python production_monitor.py https://afritech-bridge-lms.onrender.com")
        sys.exit(1)
    
    base_url = sys.argv[1]
    monitor = ProductionMonitor(base_url)
    
    success = monitor.run_full_monitor()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()