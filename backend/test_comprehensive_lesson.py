#!/usr/bin/env python3
"""
Test the enhanced comprehensive lesson generation
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from dotenv import load_dotenv
load_dotenv()

from src.services.ai_agent_service import ai_agent_service
import json

def print_header(title):
    print("\n" + "="*70)
    print(f"  {title}")
    print("="*70 + "\n")

def main():
    print_header("Enhanced AI Agent - Comprehensive Lesson Generation Test")
    
    # Check provider status
    print("📊 Provider Status:")
    stats = ai_agent_service.get_provider_stats()
    print(f"  Current Provider: {stats['current_provider']}")
    print(f"  OpenRouter Available: {stats['openrouter']['available']}")
    print(f"  Gemini Available: {stats['gemini']['available']}")
    
    # Test comprehensive lesson generation
    print_header("Generating Comprehensive Professor-Level Lesson")
    print("Topic: Introduction to Variables in Python")
    print("This will generate content in 6 steps...\n")
    
    try:
        result = ai_agent_service.generate_comprehensive_lesson_step_by_step(
            course_title="Python Programming Fundamentals",
            module_title="Python Basics",
            module_description="Learn the fundamental building blocks of Python programming",
            module_objectives="Understand Python syntax, data types, and basic operations",
            lesson_title="Variables and Data Types in Python",
            lesson_description="Learn how to store and manipulate data using variables",
            difficulty_level="beginner"
        )
        
        print("\n✅ Lesson Generated Successfully!\n")
        print(f"Title: {result['title']}")
        print(f"Duration: {result['duration_minutes']} minutes")
        print(f"Difficulty: {result['difficulty_level']}")
        print(f"\nDescription: {result['description'][:200]}...")
        
        print(f"\n📚 Learning Outcomes ({len(result.get('metadata', {}).get('learning_outcomes', []))}):")
        for outcome in result.get('metadata', {}).get('learning_outcomes', [])[:3]:
            print(f"  • {outcome}")
        
        print(f"\n🔑 Key Concepts ({len(result.get('metadata', {}).get('key_concepts', []))}):")
        for concept in result.get('metadata', {}).get('key_concepts', [])[:5]:
            print(f"  • {concept}")
        
        print(f"\n✓ Generation Steps:")
        for step in result.get('generation_steps', []):
            print(f"  {step}")
        
        print(f"\n📝 Content Preview (first 500 characters):")
        print(result['content_data'][:500] + "...")
        
        print(f"\n📊 Content Statistics:")
        print(f"  Total Length: {len(result['content_data'])} characters")
        print(f"  Sections Generated: {len(result.get('sections', {}))}")
        print(f"  Section Names: {', '.join(result.get('sections', {}).keys())}")
        
        # Save to file for inspection
        output_file = "test_lesson_output.json"
        with open(output_file, 'w') as f:
            json.dump(result, f, indent=2)
        print(f"\n💾 Full lesson saved to: {output_file}")
        
        # Save markdown content
        md_file = "test_lesson_output.md"
        with open(md_file, 'w') as f:
            f.write(result['content_data'])
        print(f"📄 Markdown content saved to: {md_file}")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    
    print_header("Test Complete")

if __name__ == "__main__":
    main()
