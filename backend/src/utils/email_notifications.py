"""
Email notification helpers for Afritec Bridge LMS
Centralizes email sending for various events
"""
import logging
import os
from datetime import datetime
from pathlib import Path

from jinja2 import Template
from ..utils.email_templates import (
    assignment_graded_email,
    quiz_graded_email,
    course_announcement_email,
    full_credit_awarded_email,
    assignment_graded_with_modification_email,
    get_email_footer,
    get_email_header
)
from ..models.user_models import db

# Import brevo service with error handling for missing dependencies
try:
    from ..utils.brevo_email_service import brevo_service
    BREVO_AVAILABLE = True
except (ImportError, ModuleNotFoundError) as e:
    brevo_service = None
    BREVO_AVAILABLE = False

logger = logging.getLogger(__name__)


def _should_send_email(user, category: str) -> bool:
    """Check if the user has opted in for this email category.
    
    Returns True if we should send, False if the user has unsubscribed.
    Always returns True for transactional emails (password reset, security).
    """
    # Master toggle on User model
    if not getattr(user, 'email_notifications', True):
        logger.info(f"Skipping email to user {user.id}: email_notifications disabled")
        return False

    # Check per-category preference if the model is loaded
    try:
        pref = getattr(user, 'notification_preferences', None)
        if pref:
            if not getattr(pref, 'email_enabled', True):
                logger.info(f"Skipping email to user {user.id}: email_enabled=False in preferences")
                return False
            if not pref.is_category_enabled(category):
                logger.info(f"Skipping email to user {user.id}: category '{category}' disabled")
                return False
    except Exception:
        pass  # If preference not loaded, default to sending

    return True


def _get_unsub_token(user) -> str | None:
    """Get (or create) the user's persistent unsubscribe token."""
    try:
        token = user.get_or_create_unsubscribe_token()
        db.session.commit()
        return token
    except Exception as e:
        logger.debug(f"Could not get unsubscribe token for user {user.id}: {e}")
        return None


def _render_cohort_end_migration_template(context: dict) -> str:
    """Render the cohort-end migration email template from disk."""
    template_path = Path(__file__).resolve().parents[1] / "templates" / "emails" / "cohort_end_migration.html"
    try:
        template_text = template_path.read_text(encoding="utf-8")
        return Template(template_text).render(**context)
    except Exception as e:
        logger.error(f"❌ Failed to render cohort-end migration template: {str(e)}")
        return f"""
        <html>
          <body style="font-family: Arial, sans-serif; color: #1f2937;">
            <h2>AfriTech Bridge</h2>
            <p>Hello {context.get('student_name', 'Student')},</p>
            <p>Your cohort <strong>{context.get('old_cohort_label', 'previous cohort')}</strong> has ended and you have been moved to <strong>{context.get('new_cohort_label', 'the next cohort')}</strong>.</p>
          </body>
        </html>
        """


def send_cohort_end_migration_email(enrollment, old_window, new_window):
    """Send migration notification to student after cohort-end auto-migration."""
    try:
        if not BREVO_AVAILABLE or brevo_service is None:
            logger.warning("📧 Email service not available - cannot send cohort-end migration email")
            return False

        student = enrollment.student if getattr(enrollment, 'student', None) else None
        if not student and getattr(enrollment, 'student_id', None):
            from ..models.user_models import User
            student = User.query.get(enrollment.student_id)

        if not student or not student.email:
            logger.warning(f"Cannot send cohort-end migration email for enrollment {getattr(enrollment, 'id', None)}: missing student email")
            return False

        if not _should_send_email(student, 'enrollment'):
            return False

        student_name = f"{student.first_name} {student.last_name}".strip() if getattr(student, 'first_name', None) or getattr(student, 'last_name', None) else student.username
        unsub_token = _get_unsub_token(student)

        effective_type = new_window.get_effective_enrollment_type()
        effective_price = new_window.get_effective_price()
        currency = new_window.get_effective_currency()
        requires_payment = bool(effective_price and effective_price > 0)

        progress = getattr(enrollment, 'progress', 0) or 0
        if progress <= 1:
            progress = round(progress * 100, 2)

        context = {
            'student_name': student_name,
            'course_title': enrollment.course.title if enrollment.course else 'Course',
            'old_cohort_label': old_window.cohort_label or 'Previous Cohort',
            'new_cohort_label': new_window.cohort_label or 'Next Cohort',
            'new_cohort_start': new_window.cohort_start.strftime('%b %d, %Y') if new_window.cohort_start else 'TBA',
            'new_cohort_end': new_window.cohort_end.strftime('%b %d, %Y') if new_window.cohort_end else 'TBA',
            'progress': int(round(progress)),
            'requires_payment': requires_payment,
            'cohort_price': f"{effective_price:,.2f}" if effective_price is not None else '0.00',
            'currency': currency,
            'dashboard_url': f"{os.environ.get('FRONTEND_URL', 'https://study.afritechbridge.online').rstrip('/')}/student/dashboard",
            'footer_html': get_email_footer(unsubscribe_token=unsub_token, email_category='enrollment'),
            'unsubscribe_token': unsub_token,
        }

        email_html = _render_cohort_end_migration_template(context)
        subject = f"📚 Cohort Update: {context['new_cohort_label']}"
        return brevo_service.send_email(
            to_emails=[student.email],
            subject=subject,
            html_content=email_html,
        )
    except Exception as e:
        logger.error(f"❌ Failed to send cohort-end migration email: {str(e)}")
        return False


def send_admin_alert_no_next_cohort(course, cohort_label, affected_student_count, cohort_end_date):
    """Send admin alert when no next cohort exists for migrated students."""
    try:
        from ..models.user_models import User, Role

        if not BREVO_AVAILABLE or brevo_service is None:
            logger.warning("📧 Email service not available - cannot send no-next-cohort admin alert")
            return False

        admin_role = Role.query.filter_by(name='admin').first()
        if not admin_role:
            logger.warning("No admin role found - cannot send alert email")
            return False

        admins = User.query.filter_by(role_id=admin_role.id).all()
        admin_emails = [admin.email for admin in admins if admin.email]
        if not admin_emails:
            logger.warning("No admin users with emails found - cannot send alert")
            return False

        admin_panel_url = f"{os.environ.get('FRONTEND_URL', 'https://study.afritechbridge.online').rstrip('/')}/admin/waitlist"
        email_html = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Cohort End Alert</title>
        </head>
        <body style="margin:0;padding:0;background:#2c3e50;font-family:Arial,sans-serif;">
          <div style="max-width:600px;margin:0 auto;background:#34495e;color:#e5e7eb;padding:32px;border-radius:18px;">
            <h2 style="color:#fff;margin-top:0;">⚠️ Cohort End Alert</h2>
            <p>Course: <strong>{course.title if course else 'Unknown Course'}</strong></p>
            <p>Closing cohort: <strong>{cohort_label}</strong></p>
            <p>Non-completed students affected: <strong>{affected_student_count}</strong></p>
            <p>Cohort end date: <strong>{cohort_end_date.strftime('%b %d, %Y') if cohort_end_date else 'TBA'}</strong></p>
            <p><a href="{admin_panel_url}" style="display:inline-block;background:#f59e0b;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700;">Open Admin Panel</a></p>
          </div>
        </body>
        </html>
        """

        return brevo_service.send_email(
            to_emails=admin_emails,
            subject=f"⚠️ Cohort End Alert: {cohort_label} ({course.title if course else 'Course'})",
            html_content=email_html,
        )
    except Exception as e:
        logger.error(f"❌ Failed to send admin alert email: {str(e)}")
        return False

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
        # Check user preference
        if not _should_send_email(student, 'grades'):
            return False
        
        points_possible = assignment.points_possible or 100
        passed = grade >= (points_possible * 0.6)  # 60% passing grade
        
        student_name = f"{student.first_name} {student.last_name}" if student.first_name else student.username
        unsub_token = _get_unsub_token(student)
        
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
            passed=passed,
            assignment_id=assignment.id,
            unsubscribe_token=unsub_token
        )
        
        # Check if brevo service is available
        if not BREVO_AVAILABLE or brevo_service is None:
            logger.warning("📧 Email service not available - cannot send grade notification")
            return False
        
        brevo_service.send_email(
            to_emails=[student.email],
            subject=f"📝 Assignment Graded: {assignment.title}",
            html_content=email_html
        )
        logger.info(f"📧 Grade notification sent to {student.email} for assignment {assignment.id}")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to send grade notification: {str(e)}")
        return False


def send_grade_with_modification_notification(submission, assignment, student, grade, feedback,
                                                modification_reason, instructor_name, 
                                                resubmission_deadline, frontend_url,
                                                passing_percentage=60.0, is_project=False):
    """
    Send combined email notification when an assignment/project is graded below passing score
    and a modification request is automatically generated.
    
    Args:
        submission: AssignmentSubmission or ProjectSubmission object
        assignment: Assignment or Project object
        student: User object (student)
        grade: float - grade received
        feedback: str - instructor feedback
        modification_reason: str - reason for modification request
        instructor_name: str - name of the grading instructor
        resubmission_deadline: str - formatted deadline for resubmission
        frontend_url: str - frontend base URL for generating links
        passing_percentage: float - the passing threshold percentage
        is_project: bool - whether this is a project (vs assignment)
    """
    try:
        # Check user preference
        if not _should_send_email(student, 'grades'):
            return False

        item_type = "project" if is_project else "assignment"
        points_possible = assignment.points_possible or 100
        percentage = (grade / points_possible * 100) if points_possible > 0 else 0
        
        student_name = f"{student.first_name} {student.last_name}" if student.first_name else student.username
        unsub_token = _get_unsub_token(student)
        
        # Safely get course title
        course_title = "Your Course"
        try:
            if hasattr(assignment, 'course') and assignment.course:
                course_title = assignment.course.title
        except (AttributeError, TypeError):
            pass
        
        # Generate resubmission URL - links to the modifications page
        resubmit_url = f"{frontend_url}/student/modifications" if frontend_url else "#"
        
        email_html = assignment_graded_with_modification_email(
            student_name=student_name,
            student_email=student.email,
            assignment_title=f"Project: {assignment.title}" if is_project else assignment.title,
            course_title=course_title,
            grade=grade,
            points_possible=points_possible,
            feedback=feedback or "",
            modification_reason=modification_reason,
            instructor_name=instructor_name,
            resubmission_deadline=resubmission_deadline,
            resubmit_url=resubmit_url,
            passing_percentage=passing_percentage,
            is_project=is_project,
            unsubscribe_token=unsub_token
        )
        
        # Check if brevo service is available
        if not BREVO_AVAILABLE or brevo_service is None:
            logger.warning("📧 Email service not available - cannot send grade + modification notification")
            return False
        
        subject_icon = "🎯" if is_project else "📝"
        brevo_service.send_email(
            to_emails=[student.email],
            subject=f"{subject_icon} {item_type.title()} Graded — Modification Required: {assignment.title}",
            html_content=email_html
        )
        logger.info(f"📧 Grade + modification notification sent to {student.email} for {item_type} {assignment.id}")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to send grade + modification notification: {str(e)}")
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
        # Check user preference
        if not _should_send_email(student, 'grades'):
            return False

        percentage = (score / total_points * 100) if total_points > 0 else 0
        passed = percentage >= 60  # 60% passing
        
        student_name = f"{student.first_name} {student.last_name}" if student.first_name else student.username
        unsub_token = _get_unsub_token(student)
        
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
            passed=passed,
            unsubscribe_token=unsub_token
        )
        
        # Check if brevo service is available
        if not BREVO_AVAILABLE or brevo_service is None:
            logger.warning("📧 Email service not available - cannot send quiz notification")
            return False
        
        brevo_service.send_email(
            to_emails=[student.email],
            subject=f"✅ Quiz Results: {quiz.title}",
            html_content=email_html
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
                # Check per-student preference
                if not _should_send_email(student, 'announcements'):
                    continue

                student_name = f"{student.first_name} {student.last_name}" if student.first_name else student.username
                unsub_token = _get_unsub_token(student)
                
                email_html = course_announcement_email(
                    student_name=student_name,
                    course_title=course.title,
                    announcement_title=announcement.title,
                    announcement_content=announcement.content,
                    instructor_name=instructor_name,
                    unsubscribe_token=unsub_token
                )
                
                if brevo_service.send_email(
                    to_emails=[student.email],
                    subject=f"📢 New Announcement: {announcement.title}",
                    html_content=email_html
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
        # Check user preference
        if not _should_send_email(student, 'grades'):
            return False

        points_possible = project.points_possible or 100
        passed = grade >= (points_possible * 0.6)
        
        student_name = f"{student.first_name} {student.last_name}" if student.first_name else student.username
        unsub_token = _get_unsub_token(student)
        
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
            passed=passed,
            assignment_id=project.id,
            unsubscribe_token=unsub_token
        )
        
        brevo_service.send_email(
            to_emails=[student.email],
            subject=f"🎯 Project Graded: {project.title}",
            html_content=email_html
        )
        logger.info(f"📧 Project grade notification sent to {student.email}")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to send project grade notification: {str(e)}")
        return False

def send_modification_request_notification(student_email, student_name, assignment_title, instructor_name, reason, course_title, is_project=False, assignment_id=None, due_date=None, frontend_url=None, student=None):
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
        assignment_id: int - assignment/project ID for URL generation
        due_date: str - resubmission deadline (optional)
        frontend_url: str - frontend base URL for link generation
        student: User object (optional) - for preference checking and unsubscribe token
    """
    try:
        # Check user preference if student object is provided
        if student and not _should_send_email(student, 'grades'):
            return False

        unsub_token = _get_unsub_token(student) if student else None

        item_type = "project" if is_project else "assignment"
        subject = f"📝 Modification Requested: {assignment_title}"
        
        # Generate resubmission URL - links to the modifications page
        resubmit_url = f"{frontend_url}/student/modifications" if frontend_url else "#"
        
        # Format due date if provided
        due_date_html = ""
        if due_date:
            due_date_html = f"<li><strong>Resubmission Deadline:</strong> {due_date}</li>"
        
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
                .urgent {{ background: #f8d7da; padding: 15px; border-left: 4px solid #dc3545; margin: 15px 0; }}
                .footer {{ background: #f8f9fa; padding: 15px; text-align: center; font-size: 0.9em; color: #666; }}
                .btn {{ background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0; }}
                .btn:hover {{ background: #0056b3; }}
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
                        <li><strong>Instructor Feedback:</strong> {reason}</li>
                        {due_date_html}
                    </ul>
                </div>
                
                <div class="urgent">
                    <p><strong>⚠️ Action Required:</strong> Please review the feedback carefully and resubmit your {item_type} with the requested modifications to avoid any delays in your progress.</p>
                </div>
                
                <p>Steps to resubmit:</p>
                <ol>
                    <li>Log into your student dashboard</li>
                    <li>Navigate to the assignment</li>
                    <li>Review the instructor feedback</li>
                    <li>Make necessary improvements</li>
                    <li>Upload your revised submission</li>
                </ol>
                
                <p><a href="{resubmit_url}" class="btn">Resubmit {item_type.title()}</a></p>
                
                <p>If you have any questions about the feedback or need clarification, please don't hesitate to contact your instructor <strong>{instructor_name}</strong>.</p>
                
                <p>Best regards,<br>Afritec Bridge LMS Team</p>
            </div>
            {get_email_footer(unsubscribe_token=unsub_token, email_category='grades')}
        </body>
        </html>
        """
        
        # Try to send the email with retries
        success = brevo_service.send_email(
            to_emails=[student_email],
            subject=subject,
            html_content=email_html
        )
        
        if success:
            logger.info(f"📧 Modification request notification sent to {student_email}")
            return True
        else:
            logger.error(f"❌ Failed to send modification request notification to {student_email} after retries")
            return False
    except Exception as e:
        logger.error(f"❌ Failed to send modification request notification: {str(e)}")
        return False

def send_admin_modification_alert(admin_email, instructor_name, student_name, assignment_title, course_title, reason, is_project=False):
    """
    Send admin notification when modification requests exceed threshold or for tracking
    
    Args:
        admin_email: str - admin email
        instructor_name: str - instructor who requested modification
        student_name: str - student name
        assignment_title: str - assignment/project title
        course_title: str - course title
        reason: str - reason for modification
        is_project: bool - whether it's a project or assignment
    """
    try:
        item_type = "project" if is_project else "assignment"
        subject = f"⚠️ Admin Alert: Modification Request - {assignment_title}"
        
        email_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Admin Alert: Modification Request</title>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }}
                .header {{ background: #dc3545; color: white; padding: 20px; text-align: center; border-radius: 8px; }}
                .content {{ padding: 20px; }}
                .alert {{ background: #f8d7da; padding: 15px; border-left: 4px solid #dc3545; margin: 15px 0; }}
                .details {{ background: #e9ecef; padding: 15px; border-radius: 5px; margin: 15px 0; }}
                .footer {{ background: #f8f9fa; padding: 15px; text-align: center; font-size: 0.9em; color: #666; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h2>⚠️ Admin Alert: Modification Request</h2>
            </div>
            <div class="content">
                <p>Dear Admin,</p>
                
                <p>A new modification request has been initiated in the system.</p>
                
                <div class="alert">
                    <h4>Request Summary:</h4>
                    <ul>
                        <li><strong>Instructor:</strong> {instructor_name}</li>
                        <li><strong>Student:</strong> {student_name}</li>
                        <li><strong>Course:</strong> {course_title}</li>
                        <li><strong>{item_type.title()}:</strong> {assignment_title}</li>
                    </ul>
                </div>
                
                <div class="details">
                    <h4>Modification Reason:</h4>
                    <p>{reason}</p>
                </div>
                
                <p>This alert is for tracking and quality assurance purposes. No immediate action is required unless patterns emerge.</p>
                
                <p>Best regards,<br>Afritec Bridge LMS System</p>
            </div>
            {get_email_footer(email_category='system')}
        </body>
        </html>
        """
        
        # Send admin alert (non-critical, so don't fail if it doesn't work)
        success = brevo_service.send_email(
            to_emails=[admin_email],
            subject=subject,
            html_content=email_html
        )
        
        if success:
            logger.info(f"📧 Admin modification alert sent to {admin_email}")
        else:
            logger.warning(f"⚠️ Could not send admin modification alert to {admin_email}")
        
        return success
    except Exception as e:
        logger.error(f"❌ Failed to send admin modification alert: {str(e)}")
        return False

def send_modification_digest(recipient_email, recipient_name, modifications, period="daily"):
    """
    Send digest email for multiple modification requests
    
    Args:
        recipient_email: str - recipient email (admin or instructor)
        recipient_name: str - recipient name
        modifications: list - list of modification request dictionaries
        period: str - digest period (daily/weekly)
    """
    try:
        subject = f"📊 {period.title()} Modification Requests Digest"
        
        # Generate modification list HTML
        modifications_html = ""
        for mod in modifications:
            modifications_html += f"""
            <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">{mod.get('course_title', 'N/A')}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">{mod.get('assignment_title', 'N/A')}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">{mod.get('student_name', 'N/A')}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">{mod.get('instructor_name', 'N/A')}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">{mod.get('status', 'Pending')}</td>
            </tr>
            """
        
        email_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>{period.title()} Modification Digest</title>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; }}
                .header {{ background: #007bff; color: white; padding: 20px; text-align: center; border-radius: 8px; }}
                .content {{ padding: 20px; }}
                .summary {{ background: #e7f3ff; padding: 15px; border-left: 4px solid #007bff; margin: 15px 0; }}
                .table {{ width: 100%; border-collapse: collapse; margin: 15px 0; }}
                .table th {{ background: #f8f9fa; padding: 10px; text-align: left; border: 1px solid #ddd; }}
                .footer {{ background: #f8f9fa; padding: 15px; text-align: center; font-size: 0.9em; color: #666; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h2>📊 {period.title()} Modification Requests Digest</h2>
            </div>
            <div class="content">
                <p>Dear <strong>{recipient_name}</strong>,</p>
                
                <div class="summary">
                    <h4>Summary:</h4>
                    <ul>
                        <li><strong>Total Modification Requests:</strong> {len(modifications)}</li>
                        <li><strong>Period:</strong> {period.title()}</li>
                        <li><strong>Generated:</strong> {datetime.now().strftime('%B %d, %Y at %I:%M %p')}</li>
                    </ul>
                </div>
                
                <h4>Modification Requests:</h4>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Course</th>
                            <th>Assignment/Project</th>
                            <th>Student</th>
                            <th>Instructor</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {modifications_html}
                    </tbody>
                </table>
                
                <p>This digest provides an overview of modification request activity for quality monitoring and administrative purposes.</p>
                
                <p>Best regards,<br>Afritec Bridge LMS System</p>
            </div>
            {get_email_footer(email_category='system')}
        </body>
        </html>
        """
        
        # Send digest email
        success = brevo_service.send_email(
            to_emails=[recipient_email],
            subject=subject,
            html_content=email_html
        )
        
        if success:
            logger.info(f"📧 {period.title()} modification digest sent to {recipient_email}")
        else:
            logger.warning(f"⚠️ Could not send modification digest to {recipient_email}")
        
        return success
    except Exception as e:
        logger.error(f"❌ Failed to send modification digest: {str(e)}")
        return False

def send_resubmission_notification(instructor_email, instructor_name, student_name, assignment_title, course_title, is_project=False, assignment_id=None, frontend_url=None, submission_notes=None, instructor=None):
    """
    Send email notification when student resubmits after modification request
    
    Args:
        instructor_email: str - instructor email
        instructor_name: str - instructor name
        student_name: str - student name
        assignment_title: str - assignment/project title
        course_title: str - course title
        is_project: bool - whether it's a project or assignment
        assignment_id: int - assignment/project ID for URL generation
        frontend_url: str - frontend base URL for link generation
        submission_notes: str - optional notes from student
        instructor: User object (optional) - for preference checking and unsubscribe token
    """
    try:
        # Check user preference if instructor object provided
        if instructor and not _should_send_email(instructor, 'grades'):
            return False

        unsub_token = _get_unsub_token(instructor) if instructor else None
        item_type = "project" if is_project else "assignment"
        subject = f"🔄 {item_type.title()} Resubmitted: {assignment_title}"
        
        # Generate review URL if frontend_url is provided
        review_url = "#"
        if frontend_url and assignment_id:
            review_url = f"{frontend_url}/instructor/assignments/{assignment_id}/submissions"
        
        # Add submission notes if provided
        notes_html = ""
        if submission_notes:
            notes_html = f"<li><strong>Student Notes:</strong> {submission_notes}</li>"
        
        # Import datetime for current timestamp
        from datetime import datetime
        
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
                .priority {{ background: #d4edda; padding: 15px; border-left: 4px solid #28a745; margin: 15px 0; }}
                .footer {{ background: #f8f9fa; padding: 15px; text-align: center; font-size: 0.9em; color: #666; }}
                .btn {{ background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0; }}
                .btn:hover {{ background: #218838; }}
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
                        <li><strong>Submitted:</strong> {datetime.now().strftime('%B %d, %Y at %I:%M %p')}</li>
                        {notes_html}
                    </ul>
                </div>
                
                <div class="priority">
                    <p><strong>📋 Review Priority:</strong> This is a resubmission following your modification request. Please review at your earliest convenience to maintain student momentum and progress.</p>
                </div>
                
                <p>The {item_type} is now ready for review and grading. You can access the submission through your instructor dashboard.</p>
                
                <p><a href="{review_url}" class="btn">Review Submission</a></p>
                
                <p>If you have any questions about the resubmission, please don't hesitate to contact the student.</p>
                
                <p>Best regards,<br>Afritec Bridge LMS Team</p>
            </div>
            {get_email_footer(unsubscribe_token=unsub_token, email_category='grades')}
        </body>
        </html>
        """
        
        # Try to send the email with retries
        success = brevo_service.send_email(
            to_emails=[instructor_email],
            subject=subject,
            html_content=email_html
        )
        
        if success:
            logger.info(f"📧 Resubmission notification sent to {instructor_email}")
            return True
        else:
            logger.error(f"❌ Failed to send resubmission notification to {instructor_email} after retries")
            return False
    except Exception as e:
        logger.error(f"❌ Failed to send resubmission notification: {str(e)}")
        return False


def send_full_credit_notification(student, module, course, instructor, reason=None, details=None):
    """
    Send email notification when full credit is awarded to a student for a module
    
    Args:
        student: User object (student receiving full credit)
        module: Module object for which credit is awarded
        course: Course object containing the module
        instructor: User object (instructor awarding the credit)
        reason: Optional string explaining why full credit was awarded
        details: Optional dictionary with breakdown of components updated
    """
    try:
        # Check if brevo service is available
        if not BREVO_AVAILABLE or brevo_service is None:
            logger.warning("📧 Email service not available (missing dependencies) - cannot send full credit notification")
            return False
        
        # Check user preference
        if not _should_send_email(student, 'grades'):
            return False

        # Build student name
        student_name = f"{student.first_name} {student.last_name}" if student.first_name else student.username
        instructor_name = f"{instructor.first_name} {instructor.last_name}" if instructor.first_name else instructor.username
        unsub_token = _get_unsub_token(student)
        
        # Generate the email content using the template
        email_html = full_credit_awarded_email(
            student_name=student_name,
            module_title=module.title,
            course_title=course.title,
            instructor_name=instructor_name,
            reason=reason,
            details=details,
            unsubscribe_token=unsub_token
        )
        
        # Send the email
        success = brevo_service.send_email(
            to_emails=[student.email],
            subject=f"🏆 Full Credit Awarded: {module.title} - {course.title}",
            html_content=email_html
        )
        
        if success:
            logger.info(f"📧 Full credit notification sent to {student.email} for module {module.id}")
            return True
        else:
            logger.error(f"❌ Failed to send full credit notification to {student.email}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Failed to send full credit notification: {str(e)}")
        return False


def send_cohort_end_migration_email_legacy(student, enrollment, old_cohort_label, new_cohort_label, new_cohort_start, new_cohort_end, requires_payment, cohort_price, currency):
    """
    Send cohort-end auto-migration email to student.
    
    Args:
        student: User object
        enrollment: Enrollment object (migrated enrollment)
        old_cohort_label: Label of closing cohort
        new_cohort_label: Label of new cohort
        new_cohort_start: Start datetime of new cohort
        new_cohort_end: End datetime of new cohort
        requires_payment: Boolean - whether new cohort requires payment
        cohort_price: Price of new cohort (if paid)
        currency: Currency code
    
    Returns:
        Boolean - success
    """
    try:
        # Check user preference
        if not _should_send_email(student, 'course'):
            return False
        
        from ..utils.email_templates import cohort_end_migration_email
        
        student_name = f"{student.first_name} {student.last_name}" if student.first_name else student.username
        unsub_token = _get_unsub_token(student)
        
        # Calculate progress percentage
        progress_percentage = int((enrollment.progress or 0) * 100) if enrollment.progress else 0
        
        email_html = cohort_end_migration_email(
            student_name=student_name,
            course_title=enrollment.course.title if enrollment.course else "Course",
            old_cohort_label=old_cohort_label,
            new_cohort_label=new_cohort_label,
            new_cohort_start=new_cohort_start,
            new_cohort_end=new_cohort_end,
            progress_percentage=progress_percentage,
            requires_payment=requires_payment,
            cohort_price=cohort_price,
            currency=currency,
            unsubscribe_token=unsub_token
        )
        
        return brevo_service.send_email(
            to_emails=[student.email],
            subject=f"📚 Cohort Update: {new_cohort_label}",
            html_content=email_html
        )
    except Exception as e:
        logger.error(f"❌ Failed to send cohort-end migration email: {str(e)}")
        return False


def send_admin_alert_no_next_cohort(course, cohort_label, affected_student_count, cohort_end_date):
    """
    Send admin alert when cohort ends but no next cohort exists.
    
    Args:
        course: Course object
        cohort_label: Label of closing cohort
        affected_student_count: Count of non-completed students
        cohort_end_date: End datetime of closing cohort
    
    Returns:
        Boolean - success
    """
    try:
        from ..utils.email_templates import admin_alert_no_next_cohort_email
        from ..models.user_models import User, Role
        
        # Get all admin emails
        admin_role = Role.query.filter_by(name='admin').first()
        if not admin_role:
            logger.warning("No admin role found - cannot send alert email")
            return False
        
        admins = User.query.filter_by(role_id=admin_role.id).all()
        admin_emails = [admin.email for admin in admins if admin.email]
        
        if not admin_emails:
            logger.warning("No admin users with emails found - cannot send alert")
            return False
        
        email_html = admin_alert_no_next_cohort_email(
            course_title=course.title if course else "Unknown Course",
            cohort_label=cohort_label,
            affected_student_count=affected_student_count,
            cohort_end_date=cohort_end_date
        )
        
        success = brevo_service.send_email(
            to_emails=admin_emails,
            subject=f"⚠️ Cohort End Alert: {cohort_label} ({course.title if course else 'Course'})",
            html_content=email_html
        )
        
        if success:
            logger.info(f"✅ Admin alert email sent to {len(admin_emails)} admins")
        return success
    except Exception as e:
        logger.error(f"❌ Failed to send admin alert email: {str(e)}")
        return False
