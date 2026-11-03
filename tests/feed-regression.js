/* Test fixtures and test-only fetch/cache targets. No production provider data is mocked. */
'use strict';

async function runFeedRegressionChecks() {
    let failed = 0;
    let total = 0;
    const check = async (name, run) => {
        total += 1;
        const result = document.createElement('li');
        try {
            await run();
            result.textContent = `PASS: ${name}`;
        } catch (error) {
            failed += 1;
            result.textContent = `FAIL: ${name}: ${error.message}`;
        }
        document.getElementById('results').append(result);
    };
    const assert = (condition, message) => {
        if (!condition) throw new Error(message);
    };
    const scraper = new NewsScraper();
    scraper.configureSource('cnet');
    const title = 'Feed parser test fixture';
    const url = 'https://www.cnet.com/tech/test-fixture';
    const date = '2026-11-03T12:00:00Z';

    await check('RSS 2.0 preserves publisher URL, title and date', () => {
        const rows = scraper.parseFeed(`<rss version="2.0"><channel><item>
            <title>${title}</title><link>${url}</link>
            <pubDate>Tue, 03 Nov 2026 12:00:00 GMT</pubDate>
            </item></channel></rss>`);
        assert(rows.length === 1 && rows[0].title === title && rows[0].url === url
            && rows[0].publishedMs === Date.parse(date), 'RSS article was lost or changed');
    });
    await check('Atom is detected for a direct_rss provider', () => {
        const rows = scraper.parseFeed(`<feed xmlns="http://www.w3.org/2005/Atom">
            <entry><title>${title}</title><link href="${url}"/>
            <updated>${date}</updated></entry></feed>`);
        assert(rows.length === 1 && rows[0].url === url
            && rows[0].publishedMs === Date.parse(date), 'Atom article was lost or changed');
    });
    await check('RSS 1.0 preserves the Dublin Core publication date', () => {
        const rows = scraper.parseFeed(`<rdf:RDF
            xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
            xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
            <item rdf:about="${url}"><title>${title}</title><link>${url}</link>
            <dc:date>${date}</dc:date></item></rdf:RDF>`);
        assert(rows.length === 1 && rows[0].publishedMs === Date.parse(date),
            'RSS 1.0 article was incorrectly dated as newly fetched');
    });
    await check('Unrelated publisher URLs are rejected', () => {
        const rows = scraper.parseFeed(`<rss><channel><item><title>${title}</title>
            <link>https://example.invalid/test-fixture</link></item></channel></rss>`);
        assert(rows.length === 0, 'Unrelated host passed the allowlist');
    });
    await check('Previously cached offline placeholders are excluded', () => {
        const fixtures = [{ id: 'n_tv-fallback-1' }, { id: 'fallback-2' },
            { id: 'old-demo', title: 'Example (offline demo)' },
            { id: 'real-test-row', title, url }];
        const rows = NewsScraper.filterOutAdvertorialItems(fixtures);
        assert(rows.length === 1 && rows[0].id === 'real-test-row', 'Placeholder survived filtering');
    });
    for (const path of ['/tests/fixtures/empty-rss.xml', '/tests/fixtures/missing-rss.xml']) {
        await check(`Feed failure rejects instead of creating demo news: ${path}`, async () => {
            const failing = new NewsScraper();
            failing.configureSource('cnet');
            failing.cacheName = 'cucumber-feed-regression-test';
            failing.feedCacheKey = path;
            failing.feedProxyPath = path;
            failing.directFeedUrl = '';
            try {
                let rejected = false;
                try {
                    await failing.fetchNews();
                } catch {
                    rejected = true;
                }
                assert(rejected, 'Failed feed was treated as successful news');
                const cache = await caches.open(failing.cacheName);
                assert(!(await cache.match(path)), 'Failed response was cached');
            } finally {
                await caches.delete(failing.cacheName);
            }
        });
    }
    document.getElementById('status').textContent = `${total - failed}/${total} checks passed`;
    document.title = `${failed ? 'FAIL' : 'PASS'} — Feed regression checks`;
    if (new URLSearchParams(window.location.search).has('live')) {
        await runLiveProviderChecks();
    }
}

async function runLiveProviderChecks() {
    const status = document.createElement('p');
    status.id = 'live-status';
    document.body.append(status);
    const results = document.createElement('ol');
    document.body.append(results);
    const selection = new URLSearchParams(window.location.search).get('live');
    const queue = window.NEWS_SOURCES_REGISTRY.filter(source =>
        selection === '1' || selection.split(',').includes(source.id));
    const sourceCount = queue.length;
    const report = [];
    const worker = async () => {
        while (queue.length) {
            const source = queue.shift();
            const scraper = new NewsScraper();
            scraper.configureSource(source.id);
            scraper.cacheName = `cucumber-feed-regression-live-${source.id}`;
            const record = { id: source.id, ok: false };
            try {
                const rows = await scraper.fetchNews();
                record.count = rows.length;
                record.ok = rows.length > 0 && rows.every(row =>
                    !NewsScraper.isOfflineDemoNewsItem(row) && scraper.matchesAllowedHost(row.url));
                if (source.feedStrategy === 'publisher' && rows.length) {
                    record.minimumTextLength = Math.min(...rows.map(row => (row.description || '').length));
                    record.ok = record.ok && record.minimumTextLength >= 300
                        && rows.every(row => Number.isFinite(row.publishedMs));
                }
            } catch (error) {
                record.error = error.message;
            } finally {
                await caches.delete(scraper.cacheName);
            }
            report.push(record);
            const item = document.createElement('li');
            item.textContent = `${record.ok ? 'PASS' : 'FAIL'} ${record.id}: ${record.count || 0} articles ${record.error || ''}`;
            results.append(item);
            status.textContent = `Live providers: ${report.length}/${sourceCount} checked`;
        }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    status.textContent = `Live providers: ${report.filter(row => row.ok).length}/${report.length} passed`;
    const evidence = document.createElement('pre');
    evidence.id = 'live-report';
    evidence.textContent = JSON.stringify(report, null, 2);
    document.body.append(evidence);
}

void runFeedRegressionChecks();
