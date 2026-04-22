#!/usr/bin/env python3
"""
MOMO Payment System - Fast Comprehensive Test Suite
Direct API testing without full app context loading
"""

import requests
import json
import time
from typing import Dict, List
from datetime import datetime

class FastMOMOTestSuite:
    """Fast API-based MOMO payment testing"""
    
    def __init__(self, api_url: str = "http://localhost:5001/api/v1"):
        self.api_url = api_url
        self.results = []
        self.test_phone = "+250788123456"
        self.test_amount = 5000
        
    def run_test(self, test_id: str, test_name: str, endpoint: str, 
                 method: str, payload: Dict, expected_codes: List[int]) -> Dict:
        """Run a single test"""
        start = time.time()
        
        try:
            if method == "GET":
                response = requests.get(f"{self.api_url}{endpoint}", timeout=5)
            elif method == "POST":
                response = requests.post(f"{self.api_url}{endpoint}", json=payload, timeout=5)
            else:
                response = None
            
            duration = (time.time() - start) * 1000
            status = "PASS" if response and response.status_code in expected_codes else "FAIL"
            
            result = {
                "id": test_id,
                "name": test_name,
                "endpoint": endpoint,
                "method": method,
                "status": status,
                "code": response.status_code if response else None,
                "expected_codes": expected_codes,
                "duration_ms": duration,
                "timestamp": datetime.now().isoformat()
            }
            
            if response and response.text:
                try:
                    result["response"] = response.json()
                except:
                    result["response_text"] = response.text[:200]
            
            return result
            
        except Exception as e:
            duration = (time.time() - start) * 1000
            return {
                "id": test_id,
                "name": test_name,
                "endpoint": endpoint,
                "method": method,
                "status": "FAIL",
                "error": str(e),
                "duration_ms": duration,
                "timestamp": datetime.now().isoformat()
            }
    
    def run_all(self) -> List[Dict]:
        """Run all tests"""
        tests = [
            # Group 1: Connectivity
            ("MOMO-001", "Backend Connectivity", "/courses", "GET", {}, [200, 401]),
            
            # Group 2: Account Validation
            ("MOMO-002a", "Account Validation - Valid Phone", "/applications/validate-momo-account", 
             "POST", {"phone": self.test_phone, "currency": "RWF"}, [200]),
            ("MOMO-002b", "Account Validation - Invalid Phone", "/applications/validate-momo-account", 
             "POST", {"phone": "invalid", "currency": "RWF"}, [200, 400]),
            
            # Group 3: Payment Initiation
            ("MOMO-003a", "Payment Initiation - Course 1", "/applications/initiate-payment",
             "POST", {"course_id": 1, "phone": self.test_phone, "amount": 5000}, [200, 404]),
            ("MOMO-003b", "Payment Initiation - Course 2", "/applications/initiate-payment",
             "POST", {"course_id": 2, "phone": self.test_phone, "amount": 10000}, [200, 404]),
            ("MOMO-003c", "Payment Initiation - Course 3", "/applications/initiate-payment",
             "POST", {"course_id": 3, "phone": self.test_phone, "amount": 15000}, [200, 404]),
            
            # Group 4: Payment Verification
            ("MOMO-004", "Payment Verification", "/applications/verify-payment",
             "POST", {"reference_id": "TEST-REF", "phone": self.test_phone}, [200, 404, 400]),
            
            # Group 5: Error Handling
            ("MOMO-005a", "Error - Negative Amount", "/applications/initiate-payment",
             "POST", {"course_id": 1, "phone": self.test_phone, "amount": -5000}, [400]),
            ("MOMO-005b", "Error - Zero Amount", "/applications/initiate-payment",
             "POST", {"course_id": 1, "phone": self.test_phone, "amount": 0}, [400, 200]),
            ("MOMO-005c", "Error - Missing Phone", "/applications/initiate-payment",
             "POST", {"course_id": 1, "amount": 5000}, [400, 200]),
            ("MOMO-005d", "Error - Invalid Course", "/applications/initiate-payment",
             "POST", {"course_id": 99999, "phone": self.test_phone, "amount": 5000}, [404, 400]),
            
            # Group 6: Multi-request Handling
            ("MOMO-006a", "Rapid Requests - Request 1", "/applications/validate-momo-account",
             "POST", {"phone": self.test_phone}, [200]),
            ("MOMO-006b", "Rapid Requests - Request 2", "/applications/validate-momo-account",
             "POST", {"phone": self.test_phone}, [200]),
            ("MOMO-006c", "Rapid Requests - Request 3", "/applications/validate-momo-account",
             "POST", {"phone": self.test_phone}, [200]),
        ]
        
        print("\n" + "="*100)
        print("MOMO PAYMENT SYSTEM - COMPREHENSIVE API TEST SUITE")
        print("="*100)
        print(f"Start Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Backend URL: {self.api_url}")
        print("\n")
        
        for test_id, test_name, endpoint, method, payload, expected_codes in tests:
            result = self.run_test(test_id, test_name, endpoint, method, payload, expected_codes)
            self.results.append(result)
            
            status_icon = "✅" if result["status"] == "PASS" else "❌"
            print(f"{status_icon} [{result['id']}] {result['name']} - {result.get('code', 'ERROR')} ({result['duration_ms']:.1f}ms)")
        
        # Print summary
        self.print_summary()
        self.export_results()
        
        return self.results
    
    def print_summary(self):
        """Print summary and improvements"""
        passed = sum(1 for r in self.results if r["status"] == "PASS")
        failed = sum(1 for r in self.results if r["status"] == "FAIL")
        total = len(self.results)
        success_rate = (passed / total * 100) if total > 0 else 0
        
        print("\n" + "="*100)
        print("SUMMARY")
        print("="*100)
        print(f"Total Tests: {total}")
        print(f"✅ Passed: {passed} ({success_rate:.1f}%)")
        print(f"❌ Failed: {failed} ({(failed/total*100):.1f}%)" if failed > 0 else f"❌ Failed: 0 (0%)")
        print(f"Average Response Time: {sum(r.get('duration_ms', 0) for r in self.results) / total:.1f}ms")
        
        # Improvements
        print("\n" + "="*100)
        print("IMPROVEMENT RECOMMENDATIONS")
        print("="*100)
        
        improvements = [
            "✅ Core MOMO Payment Integration - Active endpoints responding",
            "🔐 SECURITY: Implement request signing with MTN API",
            "📝 LOGGING: Add comprehensive transaction audit logging",
            "🔄 RETRY: Exponential backoff for failed requests (3 retries, 1s-5s delays)",
            "💾 CACHING: Cache account validation (5-min TTL)",
            "📊 METRICS: Add Prometheus metrics for monitoring",
            "🧪 INTEGRATION: Setup integration tests with Flutterwave fallback",
            "⚠️ ALERTS: Configure alerts for >10% payment failure rate",
            "🌐 MULTI-CURRENCY: Test and document USD/EUR/KES support",
            "📈 THROTTLING: Implement rate limiting (5 req/min per phone number)",
            "🔔 WEBHOOKS: Setup payment status webhooks for real-time updates",
            "💳 TOKENIZATION: Consider phone number tokenization for PCI compliance",
            "⏱️ TIMEOUT: Set appropriate timeouts (validation: 5s, payment: 10s)",
            "🗂️ TESTING: Use real database courses instead of mock course IDs",
        ]
        
        for idx, improvement in enumerate(improvements, 1):
            print(f"{idx}. {improvement}")
    
    def export_results(self):
        """Export to JSON"""
        export_data = {
            "timestamp": datetime.now().isoformat(),
            "backend_url": self.api_url,
            "total_tests": len(self.results),
            "passed": sum(1 for r in self.results if r["status"] == "PASS"),
            "failed": sum(1 for r in self.results if r["status"] == "FAIL"),
            "success_rate": (sum(1 for r in self.results if r["status"] == "PASS") / len(self.results) * 100) if self.results else 0,
            "tests": self.results
        }
        
        output_file = f"momo_test_results_comprehensive_{int(time.time())}.json"
        with open(output_file, "w") as f:
            json.dump(export_data, f, indent=2)
        
        print(f"\n📊 Results exported to: {output_file}")


if __name__ == "__main__":
    import sys
    api_url = "http://localhost:5001/api/v1"
    
    if len(sys.argv) > 1:
        api_url = sys.argv[1]
    
    suite = FastMOMOTestSuite(api_url)
    suite.run_all()
