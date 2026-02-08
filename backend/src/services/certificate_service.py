# Certificate Service - Handle certificates, badges, and transcripts
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from flask import current_app
import json
import hashlib
import random

from ..models.user_models import db, User
from ..models.course_models import Course, Enrollment
from ..models.student_models import (
    Certificate, SkillBadge, StudentSkillBadge, StudentTranscript,
    ModuleProgress, AssessmentAttempt
)


class CertificateService:
    """Service class for handling certificates, badges, and transcripts"""
    
    @staticmethod
    def check_certificate_eligibility(student_id: int, course_id: int) -> Tuple[bool, str, Dict]:
        """
        Check if student is eligible for course completion certificate
        
        Args:
            student_id: ID of the student
            course_id: ID of the course
            
        Returns:
            Tuple of (eligible, reason, requirements_status)
        """
        try:
            enrollment = Enrollment.query.filter_by(
                student_id=student_id, course_id=course_id
            ).first()
            
            if not enrollment:
                return False, "Not enrolled in course", {}
            
            course = Course.query.get(course_id)
            if not course:
                return False, "Course not found", {}
            
            # PRIMARY CHECK: Use enrollment completion status as source of truth
            if enrollment.completed_at or enrollment.status == 'completed':
                # Course is marked as complete - eligible for certificate
                overall_score = enrollment.calculate_course_score()
                requirements_status = {
                    "completed": True,
                    "overall_score": overall_score,
                    "completion_date": enrollment.completed_at.isoformat() if enrollment.completed_at else None,
                    "enrollment_status": enrollment.status
                }
                return True, "Eligible for certificate", requirements_status
            
            # SECONDARY CHECK: Check module completion status in detail
            modules = course.modules.order_by('order').all()
            requirements_status = {
                "total_modules": len(modules),
                "completed_modules": 0,
                "failed_modules": 0,
                "module_details": []
            }
            
            overall_scores = []
            
            for module in modules:
                module_progress = ModuleProgress.query.filter_by(
                    student_id=student_id,
                    module_id=module.id,
                    enrollment_id=enrollment.id
                ).first()
                
                if not module_progress:
                    requirements_status["module_details"].append({
                        "module": module.title,
                        "status": "not_started",
                        "score": 0
                    })
                    continue
                
                module_detail = {
                    "module": module.title,
                    "status": module_progress.status,
                    "score": module_progress.cumulative_score or 0,
                    "attempts": module_progress.attempts_count
                }
                
                if module_progress.status == 'completed':
                    requirements_status["completed_modules"] += 1
                    overall_scores.append(module_progress.cumulative_score or 0)
                elif module_progress.status == 'failed':
                    requirements_status["failed_modules"] += 1
                
                requirements_status["module_details"].append(module_detail)
            
            # Check portfolio requirements (optional, not required)
            portfolio_items = CertificateService._get_portfolio_items(student_id, course_id)
            requirements_status["portfolio_items"] = len(portfolio_items)
            requirements_status["portfolio_required"] = False  # Made optional
            
            # Calculate overall score
            if overall_scores:
                overall_score = sum(overall_scores) / len(overall_scores)
                requirements_status["overall_score"] = overall_score
            else:
                overall_score = 0
                requirements_status["overall_score"] = 0
            
            # Use default passing score of 80% if course doesn't have one
            passing_score = getattr(course, 'passing_score', 80)
            requirements_status["passing_score"] = passing_score
            
            # Check eligibility based on module completion
            eligible = (
                requirements_status["completed_modules"] == requirements_status["total_modules"] and
                requirements_status["failed_modules"] == 0 and
                overall_score >= passing_score
                # Portfolio items no longer required
            )
            
            if eligible:
                return True, "Eligible for certificate", requirements_status
            else:
                reason = CertificateService._get_ineligibility_reason(requirements_status, passing_score)
                return False, reason, requirements_status
                
        except Exception as e:
            current_app.logger.error(f"Certificate eligibility check error: {str(e)}")
            return False, "Error checking eligibility", {}
    
    @staticmethod
    def create_preliminary_certificate(student_id: int, course_id: int) -> Tuple[bool, str, Dict]:
        """
        Create a preliminary (locked) certificate for newly enrolled students.
        This certificate will be blurred until the course is completed.
        
        Args:
            student_id: ID of the student
            course_id: ID of the course
            
        Returns:
            Tuple of (success, message, certificate_data)
        """
        try:
            # Check if enrollment exists
            enrollment = Enrollment.query.filter_by(
                user_id=student_id, course_id=course_id
            ).first()
            
            if not enrollment:
                return False, "Student not enrolled in this course", {}
            
            course = Course.query.get(course_id)
            if not course:
                return False, "Course not found", {}
            
            # Check if certificate already exists
            existing_cert = Certificate.query.filter_by(
                student_id=student_id,
                course_id=course_id,
                enrollment_id=enrollment.id
            ).first()
            
            if existing_cert:
                return True, "Certificate already exists", existing_cert.to_dict()
            
            # Create preliminary certificate with 0% completion
            certificate = Certificate(
                student_id=student_id,
                course_id=course_id,
                enrollment_id=enrollment.id,
                overall_score=0,
                is_active=True
            )
            
            # Generate certificate number and verification hash
            certificate.generate_certificate_number()
            
            # Set initial skills and portfolio (empty)
            certificate.skills_acquired = json.dumps([])
            certificate.portfolio_items = json.dumps([])
            
            db.session.add(certificate)
            db.session.commit()
            
            cert_data = certificate.to_dict()
            # Add completion metadata for frontend
            cert_data["completion_status"] = "not_started"
            cert_data["completion_percentage"] = 0
            cert_data["is_locked"] = True
            
            return True, "Preliminary certificate created", cert_data
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Preliminary certificate creation error: {str(e)}")
            return False, "Failed to create preliminary certificate", {}
    
    @staticmethod
    def generate_certificate(student_id: int, course_id: int) -> Tuple[bool, str, Dict]:
        """
        Generate course completion certificate
        
        Args:
            student_id: ID of the student
            course_id: ID of the course
            
        Returns:
            Tuple of (success, message, certificate_data)
        """
        try:
            # Get enrollment
            enrollment = Enrollment.query.filter_by(
                student_id=student_id, course_id=course_id
            ).first()
            
            if not enrollment:
                return False, "Enrollment not found", {}
            
            # FIX: Auto-mark enrollment as completed if progress is 100% but not marked
            if enrollment.progress >= 1.0 and not enrollment.completed_at:
                enrollment.completed_at = datetime.utcnow()
                enrollment.status = 'completed'
                db.session.flush()  # Flush to database before eligibility check
            
            # Check eligibility first
            eligible, reason, requirements = CertificateService.check_certificate_eligibility(
                student_id, course_id
            )
            
            if not eligible:
                return False, f"Not eligible for certificate: {reason}", {}
            
            # Check if certificate already exists (update existing instead of create new)
            existing_cert = Certificate.query.filter_by(
                student_id=student_id,
                course_id=course_id,
                enrollment_id=enrollment.id
            ).first()
            
            # Calculate overall score
            overall_score = requirements.get("overall_score", enrollment.calculate_course_score())
            
            # Add skills and portfolio items
            skills_acquired = CertificateService._extract_course_skills(course_id)
            portfolio_items = CertificateService._get_portfolio_items(student_id, course_id)
            
            if existing_cert:
                # Update existing certificate with final scores
                existing_cert.overall_score = overall_score
                existing_cert.skills_acquired = json.dumps(skills_acquired)
                existing_cert.portfolio_items = json.dumps(portfolio_items)
                existing_cert.issued_at = datetime.utcnow()  # Update issue date
                
                message = "Certificate updated successfully"
                certificate = existing_cert
            else:
                # Create new certificate
                certificate = Certificate(
                    student_id=student_id,
                    course_id=course_id,
                    enrollment_id=enrollment.id,
                    overall_score=overall_score
                )
                
                # Generate certificate number and verification hash
                certificate.generate_certificate_number()
                
                certificate.skills_acquired = json.dumps(skills_acquired)
                certificate.portfolio_items = json.dumps(portfolio_items)
                
                db.session.add(certificate)
                message = "Certificate generated successfully"
            
            # Mark enrollment as completed (use correct field names)
            if not enrollment.completed_at:
                enrollment.completed_at = datetime.utcnow()
            if enrollment.status != 'completed':
                enrollment.status = 'completed'
            enrollment.progress = 1.0  # 100% completion
            
            db.session.commit()
            
            # Update student transcript
            CertificateService._update_student_transcript(student_id)
            
            # Award completion badges
            CertificateService._award_completion_badges(student_id, course_id)
            
            return True, message, certificate.to_dict()
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Certificate generation error: {str(e)}")
            return False, "Failed to generate certificate", {}
    
    @staticmethod
    def verify_certificate(certificate_number: str, verification_hash: str = None) -> Tuple[bool, str, Dict]:
        """
        Verify the authenticity of a certificate
        
        Args:
            certificate_number: Certificate number to verify
            verification_hash: Optional verification hash
            
        Returns:
            Tuple of (valid, message, certificate_data)
        """
        try:
            certificate = Certificate.query.filter_by(
                certificate_number=certificate_number
            ).first()
            
            if not certificate:
                return False, "Certificate not found", {}
            
            if not certificate.is_active:
                return False, "Certificate has been revoked", {}
            
            if certificate.expires_at and certificate.expires_at < datetime.utcnow():
                return False, "Certificate has expired", {}
            
            # Verify hash if provided
            if verification_hash and certificate.verification_hash != verification_hash:
                return False, "Invalid verification hash", {}
            
            # Return certificate data for verification
            cert_data = certificate.to_dict()
            cert_data["verification_status"] = "valid"
            cert_data["verified_at"] = datetime.utcnow().isoformat()
            
            return True, "Certificate is valid", cert_data
            
        except Exception as e:
            current_app.logger.error(f"Certificate verification error: {str(e)}")
            return False, "Error verifying certificate", {}
    
    @staticmethod
    def award_skill_badge(student_id: int, badge_id: int, context: Dict = None) -> Tuple[bool, str, Dict]:
        """
        Award a skill badge to a student
        
        Args:
            student_id: ID of the student
            badge_id: ID of the badge to award
            context: Optional context (course_id, module_id, evidence)
            
        Returns:
            Tuple of (success, message, badge_data)
        """
        try:
            badge = SkillBadge.query.get(badge_id)
            if not badge or not badge.is_active:
                return False, "Badge not found or inactive", {}
            
            student = User.query.get(student_id)
            if not student:
                return False, "Student not found", {}
            
            # Check if already awarded in this context
            course_id = context.get('course_id') if context else None
            module_id = context.get('module_id') if context else None
            
            existing_award = StudentSkillBadge.query.filter_by(
                student_id=student_id,
                badge_id=badge_id,
                course_id=course_id,
                module_id=module_id
            ).first()
            
            if existing_award:
                return True, "Badge already awarded", existing_award.to_dict()
            
            # Create badge award
            student_badge = StudentSkillBadge(
                student_id=student_id,
                badge_id=badge_id,
                course_id=course_id,
                module_id=module_id,
                evidence_data=json.dumps(context.get('evidence', {})) if context else None
            )
            
            db.session.add(student_badge)
            db.session.commit()
            
            # Update student transcript
            CertificateService._update_student_transcript(student_id)
            
            return True, f"Badge '{badge.name}' awarded successfully", student_badge.to_dict()
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Badge award error: {str(e)}")
            return False, "Failed to award badge", {}
    
    @staticmethod
    def get_student_certificates(student_id: int, include_completion: bool = True) -> List[Dict]:
        """
        Get all certificates for a student with completion status
        
        Args:
            student_id: ID of the student
            include_completion: Whether to include completion percentage data
            
        Returns:
            List of certificate dicts with completion data
        """
        certificates = Certificate.query.filter_by(
            student_id=student_id, is_active=True
        ).order_by(Certificate.issued_at.desc()).all()
        
        cert_list = []
        for cert in certificates:
            cert_dict = cert.to_dict()
            
            if include_completion:
                # Get enrollment for completion data
                enrollment = cert.enrollment
                if enrollment:
                    # FIX: Auto-mark enrollment as completed if progress is 100% but not marked
                    if enrollment.progress >= 1.0 and not enrollment.completed_at:
                        enrollment.completed_at = datetime.utcnow()
                        enrollment.status = 'completed'
                        db.session.commit()
                    
                    # Use enrollment.progress field (0.0-1.0) for completion percentage
                    # This is the authoritative source of truth for course progress
                    completion_percentage = int((enrollment.progress or 0.0) * 100)
                    
                    # Determine completion status based on enrollment state
                    if enrollment.completed_at or enrollment.status == 'completed':
                        completion_status = "completed"
                        is_locked = False
                        completion_percentage = 100  # Override to 100 if marked complete
                    elif completion_percentage > 0:
                        completion_status = "in_progress"
                        is_locked = True
                    else:
                        completion_status = "not_started"
                        is_locked = True
                    
                    # Add completion data to response
                    cert_dict["completion_status"] = completion_status
                    cert_dict["completion_percentage"] = completion_percentage
                    cert_dict["is_locked"] = is_locked
                    cert_dict["course_completed"] = completion_percentage == 100
                else:
                    # No enrollment found - certificate data might be orphaned
                    cert_dict["completion_status"] = "unknown"
                    cert_dict["completion_percentage"] = 0
                    cert_dict["is_locked"] = True
                    cert_dict["course_completed"] = False
            
            cert_list.append(cert_dict)
        
        return cert_list
    
    @staticmethod
    def get_student_badges(student_id: int) -> List[Dict]:
        """Get all badges earned by a student"""
        student_badges = StudentSkillBadge.query.filter_by(
            student_id=student_id
        ).order_by(StudentSkillBadge.earned_at.desc()).all()
        
        return [badge.to_dict() for badge in student_badges]
    
    @staticmethod
    def get_available_badges() -> List[Dict]:
        """Get all available skill badges"""
        badges = SkillBadge.query.filter_by(is_active=True).all()
        return [badge.to_dict() for badge in badges]
    
    @staticmethod
    def create_skill_badge(badge_data: Dict) -> Tuple[bool, str, Dict]:
        """
        Create a new skill badge (admin function)
        
        Args:
            badge_data: Badge information
            
        Returns:
            Tuple of (success, message, badge_data)
        """
        try:
            badge = SkillBadge(
                name=badge_data['name'],
                description=badge_data['description'],
                icon_url=badge_data.get('icon_url'),
                criteria=json.dumps(badge_data['criteria']),
                category=badge_data['category'],
                difficulty_level=badge_data['difficulty_level'],
                points_value=badge_data.get('points_value', 10)
            )
            
            db.session.add(badge)
            db.session.commit()
            
            return True, "Skill badge created successfully", badge.to_dict()
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Badge creation error: {str(e)}")
            return False, "Failed to create badge", {}
    
    @staticmethod
    def generate_transcript(student_id: int) -> Dict:
        """
        Generate comprehensive student transcript
        
        Args:
            student_id: ID of the student
            
        Returns:
            Complete transcript data
        """
        try:
            transcript = StudentTranscript.query.filter_by(student_id=student_id).first()
            if not transcript:
                transcript = StudentTranscript(student_id=student_id)
                db.session.add(transcript)
                db.session.commit()
            
            # Update transcript statistics
            transcript.update_statistics()
            db.session.commit()
            
            student = User.query.get(student_id)
            
            # Get all enrollments and certificates
            enrollments = Enrollment.query.filter_by(student_id=student_id).all()
            certificates = Certificate.query.filter_by(student_id=student_id, is_active=True).all()
            badges = StudentSkillBadge.query.filter_by(student_id=student_id).all()
            
            transcript_data = {
                "student_info": {
                    "id": student.id,
                    "name": f"{student.first_name} {student.last_name}",
                    "email": student.email,
                    "join_date": student.created_at.isoformat()
                },
                "summary": transcript.to_dict(),
                "course_history": [],
                "certificates": [cert.to_dict() for cert in certificates],
                "badges": [badge.to_dict() for badge in badges],
                "generated_at": datetime.utcnow().isoformat()
            }
            
            # Add detailed course history
            for enrollment in enrollments:
                course_data = {
                    "course": enrollment.course.to_dict(),
                    "enrollment": enrollment.to_dict(),
                    "modules": []
                }
                
                # Get module progress
                module_progresses = ModuleProgress.query.filter_by(
                    student_id=student_id, enrollment_id=enrollment.id
                ).all()
                
                for mp in module_progresses:
                    module_data = mp.to_dict()
                    module_data["module_info"] = mp.module.to_dict()
                    course_data["modules"].append(module_data)
                
                transcript_data["course_history"].append(course_data)
            
            return transcript_data
            
        except Exception as e:
            current_app.logger.error(f"Transcript generation error: {str(e)}")
            return {"error": "Failed to generate transcript"}
    
    @staticmethod
    def _get_portfolio_items(student_id: int, course_id: int) -> List[Dict]:
        """Get portfolio items (projects, assignments) for a course"""
        # Get completed projects and assignments
        portfolio_attempts = AssessmentAttempt.query.join(Module).filter(
            Module.course_id == course_id,
            AssessmentAttempt.student_id == student_id,
            AssessmentAttempt.assessment_type.in_(['assignment', 'project']),
            AssessmentAttempt.status == 'graded',
            AssessmentAttempt.percentage >= 70  # Only include good work
        ).all()
        
        portfolio_items = []
        for attempt in portfolio_attempts:
            portfolio_items.append({
                "type": attempt.assessment_type,
                "title": f"{attempt.module.title} - {attempt.assessment_type.title()}",
                "score": attempt.percentage,
                "submitted_at": attempt.submitted_at.isoformat() if attempt.submitted_at else None,
                "module": attempt.module.title
            })
        
        return portfolio_items
    
    @staticmethod
    def _extract_course_skills(course_id: int) -> List[str]:
        """Extract skills acquired from course modules"""
        course = Course.query.get(course_id)
        skills = []
        
        if course.learning_objectives:
            # Extract skills from course objectives
            objectives = course.learning_objectives.split('\n')
            skills.extend([obj.strip() for obj in objectives[:5]])  # Top 5
        
        # Add skills from modules
        modules = course.modules.all()
        for module in modules:
            if module.learning_objectives:
                module_objectives = module.learning_objectives.split('\n')
                skills.extend([obj.strip() for obj in module_objectives[:2]])  # Top 2 per module
        
        # Remove duplicates and return unique skills
        return list(set(skills))[:10]  # Limit to 10 skills
    
    @staticmethod
    def _get_ineligibility_reason(requirements: Dict, passing_score: float) -> str:
        """Get detailed reason for certificate ineligibility"""
        reasons = []
        
        if requirements["completed_modules"] < requirements["total_modules"]:
            remaining = requirements["total_modules"] - requirements["completed_modules"]
            reasons.append(f"{remaining} modules not completed")
        
        if requirements["failed_modules"] > 0:
            reasons.append(f"{requirements['failed_modules']} modules failed")
        
        if requirements["overall_score"] < passing_score:
            reasons.append(f"Overall score {requirements['overall_score']:.1f}% below required {passing_score}%")
        
        # Portfolio items are now optional, not required for certificate
        # if requirements.get("portfolio_items", 0) == 0:
        #     reasons.append("No portfolio items completed")
        
        return "; ".join(reasons) if reasons else "Unknown reason"
    
    @staticmethod
    def _update_student_transcript(student_id: int):
        """Update student transcript statistics"""
        transcript = StudentTranscript.query.filter_by(student_id=student_id).first()
        if transcript:
            transcript.update_statistics()
    
    @staticmethod
    def _award_completion_badges(student_id: int, course_id: int):
        """Award badges for course completion"""
        course = Course.query.get(course_id)
        
        # Award course completion badge
        completion_badge = SkillBadge.query.filter_by(
            name=f"{course.title} Completion"
        ).first()
        
        if completion_badge:
            CertificateService.award_skill_badge(
                student_id, completion_badge.id,
                {"course_id": course_id, "evidence": {"type": "course_completion"}}
            )
        
        # Award difficulty-based badges
        if course.difficulty_level == 'advanced':
            advanced_badge = SkillBadge.query.filter_by(
                name="Advanced Learner"
            ).first()
            
            if advanced_badge:
                CertificateService.award_skill_badge(
                    student_id, advanced_badge.id,
                    {"course_id": course_id, "evidence": {"type": "advanced_completion"}}
                )
    
    @staticmethod
    def generate_certificate_pdf(certificate: Certificate):
        """Generate PDF file for a certificate"""
        try:
            from reportlab.lib.pagesizes import A4, landscape
            from reportlab.lib import colors
            from reportlab.lib.units import mm
            from reportlab.pdfgen import canvas
            from reportlab.platypus import Image as RLImage
            from reportlab.lib.utils import ImageReader
            from io import BytesIO
            from datetime import datetime
            import traceback
            import logging
            import os
            import math
            import qrcode
            from PIL import Image as PILImage
            
            # Use module logger instead of current_app
            logger = logging.getLogger(__name__)
            
            # Create a BytesIO buffer
            buffer = BytesIO()
            
            # Create the PDF object with landscape A4
            pdf_canvas = canvas.Canvas(buffer, pagesize=landscape(A4))
            width, height = landscape(A4)
            
            # Get student name from relationship with fallback
            try:
                if certificate.student:
                    student_name = f"{certificate.student.first_name} {certificate.student.last_name}"
                else:
                    logger.warning(f"Certificate {certificate.id} has no student relationship")
                    student_name = "Student Name"
            except Exception as e:
                logger.error(f"Error getting student name: {str(e)}")
                student_name = "Student Name"
            
            # Get course title from relationship with fallback
            try:
                if certificate.course:
                    course_title = certificate.course.title
                else:
                    logger.warning(f"Certificate {certificate.id} has no course relationship")
                    course_title = "Course Title"
            except Exception as e:
                logger.error(f"Error getting course title: {str(e)}")
                course_title = "Course Title"
            
            logger.info(f"Generating PDF for {student_name} - {course_title}")
            
            # Define colors matching Afritech Bridge branding
            navy_blue = colors.HexColor('#0f172a')  # Dark navy background
            brand_blue = colors.HexColor('#1e3a8a')  # Brand blue
            teal = colors.HexColor('#14b8a6')  # Teal/cyan for tech elements
            light_teal = colors.HexColor('#5eead4')  # Light teal
            orange = colors.HexColor('#f97316')  # Orange accent
            light_orange = colors.HexColor('#fb923c')  # Light orange
            white = colors.white
            light_gray = colors.HexColor('#94a3b8')
            
            # Create navy blue background
            pdf_canvas.setFillColor(navy_blue)
            pdf_canvas.rect(0, 0, width, height, fill=1, stroke=0)
            
            # Add subtle gradient effect with overlays
            pdf_canvas.setFillColorRGB(0.12, 0.23, 0.54, alpha=0.3)
            pdf_canvas.circle(width * 0.15, height * 0.85, 60*mm, fill=1, stroke=0)
            pdf_canvas.setFillColorRGB(0.08, 0.72, 0.65, alpha=0.15)
            pdf_canvas.circle(width * 0.85, height * 0.2, 50*mm, fill=1, stroke=0)
            
            # Main border with brand colors - teal and orange
            pdf_canvas.setStrokeColor(teal)
            pdf_canvas.setLineWidth(3)
            pdf_canvas.roundRect(12*mm, 12*mm, width - 24*mm, height - 24*mm, 8*mm, fill=0, stroke=1)
            
            # Inner accent border - orange
            pdf_canvas.setStrokeColor(orange)
            pdf_canvas.setLineWidth(1.5)
            pdf_canvas.roundRect(15*mm, 15*mm, width - 30*mm, height - 30*mm, 6*mm, fill=0, stroke=1)
            
            # Add circuit-like design elements in corners
            def draw_circuit_node(x, y, size, color):
                """Draw a circuit node (dot with connecting lines)"""
                pdf_canvas.setFillColor(color)
                pdf_canvas.setStrokeColor(color)
                pdf_canvas.circle(x, y, size, fill=1, stroke=1)
            
            def draw_circuit_line(x1, y1, x2, y2, color):
                """Draw a circuit connection line"""
                pdf_canvas.setStrokeColor(color)
                pdf_canvas.setLineWidth(2)
                pdf_canvas.line(x1, y1, x2, y2)
            
            # Top left circuit pattern - adjusted to avoid overlap
            draw_circuit_node(30*mm, height - 25*mm, 1.5*mm, teal)
            draw_circuit_node(40*mm, height - 22*mm, 1.2*mm, light_teal)
            draw_circuit_node(50*mm, height - 26*mm, 1*mm, teal)
            draw_circuit_line(30*mm, height - 25*mm, 40*mm, height - 22*mm, teal)
            draw_circuit_line(40*mm, height - 22*mm, 50*mm, height - 26*mm, light_teal)
            
            # Top right circuit pattern with upward arrow motif
            arrow_base_x = width - 45*mm
            arrow_base_y = height - 30*mm
            draw_circuit_node(arrow_base_x, arrow_base_y, 1.5*mm, orange)
            draw_circuit_node(arrow_base_x + 8*mm, arrow_base_y + 5*mm, 1.2*mm, light_orange)
            draw_circuit_node(arrow_base_x - 8*mm, arrow_base_y + 5*mm, 1.2*mm, orange)
            draw_circuit_line(arrow_base_x, arrow_base_y, arrow_base_x + 8*mm, arrow_base_y + 5*mm, orange)
            draw_circuit_line(arrow_base_x, arrow_base_y, arrow_base_x - 8*mm, arrow_base_y + 5*mm, orange)
            
            # Draw upward arrow (brand element)
            pdf_canvas.setFillColor(orange)
            pdf_canvas.setStrokeColor(orange)
            pdf_canvas.setLineWidth(3)
            arrow_x = width - 40*mm
            arrow_y = height - 40*mm
            # Arrow shaft
            pdf_canvas.line(arrow_x, arrow_y - 10*mm, arrow_x + 8*mm, arrow_y, )
            # Arrow head
            pdf_canvas.setLineWidth(4)
            pdf_canvas.line(arrow_x + 8*mm, arrow_y, arrow_x + 5*mm, arrow_y - 3*mm)
            pdf_canvas.line(arrow_x + 8*mm, arrow_y, arrow_x + 11*mm, arrow_y - 3*mm)
            
            # Bottom left circuit pattern
            draw_circuit_node(30*mm, 35*mm, 1.2*mm, teal)
            draw_circuit_node(40*mm, 30*mm, 1*mm, light_teal)
            draw_circuit_node(50*mm, 38*mm, 1.3*mm, teal)
            draw_circuit_line(30*mm, 35*mm, 40*mm, 30*mm, teal)
            draw_circuit_line(40*mm, 30*mm, 50*mm, 38*mm, light_teal)
            
            # Bottom right circuit pattern
            draw_circuit_node(width - 35*mm, 32*mm, 1.2*mm, orange)
            draw_circuit_node(width - 45*mm, 28*mm, 1*mm, light_orange)
            draw_circuit_node(width - 50*mm, 35*mm, 1.3*mm, orange)
            draw_circuit_line(width - 35*mm, 32*mm, width - 45*mm, 28*mm, orange)
            draw_circuit_line(width - 45*mm, 28*mm, width - 50*mm, 35*mm, light_orange)
            
            # Add curved arc design elements (inspired by logo)
            pdf_canvas.setStrokeColor(teal)
            pdf_canvas.setLineWidth(2)
            pdf_canvas.arc(25*mm, height - 50*mm, 60*mm, height - 30*mm, 0, 90)
            pdf_canvas.setStrokeColor(orange)
            pdf_canvas.setLineWidth(1.5)
            pdf_canvas.arc(30*mm, height - 48*mm, 55*mm, height - 32*mm, 0, 85)
            
            # Enhanced company logo section with elegant frame
            logo_center_x = 37*mm
            logo_center_y = height - 32*mm
            logo_size = 11*mm  # Reduced to fit properly within inner frame with padding
            
            # Simplified circular tech frame with clean design
            frame_radius = 16*mm
            pdf_canvas.setStrokeColor(teal)
            pdf_canvas.setLineWidth(2.5)
            pdf_canvas.circle(logo_center_x, logo_center_y, frame_radius, fill=0, stroke=1)
            
            # Inner accent circle - orange
            inner_radius = 14*mm
            pdf_canvas.setStrokeColor(orange)
            pdf_canvas.setLineWidth(1.5)
            pdf_canvas.circle(logo_center_x, logo_center_y, inner_radius, fill=0, stroke=1)
            
            # Add decorative corner tech nodes (4 corners)
            import math
            for angle in [45, 135, 225, 315]:  # Diagonal corners
                angle_rad = math.radians(angle)
                x = logo_center_x + frame_radius * math.cos(angle_rad)
                y = logo_center_y + frame_radius * math.sin(angle_rad)
                color = teal if angle in [45, 225] else orange
                pdf_canvas.setFillColor(color)
                pdf_canvas.circle(x, y, 1.8*mm, fill=1, stroke=0)
                # Small connecting lines extending outward
                pdf_canvas.setStrokeColor(color)
                pdf_canvas.setLineWidth(2)
                x_outer = logo_center_x + (frame_radius + 4*mm) * math.cos(angle_rad)
                y_outer = logo_center_y + (frame_radius + 4*mm) * math.sin(angle_rad)
                pdf_canvas.line(x, y, x_outer, y_outer)
                pdf_canvas.circle(x_outer, y_outer, 1.2*mm, fill=1, stroke=0)
            
            # Add company logo in center with proper fitting
            logo_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'static', 'images', 'logo.jpg')
            if os.path.exists(logo_path):
                try:
                    # Save graphics state for clipping
                    pdf_canvas.saveState()
                    
                    # Create circular clipping path for logo
                    logo_clip_path = pdf_canvas.beginPath()
                    logo_clip_path.circle(logo_center_x, logo_center_y, logo_size/2)
                    pdf_canvas.clipPath(logo_clip_path, stroke=0, fill=0)
                    
                    # Center the logo within the circular clip with slight padding
                    # Making logo slightly larger than clip area to ensure full coverage
                    logo_draw_size = logo_size * 1.05
                    pdf_canvas.drawImage(logo_path, 
                                       logo_center_x - logo_draw_size/2, 
                                       logo_center_y - logo_draw_size/2, 
                                       width=logo_draw_size, 
                                       height=logo_draw_size, 
                                       preserveAspectRatio=True, 
                                       anchor='c',
                                       mask='auto')
                    
                    # Restore graphics state
                    pdf_canvas.restoreState()
                except Exception as e:
                    logger.warning(f"Could not add logo: {str(e)}")
            
            # Add "Official" badge text below logo frame
            pdf_canvas.setFont('Helvetica-Bold', 7)
            pdf_canvas.setFillColor(teal)
            pdf_canvas.drawCentredString(logo_center_x, logo_center_y - 20*mm, '◆ OFFICIAL ◆')
            
            # Header - Academy name with tech style
            pdf_canvas.setFont('Helvetica-Bold', 12)
            pdf_canvas.setFillColor(teal)
            pdf_canvas.drawCentredString(width / 2, height - 35*mm, 'AFRITECH BRIDGE')
            
            # Subtitle - tech-focused tagline
            pdf_canvas.setFont('Helvetica', 9)
            pdf_canvas.setFillColor(light_teal)
            pdf_canvas.drawCentredString(width / 2, height - 40*mm, 'Empowering Africa Through Technology Education')
            
            # Title - Certificate of Completion with modern styling
            pdf_canvas.setFont('Helvetica-Bold', 34)
            pdf_canvas.setFillColor(white)
            pdf_canvas.drawCentredString(width / 2, height - 55*mm, 'CERTIFICATE')
            pdf_canvas.setFont('Helvetica-Bold', 28)
            pdf_canvas.setFillColor(orange)
            pdf_canvas.drawCentredString(width / 2, height - 63*mm, 'OF ACHIEVEMENT')
            
            # Decorative tech divider with dots
            divider_y = height - 67*mm
            pdf_canvas.setStrokeColor(teal)
            pdf_canvas.setLineWidth(1.5)
            pdf_canvas.line(width/2 - 80*mm, divider_y, width/2 - 5*mm, divider_y)
            pdf_canvas.line(width/2 + 5*mm, divider_y, width/2 + 80*mm, divider_y)
            # Center dots
            for i in range(3):
                x_pos = width/2 - 3*mm + i * 3*mm
                pdf_canvas.setFillColor(orange if i == 1 else teal)
                pdf_canvas.circle(x_pos, divider_y, 1.5*mm, fill=1, stroke=0)
            
            # Body text - modern style
            pdf_canvas.setFont('Helvetica', 12)
            pdf_canvas.setFillColor(light_gray)
            pdf_canvas.drawCentredString(width / 2, height - 78*mm, 'This certifies that')
            
            # Student name - prominent with tech accent
            pdf_canvas.setFont('Helvetica-Bold', 28)
            pdf_canvas.setFillColor(white)
            pdf_canvas.drawCentredString(width / 2, height - 92*mm, student_name)
            
            # Name underline with gradient effect
            pdf_canvas.setStrokeColor(teal)
            pdf_canvas.setLineWidth(2)
            pdf_canvas.line(width/2 - 75*mm, height - 95*mm, width/2, height - 95*mm)
            pdf_canvas.setStrokeColor(orange)
            pdf_canvas.line(width/2, height - 95*mm, width/2 + 75*mm, height - 95*mm)
            
            # Completion text
            pdf_canvas.setFont('Helvetica', 12)
            pdf_canvas.setFillColor(light_gray)
            pdf_canvas.drawCentredString(width / 2, height - 105*mm, 'has successfully completed the course')
            
            # Course title - with modern tech-styled box (improved sizing)
            pdf_canvas.setFont('Helvetica-Bold', 18)
            pdf_canvas.setFillColor(white)
            
            # Better width calculation based on text width
            if len(course_title) > 50:
                # Split into two lines
                words = course_title.split()
                mid = len(words) // 2
                line1 = ' '.join(words[:mid])
                line2 = ' '.join(words[mid:])
                
                # Calculate width based on longest line with proper padding
                max_line_length = max(len(line1), len(line2))
                box_width = min(max_line_length * 4.2*mm, 220*mm)  # Cap at reasonable width
                box_height = 16*mm
                box_y = height - 127*mm
                
                pdf_canvas.setFillColor(brand_blue)
                pdf_canvas.roundRect(width/2 - box_width/2, box_y, box_width, box_height, 4*mm, fill=1, stroke=0)
                pdf_canvas.setStrokeColor(teal)
                pdf_canvas.setLineWidth(2)
                pdf_canvas.roundRect(width/2 - box_width/2, box_y, box_width, box_height, 4*mm, fill=0, stroke=1)
                
                # Add corner decorations
                for corner in [(width/2 - box_width/2 + 3*mm, box_y + 3*mm),
                               (width/2 + box_width/2 - 3*mm, box_y + 3*mm),
                               (width/2 - box_width/2 + 3*mm, box_y + box_height - 3*mm),
                               (width/2 + box_width/2 - 3*mm, box_y + box_height - 3*mm)]:
                    pdf_canvas.setFillColor(orange)
                    pdf_canvas.circle(corner[0], corner[1], 0.8*mm, fill=1, stroke=0)
                
                pdf_canvas.setFillColor(white)
                pdf_canvas.drawCentredString(width / 2, box_y + 10*mm, line1)
                pdf_canvas.drawCentredString(width / 2, box_y + 5*mm, line2)
                y_offset = 128
            else:
                # Single line - better width calculation
                box_width = min(len(course_title) * 4.2*mm, 220*mm)
                box_height = 12*mm
                box_y = height - 123*mm
                
                pdf_canvas.setFillColor(brand_blue)
                pdf_canvas.roundRect(width/2 - box_width/2, box_y, box_width, box_height, 4*mm, fill=1, stroke=0)
                pdf_canvas.setStrokeColor(teal)
                pdf_canvas.setLineWidth(2)
                pdf_canvas.roundRect(width/2 - box_width/2, box_y, box_width, box_height, 4*mm, fill=0, stroke=1)
                
                # Add corner decorations
                for corner in [(width/2 - box_width/2 + 3*mm, box_y + 3*mm),
                               (width/2 + box_width/2 - 3*mm, box_y + 3*mm),
                               (width/2 - box_width/2 + 3*mm, box_y + box_height - 3*mm),
                               (width/2 + box_width/2 - 3*mm, box_y + box_height - 3*mm)]:
                    pdf_canvas.setFillColor(orange)
                    pdf_canvas.circle(corner[0], corner[1], 0.8*mm, fill=1, stroke=0)
                
                pdf_canvas.setFillColor(white)
                pdf_canvas.drawCentredString(width / 2, box_y + 6*mm, course_title)
                y_offset = 123
            
            # Skills section with improved display
            skills = certificate.skills_acquired
            if skills:
                import json
                try:
                    skills_list = json.loads(skills) if isinstance(skills, str) else skills
                    if skills_list and len(skills_list) > 0:
                        # Display skills with better formatting
                        pdf_canvas.setFont('Helvetica-Bold', 7.5)
                        pdf_canvas.setFillColor(teal)
                        # Truncate very long skill names intelligently
                        display_skills = []
                        for skill in skills_list[:3]:
                            if len(skill) > 35:
                                display_skills.append(skill[:32] + '...')
                            else:
                                display_skills.append(skill)
                        skills_text = 'COMPETENCIES: ' + ' • '.join(display_skills)
                        pdf_canvas.drawCentredString(width / 2, height - (y_offset + 10)*mm, skills_text)
                        
                        y_offset += 12
                except Exception as e:
                    logger.warning(f"Error rendering skills: {str(e)}")
            
            # Footer section with modern tech design
            footer_y = 48*mm
            
            # Left side - Date and Certificate ID with improved styling
            left_section_x = 26*mm
            pdf_canvas.setFont('Helvetica-Bold', 8.5)
            pdf_canvas.setFillColor(teal)
            pdf_canvas.drawString(left_section_x, footer_y + 12*mm, 'ISSUE DATE')
            pdf_canvas.setFont('Helvetica-Bold', 10)
            pdf_canvas.setFillColor(white)
            issue_date = certificate.issued_at or datetime.utcnow()
            pdf_canvas.drawString(left_section_x, footer_y + 7*mm, issue_date.strftime('%B %d, %Y'))
            
            # Certificate ID with tech style
            pdf_canvas.setFont('Helvetica-Bold', 8.5)
            pdf_canvas.setFillColor(orange)
            pdf_canvas.drawString(left_section_x, footer_y - 2*mm, 'CERTIFICATE ID')
            pdf_canvas.setFont('Helvetica', 8)
            pdf_canvas.setFillColor(colors.HexColor('#cbd5e1'))  # Lighter gray for better contrast
            pdf_canvas.drawString(left_section_x, footer_y - 7*mm, certificate.certificate_number)
            
            # Enhanced verified badge with checkmark
            pdf_canvas.setFont('Helvetica-Bold', 7.5)
            pdf_canvas.setFillColor(teal)
            pdf_canvas.circle(left_section_x - 2*mm, footer_y - 14*mm, 2.2*mm, fill=1, stroke=0)
            pdf_canvas.setStrokeColor(colors.HexColor('#22d3ee'))
            pdf_canvas.setLineWidth(1.5)
            pdf_canvas.circle(left_section_x - 2*mm, footer_y - 14*mm, 2.8*mm, fill=0, stroke=1)
            pdf_canvas.setFillColor(white)
            pdf_canvas.setFont('Helvetica-Bold', 10)
            pdf_canvas.drawString(left_section_x - 3.5*mm, footer_y - 15.5*mm, '✓')
            pdf_canvas.setFillColor(light_teal)
            pdf_canvas.setFont('Helvetica-Bold', 7.5)
            pdf_canvas.drawString(left_section_x + 2*mm, footer_y - 15*mm, 'Blockchain Verified')
            
            # Center - Enhanced Signature Section with Authority Badge
            center_x = width / 2
            sig_box_width = 76*mm
            sig_box_height = 24*mm
            sig_box_x = center_x - sig_box_width/2
            sig_box_y = footer_y
            
            # Create elegant signature box background
            pdf_canvas.setFillColorRGB(0.12, 0.23, 0.54, alpha=0.3)  # Semi-transparent brand blue
            pdf_canvas.roundRect(sig_box_x, sig_box_y, sig_box_width, sig_box_height, 5*mm, fill=1, stroke=0)
            
            # Premium double border with gradient effect
            pdf_canvas.setStrokeColor(teal)
            pdf_canvas.setLineWidth(2)
            pdf_canvas.roundRect(sig_box_x, sig_box_y, sig_box_width, sig_box_height, 5*mm, fill=0, stroke=1)
            pdf_canvas.setStrokeColor(orange)
            pdf_canvas.setLineWidth(1)
            pdf_canvas.roundRect(sig_box_x + 1.5*mm, sig_box_y + 1.5*mm, sig_box_width - 3*mm, sig_box_height - 3*mm, 4*mm, fill=0, stroke=1)
            
            # Add corner decorative elements (tech nodes)
            corner_offset = 3*mm
            corners = [
                (sig_box_x + corner_offset, sig_box_y + corner_offset),
                (sig_box_x + sig_box_width - corner_offset, sig_box_y + corner_offset),
                (sig_box_x + corner_offset, sig_box_y + sig_box_height - corner_offset),
                (sig_box_x + sig_box_width - corner_offset, sig_box_y + sig_box_height - corner_offset),
            ]
            for i, (x, y) in enumerate(corners):
                color = teal if i % 2 == 0 else orange
                pdf_canvas.setFillColor(color)
                pdf_canvas.circle(x, y, 1.5*mm, fill=1, stroke=0)
            
            # Add "AUTHORIZED SIGNATURE" label at top of box
            pdf_canvas.setFont('Helvetica-Bold', 5.5)
            pdf_canvas.setFillColor(teal)
            pdf_canvas.drawCentredString(center_x, sig_box_y + sig_box_height - 2.5*mm, '──────── AUTHORIZED SIGNATURE ────────')
            
            # Create signature frame (matching frontend design) - frame is smaller than image
            sig_frame_width = 14*mm
            sig_frame_height = 7*mm
            sig_frame_x = center_x - sig_frame_width/2
            sig_frame_y = sig_box_y + sig_box_height - 10*mm  # Position from top for better spacing
            
            # Frame with teal/cyan left-top and orange right-bottom borders
            pdf_canvas.setStrokeColor(teal)
            pdf_canvas.setLineWidth(2)
            # Left border
            pdf_canvas.line(sig_frame_x, sig_frame_y, sig_frame_x, sig_frame_y + sig_frame_height)
            # Top border
            pdf_canvas.line(sig_frame_x, sig_frame_y + sig_frame_height, sig_frame_x + sig_frame_width, sig_frame_y + sig_frame_height)
            
            pdf_canvas.setStrokeColor(orange)
            # Right border
            pdf_canvas.line(sig_frame_x + sig_frame_width, sig_frame_y, sig_frame_x + sig_frame_width, sig_frame_y + sig_frame_height)
            # Bottom border
            pdf_canvas.line(sig_frame_x, sig_frame_y, sig_frame_x + sig_frame_width, sig_frame_y)
            
            # Frame background
            pdf_canvas.setFillColorRGB(0.12, 0.23, 0.54, alpha=0.15)
            pdf_canvas.rect(sig_frame_x, sig_frame_y, sig_frame_width, sig_frame_height, fill=1, stroke=0)
            
            # Add signature image with proper fitting inside frame
            signature_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'static', 'images', 'sign.jpg')
            if os.path.exists(signature_path):
                try:
                    # Signature size with padding inside frame
                    sig_width = 52*mm  # 2mm total padding (1mm on each side)
                    sig_height = 6*mm  # 1mm total padding (0.5mm on each side)
                    # Center signature in the frame
                    sig_x_position = sig_frame_x + (sig_frame_width - sig_width)/2
                    sig_y_position = sig_frame_y + (sig_frame_height - sig_height)/2
                    pdf_canvas.drawImage(signature_path, 
                                       sig_x_position, 
                                       sig_y_position, 
                                       width=sig_width, 
                                       height=sig_height, 
                                       preserveAspectRatio=True,
                                       anchor='c',
                                       mask='auto')
                except Exception as e:
                    logger.warning(f"Could not add signature: {str(e)}")
            
            # Elegant signature line with tech dots (positioned below signature frame)
            line_y = sig_box_y + sig_box_height - 11.5*mm
            pdf_canvas.setStrokeColor(teal)
            pdf_canvas.setLineWidth(1.1)
            pdf_canvas.line(center_x - 31*mm, line_y, center_x - 2*mm, line_y)
            pdf_canvas.setStrokeColor(orange)
            pdf_canvas.line(center_x + 2*mm, line_y, center_x + 31*mm, line_y)
            # Center tech nodes
            pdf_canvas.setFillColor(teal)
            pdf_canvas.circle(center_x - 2*mm, line_y, 0.7*mm, fill=1, stroke=0)
            pdf_canvas.setFillColor(orange)
            pdf_canvas.circle(center_x + 2*mm, line_y, 0.7*mm, fill=1, stroke=0)
            
            # Signature name with better spacing
            pdf_canvas.setFont('Helvetica-Bold', 10)
            pdf_canvas.setFillColor(white)
            pdf_canvas.drawCentredString(center_x, sig_box_y + 8.5*mm, 'Desire Bikorimana')
            
            # Title with accent styling
            pdf_canvas.setFont('Helvetica-Bold', 7.5)
            pdf_canvas.setFillColor(orange)
            pdf_canvas.drawCentredString(center_x, sig_box_y + 5*mm, 'Founder & Chief Executive Officer')
            
            # Company name
            pdf_canvas.setFont('Helvetica', 6.5)
            pdf_canvas.setFillColor(light_gray)
            pdf_canvas.drawCentredString(center_x, sig_box_y + 2*mm, 'Afritech Bridge')
            
            # Add authority seal/badge on left side of signature
            seal_x = sig_box_x + 8*mm
            seal_y = sig_box_y + 12*mm  # Fixed position for better alignment
            seal_radius = 5.5*mm
            
            # Seal outer circle
            pdf_canvas.setStrokeColor(teal)
            pdf_canvas.setLineWidth(2)
            pdf_canvas.circle(seal_x, seal_y, seal_radius, fill=0, stroke=1)
            pdf_canvas.setLineWidth(1)
            pdf_canvas.circle(seal_x, seal_y, seal_radius - 1.5*mm, fill=0, stroke=1)
            
            # Seal inner design - star/badge shape
            pdf_canvas.setFillColor(teal)
            pdf_canvas.setStrokeColor(teal)
            # Center circle
            pdf_canvas.circle(seal_x, seal_y, 2*mm, fill=1, stroke=0)
            # Radiating lines (badge effect)
            for angle in range(0, 360, 45):
                angle_rad = math.radians(angle)
                x1 = seal_x + 2.5*mm * math.cos(angle_rad)
                y1 = seal_y + 2.5*mm * math.sin(angle_rad)
                x2 = seal_x + 5.5*mm * math.cos(angle_rad)
                y2 = seal_y + 5.5*mm * math.sin(angle_rad)
                pdf_canvas.setLineWidth(1.5)
                pdf_canvas.line(x1, y1, x2, y2)
                pdf_canvas.circle(x2, y2, 0.8*mm, fill=1, stroke=0)
            
            # Seal text
            pdf_canvas.setFont('Helvetica-Bold', 6)
            pdf_canvas.setFillColor(teal)
            pdf_canvas.drawCentredString(seal_x, seal_y - 7*mm, '2026')
            
            # Add excellence ribbon/badge on right side
            ribbon_x = sig_box_x + sig_box_width - 8*mm
            ribbon_y = sig_box_y + 12*mm  # Fixed position for better alignment
            ribbon_radius = 5.5*mm
            
            # Ribbon outer circle
            pdf_canvas.setStrokeColor(orange)
            pdf_canvas.setLineWidth(2)
            pdf_canvas.circle(ribbon_x, ribbon_y, ribbon_radius, fill=0, stroke=1)
            pdf_canvas.setLineWidth(1)
            pdf_canvas.circle(ribbon_x, ribbon_y, ribbon_radius - 1.5*mm, fill=0, stroke=1)
            
            # Excellence star
            pdf_canvas.setFillColor(orange)
            pdf_canvas.setStrokeColor(orange)
            pdf_canvas.circle(ribbon_x, ribbon_y, 2.5*mm, fill=1, stroke=0)
            # Star points
            for angle in [0, 72, 144, 216, 288]:
                angle_rad = math.radians(angle - 90)
                x = ribbon_x + 5*mm * math.cos(angle_rad)
                y = ribbon_y + 5*mm * math.sin(angle_rad)
                pdf_canvas.circle(x, y, 1.2*mm, fill=1, stroke=0)
            
            # Excellence text
            pdf_canvas.setFont('Helvetica-Bold', 5)
            pdf_canvas.setFillColor(orange)
            pdf_canvas.drawCentredString(ribbon_x, ribbon_y - 7*mm, 'EXCELLENCE')
            
            # Right side - QR Code with modern tech frame
            qr_size = 16*mm
            qr_x = width - 42*mm
            qr_y = footer_y - 2*mm
            
            # Generate real QR code
            verification_url = f"https://study.afritechbridge.online/verify/{certificate.certificate_number}"
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_H,
                box_size=10,
                border=1,
            )
            qr.add_data(verification_url)
            qr.make(fit=True)
            
            # Create QR code image
            qr_img = qr.make_image(fill_color="#0f172a", back_color="white")
            
            # Save QR code to BytesIO buffer
            qr_buffer = BytesIO()
            qr_img.save(qr_buffer, format='PNG')
            qr_buffer.seek(0)
            
            # Draw white background first
            pdf_canvas.setFillColor(white)
            pdf_canvas.roundRect(qr_x, qr_y, qr_size, qr_size, 3*mm, fill=1, stroke=0)
            
            # Draw QR code image inside frame using ImageReader
            qr_image_reader = ImageReader(qr_buffer)
            pdf_canvas.drawImage(
                qr_image_reader,
                qr_x + 2*mm,
                qr_y + 2*mm,
                width=qr_size - 4*mm,
                height=qr_size - 4*mm,
                preserveAspectRatio=True,
                mask='auto'
            )
            
            # Tech-style border
            pdf_canvas.setStrokeColor(teal)
            pdf_canvas.setLineWidth(2)
            pdf_canvas.roundRect(qr_x, qr_y, qr_size, qr_size, 3*mm, fill=0, stroke=1)
            
            # Corner accents (circuit nodes)
            corner_size = 1.5*mm
            pdf_canvas.setFillColor(orange)
            pdf_canvas.circle(qr_x, qr_y, corner_size, fill=1, stroke=0)
            pdf_canvas.circle(qr_x + qr_size, qr_y, corner_size, fill=1, stroke=0)
            pdf_canvas.circle(qr_x, qr_y + qr_size, corner_size, fill=1, stroke=0)
            pdf_canvas.circle(qr_x + qr_size, qr_y + qr_size, corner_size, fill=1, stroke=0)
            
            # Scan instruction with tech style
            pdf_canvas.setFont('Helvetica-Bold', 7)
            pdf_canvas.setFillColor(teal)
            pdf_canvas.drawCentredString(qr_x + qr_size/2, footer_y - 6*mm, 'SCAN TO VERIFY')
            
            # Verification URL
            pdf_canvas.setFont('Helvetica', 6.5)
            pdf_canvas.setFillColor(light_gray)
            verify_url = f"study.afritechbridge.online/verify"
            pdf_canvas.drawCentredString(qr_x + qr_size/2, footer_y - 10*mm, verify_url)
            
            # Footer section with elegant badge design
            footer_line_y = 20*mm
            
            # Horizontal divider line with gradient effect (draw segments)
            pdf_canvas.setStrokeColor(teal)
            pdf_canvas.setLineWidth(1.5)
            pdf_canvas.line(30*mm, footer_line_y, width/2, footer_line_y)
            # Right side with orange tint
            pdf_canvas.setStrokeColor(colors.HexColor('#8B5CF6'))  # Purple blend
            pdf_canvas.line(width/2, footer_line_y, width - 30*mm, footer_line_y)
            
            # Left circular badge (Teal) at 20mm from left edge
            left_badge_x = 24*mm
            badge_y = footer_line_y
            badge_radius = 3*mm
            
            # Outer glow circle
            pdf_canvas.setFillColorRGB(0.078, 0.722, 0.651, alpha=0.2)
            pdf_canvas.circle(left_badge_x, badge_y, badge_radius + 1*mm, fill=1, stroke=0)
            # Badge outer ring
            pdf_canvas.setStrokeColor(teal)
            pdf_canvas.setLineWidth(2)
            pdf_canvas.circle(left_badge_x, badge_y, badge_radius, fill=0, stroke=1)
            # Middle layer
            pdf_canvas.setFillColorRGB(0.078, 0.722, 0.651, alpha=0.3)
            pdf_canvas.circle(left_badge_x, badge_y, badge_radius - 0.7*mm, fill=1, stroke=0)
            # Inner core
            pdf_canvas.setFillColor(teal)
            pdf_canvas.circle(left_badge_x, badge_y, badge_radius - 1.5*mm, fill=1, stroke=0)
            # Inner highlight
            pdf_canvas.setFillColor(colors.HexColor('#5eead4'))
            pdf_canvas.circle(left_badge_x, badge_y, badge_radius - 2*mm, fill=1, stroke=0)
            
            # Right circular badge (Teal/Orange blend) at 20mm from right edge
            right_badge_x = width - 24*mm
            # Outer glow circle
            pdf_canvas.setFillColorRGB(0.976, 0.451, 0.086, alpha=0.2)
            pdf_canvas.circle(right_badge_x, badge_y, badge_radius + 1*mm, fill=1, stroke=0)
            # Badge outer ring (teal)
            pdf_canvas.setStrokeColor(teal)
            pdf_canvas.setLineWidth(2)
            pdf_canvas.circle(right_badge_x, badge_y, badge_radius, fill=0, stroke=1)
            # Middle layer (orange tint)
            pdf_canvas.setFillColorRGB(0.976, 0.451, 0.086, alpha=0.3)
            pdf_canvas.circle(right_badge_x, badge_y, badge_radius - 0.7*mm, fill=1, stroke=0)
            # Inner core (teal)
            pdf_canvas.setFillColor(teal)
            pdf_canvas.circle(right_badge_x, badge_y, badge_radius - 1.5*mm, fill=1, stroke=0)
            # Inner highlight
            pdf_canvas.setFillColor(colors.HexColor('#5eead4'))
            pdf_canvas.circle(right_badge_x, badge_y, badge_radius - 2*mm, fill=1, stroke=0)
            
            # Footer text with better spacing and contrast
            pdf_canvas.setFont('Helvetica', 7)
            pdf_canvas.setFillColor(colors.HexColor('#cbd5e1'))
            pdf_canvas.drawCentredString(width / 2, 13*mm, 'Empowering the next generation of African tech leaders')
            pdf_canvas.setFillColor(teal)
            pdf_canvas.setFont('Helvetica-Bold', 6.5)
            pdf_canvas.drawCentredString(width / 2, 9*mm, '2026 Afritech Bridge - All Rights Reserved')
            
            # Save PDF - this must be called to finalize the document
            pdf_canvas.showPage()  # Finish the current page
            pdf_canvas.save()
            
            # Move buffer position to beginning
            buffer.seek(0)
            
            logger.info(f"PDF generated successfully, buffer size: {buffer.getbuffer().nbytes} bytes")
            
            return buffer
            
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"PDF generation error: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            return None
    
    @staticmethod
    def generate_certificate_image(certificate: Certificate):
        """Generate PNG image for a certificate using PDF as source"""
        try:
            from pdf2image import convert_from_bytes
            from io import BytesIO
            import logging
            import traceback
            
            logger = logging.getLogger(__name__)
            
            # First generate the PDF
            pdf_buffer = CertificateService.generate_certificate_pdf(certificate)
            
            if not pdf_buffer:
                logger.error("Failed to generate PDF for image conversion")
                return None
            
            # Convert PDF to image (first page only)
            images = convert_from_bytes(
                pdf_buffer.getvalue(),
                dpi=300,  # High quality
                fmt='png'
            )
            
            if not images:
                logger.error("No images generated from PDF")
                return None
            
            # Get the first page
            image = images[0]
            
            # Save to BytesIO buffer
            img_buffer = BytesIO()
            image.save(img_buffer, format='PNG', optimize=True, quality=95)
            img_buffer.seek(0)
            
            logger.info(f"PNG image generated successfully, size: {img_buffer.getbuffer().nbytes} bytes")
            
            return img_buffer
            
        except ImportError as e:
            logger = logging.getLogger(__name__)
            logger.error(f"pdf2image not available: {str(e)}")
            logger.error("Install with: pip install pdf2image")
            logger.error("Also requires poppler-utils: sudo apt-get install poppler-utils")
            return None
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"PNG generation error: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            return None