"""Constants for the /api/v2 integration API."""

API_VERSION = "v2"
API_VERSION_HEADER = "X-API-Version"

#: All scopes a key can carry. ``auth:token`` gates the token endpoint; the
#: remaining scopes map one-to-one onto endpoint groups (see docs/api/authentication.md).
SCOPES = {
    "auth:token": "Mint user access/refresh tokens for your integration.",
    "profile:read": "Read the authenticated user's profile.",
    "profile:write": "Update the authenticated user's profile.",
    "courses:read": "Read courses, modules, lessons and teaching course lists.",
    "enrollments:read": "Read the authenticated learner's enrollments.",
    "enrollments:write": "Create enrollments for the authenticated learner.",
    "applications:read": "Read the authenticated learner's course applications.",
    "applications:write": "Submit course applications for the authenticated learner.",
    "progress:read": "Read learning progress and completion state.",
    "progress:write": "Record lesson completion and video progress.",
    "assessments:read": "Read quizzes and assessment instructions.",
    "assessments:write": "Submit quiz attempts.",
    "submissions:read": "Read submissions and grading feedback.",
    "submissions:write": "Submit assignments and projects.",
    "grades:read": "Read grading queues and student results (instructor scope).",
    "grades:write": "Grade submissions (instructor scope).",
    "certificates:read": "Read the authenticated learner's certificates.",
    "certificates:issue": "Request certificate issuance when LMS eligibility rules pass.",
    "reports:read": "Read organization-level reports (admin scope).",
    "webhooks:manage": "Manage webhook subscriptions and replay deliveries.",
    "events:read": "Read the integration event log for reconciliation.",
}

#: Default rate limits (requests per window). Overridable via env in ratelimit.py.
RATE_LIMIT_PUBLIC_PER_MINUTE = 60
RATE_LIMIT_AUTHENTICATED_PER_MINUTE = 300
RATE_LIMIT_TOKEN_ENDPOINT_PER_MINUTE = 10

#: Paths (under /api/v2) that bypass the request rate limiter entirely.
RATE_LIMIT_EXEMPT_PATHS = {"/api/v2/health"}

#: Stricter per-path limits (path -> (limit, window_seconds)).
RATE_LIMIT_PATH_OVERRIDES = {
    "/api/v2/auth/token": (10, 60),
}

MAX_PER_PAGE = 100
DEFAULT_PER_PAGE = 20

#: Webhook delivery tuning.
WEBHOOK_MAX_ATTEMPTS = 5
WEBHOOK_TIMEOUT_SECONDS = 10
WEBHOOK_SIGNATURE_TOLERANCE_SECONDS = 300

SUPPORTED_EVENT_TYPES = [
    "application.submitted",
    "application.approved",
    "application.rejected",
    "enrollment.created",
    "course.completed",
    "submission.graded",
    "certificate.issued",
    "payment.verified",
]
