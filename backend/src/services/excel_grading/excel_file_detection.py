"""Shared Excel-submission predicates.

The auto-grader, the grading service and AAGE's submission dispatcher used to
carry slightly different copies of these rules.  That let a submission pass
the trigger but fail inside the service with ``no_excel_files``, after AAGE had
already been suppressed.  One implementation now decides which engine owns a
submission.
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List
from urllib.parse import unquote, urlparse

EXCEL_EXTENSIONS = {'.xlsx', '.xlsm', '.xls', '.csv'}
EXCEL_COURSE_KEYWORDS = (
    'ms excel',
    'microsoft excel',
    'excel',
    'spreadsheet',
    'spreadsheets',
)

_FILENAME_KEYS = (
    'original_filename',
    'filename',
    'name',
    'file_name',
    'path',
    'pathname',
)
_URL_KEYS = ('url', 'view_link', 'download_link', 'download_url', 'file_path')


def course_is_excel(course: Any) -> bool:
    """Whether this course is explicitly an Excel/spreadsheet course."""
    if not course:
        return False
    title = str(getattr(course, 'title', '') or '').lower()
    description = str(getattr(course, 'description', '') or '').lower()
    combined = f"{title} {description}"
    return any(keyword in combined for keyword in EXCEL_COURSE_KEYWORDS)


def file_name_from_info(file_info: Dict[str, Any]) -> str:
    """Resolve a usable filename from any supported file-metadata shape."""
    for key in _FILENAME_KEYS:
        value = file_info.get(key)
        if value:
            return str(value)

    for key in _URL_KEYS:
        value = file_info.get(key)
        if not value:
            continue
        raw = str(value)
        path = urlparse(raw).path or raw.split('?', 1)[0]
        name = unquote(os.path.basename(path.rstrip('/')))
        if name:
            return name
    return ''


def has_excel_extension(name: Any) -> bool:
    """Check an extension without being confused by URL query strings."""
    cleaned = str(name or '').lower().split('?', 1)[0].split('#', 1)[0]
    return any(cleaned.endswith(ext) for ext in EXCEL_EXTENSIONS)


def normalize_submission_files(files_data: Any) -> List[Dict[str, Any]]:
    """Normalise the raw file field into a list of file dictionaries."""
    if not files_data:
        return []

    if isinstance(files_data, str):
        try:
            parsed = json.loads(files_data)
        except (json.JSONDecodeError, TypeError):
            parsed = [{'url': files_data}]
    elif isinstance(files_data, dict):
        parsed = [files_data]
    elif isinstance(files_data, (list, tuple)):
        parsed = list(files_data)
    else:
        return []

    files: List[Dict[str, Any]] = []
    for item in parsed:
        if isinstance(item, dict):
            info = dict(item)
        elif isinstance(item, str):
            info = {'url': item}
        else:
            continue

        name = file_name_from_info(info)
        if name:
            info.setdefault('filename', name)
            info.setdefault('original_filename', name)
        files.append(info)
    return files


def excel_submission_files(files_data: Any) -> List[Dict[str, Any]]:
    """Return only the workbook-like files from a submission payload."""
    return [
        info for info in normalize_submission_files(files_data)
        if has_excel_extension(
            info.get('original_filename') or info.get('filename') or ''
        )
    ]


def has_excel_files(files_data: Any) -> bool:
    """Whether the submission contains at least one gradable workbook."""
    return bool(excel_submission_files(files_data))
