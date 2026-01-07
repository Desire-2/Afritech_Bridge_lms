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

def send_modification_request_notification(student_email, student_name, assignment_title, instructor_name, reason, course_title, is_project=False):
    """
    Send email notification when instructor requests modifications
    
    Args:
        student_email: str - student email
        student_name: str - student name
        assignment_title: str - assignment/project title
        instructor_name: str - instructor name
        reason: str - reason for modification request
        course_title: str - course title
        is_project: bool - whether it's a project or assignment
    """
    try:
        item_type = "project" if is_project else "assignment"
        subject = f"📝 Modification Requested: {assignment_title}"
        
        email_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Modification Request</title>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }}
                .header {{ background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px; }}
                .content {{ padding: 20px; }}
                .highlight {{ background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 15px 0; }}
                .footer {{ background: #f8f9fa; padding: 15px; text-align: center; font-size: 0.9em; color: #666; }}
                .btn {{ background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h2>📝 Modification Request</h2>
            </div>
            <div class="content">
                <p>Dear <strong>{student_name}</strong>,</p>
                
                <p>Your instructor <strong>{instructor_name}</strong> has requested modifications to your {item_type} submission.</p>
                
                <div class="highlight">
                    <h4>Assignment Details:</h4>
                    <ul>
                        <li><strong>Course:</strong> {course_title}</li>
                        <li><strong>{item_type.title()}:</strong> {assignment_title}</li>
                        <li><strong>Modification Reason:</strong> {reason}</li>
                    </ul>
                </div>
                
                <p>Please review the feedback and resubmit your {item_type} with the requested modifications.</p>
                
                <p><a href="#" class="btn">Resubmit {item_type.title()}</a></p>
                
                <p>If you have any questions, please don't hesitate to contact your instructor.</p>
                
                <p>Best regards,<br>Afritec Bridge LMS Team</p>
            </div>
            <div class="footer">
                <p>This is an automated message from Afritec Bridge LMS</p>
            </div>
        </body>
        </html>
        """
        
        send_email(
            to=student_email,
            subject=subject,
            template=email_html
        )
        logger.info(f"📧 Modification request notification sent to {student_email}")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to send modification request notification: {str(e)}")
        return False

def send_resubmission_notification(instructor_email, instructor_name, student_name, assignment_title, course_title, is_project=False):
    """
    Send email notification when student resubmits after modification request
    
    Args:
        instructor_email: str - instructor email
        instructor_name: str - instructor name
        student_name: str - student name
        assignment_title: str - assignment/project title
        course_title: str - course title
        is_project: bool - whether it's a project or assignment
    """
    try:
        item_type = "project" if is_project else "assignment"
        subject = f"🔄 {item_type.title()} Resubmitted: {assignment_title}"
        
        email_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Assignment Resubmitted</title>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }}
                .header {{ background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px; }}
                .content {{ padding: 20px; }}
                .highlight {{ background: #d1ecf1; padding: 15px; border-left: 4px solid #17a2b8; margin: 15px 0; }}
                .footer {{ background: #f8f9fa; padding: 15px; text-align: center; font-size: 0.9em; color: #666; }}
                .btn {{ background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h2>🔄 {item_type.title()} Resubmitted</h2>
            </div>
            <div class="content">
                <p>Dear <strong>{instructor_name}</strong>,</p>
                
                <p><strong>{student_name}</strong> has resubmitted their {item_type} with the requested modifications.</p>
                
                <div class="highlight">
                    <h4>Submission Details:</h4>
                    <ul>
                        <li><strong>Course:</strong> {course_title}</li>
                        <li><strong>{item_type.title()}:</strong> {assignment_title}</li>
                        <li><strong>Student:</strong> {student_name}</li>
                        <li><strong>Status:</strong> Awaiting Review</li>
                    </ul>
                </div>
                
                <p>The {item_type} is now ready for review and grading.</p>
                
                <p><a href="#" class="btn">Review Submission</a></p>
                
                <p>Best regards,<br>Afritec Bridge LMS Team</p>
            </div>
            <div class="footer">
                <p>This is an automated message from Afritec Bridge LMS</p>
            </div>
        </body>
        </html>
        """
        
        send_email(
            to=instructor_email,
            subject=subject,
            template=email_html
        )
        logger.info(f"📧 Resubmission notification sent to {instructor_email}")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to send resubmission notification: {str(e)}")
        return False
