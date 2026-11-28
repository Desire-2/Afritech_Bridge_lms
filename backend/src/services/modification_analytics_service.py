"""
Analytics service specifically for modification requests and resubmission tracking
"""
import logging
from datetime import datetime, timedelta
from sqlalchemy import and_, or_, func, desc, case
from typing import Any, Dict, List, Optional
from collections import defaultdict

from ..models import db
from ..models.user_models import User
from ..models.course_models import Assignment, Project, Course, AssignmentSubmission, ProjectSubmission
from ..models.student_models import LessonCompletion
from .modification_service import _project_revision_rows, _project_revision_state

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

            assignment_query = Assignment.query.join(Course).filter(
                Course.instructor_id == instructor_id
            )
            project_query = Project.query.join(Course).filter(
                Course.instructor_id == instructor_id
            )
            if course_id:
                assignment_query = assignment_query.filter(
                    Assignment.course_id == course_id)
                project_query = project_query.filter(
                    Project.course_id == course_id)

            assignments = assignment_query.all()
            projects = project_query.all()
            assignment_ids = [a.id for a in assignments]
            total_items = len(assignments) + len(projects)

            assignment_with_mods = []
            assignment_requests = []
            if assignment_ids:
                assignment_with_mods = Assignment.query.filter(
                    Assignment.id.in_(assignment_ids),
                    Assignment.modification_requested.is_(True),
                ).all()
                assignment_requests = Assignment.query.filter(
                    Assignment.id.in_(assignment_ids),
                    Assignment.modification_requested.is_(True),
                    Assignment.modification_requested_at.between(start_date, end_date),
                ).all()

            project_rows = _project_revision_rows(
                instructor_id=instructor_id, course_id=course_id,
                start_date=start_date, end_date=end_date,
            )
            project_with_mods = _project_revision_rows(
                instructor_id=instructor_id, course_id=course_id,
            )

            with_mods = len(assignment_with_mods) + len({
                row.project_id for row, _, _, _ in project_with_mods
            })
            total_requests = len(assignment_requests) + len(project_rows)
            modification_rate = (
                with_mods / total_items * 100 if total_items else 0
            )

            successful = 0
            for assignment in assignment_requests:
                completed = LessonCompletion.query.filter(
                    LessonCompletion.lesson_id == assignment.lesson_id,
                    LessonCompletion.assignment_needs_resubmission == False,
                    LessonCompletion.is_resubmission == True,
                ).count()
                if completed > 0:
                    successful += 1
            for submission, project, _, _ in project_rows:
                state = _project_revision_state(submission, project)
                if submission.is_resubmission and not state['can_resubmit']:
                    successful += 1

            success_rate = (
                successful / total_requests * 100 if total_requests else 0
            )

            reason_counts = defaultdict(int)
            reasons = [a.modification_request_reason for a in assignment_requests]
            reasons.extend(
                _project_revision_state(row, project)['modification_request_reason']
                for row, project, _, _ in project_rows
            )
            for reason in reasons:
                if not reason:
                    continue
                text = reason.lower()
                if any(word in text for word in ['grammar', 'spelling', 'writing']):
                    reason_counts['Grammar/Writing Issues'] += 1
                elif any(word in text for word in ['format', 'structure', 'organization']):
                    reason_counts['Format/Structure'] += 1
                elif any(word in text for word in ['content', 'information', 'detail']):
                    reason_counts['Content Issues'] += 1
                elif any(word in text for word in ['reference', 'citation', 'source']):
                    reason_counts['References/Citations'] += 1
                elif any(word in text for word in ['incomplete', 'missing', 'unfinished']):
                    reason_counts['Incomplete Work'] += 1
                else:
                    reason_counts['Other'] += 1
            top_reasons = sorted(
                reason_counts.items(), key=lambda item: item[1], reverse=True,
            )[:5]

            course_map: Dict[int, Dict[str, Any]] = {}
            for course in Course.query.filter(Course.instructor_id == instructor_id).all():
                if course_id and course.id != course_id:
                    continue
                course_map[course.id] = {
                    'course_title': course.title,
                    'course_id': course.id,
                    'total_assignments': 0,
                    'total_projects': 0,
                    'modifications': 0,
                }
            for item in assignments:
                course_map.setdefault(item.course_id, {
                    'course_title': '', 'course_id': item.course_id,
                    'total_assignments': 0, 'total_projects': 0,
                    'modifications': 0,
                })['total_assignments'] += 1
            for item in projects:
                course_map.setdefault(item.course_id, {
                    'course_title': '', 'course_id': item.course_id,
                    'total_assignments': 0, 'total_projects': 0,
                    'modifications': 0,
                })['total_projects'] += 1
            for item in assignment_with_mods:
                course_map.setdefault(item.course_id, {
                    'course_title': '', 'course_id': item.course_id,
                    'total_assignments': 0, 'total_projects': 0,
                    'modifications': 0,
                })['modifications'] += 1
            for _, project, _, _ in project_with_mods:
                course_map.setdefault(project.course_id, {
                    'course_title': '', 'course_id': project.course_id,
                    'total_assignments': 0, 'total_projects': 0,
                    'modifications': 0,
                })['modifications'] += 1

            courses = []
            for data in course_map.values():
                total = data['total_assignments'] + data['total_projects']
                data['modification_rate'] = round(
                    (data['modifications'] / total * 100) if total else 0, 1,
                )
                courses.append(data)

            return {
                'summary': {
                    'total_assignments': len(assignments),
                    'assignments_with_modifications': len(assignment_with_mods),
                    'total_projects': len(projects),
                    'projects_with_modifications': len({
                        row.project_id for row, _, _, _ in project_with_mods
                    }),
                    'total_items': total_items,
                    'modification_rate': round(modification_rate, 1),
                    'total_modification_requests': total_requests,
                    'resubmission_success_rate': round(success_rate, 1),
                    'date_range': {
                        'start': start_date.isoformat(),
                        'end': end_date.isoformat(),
                    },
                },
                'top_modification_reasons': top_reasons,
                'course_breakdown': courses,
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
            
            # Platform totals include both assessments types.
            total_assignments = Assignment.query.count()
            total_projects = Project.query.count()
            assignment_mods = Assignment.query.filter(
                Assignment.modification_requested.is_(True),
            ).all()
            project_rows = _project_revision_rows(
                start_date=start_date, end_date=end_date,
            )
            project_mod_ids = {row.project_id for row, _, _, _ in project_rows}
            total_modifications = len(assignment_mods) + len(project_mod_ids)
            total_items = total_assignments + total_projects
            platform_modification_rate = (
                total_modifications / total_items * 100 if total_items else 0
            )

            # Instructor performance ranking
            instructor_stats = db.session.query(
                User.id,
                User.full_name,
            ).filter(User.role.has(name='instructor')).all()

            instructor_performance = []
            for user_id, name in instructor_stats:
                assignments = Assignment.query.join(Course).filter(
                    Course.instructor_id == user_id,
                ).count()
                projects = Project.query.join(Course).filter(
                    Course.instructor_id == user_id,
                ).count()
                mods = Assignment.query.join(Course).filter(
                    Course.instructor_id == user_id,
                    Assignment.modification_requested.is_(True),
                ).count() + len(_project_revision_rows(instructor_id=user_id))
                total = assignments + projects
                if not total:
                    continue
                instructor_performance.append({
                    'instructor_id': user_id,
                    'instructor_name': name,
                    'total_assignments': assignments,
                    'total_projects': projects,
                    'total_items': total,
                    'modifications': mods,
                    'modification_rate': round(mods / total * 100, 1),
                })
            
            instructor_performance.sort(key=lambda x: x['modification_rate'], reverse=True)
            
            return {
                'platform_summary': {
                    'total_assignments': total_assignments,
                    'total_projects': total_projects,
                    'total_items': total_items,
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