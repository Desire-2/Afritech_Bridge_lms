"""Focused, offline tests for AAGE selection, recovery and worker wiring."""

import time
from datetime import timedelta
from types import SimpleNamespace

import pytest

from src.models.aage_models import GradingJob
from src.models.user_models import db
from src.services.aage import jobs
from src.services.aage.constants import JOB_QUEUED, JOB_RUNNING, JOB_TIMED_OUT
from src.services.aage.evaluators import registry
from src.services.aage.evaluators.base import BaseEvaluator
from src.utils.time_utils import now_local


class StubEvaluator(BaseEvaluator):
    """Minimal evaluator: selection runs entirely through the base helpers."""

    def __init__(self, name, *, compatible=True):
        self.name = name
        self.version = "1.0.0"
        self.compatible = compatible

    def is_compatible(self, ctx):
        return self.compatible

    def evaluate(self, ctx, criteria):  # pragma: no cover - never called
        raise NotImplementedError


@pytest.fixture(autouse=True)
def _clear_disabled(app):
    with app.app_context():
        for name in ("alpha", "beta", "gamma"):
            registry.set_evaluator_disabled(name, False)
    yield


def _register(monkeypatch, *evaluators):
    for evaluator in evaluators:
        registry.register_evaluator(evaluator)
    # Isolate selection from the production evaluator catalog.
    monkeypatch.setattr(registry, "all_evaluators", lambda: list(evaluators))
    return [evaluator.name for evaluator in evaluators]


def _unregister(names):
    for name in names:
        registry.unregister_evaluator(name)


def _ctx(recommended=(), criteria=None):
    return SimpleNamespace(
        rubric={"evaluator_recommendations": list(recommended)},
        criteria=list(criteria or []),
        classification=SimpleNamespace(discipline="backend"),
        files=[],
        manifest=SimpleNamespace(text_content=""),
    )


def test_requested_recommended_and_hints_are_ordered_and_no_match_is_rejected(
        app, monkeypatch):
    names = _register(
        monkeypatch,
        StubEvaluator("gamma"),
        StubEvaluator("beta"),
        StubEvaluator("alpha"),
        StubEvaluator("delta", compatible=False),
    )
    try:
        ctx = _ctx(
            recommended=["beta"],
            criteria=[
                {"criterion_key": "api", "evaluator_hint": "alpha"},
                {"criterion_key": "ui", "evaluator_hint": "beta"},
            ],
        )
        with app.app_context():
            selected, rejected = registry.select_evaluators(
                ctx, requested=["beta"])
        assert [ev.name for ev in selected] == ["beta", "alpha"]
        reasons = {row["evaluator"]: row["reason"] for row in rejected}
        assert reasons["gamma"] == "no_matching_criteria"
        assert reasons["delta"] == "incompatible"
    finally:
        _unregister(names)


def test_compatible_fallback_never_wins_over_a_matching_criterion(
        app, monkeypatch):
    names = _register(
        monkeypatch, StubEvaluator("alpha"), StubEvaluator("beta"))
    try:
        ctx = _ctx(criteria=[
            {"criterion_key": "api", "evaluator_hint": "alpha"},
        ])
        with app.app_context():
            selected, rejected = registry.select_evaluators(ctx)
        assert [ev.name for ev in selected] == ["alpha"]
        assert {"evaluator": "beta", "reason": "no_matching_criteria"} in rejected
    finally:
        _unregister(names)


def test_disabled_admin_setting_excludes_evaluator_from_selection(
        app, monkeypatch):
    names = _register(
        monkeypatch, StubEvaluator("alpha"), StubEvaluator("beta"))
    try:
        with app.app_context():
            registry.set_evaluator_disabled("alpha", True)
            ctx = _ctx(criteria=[
                {"criterion_key": "api", "evaluator_hint": "alpha"},
                {"criterion_key": "ui", "evaluator_hint": "beta"},
            ])
            selected, rejected = registry.select_evaluators(ctx)
            assert registry.disabled_names() == {"alpha": "admin_disabled"}
        assert [ev.name for ev in selected] == ["beta"]
        assert {"evaluator": "alpha",
                "reason": "disabled:admin_disabled"} in rejected
    finally:
        _unregister(names)


def test_reap_zombie_running_uses_its_timeout_argument(app):
    with app.app_context():
        old = GradingJob(
            submission_type="assignment", submission_id=910001,
            assessment_kind="assignment", assessment_id=1,
            status=JOB_RUNNING, attempts=1, max_attempts=3,
            locked_by="dead-worker",
            locked_at=now_local() - timedelta(seconds=10),
        )
        fresh = GradingJob(
            submission_type="assignment", submission_id=910002,
            assessment_kind="assignment", assessment_id=1,
            status=JOB_RUNNING, attempts=1, max_attempts=3,
            locked_by="live-worker",
            locked_at=now_local() - timedelta(seconds=1),
        )
        db.session.add_all([old, fresh])
        db.session.commit()

        assert jobs.reap_zombie_running(timeout_seconds=2) >= 1
        assert GradingJob.query.get(old.id).status == JOB_QUEUED
        assert GradingJob.query.get(fresh.id).status == JOB_RUNNING


def test_run_job_enforces_job_timeout(app, monkeypatch):
    from src.services.aage import orchestrator

    def _slow(*args, **kwargs):
        time.sleep(1.2)
        raise orchestrator.EvaluationError("too late", "late")

    monkeypatch.setattr(orchestrator, "evaluate_submission", _slow)
    with app.app_context():
        job = GradingJob(
            submission_type="assignment", submission_id=910003,
            assessment_kind="assignment", assessment_id=1,
            status=JOB_RUNNING, attempts=1, max_attempts=3,
            timeout_seconds=1, locked_by="worker",
        )
        db.session.add(job)
        db.session.commit()
        outcome = jobs.run_job(job, persist=False)
        assert outcome["status"] == JOB_TIMED_OUT
        assert GradingJob.query.get(job.id).status == JOB_TIMED_OUT


def test_worker_startup_is_guarded_and_wired_without_spawning(app, monkeypatch):
    import main

    # The real guard must refuse to start a worker inside pytest.
    assert main._aage_worker_enabled() is False

    class FakeThread:
        def __init__(self):
            self.alive = False

        def is_alive(self):
            return self.alive

    thread = FakeThread()
    calls = {"starts": 0, "recovery": None}
    monkeypatch.setattr(main, "_aage_worker_enabled", lambda: True)
    monkeypatch.setattr(main, "_aage_worker_thread", None)
    monkeypatch.setattr(main.atexit, "register", lambda *a, **k: None)

    def _start(application, *, poll_interval=2.0):
        calls["starts"] += 1
        calls["application"] = application
        calls["poll"] = poll_interval
        return thread

    def _recover(**kwargs):
        calls["recovery"] = kwargs
        return 1

    monkeypatch.setattr(jobs, "start_worker", _start)
    monkeypatch.setattr(jobs, "recover_stale", _recover)

    assert main.start_aage_worker(app) is thread
    assert calls["starts"] == 1
    assert calls["application"] is app
    assert "timeout_seconds" in calls["recovery"]

    thread.alive = True
    assert main.start_aage_worker(app) is thread
    assert calls["starts"] == 1, "a live worker must not be started twice"
