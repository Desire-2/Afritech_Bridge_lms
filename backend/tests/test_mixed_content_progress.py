"""Mixed-content background generation reports real progress.

The instructor's "AI Generate Mixed" button polls /task/<id>/status. The
single-step background wrapper used to freeze that bar at 10% with a generic
description for the entire run, and never forwarded task_id into the
generator — so rate-limit countdowns never surfaced either. Each milestone
below must correspond to an actual event (model call started, response
parsed, retry triggered), never a time-based estimate.

M-1  run_single_step_background forwards task_id to methods that accept it
M-2  the service passes task_id through to the generator
M-3  the generator reports request → structure milestones (rich path)
M-4  the thin-text retry path reports the expansion milestone
M-5  the unparseable-response path reports the fallback milestone
"""

import json
import sys
from datetime import datetime
from unittest.mock import patch

import pytest

from src.services.ai.lesson_generator import lesson_generator
from src.services.ai.task_manager import TaskInfo, TaskStatus, task_manager
from src.services.ai_agent_service import ai_agent_service

# The services.ai package re-exports the generator singleton under the same
# name as its submodule, so bind the MODULE through sys.modules to patch the
# rate-limit handler where lesson_generator actually looks it up.
lesson_generator_module = sys.modules["src.services.ai.lesson_generator"]

PHASE_REQUEST = (1, 3, "Requesting lesson sections from the model...")
PHASE_STRUCTURE = (2, 3, "Structuring sections for the editor...")
PHASE_EXPAND = (2, 3, "Text sections too short - expanding the lesson...")
PHASE_FALLBACK = (2, 3, "No valid sections - building a fallback template...")


def _sections_payload(sections):
    return json.dumps({"sections": sections})


RICH_SECTIONS = [
    {"type": "heading", "content": "Introduction"},
    {"type": "text", "content": " ".join(["word"] * 40)},
    {"type": "video", "url": "https://example.test/v.mp4", "title": "Demo"},
    {"type": "heading", "content": "Key Takeaways"},
    {"type": "text", "content": " ".join(["point"] * 40)},
]
THIN_SECTIONS = [
    {"type": "text", "content": "too short"},
]


@pytest.fixture
def mixed_task():
    task_id = "test-mixed-progress"
    task_manager.tasks[task_id] = TaskInfo(
        task_id=task_id,
        task_type="generate-mixed-content",
        status=TaskStatus.IN_PROGRESS,
        created_at=datetime.utcnow().isoformat(),
    )
    yield task_id
    task_manager.tasks.pop(task_id, None)


def _phase_calls(spy):
    """(step, total, description) per update_progress call, in order."""
    return [(c.args[1], c.args[2], c.args[3]) for c in spy.call_args_list]


def test_single_step_wrapper_forwards_task_id_and_completes(mixed_task):
    seen = {}

    def fake_mixed(task_id=None, **kwargs):
        seen["task_id"] = task_id
        return {"sections": []}

    with patch.object(ai_agent_service, "generate_mixed_content", new=fake_mixed):
        result = ai_agent_service.run_single_step_background(
            task_id=mixed_task,
            method_name="generate_mixed_content",
            method_kwargs={"course_title": "Course"},
        )

    assert seen["task_id"] == mixed_task
    assert result["sections"] == []
    task = task_manager.tasks[mixed_task]
    assert task.progress == 100.0
    assert task.current_step_description == "Content generated"


def test_service_forwards_task_id_to_generator():
    captured = {}

    def fake_generator(*args, **kwargs):
        captured.update(kwargs)
        return {"sections": RICH_SECTIONS}

    with patch.object(ai_agent_service.lesson_gen, "generate_mixed_content", new=fake_generator):
        response = ai_agent_service.generate_mixed_content(
            "Course", "Module", "desc", "Lesson", task_id="tid-forward"
        )

    assert captured.get("task_id") == "tid-forward"
    assert response.data.get("sections") == RICH_SECTIONS


def test_rich_path_reports_request_and_structure(mixed_task):
    with patch.object(
        lesson_generator_module.rate_limit_handler,
        "execute_with_retry",
        return_value=(_sections_payload(RICH_SECTIONS), "nvidia"),
    ), patch.object(
        task_manager, "update_progress", wraps=task_manager.update_progress
    ) as spy:
        result = lesson_generator.generate_mixed_content(
            "Course", "Module", "desc", "Lesson", task_id=mixed_task
        )

    assert _phase_calls(spy) == [PHASE_REQUEST, PHASE_STRUCTURE]
    assert len(result["sections"]) == 5
    assert task_manager.tasks[mixed_task].progress == 66.7


def test_thin_text_retry_reports_expansion(mixed_task):
    responses = [
        (_sections_payload(THIN_SECTIONS), "nvidia"),
        (_sections_payload(RICH_SECTIONS), "nvidia"),
    ]
    with patch.object(
        lesson_generator_module.rate_limit_handler,
        "execute_with_retry",
        side_effect=responses,
    ), patch.object(
        task_manager, "update_progress", wraps=task_manager.update_progress
    ) as spy:
        result = lesson_generator.generate_mixed_content(
            "Course", "Module", "desc", "Lesson",
            template_id="intro-video-summary", task_id=mixed_task,
        )

    assert _phase_calls(spy) == [
        PHASE_REQUEST, PHASE_STRUCTURE, PHASE_EXPAND, PHASE_STRUCTURE,
    ]
    # Retry produced every template text slot with rich prose.
    text_counts = [
        len(s["content"].split())
        for s in result["sections"]
        if s["type"] == "text"
    ]
    assert text_counts and all(count >= 30 for count in text_counts)


def test_unparseable_response_reports_fallback(mixed_task):
    with patch.object(
        lesson_generator_module.rate_limit_handler,
        "execute_with_retry",
        return_value=(None, "nvidia"),
    ), patch.object(
        task_manager, "update_progress", wraps=task_manager.update_progress
    ) as spy:
        result = lesson_generator.generate_mixed_content(
            "Course", "Module", "desc", "Lesson", task_id=mixed_task
        )

    assert _phase_calls(spy) == [PHASE_REQUEST, PHASE_FALLBACK]
    assert result["sections"], "fallback still returns usable sections"
