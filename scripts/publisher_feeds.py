"""Build feeds from verified public publisher pages and advertised sitemaps.

Only configured publisher hosts are fetched. Every returned entry has a verified
article page, publication date and readable article text; sitemap/search snippets
alone are never promoted to articles. No paid search API is used.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import format_datetime, parsedate_to_datetime
import gzip
from html import unescape
from html.parser import HTMLParser
import io
import ipaddress
import json
from pathlib import Path
import re
import socket
import time
from typing import Iterator
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlsplit, urlunsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
import xml.etree.ElementTree as ET


MAX_BYTES = 4 * 1024 * 1024
MAX_AGE_SECONDS = 30 * 86400
FETCH_SECONDS = 4.0
RUN_SECONDS = 16.0
USER_AGENT = "Mozilla/5.0 (compatible; CucumberNewsReader/1.0; local dev_server)"
ARTICLE_TYPES = {"Article", "NewsArticle", "BlogPosting", "LiveBlogPosting"}


class PublisherFeedError(RuntimeError):
    """No verifiable public article could be obtained within the fetch budget."""


@dataclass(frozen=True)
class Publisher:
    """Trusted, repository-owned configuration for one publisher."""

    source_id: str
    name: str
    site_url: str
    hosts: tuple[str, ...]
    sitemaps: tuple[str, ...] = ()
    article_prefixes: tuple[str, ...] = ()
    discovery_pages: tuple[str, ...] = ()


def load_publishers(path: Path | None = None) -> dict[str, Publisher]:
    """Read the explicit host allowlist and verified discovery URLs."""
    config_path = path or Path(__file__).with_name("publisher_sources.json")
    entries = json.loads(config_path.read_text(encoding="utf-8"))
    return {
        source_id: Publisher(
            source_id, entry["name"], entry["site_url"], tuple(entry["hosts"]),
            tuple(entry.get("sitemaps", [])), tuple(entry.get("article_prefixes", [])),
            tuple(entry.get("discovery_pages", [])),
        )
        for source_id, entry in entries.items()
    }


def publisher_url(raw: str, base_url: str, publisher: Publisher) -> str:
    """Accept HTTPS URLs on the configured publisher hosts; reject credentials/IPs."""
    try:
        parsed = urlsplit(urljoin(base_url, raw))
        host = (parsed.hostname or "").lower().removeprefix("www.")
        port = parsed.port
    except ValueError:
        return ""
    if (parsed.scheme != "https" or parsed.username or parsed.password
            or port not in (None, 443) or not host):
        return ""
    try:
        ipaddress.ip_address(host)
        return ""
    except ValueError:
        pass
    if not any(host == allowed or host.endswith("." + allowed) for allowed in publisher.hosts):
        return ""
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path or "/", parsed.query, ""))


def _validate_network_url(url: str, publisher: Publisher) -> None:
    if not publisher_url(url, publisher.site_url, publisher):
        raise PublisherFeedError("publisher_host_not_allowed")
    host = urlsplit(url).hostname
    try:
        addresses = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
    except OSError as exc:
        raise PublisherFeedError("publisher_dns_failed") from exc
    if not addresses or any(not ipaddress.ip_address(row[4][0]).is_global for row in addresses):
        raise PublisherFeedError("publisher_address_not_public")


class _PublisherRedirects(HTTPRedirectHandler):
    def __init__(self, publisher: Publisher, deadline: float) -> None:
        self.publisher = publisher
        self.deadline = deadline
        self.redirects = 0

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        self.redirects += 1
        try:
            if self.redirects > 3 or time.monotonic() >= self.deadline:
                raise PublisherFeedError("publisher_redirect_budget_exceeded")
            _validate_network_url(newurl, self.publisher)
        except PublisherFeedError:
            if fp is not None:
                fp.close()
            raise
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def fetch_document(url: str, publisher: Publisher, deadline: float) -> tuple[bytes, str]:
    """Fetch a bounded document; validate every redirect and retain TLS verification."""
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise PublisherFeedError("publisher_timeout")
    _validate_network_url(url, publisher)
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept-Language": "en"})
    opener = build_opener(_PublisherRedirects(publisher, deadline))
    try:
        with opener.open(request, timeout=min(FETCH_SECONDS, remaining)) as response:
            chunks = []
            size = 0
            while size <= MAX_BYTES:
                if time.monotonic() >= deadline:
                    raise PublisherFeedError("publisher_timeout")
                chunk = response.read1(min(65536, MAX_BYTES + 1 - size))
                if not chunk:
                    break
                chunks.append(chunk)
                size += len(chunk)
            raw = b"".join(chunks)
            final_url = response.url
    except HTTPError as exc:
        exc.close()
        raise PublisherFeedError(f"publisher_http_{exc.code}") from exc
    except (URLError, OSError, TimeoutError) as exc:
        raise PublisherFeedError("publisher_fetch_failed") from exc
    if len(raw) > MAX_BYTES:
        raise PublisherFeedError("publisher_document_too_large")
    if raw.startswith(b"\x1f\x8b"):
        try:
            with gzip.GzipFile(fileobj=io.BytesIO(raw)) as compressed:
                raw = compressed.read(MAX_BYTES + 1)
        except (OSError, EOFError) as exc:
            raise PublisherFeedError("publisher_invalid_gzip") from exc
        if len(raw) > MAX_BYTES:
            raise PublisherFeedError("publisher_document_too_large")
    return raw, final_url


def _text(raw: str) -> str:
    return " ".join(unescape(raw).split()).strip()


def _nodes(value: object) -> Iterator[dict]:
    pending = [value]
    while pending:
        item = pending.pop()
        if isinstance(item, list):
            pending.extend(reversed(item))
        elif isinstance(item, dict):
            yield item
            pending.extend(reversed(list(item.values())))


def _is_article(node: dict) -> bool:
    types = node.get("@type", [])
    if isinstance(types, str):
        types = [types]
    if not isinstance(types, list):
        return False
    return any(isinstance(kind, str) and (kind in ARTICLE_TYPES or kind.endswith("NewsArticle")) for kind in types)


def _node_url(node: dict) -> str:
    candidate = node.get("url") or node.get("mainEntityOfPage") or node.get("@id") or ""
    if isinstance(candidate, dict):
        candidate = candidate.get("@id") or candidate.get("url") or ""
    return candidate if isinstance(candidate, str) else ""


class PublisherPage(HTMLParser):
    """Extract published metadata, article paragraphs and real discovery links."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.metadata: dict[str, str] = {}
        self.canonical = ""
        self.structured: list[object] = []
        self.links: list[tuple[str, str]] = []
        self.paragraphs: list[str] = []
        self._stack: list[tuple[str, bool, bool]] = []
        self._script: list[str] | None = None
        self._anchor: tuple[str, list[str]] | None = None
        self._paragraph: list[str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = dict(attrs)
        if tag == "meta":
            key = attr.get("property") or attr.get("name") or attr.get("itemprop")
            if key and attr.get("content"):
                self.metadata.setdefault(key.lower(), attr["content"])
        if tag == "link" and attr.get("rel") == "canonical":
            self.canonical = attr.get("href") or ""
        if tag == "script" and (attr.get("type") or "").lower() == "application/ld+json":
            self._script = []
        inherited_article = bool(self._stack and self._stack[-1][1])
        inherited_excluded = bool(self._stack and self._stack[-1][2])
        article = (inherited_article or tag in ("article", "main")
                   or attr.get("itemprop") == "articleBody"
                   or "sc__font-paragraph" in (attr.get("class") or "").split())
        excluded = inherited_excluded or tag in ("script", "style", "nav", "header", "footer", "aside")
        if tag not in ("meta", "link", "img", "input", "br", "hr", "source", "wbr", "area", "base", "embed", "param", "track", "col"):
            self._stack.append((tag, article, excluded))
        if tag == "a" and attr.get("href"):
            self._anchor = (attr["href"], [])
        if tag == "p" and article and not excluded:
            self._paragraph = []

    def handle_data(self, value: str) -> None:
        if self._script is not None:
            self._script.append(value)
        if self._anchor is not None and not (self._stack and self._stack[-1][2]):
            self._anchor[1].append(value)
        if self._paragraph is not None and not (self._stack and self._stack[-1][2]):
            self._paragraph.append(value)

    def handle_endtag(self, tag: str) -> None:
        if tag == "script" and self._script is not None:
            try:
                self.structured.append(json.loads("".join(self._script)))
            except (ValueError, RecursionError):
                pass
            self._script = None
        if tag == "a" and self._anchor is not None:
            self.links.append((self._anchor[0], _text(" ".join(self._anchor[1]))))
            self._anchor = None
        if tag == "p" and self._paragraph is not None:
            paragraph = _text(" ".join(self._paragraph))
            if len(paragraph) >= 40 and paragraph not in self.paragraphs:
                self.paragraphs.append(paragraph)
            self._paragraph = None
        for index in range(len(self._stack) - 1, -1, -1):
            if self._stack[index][0] == tag:
                del self._stack[index:]
                break


def publication_time(raw: object) -> datetime | None:
    """Read an explicit publication timestamp without inventing a timezone."""
    if not isinstance(raw, str) or not raw:
        return None
    try:
        try:
            parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            parsed = parsedate_to_datetime(raw)
        return parsed.astimezone(timezone.utc) if parsed.tzinfo else None
    except (ValueError, TypeError, OverflowError):
        return None


def parse_article(page_html: str, page_url: str, publisher: Publisher) -> dict[str, str] | None:
    """Return only a current, accessible article whose content belongs to this page."""
    page = PublisherPage()
    page.feed(page_html)
    canonical = publisher_url(page.canonical or page_url, page_url, publisher)
    if not canonical:
        return None
    matching = []
    for node in _nodes(page.structured):
        if not _is_article(node):
            continue
        node_url = publisher_url(_node_url(node), page_url, publisher) if _node_url(node) else ""
        if node_url and urlsplit(node_url).path.rstrip("/") == urlsplit(canonical).path.rstrip("/"):
            matching.append(node)
        elif not node_url and page.metadata.get("og:type") == "article":
            matching.append(node)
    if not matching and page.metadata.get("og:type") != "article":
        return None
    if page.metadata.get("isaccessibleforfree", "").lower() == "false":
        return None
    if any(str(node.get("isAccessibleForFree", "")).lower() == "false" for node in matching):
        return None
    # This explicit lock state is emitted by Nikkei even when no Schema.org flag is present.
    if re.search(r'"(?:isLockedArticle|isPaidUserOnlyArticle)"\s*:\s*true', page_html.replace('\\"', '"')):
        return None
    node = matching[0] if matching else {}
    headline = node.get("headline")
    title = _text(headline if isinstance(headline, str) else page.metadata.get("og:title", ""))
    published = publication_time(node.get("datePublished") or page.metadata.get("article:published_time")
                                 or page.metadata.get("datepublished"))
    now = time.time()
    if not title or published is None or not now - MAX_AGE_SECONDS <= published.timestamp() <= now + 86400:
        return None
    body = node.get("articleBody")
    if not isinstance(body, str) or len(_text(body)) < 300:
        body = "\n\n".join(page.paragraphs)
    body = _text(body)
    if len(body) < 300:
        return None
    row = {
        "title": title, "url": canonical, "publishedAt": format_datetime(published, usegmt=True),
        "description": body[:16000], "source": publisher.name,
        "sourceName": publisher.name, "sourceUrl": publisher.site_url,
    }
    image = publisher_url(page.metadata.get("og:image", ""), page_url, publisher) if page.metadata.get("og:image") else ""
    if image:
        row["thumbnailUrl"] = image
    return row


def page_candidates(page_html: str, page_url: str, publisher: Publisher) -> list[str]:
    """Discover URLs present in structured data or actual publisher links."""
    page = PublisherPage()
    page.feed(page_html)
    candidates = [_node_url(node) for node in _nodes(page.structured) if _is_article(node)]
    candidates.extend(url for url, title in page.links if len(title) >= 35)
    return _unique_article_urls(candidates, page_url, publisher)


def _unique_article_urls(candidates: list[str], base: str, publisher: Publisher) -> list[str]:
    unique = []
    for raw in candidates:
        url = publisher_url(raw, base, publisher) if raw else ""
        if not url or url in unique or urlsplit(url).path in ("", "/"):
            continue
        if publisher.article_prefixes and not any(urlsplit(url).path.startswith(prefix) for prefix in publisher.article_prefixes):
            continue
        unique.append(url)
    return unique


def sitemap_candidates(xml: bytes, sitemap_url: str, publisher: Publisher) -> tuple[list[str], list[str]]:
    """Read an advertised sitemap/index; never use lastmod as publication date."""
    try:
        root = ET.fromstring(xml)
    except ET.ParseError as exc:
        raise PublisherFeedError("publisher_sitemap_invalid_xml") from exc
    if root.tag.rsplit("}", 1)[-1] == "sitemapindex":
        children = list(root)
        children.sort(key=lambda item: (
            any(word in (item.findtext("{*}loc") or "").lower() for word in ("news", "latest", "articles")),
            item.findtext("{*}lastmod") or "",
        ), reverse=True)
        urls = [publisher_url(item.findtext("{*}loc", ""), sitemap_url, publisher) for item in children]
        return [], [url for url in urls if url][:3]
    if root.tag.rsplit("}", 1)[-1] != "urlset":
        raise PublisherFeedError("publisher_sitemap_invalid_root")
    entries = list(root)
    entries.sort(key=lambda item: item.findtext(".//{*}publication_date") or item.findtext("{*}lastmod") or "", reverse=True)
    return _unique_article_urls([item.findtext("{*}loc", "") for item in entries], sitemap_url, publisher), []


def fetch_publisher_articles(publisher: Publisher, limit: int = 10) -> list[dict[str, str]]:
    """Discover and verify public article content within a bounded request budget."""
    deadline = time.monotonic() + RUN_SECONDS
    home_candidates: list[str] = []
    map_candidates: list[str] = []
    errors: list[str] = []
    for discovery_url in (*publisher.discovery_pages, publisher.site_url):
        try:
            raw, final_url = fetch_document(discovery_url, publisher, deadline)
            home_candidates.extend(page_candidates(raw.decode("utf-8", errors="replace"), final_url, publisher))
        except PublisherFeedError as exc:
            errors.append(str(exc))
    sitemap_queue = list(publisher.sitemaps)
    visited: set[str] = set()
    while sitemap_queue and len(visited) < 3 and not map_candidates and time.monotonic() < deadline - 4:
        sitemap_url = sitemap_queue.pop(0)
        if sitemap_url in visited:
            continue
        visited.add(sitemap_url)
        try:
            raw, final_url = fetch_document(sitemap_url, publisher, deadline)
            articles, children = sitemap_candidates(raw, final_url, publisher)
            map_candidates.extend(articles)
            sitemap_queue[0:0] = children
        except PublisherFeedError as exc:
            errors.append(str(exc))
    candidates = list(dict.fromkeys(map_candidates[:6] + home_candidates[:10]))[:16]

    def verify(url: str) -> dict[str, str] | None:
        try:
            raw, final_url = fetch_document(url, publisher, deadline)
            return parse_article(raw.decode("utf-8", errors="replace"), final_url, publisher)
        except PublisherFeedError:
            return None

    with ThreadPoolExecutor(max_workers=4) as pool:
        verified = [row for row in pool.map(verify, candidates) if row]
    unique = {row["url"]: row for row in verified}
    rows = sorted(unique.values(), key=lambda row: publication_time(row["publishedAt"]), reverse=True)
    if not rows:
        detail = ",".join(dict.fromkeys(errors)) or "no_current_readable_public_articles"
        raise PublisherFeedError("publisher_unavailable:" + detail)
    return rows[:max(1, min(30, limit))]
