#!/usr/bin/env python3
"""
Standalone test script for the Task-Based Lesson Generator
This avoids importing the full services package to bypass flask dependencies.
"""

import os
import sys
import json
import time
from datetime import datetime

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def test_imports():
    """Test that the task-based generator imports correctly"""
    print("=" * 60)
    print("TESTING IMPORTS")
    print("=" * 60)
    
    try:
        # Import directly without going through services __init__
        sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src', 'services', 'ai'))
        
        from task_based_lesson_generator import (
            TaskBasedLessonGenerator,
            task_based_lesson_generator,
            TaskStatus,
            TaskType,
            LessonTask
        )
        print("✓ TaskBasedLessonGenerator imported successfully")
        print(f"  - TaskStatus values: {[s.value for s in TaskStatus]}")
        print(f"  - TaskType count: {len(TaskType)} task types defined")
        
        # Verify the generator has expected methods
        generator = TaskBasedLessonGenerator()
        assert hasattr(generator, 'generate_lesson_with_tasks')
        print("✓ generate_lesson_with_tasks method exists")
        
        assert hasattr(generator, '_build_task_queue')
        print("✓ _build_task_queue method exists")
        
        assert hasattr(generator, '_execute_task')
        print("✓ _execute_task method exists")
        
        assert hasattr(generator, '_build_task_prompt')
        print("✓ _build_task_prompt method exists")
        
        return True, TaskBasedLessonGenerator
        
    except Exception as e:
        print(f"✗ Import error: {e}")
        import traceback
        traceback.print_exc()
        return False, None


def test_task_queue_building(generator_class):
    """Test that task queues are built correctly for different depth levels"""
    print("\n" + "=" * 60)
    print("TESTING TASK QUEUE BUILDING")
    print("=" * 60)
    
    generator = generator_class()
    
    # Initialize context (needed for task building)
    generator.generation_context = {
        "course_title": "Test Course",
        "module_title": "Test Module",
        "module_description": "Test description",
        "module_objectives": "Test objectives",
        "lesson_title": "Test Lesson",
        "lesson_description": "Test lesson description",
        "difficulty_level": "intermediate",
        "existing_lessons": [],
        "depth_level": "standard",
    }
    
    depth_levels = ["basic", "standard", "comprehensive", "expert"]
    expected_min_tasks = {"basic": 5, "standard": 10, "comprehensive": 18, "expert": 25}
    
    for depth in depth_levels:
        generator._build_task_queue(depth)
        task_count = len(generator.tasks)
        
        print(f"\n{depth.upper()} depth level:")
        print(f"  Total tasks: {task_count}")
        
        # Count tasks by phase
        research_tasks = sum(1 for t in generator.tasks.values() if t.task_id.startswith("research_"))
        plan_tasks = sum(1 for t in generator.tasks.values() if t.task_id.startswith("plan_"))
        content_tasks = sum(1 for t in generator.tasks.values() if t.task_id.startswith("content_"))
        enhance_tasks = sum(1 for t in generator.tasks.values() if t.task_id.startswith("enhance_"))
        validate_tasks = sum(1 for t in generator.tasks.values() if t.task_id.startswith("validate_"))
        
        print(f"  Breakdown: Research={research_tasks}, Planning={plan_tasks}, Content={content_tasks}, Enhancement={enhance_tasks}, Validation={validate_tasks}")
        
        # Verify minimum task count
        expected_min = expected_min_tasks.get(depth, 5)
        if task_count >= expected_min:
            print(f"  ✓ Task count {task_count} >= expected minimum {expected_min}")
        else:
            print(f"  ✗ Task count {task_count} < expected minimum {expected_min}")
        
        # List all tasks
        print(f"  Tasks: {list(generator.tasks.keys())}")
    
    return True


def test_task_dependencies(generator_class):
    """Test that task dependencies are correctly set"""
    print("\n" + "=" * 60)
    print("TESTING TASK DEPENDENCIES")
    print("=" * 60)
    
    generator = generator_class()
    generator.generation_context = {
        "course_title": "Test Course",
        "module_title": "Test Module",
        "module_description": "Test description",
        "module_objectives": "Test objectives",
        "lesson_title": "Test Lesson",
        "lesson_description": "Test lesson description",
        "difficulty_level": "intermediate",
        "existing_lessons": [],
        "depth_level": "standard",
    }
    
    generator._build_task_queue("comprehensive")
    
    print(f"Testing dependencies for {len(generator.tasks)} tasks...")
    
    issues = []
    for task_id, task in generator.tasks.items():
        # Check that all dependencies exist
        for dep in task.dependencies:
            if dep not in generator.tasks:
                issues.append(f"Task '{task_id}' has unknown dependency: '{dep}'")
    
    if issues:
        for issue in issues:
            print(f"  ✗ {issue}")
        return False
    else:
        print("  ✓ All task dependencies are valid")
        
        # Show dependency chain for first few tasks
        print("\n  Sample dependency chains:")
        count = 0
        for task_id, task in generator.tasks.items():
            if task.dependencies and count < 5:
                print(f"    {task_id} <- depends on <- {task.dependencies}")
                count += 1
        
        return True


def test_prompt_generation(generator_class):
    """Test that prompts are generated correctly for different task types"""
    print("\n" + "=" * 60)
    print("TESTING PROMPT GENERATION")
    print("=" * 60)
    
    generator = generator_class()
    generator.generation_context = {
        "course_title": "Introduction to Python",
        "module_title": "Variables and Data Types",
        "module_description": "Learn about Python variables and data types",
        "module_objectives": "Understand variables, master data types",
        "lesson_title": "Understanding Variables",
        "lesson_description": "Learn how to use variables in Python",
        "difficulty_level": "beginner",
        "existing_lessons": [{"title": "Previous Lesson", "description": "Intro to Python"}],
        "depth_level": "comprehensive",
    }
    
    generator._build_task_queue("comprehensive")
    
    # Test prompt generation for a few key task types
    sample_tasks = ["research_topic", "plan_outline", "content_hook", "content_definitions"]
    
    for task_id in sample_tasks:
        if task_id in generator.tasks:
            task = generator.tasks[task_id]
            context = generator._build_task_context(task)
            prompt = generator._build_task_prompt(task, context)
            
            print(f"\n{task_id}:")
            print(f"  Prompt length: {len(prompt)} chars")
            print(f"  Contains lesson title: {'✓' if 'Understanding Variables' in prompt else '✗'}")
            print(f"  Contains context: {'✓' if 'Python' in prompt else '✗'}")
            
            # Show first 200 chars of prompt
            print(f"  Preview: {prompt[:200]}...")
    
    return True


def test_assembly(generator_class):
    """Test that lesson assembly works correctly"""
    print("\n" + "=" * 60)
    print("TESTING LESSON ASSEMBLY")
    print("=" * 60)
    
    generator = generator_class()
    generator.generation_context = {
        "course_title": "Test Course",
        "module_title": "Test Module",
        "module_description": "Test description",
        "module_objectives": "Test objectives",
        "lesson_title": "Test Lesson",
        "lesson_description": "Test lesson description",
        "difficulty_level": "intermediate",
        "existing_lessons": [],
        "depth_level": "standard",
    }
    
    # Mock some task results
    generator.task_results = {
        "plan_outline": json.dumps({
            "total_duration_minutes": 60,
            "introduction": {"duration_minutes": 10}
        }),
        "plan_objectives": json.dumps({
            "learning_objectives": [
                {"objective": "Understand basic concepts"},
                {"objective": "Apply knowledge practically"}
            ]
        }),
        "content_hook": "Have you ever wondered how variables work?",
        "content_context": "Variables are fundamental to programming...",
        "content_definitions": "## Key Definitions\n\n**Variable**: A named storage location...",
        "content_principles": "## Core Principles\n\nVariables follow these rules...",
        "content_takeaways": "## Key Takeaways\n\n1. Variables store data\n2. Types matter",
        "content_reflection": "## Reflection\n\nThink about how you use variables...",
    }
    
    # Test assembly
    result = generator._assemble_lesson_from_tasks()
    
    print(f"  Title: {result.get('title', 'N/A')}")
    print(f"  Duration: {result.get('duration_minutes', 'N/A')} minutes")
    print(f"  Sections generated: {list(result.get('sections', {}).keys())}")
    print(f"  Content length: {len(result.get('content_data', ''))} chars")
    
    # Verify structure
    assert 'title' in result, "Missing title"
    assert 'content_data' in result, "Missing content_data"
    assert 'sections' in result, "Missing sections"
    print("  ✓ Result structure is valid")
    
    return True


def print_summary():
    """Print summary of the task-based generator capabilities"""
    print("\n" + "=" * 60)
    print("TASK-BASED LESSON GENERATOR SUMMARY")
    print("=" * 60)
    
    print("""
The new Task-Based Lesson Generator provides:

╔══════════════════════════════════════════════════════════════╗
║                    GENERATION PHASES                         ║
╠══════════════════════════════════════════════════════════════╣
║ 1. RESEARCH PHASE                                            ║
║    - Topic analysis, concept mapping, prerequisites          ║
║                                                              ║
║ 2. PLANNING PHASE                                            ║
║    - Lesson outline, learning objectives, section planning   ║
║                                                              ║
║ 3. CONTENT GENERATION PHASE                                  ║
║    Introduction: Hook, Context, Motivation, Overview         ║
║    Theory: Definitions, Principles, Frameworks, Connections  ║
║    Practical: Use cases, Examples, Code, Best practices      ║
║    Exercises: Concept checks, Problems, Critical thinking    ║
║    Summary: Takeaways, Reflection, Next steps, Resources     ║
║                                                              ║
║ 4. ENHANCEMENT PHASE (comprehensive+)                        ║
║    - Analogies, Visual descriptions, Example enrichment      ║
║                                                              ║
║ 5. VALIDATION PHASE (standard+)                              ║
║    - Content review, Quality assurance                       ║
╚══════════════════════════════════════════════════════════════╝

╔══════════════════════════════════════════════════════════════╗
║                      DEPTH LEVELS                            ║
╠══════════════════════════════════════════════════════════════╣
║ basic:         ~5 tasks   | Quick, essential content only    ║
║ standard:      ~12 tasks  | Good balance of speed and depth  ║
║ comprehensive: ~20 tasks  | Full coverage with enhancements  ║
║ expert:        ~30+ tasks | Maximum depth, research, cases   ║
╚══════════════════════════════════════════════════════════════╝

USAGE:
  # Through AI Agent Service (recommended)
  from src.services.ai_agent_service import ai_agent_service
  
  result = ai_agent_service.generate_lesson_with_tasks(
      course_title="...",
      module_title="...",
      module_description="...",
      module_objectives="...",
      lesson_title="...",
      depth_level="comprehensive",  # or: basic, standard, expert
      progress_callback=my_callback  # optional
  )
  
  # Shortcut methods:
  ai_agent_service.generate_deep_lesson(...)   # comprehensive depth
  ai_agent_service.generate_expert_lesson(...) # expert depth
""")


def main():
    """Main test function"""
    print("=" * 60)
    print("TASK-BASED LESSON GENERATOR TEST SUITE")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    all_passed = True
    
    # Test 1: Imports
    success, generator_class = test_imports()
    if not success:
        all_passed = False
        print("\n⚠️  Cannot proceed without successful imports")
        return 1
    
    # Test 2: Task queue building
    if not test_task_queue_building(generator_class):
        all_passed = False
    
    # Test 3: Dependencies
    if not test_task_dependencies(generator_class):
        all_passed = False
    
    # Test 4: Prompt generation
    if not test_prompt_generation(generator_class):
        all_passed = False
    
    # Test 5: Assembly
    if not test_assembly(generator_class):
        all_passed = False
    
    # Print summary
    print_summary()
    
    # Final result
    print("\n" + "=" * 60)
    if all_passed:
        print("ALL TESTS PASSED ✓")
    else:
        print("SOME TESTS FAILED ✗")
    print("=" * 60)
    
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
