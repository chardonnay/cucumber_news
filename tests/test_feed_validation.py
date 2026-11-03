"""Test-only XML fixtures for empty, invalid, RSS and Atom feed responses."""

import importlib.util
import html
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET


SPEC = importlib.util.spec_from_file_location(
    "scripts.dev_server", Path(__file__).resolve().parent.parent / "scripts" / "dev_server.py"
)
SERVER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SERVER)


class FeedValidationTests(unittest.TestCase):
    def test_publisher_text_survives_feed_encoding_without_interpreting_literal_html(self):
        literal = 'Test-only literal <img src="invalid" onerror="test-only"> & text'
        xml = SERVER._build_source_feed_rss_xml("Test", "https://publisher.example", "en", [{
            "title": "Test-only article", "url": "https://publisher.example/article",
            "description": literal,
        }])
        description = ET.fromstring(xml).findtext("./channel/item/description")
        self.assertNotIn("<img", description)
        self.assertEqual(html.unescape(description), literal)

    def test_empty_feeds_and_html_error_pages_fail(self):
        for xml in (
            '<rss><channel><title>Test fixture</title></channel></rss>',
            '<feed xmlns="http://www.w3.org/2005/Atom"/>',
            '<html><body>Access denied test fixture</body></html>',
            'invalid XML test fixture',
        ):
            with self.subTest(xml=xml), self.assertRaises(RuntimeError):
                SERVER._validate_source_feed_xml(xml)

    def test_rss_and_atom_entries_are_accepted(self):
        for xml in (
            '<rss><channel><item><title>Test fixture</title></item></channel></rss>',
            '<feed xmlns="http://www.w3.org/2005/Atom"><entry/></feed>',
            '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" '
            'xmlns="http://purl.org/rss/1.0/"><item/></rdf:RDF>',
        ):
            with self.subTest(xml=xml):
                SERVER._validate_source_feed_xml(xml)


if __name__ == '__main__':
    unittest.main()
