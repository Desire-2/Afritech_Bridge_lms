"""Regression coverage for HTML files submitted as student work.

The shared downloader treats any text/html response as a possible login wall.
That is correct for spreadsheet URLs, but it silently discarded real
``.html`` submissions, leaving AAGE's ``STUDENT_SUBMISSION.files`` empty.
"""

import requests

from src.services.aage.artifacts import ArtifactAnalyzer
from src.services.excel_grading.excel_grading_service import ExcelGradingService

HTML = b"<!DOCTYPE html><html><body><form id='contact'></form></body></html>"
BLOB_URL = "https://example.public.blob.vercel-storage.com/assignments/3/student/contact_form.html"


class FakeResponse:
    headers = {"Content-Type": "text/html", "Content-Length": str(len(HTML))}

    def raise_for_status(self):
        return None

    def iter_content(self, chunk_size=1024):
        yield HTML


def _file_info():
    return {
        "url": BLOB_URL,
        "filename": "contact_form.html",
        "contentType": "text/html",
        "size": len(HTML),
        "storage": "vercel_blob",
    }


def test_html_response_is_still_rejected_without_explicit_metadata(monkeypatch):
    monkeypatch.setattr(requests, "get", lambda *a, **k: FakeResponse())
    assert ExcelGradingService._download_from_url(BLOB_URL) is None


def test_html_response_is_accepted_when_declared_as_html(monkeypatch):
    monkeypatch.setattr(requests, "get", lambda *a, **k: FakeResponse())
    assert ExcelGradingService._download_from_url(
        BLOB_URL, allow_html=True) == HTML


def test_download_file_detects_declared_html_submission(monkeypatch):
    monkeypatch.setattr(requests, "get", lambda *a, **k: FakeResponse())
    assert ExcelGradingService()._download_file(_file_info()) == HTML


def test_aage_manifest_contains_declared_html_file():
    info = _file_info()
    analyzer = ArtifactAnalyzer()
    analyzer._downloader._download_file = lambda _info: HTML

    manifest = analyzer.analyze(
        submission_type="assignment",
        submission_id=11,
        files=[info],
    )

    assert manifest.source_files, "HTML submission produced no readable source file"
    view = manifest.prompt_view()
    assert view["files"], "STUDENT_SUBMISSION.files must not be empty"
    assert view["files"][0]["path"].endswith(".html")
    assert "<form" in view["files"][0]["content"]
    assert view["manifest"]["declared_files"][0]["name"] == "contact_form.html"
