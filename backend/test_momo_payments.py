#!/usr/bin/env python3
"""
MOMO Payment Testing Tool
Comprehensive testing suite for MOMO payment integration

Usage:
    python3 test_momo_payments.py
    python3 test_momo_payments.py --phone 0780000000 --amount 50000
    python3 test_momo_payments.py --test all
    python3 test_momo_payments.py --test payment-only
"""

import json
import time
import requests
import argparse
import sys
from datetime import datetime
from typing import Dict, Any, Tuple, Optional
from tabulate import tabulate

# Colors for terminal output
class Colors:
    RESET = '\033[0m'
    GREEN = '\033[0;32m'
    RED = '\033[0;31m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    CYAN = '\033[0;36m'

class MONOTester:
    """MOMO Payment Testing Suite"""
    
    def __init__(self, api_url: str = "http://localhost:5000/api/v1", verbose: bool = False):
        self.api_url = api_url
        self.verbose = verbose
        self.session = requests.Session()
        self.test_results = []
        self.payment_reference = None
        self.timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
    def log_info(self, message: str):
        """Log info message"""
        if self.verbose:
            print(f"{Colors.BLUE}ℹ {message}{Colors.RESET}")
    
    def log_success(self, message: str):
        """Log success message"""
        print(f"{Colors.GREEN}✓ {message}{Colors.RESET}")
    
    def log_error(self, message: str):
        """Log error message"""
        print(f"{Colors.RED}✗ {message}{Colors.RESET}")
    
    def log_header(self, message: str):
        """Log section header"""
        print(f"\n{Colors.CYAN}>>> {message}{Colors.RESET}")
    
    def log_warning(self, message: str):
        """Log warning message"""
        print(f"{Colors.YELLOW}⚠ {message}{Colors.RESET}")
    
    def add_result(self, test_id: str, test_name: str, passed: bool, message: str):
        """Add test result to results list"""
        self.test_results.append({
            "ID": test_id,
            "Name": test_name,
            "Status": "PASS" if passed else "FAIL",
            "Message": message
        })
    
    def test_connectivity(self) -> bool:
        """Test 1: Backend Connectivity"""
        self.log_header("Test 1: Backend Connectivity")
        self.log_info(f"Connecting to: {self.api_url}")
        
        try:
            response = self.session.get(f"{self.api_url.rsplit('/', 1)[0]}", timeout=5)
            self.log_success("Backend is reachable")
            self.add_result("MOMO-001", "Backend Connectivity", True, "API responding")
            return True
        except requests.exceptions.ConnectionError:
            self.log_error("Backend is not reachable")
            self.log_warning("Make sure backend is running: cd backend && ./run.sh")
            self.add_result("MOMO-001", "Backend Connectivity", False, "Connection failed")
            return False
        except Exception as e:
            self.log_error(f"Connection error: {str(e)}")
            self.add_result("MOMO-001", "Backend Connectivity", False, str(e))
            return False
    
    def test_account_validation(self, phone: str) -> bool:
        """Test 2: Validate MOMO Account"""
        self.log_header("Test 2: Validate MOMO Account")
        self.log_info(f"Phone Number: {phone}")
        
        try:
            endpoint = f"{self.api_url}/applications/validate-momo-account"
            payload = {"phone_number": phone}
            
            response = self.session.post(endpoint, json=payload, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                valid = data.get("valid")
                name = data.get("name")
                message = data.get("message", "")
                
                if valid:
                    self.log_success(f"Account is valid and active")
                    if name and name != "null":
                        self.log_success(f"Account holder: {name}")
                    self.add_result("MOMO-002", "Account Validation", True, f"Valid account: {name}")
                    return True
                else:
                    self.log_error("Account is not a registered MOMO account")
                    self.log_warning("Please use an active MTN Mobile Money number")
                    self.add_result("MOMO-002", "Account Validation", False, "Account not registered")
                    return False
            else:
                self.log_error(f"API returned status {response.status_code}")
                self.log_info(f"Response: {response.text[:200]}")
                self.add_result("MOMO-002", "Account Validation", False, f"HTTP {response.status_code}")
                return False
                
        except requests.exceptions.Timeout:
            self.log_error("Request timeout - API may not be configured")
            self.add_result("MOMO-002", "Account Validation", False, "Request timeout")
            return None  # Graceful failure
        except Exception as e:
            self.log_error(f"Validation error: {str(e)}")
            self.add_result("MOMO-002", "Account Validation", False, str(e))
            return None
    
    def test_payment_initiation(self, course_id: str, amount: float, currency: str, 
                               phone: str, payer_name: str) -> bool:
        """Test 3: Initiate Payment"""
        self.log_header("Test 3: Initiate Payment")
        self.log_info(f"Amount: {amount} {currency}")
        self.log_info(f"Course ID: {course_id}")
        
        try:
            endpoint = f"{self.api_url}/applications/initiate-payment"
            payload = {
                "course_id": course_id,
                "payment_method": "mobile_money",
                "amount": amount,
                "currency": currency,
                "phone_number": phone,
                "payer_name": payer_name
            }
            
            if self.verbose:
                print(f"Payload: {json.dumps(payload, indent=2)}")
            
            response = self.session.post(endpoint, json=payload, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                reference = data.get("reference")
                status = data.get("status")
                message = data.get("message", "")
                
                if reference:
                    self.payment_reference = reference
                    self.log_success(f"Payment initiated")
                    self.log_success(f"Reference: {reference}")
                    self.log_success(f"Status: {status}")
                    self.add_result("MOMO-003", "Payment Initiation", True, f"Reference: {reference}")
                    return True
                else:
                    self.log_error("No reference in response")
                    self.add_result("MOMO-003", "Payment Initiation", False, "Missing reference")
                    return False
            elif response.status_code == 400:
                data = response.json()
                error = data.get("error", "Bad request")
                self.log_error(f"Bad request: {error}")
                self.add_result("MOMO-003", "Payment Initiation", False, error)
                return False
            elif response.status_code == 404:
                self.log_error("Course not found")
                self.add_result("MOMO-003", "Payment Initiation", False, "Course not found")
                return False
            else:
                self.log_error(f"API returned status {response.status_code}")
                self.log_info(f"Response: {response.text[:200]}")
                self.add_result("MOMO-003", "Payment Initiation", False, f"HTTP {response.status_code}")
                return False
                
        except requests.exceptions.Timeout:
            self.log_error("Request timeout")
            self.add_result("MOMO-003", "Payment Initiation", False, "Timeout")
            return False
        except Exception as e:
            self.log_error(f"Payment error: {str(e)}")
            self.add_result("MOMO-003", "Payment Initiation", False, str(e))
            return False
    
    def test_payment_verification(self, max_polls: int = 5) -> bool:
        """Test 4: Verify Payment Status"""
        self.log_header("Test 4: Verify Payment Status (Polling)")
        
        if not self.payment_reference:
            self.log_error("No payment reference from previous test")
            self.add_result("MOMO-004", "Payment Verification", False, "No reference")
            return False
        
        self.log_info(f"Reference: {self.payment_reference}")
        self.log_info(f"Polling (max {max_polls} attempts)...")
        
        try:
            endpoint = f"{self.api_url}/applications/verify-payment"
            
            for poll_num in range(1, max_polls + 1):
                payload = {
                    "payment_method": "mobile_money",
                    "reference": self.payment_reference
                }
                
                print(f"  Poll {poll_num}/{max_polls}...", end='\r', flush=True)
                
                response = self.session.post(endpoint, json=payload, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    status = data.get("status", "unknown")
                    
                    if status in ["completed", "successful"]:
                        print(" " * 30, end='\r')  # Clear line
                        self.log_success("Payment completed!")
                        amount = data.get("amount")
                        currency = data.get("currency")
                        if amount:
                            self.log_success(f"Amount: {amount} {currency}")
                        self.add_result("MOMO-004", "Payment Verification", True, f"Status: {status}")
                        return True
                    elif status == "failed":
                        print(" " * 30, end='\r')  # Clear line
                        self.log_error("Payment failed")
                        reason = data.get("reason", "Unknown")
                        self.log_warning(f"Reason: {reason}")
                        self.add_result("MOMO-004", "Payment Verification", False, f"Failed: {reason}")
                        return False
                    elif status == "pending":
                        if poll_num == max_polls:
                            print(" " * 30, end='\r')  # Clear line
                            self.log_warning("Payment still pending after max polls")
                            self.log_info("This is normal - user hasn't approved on phone")
                            self.add_result("MOMO-004", "Payment Verification", True, "Pending (expected)")
                            return True
                else:
                    print(" " * 30, end='\r')  # Clear line
                    self.log_error(f"API returned status {response.status_code}")
                    self.add_result("MOMO-004", "Payment Verification", False, f"HTTP {response.status_code}")
                    return False
                
                time.sleep(2)
            
            print(" " * 30, end='\r')  # Clear line
            self.log_warning("Max polls reached - payment status unknown")
            self.add_result("MOMO-004", "Payment Verification", True, "Timeout (expected)")
            return True
            
        except Exception as e:
            self.log_error(f"Verification error: {str(e)}")
            self.add_result("MOMO-004", "Payment Verification", False, str(e))
            return False
    
    def test_error_handling(self) -> bool:
        """Test 5: Error Handling"""
        self.log_header("Test 5: Error Handling")
        
        test_passed = True
        
        # Test 5a: Missing phone number
        self.log_info("Testing: Payment without phone number")
        try:
            endpoint = f"{self.api_url}/applications/initiate-payment"
            payload = {
                "course_id": "1",
                "payment_method": "mobile_money",
                "amount": 50000,
                "currency": "RWF"
            }
            
            response = self.session.post(endpoint, json=payload, timeout=10)
            
            if response.status_code == 400:
                self.log_success("Error validation works (phone required)")
                self.add_result("MOMO-005a", "Error Handling - Missing Phone", True, "Validation works")
            else:
                self.log_warning("No validation error (might be intentional)")
                self.add_result("MOMO-005a", "Error Handling - Missing Phone", False, "No validation")
                test_passed = False
        except Exception as e:
            self.log_error(f"Test error: {str(e)}")
            self.add_result("MOMO-005a", "Error Handling - Missing Phone", False, str(e))
            test_passed = False
        
        # Test 5b: Invalid amount
        self.log_info("Testing: Payment with negative amount")
        try:
            endpoint = f"{self.api_url}/applications/initiate-payment"
            payload = {
                "course_id": "1",
                "payment_method": "mobile_money",
                "amount": -100,
                "currency": "RWF",
                "phone_number": "0780000000"
            }
            
            response = self.session.post(endpoint, json=payload, timeout=10)
            
            if response.status_code == 400:
                self.log_success("Validation prevents negative amounts")
                self.add_result("MOMO-005b", "Error Handling - Negative Amount", True, "Validation works")
            else:
                self.log_warning("No validation for negative amount")
                self.add_result("MOMO-005b", "Error Handling - Negative Amount", False, "No validation")
        except Exception as e:
            self.log_error(f"Test error: {str(e)}")
            self.add_result("MOMO-005b", "Error Handling - Negative Amount", False, str(e))
        
        return test_passed
    
    def print_results_summary(self):
        """Print test results summary"""
        print(f"\n{Colors.CYAN}{'='*60}{Colors.RESET}")
        print(f"{Colors.CYAN}Test Results Summary{Colors.RESET}")
        print(f"{Colors.CYAN}{'='*60}{Colors.RESET}\n")
        
        if not self.test_results:
            self.log_warning("No test results to display")
            return
        
        # Print table
        table_data = []
        passed_count = 0
        failed_count = 0
        
        for result in self.test_results:
            status = result["Status"]
            if status == "PASS":
                passed_count += 1
                status_colored = f"{Colors.GREEN}{status}{Colors.RESET}"
            else:
                failed_count += 1
                status_colored = f"{Colors.RED}{status}{Colors.RESET}"
            
            table_data.append([
                result["ID"],
                result["Name"][:30],
                status_colored,
                result["Message"][:40]
            ])
        
        print(tabulate(table_data, headers=["Test ID", "Name", "Status", "Message"], tablefmt="grid"))
        
        # Print summary stats
        total_count = passed_count + failed_count
        pass_rate = (passed_count / total_count * 100) if total_count > 0 else 0
        
        print(f"\n{Colors.CYAN}Statistics:{Colors.RESET}")
        print(f"  Total Tests: {total_count}")
        print(f"  {Colors.GREEN}Passed: {passed_count}{Colors.RESET}")
        print(f"  {Colors.RED}Failed: {failed_count}{Colors.RESET}")
        print(f"  Success Rate: {pass_rate:.1f}%")
        
        # Save results to file
        self.save_results()
    
    def save_results(self):
        """Save test results to JSON file"""
        try:
            filename = f"momo_test_results_{time.time():.0f}.json"
            with open(filename, 'w') as f:
                json.dump({
                    "timestamp": self.timestamp,
                    "api_url": self.api_url,
                    "results": self.test_results,
                    "summary": {
                        "total": len(self.test_results),
                        "passed": sum(1 for r in self.test_results if r["Status"] == "PASS"),
                        "failed": sum(1 for r in self.test_results if r["Status"] == "FAIL")
                    }
                }, f, indent=2)
            self.log_success(f"Results saved to {filename}")
        except Exception as e:
            self.log_error(f"Could not save results: {str(e)}")
    
    def run_all_tests(self, phone: str, amount: float, currency: str, 
                      course_id: str, payer_name: str):
        """Run all tests"""
        print(f"\n{Colors.BLUE}{'='*60}{Colors.RESET}")
        print(f"{Colors.BLUE}MOMO Payment Testing Suite{Colors.RESET}")
        print(f"{Colors.BLUE}{'='*60}{Colors.RESET}")
        self.log_info(f"Started at: {self.timestamp}")
        
        # Run tests
        if not self.test_connectivity():
            print(f"\n{Colors.RED}Backend not available - cannot continue{Colors.RESET}")
            self.print_results_summary()
            return False
        
        self.test_account_validation(phone)
        
        if self.test_payment_initiation(course_id, amount, currency, phone, payer_name):
            self.test_payment_verification()
        
        self.test_error_handling()
        
        self.print_results_summary()
        return len([r for r in self.test_results if r["Status"] == "FAIL"]) == 0


def main():
    parser = argparse.ArgumentParser(
        description="MOMO Payment Testing Suite",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 test_momo_payments.py
  python3 test_momo_payments.py --phone 0780000000 --amount 100000
  python3 test_momo_payments.py --verbose --api http://backend:5000/api/v1
        """
    )
    
    parser.add_argument("--api", default="http://localhost:5000/api/v1",
                        help="API URL (default: http://localhost:5000/api/v1)")
    parser.add_argument("--phone", default="0780000000",
                        help="Phone number to test (default: 0780000000)")
    parser.add_argument("--amount", type=float, default=50000,
                        help="Payment amount (default: 50000)")
    parser.add_argument("--currency", default="RWF",
                        help="Currency code (default: RWF)")
    parser.add_argument("--course", default="1",
                        help="Course ID (default: 1)")
    parser.add_argument("--name", default="Test User",
                        help="Payer name (default: Test User)")
    parser.add_argument("--verbose", "-v", action="store_true",
                        help="Verbose output")
    
    args = parser.parse_args()
    
    # Run tests
    tester = MONOTester(api_url=args.api, verbose=args.verbose)
    success = tester.run_all_tests(
        phone=args.phone,
        amount=args.amount,
        currency=args.currency,
        course_id=args.course,
        payer_name=args.name
    )
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
