"""Test-only article/sitemap fixtures; no production provider data is faked."""

from datetime import datetime, timedelta, timezone
import json
import unittest
from unittest.mock import patch

from scripts.publisher_feeds import (
    Publisher, PublisherFeedError, _PublisherRedirects, _validate_network_url,
    page_candidates, parse_article, publication_time, publisher_url, sitemap_candidates,
)


PUBLISHER = Publisher("test", "Test publisher", "https://publisher.example", ("publisher.example",))
ARTICLE_URL = "https://publisher.example/articles/test-fixture"
BODY = "This is test-only article content with enough detail to verify the extraction path. " * 8


def article_fixture(*, date=None, free=True, canonical=ARTICLE_URL, structured=True, body=BODY):
    """Generate explicitly synthetic HTML for parser regression tests only."""
    stamp = date or datetime.now(timezone.utc).isoformat()
    node = {
        "@type": "NewsArticle", "url": ARTICLE_URL, "headline": "Test-only article",
        "datePublished": stamp, "isAccessibleForFree": free,
    }
    script = f'<script type="application/ld+json">{json.dumps(node)}</script>' if structured else ""
    return (
        f'<html><head><link rel="canonical" href="{canonical}">'
        f'<meta property="og:type" content="article"><meta property="og:title" content="Test-only article">'
        f'<meta property="article:published_time" content="{stamp}">{script}</head>'
        f'<body><nav><p>Navigation test fixture</p></nav><main><article><p>{body}</p>'
        '</article><aside><p>Related item test fixture</p></aside></main></body></html>'
    )


class PublisherArticleTests(unittest.TestCase):
    def test_public_article_has_verified_text_title_and_publication_date(self):
        row = parse_article(article_fixture(), ARTICLE_URL, PUBLISHER)
        self.assertEqual(row["title"], "Test-only article")
        self.assertEqual(row["url"], ARTICLE_URL)
        self.assertEqual(row["description"], BODY.strip())
        self.assertIsNotNone(publication_time(row["publishedAt"]))

    def test_paywall_flags_in_schema_or_html_metadata_are_rejected(self):
        fixtures = [article_fixture(free=False), article_fixture(free="False")]
        metadata_only = article_fixture(structured=False).replace(
            '<body>', '<body><meta itemprop="isAccessibleForFree" content="false">'
        )
        fixtures.append(metadata_only)
        for fixture in fixtures:
            with self.subTest(fixture=fixture[:80]):
                self.assertIsNone(parse_article(fixture, ARTICLE_URL, PUBLISHER))

    def test_explicit_locked_article_state_is_rejected(self):
        fixture = article_fixture().replace('<body>', '<body><script>{"isLockedArticle":true}</script>')
        self.assertIsNone(parse_article(fixture, ARTICLE_URL, PUBLISHER))

    def test_sitemap_metadata_or_short_teaser_cannot_become_an_article(self):
        self.assertIsNone(parse_article('<h1>Test-only title</h1>', ARTICLE_URL, PUBLISHER))
        self.assertIsNone(parse_article(article_fixture(body="Short test-only teaser."), ARTICLE_URL, PUBLISHER))

    def test_stale_publication_is_not_replaced_by_a_recent_update(self):
        old = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
        fixture = article_fixture(date=old).replace(
            '"isAccessibleForFree": true',
            f'"dateModified": "{datetime.now(timezone.utc).isoformat()}", "isAccessibleForFree": true',
        )
        self.assertIsNone(parse_article(fixture, ARTICLE_URL, PUBLISHER))

    def test_absent_or_ambiguous_publication_date_is_not_invented(self):
        for stamp in ("not a date", "2026-11-03", "2026-11-03T12:00:00"):
            self.assertIsNone(publication_time(stamp))
            self.assertIsNone(parse_article(article_fixture(date=stamp), ARTICLE_URL, PUBLISHER))

    def test_listing_page_cannot_borrow_a_nested_article_as_its_own_body(self):
        listing = article_fixture(canonical="https://publisher.example/").replace(
            'content="article"', 'content="website"'
        )
        self.assertIsNone(parse_article(listing, PUBLISHER.site_url, PUBLISHER))

    def test_article_canonical_cannot_change_publisher(self):
        fixture = article_fixture(canonical="https://other.example/article")
        self.assertIsNone(parse_article(fixture, ARTICLE_URL, PUBLISHER))

    def test_actual_links_are_resolved_and_host_filtered(self):
        page = '<a href="/articles/real-link">An explicitly labelled test-only discovery headline</a>'
        page += '<a href="https://other.example/fake">Another explicitly labelled test-only headline</a>'
        self.assertEqual(page_candidates(page, PUBLISHER.site_url, PUBLISHER),
                         ["https://publisher.example/articles/real-link"])


class PublisherNetworkTests(unittest.TestCase):
    def test_http_credentials_ip_literals_nonstandard_ports_and_lookalike_hosts_are_rejected(self):
        invalid = ["http://publisher.example/a", "https://user:secret@publisher.example/a",
                   "https://127.0.0.1/a", "https://[::1]/a", "https://publisher.example:444/a",
                   "https://publisher.example.attacker.example/a", "file:///etc/passwd",
                   "https://[invalid-ipv6/"]
        for url in invalid:
            with self.subTest(url=url):
                self.assertEqual(publisher_url(url, PUBLISHER.site_url, PUBLISHER), "")

    def test_redirect_outside_publisher_is_rejected_before_fetch(self):
        handler = _PublisherRedirects(PUBLISHER, float("inf"))
        with self.assertRaises(PublisherFeedError):
            handler.redirect_request(None, None, 302, "Found", {}, "https://other.example/a")

    def test_publisher_dns_cannot_resolve_to_private_network(self):
        # Test double: deterministic DNS response; no network request is made.
        with patch("scripts.publisher_feeds.socket.getaddrinfo", return_value=[(2, 1, 6, "", ("127.0.0.1", 443))]):
            with self.assertRaisesRegex(PublisherFeedError, "address_not_public"):
                _validate_network_url(ARTICLE_URL, PUBLISHER)


class PublisherSitemapTests(unittest.TestCase):
    def test_sitemap_dates_only_order_candidates_and_never_create_feed_rows(self):
        xml = b'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url>' \
              b'<loc>https://publisher.example/a</loc><lastmod>2099-01-01</lastmod></url>' \
              b'<url><loc>https://other.example/b</loc></url></urlset>'
        candidates, children = sitemap_candidates(xml, PUBLISHER.site_url, PUBLISHER)
        self.assertEqual(candidates, ["https://publisher.example/a"])
        self.assertEqual(children, [])

    def test_advertised_sitemap_index_only_follows_allowed_hosts(self):
        xml = b'<sitemapindex><sitemap><loc>https://publisher.example/news.xml</loc></sitemap>' \
              b'<sitemap><loc>https://other.example/private.xml</loc></sitemap></sitemapindex>'
        candidates, children = sitemap_candidates(xml, PUBLISHER.site_url, PUBLISHER)
        self.assertEqual(candidates, [])
        self.assertEqual(children, ["https://publisher.example/news.xml"])

    def test_html_error_page_is_not_a_sitemap(self):
        with self.assertRaises(PublisherFeedError):
            sitemap_candidates(b'<html><body>Denied test fixture</body></html>', PUBLISHER.site_url, PUBLISHER)


if __name__ == "__main__":
    unittest.main()
