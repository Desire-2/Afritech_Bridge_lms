"""Persistence agent — materialize validated payloads with versioning.

Writes course/module/lesson/quiz rows and records an immutable
``CourseGenerationVersion`` for every write so instructor edits are never
silently overwritten without an audit trail.

Idempotency: if the incoming payload hash equals the last persisted version's
hash, nothing is written (the engine simply reuses existing target ids).
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from ....models.course_models import Course, Module, Lesson, Quiz, Question, Answer
from ....models.workflow_models import CourseGenerationVersion
from ....models.user_models import db
from ....utils.time_utils import now_local
from ..sanitizer import content_hash, clean_string
from .base import AgentResult, BaseAgent

logger = logging.getLogger(__name__)


class PersistenceAgent(BaseAgent):
    agent_type = "persistence_agent"
    profile = "formatting"
    title = "Persistence Agent"

    def execute(self, workflow, task) -> AgentResult:
        task_input = task.get_input() or {}
        target_type = task_input.get("target_type", "lesson")
        inbound = task_input.get("data") or {}

        try:
            course = self._ensure_course(workflow, inbound)
        except Exception as exc:  # noqa: BLE001
            logger.exception("persistence failed to ensure course")
            return AgentResult.failed(
                f"Could not ensure course record: {exc}", code="PERSIST_COURSE")

        if target_type == "module":
            return self._persist_module(workflow, course, inbound, task)
        if target_type == "lesson":
            return self._persist_lesson(workflow, course, inbound, task)
        if target_type == "quiz":
            return self._persist_quiz(workflow, course, inbound, task)
        return AgentResult.failed(
            f"Unknown persistence target_type '{target_type}'",
            code="PERSIST_TARGET")

    # ------------------------------------------------------------------
    def _ensure_course(self, workflow, inbound: Dict[str, Any]) -> Course:
        """Reuse workflow's course or create it from the plan."""
        if workflow.course_id:
            course = Course.query.get(workflow.course_id)
            if course:
                return course
        plan = workflow.get_workspace().get("plan") or {}
        title = clean_string(inbound.get("course_title")
                             or plan.get("title") or workflow.title or "Untitled Course",
                             200, 200)
        existing = Course.query.filter_by(title=title).first()
        if existing:
            workflow.course_id = existing.id
            db.session.flush()
            return existing
        course = Course(
            title=title,
            description=clean_string(inbound.get("course_description")
                                     or plan.get("description"), "", 4000),
            learning_objectives=clean_string(inbound.get("course_objectives")
                                             or plan.get("learning_objectives"), "", 4000),
            target_audience=clean_string(inbound.get("target_audience")
                                         or plan.get("target_audience"), "", 1000),
            estimated_duration=clean_string(inbound.get("estimated_duration")
                                            or plan.get("estimated_duration"), "", 200),
            instructor_id=workflow.instructor_id,
            is_published=False,
        )
        db.session.add(course)
        db.session.flush()
        workflow.course_id = course.id
        return course

    def _find_or_create_module(self, course_id: int, title: str,
                               description: str, objectives: str,
                               order: int) -> Module:
        module = Module.query.filter_by(course_id=course_id, title=title).first()
        if module:
            module.description = description
            module.learning_objectives = objectives
            module.order = order
            return module
        module = Module(
            title=title, description=description, learning_objectives=objectives,
            course_id=course_id, order=order, is_published=False, is_released=False,
        )
        db.session.add(module)
        db.session.flush()
        return module

    def _find_or_create_lesson(self, module_id: int, title: str, description: str,
                               objectives: str, content_data: str,
                               content_type: str, order: int,
                               duration_minutes: Optional[int]) -> Lesson:
        lesson = Lesson.query.filter_by(module_id=module_id, title=title).first()
        if lesson:
            lesson.description = description
            lesson.learning_objectives = objectives
            lesson.content_data = content_data or ""
            lesson.content_type = content_type or "text"
            lesson.duration_minutes = duration_minutes
            lesson.order = order
            return lesson
        lesson = Lesson(
            title=title, description=description, learning_objectives=objectives,
            content_data=content_data or "", content_type=content_type or "text",
            module_id=module_id, order=order, duration_minutes=duration_minutes,
            is_published=False,
        )
        db.session.add(lesson)
        db.session.flush()
        return lesson

    def _link_lesson_for_quiz(self, module_id: int, title: str) -> Lesson:
        """Find the real lesson; only create an empty placeholder if missing.
        Never rewrites existing lesson content (a quiz is not a lesson write)."""
        lesson = Lesson.query.filter_by(module_id=module_id, title=title).first()
        if lesson:
            return lesson
        lesson = Lesson(
            title=title, description="", learning_objectives="",
            content_data="", content_type="text", module_id=module_id,
            order=999, duration_minutes=None, is_published=False,
        )
        db.session.add(lesson)
        db.session.flush()
        return lesson

    def _record_version(self, workflow, course_id, component_type, target_id, payload) -> bool:
        """Persist an immutable version snapshot. Returns True if written (new)."""
        h = content_hash(payload)
        last = (
            CourseGenerationVersion.query
            .filter_by(component_type=component_type, target_id=target_id)
            .order_by(CourseGenerationVersion.version_number.desc())
            .first()
        )
        if last is not None and last.content_hash == h:
            return False  # identical — nothing new to persist
        version_number = (last.version_number + 1) if last else 1
        row = CourseGenerationVersion(
            workflow_id=workflow.id, course_id=course_id,
            component_type=component_type, target_id=target_id,
            version_number=version_number, content_hash=h,
            created_by=workflow.instructor_id,
        )
        row.set_content(payload)
        db.session.add(row)
        return True

    # ------------------------------------------------------------------
    def _persist_module(self, workflow, course, inbound, task) -> AgentResult:
        title = clean_string(inbound.get("title"), "Untitled Module", 255)
        order = int(inbound.get("order") or 0)
        module = self._find_or_create_module(
            course.id, title,
            clean_string(inbound.get("description"), "", 4000),
            clean_string(inbound.get("learning_objectives"), "", 4000),
            order,
        )
        self._record_version(workflow, course.id, "module", module.id, inbound)
        db.session.commit()
        return AgentResult.success(
            data={"target_type": "module", "target_id": module.id,
                  "course_id": course.id},
            agent=self.agent_type)

    def _persist_lesson(self, workflow, course, inbound, task) -> AgentResult:
        module_title = clean_string(inbound.get("module_title"), "Module 1", 255)
        module = self._find_or_create_module(
            course.id, module_title, "", "", 0)
        # lesson order within module: next available slot
        existing_max = db.session.query(db.func.max(Lesson.order)).filter(
            Lesson.module_id == module.id
        ).scalar() or 0
        order = int(inbound.get("order") if inbound.get("order") not in (None, 0)
                    else existing_max + 1)
        lesson = self._find_or_create_lesson(
            module.id,
            clean_string(inbound.get("title"), "Untitled Lesson", 255),
            clean_string(inbound.get("description"), "", 2000),
            clean_string(inbound.get("learning_objectives"), "", 4000),
            str(inbound.get("content_data") or ""),
            clean_string(inbound.get("content_type"), "text", 50),
            order,
            inbound.get("duration_minutes") or None,
        )
        self._record_version(workflow, course.id, "lesson", lesson.id, inbound)
        db.session.commit()
        return AgentResult.success(
            data={"target_type": "lesson", "target_id": lesson.id,
                  "module_id": module.id, "course_id": course.id},
            agent=self.agent_type)

    def _persist_quiz(self, workflow, course, inbound, task) -> AgentResult:
        lesson_title = clean_string(inbound.get("lesson_title"), "", 255)
        module_title = clean_string(inbound.get("module_title"), "", 255)
        module = self._find_or_create_module(course.id, module_title or "Module 1",
                                             "", "", 0)
        lesson = None
        if lesson_title:
            lesson = self._link_lesson_for_quiz(module.id, lesson_title)
        quiz = None
        if lesson is not None:
            quiz = Quiz.query.filter_by(lesson_id=lesson.id).first()
        if quiz is None:
            quiz = Quiz(
                title=clean_string(inbound.get("title"), f"{lesson_title} Quiz", 255),
                description=clean_string(inbound.get("description"), "", 2000),
                course_id=course.id, module_id=module.id,
                lesson_id=lesson.id if lesson else None,
                is_published=False,
                time_limit=int(inbound.get("time_limit") or 15),
                max_attempts=int(inbound.get("max_attempts") or 3),
                passing_score=int(inbound.get("passing_score") or 70),
                points_possible=100.0,
            )
            db.session.add(quiz)
            db.session.flush()

        # Replace questions for this quiz with the generated ones (versioned)
        self._replace_questions(quiz, inbound.get("questions") or [])
        self._record_version(workflow, course.id, "quiz", quiz.id, inbound)
        db.session.commit()
        return AgentResult.success(
            data={"target_type": "quiz", "target_id": quiz.id,
                  "lesson_id": lesson.id if lesson else None,
                  "module_id": module.id, "course_id": course.id},
            agent=self.agent_type)

    def _replace_questions(self, quiz, questions) -> None:
        Question.query.filter_by(quiz_id=quiz.id).delete()
        db.session.flush()
        for idx, q in enumerate(questions):
            if not isinstance(q, dict):
                continue
            question = Question(
                quiz_id=quiz.id,
                text=clean_string(q.get("question_text") or q.get("text"),
                                  f"Question {idx + 1}", 2000),
                question_type=clean_string(q.get("question_type"),
                                           "multiple_choice", 50),
                order=idx,
                points=float(q.get("points") or 10.0),
                explanation=clean_string(q.get("explanation"), "", 2000),
            )
            db.session.add(question)
            db.session.flush()
            options = q.get("options") or []
            if options:
                # append true/false variants when short answers lack options
                correct_key = str(q.get("correct_answer") or "").strip().upper()
                for opt in options:
                    if not isinstance(opt, dict):
                        continue
                    is_correct = bool(opt.get("is_correct"))
                    if not is_correct and correct_key and \
                            str(opt.get("key", "")).strip().upper() == correct_key:
                        is_correct = True
                    db.session.add(Answer(
                        question_id=question.id,
                        text=clean_string(opt.get("text"), "", 1000),
                        is_correct=is_correct,
                    ))
            else:
                db.session.add(Answer(question_id=question.id, text="True",
                                      is_correct=True))
                db.session.add(Answer(question_id=question.id, text="False",
                                      is_correct=False))
            db.session.flush()