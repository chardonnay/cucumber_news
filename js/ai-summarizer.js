/**
 * Cucumber NewsScraper — AI summarizer (LM Studio REST `/api/v1/chat`,
 * OpenAI-compatible `/v1/chat/completions`, or Anthropic Messages `/v1/messages`).
 *
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Daniel Mengel
 */

/** Max tokens for model output (REST: max_output_tokens; OpenAI: max_tokens). */
const MAX_SUMMARY_OUTPUT_TOKENS = 10000;
const DEFAULT_OPENAI_API_BASE = 'http://127.0.0.1:1234/v1';
const DEFAULT_LM_REST_ROOT = 'http://127.0.0.1:1234';
const DEFAULT_ANTHROPIC_API_BASE = 'https://api.anthropic.com/v1';
const ANTHROPIC_API_VERSION = '2023-06-01';

class AISummarizer {
    constructor() {
        /** @type {NewsStorage} Set by App after `storage.init()` so summaries use the same IndexedDB connection. */
        this.storage = new NewsStorage();
        this.completionPromises = {};
    }

    /** Ensures IndexedDB is open (App normally assigns an already-initialized `NewsStorage`). */
    async _ensureStorageReady() {
        if (this.storage && this.storage.db) {
            return;
        }
        if (!this.storage) {
            this.storage = new NewsStorage();
        }
        await this.storage.init();
    }

    /**
     * Normalizes the OpenAI-compatible base URL (must end with `/v1`, never `/chat/completions`).
     */
    /**
     * Canonical summary cache key: https, lowercase host, path without trailing slash.
     * Single function replaces double normalization (canonical + legacy).
     * @param {string} url
     * @returns {string}
     */
    static canonicalSummaryCacheKey(url) {
        if (!url || typeof url !== 'string') {
            return '';
        }
        
        // Step 1: Strip query and hash (same as normalizeArticleUrlKey)
        let s = String(url).trim();
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
        
        // Step 2: Normalize protocol and hostname (canonicalization)
        if (out.length > 1 && out.endsWith('/')) {
            out = out.slice(0, -1);
        }
        
        if (out.startsWith('//')) {
            out = `https:${out}`;
        }
        
        try {
            const u = new URL(out);
            u.protocol = 'https:';
            u.hostname = u.hostname.toLowerCase();
            let path = u.pathname;
            if (path.length > 1 && path.endsWith('/')) {
                path = path.slice(0, -1);
            }
            return `${u.protocol}//${u.hostname}${path}`;
        } catch {
            // Fallback: lowercase only
            return out.toLowerCase();
        }
    }

    /**
     * Read summary from IndexedDB using canonical key (single lookup now).
     * Legacy fallback removed - all keys stored canonically.
     * @param {string} url
     * @returns {Promise<{ entry: { summary: string, cachedAt?: string } | null, storageKey: string }>}
     */
    async _getSummaryEntryForCacheLookup(url) {
        await this._ensureStorageReady();
        const kCanon = AISummarizer.canonicalSummaryCacheKey(url);
        
        try {
            if (kCanon) {
                const entry = await this.storage.getSummaryWithMeta(kCanon);
                if (entry && typeof entry.summary === 'string' && entry.summary.trim()) {
                    return { entry, storageKey: kCanon };
                }
            }
        } catch (e) {
            console.warn('KI: Cache lesen fehlgeschlagen:', e);
        }
        
        return { entry: null, storageKey: kCanon };
    }

    /**
     * LM Studio REST `output` may be an array, a single object, or nested under `response`.
     * @param {object} data
     * @returns {unknown[]}
     */
    static lmRestGetOutputItems(data) {
        if (!data || typeof data !== 'object') {
            return [];
        }
        let items = data.output;
        if (items == null && data.outputs != null) {
            items = data.outputs;
        }
        if (items == null && data.response && typeof data.response === 'object') {
            items = data.response.output ?? data.response.outputs;
        }
        if (items == null && data.result && typeof data.result === 'object') {
            items = data.result.output ?? data.result.outputs;
        }
        if (items != null && !Array.isArray(items) && typeof items === 'object') {
            items = [items];
        }
        return Array.isArray(items) ? items : [];
    }

    static normalizeOpenAiApiBase(raw) {
        let s = String(raw ?? '').trim();
        if (!s) {
            return DEFAULT_OPENAI_API_BASE;
        }
        s = s.replace(/\/+$/, '');
        s = s.replace(/\/v1\/chat\/completions$/i, '/v1');
        s = s.replace(/\/chat\/completions$/i, '');
        s = s.replace(/\/+$/, '');
        while (/\/v1\/v1$/i.test(s)) {
            s = s.replace(/\/v1\/v1$/i, '/v1');
        }
        if (!/\/v1$/i.test(s)) {
            s = `${s}/v1`;
        }
        return s;
    }

    /**
     * Anthropic Messages API base URL (must end with `/v1`, never `/messages`).
     */
    static normalizeAnthropicApiBase(raw) {
        let s = String(raw ?? '').trim();
        if (!s) {
            return DEFAULT_ANTHROPIC_API_BASE;
        }
        s = s.replace(/\/+$/, '');
        s = s.replace(/\/v1\/messages$/i, '/v1');
        s = s.replace(/\/messages$/i, '');
        s = s.replace(/\/+$/, '');
        while (/\/v1\/v1$/i.test(s)) {
            s = s.replace(/\/v1\/v1$/i, '/v1');
        }
        if (!/\/v1$/i.test(s)) {
            s = `${s}/v1`;
        }
        return s;
    }

    /**
     * @param {unknown} raw
     * @returns {'openai'|'lm_rest_v1'|'anthropic'}
     */
    static normalizeKiApiMode(raw) {
        const mode = String(raw ?? '').trim();
        if (mode === 'openai' || mode === 'anthropic' || mode === 'lm_rest_v1') {
            return mode;
        }
        return 'lm_rest_v1';
    }

    /**
     * LM Studio native REST v1: server root only (no /api/v1 path).
     * Requests go to `${root}/api/v1/chat`.
     */
    static normalizeLmRestServerRoot(raw) {
        let s = String(raw ?? '').trim();
        if (!s) {
            return DEFAULT_LM_REST_ROOT;
        }
        s = s.replace(/\/+$/, '');
        s = s.replace(/\/api\/v1\/chat$/i, '');
        s = s.replace(/\/api\/v1$/i, '');
        s = s.replace(/\/v1\/chat\/completions$/i, '');
        s = s.replace(/\/v1$/i, '');
        s = s.replace(/\/+$/, '');
        return s;
    }

    /** Base URL including /v1 (no trailing slash). Read fresh each call so Einstellungen apply immediately. */
    getApiBase() {
        let fromLs = '';
        try {
            fromLs = localStorage.getItem('heise_api_base') || '';
        } catch (_) {
            /* ignore */
        }
        return AISummarizer.normalizeOpenAiApiBase(fromLs);
    }

    /** Anthropic API base URL including /v1 (no trailing slash). */
    getAnthropicApiBase() {
        let fromLs = '';
        try {
            fromLs = localStorage.getItem('heise_anthropic_api_base') || '';
        } catch (_) {
            /* ignore */
        }
        return AISummarizer.normalizeAnthropicApiBase(fromLs);
    }

    getLmRestRoot() {
        let fromLs = '';
        try {
            fromLs = localStorage.getItem('heise_lm_rest_root') || '';
        } catch (_) {
            /* ignore */
        }
        return AISummarizer.normalizeLmRestServerRoot(fromLs);
    }

    /**
     * When true, REST calls go to `${origin}/api/v1/chat` (same origin as the page) — no CORS preflight to LM Studio.
     * Use with `python3 scripts/dev_server.py`.
     */
    isLmRestSameOrigin() {
        try {
            return localStorage.getItem('heise_rest_same_origin') === '1';
        } catch (_) {
            return false;
        }
    }

    /**
     * LM Studio `reasoning` query param: `off` | `low` | `medium` | `high` | `on`.
     * Legacy UI value `none` maps to `off`.
     * @param {unknown} raw
     * @returns {'off'|'low'|'medium'|'high'|'on'}
     */
    static normalizeLmReasoningParam(raw) {
        const normalized = AISummarizer.normalizeLmReasoningOption(raw);
        return /** @type {'off'|'low'|'medium'|'high'|'on'} */ (normalized || 'off');
    }

    /**
     * Normalizes a single LM Studio reasoning enum value.
     * Returns empty string for unsupported values instead of falling back.
     * @param {unknown} raw
     * @returns {''|'off'|'low'|'medium'|'high'|'on'}
     */
    static normalizeLmReasoningOption(raw) {
        const s = String(raw ?? '')
            .trim()
            .toLowerCase();
        if (s === 'none') {
            return /** @type {'off'} */ ('off');
        }
        const allowed = ['off', 'low', 'medium', 'high', 'on'];
        return /** @type {''|'off'|'low'|'medium'|'high'|'on'} */ (
            allowed.includes(s) ? s : ''
        );
    }

    /**
     * @param {unknown} raw
     * @returns {Array<'off'|'low'|'medium'|'high'|'on'>}
     */
    static normalizeLmReasoningOptions(raw) {
        if (!Array.isArray(raw)) {
            return [];
        }
        const out = [];
        const seen = new Set();
        for (const entry of raw) {
            const normalized = AISummarizer.normalizeLmReasoningOption(entry);
            if (!normalized || seen.has(normalized)) {
                continue;
            }
            seen.add(normalized);
            out.push(normalized);
        }
        return out;
    }

    /**
     * Whether the LM REST `reasoning` field should be sent at all.
     * Missing legacy flag falls back to the old behavior (`off` meant disabled).
     * @param {unknown} raw
     * @param {unknown} fallbackLevel
     * @returns {boolean}
     */
    static normalizeLmReasoningEnabled(raw, fallbackLevel = 'off') {
        if (raw === true || raw === 1) {
            return true;
        }
        if (raw === false || raw === 0) {
            return false;
        }
        const s = String(raw ?? '')
            .trim()
            .toLowerCase();
        if (s === '1' || s === 'true' || s === 'yes' || s === 'on') {
            return true;
        }
        if (s === '0' || s === 'false' || s === 'no' || s === 'off') {
            return false;
        }
        return AISummarizer.normalizeLmReasoningParam(fallbackLevel) !== 'off';
    }

    /**
     * Current selected reasoning level for LM REST (reads `heise_reasoning` from localStorage).
     * @returns {'off'|'low'|'medium'|'high'|'on'}
     */
    getLmReasoningLevel() {
        let fromLs = '';
        try {
            fromLs = localStorage.getItem('heise_reasoning') || '';
        } catch (_) {
            /* ignore */
        }
        return AISummarizer.normalizeLmReasoningParam(fromLs);
    }

    /**
     * Current reasoning config for LM REST.
     * `enabled=false` omits the field entirely; `enabled=true` sends the selected level, including `off`.
     * @returns {{ enabled: boolean, level: 'off'|'low'|'medium'|'high'|'on' }}
     */
    getLmReasoningConfig() {
        const level = this.getLmReasoningLevel();
        let fromLs = '';
        try {
            fromLs = localStorage.getItem('heise_reasoning_enabled') || '';
        } catch (_) {
            /* ignore */
        }
        return {
            enabled: AISummarizer.normalizeLmReasoningEnabled(fromLs, level),
            level
        };
    }

    /**
     * Per-request KI HTTP timeout in milliseconds (`heise_ki_request_timeout_sec` in localStorage, clamped 15–3600 s).
     * One `AbortController` covers model resolve + chat POST for LM REST paths.
     * @returns {number}
     */
    getKiRequestTimeoutMs() {
        let sec = 120;
        try {
            if (typeof localStorage !== 'undefined') {
                const raw = localStorage.getItem('heise_ki_request_timeout_sec');
                if (raw != null && raw !== '') {
                    const n = parseInt(String(raw), 10);
                    if (Number.isFinite(n)) {
                        sec = n;
                    }
                }
            }
        } catch (_) {
            /* ignore */
        }
        sec = Math.min(3600, Math.max(15, sec));
        return sec * 1000;
    }

    /**
     * How many alternative article links the model should suggest (0 = disabled). `heise_alternative_links_count` in localStorage.
     * @returns {number} 0–15
     */
    getAlternativeLinksCount() {
        try {
            const raw = localStorage.getItem('heise_alternative_links_count');
            const n = raw !== null && raw !== '' ? parseInt(raw, 10) : 5;
            if (!Number.isFinite(n) || n < 0) {
                return 5;
            }
            return Math.min(15, Math.floor(n));
        } catch (_) {
            return 5;
        }
    }

    /**
     * How many alternative links to load from Bing News RSS (`/api/search-news`). Not used in the LLM prompt.
     * @returns {number} 0 or 5–15
     */
    getAlternativeLinksSearchResultCount() {
        const n = this.getAlternativeLinksCount();
        if (n <= 0) {
            return 0;
        }
        return Math.min(15, Math.max(5, n));
    }

    /**
     * KI prompts no longer include ---KI_LINKS---; links come from {@link fetchAlternativeLinksFromBingNewsSearch}.
     * @returns {number} always 0
     */
    getEffectiveAlternativeLinksCountForPrompt() {
        return 0;
    }

    /**
     * Bing News RSS market (server-side fetch).
     * @param {string} articleUrl
     * @returns {string} e.g. de-DE, en-US
     */
    resolveBingNewsMkt(articleUrl) {
        if (this.getSummaryLangMode() === 'browser') {
            try {
                const nav =
                    typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US';
                const low = nav.toLowerCase();
                if (low.startsWith('de')) {
                    return 'de-DE';
                }
                if (low.startsWith('en')) {
                    return 'en-US';
                }
                if (nav.includes('-')) {
                    const p = nav.split('-');
                    return `${p[0].toLowerCase()}-${(p[1] || 'US').toUpperCase()}`;
                }
                return `${nav}-US`;
            } catch (_) {
                return 'en-US';
            }
        }
        const lang = AISummarizer.siteLanguageFromArticleUrl(articleUrl);
        return AISummarizer.languageToBingMarket(lang);
    }

    /**
     * Loads alternative article links from Bing News RSS via the dev server (`GET /api/search-news`).
     * @param {string} title
     * @param {string} description
     * @param {string} articleUrl
     * @returns {Promise<Array<{ title: string, url: string, source?: string }>>}
     */
    async fetchAlternativeLinksFromBingNewsSearch(title, description, articleUrl) {
        const desired = this.getAlternativeLinksSearchResultCount();
        if (desired <= 0) {
            return [];
        }
        /** Ask Bing for more rows than we need so we can drop same-source URLs and still fill after HTTP probe. */
        const fetchLimit = Math.min(30, Math.max(desired + 18, desired * 4));
        const t = String(title || '').trim();
        const d = String(description || '')
            .trim()
            .slice(0, 220);
        const q = [t, d].filter(Boolean).join(' ').trim();
        if (!q) {
            return [];
        }
        if (typeof window === 'undefined' || !window.location || !window.location.origin) {
            return [];
        }
        const origin = window.location.origin;
        if (origin === 'null' || String(origin).startsWith('file')) {
            console.warn(
                'Alternative links (Bing News): open the app via http(s) (e.g. scripts/dev_server.py) so /api/search-news is available.'
            );
            return [];
        }
        const mkt = this.resolveBingNewsMkt(articleUrl);
        try {
            const params = new URLSearchParams({
                q,
                limit: String(fetchLimit),
                mkt
            });
            const r = await fetch(`${origin}/api/search-news?${params}`, {
                method: 'GET',
                cache: 'no-store',
                credentials: 'same-origin'
            });
            if (!r.ok) {
                return [];
            }
            const data = await r.json();
            if (!data || data.ok !== true || !Array.isArray(data.results)) {
                return [];
            }
            return data.results
                .filter((row) => row && typeof row.url === 'string' && row.url.trim())
                .map((row) => {
                    const headline = typeof row.title === 'string' ? row.title.trim() : '';
                    const u = row.url.trim();
                    const src = typeof row.source === 'string' ? row.source.trim() : '';
                    /** @type {{ title: string, url: string, source?: string }} */
                    const out = { title: headline || u, url: u };
                    if (src) {
                        out.source = src;
                    }
                    return out;
                })
                .filter((row) => AISummarizer.isPlausibleArticleUrl(row.url))
                .filter((row) => !AISummarizer.shouldExcludeAlternativeLinkUrl(row.url, articleUrl));
        } catch (e) {
            console.warn('Alternative links (Bing News):', e);
            return [];
        }
    }

    /**
     * Reject search-result pages and other non-article URLs the model might emit.
     * @param {string} url
     * @returns {boolean}
     */
    static isPlausibleArticleUrl(url) {
        const s = String(url || '').trim();
        if (!/^https?:\/\//i.test(s)) {
            return false;
        }
        try {
            const u = new URL(s);
            const h = u.hostname.toLowerCase();
            const path = `${u.pathname}${u.search}`;
            if ((h === 'www.google.com' || h.endsWith('.google.com')) && path.includes('/search')) {
                return false;
            }
            if (h.endsWith('bing.com') && path.includes('/search')) {
                return false;
            }
            if (h === 'duckduckgo.com' && (u.pathname === '/' || u.pathname === '') && u.searchParams.has('q')) {
                return false;
            }
            if (h === 'www.ecosia.org' && path.includes('/search')) {
                return false;
            }
            return true;
        } catch {
            return false;
        }
    }

    /**
     * @returns {string[]}
     */
    static newsCatalogIds() {
        if (typeof window !== 'undefined' && Array.isArray(window.NEWS_SOURCE_IDS)) {
            return [...window.NEWS_SOURCE_IDS];
        }
        return ['heise', 'bild', 'telepolis', 'golem', 'computerbase', 't3n', 'it_administrator', 'verge'];
    }

    /** @returns {{ getSourceEntry?: Function, getSourceDisplayName?: Function, getSourceLanguage?: Function, getSourceSiteUrl?: Function, hostMatchesEntry?: Function, getSourceIdByHostname?: Function, getSourceLanguageByHostname?: Function }|null} */
    static sourceRegistryUtils() {
        if (
            typeof window !== 'undefined' &&
            window.NEWS_SOURCE_REGISTRY_UTILS &&
            typeof window.NEWS_SOURCE_REGISTRY_UTILS === 'object'
        ) {
            return window.NEWS_SOURCE_REGISTRY_UTILS;
        }
        return null;
    }

    /**
     * @param {string} sourceId
     * @returns {string}
     */
    static getSourceDisplayName(sourceId) {
        const utils = AISummarizer.sourceRegistryUtils();
        if (utils && typeof utils.getSourceDisplayName === 'function') {
            const label = String(utils.getSourceDisplayName(sourceId) || '').trim();
            if (label) {
                return label;
            }
        }
        return String(sourceId || '').trim();
    }

    /**
     * @param {string} sourceId
     * @returns {string}
     */
    static getSourceLanguage(sourceId) {
        const utils = AISummarizer.sourceRegistryUtils();
        if (utils && typeof utils.getSourceLanguage === 'function') {
            return String(utils.getSourceLanguage(sourceId) || '')
                .trim()
                .toLowerCase();
        }
        return sourceId === 'verge' ? 'en' : 'de';
    }

    /**
     * @param {string} sourceId
     * @returns {string}
     */
    static getSourceSiteUrl(sourceId) {
        const utils = AISummarizer.sourceRegistryUtils();
        if (utils && typeof utils.getSourceSiteUrl === 'function') {
            return String(utils.getSourceSiteUrl(sourceId) || '').trim();
        }
        return '';
    }

    /**
     * @param {string} lang
     * @returns {string}
     */
    static languageToBingMarket(lang) {
        switch (String(lang || '').trim().toLowerCase()) {
            case 'de':
                return 'de-DE';
            case 'fr':
                return 'fr-FR';
            case 'it':
                return 'it-IT';
            case 'es':
                return 'es-ES';
            case 'pt':
                return 'pt-BR';
            case 'ja':
                return 'ja-JP';
            case 'ko':
                return 'ko-KR';
            case 'en':
            default:
                return 'en-US';
        }
    }

    /**
     * News sources whose domains must not appear in alternative links (same as header „Quelle“ catalog).
     * Empty `heise_enabled_news_sources` in storage means all sources are enabled → exclude all catalog domains.
     * @returns {string[]}
     */
    static getExcludedSourceIdsForAlternativeLinks() {
        const known = AISummarizer.newsCatalogIds();
        const knownSet = new Set(known);
        try {
            const raw = localStorage.getItem('heise_enabled_news_sources');
            if (raw == null || raw === '') {
                return [...known];
            }
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) {
                if (arr.length === 0) {
                    return [...known];
                }
                const ids = arr.filter((id) => typeof id === 'string' && knownSet.has(id));
                if (ids.length > 0) {
                    return ids;
                }
            }
        } catch (_) {
            return [...known];
        }
        let cur = 'heise';
        try {
            cur = localStorage.getItem('heise_news_source') || cur;
        } catch (_) {
            /* ignore */
        }
        if (typeof window !== 'undefined' && window.__newsSource && knownSet.has(window.__newsSource)) {
            cur = window.__newsSource;
        }
        return knownSet.has(cur) ? [cur] : ['heise'];
    }

    /**
     * User-defined blacklist: newline/comma/semicolon-separated domains (or URLs) in localStorage.
     * @returns {string[]}
     */
    static getUserBlockedDomainsForAlternativeLinks() {
        let raw = '';
        try {
            raw = localStorage.getItem('heise_alternative_links_blacklist') || '';
        } catch (_) {
            raw = '';
        }
        if (!raw.trim()) {
            return [];
        }
        const out = [];
        const seen = new Set();
        const parts = String(raw).split(/[\n,;]+/);
        for (const part of parts) {
            const token = String(part || '').trim();
            if (!token) {
                continue;
            }
            let host = token;
            try {
                const probe = token.includes('://') ? token : `https://${token}`;
                host = new URL(probe).hostname;
            } catch (_) {
                host = token;
            }
            host = AISummarizer.normalizeHostnameForMatch(host).replace(/^\*\./, '').replace(/\.$/, '');
            if (!/^[a-z0-9.-]+$/.test(host) || !host.includes('.')) {
                continue;
            }
            if (!seen.has(host)) {
                seen.add(host);
                out.push(host);
            }
        }
        return out;
    }

    /**
     * @param {string} host
     * @returns {string}
     */
    static normalizeHostnameForMatch(host) {
        let h = String(host || '')
            .trim()
            .toLowerCase();
        if (h.startsWith('www.')) {
            h = h.slice(4);
        }
        return h;
    }

    /**
     * @param {string} sourceId
     * @param {string} hostname
     * @returns {boolean}
     */
    static newsSourceIdMatchesHostname(sourceId, hostname) {
        const h = AISummarizer.normalizeHostnameForMatch(hostname);
        const utils = AISummarizer.sourceRegistryUtils();
        if (utils && typeof utils.hostMatchesEntry === 'function') {
            return utils.hostMatchesEntry(sourceId, h);
        }
        const siteUrl = AISummarizer.getSourceSiteUrl(sourceId);
        if (siteUrl) {
            try {
                const base = AISummarizer.normalizeHostnameForMatch(new URL(siteUrl).hostname);
                return h === base || h.endsWith(`.${base}`);
            } catch (_) {
                /* ignore */
            }
        }
        return false;
    }

    /**
     * Drop links that point at the same host as the article or at a configured news source domain.
     * @param {string} url
     * @param {string} articleUrl
     * @returns {boolean} true = exclude
     */
    static shouldExcludeAlternativeLinkUrl(url, articleUrl) {
        try {
            const u = new URL(String(url || '').trim());
            const excludedIds = AISummarizer.getExcludedSourceIdsForAlternativeLinks();
            for (const id of excludedIds) {
                if (AISummarizer.newsSourceIdMatchesHostname(id, u.hostname)) {
                    return true;
                }
            }
            const blockedDomains = AISummarizer.getUserBlockedDomainsForAlternativeLinks();
            if (blockedDomains.length > 0) {
                const host = AISummarizer.normalizeHostnameForMatch(u.hostname);
                for (const dom of blockedDomains) {
                    if (host === dom || host.endsWith(`.${dom}`)) {
                        return true;
                    }
                }
            }
            if (articleUrl && String(articleUrl).trim()) {
                const a = new URL(String(articleUrl).trim());
                if (
                    AISummarizer.normalizeHostnameForMatch(u.hostname) ===
                    AISummarizer.normalizeHostnameForMatch(a.hostname)
                ) {
                    return true;
                }
            }
        } catch (_) {
            /* keep */
        }
        return false;
    }

    /**
     * Parses model output with optional `---KI_SUMMARY---` / `---KI_LINKS---` blocks.
     * Each link line: `QUELLE: Überschrift | https://…` (source optional) or `Kurztitel | https://…`.
     * @param {string} raw
     * @param {number} maxLinks
     * @returns {{ summary: string, alternativeLinks: Array<{ title: string, url: string, source?: string }> }}
     */
    static parseSummaryWithLinks(raw, maxLinks) {
        const full = String(raw ?? '').trim();
        const links = [];
        if (!full) {
            return { summary: '', alternativeLinks: links };
        }
        const cap = Math.max(0, Math.min(15, Number(maxLinks) || 0));
        const parts = full.split(/\n---KI_LINKS---\s*\n/i);
        let mainPart = parts[0].trim().replace(/^---KI_SUMMARY---\s*\r?\n?/im, '').trim();
        if (parts.length > 1 && cap > 0) {
            const block = parts[1].trim();
            for (const line of block.split('\n')) {
                const m = line.match(/^\s*(?:[-*•]\s*)?(.+?)\s*\|\s*(https?:\/\/[^\s|]+)/i);
                if (!m) {
                    continue;
                }
                const left = m[1].trim();
                const url = m[2].trim();
                if (!AISummarizer.isPlausibleArticleUrl(url)) {
                    continue;
                }
                let source = '';
                let headline = left;
                const colonAt = left.indexOf(':');
                if (colonAt > 0 && colonAt < left.length - 1) {
                    const maybeSource = left.slice(0, colonAt).trim();
                    const maybeHeadline = left.slice(colonAt + 1).trim();
                    if (maybeSource && maybeHeadline) {
                        source = maybeSource;
                        headline = maybeHeadline;
                    }
                }
                /** @type {{ title: string, url: string, source?: string }} */
                const row = { title: headline, url };
                if (source) {
                    row.source = source;
                }
                links.push(row);
                if (links.length >= cap) {
                    break;
                }
            }
        }
        if (!mainPart) {
            mainPart = full.replace(/^---KI_SUMMARY---\s*\r?\n?/im, '').trim();
        }
        return { summary: mainPart, alternativeLinks: links };
    }

    /**
     * @param {string} rawText
     * @returns {{ summary: string, alternativeLinks: Array<{ title: string, url: string }> }}
     */
    _packageSummaryResult(rawText) {
        const maxLinks = this.getEffectiveAlternativeLinksCountForPrompt();
        const parsed = AISummarizer.parseSummaryWithLinks(rawText, maxLinks);
        const summarySan = AISummarizer.sanitizePublicSummary(parsed.summary);
        const summary =
            (summarySan || '').trim() ||
            (parsed.summary || '').trim() ||
            String(rawText || '').trim();
        return {
            summary,
            alternativeLinks: Array.isArray(parsed.alternativeLinks) ? parsed.alternativeLinks : []
        };
    }

    /**
     * News source for prompts (IndexedDB settings mirrored to localStorage as `heise_news_source`).
     * @returns {string} domain label for the prompt
     */
    getNewsSourceLabel() {
        const formatLabel = (sourceId) => {
            const displayName = AISummarizer.getSourceDisplayName(sourceId);
            const siteUrl = AISummarizer.getSourceSiteUrl(sourceId);
            if (!siteUrl) {
                return displayName || 'heise.de';
            }
            try {
                const host = AISummarizer.normalizeHostnameForMatch(new URL(siteUrl).hostname);
                if (!displayName || displayName === host) {
                    return host || displayName || 'heise.de';
                }
                if (host && displayName.toLowerCase().includes(host)) {
                    return displayName;
                }
                return `${displayName} (${host})`;
            } catch (_) {
                return displayName || siteUrl || 'heise.de';
            }
        };
        try {
            const s = localStorage.getItem('heise_news_source');
            if (s && AISummarizer.newsCatalogIds().includes(s)) {
                return formatLabel(s);
            }
        } catch (_) {
            /* ignore */
        }
        if (
            typeof window !== 'undefined' &&
            window.__newsSource &&
            AISummarizer.newsCatalogIds().includes(window.__newsSource)
        ) {
            return formatLabel(window.__newsSource);
        }
        return 'heise.de';
    }

    /** Full URL for LM Studio REST chat request (only for `lm_rest_v1` mode). */
    getLmRestChatUrl() {
        if (this.getKiApiMode() !== 'lm_rest_v1') {
            return '';
        }
        if (this.isLmRestSameOrigin()) {
            if (
                typeof window !== 'undefined' &&
                window.location &&
                window.location.origin &&
                window.location.protocol !== 'file:'
            ) {
                return `${window.location.origin}/api/v1/chat`;
            }
        }
        const root = this.getLmRestRoot();
        return `${root}/api/v1/chat`;
    }

    /** Full URL for Anthropic Messages API request (only for `anthropic` mode). */
    getAnthropicMessagesUrl() {
        if (this.getKiApiMode() !== 'anthropic') {
            return '';
        }
        return `${this.getAnthropicApiBase()}/messages`;
    }

    /** @returns {'openai'|'lm_rest_v1'|'anthropic'} */
    getKiApiMode() {
        try {
            const m = localStorage.getItem('heise_ki_api_mode');
            return AISummarizer.normalizeKiApiMode(m);
        } catch (_) {
            /* ignore */
        }
        /** Default matches App.loadSettings / README (LM Studio REST v1). */
        return 'lm_rest_v1';
    }

    getLmApiToken() {
        try {
            const t = localStorage.getItem('heise_lm_api_token');
            return t && t.trim() ? t.trim() : '';
        } catch (_) {
            return '';
        }
    }

    /** @param {unknown} raw */
    static normalizeLmModelSelectionMode(raw) {
        return String(raw || '').trim() === 'manual' ? 'manual' : 'auto';
    }

    /** @returns {'auto'|'manual'} */
    getLmModelSelectionMode() {
        try {
            return AISummarizer.normalizeLmModelSelectionMode(
                localStorage.getItem('heise_lm_model_selection_mode')
            );
        } catch (_) {
            return 'auto';
        }
    }

    /**
     * Resolved model id for OpenAI-compatible `/v1/chat/completions` only.
     * LM Studio REST (`lm_rest_v1`) uses {@link resolveLmRestModelId} so `model` is always set (required by LM Studio).
     */
    getModelName() {
        if (this.getLmModelSelectionMode() === 'manual') {
            try {
                const m = localStorage.getItem('heise_lm_model');
                if (m && m.trim()) {
                    return m.trim();
                }
            } catch (_) {
                /* ignore */
            }
        }
        if (this.getKiApiMode() === 'lm_rest_v1') {
            return '';
        }
        if (this.getKiApiMode() === 'anthropic') {
            try {
                const resolved = sessionStorage.getItem('heise_anthropic_resolved_model_id');
                if (resolved && resolved.trim()) {
                    return resolved.trim();
                }
            } catch (_) {
                /* ignore */
            }
            return '';
        }
        return 'gpt-3.5-turbo';
    }

    /**
     * Native LM Studio model list (includes `loaded_instances`). Same-origin via dev_server: GET /api/v1/models.
     */
    getLmRestModelsListUrl() {
        if (this.isLmRestSameOrigin()) {
            if (
                typeof window !== 'undefined' &&
                window.location &&
                window.location.origin &&
                window.location.protocol !== 'file:'
            ) {
                return `${window.location.origin}/api/v1/models`;
            }
        }
        return `${this.getLmRestRoot()}/api/v1/models`;
    }

    /**
     * @param {string} [tokenOverride] If set, used instead of `localStorage` (e.g. unsaved KI settings modal).
     * @param {string} [requestUrlForNgrokHint] If set, used to detect ngrok (unsaved server URL in settings UI).
     */
    buildLmRestGetHeaders(tokenOverride, requestUrlForNgrokHint) {
        const h = { Accept: 'application/json' };
        let token = '';
        if (tokenOverride !== undefined) {
            token = String(tokenOverride || '').trim();
        } else {
            token = this.getLmApiToken();
        }
        if (token) {
            h.Authorization = `Bearer ${token}`;
        }
        const probe =
            requestUrlForNgrokHint != null && String(requestUrlForNgrokHint).trim()
                ? String(requestUrlForNgrokHint)
                : this.getEffectiveServerUrlForHints();
        if (String(probe).includes('ngrok')) {
            h['ngrok-skip-browser-warning'] = 'true';
        }
        return h;
    }

    /**
     * Resolves GET …/models URL for LM Studio: native `/api/v1/models` in REST v1 mode; OpenAI-style `/v1/models` in OpenAI mode.
     * @param {{
     *   kiApiMode?: string,
     *   lmRestRoot?: string,
     *   apiBaseUrl?: string,
     *   anthropicApiBaseUrl?: string,
     *   restSameOrigin?: boolean,
     *   pageOrigin?: string
     * }} opts
     * @returns {string} Empty if models cannot be requested (e.g. file: + same-origin).
     */
    static getModelsListUrlFromSettings(opts) {
        const mode = AISummarizer.normalizeKiApiMode(opts && opts.kiApiMode);
        const restSo =
            mode === 'lm_rest_v1' &&
            (opts.restSameOrigin === true ||
                opts.restSameOrigin === 1 ||
                opts.restSameOrigin === '1');
        if (restSo) {
            const origin =
                (opts.pageOrigin && String(opts.pageOrigin)) ||
                (typeof window !== 'undefined' &&
                window.location &&
                window.location.origin &&
                window.location.protocol !== 'file:'
                    ? window.location.origin
                    : '');
            if (origin) {
                return `${origin}/api/v1/models`;
            }
            return '';
        }
        if (mode === 'lm_rest_v1') {
            const root = AISummarizer.normalizeLmRestServerRoot(opts.lmRestRoot || '');
            return `${root}/api/v1/models`;
        }
        if (mode === 'anthropic') {
            const base = AISummarizer.normalizeAnthropicApiBase(
                opts.anthropicApiBaseUrl || opts.apiBaseUrl || ''
            );
            return `${base}/models`;
        }
        const base = AISummarizer.normalizeOpenAiApiBase(opts.apiBaseUrl || '');
        return `${base}/models`;
    }

    /**
     * @param {'openai'|'lm_rest_v1'|'anthropic'} mode
     * @param {string | undefined} tokenOverride
     * @param {string} requestUrlForNgrokHint
     * @returns {Record<string, string>}
     */
    buildModelsGetHeaders(mode, tokenOverride, requestUrlForNgrokHint) {
        if (mode === 'anthropic') {
            return this.buildAnthropicHeaders({ includeContentType: false, tokenOverride });
        }
        return this.buildLmRestGetHeaders(tokenOverride, requestUrlForNgrokHint);
    }

    /**
     * @param {object} raw LM Studio native, OpenAI-style `data[]`, or hybrid.
     * @returns {{ id: string, raw: object, displayName: string, type: string, loaded: boolean, paramsString: string, quantLabel: string, architecture: string, maxContextLength: number, publisher: string, reasoningAllowedOptions: Array<'off'|'low'|'medium'|'high'|'on'>, reasoningDefault: ''|'off'|'low'|'medium'|'high'|'on', aliases: string[] } | null}
     */
    static normalizeModelListEntry(raw) {
        if (!raw || typeof raw !== 'object') {
            return null;
        }
        const id = String(raw.id ?? raw.model ?? raw.key ?? '').trim();
        if (!id) {
            return null;
        }
        const type = typeof raw.type === 'string' ? raw.type : '';
        if (type === 'embedding') {
            return null;
        }
        const displayName = String(raw.display_name ?? raw.displayName ?? raw.id ?? '').trim() || id;
        const loaded = Array.isArray(raw.loaded_instances) && raw.loaded_instances.length > 0;
        const paramsString = raw.params_string != null ? String(raw.params_string).trim() : '';
        let quantLabel = '';
        if (raw.quantization && typeof raw.quantization === 'object') {
            const qn = raw.quantization.name;
            quantLabel = qn != null ? String(qn).trim() : '';
        }
        const architecture = raw.architecture != null ? String(raw.architecture).trim() : '';
        const maxContextLength =
            typeof raw.max_context_length === 'number' && Number.isFinite(raw.max_context_length)
                ? raw.max_context_length
                : 0;
        const publisher = raw.publisher != null ? String(raw.publisher).trim() : '';
        const reasoningAllowedOptions = AISummarizer.normalizeLmReasoningOptions(
            raw.capabilities &&
                typeof raw.capabilities === 'object' &&
                raw.capabilities.reasoning &&
                typeof raw.capabilities.reasoning === 'object'
                ? raw.capabilities.reasoning.allowed_options
                : []
        );
        let reasoningDefault = AISummarizer.normalizeLmReasoningOption(
            raw.capabilities &&
                typeof raw.capabilities === 'object' &&
                raw.capabilities.reasoning &&
                typeof raw.capabilities.reasoning === 'object'
                ? raw.capabilities.reasoning.default
                : ''
        );
        if (reasoningDefault && !reasoningAllowedOptions.includes(reasoningDefault)) {
            reasoningDefault = '';
        }
        const aliases = [];
        const pushAlias = (value) => {
            const normalized = String(value ?? '').trim();
            if (!normalized || aliases.includes(normalized)) {
                return;
            }
            aliases.push(normalized);
        };
        pushAlias(raw.id);
        pushAlias(raw.model);
        pushAlias(raw.key);
        pushAlias(raw.selected_variant);
        if (Array.isArray(raw.variants)) {
            for (const variant of raw.variants) {
                pushAlias(variant);
            }
        }
        if (Array.isArray(raw.loaded_instances)) {
            for (const instance of raw.loaded_instances) {
                if (instance && typeof instance === 'object') {
                    pushAlias(instance.id);
                }
            }
        }
        return {
            id,
            raw,
            displayName,
            type,
            loaded,
            paramsString,
            quantLabel,
            architecture,
            maxContextLength,
            publisher,
            reasoningAllowedOptions,
            reasoningDefault,
            aliases
        };
    }

    /**
     * @param {Array<object>} list Raw entries from LM Studio model list
     * @returns {object[]} Normalized non-embedding model entries.
     */
    static normalizeModelList(list) {
        if (!Array.isArray(list)) {
            return [];
        }
        const normalized = [];
        for (const row of list) {
            const n = AISummarizer.normalizeModelListEntry(row);
            if (n) {
                normalized.push(n);
            }
        }
        return normalized;
    }

    /**
     * @param {object | null | undefined} modelEntry
     * @returns {boolean}
     */
    static modelExposesLmReasoningConfig(modelEntry) {
        return Boolean(
            modelEntry &&
                Array.isArray(modelEntry.reasoningAllowedOptions) &&
                modelEntry.reasoningAllowedOptions.length > 0
        );
    }

    /**
     * Short label for `<option>` text (metadata in parentheses).
     * @param {{ id: string, displayName: string, paramsString: string, quantLabel: string, loaded: boolean }} m
     * @param {{ loadedMark?: string }} [fmt]
     * @returns {string}
     */
    static formatModelOptionLabel(m, fmt) {
        if (!m) {
            return '';
        }
        const parts = [];
        if (m.paramsString) {
            parts.push(m.paramsString);
        }
        if (m.quantLabel) {
            parts.push(m.quantLabel);
        }
        const extra = parts.length ? ` (${parts.join(', ')})` : '';
        const base = `${m.displayName || m.id}${extra}`;
        if (m.loaded && fmt && fmt.loadedMark) {
            return `${fmt.loadedMark} ${base}`;
        }
        return base;
    }

    /**
     * Tooltip / `title` text with extra fields (Publisher, architecture, context, format).
     * @param {{ id: string, raw: object, displayName: string, publisher: string, architecture: string, maxContextLength: number, loaded: boolean }} m
     * @returns {string}
     */
    static getModelTitleTooltip(m) {
        if (!m || !m.raw || typeof m.raw !== 'object') {
            return m ? m.id : '';
        }
        const r = m.raw;
        const bits = [];
        if (m.publisher) {
            bits.push(`Publisher: ${m.publisher}`);
        }
        if (m.architecture) {
            bits.push(`Architecture: ${m.architecture}`);
        }
        if (m.maxContextLength > 0) {
            bits.push(`Max context: ${m.maxContextLength} tokens`);
        }
        if (r.format != null && String(r.format).trim()) {
            bits.push(`Format: ${r.format}`);
        }
        if (r.capabilities && typeof r.capabilities === 'object') {
            const cap = r.capabilities;
            if (cap.vision === true) {
                bits.push('Vision: yes');
            }
            if (cap.trained_for_tool_use === true) {
                bits.push('Tool use: yes');
            }
        }
        if (m.loaded) {
            bits.push('Loaded in LM Studio: yes');
        }
        return bits.length ? bits.join(' | ') : m.id;
    }

    /**
     * GET LM Studio model list: native `/api/v1/models` first; on 404 only, retry OpenAI-style `/v1/models` (older servers).
     * @param {string} listUrl
     * @param {AbortSignal} signal
     * @param {Record<string, string>} headers
     * @returns {Promise<{ response: Response, rawText: string }>}
     */
    static async tryFetchModelsList(listUrl, signal, headers) {
        const opts = { method: 'GET', headers, signal, mode: 'cors', credentials: 'omit' };
        let response = await fetch(listUrl, opts);
        let rawText = await response.text();
        if (response.status === 404 && /\/api\/v1\/models\/?$/i.test(String(listUrl))) {
            const alt = String(listUrl).replace(/\/api\/v1\/models\/?$/i, '/v1/models');
            if (alt !== listUrl) {
                response = await fetch(alt, opts);
                rawText = await response.text();
            }
        }
        return { response, rawText };
    }

    /**
     * Fetch model list for KI settings UI. Uses same endpoints as {@link resolveLmRestModelId}.
     * @param {AbortSignal} signal
     * @param {{
     *   kiApiMode?: string,
     *   lmRestRoot?: string,
     *   apiBaseUrl?: string,
     *   anthropicApiBaseUrl?: string,
     *   restSameOrigin?: boolean,
     *   lmApiToken?: string,
     *   pageOrigin?: string
     * }} [opts] Explicit settings (e.g. modal fields before Save). Omits use persisted `localStorage`.
     * @returns {Promise<{ ok: true, models: object[] } | { ok: false, error: string }>}
     */
    async fetchAvailableModels(signal, opts) {
        const o = opts && typeof opts === 'object' ? opts : {};
        const mode = AISummarizer.normalizeKiApiMode(o.kiApiMode ?? this.getKiApiMode());
        const url = AISummarizer.getModelsListUrlFromSettings({
            kiApiMode: mode,
            lmRestRoot: o.lmRestRoot ?? this.getLmRestRoot(),
            apiBaseUrl: o.apiBaseUrl ?? this.getApiBase(),
            anthropicApiBaseUrl: o.anthropicApiBaseUrl ?? this.getAnthropicApiBase(),
            restSameOrigin: o.restSameOrigin ?? this.isLmRestSameOrigin(),
            pageOrigin: o.pageOrigin
        });
        if (!url) {
            return {
                ok: false,
                error:
                    'Models list URL could not be built (same-origin REST needs http(s) page origin, not file://).'
            };
        }
        const token =
            o.lmApiToken !== undefined
                ? String(o.lmApiToken || '').trim()
                : this.getLmApiToken();
        if (mode === 'anthropic' && !token) {
            return {
                ok: false,
                error: 'Anthropic API token is required for GET /v1/models.'
            };
        }
        let response;
        let rawText;
        try {
            ({ response, rawText } = await AISummarizer.tryFetchModelsList(
                url,
                signal,
                this.buildModelsGetHeaders(mode, token, url)
            ));
        } catch (e) {
            const msg = e && e.message ? String(e.message) : 'Network error';
            return { ok: false, error: msg };
        }
        let data;
        try {
            data = JSON.parse(rawText.trim());
        } catch {
            return {
                ok: false,
                error: `GET models returned non-JSON (HTTP ${response.status}).`
            };
        }
        if (!response.ok) {
            const detail = data.error?.message || data.message || rawText.slice(0, 200);
            return {
                ok: false,
                error: `GET models failed (HTTP ${response.status}): ${detail}`
            };
        }
        const list = Array.isArray(data?.data)
            ? data.data
            : Array.isArray(data?.models)
              ? data.models
              : [];
        const models = [];
        for (const row of list) {
            const n = AISummarizer.normalizeModelListEntry(row);
            if (n) {
                models.push(n);
            }
        }
        models.sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));
        return { ok: true, models };
    }

    /**
     * @param {Array<object>} list Raw entries from LM Studio model list
     * @returns {string} First usable model id, preferring one reported as loaded, or empty string.
     */
    static pickFirstModelIdFromRawList(list) {
        const normalized = AISummarizer.normalizeModelList(list);
        if (!normalized.length) {
            return '';
        }
        const loaded = normalized.find((n) => n.loaded);
        if (loaded) {
            return loaded.id;
        }
        return normalized[0].id;
    }

    /**
     * LM Studio REST requires `model` on every request. If the user left the name empty,
     * list models via GET /api/v1/models (fallback: /v1/models) and prefer the model
     * LM Studio currently reports as loaded. Do not trust a previously resolved
     * session value here; users can switch the loaded model in LM Studio while the
     * Cucumber tab stays open.
     * @param {AbortSignal} signal
     * @returns {Promise<{ id: string, modelEntry: object | null }>}
     */
    async resolveLmRestModelInfo(signal) {
        if (this.getKiApiMode() !== 'lm_rest_v1') {
            const n = this.getModelName();
            return { id: n || 'gpt-3.5-turbo', modelEntry: null };
        }
        if (this.getLmModelSelectionMode() === 'manual') {
            try {
                const m = localStorage.getItem('heise_lm_model');
                if (m && m.trim()) {
                    return { id: m.trim(), modelEntry: null };
                }
            } catch (_) {
                /* ignore */
            }
        }
        const url = this.getLmRestModelsListUrl();
        let response;
        let rawText;
        try {
            ({ response, rawText } = await AISummarizer.tryFetchModelsList(
                url,
                signal,
                this.buildLmRestGetHeaders(undefined, url)
            ));
        } catch (e) {
            const msg = e && e.message ? String(e.message) : 'Netzwerkfehler';
            throw new Error(
                `Modell konnte nicht ermittelt werden (${msg}). Wählen Sie unter „Modell“ ein geladenes LM-Studio-Modell oder nutzen Sie „Automatisch“, damit Cucumber per GET /api/v1/models das aktuell geladene LM-Studio-Modell ermitteln kann.`
            );
        }
        let data;
        try {
            data = JSON.parse(rawText.trim());
        } catch {
            throw new Error(
                `GET /api/v1/models lieferte kein JSON (HTTP ${response.status}). Prüfen Sie die LM-Studio-URL oder tragen Sie den Modellnamen manuell ein.`
            );
        }

        if (!response.ok) {
            const detail = data.error?.message || data.message || rawText.slice(0, 200);
            throw new Error(
                `GET /api/v1/models fehlgeschlagen (HTTP ${response.status}): ${detail}`
            );
        }

        const list = Array.isArray(data?.data)
            ? data.data
            : Array.isArray(data?.models)
              ? data.models
              : [];
        const normalized = AISummarizer.normalizeModelList(list);
        if (!normalized.length) {
            throw new Error(
                'LM Studio meldet keine Modelle (leere Liste). Laden Sie ein Modell oder tragen Sie den Namen in den Einstellungen ein.'
            );
        }
        const modelEntry = normalized.find((n) => n.loaded) || normalized[0];
        const id = modelEntry.id;
        try {
            sessionStorage.setItem('heise_lm_resolved_model_id', id);
        } catch (_) {
            /* ignore */
        }
        return { id, modelEntry };
    }

    /**
     * @param {AbortSignal} signal
     * @returns {Promise<string>}
     */
    async resolveLmRestModelId(signal) {
        const info = await this.resolveLmRestModelInfo(signal);
        return info.id;
    }

    /**
     * Anthropic Messages requires `model`. If no model is pinned, list available models
     * via official GET /v1/models and use the first entry returned by Anthropic.
     * @param {AbortSignal} signal
     * @returns {Promise<{ id: string, modelEntry: object | null }>}
     */
    async resolveAnthropicModelInfo(signal) {
        if (this.getLmModelSelectionMode() === 'manual') {
            try {
                const m = localStorage.getItem('heise_lm_model');
                if (m && m.trim()) {
                    return { id: m.trim(), modelEntry: null };
                }
            } catch (_) {
                /* ignore */
            }
        }
        const token = this.getLmApiToken();
        if (!token) {
            throw new Error('Anthropic API token is required.');
        }
        const url = `${this.getAnthropicApiBase()}/models`;
        let response;
        let rawText;
        try {
            ({ response, rawText } = await AISummarizer.tryFetchModelsList(
                url,
                signal,
                this.buildAnthropicHeaders({ includeContentType: false, tokenOverride: token })
            ));
        } catch (e) {
            const msg = e && e.message ? String(e.message) : 'Netzwerkfehler';
            throw new Error(
                `Anthropic-Modell konnte nicht ermittelt werden (${msg}). Wählen Sie unter „Modell“ ein Modell aus GET /v1/models oder tragen Sie die Modell-ID manuell ein.`
            );
        }
        let data;
        try {
            data = JSON.parse(rawText.trim());
        } catch {
            throw new Error(
                `GET /v1/models lieferte kein JSON (HTTP ${response.status}). Prüfen Sie die Anthropic-Server-URL und den API-Token.`
            );
        }
        if (!response.ok) {
            const detail = data.error?.message || data.message || rawText.slice(0, 200);
            throw new Error(`GET /v1/models fehlgeschlagen (HTTP ${response.status}): ${detail}`);
        }
        const list = Array.isArray(data?.data)
            ? data.data
            : Array.isArray(data?.models)
              ? data.models
              : [];
        const normalized = AISummarizer.normalizeModelList(list);
        if (!normalized.length) {
            throw new Error(
                'Anthropic meldet keine nutzbaren Modelle (leere Liste). Wählen Sie ein Modell manuell oder prüfen Sie den API-Token.'
            );
        }
        const modelEntry = normalized[0];
        const id = modelEntry.id;
        try {
            sessionStorage.setItem('heise_anthropic_resolved_model_id', id);
        } catch (_) {
            /* ignore */
        }
        return { id, modelEntry };
    }

    /**
     * @param {object | null | undefined} modelEntry
     * @returns {{ enabled: boolean, level: 'off'|'low'|'medium'|'high'|'on' }}
     */
    getLmReasoningConfigForModel(modelEntry) {
        const config = this.getLmReasoningConfig();
        if (!config.enabled) {
            return config;
        }
        if (!AISummarizer.modelExposesLmReasoningConfig(modelEntry)) {
            return { enabled: false, level: config.level };
        }
        if (
            modelEntry &&
            Array.isArray(modelEntry.reasoningAllowedOptions) &&
            !modelEntry.reasoningAllowedOptions.includes(config.level)
        ) {
            return { enabled: false, level: config.level };
        }
        return config;
    }

    /** URL used for ngrok / mixed-content hints */
    getEffectiveServerUrlForHints() {
        if (this.getKiApiMode() === 'lm_rest_v1' && this.isLmRestSameOrigin()) {
            if (typeof window !== 'undefined' && window.location?.origin) {
                return window.location.origin;
            }
        }
        if (this.getKiApiMode() === 'lm_rest_v1') {
            return this.getLmRestRoot();
        }
        if (this.getKiApiMode() === 'anthropic') {
            return this.getAnthropicApiBase();
        }
        return this.getApiBase();
    }

    /**
     * Anthropic JSON/GET headers. Anthropic requires `x-api-key` and `anthropic-version`.
     * Direct browser calls require the explicit browser-access opt-in header.
     * @param {{ includeContentType?: boolean, tokenOverride?: string }} [opts]
     * @returns {Record<string, string>}
     */
    buildAnthropicHeaders(opts = {}) {
        const h = {
            Accept: 'application/json',
            'anthropic-version': ANTHROPIC_API_VERSION,
            'anthropic-dangerous-direct-browser-access': 'true'
        };
        if (opts.includeContentType !== false) {
            h['Content-Type'] = 'application/json';
        }
        const token =
            opts.tokenOverride !== undefined
                ? String(opts.tokenOverride || '').trim()
                : this.getLmApiToken();
        if (token) {
            h['x-api-key'] = token;
        }
        const baseHint = this.getAnthropicApiBase();
        if (baseHint.includes('ngrok')) {
            h['ngrok-skip-browser-warning'] = 'true';
        }
        return h;
    }

    /**
     * POST JSON — Content-Type, optional Bearer (LM Studio auth), ngrok helper.
     */
    buildJsonHeaders() {
        if (this.getKiApiMode() === 'anthropic') {
            return this.buildAnthropicHeaders({ includeContentType: true });
        }
        const h = {
            'Content-Type': 'application/json'
        };
        const token = this.getLmApiToken();
        if (token) {
            h.Authorization = `Bearer ${token}`;
        }
        const baseHint =
            this.getKiApiMode() === 'lm_rest_v1' ? this.getLmRestChatUrl() : this.getApiBase();
        if (baseHint.includes('ngrok')) {
            h['ngrok-skip-browser-warning'] = 'true';
        }
        return h;
    }

    /**
     * Max age for cached summaries. `0` days in settings = unlimited (Infinity ms).
     */
    getSummaryCacheMaxAgeMs() {
        try {
            const raw = localStorage.getItem('heise_summary_cache_days');
            const days = raw !== null && raw !== '' ? parseInt(raw, 10) : 14;
            if (!Number.isFinite(days) || days < 0) {
                return 14 * 86400000;
            }
            if (days === 0) {
                return Infinity;
            }
            return days * 86400000;
        } catch (_) {
            return 14 * 86400000;
        }
    }

    /**
     * Returns a cached summary for UI hydration after page reload if it exists and TTL allows.
     * Does not call the API. Omits stored API-failure messages.
     * @returns {Promise<{ summary: string, alternativeLinks: Array<{ title: string, url: string }> } | null>}
     */
    async getCachedSummaryForDisplay(url) {
        if (!url || typeof url !== 'string' || !url.trim()) {
            return null;
        }
        const maxAgeMs = this.getSummaryCacheMaxAgeMs();
        try {
            const { entry } = await this._getSummaryEntryForCacheLookup(url);
            if (!entry || typeof entry.summary !== 'string' || !entry.summary.trim()) {
                return null;
            }
            if (entry.summary.startsWith('Zusammenfassung nicht möglich:')) {
                return null;
            }
            const cachedAtMs = new Date(entry.cachedAt || 0).getTime();
            const ageOk =
                maxAgeMs === Infinity ||
                (Number.isFinite(cachedAtMs) && Date.now() - cachedAtMs <= maxAgeMs);
            if (!ageOk) {
                return null;
            }
            const alternativeLinks = Array.isArray(entry.alternativeLinks) ? entry.alternativeLinks : [];
            return { summary: entry.summary.trim(), alternativeLinks };
        } catch (e) {
            console.warn('KI: Cache für Anzeige lesen fehlgeschlagen:', e);
            return null;
        }
    }

    /**
     * When the app is served from `scripts/dev_server.py`, probes each alternative URL via
     * `GET /api/check-url` (server-side HEAD/GET) and drops clear 404/410 responses.
     * If the endpoint is missing (static hosting) or the request fails, links are kept.
     * @param {Array<{ title: string, url: string, source?: string }>} links
     * @param {number} [maxKeep] — cap how many links to return (after probe), in original order
     * @returns {Promise<Array<{ title: string, url: string, source?: string }>>}
     */
    async filterAlternativeLinksByServerProbe(links, maxKeep) {
        if (!Array.isArray(links) || links.length === 0) {
            return [];
        }
        if (typeof window === 'undefined' || !window.location || !window.location.origin) {
            return typeof maxKeep === 'number' && maxKeep > 0 ? links.slice(0, maxKeep) : links;
        }
        const origin = window.location.origin;
        if (origin === 'null' || String(origin).startsWith('file')) {
            return typeof maxKeep === 'number' && maxKeep > 0 ? links.slice(0, maxKeep) : links;
        }

        const probeOne = async (row) => {
            if (!row || typeof row.url !== 'string' || !row.url.trim()) {
                return { row, keep: false };
            }
            const u = row.url.trim();
            try {
                const checkUrl = `${origin}/api/check-url?${new URLSearchParams({ url: u })}`;
                const r = await fetch(checkUrl, {
                    method: 'GET',
                    cache: 'no-store',
                    credentials: 'same-origin'
                });
                if (!r.ok) {
                    return { row, keep: true };
                }
                const j = await r.json();
                if (j && j.drop === true) {
                    console.warn('KI: alternativer Link entfernt (HTTP ' + (j.status || '?') + '):', u.slice(0, 96));
                    return { row, keep: false };
                }
                return { row, keep: true };
            } catch (e) {
                return { row, keep: true };
            }
        };

        const results = await Promise.all(links.map((row) => probeOne(row)));
        let kept = results.filter((x) => x.keep).map((x) => x.row);
        if (typeof maxKeep === 'number' && maxKeep > 0 && kept.length > maxKeep) {
            kept = kept.slice(0, maxKeep);
        }
        return kept;
    }

    /**
     * @param {{ forceRefresh?: boolean }} options - forceRefresh: ignore/delete cache and call the API again
     * @returns {Promise<{ summary: string, alternativeLinks: Array<{ title: string, url: string }> }>}
     */
    async generateSummary(url, title, description = '', options = {}) {
        if (!url || typeof url !== 'string' || !url.trim()) {
            throw new Error('Ungültige oder fehlende Artikel-URL');
        }
        await this._ensureStorageReady();
        const trimmedUrl = url.trim();
        // Legacy key removed - canonicalSummaryCacheKey handles both stripping and canonicalization
        const cacheKey = AISummarizer.canonicalSummaryCacheKey(trimmedUrl);
        const promptUrl = cacheKey || trimmedUrl;
        const force = options.forceRefresh === true;

        if (force) {
            delete this.completionPromises[cacheKey];
            try {
                if (cacheKey) {
                    await this.storage.deleteSummary(cacheKey);
                }
            } catch (e) {
                console.warn('KI: Cache löschen fehlgeschlagen:', e);
            }
        }

        if (!force) {
            const maxAgeMs = this.getSummaryCacheMaxAgeMs();
            try {
                const { entry } = await this._getSummaryEntryForCacheLookup(trimmedUrl);
                if (entry && typeof entry.summary === 'string' && entry.summary.trim()) {
                    const cachedAtMs = new Date(entry.cachedAt || 0).getTime();
                    const ageOk =
                        maxAgeMs === Infinity ||
                        (Number.isFinite(cachedAtMs) && Date.now() - cachedAtMs <= maxAgeMs);
                    if (ageOk) {
                        const alternativeLinks = Array.isArray(entry.alternativeLinks)
                            ? entry.alternativeLinks
                            : [];
                        return { summary: entry.summary.trim(), alternativeLinks };
                    }
                }
            } catch (e) {
                console.warn('KI: Cache lesen fehlgeschlagen:', e);
            }
        }

        if (cacheKey && this.completionPromises[cacheKey]) {
            return this.completionPromises[cacheKey];
        }

        const promise = this._summarizeArticle(promptUrl, title, description);
        if (cacheKey) {
            this.completionPromises[cacheKey] = promise;
        }

        try {
            const result = await promise;
            if (result && typeof result === 'object') {
                const summaryOk =
                    typeof result.summary === 'string' &&
                    result.summary.trim() &&
                    !result.summary.startsWith('Zusammenfassung nicht möglich:');
                if (summaryOk) {
                    result.alternativeLinks = await this.fetchAlternativeLinksFromBingNewsSearch(
                        title,
                        description,
                        promptUrl
                    );
                } else {
                    result.alternativeLinks = [];
                }
                const altWant = this.getAlternativeLinksSearchResultCount();
                if (Array.isArray(result.alternativeLinks) && result.alternativeLinks.length > 0) {
                    result.alternativeLinks = await this.filterAlternativeLinksByServerProbe(
                        result.alternativeLinks,
                        altWant
                    );
                }
            }
            const ok =
                result &&
                typeof result.summary === 'string' &&
                result.summary.trim() &&
                !result.summary.startsWith('Zusammenfassung nicht möglich:');
            if (ok) {
                try {
                    if (cacheKey) {
                        await this.storage.saveSummary(
                            cacheKey,
                            result.summary.trim(),
                            result.alternativeLinks
                        );
                    }
                } catch (e) {
                    console.warn('KI: Cache speichern fehlgeschlagen (Zusammenfassung wird trotzdem angezeigt):', e);
                }
            }
            return result;
        } finally {
            if (cacheKey) {
                delete this.completionPromises[cacheKey];
            }
        }
    }

    /**
     * User setting: `heise_summary_lang_mode` — `site` (match article host) or `browser` (navigator.language).
     * @returns {'site'|'browser'}
     */
    getSummaryLangMode() {
        try {
            const m = localStorage.getItem('heise_summary_lang_mode');
            return m === 'browser' ? 'browser' : 'site';
        } catch (_) {
            return 'site';
        }
    }

    /**
     * Primary language subtag for prompts, e.g. `de`, `en`, `fr`.
     * @returns {string}
     */
    getBrowserLanguageCode() {
        try {
            const raw =
                typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en';
            const code = String(raw).split('-')[0].toLowerCase();
            return /^[a-z]{2,8}$/.test(code) ? code : 'en';
        } catch (_) {
            return 'en';
        }
    }

    /**
     * Target language for the summary: either the news site's typical language or the browser UI language.
     * @param {string} articleUrl
     * @returns {string} ISO 639-1 style code (2–8 chars)
     */
    resolveOutputLanguageCode(articleUrl) {
        if (this.getSummaryLangMode() === 'browser') {
            return this.getBrowserLanguageCode();
        }
        return AISummarizer.siteLanguageFromArticleUrl(articleUrl);
    }

    /**
     * Typical publication language for known feeds (used when summary language mode is `site`).
     * @param {string} articleUrl
     * @returns {string}
     */
    static siteLanguageFromArticleUrl(articleUrl) {
        const raw = String(articleUrl || '').trim();
        if (!raw) {
            return 'de';
        }
        try {
            const utils = AISummarizer.sourceRegistryUtils();
            const host = new URL(raw).hostname;
            if (utils && typeof utils.getSourceLanguageByHostname === 'function') {
                const lang = String(utils.getSourceLanguageByHostname(host) || '')
                    .trim()
                    .toLowerCase();
                if (lang) {
                    return lang;
                }
            }
            if (utils && typeof utils.getSourceIdByHostname === 'function') {
                const id = String(utils.getSourceIdByHostname(host) || '').trim();
                if (id) {
                    const lang = AISummarizer.getSourceLanguage(id);
                    if (lang) {
                        return lang;
                    }
                }
            }
        } catch (_) {
            /* ignore */
        }
        return 'de';
    }

    /**
     * Human-readable language name for non-de/non-en prompt instructions.
     * @param {string} code
     * @returns {string}
     */
    formatLanguageNameForPrompt(code) {
        try {
            if (typeof Intl !== 'undefined' && Intl.DisplayNames) {
                const loc =
                    typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en';
                const dn = new Intl.DisplayNames([loc], { type: 'language' });
                const name = dn.of(code);
                if (name && typeof name === 'string') {
                    return name;
                }
            }
        } catch (_) {
            /* ignore */
        }
        return code;
    }

    buildPromptPayload(url, title, description) {
        const lang = this.resolveOutputLanguageCode(url);
        const source = this.getNewsSourceLabel();
        const descLine = description ? `Beschreibung: ${description}` : '';
        const titleEsc = String(title || '');
        const descEsc = String(description || '');
        /* Alternative links are fetched by the app via Bing News RSS (GET /api/search-news), not by the model. */

        if (lang === 'de') {
            const prompt = `Erstelle eine prägnante Zusammenfassung auf Deutsch (maximal 3–4 Sätze) für diese Nachricht:

Titel: ${titleEsc}
${descLine}
Quelle: ${source}
URL: ${url}

Wichtig für die Ausgabe:
- Nur der fertige Zusammenfassungstext auf Deutsch.
- Kein „Thinking Process“, keine Zwischenüberlegungen, keine nummerierten Arbeitsschritte, kein Englisch, keine Meta-Kommentare (z. B. „Attempt“, „Critique“, „Final Review“).
- Keine Einleitung wie „Hier ist die Zusammenfassung:“ — beginne direkt mit dem ersten Satz der Meldung.`;

            const systemContent =
                'Du bist ein professioneller Nachrichten-Zusammenfasser für ein deutsches Publikum. Liefere ausschließlich den lesbaren Zusammenfassungstext auf Deutsch — niemals interne Denkprozesse, Entwürfe oder zweisprachige Analysen.';

            return { prompt, systemContent };
        }

        if (lang === 'en') {
            const prompt = `Write a concise summary in English (3–4 sentences max) for this news item:

Title: ${titleEsc}
${description ? `Description: ${descEsc}` : ''}
Source: ${source}
URL: ${url}

Output rules:
- Only the final summary text in English.
- No chain-of-thought, no numbered drafts, no meta-commentary (e.g. “Attempt”, “Critique”, “Final Review”).
- Do not start with “Here is the summary:” — begin directly with the first sentence.`;

            const systemContent =
                'You are a professional news summarizer for an English-speaking audience. Output only the readable summary in English — never internal reasoning, drafts, or bilingual commentary.';

            return { prompt, systemContent };
        }

        const langName = this.formatLanguageNameForPrompt(lang);
        const prompt = `Write a concise summary in ${langName} (3–4 sentences max) for this news item:

Title: ${titleEsc}
${description ? `Description: ${descEsc}` : ''}
Source: ${source}
URL: ${url}

Output rules:
- The entire summary must be written only in ${langName} (language code: ${lang}).
- No chain-of-thought, no numbered drafts, no meta-commentary.
- Do not preface with a label like “Summary:” — start with the first sentence of the summary.`;

        const systemContent = `You are a professional news summarizer. Output only the final summary text entirely in ${langName} — never internal reasoning or mixed-language drafts.`;

        return { prompt, systemContent };
    }

    /**
     * LM Studio / OpenAI-style message parts: string, array of {text}, or { text: string }.
     * @param {unknown} content
     * @returns {string}
     */
    static normalizeMessageContentParts(content) {
        if (content == null) {
            return '';
        }
        if (typeof content === 'string') {
            return content;
        }
        if (typeof content === 'number' || typeof content === 'boolean') {
            return String(content);
        }
        if (Array.isArray(content)) {
            return content
                .map((part) => {
                    if (part == null) {
                        return '';
                    }
                    if (typeof part === 'string') {
                        return part;
                    }
                    if (typeof part === 'object') {
                        const pType = String(part.type || '').toLowerCase();
                        if (pType === 'reasoning' || pType === 'reasoning_text') {
                            return '';
                        }
                        if (typeof part.text === 'string') {
                            return part.text;
                        }
                        if (typeof part.output_text === 'string') {
                            return part.output_text;
                        }
                        if (typeof part.content === 'string') {
                            return part.content;
                        }
                        /** Nested part arrays (some LM / Responses builds). */
                        if (Array.isArray(part.content)) {
                            return AISummarizer.normalizeMessageContentParts(part.content);
                        }
                    }
                    return '';
                })
                .join('');
        }
        if (typeof content === 'object') {
            if (typeof content.text === 'string') {
                return content.text;
            }
            if (typeof content.output_text === 'string') {
                return content.output_text;
            }
            if (typeof content.message === 'string') {
                return content.message;
            }
            if (Array.isArray(content.parts)) {
                return AISummarizer.normalizeMessageContentParts(content.parts);
            }
            if (Array.isArray(content.content)) {
                return AISummarizer.normalizeMessageContentParts(content.content);
            }
        }
        return '';
    }

    /**
     * Last-resort text extraction when `content` is a nested structure not covered by
     * {@link normalizeMessageContentParts} (beta LM builds, proxy transforms).
     * Skips obvious reasoning leaves.
     * @param {unknown} value
     * @param {number} depth
     * @returns {string}
     */
    static deepCollectAssistantText(value, depth = 0) {
        if (depth > 10 || value == null) {
            return '';
        }
        if (typeof value === 'string') {
            return value;
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
        }
        if (Array.isArray(value)) {
            return value
                .map((v) => AISummarizer.deepCollectAssistantText(v, depth + 1))
                .join('');
        }
        if (typeof value === 'object') {
            const t = String(/** @type {{ type?: string }} */ (value).type || '').toLowerCase();
            if (t === 'reasoning' || t === 'reasoning_text') {
                return '';
            }
            const o = /** @type {Record<string, unknown>} */ (value);
            const keys = ['text', 'output_text', 'message'];
            let s = '';
            for (const k of keys) {
                if (typeof o[k] === 'string') {
                    s += o[k];
                }
            }
            if (s.trim()) {
                return s;
            }
            for (const k of Object.keys(o)) {
                if (k === 'type' || k === 'tool' || k === 'arguments' || k === 'provider_info') {
                    continue;
                }
                s += AISummarizer.deepCollectAssistantText(o[k], depth + 1);
            }
            return s;
        }
        return '';
    }

    /**
     * LM Studio 0.4+ native REST: POST /api/v1/chat
     * Only assistant `message` / `assistant` output is user-facing — never `reasoning`.
     * @see https://lmstudio.ai/docs/developer/rest/chat
     */
    static extractLmRestV1MessageText(data) {
        const items = AISummarizer.lmRestGetOutputItems(data);
        const messages = [];
        for (const item of items) {
            if (!item) {
                continue;
            }
            const type = String(item.type || '').toLowerCase();
            if (type === 'reasoning') {
                continue;
            }
            let chunk = AISummarizer.normalizeMessageContentParts(item.content);
            if (!chunk || !String(chunk).trim()) {
                chunk = AISummarizer.normalizeMessageContentParts(item.message);
            }
            if (!chunk || !String(chunk).trim()) {
                chunk = typeof item.text === 'string' ? item.text : '';
            }
            if (!chunk || !String(chunk).trim()) {
                chunk = AISummarizer.deepCollectAssistantText(item.content);
            }
            if (!chunk || !String(chunk).trim()) {
                chunk = AISummarizer.deepCollectAssistantText(item.message);
            }
            const text = String(chunk || '').trim();
            if (!text) {
                continue;
            }
            messages.push(text);
        }
        let joined = messages.join('\n').trim();
        if (joined) {
            return joined;
        }
        /** Some proxies or builds embed OpenAI-style `choices` next to `output`. */
        if (data && typeof data === 'object' && Array.isArray(data.choices) && data.choices.length > 0) {
            const m = data.choices[0] && data.choices[0].message;
            if (m) {
                const alt = AISummarizer.normalizeMessageContentParts(m.content).trim();
                if (alt) {
                    return alt;
                }
            }
        }
        if (data && typeof data === 'object' && typeof data.message === 'string' && data.message.trim()) {
            return data.message.trim();
        }
        return '';
    }

    /**
     * Anthropic Messages API response: final assistant content is in `content[]` text blocks.
     * @param {unknown} data
     * @returns {string}
     */
    static extractAnthropicMessageText(data) {
        if (!data || typeof data !== 'object') {
            return '';
        }
        const row = /** @type {Record<string, unknown>} */ (data);
        const text = AISummarizer.normalizeMessageContentParts(row.content).trim();
        if (text) {
            return text;
        }
        return AISummarizer.deepCollectAssistantText(row.content).trim();
    }

    /**
     * Token usage from chat completion JSON (`usage` object). LM Studio often matches OpenAI shape.
     * @param {unknown} data
     * @returns {{ totalTokens: number, promptTokens: number, completionTokens: number } | null}
     */
    static extractUsageFromChatResponse(data) {
        if (typeof KiStats !== 'undefined' && KiStats.extractUsageFromChatResponse) {
            return KiStats.extractUsageFromChatResponse(data);
        }
        return null;
    }

    /**
     * @param {unknown} data
     * @param {string} [fallbackModel]
     * @returns {string}
     */
    static extractModelNameFromChatResponse(data, fallbackModel = '') {
        if (data && typeof data === 'object') {
            const row = /** @type {Record<string, unknown>} */ (data);
            const model = String(row.model ?? row.model_name ?? '').trim();
            if (model) {
                return model;
            }
        }
        return String(fallbackModel || '').trim();
    }

    /**
     * If the model still embeds chain-of-thought inside `message`, try to keep only the final German summary block.
     */
    static sanitizePublicSummary(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }
        const t = text.trim();
        if (!/Thinking Process|Analyze the Request|Attempt\s*\d|Critique\s*\d|Internal Monologue/i.test(t)) {
            return t;
        }
        const paras = t.split(/\n\n+/).map((p) => p.trim()).filter((p) => p.length > 50);
        const badStart =
            /^(Thinking|(\*\*)?Analyze|Attempt|Critique|Internal|Draft|Review|Final Review|Output|Self-Correction|Wait|Let's|Count:|The |\*\s|Step\s)/i;
        const candidates = paras.filter((p) => !badStart.test(p) && !/^\d+\.\s+\*\*/.test(p));
        const germanLike = /[äöüÄÖÜß]|(der|die|das|und|hat|wurde|wurden|für|nicht|eine|einen)\b/i;
        const lastGood = [...candidates].reverse().find((p) => germanLike.test(p) && p.length < 4000);
        const out = lastGood ? lastGood.trim() : t;
        if (!out.trim() && t.length > 0) {
            return t;
        }
        return out.trim();
    }

    /** True when the API returned reasoning blocks but no `message` block (nothing safe to show). */
    static lmRestHasOnlyReasoningOutput(data) {
        const items = AISummarizer.lmRestGetOutputItems(data);
        if (items.length === 0) {
            return false;
        }
        let hasMessage = false;
        let hasReasoning = false;
        for (const item of items) {
            if (!item) {
                continue;
            }
            const type = String(item.type || '').toLowerCase();
            let c = AISummarizer.normalizeMessageContentParts(item.content).trim();
            if (!c) {
                c = AISummarizer.normalizeMessageContentParts(item.message).trim();
            }
            if (!c && typeof item.text === 'string') {
                c = item.text.trim();
            }
            if (!c) {
                c = AISummarizer.deepCollectAssistantText(item.content).trim();
            }
            if (!c) {
                c = AISummarizer.deepCollectAssistantText(item.message).trim();
            }
            if (!c) {
                continue;
            }
            if (type === 'reasoning') {
                hasReasoning = true;
            } else {
                hasMessage = true;
            }
        }
        return hasReasoning && !hasMessage;
    }

    /**
     * @returns {Promise<{ summary: string, alternativeLinks: Array<{ title: string, url: string }> }>}
     */
    async _summarizeArticle(url, title, description) {
        const mode = this.getKiApiMode();
        if (mode === 'lm_rest_v1') {
            return this._summarizeLmRestV1(url, title, description);
        }
        if (mode === 'anthropic') {
            return this._summarizeAnthropic(url, title, description);
        }
        return this._summarizeOpenAiCompatible(url, title, description);
    }

    async _summarizeLmRestV1(url, title, description) {
        const chatUrl = this.getLmRestChatUrl();
        const hintBase = this.getEffectiveServerUrlForHints();
        const { prompt, systemContent } = this.buildPromptPayload(url, title, description);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.getKiRequestTimeoutMs());

        let modelInfo;
        try {
            modelInfo = await this.resolveLmRestModelInfo(controller.signal);
        } catch (error) {
            clearTimeout(timeoutId);
            return {
                summary: this._formatSummarizeError(error, url, hintBase, { isLmRest: true }),
                alternativeLinks: []
            };
        }
        const modelName = modelInfo.id;

        const baseBody = {
            model: modelName,
            input: String(prompt),
            system_prompt: String(systemContent),
            temperature: 0.7,
            /** Reasoning models may spend the whole budget on `type: "reasoning"`; need headroom for a final `message` */
            max_output_tokens: MAX_SUMMARY_OUTPUT_TOKENS,
            stream: false,
            store: false
        };
        
        const reasoningConfig = this.getLmReasoningConfigForModel(modelInfo.modelEntry);

        // If explicitly enabled and supported by the resolved model, send the selected enum.
        if (reasoningConfig.enabled) {
            baseBody.reasoning = reasoningConfig.level;
        }

        try {
            if (typeof localStorage !== 'undefined' && localStorage.getItem('heise_ki_debug') === '1') {
                console.info('[KI debug] LM REST POST', chatUrl, 'keys:', Object.keys(baseBody));
            }
        } catch (_) {
            /* ignore */
        }

        // Create a copy of baseBody without reasoning field for fallback
        const strippedBody = { ...baseBody };
        delete strippedBody.reasoning;

        const doLmRestFetch = async (body) => {
            const bodyJson = JSON.stringify(body);
            const response = await fetch(chatUrl, {
                method: 'POST',
                headers: this.buildJsonHeaders(),
                body: bodyJson,
                signal: controller.signal,
                mode: 'cors',
                credentials: 'omit'
            });
            const rawText = await response.text();
            let data;
            try {
                data = JSON.parse(rawText.trim());
            } catch {
                console.error('KI: Antwort ist kein JSON. Rohbeginn:', rawText.slice(0, 400));
                throw new Error(
                    response.ok
                        ? 'Ungültige JSON-Antwort (evtl. ngrok-Warnseite oder Proxy).'
                        : `HTTP ${response.status}`
                );
            }
            return { response, data };
        };

        const t0 = performance.now();
        const recordArticleStats = (dataPayload, fallbackModelName = '') => {
            try {
                if (typeof KiStats !== 'undefined' && KiStats.recordArticleSummary) {
                    KiStats.recordArticleSummary({
                        durationMs: Math.round(performance.now() - t0),
                        usage: AISummarizer.extractUsageFromChatResponse(dataPayload),
                        model: AISummarizer.extractModelNameFromChatResponse(dataPayload, fallbackModelName)
                    });
                }
            } catch (_) {
                /* ignore */
            }
        };

        try {
            let { response, data } = await doLmRestFetch(baseBody);

            // If API rejected reasoning field (model doesn't support it), retry without reasoning
            if (!response.ok && response.status === 400) {
                const detail = data.error?.message || data.message || JSON.stringify(data);
                if (/reasoning/i.test(String(detail))) {
                    // Only retry if reasoning was originally included in the request
                    if ('reasoning' in baseBody) {
                        console.warn('KI: LM REST lehnte reasoning-Parameter ab (Modell unterstützt kein Reasoning), wiederhole ohne Feld.');
                        ({ response, data } = await doLmRestFetch(strippedBody));
                    } else {
                        // Reasoning was already excluded, so the error is unexpected
                        console.error('KI: LM REST lehnte Anfrage ab, obwohl reasoning deaktiviert war:', detail);
                    }
                }
                if (!response.ok) {
                    const detail2 = data.error?.message || data.message || JSON.stringify(data);
                    console.error('KI HTTP-Fehler (LM REST):', response.status, detail2);
                    throw new Error(`API ${response.status}: ${detail2}`);
                }
            }

            const extractRaw = (payload) => {
                const textRaw = AISummarizer.extractLmRestV1MessageText(payload);
                return (textRaw || '').trim();
            };

            let rawText = extractRaw(data);
            if (rawText) {
                recordArticleStats(data, modelName);
                return this._packageSummaryResult(rawText);
            }

            if (AISummarizer.lmRestHasOnlyReasoningOutput(data)) {
                console.warn('KI: Nur Reasoning in output, wiederhole ohne reasoning-Feld.');
                ({ response, data } = await doLmRestFetch(strippedBody));
                if (!response.ok) {
                    const detail3 = data.error?.message || data.message || JSON.stringify(data);
                    console.error('KI HTTP-Fehler (LM REST):', response.status, detail3);
                    throw new Error(`API ${response.status}: ${detail3}`);
                }
                rawText = extractRaw(data);
                if (rawText) {
                    recordArticleStats(data, modelName);
                    return this._packageSummaryResult(rawText);
                }
                if (AISummarizer.lmRestHasOnlyReasoningOutput(data)) {
                    throw new Error(
                        'Die KI lieferte nur interne Reasoning-Ausgaben, keine öffentliche Zusammenfassung. Bitte „Neu erstellen“ oder in LM Studio Reasoning deaktivieren / ein anderes Modell wählen.'
                    );
                }
            }

            try {
                if (typeof localStorage !== 'undefined' && localStorage.getItem('heise_ki_debug') === '1') {
                    const keys = data && typeof data === 'object' ? Object.keys(data) : [];
                    console.warn('[KI debug] LM REST: kein extrahierbarer Text. Response keys:', keys);
                    console.warn('[KI debug] LM REST JSON (Anfang):', JSON.stringify(data).slice(0, 2800));
                }
            } catch (_) {
                /* ignore */
            }
            throw new Error(
                'Antwort ohne verwertbaren Text (kein `message`-Block in output). Bitte „Neu erstellen“ oder Modell prüfen.'
            );
        } catch (error) {
            return {
                summary: this._formatSummarizeError(error, url, hintBase, { isLmRest: true }),
                alternativeLinks: []
            };
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async _summarizeAnthropic(url, title, description) {
        const base = this.getAnthropicApiBase();
        const chatUrl = `${base}/messages`;
        const { prompt, systemContent } = this.buildPromptPayload(url, title, description);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.getKiRequestTimeoutMs());

        let modelInfo;
        try {
            modelInfo = await this.resolveAnthropicModelInfo(controller.signal);
        } catch (error) {
            clearTimeout(timeoutId);
            return {
                summary: this._formatSummarizeError(error, url, base, { isAnthropic: true }),
                alternativeLinks: []
            };
        }

        const requestBody = {
            model: modelInfo.id,
            system: String(systemContent),
            messages: [{ role: 'user', content: String(prompt) }],
            temperature: 0.7,
            max_tokens: MAX_SUMMARY_OUTPUT_TOKENS,
            stream: false
        };

        if (
            !Array.isArray(requestBody.messages) ||
            requestBody.messages.length === 0 ||
            !requestBody.messages.every(
                (m) => m && typeof m.role === 'string' && typeof m.content === 'string'
            )
        ) {
            console.error('KI: Ungültiges Anthropic messages-Array', requestBody);
            throw new Error('Interner Fehler: Ungültige Anthropic-Nachrichten (messages).');
        }

        const token = this.getLmApiToken();
        if (!token) {
            clearTimeout(timeoutId);
            return {
                summary: this._formatSummarizeError(
                    new Error('Anthropic API token is required.'),
                    url,
                    base,
                    { isAnthropic: true }
                ),
                alternativeLinks: []
            };
        }

        try {
            if (typeof localStorage !== 'undefined' && localStorage.getItem('heise_ki_debug') === '1') {
                console.info('[KI debug] Anthropic POST', chatUrl, 'keys:', Object.keys(requestBody));
            }
        } catch (_) {
            /* ignore */
        }

        const t0 = performance.now();
        try {
            const response = await fetch(chatUrl, {
                method: 'POST',
                headers: this.buildAnthropicHeaders({ includeContentType: true, tokenOverride: token }),
                body: JSON.stringify(requestBody),
                signal: controller.signal,
                mode: 'cors',
                credentials: 'omit'
            });

            const rawText = await response.text();
            let data;
            try {
                data = JSON.parse(rawText.trim());
            } catch {
                console.error('KI: Anthropic-Antwort ist kein JSON. Rohbeginn:', rawText.slice(0, 400));
                throw new Error(response.ok ? 'Ungültige JSON-Antwort von Anthropic.' : `HTTP ${response.status}`);
            }

            if (!response.ok) {
                const detail = data.error?.message || data.message || JSON.stringify(data);
                console.error('KI HTTP-Fehler (Anthropic):', response.status, detail);
                throw new Error(`API ${response.status}: ${detail}`);
            }

            const raw = AISummarizer.extractAnthropicMessageText(data);
            if (!raw.trim()) {
                throw new Error('Leere Anthropic-Antwort (kein Text im Modell-Output).');
            }

            try {
                if (typeof KiStats !== 'undefined' && KiStats.recordArticleSummary) {
                    KiStats.recordArticleSummary({
                        durationMs: Math.round(performance.now() - t0),
                        usage: AISummarizer.extractUsageFromChatResponse(data),
                        model: AISummarizer.extractModelNameFromChatResponse(data, requestBody.model)
                    });
                }
            } catch (_) {
                /* ignore */
            }

            return this._packageSummaryResult(raw);
        } catch (error) {
            return {
                summary: this._formatSummarizeError(error, url, base, { isAnthropic: true }),
                alternativeLinks: []
            };
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async _summarizeOpenAiCompatible(url, title, description) {
        const base = this.getApiBase();
        const chatUrl = `${base}/chat/completions`;
        const { prompt, systemContent } = this.buildPromptPayload(url, title, description);

        const userContent = `${systemContent}\n\n---\n\n${prompt}`;

        const requestBody = {
            model: this.getModelName(),
            messages: [{ role: 'user', content: String(userContent) }],
            temperature: 0.7,
            max_tokens: MAX_SUMMARY_OUTPUT_TOKENS,
            stream: false
        };

        if (
            !Array.isArray(requestBody.messages) ||
            requestBody.messages.length === 0 ||
            !requestBody.messages.every(
                (m) => m && typeof m.role === 'string' && typeof m.content === 'string'
            )
        ) {
            console.error('KI: Ungültiges messages-Array', requestBody);
            throw new Error('Interner Fehler: Ungültige Chat-Nachrichten (messages).');
        }

        const bodyJson = JSON.stringify(requestBody);
        if (!bodyJson.includes('"messages"')) {
            throw new Error('Interner Fehler: Request-Body enthält kein messages-Feld.');
        }

        try {
            if (typeof localStorage !== 'undefined' && localStorage.getItem('heise_ki_debug') === '1') {
                console.info('[KI debug] OpenAI POST', chatUrl, 'keys:', Object.keys(JSON.parse(bodyJson)));
            }
        } catch (_) {
            /* ignore */
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.getKiRequestTimeoutMs());

        const t0OpenAi = performance.now();
        try {
            const response = await fetch(chatUrl, {
                method: 'POST',
                headers: this.buildJsonHeaders(),
                body: bodyJson,
                signal: controller.signal,
                mode: 'cors',
                credentials: 'omit'
            });

            const rawText = await response.text();
            let data;
            try {
                data = JSON.parse(rawText.trim());
            } catch {
                console.error('KI: Antwort ist kein JSON. Rohbeginn:', rawText.slice(0, 400));
                throw new Error(
                    response.ok
                        ? 'Ungültige JSON-Antwort (evtl. ngrok-Warnseite oder Proxy).'
                        : `HTTP ${response.status}`
                );
            }

            if (!response.ok) {
                const detail = data.error?.message || data.message || JSON.stringify(data);
                console.error('KI HTTP-Fehler:', response.status, detail);
                throw new Error(`API ${response.status}: ${detail}`);
            }

            if (data.choices && data.choices.length > 0 && data.choices[0].message) {
                const raw = AISummarizer.normalizeMessageContentParts(
                    data.choices[0].message.content
                ).trim();
                if (!raw.trim()) {
                    throw new Error('Leere KI-Antwort (kein Text im Modell-Output).');
                }
                try {
                    if (typeof KiStats !== 'undefined' && KiStats.recordArticleSummary) {
                        KiStats.recordArticleSummary({
                            durationMs: Math.round(performance.now() - t0OpenAi),
                            usage: AISummarizer.extractUsageFromChatResponse(data),
                            model: AISummarizer.extractModelNameFromChatResponse(data, requestBody.model)
                        });
                    }
                } catch (_) {
                    /* ignore */
                }
                return this._packageSummaryResult(raw);
            }

            throw new Error('Antwort ohne choices[0].message');
        } catch (error) {
            return {
                summary: this._formatSummarizeError(error, url, base, { isLmRest: false }),
                alternativeLinks: []
            };
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Generic chat completion with explicit system + user prompts (no article-summary template).
     * Used e.g. for YouTube search suggestions without the YouTube Data API.
     * @param {string} systemPrompt
     * @param {string} userPrompt
     * @returns {Promise<string>}
     */
    async completePrompt(systemPrompt, userPrompt) {
        const mode = this.getKiApiMode();
        if (mode === 'lm_rest_v1') {
            return this._completeLmRestV1(systemPrompt, userPrompt);
        }
        if (mode === 'anthropic') {
            return this._completeAnthropicPrompt(systemPrompt, userPrompt);
        }
        return this._completeOpenAiCompatiblePrompt(systemPrompt, userPrompt);
    }

    async _completeLmRestV1(systemPrompt, userPrompt) {
        const chatUrl = this.getLmRestChatUrl();
        const hintBase = this.getEffectiveServerUrlForHints();

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.getKiRequestTimeoutMs());

        let modelInfo;
        try {
            modelInfo = await this.resolveLmRestModelInfo(controller.signal);
        } catch (error) {
            clearTimeout(timeoutId);
            throw new Error(this._formatPromptError(error, hintBase, { isLmRest: true }));
        }
        const modelName = modelInfo.id;

        const baseBody = {
            model: modelName,
            input: String(userPrompt),
            system_prompt: String(systemPrompt),
            temperature: 0.5,
            max_output_tokens: MAX_SUMMARY_OUTPUT_TOKENS,
            stream: false,
            store: false
        };
        
        const reasoningConfig = this.getLmReasoningConfigForModel(modelInfo.modelEntry);

        // If explicitly enabled and supported by the resolved model, send the selected enum.
        if (reasoningConfig.enabled) {
            baseBody.reasoning = reasoningConfig.level;
        }

        try {
            if (typeof localStorage !== 'undefined' && localStorage.getItem('heise_ki_debug') === '1') {
                console.info('[KI debug] LM REST completePrompt POST', chatUrl, 'keys:', Object.keys(baseBody));
            }
        } catch (_) {
            /* ignore */
        }

        const { reasoning: _reasoningOff, ...strippedBody } = baseBody;

        const doLmRestFetch = async (body) => {
            const bodyJson = JSON.stringify(body);
            const response = await fetch(chatUrl, {
                method: 'POST',
                headers: this.buildJsonHeaders(),
                body: bodyJson,
                signal: controller.signal,
                mode: 'cors',
                credentials: 'omit'
            });
            const rawText = await response.text();
            let data;
            try {
                data = JSON.parse(rawText.trim());
            } catch {
                console.error('KI: Antwort ist kein JSON. Rohbeginn:', rawText.slice(0, 400));
                throw new Error(
                    response.ok
                        ? 'Ungültige JSON-Antwort (evtl. ngrok-Warnseite oder Proxy).'
                        : `HTTP ${response.status}`
                );
            }
            return { response, data };
        };

        try {
            let { response, data } = await doLmRestFetch(baseBody);

            if (!response.ok) {
                const detail = data.error?.message || data.message || JSON.stringify(data);
                if (response.status === 400 && /reasoning/i.test(String(detail))) {
                    console.warn('KI: LM REST lehnte reasoning-Parameter ab, wiederhole ohne reasoning-Feld.');
                    ({ response, data } = await doLmRestFetch(strippedBody));
                }
                if (!response.ok) {
                    const detail2 = data.error?.message || data.message || JSON.stringify(data);
                    console.error('KI HTTP-Fehler (LM REST completePrompt):', response.status, detail2);
                    throw new Error(`API ${response.status}: ${detail2}`);
                }
            }

            const tryReturn = (payload) => {
                const textRaw = AISummarizer.extractLmRestV1MessageText(payload);
                const text = AISummarizer.sanitizePublicSummary(textRaw);
                const safe = (text || '').trim() || (textRaw || '').trim();
                return safe;
            };

            let text = tryReturn(data);
            if (text) {
                return text;
            }

            if (AISummarizer.lmRestHasOnlyReasoningOutput(data)) {
                console.warn('KI: Nur Reasoning in output, wiederhole ohne reasoning-Feld.');
                ({ response, data } = await doLmRestFetch(strippedBody));
                text = tryReturn(data);
                if (text) {
                    return text;
                }
            }

            try {
                if (typeof localStorage !== 'undefined' && localStorage.getItem('heise_ki_debug') === '1') {
                    const keys = data && typeof data === 'object' ? Object.keys(data) : [];
                    console.warn('[KI debug] LM REST completePrompt: kein extrahierbarer Text. Response keys:', keys);
                }
            } catch (_) {
                /* ignore */
            }
            throw new Error(
                'Antwort ohne verwertbaren Text (kein `message`-Block in output). Bitte Modell prüfen oder „OpenAI-kompatibel“ testen.'
            );
        } catch (error) {
            throw new Error(this._formatPromptError(error, hintBase, { isLmRest: true }));
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async _completeAnthropicPrompt(systemPrompt, userPrompt) {
        const base = this.getAnthropicApiBase();
        const chatUrl = `${base}/messages`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.getKiRequestTimeoutMs());

        let modelInfo;
        try {
            modelInfo = await this.resolveAnthropicModelInfo(controller.signal);
        } catch (error) {
            clearTimeout(timeoutId);
            throw new Error(this._formatPromptError(error, base, { isAnthropic: true }));
        }

        const requestBody = {
            model: modelInfo.id,
            system: String(systemPrompt),
            messages: [{ role: 'user', content: String(userPrompt) }],
            temperature: 0.5,
            max_tokens: MAX_SUMMARY_OUTPUT_TOKENS,
            stream: false
        };

        if (
            !Array.isArray(requestBody.messages) ||
            requestBody.messages.length === 0 ||
            !requestBody.messages.every(
                (m) => m && typeof m.role === 'string' && typeof m.content === 'string'
            )
        ) {
            console.error('KI: Ungültiges Anthropic messages-Array (completePrompt)', requestBody);
            throw new Error('Interner Fehler: Ungültige Anthropic-Nachrichten (messages).');
        }

        const token = this.getLmApiToken();
        if (!token) {
            clearTimeout(timeoutId);
            throw new Error(
                this._formatPromptError(
                    new Error('Anthropic API token is required.'),
                    base,
                    { isAnthropic: true }
                )
            );
        }

        try {
            if (typeof localStorage !== 'undefined' && localStorage.getItem('heise_ki_debug') === '1') {
                console.info('[KI debug] Anthropic completePrompt POST', chatUrl);
            }
        } catch (_) {
            /* ignore */
        }

        try {
            const response = await fetch(chatUrl, {
                method: 'POST',
                headers: this.buildAnthropicHeaders({ includeContentType: true, tokenOverride: token }),
                body: JSON.stringify(requestBody),
                signal: controller.signal,
                mode: 'cors',
                credentials: 'omit'
            });

            const rawText = await response.text();
            let data;
            try {
                data = JSON.parse(rawText.trim());
            } catch {
                console.error('KI: Anthropic-Antwort ist kein JSON. Rohbeginn:', rawText.slice(0, 400));
                throw new Error(response.ok ? 'Ungültige JSON-Antwort von Anthropic.' : `HTTP ${response.status}`);
            }

            if (!response.ok) {
                const detail = data.error?.message || data.message || JSON.stringify(data);
                console.error('KI HTTP-Fehler (Anthropic completePrompt):', response.status, detail);
                throw new Error(`API ${response.status}: ${detail}`);
            }

            const raw = AISummarizer.extractAnthropicMessageText(data);
            const sanitized = AISummarizer.sanitizePublicSummary(raw);
            const out = (sanitized || '').trim() || raw;
            if (!out.trim()) {
                throw new Error('Leere Anthropic-Antwort (kein Text im Modell-Output).');
            }
            return out;
        } catch (error) {
            throw new Error(this._formatPromptError(error, base, { isAnthropic: true }));
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async _completeOpenAiCompatiblePrompt(systemPrompt, userPrompt) {
        const base = this.getApiBase();
        const chatUrl = `${base}/chat/completions`;

        const requestBody = {
            model: this.getModelName(),
            messages: [
                { role: 'system', content: String(systemPrompt) },
                { role: 'user', content: String(userPrompt) }
            ],
            temperature: 0.5,
            max_tokens: MAX_SUMMARY_OUTPUT_TOKENS,
            stream: false
        };

        if (
            !Array.isArray(requestBody.messages) ||
            requestBody.messages.length === 0 ||
            !requestBody.messages.every(
                (m) => m && typeof m.role === 'string' && typeof m.content === 'string'
            )
        ) {
            console.error('KI: Ungültiges messages-Array (completePrompt)', requestBody);
            throw new Error('Interner Fehler: Ungültige Chat-Nachrichten (messages).');
        }

        const bodyJson = JSON.stringify(requestBody);

        try {
            if (typeof localStorage !== 'undefined' && localStorage.getItem('heise_ki_debug') === '1') {
                console.info('[KI debug] OpenAI completePrompt POST', chatUrl);
            }
        } catch (_) {
            /* ignore */
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.getKiRequestTimeoutMs());

        try {
            const response = await fetch(chatUrl, {
                method: 'POST',
                headers: this.buildJsonHeaders(),
                body: bodyJson,
                signal: controller.signal,
                mode: 'cors',
                credentials: 'omit'
            });

            const rawText = await response.text();
            let data;
            try {
                data = JSON.parse(rawText.trim());
            } catch {
                console.error('KI: Antwort ist kein JSON. Rohbeginn:', rawText.slice(0, 400));
                throw new Error(
                    response.ok
                        ? 'Ungültige JSON-Antwort (evtl. ngrok-Warnseite oder Proxy).'
                        : `HTTP ${response.status}`
                );
            }

            if (!response.ok) {
                const detail = data.error?.message || data.message || JSON.stringify(data);
                console.error('KI HTTP-Fehler (completePrompt):', response.status, detail);
                throw new Error(`API ${response.status}: ${detail}`);
            }

            if (data.choices && data.choices.length > 0 && data.choices[0].message) {
                const raw = AISummarizer.normalizeMessageContentParts(
                    data.choices[0].message.content
                ).trim();
                const sanitized = AISummarizer.sanitizePublicSummary(raw);
                const out = (sanitized || '').trim() || raw;
                if (!out.trim()) {
                    throw new Error('Leere KI-Antwort (kein Text im Modell-Output).');
                }
                return out;
            }

            throw new Error('Antwort ohne choices[0].message');
        } catch (error) {
            throw new Error(this._formatPromptError(error, base, { isLmRest: false }));
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * @param {{ isLmRest?: boolean, isAnthropic?: boolean }} opts
     */
    _formatPromptError(error, hintBase, opts = {}) {
        console.error('KI-Prompt fehlgeschlagen:', error.name, error.message);

        const pageIsSecure = typeof window !== 'undefined' && window.isSecureContext;
        const apiIsHttp = String(hintBase).startsWith('http:');
        const isFetchFailure = error.name === 'TypeError' && String(error.message).includes('fetch');

        let hint = '';
        if (isFetchFailure) {
            if (pageIsSecure && apiIsHttp) {
                hint =
                    ' Mixed Content: Die Seite läuft per HTTPS, die API nur per HTTP — der Browser blockiert das. Entweder Dashboard per http:// öffnen oder die API per HTTPS (z. B. ngrok) anbinden.';
            } else if (opts.isLmRest) {
                hint =
                    ' CORS/Preflight: Am zuverlässigsten `python3 scripts/dev_server.py`, Seite von dort öffnen und „REST über dieselbe Origin“ aktivieren. Oder `python3 scripts/lm_studio_cors_proxy.py` + Server-URL :1244. Alternativ: „OpenAI-kompatibel“. Siehe README.';
            } else if (opts.isAnthropic) {
                hint =
                    ' Anthropic: Server-URL muss auf /v1 zeigen, der API-Token ist erforderlich, und der Browser muss api.anthropic.com per CORS erreichen können.';
            } else {
                hint =
                    ' Netzwerk/CORS: In LM Studio „Enable CORS“, Local Server, Modell geladen. OpenAI-URL mit /v1. Siehe README.';
            }
        }

        return `KI-Aufgabe fehlgeschlagen: ${error.message}.${hint}`;
    }

    /**
     * @param {{ isLmRest?: boolean, isAnthropic?: boolean }} opts
     */
    _formatSummarizeError(error, url, hintBase, opts = {}) {
        console.error('KI-Zusammenfassung fehlgeschlagen:', error.name, error.message);

        const pageIsSecure = typeof window !== 'undefined' && window.isSecureContext;
        const apiIsHttp = String(hintBase).startsWith('http:');
        const isFetchFailure = error.name === 'TypeError' && String(error.message).includes('fetch');

        let hint = '';
        if (isFetchFailure) {
            if (pageIsSecure && apiIsHttp) {
                hint =
                    ' Mixed Content: Die Seite läuft per HTTPS, die API nur per HTTP — der Browser blockiert das. Entweder Dashboard per http:// öffnen oder die API per HTTPS (z. B. ngrok) anbinden.';
            } else if (opts.isLmRest) {
                hint =
                    ' CORS/Preflight / OPTIONS: Am zuverlässigsten: `python3 scripts/dev_server.py`, Seite von dort öffnen und „REST über dieselbe Origin“ aktivieren. Oder `python3 scripts/lm_studio_cors_proxy.py` + Server-URL :1244. Alternativ: „OpenAI-kompatibel“. Siehe README.';
            } else if (opts.isAnthropic) {
                hint =
                    ' Anthropic: Server-URL muss auf /v1 zeigen, der API-Token ist erforderlich, und der Browser muss api.anthropic.com per CORS erreichen können.';
            } else {
                hint =
                    ' Netzwerk/CORS: In LM Studio „Enable CORS“, Local Server, Modell geladen. OpenAI-URL mit /v1. ngrok: HTTPS-URL. Siehe README.';
            }
        }

        return `Zusammenfassung nicht möglich: ${error.message}.${hint} Artikel: ${url}`;
    }
}

window.AISummarizer = AISummarizer;
