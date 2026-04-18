#!/usr/bin/env python3
# Cucumber NewsScraper — LM Studio CORS preflight helper (standalone proxy).
#
# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Daniel Mengel
#
"""
Minimal CORS proxy for LM Studio native REST API (POST /api/v1/chat).

LM Studio may log: "Unexpected endpoint or method. (OPTIONS /api/v1/chat)" — the
browser sends a CORS preflight (OPTIONS) before POST; if the local server does
not handle OPTIONS for that path, fetch() fails with "Failed to fetch".

This proxy:
  - Answers OPTIONS /api/v1/chat with 204 + Access-Control-* headers
  - Forwards POST /api/v1/chat to the real LM Studio server (default :1234)

Usage:
  python3 scripts/lm_studio_cors_proxy.py
  python3 scripts/lm_studio_cors_proxy.py --listen 127.0.0.1 --port 1244 --target http://127.0.0.1:1234

Then set the dashboard "Server-URL" (REST mode) to http://127.0.0.1:1244
(same host/port as this proxy, no path).
"""

from __future__ import annotations

import argparse
import http.client
import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

DEFAULT_TARGET = "http://127.0.0.1:1234"
DEFAULT_BIND = "127.0.0.1"
DEFAULT_PORT = 1244

_LM_REASONING_ALLOWED = frozenset({"off", "low", "medium", "high", "on"})


def _normalize_lm_chat_reasoning_body(body: bytes) -> bytes:
    """
    Fix invalid `reasoning` in POST JSON before forwarding to LM Studio.
    Legacy value `none` is treated like `off`.
    Invalid values are normalized to `off`.
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


def cors_headers(handler: BaseHTTPRequestHandler) -> None:
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, ngrok-skip-browser-warning",
    )
    handler.send_header("Access-Control-Max-Age", "86400")


def connect_upstream(target: str):
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


class ProxyHandler(BaseHTTPRequestHandler):
    target_base: str = DEFAULT_TARGET

    def log_message(self, fmt: str, *args: object) -> None:
        sys.stderr.write(
            "%s - - [%s] %s\n" % (self.address_string(), self.log_date_time_string(), fmt % args)
        )

    def do_OPTIONS(self) -> None:
        path_only = self.path.split("?", 1)[0]
        if path_only == "/api/v1/chat":
            self.send_response(204)
            cors_headers(self)
            self.end_headers()
            return
        self.send_error(404, "Not found")

    def do_GET(self) -> None:
        if self.path in ("/", "/health"):
            body = (
                b"LM Studio CORS proxy OK. Forwarding POST /api/v1/chat to "
                + self.target_base.encode("utf-8")
                + b"\n"
            )
            self.send_response(200)
            cors_headers(self)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_error(404, "Not found")

    def do_POST(self) -> None:
        path_only = self.path.split("?", 1)[0]
        if path_only != "/api/v1/chat":
            self.send_error(404, "Only POST /api/v1/chat is supported")
            return

        length = int(self.headers.get("Content-Length", "0") or "0")
        body = self.rfile.read(length) if length > 0 else b""
        body = _normalize_lm_chat_reasoning_body(body)

        conn = connect_upstream(self.target_base)
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

            # LM Studio 0.4+ REST: always this path on the target server root.
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
        finally:
            conn.close()


def make_handler_class(target: str) -> type:
    class Bound(ProxyHandler):
        target_base = target

    return Bound


def main() -> int:
    p = argparse.ArgumentParser(description="CORS proxy for LM Studio POST /api/v1/chat")
    p.add_argument("--listen", default=DEFAULT_BIND, help="Bind address")
    p.add_argument("--port", type=int, default=DEFAULT_PORT, help="Listen port")
    p.add_argument(
        "--target",
        default=DEFAULT_TARGET,
        help="LM Studio server root (e.g. http://127.0.0.1:1234)",
    )
    args = p.parse_args()

    handler = make_handler_class(args.target.rstrip("/"))
    server = HTTPServer((args.listen, args.port), handler)
    print(
        f"CORS proxy listening on http://{args.listen}:{args.port}\n"
        f"Forwarding POST /api/v1/chat -> {args.target}/api/v1/chat\n"
        f"Set dashboard REST Server-URL to: http://{args.listen}:{args.port}",
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
