"""Service D — Submission Processing & Artifact Analyzer.

Turns an untrusted submission into a **safe, bounded, structured manifest**:

* written text,
* individual source-code files,
* ZIP project archives (validated, path-traversal safe, zip-bomb guarded,
  nested archives refused),
* spreadsheets and other binaries (recorded, never executed).

Everything extracted here is treated as hostile input.  Nothing is executed —
not in Flask, not in the worker.  Only metadata + SHA-256 checksums are
persisted (``submission_artifacts``); extracted text lives in memory for the
duration of one evaluation run and is hard-capped per file and in total.
"""

from __future__ import annotations

import hashlib
import io
import json
import logging
import os
import posixpath
import re
import zipfile
from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from ...models.aage_models import SubmissionArtifact
from ...models.user_models import db
from .constants import (
    MAX_DOWNLOAD_BYTES,
    MAX_SOURCE_CHARS_FOR_PROMPT,
    MAX_SINGLE_FILE_BYTES,
    MAX_TOTAL_CHARS_FOR_PROMPT,
    MAX_ZIP_COMPRESSED_BYTES,
    MAX_ZIP_COMPRESSION_RATIO,
    MAX_ZIP_FILE_COUNT,
    MAX_ZIP_UNCOMPRESSED_BYTES,
)

logger = logging.getLogger("aage.artifacts")

# ---------------------------------------------------------------------------
# Classification lexicons
# ---------------------------------------------------------------------------

BINARY_EXTENSIONS = {
    ".exe", ".dll", ".so", ".dylib", ".bin", ".class", ".pyc", ".pyo",
    ".o", ".a", ".jar", ".apk", ".msi", ".deb", ".rpm", ".app",
}

ARCHIVE_EXTENSIONS = {".zip", ".tar", ".gz", ".tgz", ".rar", ".7z", ".bz2", ".xz"}

SPREADSHEET_EXTENSIONS = {".xlsx", ".xlsm", ".xls", ".xltx", ".csv"}

DOC_EXTENSIONS = {".md", ".txt", ".rst", ".pdf", ".doc", ".docx", ".rtf", ".odt"}

#: Office/binary documents: never decoded as text — extracted (or recorded).
BINARY_DOC_EXTENSIONS = {".pdf", ".doc", ".docx", ".rtf", ".odt"}

#: Bounds for document text extraction (zip/XML/PDF parsing of hostile input).
MAX_DOC_EXTRACT_CHARS = 200_000
MAX_DOC_PDF_PAGES = 80
MAX_DOC_MEMBER_BYTES = 10 * 1024 * 1024

CONFIG_NAMES = {
    "package.json", "requirements.txt", "pyproject.toml", "setup.py",
    "pipfile", "poetry.lock", "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
    "dockerfile", "docker-compose.yml", "docker-compose.yaml", ".env.example",
    "next.config.js", "next.config.mjs", "next.config.ts", "vite.config.js",
    "vite.config.ts", "webpack.config.js", "tsconfig.json", "makefile",
    "manage.py", "wsgi.py", "asgi.py", "settings.py", "urls.py", "app.py",
    "main.py", "index.js", "index.ts", "index.html", "server.js", "server.py",
}

ENTRY_POINT_NAMES = {
    "index.html", "app.py", "main.py", "manage.py", "server.py", "wsgi.py",
    "asgi.py", "package.json", "index.js", "index.jsx", "index.ts", "index.tsx",
    "server.js", "app.js", "__main__.py",
}

TEST_PATH_HINTS = ("/test", "/tests", "/__tests__", "/spec", "/specs",
                   "test_", "_test.", ".test.", ".spec.", "/cypress/", "/e2e/")

LANGUAGE_BY_EXT = {
    ".html": "HTML", ".htm": "HTML",
    ".css": "CSS", ".scss": "SCSS", ".sass": "Sass", ".less": "Less",
    ".js": "JavaScript", ".mjs": "JavaScript", ".cjs": "JavaScript",
    ".jsx": "JavaScript (JSX)", ".ts": "TypeScript", ".tsx": "TypeScript (TSX)",
    ".vue": "Vue", ".svelte": "Svelte", ".astro": "Astro",
    ".py": "Python", ".ipynb": "Jupyter Notebook", ".pyx": "Cython",
    ".sql": "SQL", ".psql": "SQL", ".ddl": "SQL",
    ".java": "Java", ".kt": "Kotlin", ".swift": "Swift", ".m": "Objective-C",
    ".cs": "C#", ".cpp": "C++", ".cc": "C++", ".cxx": "C++", ".c": "C",
    ".h": "C/C++ header", ".go": "Go", ".rs": "Rust", ".php": "PHP",
    ".rb": "Ruby", ".r": "R", ".scala": "Scala", ".sh": "Shell",
    ".bash": "Shell", ".ps1": "PowerShell", ".dart": "Dart",
    ".json": "JSON", ".yaml": "YAML", ".yml": "YAML", ".toml": "TOML",
    ".xml": "XML", ".md": "Markdown", ".csv": "CSV", ".txt": "Text",
}

SOURCE_CATEGORIES = {v for k, v in LANGUAGE_BY_EXT.items()
                     if v not in ("JSON", "YAML", "TOML", "XML", "Markdown",
                                  "Text", "CSV")}

TEXT_EXTENSIONS = set(LANGUAGE_BY_EXT) | DOC_EXTENSIONS | {
    ".gitignore", ".env", ".editorconfig", ".lock", ".cfg", ".ini", ".properties",
}

MAX_EMBEDDED_FILE_CHARS = 400  # binary sniffing only


@dataclass
class ExtractedFile:
    """One readable file kept in memory for evaluation (never executed)."""

    path: str
    name: str
    data: bytes
    language: str = ""
    category: str = "other"
    truncated: bool = False
    entry_point: bool = False
    is_test: bool = False
    is_doc: bool = False
    is_config: bool = False

    @property
    def text(self) -> str:
        if self.truncated:
            payload = self.data[:MAX_SOURCE_CHARS_FOR_PROMPT]
        else:
            payload = self.data
        try:
            return payload.decode("utf-8")
        except UnicodeDecodeError:
            return payload.decode("utf-8", errors="replace")

    @property
    def sha256(self) -> str:
        return hashlib.sha256(self.data).hexdigest()


@dataclass
class ArtifactManifest:
    """Structured description of everything the analyzer found."""

    submission_type: str = ""
    submission_id: int = 0
    files: List[Dict[str, Any]] = field(default_factory=list)
    source_files: List[ExtractedFile] = field(default_factory=list)
    #: Non-text artefacts kept in memory for specialist evaluators only. They
    #: are never converted to prompt text or executed.
    binary_files: List[ExtractedFile] = field(default_factory=list)
    text_content: str = ""
    languages: List[str] = field(default_factory=list)
    frameworks: List[str] = field(default_factory=list)
    entry_points: List[str] = field(default_factory=list)
    config_files: List[str] = field(default_factory=list)
    test_files: List[str] = field(default_factory=list)
    doc_files: List[str] = field(default_factory=list)
    dependency_manifests: List[str] = field(default_factory=list)
    missing_deliverables: List[str] = field(default_factory=list)
    rejected: List[Dict[str, str]] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    total_bytes: int = 0
    prompt_chars: int = 0

    @property
    def has_archive(self) -> bool:
        return any(f.get("category") == "archive" for f in self.files)

    def summary(self) -> Dict[str, Any]:
        return {
            "submission_type": self.submission_type,
            "submission_id": self.submission_id,
            "file_count": len(self.files),
            "source_file_count": len(self.source_files),
            "binary_file_count": len(self.binary_files),
            "languages": self.languages,
            "frameworks": self.frameworks,
            "entry_points": self.entry_points,
            "config_files": self.config_files,
            "test_files": self.test_files,
            "doc_files": self.doc_files,
            "dependency_manifests": self.dependency_manifests,
            "missing_deliverables": self.missing_deliverables,
            "rejected": self.rejected,
            "warnings": self.warnings,
            "total_bytes": self.total_bytes,
            "has_archive": self.has_archive,
            "text_content_chars": len(self.text_content or ""),
        }

    def prompt_view(self, max_chars: int = MAX_TOTAL_CHARS_FOR_PROMPT) -> Dict[str, Any]:
        """What evaluators see — bounded, ordered, with explicit provenance."""
        chunks: List[Dict[str, Any]] = []
        budget = max_chars
        for f in sorted(self.source_files, key=lambda x: x.path):
            text = f.text
            if len(text) > budget:
                text = text[:budget]
                f.truncated = True
            if budget <= 0:
                break
            chunks.append({
                "path": f.path,
                "language": f.language,
                "entry_point": f.entry_point,
                "chars": len(text),
                "content": text,
            })
            budget -= len(text)
        return {
            "files": chunks,
            "written_response": (self.text_content or "")[:MAX_SOURCE_CHARS_FOR_PROMPT],
            "manifest": {
                "languages": self.languages,
                "frameworks": self.frameworks,
                "entry_points": self.entry_points,
                "config_files": self.config_files,
                "test_files": self.test_files,
                "doc_files": self.doc_files,
                "dependency_manifests": self.dependency_manifests,
                "missing_deliverables": self.missing_deliverables,
                # Always tell the evaluator what the student submitted, even
                # when a file was binary or could not be downloaded. Without
                # this, `files` (readable content chunks) can be empty while a
                # required file is visibly present in the submission metadata.
                "declared_files": [
                    {
                        "name": f.get("file_name"),
                        "category": f.get("category"),
                        "status": f.get("status"),
                        "size_bytes": f.get("size_bytes"),
                        "error": f.get("error"),
                    }
                    for f in self.files[:50]
                ],
                "warnings": self.warnings,
            },
        }


# ---------------------------------------------------------------------------
# ZIP safety
# ---------------------------------------------------------------------------

class ZipRejected(Exception):
    """A ZIP archive failed a safety check."""

    def __init__(self, reason: str, code: str = "zip_rejected"):
        super().__init__(reason)
        self.reason = reason
        self.code = code


def _safe_member_path(name: str) -> Optional[str]:
    """Return a normalised relative POSIX path, or ``None`` if unsafe."""
    if not name:
        return None
    if "\x00" in name:
        return None
    # Windows separators must not sneak past posixpath checks
    candidate = name.replace("\\", "/")
    if candidate.startswith("/") or re.match(r"^[a-zA-Z]:", candidate):
        return None
    normalised = posixpath.normpath(candidate)
    if normalised.startswith("..") or normalised == "..":
        return None
    if normalised.startswith("./"):
        normalised = normalised[2:]
    if not normalised or normalised in (".",):
        return None
    return normalised


def _is_symlink(external_attr: int) -> bool:
    return ((external_attr >> 16) & 0o170000) == 0o120000


def read_zip_safely(blob: bytes,
                    *,
                    max_compressed: int = MAX_ZIP_COMPRESSED_BYTES,
                    max_uncompressed: int = MAX_ZIP_UNCOMPRESSED_BYTES,
                    max_files: int = MAX_ZIP_FILE_COUNT,
                    max_ratio: int = MAX_ZIP_COMPRESSION_RATIO,
                    max_file_bytes: int = MAX_SINGLE_FILE_BYTES,
                    allowed_suffixes: Optional[Iterable[str]] = None,
                    ) -> Tuple[Dict[str, bytes], List[Dict[str, str]]]:
    """Extract text-ish members of a ZIP under strict limits.

    Returns ``(members, rejected)`` where ``members`` maps safe relative paths
    to bytes.  Raises :class:`ZipRejected` when the archive as a whole is
    unusable.

    Guard rails implemented here:
      * compressed size cap,
      * declared uncompressed total cap + per-member cap,
      * compression-ratio (zip bomb) cap,
      * member count cap,
      * absolute / ``..`` / drive-letter / backslash traversal rejection,
      * symlink entries rejected,
      * nested archives and binaries refused (recorded, not extracted),
      * directories skipped.
    """
    if len(blob) > max_compressed:
        raise ZipRejected(f"archive exceeds {max_compressed} bytes", "too_large")
    try:
        zf = zipfile.ZipFile(io.BytesIO(blob))
    except zipfile.BadZipFile as exc:
        raise ZipRejected(f"not a valid ZIP archive: {exc}", "corrupt")

    with zf:
        infos = zf.infolist()
        if len(infos) > max_files:
            raise ZipRejected(f"archive has {len(infos)} entries (max {max_files})",
                              "too_many_files")

        # Pre-scan declared sizes for bomb detection before reading anything.
        declared = sum(i.file_size for i in infos)
        if declared > max_uncompressed:
            raise ZipRejected(
                f"declared uncompressed size {declared} exceeds {max_uncompressed}",
                "zip_bomb")

        members: Dict[str, bytes] = {}
        rejected: List[Dict[str, str]] = []
        total_read = 0
        suffix_filter = set(s.lower() for s in allowed_suffixes) if allowed_suffixes else None

        for info in infos:
            name = info.filename
            if name.endswith("/"):
                continue
            if _is_symlink(info.external_attr):
                rejected.append({"path": name, "reason": "symlink entry"})
                continue

            safe_path = _safe_member_path(name)
            if safe_path is None:
                rejected.append({"path": name, "reason": "unsafe path"})
                logger.warning("AAGE rejected unsafe zip member: %r", name)
                continue

            if info.file_size > max_file_bytes:
                rejected.append({"path": safe_path, "reason": "file too large"})
                continue
            if info.compress_size and info.file_size / max(info.compress_size, 1) > max_ratio:
                rejected.append({"path": safe_path, "reason": "suspicious compression ratio"})
                continue

            suffix = posixpath.splitext(safe_path)[1].lower()
            if suffix in ARCHIVE_EXTENSIONS:
                rejected.append({"path": safe_path, "reason": "nested archive"})
                continue
            if suffix in BINARY_EXTENSIONS:
                rejected.append({"path": safe_path, "reason": "binary executable"})
                continue
            if suffix_filter is not None and suffix and suffix not in suffix_filter:
                rejected.append({"path": safe_path, "reason": "disallowed file type"})
                continue

            if total_read + info.file_size > max_uncompressed:
                rejected.append({"path": safe_path, "reason": "uncompressed size budget"})
                continue

            try:
                with zf.open(info) as fh:
                    data = fh.read(max_file_bytes + 1)
            except Exception as exc:  # pragma: no cover - defensive
                rejected.append({"path": safe_path, "reason": f"unreadable: {exc}"})
                continue

            if len(data) > max_file_bytes:
                rejected.append({"path": safe_path, "reason": "file too large"})
                continue

            total_read += len(data)
            members[safe_path] = data

        if not members and not rejected:
            raise ZipRejected("archive contains no usable files", "empty")

    return members, rejected


# ---------------------------------------------------------------------------
# Document text extraction (hostile input — bounded, never executed)
# ---------------------------------------------------------------------------

def extract_document_text(suffix: str, blob: bytes) -> Optional[str]:
    """Best-effort plain text from an office/PDF document.

    Returns ``None`` when nothing readable could be extracted so the caller can
    record the file as binary instead of feeding garbage to a model.  Parsing
    is bounded: page/size limits are enforced before any text is returned.
    """
    suffix = (suffix or "").lower()
    if not blob:
        return None

    if suffix == ".pdf":
        return _extract_pdf_text(blob)
    if suffix in (".docx", ".odt"):
        return _extract_zip_xml_text(blob, suffix)
    if suffix == ".rtf":
        return _extract_rtf_text(blob)
    if suffix == ".doc":
        # Legacy OLE .doc: only recover ASCII runs; never interpret structure.
        return _extract_ascii_runs(blob)
    return None


def _extract_pdf_text(blob: bytes) -> Optional[str]:
    try:
        import io
        import PyPDF2  # pinned in requirements.txt

        if len(blob) > MAX_DOC_MEMBER_BYTES * 5:
            return None
        reader = PyPDF2.PdfReader(io.BytesIO(blob))
        parts: List[str] = []
        total = 0
        for page in reader.pages[:MAX_DOC_PDF_PAGES]:
            try:
                text = page.extract_text() or ""
            except Exception:  # noqa: BLE001 - corrupt page
                continue
            parts.append(text)
            total += len(text)
            if total >= MAX_DOC_EXTRACT_CHARS:
                break
        joined = "\n".join(parts).strip()
        return joined[:MAX_DOC_EXTRACT_CHARS] or None
    except Exception as exc:  # noqa: BLE001 - untrusted file
        logger.debug("PDF text extraction failed: %s", exc)
        return None


def _extract_zip_xml_text(blob: bytes, suffix: str) -> Optional[str]:
    """Extract text from OOXML (.docx) / ODF (.odt) packages via stdlib only."""
    import io
    import re as _re
    import zipfile

    if len(blob) > MAX_DOC_MEMBER_BYTES * 5:
        return None
    member_names = ("word/document.xml",) if suffix == ".docx" else (
        "content.xml", "styles.xml")
    try:
        with zipfile.ZipFile(io.BytesIO(blob)) as zf:
            parts: List[str] = []
            total = 0
            for name in member_names:
                try:
                    info = zf.getinfo(name)
                except KeyError:
                    continue
                if info.file_size > MAX_DOC_MEMBER_BYTES:
                    continue
                with zf.open(info) as fh:
                    xml = fh.read(MAX_DOC_MEMBER_BYTES + 1)
                if len(xml) > MAX_DOC_MEMBER_BYTES:
                    continue
                text = xml.decode("utf-8", errors="replace")
                # Drop tags, keep paragraph breaks, unescape entities.
                text = _re.sub(r"</w:p>|</text:p>", "\n", text)
                text = _re.sub(r"<[^>]+>", "", text)
                text = (text.replace("&amp;", "&").replace("&lt;", "<")
                        .replace("&gt;", ">").replace("&quot;", '"')
                        .replace("&apos;", "'").replace("&nbsp;", " "))
                parts.append(text)
                total += len(text)
                if total >= MAX_DOC_EXTRACT_CHARS:
                    break
            joined = "\n".join(parts).strip()
            return joined[:MAX_DOC_EXTRACT_CHARS] or None
    except Exception as exc:  # noqa: BLE001 - untrusted file
        logger.debug("Office document extraction failed: %s", exc)
        return None


def _extract_rtf_text(blob: bytes) -> Optional[str]:
    import re as _re

    if len(blob) > MAX_DOC_MEMBER_BYTES:
        return None
    try:
        text = blob.decode("latin-1", errors="replace")
        text = _re.sub(r"\\'([0-9a-fA-F]{2})", "", text)
        text = _re.sub(r"\\[a-z]+-?\d* ?", "", text)
        text = text.replace("{", "").replace("}", "").replace("\\", "")
        text = _re.sub(r"[ \t]+", " ", text)
        text = _re.sub(r"\n{3,}", "\n\n", text).strip()
        return text[:MAX_DOC_EXTRACT_CHARS] or None
    except Exception:  # noqa: BLE001
        return None


def _extract_ascii_runs(blob: bytes) -> Optional[str]:
    """Recover printable ASCII runs from a legacy binary document."""
    if len(blob) > MAX_DOC_MEMBER_BYTES:
        return None
    runs = re.findall(rb"[\x20-\x7e\r\n\t]{40,}", blob)
    if not runs:
        return None
    text = b"\n".join(runs[:2000]).decode("ascii", errors="ignore")
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text[:MAX_DOC_EXTRACT_CHARS] or None


# ---------------------------------------------------------------------------
# Analyzer
# ---------------------------------------------------------------------------

class ArtifactAnalyzer:
    """Builds a manifest from an assignment/project submission."""

    def __init__(self):
        from ..excel_grading.excel_grading_service import ExcelGradingService
        self._downloader = ExcelGradingService()

    # -- public -------------------------------------------------------------

    def analyze(
        self,
        *,
        submission_type: str,
        submission_id: int,
        files: Sequence[Dict[str, Any]],
        text_content: str = "",
        expected_deliverables: Optional[Sequence[str]] = None,
    ) -> ArtifactManifest:
        manifest = ArtifactManifest(
            submission_type=submission_type,
            submission_id=submission_id,
            text_content=text_content or "",
        )

        for file_info in files:
            self._consume_file(manifest, file_info)

        if manifest.text_content:
            manifest.prompt_chars += len(manifest.text_content)
            # Inline code blocks inside written answers are useful evidence.
            for idx, block in enumerate(_code_blocks(manifest.text_content)):
                path = f"written_response/code_block_{idx + 1}{_guess_suffix(block)}"
                manifest.source_files.append(ExtractedFile(
                    path=path, name=path, data=block.encode("utf-8"),
                    language=_language_from_content(block),
                    category="source",
                ))

        manifest.languages = _unique(
            f.language for f in manifest.source_files if f.language)
        manifest.frameworks = _detect_frameworks(manifest.source_files, manifest.text_content)
        manifest.entry_points = _unique(
            posixpath.basename(f.path) for f in manifest.source_files if f.entry_point)
        manifest.config_files = _unique(
            posixpath.basename(f.path) for f in manifest.source_files if f.is_config)
        manifest.test_files = _unique(f.path for f in manifest.source_files if f.is_test)
        manifest.doc_files = _unique(
            f.path for f in manifest.source_files if f.is_doc)
        manifest.dependency_manifests = [
            name for name in _DEPENDENCY_MANIFESTS
            if any(posixpath.basename(f.path).lower() == name
                   for f in manifest.source_files)]
        manifest.prompt_chars = sum(len(f.text) for f in manifest.source_files)

        if expected_deliverables:
            manifest.missing_deliverables = self._missing_deliverables(
                manifest, expected_deliverables)

        if (not manifest.source_files and not manifest.binary_files
                and not manifest.text_content.strip()):
            manifest.warnings.append("no readable content found in the submission")
        if manifest.prompt_chars > MAX_TOTAL_CHARS_FOR_PROMPT:
            manifest.warnings.append(
                f"submission content capped at {MAX_TOTAL_CHARS_FOR_PROMPT} characters "
                "for evaluation")

        return manifest

    # -- internals ----------------------------------------------------------

    def _consume_file(self, manifest: ArtifactManifest, file_info: Dict[str, Any]) -> None:
        name = str(file_info.get("original_filename")
                   or file_info.get("filename")
                   or file_info.get("name")
                   or "submission_file")
        suffix = posixpath.splitext(name)[1].lower()

        meta: Dict[str, Any] = {
            "file_name": name[:400],
            "relative_path": name[:600],
            "storage": (file_info.get("storage") or "").strip() or None,
            "external_id": file_info.get("file_id") or file_info.get("fileId"),
            "size_bytes": None,
            "checksum_sha256": None,
            "category": "other",
            "language": LANGUAGE_BY_EXT.get(suffix),
            "status": "pending",
            "truncated": False,
        }

        if suffix in ARCHIVE_EXTENSIONS:
            meta["category"] = "archive"
        elif suffix in SPREADSHEET_EXTENSIONS:
            meta["category"] = "data"
        elif suffix in BINARY_EXTENSIONS:
            meta["category"] = "binary"
        elif suffix in DOC_EXTENSIONS or name.lower() in ("readme.md", "readme.txt", "readme"):
            meta["category"] = "doc"
        elif suffix in TEXT_EXTENSIONS:
            meta["category"] = "source"
        meta["is_required_deliverable"] = suffix in TEXT_EXTENSIONS or not suffix

        blob = self._download(file_info)
        if blob is None:
            meta["status"] = "unavailable"
            meta["error"] = "file could not be downloaded"
            manifest.warnings.append(f"could not download {name}")
            manifest.files.append(meta)
            return

        meta["size_bytes"] = len(blob)
        meta["checksum_sha256"] = hashlib.sha256(blob).hexdigest()
        manifest.total_bytes += len(blob)

        if suffix in ARCHIVE_EXTENSIONS:
            self._expand_archive(manifest, meta, blob)
        elif suffix in (".xlsx", ".xlsm", ".xls"):
            # Spreadsheet evaluators inspect the workbook bytes directly. The
            # bytes are bounded and kept out of prompt_view(); no formula or
            # macro is ever executed.
            data = blob[:MAX_SINGLE_FILE_BYTES]
            self._add_binary(manifest, meta, data, len(data) < len(blob))
            manifest.files.append(meta)
            return
        elif suffix in BINARY_EXTENSIONS:
            meta["category"] = "binary"
            meta["status"] = "recorded"
            manifest.files.append(meta)
            return
        elif suffix in BINARY_DOC_EXTENSIONS:
            text = extract_document_text(suffix, blob)
            if text is None:
                meta["category"] = "binary"
                meta["status"] = "recorded"
                meta["note"] = "document text could not be extracted"
                manifest.files.append(meta)
                return
            data = text.encode("utf-8")
            truncated = False
            if len(data) > MAX_SINGLE_FILE_BYTES:
                data = data[:MAX_SINGLE_FILE_BYTES]
                truncated = True
                meta["truncated"] = True
            meta["text_extracted"] = True
            self._add_source(manifest, meta, data, truncated)
        elif suffix in TEXT_EXTENSIONS or _looks_like_text(blob):
            data = blob
            truncated = False
            if len(data) > MAX_SINGLE_FILE_BYTES:
                data = data[:MAX_SINGLE_FILE_BYTES]
                truncated = True
                meta["truncated"] = True
            self._add_source(manifest, meta, data, truncated)
        else:
            # Unknown binary — record it, never try to interpret it.
            meta["category"] = "binary"
            meta["status"] = "recorded"
            manifest.files.append(meta)
            return

        meta["status"] = "ready"
        manifest.files.append(meta)

    def _expand_archive(self, manifest: ArtifactManifest, meta: Dict[str, Any],
                        blob: bytes) -> None:
        try:
            members, rejected = read_zip_safely(blob)
        except ZipRejected as exc:
            meta["status"] = "rejected"
            meta["error"] = exc.reason
            manifest.rejected.append({"path": meta["file_name"], "reason": exc.reason})
            manifest.warnings.append(f"{meta['file_name']}: {exc.reason}")
            return

        manifest.rejected.extend(rejected)
        for path, data in members.items():
            suffix = posixpath.splitext(path)[1].lower()
            child = {
                "file_name": posixpath.basename(path)[:400],
                "relative_path": path[:600],
                "storage": "zip_member",
                "external_id": meta.get("external_id"),
                "size_bytes": len(data),
                "checksum_sha256": hashlib.sha256(data).hexdigest(),
                "category": "source" if suffix in TEXT_EXTENSIONS else "other",
                "language": LANGUAGE_BY_EXT.get(suffix),
                "status": "ready",
                "truncated": len(data) > MAX_SINGLE_FILE_BYTES,
            }
            if suffix in SPREADSHEET_EXTENSIONS:
                child["category"] = "data"
            elif suffix in DOC_EXTENSIONS:
                child["category"] = "doc"
            if suffix in BINARY_DOC_EXTENSIONS:
                text = extract_document_text(suffix, data)
                if text is None:
                    child["category"] = "binary"
                    child["status"] = "recorded"
                    manifest.files.append(child)
                    continue
                data = text.encode("utf-8")
                child["truncated"] = len(data) > MAX_SINGLE_FILE_BYTES
                child["text_extracted"] = True
                child["size_bytes"] = len(data)
                self._add_source(manifest, child, data, child["truncated"])
            elif suffix in (".xlsx", ".xlsm", ".xls"):
                # A workbook inside a ZIP is still a first-class artefact for
                # the spreadsheet specialist. Keep its bytes out of prompts and
                # never open/execute formulas or macros.
                original_size = len(data)
                data = data[:MAX_SINGLE_FILE_BYTES]
                self._add_binary(manifest, child, data,
                                 len(data) < original_size)
            elif suffix in TEXT_EXTENSIONS or _looks_like_text(data):
                self._add_source(manifest, child, data, child["truncated"])
            elif suffix not in BINARY_EXTENSIONS:
                child["category"] = "binary"
                child["status"] = "recorded"
            manifest.files.append(child)

    def _add_binary(self, manifest: ArtifactManifest, meta: Dict[str, Any],
                    data: bytes, truncated: bool) -> None:
        path = meta["relative_path"]
        name = posixpath.basename(path).lower()
        suffix = posixpath.splitext(name)[1].lower()
        manifest.binary_files.append(ExtractedFile(
            path=path,
            name=meta["file_name"],
            data=data,
            language=LANGUAGE_BY_EXT.get(suffix) or "spreadsheet",
            category=meta.get("category") or "data",
            truncated=truncated,
        ))
        meta["status"] = "ready"
        meta["truncated"] = bool(truncated)

    def _add_source(self, manifest: ArtifactManifest, meta: Dict[str, Any],
                    data: bytes, truncated: bool) -> None:
        path = meta["relative_path"]
        name = posixpath.basename(path).lower()
        suffix = posixpath.splitext(name)[1].lower()
        entry = ExtractedFile(
            path=path,
            name=meta["file_name"],
            data=data,
            language=LANGUAGE_BY_EXT.get(suffix) or _language_from_content(
                data[:4000].decode("utf-8", errors="replace")),
            category=meta.get("category") or "source",
            truncated=truncated,
            entry_point=name in ENTRY_POINT_NAMES,
            is_test=_is_test_path(path),
            is_doc=(suffix in DOC_EXTENSIONS or name.startswith("readme")),
            is_config=name in CONFIG_NAMES,
        )
        manifest.source_files.append(entry)
        meta["language"] = entry.language

    def _download(self, file_info: Dict[str, Any]) -> Optional[bytes]:
        try:
            blob = self._downloader._download_file(file_info)
        except Exception as exc:  # pragma: no cover - storage failures
            logger.warning("AAGE file download failed: %s", exc)
            return None
        if not blob:
            return None
        if len(blob) > MAX_DOWNLOAD_BYTES:
            logger.warning("AAGE rejected oversized download (%s bytes)", len(blob))
            return None
        return blob

    @staticmethod
    def _missing_deliverables(manifest: ArtifactManifest,
                              expected: Sequence[str]) -> List[str]:
        """Best-effort check of declared deliverables against what arrived."""
        workbook_suffixes = (".xlsx", ".xlsm", ".xls")
        declared = [str(f.get("file_name") or f.get("path") or "").lower()
                    for f in manifest.files]
        binary = [str(f.path).lower() for f in manifest.binary_files]
        present = " ".join([
            " ".join(declared),
            " ".join(str(f.path.lower()) for f in manifest.source_files),
            " ".join(binary),
            (manifest.text_content or "").lower()[:4000],
        ])
        has_workbook = any(
            path.endswith(workbook_suffixes)
            or any(str(f.get("category") or "").lower() == "data"
                   and path.endswith(workbook_suffixes) for f in manifest.files)
            for path in declared + binary
        )
        missing: List[str] = []
        for item in expected:
            token = str(item).strip().lower()
            if not token:
                continue
            if token in present:
                continue
            # extension-style expectations: ".xlsx", ".ipynb"
            if token.startswith(".") and token in present:
                continue
            if has_workbook and any(word in token for word in
                                    ("spreadsheet", "workbook", "excel")):
                continue
            if any(word in present for word in re.findall(r"[a-z0-9]{3,}", token)[:3]):
                continue
            missing.append(str(item))
        return missing

    # -- persistence --------------------------------------------------------

    @staticmethod
    def persist(manifest: ArtifactManifest, job_id: int) -> List[SubmissionArtifact]:
        """Write the manifest rows (metadata only — no file bytes)."""
        rows: List[SubmissionArtifact] = []
        seen: set = set()
        for f in manifest.files:
            path = f.get("relative_path") or f.get("file_name") or "unknown"
            if path in seen:
                continue
            seen.add(path)
            rows.append(SubmissionArtifact(
                job_id=job_id,
                submission_type=manifest.submission_type,
                submission_id=manifest.submission_id,
                file_name=str(f.get("file_name") or path)[:400],
                relative_path=str(path)[:600],
                storage=f.get("storage"),
                external_id=f.get("external_id"),
                size_bytes=f.get("size_bytes"),
                checksum_sha256=f.get("checksum_sha256"),
                category=f.get("category"),
                language=f.get("language"),
                is_entry_point=bool(f.get("entry_point")),
                truncated=bool(f.get("truncated")),
                status=f.get("status") or "ready",
                error=f.get("error"),
            ))
        db.session.add_all(rows)
        return rows


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

_DEPENDENCY_MANIFESTS = (
    "package.json", "requirements.txt", "pyproject.toml", "pipfile",
    "composer.json", "go.mod", "cargo.toml", "pom.xml", "gemfile",
)


def _unique(items: Iterable[str]) -> List[str]:
    out: List[str] = []
    for item in items:
        if item and item not in out:
            out.append(item)
    return out


def _looks_like_text(blob: bytes) -> bool:
    sample = blob[:MAX_EMBEDDED_FILE_CHARS]
    if not sample:
        return True
    if b"\x00" in sample:
        return False
    try:
        sample.decode("utf-8")
        return True
    except UnicodeDecodeError:
        # A few undecodable bytes are normal in UTF-8 text; a dense block is not.
        ratio = sum(1 for b in sample if b < 9 or (13 < b < 32) or b == 127)
        return ratio / len(sample) < 0.05


def _is_test_path(path: str) -> bool:
    lowered = path.lower().replace("\\", "/")
    return any(hint in lowered for hint in TEST_PATH_HINTS)


def _code_blocks(text: str) -> List[str]:
    return re.findall(r"```[a-zA-Z0-9_+-]*\n(.*?)```", text or "", re.S)


def _guess_suffix(code: str) -> str:
    head = code[:400]
    if "def " in head or "import " in head:
        return ".py"
    if "<html" in head.lower() or "<div" in head.lower():
        return ".html"
    if "function " in head or "=>" in head:
        return ".js"
    if "SELECT " in head.upper():
        return ".sql"
    return ".txt"


def _language_from_content(text: str) -> str:
    head = (text or "")[:2000]
    checks = (
        ("<!doctype html", "HTML"), ("<html", "HTML"),
        ("def ", "Python"), ("import pandas", "Python"), ("import ", "Python"),
        ("function ", "JavaScript"), ("=>", "JavaScript"), ("console.log", "JavaScript"),
        ("SELECT ", "SQL"), ("CREATE TABLE", "SQL"),
        ("public static void", "Java"), ("package ", "Java"),
        ("fn main()", "Rust"), ("func ", "Go"),
    )
    lowered = head.lower()
    for needle, lang in checks:
        if needle.lower() in lowered:
            return lang
    return ""


def _detect_frameworks(files: Sequence[ExtractedFile], text: str) -> List[str]:
    blob = (text or "").lower()
    for f in files:
        try:
            blob += "\n" + f.text[:20000].lower()
        except Exception:  # pragma: no cover
            continue
    markers = {
        "React": "react", "Next.js": "next/", "Vue": "vue", "Svelte": "svelte",
        "Flask": "from flask", "FastAPI": "from fastapi", "Django": "django",
        "Express": "express", "Pandas": "pandas", "NumPy": "numpy",
        "Scikit-learn": "sklearn", "Matplotlib": "matplotlib",
        "Tailwind": "tailwind", "SQLAlchemy": "sqlalchemy",
        "Bootstrap": "bootstrap", "JQuery": "jquery",
    }
    return [name for name, needle in markers.items() if needle in blob]
