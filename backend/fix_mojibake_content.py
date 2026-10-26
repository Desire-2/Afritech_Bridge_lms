#!/usr/bin/env python3
"""Repair UTF-8-as-Latin-1 mojibake in content-bearing tables.

Some AI generations were stored after being decoded as ISO-8859-1 (requests'
default for text/* streaming responses), so symbols, accents, smart quotes and
emoji were written corrupted: "cliche\u0301" became "clichÃ©", "√" became "â√",
"·" became "Â·".

This script only rewrites strings that are byte-valid Latin-1 AND decode as
UTF-8 into text that no longer looks like mojibake. Anything ambiguous is
printed as UNREPAIRABLE and left untouched (fail-loud, idempotent).

Usage:
    cd backend
    venv/bin/python fix_mojibake_content.py            # dry run (report only)
    venv/bin/python fix_mojibake_content.py --apply    # write repairs
"""
import os
import re
import sys
from pathlib import Path

# Lead byte in U+00C0-U+00FF followed by a byte in U+0080-U+00BF is the
# signature of UTF-8 read as Latin-1 (Ã©, Â·, â\x80\x94, áµ, Å·, Î£ ...).
MOJIBAKE_SIGNAL = re.compile(r"[À-ÿ][\x80-\xbf]")

TARGETS = {
    "courses": [
        "title", "description", "learning_objectives", "target_audience",
        "prerequisites", "category", "tags",
    ],
    "modules": ["title", "description", "learning_objectives", "prerequisites"],
    "lessons": ["title", "description", "content_data", "learning_objectives", "prerequisites"],
    "quizzes": ["title", "description"],
    "questions": ["text", "explanation", "tags"],
}


def looks_like_mojibake(text: str) -> bool:
    return bool(MOJIBAKE_SIGNAL.search(text))


def repair_mojibake(text):
    """Return (repaired, changed).

    Unrepairable or ambiguous input is returned unchanged.
    """
    if not text or not looks_like_mojibake(text):
        return text, False
    try:
        candidate = text.encode("latin-1").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return text, False
    if candidate == text or looks_like_mojibake(candidate):
        return text, False
    return candidate, True


def _database_url() -> str:
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        for env_file in (Path.cwd() / ".env", Path(__file__).with_name(".env")):
            if not env_file.is_file():
                continue
            for line in env_file.read_text().splitlines():
                line = line.strip()
                if line.startswith("DATABASE_URL="):
                    url = line.split("=", 1)[1].strip().strip("'\"")
                    break
            if url:
                break
    if not url:
        url = "sqlite:///" + str(Path(__file__).parent / "instance" / "afritec_lms_db.db")
    if url.startswith("postgres://"):
        url = "postgresql+psycopg2://" + url[len("postgres://"):]
    elif url.startswith("postgresql://") and "+psycopg2" not in url.split("://", 1)[0]:
        url = "postgresql+psycopg2://" + url[len("postgresql://"):]
    return url


def main(argv) -> int:
    apply = "--apply" in argv
    from sqlalchemy import create_engine, text

    engine = create_engine(_database_url())
    repaired_count = 0
    unrepairable = 0

    with engine.begin() as conn:
        for table, columns in TARGETS.items():
            for column in columns:
                rows = conn.execute(
                    text(f"SELECT id, {column} FROM {table} WHERE {column} IS NOT NULL")
                ).fetchall()
                for row_id, value in rows:
                    if not isinstance(value, str):
                        continue
                    fixed, changed = repair_mojibake(value)
                    if changed:
                        repaired_count += 1
                        print(f'{"FIX " if apply else "DRY "} {table}.{column} id={row_id}')
                        print(f"    before: {value[:120]!r}")
                        print(f"    after : {fixed[:120]!r}")
                        if apply:
                            conn.execute(
                                text(f"UPDATE {table} SET {column} = :v WHERE id = :i"),
                                {"v": fixed, "i": row_id},
                            )
                    elif looks_like_mojibake(value):
                        unrepairable += 1
                        print(f"UNREPAIRABLE {table}.{column} id={row_id}: {value[:120]!r}")

    action = "repaired" if apply else "would be repaired"
    print(f"\n{repaired_count} value(s) {action}; {unrepairable} unrepairable value(s) skipped")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
