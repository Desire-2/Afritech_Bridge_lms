# PayPal Payment Service for Afritec Bridge LMS
# Integrates with PayPal REST API for course payments

import os
import logging
import requests
import base64
from datetime import datetime
from typing import Dict, Optional, Tuple

logger = logging.getLogger(__name__)


class PaypalPaymentService:
    """Service for handling PayPal payments (Checkout Orders API v2)."""

    # ── Configuration ───────────────────────────────────────────────
    CLIENT_ID = os.environ.get("PAYPAL_CLIENT_ID", "")
    CLIENT_SECRET = os.environ.get("PAYPAL_CLIENT_SECRET", "")
    SANDBOX = os.environ.get("PAYPAL_SANDBOX", "true").lower() in ("true", "1", "yes")

    BASE_URL = (
        "https://api-m.sandbox.paypal.com" if SANDBOX
        else "https://api-m.paypal.com"
    )

    # ── Internal helpers ────────────────────────────────────────────
    @classmethod
    def _get_access_token(cls) -> Optional[str]:
        """Obtain a PayPal OAuth2 access token."""
        if not cls.CLIENT_ID or not cls.CLIENT_SECRET:
            logger.error("PayPal credentials not configured")
            return None

        url = f"{cls.BASE_URL}/v1/oauth2/token"
        credentials = base64.b64encode(
            f"{cls.CLIENT_ID}:{cls.CLIENT_SECRET}".encode()
        ).decode()

        try:
            resp = requests.post(
                url,
                headers={
                    "Authorization": f"Basic {credentials}",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                data={"grant_type": "client_credentials"},
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("access_token")
        except Exception as exc:
            logger.error(f"PayPal auth error: {exc}")
            return None

    @classmethod
    def _headers(cls, token: str) -> Dict:
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        }

    # ── Public API ──────────────────────────────────────────────────

    @classmethod
    def create_order(
        cls,
        amount: float,
        currency: str = "USD",
        description: str = "Course Payment",
        return_url: str = "",
        cancel_url: str = "",
        custom_id: str = "",
        payer_email: str = "",
    ) -> Tuple[bool, Optional[str], Optional[str], str]:
        """
        Create a PayPal checkout order.

        Returns:
            (success, order_id, approval_url, message)
        """
        token = cls._get_access_token()
        if not token:
            return False, None, None, "Failed to authenticate with PayPal"

        order_payload = {
            "intent": "CAPTURE",
            "purchase_units": [
                {
                    "amount": {
                        "currency_code": currency.upper(),
                        "value": f"{amount:.2f}",
                    },
                    "description": description[:127],
                    "custom_id": custom_id,
                }
            ],
            "application_context": {
                "brand_name": "Afritec Bridge LMS",
                "landing_page": "LOGIN",
                "user_action": "PAY_NOW",
                "return_url": return_url,
                "cancel_url": cancel_url,
                "shipping_preference": "NO_SHIPPING",
            },
        }

        if payer_email:
            order_payload["payer"] = {"email_address": payer_email}

        try:
            url = f"{cls.BASE_URL}/v2/checkout/orders"
            resp = requests.post(
                url,
                json=order_payload,
                headers=cls._headers(token),
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()

            order_id = data.get("id")
            approval_url = None
            for link in data.get("links", []):
                if link.get("rel") == "approve":
                    approval_url = link.get("href")
                    break

            logger.info(f"PayPal order created: {order_id}")
            return True, order_id, approval_url, "Order created"

        except requests.exceptions.HTTPError as exc:
            error_body = exc.response.text if exc.response else str(exc)
            logger.error(f"PayPal create order HTTP error: {error_body}")
            return False, None, None, f"PayPal error: {error_body}"
        except Exception as exc:
            logger.error(f"PayPal create order error: {exc}")
            return False, None, None, str(exc)

    @classmethod
    def capture_order(cls, order_id: str) -> Tuple[bool, Optional[str], str]:
        """
        Capture (finalize) a previously approved PayPal order.

        Returns:
            (success, capture_id, message)
        """
        token = cls._get_access_token()
        if not token:
            return False, None, "Failed to authenticate with PayPal"

        try:
            url = f"{cls.BASE_URL}/v2/checkout/orders/{order_id}/capture"
            resp = requests.post(
                url,
                headers=cls._headers(token),
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()

            status = data.get("status")
            capture_id = None

            # Extract capture ID from purchase units
            for pu in data.get("purchase_units", []):
                for cap in pu.get("payments", {}).get("captures", []):
                    capture_id = cap.get("id")
                    break

            if status == "COMPLETED":
                logger.info(f"PayPal order {order_id} captured: {capture_id}")
                return True, capture_id, "Payment captured successfully"
            else:
                logger.warning(f"PayPal capture status: {status}")
                return False, capture_id, f"Payment status: {status}"

        except requests.exceptions.HTTPError as exc:
            error_body = exc.response.text if exc.response else str(exc)
            logger.error(f"PayPal capture HTTP error: {error_body}")
            return False, None, f"PayPal capture error: {error_body}"
        except Exception as exc:
            logger.error(f"PayPal capture error: {exc}")
            return False, None, str(exc)

    @classmethod
    def get_order_details(cls, order_id: str) -> Tuple[bool, Optional[Dict], str]:
        """
        Retrieve details of a PayPal order.

        Returns:
            (success, order_data, message)
        """
        token = cls._get_access_token()
        if not token:
            return False, None, "Failed to authenticate with PayPal"

        try:
            url = f"{cls.BASE_URL}/v2/checkout/orders/{order_id}"
            resp = requests.get(
                url,
                headers=cls._headers(token),
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            return True, data, "Order details retrieved"

        except Exception as exc:
            logger.error(f"PayPal get order error: {exc}")
            return False, None, str(exc)

    @classmethod
    def process_paypal_payment(cls, payment_data: Dict) -> Tuple[bool, Optional[str], str]:
        """
        Convenience method: create a PayPal order and return the approval URL.
        Used by EnrollmentService._process_payment_gateway().

        Returns:
            (success, approval_url_or_reference, message)
        """
        amount = payment_data.get("amount", 0)
        currency = payment_data.get("currency", "USD")
        description = payment_data.get("description", "Course Payment")
        return_url = payment_data.get("return_url", "")
        cancel_url = payment_data.get("cancel_url", "")
        email = payment_data.get("email", "")
        custom_id = payment_data.get("custom_id", "")

        success, order_id, approval_url, message = cls.create_order(
            amount=amount,
            currency=currency,
            description=description,
            return_url=return_url,
            cancel_url=cancel_url,
            custom_id=custom_id,
            payer_email=email,
        )

        if success and approval_url:
            return True, approval_url, f"PayPal order {order_id} created. Redirect to approval URL."
        return False, None, message

    @classmethod
    def verify_payment(cls, order_id: str) -> Tuple[bool, str, str]:
        """
        Verify a PayPal payment by checking order status. If approved but not captured, capture it.

        Returns:
            (success, status_string, message)
        """
        success, order_data, msg = cls.get_order_details(order_id)
        if not success or not order_data:
            return False, "unknown", msg

        status = order_data.get("status", "UNKNOWN")

        if status == "COMPLETED":
            return True, "completed", "Payment already completed"

        if status == "APPROVED":
            # Capture the payment
            cap_success, capture_id, cap_msg = cls.capture_order(order_id)
            if cap_success:
                return True, "completed", cap_msg
            return False, "failed", cap_msg

        if status == "CREATED":
            return False, "pending", "Payment not yet approved by payer"

        return False, status.lower(), f"Unexpected PayPal status: {status}"
