"""
Inactivity Service for Afritec Bridge LMS
Handles tracking and managing inactive students and users
"""

from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
import logging

from ..utils.time_utils import now_local
from ..models.user_models import db, User, Role
from ..models.course_models import Enrollment, Course, Submission
from ..models.student_models import LessonCompletion, UserProgress, StudentNote, StudentBookmark
from ..models.achievement_models import LearningStreak
from ..utils.brevo_email_service import brevo_service

logger = logging.getLogger(__name__)

class InactivityService:
    """Service for managing inactive students and users"""
    
    # Default thresholds
    STUDENT_INACTIVITY_THRESHOLD = 7  # days
    USER_DELETION_THRESHOLD = 14      # days
    WARNING_BEFORE_TERMINATION = 2    # days before termination to send warning
    
    @staticmethod
    def get_inactive_students(instructor_id: Optional[int] = None,
                            threshold_days: int = STUDENT_INACTIVITY_THRESHOLD,
                            course_id: Optional[int] = None,
                            application_window_id: Optional[int] = None) -> List[Dict]:
        """
        Get students who haven't studied for the specified number of days.
        Results are scoped to the given instructor / course / cohort (window).

        Args:
            instructor_id: If provided, only check students in this instructor's courses
            threshold_days: Number of days without activity to consider inactive
            course_id: If provided, only consider enrollments in this course
            application_window_id: If provided, only consider enrollments in this cohort

        Returns:
            List of inactive student data (unique per student, sorted most inactive first)
        """
        cutoff_date = now_local() - timedelta(days=threshold_days)

        # Scope enrollments first (single-row-per-enrollment, avoids duplicate students)
        enrollment_query = Enrollment.query.filter(Enrollment.status == 'active')
        if instructor_id:
            enrollment_query = enrollment_query.join(
                Course, Enrollment.course_id == Course.id
            ).filter(Course.instructor_id == instructor_id)
        if course_id is not None:
            enrollment_query = enrollment_query.filter(Enrollment.course_id == course_id)
        if application_window_id is not None:
            enrollment_query = enrollment_query.filter(
                Enrollment.application_window_id == application_window_id
            )

        scoped_enrollments = enrollment_query.all()
        if not scoped_enrollments:
            return []

        students_by_id: Dict[int, User] = {
            s.id: s for s in User.query.filter(
                User.id.in_({e.student_id for e in scoped_enrollments}),
                User.is_active == True
            ).all()
        }
        inactive_students: List[Dict] = []

        for student_id, student in students_by_id.items():
            last_study_activity = InactivityService._get_last_study_activity(student_id)

            # Check if student is inactive
            if last_study_activity and last_study_activity >= cutoff_date:
                continue

            # Only include if the student has scoped (active) enrollments
            enrollments = [e for e in scoped_enrollments if e.student_id == student_id]
            if not enrollments:
                continue

            days_inactive = InactivityService._compute_days_inactive(
                student, last_study_activity
            )

            inactive_students.append({
                'student_id': student.id,
                'username': student.username,
                'email': student.email,
                'first_name': student.first_name,
                'last_name': student.last_name,
                'last_study_activity': last_study_activity.isoformat() if last_study_activity else None,
                'last_general_activity': student.last_activity.isoformat() if student.last_activity else None,
                'days_inactive': days_inactive,
                'enrolled_courses': [
                    {
                        'course_id': e.course.id,
                        'course_title': e.course.title,
                        'enrollment_id': e.id,
                        'enrollment_date': e.enrollment_date.isoformat(),
                        'progress': e.progress,
                        'status': e.status,
                        'application_window_id': e.application_window_id,
                        'cohort_label': e.cohort_label or (e.application_window.cohort_label if e.application_window else None),
                        'cohort_start_date': e.cohort_start_date.isoformat() if e.cohort_start_date else None,
                        'cohort_end_date': e.cohort_end_date.isoformat() if e.cohort_end_date else None,
                    } for e in enrollments
                ]
            })

        # Sort by days inactive (most inactive first)
        inactive_students.sort(key=lambda x: x['days_inactive'] or 999, reverse=True)
        return inactive_students

    @staticmethod
    def _compute_days_inactive(student: User, last_study_activity: Optional[datetime]) -> int:
        """Best-effort number of days since the student last engaged with the platform."""
        candidates = []
        if last_study_activity:
            candidates.append(last_study_activity)
        if student.last_activity:
            candidates.append(student.last_activity)
        if student.last_login:
            candidates.append(student.last_login)
        if student.created_at:
            candidates.append(student.created_at)

        if not candidates:
            return 365  # No timestamps at all - consider very inactive
        latest = max(candidates)
        return (now_local() - latest).days if latest else 365
    
    @staticmethod
    def get_inactive_users(threshold_days: int = USER_DELETION_THRESHOLD) -> List[Dict]:
        """
        Get users who haven't been active for the specified number of days
        
        Args:
            threshold_days: Number of days without activity to consider for deletion
            
        Returns:
            List of inactive user data
        """
        cutoff_date = now_local() - timedelta(days=threshold_days)
        
        # Get users with no recent activity
        users = User.query.filter(
            User.is_active == True,
            db.or_(
                User.last_activity < cutoff_date,
                db.and_(User.last_activity.is_(None), User.created_at < cutoff_date)
            )
        ).all()
        
        inactive_users = []
        
        for user in users:
            # Calculate days inactive
            days_inactive = None
            if user.last_activity:
                days_inactive = (now_local() - user.last_activity).days
            else:
                days_inactive = (now_local() - user.created_at).days
            
            # Get role-specific data
            role_data = {}
            if user.role.name == 'student':
                # Count enrollments and completions
                enrollments = Enrollment.query.filter_by(student_id=user.id).count()
                completions = LessonCompletion.query.filter_by(student_id=user.id).count()
                role_data = {
                    'enrollments_count': enrollments,
                    'lessons_completed': completions
                }
            elif user.role.name == 'instructor':
                # Count courses created
                courses = Course.query.filter_by(instructor_id=user.id).count()
                role_data = {
                    'courses_created': courses
                }
            
            inactive_users.append({
                'user_id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'role': user.role.name,
                'last_activity': user.last_activity.isoformat() if user.last_activity else None,
                'last_login': user.last_login.isoformat() if user.last_login else None,
                'created_at': user.created_at.isoformat(),
                'days_inactive': days_inactive,
                'role_data': role_data
            })
        
        # Sort by days inactive (most inactive first)
        inactive_users.sort(key=lambda x: x['days_inactive'], reverse=True)
        return inactive_users
    
    @staticmethod
    def terminate_inactive_student(student_id: int, instructor_id: int,
                                 reason: str = "Inactivity",
                                 course_id: Optional[int] = None,
                                 application_window_id: Optional[int] = None) -> Dict:
        """
        Terminate a student from instructor's courses due to inactivity.

        Args:
            student_id: ID of the student to terminate
            instructor_id: ID of the instructor performing termination
            reason: Reason for termination
            course_id: Restrict termination to a specific course
            application_window_id: Restrict termination to a specific cohort

        Returns:
            Result dictionary with success status and details
        """
        try:
            student = User.query.get_or_404(student_id)
            
            # Get enrollments in instructor's courses (optionally scoped to a
            # specific course / cohort so terminating one cohort doesn't touch others)
            query = Enrollment.query.join(Course).filter(
                Enrollment.student_id == student_id,
                Course.instructor_id == instructor_id,
                Enrollment.status == 'active'
            )
            if course_id is not None:
                query = query.filter(Enrollment.course_id == course_id)
            if application_window_id is not None:
                query = query.filter(
                    Enrollment.application_window_id == application_window_id
                )
            enrollments = query.all()
            
            if not enrollments:
                return {
                    'success': False,
                    'message': 'No active enrollments found for this student in your courses'
                }
            
            terminated_courses = []
            
            for enrollment in enrollments:
                # Update enrollment status
                enrollment.status = 'terminated'
                enrollment.terminated_at = now_local()
                enrollment.termination_reason = reason
                
                terminated_courses.append({
                    'course_id': enrollment.course.id,
                    'course_title': enrollment.course.title,
                    'enrollment_id': enrollment.id
                })
            
            db.session.commit()
            
            # Send notification email to student
            try:
                InactivityService._send_termination_notification(
                    student, terminated_courses, reason
                )
            except Exception as e:
                logger.warning(f"Failed to send termination notification: {str(e)}")
            
            return {
                'success': True,
                'message': f'Successfully terminated {len(terminated_courses)} enrollments',
                'terminated_courses': terminated_courses
            }
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error terminating student {student_id}: {str(e)}")
            return {
                'success': False,
                'message': f'Failed to terminate student: {str(e)}'
            }
    
    @staticmethod
    def auto_delete_inactive_user(user_id: int, admin_id: int) -> Dict:
        """
        Auto-delete an inactive user (admin function)
        
        Args:
            user_id: ID of the user to delete
            admin_id: ID of the admin performing deletion
            
        Returns:
            Result dictionary with success status and details
        """
        try:
            user = User.query.get_or_404(user_id)
            
            # Prevent deletion of admin accounts
            if user.role.name == 'admin':
                return {
                    'success': False,
                    'message': 'Cannot auto-delete admin accounts'
                }
            
            # Store user info for logging
            user_info = {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'role': user.role.name
            }
            
            # Send notification before deletion
            try:
                InactivityService._send_deletion_notification(user)
            except Exception as e:
                logger.warning(f"Failed to send deletion notification: {str(e)}")
            
            # Delete user and related data using existing admin logic
            from ..routes.admin_routes import delete_user_admin
            
            # Note: This is a simplified approach. In production, you might want to
            # implement a more sophisticated cascade deletion here.
            
            # Soft delete approach - mark as deleted instead of hard delete
            user.is_active = False
            user.deleted_at = now_local()
            user.deleted_by = admin_id
            user.deletion_reason = 'Auto-deleted due to prolonged inactivity'
            
            db.session.commit()
            
            logger.info(f"Auto-deleted inactive user: {user_info}")
            
            return {
                'success': True,
                'message': f'Successfully deleted user {user_info["username"]}',
                'user_info': user_info
            }
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error auto-deleting user {user_id}: {str(e)}")
            return {
                'success': False,
                'message': f'Failed to delete user: {str(e)}'
            }
    
    @staticmethod
    def send_inactivity_warnings(threshold_days: int = STUDENT_INACTIVITY_THRESHOLD - WARNING_BEFORE_TERMINATION,
                                instructor_id: Optional[int] = None,
                                application_window_id: Optional[int] = None) -> int:
        """
        Send warning emails to students approaching inactivity termination

        Args:
            threshold_days: Days of inactivity before sending warning
            instructor_id: Restrict warnings to students in this instructor's courses
            application_window_id: Restrict warnings to students in this cohort

        Returns:
            Number of warnings sent
        """
        import time
        
        warning_students = InactivityService.get_inactive_students(
            threshold_days=threshold_days,
            instructor_id=instructor_id,
            application_window_id=application_window_id
        )
        
        warnings_sent = 0
        total_students = len(warning_students)
        
        for i, student_data in enumerate(warning_students):
            try:
                student = User.query.get(student_data['student_id'])
                InactivityService._send_inactivity_warning(student, student_data)
                warnings_sent += 1
                
                # Add 30-second delay between emails to avoid server overload
                # Skip delay for the last email
                if i < total_students - 1:
                    logger.info(f"Sent warning {warnings_sent}/{total_students}. Waiting 30 seconds before next email...")
                    time.sleep(30)
                    
            except Exception as e:
                logger.error(f"Failed to send warning to student {student_data['student_id']}: {str(e)}")
        
        logger.info(f"Sent {warnings_sent} inactivity warnings")
        return warnings_sent

    @staticmethod
    def send_deletion_warnings(min_days: int = USER_DELETION_THRESHOLD,
                              max_days: int = 28) -> int:
        """
        Send advance warnings to users approaching account deactivation.
        Users with `min_days` <= days_inactive <= `max_days` are notified once
        (the window is one week wide) so they can log in before the deletion
        threshold in the weekly cleanup job is reached.

        Returns:
            Number of warnings sent
        """
        inactive_users = InactivityService.get_inactive_users(threshold_days=min_days)
        warnings_sent = 0

        for user_data in inactive_users:
            days_inactive = user_data.get('days_inactive')
            if days_inactive is None or days_inactive >= max_days:
                continue

            try:
                user = User.query.get(user_data['user_id'])
                if not user:
                    continue
                days_remaining = max(30 - days_inactive, 1)
                InactivityService._send_deletion_warning(user, days_inactive, days_remaining)
                warnings_sent += 1
                logger.info(
                    f"Sent account deactivation warning to {user.email} "
                    f"(inactive {days_inactive} days)"
                )
            except Exception as e:
                logger.error(
                    f"Failed to send deactivation warning to user "
                    f"{user_data['user_id']}: {str(e)}"
                )

        return warnings_sent

    @staticmethod
    def _send_deletion_warning(user: User, days_inactive: int, days_remaining: int):
        """Send an advance notice that the account will be deactivated unless active."""
        from ..utils.email_templates import get_email_header, get_email_footer
        unsub_token = user.get_or_create_unsubscribe_token()
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
            unsub_token = None

        subject = "⚠️ Account Deactivation Warning - Log In to Keep Your Account"

        html_body = f"""
        {get_email_header()}

            <!-- Main Content -->
            <div class="email-content" style="padding: 50px 35px;">
                <div style="text-align: center; margin-bottom: 35px;">
                    <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); width: 100px; height: 100px; border-radius: 50%; margin: 0 auto 25px; box-shadow: 0 10px 30px rgba(245, 158, 11, 0.4);">
                        <table width="100" height="100" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td style="text-align: center; vertical-align: middle; font-size: 50px;">⚠️</td>
                            </tr>
                        </table>
                    </div>
                    <h2 style="color: #f59e0b; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                        Account Deactivation Warning
                    </h2>
                    <p style="color: #bdc3c7; margin: 10px 0 0 0; font-size: 16px;">
                        Action required to keep your account active
                    </p>
                </div>

                <div style="background: rgba(52, 73, 94, 0.3); border-radius: 15px; padding: 30px; margin: 30px 0; border-left: 5px solid #f59e0b;">
                    <h3 style="color: #ffffff; margin: 0 0 15px 0; font-size: 20px; font-weight: 600;">Dear {user.first_name or user.username},</h3>
                    <p style="color: #d1d5db; margin: 0; font-size: 16px; line-height: 1.6;">
                        Your account has been inactive for <strong style="color: #f59e0b;">{days_inactive} days</strong>.
                        If no activity is detected within the next <strong style="color: #f59e0b;">{days_remaining} days</strong>,
                        your account will be deactivated and you may lose access to your courses and progress.
                    </p>
                </div>

                <div style="background: rgba(16, 185, 129, 0.1); border-radius: 15px; padding: 25px; margin: 25px 0; border: 2px solid rgba(16, 185, 129, 0.3); text-align: center;">
                    <h3 style="color: #10b981; margin: 0 0 20px 0; font-size: 18px; font-weight: 600;">✅ How to Keep Your Account Active</h3>
                    <p style="color: #d1d5db; margin: 0; font-size: 16px; line-height: 1.6;">
                        Simply <strong style="color: #10b981;">log in</strong> to the platform and continue your learning journey.
                    </p>
                </div>
            </div>

        {get_email_footer(unsubscribe_token=unsub_token, email_category='system')}
        """

        brevo_service.send_email(
            to_emails=[user.email],
            subject=subject,
            html_content=html_body
        )

    @staticmethod
    def _get_last_study_activity(student_id: int) -> Optional[datetime]:
        """
        Determine the most recent study/interaction timestamp for a student.

        Covers in-progress reading, video watching, quiz attempts, assignment
        submissions, notes and bookmarks - not just fully-completed lessons.
        """
        from sqlalchemy import func as sqlfunc

        # Lesson completion record: any touch (completed, opened, saved,
        # video watched, assignment submitted) counts as study activity.
        last_completed = db.session.query(sqlfunc.max(LessonCompletion.completed_at)).filter_by(
            student_id=student_id
        ).scalar()
        last_accessed = db.session.query(sqlfunc.max(LessonCompletion.last_accessed)).filter_by(
            student_id=student_id
        ).scalar()
        last_updated = db.session.query(sqlfunc.max(LessonCompletion.updated_at)).filter_by(
            student_id=student_id
        ).scalar()
        last_video = db.session.query(sqlfunc.max(LessonCompletion.video_last_watched)).filter_by(
            student_id=student_id
        ).scalar()
        last_assignment = db.session.query(sqlfunc.max(LessonCompletion.assignment_submitted_at)).filter_by(
            student_id=student_id
        ).scalar()

        # Quiz submissions
        last_quiz = db.session.query(sqlfunc.max(Submission.submitted_at)).filter_by(
            student_id=student_id
        ).scalar()

        # Course progress access
        last_course_access = db.session.query(sqlfunc.max(UserProgress.last_accessed)).filter_by(
            user_id=student_id
        ).scalar()

        # Notes / bookmarks
        last_note = db.session.query(sqlfunc.max(StudentNote.updated_at)).filter_by(
            student_id=student_id
        ).scalar()
        last_note_created = db.session.query(sqlfunc.max(StudentNote.created_at)).filter_by(
            student_id=student_id
        ).scalar()
        last_bookmark = db.session.query(sqlfunc.max(StudentBookmark.created_at)).filter_by(
            student_id=student_id
        ).scalar()

        candidates = [
            last_completed, last_accessed, last_updated, last_video,
            last_assignment, last_quiz, last_course_access,
            last_note, last_note_created, last_bookmark,
        ]

        # Day-level streak activity (midnight of last active day)
        streak = LearningStreak.query.filter_by(user_id=student_id).first()
        if streak and streak.last_activity_date:
            candidates.append(datetime.combine(streak.last_activity_date, datetime.min.time()))

        datetimes = [c for c in candidates if c is not None]
        return max(datetimes) if datetimes else None
    
    @staticmethod
    def _send_termination_notification(student: User, terminated_courses: List[Dict], reason: str):
        """Send email notification to terminated student"""
        from ..utils.email_templates import get_email_header, get_email_footer
        unsub_token = student.get_or_create_unsubscribe_token()
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
            unsub_token = None
        
        course_list_html = "".join([
            f'<tr><td style="padding: 12px 20px; border-bottom: 1px solid rgba(239, 68, 68, 0.2); color: #ffffff; background: rgba(239, 68, 68, 0.1); border-radius: 5px; margin: 5px 0;">📚 {course["course_title"]}</td></tr>'
            for course in terminated_courses
        ])
        
        subject = "❌ Course Enrollment Terminated - Action Required"
        
        html_body = f"""
        {get_email_header()}
            
            <!-- Main Content -->
            <div class="email-content" style="padding: 50px 35px;">
                <!-- Termination Icon & Title -->
                <div style="text-align: center; margin-bottom: 35px;">
                    <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); width: 100px; height: 100px; border-radius: 50%; margin: 0 auto 25px; box-shadow: 0 10px 30px rgba(239, 68, 68, 0.4);">
                        <table width="100" height="100" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td style="text-align: center; vertical-align: middle; font-size: 50px;">❌</td>
                            </tr>
                        </table>
                    </div>
                    <h2 style="color: #ef4444; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                        Enrollment Terminated
                    </h2>
                    <p style="color: #bdc3c7; margin: 10px 0 0 0; font-size: 16px;">
                        We regret to inform you of this decision
                    </p>
                </div>
                
                <!-- Personal Message -->
                <div style="background: rgba(239, 68, 68, 0.1); border-radius: 15px; padding: 30px; margin: 30px 0; border-left: 5px solid #ef4444;">
                    <h3 style="color: #ffffff; margin: 0 0 15px 0; font-size: 20px; font-weight: 600;">Dear {student.first_name or student.username},</h3>
                    <p style="color: #d1d5db; margin: 0; font-size: 16px; line-height: 1.6;">
                        We regret to inform you that your enrollment in the following courses has been terminated due to <strong style="color: #ef4444;">{reason.lower()}</strong>.
                    </p>
                </div>
                
                <!-- Terminated Courses List -->
                <div style="background: rgba(52, 73, 94, 0.5); border-radius: 15px; padding: 25px; margin: 25px 0; border: 2px solid rgba(239, 68, 68, 0.3);">
                    <h3 style="color: #ef4444; margin: 0 0 20px 0; font-size: 18px; font-weight: 600; text-align: center;">📚 Terminated Courses</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        {course_list_html}
                    </table>
                </div>
                
                <!-- Next Steps -->
                <div style="background: rgba(16, 185, 129, 0.1); border-radius: 15px; padding: 25px; margin: 25px 0; border: 2px solid rgba(16, 185, 129, 0.3);">
                    <h3 style="color: #10b981; margin: 0 0 20px 0; font-size: 18px; font-weight: 600; text-align: center;">💡 What's Next?</h3>
                    <div style="display: grid; gap: 15px;">
                        <div style="background: rgba(16, 185, 129, 0.1); padding: 15px; border-radius: 10px; border-left: 4px solid #10b981;">
                            <strong style="color: #10b981; font-size: 14px;">📧 Contact Support</strong>
                            <p style="color: #d1d5db; margin: 5px 0 0 0; font-size: 13px;">If you believe this was done in error</p>
                        </div>
                        <div style="background: rgba(16, 185, 129, 0.1); padding: 15px; border-radius: 10px; border-left: 4px solid #10b981;">
                            <strong style="color: #10b981; font-size: 14px;">👨‍🏫 Contact Your Instructor</strong>
                            <p style="color: #d1d5db; margin: 5px 0 0 0; font-size: 13px;">Discuss re-enrollment possibilities</p>
                        </div>
                        <div style="background: rgba(16, 185, 129, 0.1); padding: 15px; border-radius: 10px; border-left: 4px solid #10b981;">
                            <strong style="color: #10b981; font-size: 14px;">🔄 Explore New Courses</strong>
                            <p style="color: #d1d5db; margin: 5px 0 0 0; font-size: 13px;">Continue your learning journey</p>
                        </div>
                        <div style="background: rgba(16, 185, 129, 0.1); padding: 15px; border-radius: 10px; border-left: 4px solid #10b981;">
                            <strong style="color: #10b981; font-size: 14px;">📋 Stay Active</strong>
                            <p style="color: #d1d5db; margin: 5px 0 0 0; font-size: 13px;">Prevent future terminations</p>
                        </div>
                    </div>
                </div>
                
                <!-- Encouragement Message -->
                <div style="text-align: center; margin: 35px 0 0 0; padding: 25px; background: linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%); border-radius: 15px;">
                    <h3 style="color: #60a5fa; margin: 0 0 15px 0; font-size: 20px; font-weight: 600;">🎓 Don't Give Up!</h3>
                    <p style="color: #d1d5db; margin: 0; font-size: 16px; line-height: 1.6;">
                        This is just a temporary setback. We encourage you to stay active in your learning journey. 
                        You can always enroll in new courses and continue your education with us.
                    </p>
                </div>
            </div>
            
        {get_email_footer(unsubscribe_token=unsub_token, email_category='system')}
        """
        
        brevo_service.send_email(
            to_emails=[student.email],
            subject=subject,
            html_content=html_body
        )
    
    @staticmethod
    def _send_deletion_notification(user: User):
        """Send email notification before user deletion"""
        from ..utils.email_templates import get_email_header, get_email_footer
        unsub_token = user.get_or_create_unsubscribe_token()
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
            unsub_token = None
        
        subject = "🚨 Account Deactivated - Prolonged Inactivity"
        
        html_body = f"""
        {get_email_header()}
            
            <!-- Main Content -->
            <div class="email-content" style="padding: 50px 35px;">
                <!-- Deletion Warning Icon & Title -->
                <div style="text-align: center; margin-bottom: 35px;">
                    <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); width: 100px; height: 100px; border-radius: 50%; margin: 0 auto 25px; box-shadow: 0 10px 30px rgba(220, 38, 38, 0.5);">
                        <table width="100" height="100" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td style="text-align: center; vertical-align: middle; font-size: 50px;">🚨</td>
                            </tr>
                        </table>
                    </div>
                    <h2 style="color: #dc2626; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                        Account Deactivated
                    </h2>
                    <p style="color: #bdc3c7; margin: 10px 0 0 0; font-size: 16px;">
                        Your account has been deactivated due to prolonged inactivity
                    </p>
                </div>
                
                <!-- Urgent Alert -->
                <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); border-radius: 15px; padding: 30px; margin: 30px 0; text-align: center; box-shadow: 0 10px 30px rgba(220, 38, 38, 0.4);">
                    <h3 style="color: #ffffff; margin: 0 0 15px 0; font-size: 24px; font-weight: 700;">🛑 ACCOUNT DEACTIVATED</h3>
                    <p style="color: #ffffff; margin: 0; font-size: 16px; line-height: 1.6;">
                        Contact our support team to recover your account and resume your learning journey.
                    </p>
                </div>
                
                <!-- Personal Message -->
                <div style="background: rgba(52, 73, 94, 0.3); border-radius: 15px; padding: 30px; margin: 30px 0; border-left: 5px solid #dc2626;">
                    <h3 style="color: #ffffff; margin: 0 0 15px 0; font-size: 20px; font-weight: 600;">Dear {user.first_name or user.username},</h3>
                    <p style="color: #d1d5db; margin: 0; font-size: 16px; line-height: 1.6;">
                        This is to notify you that your account on Afritec Bridge LMS has been deactivated due to prolonged inactivity.
                        Your profile and learning progress are preserved, and you can regain access by reaching out to our support team.
                    </p>
                </div>
                
                <!-- Account Details -->
                <div style="background: rgba(52, 73, 94, 0.5); border-radius: 15px; padding: 25px; margin: 25px 0; border: 2px solid rgba(220, 38, 38, 0.3);">
                    <h3 style="color: #f59e0b; margin: 0 0 20px 0; font-size: 18px; font-weight: 600; text-align: center;">📋 Account Details</h3>
                    <div style="display: grid; gap: 10px;">
                        <div style="background: rgba(220, 38, 38, 0.1); padding: 15px; border-radius: 10px; border-left: 4px solid #dc2626; display: flex; justify-content: space-between;">
                            <strong style="color: #f59e0b; font-size: 14px;">👤 Username:</strong>
                            <span style="color: #ffffff; font-size: 14px;">{user.username}</span>
                        </div>
                        <div style="background: rgba(220, 38, 38, 0.1); padding: 15px; border-radius: 10px; border-left: 4px solid #dc2626; display: flex; justify-content: space-between;">
                            <strong style="color: #f59e0b; font-size: 14px;">📧 Email:</strong>
                            <span style="color: #ffffff; font-size: 14px;">{user.email}</span>
                        </div>
                        <div style="background: rgba(220, 38, 38, 0.1); padding: 15px; border-radius: 10px; border-left: 4px solid #dc2626; display: flex; justify-content: space-between;">
                            <strong style="color: #f59e0b; font-size: 14px;">🔐 Role:</strong>
                            <span style="color: #ffffff; font-size: 14px;">{user.role.name.title()}</span>
                        </div>
                    </div>
                </div>
                
                <!-- Action Required -->
                <div style="background: rgba(16, 185, 129, 0.1); border-radius: 15px; padding: 25px; margin: 25px 0; border: 2px solid rgba(16, 185, 129, 0.3);">
                    <h3 style="color: #10b981; margin: 0 0 20px 0; font-size: 18px; font-weight: 600; text-align: center;">✅ How to Recover Your Account</h3>
                    <div style="background: rgba(16, 185, 129, 0.1); padding: 20px; border-radius: 10px; border-left: 4px solid #10b981; text-align: center;">
                        <strong style="color: #10b981; font-size: 16px;">📧 Contact Support</strong>
                        <p style="color: #d1d5db; margin: 10px 0 0 0; font-size: 14px;">Reach out to our support team to reactivate your account and continue learning</p>
                    </div>
                </div>
                
                <!-- Support Contact -->
                <div style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.2) 100%); border-radius: 15px; padding: 25px; margin: 25px 0; text-align: center;">
                    <h3 style="color: #60a5fa; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">❓ Need Help?</h3>
                    <p style="color: #d1d5db; margin: 0 0 15px 0; font-size: 14px; line-height: 1.6;">
                        If you have any questions or concerns about this deletion notice, please contact our support team immediately.
                    </p>
                    <div style="margin-top: 20px;">
                        <a href="mailto:support@afritecbridge.com" style="display: inline-block; background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%); color: #ffffff; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 5px 15px rgba(96, 165, 250, 0.3);">
                            📧 Contact Support
                        </a>
                    </div>
                </div>
            </div>
            
        {get_email_footer(unsubscribe_token=unsub_token, email_category='system')}
        """
        
        brevo_service.send_email(
            to_emails=[user.email],
            subject=subject,
            html_content=html_body
        )
    
    @staticmethod
    def _send_inactivity_warning(student: User, student_data: Dict):
        """Send inactivity warning to student"""
        from ..utils.email_templates import get_email_header, get_email_footer
        unsub_token = student.get_or_create_unsubscribe_token()
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
            unsub_token = None
        
        days_inactive = student_data.get('days_inactive', 0)
        # Ensure days_inactive is not None
        if days_inactive is None:
            days_inactive = 0
            
        days_until_termination = InactivityService.STUDENT_INACTIVITY_THRESHOLD - days_inactive
        
        course_list_html = "".join([
            f'<tr><td style="padding: 8px 15px; border-bottom: 1px solid rgba(255,255,255,0.1); color: #ffffff;">📚 {course["course_title"]}</td></tr>'
            for course in student_data['enrolled_courses']
        ])
        
        subject = "⚠️ Activity Reminder - Stay Enrolled in Your Courses"
        
        urgency_message = (
            f"Your enrollment is at risk and may be terminated by your instructor "
            f"in as little as <strong style='color: #ef4444;'>{max(days_until_termination, 0)} days</strong> "
            f"if no activity is detected."
        )
        
        html_body = f"""
        {get_email_header()}
            
            <!-- Main Content -->
            <div class="email-content" style="padding: 50px 35px;">
                <!-- Warning Icon & Title -->
                <div style="text-align: center; margin-bottom: 35px;">
                    <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); width: 100px; height: 100px; border-radius: 50%; margin: 0 auto 25px; box-shadow: 0 10px 30px rgba(245, 158, 11, 0.3);">
                        <table width="100" height="100" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td style="text-align: center; vertical-align: middle; font-size: 50px;">⚠️</td>
                            </tr>
                        </table>
                    </div>
                    <h2 style="color: #f59e0b; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                        Activity Reminder
                    </h2>
                    <p style="color: #bdc3c7; margin: 10px 0 0 0; font-size: 16px;">
                        We miss your participation!
                    </p>
                </div>
                
                <!-- Personal Message -->
                <div style="background: rgba(52, 73, 94, 0.3); border-radius: 15px; padding: 30px; margin: 30px 0; border-left: 5px solid #f59e0b;">
                    <h3 style="color: #ffffff; margin: 0 0 15px 0; font-size: 20px; font-weight: 600;">Hi {student.first_name or student.username}! 👋</h3>
                    <p style="color: #d1d5db; margin: 0 0 15px 0; font-size: 16px; line-height: 1.6;">
                        We've noticed you haven't been active in your courses for <strong style="color: #f59e0b;">{days_inactive} days</strong>. 
                        Your learning journey is important to us, and we want to help you succeed!
                    </p>
                    <p style="color: #d1d5db; margin: 0; font-size: 16px; line-height: 1.6;">
                        To maintain your enrollment, please engage with your coursework soon.
                    </p>
                </div>
                
                <!-- Course List -->
                <div style="background: rgba(52, 73, 94, 0.5); border-radius: 15px; padding: 25px; margin: 25px 0;">
                    <h3 style="color: #60a5fa; margin: 0 0 20px 0; font-size: 18px; font-weight: 600; text-align: center;">📚 Your Active Courses</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        {course_list_html}
                    </table>
                </div>
                
                <!-- Urgency Alert -->
                <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border-radius: 15px; padding: 25px; margin: 30px 0; text-align: center; box-shadow: 0 10px 30px rgba(239, 68, 68, 0.3);">
                    <h3 style="color: #ffffff; margin: 0 0 10px 0; font-size: 20px; font-weight: 700;">⏰ Urgent Notice</h3>
                    <p style="color: #ffffff; margin: 0; font-size: 16px; line-height: 1.6;">
                        {urgency_message}
                    </p>
                </div>
                
                <!-- Action Steps -->
                <div style="background: rgba(16, 185, 129, 0.1); border-radius: 15px; padding: 25px; margin: 25px 0; border: 2px solid rgba(16, 185, 129, 0.3);">
                    <h3 style="color: #10b981; margin: 0 0 20px 0; font-size: 18px; font-weight: 600; text-align: center;">✅ How to Stay Enrolled</h3>
                    <div style="display: grid; gap: 15px;">
                        <div style="background: rgba(16, 185, 129, 0.1); padding: 15px; border-radius: 10px; border-left: 4px solid #10b981;">
                            <strong style="color: #10b981; font-size: 14px;">📖 Complete a lesson</strong>
                            <p style="color: #d1d5db; margin: 5px 0 0 0; font-size: 13px;">Continue your learning path</p>
                        </div>
                        <div style="background: rgba(16, 185, 129, 0.1); padding: 15px; border-radius: 10px; border-left: 4px solid #10b981;">
                            <strong style="color: #10b981; font-size: 14px;">📝 Take a quiz</strong>
                            <p style="color: #d1d5db; margin: 5px 0 0 0; font-size: 13px;">Test your knowledge</p>
                        </div>
                        <div style="background: rgba(16, 185, 129, 0.1); padding: 15px; border-radius: 10px; border-left: 4px solid #10b981;">
                            <strong style="color: #10b981; font-size: 14px;">💬 Participate in discussions</strong>
                            <p style="color: #d1d5db; margin: 5px 0 0 0; font-size: 13px;">Connect with fellow learners</p>
                        </div>
                        <div style="background: rgba(16, 185, 129, 0.1); padding: 15px; border-radius: 10px; border-left: 4px solid #10b981;">
                            <strong style="color: #10b981; font-size: 14px;">📤 Submit an assignment</strong>
                            <p style="color: #d1d5db; margin: 5px 0 0 0; font-size: 13px;">Show your progress</p>
                        </div>
                    </div>
                </div>
                
                <!-- Motivational Message -->
                <div style="text-align: center; margin: 35px 0 0 0; padding: 25px; background: linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%); border-radius: 15px;">
                    <h3 style="color: #60a5fa; margin: 0 0 15px 0; font-size: 20px; font-weight: 600;">🚀 Keep Learning, Keep Growing!</h3>
                    <p style="color: #d1d5db; margin: 0; font-size: 16px; line-height: 1.6;">
                        Your education is an investment in your future. Let's continue this amazing journey together!
                    </p>
                </div>
            </div>
            
        {get_email_footer(unsubscribe_token=unsub_token, email_category='system')}
        """
        
        brevo_service.send_email(
            to_emails=[student.email],
            subject=subject,
            html_content=html_body
        )