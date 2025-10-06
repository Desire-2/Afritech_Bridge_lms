#!/usr/bin/env python3
"""
API Testing Script for Student Features
Tests all student API endpoints with realistic scenarios.
"""

import requests
import json
import time
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:5000"
API_BASE = f"{BASE_URL}/api/v1"

# Test credentials
TEST_STUDENTS = [
    {"email": "student1@example.com", "password": "password123"},
    {"email": "student2@example.com", "password": "password123"},
    {"email": "student3@example.com", "password": "password123"}
]

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'

class APITester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.test_results = {
            'passed': 0,
            'failed': 0,
            'total': 0
        }
    
    def print_header(self, title):
        print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*50}{Colors.END}")
        print(f"{Colors.BOLD}{Colors.BLUE}{title}{Colors.END}")
        print(f"{Colors.BOLD}{Colors.BLUE}{'='*50}{Colors.END}")
    
    def print_test(self, test_name, passed, message="", response_data=None):
        self.test_results['total'] += 1
        if passed:
            self.test_results['passed'] += 1
            print(f"{Colors.GREEN}✓{Colors.END} {test_name}")
            if message:
                print(f"  {message}")
        else:
            self.test_results['failed'] += 1
            print(f"{Colors.RED}✗{Colors.END} {test_name}")
            if message:
                print(f"  {Colors.RED}Error: {message}{Colors.END}")
        
        if response_data and isinstance(response_data, dict):
            if 'error' in response_data:
                print(f"  {Colors.YELLOW}API Error: {response_data['error']}{Colors.END}")
    
    def login_student(self, email, password):
        """Login and get authentication token."""
        try:
            response = self.session.post(
                f"{API_BASE}/auth/login",
                json={"email": email, "password": password}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data.get('access_token')
                self.session.headers.update({'Authorization': f'Bearer {self.auth_token}'})
                return True, data
            else:
                return False, response.json() if response.content else {"error": "Login failed"}
        except Exception as e:
            return False, {"error": str(e)}
    
    def test_endpoint(self, method, endpoint, data=None, expected_status=200):
        """Test an API endpoint."""
        try:
            url = f"{API_BASE}{endpoint}"
            
            if method.upper() == 'GET':
                response = self.session.get(url)
            elif method.upper() == 'POST':
                response = self.session.post(url, json=data)
            elif method.upper() == 'PUT':
                response = self.session.put(url, json=data)
            elif method.upper() == 'DELETE':
                response = self.session.delete(url)
            else:
                return False, {"error": f"Unsupported method: {method}"}
            
            success = response.status_code == expected_status
            response_data = response.json() if response.content else {}
            
            return success, response_data, response.status_code
        except Exception as e:
            return False, {"error": str(e)}, 0
    
    def run_dashboard_tests(self):
        """Test dashboard endpoints."""
        self.print_header("Testing Dashboard Endpoints")
        
        # Test comprehensive dashboard
        success, data, status = self.test_endpoint('GET', '/student/dashboard')
        self.print_test(
            "GET /student/dashboard",
            success,
            f"Retrieved dashboard data with {len(data.get('enrollments', []))} enrollments" if success else f"Status: {status}",
            data if not success else None
        )
        
        # Test dashboard analytics
        success, data, status = self.test_endpoint('GET', '/student/dashboard/analytics')
        self.print_test(
            "GET /student/dashboard/analytics",
            success,
            f"Retrieved analytics for {len(data.get('courses', []))} courses" if success else f"Status: {status}",
            data if not success else None
        )
        
        # Test recommendations
        success, data, status = self.test_endpoint('GET', '/student/dashboard/recommendations')
        self.print_test(
            "GET /student/dashboard/recommendations",
            success,
            f"Retrieved {len(data.get('recommendations', []))} recommendations" if success else f"Status: {status}",
            data if not success else None
        )
    
    def run_learning_tests(self):
        """Test learning endpoints."""
        self.print_header("Testing Learning Endpoints")
        
        # Test active courses
        success, data, status = self.test_endpoint('GET', '/student/learning/courses/active')
        self.print_test(
            "GET /student/learning/courses/active",
            success,
            f"Retrieved {len(data.get('courses', []))} active courses" if success else f"Status: {status}",
            data if not success else None
        )
        
        # Test completed courses
        success, data, status = self.test_endpoint('GET', '/student/learning/courses/completed')
        self.print_test(
            "GET /student/learning/courses/completed",
            success,
            f"Retrieved {len(data.get('courses', []))} completed courses" if success else f"Status: {status}",
            data if not success else None
        )
        
        # Test course details (assuming course ID 1 exists)
        success, data, status = self.test_endpoint('GET', '/student/learning/courses/1')
        if success:
            course_title = data.get('course', {}).get('title', 'Unknown')
            self.print_test(
                "GET /student/learning/courses/1",
                success,
                f"Retrieved course details for '{course_title}'",
                data if not success else None
            )
        else:
            self.print_test(
                "GET /student/learning/courses/1",
                False,
                f"Status: {status}",
                data
            )
        
        # Test lesson completion (assuming lesson ID 1 exists)
        lesson_data = {"time_spent": 25, "notes": "Completed lesson successfully"}
        success, data, status = self.test_endpoint('POST', '/student/learning/lessons/1/complete', lesson_data)
        self.print_test(
            "POST /student/learning/lessons/1/complete",
            success,
            "Lesson marked as complete" if success else f"Status: {status}",
            data if not success else None
        )
    
    def run_enrollment_tests(self):
        """Test enrollment endpoints."""
        self.print_header("Testing Enrollment Endpoints")
        
        # Test browse courses
        success, data, status = self.test_endpoint('GET', '/student/enrollment/courses')
        self.print_test(
            "GET /student/enrollment/courses",
            success,
            f"Retrieved {len(data.get('courses', []))} available courses" if success else f"Status: {status}",
            data if not success else None
        )
        
        # Test course enrollment details (assuming course ID 2 exists)
        success, data, status = self.test_endpoint('GET', '/student/enrollment/courses/2')
        if success:
            course_title = data.get('title', 'Unknown')
            enrollment_type = data.get('enrollment_type', 'unknown')
            self.print_test(
                "GET /student/enrollment/courses/2",
                success,
                f"Retrieved enrollment details for '{course_title}' ({enrollment_type})",
                data if not success else None
            )
        else:
            self.print_test(
                "GET /student/enrollment/courses/2",
                False,
                f"Status: {status}",
                data
            )
        
        # Test scholarship application (assuming course ID 3 is scholarship type)
        application_data = {
            "personal_statement": "I am passionate about learning and would benefit greatly from this course.",
            "financial_need_statement": "I am currently unemployed and seeking to improve my skills.",
            "previous_experience": "Basic programming knowledge from online tutorials.",
            "career_goals": "To become a professional software developer."
        }
        success, data, status = self.test_endpoint('POST', '/student/enrollment/courses/3/apply', application_data)
        self.print_test(
            "POST /student/enrollment/courses/3/apply",
            success,
            "Scholarship application submitted" if success else f"Status: {status}",
            data if not success else None
        )
        
        # Test my applications
        success, data, status = self.test_endpoint('GET', '/student/enrollment/applications')
        self.print_test(
            "GET /student/enrollment/applications",
            success,
            f"Retrieved {len(data.get('applications', []))} applications" if success else f"Status: {status}",
            data if not success else None
        )
    
    def run_progress_tests(self):
        """Test progress endpoints."""
        self.print_header("Testing Progress Endpoints")
        
        # Test overall progress
        success, data, status = self.test_endpoint('GET', '/student/progress')
        self.print_test(
            "GET /student/progress",
            success,
            f"Retrieved progress for {len(data.get('courses', []))} courses" if success else f"Status: {status}",
            data if not success else None
        )
        
        # Test course progress (assuming course ID 1 exists)
        success, data, status = self.test_endpoint('GET', '/student/progress/courses/1')
        if success:
            progress = data.get('overall_progress', 0)
            self.print_test(
                "GET /student/progress/courses/1",
                success,
                f"Course progress: {progress}%",
                data if not success else None
            )
        else:
            self.print_test(
                "GET /student/progress/courses/1",
                False,
                f"Status: {status}",
                data
            )
        
        # Test analytics
        success, data, status = self.test_endpoint('GET', '/student/progress/analytics')
        self.print_test(
            "GET /student/progress/analytics",
            success,
            f"Retrieved analytics data" if success else f"Status: {status}",
            data if not success else None
        )
    
    def run_assessment_tests(self):
        """Test assessment endpoints."""
        self.print_header("Testing Assessment Endpoints")
        
        # Test quiz attempts (assuming quiz ID 1 exists)
        success, data, status = self.test_endpoint('GET', '/student/assessment/quizzes/1/attempts')
        self.print_test(
            "GET /student/assessment/quizzes/1/attempts",
            success,
            f"Retrieved {len(data.get('attempts', []))} quiz attempts" if success else f"Status: {status}",
            data if not success else None
        )
        
        # Test start quiz attempt
        success, data, status = self.test_endpoint('POST', '/student/assessment/quizzes/1/start')
        if success:
            attempt_id = data.get('attempt_id')
            self.print_test(
                "POST /student/assessment/quizzes/1/start",
                success,
                f"Started quiz attempt {attempt_id}",
                data if not success else None
            )
            
            # Test submit quiz (if we got an attempt ID)
            if attempt_id:
                submit_data = {
                    "answers": {
                        "1": "A",
                        "2": "B", 
                        "3": "A",
                        "4": "C",
                        "5": "A"
                    }
                }
                success, data, status = self.test_endpoint('POST', f'/student/assessment/quizzes/1/submit/{attempt_id}', submit_data)
                self.print_test(
                    f"POST /student/assessment/quizzes/1/submit/{attempt_id}",
                    success,
                    f"Quiz submitted with score: {data.get('score', 'N/A')}" if success else f"Status: {status}",
                    data if not success else None
                )
        else:
            self.print_test(
                "POST /student/assessment/quizzes/1/start",
                False,
                f"Status: {status}",
                data
            )
        
        # Test assignment submissions
        success, data, status = self.test_endpoint('GET', '/student/assessment/assignments')
        self.print_test(
            "GET /student/assessment/assignments",
            success,
            f"Retrieved {len(data.get('assignments', []))} assignments" if success else f"Status: {status}",
            data if not success else None
        )
    
    def run_certificate_tests(self):
        """Test certificate endpoints."""
        self.print_header("Testing Certificate Endpoints")
        
        # Test certificates
        success, data, status = self.test_endpoint('GET', '/student/certificate/certificates')
        self.print_test(
            "GET /student/certificate/certificates",
            success,
            f"Retrieved {len(data.get('certificates', []))} certificates" if success else f"Status: {status}",
            data if not success else None
        )
        
        # Test badges
        success, data, status = self.test_endpoint('GET', '/student/certificate/badges')
        self.print_test(
            "GET /student/certificate/badges",
            success,
            f"Retrieved {len(data.get('badges', []))} badges" if success else f"Status: {status}",
            data if not success else None
        )
        
        # Test certificate eligibility (assuming course ID 1)
        success, data, status = self.test_endpoint('GET', '/student/certificate/courses/1/eligibility')
        if success:
            eligible = data.get('eligible', False)
            self.print_test(
                "GET /student/certificate/courses/1/eligibility",
                success,
                f"Certificate eligibility: {'Yes' if eligible else 'No'}",
                data if not success else None
            )
        else:
            self.print_test(
                "GET /student/certificate/courses/1/eligibility",
                False,
                f"Status: {status}",
                data
            )
        
        # Test transcript
        success, data, status = self.test_endpoint('GET', '/student/certificate/transcript')
        self.print_test(
            "GET /student/certificate/transcript",
            success,
            "Retrieved student transcript" if success else f"Status: {status}",
            data if not success else None
        )
    
    def run_all_tests(self):
        """Run all API tests."""
        print(f"{Colors.BOLD}🧪 Student Features API Testing{Colors.END}")
        print(f"{Colors.BOLD}Target: {BASE_URL}{Colors.END}")
        print(f"{Colors.BOLD}Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}{Colors.END}")
        
        # Test with first student account
        student = TEST_STUDENTS[0]
        print(f"\n{Colors.YELLOW}Logging in as {student['email']}...{Colors.END}")
        
        success, login_data = self.login_student(student['email'], student['password'])
        if not success:
            print(f"{Colors.RED}❌ Login failed: {login_data.get('error', 'Unknown error')}{Colors.END}")
            print(f"{Colors.YELLOW}💡 Make sure the backend server is running and sample data exists{Colors.END}")
            return
        
        print(f"{Colors.GREEN}✅ Login successful{Colors.END}")
        
        # Run all test suites
        self.run_dashboard_tests()
        self.run_learning_tests()
        self.run_enrollment_tests()
        self.run_progress_tests()
        self.run_assessment_tests()
        self.run_certificate_tests()
        
        # Print summary
        self.print_header("Test Summary")
        total = self.test_results['total']
        passed = self.test_results['passed']
        failed = self.test_results['failed']
        
        print(f"Total Tests: {total}")
        print(f"{Colors.GREEN}Passed: {passed}{Colors.END}")
        print(f"{Colors.RED}Failed: {failed}{Colors.END}")
        
        if failed == 0:
            print(f"\n{Colors.GREEN}{Colors.BOLD}🎉 All tests passed!{Colors.END}")
        else:
            print(f"\n{Colors.YELLOW}⚠️  Some tests failed. Check the API implementation and server status.{Colors.END}")
        
        success_rate = (passed / total * 100) if total > 0 else 0
        print(f"Success Rate: {success_rate:.1f}%")

def main():
    """Main function to run API tests."""
    print("🚀 Starting Student Features API Tests...")
    print("=" * 50)
    
    # Check if server is running
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        if response.status_code != 200:
            print(f"{Colors.RED}❌ Server is not responding properly{Colors.END}")
            return
    except requests.ConnectionError:
        print(f"{Colors.RED}❌ Cannot connect to server at {BASE_URL}{Colors.END}")
        print(f"{Colors.YELLOW}💡 Make sure to start the backend server first:{Colors.END}")
        print(f"   cd backend && python app.py")
        return
    except Exception as e:
        print(f"{Colors.RED}❌ Error connecting to server: {e}{Colors.END}")
        return
    
    print(f"{Colors.GREEN}✅ Server is running{Colors.END}")
    
    # Run tests
    tester = APITester()
    tester.run_all_tests()

if __name__ == "__main__":
    main()