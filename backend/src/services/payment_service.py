"""
Payment Service – Afritec Bridge LMS
Supports: PayPal Checkout, Stripe, MTN Mobile Money (MOMO), Bank Transfer
"""

import os
import json
import logging
import base64
import requests
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# ============================================================
# PAYPAL
# ============================================================
PAYPAL_CLIENT_ID = os.environ.get('PAYPAL_CLIENT_ID', '')
PAYPAL_CLIENT_SECRET = os.environ.get('PAYPAL_CLIENT_SECRET', '')
# Support both PAYPAL_MODE and legacy PAYPAL_SANDBOX flag
_paypal_sandbox = os.environ.get('PAYPAL_SANDBOX', 'true').lower() in ('true', '1', 'yes')
PAYPAL_MODE = os.environ.get('PAYPAL_MODE', 'sandbox' if _paypal_sandbox else 'live')

PAYPAL_BASE = (
    'https://api-m.sandbox.paypal.com'
    if PAYPAL_MODE == 'sandbox'
    else 'https://api-m.paypal.com'
)


def _paypal_get_access_token() -> str:
    """Obtain a PayPal OAuth2 access token."""
    if not PAYPAL_CLIENT_ID or not PAYPAL_CLIENT_SECRET:
        raise ValueError("PayPal credentials not configured (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET)")

    credentials = base64.b64encode(
        f"{PAYPAL_CLIENT_ID}:{PAYPAL_CLIENT_SECRET}".encode()
    ).decode()

    resp = requests.post(
        f"{PAYPAL_BASE}/v1/oauth2/token",
        headers={
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data={"grant_type": "client_credentials"},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def paypal_create_order(amount: float, currency: str, return_url: str, cancel_url: str, description: str = "") -> dict:
    """
    Create a PayPal Checkout Order (v2).
    Returns dict with: order_id, approval_url
    """
    token = _paypal_get_access_token()

    payload = {
        "intent": "CAPTURE",
        "purchase_units": [
            {
                "amount": {
                    "currency_code": currency.upper(),
                    "value": f"{amount:.2f}",
                },
                "description": description or "Course Enrollment",
            }
        ],
        "application_context": {
            "return_url": return_url,
            "cancel_url": cancel_url,
            "brand_name": "Afritec Bridge LMS",
            "landing_page": "BILLING",
            "user_action": "PAY_NOW",
        },
    }

    resp = requests.post(
        f"{PAYPAL_BASE}/v2/checkout/orders",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()

    approval_url = next(
        (link["href"] for link in data.get("links", []) if link["rel"] == "approve"),
        None,
    )
    return {"order_id": data["id"], "approval_url": approval_url, "status": data["status"]}


def paypal_capture_order(order_id: str) -> dict:
    """
    Capture an approved PayPal order.
    Returns dict with: status, transaction_id, amount
    """
    token = _paypal_get_access_token()

    resp = requests.post(
        f"{PAYPAL_BASE}/v2/checkout/orders/{order_id}/capture",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()

    # Extract first capture
    capture = None
    for unit in data.get("purchase_units", []):
        captures = unit.get("payments", {}).get("captures", [])
        if captures:
            capture = captures[0]
            break

    status = "completed" if data.get("status") == "COMPLETED" else "failed"
    return {
        "status": status,
        "order_id": order_id,
        "transaction_id": capture["id"] if capture else None,
        "amount": float(capture["amount"]["value"]) if capture else None,
        "currency": capture["amount"]["currency_code"] if capture else None,
        "paypal_status": data.get("status"),
    }


def paypal_get_order(order_id: str) -> dict:
    """Get PayPal order details / status."""
    token = _paypal_get_access_token()
    resp = requests.get(
        f"{PAYPAL_BASE}/v2/checkout/orders/{order_id}",
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


# ============================================================
# STRIPE
# ============================================================
STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY', '')
STRIPE_BASE = 'https://api.stripe.com/v1'


def _stripe_headers():
    if not STRIPE_SECRET_KEY:
        raise ValueError("Stripe credentials not configured (STRIPE_SECRET_KEY)")
    return {"Authorization": f"Bearer {STRIPE_SECRET_KEY}"}


def stripe_create_payment_intent(amount_cents: int, currency: str, metadata: dict = None) -> dict:
    """
    Create a Stripe PaymentIntent.
    amount_cents: amount in smallest currency unit (e.g. cents for USD)
    Returns: client_secret, payment_intent_id
    """
    data = {
        "amount": str(amount_cents),
        "currency": currency.lower(),
        "automatic_payment_methods[enabled]": "true",
    }
    if metadata:
        for k, v in metadata.items():
            data[f"metadata[{k}]"] = str(v)

    resp = requests.post(
        f"{STRIPE_BASE}/payment_intents",
        headers=_stripe_headers(),
        data=data,
        timeout=15,
    )
    resp.raise_for_status()
    pi = resp.json()
    return {
        "payment_intent_id": pi["id"],
        "client_secret": pi["client_secret"],
        "status": pi["status"],
        "amount": pi["amount"],
        "currency": pi["currency"],
    }


def stripe_retrieve_payment_intent(payment_intent_id: str) -> dict:
    """Retrieve a Stripe PaymentIntent to check status."""
    resp = requests.get(
        f"{STRIPE_BASE}/payment_intents/{payment_intent_id}",
        headers=_stripe_headers(),
        timeout=15,
    )
    resp.raise_for_status()
    pi = resp.json()
    return {
        "payment_intent_id": pi["id"],
        "status": pi["status"],  # succeeded / requires_payment_method / etc.
        "amount": pi["amount"],
        "currency": pi["currency"],
    }


def stripe_create_checkout_session(
    amount_cents: int,
    currency: str,
    success_url: str,
    cancel_url: str,
    description: str = "",
    metadata: dict = None,
) -> dict:
    """
    Create a Stripe Checkout Session (hosted payment page).
    Returns: session_id, checkout_url
    """
    data = {
        "mode": "payment",
        "success_url": success_url,
        "cancel_url": cancel_url,
        "line_items[0][price_data][currency]": currency.lower(),
        "line_items[0][price_data][unit_amount]": str(amount_cents),
        "line_items[0][price_data][product_data][name]": description or "Course Enrollment",
        "line_items[0][quantity]": "1",
    }
    if metadata:
        for k, v in metadata.items():
            data[f"metadata[{k}]"] = str(v)

    resp = requests.post(
        f"{STRIPE_BASE}/checkout/sessions",
        headers=_stripe_headers(),
        data=data,
        timeout=15,
    )
    resp.raise_for_status()
    session = resp.json()
    return {
        "session_id": session["id"],
        "checkout_url": session["url"],
        "status": session["status"],
    }


def stripe_retrieve_checkout_session(session_id: str) -> dict:
    """Check a Stripe Checkout Session status."""
    resp = requests.get(
        f"{STRIPE_BASE}/checkout/sessions/{session_id}",
        headers=_stripe_headers(),
        timeout=15,
    )
    resp.raise_for_status()
    session = resp.json()
    return {
        "session_id": session["id"],
        "status": session["status"],          # open / complete / expired
        "payment_status": session.get("payment_status"),  # paid / unpaid
        "amount_total": session.get("amount_total"),
        "currency": session.get("currency"),
    }


# ============================================================
# MTN MOBILE MONEY (MOMO)
# Supports both MTN MADAPI (api.mtn.com) and MoMo Developer (momodeveloper.mtn.com)
# ============================================================
# MoMo Developer API vars (momodeveloper.mtn.com)
# Used for: RequesttoPay (when MADAPI not set), ValidateAccountHolderStatus,
#           GetBasicUserinfo, GetAccountBalance, DeliveryNotification
MTN_COLLECTION_USER_ID = os.environ.get('MTN_COLLECTION_USER_ID', '')
MTN_COLLECTION_API_KEY = os.environ.get('MTN_COLLECTION_API_KEY', '')
MTN_SUBSCRIPTION_KEY = os.environ.get('MTN_SUBSCRIPTION_KEY', '')
MTN_BASE = os.environ.get('MTN_API_BASE', 'https://sandbox.momodeveloper.mtn.com')
# X-Target-Environment header value. Common values:
#   sandbox      – testing  (momodeveloper.mtn.com)
#   mtnrwanda    – Rwanda production
#   mtnuganda    – Uganda production
#   mtnghana     – Ghana production
MTN_ENV = os.environ.get('MTN_ENV', 'sandbox')

# MTN MADAPI vars (api.mtn.com) – Rwanda production primary
MTN_MADAPI_CLIENT_ID = os.environ.get('MTN_CLIENT_ID', '')
MTN_MADAPI_CLIENT_SECRET = os.environ.get('MTN_CLIENT_SECRET', '')
MTN_COUNTRY_CODE = os.environ.get('MTN_COUNTRY_CODE', 'RW')
MTN_MADAPI_BASE = 'https://api.mtn.com/v1'

# Use MADAPI for RequesttoPay / CheckStatus when its credentials are the only ones set
_use_madapi = bool(MTN_MADAPI_CLIENT_ID) and not bool(MTN_COLLECTION_USER_ID)

# MoMo Developer API is available for the enrichment endpoints
# (validate, userinfo, balance, delivery notification) whenever its 3 credentials are set,
# even if MADAPI is used for the main payment flow.
_momo_dev_available = bool(MTN_COLLECTION_USER_ID) and bool(MTN_COLLECTION_API_KEY) and bool(MTN_SUBSCRIPTION_KEY)

# ------------------------------------------------------------
# Simple in-memory token cache (token expires in 3600s per API docs)
# Avoids fetching a new token on every single API call.
# ------------------------------------------------------------
import time as _time
_token_cache: dict = {}  # key: 'madapi' | 'momodev'  → {'token': str, 'expires_at': float}


def _get_cached_token(cache_key: str) -> str | None:
    entry = _token_cache.get(cache_key)
    if entry and _time.time() < entry['expires_at']:
        return entry['token']
    return None


def _set_cached_token(cache_key: str, token: str, ttl_seconds: int = 3540) -> None:
    """Store token with a 60-second safety margin before the 3600s expiry."""
    _token_cache[cache_key] = {'token': token, 'expires_at': _time.time() + ttl_seconds}


def _mtn_get_access_token(force_momo_dev: bool = False) -> str:
    """Get MTN access token – supports both MADAPI and MoMo Developer API.

    force_momo_dev: When True, always returns a MoMo Developer API token
                   (used by enrichment-only endpoints on momodeveloper.mtn.com
                   even when MADAPI handles the primary payment flow).
    Tokens are cached in-memory for 3540 s (60 s safety margin before 3600 s expiry).
    """
    if _use_madapi and not force_momo_dev:
        cache_key = 'madapi'
        cached = _get_cached_token(cache_key)
        if cached:
            return cached
        # MTN MADAPI OAuth2
        credentials = base64.b64encode(
            f"{MTN_MADAPI_CLIENT_ID}:{MTN_MADAPI_CLIENT_SECRET}".encode()
        ).decode()
        resp = requests.post(
            f"{MTN_MADAPI_BASE}/oauth/access_token",
            headers={
                "Authorization": f"Basic {credentials}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={"grant_type": "client_credentials"},
            timeout=15,
        )
        resp.raise_for_status()
        token = resp.json()["access_token"]
        _set_cached_token(cache_key, token)
        return token
    else:
        cache_key = 'momodev'
        cached = _get_cached_token(cache_key)
        if cached:
            return cached
        # MoMo Developer API – Basic auth with userId:apiKey
        # Docs: POST /collection/token/  at sandbox.momodeveloper.mtn.com
        if not MTN_COLLECTION_USER_ID or not MTN_COLLECTION_API_KEY:
            raise ValueError(
                "MTN MoMo Developer API credentials not configured. "
                "Set MTN_COLLECTION_USER_ID, MTN_COLLECTION_API_KEY, MTN_SUBSCRIPTION_KEY in .env. "
                "See backend/.env for setup instructions."
            )
        credentials = base64.b64encode(
            f"{MTN_COLLECTION_USER_ID}:{MTN_COLLECTION_API_KEY}".encode()
        ).decode()
        resp = requests.post(
            f"{MTN_BASE}/collection/token/",
            headers={
                "Authorization": f"Basic {credentials}",
                "Ocp-Apim-Subscription-Key": MTN_SUBSCRIPTION_KEY,
                "Content-Type": "application/json",
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        token = data["access_token"]
        ttl = int(data.get("expires_in", 3600)) - 60  # honour API-returned TTL minus 60 s margin
        _set_cached_token(cache_key, token, max(ttl, 60))
        return token


def mtn_request_to_pay(
    amount: float,
    currency: str,
    phone_number: str,
    external_id: str,
    payer_message: str = "Course Payment",
    payee_note: str = "Afritec Bridge LMS",
) -> dict:
    """
    Initiate MTN MoMo Request-to-Pay.
    phone_number: MSISDN without '+', e.g. '256700000000'
    Returns: reference_id
    """
    import uuid
    reference_id = str(uuid.uuid4())
    token = _mtn_get_access_token()

    phone = phone_number.replace('+', '').replace(' ', '').replace('-', '')

    if _use_madapi:
        # MTN MADAPI payment endpoint
        payload = {
            "amount": str(int(amount)),
            "currency": currency.upper(),
            "externalTransactionId": external_id,
            "customerMsisdn": phone,
            "serviceCode": "COP",
            "description": payer_message,
            "countryCode": MTN_COUNTRY_CODE,
        }
        resp = requests.post(
            f"{MTN_MADAPI_BASE}/payments",
            headers={
                "Authorization": f"Bearer {token}",
                "X-Reference-Id": reference_id,
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=15,
        )
    else:
        # MoMo Developer API
        payload = {
            "amount": str(int(amount)),
            "currency": currency.upper(),
            "externalId": external_id,
            "payer": {
                "partyIdType": "MSISDN",
                "partyId": phone,
            },
            "payerMessage": payer_message,
            "payeeNote": payee_note,
        }
        resp = requests.post(
            f"{MTN_BASE}/collection/v1_0/requesttopay",
            headers={
                "Authorization": f"Bearer {token}",
                "X-Reference-Id": reference_id,
                "X-Target-Environment": MTN_ENV,
                "Content-Type": "application/json",
                "Ocp-Apim-Subscription-Key": MTN_SUBSCRIPTION_KEY,
            },
            json=payload,
            timeout=15,
        )

    resp.raise_for_status()
    return {"reference": reference_id, "status": "pending"}


def mtn_check_payment_status(reference_id: str) -> dict:
    """
    Check the status of an MTN payment transaction.
    Returns: status ('completed' | 'pending' | 'failed'), amount, currency
    """
    token = _mtn_get_access_token()

    if _use_madapi:
        resp = requests.get(
            f"{MTN_MADAPI_BASE}/payments/{reference_id}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
    else:
        resp = requests.get(
            f"{MTN_BASE}/collection/v1_0/requesttopay/{reference_id}",
            headers={
                "Authorization": f"Bearer {token}",
                "X-Target-Environment": MTN_ENV,
                "Ocp-Apim-Subscription-Key": MTN_SUBSCRIPTION_KEY,
            },
            timeout=15,
        )

    resp.raise_for_status()
    data = resp.json()
    raw_status = data.get("status", "FAILED").upper()

    mapped = {
        "SUCCESSFUL": "completed",
        "SUCCESS": "completed",
        "PENDING": "pending",
        "FAILED": "failed",
    }.get(raw_status, "failed")

    return {
        "reference": reference_id,
        "status": mapped,
        "raw_status": raw_status,
        "amount": data.get("amount"),
        "currency": data.get("currency"),
        "payer": data.get("payer", {}).get("partyId") or data.get("customerMsisdn"),
        "reason": data.get("reason"),
    }


def mtn_validate_account_holder(phone_number: str) -> dict:
    """
    Validate that a phone number is a registered MTN MoMo account holder.
    Returns: {"active": bool, "error": str | None}
    Endpoint: GET /collection/v1_0/accountholder/msisdn/{phone}/active
    Requires MoMo Developer API credentials (MTN_COLLECTION_USER_ID etc.).
    """
    if not _momo_dev_available:
        # MoMo Developer API not configured – skip gracefully rather than block
        return {"active": True, "error": None}

    phone = phone_number.replace('+', '').replace(' ', '').replace('-', '')
    try:
        token = _mtn_get_access_token(force_momo_dev=True)
        resp = requests.get(
            f"{MTN_BASE}/collection/v1_0/accountholder/msisdn/{phone}/active",
            headers={
                "Authorization": f"Bearer {token}",
                "X-Target-Environment": MTN_ENV,
                "Ocp-Apim-Subscription-Key": MTN_SUBSCRIPTION_KEY,
            },
            timeout=10,
        )
        if resp.status_code == 200:
            body = resp.text.strip()
            if not body:
                # Some environments return empty 200 to indicate active
                return {"active": True, "error": None}
            try:
                parsed = resp.json()
            except Exception:
                return {"active": True, "error": None}
            # Response shape: {"result": true/false} OR bare boolean
            if isinstance(parsed, bool):
                return {"active": parsed, "error": None}
            result_val = parsed.get("result")
            if result_val is None:
                # Treat any successful 200 with unexpected body as active
                return {"active": True, "error": None}
            return {"active": bool(result_val), "error": None}
        elif resp.status_code == 404:
            return {"active": False, "error": "Phone number is not a registered MoMo account"}
        else:
            return {"active": False, "error": f"Validation failed (HTTP {resp.status_code})"}
    except Exception as exc:
        return {"active": False, "error": str(exc)}


def mtn_get_basic_userinfo(phone_number: str) -> dict:
    """
    Retrieve basic user info (name, locale, etc.) for a MoMo account holder.
    Returns: {"name": str | None, "given_name": str | None, "family_name": str | None, "locale": str | None, "error": str | None}
    Endpoint: GET /collection/v1_0/accountholder/msisdn/{phone}/basicuserinfo
    Requires MoMo Developer API credentials.
    """
    if not _momo_dev_available:
        return {"name": None, "given_name": None, "family_name": None, "locale": None, "error": None}

    phone = phone_number.replace('+', '').replace(' ', '').replace('-', '')
    try:
        token = _mtn_get_access_token(force_momo_dev=True)
        resp = requests.get(
            f"{MTN_BASE}/collection/v1_0/accountholder/msisdn/{phone}/basicuserinfo",
            headers={
                "Authorization": f"Bearer {token}",
                "X-Target-Environment": MTN_ENV,
                "Ocp-Apim-Subscription-Key": MTN_SUBSCRIPTION_KEY,
            },
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        full_name = data.get("name") or (
            " ".join(filter(None, [data.get("given_name"), data.get("family_name")])) or None
        )
        return {
            "name": full_name,
            "given_name": data.get("given_name"),
            "family_name": data.get("family_name"),
            "locale": data.get("locale"),
            "status": data.get("status"),
            "error": None,
        }
    except Exception as exc:
        return {"name": None, "given_name": None, "family_name": None, "locale": None, "error": str(exc)}


def mtn_get_account_balance(currency: str = "RWF") -> dict:
    """
    Retrieve the available balance of the merchant's MoMo collection account in a specific currency.
    Returns: {"available_balance": str | None, "currency": str | None, "error": str | None}
    Endpoint: GET /collection/v1_0/account/balance/{currency}
    Requires MoMo Developer API credentials.
    """
    if not _momo_dev_available:
        return {"available_balance": None, "currency": currency, "error": "MoMo Developer API credentials not configured"}

    try:
        token = _mtn_get_access_token(force_momo_dev=True)
        resp = requests.get(
            f"{MTN_BASE}/collection/v1_0/account/balance/{currency.upper()}",
            headers={
                "Authorization": f"Bearer {token}",
                "X-Target-Environment": MTN_ENV,
                "Ocp-Apim-Subscription-Key": MTN_SUBSCRIPTION_KEY,
            },
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        return {
            "available_balance": data.get("availableBalance"),
            "currency": data.get("currency", currency),
            "error": None,
        }
    except Exception as exc:
        return {"available_balance": None, "currency": currency, "error": str(exc)}


def mtn_send_delivery_notification(reference_id: str, notification_message: str = "Payment request sent", is_momo_dev_reference: bool = True) -> bool:
    """
    Send a delivery notification to the payer after a MoMo Developer API RequesttoPay.
    Only meaningful when the RequesttoPay was made via the MoMo Developer API (not MADAPI),
    because the reference ID must exist in the MoMo Developer API system.

    Per official docs (momodeveloper.mtn.com):
      POST /collection/v1_0/requesttopay/{referenceId}/deliverynotification
      Header: notificationMessage (max 160 chars)
      Body: {}  (empty JSON object)

    Returns: True on success or when skipped, False on API error.
    """
    # Only run when MoMo Developer API credentials are configured
    # AND the reference originates from a MoMo Dev RequesttoPay (not MADAPI)
    if not _momo_dev_available or not is_momo_dev_reference:
        return True  # skip silently – never block the payment flow

    try:
        token = _mtn_get_access_token(force_momo_dev=True)
        resp = requests.post(
            f"{MTN_BASE}/collection/v1_0/requesttopay/{reference_id}/deliverynotification",
            headers={
                "Authorization": f"Bearer {token}",
                "X-Target-Environment": MTN_ENV,
                "Ocp-Apim-Subscription-Key": MTN_SUBSCRIPTION_KEY,
                "notificationMessage": notification_message[:160],  # API max 160 chars
                "Content-Type": "application/json",
            },
            json={},
            timeout=10,
        )
        return resp.status_code in (200, 202)
    except Exception:
        return False


# ============================================================
# BANK TRANSFER (manual / instructional – no API call needed)
# ============================================================

# Default bank account for Afritech Bridge (used when a course has no custom bank details)
_DEFAULT_BANK_DETAILS = (
    "Bank Name:       BANK OF KIGALI\n"
    "Account Name:    Afritech Bridge\n"
    "Account Number:  100075243884\n"
    "Reference:       [Your Full Name + Course Name]"
)


def get_bank_transfer_info(course) -> dict:
    """Return bank transfer instructions for a course."""
    return {
        "method": "bank_transfer",
        "status": "pending",
        "message": (
            "Please transfer the exact amount to the bank account below, "
            "use your unique reference as the payment narration, then upload "
            "your proof of payment to confirm enrollment."
        ),
        "bank_details": course.bank_transfer_details or _DEFAULT_BANK_DETAILS,
        "reference": f"COURSE-{course.id}",
    }


# ============================================================
# K-PAY (pay.esicia.com) – Africa-focused multi-method gateway
# Supports: MTN MoMo, Airtel Money (pmethod=momo), Visa/MC/Amex (pmethod=cc), SPENN wallet (pmethod=spenn)
# Docs: https://developers.kpay.africa/documentation.php
# ============================================================

KPAY_BASE_URL = os.environ.get('KPAY_BASE_URL', 'https://pay.esicia.com/')
KPAY_API_KEY = os.environ.get('KPAY_API_KEY', '')
KPAY_USERNAME = os.environ.get('KPAY_USERNAME', '')
KPAY_PASSWORD = os.environ.get('KPAY_PASSWORD', '')
KPAY_RETAILER_ID = os.environ.get('KPAY_RETAILER_ID', '')
# Set to 'true' for sandbox / test mode.  In sandbox K-Pay also uses https://pay.esicia.com/ but
# with test credentials.  Leave as a flag for logging / feature-gating.
KPAY_SANDBOX = os.environ.get('KPAY_SANDBOX', 'true').lower() in ('1', 'true', 'yes')


def _kpay_headers() -> dict:
    """Build the two auth headers required by every K-Pay API call."""
    if not KPAY_API_KEY or not KPAY_USERNAME or not KPAY_PASSWORD:
        raise ValueError(
            "K-Pay credentials not configured. "
            "Set KPAY_API_KEY, KPAY_USERNAME, KPAY_PASSWORD, KPAY_RETAILER_ID in .env."
        )
    encoded = base64.b64encode(f"{KPAY_USERNAME}:{KPAY_PASSWORD}".encode()).decode()
    return {
        "Content-Type": "application/json",
        "Kpay-Key": KPAY_API_KEY,
        "Authorization": f"Basic {encoded}",
    }


def kpay_initiate_payment(
    amount: int,
    currency: str,
    email: str,
    phone: str,
    cname: str,
    cnumber: str,
    refid: str,
    pmethod: str,
    details: str,
    returl: str,
    redirecturl: str,
) -> dict:
    """
    Initiate a K-Pay payment session.

    Parameters
    ----------
    amount      : Payment amount as an integer (K-Pay requires integer amounts).
    currency    : ISO 4217 code, e.g. 'RWF', 'USD'.  Defaults to RWF on K-Pay side.
    email       : Customer email address.
    phone       : Customer phone / MSISDN (with country code, no leading '+').
    cname       : Customer full name.
    cnumber     : Unique customer reference (e.g. 'CUST_<user_id>').
    refid       : Unique payment reference ID for this transaction (e.g. 'AFRITECH_<uuid>').
    pmethod     : Payment method: 'momo' | 'cc' | 'spenn'.
    details     : Human-readable payment description (e.g. course title).
    returl      : Backend webhook URL – K-Pay will POST the transaction result here.
    redirecturl : Frontend redirect URL after payment completes (success/cancel page).

    Returns
    -------
    dict with keys: checkout_url, tid, refid, success (bool)

    Raises
    ------
    ValueError  : K-Pay credentials not configured.
    requests.HTTPError : Network or API error.
    RuntimeError: K-Pay returned success=0 (authentication / config error).
    """
    payload = {
        "action": "pay",
        "msisdn": str(phone).replace('+', '').replace(' ', '').replace('-', ''),
        "email": email,
        "details": details,
        "refid": refid,
        "amount": int(amount),
        "currency": currency.upper() if currency else "RWF",
        "cname": cname,
        "cnumber": cnumber,
        "pmethod": pmethod,
        "retailerid": KPAY_RETAILER_ID,
        "returl": returl,
        "redirecturl": redirecturl,
    }

    resp = requests.post(
        KPAY_BASE_URL,
        headers=_kpay_headers(),
        json=payload,
        timeout=20,
    )
    resp.raise_for_status()
    data = resp.json()

    if not data.get("success") or int(data.get("retcode", 1)) != 0:
        retcode = data.get("retcode", "?")
        reply = data.get("reply", "UNKNOWN_ERROR")
        _KPAY_ERROR_MAP = {
            600: "Invalid request",
            601: "Invalid API key",
            602: "Invalid authorization credentials",
            603: "IP address not whitelisted – add your server IP in the K-Pay merchant portal",
            604: "Duplicate reference ID – use a unique refid per transaction",
            605: "Amount out of allowed range",
            606: "Target authorization error – verify retailer ID and credentials",
            607: "Insufficient funds",
            608: "Payment request timed out",
            609: "Payment was cancelled by the customer",
        }
        friendly = _KPAY_ERROR_MAP.get(int(retcode), reply)
        raise RuntimeError(f"K-Pay error {retcode}: {friendly}")

    return {
        "checkout_url": data.get("url", ""),
        "tid": data.get("tid", ""),
        "refid": data.get("refid", refid),
        "authkey": data.get("authkey", ""),
        "success": True,
    }


def kpay_check_status(refid: str) -> dict:
    """
    Check the status of a K-Pay transaction.

    Parameters
    ----------
    refid : The unique reference ID used when initiating the payment.

    Returns
    -------
    dict with keys:
        status     : 'completed' | 'pending' | 'failed'
        statusid   : Raw K-Pay status code ('01' success / '02' failed / '03' pending)
        statusdesc : Human-readable description from K-Pay
        tid        : K-Pay transaction ID
        refid      : Transaction reference ID
        momo_txn   : MoMo transaction ID (if applicable)
    """
    payload = {
        "action": "checkstatus",
        "refid": refid,
    }

    resp = requests.post(
        KPAY_BASE_URL,
        headers=_kpay_headers(),
        json=payload,
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()

    raw_statusid = str(data.get("statusid", "02"))
    _STATUS_MAP = {
        "01": "completed",
        "02": "failed",
        "03": "pending",
    }
    mapped_status = _STATUS_MAP.get(raw_statusid, "failed")

    return {
        "status": mapped_status,
        "statusid": raw_statusid,
        "statusdesc": data.get("statusdesc", ""),
        "tid": data.get("tid", ""),
        "refid": data.get("refid", refid),
        "momo_txn": data.get("momtransactionid", ""),
    }
