"""HTTP client for Ollama (/api/tags, /api/chat)."""

from __future__ import annotations

from typing import Any

import httpx


def list_models(base_url: str, timeout: float = 30.0) -> list[str]:
    url = base_url.rstrip("/") + "/api/tags"
    with httpx.Client(timeout=timeout) as client:
        r = client.get(url)
        r.raise_for_status()
        data = r.json()
    models = data.get("models") or []
    names: list[str] = []
    for m in models:
        if isinstance(m, dict) and "name" in m:
            names.append(str(m["name"]))
    return sorted(set(names))


def chat_completion(
    base_url: str,
    model: str,
    messages: list[dict[str, str]],
    *,
    temperature: float = 0.35,
    max_tokens: int | None = None,
    timeout: float = 600.0,
) -> str:
    url = base_url.rstrip("/") + "/api/chat"
    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "stream": False,
        "options": {"temperature": temperature},
    }
    if max_tokens is not None:
        payload["options"]["num_predict"] = max_tokens
    with httpx.Client(timeout=timeout) as client:
        r = client.post(url, json=payload)
        r.raise_for_status()
        data = r.json()
    msg = data.get("message") or {}
    content = msg.get("content")
    if isinstance(content, str):
        return content
    return ""
