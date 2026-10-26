"""Prompt-level tests for hierarchical (build-on-previous) content generation.

Locks in the contract that generation prompts:
- split lessons into PRIOR KNOWLEDGE (taught) vs UPCOMING (planned stubs),
- render per-lesson covered_topics so repetition can be detected,
- state the HIERARCHY CONTRACT (bridge, never re-teach, forward-reference),
- return builds_on / assumes_knowledge metadata for the next generation step.

No AI calls: execute_with_retry is stubbed to capture the prompt.
"""

import json
from types import SimpleNamespace

import pytest

from src.services.ai.rate_limit_handler import rate_limit_handler
from src.services.ai.lesson_generator import lesson_generator
from src.services.ai.course_generator import course_generator
from src.routes.ai_agent_routes import _extract_lesson_topics, _lesson_context_data


# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------

@pytest.fixture()
def captured_prompts(monkeypatch):
    """Stub the AI call: record prompts, return canned JSON by shape."""
    prompts = []

    def _fake(fn, prompt, **kwargs):
        prompts.append(prompt)
        if '"lessons": [' in prompt and '"sections"' not in prompt and '"modules"' not in prompt:
            body = {
                "lessons": [
                    {"order": 4, "title": "Graceful Shutdown Patterns", "description": "Goroutines and channels",
                     "learning_objectives": "• Use goroutines", "duration_minutes": 45,
                     "builds_on": ["Arrays and Slices"]},
                ]
            }
        elif '"sections"' in prompt:
            body = {
                "title": "Arrays and Slices", "description": "Work with arrays.",
                "learning_objectives": ["Use arrays"], "duration_minutes": 60,
                "builds_on": ["Intro to Variables"], "assumes_knowledge": ["variables"],
                "sections": [
                    {"id": "introduction", "heading": "Introduction", "description": "bridge",
                     "target_words": 500, "key_topics": ["bridge"]},
                    {"id": "section_1", "heading": "Core Concepts", "description": "core",
                     "target_words": 600, "key_topics": ["arrays"]},
                ],
            }
        elif '"modules"' in prompt:
            body = {"modules": [{"title": "Module 3: Advanced Patterns", "description": "d",
                                 "learning_objectives": "• o", "order": 3, "suggested_lessons": []}]}
        elif "SECTION TO WRITE" in prompt:
            return "# Section\n\nBody text", "fake"
        else:
            body = {"title": "Concurrency Basics", "description": "d",
                    "learning_objectives": "• o", "duration_minutes": 60,
                    "content_type": "text", "builds_on": ["Arrays and Slices"],
                    "assumes_knowledge": ["slicing"], "content_data": "# Introduction\n\n..."}
        return json.dumps(body), "fake"

    monkeypatch.setattr(rate_limit_handler, "execute_with_retry", _fake)
    return prompts


def _lesson_seq():
    """Module sequence: one taught lesson, target lesson (stub), one planned."""
    return [
        {"title": "Intro to Variables", "description": "Vars", "order": 1,
         "duration_minutes": 30, "content_summary": "What is a variable; Declaring variables",
         "covered_topics": ["What is a variable", "Declaring variables"], "has_content": True},
        {"title": "Arrays and Slices", "description": "Arrays", "order": 2,
         "duration_minutes": 40, "content_summary": "", "covered_topics": [], "has_content": False},
        {"title": "Concurrency Basics", "description": "Goroutines", "order": 3,
         "duration_minutes": 45, "content_summary": "", "covered_topics": [], "has_content": False},
    ]


def _course_ctx():
    return [
        {"title": "Module 1: Foundations", "description": "Basics", "order": 1,
         "learning_objectives": "Understand the basics",
         "lessons": [
             {"title": "Intro to Variables", "description": "Vars", "order": 1,
              "duration_minutes": 30, "content_summary": "What is a variable; Declaring variables",
              "covered_topics": ["What is a variable", "Declaring variables"], "has_content": True},
             {"title": "Arrays and Slices", "description": "Arrays", "order": 2,
              "duration_minutes": 40, "content_summary": "", "covered_topics": [], "has_content": False},
         ]},
        {"title": "Module 2: Applied", "description": "Applied work", "order": 2,
         "learning_objectives": "Apply the basics",
         "lessons": [
             {"title": "Build a CLI", "description": "CLI", "order": 1,
              "duration_minutes": 60, "content_summary": "Argument parsing; Output handling",
              "covered_topics": ["Argument parsing", "Output handling"], "has_content": True},
         ]},
    ]


# ---------------------------------------------------------------------------
# Context extraction
# ---------------------------------------------------------------------------

def test_extract_lesson_topics_from_markdown():
    md = "# Arrays and Slices\n\nIntro...\n\n## Declaring arrays\n\ntext\n\n## Slicing rules\n\ntext\n\n## Declaring arrays\n\ndup"
    topics, summary = _extract_lesson_topics(md)
    assert topics == ["Declaring arrays", "Slicing rules"]  # dedup, ## only
    assert "Declaring arrays" in summary


def test_extract_lesson_topics_ignores_placeholder_stubs():
    topics, summary = _extract_lesson_topics("# New Lesson\n\nContent to be developed...")
    assert topics == [] and summary == ""


def test_lesson_context_data_flags_content_state():
    stub = SimpleNamespace(title="Planned", description="d", order=2,
                           duration_minutes=30, content_data="# Planned\n\nContent to be developed...")
    ctx = _lesson_context_data(stub)
    assert ctx["has_content"] is False and ctx["covered_topics"] == []

    real = SimpleNamespace(title="Done", description="d", order=1,
                           duration_minutes=30, content_data="## Topic A\n\ntext")
    ctx = _lesson_context_data(real)
    assert ctx["has_content"] is True and ctx["covered_topics"] == ["Topic A"]


# ---------------------------------------------------------------------------
# Shared context renderer
# ---------------------------------------------------------------------------

def test_context_text_renders_hierarchy_labels_and_topics():
    text = lesson_generator._build_course_context_text(_course_ctx(), "Module 1: Foundations")
    assert "PRIOR KNOWLEDGE — already taught" in text
    assert "UPCOMING — planned, not yet written" in text
    assert "Topics covered: What is a variable; Declaring variables" in text
    assert "HIERARCHY RULES" in text
    assert "← CURRENT MODULE" in text


def test_course_generator_context_text_renders_hierarchy():
    text = course_generator._build_course_context_text(_course_ctx())
    assert "PRIOR KNOWLEDGE — already taught" in text
    assert "UPCOMING — planned, not yet written" in text
    assert "Topics: What is a variable; Declaring variables" in text
    assert "HIERARCHY RULES" in text


# ---------------------------------------------------------------------------
# Lesson prompts
# ---------------------------------------------------------------------------

def test_lesson_prompt_contract_and_target_exclusion(captured_prompts):
    lesson_generator.generate_lesson_content(
        course_title="Go Fundamentals", module_title="Module 1: Foundations",
        module_description="desc", module_objectives="obj",
        lesson_title="Arrays and Slices", lesson_description="Work with arrays",
        existing_lessons=_lesson_seq(), course_context=_course_ctx(),
    )
    prompt = captured_prompts[0]

    # prior/upcoming split with the target lesson excluded from both lists
    assert "PRIOR KNOWLEDGE — lessons the learner has ALREADY STUDIED" in prompt
    assert "UPCOMING PLANNED LESSONS in this module" in prompt
    assert "Concurrency Basics" in prompt              # planned sibling kept
    assert "[CONTEXT: the lesson you are writing sits AFTER the 1 prior-knowledge" in prompt
    assert "Topics covered: What is a variable; Declaring variables" in prompt

    # hierarchy contract + metadata in the JSON schema
    assert "HIERARCHY CONTRACT — BUILD ON WHAT CAME BEFORE" in prompt
    assert '"builds_on"' in prompt and '"assumes_knowledge"' in prompt
    assert "Building on previous lessons" in prompt    # bridge requirement
    assert "never re-teach" in prompt or "ASSUME, NEVER RETEACH" in prompt


def test_lesson_prompt_append_branch_numbers_next_lesson(captured_prompts):
    lesson_generator.generate_lesson_content(
        course_title="Go Fundamentals", module_title="Module 1: Foundations",
        module_description="desc", module_objectives="obj",
        existing_lessons=_lesson_seq(), course_context=_course_ctx(),
    )
    prompt = captured_prompts[0]
    # no title given → append after max order (3) → Lesson 4
    assert "Generate the NEXT lesson (Lesson 4)" in prompt
    assert "without preempting UPCOMING lessons" in prompt  # warns not to preempt stubs


def test_lesson_prompt_first_lesson_orients(captured_prompts):
    lesson_generator.generate_lesson_content(
        course_title="Go Fundamentals", module_title="Module 1: Foundations",
        module_description="desc", module_objectives="obj",
        lesson_title="Arrays and Slices", lesson_description="Work with arrays",
        existing_lessons=[{"title": "Arrays and Slices", "description": "", "order": 1,
                           "duration_minutes": 10, "content_summary": "",
                           "covered_topics": [], "has_content": False}],
        course_context=None,
    )
    # target excluded and it was the only lesson → no siblings, orient the learner
    prompt = captured_prompts[0]
    assert "FIRST lesson of the module" in prompt
    assert "HIERARCHY CONTRACT — BUILD ON WHAT CAME BEFORE" in prompt


def test_deep_outline_requires_bridge_and_returns_hierarchy(captured_prompts):
    parsed = lesson_generator.generate_lesson_deep_outline(
        course_title="Go Fundamentals", module_title="Module 1: Foundations",
        module_description="desc", module_objectives="obj",
        lesson_title="Arrays and Slices", lesson_description="Work with arrays",
        existing_lessons=_lesson_seq(), course_context=_course_ctx(),
    )
    prompt = captured_prompts[0]
    assert "PRIOR KNOWLEDGE — lessons the learner has ALREADY STUDIED" in prompt
    assert "UPCOMING PLANNED LESSONS" in prompt
    assert "The Introduction's description MUST specify the bridge" in prompt
    assert '"builds_on"' in prompt and '"assumes_knowledge"' in prompt
    assert parsed["builds_on"] == ["Intro to Variables"]


def test_deep_section_carries_hierarchy(captured_prompts):
    lesson_generator.generate_lesson_deep_section(
        course_title="Go Fundamentals", module_title="Module 1: Foundations",
        lesson_title="Arrays and Slices", lesson_description="Work with arrays",
        section={"heading": "Introduction", "description": "Bridge", "target_words": 500,
                 "key_topics": ["bridge"]},
        course_context=_course_ctx(),
        hierarchy={"builds_on": ["Intro to Variables"], "assumes_knowledge": ["variables"]},
    )
    prompt = captured_prompts[0]
    assert "LESSON HIERARCHY (planned in the outline)" in prompt
    assert "Builds on — continue from these, never re-teach: Intro to Variables" in prompt
    assert "Assumes the learner already knows" in prompt
    assert "open with the bridge" in prompt


def test_batch_outline_plans_a_chain(captured_prompts):
    parsed = lesson_generator.generate_all_lesson_outlines(
        course_title="Go Fundamentals", module_title="Module 2: Applied",
        module_description="desc", module_objectives="obj",
        num_lessons=1, existing_lessons=_lesson_seq(), course_context=_course_ctx(),
    )
    prompt = captured_prompts[0]
    assert "PRIOR KNOWLEDGE — already taught" in prompt
    assert "UPCOMING — planned" in prompt
    assert "Topics: What is a variable; Declaring variables" in prompt
    assert "HIERARCHY: each lesson's description must state what it builds on" in prompt
    assert '"builds_on"' in prompt
    assert parsed["lessons"][0]["builds_on"] == ["Arrays and Slices"]


# ---------------------------------------------------------------------------
# Module prompts
# ---------------------------------------------------------------------------

def test_multiple_modules_prompt_hierarchy(captured_prompts):
    existing = [{"title": "Module 1: Foundations", "description": "Basics",
                 "learning_objectives": "• Understand basics", "suggested_lessons": []}]
    course_generator.generate_multiple_modules(
        course_title="Go Fundamentals", course_description="desc",
        course_objectives="obj", num_modules=1,
        existing_modules=existing, course_context=_course_ctx(),
    )
    prompt = captured_prompts[0]
    assert "HIERARCHY CONTRACT — NEW MODULES CONTINUE THE COURSE" in prompt
    assert "builds on the LAST existing module" in prompt
    assert "bridge from the prior module's" in prompt
    assert "UPCOMING items are planned but unwritten" in prompt


def test_single_module_prompt_hierarchy(captured_prompts):
    existing = [{"title": "Module 1: Foundations", "description": "Basics",
                 "learning_objectives": "• Understand basics", "suggested_lessons": []}]
    course_generator.generate_module_content(
        course_title="Go Fundamentals", course_description="desc",
        course_objectives="obj", module_title="",
        existing_modules=existing, course_context=_course_ctx(),
    )
    prompt = captured_prompts[0]
    assert "HIERARCHY CONTRACT — THIS MODULE CONTINUES THE COURSE" in prompt
    assert "builds on the LAST existing module" in prompt
    assert "Topics: What is a variable; Declaring variables" in prompt
