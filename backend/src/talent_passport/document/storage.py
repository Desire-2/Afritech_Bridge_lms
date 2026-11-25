"""Atomic local filesystem storage for issued Passport PDF snapshots."""

from __future__ import annotations

import os
import re
import tempfile
from pathlib import Path

from flask import current_app

from ..config import PDF_STORAGE_CONFIG_KEY

_SAFE_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}\.pdf$")


def storage_root() -> Path:
    configured = current_app.config.get(PDF_STORAGE_CONFIG_KEY)
    if configured:
        root = Path(str(configured)).expanduser()
    else:
        root = Path(current_app.instance_path) / "talent_passport_pdf"
    root.mkdir(parents=True, exist_ok=True)
    return root


def make_storage_name(document_ref: str) -> str:
    if not _SAFE_NAME.fullmatch(f"{document_ref}.pdf"):
        raise ValueError("Invalid document reference")
    return f"{document_ref}.pdf"


def write_pdf(document_ref: str, data: bytes) -> str:
    """Write bytes atomically and return the relative storage path."""
    if not data.startswith(b"%PDF"):
        raise ValueError("Only PDF bytes may be stored")
    name = make_storage_name(document_ref)
    root = storage_root()
    target = root / name
    fd, temp_name = tempfile.mkstemp(prefix=f".{document_ref}.", suffix=".tmp", dir=str(root))
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_name, target)
    except Exception:
        try:
            os.unlink(temp_name)
        except OSError:
            pass
        raise
    return name


def read_pdf(storage_path: str) -> bytes:
    if not _SAFE_NAME.fullmatch(storage_path):
        raise ValueError("Invalid stored document path")
    path = storage_root() / storage_path
    if not path.is_file():
        raise LookupError("Stored document is missing")
    return path.read_bytes()
