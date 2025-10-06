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
                user_id=student_id, course_id=course_id
            ).first()
            
            if not enrollment:
                return False, "Not enrolled in course", {}
            
            course = Course.query.get(course_id)
            if not course:
                return False, "Course not found", {}
            
            # Check if all modules are completed with passing scores
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
                    "score": module_progress.cumulative_score,
                    "attempts": module_progress.attempts_count
                }
                
                if module_progress.status == 'completed':
                    requirements_status["completed_modules"] += 1
                    overall_scores.append(module_progress.cumulative_score)
                elif module_progress.status == 'failed':
                    requirements_status["failed_modules"] += 1
                
                requirements_status["module_details"].append(module_detail)
            
            # Check portfolio requirements
            portfolio_items = CertificateService._get_portfolio_items(student_id, course_id)
            requirements_status["portfolio_items"] = len(portfolio_items)
            requirements_status["portfolio_required"] = True
            
            # Calculate overall score
            if overall_scores:
                overall_score = sum(overall_scores) / len(overall_scores)
                requirements_status["overall_score"] = overall_score
            else:
                overall_score = 0
                requirements_status["overall_score"] = 0
            
            # Check eligibility
            eligible = (
                requirements_status["completed_modules"] == requirements_status["total_modules"] and
                requirements_status["failed_modules"] == 0 and
                overall_score >= course.passing_score and
                len(portfolio_items) > 0
            )
            
            if eligible:
                return True, "Eligible for certificate", requirements_status
            else:
                reason = CertificateService._get_ineligibility_reason(requirements_status, course.passing_score)
                return False, reason, requirements_status
                
        except Exception as e:
            current_app.logger.error(f"Certificate eligibility check error: {str(e)}")
            return False, "Error checking eligibility", {}
    
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
            # Check eligibility first
            eligible, reason, requirements = CertificateService.check_certificate_eligibility(
                student_id, course_id
            )
            
            if not eligible:
                return False, f"Not eligible for certificate: {reason}", {}
            
            # Check if certificate already exists
            enrollment = Enrollment.query.filter_by(
                user_id=student_id, course_id=course_id
            ).first()
            
            existing_cert = Certificate.query.filter_by(
                student_id=student_id,
                course_id=course_id,
                enrollment_id=enrollment.id
            ).first()
            
            if existing_cert:
                return True, "Certificate already generated", existing_cert.to_dict()
            
            # Calculate final grade
            overall_score = requirements["overall_score"]
            grade = CertificateService._calculate_grade(overall_score)
            
            # Create certificate
            certificate = Certificate(
                student_id=student_id,
                course_id=course_id,
                enrollment_id=enrollment.id,
                overall_score=overall_score,
                grade=grade
            )
            
            # Generate certificate number and verification hash
            certificate.generate_certificate_number()
            
            # Add skills and portfolio items
            skills_acquired = CertificateService._extract_course_skills(course_id)
            portfolio_items = CertificateService._get_portfolio_items(student_id, course_id)
            
            certificate.skills_acquired = json.dumps(skills_acquired)
            certificate.portfolio_items = json.dumps(portfolio_items)
            
            # Mark enrollment as completed
            enrollment.completed = True
            enrollment.completion_date = datetime.utcnow()
            enrollment.final_grade = grade
            
            db.session.add(certificate)
            db.session.commit()
            
            # Update student transcript
            CertificateService._update_student_transcript(student_id)
            
            # Award completion badges
            CertificateService._award_completion_badges(student_id, course_id)
            
            return True, "Certificate generated successfully", certificate.to_dict()
            
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
    def get_student_certificates(student_id: int) -> List[Dict]:
        """Get all certificates for a student"""
        certificates = Certificate.query.filter_by(
            student_id=student_id, is_active=True
        ).order_by(Certificate.issued_at.desc()).all()
        
        return [cert.to_dict() for cert in certificates]
    
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
            enrollments = Enrollment.query.filter_by(user_id=student_id).all()
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
    def _calculate_grade(score: float) -> str:
        """Calculate letter grade from score"""
        if score >= 95:
            return 'A+'
        elif score >= 90:
            return 'A'
        elif score >= 85:
            return 'A-'
        elif score >= 82:
            return 'B+'
        elif score >= 80:
            return 'B'
        elif score >= 75:
            return 'C+'
        elif score >= 70:
            return 'C'
        else:
            return 'F'
    
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
        
        if requirements["portfolio_items"] == 0:
            reasons.append("No portfolio items completed")
        
        return "; ".join(reasons)
    
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