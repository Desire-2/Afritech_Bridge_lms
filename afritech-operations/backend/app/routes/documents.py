"""Administrative document library: upload, list, download, delete.

Storage is deliberately boring — every file lands in a dedicated folder under
``UPLOAD_FOLDER`` with a generated name, so the on-disk name can never be
injected by the client (``secure_filename`` plus a generated prefix).
"""

import os
from datetime import datetime, timezone

from flask import Blueprint, request, jsonify, current_app, send_file
from werkzeug.utils import secure_filename

from ..extensions import db
from ..models import Document, DOCUMENT_CATEGORIES
from ..auth.auth import require_permission, require_any_permission, current_user
from ..services.audit import audit
from .helpers import json_error, paginate, paginate_response, parse_id

bp = Blueprint('documents', __name__, url_prefix='/api/documents')

ALLOWED_EXTENSIONS = {
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    'txt', 'csv', 'png', 'jpg', 'jpeg', 'webp',
}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024


def _extension(filename):
    return filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''


def _folder():
    folder = os.path.join(current_app.config['UPLOAD_FOLDER'], 'documents')
    os.makedirs(folder, exist_ok=True)
    return folder


def _store(file, folder):
    """Save an upload and return its generated on-disk name."""
    safe = secure_filename(file.filename) or 'document'
    stamp = datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')
    name = f'{stamp}_{safe}'
    file.save(os.path.join(folder, name))
    return name


def _resolve(document_id):
    return Document.query.get(document_id)


def _remove_file(document):
    """Best-effort delete of the stored file; a missing file is not an error."""
    try:
        path = os.path.join(current_app.config['UPLOAD_FOLDER'], 'documents', document.stored_name)
        if os.path.isfile(path):
            os.remove(path)
    except OSError:
        pass


@bp.get('')
@require_any_permission('documents.view', 'documents.manage')
def list_documents():
    q = Document.query
    category = request.args.get('category')
    if category:
        if category not in DOCUMENT_CATEGORIES:
            return json_error(f'Invalid category (expected one of {", ".join(DOCUMENT_CATEGORIES)})', 400)
        q = q.filter_by(category=category)
    extension = request.args.get('extension')
    if extension:
        q = q.filter(Document.file_name.ilike(f'%.{extension.lower()}'))
    meeting_id, err = parse_id(request.args.get('meeting_id'), 'meeting_id')
    if err:
        return err
    if meeting_id:
        q = q.filter_by(meeting_id=meeting_id)
    activity_id, err = parse_id(request.args.get('activity_id'), 'activity_id')
    if err:
        return err
    if activity_id:
        q = q.filter_by(activity_id=activity_id)
    search = request.args.get('search')
    if search:
        like = f'%{search}%'
        q = q.filter(db.or_(Document.title.ilike(like), Document.file_name.ilike(like)))
    p = paginate(q.order_by(Document.created_at.desc()))
    return paginate_response([d.to_dict() for d in p.items], p)


@bp.post('')
@require_permission('documents.manage')
def upload_document():
    user = current_user()
    file = request.files.get('file')
    if file is None or not file.filename:
        return json_error('A file is required', 400)

    ext = _extension(file.filename)
    if ext not in ALLOWED_EXTENSIONS:
        return json_error(
            f'Unsupported file type "{ext or "unknown"}" '
            f'(allowed: {", ".join(sorted(ALLOWED_EXTENSIONS))})', 400)

    title = (request.form.get('title') or '').strip() or os.path.basename(file.filename)
    category = request.form.get('category') or 'administrative'
    if category not in DOCUMENT_CATEGORIES:
        return json_error(f'Invalid category (expected one of {", ".join(DOCUMENT_CATEGORIES)})', 400)
    meeting_id, err = parse_id(request.form.get('meeting_id'), 'meeting_id')
    if err:
        return err
    activity_id, err = parse_id(request.form.get('activity_id'), 'activity_id')
    if err:
        return err

    folder = _folder()
    stored_name = _store(file, folder)
    path = os.path.join(folder, stored_name)
    size = os.path.getsize(path)
    if size > MAX_UPLOAD_BYTES:
        os.remove(path)
        return json_error(f'File is too large (max {MAX_UPLOAD_BYTES // (1024 * 1024)} MB)', 400)

    doc = Document(
        title=title,
        description=request.form.get('description'),
        category=category,
        file_name=os.path.basename(file.filename),
        stored_name=stored_name,
        content_type=file.mimetype,
        size_bytes=size,
        meeting_id=meeting_id,
        activity_id=activity_id,
        uploaded_by=user.id,
    )
    db.session.add(doc)
    db.session.commit()
    audit('document_uploaded', 'document', doc.id, new_value=doc.to_dict())
    return jsonify({'message': 'Document uploaded', 'document': doc.to_dict()}), 201


@bp.get('/<int:document_id>')
@require_any_permission('documents.view', 'documents.manage')
def get_document(document_id):
    doc = _resolve(document_id)
    if not doc:
        return json_error('Document not found', 404)
    return jsonify({'document': doc.to_dict()})


@bp.get('/<int:document_id>/download')
@require_any_permission('documents.view', 'documents.manage')
def download_document(document_id):
    doc = _resolve(document_id)
    if not doc:
        return json_error('Document not found', 404)
    path = os.path.join(current_app.config['UPLOAD_FOLDER'], 'documents', doc.stored_name)
    if not os.path.isfile(path):
        return json_error('Stored file is missing', 410)
    # Every download is logged: these are the administrative records the
    # Secretary is accountable for.
    audit('document_downloaded', 'document', doc.id, new_value={'file_name': doc.file_name})
    return send_file(path, mimetype=doc.content_type or 'application/octet-stream',
                     as_attachment=True, download_name=doc.file_name)


@bp.put('/<int:document_id>')
@require_permission('documents.manage')
def update_document(document_id):
    doc = _resolve(document_id)
    if not doc:
        return json_error('Document not found', 404)
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return json_error('Expected a JSON object', 400)
    prev = doc.to_dict()
    if 'title' in data:
        doc.title = data['title']
    if 'description' in data:
        doc.description = data['description']
    if 'category' in data:
        if data['category'] not in DOCUMENT_CATEGORIES:
            return json_error(f'Invalid category (expected one of {", ".join(DOCUMENT_CATEGORIES)})', 400)
        doc.category = data['category']
    for field in ('meeting_id', 'activity_id'):
        if field in data:
            parsed, err = parse_id(data[field], field)
            if err:
                return err
            setattr(doc, field, parsed)
    db.session.commit()
    audit('document_updated', 'document', doc.id, prev, doc.to_dict())
    return jsonify({'message': 'Document updated', 'document': doc.to_dict()})


@bp.delete('/<int:document_id>')
@require_permission('documents.manage')
def delete_document(document_id):
    doc = _resolve(document_id)
    if not doc:
        return json_error('Document not found', 404)
    data = doc.to_dict()
    _remove_file(doc)
    db.session.delete(doc)
    db.session.commit()
    audit('document_deleted', 'document', document_id, previous_value=data)
    return jsonify({'message': 'Document deleted'})