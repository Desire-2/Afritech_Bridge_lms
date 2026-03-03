"""
Experience Learning Engine

Gives the AI grading agent the ability to *learn from experience*:

1. **Instructor Feedback Loop** — When an instructor overrides or adjusts an
   AI grade, the delta (AI score → instructor score) is recorded.  Over time
   the system learns calibration adjustments per assignment type.

2. **Rubric Memory** — Generated rubrics that are approved by instructors
   (implicitly via approving the grade) are cached and reused for similar
   future assignments, avoiding regeneration.

3. **Pattern Recognition** — Common grading patterns (e.g. "students in
   Module X typically score low on formatting") are surfaced as insights
   and fed back into the grading pipeline.

4. **Confidence Calibration** — The system tracks its own accuracy over time
   and adjusts confidence levels accordingly.

Storage: Uses ``GradingExperience`` and ``GeneratedRubric`` DB models.
"""

import logging
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger(__name__)


class LearningEngine:
    """
    Manages the AI grading agent's learning loop.

    Call ``record_experience()`` after every grading + review cycle.
    Call ``get_insights()`` before grading to benefit from past experience.
    """

    # ------------------------------------------------------------------
    # Public: Record experience
    # ------------------------------------------------------------------

    def record_grading_outcome(
        self,
        grading_result_id: int,
        assignment_id: int,
        course_id: int,
        module_id: Optional[int],
        ai_score: float,
        ai_max_score: float,
        instructor_action: str,  # 'approve' | 'override'
        instructor_score: Optional[float] = None,
        instructor_notes: str = '',
        rubric_used: Optional[Dict] = None,
        requirements_used: Optional[Dict] = None,
        analysis_summary: Optional[Dict] = None,
    ):
        """
        Record the outcome of a grading + instructor review cycle.

        Should be called from the review endpoint after the instructor
        approves or overrides.
        """
        from src.models.user_models import db
        from src.models.excel_grading_models import GradingExperience

        try:
            # Compute score delta (how far off the AI was)
            final_score = instructor_score if instructor_score is not None else ai_score
            score_delta = final_score - ai_score
            ai_percentage = (ai_score / max(ai_max_score, 1)) * 100
            final_percentage = (final_score / max(ai_max_score, 1)) * 100

            experience = GradingExperience(
                grading_result_id=grading_result_id,
                assignment_id=assignment_id,
                course_id=course_id,
                module_id=module_id,
                ai_score=ai_score,
                ai_max_score=ai_max_score,
                instructor_action=instructor_action,
                instructor_score=instructor_score,
                score_delta=score_delta,
                instructor_notes=instructor_notes,
                rubric_snapshot=rubric_used,
                requirements_snapshot=requirements_used,
                analysis_summary=analysis_summary,
                recorded_at=datetime.utcnow(),
            )

            db.session.add(experience)
            db.session.commit()

            logger.info(
                f"Learning: recorded experience for result #{grading_result_id} — "
                f"AI={ai_percentage:.1f}%, Final={final_percentage:.1f}%, "
                f"delta={score_delta:+.1f}, action={instructor_action}"
            )

            return experience

        except Exception as e:
            logger.error(f"Failed to record grading experience: {e}")
            db.session.rollback()
            return None

    # ------------------------------------------------------------------
    # Public: Save / retrieve generated rubrics
    # ------------------------------------------------------------------

    def save_generated_rubric(
        self,
        assignment_id: int,
        course_id: int,
        module_id: Optional[int],
        rubric_data: Dict[str, Any],
        instructions_hash: str,
    ) -> Optional[int]:
        """Save a generated rubric for future reuse."""
        from src.models.user_models import db
        from src.models.excel_grading_models import GeneratedRubric

        try:
            # Check if one already exists for this assignment
            existing = GeneratedRubric.query.filter_by(
                assignment_id=assignment_id,
            ).first()

            if existing:
                # Update it
                existing.rubric_data = rubric_data
                existing.instructions_hash = instructions_hash
                existing.times_used = (existing.times_used or 0) + 1
                existing.updated_at = datetime.utcnow()
                db.session.commit()
                return existing.id

            rubric_record = GeneratedRubric(
                assignment_id=assignment_id,
                course_id=course_id,
                module_id=module_id,
                rubric_data=rubric_data,
                instructions_hash=instructions_hash,
                generation_method=rubric_data.get('generation_method', 'instruction_analysis'),
                times_used=1,
                approved=False,
                created_at=datetime.utcnow(),
            )

            db.session.add(rubric_record)
            db.session.commit()
            return rubric_record.id

        except Exception as e:
            logger.error(f"Failed to save generated rubric: {e}")
            db.session.rollback()
            return None

    def get_cached_rubric(self, assignment_id: int, instructions_hash: str) -> Optional[Dict]:
        """
        Retrieve a previously generated rubric for this assignment if the
        instructions haven't changed (hash match).
        """
        from src.models.excel_grading_models import GeneratedRubric

        try:
            rubric_record = GeneratedRubric.query.filter_by(
                assignment_id=assignment_id,
                instructions_hash=instructions_hash,
            ).first()

            if rubric_record:
                # Increment usage counter
                from src.models.user_models import db
                rubric_record.times_used = (rubric_record.times_used or 0) + 1
                rubric_record.last_used_at = datetime.utcnow()
                db.session.commit()

                logger.info(
                    f"Learning: reusing cached rubric for assignment #{assignment_id} "
                    f"(used {rubric_record.times_used} times, approved={rubric_record.approved})"
                )
                return rubric_record.rubric_data

        except Exception as e:
            logger.debug(f"Could not retrieve cached rubric: {e}")

        return None

    def mark_rubric_approved(self, assignment_id: int):
        """Mark a generated rubric as approved (when instructor approves the grade)."""
        from src.models.excel_grading_models import GeneratedRubric
        from src.models.user_models import db

        try:
            rubric_record = GeneratedRubric.query.filter_by(
                assignment_id=assignment_id,
            ).order_by(GeneratedRubric.created_at.desc()).first()

            if rubric_record and not rubric_record.approved:
                rubric_record.approved = True
                rubric_record.approved_at = datetime.utcnow()
                db.session.commit()
                logger.info(f"Learning: rubric for assignment #{assignment_id} marked as approved")
        except Exception as e:
            logger.debug(f"Could not mark rubric approved: {e}")

    # ------------------------------------------------------------------
    # Public: Get insights for grading
    # ------------------------------------------------------------------

    def get_insights(
        self,
        assignment_id: int,
        course_id: int,
        module_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Get learning insights to improve grading accuracy.

        Returns:
          - calibration_offset: suggested score adjustment based on past overrides
          - confidence_hint: 'high' | 'medium' | 'low' for this assignment type
          - avg_override_delta: average score difference when instructors override
          - pattern_notes: list of observed patterns
          - sample_size: how many past experiences inform these insights
        """
        from src.models.excel_grading_models import GradingExperience

        insights = {
            'calibration_offset': 0.0,
            'confidence_hint': None,
            'avg_override_delta': 0.0,
            'pattern_notes': [],
            'sample_size': 0,
        }

        try:
            # 1) Assignment-specific history
            experiences = GradingExperience.query.filter_by(
                assignment_id=assignment_id,
            ).order_by(GradingExperience.recorded_at.desc()).limit(50).all()

            if not experiences:
                # Fall back to module-level history
                if module_id:
                    experiences = GradingExperience.query.filter_by(
                        module_id=module_id,
                    ).order_by(GradingExperience.recorded_at.desc()).limit(50).all()

            if not experiences:
                # Fall back to course-level history
                experiences = GradingExperience.query.filter_by(
                    course_id=course_id,
                ).order_by(GradingExperience.recorded_at.desc()).limit(50).all()

            if not experiences:
                return insights

            insights['sample_size'] = len(experiences)

            # 2) Calculate average override delta
            overrides = [e for e in experiences if e.instructor_action == 'override']
            if overrides:
                avg_delta = sum(e.score_delta for e in overrides) / len(overrides)
                insights['avg_override_delta'] = round(avg_delta, 2)
                insights['calibration_offset'] = round(avg_delta * 0.5, 2)  # conservative 50% correction

                if avg_delta > 5:
                    insights['pattern_notes'].append(
                        f"AI tends to undergrade by ~{abs(avg_delta):.1f} pts. "
                        f"Calibration offset of +{insights['calibration_offset']:.1f} applied."
                    )
                elif avg_delta < -5:
                    insights['pattern_notes'].append(
                        f"AI tends to overgrade by ~{abs(avg_delta):.1f} pts. "
                        f"Calibration offset of {insights['calibration_offset']:.1f} applied."
                    )

            # 3) Confidence calibration
            approve_rate = sum(1 for e in experiences if e.instructor_action == 'approve') / max(len(experiences), 1)
            if approve_rate > 0.8 and len(experiences) >= 5:
                insights['confidence_hint'] = 'high'
                insights['pattern_notes'].append(
                    f"High approval rate ({approve_rate:.0%}) across {len(experiences)} reviews."
                )
            elif approve_rate < 0.4:
                insights['confidence_hint'] = 'low'
                insights['pattern_notes'].append(
                    f"Low approval rate ({approve_rate:.0%}). Grading may need recalibration."
                )

            # 4) Common instructor notes patterns
            notes_with_content = [e.instructor_notes for e in experiences if e.instructor_notes and len(e.instructor_notes) > 10]
            if notes_with_content:
                insights['pattern_notes'].append(
                    f"{len(notes_with_content)} instructor feedback note(s) available for learning."
                )

        except Exception as e:
            logger.debug(f"Could not compute insights: {e}")

        return insights

    # ------------------------------------------------------------------
    # Public: Apply calibration to grading result
    # ------------------------------------------------------------------

    def apply_calibration(
        self,
        grading_result: Dict[str, Any],
        insights: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Apply experience-based calibration to a grading result.

        Adjusts the total score by the calibration offset (derived from
        past instructor overrides), then recalculates percentage and grade.
        """
        offset = insights.get('calibration_offset', 0.0)
        if abs(offset) < 0.5:
            return grading_result  # no meaningful adjustment

        from .grading_engine import compute_grade_letter

        old_score = grading_result.get('total_score', 0)
        max_score = grading_result.get('max_score', 100)

        new_score = round(max(0, min(max_score, old_score + offset)), 1)
        new_pct = round(new_score / max(max_score, 1) * 100, 1)
        new_grade = compute_grade_letter(new_pct)

        grading_result['total_score'] = new_score
        grading_result['percentage'] = new_pct
        grading_result['grade'] = new_grade
        grading_result['calibration_applied'] = {
            'offset': offset,
            'original_score': old_score,
            'sample_size': insights.get('sample_size', 0),
            'reason': 'experience_based_calibration',
        }

        # Adjust confidence based on experience
        hint = insights.get('confidence_hint')
        if hint:
            grading_result['confidence'] = hint

        logger.info(
            f"Learning: calibration applied — {old_score:.1f} → {new_score:.1f} "
            f"(offset={offset:+.1f}, samples={insights.get('sample_size', 0)})"
        )

        return grading_result

    # ------------------------------------------------------------------
    # Public: Statistics
    # ------------------------------------------------------------------

    def get_learning_stats(self, course_id: int) -> Dict[str, Any]:
        """Get aggregate learning statistics for a course."""
        from src.models.excel_grading_models import GradingExperience, GeneratedRubric

        try:
            experiences = GradingExperience.query.filter_by(course_id=course_id).all()
            rubrics = GeneratedRubric.query.filter_by(course_id=course_id).all()

            if not experiences:
                return {
                    'total_experiences': 0,
                    'total_rubrics_generated': len(rubrics),
                    'message': 'No grading experience yet — the AI will improve as instructors review grades.',
                }

            overrides = [e for e in experiences if e.instructor_action == 'override']
            approvals = [e for e in experiences if e.instructor_action == 'approve']

            avg_delta = sum(e.score_delta for e in overrides) / max(len(overrides), 1) if overrides else 0

            return {
                'total_experiences': len(experiences),
                'total_approvals': len(approvals),
                'total_overrides': len(overrides),
                'approval_rate': round(len(approvals) / max(len(experiences), 1) * 100, 1),
                'avg_override_delta': round(avg_delta, 2),
                'total_rubrics_generated': len(rubrics),
                'rubrics_approved': sum(1 for r in rubrics if r.approved),
                'latest_experience': max((e.recorded_at for e in experiences), default=None),
            }

        except Exception as e:
            logger.debug(f"Could not compute stats: {e}")
            return {'error': str(e)}
