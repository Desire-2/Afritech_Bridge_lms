"""Certificates: read, request issuance, public verification."""

from __future__ import annotations

from flask import request

from ...services.certificate_service import CertificateService
from .. import api_bp
from ..auth import current_user, require
from ..errors import ApiError
from ..responses import ok, paginated
from ..serialization import isoify


@api_bp.route("/me/certificates", methods=["GET"])
@require(scopes=["certificates:read"], user=True)
def list_my_certificates():
    """The authenticated learner's certificates (plus completion records)."""
    user = current_user()
    page, per_page = _page_params()
    payload = CertificateService.get_student_certificates(user.id, include_completion=True)

    total = len(payload)
    total_pages = max(1, -(-total // per_page)) if total else 0
    window = payload[(page - 1) * per_page: page * per_page]
    return paginated(isoify(window), {
        "page": page, "per_page": per_page,
        "total_items": total, "total_pages": total_pages,
    })


def _page_params():
    try:
        page = max(1, int(request.args.get("page", "1")))
        per_page = min(100, max(1, int(request.args.get("per_page", "20"))))
    except (TypeError, ValueError):
        raise ApiError("VALIDATION_ERROR", "Invalid pagination parameter.", 400,
                       details=[{"field": "page", "issue": "must be an integer ≥ 1"}])
    return page, per_page


@api_bp.route("/me/courses/<int:course_id>/certificates", methods=["POST"])
@require(scopes=["certificates:issue"], user=True)
def issue_my_certificate(course_id: int):
    """Request a certificate when the LMS eligibility rules pass."""
    user = current_user()
    success, message, payload = CertificateService.generate_certificate(
        user.id, course_id)

    if success:
        # The service already emitted certificate.issued for every new issue.
        return ok(isoify(payload), meta={"message": message})

    if isinstance(payload, dict) and payload.get("error_code") == "NOT_ENROLLED":
        raise ApiError("NOT_FOUND", message, 404)

    details = []
    if isinstance(payload, dict):
        if payload.get("error_code"):
            details.append({"platform_error_code": payload["error_code"]})
        if payload.get("summary"):
            details.append({"summary": payload["summary"]})
        if payload.get("next_steps"):
            details.append({"next_steps": payload["next_steps"]})
        requirements = {k: v for k, v in payload.items()
                        if k in ("eligible", "all_modules_completed",
                                 "content_complete", "overall_score",
                                 "passing_score", "completed_modules",
                                 "total_modules", "final_assessment_required",
                                 "final_assessment_passed")}
        if requirements:
            details.append({"requirements": requirements})

    raise ApiError("NOT_ELIGIBLE", message, 400, details=details)


@api_bp.route("/certificates/<certificate_number>/verify", methods=["GET"])
def verify_certificate(certificate_number: str):
    """Public certificate verification (no credentials required)."""
    valid, message, data = CertificateService.verify_certificate(certificate_number)
    if valid:
        return ok(isoify(data), meta={"message": message, "valid": True})
    raise ApiError("NOT_FOUND" if "not found" in message.lower() else "VALIDATION_ERROR",
                   message, 404 if "not found" in message.lower() else 400)
