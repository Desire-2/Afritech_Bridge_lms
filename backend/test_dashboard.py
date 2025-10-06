#!/usr/bin/env python3
"""
Dashboard Test Script
Test the dashboard functionality step by step to identify the issue.
"""

from main import app
from src.models.course_models import Course, Enrollment, Module, Lesson
from src.models.user_models import User, db
from src.models.student_models import UserProgress, UserBadge, LessonCompletion
from flask_jwt_extended import create_access_token
import json

def test_dashboard():
    """Test dashboard functionality step by step"""
    with app.app_context():
        try:
            print("=== Dashboard Test ===")
            current_user_id = 10
            
            # Step 1: Get enrollments
            print(f"Step 1: Getting enrollments for user {current_user_id}")
            enrollments = Enrollment.query.filter_by(student_id=current_user_id).all()
            print(f"Found {len(enrollments)} enrollments")
            
            enrolled_courses = []
            
            # Step 2: Process each enrollment
            for enrollment in enrollments:
                print(f"\nStep 2: Processing enrollment ID {enrollment.id}")
                try:
                    course_data = enrollment.course.to_dict()
                    print(f"Got course data for course ID: {enrollment.course_id}")
                    course_data['progress'] = enrollment.progress * 100
                    course_data['enrollment_date'] = enrollment.enrollment_date.isoformat()
                    
                    # Step 3: Get current lesson
                    print(f"Step 3: Getting user progress for course {enrollment.course_id}")
                    user_progress = UserProgress.query.filter_by(
                        user_id=current_user_id, 
                        course_id=enrollment.course_id
                    ).first()
                    print(f"User progress found: {user_progress is not None}")
                    
                    if user_progress and user_progress.current_lesson:
                        course_data['current_lesson'] = user_progress.current_lesson.title
                    else:
                        # Get first incomplete lesson
                        print("Getting first module...")
                        first_module = enrollment.course.modules.order_by(Module.order).first()
                        if first_module:
                            print(f"Found first module: {first_module.title}")
                            first_lesson = first_module.lessons.order_by(Lesson.order).first()
                            if first_lesson:
                                print(f"Found first lesson: {first_lesson.title}")
                                course_data['current_lesson'] = first_lesson.title
                            else:
                                print("No lessons found in first module")
                        else:
                            print("No modules found in course")
                    
                    enrolled_courses.append(course_data)
                    print(f"Successfully processed enrollment {enrollment.id}")
                
                except Exception as enrollment_error:
                    print(f"Error processing enrollment {enrollment.id}: {str(enrollment_error)}")
                    import traceback
                    traceback.print_exc()
                    continue
            
            # Step 4: Calculate statistics
            print(f"\nStep 4: Calculating statistics...")
            total_courses = len(enrolled_courses)
            completed_courses = len([c for c in enrolled_courses if c['progress'] >= 100])
            print(f"Total courses: {total_courses}, Completed: {completed_courses}")
            
            # Step 5: Get total study time
            print("Step 5: Getting total study time...")
            total_time = db.session.query(db.func.sum(UserProgress.total_time_spent)).filter_by(
                user_id=current_user_id
            ).scalar() or 0
            print(f"Total study time: {total_time} seconds")
            
            # Step 6: Get achievements/badges
            print("Step 6: Getting user badges...")
            user_badges = UserBadge.query.filter_by(user_id=current_user_id).all()
            achievements = [ub.to_dict() for ub in user_badges]
            print(f"Found {len(achievements)} achievements")
            
            # Step 7: Get recent activity
            print("Step 7: Getting recent activity...")
            recent_completions = LessonCompletion.query.filter_by(
                student_id=current_user_id
            ).order_by(LessonCompletion.completed_at.desc()).limit(5).all()
            print(f"Found {len(recent_completions)} recent completions")
            
            recent_activity = []
            for completion in recent_completions:
                try:
                    recent_activity.append({
                        'type': 'lesson_completion',
                        'lesson_title': completion.lesson.title,
                        'course_title': completion.lesson.module.course.title,
                        'completed_at': completion.completed_at.isoformat()
                    })
                except Exception as e:
                    print(f"Error processing completion: {e}")
            
            # Step 8: Build final response
            print("Step 8: Building final response...")
            response_data = {
                'enrolled_courses': enrolled_courses,
                'stats': {
                    'total_courses': total_courses,
                    'completed_courses': completed_courses,
                    'hours_spent': total_time // 3600,
                    'achievements': len(achievements)
                },
                'achievements': achievements,
                'recent_activity': recent_activity
            }
            
            print("=== SUCCESS ===")
            print(json.dumps(response_data, indent=2, default=str))
            return True
            
        except Exception as e:
            print(f"=== ERROR ===")
            print(f"Dashboard test error: {str(e)}")
            import traceback
            traceback.print_exc()
            return False

if __name__ == "__main__":
    success = test_dashboard()
    if success:
        print("\n✅ Dashboard test completed successfully!")
    else:
        print("\n❌ Dashboard test failed!")