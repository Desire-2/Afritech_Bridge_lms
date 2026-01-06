"""
Email notification helpers for Afritec Bridge LMS
Centralizes email sending for various events
"""
import logging
from ..utils.email_utils import send_email
from ..utils.email_templates import (
    assignment_graded_email,
    quiz_graded_email,
    course_announcement_email
)

logger = logging.getLogger(__name__)

def send_grade_notification(submission, assignment, student, grade, feedback):
    """
    Send email notification when an assignment is graded
    
    Args:
        submission: AssignmentSubmission object
        assignment: Assignment object
        student: User object (student)
        grade: float - grade received
        feedback: str - instructor feedback
    """
    try:
        points_possible = assignment.points_possible or 100
        passed = grade >= (points_possible * 0.6)  # 60% passing grade
        
        student_name = f"{student.first_name} {student.last_name}" if student.first_name else student.username
        
        # Fix: Safely get course title
        course_title = "Your Course"  # Default
        try:
            if hasattr(assignment, 'course') and assignment.course:
                course_title = assignment.course.title
        except (AttributeError, TypeError):
            pass  # Use default
        
        email_html = assignment_graded_email(
            student_name=student_name,
            student_email=student.email,
            assignment_title=assignment.title,
            course_title=course_title,
            grade=grade,
            points_possible=points_possible,
            feedback=feedback or "",
            passed=passed
        )
        
        send_email(
            to=student.email,
            subject=f"📝 Assignment Graded: {assignment.title}",
            template=email_html
        )
        logger.info(f"📧 Grade notification sent to {student.email} for assignment {assignment.id}")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to send grade notification: {str(e)}")
        return False


def send_quiz_grade_notification(student, quiz, score, total_points):
    """
    Send email notification when a quiz is graded
    
    Args:
        student: User object
        quiz: Quiz object
        score: int - points earned
        total_points: int - total possible points
    """
    try:
        percentage = (score / total_points * 100) if total_points > 0 else 0
        passed = percentage >= 60  # 60% passing
        
        student_name = f"{student.first_name} {student.last_name}" if student.first_name else student.username
        
        # Fix: Safely get course title from quiz via module relationship
        course_title = "Your Course"  # Default
        try:
            if hasattr(quiz, 'module') and quiz.module:
                course_title = quiz.module.course.title
            elif hasattr(quiz, 'course') and quiz.course:
                course_title = quiz.course.title
        except (AttributeError, TypeError):
            pass  # Use default
        
        email_html = quiz_graded_email(
            student_name=student_name,
            quiz_title=quiz.title,
            course_title=course_title,
            score=score,
            total_points=total_points,
            percentage=percentage,
            passed=passed
        )
        
        send_email(
            to=student.email,
            subject=f"✅ Quiz Results: {quiz.title}",
            template=email_html
        )
        logger.info(f"📧 Quiz grade notification sent to {student.email} for quiz {quiz.id}")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to send quiz grade notification: {str(e)}")
        return False


def send_announcement_notification(announcement, course, students):
    """
    Send email notification to students about a new course announcement
    
    Args:
        announcement: Announcement object
        course: Course object
        students: List of User objects (enrolled students)
    """
    try:
        instructor_name = f"{course.instructor.first_name} {course.instructor.last_name}" if hasattr(course, 'instructor') else "Your Instructor"
        
        email_sent_count = 0
        email_failed_count = 0
        
        for student in students:
            try:
                student_name = f"{student.first_name} {student.last_name}" if student.first_name else student.username
                
                email_html = course_announcement_email(
                    student_name=student_name,
                    course_title=course.title,
                    announcement_title=announcement.title,
                    announcement_content=announcement.content,
                    instructor_name=instructor_name
                )
                
                if send_email(
                    to=student.email,
                    subject=f"📢 New Announcement: {announcement.title}",
                    template=email_html
                ):
                    email_sent_count += 1
                else:
                    email_failed_count += 1
            except Exception as e:
                logger.error(f"❌ Failed to send announcement to {student.email}: {str(e)}")
                email_failed_count += 1
        
        logger.info(f"📧 Announcement notifications: {email_sent_count} sent, {email_failed_count} failed")
        return {
            'sent': email_sent_count,
            'failed': email_failed_count,
            'total': len(students)
        }
    except Exception as e:
        logger.error(f"❌ Failed to send announcement notifications: {str(e)}")
        return {'sent': 0, 'failed': len(students), 'total': len(students)}


def send_project_graded_notification(submission, project, student, grade, feedback):
    """
    Send email notification when a project is graded
    Similar to assignment grading
    """
    try:
        points_possible = project.points_possible or 100
        passed = grade >= (points_possible * 0.6)
        
        student_name = f"{student.first_name} {student.last_name}" if student.first_name else student.username
        
        # Fix: Safely get course title
        course_title = "Your Course"  # Default
        try:
            if hasattr(project, 'course') and project.course:
                course_title = project.course.title
        except (AttributeError, TypeError):
            pass  # Use default
        
        email_html = assignment_graded_email(
            student_name=student_name,
            student_email=student.email,
            assignment_title=f"Project: {project.title}",
            course_title=course_title,
            grade=grade,
            points_possible=points_possible,
            feedback=feedback or "",
            passed=passed
        )
        
        send_email(
            to=student.email,
            subject=f"🎯 Project Graded: {project.title}",
            template=email_html
        )
        logger.info(f"📧 Project grade notification sent to {student.email}")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to send project grade notification: {str(e)}")
        return False
