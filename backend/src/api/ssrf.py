"""SSRF protections for outbound webhook calls.

A webhook URL registered by an integration client (or replayed by an admin)
is validated at subscription time **and re-checked immediately before every
delivery** (DNS rebinding defence). Rules:

* scheme must be ``https`` (``http`` only when ``API_WEBHOOKS_ALLOW_HTTP=1``,
  intended for local development and non-production test environments);
* no embedded credentials, no fragments, port restricted to 443/80;
* resolved addresses must be globally routable — loopback, private,
  link-local, CGNAT, multicast, reserved and the cloud metadata address
  ``169.254.169.254`` are rejected.
* deliveries never follow redirects (``allow_redirects=False``).
"""

from __future__ import annotations

import ipaddress
import os
import socket
from typing import Optional
from urllib.parse import urlparse

BLOCKED_HOSTNAMES = {"localhost", "metadata.google.internal", "metadata.goog"}


class WebhookUrlRejected(ValueError):
    def __init__(self, message: str, field: str = "url"):
        super().__init__(message)
        self.message = message
        self.field = field


def _allow_http() -> bool:
    return os.getenv("API_WEBHOOKS_ALLOW_HTTP", "0") == "1"


def validate_webhook_url(url: str) -> str:
    """Validate a webhook URL, returning it unchanged when acceptable."""
    if not url or not isinstance(url, str) or len(url) > 500:
        raise WebhookUrlRejected("A webhook URL of at most 500 characters is required.")

    parsed = urlparse(url.strip())
    if parsed.scheme not in ("https", "http"):
        raise WebhookUrlRejected("The webhook URL must use https.")
    if parsed.scheme == "http" and not _allow_http():
        raise WebhookUrlRejected(
            "Plain http webhook URLs are not accepted; use https."
        )
    if parsed.username or parsed.password:
        raise WebhookUrlRejected("The webhook URL must not embed credentials.")
    if parsed.fragment:
        raise WebhookUrlRejected("The webhook URL must not contain a fragment.")
    if parsed.port not in (None, 443, 80):
        raise WebhookUrlRejected("The webhook URL must use the default port (443 or 80).")

    host = (parsed.hostname or "").lower()
    if not host:
        raise WebhookUrlRejected("The webhook URL must include a hostname.")
    if host in BLOCKED_HOSTNAMES or host.endswith(".local") or host.endswith(".internal"):
        raise WebhookUrlRejected("The webhook URL hostname is not allowed.")
    if host == "169.254.169.254":
        raise WebhookUrlRejected("The webhook URL hostname is not allowed.")

    return url.strip()


def host_is_public(host: str) -> bool:
    """True when every resolved address for ``host`` is globally routable."""
    try:
        infos = socket.getaddrinfo(host, None, proto=socket.IPPROTO_TCP)
    except OSError:
        return False
    if not infos:
        return False
    for info in infos:
        addr = info[4][0]
        try:
            ip = ipaddress.ip_address(addr)
        except ValueError:
            return False
        if not ip.is_global:
            return False
        if ip.is_loopback or ip.is_private or ip.is_link_local or ip.is_multicast:
            return False
    return True


def assert_delivery_target_allowed(url: str) -> None:
    """Re-validate scheme and resolved addresses right before a delivery."""
    validate_webhook_url(url)
    host = urlparse(url.strip()).hostname or ""
    if not host_is_public(host):
        raise WebhookUrlRejected("The webhook URL does not resolve to a public address.")
