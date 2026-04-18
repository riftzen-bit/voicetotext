"""
Gemini two-step refinement pipeline.

Step 1 — analyze: extract intent, entities, and a brief neutral-language
summary of the raw transcript. Runs in the source language.

Step 2 — adjust: using the analysis as grounding, rewrite the transcript
into the target language in the requested mode (refine / translate /
summarize-translate), honoring an optional user template prompt.

Two passes are used instead of one because we want the translation/summary
step to be constrained by structured facts pulled from the original — this
keeps proper nouns, numbers, and named entities stable across languages
even when the translator would otherwise "smooth them out."

Gemini API docs: https://ai.google.dev/api/generate-content
ListModels:      https://ai.google.dev/api/models#method:-models.list
"""
from __future__ import annotations

import hashlib
import json
import logging
import time
from typing import Any, AsyncIterator

import httpx

log = logging.getLogger("vtt.ai")

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"
DEFAULT_MODEL = "gemini-2.5-flash"
REQUEST_TIMEOUT = httpx.Timeout(connect=10.0, read=60.0, write=20.0, pool=10.0)

# 24 h in-memory cache of the ListModels response. Keyed by a short hash of
# the API key so the full secret never appears in memory dumps or logs.
_MODELS_CACHE_TTL = 24 * 60 * 60.0
_models_cache: dict[str, tuple[float, list[dict[str, Any]]]] = {}


def _key_fingerprint(api_key: str) -> str:
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()[:16]


def _build_analyze_prompt(text: str, source_lang: str) -> dict[str, Any]:
    system = (
        "You analyze a raw speech-to-text transcript and return a compact JSON "
        "object capturing the speaker's intent and the key facts. Be strictly "
        "factual — do not invent anything not in the transcript. Return JSON "
        "ONLY, no prose, no markdown fences."
    )
    user = (
        f"Source language: {source_lang or 'auto'}\n"
        f"Transcript:\n\"\"\"\n{text}\n\"\"\"\n\n"
        "Return JSON with exactly these keys:\n"
        "  intent:        one short sentence, speaker's goal\n"
        "  entities:      array of {type, value} for names, numbers, dates, places, orgs\n"
        "  summary_brief: 1-2 sentence neutral summary in the source language"
    )
    return {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
        },
    }


def _build_adjust_prompt(
    text: str,
    analysis: dict[str, Any],
    target_lang: str,
    mode: str,
    template_prompt: str | None,
) -> dict[str, Any]:
    mode_instructions = {
        "refine": (
            "Rewrite the transcript cleanly in the target language: fix disfluencies, "
            "repair punctuation, preserve ALL meaning and every proper noun, number, "
            "and entity from the analysis. Do not summarize. Do not add content."
        ),
        "translate": (
            "Translate the transcript faithfully into the target language. Preserve "
            "every entity from the analysis verbatim where appropriate (names, numbers, "
            "brand terms). Keep the speaker's tone. Do not summarize."
        ),
        "summarize-translate": (
            "Produce a clean, well-structured summary of the transcript in the target "
            "language. Use the analysis's entities to anchor proper nouns and facts. "
            "Cover the intent clearly; omit filler."
        ),
    }.get(
        mode,
        "Rewrite the transcript cleanly in the target language, preserving all meaning.",
    )

    system = (
        "You are a transcript post-processor. You receive a raw speech-to-text "
        "transcript and a structured analysis of it. You output the processed "
        "result in the target language. Output PLAIN TEXT only — no JSON, no "
        "markdown fences, no preamble, no explanation of what you did."
    )

    template_block = (
        f"\n\nUser style/context template (follow when relevant):\n\"\"\"\n{template_prompt}\n\"\"\""
        if template_prompt
        else ""
    )

    user = (
        f"Target language: {target_lang}\n"
        f"Mode: {mode}\n\n"
        f"{mode_instructions}{template_block}\n\n"
        f"Analysis (JSON):\n{json.dumps(analysis, ensure_ascii=False)}\n\n"
        f"Transcript:\n\"\"\"\n{text}\n\"\"\"\n\n"
        "Output the final text now."
    )

    return {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {
            "temperature": 0.4,
            "responseMimeType": "text/plain",
        },
    }


def _extract_text(resp: dict[str, Any]) -> str:
    candidates = resp.get("candidates") or []
    if not candidates:
        return ""
    parts = (candidates[0].get("content") or {}).get("parts") or []
    return "".join(p.get("text", "") for p in parts).strip()


async def _gemini_generate(
    client: httpx.AsyncClient,
    api_key: str,
    model: str,
    body: dict[str, Any],
) -> dict[str, Any]:
    url = f"{GEMINI_BASE}/models/{model}:generateContent"
    r = await client.post(url, params={"key": api_key}, json=body)
    if r.status_code >= 400:
        # Gemini returns structured errors. Surface the message verbatim so
        # the frontend can show the user exactly what Google said.
        try:
            err = r.json().get("error", {})
            msg = err.get("message") or r.text
        except Exception:
            msg = r.text
        raise RuntimeError(f"Gemini {r.status_code}: {msg}")
    return r.json()


async def analyze(
    text: str,
    source_lang: str,
    api_key: str,
    model: str = DEFAULT_MODEL,
) -> dict[str, Any]:
    """Return {intent, entities, summary_brief}. Never raises on malformed JSON —
    falls back to a minimal structure so the adjust step can still proceed."""
    body = _build_analyze_prompt(text, source_lang)
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        resp = await _gemini_generate(client, api_key, model, body)
    raw = _extract_text(resp)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        log.warning("Analyze returned non-JSON, falling back to minimal: %r", raw[:200])
        data = {"intent": "", "entities": [], "summary_brief": ""}
    if not isinstance(data, dict):
        data = {"intent": "", "entities": [], "summary_brief": ""}
    data.setdefault("intent", "")
    data.setdefault("entities", [])
    data.setdefault("summary_brief", "")
    return data


async def adjust(
    text: str,
    analysis: dict[str, Any],
    target_lang: str,
    mode: str,
    template_prompt: str | None,
    api_key: str,
    model: str = DEFAULT_MODEL,
) -> str:
    body = _build_adjust_prompt(text, analysis, target_lang, mode, template_prompt)
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        resp = await _gemini_generate(client, api_key, model, body)
    return _extract_text(resp)


async def refine_stream(
    text: str,
    source_lang: str,
    target_lang: str,
    mode: str,
    template_prompt: str | None,
    api_key: str,
    model: str = DEFAULT_MODEL,
) -> AsyncIterator[dict[str, Any]]:
    """
    Async generator yielding SSE-shaped events:
      {"event": "analyzing"}
      {"event": "analysis", "data": {...}}
      {"event": "adjusting"}
      {"event": "done", "data": {"text": "..."}}
      {"event": "error", "data": {"message": "..."}}
    The caller formats these into `event: X\\ndata: Y\\n\\n` frames.
    """
    try:
        yield {"event": "analyzing"}
        analysis = await analyze(text, source_lang, api_key, model)
        yield {"event": "analysis", "data": analysis}

        yield {"event": "adjusting"}
        final = await adjust(text, analysis, target_lang, mode, template_prompt, api_key, model)
        yield {"event": "done", "data": {"text": final, "analysis": analysis}}
    except Exception as e:
        log.exception("AI pipeline failed")
        yield {"event": "error", "data": {"message": str(e)}}


# Substrings that mark a model as incompatible with the text-refinement
# pipeline. Live probe against the ListModels response on 2026-04-18 showed
# these families either (a) reject `systemInstruction` / `responseMimeType`,
# (b) require a non-text output modality, or (c) live on a separate API
# surface (Interactions / audio / image). Filtering them out of the dropdown
# keeps users from picking something that will always 400.
#
# Rules:
#   - any id containing one of _INCOMPATIBLE_FRAGMENTS is dropped
#   - any id starting with one of _INCOMPATIBLE_PREFIXES is dropped
_INCOMPATIBLE_FRAGMENTS: tuple[str, ...] = (
    "-tts",             # audio-only output
    "-image",           # image generation
    "lyria-",           # music generation
    "nano-banana",      # image generation (alias)
    "deep-research",    # Interactions API only
    "computer-use",     # tool-use specialty, not plain text
)
_INCOMPATIBLE_PREFIXES: tuple[str, ...] = (
    "gemma-3",          # Gemma 3 rejects systemInstruction on Gemini API
                        # ("Developer instruction is not enabled"). Gemma 4
                        # does accept it, so it stays.
)


def _is_compatible_model(model_id: str) -> bool:
    if any(p in model_id for p in _INCOMPATIBLE_FRAGMENTS):
        return False
    if any(model_id.startswith(p) for p in _INCOMPATIBLE_PREFIXES):
        return False
    return True


async def list_models(api_key: str, force: bool = False) -> list[dict[str, Any]]:
    """
    Return generateContent-capable Gemini models for the given key, filtered
    to the set that actually works with the refinement pipeline's request
    shape. Cached 24 h per-key so the settings panel can re-query freely.
    """
    fp = _key_fingerprint(api_key)
    now = time.monotonic()
    if not force:
        cached = _models_cache.get(fp)
        if cached and (now - cached[0]) < _MODELS_CACHE_TTL:
            return cached[1]

    url = f"{GEMINI_BASE}/models"
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        collected: list[dict[str, Any]] = []
        page_token: str | None = None
        # Loop paginated ListModels. Cap at 10 pages so a malformed response
        # can't spin us forever.
        for _ in range(10):
            params: dict[str, str] = {"key": api_key, "pageSize": "50"}
            if page_token:
                params["pageToken"] = page_token
            r = await client.get(url, params=params)
            if r.status_code >= 400:
                try:
                    err = r.json().get("error", {})
                    msg = err.get("message") or r.text
                except Exception:
                    msg = r.text
                raise RuntimeError(f"Gemini {r.status_code}: {msg}")
            data = r.json()
            for m in data.get("models", []):
                if "generateContent" not in (m.get("supportedGenerationMethods") or []):
                    continue
                # "models/gemini-2.5-flash" -> "gemini-2.5-flash"
                raw_id = m.get("name", "")
                short_id = raw_id.split("/", 1)[1] if "/" in raw_id else raw_id
                if not _is_compatible_model(short_id):
                    continue
                collected.append({
                    "id": short_id,
                    "displayName": m.get("displayName") or short_id,
                    "description": m.get("description") or "",
                    "inputTokenLimit": m.get("inputTokenLimit"),
                    "outputTokenLimit": m.get("outputTokenLimit"),
                })
            page_token = data.get("nextPageToken") or None
            if not page_token:
                break

    # Python sort is stable, so two passes give us:
    # -latest aliases at top, everything else ordered by id descending
    # ("gemini-2.5-*" > "gemini-2.0-*" > "gemini-1.5-*" as a lexical proxy for version).
    collected.sort(key=lambda m: m["id"], reverse=True)
    collected.sort(key=lambda m: 0 if m["id"].endswith("-latest") else 1)

    _models_cache[fp] = (now, collected)
    return collected
