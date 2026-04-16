/**
 * Cucumber NewsScraper — news scraper (Atom/RSS fetch, parse, cache, category inference).
 *
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Daniel Mengel
 */

/** @typedef {'heise'|'bild'|'telepolis'|'golem'|'computerbase'|'t3n'|'it_administrator'|'verge'} NewsSourceId */

class NewsScraper {
    constructor() {
        this.configureSource('heise');
    }

    /**
     * @param {NewsSourceId|string} source
     */
    configureSource(source) {
        const catalog =
            typeof window !== 'undefined' && window.NEWS_SOURCE_IDS
                ? window.NEWS_SOURCE_IDS
                : ['heise', 'bild', 'telepolis', 'golem', 'computerbase', 't3n', 'it_administrator', 'verge'];
        const allowed = new Set(catalog);
        this.source = allowed.has(String(source)) ? String(source) : 'heise';

        /** @type {string[]} Extra Verge section Atom URLs merged with the main feed (deduped by article URL). */
        this.vergeSectionFeeds = [];

        this.feedType = 'atom';
        this.atomLinkHost = 'heise.de';
        this.rssItemHost = '';
        this.feedProxyPath = '';
        this.feedUrl = '';
        this.baseUrl = '';
        this.cacheName = 'heise-news-cache';
        this.rubricFeeds = [];

        switch (this.source) {
            case 'bild':
                this.baseUrl = 'https://www.bild.de';
                this.feedUrl = 'https://www.bild.de/feed/home.xml';
                this.cacheName = 'bild-news-cache';
                this.feedType = 'rss';
                this.rssItemHost = 'bild.de';
                this.feedProxyPath = '/api/bild-feed';
                break;
            case 'telepolis':
                this.baseUrl = 'https://www.telepolis.de';
                this.feedUrl = 'https://www.telepolis.de/news-atom.xml';
                this.cacheName = 'telepolis-news-cache';
                this.feedType = 'atom';
                this.atomLinkHost = 'telepolis.de';
                this.feedProxyPath = '/api/telepolis-feed';
                this.rubricFeeds = [];
                break;
            case 'golem':
                this.baseUrl = 'https://www.golem.de';
                this.feedUrl = 'https://rss.golem.de/rss.php?feed=RSS2.0';
                this.cacheName = 'golem-news-cache';
                this.feedType = 'rss';
                this.rssItemHost = 'golem.de';
                this.feedProxyPath = '/api/golem-feed';
                break;
            case 'computerbase':
                this.baseUrl = 'https://www.computerbase.de';
                this.feedUrl = 'https://www.computerbase.de/rss/news.xml';
                this.cacheName = 'computerbase-news-cache';
                this.feedType = 'atom';
                this.atomLinkHost = 'computerbase.de';
                this.feedProxyPath = '';
                break;
            case 't3n':
                this.baseUrl = 'https://t3n.de';
                this.feedUrl = 'https://t3n.de/rss.xml';
                this.cacheName = 't3n-news-cache';
                this.feedType = 'rss';
                this.rssItemHost = 't3n.de';
                this.feedProxyPath = '/api/t3n-feed';
                break;
            case 'it_administrator':
                this.baseUrl = 'https://www.it-administrator.de';
                this.feedUrl = 'https://www.it-administrator.de/rss.xml';
                this.cacheName = 'it-administrator-news-cache';
                this.feedType = 'rss';
                this.rssItemHost = 'it-administrator.de';
                this.feedProxyPath = '/api/it-administrator-feed';
                break;
            case 'verge':
                this.baseUrl = 'https://www.theverge.com';
                this.feedUrl = 'https://www.theverge.com/rss/index.xml';
                this.cacheName = 'verge-news-cache';
                this.feedType = 'atom';
                this.atomLinkHost = 'theverge.com';
                this.feedProxyPath = '/api/verge-feed';
                // Main index feed only has ~10 entries; merge section feeds so "load more" can appear (> itemsPerPage).
                this.vergeSectionFeeds = [
                    'https://www.theverge.com/rss/tech/index.xml',
                    'https://www.theverge.com/rss/reviews/index.xml',
                    'https://www.theverge.com/rss/science/index.xml',
                    'https://www.theverge.com/rss/entertainment/index.xml',
                    'https://www.theverge.com/rss/games/index.xml'
                ];
                break;
            default:
                this.source = 'heise';
                this.baseUrl = 'https://www.heise.de';
                this.feedUrl = `${this.baseUrl}/rss/heise-atom.xml`;
                this.cacheName = 'heise-news-cache';
                this.feedType = 'atom';
                this.atomLinkHost = 'heise.de';
                this.rubricFeeds = [
                    { url: `${this.baseUrl}/rss/heise-Rubrik-IT-atom.xml`, category: 'it' },
                    { url: `${this.baseUrl}/rss/heise-Rubrik-Wissen-atom.xml`, category: 'wissenschaft' },
                    { url: `${this.baseUrl}/rss/heise-Rubrik-Mobiles-atom.xml`, category: 'mobiles' },
                    { url: `${this.baseUrl}/rss/heise-Rubrik-Entertainment-atom.xml`, category: 'entertainment' },
                    { url: `${this.baseUrl}/rss/heise-Rubrik-Netzpolitik-atom.xml`, category: 'netzpolitik' },
                    { url: `${this.baseUrl}/rss/heise-Rubrik-Wirtschaft-atom.xml`, category: 'wirtschaft' },
                    { url: `${this.baseUrl}/rss/heise-Rubrik-Journal-atom.xml`, category: 'journal' },
                    { url: `${this.baseUrl}/security/feed.xml`, category: 'security' },
                    { url: `${this.baseUrl}/thema/Kuenstliche-Intelligenz.xml`, category: 'ki' }
                ];
        }

        this.categoryMap = {
            it: 'IT & Tech',
            security: 'Security',
            ki: 'KI',
            wissenschaft: 'Wissenschaft',
            mobiles: 'Mobiles',
            entertainment: 'Entertainment',
            wirtschaft: 'Wirtschaft',
            netzpolitik: 'Netzpolitik',
            journal: 'Journal',
            heise_ix: 'iX',
            heise_ct: "c't",
            heise_foto: "c't Fotografie",
            heise_mac: 'Mac & i',
            heise_make: 'Make',
            heise_autos: 'heise autos',
            bild: 'BILD',
            telepolis: 'Telepolis'
        };
    }

    /**
     * Heise magazine / section Atom feeds (merged into main heise.de stream when enabled in dashboard).
     * @returns {readonly { id: string, url: string, category: string }[]}
     */
    static heiseMagazineFeedDefs() {
        return [
            { id: 'ix', url: 'https://www.heise.de/ix/feed.xml', category: 'heise_ix' },
            { id: 'ct', url: 'https://www.heise.de/ct/feed.xml', category: 'heise_ct' },
            { id: 'foto', url: 'https://www.heise.de/foto/feed.xml', category: 'heise_foto' },
            { id: 'mac-and-i', url: 'https://www.heise.de/mac-and-i/feed.xml', category: 'heise_mac' },
            { id: 'make', url: 'https://www.heise.de/make/feed.xml', category: 'heise_make' },
            { id: 'autos', url: 'https://www.heise.de/autos/feed.xml', category: 'heise_autos' }
        ];
    }

    /**
     * @param {unknown} raw
     * @returns {string[]}
     */
    static normalizeHeiseMagazineFeedIds(raw) {
        const order = NewsScraper.heiseMagazineFeedDefs().map((d) => d.id);
        const known = new Set(order);
        if (!Array.isArray(raw)) {
            return [];
        }
        const picked = new Set();
        for (const x of raw) {
            const id = String(x || '').trim();
            if (known.has(id)) {
                picked.add(id);
            }
        }
        return order.filter((id) => picked.has(id));
    }

    /**
     * Enabled heise subsection feeds (localStorage mirror from dashboard).
     * @returns {string[]}
     */
    static getEnabledHeiseMagazineFeedIds() {
        try {
            if (
                typeof window !== 'undefined' &&
                Array.isArray(window.__heiseEnabledMagazineFeeds)
            ) {
                return NewsScraper.normalizeHeiseMagazineFeedIds(window.__heiseEnabledMagazineFeeds);
            }
        } catch (_) {
            /* ignore */
        }
        try {
            const raw = localStorage.getItem('heise_enabled_magazine_feeds');
            if (raw) {
                const arr = JSON.parse(raw);
                return NewsScraper.normalizeHeiseMagazineFeedIds(arr);
            }
        } catch (_) {
            /* ignore */
        }
        return [];
    }

    async fetchNews() {
        try {
            const cached = await caches.open(this.cacheName);
            const hit = await cached.match(this.feedUrl);
            if (hit) {
                const xml = await hit.text();
                let parsed =
                    this.feedType === 'rss' ? this.parseRss2Feed(xml) : this.parseAtomFeed(xml);
                if (parsed.length > 0) {
                    if (this.source === 'heise') {
                        const extra = await this.fetchHeiseMagazineFeedArticles();
                        parsed = parsed.concat(extra);
                    }
                    return this.dedupeAndSort(parsed);
                }
            }

            const controller = new AbortController();
            const vergeMulti =
                this.source === 'verge' &&
                Array.isArray(this.vergeSectionFeeds) &&
                this.vergeSectionFeeds.length > 0;
            const timeoutMs = vergeMulti ? 45000 : 20000;
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

            let main;
            if (this.feedProxyPath) {
                main = await this.fetchFeedWithOptionalProxy(this.feedProxyPath, controller.signal);
            } else {
                main = await this.fetchAtomText(this.feedUrl, controller.signal);
            }

            let articles =
                this.feedType === 'rss' ? this.parseRss2Feed(main) : this.parseAtomFeed(main);

            if (vergeMulti && this.feedProxyPath) {
                for (const sectionUrl of this.vergeSectionFeeds) {
                    try {
                        const xml = await this.fetchVergeFeedViaProxy(
                            this.feedProxyPath,
                            sectionUrl,
                            controller.signal
                        );
                        articles.push(...this.parseAtomFeed(xml));
                    } catch (e) {
                        console.warn('Verge section feed skipped:', sectionUrl, e);
                    }
                }
            }

            clearTimeout(timeoutId);

            if (articles.length === 0 && this.source === 'heise') {
                articles = await this.fetchRubricFeedsFallback();
            }

            if (this.source === 'heise') {
                const mag = await this.fetchHeiseMagazineFeedArticles(controller.signal);
                articles = articles.concat(mag);
            }

            if (articles.length === 0) {
                throw new Error('Feed lieferte keine Einträge');
            }

            try {
                const c = await caches.open(this.cacheName);
                await c.put(
                    this.feedUrl,
                    new Response(main, {
                        headers: { 'Content-Type': 'application/xml; charset=utf-8' }
                    })
                );
            } catch (e) {
                console.warn('Cache API (optional):', e);
            }

            return this.dedupeAndSort(articles);
        } catch (error) {
            console.error('Error fetching news:', error);
            return this.getFallbackNews();
        }
    }

    /**
     * Fetch a Verge Atom feed via dev_server proxy. Optional `?url=` for section feeds (main feed uses no query).
     * @param {string} proxyPath e.g. /api/verge-feed
     * @param {string} feedUrl full Verge rss URL
     * @param {AbortSignal} [signal]
     */
    async fetchVergeFeedViaProxy(proxyPath, feedUrl, signal) {
        const canUseOrigin =
            typeof window !== 'undefined' &&
            (window.location.protocol === 'http:' || window.location.protocol === 'https:');
        if (!canUseOrigin || !proxyPath) {
            return this.fetchAtomText(feedUrl, signal);
        }
        const qs = feedUrl === this.feedUrl ? '' : `?url=${encodeURIComponent(feedUrl)}`;
        const proxied = `${window.location.origin}${proxyPath}${qs}`;
        const response = await fetch(proxied, {
            signal,
            cache: 'no-store',
            headers: {
                Accept: 'application/atom+xml, application/rss+xml, application/xml, text/xml, */*'
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} für ${feedUrl}`);
        }
        return response.text();
    }

    async fetchAtomText(url, signal) {
        const response = await fetch(url, {
            signal,
            headers: { Accept: 'application/atom+xml, application/rss+xml, application/xml, text/xml, */*' }
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} für ${url}`);
        }
        return response.text();
    }

    /**
     * Heise Atom/RSS URLs: try same-origin dev_server proxy first (avoids browser CORS), then direct fetch.
     * @param {string} feedUrl full https://www.heise.de/… URL
     * @param {AbortSignal} [signal]
     */
    async fetchHeiseAtomTextViaProxy(feedUrl, signal) {
        const canUseOrigin =
            typeof window !== 'undefined' &&
            (window.location.protocol === 'http:' || window.location.protocol === 'https:');
        const proxyPath = '/api/heise-feed';
        if (canUseOrigin && feedUrl && feedUrl.startsWith('https://www.heise.de/')) {
            const proxied = `${window.location.origin}${proxyPath}?url=${encodeURIComponent(feedUrl)}`;
            try {
                const response = await fetch(proxied, {
                    signal,
                    cache: 'no-store',
                    headers: {
                        Accept: 'application/atom+xml, application/rss+xml, application/xml, text/xml, */*'
                    }
                });
                if (response.ok) {
                    return response.text();
                }
                console.warn(`Heise feed proxy HTTP ${response.status} (${feedUrl}), trying direct.`);
            } catch (e) {
                console.warn(`Heise feed proxy failed (${feedUrl}), trying direct:`, e);
            }
        }
        return this.fetchAtomText(feedUrl, signal);
    }

    /**
     * RSS feeds without CORS: try dev_server proxy first, then direct URL.
     * @param {string} proxyPath e.g. /api/golem-feed
     * @param {AbortSignal} [signal]
     */
    async fetchFeedWithOptionalProxy(proxyPath, signal) {
        const direct = this.feedUrl;
        const canUseOrigin =
            typeof window !== 'undefined' &&
            (window.location.protocol === 'http:' || window.location.protocol === 'https:');
        if (canUseOrigin && proxyPath) {
            const proxied = `${window.location.origin}${proxyPath}`;
            try {
                const response = await fetch(proxied, {
                    signal,
                    cache: 'no-store',
                    headers: {
                        Accept: 'application/rss+xml, application/xml, text/xml, */*'
                    }
                });
                if (response.ok) {
                    return response.text();
                }
                console.warn(`Feed proxy HTTP ${response.status} (${proxyPath}), trying direct URL.`);
            } catch (e) {
                console.warn(`Feed proxy failed (${proxyPath}), trying direct URL:`, e);
            }
        }
        return this.fetchAtomText(direct, signal);
    }

    /**
     * If main Heise feed parses empty, try rubric feeds (may fail CORS on some — ignore errors).
     */
    async fetchRubricFeedsFallback() {
        const merged = [];
        for (const { url, category } of this.rubricFeeds) {
            try {
                const xml = await this.fetchAtomText(url, undefined);
                const items = this.parseAtomFeed(xml, category);
                merged.push(...items);
            } catch {
                /* rubric feed may block CORS or 404 — skip */
            }
        }
        return this.dedupeAndSort(merged);
    }

    /**
     * Extra Atom feeds for heise.de magazines/sections (dashboard toggles).
     * @param {AbortSignal} [signal]
     * @returns {Promise<Array<Record<string, unknown>>>}
     */
    async fetchHeiseMagazineFeedArticles(signal) {
        const enabled = new Set(NewsScraper.getEnabledHeiseMagazineFeedIds());
        const merged = [];
        for (const def of NewsScraper.heiseMagazineFeedDefs()) {
            // iX feed always merged: entries link to /news/… so main-feed inferCategory is `it` — dedupe keeps `heise_ix`.
            if (def.id !== 'ix' && !enabled.has(def.id)) {
                continue;
            }
            try {
                const xml = await this.fetchHeiseAtomTextViaProxy(def.url, signal);
                merged.push(...this.parseAtomFeed(xml, def.category));
            } catch (e) {
                console.warn('Heise magazine feed skipped:', def.url, e);
            }
        }
        return merged;
    }

    /**
     * Sponsored / advertorial items (e.g. "Anzeige: …" in the title) — exclude from UI and downstream processing.
     * Handles Unicode (NFKC), fullwidth colon, invisible chars, and titles that start with "Anzeige" without colon.
     * @param {string} title
     * @returns {boolean}
     */
    static isAdvertorialTitle(title) {
        if (!title || typeof title !== 'string') {
            return false;
        }
        let t = title.normalize('NFKC');
        t = t.replace(/[\u200B-\u200D\uFEFF]/g, '');
        t = t.trim();
        if (!t) {
            return false;
        }
        // "Anzeige:" with ASCII / fullwidth colon (do not use a character class that eats ':' before the colon match)
        if (/\banzeige\b\s*[:：\uFF1A]/i.test(t)) {
            return true;
        }
        // Title begins with the advert marker (feeds sometimes omit the colon)
        if (/^anzeige\b/i.test(t)) {
            return true;
        }
        if (/\badvertiser content\b/i.test(t)) {
            return true;
        }
        return false;
    }

    /**
     * @param {Array<{ title?: string }>} items
     * @returns {Array<{ title?: string }>}
     */
    /**
     * Golem sponsored posts use slugs like …/news/anzeige-cloud-… (see RSS & public URLs).
     * BILD advertorials use paths like …/service/brandstory/anzeige-…
     * Use substring checks (more robust than a single regex across encodings / protocol-relative URLs).
     * @param {string} url
     * @returns {boolean}
     */
    static isAdvertorialUrl(url) {
        if (!url || typeof url !== 'string') {
            return false;
        }
        let u = url.normalize('NFKC').trim();
        if (u.startsWith('//')) {
            u = `https:${u}`;
        }
        const low = u.toLowerCase();
        if (low.includes('/news/anzeige-')) {
            return true;
        }
        if (low.includes('/specials/anzeige')) {
            return true;
        }
        if (low.includes('/brandstory/anzeige-')) {
            return true;
        }
        return false;
    }

    /**
     * @param {{ title?: string, link?: string, url?: string }} item
     * @returns {boolean}
     */
    static isAdvertorialItem(item) {
        if (!item) {
            return true;
        }
        if (NewsScraper.isAdvertorialTitle(item.title)) {
            return true;
        }
        const href = String(item.link || item.url || '');
        return NewsScraper.isAdvertorialUrl(href);
    }

    /**
     * Source-specific title filters (exclude from UI and downstream processing).
     * - heise: "heise-Angebot" (sponsored)
     * - golem: "(g+)" (subscriber-only marker)
     * @param {string} title
     * @param {NewsSourceId|string} source
     * @returns {boolean}
     */
    static isSourceFilteredTitle(title, source) {
        if (!title || typeof title !== 'string') {
            return false;
        }
        const src = String(source || '').toLowerCase();
        let t = title.normalize('NFKC');
        t = t.replace(/[\u200B-\u200D\uFEFF]/g, '');
        t = t.trim();
        if (!t) {
            return false;
        }
        if (src === 'heise' || src === 'telepolis') {
            // robust against hyphen/space variants and case
            return /\bheise[-\s]*angebot\b/i.test(t);
        }
        if (src === 'golem') {
            // "(g+)" marker in headlines
            return /\(\s*g\s*\+\s*\)/i.test(t);
        }
        return false;
    }

    /**
     * @param {{ title?: string, link?: string, url?: string, newsSource?: string }} item
     * @returns {boolean}
     */
    static isSourceFilteredItem(item) {
        if (!item) {
            return true;
        }
        const src = item.newsSource || '';
        return NewsScraper.isSourceFilteredTitle(item.title || '', src);
    }

    static filterOutAdvertorialItems(items) {
        if (!Array.isArray(items)) {
            return [];
        }
        return items.filter((item) => item && !NewsScraper.isAdvertorialItem(item));
    }

    /**
     * When the same article URL appears in the main Heise feed (category `it`) and in a section
     * feed like iX (`heise_ix`), keep the section categorization — iX Atom uses `/news/…` URLs.
     * @param {string} [cat]
     * @returns {number}
     */
    static heiseSectionCategoryPriority(cat) {
        const c = String(cat || '');
        if (c.startsWith('heise_')) {
            return 2;
        }
        return 1;
    }

    /**
     * @param {Record<string, unknown>} a
     * @param {Record<string, unknown>} b
     * @returns {Record<string, unknown>}
     */
    static pickBetterDuplicateHeiseArticle(a, b) {
        const pa = NewsScraper.heiseSectionCategoryPriority(/** @type {string} */ (a.category));
        const pb = NewsScraper.heiseSectionCategoryPriority(/** @type {string} */ (b.category));
        if (pb > pa) {
            return b;
        }
        if (pa > pb) {
            return a;
        }
        const ta = Number(a.publishedMs) || 0;
        const tb = Number(b.publishedMs) || 0;
        return tb >= ta ? b : a;
    }

    dedupeAndSort(items) {
        const filtered = NewsScraper.filterOutAdvertorialItems(items).filter(
            (item) => item && !NewsScraper.isSourceFilteredItem(item)
        );
        const byId = new Map();
        for (const item of filtered) {
            const key = this.normalizeArticleUrlKey(String(item.link || ''));
            if (!key) {
                continue;
            }
            const prev = byId.get(key);
            if (!prev) {
                byId.set(key, item);
            } else if (this.source === 'heise') {
                byId.set(key, NewsScraper.pickBetterDuplicateHeiseArticle(prev, item));
            }
            /* non-heise: first wins (unchanged) */
        }
        return Array.from(byId.values()).sort((a, b) => {
            const ta = a.publishedMs || 0;
            const tb = b.publishedMs || 0;
            return tb - ta;
        });
    }

    /**
     * @param {string} rawUrl
     * @param {string} [baseUrl]
     * @returns {string}
     */
    normalizeThumbnailUrl(rawUrl, baseUrl) {
        const raw = String(rawUrl || '').trim();
        if (!raw) {
            return '';
        }
        const withProtocol = raw.startsWith('//') ? `https:${raw}` : raw;
        try {
            const resolved = baseUrl ? new URL(withProtocol, baseUrl) : new URL(withProtocol);
            if (resolved.protocol !== 'https:' && resolved.protocol !== 'http:') {
                return '';
            }
            resolved.hash = '';
            return resolved.toString();
        } catch (_) {
            return '';
        }
    }

    /**
     * @param {Element} entry
     * @param {string} articleUrl
     * @param {string[]} markupCandidates
     * @returns {string}
     */
    extractThumbnailUrl(entry, articleUrl, markupCandidates) {
        const attrUrl = this.extractThumbnailUrlFromFeedEntry(entry, articleUrl);
        if (attrUrl) {
            return attrUrl;
        }
        if (!Array.isArray(markupCandidates)) {
            return '';
        }
        for (const markup of markupCandidates) {
            const htmlUrl = this.extractThumbnailUrlFromMarkup(markup, articleUrl);
            if (htmlUrl) {
                return htmlUrl;
            }
        }
        return '';
    }

    /**
     * @param {Element} entry
     * @param {string} articleUrl
     * @returns {string}
     */
    extractThumbnailUrlFromFeedEntry(entry, articleUrl) {
        if (!entry) {
            return '';
        }
        const nodes = entry.getElementsByTagName('*');
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const localName = String(node.localName || node.tagName || '')
                .trim()
                .toLowerCase();
            if (!localName) {
                continue;
            }

            const rel = String(node.getAttribute('rel') || '')
                .trim()
                .toLowerCase();
            const medium = String(node.getAttribute('medium') || '')
                .trim()
                .toLowerCase();
            const type = String(node.getAttribute('type') || '')
                .trim()
                .toLowerCase();

            if (localName === 'thumbnail' || localName.endsWith(':thumbnail')) {
                const thumbnailUrl =
                    this.normalizeThumbnailUrl(
                        node.getAttribute('url') || node.getAttribute('href') || node.getAttribute('src') || '',
                        articleUrl
                    );
                if (thumbnailUrl) {
                    return thumbnailUrl;
                }
                continue;
            }

            const isImageCarrier =
                localName === 'enclosure' ||
                localName === 'content' ||
                localName.endsWith(':content') ||
                (localName === 'link' && rel === 'enclosure');
            const isImageType = medium === 'image' || type.startsWith('image/');
            if (!isImageCarrier || !isImageType) {
                continue;
            }
            const imageUrl =
                this.normalizeThumbnailUrl(
                    node.getAttribute('url') || node.getAttribute('href') || node.getAttribute('src') || '',
                    articleUrl
                );
            if (imageUrl) {
                return imageUrl;
            }
        }
        return '';
    }

    /**
     * @param {string} markup
     * @param {string} articleUrl
     * @returns {string}
     */
    extractThumbnailUrlFromMarkup(markup, articleUrl) {
        const rawMarkup = String(markup || '').trim();
        if (!rawMarkup || typeof DOMParser === 'undefined') {
            return '';
        }
        try {
            const doc = new DOMParser().parseFromString(rawMarkup, 'text/html');
            const directImg = doc.querySelector('img[src]');
            if (directImg) {
                const directImgUrl = this.normalizeThumbnailUrl(directImg.getAttribute('src') || '', articleUrl);
                if (directImgUrl) {
                    return directImgUrl;
                }
            }

            const srcSetNode = doc.querySelector('img[srcset], source[srcset]');
            if (srcSetNode) {
                const srcSet = String(srcSetNode.getAttribute('srcset') || '').trim();
                if (srcSet) {
                    const firstCandidate = srcSet.split(',')[0].trim().split(/\s+/)[0];
                    const srcSetUrl = this.normalizeThumbnailUrl(firstCandidate, articleUrl);
                    if (srcSetUrl) {
                        return srcSetUrl;
                    }
                }
            }
        } catch (_) {
            return '';
        }
        return '';
    }

    /**
     * Parse RSS 2.0 (BILD, Golem, t3n, IT-Administrator).
     * @param {string} xml
     */
    parseRss2Feed(xml) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'text/xml');
        const err = doc.querySelector('parsererror');
        if (err) {
            console.error('RSS Parserfehler:', err.textContent);
            return [];
        }

        const host = this.rssItemHost || 'golem.de';
        const items = doc.getElementsByTagName('item');
        const articles = [];

        for (let i = 0; i < items.length; i++) {
            const entry = items[i];
            const titleEl = entry.getElementsByTagName('title')[0];
            const titleRaw = titleEl ? titleEl.textContent.trim() : '';
            const title = this.stripHtml(titleRaw);

            if (NewsScraper.isSourceFilteredTitle(title, this.source)) {
                continue;
            }

            let href = '';
            const linkEl = entry.getElementsByTagName('link')[0];
            if (linkEl) {
                href = (linkEl.textContent || linkEl.getAttribute('href') || '').trim();
            }

            if (!title || !href || !href.includes(host)) {
                continue;
            }

            if (NewsScraper.isAdvertorialTitle(title) || NewsScraper.isAdvertorialUrl(href)) {
                continue;
            }

            const cleanUrl = this.normalizeArticleUrlKey(href);
            const summaryEl = entry.getElementsByTagName('description')[0];
            let description = '';
            const markupCandidates = [];
            if (summaryEl) {
                description = this.stripHtml(summaryEl.textContent || '');
                markupCandidates.push(summaryEl.textContent || '');
            }
            const rssChildNodes = entry.getElementsByTagName('*');
            for (let j = 0; j < rssChildNodes.length; j++) {
                const node = rssChildNodes[j];
                const localName = String(node.localName || node.tagName || '')
                    .trim()
                    .toLowerCase();
                if (localName === 'encoded' || localName.endsWith(':encoded')) {
                    const markup = node.textContent || '';
                    if (markup) {
                        markupCandidates.push(markup);
                    }
                }
            }
            const thumbnailUrl = this.extractThumbnailUrl(entry, href, markupCandidates);

            const pubDateEl = entry.getElementsByTagName('pubDate')[0];
            const pubRaw = pubDateEl ? pubDateEl.textContent.trim() : '';
            const publishedMs = pubRaw ? Date.parse(pubRaw) : Date.now();

            const category =
                this.source === 'bild'
                    ? this.inferCategoryBild(entry, title, href)
                    : this.source === 't3n'
                    ? this.inferCategoryT3n(title, href)
                    : this.source === 'it_administrator'
                      ? this.inferCategoryItAdministrator(entry, title, href)
                      : this.inferCategoryGolem(title, href);
            const categoryName = this.categoryMap[category] || category;

            articles.push({
                id: this.generateId(cleanUrl),
                title,
                link: href,
                category,
                categoryName,
                timestamp: this.formatGermanTime(pubRaw, publishedMs),
                description,
                url: cleanUrl,
                publishedMs,
                fetchedAt: new Date().toISOString(),
                newsSource: this.source
            });
            if (thumbnailUrl) {
                articles[articles.length - 1].thumbnailUrl = thumbnailUrl;
            }
        }

        return articles;
    }

    /**
     * Parse Atom XML (Heise, ComputerBase).
     * @param {string} xml
     * @param {string} [forcedCategory] — from rubric feed URL
     */
    parseAtomFeed(xml, forcedCategory) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'text/xml');
        const err = doc.querySelector('parsererror');
        if (err) {
            console.error('XML Parserfehler:', err.textContent);
            return [];
        }

        const host = this.atomLinkHost || 'heise.de';
        const entries = doc.getElementsByTagName('entry');
        const articles = [];

        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            const titleEl = entry.getElementsByTagName('title')[0];
            const titleRaw = titleEl ? titleEl.textContent.trim() : '';
            const title = this.stripHtml(titleRaw);

            if (NewsScraper.isSourceFilteredTitle(title, this.source)) {
                continue;
            }

            let href = '';
            const links = entry.getElementsByTagName('link');
            for (let j = 0; j < links.length; j++) {
                const L = links[j];
                const h = L.getAttribute('href');
                if (!h || !h.includes(host)) {
                    continue;
                }
                const rel = (L.getAttribute('rel') || '').toLowerCase();
                if (rel === '' || rel === 'alternate') {
                    href = h;
                    break;
                }
            }
            if (!href) {
                for (let j = 0; j < links.length; j++) {
                    const h = links[j].getAttribute('href');
                    if (h && h.includes(host)) {
                        href = h;
                        break;
                    }
                }
            }

            if (!title || !href) {
                continue;
            }

            if (NewsScraper.isAdvertorialTitle(title) || NewsScraper.isAdvertorialUrl(href)) {
                continue;
            }

            const cleanUrl = this.normalizeArticleUrlKey(href);
            const summaryEl = entry.getElementsByTagName('summary')[0];
            const contentEl = entry.getElementsByTagName('content')[0];
            let description = '';
            let summaryMarkup = '';
            let contentMarkup = '';
            if (summaryEl) {
                description = this.stripHtml(summaryEl.textContent || '');
                summaryMarkup = summaryEl.textContent || '';
            }
            if (contentEl) {
                contentMarkup = contentEl.textContent || '';
            }
            const thumbnailUrl = this.extractThumbnailUrl(entry, href, [summaryMarkup, contentMarkup]);

            const publishedEl =
                entry.getElementsByTagName('published')[0] ||
                entry.getElementsByTagName('updated')[0];
            const iso = publishedEl ? publishedEl.textContent.trim() : '';
            const publishedMs = iso ? Date.parse(iso) : Date.now();

            let category;
            if (forcedCategory) {
                category = forcedCategory;
            } else if (this.source === 'computerbase') {
                category = this.inferCategoryComputerbase(title, href);
            } else if (this.source === 'verge') {
                category = this.inferCategoryVerge(entry, title, href);
            } else if (this.source === 'telepolis') {
                category = this.inferCategoryTelepolis(title, href);
            } else {
                category = this.inferCategory(title, href);
            }
            const categoryName = this.categoryMap[category] || category;

            articles.push({
                id: this.generateId(cleanUrl),
                title,
                link: href,
                category,
                categoryName,
                timestamp: this.formatGermanTime(iso, publishedMs),
                description,
                url: cleanUrl,
                publishedMs,
                fetchedAt: new Date().toISOString(),
                newsSource: this.source
            });
            if (thumbnailUrl) {
                articles[articles.length - 1].thumbnailUrl = thumbnailUrl;
            }
        }

        return articles;
    }

    stripHtml(s) {
        if (!s) {
            return '';
        }
        const d = document.createElement('div');
        d.innerHTML = s;
        return d.textContent.replace(/\s+/g, ' ').trim();
    }

    formatGermanTime(iso, publishedMs) {
        if (!publishedMs || Number.isNaN(publishedMs)) {
            return '';
        }
        try {
            const d = new Date(publishedMs);
            return d.toLocaleString('de-DE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return String(iso || '').slice(0, 16);
        }
    }

    /**
     * Map The Verge Atom categories + URL path to existing dashboard category keys.
     * @param {Element} entry
     * @param {string} title
     * @param {string} link
     * @returns {string}
     */
    inferCategoryVerge(entry, title, link) {
        const terms = [];
        const cats = entry.getElementsByTagName('category');
        for (let j = 0; j < cats.length; j++) {
            const term = (cats[j].getAttribute('term') || '').trim().toLowerCase();
            if (term) {
                terms.push(term);
            }
        }
        const has = (s) => terms.some((t) => t === s || t.includes(s));
        if (has('ai') || has('artificial intelligence')) {
            return 'ki';
        }
        if (has('science')) {
            return 'wissenschaft';
        }
        if (has('entertainment') || has('gaming') || has('tv shows') || has('movies')) {
            return 'entertainment';
        }
        if (has('policy') || has('security') || has('antitrust')) {
            return 'netzpolitik';
        }
        if (has('reviews') || has('gadgets') || has('phones') || has('laptops')) {
            return 'mobiles';
        }
        if (has('verge shopping') || has('deals') || has('business')) {
            return 'wirtschaft';
        }
        const p = (link || '').toLowerCase();
        if (p.includes('/science/')) {
            return 'wissenschaft';
        }
        if (p.includes('/entertainment/') || p.includes('/gaming/') || p.includes('/movies/')) {
            return 'entertainment';
        }
        if (p.includes('/policy/')) {
            return 'netzpolitik';
        }
        if (p.includes('/security/')) {
            return 'security';
        }
        if (p.includes('/reviews/')) {
            return 'mobiles';
        }
        if (p.includes('/ai-artificial-intelligence/') || p.includes('/ai/')) {
            return 'ki';
        }
        return 'it';
    }

    /**
     * @param {string} title
     * @param {string} link
     * @returns {string}
     */
    inferCategoryTelepolis(title, link) {
        const p = (link || '').toLowerCase();
        const t = (title || '').toLowerCase();
        if (
            t.includes('künstliche intelligenz') ||
            t.includes(' chatgpt') ||
            t.includes(' llm') ||
            p.includes('/informatik-und-technik/')
        ) {
            return 'ki';
        }
        if (p.includes('/netzpolitik/') || p.includes('/medien/') || p.includes('/kultur-medien/')) {
            return 'netzpolitik';
        }
        if (p.includes('/wirtschaft/') || p.includes('/finanzen/')) {
            return 'wirtschaft';
        }
        if (p.includes('/wissen/') || p.includes('/energie-klima/') || p.includes('/natur-und-wissenschaft/')) {
            return 'wissenschaft';
        }
        if (p.includes('/politik/')) {
            return 'netzpolitik';
        }
        if (p.includes('/feuilleton/') || p.includes('/kultur/')) {
            return 'entertainment';
        }
        return 'telepolis';
    }

    /**
     * BILD is integrated as a single source category rather than mapped onto the tech-specific rubric set.
     * @returns {string}
     */
    inferCategoryBild() {
        return 'bild';
    }

    inferCategoryComputerbase(title, link) {
        const p = (link || '').toLowerCase();
        const t = (title || '').toLowerCase();
        if (t.includes('künstliche intelligenz') || t.includes(' chatgpt') || p.includes('/ki/')) {
            return 'ki';
        }
        if (p.includes('/security/') || p.includes('cybercrime') || t.includes('malware')) {
            return 'security';
        }
        if (p.includes('/news/gaming/') || p.includes('/gaming/')) {
            return 'entertainment';
        }
        if (p.includes('/news/smartphones/') || p.includes('/news/tablets/') || p.includes('/mobil')) {
            return 'mobiles';
        }
        if (p.includes('/news/netzpolitik/') || p.includes('/recht/')) {
            return 'netzpolitik';
        }
        if (p.includes('/news/wirtschaft/') || p.includes('börse')) {
            return 'wirtschaft';
        }
        if (p.includes('/news/audio-video-foto/') || p.includes('forschung')) {
            return 'wissenschaft';
        }
        return 'it';
    }

    /**
     * Drupal RSS: optional `<category>` per item (e.g. News, Fachartikel, Recht).
     * @param {Element} item
     * @param {string} title
     * @param {string} link
     * @returns {string}
     */
    inferCategoryItAdministrator(item, title, link) {
        const cats = item.getElementsByTagName('category');
        for (let j = 0; j < cats.length; j++) {
            const c = (cats[j].textContent || '').trim().toLowerCase();
            if (!c) {
                continue;
            }
            if (c.includes('recht') || c.includes('compliance')) {
                return 'netzpolitik';
            }
            if (c.includes('buch')) {
                return 'journal';
            }
            if (c.includes('management')) {
                return 'wirtschaft';
            }
            if (c.includes('grundlagen')) {
                return 'wissenschaft';
            }
        }
        return this.inferCategoryItAdministratorHeuristic(title, link);
    }

    inferCategoryItAdministratorHeuristic(title, link) {
        const p = (link || '').toLowerCase();
        const t = (title || '').toLowerCase();
        if (
            t.includes('künstliche intelligenz') ||
            t.includes(' chatgpt') ||
            t.includes(' ki ') ||
            t.includes('llm') ||
            t.includes('agenten')
        ) {
            return 'ki';
        }
        if (
            t.includes('sicherheit') ||
            t.includes('malware') ||
            t.includes('firewall') ||
            t.includes('ransomware') ||
            t.includes('trojaner') ||
            p.includes('secure-boot') ||
            p.includes('tls')
        ) {
            return 'security';
        }
        if (t.includes('netzwerk') || t.includes('vpn') || t.includes('dns') || t.includes('bgp')) {
            return 'netzpolitik';
        }
        if (t.includes('recht') || t.includes('dsgvo') || t.includes('vertrag') || t.includes('lizenz')) {
            return 'netzpolitik';
        }
        if (t.includes('cloud') || t.includes('exchange') || t.includes('azure') || t.includes('wordpress')) {
            return 'it';
        }
        if (
            t.includes('speicher') ||
            t.includes('hardware') ||
            t.includes(' ram ') ||
            t.includes('hdd') ||
            t.includes('chip')
        ) {
            return 'mobiles';
        }
        if (t.includes('linux') || t.includes('windows') || t.includes('powershell') || t.includes('server')) {
            return 'it';
        }
        return 'it';
    }

    inferCategoryT3n(title, link) {
        const p = (link || '').toLowerCase();
        const t = (title || '').toLowerCase();
        if (t.includes('künstliche intelligenz') || t.includes(' chatgpt') || p.includes('ki-')) {
            return 'ki';
        }
        if (p.includes('security') || p.includes('cyber') || t.includes('malware')) {
            return 'security';
        }
        if (p.includes('/gaming/') || t.includes('gaming')) {
            return 'entertainment';
        }
        if (p.includes('smartphone') || p.includes('hardware') || p.includes('gadget')) {
            return 'mobiles';
        }
        if (p.includes('netzpolitik') || p.includes('datenschutz')) {
            return 'netzpolitik';
        }
        if (p.includes('finance') || p.includes('bitcoin') || p.includes('wirtschaft')) {
            return 'wirtschaft';
        }
        if (p.includes('forschung') || p.includes('science')) {
            return 'wissenschaft';
        }
        return 'it';
    }

    inferCategoryGolem(title, link) {
        const p = (link || '').toLowerCase();
        const t = (title || '').toLowerCase();

        if (
            p.includes('/specials/ki/') ||
            p.includes('/specials/k%C3%BCnstliche') ||
            t.includes('künstliche intelligenz') ||
            t.includes(' chatgpt') ||
            t.includes(' llm')
        ) {
            return 'ki';
        }
        if (
            p.includes('security') ||
            p.includes('cybercrime') ||
            p.includes('malware') ||
            p.includes('ransomware') ||
            t.includes('sicherheit')
        ) {
            return 'security';
        }
        if (p.includes('/specials/wissenschaft') || p.includes('quanten') || p.includes('forschung')) {
            return 'wissenschaft';
        }
        if (p.includes('mobile') || p.includes('iphone') || p.includes('android') || p.includes('smartphone')) {
            return 'mobiles';
        }
        if (p.includes('spiele') || p.includes('gaming') || p.includes('entertainment')) {
            return 'entertainment';
        }
        if (p.includes('netzpolitik') || p.includes('politik-recht') || p.includes('eu ')) {
            return 'netzpolitik';
        }
        if (p.includes('wirtschaft') || p.includes('börse') || p.includes('aktie')) {
            return 'wirtschaft';
        }
        if (p.includes('journal') || p.includes('meinung')) {
            return 'journal';
        }
        return 'it';
    }

    inferCategory(title, link) {
        const path = (link || '').toLowerCase();
        const t = (title || '').toLowerCase();

        if (path.includes('/security/') || path.includes('heise-security')) {
            return 'security';
        }
        if (
            path.includes('/thema/k') ||
            path.includes('kuenstliche-intelligenz') ||
            path.includes('/ki/') ||
            t.includes('künstliche intelligenz') ||
            t.includes(' chatgpt') ||
            t.includes(' llm')
        ) {
            return 'ki';
        }
        if (path.includes('/wissen/') || path.includes('rubrik-wissen')) {
            return 'wissenschaft';
        }
        if (path.includes('/mobiles/') || path.includes('rubrik-mobiles')) {
            return 'mobiles';
        }
        if (path.includes('/entertainment/') || path.includes('rubrik-entertainment')) {
            return 'entertainment';
        }
        if (path.includes('/netzpolitik/') || path.includes('rubrik-netzpolitik')) {
            return 'netzpolitik';
        }
        if (path.includes('/journal/') || path.includes('rubrik-journal')) {
            return 'journal';
        }
        if (path.includes('/wirtschaft/') || path.includes('rubrik-wirtschaft')) {
            return 'wirtschaft';
        }
        // Heise magazine / section paths → same keys as category filters + magazine feeds
        if (path.includes('/mac-and-i/')) {
            return 'heise_mac';
        }
        if (path.includes('/ix/')) {
            return 'heise_ix';
        }
        if (path.includes('/ct/')) {
            return 'heise_ct';
        }
        if (path.includes('/foto/')) {
            return 'heise_foto';
        }
        if (path.includes('/make/')) {
            return 'heise_make';
        }
        if (path.includes('/autos/')) {
            return 'heise_autos';
        }
        if (path.includes('/news/') || path.includes('/developer/')) {
            return 'it';
        }

        return 'it';
    }

    /**
     * Canonical URL for ids and summary cache keys (aligned with AISummarizer.normalizeArticleUrlKey).
     * @param {string} url
     * @returns {string}
     */
    normalizeArticleUrlKey(url) {
        if (!url || typeof url !== 'string') {
            return '';
        }
        const s = url.trim();
        const q = s.indexOf('?');
        const h = s.indexOf('#');
        let cut = s.length;
        if (q >= 0) {
            cut = Math.min(cut, q);
        }
        if (h >= 0) {
            cut = Math.min(cut, h);
        }
        let out = s.slice(0, cut);
        if (out.length > 1 && out.endsWith('/')) {
            out = out.slice(0, -1);
        }
        return out;
    }

    /**
     * Stable unique id per article URL for DOM + IndexedDB `news` store.
     * Old implementation used base64 alphanumeric slice(0,64) after stripping +/= — that collided for
     * long ComputerBase URLs that only differ near the end of the path (same first 64 alnum of base64).
     * @param {string} url
     * @returns {string}
     */
    generateId(url) {
        const s = this.normalizeArticleUrlKey(String(url || ''));
        let h1 = 5381 >>> 0;
        let h2 = 52711 >>> 0;
        for (let i = 0; i < s.length; i++) {
            const c = s.charCodeAt(i);
            h1 = (Math.imul(h1, 33) ^ c) >>> 0;
            h2 = (Math.imul(h2, 33) ^ c) >>> 0;
        }
        return `n${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}${s.length.toString(16)}`;
    }

    getFallbackNews() {
        console.warn('Nutze lokale Fallback-Artikel (Feed nicht erreichbar oder leer).');
        const today = new Date();
        const formatTime = (hoursAgo) => `vor ${hoursAgo} Stunden`;

        const demos = {
            golem: {
                id: 'golem-fallback-1',
                title: 'Beispiel: Golem-News (Offline-Demo)',
                link: 'https://www.golem.de/',
                url: 'https://www.golem.de/',
                newsSource: 'golem'
            },
            computerbase: {
                id: 'cb-fallback-1',
                title: 'Beispiel: ComputerBase (Offline-Demo)',
                link: 'https://www.computerbase.de/',
                url: 'https://www.computerbase.de/',
                newsSource: 'computerbase'
            },
            t3n: {
                id: 't3n-fallback-1',
                title: 'Beispiel: t3n (Offline-Demo)',
                link: 'https://t3n.de/',
                url: 'https://t3n.de/',
                newsSource: 't3n'
            },
            verge: {
                id: 'verge-fallback-1',
                title: 'Example: The Verge (offline demo)',
                link: 'https://www.theverge.com/',
                url: 'https://www.theverge.com',
                newsSource: 'verge'
            },
            telepolis: {
                id: 'telepolis-fallback-1',
                title: 'Beispiel: Telepolis (Offline-Demo)',
                link: 'https://www.telepolis.de/',
                url: 'https://www.telepolis.de/',
                newsSource: 'telepolis'
            },
            bild: {
                id: 'bild-fallback-1',
                title: 'Beispiel: BILD (Offline-Demo)',
                link: 'https://www.bild.de/',
                url: 'https://www.bild.de/',
                newsSource: 'bild'
            },
            it_administrator: {
                id: 'it-admin-fallback-1',
                title: 'Beispiel: IT-Administrator (Offline-Demo)',
                link: 'https://www.it-administrator.de/',
                url: 'https://www.it-administrator.de/',
                newsSource: 'it_administrator'
            }
        };

        if (demos[this.source]) {
            const d = demos[this.source];
            const cat =
                this.source === 'telepolis'
                    ? 'telepolis'
                    : this.source === 'bild'
                      ? 'bild'
                      : 'it';
            const categoryName = this.categoryMap[cat] || 'IT & Tech';
            return [
                {
                    ...d,
                    category: cat,
                    categoryName,
                    timestamp: formatTime(1),
                    description: 'Nur sichtbar, wenn der Feed nicht geladen werden kann.',
                    publishedMs: today.getTime(),
                    fetchedAt: new Date().toISOString()
                }
            ];
        }

        return [
            {
                id: 'fallback-1',
                title: 'Beispiel: Neue KI-Entwicklung (Offline-Demo)',
                link: 'https://www.heise.de/',
                category: 'ki',
                categoryName: 'KI',
                timestamp: formatTime(2),
                description: 'Nur sichtbar, wenn der Heise-Feed nicht geladen werden kann.',
                url: 'https://www.heise.de/',
                publishedMs: today.getTime(),
                fetchedAt: new Date().toISOString(),
                newsSource: 'heise'
            },
            {
                id: 'fallback-2',
                title: 'Beispiel: iOS-Update (Offline-Demo)',
                link: 'https://www.heise.de/',
                category: 'mobiles',
                categoryName: 'Mobiles',
                timestamp: formatTime(3),
                description: 'Prüfen Sie die Browser-Konsole bei Problemen.',
                url: 'https://www.heise.de/',
                publishedMs: today.getTime(),
                fetchedAt: new Date().toISOString(),
                newsSource: 'heise'
            }
        ];
    }

    async clearCache() {
        try {
            await caches.delete(this.cacheName);
        } catch (e) {
            console.warn(e);
        }
    }

    /** Clear all source caches (e.g. when switching source). */
    async clearAllFeedCaches() {
        try {
            await caches.delete('heise-news-cache');
            await caches.delete('golem-news-cache');
            await caches.delete('computerbase-news-cache');
            await caches.delete('t3n-news-cache');
            await caches.delete('verge-news-cache');
            await caches.delete('telepolis-news-cache');
            await caches.delete('bild-news-cache');
            await caches.delete('it-administrator-news-cache');
        } catch (e) {
            console.warn(e);
        }
    }
}

window.NewsScraper = NewsScraper;
