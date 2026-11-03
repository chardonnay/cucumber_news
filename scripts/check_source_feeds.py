#!/usr/bin/env python3
"""Live smoke test of the configured publisher feeds; requires Python 3 and Node.js.

Run the dev server first, then:
  .venv/bin/python scripts/check_source_feeds.py --output /tmp/source-feeds.json
Exit status is 1 if any source fails. No article generation or browser data is changed.
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import json
from pathlib import Path
import subprocess
import time
from urllib.error import HTTPError
from urllib.parse import quote, urljoin, urlparse
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parent.parent
ATOM = "http://www.w3.org/2005/Atom"


def source_requests(base_url: str) -> list[dict]:
    # Test environment adapter: expose the browser global while reading the actual
    # registry and scraper configuration in Node. No provider data is mocked.
    script = r"""
const fs = require('node:fs');
const vm = require('node:vm');
const context = { URL, URLSearchParams, window: {} };
vm.createContext(context);
for (const path of ['js/news-sources-registry.js', 'js/news-scraper.js']) {
    vm.runInContext(fs.readFileSync(path, 'utf8'), context, { filename: path });
}
const rows = context.window.NEWS_SOURCES_REGISTRY.map(entry => {
    const scraper = new context.window.NewsScraper();
    scraper.configureSource(entry.id);
    return { id: entry.id, name: entry.displayName, hosts: scraper.allowedHosts,
        strategy: entry.feedStrategy || 'legacy',
        url: scraper.feedProxyPath || scraper.feedUrl,
        feedUrl: entry.feedUrl || scraper.directFeedUrl };
});
process.stdout.write(JSON.stringify(rows));
"""
    result = subprocess.run(
        ["node", "-e", script], cwd=ROOT, check=True, capture_output=True, text=True
    )
    rows = json.loads(result.stdout)
    for row in rows:
        if row["id"] == "heise":
            row["url"] = "/api/heise-feed?url=" + quote(row["feedUrl"], safe="")
        row["url"] = urljoin(base_url, row["url"])
    return rows


def date_timestamp(raw: str) -> float | None:
    try:
        try:
            value = parsedate_to_datetime(raw)
        except (ValueError, TypeError):
            value = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return value.replace(tzinfo=value.tzinfo or timezone.utc).timestamp()
    except (ValueError, TypeError, OverflowError):
        return None


def check_source(row: dict, timeout: float) -> dict:
    result = {**row, "ok": False}
    start = time.monotonic()
    try:
        request = Request(row["url"], headers={"User-Agent": "Cucumber-Feed-Check/1.0"})
        with urlopen(request, timeout=timeout) as response:
            result["status"] = response.status
            raw = response.read(8 * 1024 * 1024)
        root = ET.fromstring(raw)
        items = root.findall(".//{*}item") + root.findall(f".//{{{ATOM}}}entry")
        dates = []
        usable = []
        for item in items:
            title = (item.findtext("{*}title") or "").strip()
            link = (item.findtext("{*}link") or "").strip()
            if not link:
                link = next((
                    child.get("href", "") for child in item.findall(f"{{{ATOM}}}link")
                    if child.get("rel", "alternate") == "alternate"
                ), "")
            parsed = urlparse(link)
            host = (parsed.hostname or "").lower().removeprefix("www.")
            if not title or parsed.scheme not in ("http", "https") or not any(
                host == allowed or host.endswith("." + allowed) for allowed in row["hosts"]
            ):
                continue
            usable.append({"title": title, "url": link})
            for field in ("pubDate", "date", "published", "updated"):
                stamp = date_timestamp(item.findtext("{*}" + field, ""))
                if stamp is not None:
                    dates.append(stamp)
                    break
        result.update(raw_count=len(items), count=len(usable), samples=usable[:2])
        if not usable:
            result["error"] = "No entries with a title and an allowed publisher URL"
        elif dates and max(dates) < time.time() - 30 * 86400:
            result["error"] = "Newest dated entry is older than 30 days"
        else:
            result["ok"] = True
        if dates:
            result["latest"] = datetime.fromtimestamp(max(dates), timezone.utc).isoformat()
    except HTTPError as exc:
        result.update(status=exc.code, error=exc.read(2048).decode("utf-8", errors="replace"))
    except (OSError, ValueError, ET.ParseError) as exc:
        result["error"] = str(exc)
    result["seconds"] = round(time.monotonic() - start, 2)
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://localhost:8080/")
    parser.add_argument("--source", action="append", help="Check only these source IDs")
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--timeout", type=float, default=65)
    parser.add_argument("--output", type=Path, help="Write detailed JSON evidence")
    args = parser.parse_args()
    rows = source_requests(args.base_url)
    if args.source:
        unknown = set(args.source) - {row["id"] for row in rows}
        if unknown:
            parser.error("Unknown source IDs: " + ", ".join(sorted(unknown)))
        rows = [row for row in rows if row["id"] in args.source]
    with ThreadPoolExecutor(max_workers=max(1, min(args.workers, 16))) as pool:
        results = list(pool.map(lambda row: check_source(row, args.timeout), rows))
    for result in results:
        print(f"{'PASS' if result['ok'] else 'FAIL'} {result['id']}: "
              f"{result.get('count', 0)} entries {result.get('error', '')}")
    report = {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "passed": sum(row["ok"] for row in results), "total": len(results),
        "sources": results,
    }
    if args.output:
        args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(f"{report['passed']}/{report['total']} sources passed")
    return int(report["passed"] != report["total"])


if __name__ == "__main__":
    raise SystemExit(main())
