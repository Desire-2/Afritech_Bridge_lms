import sys
sys.path.insert(0, '/home/desire/My_Project/AB/afritec_bridge_lms/backend')

from main import app, db
from src.models.course_models import Course

with app.app_context():
    # Check if the duplicate course exists
    existing = Course.query.filter_by(title="Introduction to Web development basics").first()
    
    if existing:
        print(f"✅ Found existing course with title: '{existing.title}'")
        print(f"   Course ID: {existing.id}")
        print(f"   Instructor ID: {existing.instructor_id}")
        print(f"   Created at: {existing.created_at}")
        print("\nTo test the fix, try creating a course with a different title.")
    else:
        print("❌ No course found with that title")
