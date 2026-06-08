"""
Rate Limit Handler for AI Provider Calls

Production-grade, resumable rate-limit-aware execution engine.
Handles HTTP 429 errors gracefully by pausing, waiting with jitter,
preserving progress state, and resuming exactly where it left off.

Usage:
    from .rate_limit_handler import rate_limit_handler

    response = rate_limit_handler.execute_with_retry(
        ai_provider.make_ai_request,
        prompt,
        session_id=session_id,
        task_id=task_id,
        step_label="Generating lesson outline",
    )

Log lines follow the standard format:
  [RATE LIMIT] {provider} → 429 received. Wait: {wait}s. Attempt {n}/{max}. Task: {task_id}. Step: "{step_label}"
  [RATE LIMIT] Countdown: {remaining}s remaining before resuming "{step_label}"
  [RATE LIMIT] Resuming after {actual_wait}s. Provider: {provider}. Task: {task_id}.
  [RATE LIMIT] Exhausted: All {max} attempts failed on {provider}. Switching to {fallback}.
  [PROACTIVE]  {provider} at {count}/{rpm} RPM. Pausing {wait}s for window reset. Task: {task_id}.
  [PROVIDER]   Switched from {old} to {new} after {n} consecutive failures.
"""

import os
import time
import random
import logging
import threading
from collections import deque
from typing import Dict, Any, Optional, Callable, Tuple

logger = logging.getLogger(__name__)


# =========================================================================
# Custom Exceptions
# =========================================================================

class RateLimitExhaustedError(Exception):
    """Raised when all retry attempts with all providers are exhausted."""

    def __init__(self, provider: str, attempts: int, last_error: str):
        self.provider = provider
        self.attempts = attempts
        self.last_error = last_error
        super().__init__(
            f"Rate limit exhausted: All {attempts} attempts on {provider} failed. "
            f"Last error: {last_error}"
        )


class TaskCancelledError(Exception):
    """Raised during a rate-limit wait when the task is externally cancelled."""
    pass


# =========================================================================
# RateLimitHandler
# =========================================================================

class RateLimitHandler:
    """
    Central rate limit handler for all AI provider calls.

    Implements: mandatory minimum wait, jitter, progress preservation,
    cross-provider fallback, proactive RPM throttling, and detailed logging.
    Thread-safe for concurrent access.
    """

    # Defaults — can be overridden via env vars
    DEFAULT_RATE_LIMIT_WAIT_SECONDS = 120
    DEFAULT_JITTER_MAX_SECONDS = 15
    DEFAULT_MAX_RETRY_ATTEMPTS = 5
    DEFAULT_PROACTIVE_THRESHOLD = 0.9

    def __init__(self):
        # Load from environment with defaults
        self.rate_limit_wait_seconds = int(os.getenv(
            'RATE_LIMIT_WAIT_SECONDS', str(self.DEFAULT_RATE_LIMIT_WAIT_SECONDS)
        ))
        self.jitter_max_seconds = int(os.getenv(
            'RATE_LIMIT_JITTER_MAX_SECONDS', str(self.DEFAULT_JITTER_MAX_SECONDS)
        ))
        self.max_retry_attempts = int(os.getenv(
            'RATE_LIMIT_MAX_RETRIES', str(self.DEFAULT_MAX_RETRY_ATTEMPTS)
        ))
        self.proactive_threshold = float(os.getenv(
            'RATE_LIMIT_PROACTIVE_THRESHOLD', str(self.DEFAULT_PROACTIVE_THRESHOLD)
        ))

        # Wait state tracking — thread-safe
        self._lock = threading.Lock()
        self._wait_states: Dict[str, Dict[str, Any]] = {}
        # Keyed by task_id or session_id

        # Replaceable sleep function — allows mocking in tests
        self._sleep = time.sleep

        # Request window tracking for proactive RPM throttling
        self._request_window: Dict[str, deque] = {
            'openrouter': deque(maxlen=200),
            'gemini': deque(maxlen=15),
        }
        self._request_lock = threading.Lock()

        logger.info(
            f"RateLimitHandler initialized: "
            f"wait={self.rate_limit_wait_seconds}s, "
            f"jitter_max={self.jitter_max_seconds}s, "
            f"max_retries={self.max_retry_attempts}, "
            f"proactive_threshold={self.proactive_threshold}"
        )

    # ------------------------------------------------------------------
    # Public Methods
    # ------------------------------------------------------------------

    def handle_rate_limit_response(
        self,
        provider_name: str,
        retry_after_header: Optional[str] = None,
    ) -> float:
        """
        Parse a 429 response and determine how long to wait.

        Args:
            provider_name: 'openrouter' or 'gemini'
            retry_after_header: Value of the Retry-After response header (if present)

        Returns:
            Total wait duration in seconds (includes jitter)
        """
        # Start with our minimum wait
        wait = self.rate_limit_wait_seconds

        # If Retry-After header is present and longer than our minimum, use it
        if retry_after_header:
            try:
                retry_after = float(retry_after_header)
                if retry_after > self.rate_limit_wait_seconds:
                    wait = retry_after
                    logger.info(
                        f"[RATE LIMIT] {provider_name} Retry-After header: "
                        f"{retry_after}s exceeds minimum {self.rate_limit_wait_seconds}s. "
                        f"Using {retry_after}s."
                    )
            except (ValueError, TypeError):
                logger.warning(
                    f"[RATE LIMIT] {provider_name} unparseable Retry-After header: "
                    f"'{retry_after_header}'. Falling back to minimum wait."
                )

        # Add random jitter
        jitter = random.uniform(0, self.jitter_max_seconds)
        total_wait = wait + jitter

        logger.info(
            f"[RATE LIMIT] {provider_name} → 429 received. "
            f"Base wait: {wait}s, Jitter: +{jitter:.1f}s, Total: {total_wait:.1f}s"
        )

        return total_wait

    def _sync_task_rate_limit_status(
        self,
        task_id: Optional[str],
        wait_seconds: float,
        remaining: float,
        provider: str,
        attempt: int,
        step_label: str,
        is_waiting: bool = True,
    ) -> None:
        """
        Sync the current wait state to the background task manager
        so /task/<id>/status shows real-time rate_limit_info.

        Called on every 10s interval during wait_with_progress.
        Uses a lazy import to avoid circular dependency at module level.
        """
        if task_id is None:
            return
        try:
            from .task_manager import task_manager as bg_task_manager
            bg_task_manager.update_task_rate_limit_status(
                task_id,
                {
                    "is_waiting": is_waiting,
                    "wait_duration_seconds": int(wait_seconds),
                    "wait_remaining_seconds": int(remaining),
                    "provider": provider,
                    "attempt": attempt,
                    "step_label": step_label,
                },
            )
        except Exception:
            # task_manager may not be available in test/standalone contexts
            pass

    def wait_with_progress(
        self,
        wait_seconds: float,
        session_id: Optional[str] = None,
        task_id: Optional[str] = None,
        step_label: str = "Waiting for AI provider",
        provider: str = "openrouter",
        attempt: int = 1,
        cancellation_token: Optional[Callable[[], bool]] = None,
        progress_callback: Optional[Callable[[float, float, str], None]] = None,
    ) -> None:
        """
        Sleep for `wait_seconds` while updating progress and logging countdowns.

        Every 10s interval, syncs rate_limit_info to the background task
        manager so that /task/<id>/status returns real-time wait state.

        Args:
            wait_seconds: Total seconds to wait
            session_id: Optional session ID for progress tracking
            task_id: Optional task ID for progress tracking
            step_label: Human-readable description of what's being waited on
            provider: Provider name for logging
            attempt: Current retry attempt number
            cancellation_token: Optional callable that returns True if task is cancelled
            progress_callback: Optional callback(elapsed, total, label) for SSE updates

        Raises:
            TaskCancelledError: If the task is cancelled during the wait
        """
        # Register wait state in local handler
        self._update_wait_state(
            session_id=session_id,
            task_id=task_id,
            is_waiting=True,
            wait_remaining_seconds=int(wait_seconds),
            wait_duration_seconds=int(wait_seconds),
            provider=provider,
            attempt=attempt,
            step_label=step_label,
        )

        # Sync to background task manager so /task/<id>/status sees rate_limited state
        self._sync_task_rate_limit_status(
            task_id, wait_seconds, wait_seconds,
            provider, attempt, step_label, is_waiting=True,
        )

        elapsed = 0
        interval = 10  # seconds between progress updates

        logger.info(
            f"[RATE LIMIT] {provider} → Starting wait. "
            f"Duration: {wait_seconds:.1f}s. "
            f"Attempt {attempt}/{self.max_retry_attempts}. "
            f"{'Task: ' + str(task_id) + '. ' if task_id else ''}"
            f"Step: \"{step_label}\""
        )

        try:
            while elapsed < wait_seconds:
                remaining = wait_seconds - elapsed

                # Check cancellation token on each interval
                if cancellation_token and cancellation_token():
                    logger.info(
                        f"[RATE LIMIT] Cancelled during wait. "
                        f"Provider: {provider}. Task: {task_id}. Step: \"{step_label}\""
                    )
                    self._clear_wait_state(session_id=session_id, task_id=task_id)
                    raise TaskCancelledError(
                        f"Task cancelled during rate-limit wait for {provider}"
                    )

                # Log countdown every interval
                if int(remaining) % interval == 0 or int(remaining) <= 5:
                    logger.info(
                        f"[RATE LIMIT] Countdown: {int(remaining)}s remaining "
                        f"before resuming \"{step_label}\""
                    )

                # Update local wait state
                self._update_wait_state(
                    session_id=session_id,
                    task_id=task_id,
                    wait_remaining_seconds=int(remaining),
                )

                # Sync to task manager so /task/<id>/status gets real-time updates
                self._sync_task_rate_limit_status(
                    task_id, wait_seconds, remaining,
                    provider, attempt, step_label, is_waiting=True,
                )

                # Progress callback for SSE streaming
                if progress_callback:
                    progress_callback(elapsed, wait_seconds, step_label)

                # Sleep for one interval or remaining time, whichever is smaller
                sleep_time = min(interval, remaining)
                self._sleep(sleep_time)
                elapsed += sleep_time

            # Done waiting
            logger.info(
                f"[RATE LIMIT] Resuming after {wait_seconds:.1f}s. "
                f"Provider: {provider}. "
                f"{'Task: ' + str(task_id) + '. ' if task_id else ''}"
                f"Step: \"{step_label}\""
            )

        finally:
            # _clear_wait_state also calls task_manager.clear_task_rate_limit_status()
            self._clear_wait_state(session_id=session_id, task_id=task_id)

    def execute_with_retry(
        self,
        ai_call_fn: Callable,
        *args,
        session_id: Optional[str] = None,
        task_id: Optional[str] = None,
        step_label: Optional[str] = None,
        provider: Optional[str] = None,
        cancellation_token: Optional[Callable[[], bool]] = None,
        progress_callback: Optional[Callable[[float, float, str], None]] = None,
        **kwargs,
    ) -> Tuple[Optional[str], str]:
        """
        Execute an AI provider call with full rate-limit retry logic.

        Args:
            ai_call_fn: The callable to invoke (e.g. provider.make_ai_request)
            *args: Positional arguments passed to ai_call_fn
            session_id: Optional session ID for progress tracking
            task_id: Optional task ID for progress tracking
            step_label: Human-readable description for logging/progress
            provider: Provider hint ('openrouter' or 'gemini'). If None, derived from call.
            cancellation_token: Optional callable returning True if cancelled
            progress_callback: Optional callback for SSE updates
            **kwargs: Keyword arguments passed to ai_call_fn

        Returns:
            Tuple of (response_text, provider_used) — same as ai_call_fn signature

        Raises:
            RateLimitExhaustedError: If all retry attempts on all providers are exhausted
            TaskCancelledError: If the task is cancelled during a wait
        """
        step_label = step_label or "AI content generation"
        last_error: Optional[str] = None
        providers_to_try = ['openrouter', 'gemini']

        for current_provider in providers_to_try:
            for attempt in range(1, self.max_retry_attempts + 1):
                # Check cancellation before making the call
                if cancellation_token and cancellation_token():
                    raise TaskCancelledError(
                        f"Task cancelled before AI call: \"{step_label}\""
                    )

                # Proactive throttle check before each attempt
                self.check_proactive_throttle(current_provider)

                try:
                    # Make the AI call — pass _raise_on_rate_limit so make_ai_request
                    # propagates 429 exceptions for the handler to catch
                    result = ai_call_fn(
                        *args,
                        _raise_on_rate_limit=True,
                        **kwargs,
                    )

                    # If ai_call_fn returns a tuple (response, provider), unwrap
                    if isinstance(result, tuple) and len(result) == 2:
                        response_text, used_provider = result
                    else:
                        response_text = result
                        used_provider = current_provider

                    # Record successful request for RPM tracking
                    self.record_request(used_provider or current_provider)

                    # Success — return result
                    return response_text, used_provider

                except Exception as e:
                    error_str = str(e)
                    is_rate_limit = self._is_rate_limit_error(e, error_str)

                    if is_rate_limit:
                        # Extract Retry-After if available
                        retry_after = self._extract_retry_after(e)

                        logger.warning(
                            f"[RATE LIMIT] {current_provider} → 429 received. "
                            f"Wait: computing... "
                            f"Attempt {attempt}/{self.max_retry_attempts}. "
                            f"{'Task: ' + str(task_id) + '. ' if task_id else ''}"
                            f"Step: \"{step_label}\""
                        )

                        # Calculate wait duration
                        wait_seconds = self.handle_rate_limit_response(
                            current_provider, retry_after
                        )

                        # Wait with progress
                        self.wait_with_progress(
                            wait_seconds=wait_seconds,
                            session_id=session_id,
                            task_id=task_id,
                            step_label=step_label,
                            provider=current_provider,
                            attempt=attempt,
                            cancellation_token=cancellation_token,
                            progress_callback=progress_callback,
                        )

                        # Continue to next retry attempt
                        last_error = error_str
                        continue

                    else:
                        # Non-rate-limit error — log and re-raise
                        logger.error(
                            f"[RATE LIMIT] Non-rate-limit error on {current_provider}: "
                            f"{error_str}. Step: \"{step_label}\""
                        )
                        raise

            # If we exhausted retries on this provider, log and switch
            logger.warning(
                f"[RATE LIMIT] Exhausted: All {self.max_retry_attempts} attempts "
                f"failed on {current_provider}. "
                f"{'Switching to ' + ('gemini' if current_provider == 'openrouter' else '(no fallback)') + '.'}"
            )

            # Mark last error and continue to fallback provider
            last_error = f"Rate limit exhausted on {current_provider}"

        # All providers exhausted
        raise RateLimitExhaustedError(
            provider=str(providers_to_try),
            attempts=self.max_retry_attempts * len(providers_to_try),
            last_error=last_error or "Unknown error",
        )

    def check_proactive_throttle(self, provider: str) -> None:
        """
        Check if we're approaching the RPM limit for a provider and proactively wait.

        If the number of requests in the current 60-second window exceeds
        the proactive threshold fraction of the RPM limit, sleep for the
        remainder of the window plus a small buffer.

        Args:
            provider: Provider name ('openrouter' or 'gemini')
        """
        with self._request_lock:
            window = self._request_window.get(provider)
            if not window:
                return

            # Determine RPM limit based on provider
            rpm_limit = 200 if provider == 'openrouter' else 15

            current_count = len(window)
            threshold_count = int(rpm_limit * self.proactive_threshold)

            if current_count >= threshold_count and current_count > 0:
                now = time.time()
                # Find the oldest request timestamp
                oldest = window[0]
                window_age = now - oldest

                if window_age < 60:
                    # Wait for the window to reset (oldest request falls out)
                    wait_time = 60 - window_age + 0.5  # +0.5s buffer
                    logger.warning(
                        f"[PROACTIVE] {provider} at {current_count}/{rpm_limit} RPM. "
                        f"Pausing {wait_time:.1f}s for window reset."
                    )
                    self._sleep(wait_time)

    def record_request(self, provider: str) -> None:
        """
        Record a successful AI request for RPM tracking.

        Args:
            provider: Provider name ('openrouter' or 'gemini')
        """
        with self._request_lock:
            window = self._request_window.get(provider)
            if window is not None:
                window.append(time.time())

    def get_wait_status(
        self,
        session_id: Optional[str] = None,
        task_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Get the current wait state for a session or task.

        Returns:
            Dict with structure:
            {
                "is_waiting": bool,
                "wait_remaining_seconds": int,
                "wait_duration_seconds": int,
                "provider": str or None,
                "attempt": int,
                "step_label": str or None,
            }
        """
        with self._lock:
            key = self._wait_key(session_id, task_id)
            state = self._wait_states.get(key, {})
            return {
                "is_waiting": state.get("is_waiting", False),
                "wait_remaining_seconds": state.get("wait_remaining_seconds", 0),
                "wait_duration_seconds": state.get("wait_duration_seconds", 0),
                "provider": state.get("provider"),
                "attempt": state.get("attempt", 0),
                "step_label": state.get("step_label"),
            }

    # ------------------------------------------------------------------
    # Internal Helpers
    # ------------------------------------------------------------------

    def _wait_key(self, session_id: Optional[str], task_id: Optional[str]) -> str:
        """Generate a unique key for wait state tracking."""
        if task_id:
            return f"task_{task_id}"
        if session_id:
            return f"session_{session_id}"
        return "_global"

    def _update_wait_state(
        self,
        session_id: Optional[str] = None,
        task_id: Optional[str] = None,
        **fields,
    ) -> None:
        """Thread-safe update of wait state dict."""
        with self._lock:
            key = self._wait_key(session_id, task_id)
            if key not in self._wait_states:
                self._wait_states[key] = {}
            self._wait_states[key].update(fields)

    def _clear_wait_state(
        self,
        session_id: Optional[str] = None,
        task_id: Optional[str] = None,
    ) -> None:
        """Thread-safe removal of wait state and restore task to in_progress."""
        # Clear task_manager rate limit status so /task/<id>/status returns to normal
        if task_id is not None:
            try:
                from .task_manager import task_manager as bg_task_manager
                bg_task_manager.clear_task_rate_limit_status(task_id)
            except Exception:
                pass  # task_manager may not be available in all contexts

        with self._lock:
            key = self._wait_key(session_id, task_id)
            self._wait_states.pop(key, None)

    def _is_rate_limit_error(self, exception: Exception, error_str: str) -> bool:
        """
        Determine if an exception represents a rate-limit (429) error.

        Checks: status_code attribute on the exception (requests.Response),
        HTTPError response status_code, and string patterns.
        """
        # Check if exception has status_code attribute (from requests)
        if hasattr(exception, 'status_code') and exception.status_code == 429:
            return True

        # Check if exception has response with status_code (HTTPError)
        if hasattr(exception, 'response') and exception.response is not None:
            if hasattr(exception.response, 'status_code'):
                if exception.response.status_code == 429:
                    return True

        # Check for HTTPError with response
        if hasattr(exception, 'response') and exception.response is not None:
            try:
                if exception.response.status_code == 429:
                    return True
            except (AttributeError, ValueError):
                pass

        # String-based detection
        lower_error = error_str.lower()
        if '429' in error_str:
            return True
        if 'rate limit' in lower_error:
            return True
        if 'too many requests' in lower_error:
            return True
        if 'quota' in lower_error and ('exceeded' in lower_error or 'limit' in lower_error):
            return True

        return False

    def _extract_retry_after(self, exception: Exception) -> Optional[str]:
        """
        Extract Retry-After header value from a rate-limit exception, if available.
        """
        # Check headers on the exception object directly (requests.Response)
        if hasattr(exception, 'response') and exception.response is not None:
            try:
                headers = exception.response.headers
                retry_after = headers.get('Retry-After') or headers.get('retry-after')
                if retry_after:
                    return str(retry_after)
            except (AttributeError, ValueError):
                pass

        # Check for x-ratelimit-reset header (used by some providers)
        if hasattr(exception, 'response') and exception.response is not None:
            try:
                headers = exception.response.headers
                reset = headers.get('x-ratelimit-reset') or headers.get('X-RateLimit-Reset')
                if reset:
                    try:
                        reset_val = float(reset)
                        now = time.time()
                        # If it's an absolute Unix timestamp in the future
                        if reset_val > 1_000_000_000 and reset_val > now:
                            return str(int(reset_val - now) + 1)
                        else:
                            return str(int(reset_val) + 1)
                    except (ValueError, TypeError):
                        pass
            except (AttributeError, ValueError):
                pass

        return None


# Singleton instance
rate_limit_handler = RateLimitHandler()
