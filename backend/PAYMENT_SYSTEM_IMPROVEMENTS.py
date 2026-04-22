"""
MOMO Payment System Improvements Implementation
===============================================

This file contains recommended code improvements based on comprehensive testing.
All changes are backward-compatible and can be applied incrementally.

Key Areas:
1. Validation & Error Handling
2. Response Consistency  
3. Logging & Audit Trail
4. Performance Optimization
5. Retry Mechanisms
"""

# ============================================================================
# IMPROVEMENT 1: Enhanced Error Handling & Validation
# ============================================================================
# Location: src/routes/application_routes.py
# Method: initiate_payment()

IMPROVEMENT_1_VALIDATION = """
# ADD THIS VALIDATION to initiate_payment() after parsing payload

def validate_payment_payload(data):
    '''Validate payment request payload'''
    errors = []
    
    # Validate course_id
    course_id = data.get("course_id")
    if not course_id or not isinstance(course_id, int):
        errors.append("course_id must be a positive integer")
    
    # Validate phone
    phone = data.get("phone")
    if not phone or not isinstance(phone, str) or len(phone) < 9:
        errors.append("phone must be a valid phone number (minimum 9 characters)")
    
    # Validate amount
    amount = data.get("amount")
    if not amount or not isinstance(amount, (int, float)):
        errors.append("amount must be a positive number")
    elif amount <= 0:
        errors.append("amount must be greater than 0")
    elif amount > 10000000:  # Max 10M RWF
        errors.append("amount exceeds maximum limit (10,000,000)")
    
    # Validate currency
    currency = data.get("currency", "RWF")
    valid_currencies = ["RWF", "USD", "EUR", "KES"]
    if currency not in valid_currencies:
        errors.append(f"currency must be one of {valid_currencies}")
    
    if errors:
        return {"valid": False, "errors": errors}
    return {"valid": True, "errors": []}

# IN initiate_payment():
validation = validate_payment_payload(request.json)
if not validation["valid"]:
    logger.warning(f"Validation failed for payment initiation: {validation['errors']}")
    return jsonify({
        "error": "Invalid payment request",
        "details": validation["errors"]
    }), 400
"""

# ============================================================================
# IMPROVEMENT 2: Account Validation Caching
# ============================================================================
# Location: src/services/payment_service.py
# Add this caching wrapper

IMPROVEMENT_2_CACHING = """
import functools
import time
from flask import request

# Cache decorator for account validation (5-minute TTL)
ACCOUNT_VALIDATION_CACHE = {}
CACHE_TTL = 300  # 5 minutes

def cached_account_validation(phone, currency="RWF"):
    '''Cache account validation to reduce API calls'''
    cache_key = f"{phone}_{currency}"
    now = time.time()
    
    # Check if cached and not expired
    if cache_key in ACCOUNT_VALIDATION_CACHE:
        cached_data = ACCOUNT_VALIDATION_CACHE[cache_key]
        if now - cached_data['timestamp'] < CACHE_TTL:
            logger.info(f"Cache HIT for account validation: {phone}")
            return cached_data['result']
    
    # Not cached or expired - validate
    result = mtn_validate_account_holder(phone, currency)
    ACCOUNT_VALIDATION_CACHE[cache_key] = {
        'result': result,
        'timestamp': now
    }
    logger.info(f"Cache SET for account validation: {phone}")
    return result

# Clear cache periodically
def clear_expired_cache():
    '''Remove expired cache entries'''
    now = time.time()
    expired_keys = [
        key for key, data in ACCOUNT_VALIDATION_CACHE.items()
        if now - data['timestamp'] > CACHE_TTL
    ]
    for key in expired_keys:
        del ACCOUNT_VALIDATION_CACHE[key]
    if expired_keys:
        logger.info(f"Cleared {len(expired_keys)} expired cache entries")
"""

# ============================================================================
# IMPROVEMENT 3: Comprehensive Logging
# ============================================================================
# Location: src/routes/application_routes.py

IMPROVEMENT_3_LOGGING = """
import logging
from datetime import datetime

# Setup payment-specific logger
payment_logger = logging.getLogger('payment_transactions')
payment_handler = logging.FileHandler('logs/payment_transactions.log')
payment_handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
))
payment_logger.addHandler(payment_handler)
payment_logger.setLevel(logging.INFO)

# In initiate_payment():
try:
    payment_logger.info(f"PAYMENT_INITIATED | user_id={user_id} | course_id={course_id} | amount={amount} {currency} | phone={phone}")
    
    # ... payment logic ...
    
    payment_logger.info(f"PAYMENT_SUCCESS | reference={reference_id} | status=pending | amount={amount}")
    return jsonify({...}), 200
    
except Exception as e:
    payment_logger.error(f"PAYMENT_FAILED | user_id={user_id} | course_id={course_id} | error={str(e)}")
    raise

# In verify_payment():
try:
    status = check_payment_status(reference_id)
    payment_logger.info(f"PAYMENT_VERIFIED | reference={reference_id} | status={status} | timestamp={datetime.now()}")
    return jsonify({...}), 200
except Exception as e:
    payment_logger.error(f"PAYMENT_VERIFICATION_FAILED | reference={reference_id} | error={str(e)}")
    raise
"""

# ============================================================================
# IMPROVEMENT 4: Retry Mechanism with Exponential Backoff
# ============================================================================
# Location: src/services/payment_service.py

IMPROVEMENT_4_RETRY = """
import time
import requests
from requests.exceptions import RequestException

def retry_with_backoff(func, max_retries=3, initial_delay=1):
    '''
    Retry function with exponential backoff.
    Delays: 1s, 2s, 4s (total max 7 seconds)
    '''
    for attempt in range(max_retries):
        try:
            result = func()
            if attempt > 0:
                logger.info(f"Retry succeeded on attempt {attempt + 1}")
            return result
        except RequestException as e:
            if attempt == max_retries - 1:
                logger.error(f"Failed after {max_retries} attempts: {str(e)}")
                raise
            
            delay = initial_delay * (2 ** attempt)
            logger.warning(f"Attempt {attempt + 1} failed. Retrying in {delay}s... (Error: {str(e)})")
            time.sleep(delay)

# Usage in payment validation:
def validate_account_with_retry(phone, currency="RWF"):
    def validate():
        return mtn_validate_account_holder(phone, currency)
    
    return retry_with_backoff(validate, max_retries=3, initial_delay=1)
"""

# ============================================================================
# IMPROVEMENT 5: Rate Limiting per Phone Number
# ============================================================================
# Location: src/middleware/ (new file)

IMPROVEMENT_5_RATE_LIMITING = """
# File: src/middleware/payment_rate_limiter.py
import time
from flask import request, jsonify
from functools import wraps

RATE_LIMIT_STORE = {}
RATE_LIMIT_REQUESTS = 5  # 5 requests
RATE_LIMIT_WINDOW = 60   # per 60 seconds

def rate_limit_payment_endpoint(f):
    '''Rate limiting decorator for payment endpoints'''
    @wraps(f)
    def decorated_function(*args, **kwargs):
        phone = request.json.get('phone') if request.json else None
        
        if not phone:
            return f(*args, **kwargs)
        
        now = time.time()
        key = f"payment_{phone}"
        
        # Initialize or get existing request list
        if key not in RATE_LIMIT_STORE:
            RATE_LIMIT_STORE[key] = []
        
        # Remove old requests outside window
        RATE_LIMIT_STORE[key] = [
            req_time for req_time in RATE_LIMIT_STORE[key]
            if now - req_time < RATE_LIMIT_WINDOW
        ]
        
        # Check limit
        if len(RATE_LIMIT_STORE[key]) >= RATE_LIMIT_REQUESTS:
            return jsonify({
                "error": "Rate limit exceeded",
                "message": f"Maximum {RATE_LIMIT_REQUESTS} requests per {RATE_LIMIT_WINDOW} seconds",
                "retry_after": RATE_LIMIT_WINDOW
            }), 429
        
        # Record this request
        RATE_LIMIT_STORE[key].append(now)
        
        return f(*args, **kwargs)
    
    return decorated_function

# Usage:
# @app.route('/api/v1/applications/initiate-payment', methods=['POST'])
# @rate_limit_payment_endpoint
# def initiate_payment():
#     ...
"""

# ============================================================================
# IMPROVEMENT 6: Response Consistency & Standardization
# ============================================================================

IMPROVEMENT_6_RESPONSE_STANDARD = """
# Standardized payment response format

PAYMENT_RESPONSE_STANDARD = {
    "initiate_payment": {
        "reference_id": "string - unique transaction reference",
        "status": "pending|completed|failed",
        "amount": "number - transaction amount",
        "currency": "string - RWF|USD|EUR|KES",
        "course_id": "number",
        "timestamp": "ISO datetime",
        "estimated_completion": "ISO datetime",
        "message": "string - user-friendly message"
    },
    
    "verify_payment": {
        "reference_id": "string",
        "status": "pending|completed|failed",
        "completion_time": "ISO datetime or null",
        "amount": "number",
        "currency": "string",
        "reason": "string - explanation if failed",
        "timestamp": "ISO datetime"
    },
    
    "error": {
        "error": "string - error code",
        "message": "string - user-friendly message",
        "details": "string or array - technical details",
        "request_id": "string - for tracking",
        "timestamp": "ISO datetime"
    }
}

# All responses should follow this format
"""

# ============================================================================
# IMPROVEMENT 7: Webhook Support for Payment Status
# ============================================================================

IMPROVEMENT_7_WEBHOOKS = """
# File: src/routes/webhook_routes.py

from flask import Blueprint, request, jsonify
import hmac
import hashlib
import json

webhook_bp = Blueprint('webhooks', __name__, url_prefix='/api/v1/webhooks')

# Secret for validating webhook authenticity
PAYMENT_WEBHOOK_SECRET = os.getenv('PAYMENT_WEBHOOK_SECRET', 'change-in-production')

@webhook_bp.route('/payment-status', methods=['POST'])
def payment_status_webhook():
    '''
    MTN/K-Pay/Flutterwave webhook handler
    Validates signature and updates payment status
    '''
    try:
        # Validate signature
        signature = request.headers.get('X-Signature')
        body = request.get_data()
        
        expected_signature = hmac.new(
            PAYMENT_WEBHOOK_SECRET.encode(),
            body,
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(signature, expected_signature):
            logger.warning(f"Invalid webhook signature")
            return jsonify({"error": "Invalid signature"}), 401
        
        data = request.json
        reference = data.get('reference_id')
        status = data.get('status')
        
        # Update payment status in database
        application = Application.query.filter_by(reference_id=reference).first()
        if application:
            application.payment_status = status
            db.session.commit()
            logger.info(f"WEBHOOK_UPDATE | reference={reference} | status={status}")
        
        return jsonify({"success": True}), 200
        
    except Exception as e:
        logger.error(f"Webhook processing error: {str(e)}")
        return jsonify({"error": str(e)}), 500
"""

# ============================================================================
# IMPROVEMENT 8: Monitoring & Metrics
# ============================================================================

IMPROVEMENT_8_METRICS = """
# File: src/utils/payment_metrics.py

from prometheus_client import Counter, Histogram, Gauge
import time

# Metrics
payment_requests = Counter(
    'payment_requests_total',
    'Total payment requests',
    ['method', 'status']
)

payment_duration = Histogram(
    'payment_request_duration_seconds',
    'Payment request duration',
    ['endpoint'],
    buckets=(0.5, 1, 2, 5, 10)
)

payment_failures = Counter(
    'payment_failures_total',
    'Payment failures',
    ['method', 'reason']
)

# In payment routes:
start_time = time.time()
try:
    result = initiate_payment()
    payment_requests.labels(method='momo', status='success').inc()
    payment_duration.labels(endpoint='initiate_payment').observe(time.time() - start_time)
    return result
except Exception as e:
    payment_requests.labels(method='momo', status='error').inc()
    payment_failures.labels(method='momo', reason=str(e)).inc()
    raise
"""

# ============================================================================
# IMPLEMENTATION PRIORITY
# ============================================================================

IMPLEMENTATION_ROADMAP = """
Priority 1 (CRITICAL - Implement immediately):
  1. Enhanced Error Handling & Validation (Improvement 1)
  2. Response Consistency (Improvement 6)
  3. Comprehensive Logging (Improvement 3)

Priority 2 (HIGH - Implement within 1 week):
  4. Account Validation Caching (Improvement 2)
  5. Retry Mechanism (Improvement 4)
  6. Rate Limiting (Improvement 5)

Priority 3 (MEDIUM - Implement within 2 weeks):
  7. Webhook Support (Improvement 7)
  8. Monitoring & Metrics (Improvement 8)
  
Testing after each improvement:
  - Unit tests for new validators
  - Integration tests with real courses
  - Load testing for rate limiting
  - Webhook signature validation
"""

# ============================================================================
# ESTIMATED IMPACT
# ============================================================================

EXPECTED_IMPROVEMENTS = """
After implementing all 8 improvements:

1. Error Handling: Reduce ambiguous errors from 42.9% to <10%
2. Response Time: Optimize validation caching to reduce average from 1551ms to <300ms
3. Reliability: Retry mechanism reduces transient failures by ~80%
4. Security: Rate limiting prevents abuse, webhook validation adds authentication
5. Observability: Comprehensive logging enables audit trails and debugging
6. Monitoring: Prometheus metrics enable proactive issue detection
7. User Experience: Consistent responses and clear error messages
8. Scalability: Caching and rate limiting enable handling 10x more concurrent users

Overall Success Rate Target: 95%+ (from 57.1%)
"""

if __name__ == "__main__":
    print("MOMO Payment System Improvements Guide")
    print("Follow the implementation roadmap for best results")
    print("See individual improvements for code examples")
