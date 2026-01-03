#!/usr/bin/env python3
"""
Fix mixed content video/PDF/image URL structure in database

This script fixes lessons where video/PDF/image sections have URLs 
stored in metadata.url instead of at the root url level.

BEFORE (broken):
{
  "type": "video",
  "content": "https://youtube.com/...",
  "metadata": {"url": "https://youtube.com/...", "title": "Video"}
}

AFTER (fixed):
{
  "type": "video",
  "url": "https://youtube.com/...",
  "title": "Video"
}
"""

import os
import sys
import json
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from main import app, db
from src.models.course_models import Lesson

def fix_mixed_content_structure(content_data_str):
    """Fix the structure of mixed content JSON"""
    try:
        content_data = json.loads(content_data_str)
        
        if not isinstance(content_data, list):
            return content_data_str, False
        
        fixed = False
        fixed_sections = []
        
        for section in content_data:
            if not isinstance(section, dict):
                fixed_sections.append(section)
                continue
            
            section_type = section.get('type')
            
            # Handle video, pdf, image sections
            if section_type in ['video', 'pdf', 'image']:
                # Check if URL is missing at root level but exists elsewhere
                if 'url' not in section or not section['url']:
                    # Try to get URL from metadata or content
                    url = None
                    if isinstance(section.get('metadata'), dict):
                        url = section['metadata'].get('url')
                    if not url and 'content' in section:
                        url = section['content']
                    
                    if url:
                        # Create fixed section with url at root level
                        fixed_section = {
                            'type': section_type,
                            'url': url,
                        }
                        
                        # Add title if present
                        if isinstance(section.get('metadata'), dict) and section['metadata'].get('title'):
                            fixed_section['title'] = section['metadata']['title']
                        elif 'title' in section:
                            fixed_section['title'] = section['title']
                        
                        # Add description/caption if present
                        if isinstance(section.get('metadata'), dict):
                            if section['metadata'].get('description'):
                                fixed_section['description'] = section['metadata']['description']
                            if section['metadata'].get('caption'):
                                fixed_section['caption'] = section['metadata']['caption']
                        
                        fixed_sections.append(fixed_section)
                        fixed = True
                        print(f"  ✓ Fixed {section_type} section URL")
                        continue
                
                # URL exists at root, but clean up the structure
                fixed_section = {
                    'type': section_type,
                    'url': section.get('url'),
                }
                
                # Add other relevant fields
                if 'title' in section:
                    fixed_section['title'] = section['title']
                if 'description' in section:
                    fixed_section['description'] = section['description']
                if 'caption' in section:
                    fixed_section['caption'] = section['caption']
                    
                fixed_sections.append(fixed_section)
            
            # Handle heading sections
            elif section_type == 'heading':
                fixed_section = {
                    'type': 'heading',
                    'content': section.get('content') or section.get('title', ''),
                }
                if 'title' in section:
                    fixed_section['title'] = section['title']
                fixed_sections.append(fixed_section)
            
            # Handle text sections - keep as is
            else:
                fixed_sections.append(section)
        
        if fixed:
            return json.dumps(fixed_sections), True
        return content_data_str, False
        
    except json.JSONDecodeError:
        print(f"  ✗ Invalid JSON, skipping")
        return content_data_str, False
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return content_data_str, False

def main():
    """Fix all mixed content lessons in the database"""
    with app.app_context():
        print("=" * 70)
        print("Mixed Content URL Structure Fixer")
        print("=" * 70)
        print()
        
        # Find all lessons with mixed content
        mixed_lessons = Lesson.query.filter_by(content_type='mixed').all()
        
        if not mixed_lessons:
            print("No mixed content lessons found.")
            return
        
        print(f"Found {len(mixed_lessons)} mixed content lessons")
        print()
        
        fixed_count = 0
        error_count = 0
        
        for lesson in mixed_lessons:
            print(f"\nLesson ID {lesson.id}: {lesson.title}")
            print(f"  Content length: {len(lesson.content_data)} characters")
            
            try:
                fixed_content, was_fixed = fix_mixed_content_structure(lesson.content_data)
                
                if was_fixed:
                    lesson.content_data = fixed_content
                    db.session.add(lesson)
                    fixed_count += 1
                    print(f"  ✅ Fixed and queued for save")
                else:
                    print(f"  ℹ️  No changes needed")
                    
            except Exception as e:
                print(f"  ❌ Error processing: {e}")
                error_count += 1
        
        if fixed_count > 0:
            print(f"\n{'=' * 70}")
            print(f"Committing {fixed_count} fixed lessons to database...")
            try:
                db.session.commit()
                print(f"✅ Successfully fixed {fixed_count} lessons!")
            except Exception as e:
                db.session.rollback()
                print(f"❌ Error saving to database: {e}")
                return
        else:
            print(f"\n{'=' * 70}")
            print("No lessons needed fixing.")
        
        if error_count > 0:
            print(f"\n⚠️  {error_count} lessons had errors and were skipped")
        
        print(f"\n{'=' * 70}")
        print("Summary:")
        print(f"  Total lessons checked: {len(mixed_lessons)}")
        print(f"  Fixed: {fixed_count}")
        print(f"  Errors: {error_count}")
        print(f"  Unchanged: {len(mixed_lessons) - fixed_count - error_count}")
        print("=" * 70)

if __name__ == '__main__':
    main()
