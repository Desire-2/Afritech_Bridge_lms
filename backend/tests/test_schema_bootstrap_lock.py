"""Tests for main._schema_advisory_lock (boot-time schema DDL serialization).

Production boots used to log:

    QueryCanceled: canceling statement due to statement timeout
    [SQL: SELECT pg_advisory_lock(7412345)]

because every engine connection carries `-c statement_timeout=30000`, which
cancels a *blocking* advisory-lock wait after 30 seconds.  Acquisition must
therefore poll pg_try_advisory_lock (returns immediately, never cancelled),
wait bounded, roll back between probes, and always release what it got.
"""

import pytest

import main


class _FakeLockConn:
    """Connection double returning scripted pg_try_advisory_lock results."""

    def __init__(self, probe_results):
        self._probe_results = list(probe_results)
        self.statements = []
        self.rollbacks = 0

    def execute(self, statement, params=None):
        self.statements.append((str(statement), params))

        class _Result:
            def scalar(inner):
                if self._probe_results:
                    return self._probe_results.pop(0)
                return False

        return _Result()

    def rollback(self):
        self.rollbacks += 1


def test_lock_polls_try_lock_instead_of_blocking(monkeypatch):
    conn = _FakeLockConn([False, False, True])
    sleeps = []
    monkeypatch.setattr(main.time, "sleep", lambda seconds: sleeps.append(seconds))

    with main._schema_advisory_lock(conn):
        pass

    sqls = [sql for sql, _ in conn.statements]
    # Every acquisition attempt is the non-blocking probe — the statement
    # that production's statement_timeout was cancelling must not appear.
    probe_count = sum("pg_try_advisory_lock" in sql for sql in sqls)
    assert probe_count == 3
    assert not any(sql.startswith("SELECT pg_advisory_lock(") for sql in sqls)
    assert sleeps == [1, 1]
    assert conn.rollbacks == 2
    # Parameters bind the documented lock id, and the lock is released last.
    assert conn.statements[0][1] == {"lock_id": main._ADVISORY_LOCK_ID}
    assert conn.statements[0][1]["lock_id"] == 7412345
    assert "pg_advisory_unlock" in conn.statements[-1][0]
    assert conn.statements[-1][1] == {"lock_id": main._ADVISORY_LOCK_ID}


def test_lock_raises_bounded_timeout_when_never_free(monkeypatch):
    monkeypatch.setattr(main, "_ADVISORY_LOCK_WAIT_SECONDS", 0)
    conn = _FakeLockConn([False])
    sleeps = []
    monkeypatch.setattr(main.time, "sleep", lambda seconds: sleeps.append(seconds))

    with pytest.raises(TimeoutError, match="still held"):
        with main._schema_advisory_lock(conn):
            pytest.fail("lock body must not run without the lock")

    assert sleeps == []
    assert not any("pg_advisory_unlock" in sql for sql, _ in conn.statements)


def test_lock_released_even_when_body_raises():
    conn = _FakeLockConn([True])

    with pytest.raises(RuntimeError, match="ddl failed"):
        with main._schema_advisory_lock(conn):
            raise RuntimeError("ddl failed")

    assert "pg_advisory_unlock" in conn.statements[-1][0]
