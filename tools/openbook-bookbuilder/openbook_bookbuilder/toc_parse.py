"""Parse TOC JSON from model output (subset of openBook llm-toc-parse.ts)."""

from __future__ import annotations

import json
import re
from typing import Any

from openbook_bookbuilder.slugify import unique_slug_from_preferred


def _strip_code_fences(raw: str) -> str:
    t = raw.strip()
    m = re.search(r"```(?:json)?\s*([\s\S]*?)```", t, re.I)
    if m:
        return m.group(1).strip()
    return t


def _extract_first_json_array(scan: str) -> list[Any] | None:
    start = scan.find("[")
    if start == -1:
        return None
    depth = 0
    in_str = False
    esc = False
    for i in range(start, len(scan)):
        c = scan[i]
        if esc:
            esc = False
            continue
        if in_str:
            if c == "\\":
                esc = True
            elif c == '"':
                in_str = False
            continue
        if c == '"':
            in_str = True
            continue
        if c == "[":
            depth += 1
        elif c == "]":
            depth -= 1
            if depth == 0:
                try:
                    parsed = json.loads(scan[start : i + 1])
                    return parsed if isinstance(parsed, list) else None
                except json.JSONDecodeError:
                    return None
    return None


def _chapter_from_record(r: dict[str, Any]) -> tuple[str, str | None] | None:
    title = str(r.get("title", "")).strip()[:120]
    if not title:
        return None
    slug_raw = r.get("slug")
    if isinstance(slug_raw, str) and slug_raw.strip():
        return title, slug_raw.strip()
    return title, None


def _collect_chapter_rows(raw: str) -> list[tuple[str, str | None]]:
    trimmed = _strip_code_fences(raw)
    out: list[tuple[str, str | None]] = []
    seen_title: set[str] = set()

    def push(rec: dict[str, Any]) -> None:
        row = _chapter_from_record(rec)
        if not row or row[0] in seen_title:
            return
        seen_title.add(row[0])
        out.append(row)

    arr = _extract_first_json_array(trimmed)
    if arr:
        for item in arr:
            if isinstance(item, dict):
                push(item)
        if out:
            return out

    for line in trimmed.splitlines():
        t = line.strip()
        if not t.startswith("{"):
            continue
        try:
            obj = json.loads(t)
            if isinstance(obj, dict):
                push(obj)
        except json.JSONDecodeError:
            continue
    if out:
        return out

    # brace scan
    pos = 0
    while pos < len(trimmed):
        b = trimmed.find("{", pos)
        if b == -1:
            break
        depth = 0
        in_str = False
        esc = False
        for i in range(b, len(trimmed)):
            c = trimmed[i]
            if esc:
                esc = False
                continue
            if in_str:
                if c == "\\":
                    esc = True
                elif c == '"':
                    in_str = False
                continue
            if c == '"':
                in_str = True
                continue
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    try:
                        obj = json.loads(trimmed[b : i + 1])
                        if isinstance(obj, dict):
                            push(obj)
                    except json.JSONDecodeError:
                        pass
                    pos = i + 1
                    break
        else:
            pos = b + 1

    return out


def parse_toc_from_llm_text(raw: str) -> list[dict[str, str]]:
    rows = _collect_chapter_rows(raw)
    used: set[str] = set()
    out: list[dict[str, str]] = []
    for title, slug_raw in rows:
        slug = unique_slug_from_preferred(slug_raw, title, used)
        if not slug:
            continue
        used.add(slug.lower())
        out.append({"title": title, "slug": slug})
    return out
