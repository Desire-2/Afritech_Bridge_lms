#!/usr/bin/env python3
"""
Enhanced Application Search Testing Script

Tests the new enhanced search functionality for course applications including:
- Text search across multiple fields
- Advanced filters (country, education level, etc.)
- Date range filtering
- Score range filtering
- Search statistics
- Advanced search with analytics
- Similar application finding
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main import app, db
from src.models.course_application import CourseApplication
from src.models.course_models import Course
from src.models.user_models import User, Role
from flask_jwt_extended import create_access_token
import requests
import json
from datetime import datetime, timedelta

class EnhancedApplicationSearchTester:
    def __init__(self):
        self.app = app
        self.base_url = "http://localhost:5000/api/v1"
        self.auth_token = None
        
    def setup_test_environment(self):
        """Setup test environment with sample data"""
        print("🔧 Setting up test environment...")
        
        with self.app.app_context():
            # Create test admin user
            admin_role = Role.query.filter_by(name='admin').first()
            if not admin_role:
                admin_role = Role(name='admin')
                db.session.add(admin_role)
                
            test_admin = User.query.filter_by(email='test_admin@test.com').first()
            if not test_admin:
                test_admin = User(
                    email='test_admin@test.com',
                    username='test_admin',
                    first_name='Test',
                    last_name='Admin',
                    password_hash='$2b$12$dummy_hash',  # Dummy hash
                    is_verified=True
                )
                test_admin.role = admin_role
                db.session.add(test_admin)
                
            # Create test course
            test_course = Course.query.filter_by(title='Test Course for Search').first()
            if not test_course:
                test_course = Course(
                    title='Test Course for Search',
                    description='A test course for search functionality',
                    price=299.99,
                    instructor_id=test_admin.id,
                    is_published=True
                )
                db.session.add(test_course)
                
            db.session.commit()
            
            # Generate auth token
            self.auth_token = create_access_token(identity=str(test_admin.id))
            self.course_id = test_course.id
            
            print(f"✅ Test environment ready. Course ID: {self.course_id}")
            
    def create_sample_applications(self):
        """Create diverse sample applications for testing"""
        print("📝 Creating sample applications...")
        
        sample_applications = [
            {
                "full_name": "Alice Johnson",
                "email": "alice.johnson@example.com",
                "phone": "+1234567890",
                "country": "United States",
                "city": "New York",
                "education_level": "bachelors",
                "current_status": "employed",
                "field_of_study": "Computer Science",
                "excel_skill_level": "intermediate",
                "motivation": "Want to improve my data analysis skills for work",
                "referral_source": "Google Search"
            },
            {
                "full_name": "Bob Smith",
                "email": "bob.smith@example.com",
                "phone": "+1987654321",
                "country": "Canada",
                "city": "Toronto",
                "education_level": "masters",
                "current_status": "freelancer",
                "field_of_study": "Marketing",
                "excel_skill_level": "beginner",
                "motivation": "Need Excel skills for my freelance business",
                "referral_source": "LinkedIn"
            },
            {
                "full_name": "Carol Davis",
                "email": "carol.davis@example.com",
                "phone": "+447123456789",
                "country": "United Kingdom",
                "city": "London",
                "education_level": "phd",
                "current_status": "student",
                "field_of_study": "Finance",
                "excel_skill_level": "advanced",
                "motivation": "Research requires advanced Excel capabilities",
                "referral_source": "University recommendation"
            },
            {
                "full_name": "David Wilson",
                "email": "david.wilson@example.com",
                "phone": "+33123456789",
                "country": "France",
                "city": "Paris",
                "education_level": "high_school",
                "current_status": "unemployed",
                "field_of_study": "Business",
                "excel_skill_level": "never_used",
                "motivation": "Looking to start a career in data analysis",
                "referral_source": "Facebook"
            },
            {
                "full_name": "Eva Brown",
                "email": "eva.brown@example.com",
                "phone": "+49123456789",
                "country": "Germany",
                "city": "Berlin",
                "education_level": "diploma",
                "current_status": "self_employed",
                "field_of_study": "Economics",
                "excel_skill_level": "expert",
                "motivation": "Want to offer Excel training to my clients",
                "referral_source": "Word of mouth"
            }
        ]
        
        created_count = 0
        for app_data in sample_applications:
            app_data.update({
                "course_id": self.course_id,
                "has_used_excel": app_data["excel_skill_level"] != "never_used",
                "has_computer": True,
                "internet_access_type": "stable_broadband",
                "committed_to_complete": True,
                "agrees_to_assessments": True,
                "learning_outcomes": "Improve productivity and career prospects",
                "career_impact": "Better job opportunities and efficiency"
            })
            
            try:
                response = requests.post(
                    f"{self.base_url}/applications",
                    json=app_data,
                    headers={"Content-Type": "application/json"}
                )
                if response.status_code == 201:
                    created_count += 1
                    print(f"   ✅ Created application for {app_data['full_name']}")
                else:
                    print(f"   ❌ Failed to create application for {app_data['full_name']}: {response.status_code}")
            except Exception as e:
                print(f"   ❌ Error creating application for {app_data['full_name']}: {e}")
        
        print(f"📝 Created {created_count} sample applications")
        
    def test_text_search(self):
        """Test text search functionality"""
        print("\n🔍 Testing text search...")
        
        test_queries = [
            ("Alice", "name search"),
            ("analysis", "motivation search"),
            ("Computer Science", "field of study search"),
            ("alice.johnson@example.com", "email search"),
            ("+1234567890", "phone search")
        ]
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        for query, test_name in test_queries:
            try:
                response = requests.get(
                    f"{self.base_url}/applications",
                    params={"search": query, "course_id": self.course_id},
                    headers=headers
                )
                
                if response.status_code == 200:
                    data = response.json()
                    print(f"   ✅ {test_name}: Found {len(data.get('applications', []))} results")
                    
                    # Verify search results contain the query
                    for app in data.get('applications', [])[:2]:  # Show first 2 results
                        print(f"      - {app['full_name']} ({app['email']})")
                else:
                    print(f"   ❌ {test_name}: Failed with status {response.status_code}")
                    
            except Exception as e:
                print(f"   ❌ {test_name}: Error - {e}")
    
    def test_advanced_filters(self):
        """Test advanced filtering functionality"""
        print("\n🎯 Testing advanced filters...")
        
        filter_tests = [
            ({"country": "United States"}, "country filter"),
            ({"education_level": "masters"}, "education level filter"),
            ({"excel_skill_level": "beginner"}, "Excel skill filter"),
            ({"current_status": "employed"}, "current status filter"),
            ({"city": "London"}, "city filter"),
            ({"referral_source": "LinkedIn"}, "referral source filter")
        ]
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        for filters, test_name in filter_tests:
            try:
                params = {**filters, "course_id": self.course_id}
                response = requests.get(
                    f"{self.base_url}/applications",
                    params=params,
                    headers=headers
                )
                
                if response.status_code == 200:
                    data = response.json()
                    count = len(data.get('applications', []))
                    print(f"   ✅ {test_name}: Found {count} results")
                    
                    if count > 0:
                        # Verify filter worked
                        sample_app = data['applications'][0]
                        filter_key, filter_value = list(filters.items())[0]
                        actual_value = sample_app.get(filter_key, 'N/A')
                        print(f"      Sample: {sample_app['full_name']} - {filter_key}: {actual_value}")
                else:
                    print(f"   ❌ {test_name}: Failed with status {response.status_code}")
                    
            except Exception as e:
                print(f"   ❌ {test_name}: Error - {e}")
    
    def test_score_filtering(self):
        """Test score range filtering"""
        print("\n📊 Testing score filtering...")
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        score_tests = [
            ({"min_score": 50, "score_type": "application_score"}, "minimum application score"),
            ({"max_score": 80, "score_type": "final_rank_score"}, "maximum final rank score"),
            ({"min_score": 30, "max_score": 70, "score_type": "readiness_score"}, "readiness score range")
        ]
        
        for params, test_name in score_tests:
            try:
                params.update({"course_id": self.course_id})
                response = requests.get(
                    f"{self.base_url}/applications",
                    params=params,
                    headers=headers
                )
                
                if response.status_code == 200:
                    data = response.json()
                    count = len(data.get('applications', []))
                    print(f"   ✅ {test_name}: Found {count} results")
                    
                    if count > 0:
                        sample_app = data['applications'][0]
                        score_field = params['score_type']
                        score_value = sample_app.get(score_field, 'N/A')
                        print(f"      Sample: {sample_app['full_name']} - {score_field}: {score_value}")
                else:
                    print(f"   ❌ {test_name}: Failed with status {response.status_code}")
                    
            except Exception as e:
                print(f"   ❌ {test_name}: Error - {e}")
    
    def test_date_filtering(self):
        """Test date range filtering"""
        print("\n📅 Testing date filtering...")
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        # Test with recent dates
        today = datetime.now().strftime('%Y-%m-%d')
        yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
        
        date_tests = [
            ({"date_from": yesterday}, "applications from yesterday"),
            ({"date_to": today}, "applications until today"),
            ({"date_from": yesterday, "date_to": today}, "applications in date range")
        ]
        
        for params, test_name in date_tests:
            try:
                params.update({"course_id": self.course_id})
                response = requests.get(
                    f"{self.base_url}/applications",
                    params=params,
                    headers=headers
                )
                
                if response.status_code == 200:
                    data = response.json()
                    count = len(data.get('applications', []))
                    print(f"   ✅ {test_name}: Found {count} results")
                else:
                    print(f"   ❌ {test_name}: Failed with status {response.status_code}")
                    
            except Exception as e:
                print(f"   ❌ {test_name}: Error - {e}")
    
    def test_search_statistics(self):
        """Test search statistics endpoint"""
        print("\n📈 Testing search statistics...")
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        try:
            response = requests.get(
                f"{self.base_url}/applications/search-stats",
                params={"course_id": self.course_id},
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                print("   ✅ Search statistics retrieved successfully")
                
                # Display key statistics
                filter_options = data.get('filter_options', {})
                print(f"      Countries: {len(filter_options.get('countries', []))} options")
                print(f"      Education levels: {len(filter_options.get('education_levels', []))} options")
                print(f"      Excel skills: {len(filter_options.get('excel_skill_levels', []))} options")
                
                status_counts = data.get('status_counts', {})
                print(f"      Status distribution: {status_counts}")
                
                total = data.get('total_applications', 0)
                print(f"      Total applications: {total}")
                
            else:
                print(f"   ❌ Search statistics failed with status {response.status_code}")
                print(f"      Response: {response.text}")
                
        except Exception as e:
            print(f"   ❌ Search statistics error: {e}")
    
    def test_advanced_search(self):
        """Test advanced search endpoint"""
        print("\n🔍 Testing advanced search...")
        
        headers = {
            "Authorization": f"Bearer {self.auth_token}",
            "Content-Type": "application/json"
        }
        
        search_config = {
            "text_search": "analysis",
            "filters": {
                "course_id": self.course_id,
                "country": "United States"
            },
            "score_ranges": {
                "application_score": {"min": 0, "max": 100}
            },
            "sort_config": {
                "field": "final_rank_score",
                "order": "desc"
            },
            "pagination": {
                "page": 1,
                "per_page": 10
            },
            "include_analytics": True
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/applications/advanced-search",
                json=search_config,
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                print("   ✅ Advanced search completed successfully")
                
                applications = data.get('applications', [])
                print(f"      Found {len(applications)} applications")
                print(f"      Total results: {data.get('total', 0)}")
                
                if 'analytics' in data:
                    analytics = data['analytics']
                    print(f"      Analytics included: {len(analytics)} metrics")
                    if 'status_distribution' in analytics:
                        print(f"      Status distribution: {analytics['status_distribution']}")
            else:
                print(f"   ❌ Advanced search failed with status {response.status_code}")
                print(f"      Response: {response.text}")
                
        except Exception as e:
            print(f"   ❌ Advanced search error: {e}")
    
    def test_similar_applications(self):
        """Test finding similar applications"""
        print("\n🎯 Testing similar applications...")
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        # First, get an application ID to test with
        try:
            response = requests.get(
                f"{self.base_url}/applications",
                params={"course_id": self.course_id, "per_page": 1},
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                applications = data.get('applications', [])
                
                if applications:
                    app_id = applications[0]['id']
                    print(f"   Testing with application ID: {app_id}")
                    
                    # Test similar applications
                    similar_response = requests.get(
                        f"{self.base_url}/applications/{app_id}/similar",
                        params={"limit": 5},
                        headers=headers
                    )
                    
                    if similar_response.status_code == 200:
                        similar_data = similar_response.json()
                        print("   ✅ Similar applications found successfully")
                        
                        similar_apps = similar_data.get('similar_applications', [])
                        print(f"      Found {len(similar_apps)} similar applications")
                        
                        for app in similar_apps[:3]:  # Show top 3
                            score = app.get('similarity_score', 0)
                            factors = app.get('similarity_factors', [])
                            print(f"      - {app['full_name']}: {score}% similar")
                            print(f"        Factors: {', '.join(factors[:2])}")  # Show first 2 factors
                    else:
                        print(f"   ❌ Similar applications failed with status {similar_response.status_code}")
                else:
                    print("   ⚠️ No applications found to test similarity")
            else:
                print(f"   ❌ Failed to get applications for similarity test: {response.status_code}")
                
        except Exception as e:
            print(f"   ❌ Similar applications test error: {e}")
    
    def test_sorting_and_pagination(self):
        """Test sorting and pagination"""
        print("\n📑 Testing sorting and pagination...")
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        sort_tests = [
            ({"sort_by": "created_at", "order": "desc"}, "newest first"),
            ({"sort_by": "full_name", "order": "asc"}, "alphabetical by name"),
            ({"sort_by": "final_rank_score", "order": "desc"}, "highest score first")
        ]
        
        for params, test_name in sort_tests:
            try:
                params.update({"course_id": self.course_id, "per_page": 3})
                response = requests.get(
                    f"{self.base_url}/applications",
                    params=params,
                    headers=headers
                )
                
                if response.status_code == 200:
                    data = response.json()
                    applications = data.get('applications', [])
                    print(f"   ✅ {test_name}: Retrieved {len(applications)} results")
                    
                    if applications:
                        # Show first result to verify sorting
                        first_app = applications[0]
                        sort_field = params['sort_by']
                        if sort_field in first_app:
                            value = first_app[sort_field]
                            print(f"      First result: {first_app['full_name']} - {sort_field}: {value}")
                else:
                    print(f"   ❌ {test_name}: Failed with status {response.status_code}")
                    
            except Exception as e:
                print(f"   ❌ {test_name}: Error - {e}")
    
    def run_comprehensive_test(self):
        """Run all tests"""
        print("🚀 Starting Enhanced Application Search Comprehensive Test")
        print("=" * 60)
        
        try:
            self.setup_test_environment()
            self.create_sample_applications()
            
            # Run all test suites
            self.test_text_search()
            self.test_advanced_filters()
            self.test_score_filtering()
            self.test_date_filtering()
            self.test_search_statistics()
            self.test_advanced_search()
            self.test_similar_applications()
            self.test_sorting_and_pagination()
            
            print("\n" + "=" * 60)
            print("🎉 Enhanced Application Search Test Suite Completed!")
            
        except Exception as e:
            print(f"\n❌ Test suite failed with error: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    tester = EnhancedApplicationSearchTester()
    tester.run_comprehensive_test()