"""In-process sliding-window rate limiting for the /api/v2 integration API.

Scope note (documented in ``docs/api/security.md``): counters are per worker
process. Render/gunicorn runs multiple workers, so the effective global limit
is ``limit × workers`` — this is an abuse control, not a billing-grade quota.
The primary limit basis is the API key (stable across workers is *not*
guaranteed here); anonymous traffic falls back to client IP.
"""

from __future__ import annotations

import os
import threading
import time
from collections import deque
from typing import Deque, Dict, Tuple

from .constants import (
    RATE_LIMIT_AUTHENTICATED_PER_MINUTE,
    RATE_LIMIT_EXEMPT_PATHS,
    RATE_LIMIT_PATH_OVERRIDES,
    RATE_LIMIT_PUBLIC_PER_MINUTE,
)


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


PUBLIC_LIMIT = _env_int("API_RATE_LIMIT_PUBLIC_PER_MINUTE", RATE_LIMIT_PUBLIC_PER_MINUTE)
AUTH_LIMIT = _env_int("API_RATE_LIMIT_AUTHENTICATED_PER_MINUTE", RATE_LIMIT_AUTHENTICATED_PER_MINUTE)


class SlidingWindowLimiter:
    """Thread-safe sliding-window counter keyed by an opaque string."""

    def __init__(self) -> None:
        self._hits: Dict[str, Deque[float]] = {}
        self._lock = threading.Lock()

    def check(self, key: str, limit: int, window_seconds: int) -> Tuple[bool, int, int, int]:
        """Return ``(allowed, remaining, limit, retry_after_seconds)``."""
        now = time.time()
        cutoff = now - window_seconds
        with self._lock:
            hits = self._hits.setdefault(key, deque())
            while hits and hits[0] <= cutoff:
                hits.popleft()
            if len(self._hits) > 10000:  # defensive prune of stale keys
                for k in [k for k, v in self._hits.items() if not v or v[-1] <= cutoff]:
                    self._hits.pop(k, None)
            if len(hits) >= limit:
                retry_after = int(max(1, hits[0] + window_seconds - now))
                return False, 0, limit, retry_after
            hits.append(now)
            reset_in = int(max(1, hits[0] + window_seconds - now)) if hits else window_seconds
            return True, limit - len(hits), limit, reset_in

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


limiter = SlidingWindowLimiter()


def client_ip() -> str:
    """Best-effort client IP (first X-Forwarded-For entry, else socket peer)."""
    from flask import request
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()[:64] or (request.remote_addr or "unknown")
    return request.remote_addr or "unknown"


def rate_limit_key() -> str:
    """Rate-limit basis: API key id when present, else client IP."""
    from flask import g
    key = getattr(g, "api_key", None)
    if key is not None:
        return f"key:{key.id}"
    return f"ip:{client_ip()}"


def enforce_rate_limit() -> None:
    """Raise ``ApiError(429)`` when the current request exceeds its quota."""
    from .errors import ApiError
    from flask import g, request

    path = request.path
    if path in RATE_LIMIT_EXEMPT_PATHS:
        return

    has_key = getattr(g, "api_key", None) is not None
    if path in RATE_LIMIT_PATH_OVERRIDES:
        limit, window = RATE_LIMIT_PATH_OVERRIDES[path]
        basis = f"ip:{client_ip()}"
    elif has_key:
        limit, window = AUTH_LIMIT, 60
        basis = rate_limit_key()
    else:
        limit, window = PUBLIC_LIMIT, 60
        basis = rate_limit_key()

    allowed, remaining, limit, retry_after = limiter.check(basis, limit, window)
    g.rate_limit = {
        "limit": limit,
        "remaining": remaining,
        "reset_seconds": retry_after,
    }
    if not allowed:
        raise ApiError(
            "RATE_LIMITED",
            "Rate limit exceeded. Retry after the interval indicated by the Retry-After header.",
            429,
            details=[{"limit": limit, "window_seconds": window}],
            headers={"Retry-After": str(retry_after),
                     "X-RateLimit-Limit": str(limit),
                     "X-RateLimit-Remaining": "0"},
        )
