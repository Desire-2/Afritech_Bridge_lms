"""Shared file-metadata handling for assignment and project submissions.

The frontend uploads files to Vercel Blob (``POST /api/upload``) and only sends
the returned metadata to the Flask API.  Assignments have always stored that
metadata as a JSON array in ``AssignmentSubmission.file_url``; projects used to
store a single bare URL in ``ProjectSubmission.file_path``.  These helpers make
both submission types accept and return the same shape:

    [{"url": "https://....public.blob.vercel-storage.com/...",
      "filename": "report.pdf", "size": 123, "contentType": "application/pdf",
      "uploadedAt": "...", "storage": "vercel_blob"}]

Legacy values (a bare URL string, Google Drive records, ``name`` instead of
``filename``) are still read correctly so existing submissions keep working.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Tuple

# Metadata copied through when the frontend provides it.  Keys are kept as-is
# so the grading surfaces that already understand Google Drive records do not
# have to learn a second naming convention.
_COPY_KEYS = (
    "size",
    "contentType",
    "content_type",
    "uploadedAt",
    "uploaded_at",
    "storage",
    "file_id",
    "downloadUrl",
    "download_url",
)


def _name_from_url(url: str) -> str:
    return url.rstrip("/").rsplit("/", 1)[-1] or "submission_file"


def parse_submission_files(
    raw: Any, fallback_name: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Return a list of file records from any stored/external representation."""
    if not raw:
        return []

    if isinstance(raw, dict):
        parsed: Any = [raw]
    elif isinstance(raw, list):
        parsed = raw
    elif isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except (TypeError, ValueError):
            parsed = None
    else:
        parsed = None

    files: List[Dict[str, Any]] = []
    if isinstance(parsed, dict):
        parsed = [parsed]
    if isinstance(parsed, list):
        for item in parsed:
            if isinstance(item, str):
                url = item.strip()
                if url:
                    files.append({"url": url, "filename": _name_from_url(url)})
                continue
            if not isinstance(item, dict):
                continue
            url = str(
                item.get("url")
                or item.get("view_link")
                or item.get("file_path")
                or ""
            ).strip()
            if not url:
                continue
            filename = (
                item.get("filename")
                or item.get("name")
                or item.get("file_name")
                or _name_from_url(url)
            )
            record: Dict[str, Any] = {"url": url, "filename": str(filename)}
            for key in _COPY_KEYS:
                if item.get(key) is not None:
                    record[key] = item[key]
            files.append(record)

    if not files and isinstance(raw, str) and raw.strip():
        url = raw.strip()
        files.append({"url": url, "filename": fallback_name or _name_from_url(url)})

    return files


def serialize_submission_files(
    data: Any,
    keys: Tuple[str, ...] = ("files", "file_url", "file_path"),
) -> Optional[str]:
    """Build the JSON metadata column value from a submission request body.

    ``files`` (the assignment/project upload shape) wins; a legacy bare
    ``file_url``/``file_path`` is accepted from older clients.  ``None`` means
    the request carried no usable file.
    """
    if not hasattr(data, "get"):
        return None
    for key in keys:
        value = data.get(key)
        if not value:
            continue
        files = parse_submission_files(value)
        if files:
            return json.dumps(files)
    return None
