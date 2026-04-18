#!/usr/bin/env python3
# Cucumber NewsScraper — static file server, LM Studio proxy, feed and comment API routes.
#
# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Daniel Mengel
#
"""
Serve the dashboard and proxy LM Studio REST in one process (recommended local setup).

When you open the app from this server (e.g. http://127.0.0.1:8080/index.html) and enable
in KI settings: REST mode + "REST via same page origin", the browser sends POST /api/v1/chat
and GET /api/v1/models (and GET /v1/models as fallback) to the **same** origin — **no CORS preflight (OPTIONS)** is sent to LM Studio, so LM Studio
will not log: Unexpected endpoint or method. (OPTIONS /api/v1/chat).

The proxy to LM Studio runs server-side (Python → http://127.0.0.1:1234), so no browser CORS.

Usage:
  python3 scripts/dev_server.py
  python3 scripts/dev_server.py --port 8080 --target http://127.0.0.1:1234

Then open: http://127.0.0.1:8080/index.html
In KI-Server: REST v1, check "REST über dieselbe Origin …", Save.
"""

from __future__ import annotations

import argparse
import html
import http.client
import json
import os
import re
import sys
import time
import xml.etree.ElementTree as ET
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from typing import Optional
from urllib.parse import parse_qs, quote_plus, unquote, urljoin, urlparse
from urllib.request import Request, urlopen

MEDIA_RSS_NS = "http://search.yahoo.com/mrss/"
ET.register_namespace("media", MEDIA_RSS_NS)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_LM = "http://127.0.0.1:1234"
DEFAULT_PORT = 8080
DEFAULT_BIND = "127.0.0.1"
HEISE_ORIGIN = "https://www.heise.de"
HEISE_PREFIX = HEISE_ORIGIN + "/"
BILD_ORIGIN = "https://www.bild.de"
BILD_PREFIX = BILD_ORIGIN + "/"
BILD_FEED_URL = "https://www.bild.de/feed/home.xml"
TELEPOLIS_ORIGIN = "https://www.telepolis.de"
TELEPOLIS_PREFIX = TELEPOLIS_ORIGIN + "/"
TELEPOLIS_FEED_URL = "https://www.telepolis.de/news-atom.xml"
# url -> {"t": float, "xml": str}
_heise_feed_cache_by_url: dict[str, dict[str, object]] = {}
_bild_rss_cache: dict[str, object] = {"t": 0.0, "xml": ""}
_telepolis_feed_cache: dict[str, object] = {"t": 0.0, "xml": ""}
GOLEM_ORIGIN = "https://www.golem.de"
GOLEM_PREFIX = GOLEM_ORIGIN + "/"
GOLEM_RSS_URL = "https://rss.golem.de/rss.php?feed=RSS2.0"
# RSS 2.0 slash module: comment counts on items
SLASH_COMMENTS_TAG = "{http://purl.org/rss/1.0/modules/slash/}comments"
_golem_rss_cache: dict[str, object] = {"t": 0.0, "xml": ""}
T3N_RSS_URL = "https://t3n.de/rss.xml"
_t3n_rss_cache: dict[str, object] = {"t": 0.0, "xml": ""}
IT_ADMINISTRATOR_RSS_URL = "https://www.it-administrator.de/rss.xml"
_it_administrator_rss_cache: dict[str, object] = {"t": 0.0, "xml": ""}
VERGE_FEED_URL = "https://www.theverge.com/rss/index.xml"
VERGE_RSS_PREFIX = "https://www.theverge.com/rss/"
# url -> {"t": float, "xml": str}
_verge_feed_cache_by_url: dict[str, dict[str, object]] = {}
_source_feed_cache_by_key: dict[str, dict[str, object]] = {}
COMPUTERBASE_PREFIX = "https://www.computerbase.de/"
T3N_ART_PREFIX = "https://t3n.de/"
VERGE_PREFIX = "https://www.theverge.com/"
FETCH_TIMEOUT = 25
FETCH_UA = "Mozilla/5.0 (compatible; HeiseDashboard/1.0; +local dev_server)"
SOURCE_FEED_CACHE_TTL = 300.0
SOURCE_FEED_OG_IMAGE_ENRICH_HOST_SUFFIXES = ("arabnews.com",)
REDDIT_SEARCH_TIMEOUT = 18
REDDIT_SEARCH_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
)
URL_CHECK_TIMEOUT = 14
ARTICLE_IMAGE_TIMEOUT = 20
ARTICLE_IMAGE_MAX_BYTES = 8 * 1024 * 1024
ARTICLE_IMAGE_ALLOWED_HOST_SUFFIXES = (
    "heise.de",
    "bild.de",
    "heise.cloudimg.io",
    "telepolis.de",
    "golem.de",
    "computerbase.de",
    "t3n.de",
    "theverge.com",
    "it-administrator.de",
)

_LM_REASONING_ALLOWED = frozenset({"off", "low", "medium", "high", "on"})
_LM_REDDIT_QUERY_TIMEOUT = 12
_lm_model_cache: dict[str, object] = {"model": "", "t": 0.0}

# Words dropped when building Reddit search + relevance scoring (DE/EN noise).
_REDDIT_STOPWORDS = frozenset(
    {
        "a",
        "an",
        "and",
        "are",
        "as",
        "at",
        "auf",
        "aus",
        "bei",
        "bin",
        "bis",
        "but",
        "by",
        "das",
        "dass",
        "dem",
        "den",
        "der",
        "des",
        "die",
        "ein",
        "eine",
        "einem",
        "einen",
        "einer",
        "eines",
        "er",
        "es",
        "for",
        "from",
        "hat",
        "how",
        "im",
        "in",
        "ist",
        "mit",
        "nach",
        "nicht",
        "not",
        "oder",
        "of",
        "on",
        "or",
        "sich",
        "sind",
        "the",
        "this",
        "to",
        "und",
        "von",
        "vor",
        "war",
        "was",
        "what",
        "when",
        "where",
        "who",
        "why",
        "wie",
        "wird",
        "with",
        "zu",
        "zum",
        "zur",
        "am",
        "ans",
        "new",
        "news",
        "update",
        "live",
        "blog",
        "video",
        "photo",
    }
)


def _reddit_tokenize_headline(s: str) -> list[str]:
    """Lowercase word tokens (letters/digits/umlauts); skips stopwords and very short tokens."""
    if not s or not isinstance(s, str):
        return []
    words = re.findall(r"[0-9A-Za-zäöüÄÖÜß]+", s)
    out: list[str] = []
    for w in words:
        wl = w.lower()
        if len(wl) < 2:
            continue
        if wl in _REDDIT_STOPWORDS:
            continue
        out.append(wl)
    return out


def _reddit_normalize_article_headline(raw: str) -> str:
    """
    Use the main headline only (strip portal suffix after '|', trim boilerplate).
    """
    s = (raw or "").strip()
    if not s:
        return ""
    if "|" in s:
        s = s.split("|", 1)[0].strip()
    for sep in ("\n", "–", "—"):
        if sep in s and len(s.split(sep, 1)[0].strip()) >= 12:
            s = s.split(sep, 1)[0].strip()
            break
    if len(s) > 220:
        s = s[:220].rsplit(" ", 1)[0].strip()
    return s


def _reddit_build_search_query_from_tokens(tokens: list[str], max_words: int = 9) -> str:
    """Short keyword query (ordered) for Reddit search — long titles hurt relevance."""
    if not tokens:
        return ""
    # Prefer earlier words (headline lead); cap length.
    picked: list[str] = []
    for w in tokens:
        if len(picked) >= max_words:
            break
        picked.append(w)
    return " ".join(picked)


def _reddit_post_matches_headline(headline_tokens: list[str], post_title: str) -> bool:
    """
    Keep Reddit hits only if title shares enough content words with the article headline.
    """
    if not headline_tokens or not post_title:
        return False
    hset = set(headline_tokens)
    ptoks = _reddit_tokenize_headline(post_title)
    if not ptoks:
        return False
    pset = set(ptoks)
    overlap = hset & pset
    if not overlap:
        return False
    nh = len(hset)
    if nh <= 2:
        return len(overlap) >= 1
    if nh <= 4:
        return len(overlap) >= 2 or any(len(w) >= 6 for w in overlap)
    if len(overlap) >= 2:
        return True
    if any(len(w) >= 7 for w in overlap):
        return True
    # One shared content word (e.g. product name) if it is long enough
    if len(overlap) == 1:
        w = next(iter(overlap))
        if len(w) >= 6:
            return True
    return False


def _extract_lm_response_text(data: object) -> str:
    """Extract assistant message text from LM Studio REST v1 or OpenAI-compatible response."""
    if not isinstance(data, dict):
        return ""
    output = data.get("output")
    if isinstance(output, list):
        for item in output:
            if not isinstance(item, dict):
                continue
            if str(item.get("type", "")).lower() == "reasoning":
                continue
            content = item.get("content") or item.get("message") or item.get("text") or ""
            if isinstance(content, str) and content.strip():
                return content.strip()
            if isinstance(content, list):
                for part in content:
                    if isinstance(part, dict):
                        t = part.get("text", "")
                        if isinstance(t, str) and t.strip():
                            return t.strip()
                    elif isinstance(part, str) and part.strip():
                        return part.strip()
    choices = data.get("choices")
    if isinstance(choices, list) and choices:
        msg = (choices[0] or {}).get("message") or {}
        content = msg.get("content", "")
        if isinstance(content, str) and content.strip():
            return content.strip()
    return ""


def _lm_get_model_name(lm_target: str) -> str:
    """Get the first loaded model id from LM Studio (cached 5 min)."""
    now = time.time()
    cached_model = str(_lm_model_cache.get("model") or "")
    cached_t = float(_lm_model_cache.get("t") or 0.0)
    if cached_model and (now - cached_t) < 300:
        return cached_model
    parsed = urlparse(lm_target)
    host = parsed.hostname or "127.0.0.1"
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    try:
        if parsed.scheme == "https":
            conn = http.client.HTTPSConnection(host, port, timeout=6)
        else:
            conn = http.client.HTTPConnection(host, port, timeout=6)
        try:
            conn.request("GET", "/v1/models", headers={"Accept": "application/json"})
            resp = conn.getresponse()
            body = resp.read().decode("utf-8", errors="replace")
            data = json.loads(body)
            models = data.get("data") or []
            if models and isinstance(models[0], dict):
                mid = str(models[0].get("id", "")).strip()
                if mid:
                    _lm_model_cache["model"] = mid
                    _lm_model_cache["t"] = now
                    return mid
        finally:
            conn.close()
    except Exception:
        pass
    return ""


_REDDIT_AI_SYSTEM_PROMPT = (
    "You are a Reddit search query optimizer. Given a news article headline "
    "(possibly in German or another language), generate 2-3 short English search "
    "queries optimized for finding relevant Reddit discussions.\n\n"
    "Rules:\n"
    "- Translate non-English terms to English\n"
    "- Keep product names, company names, and proper nouns as-is\n"
    "- Each query should be 2-5 words\n"
    "- Use terminology commonly found on Reddit\n"
    "- Cover different angles of the topic\n\n"
    'Return ONLY a JSON object: {"queries": ["query1", "query2"]}\n'
    "No markdown fences, no explanations, just the raw JSON."
)


def _lm_call_reddit_chat(
    model: str, headline: str, lm_target: str, reasoning: str | None
) -> list[str]:
    """Single LM Studio chat call; returns parsed query list or empty."""
    body_obj: dict[str, object] = {
        "model": model,
        "input": f"News headline: {headline}",
        "system_prompt": _REDDIT_AI_SYSTEM_PROMPT,
        "temperature": 0.3,
        "max_output_tokens": 300,
        "stream": False,
        "store": False,
    }
    if reasoning is not None:
        body_obj["reasoning"] = reasoning
    body = json.dumps(body_obj, ensure_ascii=False).encode("utf-8")
    parsed = urlparse(lm_target)
    host = parsed.hostname or "127.0.0.1"
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    if parsed.scheme == "https":
        conn = http.client.HTTPSConnection(host, port, timeout=_LM_REDDIT_QUERY_TIMEOUT)
    else:
        conn = http.client.HTTPConnection(host, port, timeout=_LM_REDDIT_QUERY_TIMEOUT)
    try:
        conn.request(
            "POST",
            "/api/v1/chat",
            body=body,
            headers={"Content-Type": "application/json", "Content-Length": str(len(body))},
        )
        resp = conn.getresponse()
        status = resp.status
        resp_body = resp.read().decode("utf-8", errors="replace")
        data = json.loads(resp_body)
    finally:
        conn.close()

    if status >= 400:
        err_msg = ""
        err_obj = data.get("error") if isinstance(data, dict) else None
        if isinstance(err_obj, dict):
            err_msg = str(err_obj.get("message", ""))
        raise ValueError(f"HTTP {status}: {err_msg}")

    text = _extract_lm_response_text(data)
    if not text:
        return []
    start = text.find("{")
    end = text.rfind("}") + 1
    if start < 0 or end <= start:
        return []
    result = json.loads(text[start:end])
    queries = result.get("queries", [])
    return [q.strip() for q in queries if isinstance(q, str) and q.strip()]


def _lm_optimize_reddit_queries(headline: str, lm_target: str, reasoning: str | None = None) -> list[str]:
    """Ask LM Studio to generate optimized Reddit search queries from a headline."""
    model = _lm_get_model_name(lm_target)
    if not model:
        return []

    if reasoning is None:
        r = None
    else:
        r = reasoning if reasoning in _LM_REASONING_ALLOWED else "off"

    try:
        out = _lm_call_reddit_chat(model, headline, lm_target, r)
        if out:
            print(f"[reddit-ai] AI queries for '{headline[:60]}…': {out}", file=sys.stderr)
            return out
    except (ValueError, json.JSONDecodeError) as e:
        err_str = str(e).lower()
        if "reasoning" in err_str:
            print(f"[reddit-ai] reasoning='{r}' rejected, retrying without reasoning field", file=sys.stderr)
            try:
                out = _lm_call_reddit_chat(model, headline, lm_target, None)
                if out:
                    print(f"[reddit-ai] AI queries (no-reasoning retry) for '{headline[:60]}…': {out}", file=sys.stderr)
                    return out
            except Exception as e2:
                print(f"[reddit-ai] retry also failed: {e2}", file=sys.stderr)
        else:
            print(f"[reddit-ai] LM query failed: {e}", file=sys.stderr)
    except Exception as e:
        print(f"[reddit-ai] LM query failed: {e}", file=sys.stderr)

    print("[reddit-ai] LM returned no usable response", file=sys.stderr)
    return []


def build_reddit_search_payload_ai(
    query: str, limit: int, lm_target: str, reasoning: str | None = None
) -> dict[str, object]:
    """
    AI-enhanced Reddit search: asks LM Studio for optimized queries, searches Reddit
    with each, merges results. Falls back to standard search if AI is unavailable.
    """
    if not query or not isinstance(query, str):
        return {"ok": False, "error": "empty_query", "results": [], "query": "", "query_search": ""}

    headline_norm = _reddit_normalize_article_headline(query)
    if not headline_norm:
        return {"ok": False, "error": "empty_query", "results": [], "query": "", "query_search": ""}

    ai_queries = _lm_optimize_reddit_queries(headline_norm, lm_target, reasoning)
    if not ai_queries:
        return build_reddit_search_payload(query, limit)

    try:
        lim = int(limit)
    except (TypeError, ValueError):
        lim = 5
    lim = max(1, min(5, lim))

    seen_permalinks: set[str] = set()
    results: list[dict[str, str]] = []
    used_queries: list[str] = []
    fetch_n = min(50, max(25, lim * 10))

    for qi, search_q in enumerate(ai_queries[:3]):
        if not search_q or len(results) >= lim:
            break
        if qi > 0:
            time.sleep(1.0)
        used_queries.append(search_q)
        encoded = quote_plus(search_q[:350])
        url = (
            f"https://www.reddit.com/search.json?q={encoded}"
            f"&limit={fetch_n}&sort=relevance&type=link&raw_json=1"
        )
        try:
            req = Request(
                url,
                headers={
                    "User-Agent": REDDIT_SEARCH_UA,
                    "Accept": "application/json, text/plain, */*",
                    "Accept-Language": "de,en-US;q=0.9,en;q=0.8",
                },
                method="GET",
            )
            with urlopen(req, timeout=REDDIT_SEARCH_TIMEOUT) as resp:
                resp_body = resp.read()
            text = resp_body.decode("utf-8", errors="replace")
            data = json.loads(text)
        except (HTTPError, URLError, TimeoutError, OSError, json.JSONDecodeError, ValueError) as e:
            print(f"[reddit-ai] Reddit fetch FAILED for '{search_q}': {e}", file=sys.stderr)
            continue

        children = (data.get("data") or {}).get("children") or []
        added = 0
        print(
            f"[reddit-ai] query #{qi+1} '{search_q}' → {len(children)} candidates",
            file=sys.stderr,
        )
        for ch in children:
            if len(results) >= lim:
                break
            if not isinstance(ch, dict) or ch.get("kind") != "t3":
                continue
            d = ch.get("data") or {}
            if not isinstance(d, dict):
                continue
            title = (d.get("title") or "").strip()
            permalink = (d.get("permalink") or "").strip()
            if not title or not permalink:
                continue
            if permalink in seen_permalinks:
                continue
            seen_permalinks.add(permalink)
            if permalink.startswith("/"):
                full_url = "https://www.reddit.com" + permalink
            elif permalink.startswith("http"):
                full_url = permalink
            else:
                full_url = "https://www.reddit.com/" + permalink.lstrip("/")
            results.append({"title": title, "url": full_url})
            added += 1
        if added:
            print(f"[reddit-ai] → kept {added} results (total {len(results)})", file=sys.stderr)
        if len(results) >= lim:
            break

    if not results:
        print(
            "[reddit-ai] AI queries returned no results, falling back to keyword search",
            file=sys.stderr,
        )
        fallback = build_reddit_search_payload(query, limit)
        fallback["ai_queries"] = used_queries
        fallback["ai_enhanced"] = True
        return fallback

    print(
        f"[reddit-ai] Returning {len(results)} results from AI queries",
        file=sys.stderr,
    )
    return {
        "ok": True,
        "results": results[:lim],
        "query": headline_norm,
        "query_search": " | ".join(used_queries),
        "ai_enhanced": True,
        "ai_queries": used_queries,
    }


def check_remote_article_url(target: str) -> dict[str, object]:
    """
    Lightweight HTTP probe for KI alternative links: only mark drop=True for clear 404/410.
    403/429/5xx/connection errors keep the URL (browser may still open it).
    """
    out: dict[str, object] = {"drop": False, "status": 0}
    if not target or not isinstance(target, str):
        out["error"] = "empty"
        return out
    t = target.strip()
    if len(t) > 2048:
        out["error"] = "too_long"
        return out
    try:
        p = urlparse(t)
    except Exception:
        out["error"] = "parse"
        return out
    if p.scheme not in ("http", "https"):
        out["error"] = "scheme"
        return out

    def try_head() -> Optional[int]:
        try:
            req = Request(t, headers={"User-Agent": FETCH_UA}, method="HEAD")
            with urlopen(req, timeout=URL_CHECK_TIMEOUT) as resp:
                return int(resp.getcode())
        except HTTPError as e:
            return int(e.code)
        except Exception:
            return None

    def try_get_range() -> Optional[int]:
        try:
            req = Request(
                t,
                headers={"User-Agent": FETCH_UA, "Range": "bytes=0-0"},
                method="GET",
            )
            with urlopen(req, timeout=URL_CHECK_TIMEOUT) as resp:
                code = int(resp.getcode())
                try:
                    resp.read(256)
                except Exception:
                    pass
                return code
        except HTTPError as e:
            return int(e.code)
        except Exception:
            return None

    code = try_head()
    if code is not None:
        if code in (404, 410):
            out["drop"] = True
            out["status"] = code
            return out
        if 200 <= code < 400:
            out["status"] = code
            return out
        if code in (403, 401, 429):
            out["status"] = code
            return out
        if code >= 500:
            out["status"] = code
            return out
        # 405 Method Not Allowed → try GET
        if code != 405:
            out["status"] = code
            return out

    code2 = try_get_range()
    if code2 is None:
        out["error"] = "fetch_failed"
        return out
    out["status"] = code2
    out["drop"] = code2 in (404, 410)
    return out


def _bing_news_extract_article_url(bing_link: str) -> str:
    """Resolve Bing News RSS redirect URL to the publisher article URL."""
    s = (bing_link or "").strip()
    if not s:
        return ""
    try:
        q = urlparse(s)
        qs = parse_qs(q.query)
        if "url" in qs and qs["url"]:
            return unquote(qs["url"][0]).strip()
    except Exception:
        pass
    return s


def _normalize_source_feed_label(raw: str) -> str:
    s = " ".join(str(raw or "").split()).strip()
    if not s:
        return ""
    return s[:120]


def _normalize_source_feed_lang(raw: str) -> str:
    s = str(raw or "").strip().lower()
    if re.fullmatch(r"[a-z]{2,8}", s):
        return s
    return "en"


def _normalize_source_feed_site(raw: str) -> str:
    s = str(raw or "").strip().lower()
    if not s:
        return ""
    try:
        if "://" in s:
            u = urlparse(s)
            host = (u.hostname or "").lower()
            if host.startswith("www."):
                host = host[4:]
            s = host + (u.path or "")
    except Exception:
        pass
    if s.startswith("www."):
        s = s[4:]
    cut = len(s)
    for sep in ("?", "#"):
        pos = s.find(sep)
        if pos >= 0:
            cut = min(cut, pos)
    s = s[:cut]
    s = re.sub(r"/{2,}", "/", s).rstrip("/")
    if " " in s or "." not in s or not re.fullmatch(r"[a-z0-9./-]+", s):
        return ""
    return s


def _normalize_source_feed_site_url(raw: str) -> str:
    s = str(raw or "").strip()
    if not s:
        return ""
    try:
        u = urlparse(s)
        if u.scheme != "https" or not u.hostname:
            return ""
        host = u.hostname.lower()
        path = re.sub(r"/{2,}", "/", u.path or "")
        if path != "/" and path.endswith("/"):
            path = path[:-1]
        return f"https://{host}{path or ''}"
    except Exception:
        return ""


def _normalize_source_feed_direct_url(raw: str) -> str:
    s = str(raw or "").strip()
    if not s:
        return ""
    try:
        u = urlparse(s)
        if u.scheme != "https" or not u.hostname:
            return ""
        host = u.hostname.lower()
        path = re.sub(r"/{2,}", "/", u.path or "")
        query = f"?{u.query}" if u.query else ""
        return f"https://{host}{path or '/'}{query}"
    except Exception:
        return ""


def _default_bing_market_for_language(lang: str) -> str:
    code = _normalize_source_feed_lang(lang)
    mapping = {
        "de": "de-DE",
        "fr": "fr-FR",
        "it": "it-IT",
        "es": "es-ES",
        "pt": "pt-BR",
        "ja": "ja-JP",
        "ko": "ko-KR",
    }
    return mapping.get(code, "en-US")


def _build_bing_site_query(sites: list[str]) -> str:
    normalized = [f"site:{s}" for s in sites if s]
    return " OR ".join(normalized).strip()


def _bing_news_rss_search_with_fallback(query: str, limit: int, lang: str, mkt: str) -> dict[str, object]:
    attempts: list[str] = []
    preferred = (mkt or "").strip() or _default_bing_market_for_language(lang)
    fallback = _default_bing_market_for_language(lang)
    for mk in (preferred, fallback, "en-US"):
        if not mk or mk in attempts:
            continue
        attempts.append(mk)
        payload = bing_news_rss_search(query, limit, mk)
        if payload.get("ok") is True and payload.get("results"):
            payload["mkt_used"] = mk
            return payload
        last = payload
    if attempts:
        last["mkt_used"] = attempts[-1]
    return last


def _build_source_feed_rss_xml(
    label: str,
    site_url: str,
    lang: str,
    items: list[dict[str, str]],
    description: str | None = None,
) -> str:
    rss = ET.Element("rss", version="2.0")
    channel = ET.SubElement(rss, "channel")
    ET.SubElement(channel, "title").text = label
    ET.SubElement(channel, "link").text = site_url
    ET.SubElement(channel, "description").text = (
        str(description).strip() if description and str(description).strip() else f"{label} feed"
    )
    ET.SubElement(channel, "language").text = _normalize_source_feed_lang(lang)
    ET.SubElement(channel, "generator").text = "Cucumber NewsScraper dev_server.py"
    ET.SubElement(channel, "lastBuildDate").text = time.strftime("%a, %d %b %Y %H:%M:%S GMT", time.gmtime())
    for row in items:
        title = str(row.get("title") or "").strip()
        url = str(row.get("url") or "").strip()
        if not title or not url:
            continue
        item = ET.SubElement(channel, "item")
        ET.SubElement(item, "title").text = title
        ET.SubElement(item, "link").text = url
        guid = ET.SubElement(item, "guid")
        guid.set("isPermaLink", "true")
        guid.text = url
        published_at = str(row.get("publishedAt") or "").strip()
        if published_at:
            ET.SubElement(item, "pubDate").text = published_at
        thumbnail_url = str(row.get("thumbnailUrl") or "").strip()
        if thumbnail_url:
            media_content = ET.SubElement(item, f"{{{MEDIA_RSS_NS}}}content")
            media_content.set("url", thumbnail_url)
            media_content.set("medium", "image")
        source_name = str(row.get("sourceName") or row.get("source") or "").strip()
        source_url = str(row.get("sourceUrl") or "").strip()
        if source_name:
            source_el = ET.SubElement(item, "source")
            if source_url:
                source_el.set("url", source_url)
            source_el.text = source_name
    xml = ET.tostring(rss, encoding="utf-8", xml_declaration=True)
    return xml.decode("utf-8", errors="replace")


def _google_news_feed_url_for_language(lang: str) -> str:
    code = _normalize_source_feed_lang(lang)
    mapping = {
        "de": "https://news.google.com/rss?hl=de&gl=DE&ceid=DE:de",
        "fr": "https://news.google.com/rss?hl=fr&gl=FR&ceid=FR:fr",
        "it": "https://news.google.com/rss?hl=it&gl=IT&ceid=IT:it",
        "es": "https://news.google.com/rss?hl=es-419&gl=US&ceid=US:es-419",
        "pt": "https://news.google.com/rss?hl=pt-BR&gl=BR&ceid=BR:pt-419",
        "ja": "https://news.google.com/rss?hl=ja&gl=JP&ceid=JP:ja",
        "ko": "https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko",
    }
    return mapping.get(code, "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en")


def _get_cached_source_feed_xml(cache_key: str) -> str:
    slot = _source_feed_cache_by_key.get(cache_key)
    if not slot:
        return ""
    xml = str(slot.get("xml") or "")
    t0 = float(slot.get("t") or 0.0)
    if xml and time.time() - t0 < SOURCE_FEED_CACHE_TTL:
        return xml
    return ""


def _put_cached_source_feed_xml(cache_key: str, xml: str) -> None:
    _source_feed_cache_by_key[cache_key] = {"xml": xml, "t": time.time()}


def _source_feed_host_in_allowlist(url: str, allowed_suffixes: tuple[str, ...]) -> bool:
    target = str(url or "").strip()
    if not target:
        return False
    try:
        parsed = urlparse(target)
    except Exception:
        return False
    if parsed.scheme != "https":
        return False
    return _host_matches_allowed_suffix(parsed.hostname or "", allowed_suffixes)


def _extract_meta_content_value(tag_html: str, key: str) -> str:
    pattern = re.compile(
        rf"""\b{re.escape(key)}\s*=\s*(['"])(.*?)\1""",
        re.IGNORECASE | re.DOTALL,
    )
    match = pattern.search(tag_html)
    if not match:
        return ""
    return html.unescape((match.group(2) or "").strip())


def _extract_article_og_image_from_html(doc_html: str, article_url: str) -> str:
    raw = str(doc_html or "")
    if not raw:
        return ""
    for meta_tag in re.findall(r"<meta\b[^>]*>", raw, flags=re.IGNORECASE):
        prop = _extract_meta_content_value(meta_tag, "property").lower()
        name = _extract_meta_content_value(meta_tag, "name").lower()
        if prop not in ("og:image", "og:image:url") and name not in ("twitter:image", "twitter:image:src"):
            continue
        content = _extract_meta_content_value(meta_tag, "content")
        if not content:
            continue
        try:
            resolved = urljoin(article_url, content)
            parsed = urlparse(resolved)
            if parsed.scheme != "https" or not parsed.hostname:
                continue
            return resolved
        except Exception:
            continue
    return ""


def _fetch_article_og_image_url(article_url: str) -> str:
    target = str(article_url or "").strip()
    if not target:
        return ""
    req = Request(
        target,
        headers={
            "User-Agent": FETCH_UA,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
    )
    with urlopen(req, timeout=FETCH_TIMEOUT) as resp:
        content_type = str(resp.headers.get("Content-Type") or "").split(";", 1)[0].strip().lower()
        if content_type and "html" not in content_type:
            return ""
        doc_html = resp.read(512 * 1024).decode("utf-8", errors="replace")
    return _extract_article_og_image_from_html(doc_html, target)


def _rss_item_has_image_node(item: ET.Element) -> bool:
    for child in list(item):
        local_name = str(child.tag or "").split("}", 1)[-1].strip().lower()
        if not local_name:
            continue
        rel = str(child.attrib.get("rel") or "").strip().lower()
        medium = str(child.attrib.get("medium") or "").strip().lower()
        content_type = str(child.attrib.get("type") or "").strip().lower()
        if local_name == "thumbnail" or local_name.endswith(":thumbnail"):
            return True
        is_image_carrier = (
            local_name == "enclosure"
            or local_name == "content"
            or local_name.endswith(":content")
            or (local_name == "link" and rel == "enclosure")
        )
        is_image_type = medium == "image" or content_type.startswith("image/")
        if is_image_carrier and is_image_type:
            return True
    return False


def _enrich_direct_rss_with_article_images(feed_xml: str, feed_url: str) -> str:
    if not _source_feed_host_in_allowlist(feed_url, SOURCE_FEED_OG_IMAGE_ENRICH_HOST_SUFFIXES):
        return feed_xml
    try:
        root = ET.fromstring(feed_xml.encode("utf-8"))
    except ET.ParseError:
        return feed_xml
    changed = False
    for item in root.findall("./channel/item"):
        if _rss_item_has_image_node(item):
            continue
        article_url = str(item.findtext("link") or "").strip()
        if not _source_feed_host_in_allowlist(article_url, SOURCE_FEED_OG_IMAGE_ENRICH_HOST_SUFFIXES):
            continue
        try:
            image_url = _fetch_article_og_image_url(article_url)
        except (HTTPError, URLError, TimeoutError, OSError):
            image_url = ""
        if not image_url:
            continue
        media_content = ET.SubElement(item, f"{{{MEDIA_RSS_NS}}}content")
        media_content.set("url", image_url)
        media_content.set("medium", "image")
        changed = True
    if not changed:
        return feed_xml
    xml_bytes = ET.tostring(root, encoding="utf-8", xml_declaration=True)
    return xml_bytes.decode("utf-8", errors="replace")


def build_reddit_search_payload(query: str, limit: int = 5) -> dict[str, object]:
    """
    Reddit global search (JSON API). Normalizes the article headline, uses a short keyword query,
    fetches extra candidates, then drops threads whose title does not share enough words with the headline.
    """
    if not query or not isinstance(query, str):
        return {"ok": False, "error": "empty_query", "results": [], "query": "", "query_search": ""}

    headline_norm = _reddit_normalize_article_headline(query)
    if not headline_norm:
        return {"ok": False, "error": "empty_query", "results": [], "query": "", "query_search": ""}

    headline_tokens = _reddit_tokenize_headline(headline_norm)
    search_q = _reddit_build_search_query_from_tokens(headline_tokens, max_words=9)
    if not search_q:
        search_q = " ".join(headline_norm.split()[:8]).strip()
    if not search_q:
        return {"ok": False, "error": "empty_query", "results": [], "query": headline_norm, "query_search": ""}

    tokens_for_match = headline_tokens
    if not tokens_for_match:
        tokens_for_match = [w.lower() for w in re.findall(r"[0-9A-Za-zäöüÄÖÜß]{3,}", headline_norm)]

    try:
        lim = int(limit)
    except (TypeError, ValueError):
        lim = 5
    lim = max(1, min(5, lim))
    encoded = quote_plus(search_q[:350])
    fetch_n = min(50, max(25, lim * 10))
    url = (
        f"https://www.reddit.com/search.json?q={encoded}"
        f"&limit={fetch_n}&sort=relevance&type=link&raw_json=1"
    )
    try:
        req = Request(
            url,
            headers={
                "User-Agent": REDDIT_SEARCH_UA,
                "Accept": "application/json, text/plain, */*",
                "Accept-Language": "de,en-US;q=0.9,en;q=0.8",
            },
            method="GET",
        )
        with urlopen(req, timeout=REDDIT_SEARCH_TIMEOUT) as resp:
            body = resp.read()
        text = body.decode("utf-8", errors="replace")
        data = json.loads(text)
    except (HTTPError, URLError, TimeoutError, OSError, json.JSONDecodeError, ValueError) as e:
        return {
            "ok": False,
            "error": str(e),
            "results": [],
            "query": headline_norm,
            "query_search": search_q,
        }

    children = (data.get("data") or {}).get("children") or []
    results: list[dict[str, str]] = []
    for ch in children:
        if len(results) >= lim:
            break
        if not isinstance(ch, dict) or ch.get("kind") != "t3":
            continue
        d = ch.get("data") or {}
        if not isinstance(d, dict):
            continue
        title = (d.get("title") or "").strip()
        permalink = (d.get("permalink") or "").strip()
        if not title or not permalink:
            continue
        if tokens_for_match:
            if not _reddit_post_matches_headline(tokens_for_match, title):
                continue
        if permalink.startswith("/"):
            full_url = "https://www.reddit.com" + permalink
        elif permalink.startswith("http"):
            full_url = permalink
        else:
            full_url = "https://www.reddit.com/" + permalink.lstrip("/")
        results.append({"title": title, "url": full_url})

    return {
        "ok": True,
        "results": results,
        "query": headline_norm,
        "query_search": search_q,
    }


def bing_news_rss_search(query: str, limit: int, mkt: str) -> dict[str, object]:
    """
    Fetch Bing News RSS (format=rss) and return publisher article URLs + titles.
    Used by the dashboard so alternative links do not rely on the LLM inventing URLs.
    """
    out: dict[str, object] = {"ok": False, "results": []}
    if not query or not isinstance(query, str):
        out["error"] = "empty_query"
        return out
    q = query.strip()
    if len(q) > 500:
        q = q[:500]
    try:
        lim = int(limit)
    except (TypeError, ValueError):
        lim = 8
    lim = max(1, min(30, lim))
    mk = (mkt or "en-US").strip()
    if not mk:
        mk = "en-US"

    rss_url = (
        "https://www.bing.com/news/search?q="
        + quote_plus(q)
        + "&format=rss&count="
        + str(lim)
        + "&mkt="
        + quote_plus(mk)
    )
    try:
        req = Request(rss_url, headers={"User-Agent": FETCH_UA})
        with urlopen(req, timeout=FETCH_TIMEOUT) as resp:
            raw = resp.read()
    except Exception as e:
        out["error"] = str(e)
        return out
    try:
        root = ET.fromstring(raw)
    except ET.ParseError as e:
        out["error"] = f"xml: {e}"
        return out

    results: list[dict[str, str]] = []
    seen: set[str] = set()
    for item in root.findall(".//item"):
        title_el = item.findtext("title")
        link_el = item.findtext("link")
        if not link_el:
            continue
        article_url = _bing_news_extract_article_url(link_el.strip())
        if not article_url.startswith("http"):
            continue
        source_txt = ""
        for ch in item:
            if "Source" in ch.tag:
                source_txt = (ch.text or "").strip()
                break
        headline = (title_el or "").strip()
        if not headline:
            continue
        if article_url in seen:
            continue
        seen.add(article_url)
        pub_raw = (item.findtext("pubDate") or "").strip()
        thumbnail_url = ""
        thumbnail_raw = ""
        thumbnail_size_hint = ""

        src_tag = source_txt.upper() if source_txt else ""
        if not src_tag:
            try:
                host = (urlparse(article_url).hostname or "").lower()
                if host.startswith("www."):
                    host = host[4:]
                part = host.split(".")[0] if host else "news"
                src_tag = part.upper()
            except Exception:
                src_tag = "NEWS"
        source_label = source_txt or src_tag
        source_url = ""
        try:
            host = (urlparse(article_url).hostname or "").lower()
            if host:
                source_url = f"https://{host}"
        except Exception:
            source_url = ""
        for ch in item:
            local_tag = str(ch.tag or "").split("}", 1)[-1]
            if local_tag == "ImageSize":
                thumbnail_size_hint = str(ch.text or "").strip()
                continue
            if local_tag == "Image":
                thumbnail_raw = str(ch.text or "").strip()
        if thumbnail_raw:
            thumbnail_url = _normalize_bing_news_image_url(thumbnail_raw, thumbnail_size_hint)

        results.append(
            {
                "title": headline,
                "url": article_url,
                "source": source_label,
                "sourceName": source_label,
                "sourceUrl": source_url,
                "publishedAt": pub_raw,
                "thumbnailUrl": thumbnail_url,
            }
        )
        if len(results) >= lim:
            break

    out["ok"] = True
    out["results"] = results
    return out


def _normalize_bing_news_image_url(raw_url: str, size_hint: str = "") -> str:
    s = str(raw_url or "").strip()
    if not s:
        return ""
    try:
        u = urlparse(s)
    except Exception:
        return ""
    if u.scheme not in ("http", "https") or not u.netloc:
        return ""
    if u.scheme == "http":
        u = u._replace(scheme="https")
    out = u.geturl()
    size_tpl = str(size_hint or "").strip()
    if size_tpl and "{0}" in size_tpl and "{1}" in size_tpl:
        sized = size_tpl.replace("{0}", "640").replace("{1}", "360")
        glue = "&" if "?" in out else "?"
        out = f"{out}{glue}{sized.lstrip('?&')}"
    return out


def _normalize_lm_chat_reasoning_body(body: bytes) -> bytes:
    """
    Normalize JSON `reasoning` before forwarding to /api/v1/chat.
    Maps legacy `none` to `off` and normalizes invalid values to `off`.
    """
    if not body:
        return body
    try:
        data = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError, TypeError, ValueError):
        return body
    if not isinstance(data, dict) or "reasoning" not in data:
        return body
    s = str(data["reasoning"]).strip().lower()
    if s == "none":
        s = "off"
    if s not in _LM_REASONING_ALLOWED:
        s = "off"
    data["reasoning"] = s
    try:
        return json.dumps(data, ensure_ascii=False).encode("utf-8")
    except (TypeError, ValueError):
        return body


# YouTube Data API v3 config
YOUTUBE_API_KEY = os.environ.get("YOUTUBE_API_KEY", "").strip()
YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"


def _youtube_fetch(query: str, max_results: int = 10) -> dict[str, object]:
    """Fetch YouTube videos via Data API v3. Returns {ok: bool, items?: [...], error?: str}."""
    if not YOUTUBE_API_KEY:
        return {"ok": False, "error": "YouTube API key not configured (set YOUTUBE_API_KEY env var)."}
    if not query or len(query) > 500:
        return {"ok": False, "error": "Invalid or empty search query."}
    try:
        url = f"{YOUTUBE_SEARCH_URL}?key={YOUTUBE_API_KEY}&q={query}&part=snippet&type=video&maxResults={min(max_results, 50)}"
        req = Request(url, headers={"User-Agent": FETCH_UA})
        with urlopen(req, timeout=FETCH_TIMEOUT) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        items = []
        for it in (data.get("items") or []):
            snip = it.get("snippet", {})
            vid_id = it.get("id", {}).get("videoId", "")
            if not vid_id:
                continue
            thumb = snip.get("thumbnails", {})
            # Prefer high, then medium, default to thumbnail URL
            th_url = (thumb.get("high") or thumb.get("medium") or thumb.get("default", {})).get("url", "")
            items.append({
                "videoId": vid_id,
                "title": snip.get("title", ""),
                "channelTitle": snip.get("channelTitle", ""),
                "description": (snip.get("description") or "").strip(),
                "thumbnailUrl": th_url,
                "watchUrl": f"https://www.youtube.com/watch?v={vid_id}"
            })
        return {"ok": True, "items": items}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def _heise_abs(url_or_path: str) -> str:
    s = (url_or_path or "").strip()
    if not s:
        return ""
    if s.startswith("http://") or s.startswith("https://"):
        return s
    if s.startswith("//"):
        return "https:" + s
    return HEISE_ORIGIN + (s if s.startswith("/") else "/" + s)


def _telepolis_abs(url_or_path: str) -> str:
    """Convert relative URL to absolute Telepolis URL."""
    s = (url_or_path or "").strip()
    if not s:
        return ""
    if s.startswith("http://") or s.startswith("https://"):
        return s
    if s.startswith("//"):
        return "https:" + s
    return TELEPOLIS_ORIGIN + (s if s.startswith("/") else "/" + s)


def _canonicalize_heise_comments_article_url(article_url: str) -> str:
    """Normalize Heise/Telepolis article URL variants to https://www.* for fetching and allowlisting."""
    s = (article_url or "").strip()
    if not s:
        return s
    low = s.lower()
    tele_prefixes = (
        "https://www.telepolis.de/",
        "https://telepolis.de/",
        "http://www.telepolis.de/",
        "http://telepolis.de/",
    )
    for pfx in tele_prefixes:
        if low.startswith(pfx):
            return TELEPOLIS_ORIGIN + "/" + s[len(pfx) :].lstrip("/")
    heise_prefixes = (
        "https://www.heise.de/",
        "https://heise.de/",
        "http://www.heise.de/",
        "http://heise.de/",
    )
    for pfx in heise_prefixes:
        if low.startswith(pfx):
            return HEISE_ORIGIN + "/" + s[len(pfx) :].lstrip("/")
    return s


def _normalize_forum_thread_url(discussion_url: str, source: str = "heise") -> str:
    """Map .../forum-N/comment/ to .../forum-N/ (thread overview with tree list)."""
    if source == "telepolis":
        u = _telepolis_abs(discussion_url)
    else:
        u = _heise_abs(discussion_url)
    u = u.rstrip("/")
    if u.endswith("/comment"):
        u = u[: -len("/comment")]
    return u + "/"


def _type_is_article_like(t: object) -> bool:
    """Match schema.org NewsArticle, Article, BlogPosting, etc. (Heise+ often uses Article)."""
    if t is None:
        return False
    if isinstance(t, list):
        return any(_type_is_article_like(x) for x in t)
    if not isinstance(t, str):
        return False
    u = t.replace(" ", "").lower()
    if "breadcrumb" in u or u in ("person", "organization", "webpage", "website"):
        return False
    if "newsarticle" in u or "blogposting" in u or "techarticle" in u or "reportage" in u:
        return True
    if u == "article" or u.endswith("/article"):
        return True
    return False


def _walk_json_for_article_ld(obj: object, out: list[dict]) -> None:
    if isinstance(obj, dict):
        t = obj.get("@type")
        if _type_is_article_like(t):
            out.append(obj)
        for v in obj.values():
            _walk_json_for_article_ld(v, out)
    elif isinstance(obj, list):
        for x in obj:
            _walk_json_for_article_ld(x, out)


def _walk_json_find_discussion_fields(obj: object, out: list[dict]) -> None:
    """Collect objects that carry discussionUrl and/or commentCount (unusual @type)."""
    if isinstance(obj, dict):
        du = obj.get("discussionUrl")
        cc = obj.get("commentCount")
        has_d = bool(du and str(du).strip())
        has_c = cc is not None and str(cc).strip() != ""
        if has_d or has_c:
            out.append(obj)
        for v in obj.values():
            _walk_json_find_discussion_fields(v, out)
    elif isinstance(obj, list):
        for x in obj:
            _walk_json_find_discussion_fields(x, out)


def _pick_best_discussion_candidate(candidates: list[dict]) -> dict | None:
    if not candidates:
        return None
    for c in candidates:
        du = str(c.get("discussionUrl") or "").lower()
        if "forum" in du or "heise.de/forum" in du:
            return c
    return candidates[0]


def _article_discussion_rank(obj: dict) -> tuple:
    """Higher tuple sorts later: prefer forum URL, any discussion URL, commentCount."""
    du = str(obj.get("discussionUrl") or "").strip().lower()
    forum = "forum" in du
    has_du = bool(du)
    cc_raw = obj.get("commentCount")
    has_cc = cc_raw is not None and str(cc_raw).strip() != ""
    try:
        ccn = int(cc_raw) if has_cc else -1
    except (TypeError, ValueError):
        ccn = -1
    return (forum, has_du, has_cc, ccn)


def _merge_article_discussion_fields(primary: dict, secondary: dict) -> dict:
    """Fill missing discussionUrl / commentCount from another JSON-LD node (same page)."""
    out = dict(primary)
    if not str(out.get("discussionUrl") or "").strip():
        sdu = secondary.get("discussionUrl")
        if sdu and str(sdu).strip():
            out["discussionUrl"] = sdu
    if out.get("commentCount") in (None, ""):
        scc = secondary.get("commentCount")
        if scc is not None and str(scc).strip() != "":
            out["commentCount"] = scc
    return out


def _pick_best_article_ld(candidates: list[dict]) -> dict:
    """Pick richest article node; merge discussion fields from other article-like objects."""
    if not candidates:
        raise ValueError("candidates must be non-empty")
    ordered = sorted(candidates, key=_article_discussion_rank, reverse=True)
    out = dict(ordered[0])
    for extra in ordered[1:]:
        out = _merge_article_discussion_fields(out, extra)
    return out


def _try_fallback_article_from_raw_html(html: str) -> dict | None:
    """
    When JSON-LD blocks are missing or unparsable: pull discussionUrl / commentCount
    from inline JSON fragments or visible patterns (some Heise+ / SPA shells).
    """
    discussion: str | None = None
    for m in re.finditer(r'"discussionUrl"\s*:\s*"([^"]+)"', html):
        candidate = m.group(1).replace("\\/", "/").strip()
        if not candidate.startswith("http"):
            continue
        if "forum" in candidate.lower() or "heise.de" in candidate:
            discussion = candidate
            break
    if not discussion:
        m = re.search(r"'discussionUrl'\s*:\s*'(https://www\.heise\.de/[^']+)'", html)
        if m:
            discussion = m.group(1).strip()
    comment_count: int | None = None
    m = re.search(r'"commentCount"\s*:\s*(\d+)', html)
    if m:
        comment_count = int(m.group(1))
    if not discussion:
        m = re.search(
            r'href="(https://www\.heise\.de/forum/[^"#?]+)"',
            html,
            re.I,
        )
        if m:
            discussion = m.group(1).rstrip("/")
    if not discussion and comment_count is None:
        return None
    out: dict = {}
    if comment_count is not None:
        out["commentCount"] = comment_count
    if discussion:
        out["discussionUrl"] = discussion
    return out if out else None


def _extract_news_article_from_html(html: str) -> dict | None:
    """
    Scan every application/ld+json block. Heise may emit several graphs; the first Article
    node is not always the one that carries discussionUrl/commentCount.
    """
    all_articles: list[dict] = []
    best_discussion_only: dict | None = None
    best_disc_rank: tuple = (-1, False, False, -1)

    for m in re.finditer(
        r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>([\s\S]*?)</script>',
        html,
        re.I,
    ):
        raw = m.group(1).strip()
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        found: list[dict] = []
        _walk_json_for_article_ld(data, found)
        all_articles.extend(found)
        candidates: list[dict] = []
        _walk_json_find_discussion_fields(data, candidates)
        best_in_block = _pick_best_discussion_candidate(candidates)
        if best_in_block:
            r = _article_discussion_rank(best_in_block)
            if r > best_disc_rank:
                best_disc_rank = r
                best_discussion_only = best_in_block

    if all_articles:
        merged = _pick_best_article_ld(all_articles)
        if best_discussion_only:
            merged = _merge_article_discussion_fields(merged, best_discussion_only)
        return merged
    if best_discussion_only:
        return dict(best_discussion_only)
    fb = _try_fallback_article_from_raw_html(html)
    if fb:
        return fb
    return None


def _http_get_text(url: str) -> tuple[int, str]:
    req = Request(
        url,
        headers={
            "User-Agent": FETCH_UA,
            "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "de,en-US;q=0.9,en;q=0.8",
        },
        method="GET",
    )
    with urlopen(req, timeout=FETCH_TIMEOUT) as resp:
        body = resp.read()
        status = resp.getcode() or 200
    text = body.decode("utf-8", errors="replace")
    return status, text


def _parse_int_loose(v: object) -> int | None:
    if v is None:
        return None
    try:
        return int(str(v).strip())
    except (TypeError, ValueError):
        return None


def _forum_posting_subject_plain(html_fragment: str) -> str | None:
    """Strip tags and decode entities from the posting_subject anchor inner HTML."""
    if not html_fragment or not html_fragment.strip():
        return None
    plain = re.sub(r"<[^>]+>", "", html_fragment)
    plain = html.unescape(plain)
    plain = " ".join(plain.split())
    return plain if plain else None


def _parse_forum_postings(html: str) -> dict:
    """
    Parse Heise forum thread overview HTML (tree_thread_list).
    Green/red: from rating img alt text = positive vote share (%); >50 => green, else red.
    """
    if "Heise Login Service" in html[:6000] and "posting_element" not in html:
        return {"error": "login_wall", "login": True}

    if "tree_thread_list" not in html and "posting_element" not in html:
        return {
            "green_count": 0,
            "red_count": 0,
            "unrated_count": 0,
            "max_replies": None,
            "max_replies_url": None,
            "max_replies_title": None,
            "total_replies_listed": 0,
            "postings_parsed": 0,
            "partial": False,
            "empty": True,
        }

    green = red = unrated = 0
    total_replies = 0
    max_r: int | None = None
    max_url: str | None = None
    max_title: str | None = None
    count = 0

    needle = '<li class="posting_element'
    pos = 0
    while True:
        i = html.find(needle, pos)
        if i < 0:
            break
        j = html.find("</li>", i)
        if j < 0:
            break
        block = html[i:j]
        pos = j + 5
        count += 1

        href_m = re.search(
            r'<a href="(https://www\.heise\.de/forum[^"]+)"\s+class="posting_subject"',
            block,
        )
        href = href_m.group(1) if href_m else None

        subj_m = re.search(
            r'class=["\']posting_subject["\'][^>]*>(.+?)</a>',
            block,
            re.DOTALL | re.IGNORECASE,
        )
        subj_plain = _forum_posting_subject_plain(subj_m.group(1)) if subj_m else None

        pr = 0
        pcm = re.search(r'<span class="posting_count">\((\d+)\)</span>', block)
        if pcm:
            pr = int(pcm.group(1))
        total_replies += pr
        if max_r is None or pr > max_r:
            max_r = pr
            max_url = href
            max_title = subj_plain

        # Heise uses alt="67" (positive share) or alt="-14" (negative net rating); match signed int.
        pct_m = re.search(r'<img[^>]+/icons/forum/wertung_[^"\']+[^>]*alt="(-?\d+)"', block)
        if not pct_m:
            pct_m = re.search(
                r'<img[^>]+alt="(-?\d+)"[^>]*title="[^"]*Beitragsbewertung', block
            )
        if pct_m:
            pct = int(pct_m.group(1))
            if pct > 50:
                green += 1
            else:
                red += 1
        else:
            unrated += 1

    partial = 'class="pagination' in html or "forum-pagination" in html
    return {
        "green_count": green,
        "red_count": red,
        "unrated_count": unrated,
        "max_replies": max_r,
        "max_replies_url": max_url,
        "max_replies_title": max_title,
        "total_replies_listed": total_replies,
        "postings_parsed": count,
        "partial": partial,
        "empty": count == 0,
    }


def _normalize_golem_public_url(url: str) -> str:
    """Canonical https URL path for matching RSS <link> (no query; strip trailing slash except root)."""
    u = (url or "").strip()
    if not u:
        return ""
    p = urlparse(u)
    if p.scheme not in ("http", "https"):
        return ""
    host = (p.netloc or "").lower()
    if "golem.de" not in host:
        return ""
    path = (p.path or "").rstrip("/")
    return f"https://{host}{path}"


def _golem_fetch_rss_xml() -> str:
    now = time.time()
    cached = str(_golem_rss_cache.get("xml") or "")
    t0 = float(_golem_rss_cache.get("t") or 0.0)
    if cached and now - t0 < 300.0:
        return cached
    req = Request(
        GOLEM_RSS_URL,
        headers={
            "User-Agent": FETCH_UA,
            "Accept": "application/rss+xml, application/xml, text/xml, */*",
            "Accept-Language": "de,en-US;q=0.9,en;q=0.8",
        },
        method="GET",
    )
    with urlopen(req, timeout=FETCH_TIMEOUT) as resp:
        body = resp.read()
    for enc in ("utf-8", "iso-8859-1", "windows-1252"):
        try:
            xml = body.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        xml = body.decode("utf-8", errors="replace")
    _golem_rss_cache["xml"] = xml
    _golem_rss_cache["t"] = now
    return xml


def _bild_fetch_rss_xml() -> str:
    now = time.time()
    cached = str(_bild_rss_cache.get("xml") or "")
    t0 = float(_bild_rss_cache.get("t") or 0.0)
    if cached and now - t0 < 300.0:
        return cached
    req = Request(
        BILD_FEED_URL,
        headers={
            "User-Agent": FETCH_UA,
            "Accept": "application/rss+xml, application/xml, text/xml, */*",
            "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
        },
        method="GET",
    )
    with urlopen(req, timeout=FETCH_TIMEOUT) as resp:
        body = resp.read()
    for enc in ("utf-8", "iso-8859-1", "windows-1252"):
        try:
            xml = body.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        xml = body.decode("utf-8", errors="replace")
    _bild_rss_cache["xml"] = xml
    _bild_rss_cache["t"] = now
    return xml


def _t3n_fetch_rss_xml() -> str:
    now = time.time()
    cached = str(_t3n_rss_cache.get("xml") or "")
    t0 = float(_t3n_rss_cache.get("t") or 0.0)
    if cached and now - t0 < 300.0:
        return cached
    req = Request(
        T3N_RSS_URL,
        headers={
            "User-Agent": FETCH_UA,
            "Accept": "application/rss+xml, application/xml, text/xml, */*",
            "Accept-Language": "de,en-US;q=0.9,en;q=0.8",
        },
        method="GET",
    )
    with urlopen(req, timeout=FETCH_TIMEOUT) as resp:
        body = resp.read()
    for enc in ("utf-8", "iso-8859-1", "windows-1252"):
        try:
            xml = body.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        xml = body.decode("utf-8", errors="replace")
    _t3n_rss_cache["xml"] = xml
    _t3n_rss_cache["t"] = now
    return xml


def _it_administrator_fetch_rss_xml() -> str:
    now = time.time()
    cached = str(_it_administrator_rss_cache.get("xml") or "")
    t0 = float(_it_administrator_rss_cache.get("t") or 0.0)
    if cached and now - t0 < 300.0:
        return cached
    req = Request(
        IT_ADMINISTRATOR_RSS_URL,
        headers={
            "User-Agent": FETCH_UA,
            "Accept": "application/rss+xml, application/xml, text/xml, */*",
            "Accept-Language": "de,en-US;q=0.9,en;q=0.8",
        },
        method="GET",
    )
    with urlopen(req, timeout=FETCH_TIMEOUT) as resp:
        body = resp.read()
    for enc in ("utf-8", "iso-8859-1", "windows-1252"):
        try:
            xml = body.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        xml = body.decode("utf-8", errors="replace")
    _it_administrator_rss_cache["xml"] = xml
    _it_administrator_rss_cache["t"] = now
    return xml


def _heise_feed_url_allowed(url: str) -> bool:
    """Only https://www.heise.de/…*.xml (no query/fragment) — no open proxy."""
    u = (url or "").strip()
    if not u.startswith(HEISE_PREFIX):
        return False
    if not u.endswith(".xml"):
        return False
    parsed = urlparse(u)
    if parsed.scheme != "https" or parsed.netloc != "www.heise.de":
        return False
    if parsed.query or parsed.fragment:
        return False
    return True


def _heise_fetch_feed_xml(target_url: str) -> str:
    url = (target_url or "").strip()
    if not _heise_feed_url_allowed(url):
        raise ValueError(f"Invalid Heise feed URL: {url!r}")
    now = time.time()
    slot = _heise_feed_cache_by_url.get(url)
    if slot:
        cached = str(slot.get("xml") or "")
        t0 = float(slot.get("t") or 0.0)
        if cached and now - t0 < 300.0:
            return cached
    req = Request(
        url,
        headers={
            "User-Agent": FETCH_UA,
            "Accept": "application/atom+xml, application/rss+xml, application/xml, text/xml, */*",
            "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
        },
        method="GET",
    )
    with urlopen(req, timeout=FETCH_TIMEOUT) as resp:
        body = resp.read()
    for enc in ("utf-8", "iso-8859-1", "windows-1252"):
        try:
            xml = body.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        xml = body.decode("utf-8", errors="replace")
    _heise_feed_cache_by_url[url] = {"xml": xml, "t": now}
    return xml


def _telepolis_fetch_feed_xml() -> str:
    now = time.time()
    cached = str(_telepolis_feed_cache.get("xml") or "")
    t0 = float(_telepolis_feed_cache.get("t") or 0.0)
    if cached and now - t0 < 300.0:
        return cached
    req = Request(
        TELEPOLIS_FEED_URL,
        headers={
            "User-Agent": FETCH_UA,
            "Accept": "application/atom+xml, application/rss+xml, application/xml, text/xml, */*",
            "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
        },
        method="GET",
    )
    with urlopen(req, timeout=FETCH_TIMEOUT) as resp:
        body = resp.read()
    for enc in ("utf-8", "iso-8859-1", "windows-1252"):
        try:
            xml = body.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        xml = body.decode("utf-8", errors="replace")
    _telepolis_feed_cache["xml"] = xml
    _telepolis_feed_cache["t"] = now
    return xml


def _verge_feed_url_allowed(url: str) -> bool:
    """Only same-origin Verge RSS paths (no open proxy)."""
    u = (url or "").strip()
    if not u.startswith(VERGE_RSS_PREFIX):
        return False
    if not u.endswith(".xml"):
        return False
    parsed = urlparse(u)
    if parsed.scheme != "https" or parsed.netloc != "www.theverge.com":
        return False
    if parsed.query or parsed.fragment:
        return False
    return True


def _verge_fetch_feed_xml(target_url: str | None = None) -> str:
    url = (target_url or "").strip() or VERGE_FEED_URL
    if not _verge_feed_url_allowed(url):
        raise ValueError(f"Invalid Verge feed URL: {url!r}")
    now = time.time()
    slot = _verge_feed_cache_by_url.get(url)
    if slot:
        cached = str(slot.get("xml") or "")
        t0 = float(slot.get("t") or 0.0)
        if cached and now - t0 < 300.0:
            return cached
    req = Request(
        url,
        headers={
            "User-Agent": FETCH_UA,
            "Accept": "application/atom+xml, application/rss+xml, application/xml, text/xml, */*",
            "Accept-Language": "en-US,en;q=0.9,de;q=0.8",
        },
        method="GET",
    )
    with urlopen(req, timeout=FETCH_TIMEOUT) as resp:
        body = resp.read()
    for enc in ("utf-8", "iso-8859-1", "windows-1252"):
        try:
            xml = body.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        xml = body.decode("utf-8", errors="replace")
    _verge_feed_cache_by_url[url] = {"xml": xml, "t": now}
    return xml


def build_computerbase_comments_payload(article_url: str) -> dict:
    """Stub: feed has no comment totals; link to article for discussion."""
    if not article_url.startswith(COMPUTERBASE_PREFIX):
        return {"ok": False, "error": "Only https://www.computerbase.de/ article URLs are allowed."}
    return {
        "ok": True,
        "articleUrl": article_url,
        "commentCount": None,
        "discussionUrl": article_url,
        "forum": {
            "rss_only": True,
            "stub": True,
            "empty": True,
            "green_count": 0,
            "red_count": 0,
        },
        "warnings": [
            "ComputerBase: comment totals are not available via RSS feed API; open the article for discussion."
        ],
    }


def build_bild_comments_payload(article_url: str) -> dict:
    """Stub: feed has no comment totals; link to article for discussion."""
    parsed = urlparse(article_url)
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or not (host == "bild.de" or host.endswith(".bild.de")):
        return {"ok": False, "error": "Only https://*.bild.de/ article URLs are allowed."}
    return {
        "ok": True,
        "articleUrl": article_url,
        "commentCount": None,
        "discussionUrl": article_url,
        "forum": {
            "rss_only": True,
            "stub": True,
            "empty": True,
            "green_count": 0,
            "red_count": 0,
        },
        "warnings": [
            "BILD: comment totals are not available via RSS feed API; open the article for discussion."
        ],
    }


def build_t3n_comments_payload(article_url: str) -> dict:
    """Stub: feed has no comment totals; link to article for discussion."""
    if not article_url.startswith(T3N_ART_PREFIX):
        return {"ok": False, "error": "Only https://t3n.de/ article URLs are allowed."}
    return {
        "ok": True,
        "articleUrl": article_url,
        "commentCount": None,
        "discussionUrl": article_url,
        "forum": {
            "rss_only": True,
            "stub": True,
            "empty": True,
            "green_count": 0,
            "red_count": 0,
        },
        "warnings": [
            "t3n: comment totals are not available via RSS feed API; open the article for discussion."
        ],
    }


def build_verge_comments_payload(article_url: str) -> dict:
    """
    The Verge uses Coral for comments; counts are not in Atom feed or static JSON-LD.
    Return deep link to #comments for convenience.
    """
    if not article_url.startswith(VERGE_PREFIX):
        return {"ok": False, "error": "Only https://www.theverge.com/ article URLs are allowed."}
    base = article_url.split("#", 1)[0].rstrip("/")
    discussion = f"{base}#comments"
    return {
        "ok": True,
        "articleUrl": article_url,
        "commentCount": None,
        "discussionUrl": discussion,
        "stubHintKey": "rss_stub_verge",
        "forum": {
            "rss_only": True,
            "stub": True,
            "empty": True,
            "green_count": 0,
            "red_count": 0,
        },
        "warnings": [
            "The Verge: comment counts are not exposed in RSS or static page data; open the article for Coral comments."
        ],
    }


def _golem_find_item_in_rss(article_norm: str, xml: str) -> dict | None:
    try:
        root = ET.fromstring(xml)
    except ET.ParseError:
        return None
    channel = root.find("channel")
    if channel is None:
        return None
    for item in channel.findall("item"):
        link_el = item.find("link")
        link = (link_el.text or "").strip() if link_el is not None else ""
        if not link:
            continue
        if _normalize_golem_public_url(link) != article_norm:
            continue
        comments_el = item.find("comments")
        discussion_url = (comments_el.text or "").strip() if comments_el is not None else ""
        slash_el = item.find(SLASH_COMMENTS_TAG)
        cc: int | None = None
        if slash_el is not None and slash_el.text:
            cc = _parse_int_loose(slash_el.text.strip())
        return {
            "link": link,
            "discussionUrl": discussion_url or None,
            "commentCount": cc,
        }
    return None


def build_golem_comments_payload(article_url: str) -> dict:
    """Comment totals + forum URL from Golem RSS (forum HTML often behind consent wall)."""
    if not article_url.startswith(GOLEM_PREFIX):
        return {"ok": False, "error": "Only https://www.golem.de/ article URLs are allowed."}
    norm = _normalize_golem_public_url(article_url)
    if not norm:
        return {"ok": False, "error": "Invalid Golem URL."}
    warnings: list[str] = [
        "Golem: green/red ratings require forum HTML; this API uses RSS (comment count + forum link only)."
    ]
    try:
        xml = _golem_fetch_rss_xml()
    except (HTTPError, URLError, TimeoutError, OSError) as e:
        return {"ok": False, "error": f"Golem RSS fetch failed: {e}"}
    found = _golem_find_item_in_rss(norm, xml)
    if not found:
        return {
            "ok": True,
            "articleUrl": article_url,
            "commentCount": None,
            "discussionUrl": None,
            "forum": {
                "rss_only": True,
                "empty": True,
                "error": "not_in_feed",
                "green_count": 0,
                "red_count": 0,
            },
            "warnings": warnings
            + ["Article not found in the cached Golem RSS window (only recent items are listed)."],
        }
    discussion_url = found.get("discussionUrl")
    comment_count = found.get("commentCount")
    return {
        "ok": True,
        "articleUrl": article_url,
        "commentCount": comment_count,
        "discussionUrl": discussion_url,
        "forum": {
            "rss_only": True,
            "empty": False,
            "green_count": 0,
            "red_count": 0,
            "unrated_count": 0,
            "max_replies": None,
            "max_replies_url": None,
            "max_replies_title": None,
            "total_replies_listed": 0,
            "postings_parsed": 0,
            "partial": True,
        },
        "warnings": warnings,
    }


def build_heise_comments_payload(article_url: str) -> dict:
    article_url = _canonicalize_heise_comments_article_url(article_url)
    if not (article_url.startswith(HEISE_PREFIX) or article_url.startswith(TELEPOLIS_PREFIX)):
        return {"ok": False, "error": "Only heise.de and telepolis.de article URLs are allowed."}
    is_telepolis = article_url.startswith(TELEPOLIS_PREFIX)

    try:
        status, art_html = _http_get_text(article_url)
    except (HTTPError, URLError, TimeoutError, OSError) as e:
        return {"ok": False, "error": f"Article fetch failed: {e}"}

    if status != 200:
        return {"ok": False, "error": f"Article HTTP {status}"}

    na = _extract_news_article_from_html(art_html)
    if not na:
        return {
            "ok": False,
            "error": "No article metadata (JSON-LD Article/NewsArticle or discussionUrl/forum link) found in HTML.",
        }

    comment_count = _parse_int_loose(na.get("commentCount"))
    discussion_raw = na.get("discussionUrl")
    if is_telepolis:
        discussion_url = _telepolis_abs(str(discussion_raw)) if discussion_raw else None
    else:
        discussion_url = _heise_abs(str(discussion_raw)) if discussion_raw else None

    forum_out: dict | None = None
    warnings: list[str] = []

    if not discussion_url:
        warnings.append("No discussionUrl in JSON-LD; forum stats omitted.")
    else:
        forum_page = _normalize_forum_thread_url(
            discussion_raw or "", source="telepolis" if is_telepolis else "heise"
        )
        try:
            _st, forum_html = _http_get_text(forum_page)
        except (HTTPError, URLError, TimeoutError, OSError) as e:
            code = getattr(e, "code", None)
            if isinstance(e, HTTPError) and code == 429:
                forum_out = {"error": "rate_limited", "http_status": 429}
            else:
                forum_out = None
            warnings.append(f"Forum fetch failed: {e}")
        else:
            if "Heise Login Service" in forum_html[:8000] and "tree_thread_list" not in forum_html:
                warnings.append(
                    "Forum page returned login wall; try opening the discussion in a browser."
                )
                forum_out = {"error": "login_wall", "login": True}
            else:
                parsed = _parse_forum_postings(forum_html)
                if parsed.get("error") == "login_wall":
                    warnings.append("Forum list not visible (login or restricted).")
                    forum_out = parsed
                else:
                    forum_out = parsed
                    if parsed.get("postings_parsed", 0) == 0 and (comment_count or 0) > 0:
                        warnings.append(
                            "Forum HTML had no posting rows; counts may require login or differ."
                        )
                    elif (
                        comment_count is not None
                        and (parsed.get("postings_parsed") or 0) > 0
                        and comment_count > (parsed.get("postings_parsed") or 0)
                    ):
                        warnings.append(
                            "commentCount is thread-wide; green/red ratings are counted from visible forum rows only."
                        )

    return {
        "ok": True,
        "articleUrl": article_url,
        "commentCount": comment_count,
        "discussionUrl": discussion_url,
        "forum": forum_out,
        "warnings": warnings,
    }


def connect_upstream(target: str) -> http.client.HTTPConnection:
    parsed = urlparse(target)
    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"Unsupported scheme: {parsed.scheme}")
    host = parsed.hostname
    if not host:
        raise ValueError("Invalid target URL")
    port = parsed.port
    if port is None:
        port = 443 if parsed.scheme == "https" else 80
    if parsed.scheme == "https":
        return http.client.HTTPSConnection(host, port, timeout=300)
    return http.client.HTTPConnection(host, port, timeout=300)


def _host_matches_allowed_suffix(host: str, allowed_suffixes: tuple[str, ...]) -> bool:
    clean_host = (host or "").strip().strip(".").lower()
    if not clean_host:
        return False
    for suffix in allowed_suffixes:
        clean_suffix = suffix.strip().strip(".").lower()
        if clean_host == clean_suffix or clean_host.endswith("." + clean_suffix):
            return True
    return False


def _article_image_url_allowed(url: str) -> bool:
    target = (url or "").strip()
    if not target:
        return False
    parsed = urlparse(target)
    if parsed.scheme != "https":
        return False
    return _host_matches_allowed_suffix(parsed.hostname or "", ARTICLE_IMAGE_ALLOWED_HOST_SUFFIXES)


def _fetch_article_image_bytes(image_url: str) -> tuple[str, bytes]:
    target = (image_url or "").strip()
    if not _article_image_url_allowed(target):
        raise ValueError("Only https image URLs from supported news sources are allowed.")

    req = Request(
        target,
        headers={
            "User-Agent": FETCH_UA,
            "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        },
    )
    with urlopen(req, timeout=ARTICLE_IMAGE_TIMEOUT) as resp:
        final_url = str(resp.geturl() or target).strip()
        if not _article_image_url_allowed(final_url):
            raise ValueError("Redirect target is not allowed for article image proxying.")

        content_type = str(resp.headers.get("Content-Type") or "").split(";", 1)[0].strip().lower()
        if not content_type.startswith("image/"):
            raise ValueError(
                f"Upstream response is not an image: {content_type or 'unknown content type'}."
            )

        raw_length = str(resp.headers.get("Content-Length") or "").strip()
        if raw_length:
            try:
                if int(raw_length) > ARTICLE_IMAGE_MAX_BYTES:
                    raise ValueError("Image is too large for proxying.")
            except ValueError as exc:
                if str(exc) == "Image is too large for proxying.":
                    raise

        body = resp.read(ARTICLE_IMAGE_MAX_BYTES + 1)
        if len(body) > ARTICLE_IMAGE_MAX_BYTES:
            raise ValueError("Image is too large for proxying.")
        return content_type, body


def csp_content() -> str:
    """Strict CSP to block inline scripts and unsafe eval."""
    return (
        "default-src 'self'; "
        "script-src 'self' https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https://*; "
        "font-src 'self'; "
        "connect-src 'self' http://127.0.0.1:*; "
        "frame-src https://www.youtube.com; "
        "object-src 'none'; "
        "base-uri 'self'; "
        "form-action 'self'"
    )


def cors_headers(handler: SimpleHTTPRequestHandler) -> None:
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, ngrok-skip-browser-warning",
    )
    handler.send_header("Content-Security-Policy", csp_content())


def send_lm_upstream_error(
    handler: SimpleHTTPRequestHandler,
    lm_target: str,
    exc: BaseException,
) -> None:
    """Return 502 JSON when the LM Studio HTTP proxy cannot reach the upstream."""
    payload = {
        "error": (
            f"Cannot reach LM Studio at {lm_target}. "
            "Start LM Studio with the local server enabled, or use --target to match your setup."
        ),
        "upstream": lm_target,
        "detail": str(exc),
    }
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(502)
    cors_headers(handler)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def proxy_lm_models_get(
    handler: SimpleHTTPRequestHandler, lm_target: str, upstream_path: str
) -> None:
    """Forward GET for LM Studio model list (/v1/models or /api/v1/models)."""
    conn = connect_upstream(lm_target)
    try:
        hdrs = {"User-Agent": FETCH_UA, "Accept": "application/json"}
        auth = handler.headers.get("Authorization")
        if auth:
            hdrs["Authorization"] = auth
        ng = handler.headers.get("ngrok-skip-browser-warning")
        if ng:
            hdrs["ngrok-skip-browser-warning"] = ng
        conn.request("GET", upstream_path, headers=hdrs)
        resp = conn.getresponse()
        resp_body = resp.read()
        handler.send_response(resp.status)
        cors_headers(handler)
        for key, val in resp.getheaders():
            lk = key.lower()
            if lk in ("content-type", "content-length", "transfer-encoding"):
                handler.send_header(key, val)
        handler.end_headers()
        handler.wfile.write(resp_body)
    except (OSError, http.client.HTTPException) as e:
        print(f"[lm-proxy] GET {upstream_path} → {lm_target}: {e}", file=sys.stderr)
        send_lm_upstream_error(handler, lm_target, e)
    finally:
        conn.close()


def make_handler(lm_target: str) -> type:
    class DevHandler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=ROOT, **kwargs)

        def log_message(self, fmt: str, *args: object) -> None:
            sys.stderr.write(
                "%s - - [%s] %s\n" % (self.address_string(), self.log_date_time_string(), fmt % args)
            )

        def do_GET(self) -> None:
            path_only = self.path.split("?", 1)[0]
            if path_only == "/.well-known/lmstudio-dev-server":
                body = b"ok\n"
                self.send_response(200)
                cors_headers(self)
                self.send_header("Content-Type", "text/plain; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            if path_only == "/api/heise-comments":
                parsed = urlparse(self.path)
                qs = parse_qs(parsed.query)
                raw_url = (qs.get("url") or [""])[0].strip()
                article_url = unquote(raw_url)
                payload = build_heise_comments_payload(article_url)
                body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
                self.send_response(200)
                cors_headers(self)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            if path_only == "/api/article-image":
                parsed = urlparse(self.path)
                qs = parse_qs(parsed.query)
                raw_url = (qs.get("url") or [""])[0].strip()
                image_url = unquote(raw_url)
                if not image_url:
                    err = json.dumps(
                        {"ok": False, "error": "Missing required query parameter: url"},
                        ensure_ascii=False,
                    ).encode("utf-8")
                    self.send_response(400)
                    cors_headers(self)
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.send_header("Content-Length", str(len(err)))
                    self.end_headers()
                    self.wfile.write(err)
                    return
                try:
                    content_type, body = _fetch_article_image_bytes(image_url)
                except ValueError as e:
                    err = json.dumps({"ok": False, "error": str(e)}, ensure_ascii=False).encode("utf-8")
                    self.send_response(400)
                    cors_headers(self)
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.send_header("Content-Length", str(len(err)))
                    self.end_headers()
                    self.wfile.write(err)
                    return
                except (HTTPError, URLError, TimeoutError, OSError) as e:
                    err = json.dumps({"ok": False, "error": str(e)}, ensure_ascii=False).encode("utf-8")
                    self.send_response(502)
                    cors_headers(self)
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.send_header("Content-Length", str(len(err)))
                    self.end_headers()
                    self.wfile.write(err)
                    return
                self.send_response(200)
                cors_headers(self)
                self.send_header("Content-Type", content_type)
                self.send_header("Cache-Control", "public, max-age=900")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            if path_only == "/api/heise-feed":
                parsed_hf = urlparse(self.path)
                qs_hf = parse_qs(parsed_hf.query)
                raw_hf = (qs_hf.get("url") or [""])[0].strip()
                target_heise = unquote(raw_hf)
                try:
                    xml = _heise_fetch_feed_xml(target_heise)
                except ValueError as e:
                    err = json.dumps({"ok": False, "error": str(e)}, ensure_ascii=False).encode("utf-8")
                    self.send_response(400)
                    cors_headers(self)
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.send_header("Content-Length", str(len(err)))
                    self.end_headers()
                    self.wfile.write(err)
                    return
                except (HTTPError, URLError, TimeoutError, OSError) as e:
                    err = json.dumps({"ok": False, "error": str(e)}, ensure_ascii=False).encode("utf-8")
                    self.send_response(502)
                    cors_headers(self)
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.send_header("Content-Length", str(len(err)))
                    self.end_headers()
                    self.wfile.write(err)
                    return
                body = xml.encode("utf-8")
                self.send_response(200)
                cors_headers(self)
                self.send_header("Content-Type", "application/atom+xml; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            if path_only == "/api/telepolis-feed":
                try:
                    xml = _telepolis_fetch_feed_xml()
                except (HTTPError, URLError, TimeoutError, OSError) as e:
                    err = json.dumps({"ok": False, "error": str(e)}, ensure_ascii=False).encode("utf-8")
                    self.send_response(502)
                    cors_headers(self)
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.send_header("Content-Length", str(len(err)))
                    self.end_headers()
                    self.wfile.write(err)
                    return
                body = xml.encode("utf-8")
                self.send_response(200)
                cors_headers(self)
                self.send_header("Content-Type", "application/atom+xml; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            if path_only == "/api/bild-feed":
                try:
                    xml = _bild_fetch_rss_xml()
                except (HTTPError, URLError, TimeoutError, OSError) as e:
                    err = json.dumps({"ok": False, "error": str(e)}, ensure_ascii=False).encode("utf-8")
                    self.send_response(502)
                    cors_headers(self)
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.send_header("Content-Length", str(len(err)))
                    self.end_headers()
                    self.wfile.write(err)
                    return
                body = xml.encode("utf-8")
                self.send_response(200)
                cors_headers(self)
                self.send_header("Content-Type", "application/rss+xml; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            if path_only == "/api/golem-feed":
                try:
                    xml = _golem_fetch_rss_xml()
                except (HTTPError, URLError, TimeoutError, OSError) as e:
                    err = json.dumps({"ok": False, "error": str(e)}, ensure_ascii=False).encode("utf-8")
                    self.send_response(502)
                    cors_headers(self)
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.send_header("Content-Length", str(len(err)))
                    self.end_headers()
                    self.wfile.write(err)
                    return
                body = xml.encode("utf-8")
                self.send_response(200)
                cors_headers(self)
                self.send_header("Content-Type", "application/rss+xml; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            if path_only == "/api/golem-comments":
                parsed = urlparse(self.path)
                qs = parse_qs(parsed.query)
                raw_url = (qs.get("url") or [""])[0].strip()
                article_url = unquote(raw_url)
                payload = build_golem_comments_payload(article_url)
                body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
                self.send_response(200)
                cors_headers(self)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            if path_only == "/api/t3n-feed":
                try:
                    xml = _t3n_fetch_rss_xml()
                except (HTTPError, URLError, TimeoutError, OSError) as e:
                    err = json.dumps({"ok": False, "error": str(e)}, ensure_ascii=False).encode("utf-8")
                    self.send_response(502)
                    cors_headers(self)
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.send_header("Content-Length", str(len(err)))
                    self.end_headers()
                    self.wfile.write(err)
                    return
                body = xml.encode("utf-8")
                self.send_response(200)
                cors_headers(self)
                self.send_header("Content-Type", "application/rss+xml; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            if path_only == "/api/it-administrator-feed":
                try:
                    xml = _it_administrator_fetch_rss_xml()
                except (HTTPError, URLError, TimeoutError, OSError) as e:
                    err = json.dumps({"ok": False, "error": str(e)}, ensure_ascii=False).encode("utf-8")
                    self.send_response(502)
                    cors_headers(self)
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.send_header("Content-Length", str(len(err)))
                    self.end_headers()
                    self.wfile.write(err)
                    return
                body = xml.encode("utf-8")
                self.send_response(200)
                cors_headers(self)
                self.send_header("Content-Type", "application/rss+xml; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            if path_only == "/api/verge-feed":
                parsed_vf = urlparse(self.path)
                qs_vf = parse_qs(parsed_vf.query)
                raw_u = (qs_vf.get("url") or [""])[0].strip()
                target_feed = unquote(raw_u) if raw_u else VERGE_FEED_URL
                try:
                    xml = _verge_fetch_feed_xml(target_feed)
                except ValueError as e:
                    err = json.dumps({"ok": False, "error": str(e)}, ensure_ascii=False).encode("utf-8")
                    self.send_response(400)
                    cors_headers(self)
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.send_header("Content-Length", str(len(err)))
                    self.end_headers()
                    self.wfile.write(err)
                    return
                except (HTTPError, URLError, TimeoutError, OSError) as e:
                    err = json.dumps({"ok": False, "error": str(e)}, ensure_ascii=False).encode("utf-8")
                    self.send_response(502)
                    cors_headers(self)
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.send_header("Content-Length", str(len(err)))
                    self.end_headers()
                    self.wfile.write(err)
                    return
                body = xml.encode("utf-8")
                self.send_response(200)
                cors_headers(self)
                self.send_header("Content-Type", "application/atom+xml; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            if path_only == "/api/computerbase-comments":
                parsed = urlparse(self.path)
                qs = parse_qs(parsed.query)
                raw_url = (qs.get("url") or [""])[0].strip()
                article_url = unquote(raw_url)
                payload = build_computerbase_comments_payload(article_url)
                body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
                self.send_response(200)
                cors_headers(self)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            if path_only == "/api/bild-comments":
                parsed = urlparse(self.path)
                qs = parse_qs(parsed.query)
                raw_url = (qs.get("url") or [""])[0].strip()
                article_url = unquote(raw_url)
                payload = build_bild_comments_payload(article_url)
                body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
                self.send_response(200)
                cors_headers(self)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            if path_only == "/api/t3n-comments":
                parsed = urlparse(self.path)
                qs = parse_qs(parsed.query)
                raw_url = (qs.get("url") or [""])[0].strip()
                article_url = unquote(raw_url)
                payload = build_t3n_comments_payload(article_url)
                body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
                self.send_response(200)
                cors_headers(self)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            if path_only == "/api/verge-comments":
                parsed = urlparse(self.path)
                qs = parse_qs(parsed.query)
                raw_url = (qs.get("url") or [""])[0].strip()
                article_url = unquote(raw_url)
                payload = build_verge_comments_payload(article_url)
                body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
                self.send_response(200)
                cors_headers(self)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            if path_only == "/api/check-url":
                parsed = urlparse(self.path)
                qs = parse_qs(parsed.query)
                raw_url = (qs.get("url") or [""])[0].strip()
                target_url = unquote(raw_url)
                payload = check_remote_article_url(target_url)
                body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
                self.send_response(200)
                cors_headers(self)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            if path_only == "/api/source-feed":
                parsed = urlparse(self.path)
                qs = parse_qs(parsed.query)
                engine = ((qs.get("engine") or [""])[0] or "").strip().lower()
                raw_label = unquote((qs.get("label") or [""])[0])
                label = _normalize_source_feed_label(raw_label)
                raw_site_url = unquote((qs.get("site_url") or [""])[0])
                site_url = _normalize_source_feed_site_url(raw_site_url)
                raw_feed_url = unquote((qs.get("feed_url") or [""])[0])
                feed_url = _normalize_source_feed_direct_url(raw_feed_url)
                lang = _normalize_source_feed_lang((qs.get("lang") or ["en"])[0])
                try:
                    lim = int((qs.get("limit") or ["30"])[0])
                except (TypeError, ValueError):
                    lim = 30
                lim = max(1, min(30, lim))
                if engine not in ("bing_news", "google_news", "direct_rss"):
                    err = json.dumps({"ok": False, "error": "invalid_engine"}, ensure_ascii=False).encode("utf-8")
                    self.send_response(400)
                    cors_headers(self)
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.send_header("Content-Length", str(len(err)))
                    self.end_headers()
                    self.wfile.write(err)
                    return
                if not label or not site_url:
                    err = json.dumps({"ok": False, "error": "missing_label_or_site_url"}, ensure_ascii=False).encode("utf-8")
                    self.send_response(400)
                    cors_headers(self)
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.send_header("Content-Length", str(len(err)))
                    self.end_headers()
                    self.wfile.write(err)
                    return
                sites: list[str] = []
                seen_sites: set[str] = set()
                for raw_site in qs.get("site") or []:
                    site = _normalize_source_feed_site(unquote(raw_site))
                    if site and site not in seen_sites:
                        seen_sites.add(site)
                        sites.append(site)
                if not sites:
                    derived_site = _normalize_source_feed_site(site_url)
                    if derived_site:
                        sites.append(derived_site)
                mkt = ((qs.get("mkt") or [""])[0] or "").strip()
                cache_key = json.dumps(
                    {
                        "engine": engine,
                        "label": label,
                        "site_url": site_url,
                        "feed_url": feed_url,
                        "lang": lang,
                        "limit": lim,
                        "sites": sites,
                        "mkt": mkt,
                    },
                    ensure_ascii=False,
                    sort_keys=True,
                )
                cached_xml = _get_cached_source_feed_xml(cache_key)
                if cached_xml:
                    body = cached_xml.encode("utf-8")
                    self.send_response(200)
                    cors_headers(self)
                    self.send_header("Content-Type", "application/rss+xml; charset=utf-8")
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
                    return
                try:
                    if engine == "bing_news":
                        query = _build_bing_site_query(sites)
                        if not query:
                            raise ValueError("missing_site")
                        payload = _bing_news_rss_search_with_fallback(query, lim, lang, mkt)
                        if payload.get("ok") is not True:
                            raise RuntimeError(str(payload.get("error") or "bing_news_failed"))
                        xml = _build_source_feed_rss_xml(
                            label,
                            site_url,
                            lang,
                            list(payload.get("results") or []),
                            description=f"{label} (via Bing News search proxy)",
                        )
                    elif engine == "direct_rss":
                        if not feed_url:
                            raise ValueError("missing_feed_url")
                        req = Request(
                            feed_url,
                            headers={
                                "User-Agent": FETCH_UA,
                                "Accept": "application/rss+xml, application/xml, text/xml, */*",
                            },
                        )
                        with urlopen(req, timeout=FETCH_TIMEOUT) as resp:
                            xml = resp.read().decode("utf-8", errors="replace")
                        xml = _enrich_direct_rss_with_article_images(xml, feed_url)
                    else:
                        feed_url = _google_news_feed_url_for_language(lang)
                        req = Request(
                            feed_url,
                            headers={
                                "User-Agent": FETCH_UA,
                                "Accept": "application/rss+xml, application/xml, text/xml, */*",
                            },
                        )
                        with urlopen(req, timeout=FETCH_TIMEOUT) as resp:
                            xml = resp.read().decode("utf-8", errors="replace")
                except ValueError as e:
                    err = json.dumps({"ok": False, "error": str(e)}, ensure_ascii=False).encode("utf-8")
                    self.send_response(400)
                    cors_headers(self)
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.send_header("Content-Length", str(len(err)))
                    self.end_headers()
                    self.wfile.write(err)
                    return
                except (HTTPError, URLError, TimeoutError, OSError, RuntimeError) as e:
                    err = json.dumps({"ok": False, "error": str(e)}, ensure_ascii=False).encode("utf-8")
                    self.send_response(502)
                    cors_headers(self)
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.send_header("Content-Length", str(len(err)))
                    self.end_headers()
                    self.wfile.write(err)
                    return
                _put_cached_source_feed_xml(cache_key, xml)
                body = xml.encode("utf-8")
                self.send_response(200)
                cors_headers(self)
                self.send_header("Content-Type", "application/rss+xml; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            if path_only == "/api/search-news":
                parsed = urlparse(self.path)
                qs = parse_qs(parsed.query)
                raw_q = (qs.get("q") or [""])[0].strip()
                query = unquote(raw_q)
                try:
                    lim = int((qs.get("limit") or ["8"])[0])
                except (TypeError, ValueError):
                    lim = 8
                mkt = ((qs.get("mkt") or ["en-US"])[0] or "en-US").strip()
                payload = bing_news_rss_search(query, lim, mkt)
                body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
                self.send_response(200)
                cors_headers(self)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            if path_only == "/api/reddit-search":
                parsed = urlparse(self.path)
                qs = parse_qs(parsed.query)
                raw_q = (qs.get("q") or [""])[0].strip()
                query = unquote(raw_q)
                try:
                    lim = int((qs.get("limit") or ["5"])[0])
                except (TypeError, ValueError):
                    lim = 5
                use_ai = (qs.get("ai") or [""])[0].strip() == "1"
                reasoning_values = qs.get("reasoning")
                reasoning = None
                if reasoning_values:
                    raw_reasoning = reasoning_values[0].strip().lower()
                    if raw_reasoning == "none":
                        raw_reasoning = "off"
                    reasoning = raw_reasoning if raw_reasoning in _LM_REASONING_ALLOWED else "off"
                if use_ai:
                    payload = build_reddit_search_payload_ai(query, lim, lm_target, reasoning)
                else:
                    payload = build_reddit_search_payload(query, lim)
                n_res = len(payload.get("results") or [])
                print(
                    f"[reddit] → ok={payload.get('ok')}, results={n_res}, "
                    f"ai={payload.get('ai_enhanced', False)}, "
                    f"search='{payload.get('query_search', '')[:80]}'",
                    file=sys.stderr,
                )
                body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
                self.send_response(200)
                cors_headers(self)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            if path_only == "/api/youtube-search":
                parsed = urlparse(self.path)
                qs = parse_qs(parsed.query)
                raw_query = (qs.get("q") or [""])[0].strip()
                query = unquote(raw_query)
                payload = _youtube_fetch(query, max_results=10)
                status_code = 200 if payload.get("ok") else 503
                body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
                self.send_response(status_code)
                cors_headers(self)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            if path_only == "/v1/models":
                proxy_lm_models_get(self, lm_target, "/v1/models")
                return
            if path_only == "/api/v1/models":
                proxy_lm_models_get(self, lm_target, "/api/v1/models")
                return
            super().do_GET()

        def do_OPTIONS(self) -> None:
            path_only = self.path.split("?", 1)[0]
            if path_only in ("/api/v1/chat", "/v1/models", "/api/v1/models"):
                self.send_response(204)
                cors_headers(self)
                self.end_headers()
                return
            self.send_error(404, "Not found")

        def do_POST(self) -> None:
            path_only = self.path.split("?", 1)[0]
            if path_only != "/api/v1/chat":
                self.send_error(404, "Use GET for static files; POST /api/v1/chat only for LM REST")
                return

            length = int(self.headers.get("Content-Length", "0") or "0")
            body = self.rfile.read(length) if length > 0 else b""
            body = _normalize_lm_chat_reasoning_body(body)

            conn = connect_upstream(lm_target)
            try:
                headers = {
                    "Content-Type": self.headers.get("Content-Type", "application/json"),
                    "Content-Length": str(len(body)),
                }
                auth = self.headers.get("Authorization")
                if auth:
                    headers["Authorization"] = auth
                ng = self.headers.get("ngrok-skip-browser-warning")
                if ng:
                    headers["ngrok-skip-browser-warning"] = ng

                conn.request("POST", "/api/v1/chat", body=body, headers=headers)
                resp = conn.getresponse()
                resp_body = resp.read()
                self.send_response(resp.status)
                cors_headers(self)
                for key, val in resp.getheaders():
                    lk = key.lower()
                    if lk in ("content-type", "content-length", "transfer-encoding"):
                        self.send_header(key, val)
                self.end_headers()
                self.wfile.write(resp_body)
            except (OSError, http.client.HTTPException) as e:
                print(f"[lm-proxy] POST /api/v1/chat → {lm_target}: {e}", file=sys.stderr)
                send_lm_upstream_error(self, lm_target, e)
            finally:
                conn.close()

    return DevHandler


def main() -> int:
    p = argparse.ArgumentParser(description="Dashboard + LM Studio REST proxy (same origin)")
    p.add_argument("--listen", default=DEFAULT_BIND, help="Bind address")
    p.add_argument("--port", type=int, default=DEFAULT_PORT, help="HTTP port for dashboard + /api/v1/chat")
    p.add_argument(
        "--target",
        default=DEFAULT_LM,
        help="LM Studio server root (e.g. http://127.0.0.1:1234)",
    )
    args = p.parse_args()
    lm_target = args.target.rstrip("/")

    handler = make_handler(lm_target)
    server = ThreadingHTTPServer((args.listen, args.port), handler)
    url = f"http://{args.listen}:{args.port}"
    print(
        f"Serving project from: {ROOT}\n"
        f"Open: {url}/index.html\n"
        f"POST /api/v1/chat → {lm_target}/api/v1/chat\n"
        f"GET /api/v1/models → {lm_target}/api/v1/models (native list incl. loaded state)\n"
        f"GET /v1/models → {lm_target}/v1/models (OpenAI-style fallback)\n"
        f"GET /api/heise-comments?url=… → Heise or Telepolis article + forum comment stats (server-side fetch)\n"
        f"GET /api/article-image?url=… → same-origin proxy for allowed article thumbnails (PDF export)\n"
        f"GET /api/heise-feed?url=… → Heise Atom/RSS (CORS proxy; url must be https://www.heise.de/…/*.xml)\n"
        f"GET /api/telepolis-feed → Telepolis news-atom.xml (CORS proxy)\n"
        f"GET /api/bild-feed → BILD RSS home.xml (browser CORS proxy)\n"
        f"GET /api/golem-feed → Golem RSS (browser CORS proxy; same cache as /api/golem-comments)\n"
        f"GET /api/t3n-feed → t3n RSS (browser CORS proxy)\n"
        f"GET /api/it-administrator-feed → IT-Administrator RSS (browser CORS proxy)\n"
        f"GET /api/verge-feed → The Verge Atom (browser CORS proxy); optional ?url=… (https://www.theverge.com/rss/…/*.xml)\n"
        f"GET /api/source-feed?engine=… → registry-backed source feed proxy (Bing News → synthetic RSS, Google News → proxied RSS)\n"
        f"GET /api/golem-comments?url=… → Golem comment count + forum URL from RSS (no green/red parse)\n"
        f"GET /api/bild-comments?url=… → stub (link to article; no feed comment API)\n"
        f"GET /api/computerbase-comments?url=… → stub (link to article; no feed comment API)\n"
        f"GET /api/t3n-comments?url=… → stub (link to article; no feed comment API)\n"
        f"GET /api/verge-comments?url=… → stub (link to #comments; Coral counts not in RSS)\n"
        f"GET /api/check-url?url=… → HTTP probe for KI alternative links (drops obvious 404/410)\n"
        f"GET /api/search-news?q=…&limit=…&mkt=… → Bing News RSS (real article URLs for alternative links)\n"
        f"GET /api/reddit-search?q=…&limit=…&ai=1 → Reddit thread search (ai=1: LM Studio optimized queries)\n"
        f"GET /api/youtube-search?q=… → YouTube Data API v3 search (requires YOUTUBE_API_KEY env var)\n"
        f"The app auto-detects this server via GET /.well-known/lmstudio-dev-server\n",
        file=sys.stderr,
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.", file=sys.stderr)
        return 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
