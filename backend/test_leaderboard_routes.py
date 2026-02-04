#!/usr/bin/env python3
"""
Test script to verify achievement leaderboard routes are working
"""

import sys
import os

# Add the backend directory to Python path
sys.path.insert(0, '/home/desire/My_Project/Client_Project/Afritech_Bridge_lms/backend')

# Set environment variables
os.environ['FLASK_ENV'] = 'development'

try:
    from main import app
except ImportError:
    from src.main import app

def test_leaderboard_routes():
    """Test that the leaderboard routes are properly registered"""
    
    with app.test_client() as client:
        print("🔍 Testing Leaderboard Route Registration...")
        
        # Test routes without authentication (should get 401, not 404)
        routes_to_test = [
            '/api/v1/achievements/leaderboards/points',
            '/api/v1/achievements/leaderboards/streaks', 
            '/api/v1/achievements/leaderboards/weekly',
            '/api/v1/achievements/leaderboards/total_points_alltime'
        ]
        
        for route in routes_to_test:
            response = client.get(route)
            if response.status_code == 404:
                print(f"   ❌ {route}: Not found (404)")
            elif response.status_code == 401:
                print(f"   ✅ {route}: Route exists, requires auth (401)")
            else:
                print(f"   ⚠️  {route}: Unexpected status {response.status_code}")
        
        # Test the general leaderboards endpoint
        response = client.get('/api/v1/achievements/leaderboards')
        if response.status_code == 404:
            print(f"   ❌ /api/v1/achievements/leaderboards: Not found (404)")
        elif response.status_code == 401:
            print(f"   ✅ /api/v1/achievements/leaderboards: Route exists, requires auth (401)")
        else:
            print(f"   ⚠️  /api/v1/achievements/leaderboards: Unexpected status {response.status_code}")

def list_achievement_routes():
    """List all registered achievement routes"""
    print("\n📋 All Achievement Routes:")
    
    with app.app_context():
        for rule in app.url_map.iter_rules():
            if '/achievements/' in rule.rule:
                methods = ', '.join(rule.methods - {'OPTIONS', 'HEAD'})
                print(f"   {methods:8} {rule.rule}")

if __name__ == "__main__":
    test_leaderboard_routes()
    list_achievement_routes()
    print("\n✅ Route testing complete!")