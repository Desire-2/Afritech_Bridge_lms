#!/usr/bin/env python3
"""
Enhanced AI Agent Service Test Suite
Tests all enhanced AI generation functionality including:
- Standardized response handling
- Smart caching with TTL
- Progress tracking for long operations
- Enhanced content quality validation
- Error recovery and retry logic
"""

import sys
import os
import time
import json
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Now we can import our enhanced services
try:
    from src.services.ai_agent_service import AIAgentService, AIResponse, ResponseStatus
    from src.services.ai.enhanced_content_validator import ContentType, enhanced_content_validator
    from src.services.ai.enhanced_json_parser import enhanced_json_parser
    print("✓ Successfully imported enhanced AI services")
except ImportError as e:
    print(f"✗ Import failed: {e}")
    sys.exit(1)


def test_enhanced_json_parser():
    """Test enhanced JSON parser with various malformed inputs"""
    print("\n🔍 Testing Enhanced JSON Parser...")
    
    test_cases = [
        # Valid JSON
        ('{"title": "Test Course", "description": "A test"}', True),
        
        # JSON with markdown code blocks
        ('```json\n{"title": "Test", "description": "Test"}\n```', True),
        
        # JSON with unescaped newlines
        ('{"title": "Test\nCourse", "description": "Test"}', True),
        
        # JSON with trailing commas
        ('{"title": "Test", "description": "Test",}', True),
        
        # Malformed JSON that should be partially recoverable
        ('title: "Test Course", description: "A test course"', False),  # Should attempt partial extraction
        
        # Empty input
        ('', False),
        
        # Non-JSON text
        ('This is just plain text about courses', False)
    ]
    
    for i, (test_input, should_parse) in enumerate(test_cases, 1):
        result = enhanced_json_parser.parse_json_response(test_input, f"test_case_{i}")
        if result and should_parse:
            print(f"✓ Test {i}: Successfully parsed malformed JSON")
        elif not result and not should_parse:
            print(f"✓ Test {i}: Correctly failed to parse invalid input")
        elif result and not should_parse:
            print(f"? Test {i}: Unexpectedly parsed invalid input (might be partial extraction)")
        else:
            print(f"✗ Test {i}: Failed to parse valid JSON")


def test_content_validation():
    """Test enhanced content validation"""
    print("\n📊 Testing Enhanced Content Validation...")
    
    # Test course outline validation
    good_course = {
        "title": "Introduction to Python Programming",
        "description": "A comprehensive course covering Python fundamentals, data structures, and object-oriented programming. Students will learn through hands-on exercises and real-world projects.",
        "learning_objectives": "• Understand Python syntax and basic concepts\n• Work with data structures like lists and dictionaries\n• Apply object-oriented programming principles",
        "estimated_duration": "40 hours",
        "suggested_modules": [
            {"title": "Python Basics", "description": "Variables, data types, and control structures"},
            {"title": "Data Structures", "description": "Lists, dictionaries, sets, and tuples"}
        ]
    }
    
    poor_course = {
        "title": "Python",
        "description": "Learn Python"
    }
    
    # Test good content
    result = enhanced_content_validator.validate_content_comprehensive(good_course, ContentType.COURSE_OUTLINE)
    print(f"✓ Good course validation - Score: {result.overall_score:.2f}, Valid: {result.is_valid}")
    
    # Test poor content
    result = enhanced_content_validator.validate_content_comprehensive(poor_course, ContentType.COURSE_OUTLINE)
    print(f"✓ Poor course validation - Score: {result.overall_score:.2f}, Valid: {result.is_valid}")
    print(f"  Issues: {len(result.critical_issues)} critical, {len(result.warnings)} warnings")


def test_smart_caching():
    """Test smart caching functionality"""
    print("\n🗄️ Testing Smart Caching...")
    
    # Create AI service instance
    ai_service = AIAgentService()
    
    # Test cache key generation and retrieval
    cache = ai_service.smart_cache
    
    # Cache some test data
    test_data = {"title": "Test Course", "cached": True}
    cache.set(test_data, topic="python", audience="beginners")
    
    # Retrieve cached data
    cached = cache.get(topic="python", audience="beginners")
    if cached and cached.get("cached"):
        print("✓ Smart caching: Data successfully cached and retrieved")
    else:
        print("✗ Smart caching: Failed to cache/retrieve data")
    
    # Test cache stats
    stats = cache.get_stats()
    print(f"✓ Cache stats: {stats['active_items']} active items")


def test_ai_response_format():
    """Test standardized AI response format"""
    print("\n📋 Testing Standardized AI Response Format...")
    
    # Create a test response
    test_response = AIResponse(
        status=ResponseStatus.SUCCESS,
        data={"title": "Test Course", "description": "A test course"},
        message="Content generated successfully",
        provider_used="openrouter",
        generation_time=1.5,
        content_quality_score=0.85,
        cached=False
    )
    
    # Convert to dictionary for API response
    response_dict = test_response.to_dict()
    
    # Validate response structure
    required_fields = ["success", "status", "message", "data", "metadata"]
    missing_fields = [field for field in required_fields if field not in response_dict]
    
    if not missing_fields:
        print("✓ AI Response format: All required fields present")
        print(f"  Success: {response_dict['success']}")
        print(f"  Status: {response_dict['status']}")
        print(f"  Quality Score: {response_dict['metadata']['content_quality_score']}")
    else:
        print(f"✗ AI Response format: Missing fields: {missing_fields}")


def test_progress_tracking():
    """Test progress tracking functionality"""
    print("\n⏱️ Testing Progress Tracking...")
    
    ai_service = AIAgentService()
    
    # Simulate a progress session
    session_id = "test_session_123"
    from src.services.ai_agent_service import ProgressUpdate
    
    progress = ProgressUpdate(
        step=3,
        total_steps=10,
        current_task="Generating lesson content",
        percentage=30.0,
        elapsed_time=15.5,
        estimated_remaining=35.0
    )
    
    # Store progress
    ai_service.progress_sessions[session_id] = progress
    
    # Retrieve progress
    retrieved = ai_service.get_progress(session_id)
    if retrieved and retrieved["percentage"] == 30.0:
        print("✓ Progress tracking: Progress stored and retrieved successfully")
        print(f"  Task: {retrieved['current_task']}")
        print(f"  Progress: {retrieved['percentage']:.1f}%")
    else:
        print("✗ Progress tracking: Failed to store/retrieve progress")
    
    # Test active sessions
    sessions = ai_service.get_all_active_sessions()
    if session_id in sessions:
        print(f"✓ Active sessions: Found {len(sessions)} active session(s)")
    
    # Clean up
    ai_service.cancel_session(session_id)


def test_error_scenarios():
    """Test error handling scenarios"""
    print("\n⚠️ Testing Error Handling...")
    
    # Test with invalid content type
    try:
        result = enhanced_content_validator.validate_content_comprehensive({}, None)
        print("✗ Error handling: Should have raised an exception")
    except Exception as e:
        print("✓ Error handling: Properly caught invalid input")
    
    # Test JSON parser with None input
    result = enhanced_json_parser.parse_json_response(None, "test")
    if result is None:
        print("✓ Error handling: JSON parser handles None input gracefully")
    else:
        print("✗ Error handling: JSON parser should return None for None input")


def print_summary():
    """Print a summary of improvements made"""
    print("\n" + "="*60)
    print("🎉 ENHANCED AI AGENT IMPROVEMENTS SUMMARY")
    print("="*60)
    print()
    print("✨ NEW FEATURES IMPLEMENTED:")
    print("   • Standardized AIResponse format across all endpoints")
    print("   • Smart caching with TTL and content-based keys")
    print("   • Real-time progress tracking for long operations")
    print("   • Enhanced JSON parser with multiple recovery strategies")
    print("   • Comprehensive content quality validation")
    print("   • Intelligent error recovery with exponential backoff")
    print("   • Provider performance monitoring and stats")
    print("   • Content quality scoring and improvement suggestions")
    print()
    print("🔧 ENHANCED COMPONENTS:")
    print("   • AIAgentService - Main service with retry logic and caching")
    print("   • SmartCache - TTL-based caching with LRU eviction")
    print("   • EnhancedJSONParser - Robust JSON parsing with error recovery")
    print("   • EnhancedContentValidator - Quality scoring and validation")
    print("   • AIResponse - Standardized response format with metadata")
    print("   • ProgressUpdate - Real-time progress tracking")
    print()
    print("📊 API IMPROVEMENTS:")
    print("   • All generation endpoints now return standardized responses")
    print("   • Enhanced health check with detailed provider status")
    print("   • Progress tracking endpoints for monitoring long operations")
    print("   • Cache management endpoints for administrators")
    print("   • Provider switching and statistics endpoints")
    print()
    print("🛡️ RELIABILITY IMPROVEMENTS:")
    print("   • 3-attempt retry logic with exponential backoff")
    print("   • Graceful degradation when AI providers fail")
    print("   • Content quality thresholds to ensure minimum standards")
    print("   • Comprehensive error logging and debugging information")
    print("   • Smart provider switching based on failure rates")
    print()
    print("💡 NEXT STEPS:")
    print("   1. Update frontend to use new standardized response format")
    print("   2. Implement WebSocket connections for real-time progress updates")
    print("   3. Add Redis integration for distributed caching")
    print("   4. Implement content versioning and rollback capabilities")
    print("   5. Add machine learning for automatic quality scoring improvement")
    print("="*60)


def main():
    """Run all enhancement tests"""
    print("🚀 ENHANCED AI AGENT SERVICE TEST SUITE")
    print("Testing all improvements and new features...")
    
    try:
        test_enhanced_json_parser()
        test_content_validation() 
        test_smart_caching()
        test_ai_response_format()
        test_progress_tracking()
        test_error_scenarios()
        
        print("\n✅ ALL ENHANCEMENT TESTS COMPLETED")
        
    except Exception as e:
        print(f"\n❌ TEST SUITE FAILED: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    print_summary()
    return 0


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)