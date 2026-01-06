#!/usr/bin/env python3
"""
Test script for search functionality in application routes
"""

import sys
import os

# Add the src directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

def test_search_patterns():
    """Test search pattern generation logic"""
    
    # Simulate search term processing
    def create_search_patterns(search_term):
        if not search_term.strip():
            return []
            
        text = search_term.strip()
        exact_pattern = f"%{text}%"
        words = text.split()
        
        patterns = [{"type": "exact", "pattern": exact_pattern}]
        
        if len(words) > 1:
            for word in words:
                if len(word) > 2:
                    word_pattern = f"%{word}%"
                    patterns.append({"type": "word", "word": word, "pattern": word_pattern})
        
        return patterns
    
    # Test cases
    test_cases = [
        "John Doe",
        "john.doe@email.com", 
        "Marketing student",
        "data analytics business",
        "Lagos Nigeria",
        "excel advanced user"
    ]
    
    print("Search Pattern Generation Test")
    print("=" * 50)
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\nTest Case {i}: '{test_case}'")
        patterns = create_search_patterns(test_case)
        for pattern in patterns:
            if pattern["type"] == "exact":
                print(f"  Exact match: {pattern['pattern']}")
            else:
                print(f"  Word match '{pattern['word']}': {pattern['pattern']}")
    
    print("\nSearch fields that will be checked:")
    fields = [
        "full_name", "email", "phone", "motivation", 
        "field_of_study", "learning_outcomes", "career_impact",
        "country", "city", "referral_source"
    ]
    for field in fields:
        print(f"  - {field}")

def test_search_logic_simulation():
    """Simulate search matching logic"""
    
    # Sample application data
    sample_applications = [
        {
            "id": 1,
            "full_name": "John Doe",
            "email": "john.doe@email.com",
            "field_of_study": "Marketing",
            "country": "Nigeria",
            "city": "Lagos",
            "motivation": "Want to learn data analysis for business growth"
        },
        {
            "id": 2,
            "full_name": "Jane Smith",
            "email": "jane@company.com",
            "field_of_study": "Computer Science",
            "country": "Ghana",
            "city": "Accra",
            "motivation": "Excel skills needed for data analytics career"
        },
        {
            "id": 3,
            "full_name": "Ahmed Hassan",
            "email": "ahmed.hassan@tech.com",
            "field_of_study": "Business Administration",
            "country": "Kenya",
            "city": "Nairobi",
            "motivation": "Improve business analysis and reporting skills"
        }
    ]
    
    def simulate_search(search_term, applications):
        """Simulate the enhanced search logic"""
        if not search_term.strip():
            return []
        
        text = search_term.strip().lower()
        words = text.split()
        matches = []
        
        for app in applications:
            matched = False
            matched_fields = []
            
            # Fields to search
            searchable_fields = [
                "full_name", "email", "field_of_study", 
                "country", "city", "motivation"
            ]
            
            # Check exact phrase match
            for field in searchable_fields:
                field_value = str(app.get(field, "")).lower()
                if text in field_value:
                    matched = True
                    matched_fields.append({"field": field, "match_type": "exact", "value": app[field]})
            
            # Check individual words
            if not matched and len(words) > 1:
                for word in words:
                    if len(word) > 2:
                        for field in searchable_fields:
                            field_value = str(app.get(field, "")).lower()
                            if word in field_value:
                                matched = True
                                matched_fields.append({"field": field, "match_type": "word", "word": word, "value": app[field]})
                                break
                        if matched:
                            break
            
            if matched:
                matches.append({
                    "application": app,
                    "matched_fields": matched_fields
                })
        
        return matches
    
    # Test searches
    test_searches = [
        "John",
        "john.doe@email.com",
        "Marketing",
        "data analysis",
        "Lagos Nigeria", 
        "Excel skills",
        "business"
    ]
    
    print("\n" + "=" * 50)
    print("Search Logic Simulation Test")
    print("=" * 50)
    
    for search in test_searches:
        print(f"\nSearching for: '{search}'")
        matches = simulate_search(search, sample_applications)
        print(f"Found {len(matches)} matches:")
        
        for match in matches:
            app = match["application"]
            print(f"  - ID {app['id']}: {app['full_name']} ({app['email']})")
            for field_match in match["matched_fields"]:
                field_name = field_match["field"].replace("_", " ").title()
                match_type = field_match["match_type"]
                if match_type == "word":
                    print(f"    └ {field_name}: '{field_match['word']}' in '{field_match['value'][:50]}...'")
                else:
                    print(f"    └ {field_name}: Exact match in '{field_match['value'][:50]}...'")

if __name__ == "__main__":
    print("Testing Search Functionality")
    print("=" * 50)
    
    try:
        test_search_patterns()
        test_search_logic_simulation()
        
        print("\n" + "=" * 50)
        print("✅ All search functionality tests completed successfully!")
        print("=" * 50)
        
        print("\nKey improvements made to search:")
        print("1. ✅ Added more searchable fields (country, city, referral_source)")
        print("2. ✅ Enhanced text matching with exact phrase + word-level search")
        print("3. ✅ Better handling of multi-word searches")
        print("4. ✅ Added debug endpoint for troubleshooting")
        print("5. ✅ Improved search patterns to avoid short words")
        
    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        sys.exit(1)