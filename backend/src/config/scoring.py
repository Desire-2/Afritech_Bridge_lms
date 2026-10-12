"""Central scoring / completion thresholds for the learning domain.

Single source of truth for every backend magic number. Frontend mirrors
these as documented fallbacks only (learningRules.ts) — the API surfaces
the effective values so a backend change cannot silently desync the UI.

Threshold meanings (do not conflate):
- LESSON  80: a lesson reaches completed status only at this score.
- MODULE  70: a module reaches completed status only at this weighted score.
- CERTIFICATE 70: overall course score required for certificate issuance.
- FINAL ASSESSMENT 70: passing score for a required module final assessment.
- QUIZ   70: default quiz passing score (Quiz.passing_score overrides).
- ASSIGNMENT 60: minimum assignment percentage that contributes to a score;
  submissions at/above this count, below it counts as failed for scoring.
"""

LESSON_PASSING_SCORE = 80.0
MODULE_PASSING_SCORE = 70.0
CERTIFICATE_PASSING_SCORE = 70.0
FINAL_ASSESSMENT_PASSING_SCORE = 70.0
QUIZ_PASSING_SCORE = 70.0
ASSIGNMENT_PASSING_SCORE = 60.0

# Lesson-score caps (intentional assessment-integrity rules — a capped
# lesson cannot reach LESSON_PASSING_SCORE until the blocker clears):
# - pending grading: an assignment is submitted but not yet graded; the
#   score is held just below the lesson threshold so the lesson cannot
#   auto-complete on unreviewed work, while still showing real progress.
# - failed assessments: a scored quiz/assignment below its passing mark.
PENDING_GRADING_SCORE_CAP = 70.0
FAILED_ASSESSMENT_LESSON_CAP = 60.0
FAILED_QUIZ_LESSON_CAP = 65.0

# Reading/engagement requirements feeding lesson scores.
READING_REQUIREMENT = 90.0
ENGAGEMENT_REQUIREMENT = 60.0

# Legacy aliases used across existing call sites.
DEFAULT_LESSON_PASSING_SCORE = LESSON_PASSING_SCORE
DEFAULT_MODULE_PASSING_SCORE = MODULE_PASSING_SCORE
DEFAULT_CERTIFICATE_PASSING_SCORE = CERTIFICATE_PASSING_SCORE
DEFAULT_FINAL_ASSESSMENT_PASSING_SCORE = FINAL_ASSESSMENT_PASSING_SCORE
DEFAULT_QUIZ_PASSING_SCORE = QUIZ_PASSING_SCORE
DEFAULT_ASSIGNMENT_PASSING_SCORE = ASSIGNMENT_PASSING_SCORE


def scoring_thresholds_payload() -> dict:
    """Effective thresholds for API responses (frontend display only)."""
    return {
        'lesson_passing_score': LESSON_PASSING_SCORE,
        'module_passing_score': MODULE_PASSING_SCORE,
        'certificate_passing_score': CERTIFICATE_PASSING_SCORE,
        'final_assessment_passing_score': FINAL_ASSESSMENT_PASSING_SCORE,
        'quiz_passing_score': QUIZ_PASSING_SCORE,
        'assignment_passing_score': ASSIGNMENT_PASSING_SCORE,
    }
