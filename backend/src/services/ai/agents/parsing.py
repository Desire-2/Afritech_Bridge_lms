"""Robust JSON extraction from LLM responses.

Frontends/agents frequently receive fence-wrapped, prose-adorned or truncated
JSON from frontier models. These helpers centralize extraction so every agent
behaves identically (no more per-agent bespoke parsers).
"""

from __future__ import annotations

import json
import re
from typing import Any, Optional

from ..providers import ProviderMalformedResponseError


def extract_json_text(text: str) -> str:
    """Return the pure JSON substring of ``text`` (or the original trimmed text)."""
    if not text:
        raise ProviderMalformedResponseError("Empty response while expecting JSON.")
    t = text.strip()
    if t.startswith("```"):
        m = re.search(r"```(?:json)?\s*(.+?)\s*```", t, re.DOTALL | re.IGNORECASE)
        if m:
            t = m.group(1).strip()
    # try whole-string / bracket matching
    for opener, closer in (("{", "}"), ("[", "]")):
        start = t.find(opener)
        if start == -1:
            continue
        depth = 0
        in_str = False
        esc = False
        for i in range(start, len(t)):
            ch = t[i]
            if in_str:
                if esc:
                    esc = False
                elif ch == "\\":
                    esc = True
                elif ch == '"':
                    in_str = False
                continue
            if ch == '"':
                in_str = True
            elif ch == opener:
                depth += 1
            elif ch == closer:
                depth -= 1
                if depth == 0:
                    return t[start:i + 1]
    # extremely truncated — take a prefix up to last '}'
    last = t.rfind("}")
    if last != -1:
        candidate = t[:last + 1]
        # never return a broken half; only use if it parses
        try:
            json.loads(candidate)
            return candidate
        except (json.JSONDecodeError, TypeError):
            pass
    raise ProviderMalformedResponseError("No valid JSON object found in response.")


def parse_json(text: str) -> Any:
    """Extract and parse JSON; raises ProviderMalformedResponseError on failure."""
    extracted = extract_json_text(text)
    try:
        return json.loads(extracted)
    except (json.JSONDecodeError, TypeError) as exc:
        raise ProviderMalformedResponseError(
            "Model returned invalid JSON after extraction."
        ) from exc


def try_parse_json(text: str) -> Optional[Any]:
    """Non-raising variant — returns None instead of raising."""
    try:
        return parse_json(text)
    except ProviderMalformedResponseError:
        return None