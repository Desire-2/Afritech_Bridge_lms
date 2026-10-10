"""Workflow engine — the AUTHORITATIVE scheduler & executor.

Responsibilities
----------------
* Owns workflow/task state transitions (agents cannot mutate state).
* Creates the initial pipeline graph, performs dynamic task discovery
  (content tasks after curriculum, repairs/inspection after stages).
* Walks the DAG by run-order, executing one agent per tick (deterministic).
* Records events + quality reviews, computes progress, snapshots checkpoints.
* Recovers stale RUNNING tasks on resume; supports cancellation.
* Idempotent: re-running on a finished workflow is a no-op; resuming a
  partial workflow continues only from incomplete work (with the last
  checkpoint as the source of truth for already-accepted content).

Execution model: `run_once(workflow)` performs a full scheduling pass — it
keeps executing ready tasks until a pass makes no further progress (bounded
to a fixed number of passes per call to protect against runaway loops).
Parallelism happens at the workflow level (many workflows may run at once);
within a workflow execution is sequential for determinism.
"""

from __future__ import annotations

import json
import logging
import threading
import uuid
from typing import Any, Callable, Dict, List, Optional, Tuple

from ....models.workflow_models import (
    CourseWorkflow,
    WorkflowTask,
    TaskDependency,
    WorkflowEvent,
    QualityReview,
    AgentResultStatus,
    WorkflowStatus,
    WorkflowTaskStatus,
)
from ....models.user_models import db
from ....utils.time_utils import now_local
from ..providers import config as provider_config

from . import state as wf_state
from . import discovery
from .events import record_event, _next_seq

logger = logging.getLogger(__name__)

#: A RUNNING task older than this (seconds) is considered stale & recoverable.
LEASE_SECONDS = 300
#: Max ticks per run_once pass before yielding (protection against runaway).
MAX_PASSES_PER_RUN = 200


class WorkflowEngine:
    """Schedules and executes workflow tasks."""

    def __init__(self):
        self._active: Dict[str, bool] = {}          # workflow_id -> running
        self._lock = threading.Lock()
        self.agent_factory: Optional[Callable] = None  # tests can override

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def start_workflow(self, workflow: CourseWorkflow, *, input_data: Dict[str, Any],
                       preferences: Dict[str, Any], user_id: int,
                       provider: Optional[str] = None) -> CourseWorkflow:
        """Reset any prior state and (re)build the pipeline graph, then run it."""
        if workflow.id is None:
            db.session.add(workflow)
            db.session.flush()
        existing_tasks = WorkflowTask.query.filter_by(workflow_id=workflow.id).all()
        for t in existing_tasks:
            TaskDependency.query.filter_by(task_id=t.id).delete()
            db.session.delete(t)
        db.session.flush()

        workflow.set_input(input_data)
        workflow.set_preferences(preferences)
        workflow.set_workspace({"plan": {}, "stats": {}, "needs_review": 0,
                                "repair_log": []})
        workflow.status = WorkflowStatus.PLANNING
        workflow.current_stage = "planning"
        workflow.progress = 0.0
        workflow.started_at = now_local()
        workflow.completed_at = None
        workflow.cancelled_at = None
        workflow.error_message = None
        workflow.set_provider_chain([provider or provider_config.DEFAULT_AI_PROVIDER]
                                    + provider_config.FALLBACK_PROVIDER_ORDER)

        # --- initial skeleton -------------------------------------------
        planning = self._create_task(
            workflow, agent_type="planning_agent", task_type="planning",
            title="Plan the course", run_order=0,
            input_data={"topic": input_data.get("topic"),
                        "target_audience": preferences.get("target_audience", ""),
                        "learning_objectives": preferences.get("learning_objectives", ""),
                        "preferences": preferences},
        )
        curriculum = self._create_task(
            workflow, agent_type="curriculum_agent", task_type="curriculum",
            title="Refine the course plan", run_order=1,
            input_data={}, dependencies=[planning],
        )
        record_event(workflow.id, "workflow.started",
                     {"workflow_id": workflow.id}, commit=False)
        db.session.commit()
        return workflow

    def resume_workflow(self, workflow: CourseWorkflow) -> bool:
        """Recover stale runs and resume. Returns True if any work remains."""
        if workflow.status in (WorkflowStatus.COMPLETED, WorkflowStatus.CANCELLED):
            return False
        self._recover_stale_tasks(workflow)
        if workflow.status == WorkflowStatus.FAILED:
            workflow.status = WorkflowStatus.GENERATING
            workflow.error_message = None
            db.session.flush()
        return self.run_once(workflow)

    def cancel_workflow(self, workflow: CourseWorkflow) -> None:
        workflow.status = WorkflowStatus.CANCELLED
        workflow.cancelled_at = now_local()
        pending = WorkflowTask.query.filter_by(
            workflow_id=workflow.id,
        ).filter(
            WorkflowTask.status.in_([WorkflowTaskStatus.PENDING,
                                     WorkflowTaskStatus.READY,
                                     WorkflowTaskStatus.RUNNING])
        ).all()
        for t in pending:
            t.status = WorkflowTaskStatus.CANCELLED
        record_event(workflow.id, "workflow.cancelled",
                     {"workflow_id": workflow.id}, commit=False)
        db.session.commit()

    def is_running(self, workflow_id: str) -> bool:
        with self._lock:
            return self._active.get(workflow_id, False)

    def has_pending_work(self, workflow: CourseWorkflow) -> bool:
        count = (
            WorkflowTask.query.filter_by(workflow_id=workflow.id)
            .filter(WorkflowTask.status.in_([WorkflowTaskStatus.PENDING,
                                             WorkflowTaskStatus.READY,
                                             WorkflowTaskStatus.RUNNING]))
            .count()
        )
        return count > 0

    # ------------------------------------------------------------------
    # Scheduler
    # ------------------------------------------------------------------
    def run_once(self, workflow: CourseWorkflow, max_passes: int = MAX_PASSES_PER_RUN) -> bool:
        """Execute a bounded scheduler pass. Returns True if it made progress."""
        passes = 0
        made_progress = False
        while passes < max_passes:
            passes += 1
            progressed = self._schedule_pass(workflow)
            if progressed:
                made_progress = True
            else:
                break
        return made_progress

    def _schedule_pass(self, workflow: CourseWorkflow) -> bool:
        with self._lock:
            if self._active.get(workflow.id, False):
                return False
            self._active[workflow.id] = True
        try:
            self._recover_stale_tasks(workflow)
            self._recover_failed_tasks(workflow)
            completed = self._collect_completed(workflow)

            # dynamic pipeline wiring ------------------------------------
            pipeline_step = self._advance_pipeline(workflow, completed)
            if pipeline_step is False:
                return False  # work finished

            ready = self._ready_tasks(workflow)
            if not ready:
                # nothing executable this pass — detect permanent stalls
                self._mark_stalled_if_blocked(workflow)
                return False

            task = ready[0]
            self._execute_task(workflow, task)
            prepared = self._prepare_next(workflow, task)
            return prepared or True
        finally:
            with self._lock:
                self._active[workflow.id] = False

    def _collect_completed(self, workflow: CourseWorkflow) -> List[WorkflowTask]:
        return (WorkflowTask.query
                .filter_by(workflow_id=workflow.id)
                .filter(WorkflowTask.status.in_([WorkflowTaskStatus.COMPLETED,
                                                 WorkflowTaskStatus.SKIPPED]))
                .all())

    # ------------------------------------------------------------------
    # Pipeline wiring (dynamic task discovery)
    # ------------------------------------------------------------------
    def _advance_pipeline(self, workflow: CourseWorkflow,
                          completed: List[WorkflowTask]):
        """Create stage tasks reactively. Returns False if the pipeline is
        fully finished (terminal state), else True once wiring settled."""
        if workflow.status in (WorkflowStatus.COMPLETED, WorkflowStatus.CANCELLED):
            return False

        done_agents = {t.agent_type for t in completed}
        plan_ready = "curriculum_agent" in done_agents and self._workspace_has_plan(workflow)
        content_created = self._task_exists(workflow, "module_agent") is not None

        # 1) after curriculum -> materialize content tasks
        if plan_ready and not content_created:
            plan = workflow.get_workspace().get("plan") or {}
            prefs = workflow.get_preferences()
            self._materialize_content_tasks(workflow, plan, prefs)
            content_created = True

        # 2) after all content tasks are done -> reviewer
        review_created = self._task_exists_by_type(
            workflow, "reviewer_agent") is not None
        content_tasks = WorkflowTask.query.filter_by(
            workflow_id=workflow.id, agent_type="lesson_agent").all()
        content_done = bool(content_tasks) and all(
            t.status in (WorkflowTaskStatus.COMPLETED, WorkflowTaskStatus.SKIPPED)
            for t in content_tasks)
        if content_done and not review_created:
            comps = self._collect_generated_components(workflow)
            if comps:
                reviewer = self._create_task(
                    workflow, agent_type="reviewer_agent", task_type="review",
                    title="Review all generated components", run_order=50,
                    input_data={"components": comps},
                    dependencies=[t.id for t in content_tasks],
                )
                completed.append(reviewer)

        # 3) after reviewer (and repairs) -> consistency
        consistency_created = self._task_exists_by_type(
            workflow, "consistency_agent") is not None
        reviewer = self._task_exists(workflow, "reviewer_agent")
        is_terminal = reviewer is not None and reviewer.status in (
            WorkflowTaskStatus.COMPLETED, WorkflowTaskStatus.SKIPPED)
        repairs = WorkflowTask.query.filter_by(
            workflow_id=workflow.id, agent_type="repair_agent").all()
        open_repairs = [t for t in repairs
                        if t.status in (WorkflowTaskStatus.PENDING,
                                        WorkflowTaskStatus.READY,
                                        WorkflowTaskStatus.RUNNING)]
        if is_terminal and not open_repairs and not consistency_created:
            deps = [reviewer.id] + [r.id for r in repairs if r.status in
                                    (WorkflowTaskStatus.COMPLETED,)]
            consistency = self._create_task(
                workflow, agent_type="consistency_agent", task_type="consistency",
                title="Cross-component consistency scan", run_order=60,
                input_data={
                    "plan": workflow.get_workspace().get("plan") or {},
                    "lesson_results": self._lesson_result_shapes(workflow),
                    "quiz_results": self._quiz_result_shapes(workflow),
                },
                dependencies=deps,
            )
            completed.append(consistency)

        # 4) after consistency -> completion (terminal)
        consistency = self._task_exists(workflow, "consistency_agent")
        if consistency is not None and consistency.status == WorkflowTaskStatus.COMPLETED:
            completion = self._task_exists_by_type(workflow, "completion_agent")
            if completion is None:
                self._create_task(
                    workflow, agent_type="completion_agent", task_type="completion",
                    title="Finalize workflow", run_order=100,
                    input_data={}, dependencies=[consistency.id],
                )
            else:
                all_terminal = all(
                    t.status in (WorkflowTaskStatus.COMPLETED, WorkflowTaskStatus.SKIPPED)
                    for t in WorkflowTask.query.filter_by(workflow_id=workflow.id)
                    .filter(WorkflowTask.status.in_([WorkflowTaskStatus.COMPLETED,
                                                     WorkflowTaskStatus.SKIPPED]))
                    .all())
                if all_terminal and not self._pending_or_running(workflow):
                    self._finalize(workflow)
                    return False
        db.session.flush()
        return True

    # ------------------------------------------------------------------
    # Task creation helpers
    # ------------------------------------------------------------------
    def _create_task(self, workflow, *, agent_type, task_type, title,
                     run_order, input_data: Optional[Dict] = None,
                     dependencies: Optional[List[str]] = None,
                     parent_task_id: Optional[str] = None) -> WorkflowTask:
        task = WorkflowTask(
            id=str(uuid.uuid4()),
            workflow_id=workflow.id,
            parent_task_id=parent_task_id,
            agent_type=agent_type,
            task_type=task_type,
            title=title,
            run_order=run_order,
            status=WorkflowTaskStatus.PENDING,
        )
        task.set_input(input_data or {})
        db.session.add(task)
        db.session.flush()
        for dep in (dependencies or []):
            dep_id = dep.id if isinstance(dep, WorkflowTask) else dep
            db.session.add(TaskDependency(task_id=task.id,
                                          depends_on_task_id=dep_id))
        record_event(workflow.id, "task.created",
                     {"task_id": task.id, "agent_type": agent_type,
                      "title": title}, task_id=task.id, commit=False)
        return task

    def _materialize_content_tasks(self, workflow, plan, preferences) -> None:
        descriptors = discovery.discover_content_tasks(plan, preferences)
        by_key: Dict[str, str] = {}
        order_counter = 10
        for desc in descriptors:
            deps: List[str] = []
            parent: Optional[str] = None
            if desc.get("parent_hint"):
                parent = by_key.get(desc["parent_hint"])
                if parent:
                    deps.append(parent)
            task = self._create_task(
                workflow, agent_type=desc["agent_type"],
                task_type=desc["task_type"], title=desc["title"],
                run_order=order_counter, input_data=desc["input_data"],
                dependencies=deps,
                parent_task_id=parent,
            )
            if desc.get("key"):
                by_key[desc["key"]] = task.id
            order_counter += 1
        record_event(workflow.id, "pipeline.content_materialized",
                     {"count": len(descriptors)}, commit=False)

    # ------------------------------------------------------------------
    # Task picking & dependencies
    # ------------------------------------------------------------------
    def _ready_tasks(self, workflow: CourseWorkflow) -> List[WorkflowTask]:
        now = now_local()
        # promote any PENDING task whose dependencies are satisfied
        for t in (WorkflowTask.query
                  .filter_by(workflow_id=workflow.id,
                             status=WorkflowTaskStatus.PENDING)
                  .all()):
            if self._deps_satisfied(t):
                t.status = WorkflowTaskStatus.READY
        db.session.flush()
        tasks = (WorkflowTask.query
                 .filter_by(workflow_id=workflow.id, status=WorkflowTaskStatus.READY)
                 .order_by(WorkflowTask.run_order.asc())
                 .all())
        ready = []
        for t in tasks:
            if t.scheduled_for and t.scheduled_for > now:
                continue
            ready.append(t)
        return ready

    def _deps_satisfied(self, task: WorkflowTask) -> bool:
        deps = task.dependency_ids()
        if not deps:
            return True
        rows = (WorkflowTask.query
                .filter(WorkflowTask.id.in_(deps))
                .all())
        id_status = {r.id: r.status for r in rows}
        satisfied = (WorkflowTaskStatus.COMPLETED, WorkflowTaskStatus.SKIPPED,
                     WorkflowTaskStatus.NEEDS_REVIEW)
        for dep in deps:
            status = id_status.get(dep)
            if status in satisfied:
                continue
            return False
        return True

    def _mark_ready_descendants(self, workflow: CourseWorkflow, task: WorkflowTask) -> None:
        children = WorkflowTask.query.filter_by(
            workflow_id=workflow.id, parent_task_id=task.id).all()
        all_tasks = (WorkflowTask.query
                     .filter_by(workflow_id=workflow.id)
                     .filter(WorkflowTask.status == WorkflowTaskStatus.PENDING)
                     .all())
        changed = False
        for child in all_tasks:
            if self._deps_satisfied(child) and child.status == WorkflowTaskStatus.PENDING:
                child.status = WorkflowTaskStatus.READY
                changed = True
        # tasks still PENDING that depend only on this completed node
        if changed:
            db.session.flush()

    # ------------------------------------------------------------------
    # Execution
    # ------------------------------------------------------------------
    def _execute_task(self, workflow: CourseWorkflow, task: WorkflowTask) -> None:
        task.status = WorkflowTaskStatus.RUNNING
        task.locked_at = now_local()
        task.lock_owner = "engine"
        task.started_at = now_local()
        db.session.commit()

        # inject parent output (e.g. lesson content into assessments)
        self._inject_parent_output(task)
        db.session.flush()

        record_event(workflow.id, "task.started",
                     {"task_id": task.id, "agent_type": task.agent_type},
                     task_id=task.id, commit=False)
        db.session.commit()

        try:
            agent = self._make_agent(task.agent_type, workflow)
            result = agent.execute(workflow, task)
        except Exception as exc:  # provider/agent raised
            logger.exception("agent %s crashed", task.agent_type)
            result = type("R", (), {
                "status": "failed", "data": None, "reasoning": "",
                "message": "Agent crashed", "error_code": "AGENT_CRASH",
                "error_message": str(exc), "new_tasks": [], "review": None,
                "agent": task.agent_type,
            })()

        task.attempts += 1
        task.reasoning = (result.reasoning or "")[:60000]
        task.result_status = result.status
        if result.data is not None:
            task.set_output({"data": result.data, "agent": result.agent
                             or task.agent_type})
        task.error_code = result.error_code
        task.error_message = result.error_message or (result.message or "")

        if result.status in ("success", "partial"):
            task.status = WorkflowTaskStatus.COMPLETED
        elif result.status == "needs_review":
            task.status = WorkflowTaskStatus.NEEDS_REVIEW
        else:
            task.status = WorkflowTaskStatus.FAILED
        task.completed_at = now_local()

        # quality review record
        if result.review:
            review = QualityReview(
                workflow_id=workflow.id, task_id=task.id,
                component_type=task.agent_type.replace("_agent", ""),
                target_id=task.target_id,
                score=float(result.review.get("score", 0.0)),
                passed=bool(result.review.get("passed", False)),
            )
            review.set_checks(result.review.get("checks") or {})
            db.session.add(review)

        event_payload = {
            "task_id": task.id,
            "agent_type": task.agent_type,
            "status": task.status.value if hasattr(task.status, "value") else str(task.status),
            "result_status": result.status,
            "message": result.message or "",
        }
        record_event(workflow.id, f"task.{task.status.value if hasattr(task.status, 'value') else 'done'}",
                     event_payload, task_id=task.id, commit=False)
        db.session.commit()

        # side effects --------------------------------------------------
        self._mark_ready_descendants(workflow, task)
        self._apply_generation_side_effects(workflow, task, result)
        db.session.commit()

    # ------------------------------------------------------------------
    # Side effects
    # ------------------------------------------------------------------
    def _apply_generation_side_effects(self, workflow, task, result) -> None:
        """Auto-create persistence (for content) and repair (for failures)."""
        # 0) planning/curriculum agents publish the plan to the workspace; the
        #    DAG scheduler (not the LLM) owns workflow state.
        if task.agent_type in ("planning_agent", "curriculum_agent"):
            data = result.data or {}
            if data.get("plan"):
                ws = workflow.get_workspace()
                ws["plan"] = data["plan"]
                workflow.set_workspace(ws)
                record_event(workflow.id, "plan.published",
                             {"plan_title": (data["plan"] or {}).get("title"),
                              "modules": len((data["plan"] or {}).get("modules") or [])},
                             task_id=task.id, commit=False)
        # 1) if the agent returned repair requests, schedule them (with cap)
        repair_tasks = getattr(result, "new_tasks", None) or []
        for repair in repair_tasks:
            if self._repair_fanout_reached(workflow, task):
                continue
            new = self._create_task(
                workflow, agent_type="repair_agent", task_type=repair.get("task_type", "repair"),
                title=repair.get("title", "Repair component"), run_order=70,
                input_data=repair.get("input_data") or {},
                dependencies=[task.id],
                parent_task_id=task.id,
            )
            record_event(workflow.id, "repair.requested",
                         {"task_id": new.id, "cause": task.id}, task_id=new.id,
                         commit=False)

        # 2) content that passed -> persistence child
        if task.agent_type in ("module_agent", "lesson_agent",
                               "assessment_agent") and \
                task.status in (WorkflowTaskStatus.COMPLETED, WorkflowTaskStatus.NEEDS_REVIEW):
            payload = (result.data or {})
            target_type = {
                "module_agent": "module",
                "lesson_agent": "lesson",
                "assessment_agent": "quiz",
            }[task.agent_type]
            if payload:
                existing_persist = (WorkflowTask.query
                                    .filter_by(workflow_id=workflow.id)
                                    .filter(WorkflowTask.task_type == "persist",
                                            WorkflowTask.parent_task_id == task.id)
                                    .first())
                if existing_persist is None:
                    self._create_task(
                        workflow, agent_type="persistence_agent",
                        task_type="persist",
                        title=f"Persist {target_type}", run_order=40,
                        input_data={"target_type": target_type, "data": payload},
                        dependencies=[task.id], parent_task_id=task.id,
                    )

        # 3) successful repair -> re-persist the repaired component
        if task.agent_type == "repair_agent" and result.status == "success":
            self._create_task(
                workflow, agent_type="persistence_agent", task_type="persist",
                title="Persist repaired component", run_order=45,
                input_data={"target_type": "lesson", "data": result.data},
                dependencies=[task.id], parent_task_id=task.id,
            )

        # workspace stats + progress
        self._update_progress(workflow)

    # ------------------------------------------------------------------
    # Progress / stats / finalize
    # ------------------------------------------------------------------
    def _update_progress(self, workflow) -> None:
        workspace = workflow.get_workspace()
        stats = workspace.setdefault("stats", {})
        for agent, key in (("module_agent", "modules"), ("lesson_agent", "lessons"),
                           ("assessment_agent", "quizzes"), ("repair_agent", "repairs")):
            count = (WorkflowTask.query.filter_by(workflow_id=workflow.id,
                                                  agent_type=agent)
                     .filter(WorkflowTask.status.in_([WorkflowTaskStatus.COMPLETED,
                                                      WorkflowTaskStatus.NEEDS_REVIEW]))
                     .count())
            stats[key] = count
        needs_review = (WorkflowTask.query.filter_by(workflow_id=workflow.id)
                        .filter(WorkflowTask.status == WorkflowTaskStatus.NEEDS_REVIEW)
                        .count())
        workspace["needs_review"] = needs_review
        workflow.set_workspace(workspace)

        completed_stages: Dict[str, int] = {}
        for task in WorkflowTask.query.filter_by(workflow_id=workflow.id).all():
            if task.status in (WorkflowTaskStatus.COMPLETED, WorkflowTaskStatus.SKIPPED):
                stage = wf_state.AGENT_STAGE.get(task.agent_type, "completion")
                completed_stages[stage] = completed_stages.get(stage, 0) + 1
        progress = wf_state.stage_progress(completed_stages)
        if needs_review:
            workflow.status = WorkflowStatus.NEEDS_REVIEW
            workflow.current_stage = "needs_review"
        elif workflow.status in (WorkflowStatus.PLANNING, WorkflowStatus.GENERATING,
                                 WorkflowStatus.REVIEWING):
            if "modules" in completed_stages:
                workflow.current_stage = "reviewing" if "validation" in completed_stages else "generating"
        workflow.progress = progress
        db.session.flush()

    def _finalize(self, workflow) -> None:
        # run the completion agent to summarize, then mark terminal
        task = self._task_exists_by_type(workflow, "completion_agent")
        summary_data = {}
        if task is not None and task.status == WorkflowTaskStatus.COMPLETED:
            summary_data = (task.get_output() or {}).get("data", {}).get("summary", {})
        workflow.current_stage = "completion"
        pending_review = workflow.get_workspace().get("needs_review") or 0
        if pending_review:
            workflow.status = WorkflowStatus.NEEDS_REVIEW
        else:
            workflow.status = WorkflowStatus.COMPLETED
        workflow.progress = 100.0
        workflow.completed_at = now_local()
        payload = {"summary": summary_data,
                   "needs_review": pending_review}
        record_event(workflow.id, "workflow.completed", payload, commit=False)
        db.session.flush()

    # ------------------------------------------------------------------
    # Recovery & cancellation support
    # ------------------------------------------------------------------
    def _mark_stalled_if_blocked(self, workflow: CourseWorkflow) -> None:
        """If work remains but every pending task is blocked behind a FAILED
        ancestor, transition the workflow to FAILED instead of hanging."""
        if workflow.status in (WorkflowStatus.COMPLETED, WorkflowStatus.CANCELLED,
                               WorkflowStatus.FAILED):
            return
        pending = (WorkflowTask.query
                   .filter_by(workflow_id=workflow.id)
                   .filter(WorkflowTask.status.in_([WorkflowTaskStatus.PENDING,
                                                    WorkflowTaskStatus.READY]))
                   .all())
        if not pending:
            return
        running = (WorkflowTask.query
                   .filter_by(workflow_id=workflow.id)
                   .filter(WorkflowTask.status == WorkflowTaskStatus.RUNNING).count())
        if running:
            return  # another worker may still be executing
        if not self._any_failed_ancestor(pending):
            return
        workflow.status = WorkflowStatus.FAILED
        workflow.error_message = "A required task failed; workflow is blocked."
        record_event(workflow.id, "workflow.failed",
                     {"reason": "blocked", "message": workflow.error_message},
                     commit=False)
        db.session.flush()

    def _any_failed_ancestor(self, tasks: List[WorkflowTask]) -> bool:
        seen: set = set()

        def walk(task_id: Optional[str]) -> bool:
            if not task_id or task_id in seen:
                return False
            seen.add(task_id)
            task = WorkflowTask.query.get(task_id)
            if task is None:
                return False
            if task.status == WorkflowTaskStatus.FAILED:
                return True
            return any(walk(dep) for dep in task.dependency_ids())

        return any(walk(dep) for t in tasks for dep in t.dependency_ids())

    def _recover_stale_tasks(self, workflow: CourseWorkflow) -> None:
        stale = (WorkflowTask.query
                 .filter_by(workflow_id=workflow.id,
                            status=WorkflowTaskStatus.RUNNING)
                 .filter(WorkflowTask.locked_at.isnot(None))
                 .all())
        import datetime
        threshold = datetime.timedelta(seconds=LEASE_SECONDS)
        now = now_local()
        for t in stale:
            if t.locked_at and (now - t.locked_at) >= threshold:
                logger.warning("recovering stale task %s", t.id)
                t.status = WorkflowTaskStatus.READY
                t.locked_at = None
        db.session.flush()

    def _recover_failed_tasks(self, workflow: CourseWorkflow) -> None:
        """Reset FAILED tasks that still have retry budget so transient
        agent/provider errors don't permanently deadlock the workflow."""
        if workflow.status in (WorkflowStatus.COMPLETED, WorkflowStatus.CANCELLED):
            return
        failed = (WorkflowTask.query
                  .filter_by(workflow_id=workflow.id,
                             status=WorkflowTaskStatus.FAILED)
                  .all())
        changed = False
        for t in failed:
            if t.attempts < t.max_attempts:
                t.status = WorkflowTaskStatus.READY
                t.locked_at = None
                t.lock_owner = None
                record_event(workflow.id, "task.retried",
                             {"task_id": t.id, "agent_type": t.agent_type,
                              "attempt": t.attempts + 1,
                              "max_attempts": t.max_attempts},
                             task_id=t.id, commit=False)
                changed = True
        if changed:
            db.session.flush()

    # ------------------------------------------------------------------
    # helpers
    # ------------------------------------------------------------------
    def _make_agent(self, agent_type: str, workflow: CourseWorkflow):
        from ..agents.base import AgentRegistry
        from ..agents import load_all
        load_all()
        cls = AgentRegistry.get(agent_type)
        if cls is None:
            raise ValueError(f"Unknown agent type: {agent_type}")
        if self.agent_factory is not None:
            return self.agent_factory(agent_type, workflow)
        kwargs: Dict[str, Any] = {}
        llm = self._llm_client(workflow)
        if llm is not None:
            kwargs["llm_client"] = llm
        return cls(**kwargs)

    def _llm_client(self, workflow: CourseWorkflow):
        try:
            from ..agents.llm import LLMClient
            return LLMClient(user_id=workflow.instructor_id,
                             provider=self._pref_provider(workflow))
        except Exception:  # pragma: no cover
            return None

    @staticmethod
    def _pref_provider(workflow: CourseWorkflow) -> Optional[str]:
        try:
            return workflow.get_preferences().get("provider")
        except Exception:
            return None

    def _inject_parent_output(self, task: WorkflowTask) -> None:
        if task.agent_type == "assessment_agent":
            parents = (
                WorkflowTask.query
                .filter(WorkflowTask.id.in_(task.dependency_ids()))
                .filter(WorkflowTask.agent_type == "lesson_agent")
                .all()
            )
            for parent in parents:
                output = parent.get_output() or {}
                data = output.get("data") or {}
                inp = task.get_input()
                inp["lesson_content"] = data.get("content_data") or ""
                task.set_input(inp)
                break

    def _repair_fanout_reached(self, workflow, task) -> bool:
        existing = (WorkflowTask.query
                    .filter_by(workflow_id=workflow.id, agent_type="repair_agent")
                    .filter(WorkflowTask.parent_task_id == task.id)
                    .count())
        return existing >= wf_state.MAX_REPAIR_ATTEMPTS_PER_TASK

    def _workspace_has_plan(self, workflow) -> bool:
        ws = workflow.get_workspace()
        plan = ws.get("plan") or {}
        return bool(plan.get("modules"))

    def _task_exists(self, workflow, agent_type) -> Optional[WorkflowTask]:
        return (WorkflowTask.query
                .filter_by(workflow_id=workflow.id, agent_type=agent_type)
                .first())

    def _task_exists_by_type(self, workflow, agent_type) -> Optional[WorkflowTask]:
        return self._task_exists(workflow, agent_type)

    def _collect_generated_components(self, workflow) -> List[Dict[str, Any]]:
        comps = []
        for agent in ("module_agent", "lesson_agent", "assessment_agent"):
            tasks = (WorkflowTask.query
                     .filter_by(workflow_id=workflow.id, agent_type=agent)
                     .filter(WorkflowTask.status.in_([WorkflowTaskStatus.COMPLETED,
                                                      WorkflowTaskStatus.NEEDS_REVIEW]))
                     .all())
            for t in tasks:
                output = t.get_output() or {}
                comps.append({
                    "component_type": {"module_agent": "module",
                                       "lesson_agent": "lesson",
                                       "assessment_agent": "quiz"}[agent],
                    "title": t.title,
                    "data": output.get("data") or {},
                })
        return comps

    def _lesson_result_shapes(self, workflow) -> List[Dict[str, Any]]:
        out = []
        for t in (WorkflowTask.query
                  .filter_by(workflow_id=workflow.id, agent_type="lesson_agent")
                  .filter(WorkflowTask.status.in_([WorkflowTaskStatus.COMPLETED,
                                                   WorkflowTaskStatus.NEEDS_REVIEW]))
                  .all()):
            output = t.get_output() or {}
            data = output.get("data") or {}
            out.append({"lesson_title": t.title or data.get("title"),
                        "module_title": data.get("module_title"),
                        "content_len": len(str(data.get("content_data") or ""))})
        return out

    def _quiz_result_shapes(self, workflow) -> List[Dict[str, Any]]:
        out = []
        for t in (WorkflowTask.query
                  .filter_by(workflow_id=workflow.id,
                             agent_type="assessment_agent")
                  .filter(WorkflowTask.status.in_([WorkflowTaskStatus.COMPLETED,
                                                   WorkflowTaskStatus.NEEDS_REVIEW]))
                  .all()):
            output = t.get_output() or {}
            data = output.get("data") or {}
            out.append({"lesson_title": data.get("lesson_title"),
                        "questions": len(data.get("questions") or [])})
        return out

    def _pending_or_running(self, workflow) -> bool:
        return (WorkflowTask.query
                .filter_by(workflow_id=workflow.id)
                .filter(WorkflowTask.status.in_([WorkflowTaskStatus.PENDING,
                                                 WorkflowTaskStatus.READY,
                                                 WorkflowTaskStatus.RUNNING]))
                .count()) > 0

    def _prepare_next(self, workflow, task) -> bool:
        """Refresh READY statuses after a task just finished."""
        advanced = False
        for t in (WorkflowTask.query
                  .filter_by(workflow_id=workflow.id,
                             status=WorkflowTaskStatus.PENDING)
                  .all()):
            if self._deps_satisfied(t):
                t.status = WorkflowTaskStatus.READY
                advanced = True
        db.session.flush()
        return advanced


#: module-level engine instance
workflow_engine = WorkflowEngine()