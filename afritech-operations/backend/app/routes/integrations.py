"""
LMS integration layer.

The standalone operations app connects to the AfriTech Bridge LMS through a
secure HTTP API. This blueprint exposes configuration endpoints and actors
that synchronise remote LMS entities into local mirrors (learners, cohorts,
courses, submissions, progress...).

Local records created by this layer are tagged with `source='local'|'lms'` and
lms IDs (`lms_course_id`, `lms_cohort_id`, `lms_user_id`...) so they can be
merged with LMS data without duplicating reference data.

Use the environment variables:
  LMS_API_URL     - base URL of the LMS API
  LMS_API_KEY     - shared secret/token. Sent as `Authorization: Bearer <key>`.
"""
import json
from datetime import date, datetime, timezone

import requests
from flask import Blueprint, request, jsonify, current_app

from ..extensions import db
from ..models import (
    LMSIntegration, Course, Cohort, Learner, Enrollment, Assignment,
    AssignmentSubmission, TeachingActivity, Notification, User, Setting,
)
from ..auth.auth import require_permission, current_user
from ..services.audit import audit
from .helpers import json_error, parse_json

bp = Blueprint('integrations', __name__, url_prefix='/api/integrations')


def _client(integration=None):
    base = integration.base_url if integration else current_app.config['LMS_API_URL']
    key = current_app.config['LMS_API_KEY']
    headers = {'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'}
    return base, headers


@bp.get('/lms/config')
@require_permission('integration.manage')
def get_config():
    integration = LMSIntegration.query.first()
    data = {
        'enabled': bool(integration and integration.status == 'enabled'),
        'base_url': integration.base_url if integration else current_app.config['LMS_API_URL'],
        'has_api_key': bool((integration and integration.api_key_encrypted) or current_app.config.get('LMS_API_KEY')),
        'last_sync_at': integration.last_sync_at.isoformat() if integration and integration.last_sync_at else None,
        'last_sync_status': integration.last_sync_status if integration else None,
    }
    return jsonify({'config': data})


@bp.post('/lms/config')
@require_permission('integration.manage')
def update_config():
    data = parse_json()
    integration = LMSIntegration.query.first()
    if not integration:
        integration = LMSIntegration(name='AfriTech Bridge LMS')
        db.session.add(integration)
    if 'base_url' in data and data['base_url']:
        integration.base_url = data['base_url'].rstrip('/')
    if 'api_key' in data and data['api_key']:
        integration.api_key_encrypted = 'current_app_key_used'  # does not persist secret locally by default
    if 'enabled' in data:
        integration.status = 'enabled' if data['enabled'] else 'disabled'
    db.session.commit()
    audit('lms_integration_updated', 'lms_integration', integration.id, new_value=data)
    return get_config()


@bp.post('/lms/health-check')
@require_permission('integration.manage')
def health_check():
    integration = LMSIntegration.query.first()
    base = current_app.config['LMS_API_URL']
    if integration and integration.base_url:
        base = integration.base_url
    if not base:
        return json_error('LMS API URL not configured', 400)
    try:
        resp = requests.get(f'{base}/api/health', headers={'Authorization': f"Bearer {current_app.config['LMS_API_KEY']}"}, timeout=current_app.config['LMS_API_TIMEOUT'])
        return jsonify({'reachable': True, 'status': resp.status_code, 'body': resp.text[:200]})
    except Exception as e:
        return jsonify({'reachable': False, 'error': str(e)}), 502


@bp.post('/lms/sync-courses')
@require_permission('integration.manage')
def sync_courses():
    integration = LMSIntegration.query.first()
    base = current_app.config['LMS_API_URL']
    if integration and integration.base_url:
        base = integration.base_url
    if not base:
        return json_error('LMS API URL not configured', 400)
    try:
        resp = requests.get(f'{base}/api/integration/courses', headers={'Authorization': f"Bearer {current_app.config['LMS_API_KEY']}"}, timeout=current_app.config['LMS_API_TIMEOUT'])
        if resp.status_code != 200:
            return json_error(f'LMS returned {resp.status_code}', 502)
        payload = resp.json()
        courses = payload.get('courses', payload) if isinstance(payload, dict) else payload
        created, updated = 0, 0
        for c in (courses or []):
            existing = Course.query.filter_by(lms_course_id=str(c.get('id'))).first()
            if not existing:
                seq = Course.query.count() + 1
                existing = Course(code=c.get('code') or f'LMS-C{seq:03d}', name=c.get('name', 'Unnamed'),
                                  lms_course_id=str(c.get('id')))
                db.session.add(existing)
                created += 1
            else:
                existing.name = c.get('name', existing.name)
                updated += 1
        db.session.commit()
        record_sync(integration, 'ok', f'{created} created, {updated} updated')
        audit('lms_sync', 'course', None, new_value={'created': created, 'updated': updated})
        return jsonify({'message': 'Course sync complete', 'created': created, 'updated': updated})
    except requests.exceptions.RequestException as e:
        return json_error(f'LMS unreachable: {e}', 502)


def record_sync(integration, status, detail=None):
    if integration:
        integration.last_sync_at = datetime.now(timezone.utc)
        integration.last_sync_status = f'{status}: {detail}' if detail else status


@bp.get('/lms/mapping')
@require_permission('integration.manage')
def mapping():
    courses = Course.query.filter(Course.lms_course_id.isnot(None)).all()
    cohorts = Cohort.query.filter(Cohort.lms_cohort_id.isnot(None)).all()
    learners = Learner.query.filter(Learner.lms_user_id.isnot(None)).all()
    return jsonify({
        'courses': [{'local_id': c.id, 'lms_id': c.lms_course_id, 'name': c.name} for c in courses],
        'cohorts': [{'local_id': c.id, 'lms_id': c.lms_cohort_id, 'name': c.name} for c in cohorts],
        'learners': [{'local_id': l.id, 'lms_id': l.lms_user_id, 'name': l.name} for l in learners],
    })