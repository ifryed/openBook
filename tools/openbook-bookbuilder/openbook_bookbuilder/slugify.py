"""Match openBook src/lib/slug.ts slugify + reserved + uniqueSlugFromPreferred."""

from __future__ import annotations

import re

_RESERVED = frozenset(
    {
        "new",
        "edit",
        "history",
        "api",
        "talk",
        "login",
        "signup",
        "register",
        "_next",
        "favicon.ico",
    }
)

_MAX_SLUG_LEN = 80


def slugify(input_s: str) -> str:
    s = input_s.strip().lower()
    s = s.replace("'", "").replace("'", "")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s[:_MAX_SLUG_LEN]


def is_reserved_slug(slug: str) -> bool:
    return slug.lower() in _RESERVED


def unique_slug_from_preferred(
    preferred_raw: str | None, title: str, taken: set[str]
) -> str:
    from_preferred = slugify(preferred_raw.strip()) if preferred_raw and preferred_raw.strip() else ""
    from_title = slugify(title)
    base = from_preferred or from_title
    if not base:
        return ""
    lower_taken = {s.lower() for s in taken}
    candidate = base
    n = 2
    while candidate.lower() in lower_taken or is_reserved_slug(candidate):
        candidate = f"{base}-{n}"
        n += 1
        if n > 200:
            return ""
    return candidate
