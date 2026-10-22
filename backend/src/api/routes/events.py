"""Integration event log (reconciliation for webhook consumers)."""

from __future__ import annotations

from flask import request

from ...models.integration_models import ApiEvent
from .. import api_bp
from ..auth import require
from ..constants import SUPPORTED_EVENT_TYPES
from ..errors import validation_error
from ..pagination import paginate_query
from ..responses import paginated
from ..serialization import isoify


@api_bp.route("/events", methods=["GET"])
@require(scopes=["events:read"], user=True)
def list_events():
    """Paginated integration event log with type/since filters.

    Useful for reconciliation when a webhook was missed or needs to be
    re-fetched out of band.
    """
    query = ApiEvent.query

    event_type = (request.args.get("type") or "").strip()
    if event_type:
        if event_type != "*" and event_type not in SUPPORTED_EVENT_TYPES:
            raise validation_error("Invalid type filter.",
                                   [{"field": "type",
                                     "issue": "unsupported event type"}])
        query = query.filter_by(type=event_type)

    subject_type = (request.args.get("subject_type") or "").strip()
    if subject_type:
        query = query.filter_by(subject_type=subject_type)

    subject_id = (request.args.get("subject_id") or "").strip()
    if subject_id:
        query = query.filter_by(subject_id=subject_id)

    since = request.args.get("since")
    if since:
        from ..pagination import parse_iso_datetime
        parsed = parse_iso_datetime(since, "since")
        if parsed is not None:
            query = query.filter(ApiEvent.created_at >= parsed)

    items, pagination = paginate_query(
        query.order_by(ApiEvent.created_at.desc(), ApiEvent.id.desc()),
        args=request.args)
    return paginated([isoify(e.to_dict()) for e in items], pagination)
