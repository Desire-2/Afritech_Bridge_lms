#!/usr/bin/env python3
"""
Script to initialize database for production deployment on Render
This script sends a POST request to the /init-db endpoint to initialize the database
"""
import requests
import sys
import os
import time

def init_production_database(base_url):
    """Initialize the database by calling the /init-db endpoint"""
    init_url = f"{base_url}/init-db"
    
    print(f"Initializing database at {init_url}")
    
    try:
        # Add retry logic in case the service is still starting up
        max_retries = 5
        for attempt in range(max_retries):
            try:
                response = requests.post(init_url, timeout=30)
                
                if response.status_code == 200:
                    print("✅ Database initialized successfully")
                    return True
                else:
                    print(f"❌ Database initialization failed: {response.status_code}")
                    print(f"Response: {response.text}")
                    return False
                    
            except requests.exceptions.ConnectionError:
                if attempt < max_retries - 1:
                    print(f"Connection failed, retrying in 10 seconds... (attempt {attempt + 1}/{max_retries})")
                    time.sleep(10)
                else:
                    print("❌ Could not connect to the service after multiple attempts")
                    return False
            except requests.exceptions.Timeout:
                print("❌ Request timed out")
                return False
                
    except Exception as e:
        print(f"❌ Error initializing database: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python init_production_db.py <base_url>")
        print("Example: python init_production_db.py https://your-app.onrender.com")
        sys.exit(1)
    
    base_url = sys.argv[1].rstrip('/')
    success = init_production_database(base_url)
    sys.exit(0 if success else 1)