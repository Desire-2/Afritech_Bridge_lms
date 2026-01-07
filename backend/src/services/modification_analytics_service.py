"""
Analytics service specifically for modification requests and resubmission tracking
"""
import logging
from datetime import datetime, timedelta
from sqlalchemy import and_, or_, func, desc, case
from typing import Dict, List, Optional
from collections import defaultdict

from ..models import db
from ..models.user_models import User
from ..models.course_models import Assignment, Project, Course, AssignmentSubmission, ProjectSubmission
from ..models.student_models import LessonCompletion

logger = logging.getLogger(__name__)

class ModificationAnalytics:
    """Analytics for modification requests and resubmissions"""
    
    @staticmethod
    def get_instructor_modification_analytics(instructor_id: int, course_id: Optional[int] = None, 
                                            start_date: Optional[datetime] = None, 
                                            end_date: Optional[datetime] = None) -> Dict:
        """Comprehensive analytics for instructor modification requests"""
        try:
            if not end_date:
                end_date = datetime.utcnow()
            if not start_date:
                start_date = end_date - timedelta(days=90)
            
            # Base query for assignments by instructor
            base_query = Assignment.query.join(Course).filter(
                Course.instructor_id == instructor_id
            )
            
            if course_id:
                base_query = base_query.filter(Assignment.course_id == course_id)
            
            all_assignments = base_query.all()
            assignment_ids = [a.id for a in all_assignments]
            
            if not assignment_ids:
                return {
                    'summary': {
                        'total_assignments': 0,
                        'assignments_with_modifications': 0,
                        'modification_rate': 0,
                        'total_modification_requests': 0,
                        'resubmission_success_rate': 0
                    }
                }
            
            # Basic counts
            total_assignments = len(all_assignments)
            assignments_with_modifications = Assignment.query.filter(
                Assignment.id.in_(assignment_ids),
                Assignment.modification_requested == True
            ).count()
            
            # Get modification requests in date range
            modification_requests = Assignment.query.filter(
                Assignment.id.in_(assignment_ids),
                Assignment.modification_requested == True,
                Assignment.modification_requested_at.between(start_date, end_date)
            ).all()
            
            total_requests = len(modification_requests)
            modification_rate = (assignments_with_modifications / total_assignments * 100) if total_assignments > 0 else 0
            
            # Success rate calculation
            successful_resubmissions = 0
            for assignment in modification_requests:
                # Check if there are completed resubmissions
                completed = LessonCompletion.query.filter(
                    LessonCompletion.lesson_id == assignment.lesson_id,
                    LessonCompletion.assignment_needs_resubmission == False,
                    LessonCompletion.is_resubmission == True
                ).count()
                
                if completed > 0:
                    successful_resubmissions += 1
            
            resubmission_success_rate = (successful_resubmissions / total_requests * 100) if total_requests > 0 else 0
            
            # Top modification reasons analysis
            reason_counts = defaultdict(int)
            for assignment in modification_requests:
                if assignment.modification_request_reason:
                    reason = assignment.modification_request_reason.lower()
                    if any(word in reason for word in ['grammar', 'spelling', 'writing']):
                        reason_counts['Grammar/Writing Issues'] += 1
                    elif any(word in reason for word in ['format', 'structure', 'organization']):
                        reason_counts['Format/Structure'] += 1
                    elif any(word in reason for word in ['content', 'information', 'detail']):
                        reason_counts['Content Issues'] += 1
                    elif any(word in reason for word in ['reference', 'citation', 'source']):
                        reason_counts['References/Citations'] += 1
                    elif any(word in reason for word in ['incomplete', 'missing', 'unfinished']):
                        reason_counts['Incomplete Work'] += 1
                    else:
                        reason_counts['Other'] += 1
            
            top_reasons = sorted(reason_counts.items(), key=lambda x: x[1], reverse=True)[:5]
            
            # Course breakdown
            course_stats = db.session.query(
                Course.title,
                Course.id,
                func.count(Assignment.id).label('total_assignments'),
                func.sum(case([(Assignment.modification_requested == True, 1)], else_=0)).label('modifications')
            ).join(
                Assignment, Course.id == Assignment.course_id
            ).filter(
                Course.instructor_id == instructor_id
            ).group_by(Course.id, Course.title).all()
            
            courses = []
            for course_title, course_id_val, total, mods in course_stats:
                mod_rate = (mods / total * 100) if total > 0 else 0
                courses.append({
                    'course_title': course_title,
                    'course_id': course_id_val,
                    'total_assignments': total,
                    'modifications': mods or 0,
                    'modification_rate': round(mod_rate, 1)
                })
            
            return {
                'summary': {
                    'total_assignments': total_assignments,
                    'assignments_with_modifications': assignments_with_modifications,
                    'modification_rate': round(modification_rate, 1),
                    'total_modification_requests': total_requests,
                    'resubmission_success_rate': round(resubmission_success_rate, 1),
                    'date_range': {
                        'start': start_date.isoformat(),
                        'end': end_date.isoformat()
                    }
                },
                'top_modification_reasons': top_reasons,
                'course_breakdown': courses
            }
            
        except Exception as e:
            logger.error(f"Error getting instructor modification analytics: {e}")
            return {'summary': {}, 'top_modification_reasons': [], 'course_breakdown': []}
    
    @staticmethod
    def get_platform_modification_analytics(start_date: Optional[datetime] = None,
                                          end_date: Optional[datetime] = None) -> Dict:
        """Platform-wide modification analytics"""
        try:
            if not end_date:
                end_date = datetime.utcnow()
            if not start_date:
                start_date = end_date - timedelta(days=30)
            
            # Platform totals
            total_assignments = Assignment.query.count()
            total_modifications = Assignment.query.filter(
                Assignment.modification_requested == True
            ).count()
            
            platform_modification_rate = (total_modifications / total_assignments * 100) if total_assignments > 0 else 0
            
            # Instructor performance ranking
            instructor_stats = db.session.query(
                User.id,
                User.full_name,
                func.count(Assignment.id).label('total_assignments'),
                func.sum(case([(Assignment.modification_requested == True, 1)], else_=0)).label('modifications')
            ).join(
                Course, User.id == Course.instructor_id
            ).join(
                Assignment, Course.id == Assignment.course_id
            ).filter(
                User.role.has(name='instructor')
            ).group_by(User.id, User.full_name).having(
                func.count(Assignment.id) > 0
            ).all()
            
            instructor_performance = []
            for user_id, name, total, mods in instructor_stats:
                mod_rate = (mods / total * 100) if total > 0 else 0
                instructor_performance.append({
                    'instructor_id': user_id,
                    'instructor_name': name,
                    'total_assignments': total,
                    'modifications': mods or 0,
                    'modification_rate': round(mod_rate, 1)
                })
            
            instructor_performance.sort(key=lambda x: x['modification_rate'], reverse=True)
            
            return {
                'platform_summary': {
                    'total_assignments': total_assignments,
                    'total_modifications': total_modifications,
                    'platform_modification_rate': round(platform_modification_rate, 1),
                    'date_range': {
                        'start': start_date.isoformat(),
                        'end': end_date.isoformat()
                    }
                },
                'instructor_performance': instructor_performance[:10]
            }
            
        except Exception as e:
            logger.error(f"Error getting platform modification analytics: {e}")
            return {'platform_summary': {}, 'instructor_performance': []}

class ModificationInsights:
    """Generate insights and recommendations from modification analytics"""
    
    @staticmethod
    def generate_instructor_insights(analytics: Dict) -> List[Dict]:
        """Generate actionable insights for instructors"""
        insights = []
        
        try:
            summary = analytics.get('summary', {})
            mod_rate = summary.get('modification_rate', 0)
            success_rate = summary.get('resubmission_success_rate', 0)
            
            # Modification rate insights
            if mod_rate > 30:
                insights.append({
                    'type': 'warning',
                    'title': 'High Modification Rate',
                    'message': f'Your modification rate ({mod_rate}%) is above average.',
                    'recommendation': 'Consider providing clearer assignment instructions and rubrics.',
                    'priority': 'high'
                })
            elif mod_rate < 10:
                insights.append({
                    'type': 'success',
                    'title': 'Excellent Assignment Clarity',
                    'message': f'Your low modification rate ({mod_rate}%) indicates clear assignments.',
                    'recommendation': 'Continue your current practices and consider sharing techniques.',
                    'priority': 'info'
                })
            
            # Success rate insights
            if success_rate < 70:
                insights.append({
                    'type': 'warning',
                    'title': 'Low Resubmission Success Rate',
                    'message': f'Only {success_rate}% of modification requests result in successful resubmissions.',
                    'recommendation': 'Provide more specific and actionable feedback to students.',
                    'priority': 'medium'
                })
            
            # Reason-specific insights
            top_reasons = analytics.get('top_modification_reasons', [])
            if top_reasons and top_reasons[0][1] > 5:  # More than 5 instances of top reason
                reason, count = top_reasons[0]
                insights.append({
                    'type': 'info',
                    'title': f'Common Issue: {reason}',
                    'message': f'{reason} accounts for {count} modification requests.',
                    'recommendation': f'Consider providing specific guidelines or resources for {reason.lower()}.',
                    'priority': 'medium'
                })
            
            # Course-specific insights
            courses = analytics.get('course_breakdown', [])
            high_mod_courses = [c for c in courses if c['modification_rate'] > 25]
            if high_mod_courses:
                insights.append({
                    'type': 'warning',
                    'title': 'Courses Needing Attention',
                    'message': f'{len(high_mod_courses)} courses have high modification rates.',
                    'recommendation': 'Review assignment design in these courses.',
                    'priority': 'medium',
                    'courses': [c['course_title'] for c in high_mod_courses[:3]]
                })
        
        except Exception as e:
            logger.error(f"Error generating instructor insights: {e}")
        
        return insights
    
    @staticmethod
    def generate_improvement_plan(analytics: Dict) -> Dict:
        """Generate an improvement plan based on analytics"""
        plan = {
            'immediate_actions': [],
            'short_term_goals': [],
            'long_term_objectives': [],
            'resources': []
        }
        
        try:
            summary = analytics.get('summary', {})
            mod_rate = summary.get('modification_rate', 0)
            success_rate = summary.get('resubmission_success_rate', 0)
            
            if mod_rate > 25:
                plan['immediate_actions'].extend([
                    'Review assignment instructions for clarity',
                    'Add detailed rubrics to all assignments',
                    'Provide examples of good submissions'
                ])
                
                plan['short_term_goals'].extend([
                    'Reduce modification rate by 10% within 4 weeks',
                    'Implement peer review before submission',
                    'Create assignment templates'
                ])
            
            if success_rate < 70:
                plan['immediate_actions'].extend([
                    'Improve feedback specificity',
                    'Use inline commenting tools',
                    'Schedule feedback sessions with struggling students'
                ])
                
                plan['short_term_goals'].extend([
                    'Increase resubmission success rate to 80%',
                    'Implement video feedback for complex issues',
                    'Create feedback templates for common issues'
                ])
            
            # Common resources
            plan['resources'].extend([
                'Assignment Design Best Practices Guide',
                'Effective Feedback Techniques Workshop',
                'Student Success Support Resources',
                'Rubric Development Tools'
            ])
            
            plan['long_term_objectives'].extend([
                'Achieve modification rate below 15%',
                'Maintain resubmission success rate above 85%',
                'Improve student satisfaction with feedback quality'
            ])
            
        except Exception as e:
            logger.error(f"Error generating improvement plan: {e}")
        
        return plan