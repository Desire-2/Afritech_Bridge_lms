"""Configurable Talent Passport rules.

Keeping weights and thresholds here (rather than scattered in services) makes
the completeness indicator transparent and lets deployments tune it without
changing application code.
"""

from ..utils.time_utils import now_local  # noqa: F401  (kept for parity with other modules)

# Transparent completeness weights. Deliberately modest: a full profile is not
# a claim of employability or of verified competence.
COMPLETENESS_WEIGHTS = {
    "basic_profile": 20,
    "professional_summary": 10,
    "career_interests": 10,
    "learning_records": 15,
    "skills_evidence": 20,
    "projects": 15,
    "certificates": 10,
}
COMPLETENESS_TOTAL = sum(COMPLETENESS_WEIGHTS.values())

# A skill is DEMONSTRATED only when an approved result reaches the mapped
# criterion. If a mapping does not define one, this is the fallback.
DEFAULT_DEMONSTRATION_SCORE = 70.0

# Passing score used by the canonical LMS certificate policy (CourseProgressService).
# This is read-only documentation of the LMS rule — the Passport never evaluates
# certificate eligibility itself.
LMS_CERTIFICATE_PASSING_SCORE = 70

# Public sharing defaults: private by default, all sections opt-in.
DEFAULT_VISIBILITY = {
    "is_published": False,
    "professional_profile": False,
    "skills": False,
    "projects": False,
    "certificates": False,
    "learning_history": False,
    "achievements": False,
    "show_email": False,
    "show_phone": False,
}

# Maximum page sizes for aggregate/paginated read endpoints.
MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 20

# Public view rate limit (in-process; the process-global limiter already used by
# certificate verification is the pattern followed here).
PUBLIC_VIEW_LIMIT_PER_MINUTE = 60

# Backend-owned PDF storage/verification settings. Values may be overridden in
# Flask config; they are never supplied by an HTTP client.
PDF_STORAGE_CONFIG_KEY = "TALENT_PASSPORT_PDF_STORAGE_DIR"
PDF_VERIFICATION_BASE_CONFIG_KEY = "TALENT_PASSPORT_VERIFICATION_BASE_URL"
