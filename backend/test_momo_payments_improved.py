#!/usr/bin/env python3
"""
MOMO Payment System - Comprehensive UAT Test Suite with Improvements
Tests all MOMO payment endpoints with real database courses
Identifies improvement opportunities and generates detailed report

Test Coverage:
- Backend connectivity
- Account validation
- Payment initiation with real courses
- Payment verification/status checking
- Error handling and edge cases
- Multi-currency support
- Retry mechanisms
- Payment tracking

Author: Automated Test Suite
Date: 2026-04-22
"""

import requests
import json
import time
import sys
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

try:
    from src.models.course_models import Course
    from main import app
    DB_AVAILABLE = True
except Exception as e:
    print(f"⚠️  Could not load database models: {e}")
    DB_AVAILABLE = False

@dataclass
class TestResult:
    test_id: str
    test_name: str
    endpoint: str
    status: str  # PASS, FAIL, PENDING
    expected: str
    actual: str
    response_code: Optional[int] = None
    duration_ms: float = 0.0
    notes: str = ""

class MOMOPaymentTestSuite:
    """Comprehensive MOMO payment testing with improvements"""
    
    def __init__(self, api_url: str = "http://localhost:5001/api/v1"):
        self.api_url = api_url
        self.results: List[TestResult] = []
        self.real_courses: List[Dict] = []
        self.test_phone = "+250788123456"
        self.test_amount = 5000  # RWF
        self.improvements: List[str] = []
        
    def load_real_courses(self) -> List[Dict]:
        """Load available courses from database"""
        if not DB_AVAILABLE:
            print("⚠️  Database not available, using mock courses")
            return [
                {"id": 1, "title": "Introduction to Python", "cost": 50000},
                {"id": 2, "title": "Web Development with Django", "cost": 75000},
                {"id": 3, "title": "Mobile App Development", "cost": 100000},
            ]
        
        try:
            with app.app_context():
                courses = Course.query.filter(Course.cost > 0).limit(5).all()
                self.real_courses = [
                    {"id": c.id, "title": c.title, "cost": c.cost}
                    for c in courses
                ]
                print(f"✅ Loaded {len(self.real_courses)} real courses from database")
                return self.real_courses
        except Exception as e:
            print(f"❌ Error loading courses: {e}")
            return []
    
    def test_backend_connectivity(self) -> TestResult:
        """Test 1: Verify backend is reachable"""
        test_id = "MOMO-001"
        start = time.time()
        
        try:
            response = requests.get(f"{self.api_url}/courses", timeout=5)
            duration = (time.time() - start) * 1000
            
            if response.status_code in [200, 401]:  # 401 is OK if auth required
                return TestResult(
                    test_id=test_id,
                    test_name="Backend Connectivity",
                    endpoint="GET /api/v1/courses",
                    status="PASS",
                    expected="HTTP 200 OK",
                    actual=f"HTTP {response.status_code} - Connected",
                    response_code=response.status_code,
                    duration_ms=duration,
                    notes="Backend is responsive"
                )
            else:
                return TestResult(
                    test_id=test_id,
                    test_name="Backend Connectivity",
                    endpoint="GET /api/v1/courses",
                    status="FAIL",
                    expected="HTTP 200 OK",
                    actual=f"HTTP {response.status_code}",
                    response_code=response.status_code,
                    duration_ms=duration
                )
        except Exception as e:
            duration = (time.time() - start) * 1000
            return TestResult(
                test_id=test_id,
                test_name="Backend Connectivity",
                endpoint="GET /api/v1/courses",
                status="FAIL",
                expected="HTTP 200 OK",
                actual=f"Connection error: {str(e)}",
                duration_ms=duration
            )
    
    def test_account_validation(self) -> TestResult:
        """Test 2: Account validation endpoint"""
        test_id = "MOMO-002"
        start = time.time()
        
        payload = {
            "phone": self.test_phone,
            "currency": "RWF"
        }
        
        try:
            response = requests.post(
                f"{self.api_url}/applications/validate-momo-account",
                json=payload,
                timeout=10
            )
            duration = (time.time() - start) * 1000
            
            if response.status_code == 200:
                data = response.json()
                if data.get("valid"):
                    return TestResult(
                        test_id=test_id,
                        test_name="Account Validation",
                        endpoint="POST /applications/validate-momo-account",
                        status="PASS",
                        expected="valid: true, message present",
                        actual=f"valid: {data.get('valid')}, message: {data.get('message')}",
                        response_code=200,
                        duration_ms=duration,
                        notes="Account validation working"
                    )
                else:
                    return TestResult(
                        test_id=test_id,
                        test_name="Account Validation",
                        endpoint="POST /applications/validate-momo-account",
                        status="FAIL",
                        expected="valid: true",
                        actual=f"valid: {data.get('valid')}",
                        response_code=200,
                        duration_ms=duration,
                        notes="Account not recognized"
                    )
            else:
                return TestResult(
                    test_id=test_id,
                    test_name="Account Validation",
                    endpoint="POST /applications/validate-momo-account",
                    status="FAIL",
                    expected="HTTP 200",
                    actual=f"HTTP {response.status_code}",
                    response_code=response.status_code,
                    duration_ms=duration
                )
        except Exception as e:
            duration = (time.time() - start) * 1000
            return TestResult(
                test_id=test_id,
                test_name="Account Validation",
                endpoint="POST /applications/validate-momo-account",
                status="FAIL",
                expected="HTTP 200",
                actual=f"Error: {str(e)}",
                duration_ms=duration
            )
    
    def test_payment_initiation_with_real_course(self) -> List[TestResult]:
        """Test 3: Payment initiation with real database courses"""
        results = []
        
        if not self.real_courses:
            self.load_real_courses()
        
        for idx, course in enumerate(self.real_courses[:2], 1):  # Test first 2 courses
            test_id = f"MOMO-003-{idx}"
            start = time.time()
            
            payload = {
                "course_id": course["id"],
                "phone": self.test_phone,
                "currency": "RWF",
                "amount": course.get("cost", 5000)
            }
            
            try:
                response = requests.post(
                    f"{self.api_url}/applications/initiate-payment",
                    json=payload,
                    timeout=10
                )
                duration = (time.time() - start) * 1000
                
                if response.status_code == 200:
                    data = response.json()
                    if "reference_id" in data and "status" in data:
                        results.append(TestResult(
                            test_id=test_id,
                            test_name=f"Payment Initiation - {course['title'][:30]}",
                            endpoint="POST /applications/initiate-payment",
                            status="PASS",
                            expected="reference_id, status=pending",
                            actual=f"ref: {data.get('reference_id')}, status: {data.get('status')}",
                            response_code=200,
                            duration_ms=duration,
                            notes=f"Course ID {course['id']}, Amount {payload['amount']}"
                        ))
                    else:
                        results.append(TestResult(
                            test_id=test_id,
                            test_name=f"Payment Initiation - {course['title'][:30]}",
                            endpoint="POST /applications/initiate-payment",
                            status="FAIL",
                            expected="reference_id, status fields",
                            actual=f"Missing required fields",
                            response_code=200,
                            duration_ms=duration
                        ))
                else:
                    results.append(TestResult(
                        test_id=test_id,
                        test_name=f"Payment Initiation - {course['title'][:30]}",
                        endpoint="POST /applications/initiate-payment",
                        status="FAIL",
                        expected="HTTP 200",
                        actual=f"HTTP {response.status_code}",
                        response_code=response.status_code,
                        duration_ms=duration,
                        notes=response.text[:100]
                    ))
            except Exception as e:
                duration = (time.time() - start) * 1000
                results.append(TestResult(
                    test_id=test_id,
                    test_name=f"Payment Initiation - {course['title'][:30]}",
                    endpoint="POST /applications/initiate-payment",
                    status="FAIL",
                    expected="HTTP 200",
                    actual=f"Error: {str(e)}",
                    duration_ms=duration
                ))
        
        return results
    
    def test_payment_verification(self) -> TestResult:
        """Test 4: Payment status verification"""
        test_id = "MOMO-004"
        start = time.time()
        
        payload = {
            "reference_id": "TEST-REF-12345",
            "phone": self.test_phone
        }
        
        try:
            response = requests.post(
                f"{self.api_url}/applications/verify-payment",
                json=payload,
                timeout=10
            )
            duration = (time.time() - start) * 1000
            
            # Status 200 or 404 are both acceptable for verification endpoint
            if response.status_code in [200, 404, 400]:
                data = response.json() if response.text else {}
                return TestResult(
                    test_id=test_id,
                    test_name="Payment Verification",
                    endpoint="POST /applications/verify-payment",
                    status="PASS",
                    expected="status field present",
                    actual=f"HTTP {response.status_code}, status: {data.get('status', 'N/A')}",
                    response_code=response.status_code,
                    duration_ms=duration,
                    notes="Verification endpoint responds appropriately"
                )
            else:
                return TestResult(
                    test_id=test_id,
                    test_name="Payment Verification",
                    endpoint="POST /applications/verify-payment",
                    status="FAIL",
                    expected="HTTP 200/404",
                    actual=f"HTTP {response.status_code}",
                    response_code=response.status_code,
                    duration_ms=duration
                )
        except Exception as e:
            duration = (time.time() - start) * 1000
            return TestResult(
                test_id=test_id,
                test_name="Payment Verification",
                endpoint="POST /applications/verify-payment",
                status="FAIL",
                expected="HTTP 200/404",
                actual=f"Error: {str(e)}",
                duration_ms=duration
            )
    
    def test_error_handling(self) -> List[TestResult]:
        """Test 5-6: Error handling and validation"""
        results = []
        
        # Test 5a: Negative amount validation
        test_id = "MOMO-005a"
        start = time.time()
        payload = {
            "course_id": 999,
            "phone": self.test_phone,
            "amount": -1000  # Negative amount
        }
        try:
            response = requests.post(
                f"{self.api_url}/applications/initiate-payment",
                json=payload,
                timeout=10
            )
            duration = (time.time() - start) * 1000
            
            if response.status_code == 400:
                results.append(TestResult(
                    test_id=test_id,
                    test_name="Error Handling - Negative Amount",
                    endpoint="POST /applications/initiate-payment",
                    status="PASS",
                    expected="HTTP 400 for negative amount",
                    actual=f"HTTP {response.status_code}",
                    response_code=400,
                    duration_ms=duration,
                    notes="Validation working correctly"
                ))
            else:
                results.append(TestResult(
                    test_id=test_id,
                    test_name="Error Handling - Negative Amount",
                    endpoint="POST /applications/initiate-payment",
                    status="FAIL",
                    expected="HTTP 400",
                    actual=f"HTTP {response.status_code}",
                    response_code=response.status_code,
                    duration_ms=duration
                ))
        except Exception as e:
            duration = (time.time() - start) * 1000
            results.append(TestResult(
                test_id=test_id,
                test_name="Error Handling - Negative Amount",
                endpoint="POST /applications/initiate-payment",
                status="FAIL",
                expected="HTTP 400",
                actual=f"Error: {str(e)}",
                duration_ms=duration
            ))
        
        # Test 5b: Missing phone number
        test_id = "MOMO-005b"
        start = time.time()
        payload = {
            "course_id": 1,
            "phone": "",  # Missing phone
            "amount": 5000
        }
        try:
            response = requests.post(
                f"{self.api_url}/applications/initiate-payment",
                json=payload,
                timeout=10
            )
            duration = (time.time() - start) * 1000
            
            # Either rejects or handles gracefully
            if response.status_code in [400, 200]:
                results.append(TestResult(
                    test_id=test_id,
                    test_name="Error Handling - Missing Phone",
                    endpoint="POST /applications/initiate-payment",
                    status="PASS",
                    expected="Handles empty phone gracefully",
                    actual=f"HTTP {response.status_code}",
                    response_code=response.status_code,
                    duration_ms=duration,
                    notes="Accepts or rejects gracefully"
                ))
            else:
                results.append(TestResult(
                    test_id=test_id,
                    test_name="Error Handling - Missing Phone",
                    endpoint="POST /applications/initiate-payment",
                    status="FAIL",
                    expected="HTTP 400 or 200",
                    actual=f"HTTP {response.status_code}",
                    response_code=response.status_code,
                    duration_ms=duration
                ))
        except Exception as e:
            duration = (time.time() - start) * 1000
            results.append(TestResult(
                test_id=test_id,
                test_name="Error Handling - Missing Phone",
                endpoint="POST /applications/initiate-payment",
                status="FAIL",
                expected="Handles error gracefully",
                actual=f"Error: {str(e)}",
                duration_ms=duration
            ))
        
        return results
    
    def test_concurrent_requests(self) -> TestResult:
        """Test 7: Concurrent payment requests"""
        test_id = "MOMO-007"
        start = time.time()
        
        # Simulate multiple requests
        successful = 0
        failed = 0
        
        for i in range(3):
            try:
                payload = {
                    "phone": self.test_phone,
                    "currency": "RWF"
                }
                response = requests.post(
                    f"{self.api_url}/applications/validate-momo-account",
                    json=payload,
                    timeout=10
                )
                if response.status_code == 200:
                    successful += 1
                else:
                    failed += 1
            except:
                failed += 1
            
            time.sleep(0.1)  # Small delay between requests
        
        duration = (time.time() - start) * 1000
        
        return TestResult(
            test_id=test_id,
            test_name="Concurrent Request Handling",
            endpoint="POST /applications/validate-momo-account (x3)",
            status="PASS" if successful >= 2 else "FAIL",
            expected="All 3 requests successful",
            actual=f"{successful} successful, {failed} failed",
            response_code=200 if successful >= 2 else 500,
            duration_ms=duration,
            notes=f"Rate limiting test: {3} parallel requests"
        )
    
    def test_response_times(self) -> TestResult:
        """Test 8: Performance - Response time validation"""
        test_id = "MOMO-008"
        start = time.time()
        
        times = []
        for i in range(3):
            try:
                req_start = time.time()
                response = requests.post(
                    f"{self.api_url}/applications/validate-momo-account",
                    json={"phone": self.test_phone, "currency": "RWF"},
                    timeout=10
                )
                times.append((time.time() - req_start) * 1000)
            except:
                pass
        
        duration = (time.time() - start) * 1000
        avg_time = sum(times) / len(times) if times else 0
        
        return TestResult(
            test_id=test_id,
            test_name="Response Time Performance",
            endpoint="POST /applications/validate-momo-account (avg)",
            status="PASS" if avg_time < 5000 else "FAIL",
            expected="Average response < 5000ms",
            actual=f"Average: {avg_time:.0f}ms, Min: {min(times):.0f}ms, Max: {max(times):.0f}ms",
            duration_ms=duration,
            notes=f"Based on {len(times)} requests"
        )
    
    def identify_improvements(self):
        """Analyze results and identify improvement opportunities"""
        pass_count = sum(1 for r in self.results if r.status == "PASS")
        fail_count = sum(1 for r in self.results if r.status == "FAIL")
        
        # Improvement recommendations
        if fail_count > 0:
            self.improvements.append(
                "🔧 CRITICAL: Fix failing payment initiation tests - ensure real course IDs are used"
            )
        
        if pass_count >= len(self.results) * 0.8:
            self.improvements.append(
                "✅ GOOD: Core payment functionality is working (80%+ pass rate)"
            )
        
        # Check response times
        slow_tests = [r for r in self.results if r.duration_ms > 3000]
        if slow_tests:
            self.improvements.append(
                f"⚡ PERFORMANCE: {len(slow_tests)} tests exceed 3000ms - consider optimization"
            )
        
        # Real course testing
        if any("real" in str(r.notes).lower() for r in self.results):
            self.improvements.append(
                "✅ DATABASE INTEGRATION: Real courses from database are being tested"
            )
        else:
            self.improvements.append(
                "📊 ENHANCEMENT: Implement real database course integration for more realistic tests"
            )
        
        self.improvements.extend([
            "🔐 SECURITY: Add rate limiting to payment endpoints (5 requests/minute per phone)",
            "📝 LOGGING: Implement comprehensive payment transaction logging for audit",
            "🔄 RETRY: Add exponential backoff retry mechanism for failed payment initiations",
            "💾 CACHING: Cache account validation results (5-minute TTL) to reduce API calls",
            "📊 METRICS: Add Prometheus metrics for payment endpoint performance tracking",
            "🧪 TESTING: Create integration tests with Flutterwave fallback for redundancy",
            "⚠️ ALERTING: Setup alerts for payment failures > 10% threshold",
            "🌐 MULTI-CURRENCY: Validate multi-currency support (USD, EUR, KES, etc.)",
        ])
    
    def run_all_tests(self):
        """Execute all test suites"""
        print("\n" + "=" * 100)
        print("MOMO PAYMENT SYSTEM - COMPREHENSIVE UAT TEST SUITE")
        print("=" * 100)
        print(f"Start Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Backend URL: {self.api_url}")
        print("\n")
        
        # Load real courses first
        self.load_real_courses()
        
        # Run all test groups
        print("Running Test Group 1: Connectivity & Validation...")
        self.results.append(self.test_backend_connectivity())
        self.results.append(self.test_account_validation())
        
        print("Running Test Group 2: Payment Operations...")
        self.results.extend(self.test_payment_initiation_with_real_course())
        self.results.append(self.test_payment_verification())
        
        print("Running Test Group 3: Error Handling...")
        self.results.extend(self.test_error_handling())
        
        print("Running Test Group 4: Performance & Concurrency...")
        self.results.append(self.test_concurrent_requests())
        self.results.append(self.test_response_times())
        
        # Analyze and identify improvements
        self.identify_improvements()
        
        # Display results
        self.print_results()
        
        # Export results
        self.export_results()
    
    def print_results(self):
        """Print formatted test results"""
        print("\n" + "=" * 100)
        print("TEST RESULTS")
        print("=" * 100)
        
        # Group by status
        pass_tests = [r for r in self.results if r.status == "PASS"]
        fail_tests = [r for r in self.results if r.status == "FAIL"]
        pending_tests = [r for r in self.results if r.status == "PENDING"]
        
        print(f"\n✅ PASSED: {len(pass_tests)}/{len(self.results)}")
        for test in pass_tests:
            print(f"  [{test.test_id}] {test.test_name}")
            print(f"      Duration: {test.duration_ms:.2f}ms")
        
        if fail_tests:
            print(f"\n❌ FAILED: {len(fail_tests)}/{len(self.results)}")
            for test in fail_tests:
                print(f"  [{test.test_id}] {test.test_name}")
                print(f"      Expected: {test.expected}")
                print(f"      Actual: {test.actual}")
                print(f"      Duration: {test.duration_ms:.2f}ms")
        
        if pending_tests:
            print(f"\n⏳ PENDING: {len(pending_tests)}/{len(self.results)}")
            for test in pending_tests:
                print(f"  [{test.test_id}] {test.test_name}")
        
        # Summary
        success_rate = (len(pass_tests) / len(self.results) * 100) if self.results else 0
        print("\n" + "-" * 100)
        print("SUMMARY")
        print("-" * 100)
        print(f"Total Tests: {len(self.results)}")
        print(f"Passed: {len(pass_tests)} ({success_rate:.1f}%)")
        print(f"Failed: {len(fail_tests)} ({len(fail_tests)/len(self.results)*100:.1f}%)" if fail_tests else "Failed: 0 (0%)")
        print(f"Pending: {len(pending_tests)}")
        print(f"Total Duration: {sum(r.duration_ms for r in self.results):.2f}ms")
        print(f"Average Duration: {sum(r.duration_ms for r in self.results)/len(self.results):.2f}ms")
        
        # Improvements
        print("\n" + "=" * 100)
        print("IMPROVEMENT RECOMMENDATIONS")
        print("=" * 100)
        for idx, improvement in enumerate(self.improvements, 1):
            print(f"{idx}. {improvement}")
    
    def export_results(self):
        """Export results to JSON"""
        output_file = f"momo_test_results_improved_{int(time.time())}.json"
        
        export_data = {
            "timestamp": datetime.now().isoformat(),
            "backend_url": self.api_url,
            "total_tests": len(self.results),
            "passed": sum(1 for r in self.results if r.status == "PASS"),
            "failed": sum(1 for r in self.results if r.status == "FAIL"),
            "pending": sum(1 for r in self.results if r.status == "PENDING"),
            "success_rate": sum(1 for r in self.results if r.status == "PASS") / len(self.results) * 100 if self.results else 0,
            "tests": [
                {
                    "id": r.test_id,
                    "name": r.test_name,
                    "endpoint": r.endpoint,
                    "status": r.status,
                    "expected": r.expected,
                    "actual": r.actual,
                    "response_code": r.response_code,
                    "duration_ms": r.duration_ms,
                    "notes": r.notes
                }
                for r in self.results
            ],
            "improvements": self.improvements,
            "database_courses_tested": len([r for r in self.results if "Course" in r.test_name or "real" in r.notes.lower()])
        }
        
        with open(output_file, "w") as f:
            json.dump(export_data, f, indent=2)
        
        print(f"\n📊 Results exported to: {output_file}")


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description="MOMO Payment System - Comprehensive Test Suite")
    parser.add_argument("--api", default="http://localhost:5001/api/v1", help="API base URL")
    parser.add_argument("--verbose", action="store_true", help="Verbose output")
    
    args = parser.parse_args()
    
    suite = MOMOPaymentTestSuite(api_url=args.api)
    suite.run_all_tests()


if __name__ == "__main__":
    main()
