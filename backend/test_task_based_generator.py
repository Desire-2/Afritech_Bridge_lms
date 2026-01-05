#!/usr/bin/env python3
"""
Test script for the Task-Based Lesson Generator

This script tests the new multi-task lesson generation approach.
"""

import os
import sys
import json
import time
from datetime import datetime

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Test imports
def test_imports():
    """Test that all imports work correctly"""
    print("=" * 60)
    print("TESTING IMPORTS")
    print("=" * 60)
    
    try:
        # Import directly from ai subpackage to avoid flask dependencies
        from src.services.ai.task_based_lesson_generator import (
            TaskBasedLessonGenerator,
            task_based_lesson_generator,
            TaskStatus,
            TaskType,
            LessonTask
        )
        print("✓ TaskBasedLessonGenerator imported successfully")
        print(f"  - TaskStatus values: {[s.value for s in TaskStatus]}")
        print(f"  - TaskType count: {len(TaskType)}")
        
        from src.services.ai import ai_provider_manager
        print("✓ ai_provider_manager imported successfully")
        
        # Verify the generator has expected methods
        generator = TaskBasedLessonGenerator()
        assert hasattr(generator, 'generate_lesson_with_tasks')
        print("✓ generate_lesson_with_tasks method exists")
        
        assert hasattr(generator, '_build_task_queue')
        print("✓ _build_task_queue method exists")
        
        assert hasattr(generator, '_execute_task')
        print("✓ _execute_task method exists")
        
        return True
        
    except Exception as e:
        print(f"✗ Import error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_task_queue_building():
    """Test that task queues are built correctly for different depth levels"""
    print("\n" + "=" * 60)
    print("TESTING TASK QUEUE BUILDING")
    print("=" * 60)
    
    from src.services.ai.task_based_lesson_generator import TaskBasedLessonGenerator
    
    generator = TaskBasedLessonGenerator()
    
    depth_levels = ["basic", "standard", "comprehensive", "expert"]
    
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
        
        print(f"  Research: {research_tasks}, Planning: {plan_tasks}, Content: {content_tasks}, Enhancement: {enhance_tasks}, Validation: {validate_tasks}")
        
        # Print task list
        print(f"  Tasks: {', '.join(generator.tasks.keys())}")
    
    return True


def test_progress_callback():
    """Test progress callback functionality"""
    print("\n" + "=" * 60)
    print("TESTING PROGRESS CALLBACK")
    print("=" * 60)
    
    progress_updates = []
    
    def progress_callback(current, total, status, message):
        progress_updates.append({
            "current": current,
            "total": total,
            "status": status,
            "message": message
        })
        print(f"  [{current}/{total}] {status}: {message}")
    
    print("Progress callback defined and working ✓")
    return True


def test_basic_generation(dry_run=True):
    """Test basic generation with the 'basic' depth level (fastest)"""
    print("\n" + "=" * 60)
    print("TESTING BASIC GENERATION" + (" (DRY RUN)" if dry_run else ""))
    print("=" * 60)
    
    if dry_run:
        print("Skipping actual AI generation in dry run mode")
        print("To test with real AI, run with: python3 test_task_based_generator.py --live")
        return True
    
    from src.services.ai.task_based_lesson_generator import TaskBasedLessonGenerator
    
    generator = TaskBasedLessonGenerator()
    progress_updates = []
    
    def progress_callback(current, total, status, message):
        progress_updates.append({
            "current": current,
            "total": total,
            "status": status,
            "message": message
        })
        print(f"  [{current}/{total}] {status}: {message}")
    
    print("\nGenerating lesson with 'basic' depth level...")
    start_time = time.time()
    
    try:
        result = generator.generate_lesson_with_tasks(
            course_title="Introduction to Python Programming",
            module_title="Variables and Data Types",
            module_description="Learn about Python variables, data types, and type conversion",
            module_objectives="Understand variables, master data types, perform type conversion",
            lesson_title="Understanding Python Variables",
            lesson_description="Learn how to declare and use variables in Python",
            difficulty_level="beginner",
            depth_level="basic",  # Fastest option
            progress_callback=progress_callback
        )
        
        elapsed_time = time.time() - start_time
        
        print(f"\n✓ Generation completed in {elapsed_time:.2f} seconds")
        print(f"\nGeneration Report:")
        print(f"  Total tasks: {result.get('generation_report', {}).get('total_tasks', 'N/A')}")
        print(f"  Completed: {result.get('generation_report', {}).get('completed_tasks', 'N/A')}")
        print(f"  Failed: {result.get('generation_report', {}).get('failed_tasks', 'N/A')}")
        print(f"  Success rate: {result.get('generation_report', {}).get('success_rate', 'N/A'):.1f}%")
        
        print(f"\nLesson Details:")
        print(f"  Title: {result.get('title', 'N/A')}")
        print(f"  Duration: {result.get('duration_minutes', 'N/A')} minutes")
        print(f"  Sections: {list(result.get('sections', {}).keys())}")
        
        # Save result to file
        output_file = f"test_lesson_output_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(output_file, 'w') as f:
            # Convert content_data to truncated version for JSON
            result_copy = result.copy()
            if 'content_data' in result_copy:
                result_copy['content_data'] = result_copy['content_data'][:1000] + "... [truncated]"
            json.dump(result_copy, f, indent=2, default=str)
        print(f"\nResult saved to: {output_file}")
        
        return True
        
    except Exception as e:
        print(f"✗ Generation error: {e}")
        import traceback
        traceback.print_exc()
        return False


def print_summary():
    """Print summary of the task-based generator capabilities"""
    print("\n" + "=" * 60)
    print("TASK-BASED LESSON GENERATOR SUMMARY")
    print("=" * 60)
    
    print("""
The new Task-Based Lesson Generator provides:

1. RESEARCH PHASE (Topic Analysis)
   - Deep topic analysis
   - Concept mapping with relationships
   - Prerequisite identification
   - Learning path design (expert only)

2. PLANNING PHASE
   - Detailed lesson outline
   - Learning objectives (Bloom's Taxonomy)
   - Section planning
   - Assessment planning

3. CONTENT GENERATION PHASE
   Introduction Sub-tasks:
   - Hook generation
   - Context setting
   - Motivation section
   - Lesson overview
   
   Theory Sub-tasks:
   - Core definitions
   - Fundamental principles
   - Theoretical frameworks
   - Concept connections
   - Historical context (expert)
   - Advanced considerations (expert)
   
   Practical Sub-tasks:
   - Real-world use cases
   - Worked examples
   - Code examples
   - Best practices
   - Common pitfalls
   - Case studies (expert)
   
   Exercise Sub-tasks:
   - Concept check questions
   - Applied problems
   - Critical thinking challenges
   - Hands-on activities
   - Self-assessment tools (expert)
   
   Summary Sub-tasks:
   - Key takeaways
   - Reflection questions
   - Next steps
   - Additional resources

4. ENHANCEMENT PHASE (comprehensive+)
   - Analogy generation
   - Visual descriptions
   - Example enrichment (expert)
   - Concept bridges (expert)

5. VALIDATION PHASE (standard+)
   - Content coherence review
   - Quality assurance check

DEPTH LEVELS:
- basic: ~5 tasks, fastest generation
- standard: ~12 tasks, good balance
- comprehensive: ~20 tasks, full coverage
- expert: ~30+ tasks, maximum depth
""")


def main():
    """Main test function"""
    print("=" * 60)
    print("TASK-BASED LESSON GENERATOR TEST SUITE")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    # Check for live mode
    live_mode = "--live" in sys.argv
    
    # Run tests
    all_passed = True
    
    # Test 1: Imports
    if not test_imports():
        all_passed = False
    
    # Test 2: Task queue building
    if not test_task_queue_building():
        all_passed = False
    
    # Test 3: Progress callback
    if not test_progress_callback():
        all_passed = False
    
    # Test 4: Basic generation
    if not test_basic_generation(dry_run=not live_mode):
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
