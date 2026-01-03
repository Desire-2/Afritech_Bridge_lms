#!/usr/bin/env python3
"""
Direct test of enhanced AI Agent Service
No Flask app required
"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

from src.services.ai_agent_service import ai_agent_service
import json

def print_header(title):
    """Print formatted header"""
    print("\n" + "="*70)
    print(f"  {title}")
    print("="*70)

def main():
    """Test the enhanced AI agent service"""
    print_header("Enhanced AI Agent Service - Direct Test")
    
    # Check configuration
    print("\n📋 Configuration Check:")
    print(f"  OpenRouter API Key: {'✅ Set' if ai_agent_service.openrouter_api_key else '❌ Missing'}")
    print(f"  Gemini API Key: {'✅ Set' if ai_agent_service.gemini_api_key else '❌ Missing'}")
    print(f"  Current Provider: {ai_agent_service.current_provider}")
    
    # Get initial stats
    print_header("Provider Statistics (Initial)")
    stats = ai_agent_service.get_provider_stats()
    print(json.dumps(stats, indent=2))
    
    # Test 1: Simple course generation
    print_header("Test 1: Generate Simple Course")
    print("Generating course outline for 'Python Basics'...")
    
    try:
        result = ai_agent_service.generate_course_outline(
            topic="Python Basics",
            target_audience="Absolute beginners",
            learning_objectives="Learn Python fundamentals"
        )
        
        if result and result.get('title'):
            print("✅ Success!")
            print(f"\n📚 Course Title: {result['title']}")
            print(f"📝 Description: {result['description'][:150]}...")
            print(f"🎯 Objectives: {result['learning_objectives'][:100]}...")
            print(f"📊 Suggested Modules: {len(result.get('suggested_modules', []))}")
        else:
            print("❌ Failed - no result returned")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Test 2: Fast tier
    print_header("Test 2: Fast Tier Generation")
    print("Using fast tier for quick content...")
    
    try:
        result = ai_agent_service.generate_course_outline(
            topic="HTML Basics",
            prefer_fast=True
        )
        
        if result and result.get('title'):
            print("✅ Fast tier works!")
            print(f"📚 Title: {result['title']}")
        else:
            print("❌ Fast tier failed")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Final stats
    print_header("Provider Statistics (Final)")
    final_stats = ai_agent_service.get_provider_stats()
    print(json.dumps(final_stats, indent=2))
    
    # Summary
    print_header("Test Summary")
    print(f"✅ Service initialized successfully")
    print(f"✅ Provider: {final_stats['current_provider']}")
    print(f"✅ OpenRouter failures: {final_stats['openrouter']['failure_count']}")
    print(f"✅ Gemini failures: {final_stats['gemini']['failure_count']}")
    print(f"✅ Cache size: {final_stats['cache']['size']}")
    
    print("\n" + "="*70)
    print("  Test Complete!")
    print("="*70 + "\n")

if __name__ == "__main__":
    main()
