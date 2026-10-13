"""Write-side validation for the lesson content contract.

The canonical storage format is documented in
``frontend/src/lib/lesson-content.ts``:

- ``content_type === "mixed"`` stores a JSON array of canonical section
  objects ``{id, type: "section", title, blocks}`` — or, for existing
  content, a legacy flat array of blocks ``{type, content|url, title}``.
- ``content_type === "text"`` stores markdown (``H1`` = lesson title,
  ``H2`` = section title, see ``frontend/MARKDOWN_CONTENT_GUIDELINES.md``).
- ``video``/``pdf`` store a single URL.

These rules are enforced at save time so malformed content is rejected with
an actionable message instead of silently breaking the student player later.
"""

import json

ALLOWED_CONTENT_TYPES = ("text", "video", "pdf", "mixed")

_MIXED_NOT_JSON = (
    "content_data for mixed lessons must be valid JSON: an array of "
    "sections (or legacy blocks), or an object with a \"sections\" array"
)
_MIXED_BAD_SHAPE = (
    "mixed content_data must be an array of sections or an object with a "
    "\"sections\" array"
)


def validate_lesson_content(content_type, content_data):
    """Validate a lesson's ``content_type``/``content_data`` pair.

    Returns ``(ok, error_message)``. Never raises; used on create and update
    so both paths enforce the same contract.
    """
    if not isinstance(content_type, str) or content_type not in ALLOWED_CONTENT_TYPES:
        return False, "content_type must be one of: %s" % (", ".join(ALLOWED_CONTENT_TYPES),)

    if not isinstance(content_data, str) or not content_data.strip():
        return False, "content_data is required and must be a non-empty string"

    if content_type != "mixed":
        return True, None

    try:
        parsed = json.loads(content_data)
    except (TypeError, ValueError):
        return False, _MIXED_NOT_JSON

    if isinstance(parsed, list):
        return True, None

    if isinstance(parsed, dict) and isinstance(parsed.get("sections"), list):
        return True, None

    return False, _MIXED_BAD_SHAPE
