# Enrollment Service - Handle course enrollment workflows
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from flask import current_app
import json

from ..models.user_models import db, User
from ..models.course_models import Course, Enrollment
from ..models.student_models import (
    CourseEnrollmentApplication, ModuleProgress, StudentTranscript, Certificate
)


class EnrollmentService:
    """Service class for handling all course enrollment logic"""
    
    @staticmethod
    def browse_courses(student_id: int, filters: Dict = None) -> List[Dict]:
        """
        Get all available courses with enrollment indicators
        
        Args:
            student_id: ID of the student browsing
            filters: Optional filters for course search
            
        Returns:
            List of course dictionaries with enrollment information
        """
        query = Course.query.filter_by(is_published=True)
        
        # Apply filters if provided
        if filters:
            if filters.get('enrollment_type'):
                query = query.filter_by(enrollment_type=filters['enrollment_type'])
            if filters.get('difficulty_level'):
                query = query.filter_by(difficulty_level=filters['difficulty_level'])
            if filters.get('search_term'):
                search = f"%{filters['search_term']}%"
                query = query.filter(Course.title.ilike(search) | Course.description.ilike(search))
        
        courses = query.all()
        result = []
        
        for course in courses:
            course_data = course.to_dict()
            
            # Check if student is already enrolled or has applied
            existing_enrollment = Enrollment.query.filter_by(
                student_id=student_id, course_id=course.id
            ).first()
            
            existing_application = CourseEnrollmentApplication.query.filter_by(
                student_id=student_id, course_id=course.id
            ).first()
            
            # Add enrollment status
            if existing_enrollment:
                course_data['enrollment_status'] = 'enrolled'
                course_data['enrolled_at'] = existing_enrollment.enrollment_date.isoformat()
            elif existing_application:
                course_data['enrollment_status'] = existing_application.status
                course_data['application_id'] = existing_application.id
            else:
                course_data['enrollment_status'] = 'available'
            
            # Add scholarship availability
            if course.scholarship_available:
                course_data['scholarship_spots_remaining'] = (
                    course.max_scholarship_spots - course.current_scholarship_spots
                )
            
            result.append(course_data)
        
        return result
    
    @staticmethod
    def enroll_directly(student_id: int, course_id: int) -> Tuple[bool, str, Dict]:
        """
        Direct enrollment for free courses
        
        Args:
            student_id: ID of the student
            course_id: ID of the course to enroll in
            
        Returns:
            Tuple of (success, message, data)
        """
        try:
            user = User.query.get(student_id)
            course = Course.query.get(course_id)
            
            if not user:
                return False, "Student not found", {}
                
            if not course:
                return False, "Course not found", {}
                
            if not course.is_published:
                return False, "Course is not published", {}
                
            # Check if already enrolled
            existing_enrollment = Enrollment.query.filter_by(
                student_id=student_id, course_id=course_id
            ).first()
            
            if existing_enrollment:
                return False, "Already enrolled in this course", {
                    "enrollment_id": existing_enrollment.id
                }
                
            # Only allow direct enrollment for free courses
            if course.enrollment_type != 'free':
                return False, "Direct enrollment is only available for free courses", {}
                
            # Check prerequisites (if implemented)
            if not EnrollmentService._check_prerequisites(user, course):
                return False, "Prerequisites not met", {}
                
            # Create enrollment
            enrollment = EnrollmentService._create_enrollment(student_id, course_id)
            
            # Commit the transaction
            db.session.commit()
            
            return True, "Successfully enrolled in course", {
                "enrollment_id": enrollment.id,
                "course_title": course.title,
                "enrollment_date": enrollment.enrollment_date.isoformat()
            }
            
        except Exception as e:
            db.session.rollback()  # Roll back any partial changes
            current_app.logger.error(f"Direct enrollment error: {str(e)}")
            return False, "Failed to enroll in course", {}
    
    @staticmethod
    def apply_for_course(student_id: int, course_id: int, application_data: Dict) -> Tuple[bool, str, Dict]:
        """
        Apply for course enrollment (handles free, paid, and scholarship)
        
        Args:
            student_id: ID of the applying student
            course_id: ID of the course to apply for
            application_data: Application details including type and motivation
            
        Returns:
            Tuple of (success, message, application_data)
        """
        try:
            student = User.query.get(student_id)
            course = Course.query.get(course_id)
            
            if not student or not course:
                return False, "Student or course not found", {}
            
            # Check if already enrolled or applied
            existing_enrollment = Enrollment.query.filter_by(
                user_id=student_id, course_id=course_id
            ).first()
            
            if existing_enrollment:
                return False, "Already enrolled in this course", {}
            
            existing_application = CourseEnrollmentApplication.query.filter_by(
                student_id=student_id, course_id=course_id
            ).first()
            
            if existing_application:
                return False, "Application already exists", existing_application.to_dict()
            
            application_type = application_data.get('type', course.enrollment_type)
            
            # Validate application type
            if application_type == 'scholarship' and not course.scholarship_available:
                return False, "Scholarships not available for this course", {}
            
            if application_type == 'scholarship' and course.current_scholarship_spots >= course.max_scholarship_spots:
                return False, "No scholarship spots remaining", {}
            
            # Create application
            application = CourseEnrollmentApplication(
                student_id=student_id,
                course_id=course_id,
                application_type=application_type,
                motivation_letter=application_data.get('motivation_letter'),
                prerequisites_met=EnrollmentService._check_prerequisites(student, course)
            )
            
            # Handle different enrollment types
            if application_type == 'free':
                # Instant enrollment for free courses
                application.status = 'approved'
                enrollment = EnrollmentService._create_enrollment(student_id, course_id)
                application.enrolled_at = datetime.utcnow()
                message = "Successfully enrolled in free course"
                
            elif application_type == 'paid':
                # Set up for payment processing
                application.status = 'pending_payment'
                application.payment_status = 'pending'
                message = "Application created. Please proceed with payment"
                
            elif application_type == 'scholarship':
                # Scholarship requires review
                application.status = 'pending'
                message = "Scholarship application submitted for review"
                
            db.session.add(application)
            db.session.commit()
            
            return True, message, application.to_dict()
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Enrollment application error: {str(e)}")
            return False, "An error occurred during application", {}
    
    @staticmethod
    def process_payment(application_id: int, payment_data: Dict) -> Tuple[bool, str, Dict]:
        """
        Process payment for paid course enrollment
        
        Args:
            application_id: ID of the enrollment application
            payment_data: Payment processing data
            
        Returns:
            Tuple of (success, message, enrollment_data)
        """
        try:
            application = CourseEnrollmentApplication.query.get(application_id)
            
            if not application:
                return False, "Application not found", {}
            
            if application.status != 'pending_payment':
                return False, "Application not in payment pending status", {}
            
            # Mock payment processing (integrate with actual payment gateway)
            payment_success = EnrollmentService._process_payment_gateway(payment_data)
            
            if payment_success:
                application.payment_status = 'completed'
                application.payment_reference = payment_data.get('reference')
                application.status = 'approved'
                
                # Create enrollment
                enrollment = EnrollmentService._create_enrollment(
                    application.student_id, application.course_id
                )
                application.enrolled_at = datetime.utcnow()
                
                db.session.commit()
                return True, "Payment successful. Enrolled in course", enrollment.to_dict()
            else:
                application.payment_status = 'failed'
                db.session.commit()
                return False, "Payment processing failed", {}
                
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Payment processing error: {str(e)}")
            return False, "Payment processing error", {}
    
    @staticmethod
    def review_scholarship_application(application_id: int, reviewer_id: int, decision: str, notes: str = "") -> Tuple[bool, str]:
        """
        Review scholarship application (admin/instructor function)
        
        Args:
            application_id: ID of the application to review
            reviewer_id: ID of the reviewing user
            decision: 'approve' or 'reject'
            notes: Review notes
            
        Returns:
            Tuple of (success, message)
        """
        try:
            application = CourseEnrollmentApplication.query.get(application_id)
            
            if not application:
                return False, "Application not found"
            
            if application.application_type != 'scholarship':
                return False, "Not a scholarship application"
            
            if application.status != 'pending':
                return False, "Application already reviewed"
            
            application.reviewed_by = reviewer_id
            application.review_notes = notes
            application.reviewed_at = datetime.utcnow()
            
            if decision == 'approve':
                # Check scholarship spots
                course = application.course
                if course.current_scholarship_spots >= course.max_scholarship_spots:
                    return False, "No scholarship spots remaining"
                
                application.status = 'approved'
                course.current_scholarship_spots += 1
                
                # Create enrollment
                enrollment = EnrollmentService._create_enrollment(
                    application.student_id, application.course_id
                )
                application.enrolled_at = datetime.utcnow()
                
                message = "Scholarship application approved and student enrolled"
            else:
                application.status = 'rejected'
                message = "Scholarship application rejected"
            
            db.session.commit()
            return True, message
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Scholarship review error: {str(e)}")
            return False, "Error reviewing application"
    
    @staticmethod
    def _create_enrollment(student_id: int, course_id: int) -> Enrollment:
        """Create enrollment and initialize student progress tracking"""
        enrollment = Enrollment(
            student_id=student_id,
            course_id=course_id,
            enrollment_date=datetime.utcnow()
        )
        db.session.add(enrollment)
        db.session.flush()  # Get the enrollment ID
        
        # Initialize module progress for all course modules
        course = Course.query.get(course_id)
        modules = course.modules.order_by('order').all()
        
        for i, module in enumerate(modules):
            progress = ModuleProgress(
                student_id=student_id,
                module_id=module.id,
                enrollment_id=enrollment.id,
                status='locked' if i > 0 else 'unlocked',  # First module unlocked
                unlocked_at=datetime.utcnow() if i == 0 else None,
                prerequisites_met=i == 0
            )
            db.session.add(progress)
        
        # Create preliminary (locked) certificate for the enrollment
        preliminary_cert = Certificate(
            student_id=student_id,
            course_id=course_id,
            enrollment_id=enrollment.id,
            overall_score=0,
            grade="",  # Empty grade until course is completed
            is_active=True
        )
        preliminary_cert.generate_certificate_number()
        preliminary_cert.skills_acquired = json.dumps([])
        preliminary_cert.portfolio_items = json.dumps([])
        db.session.add(preliminary_cert)
        
        # Initialize or update student transcript
        transcript = StudentTranscript.query.filter_by(student_id=student_id).first()
        if not transcript:
            transcript = StudentTranscript(student_id=student_id)
            db.session.add(transcript)
        
        transcript.total_courses_enrolled += 1
        
        return enrollment
    
    @staticmethod
    def _check_prerequisites(student: User, course: Course) -> bool:
        """Check if student meets course prerequisites"""
        if not course.prerequisites:
            return True
        
        import json
        prerequisites = json.loads(course.prerequisites)
        
        # Check if student has completed required courses
        for prereq in prerequisites:
            if prereq.get('type') == 'course':
                prereq_course_id = prereq.get('course_id')
                enrollment = Enrollment.query.filter_by(
                    user_id=student.id, course_id=prereq_course_id
                ).first()
                
                if not enrollment or not enrollment.completed:
                    return False
        
        return True
    
    @staticmethod
    def _process_payment_gateway(payment_data: Dict) -> bool:
        """Mock payment gateway integration"""
        # This would integrate with actual payment processors like Stripe, PayPal, etc.
        # For now, return True for demo purposes
        return payment_data.get('test_success', True)
    
    @staticmethod
    def get_student_enrollments(student_id: int) -> List[Dict]:
        """Get all enrollments for a student"""
        enrollments = Enrollment.query.filter_by(student_id=student_id).all()
        
        result = []
        for enrollment in enrollments:
            enrollment_data = enrollment.to_dict()
            enrollment_data['course'] = enrollment.course.to_dict()
            
            # Add progress information
            progress = enrollment.module_progress.first()
            if progress:
                enrollment_data['current_module'] = progress.module.title
                enrollment_data['overall_progress'] = enrollment.progress_percentage
            
            result.append(enrollment_data)
        
        return result