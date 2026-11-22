"""Bounded execution helper for provider/engine calls.

The AAGE engine cannot kill a Python thread, so this is a *deadline*, not a
sandbox: the caller stops waiting and marks the job timed out, while the daemon
thread may finish and discard its result.  Only trusted callables are passed
here (the AI provider request or the orchestrator); student code is never
executed through this helper.
"""

from __future__ import annotations

import queue
import threading
import time
from typing import Any, Callable, TypeVar

T = TypeVar("T")

#: Per-thread deadline used to bound a whole job.  ``llm_json`` reads it so a
#: hung provider call cannot outlive the job that owns it.
_deadline = threading.local()


def set_deadline(deadline_monotonic: float) -> None:
    """Set the calling thread's ``time.monotonic()`` deadline."""
    _deadline.value = float(deadline_monotonic)


def clear_deadline() -> None:
    try:
        del _deadline.value
    except AttributeError:
        pass


def remaining_seconds() -> float | None:
    """Seconds left before the calling thread's deadline, or ``None``."""
    deadline = getattr(_deadline, "value", None)
    if deadline is None:
        return None
    return float(deadline) - time.monotonic()


class CallTimeout(TimeoutError):
    """Raised when a bounded call exceeds its deadline."""

    def __init__(self, timeout_seconds: float, label: str = "call"):
        super().__init__(f"{label} exceeded {timeout_seconds:g}s")
        self.timeout_seconds = timeout_seconds
        self.label = label


def call_with_timeout(
    func: Callable[[], T],
    timeout_seconds: float,
    *,
    label: str = "call",
) -> T:
    """Run ``func`` in a daemon thread, waiting at most ``timeout_seconds``.

    The thread is daemonised so a hung provider cannot keep the process alive.
    The returned/raised value is exactly what ``func`` produced.
    """
    try:
        timeout = max(0.001, float(timeout_seconds))
    except (TypeError, ValueError):
        timeout = 0.001

    outcome: "queue.Queue[Any]" = queue.Queue(maxsize=1)

    def _target() -> None:
        try:
            outcome.put((True, func(), None))
        except BaseException as exc:  # propagate the original exception
            outcome.put((False, None, exc))

    thread = threading.Thread(target=_target, name=f"aage-timeout-{label}",
                              daemon=True)
    started = time.monotonic()
    thread.start()
    thread.join(timeout)
    if thread.is_alive():
        raise CallTimeout(timeout, label)
    try:
        ok, value, exc = outcome.get_nowait()
    except queue.Empty:  # pragma: no cover - defensive
        raise CallTimeout(timeout, label)
    if not ok:
        raise exc
    # A tiny guard against a callable that took longer than the wall clock
    # allowed but returned just as the join completed.
    if time.monotonic() - started > timeout + 0.05:
        raise CallTimeout(timeout, label)
    return value  # type: ignore[return-value]


__all__ = [
    "CallTimeout",
    "call_with_timeout",
    "clear_deadline",
    "remaining_seconds",
    "set_deadline",
]
